// Vercel serverless: /api/votos.js
// Voto por conta Discord, opções editáveis pelo painel admin.
import { createHmac } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-isso-urgente';
const COOKIE_NAME = 'sessao_site';

// Opções PADRÃO (usadas se o admin nunca salvou nada pelo painel)
const OPCOES_PADRAO = [
  { id: 'hollow-knight', nome: 'Hollow Knight', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
  { id: 'phasmophobia', nome: 'Phasmophobia', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/739630/library_600x900.jpg' },
  { id: 'stardew-valley', nome: 'Stardew Valley', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg' }
];

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

async function pegarOpcoes(){
  const [raw] = await redis([['GET','votos:config']]);
  if(!raw) return OPCOES_PADRAO;
  try{
    const d = JSON.parse(raw);
    return Array.isArray(d) && d.length ? d : OPCOES_PADRAO;
  }catch(e){ return OPCOES_PADRAO; }
}

async function pegarCiclo(){
  const [raw] = await redis([['GET','votos:ciclo_atual']]);
  return String(raw || '1');
}

export default async function handler(req, res){
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });
  res.setHeader('Cache-Control', 'no-store');

  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login com o Discord para votar' });

  const CICLO = await pegarCiclo();
  const OPCOES = await pegarOpcoes();
  const kCont = `votos:${CICLO}`;
  const kTodos = `votos_usuarios:${CICLO}`;

  try{
    let jaVotou = false;

    if(req.method === 'POST'){
      const id = (req.body || {}).id;
      if(!OPCOES.some(o => o.id === id)) return res.status(400).json({ error: 'Opção inválida' });

      const [anterior] = await redis([['HGET', kTodos, sessao.id]]);

      if(anterior === id){
        jaVotou = true;
      } else {
        const cmds = [['HSET', kTodos, sessao.id, id]];
        if(anterior) cmds.push(['HINCRBY', kCont, anterior, -1]);
        cmds.push(['HINCRBY', kCont, id, 1]);
        await redis(cmds);
      }
    } else if(req.method !== 'GET'){
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const [flat, meu] = await redis([['HGETALL', kCont], ['HGET', kTodos, sessao.id]]);
    const cont = {};
    for(let i = 0; i < (flat||[]).length; i += 2) cont[flat[i]] = Number(flat[i+1]);

    return res.status(200).json({
      opcoes: OPCOES.map(o => ({
        id: o.id, nome: o.nome, tipo: o.tipo || 'jogo',
        votos: cont[o.id] || 0,
        capa: o.capa || null
      })),
      meuVoto: meu || null,
      jaVotou,
      usuario: { id: sessao.id, username: sessao.username, avatar: sessao.avatar }
    });
  }catch(e){
    return res.status(500).json({ error: 'Erro ao consultar votos' });
  }
}