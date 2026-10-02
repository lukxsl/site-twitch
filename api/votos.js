// Vercel serverless: /api/votos.js
// Precisa de um Redis (Upstash, pelo Marketplace da Vercel). Variáveis:
// UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (ou KV_REST_API_URL / KV_REST_API_TOKEN)
import { createHash } from 'crypto';

// EDITE AQUI: jogos em votação. Para zerar a votação, troque o CICLO.
const CICLO = '1';
const OPCOES = [
  { id: 'hollow-knight', nome: 'Hollow Knight' },
  { id: 'phasmophobia', nome: 'Phasmophobia' },
  { id: 'stardew-valley', nome: 'Stardew Valley' }
];

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const quem = createHash('sha256').update(ip + CICLO).digest('hex').slice(0, 24);
  const kVoto = `voto:${CICLO}:${quem}`;
  const kCont = `votos:${CICLO}`;

  try {
    let jaVotou = false;
    if (req.method === 'POST') {
      const id = (req.body || {}).id;
      if (!OPCOES.some(o => o.id === id)) return res.status(400).json({ error: 'Opção inválida' });
      const [ok] = await redis([['SET', kVoto, id, 'NX', 'EX', 60 * 60 * 24 * 60]]);
      if (ok === 'OK') await redis([['HINCRBY', kCont, id, 1]]);
      else jaVotou = true;
    } else if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    const [flat, meu] = await redis([['HGETALL', kCont], ['GET', kVoto]]);
    const cont = {};
    for (let i = 0; i < (flat || []).length; i += 2) cont[flat[i]] = Number(flat[i + 1]);
    return res.status(200).json({
      opcoes: OPCOES.map(o => ({ ...o, votos: cont[o.id] || 0 })),
      meuVoto: meu || null,
      jaVotou
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao consultar votos' });
  }
}