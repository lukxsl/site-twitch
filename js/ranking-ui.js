/* ============================================================
   RANKING UI — Arcade XP + rankings oficiais do StreamElements
   ============================================================ */
(function(){
  'use strict';
  const $ = s => document.querySelector(s);
  let currentMode = 'xp';
  let loadSequence = 0;
  const cache = { xp: null, horas: null, pontos: null };
  const node = (tag, cls, txt) => { const el=document.createElement(tag); if(cls) el.className=cls; if(txt!==undefined) el.textContent=txt; return el; };
  const fmt = n => Number(n||0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const getName = u => String(u?.nome || u?.username || u?.data?.username || u?.user?.username || u?.user?.displayName || u?.displayName || u?.name || 'Jogador');
  const getAvatar = u => u?.avatar || u?.data?.avatar || u?.data?.user?.avatar || u?.user?.avatar || u?.user?.profileImage || u?.user?.profile_image_url || u?.profileImage || u?.profile_image_url || '';
  function formatWatch(v){
    if(typeof v === 'string'){
      const raw=v.trim();
      if(/[hms]/i.test(raw)) return raw.replace(/\s+/g,' ');
      const num=Number(raw); if(Number.isFinite(num)) v=num; else return raw || '—';
    }
    const n=Number(v||0); if(!Number.isFinite(n)||n<=0) return '0h';
    // StreamElements watchtime API commonly returns minutes; explicit seconds are handled via the unit field.
    const mins = n;
    const hours=Math.floor(mins/60), rest=Math.round(mins%60);
    return hours ? `${hours}h ${rest}m` : `${rest}m`;
  }
  function metricValue(row, mode){
    if(mode==='xp') return `${fmt(row.xp)} XP`;
    if(mode==='pontos') return `${fmt(row.valor)} pts`;
    const unit=String(row.unit || row.unitType || row.type || '').toLowerCase();
    const value=row.valor;
    if(unit.includes('second') || unit==='s') return formatWatch(Number(value)/60);
    if(unit.includes('hour') || unit==='h') return `${fmt(value)}h`;
    return formatWatch(value);
  }
  function avatar(row){
    const wrap=node('span','ranking-avatar-art');
    const url=getAvatar(row);
    if(url && /^(https:\/\/|\/)/i.test(String(url))){
      const img=node('img','ranking-avatar-photo'); img.src=String(url); img.alt=''; img.loading='lazy'; img.referrerPolicy='no-referrer';
      img.onerror=()=>{img.remove(); wrap.appendChild(node('span','ranking-avatar-initial',(getName(row)[0]||'?').toUpperCase()));};
      wrap.appendChild(img);
    } else wrap.appendChild(node('span','ranking-avatar-initial',(getName(row)[0]||'?').toUpperCase()));
    return wrap;
  }
  function normalizeRows(data, mode){
    let rows=data?.lista || data?.ranking || data?.data || data?.docs || data?.users || data?.results || data;
    if(rows && !Array.isArray(rows)) rows=rows.docs || rows.users || rows.results || rows.items || rows.data || [];
    if(!Array.isArray(rows)) rows=[];
    return rows.map((r,i)=>{
      const val = mode==='xp' ? (r.xp ?? r.score ?? r.value ?? 0) : mode==='pontos'
        ? (r.points ?? r.data?.points ?? r.data?.current ?? r.current ?? r.amount ?? r.value ?? r.score ?? 0)
        : (r.watchtime ?? r.data?.watchtime ?? r.data?.watchTime ?? r.watchTime ?? r.watch_time ?? r.totalWatchTime ?? r.minutesWatched ?? r.hoursWatched ?? r.time ?? r.minutes ?? r.hours ?? r.total ?? r.value ?? 0);
      return { ...r, id:r.id || r._id || r.userId || getName(r).toLowerCase(), nome:getName(r), avatar:getAvatar(r), pos:(parseInt(r.pos ?? r.position ?? r.rank,10) || i+1), xp:Number(val)||0, valor:val, total:Number(data?.total)||rows.length };
    });
  }
  function row(item, mode, me=false){
    const el=node('article','ranking-item'+(me?' is-me':''));
    el.append(node('strong','ranking-pos','#'+item.pos),avatar(item));
    const info=node('div','ranking-nick-tit'); info.append(node('b','ranking-nick',item.nome),node('small','ranking-title',mode==='xp'?(item.titulo||'Jogador'):'StreamElements'));
    el.append(info,node('strong','ranking-mini-xp',metricValue(item,mode)));
    return el;
  }
  function podiumItem(item,position,mode){
    const e=node('article','podium-item podium-'+position);
    e.append(avatar(item || {nome:'?' }));
    const info=node('div','podium-info');
    info.append(node('span','podium-crown',position==='1st'?'👑':position==='2nd'?'🥈':'🥉'),node('b','podium-nick',item?.nome||'Aguardando jogador'),node('small','podium-title',item?(mode==='xp'?(item.titulo||'Jogador'):'StreamElements'):'—'),node('strong','podium-xp',item?metricValue(item,mode):'—'));
    e.append(info); return e;
  }
  function render(data){
    const podium=$('#rankingPodium'),list=$('#rankingList'),your=$('#rankingYourContent'),login=$('#rankingLoginBtn');
    if(!podium||!list)return;
    const players=normalizeRows(data,currentMode);
    podium.replaceChildren(podiumItem(players[1],'2nd',currentMode),podiumItem(players[0],'1st',currentMode),podiumItem(players[2],'3rd',currentMode));
    list.replaceChildren();
    players.slice(3).forEach(item=>list.appendChild(row(item,currentMode,String(item.id)===String(window.GameState?.perfil?.id))));
    if(players.length<=3) list.appendChild(node('p','pf-empty','Ainda não há outros participantes nessa categoria.'));
    const user=window.GameState?.perfil;
    if(your){
      your.replaceChildren();
      if(currentMode==='xp' && user){
        const pos=user.ranking?.pos; const card=node('div','ranking-your-card'); const head=node('div','ranking-your-header');
        const account=(typeof USUARIO!=='undefined' && USUARIO) ? USUARIO : {};
        const photo=account.avatar || account.picture || account.google?.picture || account.foto || user.avatar;
        const me={nome:user.nick||'Jogador',avatar:photo}; head.append(avatar(me),node('div','ranking-your-info',`${user.nick||'Jogador'} · ${pos?'#'+pos:'Sem posição'}`));
        card.append(head,node('p','ranking-your-level',`Nível ${user.nivel||1} · ${fmt(user.xp)} XP`),node('p','ranking-your-faltam',`${fmt(user.coins)} SosoCoins no saldo`)); your.appendChild(card);
      } else {
        your.appendChild(node('p','pf-empty',currentMode==='xp'?'Entre para acompanhar seu XP e posição no Arcade.':'Dados fornecidos diretamente pelo ranking do StreamElements.'));
      }
    }
    if(login) login.hidden=!!user;
    const total=$('#rankingContainer .ranking-toolbar h3'); if(total) total.textContent=`${fmt(data?.total ?? players.length)} participantes no placar`;
    const desc=$('#rankingModeDescription'); if(desc) desc.textContent=currentMode==='xp'?'XP conquistado nas atividades do Arcade.':currentMode==='horas'?'Tempo assistido registrado pelo StreamElements.':'Pontos de fidelidade registrados pelo StreamElements.';
    document.querySelectorAll('[data-ranking-mode]').forEach(btn=>{const active=btn.dataset.rankingMode===currentMode;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));});
  }
  async function requestMode(mode,force){
    const refreshQuery = force ? { _refresh: Date.now() } : {};
    if(mode==='xp') return api(API_GAME,'ranking',{query:{limite:100,...refreshQuery}});
    const action=mode==='horas'?'ranking-horas':'ranking-pontos';
    const r=await api('/api/config',action,{query:{limit:100,offset:0,...refreshQuery}});
    if(!r.ok) return r;
    return {ok:true,data:r.data?.lista ? r.data : {ranking:r.data?.ranking, total:r.data?.total, data:r.data?.ranking}};
  }
  async function load(force=false,mode=currentMode){
    currentMode=mode;
    const requestId=++loadSequence;
    const list=$('#rankingList'); if(list&&!cache[mode]) list.replaceChildren(node('p','pf-empty','Carregando ranking…'));
    try{
      const r=await requestMode(mode,force);
      if(requestId!==loadSequence) return;
      if(!r.ok) throw new Error(r.data?.error || 'Falha ao consultar ranking');
      cache[mode]=r.data || {}; render(cache[mode]);
    }catch(error){
      if(requestId!==loadSequence) return;
      console.error('[Ranking] Falha ao carregar:',error);
      if(list) list.replaceChildren(node('p','pf-empty',`${error.message || 'Não foi possível carregar esta categoria.'} Verifique a conexão com o StreamElements.`));
    }
  }
  function init(){
    if(!$('#rankingContainer'))return;
    $('#rankingRefreshBtn')?.addEventListener('click',()=>load(true,currentMode));
    $('#rankingLoginBtn')?.addEventListener('click',()=>window.AuthUI?.open());
    document.querySelectorAll('[data-ranking-mode]').forEach(btn=>btn.addEventListener('click',()=>load(false,btn.dataset.rankingMode)));
    load(); window.addEventListener('soso:auth',()=>load(true,currentMode));
    window.addEventListener('soso:aba',e=>{if(e.detail==='ranking')load(true,currentMode);});
    window.GameState?.on('perfil',()=>{if(cache.xp && currentMode==='xp') render(cache.xp);});
  }
  window.RankingUI={init,refresh:()=>load(true,currentMode)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
