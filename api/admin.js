// Vercel serverless: /api/admin.js
// Painel admin completo: votos, opções, admins, tierlist, banidos, config, logs,
// sugestões, buscar-jogo (IGDB), buscar-filme (TMDB), traduzir e importar-steam.
//
// Env necessárias:
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (ou KV_REST_API_*)
//   SESSION_SECRET
//   DISCORD_ADMIN_IDS  (IDs separados por vírgula — viram "dev" fixos)
//   TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET  (para IGDB)
//   TMDB_TOKEN (ou TMDB_API_KEY)
//   STEAM_API_KEY (ou STEAM)
import { createHmac } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-isso-urgente';
const COOKIE_NAME = 'sessao_site';
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_KEY = process.env.TMDB_API_KEY;
const STEAM_KEY = process.env.STEAM_API_KEY || process.env.STEAM;
const STEAM_ID = '76561199823015081';
const ENV_ADMINS = (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

const NIVEIS = { dev: 4, dono: 3, administrador: 2, moderador: 1 };

/* ============================================================
   HELPERS DE SESSÃO
   ============================================================ */
function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(p){ return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function lerSessao(req){
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

async function logAcao(quem, cargo, acao){
  try {
    const item = JSON.stringify({ quem, cargo, acao, ts: Date.now() });
    await redis([['LPUSH', 'admin:logs', item], ['LTRIM', 'admin:logs', '0', '99']]);
  } catch(e){}
}

/* ============================================================
   IGDB (nota + capa + sinopse de jogos)
   ============================================================ */
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
    const body = `search "${String(nome).replace(/"/g,'')}"; fields name, rating, aggregated_rating, cover.url, summary, first_release_date; limit 1;`;
    const r = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body
    });
    const d = await r.json();
    const g = Array.isArray(d) ? d[0] : null;
    if(!g) return { erro: 'Jogo não encontrado' };
    const capa = g.cover && g.cover.url
      ? `https:${g.cover.url.replace('t_thumb','t_cover_big').replace('t_cover_small','t_cover_big')}`
      : null;
    const rating = g.aggregated_rating || g.rating || null;
    return {
      nome: g.name,
      capa,
      nota: rating ? Math.round(rating) / 10 : null,
      sinopse: g.summary || '',
      ano: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
    };
  } catch(e){
    return { erro: 'Erro ao buscar no IGDB' };
  }
}

/* ============================================================
   TMDB (capa + sinopse + duração + ano de filmes)
   ============================================================ */
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
    // 1ª tentativa pt-BR com ano, 2ª sem ano, 3ª em en-US
    let d = await chamar('/search/movie', { query: nome, include_adult: 'false', ...(ano ? { year: String(ano) } : {}) });
    let filme = d.results && d.results[0];
    if(!filme){ d = await chamar('/search/movie', { query: nome, include_adult: 'false' }); filme = d.results && d.results[0]; }
    if(!filme){
      d = await chamar('/search/movie', { query: nome, include_adult: 'false', language: 'en-US' });
      filme = d.results && d.results[0];
    }
    if(!filme) return { erro: 'Filme não encontrado' };

    const det = await chamar(`/movie/${filme.id}`);
    return {
      nome: det.title || filme.title,
      capa: det.poster_path ? `https://image.tmdb.org/t/p/w500${det.poster_path}` : null,
      sinopse: det.overview || '',
      duracao: det.runtime || null,
      ano: det.release_date ? Number(det.release_date.slice(0,4)) : null
    };
  } catch(e){
    return { erro: 'Erro ao buscar no TMDB' };
  }
}

/* ============================================================
   Tradução EN→PT (LibreTranslate público — sem chave)
   ============================================================ */
async function traduzir(texto){
  try {
    const r = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texto, source: 'en', target: 'pt', format: 'text' })
    });
    const d = await r.json();
    if(d && d.translatedText) return d.translatedText;
    return null;
  } catch(e){
    // fallback: usa outro endpoint público
    try {
      const r = await fetch('https://translate.astian.org/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texto, source: 'en', target: 'pt', format: 'text' })
      });
      const d = await r.json();
      return d && d.translatedText ? d.translatedText : null;
    } catch(e2){ return null; }
  }
}

/* ============================================================
   Steam → importar jogos pra tier list
   ============================================================ */
async function importarSteam(){
  if(!STEAM_KEY) return { error: 'STEAM_API_KEY não configurada' };
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const r = await fetch(url);
  if(!r.ok) return { error: `Steam HTTP ${r.status}` };
  const sd = await r.json();
  const lista = (sd.response && sd.response.games) || [];
  const jogados = lista
    .filter(g => g.playtime_forever > 0)
    .sort((a,b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 60);

  // Pega tier list atual
  const [jogosRaw] = await redis([['GET', 'tierlist:jogos']]);
  let atuais = [];
  try { atuais = jogosRaw ? JSON.parse(jogosRaw) : []; } catch(e){}
  const existentes = new Set(atuais.map(j => (j.nome || '').toLowerCase()));

  let adicionados = 0, pulados = 0;
  for(const g of jogados){
    if(existentes.has(g.name.toLowerCase())){ pulados++; continue; }
    const capaSteam = `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`;
    // Tenta enriquecer com IGDB (nota, sinopse)
    let extra = {};
    try { extra = await igdbBuscar(g.name); } catch(e){}
    atuais.push({
      id: g.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40),
      appid: g.appid,
      nome: g.name,
      tier: 'NR',
      status: 'Jogado',
      horas: Math.round(g.playtime_forever / 6) / 10,
      progresso: 0,
      nota: extra.nota || 0,
      capa: (extra.capa) || capaSteam,
      comentario: extra.sinopse || ''
    });
    adicionados++;
    existentes.add(g.name.toLowerCase());
  }

  await redis([['SET', 'tierlist:jogos', JSON.stringify(atuais)]]);
  return { ok: true, adicionados, pulados, total: jogos.length };
}

/* ============================================================
   HANDLER PRINCIPAL
   ============================================================ */
export default async function handler(req, res){
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });

  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });
  if(!sessao.admin) return res.status(403).json({ error: 'Sem permissão' });

  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';
  const meNivel = NIVEIS[sessao.cargo] || 0;
  const quem = sessao.username || 'anônimo';

  try {
    /* ============================================================
       VOTAÇÃO
       ============================================================ */
    if(req.method === 'GET' && action === 'votos'){
      const ciclo = (await redis([['GET','votos:ciclo_atual']]))[0] || '1';
      const [usuariosRaw, contRaw, configRaw] = await redis([
        ['HGETALL', `votos_usuarios:${ciclo}`],
        ['HGETALL', `votos:${ciclo}`],
        ['GET', 'votos:config']
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
      return res.status(200).json({ ciclo, usuarios, contagem: cont, config });
    }

    if(req.method === 'POST' && action === 'opcoes'){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const opcoes = Array.isArray((req.body||{}).opcoes) ? req.body.opcoes.slice(0,5) : [];
      if(!opcoes.length) return res.status(400).json({ error: 'Nenhuma opção enviada' });

      const processadas = [];
      for(const o of opcoes){
        const nome = String(o.nome || '').trim().slice(0,80);
        if(!nome) continue;
        const tipo = (o.tipo === 'filme') ? 'filme' : 'jogo';
        const id = String(o.id || '').trim().slice(0,40) ||
          nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);
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
      if(meNivel < 3) return res.status(403).json({ error: 'Sem permissão' });
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

    /* ============================================================
       ADMINS
       ============================================================ */
    if(req.method === 'GET' && (action === 'admins' || action === 'admins-ver')){
      const [flat] = await redis([['HGETALL', 'admins']]);
      const admins = [];
      const jaVistos = new Set();
      for(const id of ENV_ADMINS){
        admins.push({ id, username: null, avatar: null, cargo: 'dev', fixo: true });
        jaVistos.add(id);
      }
      for(let i = 0; i < (flat||[]).length; i += 2){
        const id = flat[i];
        if(jaVistos.has(id)) continue;
        try {
          const d = JSON.parse(flat[i+1]);
          admins.push({ id, username: d.username || null, avatar: d.avatar || null, cargo: d.cargo || 'moderador', fixo: false });
        } catch(e){}
      }
      return res.status(200).json({ admins, meuCargo: sessao.cargo || null });
    }

    if(req.method === 'POST' && action === 'admins-add'){
      if(meNivel < 3) return res.status(403).json({ error: 'Precisa ser Dono ou Dev' });
      const { userId, cargo, username, avatar } = req.body || {};
      if(!userId || !NIVEIS[cargo]) return res.status(400).json({ error: 'Dados inválidos' });
      if(cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs criam Devs' });
      if(NIVEIS[cargo] > meNivel) return res.status(403).json({ error: 'Cargo maior que o seu' });
      if(ENV_ADMINS.includes(String(userId))) return res.status(400).json({ error: 'ID já é admin fixo (env var)' });
      const payload = JSON.stringify({ username: username || null, avatar: avatar || null, cargo, ts: Date.now() });
      await redis([['HSET', 'admins', String(userId), payload]]);
      await logAcao(quem, sessao.cargo, `Adicionou admin ${userId} (${cargo})`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'admins-edit'){
      if(meNivel < 3) return res.status(403).json({ error: 'Sem permissão' });
      const { userId, cargo, username, avatar } = req.body || {};
      if(!userId || !NIVEIS[cargo]) return res.status(400).json({ error: 'Dados inválidos' });
      if(ENV_ADMINS.includes(String(userId))) return res.status(400).json({ error: 'Admin fixo não pode ser editado' });
      if(cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs promovem a Dev' });
      if(NIVEIS[cargo] > meNivel) return res.status(403).json({ error: 'Cargo maior que o seu' });
      const [atualRaw] = await redis([['HGET', 'admins', String(userId)]]);
      let atual = {};
      try { atual = atualRaw ? JSON.parse(atualRaw) : {}; } catch(e){}
      if(atual.cargo === 'dev' && sessao.cargo !== 'dev') return res.status(403).json({ error: 'Só Devs editam Devs' });
      const payload = JSON.stringify({
        ...atual,
        username: username || atual.username || null,
        avatar: avatar || atual.avatar || null,
        cargo, ts: Date.now()
      });
      await redis([['HSET', 'admins', String(userId), payload]]);
      await logAcao(quem, sessao.cargo, `Editou admin ${userId} → ${cargo}`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'admins-remove'){
      if(meNivel < 3) return res.status(403).json({ error: 'Sem permissão' });
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

    /* ============================================================
       TIER LIST
       ============================================================ */
    if(req.method === 'GET' && (action === 'tierlist' || action === 'tierlist-get')){
      const [jogosRaw, filmesRaw] = await redis([['GET','tierlist:jogos'], ['GET','tierlist:filmes']]);
      let jogos = [], filmes = [];
      try { jogos = jogosRaw ? JSON.parse(jogosRaw) : []; } catch(e){}
      try { filmes = filmesRaw ? JSON.parse(filmesRaw) : []; } catch(e){}
      return res.status(200).json({ jogos, filmes });
    }

    if(req.method === 'POST' && (action === 'tierlist' || action === 'tierlist-set')){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const { jogos, filmes, logAcao: acao } = req.body || {};
      const cmds = [];
      if(Array.isArray(jogos)) cmds.push(['SET', 'tierlist:jogos', JSON.stringify(jogos)]);
      if(Array.isArray(filmes)) cmds.push(['SET', 'tierlist:filmes', JSON.stringify(filmes)]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada pra salvar' });
      await redis(cmds);
      if(acao) await logAcao(quem, sessao.cargo, acao);
      return res.status(200).json({ ok: true });
    }

    /* ============================================================
       BUSCAS AUTOMÁTICAS (IGDB / TMDB)
       ============================================================ */
    if(req.method === 'GET' && action === 'buscar-jogo'){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const nome = String((req.query||{}).nome || '').trim();
      if(!nome) return res.status(400).json({ erro: 'Informe um nome' });
      const d = await igdbBuscar(nome);
      return res.status(200).json(d);
    }

    if(req.method === 'GET' && action === 'buscar-filme'){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const nome = String((req.query||{}).nome || '').trim();
      const ano = (req.query||{}).ano;
      if(!nome) return res.status(400).json({ erro: 'Informe um nome' });
      const d = await tmdbBuscar(nome, ano);
      return res.status(200).json(d);
    }

    if(req.method === 'POST' && action === 'traduzir'){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const texto = String((req.body||{}).texto || '').trim();
      if(!texto) return res.status(400).json({ error: 'Nada pra traduzir' });
      const traduzido = await traduzir(texto);
      if(!traduzido) return res.status(502).json({ error: 'Tradutor indisponível' });
      return res.status(200).json({ traduzido });
    }

    /* ============================================================
       IMPORTAR DA STEAM
       ============================================================ */
    if(req.method === 'POST' && action === 'importar-steam'){
      if(meNivel < 3) return res.status(403).json({ error: 'Precisa ser Dono ou Dev' });
      const r = await importarSteam();
      if(r.error) return res.status(400).json(r);
      await logAcao(quem, sessao.cargo, `Importou ${r.adicionados} jogos da Steam (${r.pulados} já existiam)`);
      return res.status(200).json(r);
    }

    /* ============================================================
       SUGESTÕES / ATIVIDADE
       ============================================================ */
    if(req.method === 'GET' && action === 'sugestoes-ver'){
      if(meNivel < 1) return res.status(403).json({ error: 'Sem permissão' });
      // Lê do StreamElements, se estiver configurado
      const jwt = process.env.SE_JWT, canal = process.env.SE_CHANNEL_ID;
      if(!jwt || !canal){
        return res.status(200).json({ itens: [], aviso: 'StreamElements não configurado' });
      }
      try {
        const r = await fetch(`https://api.streamelements.com/kappa/v2/activities/${canal}?limit=100`, {
          headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' }
        });
        if(!r.ok) return res.status(200).json({ itens: [], aviso: `StreamElements HTTP ${r.status}` });
        const lista = await r.json();
        const MAPA = { subscriber:'subscriber', tip:'tip', raid:'raid', host:'raid', follow:'follow', cheer:'cheer' };
        const vistos = {}, itens = [];
        for(const a of (Array.isArray(lista) ? lista : [])){
          const tipo = MAPA[a.type];
          if(!tipo || vistos[tipo]) continue;
          vistos[tipo] = true;
          const d = a.data || {};
          itens.push({
            tipo,
            usuario: d.displayName || d.username || 'alguém',
            valor: d.amount || null,
            data: a.createdAt
          });
        }
        return res.status(200).json({ itens });
      } catch(e){
        return res.status(200).json({ itens: [], aviso: 'Erro ao consultar StreamElements' });
      }
    }

    /* ============================================================
       BANIDOS
       ============================================================ */
    if(req.method === 'GET' && action === 'banidos-ver'){
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
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const { userId, motivo, username, avatar } = req.body || {};
      if(!userId) return res.status(400).json({ error: 'ID obrigatório' });
      const payload = JSON.stringify({ username: username || null, avatar: avatar || null, motivo: motivo || null, ts: Date.now() });
      await redis([['HSET', 'banidos', String(userId), payload]]);
      await logAcao(quem, sessao.cargo, `Baniu ${userId} (${motivo || 'sem motivo'})`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'banidos-remove'){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const { userId } = req.body || {};
      if(!userId) return res.status(400).json({ error: 'ID obrigatório' });
      await redis([['HDEL', 'banidos', String(userId)]]);
      await logAcao(quem, sessao.cargo, `Desbaniu ${userId}`);
      return res.status(200).json({ ok: true });
    }

    /* ============================================================
       CONFIG GERAL
       ============================================================ */
    if(req.method === 'GET' && action === 'config-get'){
      const [avisoRaw, donateRaw, manutRaw] = await redis([
        ['GET', 'config:aviso'],
        ['GET', 'config:donate'],
        ['GET', 'config:manutencao']
      ]);
      let aviso = null;
      try { aviso = avisoRaw ? JSON.parse(avisoRaw) : null; } catch(e){}
      return res.status(200).json({
        aviso,
        donate: donateRaw || null,
        manutencao: manutRaw === '1'
      });
    }

    if(req.method === 'POST' && action === 'config-set'){
      if(meNivel < 3) return res.status(403).json({ error: 'Sem permissão' });
      const { aviso, donate, manutencao } = req.body || {};
      const cmds = [];
      if(aviso !== undefined) cmds.push(['SET', 'config:aviso', JSON.stringify(aviso)]);
      if(donate !== undefined) cmds.push(['SET', 'config:donate', String(donate || '')]);
      if(manutencao !== undefined) cmds.push(['SET', 'config:manutencao', manutencao ? '1' : '0']);
      if(!cmds.length) return res.status(400).json({ error: 'Nada pra salvar' });
      await redis(cmds);
      await logAcao(quem, sessao.cargo, `Salvou config geral${manutencao ? ' (manutenção LIGADA)' : ''}`);
      return res.status(200).json({ ok: true });
    }

    /* ============================================================
       LOGS
       ============================================================ */
    if(req.method === 'GET' && action === 'logs-ver'){
      if(meNivel < 2) return res.status(403).json({ error: 'Sem permissão' });
      const [flat] = await redis([['LRANGE', 'admin:logs', '0', '49']]);
      const logs = (flat || []).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
      return res.status(200).json({ logs });
    }

    return res.status(400).json({ error: 'Ação inválida: ' + action });
  } catch(e){
    return res.status(500).json({ error: 'Erro no admin: ' + e.message });
  }
}