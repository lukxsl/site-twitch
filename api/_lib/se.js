// ============================================================
//  StreamElements — cliente compartilhado (api/_lib/se.js)
//  Tudo que o site puxa do SE passa por aqui.
//
//  Variáveis de ambiente (Vercel):
//    STREAMELEMENTS_JWT          token JWT (SE → Account → Channels → Show secrets)
//    STREAMELEMENTS_CHANNEL_ID   (opcional) id do canal, evita 1 chamada
//    TWITCH_CHANNEL              (opcional) login da Twitch, padrão asemtet0
// ============================================================

const BASE = 'https://api.streamelements.com/kappa/v2';
const CANAL_LOGIN = String(process.env.TWITCH_CHANNEL || 'asemtet0').trim().toLowerCase();

// Aceita o token colado de qualquer jeito: com aspas, "Bearer ", quebra de linha...
export function limparJwt(bruto) {
  let t = String(bruto || '').trim();
  t = t.replace(/^['"`]+|['"`]+$/g, '').trim();
  t = t.replace(/^(authorization\s*:\s*)?(bearer|oauth|jwt)\s+/i, '').trim();
  return t.replace(/\s+/g, '');
}
const JWT = limparJwt(process.env.STREAMELEMENTS_JWT);
const CHANNEL_ID_ENV = String(process.env.STREAMELEMENTS_CHANNEL_ID || '').trim();

export const temJwt = () => !!JWT;

function erro(msg, status, code) {
  const e = new Error(msg);
  e.statusCode = status || 502;
  e.code = code || 'se_error';
  return e;
}

/**
 * GET na API do SE.
 *  - tenta com JWT;
 *  - se der 401/403 e o endpoint puder ser público (pontos, horas, chat, canal),
 *    tenta de novo SEM token — esses endpoints não exigem autenticação.
 */
export async function seGet(path, { publico = false, query = null, timeoutMs = 9000 } = {}) {
  const p = String(path).startsWith('/') ? path : `/${path}`;
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null)).toString() : '';
  const url = `${BASE}${p}${qs}`;

  async function chamar(comToken) {
    const headers = { Accept: 'application/json' };
    if (comToken) headers.Authorization = `Bearer ${JWT}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { headers, signal: ctrl.signal });
    } catch (_) {
      throw erro('Não foi possível conectar ao StreamElements.', 502, 'se_offline');
    } finally { clearTimeout(timer); }
  }

  let r = await chamar(!!JWT);
  if ((r.status === 401 || r.status === 403) && publico) r = await chamar(false);

  if (r.status === 401 || r.status === 403) {
    throw erro(`StreamElements recusou o token (HTTP ${r.status}). Gere um JWT novo e atualize STREAMELEMENTS_JWT na Vercel.`, 502, 'se_auth');
  }
  if (r.status === 404) throw erro('Recurso não encontrado no StreamElements (HTTP 404).', 502, 'se_404');
  if (!r.ok) throw erro(`Falha na API do StreamElements (HTTP ${r.status}).`, 502, 'se_http');

  const txt = await r.text();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (_) { throw erro('Resposta inválida do StreamElements.', 502, 'se_json'); }
}

// ---------- id do canal (cache em memória) ----------
let canalCache = { id: null, ate: 0 };
let canalPendente = null;

export async function canalId() {
  if (CHANNEL_ID_ENV) return CHANNEL_ID_ENV;
  if (canalCache.id && Date.now() < canalCache.ate) return canalCache.id;
  if (canalPendente) return canalPendente;
  canalPendente = (async () => {
    let id = null, ultimoErro = null;
    // 1) /channels/me (precisa do JWT)   2) /channels/<login> (público)
    if (JWT) {
      try { const me = await seGet('/channels/me'); id = me?._id || me?.id || me?.channel?._id; } catch (e) { ultimoErro = e; }
    }
    if (!id) {
      try { const c = await seGet(`/channels/${encodeURIComponent(CANAL_LOGIN)}`, { publico: true }); id = c?._id || c?.id; } catch (e) { ultimoErro = ultimoErro || e; }
    }
    if (!id) throw ultimoErro || erro('Não foi possível descobrir o ID do canal no StreamElements.', 502, 'se_canal');
    canalCache = { id: String(id), ate: Date.now() + 15 * 60 * 1000 };
    return canalCache.id;
  })();
  try { return await canalPendente; } finally { canalPendente = null; }
}

// ---------- helpers de normalização ----------
export function linhas(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const k of ['users', 'docs', 'results', 'items', 'data', 'tips', 'top', 'ranking', 'watchtime']) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  if (payload.data && typeof payload.data === 'object') {
    for (const k of ['users', 'docs', 'results', 'items', 'ranking']) if (Array.isArray(payload.data[k])) return payload.data[k];
  }
  return [];
}

export function totalDe(payload) {
  if (!payload || typeof payload !== 'object') return null;
  for (const v of [payload._total, payload.total, payload.totalDocs, payload.total_count, payload.count]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function nomeDe(row) {
  const n = row?.username || row?.data?.username || row?.userName || row?.user?.username || row?.user?.displayName
    || row?.displayName || row?.name || row?.channel || '';
  return String(n || 'Anônimo').replace(/^@/, '').slice(0, 40);
}

export const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// ---------- rankings de fidelidade ----------
// /points/{id}/top  e  /points/{id}/watchtime  e  /points/{id}/alltime
export async function rankingPontos(tipo = 'top', limit = 100, offset = 0) {
  const id = await canalId();
  const rota = tipo === 'horas' ? 'watchtime' : tipo === 'acumulados' ? 'alltime' : 'top';
  const payload = await seGet(`/points/${encodeURIComponent(id)}/${rota}`, { publico: true, query: { limit, offset } });
  const rows = linhas(payload);
  return {
    total: totalDe(payload) ?? rows.length,
    lista: rows.map((r, i) => {
      const nome = nomeDe(r);
      const pontos = numero(r.points ?? r.current ?? r.data?.points ?? r.amount ?? r.value);
      const minutos = numero(r.minutes ?? r.watchtime ?? r.data?.watchtime ?? r.watchTime ?? r.time ?? r.hours * 60);
      return {
        pos: offset + i + 1,
        nome,
        valor: tipo === 'horas' ? minutos : pontos,
        pontos,
        minutos,
        acumulado: numero(r.alltime ?? r.total)
      };
    })
  };
}

// ---------- chat (mensagens, emotes, comandos) ----------
export async function statsChat(limit = 100) {
  const id = await canalId();
  const d = await seGet(`/chatstats/${encodeURIComponent(id)}/stats`, { publico: true, query: { limit: Math.min(100, limit) } });
  const chatters = Array.isArray(d?.chatters) ? d.chatters : [];
  return {
    total: numero(d?.totalMessages),
    lista: chatters.map((c, i) => ({ pos: i + 1, nome: String(c.name || c.username || 'Anônimo').slice(0, 40), valor: numero(c.amount ?? c.count) })),
    emotes: (Array.isArray(d?.twitchEmotes) ? d.twitchEmotes : []).slice(0, 10).map(e => ({ nome: String(e.emote || e.name || ''), usos: numero(e.amount) }))
  };
}

// ---------- doadores (gorjetas) ----------
const STATUS_RUINS = new Set(['failed', 'rejected', 'refunded', 'chargeback', 'cancelled', 'canceled', 'denied']);
const NOMES_ANONIMOS = new Set(['anonimo', 'anônimo', 'anonymous', 'anon', '']);

async function todasGorjetas(paginas = 10) {
  const id = await canalId();
  const out = [];
  for (let p = 0; p < paginas; p++) {
    const d = await seGet(`/tips/${encodeURIComponent(id)}`, { query: { limit: 100, offset: p * 100, sort: '-createdAt' } });
    const docs = linhas(d);
    out.push(...docs);
    if (docs.length < 100) break;
  }
  return out;
}

export async function rankingDoadores() {
  const tips = await todasGorjetas();
  const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
  const porPessoa = new Map();
  let totalMes = 0, totalGeral = 0, ultimo = null, qtd = 0;
  const moedas = {};

  for (const t of tips) {
    if (t.deleted === true) continue;
    if (t.status && STATUS_RUINS.has(String(t.status).toLowerCase())) continue;
    if (t.approved && !['allowed', 'approved'].includes(String(t.approved).toLowerCase())) continue;
    const valor = numero(t.donation?.amount ?? t.amount);
    if (valor <= 0) continue;
    const moeda = String(t.donation?.currency || t.currency || 'BRL').toUpperCase();
    moedas[moeda] = (moedas[moeda] || 0) + 1;
    const nome = String(t.donation?.user?.username || t.username || 'Anônimo').replace(/^@/, '').slice(0, 40);
    const quando = new Date(t.createdAt || t.updatedAt || 0).getTime() || 0;
    qtd++; totalGeral += valor;
    if (quando >= ini.getTime()) totalMes += valor;
    if (!ultimo || quando > ultimo.em) ultimo = { nome, valor: Math.round(valor * 100) / 100, em: quando };
    const chave = nome.toLowerCase();
    if (NOMES_ANONIMOS.has(chave)) continue; // soma nos totais, mas fora do pódio
    const x = porPessoa.get(chave) || { nome, total: 0, doacoes: 0, ultima: 0, maior: 0 };
    x.total += valor; x.doacoes += 1; x.ultima = Math.max(x.ultima, quando); x.maior = Math.max(x.maior, valor);
    porPessoa.set(chave, x);
  }

  const ordenado = [...porPessoa.values()].sort((a, b) => b.total - a.total);
  const moedaPrincipal = Object.entries(moedas).sort((a, b) => b[1] - a[1])[0]?.[0] || 'BRL';
  return {
    lista: ordenado.slice(0, 100).map((x, i) => ({
      pos: i + 1, nome: x.nome, valor: Math.round(x.total * 100) / 100,
      doacoes: x.doacoes, maior: Math.round(x.maior * 100) / 100, ultima: x.ultima || null
    })),
    totalMes: Math.round(totalMes * 100) / 100,
    totalGeral: Math.round(totalGeral * 100) / 100,
    apoiadores: porPessoa.size,
    doacoes: qtd,
    ultimo,
    moeda: moedaPrincipal
  };
}

// ---------- subs ----------
export async function resumoSubs() {
  const id = await canalId();
  const d = await seGet(`/subscribers/${encodeURIComponent(id)}`, { query: { limit: 1 } });
  return { total: totalDe(d) ?? 0 };
}
