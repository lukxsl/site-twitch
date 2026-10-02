// Vercel serverless: /api/admin.js
// Painel admin: ver votos, editar opções, resetar.
// Env: UPSTASH_REDIS_REST_URL/TOKEN, SESSION_SECRET, TWITCH_CLIENT_ID/SECRET, TMDB_TOKEN
import { createHmac } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-isso-urgente';
const COOKIE_NAME = 'sessao_site';
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

// ---------- Buscas automáticas de capa ----------
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

async function buscarCapaJogo(nome){
  if(!TWITCH_ID || !TWITCH_SECRET) return null;
  try{
    const token = await igdbToken();
    const r = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': TWITCH_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: `search "${String(nome).replace(/"/g,'')}"; fields name, cover.url; limit 1;`
    });
    const d = await r.json();
    const g = Array.isArray(d) ? d[0] : null;
    if(!g || !g.cover || !g.cover.url) return null;
    return `https:${g.cover.url.replace('t_thumb','t_cover_big').replace('t_cover_small','t_cover_big')}`;
  }catch(e){ return null; }
}

async function buscarCapaFilme(nome){
  if(!TMDB_TOKEN && !TMDB_KEY) return null;
  try{
    const u = new URL('https://api.themoviedb.org/3/search/movie');
    u.searchParams.set('query', nome);
    u.searchParams.set('language', 'pt-BR');
    if(!TMDB_TOKEN) u.searchParams.set('api_key', TMDB_KEY);
    const r = await fetch(u, { headers: TMDB_TOKEN ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {} });
    const d = await r.json();
    const f = d.results && d.results[0];
    if(!f || !f.poster_path) return null;
    return `https://image.tmdb.org/t/p/w500${f.poster_path}`;
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
    // -------- Ver quem votou --------
    if(req.method === 'GET' && action === 'votos'){
      const ciclo = (await redis([['GET','votos:ciclo_atual']]))[0] || '1';
      const kUsuarios = `votos_usuarios:${ciclo}`;
      const kCont = `votos:${ciclo}`;
      const kConfig = 'votos:config';

      const [usuariosRaw, contRaw, configRaw] = await redis([
        ['HGETALL', kUsuarios],
        ['HGETALL', kCont],
        ['GET', kConfig]
      ]);

      // usuariosRaw = [userId1, idOpcao1, userId2, idOpcao2, ...]
      const usuarios = [];
      for(let i = 0; i < (usuariosRaw||[]).length; i += 2){
        usuarios.push({ userId: usuariosRaw[i], opcao: usuariosRaw[i+1] });
      }

      const cont = {};
      for(let i = 0; i < (contRaw||[]).length; i += 2){
        cont[contRaw[i]] = Number(contRaw[i+1]);
      }

      let config = null;
      try { config = configRaw ? JSON.parse(configRaw) : null; } catch(e){}

      return res.status(200).json({
        ciclo,
        usuarios,      // [{userId, opcao}]
        contagem: cont,// {idOpcao: votos}
        config         // null se não foi customizada ainda
      });
    }

    // -------- Salvar novas opções --------
    if(req.method === 'POST' && action === 'opcoes'){
      const body = req.body || {};
      const opcoes = Array.isArray(body.opcoes) ? body.opcoes.slice(0, 5) : [];
      if(!opcoes.length) return res.status(400).json({ error: 'Nenhuma opção enviada' });

      // Valida + gera capas
      const processadas = [];
      for(const o of opcoes){
        const nome = String(o.nome || '').trim().slice(0, 80);
        if(!nome) continue;
        const tipo = (o.tipo === 'filme') ? 'filme' : 'jogo';
        const id = String(o.id || '').trim().slice(0, 40) ||
                   nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);

        // Só busca capa se admin não forneceu uma manual
        let capa = String(o.capa || '').trim();
        if(!capa){
          capa = tipo === 'filme' ? await buscarCapaFilme(nome) : await buscarCapaJogo(nome);
        }

        processadas.push({ id, nome, tipo, capa: capa || null });
      }

      if(!processadas.length) return res.status(400).json({ error: 'Nenhuma opção válida' });

      await redis([['SET', 'votos:config', JSON.stringify(processadas)]]);
      return res.status(200).json({ ok: true, opcoes: processadas });
    }

    // -------- Resetar votação --------
    if(req.method === 'POST' && action === 'reset'){
      const cicloAtual = Number((await redis([['GET','votos:ciclo_atual']]))[0]) || 1;
      const novo = cicloAtual + 1;

      // Apaga as contagens antigas + usuários do ciclo atual
      await redis([
        ['DEL', `votos:${cicloAtual}`],
        ['DEL', `votos_usuarios:${cicloAtual}`],
        ['SET', 'votos:ciclo_atual', String(novo)]
      ]);

      return res.status(200).json({ ok: true, novoCiclo: novo });
    }

    // -------- Lista de admins (útil pra Fase 3) --------
    if(req.method === 'GET' && action === 'admins'){
      return res.status(200).json({ admins: [] }); // placeholder
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch(e){
    return res.status(500).json({ error: 'Erro no admin: ' + e.message });
  }
}