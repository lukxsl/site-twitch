// Vercel serverless: /api/sugestoes.js
// GET  → lista sugestões (com status)
// POST → envia sugestão (salva no Redis + log + Discord webhook)
import { createHash, randomUUID, createHmac } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sessao_site';
const LIST_KEY = 'sugestoes:lista';
const MAX_ITENS = 200;
const MAX_TEXTO = 300;

const recentes = new Map();
const RATE_MS = 30000;
const dupCache = new Map();
const DUP_MS = 120000;

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

function safeStr(v, max = 1000){
  return String(v == null ? '' : v).trim().slice(0, max);
}

function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(p){ return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function lerSessao(req){
  if(!SESSION_SECRET) return null;
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if(!m) return null;
  const [payload, sig] = m[1].split('.');
  if(!payload || !sig || assinar(payload) !== sig) return null;
  try {
    const d = JSON.parse(b64urlDecode(payload));
    if(d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

function limparMapas(){
  const now = Date.now();
  if (recentes.size > 500) {
    for (const [k, t] of recentes) if (now - t > 300000) recentes.delete(k);
  }
  if (dupCache.size > 500) {
    for (const [k, t] of dupCache) if (now - t > 600000) dupCache.delete(k);
  }
}

export default async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');

  /* ---------- GET: lista ---------- */
  if (req.method === 'GET') {
    if (!URL_ || !TOKEN) return res.status(200).json({ itens: [] });
    try {
      const [flat] = await redis([['LRANGE', LIST_KEY, '0', String(MAX_ITENS - 1)]]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
      return res.status(200).json({ itens });
    } catch (e) {
      return res.status(200).json({ itens: [] });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return res.status(500).json({ error: 'Webhook não configurado' });

  const { nome, texto, site, tipo } = req.body || {};

  if (site) return res.status(200).json({ ok: true });

  const categoria = safeStr(tipo, 40) || 'Sugestão / ideia';
  const msg = safeStr(texto, MAX_TEXTO);
  const autor = safeStr(nome, 40) || 'Anônimo';

  if (!msg) return res.status(400).json({ error: 'Escreva uma sugestão' });
  if (msg.length > MAX_TEXTO) return res.status(400).json({ error: `Mensagem muito longa (máx ${MAX_TEXTO})` });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const agora = Date.now();
  limparMapas();

  if (agora - (recentes.get(ip) || 0) < RATE_MS) {
    return res.status(429).json({ error: 'Aguarde um pouco antes de enviar de novo' });
  }
  recentes.set(ip, agora);

  const hash = createHash('sha256').update(ip + '|' + msg.toLowerCase()).digest('hex');
  if (agora - (dupCache.get(hash) || 0) < DUP_MS) {
    return res.status(429).json({ error: 'Você já enviou essa mensagem. Aguarde.' });
  }
  dupCache.set(hash, agora);

  const sessao = lerSessao(req);
  const userId = sessao?.id || null;
  const usernameLogado = sessao?.username || null;

  const item = {
    id: randomUUID(),
    nome: autor,
    userId,
    username: usernameLogado,
    tipo: categoria,
    texto: msg,
    data: new Date().toISOString(),
    status: 'nova',
    motivo: null,
    atualizadoEm: null
  };

  try {
    if (URL_ && TOKEN) {
      await redis([
        ['LPUSH', LIST_KEY, JSON.stringify(item)],
        ['LTRIM', LIST_KEY, '0', String(MAX_ITENS - 1)]
      ]);
    }
  } catch (e) { /* silencioso */ }

  try {
    if (URL_ && TOKEN) {
      const logItem = JSON.stringify({
        quem: autor,
        cargo: null,
        acao: `Nova sugestão (${categoria}): "${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}"`,
        ts: Date.now()
      });
      await redis([['LPUSH', 'admin:logs', logItem], ['LTRIM', 'admin:logs', '0', '199']]);
    }
  } catch (e) { /* silencioso */ }

  const r = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `💡 Nova ideia · ${categoria}`,
        description: msg,
        color: 0xa855f7,
        footer: { text: `De: ${autor}${userId ? ' (logado)' : ' (anônimo)'} · ID: ${item.id.slice(0,8)}` },
        timestamp: new Date().toISOString()
      }]
    })
  });
  return r.ok
    ? res.status(200).json({ ok: true, id: item.id })
    : res.status(502).json({ error: 'Falha ao enviar' });
}