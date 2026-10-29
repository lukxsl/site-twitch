/* ============================================================
   SETUP — MINI-GAME 2D + CATÁLOGO (TOUR DO LUKZIN)
   1. Dados   2. Utils   3. Lukzin   4. Diálogo/Tour/Recap
   5. Easter egg do gato   6. Catálogo   7. Init
   ============================================================ */
(() => {
'use strict';

// Evita rodar duas vezes se o script for incluído em dobro
if (window.__setupLoaded) return;
window.__setupLoaded = true;

/* ============================================================
   1. DADOS
   x,y     → posição do hotspot (% da imagem do quarto)
   stand   → onde o Lukzin para (no chão, em frente ao item)
   oculto  → item secreto (sem hotspot visível)
   ============================================================ */
const P = (nome, q, detalhe = '', extra = {}) => ({ nome, q, detalhe, ...extra });

const CATS = {
  pc:          { nome: 'PC',              emoji: '🚀' },
  perifericos: { nome: 'Periféricos',     emoji: '🖱️' },
  conforto:    { nome: 'Conforto & Vibe', emoji: '🐰' }
};

const SETUP_DATA = {
  gabinete: {
    titulo: 'Gabinete Risemode Aquarium', emoji: '🚀', cat: 'pc', raridade: 'lendario',
    x: 81.4, y: 45.5, stand: { x: 82, y: 82 },
    fala: 'O coração da máquina! Tá bão demais! 🚀',
    texto: 'Chegamos no cérebro da operação, e ó: tá bão demais! Aqui dentro roda um Ryzen 9 5900X com 12 núcleos, 48GB de RAM, placa-mãe X570 TUF e uma RTX 3060 de 12GB branquinha, tudo refrigerado por um water cooler com RGB e enfeitado pelo vidro do Aquarium. Pode abrir 50 abas e a Soso ainda joga numa boa.',
    pecas: [
      P('Processador AMD Ryzen 9 5900X', 'AMD Ryzen 9 5900X processador', '12 núcleos / 24 threads'),
      P('Memória RAM 48GB', 'memoria ram ddr4 48gb', 'Folga de sobra pra live + jogo'),
      P('Placa-mãe ASUS X570 TUF', 'placa mae asus x570 tuf gaming', 'Chipset X570, PCIe 4.0'),
      P('Placa de Vídeo RTX 3060 12GB', 'placa de video rtx 3060 12gb branca', '12GB de VRAM, combina com o setup'),
      P('Water Cooler Risemode Aura RGB', 'water cooler risemode aura rgb', 'Refrigeração líquida com RGB'),
      P('SSD NVMe 2TB', 'ssd nvme 2tb m.2', 'Jogos carregando voando'),
      P('Fonte Corsair RM800W', 'fonte corsair rm800w 80 plus gold', '800W modular'),
      P('Gabinete Risemode Aquarium Branco', 'gabinete risemode aquarium branco', 'Vidro temperado')
    ]
  },
  monitor: {
    titulo: 'Monitor AOC 240Hz', emoji: '🖥️', cat: 'perifericos', raridade: 'epico',
    x: 52, y: 45, stand: { x: 52, y: 90 },
    fala: 'Aqui a mágica acontece! Fica bão demais! ✨',
    texto: 'Tudo bão por aqui? Esse é o palco principal! Um monitor AOC de 240Hz deixa tudo absurdamente fluido, e olha só: a Soso está plantando coisa no Stardew Valley agora. Quem disse que setup gamer não pode ser fazendeiro?',
    pecas: [P('Monitor Gamer AOC 240Hz', 'monitor gamer aoc 240hz 1ms', '240Hz, imagem lisinha')]
  },
  webcam: {
    titulo: 'Webcam iPhone 11', emoji: '📱', cat: 'perifericos', raridade: 'raro',
    x: 52, y: 34.5, stand: { x: 47, y: 88 },
    fala: 'Olha o passarinho, fica bão! 📸',
    texto: 'Plot twist: a webcam é um iPhone 11! A câmera dele entrega uma qualidade que muita webcam cara não alcança, e é por isso que a live aparece nítida mesmo com a iluminação neon do quarto.',
    pecas: [P('iPhone 11 (usado como webcam)', 'iphone 11 128gb', 'Câmera de celular trabalhando como webcam')]
  },
  teclado: {
    titulo: 'Logitech G PRO X TKL', emoji: '⌨️', cat: 'perifericos', raridade: 'epico',
    x: 50.8, y: 62.2, stand: { x: 47, y: 90 },
    fala: 'Tec tec tec! ⌨️',
    texto: 'O teclado é um Logitech G PRO X TKL branco: formato compacto (sem o numérico), que deixa um espaço enorme pro mouse, e é sem fio. Perfeito pra quem joga de verdade e ainda quer a mesa organizada. Digitar nele é bão demais!',
    pecas: [P('Teclado Logitech G PRO X TKL Branco', 'teclado logitech g pro x tkl branco', 'TKL, sem fio')]
  },
  mouse: {
    titulo: 'Logitech G502X Superlight', emoji: '🖱️', cat: 'perifericos', raridade: 'epico',
    x: 60.5, y: 62.5, stand: { x: 62, y: 90 },
    fala: 'Leve, preciso e bão! 🎯',
    texto: 'Esse é o Logitech G502X Superlight com RGB. Leve como uma pena e preciso como um laser, ele é o parceiro de qualquer clutch e deixa a mesa com cara de nave espacial.',
    pecas: [P('Mouse Logitech G502X Superlight', 'mouse logitech g502x plus superlight', 'Leve, sensor preciso')]
  },
  headset: {
    titulo: 'Headset Astro A30', emoji: '🎧', cat: 'perifericos', raridade: 'epico',
    x: 67.4, y: 53.8, stand: { x: 70, y: 88 },
    fala: 'Som de cinema! 🎧',
    texto: 'O Astro A30 é o ouvido da Soso: sem fio, confortável pra lives longas e com um som que deixa ouvir o passo do inimigo, a trilha do jogo e o chat sem brigar um com o outro. Áudio bão é tudo, né?',
    pecas: [P('Headset Astro A30', 'headset astro a30', 'Sem fio, confortável')]
  },
  microfone: {
    titulo: 'Microfone FIFINE AM8', emoji: '🎙️', cat: 'perifericos', raridade: 'raro',
    x: 38.8, y: 54.2, stand: { x: 41, y: 88 },
    fala: 'A voz da Soso, sempre bão! 🎙️',
    texto: 'Aqui nasce a voz que você ouve nas lives! O FIFINE AM8 branco é um microfone dinâmico que capta bem a voz e ignora boa parte do barulho do quarto. Ótimo pra risadas e também pros gritos de susto.',
    pecas: [P('Microfone FIFINE AM8 Branco', 'microfone fifine am8 branco', 'Dinâmico, USB e XLR')]
  },
  cadeira: {
    titulo: 'Cadeira XT Racer', emoji: '🪑', cat: 'conforto', raridade: 'raro',
    x: 62.3, y: 78.7, stand: { x: 74, y: 92 },
    fala: 'O trono da Soso! Senta que é bão! 👑',
    texto: 'A base de tudo é a cadeira XT Racer. Confortável o bastante pra aguentar aquelas lives de várias horas sem reclamar das costas, e com visual de assento de piloto.',
    pecas: [P('Cadeira Gamer XT Racer', 'cadeira gamer xt racer', 'Conforto pra lives longas')]
  },
  gato: {
    titulo: 'Gatinho Misterioso', emoji: '🐱', cat: 'conforto', raridade: 'lendario', oculto: true,
    x: 51.8, y: 20.4, stand: { x: 51, y: 86 },
    fala: 'Miau! 🐱',
    texto: 'Você encontrou o segredo! O gatinho do quadro é o verdadeiro chefe do setup. A Soso ama gatos, e esse aí vigia todas as lives de camarote. Só aparece pra quem clica muito!',
    pecas: [P('Quadro do Gatinho', '', 'Easter Egg', { semLoja: true })]
  }
};

// Rota do tour: um circuito pelo quarto (Itens removidos não estão aqui)
const ORDEM_TOUR = ['monitor', 'webcam', 'teclado', 'mouse', 'headset', 'gabinete', 'cadeira', 'microfone'];
const RARIDADE = { lendario: 'Lendário', epico: 'Épico', raro: 'Raro' };
const GATO_CLIQUES = 5;

// Onde o Lukzin fica sentado (centro da cadeira, em % da imagem do quarto)
const CADEIRA = { x: 62.3, y: 78.7 };
const SENTADO_SPRITE = 'img/lukzin-sentado.png';   // OPCIONAL: se existir, é usado no lugar do corte em CSS
const BAO_GREETING = 'Tudo bão? 💜 Clica em mim!';
const BAO_FALAS = [
  'Tudo bão? 💜',
  'Fica bão demais, né? ✨',
  'Tá bão ou quer mais? 😄',
  'Ô sô, que setup bão! 🎮',
  'Bão demais ter você aqui! 💜',
  'Chega mais, tá bão? Clica nos pontinhos!'
];

/* ============================================================
   2. UTILS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const slug = (q) => q.trim().toLowerCase().replace(/\s+/g, '-');

const LOJAS = [
  { id: 'kabum',  nome: 'KaBuM!', url: (q) => `https://www.kabum.com.br/busca/${encodeURIComponent(slug(q))}` },
  { id: 'amazon', nome: 'Amazon', url: (q) => `https://www.amazon.com.br/s?k=${encodeURIComponent(q).replace(/%20/g, '+')}` }
];

const snd = (nome, ...args) => {
  const A = window.GameAudio;
  if (A && typeof A[nome] === 'function') A[nome](...args);
};

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => c != null && el.append(c));
  return el;
}

const S = {
  tour: false, run: 0, itemAtual: null, walkId: 0,
  typeTimer: null, finish: null, wake: null,
  catClicks: 0, catReset: null, catLastStamp: -1,
  gatoVisto: false,
  sentado: false, idleTimer: null, balaoTimer: null, cliquesLuk: 0, falaIdx: 0, saudou: false, sitSprite: false
};
try { S.gatoVisto = localStorage.getItem('setup_gato') === '1'; } catch (_) { /* ignore */ }

// Gato é filtrado do catálogo e só existe como Easter Egg no mini-game
const itensVisiveis = () =>
  Object.entries(SETUP_DATA).filter(([id, it]) => !it.oculto);

/* ============================================================
   3. LUKZIN
   ============================================================ */
const char = () => $('lukChar');

const esperar = (ms) => new Promise((res) => {
  const t = setTimeout(() => { S.wake = null; res(); }, ms);
  S.wake = () => { clearTimeout(t); S.wake = null; res(); };
});

function moverLuk(x, y) {
  const el = char();
  if (!el) return Promise.resolve();
  clearTimeout(S.idleTimer);
  const id = ++S.walkId;
  const cx = parseFloat(el.dataset.x ?? 50);
  const cy = parseFloat(el.dataset.y ?? 88);
  const dist = Math.hypot((x - cx) * 1.6, y - cy);
  const ms = REDUCED ? 0 : Math.round(Math.min(1700, Math.max(550, dist * 26)));

  esconderBalao();
  el.classList.remove('landing', 'looking', 'look-up', 'speaking');
  if (Math.abs(x - cx) > 1) el.dataset.dir = x < cx ? 'left' : 'right';
  el.style.setProperty('--walk-ms', `${ms}ms`);

  let passos = null;
  if (ms) {
    el.classList.add('walking');
    snd('playStep');
    passos = setInterval(() => snd('playStep'), 250);
  }

  el.dataset.x = x; el.dataset.y = y;
  el.style.left = `${x}%`; el.style.top = `${y}%`;

  return new Promise((res) => {
    setTimeout(() => {
      clearInterval(passos);
      if (id === S.walkId) {
        el.classList.remove('walking');
        void el.offsetWidth;
        el.classList.add('landing');
        setTimeout(() => el.classList.remove('landing'), 560);
      }
      res();
    }, ms);
  });
}

async function olharPara(it, dest) {
  const el = char();
  const dx = it.x - dest.x;
  if (Math.abs(dx) > 1.5) el.dataset.dir = dx < 0 ? 'left' : 'right';
  el.classList.toggle('look-up', it.y < dest.y - 25);
  el.classList.add('looking');
  await esperar(REDUCED ? 0 : 650);
}

function setFalando(on) { char().classList.toggle('speaking', on); }

/* ---------- Lukzin sentado na cadeira ---------- */
// Se existir img/lukzin-sentado.png, usa esse sprite; senão corta as pernas via CSS (.sitting)
const spriteSentadoTeste = new Image();
spriteSentadoTeste.onload = () => { S.sitSprite = true; };
spriteSentadoTeste.src = SENTADO_SPRITE;

function aplicarSprite(sentado) {
  const el = char();
  const img = el && el.querySelector('.luk-sprite');
  if (!img) return;
  if (!img.dataset.stand) img.dataset.stand = img.getAttribute('src');
  const usar = sentado && S.sitSprite;
  img.setAttribute('src', usar ? SENTADO_SPRITE : img.dataset.stand);
  el.classList.toggle('has-sit-sprite', usar);
}

function marcarSentado(on) {
  const el = char();
  S.sentado = on;
  el.classList.toggle('sitting', on);
  aplicarSprite(on);
  // o hotspot da cadeira fica escondido enquanto o Lukzin está nela (ele mesmo é clicável)
  if (hotspots.cadeira) hotspots.cadeira.classList.toggle('luk-ocupada', on);
}

async function sentar() {
  const el = char();
  if (!el || S.tour || S.sentado) return;
  const run = S.run;
  await moverLuk(CADEIRA.x, CADEIRA.y);
  if (run !== S.run || S.tour) return;
  marcarSentado(true);
  snd('playPop');
}

async function levantar() {
  if (!S.sentado) return;
  marcarSentado(false);
  snd('playPop');
  await esperar(REDUCED ? 0 : 380);
}

function agendarVoltar(ms = 16000) {
  clearTimeout(S.idleTimer);
  S.idleTimer = setTimeout(() => { if (!S.tour && !S.sentado) sentar(); }, ms);
}

function falaTemporaria(texto, ms = 4200) {
  const el = char();
  mostrarBalao(texto, parseFloat(el.dataset.x ?? CADEIRA.x));
  setFalando(true);
  setTimeout(() => setFalando(false), 900);
  clearTimeout(S.balaoTimer);
  S.balaoTimer = setTimeout(esconderBalao, ms);
}

// Clique no Lukzin (ou no botão 💬): ele pula, solta um bordão e, de vez em quando, oferece a cadeira
function interagir() {
  const el = char();
  if (!el || S.tour || el.classList.contains('walking')) return;
  clearTimeout(S.idleTimer);
  S.cliquesLuk += 1;
  el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
  setTimeout(() => el.classList.remove('hop'), 520);
  snd('playPop');

  if (S.cliquesLuk % 5 === 0) {
    falaTemporaria('Quer ver a minha cadeira? Fica bão demais! 🪑', 1800);
    const n = S.cliquesLuk;
    setTimeout(() => { if (!S.tour && S.cliquesLuk === n) irParaItem('cadeira'); }, 1500);
    return;
  }
  if (S.cliquesLuk % 3 === 0) sparks();
  falaTemporaria(BAO_FALAS[S.falaIdx++ % BAO_FALAS.length]);
  if (!S.sentado) agendarVoltar();
}

function ligarLuk() {
  const flip = char().querySelector('.luk-flip');
  flip.setAttribute('role', 'button');
  flip.setAttribute('tabindex', '0');
  flip.setAttribute('aria-label', 'Conversar com o Lukzin');
  flip.addEventListener('click', (e) => { e.stopPropagation(); interagir(); });
  flip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); interagir(); }
  });
  const btn = $('btnLukFala');
  if (btn) btn.addEventListener('click', interagir);

  // posição inicial: sentadinho na cadeira
  const el = char();
  el.dataset.x = CADEIRA.x; el.dataset.y = CADEIRA.y;
  el.style.left = `${CADEIRA.x}%`; el.style.top = `${CADEIRA.y}%`;
  marcarSentado(true);

  // cumprimenta uma vez, quando o mini-game aparece na tela
  const cena = $('setupScene');
  if (cena && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es.some((x) => x.isIntersecting) || S.saudou) return;
      S.saudou = true; io.disconnect();
      setTimeout(() => { if (!S.tour && S.sentado && !S.itemAtual) falaTemporaria(BAO_GREETING, 5200); }, 800);
    }, { threshold: 0.5 });
    io.observe(cena);
  }
}

function mostrarBalao(texto, x) {
  const b = $('lukBubble');
  b.textContent = texto;
  const shift = x < 22 ? 22 : x > 78 ? 78 : 50;
  b.style.setProperty('--bshift', `-${shift}%`);
  b.style.setProperty('--tail', `${shift}%`);
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}
function esconderBalao() { $('lukBubble').classList.remove('show'); }

function sparks() {
  if (REDUCED) return;
  const el = char();
  const box = $('sceneSparks');
  for (let i = 0; i < 16; i++) {
    const s = h('i', { class: 'spark' });
    const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
    const r = 40 + Math.random() * 50;
    s.style.left = `${el.dataset.x}%`;
    s.style.top = `${parseFloat(el.dataset.y) - 12}%`;
    s.style.setProperty('--dx', `${Math.cos(ang) * r}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * r}px`);
    s.style.setProperty('--hue', `${270 + Math.random() * 70}`);
    box.append(s);
    setTimeout(() => s.remove(), 1200);
  }
}

function foco(x, y) {
  const wrap = $('setupScene');
  if (x == null) { wrap.classList.remove('focus'); return; }
  $('sceneWorld').style.transformOrigin = `${x}% ${y}%`;
  wrap.classList.add('focus');
}

/* ============================================================
   4. DIÁLOGO RPG, TOUR E RECAP
   ============================================================ */
const hotspots = {};

function criarHotspots() {
  const box = $('sceneHotspots');
  Object.entries(SETUP_DATA).filter(([, it]) => !it.oculto).forEach(([id, it]) => {
    const b = h('button', {
      type: 'button', class: 'hotspot', 'data-id': id,
      style: `left:${it.x}%;top:${it.y}%`,
      'aria-label': `Ver ${it.titulo}`,
      onclick: () => irParaItem(id)
    }, h('span', { class: 'hs-pulse' }), h('span', { class: 'hs-label', text: it.titulo }));
    hotspots[id] = b;
    box.append(b);
  });
}

function finishTyping() { if (S.finish) S.finish(); }

function digitar(el, texto) {
  finishTyping();
  return new Promise((res) => {
    if (REDUCED) { el.textContent = texto; return res(); }
    let i = 0;
    setFalando(true);
    el.classList.add('typing');
    const end = () => {
      clearInterval(S.typeTimer);
      el.textContent = texto;
      el.classList.remove('typing');
      setFalando(false);
      S.finish = null;
      res();
    };
    S.finish = end;
    S.typeTimer = setInterval(() => {
      i += 1;
      el.textContent = texto.slice(0, i);
      if (i % 2 === 0 && texto[i - 1] !== ' ') snd('playType');
      if (i >= texto.length) end();
    }, 18);
  });
}

function prepararDialogo(titulo) {
  const d = $('setupDialogue');
  d.classList.remove('closed', 'is-recap', 'enter');
  void d.offsetWidth;
  d.classList.add('enter');

  // Nome fixo limpo: Lukzin + DEV
  const nameContainer = $('dlgNameContainer');
  if (nameContainer) {
    nameContainer.innerHTML = `<span class="rpg-name-main">Lukzin</span> <span class="rpg-badge">DEV</span>`;
  }

  $('dlgChips').replaceChildren();
  $('dlgRecap').replaceChildren();
  $('dlgRecap').hidden = true;
  $('dlgActions').hidden = true;
  $('dlgText').hidden = false;
}

function mostrarChips(it) {
  $('dlgChips').replaceChildren(...it.pecas.map((p, i) =>
    h('span', { class: 'rpg-chip', style: `--i:${i}`, text: p.nome })));
  $('dlgActions').hidden = false;
}

async function visitar(id, run) {
  const it = SETUP_DATA[id];
  const hs = hotspots[id];
  S.itemAtual = id;
  if (S.sentado) {
    await levantar();
    if (run !== S.run) return false;
  }
  if (hs) hs.classList.add('is-target');
  foco(null);

  await moverLuk(it.stand.x, it.stand.y);
  if (hs) hs.classList.remove('is-target');
  if (run !== S.run) return false;

  if (hs) hs.classList.add('is-visited');
  foco(it.x, it.y);

  await olharPara(it, it.stand);
  if (run !== S.run) return false;

  snd(id === 'gato' ? 'playMeow' : 'playPop');
  mostrarBalao(it.fala, it.stand.x);
  prepararDialogo(it.titulo);
  await digitar($('dlgText'), it.texto);
  if (run !== S.run) return false;
  mostrarChips(it);
  if (!S.tour) agendarVoltar(18000);   // fora do tour, depois de um tempo ele volta pra cadeira
  return true;
}

function cancelar() {
  S.run += 1;
  finishTyping();
  if (S.wake) S.wake();
}

async function irParaItem(id) {
  if (!SETUP_DATA[id]) return;
  if (S.tour) pararTour(false);
  cancelar();
  const run = S.run;
  await visitar(id, run);
}

/* ---------- Tour ---------- */
function setTourUI(rodando) {
  const btn = $('btnTourSetup');
  btn.dataset.state = rodando ? 'running' : 'idle';
  btn.querySelector('.btn-tour-label').textContent = rodando ? 'Parar Tour' : 'Iniciar Tour Guiado';
  btn.querySelector('.play-icon').textContent = rodando ? '⏹' : '▶';
  $('setupProgress').classList.toggle('on', rodando);
  $('setupScene').classList.toggle('touring', rodando);
}

function setProgresso(i, total, txt) {
  $('setupProgressTxt').textContent = txt || `${i} / ${total}`;
  $('setupProgressBar').style.width = `${(i / total) * 100}%`;
}

async function iniciarTour() {
  if (S.tour) return;
  cancelar();
  const run = S.run;
  S.tour = true;
  Object.values(hotspots).forEach((b) => b.classList.remove('is-visited'));
  setTourUI(true);
  setProgresso(0, ORDEM_TOUR.length);

  if (S.sentado) {
    falaTemporaria('Bora, que vai ficar bão demais! 🚀', 1600);
    await esperar(REDUCED ? 0 : 500);
    if (run !== S.run) return;
    await levantar();
    if (run !== S.run) return;
  }

  for (let i = 0; i < ORDEM_TOUR.length; i++) {
    setProgresso(i + 1, ORDEM_TOUR.length);
    const ok = await visitar(ORDEM_TOUR[i], run);
    if (!ok || run !== S.run) return;
    await esperar(2400 + SETUP_DATA[ORDEM_TOUR[i]].pecas.length * 300);
    if (run !== S.run) return;
  }
  await recapFinal(run);
}

function pararTour(voltar = true) {
  const rodava = S.tour;
  S.tour = false;
  cancelar();
  setTourUI(false);
  foco(null);
  Object.values(hotspots).forEach((b) => b.classList.remove('is-target'));
  if (rodava && voltar) sentar();
}

/* ---------- Recap final ---------- */
async function recapFinal(run) {
  foco(null);
  await moverLuk(50, 80);
  if (run !== S.run) return;

  sparks();
  snd('playSuccess');
  mostrarBalao('Setup completo, tá bão demais! 💜', 50);
  setProgresso(ORDEM_TOUR.length, ORDEM_TOUR.length, 'Concluído! ✅');
  prepararDialogo('Lukzin · Resumão do Setup');
  $('setupDialogue').classList.add('is-recap');
  await digitar($('dlgText'), 'E aí, curtiu o tour? Ficou bão demais, né? Anota aí tudo que a Soso usa:');
  if (run !== S.run) return;

  const grupos = Object.entries(CATS).map(([key, cat], gi) => {
    const lista = Object.values(SETUP_DATA)
      .filter((it) => it.cat === key && !it.oculto)
      .flatMap((it) => it.pecas.map((p) => p.nome));
    return h('div', { class: 'recap-col', style: `--i:${gi}` },
      h('h4', { text: `${cat.emoji} ${cat.nome}` }),
      h('ul', {}, lista.map((n) => h('li', { text: n }))));
  });
  $('dlgRecap').replaceChildren(...grupos);
  $('dlgRecap').hidden = false;
  $('dlgActions').hidden = true;

  S.tour = false;
  setTourUI(false);
  $('setupProgress').classList.add('on');
  agendarVoltar(25000);
}

/* ============================================================
   5. EASTER EGG DO GATO (exatamente 5 cliques)
   ============================================================ */
function pop(texto) {
  const hot = $('catHotspot');
  const p = h('span', { class: 'cat-pop', text: texto });
  p.style.left = `${parseFloat(hot.style.left) + parseFloat(hot.style.width) / 2}%`;
  p.style.top = `${parseFloat(hot.style.top) + parseFloat(hot.style.height) / 2}%`;
  $('sceneWorld').append(p);
  setTimeout(() => p.remove(), 900);
}

function ligarGato() {
  const hot = $('catHotspot');
  if (!hot || hot.dataset.bound) return;
  hot.dataset.bound = '1';

  hot.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.timeStamp === S.catLastStamp) return;
    S.catLastStamp = e.timeStamp;

    clearTimeout(S.catReset);
    S.catReset = setTimeout(() => { S.catClicks = 0; }, 2500);

    S.catClicks += 1;
    hot.classList.remove('bump'); void hot.offsetWidth; hot.classList.add('bump');

    if (S.catClicks < GATO_CLIQUES) {
      snd('playPop');
      pop(`🐾 ${S.catClicks}/${GATO_CLIQUES}`);
      return;
    }
    S.catClicks = 0;
    clearTimeout(S.catReset);
    S.gatoVisto = true;
    try { localStorage.setItem('setup_gato', '1'); } catch (_) { /* ignore */ }
    // Gato continua sendo um item apenas do mini-game. Ao clicar 5 vezes, chama o diálogo.
    irParaItem('gato');
  });
}

/* ============================================================
   6. CATÁLOGO
   ============================================================ */
const filtro = { cat: 'todos', busca: '' };

function abrirFicha(id) {
  const it = SETUP_DATA[id];
  if (!it) return;
  const dlg = $('itemDialog');
  dlg.className = `item-dialog r-${it.raridade}`;

  const fecharPopovers = () => {
    dlg.querySelectorAll('.loja-popover').forEach((x) => { x.hidden = true; });
    dlg.querySelectorAll('.btn-onde').forEach((x) => {
      x.textContent = '🔍 Onde encontrar';
      x.setAttribute('aria-expanded', 'false');
    });
  };

  const pecas = it.pecas.map((p) => {
    const li = h('li', { class: 'peca' },
      h('div', { class: 'peca-info' },
        h('strong', { text: p.nome }),
        p.detalhe ? h('span', { text: p.detalhe }) : null));
    if (!p.semLoja) {
      const pop = h('div', { class: 'loja-popover', hidden: true },
        LOJAS.map((l) => h('a', { class: `loja-${l.id}`, href: l.url(p.q), target: '_blank', rel: 'noopener noreferrer', text: l.nome })));
      const btn = h('button', { type: 'button', class: 'btn-onde', 'aria-expanded': 'false', text: '🔍 Onde encontrar' });
      btn.addEventListener('click', () => {
        const abrir = pop.hidden;
        fecharPopovers();
        if (abrir) { pop.hidden = false; btn.textContent = '✕ Fechar'; btn.setAttribute('aria-expanded', 'true'); }
      });
      li.append(btn, pop);
    }
    return li;
  });

  dlg.replaceChildren(h('div', { class: 'item-dlg-inner' },
    h('button', { type: 'button', class: 'item-close', 'aria-label': 'Fechar', text: '✕', onclick: () => dlg.close() }),
    h('div', { class: 'item-head' },
      h('div', { class: 'item-emoji', text: it.emoji }),
      h('div', {},
        h('span', { class: 'badge-rar', text: RARIDADE[it.raridade] }),
        h('h3', { id: 'itemDlgTitle', text: it.titulo }),
        h('small', { text: `${CATS[it.cat].emoji} ${CATS[it.cat].nome}` }))),
    h('p', { class: 'item-fala' }, h('b', { text: 'Lukzin: ' }), it.texto),
    h('ul', { class: 'pecas' }, pecas),
    h('div', { class: 'item-foot' },
      h('button', { type: 'button', class: 'btn-mini', text: '🎮 Ver no mini-game',
        onclick: () => { dlg.close(); setView('game'); irParaItem(id); } }))));

  if (!dlg.open) dlg.showModal();
}

function renderCatalogo() {
  const grid = $('catGrid');
  const q = filtro.busca.trim().toLowerCase();
  
  // itensVisiveis já filtra o gato (oculto), então ele não aparece aqui.
  const itens = itensVisiveis().filter(([, it]) => {
    if (filtro.cat !== 'todos' && it.cat !== filtro.cat) return false;
    if (!q) return true;
    return it.titulo.toLowerCase().includes(q) || it.pecas.some((p) => p.nome.toLowerCase().includes(q));
  });

  const cards = itens.map(([id, it], i) => {
    const card = h('button', { type: 'button', class: `cat-card r-${it.raridade}`, style: `--i:${i}`,
      onclick: () => abrirFicha(id) },
      h('span', { class: 'cat-glare' }),
      h('span', { class: 'badge-rar', text: RARIDADE[it.raridade] }),
      h('span', { class: 'cat-emoji', text: it.emoji }),
      h('strong', { text: it.titulo }),
      h('small', { text: it.pecas.length > 1 ? `${it.pecas.length} peças` : (it.pecas[0].detalhe || CATS[it.cat].nome) }),
      h('span', { class: 'cat-cta', text: 'Ver ficha →' }));
    if (!REDUCED) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
        card.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    }
    return card;
  });

  grid.replaceChildren(...(cards.length ? cards : [h('p', { class: 'cat-vazio', text: 'Nada encontrado por aqui 👀' })]));

  const todos = itensVisiveis();
  const nPecas = todos.reduce((s, [, it]) => s + it.pecas.length, 0);
  $('catStats').replaceChildren(
    ...[['Itens', todos.length], ['Peças', nPecas]].map(([l, v]) =>
      h('div', { class: 'stat' }, h('b', { text: String(v) }), h('span', { text: l }))));
}

function criarFiltros() {
  const box = $('catChips');
  const lista = [['todos', '✨ Tudo'], ...Object.entries(CATS).map(([k, c]) => [k, `${c.emoji} ${c.nome}`])];
  box.replaceChildren(...lista.map(([k, label]) =>
    h('button', { type: 'button', class: `chip${k === filtro.cat ? ' on' : ''}`, text: label,
      onclick: (e) => {
        filtro.cat = k;
        box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        renderCatalogo();
      } })));
  $('catSearch').addEventListener('input', (e) => { filtro.busca = e.target.value; renderCatalogo(); });
}

/* ============================================================
   7. INIT
   ============================================================ */
function setView(v) {
  const game = v === 'game';
  if (!game && S.tour) pararTour(false);
  $('viewGame').hidden = !game;
  $('viewCatalog').hidden = game;
  document.querySelector('.setup-tabs').dataset.view = v;
  document.querySelectorAll('.setup-tab').forEach((t) => {
    const on = t.dataset.view === v;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', String(on));
  });
  try { localStorage.setItem('setupView', v); } catch (_) { /* ignore */ }
}

function init() {
  const sec = $('sec-setup');
  if (!sec || sec.dataset.ready) return;
  sec.dataset.ready = '1';

  criarHotspots();
  ligarLuk();
  ligarGato();
  criarFiltros();
  renderCatalogo();

  $('btnTourSetup').addEventListener('click', () => (S.tour ? pararTour() : iniciarTour()));
  $('dlgClose').addEventListener('click', () => {
    finishTyping();
    $('setupDialogue').classList.add('closed');
    esconderBalao();
  });
  $('setupDialogue').addEventListener('click', (e) => { if (!e.target.closest('button')) finishTyping(); });
  $('dlgFicha').addEventListener('click', () => S.itemAtual && abrirFicha(S.itemAtual));

  document.querySelectorAll('.setup-tab').forEach((t) =>
    t.addEventListener('click', () => setView(t.dataset.view)));

  const dlg = $('itemDialog');
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => snd('playClose'));

  sec.addEventListener('click', (e) => {
    const alvo = e.target.closest('button, a');
    if (!alvo || alvo.closest('.hotspot') || alvo.id === 'btnMute') return;
    snd('playClick');
  });

  const btnMute = $('btnMute');
  if (btnMute) {
    const A = window.GameAudio;
    btnMute.textContent = A && A.isMuted() ? '🔇' : '🔊';
    btnMute.addEventListener('click', () => {
      if (!A) return;
      const mudo = A.toggleMute();
      btnMute.textContent = mudo ? '🔇' : '🔊';
      if (!mudo) A.playPop();
    });
  }

  let salvo = 'game';
  try { salvo = localStorage.getItem('setupView') || 'game'; } catch (_) { /* ignore */ }
  setView(salvo === 'catalog' ? 'catalog' : 'game');
}

window.iniciarTour = iniciarTour;
window.pararTour = pararTour;
window.irParaItem = irParaItem;
window.lukInteragir = interagir;
// Ajuste fino no console: lukSentado({ drop: '45%' })  → quanto das pernas fica escondido
//                          lukSentado({ x: 62.3, y: 78.7 }) → ponto da cadeira
window.lukSentado = (cfg = {}) => {
  const el = char();
  if (cfg.drop) el.style.setProperty('--sit-drop', cfg.drop);
  if (cfg.x != null) CADEIRA.x = cfg.x;
  if (cfg.y != null) CADEIRA.y = cfg.y;
  if (S.sentado) {
    el.dataset.x = CADEIRA.x; el.dataset.y = CADEIRA.y;
    el.style.left = `${CADEIRA.x}%`; el.style.top = `${CADEIRA.y}%`;
  }
  return { ...CADEIRA, drop: getComputedStyle(el).getPropertyValue('--sit-drop').trim() };
};
window.SETUP_DATA = SETUP_DATA;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();