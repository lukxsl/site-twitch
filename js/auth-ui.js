/* ============================================================
   AUTH UI — Google como acesso principal; login local legado mantido
   ============================================================ */
(function(){
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  let dialog = null, welcome = null, lastFocus = null;
  const focaveis = root => Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el => !el.hidden && el.offsetParent !== null);

  function trapFocus(e){
    if(e.key !== 'Tab') return;
    const list = focaveis(e.currentTarget); if(!list.length) return;
    const first = list[0], last = list[list.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
  function mountWelcome(){
    if(welcome) return;
    welcome = document.createElement('dialog'); welcome.id='welcomeDlg'; welcome.className='auth-dlg auth-welcome-dlg';
    welcome.innerHTML = `<div class="auth-cabinet"><button type="button" class="auth-close" data-close aria-label="Fechar">✕</button><div class="auth-marquee"><span class="auth-marquee-dot"></span><span>CONTA CRIADA</span><span class="auth-marquee-dot"></span></div><div class="auth-screen"><p class="auth-kicker">&gt; BOAS-VINDAS AO ARCADE</p><h2>Bem-vindo(a), <span data-nick>jogador</span>!</h2><p class="auth-welcome-intro">Seu perfil já está ativo. Agora monte seu personagem e comece a construir sua história no cantinho da Soso.</p><ul class="auth-welcome-list"><li><b>🕹️ Monte seu boneco</b><span>Escolha cabelo, roupa, acessórios, efeitos e animações.</span></li><li><b>📺 Vincule sua Twitch</b><span>Registre presença nas lives e aumente sua sequência.</span></li><li><b>💜 Colecione conquistas</b><span>Ganhe XP e SosoCoins participando da comunidade.</span></li></ul><button type="button" class="auth-submit" data-go>PERSONALIZAR MEU BONECO →</button><button type="button" class="auth-later" data-close>Agora não</button></div></div>`;
    document.body.appendChild(welcome);
    welcome.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>welcome.close()));
    welcome.querySelector('[data-go]').addEventListener('click',goAvatar);
    welcome.addEventListener('cancel',e=>{e.preventDefault();welcome.close();});
  }
  function goAvatar(){
    if(welcome?.open) welcome.close();
    if(typeof window.mudarAba==='function') window.mudarAba('perfil');
    setTimeout(()=>{ document.querySelector('[data-pf-tab="boneco"]')?.click(); document.getElementById('pfOptions')?.scrollIntoView({behavior:'smooth',block:'start'}); },180);
  }
  function showWelcome(data){
    mountWelcome(); const nick=welcome.querySelector('[data-nick]');
    if(nick) nick.textContent=(data && (data.nick||data.username))||'jogador';
    welcome.showModal();
  }
  function mount(){
    if(dialog) return;
    dialog=document.createElement('dialog'); dialog.id='authDlg'; dialog.className='auth-dlg';
    dialog.setAttribute('aria-labelledby','authTitle');
    dialog.innerHTML=`<div class="auth-cabinet"><button type="button" class="auth-close" data-close aria-label="Fechar">✕</button><div class="auth-marquee"><span class="auth-marquee-dot"></span><span>SOSO ARCADE</span><span class="auth-marquee-dot"></span></div><div class="auth-screen"><header class="auth-head"><p class="auth-kicker">&gt; PORTAL DO JOGADOR</p><h2 id="authTitle">Entre no cantinho</h2><p>Sua conta reúne personagem, XP, SosoCoins, conquistas e presença nas lives.</p></header><a class="auth-google" href="/api/auth?action=google-login"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44z"/><path fill="#EA4335" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6z"/><path fill="#4285F4" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12z"/></svg><span><b>Continuar com Google</b><small>Cria sua conta automaticamente no primeiro acesso</small></span><span class="auth-google-arrow">→</span></a><div class="auth-divider"><span>ACESSO SEGURO</span></div><p class="auth-google-note">Sem senha nova para decorar. Usamos seu e-mail Google verificado para proteger seu progresso.</p><details class="auth-legacy"><summary>Já tenho uma conta antiga (usuário e senha)</summary><form id="authLegacyForm" class="auth-form" novalidate><div class="auth-field"><label for="authLegacyUser">Usuário</label><input id="authLegacyUser" name="usuario" autocomplete="username" autocapitalize="none" maxlength="20" placeholder="seu_usuario" required></div><div class="auth-field"><label for="authLegacyPass">Senha</label><input id="authLegacyPass" name="senha" type="password" autocomplete="current-password" maxlength="72" placeholder="Sua senha" required></div><p class="auth-alert" id="authLegacyAlert" role="alert"></p><button type="submit" class="auth-submit"><span class="auth-submit-label">ENTRAR COM CONTA ANTIGA</span><span class="auth-submit-load" aria-hidden="true"></span></button></form></details><p class="auth-foot">Ao continuar, você concorda em usar o Arcade com respeito à comunidade. Discord não é necessário para entrar.</p></div><div class="auth-scan" aria-hidden="true"></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-close]').addEventListener('click',close);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
    dialog.addEventListener('keydown',trapFocus);
    dialog.querySelector('#authLegacyForm').addEventListener('submit',loginLegacy);
    mountWelcome();
  }
  function open(){
    mount(); lastFocus=document.activeElement;
    if(!dialog.open) dialog.showModal();
    document.body.classList.add('auth-lock');
  }
  function close(){ if(dialog?.open) dialog.close(); }
  async function loginLegacy(e){
    e.preventDefault(); const form=e.currentTarget, alert=$('#authLegacyAlert');
    const usuario=String(form.usuario.value||'').trim().toLowerCase(), senha=String(form.senha.value||'');
    if(!/^[a-z0-9_]{3,20}$/.test(usuario)){alert.textContent='Informe um usuário válido.';return;}
    if(!senha){alert.textContent='Informe sua senha.';return;}
    form.classList.add('is-loading'); const res=await api(API_AUTH,'login',{method:'POST',body:{usuario,senha}}); form.classList.remove('is-loading');
    if(!res.ok){alert.textContent=res.data?.error||'Não foi possível entrar. Confira os dados.';return;}
    alert.textContent=''; form.reset(); close();
    try{await window.checarLogin?.();}catch(_){}
    window.dispatchEvent(new CustomEvent('soso:login',{detail:res.data}));
    window.toast?.(`Bem-vindo(a), ${res.data?.nick||'jogador'}! 💜`,'ok');
  }
  function handleReturn(){
    const params=new URLSearchParams(location.search);
    if(params.get('entrar')==='1') open();
    if(params.get('login')==='ok'){
      const novo=params.get('novo')==='1';
      const vinculado=params.get('vinculado')==='1';
      setTimeout(async()=>{
        try{await window.checarLogin?.();}catch(_){}
        if(novo){ const u=typeof USUARIO!=='undefined'?USUARIO:null; showWelcome(u); }
        else if(vinculado) window.toast?.('Google vinculado à sua conta. Seu progresso foi preservado!','ok');
        else window.toast?.('Login realizado com sucesso. 💜','ok');
      },80);
    } else if(params.get('login') && params.get('login')!=='ok'){
      setTimeout(()=>window.toast?.('Não foi possível concluir o acesso Google. Tente novamente.','erro'),80);
    }
    const twitchChannel = params.get('twitch-channel');
    if (twitchChannel) {
      const messages = {
        ok: ['Autorização da Twitch concluída. O token foi salvo com segurança no servidor.', 'ok'],
        cancelado: ['A autorização da Twitch foi cancelada. Nenhuma alteração foi feita.', 'info'],
        'conta-errada': ['A conta Twitch autorizada não é @asemtet0. Abra o link com a conta correta.', 'erro'],
        erro: ['Não foi possível concluir a autorização da Twitch. Gere um novo link no Diagnóstico DEV.', 'erro'],
        expirado: ['Este link de autorização expirou ou já foi usado. Gere um novo no Diagnóstico DEV.', 'erro']
      };
      const [message, type] = messages[twitchChannel] || ['Retorno da Twitch recebido.', 'info'];
      setTimeout(() => window.toast?.(message, type), 120);
      params.delete('twitch-channel');
    }
    const twitchPlayer = params.get('twitch');
    if (twitchPlayer) {
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
    if(['entrar','login','novo','vinculado'].some(k=>params.has(k))){
      ['entrar','login','novo','vinculado'].forEach(k=>params.delete(k));
    }
    if(twitchChannel || twitchPlayer || ['entrar','login','novo','vinculado'].some(k=>new URLSearchParams(location.search).has(k))){
      const q=params.toString(); history.replaceState(null,'',location.pathname+(q?'?'+q:'')+(location.hash||''));
    }
  }
  window.AuthUI={open,close,welcome:showWelcome};
  window.addEventListener('soso:unauthorized',()=>open());
  window.addEventListener('DOMContentLoaded',()=>{
    mount(); dialog.addEventListener('close',()=>{document.body.classList.remove('auth-lock'); if(lastFocus?.focus) setTimeout(()=>lastFocus.focus(),10);});
    handleReturn();
  });
})();