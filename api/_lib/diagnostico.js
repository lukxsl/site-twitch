// ============================================================
//  Diagnóstico do site (api/_lib/diagnostico.js)
//  Usado só pela action "diagnostico" do api/admin.js (dev).
//  Nunca devolve segredo: apenas presença/validade e mensagens.
// ============================================================
import { redis, ENV } from './core.js';
import { seGet, limparJwt } from './se.js';

const CANAL = 'asemtet0';
const STEAM_ID = '76561199823015081';
const TIMEOUT_MS = 6000;

function env(nome) {
  return String(process.env[nome] || '').trim();
}

function item(id, label, status, detail, ms) {
  return { id, label, status, detail, ms: ms == null ? null : Math.round(ms) };
}

async function medir(fn) {
  const t = Date.now();
  try {
    const detail = await fn();
    return { status: 'ok', detail: detail || 'OK', ms: Date.now() - t };
  } catch (e) {
    return { status: 'fail', detail: e?.message || String(e), ms: Date.now() - t };
  }
}

async function buscarJson(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const txt = await r.text();
  let dados = null;
  try { dados = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) {
    const erro = new Error(`HTTP ${r.status}${txt ? ': ' + txt.replace(/\s+/g, ' ').slice(0, 120) : ''}`);
    erro.statusCode = r.status;
    erro.dados = dados;
    throw erro;
  }
  return dados;
}

async function checarRedis() {
  const t = Date.now();
  try {
    const [pong] = await redis([['PING']]);
    if (String(pong).toUpperCase() !== 'PONG') throw new Error('Resposta inesperada do Redis: ' + pong);
    return item('redis', 'Banco de dados (Redis)', 'ok', 'Conexão e latência OK', Date.now() - t);
  } catch (e) {
    return item('redis', 'Banco de dados (Redis)', 'fail', e?.message || 'Falha ao conectar', Date.now() - t);
  }
}

async function checarTwitch() {
  const id = env('TWITCH_CLIENT_ID');
  const secret = env('TWITCH_CLIENT_SECRET');
  if (!id || !secret) return item('twitch', 'Twitch (API)', 'fail', 'TWITCH_CLIENT_ID/SECRET não configurados');
  const t = Date.now();
  try {
    const d = await buscarJson(
      'https://id.twitch.tv/oauth2/token?' + new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' }),
      { method: 'POST' }
    );
    if (!d?.access_token) throw new Error('A Twitch não devolveu access_token');
    const u = await buscarJson(`https://api.twitch.tv/helix/users?login=${CANAL}`, {
      headers: { 'Client-ID': id, Authorization: 'Bearer ' + d.access_token }
    });
    const canal = u?.data?.[0];
    return item('twitch', 'Twitch (API)', 'ok', canal ? `Token válido e canal @${canal.login} acessível` : 'Token válido (canal não encontrado)', Date.now() - t);
  } catch (e) {
    return item('twitch', 'Twitch (API)', 'fail', e?.message || 'Falha ao consultar a Twitch', Date.now() - t);
  }
}

async function checarSteam() {
  const key = env('STEAM_API_KEY');
  if (!key) return item('steam', 'Steam (API)', 'warn', 'STEAM_API_KEY não configurada (busca de jogos cai no plano B)');
  const t = Date.now();
  try {
    const d = await buscarJson('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?' + new URLSearchParams({ key, steamids: STEAM_ID }));
    const p = d?.response?.players?.[0];
    return item('steam', 'Steam (API)', 'ok', p ? `Perfil ${p.personaname || STEAM_ID} acessível` : 'API respondeu sem perfil', Date.now() - t);
  } catch (e) {
    return item('steam', 'Steam (API)', 'warn', e?.message || 'Falha ao consultar a Steam', Date.now() - t);
  }
}

async function checarTmdb() {
  const token = env('TMDB_TOKEN');
  const key = env('TMDB_API_KEY');
  if (!token && !key) return item('tmdb', 'TMDB (filmes/séries)', 'warn', 'TMDB_TOKEN/TMDB_API_KEY não configurados');
  const t = Date.now();
  try {
    const url = 'https://api.themoviedb.org/3/configuration' + (token ? '' : '?' + new URLSearchParams({ api_key: key }));
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const d = await buscarJson(url, { headers });
    return item('tmdb', 'TMDB (filmes/séries)', 'ok', d?.images ? 'API de imagens/configuração acessível' : 'API respondeu OK', Date.now() - t);
  } catch (e) {
    return item('tmdb', 'TMDB (filmes/séries)', 'warn', e?.message || 'Falha ao consultar o TMDB', Date.now() - t);
  }
}

async function checarLastfm() {
  const key = env('LASTFM_API_KEY');
  const user = env('LASTFM_USER');
  if (!key || !user) return item('lastfm', 'Last.fm / Spotify', 'warn', 'LASTFM_API_KEY ou LASTFM_USER não configurados');
  const t = Date.now();
  try {
    const d = await buscarJson('https://ws.audioscrobbler.com/2.0/?' + new URLSearchParams({ method: 'user.getinfo', user, api_key: key, format: 'json' }));
    const nome = d?.user?.name;
    return item('lastfm', 'Last.fm / Spotify', 'ok', nome ? `Usuário ${nome} acessível` : 'API respondeu OK', Date.now() - t);
  } catch (e) {
    return item('lastfm', 'Last.fm / Spotify', 'warn', e?.message || 'Falha ao consultar o Last.fm', Date.now() - t);
  }
}

function checarJwtSe() {
  const jwt = limparJwt(env('STREAMELEMENTS_JWT'));
  if (!jwt) return item('se_jwt', 'StreamElements (JWT)', 'warn', 'STREAMELEMENTS_JWT não configurado');
  const partes = jwt.split('.');
  if (partes.length !== 3) return item('se_jwt', 'StreamElements (JWT)', 'warn', 'O valor não é um JWT válido (3 partes)');
  try {
    const p = JSON.parse(Buffer.from(partes[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (p.exp && p.exp * 1000 < Date.now()) {
      return item('se_jwt', 'StreamElements (JWT)', 'fail', 'O JWT expirou — gere um novo no StreamElements');
    }
    const exp = p.exp ? new Date(p.exp * 1000).toLocaleDateString('pt-BR') : null;
    return item('se_jwt', 'StreamElements (JWT)', 'ok', exp ? `JWT válido até ${exp}` : 'JWT válido');
  } catch (e) {
    return item('se_jwt', 'StreamElements (JWT)', 'warn', 'O JWT não pôde ser decodificado');
  }
}

async function checarStreamElements() {
  const t = Date.now();
  try {
    const d = await seGet(`/channels/${encodeURIComponent(CANAL)}`, { publico: true, timeoutMs: TIMEOUT_MS });
    const id = d?._id || d?.id;
    return item('se_api', 'StreamElements (API)', id ? 'ok' : 'warn', id ? `Canal público acessível (${String(id).slice(0, 8)}…)` : 'API respondeu sem dados do canal', Date.now() - t);
  } catch (e) {
    return item('se_api', 'StreamElements (API)', 'warn', e?.message || 'Falha ao consultar o StreamElements', Date.now() - t);
  }
}

function checarWebhookDiscord() {
  const url = env('DISCORD_WEBHOOK_URL');
  if (!url) return item('discord', 'Discord (webhook)', 'warn', 'DISCORD_WEBHOOK_URL não configurado');
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//i.test(url)) {
    return item('discord', 'Discord (webhook)', 'warn', 'A URL do webhook não parece válida');
  }
  return item('discord', 'Discord (webhook)', 'ok', 'Webhook configurado');
}

async function checarPresenca(chave, label) {
  const valor = env(chave);
  if (!valor) return item(chave.toLowerCase(), label, 'warn', `${chave} não configurado`);
  return item(chave.toLowerCase(), label, 'ok', `${chave} configurado`);
}

export async function executarDiagnostico() {
  // As verificações externas são independentes: rodam em paralelo para o
  // diagnóstico caber com folga no limite de tempo da função (30s).
  const [redis, twitch, steam, tmdb, lastfm, se] = await Promise.all([
    checarRedis(),
    checarTwitch(),
    checarSteam(),
    checarTmdb(),
    checarLastfm(),
    checarStreamElements()
  ]);

  const itens = [];

  itens.push(redis);

  if (!ENV.SESSION_SECRET) itens.push(item('session_secret', 'Sessão do site', 'fail', 'SESSION_SECRET não configurado'));
  else itens.push(item('session_secret', 'Sessão do site', 'ok', 'SESSION_SECRET configurado'));

  itens.push(await checarPresenca('CRON_SECRET', 'Cron de presença/backup'));

  itens.push(twitch);
  itens.push(steam);
  itens.push(tmdb);
  itens.push(lastfm);
  itens.push(checarJwtSe());
  itens.push(se);
  itens.push(checarWebhookDiscord());

  const falhas = itens.filter(i => i.status === 'fail').length;
  const avisos = itens.filter(i => i.status === 'warn').length;

  return {
    ok: falhas === 0,
    checkedAt: new Date().toISOString(),
    resumo: { total: itens.length, falhas, avisos },
    itens
  };
}
