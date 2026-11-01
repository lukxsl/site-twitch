/* ============================================================
   RANKING UI — ranking global compatível com { total, lista }
   ============================================================ */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);let busy=false,cache=null;
  const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  const fmt=n=>Number(n||0).toLocaleString('pt-BR');
  function avatar(boneco,label){const wrap=node('span','ranking-avatar-art');if(window.PixelAvatar?.render){const svg=window.PixelAvatar.render(boneco||window.PixelAvatar.PADRAO,{label,mini:true,animar:false});if(svg)wrap.appendChild(svg);}return wrap;}
  function row(j,me=false){const e=node('article','ranking-item'+(me?' is-me':''));e.append(node('strong','ranking-pos','#'+j.pos),avatar(j.boneco,'Boneco de '+j.nome));const info=node('div','ranking-nick-tit');info.append(node('b','ranking-nick',j.nome||'Jogador'),node('small','ranking-title',j.titulo||'Novato'));e.append(info,node('span','ranking-mini-level','Nv '+(j.nivel||1)),node('strong','ranking-mini-xp',fmt(j.xp)+' XP'));return e;}
  function podiumItem(j,position){const e=node('article','podium-item podium-'+position);e.append(avatar(j?.boneco,j?.nome||'Lugar vazio'));const info=node('div','podium-info');info.append(node('span','podium-crown',position==='1st'?'👑':position==='2nd'?'🥈':'🥉'),node('b','podium-nick',j?.nome||'Aguardando jogador'),node('small','podium-title',j?.titulo||'—'),node('span','podium-level',j?'Nv '+j.nivel:'—'),node('strong','podium-xp',j?fmt(j.xp)+' XP':'—'));e.append(info);return e;}
  function render(data){
    const podium=$('#rankingPodium'),list=$('#rankingList'),your=$('#rankingYourContent'),button=$('#rankingLoginBtn');if(!podium||!list)return;
    const players=data.lista||[];podium.replaceChildren(podiumItem(players[1],'2nd'),podiumItem(players[0],'1st'),podiumItem(players[2],'3rd'));
    list.replaceChildren();players.slice(3).forEach(j=>list.appendChild(row(j,String(j.id)===String(window.GameState?.perfil?.id))));
    if(players.length<=3)list.appendChild(node('p','pf-empty','Os próximos jogadores aparecerão aqui quando a comunidade acumular XP.'));
    const user=window.GameState?.perfil;
    if(your){your.replaceChildren();if(user){const pos=user.ranking?.pos;const card=node('div','ranking-your-card');const head=node('div','ranking-your-header');head.append(avatar(user.boneco,'Seu boneco'),node('div','ranking-your-info',`${user.nick||'Jogador'} · ${pos?'#'+pos:'Sem posição'}`));card.append(head,node('p','ranking-your-level',`Nível ${user.nivel||1} · ${fmt(user.xp)} XP`),node('p','ranking-your-faltam',`${fmt(user.coins)} SosoCoins no bolso`));your.appendChild(card);}else{your.append(node('p','pf-empty','Entre com Google para aparecer no ranking e acompanhar sua posição.'),node('button','pf-btn pf-btn-primary','Entrar no Arcade'));your.querySelector('button')?.addEventListener('click',()=>window.AuthUI?.open());}}
    if(button)button.hidden=!!user;
    const total=$('#rankingContainer .ranking-toolbar h3');if(total)total.textContent=`${fmt(data.total)} jogadores no placar`;
  }
  async function load(force=false){if(busy)return;busy=true;const list=$('#rankingList');if(list&&!cache)list.replaceChildren(node('p','pf-empty','Carregando placar…'));
    const r=await api(API_GAME,'ranking',{query:{limite:100}});busy=false;if(!r.ok){if(list)list.replaceChildren(node('p','pf-empty','Não foi possível carregar o ranking. Tente novamente.'));return;}cache=r.data;render(cache);}
  function init(){if(!$('#rankingContainer'))return;$('#rankingRefreshBtn')?.addEventListener('click',()=>load(true));$('#rankingLoginBtn')?.addEventListener('click',()=>window.AuthUI?.open());load();window.addEventListener('soso:auth',()=>load(true));window.addEventListener('soso:aba',e=>{if(e.detail==='ranking')load(true);});window.GameState?.on('perfil',()=>{if(cache)render(cache);});}
  window.RankingUI={init,refresh:()=>load(true)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();