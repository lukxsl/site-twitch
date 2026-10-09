/* ============================================================
   CONFIGURAÇÕES GLOBAIS
   ============================================================ */
const CONFIG = {
  subs: null,
  donate: 'https://midfielder.tv.br/asemtet0',
  siteUpdated: '12/10/2026',
  topDoadores: [],
  atividadeManual: [],
  spotifyPlaylist: 'https://open.spotify.com/playlist/0OV32Qe5e7BJY33rL4tpXk',
  pixKey: 'asemtet0@gmail.com'
};

const AVISO = { ativo: false, tipo: 'info', icone: '📢', titulo: 'Aviso', texto: '' };
const EMOTES = [
  { emoji: '💜', nome: 'amor' }, { emoji: '😭', nome: 'chora' },
  { emoji: '😂', nome: 'risada' }, { emoji: '😡', nome: 'raiva' },
  { emoji: '😱', nome: 'pog' }, { emoji: '🎮', nome: 'gg' }
];
const MARCOS = [50,100,250,500,1000,2500,5000,10000,25000,50000];
const HOST = window.location.hostname || 'localhost';
const COMANDOS_LISTA = [
  { c:'!discord', d:'Link do Discord' }, { c:'!insta', d:'Instagram da Soso' },
  { c:'!social', d:'Instagram, Discord e TikTok' }, { c:'!lurk', d:'Avisar que vai ficar de lurk' },
  { c:'!uptime', d:'Tempo de live' }, { c:'!commands', d:'Lista de comandos' }
];
const NIVEIS = { dev: 4, dono: 3, administrador: 2, moderador: 1 };
const LABEL_CARGO = { dev: '🛠️ Dev', dono: '👑 Dono', administrador: '🛡️ Administrador', moderador: '🔰 Moderador' };
const STATUS_TOOLTIP = {
  'Todos': 'Ver todos os itens', 'Jogando': 'Estou jogando atualmente', 'Zerado': 'Terminei a história principal',
  'Dropado': 'Comecei mas não vou continuar', 'Na fila': 'Quero jogar/assistir em breve',
  'Assistindo': 'Estou assistindo agora', 'Assistido': 'Já assisti'
};
const SUG_MAX_CHARS = 300;
const STATUS_SUG = {
  nova:     { label: '🟡 Nova',       cor: 'amarelo',   desc: 'Acabou de chegar' },
  analise:  { label: '👀 Em análise', cor: 'azul',      desc: 'A Soso viu e tá pensando' },
  aceita:   { label: '✅ Aceita',     cor: 'verde',     desc: 'Vai rolar!' },
  recusada: { label: '❌ Recusada',   cor: 'vermelho',  desc: 'Não vai rolar' },
  concluido:{ label: '🏁 Concluído',  cor: 'roxo',      desc: 'Finalizado' }
};
const ROTULO_CONCLUIDO = {
  'Sugestão / ideia':      '🏁 Aplicada',
  'Sugestão de jogo':      '🏁 Jogado',
  'Feedback':              '🏁 Resolvido',
  'Reportar bug do site':  '🏁 Corrigido'
};

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let USUARIO = null;
let JOGOS = [];
let FILMES = [];
let VOTOS_DADOS = [], meuVoto = null, votoStatus = 'carregando';
let VOTOS_FECHAMENTO = null;
let ultGame = null, ultVivo = false;
let dragItem = null;
let clipsOk = false, clipsCache = [], dlgClip = null;
let ADMIN_PAGE = 'home';
let ADMIN_TAB = 'votos';
let ADMIN_DADOS = null;
let ADMIN_TIER_TAB = 'jogos';
let ADMIN_TIER = { jogos: [], filmes: [] };
let ADMIN_MULTISEL = { ativo: false, ids: new Set() };
let vodAtual = null, assistindoVod = false;
let videosTw = [];
let inicioLive = null;
let modo = 'jogos', filtro = 'Todos';
let CONFIG_GERAL = {
  aviso: null, donate: null, manutencao: false, recado: '', horasMes: '', updatedAt: null, top3: [], hall: [], votosFechamento: null
};
let musicaTab = 'ouvindo';
let musicaTocando = false;
let revealObs = null;
let sugTipoAtual = 'Sugestão / ideia';
let sirFiltro = 'all';
let SIR_ITENS_CACHE = [];
let _musicaAtual = null;

/* ============================================================
   HELPERS GERAIS
   ============================================================ */
const nivel = cargo => NIVEIS[cargo] || 0;

function temPerm(perm){
  if(!USUARIO || !USUARIO.admin) return false;
  if(USUARIO.cargo === 'dev') return true;
  return (USUARIO.permissoes || []).includes(perm);
}
window.temPerm = temPerm;

function plural(n, singular, plural){
  return Number(n) === 1 ? singular : plural;
}

/* ============================================================
   LAZY LOAD — ADMIN FILES
   ============================================================ */
function garantirAdminCarregado(){
  if(window.__adminCarregado) return Promise.resolve();
  if(window.__adminCarregando) return window.__adminCarregando;

  window.__adminCarregando = new Promise((resolve, reject) => {
    const files = [
      'js/admin/admin.js',
      'js/admin/dashboard.js',
      'js/admin/forms.js',
      'js/admin/tables.js'
    ];
    let loaded = 0;

    files.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = () => {
        loaded++;
        if(loaded === files.length){
          window.__adminCarregado = true;
          window.__adminCarregando = null;
          resolve();
        }
      };
      s.onerror = () => {
        window.__adminCarregando = null;
        reject(new Error(`Falha ao carregar ${src}`));
      };
      document.head.appendChild(s);
    });
  });
  return window.__adminCarregando;
}
window.garantirAdminCarregado = garantirAdminCarregado;

/* ============================================================
   TOAST & CONFIRM
   ============================================================ */
function toast(msg, tipo = 'ok'){
  const el = document.createElement('div');
  el.className = 'toast toast-' + tipo;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-on'));
  setTimeout(() => {
    el.classList.remove('toast-on');
    setTimeout(() => el.remove(), 400);
  }, 4600);
}
window.toast = toast;

function confirmar(titulo = 'Confirmar?', texto = 'Tem certeza?', icone = '⚠️'){
  return new Promise(resolve => {
    const dlg = $('confirmDlg');
    if(!dlg){ resolve(confirm(titulo + '\n' + texto)); return; }
    $('confirmIcon').textContent = icone;
    $('confirmTitle').textContent = titulo;
    $('confirmText').textContent = texto;
    const fechar = (ok) => {
      dlg.close();
      $('confirmOk').removeEventListener('click', onOk);
      $('confirmCancel').removeEventListener('click', onCancel);
      dlg.removeEventListener('cancel', onCancel);
      resolve(ok);
    };
    const onOk = () => fechar(true);
    const onCancel = (e) => { if(e) e.preventDefault(); fechar(false); };
    $('confirmOk').addEventListener('click', onOk);
    $('confirmCancel').addEventListener('click', onCancel);
    dlg.addEventListener('cancel', onCancel);
    dlg.showModal();
  });
}
window.confirmar = confirmar;

/* ============================================================
   ANIMAÇÕES & RENDER BÁSICO
   ============================================================ */
function animarNumero(el, alvo, duracao = 1200){
  if(!el) return;
  const fim = Number(alvo) || 0;
  if(fim <= 0){ el.textContent = '0'; return; }
  const t0 = performance.now();
  el.classList.add('counter-up');
  function tick(now){
    const t = Math.min(1, (now - t0) / duracao);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(fim * ease).toLocaleString('pt-BR');
    if(t < 1) requestAnimationFrame(tick);
    else setTimeout(() => el.classList.remove('counter-up'), 300);
  }
  requestAnimationFrame(tick);
}

function atualizarMeta(pre, atual, marcos = MARCOS, animar = false){
  const elDesc = $(pre+'Desc'), elNum = $(pre+'Num'), elBar = $(pre+'Bar');
  if(!elDesc || !elNum || !elBar) return;
  if (atual == null || isNaN(atual)) {
    elDesc.textContent = 'Indisponível no momento';
    elNum.textContent = '—';
    elBar.style.width = '0%';
    return;
  }
  const alvo = marcos.find(m => m > atual) || atual + 1000;
  if(animar){
    const valorOriginal = atual;
    const t0 = performance.now();
    const duracao = 1200;
    elNum.classList.add('counter-up');
    function tick(now){
      const t = Math.min(1, (now - t0) / duracao);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = Math.round(valorOriginal * ease);
      elNum.textContent = `${val.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')}`;
      if(t < 1) requestAnimationFrame(tick);
      else setTimeout(() => elNum.classList.remove('counter-up'), 300);
    }
    requestAnimationFrame(tick);
  } else {
    elNum.textContent = `${atual.toLocaleString('pt-BR')} / ${alvo.toLocaleString('pt-BR')}`;
  }
  elBar.style.width = Math.min(100, atual / alvo * 100) + '%';
  elDesc.textContent = `Faltam ${(alvo - atual).toLocaleString('pt-BR')} para alcançar a próxima meta!`;
}

function renderAviso(){
  const box = $('avisoBox'); if(!box) return;
  if(AVISO && AVISO.ativo && AVISO.texto){
    $('avisoTexto').textContent = AVISO.texto;
    $('avisoTitulo').textContent = AVISO.titulo || 'Aviso';
    $('avisoIcon').textContent = AVISO.icone || '📢';
    box.className = 'aviso reveal in ' + (AVISO.tipo === 'warn' ? 'warn' : '');
    box.style.display = 'flex';
  } else box.style.display = 'none';
}

function renderEmotes(){
  const html = EMOTES.map(e => {
    if(e.img) return `<div class="emote" title="${esc(e.nome || '')}"><img src="${esc(e.img)}" alt="${esc(e.nome || '')}" loading="lazy" onerror="this.replaceWith(document.createTextNode('💜'))"></div>`;
    return `<div class="emote" title="${esc(e.nome || '')}">${e.emoji || '💜'}</div>`;
  }).join('');
  const g1 = $('emotesGrid'); if(g1) g1.innerHTML = html;
  const g2 = $('emotesGridComunidade'); if(g2) g2.innerHTML = html;
}

function renderSiteUpdate(){
  const el = $('siteUpdated'); if(!el) return;
  const iso = CONFIG_GERAL.updatedAt;
  el.textContent = iso ? fmtDataHora(iso) : (CONFIG.siteUpdated || new Date().toLocaleDateString('pt-BR'));
}

function renderTop3(){
  const box = $('top3Lista'); if(!box) return;
  const lista = Array.isArray(CONFIG_GERAL.top3) ? CONFIG_GERAL.top3.slice(0,3) : [];
  if(!lista.length){
    box.innerHTML = `<p class="ap-vazio">O pódio ainda está vazio. 💜</p>`;
    return;
  }
  const medalhas = ['🥇','🥈','🥉'];
  box.innerHTML = lista.map((p, i) => `
    <div class="top3-card">
      <span class="t3-medal">${medalhas[i]}</span>
      <span class="t3-name">${esc(p.nome || '—')}</span>
      ${p.valor ? `<span class="t3-val">${esc(p.valor)}</span>` : ''}
    </div>
  `).join('');
}

function renderHall(){
  const box = $('hallLista'); if(!box) return;
  const lista = Array.isArray(CONFIG_GERAL.hall) ? CONFIG_GERAL.hall.slice(0,5) : [];
  if(!lista.length){
    box.innerHTML = `<p class="ap-vazio">Em breve os maiores subs da história. 👑</p>`;
    return;
  }
  box.innerHTML = lista.map((p, i) => `
    <div class="hall-row">
      <span class="hr-pos">${i + 1}</span>
      <span class="hr-name">@${esc(p.nome || '—')}</span>
      <span class="hr-meta">${esc(p.meta || '')}</span>
    </div>
  `).join('');
}

function renderHomeExtras(){
  const recadoEl = $('recadoSoso');
  if(recadoEl){
    const r = (CONFIG_GERAL.recado || '').trim();
    recadoEl.textContent = r || 'Sem recadinho no momento. Volte mais tarde! 💜';
    recadoEl.style.fontStyle = r ? 'italic' : 'normal';
  }
  renderTop3();
  renderHall();
}

/* ============================================================
   CARD TABS
   ============================================================ */
function setupCardTabs(){
  document.querySelectorAll('.card-tabs').forEach(tabs => {
    if(tabs.dataset.bound) return;
    tabs.dataset.bound = '1';
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('.card-tab');
      if(!btn) return;
      const card = tabs.closest('.card');
      if(!card) return;
      card.querySelectorAll('.card-tab').forEach(t => t.classList.toggle('on', t === btn));
      card.querySelectorAll('.card-tab-content').forEach(c =>
        c.classList.toggle('on', c.dataset.content === btn.dataset.tab)
      );
    });
  });
}

/* ============================================================
   MODO FOCO (com chat da Twitch)
   ============================================================ */
function toggleFocusMode(){
  const ativo = document.body.classList.toggle('focus-mode');
  const btn = document.getElementById('focusModeBtn');
  if(btn) btn.classList.toggle('on', ativo);
  const chat = document.getElementById('focusChatIframe');
  if(chat){
    if(ativo){
      chat.src = `https://www.twitch.tv/embed/asemtet0/chat?parent=${HOST}&darkpopout`;
    } else {
      chat.src = 'about:blank';
    }
  }
  try { localStorage.setItem('focusMode', ativo ? '1' : '0'); } catch(e){}
  // scroll pro topo, senão pode ficar em meio de rolagem
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.toggleFocusMode = toggleFocusMode;

function restaurarFocusMode(){
  try {
    if(localStorage.getItem('focusMode') === '1'){
      document.body.classList.add('focus-mode');
      document.getElementById('focusModeBtn')?.classList.add('on');
      const chat = document.getElementById('focusChatIframe');
      if(chat) chat.src = `https://www.twitch.tv/embed/asemtet0/chat?parent=${HOST}&darkpopout`;
    }
  } catch(e){}
}

/* ============================================================
   MÚSICA
   ============================================================ */
function renderPlaylist(){
  const embed = $('musicEmbed'); if(!embed) return;
  const url = CONFIG.spotifyPlaylist;
  if(!url){ embed.innerHTML = `<p class="music-placeholder">🎧 Playlist em breve — a Soso está montando!</p>`; return; }
  const m = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if(!m){ embed.innerHTML = `<p class="music-placeholder">🎧 Link da playlist inválido.</p>`; return; }
  embed.innerHTML = `<iframe src="https://open.spotify.com/embed/playlist/${m[1]}?theme=0"
    width="100%" height="152" frameborder="0" allowtransparency="true"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    loading="lazy" title="Playlist do Spotify"></iframe>`;
}

function trocarMusicaTab(tab){
  musicaTab = tab;
  document.querySelectorAll('.music-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  const painelPlaylist = $('musicPainelPlaylist');
  const painelOuvindo = $('musicPainelOuvindo');
  if(painelPlaylist) painelPlaylist.classList.toggle('on', tab === 'playlist');
  if(painelOuvindo) painelOuvindo.classList.toggle('on', tab === 'ouvindo');
  if(tab === 'playlist') renderPlaylist();
  if(tab === 'ouvindo') renderOuvindo();
}
window.trocarMusicaTab = trocarMusicaTab;

function _iniciaisFaixa(nome){
  if(!nome) return '♪';
  const palavras = String(nome).trim().split(/\s+/).filter(Boolean);
  if(!palavras.length) return '♪';
  if(palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

function _fmtMs(ms){
  if(!ms && ms !== 0) return '--:--';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function renderOuvindo(){
  const painel = $('musicPainelOuvindo'); if(!painel) return;
  if(!musicaTocando){
    painel.innerHTML = `<div class="ouvindo-vazio">🎧 Não estou ouvindo nada agora 💜</div>`;
    return;
  }
  const d = _musicaAtual || {};
  const iniciais = _iniciaisFaixa(d.faixa);
  const pct = (d.duracao && d.progresso) ? Math.min(100, (d.progresso / d.duracao) * 100) : 0;

  painel.innerHTML = `
    <div class="ouvindo-wrap" id="ouvindoWrap">
      <div class="vinyl" id="ouvindoVinyl">
        ${d.capa ? `<img src="${esc(d.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'vinyl-fallback',textContent:'${iniciais}'}))">` : `<div class="vinyl-fallback">${iniciais}</div>`}
        <div class="vinyl-center"></div>
      </div>
      <div class="ouvindo-info">
        <b id="ouvindoFaixa">${esc(d.faixa || '—')}</b>
        <span id="ouvindoArtista">${esc(d.artista || '')}${d.album ? ' · ' + esc(d.album) : ''}</span>
        ${d.duracao ? `
          <div class="ouvindo-progress">
            <i id="ouvindoProgress" style="width:${pct}%"></i>
          </div>
          <div class="ouvindo-times">
            <span id="ouvindoAtual">${_fmtMs(d.progresso || 0)}</span>
            <span id="ouvindoTotal">${_fmtMs(d.duracao)}</span>
          </div>
        ` : ''}
        ${d.url ? `<a class="ouvindo-link" href="${esc(d.url)}" target="_blank" rel="noopener">▶ Ouvir no Spotify</a>` : ''}
      </div>
    </div>`;
}

function pintarOuvindo(d){
  if(!d || !d.tocando) return;
  _musicaAtual = d;
  const wrap = $('ouvindoWrap');
  if(wrap){
    wrap.classList.add('fade');
    setTimeout(() => renderOuvindo(), 220);
  } else {
    renderOuvindo();
  }
}

async function carregarOuvindoAgora(){
  try {
    const r = await fetch('/api/lastfm', { cache: 'no-store' });
    if(!r.ok) { musicaTocando = false; return; }
    const d = await r.json();
    if(!d || !d.tocando || !d.faixa){
      musicaTocando = false;
      _musicaAtual = null;
      renderOuvindo();
      return;
    }
    const musicaMudou = !_musicaAtual || _musicaAtual.faixa !== d.faixa || _musicaAtual.artista !== d.artista;
    musicaTocando = true;
    _musicaAtual = d;
    if(musicaTab === 'ouvindo'){
      if(musicaMudou) pintarOuvindo(d);
      else renderOuvindo();
    }
  } catch(e) {
    musicaTocando = false;
  }
}

function setLivePulse(isLive){
  document.querySelectorAll('.live-indicator').forEach(el => el.classList.toggle('live', !!isLive));
  const badge = $('bannerLiveBadge');
  if(badge) badge.classList.toggle('live', !!isLive);
}

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
let _ultimaAba = null;
let _mudarAbaTimer = null;
let _mudarAbaPendente = null;

const ABAS_VALIDAS = ['inicio','tierlist','comunidade','setup','sugestoes','admin'];

function _executarMudarAba(nome, salvar){
  if(!ABAS_VALIDAS.includes(nome)) nome = 'inicio';

  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('ativo'));
  document.querySelectorAll('nav ul button').forEach(b => b.classList.remove('on'));
  const section = $('sec-' + nome), button = $('btn-' + nome);
  if(section) section.classList.add('ativo');
  if(button) button.classList.add('on');

  if(nome !== 'admin' && _ultimaAba === 'admin'){
    try { localStorage.removeItem('admin:page'); } catch(e){}
    ADMIN_PAGE = 'home';
  }
  if(nome === 'admin'){
    const hash = (location.hash || '').replace(/^#/, '');
    if(hash.startsWith('admin/')){
      const p = hash.slice(6);
      if(typeof VALID_ADMIN_PAGES !== 'undefined' && VALID_ADMIN_PAGES.includes(p)) ADMIN_PAGE = p;
    }
  }
  _ultimaAba = nome;

  try {
    if(nome === 'admin'){
      // mantém
    } else {
      history.replaceState(null, '', '#' + nome);
    }
  } catch(e){}

  window.scrollTo({ top:0, behavior:'smooth' });

  if(nome === 'admin'){
    garantirAdminCarregado()
      .then(() => {
        if(typeof carregarAdmin === 'function') carregarAdmin();
      })
      .catch(err => {
        console.error('Erro ao carregar admin:', err);
        const area = $('adminArea');
        if(area){
          area.innerHTML = `<div class="admin-vazio">
            <b>Erro ao carregar o painel admin</b>
            Verifique sua conexão e recarregue a página.
          </div>`;
        }
      });
  }

  if(section) section.querySelectorAll('.reveal:not(.in)').forEach(el => revealObs && revealObs.observe(el));
}

function mudarAba(nome, salvar = true){
  if(_mudarAbaPendente === nome) return;
  _mudarAbaPendente = nome;
  if(_mudarAbaTimer) clearTimeout(_mudarAbaTimer);
  _mudarAbaTimer = setTimeout(() => {
    _mudarAbaTimer = null;
    _mudarAbaPendente = null;
    _executarMudarAba(nome, salvar);
  }, 60);
}
window.mudarAba = mudarAba;

function abrirSejaSub(){
  mudarAba('comunidade');
  setTimeout(() => {
    const tab = document.querySelector('.sub-tab[data-tab="sub"]');
    if(tab) tab.click();
  }, 100);
}
window.abrirSejaSub = abrirSejaSub;

function setupComunidadeTabs(){
  const wrap = $('comunidadeTabs'); if(!wrap) return;
  const ativarTab = (tab) => {
    localStorage.setItem('comunidade:tab', tab);
    wrap.querySelectorAll('.sub-tab').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
    document.querySelectorAll('#sec-comunidade .sub-panel').forEach(p => {
      p.classList.toggle('on', p.dataset.panel === tab);
    });
  };
  const salva = localStorage.getItem('comunidade:tab') || 'discord';
  ativarTab(salva);
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.sub-tab'); if(!b) return;
    ativarTab(b.dataset.tab);
  });
}

/* ============================================================
   COMANDOS
   ============================================================ */
function renderComandos(filtroTxt = ''){
  const q = filtroTxt.toLowerCase().trim();
  const lista = COMANDOS_LISTA.filter(x => !q || x.c.toLowerCase().includes(q) || x.d.toLowerCase().includes(q));
  const body = $('cmdsBody'); if(!body) return;
  body.innerHTML = lista.map(x =>
    `<tr><td>${esc(x.c)}</td><td>${esc(x.d)}</td><td style="text-align:right"><button data-c="${esc(x.c)}">Copiar</button></td></tr>`
  ).join('');
  const e = $('cmdsEmpty'); if(e) e.style.display = lista.length ? 'none' : '';
}

/* ============================================================
   TIER LIST
   ============================================================ */
const TIERS = ['S','A','B','C'];

const JOGOS_FALLBACK = [
  { id:'red-dead-2', nome:'Red Dead Redemption 2', appid:1174180, tier:'S', status:'Jogando', horas:50, nota:8,
    capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900.jpg',
    comentario:'Um dos mundos mais vivos e detalhados dos games.' },
  { id:'hollow-knight', nome:'Hollow Knight', tier:'S', status:'Zerado', nota:9, horas:40,
    capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg', comentario:'' },
  { id:'stardew-valley', nome:'Stardew Valley', tier:'A', status:'Jogando', nota:8, horas:120,
    capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg', comentario:'' }
];
const FILMES_FALLBACK = [
  { id:'interestelar', nome:'Interestelar', tier:'S', status:'Assistido', nota:9, duracao:169, ano:2014,
    capa:'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    comentario:'As reservas naturais da Terra estão chegando ao fim e um grupo de astronautas recebe a missão de verificar possíveis planetas.' }
];

async function carregarBiblioteca(){
  try{
    const r = await fetch('/api/tierlist');
    const d = r.ok ? await r.json() : {};
    JOGOS = (Array.isArray(d.jogos) && d.jogos.length) ? d.jogos : JOGOS_FALLBACK;
    FILMES = (Array.isArray(d.filmes) && d.filmes.length) ? d.filmes : FILMES_FALLBACK;
  }catch(e){
    JOGOS = JOGOS_FALLBACK;
    FILMES = FILMES_FALLBACK;
  }
  desenharStats(); desenhar(); atualizarFoco(ultGame, ultVivo);
}
window.carregarBiblioteca = carregarBiblioteca;

const MODOS = {
  jogos: {
    get lista(){ return JOGOS; },
    status:['Todos','Jogando','Zerado','Dropado','Na fila'],
    feito:'Zerado', plural:'jogos', hrs:'horas jogadas', hl:'horas jogadas',
    l4:'jogos zerados', titulo:'Tier List de Jogos',
    sub:'Tudo o que eu já joguei ou pretendo jogar, do melhor ao pior. Clique em um jogo para ver os detalhes.',
    busca:'Buscar jogo...', vazio:'Nenhum jogo aqui'
  },
  filmes: {
    get lista(){ return FILMES; },
    status:['Todos','Assistindo','Assistido','Na fila'],
    feito:'Assistido', plural:'filmes', hrs:'duração total', hl:'duração',
    l4:'filmes assistidos', titulo:'Tier List de Filmes',
    sub:'Tudo o que eu já assisti ou pretendo assistir, do melhor ao pior. Clique em um filme para ver os detalhes.',
    busca:'Buscar filme...', vazio:'Nenhum filme aqui'
  }
};
const LISTA = () => MODOS[modo].lista;
const fh = h => (Math.round(h * 10) / 10).toLocaleString('pt-BR') + 'h';

function desenharStats(){
  const m = MODOS[modo], L = m.lista, cn = L.filter(j => j.nota > 0);
  const media = cn.length ? cn.reduce((a,j) => a + j.nota, 0) / cn.length : 0;
  let totalLabel;
  if (modo === 'filmes') {
    const totalMin = L.reduce((a,j) => a + (j.duracao || 0), 0);
    totalLabel = fmtDuracao(totalMin) || '—';
  } else {
    const hs = Math.round(L.reduce((a,j) => a + (j.horas || 0), 0) * 10) / 10;
    totalLabel = hs.toLocaleString('pt-BR');
  }
  const el = $('stats'); if(!el) return;
  const dados = [
    [L.length, m.plural + ' na lista'],
    [totalLabel, m.hrs],
    [media ? n1(media) : '—', 'média das notas'],
    [L.filter(j => j.status === m.feito).length, m.l4]
  ];
  el.innerHTML = dados.map(x => `<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
  const bEls = el.querySelectorAll('.stat b');
  if(bEls[0] && !isNaN(Number(dados[0][0]))) animarNumero(bEls[0], Number(dados[0][0]));
  if(bEls[3] && !isNaN(Number(dados[3][0]))) animarNumero(bEls[3], Number(dados[3][0]));
}

function atualizarFoco(game, aoVivo){
  ultGame = game; ultVivo = aoVivo;
  const j = game ? JOGOS.find(x => norm(x.nome) === norm(game.name)) : (JOGOS.find(x => x.status === 'Jogando') || JOGOS[0]);
  const nome = game ? game.name : (j && j.nome);
  const c = $('focoCover');
  if(c) c.classList.remove('skeleton');
  if(!nome) return;
  const capa = (j && j.capa) || (game && game.box_art) || '';
  const elNome = $('focoNome'); if(!elNome) return;
  elNome.textContent = nome;
  $('focoLabel').textContent = aoVivo ? '🔴 Jogando agora' : '🎮 Último jogo jogado';
  const chips = [];
  if(j && j.tier && j.tier !== 'NR') chips.push(`<span class="foco-chip tr">Tier ${esc(j.tier)}</span>`);
  if(j && j.nota > 0) chips.push(`<span class="foco-chip">⭐ ${n1(j.nota)}</span>`);
  if(j && j.horas > 0) chips.push(`<span class="foco-chip">⏱ ${fh(j.horas)}</span>`);
  if(j && j.status) chips.push(`<span class="foco-chip">${esc(j.status)}</span>`);
  if(!chips.length) chips.push('<span class="foco-chip">Ainda sem nota na tier list</span>');
  $('focoMeta').innerHTML = chips.join('');
  const pr = j && j.progresso != null && j.progresso > 0;
  $('focoBar').style.display = pr ? '' : 'none';
  if(pr){ $('focoPct').textContent = j.progresso + '%'; $('focoBarI').style.width = j.progresso + '%'; }
  const v = vodAtual;
  $('focoHoras').textContent = aoVivo ? 'Entra no chat e vem jogar junto! 💜' : (v && v.created_at ? `Última live ${tempoAtras(v.created_at)}${v.duration ? ' · ' + durTw(v.duration) : ''}` : '');
  if(capa){ c.onerror = () => { c.style.display = 'none'; }; c.src = capa; c.style.display = ''; }
  else c.style.display = 'none';
  const twLink = $('focoTwitchLink');
  if(twLink){
    if(aoVivo){ twLink.href = 'https://www.twitch.tv/asemtet0'; twLink.style.display = ''; }
    else twLink.style.display = 'none';
  }
}

function renderChips(){
  $('chips').innerHTML = MODOS[modo].status.map(s => {
    const tip = STATUS_TOOLTIP[s] || s;
    return `<button class="chip" data-s="${s}" aria-pressed="${s === filtro}" title="${esc(tip)}">${s}</button>`;
  }).join('');
}

function aplicarModo(novo, salvar = true){
  if(!MODOS[novo]) novo = 'jogos';
  modo = novo; filtro = 'Todos';
  $('q').value = '';
  document.querySelectorAll('#modo button').forEach(x => x.classList.toggle('on', x.dataset.m === modo));
  const m = MODOS[modo];
  $('tlTitulo').textContent = m.titulo;
  $('tlSub').textContent = m.sub;
  $('q').placeholder = m.busca;
  renderChips(); desenharStats(); desenhar();
  $('tmdbNote').style.display = modo === 'filmes' ? '' : 'none';
  if(salvar){ try{ localStorage.setItem('modoTier', modo); }catch(e){} }
}

function cartao(j,i){
  const ini = j.nome.split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase();
  const podeArrastar = !!(USUARIO && USUARIO.admin) && !ADMIN_MULTISEL.ativo;
  const conq = j.conquistas && j.conquistas.total
    ? `<span class="conq">🏆 ${j.conquistas.obtidas}/${j.conquistas.total}</span>` : '';
  const novo = ehNovo(j) ? `<span class="novo">Novo</span>` : '';
  return `
    <button class="g" data-i="${i}" draggable="${podeArrastar}" aria-label="${esc(j.nome)}">
      <div class="cv" style="position:relative;width:100%;aspect-ratio:2/3;background:#1d1433">
        <div class="ph">${esc(ini)}</div>
        ${j.capa ? `<img src="${esc(j.capa)}" alt="" loading="lazy" draggable="false" onerror="${j.appid ? `if(!this.dataset.f){this.dataset.f=1;this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${j.appid}/header.jpg'}else this.remove()` : 'this.remove()'}">` : ''}
        ${j.status === 'Jogando' ? '<span class="pl" title="Jogando agora"></span>' : ''}
        ${novo}
        ${j.nota > 0 ? `<span class="nt">⭐ ${n1(j.nota)}</span>` : ''}
      </div>
      <div class="cap">
        <span class="cn">${esc(j.nome)}</span>
        ${j.horas > 0 ? `<span class="ch">${fh(j.horas)}</span>` : ''}
        ${j.duracao > 0 ? `<span class="ch">${fmtDuracao(j.duracao)}</span>` : ''}
      </div>
      ${conq}
    </button>
  `;
}
function linha(cls, rotulo, lista){
  const L = LISTA();
  return `
    <div class="tier t-${cls}">
      <div class="label"><div>${rotulo}</div></div>
      <div class="games">
        ${lista.length ? lista.map(j => cartao(j, L.indexOf(j))).join('') : `<span class="empty">${MODOS[modo].vazio}</span>`}
      </div>
    </div>
  `;
}

function setupDragDrop(){
  if(!USUARIO || !USUARIO.admin || ADMIN_MULTISEL.ativo) return;
  document.querySelectorAll('.g').forEach(el => {
    el.addEventListener('dragstart', e => {
      const i = Number(el.dataset.i);
      dragItem = { idx: i, nome: LISTA()[i].nome };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragItem.nome); } catch(err){}
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.games.drag-over').forEach(x => x.classList.remove('drag-over'));
      dragItem = null;
    });
  });
  document.querySelectorAll('.games').forEach(gEl => {
    gEl.addEventListener('dragover', e => {
      if(!dragItem) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      gEl.classList.add('drag-over');
    });
    gEl.addEventListener('dragleave', e => {
      if(!gEl.contains(e.relatedTarget)) gEl.classList.remove('drag-over');
    });
    gEl.addEventListener('drop', async e => {
      e.preventDefault();
      gEl.classList.remove('drag-over');
      if(!dragItem) return;
      const tierEl = gEl.closest('.tier');
      if(!tierEl) return;
      const m = tierEl.className.match(/t-(\w+)/);
      if(!m) return;
      const novoTier = m[1];
      const item = LISTA()[dragItem.idx];
      if(!item || item.tier === novoTier){ dragItem = null; return; }
      const tierAntigo = item.tier;
      item.tier = novoTier;
      desenharStats(); desenhar();
      toast(`✅ "${item.nome}" movido de ${tierAntigo} para ${novoTier}`, 'ok');
      try {
        await fetch('/api/admin?action=tierlist-set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jogos: JOGOS, filmes: FILMES, logAcao: `Moveu "${item.nome}" de ${tierAntigo} pra ${novoTier}` })
        });
      } catch(e){ console.warn('Erro ao salvar', e); }
      dragItem = null;
    });
  });
}

function desenhar(){
  const el = $('tiers'); if(!el) return;
  const q = $('q').value.trim().toLowerCase();
  const lista = LISTA().filter(j => (filtro === 'Todos' || j.status === filtro) && j.nome.toLowerCase().includes(q))
    .sort((a,b) => (b.nota || 0) - (a.nota || 0) || (b.horas || 0) - (a.horas || 0));
  const tiers = TIERS.map(t => linha(t, t, lista.filter(j => j.tier === t)));
  const nr = lista.filter(j => j.tier === 'NR');
  if(nr.length) tiers.push(linha('NR', '?', nr));
  el.innerHTML = tiers.join('');
  setupDragDrop();
}

/* ============================================================
   LOGIN / MANUTENÇÃO
   ============================================================ */
async function checarLogin(){
  if(location.search.includes('preview=1')){
    USUARIO = null;
    renderLogin();
    document.body.classList.remove('sou-admin');
    aplicarManutencao();
    return;
  }
  try{
    const r = await fetch('/api/auth?action=me');
    const d = await r.json();
    USUARIO = d.logado ? d : null;
  }catch(e){ USUARIO = null; }

  if(USUARIO && USUARIO.admin){
    try {
      const pr = await fetch('/api/admin?action=permissoes-minhas');
      if(pr.ok){
        const pd = await pr.json();
        USUARIO.permissoes = Array.isArray(pd.permissoes) ? pd.permissoes : [];
      } else USUARIO.permissoes = [];
    } catch(e){ USUARIO.permissoes = []; }
  }

  renderLogin();
  document.body.classList.toggle('sou-admin', !!(USUARIO && USUARIO.admin));
  if(USUARIO && USUARIO.admin) desenhar();
  aplicarManutencao();
}
window.checarLogin = checarLogin;

function aplicarManutencao(){
  const emManutencao = CONFIG_GERAL.manutencao && !(USUARIO && USUARIO.admin);
  let overlay = document.getElementById('manutencaoOverlay');
  if(emManutencao){
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'manutencaoOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:radial-gradient(circle at 50% 30%,rgba(168,85,247,.25),#0a0511 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;color:#f5f3ff;font-family:DM Sans,sans-serif';
      overlay.innerHTML = `
        <div style="font-size:4rem;line-height:1;margin-bottom:20px">🔧</div>
        <h1 style="font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;margin-bottom:10px">Estamos em manutenção</h1>
        <p style="max-width:400px;color:#b0a5c9;line-height:1.6">Voltamos logo! Enquanto isso, dá uma passada na Twitch:</p>
        <a href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener" style="margin-top:20px;background:#a855f7;color:#fff;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none">Ir pra Twitch 💜</a>
      `;
      document.body.appendChild(overlay);
    }
  } else if(overlay) overlay.remove();
}
window.aplicarManutencao = aplicarManutencao;

function renderLogin(){
  const area = $('navUser'); if(!area) return;
  if(USUARIO){
    area.innerHTML = `
      <div class="nav-user-logado">
        <img src="${esc(USUARIO.avatar)}" alt="" onerror="this.style.display='none'">
        <span class="nick">@${esc(USUARIO.username)}</span>
        <button class="nav-user-sair" onclick="sair()">Sair</button>
      </div>`;
  } else {
    area.innerHTML = `
      <a class="nav-user-deslogado" href="/api/auth?action=login" title="Entrar com Discord para votar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z"/></svg>
        Entrar
      </a>`;
  }
}

async function sair(){
  try{ await fetch('/api/auth?action=logout'); }catch(e){}
  USUARIO = null; meuVoto = null;
  document.body.classList.remove('sou-admin');
  const ov = document.getElementById('manutencaoOverlay'); if(ov) ov.remove();
  renderLogin(); renderVotacao(); desenhar();
  mudarAba('inicio', false);
  location.reload();
}
window.sair = sair;

/* ============================================================
   VOTAÇÃO
   ============================================================ */
const VOTOS_VISTOS_KEY = 'votos:itensVistos';
function getVotosVistos(){
  try { return JSON.parse(localStorage.getItem(VOTOS_VISTOS_KEY) || '[]'); }
  catch { return []; }
}
function marcarVotoVisto(id){
  const atuais = getVotosVistos();
  if(!atuais.includes(id)){
    atuais.push(id);
    try { localStorage.setItem(VOTOS_VISTOS_KEY, JSON.stringify(atuais.slice(-50))); } catch {}
  }
}

const RANKS = ['🥇','🥈','🥉'];

function aplicarVotos(d){
  if(d && Array.isArray(d.opcoes)){
    VOTOS_DADOS = d.opcoes;
    meuVoto = d.meuVoto || null;
    if(d.usuario && !USUARIO) USUARIO = { ...d.usuario };
    if(d.fechamento) VOTOS_FECHAMENTO = d.fechamento;
  }
}

async function carregarVotosApi(){
  await checarLogin();
  if(!USUARIO){ votoStatus = 'sem-login'; renderVotacao(); return; }
  try{
    const r = await fetch('/api/votos');
    if(!r.ok) throw 0;
    aplicarVotos(await r.json());
    votoStatus = 'ok';
  }catch(e){ votoStatus = 'erro'; }
  renderVotacao();
}
window.carregarVotosApi = carregarVotosApi;

function renderVotacao(){
  const destBox = $('destaqueBox'), listaBox = $('votoLista');
  if(!destBox || !listaBox) return;
  const proxCover = $('proxCover');
  const proxBarWrap = $('proxBarWrap');
  const proxBarI = $('proxBarI');

  const infoTop = $('votoInfoTop');
  const statusEl = $('votoStatus');
  const countdownEl = $('votoCountdown');

  const countdown = tempoRestante(VOTOS_FECHAMENTO);
  const fechada = countdown && countdown.encerrado;

  if(statusEl){
    if(fechada){
      statusEl.className = 'vit-item vit-status fechada';
      statusEl.innerHTML = '<span class="vit-dot"></span> Votação encerrada';
    } else {
      statusEl.className = 'vit-item vit-status';
      statusEl.innerHTML = '<span class="vit-dot"></span> Votação aberta';
    }
  }
  if(countdownEl){
    countdownEl.textContent = countdown
      ? (fechada ? '🔒 Encerrada' : '⏰ ' + countdown.texto)
      : '🔓 Sem data definida';
  }

  if(!USUARIO){
    if(infoTop) infoTop.style.display = 'none';
    destBox.innerHTML = '';
    listaBox.innerHTML = `
      <div class="voto-bloqueado">
        <span class="loot">🔒</span>
        <b>Só falta você escolher!</b>
        <p>Entra rapidinho com o Discord pra votar e ajudar a decidir o próximo jogo da live 💜</p>
        <a class="btn-entrar" href="/api/auth?action=login">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 -.2 13.5.2 18a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8.5 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z"/></svg>
          Entrar com Discord
        </a>
      </div>`;
    if(proxCover) proxCover.style.display = 'none';
    if(proxBarWrap) proxBarWrap.style.display = 'none';
    return;
  }
  if(!VOTOS_DADOS.length){
    if(infoTop) infoTop.style.display = 'none';
    destBox.innerHTML = '';
    listaBox.innerHTML = `<div class="vazio-voto"><b>${votoStatus === 'erro' ? 'Votação indisponível no momento' : 'Carregando votação…'}</b>${votoStatus === 'erro' ? ' Tente de novo em instantes.' : ''}</div>`;
    return;
  }

  if(infoTop) infoTop.style.display = '';

  const total = VOTOS_DADOS.reduce((a, x) => a + (x.votos || 0), 0);
  const ord = [...VOTOS_DADOS].sort((a, b) => (b.votos || 0) - (a.votos || 0));
  const pct = v => total ? Math.round((v || 0) / total * 100) : 0;

  const statOpcoes = $('votoStatOpcoes');
  const statVotos = $('votoStatVotos');
  const statLider = $('votoStatLider');
  const lblOpcoes = $('votoLblOpcoes');
  const lblVotos = $('votoLblVotos');
  if(statOpcoes) statOpcoes.textContent = VOTOS_DADOS.length;
  if(lblOpcoes) lblOpcoes.textContent = plural(VOTOS_DADOS.length, 'opção', 'opções');
  if(statVotos) statVotos.textContent = total;
  if(lblVotos) lblVotos.textContent = plural(total, 'voto', 'votos');
  if(statLider){
    if(total === 0){
      statLider.textContent = '—';
      statLider.parentElement.style.display = 'none';
    } else {
      statLider.parentElement.style.display = '';
      statLider.textContent = 'líder com ' + pct(ord[0].votos) + '%';
    }
  }

  const btn = (it) => {
    const meu = meuVoto === it.id;
    if(fechada){
      return `<button class="btn ghost" disabled>Encerrada</button>`;
    }
    if(meu) return `<button class="btn ghost" disabled>Votado ✓</button>`;
    return `<button class="btn" onclick="votar('${it.id}', event)">${meuVoto ? 'Trocar voto' : 'Votar'}</button>`;
  };

  if(total > 0){
    const l = ord[0], p = pct(l.votos);
    const segundo = ord[1];
    let vantagemTxt = '';
    if(segundo && segundo.votos > 0){
      const diff = l.votos - segundo.votos;
      vantagemTxt = diff === 0
        ? ' · Empatado com o 2º'
        : ` · ${diff} ${plural(diff, 'voto', 'votos')} de vantagem`;
    } else if(l.votos > 1){
      vantagemTxt = ' · Unanimidade';
    }

    destBox.innerHTML = `
      <div class="destaque ${fechada ? 'fechada' : ''}">
        ${l.capa ? `<img src="${esc(l.capa)}" alt="${esc(l.nome)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph2',textContent:'🎮'}))">` : '<div class="ph2">🎮</div>'}
        <div class="d-info">
          <small>${fechada ? '🏆 Vencedora' : '👑 Líder da votação'}</small><b>${esc(l.nome)}</b>
          <div class="d-bar"><i style="width:${p}%"></i></div>
          <span class="d-meta"><b>${p}%</b> · ${l.votos}/${total} votos${vantagemTxt}</span>
        </div>
        ${btn(l)}
      </div>`;
    if(proxCover){
      if(l.capa){ proxCover.onerror = () => { proxCover.style.display = 'none'; }; proxCover.src = l.capa; proxCover.style.display = ''; }
      else proxCover.style.display = 'none';
    }
    $('proxNome').textContent = l.nome;
    $('proxInfo').textContent = fechada ? `Encerrada com ${p}% dos votos` : `Liderando com ${p}% dos votos`;
    if(proxBarWrap && proxBarI){ proxBarWrap.style.display = ''; proxBarI.style.width = p + '%'; }
  } else {
    destBox.innerHTML = '';
    if(proxCover) proxCover.style.display = 'none';
    if(proxBarWrap) proxBarWrap.style.display = 'none';
    $('proxNome').textContent = fechada ? 'Votação encerrada' : 'Votação aberta';
    $('proxInfo').textContent = fechada ? 'Aguardando nova votação 💜' : 'Ainda sem votos. Seja a primeira pessoa a escolher!';
  }

  const vistos = getVotosVistos();
  const resto = total > 0 ? ord.slice(1) : ord;
  listaBox.innerHTML = resto.map((it, i) => {
    const p = pct(it.votos);
    const posicao = i + 2;
    const medalha = RANKS[i + 1] || `#${posicao}`;
    const meu = meuVoto === it.id;
    const votos = it.votos || 0;
    const novo = !vistos.includes(it.id);
    const diff = (ord[0] ? ord[0].votos : 0) - votos;
    let statusTxt, statusCls;
    if (votos === 0) { statusTxt = 'Nenhum voto ainda'; statusCls = 'zero'; }
    else if (diff === 0) { statusTxt = 'Empatado com o 1º lugar 🔥'; statusCls = 'close'; }
    else if (diff === 1) { statusTxt = 'Apenas 1 voto atrás do líder'; statusCls = 'close'; }
    else { statusTxt = `${diff} votos atrás do líder`; statusCls = ''; }
    return `
      <div class="vt ${meu ? 'meu' : ''}" data-id="${esc(it.id)}">
        ${novo ? '<span class="vt-novo">Novo</span>' : ''}
        ${meu ? '<span class="vt-badge-meu">✓ Seu voto</span>' : ''}
        <span class="vt-rank" title="${posicao}º lugar">${medalha}</span>
        ${it.capa ? `<img src="${esc(it.capa)}" alt="${esc(it.nome)}" class="vt-img" onerror="this.style.display='none'">` : '<div class="vt-img" style="display:grid;place-items:center;font-size:1.6rem">🎮</div>'}
        <div class="vt-info">
          <div class="vt-top"><span>${esc(it.nome)}</span><b>${posicao}º · ${p}%</b></div>
          <span class="vt-stat ${statusCls}"><span class="pip"></span>${statusTxt}</span>
        </div>
        <div class="vt-bar-wrap">
          <div class="vt-bar">
            <i style="width:${votos > 0 ? Math.max(p, 8) : 0}%"></i>
          </div>
        </div>
        ${btn(it)}
      </div>`;
  }).join('');
  setTimeout(() => resto.forEach(it => marcarVotoVisto(it.id)), 4000);
}

async function votar(id, event){
  if(!USUARIO) return;
  const card = event?.target?.closest('.vt') || event?.target?.closest('.destaque');
  if(card) card.classList.add('voting');
  try{
    const r = await fetch('/api/votos', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ id })
    });
    if(r.status === 401){ await checarLogin(); return; }
    if(r.status === 403){
      const d = await r.json();
      toast(d.error || 'Você foi banido de votar', 'erro');
      return;
    }
    if(r.ok){
      aplicarVotos(await r.json());
      toast('Voto registrado! 💜', 'ok');
    }
  }catch(e){}
  renderVotacao();
}
window.votar = votar;

/* ============================================================
   SUGESTÕES — TABS
   ============================================================ */
function sugTabIrPara(tab){
  try { localStorage.setItem('sug:tab', tab); } catch(e){}
  document.querySelectorAll('.sug-tab').forEach(t =>
    t.classList.toggle('on', t.dataset.tab === tab)
  );
  document.querySelectorAll('.sug-panel').forEach(p =>
    p.classList.toggle('on', p.dataset.panel === tab)
  );
}
window.sugTabIrPara = sugTabIrPara;

function setupSugTabs(){
  const wrap = $('sugTabs'); if(!wrap) return;
  if(wrap.dataset.bound) return;
  wrap.dataset.bound = '1';

  wrap.addEventListener('click', e => {
    const b = e.target.closest('.sug-tab');
    if(!b) return;
    sugTabIrPara(b.dataset.tab);
  });

  const btnIr = $('sugBtnIrSugerir');
  if(btnIr){
    btnIr.addEventListener('click', () => {
      sugTabIrPara('sugerir');
      setTimeout(() => {
        const chip = document.querySelector('.st-chip[data-tipo="Sugestão de jogo"]');
        if(chip) chip.click();
        const ta = $('sugTexto');
        if(ta) ta.focus();
      }, 180);
    });
  }

  const salva = localStorage.getItem('sug:tab') || 'votar';
  sugTabIrPara(salva);
}
window.setupSugTabs = setupSugTabs;

/* ============================================================
   SUGESTÕES — FORM
   ============================================================ */
function setupSugForm(){
  const chips = document.querySelectorAll('#sugTipoChips .st-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      sugTipoAtual = chip.dataset.tipo;
      const sel = $('sugTipo');
      if(sel) sel.value = sugTipoAtual;
    });
  });

  const ta = $('sugTexto');
  const counter = $('sugCounter');
  const btn = $('sugBtn');

  function atualizarContador(){
    if(!counter || !ta) return;
    const n = ta.value.length;
    counter.textContent = `${n} / ${SUG_MAX_CHARS}`;
    counter.classList.remove('warn','danger');
    if(n >= SUG_MAX_CHARS) counter.classList.add('danger');
    else if(n >= Math.floor(SUG_MAX_CHARS * 0.9)) counter.classList.add('warn');
  }

  function atualizarEstadoBtn(){
    if(!btn) return;
    const txt = (ta?.value || '').trim();
    btn.disabled = txt.length < 3;
  }

  if(ta){
    ta.addEventListener('input', () => {
      ta.classList.remove('erro');
      atualizarContador();
      atualizarEstadoBtn();
    });
  }

  atualizarContador();
  atualizarEstadoBtn();
}

async function enviarSugestao(){
  const nome = $('sugNome').value.trim();
  const tipo = sugTipoAtual || 'Sugestão / ideia';
  const texto = $('sugTexto').value.trim();
  const btn = $('sugBtn');
  const success = $('sugSuccess');

  if($('sugSite').value) return;

  if(!texto || texto.length < 3){
    $('sugTexto').classList.add('erro');
    toast('Escreve algo antes de enviar! 💜', 'warn');
    return;
  }
  if(texto.length > SUG_MAX_CHARS){
    toast(`Mensagem muito longa! Máx ${SUG_MAX_CHARS} caracteres.`, 'warn');
    return;
  }

  btn.disabled = true;
  try{
    const res = await fetch('/api/sugestoes', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ nome, tipo, texto, site:$('sugSite').value })
    });
    let dados = null;
    try { dados = await res.json(); } catch(e){}
    if(res.ok){
      $('sugNome').value = '';
      $('sugTexto').value = '';
      const counter = $('sugCounter');
      if(counter){ counter.textContent = `0 / ${SUG_MAX_CHARS}`; counter.classList.remove('warn','danger'); }

      if(success){
        success.hidden = false;
        setTimeout(() => { success.hidden = true; }, 6000);
      }
      toast('Ideia enviada! Obrigado 💜', 'ok');
      carregarUltimasIdeias();
    } else if(res.status === 429){ toast('Calma! Aguarde alguns segundos.', 'warn'); }
    else if(res.status === 500 && dados && dados.error === 'Webhook não configurado'){ toast('⚠️ Webhook do Discord não configurado.', 'erro'); }
    else if(res.status === 502){ toast('⚠️ Discord recusou o envio.', 'erro'); }
    else { toast('Não consegui enviar agora.', 'erro'); }
  }catch(e){
    toast('Sem conexão com o servidor.', 'erro');
  }finally{
    setTimeout(() => {
      const txt = ($('sugTexto')?.value || '').trim();
      if(btn) btn.disabled = txt.length < 3;
    }, 100);
  }
}
window.enviarSugestao = enviarSugestao;

/* ============================================================
   SUGESTÕES — LISTA PÚBLICA
   ============================================================ */
function statusInfoSug(item){
  const st = item.status || 'nova';
  const base = STATUS_SUG[st] || STATUS_SUG.nova;
  if(st === 'concluido'){
    const rotulo = ROTULO_CONCLUIDO[item.tipo] || base.label;
    return { ...base, label: rotulo };
  }
  return base;
}
function tipoInfoSug(tipo){
  const t = String(tipo || '').toLowerCase();
  if(t.includes('bug')) return { ic: '🐛', label: 'bug' };
  if(t.includes('jogo')) return { ic: '🎮', label: 'jogo' };
  if(t.includes('feedback')) return { ic: '💬', label: 'feedback' };
  return { ic: '💡', label: 'sugestao' };
}
function renderSirFiltros(itens){
  const wrap = $('sirFiltros'); if(!wrap) return;
  const tipos = { 'all': true, 'sugestao': false, 'jogo': false, 'feedback': false, 'bug': false };
  itens.forEach(i => {
    const t = tipoInfoSug(i.tipo).label;
    if(tipos[t] !== undefined) tipos[t] = true;
  });
  const opts = [
    { id: 'all', label: 'Todas' },
    { id: 'sugestao', label: '💡' },
    { id: 'jogo', label: '🎮' },
    { id: 'feedback', label: '💬' },
    { id: 'bug', label: '🐛' }
  ].filter(o => o.id === 'all' || tipos[o.id]);

  wrap.innerHTML = opts.map(o =>
    `<button type="button" class="sir-chip ${sirFiltro === o.id ? 'on' : ''}" data-filtro="${o.id}">${o.label}</button>`
  ).join('');
}

async function carregarUltimasIdeias(){
  const lista = $('sirLista'); if(!lista) return;
  try{
    const r = await fetch('/api/sugestoes');
    if(!r.ok) throw new Error('falha');
    const d = await r.json();
    const itens = Array.isArray(d.itens) ? d.itens : [];
    SIR_ITENS_CACHE = itens;

    renderSirFiltros(itens);

    if(!itens.length){
      lista.innerHTML = `
        <div class="sir-empty">
          <span>✨</span>
          <small>Nenhuma ideia ainda. Seja a primeira 💜</small>
        </div>`;
      return;
    }

    const filtrados = sirFiltro === 'all' ? itens : itens.filter(i => tipoInfoSug(i.tipo).label === sirFiltro);
    if(!filtrados.length){
      lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nada nesse filtro</small></div>`;
      return;
    }

    lista.innerHTML = filtrados.slice(0, 20).map(i => {
      const st = statusInfoSug(i);
      const ti = tipoInfoSug(i.tipo);
      const motivoHTML = (i.status === 'recusada' && i.motivo)
        ? `<div class="sir-motivo">${esc(i.motivo)}</div>` : '';
      return `
        <div class="sir-item" title="${esc(st.desc || '')}">
          <span class="sir-ic">${ti.ic}</span>
          <div class="sir-tx">
            <div class="sir-tx-top">
              <b>@${esc(i.nome || 'anônimo')}</b>
              <span class="sir-status sir-status-${st.cor}">${st.label}</span>
            </div>
            <small>${esc((i.texto || '').slice(0, 90))}${(i.texto || '').length > 90 ? '…' : ''}</small>
            <small class="sir-data">${i.data ? tempoAtras(i.data) : 'há um tempo'}</small>
            ${motivoHTML}
          </div>
        </div>
      `;
    }).join('');
  }catch(e){
    lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Sugestões aparecem aqui após o primeiro envio 💜</small></div>`;
  }
}
function setupSirFiltros(){
  const wrap = $('sirFiltros'); if(!wrap) return;
  if(wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.sir-chip'); if(!b) return;
    wrap.querySelectorAll('.sir-chip').forEach(c => c.classList.toggle('on', c === b));
    sirFiltro = b.dataset.filtro || 'all';
    carregarUltimasIdeias();
  });
}

/* ============================================================
   CONFIG PÚBLICA
   ============================================================ */
async function carregarConfigPublica(){
  try{
    const r = await fetch('/api/config', { cache: 'no-store' });
    if(!r.ok){ console.warn('[config] HTTP', r.status); return; }
    const d = await r.json();
    if(d.aviso){
      Object.assign(AVISO, d.aviso);
      if(!d.aviso.ativo || !d.aviso.texto) AVISO.ativo = false;
    }
    CONFIG_GERAL = { ...CONFIG_GERAL, ...d };
    if(d.votosFechamento) VOTOS_FECHAMENTO = d.votosFechamento;
    renderAviso();
    renderHomeExtras();
    renderSiteUpdate();
    aplicarManutencao();
  }catch(e){ console.error('[config] erro:', e); }
}
window.carregarConfigPublica = carregarConfigPublica;

/* ============================================================
   REVEAL + PARALLAX + BURGER + SCROLL DO BANNER
   ============================================================ */
function setupReveal(){
  revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add('in'); revealObs.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
}

function setupRoomParallax(){
  const room = document.querySelector('.room');
  if(!room) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layers = room.querySelectorAll('[data-depth]');
  if(!layers.length) return;

  let mx = 0, my = 0, cx = 0, cy = 0;
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  (function tick(){
    cx += (mx - cx) * 0.06;
    cy += (my - cy) * 0.06;
    layers.forEach(el => {
      const d = parseFloat(el.dataset.depth) || 1;
      el.style.transform = `translate3d(${cx * d * 12}px, ${cy * d * 12}px, 0)`;
    });
    requestAnimationFrame(tick);
  })();
}

function setupBurger(){
  const burger = document.getElementById('navBurger');
  const navRight = document.getElementById('navRight');
  if(!burger || !navRight) return;
  burger.addEventListener('click', () => {
    const open = navRight.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navRight.querySelectorAll('.nav-links button').forEach(b => {
    b.addEventListener('click', () => {
      navRight.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (e) => {
    if(!navRight.classList.contains('open')) return;
    if(navRight.contains(e.target) || burger.contains(e.target)) return;
    navRight.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });
}

function setupFloatingLive(){
  const btn = document.getElementById('floatLiveBtn');
  if(!btn) return;
  window.addEventListener('scroll', () => {
    if(!ultVivo) { btn.classList.remove('show'); return; }
    const player = document.querySelector('.twitch-player-box');
    if(!player) { btn.classList.remove('show'); return; }
    const r = player.getBoundingClientRect();
    if(r.bottom < 100) btn.classList.add('show');
    else btn.classList.remove('show');
  }, { passive: true });

  btn.addEventListener('click', () => {
    const player = document.querySelector('.twitch-player-box');
    if(player) player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
  const isPreview = location.search.includes('preview=1');
  if(isPreview){
    try { localStorage.removeItem('abaAtiva'); } catch(e){}
  }

  // 🔧 REGRA NOVA: só usa hash da URL pra decidir a aba inicial.
  // Sem hash → sempre Home. Não usa mais localStorage.
  const hashRaw = (location.hash || '').replace(/^#/, '');
  let abaInicial = 'inicio';
  if(!isPreview){
    if(hashRaw === 'admin' || hashRaw.startsWith('admin/')) abaInicial = 'admin';
    else if(hashRaw && ABAS_VALIDAS.includes(hashRaw)) abaInicial = hashRaw;
  }
  if(!document.getElementById('sec-' + abaInicial)) abaInicial = 'inicio';

  _ultimaAba = null;
  _executarMudarAba(abaInicial, false);

  // Modo Foco persistente
  restaurarFocusMode();
  const focusBtn = document.getElementById('focusModeBtn');
  if(focusBtn) focusBtn.addEventListener('click', toggleFocusMode);

  renderAviso(); renderEmotes(); renderSiteUpdate();
  renderChips(); renderComandos(); renderHomeExtras();
  setupComunidadeTabs();
  setupCardTabs();

  // Setup
  setupView = localStorage.getItem(SETUP_VIEW_KEY) || '3d';
  document.querySelectorAll('.svt-btn').forEach(b => {
    const on = b.dataset.view === setupView;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  setupRender();
  renderSonhos();
  renderApoiadores();
  setupSetup3D();

  const setupBuscaEl = $('setupBusca');
  if(setupBuscaEl){
    setupBuscaEl.addEventListener('input', e => {
      setupBusca = e.target.value;
      setupRender();
    });
  }

  document.querySelectorAll('.svt-btn').forEach(b => {
    b.addEventListener('click', () => setupSetView(b.dataset.view));
  });

  const setupGridEl = $('setupGrid');
  if(setupGridEl){
    setupGridEl.addEventListener('click', e => {
      const item = e.target.closest('.setup-item');
      if(!item) return;
      abrirItemSetup(item.dataset.grupo, Number(item.dataset.idx));
    });
  }

  setupSugForm();
  setupSirFiltros();
  setupSugTabs();
  carregarUltimasIdeias();

  // Música: aba padrão agora é "ouvindo"
  musicaTab = 'ouvindo';
  trocarMusicaTab('ouvindo');

  document.addEventListener('click', e => {
    const t = e.target.closest('.music-tab');
    if(t) trocarMusicaTab(t.dataset.tab);
  });

  const buscaCmd = $('buscaCmd');
  if(buscaCmd){
    buscaCmd.addEventListener('input', e => renderComandos(e.target.value));
    document.addEventListener('click', async e => {
      const b = e.target.closest('#tabelaCmds button');
      if(!b) return;
      try { await navigator.clipboard.writeText(b.dataset.c); b.textContent = 'Copiado ✓'; b.classList.add('copiado'); }
      catch { b.textContent = 'Erro'; }
      setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('copiado'); }, 1600);
    });
  }

  if (CONFIG.donate) {
    const d = $('donateLink');
    if(d){ d.href = CONFIG.donate; d.target = '_blank'; d.rel = 'noopener'; }
  }

  const modoEl = $('modo');
  if(modoEl) modoEl.addEventListener('click', e => {
    const b = e.target.closest('button');
    if(!b || b.dataset.m === modo) return;
    aplicarModo(b.dataset.m);
  });
  const chipsEl = $('chips');
  if(chipsEl) chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if(!b) return;
    filtro = b.dataset.s;
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.s === filtro));
    desenhar();
  });
  const qEl = $('q');
  if(qEl) qEl.addEventListener('input', desenhar);

  try{ const ms = localStorage.getItem('modoTier'); if(ms && ms !== modo) aplicarModo(ms, false); }catch(e){}

  document.addEventListener('click', e => {
    const b = e.target.closest('.si-btn[data-produto]');
    if(b) abrirBuscaItem(b.dataset.produto);
  });

  const tiersEl = $('tiers');
  if(tiersEl) tiersEl.addEventListener('click', e => {
    const b = e.target.closest('.g'); if(!b) return;
    if(b.classList.contains('dragging')) return;
    const m = MODOS[modo];
    const j = LISTA()[+b.dataset.i];
    $('dTitle').textContent = j.nome;
    let terceiro = '';
    if (modo === 'jogos') {
      if (j.conquistas && j.conquistas.total) terceiro = `<div><b>${j.conquistas.obtidas}/${j.conquistas.total}</b><span>conquistas</span></div>`;
    } else {
      if (j.ano) terceiro = `<div><b>${j.ano}</b><span>ano</span></div>`;
    }
    $('dBody').innerHTML = `
      <div class="mrow">
        ${j.capa ? `<img src="${esc(j.capa)}" alt="${esc(j.nome)}" onerror="this.style.display='none'">` : '<div></div>'}
        <div class="mside">
          <div class="badges">
            <span class="bd">${j.tier === 'NR' ? 'Sem tier' : 'Tier ' + j.tier}</span>
            <span class="bd">${esc(j.status)}</span>
          </div>
          <div class="kv">
            <div><b>${j.horas ? fh(j.horas) : (j.duracao ? fmtDuracao(j.duracao) : '—')}</b><span>${m.hl}</span></div>
            <div><b>${j.nota > 0 ? '⭐ ' + n1(j.nota) : '—'}</b><span>nota</span></div>
            ${terceiro}
          </div>
          ${(j.comentario || j.sinopse) ? `<p>${esc(j.comentario || j.sinopse)}</p>` : ''}
        </div>
      </div>
    `;
    $('dlg').showModal();
  });

  const dlgEl = $('dlg');
  if(dlgEl){
    $('dClose').addEventListener('click', () => dlgEl.close());
    dlgEl.addEventListener('click', e => { if(e.target === dlgEl) dlgEl.close(); });
  }

  setupReveal();
  setupRoomParallax();
  setupBurger();
  setupFloatingLive();

  await carregarConfigPublica();
  verificarStatusTwitch();
  setInterval(verificarStatusTwitch, 60000);
  carregarOuvindoAgora();
  setInterval(carregarOuvindoAgora, 15000);
  carregarBiblioteca();
  carregarVotosApi();

  setInterval(() => {
    if(VOTOS_FECHAMENTO) renderVotacao();
  }, 60000);
});

/* ============================================================
   BUSCA DE ITEM (KaBuM/Amazon)
   ============================================================ */
function abrirBuscaItem(produto){
  $('dTitle').textContent = produto;
  $('dBody').innerHTML = `
    <p style="color:var(--mute);font-size:.85rem;margin-bottom:10px">Ajuste o termo se quiser e escolha a loja:</p>
    <input id="buscaTermo" type="text" value="${esc(produto)}"
      style="width:100%;background:#1a102d;border:1px solid var(--line);border-radius:10px;padding:10px 14px;color:var(--ink);font-family:inherit;font-size:.9rem;margin-bottom:12px">
    <div style="display:flex;flex-direction:column;gap:8px">
      <a class="busca-loja kb" id="lnkKabum" href="#" target="_blank" rel="noopener">🛒 KaBuM!</a>
      <a class="busca-loja am" id="lnkAmazon" href="#" target="_blank" rel="noopener">🛒 Amazon</a>
    </div>
    <button class="busca-copiar" id="btnCopiar" type="button">📋 Copiar nome do produto</button>
  `;
  const input = $('buscaTermo');
  const atualizar = () => {
    const q = encodeURIComponent(input.value.trim() || produto);
    $('lnkKabum').href = `https://www.kabum.com.br/busca/${q}`;
    $('lnkAmazon').href = `https://www.amazon.com.br/s?k=${q}`;
  };
  input.addEventListener('input', atualizar);
  atualizar();
  $('btnCopiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(input.value); $('btnCopiar').textContent = '✓ Copiado!'; }
    catch { $('btnCopiar').textContent = 'Erro ao copiar'; }
    setTimeout(() => { $('btnCopiar').textContent = '📋 Copiar nome do produto'; }, 1600);
  });
  input.focus(); input.select();
  $('dlg').showModal();
}
window.abrirBuscaItem = abrirBuscaItem;