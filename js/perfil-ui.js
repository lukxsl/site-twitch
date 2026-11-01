/* ============================================================
   PERFIL UI — visão geral, inventário, loja, conquistas, ranking e ajustes
   ============================================================ */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const SLOT_NAMES={base:'Corpo',pele:'Pele',rosto:'Expressão',cabelo:'Cabelo',cabeloCor:'Cor do cabelo',roupa:'Roupa',roupaCor:'Cor da roupa',calcado:'Calçado',calcadoCor:'Cor do calçado',acessorio:'Acessório',acessorioCor:'Cor do acessório',efeito:'Efeito',animacao:'Animação',moldura:'Moldura'};
  const RARITY_NAMES={comum:'Comum',incomum:'Incomum',raro:'Raro',epico:'Épico',lendario:'Lendário',limitado:'Limitado'};
  const rarityName=id=>RARITY_NAMES[id]||'Item';
  let perfil=null, catalogo=null, ranking=null, emotes=null, active='visao-geral', loading=false;
  const money=n=>Number(n||0).toLocaleString('pt-BR');
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
  const button=(txt,cls,fn)=>{const b=el('button',cls,txt);b.type='button';b.addEventListener('click',fn);return b;};
  const empty=(txt)=>el('p','pf-empty',txt);
  function setText(id,value){const n=document.getElementById(id);if(n)n.textContent=value==null?'—':String(value);}
  function setHtml(id,node){const n=document.getElementById(id);if(n)n.replaceChildren(node);}
  function renderBoneco(target,boneco,label,mini=false){
    if(!target)return;
    target.replaceChildren();
    if(window.PixelAvatar?.render){
      const svg=window.PixelAvatar.render(boneco||window.PixelAvatar.PADRAO,{label:label||'Personagem do jogador',mini,animar:!mini});
      if(svg)target.appendChild(svg);
    }
  }
  function notify(msg,tipo='ok'){if(typeof window.toast==='function')window.toast(msg,tipo);}
  function usuarioAtual(){try{return typeof USUARIO!=='undefined' && USUARIO ? USUARIO : null;}catch(_){return null;}}
  async function loadAll(force=false){
    if(loading)return; loading=true;
    try{
      const state=window.GameState;
      if(state){
        catalogo=await state.carregarCatalogo({forcar:force});
        if(usuarioAtual() || state.perfil){
          perfil=await state.carregarPerfil({forcar:force});
        } else { perfil=null; }
      }
      if(!perfil && usuarioAtual()){ const r=await api(API_GAME,'perfil'); if(r.ok)perfil=r.data; }
      if(!catalogo){const r=await api(API_GAME,'catalogo');if(r.ok)catalogo=r.data;}
      updateAll();
    }catch(e){console.warn('[PerfilUI]',e);}
    finally{loading=false;}
  }
  function updateAll(){
    if(!perfil){renderGuest();return;}
    if(window.__pfAtualizarNomeBanner)window.__pfAtualizarNomeBanner(perfil);
    if(active==='visao-geral')renderOverview();
    if(active==='inventario')renderInventory();
    if(active==='loja')renderShop();
    if(active==='conquistas')renderAchievements();
    if(active==='ranking')renderProfileRanking();
    if(active==='configuracoes')renderSettings();
    renderAvatarPlaces();
  }
  function renderGuest(){
    setText('pfBannerNome','@convidado');
    setText('pfNickLarge','Entre para criar seu personagem');
    renderBoneco($('#pfAvatarLarge'),window.PixelAvatar?.PADRAO,'Prévia do Arcade');
    ['pfLivesCount','pfVotesCount','pfSuggestionsCount','pfWatchHoursCount','pfStreakCurrent','pfStreakBest','pfCoinsValue'].forEach(id=>setText(id,'0'));
    const inv=$('#pfInventoryGrid');if(inv)inv.replaceChildren(empty('Entre com Google para desbloquear e guardar itens no seu inventário.'));
    const ach=$('#pfAchievementsGrid');if(ach)ach.replaceChildren(empty('Crie sua conta para começar a desbloquear conquistas.'));
    const shop=$('#pfShopGrid');if(shop)shop.replaceChildren(empty('Entre para comprar itens com SosoCoins.'));
    const recent=$('#pfRecentAchievements');if(recent)recent.replaceChildren(empty('Suas primeiras conquistas aparecem aqui.'));
    renderSettings();
  }
  function renderAvatarPlaces(){
    if(!perfil)return;
    renderBoneco($('#pfAvatarLarge'),perfil.boneco,'Boneco de '+(perfil.nick||'jogador'));
    renderBoneco($('#pfRankingAvatarPlaceholder'),perfil.boneco,'Seu boneco',true);
    const navAvatar=$('.nav-mini-avatar');
    if(navAvatar){renderBoneco(navAvatar,perfil.boneco,'Seu boneco',true);navAvatar.classList.remove('is-empty');}
  }
  function renderOverview(){
    const p=perfil, st=p.stats||{}, xp=p.xpNivel||{};
    setText('pfNickLarge','@'+(p.nick||'Jogador'));setText('pfLevelLarge',p.nivel||1);
    const fill=$('#pfXpBarFill');if(fill)fill.style.width=Math.max(0,Math.min(100,Number(xp.pct)||0))+'%';
    setText('pfXpText',`${money(xp.dentro||0)} / ${money((xp.prox||0)-(xp.base||0))} XP`);
    setText('pfXpFaltam',xp.falta>0?`Faltam ${money(xp.falta)} XP para o próximo nível`:'Nível máximo alcançado!');
    setText('pfLivesCount',money(st.lives));setText('pfVotesCount',money(st.votos));setText('pfSuggestionsCount',money(st.sugestoes));setText('pfWatchHoursCount',money(st.horas));setText('pfStreakCurrent',money(st.streak));setText('pfStreakBest',money(st.melhorStreak));setText('pfCoinsValue',money(p.coins));
    const pos=p.ranking||{};setText('pfPositionNumber',pos.pos?'#'+pos.pos:'—');setText('pfPositionTotal',`de ${money(pos.total)} jogadores`);
    setText('pfRankingNick',p.nick||'Jogador');setText('pfRankingTitle',titleName(p.titulo));setText('pfRankingLevel',p.nivel||1);setText('pfRankingXp',money(p.xp)+' XP');
    renderBoneco($('#pfAvatarLarge'),p.boneco,'Boneco de '+(p.nick||'jogador'));
    renderBoneco($('#pfRankingAvatarPlaceholder'),p.boneco,'Seu boneco',true);
    const sel=$('#pfTituloSelect');if(sel){const opts=(p.titulos||[]).filter(t=>t.liberado);sel.replaceChildren();opts.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.nome;sel.appendChild(o);});if(!opts.length){const o=document.createElement('option');o.textContent='Nenhum título liberado';o.value='';sel.appendChild(o);}sel.value=p.titulo||'novato';}
    const rules=$('#pfXpRules');if(rules&&p.regras?.xp){rules.replaceChildren();p.regras.xp.forEach((rule,i)=>{const row=el('div','pf-rule-item');row.append(el('span','pf-rule-icon',['🎮','🗳️','💡','📺','🔥','🔐','⭐'][i]||'✦'),el('span','pf-rule-text',rule));rules.appendChild(row);});}
    const milestones=$('#pfStreakMilestones .pf-milestone-list');if(milestones){milestones.replaceChildren();Object.entries(p.regras?.streak?.marcos||{}).forEach(([n,coins])=>milestones.appendChild(el('span','pf-milestone',`${n} lives · +${coins} SC`)));}
    renderRecentAchievements();loadEmotes();
  }
  function titleName(id){const t=(perfil?.titulos||[]).find(x=>x.id===id);return t?.nome||'Novato';}
  function renderRecentAchievements(){
    const box=$('#pfRecentAchievements');if(!box)return;box.replaceChildren();
    const won=(perfil?.conquistas||[]).filter(c=>c.ts).sort((a,b)=>Number(b.ts)-Number(a.ts)).slice(0,3);
    if(!won.length){box.appendChild(empty('Ainda sem conquistas. Sua primeira missão é criar seu boneco!'));return;}
    won.forEach(c=>{const card=el('div','pf-recent-ach');card.append(el('span','pf-ach-icon',c.icone||'🏆'),el('span','pf-ach-name',c.nome));box.appendChild(card);});
  }
  async function loadEmotes(){
    const box=$('#pfEmotesPreview');if(!box||emotes)return;
    try{const r=await api('/api/config','emotes');emotes=Array.isArray(r.data?.emotes)?r.data.emotes:[];}catch(_){emotes=[];}
    box.replaceChildren();
    if(!emotes.length){box.appendChild(empty('Os emotes do canal aparecem aqui quando a Twitch estiver conectada.'));return;}
    emotes.slice(0,8).forEach(e=>{const wrap=el('span','pf-emote');const img=document.createElement('img');img.src=e.url||`https://static-cdn.jtvnw.net/emoticons/v2/${e.id}/default/dark/2.0`;img.alt=e.nome||'Emote da Soso';img.loading='lazy';wrap.append(img,el('small','',e.nome||'Emote'));box.appendChild(wrap);});
  }
  function itemOwned(slot,item){return (perfil?.liberados?.[slot]||[]).includes(item.id)||(perfil?.comprados||[]).includes(`${slot}:${item.id}`);}
  function itemEquipped(slot,item){return perfil?.boneco?.[slot]===item.id;}
  function itemCard(slot,item,mode){
    const owned=itemOwned(slot,item),card=el('article','pf-item-card'+(owned?' is-owned':' is-locked'));
    const top=el('div','pf-item-card-top');top.append(el('span','pf-item-slot',SLOT_NAMES[slot]||slot),el('span','pf-rarity',rarityName(item.r)));card.appendChild(top);
    const preview=el('div','pf-item-preview');
    if(item.cor){const swatch=el('span','pf-item-swatch');swatch.style.background=item.cor;preview.appendChild(swatch);}else preview.textContent=item.icone||'✦';
    card.append(preview,el('h3','pf-item-name',item.nome),el('p','pf-item-rule',item.regraTxt||'Item do Arcade'));
    if(itemEquipped(slot,item))card.appendChild(el('span','pf-item-equipped','✓ EQUIPADO'));
    if(mode==='shop'){
      const footer=el('div','pf-item-footer');footer.append(el('strong','pf-item-price',item.preco?`${money(item.preco)} SC`:'EVENTO'));
      const action=button(owned?'Adquirido':(item.regra?.t==='loja'?'Comprar':'Bloqueado'), 'pf-btn pf-item-action',()=>buyItem(slot,item));
      if(owned||item.regra?.t!=='loja')action.disabled=true;
      footer.appendChild(action);card.appendChild(footer);
    } else if(!owned){card.appendChild(el('span','pf-item-equipped pf-item-locked','🔒 BLOQUEADO'));}
    return card;
  }
  function renderInventory(){
    const grid=$('#pfInventoryGrid');if(!grid)return;grid.replaceChildren();let count=0;
    Object.entries(catalogo?.catalogo||{}).forEach(([slot,items])=>{
      (items||[]).filter(item=>itemOwned(slot,item)).forEach(item=>{count++;grid.appendChild(itemCard(slot,item,'inventory'));});
    });
    setText('pfInventoryCount',`${count} ${count===1?'item':'itens'}`);
    if(!count)grid.appendChild(empty('Seu inventário está vazio por enquanto. Comece pelo guarda-roupa ou desbloqueie itens na loja.'));
  }
  function renderShop(){
    const grid=$('#pfShopGrid');if(!grid)return;grid.replaceChildren();setText('pfShopCoinBalance',money(perfil?.coins));let count=0;
    Object.entries(catalogo?.catalogo||{}).forEach(([slot,items])=>(items||[]).filter(item=>item.regra?.t==='loja').forEach(item=>{count++;grid.appendChild(itemCard(slot,item,'shop'));}));
    if(!count)grid.appendChild(empty('A loja está preparando novos itens.'));
  }
  async function buyItem(slot,item){
    if(!perfil){window.AuthUI?.open();return;}
    const res=await api(API_GAME,'comprar',{method:'POST',body:{slot,id:item.id}});
    if(!res.ok){notify(res.data?.error||'Não foi possível comprar esse item.','erro');return;}
    notify(`${item.nome} entrou no seu inventário!`,'ok');
    await loadAll(true);renderShop();
  }
  function renderAchievements(){
    const grid=$('#pfAchievementsGrid');if(!grid)return;grid.replaceChildren();
    const list=perfil?.conquistas||[];const done=list.filter(c=>c.ts).length;
    setText('pfAchievementProgress',`${done} / ${list.length}`);
    list.forEach(c=>{const unlocked=!!c.ts,card=el('article','pf-achievement-card'+(unlocked?' is-unlocked':' is-locked'));
      card.append(el('div','pf-achievement-icon',c.icone||'🏆'),el('h3','pf-achievement-name',c.nome),el('p','pf-achievement-desc',c.desc||''),el('span','pf-achievement-status',unlocked?'✓ DESBLOQUEADA':'🔒 NÃO DESBLOQUEADA'));
      if(unlocked&&c.ts){const time=new Date(Number(c.ts));if(!Number.isNaN(time.getTime()))card.appendChild(el('small','pf-achievement-date','Desbloqueada em '+time.toLocaleDateString('pt-BR')));}
      grid.appendChild(card);
    });
  }
  async function renderProfileRanking(){
    const me=$('#pfProfileRankingMe'),list=$('#pfProfileRankingList');if(!list)return;list.replaceChildren(empty('Carregando ranking…'));
    const r=await api(API_GAME,'ranking',{query:{limite:100}});if(!r.ok){list.replaceChildren(empty('Não foi possível carregar o ranking agora.'));return;}
    ranking=r.data?.lista||[];if(me){me.replaceChildren();const pos=perfil?.ranking?.pos;const hero=el('div','pf-profile-ranking-card');renderBoneco(hero,perfil.boneco,'Seu boneco',true);const info=el('div','');info.append(el('span','pf-eyebrow','SUA POSIÇÃO'),el('h3','',`${pos?'#'+pos:'Sem posição'} · ${perfil?.nick||'Jogador'}`),el('p','',`Nível ${perfil?.nivel||1} · ${money(perfil?.xp)} XP · ${titleName(perfil?.titulo)}`));hero.appendChild(info);me.appendChild(hero);
    }
    list.replaceChildren();ranking.slice(0,20).forEach(j=>{const row=el('div','pf-profile-ranking-row'+(String(j.id)===String(perfil?.id)?' is-me':''));row.append(el('strong','pf-profile-rank-pos','#'+j.pos));const avatar=el('span','pf-profile-rank-avatar');renderBoneco(avatar,j.boneco,'Boneco de '+j.nome,true);row.append(avatar,el('span','pf-profile-rank-name',j.nome),el('span','pf-profile-rank-level',`Nv ${j.nivel}`),el('strong','pf-profile-rank-xp',`${money(j.xp)} XP`));list.appendChild(row);});
    if(!ranking.length)list.appendChild(empty('O ranking ainda não tem jogadores.'));
  }
  async function renderSettings(){
    const u=usuarioAtual()||{};
    const legadoDiscord=u.tipo==='discord';
    setText('pfSettingsEmail',u.email||'E-mail não vinculado');
    setText('pfSettingsAccount',u.metodoLogin==='google'?'Google':(legadoDiscord?'Discord antigo — migração disponível':(u.id?'Conta antiga (usuário e senha)':'Não conectado')));

    const googleLink=$('#pfGoogleLink');
    if(googleLink){
      googleLink.hidden=u.metodoLogin==='google';
      googleLink.textContent=legadoDiscord?'Migrar para Google e preservar meu progresso':(u.id?'Vincular conta Google':'Entrar com Google');
    }

    const nickInput=$('#pfSettingsNick'),saveNick=$('#pfSaveNick');
    if(nickInput){if(document.activeElement!==nickInput)nickInput.value=perfil?.nick||u.nick||'';nickInput.disabled=!u.id||legadoDiscord;}
    if(saveNick)saveNick.disabled=!u.id||legadoDiscord;

    const twitch=perfil?.twitch||u.twitch;
    const status=$('#pfTwitchStatus'),link=$('#pfTwitchLink'),unlink=$('#pfTwitchUnlink');
    if(legadoDiscord){
      if(status)status.textContent='Migre sua conta para Google para gerenciar a conexão Twitch.';
      if(link)link.hidden=true;if(unlink)unlink.hidden=true;
    } else if(!u.id){
      if(status)status.textContent='Entre com Google para conectar sua Twitch.';
      if(link)link.hidden=true;if(unlink)unlink.hidden=true;
    } else {
      if(status)status.textContent=twitch?`Conectada: ${twitch.nome||twitch.login||'conta Twitch'}`:'Twitch não vinculada';
      if(link)link.hidden=!!twitch;if(unlink)unlink.hidden=!twitch;
    }
  }

  function initTabs(){
    const tabs=$$('[data-pf-tab]'),panels=$$('[data-pf-panel]');if(!tabs.length)return;
    const activate=tab=>{active=tab.dataset.pfTab;tabs.forEach(t=>{const on=t===tab;t.classList.toggle('on',on);t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;});panels.forEach(p=>{const on=p.dataset.pfPanel===active;p.classList.toggle('on',on);p.hidden=!on;});if(active==='boneco'){/* o criador original mantém seu próprio estado */}else if(!perfil)renderGuest();else updateAll();};
    tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(tab));tab.tabIndex=tab.classList.contains('on')?0:-1;tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let n=i;if(e.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;if(e.key==='ArrowRight')n=(i+1)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;tabs[n].focus();tabs[n].click();});});
    $$('[data-pf-go]').forEach(b=>b.addEventListener('click',()=>{const t=$(`[data-pf-tab="${b.dataset.pfGo}"]`);t?.click();}));
  }
  function bindActions(){
    $('#pfTituloSelect')?.addEventListener('change',async e=>{if(!e.target.value)return;const r=await api(API_GAME,'titulo',{method:'POST',body:{id:e.target.value}});if(!r.ok){notify(r.data?.error||'Não foi possível equipar o título.','erro');return;}notify('Título equipado!','ok');await loadAll(true);});
    $('#pfSaveNick')?.addEventListener('click',async()=>{const nick=String($('#pfSettingsNick')?.value||'').trim();if(nick.length<3||nick.length>24){setText('pfSettingsNickNote','Use de 3 a 24 caracteres.');return;}const r=await api(API_AUTH,'change-nick',{method:'POST',body:{nick}});if(!r.ok){setText('pfSettingsNickNote',r.data?.error||'Não foi possível salvar.');return;}setText('pfSettingsNickNote','Nick atualizado com sucesso!');await window.checarLogin?.();await loadAll(true);});
    $('#pfSettingsLogout')?.addEventListener('click',()=>window.sair?.());
    $('#pfGoogleLink')?.addEventListener('click',e=>{e.preventDefault();location.href='/api/auth?action=google-login';});
    $('#pfTwitchLink')?.addEventListener('click',()=>{location.href='/api/auth?action=twitch-link';});
    $('#pfTwitchUnlink')?.addEventListener('click',async()=>{if(!confirm('Desvincular sua conta Twitch? A presença nas lives deixará de ser contabilizada.'))return;const r=await api(API_AUTH,'twitch-unlink',{method:'POST'});if(!r.ok){notify(r.data?.error||'Não foi possível desvincular.','erro');return;}notify('Twitch desvinculada.','ok');await window.checarLogin?.();await loadAll(true);});
  }
  function init(){initTabs();bindActions();if(window.GameState){window.GameState.on('perfil',p=>{perfil=p;if(p)updateAll();else renderGuest();});window.GameState.on('catalogo',c=>{catalogo=c;if(active==='inventario')renderInventory();if(active==='loja')renderShop();});}
    window.addEventListener('soso:auth',e=>{if(!e.detail){perfil=null;window.GameState?.limpar();renderGuest();}else loadAll(true);});
    window.addEventListener('soso:logout',()=>{perfil=null;renderGuest();});window.addEventListener('soso:aba',e=>{if(e.detail==='perfil')loadAll(false);});
    if(window.GameState?.perfil)perfil=window.GameState.perfil;if(window.GameState?.catalogo)catalogo=window.GameState.catalogo;
    if(perfil)updateAll();else renderGuest();loadAll(false);
  }
  window.PerfilUI={init,refresh:()=>loadAll(true),get perfilAtual(){return perfil;},carregarVisaoGeral:renderOverview,carregarInventario:renderInventory,carregarConquistas:renderAchievements,carregarConfiguracoes:renderSettings};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();