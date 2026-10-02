// Vercel serverless: /api/votos.js
// Voto por conta do Discord (1 voto por conta, pode trocar).
// Env: UPSTASH_REDIS_REST_URL + TOKEN, SESSION_SECRET
import { createHmac } from 'crypto';

const CICLO = '2';
const OPCOES = [
  { id: 'hollow-knight', nome: 'Hollow Knight', appid: 367520 },
  { id: 'phasmophobia', nome: 'Phasmophobia', appid: 739630 },
  { id: 'stardew-valley', nome: 'Stardew Valley', appid: 413150 }
];

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET || 'troque-isso-urgente';
const COOKIE_NAME = 'sessao_site';

function b64urlDecode(str) { return Buffer.from(str, 'base64url').toString(); }
function assinar(p) { return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function lerSessao(req) {
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || assinar(payload) !== sig) return null;
  try {
    const d = JSON.parse(b64urlDecode(payload));
    if (d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  const d = await r.json();
  return d.map(x => x.result);
}

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });
  res.setHeader('Cache-Control', 'no-store');

  const sessao = lerSessao(req);
  if (!sessao) return res.status(401).json({ error: 'Faça login com o Discord para votar' });

  const kCont = `votos:${CICLO}`;                        // hash: id → contagem
  const kTodos = `votos_usuarios:${CICLO}`;              // hash: userId → id da opção

  try {
    let jaVotou = false;

    if (req.method === 'POST') {
      const id = (req.body || {}).id;
      if (!OPCOES.some(o => o.id === id)) return res.status(400).json({ error: 'Opção inválida' });

      // Voto anterior?
      const [anterior] = await redis([['HGET', kTodos, sessao.id]]);

      if (anterior === id) {
        jaVotou = true; // votou na mesma opção
      } else {
        // Remove voto antigo (se houver) e adiciona o novo
        const cmds = [['HSET', kTodos, sessao.id, id]];
        if (anterior) cmds.push(['HINCRBY', kCont, anterior, -1]);
        cmds.push(['HINCRBY', kCont, id, 1]);
        await redis(cmds);
      }
    } else if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const [flat, meu] = await redis([['HGETALL', kCont], ['HGET', kTodos, sessao.id]]);
    const cont = {};
    for (let i = 0; i < (flat || []).length; i += 2) cont[flat[i]] = Number(flat[i + 1]);

    return res.status(200).json({
      opcoes: OPCOES.map(o => ({
        id: o.id, nome: o.nome, votos: cont[o.id] || 0,
        capa: o.appid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${o.appid}/library_600x900.jpg` : null
      })),
      meuVoto: meu || null,
      jaVotou,
      usuario: { id: sessao.id, username: sessao.username, avatar: sessao.avatar }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar votos' });
  }
}