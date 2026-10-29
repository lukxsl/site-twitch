/* ============================================================
   SETUP — MINI-GAME 2D + CATÁLOGO (TOUR DO LUKZIN)
   ============================================================ */
(() => {
'use strict';

const P = (nome, q, detalhe = '', extra = {}) => ({ nome, q, detalhe, ...extra });
const CATS = {
  pc:         { nome: 'PC',               emoji: '🚀' },
  perifericos:{ nome: 'Periféricos',      emoji: '🖱️' },
  conforto:   { nome: 'Conforto & Vibe',  emoji: '🐰' },
  colecao:    { nome: 'Coleção',          emoji: '🏆' }
};

// Termos de busca ultra específicos para achar o produto exato na Amazon/KaBuM
const SETUP_DATA = {
  gabinete: {
    titulo: 'Gabinete Risemode Aquarium', emoji: '🚀', cat: 'pc', raridade: 'lendario',
    x: 78, y: 50, fala: 'O coração da máquina! 🚀',
    texto: 'Chegamos no cérebro da operação! Aqui dentro roda um Ryzen 9 5900X com 12 núcleos, 48GB de RAM, placa-mãe X570 TUF e uma RTX 3060 de 12GB branquinha, tudo refrigerado por um water cooler com RGB e enfeitado pelo vidro do Aquarium. Pode abrir 50 abas e a Soso ainda joga numa boa.',
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
    x: 50, y: 48, fala: 'Aqui a mágica acontece! ✨',
    texto: 'Esse é o palco principal! Um monitor AOC de 240Hz deixa tudo absurdamente fluido, e olha só: a Soso está plantando coisa no Stardew Valley agora.',
    pecas: [ P('Monitor Gamer AOC 240Hz', 'monitor gamer aoc 240hz 1ms', '240Hz, imagem lisinha') ]
  },
  teclado: {
    titulo: 'Logitech G PRO X TKL', emoji: '⌨️', cat: 'perifericos', raridade: 'epico',
    x: 45, y: 63, fala: 'Tec tec tec! ⌨️',
    texto: 'O teclado é um Logitech G PRO X TKL branco: formato compacto, sem fio. Perfeito pra quem joga de verdade e ainda quer a mesa organizada.',
    pecas: [ P('Teclado Logitech G PRO X TKL Branco', 'teclado logitech g pro x tkl branco', 'TKL, sem fio') ]
  },
  mouse: {
    titulo: 'Logitech G502X Superlight', emoji: '🖱️', cat: 'perifericos', raridade: 'epico',
    x: 57, y: 63, fala: 'Leve e preciso! 🎯',
    texto: 'Esse é o Logitech G502X Superlight com RGB. Leve como uma pena e preciso como um laser.',
    pecas: [ P('Mouse Logitech G502X Superlight', 'mouse logitech g502x plus superlight', 'Leve, sensor preciso') ]
  },
  headset: {
    titulo: 'Headset Astro A30', emoji: '🎧', cat: 'perifericos', raridade: 'epico',
    x: 65, y: 53, fala: 'Som de cinema! 🎧',
    texto: 'O Astro A30 é o ouvido da Soso: sem fio, confortável pra lives longas.',
    pecas: [ P('Headset Astro A30', 'headset astro a30', 'Sem fio, confortável') ]
  },
  microfone: {
    titulo: 'Microfone FIFINE AM8', emoji: '🎙️', cat: 'perifericos', raridade: 'raro',
    x: 35, y: 53, fala: 'A voz da Soso! 🎙️',
    texto: 'O FIFINE AM8 branco é um microfone dinâmico que capta bem a voz e ignora o barulho do quarto.',
    pecas: [ P('Microfone FIFINE AM8 Branco', 'microfone fifine am8 branco', 'Dinâmico, USB e XLR') ]
  },
  cadeira: {
    titulo: 'Cadeira XT Racer', emoji: '🪑', cat: 'conforto', raridade: 'raro',
    x: 58, y: 78, fala: 'O trono da Soso! 👑',
    texto: 'A base de tudo é a cadeira XT Racer. Confortável o bastante pra aguentar aquelas lives de várias horas.',
    pecas: [ P('Cadeira Gamer XT Racer', 'cadeira gamer xt racer', 'Conforto pra lives longas') ]
  },
  gato: {
    titulo: 'Gatinho Misterioso', emoji: '🐱', cat: 'conforto', raridade: 'lendario',
    x: 47, y: 30, fala: 'Miau! 🐱',
    texto: 'Você encontrou o segredo! O gatinho do quadro é o verdadeiro chefe do setup. Ele só aparece pra quem clica muito.',
    pecas: [ P('Quadro do Gatinho', '', 'Easter Egg') ]
  }
};

const ORDEM_TOUR = ['gabinete', 'monitor', 'teclado', 'mouse', 'headset', 'microfone', 'cadeira'];
const RARIDADE = { lendario: 'Lendário', epico: 'Épico', raro: 'Raro' };

const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const slug = (q) => q.trim().toLowerCase().replace(/\s+/g, '-');

const LOJAS = [
  { id: 'kabum',  nome: 'KaBuM!', url: (q) => `https://www.kabum.com.br/busca/${encodeURIComponent(slug(q))}` },
  { id: 'amazon', nome: 'Amazon', url: (q) => `https://www.amazon.com.br/s?k=${encodeURIComponent(q).replace(/%20/g, '+')}` }
];

const S = { tour: false, run: 0, itemAtual: null, typeTimer: null, finish: null, wake: null, bubbleTimer: null, catClicks: 0 };

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
  const ms = REDUCED ? 0 : Math.round(Math.min(1500, Math.max(500, dist * 25)));

  esconderBalao();
  if (Math.abs(x - cx) > 1) el.dataset.dir = x < cx ? 'left' : 'right';

  el.style.setProperty('--walk-ms', `${ms}ms`);
  el.classList.remove('landing');
  if (ms) {
    el.classList.add('walking');
    if (window.GameAudio) {
       const stepInterval = setInterval(() => {
          if (!el.classList.contains('walking')) clearInterval(stepInterval);
          else window.GameAudio.playStep();
       }, 200);
    }
  }
  
  el.dataset.x = x; el.dataset.y = y;
  el.style.left = `${x}%`; el.style.top = `${y}%`;

  return new Promise((res) => {
    setTimeout(() => {
      el.classList.remove('walking');
      res();
    }, ms);
  });
}

function mostrarBalao(texto, x) {
  const b = $('lukBubble');
  clearTimeout(S.bubbleTimer);
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
    const s = document.createElement('i');
    s.className = 'spark';
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

function foco(x, y) {
  const wrap = $('setupScene'), world = $('sceneWorld');
  if (x == null) { wrap.classList.remove('focus'); return; }
  world.style.transformOrigin = `${x}% ${y}%`;
  wrap.classList.add('focus');
}

/* HOTSPOTS */
const hotspots = {};
function criarHotspots() {
  const box = $('sceneHotspots');
  const itensVisiveis = Object.keys(SETUP_DATA).filter(k => k !== 'gato');
  
  itensVisiveis.forEach((id) => {
    const it = SETUP_DATA[id];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hotspot'; b.dataset.id = id;
    b.style.cssText = `left:${it.x}%;top:${it.y}%`;
    b.setAttribute('aria-label', `Ver ${it.titulo}`);
    b.innerHTML = `<span class="hs-pulse"></span><span class="hs-label">${it.titulo}</span>`;
    b.onclick = () => irParaItem(id);
    hotspots[id] = b;
    box.append(b);
  });

  // Lógica do Easter Egg do Gato (5 cliques)
  const catHotspot = $('catHotspot');
  if (catHotspot) {
    catHotspot.addEventListener('click', () => {
      S.catClicks++;
      if (window.GameAudio) window.GameAudio.playPop();
      if (S.catClicks >= 5) {
        S.catClicks = 0;
        irParaItem('gato');
      }
    });
  }
}

function finishTyping() { if (S.finish) S.finish(); }

function digitar(el, texto) {
  finishTyping();
  return new Promise((res) => {
    if (REDUCED) { el.textContent = texto; return res(); }
    let i = 0;
    el.classList.add('typing');
    const end = () => {
      clearInterval(S.typeTimer);
      el.textContent = texto;
      el.classList.remove('typing');
      S.finish = null;
      res();
    };
    S.finish = end;
    S.typeTimer = setInterval(() => {
      i += 1;
      el.textContent = texto.slice(0, i);
      if (i % 3 === 0 && window.GameAudio) window.GameAudio.playType();
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
  box.replaceChildren(...it.pecas.map((p, i) => {
    const c = document.createElement('span');
    c.className = 'rpg-chip'; c.style.setProperty('--i', i); c.textContent = p.nome;
    return c;
  }));
  $('dlgActions').hidden = false;
}

async function visitar(id, run) {
  const it = SETUP_DATA[id];
  S.itemAtual = id;
  if (hotspots[id]) hotspots[id].classList.add('is-target');
  
  const dest = { x: it.x, y: Math.min(it.y + 8, 94) };
  await moverLuk(dest.x, dest.y);
  
  if (hotspots[id]) hotspots[id].classList.remove('is-target');
  if (run !== S.run) return false;

  if (hotspots[id]) hotspots[id].classList.add('is-visited');
  
  if (id === 'gato' && window.GameAudio) window.GameAudio.playMeow();
  else if (window.GameAudio) window.GameAudio.playPop();

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

/* TOUR */
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
  if (window.GameAudio) window.GameAudio.init();
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
      .filter(([, it]) => it.cat === key && key !== 'colecao')
      .flatMap(([, it]) => it.pecas.map((p) => p.nome));
    const d = document.createElement('div');
    d.className = 'recap-col'; d.style.setProperty('--i', gi);
    d.innerHTML = `<h4>${cat.emoji} ${cat.nome}</h4>`;
    const ul = document.createElement('ul');
    lista.forEach(n => { const li = document.createElement('li'); li.textContent = n; ul.append(li); });
    d.append(ul);
    return d;
  });
  const recap = $('dlgRecap');
  recap.replaceChildren(...grupos);
  recap.hidden = false;
  $('dlgActions').hidden = true;

  S.tour = false;
  setTourUI(false);
  $('setupProgress').hidden = false;
}

/* CATÁLOGO */
const filtro = { cat: 'todos', busca: '' };

function abrirFicha(id) {
  const it = SETUP_DATA[id];
  if (!it) return;
  const dlg = $('itemDialog');
  dlg.className = `item-dialog r-${it.raridade}`;

  const pecas = it.pecas.map((p) => {
    const li = document.createElement('li');
    li.className = 'peca';
    
    const info = document.createElement('div');
    info.className = 'peca-info';
    info.innerHTML = `<strong>${p.nome}</strong>${p.detalhe ? `<span>${p.detalhe}</span>` : ''}`;
    
    let btnOnde = null;
    let popover = null;
    
    if (!p.semLoja) {
      btnOnde = document.createElement('button');
      btnOnde.className = 'btn-onde';
      btnOnde.innerHTML = '🔍 Onde encontrar';
      
      popover = document.createElement('div');
      popover.className = 'loja-popover';
      popover.style.display = 'none';
      
      LOJAS.forEach(l => {
        const a = document.createElement('a');
        a.className = `loja-${l.id}`;
        a.href = l.url(p.q); a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = l.nome;
        popover.append(a);
      });

      btnOnde.onclick = () => {
        const isOpen = popover.style.display !== 'none';
        dlg.querySelectorAll('.loja-popover').forEach(x => x.style.display = 'none');
        dlg.querySelectorAll('.btn-onde').forEach(x => x.innerHTML = '🔍 Onde encontrar');
        
        if (!isOpen) {
          popover.style.display = 'flex';
          btnOnde.innerHTML = '✕ Fechar';
        }
      };
    }

    li.append(info);
    if (btnOnde) li.append(btnOnde);
    if (popover) li.append(popover);
    
    return li;
  });

  dlg.replaceChildren(
    Object.assign(document.createElement('div'), {
      className: 'item-dlg-inner',
      innerHTML: `
        <button type="button" class="item-close" aria-label="Fechar" onclick="this.closest('dialog').close()">✕</button>
        <div class="item-head">
          <div class="item-emoji">${it.emoji}</div>
          <div>
            <span class="badge-rar">${RARIDADE[it.raridade]}</span>
            <h3 id="itemDlgTitle">${it.titulo}</h3>
            <small>${CATS[it.cat].emoji} ${CATS[it.cat].nome}</small>
          </div>
        </div>
        <p class="item-fala"><b>Lukzin: </b>${it.texto}</p>
      `
    })
  );
  
  const ul = document.createElement('ul');
  ul.className = 'pecas';
  pecas.forEach(li => ul.append(li));
  
  const footer = document.createElement('div');
  footer.className = 'item-foot';
  const btnJogar = document.createElement('button');
  btnJogar.className = 'btn-mini';
  btnJogar.textContent = '🎮 Ver no mini-game';
  btnJogar.onclick = () => { dlg.close(); setView('game'); irParaItem(id); };
  footer.append(btnJogar);
  
  dlg.querySelector('.item-dlg-inner').append(ul, footer);

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
    const card = document.createElement('button');
    card.type = 'button'; card.className = `cat-card r-${it.raridade}`; card.style.setProperty('--i', i);
    card.onclick = () => abrirFicha(id);
    card.innerHTML = `
      <span class="cat-glare"></span>
      <span class="badge-rar">${RARIDADE[it.raridade]}</span>
      <span class="cat-emoji">${it.emoji}</span>
      <strong>${it.titulo}</strong>
      <small>${it.pecas.length > 1 ? `${it.pecas.length} peças` : it.pecas[0].detalhe || CATS[it.cat].nome}</small>
      <span class="cat-cta">Ver ficha →</span>
    `;
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

  grid.replaceChildren(...(cards.length ? cards : [Object.assign(document.createElement('p'), {className:'cat-vazio', textContent:'Nada encontrado por aqui 👀'})]));

  const todas = Object.values(SETUP_DATA).flatMap((it) => it.pecas);
  $('catStats').replaceChildren(
    Object.assign(document.createElement('div'), {className:'stat', innerHTML: `<b>${Object.keys(SETUP_DATA).length}</b><span>Itens</span>`}),
    Object.assign(document.createElement('div'), {className:'stat', innerHTML: `<b>${todas.length}</b><span>Peças</span>`})
  );
}

function criarFiltros() {
  const box = $('catChips');
  const itens = [['todos', '✨ Tudo'], ...Object.entries(CATS).map(([k, c]) => [k, `${c.emoji} ${c.nome}`])];
  box.replaceChildren(...itens.map(([k, label]) =>
    Object.assign(document.createElement('button'), {
      type: 'button', className: `chip${k === filtro.cat ? ' on' : ''}`, textContent: label,
      onclick: (e) => {
        filtro.cat = k;
        box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === e.currentTarget));
        renderCatalogo();
      }
    })));
  $('catSearch').addEventListener('input', (e) => { filtro.busca = e.target.value; renderCatalogo(); });
}

/* INIT */
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

  const btnMute = $('btnMute');
  if (btnMute) {
    btnMute.textContent = window.GameAudio && window.GameAudio.isMuted() ? '🔇' : '🔊';
    btnMute.addEventListener('click', () => {
      if (window.GameAudio) {
        const muted = window.GameAudio.toggleMute();
        btnMute.textContent = muted ? '🔇' : '🔊';
        if (!muted) window.GameAudio.playPop();
      }
    });
  }

  let salvo = 'game';
  try { salvo = localStorage.getItem('setupView') || 'game'; } catch (_) { /* ignore */ }
  setView(salvo === 'catalog' ? 'catalog' : 'game');
}

window.iniciarTour = iniciarTour;
window.pararTour = pararTour;
window.irParaItem = irParaItem;
window.SETUP_DATA = SETUP_DATA;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();