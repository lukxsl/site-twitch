/* ============================================================
   AUTENTICAÇÃO — página de login (e-mail, Google e Twitch)
   + navbar da comunidade (avatar / entrar / sair)
   ============================================================ */
(function(){
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  let welcome = null, loginPage = null, lastFocus = null, mode = 'login';

  const focaveis = root => Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el => !el.hidden && el.offsetParent !== null);

  /* ================== boas-vindas ================== */
  function mountWelcome(){
    if(welcome) return;
    welcome = document.createElement('dialog');
    welcome.id = 'welcomeDlg';
    welcome.className = 'auth-dlg auth-welcome-dlg';
    welcome.innerHTML = `
      <div class="auth-shell">
        <button type="button" class="auth-close" data-close aria-label="Fechar">×</button>
        <div class="auth-brandline"><span class="auth-brand-symbol">S</span><span>SEU CANTINHO</span></div>
        <div class="auth-content">
          <span class="auth-eyebrow">ACESSO CONFIRMADO</span>
          <h2>Bem-vinda(o), <span data-nick>pessoa</span>!</h2>
          <p class="auth-intro">Sua conta está pronta. Agora você pode participar das votações, enviar sugestões e acompanhar sua presença nas lives.</p>
          <div class="auth-welcome-steps">
            <div><span>01</span><b>Complete seu perfil</b><small>Escolha como quer aparecer na comunidade.</small></div>
            <div><span>02</span><b>Conecte sua Twitch</b><small>Registre suas horas e presença no chat.</small></div>
            <div><span>03</span><b>Participe</b><small>Vote, envie ideias e acompanhe as novidades.</small></div>
          </div>
          <button type="button" class="auth-primary" data-go>Abrir meu perfil <span class="auth-submit-arrow">↗</span></button>
          <button type="button" class="auth-text-button" data-close>Agora não</button>
        </div>
      </div>`;
    document.body.appendChild(welcome);
    welcome.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => welcome.close()));
    welcome.querySelector('[data-go]').addEventListener('click', goProfile);
    welcome.addEventListener('cancel', event => { event.preventDefault(); welcome.close(); });
  }

  function goProfile(){
    if(welcome?.open) welcome.close();
    if(typeof window.mudarAba === 'function') window.mudarAba('perfil');
    setTimeout(() => document.getElementById('sec-perfil')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
  }

  function showWelcome(data){
    mountWelcome();
    const nick = welcome.querySelector('[data-nick]');
    if(nick) nick.textContent = (data && (data.nick || data.username)) || 'pessoa';
    if(!welcome.open) welcome.showModal();
  }

  /* ================== página de login ================== */
  function mostrarSenha(visivel){
    const campo = $('#loginPassword', loginPage);
    const botao = $('#loginPassToggle', loginPage);
    if(!campo || !botao) return;
    campo.type = visivel ? 'text' : 'password';
    botao.setAttribute('aria-pressed', String(!!visivel));
    botao.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
    const texto = botao.querySelector('span');
    if(texto) texto.textContent = visivel ? 'Ocultar' : 'Mostrar';
  }

  function setMode(next){
    mode = next === 'register' ? 'register' : 'login';
    if(!loginPage) return;
    const isRegister = mode === 'register';
    const nickField = $('#loginNickField', loginPage);
    const identifier = $('#loginEmail', loginPage);
    const password = $('#loginPassword', loginPage);
    const title = $('#loginTitle', loginPage);
    const subtitle = $('#loginSubtitle', loginPage);
    const submit = $('#loginSubmitLabel', loginPage);
    const trocar = $('#loginSwitchBtn', loginPage);
    const trocarNota = $('#loginSwitchNote', loginPage);
    const alerta = $('#loginAlert', loginPage);
    if(nickField) nickField.hidden = !isRegister;
    if(identifier){
      identifier.placeholder = 'voce@email.com';
      identifier.autocomplete = isRegister ? 'email' : 'username';
    }
    if(password) password.autocomplete = isRegister ? 'new-password' : 'current-password';
    if(title) title.textContent = isRegister ? 'Criar conta' : 'Entrar';
    if(subtitle) subtitle.textContent = isRegister
      ? 'Escolha um nome, seu e-mail e uma senha para participar da comunidade.'
      : 'Acesse seu perfil para votar e interagir.';
    if(submit) submit.textContent = isRegister ? 'Criar minha conta' : 'Entrar';
    if(trocar){
      trocar.dataset.authMode = isRegister ? 'login' : 'register';
      trocar.textContent = isRegister ? 'Entrar' : 'Criar conta';
      trocar.setAttribute('aria-pressed', 'false');
    }
    if(trocarNota) trocarNota.textContent = isRegister ? 'Já tem uma conta?' : 'Primeira vez por aqui?';
    mostrarSenha(false);
    if(alerta) alerta.textContent = '';
  }

  function trapFocus(event){
    if(event.key === 'Escape'){
      event.preventDefault();
      close();
      return;
    }
    if(event.key !== 'Tab') return;
    const list = focaveis(loginPage);
    if(!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  }

  function mountLoginPage(){
    loginPage = document.getElementById('login');
    if(!loginPage || loginPage.dataset.bound === '1') return Boolean(loginPage);
    loginPage.dataset.bound = '1';
    $('#loginClose', loginPage)?.addEventListener('click', close);
    $('#loginPassToggle', loginPage)?.addEventListener('click', () => {
      mostrarSenha($('#loginPassword', loginPage)?.type === 'password');
    });
    $('#loginEmailForm', loginPage)?.addEventListener('submit', submitEmail);
    $('#loginSwitchBtn', loginPage)?.addEventListener('click', event => {
      setMode(event.currentTarget.dataset.authMode === 'register' ? 'register' : 'login');
      const alvo = mode === 'register' ? $('#loginNick', loginPage) : $('#loginEmail', loginPage);
      setTimeout(() => alvo?.focus(), 40);
    });
    loginPage.addEventListener('keydown', trapFocus);
    return true;
  }

  function open(nextMode){
    if(!mountLoginPage()) return;
    if(nextMode) setMode(nextMode);
    lastFocus = document.activeElement;
    loginPage.hidden = false;
    document.body.classList.add('login-lock');
    loginPage.scrollTop = 0;
    setTimeout(() => {
      const alvo = mode === 'register' ? $('#loginNick', loginPage) : $('#loginEmail', loginPage);
      alvo?.focus();
    }, 60);
  }

  function close(){
    if(!loginPage || loginPage.hidden) return;
    loginPage.hidden = true;
    document.body.classList.remove('login-lock');
    if(lastFocus?.focus) setTimeout(() => lastFocus.focus(), 0);
  }

  async function submitEmail(event){
    event.preventDefault();
    const form = event.currentTarget;
    const identifierField = form.elements.namedItem('identificador');
    const passwordField = form.elements.namedItem('senha');
    const nickField = form.elements.namedItem('nick');
    const identifier = String(identifierField?.value || '').trim().toLowerCase();
    const senha = String(passwordField?.value || '');
    const alerta = $('#loginAlert', loginPage);
    const submit = $('#loginSubmit', loginPage);
    if(alerta) alerta.textContent = '';
    if(!identifier){ if(alerta) alerta.textContent = 'Informe seu e-mail.'; return; }
    if(!senha){ if(alerta) alerta.textContent = 'Informe sua senha.'; return; }
    if(mode === 'register'){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)){ if(alerta) alerta.textContent = 'Informe um e-mail válido.'; return; }
      const nick = String(nickField?.value || '').trim();
      if(nick.length < 3 || nick.length > 24){ if(alerta) alerta.textContent = 'Seu nome deve ter de 3 a 24 caracteres.'; return; }
      if(senha.length < 8){ if(alerta) alerta.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
    }
    if(submit) submit.disabled = true;
    const result = mode === 'register'
      ? await api('/api/auth', 'register', { method: 'POST', body: { email: identifier, senha, nick: String(nickField?.value || '').trim() } })
      : await api('/api/auth', 'login', { method: 'POST', body: { email: identifier, usuario: identifier, senha } });
    if(submit) submit.disabled = false;
    if(!result.ok){
      if(alerta) alerta.textContent = result.data?.error || 'Não foi possível acessar. Confira os dados e tente novamente.';
      return;
    }
    form.reset();
    mostrarSenha(false);
    close();
    try { await window.checarLogin?.(); } catch(_) {}
    window.dispatchEvent(new CustomEvent('soso:login', { detail: result.data }));
    if(result.data?.novo) showWelcome(result.data);
    else window.toast?.(`Bem-vinda(o), ${result.data?.nick || 'pessoa'}! 💜`, 'ok');
  }

  /* ================== retorno do OAuth ================== */
  function handleReturn(){
    const params = new URLSearchParams(location.search);
    const login = params.get('login');
    if(params.get('entrar') === '1') open('login');
    if(login === 'ok'){
      close();
      const novo = params.get('novo') === '1';
      const provider = params.get('provider') || '';
      setTimeout(async () => {
        try { await window.checarLogin?.(); } catch(_) {}
        if(novo){ const user = typeof USUARIO !== 'undefined' ? USUARIO : null; showWelcome(user); }
        else window.toast?.(provider === 'twitch' ? 'Login pela Twitch realizado com sucesso. 💜' : 'Login realizado com sucesso. 💜', 'ok');
      }, 80);
    } else if(login && login !== 'ok'){
      const mensagens = {
        'twitch-erro': 'Não foi possível concluir o login pela Twitch. Tente novamente.',
        'twitch-config': 'O login pela Twitch ainda não está configurado no servidor.',
        'twitch-em-uso': 'Esta conta Twitch já está vinculada a outro perfil.',
        'twitch-cancelado': 'O login pela Twitch foi cancelado.',
        'cancelado': 'O acesso foi cancelado.',
        'erro-google': 'Não foi possível concluir o acesso Google.',
        'email-nao-verificado': 'O Google não retornou um e-mail verificado.'
      };
      setTimeout(() => window.toast?.(mensagens[login] || 'Não foi possível concluir o acesso. Tente novamente.', 'erro'), 80);
    }

    const twitchChannel = params.get('twitch-channel');
    if(twitchChannel){
      const messages = {
        ok: ['Autorização da Twitch concluída. O acesso do canal foi salvo com segurança.', 'ok'],
        cancelado: ['A autorização da Twitch foi cancelada. Nenhuma alteração foi feita.', 'info'],
        'conta-errada': ['A conta autorizada não é a conta da streamer. Entre na Twitch correta e tente novamente.', 'erro'],
        erro: ['Não foi possível concluir a autorização da Twitch. Gere um link novo nas configurações DEV.', 'erro'],
        expirado: ['Este link expirou ou já foi usado. Gere um novo nas configurações DEV.', 'erro']
      };
      const [message, type] = messages[twitchChannel] || ['Retorno da Twitch recebido.', 'info'];
      setTimeout(() => window.toast?.(message, type), 120);
      params.delete('twitch-channel');
    }

    const twitchPlayer = params.get('twitch');
    if(twitchPlayer){
      const messages = {
        ok: ['Sua conta Twitch foi vinculada ao perfil.', 'ok'],
        cancelado: ['A vinculação da Twitch foi cancelada.', 'info'],
        erro: ['Não foi possível vincular sua Twitch. Tente novamente.', 'erro'],
        'em-uso': ['Esta conta Twitch já está vinculada a outro perfil.', 'erro']
      };
      const [message, type] = messages[twitchPlayer] || ['Não foi possível concluir a vinculação Twitch.', 'erro'];
      setTimeout(() => window.toast?.(message, type), 120);
      params.delete('twitch');
    }

    ['entrar','login','novo','vinculado','provider'].forEach(key => params.delete(key));
    if(login || twitchChannel || twitchPlayer){
      const query = params.toString();
      history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + (location.hash || ''));
    }
  }

  /* ================== navbar ================== */
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
  function renderNavbar(){
    const area = document.querySelector('#navUser');
    if(!area) return;
    area.replaceChildren();
    area.hidden = false;
    area.style.display = 'flex';
    const usuario = usuarioAtual();
    if(!usuario){
      const entrar = criar('button', 'nav-auth-entrar', 'Entrar');
      entrar.type = 'button';
      entrar.setAttribute('aria-label', 'Entrar na comunidade');
      entrar.addEventListener('click', () => open('login'));
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

  window.AuthUI = { open, close, welcome: showWelcome };
  window.Navbar = { render: renderNavbar };
  window.addEventListener('soso:unauthorized', () => open('login'));
  window.addEventListener('soso:auth', renderNavbar);
  window.addEventListener('soso:logout', renderNavbar);

  window.addEventListener('DOMContentLoaded', () => {
    mountLoginPage();
    setMode('login');
    handleReturn();
    renderNavbar();
  });
})();
