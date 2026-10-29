import { createHmac, timingSafeEqual } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sessao_site';
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_KEY = process.env.TMDB_API_KEY;
const STEAM_KEY = process.env.STEAM_API_KEY || process.env.STEAM;
const STEAM_ID = '76561199823015081';
const ENV_ADMINS = (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const SUG_KEY = 'sugestoes:lista';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const LOGS_MAX = 199;

const NIVEIS = { dev: 4, dono: 3, administrador: 2, moderador: 1 };

const PERMISSOES_PADRAO = {
  dev: ['ver_votos','editar_opcoes','resetar_votos','ver_tierlist','editar_tierlist','importar_steam','ver_admins','editar_admins','ver_banidos','editar_banidos','ver_config','editar_config','ver_logs','ver_sugestoes'],
  dono: ['ver_votos','editar_opcoes','resetar_votos','ver_tierlist','editar_tierlist','importar_steam','ver_admins','editar_admins','ver_banidos','editar_banidos','ver_config','editar_config','ver_logs','ver_sugestoes'],
  administrador: ['ver_votos','editar_opcoes','ver_tierlist','editar_tierlist','ver_admins','editar_admins','ver_banidos','editar_banidos','ver_config','ver_logs','ver_sugestoes'],
  moderador: ['ver_votos','ver_tierlist','ver_banidos','ver_sugestoes']
};

const LABEL_PERM = {
  ver_votos: 'Ver votos', editar_opcoes: 'Editar opções', resetar_votos: 'Resetar votos',
  ver_tierlist: 'Ver tier list', editar_tierlist: 'Editar tier list', importar_steam: 'Importar Steam',
  ver_admins: 'Ver admins', editar_admins: 'Editar admins',
  ver_banidos: 'Ver banidos', editar_banidos: 'Banir/desbanir',
  ver_config: 'Ver config', editar_config: 'Editar config',
  ver_logs: 'Ver logs', ver_sugestoes: 'Ver sugestões'
};

const JOGOS_PADRAO = [
  { id: 'red-dead-2', nome: 'Red Dead Redemption 2', appid: 1174180, tier: 'S', status: 'Jogando', nota: 8, horas: 50,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900.jpg',
    comentario: 'Um dos mundos mais vivos e detalhados dos games.', generos: ['Ação','Aventura'] },
  { id: 'hollow-knight', nome: 'Hollow Knight', tier: 'S', status: 'Zerado', nota: 9, horas: 40,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg', comentario: '', generos: ['Metroidvania','Plataforma'] },
  { id: 'stardew-valley', nome: 'Stardew Valley', tier: 'A', status: 'Jogando', nota: 8, horas: 120,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg', comentario: '', generos: ['Simulação','RPG'] }
];
const FILMES_PADRAO = [
  { id: 'interestelar', nome: 'Interestelar', tier: 'S', status: 'Assistido', nota: 9, duracao: 169, ano: 2014,
    capa: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    comentario: 'As reservas naturais da Terra estão chegando ao fim.', generos: ['Ficção'] }
];

const STATUS_SUG_VALIDOS = ['nova','analise','aceita','recusada','concluido'];
const ROTULO_CONCLUIDO = {
  'Sugestão / ideia':      'Aplicada',
  'Sugestão de jogo':      'Jogado',
  'Feedback':              'Resolvido',
  'Reportar bug do site':  'Corrigido'
};
const LABEL_STATUS = {
  nova:'Nova', analise:'Em análise', aceita:'Aceita', recusada:'Recusada', concluido:'Concluído'
};

function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(p){ return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function assinarValido(p, sig){
  const esperado = assinar(p);
  try {
    const a = Buffer.from(esperado);
    const b = Buffer.from(String(sig));
    if(a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}
function lerSessao(req){
  if(!SESSION_SECRET) return null;
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if(!m) return null;
  const [payload, sig] = m[1].split('.');
  if(!payload || !sig || !assinarValido(payload, sig)) return null;
  try {
    const d = JSON.parse(b64urlDecode(payload));
    if(d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

async function redis(cmds){
  if(!URL_ || !TOKEN) throw new Error('Redis não configurado: verifique as variáveis UPSTASH_REDIS_REST_URL/TOKEN.');
  const endpoint = `${URL_.replace(/\/+$/, '')}/pipeline`;
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  let data;
  try { data = await r.json(); } catch { throw new Error(`Resposta inválida do Redis (HTTP ${r.status}).`); }
  if(!r.ok || !Array.isArray(data)) throw new Error(data?.error || `Redis HTTP ${r.status}`);
  const falha = data.find(x => x && x.error);
  if(falha) throw new Error(`Redis: ${falha.error}`);
  return data.map(x => x.result);
}

async function pegarPermissoes(){
  try {
    const [raw] = await redis([['GET', 'config:permissoes']]);
    if(!raw) return { ...PERMISSOES_PADRAO };
    const d = JSON.parse(raw);
    if(!d || typeof d !== 'object') return { ...PERMISSOES_PADRAO };
    return { ...PERMISSOES_PADRAO, ...d };
  } catch(e){ return { ...PERMISSOES_PADRAO }; }
}

async function temPermissao(sessao, perm){
  if(!sessao || !sessao.cargo) return false;
  if(sessao.cargo === 'dev') return true;
  const perms = await pegarPermissoes();
  return (perms[sessao.cargo] || []).includes(perm);
}

async function logAcao(quem, cargo, acao){
  try {
    const item = JSON.stringify({ quem, cargo, acao, ts: Date.now() });
    await redis([['LPUSH', 'admin:logs', item], ['LTRIM', 'admin:logs', '0', String(LOGS_MAX)]]);
  } catch(e){}
}

async function traduzir(texto){
  const original = String(texto || '').trim();
  if(!original) return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(original.slice(0, 4200))}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; asemtet0/1.0)' },
      signal: AbortSignal.timeout(7000)
    });
    if(!r.ok) return null;
    const d = await r.json();
    if(Array.isArray(d) && Array.isArray(d[0])){
      const partes = d[0].map(seg => (Array.isArray(seg) ? seg[0] : '')).filter(Boolean);
      return partes.join('').trim() || null;
    }
    return null;
  } catch(e){ return null; }
}

async function sinopseWikipedia(nome, lang = 'pt'){
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(nome)}&format=json&origin=*&srlimit=1`;
    const r1 = await fetch(searchUrl, { headers: { 'User-Agent': 'asemtet0-site/1.0' } });
    const d1 = await r1.json();
    const titulo = d1?.query?.search?.[0]?.title;
    if(!titulo) return null;
    const extractUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(titulo)}&format=json&origin=*`;
    const r2 = await fetch(extractUrl, { headers: { 'User-Agent': 'asemtet0-site/1.0' } });
    const d2 = await r2.json();
    const extract = d2?.query?.pages ? Object.values(d2.query.pages)[0]?.extract : null;
    if(!extract) return null;
    return extract.length > 800 ? extract.slice(0, 797) + '…' : extract;
  } catch(e){ return null; }
}

let igdbCache = { token: null, exp: 0 };
async function igdbToken(){
  if(igdbCache.token && Date.now() < igdbCache.exp) return igdbCache.token;
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' })
  });
  const d = await r.json();
  if(!d.access_token) throw new Error('IGDB falhou');
  igdbCache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return igdbCache.token;
}

async function igdbBuscar(nome){
  if(!TWITCH_ID || !TWITCH_SECRET) return { erro: 'IGDB não configurado' };
  try {
    const token = await igdbToken();
    const limpo = String(nome || '').replace(/["\\]/g, '').trim();
    if(!limpo) return { erro: 'Informe um nome' };
    const post = async (body) => (await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body
    })).json();
    const campos = 'fields name, rating, aggregated_rating, total_rating_count, cover.url, summary, first_release_date, version_parent, category, genres.name;';
    let lista = await post(`where name = "${limpo}" & version_parent = null & category = 0; ${campos} sort total_rating_count desc; limit 10;`);
    if(!Array.isArray(lista) || !lista.length) lista = await post(`where name = "${limpo}" & version_parent = null; ${campos} sort total_rating_count desc; limit 10;`);
    if(!Array.isArray(lista) || !lista.length) lista = await post(`search "${limpo}"; ${campos} where version_parent = null; limit 15;`);
    if(!Array.isArray(lista) || !lista.length) return { erro: 'Jogo não encontrado' };
    lista.sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0));
    const mapJogo = g => {
      const capa = g.cover?.url ? 'https:' + g.cover.url.replace(/t_(thumb|cover_small|cover_big|720p)/g, 't_1080p') : null;
      const rating = g.aggregated_rating || g.rating || null;
      const generos = Array.isArray(g.genres) ? g.genres.map(x => x.name).filter(Boolean) : [];
      return {
        id: g.id, nome: g.name, capa,
        nota: rating ? Math.round(rating) / 10 : null,
        sinopse: g.summary || '',
        ano: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
        generos
      };
    };
    const resultados = lista.map(mapJogo);
    const principal = resultados[0];
    if(!principal.sinopse){
      const wikiPt = await sinopseWikipedia(principal.nome, 'pt');
      if(wikiPt) principal.sinopse = wikiPt;
      else {
        const wikiEn = await sinopseWikipedia(principal.nome, 'en');
        if(wikiEn) principal.sinopse = wikiEn;
      }
    }
    if(principal.sinopse){
      const pt = await traduzir(principal.sinopse);
      if(pt) principal.sinopse = pt;
    }
    resultados[0].sinopse = principal.sinopse || '';
    return { ...principal, resultados };
  } catch(e){ return { erro: 'Erro ao buscar no IGDB: ' + e.message }; }
}

async function tmdbBuscar(nome, ano){
  if(!TMDB_TOKEN && !TMDB_KEY) return { erro: 'TMDB não configurado' };
  const chamar = async (path, params = {}) => {
    const u = new URL('https://api.themoviedb.org/3' + path);
    Object.entries({ language: 'pt-BR', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
    if(!TMDB_TOKEN) u.searchParams.set('api_key', TMDB_KEY);
    const r = await fetch(u, { headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {} });
    return r.json();
  };
  try {
    let d = await chamar('/search/movie', { query: nome, include_adult: 'false', ...(ano ? { year: String(ano) } : {}) });
    let filme = d.results?.[0];
    if(!filme){ d = await chamar('/search/movie', { query: nome, include_adult: 'false' }); filme = d.results?.[0]; }
    if(!filme){ d = await chamar('/search/movie', { query: nome, include_adult: 'false', language: 'en-US' }); filme = d.results?.[0]; }
    if(!filme) return { erro: 'Filme não encontrado' };
    const det = await chamar(`/movie/${filme.id}`);
    const generos = Array.isArray(det.genres) ? det.genres.map(x => x.name).filter(Boolean) : [];
    return {
      id: det.id, nome: det.title || filme.title,
      capa: det.poster_path ? `https://image.tmdb.org/t/p/w500${det.poster_path}` : null,
      sinopse: det.overview || '', duracao: det.runtime || null,
      ano: det.release_date ? Number(det.release_date.slice(0,4)) : null,
      generos
    };
  } catch(e){ return { erro: 'Erro ao buscar no TMDB' }; }
}

async function buscarConquistasSteam(appid){
  if(!STEAM_KEY || !appid) return null;
  try {
    const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&appid=${appid}&l=portuguese`;
    const r = await fetch(url);
    if(!r.ok) return null;
    const d = await r.json();
    const lista = d?.playerstats?.achievements;
    if(!Array.isArray(lista) || !lista.length) return null;
    return { obtidas: lista.filter(a => a.achieved === 1).length, total: lista.length };
  } catch(e){ return null; }
}

function limparHtmlDescricao(texto){
  return String(texto || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 4200);
}

async function buscarSinopseSteam(appid){
  if(!appid) return null;
  for(const idioma of ['brazilian', 'portuguese', 'english']){
    try {
      const url = 'https://store.steampowered.com/api/appdetails?appids=' + encodeURIComponent(appid) + '&cc=br&l=' + idioma;
      const r = await fetch(url, { signal: AbortSignal.timeout(6500) });
      if(!r.ok) continue;
      const payload = await r.json();
      const pacote = payload && payload[String(appid)];
      const dados = pacote && pacote.success ? pacote.data : null;
      if(!dados) continue;
      const original = limparHtmlDescricao(dados.short_description || dados.about_the_game || dados.detailed_description || '');
      if(!original) continue;
      const jaPt = idioma === 'brazilian' || idioma === 'portuguese';
      const pt = jaPt ? null : await traduzir(original);
      const generos = Array.isArray(dados.genres) ? dados.genres.map(g => g.description).filter(Boolean) : [];
      return { nome: dados.name || null, sinopse: pt || original, capa: dados.header_image || null, generos };
    } catch(e) { /* tenta o próximo idioma */ }
  }
  return null;
}

async function buscarDadosJogo(nome, appid = null){
  let igdb = {};
  try { igdb = await igdbBuscar(nome); } catch(e){}
  if(igdb && igdb.erro) igdb = {};

  let steam = null;
  if(appid && (!igdb.sinopse || !igdb.capa || !Array.isArray(igdb.generos) || !igdb.generos.length)){
    steam = await buscarSinopseSteam(appid);
  }

  let sinopse = (igdb && igdb.sinopse) || (steam && steam.sinopse) || '';
  if(!sinopse){
    sinopse = await sinopseWikipedia(nome, 'pt') || '';
    if(!sinopse){
      const ingles = await sinopseWikipedia(nome, 'en');
      if(ingles) sinopse = await traduzir(ingles) || ingles;
    }
  }
  if(sinopse && !(igdb && igdb.sinopse) && !(steam && steam.sinopse)){
    sinopse = await traduzir(sinopse) || sinopse;
  }

  return {
    ...(igdb || {}),
    nome: (igdb && igdb.nome) || (steam && steam.nome) || nome,
    sinopse,
    comentario: sinopse,
    capa: (igdb && igdb.capa) || (steam && steam.capa) || null,
    generos: (igdb && Array.isArray(igdb.generos) && igdb.generos.length) ? igdb.generos : ((steam && steam.generos) || [])
  };
}

/* ------------------------------------------------------------------
   Escrita segura da lista de jogos (compare-and-set)
   ------------------------------------------------------------------
   Por que não o Lua com cjson de antes: o cjson do Redis transforma arrays
   VAZIOS em objetos ({}), então um jogo com `generos: []` voltava corrompido.
   Agora o merge é feito em JS e o Redis só confirma "a lista ainda é a mesma
   que eu li?" antes de gravar. Se alguém editou no meio, tenta de novo.
   ------------------------------------------------------------------ */
const CAS_LUA = [
  "local cur = redis.call('GET', KEYS[1])",
  "if (cur == false and ARGV[1] == '') or cur == ARGV[1] then",
  "  redis.call('SET', KEYS[1], ARGV[2])",
  "  return 1",
  "end",
  "return 0"
].join('\n');

async function atualizarListaCAS(key, aplicar, tentativas = 4){
  for(let i = 0; i < tentativas; i++){
    const [raw] = await redis([['GET', key]]);
    let lista = [];
    if(raw){
      try { lista = JSON.parse(raw); }
      catch(e){ throw new Error('A lista no Redis está ilegível. Abortei para não sobrescrever nada.'); }
    }
    if(!Array.isArray(lista)) throw new Error('A lista no Redis não é um array. Abortei para não sobrescrever nada.');
    const { lista: nova, resultado } = aplicar(lista);
    const [ok] = await redis([['EVAL', CAS_LUA, '1', key, raw || '', JSON.stringify(nova)]]);
    if(Number(ok) === 1) return resultado;
    await new Promise(r => setTimeout(r, 120 + Math.random() * 200));
  }
  throw new Error('A lista foi alterada ao mesmo tempo por outra ação. Tente de novo.');
}

const normalizarNomeJogo = nome => String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* Não mexe em tier, nota, status nem comentário de quem já existe: só completa o que está vazio. */
function mesclarJogosSteam(atuais, novos){
  const lista = atuais.map(j => ({ ...j }));
  const porApp = new Map(), porNome = new Map();
  lista.forEach((j, i) => {
    if(j.appid) porApp.set(String(j.appid), i);
    if(j.nome) porNome.set(normalizarNomeJogo(j.nome), i);
  });
  let adicionados = 0, pulados = 0;
  for(const novo of novos){
    let idx = novo.appid ? porApp.get(String(novo.appid)) : undefined;
    if(idx === undefined && novo.nome) idx = porNome.get(normalizarNomeJogo(novo.nome));
    if(idx !== undefined){
      pulados++;
      const a = lista[idx];
      if(novo.appid && !a.appid) a.appid = novo.appid;
      if(novo.horas && (!a.horas || Number(novo.horas) > Number(a.horas))) a.horas = novo.horas;
      if((!a.capa) && novo.capa) a.capa = novo.capa;
      const desc = a.sinopse || a.comentario;
      const novaDesc = novo.sinopse || novo.comentario;
      if(!desc && novaDesc){ a.sinopse = novaDesc; a.comentario = novaDesc; }
      if((!Array.isArray(a.generos) || !a.generos.length) && Array.isArray(novo.generos) && novo.generos.length) a.generos = novo.generos;
      if((!a.conquistas || !a.conquistas.total) && novo.conquistas) a.conquistas = novo.conquistas;
      if((!a.nota || Number(a.nota) === 0) && Number(novo.nota) > 0) a.nota = novo.nota;
    } else {
      lista.push(novo);
      const pos = lista.length - 1;
      if(novo.appid) porApp.set(String(novo.appid), pos);
      if(novo.nome) porNome.set(normalizarNomeJogo(novo.nome), pos);
      adicionados++;
    }
  }
  return { lista, resultado: { adicionados, pulados, total: lista.length } };
}

/* Cada importação processa só um LOTE (sinopse + tradução + conquistas são chamadas externas lentas;
   60 jogos de uma vez estouram o tempo da função serverless). Clique de novo pra continuar. */
const IMPORT_LOTE_MAX = Number(process.env.IMPORT_LOTE_MAX) || 12;
const IMPORT_CONCORRENCIA = 4;
const IMPORT_ORCAMENTO_MS = Number(process.env.IMPORT_BUDGET_MS) || 7500;

async function importarSteam(){
  if(!STEAM_KEY) return { error: 'STEAM_API_KEY não configurada' };
  const url = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=' + encodeURIComponent(STEAM_KEY) + '&steamid=' + STEAM_ID + '&include_appinfo=1&include_played_free_games=1&format=json';
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if(!r.ok) return { error: 'Steam HTTP ' + r.status };
  const sd = await r.json();
  const lista = sd && sd.response && Array.isArray(sd.response.games) ? sd.response.games : [];
  const jogados = lista.filter(g => g.appid && g.name && g.playtime_forever > 0)
    .sort((a,b) => b.playtime_forever - a.playtime_forever).slice(0, 60);

  const [jogosRaw] = await redis([['GET', 'tierlist:jogos']]);
  let atuais = [];
  try { atuais = jogosRaw ? JSON.parse(jogosRaw) : []; } catch(e){ return { error: 'A lista atual está ilegível no Redis. Importação cancelada para não apagar nada.' }; }
  if(!Array.isArray(atuais)) atuais = [];
  const idsExistentes = new Set(atuais.filter(j => j.appid).map(j => String(j.appid)));
  const nomesExistentes = new Set(atuais.map(j => normalizarNomeJogo(j.nome)));
  const candidatos = jogados.filter(g => !idsExistentes.has(String(g.appid)) && !nomesExistentes.has(normalizarNomeJogo(g.name)));
  const puladosAntes = jogados.length - candidatos.length;

  const t0 = Date.now();
  const novos = [];
  let processados = 0;

  const montar = async (g) => {
    const extra = await buscarDadosJogo(g.name, g.appid);
    let conquistas = null;
    try { conquistas = await buscarConquistasSteam(g.appid); } catch(e){}
    const sinopse = extra.sinopse || '';
    return {
      id: g.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40),
      appid: g.appid,
      nome: g.name,
      tier: 'NR',
      status: 'Jogando',
      horas: Math.round(g.playtime_forever / 6) / 10,
      conquistas,
      nota: extra.nota || 0,
      capa: extra.capa || ('https://cdn.cloudflare.steamstatic.com/steam/apps/' + g.appid + '/library_600x900.jpg'),
      comentario: sinopse,
      sinopse,
      generos: Array.isArray(extra.generos) ? extra.generos : [],
      adicionadoEm: new Date().toISOString()
    };
  };

  for(let i = 0; i < candidatos.length && novos.length < IMPORT_LOTE_MAX; i += IMPORT_CONCORRENCIA){
    if(Date.now() - t0 > IMPORT_ORCAMENTO_MS) break;
    const fatia = candidatos.slice(i, i + Math.min(IMPORT_CONCORRENCIA, IMPORT_LOTE_MAX - novos.length));
    const resp = await Promise.all(fatia.map(g => montar(g).catch(() => null)));
    resp.forEach(x => { if(x) novos.push(x); });
    processados += fatia.length;
  }

  let merge = { adicionados: 0, pulados: 0, total: atuais.length };
  if(novos.length){
    merge = await atualizarListaCAS('tierlist:jogos', (listaAtual) => mesclarJogosSteam(listaAtual, novos));
  }
  return {
    ok: true,
    adicionados: Number(merge.adicionados) || 0,
    pulados: puladosAntes + (Number(merge.pulados) || 0),
    total: jogados.length,
    totalSalvo: Number(merge.total) || atuais.length,
    restantes: Math.max(0, candidatos.length - processados)   // > 0 → clique em importar de novo
  };
}

const SYNC_CONQ_MAX = 20;   // conquistas buscadas por rodada (as demais ficam pra próxima)

async function sincronizarHoras(){
  if(!STEAM_KEY) return { error: 'STEAM_API_KEY não configurada' };
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if(!r.ok) return { error: `Steam HTTP ${r.status}` };
  const sd = await r.json();
  const mapa = {};
  (sd?.response?.games || []).forEach(g => { if(g.appid) mapa[g.appid] = g; });

  const [jogosRaw] = await redis([['GET', 'tierlist:jogos']]);
  let atuais = [];
  try { atuais = jogosRaw ? JSON.parse(jogosRaw) : []; } catch(e){ return { error: 'A lista atual está ilegível no Redis. Sincronização cancelada.' }; }
  if(!Array.isArray(atuais)) atuais = [];

  // 1) descobre o que mudou (sem gravar ainda)
  const mudancas = new Map();       // appid -> campos novos
  let conqBuscadas = 0, conqAtualizadas = 0;
  const t0 = Date.now();
  for(const j of atuais){
    if(!j.appid) continue;
    const g = mapa[j.appid];
    if(!g) continue;
    const m = {};
    const novasHoras = Math.round(g.playtime_forever / 6) / 10;
    if(Number(j.horas) !== novasHoras) m.horas = novasHoras;

    const conqAntiga = j.conquistasAtualizadoEm;
    const precisaConq = !j.conquistas || !conqAntiga || (Date.now() - new Date(conqAntiga).getTime() > 24 * 3600 * 1000);
    if(precisaConq && conqBuscadas < SYNC_CONQ_MAX && Date.now() - t0 < IMPORT_ORCAMENTO_MS){
      conqBuscadas++;
      try {
        const c = await buscarConquistasSteam(j.appid);
        if(c){
          if((j.conquistas?.obtidas || 0) !== c.obtidas) m.conqMudou = true;
          m.conquistas = c;
          m.conquistasAtualizadoEm = new Date().toISOString();
          conqAtualizadas++;
        }
      } catch(e){}
    }
    if(Object.keys(m).length) mudancas.set(String(j.appid), m);
  }

  // 2) aplica sobre a lista MAIS RECENTE do Redis (não atropela edições feitas enquanto isso)
  let atualizados = 0;
  if(mudancas.size){
    atualizados = await atualizarListaCAS('tierlist:jogos', (lista) => {
      let n = 0;
      const nova = lista.map(j => {
        const m = j.appid ? mudancas.get(String(j.appid)) : null;
        if(!m) return j;
        const novo = { ...j };
        if(m.horas !== undefined) novo.horas = m.horas;
        if(m.conquistas){ novo.conquistas = m.conquistas; novo.conquistasAtualizadoEm = m.conquistasAtualizadoEm; }
        if(m.horas !== undefined || m.conqMudou) n++;
        return novo;
      });
      return { lista: nova, resultado: n };
    });
  }
  return { ok: true, atualizados, conqAtualizadas, total: atuais.length };
}

async function prepararJogosManuais(listaRecebida, listaAtual){
  const atuais = Array.isArray(listaAtual) ? listaAtual : [];
  const resultado = [];

  for(const recebido of (Array.isArray(listaRecebida) ? listaRecebida : [])){
    if(!recebido || typeof recebido !== 'object'){ resultado.push(recebido); continue; }
    const item = { ...recebido };
    const id = String(item.id || '');
    const appid = item.appid ? String(item.appid) : '';
    const anterior = atuais.find(j =>
      (id && String(j.id || '') === id) ||
      (appid && String(j.appid || '') === appid)
    );
    const descricao = String(item.sinopse || item.comentario || '').trim();
    const descricaoAnterior = String((anterior && (anterior.sinopse || anterior.comentario)) || '').trim();
    const descricaoMudou = Boolean(descricao && descricao !== descricaoAnterior);

    if(!anterior || descricaoMudou){
      if(descricao){
        const pt = await traduzir(descricao);
        const final = pt || descricao;
        item.sinopse = final;
        item.comentario = final;
      } else {
        let dados = {};
        try { dados = await buscarDadosJogo(item.nome, item.appid || null); } catch(e){}
        const sinopse = String((dados && dados.sinopse) || '').trim();
        if(sinopse){
          item.sinopse = sinopse;
          item.comentario = sinopse;
        }
        if(!item.capa && dados && dados.capa) item.capa = dados.capa;
        if((!Array.isArray(item.generos) || !item.generos.length) && dados && Array.isArray(dados.generos)){
          item.generos = dados.generos;
        }
        if(!item.nota && dados && dados.nota) item.nota = dados.nota;
      }
    } else if(descricao && !item.sinopse){
      item.sinopse = descricao;
    }
    resultado.push(item);
  }
  return resultado;
}

async function notificarStatus(item, novoStatus, motivo, quemMudou){
  if(!DISCORD_WEBHOOK) return;

  const tipoLabel = ROTULO_CONCLUIDO[item.tipo] || LABEL_STATUS[novoStatus] || novoStatus;
  const labelFinal = novoStatus === 'concluido' ? `🏁 ${tipoLabel}` : (LABEL_STATUS[novoStatus] || novoStatus);

  const cores = {
    recusada:  0xef4444,
    aceita:    0x10b981,
    concluido: 0xa855f7,
    analise:   0x3b82f6,
    nova:      0xf59e0b
  };
  const color = cores[novoStatus] || 0xa855f7;
  const menciona = item.userId ? `<@${item.userId}> ` : '';

  const FRASES_CONCLUIDO = {
    'Sugestão / ideia':     { titulo: '💡 Anotado!',        desc: 'Sua sugestão foi anotada pela Soso!' },
    'Sugestão de jogo':     { titulo: '🎮 Jogo anotado!',   desc: 'Anotamos sua sugestão de jogo!' },
    'Feedback':             { titulo: '💬 Recebido!',       desc: 'Obrigada pelo feedback! 💜' },
    'Reportar bug do site': { titulo: '🐛 Bug registrado!', desc: 'Registramos o bug, já vamos olhar!' }
  };

  let titulo, descricao;
  if(novoStatus === 'concluido'){
    const frase = FRASES_CONCLUIDO[item.tipo] || { titulo: '🎉 Boa notícia!', desc: 'Sua sugestão foi finalizada!' };
    titulo = frase.titulo;
    descricao = `${menciona}${frase.desc}`;
  } else if(novoStatus === 'aceita'){
    titulo = '✅ Sua ideia foi aceita!';
    descricao = `${menciona}Boa! Sua ideia vai rolar 💜`;
  } else if(novoStatus === 'recusada'){
    titulo = '❌ Sua ideia foi recusada';
    descricao = `${menciona}Infelizmente essa não vai rolar dessa vez.`;
  } else if(novoStatus === 'analise'){
    titulo = '👀 Sua ideia tá em análise';
    descricao = `${menciona}A Soso viu sua ideia e tá pensando!`;
  } else {
    titulo = `🟡 Status atualizado: ${labelFinal}`;
    descricao = `${menciona}Sua ideia mudou de status.`;
  }

  const fields = [
    { name: '💬 Ideia original', value: `> ${(item.texto || '').slice(0, 180)}${(item.texto||'').length > 180 ? '…' : ''}` },
    { name: '🏷️ Novo status', value: labelFinal, inline: true },
    { name: '👤 Por', value: `@${quemMudou}`, inline: true }
  ];
  if(novoStatus === 'recusada' && motivo) fields.push({ name: '💸 Motivo', value: motivo });

  const payload = {
    embeds: [{
      author: item.avatar ? { name: item.nome ? `@${item.nome}` : 'Usuário', icon_url: item.avatar } : { name: item.nome ? `@${item.nome}` : 'Usuário' },
      title: titulo, description: descricao, color, fields,
      footer: { text: `ID: ${item.id.slice(0,8)}` },
      timestamp: new Date().toISOString()
    }]
  };

  if(item.userId){
    payload.content = `<@${item.userId}>`;
    payload.allowed_mentions = { users: [item.userId] };
  } else {
    payload.allowed_mentions = { parse: [] };
  }

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(e){}
}

export default async function handler(req, res){
  if(!SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });

  const action = req.query?.action || '';

  if(req.method === 'GET' && action === 'sync-horas-cron'){
    const CRON_SECRET = process.env.CRON_SECRET;
    if(!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
    const auth = req.headers.authorization || '';
    const expected = `Bearer ${CRON_SECRET}`;
    try {
      const a = Buffer.from(auth);
      const b = Buffer.from(expected);
      if(a.length !== b.length || !timingSafeEqual(a, b)){
        return res.status(401).json({ error: 'Não autorizado' });
      }
    } catch(e){
      return res.status(401).json({ error: 'Não autorizado' });
    }
    try {
      const r = await sincronizarHoras();
      return res.status(200).json(r);
    } catch(e){
      return res.status(500).json({ error: 'Erro no cron: ' + e.message });
    }
  }

  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });
  if(!sessao.admin) return res.status(403).json({ error: 'Sem permissão' });

  let cargoAtual = null;
  if(ENV_ADMINS.includes(String(sessao.id))){
    cargoAtual = 'dev';
  } else {
    try {
      const [raw] = await redis([['HGET', 'admins', String(sessao.id)]]);
      if(raw){
        const d = JSON.parse(raw);
        if(d && NIVEIS[d.cargo]) cargoAtual = d.cargo;
      }
    } catch(e){}
  }
  if(!cargoAtual){
    return res.status(403).json({ error: 'Acesso revogado. Faça login de novo.' });
  }
  sessao.cargo = cargoAtual;

  res.setHeader('Cache-Control', 'no-store');
  const meNivel = NIVEIS[sessao.cargo] || 0;
  const quem = sessao.username || 'anônimo';

  try {
    if(req.method === 'GET' && action === 'permissoes-minhas'){
      const perms = await pegarPermissoes();
      return res.status(200).json({ permissoes: perms[sessao.cargo] || [], cargo: sessao.cargo });
    }

    if(req.method === 'GET' && action === 'permissoes-get'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const perms = await pegarPermissoes();
      return res.status(200).json({ permissoes: perms, padrao: PERMISSOES_PADRAO, labels: LABEL_PERM });
    }

    if(req.method === 'POST' && action === 'permissoes-set'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { permissoes } = req.body || {};
      if(!permissoes || typeof permissoes !== 'object') return res.status(400).json({ error: 'Dados inválidos' });
      const limpo = {};
      for(const cargo of Object.keys(PERMISSOES_PADRAO)){
        if(cargo === 'dev'){ limpo[cargo] = PERMISSOES_PADRAO.dev.slice(); continue; }
        limpo[cargo] = Array.isArray(permissoes[cargo])
          ? permissoes[cargo].filter(p => typeof p === 'string' && LABEL_PERM[p])
          : PERMISSOES_PADRAO[cargo];
      }
      await redis([['SET', 'config:permissoes', JSON.stringify(limpo)]]);
      await logAcao(quem, sessao.cargo, 'Editou permissões dos cargos');
      return res.status(200).json({ ok: true, permissoes: limpo });
    }

    if(req.method === 'GET' && action === 'votos'){
      if(!(await temPermissao(sessao, 'ver_votos'))) return res.status(403).json({ error: 'Sem permissão' });
      const ciclo = (await redis([['GET','votos:ciclo_atual']]))[0] || '1';
      const [usuariosRaw, contRaw, configRaw, fechamentoRaw] = await redis([
        ['HGETALL', `votos_usuarios:${ciclo}`],
        ['HGETALL', `votos:${ciclo}`],
        ['GET', 'votos:config'],
        ['GET', 'config:votosFechamento']
      ]);
      const usuarios = [];
      for(let i = 0; i < (usuariosRaw||[]).length; i += 2){
        let dados = {};
        try { dados = JSON.parse(usuariosRaw[i+1]); } catch(e){ dados = { opcao: usuariosRaw[i+1] }; }
        usuarios.push({ userId: usuariosRaw[i], opcao: dados.opcao, username: dados.username, avatar: dados.avatar, ts: dados.ts });
      }
      const cont = {};
      for(let i = 0; i < (contRaw||[]).length; i += 2) cont[contRaw[i]] = Number(contRaw[i+1]);
      let config = null;
      try { config = configRaw ? JSON.parse(configRaw) : null; } catch(e){}
      return res.status(200).json({ ciclo, usuarios, contagem: cont, config, fechamento: fechamentoRaw || null });
    }

    if(req.method === 'POST' && action === 'opcoes'){
      if(!(await temPermissao(sessao, 'editar_opcoes'))) return res.status(403).json({ error: 'Sem permissão' });
      const body = req.body || {};
      const opcoesRaw = Array.isArray(body.opcoes) ? body.opcoes : null;
      if(opcoesRaw === null) return res.status(400).json({ error: 'Dados inválidos' });

      if(opcoesRaw.length === 0){
        await redis([['SET', 'votos:config', JSON.stringify([])]]);
        await logAcao(quem, sessao.cargo, 'Removeu TODAS as opções da votação');
        return res.status(200).json({ ok: true, opcoes: [] });
      }

      const opcoes = opcoesRaw.slice(0, 5);
      const processadas = [];
      for(const o of opcoes){
        const nome = String(o.nome || '').trim().slice(0,80);
        if(!nome) continue;
        const tipo = (o.tipo === 'filme') ? 'filme' : 'jogo';
        const id = String(o.id || '').trim().slice(0,40) || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);
        let capa = String(o.capa || '').trim();
        let appid = Number(o.appid) || null;
        if(!capa){
          const busca = tipo === 'filme' ? await tmdbBuscar(nome) : await igdbBuscar(nome);
          capa = busca.capa || null;
        }
        processadas.push({ id, nome, tipo, capa: capa || null, appid });
      }
      if(!processadas.length) return res.status(400).json({ error: 'Nenhuma opção válida' });
      await redis([['SET', 'votos:config', JSON.stringify(processadas)]]);
      await logAcao(quem, sessao.cargo, `Editou opções da votação (${processadas.length} itens)`);
      return res.status(200).json({ ok: true, opcoes: processadas });
    }

    if(req.method === 'POST' && action === 'reset'){
      if(!(await temPermissao(sessao, 'resetar_votos'))) return res.status(403).json({ error: 'Sem permissão' });
      const cicloAtual = Number((await redis([['GET','votos:ciclo_atual']]))[0]) || 1;
      const novo = cicloAtual + 1;
      await redis([
        ['DEL', `votos:${cicloAtual}`],
        ['DEL', `votos_usuarios:${cicloAtual}`],
        ['SET', 'votos:ciclo_atual', String(novo)]
      ]);
      await logAcao(quem, sessao.cargo, `Resetou a votação (ciclo ${cicloAtual} → ${novo})`);
      return res.status(200).json({ ok: true, novoCiclo: novo });
    }

    if(req.method === 'GET' && (action === 'admins' || action === 'admins-ver')){
      if(!(await temPermissao(sessao, 'ver_admins'))) return res.status(403).json({ error: 'Sem permissão' });
      const [flat, perfisFlat] = await redis([['HGETALL', 'admins'], ['HGETALL', 'user_profiles']]);
      const perfis = {};
      for(let i = 0; i < (perfisFlat||[]).length; i += 2){
        try { perfis[perfisFlat[i]] = JSON.parse(perfisFlat[i+1]); } catch(e){}
      }
      const admins = [];
      const jaVistos = new Set();
      for(const id of ENV_ADMINS){
        const p = perfis[id] || {};
        admins.push({ id, username: p.username || null, avatar: p.avatar || null, cargo: 'dev', fixo: true });
        jaVistos.add(id);
      }
      for(let i = 0; i < (flat||[]).length; i += 2){
        const id = flat[i];
        if(jaVistos.has(id)) continue;
        let d = {};
        try { d = JSON.parse(flat[i+1]); } catch(e){}
        const p = perfis[id] || {};
        admins.push({ id, username: d.username || p.username || null, avatar: d.avatar || p.avatar || null, cargo: d.cargo || 'moderador', fixo: false });
      }
      return res.status(200).json({ admins, meuCargo: sessao.cargo || null });
    }

    if(req.method === 'POST' && action === 'admins-add'){
      if(!(await temPermissao(sessao, 'editar_admins'))) return res.status(403).json({ error: 'Sem permissão' });
      const { userId, cargo, username, avatar } = req.body || {};
      if(!userId || !NIVEIS[cargo]) return res.status(400).json({ error: 'Dados inválidos' });
      if(cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs criam Devs' });
      if(NIVEIS[cargo] >= meNivel && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Cargo maior ou igual ao seu' });
      if(ENV_ADMINS.includes(String(userId))) return res.status(400).json({ error: 'ID já é admin fixo' });
      const [perfilRaw] = await redis([['HGET', 'user_profiles', String(userId)]]);
      let perfil = {};
      try { perfil = perfilRaw ? JSON.parse(perfilRaw) : {}; } catch(e){}
      const payload = JSON.stringify({ username: username || perfil.username || null, avatar: avatar || perfil.avatar || null, cargo, ts: Date.now() });
      await redis([['HSET', 'admins', String(userId), payload]]);
      await logAcao(quem, sessao.cargo, `Adicionou admin ${userId} (${cargo})`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'admins-edit'){
      if(!(await temPermissao(sessao, 'editar_admins'))) return res.status(403).json({ error: 'Sem permissão' });
      const { userId, cargo, username, avatar } = req.body || {};
      if(!userId || !NIVEIS[cargo]) return res.status(400).json({ error: 'Dados inválidos' });
      if(ENV_ADMINS.includes(String(userId))) return res.status(400).json({ error: 'Admin fixo não pode ser editado' });
      if(cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs promovem a Dev' });
      if(NIVEIS[cargo] > meNivel) return res.status(403).json({ error: 'Cargo maior que o seu' });
      const [atualRaw] = await redis([['HGET', 'admins', String(userId)]]);
      let atual = {};
      try { atual = atualRaw ? JSON.parse(atualRaw) : {}; } catch(e){}
      if(atual.cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs editam Devs' });
      const [perfilRaw] = await redis([['HGET', 'user_profiles', String(userId)]]);
      let perfil = {};
      try { perfil = perfilRaw ? JSON.parse(perfilRaw) : {}; } catch(e){}
      const payload = JSON.stringify({
        ...atual,
        username: username || atual.username || perfil.username || null,
        avatar: avatar || atual.avatar || perfil.avatar || null,
        cargo, ts: Date.now()
      });
      await redis([['HSET', 'admins', String(userId), payload]]);
      await logAcao(quem, sessao.cargo, `Editou admin ${userId} → ${cargo}`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'admins-remove'){
      if(!(await temPermissao(sessao, 'editar_admins'))) return res.status(403).json({ error: 'Sem permissão' });
      const { userId } = req.body || {};
      if(!userId) return res.status(400).json({ error: 'ID obrigatório' });
      if(ENV_ADMINS.includes(String(userId))) return res.status(400).json({ error: 'Admin fixo não pode ser removido' });
      const [atualRaw] = await redis([['HGET', 'admins', String(userId)]]);
      let atual = {};
      try { atual = atualRaw ? JSON.parse(atualRaw) : {}; } catch(e){}
      if(atual.cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs removem Devs' });
      await redis([['HDEL', 'admins', String(userId)]]);
      await logAcao(quem, sessao.cargo, `Removeu admin ${userId}`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'GET' && (action === 'tierlist' || action === 'tierlist-get')){
      if(!(await temPermissao(sessao, 'ver_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const [jogosRaw, filmesRaw, seedFeitoRaw] = await redis([
        ['GET','tierlist:jogos'],
        ['GET','tierlist:filmes'],
        ['GET','tierlist:seedFeito']
      ]);
      const seedFeito = seedFeitoRaw === '1';
      let jogos = [], filmes = [];
      const cmdsSalvar = [];
      if(jogosRaw === null || jogosRaw === undefined){
        if(!seedFeito){ jogos = JOGOS_PADRAO; cmdsSalvar.push(['SET', 'tierlist:jogos', JSON.stringify(jogos)]); }
        else jogos = [];
      } else {
        try { jogos = JSON.parse(jogosRaw); if(!Array.isArray(jogos)) jogos = []; } catch(e){ jogos = []; }
      }
      if(filmesRaw === null || filmesRaw === undefined){
        if(!seedFeito){ filmes = FILMES_PADRAO; cmdsSalvar.push(['SET', 'tierlist:filmes', JSON.stringify(filmes)]); }
        else filmes = [];
      } else {
        try { filmes = JSON.parse(filmesRaw); if(!Array.isArray(filmes)) filmes = []; } catch(e){ filmes = []; }
      }
      if(!seedFeito) cmdsSalvar.push(['SET', 'tierlist:seedFeito', '1']);
      if(cmdsSalvar.length) await redis(cmdsSalvar);
      return res.status(200).json({ jogos, filmes });
    }

    if(req.method === 'POST' && (action === 'tierlist' || action === 'tierlist-set')){
      if(!(await temPermissao(sessao, 'editar_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const { jogos, filmes, logAcao: acao } = req.body || {};
      const cmds = [];
      if(Array.isArray(jogos)){
        const [rawAtuais] = await redis([['GET', 'tierlist:jogos']]);
        let atuais = [];
        try { atuais = rawAtuais ? JSON.parse(rawAtuais) : []; } catch(e) {}
        if(rawAtuais && !Array.isArray(atuais)) throw new Error('A Tier List salva no Redis não é uma lista válida; nada foi sobrescrito.');
        const processados = await prepararJogosManuais(jogos, atuais);
        cmds.push(['SET', 'tierlist:jogos', JSON.stringify(processados)]);
      }
      if(Array.isArray(filmes)) cmds.push(['SET', 'tierlist:filmes', JSON.stringify(filmes)]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada pra salvar' });
      await redis(cmds);
      if(acao) await logAcao(quem, sessao.cargo, acao);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'tierlist-delete-many'){
      if(!(await temPermissao(sessao, 'editar_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const { ids, tipo } = req.body || {};
      if(!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Nada pra apagar' });
      const key = (tipo === 'filmes') ? 'tierlist:filmes' : 'tierlist:jogos';
      const [raw] = await redis([['GET', key]]);
      let lista = [];
      try { lista = raw ? JSON.parse(raw) : []; } catch(e){}
      const antes = lista.length;
      lista = lista.filter(it => !ids.includes(it.id));
      const apagados = antes - lista.length;
      await redis([['SET', key, JSON.stringify(lista)]]);
      await logAcao(quem, sessao.cargo, `Removeu ${apagados} itens de uma vez (${tipo})`);
      return res.status(200).json({ ok: true, apagados, restantes: lista.length });
    }

    if(req.method === 'GET' && action === 'buscar-jogo'){
      if(!(await temPermissao(sessao, 'editar_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const nome = String(req.query?.nome || '').trim();
      if(!nome) return res.status(400).json({ erro: 'Informe um nome' });
      return res.status(200).json(await igdbBuscar(nome));
    }

    if(req.method === 'GET' && action === 'buscar-filme'){
      if(!(await temPermissao(sessao, 'editar_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const nome = String(req.query?.nome || '').trim();
      const ano = req.query?.ano;
      if(!nome) return res.status(400).json({ erro: 'Informe um nome' });
      return res.status(200).json(await tmdbBuscar(nome, ano));
    }

    if(req.method === 'GET' && action === 'buscar-conquistas'){
      if(!(await temPermissao(sessao, 'editar_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const appid = Number(req.query?.appid);
      if(!appid) return res.status(400).json({ erro: 'appid obrigatório' });
      const conq = await buscarConquistasSteam(appid);
      if(!conq) return res.status(200).json({ erro: 'Sem conquistas disponíveis' });
      return res.status(200).json(conq);
    }

    if(req.method === 'POST' && action === 'traduzir'){
      if(!(await temPermissao(sessao, 'editar_tierlist'))) return res.status(403).json({ error: 'Sem permissão' });
      const texto = String(req.body?.texto || '').trim();
      if(!texto) return res.status(400).json({ error: 'Nada pra traduzir' });
      const traduzido = await traduzir(texto);
      if(!traduzido) return res.status(502).json({ error: 'Tradutor indisponível' });
      return res.status(200).json({ traduzido });
    }

    if(req.method === 'POST' && action === 'importar-steam'){
      if(!(await temPermissao(sessao, 'importar_steam'))) return res.status(403).json({ error: 'Sem permissão' });
      const r = await importarSteam();
      if(r.error) return res.status(400).json(r);
      await logAcao(quem, sessao.cargo, `Importou ${r.adicionados} jogos da Steam (${r.pulados} já existiam)${r.restantes ? `, faltam ${r.restantes}` : ''}`);
      return res.status(200).json(r);
    }

    if(req.method === 'POST' && action === 'sync-horas'){
      if(!(await temPermissao(sessao, 'importar_steam'))) return res.status(403).json({ error: 'Sem permissão' });
      const r = await sincronizarHoras();
      if(r.error) return res.status(400).json(r);
      await logAcao(quem, sessao.cargo, `Sincronizou horas/conquistas de ${r.atualizados} jogos (Steam)`);
      return res.status(200).json(r);
    }

    if(req.method === 'GET' && action === 'banidos-ver'){
      if(!(await temPermissao(sessao, 'ver_banidos'))) return res.status(403).json({ error: 'Sem permissão' });
      const [flat] = await redis([['HGETALL', 'banidos']]);
      const banidos = [];
      for(let i = 0; i < (flat||[]).length; i += 2){
        const id = flat[i];
        try {
          const d = JSON.parse(flat[i+1]);
          banidos.push({ id, username: d.username || null, avatar: d.avatar || null, motivo: d.motivo || null, ts: d.ts || null });
        } catch(e){}
      }
      return res.status(200).json({ banidos });
    }

    if(req.method === 'POST' && action === 'banidos-add'){
      if(!(await temPermissao(sessao, 'editar_banidos'))) return res.status(403).json({ error: 'Sem permissão' });
      const { userId, motivo, username, avatar } = req.body || {};
      if(!userId) return res.status(400).json({ error: 'ID obrigatório' });
      const payload = JSON.stringify({ username: username || null, avatar: avatar || null, motivo: motivo || null, ts: Date.now() });
      await redis([['HSET', 'banidos', String(userId), payload]]);
      await logAcao(quem, sessao.cargo, `Baniu ${userId} (${motivo || 'sem motivo'})`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'banidos-remove'){
      if(!(await temPermissao(sessao, 'editar_banidos'))) return res.status(403).json({ error: 'Sem permissão' });
      const { userId } = req.body || {};
      if(!userId) return res.status(400).json({ error: 'ID obrigatório' });
      await redis([['HDEL', 'banidos', String(userId)]]);
      await logAcao(quem, sessao.cargo, `Desbaniu ${userId}`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'GET' && action === 'config-get'){
      if(!(await temPermissao(sessao, 'ver_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const [avisoRaw, donateRaw, manutRaw, recadoRaw, horasRaw, updatedRaw, top3Raw, hallRaw, votosFechRaw, metasRaw] = await redis([
        ['GET', 'config:aviso'],['GET', 'config:donate'],['GET', 'config:manutencao'],
        ['GET', 'config:recado'],['GET', 'config:horasMes'],['GET', 'config:updatedAt'],
        ['GET', 'config:top3'],['GET', 'config:hall'],['GET', 'config:votosFechamento'],
        ['GET', 'config:metas']
      ]);
      let aviso = null, top3 = [], hall = [], metas = null;
      try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch(e){}
      try { top3 = top3Raw ? JSON.parse(top3Raw) : []; } catch(e){ top3 = []; }
      try { hall = hallRaw ? JSON.parse(hallRaw) : []; } catch(e){ hall = []; }
      try { metas = metasRaw ? JSON.parse(metasRaw) : null; } catch(e){}
      return res.status(200).json({
        aviso, donate: donateRaw || null,
        manutencao: manutRaw === '1',
        recado: recadoRaw || '', horasMes: horasRaw || '',
        updatedAt: updatedRaw || null,
        top3: Array.isArray(top3) ? top3 : [],
        hall: Array.isArray(hall) ? hall : [],
        votosFechamento: votosFechRaw || null,
        metas: metas || null
      });
    }

    if(req.method === 'POST' && action === 'config-set'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { aviso, donate, manutencao, recado, horasMes, top3, hall, votosFechamento, metas } = req.body || {};
      const agora = new Date().toISOString();
      const cmds = [];
      if(aviso !== undefined) cmds.push(['SET', 'config:aviso', JSON.stringify(aviso)]);
      if(donate !== undefined) cmds.push(['SET', 'config:donate', String(donate || '')]);
      if(manutencao !== undefined) cmds.push(['SET', 'config:manutencao', manutencao ? '1' : '0']);
      if(recado !== undefined) cmds.push(['SET', 'config:recado', String(recado || '')]);
      if(horasMes !== undefined) cmds.push(['SET', 'config:horasMes', String(horasMes || '')]);
      if(top3 !== undefined) cmds.push(['SET', 'config:top3', JSON.stringify(Array.isArray(top3) ? top3.slice(0,3) : [])]);
      if(hall !== undefined) cmds.push(['SET', 'config:hall', JSON.stringify(Array.isArray(hall) ? hall.slice(0,5) : [])]);
      if(votosFechamento !== undefined){
        cmds.push(['SET', 'config:votosFechamento', votosFechamento ? String(votosFechamento) : '']);
      }
      if(metas !== undefined && metas && typeof metas === 'object'){
        cmds.push(['SET', 'config:metas', JSON.stringify(metas)]);
      }
      cmds.push(['SET', 'config:updatedAt', agora]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada pra salvar' });
      await redis(cmds);
      await logAcao(quem, sessao.cargo, `Salvou config geral${manutencao ? ' (manutenção)' : ''}`);
      return res.status(200).json({ ok: true, updatedAt: agora });
    }

    // ===== SETUP/SONHOS =====
    if(req.method === 'POST' && action === 'setup-set'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { setup, sonhos } = req.body || {};
      const cmds = [];
      if(setup && Array.isArray(setup)) cmds.push(['SET', 'setup:data', JSON.stringify(setup)]);
      if(sonhos && Array.isArray(sonhos)) cmds.push(['SET', 'setup:sonhos', JSON.stringify(sonhos)]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada pra salvar' });
      await redis(cmds);
      await logAcao(quem, sessao.cargo, `Editou setup dos sonhos (${sonhos ? sonhos.length : 0} sonhos)`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'GET' && action === 'logs-ver'){
      if(!(await temPermissao(sessao, 'ver_logs'))) return res.status(403).json({ error: 'Sem permissão' });
      const [flat] = await redis([['LRANGE', 'admin:logs', '0', String(LOGS_MAX)]]);
      const logs = (flat || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
      return res.status(200).json({ logs });
    }

    if(req.method === 'GET' && action === 'sugestoes-ver'){
      if(!(await temPermissao(sessao, 'ver_sugestoes'))) return res.status(403).json({ error: 'Sem permissão' });
      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);
      return res.status(200).json({ itens });
    }

    if(req.method === 'POST' && action === 'sugestoes-status'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { id, status, motivo, motivoTipo } = req.body || {};
      if(!id) return res.status(400).json({ error: 'ID obrigatório' });
      if(!STATUS_SUG_VALIDOS.includes(status)) return res.status(400).json({ error: 'Status inválido' });
      if(status === 'recusada' && !motivo) return res.status(400).json({ error: 'Motivo obrigatório' });

      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
      const idx = itens.findIndex(i => i.id === id);
      if(idx < 0) return res.status(404).json({ error: 'Sugestão não encontrada' });

      itens[idx].status = status;
      itens[idx].motivo = status === 'recusada' ? String(motivo).slice(0, 200) : null;
      itens[idx].motivoTipo = status === 'recusada' ? (motivoTipo || null) : null;
      itens[idx].atualizadoEm = new Date().toISOString();
      itens[idx].atualizadoPor = quem;

      const cmds = [['DEL', SUG_KEY]];
      for(let i = itens.length - 1; i >= 0; i--){
        cmds.push(['RPUSH', SUG_KEY, JSON.stringify(itens[i])]);
      }
      await redis(cmds);
      await notificarStatus(itens[idx], status, itens[idx].motivo, quem);

      const label = status === 'recusada' ? `recusou (motivo: ${itens[idx].motivo})` : `mudou para ${status}`;
      await logAcao(quem, sessao.cargo, `Sugestão de @${itens[idx].nome}: ${label}`);
      return res.status(200).json({ ok: true, item: itens[idx] });
    }

    if(req.method === 'POST' && action === 'sugestoes-delete'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { id } = req.body || {};
      if(!id) return res.status(400).json({ error: 'ID obrigatório' });
      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
      const antes = itens.length;
      const restantes = itens.filter(i => i.id !== id);
      if(restantes.length === antes) return res.status(404).json({ error: 'Sugestão não encontrada' });
      const cmds = [['DEL', SUG_KEY]];
      for(let i = restantes.length - 1; i >= 0; i--){
        cmds.push(['RPUSH', SUG_KEY, JSON.stringify(restantes[i])]);
      }
      await redis(cmds);
      await logAcao(quem, sessao.cargo, `Excluiu uma sugestão (ID ${id.slice(0,8)})`);
      return res.status(200).json({ ok: true, restantes: restantes.length });
    }

    if(req.method === 'POST' && action === 'sugestoes-limpar'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { modo } = req.body || {};
      if(!['concluidas','recusadas','tudo'].includes(modo)){
        return res.status(400).json({ error: 'Modo inválido' });
      }
      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
      const antes = itens.length;
      let restantes;
      if(modo === 'tudo') restantes = [];
      else if(modo === 'concluidas') restantes = itens.filter(i => i.status !== 'concluido');
      else restantes = itens.filter(i => i.status !== 'recusada');
      const apagados = antes - restantes.length;
      const cmds = [['DEL', SUG_KEY]];
      for(let i = restantes.length - 1; i >= 0; i--){
        cmds.push(['RPUSH', SUG_KEY, JSON.stringify(restantes[i])]);
      }
      await redis(cmds);
      await logAcao(quem, sessao.cargo, `Limpou ${apagados} sugestões (modo: ${modo})`);
      return res.status(200).json({ ok: true, apagados, restantes: restantes.length });
    }

    return res.status(400).json({ error: 'Ação inválida: ' + action });
  } catch(e){
    return res.status(500).json({ error: 'Erro no admin: ' + e.message });
  }
}