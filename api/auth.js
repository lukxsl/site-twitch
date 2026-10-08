// Vercel serverless: /api/auth.js
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_IDS = (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_R = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const REDIRECT_URI = 'https://asemtet0.vercel.app/api/auth';
const COOKIE_NAME = 'sessao_site';
const DIAS_SESSAO = 30;

/* ---------- Redis helpers ---------- */
async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_R}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

/* Rate-limit via Redis (INCR + EXPIRE). Retorna true se pode passar. */
async function rateLimitOk(chave, limite, janelaSeg){
  try {
    const [n] = await redis([['INCR', chave]]);
    if(Number(n) === 1) await redis([['EXPIRE', chave, String(janelaSeg)]]);
    return Number(n) <= limite;
  } catch(e){ return true; } // em caso de erro no Redis, deixa passar (não trava login)
}

/* ---------- Helpers ---------- */
function b64url(str){ return Buffer.from(str).toString('base64url'); }
function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(payloadB64){ return createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url'); }

function assinarValido(payloadB64, sig){
  const esperado = assinar(payloadB64);
  try {
    const a = Buffer.from(esperado);
    const b = Buffer.from(String(sig));
    if(a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}

function criarToken(dados){
  const payload = b64url(JSON.stringify({ ...dados, exp: Date.now() + DIAS_SESSAO * 864e5 }));
  return `${payload}.${assinar(payload)}`;
}
function lerToken(cookie){
  if(!cookie) return null;
  const [payload, sig] = String(cookie).split('.');
  if(!payload || !sig) return null;
  if(!assinarValido(payload, sig)) return null;
  try {
    const dados = JSON.parse(b64urlDecode(payload));
    if(dados.exp && Date.now() > dados.exp) return null;
    return dados;
  } catch { return null; }
}
function setCookie(res, valor, maxAge){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}
function limparCookie(res){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
function pegarCookie(req){
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  return m ? m[1] : null;
}

function safeStr(v, max = 60){
  return String(v == null ? '' : v).trim().slice(0, max);
}
function safeAvatar(url){
  const s = safeStr(url, 300);
  if(!/^https:\/\/cdn\.discordapp\.com\//.test(s)) return null;
  return s;
}

async function buscarCargoSalvo(userId){
  if(!URL_ || !TOKEN_R) return null;
  try {
    const [raw] = await redis([['HGET', 'admins', String(userId)]]);
    if(!raw) return null;
    const dados = JSON.parse(raw);
    const cargo = dados.cargo;
    if(!['dev','dono','administrador','moderador'].includes(cargo)) return null;
    return cargo;
  } catch(e){ return null; }
}

async function salvarPerfil(userId, username, avatar){
  if(!URL_ || !TOKEN_R) return;
  try {
    const payload = JSON.stringify({ username, avatar, ts: Date.now() });
    await redis([['HSET', 'user_profiles', String(userId), payload]]);
  } catch(e){}
}

export default async function handler(req, res){
  if(!SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  if(!CLIENT_ID || !CLIENT_SECRET) return res.status(500).json({ error: 'Discord OAuth não configurado' });

  const { action } = req.query || {};

  // ============ Login ============
  if(action === 'login'){
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if(!(await rateLimitOk(`ratelimit:auth:login:${ip}`, 5, 60))) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    }
    const state = randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
      state
    });
    res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params}` });
    return res.end();
  }

  // ============ Callback do Discord ============
  if(action === 'callback' || (req.query && req.query.code)){
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if(!(await rateLimitOk(`ratelimit:auth:cb:${ip}`, 10, 60))) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    }
    const code = req.query.code;
    const state = req.query.state;
    const stateCookie = (req.headers.cookie || '').match(/oauth_state=([^;]+)/);
    if(!code) return res.status(400).json({ error: 'Faltou code' });
    if(!stateCookie || stateCookie[1] !== state) return res.status(400).json({ error: 'State inválido (CSRF?)' });
    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI
        })
      });
      const tok = await tokenRes.json();
      if(!tok.access_token) return res.status(400).json({ error: 'Falha ao obter token' });

      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tok.access_token}` }
      });
      const me = await meRes.json();
      if(!me.id) return res.status(400).json({ error: 'Falha ao obter usuário' });

      const rawAvatar = me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(me.discriminator || 0) % 5}.png`;
      const avatar = safeAvatar(rawAvatar);
      const username = safeStr(me.global_name || me.username, 60).replace(/[<>]/g, '') || 'Anônimo';

      await salvarPerfil(me.id, username, avatar);

      let cargo = null;
      if(ADMIN_IDS.includes(me.id)) cargo = 'dev';
      else cargo = await buscarCargoSalvo(me.id);

      const token = criarToken({
        id: me.id,
        username,
        avatar,
        admin: !!cargo,
        cargo: cargo || null
      });
      setCookie(res, token, DIAS_SESSAO * 86400);
      res.writeHead(302, { Location: '/?login=ok' });
      return res.end();
    } catch(e){
      return res.status(500).json({ error: 'Erro no callback' });
    }
  }

  // ============ Me ============
  if(action === 'me'){
    const dados = lerToken(pegarCookie(req));
    if(!dados) return res.status(200).json({ logado: false });
    return res.status(200).json({
      logado: true,
      id: dados.id,
      username: dados.username,
      avatar: dados.avatar,
      admin: !!dados.admin,
      cargo: dados.cargo || null
    });
  }

  // ============ Logout ============
  if(action === 'logout'){
    limparCookie(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida. Use ?action=login|me|logout' });
}