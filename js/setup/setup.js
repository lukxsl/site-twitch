/* ============================================================
   SETUP — MINI-GAME 2D + CATÁLOGO (TOUR DO LUKZIN)
   Estrutura:
   1. DADOS        → SETUP_DATA (peças, textos, coordenadas, preços, notas)
   2. UTILS        → helpers de DOM, formatação, links de loja
   3. LUKZIN       → movimento, balão, fala, sparks
   4. DIÁLOGO/TOUR → diálogo RPG, tour guiado e recap final
   5. CATÁLOGO     → grid de cards, filtros e ficha (modal)
   6. INIT         → liga tudo
   ============================================================ */
(() => {
'use strict';

/* ============================================================
   1. DADOS
   ------------------------------------------------------------
   Cada peça (pecas[]) aceita campos opcionais:
     preco:  número em reais (ex.: 1899.9)  → mostra "R$ 1.899,90"
     precoEm:'2026-10-28'                   → data da consulta
     nota:   0–5 (ex.: 4.7)                 → mostra estrelas
     avals:  nº de avaliações (ex.: 1250)
     fonte:  'Amazon' | 'KaBuM!' ...        → de onde veio a nota
     q:      termo de busca usado nos links das lojas
   Sem preco/nota, o card mostra "Consultar preço" e "Ver avaliações"
   com link para a busca da loja (sempre atualizado).
   ============================================================ */
const P = (nome, q, detalhe = '', extra = {}) => ({ nome, q, detalhe, ...extra });

const CATS = {
  pc:         { nome: 'PC',               emoji: '🚀' },
  perifericos:{ nome: 'Periféricos',      emoji: '🖱️' },
  conforto:   { nome: 'Conforto & Vibe',  emoji: '🐰' },
  colecao:    { nome: 'Coleção',          emoji: '🏆' }
};

const SETUP_DATA = {
  gabinete: {
    titulo: 'Gabinete Risemode Aquarium', emoji: '🚀', cat: 'pc', raridade: 'lendario',
    x: 78, y: 50,
    fala: 'O coração da máquina! 🚀',
    texto: 'Chegamos no cérebro da operação! Aqui dentro roda um Ryzen 9 5900X com 12 núcleos, 48GB de RAM, placa-mãe X570 TUF e uma RTX 3060 de 12GB branquinha, tudo refrigerado por um water cooler com RGB e enfeitado pelo vidro do Aquarium. Pode abrir 50 abas e a Soso ainda joga numa boa.',
    pecas: [
      P('Processador AMD Ryzen 9 5900X', 'Ryzen 9 5900X', '12 núcleos / 24 threads'),
      P('48GB de memória RAM', 'memoria RAM DDR4 48GB', 'Folga de sobra pra live + jogo + navegador'),
      P('Placa-mãe X570 TUF', 'placa mae X570 TUF Gaming', 'Chipset X570, PCIe 4.0'),
      P('RTX 3060 12GB Branca', 'RTX 3060 12GB branca', '12GB de VRAM, combina com o setup'),
      P('Water Cooler Risemode Aura RGB', 'Water Cooler Risemode Aura RGB', 'Refrigeração líquida com RGB'),
      P('SSD NVMe 2TB', 'SSD NVMe 2TB', 'Jogos carregando voando'),
      P('Fonte Corsair RM800W', 'Fonte Corsair RM800', '800W modular'),
      P('Gabinete Risemode Aquarium Branco', 'Gabinete Risemode Aquarium branco', 'Vidro temperado dos dois lados')
    ]
  },
  monitor: {
    titulo: 'Monitor AOC 240Hz', emoji: '🖥️', cat: 'perifericos', raridade: 'epico',
    x: 50, y: 48,
    fala: 'Aqui a mágica acontece! ✨',
    texto: 'Esse é o palco principal! Um monitor AOC de 240Hz deixa tudo absurdamente fluido, e olha só: a Soso está plantando coisa no Stardew Valley agora. Quem disse que setup gamer não pode ser fazendeiro?',
    pecas: [ P('Monitor AOC 240Hz', 'monitor AOC 240Hz gamer', '240Hz, imagem lisinha em qualquer jogo') ]
  },
  webcam: {
    titulo: 'Webcam iPhone 11', emoji: '📱', cat: 'perifericos', raridade: 'raro',
    x: 50, y: 35,
    fala: 'Olha o passarinho! 📸',
    texto: 'Plot twist: a webcam é um iPhone 11! A câmera dele entrega uma qualidade que muita webcam cara não alcança, e é por isso que a live aparece nítida mesmo com a iluminação neon do quarto.',
    pecas: [ P('iPhone 11 (usado como webcam)', 'iPhone 11', 'Câmera de celular trabalhando como webcam') ]
  },
  teclado: {
    titulo: 'Logitech G PRO X TKL', emoji: '⌨️', cat: 'perifericos', raridade: 'epico',
    x: 45, y: 63,
    fala: 'Tec tec tec! ⌨️',
    texto: 'O teclado é um Logitech G PRO X TKL branco: formato compacto (sem o numérico), que deixa um espaço enorme pro mouse, e é sem fio. Perfeito pra quem joga de verdade e ainda quer a mesa organizada.',
    pecas: [ P('Teclado Logitech G PRO X TKL Branco', 'Logitech G PRO X TKL branco', 'Formato TKL, sem fio, switches trocáveis') ]
  },
  mouse: {
    titulo: 'Logitech G502X Superlight', emoji: '🖱️', cat: 'perifericos', raridade: 'epico',
    x: 57, y: 63,
    fala: 'Leve e preciso! 🎯',
    texto: 'Esse é o Logitech G502X Superlight com RGB. Leve como uma pena e preciso como um laser, ele é o parceiro de qualquer clutch e deixa a mesa com cara de nave espacial.',
    pecas: [ P('Mouse Logitech G502X Superlight RGB', 'Logitech G502 X', 'Leve, sensor preciso, RGB') ]
  },
  headset: {
    titulo: 'Headset Astro A30', emoji: '🎧', cat: 'perifericos', raridade: 'epico',
    x: 65, y: 53,
    fala: 'Som de cinema! 🎧',
    texto: 'O Astro A30 é o ouvido da Soso: sem fio, confortável pra lives longas e com um som que deixa ouvir o passo do inimigo, a trilha do jogo e o chat sem brigar um com o outro.',
    pecas: [ P('Headset Astro A30', 'Astro A30', 'Sem fio, pensado pra sessões longas') ]
  },
  microfone: {
    titulo: 'Microfone FIFINE AM8', emoji: '🎙️', cat: 'perifericos', raridade: 'raro',
    x: 35, y: 53,
    fala: 'A voz da Soso! 🎙️',
    texto: 'Aqui nasce a voz que você ouve nas lives! O FIFINE AM8 branco é um microfone dinâmico que capta bem a voz e ignora boa parte do barulho do quarto. Ótimo pra risadas e também pros gritos de susto.',
    pecas: [ P('Microfone FIFINE AM8 Branco', 'FIFINE AM8 branco', 'Dinâmico, USB e XLR') ]
  },
  garrafa: {
    titulo: 'Garrafa Stanley Branca', emoji: '🥤', cat: 'conforto', raridade: 'raro',
    x: 32, y: 59,
    fala: 'Hidratação em dia! 💧',
    texto: 'A famosa Stanley branca! Água gelada por perto garante energia pras lives compridas, e ela ainda combina com o resto do setup. Esse sim é um item de suporte.',
    pecas: [ P('Garrafa Stanley Branca', 'Stanley copo termico branco', 'Mantém a bebida gelada por horas') ]
  },
  cadeira: {
    titulo: 'Cadeira XT Racer', emoji: '🪑', cat: 'conforto', raridade: 'raro',
    x: 58, y: 78,
    fala: 'O trono da Soso! 👑',
    texto: 'A base de tudo é a cadeira XT Racer. Confortável o bastante pra aguentar aquelas lives de várias horas sem reclamar das costas, e com visual de assento de piloto.',
    pecas: [ P('Cadeira Gamer XT Racer', 'cadeira gamer XT Racer', 'Conforto pra lives longas') ]
  },
  pantufas: {
    titulo: 'Pantufas de Coelho Roxas', emoji: '🐰', cat: 'conforto', raridade: 'epico',
    x: 28, y: 85,
    fala: 'O item mais importante! 🐰',
    texto: 'Atenção: esse é o item MAIS importante do setup! As pantufas de coelho roxas garantem conforto máximo pros pés e carisma máximo pro quarto. Sem elas, a performance cai pela metade (cientificamente comprovado por mim).',
    pecas: [ P('Pantufas de Coelho Roxas', 'pantufa coelho roxa', 'Fofura nível máximo') ]
  },
  estante: {
    titulo: 'Estante de Zerados', emoji: '🏆', cat: 'colecao', raridade: 'lendario',
    x: 17, y: 45,
    fala: 'O hall da fama! 🏆',
    texto: 'O hall da fama dos jogos zerados! Cada boneco aqui é uma memória: o chapéu do Red Dead Redemption 2, a pulseira do Detroit, o Homem-Aranha e a Clove do Valorant. Só jogo que marcou história entra nessa prateleira.',
    pecas: [
      P('Chapéu do Red Dead Redemption 2', 'chapeu Red Dead Redemption 2 colecionavel', 'Arthur Morgan vibes'),
      P('Pulseira do Detroit: Become Human', 'pulseira Detroit Become Human', 'Direto de Detroit'),
      P('Boneco Homem-Aranha', 'boneco Homem-Aranha colecionavel', 'Amigo da vizinhança'),
      P('Boneca Clove (Valorant)', 'Clove Valorant colecionavel', 'Agente do Valorant')
    ]
  },
  quadro: {
    titulo: 'Quadro do Gatinho', emoji: '🐱', cat: 'conforto', raridade: 'raro',
    x: 47, y: 22,
    fala: 'Miau! 🐱',
    texto: 'A Soso ama gatos, então não podia faltar esse quadro fofo no meio da parede! Ele deixa o cantinho com aquela energia aconchegante, e toda live precisa de um gatinho vigiando.',
    pecas: [ P('Quadro do Gatinho', '', 'Decoração com muito amor', { semLoja: true }) ]
  }
};

const ORDEM_TOUR = ['gabinete', 'monitor', 'webcam', 'teclado', 'mouse', 'headset',
                    'microfone', 'garrafa', 'estante', 'quadro', 'pantufas', 'cadeira'];

const RARIDADE = { lendario: 'Lendário', epico: 'Épico', raro: 'Raro' };

/* ============================================================
   2. UTILS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const slug = (q) => q.trim().toLowerCase().replace(/\s+/g, '-');

const LOJAS = [
  { id: 'kabum',  nome: 'KaBuM!', url: (q) => `https://www.kabum.com.br/busca/${encodeURIComponent(slug(q))}` },
  { id: 'amazon', nome: 'Amazon', url: (q) => `https://www.amazon.com.br/s?k=${encodeURIComponent(q)}` }
];

function estrelas(nota) {
  const n = Math.round(nota);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function dataBR(iso) {
  const [a, m, d] = String(iso).split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

const posicaoParado = (it) => ({ x: it.x, y: Math.min(it.y + 8, 94) });

const S = {
  tour: false, run: 0, itemAtual: null,
  typeTimer: null, finish: null, wake: null, bubbleTimer: null
};

/* ============================================================
   3. LUKZIN — movimento, balão, fala, sparks
   ============================================================ */
const char = () => $('lukChar');
const esperar = (ms) => new Promise((res) => {
  const t = setTimeout(() => { S.wake = null; res(); }, ms);
  S.wake = () => { clearTimeout(t); S.wake = null; res(); };
});

function moverLuk(x, y) {
  const el = char();
  if (!el) return Promise.resolve();
  const cx = parseFloat(el.dataset.x ?? 50);
  const cy = parseFloat(el.dataset.y ?? 88);
  const dist = Math.hypot((x - cx) * 1.6, y - cy);
  const ms = REDUCED ? 0 : Math.round(Math.min(1900, Math.max(600, dist * 30)));

  esconderBalao();
  if (Math.abs(x - cx) > 1) el.dataset.dir = x < cx ? 'left' : 'right';

  el.style.setProperty('--walk-ms', `${ms}ms`);
  el.classList.remove('landing');
  if (ms) el.classList.add('walking');
  el.dataset.x = x;
  el.dataset.y = y;
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;

  return new Promise((res) => {
    setTimeout(() => {
      el.classList.remove('walking');
      void el.offsetWidth;            // reinicia a animação de aterrissagem
      el.classList.add('landing');
      setTimeout(() => el.classList.remove('landing'), 560);
      res();
    }, ms);
  });
}

function mostrarBalao(texto, x) {
  const b = $('lukBubble');
  clearTimeout(S.bubbleTimer);
  b.textContent = texto;
  // evita o balão sair da cena nas bordas
  const shift = x < 22 ? 22 : x > 78 ? 78 : 50;
  b.style.setProperty('--bshift', `-${shift}%`);
  b.style.setProperty('--tail', `${shift}%`);
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

function esconderBalao() {
  $('lukBubble').classList.remove('show');
}

function setFalando(on) { char().classList.toggle('speaking', on); }

function sparks() {
  if (REDUCED) return;
  const el = char();
  const box = $('sceneSparks');
  for (let i = 0; i < 16; i++) {
    const s = h('i', { class: 'spark' });
    const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
    const r = 40 + Math.random() * 50;
    s.style.left = `${el.dataset.x}%`;
    s.style.top = `${parseFloat(el.dataset.y) - 8}%`;
    s.style.setProperty('--dx', `${Math.cos(ang) * r}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * r}px`);
    s.style.setProperty('--hue', `${270 + Math.random() * 70}`);
    box.append(s);
    setTimeout(() => s.remove(), 1200);
  }
}

/* "Câmera": dá um leve zoom na cena em direção ao personagem */
function foco(x, y) {
  const wrap = $('setupScene');
  const world = $('sceneWorld');
  if (x == null) { wrap.classList.remove('focus'); return; }
  world.style.transformOrigin = `${x}% ${y}%`;
  wrap.classList.add('focus');
}

/* ============================================================
   4. DIÁLOGO RPG, TOUR E RECAP
   ============================================================ */
const hotspots = {};

function criarHotspots() {
  const box = $('sceneHotspots');
  Object.entries(SETUP_DATA).forEach(([id, it]) => {
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
      if (i >= texto.length) end();
    }, 18);
  });
}

function prepararDialogo(nome) {
  $('setupDialogue').classList.remove('closed');
  $('setupDialogue').classList.remove('is-recap');
  $('dlgName').textContent = nome;
  $('dlgChips').replaceChildren();
  $('dlgRecap').replaceChildren();
  $('dlgRecap').hidden = true;
  $('dlgActions').hidden = true;
  $('dlgText').hidden = false;
}

function mostrarChips(it) {
  const box = $('dlgChips');
  box.replaceChildren(...it.pecas.map((p, i) =>
    h('span', { class: 'rpg-chip', style: `--i:${i}`, text: p.nome })));
  $('dlgActions').hidden = false;
}

async function visitar(id, run) {
  const it = SETUP_DATA[id];
  const hs = hotspots[id];
  S.itemAtual = id;
  hs.classList.add('is-target');
  foco(null);
  const dest = posicaoParado(it);
  await moverLuk(dest.x, dest.y);
  hs.classList.remove('is-target');
  if (run !== S.run) return false;

  hs.classList.add('is-visited');
  foco(it.x, it.y);
  mostrarBalao(it.fala, dest.x);
  prepararDialogo(it.titulo);
  await digitar($('dlgText'), it.texto);
  if (run !== S.run) return false;
  mostrarChips(it);
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
  $('setupProgress').hidden = !rodando;
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
  if (rodava && voltar) {
    esconderBalao();
    moverLuk(50, 88);
  }
}

/* ---------- Recap final ---------- */
async function recapFinal(run) {
  foco(null);
  await moverLuk(50, 62);
  if (run !== S.run) return;

  sparks();
  mostrarBalao('Setup completo! 💜', 50);
  setProgresso(ORDEM_TOUR.length, ORDEM_TOUR.length, 'Concluído! ✅');
  prepararDialogo('Lukzin · Resumão do Setup');
  $('setupDialogue').classList.add('is-recap');
  await digitar($('dlgText'), 'E aí, curtiu o tour? Anota aí tudo que a Soso usa:');
  if (run !== S.run) return;

  const grupos = Object.entries(CATS).map(([key, cat], gi) => {
    const lista = Object.entries(SETUP_DATA)
      .filter(([, it]) => it.cat === key)
      .flatMap(([, it]) => it.pecas.map((p) => p.nome));
    return h('div', { class: 'recap-col', style: `--i:${gi}` },
      h('h4', { text: `${cat.emoji} ${cat.nome}` }),
      h('ul', {}, lista.map((n) => h('li', { text: n }))));
  });
  const recap = $('dlgRecap');
  recap.replaceChildren(...grupos);
  recap.hidden = false;
  $('dlgActions').hidden = true;

  S.tour = false;
  setTourUI(false);
  $('setupProgress').hidden = false;
}

/* ============================================================
   5. CATÁLOGO
   ============================================================ */
const filtro = { cat: 'todos', busca: '' };

function blocoPreco(p) {
  if (typeof p.preco === 'number') {
    return h('div', { class: 'preco' },
      h('b', { text: BRL.format(p.preco) }),
      p.precoEm ? h('small', { text: `em ${dataBR(p.precoEm)}` }) : null);
  }
  return h('div', { class: 'preco vazio' }, h('b', { text: 'Consultar preço' }));
}

function blocoNota(p) {
  if (typeof p.nota === 'number') {
    const mais = [p.avals ? `${p.avals.toLocaleString('pt-BR')} avaliações` : null, p.fonte].filter(Boolean).join(' · ');
    return h('div', { class: 'nota' },
      h('span', { class: 'stars', 'aria-label': `Nota ${p.nota} de 5`, text: estrelas(p.nota) }),
      h('b', { text: p.nota.toFixed(1).replace('.', ',') }),
      mais ? h('small', { text: mais }) : null);
  }
  if (p.semLoja) return null;
  return h('div', { class: 'nota vazio' },
    h('a', { href: LOJAS[1].url(p.q), target: '_blank', rel: 'noopener noreferrer', text: '★ Ver avaliações da galera' }));
}

function botoesLoja(p) {
  if (p.semLoja) return null;
  return h('div', { class: 'lojas' }, LOJAS.map((l) =>
    h('a', { class: `loja loja-${l.id}`, href: l.url(p.q), target: '_blank', rel: 'noopener noreferrer', text: `Ver na ${l.nome}` })));
}

function abrirFicha(id) {
  const it = SETUP_DATA[id];
  if (!it) return;
  const dlg = $('itemDialog');
  dlg.className = `item-dialog r-${it.raridade}`;

  const pecas = it.pecas.map((p) => h('li', { class: 'peca' },
    h('div', { class: 'peca-info' },
      h('strong', { text: p.nome }),
      p.detalhe ? h('span', { text: p.detalhe }) : null),
    h('div', { class: 'peca-meta' }, blocoPreco(p), blocoNota(p)),
    botoesLoja(p)));

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
  const itens = Object.entries(SETUP_DATA).filter(([, it]) => {
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
      h('small', { text: it.pecas.length > 1 ? `${it.pecas.length} peças` : it.pecas[0].detalhe || CATS[it.cat].nome }),
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

  // estatísticas
  const todas = Object.values(SETUP_DATA).flatMap((it) => it.pecas);
  const comPreco = todas.filter((p) => typeof p.preco === 'number');
  const stats = [
    ['Itens', Object.keys(SETUP_DATA).length],
    ['Peças', todas.length]
  ];
  if (comPreco.length) {
    stats.push(['Total estimado', BRL.format(comPreco.reduce((s, p) => s + p.preco, 0))]);
  }
  $('catStats').replaceChildren(...stats.map(([l, v]) =>
    h('div', { class: 'stat' }, h('b', { text: String(v) }), h('span', { text: l }))));
}

function criarFiltros() {
  const box = $('catChips');
  const itens = [['todos', '✨ Tudo'], ...Object.entries(CATS).map(([k, c]) => [k, `${c.emoji} ${c.nome}`])];
  box.replaceChildren(...itens.map(([k, label]) =>
    h('button', { type: 'button', class: `chip${k === filtro.cat ? ' on' : ''}`, 'data-cat': k, text: label,
      onclick: (e) => {
        filtro.cat = k;
        box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        renderCatalogo();
      } })));
  $('catSearch').addEventListener('input', (e) => { filtro.busca = e.target.value; renderCatalogo(); });
}

/* ============================================================
   6. INIT
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
  if (!$('sec-setup')) return;
  criarHotspots();
  criarFiltros();
  renderCatalogo();

  $('btnTourSetup').addEventListener('click', () => (S.tour ? pararTour() : iniciarTour()));
  $('dlgClose').addEventListener('click', () => { finishTyping(); $('setupDialogue').classList.add('closed'); esconderBalao(); });
  $('setupDialogue').addEventListener('click', (e) => { if (!e.target.closest('button')) finishTyping(); });
  $('dlgFicha').addEventListener('click', () => S.itemAtual && abrirFicha(S.itemAtual));

  document.querySelectorAll('.setup-tab').forEach((t) =>
    t.addEventListener('click', () => setView(t.dataset.view)));

  const dlg = $('itemDialog');
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  let salvo = 'game';
  try { salvo = localStorage.getItem('setupView') || 'game'; } catch (_) { /* ignore */ }
  setView(salvo === 'catalog' ? 'catalog' : 'game');
}

// Compatibilidade com chamadas antigas (onclick inline)
window.iniciarTour = iniciarTour;
window.pararTour = pararTour;
window.irParaItem = irParaItem;
window.SETUP_DATA = SETUP_DATA;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();