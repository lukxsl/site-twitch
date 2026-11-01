// api/_lib/twitch.js
// ============================================================================
//  COMO O TEMPO DE TELA É VALIDADO (sem StreamElements):
//   1. O viewer vincula a Twitch via OAuth → o servidor prova que a conta é dele
//      (id numérico da Twitch gravado em `twitch_idx`).
//   2. Um cron (a cada 5 min) pergunta à Twitch: "a live está no ar?" e
//      "quem está no chat agora?" (Helix: streams + chat/chatters).
//   3. Quem está na lista E tem Twitch vinculada ganha 5 min de presença.
//   4. 20 min de presença na mesma live = a live CONTA (streak, lives, bônus).
//   Nada disso passa pelo navegador → não dá pra falsificar pelo console.
//
//  Env necessárias:
//   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET   (app na dev.twitch.tv)
//   TWITCH_BROADCASTER_ID                    (id numérico do canal da asemtet0)
//   TWITCH_BROADCASTER_REFRESH               (refresh token da Soso, scope moderator:read:chatters)
//   CRON_SECRET                              (já existe; usado como Bearer)
// ============================================================================
import { redis, jparse } from './core.js';
import { LIVE, registrarPresenca, creditar } from './game.js';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const BC_ID = process.env.TWITCH_BROADCASTER_ID;
const BC_REFRESH_ENV = process.env.TWITCH_BROADCASTER_REFRESH;

export const twitchConfigurada = () => !!(CLIENT_ID && CLIENT_SECRET);

/* ---------- OAuth de VÍNCULO (viewer) ---------- */
export function urlVinculo(redirectUri, state){
  const p = new URLSearchParams({
    client_id: CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
    scope: '',            // sem permissões: só queremos provar quem é a pessoa
    state, force_verify: 'true'
  });
  return `https://id.twitch.tv/oauth2/authorize?${p}`;
}
export async function identificarViewer(code, redirectUri){
  const t = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code,
      grant_type: 'authorization_code', redirect_uri: redirectUri
    })
  }).then(r => r.json());
  if(!t.access_token) return null;
  const u = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${t.access_token}`, 'Client-Id': CLIENT_ID }
  }).then(r => r.json());
  const me = u && u.data && u.data[0];
  if(!me) return null;
  // descartamos o token do viewer de propósito: não precisamos dele para nada
  return { id: String(me.id), login: String(me.login), nome: String(me.display_name || me.login) };
}

/* ---------- Tokens ---------- */
async function tokenApp(){
  const [c] = await redis([['GET', 'twitch:apptoken']]);
  if(c) return c;
  const t = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' })
  }).then(r => r.json());
  if(!t.access_token) throw new Error('Twitch: falha no app token');
  await redis([['SET', 'twitch:apptoken', t.access_token, 'EX', String(Math.max(60, (t.expires_in || 3600) - 300))]]);
  return t.access_token;
}
/* O refresh token da Twitch ROTACIONA a cada uso → guardamos o mais novo no Redis. */
async function tokenBroadcaster(){
  const [raw] = await redis([['GET', 'twitch:bc']]);
  let bc = jparse(raw, null);
  if(bc && bc.access && bc.exp > Date.now() + 120000) return bc.access;
  const refresh = (bc && bc.refresh) || BC_REFRESH_ENV;
  if(!refresh) throw new Error('Twitch: TWITCH_BROADCASTER_REFRESH não configurado');
  const t = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refresh })
  }).then(r => r.json());
  if(!t.access_token) throw new Error('Twitch: refresh do broadcaster falhou (gere um novo)');
  bc = { access: t.access_token, refresh: t.refresh_token || refresh, exp: Date.now() + (t.expires_in || 3600) * 1000 };
  await redis([['SET', 'twitch:bc', JSON.stringify(bc)]]);
  return bc.access;
}

/* ---------- Helix ---------- */
async function streamAtual(){
  const r = await fetch(`https://api.twitch.tv/helix/streams?user_id=${BC_ID}`, {
    headers: { Authorization: `Bearer ${await tokenApp()}`, 'Client-Id': CLIENT_ID }
  });
  if(r.status === 401) await redis([['DEL', 'twitch:apptoken']]);
  const d = await r.json();
  const s = d && d.data && d.data[0];
  return s && s.type === 'live' ? { id: String(s.id), inicio: Date.parse(s.started_at) } : null;
}
async function chattersAgora(){
  const token = await tokenBroadcaster();
  const ids = [];
  let cursor = '';
  for(let i = 0; i < 20; i++){       // até 20k chatters
    const url = `https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${BC_ID}&moderator_id=${BC_ID}&first=1000${cursor ? '&after=' + cursor : ''}`;
    const d = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': CLIENT_ID } }).then(r => r.json());
    (d.data || []).forEach(c => ids.push(String(c.user_id)));
    cursor = d.pagination && d.pagination.cursor;
    if(!cursor) break;
  }
  return ids;
}

/* ============================================================
   CRON — chamado por GET /api/game?action=cron-presenca (Bearer CRON_SECRET)
   Vercel Hobby só permite cron DIÁRIO → use cron-job.org (grátis) a cada 5 min
   mandando o header  Authorization: Bearer <CRON_SECRET>.
   ============================================================ */
export async function cronPresenca(){
  if(!twitchConfigurada() || !BC_ID) throw new Error('Twitch não configurada');
  const tick = Math.floor(Date.now() / (LIVE.TICK_MIN * 60000));
  const [lock] = await redis([['SET', `tick:${tick}`, '1', 'NX', 'EX', '3600']]);
  if(lock !== 'OK') return { pulou: 'tick já processado' };      // execução dupla não paga 2x

  const stream = await streamAtual();
  if(!stream){ await redis([['DEL', 'live:atual']]); return { online: false }; }

  /* sessão da live */
  const [rawSess] = await redis([['GET', 'live:atual']]);
  let sess = jparse(rawSess, null);
  if(!sess || sess.streamId !== stream.id) sess = { streamId: stream.id, inicio: stream.inicio, num: 0 };
  const noAr = (Date.now() - stream.inicio) / 60000;
  if(!sess.num && noAr >= LIVE.MIN_LIVE_VALIDA){
    const [n] = await redis([['INCR', 'lives:count']]);
    sess.num = Number(n);
  }
  await redis([['SET', 'live:atual', JSON.stringify(sess), 'EX', '21600']]);

  /* quem está no chat E tem Twitch vinculada */
  const chatters = await chattersAgora();
  if(!chatters.length) return { online: true, chatters: 0, creditados: 0 };
  const vinculados = [];
  for(let i = 0; i < chatters.length; i += 500){
    const fatia = chatters.slice(i, i + 500);
    const [donos] = await redis([['HMGET', 'twitch_idx', ...fatia]]);
    (donos || []).forEach(uid => { if(uid) vinculados.push(String(uid)); });
  }

  let creditados = 0, contadas = 0;
  const presKey = `pres:${sess.streamId}`;
  const processa = async uid => {
    const [tot] = await redis([['HINCRBY', presKey, uid, String(LIVE.TICK_MIN)]]);
    const minutos = Number(tot);
    if(minutos > LIVE.TETO_MIN_SESSAO) return;                   // teto por live
    await redis([['HINCRBY', `g:${uid}`, 'minutos', String(LIVE.TICK_MIN)]]);
    const coins = (minutos / LIVE.TICK_MIN) % LIVE.COINS_A_CADA_TICKS === 0 ? 1 : 0;
    await creditar(uid, { xp: LIVE.XP_POR_TICK, coins, silencioso: true });
    creditados++;
    if(sess.num && minutos >= LIVE.MIN_PRESENCA){
      if(await registrarPresenca(uid, sess.num)) contadas++;
    }
  };
  for(let i = 0; i < vinculados.length; i += 15){
    await Promise.all(vinculados.slice(i, i + 15).map(u => processa(u).catch(() => {})));
  }
  await redis([['EXPIRE', presKey, String(3 * 86400)]]);

  // conquistas por horas/streak são avaliadas em lote leve (só quem pontuou nesta rodada)
  const { avaliarConquistas } = await import('./game.js');
  for(let i = 0; i < vinculados.length; i += 10){
    await Promise.all(vinculados.slice(i, i + 10).map(u => avaliarConquistas(u).catch(() => {})));
  }
  return { online: true, live: sess.num, chatters: chatters.length, vinculados: vinculados.length, creditados, contadas };
}
