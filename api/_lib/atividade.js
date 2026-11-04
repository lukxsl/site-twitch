// Atividade da comunidade — estatísticas sem XP, moedas ou itens de jogo.
import { redis, paraObj } from './core.js';

const CAMPOS = new Set(['minutes', 'lives', 'votes', 'suggestions', 'approvedSuggestions']);

export async function somarAtividade(id, campo, quantidade = 1) {
  const uid = String(id || '').trim();
  const field = String(campo || '');
  const delta = Math.max(0, Math.floor(Number(quantidade) || 0));
  if (!uid || !CAMPOS.has(field) || !delta) return 0;
  const [resultado] = await redis([['HINCRBY', `activity:${uid}`, field, String(delta)]]);
  return Number(resultado) || 0;
}

const PRESENCA_LUA = `
local ja = redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])
if ja == 0 then return 0 end
redis.call('EXPIRE', KEYS[1], 34560000)
local anterior = tonumber(redis.call('HGET', KEYS[2], 'lastLive') or '0')
local streak = tonumber(redis.call('HGET', KEYS[2], 'streak') or '0')
if anterior == tonumber(ARGV[3]) then return 0 end
if anterior == tonumber(ARGV[3]) - 1 then streak = streak + 1 else streak = 1 end
local best = tonumber(redis.call('HGET', KEYS[2], 'bestStreak') or '0')
if streak > best then best = streak end
redis.call('HINCRBY', KEYS[2], 'lives', 1)
redis.call('HSET', KEYS[2], 'streak', streak, 'bestStreak', best, 'lastLive', ARGV[3])
return 1
`;

export async function registrarPresenca(id, numeroLive) {
  const uid = String(id || '').trim();
  const num = Math.max(0, Math.floor(Number(numeroLive) || 0));
  if (!uid || !num) return false;
  const [resultado] = await redis([[
    'EVAL', PRESENCA_LUA, '2', `att:${num}`, `activity:${uid}`,
    uid, String(Date.now()), String(num)
  ]]);
  return Number(resultado) === 1;
}

export async function lerAtividade(id) {
  const uid = String(id || '').trim();
  if (!uid) return {};
  const [atual, legado] = await redis([
    ['HGETALL', `activity:${uid}`],
    ['HGETALL', `g:${uid}`]
  ]);
  const a = paraObj(atual);
  const g = paraObj(legado);
  // Leitura de compatibilidade enquanto a limpeza única ainda não foi executada.
  return {
    lives: Number(a.lives ?? g.lives) || 0,
    minutes: Number(a.minutes ?? g.minutos) || 0,
    votes: Number(a.votes ?? g.votos) || 0,
    suggestions: Number(a.suggestions ?? g.sugestoes_env) || 0,
    approvedSuggestions: Number(a.approvedSuggestions ?? g.sugestoes) || 0,
    streak: Number(a.streak ?? g.streak) || 0,
    bestStreak: Number(a.bestStreak ?? g.melhorStreak) || 0,
    lastLive: Number(a.lastLive ?? g.ultimaLiveN) || 0
  };
}
