/* ============================================================
   LOJA UI — componente da loja para comprar itens com SosoCoins
   ============================================================ */
(function() {
  'use strict';

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

  function initShop() {
    const shopContainer = $('#shopContainer');
    const shopItems = $('#shopItems');
    const shopLoading = $('#shopLoading');
    const shopEmpty = $('#shopEmpty');
    const shopPrevPage = $('#shopPrevPage');
    const shopNextPage = $('#shopNextPage');
    const shopPageInfo = $('#shopPageInfo');
    
    if (!shopContainer) return;

    let paginaAtual = 1;
    let totalPaginas = 1;
    let filtros = {
      categoria: 'all',
      raridade: 'all',
      status: 'all'
    };

    function carregarShop() {
      shopLoading.style.display = 'block';
      shopEmpty.style.display = 'none';
      shopItems.innerHTML = '';

      if (!window.GameState) return;

      window.GameState.carregarPerfil({ forcar: true }).then(perfil => {
        api(API_GAME, 'catalogo', { action: 'listar' }).then(res => {
          if (!res.ok || !res.data) return;

          const catalogo = res.data.catalogo || {};
          const itensLoja = Object.values(catalogo).flat().filter(item => item.regra && item.regra.t === 'loja') || [];

          if (itensLoja.length === 0) {
            shopLoading.style.display = 'none';
            shopEmpty.style.display = 'block';
            return;
          }

          filtrarERenderizarItens(itensLoja);
        });
      });
    }

    function filtrarERenderizarItens(todosItens) {
      const itensFiltrados = todosItens.filter(item => {
        if (filtros.categoria !== 'all' && item.categoria !== filtros.categoria) return false;
        if (filtros.raridade !== 'all' && item.r !== filtros.raridade) return false;
        if (filtros.status === 'available') {
          if (window.GameState?.perfil?.comprados && window.GameState.perfil.comprados.includes(item.id)) return false;
        } else if (filtros.status === 'owned') {
          if (!window.GameState?.perfil?.comprados || !window.GameState.perfil.comprados.includes(item.id)) return false;
        }
        return true;
      });

      const inicio = (paginaAtual - 1) * 12;
      const fim = inicio + 12;
      const itensPaginados = itensFiltrados.slice(inicio, fim);
      totalPaginas = Math.ceil(itensFiltrados.length / 12);

      shopItems.innerHTML = itensPaginados.map(item => renderizarItemLoja(item)).join('');

      shopLoading.style.display = 'none';

      if (shopPageInfo) {
        shopPageInfo.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
      }

      if (shopPrevPage) {
        shopPrevPage.disabled = paginaAtual <= 1;
      }
      if (shopNextPage) {
        shopNextPage.disabled = paginaAtual >= totalPaginas;
      }

      attachShopEventListeners();
    }

    function renderizarItemLoja(item) {
      const comprado = window.GameState?.perfil?.comprados?.includes(item.id) || false;
      const disponivel = window.GameState?.perfil?.coins >= (item.preco || 0);

      const raridade = item.r || 'comum';
      const raridadeLabel = {
        'comum': 'Comum',
        'raro': 'Raro',
        'epico': 'Épico',
        'lendario': 'Lendário',
        'limitado': 'Limitado'
      }[raridade] || raridade;

      const categoria = item.categoria || 'geral';
      const categoriaLabel = {
        'base': 'Base',
        'cabelo': 'Cabelo',
        'roupa': 'Roupa',
        'calcado': 'Calçado',
        'acessorio': 'Acessório',
        'efeito': 'Efeito',
        'animacao': 'Animação',
        'moldura': 'Moldura'
      }[categoria] || categoria;

      return `
        <div class="shop-item" data-raridade="${raridade}" data-categoria="${categoria}">
          <div class="shop-item-header">
            <div class="shop-item-rarity" style="--rar-color: var(--rar-${raridade})">${raridadeLabel}</div>
            <div class="shop-item-category">${categoriaLabel}</div>
          </div>
          
          <div class="shop-item-preview">
            <div class="shop-item-placeholder">
              <span class="shop-item-emoji">🎨</span>
              <span class="shop-item-rarity-emoji">${getRarityEmoji(raridade)}</span>
            </div>
          </div>
          
          <div class="shop-item-info">
            <h3 class="shop-item-name">${item.nome}</h3>
            <p class="shop-item-desc">${item.descricao || 'Um item especial para seu boneco.'}</p>
            <div class="shop-item-meta">
              <span class="shop-item-price">
                <span class="shop-item-coin-icon">🪙</span>
                ${item.preco || 0}
              </span>
              <span class="shop-item-status ${comprado ? 'owned' : (disponivel ? 'available' : 'not-available')}">
                ${comprado ? '✓ Já possui' : (disponivel ? '✓ Disponível' : '✗ Sem moedas')}
              </span>
            </div>
          </div>
          
          <div class="shop-item-actions">
            ${!comprado ? `
              <button class="shop-item-btn buy-btn" data-item-id="${item.id}" ${!disponivel ? 'disabled' : ''}>
                <span class="btn-text">Comprar</span>
                <span class="btn-load" aria-hidden="true"></span>
              </button>
            ` : `
              <button class="shop-item-btn equip-btn" data-item-id="${item.id}">
                <span class="btn-text">Equipar</span>
              </button>
            `}
          </div>
        </div>
      `;
    }

    function attachShopEventListeners() {
      const buyBtns = $$('.shop-item-btn.buy-btn');
      const equipBtns = $$('.shop-item-btn.equip-btn');

      buyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.itemId;
          if (btn.disabled) return;

          confirmarCompra(itemId);
        });
      });

      equipBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.itemId;
          equiparItem(itemId);
        });
      });

      const filtrosSelects = $$('#shopCategoryFilter, #shopRarityFilter, #shopStatusFilter');
      filtrosSelects.forEach(select => {
        select.addEventListener('change', () => {
          const nome = select.id;
          filtros[nome] = select.value;
          paginaAtual = 1;
          carregarShop();
        });
      });

      if (shopPrevPage) {
        shopPrevPage.addEventListener('click', () => {
          if (paginaAtual > 1) {
            paginaAtual--;
            carregarShop();
          }
        });
      }

      if (shopNextPage) {
        shopNextPage.addEventListener('click', () => {
          if (paginaAtual < totalPaginas) {
            paginaAtual++;
            carregarShop();
          }
        });
      }
    }

    function getRarityEmoji(raridade) {
      const emojis = {
        'comum': '⚪',
        'raro': '🔵',
        'epico': '🟣',
        'lendario': '🟠',
        'limitado': '🔴'
      };
      return emojis[raridade] || '⚪';
    }

    function confirmarCompra(itemId) {
      window.confirmar(
        'Confirmar compra',
        'Esta ação não pode ser desfeita. Confirmar compra?',
        '🛒'
      ).then(confirmado => {
        if (!confirmado) return;

        const btn = $$(`.shop-item-btn.buy-btn[data-item-id="${itemId}"]`)[0];
        if (!btn) return;

        btn.classList.add('is-loading');
        btn.disabled = true;

        api(API_GAME, 'comprar', {
          method: 'POST',
          body: { itemId }
        }).then(res => {
          btn.classList.remove('is-loading');

          if (!res.ok) {
            if (res.status === 402 && res.data && res.data.mensagem) {
              window.toast(res.data.mensagem, 'warn');
            } else {
              window.toast('Não foi possível comprar o item.', 'erro');
            }
            return;
          }

          window.toast('Item adquirido com sucesso! 🎮', 'ok');

          if (res.data && res.data.novo) {
            window.toast('Novo item desbloqueado!', 'ok');
          }

          carregarShop();
          atualizarNavbar();
        }).catch(() => {
          btn.classList.remove('is-loading');
          window.toast('Erro ao comprar item.', 'erro');
        });
      });
    }

    function equiparItem(itemId) {
      const btn = $$(`.shop-item-btn.equip-btn[data-item-id="${itemId}"]`)[0];
      if (!btn) return;

      btn.classList.add('is-loading');
      btn.disabled = true;

      api(API_GAME, 'equipar', {
        method: 'POST',
        body: { itemId }
      }).then(res => {
        btn.classList.remove('is-loading');

        if (!res.ok) {
          window.toast('Não foi possível equipar o item.', 'erro');
          return;
        }

        window.toast('Item equipado com sucesso!', 'ok');
        carregarShop();
        atualizarNavbar();
      }).catch(() => {
        btn.classList.remove('is-loading');
        window.toast('Erro ao equipar item.', 'erro');
      });
    }

    function atualizarNavbar() {
      if (window.Navbar && typeof window.Navbar.atualizar === 'function') {
        window.Navbar.atualizar();
      }
    }

    window.ShopUI = {
      init: initShop,
      carregar: carregarShop
    };

    window.addEventListener('DOMContentLoaded', () => {
      window.ShopUI.init();
    });
})();