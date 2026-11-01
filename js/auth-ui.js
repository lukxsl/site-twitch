/* ============================================================
   AUTH UI — modal de login/cadastro (terminal do Arcade)
   Usa a API própria em /api/auth. Não guarda estado de jogo.
   ============================================================ */
(function(){
  'use strict';

  const RE_USUARIO = /^[a-z0-9_]{3,20}$/;
  const RE_NICK = /^[\p{L}\p{N}_. -]{3,24}$/u;
  const SENHA_MIN = 8;
  const SENHA_MAX = 72;

  const el = {};
  let construido = false;
  let abaAtual = 'entrar';
  let ultimoFoco = null;

  const focoVisivel = node => {
    if (!node || node.disabled || node.hidden) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
  };

  function focaveis(dialog){
    return Array.from(dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(focoVisivel);
  }

  function montarModal(){
    if (construido) return;
    construido = true;

    const dlg = document.createElement('dialog');
    dlg.id = 'authDlg';
    dlg.className = 'auth-dlg';
    dlg.setAttribute('aria-labelledby', 'authTitle');
    dlg.setAttribute('aria-describedby', 'authDesc');
    dlg.innerHTML = `
      <div class="auth-cabinet">
        <button type="button" class="auth-close" data-auth-close aria-label="Fechar">✕</button>
        <div class="auth-marquee" aria-hidden="true">
          <span class="auth-marquee-dot"></span>
          <span>SOSO ARCADE</span>
          <span class="auth-marquee-dot"></span>
        </div>
        <div class="auth-screen">
          <header class="auth-head">
            <p class="auth-kicker">&gt; ACESSO AO TERMINAL</p>
            <h2 id="authTitle">Entre no Arcade</h2>
            <p id="authDesc">Sua conta guarda XP, SosoCoins, conquistas e o seu boneco pixel art.</p>
          </header>

          <div class="auth-tabs" role="tablist" aria-label="Entrar ou criar conta">
            <button type="button" class="auth-tab on" data-auth-tab="entrar" role="tab" aria-selected="true" aria-controls="authFormLogin" id="authTabEntrar">ENTRAR</button>
            <button type="button" class="auth-tab" data-auth-tab="criar" role="tab" aria-selected="false" aria-controls="authFormRegister" id="authTabCriar">CRIAR CONTA</button>
          </div>

          <form class="auth-form on" id="authFormLogin" data-auth-form="login" novalidate aria-labelledby="authTabEntrar">
            <div class="auth-field">
              <label for="authLoginUsuario">Usuário</label>
              <input id="authLoginUsuario" name="usuario" type="text" inputmode="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="seu_usuario">
              <p class="auth-field-err" data-auth-err="login-usuario" role="alert"></p>
            </div>
            <div class="auth-field">
              <label for="authLoginSenha">Senha</label>
              <input id="authLoginSenha" name="senha" type="password" autocomplete="current-password" maxlength="72" placeholder="••••••••">
              <p class="auth-field-err" data-auth-err="login-senha" role="alert"></p>
            </div>
            <p class="auth-alert" data-auth-alert="login" role="alert"></p>
            <button type="submit" class="auth-submit">
              <span class="auth-submit-label">ENTRAR NO ARCADE</span>
              <span class="auth-submit-load" aria-hidden="true"></span>
            </button>
          </form>

          <form class="auth-form" id="authFormRegister" data-auth-form="registrar" novalidate aria-labelledby="authTabCriar" hidden>
            <div class="auth-field">
              <label for="authRegUsuario">Usuário</label>
              <input id="authRegUsuario" name="usuario" type="text" inputmode="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="soso_fa">
              <p class="auth-hint">3 a 20 caracteres: letras minúsculas, números e _</p>
              <p class="auth-field-err" data-auth-err="reg-usuario" role="alert"></p>
            </div>
            <div class="auth-field">
              <label for="authRegNick">Nick no Arcade</label>
              <input id="authRegNick" name="nick" type="text" autocomplete="nickname" maxlength="24" placeholder="Como quer ser chamado?">
              <p class="auth-hint">3 a 24 caracteres. Pode usar espaço, _ . -</p>
              <p class="auth-field-err" data-auth-err="reg-nick" role="alert"></p>
            </div>
            <div class="auth-field">
              <label for="authRegSenha">Senha</label>
              <input id="authRegSenha" name="senha" type="password" autocomplete="new-password" maxlength="72" placeholder="Mínimo de 8 caracteres">
              <div class="auth-meter" data-auth-meter aria-hidden="true">
                <i></i><i></i><i></i><i></i>
              </div>
              <p class="auth-meter-label" data-auth-meter-label>Força da senha</p>
              <p class="auth-field-err" data-auth-err="reg-senha" role="alert"></p>
            </div>
            <div class="auth-field">
              <label for="authRegSenha2">Confirmar senha</label>
              <input id="authRegSenha2" name="senha2" type="password" autocomplete="new-password" maxlength="72" placeholder="Repita a senha">
              <p class="auth-field-err" data-auth-err="reg-senha2" role="alert"></p>
            </div>
            <p class="auth-alert" data-auth-alert="register" role="alert"></p>
            <button type="submit" class="auth-submit">
              <span class="auth-submit-label">CRIAR MINHA CONTA</span>
              <span class="auth-submit-load" aria-hidden="true"></span>
            </button>
          </form>

          <div class="auth-divider"><span>ou</span></div>
          <a class="auth-discord" id="authDiscord" href="${API_AUTH}?action=discord-login">
            <span aria-hidden="true">💬</span>
            Entrar com Discord
          </a>
          <p class="auth-foot">Login Discord é opcional. A conta própria é a recomendada para o Arcade.</p>
        </div>
        <div class="auth-scan" aria-hidden="true"></div>
      </div>`;

    document.body.appendChild(dlg);
    el.dlg = dlg;
    el.forms = {
      login: dlg.querySelector('#authFormLogin'),
      registrar: dlg.querySelector('#authFormRegister')
    };
    el.tabs = Array.from(dlg.querySelectorAll('[data-auth-tab]'));

    dlg.querySelector('[data-auth-close]').addEventListener('click', fechar);
    dlg.addEventListener('cancel', e => { e.preventDefault(); fechar(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) fechar(); });
    dlg.addEventListener('keydown', trapFoco);

    el.tabs.forEach(tab => tab.addEventListener('click', () => trocarAba(tab.dataset.authTab)));

    el.forms.login.addEventListener('submit', e => enviar(e, 'login'));
    el.forms.registrar.addEventListener('submit', e => enviar(e, 'register'));

    ligarValidacao(el.forms.login);
    ligarValidacao(el.forms.registrar);

    const senha = dlg.querySelector('#authRegSenha');
    if (senha) senha.addEventListener('input', () => atualizarForca(senha.value));

    montarBoasVindas();
  }

  function montarBoasVindas(){
    const dlg = document.createElement('dialog');
    dlg.id = 'welcomeDlg';
    dlg.className = 'auth-dlg auth-welcome-dlg';
    dlg.setAttribute('aria-labelledby', 'welcomeTitle');
    dlg.innerHTML = `
      <div class="auth-cabinet">
        <button type="button" class="auth-close" data-welcome-close aria-label="Fechar">✕</button>
        <div class="auth-marquee" aria-hidden="true">
          <span class="auth-marquee-dot"></span>
          <span>CONTA CRIADA</span>
          <span class="auth-marquee-dot"></span>
        </div>
        <div class="auth-screen">
          <p class="auth-kicker">&gt; BOAS-VINDAS AO ARCADE</p>
          <h2 id="welcomeTitle">Bem-vindo(a), <span data-welcome-nick>jogador</span>!</h2>
          <p class="auth-welcome-intro">Seu cadastro já rendeu XP e SosoCoins. Agora é só montar seu boneco e começar a jogar.</p>
          <ul class="auth-welcome-list">
            <li><b>🎮 Monte seu boneco</b><span>Escolha corpo, cabelo, roupa, efeitos e molduras. O servidor valida cada peça.</span></li>
            <li><b>📺 Vincule sua Twitch</b><span>As horas assistidas são medidas pelo servidor e viram XP de verdade.</span></li>
            <li><b>💎 Complete conquistas</b><span>Vote, sugira, resgate códigos secretos e busque a Platina do Arcade.</span></li>
          </ul>
          <button type="button" class="auth-submit" data-welcome-go>MONTAR MEU BONECO →</button>
          <button type="button" class="auth-later" data-welcome-close>Agora não</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    el.welcome = dlg;
    dlg.querySelectorAll('[data-welcome-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    dlg.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
    dlg.addEventListener('keydown', trapFoco);
    dlg.querySelector('[data-welcome-go]').addEventListener('click', irParaCriador);
  }

  function irParaCriador(){
    if (el.welcome && el.welcome.open) el.welcome.close();
    if (typeof window.mudarAba === 'function') window.mudarAba('perfil');
    setTimeout(() => {
      const tab = document.querySelector('[data-pf-tab="boneco"]');
      if (tab) tab.click();
      const alvo = document.getElementById('pfOptions') || document.querySelector('#sec-perfil');
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
  }

  function mostrarBoasVindas(dados){
    if (!el.welcome) return;
    const nick = el.welcome.querySelector('[data-welcome-nick]');
    const nome = (dados && (dados.nick || dados.username)) || 'jogador';
    if (nick) nick.textContent = nome;
    el.welcome.showModal();
    setTimeout(() => {
      const b = el.welcome.querySelector('[data-welcome-go]');
      if (b) b.focus();
    }, 30);
  }

  function trapFoco(e){
    if (e.key !== 'Tab') return;
    const dlg = e.currentTarget;
    const lista = focaveis(dlg);
    if (!lista.length) return;
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    } else if (!dlg.contains(document.activeElement)) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  function trocarAba(nome){
    abaAtual = nome === 'criar' ? 'criar' : 'entrar';
    const qual = abaAtual === 'criar' ? 'registrar' : 'login';
    el.tabs.forEach(t => {
      const on = t.dataset.authTab === abaAtual;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    Object.entries(el.forms).forEach(([chave, form]) => {
      const on = chave === qual;
      form.classList.toggle('on', on);
      form.hidden = !on;
      if (on) limparAlerta(form);
    });
    const alvo = el.forms[qual].querySelector('input');
    if (alvo) setTimeout(() => alvo.focus(), 30);
  }

  function abrir(aba){
    montarModal();
    ultimoFoco = document.activeElement;
    trocarAba(aba || 'entrar');
    if (!el.dlg.open) el.dlg.showModal();
    document.body.classList.add('auth-lock');
    setTimeout(() => {
      const form = el.forms[abaAtual === 'criar' ? 'registrar' : 'login'];
      const input = form && form.querySelector('input');
      if (input) input.focus();
    }, 40);
  }

  function fechar(){
    if (!el.dlg || !el.dlg.open) return;
    el.dlg.close();
  }

  function ligarValidacao(form){
    form.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const erro = form.querySelector(`[data-auth-err="${erroId(form, input)}"]`);
        if (erro) erro.textContent = '';
        input.removeAttribute('aria-invalid');
        limparAlerta(form);
      });
      input.addEventListener('blur', () => validarCampo(form, input));
    });
  }

  function erroId(form, input){
    const tipo = form.dataset.authForm === 'login' ? 'login' : 'reg';
    return `${tipo}-${input.name === 'senha2' ? 'senha2' : input.name}`;
  }

  function mostrarErro(form, input, msg){
    const alvo = form.querySelector(`[data-auth-err="${erroId(form, input)}"]`);
    if (alvo) alvo.textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !msg;
  }

  function validarCampo(form, input){
    const tipo = form.dataset.authForm;
    const valor = String(input.value || '');
    let msg = '';

    if (input.name === 'usuario') {
      const u = valor.trim().toLowerCase();
      if (!u) msg = 'Informe seu usuário.';
      else if (tipo === 'registrar' && !RE_USUARIO.test(u)) msg = 'Use 3 a 20 caracteres: letras minúsculas, números e _.';
    }

    if (input.name === 'nick') {
      const n = valor.trim();
      if (!n) msg = 'Escolha um nick.';
      else if (!RE_NICK.test(n)) msg = 'Use 3 a 24 caracteres (letras, números, espaço, _ . -).';
    }

    if (input.name === 'senha') {
      if (!valor) msg = 'Informe sua senha.';
      else if (tipo === 'registrar' && (valor.length < SENHA_MIN || valor.length > SENHA_MAX)) {
        msg = `A senha precisa ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres.`;
      } else if (tipo === 'registrar') {
        const usuario = String(form.querySelector('[name="usuario"]').value || '').trim().toLowerCase();
        if (usuario && valor.toLowerCase().includes(usuario)) msg = 'A senha não pode conter o usuário.';
      }
    }

    if (input.name === 'senha2') {
      const senha = String(form.querySelector('[name="senha"]').value || '');
      if (!valor) msg = 'Confirme a senha.';
      else if (valor !== senha) msg = 'As senhas não conferem.';
    }

    return mostrarErro(form, input, msg);
  }

  function validarForm(form){
    const inputs = Array.from(form.querySelectorAll('input'));
    let primeiroRuim = null;
    inputs.forEach(input => {
      if (!validarCampo(form, input) && !primeiroRuim) primeiroRuim = input;
    });
    if (primeiroRuim) {
      primeiroRuim.focus();
      return false;
    }
    return true;
  }

  function limparAlerta(form){
    const alerta = form.querySelector('[data-auth-alert]');
    if (alerta) alerta.textContent = '';
  }

  function carregando(form, ativo){
    form.classList.toggle('is-loading', !!ativo);
    form.setAttribute('aria-busy', ativo ? 'true' : 'false');
    const btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = !!ativo;
    form.querySelectorAll('input').forEach(i => { i.readOnly = !!ativo; });
  }

  function atualizarForca(valor){
    const bits = [
      valor.length >= SENHA_MIN,
      valor.length >= 12,
      /[a-z]/.test(valor) && /[A-Z]/.test(valor),
      /\d/.test(valor),
      /[^A-Za-z0-9]/.test(valor)
    ];
    const score = Math.min(4, bits.filter(Boolean).length);
    const rotulos = ['Muito fraca', 'Fraca', 'Boa', 'Forte', 'Excelente'];
    const meter = el.dlg.querySelector('[data-auth-meter]');
    const label = el.dlg.querySelector('[data-auth-meter-label]');
    if (meter) meter.dataset.score = valor ? String(score) : '0';
    if (label) label.textContent = valor ? `Força da senha: ${rotulos[score]}` : 'Força da senha';
  }

  async function enviar(e, acao){
    e.preventDefault();
    const form = e.currentTarget;
    const alerta = form.querySelector('[data-auth-alert]');
    if (alerta) alerta.textContent = '';
    if (!validarForm(form)) return;

    const dados = Object.fromEntries(new FormData(form).entries());
    const corpo = acao === 'login'
      ? { usuario: String(dados.usuario || '').trim().toLowerCase(), senha: String(dados.senha || '') }
      : {
          usuario: String(dados.usuario || '').trim().toLowerCase(),
          nick: String(dados.nick || '').trim(),
          senha: String(dados.senha || '')
        };

    carregando(form, true);
    const res = await api(API_AUTH, acao, { method: 'POST', body: corpo });
    carregando(form, false);

    if (!res.ok) {
      const msg = (res.data && res.data.error) || 'Não foi possível concluir. Tente novamente.';
      if (alerta) {
        alerta.textContent = msg;
        alerta.classList.add('on');
      }
      const senha = form.querySelector('[name="senha"]');
      if (senha && res.status === 401) senha.focus();
      return;
    }

    const perfil = res.data || {};
    if (alerta) alerta.classList.remove('on');
    form.reset();
    if (acao === 'register') atualizarForca('');

    if (el.dlg.open) el.dlg.close();
    if (typeof window.checarLogin === 'function') {
      try { await window.checarLogin(); } catch (_) { /* checarLogin já trata */ }
    }
    window.dispatchEvent(new CustomEvent('soso:login', { detail: perfil }));

    const nome = perfil.nick || perfil.username || '';
    if (typeof window.toast === 'function') {
      window.toast(nome ? `Bem-vindo(a), ${nome}! 💜` : 'Login realizado! 💜', 'ok');
    }
    if (perfil.novo) mostrarBoasVindas(perfil);
  }

  function iniciar(){
    montarModal();
    document.body.classList.remove('auth-lock');
    el.dlg.addEventListener('close', () => {
      document.body.classList.remove('auth-lock');
      if (ultimoFoco && typeof ultimoFoco.focus === 'function') {
        setTimeout(() => { try { ultimoFoco.focus(); } catch (_) {} }, 10);
      }
    });

    let params = null;
    try { params = new URLSearchParams(location.search); } catch (_) {}
    if (params && params.get('entrar') === '1') {
      abrir('entrar');
      params.delete('entrar');
      const busca = params.toString();
      const nova = location.pathname + (busca ? '?' + busca : '') + (location.hash || '');
      try { history.replaceState(null, '', nova); } catch (_) {}
    }
  }

  window.AuthUI = { open: abrir, close: fechar, welcome: mostrarBoasVindas };

  window.addEventListener('soso:unauthorized', () => {
    if (!el.dlg || !el.dlg.open) abrir('entrar');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
