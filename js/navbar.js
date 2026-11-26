/* ============================================================
   NAVEGAÇÃO — sidebar, chip de live, usuário e sheet mobile
   Expõe window.Navbar.render / setLive / setContador
   ============================================================ */
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  const COLLAPSE_KEY = 'soso:sidebar-colapsada';

  function usuarioAtual(){
    try{ return typeof USUARIO !== 'undefined' ? USUARIO : null; }
    catch(_){ return null; }
  }

  function criar(tag, classe, texto){
    const node = document.createElement(tag);
    if(classe) node.className = classe;
    if(texto !== undefined) node.textContent = texto;
    return node;
  }

  function blocoUsuario(area, compacto){
    if(!area) return;
    area.replaceChildren();
    const usuario = usuarioAtual();

    if(!usuario){
      const entrar = criar('button','btn btn-ghost side-entrar','Entrar');
      entrar.type = 'button';
      entrar.dataset.authOpen = '';
      entrar.setAttribute('aria-label','Entrar na comunidade');
      area.append(entrar);
      return;
    }

    const nick = String(usuario.nick || usuario.username || 'Minha conta');
    const perfil = criar('button','side-user');
    perfil.type = 'button';
    perfil.setAttribute('aria-label',`Abrir o perfil de ${nick}`);
    perfil.addEventListener('click', () => {
      if(typeof window.mudarAba === 'function') window.mudarAba('perfil');
    });

    const avatar = criar('span','side-avatar');
    const photo = usuario.avatar || usuario.picture || usuario.google?.picture || '';
    if(photo && /^(https:\/\/|\/)/i.test(String(photo))){
      const image = document.createElement('img');
      image.src = String(photo);
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => { image.remove(); avatar.textContent = (nick[0] || '?').toUpperCase(); };
      avatar.append(image);
    } else avatar.textContent = (nick[0] || '?').toUpperCase();

    const copy = criar('span','side-user-copy');
    copy.append(criar('b','',nick));
    if(!compacto) copy.append(criar('a','','ver perfil ↗'));
    const sair = criar('button','side-user-sair','Sair');
    sair.type = 'button';
    sair.title = 'Sair da conta';
    sair.setAttribute('aria-label','Sair da conta');
    sair.addEventListener('click', () => window.sair?.());
    perfil.append(avatar,copy);
    area.append(perfil,sair);
  }

  function render(){
    blocoUsuario($('#sideUser'), false);
    blocoUsuario($('#moreUser'), true);
    document.body.classList.toggle('sou-admin', !!(usuarioAtual() && usuarioAtual().admin));
  }

  function setLive(isLive, info){
    const live = !!isLive;
    const viewers = info && info.viewers != null ? Number(info.viewers).toLocaleString('pt-BR') : null;
    const ultima = info && info.ultima ? String(info.ultima) : '';
    document.querySelectorAll('[data-live-chip]').forEach(chip => {
      chip.classList.toggle('is-live', live);
      chip.title = live ? 'Soso ao vivo — ir para o player' : 'Soso offline — ir para o canal';
      const texto = chip.querySelector('[data-live-text]');
      if(texto) texto.textContent = live ? 'AO VIVO' : 'OFFLINE';
      const count = chip.querySelector('[data-live-count]');
      if(count) count.textContent = live && viewers != null ? viewers : '';
      const detalhe = chip.querySelector('[data-live-detail]');
      if(detalhe) detalhe.textContent = live
        ? (info && info.jogo ? `jogando ${info.jogo}` : 'assistindo agora')
        : (ultima ? `última live ${ultima}` : 'volte logo 💜');
    });
  }

  function setupCollapse(){
    const btn = $('#sideCollapse');
    if(!btn) return;
    let salvo = false;
    try{ salvo = localStorage.getItem(COLLAPSE_KEY) === '1'; }catch(e){}
    document.body.classList.toggle('sidebar-collapsed', salvo);
    btn.setAttribute('aria-expanded', salvo ? 'false' : 'true');
    btn.addEventListener('click', () => {
      const colapsada = document.body.classList.toggle('sidebar-collapsed');
      btn.setAttribute('aria-expanded', colapsada ? 'false' : 'true');
      try{ localStorage.setItem(COLLAPSE_KEY, colapsada ? '1' : '0'); }catch(e){}
    });
  }

  function setupMore(){
    const btn = $('#moreBtn');
    const sheet = $('#mobileMoreSheet');
    if(!btn || !sheet) return;
    btn.addEventListener('click', () => sheet.showModal());
    sheet.addEventListener('click', e => { if(e.target === sheet) sheet.close(); });
    sheet.querySelector('[data-sheet-close]')?.addEventListener('click', () => sheet.close());
  }

  function setupLiveChips(){
    document.querySelectorAll('[data-live-chip]').forEach(chip => {
      chip.addEventListener('click', () => {
        if(typeof window.mudarAba === 'function') window.mudarAba('inicio');
        requestAnimationFrame(() => {
          const cam = document.getElementById('camCard');
          if(cam && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
            cam.scrollIntoView({ behavior:'smooth', block:'center' });
          }
        });
      });
    });
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-auth-open]');
    if(btn){ e.preventDefault(); window.AuthUI?.open?.(); }
  });

  window.Navbar = { render, setLive, setContador: (n) => setLive(!!n, { viewers:n }) };
  window.addEventListener('soso:auth', render);
  window.addEventListener('soso:logout', render);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => {
    setupCollapse(); setupMore(); setupLiveChips(); render();
  });
  else { setupCollapse(); setupMore(); setupLiveChips(); render(); }
})();
