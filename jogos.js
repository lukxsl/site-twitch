// Vercel serverless: /api/jogos.js
// Junta Steam (horas reais) + IGDB (nota, capa, sinopse).
// Env: STEAM_API_KEY (ou STEAM), TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
const STEAM_KEY = process.env.STEAM_API_KEY || process.env.STEAM;
const STEAM_ID = '76561199823015081';
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;

let igdbCache = { token: null, exp: 0 };
async function igdbToken() {
  if (igdbCache.token && Date.now() < igdbCache.exp) return igdbCache.token;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('IGDB token fail');
  igdbCache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return igdbCache.token;
}

async function igdbQuery(body) {
  const token = await igdbToken();
  const r = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body
  });
  return r.json();
}

export default async function handler(req, res) {
  if (!STEAM_KEY) return res.status(500).json({ error: 'Steam API Key não configurada' });

  try {
    // ---------- 1) Steam: horas + appid ----------
    const r = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`);
    if (!r.ok) return res.status(200).json({ jogos: [], aviso: `Steam HTTP ${r.status}` });
    const sd = await r.json();
    const lista = (sd.response && sd.response.games) || [];
    if (!lista.length) return res.status(200).json({ jogos: [], aviso: 'Nenhum jogo público. Verifique se "Detalhes do jogo" está público.' });

    const jogados = lista.filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 60);

    // ---------- 2) IGDB: enriquece ----------
    const igdbData = {};
    if (TWITCH_ID && TWITCH_SECRET) {
      try {
        // Agrupa em lotes de 40 nomes (where name = ("A","B",...))
        const lotes = [];
        const nomes = jogados.map(g => g.name.replace(/"/g, '').trim());
        for (let i = 0; i < nomes.length; i += 40) lotes.push(nomes.slice(i, i + 40));

        for (const lote of lotes) {
          const filtro = lote.map(n => `"${n}"`).join(',');
          const body = `fields name, rating, aggregated_rating, cover.url, summary, first_release_date; where name = (${filtro}); limit 500;`;
          const d = await igdbQuery(body);
          if (Array.isArray(d)) {
            for (const g of d) {
              const capa = g.cover && g.cover.url
                ? `https:${g.cover.url.replace('t_thumb', 't_cover_big').replace('t_cover_small', 't_cover_big')}`
                : null;
              igdbData[g.name.toLowerCase()] = {
                nota: g.rating ? Math.round(g.rating) / 10 : null,
                capa,
                sinopse: g.summary || '',
                ano: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
              };
            }
          }
        }
      } catch (e) { /* segue só com Steam */ }
    }

    // ---------- 3) Merge ----------
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json({
      jogos: jogados.map(g => {
        const extra = igdbData[g.name.toLowerCase()] || {};
        return {
          appid: g.appid,
          nome: g.name,
          horas: Math.round(g.playtime_forever / 6) / 10,
          recente: (g.playtime_2weeks || 0) > 0,
          nota: extra.nota || 0,
          sinopse: extra.sinopse || '',
          ano: extra.ano || null,
          capa: extra.capa || `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`
        };
      })
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar jogos' });
  }
}