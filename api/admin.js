// Vercel serverless: /api/admin.js
import { createHmac } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-isso-urgente';
const COOKIE_NAME = 'sessao_site';
const ADMIN_IDS = (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const TWITCH_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
const TMDB_KEY = process.env.TMDB_API_KEY;

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

// ---------- IGDB ----------
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
      `search "${String(nome).replace(/"/g,'')}"; fields name, rating, cover.url, summary, first_release_date; limit 1;`
    );
    const g = Array.isArray(d) ? d[0] : null;
    if(!g) return null;

    const capa = g.cover && g.cover.url
      ? `https:${g.cover.url.replace('t_thumb','t_cover_big').replace('t_cover_small','t_cover_big')}`
      : null;

    // Tenta tradução PT-BR do IGDB
    let sinopse = g.summary || '';
    try {
      const loc = await igdbRequest('game_localizations',
        `fields summary; where game = ${g.id} & language = "pt-BR"; limit 1;`
      );
      if (Array.isArray(loc) && loc[0] && loc[0].summary) {
        sinopse = loc[0].summary;
      }
    } catch(e){}

    return {
      nome: g.name,
      nota: g.rating ? Math.round(g.rating) / 10 : null,
      capa,
      sinopse,
      ano: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
      igdbId: g.id
    };
  }catch(e){ return null; }
}

// ---------- TMDB ----------
async function buscarFilmeTMDB(nome){
  if(!TMDB_TOKEN && !TMDB_KEY) return { erro: 'TMDB não configurado (sem TMDB_TOKEN nem TMDB_API_KEY)' };
  try{
    const u = new URL('https://api.themoviedb.org/3/search/movie');
    u.searchParams.set('query', nome);
    u.searchParams.set('language', 'pt-BR');
    if(!TMDB_TOKEN) u.searchParams.set('api_key', TMDB_KEY);
    const r = await fetch(u, { headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {} });
    if(!r.ok) return { erro: `TMDB respondeu HTTP ${r.status}` };
    const d = await r.json();
    const f = d.results && d.results[0];
    if(!f) return { erro: 'Filme não encontrado' };

    // Pega detalhes pra ter duração
    const u2 = new URL(`https://api.themoviedb.org/3/movie/${f.id}`);
    u2.searchParams.set('language', 'pt-BR');
    if(!TMDB_TOKEN) u2.searchParams.set('api_key', TMDB_KEY);
    const r2 = await fetch(u2, { headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {} });
    const d2 = await r2.json();

    return {
      nome: d2.title || f.title,
      ano: (d2.release_date || f.release_date || '').slice(0, 4),
      capa: d2.poster_path ? `https://image.tmdb.org/t/p/w500${d2.poster_path}` : (f.poster_path ? `https://image.tmdb.org/t/p/w500${f.poster_path}` : null),
      duracao: d2.runtime || null,
      sinopse: d2.overview || f.overview || '',
      tmdbId: f.id
    };
  }catch(e){ return { erro: 'Erro: ' + e.message }; }
}

// ---------- Tradução (MyMemory) ----------
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

// ---------- Handler ----------
export default async function handler(req, res){
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });

  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });
  if(!sessao.admin) return res.status(403).json({ error: 'Sem permissão' });

  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';

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
        const id = String(o.id || '').trim().slice(0, 40) ||
          nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);

        let capa = String(o.capa || '').trim();
        if(!capa){
          if (tipo === 'filme') {
            const res2 = await buscarFilmeTMDB(nome);
            capa = (res2 && res2.capa) || null;
          } else {
            const res2 = await buscarJogoIGDB(nome);
            capa = (res2 && res2.capa) || null;
          }
        }
        processadas.push({ id, nome, tipo, capa: capa || null });
      }
      if(!processadas.length) return res.status(400).json({ error: 'Nenhuma opção válida' });
      await redis([['SET', 'votos:config', JSON.stringify(processadas)]]);
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
      return res.status(200).json({ ok: true, novoCiclo: novo });
    }

    // ============ TIER LIST ============
    if(req.method === 'GET' && action === 'tierlist'){
      const [jogosRaw, filmesRaw] = await redis([
        ['GET', 'tierlist:jogos'],
        ['GET', 'tierlist:filmes']
      ]);
      let jogos = [], filmes = [];
      try { if(jogosRaw) jogos = JSON.parse(jogosRaw); } catch(e){}
      try { if(filmesRaw) filmes = JSON.parse(filmesRaw); } catch(e){}
      return res.status(200).json({ jogos: Array.isArray(jogos)?jogos:[], filmes: Array.isArray(filmes)?filmes:[] });
    }

    if(req.method === 'POST' && action === 'tierlist'){
      const { jogos, filmes } = req.body || {};
      const cmds = [];
      if(Array.isArray(jogos)) cmds.push(['SET', 'tierlist:jogos', JSON.stringify(jogos)]);
      if(Array.isArray(filmes)) cmds.push(['SET', 'tierlist:filmes', JSON.stringify(filmes)]);
      if(!cmds.length) return res.status(400).json({ error: 'Nada para salvar' });
      await redis(cmds);
      return res.status(200).json({ ok: true });
    }

    // ============ BUSCAS AUTOMÁTICAS ============
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

    // ============ ADMINS ============
    if(req.method === 'GET' && action === 'admins'){
      return res.status(200).json({ admins: ADMIN_IDS.map(id => ({ id })) });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch(e){
    return res.status(500).json({ error: 'Erro: ' + e.message });
  }
}