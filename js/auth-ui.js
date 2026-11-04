/* ============================================================
   AUTENTICAÇÃO — Twitch + e-mail, com compatibilidade para contas antigas.
   ============================================================ */
(function(){
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  let dialog = null, welcome = null, lastFocus = null, mode = 'login';

  const focaveis = root => Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el => !el.hidden && el.offsetParent !== null);

  function trapFocus(event){
    if(event.key !== 'Tab') return;
    const list = focaveis(event.currentTarget);
    if(!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  }

  function mountWelcome(){
    if(welcome) return;
    welcome = document.createElement('dialog');
    welcome.id = 'welcomeDlg';
    welcome.className = 'auth-dlg auth-welcome-dlg';
    welcome.innerHTML = `
      <div class="auth-shell auth-welcome-shell">
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
          <button type="button" class="auth-primary" data-go>Abrir meu perfil <span>↗</span></button>
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
    welcome.showModal();
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
    const note = $('#authModeNote', dialog);
    const password = $('#authPassword', dialog);
    nickField.hidden = !isRegister;
    identifierLabel.textContent = isRegister ? 'Seu e-mail' : 'E-mail ou usuário antigo';
    identifier.placeholder = isRegister ? 'voce@email.com' : 'voce@email.com ou seu_usuario';
    identifier.autocomplete = isRegister ? 'email' : 'username';
    identifier.type = isRegister ? 'email' : 'text';
    if(password) password.autocomplete = isRegister ? 'new-password' : 'current-password';
    title.textContent = isRegister ? 'Crie sua conta' : 'Entre no cantinho';
    subtitle.textContent = isRegister
      ? 'Use seu e-mail e crie uma senha para participar da comunidade.'
      : 'Acesse seu perfil, participe das votações e acompanhe as lives.';
    submit.textContent = isRegister ? 'Criar minha conta' : 'Entrar com e-mail';
    note.textContent = isRegister
      ? 'A senha deve ter de 8 a 72 caracteres. Guarde-a em um local seguro.'
      : 'Contas antigas também podem entrar usando o usuário e a senha já cadastrados.';
    $('#authAlert', dialog).textContent = '';
  }

  function mount(){
    if(dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'authDlg';
    dialog.className = 'auth-dlg';
    dialog.setAttribute('aria-labelledby', 'authTitle');
    dialog.innerHTML = `
      <div class="auth-shell">
        <button type="button" class="auth-close" data-close aria-label="Fechar">×</button>
        <div class="auth-brandline"><span class="auth-brand-symbol">S</span><span>ASEMTET0 <i>·</i> COMUNIDADE</span></div>
        <div class="auth-content">
          <span class="auth-eyebrow">SEU ESPAÇO NA COMUNIDADE</span>
          <h2 id="authTitle">Entre no cantinho</h2>
          <p class="auth-intro" id="authSubtitle">Acesse seu perfil, participe das votações e acompanhe as lives.</p>

          <a class="auth-twitch-button" href="/api/auth?action=twitch-login">
            <span class="auth-twitch-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M4.2 2 2.9 5.3v14.1h4.7V22h2.7l2.6-2.6h3.8l4.7-4.7V2H4.2Zm15.5 11.8-2.8 2.8h-4.7l-2.6 2.6v-2.6H5.5V3.9h14.2v9.9ZM16.9 6.7h-1.9v5.7h1.9V6.7Zm-5.1 0H9.9v5.7h1.9V6.7Z"/></svg></span>
            <span><b>Continuar com Twitch</b><small>Entre com sua conta da Twitch</small></span>
            <span class="auth-arrow" aria-hidden="true">↗</span>
          </a>

          <div class="auth-separator"><span>OU USE SEU E-MAIL</span></div>
          <div class="auth-mode-tabs" role="group" aria-label="Tipo de acesso">
            <button type="button" data-auth-mode="login" class="is-active" aria-pressed="true">Entrar</button>
            <button type="button" data-auth-mode="register" aria-pressed="false">Criar conta</button>
          </div>
          <form id="authEmailForm" class="auth-form" novalidate>
            <div class="auth-field" id="authNickField" hidden>
              <label for="authNick">Como quer aparecer?</label>
              <input id="authNick" name="nick" maxlength="24" autocomplete="nickname" placeholder="Seu nome na comunidade">
            </div>
            <div class="auth-field">
              <label id="authIdentifierLabel" for="authIdentifier">E-mail ou usuário antigo</label>
              <input id="authIdentifier" name="identificador" maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="voce@email.com ou seu_usuario" required>
            </div>
            <div class="auth-field">
              <label for="authPassword">Senha</label>
              <input id="authPassword" name="senha" type="password" autocomplete="current-password" maxlength="72" placeholder="Sua senha" required>
            </div>
            <p class="auth-alert" id="authAlert" role="alert" aria-live="polite"></p>
            <button type="submit" class="auth-primary" id="authSubmit"><span id="authSubmitLabel">Entrar com e-mail</span><span class="auth-submit-arrow">→</span></button>
            <p class="auth-mode-note" id="authModeNote">Contas antigas também podem entrar usando o usuário e a senha já cadastrados.</p>
          </form>

          <a class="auth-google-link" href="/api/auth?action=google-login">Já usava Google? Continuar com Google</a>
          <p class="auth-legal">Ao entrar, você concorda em respeitar as pessoas e as regras desta comunidade. 💜</p>
        </div>
        <div class="auth-bottom-line"><span>ASEMTET0</span><span>UM CANTINHO FEITO COM 💜</span></div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => { if(event.target === dialog) close(); });
    dialog.addEventListener('keydown', trapFocus);
    dialog.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
    dialog.querySelector('#authEmailForm').addEventListener('submit', submitEmail);
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
    const identifier = String(form.identificador.value || '').trim();
    const senha = String(form.senha.value || '');
    const alerta = $('#authAlert', dialog);
    const submit = $('#authSubmit', dialog);
    alerta.textContent = '';
    if(!identifier){ alerta.textContent = 'Informe seu e-mail ou usuário.'; return; }
    if(!senha){ alerta.textContent = 'Informe sua senha.'; return; }
    if(mode === 'register'){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)){ alerta.textContent = 'Informe um e-mail válido.'; return; }
      const nick = String(form.nick.value || '').trim();
      if(nick.length < 3 || nick.length > 24){ alerta.textContent = 'Seu nome deve ter de 3 a 24 caracteres.'; return; }
      if(senha.length < 8){ alerta.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
    }
    submit.disabled = true;
    submit.classList.add('is-loading');
    const result = mode === 'register'
      ? await api('/api/auth', 'register', { method: 'POST', body: { email: identifier, senha, nick: String(form.nick.value || '').trim() } })
      : await api('/api/auth', 'login', { method: 'POST', body: { usuario: identifier, senha } });
    submit.disabled = false;
    submit.classList.remove('is-loading');
    if(!result.ok){ alerta.textContent = result.data?.error || 'Não foi possível acessar. Confira os dados e tente novamente.'; return; }
    form.reset();
    close();
    try { await window.checarLogin?.(); } catch(_) {}
    window.dispatchEvent(new CustomEvent('soso:login', { detail: result.data }));
    if(result.data?.novo) showWelcome(result.data);
    else window.toast?.(`Bem-vinda(o), ${result.data?.nick || 'pessoa'}! 💜`, 'ok');
  }

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
    if(login || twitchChannel || twitchPlayer || new URLSearchParams(location.search).has('entrar')){
      const query = params.toString();
      history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + (location.hash || ''));
    }
  }

  window.AuthUI = { open, close, welcome: showWelcome };
  window.addEventListener('soso:unauthorized', open);
  window.addEventListener('DOMContentLoaded', () => {
    mount();
    dialog.addEventListener('close', () => {
      document.body.classList.remove('auth-lock');
      if(lastFocus?.focus) setTimeout(() => lastFocus.focus(), 0);
    });
    handleReturn();
  });
})();
