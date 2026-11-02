/* ============================================================
    PERFIL — inicialização para o novo perfil multi-abas
    ============================================================ */
(function() {
  'use strict';

  const BANNER_KEY = 'perfil:banner:v1';
  const AVATAR_KEY_ANTIGA = 'perfil:boneco:v2';

  const CATEGORIAS = [
    {
      id: 'base',
      nome: 'Base',
      icone: '🧍',
      secoes: [
        { slot: 'base', titulo: 'Corpo', tipo: 'itens' },
        { slot: 'pele', titulo: 'Tom de pele', tipo: 'cores' }
      ]
    },
    {
      id: 'rosto',
      nome: 'Rosto',
      icone: '😊',
      secoes: [{ slot: 'rosto', titulo: 'Expressão', tipo: 'itens' }]
    },
    {
      id: 'cabelo',
      nome: 'Cabelo',
      icone: '💇',
      secoes: [
        { slot: 'cabelo', titulo: 'Estilo', tipo: 'itens' },
        { slot: 'cabeloCor', titulo: 'Cor', tipo: 'cores' }
      ]
    },
    {
      id: 'roupa',
      nome: 'Roupa',
      icone: '👕',
      secoes: [
        { slot: 'roupa', titulo: 'Estilo', tipo: 'itens' },
        { slot: 'roupaCor', titulo: 'Cor', tipo: 'cores' }
      ]
    },
    {
      id: 'calcado',
      nome: 'Calçado',
      icone: '👟',
      secoes: [
        { slot: 'calcado', titulo: 'Estilo', tipo: 'itens' },
        { slot: 'calcadoCor', titulo: 'Cor', tipo: 'cores' }
      ]
    },
    {
      id: 'acessorio',
      nome: 'Acessório',
      icone: '🕶️',
      secoes: [
        { slot: 'acessorio', titulo: 'Peça', tipo: 'itens' },
        { slot: 'acessorioCor', titulo: 'Cor', tipo: 'cores' }
      ]
    },
    {
      id: 'efeito',
      nome: 'Efeito',
      icone: '✨',
      secoes: [{ slot: 'efeito', titulo: 'Efeito especial', tipo: 'itens' }]
    },
    {
      id: 'animacao',
      nome: 'Animação',
      icone: '🎮',
      secoes: [{ slot: 'animacao', titulo: 'Pose no perfil', tipo: 'itens' }]
    },
    {
      id: 'moldura',
      nome: 'Moldura',
      icone: '🖼️',
      secoes: [{ slot: 'moldura', titulo: 'Moldura do boneco', tipo: 'itens' }]
    }
  ];

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

  function getUsuario(){
    try { return typeof USUARIO !== 'undefined' ? USUARIO : null; } catch (_) { return null; }
  }
  function nickDoUsuario(){
    const u = getUsuario();
    return u && (u.nick || u.username || u.usuario) ? (u.nick || u.username || u.usuario) : 'Jogador';
  }
  window.__pfAtualizarNomeBanner = function(perfil){
    const alvo = document.getElementById('pfBannerNome');
    const u = getUsuario();
    const nome = (perfil && perfil.nick) || (u && (u.nick || u.username)) || 'convidado';
    if (alvo) alvo.textContent = '@' + String(nome).replace(/^@/, '');
  };

  function initCriador(){
    const refs = {
      avatar: $('#pfAvatar'),
      stage: $('#pfAvatarStage'),
      stageCaption: $('#pfStageCaption'),
      saveState: $('#pfSaveState'),
      access: $('#pfAccess'),
      catalogStatus: $('#pfCatalogStatus'),
      saveMsg: $('#pfSaveMsg'),
      lockNote: $('#pfLockNote'),
      wardrobe: $('#pfWardrobe'),
      tabs: $('#pfWardrobeTabs'),
      panel: $('#pfWardrobePanel'),
      save: $('#pfSave'),
      random: $('#pfRandom'),
      reset: $('#pfReset'),
      gate: $('#pfCreatorGate'),
      gateLogin: $('#pfCreatorLogin'),
      error: $('#pfCreatorError'),
      errorText: $('#pfErrorText'),
      retry: $('#pfCreatorRetry')
    };

    if (!refs.avatar || !refs.save) return;

    if (!window.PixelAvatar || typeof window.PixelAvatar.render !== 'function') {
      if (refs.catalogStatus) refs.catalogStatus.textContent = 'O motor do boneco não carregou.';
      return;
    }

    let boneco = window.PixelAvatar.normalizar(window.PixelAvatar.PADRAO);
    let salvo = { ...boneco };
    let perfil = null;
    let catalogo = null;
    let categorias = [];
    let categoriaAtiva = 'base';
    let liberados = {};
    let carregado = false;
    let carregando = false;
    let carregamentoAtual = null;
    let salvando = false;
    let requisicao = 0;
    let avisoTimer = null;
    let mensagemTimer = null;
    let visitanteTimer = null;

    function itemDe(slot, id){
      if (!catalogo || !catalogo.catalogo || !Array.isArray(catalogo.catalogo[slot])) return null;
      return catalogo.catalogo[slot].find(item => item.id === id) || null;
    }

    function nomeItem(slot){
      const item = itemDe(slot, boneco[slot]);
      return item ? item.nome : boneco[slot];
    }

    function raridadeDe(item){
      if (!item) return { nome: 'Comum', cor: '#9ca3af' };
      const dados = catalogo && catalogo.raridades && catalogo.raridades[item.r];
      return dados || { nome: item.r || 'Comum', cor: '#9ca3af' };
    }

    function podeUsar(slot, id){
      return Array.isArray(liberados[slot]) && liberados[slot].includes(id);
    }

    function normalizarDisponivel(entrada, padrao){
      const out = {};
      const base = window.PixelAvatar.normalizar({ ...padrao, ...(entrada || {}) });
      window.PixelAvatar.SLOTS.forEach(slot => {
        if (podeUsar(slot, base[slot])) {
          out[slot] = base[slot];
          return;
        }
        const preferido = padrao && padrao[slot];
        if (preferido && podeUsar(slot, preferido)) {
          out[slot] = preferido;
          return;
        }
        const lista = Array.isArray(liberados[slot]) ? liberados[slot] : [];
        const item = lista.find(id => itemDe(slot, id));
        out[slot] = item || window.PixelAvatar.PADRAO[slot];
      });
      return out;
    }

    function setPalco(estado, texto){
      if (!refs.saveState) return;
      refs.saveState.dataset.estado = estado;
      refs.saveState.textContent = texto;
    }

    function mensagem(texto, tipo = ''){
      if (!refs.saveMsg) return;
      refs.saveMsg.textContent = texto;
      refs.saveMsg.dataset.tipo = tipo;
      clearTimeout(mensagemTimer);
      if (texto && tipo !== 'erro') {
        mensagemTimer = setTimeout(() => {
          if (refs.saveMsg.textContent === texto) {
            refs.saveMsg.textContent = '';
            refs.saveMsg.dataset.tipo = '';
          }
        }, 5200);
      }
    }

    function avisar(texto){
      if (!refs.lockNote) return;
      refs.lockNote.textContent = texto;
      refs.lockNote.classList.add('on');
      clearTimeout(avisoTimer);
      avisoTimer = setTimeout(() => {
        refs.lockNote.classList.remove('on');
        refs.lockNote.textContent = '';
      }, 5200);
    }

    function statusCatalogo(texto){
      if (refs.catalogStatus) refs.catalogStatus.textContent = texto;
    }

    function renderPreview(){
      if (!refs.avatar) return;
      try {
        const svg = window.PixelAvatar.render(boneco, {
          label: 'Prévia do boneco de ' + ((perfil && perfil.nick) || nickDoUsuario() || 'visitante'),
          animar: true
        });
        if (!svg || svg.nodeType !== 1) throw new Error('O motor não retornou um SVG válido.');
        refs.avatar.replaceChildren(svg);
        refs.avatar.dataset.render = 'ok';
      } catch (erro) {
        console.error('[Meu Boneco] Erro ao desenhar a prévia:', erro);
        refs.avatar.replaceChildren();
        refs.avatar.textContent = '🕹️';
        refs.avatar.dataset.render = 'erro';
        if (refs.stageCaption) refs.stageCaption.textContent = 'Não foi possível desenhar o personagem.';
      }
      refs.avatar.setAttribute('aria-label', 'Boneco com ' + nomeItem('cabelo') + ', ' + nomeItem('roupa') + ' e ' + nomeItem('acessorio') + '.');

      if (refs.stageCaption && refs.avatar.dataset.render !== 'erro') {
        if (!catalogo) {
          refs.stageCaption.textContent = perfil ? 'Carregando seu visual…' : 'Prévia do visual padrão.';
        } else {
          const partes = ['cabelo', 'roupa', 'acessorio', 'animacao']
            .map(slot => nomeItem(slot))
            .filter(Boolean);
          refs.stageCaption.textContent = partes.length ? partes.join(' · ') : 'Seu visual aparece aqui.';
        }
      }
    }

    function atualizarAcesso(){
      if (!refs.access) return;
      if (perfil) {
        refs.access.textContent = (perfil.nick || nickDoUsuario() || 'Jogador') + ' · Nível ' + (perfil.nivel || 1);
        refs.access.classList.add('is-online');
        refs.access.dataset.nivel = 'online';
      } else {
        refs.access.textContent = 'Visitante';
        refs.access.classList.remove('is-online');
        refs.access.dataset.nivel = '0';
      }
    }

    function totalLiberado(){
      if (!perfil) return 0;
      let total = 0;
      window.PixelAvatar.SLOTS.forEach(slot => {
        total += (Array.isArray(liberados[slot]) ? liberados[slot] : [])
          .filter(id => itemDe(slot, id)).length;
      });
      return total;
    }

    function totalCatalogo(){
      if (!catalogo) return 0;
      return window.PixelAvatar.SLOTS.reduce((soma, slot) =>
        soma + ((catalogo.catalogo[slot] && catalogo.catalogo[slot].length) || 0), 0);
    }

    function atualizarStatusCatalogo(){
      if (!catalogo) return;
      statusCatalogo(totalLiberado() + ' de ' + totalCatalogo() + ' peças liberadas no seu guarda-roupa.');
    }

    function atualizarEstadoSalvar(){
      const sujo = carregado && !mesmoBoneco(boneco, salvo);

      if (refs.save) {
        refs.save.disabled = !carregado || salvando || !sujo;
        refs.save.textContent = salvando ? '💾 Salvando…' : '💾 Salvar boneco';
      }
      if (refs.random) refs.random.disabled = !carregado || salvando;
      if (refs.reset) refs.reset.disabled = !carregado || salvando;

      if (salvando) setPalco('salvando', 'Salvando…');
      else if (carregado && sujo) setPalco('sujo', 'Alterações não salvas');
      else if (carregado) setPalco('salvo', 'Tudo salvo');
      else if (perfil) setPalco('erro', 'Sem conexão');
      else setPalco('visitante', 'Entre para salvar');
    }

    function criarItem(slot, item, tipo){
      const liberado = podeUsar(slot, item.id);
      const raridade = raridadeDe(item);
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.dataset.campo = slot;
      botao.dataset.id = item.id;
      botao.dataset.r = item.r || 'comum';
      botao.dataset.bloqueado = liberado ? '0' : '1';
      botao.setAttribute('aria-pressed', boneco[slot] === item.id ? 'true' : 'false');
      botao.setAttribute('aria-disabled', liberado ? 'false' : 'true');
      botao.style.setProperty('--rar', raridade.cor || '#9ca3af');
      botao.classList.toggle('is-locked', !liberado);
      if (boneco[slot] === item.id) botao.classList.add('on');

      const complemento = item.regraTxt || (liberado ? 'Liberado' : 'Bloqueado');
      botao.title = item.nome + ' — ' + complemento;
      botao.setAttribute('aria-label', item.nome + (liberado ? '' : ' (bloqueado: ' + complemento + ')'));

      if (tipo === 'cores') {
        botao.className = botao.className ? 'pf-swatch ' + botao.className : 'pf-swatch';
        botao.style.setProperty('--sw', item.cor || '#f5f3ff');
        const cadeado = criar('i', 'pf-lock', '🔒');
        cadeado.setAttribute('aria-hidden', 'true');
        botao.append(cadeado);
        return botao;
      }

      botao.className = botao.className ? 'pf-style ' + botao.className : 'pf-style';
      const topo = criar('span', 'pf-style-top');
      topo.append(criar('span', 'pf-style-name', item.nome));
      const cadeado = criar('i', 'pf-lock', '🔒');
      cadeado.setAttribute('aria-hidden', 'true');
      topo.append(cadeado);
      const miniatura = criar('span', 'pf-style-preview');
      if (window.PixelAvatar && typeof window.PixelAvatar.render === 'function') {
        const previewBoneco = { ...window.PixelAvatar.PADRAO, ...(boneco || {}), [slot]: item.id };
        const miniSvg = window.PixelAvatar.render(previewBoneco, {
          mini: true, animar: false, label: 'Prévia de ' + item.nome
        });
        if (miniSvg) miniatura.appendChild(miniSvg);
      }
      if (!miniatura.childNodes.length) {
        miniatura.textContent = item.cor ? '●' : (item.icone || '✦');
        if (item.cor) miniatura.style.color = item.cor;
      }
      botao.append(topo, miniatura);
      botao.append(criar('small', 'pf-item-rule', raridade.nome + ' · ' + complemento));
      return botao;
    }

    function renderPainel(){
      if (!catalogo || !refs.panel) return;
      const categoria = categorias.find(c => c.id === categoriaAtiva) || categorias[0];
      if (!categoria) return;
      refs.panel.setAttribute('aria-labelledby', 'pfWardrobeTab-' + categoria.id);

      const frag = document.createDocumentFragment();
      categoria.secoes.forEach(secao => {
        const itens = catalogo.catalogo[secao.slot];
        if (!Array.isArray(itens) || !itens.length) return;

        const grupo = criar('section', 'pf-option-group');
        const cabecalho = criar('div', 'pf-option-head');
        cabecalho.append(criar('span', '', secao.titulo));
        const atual = criar('small', 'pf-selected-name', nomeItem(secao.slot));
        atual.dataset.pfSelected = secao.slot;
        cabecalho.append(atual);
        grupo.append(cabecalho);

        const lista = criar('div', secao.tipo === 'cores' ? 'pf-swatches' : 'pf-styles');
        lista.setAttribute('role', 'group');
        lista.setAttribute('aria-label', secao.titulo);
        itens.forEach(item => lista.append(criarItem(secao.slot, item, secao.tipo)));
        grupo.append(lista);
        frag.append(grupo);
      });

      refs.panel.replaceChildren(frag);
      refs.panel.scrollTop = 0;
    }

    function renderCategorias(){
      if (!refs.tabs) return;
      categorias = CATEGORIAS.filter(categoria =>
        categoria.secoes.some(secao => Array.isArray(catalogo.catalogo[secao.slot]) && catalogo.catalogo[secao.slot].length)
      );
      if (!categorias.length) categorias = CATEGORIAS.slice();

      if (!categorias.some(categoria => categoria.id === categoriaAtiva)) {
        categoriaAtiva = categorias[0].id;
      }

      refs.tabs.replaceChildren();
      categorias.forEach(categoria => {
        const ativa = categoria.id === categoriaAtiva;
        const botao = criar('button', 'pf-wardrobe-tab' + (ativa ? ' on' : ''), categoria.icone + ' ' + categoria.nome);
        botao.type = 'button';
        botao.id = 'pfWardrobeTab-' + categoria.id;
        botao.dataset.categoria = categoria.id;
        botao.setAttribute('role', 'tab');
        botao.setAttribute('aria-selected', ativa ? 'true' : 'false');
        botao.setAttribute('aria-controls', 'pfWardrobePanel');
        botao.tabIndex = ativa ? 0 : -1;
        refs.tabs.append(botao);
      });

      if (refs.panel) refs.panel.tabIndex = 0;
      refs.wardrobe.hidden = false;
      renderPainel();
      atualizarEstadoSalvar();
    }

    function ativarCategoria(id, focar = false){
      if (!categorias.some(categoria => categoria.id === id)) return;
      categoriaAtiva = id;
      $$('[data-categoria]', refs.tabs).forEach(botao => {
        const ativa = botao.dataset.categoria === id;
        botao.classList.toggle('on', ativa);
        botao.setAttribute('aria-selected', ativa ? 'true' : 'false');
        botao.tabIndex = ativa ? 0 : -1;
        if (ativa && focar) botao.focus();
      });
      renderPainel();
    }

    function atualizarSelecao(slot, id, botao){
      $$('[data-campo="' + slot + '"]', refs.panel).forEach(item => {
        const ativo = item === botao;
        item.classList.toggle('on', ativo);
        item.setAttribute('aria-pressed', ativo ? 'true' : 'false');
      });
      const item = itemDe(slot, id);
      $$('[data-pf-selected="' + slot + '"]', refs.panel).forEach(rotulo => {
        rotulo.textContent = item ? item.nome : id;
      });
    }

    function escolher(botao){
      const slot = botao.dataset.campo;
      const id = botao.dataset.id;
      if (!slot || !id || !carregado) return;

      const item = itemDe(slot, id);
      if (!item) return;

      if (!podeUsar(slot, id)) {
        botao.classList.remove('nope');
        void botao.offsetWidth;
        botao.classList.add('nope');
        setTimeout(() => botao.classList.remove('nope'), 380);
        avisar('🔒 “' + item.nome + '” ainda está bloqueado: ' + (item.regraTxt || 'requisito não atendido') + '.');
        return;
      }

      if (refs.lockNote) {
        refs.lockNote.classList.remove('on');
        refs.lockNote.textContent = '';
      }

      boneco = { ...boneco, [slot]: id };
      atualizarSelecao(slot, id, botao);
      renderPreview();
      atualizarEstadoSalvar();
      mensagem('', '');
    }

    function sorteandoLista(slot){
      const itens = (catalogo.catalogo[slot] || []).filter(item => podeUsar(slot, item.id));
      return itens.length ? itens : [];
    }

    function aleatorio(){
      if (!carregado) return;
      const proximo = { ...boneco };
      window.PixelAvatar.SLOTS.forEach(slot => {
        const itens = sorteandoLista(slot);
        if (!itens.length) return;
        proximo[slot] = itens[Math.floor(Math.random() * itens.length)].id;
      });
      boneco = proximo;
      renderPainel();
      renderPreview();
      atualizarEstadoSalvar();
      mensagem('Visual sorteado! Salve para guardar no servidor.', 'ok');
    }

    function restaurarPadrao(){
      if (!carregado) return;
      const padrao = (catalogo && catalogo.padrao) || window.PixelAvatar.PADRAO;
      boneco = normalizarDisponivel(padrao, padrao);
      renderPainel();
      renderPreview();
      atualizarEstadoSalvar();
      mensagem('Padrão restaurado. Salve para confirmar.', 'ok');
    }

    async function salvar(){
      if (!carregado || salvando) return;
      if (!getUsuario() && !perfil) {
        if (window.AuthUI) window.AuthUI.open('entrar');
        return;
      }
      if (mesmoBoneco(boneco, salvo)) return;

      for (const slot of window.PixelAvatar.SLOTS) {
        if (!podeUsar(slot, boneco[slot])) {
          avisar('Um item selecionado não está mais liberado. Atualize o guarda-roupa e tente de novo.');
          await carregarTudo({ forcarPerfil: true });
          return;
        }
      }

      salvando = true;
      mensagem('', '');
      atualizarEstadoSalvar();

      try {
        const resposta = await api(window.API_AUTH || '/api/auth', 'avatar-save', {
          method: 'POST',
          body: { boneco }
        });

        if (resposta.ok && resposta.data && resposta.data.boneco) {
          boneco = window.PixelAvatar.normalizar(resposta.data.boneco);
          salvo = { ...boneco };
          renderPainel();
          renderPreview();
          atualizarEstadoSalvar();
          mensagem('Boneco salvo no servidor!', 'ok');
          if (window.toast) window.toast('Boneco atualizado! 🎮', 'ok');
          await window.GameState.carregarPerfil({ forcar: true });
          return;
        }

        if (resposta.status === 400 && resposta.data && Array.isArray(resposta.data.rejeitados)) {
          const nomes = resposta.data.rejeitados.map(item => {
            const encontrado = itemDe(item.slot, item.id);
            return encontrado ? encontrado.nome : item.id;
          });
          if (resposta.data.boneco) {
            boneco = window.PixelAvatar.normalizar(resposta.data.boneco);
            renderPainel();
            renderPreview();
          }
          avisar('Itens bloqueados foram ajustados: ' + nomes.join(', ') + '. Revise e salve de novo.');
          mensagem('O servidor recusou alguns itens.', 'erro');
          return;
        }

        if (resposta.status === 401) {
          mensagem('Sua sessão expirou. Entre novamente para salvar.', 'erro');
          return;
        }

        if (resposta.status === 429) {
          mensagem('Calma! Muitas alterações seguidas. Tente em um minuto.', 'erro');
          return;
        }

        mensagem((resposta.data && resposta.data.error) || 'Não foi possível salvar o boneco.', 'erro');
      } catch (_) {
        mensagem('Não foi possível salvar o boneco. Tente de novo.', 'erro');
      } finally {
        salvando = false;
        atualizarEstadoSalvar();
      }
    }

    function mostrarVisitante(){
      requisicao++;
      carregando = false;
      carregamentoAtual = null;
      carregado = false;
      perfil = null;
      catalogo = catalogo || null;
      liberados = {};
      boneco = window.PixelAvatar.normalizar(window.PixelAvatar.PADRAO);
      salvo = { ...boneco };
      categorias = [];
      if (refs.tabs) refs.tabs.replaceChildren();
      if (refs.panel) refs.panel.replaceChildren();
      if (refs.wardrobe) refs.wardrobe.hidden = true;
      if (refs.gate) refs.gate.hidden = false;
      if (refs.error) refs.error.hidden = true;
      if (refs.lockNote) { refs.lockNote.classList.remove('on'); refs.lockNote.textContent = ''; }
      if (window.__pfAtualizarNomeBanner) window.__pfAtualizarNomeBanner(null);
      atualizarAcesso();
      renderPreview();
      atualizarEstadoSalvar();
      statusCatalogo('Entre para liberar o guarda-roupa e salvar seu visual.');
      mensagem('', '');
    }

    function mostrarErro(texto){
      carregado = false;
      carregando = false;
      if (refs.wardrobe) refs.wardrobe.hidden = true;
      if (refs.gate) refs.gate.hidden = true;
      if (refs.error) refs.error.hidden = false;
      if (refs.errorText) refs.errorText.textContent = texto;
      atualizarAcesso();
      atualizarEstadoSalvar();
      statusCatalogo('Guarda-roupa indisponível.');
    }

    function iniciarComPerfil(dadosPerfil, dadosCatalogo){
      if (!dadosPerfil || !dadosCatalogo || !dadosCatalogo.catalogo) {
        throw new Error('Dados incompletos');
      }

      perfil = dadosPerfil;
      catalogo = dadosCatalogo;
      liberados = dadosPerfil.liberados || {};
      const padrao = window.PixelAvatar.normalizar(dadosCatalogo.padrao || window.PixelAvatar.PADRAO);
      boneco = normalizarDisponivel(dadosPerfil.boneco || padrao, padrao);
      salvo = { ...boneco };
      carregado = true;
      carregando = false;

      if (refs.gate) refs.gate.hidden = true;
      if (refs.error) refs.error.hidden = true;
      if (refs.wardrobe) refs.wardrobe.hidden = false;

      if (!categorias.length || !categorias.some(categoria => categoria.id === categoriaAtiva)) {
        categoriaAtiva = 'base';
      }
      renderCategorias();
      renderPreview();
      atualizarAcesso();
      atualizarStatusCatalogo();
      atualizarEstadoSalvar();
      if (window.__pfAtualizarNomeBanner) window.__pfAtualizarNomeBanner(perfil);
      mensagem('', '');
    }

    async function carregarTudo({ forcarPerfil = false, forcarCatalogo = false } = {}){
      if (!window.GameState) {
        mostrarErro('O estado do Arcade não foi inicializado. Recarregue a página e tente novamente.');
        return null;
      }
      // Cliques repetidos em "Tentar novamente" compartilham a requisição atual,
      // em vez de deixar a interface em um estado de carregamento concorrente.
      if (carregamentoAtual) return carregamentoAtual;

      const token = ++requisicao;
      carregando = true;
      if (refs.gate) refs.gate.hidden = true;
      if (refs.error) refs.error.hidden = true;
      if (refs.wardrobe) refs.wardrobe.hidden = true;
      setPalco('carregando', 'Carregando…');
      statusCatalogo('Carregando seu guarda-roupa…');

      carregamentoAtual = (async () => {
        try {
          const resultados = await Promise.allSettled([
            window.GameState.carregarPerfil({ forcar: forcarPerfil }),
            window.GameState.carregarCatalogo({ forcar: forcarCatalogo })
          ]);
          if (token !== requisicao) return null;

          let dadosPerfil = resultados[0].status === 'fulfilled' ? resultados[0].value : null;
          let dadosCatalogo = resultados[1].status === 'fulfilled' ? resultados[1].value : null;

          // Recupera o perfil e o catálogo separadamente. Uma fonte com falha
          // não deve esconder a mensagem útil da outra.
          if (!dadosPerfil && getUsuario()) {
            const respostaPerfil = await api(window.API_GAME || '/api/game', 'perfil');
            if (respostaPerfil.ok) dadosPerfil = respostaPerfil.data;
            else console.error('[Meu Boneco] Perfil indisponível:', respostaPerfil.status, respostaPerfil.data);
          }
          if (!dadosCatalogo || !dadosCatalogo.catalogo) {
            const respostaCatalogo = await api(window.API_GAME || '/api/game', 'catalogo');
            if (respostaCatalogo.ok && respostaCatalogo.data?.catalogo) dadosCatalogo = respostaCatalogo.data;
            else console.error('[Meu Boneco] Catálogo indisponível:', respostaCatalogo.status, respostaCatalogo.data);
          }
          if (token !== requisicao) return null;

          if (!dadosPerfil) {
            if (getUsuario()) mostrarErro('Não consegui carregar seu perfil. Sua sessão pode ter expirado; tente novamente ou entre outra vez.');
            else mostrarVisitante();
            return null;
          }
          if (!dadosCatalogo || !dadosCatalogo.catalogo) {
            mostrarErro('Seu perfil respondeu, mas o catálogo de itens falhou. Verifique a conexão e tente novamente.');
            return null;
          }

          iniciarComPerfil(dadosPerfil, dadosCatalogo);
          return dadosPerfil;
        } catch (erro) {
          console.error('[Meu Boneco] Falha ao carregar perfil ou catálogo:', erro);
          if (token === requisicao) mostrarErro('Não foi possível carregar o guarda-roupa. Verifique a conexão e tente novamente.');
          return null;
        } finally {
          if (token === requisicao) {
            carregando = false;
            carregamentoAtual = null;
          }
        }
      })();
      return carregamentoAtual;
    }

    async function experimentarItem(slot, id){
      if (!carregado) {
        await carregarTudo({ forcarPerfil: true, forcarCatalogo: true });
      }
      if (!carregado) {
        mensagem('Não foi possível abrir a prévia porque o guarda-roupa ainda não carregou.', 'erro');
        return false;
      }
      if (!window.PixelAvatar.SLOTS.includes(slot)) return false;
      const item = itemDe(slot, id);
      if (!item || !podeUsar(slot, id)) {
        avisar('Essa peça não está liberada na sua conta. Atualize o inventário para conferir seu acesso.');
        return false;
      }

      const categoria = CATEGORIAS.find(grupo => grupo.secoes.some(secao => secao.slot === slot));
      if (categoria) categoriaAtiva = categoria.id;
      boneco = { ...boneco, [slot]: id };
      renderCategorias();
      renderPreview();
      atualizarEstadoSalvar();
      mensagem('Prévia de “' + item.nome + '” aplicada. Salve quando gostar do resultado.', 'ok');
      return true;
    }

    function receberPerfil(dadosPerfil){
      if (!dadosPerfil) {
        mostrarVisitante();
        return;
      }
      const trocouConta = !!(perfil && dadosPerfil.id && perfil.id && String(perfil.id) !== String(dadosPerfil.id));
      if (trocouConta) {
        carregado = false;
        boneco = window.PixelAvatar.normalizar(window.PixelAvatar.PADRAO);
        salvo = { ...boneco };
      }

      perfil = dadosPerfil;
      liberados = dadosPerfil.liberados || {};
      if (window.__pfAtualizarNomeBanner) window.__pfAtualizarNomeBanner(perfil);

      if (!catalogo || !carregado) return;

      const sujo = !mesmoBoneco(boneco, salvo);
      if (!sujo) {
        const padrao = window.PixelAvatar.normalizar((catalogo && catalogo.padrao) || window.PixelAvatar.PADRAO);
        boneco = normalizarDisponivel(dadosPerfil.boneco || padrao, padrao);
        salvo = { ...boneco };
        renderPreview();
      }

      renderCategorias();
      atualizarAcesso();
      atualizarStatusCatalogo();
      atualizarEstadoSalvar();
    }

    refs.save.addEventListener('click', salvar);
    refs.random.addEventListener('click', aleatorio);
    refs.reset.addEventListener('click', restaurarPadrao);

    if (refs.gateLogin) {
      refs.gateLogin.addEventListener('click', () => {
        if (window.AuthUI) window.AuthUI.open('entrar');
        else window.location.href = '/?entrar=1';
      });
    }

    if (refs.retry) {
      refs.retry.addEventListener('click', async () => {
        refs.retry.disabled = true;
        refs.retry.textContent = 'Tentando novamente…';
        try {
          await window.checarLogin?.();
          await carregarTudo({ forcarPerfil: true, forcarCatalogo: true });
        } finally {
          refs.retry.disabled = false;
          refs.retry.textContent = 'Tentar novamente';
        }
      });
    }

    if (refs.panel) {
      refs.panel.addEventListener('click', evento => {
        const botao = evento.target.closest('[data-campo][data-id]');
        if (botao) escolher(botao);
      });
    }

    if (refs.tabs) {
      refs.tabs.addEventListener('click', evento => {
        const botao = evento.target.closest('[data-categoria]');
        if (botao) ativarCategoria(botao.dataset.categoria);
      });

      refs.tabs.addEventListener('keydown', evento => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
        const botoes = $$('[data-categoria]', refs.tabs);
        if (!botoes.length) return;
        const atual = botoes.indexOf(document.activeElement);
        if (atual < 0) return;
        evento.preventDefault();
        let indice = atual;
        if (evento.key === 'ArrowLeft') indice = (atual - 1 + botoes.length) % botoes.length;
        if (evento.key === 'ArrowRight') indice = (atual + 1) % botoes.length;
        if (evento.key === 'Home') indice = 0;
        if (evento.key === 'End') indice = botoes.length - 1;
        ativarCategoria(botoes[indice].dataset.categoria, true);
      });
    }

    window.addEventListener('soso:experimentar-item', evento => {
      const detalhe = evento.detail || {};
      experimentarItem(detalhe.slot, detalhe.id).then(sucesso => {
        if (sucesso && refs.stage) refs.stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(erro => {
        console.error('[Meu Boneco] Não foi possível abrir a prévia do item:', erro);
        mensagem('Não foi possível experimentar essa peça. Tente novamente.', 'erro');
      });
    });

    window.addEventListener('soso:boneco-open', () => {
      if (!carregado && !carregando && (getUsuario() || window.GameState?.perfil)) {
        carregarTudo({ forcarPerfil: true, forcarCatalogo: true });
      }
    });

    if (window.GameState) {
      window.GameState.on('perfil', receberPerfil);
    }

    window.addEventListener('soso:auth', evento => {
      clearTimeout(visitanteTimer);
      if (evento.detail) {
        carregarTudo({ forcarPerfil: true, forcarCatalogo: true });
        return;
      }
      mostrarVisitante();
    });

    window.addEventListener('soso:logout', () => {
      clearTimeout(visitanteTimer);
      mostrarVisitante();
    });

    window.addEventListener('soso:aba', evento => {
      if (evento.detail !== 'perfil' || carregado || carregando) return;
      if (getUsuario() || window.GameState?.perfil) carregarTudo();
    });

    renderPreview();
    atualizarEstadoSalvar();

    if (getUsuario()) {
      carregarTudo();
    } else if (window.GameState && window.GameState.perfil) {
      carregarTudo();
    } else {
      statusCatalogo('Conectando sua conta…');
      visitanteTimer = setTimeout(() => {
        if (!carregado && !carregando && !getUsuario()) mostrarVisitante();
      }, 2500);
    }
  }

  function iniciar(){
    try { localStorage.removeItem(AVATAR_KEY_ANTIGA); } catch (_) {}
    // As abas e configurações ficam sob responsabilidade de js/perfil-ui.js.
    // Não chamar inicializadores antigos inexistentes: isso impedia o boneco de carregar.
    initCriador();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
