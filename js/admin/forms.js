/* ============================================================
   ADMIN — FORMS (Votação, Opções, Prazo, Config)
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
  const { usuarios = [], contagem = {}, config, fechamento } = ADMIN_DADOS;
  const totalVotos = Object.values(contagem).reduce((a,b)=>a+b,0);
  const mapaOpcao = {};
  (config || []).forEach(o => { mapaOpcao[o.id] = o; });
  const podeEditar = temPerm('editar_opcoes');
  const podeResetar = temPerm('resetar_votos');

  const cd = typeof tempoRestante === 'function' ? tempoRestante(fechamento) : null;
  const fechamentoTxt = fechamento
    ? (cd && !cd.encerrado ? `Fecha em ${cd.texto.replace('Fecha em ', '')}` : 'Encerrada')
    : 'Sem prazo definido';

  area.innerHTML = adminVoltarHTML('🗳️ Votação') + `
    <div class="votacao-tabs">
      <button class="${ADMIN_TAB === 'votos' ? 'on' : ''}" onclick="adminIrAba('votos')">Votos (${totalVotos})</button>
      ${podeEditar ? `<button class="${ADMIN_TAB === 'opcoes' ? 'on' : ''}" onclick="adminIrAba('opcoes')">Opções</button>` : ''}
      ${podeEditar ? `<button class="${ADMIN_TAB === 'prazo' ? 'on' : ''}" onclick="adminIrAba('prazo')">⏰ Prazo</button>` : ''}
    </div>
    <div id="adminConteudo"></div>
  `;

  if(ADMIN_TAB === 'votos') renderAdminVotos(usuarios, mapaOpcao, contagem, podeResetar);
  else if(ADMIN_TAB === 'opcoes' && podeEditar) renderAdminOpcoes(config || [], contagem);
  else if(ADMIN_TAB === 'prazo' && podeEditar) renderAdminPrazo(fechamento, fechamentoTxt);
}

function renderAdminVotos(usuarios, mapaOpcao, contagem, podeResetar){
  const el = document.getElementById('adminConteudo'); if(!el) return;
  if(!usuarios.length){
    el.innerHTML = `
      <div class="admin-card">
        <h3>🗳️ Votos</h3>
        <div class="logs-empty"><b>Ninguém votou ainda</b>A votação tá aberta, mas ninguém escolheu nada por enquanto.</div>
        <div class="admin-actions">
          <button class="admin-btn ghost" onclick="carregarAdminVotacao()">🔄 Atualizar</button>
        </div>
      </div>`;
    return;
  }
  const porOpcao = {};
  usuarios.forEach(u => {
    const op = u.opcao || '__sem__';
    if(!porOpcao[op]) porOpcao[op] = [];
    porOpcao[op].push(u);
  });
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
  const el = document.getElementById('adminConteudo'); if(!el) return;
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

function renderAdminPrazo(fechamento, fechamentoTxt){
  const el = document.getElementById('adminConteudo'); if(!el) return;
  const iso = fechamento || '';
  const localIso = iso ? new Date(iso).toISOString().slice(0,16) : '';

  el.innerHTML = `
    <div class="admin-card">
      <h3>⏰ Prazo de encerramento</h3>
      <p style="color:var(--mute);font-size:.85rem;margin-bottom:14px">
        Quando passar desse horário, a votação fecha automaticamente. Os visitantes não vão poder votar.
      </p>
      <div class="admin-form">
        <div>
          <label>Fecha em</label>
          <input id="cfgVotosFechamento" type="datetime-local" value="${esc(localIso)}">
        </div>
        <div class="admin-actions" style="justify-content:flex-start">
          <button class="admin-btn" onclick="salvarPrazoVotacao()">💾 Salvar prazo</button>
          <button class="admin-btn ghost" onclick="limparPrazoVotacao()">🧹 Limpar prazo</button>
        </div>
        <div class="aviso-preview" style="margin-top:14px">
          <span class="ap-label">Status atual</span>
          <span class="ap-ic">⏰</span>
          <div class="ap-tx">
            <b>${esc(fechamentoTxt)}</b>
            <span>${fechamento ? 'Fechamento programado' : 'Sem data definida — votação aberta indefinidamente'}</span>
          </div>
        </div>
      </div>
    </div>`;
}

async function salvarPrazoVotacao(){
  const val = document.getElementById('cfgVotosFechamento')?.value || '';
  if(!val){ toast('Selecione uma data e hora', 'warn'); return; }
  try{
    const r = await fetch('/api/admin?action=config-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votosFechamento: new Date(val).toISOString() })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    CONFIG_GERAL.votosFechamento = new Date(val).toISOString();
    VOTOS_FECHAMENTO = CONFIG_GERAL.votosFechamento;
    toast('Prazo salvo! ✅', 'ok');
    renderVotacao();
    renderAdminVotacao();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.salvarPrazoVotacao = salvarPrazoVotacao;

async function limparPrazoVotacao(){
  const ok = await confirmar('Limpar prazo?', 'A votação fica aberta indefinidamente.', '🧹');
  if(!ok) return;
  try{
    const r = await fetch('/api/admin?action=config-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ votosFechamento: null })
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || 'Falha');
    CONFIG_GERAL.votosFechamento = null;
    VOTOS_FECHAMENTO = null;
    toast('Prazo removido ✅', 'ok');
    renderVotacao();
    renderAdminVotacao();
  }catch(e){ toast('Erro: ' + e.message, 'erro'); }
}
window.limparPrazoVotacao = limparPrazoVotacao;

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
   CONFIG (com abas)
   ============================================================ */
async function renderAdminConfig(){
  const area = document.getElementById('adminArea'); if(!area) return;
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

      <div class="config-panel ${tab === 'aviso' ? 'on' : ''}">
        <div class="admin-card">
          <h3>📢 Aviso da home</h3>
          <div class="admin-form">
            <div><label style="display:flex;align-items:center;gap:8px;text-transform:none"><input type="checkbox" id="cfgAvisoAtivo" ${av.ativo ? 'checked' : ''} style="width:auto"> Mostrar aviso na home</label></div>
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
                <div class="ap-tx"><b id="apTitulo">${esc(av.titulo || 'Aviso')}</b><span id="apTexto">${esc(av.texto || 'O texto do aviso aparece aqui…')}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="config-panel ${tab === 'aparencia' ? 'on' : ''}">
        <div class="admin-card">
          <h3>💜 Link de doação</h3>
          <div class="admin-form">
            <div><label>URL</label><input id="cfgDonate" type="text" value="${esc(d.donate || CONFIG.donate || '')}"></div>
            <div><label>Chave Pix (pra vaquinha)</label><input id="cfgPix" type="text" value="${esc(CONFIG.pixKey || '')}"></div>
          </div>
        </div>
        <div class="admin-card">
          <h3>💬 Recado da Soso</h3>
          <div class="admin-form">
            <div><label>Texto do recado</label><textarea id="cfgRecado" rows="3" placeholder="Ex: Essa semana tem live de terror! 💜">${esc(d.recado || '')}</textarea></div>
          </div>
        </div>
        <div class="admin-card">
          <h3>🏆 Top 3 apoiadores</h3>
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Um por linha, formato: <code>Nome | valor</code>.</p>
          <div class="admin-form">
            <div><label>Linhas (até 3)</label><textarea id="cfgTop3" rows="4" placeholder="lukxsl | R$ 250">${esc(top3Txt)}</textarea></div>
          </div>
        </div>
        <div class="admin-card">
          <h3>👑 Hall da fama</h3>
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Um por linha, formato: <code>Nome | tempo</code>.</p>
          <div class="admin-form">
            <div><label>Linhas (até 5)</label><textarea id="cfgHall" rows="6" placeholder="gabizinha | 14 meses">${esc(hallTxt)}</textarea></div>
          </div>
        </div>
      </div>

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
          <p style="color:var(--mute);font-size:.85rem;margin-bottom:12px">Quando ligado, quem não é admin vê uma tela de manutenção.</p>
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
        </div>` : `<p style="color:var(--mute);font-size:.82rem;text-align:center;margin-top:14px">Você não tem permissão pra editar.</p>`}
    `;

    ['cfgAvisoIcone','cfgAvisoTitulo','cfgAvisoTexto','cfgAvisoTipo'].forEach(id => {
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
  preview.classList.toggle('warn', (document.getElementById('cfgAvisoTipo')?.value || 'info') === 'warn');
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
  }catch(e){ toast('Erro ao sincronizar', 'erro'); }
  finally { if(btn){ btn.disabled = false; btn.textContent = '🔄 Sincronizar'; } }
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
  const pix = (document.getElementById('cfgPix')?.value || '').trim();
  const recado = (document.getElementById('cfgRecado')?.value || '').trim();
  const manutencao = document.getElementById('cfgManutencao')?.checked || false;

  if(pix) CONFIG.pixKey = pix;

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