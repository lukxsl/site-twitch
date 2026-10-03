/* ============================================================
   PAINEL ADMIN — depende de app.js (mesmo escopo global)
   ============================================================ */
function adminIrPara(pagina){
  ADMIN_PAGE = pagina;
  localStorage.setItem('admin:page', pagina);
  carregarAdmin();
}
function adminIrAba(aba){ ADMIN_TAB = aba; localStorage.setItem('admin:tab', aba); renderAdminVotacao(); }
function adminIrTierTab(tab){ ADMIN_TIER_TAB = tab; localStorage.setItem('admin:tierTab', tab); renderAdminTierList(); }
window.adminIrPara = adminIrPara;
window.adminIrAba = adminIrAba;
window.adminIrTierTab = adminIrTierTab;

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

async function carregarAdmin(){
  const area = $('adminArea'); if(!area) return;
  const sub = $('adminSub');
  if(USUARIO === null){
    area.innerHTML = `<p class="admin-vazio">Verificando login…</p>`;
    await checarLogin();
  }
  if(!USUARIO || !USUARIO.admin){
    if(sub) sub.textContent = 'Acesso restrito.';
    area.innerHTML = `<div class="admin-vazio">
      <b>🔒 Acesso restrito</b>
      Só administradores do site podem ver esta área.
      ${!USUARIO ? '<br><a href="/api/auth?action=login">Entrar com Discord</a>' : ''}
    </div>`;
    return;
  }
  ADMIN_PAGE = localStorage.getItem('admin:page') || 'home';
  ADMIN_TAB = localStorage.getItem('admin:tab') || 'votos';
  ADMIN_TIER_TAB = localStorage.getItem('admin:tierTab') || 'jogos';

  if(sub){
    sub.textContent = ADMIN_PAGE === 'home' ? 'Gerencie tudo do site pelo painel.'
                    : ADMIN_PAGE === 'votacao' ? 'Votos e opções da votação.'
                    : ADMIN_PAGE === 'tierlist' ? 'Editar jogos e filmes.'
                    : ADMIN_PAGE === 'admins' ? 'Quem pode acessar o painel.'
                    : ADMIN_PAGE === 'banidos' ? 'Quem não pode votar.'
                    : ADMIN_PAGE === 'config' ? 'Aviso, doação, recado, horas e manutenção.'
                    : ADMIN_PAGE === 'logs' ? 'Histórico de ações.'
                    : ADMIN_PAGE === 'backup' ? 'Backup e restauração.'
                    : '';
  }
  if(ADMIN_PAGE === 'home') renderAdminHome();
  else if(ADMIN_PAGE === 'votacao') await carregarAdminVotacao();
  else if(ADMIN_PAGE === 'tierlist') await carregarAdminTierList();
  else if(ADMIN_PAGE === 'admins') renderAdminAdmins();
  else if(ADMIN_PAGE === 'banidos') await renderAdminBanidos();
  else if(ADMIN_PAGE === 'config') await renderAdminConfig();
  else if(ADMIN_PAGE === 'logs') await renderAdminLogs();
  else if(ADMIN_PAGE === 'backup') await renderAdminBackup();
}
window.carregarAdmin = carregarAdmin;

function cardAdmin(ic, titulo, desc, pagina){
  return `<button class="admin-menu-card" onclick="adminIrPara('${pagina}')">
    <span class="ic">${ic}</span><h3>${titulo}</h3>
    <p>${desc}</p><span class="cta">Abrir →</span>
  </button>`;
}

function renderAdminHome(){
  const area = $('adminArea'); if(!area) return;
  const cards = [];
  if(temPerm('ver_votos')) cards.push(cardAdmin('🗳️','Votação',
    `Ver quem votou${temPerm('editar_opcoes') ? ', editar opções' : ''}${temPerm('resetar_votos') ? ' e resetar' : ''}.`,
    'votacao'));
  if(temPerm('ver_tierlist')) cards.push(cardAdmin('🎮','Tier List',
    temPerm('editar_tierlist') ? 'Adicionar, editar, remover e apagar em massa.' : 'Ver os itens da tier list.',
    'tierlist'));
  if(temPerm('ver_banidos')) cards.push(cardAdmin('🚫','Banidos',
    temPerm('editar_banidos') ? 'Gerenciar quem não pode votar.' : 'Ver quem não pode votar.',
    'banidos'));
  if(temPerm('ver_admins')) cards.push(cardAdmin('👥','Admins',
    temPerm('editar_admins') ? 'Gerenciar quem tem acesso.' : 'Ver quem tem acesso.',
    'admins'));
  if(temPerm('ver_config')) cards.push(cardAdmin('⚙️','Config geral',
    'Aviso, doação, recado, horas, top 3 e hall.',
    'config'));
  if(temPerm('ver_logs')) cards.push(cardAdmin('📋','Logs','Histórico do que foi feito no painel.','logs'));
  if(temPerm('editar_config')) cards.push(cardAdmin('💾','Backup','Criar, baixar e restaurar backups do site.','backup'));
  area.innerHTML = `<div class="admin-menu">${cards.join('') || '<p class="admin-vazio">Você não tem permissão pra nenhuma seção.</p>'}</div>`;
}

function adminVoltarHTML(titulo){
  return `<div class="admin-top"><button class="admin-voltar" onclick="adminIrPara('home')">← Voltar</button><h2>${titulo}</h2></div>`;
}

/* ---------- VOTAÇÃO ADMIN ---------- */
async function carregarAdminVotacao(){
  const area = $('adminArea'); if(!area) return;
  area.innerHTML = adminVoltarHTML('🗳️ Votação') + `<p class="admin-vazio">Carregando dados…</p>`;
  try{
    const r = await fetch('/api/admin?action=votos');
    if(!r.ok) throw new Error('Falha ao carregar (' + r.status + ')');
    ADMIN_DADOS = await r.json();
  }catch(e){
    area.innerHTML = adminVoltarHTML('🗳️ Votação') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
    return;
  }
  ADMIN_TAB = localStorage.getItem('admin:tab') || 'votos';
  renderAdminVotacao();
}
window.carregarAdminVotacao = carregarAdminVotacao;

function renderAdminVotacao(){
  const area = $('adminArea'); if(!area) return;
  if(!ADMIN_DADOS){ area.innerHTML = adminVoltarHTML('🗳️ Votação') + `<div class="admin-vazio">Sem dados</div>`; return; }
  const { usuarios = [], contagem = {}, config } = ADMIN_DADOS;
  const totalVotos = Object.values(contagem).reduce((a,b)=>a+b,0);
  const mapaOpcao = {};
  (config || []).forEach(o => { mapaOpcao[o.id] = o; });
  const podeEditar = temPerm('editar_opcoes');
  const podeResetar = temPerm('resetar_votos');
  area.innerHTML = adminVoltarHTML('🗳️ Votação') + `
    <div class="admin-tabs">
      <button class="${ADMIN_TAB === 'votos' ? 'on' : ''}" onclick="adminIrAba('votos')">Votos (${totalVotos})</button>
      ${podeEditar ? `<button class="${ADMIN_TAB === 'opcoes' ? 'on' : ''}" onclick="adminIrAba('opcoes')">Opções</button>` : ''}
    </div>
    <div id="adminConteudo"></div>
  `;
  if(ADMIN_TAB === 'votos') renderAdminVotos(usuarios, mapaOpcao, podeResetar);
  else if(podeEditar) renderAdminOpcoes(config || [], contagem);
}

function renderAdminVotos(usuarios, mapaOpcao, podeResetar){
  const el = $('adminConteudo'); if(!el) return;
  if(!usuarios.length){
    el.innerHTML = `<div class="admin-card"><h3>🗳️ Votos</h3><p class="admin-vazio" style="padding:20px">Nenhum voto ainda</p><div class="admin-actions"><button class="admin-btn ghost" onclick="carregarAdminVotacao()">🔄 Atualizar</button></div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="admin-card">
      <h3>🗳️ Votos <span class="cont">Total: ${usuarios.length}</span></h3>
      <div class="admin-votos">
        ${usuarios.map(u => {
          const op = mapaOpcao[u.opcao];
          const nomeOpcao = op ? op.nome : u.opcao;
          const temDados = u.username;
          return `
            <div class="admin-voto">
              ${temDados && u.avatar
                ? `<img class="admin-voto-avatar" src="${esc(u.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'admin-voto-ph',textContent:'👤'}))">`
                : '<div class="admin-voto-ph">👤</div>'}
              <div class="admin-voto-info">
                <b>${temDados ? '@' + esc(u.username) : 'Sem dados de nick'}</b>
                <small>${esc(u.userId)}</small>
              </div>
              <div class="admin-voto-opcao">
                <b>${esc(nomeOpcao)}</b>
                <small>${u.ts ? tempoAtras(new Date(u.ts).toISOString()) : 'voto antigo'}</small>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="admin-actions">
        <button class="admin-btn ghost" onclick="carregarAdminVotacao()">🔄 Atualizar</button>
        ${podeResetar ? `<button class="admin-btn perigo" onclick="resetarVotacao()">🗑️ Resetar votação</button>` : ''}
      </div>
    </div>`;
}

function renderAdminOpcoes(opcoes, contagem){
  const el = $('adminConteudo'); if(!el) return;
  const lista = opcoes.length ? opcoes : [];
  el.innerHTML = `
    <div class="admin-card">
      <h3>🎯 Opções da votação</h3>
      <div id="adminOpcoes">
        ${lista.map((o,i) => `
          <div class="admin-item">
            ${o.capa ? `<img src="${esc(o.capa)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph3',textContent:'🎮'}))">` : '<div class="ph3">🎮</div>'}
            <div class="admin-item-info">
              <b>${esc(o.nome)}</b>
              <small>${o.tipo === 'filme' ? '🎬 Filme' : '🎮 Jogo'} · ${contagem[o.id] || 0} voto${(contagem[o.id]||0) === 1 ? '' : 's'}</small>
            </div>
            <button class="btn-mini" onclick="editarOpcao(${i})">Editar</button>
          </div>`).join('') || '<p class="admin-vazio" style="padding:20px">Nenhuma opção</p>'}
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
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.resetarVotacao = resetarVotacao;

function editarOpcao(i){
  const opcoes = (ADMIN_DADOS.config || []).slice();
  while(opcoes.length < 3) opcoes.push({ id:'', nome:'', tipo:'jogo', capa:null });
  const o = opcoes[i] || { nome:'', tipo:'jogo' };
  $('dTitle').textContent = 'Editar opção ' + (i+1);
  $('dBody').innerHTML = `
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
  dlg.showModal();
}
window.editarOpcao = editarOpcao;

function adicionarOpcao(){
  const opcoes = (ADMIN_DADOS.config || []).slice();
  opcoes.push({ id:'', nome:'', tipo:'jogo', capa:null });
  const i = opcoes.length - 1;
  $('dTitle').textContent = 'Nova opção';
  $('dBody').innerHTML = `
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
  dlg.showModal();
}
window.adicionarOpcao = adicionarOpcao;

async function buscarCapaOpcao(){
  const nome = $('editNome').value.trim();
  if(!nome) return;
  const tipo = $('editTipo').value;
  const status = $('buscaOpcaoStatus');
  status.textContent = '🔎 Buscando…';
  try{
    const action = tipo === 'filme' ? 'buscar-filme' : 'buscar-jogo';
    const r = await fetch(`/api/admin?action=${action}&nome=${encodeURIComponent(nome)}`);
    const d = await r.json();
    if(d.erro){ status.textContent = '⚠️ ' + d.erro; return; }
    if(d.capa){
      $('editCapa').value = d.capa;
      const p = $('editCapaPreview'); p.src = d.capa; p.style.display = 'block';
    }
    status.textContent = '✅ Capa encontrada!';
    setTimeout(() => { status.textContent = ''; }, 3000);
  }catch(e){ status.textContent = '⚠️ Erro na busca'; }
}
window.buscarCapaOpcao = buscarCapaOpcao;

async function salvarOpcao(i, ehNovo){
  const nome = $('editNome').value.trim();
  const tipo = $('editTipo').value;
  const capa = $('editCapa').value.trim();
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
    dlg.close();
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

/* ---------- TIER LIST ADMIN ---------- */
async function carregarAdminTierList(){
  const area = $('adminArea'); if(!area) return;
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
  const area = $('adminArea'); if(!area) return;
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
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.ativarMultiSel = ativarMultiSel;
window.cancelarMultiSel = cancelarMultiSel;
window.toggleSelItem = toggleSelItem;
window.toggleSelTodos = toggleSelTodos;
window.apagarSelecionados = apagarSelecionados;

async function importarSteam(){
  const btn = $('btnImportarSteam');
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
  $('dTitle').textContent = (ehNovo ? 'Adicionar ' : 'Editar ') + (tipo === 'jogos' ? 'jogo' : 'filme');
  $('dBody').innerHTML = `
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
              ${it.appid ? `<button type="button" class="btn-mini" id="btnConqAuto" onclick="buscarConquistasAuto(${it.appid})" style="font-size:.65rem;padding:3px 8px;border:1px solid var(--line);background:transparent;color:var(--purple-light);border-radius:6px;cursor:pointer">🏆 Buscar</button>` : ''}
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
        <button class="admin-btn ghost" onclick="dlg.close()">Cancelar</button>
        <button class="admin-btn" onclick="salvarItemTier(${i})">${ehNovo ? 'Adicionar' : 'Salvar'}</button>
      </div>
    </div>`;
  dlg.showModal();
}
function adicionarItemTier(){ abrirModalItemTier(-1); }
function editarItemTier(i){ abrirModalItemTier(i); }
window.adicionarItemTier = adicionarItemTier;
window.editarItemTier = editarItemTier;

async function buscarItemAuto(){
  const nome = $('itemNome').value.trim();
  if(!nome) return;
  const status = $('buscaStatus');
  const tipo = ADMIN_TIER_TAB;
  status.textContent = '🔎 Buscando…';
  try{
    const action = tipo === 'jogos' ? 'buscar-jogo' : 'buscar-filme';
    const r = await fetch(`/api/admin?action=${action}&nome=${encodeURIComponent(nome)}`);
    const d = await r.json();
    if(d.erro){ status.textContent = '⚠️ ' + d.erro; return; }
    if(d.nome) $('itemNome').value = d.nome;
    if(d.capa) { $('itemCapa').value = d.capa; const p = $('itemCapaPreview'); p.src = d.capa; p.style.display = 'block'; }
    if(d.nota && !$('itemNota').value) $('itemNota').value = d.nota;
    if(tipo === 'jogos'){
      if(d.sinopse && !$('itemComentario').value) $('itemComentario').value = d.sinopse;
    } else {
      if(d.duracao && !$('itemDuracao').value) $('itemDuracao').value = d.duracao;
      if(d.ano && !$('itemAno').value) $('itemAno').value = d.ano;
      if(d.sinopse && !$('itemComentario').value) $('itemComentario').value = d.sinopse;
    }
    status.textContent = '✅ Dados encontrados!';
    setTimeout(() => { status.textContent = ''; }, 3000);
  }catch(e){ status.textContent = '⚠️ Erro na busca'; }
}
window.buscarItemAuto = buscarItemAuto;

async function buscarConquistasAuto(appid){
  if(!appid) return;
  const btn = $('btnConqAuto');
  if(btn){ btn.disabled = true; btn.textContent = '⏳'; }
  try{
    const r = await fetch(`/api/admin?action=buscar-conquistas&appid=${appid}`);
    const d = await r.json();
    if(d.erro){ toast('⚠️ ' + d.erro, 'warn'); }
    else if(d.total){
      $('itemConqObt').value = d.obtidas;
      $('itemConqTot').value = d.total;
      toast(`🏆 ${d.obtidas}/${d.total} conquistas`, 'ok');
    } else { toast('Sem conquistas nesse jogo', 'warn'); }
  }catch(e){ toast('Erro ao buscar conquistas', 'erro'); }
  finally { if(btn){ btn.disabled = false; btn.textContent = '🏆 Buscar'; } }
}
window.buscarConquistasAuto = buscarConquistasAuto;

async function traduzirComentario(){
  const ta = $('itemComentario');
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
  const nome = $('itemNome').value.trim();
  if(!nome){ toast('Digite um nome!', 'warn'); return; }
  const anterior = i >= 0 ? ADMIN_TIER[tipo][i] : {};
  const item = {
    id: anterior.id || nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-').slice(0,40),
    nome, tier: $('itemTier').value, status: $('itemStatus').value,
    nota: Number($('itemNota').value) || 0,
    capa: $('itemCapa').value.trim() || null,
    comentario: $('itemComentario').value.trim(),
    appid: anterior.appid || null,
    adicionadoEm: anterior.adicionadoEm || new Date().toISOString()
  };
  if(tipo === 'jogos'){
    item.horas = Number($('itemHoras').value) || 0;
    const o = Number($('itemConqObt').value) || 0;
    const t = Number($('itemConqTot').value) || 0;
    item.conquistas = (o || t) ? { obtidas: o, total: t } : null;
  } else {
    item.duracao = Number($('itemDuracao').value) || null;
    item.ano = Number($('itemAno').value) || null;
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
    dlg.close();
    toast('Salvo! ✅', 'ok');
    await carregarAdminTierList();
    await carregarBiblioteca();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}

/* ---------- ADMINS ---------- */
async function renderAdminAdmins(){
  const area = $('adminArea'); if(!area) return;
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
            ${podeEditar ? `<button class="btn-mini" onclick="editarAdmin('${a.id}','${esc(a.username||'')}','${esc(a.avatar||'')}','${a.cargo}')">Editar</button>` : ''}
            ${podeEditar ? `<button class="btn-mini danger" onclick="removerAdmin('${a.id}')">Remover</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
  const podeEditarPerms = temPerm('editar_config');
  area.innerHTML = adminVoltarHTML('👥 Admins') + `
    <div class="admin-card">
      <h3>👥 Administradores <span class="cont">${(dados.admins||[]).length}</span></h3>
      ${dados.admins && dados.admins.length ? `<div class="admin-votos">${adminsHTML}</div>`
        : '<p class="admin-vazio" style="padding:20px">Nenhum admin cadastrado</p>'}
      <div class="admin-actions">
        ${podeGerenciar ? `<button class="admin-btn" onclick="adicionarAdmin()">+ Adicionar admin</button>` : ''}
        <button class="admin-btn ghost" onclick="renderAdminAdmins()">🔄 Atualizar</button>
      </div>
    </div>
    <div class="admin-card">
      <h3>📋 Cargos e permissões</h3>
      <table class="cmds-table" style="font-size:.82rem">
        <thead><tr><th>Cargo</th><th>Pode fazer</th></tr></thead>
        <tbody>
          <tr><td>🛠️ Dev</td><td style="color:var(--mute)">Tudo, incluindo gerenciar Devs</td></tr>
          <tr><td>👑 Dono</td><td style="color:var(--mute)">Tudo, menos mexer em Devs</td></tr>
          <tr><td>🛡️ Administrador</td><td style="color:var(--mute)">Votação, Tier List, banir, ver admins</td></tr>
          <tr><td>🔰 Moderador</td><td style="color:var(--mute)">Ver votos, tier list, banidos</td></tr>
        </tbody>
      </table>
    </div>
    ${podeEditarPerms ? `
    <div class="admin-card">
      <h3>🔐 Permissões por cargo</h3>
      <p style="color:var(--mute);font-size:.82rem;margin-bottom:12px">
        Marque o que cada cargo pode fazer. O cargo <b>Dev</b> sempre tem acesso total.
      </p>
      <div class="perms-grid" id="permsGrid">
        <p class="admin-vazio">Carregando…</p>
      </div>
      <div class="admin-actions">
        <button class="admin-btn" onclick="salvarPermissoes()">💾 Salvar permissões</button>
        <button class="admin-btn ghost" onclick="carregarPermissoes()">🔄 Recarregar</button>
        <button class="admin-btn ghost" onclick="restaurarPermissoesPadrao()">♻️ Restaurar padrão</button>
      </div>
    </div>` : ''}`;
  if(podeEditarPerms) carregarPermissoes();
}
window.renderAdminAdmins = renderAdminAdmins;

/* ====== UI de permissões ====== */
async function carregarPermissoes(){
  const grid = $('permsGrid'); if(!grid) return;
  grid.innerHTML = '<p class="admin-vazio">Carregando…</p>';
  try{
    const r = await fetch('/api/admin?action=permissoes-get');
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    PERMS_DADOS = d.permissoes;
    PERMS_LABELS = d.labels || {};
    renderPermissoes();
  }catch(e){
    grid.innerHTML = `<p class="admin-vazio">Erro: ${esc(e.message)}</p>`;
  }
}
window.carregarPermissoes = carregarPermissoes;

function renderPermissoes(){
  const grid = $('permsGrid'); if(!grid || !PERMS_DADOS) return;
  grid.innerHTML = CARGOS_ORDEM.map(cargo => {
    const isDev = cargo === 'dev';
    const perms = PERMS_DADOS[cargo] || [];
    const icone = LABEL_CARGO[cargo].split(' ')[0];
    const nomeCargo = LABEL_CARGO[cargo].split(' ').slice(1).join(' ');
    return `
      <div class="perm-cargo">
        <div class="perm-cargo-head">
          <span class="pc-ic">${icone}</span>
          <b>${nomeCargo}</b>
          <small>${isDev ? 'acesso total' : 'customizável'}</small>
        </div>
        ${Object.entries(PERM_GRUPOS).map(([grupo, lista]) => `
          <div class="perm-grupo">
            <span class="perm-grupo-titulo">${grupo}</span>
            ${lista.map(p => isDev
              ? `<div class="perm-fixo"><input type="checkbox" checked disabled><span>${PERMS_LABELS[p] || p}</span><span class="perm-fixo-lock">fixo</span></div>`
              : `<label class="perm-item"><input type="checkbox" data-cargo="${cargo}" data-perm="${p}" ${perms.includes(p) ? 'checked' : ''}><span>${PERMS_LABELS[p] || p}</span></label>`
            ).join('')}
          </div>
        `).join('')}
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
  document.querySelectorAll('#permsGrid input[type="checkbox"]').forEach(cb => {
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
  $('dTitle').textContent = 'Editar admin';
  $('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID do Discord</label><input type="text" value="${esc(id)}" disabled></div>
      <div><label>Nick</label><input type="text" value="${esc(username)}" disabled></div>
      <div><label>Cargo</label>
        <select id="editAdminCargo" style="width:100%;background:#1a102d;border:1px solid var(--line);border-radius:8px;padding:9px 12px;color:var(--ink);font-family:inherit;font-size:.85rem">
          <option value="dev" ${cargoAtual==='dev'?'selected':''}>🛠️ Dev</option>
          <option value="dono" ${cargoAtual==='dono'?'selected':''}>👑 Dono</option>
          <option value="administrador" ${cargoAtual==='administrador'?'selected':''}>🛡️ Administrador</option>
          <option value="moderador" ${cargoAtual==='moderador'?'selected':''}>🔰 Moderador</option>
        </select>
      </div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn" onclick="salvarAdmin('${id}','${esc(username)}','${esc(avatar)}')">Salvar</button>
      </div>
    </div>`;
  dlg.showModal();
}
window.editarAdmin = editarAdmin;

async function salvarAdmin(id, username, avatar){
  const cargo = $('editAdminCargo').value;
  try{
    const r = await fetch('/api/admin?action=admins-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, cargo, username, avatar })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    dlg.close();
    toast('Salvo! ✅', 'ok');
    await renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarAdmin = salvarAdmin;

function adicionarAdmin(){
  $('dTitle').textContent = 'Adicionar admin';
  $('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID do Discord</label><input id="novoAdminId" type="text" placeholder="123456789012345678"></div>
      <div><label>Cargo</label>
        <select id="novoAdminCargo" style="width:100%;background:#1a102d;border:1px solid var(--line);border-radius:8px;padding:9px 12px;color:var(--ink);font-family:inherit;font-size:.85rem">
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
  dlg.showModal();
}
window.adicionarAdmin = adicionarAdmin;

async function salvarNovoAdmin(){
  const userId = $('novoAdminId').value.trim();
  const cargo = $('novoAdminCargo').value;
  if(!userId){ toast('Digite o ID', 'warn'); return; }
  try{
    const r = await fetch('/api/admin?action=admins-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, cargo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    dlg.close();
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

/* ---------- BANIDOS ---------- */
async function renderAdminBanidos(){
  const area = $('adminArea'); if(!area) return;
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
            ${podeGerenciar ? `<button class="btn-mini danger" style="margin-top:6px" onclick="removerBanido('${b.id}')">Desbanir</button>` : ''}
          </div>
        </div>`).join('')}</div>` : '<p class="admin-vazio" style="padding:20px">Ninguém banido</p>'}
      <div class="admin-actions">
        ${podeGerenciar ? `<button class="admin-btn" onclick="adicionarBanido()">+ Banir usuário</button>` : ''}
        <button class="admin-btn ghost" onclick="renderAdminBanidos()">🔄 Atualizar</button>
      </div>
    </div>`;
}
window.renderAdminBanidos = renderAdminBanidos;

function adicionarBanido(){
  $('dTitle').textContent = 'Banir usuário';
  $('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID do Discord</label><input id="banirId" type="text" placeholder="123456789012345678"></div>
      <div><label>Motivo (opcional)</label><input id="banirMotivo" type="text" placeholder="Ex: votou com multis"></div>
      <div class="admin-actions" style="justify-content:flex-end">
        <button class="admin-btn perigo" onclick="salvarBanido()">Banir</button>
      </div>
    </div>`;
  dlg.showModal();
}
window.adicionarBanido = adicionarBanido;

async function salvarBanido(){
  const userId = $('banirId').value.trim();
  const motivo = $('banirMotivo').value.trim();
  if(!userId){ toast('Digite o ID', 'warn'); return; }
  try{
    const r = await fetch('/api/admin?action=banidos-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, motivo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    dlg.close();
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

/* ---------- CONFIG (com top3 + hall) ---------- */
async function renderAdminConfig(){
  const area = $('adminArea'); if(!area) return;
  area.innerHTML = adminVoltarHTML('⚙️ Config geral') + `<p class="admin-vazio">Carregando…</p>`;
  try {
    const r = await fetch('/api/admin?action=config-get', { cache:'no-store' });
    const d = await r.json();
    const av = d.aviso || { ativo: false, tipo: 'info', icone: '📢', titulo: 'Aviso', texto: '' };
    const top3Txt = (d.top3 || []).map(p => `${p.nome}${p.valor ? ' | ' + p.valor : ''}`).join('\n');
    const hallTxt = (d.hall || []).map(p => `${p.nome}${p.meta ? ' | ' + p.meta : ''}`).join('\n');
    area.innerHTML = adminVoltarHTML('⚙️ Config geral') + `
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
        </div>
      </div>
      <div class="admin-card">
        <h3>💜 Link de doação</h3>
        <div class="admin-form">
          <div><label>URL</label><input id="cfgDonate" type="text" value="${esc(d.donate || CONFIG.donate || '')}"></div>
        </div>
      </div>
      <div class="admin-card">
        <h3>💬 Recado da Soso</h3>
        <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Aparece na home, dentro do card "Apoie o cantinho".</p>
        <div class="admin-form">
          <div><label>Texto do recado</label><textarea id="cfgRecado" rows="3" placeholder="Ex: Essa semana tem live de terror! 💜">${esc(d.recado || '')}</textarea></div>
        </div>
      </div>
      <div class="admin-card">
        <h3>📺 Horas do mês</h3>
        <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">
          Se preencher aqui, esse valor sobrescreve o cálculo automático da Twitch. Se deixar vazio, o site usa as horas calculadas pela Twitch.
        </p>
        <div class="admin-form">
          <div><label>Horas (texto livre — deixe vazio pra usar Twitch)</label><input id="cfgHorasMes" type="text" placeholder="Ex: 32h" value="${esc(d.horasMes || '')}"></div>
        </div>
      </div>
      <div class="admin-card">
        <h3>🏆 Top 3 apoiadores</h3>
        <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Um por linha, formato: <code>Nome | valor</code>. Ex: <code>lukxsl | R$ 250</code></p>
        <div class="admin-form">
          <div><label>Linhas (até 3)</label><textarea id="cfgTop3" rows="4" placeholder="lukxsl | R$ 250&#10;mari | R$ 180">${esc(top3Txt)}</textarea></div>
        </div>
      </div>
      <div class="admin-card">
        <h3>👑 Hall da fama · maiores subs</h3>
        <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Um por linha, formato: <code>Nome | tempo</code>. Ex: <code>gabizinha | 14 meses</code></p>
        <div class="admin-form">
          <div><label>Linhas (até 5)</label><textarea id="cfgHall" rows="6" placeholder="gabizinha | 14 meses&#10;pedrinho | 11 meses">${esc(hallTxt)}</textarea></div>
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
      <div class="admin-actions">
        <button class="admin-btn" onclick="salvarConfig()">💾 Salvar tudo</button>
        <button class="admin-btn ghost" onclick="renderAdminConfig()">🔄 Recarregar</button>
      </div>`;
  } catch(e){
    area.innerHTML = adminVoltarHTML('⚙️ Config geral') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
  }
}
window.renderAdminConfig = renderAdminConfig;

async function salvarConfig(){
  const aviso = {
    ativo: $('cfgAvisoAtivo').checked,
    tipo: $('cfgAvisoTipo').value,
    icone: $('cfgAvisoIcone').value.trim() || '📢',
    titulo: $('cfgAvisoTitulo').value.trim() || 'Aviso',
    texto: $('cfgAvisoTexto').value.trim()
  };
  const donate = $('cfgDonate').value.trim();
  const recado = $('cfgRecado').value.trim();
  const horasMes = $('cfgHorasMes').value.trim();
  const manutencao = $('cfgManutencao').checked;

  const top3 = ($('cfgTop3').value || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0,3)
    .map(l => {
      const [nome, ...resto] = l.split('|').map(s => s.trim());
      return { nome: nome || '—', valor: resto.join(' ').trim() || null };
    });

  const hall = ($('cfgHall').value || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0,5)
    .map(l => {
      const [nome, ...resto] = l.split('|').map(s => s.trim());
      return { nome: nome || '—', meta: resto.join(' ').trim() || null };
    });

  try{
    const r = await fetch('/api/admin?action=config-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aviso, donate, manutencao, recado, horasMes, top3, hall })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    CONFIG_GERAL = { ...CONFIG_GERAL, aviso, donate, manutencao, recado, horasMes, top3, hall, updatedAt: d.updatedAt || new Date().toISOString() };
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

/* ---------- LOGS ---------- */
async function renderAdminLogs(){
  const area = $('adminArea'); if(!area) return;
  area.innerHTML = adminVoltarHTML('📋 Logs') + `<p class="admin-vazio">Carregando…</p>`;
  try {
    const r = await fetch('/api/admin?action=logs-ver');
    const d = await r.json();
    const logs = d.logs || [];
    area.innerHTML = adminVoltarHTML('📋 Logs') + `
      <div class="admin-card">
        <h3>📋 Últimas ações <span class="cont">${logs.length}</span></h3>
        ${logs.length ? `<div class="admin-votos">${logs.map(l => `
          <div class="admin-voto">
            <div class="admin-voto-ph">${LABEL_CARGO[l.cargo] ? LABEL_CARGO[l.cargo].split(' ')[0] : '👤'}</div>
            <div class="admin-voto-info">
              <b>@${esc(l.quem || 'alguém')}</b>
              <small>${esc(l.acao || '')}</small>
            </div>
            <div class="admin-voto-opcao"><small>${l.ts ? tempoAtras(new Date(l.ts).toISOString()) : ''}</small></div>
          </div>`).join('')}</div>` : '<p class="admin-vazio" style="padding:20px">Nenhuma ação registrada</p>'}
        <div class="admin-actions">
          <button class="admin-btn ghost" onclick="renderAdminLogs()">🔄 Atualizar</button>
        </div>
      </div>`;
  } catch(e){
    area.innerHTML = adminVoltarHTML('📋 Logs') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
  }
}
window.renderAdminLogs = renderAdminLogs;

/* ---------- BACKUP ---------- */
async function renderAdminBackup(){
  const area = $('adminArea'); if(!area) return;
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
        </div>`).join('') : '<p class="admin-vazio" style="padding:20px">Nenhum backup ainda</p>'}
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
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.apagarBackup = apagarBackup;