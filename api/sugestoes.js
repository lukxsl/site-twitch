// Vercel serverless: /api/sugestoes.js
// GET  → lista os jogos já sugeridos (Redis)
// POST → envia sugestão pro Discord
import { createHash } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

/* Rate-limit por IP */
const recentes = new Map();
const RATE_MS = 30000;

/* Rate-limit por hash de conteúdo (mesma mensagem repetida) */
const dupCache = new Map();
const DUP_MS = 120000;

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

function safeStr(v, max = 1000) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function limparMapas() {
  const now = Date.now();
  if (recentes.size > 500) {
    for (const [k, t] of recentes) if (now - t > 300000) recentes.delete(k);
  }
  if (dupCache.size > 500) {
    for (const [k, t] of dupCache) if (now - t > 600000) dupCache.delete(k);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  /* ---------- GET: lista de sugestões ---------- */
  if (req.method === 'GET') {
    if (!URL_ || !TOKEN) return res.status(200).json({ itens: [] });
    try {
      const [flat] = await redis([['LRANGE', 'sugestoes:lista', '0', '199']]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
      return res.status(200).json({ itens });
    } catch (e) {
      return res.status(200).json({ itens: [] });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return res.status(500).json({ error: 'Webhook não configurado' });

  const { nome, texto, site, tipo } = req.body || {};

  /* Honeypot: se preenchido, é bot */
  if (site) return res.status(200).json({ ok: true });

  const categoria = safeStr(tipo, 40);
  const msg = safeStr(texto, 1000);
  const autor = safeStr(nome, 40) || 'Anônimo';

  if (!msg) return res.status(400).json({ error: 'Escreva uma sugestão' });

  /* Rate-limit por IP */
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const agora = Date.now();

  limparMapas();

  if (agora - (recentes.get(ip) || 0) < RATE_MS) {
    return res.status(429).json({ error: 'Aguarde um pouco antes de enviar de novo' });
  }
  recentes.set(ip, agora);

  /* Anti-spam: mesma mensagem repetida */
  const hash = createHash('sha256').update(ip + '|' + msg.toLowerCase()).digest('hex');
  if (agora - (dupCache.get(hash) || 0) < DUP_MS) {
    return res.status(429).json({ error: 'Você já enviou essa mensagem. Aguarde.' });
  }
  dupCache.set(hash, agora);

  /* Salva no Redis se for sugestão de jogo (pra datalist) */
  try {
    if (URL_ && TOKEN && /jogo/i.test(categoria)) {
      const item = JSON.stringify({
        nome: msg.slice(0, 80),
        autor,
        data: new Date().toISOString()
      });
      await redis([['LPUSH', 'sugestoes:lista', item], ['LTRIM', 'sugestoes:lista', '0', '199']]);
    }
  } catch (e) { /* silencioso */ }

  /* Envia pro Discord */
  const r = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: categoria ? `💡 Nova mensagem · ${categoria}` : '💡 Nova mensagem',
        description: msg,
        color: 0xa855f7,
        footer: { text: `De: ${autor}` },
        timestamp: new Date().toISOString()
      }]
    })
  });
  return r.ok
    ? res.status(200).json({ ok: true })
    : res.status(502).json({ error: 'Falha ao enviar' });
}