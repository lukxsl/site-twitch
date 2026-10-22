/* ============================================================
   CONFIG GLOBAL
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
const SUG_MAX_CHARS = 200;
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
let modo = 'jogos';
let filtro = [];
let favoritosFiltro = false;
let CONFIG_GERAL = {
  aviso: null, donate: null, manutencao: false, recado: '', horasMes: '', updatedAt: null, top3: [], hall: [], votosFechamento: null
};
let musicaTocando = false;
let revealObs = null;
let sugTipoAtual = 'Sugestão / ideia';
let sirFiltro = 'all';
let sirStatusFiltro = 'all';
let SIR_ITENS_CACHE = [];
let _musicaAtual = null;
let _recentes = [];
let _musicaPronta = false;

let HALL_DADOS = null;
let HALL_ABA = 'gift';
let HALL_TIMER = null;

let sortMode = 'nota';
let generoFiltro = [];
let _jogoAoVivoNome = null;
let _roletaRodando = false;

/* ============================================================
   HELPERS
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
   LAZY LOAD — ADMIN
   ============================================================ */
function garantirAdminCarregado(){
  if(window.__adminCarregado) return Promise.resolve();
  if(window.__adminCarregando) return window.__adminCarregando;
  window.__adminCarregando = new Promise((resolve, reject) => {
    const files = ['js/admin/admin.js','js/admin/dashboard.js','js/admin/forms.js','js/admin/tables.js'];
    let loaded = 0;
    files.forEach(src => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = () => { loaded++; if(loaded === files.length){ window.__adminCarregado = true; window.__adminCarregando = null; resolve(); } };
      s.onerror = () => { window.__adminCarregando = null; reject(new Error(`Falha: ${src}`)); };
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
  setTimeout(() => { el.classList.remove('toast-on'); setTimeout(() => el.remove(), 400); }, 4600);
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
   ANIMAÇÕES
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

function renderRecado(){
  const noteEl = $('playerNoteText');
  if(noteEl){
    noteEl.classList.remove('recado');
    if(!assistindoVod){
      noteEl.textContent = ultVivo
        ? 'Transmitindo ao vivo agora 💜'
        : 'Quando a Soso estiver ao vivo, a transmissão aparece aqui. 🎮';
    }
  }
  const card = $('recadoCard');
  const texto = $('recadoTexto');
  if(card && texto){
    const recado = (CONFIG_GERAL.recado || '').trim();
    if(recado){
      texto.textContent = recado;
      card.classList.remove('vazio');
    } else {
      texto.textContent = '💭 Sem recadinho por hoje. A Soso volta logo com novidades!';
      card.classList.add('vazio');
    }
    card.style.display = '';
  }
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
  const g3 = $('emotesMiniGrid'); if(g3) g3.innerHTML = html;
}

function renderSiteUpdate(){
  const el = $('siteUpdated'); if(!el) return;
  const iso = CONFIG_GERAL.updatedAt;
  el.textContent = iso ? fmtDataHora(iso) : (CONFIG.siteUpdated || new Date().toLocaleDateString('pt-BR'));
}

function renderHomeExtras(){
  renderRecado();
}

/* ============================================================
   SUB SHORTCUTS (legado)
   ============================================================ */
function setupSubShortcuts(){
  const wrap = document.querySelector('.sub-shortcuts');
  if(!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.sub-shortcut');
    if(!btn) return;
    const card = btn.closest('.sub-hero-box');
    if(!card) return;
    card.querySelectorAll('.sub-shortcut').forEach(t => t.classList.toggle('on', t === btn));
    card.querySelectorAll('.sub-shortcut-content').forEach(c =>
      c.classList.toggle('on', c.dataset.subContent === btn.dataset.subTab)
    );
    if(btn.dataset.subTab === 'emotes'){
      const grid = document.getElementById('emotesGrid');
      if(grid){
        grid.classList.add('counter-up');
        setTimeout(() => grid.classList.remove('counter-up'), 1200);
      }
    }
  });
}

/* ============================================================
   HALL DA FAMA
   ============================================================ */
async function carregarHall(){
  const lista = $('hallLista'); if(!lista) return;
  try{
    const r = await fetch('/api/config?action=hall', { cache: 'no-store' });
    const d = await r.json();
    HALL_DADOS = d;
    renderHall();
  } catch(e){
    lista.innerHTML = `<div class="hall-empty"><span class="hall-empty-ic">🏆</span><small>O ranking ainda tá vazio.<br>Seja a primeira pessoa a aparecer aqui! 💜</small></div>`;
  }
}

function renderHall(){
  const lista = $('hallLista');
  const updated = $('hallUpdated');
  if(!lista) return;
  const d = HALL_DADOS;

  if(!d || d.vazio){
    lista.innerHTML = `<div class="hall-empty"><span class="hall-empty-ic">🏆</span><small>O ranking ainda tá vazio.<br>Seja a primeira pessoa a aparecer aqui! 💜</small></div>`;
    if(updated) updated.style.display = 'none';
    return;
  }

  const itens = (HALL_ABA === 'gift' ? (d.gift || [])
              : HALL_ABA === 'fieis' ? (d.fieis || [])
              : (d.doadores || [])).slice(0, 3);

  if(!itens.length){
    lista.innerHTML = `<div class="hall-empty"><span class="hall-empty-ic">🏆</span><small>O ranking ainda tá vazio.<br>Seja a primeira pessoa a aparecer aqui! 💜</small></div>`;
  } else {
    const medalhas = ['🥇','🥈','🥉'];
    lista.innerHTML = itens.map((p, i) => {
      const medalha = medalhas[i] || `${i+1}º`;
      let meta = '';
      if(HALL_ABA === 'gift') meta = `${p.total} gift${p.total === 1 ? '' : 's'}`;
      else if(HALL_ABA === 'fieis') meta = `${p.meses} ${p.meses === 1 ? 'mês' : 'meses'}`;
      else meta = fmtBRL(p.total);

      const avatarHTML = p.avatar
        ? `<img class="hr-avatar" src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'hr-avatar-ph',textContent:'👤'}))">`
        : `<div class="hr-avatar-ph">👤</div>`;

      return `
        <div class="hall-row">
          <span class="hr-pos">${medalha}</span>
          ${avatarHTML}
          <span class="hr-name">@${esc(p.nome || '—')}</span>
          <span class="hr-meta">${esc(meta)}</span>
        </div>
      `;
    }).join('');
  }

  if(updated && d.updatedAt){
    atualizarTextoHallUpdated(d.updatedAt);
    updated.style.display = '';
  } else if(updated){
    updated.style.display = 'none';
  }
}

function atualizarTextoHallUpdated(ts){
  const el = $('hallUpdated'); if(!el) return;
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  let texto;
  if(diffMin < 1) texto = '🔄 Atualizado agora';
  else if(diffMin === 1) texto = '🔄 Atualizado há 1 min';
  else if(diffMin < 60) texto = `🔄 Atualizado há ${diffMin} min`;
  else {
    const horas = Math.floor(diffMin / 60);
    texto = `🔄 Atualizado há ${horas}h`;
  }
  el.textContent = texto;
}

function setupHallTabs(){
  const wrap = $('hallTabs'); if(!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.hall-tab');
    if(!btn) return;
    wrap.querySelectorAll('.hall-tab').forEach(t => t.classList.toggle('on', t === btn));
    HALL_ABA = btn.dataset.hall || 'gift';
    renderHall();
  });
}

function iniciarHall(){
  setupHallTabs();
  carregarHall();
  if(HALL_TIMER) clearInterval(HALL_TIMER);
  HALL_TIMER = setInterval(() => {
    if(HALL_DADOS && HALL_DADOS.updatedAt){
      atualizarTextoHallUpdated(HALL_DADOS.updatedAt);
    }
  }, 60000);
}

/* ============================================================
   MÚSICA
   ============================================================ */
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

  if(!_musicaPronta && !musicaTocando && !_recentes.length){
    painel.innerHTML = `
      <div class="ouvindo-wrap">
        <div class="disco-fantasma" aria-hidden="true"><span class="df-ic">🎵</span></div>
        <div class="ouvindo-vazio-txt">Carregando…</div>
      </div>
    `;
    return;
  }

  if(!musicaTocando){
    if(_recentes.length){
      const lista = _recentes.slice(0, 3);
      const sig = JSON.stringify(lista.map(x => [x.faixa, x.artista, x.quando]));
      if(painel.dataset.rec === sig) return;
      painel.dataset.rec = sig;
      const quando = q => (q && typeof tempoAtras === 'function') ? esc(tempoAtras(q)) : '';
      painel.innerHTML = `
        <div class="ouvindo-wrap ouvindo-vazio-wrap">
          <div class="ouvindo-vazio-top">
            <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="ouvindo-vazio-txt">Nada tocando agora.<br>Últimas que rolaram nas lives 💜</div>
          </div>
          <ul class="rec-lista">
            ${lista.map(x => `
              <li>
                <a class="rec-item" ${x.url ? `href="${esc(x.url)}" target="_blank" rel="noopener"` : ''}>
                  <span class="rec-capa">${x.capa ? `<img src="${esc(x.capa)}" alt="" loading="lazy" onerror="this.remove()">` : '♪'}</span>
                  <span class="rec-info"><b>${esc(x.faixa)}</b><small>${esc(x.artista)}</small></span>
                  <em>${quando(x.quando)}</em>
                </a>
              </li>`).join('')}
          </ul>
        </div>
      `;
      return;
    }
    delete painel.dataset.rec;

    const mp = (CONFIG.spotifyPlaylist || '').match(/playlist\/([a-zA-Z0-9]+)/);
    if(mp){
      if(painel.querySelector('.music-mini-embed')) return;
      painel.innerHTML = `
        <div class="ouvindo-wrap ouvindo-vazio-wrap">
          <div class="ouvindo-vazio-top">
            <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="ouvindo-vazio-txt">Nada tocando agora.<br>Enquanto isso, dá o play na playlist 💜</div>
          </div>
          <iframe class="music-mini-embed" src="https://open.spotify.com/embed/playlist/${mp[1]}?theme=0"
            allowtransparency="true" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy" title="Playlist da Soso no Spotify"></iframe>
        </div>
      `;
      return;
    }
    painel.innerHTML = `
      <div class="ouvindo-wrap">
        <div class="disco-fantasma" aria-hidden="true">
          <span class="df-ic">💤</span>
        </div>
        <div class="ouvindo-vazio-txt">
          Nada tocando agora.<br>A playlist completa tá logo abaixo 💜
        </div>
      </div>
    `;
    return;
  }

  const d = _musicaAtual || {};
  const iniciais = _iniciaisFaixa(d.faixa);
  const pct = (d.duracao && d.progresso) ? Math.min(100, (d.progresso / d.duracao) * 100) : 0;
  const urlAbrir = d.url || '#';
  const target = d.url ? '_blank' : '_self';

  const linkTexto = d.url
    ? (d.url.includes('/track/') ? '▶ Ouvir no Spotify' : '🔍 Buscar no Spotify')
    : '';

  const capaHTML = d.capa
    ? `<img src="${esc(d.capa)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'disco-fallback',textContent:'${iniciais}'}))">`
    : `<div class="disco-fallback">${iniciais}</div>`;

  painel.innerHTML = `
    <div class="ouvindo-wrap" id="ouvindoWrap">
      <a class="disco" href="${esc(urlAbrir)}" target="${target}" rel="noopener" title="${d.url ? 'Abrir no Spotify' : d.faixa || ''}">
        <div class="disco-inner">${capaHTML}</div>
      </a>
      <div class="ouvindo-info">
        <b id="ouvindoFaixa">${esc(d.faixa || '—')}</b>
        <span id="ouvindoArtista">${esc(d.artista || '')}${d.album ? ' · ' + esc(d.album) : ''}</span>
        ${d.duracao ? `
          <div class="ouvindo-progress"><i style="width:${pct}%"></i></div>
          <div class="ouvindo-times">
            <span>${_fmtMs(d.progresso || 0)}</span>
            <span>${_fmtMs(d.duracao)}</span>
          </div>
        ` : ''}
        ${d.url ? `<a class="ouvindo-link" href="${esc(d.url)}" target="_blank" rel="noopener">${linkTexto}</a>` : ''}
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
    _musicaPronta = true;
    if(!r.ok) { musicaTocando = false; renderOuvindo(); return; }
    const d = await r.json();
    if(!d || !d.tocando || !d.faixa){
      musicaTocando = false;
      _musicaAtual = null;
      _recentes = Array.isArray(d && d.recentes) ? d.recentes : [];
      renderOuvindo();
      return;
    }
    const musicaMudou = !_musicaAtual || _musicaAtual.faixa !== d.faixa || _musicaAtual.artista !== d.artista;
    musicaTocando = true;
    _musicaAtual = d;
    if(musicaMudou) pintarOuvindo(d);
    else renderOuvindo();
  } catch(e) {
    _musicaPronta = true;
    musicaTocando = false;
    renderOuvindo();
  }
}

function renderPlaylistComunidade(){
  const embed = $('musicEmbedComunidade'); if(!embed) return;
  const url = CONFIG.spotifyPlaylist;
  if(!url){ embed.innerHTML = `<p class="music-placeholder">🎧 Playlist em breve!</p>`; return; }
  const m = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if(!m){ embed.innerHTML = `<p class="music-placeholder">🎧 Link inválido</p>`; return; }
  embed.innerHTML = `<iframe src="https://open.spotify.com/embed/playlist/${m[1]}?theme=0"
    width="100%" height="380" frameborder="0" allowtransparency="true"
    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    loading="lazy" title="Playlist do Spotify"></iframe>`;
}

function irParaPlaylist(){
  mudarAba('comunidade');
  setTimeout(() => {
    const tab = document.querySelector('.sub-tab[data-tab="playlist"]');
    if(tab) tab.click();
  }, 150);
}
window.irParaPlaylist = irParaPlaylist;

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

  const adminBtn = $('btn-admin');
  if(adminBtn) adminBtn.classList.toggle('on', nome === 'admin');

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
    if(nome !== 'admin') history.replaceState(null, '', '#' + nome);
  } catch(e){}

  window.scrollTo({ top:0, behavior:'smooth' });

  if(nome === 'admin'){
    garantirAdminCarregado()
      .then(() => { if(typeof carregarAdmin === 'function') carregarAdmin(); })
      .catch(err => {
        console.error('Erro admin:', err);
        const area = $('adminArea');
        if(area) area.innerHTML = `<div class="admin-vazio"><b>Erro ao carregar</b>Recarregue a página.</div>`;
      });
  }

  if(section) section.querySelectorAll('.reveal:not(.in)').forEach(el => revealObs && revealObs.observe(el));

  setTimeout(() => setupCardTilt(), 100);
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
    if(tab === 'playlist') renderPlaylistComunidade();
    setTimeout(() => setupCardTilt(), 100);
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
   TIER LIST V5 — PREMIUM DASHBOARD REDESIGN
   ============================================================ */
const TIERS = ['S','A','B','C'];
const PLATAFORMA_NOME = { steam:'Steam', epic:'Epic', ps:'PlayStation', xbox:'Xbox', switch:'Switch', nintendo:'Nintendo', gog:'GOG' };
const ICO_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z"/></svg>';

const JOGOS_FALLBACK = [
  { id:'red-dead-2', nome:'Red Dead Redemption 2', appid:1174180, tier:'S', status:'Jogando', horas:50, nota:8,
    capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900.jpg',
    comentario:'Um dos mundos mais vivos e detalhados dos games.', generos:['Ação','Aventura'] },
  { id:'hollow-knight', nome:'Hollow Knight', tier:'S', status:'Zerado', nota:9, horas:40,
    capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg', comentario:'', generos:['Metroidvania'] },
  { id:'stardew-valley', nome:'Stardew Valley', tier:'A', status:'Jogando', nota:8, horas:120,
    capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg', comentario:'', generos:['Simulação'] }
];
const FILMES_FALLBACK = [
  { id:'interestelar', nome:'Interestelar', tier:'S', status:'Assistido', nota:9, duracao:169, ano:2014,
    capa:'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    comentario:'As reservas naturais da Terra estão chegando ao fim.', generos:['Ficção'] }
];

let _bibliotecaCarregada = false;
let _roletaVencedor = null;

async function carregarBiblioteca(){
  try{
    const r = await fetch('/api/tierlist');
    const d = r.ok ? await r.json() : {};
    JOGOS = (Array.isArray(d.jogos) && d.jogos.length) ? d.jogos : JOGOS_FALLBACK;
    FILMES = (Array.isArray(d.filmes) && d.filmes.length) ? d.filmes : FILMES_FALLBACK;
  }catch(e){ JOGOS = JOGOS_FALLBACK; FILMES = FILMES_FALLBACK; }
  _bibliotecaCarregada = true;
  desenharStats(); desenhar(); atualizarFoco(ultGame, ultVivo);
}
window.carregarBiblioteca = carregarBiblioteca;

const MODOS = {
  jogos: {
    get lista(){ return JOGOS; },
    status:['Todos','Jogando','Zerado','Dropado','Na fila'],
    feito:'Zerado', sing:'jogo', plural:'jogos',
    hrs:'jogadas', hl:'horas jogadas', l4:'jogos zerados', l4s:'jogo zerado',
    horasLabel:'Mais horas jogadas', sorteio:'Que tal jogar este?',
    titulo:'Tier List de Jogos',
    sub:'Tudo o que eu já joguei ou pretendo jogar, do melhor ao pior.',
    busca:'Buscar jogo...', vazio:'Nenhum jogo aqui'
  },
  filmes: {
    get lista(){ return FILMES; },
    status:['Todos','Assistindo','Assistido','Na fila'],
    feito:'Assistido', sing:'filme', plural:'filmes',
    hrs:'de duração', hl:'duração', l4:'filmes assistidos', l4s:'filme assistido',
    horasLabel:'Mais longos', sorteio:'Que tal assistir este?',
    titulo:'Tier List de Filmes',
    sub:'Tudo o que eu já assisti ou pretendo assistir.',
    busca:'Buscar filme...', vazio:'Nenhum filme aqui'
  }
};
const LISTA = () => MODOS[modo].lista;
const fh = h => (Math.round(h * 10) / 10).toLocaleString('pt-BR') + 'h';
const _tierDe = j => TIERS.includes(j.tier) ? j.tier : 'NR';
const _ehAdmin = () => !!(USUARIO && USUARIO.admin);
const _arr = v => Array.isArray(v) ? v : [];

function _salvarBiblioteca(logAcao){
  return fetch('/api/admin?action=tierlist-set', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ jogos: JOGOS, filmes: FILMES, logAcao })
  }).catch(e => console.warn('Erro ao salvar', e));
}
const _snapshot = () => ({ jogos: JSON.parse(JSON.stringify(JOGOS)), filmes: JSON.parse(JSON.stringify(FILMES)) });

const UNDO_STACK = [];
const UNDO_MAX = 5;
function pushUndo(snapshot){
  UNDO_STACK.push(snapshot);
  if(UNDO_STACK.length > UNDO_MAX) UNDO_STACK.shift();
}
async function desfazerUltima(){
  if(!UNDO_STACK.length){ toast('Nada pra desfazer', 'warn'); return; }
  const snap = UNDO_STACK.pop();
  if(snap.jogos) JOGOS = snap.jogos;
  if(snap.filmes) FILMES = snap.filmes;
  desenharStats(); desenhar();
  await _salvarBiblioteca('Desfez última ação (undo)');
  toast('↩️ Desfeito', 'ok');
}
window.desfazerUltima = desfazerUltima;

/* ---------- Resumo + distribuição por tier ---------- */
function desenharStats(){
  const el = $('stats'); if(!el) return;
  const m = MODOS[modo], L = m.lista;
  renderChips();
  renderGeneroChips();

  if(!L.length){ el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;

  const comNota = L.filter(j => j.nota > 0);
  const media = comNota.length ? comNota.reduce((a,j) => a + j.nota, 0) / comNota.length : 0;
  const feitos = L.filter(j => j.status === m.feito).length;
  let volume = null;
  if(modo === 'filmes'){
    const t = L.reduce((a,j) => a + (j.duracao || 0), 0);
    volume = t ? fmtDuracao(t) : null;
  } else {
    const h = Math.round(L.reduce((a,j) => a + (j.horas || 0), 0) * 10) / 10;
    volume = h ? h.toLocaleString('pt-BR') + 'h' : null;
  }

  const figs = [
    [L.length, plural(L.length, m.sing, m.plural)],
    volume ? [volume, m.hrs] : null,
    media ? [n1(media), 'nota média'] : null,
    [feitos, feitos === 1 ? m.l4s : m.l4]
  ].filter(Boolean)
   .map(([v, l]) => `<div class="tl-fig"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');

  const dist = { S:0, A:0, B:0, C:0, NR:0 };
  L.forEach(j => dist[_tierDe(j)]++);
  const segs = ['S','A','B','C','NR'].filter(t => dist[t]).map(t => {
    const nome = t === 'NR' ? 'Sem tier' : 'Tier ' + t;
    const txt = `${dist[t]} ${plural(dist[t], 'item', 'itens')}`;
    return `<button type="button" class="tl-seg" data-tier="${t}" data-go="${t}" style="--n:${dist[t]}" title="${nome}: ${txt}" aria-label="Ir para ${nome} (${txt})"><span>${t === 'NR' ? '?' : t}</span><small>${dist[t]}</small></button>`;
  }).join('');

  el.innerHTML = `<div class="tl-figs">${figs}</div><div class="tl-spread" role="group" aria-label="Distribuição por tier">${segs}</div>`;
}

/* ---------- Chips de gênero ---------- */
function renderGeneroChips(){
  const wrap = $('generoChips'), row = $('generoRow'); if(!wrap) return;
  const L = LISTA();
  const contagem = {};
  L.forEach(j => _arr(j.generos).forEach(g => {
    const k = String(g).trim();
    if(k) contagem[k] = (contagem[k] || 0) + 1;
  }));
  const generos = Object.keys(contagem).sort((a,b) => contagem[b] - contagem[a]);
  if(row) row.hidden = !generos.length;
  if(!generos.length){ wrap.innerHTML = ''; return; }
  const ativos = _arr(generoFiltro);
  wrap.innerHTML =
    `<button type="button" class="tl-chip" data-gen="all" aria-pressed="${!ativos.length}">Todos <b>${L.length}</b></button>` +
    generos.map(g => `<button type="button" class="tl-chip" data-gen="${esc(g)}" aria-pressed="${ativos.includes(g)}">${esc(g)} <b>${contagem[g]}</b></button>`).join('');
}

/* ---------- Chips de status ---------- */
function renderChips(){
  const wrap = $('chips'); if(!wrap) return;
  const ativos = _arr(filtro);
  const L = LISTA();
  wrap.innerHTML = MODOS[modo].status.map(s => {
    const on = s === 'Todos' ? !ativos.length : ativos.includes(s);
    const qtd = s === 'Todos' ? L.length : L.filter(j => j.status === s).length;
    return `<button type="button" class="tl-chip" data-s="${esc(s)}" aria-pressed="${on}" title="${esc(STATUS_TOOLTIP[s] || s)}">${esc(s)} <b>${qtd}</b></button>`;
  }).join('') + `<button type="button" class="tl-chip fav" data-fav="1" aria-pressed="${favoritosFiltro}" title="Só favoritos">${ICO_STAR}Favoritos</button>`;
}

function aplicarModo(novo, salvar = true){
  if(!MODOS[novo]) novo = 'jogos';
  modo = novo; filtro = []; generoFiltro = []; favoritosFiltro = false;
  const q = $('q'); if(q){ q.value = ''; q.placeholder = MODOS[modo].busca; }
  document.querySelectorAll('#modo button').forEach(x => {
    const on = x.dataset.m === modo;
    x.classList.toggle('on', on);
    x.setAttribute('aria-pressed', String(on));
  });
  const m = MODOS[modo];
  $('tlTitulo').textContent = m.titulo;
  $('tlSub').textContent = m.sub;
  const opt = document.querySelector('#sortSelect option[value="horas"]');
  if(opt) opt.textContent = m.horasLabel;
  desenharStats(); desenhar();
  $('tmdbNote').style.display = modo === 'filmes' ? '' : 'none';
  if(salvar){ try{ localStorage.setItem('modoTier', modo); }catch(e){} }
}

function limparFiltros(){
  filtro = []; generoFiltro = []; favoritosFiltro = false;
  const q = $('q'); if(q) q.value = '';
  renderChips(); renderGeneroChips(); desenhar();
}

/* ---------- Card ---------- */
function cartao(j, i){
  const ini = j.nome.split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase();
  const podeArrastar = _ehAdmin() && !ADMIN_MULTISEL.ativo;
  const aoVivo = _jogoAoVivoNome && norm(j.nome) === norm(_jogoAoVivoNome);

  const conq = (j.conquistas && j.conquistas.total > 0) ? j.conquistas : null;
  const pct = conq ? Math.round((conq.obtidas / conq.total) * 100) : 0;
  const platina = (conq && conq.obtidas === conq.total) ? `<span class="tl-plat" title="100% completado">100%</span>` : '';
  const prog = (j.status === 'Jogando' && pct > 0) ? `<span class="tl-prog"><i style="width:${pct}%"></i></span>` : '';
  const nota = j.nota > 0 ? `<span class="tl-rate">${ICO_STAR}${n1(j.nota)}</span>` : '';

  const txt = (j.comentario || j.sinopse || '').trim();
  const gens = _arr(j.generos).slice(0, 3).map(g => `<span>${esc(g)}</span>`).join('');
  const peek = (gens || txt)
    ? `<span class="tl-peek">${gens ? `<span class="tl-peek-gen">${gens}</span>` : ''}${txt ? `<span class="tl-peek-txt">${esc(txt.slice(0, 140))}${txt.length > 140 ? '…' : ''}</span>` : ''}</span>`
    : '';

  const valor = j.horas > 0 ? fh(j.horas) : (j.duracao > 0 ? fmtDuracao(j.duracao) : '');
  const status = j.status ? `<span class="tl-st"><i class="tl-dot" data-s="${esc(j.status)}"></i>${esc(j.status)}</span>` : '';
  const info = (status || valor)
    ? `<span class="tl-info">${status}${valor ? `<span>${esc(valor)}</span>` : ''}</span>` : '';

  const img = j.capa
    ? `<img src="${esc(j.capa)}" alt="" loading="lazy" draggable="false" onerror="${j.appid ? `if(!this.dataset.f){this.dataset.f=1;this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${j.appid}/header.jpg'}else this.remove()` : 'this.remove()'}">`
    : '';

  return `
    <button type="button" class="tl-card${j.favorito ? ' favorito' : ''}" data-i="${i}" data-id="${esc(j.id)}" draggable="${podeArrastar}" aria-label="${esc(j.nome)}">
      <span class="tl-poster">
        <span class="tl-ph">${esc(ini)}</span>
        ${img}
        <span class="tl-flags">
          <span class="tl-flag fav" aria-hidden="true">${ICO_STAR}</span>
          ${aoVivo ? `<span class="tl-flag live">Ao vivo</span>` : ''}
          ${ehNovo(j) ? `<span class="tl-flag novo">Novo</span>` : ''}
        </span>
        ${nota}${platina}${prog}${peek}
      </span>
      <span class="tl-name">${esc(j.nome)}</span>
      ${info}
    </button>`;
}

/* ---------- Linha de tier ---------- */
function linha(tier, lista){
  const m = MODOS[modo];
  const n = lista.length;
  const comNota = lista.filter(j => j.nota > 0);
  const media = comNota.length ? n1(comNota.reduce((a,j) => a + j.nota, 0) / comNota.length) : '';
  const rotulo = tier === 'NR' ? '?' : tier;
  const nome = tier === 'NR' ? 'Sem tier' : 'Tier ' + tier;
  const vazio = (_ehAdmin() && !ADMIN_MULTISEL.ativo) ? `Arraste um ${m.sing} pra cá` : m.vazio;
  return `
    <div class="tl-tier${n ? '' : ' is-empty'}" id="tl-tier-${tier}" data-tier="${tier}">
      <div class="tl-tab" title="${nome}">
        <span class="tl-letter">${rotulo}</span>
        <span class="tl-tab-meta">
          <span>${n ? `${n} ${plural(n, 'item', 'itens')}` : 'vazio'}</span>
          ${media ? `<span>média ${media}</span>` : ''}
        </span>
      </div>
      <div class="tl-shelf" data-tier="${tier}">
        ${n ? lista.map(j => cartao(j, LISTA().indexOf(j))).join('') : `<span class="tl-empty">${vazio}</span>`}
      </div>
    </div>`;
}

/* ---------- Filtros + ordenação ---------- */
function _filtrosAtivos(){
  return !!(($('q')?.value || '').trim() || _arr(filtro).length || _arr(generoFiltro).length || favoritosFiltro);
}

function _aplicarFiltrosOrdenacao(){
  const q = norm($('q')?.value || '');
  const ativos = _arr(filtro);
  const gens = _arr(generoFiltro).map(g => g.toLowerCase());

  const lista = LISTA().filter(j => {
    if(ativos.length && !ativos.includes(j.status)) return false;
    if(favoritosFiltro && !j.favorito) return false;
    if(gens.length){
      const jg = _arr(j.generos).map(g => String(g).toLowerCase());
      if(!gens.some(g => jg.includes(g))) return false;
    }
    if(q && !norm(j.nome).includes(q)) return false;
    return true;
  });

  const cmp = {
    nome: (a,b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity:'base' }),
    horas: (a,b) => (b.horas || b.duracao || 0) - (a.horas || a.duracao || 0),
    recentes: (a,b) => {
      const ta = a.adicionadoEm ? new Date(a.adicionadoEm).getTime() : 0;
      const tb = b.adicionadoEm ? new Date(b.adicionadoEm).getTime() : 0;
      return tb - ta;
    },
    favoritos: (a,b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0),
    nota: (a,b) => (b.nota || 0) - (a.nota || 0)
  };
  const prim = cmp[sortMode] || cmp.nota;
  const sec = (sortMode === 'nota' || sortMode === 'favoritos') ? cmp.horas : cmp.nota;
  return lista.sort((a,b) => prim(a,b) || sec(a,b));
}

function desenhar(){
  const el = $('tiers'); if(!el) return;
  const m = MODOS[modo];
  const lista = _aplicarFiltrosOrdenacao();
  const total = LISTA().length;

  const cont = $('tlContador');
  if(cont){
    cont.innerHTML = `<b>${lista.length}</b> de ${total} ${plural(total, 'item', 'itens')}`;
    cont.hidden = !total;
  }

  if(!total){
    if(_bibliotecaCarregada){
      el.innerHTML = `<div class="tl-none"><p>A lista de ${m.plural} ainda está vazia.</p></div>`;
    } else {
      el.innerHTML = TIERS.map(t => `
        <div class="tl-tier" data-tier="${t}">
          <div class="tl-tab"><span class="tl-letter">${t}</span></div>
          <div class="tl-shelf">${'<div class="tl-card skeleton"><span class="tl-poster"></span><span class="tl-name"></span></div>'.repeat(3)}</div>
        </div>`).join('');
    }
    return;
  }

  if(!lista.length){
    el.innerHTML = `<div class="tl-none"><p>Nenhum ${m.sing} bate com esses filtros.</p><button type="button" class="tl-chip" data-act="limpar">Limpar filtros</button></div>`;
    return;
  }

  const filtrando = _filtrosAtivos();
  el.innerHTML = [...TIERS, 'NR'].map(t => {
    const itens = lista.filter(j => _tierDe(j) === t);
    if(!itens.length && (filtrando || t === 'NR')) return '';
    return linha(t, itens);
  }).join('');
  setupDragDrop();
}

/* ---------- Mover de tier (drag, teclado) ---------- */
function _moverTier(item, novoTier, origem){
  const antigo = _tierDe(item);
  if(antigo === novoTier) return false;
  pushUndo(_snapshot());
  item.tier = novoTier;
  desenharStats(); desenhar();
  toast(`✅ "${item.nome}": ${antigo} → ${novoTier}`, 'ok');
  _salvarBiblioteca(`${origem}: moveu "${item.nome}" de ${antigo} pra ${novoTier}`);
  return true;
}

function setupDragDrop(){
  if(!_ehAdmin() || ADMIN_MULTISEL.ativo) return;
  document.querySelectorAll('#tiers .tl-card[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => {
      const i = Number(el.dataset.i);
      dragItem = { idx: i, id: LISTA()[i].id };
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', LISTA()[i].nome); } catch(err){}
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('.tl-shelf.drag-over').forEach(x => x.classList.remove('drag-over'));
      dragItem = null;
    });
  });
  document.querySelectorAll('#tiers .tl-shelf').forEach(shelf => {
    shelf.addEventListener('dragover', e => {
      if(!dragItem) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      shelf.classList.add('drag-over');
    });
    shelf.addEventListener('dragleave', e => {
      if(!shelf.contains(e.relatedTarget)) shelf.classList.remove('drag-over');
    });
    shelf.addEventListener('drop', e => {
      e.preventDefault();
      shelf.classList.remove('drag-over');
      if(!dragItem) return;
      const item = LISTA()[dragItem.idx];
      const novo = shelf.dataset.tier;
      dragItem = null;
      if(item && novo) _moverTier(item, novo, 'Arrastou');
    });
  });
}

/* ---------- Detalhes (dialog compartilhado #dlg) ---------- */
function abrirDetalhe(j){
  const m = MODOS[modo];
  $('dTitle').textContent = j.nome;
  let terceiro = '';
  if(modo === 'jogos'){
    if(j.conquistas && j.conquistas.total) terceiro = `<div><b>${j.conquistas.obtidas}/${j.conquistas.total}</b><span>conquistas</span></div>`;
  } else if(j.ano){
    terceiro = `<div><b>${j.ano}</b><span>ano</span></div>`;
  }
  const generosHTML = _arr(j.generos).length
    ? `<div class="badges">${j.generos.map(g => `<span class="bd">${esc(g)}</span>`).join('')}</div>` : '';
  const plat = PLATAFORMA_NOME[j.plataforma] ? `<span class="bd">${PLATAFORMA_NOME[j.plataforma]}</span>` : '';
  $('dBody').innerHTML = `
    <div class="mrow">
      ${j.capa ? `<img src="${esc(j.capa)}" alt="${esc(j.nome)}" onerror="this.style.display='none'">` : '<div></div>'}
      <div class="mside">
        <div class="badges">
          <span class="bd">${_tierDe(j) === 'NR' ? 'Sem tier' : 'Tier ' + j.tier}</span>
          ${j.status ? `<span class="bd">${esc(j.status)}</span>` : ''}
          ${plat}
          ${j.favorito ? `<span class="bd">⭐ Favorito</span>` : ''}
        </div>
        ${generosHTML}
        <div class="kv">
          <div><b>${j.horas ? fh(j.horas) : (j.duracao ? fmtDuracao(j.duracao) : '—')}</b><span>${m.hl}</span></div>
          <div><b>${j.nota > 0 ? '⭐ ' + n1(j.nota) : '—'}</b><span>nota</span></div>
          ${terceiro}
        </div>
        ${(j.comentario || j.sinopse) ? `<p>${esc(j.comentario || j.sinopse)}</p>` : ''}
      </div>
    </div>`;
  $('dlg').showModal();
}

/* ---------- Sorteio ---------- */
function abrirRoleta(){
  const dlg = $('roletaDlg'); if(!dlg) return;
  const lista = _aplicarFiltrosOrdenacao();
  if(!lista.length){ toast('Nada pra sortear com esses filtros 😢', 'warn'); return; }
  dlg.showModal();
  rodarRoleta(lista);
}

function _slotHTML(j){
  const ini = j.nome.split(/\s+/).filter(Boolean).slice(0,2).map(p => p[0]).join('').toUpperCase();
  return `<span class="tl-roll-ph">${esc(ini)}</span>` +
    (j.capa ? `<img src="${esc(j.capa)}" alt="" onerror="this.remove()">` : '');
}

function rodarRoleta(lista){
  const slot = $('roletaSlot');
  if(!slot || _roletaRodando || !lista.length) return;
  _roletaRodando = true;
  _roletaVencedor = null;

  const info = $('roletaInfo'), ver = $('roletaVer'), desc = $('roletaDesc');
  const novamente = $('roletaNovamente');
  slot.classList.add('rolling');
  slot.classList.remove('done');
  info.hidden = true;
  ver.hidden = true;
  if(novamente) novamente.disabled = true;
  desc.textContent = 'Sorteando…';

  const total = 22 + Math.floor(Math.random() * 8);
  const vencedor = lista[Math.floor(Math.random() * lista.length)];
  let n = 0;

  const timer = setInterval(() => {
    slot.innerHTML = _slotHTML(lista[Math.floor(Math.random() * lista.length)]);
    if(++n < total) return;
    clearInterval(timer);
    slot.innerHTML = _slotHTML(vencedor);
    slot.classList.remove('rolling');
    slot.classList.add('done');
    desc.textContent = MODOS[modo].sorteio;
    $('roletaNome').textContent = vencedor.nome;
    const partes = [];
    if(_tierDe(vencedor) !== 'NR') partes.push(`Tier ${vencedor.tier}`);
    if(vencedor.nota > 0) partes.push(`nota ${n1(vencedor.nota)}`);
    if(modo === 'jogos' && vencedor.horas > 0) partes.push(fh(vencedor.horas));
    if(vencedor.status) partes.push(vencedor.status);
    $('roletaMeta').textContent = partes.join(' · ');
    info.hidden = false;
    ver.hidden = false;
    if(novamente) novamente.disabled = false;
    _roletaVencedor = vencedor;
    _roletaRodando = false;
  }, 80);
}

function _irParaItem(item){
  const card = document.querySelector(`#tiers .tl-card[data-id="${CSS.escape(String(item.id))}"]`);
  if(!card){ toast('Esse item não está visível com os filtros atuais', 'warn'); return; }
  card.scrollIntoView({ behavior:'smooth', block:'center' });
  card.classList.remove('pulse');
  void card.offsetWidth;
  card.classList.add('pulse');
  setTimeout(() => card.classList.remove('pulse'), 1800);
}

function setupRoleta(){
  const btn = $('btnRoleta'); if(!btn) return;
  btn.addEventListener('click', abrirRoleta);
  const dlg = $('roletaDlg'); if(!dlg) return;
  $('roletaFechar')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });
  $('roletaNovamente')?.addEventListener('click', () => rodarRoleta(_aplicarFiltrosOrdenacao()));
  $('roletaVer')?.addEventListener('click', () => {
    const v = _roletaVencedor;
    dlg.close();
    if(v) setTimeout(() => _irParaItem(v), 120);
  });
}

/* ---------- Atalhos de teclado (admin) ---------- */
function setupKeyboardShortcuts(){
  let selectedId = null;

  document.addEventListener('click', e => {
    const card = e.target.closest('#tiers .tl-card');
    if(!card || !_ehAdmin() || e.ctrlKey || e.metaKey) return;
    document.querySelectorAll('#tiers .tl-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    card.classList.add('is-selected');
    selectedId = card.dataset.id;
  });

  document.addEventListener('keydown', e => {
    if(!_ehAdmin()) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){
      if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      desfazerUltima();
      return;
    }
    if(!selectedId) return;
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if(e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();
    if(key === 'escape'){
      document.querySelectorAll('#tiers .tl-card.is-selected').forEach(c => c.classList.remove('is-selected'));
      selectedId = null;
      return;
    }
    const map = { s:'S', a:'A', b:'B', c:'C', n:'NR' };
    if(!map[key]) return;
    const item = LISTA().find(j => String(j.id) === selectedId);
    if(!item) return;
    e.preventDefault();
    if(_moverTier(item, map[key], 'Teclado')){
      setTimeout(() => {
        const card = document.querySelector(`#tiers .tl-card[data-id="${CSS.escape(selectedId)}"]`);
        if(card) card.classList.add('is-selected');
      }, 60);
    }
  });
}

/* ---------- Favoritar (botão direito, admin) ---------- */
function setupFavoritoContext(){
  document.addEventListener('contextmenu', e => {
    const card = e.target.closest('#tiers .tl-card');
    if(!card || !_ehAdmin()) return;
    e.preventDefault();
    const item = LISTA().find(j => String(j.id) === card.dataset.id);
    if(!item) return;
    item.favorito = !item.favorito;
    card.classList.toggle('favorito', item.favorito);
    toast(item.favorito ? `⭐ "${item.nome}" favoritado` : `"${item.nome}" desfavoritado`, 'ok');
    _salvarBiblioteca(`${item.favorito ? 'Favoritou' : 'Desfavoritou'} "${item.nome}"`);
  });
}

/* ---------- Setup geral ---------- */
function setupTierList(){
  if(setupTierList._ok) return;
  setupTierList._ok = true;

  $('modo')?.addEventListener('click', e => {
    const b = e.target.closest('button');
    if(!b || b.dataset.m === modo) return;
    aplicarModo(b.dataset.m);
  });

  $('q')?.addEventListener('input', desenhar);

  const sel = $('sortSelect');
  if(sel){
    try{
      const salvo = localStorage.getItem('tier:sort');
      if(salvo && sel.querySelector(`option[value="${salvo}"]`)){ sortMode = salvo; sel.value = salvo; }
    }catch(e){}
    sel.addEventListener('change', () => {
      sortMode = sel.value || 'nota';
      try{ localStorage.setItem('tier:sort', sortMode); }catch(e){}
      desenhar();
    });
  }

  $('chips')?.addEventListener('click', e => {
    const b = e.target.closest('.tl-chip'); if(!b) return;
    if(b.dataset.fav){ favoritosFiltro = !favoritosFiltro; }
    else {
      const s = b.dataset.s;
      if(s === 'Todos') filtro = [];
      else {
        filtro = _arr(filtro).slice();
        const idx = filtro.indexOf(s);
        if(idx >= 0) filtro.splice(idx, 1); else filtro.push(s);
      }
    }
    renderChips();
    desenhar();
  });

  $('generoChips')?.addEventListener('click', e => {
    const b = e.target.closest('.tl-chip'); if(!b) return;
    const g = b.dataset.gen;
    if(g === 'all') generoFiltro = [];
    else {
      generoFiltro = _arr(generoFiltro).slice();
      const idx = generoFiltro.indexOf(g);
      if(idx >= 0) generoFiltro.splice(idx, 1); else generoFiltro.push(g);
    }
    renderGeneroChips();
    desenhar();
  });

  $('stats')?.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if(!b) return;
    document.getElementById('tl-tier-' + b.dataset.go)?.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  $('tiers')?.addEventListener('click', e => {
    if(e.target.closest('[data-act="limpar"]')){ limparFiltros(); return; }
    const b = e.target.closest('.tl-card'); if(!b) return;
    if(b.classList.contains('dragging') || b.classList.contains('is-selected')) return;
    const j = LISTA()[+b.dataset.i];
    if(j) abrirDetalhe(j);
  });

  setupRoleta();
  setupKeyboardShortcuts();
  setupFavoritoContext();
}
window.setupTierList = setupTierList;

window.setJogoAoVivo = function(nome){
  _jogoAoVivoNome = nome || null;
  if(document.getElementById('sec-tierlist')?.classList.contains('active') || document.getElementById('sec-tierlist')?.classList.contains('ativo')) desenhar();
};

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
      <a class="nav-user-deslogado" href="/api/auth?action=login" title="Entrar com Discord">
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
function getVotosVistos(){ try { return JSON.parse(localStorage.getItem(VOTOS_VISTOS_KEY) || '[]'); } catch { return []; } }
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

  const semOpcoes = !VOTOS_DADOS.length && votoStatus === 'ok';

  // 🆕 Esconde/mostra o card "Próximo na votação" na home
  const proxHalf = document.querySelector('.jogos-card .jogo-half:nth-child(2)');
  if(proxHalf) proxHalf.style.display = semOpcoes ? 'none' : '';

  if(semOpcoes){
    if(infoTop) infoTop.style.display = 'none';
    destBox.innerHTML = '';
    listaBox.innerHTML = `
      <div class="voto-vazio">
        <span class="vv-emoji">🗳️</span>
        <b>Nenhuma votação rolando agora</b>
        <p>A Soso ainda não abriu uma nova votação. Volta mais tarde ou passa no Discord pra ficar por dentro 💜</p>
        <a class="btn" href="https://discord.gg/J4gGaKWFPZ" target="_blank" rel="noopener">💬 Falar no Discord</a>
      </div>`;
    if(proxCover) proxCover.style.display = 'none';
    if(proxBarWrap) proxBarWrap.style.visibility = 'hidden';
    if($('proxNome')) $('proxNome').textContent = 'Sem votação';
    if($('proxInfo')) $('proxInfo').textContent = 'Aguardando a Soso abrir a próxima votação 💜';
    return;
  }

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
    if(proxBarWrap) proxBarWrap.style.visibility = 'hidden';
    return;
  }
  if(!VOTOS_DADOS.length){
    if(infoTop) infoTop.style.display = 'none';
    destBox.innerHTML = '';
    listaBox.innerHTML = `<div class="vazio-voto"><b>${votoStatus === 'erro' ? 'Votação indisponível' : 'Carregando votação…'}</b></div>`;
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
    if(total === 0){ statLider.textContent = '—'; statLider.parentElement.style.display = 'none'; }
    else { statLider.parentElement.style.display = ''; statLider.textContent = 'líder com ' + pct(ord[0].votos) + '%'; }
  }

  const btn = (it) => {
    const meu = meuVoto === it.id;
    if(fechada) return `<button class="btn ghost" disabled>Encerrada</button>`;
    if(meu) return `<button class="btn ghost" disabled>Votado ✓</button>`;
    return `<button class="btn pulse-vote" onclick="votar('${it.id}', event)">${meuVoto ? 'Trocar voto' : 'Votar'}</button>`;
  };

  if(total > 0){
    const l = ord[0], p = pct(l.votos);
    const segundo = ord[1];
    let vantagemTxt = '';
    if(segundo && segundo.votos > 0){
      const diff = l.votos - segundo.votos;
      vantagemTxt = diff === 0 ? ' · Empatado com o 2º' : ` · ${diff} ${plural(diff, 'voto', 'votos')} de vantagem`;
    } else if(l.votos > 1){ vantagemTxt = ' · Unanimidade'; }

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
    if(proxBarWrap && proxBarI){ proxBarWrap.style.visibility = 'visible'; proxBarI.style.width = p + '%'; }
  } else {
    destBox.innerHTML = '';
    if(proxCover) proxCover.style.display = 'none';
    if(proxBarWrap) proxBarWrap.style.visibility = 'hidden';
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
          <div class="vt-bar"><i style="width:${votos > 0 ? Math.max(p, 8) : 0}%"></i></div>
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
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ id })
    });
    if(r.status === 401){ await checarLogin(); return; }
    if(r.status === 403){
      const d = await r.json();
      toast(d.error || 'Você foi banido de votar', 'erro');
      return;
    }
    if(r.ok){ aplicarVotos(await r.json()); toast('Voto registrado! 💜', 'ok'); }
  }catch(e){}
  renderVotacao();
}
window.votar = votar;

/* ============================================================
   SUGESTÕES
   ============================================================ */
function sugTabIrPara(tab){
  try { localStorage.setItem('sug:tab', tab); } catch(e){}
  document.querySelectorAll('.sug-tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  document.querySelectorAll('.sug-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === tab));
}
window.sugTabIrPara = sugTabIrPara;

function setupSugTabs(){
  const wrap = $('sugTabs'); if(!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.sug-tab'); if(!b) return;
    sugTabIrPara(b.dataset.tab);
  });
  const btnIr = $('sugBtnIrSugerir');
  if(btnIr){
    btnIr.addEventListener('click', () => {
      sugTabIrPara('sugerir');
      setTimeout(() => {
        const chip = document.querySelector('.st-chip[data-tipo="Sugestão de jogo"]');
        if(chip) chip.click();
        const ta = $('sugTexto'); if(ta) ta.focus();
      }, 180);
    });
  }
  const salva = localStorage.getItem('sug:tab') || 'votar';
  sugTabIrPara(salva);
}
window.setupSugTabs = setupSugTabs;

function setupSugForm(){
  const chips = document.querySelectorAll('#sugTipoChips .st-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      sugTipoAtual = chip.dataset.tipo;
      const sel = $('sugTipo'); if(sel) sel.value = sugTipoAtual;
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
  if(ta){ ta.addEventListener('input', () => { ta.classList.remove('erro'); atualizarContador(); atualizarEstadoBtn(); }); }
  atualizarContador(); atualizarEstadoBtn();
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
  if(texto.length > SUG_MAX_CHARS){ toast(`Máx ${SUG_MAX_CHARS} caracteres.`, 'warn'); return; }

  btn.disabled = true;
  try{
    const res = await fetch('/api/sugestoes', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ nome, tipo, texto, site:$('sugSite').value })
    });
    let dados = null;
    try { dados = await res.json(); } catch(e){}
    if(res.ok){
      $('sugNome').value = ''; $('sugTexto').value = '';
      const counter = $('sugCounter');
      if(counter){ counter.textContent = `0 / ${SUG_MAX_CHARS}`; counter.classList.remove('warn','danger'); }
      if(success){ success.hidden = false; setTimeout(() => { success.hidden = true; }, 6000); }
      toast('Ideia enviada! Obrigado 💜', 'ok');
      carregarUltimasIdeias();
    } else if(res.status === 400 && dados && dados.error){
      toast(dados.error, 'warn');
      $('sugTexto').classList.add('erro');
    } else if(res.status === 429){
      toast((dados && dados.error) || 'Calma! Aguarde alguns segundos.', 'warn');
    } else {
      toast((dados && dados.error) || 'Não consegui enviar agora.', 'erro');
    }
  }catch(e){ toast('Sem conexão com o servidor.', 'erro'); }
  finally { setTimeout(() => { const txt = ($('sugTexto')?.value || '').trim(); if(btn) btn.disabled = txt.length < 3; }, 100); }
}
window.enviarSugestao = enviarSugestao;

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

/* 🆕 Renderiza 2 grupos de chips clicáveis: tipo + status */
function renderSirFiltros(itens){
  const wrap = $('sirFiltros'); if(!wrap) return;

  const tiposDisponiveis = { 'all': true, 'sugestao': false, 'jogo': false, 'feedback': false, 'bug': false };
  itens.forEach(i => {
    const t = tipoInfoSug(i.tipo).label;
    if(tiposDisponiveis[t] !== undefined) tiposDisponiveis[t] = true;
  });

  const statCount = { nova:0, analise:0, aceita:0, recusada:0, concluido:0 };
  itens.forEach(i => {
    const st = i.status || 'nova';
    if(statCount[st] !== undefined) statCount[st]++;
  });

  const statusOpts = [
    { id:'all',       ic:'·',  label:'Todas' },
    { id:'nova',      ic:'🟡', label:'Nova' },
    { id:'analise',   ic:'👀', label:'Em análise' },
    { id:'aceita',    ic:'✅', label:'Aceita' },
    { id:'recusada',  ic:'❌', label:'Recusada' },
    { id:'concluido', ic:'🏁', label:'Concluída' }
  ];

  const tipoOpts = [
    { id:'all',      label:'Todos' },
    { id:'sugestao', label:'💡' },
    { id:'jogo',     label:'🎮' },
    { id:'feedback', label:'💬' },
    { id:'bug',      label:'🐛' }
  ].filter(o => o.id === 'all' || tiposDisponiveis[o.id]);

  wrap.innerHTML = `
    <div class="sir-filtros-grupo">
      ${tipoOpts.map(o => `
        <button type="button" class="sir-chip ${sirFiltro === o.id ? 'on' : ''}" data-filtro="${o.id}">
          ${o.label}
        </button>
      `).join('')}
    </div>
    <div class="sir-filtros-grupo sir-filtros-status">
      ${statusOpts.filter(o => o.id === 'all' || statCount[o.id] > 0).map(o => {
        const n = o.id === 'all' ? itens.length : statCount[o.id];
        return `
          <button type="button" class="sir-chip sir-status-chip ${sirStatusFiltro === o.id ? 'on' : ''}" data-status="${o.id}">
            <span class="sic-ic">${o.ic}</span>
            <span class="sic-lb">${o.label}</span>
            <b class="sic-count">${n}</b>
          </button>
        `;
      }).join('')}
    </div>
  `;
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
      lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nenhuma ideia ainda. Seja a primeira 💜</small></div>`;
      return;
    }
    let filtrados = itens;
    if(sirFiltro !== 'all') filtrados = filtrados.filter(i => tipoInfoSug(i.tipo).label === sirFiltro);
    if(sirStatusFiltro !== 'all') filtrados = filtrados.filter(i => (i.status || 'nova') === sirStatusFiltro);

    if(!filtrados.length){
      lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nada com esse filtro</small></div>`;
      return;
    }
    lista.innerHTML = filtrados.slice(0, 20).map(i => {
      const st = statusInfoSug(i);
      const ti = tipoInfoSug(i.tipo);
      const motivoHTML = (i.status === 'recusada' && i.motivo) ? `<div class="sir-motivo">${esc(i.motivo)}</div>` : '';
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

/* 🆕 Aceita os dois tipos de chip (tipo + status) */
function setupSirFiltros(){
  const wrap = $('sirFiltros'); if(!wrap || wrap.dataset.bound) return;
  wrap.dataset.bound = '1';
  wrap.addEventListener('click', e => {
    const btnTipo = e.target.closest('.sir-chip[data-filtro]');
    const btnStatus = e.target.closest('.sir-chip[data-status]');
    if(btnTipo){
      sirFiltro = btnTipo.dataset.filtro || 'all';
    } else if(btnStatus){
      sirStatusFiltro = btnStatus.dataset.status || 'all';
    } else return;
    carregarUltimasIdeias();
  });
}

/* ============================================================
   CONFIG PÚBLICA
   ============================================================ */
async function carregarConfigPublica(){
  try{
    const r = await fetch('/api/config', { cache: 'no-store' });
    if(!r.ok) return;
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
   REVEAL + TILT + PARALLAX + BURGER + FLOATING LIVE
   ============================================================ */
function setupReveal(){
  revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('in');
        revealObs.unobserve(e.target);
        const d = parseFloat(e.target.style.transitionDelay) || 0;
        setTimeout(() => { e.target.style.transitionDelay = ''; }, 800 + d * 1000);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px', threshold: 0.05 });

  document.querySelectorAll('.bento-col').forEach(col => {
    col.querySelectorAll('.card.reveal').forEach((card, i) => {
      if(i > 0) card.style.transitionDelay = (i * 70) + 'ms';
    });
  });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  setupCardTilt();
}

function setupCardTilt(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('.card').forEach(card => {
    if(card.dataset.tiltBound === '1') return;
    if(card.closest('dialog')) return;
    card.dataset.tiltBound = '1';

    let raf = 0, ev = null;
    const aplicar = () => {
      raf = 0;
      if(!ev) return;
      const rect = card.getBoundingClientRect();
      const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
      card.style.setProperty('--mx', px.toFixed(0) + 'px');
      card.style.setProperty('--my', py.toFixed(0) + 'px');
      if(matchMedia('(max-width: 960px)').matches) return;
      const max = rect.width > 560 ? 2.2 : 5;
      const x = px / rect.width - 0.5, y = py / rect.height - 0.5;
      card.style.setProperty('--tilt-ry', (x * max).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-rx', (-y * max).toFixed(2) + 'deg');
    };

    card.addEventListener('mousemove', (e) => {
      ev = e;
      if(!raf) raf = requestAnimationFrame(aplicar);
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      ev = null;
      card.style.setProperty('--tilt-ry', '0deg');
      card.style.setProperty('--tilt-rx', '0deg');
    });
  });
}
window.setupCardTilt = setupCardTilt;

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

/* 🆕 CORREÇÃO DO BOTÃO VOLTAR PRA LIVE */
function setupFloatingLive(){
  const btn = document.getElementById('floatLiveBtn');
  if(!btn) return;
  
  window.addEventListener('scroll', () => {
    if(!ultVivo) { btn.classList.remove('show'); return; }
    const player = document.querySelector('.twitch-player-box');
    
    // Se o player não estiver na tela (aba errada), esconde o botão
    if(!player || player.offsetParent === null) { 
      btn.classList.remove('show'); 
      return; 
    }
    
    const r = player.getBoundingClientRect();
    if(r.bottom < 100) btn.classList.add('show');
    else btn.classList.remove('show');
  }, { passive: true });
  
  btn.addEventListener('click', () => {
    const player = document.querySelector('.twitch-player-box');
    
    // Se o player não estiver visível (aba errada), muda pra início primeiro
    if(!player || player.offsetParent === null) {
      mudarAba('inicio');
      // Espera a animação da troca de aba e rola até o player
      setTimeout(() => {
        const p = document.querySelector('.twitch-player-box');
        if(p) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    } else {
      // Se já está na aba início, só rola
      player.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', async () => {
  const isPreview = location.search.includes('preview=1');
  if(isPreview){ try { localStorage.removeItem('abaAtiva'); } catch(e){} }

  const hashRaw = (location.hash || '').replace(/^#/, '');
  let abaInicial = 'inicio';
  if(!isPreview){
    if(hashRaw === 'admin' || hashRaw.startsWith('admin/')) abaInicial = 'admin';
    else if(hashRaw && ABAS_VALIDAS.includes(hashRaw)) abaInicial = hashRaw;
  }
  if(!document.getElementById('sec-' + abaInicial)) abaInicial = 'inicio';

  _ultimaAba = null;
  _executarMudarAba(abaInicial, false);

  renderAviso(); renderEmotes(); renderSiteUpdate();
  renderChips(); renderComandos(); renderHomeExtras();
  setupComunidadeTabs();
  setupSubShortcuts();
  iniciarHall();
  renderOuvindo();

  if (typeof setupView === 'undefined') {
    window.setupView = localStorage.getItem(SETUP_VIEW_KEY) || '3d';
  } else {
    setupView = localStorage.getItem(SETUP_VIEW_KEY) || '3d';
  }
  document.querySelectorAll('.svt-btn').forEach(b => {
    const on = b.dataset.view === setupView;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  setupRender(); renderSonhos(); renderApoiadores(); setupSetup3D();

  const setupBuscaEl = $('setupBusca');
  if(setupBuscaEl) setupBuscaEl.addEventListener('input', e => { setupBusca = e.target.value; setupRender(); });
  document.querySelectorAll('.svt-btn').forEach(b => { b.addEventListener('click', () => setupSetView(b.dataset.view)); });

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

  try{ const ms = localStorage.getItem('modoTier'); if(ms && ms !== modo) aplicarModo(ms, false); }catch(e){}

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
  setInterval(carregarOuvindoAgora, 5000);
  carregarBiblioteca();
  setupTierList();
  carregarVotosApi();

  setInterval(() => { if(VOTOS_FECHAMENTO) renderVotacao(); }, 60000);

  setInterval(() => {
    if(ultVivo && ultGame) atualizarFoco(ultGame, ultVivo);
  }, 30000);

  setTimeout(() => setupCardTilt(), 800);
  setTimeout(() => setupCardTilt(), 2000);
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