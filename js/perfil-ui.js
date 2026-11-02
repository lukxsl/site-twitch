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
  let perfil=null, catalogo=null, ranking=null, active='visao-geral', loading=false, devInsights=null, devInsightsLoading=false;
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
      const autenticado=!!(usuarioAtual() || state?.perfil);
      let perfilPromise=autenticado && state ? state.carregarPerfil({forcar:force}) : Promise.resolve(null);
      let catalogoPromise=state ? state.carregarCatalogo({forcar:force}) : Promise.resolve(null);
      const [pResult,cResult]=await Promise.allSettled([perfilPromise,catalogoPromise]);
      perfil=pResult.status==='fulfilled'?pResult.value:null;
      catalogo=cResult.status==='fulfilled'?cResult.value:null;
      if(autenticado && !perfil){const r=await api(API_GAME,'perfil');if(r.ok)perfil=r.data;else console.error('[PerfilUI] Perfil:',r.status,r.data);}
      if(!catalogo?.catalogo){const r=await api(API_GAME,'catalogo');if(r.ok&&r.data?.catalogo)catalogo=r.data;else console.error('[PerfilUI] Catálogo:',r.status,r.data);}
      updateAll();
    }catch(e){console.error('[PerfilUI] Falha ao atualizar interface:',e);}
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
    renderRecentAchievements();
  }
  function titleName(id){const t=(perfil?.titulos||[]).find(x=>x.id===id);return t?.nome||'Novato';}
  function renderRecentAchievements(){
    const box=$('#pfRecentAchievements');if(!box)return;box.replaceChildren();
    const won=(perfil?.conquistas||[]).filter(c=>c.ts).sort((a,b)=>Number(b.ts)-Number(a.ts)).slice(0,3);
    if(!won.length){box.appendChild(empty('Ainda sem conquistas. Sua primeira missão é criar seu boneco!'));return;}
    won.forEach(c=>{const card=el('div','pf-recent-ach');card.append(el('span','pf-ach-icon',c.icone||'🏆'),el('span','pf-ach-name',c.nome));box.appendChild(card);});
  }
  function itemOwned(slot,item){return (perfil?.liberados?.[slot]||[]).includes(item.id)||(perfil?.comprados||[]).includes(`${slot}:${item.id}`);}
  function itemEquipped(slot,item){return perfil?.boneco?.[slot]===item.id;}
  function miniaturaItem(slot,item){
    const preview=el('div','pf-item-preview');
    if(window.PixelAvatar?.render){
      const boneco={...window.PixelAvatar.PADRAO,...(perfil?.boneco||{}),[slot]:item.id};
      const svg=window.PixelAvatar.render(boneco,{mini:true,animar:false,label:'Prévia de '+item.nome});
      if(svg){preview.appendChild(svg);return preview;}
    }
    if(item.cor){const swatch=el('span','pf-item-swatch');swatch.style.background=item.cor;preview.appendChild(swatch);}
    else preview.textContent=item.icone||'✦';
    return preview;
  }
  function itemCard(slot,item,mode){
    const owned=itemOwned(slot,item),rarity=String(item.r||'comum').toLowerCase();
    const card=el('article',`pf-item-card rarity-${rarity}`+(owned?' is-owned':' is-locked'));
    card.dataset.rarity=rarity;
    const top=el('div','pf-item-card-top');
    top.append(el('span','pf-item-slot',SLOT_NAMES[slot]||slot),el('span','pf-rarity pf-rarity-badge',rarityName(rarity)));
    card.append(top,miniaturaItem(slot,item),el('h3','pf-item-name',item.nome),el('p','pf-item-rule',item.regraTxt||'Item do Arcade'));
    if(itemEquipped(slot,item))card.appendChild(el('span','pf-item-equipped','✓ EQUIPADO'));
    if(mode==='shop'){
      const footer=el('div','pf-item-footer');footer.append(el('strong','pf-item-price',item.preco?`${money(item.preco)} SC`:'EVENTO'));
      const action=button(owned?'Adquirido':(item.regra?.t==='loja'?'Comprar':'Bloqueado'),'pf-btn pf-item-action',()=>buyItem(slot,item));
      if(owned||item.regra?.t!=='loja')action.disabled=true;
      footer.appendChild(action);card.appendChild(footer);
    }else if(!owned){card.appendChild(el('span','pf-item-equipped pf-item-locked','🔒 BLOQUEADO'));}
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
    const grid=$('#pfShopGrid');if(!grid)return;grid.replaceChildren();
    const teaser=el('section','pf-shop-coming-soon');
    teaser.append(el('span','pf-shop-coming-icon','🛍️'),el('span','pf-eyebrow','ARCADE MARKET'),el('h3','','A loja está em manutenção'),el('p','','Estamos preparando novos visuais, acessórios e efeitos para o cantinho da Soso. Seu saldo de SosoCoins continua guardado.'),el('strong','',`${money(perfil?.coins)} SosoCoins disponíveis`));
    grid.appendChild(teaser);
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
    const list=perfil?.conquistas||[];const normal=list.filter(c=>c.id!=='platina');
    const done=normal.filter(c=>c.ts).length;setText('pfAchievementProgress',`${done} / ${normal.length}`);
    const ordenar=(a,b)=>Number(!!b.ts)-Number(!!a.ts) || Number(a.progresso?.meta||0)-Number(b.progresso?.meta||0);
    const ordered=[...normal].sort(ordenar);
    const addCard=c=>{
      const unlocked=!!c.ts,progress=c.progresso||null;
      const current=progress?Math.max(0,Number(c.progressoAtual)||0):(unlocked?1:0);
      const goal=progress?Math.max(1,Number(progress.meta)||1):1;
      const pct=Math.max(0,Math.min(100,Math.round((current/goal)*100)));
      const card=el('article','pf-achievement-card'+(unlocked?' is-unlocked':' is-locked')+(c.id==='platina'?' is-platinum':''));
      if(c.id==='platina'){
        card.append(el('span','pf-platinum-label','✦ PLATINA'),el('div','pf-achievement-icon pf-platinum-trophy',c.icone||'🏆'));
      }else card.append(el('div','pf-achievement-icon',c.icone||'🏆'));
      card.append(el('h3','pf-achievement-name',c.nome),el('p','pf-achievement-desc',c.desc||''));
      if(progress){
        const progressWrap=el('div','pf-achievement-progress');
        const meta=el('div','pf-achievement-progress-meta');
        const label=progress.unidade==='horas'?`${current.toFixed(current%1?1:0)} / ${goal}h`:`${money(Math.floor(current))} / ${money(goal)} ${progress.unidade||''}`;
        meta.append(el('span','', 'PROGRESSO'),el('strong','',label));
        const track=el('div','pf-achievement-progress-track');track.setAttribute('role','progressbar');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(goal));track.setAttribute('aria-valuenow',String(Math.min(goal,current)));
        const bar=el('span','pf-achievement-progress-fill');bar.style.width=pct+'%';track.appendChild(bar);progressWrap.append(meta,track);card.appendChild(progressWrap);
      }
      const reward=c.premio||{};const rewards=[];if(Number(reward.xp)>0)rewards.push(`+${money(reward.xp)} XP`);if(Number(reward.coins)>0)rewards.push(`+${money(reward.coins)} SosoCoins`);
      card.appendChild(el('p','pf-achievement-reward',c.id==='platina'?'🏆 Recompensa lendária: moldura e honra do Arcade':(rewards.length?`Recompensa: ${rewards.join(' · ')}`:'Recompensa de jornada')));
      card.appendChild(el('span','pf-achievement-status',unlocked?'✓ DESBLOQUEADA':'🔒 EM PROGRESSO'));
      if(unlocked&&c.ts){const time=new Date(Number(c.ts));if(!Number.isNaN(time.getTime()))card.appendChild(el('small','pf-achievement-date','Desbloqueada em '+time.toLocaleDateString('pt-BR')));}
      grid.appendChild(card);
    };
    ordered.forEach(addCard);
    const platinum=list.find(c=>c.id==='platina');if(platinum)addCard(platinum);
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
    const devBox=$('#pfDevInsights');
    if(devBox){devBox.hidden=perfil?.cargo!=='dev';if(perfil?.cargo==='dev')loadDevInsights();}
  }

  function fmtHours(n){return n==null?'—':`${Number(n).toLocaleString('pt-BR',{maximumFractionDigits:1})}h`;}
  function statTile(label,value,detail=''){const card=el('div','pf-dev-stat');card.append(el('small','',label),el('strong','',value),el('span','',detail));return card;}
  function renderDevInsights(){
    const root=$('#pfDevInsightsContent'),status=$('#pfDevInsightsStatus');if(!root)return;root.replaceChildren();
    if(!devInsights){if(status)status.textContent=devInsightsLoading?'Consultando Arcade, StreamElements e Twitch…':'Ainda não há dados carregados.';return;}
    const a=devInsights.arcade||{},st=devInsights.streamElements||{},watch=st.watchtime||{},sum=watch.summary||{},stats=a.stats||{};
    if(status)status.textContent=`Atualizado em ${new Date(devInsights.generatedAt).toLocaleString('pt-BR')}${devInsights.cached?' · cache de 5 min':''}`;
    const arcadeSection=el('section','pf-dev-source');arcadeSection.append(el('h4','','Base do Soso Arcade'),el('p','',`${a.players||0} contas no ranking · amostra de ${a.sampleSize||0}${a.complete?' (base completa)':' (amostra estratificada)'}`));
    if(a.error){arcadeSection.appendChild(el('p','pf-dev-warning','Falha ao ler Redis/Arcade: '+a.error));}
    const arcadeGrid=el('div','pf-dev-stat-grid');
    arcadeGrid.append(statTile('Média de horas',fmtHours(stats.hours?.mean),`Mediana ${fmtHours(stats.hours?.median)}`),statTile('P75 / P90',`${fmtHours(stats.hours?.p75)} / ${fmtHours(stats.hours?.p90)}`,'Horas contabilizadas pelo cron'),statTile('Média de lives',stats.lives?.mean==null?'—':stats.lives.mean.toFixed(1),`Mediana ${stats.lives?.median??'—'}`),statTile('Média de votos',stats.votes?.mean==null?'—':stats.votes.mean.toFixed(1),`P75 ${stats.votes?.p75??'—'}`),statTile('Sugestões enviadas',stats.suggestions?.mean==null?'—':stats.suggestions.mean.toFixed(1),`Média por conta · aprovadas: ${stats.approvedSuggestions?.mean?.toFixed?.(1)??'—'}`));
    arcadeSection.appendChild(arcadeGrid);root.appendChild(arcadeSection);
    const seSection=el('section','pf-dev-source');seSection.append(el('h4','','StreamElements'),el('p','',st.configured?`Canal ${st.channelId||''} · watchtime: ${watch.sampled||0} viewers analisados${watch.complete?' (paginação completa)':' (amostra limitada)'}`:(st.error||'JWT não configurado.')));
    if(st.configured){
      const subs=st.subscribers||{},tips=st.donations||{};
      const subsDetail=`${subs.activeInFetchedPages??0} encontrados em ${subs.sampleCount??0} registros${subs.complete?' · paginação completa':' · amostra limitada'}`;
      const tipsDetail=`${tips.tipsInMonth??0} doações no mês · ${tips.recordsFetched??0} registros lidos${tips.complete?' · paginação completa':' · amostra limitada'}`;
      const seGrid=el('div','pf-dev-stat-grid');
      seGrid.append(
        statTile('Média de watchtime',fmtHours(sum.mean),`Mediana ${fmtHours(sum.median)} · ${watch.sampled||0} viewers interpretados`),
        statTile('P75 / P90',`${fmtHours(sum.p75)} / ${fmtHours(sum.p90)}`,`${watch.unparsed||0} registros sem unidade reconhecida`),
        statTile('Inscritos ativos',money(subs.activeTotal??subs.activeInFetchedPages??0),subsDetail),
        statTile('Doações no mês',tips.month?.length?tips.month.map(x=>`${x.currency} ${money(x.total)}`).join(' · '):'Sem registros',tipsDetail)
      );
      seSection.appendChild(seGrid);
      if(watch.leaderboard?.length){const h=el('div','pf-dev-leaderboard');h.append(el('h5','','Top watchtime'));watch.leaderboard.slice(0,5).forEach(row=>h.append(el('p','',`#${row.pos} ${row.nome} · ${fmtHours(row.horas)}`)));seSection.appendChild(h);}
      if(st.points?.leaderboard?.length){const h=el('div','pf-dev-leaderboard');h.append(el('h5','','Ranking global de pontos (!points)'));st.points.leaderboard.slice(0,5).forEach(row=>h.append(el('p','',`#${row.pos} ${row.nome} · ${money(row.points)} pontos`)));seSection.appendChild(h);}
      if(watch.unparsed){
        const note=el('p','pf-dev-warning',`A API devolveu ${watch.unparsed} registros de watchtime em formato ainda não reconhecido. Unidade numérica configurada: ${watch.numericUnit||'nenhuma'}. Veja a amostra de campos abaixo e só defina STREAMELEMENTS_WATCHTIME_UNIT depois de confirmar se são minutos, segundos ou milissegundos.`);
        seSection.appendChild(note);
        if(watch.fieldShapeSample?.length){const pre=el('pre','pf-dev-json-sample',JSON.stringify(watch.fieldShapeSample,null,2));seSection.appendChild(pre);}
      }
      if(!subs.complete||!tips.complete){seSection.appendChild(el('p','pf-dev-warning','A paginação de inscritos ou doações atingiu o limite de leitura. Os valores são uma amostra e não devem ser tratados como totais absolutos.'));}
      if(st.errors){const errors=Object.entries(st.errors).filter(([,v])=>v);if(errors.length)seSection.append(el('p','pf-dev-warning','Avisos da API: '+errors.map(([k,v])=>`${k}: ${v}`).join(' | ')));}
    }
    root.appendChild(seSection);
    const twitch=devInsights.twitch||{};const live=el('section','pf-dev-source');live.append(el('h4','','Status da live'),el('p','',twitch.online===true?`AO VIVO · ${money(twitch.viewers)} espectadores · ${twitch.title||'sem título'}`:twitch.online===false?'Offline':(twitch.error||'Status não disponível.')));root.appendChild(live);
    const rec=devInsights.recommendation?.hours;if(rec){const suggestion=el('section','pf-dev-recommendation');suggestion.append(el('h4','','Referência de metas por percentil'),el('p','',`Entrada: ${rec.entry}h · Frequente: ${rec.regular}h · Fiel: ${rec.loyal}h · Lendária: ${rec.legendary}h`),el('small','','Sugestão calculada pelo watchtime do StreamElements. Confira a cobertura da amostra antes de alterar as metas.'));root.appendChild(suggestion);}
    const foot=el('p','pf-dev-footnote','Importante: o watchtime do StreamElements é usado aqui para análise. Ele não altera automaticamente o XP nem as horas do Arcade, que continuam sendo creditados pelo cron de presença para evitar duplicidade.');root.appendChild(foot);
  }
  async function loadDevInsights(force=false){
    if(devInsightsLoading||(!force&&devInsights))return;devInsightsLoading=true;renderDevInsights();
    try{const r=await api(API_GAME,'dev-insights');if(!r.ok)throw new Error(r.data?.error||`HTTP ${r.status}`);devInsights=r.data;}
    catch(e){devInsights={arcade:null,streamElements:{configured:false,error:e.message},twitch:{online:null,error:e.message},generatedAt:new Date().toISOString()};console.error('[PerfilUI] Diagnóstico dev:',e);}
    finally{devInsightsLoading=false;renderDevInsights();}
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
    $('#pfDevRefresh')?.addEventListener('click',()=>loadDevInsights(true));
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