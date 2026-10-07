/* ============================================================
   ADMIN — CORE (Rotas, Sidebar, Estado)
   ============================================================ */
function adminIrPara(pagina){
  if(pagina === 'votacao') ADMIN_TAB = 'votos';
  if(pagina === 'sugestoes') ADMIN_SUG_STATUS = 'all';
  ADMIN_PAGE = pagina;
  try { localStorage.setItem('admin:page', pagina); } catch(e){}
  carregarAdmin();
}
function adminIrAba(aba){ ADMIN_TAB = aba; renderAdminVotacao(); }
function adminIrTierTab(tab){
  ADMIN_TIER_TAB = tab;
  localStorage.setItem('admin:tierTab', tab);
  renderAdminTierList();
}
function adminIrConfigTab(tab){ ADMIN_CONFIG_TAB = tab; renderAdminConfig(); }
function adminIrSugFiltro(f){ ADMIN_SUG_STATUS = f; renderAdminSugestoes(); }
window.adminIrPara = adminIrPara;
window.adminIrAba = adminIrAba;
window.adminIrTierTab = adminIrTierTab;
window.adminIrConfigTab = adminIrConfigTab;
window.adminIrSugFiltro = adminIrSugFiltro;

const PERM_GRUPOS = {
  'Votação': ['ver_votos','editar_opcoes','resetar_votos'],
  'Tier List': ['ver_tierlist','editar_tierlist','importar_steam'],
  'Admins': ['ver_admins','editar_admins'],
  'Banidos': ['ver_banidos','editar_banidos'],
  'Config': ['ver_config','editar_config','ver_logs'],
  'Comunidade': ['ver_sugestoes']
};
const CARGOS_ORDEM = ['dev','dono','administrador','moderador'];
let PERMS_DADOS = null;
let PERMS_LABELS = null;

let ADMIN_CONFIG_TAB = 'aviso';
let ADMIN_SUG_STATUS = 'all';
let ADMIN_SUG_TIPO = 'all';
let ADMIN_SHARED = {
  votos: null, tier: null, sugestoes: null, admins: null, banidos: null, logs: null, backup: null,
  fetchedAt: 0
};
let _sharedPromise = null;
const _KPI_LAST = {};

const ADMIN_NAV = [
  { id: 'home',      label: 'Home',      icon: '📊', perm: null,            accent: 'purple', badgeKey: null       },
  { id: 'votacao',   label: 'Votação',   icon: '🗳️', perm: 'ver_votos',     accent: 'purple', badgeKey: 'votacao'  },
  { id: 'tierlist',  label: 'Tier List', icon: '🎮', perm: 'ver_tierlist',  accent: 'amber',  badgeKey: 'tierlist' },
  { id: 'setup',     label: 'Setup',     icon: '🖥️', perm: 'ver_tierlist',  accent: 'cyan',   badgeKey: null       },
  { id: 'sugestoes', label: 'Sugestões', icon: '💡', perm: 'ver_sugestoes', accent: 'amber',  badgeKey: 'sugestoes'},
  { id: 'admins',    label: 'Admins',    icon: '👥', perm: 'ver_admins',    accent: 'blue',   badgeKey: 'admins'   },
  { id: 'banidos',   label: 'Banidos',   icon: '🚫', perm: 'ver_banidos',   accent: 'red',    badgeKey: 'banidos'  },
  { id: 'config',    label: 'Config',    icon: '⚙️', perm: 'ver_config',    accent: 'green',  badgeKey: null       },
  { id: 'logs',      label: 'Logs',      icon: '📋', perm: 'ver_logs',      accent: 'pink',   badgeKey: 'logs'     },
  { id: 'backup',    label: 'Backup',    icon: '💾', perm: 'editar_config', accent: 'cyan',   badgeKey: 'backup'   }
];
const VALID_ADMIN_PAGES = ADMIN_NAV.map(it => it.id);

function renderSidebar(){
  const nav = document.getElementById('adminSidebarNav');
  if(!nav) return;
  const items = ADMIN_NAV.filter(it => !it.perm || temPerm(it.perm));
  nav.innerHTML = items.map(it => {
    let badgeHTML = '';
    if(it.badgeKey){
      const v = ADMIN_SHARED[it.badgeKey];
      let count = null;
      if(it.badgeKey === 'votacao' && ADMIN_SHARED.votos){
        count = Object.values(ADMIN_SHARED.votos.contagem || {}).reduce((a,b)=>a+(Number(b)||0),0);
      } else if(it.badgeKey === 'tierlist' && ADMIN_SHARED.tier){
        count = (ADMIN_SHARED.tier.jogos||[]).length + (ADMIN_SHARED.tier.filmes||[]).length;
      } else if(it.badgeKey === 'sugestoes' && ADMIN_SHARED.sugestoes){
        count = (ADMIN_SHARED.sugestoes.itens||[]).length;
      } else if(it.badgeKey === 'admins' && ADMIN_SHARED.admins){
        count = (ADMIN_SHARED.admins.admins||[]).length;
      } else if(it.badgeKey === 'banidos' && ADMIN_SHARED.banidos){
        count = (ADMIN_SHARED.banidos.banidos||[]).length;
      } else if(it.badgeKey === 'logs' && ADMIN_SHARED.logs){
        count = (ADMIN_SHARED.logs.logs||[]).length;
      } else if(it.badgeKey === 'backup' && ADMIN_SHARED.backup){
        count = (ADMIN_SHARED.backup.backups||[]).length;
      }
      if(count !== null){
        badgeHTML = `<span class="anb-badge ${count === 0 ? 'zero' : ''}">${count}</span>`;
      }
    }
    return `
      <button class="admin-nav-btn ${ADMIN_PAGE === it.id ? 'on' : ''}"
              data-page="${it.id}" data-accent="${it.accent}" type="button">
        <span class="anb-ic">${it.icon}</span>
        <span class="anb-lbl">${it.label}</span>
        ${badgeHTML}
      </button>
    `;
  }).join('');

  const foot = document.getElementById('adminSidebarFoot');
  if(foot){
    if(USUARIO){
      foot.innerHTML = `
        <div class="admin-sidebar-user">
          ${USUARIO.avatar ? `<img src="${esc(USUARIO.avatar)}" alt="">` : '<div class="asu-ph">👤</div>'}
          <div class="asu-tx">
            <b>@${esc(USUARIO.username || 'admin')}</b>
            <small>${LABEL_CARGO[USUARIO.cargo] || USUARIO.cargo || ''}</small>
          </div>
        </div>`;
    } else foot.innerHTML = '';
  }
}

function bindSidebarOnce(){
  const side = document.getElementById('adminSidebar');
  if(!side || side.dataset.bound) return;
  side.dataset.bound = '1';
  side.addEventListener('click', e => {
    const b = e.target.closest('.admin-nav-btn');
    if(!b) return;
    adminIrPara(b.dataset.page);
  });
}

function adminVoltarHTML(titulo, extraRight = ''){
  return `<div class="admin-crumbs">
    <button type="button" onclick="adminIrPara('home')">⚙️ Admin</button>
    <span class="crumb-sep">›</span>
    <span class="crumb-current">${titulo}</span>
    ${extraRight ? `<span style="margin-left:auto;display:inline-flex;gap:8px;align-items:center">${extraRight}</span>` : ''}
  </div>`;
}

async function carregarShared(force = false){
  if(!force && Date.now() - ADMIN_SHARED.fetchedAt < 30000) return ADMIN_SHARED;
  if(!force && _sharedPromise) return _sharedPromise;

  _sharedPromise = (async () => {
    const safeFetch = (url) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
    const [votos, tier, sugestoes, admins, banidos, logs, backup] = await Promise.all([
      temPerm('ver_votos')      ? safeFetch('/api/admin?action=votos')          : null,
      temPerm('ver_tierlist')   ? safeFetch('/api/admin?action=tierlist-get')   : null,
      temPerm('ver_sugestoes')  ? safeFetch('/api/admin?action=sugestoes-ver')  : null,
      temPerm('ver_admins')     ? safeFetch('/api/admin?action=admins-ver')     : null,
      temPerm('ver_banidos')    ? safeFetch('/api/admin?action=banidos-ver')    : null,
      temPerm('ver_logs')       ? safeFetch('/api/admin?action=logs-ver')       : null,
      temPerm('editar_config')  ? safeFetch('/api/backup?action=list')          : null
    ]);
    ADMIN_SHARED = { votos, tier, sugestoes, admins, banidos, logs, backup, fetchedAt: Date.now() };
    _sharedPromise = null;
    return ADMIN_SHARED;
  })();
  return _sharedPromise;
}

function kpiChanged(key, valor){
  const prev = _KPI_LAST[key];
  _KPI_LAST[key] = valor;
  return prev !== undefined && prev !== valor;
}

let _carregarAdminToken = 0;

async function carregarAdmin(){
  const area = document.getElementById('adminArea');
  if(!area) return;

  if(USUARIO === null){
    area.innerHTML = `<p class="admin-vazio">Verificando login…</p>`;
    await checarLogin();
  }

  if(!USUARIO || !USUARIO.admin){
    const shell = document.querySelector('.admin-shell');
    if(shell) shell.classList.add('admin-shell--locked');
    renderSidebar();
    area.innerHTML = `<div class="admin-vazio">
      <b>🔒 Acesso restrito</b>
      Só administradores do site podem ver esta área.
      ${!USUARIO ? '<br><a href="/api/auth?action=login">Entrar com Discord</a>' : ''}
    </div>`;
    return;
  }

  const shell = document.querySelector('.admin-shell');
  if(shell) shell.classList.remove('admin-shell--locked');

  // 🔧 FIX: só lê do localStorage no primeiro carregamento da sessão
  if(!window.__adminBootDone){
    const saved = localStorage.getItem('admin:page');
    if(saved && VALID_ADMIN_PAGES.includes(saved)) ADMIN_PAGE = saved;
    else ADMIN_PAGE = 'home';
    window.__adminBootDone = true;
  }
  if(!VALID_ADMIN_PAGES.includes(ADMIN_PAGE)) ADMIN_PAGE = 'home';

  ADMIN_TIER_TAB = localStorage.getItem('admin:tierTab') || 'jogos';

  bindSidebarOnce();
  renderSidebar();
  carregarShared().then(() => {
    renderSidebar();
  }).catch(() => {});

  const token = ++_carregarAdminToken;

  if(ADMIN_PAGE === 'home') await renderAdminHome();
  else if(ADMIN_PAGE === 'votacao') await carregarAdminVotacao();
  else if(ADMIN_PAGE === 'tierlist') await carregarAdminTierList();
  else if(ADMIN_PAGE === 'setup') await renderAdminSetup();
  else if(ADMIN_PAGE === 'sugestoes') await carregarAdminSugestoes();
  else if(ADMIN_PAGE === 'admins') await renderAdminAdmins();
  else if(ADMIN_PAGE === 'banidos') await renderAdminBanidos();
  else if(ADMIN_PAGE === 'config') await renderAdminConfig();
  else if(ADMIN_PAGE === 'logs') await renderAdminLogs();
  else if(ADMIN_PAGE === 'backup') await renderAdminBackup();

  if(token !== _carregarAdminToken) return;
}
window.carregarAdmin = carregarAdmin;

function cardAdminV2({ icon, title, desc, page, accent = 'purple', actions = [] }){
  const actionsHTML = actions.map(a =>
    `<button type="button" class="amc-action" data-fn="${esc(a.fn)}">${a.label}</button>`
  ).join('');
  return `
    <button type="button" class="admin-menu-card2" data-accent="${accent}" data-page="${page}">
      <span class="amc-bar"></span>
      <span class="amc-ic-badge"><span class="amc-ic">${icon}</span></span>
      <h3>${title}</h3>
      <p>${desc}</p>
      <div class="amc-actions">
        <span class="amc-open">Abrir →</span>
        ${actionsHTML}
      </div>
    </button>
  `;
}