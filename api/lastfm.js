// Vercel serverless: /api/lastfm.js
// GET → ouvindo agora + cadeia de capas (oEmbed Spotify → iTunes → Deezer → MusicBrainz)
// Cache Redis de 10s.

const USER = process.env.LASTFM_USER;
const KEY = process.env.LASTFM_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_R = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const CACHE_KEY = 'cache:musica';
const CACHE_TTL = 10;
const SPOTIFY_TOKEN_KEY = 'cache:spotify_token';

function safeStr(v, max = 200) { return String(v == null ? '' : v).trim().slice(0, max); }
function safeUrl(v) {
  const s = safeStr(v, 500);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}

async function redis(cmds) {
  if (!URL_ || !TOKEN_R) return [];
  try {
    const r = await fetch(`${URL_}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN_R}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    return (await r.json()).map(x => x.result);
  } catch(e) { return []; }
}

async function getCache() {
  try {
    const [raw] = await redis([['GET', CACHE_KEY]]);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

async function setCache(data) {
  try {
    await redis([['SET', CACHE_KEY, JSON.stringify(data), 'EX', String(CACHE_TTL)]]);
  } catch(e) {}
}

/* ===== SPOTIFY TOKEN (opcional) ===== */
async function spotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) return null;
  try {
    const [raw] = await redis([['GET', SPOTIFY_TOKEN_KEY]]);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.exp && cached.exp > Date.now()) return cached.token;
    }
  } catch(e) {}
  try {
    const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basic}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: SPOTIFY_REFRESH_TOKEN
      })
    });
    const d = await r.json();
    if (!d.access_token) return null;
    const result = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    try {
      await redis([['SET', SPOTIFY_TOKEN_KEY, JSON.stringify(result), 'EX', String(Math.max(60, (d.expires_in || 3600) - 60))]]);
    } catch(e) {}
    return result.token;
  } catch(e) { return null; }
}

async function spotifyNowPlaying() {
  const token = await spotifyToken();
  if (!token) return null;
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (r.status === 204 || !r.ok) return null;
    const d = await r.json();
    if (!d || !d.item) return null;
    return {
      tocando: !!d.is_playing,
      faixa: safeStr(d.item.name, 200),
      artista: safeStr((d.item.artists || []).map(a => a.name).join(', '), 200),
      album: safeStr(d.item.album?.name, 200),
      capa: safeUrl(d.item.album?.images?.[0]?.url),
      url: safeUrl(d.item.external_urls?.spotify),
      duracao: d.item.duration_ms || null,
      progresso: d.progress_ms || 0,
      fonte: 'spotify'
    };
  } catch(e) { return null; }
}

/* ===== LAST.FM ===== */
async function lastfmNowPlaying() {
  if (!USER || !KEY) return null;
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(USER)}&api_key=${KEY}&format=json&limit=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const track = d?.recenttracks?.track?.[0];
    if (!track) return null;
    const nowplaying = track['@attr']?.nowplaying === 'true';
    if (!nowplaying) return null;
    const lastfmImg = Array.isArray(track.image)
      ? safeUrl(track.image.find(i => i.size === 'extralarge')?.['#text']
        || track.image.find(i => i.size === 'large')?.['#text'])
      : null;
    return {
      tocando: true,
      faixa: safeStr(track.name, 200),
      artista: safeStr(track.artist?.['#text'] || track.artist, 200),
      album: safeStr(track.album?.['#text'], 200),
      capa: lastfmImg,
      url: safeUrl(track.url),
      duracao: null,
      progresso: null,
      fonte: 'lastfm'
    };
  } catch(e) { return null; }
}

/* ===== SPOTIFY oEMBED (capa em alta sem token) ===== */
async function capaSpotifyOEmbed(url) {
  if (!url) return null;
  // Só tenta se for URL do Spotify
  if (!/open\.spotify\.com\/track\//.test(url)) return null;
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return safeUrl(d?.thumbnail_url);
  } catch(e) { return null; }
}

/* ===== FALLBACK DE CAPAS ===== */
async function capaITunes(faixa, artista) {
  try {
    // Limpa sufixos comuns que atrapalham a busca
    const limpo = (s) => String(s || '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/- (Remaster(ed)?|Radio Edit|Live|Acoustic|Version).*/i, '')
      .trim();
    const term = encodeURIComponent(`${limpo(faixa)} ${limpo(artista)}`);
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
    const d = await r.json();
    const url = d?.results?.[0]?.artworkUrl100;
    return url ? url.replace('100x100bb', '600x600bb') : null;
  } catch(e) { return null; }
}

async function capaDeezer(faixa, artista) {
  try {
    const limpo = (s) => String(s || '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    const q = encodeURIComponent(`track:"${limpo(faixa)}" artist:"${limpo(artista)}"`);
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = await r.json();
    const album = d?.data?.[0]?.album;
    if (!album) return null;
    return album.cover_xl || album.cover_big || album.cover_medium || null;
  } catch(e) { return null; }
}

async function capaMusicBrainz(faixa, artista) {
  try {
    const q = encodeURIComponent(`recording:"${faixa}" AND artist:"${artista}"`);
    const r = await fetch(`https://musicbrainz.org/ws/2/recording?query=${q}&limit=1&fmt=json`, {
      headers: { 'User-Agent': 'asemtet0-site/1.0 ( contato@asemtet0.com )' }
    });
    const d = await r.json();
    const releaseId = d?.recordings?.[0]?.releases?.[0]?.id;
    if (!releaseId) return null;
    const c = await fetch(`https://coverartarchive.org/release/${releaseId}/front-500`, { redirect: 'follow' });
    return c.ok ? c.url : null;
  } catch(e) { return null; }
}

async function buscarCapa(faixa, artista, urlLastfm) {
  if (!faixa) return null;
  // 1) Spotify oEmbed (só se a URL for do Spotify)
  let capa = await capaSpotifyOEmbed(urlLastfm);
  // 2) iTunes (mais confiável pra capa bonita)
  if (!capa) capa = await capaITunes(faixa, artista);
  // 3) Deezer
  if (!capa) capa = await capaDeezer(faixa, artista);
  // 4) MusicBrainz (último recurso)
  if (!capa) capa = await capaMusicBrainz(faixa, artista);
  return capa;
}

/* ===== HANDLER ===== */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const cached = await getCache();
  if (cached) return res.status(200).json(cached);

  try {
    let data = await spotifyNowPlaying();
    if (!data || !data.tocando) data = await lastfmNowPlaying();

    if (!data || !data.tocando) {
      const vazio = { tocando: false };
      await setCache(vazio);
      return res.status(200).json(vazio);
    }

    if (!data.capa) data.capa = await buscarCapa(data.faixa, data.artista, data.url);

    await setCache(data);
    return res.status(200).json(data);
  } catch(e) {
    return res.status(200).json({ tocando: false });
  }
}