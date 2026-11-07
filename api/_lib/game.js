// api/_lib/game.js
// ============================================================================
//  ECONOMIA DO CANTINHO — SosoCoins e XP (FONTE ÚNICA DA VERDADE)
//
//  🔒 ANTI-CHEAT (leia isto):
//   • XP e moedas SÓ mudam dentro deste arquivo, no servidor (Redis).
//   • Nenhuma rota aceita "ganhe X XP" vindo do navegador. O front só LÊ.
//   • Cada ganho passa por `evento()`, que é:
//       - idempotente  (SET NX por usuário+evento+ref → repetir a mesma ação não paga 2x)
//       - limitado     (teto diário por tipo de evento)
//       - validado     (voto/sugestão só pagam quando a API que os grava confirma)
//   • Tempo de tela NUNCA vem do cliente: o cron lê a Twitch (stream online +
//     lista de chatters) e credita só contas com Twitch vinculada via OAuth.
// ============================================================================
import { redis, paraObj, jparse, hojeBR } from './core.js';

/* ============================================================
   1) MOEDA, NÍVEIS, XP
   ============================================================ */
export const MOEDA = { nome: 'SosoCoins', simbolo: '🪙', sigla: 'SC' };
export const NIVEL_MAX = 100;

/* XP acumulado necessário para ALCANÇAR o nível n:  T(n) = 50·n·(n−1)
   n=2→100 · n=3→300 · n=5→1000 · n=10→4500 · n=25→30.000 · n=50→122.500 */
export const xpDoNivel = n => 50 * n * (n - 1);
export function nivelPorXP(xp){
  const n = Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 12.5)) / 2);
  return Math.max(1, Math.min(NIVEL_MAX, n));
}
export function infoNivel(xp){
  const nivel = nivelPorXP(xp);
  const base = xpDoNivel(nivel);
  const prox = nivel >= NIVEL_MAX ? base : xpDoNivel(nivel + 1);
  const dentro = xp - base;
  const falta = Math.max(0, prox - xp);
  const pct = nivel >= NIVEL_MAX ? 100 : Math.min(100, Math.floor((dentro / (prox - base)) * 100));
  return { nivel, xp, base, prox, dentro, falta, pct };
}

/* Eventos que pagam. `limiteDia` = quantas vezes por dia pagam (0 = sem teto). */
export const EVENTOS = {
  cadastro:           { xp: 25, coins: 50,  limiteDia: 0, rotulo: 'Boas-vindas ao cantinho' },
  voto:               { xp: 10, coins: 5,   limiteDia: 3, rotulo: 'Voto na votação', stat: 'votos' },
  sugestao_enviada:   { xp: 5,  coins: 2,   limiteDia: 3, rotulo: 'Sugestão enviada', stat: 'sugestoes_env' },
  sugestao_aprovada:  { xp: 60, coins: 30,  limiteDia: 0, rotulo: 'Sugestão aprovada', stat: 'sugestoes' },
  vincular_twitch:    { xp: 40, coins: 25,  limiteDia: 0, rotulo: 'Twitch vinculada' }
};

/* Presença em live (cron) */
export const LIVE = {
  TICK_MIN: 5,            // o cron roda a cada 5 min
  XP_POR_TICK: 5,         // 1 XP por minuto assistido
  COINS_A_CADA_TICKS: 2,  // +1 moeda a cada 10 min
  TETO_MIN_SESSAO: 240,   // máx. 4h creditadas por live (anti-AFK infinito)
  MIN_PRESENCA: 20,       // minutos de presença p/ a live CONTAR (streak, "lives")
  MIN_LIVE_VALIDA: 30,    // live só entra no histórico depois de 30 min no ar
  XP_PRESENCA: 30,        // bônus por live contada
  XP_STREAK_POR_LIVE: 5,  // +5 XP × sequência atual (teto 10x)
  MARCOS_STREAK: { 4: 60, 8: 120, 12: 200, 20: 400 } // moedas bônus ao bater a sequência
};

/* ============================================================
   2) ESTATÍSTICAS DO JOGADOR (somente economia)
   ============================================================ */
export async function lerStats(id){
  const [flat, conta] = await redis([
    ['HGETALL', `g:${id}`], ['HGET', 'accounts', String(id)]
  ]);
  const g = paraObj(flat);
  const n = k => Number(g[k] || 0);
  const acc = jparse(conta, {});
  const S = {
    xp: n('xp'), coins: n('coins'), minutos: n('minutos'), lives: n('lives'),
    votos: n('votos'), sugestoes: n('sugestoes'), sugestoesEnv: n('sugestoes_env'),
    streak: n('streak'), melhorStreak: n('melhorStreak'), ultimaLiveN: n('ultimaLiveN'),
    twitch: !!(acc && acc.twitch)
  };
  S.horas = S.minutos / 60;
  S.nivel = nivelPorXP(S.xp);
  S.conta = acc;
  return S;
}

/* ============================================================
   3) CRÉDITO DE XP / MOEDAS  — único ponto que altera saldo
   ============================================================ */
const CREDITAR_LUA = `
local function nivel(xp)
  local n = math.floor((1 + math.sqrt(1 + math.max(0, xp) / 12.5)) / 2)
  if n < 1 then return 1 end
  if n > 100 then return 100 end
  return n
end
local xpGanho = math.max(0, math.floor(tonumber(ARGV[1]) or 0))
local moedasGanhos = math.max(0, math.floor(tonumber(ARGV[2]) or 0))
local userId = ARGV[3]
local xpAntes = tonumber(redis.call('HGET', KEYS[1], 'xp') or '0')
local nivelAntes = nivel(xpAntes)
local xpDepois = xpAntes
if xpGanho > 0 then
  xpDepois = redis.call('HINCRBY', KEYS[1], 'xp', xpGanho)
  redis.call('ZADD', KEYS[2], xpDepois, userId)
end
local nivelDepois = nivel(xpDepois)
local subiu = math.max(0, nivelDepois - nivelAntes)
local bonusNivel = subiu * 20
local totalMoedas = moedasGanhos + bonusNivel
if totalMoedas > 0 then redis.call('HINCRBY', KEYS[1], 'coins', totalMoedas) end
local saldo = tonumber(redis.call('HGET', KEYS[1], 'coins') or '0')
return {xpDepois, nivelAntes, nivelDepois, subiu, totalMoedas, saldo}
`;

export async function creditar(id, { xp = 0, coins = 0 } = {}){
  xp = Math.max(0, Math.floor(Number(xp) || 0));
  coins = Math.max(0, Math.floor(Number(coins) || 0));
  if(!xp && !coins) return null;

  const [resultado] = await redis([[
    'EVAL', CREDITAR_LUA, '2', `g:${id}`, 'rank:xp',
    String(xp), String(coins), String(id)
  ]]);
  const dados = Array.isArray(resultado) ? resultado.map(Number) : [];
  if(dados.length < 6) throw new Error('Resposta inválida ao creditar XP/moedas.');

  return {
    novoXP: xp ? dados[0] : null,
    subiu: dados[3] || 0,
    saldo: dados[5]
  };
}

/* ============================================================
   4) EVENTOS VALIDADOS PELO SERVIDOR
   Chame SEMPRE do backend (ex.: dentro de api/votos.js depois de gravar o voto).
   `ref` = id único da ação (ex.: `${ciclo}`, id da sugestão) → impede pagar 2x.
   ============================================================ */
const EVENTO_LUA = `
local function nivel(xp)
  local n = math.floor((1 + math.sqrt(1 + math.max(0, xp) / 12.5)) / 2)
  if n < 1 then return 1 end
  if n > 100 then return 100 end
  return n
end
if redis.call('EXISTS', KEYS[1]) == 1 then
  return {0, 0, tonumber(redis.call('HGET', KEYS[3], 'xp') or '0'), 0, 0, 0}
end
local limite = tonumber(ARGV[2]) or 0
local paga = 1
if limite > 0 then
  local n = redis.call('INCR', KEYS[2])
  if n == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]) or 172800) end
  if n > limite then paga = 0 end
end
local stat = ARGV[7]
if stat ~= '' then redis.call('HINCRBY', KEYS[3], stat, 1) end
local extraCount = tonumber(ARGV[8]) or 0
local argIndex = 9
for i = 1, extraCount do
  local field = ARGV[argIndex]
  local value = tonumber(ARGV[argIndex + 1]) or 0
  if field and field ~= '' and value ~= 0 then redis.call('HINCRBY', KEYS[3], field, value) end
  argIndex = argIndex + 2
end
local xp = paga == 1 and (tonumber(ARGV[4]) or 0) or 0
local coins = paga == 1 and (tonumber(ARGV[5]) or 0) or 0
local oldXP = tonumber(redis.call('HGET', KEYS[3], 'xp') or '0')
local newXP = oldXP
local antes = nivel(oldXP)
if xp > 0 then
  newXP = redis.call('HINCRBY', KEYS[3], 'xp', xp)
  redis.call('ZADD', KEYS[4], newXP, ARGV[6])
end
local depois = nivel(newXP)
local subiu = math.max(0, depois - antes)
local bonusNivel = subiu * 20
local totalCoins = coins + bonusNivel
if totalCoins > 0 then redis.call('HINCRBY', KEYS[3], 'coins', totalCoins) end
redis.call('SET', KEYS[1], '1', 'EX', tonumber(ARGV[1]) or 7776000)
return {1, paga, newXP, antes, depois, totalCoins}
`;

export async function evento(id, nome, ref, { statExtra = {} } = {}){
  const cfg = EVENTOS[nome];
  if(!cfg || !id) return { pago: false, motivo: 'evento desconhecido' };
  id = String(id); ref = String(ref || 'unico');

  const extra = Object.entries(statExtra || {}).filter(([campo, valor]) =>
    /^[a-zA-Z0-9_:-]{1,64}$/.test(campo) && Number.isFinite(Number(valor)) && Number(valor) !== 0
  );
  const dia = hojeBR();
  const keys = [
    `xpev:${id}:${nome}:${ref}`,
    `xpdia:${id}:${nome}:${dia}`,
    `g:${id}`,
    'rank:xp'
  ];
  const args = [
    String(90 * 86400), String(cfg.limiteDia || 0), '172800',
    String(cfg.xp || 0), String(cfg.coins || 0), id,
    cfg.stat || '', String(extra.length)
  ];
  extra.forEach(([campo, valor]) => args.push(campo, String(Math.trunc(Number(valor)))));

  // Um único script evita que falha entre SET NX, estatística e crédito
  // deixe um evento marcado como pago sem entregar sua recompensa.
  const [resultado] = await redis([['EVAL', EVENTO_LUA, String(keys.length), ...keys, ...args]]);
  const dados = Array.isArray(resultado) ? resultado.map(Number) : [];
  const executado = dados[0] === 1;
  if(!executado) return { pago: false, motivo: 'já contabilizado' };

  const pago = dados[1] === 1;
  const novoXP = Number(dados[2] || 0);
  const antes = Number(dados[3] || 1);
  const depois = Number(dados[4] || antes);
  const totalCoins = Number(dados[5] || 0);
  return { pago, xp: pago ? cfg.xp : 0, coins: totalCoins, novoXP, subiu: Math.max(0, depois - antes) };
}

/* ============================================================
   5) PRESENÇA EM LIVE (streak) — chamado pelo cron, 100% no servidor
   ============================================================ */
const PRESENCA_LUA = `
local function nivel(xp)
  local n = math.floor((1 + math.sqrt(1 + math.max(0, xp) / 12.5)) / 2)
  if n < 1 then return 1 end
  if n > 100 then return 100 end
  return n
end
if redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2]) ~= 1 then
  return {0, 0, 0, 0, 0, 0, 0, 0}
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]) or 34560000)
local ultima = tonumber(redis.call('HGET', KEYS[2], 'ultimaLiveN') or '0')
local atual = tonumber(redis.call('HGET', KEYS[2], 'streak') or '0')
local melhor = tonumber(redis.call('HGET', KEYS[2], 'melhorStreak') or '0')
local num = tonumber(ARGV[4])
local streak = (ultima == num - 1) and (atual + 1) or 1
local novoMelhor = math.max(melhor, streak)
redis.call('HSET', KEYS[2], 'ultimaLiveN', tostring(num), 'streak', tostring(streak), 'melhorStreak', tostring(novoMelhor))
redis.call('HINCRBY', KEYS[2], 'lives', 1)
local xp = (tonumber(ARGV[5]) or 30) + math.min(streak, tonumber(ARGV[6]) or 10) * (tonumber(ARGV[7]) or 5)
local marcos = cjson.decode(ARGV[8] or '{}')
local coins = tonumber(marcos[tostring(streak)]) or 0
local oldXP = tonumber(redis.call('HGET', KEYS[2], 'xp') or '0')
local newXP = redis.call('HINCRBY', KEYS[2], 'xp', xp)
redis.call('ZADD', KEYS[3], newXP, ARGV[1])
local antes = nivel(oldXP)
local depois = nivel(newXP)
local levelCoins = math.max(0, depois - antes) * 20
local totalCoins = coins + levelCoins
if totalCoins > 0 then redis.call('HINCRBY', KEYS[2], 'coins', totalCoins) end
return {1, streak, novoMelhor, xp, coins, antes, depois, newXP, totalCoins}
`;

export async function registrarPresenca(id, num){
  // HSETNX, streak, estatísticas, XP, moedas e ranking são atualizados juntos.
  const [resultado] = await redis([[
    'EVAL', PRESENCA_LUA, '3', `att:${num}`, `g:${id}`, 'rank:xp',
    String(id), String(Date.now()), String(400 * 86400), String(num),
    String(LIVE.XP_PRESENCA), '10', String(LIVE.XP_STREAK_POR_LIVE), JSON.stringify(LIVE.MARCOS_STREAK)
  ]]);
  const dados = Array.isArray(resultado) ? resultado.map(Number) : [];
  return dados[0] === 1;
}
