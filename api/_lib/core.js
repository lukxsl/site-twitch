// api/_lib/core.js
// Utilitários compartilhados por auth.js, game.js e admin.js.
// A pasta começa com "_" → a Vercel NÃO expõe esses arquivos como rotas.
import { createHmac, timingSafeEqual, randomBytes, scrypt as scryptCb } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);

export const ENV = {
  URL: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_IDS: (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
  ADMIN_EMAILS: (process.env.GOOGLE_DEV_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
};

export const COOKIE_NAME = 'sessao_site';
export const DIAS_SESSAO = 30;
export const SITE = process.env.SITE_URL || 'https://asemtet0.vercel.app';

/* ---------------- Redis (REST pipeline) ---------------- */
export async function redis(cmds){
  if(!ENV.URL || !ENV.TOKEN) throw new Error('Redis não configurado');
  const r = await fetch(`${ENV.URL.replace(/\/+$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ENV.TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  let data;
  try { data = await r.json(); } catch { throw new Error(`Redis: resposta inválida (HTTP ${r.status})`); }
  if(!r.ok || !Array.isArray(data)) throw new Error(data?.error || `Redis HTTP ${r.status}`);
  const falha = data.find(x => x && x.error);
  if(falha) throw new Error(`Redis: ${falha.error}`);
  return data.map(x => x.result);
}

/* HGETALL do Upstash vem como array plano → objeto */
export function paraObj(flat){
  const o = {};
  for(let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = flat[i + 1];
  return o;
}
export function jparse(s, padrao = null){
  try { return s ? JSON.parse(s) : padrao; } catch { return padrao; }
}

/* ---------------- Rate limit (INCR + EXPIRE) ----------------
   failClosed=true → se o Redis cair, BLOQUEIA (use em login/registro/códigos). */
export async function rateLimit(chave, limite, janelaSeg, failClosed = true){
  try {
    const [n] = await redis([['INCR', chave]]);
    if(Number(n) === 1) await redis([['EXPIRE', chave, String(janelaSeg)]]);
    return Number(n) <= limite;
  } catch {
    return !failClosed;
  }
}
export function ipDe(req){
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

/* ---------------- Datas ---------------- */
export function hojeBR(){
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
}

/* ---------------- Senhas (scrypt + salt, comparação em tempo constante) ---------------- */
export async function hashSenha(senha, saltHex){
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : randomBytes(16);
  const hash = await scrypt(String(senha), salt, 64);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}
export async function conferirSenha(senha, salt, hashEsperado){
  const { hash } = await hashSenha(senha, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(String(hashEsperado || ''), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------- Sessão assinada (HMAC) — mesmo formato do site antigo ---------------- */
const b64url = s => Buffer.from(s).toString('base64url');
const b64dec = s => Buffer.from(s, 'base64url').toString();
const assinar = p => createHmac('sha256', ENV.SESSION_SECRET).update(p).digest('base64url');

function assinaturaOk(p, sig){
  try {
    const a = Buffer.from(assinar(p));
    const b = Buffer.from(String(sig));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}
export function criarToken(dados){
  const payload = b64url(JSON.stringify({ ...dados, exp: Date.now() + DIAS_SESSAO * 864e5 }));
  return `${payload}.${assinar(payload)}`;
}
export function lerSessao(req){
  if(!ENV.SESSION_SECRET) return null;
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if(!m) return null;
  const [payload, sig] = m[1].split('.');
  if(!payload || !sig || !assinaturaOk(payload, sig)) return null;
  try {
    const d = JSON.parse(b64dec(payload));
    if(d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

/* Vários Set-Cookie na mesma resposta */
export function addCookie(res, valor){
  const atual = res.getHeader('Set-Cookie');
  const lista = !atual ? [] : Array.isArray(atual) ? atual : [String(atual)];
  res.setHeader('Set-Cookie', [...lista, valor]);
}
export function setSessao(res, token){
  addCookie(res, `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS_SESSAO * 86400}`);
}
export function limparSessao(res){
  addCookie(res, `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
export function pegarCookie(req, nome){
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + nome + '=([^;]+)'));
  return m ? m[1] : null;
}

/* Defesa extra contra CSRF em POST: se vier Origin, tem que ser o nosso site. */
export function origemOk(req){
  const o = req.headers.origin;
  if(!o) return true;
  try {
    const host = new URL(o).host;
    return host === req.headers.host || host === new URL(SITE).host;
  } catch { return false; }
}

/* ---------------- Sanitização ---------------- */
export function safeStr(v, max = 60){
  return String(v == null ? '' : v).trim().slice(0, max);
}
export const RE_USUARIO = /^[a-z0-9_]{3,20}$/;
export function nickValido(n){
  return /^[\p{L}\p{N}_. -]{3,24}$/u.test(n) && !/[<>]/.test(n);
}

/* ---------------- Cargo (dev vem do ENV; demais da hash "admins") ---------------- */
export async function cargoDe(userId, email = ''){
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if(ENV.ADMIN_IDS.includes(String(userId)) || (emailNormalizado && ENV.ADMIN_EMAILS.includes(emailNormalizado))) return 'dev';
  try {
    const [raw] = await redis([['HGET', 'admins', String(userId)]]);
    const d = jparse(raw);
    return d && ['dev', 'dono', 'administrador', 'moderador'].includes(d.cargo) ? d.cargo : null;
  } catch { return null; }
}
