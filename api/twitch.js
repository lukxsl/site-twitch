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

function duracaoParaMin(d) {
  if (!d) return 0;
  const h = /(\d+)h/.exec(d);
  const m = /(\d+)m/.exec(d);
  const s = /(\d+)s/.exec(d);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) + (s ? Math.round(Number(s[1]) / 60) : 0);
}

function calcularHorasMes(videos) {
  if (!Array.isArray(videos)) return 0;
  const agora = new Date();
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth();
  let totalMin = 0;
  for (const v of videos) {
    if (!v.created_at || !v.duration) continue;
    const d = new Date(v.created_at);
    if (d.getUTCFullYear() !== anoAtual || d.getUTCMonth() !== mesAtual) continue;
    totalMin += duracaoParaMin(v.duration);
  }
  return Math.round(totalMin / 60);
}

function safeStr(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function safeUrl(v) {
  const s = safeStr(v, 500);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
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
      api(`videos?user_id=${user.id}&type=archive&first=50`).catch(() => ({})),
      api(`channels?broadcaster_id=${user.id}`).catch(() => ({})),
      api(`clips?broadcaster_id=${user.id}&first=6`).catch(() => ({})),
      fetch(`https://discord.com/api/v10/invites/${DISCORD_INVITE}?with_counts=true`)
        .then(r => r.json()).catch(() => ({}))
    ]);

    const stream = s.data && s.data[0] ? s.data[0] : null;

    let uptime = null;
    if (stream && stream.started_at) {
      const diff = Date.now() - new Date(stream.started_at).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      uptime = `${h}h ${m}m`;
    }

    const mapVideo = x => ({
      id: safeStr(x.id, 60),
      title: safeStr(x.title, 200),
      created_at: safeStr(x.created_at, 40),
      duration: safeStr(x.duration, 20),
      views: Number(x.view_count) || 0,
      thumbnail: safeUrl(
        x.thumbnail_url
          ? x.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180')
          : null
      )
    });
    const videos = (v.data || []).map(mapVideo);
    const video = videos[0] || null;
    const horasMes = calcularHorasMes(videos);

    const c = ch.data && ch.data[0];
    let game = null;
    if (c && c.game_id) {
      const g = await api(`games?id=${c.game_id}`).catch(() => ({}));
      const box = g.data && g.data[0] && g.data[0].box_art_url;
      game = {
        name: safeStr(c.game_name, 200),
        box_art: safeUrl(box ? box.replace('{width}', '285').replace('{height}', '380') : null)
      };
    }

    const clips = (cl.data || []).map(x => ({
      id: safeStr(x.id, 60),
      title: safeStr(x.title, 200),
      views: Number(x.view_count) || 0,
      thumbnail: safeUrl(x.thumbnail_url)
    }));

    const followersTotal = typeof f.total === 'number' ? f.total : 0;
    const discordTotal = typeof dc.approximate_member_count === 'number' ? dc.approximate_member_count : 0;

    // 🆕 Detectar conteúdo adulto (Twitch bloqueia embed desses casos)
    const isMature = !!(stream && stream.is_mature);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({
      user: {
        profile_image_url: safeUrl(user.profile_image_url),
        offline_image_url: safeUrl(user.offline_image_url) || null
      },
      stream: stream && {
        title: safeStr(stream.title, 200),
        game_name: safeStr(stream.game_name, 200),
        viewer_count: Number(stream.viewer_count) || 0,
        uptime,
        started_at: safeStr(stream.started_at, 40),
        is_mature: isMature
      },
      followers: followersTotal || null,
      discord: discordTotal || null,
      horasMes,
      video, videos, game, clips
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar a Twitch' });
  }
}