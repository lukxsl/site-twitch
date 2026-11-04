/* ============================================================
   NAVBAR DA COMUNIDADE — avatar, nome e acesso à conta
   ============================================================ */
(function(){
  'use strict';
  const $ = selector => document.querySelector(selector);
  function usuarioAtual(){
    try { return typeof USUARIO !== 'undefined' ? USUARIO : null; }
    catch (_) { return null; }
  }
  function criar(tag, classe, texto){
    const node = document.createElement(tag);
    if(classe) node.className = classe;
    if(texto !== undefined) node.textContent = texto;
    return node;
  }
  function render(){
    const area = $('#navUser');
    if(!area) return;
    area.replaceChildren();
    area.hidden = false;
    area.style.display = 'flex';
    const usuario = usuarioAtual();
    if(!usuario){
      const entrar = criar('button', 'nav-user-deslogado nav-auth-entrar', 'Entrar');
      entrar.type = 'button';
      entrar.setAttribute('aria-label', 'Entrar na comunidade');
      entrar.addEventListener('click', () => window.AuthUI?.open());
      area.append(entrar);
      return;
    }
    const nick = String(usuario.nick || usuario.username || 'Minha conta');
    const perfil = criar('button', 'nav-community-profile');
    perfil.type = 'button';
    perfil.title = 'Abrir meu perfil';
    perfil.setAttribute('aria-label', `Abrir o perfil de ${nick}`);
    perfil.addEventListener('click', () => {
      if(typeof window.mudarAba === 'function') window.mudarAba('perfil');
    });
    const avatar = criar('span', 'nav-community-avatar');
    const photo = usuario.avatar || usuario.picture || usuario.google?.picture || '';
    if(photo && /^(https:\/\/|\/)/i.test(String(photo))){
      const image = document.createElement('img');
      image.src = String(photo); image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
      image.onerror = () => { image.remove(); avatar.textContent = (nick[0] || '?').toUpperCase(); };
      avatar.append(image);
    } else avatar.textContent = (nick[0] || '?').toUpperCase();
    const nome = criar('span', 'nav-community-name', nick);
    perfil.append(avatar, nome);
    const sair = criar('button', 'nav-user-sair', 'Sair');
    sair.type = 'button'; sair.title = 'Sair da conta';
    sair.addEventListener('click', () => window.sair?.());
    area.append(perfil, sair);
  }
  window.Navbar = { render };
  window.addEventListener('soso:auth', render);
  window.addEventListener('soso:logout', render);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
