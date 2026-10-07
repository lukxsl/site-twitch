// Vercel serverless: /api/config.js
// GET  → config pública
// GET  ?action=apoiadores → top 3 apoiadores (automático dos sonhos)
// GET  ?action=metas      → metas + valores atuais
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const STREAMLABS_TOKEN = process.env.STREAMLABS_TOKEN || '';
const STREAMELEMENTS_JWT = process.env.STREAMELEMENTS_JWT || '';

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

function safeStr(v, max = 1000) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function sanitizarAviso(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    ativo: !!a.ativo,
    tipo: a.tipo === 'warn' ? 'warn' : 'info',
    icone: safeStr(a.icone, 8) || '📢',
    titulo: safeStr(a.titulo, 120) || 'Aviso',
    texto: safeStr(a.texto, 1000)
  };
}

function sanitizarLista(list, campos, max) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, max).map(item => {
    if (!item || typeof item !== 'object') return null;
    const safe = {};
    for (const c of campos) {
      safe[c] = item[c] != null ? safeStr(item[c], 80) : null;
    }
    return safe.nome ? safe : null;
  }).filter(Boolean);
}

/* ============ Top 3 apoiadores ============ */
function calcularTopApoiadores(sonhos){
  if(!Array.isArray(sonhos)) return [];
  const porPessoa = {};
  sonhos.forEach(s => {
    (s.contribuintes || []).forEach(c => {
      const nome = safeStr(c.nome, 40);
      if(!nome) return;
      if(!porPessoa[nome]) porPessoa[nome] = { nome, total: 0, sonhos: [] };
      porPessoa[nome].total += Number(c.valor) || 0;
      if(!porPessoa[nome].sonhos.includes(s.nome)) porPessoa[nome].sonhos.push(s.nome);
    });
  });
  return Object.values(porPessoa)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(p => ({ nome: p.nome, total: p.total, sonhos: p.sonhos }));
}

/* ============ Twitch: seguidores totais ============ */
let twitchCache = { token: null, exp: 0 };
async function twitchToken(){
  if(twitchCache.token && Date.now() < twitchCache.exp) return twitchCache.token;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' })
  });
  const d = await r.json();
  if(!d.access_token) throw new Error('Twitch token fail');
  twitchCache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return twitchCache.token;
}

async function twitchSeguidores(){
  if(!TWITCH_ID || !TWITCH_SECRET) return null;
  try {
    const token = await twitchToken();
    const headers = { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` };
    const u = await (await fetch('https://api.twitch.tv/helix/users?login=asemtet0', { headers })).json();
    const id = u?.data?.[0]?.id;
    if(!id) return null;
    const f = await (await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${id}&first=1`, { headers })).json();
    return typeof f.total === 'number' ? f.total : null;
  } catch(e){ return null; }
}

/* ============ Streamlabs: subs + doações ============ */
async function streamlabsBuscar(){
  if(!STREAMLABS_TOKEN) return null;
  try {
    const h = { Authorization: `Bearer ${STREAMLABS_TOKEN}`, Accept: 'application/json' };
    const subs = await (await fetch('https://streamlabs.com/api/v2.0/subscriptions?limit=1', { headers: h })).json();
    const totalSubs = Array.isArray(subs?.data) ? subs.data.length : null;

    // donations do mês atual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0,0,0,0);
    const dons = await (await fetch('https://streamlabs.com/api/v2.0/donations?limit=100', { headers: h })).json();
    let totalDoacoes = 0;
    if(Array.isArray(dons?.data)){
      dons.data.forEach(d => {
        const t = new Date(d.created_at).getTime();
        if(t >= inicioMes.getTime()) totalDoacoes += Number(d.amount) || 0;
      });
    }
    return { totalSubs, totalDoacoes };
  } catch(e){ return null; }
}

/* ============ StreamElements: subs + doações ============ */
async function streamElementsBuscar(){
  if(!STREAMELEMENTS_JWT) return null;
  try {
    const h = { Authorization: `Bearer ${STREAMELEMENTS_JWT}`, Accept: 'application/json' };
    // canal (precisa do id do broadcaster — usa o "me" do SE)
    const me = await (await fetch('https://api.streamelements.com/kappa/v2/channels/me', { headers: h })).json();
    const cid = me?._id;
    if(!cid) return null;

    const subs = await (await fetch(`https://api.streamelements.com/kappa/v2/subscribers/${cid}?limit=1`, { headers: h })).json();
    const totalSubs = typeof subs?.total === 'number' ? subs.total : null;

    const tips = await (await fetch(`https://api.streamelements.com/kappa/v2/tips/${cid}?limit=100`, { headers: h })).json();
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0,0,0,0);
    let totalDoacoes = 0;
    (tips?.docs || []).forEach(t => {
      const ts = new Date(t.createdAt).getTime();
      if(ts >= inicioMes.getTime()) totalDoacoes += Number(t.amount) || 0;
    });
    return { totalSubs, totalDoacoes };
  } catch(e){ return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  if (!URL_ || !TOKEN) return res.status(200).json({});

  const action = req.query?.action || '';

  try {
    /* ---------- GET ?action=apoiadores ---------- */
    if(action === 'apoiadores'){
      const [sonhosRaw] = await redis([['GET', 'setup:sonhos']]);
      let sonhos = [];
      try { sonhos = sonhosRaw ? JSON.parse(sonhosRaw) : []; } catch(e){}
      const top = calcularTopApoiadores(sonhos);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
      return res.status(200).json({ top });
    }

    /* ---------- GET ?action=metas ---------- */
    if(action === 'metas'){
      const [metasRaw, sonhosRaw] = await redis([
        ['GET', 'config:metas'],
        ['GET', 'setup:sonhos']
      ]);
      let metas = null, sonhos = [];
      try { metas = metasRaw ? JSON.parse(metasRaw) : null; } catch(e){}
      try { sonhos = sonhosRaw ? JSON.parse(sonhosRaw) : []; } catch(e){}

      if(!metas || typeof metas !== 'object'){
        metas = {
          seguidores: { ativo: false, meta: 0 },
          subs:       { ativo: false, meta: 0, plataforma: 'manual', atualManual: 0 },
          doacoes:    { ativo: false, meta: 0, plataforma: 'manual', atualManual: 0 },
          bits:       { ativo: false, meta: 0, atualManual: 0 }
        };
      }

      const out = { ...metas, valores: {} };

      // Seguidores: Twitch
      if(metas.seguidores?.ativo){
        out.valores.seguidores = await twitchSeguidores();
      }

      // Subs + Doações
      let sl = null, se = null;
      if(metas.subs?.plataforma === 'streamlabs' || metas.doacoes?.plataforma === 'streamlabs'){
        sl = await streamlabsBuscar();
      }
      if(metas.subs?.plataforma === 'streamelements' || metas.doacoes?.plataforma === 'streamelements'){
        se = await streamelementsBuscar();
      }

      if(metas.subs?.ativo){
        if(metas.subs.plataforma === 'streamlabs' && sl) out.valores.subs = sl.totalSubs;
        else if(metas.subs.plataforma === 'streamelements' && se) out.valores.subs = se.totalSubs;
        else out.valores.subs = Number(metas.subs.atualManual) || 0;
      }

      if(metas.doacoes?.ativo){
        if(metas.doacoes.plataforma === 'streamlabs' && sl) out.valores.doacoes = sl.totalDoacoes;
        else if(metas.doacoes.plataforma === 'streamelements' && se) out.valores.doacoes = se.totalDoacoes;
        else if(metas.doacoes.plataforma === 'sonhos'){
          // soma dos apoiadores do mês
          const top = calcularTopApoiadores(sonhos);
          out.valores.doacoes = top.reduce((a,p) => a + p.total, 0);
        } else out.valores.doacoes = Number(metas.doacoes.atualManual) || 0;
      }

      if(metas.bits?.ativo){
        out.valores.bits = Number(metas.bits.atualManual) || 0;
      }

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
      return res.status(200).json(out);
    }

    /* ---------- GET ?action=status-perfil ---------- */
    if(action === 'status-perfil'){
      try {
        const token = await twitchToken();
        const headers = { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}` };
        const u = await (await fetch('https://api.twitch.tv/helix/users?login=asemtet0', { headers })).json();
        const id = u?.data?.[0]?.id;
        if(!id) return res.status(200).json({ online: false });
        const s = await (await fetch(`https://api.twitch.tv/helix/streams?user_id=${id}`, { headers })).json();
        const online = Array.isArray(s?.data) && s.data.length > 0;
        return res.status(200).json({ online });
      } catch(e){ return res.status(200).json({ online: false }); }
    }

    /* ---------- GET normal (config pública) ---------- */
    const [avisoRaw, donateRaw, manutRaw, recadoRaw, horasRaw, updatedRaw, top3Raw, hallRaw, votosFechRaw] = await redis([
      ['GET', 'config:aviso'],
      ['GET', 'config:donate'],
      ['GET', 'config:manutencao'],
      ['GET', 'config:recado'],
      ['GET', 'config:horasMes'],
      ['GET', 'config:updatedAt'],
      ['GET', 'config:top3'],
      ['GET', 'config:hall'],
      ['GET', 'config:votosFechamento']
    ]);

    let aviso = null, top3 = [], hall = [];
    try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch (e) {}
    try { top3 = top3Raw ? JSON.parse(top3Raw) : []; } catch (e) { top3 = []; }
    try { hall = hallRaw ? JSON.parse(hallRaw) : []; } catch (e) { hall = []; }

    const donate = safeStr(donateRaw, 500);
    const donateUrl = /^https?:\/\//i.test(donate) ? donate : null;

    return res.status(200).json({
      aviso: sanitizarAviso(aviso),
      donate: donateUrl,
      manutencao: manutRaw === '1',
      recado: safeStr(recadoRaw, 500),
      horasMes: safeStr(horasRaw, 30),
      updatedAt: safeStr(updatedRaw, 40) || null,
      top3: sanitizarLista(top3, ['nome', 'valor'], 3),
      hall: sanitizarLista(hall, ['nome', 'meta'], 5),
      votosFechamento: safeStr(votosFechRaw, 40) || null
    });
  } catch (e) {
    return res.status(200).json({});
  }
}