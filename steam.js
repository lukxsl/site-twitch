// Vercel serverless: /api/steam.js
// Variável de ambiente necessária na Vercel: STEAM_API_KEY (ou STEAM)
// No perfil da Steam, "Detalhes do jogo" precisa estar Público.
const BASE = 'https://api.steampowered.com';

export default async function handler(req, res) {
  // Puxa a chave de API das variáveis de ambiente da Vercel
  const key = process.env.STEAM_API_KEY || process.env.STEAM;
  // Seu SteamID64 extraído do link fornecido
  const steamid = '76561199823015081';

  if (!key) {
    return res.status(500).json({ error: 'Steam API Key não configurada nas variáveis de ambiente da Vercel.' });
  }

  try {
    const r = await fetch(`${BASE}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`);
    if (!r.ok) {
      return res.status(200).json({ jogos: [], aviso: `A Steam respondeu HTTP ${r.status}. ${r.status === 403 ? 'A chave de API parece inválida.' : ''}` });
    }
    const d = await r.json();
    const lista = (d.response && d.response.games) || [];
    
    if (!lista.length) {
      return res.status(200).json({ 
        jogos: [], 
        aviso: 'Nenhum jogo encontrado. Verifique se os detalhes do jogo no seu perfil da Steam estão públicos.' 
      });
    }

    // Filtra apenas jogos jogados e pega os 60 com mais horas
    const jogados = lista.filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 60);

    // Calcula a porcentagem de conquistas desbloqueadas
    const prog = {};
    await Promise.all(jogados.map(async g => {
      try {
        const a = await (await fetch(`${BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${key}&steamid=${steamid}&appid=${g.appid}`)).json();
        const ach = a.playerstats && a.playerstats.achievements;
        if (ach && ach.length) {
          prog[g.appid] = Math.round(ach.filter(x => x.achieved).length / ach.length * 100);
        }
      } catch (e) { /* Jogo sem conquistas ou privado */ }
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
    return res.status(500).json({ error: 'Erro ao consultar a API da Steam' });
  }
}