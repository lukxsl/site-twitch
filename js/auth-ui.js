/* ============================================================
   AUTENTICAÇÃO — modal de acesso (e-mail, Google e Twitch)
   + navbar da comunidade (avatar / entrar / sair)
   ============================================================ */
(function(){
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  let dialog = null, welcome = null, lastFocus = null, mode = 'login';

  const ICONE_GOOGLE = `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.5Z"/><path fill="currentColor" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" opacity=".75"/><path fill="currentColor" d="M6.4 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.9L6.4 14Z" opacity=".55"/><path fill="currentColor" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 3.1 7.6L6.4 10A5.9 5.9 0 0 1 12 6.1Z" opacity=".9"/></svg>`;
  const ICONE_TWITCH = `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M4.3 2 2 6.2v13.6h4.7V22h2.6l2.3-2.2h3.7L21 15V2H4.3Zm14.6 12.2-2.8 2.7h-4.2l-2 2v-2H6.7V4.2h12.2v10ZM11.9 7h1.9v5.2h-1.9V7Zm5 0H19v5.2h-2.1V7Z"/></svg>`;
  const ICONE_OLHO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c-5 0-9.1 4.1-10.6 6.4a1.1 1.1 0 0 0 0 1.2C2.9 14.9 7 19 12 19s9.1-4.1 10.6-6.4a1.1 1.1 0 0 0 0-1.2C21.1 9.1 17 5 12 5Zm0 11.8a4.8 4.8 0 1 1 0-9.6 4.8 4.8 0 0 1 0 9.6Zm0-2.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>`;

  const focaveis = root => Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el => !el.hidden && el.offsetParent !== null);

  function trapFocus(event){
    if(event.key !== 'Tab') return;
    const list = focaveis(event.currentTarget);
    if(!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  }

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

  /* ================== modal de acesso ================== */
  // Mostra/oculta a senha (botão "Mostrar" dentro do input)
  function mostrarSenha(visivel){
    const campo = $('#authPassword', dialog);
    const botao = $('#authPassToggle', dialog);
    if(!campo || !botao) return;
    campo.type = visivel ? 'text' : 'password';
    botao.setAttribute('aria-pressed', String(!!visivel));
    botao.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
    const texto = botao.querySelector('span');
    if(texto) texto.textContent = visivel ? 'Ocultar' : 'Mostrar';
  }

  function setMode(next){
    mode = next === 'register' ? 'register' : 'login';
    if(!dialog) return;
    const isRegister = mode === 'register';
    dialog.querySelectorAll('[data-auth-mode]').forEach(button => {
      const active = button.dataset.authMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const nickField = $('#authNickField', dialog);
    const identifierLabel = $('#authIdentifierLabel', dialog);
    const identifier = $('#authIdentifier', dialog);
    const title = $('#authTitle', dialog);
    const subtitle = $('#authSubtitle', dialog);
    const submit = $('#authSubmitLabel', dialog);
    const password = $('#authPassword', dialog);
    const trocar = $('#authSwitchBtn', dialog);
    const trocarNota = $('#authSwitchNote', dialog);
    if(nickField) nickField.hidden = !isRegister;
    if(identifierLabel) identifierLabel.textContent = 'E-mail';
    if(identifier){
      identifier.placeholder = 'voce@email.com';
      identifier.autocomplete = isRegister ? 'email' : 'username';
      identifier.type = 'email';
    }
    if(password) password.autocomplete = isRegister ? 'new-password' : 'current-password';
    if(title) title.textContent = isRegister ? 'Criar conta' : 'Entrar';
    if(subtitle) subtitle.textContent = isRegister
      ? 'Escolha um nome, seu e-mail e uma senha para participar da comunidade.'
      : 'Acesse seu perfil para votar e interagir.';
    if(submit) submit.textContent = isRegister ? 'Criar minha conta' : 'Entrar';
    if(trocar){
      trocar.dataset.authMode = isRegister ? 'login' : 'register';
      trocar.textContent = isRegister ? 'Já tenho conta' : 'Criar conta';
      trocar.setAttribute('aria-pressed', 'false');
    }
    if(trocarNota) trocarNota.textContent = isRegister ? 'Já tem uma conta?' : 'Primeira vez por aqui?';
    mostrarSenha(false);
    const alerta = $('#authAlert', dialog);
    if(alerta) alerta.textContent = '';
  }

  function mount(){
    if(dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'authDlg';
    dialog.className = 'auth-dlg';
    dialog.setAttribute('aria-labelledby', 'authTitle');
    dialog.innerHTML = `
      <div class="auth-shell">
        <span class="auth-aurora" aria-hidden="true"></span>
        <button type="button" class="auth-close" data-close aria-label="Fechar">×</button>
        <div class="auth-brandline"><span class="auth-brand-symbol">S</span><span>ASEMTET0 <i>·</i> COMUNIDADE</span></div>
        <div class="auth-content">
          <h2 id="authTitle">Entrar</h2>
          <p class="auth-intro" id="authSubtitle">Acesse seu perfil para votar e interagir.</p>

          <div class="auth-providers">
            <a class="auth-provider google" href="/api/auth?action=google-login">
              <span class="auth-provider-icon">${ICONE_GOOGLE}</span><span>Google</span>
            </a>
            <a class="auth-provider twitch" href="/api/auth?action=twitch-login">
              <span class="auth-provider-icon">${ICONE_TWITCH}</span><span>Twitch</span>
            </a>
          </div>

          <div class="auth-sep"><span>ou</span></div>

          <form id="authEmailForm" class="auth-form" novalidate>
            <div class="auth-field" id="authNickField" hidden>
              <label for="authNick">Como quer aparecer?</label>
              <input id="authNick" name="nick" maxlength="24" autocomplete="nickname" placeholder="Seu nome na comunidade">
            </div>
            <div class="auth-field">
              <label id="authIdentifierLabel" for="authIdentifier">E-mail</label>
              <input id="authIdentifier" name="identificador" type="email" maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="voce@email.com" required>
            </div>
            <div class="auth-field">
              <label for="authPassword">Senha</label>
              <div class="auth-pass">
                <input id="authPassword" name="senha" type="password" autocomplete="current-password" maxlength="72" placeholder="Sua senha" required>
                <button type="button" class="auth-pass-btn" id="authPassToggle" aria-controls="authPassword" aria-pressed="false" aria-label="Mostrar senha">
                  ${ICONE_OLHO}<span>Mostrar</span>
                </button>
              </div>
            </div>
            <p class="auth-alert" id="authAlert" role="alert" aria-live="polite"></p>
            <button type="submit" class="auth-primary" id="authSubmit"><span id="authSubmitLabel">Entrar</span><span class="auth-submit-arrow">→</span></button>
          </form>

          <p class="auth-switch"><span id="authSwitchNote">Primeira vez por aqui?</span> <button type="button" id="authSwitchBtn" data-auth-mode="register" aria-pressed="false">Criar conta</button></p>
          <p class="auth-legal">Ao entrar, você concorda em respeitar as pessoas e as regras desta comunidade. 💜</p>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => { if(event.target === dialog) close(); });
    dialog.addEventListener('keydown', trapFocus);
    dialog.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
    $('#authPassToggle', dialog).addEventListener('click', () => mostrarSenha($('#authPassword', dialog)?.type === 'password'));
    $('#authEmailForm', dialog).addEventListener('submit', submitEmail);
    mountWelcome();
    setMode('login');
  }

  function open(){
    mount();
    lastFocus = document.activeElement;
    if(!dialog.open) dialog.showModal();
    document.body.classList.add('auth-lock');
    setTimeout(() => $('#authIdentifier', dialog)?.focus(), 50);
  }

  function close(){ if(dialog?.open) dialog.close(); }

  async function submitEmail(event){
    event.preventDefault();
    const form = event.currentTarget;
    const identifier = String(form.identificador.value || '').trim().toLowerCase();
    const senha = String(form.senha.value || '');
    const alerta = $('#authAlert', dialog);
    const submit = $('#authSubmit', dialog);
    if(alerta) alerta.textContent = '';
    if(!identifier){ if(alerta) alerta.textContent = 'Informe seu e-mail.'; return; }
    if(!senha){ if(alerta) alerta.textContent = 'Informe sua senha.'; return; }
    if(mode === 'register'){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)){ if(alerta) alerta.textContent = 'Informe um e-mail válido.'; return; }
      const nick = String(form.nick.value || '').trim();
      if(nick.length < 3 || nick.length > 24){ if(alerta) alerta.textContent = 'Seu nome deve ter de 3 a 24 caracteres.'; return; }
      if(senha.length < 8){ if(alerta) alerta.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
    }
    submit.disabled = true;
    const result = mode === 'register'
      ? await api('/api/auth', 'register', { method: 'POST', body: { email: identifier, senha, nick: String(form.nick.value || '').trim() } })
      : await api('/api/auth', 'login', { method: 'POST', body: { email: identifier, usuario: identifier, senha } });
    submit.disabled = false;
    if(!result.ok){ if(alerta) alerta.textContent = result.data?.error || 'Não foi possível acessar. Confira os dados e tente novamente.'; return; }
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
    if(params.get('entrar') === '1') open();
    if(login === 'ok'){
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
      entrar.addEventListener('click', () => open());
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
  window.addEventListener('soso:unauthorized', () => open());
  window.addEventListener('soso:auth', renderNavbar);
  window.addEventListener('soso:logout', renderNavbar);

  window.addEventListener('DOMContentLoaded', () => {
    mount();
    dialog.addEventListener('close', () => {
      document.body.classList.remove('auth-lock');
      if(lastFocus?.focus) setTimeout(() => lastFocus.focus(), 0);
    });
    handleReturn();
    renderNavbar();
  });
})();
