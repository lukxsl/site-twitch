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

function extrairChannelIdDoToken(jwt) {
  try {
    const decoded = JSON.parse(Buffer.from(String(jwt).split('.')[1], 'base64url').toString('utf-8'));
    return decoded.channel || decoded.channel_id || null;
  } catch (e) { return null; }
}
const CHANNEL_ID_JWT = extrairChannelIdDoToken(JWT);
// Account ID do canal asemtet0 no StreamElements (usado se nada mais definir o ID)
const CHANNEL_ID_PADRAO = '67b10de5d2ceb1c2bf122f65';

// Olha o JWT localmente (sem rede) e aponta o problema mais comum.
function diagnosticoJwt() {
  if (!JWT) return 'STREAMELEMENTS_JWT está vazio na Vercel (confira se foi salvo em Production e faça Redeploy).';
  const partes = JWT.split('.');
  if (partes.length !== 3) return 'O valor de STREAMELEMENTS_JWT não é um JWT (deve ter 3 partes separadas por ponto). Copie o "JWT Token" em StreamElements → Account → Channels → Show secrets, não o Account ID.';
  try {
    const p = JSON.parse(Buffer.from(partes[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (p.exp && p.exp * 1000 < Date.now()) return 'O JWT do StreamElements expirou. Gere um novo.';
  } catch (_) { return 'O STREAMELEMENTS_JWT está corrompido (não decodifica). Cole de novo, inteiro.'; }
  return null;
}

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
export async function seGet(path, { publico = false, query = null, timeoutMs = 10000 } = {}) {
  const p = String(path).startsWith('/') ? path : `/${path}`;
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null)).toString() : '';
  const url = `${BASE}${p}${qs}`;

  async function chamar(esquema) {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; asemtet0-site/1.0)'
    };
    if (esquema) headers.Authorization = `${esquema} ${JWT}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { headers, signal: ctrl.signal });
    } catch (_) {
      throw erro('Não foi possível conectar ao StreamElements.', 502, 'se_offline');
    } finally { clearTimeout(timer); }
  }
  const negado = (x) => x.status === 401 || x.status === 403;

  let r = await chamar(JWT ? 'Bearer' : null);
  // Alguns tokens só passam com o esquema "oAuth" (token OAuth2 em vez de JWT)
  if (JWT && negado(r)) { const r2 = await chamar('oAuth'); if (!negado(r2)) r = r2; }
  if (negado(r) && publico) r = await chamar(null);

  if (negado(r)) {
    let corpo = '';
    try { corpo = (await r.text()).replace(/\s+/g, ' ').slice(0, 140); } catch (_) {}
    const dica = diagnosticoJwt() || 'Gere um JWT novo (Show secrets → Regenerate) na conta vinculada ao canal e atualize STREAMELEMENTS_JWT na Vercel + Redeploy.';
    throw erro(`StreamElements recusou o acesso (HTTP ${r.status}${corpo ? ': ' + corpo : ''}). ${dica}`, 502, 'se_auth');
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
  if (canalCache.id && Date.now() < canalCache.ate) return canalCache.id;
  if (canalPendente) return canalPendente;
  canalPendente = (async () => {
    let idPublico = null, idConfigurado = null, ultimoErro = null;
    try {
      const canal = await seGet(`/channels/${encodeURIComponent(CANAL_LOGIN)}`, { publico: true });
      idPublico = canal?._id || canal?.id || canal?.channel?._id || null;
    } catch (e) { ultimoErro = e; }

    if (CHANNEL_ID_ENV) {
      idConfigurado = CHANNEL_ID_ENV;
      if (idPublico && String(idPublico) !== String(CHANNEL_ID_ENV)) {
        const e = erro(`STREAMELEMENTS_CHANNEL_ID não pertence ao canal @${CANAL_LOGIN}. Confira o ID configurado na Vercel.`, 502, 'se_channel');
        throw e;
      }
    }

    // O JWT já traz o ID do canal (campo `channel`): dispensa /channels/me e a env CHANNEL_ID.
    if (CHANNEL_ID_JWT && idPublico && String(CHANNEL_ID_JWT) !== String(idPublico)) {
      throw erro(`O STREAMELEMENTS_JWT pertence a outro canal. Gere o token na conta StreamElements vinculada a @${CANAL_LOGIN}.`, 502, 'se_channel');
    }

    const id = idConfigurado || CHANNEL_ID_JWT || CHANNEL_ID_PADRAO || idPublico;
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
  for (const k of ['users', 'docs', 'results', 'items', 'data', 'tips', 'top', 'topDonors', 'leaderboard', 'tippers', 'donations', 'ranking', 'watchtime']) {
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

// ---------- filtro de bots ----------
// O StreamElements registra contas de bot, do próprio canal e nomes genéricos
// no ranking de pontos/horas. Elas não são pessoas da comunidade e ficavam
// ocupando o pódio, então saem da lista antes de ela ser montada.
const NOMES_BOT = new Set([
  'bot', 'bots', 'stream', 'streamer', 'streaming', 'nightbot', 'streamelements',
  'streamlabs', 'sery_bot', 'serybot', 'fossabot', 'moobot', 'wizebot', 'chatbot',
  'owner', 'channel', 'canal', 'admin', 'mod', 'system', 'anonymous_bot'
]);
const RE_BOT = /(^|[\s_.\-])(bot|b0t|nightbot|streamelements|streamlabs|sery_?bot|fossabot|moobot|wizebot|chatbot)([\s_.\-]|$)/i;

export function ehBot(nome) {
  const n = String(nome || '').trim().replace(/^@/, '').toLowerCase();
  if (!n) return true;
  if (NOMES_BOT.has(n)) return true;
  return RE_BOT.test(n);
}

// ---------- rankings de fidelidade ----------
// /points/{id}/top  e  /points/{id}/watchtime  e  /points/{id}/alltime
export async function rankingPontos(tipo = 'top', limit = 100, offset = 0) {
  const id = await canalId();
  const rota = tipo === 'horas' ? 'watchtime' : tipo === 'acumulados' ? 'alltime' : 'top';
  const payload = await seGet(`/points/${encodeURIComponent(id)}/${rota}`, { publico: true, query: { limit, offset } });
  const rows = linhas(payload);
  const comNome = rows
    .map((r, i) => {
      const nome = nomeDe(r);
      const pontos = numero(r.points ?? r.current ?? r.data?.points ?? r.amount ?? r.value);
      const minutos = numero(r.minutes ?? r.watchtime ?? r.data?.watchtime ?? r.watchTime ?? r.time ?? r.hours * 60);
      const acumulado = numero(r.alltime ?? r.total);
      return {
        pos: offset + i + 1,
        nome,
        valor: tipo === 'horas' ? minutos : tipo === 'acumulados' ? (acumulado || pontos) : pontos,
        pontos,
        minutos,
        acumulado
      };
    })
    .filter(x => !ehBot(x.nome));
  // Contas com 0 pontos/minutos saem do ranking — mas só quando a API realmente
  // devolveu valores (se todos vierem zerados é falha de formato, não ranking vazio).
  const temValor = comNome.some(x => x.valor > 0);
  const lista = (temValor ? comNome.filter(x => x.valor > 0) : comNome).map((x, i) => ({ ...x, pos: i + 1 }));
  return { total: totalDe(payload) ?? lista.length, lista };
}

// ---------- chat (mensagens, emotes, comandos) ----------
export async function statsChat(limit = 100) {
  let d = null, ultimo = null;
  const candidatos = [CANAL_LOGIN];
  try { candidatos.push(await canalId()); } catch (e) { ultimo = e; }
  for (const c of candidatos) {
    try { d = await seGet(`/chatstats/${encodeURIComponent(c)}/stats`, { publico: true, query: { limit: Math.min(100, limit) } }); if (d) break; }
    catch (e) { ultimo = e; }
  }
  if (!d) throw ultimo || erro('Não foi possível ler as estatísticas do chat.', 502, 'se_chat');
  const chatters = Array.isArray(d?.chatters) ? d.chatters : [];
  const emotes = d?.twitchEmotes || d?.emotes || [];
  const comNome = chatters
    .map((c, i) => ({ pos: i + 1, nome: String(c.name || c.username || 'Anônimo').slice(0, 40), valor: numero(c.amount ?? c.count) }))
    .filter(x => !ehBot(x.nome));
  const temValor = comNome.some(x => x.valor > 0);
  const lista = (temValor ? comNome.filter(x => x.valor > 0) : comNome).map((x, i) => ({ ...x, pos: i + 1 }));
  return {
    total: numero(d?.totalMessages),
    lista,
    emotes: (Array.isArray(emotes) ? emotes : []).slice(0, 10).map(e => ({ nome: String(e.emote || e.name || ''), usos: numero(e.amount) }))
  };
}

// ---------- subs ----------
export async function resumoSubs() {
  const id = await canalId();
  const d = await seGet(`/subscribers/${encodeURIComponent(id)}`, { query: { limit: 1 } });
  return { total: totalDe(d) ?? 0 };
}
