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
import { LIVE, registrarPresenca, notificar } from './game.js';

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const BC_ID = process.env.TWITCH_BROADCASTER_ID;
const BC_REFRESH_ENV = process.env.TWITCH_BROADCASTER_REFRESH;
const BC_REFRESH_LOCK = 'twitch:bc:refresh-lock';

export const twitchConfigurada = () => !!(CLIENT_ID && CLIENT_SECRET);

const INICIAR_TICK_LUA = `
local estado = redis.call('GET', KEYS[1])
if estado == 'done' or estado == 'running' then return {0, estado} end
redis.call('SET', KEYS[1], 'running', 'EX', 600)
return {1, 'running'}
`;

const PROCESSAR_TICK_LUA = `
local atual = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
if redis.call('EXISTS', KEYS[1]) == 1 then return {0, atual, 0, 0, 0, 0, 0} end
redis.call('SET', KEYS[1], '1', 'EX', tonumber(ARGV[6]) or 3600)
local minutos = redis.call('HINCRBY', KEYS[2], ARGV[1], tonumber(ARGV[2]) or 5)
if minutos > (tonumber(ARGV[3]) or 240) then return {1, minutos, 0, 0, 0, 0, 0} end
redis.call('HINCRBY', KEYS[3], 'minutos', tonumber(ARGV[2]) or 5)
local xp = tonumber(ARGV[4]) or 5
local passoCoins = tonumber(ARGV[5]) or 2
local coins = (minutos / (tonumber(ARGV[2]) or 5)) % passoCoins == 0 and 1 or 0
local oldXP = tonumber(redis.call('HGET', KEYS[3], 'xp') or '0')
local newXP = redis.call('HINCRBY', KEYS[3], 'xp', xp)
redis.call('ZADD', KEYS[4], newXP, ARGV[1])
local function nivel(value)
  local n = math.floor((1 + math.sqrt(1 + math.max(0, value) / 12.5)) / 2)
  if n < 1 then return 1 end
  if n > 100 then return 100 end
  return n
end
local antes = nivel(oldXP)
local depois = nivel(newXP)
local bonusNivel = math.max(0, depois - antes) * (tonumber(ARGV[7]) or 20)
local totalCoins = coins + bonusNivel
if totalCoins > 0 then redis.call('HINCRBY', KEYS[3], 'coins', totalCoins) end
return {1, minutos, newXP, antes, depois, totalCoins, coins}
`;

export async function diagnosticoTwitchPresenca(){
  const [raw] = await redis([['GET', 'twitch:bc']]);
  const salvo = jparse(raw, null);
  const clientCredentials = twitchConfigurada();
  const broadcasterId = !!BC_ID;
  const broadcasterRefreshToken = !!((salvo && salvo.refresh) || BC_REFRESH_ENV);
  return {
    clientCredentials,
    broadcasterId,
    broadcasterRefreshToken,
    accessTokenEmCache: !!(salvo && salvo.access && Number(salvo.exp) > Date.now()),
    scopeNecessario: 'moderator:read:chatters',
    pronta: clientCredentials && broadcasterId && broadcasterRefreshToken
  };
}

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
  const lerCache = async () => {
    const [raw] = await redis([['GET', 'twitch:bc']]);
    return jparse(raw, null);
  };
  let bc = await lerCache();
  if(bc && bc.access && bc.exp > Date.now() + 120000) return bc.access;

  // O refresh token da Twitch é rotativo e de uso único. Um lock evita que
  // duas execuções simultâneas invalidem o refresh token uma da outra.
  const [lock] = await redis([['SET', BC_REFRESH_LOCK, String(Date.now()), 'NX', 'EX', '30']]);
  if(!lock){
    for(let tentativa = 0; tentativa < 12; tentativa++){
      await new Promise(resolve => setTimeout(resolve, 250));
      bc = await lerCache();
      if(bc && bc.access && bc.exp > Date.now() + 120000) return bc.access;
    }
    throw new Error('Twitch: outra execução está renovando o token do canal. Tente novamente no próximo ciclo.');
  }

  try {
    // Releitura após adquirir lock: outra execução pode ter renovado o token.
    bc = await lerCache();
    if(bc && bc.access && bc.exp > Date.now() + 120000) return bc.access;
    const refresh = (bc && bc.refresh) || BC_REFRESH_ENV;
    if(!refresh) throw new Error('Twitch: TWITCH_BROADCASTER_REFRESH não configurado');
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refresh })
    });
    const t = await response.json().catch(() => null);
    if(!response.ok || !t?.access_token) throw new Error(`Twitch: refresh do broadcaster falhou (HTTP ${response.status}; gere um novo token se persistir).`);
    bc = { access: t.access_token, refresh: t.refresh_token || refresh, exp: Date.now() + (t.expires_in || 3600) * 1000 };
    await redis([['SET', 'twitch:bc', JSON.stringify(bc)]]);
    return bc.access;
  } finally {
    await redis([['DEL', BC_REFRESH_LOCK]]).catch(() => {});
  }
}

/* ---------- Helix ---------- */
async function streamAtual(){
  const consultar = async token => {
    const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(BC_ID)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': CLIENT_ID }
    });
    const dados = await response.json().catch(() => null);
    return { response, dados };
  };

  let { response, dados } = await consultar(await tokenApp());
  if(response.status === 401){
    await redis([['DEL', 'twitch:apptoken']]);
    ({ response, dados } = await consultar(await tokenApp()));
  }
  if(!response.ok) throw new Error(`Twitch streams HTTP ${response.status}: ${dados?.message || 'não foi possível consultar a live'}`);
  const stream = dados?.data?.[0];
  if(!stream || stream.type !== 'live') return null;
  const inicio = Date.parse(stream.started_at);
  if(!Number.isFinite(inicio)) throw new Error('Twitch retornou um horário de início inválido para a live.');
  return { id: String(stream.id), inicio };
}

async function chattersAgora(){
  const token = await tokenBroadcaster();
  const ids = [];
  let cursor = '';
  for(let pagina = 0; pagina < 20; pagina++){ // até 20k chatters
    const url = `https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${encodeURIComponent(BC_ID)}&moderator_id=${encodeURIComponent(BC_ID)}&first=1000${cursor ? '&after=' + encodeURIComponent(cursor) : ''}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': CLIENT_ID } });
    const dados = await response.json().catch(() => null);
    if(!response.ok){
      const dica = response.status === 401 || response.status === 403
        ? ' Confira se o token do canal possui o escopo moderator:read:chatters.'
        : '';
      throw new Error(`Twitch chatters HTTP ${response.status}: ${dados?.message || 'falha ao consultar participantes.'}${dica}`);
    }
    if(!Array.isArray(dados?.data)) throw new Error('Twitch não retornou a lista de participantes em formato válido.');
    dados.data.forEach(pessoa => { if(pessoa?.user_id) ids.push(String(pessoa.user_id)); });
    cursor = dados.pagination?.cursor || '';
    if(!cursor) break;
  }
  return [...new Set(ids)];
}

/* ============================================================
   CRON — chamado por GET /api/game?action=cron-presenca (Bearer CRON_SECRET)
   O agendador precisa chamar esta rota a cada 5 min e enviar
   Authorization: Bearer <CRON_SECRET>. Consulte CONFIGURACAO-VERCEL.md.
   ============================================================ */
export async function cronPresenca(){
  const diagnostico = await diagnosticoTwitchPresenca();
  if(!diagnostico.pronta){
    const faltando = [];
    if(!diagnostico.clientCredentials) faltando.push('TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET');
    if(!diagnostico.broadcasterId) faltando.push('TWITCH_BROADCASTER_ID');
    if(!diagnostico.broadcasterRefreshToken) faltando.push('TWITCH_BROADCASTER_REFRESH');
    throw new Error(`Presença Twitch não configurada. Falta: ${faltando.join(', ')}.`);
  }

  const tick = Math.floor(Date.now() / (LIVE.TICK_MIN * 60000));
  const chaveTick = `tick:${tick}`;
  const stream = await streamAtual();
  if(!stream){
    const [lockOffline] = await redis([['EVAL', INICIAR_TICK_LUA, '1', chaveTick]]);
    if(Number(lockOffline?.[0]) !== 1) return { pulou: lockOffline?.[1] === 'done' ? 'tick já processado' : 'tick em execução' };
    await redis([['DEL', 'live:atual'], ['SET', chaveTick, 'done', 'EX', '3600']]);
    return { online: false };
  }

  // Busca os participantes antes de adquirir o lock. Se a Twitch falhar ou
  // o token não tiver o escopo correto, a execução seguinte ainda pode tentar.
  const chatters = await chattersAgora();
  const [lock] = await redis([['EVAL', INICIAR_TICK_LUA, '1', chaveTick]]);
  if(Number(lock?.[0]) !== 1) return { pulou: lock?.[1] === 'done' ? 'tick já processado' : 'tick em execução' };

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
  if(!chatters.length){
    await redis([['SET', chaveTick, 'done', 'EX', '3600']]);
    return { online: true, live: sess.num, chatters: 0, creditados: 0, contadas: 0, falhas: 0 };
  }
  const vinculados = [];
  for(let i = 0; i < chatters.length; i += 500){
    const fatia = chatters.slice(i, i + 500);
    const [donos] = await redis([['HMGET', 'twitch_idx', ...fatia]]);
    (donos || []).forEach(uid => { if(uid) vinculados.push(String(uid)); });
  }

  const idsVinculados = [...new Set(vinculados)];
  const presKey = `pres:${sess.streamId}`;
  if(!idsVinculados.length){
    await redis([['EXPIRE', presKey, String(3 * 86400)], ['SET', chaveTick, 'done', 'EX', '3600']]);
    return { online: true, live: sess.num, chatters: chatters.length, vinculados: 0, creditados: 0, contadas: 0, falhas: 0 };
  }
  let creditados = 0, contadas = 0, falhas = 0;
  const processa = async uid => {
    const marker = `pres:tick:${tick}:${uid}`;
    const [resultado] = await redis([[
      'EVAL', PROCESSAR_TICK_LUA, '4', marker, presKey, `g:${uid}`, 'rank:xp',
      String(uid), String(LIVE.TICK_MIN), String(LIVE.TETO_MIN_SESSAO),
      String(LIVE.XP_POR_TICK), String(LIVE.COINS_A_CADA_TICKS), '3600', '20'
    ]]);
    const dados = Array.isArray(resultado) ? resultado.map(Number) : [];
    const minutos = Number(dados[1] || 0);
    const creditouAgora = dados[0] === 1 && dados[2] > 0;
    if(creditouAgora){
      creditados++;
      const antes = Number(dados[3] || 1);
      const depois = Number(dados[4] || antes);
      const totalCoins = Number(dados[5] || 0);
      if(depois > antes){
        await notificar(uid, 'nivel', `Subiu para o nível ${depois}! +${(depois - antes) * 20} SosoCoins`);
        const { CATALOGO, SLOTS } = await import('./game.js');
        const liberados = [];
        SLOTS.forEach(slot => CATALOGO[slot].forEach(item => {
          if(item.regra.t === 'nivel' && item.regra.n > antes && item.regra.n <= depois) liberados.push(item.nome);
        }));
        if(liberados.length) await notificar(uid, 'item', `Liberado no inventário: ${liberados.join(', ')}`);
      }
      if(totalCoins && Number(dados[6] || 0) > 0){
        // O bônus por 10 minutos é informado sem confundir com moedas de nível.
        await notificar(uid, 'presenca', `Presença na live: +${LIVE.XP_POR_TICK} XP · +${Number(dados[6])} SosoCoin(s)`);
      }
    }
    if(sess.num && minutos >= LIVE.MIN_PRESENCA){
      if(await registrarPresenca(uid, sess.num)) contadas++;
    }
  };
  for(let i = 0; i < idsVinculados.length; i += 15){
    await Promise.all(idsVinculados.slice(i, i + 15).map(async uid => {
      try { await processa(uid); }
      catch(error) { falhas++; console.error(`[Twitch cron] Falha ao creditar ${uid}:`, error?.message || error); }
    }));
  }
  await redis([['EXPIRE', presKey, String(3 * 86400)]]);

  // conquistas por horas/streak são avaliadas em lote leve (só quem pontuou nesta rodada)
  const { avaliarConquistas } = await import('./game.js');
  for(let i = 0; i < idsVinculados.length; i += 10){
    await Promise.all(idsVinculados.slice(i, i + 10).map(u => avaliarConquistas(u).catch(error => {
      console.error(`[Twitch cron] Falha ao avaliar conquistas de ${u}:`, error?.message || error);
    })));
  }
  await redis([['SET', chaveTick, falhas ? 'partial' : 'done', 'EX', '3600']]);
  return { online: true, live: sess.num, chatters: chatters.length, vinculados: idsVinculados.length, creditados, contadas, falhas };
}
