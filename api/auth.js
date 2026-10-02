// Vercel serverless: /api/auth.js
import { createHmac, randomBytes } from 'crypto';

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-isso-urgente';
const ADMIN_IDS = (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const REDIRECT_URI = 'https://asemtet0.vercel.app/api/auth';
const COOKIE_NAME = 'sessao_site';
const DIAS_SESSAO = 30;

function b64url(str) { return Buffer.from(str).toString('base64url'); }
function b64urlDecode(str) { return Buffer.from(str, 'base64url').toString(); }
function assinar(payloadB64) { return createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url'); }
function criarToken(dados) {
  const payload = b64url(JSON.stringify({ ...dados, exp: Date.now() + DIAS_SESSAO * 864e5 }));
  return `${payload}.${assinar(payload)}`;
}
function lerToken(cookie) {
  if (!cookie) return null;
  const [payload, sig] = String(cookie).split('.');
  if (!payload || !sig) return null;
  if (assinar(payload) !== sig) return null;
  try {
    const dados = JSON.parse(b64urlDecode(payload));
    if (dados.exp && Date.now() > dados.exp) return null;
    return dados;
  } catch { return null; }
}
function setCookie(res, valor, maxAge) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}
function limparCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
function pegarCookie(req) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  return m ? m[1] : null;
}

async function redis(cmds){
  if(!URL_ || !TOKEN) return [];
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

// Lê o cargo do usuário no Redis. Se não existir e estiver na env var, cria como DEV.
async function pegarCargo(userId, username, avatar){
  try {
    const [raw] = await redis([['HGET', 'admins', userId]]);
    if (raw) {
      const d = JSON.parse(raw);
      // Atualiza nickname/avatar caso tenha mudado
      if (d.username !== username || d.avatar !== avatar) {
        await redis([['HSET', 'admins', userId, JSON.stringify({ ...d, username, avatar })]]);
      }
      return d.cargo || null;
    }
    if (ADMIN_IDS.includes(userId)) {
      // Primeira vez: vira DEV automaticamente
      await redis([['HSET', 'admins', userId, JSON.stringify({
        cargo: 'dev', username, avatar
      })]]);
      return 'dev';
    }
  } catch(e){}
  return null;
}

export default async function handler(req, res) {
  if (!CLIENT_ID || !CLIENT_SECRET) return res.status(500).json({ error: 'Discord OAuth não configurado' });

  const { action } = req.query || {};

  // ============ LOGIN ============
  if (action === 'login') {
    const state = randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const params = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: REDIRECT_URI,
      response_type: 'code', scope: 'identify', state
    });
    res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params}` });
    return res.end();
  }

  // ============ CALLBACK ============
  if (action === 'callback' || (req.query && req.query.code)) {
    const code = req.query.code;
    const state = req.query.state;
    const stateCookie = (req.headers.cookie || '').match(/oauth_state=([^;]+)/);
    if (!code) return res.status(400).json({ error: 'Faltou code' });
    if (!stateCookie || stateCookie[1] !== state) return res.status(400).json({ error: 'State inválido' });

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
        })
      });
      const tok = await tokenRes.json();
      if (!tok.access_token) return res.status(400).json({ error: 'Falha ao obter token' });

      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tok.access_token}` }
      });
      const me = await meRes.json();
      if (!me.id) return res.status(400).json({ error: 'Falha ao obter usuário' });

      const avatar = me.avatar
        ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(me.discriminator || 0) % 5}.png`;
      const username = me.global_name || me.username;

      // Pega cargo (e cria como dev se estiver na env var)
      const cargo = await pegarCargo(me.id, username, avatar);

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
    } catch (e) {
      return res.status(500).json({ error: 'Erro no callback: ' + e.message });
    }
  }

  // ============ ME ============
  if (action === 'me') {
    const dados = lerToken(pegarCookie(req));
    if (!dados) return res.status(200).json({ logado: false });

    // Recarrega cargo do Redis (pode ter mudado)
    let cargo = null;
    try {
      const [raw] = await redis([['HGET', 'admins', dados.id]]);
      if (raw) { const d = JSON.parse(raw); cargo = d.cargo; }
    } catch(e){}

    return res.status(200).json({
      logado: true,
      id: dados.id,
      username: dados.username,
      avatar: dados.avatar,
      admin: !!cargo,
      cargo: cargo
    });
  }

  // ============ LOGOUT ============
  if (action === 'logout') {
    limparCookie(res);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida' });
}