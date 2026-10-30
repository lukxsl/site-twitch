// Ranking público + coleta de presença no chat pela Vercel Cron (a cada 5 minutos).
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_BROADCASTER_TOKEN = process.env.TWITCH_BROADCASTER_TOKEN;
const TWITCH_BROADCASTER_REFRESH_TOKEN = process.env.TWITCH_BROADCASTER_REFRESH_TOKEN || '';
const MOD_TOKEN_KEY = 'twitch:moderator:access_token';
const MOD_REFRESH_KEY = 'twitch:moderator:refresh_token';
const TWITCH_BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID || '';
const TWITCH_BROADCASTER_LOGIN = process.env.TWITCH_BROADCASTER_LOGIN || 'asemtet0';
const CRON_SECRET = process.env.CRON_SECRET || '';
const POINTS_PER_TICK = 10 / 12; // 10 pontos/hora, em um ciclo de 5 minutos.

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Redis não configurado');
  if (!commands.length) return [];
  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error('Resposta inválida do Redis');
  const failed = payload.find(item => item && item.error);
  if (failed) throw new Error(failed.error);
  return payload.map(item => item.result);
}
function safeInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function safeText(value, max = 80) {
  return String(value == null ? '' : value).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}
function cronAutorizado(req) {
  if (!CRON_SECRET) return false;
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-cron-secret'] || '');
  return token.length === CRON_SECRET.length && token === CRON_SECRET;
}
function twitchHeaders(token) {
  return { 'Client-ID': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` };
}
async function twitchJson(url, token) {
  const response = await fetch(url, { headers: twitchHeaders(token) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Twitch HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function resolverBroadcasterId(token) {
  if (TWITCH_BROADCASTER_ID) return String(TWITCH_BROADCASTER_ID);
  const d = await twitchJson(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(TWITCH_BROADCASTER_LOGIN)}`, token);
  const id = d.data?.[0]?.id;
  if (!id) throw new Error(`Não encontrei o canal Twitch ${TWITCH_BROADCASTER_LOGIN}.`);
  return String(id);
}

async function validarTokenModerador(token) {
  const response = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  const scopes = Array.isArray(data.scopes) ? data.scopes : [];
  if (!response.ok || !data.user_id || !scopes.includes('moderator:read:chatters')) return null;
  return { userId: String(data.user_id), scopes };
}

async function obterTokenModerador() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) throw new Error('TWITCH_CLIENT_ID/SECRET não configurados.');
  const [savedAccess, savedRefresh] = await redis([['GET', MOD_TOKEN_KEY], ['GET', MOD_REFRESH_KEY]]);
  let accessToken = String(savedAccess || TWITCH_BROADCASTER_TOKEN || '');
  let refreshToken = String(savedRefresh || TWITCH_BROADCASTER_REFRESH_TOKEN || '');
  if (!accessToken) throw new Error('TWITCH_BROADCASTER_TOKEN não configurado.');
  const valid = await validarTokenModerador(accessToken);
  if (valid) return { token: accessToken, moderatorId: valid.userId };
  if (!refreshToken) throw new Error('Token Twitch expirado/inválido. Configure TWITCH_BROADCASTER_REFRESH_TOKEN para renovação automática.');

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || !refreshed.access_token || !refreshed.refresh_token) {
    throw new Error('Não foi possível renovar o token de moderador Twitch. Gere novamente os tokens e atualize as variáveis.');
  }
  const refreshedValid = await validarTokenModerador(refreshed.access_token);
  if (!refreshedValid) throw new Error('O token renovado não tem o escopo moderator:read:chatters.');
  await redis([
    ['SET', MOD_TOKEN_KEY, refreshed.access_token],
    ['SET', MOD_REFRESH_KEY, refreshed.refresh_token]
  ]);
  return { token: refreshed.access_token, moderatorId: refreshedValid.userId };
}

async function coletarPresenca() {
  if (!TWITCH_BROADCASTER_TOKEN) throw new Error('TWITCH_BROADCASTER_TOKEN não configurado.');
  const moderator = await obterTokenModerador();
  const moderatorToken = moderator.token;
  const moderatorId = moderator.moderatorId;
  const broadcasterId = await resolverBroadcasterId(moderatorToken);

  // Evita conceder pontos quando o canal está offline.
  const stream = await twitchJson(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(broadcasterId)}`, moderatorToken);
  if (!Array.isArray(stream.data) || !stream.data.length) return { online: false, count: 0, awarded: 0 };

  const chatters = [];
  let cursor = '';
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({ broadcaster_id: broadcasterId, moderator_id: moderatorId, first: '1000' });
    if (cursor) params.set('after', cursor);
    const result = await twitchJson(`https://api.twitch.tv/helix/chat/chatters?${params.toString()}`, moderatorToken);
    chatters.push(...(result.data || []));
    cursor = result.pagination?.cursor || '';
    if (!cursor || !result.data?.length) break;
  }

  const unique = [...new Map(chatters.filter(c => c.user_id).map(c => [String(c.user_id), c])).values()];
  if (!unique.length) return { online: true, count: 0, awarded: 0 };

  const currentMeta = await redis(unique.map(user => ['HGET', 'ranking:users', String(user.user_id)]));
  const updates = [];
  unique.forEach((user, index) => {
    let previous = {};
    try { previous = currentMeta[index] ? JSON.parse(currentMeta[index]) : {}; } catch { previous = {}; }
    const isSub = previous.is_sub === true || previous.is_sub === 'true';
    const increment = POINTS_PER_TICK * (isSub ? 1.5 : 1);
    const meta = {
      ...previous,
      id: String(user.user_id),
      login: safeText(user.user_login || previous.login || '', 30).toLowerCase(),
      display_name: safeText(previous.display_name || user.user_name || user.user_login || 'Membro', 60),
      avatar_url: previous.avatar_url || null,
      is_sub: isSub,
      last_seen_at: Date.now()
    };
    updates.push(['ZINCRBY', 'ranking:points', String(increment.toFixed(6)), String(user.user_id)]);
    updates.push(['HSET', 'ranking:users', String(user.user_id), JSON.stringify(meta)]);
  });
  await redis(updates);
  return { online: true, count: unique.length, awarded: unique.length, basePoints: POINTS_PER_TICK };
}

async function obterRanking(limit) {
  const [flat] = await redis([['ZREVRANGE', 'ranking:points', '0', String(limit - 1), 'WITHSCORES']]);
  const rows = Array.isArray(flat) ? flat : [];
  const users = [];
  for (let i = 0; i < rows.length; i += 2) {
    users.push({ id: String(rows[i]), points: Number(rows[i + 1]) || 0 });
  }
  if (!users.length) return [];
  const metas = await redis(users.map(user => ['HGET', 'ranking:users', user.id]));
  return users.map((user, index) => {
    let meta = {};
    try { meta = metas[index] ? JSON.parse(metas[index]) : {}; } catch { meta = {}; }
    return {
      id: user.id,
      nome: safeText(meta.display_name || meta.login || 'Membro', 60),
      login: safeText(meta.login || '', 30),
      avatar: meta.avatar_url || null,
      is_sub: meta.is_sub === true || meta.is_sub === 'true',
      pontos: Math.round(user.points * 100) / 100
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: 'Banco Redis não configurado.' });
  const action = String((req.query || {}).action || '');
  try {
    if (action === 'tick') {
      if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
      if (!cronAutorizado(req)) return res.status(401).json({ error: 'CRON_SECRET inválido.' });
      // Evita duplicar pontos em chamadas repetidas/retries dentro do mesmo ciclo de 5 minutos.
      const bucket = Math.floor(Date.now() / 300000);
      const [claimed] = await redis([['SET', `ranking:tick:${bucket}`, '1', 'EX', '600', 'NX']]);
      if (claimed !== 'OK') return res.status(200).json({ ok: true, skipped: true, reason: 'Ciclo já processado.' });
      try {
        const result = await coletarPresenca();
        return res.status(200).json({ ok: true, ...result });
      } catch (error) {
        await redis([['DEL', `ranking:tick:${bucket}`]]).catch(() => {});
        throw error;
      }
    }
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
    const limit = safeInt((req.query || {}).limit, 50, 1, 100);
    const ranking = await obterRanking(limit);
    return res.status(200).json({ ranking, total: ranking.length, atualizadoEm: new Date().toISOString() });
  } catch (error) {
    console.error('[ranking]', error);
    return res.status(error.status || 500).json({ error: error.message || 'Não foi possível carregar o ranking.' });
  }
}
