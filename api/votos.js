// Vercel serverless: /api/votos.js
import { createHmac, timingSafeEqual } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sessao_site';

const OPCOES_PADRAO = [
  { id: 'hollow-knight', nome: 'Hollow Knight', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
  { id: 'phasmophobia', nome: 'Phasmophobia', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/739630/library_600x900.jpg' },
  { id: 'stardew-valley', nome: 'Stardew Valley', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg' }
];

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

async function rateLimitOk(chave, limite, janelaSeg){
  try {
    const [n] = await redis([['INCR', chave]]);
    if(Number(n) === 1) await redis([['EXPIRE', chave, String(janelaSeg)]]);
    return Number(n) <= limite;
  } catch(e){ return true; }
}

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

function safeId(v, max = 40) { return String(v == null ? '' : v).trim().slice(0, max); }
function safeStr(v, max = 100) { return String(v == null ? '' : v).trim().slice(0, max); }
function safeUrl(v) {
  const s = safeStr(v, 500);
  if(!s) return null;
  if(!/^https?:\/\//i.test(s)) return null;
  return s;
}

async function pegarOpcoes(){
  const [raw] = await redis([['GET','votos:config']]);
  if(!raw) return OPCOES_PADRAO;
  try{
    const d = JSON.parse(raw);
    if(!Array.isArray(d) || !d.length) return OPCOES_PADRAO;
    return d.slice(0, 10).map(o => ({
      id: safeId(o.id) || safeId(o.nome),
      nome: safeStr(o.nome, 80),
      tipo: o.tipo === 'filme' ? 'filme' : 'jogo',
      capa: safeUrl(o.capa)
    })).filter(o => o.id && o.nome);
  }catch(e){ return OPCOES_PADRAO; }
}

async function pegarCiclo(){
  const [raw] = await redis([['GET','votos:ciclo_atual']]);
  const n = Number(raw);
  return String(Number.isFinite(n) && n > 0 ? n : 1);
}

function lerVoto(raw){
  if(!raw) return null;
  try {
    const d = JSON.parse(raw);
    return d && d.opcao ? d : { opcao: raw };
  } catch(e){ return { opcao: raw }; }
}

export default async function handler(req, res){
  if(!SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });
  res.setHeader('Cache-Control', 'no-store');

  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login com o Discord para votar' });

  try {
    const [banido] = await redis([['HEXISTS', 'banidos', sessao.id]]);
    if(banido === 1) return res.status(403).json({ error: 'Você foi banido de votar' });
  } catch(e){}

  const CICLO = await pegarCiclo();
  const OPCOES = await pegarOpcoes();
  const kCont = `votos:${CICLO}`;
  const kTodos = `votos_usuarios:${CICLO}`;

  try{
    let jaVotou = false;

    if(req.method === 'POST'){
      // Rate-limit por usuário: 1 voto a cada 1 segundo
      if(!(await rateLimitOk(`ratelimit:voto:${sessao.id}`, 1, 1))) {
        return res.status(429).json({ error: 'Calma! Aguarde um instante.' });
      }

      const id = safeId((req.body || {}).id);
      if(!id || !OPCOES.some(o => o.id === id)) return res.status(400).json({ error: 'Opção inválida' });

      const [anteriorRaw] = await redis([['HGET', kTodos, sessao.id]]);
      const anterior = lerVoto(anteriorRaw);
      const opcaoAnterior = anterior ? anterior.opcao : null;

      if(opcaoAnterior === id){
        jaVotou = true;
      } else {
        const payload = JSON.stringify({
          opcao: id,
          username: safeStr(sessao.username, 60) || 'Anônimo',
          avatar: safeUrl(sessao.avatar) || null,
          ts: Date.now()
        });
        const cmds = [['HSET', kTodos, sessao.id, payload]];
        if(opcaoAnterior) cmds.push(['HINCRBY', kCont, opcaoAnterior, -1]);
        cmds.push(['HINCRBY', kCont, id, 1]);
        await redis(cmds);
      }
    } else if(req.method !== 'GET'){
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const [flat, meuRaw] = await redis([['HGETALL', kCont], ['HGET', kTodos, sessao.id]]);
    const cont = {};
    for(let i = 0; i < (flat||[]).length; i += 2) {
      const n = Number(flat[i+1]);
      cont[flat[i]] = Number.isFinite(n) && n >= 0 ? n : 0;
    }
    const meu = lerVoto(meuRaw);

    return res.status(200).json({
      opcoes: OPCOES.map(o => ({
        id: o.id, nome: o.nome, tipo: o.tipo || 'jogo',
        votos: cont[o.id] || 0, capa: o.capa || null
      })),
      meuVoto: meu ? meu.opcao : null,
      jaVotou,
      usuario: { id: sessao.id, username: safeStr(sessao.username, 60), avatar: safeUrl(sessao.avatar) }
    });
  }catch(e){
    return res.status(500).json({ error: 'Erro ao consultar votos' });
  }
}