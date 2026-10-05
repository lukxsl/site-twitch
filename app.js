/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */
const CONFIG = {
  subs: null,
  donate: 'https://midfielder.tv.br/asemtet0',
  siteUpdated: '12/10/2026',
  topDoadores: [],
  atividadeManual: [],
  spotifyPlaylist: 'https://open.spotify.com/playlist/0OV32Qe5e7BJY33rL4tpXk',
  pixKey: 'asemtet0@gmail.com' // Chave Pix pra vaquinha
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
  { c:'!discord', d:'Link do Discord' },
  { c:'!insta',   d:'Instagram da Soso' },
  { c:'!social',  d:'Instagram, Discord e TikTok' },
  { c:'!lurk',    d:'Avisar que vai ficar de lurk' },
  { c:'!uptime',  d:'Tempo de live' },
  { c:'!commands',d:'Lista de comandos' }
];

const NIVEIS = { dev: 4, dono: 3, administrador: 2, moderador: 1 };
const LABEL_CARGO = {
  dev: '🛠️ Dev', dono: '👑 Dono',
  administrador: '🛡️ Administrador', moderador: '🔰 Moderador'
};

const STATUS_TOOLTIP = {
  'Todos': 'Ver todos os itens',
  'Jogando': 'Estou jogando atualmente',
  'Zerado': 'Terminei a história principal',
  'Dropado': 'Comecei mas não vou continuar',
  'Na fila': 'Quero jogar/assistir em breve',
  'Assistindo': 'Estou assistindo agora',
  'Assistido': 'Já assisti'
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
  aviso: null, donate: null, manutencao: false,
  recado: '', horasMes: '', updatedAt: null, top3: [], hall: [],
  votosFechamento: null
};
let musicaTab = 'playlist';
let musicaTocando = false;
let revealObs = null;

// Setup
const SETUP_VIEW_KEY = 'setup:view';
let setupView = '3d';
let setupBusca = '';
let _sonhoSelecionado = null;

// Sugestões
let sugTipoAtual = 'Sugestão / ideia';
let sirFiltro = 'all';

/* ============================================================
   DADOS — SETUP ATUAL
   ============================================================ */
const SETUP_DATA = [
  {
    id: 'pc',
    titulo: '💻 PC Gamer',
    accent: 'blue',
    tipo: 'real',
    itens: [
      { ic:'🧠', cat:'Processador', nome:'Ryzen 9 5900x', ano:2023, nota:10,
        comentario:'Monstro pra jogos e streaming ao mesmo tempo. Nunca travou.' },
      { ic:'🎮', cat:'Placa de Vídeo', nome:'RX 6750 XT', ano:2024, nota:8,
        comentario:'Roda tudo em 1440p liso. CxB excelente.' },
      { ic:'🧩', cat:'Memória RAM', nome:'48GB DDR4', ano:2023, nota:9,
        comentario:'Sobra RAM pra jogar, streamar e editar junto.' },
      { ic:'🔌', cat:'Placa Mãe', nome:'X570 TUF Gaming', ano:2023, nota:8,
        comentario:'Ótima construção, várias portas USB e boa dissipação.' },
      { ic:'🗄️', cat:'Gabinete', nome:'Risemode Aquarium branco', ano:2023, nota:8,
        comentario:'Gabinete branco compacto, airflow ótimo e visual limpo.' },
      { ic:'💧', cat:'Water cooler', nome:'Risemode Aura RGB', ano:2023, nota:7,
        comentario:'Mantém a temperatura baixa, RGB de sobra.' }
    ]
  },
  {
    id: 'arm',
    titulo: '💾 Armazenamento & Energia',
    accent: 'cyan',
    tipo: 'real',
    itens: [
      { ic:'💾', cat:'Armazenamento', nome:'SSD 2TB NVMe M2', ano:2024, nota:9,
        comentario:'Leitura rápida, jogo carrega em segundos.' },
      { ic:'⚡', cat:'Fonte', nome:'Corsair RM800w', ano:2023, nota:9,
        comentario:'80 Plus Gold, silenciosa e confiável.' }
    ]
  },
  {
    id: 'per',
    titulo: '🖱️ Periféricos & Outros',
    accent: 'pink',
    tipo: 'real',
    itens: [
      { ic:'⌨️', cat:'Teclado', nome:'AULA H88', ano:2023, nota:8,
        comentario:'Switch gateron amarelo, ótimo pra digitar e jogar.' },
      { ic:'🖱️', cat:'Mouse', nome:'Logitech G502X Superlight', ano:2024, nota:10,
        comentario:'Leve, preciso e com sensor TOP. Melhor mouse que já tive.' },
      { ic:'🎧', cat:'Headset', nome:'Astro A50', ano:2023, nota:9,
        comentario:'Áudio muito bom e microfone que capta bem.' },
      { ic:'🎙️', cat:'Microfone', nome:'FIFINE AM8 Branco', ano:2024, nota:8,
        comentario:'USB, com ganho bom e acabamento bonito.' },
      { ic:'🖥️', cat:'Monitor', nome:'AOC 240Hz', ano:2023, nota:9,
        comentario:'240Hz faz MUITA diferença em FPS.' },
      { ic:'📷', cat:'Webcam', nome:'Logitech C920', ano:2023, nota:7,
        comentario:'Clássica, boa pra live. Com luz fica ótima.' }
    ]
  }
];

/* ============================================================
   DADOS — SETUP DOS SONHOS (vaquinha)
   ============================================================ */
const SONHOS_DATA = [
  {
    id: 'sony-zv-e10',
    icon: '🎥',
    cat: 'Câmera profissional',
    nome: 'Sony ZV-E10',
    descricao: 'Pra dar um upgrade monstro no visual da live.',
    meta: 3500,
    arrecadado: 0,
    contribuintes: []
  },
  {
    id: 'shure-sm7b',
    icon: '🎤',
    cat: 'Microfone pro',
    nome: 'Shure SM7B',
    descricao: 'O sonho de todo streamer, mas precisa de interface.',
    meta: 4200,
    arrecadado: 0,
    contribuintes: []
  }
];

/* ============================================================
   HELPERS
   ============================================================ */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const n1 = n => Number(n).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1});
const nivel = cargo => NIVEIS[cargo] || 0;

function fmtBRL(v){
  if(!v && v !== 0) return 'R$ 0';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function temPerm(perm){
  if(!USUARIO || !USUARIO.admin) return false;
  if(USUARIO.cargo === 'dev') return true;
  return (USUARIO.permissoes || []).includes(perm);
}
window.temPerm = temPerm;

function fmtDuracao(min){
  if(!min) return null;
  const h = Math.floor(min/60), m = min % 60;
  return h ? `${h}h ${String(m).padStart(2,'0')}min` : `${m}min`;
}

const tempoAtras = iso => {
  const m = (Date.now() - new Date(iso)) / 60000;
  if (m < 60) return 'há ' + Math.max(1, Math.round(m)) + ' min';
  if (m < 1440) return 'há ' + Math.round(m / 60) + 'h';
  const d = Math.round(m / 1440); return d === 1 ? 'ontem' : 'há ' + d + ' dias';
};
const durTw = d => {
  const h = /(\d+)h/.exec(d || ''), mi = /(\d+)m/.exec(d || '');
  return h ? h[1] + 'h' + (mi ? mi[1].padStart(2, '0') : '00') : (mi ? mi[1] + ' min' : '');
};

function fmtDataHora(iso){
  if(!iso) return null;
  const d = new Date(iso);
  if(isNaN(d.getTime())) return String(iso);
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `${data} às ${hora}`;
}

function tempoRestante(iso){
  if(!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if(ms <= 0) return { encerrado: true, texto: 'Encerrada' };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  let texto = '';
  if(d > 0) texto = `Fecha em ${d}d ${h}h`;
  else if(h > 0) texto = `Fecha em ${h}h ${m}m`;
  else texto = `Fecha em ${m}min`;
  return { encerrado: false, texto, dias: d, horas: h, min: m };
}

function ehNovo(item){
  if(!item) return false;
  if(item.tier && item.tier !== 'NR') return false;
  if(!item.adicionadoEm) return false;
  const dias = (Date.now() - new Date(item.adicionadoEm)) / 86400000;
  return dias <= 7;
}

function gerarIniciaisFaixa(nome){
  if(!nome) return '♪';
  const palavras = String(nome).trim().split(/\s+/).filter(Boolean);
  if(!palavras.length) return '♪';
  if(palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

/* ============================================================
   LAZY LOAD — admin-ui.js
   ============================================================ */
function garantirAdminCarregado(){
  if(window.__adminCarregado) return Promise.resolve();
  if(window.__adminCarregando) return window.__adminCarregando;

  window.__adminCarregando = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'admin-ui.js';
    s.async = true;
    s.onload = () => {
      window.__adminCarregado = true;
      window.__adminCarregando = null;
      resolve();
    };
    s.onerror = () => {
      window.__adminCarregando = null;
      reject(new Error('Falha ao carregar admin-ui.js'));
    };
    document.head.appendChild(s);
  });
  return window.__adminCarregando;
}
window.garantirAdminCarregado = garantirAdminCarregado;

/* ============================================================
   TOAST
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

/* ============================================================
   CONFIRM MODAL
   ============================================================ */
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
   CONTADOR ANIMADO
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

/* ============================================================
   META
   ============================================================ */
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

/* ============================================================
   RENDER BÁSICO
   ============================================================ */
function renderAviso(){
  const box = $('avisoBox'); if(!box) return;
  if(AVISO && AVISO.ativo && AVISO.texto){
    $('avisoTexto').textContent = AVISO.texto;
    $('avisoTitulo').textContent = AVISO.titulo || 'Aviso';
    $('avisoIcon').textContent = AVISO.icone || '📢';
    box.className = 'aviso reveal in ' + (AVISO.tipo === 'warn' ? 'warn' : '');
    box.style.display = 'flex';
  } else box.style.display = 'none';
  const recadoWrap = document.querySelector('.ap-recado');
  if(recadoWrap){
    recadoWrap.style.display = (AVISO && AVISO.ativo && AVISO.texto) ? 'none' : '';
  }
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
  if(painelPlaylist) painelPlaylist.style.display = tab === 'playlist' ? '' : 'none';
  if(painelOuvindo) painelOuvindo.style.display = tab === 'ouvindo' ? '' : 'none';
  if(tab === 'playlist') renderPlaylist();
  if(tab === 'ouvindo') renderOuvindo();
}
window.trocarMusicaTab = trocarMusicaTab;

function renderOuvindo(){
  const painel = $('musicPainelOuvindo'); if(!painel) return;
  if(!musicaTocando){
    painel.innerHTML = `<div class="ouvindo-vazio">🎧 Não estou ouvindo nada agora 💜</div>`;
    return;
  }
  painel.innerHTML = `
    <div class="ouvindo-now">
      <img class="ouvindo-capa" id="ouvindoCapa" alt="" loading="lazy">
      <div class="ouvindo-info">
        <b id="ouvindoFaixa">—</b>
        <span id="ouvindoArtista">—</span>
        <a class="ouvindo-link" id="ouvindoLink" href="#" target="_blank" rel="noopener">▶ Ouvir no Spotify</a>
      </div>
    </div>`;
  if(window.__ultimaMusica) pintarOuvindo(window.__ultimaMusica);
}

function pintarOuvindo(d){
  if(!d || !d.tocando) return;
  const faixa = $('ouvindoFaixa');
  const artista = $('ouvindoArtista');
  const capa = $('ouvindoCapa');
  const link = $('ouvindoLink');
  if(faixa) faixa.textContent = d.faixa || '—';
  if(artista) artista.textContent = d.artista ? `${d.artista}${d.album ? ' · ' + d.album : ''}` : '';
  if(capa){
    if(d.capa){
      capa.src = d.capa; capa.style.display = '';
      capa.classList.remove('ouvindo-capa-ph'); capa.textContent = '';
      capa.onerror = () => {
        capa.removeAttribute('src');
        capa.classList.add('ouvindo-capa-ph');
        capa.textContent = gerarIniciaisFaixa(d.faixa);
      };
    } else {
      capa.removeAttribute('src');
      capa.classList.add('ouvindo-capa-ph');
      capa.textContent = gerarIniciaisFaixa(d.faixa);
      capa.style.display = '';
    }
  }
  if(link){
    if(d.url){ link.href = d.url; link.style.display = ''; }
    else link.style.display = 'none';
  }
}

async function carregarOuvindoAgora(){
  try {
    const r = await fetch('/api/lastfm', { cache: 'no-store' });
    if(!r.ok) { musicaTocando = false; return; }
    const d = await r.json();
    if(!d || !d.tocando || !d.faixa){
      musicaTocando = false;
      window.__ultimaMusica = null;
      if(musicaTab === 'ouvindo') trocarMusicaTab('playlist');
      else renderOuvindo();
      return;
    }
    musicaTocando = true;
    window.__ultimaMusica = d;
    if(musicaTab === null) trocarMusicaTab('ouvindo');
    if(musicaTab === 'ouvindo'){ renderOuvindo(); pintarOuvindo(d); }
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
function mudarAba(nome, salvar = true){
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('ativo'));
  document.querySelectorAll('nav ul button').forEach(b => b.classList.remove('on'));
  const section = $('sec-' + nome), button = $('btn-' + nome);
  if(section) section.classList.add('ativo');
  if(button) button.classList.add('on');
  if(salvar) localStorage.setItem('abaAtiva', nome);
  if(nome !== 'admin'){
    try { localStorage.removeItem('admin:page'); } catch(e){}
    ADMIN_PAGE = 'home';
  }
  window.scrollTo({ top:0, behavior:'smooth' });

  if(nome === 'admin'){
    garantirAdminCarregado()
      .then(() => {
        if(typeof carregarAdmin === 'function') carregarAdmin();
        else console.error('carregarAdmin não definido após carregar admin-ui.js');
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
   TWITCH
   ============================================================ */
function assistirVod(v){
  v = v || vodAtual; if (!v) return;
  vodAtual = v; assistindoVod = true;
  const panel = document.getElementById('offlinePanel');
  if(panel) panel.style.display = 'none';
  const f = document.getElementById('twitchIframe');
  if(!f) return;
  f.style.display = 'block';
  f.src = `https://player.twitch.tv/?video=v${vodAtual.id}&parent=${HOST}&autoplay=false`;
  const noteEl = document.getElementById('playerNoteText');
  if(noteEl) noteEl.textContent = `Reprise: ${vodAtual.title}`;
  const box = document.querySelector('.twitch-player-box');
  if(box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.assistirVod = assistirVod;

function tickUptime(){
  const el = $('tmUp'); if(!el) return;
  if(!inicioLive){ el.textContent = 'Offline'; return; }
  const m = Math.max(0, Math.floor((Date.now() - inicioLive) / 60000));
  el.textContent = `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
setInterval(tickUptime, 30000);

let toastLiveMostrado = false;
async function verificarStatusTwitch() {
  const g = id => document.getElementById(id);
  const iframe = g('twitchIframe'), panel = g('offlinePanel'), badge = g('bannerLiveBadge');
  try {
    const response = await fetch('/api/twitch');
    if (!response.ok) throw new Error('api');
    const data = await response.json();

    atualizarMeta('goalSeg', data.followers, MARCOS, true);
    atualizarMeta('goalDc', data.discord, MARCOS, true);

    const live = !!data.stream;
    inicioLive = live && data.stream.started_at ? new Date(data.stream.started_at) : null;
    tickUptime();

    if (live && !toastLiveMostrado) {
      toastLiveMostrado = true;
      setTimeout(() => toast('🔴 Soso tá ao vivo! Vem pro chat 💜', 'ok'), 800);
    }

    if (data.horasMes != null && g('tmHoras')) {
      g('tmHoras').textContent = (typeof data.horasMes === 'number' ? data.horasMes : Number(data.horasMes)).toLocaleString('pt-BR') + 'h';
    } else if (g('tmHoras')) {
      g('tmHoras').textContent = '—';
    }

    if (data.discord && $('dcMembros'))
      $('dcMembros').textContent = `${data.discord.toLocaleString('pt-BR')} membros · avisos de live, resenha e novidades.`;

    vodAtual = data.video;
    videosTw = data.videos || (data.video ? [data.video] : []);
    g('tmStatus').textContent = live ? '● AO VIVO' : 'OFFLINE';
    g('tmSeg').textContent = data.followers != null ? data.followers.toLocaleString('pt-BR') : '—';
    g('tmLbl').textContent = live ? 'AO VIVO AGORA' : 'ÚLTIMA LIVE';
    g('tmSub').textContent = live
      ? `${data.stream.title} · ${data.stream.game_name || ''} · ${data.stream.viewer_count} assistindo`
      : (videosTw[0] && videosTw[0].created_at ? `${tempoAtras(videosTw[0].created_at)} · ${videosTw[0].title}` : 'Canal offline no momento.');
    g('tmVods').innerHTML = videosTw.slice(0, 3).map((v, i) =>
      `<button class="tm-vod" data-i="${i}">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<div><b>${esc(v.title || 'Live')}</b><span>${v.created_at ? tempoAtras(v.created_at) : ''}${v.duration ? ' · ' + durTw(v.duration) : ''}${v.views != null ? ' · 👁 ' + v.views : ''}</span></div><em>▶</em></button>`
    ).join('') || '<span class="tm-h4">Nenhuma live gravada ainda.</span>';

    atualizarFoco(data.game, !!data.stream);
    renderClips(data.clips);
    g('btnVod').style.display = vodAtual ? '' : 'none';
    setLivePulse(live);

    if (data.user) {
      if (data.user.profile_image_url) { const av = g('offlineAvatarImg'); if(av) av.src = data.user.profile_image_url; }
      if (data.user.offline_image_url) panel.style.backgroundImage = `linear-gradient(rgba(10,5,17,.7),rgba(10,5,17,.9)),url(${data.user.offline_image_url})`;
    }

    if (data.stream) {
      assistindoVod = false;
      panel.style.display = 'none';
      iframe.style.display = 'block';
      if (!iframe.src.includes('channel=')) iframe.src = `https://player.twitch.tv/?channel=asemtet0&parent=${HOST}`;
      badge.style.display = 'flex';
      g('bannerLiveText').textContent = `AO VIVO • ${data.stream.game_name || 'Jogando'} (${data.stream.viewer_count} espectadores)`;
      g('viewerCountStatus').textContent = `${data.stream.viewer_count} assistindo`;
      g('playerNoteText').textContent = `Transmitindo: ${data.stream.title}`;
    } else {
      badge.style.display = 'none';
      g('viewerCountStatus').textContent = '@asemtet0';
      if (!assistindoVod) {
        iframe.style.display = 'none'; iframe.src = '';
        panel.style.display = 'flex';
        g('playerNoteText').textContent = 'Quando a Soso estiver ao vivo, a transmissão aparece aqui. 🎮';
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados da Twitch:', err);
    atualizarFoco(null, false);
    ['goalSeg','goalDc'].forEach(p => { const el = $(p+'Num'); if (el && el.textContent === '…') atualizarMeta(p, null); });
    setLivePulse(false);
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('.tm-vod');
  if (b && videosTw[+b.dataset.i]) assistirVod(videosTw[+b.dataset.i]);
});

/* ============================================================
   CLIPES
   ============================================================ */
function renderClips(list){
  if(clipsOk) return;
  const vazio = $('clipsVazio'), box = $('clipsBox');
  if(!list || !list.length){
    if(vazio) vazio.style.display = 'block';
    if(box) box.style.display = 'none';
    return;
  }
  clipsOk = true;
  clipsCache = list.slice(0, 4);
  const totalViews = clipsCache.reduce((a, c) => a + (Number(c.views) || 0), 0);
  const titulo = $('clipsTitulo');
  if(titulo) titulo.textContent = `🎬 Clipes em destaque · 👁 ${totalViews.toLocaleString('pt-BR')} views`;
  if(box) box.style.display = '';
  if(vazio) vazio.style.display = 'none';
  $('clipsGrid').innerHTML = clipsCache.map(c =>
    `<button class="clip" data-id="${esc(c.id)}" aria-label="${esc(c.title)}">
      <img src="${esc(c.thumbnail)}" alt="" loading="lazy">
      <span class="play">▶</span>
      <span class="vw">👁 ${Number(c.views || 0).toLocaleString('pt-BR')}</span>
      <span class="ct">${esc(c.title)}</span>
    </button>`
  ).join('');
}
function getDlgClip(){
  if(dlgClip) return dlgClip;
  dlgClip = document.createElement('dialog');
  dlgClip.className = 'clip-modal';
  dlgClip.innerHTML = `<iframe id="clipIframe" allowfullscreen></iframe><div class="cm-foot"><b id="clipTitle"></b><span id="clipViews"></span></div>`;
  document.body.appendChild(dlgClip);
  dlgClip.addEventListener('click', e => { if(e.target === dlgClip) fecharClip(); });
  return dlgClip;
}
function abrirClip(id){
  const c = clipsCache.find(x => x.id === id); if(!c) return;
  const d = getDlgClip();
  d.querySelector('#clipIframe').src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&parent=${HOST}&autoplay=true`;
  d.querySelector('#clipTitle').textContent = c.title;
  d.querySelector('#clipViews').textContent = `👁 ${Number(c.views || 0).toLocaleString('pt-BR')} views`;
  d.showModal();
}
function fecharClip(){ if(dlgClip){ dlgClip.querySelector('#clipIframe').src = ''; dlgClip.close(); } }
document.addEventListener('click', e => {
  const b = e.target.closest('.clip');
  if(b && b.dataset.id) abrirClip(b.dataset.id);
});

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
   SETUP — 3D + LISTA + SONHOS
   ============================================================ */
function setupRender(){
  const grid = $('setupGrid'); if(!grid) return;

  const q = setupBusca.toLowerCase().trim();
  const normQ = norm(q);

  grid.className = 'setup-groups view-' + setupView;

  const gruposFiltrados = SETUP_DATA.map(g => {
    const itens = g.itens.filter(it => {
      if(!q) return true;
      return norm(it.nome).includes(normQ) || norm(it.cat).includes(normQ);
    });
    return { ...g, itensFiltrados: itens };
  }).filter(g => g.itensFiltrados.length > 0);

  if(!gruposFiltrados.length){
    grid.innerHTML = `
      <div class="logs-empty">
        <b>Nenhum item encontrado</b>
        Tenta buscar outro termo (ex: "mouse", "ryzen", "corsair").
      </div>`;
    return;
  }

  grid.innerHTML = gruposFiltrados.map(g => `
    <div class="setup-group" data-accent="${g.accent}">
      <div class="sg-head">
        <h3>${g.titulo}</h3>
        <span class="sg-count">${g.itensFiltrados.length}</span>
      </div>
      <div class="sg-list">
        ${g.itensFiltrados.map((it) => {
          const idx = g.itens.indexOf(it);
          return `
            <button type="button" class="setup-item setup-item-3d" data-grupo="${g.id}" data-idx="${idx}">
              <span class="si-ic-wrap" data-ic-cat="${esc(it.cat)}">
                <span class="si-ic">${it.ic}</span>
                <span class="si-lupa">🔍</span>
              </span>
              <span class="si-tx">
                <span class="si-cat">${esc(it.cat)}</span>
                <span class="si-nome">${esc(it.nome)}</span>
                <span class="si-meta">${it.ano ? it.ano : ''}${it.ano && it.nota ? ' · ' : ''}${it.nota ? '⭐ ' + it.nota : ''}</span>
              </span>
              <span class="si-set">→</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function abrirItemSetup(grupoId, idx){
  const g = SETUP_DATA.find(x => x.id === grupoId);
  if(!g) return;
  const it = g.itens[idx];
  if(!it) return;

  $('dTitle').textContent = it.nome;
  $('dBody').innerHTML = `
    <div class="setup-modal-item">
      <div class="smi-hero" data-accent="${g.accent}">
        <span class="smi-hero-ic">${it.ic}</span>
      </div>
      <div class="smi-info">
        <small>${esc(it.cat)}</small>
        <b>${esc(it.nome)}</b>
        <div class="kv" style="grid-template-columns:repeat(2,1fr)">
          <div><b>${it.ano || '—'}</b><span>ano</span></div>
          <div><b>${it.nota ? '⭐ ' + it.nota : '—'}</b><span>nota</span></div>
        </div>
        ${it.comentario ? `<p class="smi-coment">${esc(it.comentario)}</p>` : ''}
        <div class="smi-actions">
          <a class="btn" href="https://www.kabum.com.br/busca/${encodeURIComponent(it.nome)}" target="_blank" rel="noopener">🛒 KaBuM!</a>
          <a class="btn ghost" href="https://www.amazon.com.br/s?k=${encodeURIComponent(it.nome)}" target="_blank" rel="noopener">🛒 Amazon</a>
        </div>
      </div>
    </div>
  `;
  $('dlg').showModal();
}
window.abrirItemSetup = abrirItemSetup;

function setupSetView(view){
  setupView = view;
  try { localStorage.setItem(SETUP_VIEW_KEY, view); } catch(e){}
  document.querySelectorAll('.svt-btn').forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  setupRender();
}
window.setupSetView = setupSetView;

/* ---------- Sonhos (vaquinha) ---------- */
function renderSonhos(){
  const lista = $('sonhosLista'); if(!lista) return;
  if(!SONHOS_DATA.length){
    lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nenhum sonho cadastrado ainda 💜</small></div>`;
    return;
  }
  lista.innerHTML = SONHOS_DATA.map(s => {
    const pct = s.meta > 0 ? Math.min(100, Math.round((s.arrecadado / s.meta) * 100)) : 0;
    const meta100 = pct >= 100;
    const nContrib = s.contribuintes.length;
    return `
      <div class="sonho-card ${meta100 ? 'meta-conquistada' : ''}" data-sonho="${esc(s.id)}">
        <div class="sonho-head">
          <span class="sonho-ic">${s.icon}</span>
          <div class="sonho-tx">
            <small>${esc(s.cat)}</small>
            <b>${esc(s.nome)}</b>
            ${s.descricao ? `<span>${esc(s.descricao)}</span>` : ''}
          </div>
          ${meta100 ? '<span class="sonho-badge-conq">🎉 Conquistado!</span>' : ''}
        </div>

        <div class="sonho-progresso">
          <div class="sonho-bar">
            <i style="width:${pct}%"></i>
          </div>
          <div class="sonho-meta-info">
            <b>${fmtBRL(s.arrecadado)}</b>
            <span>de ${fmtBRL(s.meta)}</span>
            <span class="sonho-pct">${pct}%</span>
          </div>
        </div>

        ${nContrib ? `
          <div class="sonho-apoiadores">
            <span class="sa-h">💜 ${nContrib} ${nContrib === 1 ? 'apoiador' : 'apoiadores'}:</span>
            <div class="sa-lista">
              ${s.contribuintes.slice(0, 5).map(c => `<span class="sa-chip" title="${fmtBRL(c.valor)}">@${esc(c.nome)}</span>`).join('')}
              ${nContrib > 5 ? `<span class="sa-chip sa-mais">+${nContrib - 5}</span>` : ''}
            </div>
          </div>` : `
          <div class="sonho-vazio">
            <small>Seja a primeira pessoa a apoiar esse sonho 💜</small>
          </div>`}

        <div class="sonho-actions">
          <button type="button" class="btn" onclick="abrirContribuirSonho('${esc(s.id)}')">
            💜 ${meta100 ? 'Ver apoiadores' : 'Contribuir'}
          </button>
          <a class="btn ghost" href="https://discord.gg/J4gGaKWFPZ" target="_blank" rel="noopener">💬 Falar no Discord</a>
        </div>
      </div>
    `;
  }).join('');
}

function renderApoiadores(){
  const lista = $('apoiadoresLista'); if(!lista) return;
  const todos = [];
  SONHOS_DATA.forEach(s => {
    (s.contribuintes || []).forEach(c => {
      todos.push({ nome: c.nome, valor: c.valor, sonho: s.nome });
    });
  });
  if(!todos.length){
    lista.innerHTML = `
      <div class="sir-empty">
        <span>🏆</span>
        <b>Ninguém ainda</b>
        <small>Quando alguém apoiar, o nome aparece aqui 💜</small>
      </div>`;
    return;
  }
  const porPessoa = {};
  todos.forEach(t => {
    if(!porPessoa[t.nome]) porPessoa[t.nome] = { nome: t.nome, total: 0, sonhos: [] };
    porPessoa[t.nome].total += t.valor;
    if(!porPessoa[t.nome].sonhos.includes(t.sonho)) porPessoa[t.nome].sonhos.push(t.sonho);
  });
  const ranking = Object.values(porPessoa).sort((a,b) => b.total - a.total);
  const medalhas = ['🥇','🥈','🥉'];
  lista.innerHTML = ranking.map((p, i) => `
    <div class="apoiador-row ${i < 3 ? 'apoiador-top' : ''}">
      <span class="ar-pos">${medalhas[i] || '🎗️'}</span>
      <span class="ar-nome">@${esc(p.nome)}</span>
      <span class="ar-total">${fmtBRL(p.total)}</span>
      <span class="ar-sonhos">${p.sonhos.map(s => `<span class="ar-sonho-chip">${esc(s)}</span>`).join('')}</span>
    </div>
  `).join('');
}

function abrirContribuirSonho(id){
  const s = SONHOS_DATA.find(x => x.id === id);
  if(!s) return;
  _sonhoSelecionado = s;

  const pct = s.meta > 0 ? Math.min(100, Math.round((s.arrecadado / s.meta) * 100)) : 0;

  $('dTitle').textContent = '💜 Apoiar ' + s.nome;
  $('dBody').innerHTML = `
    <div class="contribuir-modal">
      <div class="cm-head">
        <span class="cm-ic">${s.icon}</span>
        <div>
          <b>${esc(s.nome)}</b>
          <small>${esc(s.cat)}</small>
        </div>
      </div>

      <div class="cm-progresso">
        <div class="sonho-bar"><i style="width:${pct}%"></i></div>
        <div class="cm-prog-info">
          <b>${fmtBRL(s.arrecadado)}</b>
          <span>de ${fmtBRL(s.meta)}</span>
          <span class="sonho-pct">${pct}%</span>
        </div>
      </div>

      <div class="cm-info">
        <b>💜 Como contribuir</b>
        <ol>
          <li>Faz um Pix de qualquer valor</li>
          <li>Volta aqui e avisa a Soso</li>
          <li>A contribuição aparece após confirmação</li>
        </ol>
      </div>

      <div class="cm-pix">
        <label>📋 Chave Pix</label>
        <div class="cm-pix-box">
          <input type="text" id="pixKeyInput" value="${esc(CONFIG.pixKey)}" readonly>
          <button type="button" class="btn ghost" onclick="copiarPix()">📋 Copiar</button>
        </div>
      </div>

      <div class="cm-form">
        <label>Depois de fazer o Pix, me avisa:</label>
        <input type="text" id="contribNome" placeholder="Seu nome/apelido" maxlength="40">
        <input type="number" id="contribValor" placeholder="Valor em R$" min="1" step="1">
        <button type="button" class="btn big" onclick="enviarContribuicao()">💜 Já fiz o Pix, avisar Soso</button>
        <small class="cm-aviso">* O valor só aparece depois que a Soso confirmar</small>
      </div>
    </div>
  `;
  $('dlg').showModal();
}
window.abrirContribuirSonho = abrirContribuirSonho;

function copiarPix(){
  const input = $('pixKeyInput');
  if(!input) return;
  try {
    input.select();
    navigator.clipboard.writeText(input.value);
    toast('Chave Pix copiada! 💜', 'ok');
  } catch(e){ toast('Erro ao copiar', 'erro'); }
}
window.copiarPix = copiarPix;

async function enviarContribuicao(){
  const nome = ($('contribNome')?.value || '').trim();
  const valor = Number($('contribValor')?.value) || 0;
  if(!nome){ toast('Digita seu nome/apelido!', 'warn'); return; }
  if(valor <= 0){ toast('Informa o valor do Pix!', 'warn'); return; }

  // Por enquanto: só toast (a Soso adiciona manualmente no painel)
  try{
    // Aqui poderia enviar pra uma API de contribuições pendentes
    toast(`✅ Aviso enviado! Assim que a Soso confirmar, @${nome} aparece na lista 💜`, 'ok');
    if($('dlg')) $('dlg').close();
  }catch(e){
    toast('Não consegui enviar. Manda no Discord 💜', 'warn');
  }
}
window.enviarContribuicao = enviarContribuicao;

/* ============================================================
   LOGIN / MANUTENÇÃO
   ============================================================ */
async function checarLogin(){
  // Modo preview — força visitante
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

  // Countdown
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
    countdownEl.textContent = countdown ? (fechada ? '🔒 Encerrada' : '⏰ ' + countdown.texto) : '⏰ Sem prazo';
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

  // Mini stats
  const statOpcoes = $('votoStatOpcoes');
  const statVotos = $('votoStatVotos');
  const statPessoas = $('votoStatPessoas');
  if(statOpcoes) statOpcoes.textContent = VOTOS_DADOS.length;
  if(statVotos) statVotos.textContent = total;
  if(statPessoas) statPessoas.textContent = total === 0 ? 0 : total;

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
    destBox.innerHTML = `
      <div class="destaque ${fechada ? 'fechada' : ''}">
        ${l.capa ? `<img src="${esc(l.capa)}" alt="${esc(l.nome)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph2',textContent:'🎮'}))">` : '<div class="ph2">🎮</div>'}
        <div class="d-info">
          <small>${fechada ? '🏆 Vencedora' : '👑 Líder da votação'}</small><b>${esc(l.nome)}</b>
          <div class="d-bar"><i style="width:${p}%"></i></div>
          <span class="d-meta"><b>${p}%</b> · ${l.votos}/${total} votos</span>
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

  const resto = total > 0 ? ord.slice(1) : ord;
  listaBox.innerHTML = resto.map((it, i) => {
    const p = pct(it.votos);
    const posicao = i + 2;
    const medalha = RANKS[i + 1] || `#${posicao}`;
    const meu = meuVoto === it.id;
    const votos = it.votos || 0;
    const diff = (ord[0] ? ord[0].votos : 0) - votos;
    let statusTxt, statusCls;
    if (votos === 0) { statusTxt = 'Nenhum voto ainda'; statusCls = 'zero'; }
    else if (diff === 0) { statusTxt = 'Empatado com o 1º lugar 🔥'; statusCls = 'close'; }
    else if (diff === 1) { statusTxt = 'Apenas 1 voto atrás do líder'; statusCls = 'close'; }
    else { statusTxt = `${diff} votos atrás do líder`; statusCls = ''; }
    return `
      <div class="vt ${meu ? 'meu' : ''}" data-id="${esc(it.id)}">
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
  }).join('') + `<div class="vt-total">Total: ${total} voto${total === 1 ? '' : 's'} · ${ord.length} opç${ord.length === 1 ? 'ão' : 'ões'}</div>`;
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
   SUGESTÕES — Formulário + Últimas ideias (sidebar)
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
  const nomeInput = $('sugNome');

  function atualizarEstadoBtn(){
    if(!btn) return;
    const txt = (ta?.value || '').trim();
    btn.disabled = txt.length < 3;
  }

  if(ta){
    ta.addEventListener('input', () => {
      if(counter) counter.textContent = `${ta.value.length} / 1000`;
      ta.classList.remove('erro');
      atualizarEstadoBtn();
    });
  }

  if(nomeInput){
    nomeInput.addEventListener('input', () => {
      nomeInput.classList.remove('erro');
    });
  }

  atualizarEstadoBtn();

  const donateCta = $('donateCtaSugestoes');
  if(donateCta && CONFIG.donate){
    donateCta.href = CONFIG.donate;
  }
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
      if($('sugCounter')) $('sugCounter').textContent = '0 / 1000';

      if(success){
        success.hidden = false;
        setTimeout(() => { success.hidden = true; }, 5000);
      }
      toast('Mensagem enviada! Obrigado 💜', 'ok');
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

async function carregarUltimasIdeias(){
  const lista = $('sirLista'); if(!lista) return;
  try{
    const r = await fetch('/api/sugestoes');
    if(!r.ok) throw new Error('falha');
    const d = await r.json();
    const itens = Array.isArray(d.itens) ? d.itens : [];
    if(!itens.length){
      lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nenhuma ideia ainda. Seja a primeira 💜</small></div>`;
      return;
    }
    const filtrados = sirFiltro === 'all' ? itens : itens.filter(i => {
      const n = (i.nome || '').toLowerCase();
      if(sirFiltro === 'jogo') return /jogo|game|sugest/i.test(n);
      if(sirFiltro === 'bug') return /bug|erro|report/i.test(n);
      return true;
    });
    if(!filtrados.length){
      lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nada nesse filtro</small></div>`;
      return;
    }
    lista.innerHTML = filtrados.slice(0, 5).map(i => `
      <div class="sir-item">
        <span class="sir-ic">💡</span>
        <div class="sir-tx">
          <b>@${esc(i.nome || 'alguém')}</b>
          <small>${i.data ? tempoAtras(i.data) : 'há um tempo'}</small>
        </div>
      </div>
    `).join('');
  }catch(e){
    lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Sugestões aparecem aqui após o primeiro envio 💜</small></div>`;
  }
}

function setupSirFiltros(){
  const wrap = $('sirFiltros'); if(!wrap) return;
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
   REVEAL + PARALLAX + BURGER
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

function setupSetup3D(){
  // Parallax por card no setup (mouse move) — desligado em mobile
  if(matchMedia('(max-width:960px)').matches) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const grid = $('setupGrid');
  if(!grid) return;

  grid.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.setup-item-3d');
    if(!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotY = x * 10;
    const rotX = -y * 8;
    card.style.setProperty('--rx', rotX + 'deg');
    card.style.setProperty('--ry', rotY + 'deg');
  });

  grid.addEventListener('mouseleave', () => {
    grid.querySelectorAll('.setup-item-3d').forEach(c => {
      c.style.setProperty('--rx', '0deg');
      c.style.setProperty('--ry', '0deg');
    });
  });
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

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
  const isPreview = location.search.includes('preview=1');
  if(isPreview){
    try { localStorage.removeItem('abaAtiva'); } catch(e){}
  }

  const abaSalva = isPreview ? 'inicio' : localStorage.getItem('abaAtiva');
  if(abaSalva && document.getElementById('sec-' + abaSalva)) mudarAba(abaSalva, false);
  else mudarAba('inicio', false);

  renderAviso(); renderEmotes(); renderSiteUpdate();
  renderChips(); renderComandos(); renderHomeExtras();
  setupComunidadeTabs();

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

  // Sugestões
  setupSugForm();
  setupSirFiltros();
  carregarUltimasIdeias();

  musicaTab = 'playlist';
  trocarMusicaTab('playlist');

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

  await carregarConfigPublica();
  verificarStatusTwitch();
  setInterval(verificarStatusTwitch, 60000);
  carregarOuvindoAgora();
  setInterval(carregarOuvindoAgora, 30000);
  carregarBiblioteca();
  carregarVotosApi();

  // Countdown refresh a cada 60s
  setInterval(() => {
    if(VOTOS_FECHAMENTO) renderVotacao();
  }, 60000);
});

/* ============================================================
   BUSCA DE ITEM (KaBuM/Amazon) — legado
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