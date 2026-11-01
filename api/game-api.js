// Vercel serverless: /api/game.js
// Leitura do estado do jogo + ações que o usuário pode pedir (todas validadas aqui).
//
//   GET  /api/game?action=catalogo          (público)  catálogo, raridades, conquistas, títulos, regras
//   GET  /api/game?action=ranking           (público)  Top 50 com boneco
//   GET  /api/game?action=perfil            (logado)   tudo do jogador + posição no ranking
//   POST /api/game?action=resgatar          {codigo}   código secreto
//   POST /api/game?action=comprar           {slot,id}  item de loja (SosoCoins)
//   POST /api/game?action=titulo            {id}       equipa título
//   POST /api/game?action=notif-lidas
//   GET  /api/game?action=cron-presenca     (Bearer CRON_SECRET)  tempo de tela / streak
//
// ⚠️ NÃO EXISTE rota "ganhar XP" aqui. XP/moedas só mudam via _lib/game.js (servidor).
import { timingSafeEqual } from 'crypto';
import {
  ENV, redis, paraObj, jparse, rateLimit, ipDe, origemOk, lerSessao, cargoDe, safeStr, hojeBR
} from './_lib/core.js';
import {
  MOEDA, RARIDADES, CONQUISTAS, PLATINA, TITULOS, SLOTS, LIVE, BONECO_PADRAO, NIVEL_MAX,
  catalogoPublico, acharItem, precoDe, infoNivel, lerStats, contarItens, itemLiberado, titulosDe,
  validarBoneco, creditar, notificar, lerNotificacoes, avaliarConquistas, xpDoNivel, CATALOGO
} from './_lib/game.js';
import { cronPresenca } from './_lib/twitch.js';

/* sessão válida (para contas próprias confere a versão → senha trocada derruba o resto) */
async function sessaoValida(req){
  const s = lerSessao(req);
  if(!s) return null;
  if(s.tipo === 'own'){
    const [raw] = await redis([['HGET', 'accounts', String(s.id)]]);
    const c = jparse(raw);
    if(!c || c.sv !== s.sv) return null;
  }
  return s;
}

const REGRAS_PUBLICAS = {
  moeda: MOEDA, nivelMax: NIVEL_MAX,
  xp: [
    'Voto na votação: +10 XP · +5 moedas (até 3 por dia)',
    'Sugestão enviada: +5 XP · +2 moedas (até 3 por dia)',
    'Sugestão aprovada pela Soso: +60 XP · +30 moedas',
    `Cada minuto assistido na live: +1 XP · +1 moeda a cada 10 min (máx. ${LIVE.TETO_MIN_SESSAO / 60}h por live)`,
    `Live contada (≥ ${LIVE.MIN_PRESENCA} min): +${LIVE.XP_PRESENCA} XP + ${LIVE.XP_STREAK_POR_LIVE} XP × sua sequência`,
    'Códigos secretos falados na live: XP, moedas ou itens',
    'Cada nível novo: +20 moedas'
  ],
  streak: {
    texto: `Sequência = lives CONSECUTIVAS em que você ficou pelo menos ${LIVE.MIN_PRESENCA} min no chat. ` +
           'O servidor confere a Twitch a cada 5 minutos (live no ar + lista de quem está no chat) e só conta contas com Twitch vinculada. ' +
           'Perdeu uma live válida → a sequência volta a 1. Lives com menos de 30 min no ar não contam para ninguém.',
    marcos: LIVE.MARCOS_STREAK
  },
  tempoDeTela: 'O tempo de tela é medido pelo servidor, nunca pelo navegador. Vincule sua Twitch (OAuth) para ele ser creditado.'
};

function conquistasPublicas(){
  return [...CONQUISTAS, PLATINA].map(c => ({
    id: c.id, icone: c.icone, nome: c.nome, desc: c.desc, r: c.r, premio: c.premio
  }));
}

export default async function handler(req, res){
  if(!ENV.SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  const action = (req.query && req.query.action) || '';

  try {
    /* ============ CRON (sem sessão; Bearer) ============ */
    if(action === 'cron-presenca'){
      const segredo = process.env.CRON_SECRET;
      if(!segredo) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
      const a = Buffer.from(req.headers.authorization || ''), b = Buffer.from(`Bearer ${segredo}`);
      if(a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Não autorizado' });
      return res.status(200).json(await cronPresenca());
    }

    /* ============ CATÁLOGO (público) ============ */
    if(action === 'catalogo'){
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({
        slots: SLOTS, padrao: BONECO_PADRAO, raridades: RARIDADES,
        catalogo: catalogoPublico(), conquistas: conquistasPublicas(),
        titulos: TITULOS.map(t => ({ id: t.id, nome: t.nome, r: t.r, regra: t.regra })),
        regras: REGRAS_PUBLICAS
      });
    }

    /* ============ RANKING (público) ============ */
    if(action === 'ranking'){
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
      const limite = Math.min(100, Math.max(3, Number(req.query.limite) || 50));
      const [flat, total] = await redis([['ZREVRANGE', 'rank:xp', '0', String(limite - 1), 'WITHSCORES'], ['ZCARD', 'rank:xp']]);
      const ids = [], xps = [];
      for(let i = 0; i < (flat || []).length; i += 2){ ids.push(flat[i]); xps.push(Number(flat[i + 1])); }
      if(!ids.length) return res.status(200).json({ total: 0, lista: [] });

      const cmds = [['HMGET', 'accounts', ...ids], ['HMGET', 'user_profiles', ...ids]];
      ids.forEach(id => cmds.push(['HMGET', `g:${id}`, 'boneco', 'titulo', 'melhorStreak']));
      const [contas, perfis, ...gs] = await redis(cmds);

      const titulos = Object.fromEntries(TITULOS.map(t => [t.id, t.nome]));
      const lista = ids.map((id, i) => {
        const conta = jparse(contas[i]), perfil = jparse(perfis[i]);
        const [bruto, titulo] = gs[i];
        const nome = (conta && conta.nick) || (perfil && perfil.username) || 'Anônimo';
        const boneco = validarBoneco(jparse(bruto, BONECO_PADRAO), null, true).boneco;   // só saneia a estrutura
        return {
          pos: i + 1, id, nome, xp: xps[i], nivel: infoNivel(xps[i]).nivel,
          titulo: titulos[titulo] || 'Novato', boneco,
          avatar: (!conta && perfil && perfil.avatar) || null   // Discord legado sem boneco
        };
      });
      return res.status(200).json({ total: Number(total), lista });
    }

    /* ============ daqui pra baixo: precisa de login ============ */
    const sessao = await sessaoValida(req);
    if(!sessao) return res.status(401).json({ error: 'Faça login' });
    res.setHeader('Cache-Control', 'no-store');
    const id = String(sessao.id);
    const ehDev = (await cargoDe(id)) === 'dev';

    /* ============ PERFIL ============ */
    if(action === 'perfil'){
      const S = await lerStats(id);
      S.itens = contarItens(S);
      const [pos, total] = await redis([['ZREVRANK', 'rank:xp', id], ['ZCARD', 'rank:xp']]);
      const nv = infoNivel(S.xp);

      const liberados = {};
      SLOTS.forEach(slot => {
        liberados[slot] = CATALOGO[slot].filter(it => itemLiberado(slot, it, S, ehDev)).map(it => it.id);
      });

      const notifs = await lerNotificacoes(id);
      const conquistas = conquistasPublicas().map(c => ({ ...c, ts: S.ach[c.id] ? Number(S.ach[c.id]) : null }));
      const feitas = conquistas.filter(c => c.ts && c.id !== PLATINA.id).length;

      // posições vizinhas (para o card "Sua Posição")
      let vizinhos = [];
      if(pos != null){
        const ini = Math.max(0, Number(pos) - 1), fim = Number(pos) + 1;
        const [f] = await redis([['ZREVRANGE', 'rank:xp', String(ini), String(fim), 'WITHSCORES']]);
        for(let i = 0; i < (f || []).length; i += 2) vizinhos.push({ pos: ini + i / 2 + 1, id: f[i], xp: Number(f[i + 1]) });
      }

      return res.status(200).json({
        id, nick: sessao.username, tipo: sessao.tipo || 'own', cargo: await cargoDe(id),
        moeda: MOEDA,
        nivel: nv.nivel, xp: S.xp, xpNivel: { dentro: nv.dentro, falta: nv.falta, pct: nv.pct, base: nv.base, prox: nv.prox },
        proximosNiveis: [nv.nivel + 1, nv.nivel + 5].filter(n => n <= NIVEL_MAX).map(n => ({ nivel: n, xp: xpDoNivel(n) })),
        coins: S.coins,
        ranking: { pos: pos == null ? null : Number(pos) + 1, total: Number(total), vizinhos },
        stats: {
          lives: S.lives, votos: S.votos, sugestoes: S.sugestoes, sugestoesEnv: S.sugestoesEnv,
          horas: Math.round(S.horas * 10) / 10, minutos: S.minutos, codigos: S.codigos,
          streak: S.streak, melhorStreak: S.melhorStreak
        },
        twitch: S.conta && S.conta.twitch ? { login: S.conta.twitch.login, nome: S.conta.twitch.nome, desde: S.conta.twitch.desde } : null,
        titulo: S.titulo, titulos: titulosDe(S),
        conquistas, progresso: { feitas, total: CONQUISTAS.length, platina: S.platina },
        boneco: S.boneco ? validarBoneco(S.boneco, S, ehDev).boneco : BONECO_PADRAO,
        liberados,
        comprados: [...S.inv],
        notificacoes: notifs.map(n => ({ ...n, nova: n.ts > S.notifLidoTs })),
        regras: REGRAS_PUBLICAS
      });
    }

    /* ============ CÓDIGO SECRETO ============ */
    if(action === 'resgatar' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      if(sessao.tipo !== 'own' && sessao.tipo !== 'discord') return res.status(401).json({ error: 'Faça login' });
      if(!(await rateLimit(`rl:code:${id}`, 6, 60))) return res.status(429).json({ error: 'Devagar! Tente de novo em 1 minuto.' });
      // tentativas erradas: 15 por hora → bloqueio (anti brute-force de códigos)
      const [bloq] = await redis([['GET', `codefail:${id}`]]);
      if(Number(bloq || 0) >= 15) return res.status(429).json({ error: 'Muitas tentativas inválidas. Volte mais tarde.' });

      const codigo = safeStr(req.body?.codigo, 40).toUpperCase().replace(/\s+/g, '');
      const falhar = async msg => {
        const [n] = await redis([['INCR', `codefail:${id}`]]);
        if(Number(n) === 1) await redis([['EXPIRE', `codefail:${id}`, '3600']]);
        return res.status(400).json({ error: msg });
      };
      if(!/^[A-Z0-9-]{4,32}$/.test(codigo)) return falhar('Código inválido ou expirado.');

      const [raw] = await redis([['HGET', 'codes', codigo]]);
      const c = jparse(raw);
      if(!c || !c.ativo || (c.expiraEm && Date.now() > c.expiraEm)) return falhar('Código inválido ou expirado.');

      // 1 vez por pessoa (SADD é atômico)
      const [novoUso] = await redis([['SADD', `codes:used:${codigo}`, id]]);
      if(Number(novoUso) !== 1) return res.status(409).json({ error: 'Você já resgatou este código.' });
      // limite global de usos (INCR é atômico → sem corrida)
      const [cnt] = await redis([['INCR', `codes:cnt:${codigo}`]]);
      if(c.maxUsos && Number(cnt) > c.maxUsos){
        await redis([['DECR', `codes:cnt:${codigo}`], ['SREM', `codes:used:${codigo}`, id]]);
        return res.status(410).json({ error: 'Este código já atingiu o limite de usos.' });
      }

      let premio = '';
      if(c.tipo === 'xp'){ await creditar(id, { xp: c.valor, silencioso: true }); premio = `+${c.valor} XP`; }
      else if(c.tipo === 'moedas'){ await creditar(id, { coins: c.valor, silencioso: true }); premio = `+${c.valor} ${MOEDA.nome}`; }
      else if(c.tipo === 'item'){
        const [slot, itemId] = String(c.item || '').split(':');
        const it = acharItem(slot, itemId);
        if(!it){ await redis([['DECR', `codes:cnt:${codigo}`], ['SREM', `codes:used:${codigo}`, id]]); return res.status(500).json({ error: 'Código com item inválido. Avise a Soso!' }); }
        await redis([['SADD', `inv:${id}`, `${slot}:${itemId}`]]);
        premio = `Item: ${it.nome} (${RARIDADES[it.r].nome})`;
      }
      await redis([['HINCRBY', `g:${id}`, 'codigos', '1']]);
      await notificar(id, 'codigo', `Código resgatado: ${premio}`);
      const novas = await avaliarConquistas(id);
      return res.status(200).json({ ok: true, premio, conquistas: novas });
    }

    /* ============ LOJA ============ */
    if(action === 'comprar' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      if(!(await rateLimit(`rl:buy:${id}`, 20, 60, false))) return res.status(429).json({ error: 'Devagar!' });
      const slot = safeStr(req.body?.slot, 20), itemId = safeStr(req.body?.id, 30);
      const it = acharItem(slot, itemId);
      if(!it || it.regra.t !== 'loja') return res.status(400).json({ error: 'Este item não está à venda.' });
      const preco = precoDe(it);
      const chave = `${slot}:${itemId}`;
      const [ja] = await redis([['SISMEMBER', `inv:${id}`, chave]]);
      if(Number(ja) === 1) return res.status(409).json({ error: 'Você já tem este item.' });

      // débito atômico; se ficou negativo, estorna
      const [saldo] = await redis([['HINCRBY', `g:${id}`, 'coins', String(-preco)]]);
      if(Number(saldo) < 0){
        await redis([['HINCRBY', `g:${id}`, 'coins', String(preco)]]);
        return res.status(402).json({ error: `Faltam ${-Number(saldo)} ${MOEDA.nome}.` });
      }
      await redis([['SADD', `inv:${id}`, chave]]);
      await notificar(id, 'item', `Comprou: ${it.nome} (-${preco} ${MOEDA.nome})`);
      await avaliarConquistas(id);
      return res.status(200).json({ ok: true, coins: Number(saldo) });
    }

    /* ============ TÍTULO ============ */
    if(action === 'titulo' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const tid = safeStr(req.body?.id, 30);
      const S = await lerStats(id);
      const t = titulosDe(S).find(x => x.id === tid);
      if(!t) return res.status(400).json({ error: 'Título inexistente.' });
      if(!t.liberado && !ehDev) return res.status(403).json({ error: `Bloqueado: ${t.regra}` });
      await redis([['HSET', `g:${id}`, 'titulo', tid]]);
      return res.status(200).json({ ok: true, titulo: tid });
    }

    if(action === 'notif-lidas' && req.method === 'POST'){
      await redis([['HSET', `g:${id}`, 'notifLidoTs', String(Date.now())]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch(e){
    return res.status(500).json({ error: 'Erro interno' });
  }
}
