// api/_lib/admin-game.js
// Rotas de gamificação do painel admin. Plugue no admin.js (ver INTEGRACAO.md).
//
//   GET  admin?action=codigos-listar
//   POST admin?action=codigos-criar      { tipo:'xp'|'moedas'|'item', valor, item:'slot:id', maxUsos, expiraHoras, codigo?, nota? }
//   POST admin?action=codigos-toggle     { codigo, ativo }
//   POST admin?action=codigos-excluir    { codigo }
//   GET  admin?action=jogador-buscar&q=  (usuário/nick/id)
//   POST admin?action=jogador-conceder   { id, xp?, moedas?, item? }   ← itens LIMITADOS de evento saem daqui
//
// COMO OS CÓDIGOS SÃO GERADOS:
//   • Gerados no SERVIDOR com crypto.randomBytes (não dá pra adivinhar nem prever).
//   • Formato  SOSO-XXXX-XXXX  com alfabeto sem 0/O/1/I/L (fácil de a Soso falar na live).
//   • Cada código tem: prêmio (XP | moedas | item), limite de usos, validade e liga/desliga.
//   • Resgate: 1× por pessoa (SADD atômico) + limite global (INCR atômico) + anti brute-force.
import { randomBytes } from 'crypto';
import { redis, jparse, safeStr } from './core.js';
import { acharItem, creditar, notificar, avaliarConquistas, MOEDA, SLOTS } from './game.js';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 31 símbolos (sem confusão ao falar)
function gerarCodigo(){
  const b = randomBytes(8);
  const parte = off => Array.from({ length: 4 }, (_, i) => ALFABETO[b[off + i] % ALFABETO.length]).join('');
  return `SOSO-${parte(0)}-${parte(4)}`;
}

/* Retorna true se tratou a rota (aí o admin.js dá `return`). */
export async function handleAdminGame({ req, res, action, sessao, temPermissao, logAcao, quem }){
  const M = req.method;

  /* ---------- listar ---------- */
  if(M === 'GET' && action === 'codigos-listar'){
    if(!(await temPermissao(sessao, 'gerenciar_codigos'))) { res.status(403).json({ error: 'Sem permissão' }); return true; }
    const [flat] = await redis([['HGETALL', 'codes']]);
    const itens = [];
    for(let i = 0; i < (flat || []).length; i += 2){
      const c = jparse(flat[i + 1]); if(c) itens.push(c);
    }
    const cmds = itens.map(c => ['GET', `codes:cnt:${c.codigo}`]);
    const usos = cmds.length ? await redis(cmds) : [];
    itens.forEach((c, i) => { c.usos = Math.min(Number(usos[i] || 0), c.maxUsos || Infinity); });
    itens.sort((a, b) => b.criadoEm - a.criadoEm);
    res.status(200).json({ codigos: itens, moeda: MOEDA.nome });
    return true;
  }

  /* ---------- criar ---------- */
  if(M === 'POST' && action === 'codigos-criar'){
    if(!(await temPermissao(sessao, 'gerenciar_codigos'))) { res.status(403).json({ error: 'Sem permissão' }); return true; }
    const b = req.body || {};
    const tipo = ['xp', 'moedas', 'item'].includes(b.tipo) ? b.tipo : null;
    if(!tipo){ res.status(400).json({ error: 'Tipo inválido (xp, moedas ou item).' }); return true; }

    let valor = 0, item = null;
    if(tipo === 'item'){
      const [slot, id] = String(b.item || '').split(':');
      if(!SLOTS.includes(slot) || !acharItem(slot, id)){ res.status(400).json({ error: 'Item inexistente (use slot:id, ex.: efeito:confete).' }); return true; }
      item = `${slot}:${id}`;
    } else {
      valor = Math.floor(Number(b.valor));
      const teto = tipo === 'xp' ? 5000 : 10000;
      if(!(valor > 0 && valor <= teto)){ res.status(400).json({ error: `Valor deve ficar entre 1 e ${teto}.` }); return true; }
    }
    const maxUsos = Math.max(0, Math.min(100000, Math.floor(Number(b.maxUsos ?? 100))));   // 0 = ilimitado
    const horas = Number(b.expiraHoras);
    const expiraEm = horas > 0 ? Date.now() + Math.min(horas, 24 * 365) * 3600 * 1000 : null;

    let codigo = safeStr(b.codigo, 32).toUpperCase().replace(/\s+/g, '');
    if(codigo){
      if(!/^[A-Z0-9-]{4,32}$/.test(codigo)){ res.status(400).json({ error: 'Código personalizado: 4–32 caracteres (A-Z, 0-9, hífen).' }); return true; }
    } else {
      for(let t = 0; t < 5; t++){            // evita colisão
        const c = gerarCodigo();
        const [existe] = await redis([['HEXISTS', 'codes', c]]);
        if(!Number(existe)){ codigo = c; break; }
      }
      if(!codigo){ res.status(500).json({ error: 'Não consegui gerar um código único. Tente de novo.' }); return true; }
    }
    const obj = {
      codigo, tipo, valor, item, maxUsos, expiraEm, ativo: true,
      nota: safeStr(b.nota, 80), criadoPor: quem, criadoEm: Date.now()
    };
    const [novo] = await redis([['HSETNX', 'codes', codigo, JSON.stringify(obj)]]);
    if(Number(novo) !== 1){ res.status(409).json({ error: 'Esse código já existe.' }); return true; }
    await logAcao(quem, sessao.cargo, `Criou código ${codigo} (${tipo}${item ? ' ' + item : ' ' + valor})`);
    res.status(200).json({ ok: true, codigo: obj });
    return true;
  }

  /* ---------- ligar / desligar ---------- */
  if(M === 'POST' && action === 'codigos-toggle'){
    if(!(await temPermissao(sessao, 'gerenciar_codigos'))) { res.status(403).json({ error: 'Sem permissão' }); return true; }
    const cod = safeStr(req.body?.codigo, 32).toUpperCase();
    const [raw] = await redis([['HGET', 'codes', cod]]);
    const c = jparse(raw);
    if(!c){ res.status(404).json({ error: 'Código não encontrado' }); return true; }
    c.ativo = !!req.body?.ativo;
    await redis([['HSET', 'codes', cod, JSON.stringify(c)]]);
    await logAcao(quem, sessao.cargo, `${c.ativo ? 'Ativou' : 'Desativou'} código ${cod}`);
    res.status(200).json({ ok: true, codigo: c });
    return true;
  }

  /* ---------- excluir ---------- */
  if(M === 'POST' && action === 'codigos-excluir'){
    if(!(await temPermissao(sessao, 'gerenciar_codigos'))) { res.status(403).json({ error: 'Sem permissão' }); return true; }
    const cod = safeStr(req.body?.codigo, 32).toUpperCase();
    await redis([['HDEL', 'codes', cod], ['DEL', `codes:cnt:${cod}`], ['DEL', `codes:used:${cod}`]]);
    await logAcao(quem, sessao.cargo, `Excluiu código ${cod}`);
    res.status(200).json({ ok: true });
    return true;
  }

  /* ---------- buscar jogador ---------- */
  if(M === 'GET' && action === 'jogador-buscar'){
    if(!(await temPermissao(sessao, 'conceder_recompensas'))) { res.status(403).json({ error: 'Sem permissão' }); return true; }
    const q = safeStr(req.query?.q, 30).toLowerCase();
    if(q.length < 2){ res.status(400).json({ error: 'Digite ao menos 2 caracteres.' }); return true; }
    let id = null;
    const [porUser] = await redis([['HGET', 'usernames', q]]);
    if(porUser) id = porUser;
    else if(q.startsWith('u_')) id = q;
    else {
      const [flat] = await redis([['HGETALL', 'accounts']]);          // comunidade pequena: varredura simples
      for(let i = 0; i < (flat || []).length; i += 2){
        const c = jparse(flat[i + 1]);
        if(c && String(c.nick || '').toLowerCase().includes(q)){ id = c.id; break; }
      }
    }
    if(!id){ res.status(404).json({ error: 'Jogador não encontrado.' }); return true; }
    const [contaRaw, xp, coins] = await redis([['HGET', 'accounts', id], ['HGET', `g:${id}`, 'xp'], ['HGET', `g:${id}`, 'coins']]);
    const c = jparse(contaRaw, {});
    res.status(200).json({ id, usuario: c.usuario, nick: c.nick, xp: Number(xp || 0), coins: Number(coins || 0), twitch: c.twitch ? c.twitch.login : null });
    return true;
  }

  /* ---------- conceder (XP / moedas / item de evento) ---------- */
  if(M === 'POST' && action === 'jogador-conceder'){
    if(!(await temPermissao(sessao, 'conceder_recompensas'))) { res.status(403).json({ error: 'Sem permissão' }); return true; }
    const { id, xp, moedas, item } = req.body || {};
    const alvo = safeStr(id, 40);
    const [existe] = await redis([['EXISTS', `g:${alvo}`]]);
    if(!Number(existe)){ res.status(404).json({ error: 'Jogador não encontrado.' }); return true; }
    const partes = [];
    const vxp = Math.floor(Number(xp) || 0), vc = Math.floor(Number(moedas) || 0);
    if(vxp < 0 || vc < 0 || vxp > 20000 || vc > 50000){ res.status(400).json({ error: 'Valores fora do limite.' }); return true; }
    if(vxp || vc){ await creditar(alvo, { xp: vxp, coins: vc, motivo: 'Presente da staff' }); partes.push(`${vxp} XP`, `${vc} moedas`); }
    if(item){
      const [slot, iid] = String(item).split(':');
      if(!acharItem(slot, iid)){ res.status(400).json({ error: 'Item inexistente.' }); return true; }
      await redis([['SADD', `inv:${alvo}`, `${slot}:${iid}`]]);
      await notificar(alvo, 'item', `Você recebeu: ${acharItem(slot, iid).nome}!`);
      partes.push(`item ${slot}:${iid}`);
    }
    if(!partes.length){ res.status(400).json({ error: 'Nada para conceder.' }); return true; }
    await avaliarConquistas(alvo);
    await logAcao(quem, sessao.cargo, `Concedeu a ${alvo}: ${partes.join(', ')}`);
    res.status(200).json({ ok: true });
    return true;
  }

  return false;
}
