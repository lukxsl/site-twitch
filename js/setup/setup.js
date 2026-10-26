/* ============================================================
   SETUP — CENA 3D INTERATIVA PREMIUM (INSPIRADO EM ROOM PORTFOLIO)
   ============================================================ */
let _sonhoSelecionado = null;
const SETUP_VIEW_KEY = 'setup_view_v1';
let setupView = '3d';
let setupBusca = '';
let SETUP_DATA = [];
let SONHOS_DATA = [];

function setupRender() {}
function setupSetView() {}
window.setupRender = setupRender;
window.setupSetView = setupSetView;

async function carregarSetupData() {
  try {
    const r = await fetch('/api/config?action=setup');
    const d = await r.json();
    if (d.setup) SETUP_DATA = d.setup;
    if (d.sonhos) SONHOS_DATA = d.sonhos;
  } catch (e) { console.error('Erro ao carregar setup:', e); }
}

function abrirItemSetup(grupoId, idx){
  const g = SETUP_DATA.find(x => x.id === grupoId);
  if(!g) return;
  const it = g.itens[idx];
  if(!it) return;
  $('dTitle').textContent = it.nome;
  $('dBody').innerHTML = `
    <div class="setup-modal-item">
      <div class="smi-hero" data-accent="${g.accent}"><span class="smi-hero-ic">${it.ic}</span></div>
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
    </div>`;
  $('dlg').showModal();
}
window.abrirItemSetup = abrirItemSetup;

function copiarLinkItem(nome){
  const url = window.location.origin + '/#setup/' + encodeURIComponent(nome);
  navigator.clipboard.writeText(url); toast('Link copiado! 💜', 'ok');
}
window.copiarLinkItem = copiarLinkItem;

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
  let ambientAudio = null;
  let isMuted = false;
  let isNight = false;
  let audioCtx = null;
  let globalLedHue = 0.75;
  let tourIndex = -1;
  let tourTimer = null;
  let lowQuality = false;
  let monitorTex, monitorCtx, monitorCanvas;

  // NOVOS OBJETOS INTERATIVOS
  let chairGroup, plantGroup, drawerGroup, paintingGroup;
  let plantGrow = 0, plantGrowing = false;
  let drawerOpen = false, drawerAnim = 0;
  let chairSpinning = false, chairSpinSpeed = 0;
  let paintingIndex = 0;
  const paintings = [0xa855f7, 0xff6ec7, 0x7dd3fc, 0xffd166];

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      if(!ambientAudio) {
        ambientAudio = new Audio('https://cdn.pixabay.com/audio/2022/11/22/audio_4b5f4d363a.mp3');
        ambientAudio.loop = true; ambientAudio.volume = 0.15;
        if(!isMuted) ambientAudio.play().catch(()=>{});
      }
    } catch(e) {}
  }

  function playClick() {
    if (!audioCtx) initAudio(); if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.1);
  }

  function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.1 }, o || {})); }
  function B(color, o) { return new THREE.MeshBasicMaterial(Object.assign({ color }, o || {})); }
  function rgb(off) { const m = B(0xa855f7); rgbMats.push({ m, off: off || 0 }); return m; }
  function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x||0, y||0, z||0); m.castShadow = true; m.receiveShadow = true; return m; }
  function cyl(rt, rb, h, mat, x, y, z, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg||24), mat); m.position.set(x||0, y||0, z||0); m.castShadow = true; m.receiveShadow = true; return m; }
  function anchor(parent, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur, fn, done }); }
  function runTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(ease(k)); if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
    }
  }
  function flyTo(pos, target, dur, done) {
    const p0 = camera.position.clone(); const t0 = controls.target.clone();
    flying = true; controls.enabled = false;
    tween(dur, (e) => {
      camera.position.lerpVectors(p0, pos, e); controls.target.lerpVectors(t0, target, e); camera.lookAt(controls.target);
    }, () => {
      camera.position.copy(pos); controls.target.copy(target);
      flying = false; controls.enabled = true; controls.update(); if (done) done();
    });
  }

  function roomPose() {
    const aspect = Math.max(0.4, W / Math.max(1, H));
    const dist = Math.min(5.5, Math.max(2.8, 3.0 / aspect));
    const dir = new THREE.Vector3(1.4, 0.55, 2.35).normalize();
    const target = new THREE.Vector3(0.05, 0.98, 0);
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }

  function buildRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), M(0x15101f, { roughness: 0.8, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), M(0x2a1a4d, { roughness: 0.95, metalness: 0 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0.75); rug.receiveShadow = true; scene.add(rug);

    const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.5), M(0x1a1030, { roughness: 0.9, metalness: 0 }));
    wallBack.position.set(0, 1.75, -0.6); wallBack.receiveShadow = true; scene.add(wallBack);

    const windowGroup = new THREE.Group(); windowGroup.position.set(-1.4, 1.6, -0.58);
    windowGroup.add(box(0.8, 1.0, 0.1, M(0x222222), 0, 0, 0));
    windowGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), M(0x111122, { transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.8 })));
    windowGroup.add(box(0.9, 0.05, 0.2, M(0xe0e0e5), 0, -0.52, 0.05));
    scene.add(windowGroup);

    const cityCanvas = document.createElement('canvas'); cityCanvas.width = 256; cityCanvas.height = 256;
    const cCtx = cityCanvas.getContext('2d'); cCtx.fillStyle = '#050309'; cCtx.fillRect(0, 0, 256, 256);
    cCtx.fillStyle = '#1a1035'; for(let i=0; i<10; i++) cCtx.fillRect(i*25, 150 - Math.random()*50, 20, 106);
    cCtx.fillStyle = '#fff'; cCtx.beginPath(); cCtx.arc(200, 50, 20, 0, Math.PI*2); cCtx.fill();
    const cityTex = new THREE.CanvasTexture(cityCanvas);
    const cityPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), B(0xffffff, { map: cityTex }));
    cityPlane.position.set(-1.4, 1.6, -0.65); scene.add(cityPlane);

    const geo = new THREE.BufferGeometry(); const count = 400; const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3] = -1.8 + Math.random() * 0.8; pos[i*3+1] = 1.0 + Math.random() * 1.2; pos[i*3+2] = -0.7 - Math.random() * 0.3;
      rainVel.push(0.01 + Math.random() * 0.02);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rainMesh = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.008, transparent: true, opacity: 0.5 })); scene.add(rainMesh);

    const signGroup = new THREE.Group(); signGroup.position.set(1.4, 1.8, -0.58);
    signGroup.add(box(0.7, 0.3, 0.02, M(0x050309), 0, 0, 0));
    const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 213;
    const sCtx = signCanvas.getContext('2d'); sCtx.fillStyle = '#000'; sCtx.fillRect(0,0,512,213);
    sCtx.font = 'bold 80px sans-serif'; sCtx.fillStyle = '#c084fc'; sCtx.shadowColor = '#a855f7'; sCtx.shadowBlur = 20;
    sCtx.textAlign = 'center'; sCtx.fillText('asemtet0', 256, 130);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.28), B(0xffffff, { map: signTex, transparent: true }));
    signPlane.position.z = 0.011; signGroup.add(signPlane); scene.add(signGroup);
  }

  // ========== NOVO: OBJETOS INTERATIVOS ==========
  function buildInteractiveObjects() {
    // Planta
    plantGroup = new THREE.Group();
    plantGroup.position.set(-1.2, 0.75, 0.3);
    const pot = cyl(0.08, 0.06, 0.12, M(0x8b4513), 0, 0.06, 0);
    plantGroup.add(pot);
    const leafMat = M(0x228b22);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), leafMat);
      leaf.scale.set(0.5, 1.5, 0.5);
      leaf.position.set(Math.sin(i * 1.2) * 0.05, 0.15 + i * 0.02, Math.cos(i * 1.2) * 0.05);
      plantGroup.add(leaf);
    }
    scene.add(plantGroup);
    addInteractiveObject(plantGroup, '🌱', 'Regar planta', () => {
      if (!plantGrowing) { plantGrowing = true; plantGrow = 0; }
    }, [0, 0.3, 0.4]);

    // Gaveta da mesa
    drawerGroup = new THREE.Group();
    drawerGroup.position.set(0.6, 0.72, 0.4);
    const drawerBody = box(0.25, 0.02, 0.15, M(0xffffff), 0, 0.01, 0);
    drawerGroup.add(drawerBody);
    const handle = box(0.04, 0.02, 0.02, M(0x333333), 0, 0.02, 0.07);
    drawerGroup.add(handle);
    scene.add(drawerGroup);
    addInteractiveObject(drawerGroup, '🗄️', 'Abrir gaveta', () => {
      drawerOpen = !drawerOpen;
    }, [0, 0, 1]);

    // Quadro na parede
    paintingGroup = new THREE.Group();
    paintingGroup.position.set(0.5, 1.8, -0.58);
    paintingGroup.add(box(0.4, 0.3, 0.02, M(0x111111), 0, 0, 0));
    const paintingMat = M(paintings[0]);
    const paintingMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26), paintingMat);
    paintingMesh.position.z = 0.011;
    paintingGroup.add(paintingMesh);
    scene.add(paintingGroup);
    addInteractiveObject(paintingGroup, '🖼️', 'Mudar quadro', () => {
      paintingIndex = (paintingIndex + 1) % paintings.length;
      paintingMat.color.setHex(paintings[paintingIndex]);
    }, [0, 0, 1]);
  }

  // Helper para objetos interativos (não-pin)
  function addInteractiveObject(root, icon, label, onClick, face) {
    // Cria um pin especial (visível apenas no hover, mas que também pode ser clicado)
    const el = document.createElement('button');
    el.type = 'button'; el.className = 's3d-pin s3d-pin-interactive';
    el.innerHTML = `<span>${icon}</span><span class="s3d-pin-label">${label}</span>`;
    el.style.opacity = '0'; // Começa invisível
    el.style.pointerEvents = 'none';
    el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    pinLayer.appendChild(el);
    const p = { el, mode: 'room', anchor: anchor(root, 0, 0.1, 0), face: new THREE.Vector3(...face).normalize(), on: false, isInteractive: true };
    pins.push(p);
    // Adiciona ao target do raycaster para hover
    roomTargets.push({ root, fn: onClick, isInteractive: true, pinRef: p });
  }

  function buildDeskAndPeripherals() {
    const deskMat = M(0xf0f0f5, { roughness: 0.4, metalness: 0.1 });
    scene.add(box(2.4, 0.04, 0.9, deskMat, 0, 0.73, -0.025));
    scene.add(box(0.04, 0.71, 0.85, deskMat, -1.15, 0.355, -0.025));
    scene.add(box(0.04, 0.71, 0.85, deskMat, 1.15, 0.355, -0.025));

    scene.add(box(1.2, 0.005, 0.5, M(0x101015, { roughness: 1, metalness: 0 }), -0.2, 0.753, 0.15));

    const monGroup = new THREE.Group(); monGroup.position.set(-0.2, 0.75, -0.2);
    monGroup.add(box(0.3, 0.015, 0.2, M(0x111111), 0, 0.007, 0));
    monGroup.add(box(0.06, 0.25, 0.03, M(0x111111), 0, 0.13, -0.05));
    monGroup.add(box(0.9, 0.4, 0.02, M(0x111111), 0, 0.3, 0));
    
    monitorCanvas = document.createElement('canvas'); monitorCanvas.width = 1024; monitorCanvas.height = 512;
    monitorCtx = monitorCanvas.getContext('2d'); monitorTex = new THREE.CanvasTexture(monitorCanvas);
    const updateMonitor = () => {
      if (window.ultVivo) {
        monitorCtx.fillStyle = '#1b0b3a'; monitorCtx.fillRect(0, 0, 1024, 512);
        monitorCtx.fillStyle = '#ff4d5f'; monitorCtx.fillRect(40, 40, 180, 50);
        monitorCtx.fillStyle = '#fff'; monitorCtx.font = 'bold 30px sans-serif'; monitorCtx.fillText('AO VIVO', 75, 75);
        monitorCtx.font = 'bold 60px sans-serif'; monitorCtx.textAlign = 'center';
        monitorCtx.fillText(window.ultGame ? window.ultGame.name : 'Live na Twitch', 512, 280);
      } else {
        monitorCtx.fillStyle = '#050309'; monitorCtx.fillRect(0, 0, 1024, 512);
        monitorCtx.font = 'bold 80px sans-serif'; monitorCtx.fillStyle = '#a855f7'; monitorCtx.textAlign = 'center';
        monitorCtx.fillText('asemtet0', 512, 250);
        monitorCtx.font = '40px sans-serif'; monitorCtx.fillStyle = '#c084fc'; monitorCtx.fillText('offline 💜', 512, 330);
      }
      monitorTex.needsUpdate = true;
    }
    updateMonitor(); setInterval(updateMonitor, 5000);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.38), M(0xffffff, { map: monitorTex, roughness: 0.1, metalness: 0.5 }));
    screen.position.set(0, 0.3, 0.011); monGroup.add(screen);
    
    const glassGlare = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.38), M(0xffffff, { transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0 }));
    glassGlare.position.set(0, 0.3, 0.012); monGroup.add(glassGlare);
    scene.add(monGroup);
    addPin('room', '🖥️', 'Monitor', anchor(monGroup, 0.3, 0.4, 0.03), [0, 0.2, 1], () => abrirItemSetup('per', 4));

    const kb = new THREE.Group(); kb.position.set(-0.2, 0.755, 0.2);
    kb.add(box(0.35, 0.02, 0.13, M(0x222222), 0, 0.01, 0));
    const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.008, 0.02), M(0xffffff), 80);
    const d = new THREE.Object3D(); let idx = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) { 
      if(r===4 && c>10) continue; 
      d.position.set(-0.15 + c*0.022, 0.024, -0.05 + r*0.022); d.updateMatrix(); keys.setMatrixAt(idx++, d.matrix); 
    }
    keys.instanceMatrix.needsUpdate = true; kb.add(keys); scene.add(kb);
    addPin('room', '⌨️', 'Teclado', anchor(kb, 0, 0.05, 0), [0, 1, 0.4], () => abrirItemSetup('per', 0));

    const mo = new THREE.Group(); mo.position.set(0.15, 0.755, 0.2);
    const mBody = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M(0x111111)); mBody.scale.set(0.035, 0.02, 0.06); mBody.position.y = 0.01; mo.add(mBody);
    mo.add(box(0.03, 0.01, 0.06, rgb(2.0), 0, 0.015, 0));
    scene.add(mo);
    addPin('room', '🖱️', 'Mouse', anchor(mo, 0, 0.05, 0), [0, 1, 0.4], () => abrirItemSetup('per', 1));

    const micArm = new THREE.Group(); micArm.position.set(-0.9, 0.75, -0.2);
    micArm.add(cyl(0.05, 0.05, 0.02, M(0x111111), 0, 0.01, 0));
    const a1 = cyl(0.015, 0.015, 0.5, M(0x222222), 0.15, 0.25, 0); a1.rotation.z = -0.6; micArm.add(a1);
    const a2 = cyl(0.015, 0.015, 0.4, M(0x222222), 0.35, 0.45, 0); a2.rotation.z = 0.6; micArm.add(a2);
    const mic = cyl(0.025, 0.025, 0.12, M(0xffffff), 0.5, 0.3, 0); mic.rotation.x = Math.PI/2; micArm.add(mic);
    const popFilter = cyl(0.04, 0.04, 0.01, M(0x111111), 0.56, 0.3, 0); popFilter.rotation.x = Math.PI/2; micArm.add(popFilter);
    scene.add(micArm);
    addPin('room', '🎙️', 'Microfone', anchor(micArm, 0.5, 0.3, 0), [0, 1, 0.4], () => abrirItemSetup('per', 3));

    const hsStand = new THREE.Group(); hsStand.position.set(-1.0, 0.75, 0.1);
    hsStand.add(cyl(0.06, 0.06, 0.02, M(0x111111), 0, 0.01, 0));
    hsStand.add(cyl(0.01, 0.01, 0.25, M(0x111111), 0, 0.13, 0));
    hsStand.add(box(0.1, 0.03, 0.02, M(0x111111), 0, 0.26, 0));
    hsStand.add(box(0.08, 0.04, 0.1, M(0xffffff), 0, 0.21, 0));
    scene.add(hsStand);
    addPin('room', '🎧', 'Headset', anchor(hsStand, 0, 0.2, 0), [0, 1, 0.4], () => abrirItemSetup('per', 2));

    const mug = new THREE.Group(); mug.position.set(0.5, 0.75, -0.3); mug.add(cyl(0.04, 0.035, 0.1, M(0xffffff), 0, 0.05, 0)); scene.add(mug);
    const steamGeo = new THREE.BufferGeometry(); const steamPos = new Float32Array(20 * 3);
    for(let i=0; i<20; i++) { steamPos[i*3] = 0.5; steamPos[i*3+1] = 0.8; steamPos[i*3+2] = -0.3; }
    steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
    coffeeSteam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.01, transparent: true, opacity: 0.3 })); scene.add(coffeeSteam);

    const monster = new THREE.Group(); monster.position.set(0.45, 0.755, 0.2);
    monster.add(cyl(0.03, 0.03, 0.12, M(0x111111), 0, 0.06, 0));
    const monCanvas = document.createElement('canvas'); monCanvas.width = 128; monCanvas.height = 128;
    const mCtx = monCanvas.getContext('2d'); mCtx.fillStyle = '#111111'; mCtx.fillRect(0,0,128,128);
    mCtx.strokeStyle = '#b7ff00'; mCtx.lineWidth = 8; mCtx.beginPath();
    mCtx.moveTo(64, 20); mCtx.lineTo(90, 60); mCtx.lineTo(70, 60); mCtx.lineTo(90, 100); mCtx.lineTo(38, 60); mCtx.lineTo(58, 60); mCtx.closePath(); mCtx.stroke();
    const monTex = new THREE.CanvasTexture(monCanvas);
    const monLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.08, 32, 1, true), B(0xffffff, { map: monTex }));
    monLabel.position.set(0, 0.06, 0); monster.add(monLabel); scene.add(monster);

    const phone = new THREE.Group(); phone.position.set(0.05, 0.755, -0.05); phone.rotation.y = 0.5; phone.rotation.x = -Math.PI/2;
    phone.add(box(0.08, 0.16, 0.01, M(0x111111), 0, 0, 0));
    const pCanvas = document.createElement('canvas'); pCanvas.width = 128; pCanvas.height = 256;
    const pCtx = pCanvas.getContext('2d'); pCtx.fillStyle = '#121212'; pCtx.fillRect(0,0,128,256);
    pCtx.fillStyle = '#1DB954'; pCtx.beginPath(); pCtx.arc(64, 100, 35, 0, Math.PI*2); pCtx.fill();
    pCtx.fillStyle = '#000'; pCtx.font = 'bold 40px sans-serif'; pCtx.textAlign = 'center'; pCtx.fillText('♫', 64, 115);
    pCtx.fillStyle = '#fff'; pCtx.font = 'bold 14px sans-serif'; pCtx.fillText('Spotify', 64, 170);
    const pTex = new THREE.CanvasTexture(pCanvas);
    const pScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.15), B(0xffffff, { map: pTex }));
    pScreen.position.set(0, 0, 0.006); phone.add(pScreen); scene.add(phone);

    const buildFunko = (color, x, z, hatType) => {
      const f = new THREE.Group(); f.position.set(x, 0.75, z); f.rotation.y = 0.5;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.04, 16), M(color)); body.position.y = 0.02; f.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), M(0xffdab9)); head.position.y = 0.06; f.add(head);
      f.add(box(0.006, 0.006, 0.002, M(0x000000), -0.008, 0.065, 0.022));
      f.add(box(0.006, 0.006, 0.002, M(0x000000), 0.008, 0.065, 0.022));
      if (hatType === 'cowboy') {
        const hatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.003, 16), M(0x5c4033)); hatBase.position.y = 0.082; f.add(hatBase);
        const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.025, 16), M(0x5c4033)); hatTop.position.y = 0.095; f.add(hatTop);
      } else if (hatType === 'hogwarts') {
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), M(0x4a2e15)); hat.position.set(0, 0.1, 0); hat.rotation.z = 0.2; f.add(hat);
      } else if (hatType === 'detroit') {
        f.add(box(0.004, 0.004, 0.002, B(0x00ffff), 0.015, 0.065, 0.02));
      }
      scene.add(f);
    };
    buildFunko(0x8b0000, -0.5, -0.3, 'cowboy');
    buildFunko(0x111111, -0.42, -0.3, 'hogwarts');
    buildFunko(0x444444, -0.34, -0.3, 'detroit');
  }

  function buildPC() {
    const D = 0.5, Hh = 0.5, Wd = 0.25;
    pcGroup = new THREE.Group(); pcGroup.position.set(0.85, 0.77 + Hh / 2, -0.1); scene.add(pcGroup);

    const white = M(0xe0e0e5, { roughness: 0.3, metalness: 0.2 });
    const dark = M(0x15151c, { roughness: 0.6, metalness: 0.4 });
    const glass = M(0x111111, { transparent: true, opacity: 0.15, roughness: 0.1, metalness: 0.5, depthWrite: false });

    caseShell = new THREE.Group(); pcGroup.add(caseShell);
    caseShell.add(box(D, Hh, 0.01, white, 0, 0, -Wd / 2 + 0.005));
    caseShell.add(box(D, 0.01, Wd, white, 0, Hh / 2 - 0.005, 0));
    caseShell.add(box(D, 0.01, Wd, white, 0, -Hh / 2 + 0.005, 0));
    caseShell.add(box(0.01, Hh, Wd, white, D / 2 - 0.005, 0, 0));
    caseShell.add(box(0.008, Hh, Wd, glass, -D / 2 + 0.004, 0, 0));

    doorPivot = new THREE.Group(); doorPivot.position.set(D / 2 - 0.005, 0, Wd / 2);
    const doorW = D - 0.012;
    doorPivot.add(box(doorW, Hh - 0.012, 0.006, glass, -doorW / 2, 0, 0));
    doorPivot.add(box(doorW, 0.012, 0.01, white, -doorW / 2, (Hh - 0.012) / 2 - 0.006, 0));
    doorPivot.add(box(doorW, 0.012, 0.01, white, -doorW / 2, -(Hh - 0.012) / 2 + 0.006, 0));
    caseShell.add(doorPivot);

    const moboG = box(0.28, 0.35, 0.01, M(0x111111), 0.02, 0, -0.11); pcGroup.add(moboG);
    moboG.add(box(0.08, 0.08, 0.02, M(0x333333), 0.08, 0.1, 0.01));
    moboG.add(box(0.1, 0.04, 0.02, M(0x333333), 0.05, 0.15, 0.01));

    const cpuG = new THREE.Group(); cpuG.position.set(-0.02, 0.06, -0.083);
    const pump = cyl(0.045, 0.045, 0.035, dark, 0, 0, 0, 32); pump.rotation.x = Math.PI / 2; cpuG.add(pump);
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.004, 8, 36), rgb(0.3)); pumpRing.position.z = 0.0185; cpuG.add(pumpRing);
    const lcdCanvas = document.createElement('canvas'); lcdCanvas.width = 64; lcdCanvas.height = 64;
    const lCtx = lcdCanvas.getContext('2d'); lCtx.fillStyle = '#000'; lCtx.fillRect(0,0,64,64);
    lCtx.fillStyle = '#0ff'; lCtx.font = 'bold 20px sans-serif'; lCtx.textAlign = 'center'; lCtx.fillText('65°C', 32, 40);
    const lcdTex = new THREE.CanvasTexture(lcdCanvas);
    const lcd = new THREE.Mesh(new THREE.CircleGeometry(0.025, 32), B(0xffffff, { map: lcdTex }));
    lcd.position.z = 0.0186; cpuG.add(lcd);
    pcGroup.add(cpuG);
    pcTargets.push({ root: cpuG, fn: () => abrirItemSetup('pc', 5) });
    addPin('pc', '💧', 'Water Cooler', anchor(cpuG, 0, 0, 0.03), [0, 0, 1], () => abrirItemSetup('pc', 5));

    const ramGroup = new THREE.Group(); ramGroup.position.set(0.09, 0.06, -0.09);
    for(let i=0; i<4; i++) {
      const stick = box(0.007, 0.1, 0.04, M(0x222222), i*0.012, 0, 0);
      stick.add(box(0.006, 0.005, 0.035, rgb(0.5), 0, 0.052, 0));
      ramGroup.add(stick);
    }
    pcGroup.add(ramGroup);
    pcTargets.push({ root: ramGroup, fn: () => abrirItemSetup('pc', 2) });
    addPin('pc', '🧩', 'Memórias RAM', anchor(ramGroup, 0, 0.06, 0), [0, 0, 1], () => abrirItemSetup('pc', 2));

    const gpuG = new THREE.Group();
    gpuG.add(box(0.28, 0.06, 0.12, M(0xeeeeee), 0.02, -0.09, -0.043));
    for(let i=0; i<3; i++) {
      const fanG = new THREE.Group(); fanG.position.set(-0.06 + i*0.08, -0.09, 0.018);
      fanG.add(cyl(0.025, 0.025, 0.005, M(0x333333), 0, 0, 0));
      const blade = box(0.04, 0.04, 0.002, M(0x111111)); fanG.add(blade);
      fans.push(fanG); gpuG.add(fanG);
    }
    gpuG.add(box(0.08, 0.01, 0.002, B(0xb7ff00), 0.08, -0.09, 0.022));
    pcGroup.add(gpuG);
    pcTargets.push({ root: gpuG, fn: () => abrirItemSetup('pc', 1) });
    addPin('pc', '🎮', 'Placa de Vídeo RTX', anchor(gpuG, 0, -0.06, 0), [0, 0, 1], () => abrirItemSetup('pc', 1));

    for(let i=0; i<3; i++) {
      const fan = new THREE.Group(); fan.position.set(-0.05 + i*0.06, 0.05, -0.12);
      fan.add(cyl(0.035, 0.035, 0.01, M(0x222222), 0, 0, 0));
      const b = box(0.05, 0.05, 0.002, M(0x111111)); fan.add(b); fans.push(fan); pcGroup.add(fan);
    }

    const t1 = cyl(0.01, 0.01, 0.2, M(0xffffff), -0.02, 0.16, -0.08); t1.rotation.x = 0.5; pcGroup.add(t1);
    const cable1 = box(0.04, 0.15, 0.01, M(0x111111), 0.1, 0.05, -0.08); pcGroup.add(cable1);
    const inner = new THREE.PointLight(0xa855f7, 2.5, 1.0); inner.position.set(0.85, 1.03, -0.02); scene.add(inner);

    roomTargets.push({ root: pcGroup, fn: enterPC });
    addPin('room', '💻', 'PC Gamer', anchor(pcGroup, 0, Hh / 2 + 0.05, 0), [0, 0.3, 1], enterPC);
  }

  function buildChairAndCat() {
    chairGroup = new THREE.Group(); chairGroup.position.set(-0.8, 0, 1.1); chairGroup.rotation.y = Math.PI + 0.3;
    const white = M(0xe0e0e5, { roughness: 0.6, metalness: 0.1 });
    const accent = M(0xa855f7, { roughness: 0.7 });
    
    for(let i=0; i<5; i++) {
      const leg = box(0.04, 0.04, 0.25, M(0x222222), 0, 0.05, 0); leg.rotation.y = i * Math.PI * 2 / 5; leg.position.x = Math.sin(leg.rotation.y)*0.15; leg.position.z = Math.cos(leg.rotation.y)*0.15; chairGroup.add(leg);
    }
    chairGroup.add(cyl(0.03, 0.03, 0.3, M(0x333333), 0, 0.2, 0, 16));

    chairGroup.add(box(0.5, 0.08, 0.5, white, 0, 0.45, 0));
    chairGroup.add(box(0.06, 0.1, 0.45, white, 0.25, 0.5, 0));
    chairGroup.add(box(0.06, 0.1, 0.45, white, -0.25, 0.5, 0));
    chairGroup.add(box(0.35, 0.01, 0.4, accent, 0, 0.495, 0));

    const back = box(0.5, 0.8, 0.1, white, 0, 0.9, -0.2); back.rotation.x = -0.15; chairGroup.add(back);
    chairGroup.add(box(0.35, 0.3, 0.02, accent, 0, 0.9, -0.15));
    const headrest = box(0.2, 0.1, 0.05, white, 0, 1.35, -0.25); headrest.rotation.x = -0.15; chairGroup.add(headrest);

    chairGroup.add(cyl(0.015, 0.015, 0.15, M(0x222222), 0.28, 0.55, 0));
    chairGroup.add(box(0.06, 0.02, 0.25, M(0x222222), 0.28, 0.62, 0));
    chairGroup.add(cyl(0.015, 0.015, 0.15, M(0x222222), -0.28, 0.55, 0));
    chairGroup.add(box(0.06, 0.02, 0.25, M(0x222222), -0.28, 0.62, 0));
    
    scene.add(chairGroup);
    addPin('room', '🪑', 'Cadeira', anchor(chairGroup, 0, 1.4, -0.2), [0, 0.3, 1], () => abrirItemSetup('extra', 0));
    // Interatividade: girar cadeira
    addInteractiveObject(chairGroup, '🔄', 'Girar cadeira', () => {
      chairSpinning = true; chairSpinSpeed = 0.1;
    }, [0, 0.5, 1]);

    catGroup = new THREE.Group(); catGroup.position.set(0, 0.5, 0.1); catGroup.rotation.y = -0.5;
    const cWhite = M(0xffffff, { roughness: 1, metalness: 0 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), cWhite); body.scale.set(1, 0.8, 1.4); body.position.set(0, 0.06, 0); catGroup.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), cWhite); head.position.set(0, 0.12, 0.1); catGroup.add(head);

    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), cWhite); earL.position.set(-0.03, 0.17, 0.1); catGroup.add(earL);
    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), cWhite); earR.position.set(0.03, 0.17, 0.1); catGroup.add(earR);
    
    const eyeMat = B(0x44aaff);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), eyeMat); eyeL.position.set(-0.02, 0.13, 0.14); catGroup.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), eyeMat); eyeR.position.set(0.02, 0.13, 0.14); catGroup.add(eyeR);

    catTail = new THREE.Group(); catTail.position.set(0, 0.05, -0.1);
    const tM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.005, 0.2), cWhite); tM.rotation.x = Math.PI/2; tM.position.z = -0.1; catTail.add(tM); catGroup.add(catTail);
    chairGroup.add(catGroup);
    addPin('room', '🐈', 'Sucrilhas', anchor(catGroup, 0, 0.18, 0), [0, 1, 0.4], () => toast('Miau! Mó paz com você sucrilhas 💜', 'ok'));
  }

  function buildLights() {
    scene.add(new THREE.AmbientLight(0x402060, 0.6)); 
    scene.add(new THREE.HemisphereLight(0xb9a6ff, 0x1a0f2b, 0.4));
    
    const dirLight = new THREE.DirectionalLight(0xffffff, isNight ? 0.1 : 1.2); 
    dirLight.position.set(2, 4, 2); dirLight.castShadow = true; 
    dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight); scene.userData.dirLight = dirLight;
    
    const p1 = new THREE.PointLight(0xa855f7, 2.0, 5); p1.position.set(1.0, 1.7, 1.0); scene.add(p1);
    const p2 = new THREE.PointLight(0xff6ec7, 1.5, 4); p2.position.set(-1.2, 1.3, 0.8); scene.add(p2);
  }

  function addPin(pinMode, icon, label, anch, face, fn) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 's3d-pin';
    el.innerHTML = `<span>${icon}</span><span class="s3d-pin-label">${label}</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); if (!flying) { playClick(); fn(); } });
    pinLayer.appendChild(el);
    pins.push({ el, mode: pinMode, anchor: anch, face: new THREE.Vector3(face[0], face[1], face[2]).normalize(), on: false });
  }
  
  function updatePins() {
    camera.getWorldPosition(camV);
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i]; let show = !flying && p.mode === mode;
      if (show) {
        p.anchor.getWorldPosition(tmpV); const toCam = camV.clone().sub(tmpV).normalize();
        if (toCam.dot(p.face) < 0.1) show = false;
        else {
          tmpV.project(camera);
          if (tmpV.z > 1 || tmpV.z < -1) show = false;
          else {
            const x = (tmpV.x * 0.5 + 0.5) * W; const y = (-tmpV.y * 0.5 + 0.5) * H;
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
      if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 36 || performance.now() - down.t > 600) { down = null; return; }
      down = null; const t = pick(e); if (t) { playClick(); t.fn(); }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const targets = mode === 'room' ? roomTargets : pcTargets;
      const hits = raycaster.intersectObjects(targets.map(t => t.root), true);
      if (hits.length > 0) {
        let rootHit = hits[0].object;
        while (rootHit.parent && !targets.find(t => t.root === rootHit)) rootHit = rootHit.parent;
        if (hoveredObj !== rootHit) {
          if (hoveredObj) hoveredObj.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
          hoveredObj = rootHit; hoveredObj.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x220044); });
          el.style.cursor = 'pointer';
          // Mostra o pin interativo correspondente
          const target = targets.find(t => t.root === rootHit);
          if (target && target.isInteractive && target.pinRef) {
            target.pinRef.el.style.opacity = '1';
            target.pinRef.el.style.pointerEvents = 'auto';
          }
        }
      } else {
        if (hoveredObj) { hoveredObj.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); }); hoveredObj = null; }
        el.style.cursor = 'grab';
        // Esconde todos os pins interativos
        pins.forEach(p => { if (p.isInteractive) { p.el.style.opacity = '0'; p.el.style.pointerEvents = 'none'; } });
      }
    });
    
    el.addEventListener('wheel', (e) => {
      if (mode !== 'room' || flying) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.05 : 0.95;
      const off = camera.position.clone().sub(controls.target).multiplyScalar(factor);
      if (off.length() > 0.8 && off.length() < 7) {
        camera.position.copy(controls.target).add(off);
        controls.update();
      }
    }, { passive: false });
  }

  function pick(ev) {
    if (!built || flying) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = mode === 'room' ? roomTargets : pcTargets;
    const hits = raycaster.intersectObjects(targets.map(t => t.root), true);
    if (!hits.length) return null;
    for (let i = 0; i < targets.length; i++) { let o = hits[0].object; while(o) { if(o === targets[i].root) return targets[i]; o = o.parent; } }
    return null;
  }

  function enterPC() {
    if (mode !== 'room' || flying) return;
    savedPose = { pos: camera.position.clone(), target: controls.target.clone() };
    mode = 'pc'; wrap.setAttribute('data-mode', 'pc');
    const c = pcGroup.getWorldPosition(new THREE.Vector3());
    const dist = Math.max(0.95, 0.8 / (W/H) + 0.1);
    tween(900, (e) => { doorPivot.rotation.y = DOOR_OPEN * e; });
    flyTo(new THREE.Vector3(c.x - 0.1, c.y + 0.04, c.z + dist), c, 1100);
  }

  function exitPC() {
    if (mode !== 'pc' || flying) return;
    mode = 'room'; wrap.setAttribute('data-mode', 'room');
    const pose = savedPose || roomPose();
    tween(900, (e) => { doorPivot.rotation.y = DOOR_OPEN * (1 - e); });
    flyTo(pose.pos, pose.target, 1100);
  }
  window.exitPC = exitPC;

  function addHud() {
    pinLayer = document.createElement('div'); pinLayer.className = 's3d-pins'; wrap.appendChild(pinLayer);
    hintEl = document.createElement('div'); hintEl.className = 's3d-hint';
    hintEl.textContent = '🖱️ Arraste para girar · clique nos pontinhos 💜'; wrap.appendChild(hintEl);

    const backBtn = document.createElement('button'); backBtn.className = 's3d-back';
    backBtn.innerHTML = '⬅️ Sair do PC'; backBtn.onclick = (e) => { e.stopPropagation(); exitPC(); };
    wrap.appendChild(backBtn);

    const ctrls = document.createElement('div'); ctrls.className = 's3d-ctrls';
    [['+', 'Aproximar', () => zoomBy(0.8)], ['−', 'Afastar', () => zoomBy(1.25)], ['⟲', 'Resetar', () => flyTo(roomPose().pos, roomPose().target, 900)]].forEach(b => {
      const bt = document.createElement('button'); bt.className = 's3d-btn'; bt.textContent = b[0]; bt.title = b[1]; bt.onclick = b[2]; ctrls.appendChild(bt);
    });
    wrap.appendChild(ctrls);

    ledPanel = document.createElement('div'); ledPanel.className = 's3d-led-panel';
    ['purple', 'pink', 'cyan', 'gold', 'off'].forEach(c => {
      const btn = document.createElement('button'); btn.className = 's3d-led-color'; btn.dataset.color = c; btn.title = c;
      btn.onclick = () => {
        if (c === 'purple') globalLedHue = 0.75; else if (c === 'pink') globalLedHue = 0.9; else if (c === 'cyan') globalLedHue = 0.55; else if (c === 'gold') globalLedHue = 0.12; else globalLedHue = null;
        localStorage.setItem('setup_led', c); playClick();
      };
      ledPanel.appendChild(btn);
    });
    wrap.appendChild(ledPanel);

    const topBar = document.createElement('div'); topBar.className = 's3d-topbar';
    topBar.innerHTML = `<button class="s3d-action-btn" id="btnTour">🎥 Tour Guiado</button><button class="s3d-action-btn" id="btnDayNight">☀️ Dia</button><button class="s3d-action-btn" id="btnMute">🔊 Som</button>`;
    wrap.appendChild(topBar);

    document.getElementById('btnTour').onclick = () => startTour();
    document.getElementById('btnDayNight').onclick = (e) => {
      isNight = !isNight; e.target.textContent = isNight ? '🌙 Noite' : '☀️ Dia';
      const dir = scene.userData.dirLight; if (dir) dir.intensity = isNight ? 0.1 : 1.2;
      scene.children.forEach(c => { if (c.isAmbientLight) c.intensity = isNight ? 0.2 : 0.6; });
    };
    document.getElementById('btnMute').onclick = (e) => {
      isMuted = !isMuted; e.target.textContent = isMuted ? '🔇 Mudo' : '🔊 Som';
      if (ambientAudio) { if (isMuted) ambientAudio.pause(); else ambientAudio.play().catch(()=>{}); }
    };
  }

  function zoomBy(f) { if (!built || flying) return; const off = camera.position.clone().sub(controls.target).multiplyScalar(f); if (off.length() > 0.8 && off.length() < 7) { camera.position.copy(controls.target).add(off); controls.update(); } }

  const TOUR_STOPS = [
    { pos: [0, 1.5, 3.0], target: [0, 1, 0], text: 'Bem-vindo ao meu setup! 💜' },
    { pos: [-0.2, 1.2, 0.8], target: [-0.2, 0.8, 0], text: 'Meu monitor Ultrawide 240Hz!' },
    { pos: [0.85, 1.2, 0.8], target: [0.85, 1.0, -0.1], text: 'O PC dos sonhos: Ryzen 9 e RTX 3060.' },
    { pos: [-0.8, 1.0, 1.0], target: [-0.8, 0.5, 0.9], text: 'E claro, a Sucrilhas tirando um cochilo.' }
  ];

  function startTour() {
    if (tourIndex !== -1) { stopTour(); return; }
    tourIndex = 0; document.getElementById('btnTour').textContent = '🛑 Parar Tour'; runTourStep();
  }
  function runTourStep() {
    if (tourIndex >= TOUR_STOPS.length) { stopTour(); return; }
    const s = TOUR_STOPS[tourIndex];
    hintEl.textContent = s.text; hintEl.style.background = 'rgba(168,85,247,0.92)'; hintEl.style.color = '#fff'; hintEl.style.fontWeight = 'bold';
    flyTo(new THREE.Vector3(...s.pos), new THREE.Vector3(...s.target), 1500, () => { tourTimer = setTimeout(() => { tourIndex++; runTourStep(); }, 3000); });
  }
  function stopTour() {
    tourIndex = -1; clearTimeout(tourTimer); const b = document.getElementById('btnTour'); if (b) b.textContent = '🎥 Tour Guiado';
    hintEl.textContent = '🖱️ Arraste para girar · clique nos pontinhos 💜'; hintEl.style.background = ''; hintEl.style.color = ''; hintEl.style.fontWeight = '';
    flyTo(roomPose().pos, roomPose().target, 1000);
  }

  document.addEventListener('keydown', (e) => {
    if (!built || !visible || mode !== 'room') return;
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const kb = interactiveKeys[0];
    if (kb) { const orig = kb.material.color.getHex(); kb.material.color.setHex(0xa855f7); setTimeout(() => kb.material.color.setHex(orig), 100); }
  });

  let lastFrameTime = performance.now();
  function tick() {
    raf = 0; if (!built || !visible) return; const now = performance.now(); const delta = now - lastFrameTime; lastFrameTime = now;
    if (delta > 0 && !lowQuality) {
      const fpsNow = 1000 / delta;
      if (fpsNow < 25) { lowQuality = true; renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); if(composer) { composer.setPixelRatio(1); } }
    }
    runTweens(now); if (controls.enabled) controls.update();
    
    if (globalLedHue !== null) { rgbMats.forEach(r => r.m.color.setHSL(globalLedHue, 0.9, 0.6)); } else { rgbMats.forEach(r => r.m.color.setHex(0x111111)); }
    
    if (rainMesh) {
      const p = rainMesh.geometry.attributes.position.array;
      for (let i = 0; i < p.length/3; i++) { p[i*3+1] -= rainVel[i]; if (p[i*3+1] < 1.0) p[i*3+1] = 2.0; }
      rainMesh.geometry.attributes.position.needsUpdate = true;
    }
    if (coffeeSteam) {
      const p = coffeeSteam.geometry.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) { p[i+1] += 0.005; if (p[i+1] > 0.95) { p[i+1] = 0.8; p[i] = 0.5 + (Math.random()-0.5)*0.02; } }
      coffeeSteam.geometry.attributes.position.needsUpdate = true;
    }
    if (catGroup) { catBreath += 0.05; catGroup.scale.y = 1 + Math.sin(catBreath) * 0.03; if(catTail) catTail.rotation.y = Math.sin(catBreath * 0.5) * 0.3; }
    fans.forEach(f => { f.rotation.z += 0.2; });

    // Animações de objetos interativos
    if (plantGrowing) {
      plantGrow = Math.min(1, plantGrow + 0.02);
      if (plantGroup) {
        plantGroup.scale.y = 1 + plantGrow * 0.5;
        plantGroup.scale.x = 1 + plantGrow * 0.2;
        plantGroup.scale.z = 1 + plantGrow * 0.2;
      }
      if (plantGrow >= 1) { plantGrowing = false; plantGrow = 0; }
    }
    if (drawerOpen && drawerAnim < 1) { drawerAnim = Math.min(1, drawerAnim + 0.05); if (drawerGroup) drawerGroup.position.z = 0.4 + drawerAnim * 0.2; }
    if (!drawerOpen && drawerAnim > 0) { drawerAnim = Math.max(0, drawerAnim - 0.05); if (drawerGroup) drawerGroup.position.z = 0.4 + drawerAnim * 0.2; }
    if (chairSpinning) {
      if (chairGroup) chairGroup.rotation.y += chairSpinSpeed;
      chairSpinSpeed *= 0.98;
      if (chairSpinSpeed < 0.001) { chairSpinning = false; chairSpinSpeed = 0; }
    }

    updatePins();
    
    try {
      if (composer) { composer.render(); } else { renderer.render(scene, camera); }
    } catch(e) {
      console.error('Erro no render:', e);
      if (composer) {
        composer = null;
        try { renderer.render(scene, camera); } catch(e2){}
      }
    }
    
    raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && built && visible) { lastFrameTime = performance.now(); raf = requestAnimationFrame(tick); } }

  function resize(w, h) {
    W = w; H = h; renderer.setSize(w, h); if (composer) composer.setSize(w, h);
    if (fxaaPass) { const pixelRatio = renderer.getPixelRatio(); fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * pixelRatio); fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * pixelRatio); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function build(w, h) {
    tmpV = new THREE.Vector3(); camV = new THREE.Vector3();
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
      renderer.outputEncoding = THREE.sRGBEncoding;
    } catch (err) {
      container.innerHTML = '<div class="s3d-fallback" style="color:#ff8a95">Seu navegador não conseguiu abrir o modo 3D. Tente atualizar o navegador 💜</div>'; return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h); renderer.setClearColor(0x0a0511, 1);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;cursor:grab';
    container.appendChild(renderer.domElement); W = w; H = h;

    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(45, w / h, 0.05, 40); raycaster = new THREE.Raycaster();
    
    addHud(); 
    
    try {
      buildLights(); buildRoom(); buildDeskAndPeripherals(); buildChairAndCat(); buildPC(); buildInteractiveObjects();
    } catch(e) {
      console.error('Erro ao construir cena:', e);
      container.innerHTML = `<div class="s3d-fallback" style="color:#ff8a95">Erro ao montar cena: ${e.message}</div>`;
      return;
    }

    const saved = localStorage.getItem('setup_led') || 'purple';
    if (saved === 'purple') globalLedHue = 0.75; else if (saved === 'pink') globalLedHue = 0.9; else if (saved === 'cyan') globalLedHue = 0.55; else if (saved === 'gold') globalLedHue = 0.12; else globalLedHue = null;

    const pose = roomPose(); camera.position.copy(pose.pos);
    
    if (typeof THREE.OrbitControls === 'undefined') {
      container.innerHTML = '<div class="s3d-fallback" style="color:#ff8a95">OrbitControls não carregou. Recarregue a página.</div>'; return;
    }
    controls = new THREE.OrbitControls(camera, renderer.domElement); controls.target.copy(pose.target);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.enableZoom = false;
    controls.rotateSpeed = 0.7; controls.minDistance = 0.8; controls.maxDistance = 7; controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
      try {
        const renderScene = new THREE.RenderPass(scene, camera);
        bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 1.0, 0.4, 0.85);
        composer = new THREE.EffectComposer(renderer); 
        composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); 
        composer.setSize(w, h);
        composer.addPass(renderScene); 
        composer.addPass(bloomPass);

        fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
        const pixelRatio = renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * pixelRatio); 
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * pixelRatio);
        composer.addPass(fxaaPass);
      } catch(e) {
        console.warn('Falha no pós-processamento:', e);
        composer = null;
      }
    } else {
      console.warn('Bibliotecas de pós-processamento não carregadas. Usando renderização padrão.');
      composer = null;
    }

    bindPointer(); scene.updateMatrixWorld(true); built = true; kick();
  }

  function init() {
    if (started) return; container = document.getElementById('setup360Container'); if (!container) return;
    started = true; wrap = container.closest('.setup-360-wrap') || container;
    if (typeof THREE === 'undefined') {
      container.innerHTML = '<div class="s3d-fallback" style="color:#ff8a95">Não consegui carregar o Three.js. Recarregue a página 💜</div>'; return;
    }
    
    setTimeout(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (w > 0 && h > 0 && !built) build(w, h);
    }, 100);

    const ro = new ResizeObserver(() => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; if (!built) build(w, h); else resize(w, h); });
    ro.observe(container);
    const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; if (visible) kick(); }, { threshold: 0.01 });
    io.observe(container);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode === 'pc' && !document.querySelector('dialog[open]')) exitPC(); });
  }

  return { init };
})();

async function initSetup() {
  try {
    await carregarSetupData();
  } catch(e) {
    console.warn('Erro ao carregar dados do setup:', e);
  }
  
  if (typeof renderSonhos === 'function') { try { renderSonhos(); } catch(e){} }
  if (typeof renderApoiadores === 'function') { try { renderApoiadores(); } catch(e){} }
  
  Setup3D.init();
}
window.initSetup = initSetup;
window.setupSetup3D = initSetup; 

document.addEventListener('DOMContentLoaded', () => {
  if (!window.__setupIniciado) { window.__setupIniciado = true; initSetup(); }
});