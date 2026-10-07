/* ============================================================
   ADMIN — DASHBOARD & SETUP
   ============================================================ */
async function renderAdminHome(){
  const area = document.getElementById('adminArea');
  if(!area) return;

  const visitanteBtn = `<button type="button" class="ver-visitante" onclick="verComoVisitante()" title="Abrir home numa nova aba">👁️ Ver como visitante</button>`;
  const crumbs = adminVoltarHTML('⚙️ Painel', visitanteBtn);
  area.innerHTML = crumbs + `<p class="admin-vazio">Carregando painel…</p>`;

  const shared = await carregarShared(true);
  const podeVotos = temPerm('ver_votos');
  const podeTier = temPerm('ver_tierlist');
  const podeAdmins = temPerm('ver_admins');
  const podeBanidos = temPerm('ver_banidos');
  const podeSug = temPerm('ver_sugestoes');

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
  if(podeSug && shared.sugestoes){
    const total = (shared.sugestoes.itens || []).length;
    const novas = (shared.sugestoes.itens || []).filter(i => (i.status || 'nova') === 'nova').length;
    const pulse = kpiChanged('sug', total);
    kpis.push({ icon:'💡', value: total, label:'sugestões', sub: novas === 0 ? 'nenhuma nova' : `${novas} nova${novas === 1 ? '' : 's'}`, href:'sugestoes', accent:'amber', pulse });
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
  if(temPerm('ver_tierlist')){
    cardsOperacao.push(cardAdminV2({
      icon:'🖥️', title:'Setup dos sonhos',
      desc:'Editar sonhos, metas e apoiadores da vaquinha.',
      page:'setup', accent:'cyan'
    }));
  }
  if(temPerm('ver_sugestoes')){
    const novas = shared.sugestoes ? (shared.sugestoes.itens || []).filter(i => (i.status||'nova') === 'nova').length : 0;
    cardsOperacao.push(cardAdminV2({
      icon:'💡', title:'Sugestões',
      desc: novas > 0
        ? `${novas} nova${novas === 1 ? '' : 's'} aguardando análise.`
        : 'Ver e gerenciar ideias da comunidade.',
      page:'sugestoes', accent:'amber'
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

  const cardsSistema = [];
  if(temPerm('ver_config')){
    cardsSistema.push(cardAdminV2({
      icon:'⚙️', title:'Config geral',
      desc:'Aviso, aparência, manutenção e votação.',
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

  area.querySelectorAll('.admin-kpi').forEach(k => {
    k.addEventListener('click', () => adminIrPara(k.dataset.page));
  });

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

function verComoVisitante(){
  const url = window.location.origin + '/?preview=1';
  const w = window.open(url, '_blank', 'noopener');
  if(!w){ toast('Permita popups pra abrir o preview', 'warn'); return; }
  toast('Home aberta em nova aba 💜', 'ok');
}
window.verComoVisitante = verComoVisitante;

/* ============================================================
   SETUP ADMIN — Sonhos + Apoiadores
   ============================================================ */
async function renderAdminSetup(){
  const area = document.getElementById('adminArea'); if(!area) return;
  area.innerHTML = adminVoltarHTML('🖥️ Setup dos sonhos') + `<p class="admin-vazio">Carregando…</p>`;

  const sonhos = Array.isArray(window.SONHOS_DATA) ? window.SONHOS_DATA : [];

  area.innerHTML = adminVoltarHTML('🖥️ Setup dos sonhos') + `
    <div class="admin-card">
      <h3>✨ Sonhos ativos <span class="cont">${sonhos.length}</span></h3>
      <p style="color:var(--mute);font-size:.84rem;margin-bottom:14px">
        Aqui você edita as metas, valores arrecadados e quem ajudou. Depois clica em salvar.
      </p>
      <div id="adminSonhosLista"></div>
      <div class="admin-actions">
        <button class="admin-btn" onclick="adicionarSonho()">+ Adicionar sonho</button>
        <button class="admin-btn ghost" onclick="renderAdminSetup()">🔄 Recarregar</button>
      </div>
    </div>

    <div class="admin-card">
      <h3>🏆 Ranking de apoiadores</h3>
      <p style="color:var(--mute);font-size:.84rem;margin-bottom:14px">
        Visualização automática baseada nas contribuições adicionadas em cada sonho.
      </p>
      <div id="adminApoiadoresLista"></div>
    </div>
  `;
  renderAdminSonhosLista(sonhos);
  renderAdminApoiadoresLista(sonhos);
}
window.renderAdminSetup = renderAdminSetup;

function renderAdminSonhosLista(sonhos){
  const el = document.getElementById('adminSonhosLista'); if(!el) return;
  if(!sonhos.length){
    el.innerHTML = '<div class="logs-empty"><b>Nenhum sonho ainda</b>Adiciona o primeiro.</div>';
    return;
  }
  el.innerHTML = sonhos.map((s, idx) => {
    const pct = s.meta > 0 ? Math.min(100, Math.round((s.arrecadado / s.meta) * 100)) : 0;
    return `
      <div class="admin-card" style="background:rgba(255,255,255,.02);margin-bottom:12px">
        <h3 style="font-size:.98rem">
          <span style="font-size:1.4rem">${s.icon || '✨'}</span>
          ${esc(s.nome)}
          <span class="cont">${pct}%</span>
        </h3>
        <div class="admin-form">
          <div class="row">
            <div><label>Ícone</label><input type="text" id="sonho-${idx}-icon" value="${esc(s.icon || '✨')}" maxlength="4"></div>
            <div><label>Categoria</label><input type="text" id="sonho-${idx}-cat" value="${esc(s.cat || '')}"></div>
          </div>
          <div><label>Nome</label><input type="text" id="sonho-${idx}-nome" value="${esc(s.nome || '')}"></div>
          <div><label>Descrição</label><input type="text" id="sonho-${idx}-desc" value="${esc(s.descricao || '')}"></div>
          <div class="row">
            <div><label>Meta (R$)</label><input type="number" id="sonho-${idx}-meta" min="0" step="1" value="${Number(s.meta) || 0}"></div>
            <div><label>Arrecadado (R$)</label><input type="number" id="sonho-${idx}-arr" min="0" step="1" value="${Number(s.arrecadado) || 0}"></div>
          </div>

          <div style="margin-top:8px">
            <label>💜 Contribuintes (${(s.contribuintes || []).length})</label>
            <div>
              ${(s.contribuintes || []).map((c, ci) => `
                <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
                  <input type="text" id="sonho-${idx}-c-${ci}-nome" value="${esc(c.nome || '')}" placeholder="Nome" style="flex:1">
                  <input type="number" id="sonho-${idx}-c-${ci}-val" value="${Number(c.valor) || 0}" placeholder="R$" style="width:110px">
                  <button type="button" class="btn-mini danger" onclick="removerContribuinte(${idx}, ${ci})">✕</button>
                </div>
              `).join('') || '<small style="color:var(--mute)">Ninguém ainda</small>'}
            </div>
            <button type="button" class="btn-mini" style="margin-top:6px" onclick="adicionarContribuinte(${idx})">+ Contribuinte</button>
          </div>

          <div class="admin-actions" style="justify-content:flex-end">
            <button type="button" class="admin-btn perigo" onclick="removerSonho(${idx})">🗑️ Remover sonho</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAdminApoiadoresLista(sonhos){
  const el = document.getElementById('adminApoiadoresLista'); if(!el) return;
  const todos = [];
  sonhos.forEach(s => {
    (s.contribuintes || []).forEach(c => {
      todos.push({ nome: c.nome, valor: Number(c.valor) || 0, sonho: s.nome });
    });
  });
  if(!todos.length){
    el.innerHTML = '<div class="logs-empty"><b>Ninguém ainda</b>Adiciona contribuintes pra ver o ranking.</div>';
    return;
  }
  const porPessoa = {};
  todos.forEach(t => {
    if(!porPessoa[t.nome]) porPessoa[t.nome] = { nome: t.nome, total: 0, sonhos: [] };
    porPessoa[t.nome].total += t.valor;
    if(!porPessoa[t.nome].sonhos.includes(t.sonho)) porPessoa[t.nome].sonhos.push(t.sonho);
  });
  const ranking = Object.values(porPessoa).sort((a,b) => b.total - a.total);
  el.innerHTML = ranking.map((p, i) => `
    <div class="admin-voto" style="margin-bottom:6px">
      <span style="font-size:1.3rem;flex:none;width:32px;text-align:center">${['🥇','🥈','🥉'][i] || '🎗️'}</span>
      <div class="admin-voto-info">
        <b>@${esc(p.nome)}</b>
        <small>${p.sonhos.join(' · ')}</small>
      </div>
      <div class="admin-voto-opcao">
        <b>${typeof fmtBRL === 'function' ? fmtBRL(p.total) : 'R$ ' + p.total}</b>
      </div>
    </div>
  `).join('');
}

async function salvarSonhos(){
  const sonhos = [];
  let idx = 0;
  while(document.getElementById(`sonho-${idx}-nome`)){
    const s = {
      id: (window.SONHOS_DATA[idx] && window.SONHOS_DATA[idx].id) || ('sonho-' + Date.now() + '-' + idx),
      icon: document.getElementById(`sonho-${idx}-icon`).value.trim() || '✨',
      cat: document.getElementById(`sonho-${idx}-cat`).value.trim(),
      nome: document.getElementById(`sonho-${idx}-nome`).value.trim(),
      descricao: document.getElementById(`sonho-${idx}-desc`).value.trim(),
      meta: Number(document.getElementById(`sonho-${idx}-meta`).value) || 0,
      arrecadado: Number(document.getElementById(`sonho-${idx}-arr`).value) || 0,
      contribuintes: []
    };
    let ci = 0;
    while(document.getElementById(`sonho-${idx}-c-${ci}-nome`)){
      const nome = document.getElementById(`sonho-${idx}-c-${ci}-nome`).value.trim();
      const valor = Number(document.getElementById(`sonho-${idx}-c-${ci}-val`).value) || 0;
      if(nome) s.contribuintes.push({ nome, valor });
      ci++;
    }
    if(s.nome) sonhos.push(s);
    idx++;
  }
  window.SONHOS_DATA = sonhos;
  toast('Sonhos salvos! ✅', 'ok');
  renderAdminSetup();
}
window.salvarSonhos = salvarSonhos;

function adicionarSonho(){
  const sonhos = window.SONHOS_DATA || [];
  sonhos.push({ id: 'sonho-' + Date.now(), icon: '✨', cat: '', nome: 'Novo sonho', descricao: '', meta: 0, arrecadado: 0, contribuintes: [] });
  window.SONHOS_DATA = sonhos;
  renderAdminSetup();
}
window.adicionarSonho = adicionarSonho;

function removerSonho(idx){
  if(!confirmar) return;
  confirmar('Remover sonho?', 'O sonho e todas as contribuições somem.', '🗑️').then(ok => {
    if(!ok) return;
    const sonhos = window.SONHOS_DATA || [];
    sonhos.splice(idx, 1);
    window.SONHOS_DATA = sonhos;
    renderAdminSetup();
  });
}
window.removerSonho = removerSonho;

function adicionarContribuinte(idx){
  const sonhos = window.SONHOS_DATA || [];
  if(!sonhos[idx]) return;
  if(!sonhos[idx].contribuintes) sonhos[idx].contribuintes = [];
  sonhos[idx].contribuintes.push({ nome: '', valor: 0 });
  renderAdminSetup();
}
window.adicionarContribuinte = adicionarContribuinte;

function removerContribuinte(idx, ci){
  const sonhos = window.SONHOS_DATA || [];
  if(!sonhos[idx] || !sonhos[idx].contribuintes) return;
  sonhos[idx].contribuintes.splice(ci, 1);
  renderAdminSetup();
}
window.removerContribuinte = removerContribuinte;