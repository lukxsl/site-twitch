/* ============================================================
   PAINEL ADMIN — depende de app.js (mesmo escopo global)
   ============================================================ */

/* ---------- NAVEGAÇÃO ---------- */
function adminIrPara(pagina){
  if(pagina === 'votacao'){
    ADMIN_TAB = 'votos';
  }
  ADMIN_PAGE = pagina;
  localStorage.setItem('admin:page', pagina);
  carregarAdmin();
}
function adminIrAba(aba){
  ADMIN_TAB = aba;
  renderAdminVotacao();
}
function adminIrTierTab(tab){
  ADMIN_TIER_TAB = tab;
  localStorage.setItem('admin:tierTab', tab);
  renderAdminTierList();
}
function adminIrConfigTab(tab){
  ADMIN_CONFIG_TAB = tab;
  renderAdminConfig();
}
window.adminIrPara = adminIrPara;
window.adminIrAba = adminIrAba;
window.adminIrTierTab = adminIrTierTab;
window.adminIrConfigTab = adminIrConfigTab;

/* ============================================================
   PERMISSÕES — constantes
   ============================================================ */
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

/* ============================================================
   ESTADO LOCAL DO ADMIN
   ============================================================ */
let ADMIN_CONFIG_TAB = 'aviso';
let ADMIN_SHARED = {
  votos: null,
  tier: null,
  admins: null,
  banidos: null,
  logs: null,
  backup: null,
  fetchedAt: 0
};
let _sharedPromise = null;
const _KPI_LAST = {};

/* ============================================================
   NAVEGAÇÃO LATERAL — estrutura
   ============================================================ */
const ADMIN_NAV = [
  { id: 'home',     label: 'Home',      icon: '📊', perm: null,            accent: 'purple', badgeKey: null       },
  { id: 'votacao',  label: 'Votação',   icon: '🗳️', perm: 'ver_votos',     accent: 'purple', badgeKey: 'votacao'  },
  { id: 'tierlist', label: 'Tier List', icon: '🎮', perm: 'ver_tierlist',  accent: 'amber',  badgeKey: 'tierlist' },
  { id: 'admins',   label: 'Admins',    icon: '👥', perm: 'ver_admins',    accent: 'blue',   badgeKey: 'admins'   },
  { id: 'banidos',  label: 'Banidos',   icon: '🚫', perm: 'ver_banidos',   accent: 'red',    badgeKey: 'banidos'  },
  { id: 'config',   label: 'Config',    icon: '⚙️', perm: 'ver_config',    accent: 'green',  badgeKey: null       },
  { id: 'logs',     label: 'Logs',      icon: '📋', perm: 'ver_logs',      accent: 'pink',   badgeKey: 'logs'     },
  { id: 'backup',   label: 'Backup',    icon: '💾', perm: 'editar_config', accent: 'cyan',   badgeKey: 'backup'   }
];

const VALID_ADMIN_PAGES = ADMIN_NAV.map(it => it.id);

/* ============================================================
   SIDEBAR
   ============================================================ */
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
    } else {
      foot.innerHTML = '';
    }
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

/* ============================================================
   BREADCRUMBS
   ============================================================ */
function adminVoltarHTML(titulo, extraRight = ''){
  return `<div class="admin-crumbs">
    <button type="button" onclick="adminIrPara('home')">⚙️ Admin</button>
    <span class="crumb-sep">›</span>
    <span class="crumb-current">${titulo}</span>
    ${extraRight ? `<span style="margin-left:auto;display:inline-flex;gap:8px;align-items:center">${extraRight}</span>` : ''}
  </div>`;
}

/* ============================================================
   CARREGAR DADOS COMPARTILHADOS (para badges e KPIs)
   ============================================================ */
async function carregarShared(force = false){
  if(!force && Date.now() - ADMIN_SHARED.fetchedAt < 30000){
    return ADMIN_SHARED;
  }
  if(!force && _sharedPromise) return _sharedPromise;

  _sharedPromise = (async () => {
    const safeFetch = (url) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);

    const [votos, tier, admins, banidos, logs, backup] = await Promise.all([
      temPerm('ver_votos')     ? safeFetch('/api/admin?action=votos')        : null,
      temPerm('ver_tierlist')  ? safeFetch('/api/admin?action=tierlist-get') : null,
      temPerm('ver_admins')    ? safeFetch('/api/admin?action=admins-ver')   : null,
      temPerm('ver_banidos')   ? safeFetch('/api/admin?action=banidos-ver')  : null,
      temPerm('ver_logs')      ? safeFetch('/api/admin?action=logs-ver')     : null,
      temPerm('editar_config') ? safeFetch('/api/backup?action=list')        : null
    ]);

    ADMIN_SHARED = { votos, tier, admins, banidos, logs, backup, fetchedAt: Date.now() };
    _sharedPromise = null;
    return ADMIN_SHARED;
  })();

  return _sharedPromise;
}

/* ============================================================
   KPI PULSE
   ============================================================ */
function kpiChanged(key, valor){
  const prev = _KPI_LAST[key];
  _KPI_LAST[key] = valor;
  return prev !== undefined && prev !== valor;
}

/* ============================================================
   CARREGAR ADMIN (roteador)
   ============================================================ */
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

  ADMIN_PAGE = localStorage.getItem('admin:page') || 'home';
  if(!VALID_ADMIN_PAGES.includes(ADMIN_PAGE)) ADMIN_PAGE = 'home';
  ADMIN_TIER_TAB = localStorage.getItem('admin:tierTab') || 'jogos';

  bindSidebarOnce();
  renderSidebar();

  // Carrega badges em background
  carregarShared().then(() => renderSidebar()).catch(() => {});

  if(ADMIN_PAGE === 'home') await renderAdminHome();
  else if(ADMIN_PAGE === 'votacao') await carregarAdminVotacao();
  else if(ADMIN_PAGE === 'tierlist') await carregarAdminTierList();
  else if(ADMIN_PAGE === 'admins') await renderAdminAdmins();
  else if(ADMIN_PAGE === 'banidos') await renderAdminBanidos();
  else if(ADMIN_PAGE === 'config') await renderAdminConfig();
  else if(ADMIN_PAGE === 'logs') await renderAdminLogs();
  else if(ADMIN_PAGE === 'backup') await renderAdminBackup();
}
window.carregarAdmin = carregarAdmin;

/* ============================================================
   CARD V2 (hover rich)
   ============================================================ */
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

/* ============================================================
   HOME DO ADMIN
   ============================================================ */
async function renderAdminHome(){
  const area = document.getElementById('adminArea');
  if(!area) return;

  const visitanteBtn = `<button type="button" class="btn-mini" onclick="verComoVisitante()" title="Abrir home numa nova aba">👁️ Ver como visitante</button>`;
  const crumbs = adminVoltarHTML('⚙️ Painel', visitanteBtn);
  area.innerHTML = crumbs + `<p class="admin-vazio">Carregando painel…</p>`;

  const shared = await carregarShared(true);

  const podeVotos = temPerm('ver_votos');
  const podeTier = temPerm('ver_tierlist');
  const podeAdmins = temPerm('ver_admins');
  const podeBanidos = temPerm('ver_banidos');

  // KPIs
  const kpis = [];
  if(podeVotos && shared.votos){
    const total = Object.values(shared.votos.contagem || {}).reduce((a,b) => a + (Number(b)||0), 0);
    const pulse = kpiChanged('votos', total);
    kpis.push({ icon:'🗳️', value: total, label:'votos', sub:'total da votação', href:'votacao', accent:'purple', pulse });
  }
  if(podeTier && shared.tier){
    const jg = (shared.tier.jogos || []).length;
    const fl = (shared.tier.filmes || []).length;
    const total = jg + fl;
    const pulse = kpiChanged('tier', total);
    kpis.push({ icon:'🎮', value: total, label:'itens', sub: `${jg} jogos · ${fl} filmes`, href:'tierlist', accent:'amber', pulse });
  }
  if(podeAdmins && shared.admins){
    const n = (shared.admins.admins || []).length;
    const pulse = kpiChanged('admins', n);
    kpis.push({ icon:'👥', value: n, label:'admins', sub:'com acesso ao painel', href:'admins', accent:'blue', pulse });
  }
  if(podeBanidos && shared.banidos){
    const n = (shared.banidos.banidos || []).length;
    const pulse = kpiChanged('banidos', n);
    kpis.push({ icon:'🚫', value: n, label:'banidos', sub: n === 0 ? 'ninguém banido' : 'não pode votar', href:'banidos', accent:'red', pulse });
  }

  const kpiHTML = kpis.length ? `
    <div class="admin-kpis">
      ${kpis.map(k => `
        <button type="button" class="admin-kpi ${k.pulse ? 'pulse' : ''}" data-accent="${k.accent}" data-page="${k.href}">
          <span class="akpi-ic">${k.icon}</span>
          <b class="akpi-val">${k.value}</b>
          <span class="akpi-lbl">${k.label}</span>
          <small class="akpi-sub">${esc(k.sub)}</small>
        </button>
      `).join('')}
    </div>` : '';

  // Alerta de manutenção
  const manutencaoOn = CONFIG_GERAL.manutencao;
  const podeEditarConfig = temPerm('editar_config');
  const alertHTML = manutencaoOn ? `
    <div class="admin-alert admin-alert-danger">
      <span class="aa-ic">⚠️</span>
      <div class="aa-tx">
        <b>Modo manutenção está LIGADO</b>
        <span>Quem não é admin vê uma tela de "Estamos em manutenção".</span>
      </div>
      ${podeEditarConfig ? `<button type="button" class="aa-btn" onclick="desligarManutencao()">🔓 Desligar agora</button>` : ''}
    </div>` : '';

  // ---- Operação ----
  const cardsOperacao = [];
  if(temPerm('ver_votos')){
    const actions = temPerm('resetar_votos') ? [{ label:'🗑️ Resetar', fn:'resetarVotacao()' }] : [];
    cardsOperacao.push(cardAdminV2({
      icon:'🗳️', title:'Votação',
      desc: `Ver quem votou${temPerm('editar_opcoes') ? ', editar opções' : ''}${temPerm('resetar_votos') ? ' e resetar.' : '.'}`,
      page:'votacao', accent:'purple', actions
    }));
  }
  if(temPerm('ver_tierlist')){
    const actions = temPerm('editar_tierlist') ? [{ label:'+ Item', fn:"adminIrPara('tierlist')" }] : [];
    cardsOperacao.push(cardAdminV2({
      icon:'🎮', title:'Tier List',
      desc: temPerm('editar_tierlist') ? 'Adicionar, editar, remover e importar.' : 'Ver os itens da tier list.',
      page:'tierlist', accent:'amber', actions
    }));
  }
  if(temPerm('ver_admins')){
    const actions = temPerm('editar_admins') ? [{ label:'+ Admin', fn:"adminIrPara('admins')" }] : [];
    cardsOperacao.push(cardAdminV2({
      icon:'👥', title:'Admins',
      desc: temPerm('editar_admins') ? 'Gerenciar quem tem acesso ao painel.' : 'Ver quem tem acesso ao painel.',
      page:'admins', accent:'blue', actions
    }));
  }
  if(temPerm('ver_banidos')){
    const actions = temPerm('editar_banidos') ? [{ label:'+ Banir', fn:"adminIrPara('banidos')" }] : [];
    cardsOperacao.push(cardAdminV2({
      icon:'🚫', title:'Banidos',
      desc: temPerm('editar_banidos') ? 'Gerenciar quem não pode votar.' : 'Ver quem não pode votar.',
      page:'banidos', accent:'red', actions
    }));
  }

  // ---- Sistema ----
  const cardsSistema = [];
  if(temPerm('ver_config')){
    cardsSistema.push(cardAdminV2({
      icon:'⚙️', title:'Config geral',
      desc:'Aviso, aparência, manutenção e horas.',
      page:'config', accent:'green'
    }));
  }
  if(temPerm('ver_logs')){
    cardsSistema.push(cardAdminV2({
      icon:'📋', title:'Logs',
      desc:'Histórico de ações do painel.',
      page:'logs', accent:'pink'
    }));
  }
  if(temPerm('editar_config')){
    cardsSistema.push(cardAdminV2({
      icon:'💾', title:'Backup',
      desc:'Criar, baixar e restaurar backups.',
      page:'backup', accent:'cyan',
      actions: [{ label:'+ Criar agora', fn:'criarBackupManual()' }]
    }));
  }

  const secaoHTML = (titulo, cards) => cards.length ? `
    <div class="admin-section">
      <div class="admin-section-head">
        <span class="admin-section-kicker">${titulo}</span>
        <span class="admin-section-count">${cards.length}</span>
      </div>
      <div class="admin-section-grid">
        ${cards.join('')}
      </div>
    </div>` : '';

  area.innerHTML = crumbs + alertHTML + kpiHTML +
    secaoHTML('Operação', cardsOperacao) +
    secaoHTML('Sistema', cardsSistema);

  // Delegação: KPIs
  area.querySelectorAll('.admin-kpi').forEach(k => {
    k.addEventListener('click', () => adminIrPara(k.dataset.page));
  });

  // Delegação: cards + ações rápidas
  const grids = area.querySelectorAll('.admin-section-grid');
  grids.forEach(grid => {
    if(grid.dataset.bound) return;
    grid.dataset.bound = '1';
    grid.addEventListener('click', e => {
      const actionBtn = e.target.closest('.amc-action');
      if(actionBtn){
        e.stopPropagation();
        const fn = actionBtn.dataset.fn;
        if(fn){ try { (0, eval)(fn); } catch(err){ console.error(err); } }
        return;
      }
      const card = e.target.closest('.admin-menu-card2');
      if(card){ adminIrPara(card.dataset.page); }
    });
  });
}
window.renderAdminHome = renderAdminHome;

/* ============================================================
   ALERTA — desligar manutenção
   ============================================================ */
async function desligarManutencao(){
  const ok = await confirmar('Desligar manutenção?', 'O site volta ao normal pra todos os visitantes.', '🔓');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=config-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manutencao: false })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    CONFIG_GERAL.manutencao = false;
    if(typeof aplicarManutencao === 'function') aplicarManutencao();
    toast('Manutenção desligada ✅', 'ok');
    renderAdminHome();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.desligarManutencao = desligarManutencao;

/* ============================================================
   VER COMO VISITANTE
   ============================================================ */
function verComoVisitante(){
  const url = window.location.origin + '/?preview=1';
  const w = window.open(url, '_blank', 'noopener');
  if(!w){
    toast('Permita popups pra abrir o preview', 'warn');
    return;
  }
  toast('Home aberta em nova aba 💜', 'ok');
}
window.verComoVisitante = verComoVisitante;

/* ============================================================
   VOTAÇÃO ADMIN
   ============================================================ */
async function carregarAdminVotacao(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('🗳️ Votação') + `<p class="admin-vazio">Carregando dados…</p>`;
  try{
    const r = await fetch('/api/admin?action=votos');
    if(!r.ok) throw new Error('Falha ao carregar (' + r.status + ')');
    ADMIN_DADOS = await r.json();
  }catch(e){
    area.innerHTML = adminVoltarHTML('🗳️ Votação') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
    return;
  }
  // Sempre começa em "Votos"
  ADMIN_TAB = 'votos';
  renderAdminVotacao();
}
window.carregarAdminVotacao = carregarAdminVotacao;

function renderAdminVotacao(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  if(!ADMIN_DADOS){
    area.innerHTML = adminVoltarHTML('🗳️ Votação') + `<div class="admin-vazio">Sem dados</div>`;
    return;
  }
  const { usuarios = [], contagem = {}, config } = ADMIN_DADOS;
  const totalVotos = Object.values(contagem).reduce((a,b)=>a+b,0);
  const mapaOpcao = {};
  (config || []).forEach(o => { mapaOpcao[o.id] = o; });
  const podeEditar = temPerm('editar_opcoes');
  const podeResetar = temPerm('resetar_votos');
  area.innerHTML = adminVoltarHTML('🗳️ Votação') + `
    <div class="votacao-tabs">
      <button class="${ADMIN_TAB === 'votos' ? 'on' : ''}" onclick="adminIrAba('votos')">Votos (${totalVotos})</button>
      ${podeEditar ? `<button class="${ADMIN_TAB === 'opcoes' ? 'on' : ''}" onclick="adminIrAba('opcoes')">Opções</button>` : ''}
    </div>
    <div id="adminConteudo"></div>
  `;
  if(ADMIN_TAB === 'votos') renderAdminVotos(usuarios, mapaOpcao, contagem, podeResetar);
  else if(podeEditar) renderAdminOpcoes(config || [], contagem);
}

function renderAdminVotos(usuarios, mapaOpcao, contagem, podeResetar){
  const el = document.getElementById('adminConteudo');
  if(!el) return;

  if(!usuarios.length){
    el.innerHTML = `
      <div class="admin-card">
        <h3>🗳️ Votos</h3>
        <div class="logs-empty">
          <b>Ninguém votou ainda</b>
          A votação tá aberta, mas ninguém escolheu nada por enquanto.
        </div>
        <div class="admin-actions">
          <button class="admin-btn ghost" onclick="carregarAdminVotacao()">🔄 Atualizar</button>
        </div>
      </div>`;
    return;
  }

  // Agrupa por opção
  const porOpcao = {};
  usuarios.forEach(u => {
    const op = u.opcao || '__sem__';
    if(!porOpcao[op]) porOpcao[op] = [];
    porOpcao[op].push(u);
  });

  // Ordena opções por quantidade
  const opcoesOrdenadas = Object.keys(porOpcao).sort((a,b) => porOpcao[b].length - porOpcao[a].length);

  el.innerHTML = `
    <div class="admin-card">
      <h3>🗳️ Votos <span class="cont">Total: ${usuarios.length}</span></h3>
      <div>
        ${opcoesOrdenadas.map(opId => {
          const op = mapaOpcao[opId];
          const nomeOpcao = op ? op.nome : opId;
          const votos = porOpcao[opId];
          return `
            <div class="votos-group">
              <div class="votos-group-head" onclick="this.parentElement.classList.toggle('open')">
                <span class="vgh-arrow">▶</span>
                <span class="vgh-titulo">${esc(nomeOpcao)}</span>
                <span class="vgh-count">${votos.length} voto${votos.length === 1 ? '' : 's'}</span>
              </div>
              <div class="votos-group-body">
                ${votos.map(u => {
                  const temDados = u.username;
                  return `
                    <div class="admin-voto">
                      ${temDados && u.avatar
                        ? `<img class="admin-voto-avatar" src="${esc(u.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'admin-voto-ph',textContent:'👤'}))">`
                        : '<div class="admin-voto-ph">👤</div>'}
                      <div class="admin-voto-info">
                        <b>${temDados ? '@' + esc(u.username) : 'Sem nick'}</b>
                        <small>${esc(u.userId)}</small>
                      </div>
                      <div class="admin-voto-opcao">
                        <small>${u.ts ? tempoAtras(new Date(u.ts).toISOString()) : 'voto antigo'}</small>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="admin-actions">
        <button class="admin-btn ghost" onclick="carregarAdminVotacao()">🔄 Atualizar</button>
        ${podeResetar ? `<button class="admin-btn perigo" onclick="resetarVotacao()">🗑️ Resetar votação</button>` : ''}
      </div>
    </div>`;
}

function renderAdminOpcoes(opcoes, contagem){
  const el = document.getElementById('adminConteudo');
  if(!el) return;
  const lista = opcoes.length ? opcoes : [];
  const total = Object.values(contagem).reduce((a,b)=>a+b,0);
  const maxVotos = Math.max(1, ...Object.values(contagem).map(Number));

  el.innerHTML = `
    <div class="admin-card">
      <h3>🎯 Opções da votação</h3>
      <div>
        ${lista.map((o,i) => {
          const votos = contagem[o.id] || 0;
          const pct = total ? Math.round(votos / total * 100) : 0;
          const barW = votos > 0 ? Math.round(votos / maxVotos * 100) : 0;
          const lider = votos > 0 && votos === maxVotos;
          return `
            <div class="opcao-row">
              ${o.capa ? `<img src="${esc(o.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph4',textContent:'🎮'}))">` : '<div class="ph4">🎮</div>'}
              <div class="opcao-info">
                <div class="opcao-top">
                  <b>${esc(o.nome)}</b>
                  <span class="votos">${votos} voto${votos === 1 ? '' : 's'} · ${pct}%</span>
                </div>
                <div class="opcao-bar"><i style="width:${barW}%"></i></div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <small style="color:var(--mute);font-size:.7rem">${o.tipo === 'filme' ? '🎬 Filme' : '🎮 Jogo'}</small>
                  ${lider ? '<span class="opcao-leader">👑 Líder</span>' : ''}
                </div>
              </div>
              <button class="btn-mini" onclick="editarOpcao(${i})">Editar</button>
            </div>
          `;
        }).join('') || '<div class="logs-empty"><b>Nenhuma opção ainda</b>Adiciona a primeira pra começar a votação.</div>'}
      </div>
      <div class="admin-actions">
        <button class="admin-btn" onclick="adicionarOpcao()">+ Adicionar opção</button>
        <button class="admin-btn ghost" onclick="restaurarPadraoVotacao()">Restaurar padrão</button>
      </div>
    </div>`;
}

async function resetarVotacao(){
  const ok = await confirmar('Resetar votação?', 'TODOS os votos serão apagados e a votação começa do zero.', '🗑️');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=reset', { method:'POST' });
    if(!r.ok) throw new Error('Falha ao resetar');
    toast('Votação resetada! ✅', 'ok');
    await carregarAdminVotacao();
    await carregarVotosApi();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.resetarVotacao = resetarVotacao;

function editarOpcao(i){
  const opcoes = (ADMIN_DADOS.config || []).slice();
  while(opcoes.length < 3) opcoes.push({ id:'', nome:'', tipo:'jogo', capa:null });
  const o = opcoes[i] || { nome:'', tipo:'jogo' };
  document.getElementById('dTitle').textContent = 'Editar opção ' + (i+1);
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div>
        <label>Nome do jogo/filme</label>
        <div class="busca-row">
          <input id="editNome" type="text" value="${esc(o.nome || '')}" placeholder="Ex: Elden Ring">
          <button type="button" onclick="buscarCapaOpcao()">🔍 Buscar capa</button>
        </div>
        <div id="buscaOpcaoStatus" style="font-size:.72rem;color:var(--mute);margin-top:6px"></div>
      </div>
      <div>
        <label>Tipo</label>
        <select id="editTipo">
          <option value="jogo" ${o.tipo === 'jogo' ? 'selected' : ''}>🎮 Jogo</option>
          <option value="filme" ${o.tipo === 'filme' ? 'selected' : ''}>🎬 Filme</option>
        </select>
      </div>
      <div>
        <label>URL da capa (opcional)</label>
        <input id="editCapa" type="text" value="${esc(o.capa || '')}" placeholder="https://...">
        <div style="margin-top:8px">
          <img class="mini-capa" id="editCapaPreview" src="${esc(o.capa || '')}" style="${o.capa ? '' : 'display:none'}" onerror="this.style.display='none'">
        </div>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn ghost" onclick="removerOpcao(${i})">Remover</button>
        <button class="admin-btn" onclick="salvarOpcao(${i})">Salvar</button>
      </div>
    </div>`;
  document.getElementById('dlg').showModal();
}
window.editarOpcao = editarOpcao;

function adicionarOpcao(){
  const opcoes = (ADMIN_DADOS.config || []).slice();
  opcoes.push({ id:'', nome:'', tipo:'jogo', capa:null });
  const i = opcoes.length - 1;
  document.getElementById('dTitle').textContent = 'Nova opção';
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div>
        <label>Nome do jogo/filme</label>
        <div class="busca-row">
          <input id="editNome" type="text" placeholder="Ex: Elden Ring">
          <button type="button" onclick="buscarCapaOpcao()">🔍 Buscar capa</button>
        </div>
        <div id="buscaOpcaoStatus" style="font-size:.72rem;color:var(--mute);margin-top:6px"></div>
      </div>
      <div>
        <label>Tipo</label>
        <select id="editTipo">
          <option value="jogo" selected>🎮 Jogo</option>
          <option value="filme">🎬 Filme</option>
        </select>
      </div>
      <div>
        <label>URL da capa (opcional)</label>
        <input id="editCapa" type="text" placeholder="https://...">
        <div style="margin-top:8px">
          <img class="mini-capa" id="editCapaPreview" style="display:none">
        </div>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn" onclick="salvarOpcao(${i}, true)">Adicionar</button>
      </div>
    </div>`;
  document.getElementById('dlg').showModal();
}
window.adicionarOpcao = adicionarOpcao;

async function buscarCapaOpcao(){
  const nome = document.getElementById('editNome').value.trim();
  if(!nome) return;
  const tipo = document.getElementById('editTipo').value;
  const status = document.getElementById('buscaOpcaoStatus');
  status.textContent = '🔎 Buscando…';
  try{
    const action = tipo === 'filme' ? 'buscar-filme' : 'buscar-jogo';
    const r = await fetch(`/api/admin?action=${action}&nome=${encodeURIComponent(nome)}`);
    const d = await r.json();
    if(d.erro){ status.textContent = '⚠️ ' + d.erro; return; }
    if(d.capa){
      document.getElementById('editCapa').value = d.capa;
      const p = document.getElementById('editCapaPreview');
      p.src = d.capa; p.style.display = 'block';
    }
    status.textContent = '✅ Capa encontrada!';
    setTimeout(() => { status.textContent = ''; }, 3000);
  }catch(e){ status.textContent = '⚠️ Erro na busca'; }
}
window.buscarCapaOpcao = buscarCapaOpcao;

async function salvarOpcao(i, ehNovo){
  const nome = document.getElementById('editNome').value.trim();
  const tipo = document.getElementById('editTipo').value;
  const capa = document.getElementById('editCapa').value.trim();
  if(!nome){ toast('Digite um nome!', 'warn'); return; }
  const opcoes = (ADMIN_DADOS.config || []).slice();
  while(opcoes.length <= i) opcoes.push({});
  const id = opcoes[i].id || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40);
  opcoes[i] = { id, nome, tipo, capa: capa || null };
  await salvarOpcoesVotacao(opcoes);
}
window.salvarOpcao = salvarOpcao;

async function removerOpcao(i){
  const ok = await confirmar('Remover opção?', 'Essa opção sai da votação.', '🗑️');
  if(!ok) return;
  const opcoes = (ADMIN_DADOS.config || []).slice();
  opcoes.splice(i, 1);
  await salvarOpcoesVotacao(opcoes);
}
window.removerOpcao = removerOpcao;

async function salvarOpcoesVotacao(opcoes){
  try{
    const r = await fetch('/api/admin?action=opcoes', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ opcoes })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    document.getElementById('dlg').close();
    toast('Salvo! ✅', 'ok');
    await carregarAdminVotacao();
    await carregarVotosApi();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}

async function restaurarPadraoVotacao(){
  const ok = await confirmar('Restaurar padrão?', 'As opções voltam pro padrão de fábrica.', '♻️');
  if(!ok) return;
  await salvarOpcoesVotacao([
    { id:'hollow-knight', nome:'Hollow Knight', tipo:'jogo', capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg' },
    { id:'phasmophobia', nome:'Phasmophobia', tipo:'jogo', capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/739630/library_600x900.jpg' },
    { id:'stardew-valley', nome:'Stardew Valley', tipo:'jogo', capa:'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg' }
  ]);
}
window.restaurarPadraoVotacao = restaurarPadraoVotacao;

/* ============================================================
   TIER LIST ADMIN
   ============================================================ */
async function carregarAdminTierList(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('🎮 Tier List') + `<p class="admin-vazio">Carregando…</p>`;
  try{
    const r = await fetch('/api/admin?action=tierlist-get');
    if(!r.ok) throw new Error('Falha ao carregar (' + r.status + ')');
    const d = await r.json();
    ADMIN_TIER = { jogos: d.jogos || [], filmes: d.filmes || [] };
  }catch(e){
    area.innerHTML = adminVoltarHTML('🎮 Tier List') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
    return;
  }
  ADMIN_TIER_TAB = localStorage.getItem('admin:tierTab') || 'jogos';
  ADMIN_MULTISEL = { ativo: false, ids: new Set() };
  document.body.classList.remove('admin-multisel');
  renderAdminTierList();
}
window.carregarAdminTierList = carregarAdminTierList;

function renderAdminTierList(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  const lista = ADMIN_TIER[ADMIN_TIER_TAB] || [];
  const podeEditar = temPerm('editar_tierlist');
  const podeImportar = temPerm('importar_steam');
  const botaoImport = (ADMIN_TIER_TAB === 'jogos' && podeImportar)
    ? `<button class="admin-btn" onclick="importarSteam()" id="btnImportarSteam">📥 Importar da Steam</button>`
    : '';
  const todosSel = lista.length > 0 && ADMIN_MULTISEL.ids.size === lista.length;
  const barraSel = ADMIN_MULTISEL.ativo ? `
    <div class="admin-bar">
      <b>☑️ ${ADMIN_MULTISEL.ids.size} de ${lista.length} selecionado${ADMIN_MULTISEL.ids.size === 1 ? '' : 's'}</b>
      <div class="admin-actions" style="margin:0">
        <button class="admin-btn ghost" onclick="toggleSelTodos()">${todosSel ? '☐ Desmarcar tudo' : '☑️ Selecionar tudo'}</button>
        <button class="admin-btn perigo" onclick="apagarSelecionados()" ${ADMIN_MULTISEL.ids.size ? '' : 'disabled'}>🗑️ Apagar selecionados</button>
        <button class="admin-btn ghost" onclick="cancelarMultiSel()">Cancelar</button>
      </div>
    </div>` : '';

  const itemHTML = (it, i) => {
    if(ADMIN_MULTISEL.ativo){
      const sel = ADMIN_MULTISEL.ids.has(it.id);
      return `
        <div class="admin-item-select ${sel ? 'sel' : ''}" onclick="toggleSelItem('${esc(it.id)}')">
          <span class="cb"></span>
          ${it.capa ? `<img src="${esc(it.capa)}" alt="" style="width:44px;height:58px;border-radius:6px;object-fit:cover;flex:none;background:#1d1433;border:1px solid var(--line)" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph3',textContent:'🎮'}))">` : '<div class="ph3" style="width:44px;height:58px;display:grid;place-items:center;background:#1d1433;border:1px solid var(--line);border-radius:6px">🎮</div>'}
          <div class="admin-item-info" style="flex:1;min-width:0">
            <b style="color:var(--white);font-size:.9rem">${esc(it.nome)}</b>
            <small style="color:var(--mute);font-size:.68rem">Tier ${esc(it.tier || '—')} · ${esc(it.status || '')}${it.nota ? ' · ⭐ ' + n1(it.nota) : ''}</small>
          </div>
        </div>`;
    }
    return `
      <div class="admin-item">
        ${it.capa ? `<img src="${esc(it.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph3',textContent:'🎮'}))">` : '<div class="ph3">🎮</div>'}
        <div class="admin-item-info">
          <b>${esc(it.nome)}</b>
          <small>Tier ${esc(it.tier || '—')} · ${esc(it.status || '')}${it.nota ? ' · ⭐ ' + n1(it.nota) : ''}</small>
        </div>
        ${podeEditar ? `<button class="btn-mini" onclick="editarItemTier(${i})">Editar</button>` : ''}
        ${podeEditar ? `<button class="btn-mini danger" onclick="removerItemTier(${i})">Remover</button>` : ''}
      </div>`;
  };

  area.innerHTML = adminVoltarHTML('🎮 Tier List') + `
    <div class="admin-tabs">
      <button class="${ADMIN_TIER_TAB === 'jogos' ? 'on' : ''}" onclick="adminIrTierTab('jogos')">🎮 Jogos (${ADMIN_TIER.jogos.length})</button>
      <button class="${ADMIN_TIER_TAB === 'filmes' ? 'on' : ''}" onclick="adminIrTierTab('filmes')">🎬 Filmes (${ADMIN_TIER.filmes.length})</button>
    </div>
    ${barraSel}
    <div class="admin-card">
      <h3>${ADMIN_TIER_TAB === 'jogos' ? '🎮 Jogos' : '🎬 Filmes'} <span class="cont">${lista.length} itens</span></h3>
      <div>
        ${lista.length ? lista.map(itemHTML).join('') : '<p class="admin-vazio" style="padding:20px">Nenhum item ainda</p>'}
      </div>
      <div class="admin-actions">
        ${podeEditar && !ADMIN_MULTISEL.ativo && lista.length ? `<button class="admin-btn ghost" onclick="ativarMultiSel()">☑️ Selecionar vários</button>` : ''}
        ${podeEditar ? `<button class="admin-btn" onclick="adicionarItemTier()">+ Adicionar ${ADMIN_TIER_TAB === 'jogos' ? 'jogo' : 'filme'}</button>` : ''}
        ${botaoImport}
        <button class="admin-btn ghost" onclick="carregarAdminTierList()">🔄 Recarregar</button>
      </div>
    </div>`;
}
window.renderAdminTierList = renderAdminTierList;

function ativarMultiSel(){
  ADMIN_MULTISEL = { ativo: true, ids: new Set() };
  document.body.classList.add('admin-multisel');
  renderAdminTierList();
}
function cancelarMultiSel(){
  ADMIN_MULTISEL = { ativo: false, ids: new Set() };
  document.body.classList.remove('admin-multisel');
  renderAdminTierList();
}
function toggleSelItem(id){
  if(ADMIN_MULTISEL.ids.has(id)) ADMIN_MULTISEL.ids.delete(id);
  else ADMIN_MULTISEL.ids.add(id);
  renderAdminTierList();
}
function toggleSelTodos(){
  const lista = ADMIN_TIER[ADMIN_TIER_TAB] || [];
  if(ADMIN_MULTISEL.ids.size === lista.length){ ADMIN_MULTISEL.ids = new Set(); }
  else { ADMIN_MULTISEL.ids = new Set(lista.map(it => it.id)); }
  renderAdminTierList();
}
async function apagarSelecionados(){
  const ids = Array.from(ADMIN_MULTISEL.ids);
  if(!ids.length){ toast('Selecione algo primeiro', 'warn'); return; }
  const tipo = ADMIN_TIER_TAB;
  const nomes = ids.slice(0, 5).map(id => {
    const it = ADMIN_TIER[tipo].find(x => x.id === id);
    return it ? it.nome : id;
  }).join(', ');
  const extra = ids.length > 5 ? ` e mais ${ids.length - 5}` : '';
  const ok = await confirmar(`Apagar ${ids.length} itens?`, `Vou apagar: ${nomes}${extra}. Essa ação não volta.`, '🗑️');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=tierlist-delete-many', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, tipo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast(`✅ ${d.apagados} itens apagados`, 'ok');
    cancelarMultiSel();
    await carregarAdminTierList();
    await carregarBiblioteca();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.ativarMultiSel = ativarMultiSel;
window.cancelarMultiSel = cancelarMultiSel;
window.toggleSelItem = toggleSelItem;
window.toggleSelTodos = toggleSelTodos;
window.apagarSelecionados = apagarSelecionados;

async function importarSteam(){
  const btn = document.getElementById('btnImportarSteam');
  const ok = await confirmar('Importar da Steam?', 'Vou buscar seus jogos na Steam e adicionar na tier list. A sinopse é traduzida automaticamente — pode demorar um pouco.', '📥');
  if(!ok) return;
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Buscando… (pode demorar)'; }
  try{
    const r = await fetch('/api/admin?action=importar-steam', { method: 'POST' });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha na importação');
    toast(`✅ ${d.adicionados} adicionados · ${d.pulados} já existiam`, 'ok');
    if(btn){ btn.disabled = false; btn.textContent = '📥 Importar da Steam'; }
    await carregarAdminTierList();
    await carregarBiblioteca();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){
    toast('Erro: ' + e.message, 'erro');
    if(btn){ btn.disabled = false; btn.textContent = '📥 Importar da Steam'; }
  }
}
window.importarSteam = importarSteam;

function abrirModalItemTier(i){
  const tipo = ADMIN_TIER_TAB;
  const lista = ADMIN_TIER[tipo];
  const ehNovo = (i === -1);
  const it = ehNovo ? { nome:'', tier:'NR', status: tipo==='jogos'?'Jogando':'Na fila', nota:0, comentario:'', capa:null, appid:null } : lista[i];
  const statusOpcoes = tipo === 'jogos'
    ? ['Jogando','Zerado','Dropado','Na fila']
    : ['Assistindo','Assistido','Na fila'];
  document.getElementById('dTitle').textContent = (ehNovo ? 'Adicionar ' : 'Editar ') + (tipo === 'jogos' ? 'jogo' : 'filme');
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div>
        <label>Nome</label>
        <div class="busca-row">
          <input id="itemNome" type="text" value="${esc(it.nome || '')}">
          <button type="button" onclick="buscarItemAuto()">🔍 Buscar</button>
        </div>
        <div id="buscaStatus" style="font-size:.72rem;color:var(--mute);margin-top:6px"></div>
      </div>
      <div class="row">
        <div><label>Tier</label>
          <select id="itemTier">
            ${['S','A','B','C','NR'].map(t => `<option value="${t}" ${it.tier === t ? 'selected' : ''}>${t === 'NR' ? 'Sem tier' : t}</option>`).join('')}
          </select>
        </div>
        <div><label>Status</label>
          <select id="itemStatus">
            ${statusOpcoes.map(s => `<option value="${s}" ${it.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row-3">
        <div><label>Nota (0-10)</label><input id="itemNota" type="number" min="0" max="10" step="0.1" value="${it.nota || 0}"></div>
        ${tipo === 'jogos' ? `
          <div><label>Horas</label><input id="itemHoras" type="number" min="0" step="0.1" value="${it.horas || 0}"></div>
          <div>
            <label style="display:flex;align-items:center;justify-content:space-between;gap:6px">
              <span>Conquistas (obtidas/total)</span>
              ${it.appid ? `<button type="button" class="btn-mini" id="btnConqAuto" onclick="buscarConquistasAuto(${it.appid})" style="font-size:.65rem;padding:3px 8px;border:1px solid var(--line);background:transparent;color:var(--purple-2);border-radius:6px;cursor:pointer">🏆 Buscar</button>` : ''}
            </label>
            <div style="display:flex;gap:6px">
              <input id="itemConqObt" type="number" min="0" value="${it.conquistas?.obtidas || 0}" placeholder="15">
              <input id="itemConqTot" type="number" min="0" value="${it.conquistas?.total || 0}" placeholder="50">
            </div>
          </div>
        ` : `
          <div><label>Duração (min)</label><input id="itemDuracao" type="number" min="0" value="${it.duracao || ''}"></div>
          <div><label>Ano</label><input id="itemAno" type="number" min="1900" max="2100" value="${it.ano || ''}"></div>
        `}
      </div>
      <div>
        <label>URL da capa</label>
        <input id="itemCapa" type="text" value="${esc(it.capa || '')}">
        <div style="margin-top:8px">
          ${it.capa ? `<img src="${esc(it.capa)}" class="mini-capa" id="itemCapaPreview" onerror="this.style.display='none'">` : `<img class="mini-capa" id="itemCapaPreview" style="display:none">`}
        </div>
      </div>
      <div>
        <label>Comentário / Sinopse</label>
        <textarea id="itemComentario">${esc(it.comentario || it.sinopse || '')}</textarea>
        <button type="button" class="admin-btn ghost" style="margin-top:6px;font-size:.72rem;padding:6px 12px" onclick="traduzirComentario()">🌐 Traduzir EN→PT</button>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn ghost" onclick="document.getElementById('dlg').close()">Cancelar</button>
        <button class="admin-btn" onclick="salvarItemTier(${i})">${ehNovo ? 'Adicionar' : 'Salvar'}</button>
      </div>
    </div>`;
  document.getElementById('dlg').showModal();
}
function adicionarItemTier(){ abrirModalItemTier(-1); }
function editarItemTier(i){ abrirModalItemTier(i); }
window.adicionarItemTier = adicionarItemTier;
window.editarItemTier = editarItemTier;

async function buscarItemAuto(){
  const nome = document.getElementById('itemNome').value.trim();
  if(!nome) return;
  const status = document.getElementById('buscaStatus');
  const tipo = ADMIN_TIER_TAB;
  status.textContent = '🔎 Buscando…';
  try{
    const action = tipo === 'jogos' ? 'buscar-jogo' : 'buscar-filme';
    const r = await fetch(`/api/admin?action=${action}&nome=${encodeURIComponent(nome)}`);
    const d = await r.json();
    if(d.erro){ status.textContent = '⚠️ ' + d.erro; return; }
    if(d.nome) document.getElementById('itemNome').value = d.nome;
    if(d.capa) {
      document.getElementById('itemCapa').value = d.capa;
      const p = document.getElementById('itemCapaPreview');
      p.src = d.capa; p.style.display = 'block';
    }
    if(d.nota && !document.getElementById('itemNota').value) document.getElementById('itemNota').value = d.nota;
    if(tipo === 'jogos'){
      if(d.sinopse && !document.getElementById('itemComentario').value) document.getElementById('itemComentario').value = d.sinopse;
    } else {
      if(d.duracao && !document.getElementById('itemDuracao').value) document.getElementById('itemDuracao').value = d.duracao;
      if(d.ano && !document.getElementById('itemAno').value) document.getElementById('itemAno').value = d.ano;
      if(d.sinopse && !document.getElementById('itemComentario').value) document.getElementById('itemComentario').value = d.sinopse;
    }
    status.textContent = '✅ Dados encontrados!';
    setTimeout(() => { status.textContent = ''; }, 3000);
  }catch(e){ status.textContent = '⚠️ Erro na busca'; }
}
window.buscarItemAuto = buscarItemAuto;

async function buscarConquistasAuto(appid){
  if(!appid) return;
  const btn = document.getElementById('btnConqAuto');
  if(btn){ btn.disabled = true; btn.textContent = '⏳'; }
  try{
    const r = await fetch(`/api/admin?action=buscar-conquistas&appid=${appid}`);
    const d = await r.json();
    if(d.erro){ toast('⚠️ ' + d.erro, 'warn'); }
    else if(d.total){
      document.getElementById('itemConqObt').value = d.obtidas;
      document.getElementById('itemConqTot').value = d.total;
      toast(`🏆 ${d.obtidas}/${d.total} conquistas`, 'ok');
    } else { toast('Sem conquistas nesse jogo', 'warn'); }
  }catch(e){ toast('Erro ao buscar conquistas', 'erro'); }
  finally { if(btn){ btn.disabled = false; btn.textContent = '🏆 Buscar'; } }
}
window.buscarConquistasAuto = buscarConquistasAuto;

async function traduzirComentario(){
  const ta = document.getElementById('itemComentario');
  const texto = ta.value.trim();
  if(!texto){ toast('Nada para traduzir', 'warn'); return; }
  ta.disabled = true;
  const original = ta.value;
  ta.value = '🌐 Traduzindo…';
  try{
    const r = await fetch('/api/admin?action=traduzir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto })
    });
    const d = await r.json();
    if(d.traduzido){ ta.value = d.traduzido; toast('Traduzido! ✅', 'ok'); }
    else { ta.value = original; toast('Não foi possível traduzir', 'erro'); }
  }catch(e){ ta.value = original; toast('Erro ao traduzir', 'erro'); }
  finally { ta.disabled = false; }
}
window.traduzirComentario = traduzirComentario;

async function salvarItemTier(i){
  const tipo = ADMIN_TIER_TAB;
  const nome = document.getElementById('itemNome').value.trim();
  if(!nome){ toast('Digite um nome!', 'warn'); return; }
  const anterior = i >= 0 ? ADMIN_TIER[tipo][i] : {};
  const item = {
    id: anterior.id || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40),
    nome, tier: document.getElementById('itemTier').value,
    status: document.getElementById('itemStatus').value,
    nota: Number(document.getElementById('itemNota').value) || 0,
    capa: document.getElementById('itemCapa').value.trim() || null,
    comentario: document.getElementById('itemComentario').value.trim(),
    appid: anterior.appid || null,
    adicionadoEm: anterior.adicionadoEm || new Date().toISOString()
  };
  if(tipo === 'jogos'){
    item.horas = Number(document.getElementById('itemHoras').value) || 0;
    const o = Number(document.getElementById('itemConqObt').value) || 0;
    const t = Number(document.getElementById('itemConqTot').value) || 0;
    item.conquistas = (o || t) ? { obtidas: o, total: t } : null;
  } else {
    item.duracao = Number(document.getElementById('itemDuracao').value) || null;
    item.ano = Number(document.getElementById('itemAno').value) || null;
  }
  const nova = ADMIN_TIER[tipo].slice();
  if(i >= 0) nova[i] = item;
  else nova.push(item);
  ADMIN_TIER[tipo] = nova;
  await salvarTierList(`Editou "${item.nome}" (tier ${item.tier})`);
}
window.salvarItemTier = salvarItemTier;

async function removerItemTier(i){
  const tipo = ADMIN_TIER_TAB;
  const removido = ADMIN_TIER[tipo][i].nome;
  const ok = await confirmar('Remover item?', `"${removido}" será removido da tier list.`, '🗑️');
  if(!ok) return;
  ADMIN_TIER[tipo] = ADMIN_TIER[tipo].slice();
  ADMIN_TIER[tipo].splice(i, 1);
  await salvarTierList(`Removeu "${removido}"`);
}
window.removerItemTier = removerItemTier;

async function salvarTierList(logAcao){
  try{
    const r = await fetch('/api/admin?action=tierlist-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogos: ADMIN_TIER.jogos, filmes: ADMIN_TIER.filmes, logAcao })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    document.getElementById('dlg').close();
    toast('Salvo! ✅', 'ok');
    await carregarAdminTierList();
    await carregarBiblioteca();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}

/* ============================================================
   ADMINS (com accordion colapsável)
   ============================================================ */
async function renderAdminAdmins(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('👥 Admins') + `<p class="admin-vazio">Carregando…</p>`;
  let dados = { admins: [], meuCargo: null };
  try{
    const r = await fetch('/api/admin?action=admins-ver');
    if(r.ok) dados = await r.json();
  }catch(e){}
  const meCargo = dados.meuCargo || (USUARIO && USUARIO.cargo) || 'moderador';
  const nivelMeu = NIVEIS[meCargo] || 0;
  const podeGerenciar = temPerm('editar_admins') && nivelMeu >= 3;
  const podeMexerDev = meCargo === 'dev';

  const adminsHTML = (dados.admins || []).map(a => {
    const nivelAlvo = NIVEIS[a.cargo] || 0;
    const podeEditar = podeGerenciar && (podeMexerDev || nivelAlvo < nivelMeu) && a.id !== USUARIO.id;
    return `
      <div class="admin-voto" style="flex-wrap:wrap">
        ${a.avatar
          ? `<img class="admin-voto-avatar" src="${esc(a.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'admin-voto-ph',textContent:'👤'}))">`
          : '<div class="admin-voto-ph">👤</div>'}
        <div class="admin-voto-info">
          <b>${a.username ? '@' + esc(a.username) : 'Sem nick'}</b>
          <small>${esc(a.id)}</small>
        </div>
        <div class="admin-voto-opcao" style="gap:6px">
          <b>${LABEL_CARGO[a.cargo] || a.cargo}${a.fixo ? ' 🔒' : ''}</b>
          <div style="display:flex;gap:6px;margin-top:4px">
            ${podeEditar ? `<button class="btn-mini" data-admin-editar data-id="${esc(a.id)}" data-nome="${esc(a.username||'')}" data-avatar="${esc(a.avatar||'')}" data-cargo="${esc(a.cargo)}">Editar</button>` : ''}
            ${podeEditar ? `<button class="btn-mini danger" data-admin-remover data-id="${esc(a.id)}">Remover</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const podeEditarPerms = temPerm('editar_config');

  area.innerHTML = adminVoltarHTML('👥 Admins') + `
    <div class="admin-card">
      <h3>👥 Administradores <span class="cont">${(dados.admins||[]).length}</span></h3>
      ${dados.admins && dados.admins.length
        ? `<div class="admin-votos">${adminsHTML}</div>`
        : '<div class="logs-empty"><b>Nenhum admin cadastrado</b>Adiciona o primeiro pra começar.</div>'}
      <div class="admin-actions">
        ${podeGerenciar ? `<button class="admin-btn" onclick="adicionarAdmin()">+ Adicionar admin</button>` : ''}
        <button class="admin-btn ghost" onclick="renderAdminAdmins()">🔄 Atualizar</button>
      </div>
    </div>

    <div class="admin-card">
      <h3>🔐 Permissões por cargo</h3>
      <p style="color:var(--mute);font-size:.82rem;margin-bottom:14px">
        Clica num cargo pra ver/editar o que ele pode fazer. <b>Dev</b> sempre tem acesso total.
      </p>
      <div id="permsAccordion"></div>
      ${podeEditarPerms ? `
        <div class="admin-actions">
          <button class="admin-btn" onclick="salvarPermissoes()">💾 Salvar permissões</button>
          <button class="admin-btn ghost" onclick="carregarPermissoes()">🔄 Recarregar</button>
          <button class="admin-btn ghost" onclick="restaurarPermissoesPadrao()">♻️ Restaurar padrão</button>
        </div>
      ` : ''}
    </div>`;

  if(podeEditarPerms) carregarPermissoes();
}
window.renderAdminAdmins = renderAdminAdmins;

/* ---------- Event delegation para admins ---------- */
document.addEventListener('click', e => {
  const editar = e.target.closest('[data-admin-editar]');
  if(editar){
    editarAdmin(editar.dataset.id, editar.dataset.nome, editar.dataset.avatar, editar.dataset.cargo);
    return;
  }
  const remover = e.target.closest('[data-admin-remover]');
  if(remover){ removerAdmin(remover.dataset.id); }
});

/* ---------- Permissões (accordion colapsável) ---------- */
async function carregarPermissoes(){
  const wrap = document.getElementById('permsAccordion');
  if(!wrap) return;
  wrap.innerHTML = '<p class="admin-vazio">Carregando…</p>';
  try{
    const r = await fetch('/api/admin?action=permissoes-get');
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    PERMS_DADOS = d.permissoes;
    PERMS_LABELS = d.labels || {};
    renderPermissoes();
  }catch(e){
    wrap.innerHTML = `<div class="logs-empty"><b>Erro</b>${esc(e.message)}</div>`;
  }
}
window.carregarPermissoes = carregarPermissoes;

function renderPermissoes(){
  const wrap = document.getElementById('permsAccordion');
  if(!wrap || !PERMS_DADOS) return;
  const podeEditar = temPerm('editar_config');

  wrap.innerHTML = CARGOS_ORDEM.map(cargo => {
    const isDev = cargo === 'dev';
    const perms = PERMS_DADOS[cargo] || [];
    const icone = LABEL_CARGO[cargo].split(' ')[0];
    const nomeCargo = LABEL_CARGO[cargo].split(' ').slice(1).join(' ');
    const tag = isDev
      ? `<span class="aah-tag locked">🔒 acesso total</span>`
      : (podeEditar ? `<span class="aah-tag">customizável</span>` : `<span class="aah-tag">somente leitura</span>`);

    const body = `
      <div class="perms-compact">
        ${Object.entries(PERM_GRUPOS).map(([grupo, lista]) => `
          <div class="perm-compact-group">
            <span>${grupo}</span>
            ${lista.map(p => {
              if(isDev){
                return `<div class="perm-check fixed"><input type="checkbox" checked disabled><span>${PERMS_LABELS[p] || p}</span><span class="lock">fixo</span></div>`;
              }
              if(!podeEditar){
                const on = perms.includes(p);
                return `<div class="perm-check"><input type="checkbox" ${on ? 'checked' : ''} disabled><span>${PERMS_LABELS[p] || p}</span></div>`;
              }
              return `<label class="perm-check"><input type="checkbox" data-cargo="${cargo}" data-perm="${p}" ${perms.includes(p) ? 'checked' : ''}><span>${PERMS_LABELS[p] || p}</span></label>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;

    return `
      <div class="admin-accordion" data-cargo="${cargo}">
        <div class="admin-accordion-head" onclick="this.parentElement.classList.toggle('open')">
          <span class="aah-ic">${icone}</span>
          <span class="aah-tx">
            <b>${nomeCargo}</b>
            <small>${isDev ? 'Tem acesso a tudo no painel' : 'Clique pra ver as permissões'}</small>
          </span>
          ${tag}
          <span class="aah-arrow">▶</span>
        </div>
        <div class="admin-accordion-body">
          <div class="aab-inner">${body}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function salvarPermissoes(){
  if(!PERMS_DADOS){ toast('Nada pra salvar', 'warn'); return; }
  const novo = {};
  for(const cargo of CARGOS_ORDEM){
    novo[cargo] = cargo === 'dev' ? (PERMS_DADOS.dev || []) : [];
  }
  document.querySelectorAll('#permsAccordion input[type="checkbox"]').forEach(cb => {
    if(cb.disabled) return;
    const c = cb.dataset.cargo;
    const p = cb.dataset.perm;
    if(!c || !p) return;
    if(cb.checked && !novo[c].includes(p)) novo[c].push(p);
  });
  try{
    const r = await fetch('/api/admin?action=permissoes-set', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ permissoes: novo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    PERMS_DADOS = d.permissoes;
    if(USUARIO && USUARIO.cargo){
      USUARIO.permissoes = PERMS_DADOS[USUARIO.cargo] || [];
    }
    toast('Permissões salvas! ✅', 'ok');
    renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarPermissoes = salvarPermissoes;

async function restaurarPermissoesPadrao(){
  const ok = await confirmar('Restaurar padrão?', 'As permissões voltam ao padrão de fábrica. Isso sobrescreve as customizadas.', '♻️');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=permissoes-get');
    const d = await r.json();
    if(!d.padrao) throw new Error('Padrão indisponível');
    const r2 = await fetch('/api/admin?action=permissoes-set', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ permissoes: d.padrao })
    });
    const d2 = await r2.json();
    if(!r2.ok) throw new Error(d2.error || 'Falha');
    PERMS_DADOS = d2.permissoes;
    if(USUARIO && USUARIO.cargo){
      USUARIO.permissoes = PERMS_DADOS[USUARIO.cargo] || [];
    }
    toast('Permissões restauradas! ✅', 'ok');
    renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.restaurarPermissoesPadrao = restaurarPermissoesPadrao;

function editarAdmin(id, username, avatar, cargoAtual){
  document.getElementById('dTitle').textContent = 'Editar admin';
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID do Discord</label><input type="text" value="${esc(id)}" disabled></div>
      <div><label>Nick</label><input type="text" value="${esc(username)}" disabled></div>
      <div><label>Cargo</label>
        <select id="editAdminCargo">
          <option value="dev" ${cargoAtual==='dev'?'selected':''}>🛠️ Dev</option>
          <option value="dono" ${cargoAtual==='dono'?'selected':''}>👑 Dono</option>
          <option value="administrador" ${cargoAtual==='administrador'?'selected':''}>🛡️ Administrador</option>
          <option value="moderador" ${cargoAtual==='moderador'?'selected':''}>🔰 Moderador</option>
        </select>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn" id="btnSalvarAdminEdit">Salvar</button>
      </div>
    </div>`;
  document.getElementById('btnSalvarAdminEdit').addEventListener('click', () => salvarAdmin(id, username, avatar));
  document.getElementById('dlg').showModal();
}
window.editarAdmin = editarAdmin;

async function salvarAdmin(id, username, avatar){
  const cargo = document.getElementById('editAdminCargo').value;
  try{
    const r = await fetch('/api/admin?action=admins-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, cargo, username, avatar })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    document.getElementById('dlg').close();
    toast('Salvo! ✅', 'ok');
    await renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarAdmin = salvarAdmin;

function adicionarAdmin(){
  document.getElementById('dTitle').textContent = 'Adicionar admin';
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID do Discord</label><input id="novoAdminId" type="text" placeholder="123456789012345678"></div>
      <div><label>Cargo</label>
        <select id="novoAdminCargo">
          <option value="moderador">🔰 Moderador</option>
          <option value="administrador">🛡️ Administrador</option>
          <option value="dono">👑 Dono</option>
          <option value="dev">🛠️ Dev</option>
        </select>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn" onclick="salvarNovoAdmin()">Adicionar</button>
      </div>
    </div>`;
  document.getElementById('dlg').showModal();
}
window.adicionarAdmin = adicionarAdmin;

async function salvarNovoAdmin(){
  const userId = document.getElementById('novoAdminId').value.trim();
  const cargo = document.getElementById('novoAdminCargo').value;
  if(!userId){ toast('Digite o ID', 'warn'); return; }
  try{
    const r = await fetch('/api/admin?action=admins-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, cargo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    document.getElementById('dlg').close();
    toast('Admin adicionado ✅', 'ok');
    await renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarNovoAdmin = salvarNovoAdmin;

async function removerAdmin(id){
  const ok = await confirmar('Remover admin?', 'A pessoa perde acesso ao painel.', '🗑️');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=admins-remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast('Removido ✅', 'ok');
    await renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.removerAdmin = removerAdmin;

/* ============================================================
   BANIDOS
   ============================================================ */
async function renderAdminBanidos(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('🚫 Banidos') + `<p class="admin-vazio">Carregando…</p>`;
  let banidos = [];
  try {
    const r = await fetch('/api/admin?action=banidos-ver');
    if(r.ok){ const d = await r.json(); banidos = d.banidos || []; }
  } catch(e){}
  const podeGerenciar = temPerm('editar_banidos');
  area.innerHTML = adminVoltarHTML('🚫 Banidos') + `
    <div class="admin-card">
      <h3>🚫 Banidos de votar <span class="cont">${banidos.length}</span></h3>
      ${banidos.length ? `<div class="admin-votos">${banidos.map(b => `
        <div class="admin-voto">
          ${b.avatar
            ? `<img class="admin-voto-avatar" src="${esc(b.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'admin-voto-ph',textContent:'👤'}))">`
            : '<div class="admin-voto-ph">👤</div>'}
          <div class="admin-voto-info">
            <b>${b.username ? '@' + esc(b.username) : 'Sem nick'}</b>
            <small>${esc(b.id)} · ${esc(b.motivo || 'Sem motivo')}</small>
          </div>
          <div class="admin-voto-opcao">
            <small>${b.ts ? tempoAtras(new Date(b.ts).toISOString()) : ''}</small>
            ${podeGerenciar ? `<button class="btn-mini danger" style="margin-top:6px" onclick="removerBanido('${esc(b.id)}')">Desbanir</button>` : ''}
          </div>
        </div>`).join('')}</div>`
        : '<div class="logs-empty"><b>Ninguém banido</b>Quando alguém for banido, aparece aqui.</div>'}
      <div class="admin-actions">
        ${podeGerenciar ? `<button class="admin-btn" onclick="adicionarBanido()">+ Banir usuário</button>` : ''}
        <button class="admin-btn ghost" onclick="renderAdminBanidos()">🔄 Atualizar</button>
      </div>
    </div>`;
}
window.renderAdminBanidos = renderAdminBanidos;

function adicionarBanido(){
  document.getElementById('dTitle').textContent = 'Banir usuário';
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID do Discord</label><input id="banirId" type="text" placeholder="123456789012345678"></div>
      <div><label>Motivo (opcional)</label><input id="banirMotivo" type="text" placeholder="Ex: votou com multis"></div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn perigo" onclick="salvarBanido()">Banir</button>
      </div>
    </div>`;
  document.getElementById('dlg').showModal();
}
window.adicionarBanido = adicionarBanido;

async function salvarBanido(){
  const userId = document.getElementById('banirId').value.trim();
  const motivo = document.getElementById('banirMotivo').value.trim();
  if(!userId){ toast('Digite o ID', 'warn'); return; }
  try{
    const r = await fetch('/api/admin?action=banidos-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, motivo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    document.getElementById('dlg').close();
    toast('Banido ✅', 'ok');
    await renderAdminBanidos();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarBanido = salvarBanido;

async function removerBanido(id){
  const ok = await confirmar('Desbanir?', 'A pessoa volta a poder votar.', '✅');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=banidos-remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id })
    });
    if(!r.ok) throw new Error('Falha');
    toast('Desbanido ✅', 'ok');
    await renderAdminBanidos();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.removerBanido = removerBanido;

/* ============================================================
   CONFIG (com abas)
   ============================================================ */
async function renderAdminConfig(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('⚙️ Config geral') + `<p class="admin-vazio">Carregando…</p>`;
  try {
    const r = await fetch('/api/admin?action=config-get', { cache:'no-store' });
    const d = await r.json();
    const av = d.aviso || { ativo: false, tipo: 'info', icone: '📢', titulo: 'Aviso', texto: '' };
    const top3Txt = (d.top3 || []).map(p => `${p.nome}${p.valor ? ' | ' + p.valor : ''}`).join('\n');
    const hallTxt = (d.hall || []).map(p => `${p.nome}${p.meta ? ' | ' + p.meta : ''}`).join('\n');
    const podeEditar = temPerm('editar_config');
    const tab = ADMIN_CONFIG_TAB || 'aviso';

    area.innerHTML = adminVoltarHTML('⚙️ Config geral') + `
      <div class="config-tabs">
        <button class="config-tab ${tab === 'aviso' ? 'on' : ''}" onclick="adminIrConfigTab('aviso')">📢 Aviso</button>
        <button class="config-tab ${tab === 'aparencia' ? 'on' : ''}" onclick="adminIrConfigTab('aparencia')">💜 Aparência</button>
        <button class="config-tab ${tab === 'sistema' ? 'on' : ''}" onclick="adminIrConfigTab('sistema')">🔧 Sistema</button>
      </div>

      <!-- ===== ABA AVISO ===== -->
      <div class="config-panel ${tab === 'aviso' ? 'on' : ''}">
        <div class="admin-card">
          <h3>📢 Aviso da home</h3>
          <div class="admin-form">
            <div>
              <label style="display:flex;align-items:center;gap:8px;text-transform:none">
                <input type="checkbox" id="cfgAvisoAtivo" ${av.ativo ? 'checked' : ''} style="width:auto">
                Mostrar aviso na home
              </label>
            </div>
            <div class="row">
              <div><label>Ícone</label><input id="cfgAvisoIcone" type="text" value="${esc(av.icone || '📢')}"></div>
              <div><label>Tipo</label>
                <select id="cfgAvisoTipo">
                  <option value="info" ${av.tipo === 'info' ? 'selected' : ''}>Info (roxo)</option>
                  <option value="warn" ${av.tipo === 'warn' ? 'selected' : ''}>Aviso (laranja)</option>
                </select>
              </div>
            </div>
            <div><label>Título</label><input id="cfgAvisoTitulo" type="text" value="${esc(av.titulo || '')}"></div>
            <div><label>Texto</label><textarea id="cfgAvisoTexto" rows="3">${esc(av.texto || '')}</textarea></div>
            <div>
              <div class="aviso-preview ${av.tipo === 'warn' ? 'warn' : ''}" id="avisoPreview">
                <span class="ap-label">Preview</span>
                <span class="ap-ic" id="apIcon">${esc(av.icone || '📢')}</span>
                <div class="ap-tx">
                  <b id="apTitulo">${esc(av.titulo || 'Aviso')}</b>
                  <span id="apTexto">${esc(av.texto || 'O texto do aviso aparece aqui…')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== ABA APARÊNCIA ===== -->
      <div class="config-panel ${tab === 'aparencia' ? 'on' : ''}">
        <div class="admin-card">
          <h3>💜 Link de doação</h3>
          <div class="admin-form">
            <div><label>URL</label><input id="cfgDonate" type="text" value="${esc(d.donate || CONFIG.donate || '')}"></div>
          </div>
        </div>

        <div class="admin-card">
          <h3>💬 Recado da Soso</h3>
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Aparece na home, no card "Apoie o cantinho".</p>
          <div class="admin-form">
            <div><label>Texto do recado</label><textarea id="cfgRecado" rows="3" placeholder="Ex: Essa semana tem live de terror! 💜">${esc(d.recado || '')}</textarea></div>
          </div>
        </div>

        <div class="admin-card">
          <h3>🏆 Top 3 apoiadores</h3>
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Um por linha, formato: <code>Nome | valor</code>.</p>
          <div class="admin-form">
            <div><label>Linhas (até 3)</label><textarea id="cfgTop3" rows="4" placeholder="lukxsl | R$ 250&#10;mari | R$ 180">${esc(top3Txt)}</textarea></div>
          </div>
        </div>

        <div class="admin-card">
          <h3>👑 Hall da fama · maiores subs</h3>
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Um por linha, formato: <code>Nome | tempo</code>.</p>
          <div class="admin-form">
            <div><label>Linhas (até 5)</label><textarea id="cfgHall" rows="6" placeholder="gabizinha | 14 meses&#10;pedrinho | 11 meses">${esc(hallTxt)}</textarea></div>
          </div>
        </div>
      </div>

      <!-- ===== ABA SISTEMA ===== -->
      <div class="config-panel ${tab === 'sistema' ? 'on' : ''}">
        <div class="admin-card">
          <h3>📺 Horas do mês</h3>
          <div class="sync-card">
            <div class="sync-ic">📺</div>
            <div class="sync-tx">
              <b>Calculado automaticamente pela Twitch</b>
              <span>As horas do mês são atualizadas conforme os VODs do canal.</span>
              <span class="sync-val" id="syncHoras">${esc(d.horasMes || '—')}</span>
            </div>
            <button type="button" class="admin-btn ghost" id="btnSyncHoras" onclick="sincronizarHoras()">🔄 Sincronizar</button>
          </div>
        </div>

        <div class="admin-card">
          <h3>🔧 Modo manutenção</h3>
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">
            Quando ligado, quem <b>não é admin</b> vê uma tela de "Estamos em manutenção".
          </p>
          <label style="display:flex;align-items:center;gap:10px;font-weight:700">
            <input type="checkbox" id="cfgManutencao" ${d.manutencao ? 'checked' : ''} style="width:auto">
            Ligar modo manutenção
          </label>
        </div>
      </div>

      ${podeEditar ? `
        <div class="admin-actions">
          <button class="admin-btn" onclick="salvarConfig()">💾 Salvar tudo</button>
          <button class="admin-btn ghost" onclick="renderAdminConfig()">🔄 Recarregar</button>
        </div>
      ` : `<p style="color:var(--mute);font-size:.82rem;text-align:center;margin-top:14px">Você não tem permissão pra editar o config.</p>`}
    `;

    // Live preview do aviso
    const inputsAviso = ['cfgAvisoIcone','cfgAvisoTitulo','cfgAvisoTexto','cfgAvisoTipo'];
    inputsAviso.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('input', atualizarPreviewAviso);
      el.addEventListener('change', atualizarPreviewAviso);
    });
    atualizarPreviewAviso();

  } catch(e){
    area.innerHTML = adminVoltarHTML('⚙️ Config geral') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
  }
}
window.renderAdminConfig = renderAdminConfig;

function atualizarPreviewAviso(){
  const icon = document.getElementById('apIcon');
  const titulo = document.getElementById('apTitulo');
  const texto = document.getElementById('apTexto');
  const preview = document.getElementById('avisoPreview');
  if(!icon || !titulo || !texto || !preview) return;
  icon.textContent = document.getElementById('cfgAvisoIcone')?.value.trim() || '📢';
  titulo.textContent = document.getElementById('cfgAvisoTitulo')?.value.trim() || 'Aviso';
  texto.textContent = document.getElementById('cfgAvisoTexto')?.value.trim() || 'O texto do aviso aparece aqui…';
  const tipo = document.getElementById('cfgAvisoTipo')?.value || 'info';
  preview.classList.toggle('warn', tipo === 'warn');
}

async function sincronizarHoras(){
  const btn = document.getElementById('btnSyncHoras');
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Buscando…'; }
  try{
    const r = await fetch('/api/twitch', { cache: 'no-store' });
    const d = await r.json();
    const horas = d?.horasMes;
    const el = document.getElementById('syncHoras');
    if(el) el.textContent = (horas != null) ? horas + 'h' : '—';
    toast(horas != null ? `Horas atualizadas: ${horas}h` : 'Não foi possível atualizar', horas != null ? 'ok' : 'warn');
  }catch(e){
    toast('Erro ao sincronizar', 'erro');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = '🔄 Sincronizar'; }
  }
}
window.sincronizarHoras = sincronizarHoras;

async function salvarConfig(){
  const aviso = {
    ativo: document.getElementById('cfgAvisoAtivo')?.checked || false,
    tipo: document.getElementById('cfgAvisoTipo')?.value || 'info',
    icone: (document.getElementById('cfgAvisoIcone')?.value || '').trim() || '📢',
    titulo: (document.getElementById('cfgAvisoTitulo')?.value || '').trim() || 'Aviso',
    texto: (document.getElementById('cfgAvisoTexto')?.value || '').trim()
  };
  const donate = (document.getElementById('cfgDonate')?.value || '').trim();
  const recado = (document.getElementById('cfgRecado')?.value || '').trim();
  const manutencao = document.getElementById('cfgManutencao')?.checked || false;

  const top3 = ((document.getElementById('cfgTop3')?.value || '')).split('\n').map(l => l.trim()).filter(Boolean).slice(0,3)
    .map(l => {
      const [nome, ...resto] = l.split('|').map(s => s.trim());
      return { nome: nome || '—', valor: resto.join(' ').trim() || null };
    });

  const hall = ((document.getElementById('cfgHall')?.value || '')).split('\n').map(l => l.trim()).filter(Boolean).slice(0,5)
    .map(l => {
      const [nome, ...resto] = l.split('|').map(s => s.trim());
      return { nome: nome || '—', meta: resto.join(' ').trim() || null };
    });

  try{
    const r = await fetch('/api/admin?action=config-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aviso, donate, manutencao, recado, top3, hall })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    CONFIG_GERAL = { ...CONFIG_GERAL, aviso, donate, manutencao, recado, top3, hall, updatedAt: d.updatedAt || new Date().toISOString() };
    Object.assign(AVISO, aviso);
    if(!aviso.ativo || !aviso.texto) AVISO.ativo = false;
    renderAviso();
    renderHomeExtras();
    renderSiteUpdate();
    aplicarManutencao();
    toast('Salvo! ✅', 'ok');
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarConfig = salvarConfig;

/* ============================================================
   LOGS (com filtros)
   ============================================================ */
const LOGS_STATE = { busca: '', periodo: 'all', tipo: 'all' };

function categoriaLog(acao){
  const a = (acao || '').toLowerCase();
  if(/resetou|resetar|votaç|voto|opç/.test(a))    return { ic:'🗳️', accent:'purple', label:'Votação' };
  if(/tier|moveu|removeu|importou|editou item/.test(a)) return { ic:'🎮', accent:'amber',  label:'Tier List' };
  if(/admin/.test(a))                              return { ic:'👥', accent:'blue',   label:'Admins' };
  if(/bani|desbaniu/.test(a))                      return { ic:'🚫', accent:'red',    label:'Banidos' };
  if(/config|manuten|aviso|recado|doaç/.test(a))   return { ic:'⚙️', accent:'green',  label:'Config' };
  if(/backup/.test(a))                             return { ic:'💾', accent:'cyan',   label:'Backup' };
  return { ic:'📋', accent:'purple', label:'Geral' };
}

function periodoMinimo(periodo){
  const now = Date.now();
  if(periodo === '24h') return now - 24 * 3600 * 1000;
  if(periodo === '7d')  return now - 7 * 24 * 3600 * 1000;
  if(periodo === '30d') return now - 30 * 24 * 3600 * 1000;
  return 0;
}

function aplicarFiltrosLogs(logs){
  const q = LOGS_STATE.busca.trim().toLowerCase();
  const minTs = periodoMinimo(LOGS_STATE.periodo);
  const tipo = LOGS_STATE.tipo;

  return logs.filter(l => {
    if(minTs && (l.ts || 0) < minTs) return false;
    if(tipo !== 'all'){
      const cat = categoriaLog(l.acao).label.toLowerCase().replace(' ', '');
      if(cat !== tipo) return false;
    }
    if(q){
      const txt = ((l.quem || '') + ' ' + (l.acao || '')).toLowerCase();
      if(!txt.includes(q)) return false;
    }
    return true;
  });
}

function agruparLogsPorDia(logs){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const grupos = {};
  const ordem = [];
  logs.forEach(l => {
    const d = new Date(l.ts);
    const dOnly = new Date(d); dOnly.setHours(0,0,0,0);
    let key;
    if(dOnly.getTime() === hoje.getTime()) key = 'Hoje';
    else if(dOnly.getTime() === ontem.getTime()) key = 'Ontem';
    else key = d.toLocaleDateString('pt-BR');
    if(!grupos[key]){ grupos[key] = []; ordem.push(key); }
    grupos[key].push(l);
  });
  return { grupos, ordem };
}

async function renderAdminLogs(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('📋 Logs') + `<p class="admin-vazio">Carregando…</p>`;

  let logs = [];
  try {
    const r = await fetch('/api/admin?action=logs-ver');
    const d = await r.json();
    logs = d.logs || [];
  } catch(e){}

  if(!logs.length){
    area.innerHTML = adminVoltarHTML('📋 Logs') + `
      <div class="logs-empty">
        <b>Nenhuma ação registrada ainda</b>
        Quando alguém mexer no painel, aparece aqui.
      </div>`;
    return;
  }

  area.innerHTML = adminVoltarHTML('📋 Logs') + `
    <div class="admin-card">
      <h3>📋 Histórico de ações</h3>
      <div class="logs-filters">
        <div class="logs-search">
          <input type="text" id="logsBusca" placeholder="Buscar por @admin ou ação..." value="${esc(LOGS_STATE.busca)}">
        </div>
        <select id="logsPeriodo">
          <option value="all" ${LOGS_STATE.periodo === 'all' ? 'selected' : ''}>Todo o período</option>
          <option value="24h" ${LOGS_STATE.periodo === '24h' ? 'selected' : ''}>Últimas 24h</option>
          <option value="7d"  ${LOGS_STATE.periodo === '7d'  ? 'selected' : ''}>Últimos 7 dias</option>
          <option value="30d" ${LOGS_STATE.periodo === '30d' ? 'selected' : ''}>Últimos 30 dias</option>
        </select>
        <select id="logsTipo">
          <option value="all" ${LOGS_STATE.tipo === 'all' ? 'selected' : ''}>Todos os tipos</option>
          <option value="votacao" ${LOGS_STATE.tipo === 'votacao' ? 'selected' : ''}>🗳️ Votação</option>
          <option value="tierlist" ${LOGS_STATE.tipo === 'tierlist' ? 'selected' : ''}>🎮 Tier List</option>
          <option value="admins" ${LOGS_STATE.tipo === 'admins' ? 'selected' : ''}>👥 Admins</option>
          <option value="banidos" ${LOGS_STATE.tipo === 'banidos' ? 'selected' : ''}>🚫 Banidos</option>
          <option value="config" ${LOGS_STATE.tipo === 'config' ? 'selected' : ''}>⚙️ Config</option>
          <option value="backup" ${LOGS_STATE.tipo === 'backup' ? 'selected' : ''}>💾 Backup</option>
        </select>
      </div>

      <div class="logs-summary" id="logsSummary"></div>

      <div id="logsLista"></div>
    </div>

    <div class="admin-actions">
      <button class="admin-btn ghost" onclick="renderAdminLogs()">🔄 Atualizar</button>
    </div>
  `;

  const filtrados = aplicarFiltrosLogs(logs);

  // Summary
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const totalHoje = logs.filter(l => (l.ts || 0) >= hoje.getTime()).length;
  const totalOntem = logs.filter(l => (l.ts||0) >= hoje.getTime() - 86400000 && (l.ts||0) < hoje.getTime()).length;
  const total7d = logs.filter(l => (l.ts || 0) >= Date.now() - 7 * 86400000).length;
  document.getElementById('logsSummary').innerHTML = `
    <div class="ls-item">Total<b>${logs.length}</b></div>
    <div class="ls-item">Hoje<b>${totalHoje}</b></div>
    <div class="ls-item">Ontem<b>${totalOntem}</b></div>
    <div class="ls-item">Últimos 7d<b>${total7d}</b></div>
    ${filtrados.length !== logs.length ? `<div class="ls-item">Filtrados<b>${filtrados.length}</b></div>` : ''}
  `;

  // Lista
  const lista = document.getElementById('logsLista');
  if(!filtrados.length){
    lista.innerHTML = `<div class="logs-empty"><b>Nenhum log com esses filtros</b>Tenta limpar a busca ou mudar o período.</div>`;
  } else {
    const { grupos, ordem } = agruparLogsPorDia(filtrados);
    lista.innerHTML = ordem.map(dia => `
      <div class="logs-day">
        <div class="logs-day-head"><span>${esc(dia)}</span></div>
        ${grupos[dia].map(l => {
          const cat = categoriaLog(l.acao);
          const cargoIc = LABEL_CARGO[l.cargo] ? LABEL_CARGO[l.cargo].split(' ')[0] : '👤';
          return `
            <div class="log-row" data-accent="${cat.accent}">
              <span class="lr-ic">${cat.ic}</span>
              <div class="lr-tx">
                <b>${cargoIc} @${esc(l.quem || 'alguém')}</b>
                <small>${esc(l.acao || '')}</small>
              </div>
              <span class="lr-time">${l.ts ? tempoAtras(new Date(l.ts).toISOString()) : ''}</span>
            </div>
          `;
        }).join('')}
      </div>
    `).join('');
  }

  // Bind filtros
  document.getElementById('logsBusca')?.addEventListener('input', e => {
    LOGS_STATE.busca = e.target.value;
    aplicarFiltrosEAtualizar(logs);
  });
  document.getElementById('logsPeriodo')?.addEventListener('change', e => {
    LOGS_STATE.periodo = e.target.value;
    aplicarFiltrosEAtualizar(logs);
  });
  document.getElementById('logsTipo')?.addEventListener('change', e => {
    LOGS_STATE.tipo = e.target.value;
    aplicarFiltrosEAtualizar(logs);
  });
}

function aplicarFiltrosEAtualizar(logs){
  const filtrados = aplicarFiltrosLogs(logs);
  const lista = document.getElementById('logsLista');
  if(!lista) return;
  if(!filtrados.length){
    lista.innerHTML = `<div class="logs-empty"><b>Nenhum log com esses filtros</b>Tenta limpar a busca ou mudar o período.</div>`;
    return;
  }
  const { grupos, ordem } = agruparLogsPorDia(filtrados);
  lista.innerHTML = ordem.map(dia => `
    <div class="logs-day">
      <div class="logs-day-head"><span>${esc(dia)}</span></div>
      ${grupos[dia].map(l => {
        const cat = categoriaLog(l.acao);
        const cargoIc = LABEL_CARGO[l.cargo] ? LABEL_CARGO[l.cargo].split(' ')[0] : '👤';
        return `
          <div class="log-row" data-accent="${cat.accent}">
            <span class="lr-ic">${cat.ic}</span>
            <div class="lr-tx">
              <b>${cargoIc} @${esc(l.quem || 'alguém')}</b>
              <small>${esc(l.acao || '')}</small>
            </div>
            <span class="lr-time">${l.ts ? tempoAtras(new Date(l.ts).toISOString()) : ''}</span>
          </div>
        `;
      }).join('')}
    </div>
  `).join('');
}
window.renderAdminLogs = renderAdminLogs;

/* ============================================================
   BACKUP
   ============================================================ */
async function renderAdminBackup(){
  const area = document.getElementById('adminArea');
  if(!area) return;
  area.innerHTML = adminVoltarHTML('💾 Backup') + `<p class="admin-vazio">Carregando…</p>`;
  let backups = [];
  try {
    const r = await fetch('/api/backup?action=list');
    if(r.ok){ const d = await r.json(); backups = d.backups || []; }
  } catch(e){}
  const fmtTamanho = b => b < 1024 ? b + ' B' : b < 1024*1024 ? (b/1024).toFixed(1) + ' KB' : (b/1024/1024).toFixed(1) + ' MB';
  area.innerHTML = adminVoltarHTML('💾 Backup') + `
    <div class="admin-card">
      <h3>💾 Backups automáticos <span class="cont">${backups.length} / 5</span></h3>
      <p style="color:var(--mute);font-size:.85rem;margin-bottom:14px">
        Um backup automático é criado todo dia às 3h da manhã. Você também pode criar manualmente. Os 5 mais recentes são mantidos.
      </p>
      ${backups.length ? backups.map(b => `
        <div class="backup-item">
          <div class="bkp-ic">📦</div>
          <div class="bkp-info">
            <b>${esc(b.id)}</b>
            <small>${fmtDataHora(b.criadoEm)} · ${fmtTamanho(b.tamanho || 0)} · por @${esc(b.criadoPor || 'sistema')}</small>
          </div>
          <div class="bkp-actions">
            <a class="admin-btn ghost" href="/api/backup?action=download&id=${encodeURIComponent(b.id)}" download>⬇️ Baixar</a>
            <button class="admin-btn ghost" onclick="restaurarBackup('${esc(b.id)}')">♻️ Restaurar</button>
            <button class="admin-btn perigo" onclick="apagarBackup('${esc(b.id)}')">🗑️</button>
          </div>
        </div>`).join('')
        : '<div class="logs-empty"><b>Nenhum backup ainda</b>Clica em "Criar backup agora" pra começar.</div>'}
      <div class="admin-actions">
        <button class="admin-btn" onclick="criarBackupManual()">➕ Criar backup agora</button>
        <button class="admin-btn ghost" onclick="renderAdminBackup()">🔄 Atualizar</button>
      </div>
    </div>`;
}
window.renderAdminBackup = renderAdminBackup;

async function criarBackupManual(){
  try{
    toast('Criando backup…', 'info');
    const r = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast('Backup criado! ✅', 'ok');
    await renderAdminBackup();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.criarBackupManual = criarBackupManual;

async function restaurarBackup(id){
  const ok = await confirmar('Restaurar backup?', 'TODOS os dados atuais serão substituídos pelos dados desse backup. Essa ação não volta.', '⚠️');
  if(!ok) return;
  try{
    const r = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', id })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast(`✅ Restaurado (${d.total} chaves)`, 'ok');
    await carregarBiblioteca();
    await carregarConfigPublica();
    await carregarVotosApi();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.restaurarBackup = restaurarBackup;

async function apagarBackup(id){
  const ok = await confirmar('Apagar backup?', 'O arquivo sai do histórico. Essa ação não volta.', '🗑️');
  if(!ok) return;
  try{
    const r = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    });
    if(!r.ok) throw new Error('Falha');
    toast('Backup apagado ✅', 'ok');
    await renderAdminBackup();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.apagarBackup = apagarBackup;