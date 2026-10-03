// Vercel serverless: /api/lastfm.js
// Puxa "ouvindo agora" do Last.fm.
// Env:
//   LASTFM_USER       (ex: asemtet0 — username no Last.fm)
//   LASTFM_API_KEY    (chave grátis: https://www.last.fm/api/account/create)
const USER = process.env.LASTFM_USER;
const KEY = process.env.LASTFM_API_KEY;

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

    // Só retorna se for "tocando agora" (@attr.nowplaying)
    const nowplaying = track['@attr'] && track['@attr'].nowplaying === 'true';
    if (!nowplaying) return res.status(200).json({ tocando: false });

    const capa = Array.isArray(track.image)
      ? (track.image.find(i => i.size === 'extralarge')?.['#text']
        || track.image.find(i => i.size === 'large')?.['#text']
        || null)
      : null;

    return res.status(200).json({
      tocando: true,
      faixa: track.name || '',
      artista: track.artist?.['#text'] || track.artist || '',
      album: track.album?.['#text'] || '',
      capa: capa || null,
      url: track.url || null
    });
  } catch (e) {
    return res.status(200).json({ tocando: false });
  }
}