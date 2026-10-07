/* ============================================================
   ADMIN — TABLES (Tierlist, Admins, Banidos, Logs, Backup, Sugestões)
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
  const area = document.getElementById('adminArea'); if(!area) return;
  const lista = ADMIN_TIER[ADMIN_TIER_TAB] || [];
  const podeEditar = temPerm('editar_tierlist');
  const podeImportar = temPerm('importar_steam');
  const botaoImport = (ADMIN_TIER_TAB === 'jogos' && podeImportar)
    ? `<button class="admin-btn" onclick="importarSteam()" id="btnImportarSteam">📥 Importar da Steam</button>` : '';
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
        ${lista.length ? lista.map(itemHTML).join('') : '<div class="logs-empty"><b>Nenhum item ainda</b>Adiciona o primeiro.</div>'}
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

function ativarMultiSel(){ ADMIN_MULTISEL = { ativo: true, ids: new Set() }; document.body.classList.add('admin-multisel'); renderAdminTierList(); }
function cancelarMultiSel(){ ADMIN_MULTISEL = { ativo: false, ids: new Set() }; document.body.classList.remove('admin-multisel'); renderAdminTierList(); }
function toggleSelItem(id){ if(ADMIN_MULTISEL.ids.has(id)) ADMIN_MULTISEL.ids.delete(id); else ADMIN_MULTISEL.ids.add(id); renderAdminTierList(); }
function toggleSelTodos(){
  const lista = ADMIN_TIER[ADMIN_TIER_TAB] || [];
  if(ADMIN_MULTISEL.ids.size === lista.length) ADMIN_MULTISEL.ids = new Set();
  else ADMIN_MULTISEL.ids = new Set(lista.map(it => it.id));
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
  const ok = await confirmar('Importar da Steam?', 'Vou buscar seus jogos na Steam e adicionar na tier list. Pode demorar um pouco.', '📥');
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
  const statusOpcoes = tipo === 'jogos' ? ['Jogando','Zerado','Dropado','Na fila'] : ['Assistindo','Assistido','Na fila'];
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
              ${it.appid ? `<button type="button" class="btn-mini" id="btnConqAuto" onclick="buscarConquistasAuto(${it.appid})">🏆 Buscar</button>` : ''}
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
   SUGESTÕES (admin)
   ============================================================ */
const MOTIVOS_RECUSA = [
  { id: 'ja_joguei',      label: '🎮 Já joguei esse' },
  { id: 'sem_verba',      label: '💸 Sem verba no momento' },
  { id: 'nao_curto',      label: '🚫 Não curto o gênero' },
  { id: 'nao_prioridade', label: '🕐 Não é prioridade agora' },
  { id: 'fora_momento',   label: '📅 Fora do momento' },
  { id: 'outro',          label: '✏️ Outro (escrever)' }
];

function _sugStatusInfo(item){
  const st = item.status || 'nova';
  const base = STATUS_SUG[st] || STATUS_SUG.nova;
  if(st === 'concluido'){
    const rotulo = ROTULO_CONCLUIDO[item.tipo] || base.label;
    return { ...base, label: rotulo };
  }
  return base;
}

function _sugTipoInfo(tipo){
  const t = String(tipo || '').toLowerCase();
  if(t.includes('bug')) return { ic: '🐛', label: 'Bug' };
  if(t.includes('jogo')) return { ic: '🎮', label: 'Jogo' };
  if(t.includes('feedback')) return { ic: '💬', label: 'Feedback' };
  return { ic: '💡', label: 'Sugestão' };
}

async function carregarAdminSugestoes(){
  const area = document.getElementById('adminArea'); if(!area) return;
  area.innerHTML = adminVoltarHTML('💡 Sugestões') + `<p class="admin-vazio">Carregando…</p>`;
  try{
    const r = await fetch('/api/admin?action=sugestoes-ver');
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    ADMIN_SHARED.sugestoes = d;
    renderAdminSugestoes();
  }catch(e){
    area.innerHTML = adminVoltarHTML('💡 Sugestões') + `<div class="admin-vazio"><b>Erro</b>${esc(e.message)}</div>`;
  }
}
window.carregarAdminSugestoes = carregarAdminSugestoes;

function renderAdminSugestoes(){
  const area = document.getElementById('adminArea'); if(!area) return;
  const itens = (ADMIN_SHARED.sugestoes && ADMIN_SHARED.sugestoes.itens) || [];
  const podeEditar = temPerm('editar_config');

  // Filtros
  const filtrados = itens.filter(i => {
    if(ADMIN_SUG_STATUS !== 'all' && (i.status || 'nova') !== ADMIN_SUG_STATUS) return false;
    if(ADMIN_SUG_TIPO !== 'all'){
      const t = _sugTipoInfo(i.tipo).label.toLowerCase();
      if(t !== ADMIN_SUG_TIPO) return false;
    }
    return true;
  });

  const contagem = { all: itens.length, nova: 0, analise: 0, aceita: 0, recusada: 0, concluido: 0 };
  itens.forEach(i => {
    const st = i.status || 'nova';
    if(contagem[st] !== undefined) contagem[st]++;
  });

  // Filtros por tipo disponíveis (só os que existem)
  const tiposDisponiveis = { all: true };
  itens.forEach(i => {
    const t = _sugTipoInfo(i.tipo).label.toLowerCase();
    tiposDisponiveis[t] = true;
  });

  const chipStatus = (id, label, count) => `
    <button type="button" class="sug-filter-chip ${ADMIN_SUG_STATUS === id ? 'on' : ''}"
            onclick="adminIrSugFiltro('${id}')">
      ${label}${count !== undefined ? ` <b>${count}</b>` : ''}
    </button>
  `;
  const chipTipo = (id, label) => `
    <button type="button" class="sug-filter-chip ${ADMIN_SUG_TIPO === id ? 'on' : ''}"
            onclick="ADMIN_SUG_TIPO='${id}';renderAdminSugestoes()">
      ${label}
    </button>
  `;

  const cardsHTML = filtrados.length ? filtrados.map(i => {
    const st = _sugStatusInfo(i);
    const ti = _sugTipoInfo(i.tipo);
    const motivoHTML = (i.status === 'recusada' && i.motivo)
      ? `<div class="sir-motivo" style="margin-top:8px">${esc(i.motivo)}</div>` : '';
    const metaInfo = [
      i.data ? tempoAtras(i.data) : null,
      i.atualizadoEm ? `atualizada ${tempoAtras(i.atualizadoEm)}` : null,
      i.atualizadoPor ? `por ${esc(i.atualizadoPor)}` : null
    ].filter(Boolean).join(' · ');

    const dropdown = podeEditar ? `
      <div class="sug-status-actions">
        <select class="sug-status-select" onchange="mudarStatusSug('${esc(i.id)}', this.value)">
          <option value="">Mudar status…</option>
          <option value="nova">🟡 Nova</option>
          <option value="analise">👀 Em análise</option>
          <option value="aceita">✅ Aceita</option>
          <option value="recusada">❌ Recusada</option>
          <option value="concluido">🏁 Concluído</option>
        </select>
        <button class="btn-mini danger" onclick="excluirSugestao('${esc(i.id)}')">🗑️</button>
      </div>` : '';

    return `
      <div class="admin-sug-card" data-status="${st.cor}">
        <div class="admin-sug-head">
          <span class="admin-sug-ic">${ti.ic}</span>
          <div class="admin-sug-tx">
            <div class="admin-sug-top">
              <b>@${esc(i.nome || 'anônimo')}</b>
              <span class="sir-status sir-status-${st.cor}">${st.label}</span>
              <span class="admin-sug-tipo">${ti.label}</span>
            </div>
            <small class="admin-sug-meta">${metaInfo}</small>
          </div>
        </div>
        <p class="admin-sug-texto">${esc(i.texto || '')}</p>
        ${motivoHTML}
        ${dropdown}
      </div>
    `;
  }).join('') : `<div class="logs-empty"><b>Nenhuma sugestão</b>Quando alguém enviar, aparece aqui.</div>`;

  area.innerHTML = adminVoltarHTML('💡 Sugestões') + `
    <div class="admin-card">
      <h3>💡 Sugestões <span class="cont">${itens.length}</span></h3>

      <div class="admin-sug-filters">
        <div class="admin-sug-filters-row">
          <span class="admin-sug-filter-label">Status:</span>
          ${chipStatus('all', 'Todas', contagem.all)}
          ${chipStatus('nova', '🟡 Novas', contagem.nova)}
          ${chipStatus('analise', '👀 Análise', contagem.analise)}
          ${chipStatus('aceita', '✅ Aceitas', contagem.aceita)}
          ${chipStatus('recusada', '❌ Recusadas', contagem.recusada)}
          ${chipStatus('concluido', '🏁 Concluídas', contagem.concluido)}
        </div>
        <div class="admin-sug-filters-row">
          <span class="admin-sug-filter-label">Tipo:</span>
          ${chipTipo('all', 'Todas')}
          ${tiposDisponiveis['sugestão'] ? chipTipo('sugestão', '💡 Sugestão') : ''}
          ${tiposDisponiveis['jogo'] ? chipTipo('jogo', '🎮 Jogo') : ''}
          ${tiposDisponiveis['feedback'] ? chipTipo('feedback', '💬 Feedback') : ''}
          ${tiposDisponiveis['bug'] ? chipTipo('bug', '🐛 Bug') : ''}
        </div>
      </div>

      <div class="admin-sug-list">
        ${cardsHTML}
      </div>

      <div class="admin-actions">
        <button class="admin-btn ghost" onclick="carregarAdminSugestoes()">🔄 Recarregar</button>
        ${podeEditar ? `
          <button class="admin-btn ghost" onclick="limparSugestoes('concluidas')">🧹 Limpar concluídas</button>
          <button class="admin-btn ghost" onclick="limparSugestoes('recusadas')">🧹 Limpar recusadas</button>
          <button class="admin-btn perigo" onclick="limparSugestoes('tudo')">🚨 Limpar TUDO</button>
        ` : ''}
      </div>
    </div>`;
}
window.renderAdminSugestoes = renderAdminSugestoes;

async function mudarStatusSug(id, novoStatus){
  if(!novoStatus) return;
  const itens = (ADMIN_SHARED.sugestoes && ADMIN_SHARED.sugestoes.itens) || [];
  const item = itens.find(i => i.id === id);
  if(!item) return;

  let motivo = null, motivoTipo = null;

  if(novoStatus === 'recusada'){
    // Modal de motivo
    const escolha = await _abrirModalMotivoRecusa();
    if(!escolha) return; // cancelou
    motivoTipo = escolha.tipo;
    motivo = escolha.motivo;
  }

  try{
    const r = await fetch('/api/admin?action=sugestoes-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: novoStatus, motivo, motivoTipo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast('Status atualizado! ✅', 'ok');
    await carregarAdminSugestoes();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.mudarStatusSug = mudarStatusSug;

function _abrirModalMotivoRecusa(){
  return new Promise(resolve => {
    const dlg = document.getElementById('dlg');
    const dhTitle = document.getElementById('dTitle');
    const dBody = document.getElementById('dBody');
    dhTitle.textContent = '❌ Motivo da recusa';

    const botoes = MOTIVOS_RECUSA.map(m =>
      `<button type="button" class="sug-motivo-btn" data-tipo="${esc(m.id)}">${m.label}</button>`
    ).join('');

    dBody.innerHTML = `
      <p style="color:var(--mute);font-size:.86rem;margin-bottom:10px">
        Escolhe um motivo. Isso ajuda a pessoa a entender o porquê.
      </p>
      <div class="sug-motivo-grid">${botoes}</div>
      <div id="sugMotivoCustomWrap" style="display:none;margin-top:12px">
        <label style="display:block;font-size:.72rem;font-weight:800;color:var(--mute);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Motivo</label>
        <input id="sugMotivoCustom" type="text" maxlength="200" placeholder="Escreve o motivo..."
               style="width:100%;background:rgba(26,16,45,.75);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);font-family:inherit;font-size:.88rem">
      </div>
      <div class="admin-actions" style="justify-content:flex-end;margin-top:16px">
        <button class="admin-btn ghost" id="sugMotivoCancel">Cancelar</button>
        <button class="admin-btn perigo" id="sugMotivoOk" disabled>Recusar</button>
      </div>
    `;

    let escolhidoTipo = null;
    const wrap = dBody.querySelector('#sugMotivoCustomWrap');
    const inputCustom = dBody.querySelector('#sugMotivoCustom');
    const btnOk = dBody.querySelector('#sugMotivoOk');
    const btnCancel = dBody.querySelector('#sugMotivoCancel');

    function atualizarOk(){
      const texto = inputCustom.value.trim();
      if(escolhidoTipo === 'outro') btnOk.disabled = texto.length < 3;
      else btnOk.disabled = !escolhidoTipo;
    }

    dBody.querySelectorAll('.sug-motivo-btn').forEach(b => {
      b.addEventListener('click', () => {
        dBody.querySelectorAll('.sug-motivo-btn').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        escolhidoTipo = b.dataset.tipo;
        if(escolhidoTipo === 'outro'){ wrap.style.display = ''; inputCustom.focus(); }
        else wrap.style.display = 'none';
        atualizarOk();
      });
    });
    inputCustom.addEventListener('input', atualizarOk);

    const fechar = (resultado) => {
      dlg.close();
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      dlg.removeEventListener('cancel', onCancel);
      resolve(resultado);
    };
    const onOk = () => {
      const motivoTxt = escolhidoTipo === 'outro'
        ? `✏️ ${inputCustom.value.trim()}`
        : (MOTIVOS_RECUSA.find(m => m.id === escolhidoTipo)?.label || 'Recusada');
      fechar({ tipo: escolhidoTipo, motivo: motivoTxt });
    };
    const onCancel = (e) => { if(e) e.preventDefault(); fechar(null); };

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    dlg.addEventListener('cancel', onCancel);
    dlg.showModal();
  });
}

async function excluirSugestao(id){
  const ok = await confirmar('Excluir sugestão?', 'Essa ideia some pra sempre. Não tem como desfazer.', '🗑️');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=sugestoes-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast('Sugestão excluída ✅', 'ok');
    await carregarAdminSugestoes();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.excluirSugestao = excluirSugestao;

async function limparSugestoes(modo){
  const config = {
    concluidas: { titulo: 'Limpar concluídas?', texto: 'Todas as sugestões 🏁 Concluído somem.', icone: '🧹' },
    recusadas:  { titulo: 'Limpar recusadas?',  texto: 'Todas as sugestões ❌ Recusadas somem.', icone: '🧹' },
    tudo:       { titulo: 'APAGAR TUDO?',       texto: 'TODAS as sugestões (novas, em análise, aceitas, recusadas e concluídas) serão apagadas. Essa ação não volta.', icone: '🚨' }
  }[modo];
  if(!config) return;

  const ok1 = await confirmar(config.titulo, config.texto, config.icone);
  if(!ok1) return;

  if(modo === 'tudo'){
    const ok2 = await confirmar('TEM CERTEZA MESMO?', 'Última chance. Não tem como recuperar.', '⚠️');
    if(!ok2) return;
  }

  try{
    const r = await fetch('/api/admin?action=sugestoes-limpar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast(`🧹 ${d.apagados} sugestões apagadas`, 'ok');
    await carregarAdminSugestoes();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.limparSugestoes = limparSugestoes;

/* ============================================================
   ADMINS
   ============================================================ */
async function renderAdminAdmins(){
  const area = document.getElementById('adminArea'); if(!area) return;
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
      ${dados.admins && dados.admins.length ? `<div class="admin-votos">${adminsHTML}</div>` : '<div class="logs-empty"><b>Nenhum admin cadastrado</b>Adiciona o primeiro.</div>'}
      <div class="admin-actions">
        ${podeGerenciar ? `<button class="admin-btn" onclick="adicionarAdmin()">+ Adicionar admin</button>` : ''}
        <button class="admin-btn ghost" onclick="renderAdminAdmins()">🔄 Atualizar</button>
      </div>
    </div>

    <div class="admin-card">
      <h3>🔐 Permissões por cargo</h3>
      <p style="color:var(--mute);font-size:.82rem;margin-bottom:14px">Clica num cargo pra ver/editar.</p>
      <div id="permsAccordion"></div>
      ${podeEditarPerms ? `
        <div class="admin-actions">
          <button class="admin-btn" onclick="salvarPermissoes()">💾 Salvar permissões</button>
          <button class="admin-btn ghost" onclick="carregarPermissoes()">🔄 Recarregar</button>
          <button class="admin-btn ghost" onclick="restaurarPermissoesPadrao()">♻️ Restaurar padrão</button>
        </div>` : ''}
    </div>`;
  if(podeEditarPerms) carregarPermissoes();
}
window.renderAdminAdmins = renderAdminAdmins;

document.addEventListener('click', e => {
  const editar = e.target.closest('[data-admin-editar]');
  if(editar){
    editarAdmin(editar.dataset.id, editar.dataset.nome, editar.dataset.avatar, editar.dataset.cargo);
    return;
  }
  const remover = e.target.closest('[data-admin-remover]');
  if(remover){ removerAdmin(remover.dataset.id); }
});

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
    const tag = isDev ? `<span class="aah-tag locked">🔒 total</span>`
      : (podeEditar ? `<span class="aah-tag">custom</span>` : `<span class="aah-tag">read-only</span>`);
    const body = `
      <div class="perms-compact">
        ${Object.entries(PERM_GRUPOS).map(([grupo, lista]) => `
          <div class="perm-compact-group">
            <span>${grupo}</span>
            ${lista.map(p => {
              if(isDev) return `<div class="perm-check fixed"><input type="checkbox" checked disabled><span>${PERMS_LABELS[p] || p}</span><span class="lock">fixo</span></div>`;
              if(!podeEditar) return `<div class="perm-check"><input type="checkbox" ${perms.includes(p) ? 'checked' : ''} disabled><span>${PERMS_LABELS[p] || p}</span></div>`;
              return `<label class="perm-check"><input type="checkbox" data-cargo="${cargo}" data-perm="${p}" ${perms.includes(p) ? 'checked' : ''}><span>${PERMS_LABELS[p] || p}</span></label>`;
            }).join('')}
          </div>
        `).join('')}
      </div>`;
    return `
      <div class="admin-accordion" data-cargo="${cargo}">
        <div class="admin-accordion-head" onclick="this.parentElement.classList.toggle('open')">
          <span class="aah-ic">${icone}</span>
          <span class="aah-tx"><b>${nomeCargo}</b><small>Clique pra ver</small></span>
          ${tag}<span class="aah-arrow">▶</span>
        </div>
        <div class="admin-accordion-body"><div class="aab-inner">${body}</div></div>
      </div>`;
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
    if(USUARIO && USUARIO.cargo) USUARIO.permissoes = PERMS_DADOS[USUARIO.cargo] || [];
    toast('Permissões salvas! ✅', 'ok');
    renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarPermissoes = salvarPermissoes;

async function restaurarPermissoesPadrao(){
  const ok = await confirmar('Restaurar padrão?', 'As permissões voltam ao padrão de fábrica.', '♻️');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=permissoes-get');
    const d = await r.json();
    if(!d.padrao) throw new Error('Padrão indisponível');
    const r2 = await fetch('/api/admin?action=permissoes-set', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ permissoes: d.padrao })
    });
    const d2 = await r2.json();
    if(!r2.ok) throw new Error(d2.error || 'Falha');
    PERMS_DADOS = d2.permissoes;
    if(USUARIO && USUARIO.cargo) USUARIO.permissoes = PERMS_DADOS[USUARIO.cargo] || [];
    toast('Permissões restauradas! ✅', 'ok');
    renderAdminAdmins();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.restaurarPermissoesPadrao = restaurarPermissoesPadrao;

function editarAdmin(id, username, avatar, cargoAtual){
  document.getElementById('dTitle').textContent = 'Editar admin';
  document.getElementById('dBody').innerHTML = `
    <div class="admin-form">
      <div><label>ID</label><input type="text" value="${esc(id)}" disabled></div>
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  const area = document.getElementById('adminArea'); if(!area) return;
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
          ${b.avatar ? `<img class="admin-voto-avatar" src="${esc(b.avatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'admin-voto-ph',textContent:'👤'}))">` : '<div class="admin-voto-ph">👤</div>'}
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id })
    });
    if(!r.ok) throw new Error('Falha');
    toast('Desbanido ✅', 'ok');
    await renderAdminBanidos();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.removerBanido = removerBanido;

/* ============================================================
   LOGS (mostra 20 por padrão + "carregar mais")
   ============================================================ */
const LOGS_STATE = { busca: '', periodo: 'all', tipo: 'all', limite: 20 };

function categoriaLog(acao){
  const a = (acao || '').toLowerCase();
  if(/resetou|resetar|votaç|voto|opç/.test(a))    return { ic:'🗳️', accent:'purple' };
  if(/tier|moveu|removeu|importou|editou item/.test(a)) return { ic:'🎮', accent:'amber'  };
  if(/sugest|sugeriu/.test(a))                     return { ic:'💡', accent:'amber'  };
  if(/admin/.test(a))                              return { ic:'👥', accent:'blue'   };
  if(/bani|desbaniu/.test(a))                      return { ic:'🚫', accent:'red'    };
  if(/config|manuten|aviso|recado|doaç/.test(a))   return { ic:'⚙️', accent:'green'  };
  if(/backup/.test(a))                             return { ic:'💾', accent:'cyan'   };
  return { ic:'📋', accent:'purple' };
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
  return logs.filter(l => {
    if(minTs && (l.ts || 0) < minTs) return false;
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
  const grupos = {}; const ordem = [];
  logs.forEach(l => {
    const d = new Date(l.ts); const dOnly = new Date(d); dOnly.setHours(0,0,0,0);
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
  const area = document.getElementById('adminArea'); if(!area) return;
  area.innerHTML = adminVoltarHTML('📋 Logs') + `<p class="admin-vazio">Carregando…</p>`;

  let logs = [];
  try {
    const r = await fetch('/api/admin?action=logs-ver');
    const d = await r.json();
    logs = d.logs || [];
  } catch(e){}

  if(!logs.length){
    area.innerHTML = adminVoltarHTML('📋 Logs') + `<div class="logs-empty"><b>Nenhuma ação registrada ainda</b>Quando alguém mexer no painel, aparece aqui.</div>`;
    return;
  }

  LOGS_STATE.limite = 20;

  area.innerHTML = adminVoltarHTML('📋 Logs') + `
    <div class="admin-card">
      <h3>📋 Histórico de ações</h3>
      <div class="logs-filters">
        <div class="logs-search"><input type="text" id="logsBusca" placeholder="Buscar por @admin ou ação..." value="${esc(LOGS_STATE.busca)}"></div>
        <select id="logsPeriodo">
          <option value="all" ${LOGS_STATE.periodo === 'all' ? 'selected' : ''}>Todo período</option>
          <option value="24h" ${LOGS_STATE.periodo === '24h' ? 'selected' : ''}>24h</option>
          <option value="7d"  ${LOGS_STATE.periodo === '7d'  ? 'selected' : ''}>7 dias</option>
          <option value="30d" ${LOGS_STATE.periodo === '30d' ? 'selected' : ''}>30 dias</option>
        </select>
      </div>
      <div class="logs-summary" id="logsSummary"></div>
      <div id="logsLista"></div>
    </div>
    <div class="admin-actions"><button class="admin-btn ghost" onclick="renderAdminLogs()">🔄 Atualizar</button></div>
  `;

  const filtrados = aplicarFiltrosLogs(logs);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const totalHoje = logs.filter(l => (l.ts || 0) >= hoje.getTime()).length;
  document.getElementById('logsSummary').innerHTML = `
    <div class="ls-item">Total<b>${logs.length}</b></div>
    <div class="ls-item">Hoje<b>${totalHoje}</b></div>
    ${filtrados.length !== logs.length ? `<div class="ls-item">Filtrados<b>${filtrados.length}</b></div>` : ''}
  `;

  renderLogsLista(filtrados);

  document.getElementById('logsBusca')?.addEventListener('input', e => {
    LOGS_STATE.busca = e.target.value;
    LOGS_STATE.limite = 20;
    renderLogsLista(aplicarFiltrosLogs(logs));
  });
  document.getElementById('logsPeriodo')?.addEventListener('change', e => {
    LOGS_STATE.periodo = e.target.value;
    LOGS_STATE.limite = 20;
    renderLogsLista(aplicarFiltrosLogs(logs));
  });
}

function renderLogsLista(filtrados){
  const lista = document.getElementById('logsLista'); if(!lista) return;
  if(!filtrados.length){
    lista.innerHTML = `<div class="logs-empty"><b>Nenhum log com esses filtros</b>Tenta limpar a busca.</div>`;
    return;
  }
  const mostrados = filtrados.slice(0, LOGS_STATE.limite);
  const temMais = filtrados.length > LOGS_STATE.limite;
  const { grupos, ordem } = agruparLogsPorDia(mostrados);
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
  `).join('') + (temMais ? `
    <div style="text-align:center;margin-top:12px">
      <button class="admin-btn ghost" onclick="LOGS_STATE.limite += 20; renderLogsLista(aplicarFiltrosLogs(window.__logsCache||[]))">
        ⬇️ Carregar mais (${filtrados.length - LOGS_STATE.limite} restantes)
      </button>
    </div>` : '');
}
window.renderAdminLogs = renderAdminLogs;

/* ============================================================
   BACKUP
   ============================================================ */
async function renderAdminBackup(){
  const area = document.getElementById('adminArea'); if(!area) return;
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
      <p style="color:var(--mute);font-size:.85rem;margin-bottom:14px">Um backup automático é criado todo dia às 3h. Os 5 mais recentes são mantidos.</p>
      ${backups.length ? backups.map(b => `
        <div class="backup-item">
          <div class="bkp-ic">📦</div>
          <div class="bkp-info"><b>${esc(b.id)}</b><small>${fmtDataHora(b.criadoEm)} · ${fmtTamanho(b.tamanho || 0)} · por @${esc(b.criadoPor || 'sistema')}</small></div>
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
    const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create' }) });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    toast('Backup criado! ✅', 'ok');
    await renderAdminBackup();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.criarBackupManual = criarBackupManual;

async function restaurarBackup(id){
  const ok = await confirmar('Restaurar backup?', 'Todos os dados atuais serão substituídos. Essa ação não volta.', '⚠️');
  if(!ok) return;
  try{
    const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', id }) });
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
  const ok = await confirmar('Apagar backup?', 'O arquivo sai do histórico.', '🗑️');
  if(!ok) return;
  try{
    const r = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    if(!r.ok) throw new Error('Falha');
    toast('Backup apagado ✅', 'ok');
    await renderAdminBackup();
    carregarShared(true).then(() => renderSidebar());
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.apagarBackup = apagarBackup;