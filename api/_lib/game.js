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
  { id: 'bem_vindo', icone: '🕹️', nome: 'Spawnou no Cantinho', desc: 'Criou a conta. O tutorial é opcional, o caos do chat não.', r: 'comum', cond: S => true, progresso: { campo: 'sempre', meta: 1, unidade: 'cadastro' }, premio: { xp: 10, coins: 5 } },
  { id: 'estilo', icone: '🎨', nome: 'Skin de Respeito', desc: 'Salve seu boneco. O drip do chat merece ser registrado.', r: 'comum', cond: S => S.bonecoSalvo, progresso: { campo: 'bonecoSalvo', meta: 1, unidade: 'visual salvo' }, premio: { xp: 25, coins: 10 } },
  { id: 'twitch', icone: '🔗', nome: 'Linkou, Tá Linkado', desc: 'Conecte sua Twitch para o Arcade reconhecer sua presença nas lives.', r: 'comum', cond: S => S.twitch, progresso: { campo: 'twitch', meta: 1, unidade: 'conta vinculada' }, premio: { xp: 30, coins: 20 } },

  { id: 'voto_1', icone: '🗳️', nome: 'Primeiro Papo', desc: 'Deu seu primeiro voto. Democracia do chat em ação!', r: 'comum', cond: S => S.votos >= 1, progresso: { campo: 'votos', meta: 1, unidade: 'votos' }, premio: { xp: 15, coins: 5 } },
  { id: 'voto_25', icone: '📣', nome: 'Chat Influencer', desc: 'Registre 25 votos. A Soso que lute com esse poder democrático.', r: 'incomum', cond: S => S.votos >= 25, progresso: { campo: 'votos', meta: 25, unidade: 'votos' }, premio: { xp: 50, coins: 25 } },
  { id: 'voto_100', icone: '📢', nome: 'Voz da Comunidade', desc: '100 votos registrados. Seu dedo já tem cadeira cativa nas votações.', r: 'epico', cond: S => S.votos >= 100, progresso: { campo: 'votos', meta: 100, unidade: 'votos' }, premio: { xp: 180, coins: 90 } },

  { id: 'sug_1', icone: '💡', nome: 'Ideia no Chat', desc: 'Mandou a primeira sugestão. Agora é torcer para a Soso não fingir que não viu 👀', r: 'incomum', cond: S => S.sugestoesEnv >= 1, progresso: { campo: 'sugestoesEnv', meta: 1, unidade: 'sugestões enviadas' }, premio: { xp: 30, coins: 15 } },
  { id: 'sug_5', icone: '🧠', nome: 'Mente Brilhante', desc: 'Cinco ideias enviadas. O chat virou reunião de brainstorm.', r: 'raro', cond: S => S.sugestoesEnv >= 5, progresso: { campo: 'sugestoesEnv', meta: 5, unidade: 'sugestões enviadas' }, premio: { xp: 100, coins: 50 } },
  { id: 'sug_10', icone: '🪐', nome: 'Ideias em Órbita', desc: 'Dez sugestões no sistema. Uma hora dessas sai até um jogo delas.', r: 'epico', cond: S => S.sugestoesEnv >= 10, progresso: { campo: 'sugestoesEnv', meta: 10, unidade: 'sugestões enviadas' }, premio: { xp: 220, coins: 110 } },

  { id: 'horas_10', icone: '📺', nome: 'Lurker de Carteirinha', desc: '10 horas de live. Já sabe até quando a Soso vai falar “só mais uma”.', r: 'incomum', cond: S => S.horas >= 10, progresso: { campo: 'horas', meta: 10, unidade: 'horas' }, premio: { xp: 100, coins: 50 } },
  { id: 'horas_50', icone: '🛋️', nome: 'Móvel do Chat', desc: '50 horas assistidas. Já pode pedir endereço fixo no cantinho.', r: 'raro', cond: S => S.horas >= 50, progresso: { campo: 'horas', meta: 50, unidade: 'horas' }, premio: { xp: 300, coins: 150 } },
  { id: 'horas_200', icone: '🏛️', nome: 'Patrimônio do Chat', desc: 'Complete 200 horas de companhia. Já é praticamente parte da decoração.', r: 'epico', cond: S => S.horas >= 200, progresso: { campo: 'horas', meta: 200, unidade: 'horas' }, premio: { xp: 650, coins: 320 } },
  { id: 'horas_500', icone: '🌌', nome: 'Habitante do Cantinho', desc: 'Chegue a 500 horas de live. O algoritmo já te considera morador.', r: 'lendario', cond: S => S.horas >= 500, progresso: { campo: 'horas', meta: 500, unidade: 'horas' }, premio: { xp: 900, coins: 500 } },

  { id: 'streak_4', icone: '🔥', nome: 'Sequência de Fogo', desc: 'Quatro lives seguidas. Nem o despertador te segura.', r: 'incomum', cond: S => S.melhorStreak >= 4, progresso: { campo: 'melhorStreak', meta: 4, unidade: 'lives seguidas' }, premio: { xp: 120, coins: 60 } },
  { id: 'streak_12', icone: '⚡', nome: 'Imparável', desc: 'Doze lives em sequência. Isso já é compromisso sério.', r: 'epico', cond: S => S.melhorStreak >= 12, progresso: { campo: 'melhorStreak', meta: 12, unidade: 'lives seguidas' }, premio: { xp: 350, coins: 180 } },
  { id: 'streak_30', icone: '🔥', nome: 'Chama Eterna', desc: 'Trinta lives seguidas. O chat devia te dar um vale-descanso.', r: 'lendario', cond: S => S.melhorStreak >= 30, progresso: { campo: 'melhorStreak', meta: 30, unidade: 'lives seguidas' }, premio: { xp: 800, coins: 450 } },

  { id: 'codigo_1', icone: '🔑', nome: 'Senha do Fliperama', desc: 'Resgatou seu primeiro código secreto. Konami ficaria orgulhosa.', r: 'comum', cond: S => S.codigos >= 1, progresso: { campo: 'codigos', meta: 1, unidade: 'códigos' }, premio: { xp: 20, coins: 10 } },
  { id: 'codigo_5', icone: '🗝️', nome: 'Caçador Noturno', desc: 'Cinco códigos resgatados. Está ouvindo até os sussurros do chat.', r: 'raro', cond: S => S.codigos >= 5, progresso: { campo: 'codigos', meta: 5, unidade: 'códigos' }, premio: { xp: 100, coins: 50 } },
  { id: 'codigo_10', icone: '🧩', nome: 'Criptógrafo da Soso', desc: 'Dez códigos resgatados. Você não assiste à live, você investiga.', r: 'epico', cond: S => S.codigos >= 10, progresso: { campo: 'codigos', meta: 10, unidade: 'códigos' }, premio: { xp: 220, coins: 110 } },

  { id: 'nivel_10', icone: '⭐', nome: 'Build em Andamento', desc: 'Chegue ao nível 10. Seu personagem já está ficando perigoso.', r: 'incomum', cond: S => S.nivel >= 10, progresso: { campo: 'nivel', meta: 10, unidade: 'níveis' }, premio: { xp: 0, coins: 100 } },
  { id: 'nivel_25', icone: '🌟', nome: 'Veterano do Fliperama', desc: 'Nível 25 alcançado. Já conhece os atalhos desse mapa.', r: 'raro', cond: S => S.nivel >= 25, progresso: { campo: 'nivel', meta: 25, unidade: 'níveis' }, premio: { xp: 0, coins: 250 } },
  { id: 'nivel_50', icone: '👑', nome: 'Lenda em Construção', desc: 'Chegue ao nível 50. A build está quase quebrando o balanceamento.', r: 'lendario', cond: S => S.nivel >= 50, progresso: { campo: 'nivel', meta: 50, unidade: 'níveis' }, premio: { xp: 0, coins: 600 } },

  { id: 'colecionador', icone: '🎒', nome: 'Inventário de Respeito', desc: 'Desbloqueie 20 peças. O guarda-roupa já está pedindo expansão.', r: 'raro', cond: S => S.itens >= 20, progresso: { campo: 'itens', meta: 20, unidade: 'itens' }, premio: { xp: 150, coins: 80 } },
  { id: 'primeira_live', icone: '💜', nome: 'Primeiro Rolê', desc: 'Marque presença na primeira live válida da Soso. Bem-vindo ao rolê!', r: 'comum', cond: S => S.lives >= 1, progresso: { campo: 'lives', meta: 1, unidade: 'lives' }, premio: { xp: 25, coins: 10 } },
  { id: 'chat_ativo', icone: '📡', nome: 'Presença Confirmada', desc: 'Dez lives válidas. O bot já te reconhece pelo nome.', r: 'incomum', cond: S => S.lives >= 10, progresso: { campo: 'lives', meta: 10, unidade: 'lives' }, premio: { xp: 120, coins: 60 } }
];
export const VERSAO_CONQUISTAS = '6'; // metas alinhadas aos IDs; IDs legados preservados para manter desbloqueios existentes
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
  { id: 'novato',          nome: 'Novato',                 r: 'comum',    regra: 'Todo mundo começa aqui.',                    cond: S => true },
  { id: 'hype',            nome: 'Hype do Chat',            r: 'comum',    regra: 'Participe de uma live válida.',               cond: S => S.lives >= 1 },
  { id: 'visitante',       nome: 'Visitante Assíduo',      r: 'comum',    regra: 'Assista 2 horas de live.',                     cond: S => S.horas >= 2 },
  { id: 'lurker',          nome: 'Presença Constante',      r: 'incomum',  regra: 'Acumule 5 horas assistidas.',                 cond: S => S.horas >= 5 },
  { id: 'fiel',            nome: 'Fiel do Chat',            r: 'incomum',  regra: 'Assista 10 horas de live.',                    cond: S => S.horas >= 10 },
  { id: 'voz',             nome: 'Voz do Povo',             r: 'incomum',  regra: 'Acumule 25 votos.',                            cond: S => S.votos >= 25 },
  { id: 'veterano',        nome: 'Veterano das Lives',      r: 'raro',     regra: 'Assista 50 horas de live.',                    cond: S => S.horas >= 50 },
  { id: 'mente',           nome: 'Conselheiro do Cantinho', r: 'raro',     regra: 'Tenha 5 sugestões aprovadas pela Soso.',       cond: S => S.sugestoes >= 5 },
  { id: 'cacador',         nome: 'Caçador de Segredos',     r: 'raro',     regra: 'Resgate 5 códigos secretos.',                 cond: S => S.codigos >= 5 },
  { id: 'votante_vip',     nome: 'Votante VIP',             r: 'epico',    regra: 'Registre 50 votos no chat.',                  cond: S => S.votos >= 50 },
  { id: 'guardiao',        nome: 'Guardião do Arcade',      r: 'epico',    regra: 'Assista 100 horas de live.',                   cond: S => S.horas >= 100 },
  { id: 'imparavel',       nome: 'Imparável',               r: 'epico',    regra: 'Alcance uma sequência de 12 lives.',           cond: S => S.melhorStreak >= 12 },
  { id: 'embaixador',      nome: 'Embaixador do Cantinho',  r: 'epico',    regra: 'Envie 25 sugestões para a comunidade.',        cond: S => S.sugestoesEnv >= 25 },
  { id: 'lenda',           nome: 'Lenda do Chat',           r: 'lendario', regra: 'Assista 200 horas de live.',                   cond: S => S.horas >= 200 },
  { id: 'lenda_cantinho',  nome: 'Lenda do Cantinho',       r: 'lendario', regra: 'Alcance 30 lives consecutivas.',              cond: S => S.melhorStreak >= 30 },
  { id: 'completista',     nome: 'Completista',             r: 'lendario', regra: 'Conquiste a Platina do Arcade.',              cond: S => S.platina },
  { id: 'estilista',       nome: 'Estilista do Arcade',     r: 'incomum',  regra: 'Salve seu primeiro visual no guarda-roupa.',  cond: S => S.bonecoSalvo },
  { id: 'colecionador',    nome: 'Colecionador de Pixel',   r: 'raro',     regra: 'Desbloqueie 20 peças do guarda-roupa.',        cond: S => S.itens >= 20 },
  { id: 'veterano_chat',   nome: 'Figura Carimbada',        r: 'raro',     regra: 'Marque presença em 25 lives válidas.',        cond: S => S.lives >= 25 },
  { id: 'mestre_ideias',   nome: 'Mestre das Ideias',       r: 'epico',    regra: 'Tenha 10 sugestões aprovadas pela Soso.',     cond: S => S.sugestoes >= 10 }
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
    I('laco', 'Laço Pixel', 'incomum', N(6)),
    I('oculos_sol', 'Óculos Neon', 'raro', L),
    I('microfone', 'Microfone de Streamer', 'epico', C('twitch')),
    I('gatinho', 'Mascote Gatinho', 'raro', C('primeira_live')),
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
    I('comemorar','Comemorando', 'epico',   C('sug_5')),
    I('hype', 'Hype do Chat', 'raro', N(12))
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
  // Também calcula a coleção aqui, pois titulosDe() é usado tanto na leitura
  // do perfil quanto na validação de títulos equipados.
  S.itens = contarItens(S);
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

export async function creditar(id, { xp = 0, coins = 0, silencioso = false, motivo = '' } = {}){
  xp = Math.max(0, Math.floor(Number(xp) || 0));
  coins = Math.max(0, Math.floor(Number(coins) || 0));
  if(!xp && !coins) return null;

  const [resultado] = await redis([[
    'EVAL', CREDITAR_LUA, '2', `g:${id}`, 'rank:xp',
    String(xp), String(coins), String(id)
  ]]);
  const dados = Array.isArray(resultado) ? resultado.map(Number) : [];
  if(dados.length < 6) throw new Error('Resposta inválida ao creditar XP/moedas.');

  const novoXP = xp ? dados[0] : null;
  const antes = dados[1] || 1;
  const depois = dados[2] || antes;
  const subiu = dados[3] || 0;

  if(subiu > 0){
    await notificar(id, 'nivel', `Subiu para o nível ${depois}! +${subiu * RECOMPENSA_NIVEL_COINS} ${MOEDA.nome}`);
    const novos = [];
    SLOTS.forEach(slot => CATALOGO[slot].forEach(item => {
      if(item.regra.t === 'nivel' && item.regra.n > antes && item.regra.n <= depois) novos.push(item.nome);
    }));
    if(novos.length) await notificar(id, 'item', `Liberado no inventário: ${novos.join(', ')}`);
  }
  if(!silencioso && motivo){
    const partes = [xp ? `+${xp} XP` : '', coins ? `+${coins} ${MOEDA.nome}` : ''].filter(Boolean).join(' · ');
    if(partes) await notificar(id, 'ganho', `${motivo}: ${partes}`);
  }
  return { novoXP, subiu, saldo: dados[5] };
}

/* ============================================================
   9) EVENTOS VALIDADOS PELO SERVIDOR
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

  // Mesmo em chamadas repetidas, reavalia conquistas: isso recupera uma
  // avaliação que possa ter falhado depois de o evento já ter sido gravado.
  if(executado){
    const pago = dados[1] === 1;
    const novoXP = Number(dados[2] || 0);
    const antes = Number(dados[3] || 1);
    const depois = Number(dados[4] || antes);
    const totalCoins = Number(dados[5] || 0);
    if(pago && (cfg.xp || cfg.coins)){
      const partes = [cfg.xp ? `+${cfg.xp} XP` : '', cfg.coins ? `+${cfg.coins} ${MOEDA.nome}` : ''].filter(Boolean).join(' · ');
      await notificar(id, 'ganho', `${cfg.rotulo}: ${partes}`);
    }
    if(depois > antes){
      await notificar(id, 'nivel', `Subiu para o nível ${depois}! +${(depois - antes) * RECOMPENSA_NIVEL_COINS} ${MOEDA.nome}`);
      const liberados = [];
      SLOTS.forEach(slot => CATALOGO[slot].forEach(item => {
        if(item.regra.t === 'nivel' && item.regra.n > antes && item.regra.n <= depois) liberados.push(item.nome);
      }));
      if(liberados.length) await notificar(id, 'item', `Liberado no inventário: ${liberados.join(', ')}`);
    }
    await avaliarConquistas(id);
    return { pago, xp: pago ? cfg.xp : 0, coins: totalCoins, novoXP, subiu: Math.max(0, depois - antes) };
  }

  await avaliarConquistas(id);
  return { pago: false, motivo: 'já contabilizado' };
}

/* ============================================================
   10) CONQUISTAS + PLATINA
   O desbloqueio e o prêmio são gravados no mesmo script Redis. Assim,
   uma falha entre marcar a conquista e entregar XP/moedas não perde prêmio.
   ============================================================ */
const CONQUISTA_LUA = `
local function nivel(xp)
  local n = math.floor((1 + math.sqrt(1 + math.max(0, xp) / 12.5)) / 2)
  if n < 1 then return 1 end
  if n > 100 then return 100 end
  return n
end
if redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2]) ~= 1 then
  local xp = tonumber(redis.call('HGET', KEYS[2], 'xp') or '0')
  local atual = nivel(xp)
  return {0, xp, xp, atual, atual, 0}
end
local xpPremio = tonumber(ARGV[3]) or 0
local moedasPremio = tonumber(ARGV[4]) or 0
local userId = ARGV[5]
local xpAntes = tonumber(redis.call('HGET', KEYS[2], 'xp') or '0')
local nivelAntes = nivel(xpAntes)
local xpDepois = xpAntes
if xpPremio > 0 then
  xpDepois = redis.call('HINCRBY', KEYS[2], 'xp', xpPremio)
  redis.call('ZADD', KEYS[3], xpDepois, userId)
end
local nivelDepois = nivel(xpDepois)
local bonusNivel = math.max(0, nivelDepois - nivelAntes) * 20
local moedasTotais = moedasPremio + bonusNivel
if moedasTotais > 0 then redis.call('HINCRBY', KEYS[2], 'coins', moedasTotais) end
return {1, xpAntes, xpDepois, nivelAntes, nivelDepois, moedasTotais}
`;

async function concederConquista(id, conquista){
  const xp = Number(conquista?.premio?.xp || 0);
  const coins = Number(conquista?.premio?.coins || 0);
  const [resultado] = await redis([[
    'EVAL', CONQUISTA_LUA, '3', `ach:${id}`, `g:${id}`, 'rank:xp',
    String(conquista.id), String(Date.now()), String(xp), String(coins), String(id)
  ]]);
  const dados = Array.isArray(resultado) ? resultado.map(Number) : [];
  if(dados[0] !== 1) return false;

  if(xp || coins){
    const partes = [xp ? `+${xp} XP` : '', coins ? `+${coins} ${MOEDA.nome}` : ''].filter(Boolean).join(' · ');
    await notificar(id, 'ganho', `Recompensa de ${conquista.nome}: ${partes}`);
  }
  const nivelAntes = Number(dados[3] || 1);
  const nivelDepois = Number(dados[4] || nivelAntes);
  if(nivelDepois > nivelAntes){
    await notificar(id, 'nivel', `Subiu para o nível ${nivelDepois}! +${(nivelDepois - nivelAntes) * RECOMPENSA_NIVEL_COINS} ${MOEDA.nome}`);
    const liberados = [];
    SLOTS.forEach(slot => CATALOGO[slot].forEach(item => {
      if(item.regra.t === 'nivel' && item.regra.n > nivelAntes && item.regra.n <= nivelDepois) liberados.push(item.nome);
    }));
    if(liberados.length) await notificar(id, 'item', `Liberado no inventário: ${liberados.join(', ')}`);
  }
  return true;
}

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
      if(!(await concederConquista(id, c))) continue;
      ganhouNestePasso = true; novas.push(c);
      await notificar(id, 'conquista', `Conquista desbloqueada: ${c.nome}`, { icone: c.icone });
    }
    // Platina: todas as outras
    const tudo = CONQUISTAS.every(c => S.ach[c.id] || novas.includes(c));
    if(tudo && !S.ach[ID_PLATINA]){
      if(await concederConquista(id, PLATINA)){
        ganhouNestePasso = true; novas.push(PLATINA);
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
  if(dados[0] !== 1) return false;

  const streak = Number(dados[1] || 1);
  const melhor = Number(dados[2] || streak);
  const xp = Number(dados[3] || 0);
  const coins = Number(dados[4] || 0);
  const antes = Number(dados[5] || 1);
  const depois = Number(dados[6] || antes);
  const totalCoins = Number(dados[8] || coins);

  await notificar(id, 'ganho', `Live contada (sequência ${streak}🔥): +${xp} XP${totalCoins ? ` · +${totalCoins} ${MOEDA.nome}` : ''}`);
  if(coins) await notificar(id, 'streak', `🔥 Sequência de ${streak} lives! Bônus de ${coins} ${MOEDA.nome}`);
  if(depois > antes){
    await notificar(id, 'nivel', `Subiu para o nível ${depois}! +${(depois - antes) * RECOMPENSA_NIVEL_COINS} ${MOEDA.nome}`);
    const liberados = [];
    SLOTS.forEach(slot => CATALOGO[slot].forEach(item => {
      if(item.regra.t === 'nivel' && item.regra.n > antes && item.regra.n <= depois) liberados.push(item.nome);
    }));
    if(liberados.length) await notificar(id, 'item', `Liberado no inventário: ${liberados.join(', ')}`);
  }
  return true;
}
