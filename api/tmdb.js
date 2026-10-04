// Vercel serverless: /api/tmdb.js
// Variável de ambiente: TMDB_TOKEN (API Read Access Token) ou TMDB_API_KEY (chave v3)
const BASE = 'https://api.themoviedb.org/3';

/* Rate-limit por IP (endpoint público) */
const IP_RATE = new Map();
function checkIp(req, ms = 500) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const last = IP_RATE.get(ip) || 0;
  if (now - last < ms) return false;
  IP_RATE.set(ip, now);
  if (IP_RATE.size > 500) {
    for (const [k, t] of IP_RATE) if (now - t > 60000) IP_RATE.delete(k);
  }
  return true;
}

function safeStr(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

export default async function handler(req, res) {
  if (!checkIp(req, 500)) return res.status(429).json({ error: 'Aguarde um instante' });

  const token = process.env.TMDB_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) return res.status(500).json({ error: 'TMDB não configurado' });

  const { q, ano, id } = req.query || {};

  const chamar = async (path, params = {}) => {
    const u = new URL(BASE + path);
    Object.entries({ language: 'pt-BR', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
    if (!token) u.searchParams.set('api_key', key);
    const r = await fetch(u, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return r.json();
  };

  try {
    let filmeId = /^\d+$/.test(String(id || '')) ? String(id) : null;

    if (!filmeId) {
      const nome = safeStr(q, 120);
      const anoLimpo = /^\d{4}$/.test(String(ano || '')) ? String(ano) : null;
      if (!nome) return res.status(400).json({ error: 'Informe q ou id' });

      const buscar = async (lang, anoBusca) => {
        const params = { query: nome, include_adult: 'false' };
        if (lang) params.language = lang;
        if (anoBusca) params.year = anoBusca;
        return chamar('/search/movie', params);
      };

      let busca = await buscar('pt-BR', anoLimpo);
      let achado = busca.results && busca.results[0];

      if (!achado) {
        busca = await buscar('pt-BR', null);
        achado = busca.results && busca.results[0];
      }
      if (!achado) {
        busca = await buscar(null, anoLimpo);
        achado = busca.results && busca.results[0];
      }

      if (!achado) return res.status(404).json({ error: 'Filme não encontrado' });
      filmeId = String(achado.id);
    }

    const d = await chamar(`/movie/${filmeId}`);
    if (!d.id) return res.status(404).json({ error: 'Filme não encontrado' });

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).json({
      id: d.id,
      titulo: safeStr(d.title, 200),
      ano: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      horas: d.runtime ? Math.round(d.runtime / 6) / 10 : null,
      sinopse: safeStr(d.overview, 2000)
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar o TMDB' });
  }
}