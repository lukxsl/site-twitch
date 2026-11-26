/* ============================================================
   SETUP — catálogo de peças com ficha técnica
   ============================================================ */
(() => {
'use strict';
if (window.__setupLoaded) return;
window.__setupLoaded = true;

const $ = id => document.getElementById(id);
const P = (nome, q, detalhe = '', extra = {}) => ({ nome, q, detalhe, ...extra });
const CATS = {
  pc: { nome: 'PC', icone: 'i-monitor' },
  perifericos: { nome: 'Periféricos', icone: 'i-monitor' },
  conforto: { nome: 'Conforto & Vibe', icone: 'i-heart' }
};
const RARIDADE = { lendario: 'Lendário', epico: 'Épico', raro: 'Raro' };

const SETUP_DATA = {
  gabinete: {
    titulo: 'Gabinete Risemode Aquarium', cat: 'pc', raridade: 'lendario',
    texto: 'Ryzen 9 5900X, 48GB de RAM, X570 TUF, RTX 3060 de 12GB e water cooler RGB no vidro temperado.',
    pecas: [
      P('Processador AMD Ryzen 9 5900X', 'AMD Ryzen 9 5900X processador', '12 núcleos / 24 threads'),
      P('Memória RAM 48GB', 'memoria ram ddr4 48gb', 'Folga pra live + jogo'),
      P('Placa-mãe ASUS X570 TUF', 'placa mae asus x570 tuf gaming', 'Chipset X570, PCIe 4.0'),
      P('Placa de Vídeo RTX 3060 12GB', 'placa de video rtx 3060 12gb branca', '12GB de VRAM'),
      P('Water Cooler Risemode Aura RGB', 'water cooler risemode aura rgb', 'Refrigeração líquida com RGB'),
      P('SSD NVMe 2TB', 'ssd nvme 2tb m.2', 'Jogos carregando voando'),
      P('Fonte Corsair RM800W', 'fonte corsair rm800w 80 plus gold', '800W modular'),
      P('Gabinete Risemode Aquarium Branco', 'gabinete risemode aquarium branco', 'Vidro temperado')
    ]
  },
  monitor: {
    titulo: 'Monitor AOC 240Hz', cat: 'perifericos', raridade: 'epico',
    texto: 'Imagem lisinha a 240Hz — o palco principal das lives.',
    pecas: [P('Monitor Gamer AOC 240Hz', 'monitor gamer aoc 240hz 1ms', '240Hz, 1ms')]
  },
  webcam: {
    titulo: 'Webcam iPhone 11', cat: 'perifericos', raridade: 'raro',
    texto: 'Um iPhone 11 fazendo o papel de webcam e entregando imagem nítida.',
    pecas: [P('iPhone 11 (usado como webcam)', 'iphone 11 128gb', 'Câmera de celular como webcam')]
  },
  teclado: {
    titulo: 'Logitech G PRO X TKL', cat: 'perifericos', raridade: 'epico',
    texto: 'TKL branco, sem fio e com espaço de sobra pra mouse.',
    pecas: [P('Teclado Logitech G PRO X TKL Branco', 'teclado logitech g pro x tkl branco', 'TKL, sem fio')]
  },
  mouse: {
    titulo: 'Logitech G502X Superlight', cat: 'perifericos', raridade: 'epico',
    texto: 'Leve, preciso e com RGB.',
    pecas: [P('Mouse Logitech G502X Superlight', 'mouse logitech g502x plus superlight', 'Sensor preciso')]
  },
  headset: {
    titulo: 'Headset Astro A30', cat: 'perifericos', raridade: 'epico',
    texto: 'Sem fio e confortável pra aguentar lives longas.',
    pecas: [P('Headset Astro A30', 'headset astro a30', 'Sem fio, confortável')]
  },
  microfone: {
    titulo: 'Microfone FIFINE AM8', cat: 'perifericos', raridade: 'raro',
    texto: 'Dinâmico branco, capta a voz e deixa o barulho do quarto de fora.',
    pecas: [P('Microfone FIFINE AM8 Branco', 'microfone fifine am8 branco', 'Dinâmico, USB e XLR')]
  },
  cadeira: {
    titulo: 'Cadeira XT Racer', cat: 'conforto', raridade: 'raro',
    texto: 'Conforto pra aguentar aquelas lives de várias horas.',
    pecas: [P('Cadeira Gamer XT Racer', 'cadeira gamer xt racer', 'Conforto pra lives longas')]
  }
};

const filtro = { cat: 'todos', busca: '' };
const slug = q => q.trim().toLowerCase().replace(/\s+/g, '-');
const LOJAS = [
  { id: 'kabum', nome: 'KaBuM!', url: q => `https://www.kabum.com.br/busca/${encodeURIComponent(slug(q))}` },
  { id: 'amazon', nome: 'Amazon', url: q => `https://www.amazon.com.br/s?k=${encodeURIComponent(q).replace(/%20/g, '+')}` }
];

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => c != null && el.append(c));
  return el;
}

function icone(id, cls = 'ic') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + id);
  svg.append(use);
  return svg;
}

function abrirFicha(id) {
  const it = SETUP_DATA[id];
  if (!it) return;
  const dlg = $('itemDialog');
  if (!dlg) return;
  dlg.className = `item-dialog r-${it.raridade}`;

  const fecharPopovers = () => {
    dlg.querySelectorAll('.loja-popover').forEach(x => { x.hidden = true; });
    dlg.querySelectorAll('.btn-onde').forEach(x => {
      x.textContent = 'Onde encontrar';
      x.setAttribute('aria-expanded', 'false');
    });
  };

  const pecas = it.pecas.map(p => {
    const li = h('li', { class: 'peca' },
      h('div', { class: 'peca-info' },
        h('strong', { text: p.nome }),
        p.detalhe ? h('span', { text: p.detalhe }) : null));
    if (!p.semLoja) {
      const pop = h('div', { class: 'loja-popover', hidden: true },
        LOJAS.map(l => h('a', { class: `loja-${l.id}`, href: l.url(p.q), target: '_blank', rel: 'noopener noreferrer', text: l.nome })));
      const btn = h('button', { type: 'button', class: 'btn-onde', 'aria-expanded': 'false', text: 'Onde encontrar' });
      btn.addEventListener('click', () => {
        const abrir = pop.hidden;
        fecharPopovers();
        if (abrir) {
          pop.hidden = false;
          btn.textContent = 'Fechar';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
      li.append(btn, pop);
    }
    return li;
  });

  dlg.replaceChildren(
    h('div', { class: 'item-dlg-inner' },
      h('button', { type: 'button', class: 'item-close', 'aria-label': 'Fechar', text: '✕', onclick: () => dlg.close() }),
      h('div', { class: 'item-head' },
        icone(CATS[it.cat].icone, 'ic ic-lg'),
        h('div', {},
          h('span', { class: 'badge-rar', text: RARIDADE[it.raridade] }),
          h('h3', { id: 'itemDlgTitle', text: it.titulo }),
          h('small', { text: CATS[it.cat].nome }))),
      h('p', { class: 'item-fala', text: it.texto }),
      h('ul', { class: 'pecas' }, pecas)));
  if (!dlg.open) dlg.showModal();
}

function renderCatalogo() {
  const grid = $('catGrid');
  if (!grid) return;
  const q = filtro.busca.trim().toLowerCase();
  const itens = Object.entries(SETUP_DATA).filter(([, it]) => {
    if (filtro.cat !== 'todos' && it.cat !== filtro.cat) return false;
    if (!q) return true;
    return it.titulo.toLowerCase().includes(q) || it.pecas.some(p => p.nome.toLowerCase().includes(q));
  });

  const cards = itens.map(([id, it]) => h('button', { type: 'button', class: `cat-card r-${it.raridade}`, onclick: () => abrirFicha(id) },
    h('span', { class: 'badge-rar', text: RARIDADE[it.raridade] }),
    icone(CATS[it.cat].icone, 'ic ic-lg'),
    h('strong', { text: it.titulo }),
    h('small', { text: it.pecas.length > 1 ? `${it.pecas.length} peças` : (it.pecas[0].detalhe || CATS[it.cat].nome) }),
    h('span', { class: 'cat-cta', text: 'Ver ficha →' })));

  grid.replaceChildren(...(cards.length ? cards : [h('p', { class: 'cat-vazio', text: 'Nada encontrado por aqui.' })]));

  const todos = Object.values(SETUP_DATA);
  const nPecas = todos.reduce((s, it) => s + it.pecas.length, 0);
  const stats = $('catStats');
  if (stats) stats.replaceChildren(
    ...[['Itens', todos.length], ['Peças', nPecas]].map(([l, v]) =>
      h('div', { class: 'stat' }, h('b', { text: String(v) }), h('span', { text: l }))));
}

function criarFiltros() {
  const box = $('catChips');
  if (!box) return;
  const lista = [['todos', 'Tudo'], ...Object.entries(CATS).map(([k, c]) => [k, c.nome])];
  box.replaceChildren(...lista.map(([k, label]) =>
    h('button', { type: 'button', class: `chip${k === filtro.cat ? ' on' : ''}`, text: label,
      onclick: e => {
        filtro.cat = k;
        box.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === e.currentTarget));
        renderCatalogo();
      } })));
  const busca = $('catSearch');
  if (busca) busca.addEventListener('input', e => { filtro.busca = e.target.value; renderCatalogo(); });
}

function init() {
  const sec = $('sec-setup');
  if (!sec || sec.dataset.ready) return;
  sec.dataset.ready = '1';
  criarFiltros();
  renderCatalogo();
  const dlg = $('itemDialog');
  if (dlg) dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
}

window.SETUP_DATA = SETUP_DATA;
window.abrirFichaSetup = abrirFicha;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
