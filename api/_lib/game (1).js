// api/_lib/game.js
// ============================================================================
//  SOSO ARCADE — regras de gamificação (FONTE ÚNICA DA VERDADE)
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
//   • Equipar item é validado aqui: não dá pra salvar peça que você não possui.
// ============================================================================
import { redis, paraObj, jparse, hojeBR, safeStr } from './core.js';

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
const RECOMPENSA_NIVEL_COINS = 20;   // moedas por nível alcançado

/* Eventos que pagam. `limiteDia` = quantas vezes por dia pagam (0 = sem teto). */
export const EVENTOS = {
  cadastro:           { xp: 25, coins: 50,  limiteDia: 0, rotulo: 'Boas-vindas ao Arcade' },
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
   2) RARIDADES
   ============================================================ */
export const RARIDADES = {
  comum:    { nome: 'Comum',    cor: '#9ca3af', ordem: 0, preco: 0 },
  incomum:  { nome: 'Incomum',  cor: '#4ade80', ordem: 1, preco: 150 },
  raro:     { nome: 'Raro',     cor: '#38bdf8', ordem: 2, preco: 400 },
  epico:    { nome: 'Épico',    cor: '#c084fc', ordem: 3, preco: 1000 },
  lendario: { nome: 'Lendário', cor: '#fbbf24', ordem: 4, preco: 2500 },
  limitado: { nome: 'Limitado', cor: '#ff4fd8', ordem: 5, preco: 0 }  // só em eventos
};

/* ============================================================
   3) CONQUISTAS
   S = estatísticas do jogador (ver `lerStats`).  `plat` = a 100% (calculada à parte).
   ============================================================ */
export const CONQUISTAS = [
  { id: 'bem_vindo',   icone: '🕹️', nome: 'Bem-vindo ao Arcade',   desc: 'Crie sua conta.',                         r: 'comum',    cond: S => true,                       premio: { xp: 10 } },
  { id: 'estilo',      icone: '🎨', nome: 'Estilo Próprio',        desc: 'Salve seu boneco pela primeira vez.',     r: 'comum',    cond: S => S.bonecoSalvo,              premio: { xp: 15 } },
  { id: 'twitch',      icone: '🔗', nome: 'Conectado na Matrix',   desc: 'Vincule sua conta da Twitch.',            r: 'comum',    cond: S => S.twitch,                   premio: { xp: 30, coins: 20 } },
  { id: 'voto_1',      icone: '🗳️', nome: 'Primeiro Voto',         desc: 'Vote em uma votação da live.',            r: 'comum',    cond: S => S.votos >= 1,               premio: { xp: 15 } },
  { id: 'voto_25',     icone: '📣', nome: 'Voz do Povo',           desc: 'Acumule 25 votos.',                       r: 'incomum',  cond: S => S.votos >= 25,              premio: { xp: 80, coins: 40 } },
  { id: 'sug_1',       icone: '💡', nome: '1ª Sugestão Aprovada',  desc: 'Tenha uma sugestão aprovada pela Soso.',  r: 'incomum',  cond: S => S.sugestoes >= 1,           premio: { xp: 60, coins: 30 } },
  { id: 'sug_5',       icone: '🧠', nome: 'Mente Brilhante',       desc: 'Tenha 5 sugestões aprovadas.',            r: 'raro',     cond: S => S.sugestoes >= 5,           premio: { xp: 200, coins: 120 } },
  { id: 'horas_10',    icone: '📺', nome: 'Fiel da Twitch',        desc: 'Assista 10 horas de live (Twitch vinculada).', r: 'incomum', cond: S => S.horas >= 10,         premio: { xp: 100, coins: 50 } },
  { id: 'horas_50',    icone: '🛋️', nome: 'Maratonista',           desc: 'Assista 50 horas de live.',               r: 'raro',     cond: S => S.horas >= 50,              premio: { xp: 300, coins: 150 } },
  { id: 'horas_200',   icone: '🏛️', nome: 'Patrimônio do Chat',    desc: 'Assista 200 horas de live.',              r: 'epico',    cond: S => S.horas >= 200,             premio: { xp: 800, coins: 400 } },
  { id: 'streak_4',    icone: '🔥', nome: 'Sequência de Fogo',     desc: 'Assista 4 lives seguidas.',               r: 'incomum',  cond: S => S.melhorStreak >= 4,        premio: { xp: 120, coins: 60 } },
  { id: 'streak_12',   icone: '⚡', nome: 'Imparável',             desc: 'Assista 12 lives seguidas.',              r: 'epico',    cond: S => S.melhorStreak >= 12,       premio: { xp: 500, coins: 250 } },
  { id: 'codigo_1',    icone: '🔑', nome: 'Decifrador',            desc: 'Resgate seu primeiro código secreto.',    r: 'comum',    cond: S => S.codigos >= 1,             premio: { xp: 20 } },
  { id: 'codigo_10',   icone: '🗝️', nome: 'Caçador de Códigos',    desc: 'Resgate 10 códigos secretos.',            r: 'raro',     cond: S => S.codigos >= 10,            premio: { xp: 250, coins: 100 } },
  { id: 'nivel_10',    icone: '⭐', nome: 'Nível 10',              desc: 'Chegue ao nível 10.',                     r: 'incomum',  cond: S => S.nivel >= 10,              premio: { coins: 100 } },
  { id: 'nivel_25',    icone: '🌟', nome: 'Nível 25',              desc: 'Chegue ao nível 25.',                     r: 'raro',     cond: S => S.nivel >= 25,              premio: { coins: 300 } },
  { id: 'nivel_50',    icone: '👑', nome: 'Meio Século',           desc: 'Chegue ao nível 50.',                     r: 'lendario', cond: S => S.nivel >= 50,              premio: { coins: 1000 } },
  { id: 'colecionador',icone: '🎒', nome: 'Colecionador',          desc: 'Desbloqueie 20 itens no inventário.',     r: 'raro',     cond: S => S.itens >= 20,              premio: { xp: 150, coins: 80 } }
];
export const ID_PLATINA = 'platina';
export const PLATINA = {
  id: ID_PLATINA, icone: '💎', nome: 'Platina do Arcade', r: 'lendario',
  desc: 'Desbloqueie TODAS as outras conquistas.',
  premio: { xp: 1000, coins: 1000 }   // + moldura holográfica e título "Completista" (ver catálogo)
};

/* ============================================================
   4) TÍTULOS (viewer da asemtet0).  Equipa 1 por vez.
   ============================================================ */
export const TITULOS = [
  { id: 'novato',      nome: 'Novato',               r: 'comum',    regra: 'Todo mundo começa aqui.',               cond: S => true },
  { id: 'visitante',   nome: 'Visitante Assíduo',    r: 'comum',    regra: 'Assista 2 horas de live.',              cond: S => S.horas >= 2 },
  { id: 'fiel',        nome: 'Fiel do Chat',         r: 'incomum',  regra: 'Assista 10 horas de live.',             cond: S => S.horas >= 10 },
  { id: 'voz',         nome: 'Voz do Povo',          r: 'incomum',  regra: 'Acumule 25 votos.',                     cond: S => S.votos >= 25 },
  { id: 'veterano',    nome: 'Veterano das Lives',   r: 'raro',     regra: 'Assista 50 horas de live.',             cond: S => S.horas >= 50 },
  { id: 'mente',       nome: 'Mente Brilhante',      r: 'raro',     regra: 'Tenha 5 sugestões aprovadas.',          cond: S => S.sugestoes >= 5 },
  { id: 'guardiao',    nome: 'Guardião do Arcade',   r: 'epico',    regra: 'Assista 150 horas de live.',            cond: S => S.horas >= 150 },
  { id: 'imparavel',   nome: 'Imparável',            r: 'epico',    regra: 'Alcance uma sequência de 12 lives.',    cond: S => S.melhorStreak >= 12 },
  { id: 'lenda',       nome: 'Lenda do Chat',        r: 'lendario', regra: 'Assista 400 horas de live.',            cond: S => S.horas >= 400 },
  { id: 'completista', nome: 'Completista',          r: 'lendario', regra: 'Conquiste a Platina do Arcade.',        cond: S => S.platina }
];

/* ============================================================
   5) CATÁLOGO DO BONECO
   regra: {t:'free'} · {t:'nivel',n} · {t:'horas',h} · {t:'conquista',id}
          {t:'loja'} (compra com moedas; preço = raridade) · {t:'evento',evento} (só admin/código)
   ============================================================ */
const F = { t: 'free' };
const N = n => ({ t: 'nivel', n });
const H = h => ({ t: 'horas', h });
const C = id => ({ t: 'conquista', id });
const L = { t: 'loja' };
const EV = evento => ({ t: 'evento', evento });
const I = (id, nome, r, regra, extra = {}) => ({ id, nome, r, regra, ...extra });

export const CATALOGO = {
  /* ---- Corpo ---- */
  base: [
    I('masc', 'Masculino', 'comum', F),
    I('fem',  'Feminino',  'comum', F)
  ],
  pele: [
    I('clara',  'Clara',  'comum', F, { cor: '#ffdcc2' }),
    I('media',  'Média',  'comum', F, { cor: '#f0b98d' }),
    I('bronze', 'Bronze', 'comum', F, { cor: '#cf9461' }),
    I('morena', 'Morena', 'comum', F, { cor: '#a56c44' }),
    I('escura', 'Escura', 'comum', F, { cor: '#6e4429' }),
    I('alien',  'Alienígena', 'raro', N(15), { cor: '#7be3a0' })
  ],
  /* ---- Rosto ---- */
  rosto: [
    I('feliz',   'Feliz',        'comum',   F),
    I('serio',   'Sério',        'comum',   F),
    I('piscada', 'Piscadinha',   'incomum', N(3)),
    I('sono',    'Sonolento',    'incomum', N(5)),
    I('estrela', 'Olhos de Estrela', 'raro', L),
    I('neon',    'Olhos Neon',   'epico',   C('streak_12'))
  ],
  /* ---- Cabelo ---- */
  cabelo: [
    I('curto',   'Curto',    'comum',   F),
    I('longo',   'Longo',    'comum',   F),
    I('careca',  'Careca',   'comum',   F),
    I('rabo',    'Rabo de Cavalo', 'incomum', N(2)),
    I('coques',  'Coques',   'incomum', N(4)),
    I('moicano', 'Moicano',  'incomum', N(6)),
    I('espetado','Espetado', 'raro',    L)
  ],
  cabeloCor: [
    I('preto', 'Preto', 'comum', F, { cor: '#2b2540' }),
    I('roxo',  'Roxo',  'comum', F, { cor: '#8b5cf6' }),
    I('loiro', 'Loiro', 'comum', F, { cor: '#f2c94c' }),
    I('ruivo', 'Ruivo', 'comum', F, { cor: '#c2531b' }),
    I('prata', 'Prata', 'incomum', N(5),  { cor: '#cbd5e1' }),
    I('rosa',  'Rosa Neon',  'raro', N(10), { cor: '#ff6ec7' }),
    I('ciano', 'Ciano Neon', 'raro', N(10), { cor: '#22d3ee' })
  ],
  /* ---- Roupa ---- */
  roupa: [
    I('moletom',  'Moletom',        'comum',   F),
    I('camiseta', 'Camiseta Gamer', 'comum',   F),
    I('social',   'Camisa Social',  'incomum', N(3)),
    I('vestido',  'Vestido Pixel',  'incomum', N(3)),
    I('jaqueta',  'Jaqueta Neon',   'raro',    L),
    I('armadura', 'Armadura Gamer', 'epico',   N(20))
  ],
  roupaCor: [
    I('roxo',    'Roxo',    'comum', F, { cor: '#7c3aed' }),
    I('grafite', 'Grafite', 'comum', F, { cor: '#454560' }),
    I('preto',   'Preto',   'comum', F, { cor: '#28233c' }),
    I('vermelho','Vermelho','comum', F, { cor: '#dc2626' }),
    I('ciano',   'Ciano',   'incomum', N(5),  { cor: '#06b6d4' }),
    I('dourado', 'Dourado', 'epico',   N(25), { cor: '#f5b82e' })
  ],
  /* ---- Calçados ---- */
  calcado: [
    I('tenis',   'Tênis',        'comum',   F),
    I('chinelo', 'Chinelo',      'comum',   F),
    I('botas',   'Botas',        'incomum', N(4)),
    I('tenis_neon','Tênis Neon', 'raro',    L),
    I('botas_cyber','Botas Cyber','epico',  N(30))
  ],
  calcadoCor: [
    I('branco',  'Branco',  'comum', F, { cor: '#f5f3ff' }),
    I('preto',   'Preto',   'comum', F, { cor: '#1a1330' }),
    I('vermelho','Vermelho','comum', F, { cor: '#dc2626' }),
    I('roxo',    'Roxo',    'incomum', N(3), { cor: '#7c3aed' }),
    I('ciano',   'Ciano',   'raro',    N(12), { cor: '#22d3ee' })
  ],
  /* ---- Acessórios ---- */
  acessorio: [
    I('nenhum',  'Nenhum',        'comum',   F),
    I('oculos',  'Óculos Redondo','comum',   F),
    I('bone',    'Boné',          'comum',   F),
    I('headset', 'Headset Gamer', 'incomum', C('twitch')),
    I('orelhas', 'Orelhas de Gato','raro',   L),
    I('halo',    'Halo',          'epico',   C('horas_50')),
    I('coroa',   'Coroa',         'lendario',N(50))
  ],
  acessorioCor: [
    I('dourado', 'Dourado', 'comum', F, { cor: '#ffd166' }),
    I('lilas',   'Lilás',   'comum', F, { cor: '#c084fc' }),
    I('azul',    'Azul',    'comum', F, { cor: '#7dd3fc' }),
    I('rosa',    'Rosa',    'comum', F, { cor: '#ff6ec7' }),
    I('branco',  'Branco',  'comum', F, { cor: '#f5f3ff' })
  ],
  /* ---- Efeitos ---- */
  efeito: [
    I('nenhum',   'Nenhum',          'comum',   F),
    I('brilho',   'Brilho Suave',    'comum',   N(2)),
    I('faiscas',  'Faíscas',         'incomum', N(8)),
    I('glitch',   'Glitch',          'raro',    L),
    I('aura_roxa','Aura Roxa',       'raro',    N(15)),
    I('aura_neon','Aura Neon',       'epico',   C('horas_200')),
    I('chamas',   'Chamas Pixel',    'epico',   C('streak_4')),
    I('estrelas', 'Chuva de Estrelas','lendario', N(40)),
    I('confete',  'Confete de Aniversário', 'limitado', EV('Aniversário da Soso'))
  ],
  /* ---- Animações (poses no perfil) ---- */
  animacao: [
    I('respirar', 'Respirando',  'comum',   F),
    I('acenar',   'Acenando',    'comum',   F),
    I('pular',    'Pulando',     'incomum', N(3)),
    I('dancar',   'Dançando',    'incomum', N(7)),
    I('flutuar',  'Flutuando',   'raro',    L),
    I('meditar',  'Meditando',   'raro',    C('horas_10')),
    I('comemorar','Comemorando', 'epico',   C('sug_5'))
  ],
  /* ---- Molduras ---- */
  moldura: [
    I('nenhuma',   'Sem moldura',     'comum',   F),
    I('simples',   'Pixel Simples',   'comum',   F),
    I('roxa',      'Pixel Roxa',      'incomum', N(5)),
    I('ciano',     'Neon Ciano',      'raro',    L),
    I('dourada',   'Dourada',         'epico',   N(35)),
    I('holo',      'Holográfica',     'lendario', C(ID_PLATINA)),
    I('evento1',   'Moldura do Evento', 'limitado', EV('Evento de Estreia'))
  ]
};
export const SLOTS = Object.keys(CATALOGO);

export const BONECO_PADRAO = {
  base: 'masc', pele: 'media', rosto: 'feliz',
  cabelo: 'curto', cabeloCor: 'roxo',
  roupa: 'moletom', roupaCor: 'roxo',
  calcado: 'tenis', calcadoCor: 'branco',
  acessorio: 'oculos', acessorioCor: 'dourado',
  efeito: 'nenhum', animacao: 'respirar', moldura: 'simples'
};

const ACHA = {};  // índice rápido slot:id → item
SLOTS.forEach(s => CATALOGO[s].forEach(it => { ACHA[`${s}:${it.id}`] = it; }));
export const acharItem = (slot, id) => ACHA[`${slot}:${id}`] || null;

export function precoDe(item){
  return item.regra.t === 'loja' ? RARIDADES[item.r].preco : 0;
}
export function regraTexto(regra){
  switch(regra.t){
    case 'free':      return 'Liberado desde o início';
    case 'nivel':     return `Alcance o nível ${regra.n}`;
    case 'horas':     return `Assista ${regra.h}h de live`;
    case 'conquista': {
      const c = regra.id === ID_PLATINA ? PLATINA : CONQUISTAS.find(x => x.id === regra.id);
      return `Conquista: ${c ? c.nome : regra.id}`;
    }
    case 'loja':      return 'Compre na loja com SosoCoins';
    case 'evento':    return `Exclusivo de evento: ${regra.evento}`;
    default:          return '—';
  }
}
/* Versão pública do catálogo (o front desenha pelas regras que o servidor manda) */
export function catalogoPublico(){
  const out = {};
  SLOTS.forEach(s => {
    out[s] = CATALOGO[s].map(it => ({
      id: it.id, nome: it.nome, r: it.r, cor: it.cor || null,
      regra: it.regra, regraTxt: regraTexto(it.regra), preco: precoDe(it)
    }));
  });
  return out;
}

/* ============================================================
   6) ESTATÍSTICAS DO JOGADOR
   ============================================================ */
export async function lerStats(id){
  const [flat, ach, inv, conta] = await redis([
    ['HGETALL', `g:${id}`], ['HGETALL', `ach:${id}`], ['SMEMBERS', `inv:${id}`], ['HGET', 'accounts', String(id)]
  ]);
  const g = paraObj(flat);
  const n = k => Number(g[k] || 0);
  const acc = jparse(conta, {});
  const S = {
    xp: n('xp'), coins: n('coins'), minutos: n('minutos'), lives: n('lives'),
    votos: n('votos'), sugestoes: n('sugestoes'), sugestoesEnv: n('sugestoes_env'), codigos: n('codigos'),
    streak: n('streak'), melhorStreak: n('melhorStreak'), ultimaLiveN: n('ultimaLiveN'),
    bonecoSalvo: !!g.boneco, twitch: !!(acc && acc.twitch),
    titulo: g.titulo || 'novato', notifLidoTs: n('notifLidoTs')
  };
  S.horas = S.minutos / 60;
  S.nivel = nivelPorXP(S.xp);
  S.ach = paraObj(ach);
  S.platina = !!S.ach[ID_PLATINA];
  S.inv = new Set(inv || []);          // chaves "slot:id" (loja/evento)
  S.boneco = jparse(g.boneco, null);
  S.conta = acc;
  return S;
}

/* O item está liberado? (regras automáticas são avaliadas aqui, as de loja/evento no inventário) */
export function itemLiberado(slot, item, S, ehDev = false){
  if(ehDev) return true;
  const r = item.regra;
  switch(r.t){
    case 'free':      return true;
    case 'nivel':     return S.nivel >= r.n;
    case 'horas':     return S.horas >= r.h;
    case 'conquista': return !!S.ach[r.id];
    case 'loja':
    case 'evento':    return S.inv.has(`${slot}:${item.id}`);
    default:          return false;
  }
}
export function contarItens(S){
  let n = 0;
  SLOTS.forEach(s => CATALOGO[s].forEach(it => {
    if(!['base', 'pele', 'cabeloCor', 'roupaCor', 'calcadoCor', 'acessorioCor'].includes(s) && itemLiberado(s, it, S)) n++;
  }));
  return n;
}

/* ============================================================
   7) NOTIFICAÇÕES
   ============================================================ */
export async function notificar(id, tipo, texto, extra = {}){
  try {
    await redis([
      ['LPUSH', `notif:${id}`, JSON.stringify({ tipo, texto: safeStr(texto, 160), ts: Date.now(), ...extra })],
      ['LTRIM', `notif:${id}`, '0', '29']
    ]);
  } catch {}
}
export async function lerNotificacoes(id){
  const [lista] = await redis([['LRANGE', `notif:${id}`, '0', '29']]);
  return (lista || []).map(x => jparse(x)).filter(Boolean);
}

/* ============================================================
   8) CRÉDITO DE XP / MOEDAS  — único ponto que altera saldo
   ============================================================ */
export async function creditar(id, { xp = 0, coins = 0, silencioso = false, motivo = '' } = {}){
  xp = Math.max(0, Math.floor(xp)); coins = Math.max(0, Math.floor(coins));
  if(!xp && !coins) return null;
  const cmds = [];
  if(xp) cmds.push(['HINCRBY', `g:${id}`, 'xp', String(xp)]);
  if(coins) cmds.push(['HINCRBY', `g:${id}`, 'coins', String(coins)]);
  const res = await redis(cmds);
  let novoXP = null;
  if(xp) novoXP = Number(res[0]);

  let subiu = 0;
  if(novoXP != null){
    const antes = nivelPorXP(novoXP - xp), depois = nivelPorXP(novoXP);
    await redis([['ZADD', 'rank:xp', String(novoXP), String(id)]]);
    if(depois > antes){
      subiu = depois - antes;
      await redis([['HINCRBY', `g:${id}`, 'coins', String(subiu * RECOMPENSA_NIVEL_COINS)]]);
      await notificar(id, 'nivel', `Subiu para o nível ${depois}! +${subiu * RECOMPENSA_NIVEL_COINS} ${MOEDA.nome}`);
      const novos = [];
      SLOTS.forEach(s => CATALOGO[s].forEach(it => {
        if(it.regra.t === 'nivel' && it.regra.n > antes && it.regra.n <= depois) novos.push(it.nome);
      }));
      if(novos.length) await notificar(id, 'item', `Liberado no inventário: ${novos.join(', ')}`);
    }
  }
  if(!silencioso && motivo){
    const partes = [xp ? `+${xp} XP` : '', coins ? `+${coins} ${MOEDA.nome}` : ''].filter(Boolean).join(' · ');
    await notificar(id, 'ganho', `${motivo}: ${partes}`);
  }
  return { novoXP, subiu };
}

/* ============================================================
   9) EVENTOS VALIDADOS PELO SERVIDOR
   Chame SEMPRE do backend (ex.: dentro de api/votos.js depois de gravar o voto).
   `ref` = id único da ação (ex.: `${ciclo}`, id da sugestão) → impede pagar 2x.
   ============================================================ */
export async function evento(id, nome, ref, { statExtra = {} } = {}){
  const cfg = EVENTOS[nome];
  if(!cfg || !id) return { pago: false, motivo: 'evento desconhecido' };
  id = String(id); ref = String(ref || 'unico');

  // 1) idempotência: a mesma ação nunca paga duas vezes
  const [nx] = await redis([['SET', `xpev:${id}:${nome}:${ref}`, '1', 'NX', 'EX', String(90 * 86400)]]);
  if(nx !== 'OK') return { pago: false, motivo: 'já contabilizado' };

  // 2) estatística conta sempre (histórico real)
  const cmds = [];
  if(cfg.stat) cmds.push(['HINCRBY', `g:${id}`, cfg.stat, '1']);
  Object.entries(statExtra).forEach(([k, v]) => cmds.push(['HINCRBY', `g:${id}`, k, String(v)]));
  if(cmds.length) await redis(cmds);

  // 3) teto diário de ganho (a estatística acima continua contando)
  let paga = true;
  if(cfg.limiteDia){
    const chave = `xpdia:${id}:${nome}:${hojeBR()}`;
    const [n] = await redis([['INCR', chave]]);
    if(Number(n) === 1) await redis([['EXPIRE', chave, '172800']]);
    paga = Number(n) <= cfg.limiteDia;
  }
  if(paga) await creditar(id, { xp: cfg.xp, coins: cfg.coins, motivo: cfg.rotulo });
  await avaliarConquistas(id);
  return { pago: paga };
}

/* ============================================================
   10) CONQUISTAS + PLATINA
   ============================================================ */
export async function avaliarConquistas(id){
  const novas = [];
  for(let passo = 0; passo < 3; passo++){
    const S = await lerStats(id);
    S.itens = contarItens(S);
    let ganhouNestePasso = false;

    for(const c of CONQUISTAS){
      if(S.ach[c.id]) continue;
      let ok = false;
      try { ok = !!c.cond(S); } catch {}
      if(!ok) continue;
      const [novo] = await redis([['HSETNX', `ach:${id}`, c.id, String(Date.now())]]);
      if(Number(novo) !== 1) continue;           // outra requisição já deu
      ganhouNestePasso = true; novas.push(c);
      await creditar(id, { ...c.premio, silencioso: true });
      await notificar(id, 'conquista', `Conquista desbloqueada: ${c.nome}`, { icone: c.icone });
    }
    // Platina: todas as outras
    const tudo = CONQUISTAS.every(c => S.ach[c.id] || novas.includes(c));
    if(tudo && !S.ach[ID_PLATINA]){
      const [novo] = await redis([['HSETNX', `ach:${id}`, ID_PLATINA, String(Date.now())]]);
      if(Number(novo) === 1){
        ganhouNestePasso = true; novas.push(PLATINA);
        await creditar(id, { ...PLATINA.premio, silencioso: true });
        await notificar(id, 'platina', '💎 PLATINA DO ARCADE! Você completou 100% das conquistas!', { icone: PLATINA.icone });
      }
    }
    if(!ganhouNestePasso) break;
  }
  return novas.map(c => c.id);
}

/* ============================================================
   11) BONECO — validação (anti-cheat de inventário)
   ============================================================ */
export function validarBoneco(entrada, S, ehDev = false){
  const final = {}, rejeitados = [];
  SLOTS.forEach(slot => {
    const id = entrada && entrada[slot];
    const item = acharItem(slot, id);
    if(!item){ final[slot] = BONECO_PADRAO[slot]; if(id !== undefined) rejeitados.push({ slot, id, motivo: 'inexistente' }); return; }
    if(!itemLiberado(slot, item, S, ehDev)){ final[slot] = BONECO_PADRAO[slot]; rejeitados.push({ slot, id, motivo: regraTexto(item.regra) }); return; }
    final[slot] = id;
  });
  return { boneco: final, rejeitados };
}
/* Ranking/visualização: nunca confie no que está salvo — saneia na leitura */
export function bonecoSeguro(salvo, S){
  return validarBoneco(salvo || BONECO_PADRAO, S, false).boneco;
}

/* ============================================================
   12) TÍTULOS
   ============================================================ */
export function titulosDe(S){
  return TITULOS.map(t => {
    let ok = false; try { ok = !!t.cond(S); } catch {}
    return { id: t.id, nome: t.nome, r: t.r, regra: t.regra, liberado: ok };
  });
}

/* ============================================================
   13) PRESENÇA EM LIVE (streak) — chamado pelo cron, 100% no servidor
   ============================================================ */
export async function registrarPresenca(id, num){
  // Retorna true se esta live passou a CONTAR para o usuário agora.
  const [novo] = await redis([['HSETNX', `att:${num}`, String(id), String(Date.now())]]);
  if(Number(novo) !== 1) return false;
  await redis([['EXPIRE', `att:${num}`, String(400 * 86400)]]);

  const [ultima, streakAtual, melhor] = (await redis([['HMGET', `g:${id}`, 'ultimaLiveN', 'streak', 'melhorStreak']]))[0].map(x => Number(x || 0));
  // Sequência = lives VÁLIDAS consecutivas (nº da live no servidor). Faltou uma → zera.
  const streak = ultima === num - 1 ? streakAtual + 1 : 1;
  const novoMelhor = Math.max(melhor, streak);
  await redis([
    ['HSET', `g:${id}`, 'ultimaLiveN', String(num), 'streak', String(streak), 'melhorStreak', String(novoMelhor)],
    ['HINCRBY', `g:${id}`, 'lives', '1']
  ]);
  const xp = LIVE.XP_PRESENCA + Math.min(streak, 10) * LIVE.XP_STREAK_POR_LIVE;
  const coins = LIVE.MARCOS_STREAK[streak] || 0;
  await creditar(id, { xp, coins, motivo: `Live contada (sequência ${streak}🔥)` });
  if(coins) await notificar(id, 'streak', `🔥 Sequência de ${streak} lives! Bônus de ${coins} ${MOEDA.nome}`);
  return true;
}
