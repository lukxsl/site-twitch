/* Catálogo do setup — versão simples, sem quarto interativo ou personagem. */
(() => {
  'use strict';
  if (window.__setupCatalogLoaded) return;
  window.__setupCatalogLoaded = true;

  const $ = id => document.getElementById(id);
  const CATEGORIAS = {
    todos: { nome: 'Tudo', emoji: '✦' },
    pc: { nome: 'PC', emoji: '🖥️' },
    perifericos: { nome: 'Periféricos', emoji: '⌨️' },
    conforto: { nome: 'Conforto', emoji: '🪑' }
  };
  const LOJAS = [
    { nome: 'KaBuM!', url: q => `https://www.kabum.com.br/busca/${encodeURIComponent(q.trim().toLowerCase().replace(/\s+/g, '-'))}` },
    { nome: 'Amazon', url: q => `https://www.amazon.com.br/s?k=${encodeURIComponent(q).replace(/%20/g, '+')}` }
  ];
  const ITENS_FALLBACK = [
    { id: 'gabinete', titulo: 'Gabinete Risemode Aquarium', emoji: '🚀', cat: 'pc', descricao: 'O conjunto principal do computador usado nas lives.', pecas: [
      ['Processador AMD Ryzen 9 5900X', '12 núcleos / 24 threads', 'AMD Ryzen 9 5900X processador'],
      ['Memória RAM 48GB', 'Folga para jogo e transmissão', 'memoria ram ddr4 48gb'],
      ['Placa-mãe ASUS X570 TUF', 'Chipset X570, PCIe 4.0', 'placa mae asus x570 tuf gaming'],
      ['Placa de vídeo RTX 3060 12GB', '12GB de memória de vídeo', 'placa de video rtx 3060 12gb branca'],
      ['Water Cooler Risemode Aura RGB', 'Refrigeração líquida com RGB', 'water cooler risemode aura rgb'],
      ['SSD NVMe 2TB', 'Armazenamento rápido', 'ssd nvme 2tb m.2'],
      ['Fonte Corsair RM800W', '800W, 80 Plus Gold', 'fonte corsair rm800w 80 plus gold'],
      ['Gabinete Risemode Aquarium Branco', 'Vidro temperado', 'gabinete risemode aquarium branco']
    ]},
    { id: 'monitor', titulo: 'Monitor AOC 240Hz', emoji: '🖥️', cat: 'perifericos', descricao: 'Monitor de alta taxa de atualização para uma imagem mais fluida.', pecas: [
      ['Monitor Gamer AOC 240Hz', '240Hz, imagem fluida', 'monitor gamer aoc 240hz 1ms']
    ]},
    { id: 'webcam', titulo: 'Webcam iPhone 11', emoji: '📱', cat: 'perifericos', descricao: 'O iPhone 11 é usado como câmera nas transmissões.', pecas: [
      ['iPhone 11', 'Câmera de celular usada como webcam', 'iphone 11 128gb']
    ]},
    { id: 'teclado', titulo: 'Logitech G PRO X TKL', emoji: '⌨️', cat: 'perifericos', descricao: 'Teclado compacto que libera espaço para o mouse.', pecas: [
      ['Teclado Logitech G PRO X TKL Branco', 'Formato TKL, compacto', 'teclado logitech g pro x tkl branco']
    ]},
    { id: 'mouse', titulo: 'Logitech G502 X Superlight', emoji: '🖱️', cat: 'perifericos', descricao: 'Mouse leve e preciso para jogar.', pecas: [
      ['Mouse Logitech G502 X Superlight', 'Sensor preciso', 'mouse logitech g502x plus superlight']
    ]},
    { id: 'headset', titulo: 'Headset Astro A30', emoji: '🎧', cat: 'perifericos', descricao: 'Headset sem fio para acompanhar o jogo e o chat.', pecas: [
      ['Headset Astro A30', 'Sem fio e confortável', 'headset astro a30']
    ]},
    { id: 'microfone', titulo: 'Microfone FIFINE AM8', emoji: '🎙️', cat: 'perifericos', descricao: 'Microfone dinâmico para a voz da transmissão.', pecas: [
      ['Microfone FIFINE AM8 Branco', 'Conexões USB e XLR', 'microfone fifine am8 branco']
    ]},
    { id: 'cadeira', titulo: 'Cadeira XT Racer', emoji: '🪑', cat: 'conforto', descricao: 'Cadeira usada durante as lives mais longas.', pecas: [
      ['Cadeira Gamer XT Racer', 'Conforto para longas sessões', 'cadeira gamer xt racer']
    ]}
  ];
  let ITENS = ITENS_FALLBACK;
  const estado = { categoria: 'todos', busca: '' };
  const criar = (tag, classe, texto) => {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  };

  function abrirFicha(item){
    const dialog = $('itemDialog');
    if (!dialog) return;
    const fechar = criar('button', 'item-close', '×');
    fechar.type = 'button'; fechar.setAttribute('aria-label', 'Fechar');
    fechar.addEventListener('click', () => dialog.close());
    const inner = criar('div', 'item-dlg-inner');
    const head = criar('div', 'item-head');
    const emoji = criar('div', 'item-emoji', item.emoji);
    const titleBox = criar('div', 'item-title-box');
    titleBox.append(criar('span', 'item-category', `${CATEGORIAS[item.cat].emoji} ${CATEGORIAS[item.cat].nome}`));
    const title = criar('h3', '', item.titulo); title.id = 'itemDlgTitle';
    titleBox.append(title);
    head.append(emoji, titleBox);
    const desc = criar('p', 'item-fala', item.descricao);
    const lista = criar('ul', 'pecas');
    item.pecas.forEach(([nome, detalhe, busca]) => {
      const li = criar('li', 'peca');
      const info = criar('div', 'peca-info'); info.append(criar('strong', '', nome));
      if (detalhe) info.append(criar('span', '', detalhe));
      const acoes = criar('div', 'item-buy-links');
      LOJAS.forEach(loja => {
        const link = criar('a', '', loja.nome);
        link.href = loja.url(busca); link.target = '_blank'; link.rel = 'noopener noreferrer';
        acoes.append(link);
      });
      li.append(info, acoes); lista.append(li);
    });
    inner.append(fechar, head, desc, lista);
    dialog.replaceChildren(inner);
    if (!dialog.open) dialog.showModal();
  }

  function render(){
    const grid = $('catGrid'), stats = $('catStats');
    if (!grid || !stats) return;
    const q = estado.busca.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const itens = ITENS.filter(item => {
      if (estado.categoria !== 'todos' && item.cat !== estado.categoria) return false;
      const texto = `${item.titulo} ${item.descricao} ${item.pecas.map(p => p[0]).join(' ')}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return !q || texto.includes(q);
    });
    grid.replaceChildren();
    if (!itens.length) grid.append(criar('p', 'cat-vazio', 'Nenhum equipamento encontrado.'));
    itens.forEach((item, index) => {
      const card = criar('button', 'cat-card', '');
      card.type = 'button'; card.style.setProperty('--i', String(index));
      card.append(criar('span', 'cat-emoji', item.emoji), criar('strong', '', item.titulo));
      card.append(criar('small', '', `${item.pecas.length} ${item.pecas.length === 1 ? 'componente' : 'componentes'} · ${CATEGORIAS[item.cat].nome}`));
      card.append(criar('span', 'cat-cta', 'Ver detalhes →'));
      card.addEventListener('click', () => abrirFicha(item));
      grid.append(card);
    });
    const totalPecas = ITENS.reduce((sum, item) => sum + item.pecas.length, 0);
    stats.replaceChildren();
    [[ITENS.length, 'Equipamentos'], [totalPecas, 'Componentes']].forEach(([valor, label]) => {
      const stat = criar('div', 'stat'); stat.append(criar('b', '', String(valor)), criar('span', '', label)); stats.append(stat);
    });
  }

  function criarFiltros(){
    const box = $('catChips'); if (!box) return;
    box.replaceChildren();
    Object.entries(CATEGORIAS).forEach(([id, categoria]) => {
      const button = criar('button', `chip${id === estado.categoria ? ' on' : ''}`, `${categoria.emoji} ${categoria.nome}`);
      button.type = 'button'; button.setAttribute('aria-pressed', String(id === estado.categoria));
      button.addEventListener('click', () => {
        estado.categoria = id;
        box.querySelectorAll('.chip').forEach(chip => {
          const active = chip === button;
          chip.classList.toggle('on', active); chip.setAttribute('aria-pressed', String(active));
        });
        render();
      });
      box.append(button);
    });
    $('catSearch')?.addEventListener('input', event => { estado.busca = event.target.value || ''; render(); });
  }

  function converterSetup(grupos){
    if(!Array.isArray(grupos)) return [];
    return grupos.map((grupo, index) => {
      const id = String(grupo?.id || `grupo-${index}`);
      const cat = id === 'pc' ? 'pc' : id === 'per' ? 'perifericos' : 'conforto';
      const pecas = (Array.isArray(grupo?.itens) ? grupo.itens : []).map(item => {
        const nome = String(item?.nome || '').trim();
        if(!nome) return null;
        const detalhes = [item?.cat, item?.comentario, item?.benchmark].filter(Boolean).join(' · ');
        return [nome, detalhes, nome];
      }).filter(Boolean);
      if(!pecas.length) return null;
      return {
        id,
        titulo: String(grupo?.titulo || 'Equipamentos'),
        emoji: cat === 'pc' ? '🖥️' : cat === 'perifericos' ? '⌨️' : '🪑',
        cat,
        descricao: `Equipamentos cadastrados pela equipe na categoria ${grupo?.titulo || 'Setup'}.`,
        pecas
      };
    }).filter(Boolean);
  }

  async function init(){
    const section = $('sec-setup');
    if (!section || section.dataset.catalogReady) return;
    section.dataset.catalogReady = '1';
    criarFiltros();
    render();
    $('itemDialog')?.addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
    // Mantém o catálogo ligado aos equipamentos que a equipe edita no painel.
    try{
      const response = await fetch('/api/config?action=setup', { cache: 'no-store' });
      if(!response.ok) throw new Error('Falha ao carregar o setup.');
      const data = await response.json();
      const atualizados = converterSetup(data?.setup);
      if(atualizados.length) ITENS = atualizados;
      render();
    }catch(error){
      // O catálogo local continua disponível caso o Redis esteja temporariamente fora.
      console.warn('[Setup] Não foi possível atualizar os equipamentos:', error?.message || error);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
