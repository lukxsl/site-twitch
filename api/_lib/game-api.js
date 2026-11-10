// api/_lib/game-api.js — rotas da economia (SosoCoins/XP) expostas por /api/game.
// Leitura do saldo/nível do jogador + ranking. Nenhuma rota altera XP ou moedas:
// esses valores só mudam via _lib/game.js (creditar/evento/registrarPresenca).
//
//   GET  /api/game?action=ranking           (público)  Top 50 por XP
//   GET  /api/game?action=perfil            (logado)   XP, nível, saldo e posição
//   GET  /api/game?action=cron-presenca     (Bearer CRON_SECRET)  tempo de tela / streak
import { timingSafeEqual } from 'crypto';
import { ENV, redis, jparse, validarSessao, cargoDe } from './core.js';
import { MOEDA, NIVEL_MAX, infoNivel, xpDoNivel, lerStats } from './game.js';
import { cronPresenca } from './twitch.js';

export default async function handler(req, res){
  const action = (req.query && req.query.action) || '';

  try {
    /* ============ CRON (sem sessão; Bearer) ============ */
    if(action === 'cron-presenca'){
      const segredo = process.env.CRON_SECRET;
      if(!segredo) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
      const a = Buffer.from(req.headers.authorization || ''), b = Buffer.from(`Bearer ${segredo}`);
      if(a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Não autorizado' });
      try {
        const result = await cronPresenca();
        await redis([['SET', 'twitch:presence:last-run', JSON.stringify({status:'ok',at:Date.now(),result}), 'EX', '2592000']]);
        return res.status(200).json(result);
      } catch(error) {
        await redis([['SET', 'twitch:presence:last-run', JSON.stringify({status:'error',at:Date.now(),message:String(error?.message||'Falha no cron de presença').slice(0,300)}), 'EX', '2592000']]).catch(()=>{});
        console.error('[Cron presença]', error?.message || error);
        return res.status(500).json({error:String(error?.message || 'Falha no cron de presença')});
      }
    }

    /* ============ RANKING POR XP (público) ============ */
    if(action === 'ranking'){
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
      const limite = Math.min(100, Math.max(3, Number(req.query.limite) || 50));
      const [flat, total] = await redis([['ZREVRANGE', 'rank:xp', '0', String(limite - 1), 'WITHSCORES'], ['ZCARD', 'rank:xp']]);
      const ids = [], xps = [];
      for(let i = 0; i < (flat || []).length; i += 2){ ids.push(flat[i]); xps.push(Number(flat[i + 1])); }
      if(!ids.length) return res.status(200).json({ total: 0, lista: [] });

      const [contas, perfis] = await redis([
        ['HMGET', 'accounts', ...ids],
        ['HMGET', 'user_profiles', ...ids]
      ]);
      const lista = ids.map((id, i) => {
        const conta = jparse(contas[i]), perfil = jparse(perfis[i]);
        const nome = (conta && conta.nick) || (perfil && perfil.username) || 'Anônimo';
        return {
          pos: i + 1, id, nome,
          xp: xps[i], nivel: infoNivel(xps[i]).nivel,
          avatar: (conta && (conta.google?.picture || conta.google?.avatar || conta.avatar || conta.picture || conta.foto)) || (perfil && (perfil.avatar || perfil.picture || perfil.foto)) || null
        };
      });
      return res.status(200).json({ total: Number(total), lista });
    }

    /* As rotas públicas acima não dependem de assinatura de sessão.
       Só as rotas privadas exigem SESSION_SECRET. */
    if(!ENV.SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });

    /* ============ daqui pra baixo: precisa de login ============ */
    const sessao = await validarSessao(req);
    if(!sessao) return res.status(401).json({ error: 'Faça login' });
    res.setHeader('Cache-Control', 'no-store');
    const id = String(sessao.id);

    /* ============ PERFIL (economia) ============ */
    if(action === 'perfil'){
      const S = await lerStats(id);
      const [pos, total] = await redis([['ZREVRANK', 'rank:xp', id], ['ZCARD', 'rank:xp']]);
      const nv = infoNivel(S.xp);

      return res.status(200).json({
        id, nick: sessao.username, tipo: sessao.tipo || 'own', cargo: await cargoDe(id, sessao.email),
        moeda: MOEDA,
        nivel: nv.nivel, xp: S.xp, coins: S.coins,
        xpNivel: { dentro: nv.dentro, falta: nv.falta, pct: nv.pct, base: nv.base, prox: nv.prox },
        proximosNiveis: [nv.nivel + 1, nv.nivel + 5].filter(n => n <= NIVEL_MAX).map(n => ({ nivel: n, xp: xpDoNivel(n) })),
        ranking: { pos: pos == null ? null : Number(pos) + 1, total: Number(total) }
      });
    }

    return res.status(404).json({ error: 'Ação desconhecida.' });
  } catch(e){
    console.error(`[game-api] Falha na ação "${action || 'nenhuma'}":`, e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
