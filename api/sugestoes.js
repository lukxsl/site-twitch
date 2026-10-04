// Vercel serverless: /api/sugestoes.js
// GET  → lista os jogos já sugeridos (Redis)
// POST → envia sugestão pro Discord
import { createHash } from 'crypto';

const recentes = new Map();
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

export default async function handler(req, res) {
  // ---------- GET: lista de sugestões já enviadas ----------
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
  const categoria = String(tipo || '').trim().slice(0, 40);
  if (site) return res.status(200).json({ ok: true });

  const msg = String(texto || '').trim().slice(0, 1000);
  const autor = String(nome || '').trim().slice(0, 40) || 'Anônimo';
  if (!msg) return res.status(400).json({ error: 'Escreva uma sugestão' });

  const ip = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',').pop().trim() || 'x';
  if(recentes.size > 500) recentes.clear();
  const agora = Date.now();
  if (agora - (recentes.get(ip) || 0) < 30000) return res.status(429).json({ error: 'Aguarde um pouco' });
  recentes.set(ip, agora);

  // Salva no Redis se for sugestão de jogo (para alimentar o datalist)
  try {
    if (URL_ && TOKEN && /jogo/i.test(categoria)) {
      const item = JSON.stringify({ nome: msg.slice(0, 80), autor, data: new Date().toISOString() });
      await redis([['LPUSH', 'sugestoes:lista', item], ['LTRIM', 'sugestoes:lista', '0', '199']]);
    }
  } catch (e) { /* silencioso */ }

  const r = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: categoria ? `💡 Nova mensagem · ${categoria}` : '💡 Nova mensagem',
        description: msg, color: 0xa855f7,
        footer: { text: `De: ${autor}` }, timestamp: new Date().toISOString()
      }]
    })
  });
  return r.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: 'Falha ao enviar' });
}