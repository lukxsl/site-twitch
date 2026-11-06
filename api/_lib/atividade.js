// Estatísticas do perfil: apenas minutos, lives, votos e sugestões.
import { redis, paraObj } from './core.js';

const CAMPOS = new Set(['minutes', 'lives', 'votes', 'suggestions']);

export async function somarAtividade(id, campo, quantidade = 1) {
  const uid = String(id || '').trim();
  const field = String(campo || '');
  const delta = Math.max(0, Math.floor(Number(quantidade) || 0));
  if (!uid || !CAMPOS.has(field) || !delta) return 0;
  const [resultado] = await redis([['HINCRBY', `activity:${uid}`, field, String(delta)]]);
  return Number(resultado) || 0;
}

// Migra somente as quatro estatísticas comunitárias do formato antigo.
// Campos que não fazem parte do perfil atual são descartados.
const MIGRAR_METRICAS_ANTIGAS_LUA = `
local pares = {
  {'minutes', 'minutos'},
  {'lives', 'lives'},
  {'votes', 'votos'},
  {'suggestions', 'sugestoes_env'}
}
for _, par in ipairs(pares) do
  local atual = redis.call('HGET', KEYS[1], par[1])
  local antigo = redis.call('HGET', KEYS[2], par[2])
  if (not atual or atual == '') and antigo and antigo ~= '' then
    redis.call('HSET', KEYS[1], par[1], tostring(math.max(0, tonumber(antigo) or 0)))
  end
end
redis.call('DEL', KEYS[2])
return redis.call('HGETALL', KEYS[1])
`;

const PRESENCA_LUA = `
local ja = redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])
if ja == 0 then return 0 end
redis.call('EXPIRE', KEYS[1], 34560000)
redis.call('HINCRBY', KEYS[2], 'lives', 1)
return 1
`;

export async function registrarPresenca(id, numeroLive) {
  const uid = String(id || '').trim();
  const num = Math.max(0, Math.floor(Number(numeroLive) || 0));
  if (!uid || !num) return false;
  const [resultado] = await redis([[
    'EVAL', PRESENCA_LUA, '2', `att:${num}`, `activity:${uid}`,
    uid, String(Date.now())
  ]]);
  return Number(resultado) === 1;
}

export async function lerAtividade(id) {
  const uid = String(id || '').trim();
  if (!uid) return { minutes: 0, lives: 0, votes: 0, suggestions: 0 };
  const [flat] = await redis([[
    'EVAL', MIGRAR_METRICAS_ANTIGAS_LUA, '2', `activity:${uid}`, `g:${uid}`
  ]]);
  const dados = paraObj(flat);
  return {
    minutes: Math.max(0, Number(dados.minutes) || 0),
    lives: Math.max(0, Number(dados.lives) || 0),
    votes: Math.max(0, Number(dados.votes) || 0),
    suggestions: Math.max(0, Number(dados.suggestions) || 0)
  };
}
