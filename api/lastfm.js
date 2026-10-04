// Vercel serverless: /api/lastfm.js
// Puxa "ouvindo agora" do Last.fm.
const USER = process.env.LASTFM_USER;
const KEY = process.env.LASTFM_API_KEY;

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
  res.setHeader('Cache-Control', 'no-store');
  if (!USER || !KEY) return res.status(200).json({ tocando: false });

  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(USER)}&api_key=${KEY}&format=json&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return res.status(200).json({ tocando: false });
    const d = await r.json();
    const track = d && d.recenttracks && d.recenttracks.track && d.recenttracks.track[0];
    if (!track) return res.status(200).json({ tocando: false });

    const nowplaying = track['@attr'] && track['@attr'].nowplaying === 'true';
    if (!nowplaying) return res.status(200).json({ tocando: false });

    const capa = Array.isArray(track.image)
      ? (track.image.find(i => i.size === 'extralarge')?.['#text']
        || track.image.find(i => i.size === 'large')?.['#text']
        || null)
      : null;

    return res.status(200).json({
      tocando: true,
      faixa: safeStr(track.name, 200),
      artista: safeStr(track.artist?.['#text'] || track.artist, 200),
      album: safeStr(track.album?.['#text'], 200),
      capa: safeUrl(capa),
      url: safeUrl(track.url)
    });
  } catch (e) {
    return res.status(200).json({ tocando: false });
  }
}