/* ============================================================
   ROUTER — hash real, pushState, voltar/avançar, CSS sob demanda
   Mantém window.mudarAba e o evento soso:aba.
   ============================================================ */
(function(){
  'use strict';

  const ABAS_VALIDAS = ['inicio','tierlist','ranking','comunidade','setup','sugestoes','perfil','admin'];
  const CSS_POR_ABA = {
    tierlist:'css/tier.css',
    ranking:'css/ranking.css',
    comunidade:'css/community.css',
    setup:'css/setup.css',
    perfil:'css/profile.css',
    admin:'css/admin.css'
  };
  const META = {
    inicio:     ['asemtet0 | Streamer & Comunidade','Oie! Eu sou a Soso (asemtet0). Games, caos e conversa no QG do canal.'],
    tierlist:   ['Tier list | asemtet0','Tier list de jogos, filmes e animes da Soso.'],
    ranking:    ['Ranking | asemtet0','Horas assistidas, pontos, chat, doadores e músicas do cantinho.'],
    comunidade: ['Comunidade | asemtet0','Discord, clipes, playlist, benefícios de Sub e regras do cantinho.'],
    setup:      ['Setup | asemtet0','Catálogo do setup da Soso com especificações e onde encontrar.'],
    sugestoes:  ['Sugestões | asemtet0','Vote no próximo jogo e mande sua ideia pra Soso.'],
    perfil:     ['Meu perfil | asemtet0','Sua presença, estatísticas e configurações na comunidade.'],
    admin:      ['Painel admin | asemtet0','Painel administrativo do site da Soso.']
  };
  const REDUZ = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const cssCarregado = Object.create(null);
  let abaAtual = null;

  function rotaDoHash(){
    const bruto = String(location.hash || '').replace(/^#/, '');
    const base = bruto.split('/')[0];
    return ABAS_VALIDAS.includes(base) ? base : 'inicio';
  }

  function carregarCss(aba){
    const href = CSS_POR_ABA[aba];
    if(!href || cssCarregado[href]) return;
    cssCarregado[href] = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onerror = () => { delete cssCarregado[href]; console.warn('[router] falha ao carregar', href); };
    document.head.appendChild(link);
  }

  function atualizarMeta(aba){
    const [titulo, descricao] = META[aba] || META.inicio;
    document.title = titulo;
    const desc = document.querySelector('meta[name="description"]');
    if(desc) desc.setAttribute('content', descricao);
    const canonical = document.querySelector('link[rel="canonical"]');
    if(canonical) canonical.href = 'https://asemtet0.vercel.app/' + (aba === 'inicio' ? '' : '#' + aba);
  }

  function atualizarNavegacao(aba){
    document.querySelectorAll('[data-route]').forEach(link => {
      const ativo = link.dataset.route === aba;
      if(ativo) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('.page-section').forEach(s => s.classList.toggle('ativo', s.id === 'sec-' + aba));
  }

  function carregarAdmin(){
    if(typeof window.garantirAdminCarregado !== 'function') return;
    window.garantirAdminCarregado()
      .then(() => { if(typeof window.carregarAdmin === 'function') window.carregarAdmin(); })
      .catch(err => {
        console.error('[admin] erro ao carregar:', err);
        const area = document.getElementById('adminArea');
        if(area) area.textContent = 'Não foi possível carregar o painel. Recarregue a página.';
      });
  }

  function aplicar(aba, foco = true){
    if(!ABAS_VALIDAS.includes(aba)) aba = 'inicio';
    carregarCss(aba);
    atualizarMeta(aba);
    atualizarNavegacao(aba);

    if(aba === 'admin'){
      const bruto = String(location.hash || '').replace(/^#/, '');
      if(bruto.startsWith('admin/')){
        const pagina = bruto.slice(6);
        if(typeof VALID_ADMIN_PAGES !== 'undefined' && VALID_ADMIN_PAGES.includes(pagina)){
          window.ADMIN_PAGE = pagina;
        }
      }
    }
    abaAtual = aba;
    window.dispatchEvent(new CustomEvent('soso:aba', { detail: aba }));

    window.scrollTo({ top:0, behavior: REDUZ ? 'instant' : 'auto' });
    if(foco){
      const sec = document.getElementById('sec-' + aba);
      const h1 = sec && sec.querySelector('h1');
      if(h1){
        if(!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex','-1');
        h1.focus({ preventScroll:true });
      }
    }
    if(aba === 'admin') carregarAdmin();
  }

  function mudarAba(nome, salvar = true){
    const bruto = String(nome || 'inicio').replace(/^#/, '');
    const aba = rotaValida(bruto);
    if(salvar){
      const destino = aba === 'admin' && bruto.startsWith('admin/') ? bruto : aba;
      if(location.hash !== '#' + destino){
        try{ history.pushState({ aba }, '', '#' + destino); }catch(e){}
      }
    }
    aplicar(aba, true);
  }

  function rotaValida(bruto){
    const base = String(bruto || '').split('/')[0];
    return ABAS_VALIDAS.includes(base) ? base : 'inicio';
  }

  function sincronizar(){
    const aba = rotaDoHash();
    if(aba !== abaAtual) aplicar(aba, true);
  }

  window.mudarAba = mudarAba;
  window.__router = { ABAS_VALIDAS, aplicar, rotaAtual: () => abaAtual, carregarCss };

  document.addEventListener('click', e => {
    if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if(!link) return;
    const hash = link.getAttribute('href');
    if(hash.length < 2) return;
    const aba = rotaValida(hash.slice(1));
    if(!ABAS_VALIDAS.includes(aba) && hash !== '#admin') return;
    e.preventDefault();
    mudarAba(hash.slice(1), true);
    const sheet = document.getElementById('mobileMoreSheet');
    if(sheet && sheet.open) sheet.close();
  });

  window.addEventListener('hashchange', sincronizar);
  window.addEventListener('popstate', sincronizar);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => aplicar(rotaDoHash(), false));
  else aplicar(rotaDoHash(), false);
})();
