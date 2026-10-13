// Vercel serverless: /api/lastfm.js
// Capas via Spotify: tenta app token (client_credentials) → anônimo (embed page)

const USER = process.env.LASTFM_USER;
const KEY = process.env.LASTFM_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_R = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const CACHE_KEY = 'cache:musica';
const CACHE_TTL = 30;
const SPOTIFY_TOKEN_KEY = 'cache:spotify_token';
const SPOTIFY_APP_TOKEN_KEY = 'cache:spotify_app_token';
const SPOTIFY_ANON_TOKEN_KEY = 'cache:spotify_anon_token';

function safeStr(v, max = 200) { return String(v == null ? '' : v).trim().slice(0, max); }
function safeUrl(v) {
  const s = safeStr(v, 500);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
}
function norm(t) {
  return String(t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
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

/* ===== SPOTIFY: token do usuário (refresh_token, opcional) ===== */
async function spotifyUserToken() {
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

/* ===== SPOTIFY: token de app (client_credentials) ===== */
async function spotifyAppToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  try {
    const [raw] = await redis([['GET', SPOTIFY_APP_TOKEN_KEY]]);
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
      body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.access_token) return null;
    const result = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    try {
      await redis([['SET', SPOTIFY_APP_TOKEN_KEY, JSON.stringify(result), 'EX', String(Math.max(60, (d.expires_in || 3600) - 60))]]);
    } catch(e) {}
    return result.token;
  } catch(e) { return null; }
}

/* ===== SPOTIFY: token ANÔNIMO (sem Premium, extraído de embed) ===== */
async function spotifyAnonToken() {
  try {
    const [raw] = await redis([['GET', SPOTIFY_ANON_TOKEN_KEY]]);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.exp && cached.exp > Date.now()) return cached.token;
    }
  } catch(e) {}

  try {
    // A página de embed contém um accessToken anônimo no HTML.
    // Usamos uma track pública bem conhecida só pra forçar a renderização da página.
    const r = await fetch('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });
    if (!r.ok) return null;
    const html = await r.text();

    // O token costuma estar no __NEXT_DATA__ dentro de um campo accessToken
    // (o formato varia entre builds do Spotify, então tentamos vários padrões).
    const patterns = [
      /"accessToken"\s*:\s*"([^"]+)"/,
      /"access_token"\s*:\s*"([^"]+)"/,
      /"session"\s*:\s*\{\s*"accessToken"\s*:\s*"([^"]+)"/
    ];
    let token = null;
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1] && m[1].length > 20) { token = m[1]; break; }
    }
    if (!token) return null;

    // token anônimo costuma durar ~1h; guardamos por 40min
    try {
      await redis([['SET', SPOTIFY_ANON_TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 40 * 60 * 1000 }), 'EX', '2400']]);
    } catch(e) {}
    return token;
  } catch(e) { return null; }
}

/* ===== SPOTIFY: now playing (opcional, se refresh_token existir) ===== */
async function spotifyNowPlaying() {
  const token = await spotifyUserToken();
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
const LASTFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

function lastfmImg(track, tamanhos) {
  if (!Array.isArray(track.image)) return null;
  for (const t of tamanhos) {
    const u = safeUrl(track.image.find(i => i.size === t)?.['#text']);
    if (u && !u.includes(LASTFM_PLACEHOLDER)) return u;
  }
  return null;
}

async function lastfmDados() {
  const vazio = { agora: null, recentes: [] };
  if (!USER || !KEY) return vazio;
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(USER)}&api_key=${KEY}&format=json&limit=6`;
    const r = await fetch(url);
    if (!r.ok) return vazio;
    const d = await r.json();
    let tracks = d?.recenttracks?.track;
    if (!tracks) return vazio;
    if (!Array.isArray(tracks)) tracks = [tracks];

    const ehAgora = t => t['@attr']?.nowplaying === 'true';
    const nome = t => safeStr(t.artist?.['#text'] || t.artist, 200);

    const t0 = tracks.find(ehAgora);
    const agora = t0 ? {
      tocando: true,
      faixa: safeStr(t0.name, 200),
      artista: nome(t0),
      album: safeStr(t0.album?.['#text'], 200),
      capa: lastfmImg(t0, ['extralarge', 'large']),
      url: safeUrl(t0.url),
      duracao: null,
      progresso: null,
      fonte: 'lastfm'
    } : null;

    const recentes = tracks.filter(t => !ehAgora(t)).slice(0, 4).map(t => ({
      faixa: safeStr(t.name, 200),
      artista: nome(t),
      capa: lastfmImg(t, ['large', 'extralarge']),
      url: safeUrl(t.url),
      quando: t.date?.uts ? new Date(Number(t.date.uts) * 1000).toISOString() : null
    })).filter(x => x.faixa);

    return { agora, recentes };
  } catch(e) { return vazio; }
}

/* ===== SPOTIFY oEMBED (só se a URL for de track) ===== */
async function capaSpotifyOEmbed(url) {
  if (!url) return null;
  if (!/open\.spotify\.com\/track\//.test(url)) return null;
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return safeUrl(d?.thumbnail_url);
  } catch(e) { return null; }
}

/* ===== SPOTIFY SEARCH (usa app token OU anon token) ===== */
async function capaSpotifySearch(faixa, artista) {
  // tenta app token primeiro (só funciona com Premium)
  let token = await spotifyAppToken();
  // se não rolou, extrai o token anônimo do embed
  if (!token) token = await spotifyAnonToken();
  if (!token) return null;

  try {
    const limpo = (s) => String(s || '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\s*-\s*(Remaster(ed)?|Radio Edit|Live|Acoustic|Version)\b.*/i, '')
      .replace(/\s+(feat|ft)\.?\s+.*/i, '')
      .trim();
    const q = encodeURIComponent(`${limpo(faixa)} ${limpo(artista)}`);
    const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const track = d?.tracks?.items?.[0];
    if (!track) return null;
    const imgs = track.album?.images || [];
    const capa = imgs[0]?.url || imgs[1]?.url || imgs[2]?.url;
    return safeUrl(capa);
  } catch(e) { return null; }
}

/* ===== CACHE DE CAPA POR MÚSICA (30 dias) ===== */
function chaveCapa(faixa, artista) {
  return 'capa:' + norm(faixa + '|' + artista).slice(0, 120);
}
async function capaCache(chave) {
  try {
    const [raw] = await redis([['GET', chave]]);
    return raw || null;
  } catch(e) { return null; }
}
async function capaSalvar(chave, url) {
  try {
    await redis([['SET', chave, url, 'EX', '2592000']]);
  } catch(e) {}
}

async function buscarCapa(faixa, artista, urlLastfm) {
  if (!faixa) return null;

  const chave = chaveCapa(faixa, artista);
  const cache = await capaCache(chave);
  if (cache) return cache;

  // só Spotify, como pedido: oEmbed → search
  let capa = await capaSpotifyOEmbed(urlLastfm);
  if (!capa) capa = await capaSpotifySearch(faixa, artista);

  if (capa) await capaSalvar(chave, capa);
  return capa;
}

/* ===== HANDLER ===== */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const cached = await getCache();
  if (cached) return res.status(200).json(cached);

  try {
    let data = await spotifyNowPlaying();
    let recentes = [];
    if (!data || !data.tocando) {
      const lf = await lastfmDados();
      data = lf.agora;
      recentes = lf.recentes;
    }

    // busca capa pros recentes sem capa
    const semCapa = recentes.filter(r => !r.capa && r.faixa);
    if (semCapa.length) {
      await Promise.all(semCapa.map(async r => {
        r.capa = await buscarCapa(r.faixa, r.artista, r.url);
      }));
    }

    if (!data || !data.tocando) {
      const vazio = { tocando: false, recentes };
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