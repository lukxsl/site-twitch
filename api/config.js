// Vercel serverless: /api/config.js
// Devolve config pública SEM CACHE (evita CDN entregar versão antiga).
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  if (!URL_ || !TOKEN) return res.status(200).json({});

  try {
    const [avisoRaw, donateRaw, manutRaw, recadoRaw, horasRaw, updatedRaw] = await redis([
      ['GET', 'config:aviso'],
      ['GET', 'config:donate'],
      ['GET', 'config:manutencao'],
      ['GET', 'config:recado'],
      ['GET', 'config:horasMes'],
      ['GET', 'config:updatedAt']
    ]);

    let aviso = null;
    try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch(e){}

    return res.status(200).json({
      aviso,
      donate: donateRaw || null,
      manutencao: manutRaw === '1',
      recado: recadoRaw || '',
      horasMes: horasRaw || '',
      updatedAt: updatedRaw || null
    });
  } catch (e) {
    return res.status(200).json({});
  }
}