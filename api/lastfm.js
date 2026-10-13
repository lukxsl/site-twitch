// Vercel serverless: /api/lastfm.js
// Prioridade: Spotify (dados completos: nome, artista, capa, link)
// Fallback: Last.fm + capa do iTunes/Deezer/MusicBrainz

const USER = process.env.LASTFM_USER;
const KEY = process.env.LASTFM_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_R = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const CACHE_KEY = 'cache:musica';
const CACHE_TTL = 30;
const SPOTIFY_USER_TOKEN_KEY = 'cache:spotify_user_token';
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
function limparNome(s) {
  return String(s || '')
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*-\s*(Remaster(ed)?|Radio Edit|Live|Acoustic|Version|Bonus|Deluxe|Extended)\b.*/i, '')
    .replace(/\s+(feat|ft)\.?\s+.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  try { const [raw] = await redis([['GET', CACHE_KEY]]); return raw ? JSON.parse(raw) : null; } catch(e) { return null; }
}
async function setCache(data) {
  try { await redis([['SET', CACHE_KEY, JSON.stringify(data), 'EX', String(CACHE_TTL)]]); } catch(e) {}
}

/* ============ SPOTIFY TOKENS ============ */
async function spotifyUserToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) return null;
  try {
    const [raw] = await redis([['GET', SPOTIFY_USER_TOKEN_KEY]]);
    if (raw) { const c = JSON.parse(raw); if (c.exp && c.exp > Date.now()) return c.token; }
  } catch(e) {}
  try {
    const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: SPOTIFY_REFRESH_TOKEN })
    });
    const d = await r.json();
    if (!d.access_token) return null;
    const result = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    try { await redis([['SET', SPOTIFY_USER_TOKEN_KEY, JSON.stringify(result), 'EX', String(Math.max(60, (d.expires_in || 3600) - 60))]]); } catch(e) {}
    return result.token;
  } catch(e) { return null; }
}

async function spotifyAppToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  try {
    const [raw] = await redis([['GET', SPOTIFY_APP_TOKEN_KEY]]);
    if (raw) { const c = JSON.parse(raw); if (c.exp && c.exp > Date.now()) return c.token; }
  } catch(e) {}
  try {
    const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'client_credentials' })
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.access_token) return null;
    const result = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    try { await redis([['SET', SPOTIFY_APP_TOKEN_KEY, JSON.stringify(result), 'EX', String(Math.max(60, (d.expires_in || 3600) - 60))]]); } catch(e) {}
    return result.token;
  } catch(e) { return null; }
}

async function spotifyAnonToken() {
  try {
    const [raw] = await redis([['GET', SPOTIFY_ANON_TOKEN_KEY]]);
    if (raw) { const c = JSON.parse(raw); if (c.exp && c.exp > Date.now()) return c.token; }
  } catch(e) {}
  try {
    const r = await fetch('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });
    if (!r.ok) return null;
    const html = await r.text();
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
    try { await redis([['SET', SPOTIFY_ANON_TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 40 * 60 * 1000 }), 'EX', '2400']]); } catch(e) {}
    return token;
  } catch(e) { return null; }
}

/* ============ SPOTIFY: now playing (opcional) ============ */
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

/* ============ LAST.FM ============ */
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
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(USER)}&api_key=${KEY}&format=json&limit=8`;
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

    const recentes = tracks.filter(t => !ehAgora(t)).slice(0, 5).map(t => ({
      faixa: safeStr(t.name, 200),
      artista: nome(t),
      capa: lastfmImg(t, ['large', 'extralarge']),
      url: safeUrl(t.url),
      quando: t.date?.uts ? new Date(Number(t.date.uts) * 1000).toISOString() : null
    })).filter(x => x.faixa);

    return { agora, recentes };
  } catch(e) { return vazio; }
}

/* ============ SPOTIFY SEARCH → TRACK COMPLETO ============ */
async function spotifySearchTrack(faixa, artista) {
  let token = await spotifyAppToken();
  if (!token) token = await spotifyAnonToken();
  if (!token) return null;

  const f = limparNome(faixa);
  const a = limparNome(artista);
  if (!f) return null;

  const tentativas = [
    a ? `track:"${f}" artist:"${a}"` : null,
    a ? `track:"${f}" ${a}` : null,
    a ? `${f} ${a}` : null,
    f
  ].filter(Boolean);

  for (const q of tentativas) {
    try {
      const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.status === 401) {
        try { await redis([['DEL', SPOTIFY_APP_TOKEN_KEY], ['DEL', SPOTIFY_ANON_TOKEN_KEY]]); } catch(e) {}
        token = await spotifyAppToken() || await spotifyAnonToken();
        if (!token) return null;
        continue;
      }
      if (!r.ok) continue;
      const d = await r.json();
      const track = d?.tracks?.items?.[0];
      if (!track) continue;
      const imgs = track.album?.images || [];
      const capa = imgs[0]?.url || imgs[1]?.url || imgs[2]?.url;
      return {
        faixa: safeStr(track.name, 200),
        artista: safeStr((track.artists || []).map(x => x.name).join(', '), 200),
        album: safeStr(track.album?.name, 200) || null,
        capa: safeUrl(capa),
        url: safeUrl(track.external_urls?.spotify),
        duracao: track.duration_ms || null
      };
    } catch(e) { continue; }
  }
  return null;
}

/* ============ FALLBACKS DE CAPA (só capa) ============ */
async function capaITunes(faixa, artista) {
  const f = limparNome(faixa), a = limparNome(artista);
  if (!f) return null;
  for (const termo of [a ? `${f} ${a}` : null, f].filter(Boolean)) {
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(termo)}&entity=song&limit=1`);
      if (!r.ok) continue;
      const d = await r.json();
      const t = d?.results?.[0];
      const url = t?.artworkUrl100 || t?.artworkUrl60;
      if (url) return url.replace(/\/\d+x\d+bb\./, '/600x600bb.');
    } catch(e) { continue; }
  }
  return null;
}

async function capaDeezer(faixa, artista) {
  const f = limparNome(faixa), a = limparNome(artista);
  if (!f) return null;
  for (const q of [a ? `track:"${f}" artist:"${a}"` : null, a ? `${f} ${a}` : null, f].filter(Boolean)) {
    try {
      const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=1`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const d = await r.json();
      const album = d?.data?.[0]?.album;
      if (album) return album.cover_xl || album.cover_big || album.cover_medium;
    } catch(e) { continue; }
  }
  return null;
}

async function capaMusicBrainz(faixa, artista) {
  try {
    const q = encodeURIComponent(`recording:"${limparNome(faixa)}" AND artist:"${limparNome(artista)}"`);
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

/* ============ CACHE DO TRACK COMPLETO ============ */
function chaveTrack(faixa, artista) {
  return 'track:' + norm(faixa + '|' + artista).slice(0, 140);
}

async function enriquecerComSpotify(item) {
  if (!item || !item.faixa) return item;

  const chave = chaveTrack(item.faixa, item.artista);
  try {
    const [raw] = await redis([['GET', chave]]);
    if (raw) {
      const cached = JSON.parse(raw);
      item.faixa = cached.faixa;
      item.artista = cached.artista;
      if (cached.album) item.album = cached.album;
      if (cached.capa) item.capa = cached.capa;
      if (cached.url) item.url = cached.url;
      if (cached.duracao) item.duracao = cached.duracao;
      item.fonte = 'spotify';
      return item;
    }
  } catch(e) {}

  const spot = await spotifySearchTrack(item.faixa, item.artista);
  if (spot) {
    item.faixa = spot.faixa;
    item.artista = spot.artista;
    if (spot.album) item.album = spot.album;
    if (spot.capa) item.capa = spot.capa;
    if (spot.url) item.url = spot.url;
    if (spot.duracao) item.duracao = spot.duracao;
    item.fonte = 'spotify';
    try { await redis([['SET', chave, JSON.stringify(spot), 'EX', '2592000']]); } catch(e) {}
    return item;
  }

  // Spotify não achou: usa Last.fm como está, mas tenta capa do iTunes/Deezer
  if (!item.capa) {
    const c = await capaITunes(item.faixa, item.artista)
      || await capaDeezer(item.faixa, item.artista)
      || await capaMusicBrainz(item.faixa, item.artista);
    if (c) item.capa = c;
  }
  return item;
}

/* ============ HANDLER ============ */
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

    // Enriquece tudo com Spotify (nome, artista, capa, link)
    const tarefas = [];
    if (data && data.tocando) tarefas.push(enriquecerComSpotify(data));
    recentes.forEach(r => tarefas.push(enriquecerComSpotify(r)));
    await Promise.all(tarefas);

    if (!data || !data.tocando) {
      const vazio = { tocando: false, recentes };
      await setCache(vazio);
      return res.status(200).json(vazio);
    }

    await setCache(data);
    return res.status(200).json(data);
  } catch(e) {
    console.error('[lastfm] erro:', e);
    return res.status(200).json({ tocando: false });
  }
}