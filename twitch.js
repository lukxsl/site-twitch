// Vercel serverless: /api/twitch.js
const STREAMER = 'asemtet0';
const DISCORD_INVITE = 'J4gGaKWFPZ';
let cache = { token: null, exp: 0 };

async function getToken(id, secret) {
  if (cache.token && Date.now() < cache.exp) return cache.token;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Falha ao obter token');
  cache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return cache.token;
}

export default async function handler(req, res) {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });

  try {
    const token = await getToken(id, secret);
    const headers = { 'Client-ID': id, Authorization: `Bearer ${token}` };
    const api = async path => (await fetch(`https://api.twitch.tv/helix/${path}`, { headers })).json();

    const u = await api(`users?login=${STREAMER}`);
    const user = u.data && u.data[0];
    if (!user) return res.status(404).json({ error: 'Canal não encontrado' });

    const [s, f, v, ch, cl, dc] = await Promise.all([
      api(`streams?user_id=${user.id}`),
      api(`channels/followers?broadcaster_id=${user.id}&first=1`).catch(() => ({})),
      api(`videos?user_id=${user.id}&type=archive&first=10`).catch(() => ({})),
      api(`channels?broadcaster_id=${user.id}`).catch(() => ({})),
      api(`clips?broadcaster_id=${user.id}&first=6`).catch(() => ({})),
      fetch(`https://discord.com/api/v10/invites/${DISCORD_INVITE}?with_counts=true`)
        .then(r => r.json()).catch(() => ({}))
    ]);

    const stream = s.data && s.data[0] ? s.data[0] : null;
    const mapVideo = x => ({
      id: x.id, title: x.title, created_at: x.created_at, duration: x.duration, views: x.view_count,
      thumbnail: x.thumbnail_url ? x.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180') : null
    });
    const videos = (v.data || []).map(mapVideo);
    const video = videos[0] || null;

    // Último jogo (a categoria do canal fica salva mesmo offline)
    const c = ch.data && ch.data[0];
    let game = null;
    if (c && c.game_id) {
      const g = await api(`games?id=${c.game_id}`).catch(() => ({}));
      const box = g.data && g.data[0] && g.data[0].box_art_url;
      game = { name: c.game_name, box_art: box ? box.replace('{width}', '285').replace('{height}', '380') : null };
    }

    const clips = (cl.data || []).map(x => ({
      id: x.id, title: x.title, views: x.view_count, thumbnail: x.thumbnail_url
    }));

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({
      user: { profile_image_url: user.profile_image_url, offline_image_url: user.offline_image_url || null },
      stream: stream && { title: stream.title, game_name: stream.game_name, viewer_count: stream.viewer_count },
      followers: typeof f.total === 'number' ? f.total : null,
      discord: typeof dc.approximate_member_count === 'number' ? dc.approximate_member_count : null,
      video, videos, game, clips
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar a Twitch' });
  }
}