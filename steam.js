// Vercel serverless: /api/steam.js
// Variáveis de ambiente: STEAM_API_KEY e STEAM_ID (SteamID64).
// No perfil da Steam, "Detalhes do jogo" precisa estar Público.
const BASE = 'https://api.steampowered.com';

export default async function handler(req, res) {
  const key = process.env.STEAM_API_KEY;
  const steamid = process.env.STEAM_ID;
  if (!key || !steamid) return res.status(500).json({ error: 'Steam não configurada' });

  try {
    const r = await fetch(`${BASE}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`);
    const d = await r.json();
    const lista = (d.response && d.response.games) || [];
    if (!lista.length) return res.status(200).json({ jogos: [], aviso: 'Nenhum jogo encontrado (perfil ou detalhes de jogo privados?)' });

    // só jogos já jogados, os 60 com mais horas
    const jogados = lista.filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 60);

    // progresso = % de conquistas desbloqueadas (jogos sem conquistas ficam sem progresso)
    const prog = {};
    await Promise.all(jogados.map(async g => {
      try {
        const a = await (await fetch(`${BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${key}&steamid=${steamid}&appid=${g.appid}`)).json();
        const ach = a.playerstats && a.playerstats.achievements;
        if (ach && ach.length) prog[g.appid] = Math.round(ach.filter(x => x.achieved).length / ach.length * 100);
      } catch (e) { /* sem conquistas */ }
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
    return res.status(200).json({
      jogos: jogados.map(g => ({
        appid: g.appid,
        nome: g.name,
        horas: Math.round(g.playtime_forever / 6) / 10,
        recente: (g.playtime_2weeks || 0) > 0,
        progresso: prog[g.appid] != null ? prog[g.appid] : null,
        capa: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`
      }))
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar a Steam' });
  }
}