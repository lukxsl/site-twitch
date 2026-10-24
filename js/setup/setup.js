/* ============================================================
   SETUP — 360° + SONHOS + APOIADORES
   ============================================================ */
let _sonhoSelecionado = null;

const SETUP_DATA = [
  {
    id: 'pc',
    titulo: '💻 PC Gamer',
    accent: 'blue',
    tipo: 'real',
    itens: [
      { ic:'🧠', cat:'Processador', nome:'Ryzen 9 5900x', ano:2023, nota:10, comentario:'Monstro pra jogos e streaming.' },
      { ic:'🎮', cat:'Placa de Vídeo', nome:'Rtx 3060 12GB Branca', ano:2023, nota:9, comentario:'Linda e roda tudo liso.' },
      { ic:'🧩', cat:'Memória RAM', nome:'48GB de RAM', ano:2023, nota:9, comentario:'Sobra RAM pra jogar e streamar.' },
      { ic:'🔌', cat:'Placa Mãe', nome:'x570 TUF Gaming', ano:2023, nota:8, comentario:'Ótima construção e dissipação.' },
      { ic:'🗄️', cat:'Gabinete', nome:'Risemode Aquarium branco', ano:2023, nota:8, comentario:'Visual limpo e airflow top.' },
      { ic:'💧', cat:'Water cooler', nome:'Risemode Aura RGB', ano:2023, nota:7, comentario:'Mantém a temperatura baixa.' },
      { ic:'💾', cat:'Armazenamento', nome:'SSD - 2tb NvME M2', ano:2024, nota:9, comentario:'Leitura rápida, carrega em segundos.' },
      { ic:'⚡', cat:'Fonte', nome:'Corsair RM800w', ano:2023, nota:9, comentario:'80 Plus Gold, silenciosa.' }
    ]
  },
  {
    id: 'per',
    titulo: '🖱️ Periféricos & Outros',
    accent: 'pink',
    tipo: 'real',
    itens: [
      { ic:'⌨️', cat:'Teclado', nome:'Logitech G PRO X TKL Branco', ano:2023, nota:10, comentario:'Switch top, ótimo pra jogar.' },
      { ic:'🖱️', cat:'Mouse', nome:'Logitech g502x Superlight RGB', ano:2024, nota:10, comentario:'Leve, preciso e TOP.' },
      { ic:'🎧', cat:'Headset', nome:'Astro A30', ano:2023, nota:9, comentario:'Áudio excelente.' },
      { ic:'🎙️', cat:'Microfone', nome:'FIFINE AM8 Branco', ano:2024, nota:8, comentario:'Ganho bom e bonito.' },
      { ic:'🖥️', cat:'Monitor', nome:'AOC 240hz', ano:2023, nota:9, comentario:'240Hz faz MUITA diferença.' },
      { ic:'📷', cat:'Webcam', nome:'iPhone 11', ano:2023, nota:8, comentario:'Usando como webcam, qualidade ótima.' }
    ]
  },
  {
    id: 'extra',
    titulo: '🪑 Mesa & Cadeira',
    accent: 'cyan',
    tipo: 'real',
    itens: [
      { ic:'🪑', cat:'Cadeira', nome:'XT Racer', ano:2023, nota:8, comentario:'Confortável pra longas lives.' }
    ]
  }
];

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

  try{
    toast(`✅ Aviso enviado! Assim que a Soso confirmar, @${nome} aparece na lista 💜`, 'ok');
    if($('dlg')) $('dlg').close();
  }catch(e){
    toast('Não consegui enviar. Manda no Discord 💜', 'warn');
  }
}
window.enviarContribuicao = enviarContribuicao;

/* ============================================================
   VISUALIZADOR 360° DO SETUP (Photo Sphere Viewer)
   ============================================================ */
function iniciarSetup360() {
  const container = document.getElementById('setup360Container');
  if (!container) return;
  if (typeof PhotoSphereViewer === 'undefined') {
    console.error("Photo Sphere Viewer não carregou.");
    return;
  }

  // --- ATENÇÃO: SUBSTITUA PELA URL DA SUA FOTO 360° AQUI ---
  // Essa é uma imagem de teste do Pannellum (sala de aula) que sempre funciona.
  const urlFoto360 = 'https://pannellum.org/images/alma.jpg'; 

  const viewer = new PhotoSphereViewer.Viewer({
    container: container,
    panorama: urlFoto360,
    caption: 'Arraste para explorar o setup 360° 💜',
    loadingTxt: 'Carregando cantinho...',
    touchmoveTwoFingers: false, // Permite arrastar com 1 dedo no celular
    mousewheelCtrlKey: false,   // Permite dar zoom com a rodinha do mouse direto
    defaultYaw: '0deg',
    defaultPitch: '0deg',
    navbar: false, // Esconde a barra de ferramentas padrão para ficar mais limpo
    plugins: [
      [PhotoSphereViewer.MarkersPlugin, {
        markers: [
          // 1. PC Gamer (Processador)
          {
            id: 'pc',
            position: { yaw: '2.9rad', pitch: '0.1rad' }, 
            html: '<div class="custom-hotspot" title="Ver PC Gamer">💻</div>',
            tooltip: 'Ver PC Gamer',
            click: () => { abrirItemSetup('pc', 0); }
          },
          // 2. Microfone
          {
            id: 'microfone',
            position: { yaw: '1.2rad', pitch: '-0.1rad' },
            html: '<div class="custom-hotspot" title="Ver Microfone">🎙️</div>',
            tooltip: 'Ver Microfone',
            click: () => { abrirItemSetup('per', 3); }
          },
          // 3. Monitor
          {
            id: 'monitor',
            position: { yaw: '2.0rad', pitch: '0.2rad' },
            html: '<div class="custom-hotspot" title="Ver Monitor">🖥️</div>',
            tooltip: 'Ver Monitor',
            click: () => { abrirItemSetup('per', 4); }
          },
          // 4. Teclado
          {
            id: 'teclado',
            position: { yaw: '2.8rad', pitch: '-0.3rad' },
            html: '<div class="custom-hotspot" title="Ver Teclado">⌨️</div>',
            tooltip: 'Ver Teclado',
            click: () => { abrirItemSetup('per', 0); }
          },
          // 5. Mouse
          {
            id: 'mouse',
            position: { yaw: '3.2rad', pitch: '-0.4rad' },
            html: '<div class="custom-hotspot" title="Ver Mouse">🖱️</div>',
            tooltip: 'Ver Mouse',
            click: () => { abrirItemSetup('per', 1); }
          },
          // 6. Headset
          {
            id: 'headset',
            position: { yaw: '1.8rad', pitch: '-0.2rad' },
            html: '<div class="custom-hotspot" title="Ver Headset">🎧</div>',
            tooltip: 'Ver Headset',
            click: () => { abrirItemSetup('per', 2); }
          }
        ]
      }]
    ]
  });
}

// Inicia o visualizador quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(iniciarSetup360, 500);
});