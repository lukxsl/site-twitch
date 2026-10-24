/* ============================================================
   SETUP — CENA 3D INTERATIVA + SONHOS + APOIADORES
   ============================================================ */
let _sonhoSelecionado = null;

/* ----- Itens que o main.js espera encontrar (evita erro no site) ----- */
const SETUP_VIEW_KEY = 'setup_view_v1';
let setupView = '3d';
let setupBusca = '';
function setupRender() {}
function setupSetView() {}
window.setupRender = setupRender;
window.setupSetView = setupSetView;

/* ----- DADOS DO SETUP (editável: nome, ano, nota, comentário) ----- */
const SETUP_DATA = [
  {
    id: 'pc', titulo: '💻 PC Gamer', accent: 'blue', tipo: 'real',
    itens: [
      { ic:'🧠', cat:'Processador',    nome:'Ryzen 9 5900X',               ano:2023, nota:10, comentario:'Monstro pra jogos e streaming.' },
      { ic:'🎮', cat:'Placa de Vídeo', nome:'RTX 3060 12GB Branca',        ano:2023, nota:9,  comentario:'Linda e roda tudo liso.' },
      { ic:'🧩', cat:'Memória RAM',    nome:'48GB de RAM',                 ano:2023, nota:9,  comentario:'Sobra RAM pra jogar e streamar.' },
      { ic:'🔌', cat:'Placa Mãe',      nome:'X570 TUF Gaming',             ano:2023, nota:8,  comentario:'Ótima construção e dissipação.' },
      { ic:'🗄️', cat:'Gabinete',       nome:'Risemode Aquarium Branco',    ano:2023, nota:8,  comentario:'Visual limpo e airflow top.' },
      { ic:'💧', cat:'Water Cooler',   nome:'Risemode Aura RGB',           ano:2023, nota:7,  comentario:'Mantém a temperatura baixa.' },
      { ic:'💾', cat:'Armazenamento',  nome:'SSD 2TB NVMe M.2',            ano:2024, nota:9,  comentario:'Leitura rápida, carrega em segundos.' },
      { ic:'⚡', cat:'Fonte',          nome:'Corsair RM800W',              ano:2023, nota:9,  comentario:'80 Plus Gold, silenciosa.' }
    ]
  },
  {
    id: 'per', titulo: '🖱️ Periféricos', accent: 'pink', tipo: 'real',
    itens: [
      { ic:'⌨️', cat:'Teclado',    nome:'Logitech G PRO X TKL Branco',     ano:2023, nota:10, comentario:'Switch top, ótimo pra jogar.' },
      { ic:'🖱️', cat:'Mouse',      nome:'Logitech G502 X Superlight RGB',  ano:2024, nota:10, comentario:'Leve, preciso e TOP.' },
      { ic:'🎧', cat:'Headset',    nome:'Astro A30',                       ano:2023, nota:9,  comentario:'Áudio excelente.' },
      { ic:'🎙️', cat:'Microfone',  nome:'FIFINE AM8 Branco',               ano:2024, nota:8,  comentario:'Ganho bom e bonito.' },
      { ic:'🖥️', cat:'Monitor',    nome:'AOC 240Hz',                       ano:2023, nota:9,  comentario:'240Hz faz MUITA diferença.' },
      { ic:'📷', cat:'Webcam',     nome:'iPhone 11',                       ano:2023, nota:8,  comentario:'Usando como webcam, qualidade ótima.' }
    ]
  },
  {
    id: 'extra', titulo: '🪑 Mesa & Cadeira', accent: 'cyan', tipo: 'real',
    itens: [
      { ic:'🪑', cat:'Cadeira', nome:'XT Racer', ano:2023, nota:8, comentario:'Confortável pra longas lives.' }
    ]
  }
];

const SONHOS_DATA = [
  { id: 'sony-zv-e10', icon: '🎥', cat: 'Câmera profissional', nome: 'Sony ZV-E10', descricao: 'Pra dar um upgrade monstro no visual da live.', meta: 3500, arrecadado: 0, contribuintes: [] },
  { id: 'shure-sm7b', icon: '🎤', cat: 'Microfone pro', nome: 'Shure SM7B', descricao: 'O sonho de todo streamer, mas precisa de interface.', meta: 4200, arrecadado: 0, contribuintes: [] }
];

/* Função que abre o Modal (chamada quando clica no pontinho) */
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
        <div><b>${esc(s.nome)}</b><small>${esc(s.cat)}</small></div>
      </div>
      <div class="cm-progresso">
        <div class="sonho-bar"><i style="width:${pct}%"></i></div>
        <div class="cm-prog-info"><b>${fmtBRL(s.arrecadado)}</b><span>de ${fmtBRL(s.meta)}</span><span class="sonho-pct">${pct}%</span></div>
      </div>
      <div class="cm-info">
        <b>💜 Como contribuir</b>
        <ol><li>Faz um Pix de qualquer valor</li><li>Volta aqui e avisa a Soso</li><li>A contribuição aparece após confirmação</li></ol>
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
      </div>
    </div>
  `;
  $('dlg').showModal();
}
window.abrirContribuirSonho = abrirContribuirSonho;

function copiarPix(){
  const input = $('pixKeyInput'); if(!input) return;
  try { input.select(); navigator.clipboard.writeText(input.value); toast('Chave Pix copiada! 💜', 'ok'); }
  catch(e){ toast('Erro ao copiar', 'erro'); }
}
window.copiarPix = copiarPix;

async function enviarContribuicao(){
  const nome = ($('contribNome')?.value || '').trim();
  const valor = Number($('contribValor')?.value) || 0;
  if(!nome){ toast('Digita seu nome/apelido!', 'warn'); return; }
  if(valor <= 0){ toast('Informa o valor do Pix!', 'warn'); return; }
  try{ toast(`✅ Aviso enviado! Assim que a Soso confirmar, @${nome} aparece na lista 💜`, 'ok'); if($('dlg')) $('dlg').close(); }
  catch(e){ toast('Não consegui enviar. Manda no Discord 💜', 'warn'); }
}
window.enviarContribuicao = enviarContribuicao;

/* ============================================================
   CENA 3D DO SETUP  (Three.js)
   ============================================================ */
const Setup3D = (function () {
  let started = false, built = false, visible = false;
  let container, wrap, pinLayer, hintEl, ledPanel, W = 0, H = 0;
  let renderer, scene, camera, controls, raycaster;
  let pcGroup, caseShell, doorPivot;
  let mode = 'room';            // 'room' | 'pc'
  let flying = false;
  let raf = 0;
  let savedPose = null;
  const pins = [];
  const rgbMats = [];
  const roomTargets = [];
  const pcTargets = [];
  const tweens = [];
  let tmpV = null, camV = null;
  const DOOR_OPEN = 1.75;
  
  // Novidades
  let rainMesh, rainVel = 0;
  let catGroup, catBreath = 0;
  let fans = [];
  let audioCtx = null;
  let ambientSound = null;

  /* ---------- Audio Helpers ---------- */
  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    } catch(e) {}
  }
  
  function playSound(url) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch(()=>{});
  }

  function playAmbient() {
    if (!audioCtx || ambientSound) return;
    ambientSound = new Audio('https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3'); // Lo-fi placeholder
    ambientSound.loop = true;
    ambientSound.volume = 0.15;
    ambientSound.play().catch(()=>{});
  }

  /* ---------- helpers de material / forma ---------- */
  function M(color, o) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.55, metalness: 0.1 }, o || {}));
  }
  function B(color, o) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: color }, o || {}));
  }
  function rgb(off) {
    const m = B(0xa855f7);
    rgbMats.push({ m: m, off: off || 0 });
    return m;
  }
  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function cylBetween(a, b, r, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return m;
  }
  function anchor(parent, x, y, z) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function textTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- tween simples ---------- */
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(dur, fn, done) {
    tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done });
  }
  function runTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(ease(k));
      if (k >= 1) {
        tweens.splice(i, 1);
        if (tw.done) tw.done();
      }
    }
  }
  function flyTo(pos, target, dur, done) {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    flying = true;
    controls.enabled = false;
    tween(dur, function (e) {
      camera.position.lerpVectors(p0, pos, e);
      controls.target.lerpVectors(t0, target, e);
      camera.lookAt(controls.target);
    }, function () {
      camera.position.copy(pos);
      controls.target.copy(target);
      flying = false;
      controls.enabled = true;
      controls.update();
      if (done) done();
    });
  }

  /* ---------- pose padrão da câmera ---------- */
  function roomPose() {
    const aspect = Math.max(0.4, W / Math.max(1, H));
    const dist = Math.min(5.5, Math.max(2.8, 3.0 / aspect));
    const dir = new THREE.Vector3(1.4, 0.55, 2.35).normalize();
    const target = new THREE.Vector3(0.05, 0.98, 0);
    const pos = target.clone().addScaledVector(dir, dist);
    return { pos: pos, target: target };
  }

  /* ============================================================
     CONSTRUÇÃO DA CENA
     ============================================================ */
  function buildRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), M(0x100a1c, { roughness: 0.45, metalness: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), M(0x24153d, { roughness: 0.9, metalness: 0 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-0.1, 0.003, 0.75);
    scene.add(rug);
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.15, 64), rgb(0));
    rugRing.rotation.x = -Math.PI / 2;
    rugRing.position.set(-0.1, 0.005, 0.75);
    scene.add(rugRing);

    const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), M(0x1a1030, { roughness: 0.95, metalness: 0 }));
    wallBack.position.set(0, 1.6, -0.45);
    scene.add(wallBack);
    const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), M(0x150d27, { roughness: 0.95, metalness: 0 }));
    wallLeft.rotation.y = Math.PI / 2;
    wallLeft.position.set(-1.5, 1.6, 2.5);
    scene.add(wallLeft);

    const fx = -0.15, fy = 1.12, fw = 1.7, fh = 0.95, ft = 0.012;
    const led = rgb(0.6);
    scene.add(box(fw, ft, ft, led, fx, fy + fh / 2, -0.435));
    scene.add(box(fw, ft, ft, led, fx, fy - fh / 2, -0.435));
    scene.add(box(ft, fh, ft, led, fx - fw / 2, fy, -0.435));
    scene.add(box(ft, fh, ft, led, fx + fw / 2, fy, -0.435));

    const deskMat = M(0x241d33, { roughness: 0.6, metalness: 0.15 });
    scene.add(box(2.0, 0.04, 0.75, deskMat, 0, 0.73, -0.025));
    scene.add(box(0.04, 0.71, 0.7, deskMat, -0.95, 0.355, -0.025));
    scene.add(box(0.04, 0.71, 0.7, deskMat, 0.95, 0.355, -0.025));
    scene.add(box(1.9, 0.25, 0.02, deskMat, 0, 0.58, -0.37));
    scene.add(box(1.0, 0.004, 0.42, M(0x120d1c, { roughness: 0.95, metalness: 0 }), -0.15, 0.752, 0.1));
    const matEdge = rgb(1.3);
    scene.add(box(1.0, 0.001, 0.006, matEdge, -0.15, 0.7545, 0.311));

    // Objetos de decoração
    const mug = new THREE.Group();
    mug.position.set(0.35, 0.75, -0.2);
    mug.add(cyl(0.035, 0.03, 0.09, M(0xf5f5f5, {roughness:0.4}), 0, 0.045, 0));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 8, 16, Math.PI), M(0xf5f5f5));
    handle.position.set(0.035, 0.045, 0);
    handle.rotation.y = Math.PI / 2;
    mug.add(handle);
    scene.add(mug);

    const plant = new THREE.Group();
    plant.position.set(-0.85, 0.75, -0.2);
    plant.add(cyl(0.04, 0.03, 0.08, M(0xc4bcd9, {roughness:0.9}), 0, 0.04, 0));
    for(let i=0; i<5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M(0x22c55e, {roughness:0.8}));
        leaf.scale.set(1, 2, 1);
        leaf.position.set((Math.random()-0.5)*0.04, 0.1 + Math.random()*0.05, (Math.random()-0.5)*0.04);
        leaf.rotation.z = (Math.random()-0.5)*0.5;
        plant.add(leaf);
    }
    scene.add(plant);
  }

  function buildMonitor() {
    const g = new THREE.Group();
    g.position.set(-0.15, 0.75, -0.2);
    const black = M(0x0d0d12, { roughness: 0.4, metalness: 0.3 });
    g.add(box(0.26, 0.012, 0.17, black, 0, 0.006, 0.0));
    g.add(box(0.045, 0.22, 0.022, black, 0, 0.12, -0.035));
    g.add(box(0.57, 0.33, 0.025, black, 0, 0.255, 0));
    
    // Monitor canvas "vivo"
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 288;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    
    function updateCanvas() {
      const gr = ctx.createLinearGradient(0, 0, 512, 288);
      gr.addColorStop(0, '#1b0b3a'); gr.addColorStop(0.55, '#6d28d9'); gr.addColorStop(1, '#ec4899');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 512, 288);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = 'center';
      ctx.font = '700 44px sans-serif';
      ctx.fillText('meu cantinho', 256, 140);
      ctx.font = '34px sans-serif';
      ctx.fillText('💜', 256, 190);
      
      if (ultVivo) {
        ctx.fillStyle = '#ff4d5f';
        ctx.beginPath();
        ctx.arc(40, 40, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 20px sans-serif';
        ctx.fillText('AO VIVO', 80, 47);
      }
      tex.needsUpdate = true;
    }
    updateCanvas();
    setInterval(updateCanvas, 5000);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.31), B(0xffffff, { map: tex }));
    screen.position.set(0, 0.255, 0.0135);
    g.add(screen);
    scene.add(g);

    const a = anchor(g, 0.2, 0.4, 0.03);
    roomTargets.push({ root: g, fn: function () { abrirItemSetup('per', 4); } });
    addPin('room', '🖥️', 'Monitor', a, [0, 0.2, 1], function () { abrirItemSetup('per', 4); });

    const ph = new THREE.Group();
    ph.position.set(0, 0.255 + 0.165 + 0.04, 0.0);
    const phBody = M(0x16161c, { roughness: 0.25, metalness: 0.6 });
    ph.add(box(0.15, 0.072, 0.008, phBody, 0, 0, 0));
    ph.add(box(0.03, 0.03, 0.006, M(0x23232b, { roughness: 0.3, metalness: 0.5 }), -0.05, 0.02, 0.007));
    const lens = M(0x050507, { roughness: 0.1, metalness: 0.8 });
    const l1 = cyl(0.007, 0.007, 0.004, lens, -0.058, 0.027, 0.012);
    const l2 = cyl(0.007, 0.007, 0.004, lens, -0.042, 0.027, 0.012);
    const l3 = cyl(0.007, 0.007, 0.004, lens, -0.05, 0.013, 0.012);
    [l1, l2, l3].forEach(function (l) { l.rotation.x = Math.PI / 2; ph.add(l); });
    ph.add(box(0.035, 0.02, 0.04, black, 0, -0.045, -0.01));
    g.add(ph);
    roomTargets.unshift({ root: ph, fn: function () { abrirItemSetup('per', 5); } });
    const a2 = anchor(ph, 0, 0.07, 0.02);
    addPin('room', '📷', 'Webcam', a2, [0, 0.3, 1], function () { abrirItemSetup('per', 5); });
  }

  function buildKeyboardMouse() {
    const kb = new THREE.Group();
    kb.position.set(-0.15, 0.754, 0.15);
    kb.add(box(0.37, 0.022, 0.145, M(0xeeeef5, { roughness: 0.35 }), 0, 0.011, 0));
    kb.add(box(0.355, 0.002, 0.132, rgb(2.1), 0, 0.023, 0));
    const keyMat = M(0xfafafd, { roughness: 0.4 });
    const cols = 15, rows = 5, pitch = 0.0228;
    const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0185, 0.008, 0.0185), keyMat, cols * rows + 6);
    const d = new THREE.Object3D();
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        d.position.set(-0.159 + c * pitch, 0.027, -0.052 + r * pitch);
        d.updateMatrix();
        keys.setMatrixAt(n++, d.matrix);
      }
    }
    for (let i = 0; i < 6; i++) {
      const left = i < 3;
      d.position.set(left ? -0.159 + i * pitch * 1.2 : 0.07 + (i - 3) * pitch * 1.2, 0.027, -0.052 + 5 * pitch);
      d.updateMatrix();
      keys.setMatrixAt(n++, d.matrix);
    }
    keys.instanceMatrix.needsUpdate = true;
    kb.add(keys);
    kb.add(box(0.1, 0.008, 0.0185, keyMat, -0.012, 0.027, -0.052 + 5 * pitch));
    scene.add(kb);
    roomTargets.push({ root: kb, fn: function () { abrirItemSetup('per', 0); } });
    addPin('room', '⌨️', 'Teclado', anchor(kb, 0, 0.09, 0.02), [0, 1, 0.4], function () { abrirItemSetup('per', 0); });

    const mo = new THREE.Group();
    mo.position.set(0.17, 0.754, 0.16);
    mo.rotation.y = 0.12;
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M(0xf2f2f8, { roughness: 0.35 }));
    body.scale.set(0.033, 0.019, 0.062);
    body.position.y = 0.008;
    mo.add(body);
    mo.add(box(0.002, 0.001, 0.03, M(0x2a2a34), 0, 0.027, -0.02));
    const logo = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), rgb(3.4));
    logo.position.set(0, 0.022, 0.025);
    mo.add(logo);
    scene.add(mo);
    roomTargets.push({ root: mo, fn: function () { abrirItemSetup('per', 1); } });
    addPin('room', '🖱️', 'Mouse', anchor(mo, 0, 0.07, 0), [0, 1, 0.4], function () { abrirItemSetup('per', 1); });
  }

  function buildMic() {
    const g = new THREE.Group();
    const white = M(0xf4f4f8, { roughness: 0.35 });
    const dark = M(0x25252e, { roughness: 0.5, metalness: 0.3 });
    g.add(box(0.06, 0.03, 0.05, dark, -0.62, 0.765, -0.3));
    g.add(cylBetween(new THREE.Vector3(-0.62, 0.78, -0.3), new THREE.Vector3(-0.62, 1.15, -0.3), 0.009, dark));
    g.add(cylBetween(new THREE.Vector3(-0.62, 1.15, -0.3), new THREE.Vector3(-0.47, 1.03, 0.1), 0.007, dark));
    const mic = new THREE.Group();
    mic.position.set(-0.47, 1.03, 0.1);
    const pivot = new THREE.Group();
    pivot.rotation.x = 1.15;
    const L = 0.16;
    pivot.add(cyl(0.027, 0.027, L, white, 0, L / 2, 0, 24));
    const grille = new THREE.Mesh(new THREE.SphereGeometry(0.031, 16, 12), dark);
    grille.position.y = L + 0.002;
    pivot.add(grille);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0285, 0.0022, 8, 28), rgb(4.2));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = L * 0.35;
    pivot.add(ring);
    mic.add(pivot);
    g.add(mic);
    scene.add(g);
    roomTargets.push({ root: g, fn: function () { abrirItemSetup('per', 3); } });
    addPin('room', '🎙️', 'Microfone', anchor(mic, 0, 0.14, 0.08), [0, 0.2, 1], function () { abrirItemSetup('per', 3); });
  }

  function buildHeadset() {
    const g = new THREE.Group();
    g.position.set(-0.8, 0.75, 0.0);
    const dark = M(0x25252e, { roughness: 0.5, metalness: 0.3 });
    const white = M(0xf4f4f8, { roughness: 0.4 });
    g.add(cyl(0.07, 0.075, 0.014, dark, 0, 0.007, 0, 28));
    g.add(cyl(0.011, 0.011, 0.26, dark, 0, 0.145, 0, 12));
    const hs = new THREE.Group();
    hs.position.set(0, 0.29, 0);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 8, 28, Math.PI), white);
    hs.add(band);
    const cupL = cyl(0.046, 0.046, 0.036, white, -0.088, -0.005, 0, 24);
    const cupR = cyl(0.046, 0.046, 0.036, white, 0.088, -0.005, 0, 24);
    cupL.rotation.z = Math.PI / 2;
    cupR.rotation.z = Math.PI / 2;
    hs.add(cupL); hs.add(cupR);
    const padL = cyl(0.04, 0.04, 0.012, M(0x1c1c24, { roughness: 0.9 }), -0.07, -0.005, 0, 20);
    const padR = cyl(0.04, 0.04, 0.012, M(0x1c1c24, { roughness: 0.9 }), 0.07, -0.005, 0, 20);
    padL.rotation.z = Math.PI / 2;
    padR.rotation.z = Math.PI / 2;
    hs.add(padL); hs.add(padR);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), rgb(5.1));
    badge.position.set(0.1075, -0.005, 0);
    badge.rotation.y = Math.PI / 2;
    hs.add(badge);
    g.add(hs);
    scene.add(g);
    roomTargets.push({ root: g, fn: function () { abrirItemSetup('per', 2); } });
    addPin('room', '🎧', 'Headset', anchor(hs, 0, 0.14, 0), [0, 0.3, 1], function () { abrirItemSetup('per', 2); });
  }

  function buildChairAndCat() {
    const g = new THREE.Group();
    g.position.set(-0.62, 0, 0.98);
    g.rotation.y = Math.PI + 0.5;
    const black = M(0x17141f, { roughness: 0.7, metalness: 0.05 });
    const accent = M(0xa855f7, { roughness: 0.6 });
    const metal = M(0x2b2b36, { roughness: 0.4, metalness: 0.6 });
    for (let k = 0; k < 5; k++) {
      const spoke = box(0.3, 0.03, 0.045, metal, 0.15, 0.09, 0);
      const holder = new THREE.Group();
      holder.rotation.y = (k * Math.PI * 2) / 5;
      holder.add(spoke);
      const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), black);
      wheel.position.set(0.3, 0.035, 0);
      holder.add(wheel);
      g.add(holder);
    }
    g.add(cyl(0.028, 0.028, 0.32, metal, 0, 0.26, 0, 14));
    g.add(box(0.5, 0.1, 0.5, black, 0, 0.46, 0));
    g.add(box(0.36, 0.012, 0.42, accent, 0, 0.516, 0.0));
    const back = new THREE.Group();
    back.position.set(0, 0.52, -0.22);
    back.rotation.x = -0.12;
    back.add(box(0.48, 0.78, 0.09, black, 0, 0.39, 0));
    back.add(box(0.07, 0.62, 0.11, black, -0.245, 0.34, 0.01));
    back.add(box(0.07, 0.62, 0.11, black, 0.245, 0.34, 0.01));
    back.add(box(0.04, 0.55, 0.012, accent, 0, 0.36, 0.05));
    back.add(box(0.26, 0.15, 0.07, black, 0, 0.86, 0.0));
    g.add(back);
    [-1, 1].forEach(function (s) {
      g.add(box(0.03, 0.2, 0.03, metal, s * 0.29, 0.62, 0.04));
      g.add(box(0.07, 0.03, 0.26, black, s * 0.29, 0.73, 0.05));
    });
    scene.add(g);
    const fn = function () { abrirItemSetup('extra', 0); };
    roomTargets.push({ root: g, fn: fn });
    addPin('room', '🪑', 'Cadeira', anchor(g, 0, 1.55, -0.25), [0, 0.3, 1], fn);

    // ----- GATINHO (Easter Egg) -----
    catGroup = new THREE.Group();
    catGroup.position.set(0, 0.52, 0); // Em cima do assento
    catGroup.rotation.y = -0.5;
    
    const catBlack = M(0x111111, { roughness: 0.8 });
    // Corpo
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), catBlack);
    body.scale.set(1, 0.8, 1.3);
    body.position.set(0, 0.06, 0);
    catGroup.add(body);
    
    // Cabeça
    const head = new THREE.Group();
    head.position.set(0, 0.13, 0.1);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), catBlack);
    head.add(skull);
    // Orelhas
    const earGeo = new THREE.ConeGeometry(0.02, 0.04, 4);
    const earL = new THREE.Mesh(earGeo, catBlack); earL.position.set(-0.03, 0.05, 0); earL.rotation.z = 0.2; head.add(earL);
    const earR = new THREE.Mesh(earGeo, catBlack); earR.position.set(0.03, 0.05, 0); earR.rotation.z = -0.2; head.add(earR);
    // Olhos
    const eyeGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const eyeMat = B(0xb7ff00); // Verde neon
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.02, 0.01, 0.045); head.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.02, 0.01, 0.045); head.add(eyeR);
    
    catGroup.add(head);
    
    // Rabo
    const tailGeo = new THREE.CylinderGeometry(0.01, 0.005, 0.15, 8);
    const tail = new THREE.Mesh(tailGeo, catBlack);
    tail.position.set(0, 0.03, -0.12);
    tail.rotation.x = 1.2;
    catGroup.add(tail);
    
    g.add(catGroup);
    
    // Interação do Gato
    roomTargets.push({ root: catGroup, fn: function() {
      playSound('https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3'); // Meow placeholder
      toast('Você encontrou o gatinho! 🐈‍⬛💜', 'ok');
      catBreath = 1; // Pulo
    }});
  }

  function buildPC() {
    const D = 0.45, Hh = 0.48, Wd = 0.23;
    pcGroup = new THREE.Group();
    pcGroup.position.set(0.72, 0.77 + Hh / 2, -0.1);
    scene.add(pcGroup);

    const white = M(0xf3f3f9, { roughness: 0.3, metalness: 0.1 });
    const glass = M(0x9ec0ff, { transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const dark = M(0x15151c, { roughness: 0.5, metalness: 0.3 });

    caseShell = new THREE.Group();
    pcGroup.add(caseShell);
    caseShell.add(box(D, Hh, 0.01, white, 0, 0, -Wd / 2 + 0.005));          
    caseShell.add(box(D, 0.01, Wd, white, 0, Hh / 2 - 0.005, 0));            
    caseShell.add(box(D, 0.01, Wd, white, 0, -Hh / 2 + 0.005, 0));           
    caseShell.add(box(0.01, Hh, Wd, white, D / 2 - 0.005, 0, 0));            
    caseShell.add(box(0.008, Hh, Wd, glass, -D / 2 + 0.004, 0, 0));          
    caseShell.add(box(0.014, Hh, 0.014, white, -D / 2 + 0.007, 0, Wd / 2 - 0.007)); 
    caseShell.add(box(0.05, 0.02, 0.14, dark, -0.16, -Hh / 2 - 0.01, 0));
    caseShell.add(box(0.05, 0.02, 0.14, dark, 0.16, -Hh / 2 - 0.01, 0));

    doorPivot = new THREE.Group();
    doorPivot.position.set(D / 2 - 0.005, 0, Wd / 2);
    const doorW = D - 0.012;
    doorPivot.add(box(doorW, Hh - 0.012, 0.006, glass, -doorW / 2, 0, 0));
    doorPivot.add(box(doorW, 0.012, 0.01, white, -doorW / 2, (Hh - 0.012) / 2 - 0.006, 0));
    doorPivot.add(box(doorW, 0.012, 0.01, white, -doorW / 2, -(Hh - 0.012) / 2 + 0.006, 0));
    doorPivot.add(box(0.012, Hh - 0.012, 0.01, white, -doorW + 0.006, 0, 0));
    doorPivot.add(box(0.012, Hh - 0.012, 0.01, white, -0.006, 0, 0));
    caseShell.add(doorPivot);

    const moboG = new THREE.Group();
    moboG.add(box(0.24, 0.30, 0.004, M(0x17171f, { roughness: 0.6, metalness: 0.2 }), 0.02, 0, -0.1));
    moboG.add(box(0.07, 0.05, 0.016, M(0x3a3a46, { roughness: 0.4, metalness: 0.6 }), -0.065, 0.125, -0.09));  
    moboG.add(box(0.03, 0.14, 0.022, M(0x2b2b36, { roughness: 0.4, metalness: 0.6 }), 0.12, 0.095, -0.088));  
    moboG.add(box(0.03, 0.004, 0.003, B(0xffc83d), 0.12, 0.03, -0.075));                                      
    moboG.add(box(0.2, 0.004, 0.0015, B(0xffc83d), 0.02, -0.14, -0.097));
    moboG.add(box(0.05, 0.05, 0.012, M(0x3a3a46, { roughness: 0.4, metalness: 0.6 }), 0.07, -0.125, -0.093)); 
    pcGroup.add(moboG);

    const cpuG = new THREE.Group();
    cpuG.position.set(-0.02, 0.06, -0.083);
    const pump = cyl(0.04, 0.04, 0.03, dark, 0, 0, 0, 32);
    pump.rotation.x = Math.PI / 2;
    cpuG.add(pump);
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.0032, 8, 36), rgb(0.3));
    pumpRing.position.z = 0.0165;
    cpuG.add(pumpRing);
    const pumpCap = new THREE.Mesh(new THREE.CircleGeometry(0.026, 28), M(0xf3f3f9, { roughness: 0.3 }));
    pumpCap.position.z = 0.0158;
    cpuG.add(pumpCap);
    const pumpDot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), rgb(0.9));
    pumpDot.position.z = 0.0162;
    cpuG.add(pumpDot);
    pcGroup.add(cpuG);

    const coolerG = new THREE.Group();
    coolerG.add(box(0.28, 0.03, 0.12, M(0x1a1a22, { roughness: 0.5, metalness: 0.4 }), -0.05, 0.2, -0.04));
    [-0.115, 0.015].forEach(function (fx, i) {
      coolerG.add(box(0.12, 0.026, 0.12, dark, fx, 0.172, -0.04));
      // Ventoinha
      const fan = new THREE.Group();
      fan.position.set(fx, 0.172, -0.04);
      const fanBlade = box(0.1, 0.02, 0.01, M(0x333), 0, 0, 0);
      fan.add(fanBlade);
      fans.push(fan);
      coolerG.add(fan);
      coolerG.add(box(0.1, 0.004, 0.003, rgb(1.0 + i * 0.7), fx, 0.172, 0.022));
    });
    const tubeMat = M(0x101016, { roughness: 0.6 });
    const c1 = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.045, 0.092, -0.07), new THREE.Vector3(-0.1, 0.14, -0.06), new THREE.Vector3(-0.17, 0.19, -0.06)]);
    const c2 = new THREE.CatmullRomCurve3([new THREE.Vector3(0.0, 0.092, -0.07), new THREE.Vector3(-0.07, 0.15, -0.035), new THREE.Vector3(-0.15, 0.19, -0.03)]);
    coolerG.add(new THREE.Mesh(new THREE.TubeGeometry(c1, 20, 0.007, 8, false), tubeMat));
    coolerG.add(new THREE.Mesh(new THREE.TubeGeometry(c2, 20, 0.007, 8, false), tubeMat));
    pcGroup.add(coolerG);

    const ramG = new THREE.Group();
    [0.067, 0.082].forEach(function (rx, i) {
      ramG.add(box(0.007, 0.135, 0.03, M(0x2b2b36, { roughness: 0.4, metalness: 0.5 }), rx, 0.06, -0.083));
      ramG.add(box(0.008, 0.13, 0.004, rgb(1.6 + i * 0.5), rx, 0.06, -0.066));
    });
    pcGroup.add(ramG);

    const ssdG = new THREE.Group();
    ssdG.add(box(0.075, 0.02, 0.008, M(0x3a3a48, { roughness: 0.4, metalness: 0.6 }), -0.035, -0.03, -0.094));
    ssdG.add(box(0.04, 0.006, 0.0015, B(0xa855f7), -0.045, -0.03, -0.0895));
    pcGroup.add(ssdG);

    const gpuG = new THREE.Group();
    gpuG.add(box(0.24, 0.045, 0.11, M(0xf5f5fa, { roughness: 0.3, metalness: 0.15 }), 0.02, -0.09, -0.043));
    gpuG.add(box(0.2, 0.008, 0.002, M(0x2a2a38), 0.02, -0.09, 0.013));
    gpuG.add(box(0.05, 0.004, 0.002, B(0xb7ff00), 0.1, -0.09, 0.0135));
    gpuG.add(box(0.18, 0.001, 0.06, M(0x2a2a38), 0.02, -0.0674, -0.043));
    // Ventoinha GPU
    const gpuFan = new THREE.Group();
    gpuFan.position.set(0.02, -0.09, -0.012);
    const gpuBlade = box(0.06, 0.06, 0.002, M(0x333), 0, 0, 0);
    gpuFan.add(gpuBlade);
    fans.push(gpuFan);
    gpuG.add(gpuFan);
    pcGroup.add(gpuG);

    const psuG = new THREE.Group();
    psuG.add(box(0.4, 0.07, 0.18, white, 0.005, -0.2, -0.02));
    const psuTex = textTex(512, 128, function (c, w, h) {
      c.fillStyle = '#15151c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.textAlign = 'center';
      c.font = '700 54px sans-serif'; c.fillText('CORSAIR', w / 2, 62);
      c.fillStyle = '#b7ff00'; c.font = '600 32px sans-serif'; c.fillText('RM800', w / 2, 104);
    });
    const psuPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), B(0xffffff, { map: psuTex }));
    psuPlate.position.set(0.0, -0.2, 0.0705);
    psuG.add(psuPlate);
    psuG.add(box(0.4, 0.004, 0.003, rgb(2.4), 0.005, -0.166, 0.07));
    pcGroup.add(psuG);

    const inner = new THREE.PointLight(0xa855f7, 0.9, 1.1);
    inner.position.set(0.72, 1.03, -0.02);
    scene.add(inner);

    const ctx = function (i) { return function () { abrirItemSetup('pc', i); }; };
    pcTargets.push({ root: cpuG, fn: ctx(0) });
    pcTargets.push({ root: gpuG, fn: ctx(1) });
    pcTargets.push({ root: ramG, fn: ctx(2) });
    pcTargets.push({ root: moboG, fn: ctx(3) });
    pcTargets.push({ root: coolerG, fn: ctx(5) });
    pcTargets.push({ root: ssdG, fn: ctx(6) });
    pcTargets.push({ root: psuG, fn: ctx(7) });
    pcTargets.push({ root: caseShell, fn: ctx(4) });

    roomTargets.push({ root: pcGroup, fn: enterPC });
    addPin('room', '💻', 'PC Gamer (clique para abrir)', anchor(pcGroup, 0, Hh / 2 + 0.05, 0), [0, 0.3, 1], enterPC);

    addPin('pc', '🧠', 'Processador', anchor(pcGroup, -0.02, 0.06, -0.06), [0, 0, 1], ctx(0));
    addPin('pc', '🎮', 'Placa de Vídeo', anchor(pcGroup, 0.06, -0.09, 0.018), [0, 0, 1], ctx(1));
    addPin('pc', '🧩', 'Memória RAM', anchor(pcGroup, 0.075, 0.14, -0.06), [0, 0, 1], ctx(2));
    addPin('pc', '🔌', 'Placa Mãe', anchor(pcGroup, 0.115, -0.13, -0.09), [0, 0, 1], ctx(3));
    addPin('pc', '🗄️', 'Gabinete', anchor(pcGroup, -0.2, -0.02, 0.1), [0, 0, 1], ctx(4));
    addPin('pc', '💧', 'Water Cooler', anchor(pcGroup, -0.115, 0.172, 0.03), [0, 0, 1], ctx(5));
    addPin('pc', '💾', 'SSD NVMe', anchor(pcGroup, -0.035, -0.03, -0.08), [0, 0, 1], ctx(6));
    addPin('pc', '⚡', 'Fonte', anchor(pcGroup, 0.12, -0.2, 0.075), [0, 0, 1], ctx(7));
  }

  function buildRain() {
    const geo = new THREE.BufferGeometry();
    const count = 400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3] = -3.5 + Math.random() * 2.0; // X (fora da janela)
      pos[i*3+1] = Math.random() * 3.2;      // Y
      pos[i*3+2] = -0.4 + Math.random() * 0.5; // Z
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.015, transparent: true, opacity: 0.6 });
    rainMesh = new THREE.Points(geo, mat);
    scene.add(rainMesh);
  }

  function buildLights() {
    scene.add(new THREE.AmbientLight(0x7a5cb8, 0.55));
    scene.add(new THREE.HemisphereLight(0xb9a6ff, 0x1a0f2b, 0.45));
    const p1 = new THREE.PointLight(0xa855f7, 0.9, 6); p1.position.set(0.7, 1.7, 0.9); scene.add(p1);
    const p2 = new THREE.PointLight(0xff6ec7, 0.6, 5); p2.position.set(-1.0, 1.3, 0.6); scene.add(p2);
    const p3 = new THREE.PointLight(0x7dd3fc, 0.5, 5); p3.position.set(1.2, 0.6, 0.6); scene.add(p3);
    const p4 = new THREE.PointLight(0xcbb8ff, 0.55, 2); p4.position.set(-0.15, 1.05, 0.35); scene.add(p4);
    const p5 = new THREE.PointLight(0xa855f7, 0.7, 3); p5.position.set(-0.15, 1.3, -0.3); scene.add(p5);
  }

  /* ============================================================
     PINS (pontinhos clicáveis em HTML sobre o 3D)
     ============================================================ */
  function addPin(pinMode, icon, label, anch, face, fn) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 's3d-pin';
    el.setAttribute('aria-label', label);
    const ic = document.createElement('span');
    ic.textContent = icon;
    const lb = document.createElement('span');
    lb.className = 's3d-pin-label';
    lb.textContent = label;
    el.appendChild(ic);
    el.appendChild(lb);
    el.addEventListener('click', function (e) { 
      e.stopPropagation(); 
      if (!flying) {
        playSound('https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3'); // Click sound
        fn(); 
      }
    });
    pinLayer.appendChild(el);
    pins.push({ el: el, mode: pinMode, anchor: anch, face: new THREE.Vector3(face[0], face[1], face[2]).normalize(), on: false });
  }

  function updatePins() {
    camera.getWorldPosition(camV);
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      let show = !flying && p.mode === mode;
      if (show) {
        p.anchor.getWorldPosition(tmpV);
        const toCam = camV.clone().sub(tmpV).normalize();
        if (toCam.dot(p.face) < 0.1) show = false;
        else {
          tmpV.project(camera);
          if (tmpV.z > 1 || tmpV.z < -1) show = false;
          else {
            const x = (tmpV.x * 0.5 + 0.5) * W;
            const y = (-tmpV.y * 0.5 + 0.5) * H;
            p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
          }
        }
      }
      if (show !== p.on) {
        p.on = show;
        p.el.classList.toggle('on', show);
      }
    }
  }

  /* ============================================================
     INTERAÇÃO: clique nos objetos 3D
     ============================================================ */
  function isInside(obj, root) {
    let o = obj;
    while (o) { if (o === root) return true; o = o.parent; }
    return false;
  }
  function pick(ev) {
    if (!built || flying) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const targets = mode === 'room' ? roomTargets : pcTargets;
    const roots = targets.map(function (t) { return t.root; });
    const hits = raycaster.intersectObjects(roots, true);
    if (!hits.length) return null;
    for (let i = 0; i < targets.length; i++) {
      if (isInside(hits[0].object, targets[i].root)) return targets[i];
    }
    return null;
  }

  function bindPointer() {
    const el = renderer.domElement;
    let down = null, moveQueued = false, lastMove = null;
    el.addEventListener('pointerdown', function (e) { 
      down = { x: e.clientX, y: e.clientY, t: performance.now() }; 
      initAudio(); // Inicia o contexto de áudio no primeiro clique
    });
    el.addEventListener('pointerup', function (e) {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      const dt = performance.now() - down.t;
      down = null;
      if (dx * dx + dy * dy > 36 || dt > 600) return;
      const t = pick(e);
      if (t) {
        playSound('https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3');
        t.fn();
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      lastMove = e;
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(function () {
        moveQueued = false;
        if (!lastMove) return;
        el.style.cursor = pick(lastMove) ? 'pointer' : 'grab';
      });
    });
    el.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.08 : 0.92); }
    }, { passive: false });
  }

  function zoomBy(f) {
    if (!built || flying) return;
    const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
    camera.position.copy(controls.target).add(off);
    controls.update();
  }

  /* ============================================================
     ABRIR / FECHAR O PC
     ============================================================ */
  function setMode(m) {
    mode = m;
    wrap.setAttribute('data-mode', m);
    hintEl.textContent = m === 'pc'
      ? '🔧 Clique nos componentes para ver os detalhes'
      : '🖱️ Arraste para girar · clique nos pontinhos 💜 para ver cada item';
  }

  function enterPC() {
    if (mode !== 'room' || flying) return;
    savedPose = { pos: camera.position.clone(), target: controls.target.clone() };
    setMode('pc');
    const c = pcGroup.getWorldPosition(new THREE.Vector3());
    const aspect = Math.max(0.4, W / Math.max(1, H));
    const dist = Math.max(0.95, 0.8 / aspect + 0.1);
    const toPos = new THREE.Vector3(c.x - 0.1, c.y + 0.04, c.z + dist);
    controls.minDistance = 0.35;
    controls.maxDistance = 2.4;
    tween(900, function (e) { doorPivot.rotation.y = DOOR_OPEN * e; });
    flyTo(toPos, c, 1100);
  }

  function exitPC() {
    if (mode !== 'pc' || flying) return;
    setMode('room');
    const pose = savedPose || roomPose();
    controls.minDistance = 0.9;
    controls.maxDistance = 6;
    tween(900, function (e) { doorPivot.rotation.y = DOOR_OPEN * (1 - e); });
    flyTo(pose.pos, pose.target, 1100);
  }

  function resetView() {
    if (!built || flying) return;
    if (mode === 'pc') { exitPC(); return; }
    const pose = roomPose();
    flyTo(pose.pos, pose.target, 900);
  }

  /* ============================================================
     LOOP, RESIZE E INICIALIZAÇÃO
     ============================================================ */
  function animateRGB(t, speed) {
    for (let i = 0; i < rgbMats.length; i++) {
      const r = rgbMats[i];
      if (speed === 0) {
         // Se a cor for definida (ex: controle de LED), mantemos
      } else {
         r.m.color.setHSL(0.72 + 0.14 * Math.sin(t * 0.9 + r.off), 0.9, 0.58);
      }
    }
  }
  
  let globalLedSpeed = 1;
  let globalLedHue = null;

  function tick() {
    raf = 0;
    if (!built || !visible) return;
    const now = performance.now();
    runTweens(now);
    if (controls.enabled) controls.update();
    
    // Animações
    if (globalLedHue !== null) {
      rgbMats.forEach(r => r.m.color.setHSL(globalLedHue, 0.9, 0.58));
    } else {
      animateRGB(now / 1000);
    }

    if (rainMesh) {
      const positions = rainMesh.geometry.attributes.position.array;
      for(let i=0; i<positions.length; i+=3) {
        positions[i+1] -= 0.03;
        if (positions[i+1] < 0) positions[i+1] = 3.2;
      }
      rainMesh.geometry.attributes.position.needsUpdate = true;
    }

    if (catGroup) {
      catBreath += 0.05;
      catGroup.scale.y = 1 + Math.sin(catBreath) * 0.03;
      if (catGroup.children[2]) catGroup.children[2].rotation.y = Math.sin(catBreath * 0.5) * 0.2; // rabo
    }

    fans.forEach(f => { f.rotation.z += 0.2; });

    updatePins();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && built && visible) raf = requestAnimationFrame(tick); }

  function resize(w, h) {
    W = w; H = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function addHud() {
    pinLayer = document.createElement('div');
    pinLayer.className = 's3d-pins';
    wrap.appendChild(pinLayer);

    hintEl = document.createElement('div');
    hintEl.className = 's3d-hint';
    wrap.appendChild(hintEl);

    const ctrls = document.createElement('div');
    ctrls.className = 's3d-ctrls';
    [['+', 'Aproximar', function () { zoomBy(0.8); }],
     ['−', 'Afastar', function () { zoomBy(1.25); }],
     ['⟲', 'Voltar à visão inicial', resetView]].forEach(function (b) {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 's3d-btn';
      bt.textContent = b[0];
      bt.title = b[1];
      bt.setAttribute('aria-label', b[1]);
      bt.addEventListener('click', b[2]);
      ctrls.appendChild(bt);
    });
    wrap.appendChild(ctrls);

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 's3d-back';
    back.textContent = '← Voltar ao setup';
    back.addEventListener('click', exitPC);
    wrap.appendChild(back);

    // CONTROLE DE LED
    ledPanel = document.createElement('div');
    ledPanel.className = 's3d-led-panel';
    ['purple', 'pink', 'cyan', 'gold', 'off'].forEach(c => {
      const btn = document.createElement('button');
      btn.className = 's3d-led-color';
      btn.dataset.color = c;
      btn.title = 'Mudar cor do LED';
      btn.addEventListener('click', () => {
        if (c === 'purple') globalLedHue = 0.72;
        else if (c === 'pink') globalLedHue = 0.88;
        else if (c === 'cyan') globalLedHue = 0.55;
        else if (c === 'gold') globalLedHue = 0.12;
        else if (c === 'off') globalLedHue = 0; // Actually black/off
        initAudio();
        playAmbient();
      });
      ledPanel.appendChild(btn);
    });
    wrap.appendChild(ledPanel);
  }

  function showFallback(msg) {
    const d = document.createElement('div');
    d.className = 's3d-fallback';
    d.innerHTML = '<div><span style="font-size:2.4rem">🖥️</span><p>' + msg + '</p></div>';
    container.appendChild(d);
  }

  function build(w, h) {
    tmpV = new THREE.Vector3();
    camV = new THREE.Vector3();
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      showFallback('Seu navegador não conseguiu abrir o modo 3D. Tente atualizar o navegador 💜');
      built = false;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x0a0511, 1);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;cursor:grab';
    container.appendChild(renderer.domElement);
    W = w; H = h;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 40);
    raycaster = new THREE.Raycaster();

    addHud();
    buildLights();
    buildRoom();
    buildMonitor();
    buildKeyboardMouse();
    buildMic();
    buildHeadset();
    buildChairAndCat();
    buildPC();
    buildRain();

    const pose = roomPose();
    camera.position.copy(pose.pos);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(pose.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.7;
    controls.minDistance = 0.9;
    controls.maxDistance = 6;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    setMode('room');
    bindPointer();
    scene.updateMatrixWorld(true);
    built = true;
    kick();
  }

  function init() {
    if (started) return;
    container = document.getElementById('setup360Container');
    if (!container) return;
    started = true;
    wrap = container.closest('.setup-360-wrap') || container;
    if (typeof THREE === 'undefined' || !THREE.OrbitControls) {
      showFallback('Não consegui carregar o 3D agora. Recarregue a página 💜');
      return;
    }
    const ro = new ResizeObserver(function () {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      if (!built) build(w, h);
      else resize(w, h);
    });
    ro.observe(container);
    const io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }, { threshold: 0.01 });
    io.observe(container);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mode === 'pc' && !document.querySelector('dialog[open]')) exitPC();
    });
  }

  return { init: init };
})();

function setupSetup3D() { Setup3D.init(); }
window.setupSetup3D = setupSetup3D;
document.addEventListener('DOMContentLoaded', function () { setupSetup3D(); });