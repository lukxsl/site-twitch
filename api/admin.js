// Vercel serverless: /api/admin.js
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
const SE_JWT = process.env.SE_JWT;
const SE_CHANNEL_ID = process.env.SE_CHANNEL_ID;

const NIVEIS = { dev: 4, dono: 3, administrador: 2, moderador: 1 };
const EXIGE = {
  'votos': 1, 'admins-ver': 1, 'logs-ver': 2, 'sugestoes-ver': 2,
  'opcoes': 2, 'reset': 3, 'tierlist-get': 2, 'tierlist-set': 2,
  'buscar-jogo': 2, 'buscar-filme': 2, 'traduzir': 2,
  'config-get': 1, 'config-set': 3,
  'importar-steam': 3,
  'banidos-ver': 1, 'banidos-add': 2, 'banidos-remove': 2,
  'admins-add': 3, 'admins-remove': 3, 'admins-edit': 3
};

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
function normNome(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40); }

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

// Registra log de ação
async function logarAcao(quem, cargo, o_que){
  try {
    const item = JSON.stringify({
      quem, cargo, acao: o_que, ts: Date.now()
    });
    await redis([
      ['LPUSH', 'logs', item],
      ['LTRIM', 'logs', '0', '499']
    ]);
  } catch(e){}
}

// ---------- IGDB / TMDB / Steam ----------
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
async function igdbRequest(endpoint, body){
  const token = await igdbToken();
  const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body
  });
  return r.json();
}
async function buscarJogoIGDB(nome){
  if(!TWITCH_ID || !TWITCH_SECRET) return null;
  try{
    const d = await igdbRequest('games',
      `search "${String(nome).replace(/"/g,'')}"; fields name, rating, cover.url, summary, first_release_date; limit 1;`);
    const g = Array.isArray(d) ? d[0] : null;
    if(!g) return null;
    const capa = g.cover && g.cover.url
      ? `https:${g.cover.url.replace('t_thumb','t_cover_big').replace('t_cover_small','t_cover_big')}` : null;
    let sinopse = g.summary || '';
    try {
      const loc = await igdbRequest('game_localizations',
        `fields summary; where game = ${g.id} & language = "pt-BR"; limit 1;`);
      if (Array.isArray(loc) && loc[0] && loc[0].summary) sinopse = loc[0].summary;
    } catch(e){}
    return { nome: g.name, nota: g.rating ? Math.round(g.rating)/10 : null, capa, sinopse,
      ano: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null };
  }catch(e){ return null; }
}
async function buscarFilmeTMDB(nome){
  if(!TMDB_TOKEN && !TMDB_KEY) return { erro: 'TMDB não configurado' };
  try{
    const u = new URL('https://api.themoviedb.org/3/search/movie');
    u.searchParams.set('query', nome);
    u.searchParams.set('language', 'pt-BR');
    if(!TMDB_TOKEN) u.searchParams.set('api_key', TMDB_KEY);
    const r = await fetch(u, { headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {} });
    if(!r.ok) return { erro: `TMDB HTTP ${r.status}` };
    const d = await r.json();
    const f = d.results && d.results[0];
    if(!f) return { erro: 'Não encontrado' };
    const u2 = new URL(`https://api.themoviedb.org/3/movie/${f.id}`);
    u2.searchParams.set('language', 'pt-BR');
    if(!TMDB_TOKEN) u2.searchParams.set('api_key', TMDB_KEY);
    const r2 = await fetch(u2, { headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {} });
    const d2 = await r2.json();
    return {
      nome: d2.title || f.title,
      ano: (d2.release_date || f.release_date || '').slice(0,4),
      capa: d2.poster_path ? `https://image.tmdb.org/t/p/w500${d2.poster_path}` : (f.poster_path ? `https://image.tmdb.org/t/p/w500${f.poster_path}` : null),
      duracao: d2.runtime || null,
      sinopse: d2.overview || f.overview || '',
      tmdbId: f.id
    };
  }catch(e){ return { erro: e.message }; }
}
async function traduzir(texto){
  if(!texto) return null;
  try{
    const u = new URL('https://api.mymemory.translated.net/get');
    u.searchParams.set('q', String(texto).slice(0, 450));
    u.searchParams.set('langpair', 'en|pt-BR');
    const r = await fetch(u);
    const d = await r.json();
    return d && d.responseData && d.responseData.translatedText ? d.responseData.translatedText : null;
  }catch(e){ return null; }
}

async function importarSteam(){
  if(!STEAM_KEY) throw new Error('STEAM_API_KEY não configurada');
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
  const r = await fetch(url);
  if(!r.ok) throw new Error(`Steam HTTP ${r.status}`);
  const sd = await r.json();
  const lista = (sd.response && sd.response.games) || [];
  if(!lista.length) throw new Error('Nenhum jogo público na Steam');

  const jogados = lista.filter(g => g.playtime_forever > 0)
    .sort((a,b) => b.playtime_forever - a.playtime_forever).slice(0, 100);

  const igdbData = {};
  if(TWITCH_ID && TWITCH_SECRET){
    try {
      const lotes = [];
      const nomes = jogados.map(g => g.name.replace(/"/g,'').trim());
      for(let i = 0; i < nomes.length; i += 40) lotes.push(nomes.slice(i, i+40));
      for(const lote of lotes){
        const filtro = lote.map(n => `"${n}"`).join(',');
        const d = await igdbRequest('games',
          `fields name, rating, cover.url, summary; where name = (${filtro}); limit 500;`);
        if(Array.isArray(d)){
          for(const g of d){
            const capa = g.cover && g.cover.url
              ? `https:${g.cover.url.replace('t_thumb','t_cover_big').replace('t_cover_small','t_cover_big')}` : null;
            igdbData[g.name.toLowerCase()] = { nota: g.rating ? Math.round(g.rating)/10 : null, capa, sinopse: g.summary || '' };
          }
        }
      }
    } catch(e){}
  }

  const [jogosRaw] = await redis([['GET','tierlist:jogos']]);
  let jogos = [];
  try { if(jogosRaw) jogos = JSON.parse(jogosRaw); } catch(e){}
  if(!Array.isArray(jogos)) jogos = [];

  const existentes = new Set(jogos.map(j => normNome(j.nome)));
  let adicionados = 0, pulados = 0;

  for(const g of jogados){
    const nomeN = normNome(g.name);
    if(existentes.has(nomeN)){ pulados++; continue; }
    const extra = igdbData[g.name.toLowerCase()] || {};
    jogos.push({
      id: nomeN, nome: g.name, appid: g.appid, tier: 'NR',
      status: (g.playtime_2weeks || 0) > 0 ? 'Jogando' : 'Jogado',
      horas: Math.round(g.playtime_forever / 6) / 10,
      nota: extra.nota || 0,
      capa: extra.capa || `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/library_600x900.jpg`,
      comentario: extra.sinopse || ''
    });
    existentes.add(nomeN);
    adicionados++;
  }
  await redis([['SET','tierlist:jogos', JSON.stringify(jogos)]]);
  return { adicionados, pulados, total: jogos.length };
}

// ---------- Admins ----------
async function listarAdmins(){
  const [flat] = await redis([['HGETALL', 'admins']]);
  const admins = [];
  for(let i = 0; i < (flat||[]).length; i += 2){
    try {
      const d = JSON.parse(flat[i+1]);
      admins.push({ id: flat[i], cargo: d.cargo || 'moderador', username: d.username || null, avatar: d.avatar || null });
    } catch(e){}
  }
  const ordem = { dev: 0, dono: 1, administrador: 2, moderador: 3 };
  admins.sort((a,b) => (ordem[a.cargo] ?? 9) - (ordem[b.cargo] ?? 9));
  return admins;
}

// ---------- Sugestões (lê do StreamElements) ----------
async function listarSugestoes(){
  if(!SE_JWT || !SE_CHANNEL_ID) return { itens: [], aviso: 'StreamElements não configurado' };
  try {
    const r = await fetch(`https://api.streamelements.com/kappa/v2/activities/${SE_CHANNEL_ID}?limit=100`, {
      headers: { Authorization: `Bearer ${SE_JWT}`, Accept: 'application/json' }
    });
    if(!r.ok) return { itens: [], aviso: `SE HTTP ${r.status}` };
    const lista = await r.json();
    const itens = (Array.isArray(lista) ? lista : []).map(a => ({
      tipo: a.type,
      usuario: (a.data && (a.data.displayName || a.data.username)) || 'alguém',
      valor: (a.data && a.data.amount) || null,
      data: a.createdAt
    }));
    return { itens };
  } catch(e){ return { itens: [], aviso: e.message }; }
}

// ---------- Handler ----------
export default async function handler(req, res){
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });
  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });

  let cargo = sessao.cargo;
  try {
    const [raw] = await redis([['HGET', 'admins', sessao.id]]);
    if(raw){ const d = JSON.parse(raw); cargo = d.cargo; }
    else cargo = null;
  } catch(e){}

  if(!cargo) return res.status(403).json({ error: 'Sem permissão' });

  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';

  const nivel = NIVEIS[cargo] || 0;
  const nivelNecessario = EXIGE[action] || 99;
  if(nivel < nivelNecessario) return res.status(403).json({ error: 'Sem permissão para esta ação' });

  try {
    // ============ VOTOS ============
    if(req.method === 'GET' && action === 'votos'){
      const ciclo = (await redis([['GET','votos:ciclo_atual']]))[0] || '1';
      const [usuariosRaw, contRaw, configRaw] = await redis([
        ['HGETALL', `votos_usuarios:${ciclo}`],
        ['HGETALL', `votos:${ciclo}`],
        ['GET', 'votos:config']
      ]);
      const usuarios = [];
      for(let i = 0; i < (usuariosRaw||[]).length; i += 2){
        const userId = usuariosRaw[i];
        let raw = usuariosRaw[i+1], dados;
        try { dados = JSON.parse(raw); if(!dados || !dados.opcao) dados = { opcao: raw }; }
        catch(e){ dados = { opcao: raw }; }
        usuarios.push({ userId, opcao: dados.opcao, username: dados.username||null, avatar: dados.avatar||null, ts: dados.ts||null });
      }
      usuarios.sort((a,b) => (b.ts||0) - (a.ts||0));
      const cont = {};
      for(let i = 0; i < (contRaw||[]).length; i += 2) cont[contRaw[i]] = Number(contRaw[i+1]);
      let config = null;
      try { config = configRaw ? JSON.parse(configRaw) : null; } catch(e){}
      return res.status(200).json({ ciclo, usuarios, contagem: cont, config });
    }

    if(req.method === 'POST' && action === 'opcoes'){
      const opcoes = Array.isArray((req.body||{}).opcoes) ? req.body.opcoes.slice(0, 5) : [];
      if(!opcoes.length) return res.status(400).json({ error: 'Nenhuma opção enviada' });
      const processadas = [];
      for(const o of opcoes){
        const nome = String(o.nome || '').trim().slice(0, 80);
        if(!nome) continue;
        const tipo = (o.tipo === 'filme') ? 'filme' : 'jogo';
        const id = String(o.id || '').trim().slice(0, 40) || normNome(nome);
        let capa = String(o.capa || '').trim();
        if(!capa){
          if (tipo === 'filme') { const r2 = await buscarFilmeTMDB(nome); capa = (r2 && r2.capa) || null; }
          else { const r2 = await buscarJogoIGDB(nome); capa = (r2 && r2.capa) || null; }
        }
        processadas.push({ id, nome, tipo, capa: capa || null });
      }
      if(!processadas.length) return res.status(400).json({ error: 'Nenhuma opção válida' });
      await redis([['SET', 'votos:config', JSON.stringify(processadas)]]);
      await logarAcao(sessao.username, cargo, 'Editou opções da votação');
      return res.status(200).json({ ok: true, opcoes: processadas });
    }

    if(req.method === 'POST' && action === 'reset'){
      const cicloAtual = Number((await redis([['GET','votos:ciclo_atual']]))[0]) || 1;
      const novo = cicloAtual + 1;
      await redis([
        ['DEL', `votos:${cicloAtual}`],
        ['DEL', `votos_usuarios:${cicloAtual}`],
        ['SET', 'votos:ciclo_atual', String(novo)]
      ]);
      await logarAcao(sessao.username, cargo, 'Resetou a votação');
      return res.status(200).json({ ok: true, novoCiclo: novo });
    }

    // ============ TIER LIST ============
    if(req.method === 'GET' && action === 'tierlist-get'){
      const [jogosRaw, filmesRaw] = await redis([
        ['GET', 'tierlist:jogos'], ['GET', 'tierlist:filmes']
      ]);
      let jogos = [], filmes = [];
      try { if(jogosRaw) jogos = JSON.parse(jogosRaw); } catch(e){}
      try { if(filmesRaw) filmes = JSON.parse(filmesRaw); } catch(e){}
      return res.status(200).json({ jogos: Array.isArray(jogos)?jogos:[], filmes: Array.isArray(filmes)?filmes:[] });
    }

    if(req.method === 'POST' && action === 'tierlist-set'){
      const { jogos, filmes, logAcao } = req.body || {};
      const cmds = [];
      if(Array.isArray(jogos)) cmds.push(['SET', 'tierlist:jogos', JSON.stringify(jogos)]);
      if(Array.isArray(filmes)) cmds.push(['SET', 'tierlist:filmes', JSON.stringify(filmes)]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada para salvar' });
      await redis(cmds);
      if(logAcao) await logarAcao(sessao.username, cargo, logAcao);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'importar-steam'){
      const d = await importarSteam();
      await logarAcao(sessao.username, cargo, `Importou da Steam (${d.adicionados} novos, ${d.pulados} pulados)`);
      return res.status(200).json({ ok: true, ...d });
    }

    // ============ BUSCAS ============
    if(req.method === 'GET' && action === 'buscar-jogo'){
      const nome = String((req.query && req.query.nome) || '').trim();
      if(!nome) return res.status(400).json({ error: 'Informe o nome' });
      const d = await buscarJogoIGDB(nome);
      return res.status(200).json(d || { erro: 'Não encontrado' });
    }
    if(req.method === 'GET' && action === 'buscar-filme'){
      const nome = String((req.query && req.query.nome) || '').trim();
      if(!nome) return res.status(400).json({ error: 'Informe o nome' });
      const d = await buscarFilmeTMDB(nome);
      return res.status(200).json(d);
    }
    if(req.method === 'POST' && action === 'traduzir'){
      const texto = String((req.body||{}).texto || '').trim();
      if(!texto) return res.status(400).json({ error: 'Nada para traduzir' });
      const t = await traduzir(texto);
      return res.status(200).json({ traduzido: t });
    }

    // ============ CONFIG ============
    if(req.method === 'GET' && action === 'config-get'){
      const [aviso, donate, manutencao] = await redis([
        ['GET', 'config:aviso'],
        ['GET', 'config:donate'],
        ['GET', 'config:manutencao']
      ]);
      let avisoObj = null;
      try { avisoObj = aviso ? JSON.parse(aviso) : null; } catch(e){}
      return res.status(200).json({
        aviso: avisoObj,
        donate: donate || null,
        manutencao: manutencao === 'true'
      });
    }

    if(req.method === 'POST' && action === 'config-set'){
      const { aviso, donate, manutencao } = req.body || {};
      const cmds = [];
      if(aviso !== undefined) cmds.push(['SET', 'config:aviso', JSON.stringify(aviso || {})]);
      if(donate !== undefined) cmds.push(['SET', 'config:donate', String(donate || '')]);
      if(manutencao !== undefined) cmds.push(['SET', 'config:manutencao', manutencao ? 'true' : 'false']);
      if(!cmds.length) return res.status(400).json({ error: 'Nada para salvar' });
      await redis(cmds);
      await logarAcao(sessao.username, cargo,
        manutencao !== undefined ? `Manutenção ${manutencao ? 'LIGADA' : 'desligada'}` : 'Editou config geral');
      return res.status(200).json({ ok: true });
    }

    // ============ LOGS ============
    if(req.method === 'GET' && action === 'logs-ver'){
      const [flat] = await redis([['LRANGE', 'logs', '0', '99']]);
      const logs = (flat || []).map(x => { try { return JSON.parse(x); } catch(e){ return null; } }).filter(Boolean);
      return res.status(200).json({ logs });
    }

    // ============ SUGESTÕES ============
    if(req.method === 'GET' && action === 'sugestoes-ver'){
      const d = await listarSugestoes();
      return res.status(200).json(d);
    }

    // ============ BANIDOS ============
    if(req.method === 'GET' && action === 'banidos-ver'){
      const [flat] = await redis([['HGETALL', 'banidos']]);
      const banidos = [];
      for(let i = 0; i < (flat||[]).length; i += 2){
        try {
          const d = JSON.parse(flat[i+1]);
          banidos.push({ id: flat[i], username: d.username, avatar: d.avatar, motivo: d.motivo, ts: d.ts });
        } catch(e){}
      }
      banidos.sort((a,b) => (b.ts||0) - (a.ts||0));
      return res.status(200).json({ banidos });
    }

    if(req.method === 'POST' && action === 'banidos-add'){
      const { userId, motivo, username, avatar } = req.body || {};
      const id = String(userId||'').trim();
      if(!id) return res.status(400).json({ error: 'ID inválido' });
      if(id === sessao.id) return res.status(400).json({ error: 'Não pode se banir' });

      // Admin não pode banir outro admin de cargo maior/igual
      const [raw] = await redis([['HGET', 'admins', id]]);
      if(raw && cargo !== 'dev'){
        const alvo = JSON.parse(raw);
        if((NIVEIS[alvo.cargo] || 0) >= nivel) return res.status(403).json({ error: 'Não pode banir alguém de cargo igual ou maior' });
      }

      const payload = JSON.stringify({
        username: String(username||'').trim().slice(0,40) || null,
        avatar: String(avatar||'').trim() || null,
        motivo: String(motivo||'').trim().slice(0,200) || 'Sem motivo',
        ts: Date.now()
      });
      await redis([['HSET', 'banidos', id, payload]]);
      await logarAcao(sessao.username, cargo, `Baniu ${id} (${motivo || 'sem motivo'})`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'banidos-remove'){
      const { userId } = req.body || {};
      const id = String(userId||'').trim();
      if(!id) return res.status(400).json({ error: 'ID inválido' });
      await redis([['HDEL', 'banidos', id]]);
      await logarAcao(sessao.username, cargo, `Desbaniu ${id}`);
      return res.status(200).json({ ok: true });
    }

    // ============ ADMINS ============
    if(req.method === 'GET' && action === 'admins-ver'){
      const admins = await listarAdmins();
      return res.status(200).json({ admins, meuCargo: cargo });
    }

    if(req.method === 'POST' && action === 'admins-add'){
      const { userId, cargo: novoCargo, username, avatar } = req.body || {};
      const id = String(userId || '').trim();
      const cg = String(novoCargo || '').trim();
      if(!id || !NIVEIS[cg]) return res.status(400).json({ error: 'ID ou cargo inválido' });
      if(cg === 'dev' && cargo !== 'dev') return res.status(403).json({ error: 'Só Dev pode criar outro Dev' });
      if(cargo !== 'dev' && NIVEIS[cg] >= NIVEIS[cargo]) return res.status(403).json({ error: 'Cargo igual ou maior que o seu' });

      const payload = JSON.stringify({
        cargo: cg,
        username: String(username||'').trim().slice(0,40) || null,
        avatar: String(avatar||'').trim() || null
      });
      await redis([['HSET', 'admins', id, payload]]);
      await logarAcao(sessao.username, cargo, `Adicionou admin ${id} (${cg})`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'admins-edit'){
      const { userId, cargo: novoCargo, username, avatar } = req.body || {};
      const id = String(userId || '').trim();
      const cg = String(novoCargo || '').trim();
      if(!id || !NIVEIS[cg]) return res.status(400).json({ error: 'ID ou cargo inválido' });
      if(id === sessao.id && NIVEIS[cg] < NIVEIS[cargo]) return res.status(400).json({ error: 'Você não pode se rebaixar' });
      if(cg === 'dev' && cargo !== 'dev') return res.status(403).json({ error: 'Só Dev pode promover a Dev' });

      const [raw] = await redis([['HGET', 'admins', id]]);
      if(raw){
        const atual = JSON.parse(raw);
        if(cargo !== 'dev' && (NIVEIS[atual.cargo] || 0) >= NIVEIS[cargo]) {
          return res.status(403).json({ error: 'Cargo igual ou maior' });
        }
      }

      const payload = JSON.stringify({
        cargo: cg,
        username: String(username||'').trim().slice(0,40) || null,
        avatar: String(avatar||'').trim() || null
      });
      await redis([['HSET', 'admins', id, payload]]);
      await logarAcao(sessao.username, cargo, `Editou admin ${id} pra ${cg}`);
      return res.status(200).json({ ok: true });
    }

    if(req.method === 'POST' && action === 'admins-remove'){
      const { userId } = req.body || {};
      const id = String(userId || '').trim();
      if(!id) return res.status(400).json({ error: 'ID inválido' });
      if(id === sessao.id) return res.status(400).json({ error: 'Não pode se remover' });

      const [raw] = await redis([['HGET', 'admins', id]]);
      if(!raw) return res.status(200).json({ ok: true });
      const alvo = JSON.parse(raw);
      if(cargo !== 'dev' && (NIVEIS[alvo.cargo] || 0) >= NIVEIS[cargo]) {
        return res.status(403).json({ error: 'Cargo igual ou maior' });
      }
      await redis([['HDEL', 'admins', id]]);
      await logarAcao(sessao.username, cargo, `Removeu admin ${id}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch(e){
    return res.status(500).json({ error: 'Erro: ' + e.message });
  }
}