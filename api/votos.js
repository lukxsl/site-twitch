// Vercel serverless: /api/votos.js
// Voto e contagem são atualizados dentro de um único script Redis para
// evitar contagens negativas ou duplicadas quando duas requisições chegam juntas.
import { redis, lerSessao, rateLimit, origemOk, safeStr } from './_lib/core.js';
import { somarAtividade } from './_lib/atividade.js';
import { evento } from './_lib/game.js';

const COOKIE_SESSAO = 'sessao_site';
const OPCOES_PADRAO = [
  { id: 'hollow-knight', nome: 'Hollow Knight', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
  { id: 'phasmophobia', nome: 'Phasmophobia', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/739630/library_600x900.jpg' },
  { id: 'stardew-valley', nome: 'Stardew Valley', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg' }
];

const safeId = (value, max = 40) => String(value == null ? '' : value).trim().slice(0, max);
function safeUrl(value) {
  const url = safeStr(value, 500);
  return /^https?:\/\//i.test(url) ? url : null;
}

const REGISTRAR_VOTO_LUA = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
local anterior = nil
if raw then
  local ok, decoded = pcall(cjson.decode, raw)
  if ok and type(decoded) == 'table' then
    anterior = decoded.opcao
  else
    anterior = raw
  end
end
local mudou = 0
if anterior ~= ARGV[2] then
  if anterior and anterior ~= '' then
    local restante = redis.call('HINCRBY', KEYS[2], anterior, -1)
    if restante < 0 then redis.call('HSET', KEYS[2], anterior, 0) end
  end
  redis.call('HINCRBY', KEYS[2], ARGV[2], 1)
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
  mudou = 1
end
return {mudou, anterior or ''}
`;

async function pegarOpcoes() {
  const [raw] = await redis([['GET', 'votos:config']]);
  if (!raw) return OPCOES_PADRAO;
  try {
    const dados = JSON.parse(raw);
    if (!Array.isArray(dados) || !dados.length) return OPCOES_PADRAO;
    return dados.slice(0, 10).map(opcao => ({
      id: safeId(opcao.id) || safeId(opcao.nome),
      nome: safeStr(opcao.nome, 80),
      tipo: opcao.tipo === 'filme' ? 'filme' : 'jogo',
      capa: safeUrl(opcao.capa)
    })).filter(opcao => opcao.id && opcao.nome);
  } catch {
    return OPCOES_PADRAO;
  }
}

async function pegarCiclo() {
  const [raw] = await redis([['GET', 'votos:ciclo_atual']]);
  const numero = Number(raw);
  return String(Number.isFinite(numero) && numero > 0 ? numero : 1);
}

function lerVoto(raw) {
  if (!raw) return null;
  try {
    const dados = JSON.parse(raw);
    return dados && dados.opcao ? dados : { opcao: raw };
  } catch {
    return { opcao: raw };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (req.method === 'POST' && !origemOk(req)) {
    return res.status(403).json({ error: 'Origem inválida' });
  }

  const sessao = lerSessao(req);
  if (!sessao?.id) return res.status(401).json({ error: 'Faça login com o Discord para votar' });

  try {
    const [banido] = await redis([['HEXISTS', 'banidos', String(sessao.id)]]);
    if (Number(banido) === 1) return res.status(403).json({ error: 'Você foi banido de votar' });

    const ciclo = await pegarCiclo();
    const opcoes = await pegarOpcoes();
    const keyVotos = `votos:${ciclo}`;
    const keyUsuarios = `votos_usuarios:${ciclo}`;
    let jaVotou = false;

    if (req.method === 'POST') {
      if (!(await rateLimit(`ratelimit:voto:${sessao.id}`, 1, 1))) {
        return res.status(429).json({ error: 'Calma! Aguarde um instante.' });
      }

      const id = safeId(req.body?.id);
      if (!id || !opcoes.some(opcao => opcao.id === id)) {
        return res.status(400).json({ error: 'Opção inválida' });
      }

      const payload = JSON.stringify({
        opcao: id,
        username: safeStr(sessao.username, 60) || 'Anônimo',
        avatar: safeUrl(sessao.avatar),
        ts: Date.now()
      });
      const [resultado] = await redis([[
        'EVAL', REGISTRAR_VOTO_LUA, '2', keyUsuarios, keyVotos,
        String(sessao.id), id, payload
      ]]);
      jaVotou = Number(resultado?.[0]) === 0;

      // Conta somente o primeiro voto ou uma troca efetiva de opção neste ciclo.
      if(Number(resultado?.[0]) === 1){
        await somarAtividade(String(sessao.id), 'votes', 1);
        try { await evento(String(sessao.id), 'voto', ciclo); }
        catch(error){ console.error('[Votos] XP/moedas do voto não creditados:', error?.message || error); }
      }
    }

    const [flat, meuRaw] = await redis([
      ['HGETALL', keyVotos],
      ['HGET', keyUsuarios, String(sessao.id)]
    ]);
    const contagem = {};
    for (let i = 0; i < (flat || []).length; i += 2) {
      const quantidade = Number(flat[i + 1]);
      contagem[flat[i]] = Number.isFinite(quantidade) && quantidade >= 0 ? quantidade : 0;
    }
    const meu = lerVoto(meuRaw);

    return res.status(200).json({
      opcoes: opcoes.map(opcao => ({
        id: opcao.id,
        nome: opcao.nome,
        tipo: opcao.tipo || 'jogo',
        votos: contagem[opcao.id] || 0,
        capa: opcao.capa || null
      })),
      meuVoto: meu ? meu.opcao : null,
      jaVotou,
      usuario: {
        id: String(sessao.id),
        username: safeStr(sessao.username, 60),
        avatar: safeUrl(sessao.avatar)
      }
    });
  } catch (error) {
    console.error('[Votos] Falha ao processar votação:', error?.message || error);
    return res.status(503).json({ error: 'Não foi possível consultar ou registrar seu voto agora. Tente novamente.' });
  }
}
