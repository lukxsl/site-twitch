// Vercel serverless: /api/config.js

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const STREAMELEMENTS_JWT = (process.env.STREAMELEMENTS_JWT || '').trim();

const CANAL = 'asemtet0';
const HALL_CACHE_KEY = 'cache:hall_v14';
const HALL_CACHE_TS_KEY = 'cache:hall_at_v14';
const HALL_CACHE_TTL = 2 * 60;            // doadores: atualiza no máx. a cada 2 min
const EMOTES_CACHE_KEY = 'cache:emotes_v1';
const EMOTES_CACHE_TTL = 6 * 60 * 60;     // emotes quase nunca mudam

// ==========================================
// CONFIGURAÇÕES DA STREAMELEMENTS (NOVAS)
// ==========================================
const SE_BASE_URL = 'https://api.streamelements.com/kappa/v2';
const CHANNEL_CACHE_TTL = 15 * 60 * 1000; // 15 minutos
const SUBSCRIBERS_PAGE_SIZE = 100;
const SUBSCRIBERS_MAX_PAGES = 20; // Até 2.000 registros

let channelCache = { id: null, expiresAt: 0 };
let channelIdRequest = null;

async function seFetch(endpoint) {
  if (!STREAMELEMENTS_JWT) {
    const error = new Error('A variável STREAMELEMENTS_JWT não está configurada.');
    error.statusCode = 500;
    throw error;
  }
  const path = String(endpoint || '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  let response;
  try {
    response = await fetch(`${SE_BASE_URL}${normalizedPath}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${STREAMELEMENTS_JWT}`, Accept: 'application/json' }
    });
  } catch (cause) {
    const error = new Error('Não foi possível conectar à API do StreamElements.');
    error.statusCode = 502;
    throw error;
  }

  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try { payload = JSON.parse(responseText); } catch (cause) {
      if (response.ok) {
        const error = new Error('A API do StreamElements retornou uma resposta inválida.');
        error.statusCode = 502;
        throw error;
      }
    }
  }

  if (!response.ok) {
    const error = new Error(`Falha na API do StreamElements (HTTP ${response.status}).`);
    error.statusCode = 502;
    throw error;
  }
  return payload;
}

async function getChannelId() {
  if (channelCache.id && Date.now() < channelCache.expiresAt) return channelCache.id;
  if (channelIdRequest) return channelIdRequest;

  channelIdRequest = (async () => {
    const channel = await seFetch('/channels/me');
    const id = channel?._id || channel?.id || channel?.channel?._id;
    if (!id) {
      const error = new Error('Não foi possível obter o ID do canal no StreamElements.');
      error.statusCode = 502;
      throw error;
    }
    channelCache = { id: String(id), expiresAt: Date.now() + CHANNEL_CACHE_TTL };
    return channelCache.id;
  })();

  try { return await channelIdRequest; } finally { channelIdRequest = null; }
}

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function subscriberUsername(subscriber) {
  if (!subscriber || typeof subscriber !== 'object') return '';
  return (subscriber.username || subscriber.userName || subscriber.name || subscriber.displayName || subscriber.user?.username || subscriber.user?.userName || subscriber.user?.name || subscriber.user?.displayName || '');
}

function subscriberIsActive(subscriber) {
  if (!subscriber || typeof subscriber !== 'object') return false;
  if (subscriber.active === false || subscriber.isActive === false || subscriber.subscribed === false || subscriber.isSubscriber === false) return false;
  const status = String(subscriber.status || subscriber.subscription?.status || subscriber.subscriptionStatus || '').toLowerCase();
  const inactiveStatuses = new Set(['inactive', 'expired', 'ended', 'cancelled', 'canceled', 'revoked', 'unsubscribed']);
  return !inactiveStatuses.has(status);
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const nestedData = payload.data && typeof payload.data === 'object' ? payload.data : null;
  const candidates = [payload.docs, payload.subscribers, payload.results, payload.items, payload.data, payload.users, nestedData?.docs, nestedData?.subscribers, nestedData?.results, nestedData?.items, nestedData?.users];
  return candidates.find(Array.isArray) || [];
}

function extractTotal(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [payload.total, payload.totalDocs, payload.total_count, payload.count];
  for (const value of candidates) {
    const total = Number(value);
    if (Number.isFinite(total) && total >= 0) return total;
  }
  return null;
}

async function checkSubscriber(channelId, requestedUsername) {
  let offset = 0;
  for (let page = 0; page < SUBSCRIBERS_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(SUBSCRIBERS_PAGE_SIZE), offset: String(offset) });
    const payload = await seFetch(`/subscribers/${encodeURIComponent(channelId)}?${params.toString()}`);
    const rows = extractRows(payload);

    const match = rows.find((subscriber) => {
      const username = normalizeUsername(subscriberUsername(subscriber));
      return username === requestedUsername && subscriberIsActive(subscriber);
    });

    if (match) return { username: subscriberUsername(match), displayName: match.displayName || match.user?.displayName || null };

    if (!rows.length || rows.length < SUBSCRIBERS_PAGE_SIZE) break;
    offset += rows.length;
    const total = extractTotal(payload);
    if (total !== null && offset >= total) break;
  }
  return null;
}

// ==========================================
// FIM DAS CONFIGURAÇÕES DA STREAMELEMENTS
// ==========================================

const DEFAULT_SETUP = [
  { id: 'pc', titulo: '💻 PC Gamer', accent: 'blue', tipo: 'real', itens: [
    { ic:'🧠', cat:'Processador',    nome:'Ryzen 9 5900X',               ano:2023, nota:10, comentario:'Monstro pra jogos e streaming.', benchmark:'Temp: 65°C | FPS: 144+ (Warzone)' },
    { ic:'🎮', cat:'Placa de Vídeo', nome:'RTX 3060 12GB Branca',        ano:2023, nota:9,  comentario:'Linda e roda tudo liso.', benchmark:'Temp: 70°C | FPS: 120 (Fortnite)' },
    { ic:'🧩', cat:'Memória RAM',    nome:'48GB de RAM',                 ano:2023, nota:9,  comentario:'Sobra RAM pra jogar e streamar.' },
    { ic:'🔌', cat:'Placa Mãe',      nome:'X570 TUF Gaming',             ano:2023, nota:8,  comentario:'Ótima construção e dissipação.' },
    { ic:'🗄️', cat:'Gabinete',       nome:'Risemode Aquarium Branco',    ano:2023, nota:8,  comentario:'Visual limpo e airflow top.' },
    { ic:'💧', cat:'Water Cooler',   nome:'Risemode Aura RGB',           ano:2023, nota:7,  comentario:'Mantém a temperatura baixa.' },
    { ic:'💾', cat:'Armazenamento',  nome:'SSD 2TB NVMe M.2',            ano:2024, nota:9,  comentario:'Leitura rápida, carrega em segundos.' },
    { ic:'⚡', cat:'Fonte',          nome:'Corsair RM800W',              ano:2023, nota:9,  comentario:'80 Plus Gold, silenciosa.' }
  ]},
  { id: 'per', titulo: '🖱️ Periféricos', accent: 'pink', tipo: 'real', itens: [
    { ic:'⌨️', cat:'Teclado',    nome:'Logitech G PRO X TKL Branco',     ano:2023, nota:10, comentario:'Switch top, ótimo pra jogar.' },
    { ic:'🖱️', cat:'Mouse',      nome:'Logitech G502 X Superlight RGB',  ano:2024, nota:10, comentario:'Leve, preciso e TOP.' },
    { ic:'🎧', cat:'Headset',    nome:'Astro A30',                       ano:2023, nota:9,  comentario:'Áudio excelente.' },
    { ic:'🎙️', cat:'Microfone',  nome:'FIFINE AM8 Branco',               ano:2024, nota:8,  comentario:'Ganho bom e bonito.' },
    { ic:'🖥️', cat:'Monitor',    nome:'AOC 240Hz',                       ano:2023, nota:9,  comentario:'240Hz faz MUITA diferença.' },
    { ic:'📷', cat:'Webcam',     nome:'iPhone 11',                       ano:2023, nota:8,  comentario:'Usando como webcam, qualidade ótima.' }
  ]},
  { id: 'extra', titulo: '🪑 Mesa & Cadeira', accent: 'cyan', tipo: 'real', itens: [
    { ic:'🪑', cat:'Cadeira', nome:'XT Racer', ano:2023, nota:8, comentario:'Confortável pra longas lives.' }
  ]}
];

const DEFAULT_SONHOS = [
  { id: 'sony-zv-e10', icon: '🎥', cat: 'Câmera profissional', nome: 'Sony ZV-E10', descricao: 'Pra dar um upgrade monstro no visual da live.', meta: 3500, arrecadado: 0, contribuintes: [] },
  { id: 'shure-sm7b', icon: '🎤', cat: 'Microfone pro', nome: 'Shure SM7B', descricao: 'O sonho de todo streamer, mas precisa de interface.', meta: 4200, arrecadado: 0, contribuintes: [] }
];

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

function safeStr(v, max = 1000) { return String(v == null ? '' : v).trim().slice(0, max); }

function sanitizarAviso(a) {
  if (!a || typeof a !== 'object') return null;
  return { ativo: !!a.ativo, tipo: a.tipo === 'warn' ? 'warn' : 'info', icone: safeStr(a.icone, 8) || '📢', titulo: safeStr(a.titulo, 120) || 'Aviso', texto: safeStr(a.texto, 1000) };
}

function sanitizarLista(list, campos, max) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, max).map(item => {
    if (!item || typeof item !== 'object') return null;
    const safe = {};
    for (const c of campos) { safe[c] = item[c] != null ? safeStr(item[c], 80) : null; }
    return safe.nome ? safe : null;
  }).filter(Boolean);
}

function calcularTopApoiadores(sonhos) {
  if (!Array.isArray(sonhos)) return [];
  const porPessoa = {};
  sonhos.forEach(s => {
    (s.contribuintes || []).forEach(c => {
      const nome = safeStr(c.nome, 40);
      if (!nome) return;
      if (!porPessoa[nome]) porPessoa[nome] = { nome, total: 0, sonhos: [] };
      porPessoa[nome].total += Number(c.valor) || 0;
      if (!porPessoa[nome].sonhos.includes(s.nome)) porPessoa[nome].sonhos.push(s.nome);
    });
  });
  return Object.values(porPessoa).sort((a, b) => b.total - a.total).slice(0, 3).map(p => ({ nome: p.nome, total: p.total, sonhos: p.sonhos }));
}

let twitchCache = { token: null, exp: 0 };
async function twitchToken() {
  if (twitchCache.token && Date.now() < twitchCache.exp) return twitchCache.token;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Twitch token fail');
  twitchCache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return twitchCache.token;
}

async function twitchSeguidores() {
  if (!TWITCH_ID || !TWITCH_SECRET) return null;
  try {
    const token = await twitchToken();
    const headers = { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` };
    const u = await (await fetch('https://api.twitch.tv/helix/users?login=asemtet0', { headers })).json();
    const id = u?.data?.[0]?.id;
    if (!id) return null;
    const f = await (await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${id}&first=1`, { headers })).json();
    return typeof f.total === 'number' ? f.total : null;
  } catch(e) { return null; }
}

async function streamElementsBuscar() {
  if (!STREAMELEMENTS_JWT) return null;
  try {
    const h = { Authorization: `Bearer ${STREAMELEMENTS_JWT}`, Accept: 'application/json' };
    const me = await (await fetch('https://api.streamelements.com/kappa/v2/channels/me', { headers: h })).json();
    const cid = me?._id;
    if (!cid) return null;
    const subs = await (await fetch(`https://api.streamelements.com/kappa/v2/subscribers/${cid}?limit=1`, { headers: h })).json();
    const totalSubs = typeof subs?.total === 'number' ? subs.total : 0;
    const tips = await (await fetch(`https://api.streamelements.com/kappa/v2/tips/${cid}?limit=100`, { headers: h })).json();
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    let totalDoacoes = 0;
    (tips?.docs || []).forEach(t => {
      if (new Date(t.createdAt).getTime() >= inicioMes.getTime()) {
        totalDoacoes += Number(t.donation?.amount || t.amount) || 0;
      }
    });
    return { totalSubs, totalDoacoes };
  } catch(e) { return null; }
}

// ---------- Twitch: id do canal, avatares e emotes ----------
async function twitchHeaders() {
  const token = await twitchToken();
  return { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` };
}

async function twitchUserId(login) {
  const headers = await twitchHeaders();
  const u = await (await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers })).json();
  return u?.data?.[0]?.id || null;
}

// { login_minusculo: url_da_foto } — só acha quem tem o mesmo nome da Twitch
async function twitchAvatares(nomes) {
  if (!TWITCH_ID || !TWITCH_SECRET) return {};
  const logins = [...new Set(nomes.map(n => String(n).toLowerCase().replace(/^@/, '')).filter(n => /^[a-z0-9_]{3,25}$/.test(n)))].slice(0, 100);
  if (!logins.length) return {};
  try {
    const headers = await twitchHeaders();
    const d = await (await fetch('https://api.twitch.tv/helix/users?' + logins.map(l => `login=${l}`).join('&'), { headers })).json();
    const out = {};
    (d?.data || []).forEach(u => { out[String(u.login).toLowerCase()] = u.profile_image_url; });
    return out;
  } catch (e) { return {}; }
}

async function twitchEmotes() {
  if (!TWITCH_ID || !TWITCH_SECRET) return [];
  try {
    const headers = await twitchHeaders();
    const id = await twitchUserId(CANAL);
    if (!id) return [];
    const d = await (await fetch(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${id}`, { headers })).json();
    return (d?.data || []).map(e => {
      const base = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(e.id)}`;
      return {
        id: e.id,
        nome: e.name,
        url: `${base}/default/dark/3.0`,                                   // 112x112
        animada: Array.isArray(e.format) && e.format.includes('animated') ? `${base}/animated/dark/3.0` : null
      };
    });
  } catch (e) { return []; }
}

// ---------- StreamElements: ranking de doadores 100% automático ----------
async function seTodasAsGorjetas(h, cid, paginas = 5) {
  const tips = [];
  for (let p = 0; p < paginas; p++) {
    const r = await fetch(`https://api.streamelements.com/kappa/v2/tips/${cid}?limit=100&offset=${p * 100}&sort=-createdAt`, { headers: h });
    if (!r.ok) break;
    const d = await r.json();
    const docs = Array.isArray(d?.docs) ? d.docs : [];
    tips.push(...docs);
    if (docs.length < 100) break;
  }
  return tips;
}

async function hallStreamElements() {
  if (!STREAMELEMENTS_JWT) return null;
  const h = { Authorization: `Bearer ${STREAMELEMENTS_JWT}`, Accept: 'application/json' };
  try {
    const me = await (await fetch('https://api.streamelements.com/kappa/v2/channels/me', { headers: h })).json();
    const cid = me?._id;
    if (!cid) return null;

    const tips = await seTodasAsGorjetas(h, cid);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const RUINS = ['failed', 'rejected', 'refunded', 'chargeback', 'cancelled', 'canceled'];

    const porPessoa = {};
    let totalMes = 0, ultimo = null;
    tips.forEach(t => {
      if (t.status && RUINS.includes(String(t.status).toLowerCase())) return;
      const valor = Number(t.donation?.amount ?? t.amount) || 0;
      if (valor <= 0) return;
      const nome = safeStr(t.donation?.user?.username || t.username || 'Anônimo', 40);
      const chave = nome.toLowerCase();
      const quando = new Date(t.createdAt || t.updatedAt || 0).getTime();
      if (!porPessoa[chave]) porPessoa[chave] = { nome, total: 0, ultima: 0 };
      porPessoa[chave].total += valor;
      porPessoa[chave].ultima = Math.max(porPessoa[chave].ultima, quando);
      if (quando >= inicioMes.getTime()) totalMes += valor;
      if (!ultimo || quando > ultimo.em) ultimo = { nome, valor, em: quando };
    });

    const ranking = Object.values(porPessoa).sort((a, b) => b.total - a.total).slice(0, 10);
    const fotos = await twitchAvatares(ranking.map(r => r.nome));
    const doadores = ranking.map(r => ({
      nome: r.nome,
      total: Math.round(r.total * 100) / 100,
      avatar: fotos[r.nome.toLowerCase().replace(/^@/, '')] || null
    }));

    return {
      vazio: !doadores.length,
      doadores, gift: [], fieis: [],
      totalMes: Math.round(totalMes * 100) / 100,
      apoiadores: Object.keys(porPessoa).length,
      ultimo
    };
  } catch (e) {
    return null;
  }
}

async function salvarHallCache(dados) {
  try {
    await redis([
      ['SET', HALL_CACHE_KEY, JSON.stringify(dados), 'EX', String(60 * 60 * 24)],
      ['SET', HALL_CACHE_TS_KEY, String(Date.now()), 'EX', String(60 * 60 * 24)]
    ]);
  } catch(e) {}
}

async function lerHallCache() {
  try {
    const [raw, ts] = await redis([['GET', HALL_CACHE_KEY], ['GET', HALL_CACHE_TS_KEY]]);
    if (!raw) return null;
    return { dados: JSON.parse(raw), ts: Number(ts) || 0 };
  } catch(e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  if (!URL_ || !TOKEN) return res.status(200).json({});

  const action = req.query?.action || '';

  try {
    // ===== SETUP =====
    if (action === 'setup') {
      const [setupRaw, sonhosRaw] = await redis([['GET', 'setup:data'], ['GET', 'setup:sonhos']]);
      let setup = DEFAULT_SETUP, sonhos = DEFAULT_SONHOS;
      try { if (setupRaw) setup = JSON.parse(setupRaw); } catch(e) {}
      try { if (sonhosRaw) sonhos = JSON.parse(sonhosRaw); } catch(e) {}
      return res.status(200).json({ setup, sonhos });
    }

    // ===== EMOTES DO CANAL (Twitch Helix, cacheado) =====
    if (action === 'emotes') {
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      try {
        const [cached] = await redis([['GET', EMOTES_CACHE_KEY]]);
        if (cached) return res.status(200).json({ emotes: JSON.parse(cached) });
      } catch (e) {}
      const emotes = await twitchEmotes();
      if (emotes.length) { try { await redis([['SET', EMOTES_CACHE_KEY, JSON.stringify(emotes), 'EX', String(EMOTES_CACHE_TTL)]]); } catch (e) {} }
      return res.status(200).json({ emotes });
    }

    if (action === 'apoiadores') {
      const [sonhosRaw] = await redis([['GET', 'setup:sonhos']]);
      let sonhos = []; try { sonhos = sonhosRaw ? JSON.parse(sonhosRaw) : DEFAULT_SONHOS; } catch(e) {}
      return res.status(200).json({ top: calcularTopApoiadores(sonhos) });
    }

    if (action === 'metas') {
      const [metasRaw, sonhosRaw] = await redis([['GET', 'config:metas'], ['GET', 'setup:sonhos']]);
      let metas = null, sonhos = [];
      try { metas = metasRaw ? JSON.parse(metasRaw) : null; } catch(e) {}
      try { sonhos = sonhosRaw ? JSON.parse(sonhosRaw) : []; } catch(e) {}
      
      if (!metas) metas = { seguidores: { ativo: false, meta: 0 }, subs: { ativo: false, meta: 0 }, doacoes: { ativo: false, meta: 0 }, bits: { ativo: false, meta: 0 } };
      
      const out = { ...metas, valores: {} };
      if (metas.seguidores?.ativo) out.valores.seguidores = await twitchSeguidores();
      
      let se = null;
      if (metas.subs?.plataforma === 'streamelements' || metas.doacoes?.plataforma === 'streamelements') se = await streamElementsBuscar();
      
      if (metas.subs?.ativo) out.valores.subs = (metas.subs.plataforma === 'streamelements' && se) ? se.totalSubs : (Number(metas.subs.atualManual) || 0);
      if (metas.doacoes?.ativo) out.valores.doacoes = (metas.doacoes.plataforma === 'streamelements' && se) ? se.totalDoacoes : (Number(metas.doacoes.atualManual) || 0);
      
      return res.status(200).json(out);
    }

    if (action === 'hall') {
      const cache = await lerHallCache();
      const agora = Date.now();
      const idade = cache ? (agora - cache.ts) / 1000 : Infinity;

      if (!STREAMELEMENTS_JWT) return res.status(200).json({ vazio: true, doadores: [], updatedAt: null });

      if (cache && idade < HALL_CACHE_TTL) return res.status(200).json({ ...cache.dados, updatedAt: cache.ts });

      const dados = await hallStreamElements();
      if (dados) { await salvarHallCache(dados); return res.status(200).json({ ...dados, updatedAt: Date.now() }); }
      if (cache) return res.status(200).json({ ...cache.dados, updatedAt: cache.ts });
      return res.status(200).json({ vazio: true, doadores: [], updatedAt: null });
    }

    if (action === 'status-perfil') {
      try {
        const token = await twitchToken();
        const u = await (await fetch(`https://api.twitch.tv/helix/users?login=asemtet0`, { headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` } })).json();
        const id = u?.data?.[0]?.id;
        if (!id) return res.status(200).json({ online: false });
        const s = await (await fetch(`https://api.twitch.tv/helix/streams?user_id=${id}`, { headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` } })).json();
        return res.status(200).json({ online: Array.isArray(s?.data) && s.data.length > 0 });
      } catch(e) { return res.status(200).json({ online: false }); }
    }

    // ==========================================
    // NOVAS ROTAS DA STREAMELEMENTS (MERGED)
    // ==========================================
    const validActions = new Set(['issub', 'ranking-pontos', 'atividades', 'channel-info']);
    if (validActions.has(action)) {
      const requestedUsername = action === 'issub' ? normalizeUsername(req.query?.user) : '';
      if (action === 'issub' && !requestedUsername) {
        return res.status(400).json({ error: 'Informe o usuário na query: ?action=issub&user=NOME_DO_USUARIO.' });
      }

      const channelId = await getChannelId();

      if (action === 'issub') {
        const subscriber = await checkSubscriber(channelId, requestedUsername);
        return res.status(200).json({ user: requestedUsername, isSub: Boolean(subscriber), active: Boolean(subscriber), subscriber });
      }
      if (action === 'ranking-pontos') {
        const ranking = await seFetch(`/points/${encodeURIComponent(channelId)}/top?limit=10&offset=0`);
        return res.status(200).json({ ranking });
      }
      if (action === 'atividades') {
        const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || 25)));
        const offset = Math.min(100000, Math.max(0, parseInt(req.query?.offset || 0)));
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        const activities = await seFetch(`/activities/${encodeURIComponent(channelId)}?${params.toString()}`);
        return res.status(200).json({ atividades: activities });
      }
      if (action === 'channel-info') {
        const channel = await seFetch(`/channels/${encodeURIComponent(channelId)}/details`);
        return res.status(200).json({ channel });
      }
    }
    // ==========================================
    // FIM DAS NOVAS ROTAS
    // ==========================================

    const [avisoRaw, donateRaw, manutRaw, recadoRaw, horasRaw, updatedRaw, top3Raw, hallRaw, votosFechRaw] = await redis([
      ['GET', 'config:aviso'], ['GET', 'config:donate'], ['GET', 'config:manutencao'], ['GET', 'config:recado'],
      ['GET', 'config:horasMes'], ['GET', 'config:updatedAt'], ['GET', 'config:top3'], ['GET', 'config:hall'], ['GET', 'config:votosFechamento']
    ]);

    let aviso = null, top3 = [], hall = [];
    try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch (e) {}
    try { top3 = top3Raw ? JSON.parse(top3Raw) : []; } catch (e) {}
    try { hall = hallRaw ? JSON.parse(hallRaw) : []; } catch (e) {}
    const donate = safeStr(donateRaw, 500);

    return res.status(200).json({
      aviso: sanitizarAviso(aviso), donate: /^https?:\/\//i.test(donate) ? donate : null,
      manutencao: manutRaw === '1', recado: safeStr(recadoRaw, 500), horasMes: safeStr(horasRaw, 30),
      updatedAt: safeStr(updatedRaw, 40) || null, top3: sanitizarLista(top3, ['nome', 'valor'], 3),
      hall: sanitizarLista(hall, ['nome', 'meta'], 5), votosFechamento: safeStr(votosFechRaw, 40) || null
    });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 502;
    return res.status(statusCode).json({ error: e?.message || 'Erro inesperado no config.' });
  }
}