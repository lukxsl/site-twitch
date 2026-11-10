/* ============================================================
   PERFIL DA COMUNIDADE — identidade, presença e configurações
   (E-mail, Google ou Twitch — sem contas legadas)
   ============================================================ */
(function(){
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let usuario = null;
  let atividade = null;
  let carregando = false;

  const ROTULO_METODO = {
    email: 'E-mail e senha',
    google: 'Google',
    twitch: 'Twitch'
  };

  function numero(value){ return (Number(value) || 0).toLocaleString('pt-BR'); }
  function tempo(minutos){
    const total = Math.max(0, Math.floor(Number(minutos) || 0));
    const horas = Math.floor(total / 60), resto = total % 60;
    if(!horas) return `${resto} min`;
    return resto ? `${horas}h ${resto}min` : `${horas}h`;
  }
  function avisar(mensagem, tipo = 'ok'){
    if(typeof window.toast === 'function') window.toast(mensagem, tipo);
    else console.info(mensagem);
  }
  function setText(id, value){ const node = document.getElementById(id); if(node) node.textContent = value ?? '—'; }
  function mascararEmail(email){
    const valor = String(email || '').trim();
    if(!valor || valor === 'Não informado') return valor || '—';
    const [usuario, dominio] = valor.split('@');
    if(!dominio) return valor.slice(0, 3) + '••••';
    return (usuario.slice(0, 2) || '•') + '••••@' + dominio;
  }
  function mascararId(id){
    const valor = String(id || '').trim();
    if(!valor || valor === '—') return '—';
    return valor.length <= 6 ? valor.slice(0, 2) + '••••' : valor.slice(0, 4) + '••••' + valor.slice(-2);
  }
  function aplicarSegredo(id, valor, mascarado){
    const node = document.getElementById(id); if(!node) return;
    node.dataset.real = String(valor ?? '—');
    node.dataset.masked = mascarado;
    node.textContent = mascarado;
    const btn = document.querySelector(`.pf-reveal[data-reveal="${id}"]`);
    if(btn){ btn.textContent = 'Mostrar'; btn.setAttribute('aria-pressed', 'false'); }
  }
  function setStatus(message, error = false){
    const el = $('#pfProfileStatus');
    if(el){ el.textContent = message; el.classList.toggle('is-error', !!error); }
  }
  function selectPanel(name){
    const selected = name === 'settings' ? 'settings' : 'overview';
    $$('[data-pf-tab]').forEach(button => {
      const active = button.dataset.pfTab === selected;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('[data-pf-panel]').forEach(panel => {
      const active = panel.dataset.pfPanel === selected;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
  }

  function metodoLogin(){
    if(!usuario) return 'email';
    if(usuario.metodoLogin && ROTULO_METODO[usuario.metodoLogin]) return usuario.metodoLogin;
    if(usuario.twitch) return 'twitch';
    if(usuario.google) return 'google';
    return 'email';
  }

  function render(data){
    if(!data) return;
    usuario = data.usuario || usuario;
    atividade = data.atividade || atividade || {};
    if(!usuario) return;
    const nick = String(usuario.nick || usuario.username || 'Pessoa da comunidade');
    const email = usuario.email || 'Não informado';
    const metodo = metodoLogin();
    const rotulo = ROTULO_METODO[metodo] || 'E-mail e senha';
    const avatar = usuario.avatar || usuario.google?.picture || '';
    setText('pfBannerNome', `@${nick.replace(/^@/, '')}`);
    setText('pfNickLarge', nick);
    setText('pfBannerStatus', usuario.twitch?.login ? `Twitch conectada · @${usuario.twitch.login}` : 'Seu espaço por aqui, com a Soso');
    setText('pfProfileMethod', rotulo);
    setText('pfLivesCount', numero(atividade.lives));
    setText('pfWatchHoursCount', tempo(atividade.minutes));
    setText('pfVotesCount', numero(atividade.votes));
    setText('pfSuggestionsCount', numero(atividade.suggestions));
    const economia = data.economia || {};
    setText('pfCoinsCount', numero(economia.coins));
    setText('pfXpCount', `${numero(economia.xp)} XP`);
    setText('pfLevelCount', numero(economia.nivel || 1));
    setText('pfSettingsNick', nick);
    aplicarSegredo('pfSettingsEmail', email, mascararEmail(email));
    setText('pfSettingsAccount', rotulo);
    aplicarSegredo('pfSettingsPlayerId', usuario.id || '—', mascararId(usuario.id));
    [['pfLivesCount', atividade.lives], ['pfWatchHoursCount', atividade.minutes], ['pfVotesCount', atividade.votes],
     ['pfSuggestionsCount', atividade.suggestions], ['pfCoinsCount', economia.coins], ['pfXpCount', economia.xp]]
      .forEach(([id, valor]) => {
        const card = document.getElementById(id)?.closest('.community-stat-card');
        if(card) card.hidden = !(Number(valor) > 0);
      });
    const nickInput = $('#pfSettingsNick');
    if(nickInput) nickInput.value = nick;
    const avatarContainer = $('#pfAvatar');
    if(avatarContainer){
      avatarContainer.replaceChildren();
      if(avatar){
        const image = document.createElement('img');
        image.src = avatar; image.alt = `Foto de ${nick}`; image.referrerPolicy = 'no-referrer';
        image.onerror = () => { avatarContainer.textContent = nick[0]?.toUpperCase() || '?'; };
        avatarContainer.append(image);
      } else avatarContainer.textContent = nick[0]?.toUpperCase() || '?';
    }
    const twitch = $('#pfTwitchStatus');
    const linked = !!usuario.twitch;
    if(twitch){
      twitch.textContent = linked ? `Conectada: @${usuario.twitch.login || usuario.twitch.nome || 'Twitch'}` : 'Twitch não vinculada';
      twitch.classList.toggle('is-connected', linked);
    }
    const link = $('#pfTwitchLink'), unlink = $('#pfTwitchUnlink');
    if(link) link.hidden = linked;
    if(unlink) unlink.hidden = !linked;
    const googleLink = $('#pfGoogleLink');
    if(googleLink) googleLink.hidden = metodo === 'google' || !!usuario.google;
    const devTools = $('#pfDevTools');
    if(devTools) devTools.hidden = String(usuario.cargo || '').toLowerCase() !== 'dev';
    const signedOut = $('#pfSignInPrompt');
    const signedIn = $('#pfSignedInContent');
    if(signedOut) signedOut.hidden = true;
    if(signedIn) signedIn.hidden = false;
    setStatus('Dados da conta atualizados.');
  }

  async function carregar(){
    if(carregando) return;
    const atual = (typeof USUARIO !== 'undefined') ? USUARIO : null;
    if(!atual){
      usuario = null; atividade = null;
      const signedOut = $('#pfSignInPrompt'), signedIn = $('#pfSignedInContent');
      if(signedOut) signedOut.hidden = false;
      if(signedIn) signedIn.hidden = true;
      setStatus('Entre para consultar seu perfil.');
      return;
    }
    carregando = true;
    setStatus('Atualizando suas informações…');
    try{
      const response = await window.api('/api/auth', 'activity-profile');
      if(!response.ok) throw new Error(response.data?.error || 'Não foi possível carregar seu perfil.');
      render(response.data);
    } catch(error){ setStatus(error.message || 'Falha ao carregar o perfil.', true); }
    finally { carregando = false; }
  }

  async function salvarNick(){
    const input = $('#pfSettingsNick');
    const nick = String(input?.value || '').trim();
    if(nick.length < 3 || nick.length > 24){ avisar('O nome deve ter de 3 a 24 caracteres.', 'erro'); return; }
    const button = $('#pfSaveNick'); if(button) button.disabled = true;
    const response = await window.api('/api/auth', 'change-nick', { method: 'POST', body: { nick } });
    if(button) button.disabled = false;
    if(!response.ok){ avisar(response.data?.error || 'Não foi possível salvar o nome.', 'erro'); return; }
    avisar('Nome atualizado com sucesso.');
    await window.checarLogin?.();
    await carregar();
  }

  async function desvincularTwitch(){
    const ok = typeof window.confirmar === 'function'
      ? await window.confirmar('Desvincular Twitch?', 'Sua conta continuará funcionando, mas a presença e as horas futuras não poderão ser associadas até vincular novamente.', '📺')
      : window.confirm('Desvincular Twitch?');
    if(!ok) return;
    const response = await window.api('/api/auth', 'twitch-unlink', { method: 'POST', body: {} });
    if(!response.ok){ avisar(response.data?.error || 'Não foi possível desvincular.', 'erro'); return; }
    await window.checarLogin?.(); await carregar(); avisar('Twitch desvinculada.');
  }

  async function gerarLinkBroadcaster(){
    const response = await window.api('/api/auth', 'twitch-broadcaster-link', { method: 'POST', body: {} });
    if(!response.ok){ avisar(response.data?.error || 'Não foi possível gerar o link.', 'erro'); return; }
    if(response.data?.url) location.href = response.data.url;
  }

  function bind(){
    $$('[data-pf-tab]').forEach(button => button.addEventListener('click', () => selectPanel(button.dataset.pfTab)));
    $('#pfSaveNick')?.addEventListener('click', salvarNick);
    $('#pfTwitchLink')?.addEventListener('click', () => { location.href = '/api/auth?action=twitch-link'; });
    $('#pfTwitchUnlink')?.addEventListener('click', desvincularTwitch);
    $('#pfSettingsLogout')?.addEventListener('click', () => window.sair?.());
    $$('.pf-reveal').forEach(button => button.addEventListener('click', () => {
      const node = document.getElementById(button.dataset.reveal);
      if(!node) return;
      const mostrando = button.getAttribute('aria-pressed') === 'true';
      node.textContent = mostrando ? (node.dataset.masked || '••••') : (node.dataset.real || '—');
      button.textContent = mostrando ? 'Mostrar' : 'Ocultar';
      button.setAttribute('aria-pressed', String(!mostrando));
    }));
    $('#pfCopyPlayerId')?.addEventListener('click', async () => {
      const id = usuario?.id || '';
      if(!id) return;
      try { await navigator.clipboard.writeText(id); avisar('ID copiado.'); }
      catch (_) { avisar('Não foi possível copiar automaticamente.', 'erro'); }
    });
    $('#pfOpenGlobalRanking')?.addEventListener('click', () => window.mudarAba?.('ranking'));
    $('#pfProfileLogin')?.addEventListener('click', () => window.AuthUI?.open());
    $('#pfBroadcasterLink')?.addEventListener('click', gerarLinkBroadcaster);
    $('#pfReloadProfile')?.addEventListener('click', carregar);
    window.addEventListener('soso:auth', carregar);
    window.addEventListener('soso:login', carregar);
    window.addEventListener('soso:logout', () => { usuario = null; atividade = null; carregar(); });
    window.addEventListener('soso:aba', event => { if(event.detail === 'perfil') carregar(); });
  }

  window.ProfileSummary = { carregar, render, get usuario(){ return usuario; }, get atividade(){ return atividade; } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { bind(); carregar(); });
  else { bind(); carregar(); }
})();
