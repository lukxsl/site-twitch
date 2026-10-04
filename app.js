/* ============================================================
   ASEMTET0 · APP v2 — arquitetura limpa
   ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const n1 = n => Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});

/* ---------- ESTADO ---------- */
const State = {
  user: null,
  page: 'home',
  jogos: [], filmes: [],
  mode: 'jogos',
  filter: 'Todos',
  votes: [], myVote: null, voteStatus: 'idle',
  config: { aviso:null, donate:null, manutencao:false, recado:'', horasMes:'', top3:[], hall:[], updatedAt:null },
  twitch: { stream:null, video:null, videos:[], followers:null, discord:null, horasMes:0, game:null, clips:[] },
  admin: { page:'home', tab:'votos', tierTab:'jogos', data:null, tier:{jogos:[],filmes:[]}, multisel:{on:false,ids:new Set()} }
};

/* ---------- CONSTANTES ---------- */
const NIVEIS = { dev:4, dono:3, administrador:2, moderador:1 };
const LABEL_CARGO = { dev:'🛠️ Dev', dono:'👑 Dono', administrador:'🛡️ Admin', moderador:'🔰 Mod' };
const TIERS = ['S','A','B','C'];
const MODES = {
  jogos:{ title:'Tier List de Jogos', sub:'Do melhor ao pior. Clique para ver detalhes.', plural:'jogos', stats:'jogos na lista', hoursLabel:'horas jogadas', done:'Zerado', doneLabel:'jogos zerados', empty:'Nenhum jogo aqui', search:'Buscar jogo...', status:['Todos','Jogando','Zerado','Dropado','Na fila'], get list(){ return State.jogos } },
  filmes:{ title:'Tier List de Filmes', sub:'Do melhor ao pior. Clique para ver detalhes.', plural:'filmes', stats:'filmes na lista', hoursLabel:'duração total', done:'Assistido', doneLabel:'filmes assistidos', empty:'Nenhum filme aqui', search:'Buscar filme...', status:['Todos','Assistindo','Assistido','Na fila'], get list(){ return State.filmes } }
};
const EMOTES = [{e:'💜',n:'amor'},{e:'😭',n:'chora'},{e:'😂',n:'risada'},{e:'😡',n:'raiva'},{e:'😱',n:'pog'},{e:'🎮',n:'gg'}];
const MARCOS = [50,100,250,500,1000,2500,5000,10000,25000,50000];
const COMANDOS = [
  {c:'!discord',d:'Link do Discord'},
  {c:'!insta',d:'Instagram da Soso'},
  {c:'!social',d:'Instagram, Discord e TikTok'},
  {c:'!lurk',d:'Avisar que vai ficar de lurk'},
  {c:'!uptime',d:'Tempo de live'},
  {c:'!commands',d:'Lista de comandos'}
];
const STATUS_TIP = {
  'Todos':'Ver todos', 'Jogando':'Jogando atualmente', 'Zerado':'Terminei a história',
  'Dropado':'Não vou continuar', 'Na fila':'Quero jogar/assistir', 'Assistindo':'Assistindo agora', 'Assistido':'Já assisti'
};

const TIER_FALLBACK_JOGOS = [
  {id:'red-dead-2',nome:'Red Dead Redemption 2',appid:1174180,tier:'S',status:'Jogando',horas:50,nota:8,capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900.jpg',comentario:'Um dos mundos mais vivos e detalhados dos games.'},
  {id:'hollow-knight',nome:'Hollow Knight',tier:'S',status:'Zerado',nota:9,horas:40,capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg',comentario:''},
  {id:'stardew-valley',nome:'Stardew Valley',tier:'A',status:'Jogando',nota:8,horas:120,capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg',comentario:''}
];
const TIER_FALLBACK_FILMES = [
  {id:'interestelar',nome:'Interestelar',tier:'S',status:'Assistido',nota:9,duracao:169,ano:2014,capa:'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',comentario:'As reservas naturais da Terra estão chegando ao fim e um grupo de astronautas recebe a missão de verificar possíveis planetas.'}
];

/* ---------- HELPERS ---------- */
const fmtDur = m => m ? (Math.floor(m/60)? `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}min` : `${m}min`) : null;
const timeAgo = iso => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if(m < 60) return `há ${Math.max(1, Math.round(m))} min`;
  if(m < 1440) return `há ${Math.round(m/60)}h`;
  const d = Math.round(m/1440); return d === 1 ? 'ontem' : `há ${d} dias`;
};
const fmtDate = iso => { if(!iso) return '—'; const d = new Date(iso); if(isNaN(d)) return iso; return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`; };
const hasPerm = p => { if(!State.user?.admin) return false; if(State.user.cargo === 'dev') return true; return (State.user.perms||[]).includes(p); };

/* ---------- TOAST ---------- */
function toast(msg, type = 'ok') {
  const c = $('#toasts'); if(!c) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 4000);
}

/* ---------- CONFIRM ---------- */
function confirmar(title='Confirmar?', text='Tem certeza?', icon='⚠️', danger=false) {
  return new Promise(res => {
    const dlg = $('#confirm');
    $('#confirmIcon').textContent = icon;
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    const yes = $('#confirmYes'), no = $('#confirmNo');
    yes.classList.toggle('danger', danger);
    const close = v => { dlg.close(); yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo); dlg.removeEventListener('cancel', onNo); res(v); };
    const onYes = () => close(true);
    const onNo = e => { if(e) e.preventDefault(); close(false); };
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    dlg.addEventListener('cancel', onNo);
    dlg.showModal();
  });
}

/* ---------- NAV ---------- */
function navigate(page, push = true) {
  State.page = page;
  $$('.page').forEach(p => p.classList.toggle('is-active', p.dataset.page === page));
  $$('.nav-link').forEach(a => a.classList.toggle('is-active', a.dataset.nav === page));
  if(push) history.pushState({page}, '', `#${page}`);
  window.scrollTo({top:0, behavior:'smooth'});
  if(page === 'admin') renderAdmin();
  if(page === 'community') setupCommunity();
  if(page === 'setup') renderSetup();
}

/* ---------- AUTH UI ---------- */
function renderAuth() {
  const box = $('#topbarUser'); if(!box) return;
  if(State.user) {
    box.innerHTML = `
      <div class="user-chip">
        <img src="${esc(State.user.avatar)}" alt="" onerror="this.style.visibility='hidden'">
        <b>@${esc(State.user.username)}</b>
        <button class="logout-btn" data-logout>Sair</button>
      </div>`;
  } else {
    box.innerHTML = `
      <a class="login-btn" href="/api/auth?action=login">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z"/></svg>
        Entrar
      </a>`;
  }
  $$('.admin-only').forEach(el => el.hidden = !State.user?.admin);
  document.body.classList.toggle('is-admin', !!State.user?.admin);
}

async function checkLogin() {
  try {
    const r = await fetch('/api/auth?action=me');
    const d = await r.json();
    if(d.logado) {
      State.user = d;
      try {
        const pr = await fetch('/api/admin?action=permissoes-minhas');
        if(pr.ok) { const pd = await pr.json(); State.user.perms = pd.permissoes || []; }
      } catch(e) {}
    } else State.user = null;
  } catch(e) { State.user = null; }
  renderAuth();
  if(State.user?.admin) { $$('.game').forEach(g => g.draggable = true); }
}

/* ---------- CONFIG ---------- */
async function loadConfig() {
  try {
    const r = await fetch('/api/config', { cache:'no-store' });
    if(r.ok) { const d = await r.json(); Object.assign(State.config, d); }
  } catch(e) {}
  renderNotice();
  renderSupport();
  renderSiteUpdated();
  applyMaintenance();
}

function renderNotice() {
  const box = $('#notice'); if(!box) return;
  const a = State.config.aviso;
  if(a && a.ativo && a.texto) {
    box.hidden = false;
    box.classList.toggle('warn', a.tipo === 'warn');
    $('#noticeIcon').textContent = a.icone || '📢';
    $('#noticeTitle').textContent = a.titulo || 'Aviso';
    $('#noticeText').textContent = a.texto;
    $('#recadoWrap') && ($('#recadoWrap').style.display = 'none');
  } else {
    box.hidden = true;
    $('#recadoWrap') && ($('#recadoWrap').style.display = '');
  }
}

function renderSupport() {
  const t3 = $('#top3List');
  if(t3) {
    const l = (State.config.top3||[]).slice(0,3);
    t3.innerHTML = l.length
      ? l.map((p,i)=>`<div class="top3-card"><span class="medal">${['🥇','🥈','🥉'][i]}</span><span class="name">${esc(p.nome||'—')}</span>${p.valor?`<span class="value">${esc(p.valor)}</span>`:''}</div>`).join('')
      : ['🥇','🥈','🥉'].map(m=>`<div class="top3-card"><span class="medal">${m}</span><span class="name" style="color:var(--muted);font-style:italic">Em breve</span></div>`).join('');
  }
  const hl = $('#hallList');
  if(hl) {
    const l = (State.config.hall||[]).slice(0,5);
    hl.innerHTML = l.length
      ? l.map((p,i)=>`<div class="hall-row"><span class="pos">${i+1}</span><span class="name">@${esc(p.nome||'—')}</span><span class="meta">${esc(p.meta||'')}</span></div>`).join('')
      : '<p class="muted" style="text-align:center;padding:10px;font-style:italic">Em breve 👑</p>';
  }
  const note = $('#sosoNote');
  if(note) {
    const r = (State.config.recado||'').trim();
    note.textContent = r || 'Sem recadinho no momento. Volte mais tarde! 💜';
    note.style.fontStyle = r ? 'italic' : 'normal';
  }
}

function renderSiteUpdated() {
  const el = $('#siteUpdated'); if(!el) return;
  el.textContent = State.config.updatedAt ? fmtDate(State.config.updatedAt) : new Date().toLocaleDateString('pt-BR');
}

function applyMaintenance() {
  const on = State.config.manutencao && !State.user?.admin;
  let el = $('#maintenance');
  if(on) {
    if(!el) {
      el = document.createElement('div');
      el.id = 'maintenance';
      el.className = 'maintenance';
      el.innerHTML = `<div class="ic">🔧</div><h1>Estamos em manutenção</h1><p>Voltamos logo! Enquanto isso, dá uma passada na Twitch:</p><a class="btn big" href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">Ir pra Twitch 💜</a>`;
      document.body.appendChild(el);
    }
  } else if(el) el.remove();
}

/* ---------- TWITCH ---------- */
async function loadTwitch() {
  try {
    const r = await fetch('/api/twitch');
    if(!r.ok) throw 0;
    const d = await r.json();
    State.twitch = { ...State.twitch, ...d };
    updateTwitchUI();
    updateGoals();
  } catch(e) {}
}

function updateTwitchUI() {
  const t = State.twitch;
  const live = !!t.stream;
  $$('.live-dot').forEach(e => e.classList.toggle('is-live', live));
  const bl = $('#bannerLive');
  if(bl) bl.hidden = !live;
  const blt = $('#bannerLiveTxt');
  if(blt && live) blt.textContent = `AO VIVO • ${t.stream.game_name || 'Jogando'}`;
  const st = $('#channelStatus'); if(st) st.textContent = live ? '● AO VIVO' : 'OFFLINE';
  const sf = $('#statFollowers'); if(sf) sf.textContent = t.followers != null ? t.followers.toLocaleString('pt-BR') : '—';
  const sh = $('#statHours'); if(sh) sh.textContent = t.horasMes ? `${t.horasMes}h` : '—';
  const up = $('#statUptime');
  if(up) {
    if(live && t.stream.started_at) {
      const diff = Date.now() - new Date(t.stream.started_at).getTime();
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
      up.textContent = `${h}h ${m}m`;
    } else up.textContent = '—';
  }
  const lt = $('#lastLiveText');
  if(lt) {
    if(live) lt.textContent = `${t.stream.title} · ${t.stream.viewer_count} assistindo`;
    else if(t.videos?.[0]) lt.textContent = `${timeAgo(t.videos[0].created_at)} · ${t.videos[0].title}`;
    else lt.textContent = 'Canal offline no momento.';
  }
  const ll = $('#lastLiveLabel'); if(ll) ll.textContent = live ? 'AO VIVO AGORA' : 'ÚLTIMA LIVE';
  const vs = $('#viewerStatus'); if(vs) vs.textContent = live ? `${t.stream.viewer_count} assistindo` : '@asemtet0';
  const pn = $('#playerNote'); if(pn) pn.textContent = live ? `A transmitir: ${t.stream.title}` : 'A transmissão aparece aqui quando estiver ao vivo 🎮';
  const ifr = $('#twitchIframe'), off = $('#offlinePanel');
  if(live) {
    if(off) off.hidden = true;
    if(ifr) { ifr.hidden = false; if(!ifr.src.includes('channel=')) ifr.src = `https://player.twitch.tv/?channel=asemtet0&parent=${location.hostname}`; }
  } else {
    if(ifr) { ifr.hidden = true; ifr.src = ''; }
    if(off) off.hidden = false;
  }
  const lv = $('#btnLastVod'); if(lv) lv.hidden = !t.video;
  const vods = $('#vodsList');
  if(vods) {
    const list = (t.videos||[]).slice(0,3);
    vods.innerHTML = list.length
      ? list.map(v => `<button class="vod" data-vod="${esc(v.id)}">${v.thumbnail?`<img src="${esc(v.thumbnail)}" alt="" loading="lazy">`:''}<div class="vod-info"><b>${esc(v.title||'Live')}</b><span>${v.created_at?timeAgo(v.created_at):''}${v.duration?' · '+v.duration:''}</span></div><span class="vod-ic">▶</span></button>`).join('')
      : '<p class="muted" style="font-size:.78rem;padding:4px">Nenhuma live gravada.</p>';
  }
  const av = $('#offlinePanel img'); if(av && t.user?.profile_image_url) av.src = t.user.profile_image_url;
  updateFocus();
  renderClips();
}

function updateFocus() {
  const t = State.twitch;
  const live = !!t.stream;
  const game = t.game;
  const match = game ? State.jogos.find(j => norm(j.nome) === norm(game.name)) : null;
  const j = match || State.jogos.find(x => x.status === 'Jogando') || State.jogos[0];
  const name = game?.name || j?.nome;
  const cover = $('#focusCover');
  if(cover) {
    cover.classList.remove('skeleton');
    const src = j?.capa || game?.box_art;
    if(src) { cover.src = src; cover.onerror = () => cover.style.display = 'none'; cover.style.display = ''; }
    else cover.style.display = 'none';
  }
  const fn = $('#focusName'); if(fn) fn.textContent = name || 'Sem jogo registrado';
  const fl = $('#focusLabel'); if(fl) fl.textContent = live ? '🔴 Jogando agora' : '🎮 Último jogo jogado';
  const chips = $('#focusChips');
  if(chips) {
    const c = [];
    if(j?.tier && j.tier !== 'NR') c.push(`<span class="chip tier">Tier ${esc(j.tier)}</span>`);
    if(j?.nota > 0) c.push(`<span class="chip">⭐ ${n1(j.nota)}</span>`);
    if(j?.horas > 0) c.push(`<span class="chip">⏱ ${n1(j.horas)}h</span>`);
    if(j?.status) c.push(`<span class="chip">${esc(j.status)}</span>`);
    chips.innerHTML = c.length ? c.join('') : '<span class="chip">Sem dados na tier list</span>';
  }
  const fh = $('#focusHours');
  if(fh) {
    if(live) fh.textContent = 'Entra no chat e vem jogar junto! 💜';
    else if(t.video?.created_at) fh.textContent = `Última live ${timeAgo(t.video.created_at)}`;
    else fh.textContent = '';
  }
  const tl = $('#focusTwitchLink'); if(tl) tl.hidden = !live;
}

function updateGoals() {
  const t = State.twitch;
  const set = (pre, val) => {
    const num = $(`#goal${pre}Num`), bar = $(`#goal${pre}Bar`), desc = $(`#goal${pre}Desc`);
    if(!num || !bar || !desc) return;
    if(val == null) { num.textContent = '—'; bar.style.width = '0%'; desc.textContent = 'Indisponível'; return; }
    const target = MARCOS.find(m => m > val) || val + 1000;
    num.textContent = `${val.toLocaleString('pt-BR')} / ${target.toLocaleString('pt-BR')}`;
    bar.style.width = Math.min(100, val/target*100) + '%';
    desc.textContent = `Faltam ${(target - val).toLocaleString('pt-BR')} para a próxima meta!`;
  };
  set('Followers', t.followers);
  set('Discord', t.discord);
  const dm = $('#dcMembers');
  if(dm && t.discord) dm.textContent = `${t.discord.toLocaleString('pt-BR')} membros · avisos de live e novidades.`;
}

function renderClips() {
  const wrap = $('#clipsWrap'), empty = $('#clipsEmpty'), grid = $('#clipsGrid'), title = $('#clipsTitle');
  if(!wrap || !grid) return;
  const clips = (State.twitch.clips || []).slice(0,4);
  if(!clips.length) { wrap.hidden = true; empty.hidden = false; return; }
  wrap.hidden = false; empty.hidden = true;
  const total = clips.reduce((a,c) => a + (Number(c.views)||0), 0);
  title.textContent = `🎬 Clipes em destaque · 👁 ${total.toLocaleString('pt-BR')}`;
  grid.innerHTML = clips.map(c => `<button class="clip" data-clip="${esc(c.id)}" data-title="${esc(c.title)}" data-views="${c.views||0}"><img src="${esc(c.thumbnail)}" alt="" loading="lazy"><span class="play">▶</span><span class="views">👁 ${Number(c.views||0).toLocaleString('pt-BR')}</span><span class="title">${esc(c.title)}</span></button>`).join('');
}

/* ---------- TIER LIST ---------- */
async function loadLibrary() {
  try {
    const r = await fetch('/api/tierlist');
    const d = r.ok ? await r.json() : {};
    State.jogos = (Array.isArray(d.jogos) && d.jogos.length) ? d.jogos : TIER_FALLBACK_JOGOS;
    State.filmes = (Array.isArray(d.filmes) && d.filmes.length) ? d.filmes : TIER_FALLBACK_FILMES;
  } catch(e) { State.jogos = TIER_FALLBACK_JOGOS; State.filmes = TIER_FALLBACK_FILMES; }
  applyMode(State.mode, false);
}

function applyMode(mode, push = true) {
  if(!MODES[mode]) mode = 'jogos';
  State.mode = mode; State.filter = 'Todos';
  const m = MODES[mode];
  $$('#modeToggle .seg').forEach(b => b.classList.toggle('is-on', b.dataset.mode === mode));
  const t = $('#tlTitle'); if(t) t.textContent = m.title;
  const s = $('#tlSub'); if(s) s.textContent = m.sub;
  const inp = $('#searchInput'); if(inp) { inp.value = ''; inp.placeholder = m.search; }
  const note = $('#tmdbNote'); if(note) note.hidden = mode !== 'filmes';
  renderFilters();
  renderStats();
  renderTiers();
  if(push) localStorage.setItem('mode', mode);
}

function renderFilters() {
  const el = $('#filterChips'); if(!el) return;
  el.innerHTML = MODES[State.mode].status.map(s => `<button class="chip ${s===State.filter?'is-on':''}" data-filter="${s}" title="${esc(STATUS_TIP[s]||s)}">${s}</button>`).join('');
}

function renderStats() {
  const m = MODES[State.mode], L = m.list;
  const notas = L.filter(j => j.nota > 0);
  const media = notas.length ? notas.reduce((a,j)=>a+j.nota,0)/notas.length : 0;
  let total;
  if(State.mode === 'filmes') {
    const min = L.reduce((a,j)=>a+(j.duracao||0),0);
    total = fmtDur(min) || '—';
  } else {
    total = n1(L.reduce((a,j)=>a+(j.horas||0),0));
  }
  const el = $('#statsRow'); if(!el) return;
  el.innerHTML = [
    [L.length, m.stats],
    [total, m.hoursLabel],
    [media ? n1(media) : '—', 'média das notas'],
    [L.filter(j => j.status === m.done).length, m.doneLabel]
  ].map(([v,l]) => `<div class="stat-box"><b>${v}</b><span>${l}</span></div>`).join('');
}

function gameCard(j, idx) {
  const m = MODES[State.mode];
  const ini = (j.nome||'').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase() || '?';
  const drag = !!(State.user?.admin) && !State.admin.multisel.on;
  const isNew = j.tier === 'NR' && j.adicionadoEm && (Date.now() - new Date(j.adicionadoEm).getTime()) < 7*86400000;
  const conq = j.conquistas?.total ? `<span class="conq">🏆 ${j.conquistas.obtidas}/${j.conquistas.total}</span>` : '';
  const nota = j.nota > 0 ? `<span class="nt">⭐ ${n1(j.nota)}</span>` : '';
  const playing = j.status === 'Jogando' ? '<span class="pl"></span>' : '';
  const novo = isNew ? '<span class="novo">Novo</span>' : '';
  const cap = State.mode === 'filmes' && j.duracao ? fmtDur(j.duracao) : (j.horas ? n1(j.horas)+'h' : '');
  const fallback = j.appid ? `if(!this.dataset.f){this.dataset.f=1;this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${j.appid}/header.jpg'}else this.remove()` : 'this.remove()';
  return `<button class="game" data-idx="${idx}" draggable="${drag}" aria-label="${esc(j.nome)}">
    <div class="ph">${esc(ini)}</div>
    ${j.capa ? `<img src="${esc(j.capa)}" alt="" loading="lazy" draggable="false" onerror="${fallback}">` : ''}
    ${playing}${novo}${nota}
    <div class="cap"><b>${esc(j.nome)}</b>${cap?`<span>${cap}</span>`:''}</div>
    ${conq}
  </button>`;
}

function renderTiers() {
  const el = $('#tiersList'); if(!el) return;
  const q = ($('#searchInput')?.value || '').trim().toLowerCase();
  const L = MODES[State.mode].list;
  const filtered = L.filter(j => (State.filter === 'Todos' || j.status === State.filter) && j.nome.toLowerCase().includes(q));
  const sorted = [...filtered].sort((a,b) => (b.nota||0)-(a.nota||0) || (b.horas||0)-(a.horas||0));
  const rows = TIERS.map(t => tierRow(t, sorted.filter(j => j.tier === t), L));
  const nr = sorted.filter(j => j.tier === 'NR');
  if(nr.length) rows.push(tierRow('NR', nr, L));
  el.innerHTML = rows.join('');
  setupDrag();
}

function tierRow(t, list, all) {
  const m = MODES[State.mode];
  return `<div class="tier t-${t}">
    <div class="tier-label">${t === 'NR' ? '?' : t}</div>
    <div class="tier-games" data-tier="${t}">
      ${list.length ? list.map(j => gameCard(j, all.indexOf(j))).join('') : `<span class="tier-empty">${m.empty}</span>`}
    </div>
  </div>`;
}

function setupDrag() {
  if(!State.user?.admin) return;
  let drag = null;
  $$('.game[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => {
      drag = Number(el.dataset.idx);
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => { el.classList.remove('dragging'); drag = null; $$('.tier-games.drag-over').forEach(x => x.classList.remove('drag-over')); });
  });
  $$('.tier-games').forEach(zone => {
    zone.addEventListener('dragover', e => { if(drag == null) return; e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { if(!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if(drag == null) return;
      const tier = zone.dataset.tier;
      const item = MODES[State.mode].list[drag];
      if(!item || item.tier === tier) { drag = null; return; }
      const old = item.tier;
      item.tier = tier;
      renderStats(); renderTiers();
      toast(`✅ "${item.nome}" → ${tier}`, 'ok');
      try {
        await fetch('/api/admin?action=tierlist-set', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jogos: State.jogos, filmes: State.filmes, logAcao:`Moveu "${item.nome}" de ${old} pra ${tier}` }) });
      } catch(e) {}
      drag = null;
    });
  });
}

/* ---------- VOTOS ---------- */
async function loadVotes() {
  if(!State.user) { State.voteStatus = 'no-login'; renderVotes(); return; }
  try {
    const r = await fetch('/api/votos');
    if(!r.ok) throw 0;
    const d = await r.json();
    State.votes = d.opcoes || [];
    State.myVote = d.meuVoto || null;
    State.voteStatus = 'ok';
  } catch(e) { State.voteStatus = 'error'; }
  renderVotes();
}

function renderVotes() {
  const hlBox = $('#highlightBox'), list = $('#voteList');
  if(!hlBox || !list) return;
  if(!State.user) {
    hlBox.innerHTML = '';
    list.innerHTML = `<div class="locked"><span class="ic">🔒</span><b>Só falta você escolher!</b><p class="muted">Entra com o Discord pra votar e ajudar a decidir o próximo jogo da live 💜</p><a class="login-btn" href="/api/auth?action=login"><svg viewBox="0 0 24 24"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z"/></svg>Entrar com Discord</a></div>`;
    const nc = $('#nextCover'); if(nc) nc.hidden = true;
    return;
  }
  if(!State.votes.length) {
    hlBox.innerHTML = '';
    list.innerHTML = `<p class="muted center pad">${State.voteStatus === 'error' ? 'Votação indisponível.' : 'Carregando…'}</p>`;
    return;
  }
  const total = State.votes.reduce((a,x)=>a+(x.votos||0),0);
  const ord = [...State.votes].sort((a,b)=>(b.votos||0)-(a.votos||0));
  const pct = v => total ? Math.round((v||0)/total*100) : 0;
  const first = ord[0];
  const p1 = pct(first.votos);
  if(total > 0) {
    hlBox.innerHTML = `<div class="highlight">
      ${first.capa ? `<img src="${esc(first.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph2',textContent:'🎮'}))">` : '<div class="ph2">🎮</div>'}
      <div class="info">
        <span class="crown-tag">👑 Líder da votação</span>
        <h3>${esc(first.nome)}</h3>
        <div class="bar"><i style="width:${p1}%"></i></div>
        <small class="muted"><b style="color:var(--purple-2)">${p1}%</b> · ${first.votos}/${total} votos</small>
      </div>
    </div>`;
    const nc = $('#nextCover');
    if(nc) { if(first.capa) { nc.src = first.capa; nc.hidden = false; } else nc.hidden = true; }
    const nn = $('#nextName'); if(nn) nn.textContent = first.nome;
    const ni = $('#nextInfo'); if(ni) ni.textContent = `Liderando com ${p1}% dos votos`;
  } else {
    hlBox.innerHTML = '';
    const nc = $('#nextCover'); if(nc) nc.hidden = true;
    const nn = $('#nextName'); if(nn) nn.textContent = 'Votação aberta';
    const ni = $('#nextInfo'); if(ni) ni.textContent = 'Ainda sem votos. Seja a primeira pessoa a escolher!';
  }
  const RANKS = ['🥇','🥈','🥉'];
  const rest = total > 0 ? ord.slice(1) : ord;
  const voteBtn = it => State.myVote === it.id
    ? `<button class="btn ghost vote-btn" disabled>✓ Votado</button>`
    : `<button class="btn vote-btn" data-vote="${esc(it.id)}">${State.myVote ? 'Trocar' : 'Votar'}</button>`;
  list.innerHTML = rest.map((it,i) => {
    const p = pct(it.votos), pos = i+2, medal = RANKS[i+1] || `#${pos}`;
    const mine = State.myVote === it.id;
    const v = it.votos || 0;
    const diff = (ord[0]?.votos || 0) - v;
    let status, cls;
    if(v === 0) { status = 'Aguardando o primeiro voto'; cls = ''; }
    else if(diff === 0) { status = 'Empatado com o 1º 🔥'; cls = 'close'; }
    else if(diff === 1) { status = 'Só 1 voto atrás do líder'; cls = 'close'; }
    else { status = `${diff} votos atrás do líder`; cls = ''; }
    return `<div class="vote ${mine?'is-mine':''}">
      <span class="rank">${medal}</span>
      ${it.capa ? `<img class="thumb" src="${esc(it.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb'}))">` : '<div class="thumb"></div>'}
      <div class="info">
        <div class="top-row"><b>${esc(it.nome)}</b><span>${pos}º · ${p}%</span></div>
        <span class="status ${cls}">${status}</span>
      </div>
      <div class="bar"><i style="width:${p}%"></i></div>
      ${voteBtn(it)}
    </div>`;
  }).join('') + `<div class="vote-total">Total: ${total} voto${total===1?'':'s'}</div>`;
}

async function castVote(id) {
  if(!State.user) return;
  try {
    const r = await fetch('/api/votos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id}) });
    if(r.status === 401) { await checkLogin(); renderVotes(); return; }
    if(r.status === 403) { const d = await r.json(); toast(d.error||'Banido', 'err'); return; }
    if(r.ok) { const d = await r.json(); State.votes = d.opcoes || []; State.myVote = d.meuVoto || null; }
  } catch(e) {}
  renderVotes();
}

/* ---------- SUGESTÕES ---------- */
async function sendSuggestion() {
  const name = $('#sugName')?.value.trim() || '';
  const type = $('#sugType')?.value || '';
  const text = $('#sugText')?.value.trim() || '';
  const hp = $('#sugHoneypot')?.value || '';
  const btn = $('#sugBtn');
  if(hp) return;
  if(!text) { toast('Escreva sua mensagem!', 'warn'); return; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Enviando…';
  try {
    const r = await fetch('/api/sugestoes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nome:name, tipo:type, texto:text}) });
    if(r.ok) { toast('Mensagem enviada! 💜', 'ok'); $('#sugName').value = ''; $('#sugText').value = ''; }
    else if(r.status === 429) toast('Calma! Aguarde alguns segundos.', 'warn');
    else toast('Não consegui enviar agora.', 'err');
  } catch(e) { toast('Sem conexão.', 'err'); }
  finally { btn.disabled = false; btn.textContent = old; }
}

/* ---------- COMANDOS ---------- */
function renderCommands(q='') {
  const s = q.toLowerCase().trim();
  const list = COMANDOS.filter(c => !s || c.c.toLowerCase().includes(s) || c.d.toLowerCase().includes(s));
  const body = $('#cmdsBody'); if(!body) return;
  body.innerHTML = list.map(c => `<tr><td>${esc(c.c)}</td><td>${esc(c.d)}</td><td style="text-align:right"><button data-copy="${esc(c.c)}">Copiar</button></td></tr>`).join('');
  const empty = $('#cmdsEmpty'); if(empty) empty.hidden = list.length > 0;
}

/* ---------- SETUP ---------- */
const SETUP_DATA = [
  { title:'🖥️ PC Gamer', col:1, items:[
    ['🗄️','Gabinete','Risemode Aquarium branco'],
    ['🧠','Processador','Ryzen 9 5900x'],
    ['🧩','Memória RAM','48GB DDR4'],
    ['🔌','Placa Mãe','X570 TUF Gaming'],
    ['🎮','Placa de Vídeo','RX 6750 XT'],
    ['💧','Water cooler','Risemode Aura RGB']
  ]},
  { title:'💾 Armazenamento & Energia', col:1, items:[
    ['💾','Armazenamento','SSD 2TB NVMe M2'],
    ['⚡','Fonte','Corsair RM800w']
  ]},
  { title:'🖱️ Periféricos', col:2, items:[
    ['⌨','Teclado','AULA H88'],
    ['🖱','Mouse','Logitech G502X Superlight'],
    ['🎧','Headset','Astro A50'],
    ['🎙️','Microfone','FIFINE AM8 Branco'],
    ['🖥️','Monitor','AOC 240Hz'],
    ['📷','Webcam','Logitech C920']
  ]},
  { title:'✨ Wishlist', col:2, items:[
    ['🎥','Câmera profissional','Sony ZV-E10'],
    ['🎤','Microfone pro','Shure SM7B']
  ]}
];

function renderSetup() {
  const g = $('#setupGrid'); if(!g) return;
  const c1 = SETUP_DATA.filter(c => c.col === 1);
  const c2 = SETUP_DATA.filter(c => c.col !== 1);
  const block = cat => `<div class="card"><h3>${cat.title}</h3><div style="display:grid;gap:8px">${cat.items.map(i => `<div class="setup-item"><div class="ic">${i[0]}</div><div class="info"><small>${esc(i[1])}</small><b>${esc(i[2])}</b></div><button class="go" data-product="${esc(i[2])}">🔍</button></div>`).join('')}</div></div>`;
  g.innerHTML = `<div class="setup-col">${c1.map(block).join('')}</div><div class="setup-col">${c2.map(block).join('')}</div>`;
}

function openProductSearch(product) {
  const title = $('#modalTitle'), body = $('#modalBody');
  title.textContent = product;
  body.innerHTML = `
    <p class="muted">Ajuste o termo e escolha a loja:</p>
    <input id="prodSearch" type="text" value="${esc(product)}" class="search full" style="max-width:none">
    <div style="display:grid;gap:8px;margin-top:12px">
      <a class="btn" id="lnkKabum" href="#" target="_blank" rel="noopener" style="background:#ff6500">🛒 KaBuM!</a>
      <a class="btn" id="lnkAmazon" href="#" target="_blank" rel="noopener" style="background:#ff9900;color:#111">🛒 Amazon</a>
    </div>
    <button class="btn ghost full" id="btnCopyProd" style="margin-top:8px">📋 Copiar nome</button>`;
  const inp = $('#prodSearch');
  const upd = () => {
    const q = encodeURIComponent(inp.value.trim() || product);
    $('#lnkKabum').href = `https://www.kabum.com.br/busca/${q}`;
    $('#lnkAmazon').href = `https://www.amazon.com.br/s?k=${q}`;
  };
  inp.addEventListener('input', upd); upd();
  $('#btnCopyProd').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(inp.value); $('#btnCopyProd').textContent = '✓ Copiado!'; } catch {}
    setTimeout(() => $('#btnCopyProd').textContent = '📋 Copiar nome', 1600);
  });
  $('#modal').showModal();
  setTimeout(() => inp.focus(), 50);
}

/* ---------- MÚSICA ---------- */
function loadMusic() {
  const url = 'https://open.spotify.com/playlist/0OV32Qe5e7BJY33rL4tpXk';
  const m = url.match(/playlist\/([a-zA-Z0-9]+)/);
  const box = $('#spotifyEmbed');
  if(box && m) box.innerHTML = `<iframe src="https://open.spotify.com/embed/playlist/${m[1]}?theme=0" width="100%" height="380" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Playlist"></iframe>`;
  checkNowPlaying();
}
async function checkNowPlaying() {
  try {
    const r = await fetch('/api/lastfm', { cache:'no-store' });
    if(!r.ok) return;
    const d = await r.json();
    const box = $('#nowPlaying');
    if(!box) return;
    if(!d.tocando) { box.className = 'now-empty'; box.innerHTML = '🎧 Não estou ouvindo nada agora 💜'; return; }
    box.className = 'highlight';
    box.innerHTML = `
      <img src="${esc(d.capa||'')}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph2',textContent:'♪'}))">
      <div class="info">
        <b style="font-size:1rem">${esc(d.faixa||'—')}</b>
        <span class="muted">${esc(d.artista||'')}${d.album?' · '+esc(d.album):''}</span>
        ${d.url ? `<a class="btn ghost" href="${esc(d.url)}" target="_blank" rel="noopener" style="margin-top:6px;font-size:.75rem;padding:6px 12px;min-height:0">▶ Ouvir</a>` : ''}
      </div>`;
  } catch(e) {}
}

/* ---------- ADMIN ---------- */
function renderAdmin() {
  const area = $('#adminArea'); if(!area) return;
  if(!State.user?.admin) {
    area.innerHTML = `<div class="admin-empty"><b>🔒 Acesso restrito</b>Só admins do site podem ver esta área.</div>`;
    return;
  }
  if(State.admin.page === 'home') adminHome(area);
  else if(State.admin.page === 'votacao') adminVotacao(area);
  else if(State.admin.page === 'tierlist') adminTierList(area);
  else if(State.admin.page === 'admins') adminAdmins(area);
  else if(State.admin.page === 'banidos') adminBanidos(area);
  else if(State.admin.page === 'config') adminConfig(area);
  else if(State.admin.page === 'logs') adminLogs(area);
  else if(State.admin.page === 'backup') adminBackup(area);
}

function adminHeader(title) {
  return `<div class="admin-header"><button class="back-btn" data-admin-back>← Voltar</button><h2>${title}</h2></div>`;
}

function adminHome(area) {
  const cards = [
    ['ver_votos','🗳️','Votação','Ver votos, editar opções e resetar','votacao'],
    ['ver_tierlist','🎮','Tier List','Adicionar, editar e apagar itens','tierlist'],
    ['ver_banidos','🚫','Banidos','Quem não pode votar','banidos'],
    ['ver_admins','👥','Admins','Quem tem acesso ao painel','admins'],
    ['ver_config','⚙️','Config','Aviso, doação, recado, horas','config'],
    ['ver_logs','📋','Logs','Histórico de ações','logs'],
    ['editar_config','💾','Backup','Criar e restaurar backups','backup']
  ].filter(c => hasPerm(c[0]));
  if(!cards.length) { area.innerHTML = `<div class="admin-empty"><b>Você não tem permissão</b>Peça acesso a um administrador.</div>`; return; }
  area.innerHTML = `<div class="admin-menu">${cards.map(c => `<button class="admin-card" data-admin-go="${c[4]}"><span class="ic">${c[1]}</span><h3>${c[2]}</h3><p>${c[3]}</p><span class="cta">Abrir →</span></button>`).join('')}</div>`;
}

async function adminVotacao(area) {
  area.innerHTML = adminHeader('🗳️ Votação') + `<div class="admin-empty">Carregando…</div>`;
  try {
    const r = await fetch('/api/admin?action=votos');
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    State.admin.data = d;
  } catch(e) { area.innerHTML = adminHeader('🗳️ Votação') + `<div class="admin-empty"><b>Erro</b>${esc(e.message)}</div>`; return; }
  const d = State.admin.data;
  const tabs = [
    ['votos',`Votos (${d.usuarios?.length||0})`],
    hasPerm('editar_opcoes') && ['opcoes','Opções']
  ].filter(Boolean);
  area.innerHTML = adminHeader('🗳️ Votação')
    + `<div class="admin-tabs">${tabs.map(t=>`<button class="admin-tab ${State.admin.tab===t[0]?'is-on':''}" data-admin-tab="${t[0]}">${t[1]}</button>`).join('')}</div>`
    + `<div id="adminTabContent"></div>`;
  if(State.admin.tab === 'votos') adminVotosTab();
  else if(State.admin.tab === 'opcoes') adminOpcoesTab();
}

function adminVotosTab() {
  const el = $('#adminTabContent'); if(!el) return;
  const d = State.admin.data;
  const u = d.usuarios || [];
  const map = {}; (d.config||[]).forEach(o => map[o.id] = o);
  el.innerHTML = `<div class="admin-block">
    <h3>🗳️ Votos <span class="count">${u.length}</span></h3>
    ${u.length ? `<div class="admin-list">${u.map(x => {
      const op = map[x.opcao];
      return `<div class="admin-row">
        ${x.avatar ? `<img class="avatar" src="${esc(x.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar-ph',textContent:'👤'}))">` : '<div class="avatar-ph">👤</div>'}
        <div class="info"><b>${x.username ? '@'+esc(x.username) : 'Sem nick'}</b><small>${esc(x.userId)}</small></div>
        <div class="right"><b>${esc(op?.nome || x.opcao)}</b><small>${x.ts ? timeAgo(new Date(x.ts).toISOString()) : 'voto antigo'}</small></div>
      </div>`;
    }).join('')}</div>` : '<div class="admin-empty">Nenhum voto ainda</div>'}
    <div class="admin-actions">
      <button class="a-btn ghost" data-admin-refresh="votacao">🔄 Atualizar</button>
      ${hasPerm('resetar_votos') ? '<button class="a-btn danger" data-reset-votes>🗑️ Resetar votação</button>' : ''}
    </div>
  </div>`;
}

function adminOpcoesTab() {
  const el = $('#adminTabContent'); if(!el) return;
  const d = State.admin.data;
  const opts = d.config || [];
  const cont = d.contagem || {};
  el.innerHTML = `<div class="admin-block">
    <h3>🎯 Opções da votação</h3>
    <div style="display:grid;gap:10px">
      ${opts.length ? opts.map((o,i) => `<div class="item-row">
        ${o.capa ? `<img src="${esc(o.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph3',textContent:'🎮'}))">` : '<div class="ph3">🎮</div>'}
        <div class="info"><b>${esc(o.nome)}</b><small>${o.tipo==='filme'?'🎬 Filme':'🎮 Jogo'} · ${cont[o.id]||0} voto${(cont[o.id]||0)===1?'':'s'}</small></div>
        <button class="mini-btn" data-edit-opt="${i}">Editar</button>
      </div>`).join('') : '<div class="admin-empty">Nenhuma opção</div>'}
    </div>
    <div class="admin-actions">
      <button class="a-btn" data-add-opt>+ Adicionar opção</button>
      <button class="a-btn ghost" data-default-opt>♻️ Restaurar padrão</button>
    </div>
  </div>`;
}

async function adminTierList(area) {
  area.innerHTML = adminHeader('🎮 Tier List') + `<div class="admin-empty">Carregando…</div>`;
  try {
    const r = await fetch('/api/admin?action=tierlist-get');
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    State.admin.tier = { jogos: d.jogos||[], filmes: d.filmes||[] };
  } catch(e) { area.innerHTML = adminHeader('🎮 Tier List') + `<div class="admin-empty"><b>Erro</b>${esc(e.message)}</div>`; return; }
  State.admin.multisel = { on:false, ids:new Set() };
  document.body.classList.remove('is-multisel');
  renderTierAdmin();
}

function renderTierAdmin() {
  const area = $('#adminArea');
  const tab = State.admin.tierTab;
  const list = State.admin.tier[tab];
  const canEdit = hasPerm('editar_tierlist');
  const canImport = hasPerm('importar_steam');
  const sel = State.admin.multisel;
  const allSel = list.length > 0 && sel.ids.size === list.length;
  const bar = sel.on ? `<div class="sel-bar">
    <b>☑️ ${sel.ids.size} de ${list.length} selecionado${sel.ids.size===1?'':'s'}</b>
    <div class="admin-actions" style="margin:0">
      <button class="a-btn ghost" data-sel-all>${allSel?'☐ Desmarcar':'☑️ Selecionar tudo'}</button>
      <button class="a-btn danger" data-del-sel ${sel.ids.size?'':'disabled'}>🗑️ Apagar selecionados</button>
      <button class="a-btn ghost" data-cancel-sel>Cancelar</button>
    </div>
  </div>` : '';

  const rows = list.map((it,i) => {
    if(sel.on) {
      const isSel = sel.ids.has(it.id);
      return `<div class="select-row ${isSel?'is-sel':''}" data-sel-id="${esc(it.id)}">
        <span class="cb"></span>
        ${it.capa ? `<img src="${esc(it.capa)}" style="width:48px;height:62px;border-radius:8px;object-fit:cover" alt="">` : '<div class="ph3" style="width:48px;height:62px;display:grid;place-items:center;background:var(--bg-2);border-radius:8px">🎮</div>'}
        <div class="info"><b>${esc(it.nome)}</b><small>Tier ${esc(it.tier||'—')} · ${esc(it.status||'')}${it.nota?' · ⭐ '+n1(it.nota):''}</small></div>
      </div>`;
    }
    return `<div class="item-row">
      ${it.capa ? `<img src="${esc(it.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph3',textContent:'🎮'}))">` : '<div class="ph3">🎮</div>'}
      <div class="info"><b>${esc(it.nome)}</b><small>Tier ${esc(it.tier||'—')} · ${esc(it.status||'')}${it.nota?' · ⭐ '+n1(it.nota):''}</small></div>
      ${canEdit ? `<button class="mini-btn" data-edit-tier="${i}">Editar</button><button class="mini-btn danger" data-del-tier="${i}">Remover</button>` : ''}
    </div>`;
  }).join('');

  area.innerHTML = adminHeader('🎮 Tier List') + `
    <div class="admin-tabs">
      <button class="admin-tab ${tab==='jogos'?'is-on':''}" data-tier-tab="jogos">🎮 Jogos (${State.admin.tier.jogos.length})</button>
      <button class="admin-tab ${tab==='filmes'?'is-on':''}" data-tier-tab="filmes">🎬 Filmes (${State.admin.tier.filmes.length})</button>
    </div>
    ${bar}
    <div class="admin-block">
      <h3>${tab==='jogos'?'🎮 Jogos':'🎬 Filmes'} <span class="count">${list.length} itens</span></h3>
      <div style="display:grid;gap:8px">${list.length?rows:'<div class="admin-empty">Nenhum item</div>'}</div>
      <div class="admin-actions">
        ${canEdit && !sel.on && list.length ? '<button class="a-btn ghost" data-multisel>☑️ Selecionar vários</button>' : ''}
        ${canEdit ? `<button class="a-btn" data-add-tier>+ Adicionar ${tab==='jogos'?'jogo':'filme'}</button>` : ''}
        ${tab==='jogos' && canImport ? '<button class="a-btn" data-import-steam>📥 Importar da Steam</button>' : ''}
        <button class="a-btn ghost" data-admin-refresh="tierlist">🔄 Recarregar</button>
      </div>
    </div>`;
}

async function adminAdmins(area) {
  area.innerHTML = adminHeader('👥 Admins') + `<div class="admin-empty">Carregando…</div>`;
  let d = { admins: [], meuCargo: null };
  try { const r = await fetch('/api/admin?action=admins-ver'); if(r.ok) d = await r.json(); } catch(e) {}
  const meCargo = d.meuCargo || State.user?.cargo || 'moderador';
  const meLevel = NIVEIS[meCargo] || 0;
  const canManage = hasPerm('editar_admins') && meLevel >= 3;
  const canDev = meCargo === 'dev';
  const rows = (d.admins||[]).map(a => {
    const lvl = NIVEIS[a.cargo] || 0;
    const canEdit = canManage && (canDev || lvl < meLevel) && a.id !== State.user.id;
    return `<div class="admin-row">
      ${a.avatar ? `<img class="avatar" src="${esc(a.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar-ph',textContent:'👤'}))">` : '<div class="avatar-ph">👤</div>'}
      <div class="info"><b>${a.username?'@'+esc(a.username):'Sem nick'}</b><small>${esc(a.id)}</small></div>
      <div class="right">
        <b>${LABEL_CARGO[a.cargo]||a.cargo}${a.fixo?' 🔒':''}</b>
        <div style="display:flex;gap:6px;margin-top:4px">
          ${canEdit ? `<button class="mini-btn" data-edit-admin="${esc(a.id)}" data-name="${esc(a.username||'')}" data-avatar="${esc(a.avatar||'')}" data-cargo="${esc(a.cargo)}">Editar</button>` : ''}
          ${canEdit ? `<button class="mini-btn danger" data-del-admin="${esc(a.id)}">Remover</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  const canPerms = hasPerm('editar_config');
  area.innerHTML = adminHeader('👥 Admins') + `
    <div class="admin-block">
      <h3>👥 Administradores <span class="count">${(d.admins||[]).length}</span></h3>
      <div class="admin-list">${rows || '<div class="admin-empty">Nenhum admin</div>'}</div>
      <div class="admin-actions">
        ${canManage ? '<button class="a-btn" data-add-admin>+ Adicionar admin</button>' : ''}
        <button class="a-btn ghost" data-admin-refresh="admins">🔄 Atualizar</button>
      </div>
    </div>
    <div class="admin-block">
      <h3>📋 Cargos</h3>
      <table class="table">
        <thead><tr><th>Cargo</th><th>Pode fazer</th></tr></thead>
        <tbody>
          <tr><td>🛠️ Dev</td><td>Tudo, incluindo gerenciar Devs</td></tr>
          <tr><td>👑 Dono</td><td>Tudo, menos mexer em Devs</td></tr>
          <tr><td>🛡️ Admin</td><td>Votação, Tier List, banir, ver admins</td></tr>
          <tr><td>🔰 Mod</td><td>Ver votos, tier list, banidos</td></tr>
        </tbody>
      </table>
    </div>
    ${canPerms ? `<div class="admin-block">
      <h3>🔐 Permissões por cargo</h3>
      <p class="muted" style="margin-bottom:14px">Marque o que cada cargo pode fazer. <b>Dev</b> sempre tem tudo.</p>
      <div class="perms-grid" id="permsGrid"><div class="admin-empty">Carregando…</div></div>
      <div class="admin-actions">
        <button class="a-btn" data-save-perms>💾 Salvar</button>
        <button class="a-btn ghost" data-reload-perms>🔄 Recarregar</button>
        <button class="a-btn ghost" data-default-perms>♻️ Restaurar padrão</button>
      </div>
    </div>` : ''}`;
  if(canPerms) loadPerms();
}

async function loadPerms() {
  const grid = $('#permsGrid'); if(!grid) return;
  try {
    const r = await fetch('/api/admin?action=permissoes-get');
    if(!r.ok) throw new Error('HTTP '+r.status);
    const d = await r.json();
    State.admin.perms = d.permissoes;
    State.admin.permLabels = d.labels || {};
    renderPerms();
  } catch(e) { grid.innerHTML = `<div class="admin-empty">Erro: ${esc(e.message)}</div>`; }
}

function renderPerms() {
  const grid = $('#permsGrid'); if(!grid || !State.admin.perms) return;
  const GROUPS = {
    'Votação': ['ver_votos','editar_opcoes','resetar_votos'],
    'Tier List': ['ver_tierlist','editar_tierlist','importar_steam'],
    'Admins': ['ver_admins','editar_admins'],
    'Banidos': ['ver_banidos','editar_banidos'],
    'Config': ['ver_config','editar_config','ver_logs'],
    'Comunidade': ['ver_sugestoes']
  };
  const ORDEM = ['dev','dono','administrador','moderador'];
  grid.innerHTML = ORDEM.map(cargo => {
    const isDev = cargo === 'dev';
    const perms = State.admin.perms[cargo] || [];
    const [ic, ...name] = LABEL_CARGO[cargo].split(' ');
    return `<div class="perm-card">
      <div class="perm-head"><span class="ic">${ic}</span><b>${name.join(' ')}</b><small>${isDev?'acesso total':'customizável'}</small></div>
      ${Object.entries(GROUPS).map(([g, list]) => `
        <div class="perm-group">
          <span class="perm-group-title">${g}</span>
          ${list.map(p => isDev
            ? `<div class="perm-fixed"><input type="checkbox" checked disabled><span>${esc(State.admin.permLabels[p]||p)}</span><span class="lock">fixo</span></div>`
            : `<label class="perm-item"><input type="checkbox" data-cargo="${cargo}" data-perm="${p}" ${perms.includes(p)?'checked':''}><span>${esc(State.admin.permLabels[p]||p)}</span></label>`
          ).join('')}
        </div>`).join('')}
    </div>`;
  }).join('');
}

async function savePerms() {
  if(!State.admin.perms) return;
  const next = {};
  for(const c of ['dev','dono','administrador','moderador']) next[c] = c === 'dev' ? (State.admin.perms.dev||[]) : [];
  $$('#permsGrid input[type=checkbox]').forEach(cb => {
    if(cb.disabled) return;
    const c = cb.dataset.cargo, p = cb.dataset.perm;
    if(!c || !p) return;
    if(cb.checked && !next[c].includes(p)) next[c].push(p);
  });
  try {
    const r = await fetch('/api/admin?action=permissoes-set', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({permissoes:next}) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    State.admin.perms = d.permissoes;
    if(State.user) State.user.perms = d.permissoes[State.user.cargo] || [];
    toast('Permissões salvas! ✅', 'ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

async function adminBanidos(area) {
  area.innerHTML = adminHeader('🚫 Banidos') + `<div class="admin-empty">Carregando…</div>`;
  let banidos = [];
  try { const r = await fetch('/api/admin?action=banidos-ver'); if(r.ok) { const d = await r.json(); banidos = d.banidos||[]; } } catch(e) {}
  const can = hasPerm('editar_banidos');
  area.innerHTML = adminHeader('🚫 Banidos') + `<div class="admin-block">
    <h3>🚫 Banidos de votar <span class="count">${banidos.length}</span></h3>
    <div class="admin-list">${banidos.length ? banidos.map(b => `<div class="admin-row">
      ${b.avatar ? `<img class="avatar" src="${esc(b.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar-ph',textContent:'👤'}))">` : '<div class="avatar-ph">👤</div>'}
      <div class="info"><b>${b.username?'@'+esc(b.username):'Sem nick'}</b><small>${esc(b.id)} · ${esc(b.motivo||'Sem motivo')}</small></div>
      <div class="right"><small>${b.ts?timeAgo(new Date(b.ts).toISOString()):''}</small>${can?`<button class="mini-btn danger" data-del-ban="${esc(b.id)}">Desbanir</button>`:''}</div>
    </div>`).join('') : '<div class="admin-empty">Ninguém banido</div>'}</div>
    <div class="admin-actions">
      ${can ? '<button class="a-btn" data-add-ban>+ Banir usuário</button>' : ''}
      <button class="a-btn ghost" data-admin-refresh="banidos">🔄 Atualizar</button>
    </div>
  </div>`;
}

async function adminConfig(area) {
  area.innerHTML = adminHeader('⚙️ Config') + `<div class="admin-empty">Carregando…</div>`;
  let d = {};
  try { const r = await fetch('/api/admin?action=config-get', { cache:'no-store' }); d = await r.json(); } catch(e) {}
  const av = d.aviso || { ativo:false, tipo:'info', icone:'📢', titulo:'Aviso', texto:'' };
  const top3 = (d.top3||[]).map(p => `${p.nome}${p.valor?' | '+p.valor:''}`).join('\n');
  const hall = (d.hall||[]).map(p => `${p.nome}${p.meta?' | '+p.meta:''}`).join('\n');
  area.innerHTML = adminHeader('⚙️ Config') + `
    <div class="admin-block">
      <h3>📢 Aviso da home</h3>
      <div class="admin-form">
        <label style="flex-direction:row;align-items:center;gap:10px;text-transform:none"><input type="checkbox" id="cfgAvisoAtivo" ${av.ativo?'checked':''} style="width:auto">Mostrar aviso</label>
        <div class="row">
          <label>Ícone<input id="cfgAvisoIcone" type="text" value="${esc(av.icone||'📢')}"></label>
          <label>Tipo<select id="cfgAvisoTipo"><option value="info" ${av.tipo==='info'?'selected':''}>Info</option><option value="warn" ${av.tipo==='warn'?'selected':''}>Aviso</option></select></label>
        </div>
        <label>Título<input id="cfgAvisoTitulo" type="text" value="${esc(av.titulo||'')}"></label>
        <label>Texto<textarea id="cfgAvisoTexto" rows="3">${esc(av.texto||'')}</textarea></label>
      </div>
    </div>
    <div class="admin-block">
      <h3>💜 Doação</h3>
      <div class="admin-form"><label>URL<input id="cfgDonate" type="text" value="${esc(d.donate||'')}"></label></div>
    </div>
    <div class="admin-block">
      <h3>💬 Recado da Soso</h3>
      <div class="admin-form"><label>Texto<textarea id="cfgRecado" rows="3">${esc(d.recado||'')}</textarea></label></div>
    </div>
    <div class="admin-block">
      <h3>📺 Horas do mês</h3>
      <p class="muted" style="margin-bottom:10px">Se vazio, usa o valor automático da Twitch.</p>
      <div class="admin-form"><label>Horas<input id="cfgHoras" type="text" placeholder="Ex: 32h" value="${esc(d.horasMes||'')}"></label></div>
    </div>
    <div class="admin-block">
      <h3>🏆 Top 3 apoiadores</h3>
      <p class="muted" style="margin-bottom:10px">Formato: <code>Nome | valor</code></p>
      <div class="admin-form"><label>Linhas<textarea id="cfgTop3" rows="4">${esc(top3)}</textarea></label></div>
    </div>
    <div class="admin-block">
      <h3>👑 Hall da fama</h3>
      <p class="muted" style="margin-bottom:10px">Formato: <code>Nome | tempo</code></p>
      <div class="admin-form"><label>Linhas<textarea id="cfgHall" rows="5">${esc(hall)}</textarea></label></div>
    </div>
    <div class="admin-block">
      <h3>🔧 Manutenção</h3>
      <label style="display:flex;align-items:center;gap:10px;font-weight:700"><input type="checkbox" id="cfgMaint" ${d.manutencao?'checked':''} style="width:auto">Ligar modo manutenção</label>
    </div>
    <div class="admin-actions">
      <button class="a-btn" data-save-config>💾 Salvar tudo</button>
      <button class="a-btn ghost" data-admin-refresh="config">🔄 Recarregar</button>
    </div>`;
}

async function saveConfig() {
  const parseList = (txt, max) => (txt||'').split('\n').map(l => l.trim()).filter(Boolean).slice(0,max).map(l => {
    const [n, ...r] = l.split('|').map(s => s.trim());
    return { nome: n||'—', valor: r.join(' ').trim()||null };
  });
  const hallParse = (txt, max) => (txt||'').split('\n').map(l => l.trim()).filter(Boolean).slice(0,max).map(l => {
    const [n, ...r] = l.split('|').map(s => s.trim());
    return { nome: n||'—', meta: r.join(' ').trim()||null };
  });
  const body = {
    aviso: { ativo:$('#cfgAvisoAtivo').checked, tipo:$('#cfgAvisoTipo').value, icone:$('#cfgAvisoIcone').value.trim()||'📢', titulo:$('#cfgAvisoTitulo').value.trim()||'Aviso', texto:$('#cfgAvisoTexto').value.trim() },
    donate: $('#cfgDonate').value.trim(),
    recado: $('#cfgRecado').value.trim(),
    horasMes: $('#cfgHoras').value.trim(),
    top3: parseList($('#cfgTop3').value, 3),
    hall: hallParse($('#cfgHall').value, 5),
    manutencao: $('#cfgMaint').checked
  };
  try {
    const r = await fetch('/api/admin?action=config-set', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    Object.assign(State.config, body, { updatedAt: d.updatedAt || new Date().toISOString() });
    renderNotice(); renderSupport(); renderSiteUpdated(); applyMaintenance();
    toast('Salvo! ✅', 'ok');
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

async function adminLogs(area) {
  area.innerHTML = adminHeader('📋 Logs') + `<div class="admin-empty">Carregando…</div>`;
  let logs = [];
  try { const r = await fetch('/api/admin?action=logs-ver'); if(r.ok) { const d = await r.json(); logs = d.logs||[]; } } catch(e) {}
  area.innerHTML = adminHeader('📋 Logs') + `<div class="admin-block">
    <h3>📋 Últimas ações <span class="count">${logs.length}</span></h3>
    <div class="admin-list">${logs.length ? logs.map(l => `<div class="admin-row">
      <div class="avatar-ph">${LABEL_CARGO[l.cargo]?LABEL_CARGO[l.cargo].split(' ')[0]:'👤'}</div>
      <div class="info"><b>@${esc(l.quem||'—')}</b><small>${esc(l.acao||'')}</small></div>
      <div class="right"><small>${l.ts?timeAgo(new Date(l.ts).toISOString()):''}</small></div>
    </div>`).join('') : '<div class="admin-empty">Nenhuma ação registrada</div>'}</div>
    <div class="admin-actions"><button class="a-btn ghost" data-admin-refresh="logs">🔄 Atualizar</button></div>
  </div>`;
}

async function adminBackup(area) {
  area.innerHTML = adminHeader('💾 Backup') + `<div class="admin-empty">Carregando…</div>`;
  let backups = [];
  try { const r = await fetch('/api/backup?action=list'); if(r.ok) { const d = await r.json(); backups = d.backups||[]; } } catch(e) {}
  const fmtSize = b => b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';
  area.innerHTML = adminHeader('💾 Backup') + `<div class="admin-block">
    <h3>💾 Backups <span class="count">${backups.length} / 5</span></h3>
    <p class="muted" style="margin-bottom:14px">Backup automático todo dia às 3h. Os 5 mais recentes são mantidos.</p>
    ${backups.length ? backups.map(b => `<div class="backup-row">
      <div class="ic">📦</div>
      <div class="info"><b>${esc(b.id)}</b><small>${fmtDate(b.criadoEm)} · ${fmtSize(b.tamanho||0)} · @${esc(b.criadoPor||'sistema')}</small></div>
      <div class="actions">
        <a class="mini-btn" href="/api/backup?action=download&id=${encodeURIComponent(b.id)}" download>⬇️</a>
        <button class="mini-btn" data-restore-bkp="${esc(b.id)}">♻️</button>
        <button class="mini-btn danger" data-del-bkp="${esc(b.id)}">🗑️</button>
      </div>
    </div>`).join('') : '<div class="admin-empty">Nenhum backup</div>'}
    <div class="admin-actions">
      <button class="a-btn" data-new-bkp>➕ Criar agora</button>
      <button class="a-btn ghost" data-admin-refresh="backup">🔄 Atualizar</button>
    </div>
  </div>`;
}

/* ---------- ADMIN · MODAIS ---------- */
function modalOpen(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').showModal(); }

function editOption(idx) {
  const opts = [...(State.admin.data.config || [])];
  while(opts.length <= idx) opts.push({id:'',nome:'',tipo:'jogo',capa:null});
  const o = opts[idx] || {nome:'',tipo:'jogo'};
  modalOpen(`Editar opção ${idx+1}`, `
    <div class="admin-form">
      <label>Nome<div class="search-row"><input id="optName" type="text" value="${esc(o.nome||'')}"><button type="button" data-search-opt>🔍</button></div><div id="optSearchStatus" class="muted small"></div></label>
      <label>Tipo<select id="optType"><option value="jogo" ${o.tipo==='jogo'?'selected':''}>🎮 Jogo</option><option value="filme" ${o.tipo==='filme'?'selected':''}>🎬 Filme</option></select></label>
      <label>Capa (URL)<input id="optCover" type="text" value="${esc(o.capa||'')}"><img id="optCoverPrev" class="mini-img" src="${esc(o.capa||'')}" style="${o.capa?'':'display:none'};margin-top:8px" onerror="this.style.display='none'"></label>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="a-btn ghost" data-del-opt="${idx}">Remover</button>
        <button class="a-btn" data-save-opt="${idx}">Salvar</button>
      </div>
    </div>`);
}

function addOption() {
  const idx = (State.admin.data.config || []).length;
  modalOpen('Nova opção', `
    <div class="admin-form">
      <label>Nome<div class="search-row"><input id="optName" type="text"><button type="button" data-search-opt>🔍</button></div><div id="optSearchStatus" class="muted small"></div></label>
      <label>Tipo<select id="optType"><option value="jogo">🎮 Jogo</option><option value="filme">🎬 Filme</option></select></label>
      <label>Capa (URL)<input id="optCover" type="text"><img id="optCoverPrev" class="mini-img" style="display:none;margin-top:8px"></label>
      <div class="admin-actions" style="justify-content:flex-end"><button class="a-btn" data-save-opt="${idx}" data-new="1">Adicionar</button></div>
    </div>`);
}

async function saveOption(idx, isNew) {
  const nome = $('#optName').value.trim();
  const tipo = $('#optType').value;
  const capa = $('#optCover').value.trim();
  if(!nome) { toast('Digite um nome!','warn'); return; }
  const opts = [...(State.admin.data.config || [])];
  while(opts.length <= idx) opts.push({});
  const id = opts[idx].id || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);
  opts[idx] = { id, nome, tipo, capa: capa || null };
  await saveOptions(opts);
}

async function saveOptions(opts) {
  try {
    const r = await fetch('/api/admin?action=opcoes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({opcoes:opts}) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    $('#modal').close();
    toast('Salvo! ✅', 'ok');
    State.admin.page = 'votacao'; State.admin.tab = 'opcoes';
    renderAdmin();
    loadVotes();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

async function resetVotes() {
  const ok = await confirmar('Resetar votação?', 'TODOS os votos serão apagados.', '🗑️', true);
  if(!ok) return;
  try {
    const r = await fetch('/api/admin?action=reset', { method:'POST' });
    if(!r.ok) throw new Error('Falha');
    toast('Votação resetada! ✅', 'ok');
    State.admin.page = 'votacao'; renderAdmin(); loadVotes();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

function editTierItem(idx) {
  const tab = State.admin.tierTab;
  const list = State.admin.tier[tab];
  const it = idx >= 0 ? list[idx] : { nome:'', tier:'NR', status: tab==='jogos'?'Jogando':'Na fila', nota:0, comentario:'', capa:null };
  const statusOpts = tab === 'jogos' ? ['Jogando','Zerado','Dropado','Na fila'] : ['Assistindo','Assistido','Na fila'];
  modalOpen((idx>=0?'Editar ':'Adicionar ')+(tab==='jogos'?'jogo':'filme'), `
    <div class="admin-form">
      <label>Nome<div class="search-row"><input id="tierName" type="text" value="${esc(it.nome||'')}"><button type="button" data-search-tier>🔍</button></div><div id="tierSearchStatus" class="muted small"></div></label>
      <div class="row">
        <label>Tier<select id="tierTier">${['S','A','B','C','NR'].map(t => `<option value="${t}" ${it.tier===t?'selected':''}>${t==='NR'?'Sem tier':t}</option>`).join('')}</select></label>
        <label>Status<select id="tierStatus">${statusOpts.map(s => `<option value="${s}" ${it.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
      </div>
      <div class="row-3">
        <label>Nota (0-10)<input id="tierNota" type="number" min="0" max="10" step="0.1" value="${it.nota||0}"></label>
        ${tab === 'jogos' ? `
          <label>Horas<input id="tierHoras" type="number" min="0" step="0.1" value="${it.horas||0}"></label>
          <label>Conquistas (o/t)<div style="display:flex;gap:6px"><input id="tierConqObt" type="number" min="0" value="${it.conquistas?.obtidas||0}"><input id="tierConqTot" type="number" min="0" value="${it.conquistas?.total||0}"></div></label>
        ` : `
          <label>Duração (min)<input id="tierDur" type="number" min="0" value="${it.duracao||''}"></label>
          <label>Ano<input id="tierAno" type="number" min="1900" max="2100" value="${it.ano||''}"></label>
        `}
      </div>
      <label>Capa (URL)<input id="tierCover" type="text" value="${esc(it.capa||'')}"><img id="tierCoverPrev" class="mini-img" src="${esc(it.capa||'')}" style="${it.capa?'':'display:none'};margin-top:8px" onerror="this.style.display='none'"></label>
      <label>Comentário / Sinopse<textarea id="tierComment" rows="4">${esc(it.comentario||it.sinopse||'')}</textarea>
        <button type="button" class="a-btn ghost" style="align-self:flex-start;font-size:.75rem;padding:6px 12px" data-translate>🌐 Traduzir EN→PT</button>
      </label>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="a-btn ghost" data-modal-close>Cancelar</button>
        <button class="a-btn" data-save-tier="${idx}">${idx>=0?'Salvar':'Adicionar'}</button>
      </div>
    </div>`);
}

async function saveTierItem(idx) {
  const tab = State.admin.tierTab;
  const nome = $('#tierName').value.trim();
  if(!nome) { toast('Digite um nome!','warn'); return; }
  const prev = idx >= 0 ? State.admin.tier[tab][idx] : {};
  const item = {
    id: prev.id || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40),
    nome,
    tier: $('#tierTier').value,
    status: $('#tierStatus').value,
    nota: Number($('#tierNota').value) || 0,
    capa: $('#tierCover').value.trim() || null,
    comentario: $('#tierComment').value.trim(),
    appid: prev.appid || null,
    adicionadoEm: prev.adicionadoEm || new Date().toISOString()
  };
  if(tab === 'jogos') {
    item.horas = Number($('#tierHoras').value) || 0;
    const o = Number($('#tierConqObt').value) || 0;
    const t = Number($('#tierConqTot').value) || 0;
    item.conquistas = (o || t) ? { obtidas:o, total:t } : null;
  } else {
    item.duracao = Number($('#tierDur').value) || null;
    item.ano = Number($('#tierAno').value) || null;
  }
  const list = [...State.admin.tier[tab]];
  if(idx >= 0) list[idx] = item; else list.push(item);
  State.admin.tier[tab] = list;
  await saveTierList(`Editou "${item.nome}"`);
}

async function saveTierList(log) {
  try {
    const r = await fetch('/api/admin?action=tierlist-set', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jogos: State.admin.tier.jogos, filmes: State.admin.tier.filmes, logAcao: log }) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    $('#modal').close();
    toast('Salvo! ✅', 'ok');
    await loadLibrary();
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

async function deleteTierItem(idx) {
  const tab = State.admin.tierTab;
  const item = State.admin.tier[tab][idx];
  const ok = await confirmar('Remover?', `"${item.nome}" sai da tier list.`, '🗑️', true);
  if(!ok) return;
  State.admin.tier[tab] = State.admin.tier[tab].filter((_,i) => i !== idx);
  await saveTierList(`Removeu "${item.nome}"`);
}

async function importFromSteam() {
  const ok = await confirmar('Importar da Steam?', 'Vou buscar seus jogos. A sinopse é traduzida e pode demorar.', '📥');
  if(!ok) return;
  const btn = $('[data-import-steam]');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Importando…'; }
  try {
    const r = await fetch('/api/admin?action=importar-steam', { method:'POST' });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    toast(`✅ ${d.adicionados} adicionados · ${d.pulados} já existiam`, 'ok');
    await loadLibrary(); renderAdmin();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
  finally { if(btn) { btn.disabled = false; btn.textContent = '📥 Importar da Steam'; } }
}

function editAdminModal(id, name, avatar, cargo) {
  modalOpen('Editar admin', `
    <div class="admin-form">
      <label>ID<input type="text" value="${esc(id)}" disabled></label>
      <label>Nick<input type="text" value="${esc(name)}" disabled></label>
      <label>Cargo<select id="editAdminCargo">${['dev','dono','administrador','moderador'].map(c => `<option value="${c}" ${cargo===c?'selected':''}>${LABEL_CARGO[c]}</option>`).join('')}</select></label>
      <div class="admin-actions" style="justify-content:flex-end"><button class="a-btn" data-save-admin="${esc(id)}" data-name="${esc(name)}" data-avatar="${esc(avatar)}">Salvar</button></div>
    </div>`);
}

async function saveAdmin(id, username, avatar) {
  const cargo = $('#editAdminCargo').value;
  try {
    const r = await fetch('/api/admin?action=admins-edit', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:id, cargo, username, avatar }) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    $('#modal').close();
    toast('Salvo! ✅', 'ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

function addAdminModal() {
  modalOpen('Adicionar admin', `
    <div class="admin-form">
      <label>ID do Discord<input id="newAdminId" type="text" placeholder="123456789012345678"></label>
      <label>Cargo<select id="newAdminCargo">${['moderador','administrador','dono','dev'].map(c => `<option value="${c}">${LABEL_CARGO[c]}</option>`).join('')}</select></label>
      <div class="admin-actions" style="justify-content:flex-end"><button class="a-btn" data-save-new-admin>Adicionar</button></div>
    </div>`);
}

async function saveNewAdmin() {
  const userId = $('#newAdminId').value.trim();
  const cargo = $('#newAdminCargo').value;
  if(!userId) { toast('Digite o ID','warn'); return; }
  try {
    const r = await fetch('/api/admin?action=admins-add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId, cargo}) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    $('#modal').close();
    toast('Admin adicionado ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message, 'err'); }
}

async function delAdmin(id) {
  const ok = await confirmar('Remover admin?', 'A pessoa perde acesso.', '🗑️', true);
  if(!ok) return;
  try {
    const r = await fetch('/api/admin?action=admins-remove', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId:id}) });
    if(!r.ok) throw new Error('Falha');
    toast('Removido ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

function addBanModal() {
  modalOpen('Banir usuário', `
    <div class="admin-form">
      <label>ID do Discord<input id="banId" type="text"></label>
      <label>Motivo<input id="banReason" type="text" placeholder="Opcional"></label>
      <div class="admin-actions" style="justify-content:flex-end"><button class="a-btn danger" data-save-ban>Banir</button></div>
    </div>`);
}

async function saveBan() {
  const userId = $('#banId').value.trim();
  const motivo = $('#banReason').value.trim();
  if(!userId) { toast('Digite o ID','warn'); return; }
  try {
    const r = await fetch('/api/admin?action=banidos-add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId, motivo}) });
    if(!r.ok) throw new Error('Falha');
    $('#modal').close();
    toast('Banido ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

async function delBan(id) {
  const ok = await confirmar('Desbanir?', 'A pessoa volta a poder votar.', '✅');
  if(!ok) return;
  try {
    const r = await fetch('/api/admin?action=banidos-remove', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId:id}) });
    if(!r.ok) throw new Error('Falha');
    toast('Desbanido ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

async function restoreBackup(id) {
  const ok = await confirmar('Restaurar?', 'Todos os dados atuais serão substituídos.', '⚠️', true);
  if(!ok) return;
  try {
    const r = await fetch('/api/backup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'restore', id}) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    toast(`✅ Restaurado (${d.total} chaves)`,'ok');
    loadLibrary(); loadConfig(); loadVotes(); loadTwitch();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

async function delBackup(id) {
  const ok = await confirmar('Apagar?', 'O arquivo sai do histórico.', '🗑️', true);
  if(!ok) return;
  try {
    const r = await fetch('/api/backup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'delete', id}) });
    if(!r.ok) throw new Error('Falha');
    toast('Apagado ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

async function newBackup() {
  try {
    toast('Criando backup…','info');
    const r = await fetch('/api/backup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'create'}) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    toast('Backup criado! ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

/* ---------- EVENT DELEGATION ---------- */
function bindEvents() {
  // Navegação
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if(nav) { e.preventDefault(); navigate(nav.dataset.nav); return; }
    if(e.target.closest('[data-goto-sub]')) { navigate('community'); setTimeout(() => { const t = $('[data-ctab="sub"]'); if(t) t.click(); }, 80); return; }
    if(e.target.closest('[data-logout]')) { logout(); return; }
    if(e.target.closest('[data-modal-close]')) { $('#modal').close(); return; }
  });

  // Menu mobile
  $('#menuBtn')?.addEventListener('click', e => {
    const b = e.currentTarget; const open = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!open));
    $('.nav')?.classList.toggle('is-open', !open);
  });

  // Abas públicas
  document.addEventListener('click', e => {
    const seg = e.target.closest('[data-music-tab]');
    if(seg) { switchMusicTab(seg.dataset.musicTab); return; }
    const ct = e.target.closest('[data-ctab]');
    if(ct) { switchCommunityTab(ct.dataset.ctab); return; }
    const mode = e.target.closest('[data-mode]');
    if(mode) { applyMode(mode.dataset.mode); return; }
    const filt = e.target.closest('[data-filter]');
    if(filt) { State.filter = filt.dataset.filter; renderFilters(); renderTiers(); return; }
    const vote = e.target.closest('[data-vote]');
    if(vote) { castVote(vote.dataset.vote); return; }
    const prod = e.target.closest('[data-product]');
    if(prod) { openProductSearch(prod.dataset.product); return; }
    const copy = e.target.closest('[data-copy]');
    if(copy) { copyCmd(copy); return; }
    const clip = e.target.closest('[data-clip]');
    if(clip) { openClip(clip); return; }
    const vod = e.target.closest('[data-vod]');
    if(vod) { playVod(vod.dataset.vod); return; }
    if(e.target.closest('#btnLastVod')) { playVod(); return; }
  });

  // Busca tier list
  $('#searchInput')?.addEventListener('input', renderTiers);
  $('#cmdSearch')?.addEventListener('input', e => renderCommands(e.target.value));
  $('#sugBtn')?.addEventListener('click', sendSuggestion);

  // Admin
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-admin-go]');
    if(go) { State.admin.page = go.dataset.adminGo; renderAdmin(); return; }
    if(e.target.closest('[data-admin-back]')) { State.admin.page = 'home'; renderAdmin(); return; }
    const tab = e.target.closest('[data-admin-tab]');
    if(tab) { State.admin.tab = tab.dataset.adminTab; renderAdmin(); return; }
    const tt = e.target.closest('[data-tier-tab]');
    if(tt) { State.admin.tierTab = tt.dataset.tierTab; renderTierAdmin(); return; }
    const ref = e.target.closest('[data-admin-refresh]');
    if(ref) { State.admin.page = ref.dataset.adminRefresh; renderAdmin(); return; }
    if(e.target.closest('[data-reset-votes]')) { resetVotes(); return; }
    if(e.target.closest('[data-add-opt]')) { addOption(); return; }
    if(e.target.closest('[data-default-opt]')) { restoreDefaultOptions(); return; }
    const eo = e.target.closest('[data-edit-opt]');
    if(eo) { editOption(Number(eo.dataset.editOpt)); return; }
    const do_ = e.target.closest('[data-del-opt]');
    if(do_) { removeOption(Number(do_.dataset.delOpt)); return; }
    const so = e.target.closest('[data-save-opt]');
    if(so) { saveOption(Number(so.dataset.saveOpt), so.dataset.new === '1'); return; }
    if(e.target.closest('[data-search-opt]')) { searchOptCover(); return; }
    if(e.target.closest('[data-add-tier]')) { editTierItem(-1); return; }
    const et = e.target.closest('[data-edit-tier]');
    if(et) { editTierItem(Number(et.dataset.editTier)); return; }
    const dt = e.target.closest('[data-del-tier]');
    if(dt) { deleteTierItem(Number(dt.dataset.delTier)); return; }
    const st = e.target.closest('[data-save-tier]');
    if(st) { saveTierItem(Number(st.dataset.saveTier)); return; }
    if(e.target.closest('[data-search-tier]')) { searchTierAuto(); return; }
    if(e.target.closest('[data-translate]')) { translateComment(); return; }
    if(e.target.closest('[data-import-steam]')) { importFromSteam(); return; }
    if(e.target.closest('[data-multisel]')) { State.admin.multisel = { on:true, ids:new Set() }; renderTierAdmin(); return; }
    if(e.target.closest('[data-cancel-sel]')) { State.admin.multisel = { on:false, ids:new Set() }; renderTierAdmin(); return; }
    if(e.target.closest('[data-sel-all]')) { selAllToggle(); return; }
    if(e.target.closest('[data-del-sel]')) { deleteSelected(); return; }
    const sid = e.target.closest('[data-sel-id]');
    if(sid) { toggleSelItem(sid.dataset.selId); return; }
    if(e.target.closest('[data-add-admin]')) { addAdminModal(); return; }
    const ea = e.target.closest('[data-edit-admin]');
    if(ea) { editAdminModal(ea.dataset.editAdmin, ea.dataset.name, ea.dataset.avatar, ea.dataset.cargo); return; }
    const da = e.target.closest('[data-del-admin]');
    if(da) { delAdmin(da.dataset.delAdmin); return; }
    const sa = e.target.closest('[data-save-admin]');
    if(sa) { saveAdmin(sa.dataset.saveAdmin, sa.dataset.name, sa.dataset.avatar); return; }
    if(e.target.closest('[data-save-new-admin]')) { saveNewAdmin(); return; }
    if(e.target.closest('[data-add-ban]')) { addBanModal(); return; }
    if(e.target.closest('[data-save-ban]')) { saveBan(); return; }
    const db = e.target.closest('[data-del-ban]');
    if(db) { delBan(db.dataset.delBan); return; }
    if(e.target.closest('[data-save-perms]')) { savePerms(); return; }
    if(e.target.closest('[data-reload-perms]')) { loadPerms(); return; }
    if(e.target.closest('[data-default-perms]')) { restoreDefaultPerms(); return; }
    if(e.target.closest('[data-save-config]')) { saveConfig(); return; }
    if(e.target.closest('[data-new-bkp]')) { newBackup(); return; }
    const rb = e.target.closest('[data-restore-bkp]');
    if(rb) { restoreBackup(rb.dataset.restoreBkp); return; }
    const dbk = e.target.closest('[data-del-bkp]');
    if(dbk) { delBackup(dbk.dataset.delBkp); return; }
  });

  // Modal close
  $('#modalClose')?.addEventListener('click', () => $('#modal').close());
  $('#modal')?.addEventListener('click', e => { if(e.target === $('#modal')) $('#modal').close(); });

  // History
  window.addEventListener('popstate', e => { if(e.state?.page) navigate(e.state.page, false); });
}

function switchMusicTab(tab) {
  $$('[data-music-tab]').forEach(b => b.classList.toggle('is-on', b.dataset.musicTab === tab));
  $$('[data-music-panel]').forEach(p => p.hidden = p.dataset.musicPanel !== tab);
  if(tab === 'now') checkNowPlaying();
}

function switchCommunityTab(tab) {
  $$('[data-ctab]').forEach(b => b.classList.toggle('is-on', b.dataset.ctab === tab));
  $$('[data-cpanel]').forEach(p => p.classList.toggle('is-active', p.dataset.cpanel === tab));
  if(tab === 'clips') renderClips();
}

function setupCommunity() {
  const stored = localStorage.getItem('communityTab') || 'discord';
  switchCommunityTab(stored);
}

async function copyCmd(btn) {
  try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = '✓ Copiado'; btn.classList.add('copied'); }
  catch { btn.textContent = 'Erro'; }
  setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 1600);
}

function openClip(btn) {
  const id = btn.dataset.clip, title = btn.dataset.title, views = btn.dataset.views;
  modalOpen(title, `<iframe src="https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&parent=${location.hostname}&autoplay=true" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px"></iframe><p class="muted small" style="text-align:center">👁 ${Number(views).toLocaleString('pt-BR')} views</p>`);
}

function playVod(id) {
  const v = id ? State.twitch.videos?.find(x => x.id === id) : State.twitch.video;
  if(!v) return;
  navigate('home');
  setTimeout(() => {
    const ifr = $('#twitchIframe'), off = $('#offlinePanel'), pn = $('#playerNote');
    if(off) off.hidden = true;
    if(ifr) { ifr.hidden = false; ifr.src = `https://player.twitch.tv/?video=v${v.id}&parent=${location.hostname}&autoplay=false`; }
    if(pn) pn.textContent = `Reprise: ${v.title}`;
    $('.player')?.scrollIntoView({behavior:'smooth', block:'center'});
  }, 100);
}

async function searchOptCover() {
  const name = $('#optName').value.trim(); if(!name) return;
  const type = $('#optType').value;
  const st = $('#optSearchStatus'); st.textContent = '🔎 Buscando…';
  try {
    const r = await fetch(`/api/admin?action=${type==='filme'?'buscar-filme':'buscar-jogo'}&nome=${encodeURIComponent(name)}`);
    const d = await r.json();
    if(d.erro) { st.textContent = '⚠️ '+d.erro; return; }
    if(d.capa) { $('#optCover').value = d.capa; const p = $('#optCoverPrev'); p.src = d.capa; p.style.display = 'block'; }
    st.textContent = '✅ Encontrado!';
    setTimeout(() => st.textContent = '', 2500);
  } catch(e) { st.textContent = '⚠️ Erro'; }
}

async function searchTierAuto() {
  const name = $('#tierName').value.trim(); if(!name) return;
  const tab = State.admin.tierTab;
  const st = $('#tierSearchStatus'); st.textContent = '🔎 Buscando…';
  try {
    const r = await fetch(`/api/admin?action=${tab==='jogos'?'buscar-jogo':'buscar-filme'}&nome=${encodeURIComponent(name)}`);
    const d = await r.json();
    if(d.erro) { st.textContent = '⚠️ '+d.erro; return; }
    if(d.nome) $('#tierName').value = d.nome;
    if(d.capa) { $('#tierCover').value = d.capa; const p = $('#tierCoverPrev'); p.src = d.capa; p.style.display = 'block'; }
    if(d.nota && !Number($('#tierNota').value)) $('#tierNota').value = d.nota;
    if(d.sinopse && !$('#tierComment').value) $('#tierComment').value = d.sinopse;
    if(tab === 'filmes') {
      if(d.duracao && !$('#tierDur').value) $('#tierDur').value = d.duracao;
      if(d.ano && !$('#tierAno').value) $('#tierAno').value = d.ano;
    }
    st.textContent = '✅ Encontrado!';
    setTimeout(() => st.textContent = '', 2500);
  } catch(e) { st.textContent = '⚠️ Erro'; }
}

async function translateComment() {
  const ta = $('#tierComment'); const txt = ta.value.trim();
  if(!txt) { toast('Nada pra traduzir','warn'); return; }
  ta.disabled = true; const orig = ta.value; ta.value = '🌐 Traduzindo…';
  try {
    const r = await fetch('/api/admin?action=traduzir', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({texto:txt}) });
    const d = await r.json();
    if(d.traduzido) { ta.value = d.traduzido; toast('Traduzido ✅','ok'); }
    else { ta.value = orig; toast('Não traduziu','err'); }
  } catch(e) { ta.value = orig; toast('Erro','err'); }
  finally { ta.disabled = false; }
}

function selAllToggle() {
  const list = State.admin.tier[State.admin.tierTab];
  if(State.admin.multisel.ids.size === list.length) State.admin.multisel.ids = new Set();
  else State.admin.multisel.ids = new Set(list.map(i => i.id));
  renderTierAdmin();
}

function toggleSelItem(id) {
  const s = State.admin.multisel;
  if(s.ids.has(id)) s.ids.delete(id); else s.ids.add(id);
  renderTierAdmin();
}

async function deleteSelected() {
  const s = State.admin.multisel;
  const ids = [...s.ids];
  if(!ids.length) { toast('Selecione algo','warn'); return; }
  const ok = await confirmar(`Apagar ${ids.length} itens?`, 'Essa ação não volta.', '🗑️', true);
  if(!ok) return;
  try {
    const r = await fetch('/api/admin?action=tierlist-delete-many', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ids, tipo: State.admin.tierTab}) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error||'Falha');
    toast(`✅ ${d.apagados} apagados`,'ok');
    State.admin.multisel = { on:false, ids:new Set() };
    renderAdmin(); loadLibrary();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

async function restoreDefaultOptions() {
  const ok = await confirmar('Restaurar padrão?', 'As opções voltam pro padrão.', '♻️');
  if(!ok) return;
  await saveOptions([
    { id:'hollow-knight', nome:'Hollow Knight', tipo:'jogo', capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
    { id:'phasmophobia', nome:'Phasmophobia', tipo:'jogo', capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/739630/library_600x900.jpg' },
    { id:'stardew-valley', nome:'Stardew Valley', tipo:'jogo', capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg' }
  ]);
}

async function removeOption(idx) {
  const ok = await confirmar('Remover opção?', 'Essa opção sai da votação.', '🗑️', true);
  if(!ok) return;
  const opts = [...(State.admin.data.config||[])]; opts.splice(idx,1);
  await saveOptions(opts);
}

async function restoreDefaultPerms() {
  const ok = await confirmar('Restaurar padrão?', 'As permissões voltam ao padrão.', '♻️');
  if(!ok) return;
  try {
    const r = await fetch('/api/admin?action=permissoes-get');
    const d = await r.json();
    if(!d.padrao) throw new Error('Padrão indisponível');
    const r2 = await fetch('/api/admin?action=permissoes-set', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({permissoes:d.padrao}) });
    const d2 = await r2.json();
    if(!r2.ok) throw new Error(d2.error||'Falha');
    State.admin.perms = d2.permissoes;
    if(State.user) State.user.perms = d2.permissoes[State.user.cargo] || [];
    toast('Restaurado ✅','ok');
    renderAdmin();
  } catch(e) { toast('Erro: '+e.message,'err'); }
}

async function logout() {
  try { await fetch('/api/auth?action=logout'); } catch(e) {}
  location.reload();
}

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  const hash = location.hash.replace('#','') || 'home';
  const valid = ['home','tierlist','community','setup','suggest','admin'];
  navigate(valid.includes(hash) ? hash : 'home', false);

  renderCommands();
  renderSetup();
  loadConfig();
  loadMusic();
  checkLogin().then(() => { loadVotes(); loadLibrary(); });
  loadTwitch();
  setInterval(loadTwitch, 60000);
  setInterval(checkNowPlaying, 30000);
});