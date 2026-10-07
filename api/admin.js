import { createHmac } from 'crypto';

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
const LOGS_MAX = 199; // 200 itens

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
    comentario: 'Um dos mundos mais vivos e detalhados dos games.' },
  { id: 'hollow-knight', nome: 'Hollow Knight', tier: 'S', status: 'Zerado', nota: 9, horas: 40,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg', comentario: '' },
  { id: 'stardew-valley', nome: 'Stardew Valley', tier: 'A', status: 'Jogando', nota: 8, horas: 120,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg', comentario: '' }
];
const FILMES_PADRAO = [
  { id: 'interestelar', nome: 'Interestelar', tier: 'S', status: 'Assistido', nota: 9, duracao: 169, ano: 2014,
    capa: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    comentario: 'As reservas naturais da Terra estão chegando ao fim e um grupo de astronautas recebe a missão de verificar possíveis planetas.' }
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

/* ============ SESSÃO ============ */
function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(p){ return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function lerSessao(req){
  if(!SESSION_SECRET) return null;
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if(!m) return null;
  const [payload, sig] = m[1].split('.');
  if(!payload || !sig || assinar(payload) !== sig) return null;
  try {
    const d = JSON.parse(b64urlDecode(payload));
    if(d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
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

/* ============ TRADUÇÃO ============ */
async function traduzir(texto){
  if(!texto) return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(texto)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if(!r.ok) return null;
    const d = await r.json();
    if(Array.isArray(d) && Array.isArray(d[0])){
      const partes = d[0].map(seg => (Array.isArray(seg) ? seg[0] : '')).filter(Boolean);
      return partes.join('') || null;
    }
    return null;
  } catch(e){ return null; }
}

/* ============ WIKIPEDIA ============ */
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

/* ============ IGDB ============ */
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
    const campos = 'fields name, rating, aggregated_rating, total_rating_count, cover.url, summary, first_release_date, version_parent, category;';
    let lista = await post(`where name = "${limpo}" & version_parent = null & category = 0; ${campos} sort total_rating_count desc; limit 10;`);
    if(!Array.isArray(lista) || !lista.length) lista = await post(`where name = "${limpo}" & version_parent = null; ${campos} sort total_rating_count desc; limit 10;`);
    if(!Array.isArray(lista) || !lista.length) lista = await post(`search "${limpo}"; ${campos} where version_parent = null; limit 15;`);
    if(!Array.isArray(lista) || !lista.length) return { erro: 'Jogo não encontrado' };
    lista.sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0));
    const mapJogo = g => {
      const capa = g.cover?.url ? 'https:' + g.cover.url.replace(/t_(thumb|cover_small|cover_big|720p)/g, 't_1080p') : null;
      const rating = g.aggregated_rating || g.rating || null;
      return {
        id: g.id, nome: g.name, capa,
        nota: rating ? Math.round(rating) / 10 : null,
        sinopse: g.summary || '',
        ano: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
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
    return {
      id: det.id, nome: det.title || filme.title,
      capa: det.poster_path ? `https://image.tmdb.org/t/p/w500${det.poster_path}` : null,
      sinopse: det.overview || '', duracao: det.runtime || null,
      ano: det.release_date ? Number(det.release_date.slice(0,4)) : null
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

async function importarSteam(){
  if(!STEAM_KEY) return { error: 'STEAM_API_KEY não configurada' };
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const r = await fetch(url);
  if(!r.ok) return { error: `Steam HTTP ${r.status}` };
  const sd = await r.json();
  const lista = sd?.response?.games || [];
  const jogados = lista.filter(g => g.playtime_forever > 0).sort((a,b) => b.playtime_forever - a.playtime_forever).slice(0, 60);
  const [jogosRaw] = await redis([['GET', 'tierlist:jogos']]);
  let atuais = [];
  try { atuais = jogosRaw ? JSON.parse(jogosRaw) : []; } catch(e){}
  const existentes = new Set(atuais.map(j => (j.nome || '').toLowerCase()));
  let adicionados = 0, pulados = 0;
  for(const g of jogados){
    if(existentes.has(g.name.toLowerCase())){ pulados++; continue; }
    const capaSteam = `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`;
    let extra = {};
    try { extra = await igdbBuscar(g.name); } catch(e){}
    let comentario = extra.sinopse || '';
    if(comentario){ try { const t = await traduzir(comentario); if(t) comentario = t; } catch(e){} }
    let conquistas = null;
    try { conquistas = await buscarConquistasSteam(g.appid); } catch(e){}
    atuais.push({
      id: g.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40),
      appid: g.appid, nome: g.name, tier: 'NR', status: 'Jogando',
      horas: Math.round(g.playtime_forever / 6) / 10,
      conquistas, nota: extra.nota || 0,
      capa: extra.capa || capaSteam, comentario,
      adicionadoEm: new Date().toISOString()
    });
    adicionados++;
    existentes.add(g.name.toLowerCase());
  }
  await redis([['SET', 'tierlist:jogos', JSON.stringify(atuais)]]);
  return { ok: true, adicionados, pulados, total: jogados.length };
}

/* ============ NOTIFICAÇÃO DISCORD: status mudou ============ */
async function notificarStatus(item, novoStatus, motivo, quemMudou){
  if(!DISCORD_WEBHOOK) return;
  const tipoLabel = ROTULO_CONCLUIDO[item.tipo] || LABEL_STATUS[novoStatus] || novoStatus;
  const labelFinal = novoStatus === 'concluido' ? `🏁 ${tipoLabel}` : (LABEL_STATUS[novoStatus] || novoStatus);
  const color = novoStatus === 'recusada' ? 0xef4444
             : novoStatus === 'aceita' ? 0x10b981
             : novoStatus === 'concluido' ? 0xa855f7
             : novoStatus === 'analise' ? 0x3b82f6
             : 0xf59e0b;
  const motivoTxt = novoStatus === 'recusada' && motivo ? `\n**Motivo:** ${motivo}` : '';
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `💡 Sua ideia foi atualizada: ${labelFinal}`,
          description: `**"${(item.texto || '').slice(0, 180)}${(item.texto||'').length > 180 ? '…' : ''}"**${motivoTxt}`,
          color,
          footer: { text: `De: ${item.nome} · por ${quemMudou}` },
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch(e){ /* silencioso */ }
}

/* ============ HANDLER ============ */
export default async function handler(req, res){
  if(!SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });

  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });
  if(!sessao.admin) return res.status(403).json({ error: 'Sem permissão' });

  res.setHeader('Cache-Control', 'no-store');
  const action = req.query?.action || '';
  const meNivel = NIVEIS[sessao.cargo] || 0;
  const quem = sessao.username || 'anônimo';

  try {
    /* -------- PERMISSÕES -------- */
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

    /* -------- VOTAÇÃO -------- */
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
      const opcoes = Array.isArray(req.body?.opcoes) ? req.body.opcoes.slice(0,5) : [];
      if(!opcoes.length) return res.status(400).json({ error: 'Nenhuma opção enviada' });
      const processadas = [];
      for(const o of opcoes){
        const nome = String(o.nome || '').trim().slice(0,80);
        if(!nome) continue;
        const tipo = (o.tipo === 'filme') ? 'filme' : 'jogo';
        const id = String(o.id || '').trim().slice(0,40) || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);
        let capa = String(o.capa || '').trim();
        if(!capa){
          const busca = tipo === 'filme' ? await tmdbBuscar(nome) : await igdbBuscar(nome);
          capa = busca.capa || null;
        }
        processadas.push({ id, nome, tipo, capa: capa || null });
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

    /* -------- ADMINS -------- */
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

    /* -------- TIER LIST -------- */
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
      if(Array.isArray(jogos)) cmds.push(['SET', 'tierlist:jogos', JSON.stringify(jogos)]);
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

    /* -------- BUSCAS -------- */
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

    /* -------- IMPORTAR STEAM -------- */
    if(req.method === 'POST' && action === 'importar-steam'){
      if(!(await temPermissao(sessao, 'importar_steam'))) return res.status(403).json({ error: 'Sem permissão' });
      const r = await importarSteam();
      if(r.error) return res.status(400).json(r);
      await logAcao(quem, sessao.cargo, `Importou ${r.adicionados} jogos da Steam (${r.pulados} já existiam)`);
      return res.status(200).json(r);
    }

    /* -------- BANIDOS -------- */
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

    /* -------- CONFIG -------- */
    if(req.method === 'GET' && action === 'config-get'){
      if(!(await temPermissao(sessao, 'ver_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const [avisoRaw, donateRaw, manutRaw, recadoRaw, horasRaw, updatedRaw, top3Raw, hallRaw, votosFechRaw] = await redis([
        ['GET', 'config:aviso'],['GET', 'config:donate'],['GET', 'config:manutencao'],
        ['GET', 'config:recado'],['GET', 'config:horasMes'],['GET', 'config:updatedAt'],
        ['GET', 'config:top3'],['GET', 'config:hall'],['GET', 'config:votosFechamento']
      ]);
      let aviso = null, top3 = [], hall = [];
      try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch(e){}
      try { top3 = top3Raw ? JSON.parse(top3Raw) : []; } catch(e){ top3 = []; }
      try { hall = hallRaw ? JSON.parse(hallRaw) : []; } catch(e){ hall = []; }
      return res.status(200).json({
        aviso, donate: donateRaw || null,
        manutencao: manutRaw === '1',
        recado: recadoRaw || '', horasMes: horasRaw || '',
        updatedAt: updatedRaw || null,
        top3: Array.isArray(top3) ? top3 : [],
        hall: Array.isArray(hall) ? hall : [],
        votosFechamento: votosFechRaw || null
      });
    }

    if(req.method === 'POST' && action === 'config-set'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { aviso, donate, manutencao, recado, horasMes, top3, hall, votosFechamento } = req.body || {};
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
      cmds.push(['SET', 'config:updatedAt', agora]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada pra salvar' });
      await redis(cmds);
      await logAcao(quem, sessao.cargo, `Salvou config geral${manutencao ? ' (manutenção LIGADA)' : ''}${votosFechamento ? ' (prazo votação)' : ''}`);
      return res.status(200).json({ ok: true, updatedAt: agora });
    }

    /* -------- LOGS -------- */
    if(req.method === 'GET' && action === 'logs-ver'){
      if(!(await temPermissao(sessao, 'ver_logs'))) return res.status(403).json({ error: 'Sem permissão' });
      const [flat] = await redis([['LRANGE', 'admin:logs', '0', String(LOGS_MAX)]]);
      const logs = (flat || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
      return res.status(200).json({ logs });
    }

    /* -------- SUGESTÕES (admin) -------- */
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
      if(status === 'recusada' && !motivo) return res.status(400).json({ error: 'Motivo obrigatório para recusar' });

      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);
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

      // Notifica no Discord
      await notificarStatus(itens[idx], status, itens[idx].motivo, quem);

      const label = status === 'recusada'
        ? `recusou (motivo: ${itens[idx].motivo})`
        : `mudou para ${status}`;
      await logAcao(quem, sessao.cargo, `Sugestão de @${itens[idx].nome}: ${label}`);

      return res.status(200).json({ ok: true, item: itens[idx] });
    }

    /* -------- SUGESTÕES: EXCLUIR -------- */
    if(req.method === 'POST' && action === 'sugestoes-delete'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { id } = req.body || {};
      if(!id) return res.status(400).json({ error: 'ID obrigatório' });

      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);
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

    /* -------- SUGESTÕES: LIMPAR EM MASSA -------- */
    if(req.method === 'POST' && action === 'sugestoes-limpar'){
      if(!(await temPermissao(sessao, 'editar_config'))) return res.status(403).json({ error: 'Sem permissão' });
      const { modo } = req.body || {};
      if(!['concluidas','recusadas','tudo'].includes(modo)){
        return res.status(400).json({ error: 'Modo inválido (concluidas | recusadas | tudo)' });
      }

      const [flat] = await redis([['LRANGE', SUG_KEY, '0', '199']]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);
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