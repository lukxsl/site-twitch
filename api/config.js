// Vercel serverless: /api/config.js
import { seGet, canalId, temJwt, rankingPontos, statsChat, rankingDoadores, resumoSubs } from './_lib/se.js';
import { rateLimit, ipDe, validarSessao, cargoDe } from './_lib/core.js';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;

const CANAL = 'asemtet0';
const HALL_CACHE_KEY = 'cache:hall_v17';
const HALL_CACHE_TS_KEY = 'cache:hall_at_v17';
const HALL_CACHE_TTL = 2 * 60;            // doadores: atualiza no máx. a cada 2 min
const EMOTES_CACHE_KEY = 'cache:emotes_v1';
const EMOTES_CACHE_TTL = 6 * 60 * 60;     // emotes quase nunca mudam

// ==========================================
// CONFIGURAÇÕES DA STREAMELEMENTS (NOVAS)
// ==========================================
const SE_BASE_URL = 'https://api.streamelements.com/kappa/v2';
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
  if (!temJwt()) return null;
  try {
    const [subs, doa] = await Promise.all([resumoSubs(), rankingDoadores()]);
    return { totalSubs: subs.total, totalDoacoes: doa.totalMes };
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

// ---------- StreamElements: doadores (gorjetas) ----------
function numeroManual(valor){
  const texto = String(valor || '').replace(/R\$/gi, '').replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(texto);
  return Number.isFinite(n) ? n : 0;
}
async function hallManual(){
  try{
    const [topRaw, hallRaw] = await redis([['GET', 'config:top3'], ['GET', 'config:hall']]);
    let top = [], listaHall = [];
    try { top = topRaw ? JSON.parse(topRaw) : []; } catch(e) {}
    try { listaHall = hallRaw ? JSON.parse(hallRaw) : []; } catch(e) {}
    const base = Array.isArray(top) && top.length ? top : listaHall;
    const doadores = (Array.isArray(base) ? base : []).slice(0, 5).map((item, i) => {
      const nome = safeStr(item?.nome, 40);
      const rotulo = safeStr(item?.valor || item?.meta, 60) || 'Apoiador';
      return { pos: i + 1, nome, avatar: null, total: numeroManual(rotulo), valor: numeroManual(rotulo), valorTexto: rotulo, doacoes: 0, maior: 0, ultima: null };
    }).filter(item => item.nome);
    return {
      vazio: !doadores.length, doadores, gift: [], fieis: [], totalMes: 0, totalGeral: 0,
      apoiadores: doadores.length, doacoes: 0, moeda: 'BRL', ultimo: null, fonte: 'Manual'
    };
  }catch(error){
    console.warn('[Hall] Não foi possível ler o Top de apoiadores manual:', error?.message || error);
    return null;
  }
}
let hallErro = null;
async function hallStreamElements() {
  // Sem JWT ainda tentamos o ranking público; se falhar, cai na lista manual abaixo.
  try {
    const r = await rankingDoadores();
    const fotos = await twitchAvatares(r.lista.slice(0, 100).map(x => x.nome));
    const doadores = r.lista.map(x => ({ ...x, total: x.valor, moeda: x.moeda || r.moeda || 'BRL', avatar: fotos[x.nome.toLowerCase()] || null }));
    hallErro = null;
    return {
      vazio: !doadores.length, doadores, gift: [], fieis: [],
      totalMes: r.totalMes, totalGeral: r.totalGeral, apoiadores: r.apoiadores,
      doacoes: r.doacoes, moeda: r.moeda, ultimo: r.ultimo, fonte: 'StreamElements'
    };
  } catch (error) {
    hallErro = error?.message || 'Falha ao consultar o StreamElements.';
    if (!temJwt()) hallErro = 'STREAMELEMENTS_JWT não configurada no servidor. ' + hallErro;
    console.error('[Hall] Falha ao consultar doadores no StreamElements:', hallErro);
    const manual = await hallManual();
    return manual ? { ...manual, aviso: 'Não foi possível atualizar os apoiadores automaticamente. Exibindo a lista configurada pela equipe.', motivo: hallErro } : null;
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
      const idade = cache ? (Date.now() - cache.ts) / 1000 : Infinity;
      const forcar = req.query?.refresh === '1';
      const ip = ipDe(req);
      if (!(await rateLimit(`ratelimit:hall:${ip}`, 20, 60, true))) {
        if (cache) return res.status(200).json({ ...cache.dados, updatedAt: cache.ts, desatualizado: true });
        return res.status(429).json({ error: 'Muitas consultas ao ranking. Aguarde um pouco.' });
      }
      if (forcar) {
        const sessao = await validarSessao(req);
        const cargo = sessao?.id ? await cargoDe(sessao.id, sessao.email || '') : null;
        if (!cargo) return res.status(403).json({ error: 'Somente a equipe pode atualizar o ranking manualmente.' });
        if (!(await rateLimit(`ratelimit:hall-refresh:${sessao.id}`, 1, 60, true))) {
          if (cache) return res.status(200).json({ ...cache.dados, updatedAt: cache.ts, desatualizado: true });
          return res.status(429).json({ error: 'Aguarde um minuto para atualizar novamente.' });
        }
      }
      if (cache && idade < HALL_CACHE_TTL && !forcar) return res.status(200).json({ ...cache.dados, updatedAt: cache.ts });
      const dados = await hallStreamElements();
      if (dados) { await salvarHallCache(dados); return res.status(200).json({ ...dados, updatedAt: Date.now() }); }
      if (cache) return res.status(200).json({ ...cache.dados, updatedAt: cache.ts, desatualizado: true });
      return res.status(200).json({ vazio: true, doadores: [], updatedAt: null, erro: hallErro || 'Não foi possível consultar o ranking de doadores no StreamElements.' });
    }

    // ===== RANKING UNIFICADO DO STREAMELEMENTS =====
    // ?action=ranking-se&modo=pontos|acumulados|horas|chat|doadores
    if (action === 'ranking-se') {
      const modo = String(req.query?.modo || 'pontos');
      const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit || '100', 10) || 100));
      try {
        let out;
        if (modo === 'doadores') {
          const cache = await lerHallCache();
          let d = (cache && (Date.now() - cache.ts) / 1000 < HALL_CACHE_TTL) ? cache.dados : null;
          // O cache é livre para leitura; somente uma consulta que precisa falar
          // com o StreamElements consome o limite por IP.
          if (!d && !(await rateLimit(`ratelimit:se-doadores:${ipDe(req)}`, 12, 60, true))) {
            if (cache) d = cache.dados;
            else return res.status(429).json({ ok: false, modo, lista: [], total: 0, erro: 'Muitas consultas ao ranking de doadores. Aguarde um minuto.' });
          }
          if (!d) { d = await hallStreamElements(); if (d) await salvarHallCache(d); else if (cache) d = cache.dados; }
          if (!d) throw Object.assign(new Error(hallErro || 'Não foi possível consultar os doadores.'), { statusCode: 502 });
          out = { modo, fonte: d.fonte || 'StreamElements', total: d.apoiadores, lista: d.doadores.slice(0, limit).map(x => ({ pos: x.pos, nome: x.nome, avatar: x.avatar, valor: x.valor, moeda: x.moeda || d.moeda || 'BRL', valorLabel: x.valorTexto || null, doacoes: x.doacoes, maior: x.maior, ultima: x.ultima })),
                  resumo: { totalMes: d.totalMes, totalGeral: d.totalGeral, doacoes: d.doacoes, moeda: d.moeda, ultimo: d.ultimo } };
        } else if (modo === 'chat') {
          const c = await statsChat(limit);
          out = { modo, total: c.lista.length, lista: c.lista, resumo: { mensagens: c.total, emotes: c.emotes } };
        } else if (['pontos', 'acumulados', 'horas'].includes(modo)) {
          const offset = Math.min(100000, Math.max(0, parseInt(req.query?.offset || '0', 10) || 0));
          const r = await rankingPontos(modo, limit, offset);
          out = { modo, total: r.total, lista: r.lista };
        } else {
          return res.status(400).json({ error: 'Modo inválido.' });
        }
        // fotos da Twitch (só quem ainda não tem)
        const semFoto = out.lista.filter(x => !x.avatar);
        if (semFoto.length) {
          const fotos = await twitchAvatares(semFoto.map(x => x.nome));
          semFoto.forEach(x => { x.avatar = fotos[String(x.nome).toLowerCase()] || null; });
        }
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).json({ ok: true, ...out, updatedAt: Date.now() });
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