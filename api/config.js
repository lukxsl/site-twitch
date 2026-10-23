// Vercel serverless: /api/config.js

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const STREAMELEMENTS_JWT = (process.env.STREAMELEMENTS_JWT || '').trim();

// Cache atualizado para v13 (Força a buscar dados novos)
const HALL_CACHE_KEY = 'cache:hall_v13';
const HALL_CACHE_TS_KEY = 'cache:hall_at_v13';
const HALL_CACHE_TTL = 15 * 60;

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

/* ============ HALL DA FAMA (v13 - Usando Leaderboard Oficial) ============ */
async function hallStreamElements() {
  if (!STREAMELEMENTS_JWT) return null;
  
  const h = { Authorization: `Bearer ${STREAMELEMENTS_JWT}`, Accept: 'application/json' };
  const me = await (await fetch('https://api.streamelements.com/kappa/v2/channels/me', { headers: h })).json().catch(() => null);
  const cid = me?._id;
  if (!cid) return null;

  try {
    // Puxa o ranking histórico de verdade
    const lbResp = await fetch(`https://api.streamelements.com/kappa/v2/leaderboard/${cid}/tips?limit=10`, { headers: h });
    if (!lbResp.ok) throw new Error('Falha no leaderboard');
    const lbData = await lbResp.json();

    // A API pode retornar como Array ou dentro de um objeto (users/docs)
    const lista = Array.isArray(lbData) ? lbData : (lbData.users || lbData.docs || []);

    const doadoresRanking = lista.map(t => ({
      nome: t.username || t.user?.username || t.donation?.user?.username || 'Anônimo',
      total: Number(t.amount || t.points || t.donation?.amount) || 0,
      avatar: null
    }))
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

    return {
      vazio: !doadoresRanking.length,
      gift: [],
      fieis: [],
      doadores: doadoresRanking
    };
  } catch (e) {
    console.error('Erro ao buscar leaderboard:', e);
    return { vazio: true, doadores: [], gift: [], fieis: [] };
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
    if (action === 'debug-hall') {
      const h = { Authorization: `Bearer ${STREAMELEMENTS_JWT}`, Accept: 'application/json' };
      const me = await (await fetch('https://api.streamelements.com/kappa/v2/channels/me', { headers: h })).json();
      const cid = me?._id;
      const lbRaw = await (await fetch(`https://api.streamelements.com/kappa/v2/leaderboard/${cid}/tips?limit=10`, { headers: h })).json().catch(e => e.message);
      
      return res.status(200).json({ cid, lbRaw });
    }

    if (action === 'apoiadores') {
      const [sonhosRaw] = await redis([['GET', 'setup:sonhos']]);
      let sonhos = []; try { sonhos = sonhosRaw ? JSON.parse(sonhosRaw) : []; } catch(e) {}
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

      if (cache) {
        (async () => { try { const n = await hallStreamElements(); if(n) await salvarHallCache(n); } catch(e){} })();
        return res.status(200).json({ ...cache.dados, updatedAt: cache.ts });
      }

      const dados = await hallStreamElements();
      if (dados) { await salvarHallCache(dados); return res.status(200).json({ ...dados, updatedAt: Date.now() }); }
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
    return res.status(200).json({});
  }
}