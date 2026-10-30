// Perfil do membro + vínculo Twitch (a sessão do site continua sendo identificada pelo Discord).
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sessao_site';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI;
const TWITCH_BROADCASTER_ID = process.env.TWITCH_BROADCASTER_ID || '';
const TWITCH_BROADCASTER_LOGIN = process.env.TWITCH_BROADCASTER_LOGIN || 'asemtet0';

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Redis não configurado');
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

function b64urlDecode(value) { return Buffer.from(value, 'base64url').toString('utf8'); }
function assinar(payload) {
  if (!SESSION_SECRET) return '';
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
}
function assinaturaValida(payload, assinatura) {
  const esperado = assinar(payload);
  try {
    const a = Buffer.from(esperado), b = Buffer.from(String(assinatura || ''));
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch { return false; }
}
function lerSessao(req) {
  if (!SESSION_SECRET) return null;
  const cookie = req.headers.cookie || '';
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const [payload, signature] = match[1].split('.');
  if (!payload || !signature || !assinaturaValida(payload, signature)) return null;
  try {
    const dados = JSON.parse(b64urlDecode(payload));
    if (!dados.id || (dados.exp && Date.now() > dados.exp)) return null;
    return dados;
  } catch { return null; }
}
function safeText(value, max = 80) {
  return String(value == null ? '' : value).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}
function safeHttpsUrl(value, max = 600) {
  const text = String(value == null ? '' : value).trim().slice(0, max);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch { return null; }
}
function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  return res.end();
}
function twitchHeaders(token) {
  return { 'Client-ID': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` };
}
async function twitchGet(path, token) {
  const response = await fetch(`https://api.twitch.tv/helix/${path}`, { headers: twitchHeaders(token) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Twitch HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function carregarPerfil(userId) {
  const [raw] = await redis([['HGET', 'user_profiles', String(userId)]]);
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}
async function salvarPerfil(userId, perfil) {
  await redis([['HSET', 'user_profiles', String(userId), JSON.stringify({ ...perfil, updatedAt: Date.now() })]]);
}
async function atualizarRankingMeta(perfil) {
  if (!perfil.twitch_id) return;
  const meta = {
    id: String(perfil.twitch_id),
    login: perfil.twitch_login || '',
    display_name: perfil.nome || perfil.twitch_name || perfil.twitch_login || 'Membro',
    avatar_url: perfil.avatarPerfil || perfil.twitch_avatar || null,
    is_sub: !!perfil.is_sub
  };
  await redis([['HSET', 'ranking:users', String(perfil.twitch_id), JSON.stringify(meta)]]);
}

async function iniciarTwitch(req, res, sessao) {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_REDIRECT_URI) {
    return res.status(503).json({ error: 'Configure TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET e TWITCH_REDIRECT_URI.' });
  }
  const state = randomBytes(24).toString('hex');
  await redis([['SETEX', `twitch_oauth_state:${state}`, '600', JSON.stringify({ userId: String(sessao.id), createdAt: Date.now() })]]);
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: 'code',
    scope: 'user:read:subscriptions',
    state
  });
  return redirect(res, `https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
}

async function callbackTwitch(req, res, sessao) {
  const code = String((req.query || {}).code || '');
  const state = String((req.query || {}).state || '');
  if ((req.query || {}).error) return redirect(res, '/?twitch=cancelado#perfil');
  if (!code || !state) return res.status(400).json({ error: 'Callback Twitch incompleto.' });
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET || !TWITCH_REDIRECT_URI) {
    return res.status(503).json({ error: 'OAuth da Twitch não configurado.' });
  }

  const stateKey = `twitch_oauth_state:${state}`;
  const [stateRaw] = await redis([['GET', stateKey]]);
  await redis([['DEL', stateKey]]);
  let stateData = null;
  try { stateData = stateRaw ? JSON.parse(stateRaw) : null; } catch { stateData = null; }
  if (!stateData || String(stateData.userId) !== String(sessao.id) || Date.now() - Number(stateData.createdAt || 0) > 10 * 60 * 1000) {
    return res.status(400).json({ error: 'State OAuth inválido ou expirado. Tente vincular novamente.' });
  }

  const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITCH_REDIRECT_URI
    })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    return res.status(502).json({ error: 'A Twitch não autorizou o vínculo. Tente novamente.' });
  }

  const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const validation = await validateResponse.json().catch(() => ({}));
  const scopes = Array.isArray(validation.scopes) ? validation.scopes : [];
  if (!validateResponse.ok || !validation.user_id || !scopes.includes('user:read:subscriptions')) {
    return res.status(400).json({ error: 'A conta Twitch não autorizou o escopo necessário para validar a inscrição.' });
  }

  const twitchUserId = String(validation.user_id);
  const me = await twitchGet(`users?id=${encodeURIComponent(twitchUserId)}`, tokenData.access_token);
  const twitchUser = (me.data || [])[0];
  if (!twitchUser) return res.status(502).json({ error: 'Não consegui carregar seu perfil Twitch.' });

  let broadcasterId = TWITCH_BROADCASTER_ID;
  if (!broadcasterId) {
    const channel = await twitchGet(`users?login=${encodeURIComponent(TWITCH_BROADCASTER_LOGIN)}`, tokenData.access_token);
    broadcasterId = String(channel.data?.[0]?.id || '');
  }
  if (!broadcasterId) return res.status(503).json({ error: 'Configure TWITCH_BROADCASTER_ID ou TWITCH_BROADCASTER_LOGIN.' });

  // Valida a inscrição da própria conta autenticada no canal asemtet0.
  const subscription = await twitchGet(
    `subscriptions/user?broadcaster_id=${encodeURIComponent(broadcasterId)}&user_id=${encodeURIComponent(twitchUserId)}`,
    tokenData.access_token
  );
  const isSub = Array.isArray(subscription.data) && subscription.data.length > 0;

  const perfil = await carregarPerfil(sessao.id);
  perfil.twitch_id = twitchUserId;
  perfil.twitch_login = safeText(twitchUser.login, 30).toLowerCase();
  perfil.twitch_name = safeText(twitchUser.display_name || twitchUser.login, 60);
  perfil.twitch_avatar = safeHttpsUrl(twitchUser.profile_image_url);
  perfil.is_sub = isSub;
  perfil.twitch_linked_at = Date.now();
  await salvarPerfil(sessao.id, perfil);
  await atualizarRankingMeta(perfil);

  return redirect(res, `/?twitch=vinculada#perfil`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = String((req.query || {}).action || '');
  const sessao = lerSessao(req);
  if (!sessao) return res.status(401).json({ error: 'Entre no site para acessar seu perfil.' });

  try {
    if (action === 'twitch-start' && req.method === 'GET') return await iniciarTwitch(req, res, sessao);
    if (action === 'twitch-callback' && req.method === 'GET') return await callbackTwitch(req, res, sessao);

    if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: 'Banco Redis não configurado.' });
    if (req.method === 'GET') {
      const perfil = await carregarPerfil(sessao.id);
      return res.status(200).json({
        perfil: {
          nome: perfil.nome || perfil.username || sessao.username || '',
          avatar: perfil.avatarPerfil || perfil.twitch_avatar || perfil.avatar || sessao.avatar || '',
          banner: perfil.banner || '',
          twitch: perfil.twitch_id ? {
            id: perfil.twitch_id,
            login: perfil.twitch_login || '',
            nome: perfil.twitch_name || perfil.twitch_login || '',
            avatar: perfil.twitch_avatar || '',
            vinculadaEm: perfil.twitch_linked_at || null
          } : null,
          is_sub: !!perfil.is_sub
        }
      });
    }
    if (req.method === 'PUT') {
      const body = req.body || {};
      const perfil = await carregarPerfil(sessao.id);
      if (Object.prototype.hasOwnProperty.call(body, 'nome')) perfil.nome = safeText(body.nome, 40);
      if (Object.prototype.hasOwnProperty.call(body, 'avatar')) perfil.avatarPerfil = safeHttpsUrl(body.avatar, 600);
      if (Object.prototype.hasOwnProperty.call(body, 'banner')) perfil.banner = safeHttpsUrl(body.banner, 800);
      await salvarPerfil(sessao.id, perfil);
      await atualizarRankingMeta(perfil);
      return res.status(200).json({ ok: true, perfil: { nome: perfil.nome || '', avatar: perfil.avatarPerfil || perfil.twitch_avatar || '', banner: perfil.banner || '', is_sub: !!perfil.is_sub } });
    }
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('[perfil]', error);
    return res.status(error.status || 500).json({ error: error.message || 'Não foi possível processar seu perfil.' });
  }
}
