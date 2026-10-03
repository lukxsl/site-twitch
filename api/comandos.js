// Vercel serverless: /api/comandos.js
// Puxa comandos do StreamElements com cache de 10 min no Redis (pra não bater na API toda hora).
// Env: SE_JWT, SE_CHANNEL_ID, UPSTASH_REDIS_REST_URL/TOKEN (ou KV_REST_API_*)
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SE_JWT = process.env.SE_JWT;
const SE_CHANNEL = process.env.SE_CHANNEL_ID;
const CACHE_KEY = 'se:comandos';
const CACHE_TTL = 600; // 10 min

const COMANDOS_FALLBACK = [
  { c: '!discord', d: 'Link do Discord' },
  { c: '!insta',   d: 'Instagram da Soso' },
  { c: '!social',  d: 'Instagram, Discord e TikTok' },
  { c: '!lurk',    d: 'Avisar que vai ficar de lurk' },
  { c: '!uptime',  d: 'Tempo de live' },
  { c: '!commands',d: 'Lista de comandos' }
];

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  // 1) Tenta cache do Redis
  if (URL_ && TOKEN) {
    try {
      const [cacheRaw] = await redis([['GET', CACHE_KEY]]);
      if (cacheRaw) {
        const { ts, comandos } = JSON.parse(cacheRaw);
        if (Date.now() - ts < CACHE_TTL * 1000) {
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
          return res.status(200).json({ comandos, cache: true });
        }
      }
    } catch (e) { /* segue pra API */ }
  }

  // 2) Sem SE configurado → fallback local
  if (!SE_JWT || !SE_CHANNEL) {
    return res.status(200).json({ comandos: COMANDOS_FALLBACK, aviso: 'StreamElements não configurado' });
  }

  // 3) Puxa da API do SE
  try {
    const r = await fetch(`https://api.streamelements.com/kappa/v2/bot/commands/${SE_CHANNEL}`, {
      headers: { Authorization: `Bearer ${SE_JWT}`, Accept: 'application/json' }
    });
    if (!r.ok) {
      return res.status(200).json({ comandos: COMANDOS_FALLBACK, aviso: `SE HTTP ${r.status}` });
    }
    const lista = await r.json();
    // O SE retorna array de objetos: { command, reply, cooldown, ... }
    const comandos = (Array.isArray(lista) ? lista : [])
      .filter(c => c && c.command)
      .map(c => {
        // Tira markdown e emojis desnecessários da resposta
        let desc = String(c.reply || '').trim();
        desc = desc.replace(/\$\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
        if (desc.length > 120) desc = desc.slice(0, 117) + '…';
        return {
          c: c.command.startsWith('!') ? c.command : '!' + c.command,
          d: desc || 'Comando do chat'
        };
      });

    // Salva cache
    if (URL_ && TOKEN && comandos.length) {
      try {
        await redis([['SET', CACHE_KEY, JSON.stringify({ ts: Date.now(), comandos }), 'EX', String(CACHE_TTL)]]);
      } catch (e) {}
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ comandos });
  } catch (e) {
    return res.status(200).json({ comandos: COMANDOS_FALLBACK, aviso: 'Erro ao consultar SE' });
  }
}