// Vercel serverless: /api/votos.js
// Voto e contagem são atualizados dentro de um único script Redis para
// evitar contagens negativas ou duplicadas quando duas requisições chegam juntas.
import { redis, validarSessao, rateLimit, origemOk, safeStr, jparse } from './_lib/core.js';
import { evento } from './_lib/game.js';

const OPCOES_PADRAO = [
  { id: 'hollow-knight', nome: 'Hollow Knight', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
  { id: 'phasmophobia', nome: 'Phasmophobia', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/739630/library_600x900.jpg' },
  { id: 'stardew-valley', nome: 'Stardew Valley', tipo: 'jogo',
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg' }
];

const safeId = (value, max = 40) => String(value == null ? '' : value).trim().slice(0, max);
const RECOMPENSA_PENDENTE_TTL = String(90 * 86400);
function safeUrl(value) {
  const url = safeStr(value, 500);
  return /^https?:\/\//i.test(url) ? url : null;
}

const REGISTRAR_VOTO_LUA = `
-- Revalida banimento e ciclo no instante do commit, não antes dele.
if redis.call('HEXISTS', KEYS[5], ARGV[1]) == 1 then return {-2, 'banido'} end
local cicloAtual = tonumber(redis.call('GET', KEYS[4]) or '1') or 1
if cicloAtual ~= (tonumber(ARGV[5]) or 1) then return {-3, 'ciclo-alterado'} end
local fechamento = tonumber(ARGV[4]) or 0
if fechamento > 0 then
  local agora = redis.call('TIME')
  local agoraMs = tonumber(agora[1]) * 1000 + math.floor(tonumber(agora[2]) / 1000)
  if agoraMs >= fechamento then return {-1, 'encerrada'} end
end
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
  -- A estatística do perfil e a marca de recompensa pendente nascem junto do voto.
  redis.call('HINCRBY', KEYS[3], 'votes', 1)
  redis.call('SET', KEYS[6], '1', 'NX', 'EX', tonumber(ARGV[6]) or 7776000)
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

async function processarRecompensaPendente(userId, ciclo) {
  const key = `votos:recompensa-pendente:${ciclo}:${userId}`;
  const [pendente] = await redis([['GET', key]]);
  if (!pendente) return;
  try {
    // evento() é idempotente pelo par usuário/evento/ciclo. Se o crédito já
    // aconteceu antes de uma falha no DEL, repetir não paga duas vezes.
    await evento(String(userId), 'voto', String(ciclo));
    await redis([['DEL', key]]);
  } catch (error) {
    // A marca permanece para a próxima consulta/voto do mesmo usuário.
    console.error('[Votos] Recompensa pendente; será tentada novamente:', error?.message || error);
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

  const sessao = await validarSessao(req);
  if (!sessao?.id) return res.status(401).json({ error: 'Faça login para votar.' });

  try {
    const ciclo = await pegarCiclo();
    await processarRecompensaPendente(sessao.id, ciclo);

    const [banido] = await redis([['HEXISTS', 'banidos', String(sessao.id)]]);
    if (Number(banido) === 1) return res.status(403).json({ error: 'Você foi banido de votar' });

    const opcoes = await pegarOpcoes();
    const keyVotos = `votos:${ciclo}`;
    const keyUsuarios = `votos_usuarios:${ciclo}`;
    let jaVotou = false;

    if (req.method === 'POST') {
      // Votos exigem uma identidade verificável: Google com e-mail confirmado
      // ou Twitch vinculada por OAuth. Contas locais sem verificação continuam
      // podendo consultar o resultado, mas não multiplicar votos por cadastro.
      const [contaRaw] = await redis([['HGET', 'accounts', String(sessao.id)]]);
      const conta = jparse(contaRaw, null);
      const identidadeVerificada = Boolean(
        (conta?.google?.sub && conta?.google?.email) || conta?.twitch?.id
      );
      if(!identidadeVerificada){
        return res.status(403).json({ error: 'Para votar, entre com Google (e-mail verificado) ou vincule sua conta da Twitch ao perfil.' });
      }
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
      const [fechamentoRaw] = await redis([['GET', 'config:votosFechamento']]);
      let fechamentoMs = 0;
      if (fechamentoRaw) {
        fechamentoMs = Date.parse(String(fechamentoRaw));
        if (!Number.isFinite(fechamentoMs)) {
          return res.status(503).json({ error: 'Não foi possível validar o horário de encerramento da votação.' });
        }
      }
      const recompensaKey = `votos:recompensa-pendente:${ciclo}:${sessao.id}`;
      const [resultado] = await redis([[
        'EVAL', REGISTRAR_VOTO_LUA, '6', keyUsuarios, keyVotos, `activity:${sessao.id}`,
        'votos:ciclo_atual', 'banidos', recompensaKey,
        String(sessao.id), id, payload, String(fechamentoMs), ciclo, RECOMPENSA_PENDENTE_TTL
      ]]);
      if (Number(resultado?.[0]) === -1) {
        return res.status(403).json({ error: 'A votação já foi encerrada. Obrigado por participar!' });
      }
      if (Number(resultado?.[0]) === -2) {
        return res.status(403).json({ error: 'Você foi banido de votar.' });
      }
      if (Number(resultado?.[0]) === -3) {
        return res.status(409).json({ error: 'A votação mudou enquanto você votava. Atualize a página e tente novamente.' });
      }
      jaVotou = Number(resultado?.[0]) === 0;

      // Se o processo cair entre o commit e o crédito, a marca fica no Redis
      // e será processada na próxima consulta autenticada dessa pessoa.
      if (Number(resultado?.[0]) === 1) await processarRecompensaPendente(sessao.id, ciclo);
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
