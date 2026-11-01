/* ============================================================
   PERFIL UI — componente principal do perfil com as novas abas
   ============================================================ */
(function() {
  'use strict';

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

  function initPerfil() {
    const tabs = $$('[data-pf-tab]');
    const paineis = $$('[data-pf-panel]');
    if (!tabs.length || !paineis.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const alvo = tab.dataset.pfTab;
        tabs.forEach(t => {
          const ativo = t === tab;
          t.classList.toggle('on', ativo);
          t.setAttribute('aria-selected', ativo ? 'true' : 'false');
          t.tabIndex = ativo ? 0 : -1;
        });
        paineis.forEach(p => {
          const ativo = p.dataset.pfPanel === alvo;
          p.classList.toggle('on', ativo);
          p.hidden = !ativo;
        });

        if (tab.dataset.pfTab === 'visao-geral' && window.PerfilUI) {
          window.PerfilUI.carregarVisaoGeral();
        }
        if (tab.dataset.pfTab === 'inventario' && window.PerfilUI) {
          window.PerfilUI.carregarInventario();
        }
        if (tab.dataset.pfTab === 'conquistas' && window.PerfilUI) {
          window.PerfilUI.carregarConquistas();
        }
        if (tab.dataset.pfTab === 'configuracoes' && window.PerfilUI) {
          window.PerfilUI.carregarConfiguracoes();
        }
      });
    });

    tabs.forEach((tab, indice) => {
      tab.tabIndex = tab.classList.contains('on') ? 0 : -1;
      tab.addEventListener('keydown', evento => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
        evento.preventDefault();
        let proximo = indice;
        if (evento.key === 'ArrowLeft') proximo = (indice - 1 + tabs.length) % tabs.length;
        if (evento.key === 'ArrowRight') proximo = (indice + 1) % tabs.length;
        if (evento.key === 'Home') proximo = 0;
        if (evento.key === 'End') proximo = tabs.length - 1;
        tabs[proximo].focus();
        tabs[proximo].click();
      });
    });

    const visaoGeralTab = $('[data-pf-tab="visao-geral"]');
    if (visaoGeralTab && window.PerfilUI) visaoGeralTab.click();
  }

  function initPerfilInterativo() {
    if (!window.GameState) return;

    const atualizarPerfil = () => {
      window.GameState.carregarPerfil({ forcar: true }).then(perfil => {
        if (perfil) {
          window.PerfilUI.perfilAtual = perfil;
          if ($('[data-pf-tab="visao-geral"]')[0].classList.contains('on')) {
            window.PerfilUI.carregarVisaoGeral();
          }
          if ($('[data-pf-tab="inventario"]')[0].classList.contains('on')) {
            window.PerfilUI.carregarInventario();
          }
          if ($('[data-pf-tab="conquistas"]')[0].classList.contains('on')) {
            window.PerfilUI.carregarConquistas();
          }
          if ($('[data-pf-tab="configuracoes"]')[0].classList.contains('on')) {
            window.PerfilUI.carregarConfiguracoes();
          }
        }
      });
    };

    window.GameState.on('perfil', () => atualizarPerfil());

    window.PerfilUI.perfilAtual = window.GameState.perfil;
  }

  window.PerfilUI = { init: initPerfil, initInterativo: initPerfilInterativo };
  window.addEventListener('DOMContentLoaded', () => {
    window.PerfilUI.init();
    window.PerfilUI.initInterativo();
  });
})();