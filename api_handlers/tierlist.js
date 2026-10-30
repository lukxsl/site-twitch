// Vercel serverless endpoint: /api/tierlist
// A Tier List pública é lida do Redis (Upstash); não exponha tokens ao navegador.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function parseLista(valor) {
  if (valor == null || valor === '') return [];
  try {
    const lista = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: 'Redis não configurado', jogos: [], filmes: [] });
  }

  try {
    const endpoint = REDIS_URL.replace(/\/+$/, '') + '/pipeline';
    const resposta = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + REDIS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([
        ['GET', 'tierlist:jogos'],
        ['GET', 'tierlist:filmes']
      ]),
      signal: AbortSignal.timeout(8000)
    });

    let dados;
    try { dados = await resposta.json(); }
    catch { return res.status(502).json({ error: 'Resposta inválida do Redis', jogos: [], filmes: [] }); }

    if (!resposta.ok || !Array.isArray(dados) || dados.some(item => item && item.error)) {
      return res.status(502).json({ error: 'Não foi possível ler a Tier List', jogos: [], filmes: [] });
    }

    return res.status(200).json({
      jogos: parseLista(dados[0]?.result),
      filmes: parseLista(dados[1]?.result)
    });
  } catch (error) {
    return res.status(502).json({ error: 'Falha ao consultar o Redis', jogos: [], filmes: [] });
  }
}
