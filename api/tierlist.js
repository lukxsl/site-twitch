// Vercel serverless: /api/tierlist.js
// Tier list pública (lê do Redis, com fallback pros padrões).
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const JOGOS_PADRAO = [
  {
    id: 'red-dead-2', nome: 'Red Dead Redemption 2', appid: 1174180,
    tier: 'S', status: 'Jogando', nota: 8, horas: 50, progresso: 56,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900.jpg',
    comentario: 'Um dos mundos mais vivos e detalhados dos games.'
  }
];

const FILMES_PADRAO = [
  { id: 'interestelar', nome: 'Interestelar', tier: 'S', status: 'Assistido', nota: 9, duracao: 169, comentario: '' },
  { id: 'duna', nome: 'Duna', tier: 'A', status: 'Na fila', nota: 0, duracao: null, comentario: '' }
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
  if (!URL_ || !TOKEN) {
    return res.status(200).json({ jogos: JOGOS_PADRAO, filmes: FILMES_PADRAO, aviso: 'Redis não configurado' });
  }

  try {
    const [jogosRaw, filmesRaw] = await redis([
      ['GET', 'tierlist:jogos'],
      ['GET', 'tierlist:filmes']
    ]);

    let jogos = JOGOS_PADRAO, filmes = FILMES_PADRAO;
    if (jogosRaw) { try { const d = JSON.parse(jogosRaw); if (Array.isArray(d)) jogos = d; } catch(e){} }
    if (filmesRaw) { try { const d = JSON.parse(filmesRaw); if (Array.isArray(d)) filmes = d; } catch(e){} }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({ jogos, filmes });
  } catch (e) {
    return res.status(200).json({ jogos: JOGOS_PADRAO, filmes: FILMES_PADRAO, aviso: e.message });
  }
}