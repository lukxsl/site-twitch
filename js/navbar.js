/* ============================================================
   NAVBAR DO ARCADE
   Mini boneco, nível, SosoCoins e notificações.
   O perfil vem do servidor; o front só exibe o que recebe.
   ============================================================ */
(function(){
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const INTERVALO_PERFIL = 60000;

  let painelAtual = null;
  let sinoAtual = null;
  let erroPerfilAvisado = false;

  const ICONES = {
    conquista: '🏆',
    platina: '💎',
    nivel: '⭐',
    item: '🎨',
    ganho: '🪙',
    codigo: '🔐',
    streak: '🔥',
    twitch: '🔗'
  };

  function usuarioAtual(){
    try {
      if (typeof USUARIO !== 'undefined' && USUARIO) return USUARIO;
    } catch (_) { /* ignora */ }
    return null;
  }

  function estadoJogo(){
    return window.GameState || null;
  }

  function perfilAtual(){
    const estado = estadoJogo();
    return estado && estado.perfil ? estado.perfil : null;
  }

  function criar(tag, classe, texto){
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
  }

  function irParaPerfil(){
    if (typeof window.mudarAba === 'function') window.mudarAba('perfil');
    else location.hash = 'perfil';
  }

  function fecharPainel(focar){
    if (!painelAtual) return;
    painelAtual.hidden = true;
    if (sinoAtual) sinoAtual.setAttribute('aria-expanded', 'false');
    const sino = sinoAtual;
    painelAtual = null;
    sinoAtual = null;
    if (focar && sino) sino.focus();
  }

  function rotuloSino(total){
    if (!total) return 'Notificações, nenhuma nova';
    return `Notificações, ${total} ${total === 1 ? 'nova' : 'novas'}`;
  }

  function atualizarSino(sino, badge, total){
    if (total > 0) {
      badge.textContent = total > 9 ? '9+' : String(total);
      badge.hidden = false;
    } else {
      badge.textContent = '';
      badge.hidden = true;
    }
    sino.setAttribute('aria-label', rotuloSino(total));
  }

  function montarLista(perfil){
    const lista = criar('ul', 'nav-notif-list');
    const notificacoes = perfil && Array.isArray(perfil.notificacoes) ? perfil.notificacoes : [];

    if (!notificacoes.length) {
      const vazio = criar('li', 'nav-notif-empty');
      vazio.append(
        criar('span', 'nav-notif-empty-ic', '📭'),
        criar('b', '', 'Nada por aqui ainda'),
        criar('span', '', 'Jogue na live e resgate códigos para receber novidades.')
      );
      lista.appendChild(vazio);
      return lista;
    }

    notificacoes.forEach((n) => {
      const item = criar('li', 'nav-notif-item' + (n.nova ? ' is-new' : ''));
      const icone = criar('span', 'nav-notif-ic', (n.icone || ICONES[n.tipo] || '🔔'));
      icone.setAttribute('aria-hidden', 'true');

      const corpo = criar('div', 'nav-notif-body');
      corpo.appendChild(criar('p', 'nav-notif-text', String(n.texto || 'Nova notificação')));

      const quando = criar('time', 'nav-notif-time', typeof tempoAtras === 'function' ? tempoAtras(n.ts) : '');
      const data = new Date(n.ts);
      if (!isNaN(data.getTime())) quando.dateTime = data.toISOString();
      corpo.appendChild(quando);

      item.append(icone, corpo);
      lista.appendChild(item);
    });

    return lista;
  }

  async function marcarLidas(perfil, painel, sino, badge){
    if (!perfil || painel.dataset.lendo === '1') return;
    const novas = Array.isArray(perfil.notificacoes)
      ? perfil.notificacoes.filter((n) => n.nova).length
      : 0;
    if (!novas) return;

    painel.dataset.lendo = '1';
    const res = await api(API_GAME, 'notif-lidas', { method: 'POST' });
    delete painel.dataset.lendo;

    if (!res.ok) {
      painel.dataset.erroLeitura = '1';
      return;
    }

    if (perfil.notificacoes) {
      perfil.notificacoes = perfil.notificacoes.map((n) => ({ ...n, nova: false }));
    }
    painel.querySelectorAll('.is-new').forEach((el) => el.classList.remove('is-new'));
    atualizarSino(sino, badge, 0);
  }

  function montarPainel(perfil){
    const painel = criar('div', 'nav-notif-panel');
    painel.id = 'navNotifPanel';
    painel.hidden = true;
    painel.tabIndex = -1;
    painel.setAttribute('role', 'region');
    painel.setAttribute('aria-label', 'Notificações');

    const topo = criar('div', 'nav-notif-head');
    const titulo = criar('strong', '', 'Notificações');
    const fechar = criar('button', 'nav-notif-close', '✕');
    fechar.type = 'button';
    fechar.setAttribute('aria-label', 'Fechar notificações');
    topo.append(titulo, fechar);

    const rodape = criar('div', 'nav-notif-foot', 'Suas últimas notificações do Arcade.');

    painel.append(topo, montarLista(perfil), rodape);
    fechar.addEventListener('click', () => fecharPainel(true));
    return painel;
  }

  function montarDeslogado(area){
    const btn = criar('button', 'nav-user-deslogado nav-auth-entrar', 'ENTRAR');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Entrar no Arcade');
    btn.addEventListener('click', () => {
      if (window.AuthUI) window.AuthUI.open('entrar');
    });
    area.appendChild(btn);
  }

  function montarLogado(area, usuario){
    const perfil = perfilAtual();
    const nick = (perfil && perfil.nick) || usuario.nick || usuario.username || 'Jogador';
    const moedaNome = (perfil && perfil.moeda && perfil.moeda.nome) || 'SosoCoins';
    const moedaIcone = (perfil && perfil.moeda && perfil.moeda.simbolo) || '🪙';
    const notificacoes = perfil && Array.isArray(perfil.notificacoes) ? perfil.notificacoes : [];
    const novas = notificacoes.filter((n) => n.nova).length;

    const conjunto = criar('div', 'nav-arcade-user' + (!perfil ? ' is-loading' : ''));

    const perfilBtn = criar('button', 'nav-arcade-profile');
    perfilBtn.type = 'button';
    perfilBtn.setAttribute('aria-label', `Abrir o perfil de ${nick}`);
    perfilBtn.title = 'Abrir meu perfil';
    perfilBtn.addEventListener('click', irParaPerfil);

    const avatar = criar('span', 'nav-mini-avatar');
    let svg = null;
    if (window.PixelAvatar && typeof window.PixelAvatar.render === 'function' && perfil && perfil.boneco) {
      svg = window.PixelAvatar.render(perfil.boneco, { label: `Boneco de ${nick}`, mini: true, animar: false });
    }
    if (svg) avatar.appendChild(svg);
    else {
      avatar.classList.add('is-empty');
      avatar.textContent = '🎮';
      avatar.setAttribute('aria-hidden', 'true');
    }

    const info = criar('span', 'nav-mini-info');
    const nickEl = criar('span', 'nav-mini-nick', nick);
    nickEl.title = nick;
    const meta = criar('span', 'nav-mini-meta');
    const nivel = criar('span', 'nav-level', perfil ? `NV ${perfil.nivel}` : 'NV —');
    nivel.title = perfil ? `Nível ${perfil.nivel}` : 'Carregando nível';

    const coins = criar('span', 'nav-coins');
    const coinsIcone = criar('span', 'nav-coins-ic', moedaIcone);
    coinsIcone.setAttribute('aria-hidden', 'true');
    const coinsValor = criar('b', '', perfil ? Number(perfil.coins || 0).toLocaleString('pt-BR') : '—');
    coins.append(coinsIcone, coinsValor);
    coins.title = perfil ? `${moedaNome}: ${coinsValor.textContent}` : `Carregando ${moedaNome}`;

    meta.append(nivel, coins);
    info.append(nickEl, meta);
    perfilBtn.append(avatar, info);

    const sinoWrap = criar('div', 'nav-bell-wrap');
    const sino = criar('button', 'nav-bell');
    sino.type = 'button';
    sino.setAttribute('aria-expanded', 'false');
    sino.setAttribute('aria-controls', 'navNotifPanel');
    const sinoIcone = criar('span', 'nav-bell-ic', '🔔');
    sinoIcone.setAttribute('aria-hidden', 'true');
    const badge = criar('span', 'nav-bell-badge');
    badge.hidden = true;
    sino.append(sinoIcone, badge);
    atualizarSino(sino, badge, novas);

    const painel = montarPainel(perfil);
    sino.addEventListener('click', () => {
      if (!painel.hidden) {
        fecharPainel(true);
        return;
      }
      painel.hidden = false;
      sino.setAttribute('aria-expanded', 'true');
      painelAtual = painel;
      sinoAtual = sino;
      painel.focus({ preventScroll: true });
      marcarLidas(perfil, painel, sino, badge);
    });
    sinoWrap.append(sino, painel);

    const sairBtn = criar('button', 'nav-user-sair', 'Sair');
    sairBtn.type = 'button';
    sairBtn.title = 'Sair da conta';
    sairBtn.addEventListener('click', () => {
      if (typeof window.sair === 'function') window.sair();
    });

    conjunto.append(perfilBtn, sinoWrap, sairBtn);
    area.appendChild(conjunto);
  }

  function render(){
    const area = $('#navUser');
    if (!area) return;

    fecharPainel(false);
    area.innerHTML = '';
    area.hidden = false;
    area.style.display = 'flex';

    const usuario = usuarioAtual();
    if (!usuario) montarDeslogado(area);
    else montarLogado(area, usuario);
  }

  async function atualizar(){
    if (!usuarioAtual()) return null;
    const estado = estadoJogo();
    if (!estado) return null;
    return estado.carregarPerfil({ forcar: true });
  }

  function perfilEstaVelho(limite){
    const estado = estadoJogo();
    if (!estado) return false;
    return !estado.perfilTs || (Date.now() - estado.perfilTs) > limite;
  }

  function atualizarSePreciso(){
    if (document.hidden || !usuarioAtual() || !perfilEstaVelho(INTERVALO_PERFIL)) return;
    atualizar();
  }

  function iniciar(){
    render();

    const estado = estadoJogo();
    if (estado) {
      estado.on('perfil', render);
      estado.on('erro', (erro) => {
        if (!erro || erro.tipo !== 'perfil' || erroPerfilAvisado) return;
        erroPerfilAvisado = true;
        console.warn('[Navbar] não foi possível carregar o perfil:', erro.resposta);
      });
    }

    window.addEventListener('soso:auth', (evento) => {
      erroPerfilAvisado = false;
      const perfil = estado ? estado.perfil : null;
      const trocouConta = evento.detail && perfil && evento.detail.id && perfil.id &&
        String(evento.detail.id) !== String(perfil.id);

      if (estado && (!evento.detail || trocouConta)) estado.limpar();
      render();
      if (evento.detail && estado) estado.carregarPerfil({ forcar: true });
    });

    window.addEventListener('soso:logout', () => {
      const atual = estadoJogo();
      if (atual) atual.limpar();
      render();
    });

    window.addEventListener('soso:aba', (evento) => {
      if (evento.detail === 'perfil' && usuarioAtual()) atualizar();
    });

    window.addEventListener('focus', atualizarSePreciso);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) atualizarSePreciso();
    });

    document.addEventListener('click', (evento) => {
      if (!painelAtual || painelAtual.hidden) return;
      if (painelAtual.contains(evento.target)) return;
      if (sinoAtual && sinoAtual.contains(evento.target)) return;
      fecharPainel(false);
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape' || !painelAtual || painelAtual.hidden) return;
      fecharPainel(true);
    });

    setInterval(atualizarSePreciso, INTERVALO_PERFIL);
  }

  window.Navbar = { render, atualizar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
