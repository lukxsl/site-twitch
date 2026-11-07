// Vercel serverless: /api/config.js
import { seGet, canalId, temJwt, rankingPontos, statsChat, resumoSubs } from './_lib/se.js';
import { rateLimit, ipDe } from './_lib/core.js';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;

const CANAL = 'asemtet0';
// Ranking (horas, pontos, chat): mesma ideia — se o StreamElements cair, o site
// mostra a última resposta boa salva no Redis em vez de uma tela de erro.
const RANK_CACHE_PREFIX = 'cache:rank_v2:';
const RANK_CACHE_FRESCO = 30;             // segundos em que a resposta é reaproveitada
const RANK_CACHE_EX = 7 * 24 * 60 * 60;
const EMOTES_CACHE_KEY = 'cache:emotes_v1';
const EMOTES_CACHE_TTL = 6 * 60 * 60;     // emotes quase nunca mudam

// ==========================================
// CONFIGURAÇÕES DA STREAMELEMENTS (NOVAS)
// ==========================================
const SUBSCRIBERS_PAGE_SIZE = 100;
const SUBSCRIBERS_MAX_PAGES = 20; // Até 2.000 registros

const seFetch = (endpoint) => seGet(endpoint);
const getChannelId = canalId;

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
  if (!temJwt()) return null;
  try {
    const subs = await resumoSubs();
    return { totalSubs: subs.total };
  } catch (e) { return null; }
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

// ---------- cache resiliente do ranking (horas, pontos, chat) ----------
async function salvarRankCache(modo, payload) {
  try {
    await redis([['SET', RANK_CACHE_PREFIX + modo, JSON.stringify({ at: Date.now(), payload }), 'EX', String(RANK_CACHE_EX)]]);
  } catch (e) {}
}

async function lerRankCache(modo) {
  try {
    const [raw] = await redis([['GET', RANK_CACHE_PREFIX + modo]]);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.payload?.lista) || !d.payload.lista.length) return null;
    return { payload: d.payload, at: Number(d.at) || 0 };
  } catch (e) { return null; }
}

/**
 * Tenta buscar no StreamElements. Se a resposta vier vazia ou a chamada falhar,
 * devolve a última resposta boa salva no Redis (até 7 dias) marcada com
 * `desatualizado: true`, para a tela avisar "Atualizado há X".
 */
async function comCacheRank(modo, buscar) {
  const cache = await lerRankCache(modo);
  if (cache && (Date.now() - cache.at) / 1000 < RANK_CACHE_FRESCO) {
    return { ...cache.payload, desatualizado: false, updatedAt: cache.at };
  }
  try {
    const out = await buscar();
    if (out && Array.isArray(out.lista) && out.lista.length) {
      await salvarRankCache(modo, out);
      return { ...out, desatualizado: false, updatedAt: Date.now() };
    }
    if (cache) return { ...cache.payload, desatualizado: true, updatedAt: cache.at };
    return { ...out, desatualizado: false, updatedAt: Date.now() };
  } catch (e) {
    if (cache) return { ...cache.payload, desatualizado: true, updatedAt: cache.at };
    throw e;
  }
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
      if (metas.subs?.plataforma === 'streamelements') se = await streamElementsBuscar();

      if (metas.subs?.ativo) out.valores.subs = (metas.subs.plataforma === 'streamelements' && se) ? se.totalSubs : (Number(metas.subs.atualManual) || 0);
      if (metas.doacoes?.ativo) out.valores.doacoes = Number(metas.doacoes.atualManual) || 0;

      return res.status(200).json(out);
    }

    // ===== RANKING UNIFICADO DO STREAMELEMENTS =====
    // ?action=ranking-se&modo=pontos|acumulados|horas|chat
    if (action === 'ranking-se') {
      const modo = String(req.query?.modo || 'pontos');
      const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || '100', 10) || 100));
      try {
        // Fotos da Twitch: só de quem ainda não tem (e já ficam salvas no cache).
        const comFotos = async (lista) => {
          const semFoto = (lista || []).filter(x => !x.avatar);
          if (semFoto.length) {
            const fotos = await twitchAvatares(semFoto.map(x => x.nome));
            semFoto.forEach(x => { if (!x.avatar) x.avatar = fotos[String(x.nome).toLowerCase()] || null; });
          }
          return lista;
        };

        let out;
        if (modo === 'chat') {
          out = await comCacheRank('chat', async () => {
            const c = await statsChat(limit);
            return { modo, total: c.lista.length, lista: await comFotos(c.lista), resumo: { mensagens: c.total, emotes: c.emotes } };
          });
        } else if (['pontos', 'acumulados', 'horas'].includes(modo)) {
          const offset = Math.min(100000, Math.max(0, parseInt(req.query?.offset || '0', 10) || 0));
          out = await comCacheRank(`${modo}:${limit}:${offset}`, async () => {
            const r = await rankingPontos(modo, limit, offset);
            return { modo, total: r.total, lista: await comFotos(r.lista) };
          });
        } else {
          return res.status(400).json({ error: 'Modo inválido.' });
        }

        if (out.desatualizado) res.setHeader('Cache-Control', 'no-store');
        else res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ ok: true, ...out, updatedAt: out.updatedAt || Date.now() });
      } catch (e) {
        console.error('[ranking-se]', modo, e?.message || e);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ ok: false, modo, lista: [], total: 0, erro: e?.message || 'Falha ao consultar o StreamElements.', codigo: e?.code || 'erro' });
      }
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
    const validActions = new Set(['issub', 'ranking-pontos', 'ranking-horas', 'atividades', 'channel-info']);
    if (validActions.has(action)) {
      const requestedUsername = action === 'issub' ? normalizeUsername(req.query?.user) : '';
      if (action === 'issub' && !requestedUsername) {
        return res.status(400).json({ error: 'Informe o usuário na query: ?action=issub&user=NOME_DO_USUARIO.' });
      }

      const channelId = await getChannelId();

      if (action === 'issub') {
        if (!/^[a-z0-9_]{3,25}$/.test(requestedUsername)) {
          return res.status(400).json({ error: 'Nome de usuário inválido.' });
        }
        if (!(await rateLimit(`ratelimit:issub:${ipDe(req)}`, 20, 60, true))) {
          return res.status(429).json({ error: 'Muitas consultas. Aguarde um pouco.' });
        }
        const cacheKey = `cache:se:issub:${requestedUsername}`;
        const [cached] = await redis([['GET', cacheKey]]);
        if (cached) {
          const subscriber = JSON.parse(cached);
          return res.status(200).json({ user: requestedUsername, isSub: Boolean(subscriber), active: Boolean(subscriber), subscriber, cached: true });
        }
        const subscriber = await checkSubscriber(channelId, requestedUsername);
        await redis([['SET', cacheKey, JSON.stringify(subscriber), 'EX', '300']]);
        return res.status(200).json({ user: requestedUsername, isSub: Boolean(subscriber), active: Boolean(subscriber), subscriber, cached: false });
      }
      if (action === 'ranking-pontos' || action === 'ranking-horas') {
        const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || '100', 10) || 100));
        const offset = Math.min(100000, Math.max(0, parseInt(req.query?.offset || '0', 10) || 0));
        const r = await rankingPontos(action === 'ranking-horas' ? 'horas' : 'top', limit, offset);
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ ranking: r.lista.map(x => ({ username: x.nome, points: x.pontos, watchtime: x.minutos })), total: r.total });
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

    const [avisoRaw, manutRaw, recadoRaw, horasRaw, updatedRaw, votosFechRaw] = await redis([
      ['GET', 'config:aviso'], ['GET', 'config:manutencao'], ['GET', 'config:recado'],
      ['GET', 'config:horasMes'], ['GET', 'config:updatedAt'], ['GET', 'config:votosFechamento']
    ]);

    let aviso = null;
    try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch (e) {}

    return res.status(200).json({
      aviso: sanitizarAviso(aviso),
      manutencao: manutRaw === '1', recado: safeStr(recadoRaw, 500), horasMes: safeStr(horasRaw, 30),
      updatedAt: safeStr(updatedRaw, 40) || null,
      votosFechamento: safeStr(votosFechRaw, 40) || null
    });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 502;
    return res.status(statusCode).json({ error: e?.message || 'Erro inesperado no config.' });
  }
}