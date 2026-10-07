// Vercel serverless: /api/lastfm.js
// GET  → ouvindo agora + cadeia de capas
const USER = process.env.LASTFM_USER;
const KEY = process.env.LASTFM_API_KEY;
const SPOTIFY_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

function safeStr(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function safeUrl(v) {
  const s = safeStr(v, 500);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

/* --- Cache Spotify --- */
let spotifyCache = { token: null, exp: 0 };
async function spotifyToken(){
  if(!SPOTIFY_ID || !SPOTIFY_SECRET) return null;
  if(spotifyCache.token && Date.now() < spotifyCache.exp) return spotifyCache.token;
  try {
    const auth = Buffer.from(`${SPOTIFY_ID}:${SPOTIFY_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials'
    });
    const d = await r.json();
    if(!d.access_token) return null;
    spotifyCache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    return spotifyCache.token;
  } catch(e){ return null; }
}

/* --- Fallback 1: MusicBrainz + CoverArtArchive --- */
async function capaMusicBrainz(faixa, artista){
  try {
    const q = encodeURIComponent(`recording:"${faixa}" AND artist:"${artista}"`);
    const r = await fetch(`https://musicbrainz.org/ws/2/recording?query=${q}&limit=1&fmt=json`, {
      headers: { 'User-Agent': 'asemtet0-site/1.0 ( contato@asemtet0.com )' }
    });
    const d = await r.json();
    const releaseId = d?.recordings?.[0]?.releases?.[0]?.id;
    if(!releaseId) return null;
    const c = await fetch(`https://coverartarchive.org/release/${releaseId}/front-500`, { redirect: 'follow' });
    if(c.ok) return c.url;
    return null;
  } catch(e){ return null; }
}

/* --- Fallback 2: iTunes Search --- */
async function capaITunes(faixa, artista){
  try {
    const term = encodeURIComponent(`${faixa} ${artista}`);
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
    const d = await r.json();
    const url = d?.results?.[0]?.artworkUrl100;
    if(!url) return null;
    return url.replace('100x100bb', '600x600bb');
  } catch(e){ return null; }
}

/* --- Fallback 3: Spotify Search --- */
async function capaSpotify(faixa, artista){
  try {
    const token = await spotifyToken();
    if(!token) return null;
    const q = encodeURIComponent(`track:"${faixa}" artist:"${artista}"`);
    const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    const imgs = d?.tracks?.items?.[0]?.album?.images;
    return Array.isArray(imgs) && imgs[0]?.url ? imgs[0].url : null;
  } catch(e){ return null; }
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

    const faixa = safeStr(track.name, 200);
    const artista = safeStr(track.artist?.['#text'] || track.artist, 200);
    const album = safeStr(track.album?.['#text'], 200);

    /* Cadeia de capas */
    let capa = null;
    const lastfmImg = Array.isArray(track.image)
      ? (track.image.find(i => i.size === 'extralarge')?.['#text']
         || track.image.find(i => i.size === 'large')?.['#text']
         || null)
      : null;
    capa = safeUrl(lastfmImg);

    if(!capa && faixa && artista){
      capa = await capaMusicBrainz(faixa, artista);
      if(!capa) capa = await capaITunes(faixa, artista);
      if(!capa) capa = await capaSpotify(faixa, artista);
    }

    return res.status(200).json({
      tocando: true,
      faixa,
      artista,
      album,
      capa,
      url: safeUrl(track.url)
    });
  } catch (e) {
    return res.status(200).json({ tocando: false });
  }
}