// Vercel serverless: /api/tmdb.js
// Variável de ambiente: TMDB_TOKEN (o "API Read Access Token" do TMDB)
// ou TMDB_API_KEY (a chave v3). Uma das duas basta.
// Uso: /api/tmdb?q=Interestelar&ano=2014   ou   /api/tmdb?id=157336
const BASE = 'https://api.themoviedb.org/3';

export default async function handler(req, res) {
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
      const nome = String(q || '').trim().slice(0, 120);
      if (!nome) return res.status(400).json({ error: 'Informe q ou id' });
      const params = { query: nome, include_adult: 'false' };
      if (/^\d{4}$/.test(String(ano || ''))) params.year = String(ano);
      const busca = await chamar('/search/movie', params);
      const achado = busca.results && busca.results[0];
      if (!achado) return res.status(404).json({ error: 'Filme não encontrado' });
      filmeId = String(achado.id);
    }

    const d = await chamar(`/movie/${filmeId}`);
    if (!d.id) return res.status(404).json({ error: 'Filme não encontrado' });

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).json({
      id: d.id,
      titulo: d.title,
      ano: d.release_date ? Number(d.release_date.slice(0, 4)) : null,
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      horas: d.runtime ? Math.round(d.runtime / 6) / 10 : null,
      sinopse: d.overview || ''
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar o TMDB' });
  }
}