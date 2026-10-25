/* ============================================================
   SETUP — CENA 3D INTERATIVA PREMIUM + SONHOS
   ============================================================ */
let _sonhoSelecionado = null;
const SETUP_VIEW_KEY = 'setup_view_v1';
let setupView = '3d';
let setupBusca = '';
let SETUP_DATA = [];
let SONHOS_DATA = [];

/* Stubs para compatibilidade com main.js antigo */
function setupRender() {}
function setupSetView() {}
window.setupRender = setupRender;
window.setupSetView = setupSetView;

/* ============================================================
   CARREGAR DADOS DA API
   ============================================================ */
async function carregarSetupData() {
  try {
    const r = await fetch('/api/config?action=setup');
    const d = await r.json();
    if (d.setup) SETUP_DATA = d.setup;
    if (d.sonhos) SONHOS_DATA = d.sonhos;
  } catch (e) {
    console.error('Erro ao carregar setup:', e);
  }
}

/* ============================================================
   MODAL DE ITEM
   ============================================================ */
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
        ${it.benchmark ? `<div class="smi-benchmark">📊 ${esc(it.benchmark)}</div>` : ''}
        <div class="smi-actions">
          <button class="btn" onclick="copiarLinkItem('${esc(it.nome)}')">🔗 Compartilhar</button>
          <a class="btn ghost" href="https://www.kabum.com.br/busca/${encodeURIComponent(it.nome)}" target="_blank" rel="noopener">🛒 KaBuM!</a>
        </div>
      </div>
    </div>
  `;
  $('dlg').showModal();
}
window.abrirItemSetup = abrirItemSetup;

function copiarLinkItem(nome){
  const url = window.location.origin + '/#setup/' + encodeURIComponent(nome);
  navigator.clipboard.writeText(url);
  toast('Link copiado! 💜', 'ok');
}
window.copiarLinkItem = copiarLinkItem;

/* ============================================================
   SONHOS / APOIADORES
   ============================================================ */
function renderSonhos(){
  const lista = $('sonhosLista'); if(!lista) return;
  if(!SONHOS_DATA.length){
    lista.innerHTML = `<div class="sir-empty"><span>✨</span><small>Nenhum sonho cadastrado ainda 💜</small></div>`;
    return;
  }
  lista.innerHTML = SONHOS_DATA.map(s => {
    const pct = s.meta > 0 ? Math.min(100, Math.round((s.arrecadado / s.meta) * 100)) : 0;
    const meta100 = pct >= 100;
    return `
      <div class="sonho-card ${meta100 ? 'meta-conquistada' : ''}">
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
          <div class="sonho-bar"><i style="width:${pct}%"></i></div>
          <div class="sonho-meta-info">
            <b>${fmtBRL(s.arrecadado)}</b>
            <span>de ${fmtBRL(s.meta)}</span>
            <span class="sonho-pct">${pct}%</span>
          </div>
        </div>
        <div class="sonho-actions">
          <button type="button" class="btn" onclick="abrirContribuirSonho('${esc(s.id)}')">💜 Apoiar</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderApoiadores(){
  const lista = $('apoiadoresLista'); if(!lista) return;
  const todos = [];
  SONHOS_DATA.forEach(s => (s.contribuintes || []).forEach(c => todos.push({ nome: c.nome, valor: c.valor })));
  if(!todos.length){
    lista.innerHTML = `<div class="sir-empty"><span>🏆</span><small>Ninguém ainda. Seja o primeiro 💜</small></div>`;
    return;
  }
  const porPessoa = {};
  todos.forEach(t => {
    if(!porPessoa[t.nome]) porPessoa[t.nome] = { nome: t.nome, total: 0 };
    porPessoa[t.nome].total += t.valor;
  });
  const ranking = Object.values(porPessoa).sort((a,b) => b.total - a.total);
  lista.innerHTML = ranking.map((p, i) => `
    <div class="apoiador-row">
      <span class="ar-pos">${['🥇','🥈','🥉'][i] || '🎗️'}</span>
      <span class="ar-nome">@${esc(p.nome)}</span>
      <span class="ar-total">${fmtBRL(p.total)}</span>
    </div>
  `).join('');
}

function abrirContribuirSonho(id){
  const s = SONHOS_DATA.find(x => x.id === id);
  if(!s) return;
  $('dTitle').textContent = '💜 Apoiar ' + s.nome;
  $('dBody').innerHTML = `
    <div class="contribuir-modal">
      <div class="cm-head"><span class="cm-ic">${s.icon}</span><div><b>${esc(s.nome)}</b><small>${esc(s.cat)}</small></div></div>
      <div class="cm-pix">
        <label>📋 Chave Pix</label>
        <div class="cm-pix-box">
          <input type="text" id="pixKeyInput" value="${esc(CONFIG.pixKey)}" readonly>
          <button type="button" class="btn ghost" onclick="copiarPix()">📋 Copiar</button>
        </div>
      </div>
      <p style="text-align:center;color:var(--mute);font-size:.85rem;margin-top:12px">Após o Pix, avise a Soso no Discord para confirmar!</p>
    </div>
  `;
  $('dlg').showModal();
}
window.abrirContribuirSonho = abrirContribuirSonho;

function copiarPix(){
  navigator.clipboard.writeText($('pixKeyInput').value);
  toast('Chave Pix copiada! 💜', 'ok');
}
window.copiarPix = copiarPix;

/* ============================================================
   THREE.JS — CENA 3D (UPGRADE PREMIUM)
   ============================================================ */
const Setup3D = (function () {
  let started = false, built = false, visible = false;
  let container, wrap, pinLayer, hintEl, ledPanel, W = 0, H = 0;
  let renderer, scene, camera, controls, raycaster;
  let composer, bloomPass, fxaaPass;
  let pcGroup, caseShell, doorPivot;
  let mode = 'room';
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

  let rainMesh, rainVel = [];
  let catGroup, catBreath = 0, catTail;
  let fans = [];
  let coffeeSteam;
  let interactiveKeys = [];
  let ambientAudio = null;
  let isMuted = false;
  let isNight = false;
  let audioCtx = null;
  let globalLedHue = 0.75; // Roxo/Neon
  let tourIndex = -1;
  let tourTimer = null;
  let lowQuality = false;
  let monitorTex, monitorCtx, monitorCanvas;

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      if(!ambientAudio) {
        ambientAudio = new Audio('https://cdn.pixabay.com/audio/2022/11/22/audio_4b5f4d363a.mp3');
        ambientAudio.loop = true;
        ambientAudio.volume = 0.15;
        if(!isMuted) ambientAudio.play().catch(()=>{});
      }
    } catch(e) {}
  }

  function playClick() {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  }

  function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.1 }, o || {})); }
  function B(color, o) { return new THREE.MeshBasicMaterial(Object.assign({ color }, o || {})); }
  function rgb(off) { const m = B(0xa855f7); rgbMats.push({ m, off: off || 0 }); return m; }
  function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x||0, y||0, z||0); m.castShadow = true; m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, x, y, z, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg||20), mat); m.position.set(x||0, y||0, z||0); m.castShadow = true; m.receiveShadow = true; return m; }
  function anchor(parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur, fn, done }); }
  function runTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(ease(k));
      if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
    }
  }
  function flyTo(pos, target, dur, done) {
    const p0 = camera.position.clone();
    const t0 = controls.target.clone();
    flying = true; controls.enabled = false;
    tween(dur, (e) => {
      camera.position.lerpVectors(p0, pos, e);
      controls.target.lerpVectors(t0, target, e);
      camera.lookAt(controls.target);
    }, () => {
      camera.position.copy(pos); controls.target.copy(target);
      flying = false; controls.enabled = true; controls.update();
      if (done) done();
    });
  }

  function roomPose() {
    const aspect = Math.max(0.4, W / Math.max(1, H));
    const dist = Math.min(5.5, Math.max(2.8, 3.0 / aspect));
    const dir = new THREE.Vector3(1.4, 0.55, 2.35).normalize();
    const target = new THREE.Vector3(0.05, 0.98, 0);
    const pos = target.clone().addScaledVector(dir, dist);
    return { pos, target };
  }

  /* ---------- Construção da Cena ---------- */
  function buildRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), M(0x15101f, { roughness: 0.8, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Tapete/Carpete
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), M(0x2a1a4d, { roughness: 0.95, metalness: 0 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0.75); rug.receiveShadow = true;
    scene.add(rug);

    // Parede Fundo
    const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), M(0x1a1030, { roughness: 0.9, metalness: 0 }));
    wallBack.position.set(0, 1.6, -0.5); wallBack.receiveShadow = true;
    scene.add(wallBack);

    // Janela com Chuva (Corrigida)
    const windowGroup = new THREE.Group();
    windowGroup.position.set(-1.2, 1.6, -0.49);
    
    // Moldura
    windowGroup.add(box(0.7, 0.9, 0.05, M(0x222222), 0, 0, 0));
    
    // Vidro Fumê
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x111122, transmission: 0.9, opacity: 0.6, transparent: true, roughness: 0.1, metalness: 0.1 });
    windowGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), glassMat));
    scene.add(windowGroup);

    // Chuva do lado de fora (Atrás do vidro)
    const geo = new THREE.BufferGeometry();
    const count = 400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3] = -1.5 + Math.random() * 0.6;
      pos[i*3+1] = 1.2 + Math.random() * 0.8;
      pos[i*3+2] = -0.6 - Math.random() * 0.2; // Mais para trás
      rainVel.push(0.01 + Math.random() * 0.02);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rainMesh = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.008, transparent: true, opacity: 0.4 }));
    scene.add(rainMesh);

    // Letreiro Neon (asemtet0) na parede
    const signGroup = new THREE.Group();
    signGroup.position.set(1.2, 1.8, -0.48);
    const signBg = box(0.6, 0.25, 0.02, M(0x050309), 0, 0, 0);
    signGroup.add(signBg);
    
    // Canvas para o texto Neon
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 213;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#000'; sCtx.fillRect(0,0,512,213);
    sCtx.font = 'bold 70px sans-serif';
    sCtx.fillStyle = '#c084fc';
    sCtx.shadowColor = '#a855f7';
    sCtx.shadowBlur = 20;
    sCtx.textAlign = 'center';
    sCtx.fillText('asemtet0', 256, 120);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.23), B(0xffffff, { map: signTex, transparent: true }));
    signPlane.position.z = 0.011;
    signGroup.add(signPlane);
    scene.add(signGroup);

    // Mesa Branca
    const deskMat = M(0xf0f0f5, { roughness: 0.4, metalness: 0.1 });
    const desk = box(2.0, 0.04, 0.75, deskMat, 0, 0.73, -0.025);
    scene.add(desk);
    scene.add(box(0.04, 0.71, 0.7, deskMat, -0.95, 0.355, -0.025));
    scene.add(box(0.04, 0.71, 0.7, deskMat, 0.95, 0.355, -0.025));

    // Mousepad Grande
    const mat = box(1.1, 0.005, 0.45, M(0x101015, { roughness: 0.9 }), -0.15, 0.753, 0.1);
    scene.add(mat);

    // Xícara com Vapor
    const mug = new THREE.Group();
    mug.position.set(0.4, 0.75, -0.2);
    mug.add(cyl(0.035, 0.03, 0.09, M(0xf5f5f5), 0, 0.045, 0));
    scene.add(mug);

    const steamGeo = new THREE.BufferGeometry();
    const steamPos = new Float32Array(20 * 3);
    for(let i=0; i<20; i++) { steamPos[i*3] = 0.4; steamPos[i*3+1] = 0.8; steamPos[i*3+2] = -0.2; }
    steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
    coffeeSteam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.015, transparent: true, opacity: 0.2 }));
    scene.add(coffeeSteam);

    // Suporte de Headset
    const hsStand = new THREE.Group();
    hsStand.position.set(-0.8, 0.75, -0.1);
    hsStand.add(cyl(0.05, 0.06, 0.02, M(0x222222), 0, 0.01, 0));
    hsStand.add(cyl(0.01, 0.01, 0.2, M(0x222222), 0, 0.1, 0));
    const headset = box(0.08, 0.04, 0.1, M(0xf0f0f0), 0, 0.2, 0);
    hsStand.add(headset);
    scene.add(hsStand);
    addPin('room', '🎧', 'Headset', anchor(hsStand, 0, 0.2, 0), [0, 1, 0.4], () => abrirItemSetup('per', 2));
  }

  function buildMonitor() {
    const g = new THREE.Group();
    g.position.set(-0.15, 0.75, -0.2);
    
    // Monitor Branco
    const white = M(0xe8e8e8, { roughness: 0.3, metalness: 0.1 });
    
    const stand = box(0.26, 0.015, 0.17, white, 0, 0.007, 0); g.add(stand);
    g.add(box(0.05, 0.22, 0.025, white, 0, 0.12, -0.035));
    
    const screenFrame = box(0.61, 0.37, 0.025, white, 0, 0.27, 0);
    g.add(screenFrame);

    // Canvas do Monitor (Alta Resolução)
    monitorCanvas = document.createElement('canvas');
    monitorCanvas.width = 1024; monitorCanvas.height = 576;
    monitorCtx = monitorCanvas.getContext('2d');
    monitorTex = new THREE.CanvasTexture(monitorCanvas);

    function updateMonitor() {
      if (window.ultVivo) {
        // Tela da Live
        const gr = monitorCtx.createLinearGradient(0, 0, 1024, 576);
        gr.addColorStop(0, '#1b0b3a'); gr.addColorStop(0.55, '#6d28d9'); gr.addColorStop(1, '#ec4899');
        monitorCtx.fillStyle = gr; monitorCtx.fillRect(0, 0, 1024, 576);
        
        // Borda AO VIVO
        monitorCtx.fillStyle = '#ff4d5f';
        monitorCtx.fillRect(40, 40, 180, 50);
        monitorCtx.fillStyle = '#fff';
        monitorCtx.font = 'bold 30px sans-serif';
        monitorCtx.fillText('AO VIVO', 75, 75);
        
        monitorCtx.font = 'bold 60px sans-serif';
        monitorCtx.fillStyle = 'rgba(255,255,255,0.9)';
        monitorCtx.textAlign = 'center';
        monitorCtx.fillText(window.ultGame ? window.ultGame.name : 'Live na Twitch', 512, 320);
      } else {
        // Tela Offline (Wallpaper Bonito)
        const gr = monitorCtx.createLinearGradient(0, 0, 1024, 576);
        gr.addColorStop(0, '#050309'); gr.addColorStop(1, '#1a1035');
        monitorCtx.fillStyle = gr; monitorCtx.fillRect(0, 0, 1024, 576);
        
        monitorCtx.font = 'bold 80px sans-serif';
        monitorCtx.fillStyle = '#a855f7';
        monitorCtx.textAlign = 'center';
        monitorCtx.fillText('asemtet0', 512, 300);
        monitorCtx.font = '40px sans-serif';
        monitorCtx.fillStyle = '#c084fc';
        monitorCtx.fillText('offline 💜', 512, 380);
      }
      monitorTex.needsUpdate = true;
    }
    
    updateMonitor();
    setInterval(updateMonitor, 5000);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.59, 0.35), B(0xffffff, { map: monitorTex }));
    screen.position.set(0, 0.27, 0.0135);
    g.add(screen);
    scene.add(g);

    addPin('room', '🖥️', 'Monitor', anchor(g, 0.2, 0.4, 0.03), [0, 0.2, 1], () => abrirItemSetup('per', 4));
  }

  function buildKeyboardMouse() {
    const kb = new THREE.Group();
    kb.position.set(-0.15, 0.755, 0.15);
    
    // Teclado TKL Branco
    const kbBase = box(0.3, 0.022, 0.12, M(0xf0f0f0), 0, 0.011, 0);
    kb.add(kbBase);
    
    // Luz RGB do teclado (Under-glow)
    const glow = box(0.31, 0.005, 0.13, rgb(2.0), 0, 0.005, 0);
    kb.add(glow);

    const keyMat = M(0xffffff);
    const cols = 12, rows = 5, pitch = 0.022;
    const keysGeo = new THREE.BoxGeometry(0.018, 0.008, 0.018);
    const keys = new THREE.InstancedMesh(keysGeo, keyMat, cols * rows);
    const d = new THREE.Object3D();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        d.position.set(-0.126 + c * pitch, 0.027, -0.044 + r * pitch); d.updateMatrix();
        keys.setMatrixAt(i, d.matrix);
      }
    }
    keys.instanceMatrix.needsUpdate = true;
    kb.add(keys);
    interactiveKeys.push(keys);
    scene.add(kb);
    addPin('room', '⌨️', 'Teclado', anchor(kb, 0, 0.09, 0.02), [0, 1, 0.4], () => abrirItemSetup('per', 0));

    // Mouse Branco
    const mo = new THREE.Group();
    mo.position.set(0.12, 0.755, 0.16);
    const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M(0xf0f0f0));
    mouseBody.scale.set(0.03, 0.018, 0.055); mouseBody.position.y = 0.008; 
    mo.add(mouseBody);
    const mouseGlow = box(0.02, 0.002, 0.04, rgb(2.0), 0, 0.02, 0);
    mo.add(mouseGlow);
    scene.add(mo);
    addPin('room', '🖱️', 'Mouse', anchor(mo, 0, 0.07, 0), [0, 1, 0.4], () => abrirItemSetup('per', 1));

    // Braço do Microfone
    const micArm = new THREE.Group();
    micArm.position.set(-0.7, 0.75, -0.2);
    micArm.add(cyl(0.04, 0.04, 0.02, M(0x111111), 0, 0.01, 0)); 
    const arm1 = cyl(0.01, 0.01, 0.4, M(0x222222), 0.1, 0.2, 0); arm1.rotation.z = -0.5; micArm.add(arm1);
    const arm2 = cyl(0.01, 0.01, 0.3, M(0x222222), 0.25, 0.35, 0); arm2.rotation.z = 0.8; micArm.add(arm2);
    const mic = cyl(0.02, 0.02, 0.1, M(0xffffff), 0.35, 0.25, 0); mic.rotation.x = Math.PI/2; micArm.add(mic);
    scene.add(micArm);
    addPin('room', '🎙️', 'Microfone', anchor(micArm, 0.35, 0.25, 0), [0, 1, 0.4], () => abrirItemSetup('per', 3));
  }

  function buildPC() {
    const D = 0.45, Hh = 0.48, Wd = 0.23;
    pcGroup = new THREE.Group();
    pcGroup.position.set(0.72, 0.77 + Hh / 2, -0.1);
    scene.add(pcGroup);

    // Branco Fosco 
    const white = M(0xe0e0e5, { roughness: 0.4, metalness: 0.05 });
    const dark = M(0x15151c, { roughness: 0.5, metalness: 0.3 });
    
    // Vidro Fumê 
    const glass = new THREE.MeshPhysicalMaterial({ 
      color: 0x111111, transmission: 0.95, opacity: 0.2, transparent: true, roughness: 0.05, metalness: 0.1, depthWrite: false 
    });

    caseShell = new THREE.Group();
    pcGroup.add(caseShell);
    
    // Estrutura do Gabinete
    caseShell.add(box(D, Hh, 0.01, white, 0, 0, -Wd / 2 + 0.005));
    caseShell.add(box(D, 0.01, Wd, white, 0, Hh / 2 - 0.005, 0));
    caseShell.add(box(D, 0.01, Wd, white, 0, -Hh / 2 + 0.005, 0));
    caseShell.add(box(0.01, Hh, Wd, white, D / 2 - 0.005, 0, 0));
    
    // Vidro Lateral
    caseShell.add(box(0.008, Hh, Wd, glass, -D / 2 + 0.004, 0, 0));

    // Porta Frontal (Vidro)
    doorPivot = new THREE.Group();
    doorPivot.position.set(D / 2 - 0.005, 0, Wd / 2);
    const doorW = D - 0.012;
    doorPivot.add(box(doorW, Hh - 0.012, 0.006, glass, -doorW / 2, 0, 0));
    doorPivot.add(box(doorW, 0.012, 0.01, white, -doorW / 2, (Hh - 0.012) / 2 - 0.006, 0));
    doorPivot.add(box(doorW, 0.012, 0.01, white, -doorW / 2, -(Hh - 0.012) / 2 + 0.006, 0));
    caseShell.add(doorPivot);

    // Componentes Internos
    const moboG = box(0.24, 0.30, 0.004, M(0x17171f), 0.02, 0, -0.1); pcGroup.add(moboG);
    
    // Water Cooler (Anel RGB)
    const cpuG = new THREE.Group(); cpuG.position.set(-0.02, 0.06, -0.083);
    const pump = cyl(0.04, 0.04, 0.03, dark, 0, 0, 0, 32); pump.rotation.x = Math.PI / 2; cpuG.add(pump);
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.0032, 8, 36), rgb(0.3)); pumpRing.position.z = 0.0165; cpuG.add(pumpRing);
    pcGroup.add(cpuG);

    // Placa de Vídeo
    const gpuG = new THREE.Group();
    const gpuBody = box(0.24, 0.045, 0.11, M(0xeeeeee), 0.02, -0.09, -0.043);
    gpuG.add(gpuBody);
    const gpuGlow = box(0.05, 0.004, 0.002, rgb(0.3), 0.1, -0.09, 0.0135);
    gpuG.add(gpuGlow);
    const gpuFan = new THREE.Group(); gpuFan.position.set(0.02, -0.09, -0.012);
    const gpuBlade = box(0.06, 0.06, 0.002, M(0x333)); gpuFan.add(gpuBlade);
    fans.push(gpuFan); gpuG.add(gpuFan);
    pcGroup.add(gpuG);

    // Mangueiras do Water Cooler (Brancas)
    const tube1 = cyl(0.008, 0.008, 0.2, M(0xffffff), -0.02, 0.16, -0.08); tube1.rotation.x = 0.5; pcGroup.add(tube1);

    // Iluminação Interna (Roxa)
    const inner = new THREE.PointLight(0xa855f7, 1.5, 0.8);
    inner.position.set(0.72, 1.03, -0.02); scene.add(inner);

    // ==========================================
    // EASTER EGGS: Os 3 Funkos Pops (RDR2, Hogwarts, Detroit)
    // ==========================================
    const buildFunko = (color, x, z, hatType) => {
      const f = new THREE.Group();
      f.position.set(x, -0.16, z);
      // Corpo
      f.add(box(0.03, 0.04, 0.02, M(color), 0, 0.02, 0));
      // Cabeça 
      f.add(box(0.04, 0.04, 0.035, M(0xffdab9), 0, 0.06, 0));
      // Olhos
      f.add(box(0.008, 0.008, 0.002, M(0x000000), -0.01, 0.06, 0.018));
      f.add(box(0.008, 0.008, 0.002, M(0x000000), 0.01, 0.06, 0.018));
      
      if (hatType === 'cowboy') {
        f.add(box(0.06, 0.005, 0.06, M(0x5c4033), 0, 0.08, 0));
        f.add(box(0.04, 0.03, 0.04, M(0x5c4033), 0, 0.095, 0));
      } else if (hatType === 'hogwarts') {
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), M(0x4a2e15));
        hat.position.set(0, 0.09, 0); f.add(hat);
      } else if (hatType === 'detroit') {
        f.add(box(0.005, 0.005, 0.002, B(0x00ffff), 0.02, 0.065, 0.018));
      }
      return f;
    };

    pcGroup.add(buildFunko(0x8b0000, 0.0, -0.043, 'cowboy')); // RDR2
    pcGroup.add(buildFunko(0x111111, 0.06, -0.043, 'hogwarts')); // Hogwarts
    pcGroup.add(buildFunko(0x444444, 0.12, -0.043, 'detroit')); // Detroit

    roomTargets.push({ root: pcGroup, fn: enterPC });
    addPin('room', '💻', 'PC Gamer', anchor(pcGroup, 0, Hh / 2 + 0.05, 0), [0, 0.3, 1], enterPC);
  }

  function buildChairAndCat() {
    const g = new THREE.Group();
    g.position.set(-0.62, 0, 0.98);
    g.rotation.y = Math.PI + 0.5;
    
    // Cadeira Gamer (Branca)
    const white = M(0xe0e0e5, { roughness: 0.7 });
    const accent = M(0xa855f7, { roughness: 0.6 });
    
    g.add(cyl(0.028, 0.028, 0.32, M(0x2b2b36), 0, 0.26, 0, 14));
    g.add(box(0.5, 0.1, 0.5, white, 0, 0.46, 0));
    g.add(box(0.36, 0.012, 0.42, accent, 0, 0.516, 0.0));
    
    const back = box(0.48, 0.78, 0.09, white, 0, 0.39, -0.22); 
    back.rotation.x = -0.12; g.add(back);
    
    g.add(box(0.06, 0.02, 0.25, M(0x222222), 0.25, 0.55, 0));
    g.add(box(0.06, 0.02, 0.25, M(0x222222), -0.25, 0.55, 0));
    
    scene.add(g);
    addPin('room', '🪑', 'Cadeira', anchor(g, 0, 1.55, -0.25), [0, 0.3, 1], () => abrirItemSetup('extra', 0));

    // Gato Branco (Sucrilhas)
    catGroup = new THREE.Group();
    catGroup.position.set(-0.3, 0.765, 0.2); 
    catGroup.rotation.y = -0.8;
    
    const catWhite = M(0xffffff, { roughness: 0.9 });
    
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), catWhite); 
    body.scale.set(1, 0.8, 1.4); body.position.set(0, 0.05, 0); 
    catGroup.add(body);
    
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), catWhite); 
    head.position.set(0, 0.1, 0.08); 
    catGroup.add(head);
    
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), catWhite);
    earL.position.set(-0.025, 0.15, 0.08); earL.rotation.z = 0.2; catGroup.add(earL);
    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), catWhite);
    earR.position.set(0.025, 0.15, 0.08); earR.rotation.z = -0.2; catGroup.add(earR);

    const eyeMat = B(0x44aaff); 
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), eyeMat); eyeL.position.set(-0.02, 0.11, 0.125); catGroup.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), eyeMat); eyeR.position.set(0.02, 0.11, 0.125); catGroup.add(eyeR);

    catTail = new THREE.Group();
    catTail.position.set(0, 0.04, -0.1);
    const tailGeo = new THREE.CylinderGeometry(0.01, 0.005, 0.15);
    const tailMesh = new THREE.Mesh(tailGeo, catWhite);
    tailMesh.rotation.x = Math.PI / 2;
    tailMesh.position.z = -0.07;
    catTail.add(tailMesh);
    catGroup.add(catTail);
    
    scene.add(catGroup);
    addPin('room', '🐈', 'Sucrilhas', anchor(catGroup, 0, 0.15, 0), [0, 1, 0.4], () => toast('Miau! Mó paz com você sucrilhas 💜', 'ok'));
  }

  function buildLights() {
    scene.add(new THREE.AmbientLight(0x402060, 0.5)); 
    scene.add(new THREE.HemisphereLight(0xb9a6ff, 0x1a0f2b, 0.3));

    const dirLight = new THREE.DirectionalLight(0xffffff, isNight ? 0.1 : 0.8);
    dirLight.position.set(1, 3, 2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
    scene.userData.dirLight = dirLight;

    const p1 = new THREE.PointLight(0xa855f7, 1.5, 4); p1.position.set(0.7, 1.7, 0.9); scene.add(p1);
    const p2 = new THREE.PointLight(0xff6ec7, 1.0, 3); p2.position.set(-1.0, 1.3, 0.6); scene.add(p2);
  }

  function addPin(pinMode, icon, label, anch, face, fn) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 's3d-pin';
    el.innerHTML = `<span>${icon}</span><span class="s3d-pin-label">${label}</span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!flying) { playClick(); fn(); }
    });
    pinLayer.appendChild(el);
    pins.push({ el, mode: pinMode, anchor: anch, face: new THREE.Vector3(face[0], face[1], face[2]).normalize(), on: false });
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
            p.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          }
        }
      }
      if (show !== p.on) { p.on = show; p.el.classList.toggle('on', show); }
    }
  }

  let hoveredObj = null;
  function bindPointer() {
    const el = renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; initAudio(); });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 36 || performance.now() - down.t > 600) { down = null; return; }
      down = null;
      const t = pick(e);
      if (t) { playClick(); t.fn(); }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const targets = mode === 'room' ? roomTargets : pcTargets;
      const roots = targets.map(t => t.root);
      const hits = raycaster.intersectObjects(roots, true);
      if (hits.length > 0) {
        let rootHit = hits[0].object;
        while (rootHit.parent && !targets.find(t => t.root === rootHit)) rootHit = rootHit.parent;
        if (hoveredObj !== rootHit) {
          if (hoveredObj) hoveredObj.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
          hoveredObj = rootHit;
          hoveredObj.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x330066); });
          el.style.cursor = 'pointer';
        }
      } else {
        if (hoveredObj) {
          hoveredObj.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
          hoveredObj = null;
        }
        el.style.cursor = 'grab';
      }
    });
  }

  function pick(ev) {
    if (!built || flying) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = mode === 'room' ? roomTargets : pcTargets;
    const hits = raycaster.intersectObjects(targets.map(t => t.root), true);
    if (!hits.length) return null;
    for (let i = 0; i < targets.length; i++) {
      let o = hits[0].object;
      while(o) { if(o === targets[i].root) return targets[i]; o = o.parent; }
    }
    return null;
  }

  function enterPC() {
    if (mode !== 'room' || flying) return;
    savedPose = { pos: camera.position.clone(), target: controls.target.clone() };
    mode = 'pc';
    wrap.setAttribute('data-mode', 'pc');
    const c = pcGroup.getWorldPosition(new THREE.Vector3());
    const dist = Math.max(0.95, 0.8 / (W/H) + 0.1);
    tween(900, (e) => { doorPivot.rotation.y = DOOR_OPEN * e; });
    flyTo(new THREE.Vector3(c.x - 0.1, c.y + 0.04, c.z + dist), c, 1100);
  }

  function exitPC() {
    if (mode !== 'pc' || flying) return;
    mode = 'room';
    wrap.setAttribute('data-mode', 'room');
    const pose = savedPose || roomPose();
    tween(900, (e) => { doorPivot.rotation.y = DOOR_OPEN * (1 - e); });
    flyTo(pose.pos, pose.target, 1100);
  }

  function addHud() {
    pinLayer = document.createElement('div'); pinLayer.className = 's3d-pins'; wrap.appendChild(pinLayer);
    hintEl = document.createElement('div'); hintEl.className = 's3d-hint';
    hintEl.textContent = '🖱️ Arraste para girar · clique nos pontinhos 💜';
    wrap.appendChild(hintEl);

    const ctrls = document.createElement('div'); ctrls.className = 's3d-ctrls';
    [['+', 'Aproximar', () => zoomBy(0.8)], ['−', 'Afastar', () => zoomBy(1.25)], ['⟲', 'Resetar', () => flyTo(roomPose().pos, roomPose().target, 900)]].forEach(b => {
      const bt = document.createElement('button'); bt.className = 's3d-btn'; bt.textContent = b[0];
      bt.title = b[1]; bt.onclick = b[2]; ctrls.appendChild(bt);
    });
    wrap.appendChild(ctrls);

    ledPanel = document.createElement('div'); ledPanel.className = 's3d-led-panel';
    ['purple', 'pink', 'cyan', 'gold', 'off'].forEach(c => {
      const btn = document.createElement('button'); btn.className = 's3d-led-color'; btn.dataset.color = c;
      btn.title = c;
      btn.onclick = () => {
        if (c === 'purple') globalLedHue = 0.75;
        else if (c === 'pink') globalLedHue = 0.9;
        else if (c === 'cyan') globalLedHue = 0.55;
        else if (c === 'gold') globalLedHue = 0.12;
        else globalLedHue = null;
        localStorage.setItem('setup_led', c);
        playClick();
      };
      ledPanel.appendChild(btn);
    });
    wrap.appendChild(ledPanel);

    const topBar = document.createElement('div');
    topBar.className = 's3d-topbar';
    topBar.innerHTML = `
      <button class="s3d-action-btn" id="btnTour">🎥 Tour Guiado</button>
      <button class="s3d-action-btn" id="btnDayNight">☀️ Dia</button>
      <button class="s3d-action-btn" id="btnMute">🔊 Som</button>
    `;
    wrap.appendChild(topBar);

    document.getElementById('btnTour').onclick = () => startTour();
    document.getElementById('btnDayNight').onclick = (e) => {
      isNight = !isNight;
      e.target.textContent = isNight ? '🌙 Noite' : '☀️ Dia';
      const dir = scene.userData.dirLight;
      if (dir) dir.intensity = isNight ? 0.05 : 0.8;
      scene.children.forEach(c => { if (c.isAmbientLight) c.intensity = isNight ? 0.1 : 0.5; });
    };
    document.getElementById('btnMute').onclick = (e) => {
      isMuted = !isMuted;
      e.target.textContent = isMuted ? '🔇 Mudo' : '🔊 Som';
      if (ambientAudio) { if (isMuted) ambientAudio.pause(); else ambientAudio.play().catch(()=>{}); }
    };
  }

  function zoomBy(f) {
    if (!built || flying) return;
    const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
    camera.position.copy(controls.target).add(off);
    controls.update();
  }

  const TOUR_STOPS = [
    { pos: [0, 1.5, 2.5], target: [0, 1, 0], text: 'Bem-vindo ao meu setup! 💜' },
    { pos: [-0.15, 1.2, 0.8], target: [-0.15, 0.8, 0], text: 'Meu monitor principal. 240Hz faz toda a diferença!' },
    { pos: [0.72, 1.2, 0.8], target: [0.72, 1.0, -0.1], text: 'O PC dos sonhos: Ryzen 9 e RTX 3060.' },
    { pos: [-0.3, 1.0, 0.8], target: [-0.3, 0.8, 0.2], text: 'E claro, a Sucrilhas de olho no teclado.' }
  ];

  function startTour() {
    if (tourIndex !== -1) { stopTour(); return; }
    tourIndex = 0;
    document.getElementById('btnTour').textContent = '🛑 Parar Tour';
    runTourStep();
  }

  function runTourStep() {
    if (tourIndex >= TOUR_STOPS.length) { stopTour(); return; }
    const s = TOUR_STOPS[tourIndex];
    hintEl.textContent = s.text;
    hintEl.style.background = 'rgba(168,85,247,0.92)';
    hintEl.style.color = '#fff';
    hintEl.style.fontWeight = 'bold';
    flyTo(new THREE.Vector3(...s.pos), new THREE.Vector3(...s.target), 1500, () => {
      tourTimer = setTimeout(() => { tourIndex++; runTourStep(); }, 3000);
    });
  }

  function stopTour() {
    tourIndex = -1;
    clearTimeout(tourTimer);
    const b = document.getElementById('btnTour');
    if (b) b.textContent = '🎥 Tour Guiado';
    hintEl.textContent = '🖱️ Arraste para girar · clique nos pontinhos 💜';
    hintEl.style.background = '';
    hintEl.style.color = '';
    hintEl.style.fontWeight = '';
    flyTo(roomPose().pos, roomPose().target, 1000);
  }

  document.addEventListener('keydown', (e) => {
    if (!built || !visible || mode !== 'room') return;
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const kb = interactiveKeys[0];
    if (kb) {
      const orig = kb.material.color.getHex();
      kb.material.color.setHex(0xa855f7);
      setTimeout(() => kb.material.color.setHex(orig), 100);
    }
  });

  let lastFrameTime = performance.now();
  function tick() {
    raf = 0;
    if (!built || !visible) return;
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    
    if (delta > 0 && !lowQuality) {
      const fpsNow = 1000 / delta;
      if (fpsNow < 25) { 
        lowQuality = true; 
        renderer.shadowMap.enabled = false; 
        renderer.setPixelRatio(1); 
        if(composer) { composer.setPixelRatio(1); }
      }
    }
    runTweens(now);
    if (controls.enabled) controls.update();

    // Atualiza Cores RGB
    if (globalLedHue !== null) {
      rgbMats.forEach(r => r.m.color.setHSL(globalLedHue, 0.9, 0.6));
    } else {
      rgbMats.forEach(r => r.m.color.setHex(0x111111));
    }

    // Chuva
    if (rainMesh) {
      const positions = rainMesh.geometry.attributes.position.array;
      for (let i = 0; i < positions.length/3; i++) {
        positions[i*3+1] -= rainVel[i];
        if (positions[i*3+1] < 1.0) positions[i*3+1] = 2.0;
      }
      rainMesh.geometry.attributes.position.needsUpdate = true;
    }

    // Vapor do Café
    if (coffeeSteam) {
      const p = coffeeSteam.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        p[i+1] += 0.005;
        if (p[i+1] > 0.95) { p[i+1] = 0.8; p[i] = 0.4 + (Math.random()-0.5)*0.02; }
      }
      coffeeSteam.geometry.attributes.position.needsUpdate = true;
    }

    // Gato
    if (catGroup) {
      catBreath += 0.05;
      catGroup.scale.y = 1 + Math.sin(catBreath) * 0.03;
      if(catTail) catTail.rotation.y = Math.sin(catBreath * 0.5) * 0.3;
    }

    fans.forEach(f => { f.rotation.z += 0.2; });

    updatePins();
    
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    
    raf = requestAnimationFrame(tick);
  }
  
  function kick() { if (!raf && built && visible) { lastFrameTime = performance.now(); raf = requestAnimationFrame(tick); } }

  function resize(w, h) {
    W = w; H = h;
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    if (fxaaPass) {
      const pixelRatio = renderer.getPixelRatio();
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * pixelRatio);
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * pixelRatio);
    }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function build(w, h) {
    tmpV = new THREE.Vector3(); camV = new THREE.Vector3();
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ReinhardToneMapping;
    } catch (err) {
      container.innerHTML = '<div class="s3d-fallback">Seu navegador não conseguiu abrir o modo 3D. Tente atualizar o navegador 💜</div>';
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
    buildChairAndCat();
    buildPC();

    const saved = localStorage.getItem('setup_led') || 'purple';
    if (saved === 'purple') globalLedHue = 0.75;
    else if (saved === 'pink') globalLedHue = 0.9;
    else if (saved === 'cyan') globalLedHue = 0.55;
    else if (saved === 'gold') globalLedHue = 0.12;
    else globalLedHue = null;

    const pose = roomPose();
    camera.position.copy(pose.pos);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(pose.target);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.enablePan = false; controls.enableZoom = false;
    controls.rotateSpeed = 0.7; controls.minDistance = 0.9; controls.maxDistance = 6;
    controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    // Post Processing Setup (BLOOM)
    const renderScene = new THREE.RenderPass(scene, camera);
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.5, 0.85);
    
    composer = new THREE.EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(w, h);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // FXAA (Anti-aliasing extra)
    fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * pixelRatio);
    fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * pixelRatio);
    composer.addPass(fxaaPass);

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
      container.innerHTML = '<div class="s3d-fallback">Não consegui carregar o 3D. Recarregue a página 💜</div>';
      return;
    }
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      if (!built) build(w, h); else resize(w, h);
    });
    ro.observe(container);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }, { threshold: 0.01 });
    io.observe(container);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mode === 'pc' && !document.querySelector('dialog[open]')) exitPC();
    });
  }

  return { init };
})();

/* ============================================================
   PONTO DE ENTRADA ÚNICO
   ============================================================ */
async function initSetup() {
  await carregarSetupData();
  renderSonhos();
  renderApoiadores();
  Setup3D.init();
}
window.initSetup = initSetup;
window.setupSetup3D = initSetup; 

document.addEventListener('DOMContentLoaded', () => {
  if (!window.__setupIniciado) {
    window.__setupIniciado = true;
    initSetup();
  }
});