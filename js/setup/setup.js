/* ============================================================
   SETUP — CENA 3D REALISTA (GLB + BAKED LIGHTING + DRACO)
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

function abrirItemSetup(grupoId, idx) {
  const g = SETUP_DATA.find(x => x.id === grupoId);
  if (!g) return;
  const it = g.itens[idx];
  if (!it) return;
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

function copiarLinkItem(nome) {
  const url = window.location.origin + '/#setup/' + encodeURIComponent(nome);
  navigator.clipboard.writeText(url).then(() => toast('Link copiado! 💜', 'ok'));
}
window.copiarLinkItem = copiarLinkItem;

/* ============================================================
   Setup3D — classe principal
   ============================================================ */
const Setup3D = (function () {
  let started = false, built = false, visible = false;
  let container, wrap, pinLayer, hintEl, ledPanel, W = 0, H = 0;
  let renderer, scene, camera, controls, raycaster;
  let composer, bloomPass, fxaaPass;
  let model = null;
  let mode = 'room';
  let flying = false;
  let raf = 0;
  let savedPose = null;
  const pins = [];
  const roomTargets = [];
  const tweens = [];
  let tmpV = null, camV = null;
  let hoveredObject = null;
  let dayNight = 'day';
  let ledColor = '#a855f7';
  let tourIndex = -1;
  let tourTimer = null;
  let lowQuality = false;
  let ambientAudio = null;
  let isMuted = false;
  let audioCtx = null;

  // ⚠️ VAMOS AJUSTAR ESSES NOMES NO PASSO 5 (depois de testar)
  const MAPA_OBJETOS = {
    'PC':        { grupo: 'pc',    idx: 0 },
    'Monitor':   { grupo: 'per',   idx: 4 },
    'Keyboard':  { grupo: 'per',   idx: 0 },
    'Mouse':     { grupo: 'per',   idx: 1 },
    'Microphone':{ grupo: 'per',   idx: 3 },
    'Chair':     { grupo: 'extra', idx: 0 },
    'Plant':     { grupo: 'extra', idx: 1 },
    'Lamp':      { grupo: 'extra', idx: 2 }
  };

  const TOUR_STOPS = [
    { pos: [0, 1.5, 3.0], target: [0, 1, 0], text: 'Bem-vindo ao meu setup! 💜' },
    { pos: [-0.2, 1.2, 0.8], target: [-0.2, 0.8, 0], text: 'Meu monitor Ultrawide 240Hz!' },
    { pos: [0.85, 1.2, 0.8], target: [0.85, 1.0, -0.1], text: 'O PC dos sonhos: Ryzen 9 e RTX 3060.' },
    { pos: [-0.8, 1.0, 1.0], target: [-0.8, 0.5, 0.9], text: 'E claro, a Sucrilhas tirando um cochilo.' }
  ];

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function tween(dur, fn, done) {
    tweens.push({ t0: performance.now(), dur, fn, done });
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
    tween(dur, (e) => {
      camera.position.lerpVectors(p0, pos, e);
      controls.target.lerpVectors(t0, target, e);
      camera.lookAt(controls.target);
    }, () => {
      camera.position.copy(pos);
      controls.target.copy(target);
      flying = false;
      controls.enabled = true;
      controls.update();
      if (done) done();
    });
  }

  function roomPose() {
    const aspect = Math.max(0.4, W / Math.max(1, H));
    const dist = Math.min(5.5, Math.max(2.8, 3.0 / aspect));
    const dir = new THREE.Vector3(1.4, 0.55, 2.35).normalize();
    const target = new THREE.Vector3(0.05, 0.98, 0);
    return { pos: target.clone().addScaledVector(dir, dist), target };
  }

  // ============ CARREGAMENTO DO GLB COM DRACO ============
  async function loadModel() {
    const loader = new THREE.GLTFLoader();
    if (typeof THREE.DRACOLoader !== 'undefined') {
      const dracoLoader = new THREE.DRACOLoader();
      // 🆕 CORREÇÃO AQUI: Baixando do jsdelivr em vez do gstatic.com
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      loader.setDRACOLoader(dracoLoader);
    }

    return new Promise((resolve, reject) => {
      loader.load(
        '/assets/models/room.glb',
        (gltf) => {
          model = gltf.scene;
          const nomes = [];
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.name) nomes.push(child.name);
              if (child.name && MAPA_OBJETOS[child.name]) {
                child.userData.interactive = true;
                roomTargets.push(child);
              }
            }
          });
          console.log('📦 Objetos no GLB:', nomes.join(', '));
          console.log('💡 Copie os nomes reais para o MAPA_OBJETOS no código.');
          scene.add(model);
          resolve();
        },
        undefined,
        (error) => {
          console.error('Erro ao carregar o modelo:', error);
          reject(error);
        }
      );
    });
  }

  function setupLights() {
    scene.add(new THREE.AmbientLight(0x402060, 0.8));
    scene.add(new THREE.HemisphereLight(0xb9a6ff, 0x1a0f2b, 0.6));

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 4, 2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    scene.userData.dirLight = dirLight;

    const p1 = new THREE.PointLight(0xa855f7, 1.5, 5);
    p1.position.set(1.0, 1.7, 1.0);
    scene.add(p1);
    const p2 = new THREE.PointLight(0xff6ec7, 1.0, 4);
    p2.position.set(-1.2, 1.3, 0.8);
    scene.add(p2);
  }

  function setupPostProcessing() {
    try {
      const renderScene = new THREE.RenderPass(scene, camera);
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.4, 0.85);
      composer = new THREE.EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setSize(W, H);
      composer.addPass(renderScene);
      composer.addPass(bloomPass);

      fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
      const pixelRatio = renderer.getPixelRatio();
      fxaaPass.material.uniforms['resolution'].value.x = 1 / (W * pixelRatio);
      fxaaPass.material.uniforms['resolution'].value.y = 1 / (H * pixelRatio);
      composer.addPass(fxaaPass);
    } catch (e) {
      console.warn('Pós-processamento indisponível:', e);
      composer = null;
    }
  }

  function setupInteractivity() {
    const el = renderer.domElement;
    let down = null;

    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      initAudio();
    });

    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 36 || performance.now() - down.t > 600) { down = null; return; }
      down = null;
      const hit = pick(e);
      if (hit) {
        playClick();
        const obj = hit.object;
        const info = MAPA_OBJETOS[obj.name];
        if (info) abrirItemSetup(info.grupo, info.idx);
        else toast(`Objeto: ${obj.name}`, 'info');
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(roomTargets, true);
      if (hits.length > 0) {
        let rootHit = hits[0].object;
        while (rootHit.parent && !roomTargets.includes(rootHit)) rootHit = rootHit.parent;
        if (hoveredObject !== rootHit) {
          if (hoveredObject) hoveredObject.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
          hoveredObject = rootHit;
          hoveredObject.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x220044); });
          el.style.cursor = 'pointer';
        }
      } else {
        if (hoveredObject) {
          hoveredObject.traverse(c => { if (c.material && c.material.emissive) c.material.emissive.setHex(0x000000); });
          hoveredObject = null;
        }
        el.style.cursor = 'grab';
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
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(roomTargets, true);
    if (!hits.length) return null;
    for (let i = 0; i < roomTargets.length; i++) {
      let o = hits[0].object;
      while (o) {
        if (o === roomTargets[i]) return { object: o };
        o = o.parent;
      }
    }
    return null;
  }

  function addHud() {
    pinLayer = document.createElement('div');
    pinLayer.className = 's3d-pins';
    wrap.appendChild(pinLayer);

    hintEl = document.createElement('div');
    hintEl.className = 's3d-hint';
    hintEl.textContent = '🖱️ Arraste para girar · clique nos pontinhos 💜';
    wrap.appendChild(hintEl);

    const backBtn = document.createElement('button');
    backBtn.className = 's3d-back';
    backBtn.innerHTML = '⬅️ Sair do PC';
    backBtn.onclick = (e) => { e.stopPropagation(); exitPC(); };
    wrap.appendChild(backBtn);

    const ctrls = document.createElement('div');
    ctrls.className = 's3d-ctrls';
    [['+', 'Aproximar', () => zoomBy(0.8)],
     ['−', 'Afastar', () => zoomBy(1.25)],
     ['⟲', 'Resetar', () => flyTo(roomPose().pos, roomPose().target, 900)]
    ].forEach(b => {
      const bt = document.createElement('button');
      bt.className = 's3d-btn';
      bt.textContent = b[0];
      bt.title = b[1];
      bt.onclick = b[2];
      ctrls.appendChild(bt);
    });
    wrap.appendChild(ctrls);

    ledPanel = document.createElement('div');
    ledPanel.className = 's3d-led-panel';
    ['purple', 'pink', 'cyan', 'gold', 'off'].forEach(c => {
      const btn = document.createElement('button');
      btn.className = 's3d-led-color';
      btn.dataset.color = c;
      btn.title = c;
      btn.onclick = () => {
        if (c === 'purple') ledColor = '#a855f7';
        else if (c === 'pink') ledColor = '#ff6ec7';
        else if (c === 'cyan') ledColor = '#7dd3fc';
        else if (c === 'gold') ledColor = '#ffd166';
        else ledColor = '#111111';
        aplicarCorLed();
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

    document.getElementById('btnTour').onclick = startTour;
    document.getElementById('btnDayNight').onclick = toggleDayNight;
    document.getElementById('btnMute').onclick = toggleMute;
  }

  function aplicarCorLed() {
    if (!model) return;
    model.traverse((child) => {
      if (child.isMesh && child.material && child.material.name && child.material.name.includes('LED')) {
        child.material.emissive.setHex(parseInt(ledColor.replace('#', '0x')));
      }
    });
  }

  function toggleDayNight() {
    const btn = document.getElementById('btnDayNight');
    dayNight = dayNight === 'day' ? 'night' : 'day';
    btn.textContent = dayNight === 'day' ? '☀️ Dia' : '🌙 Noite';
    const dir = scene.userData.dirLight;
    if (dir) dir.intensity = dayNight === 'day' ? 1.2 : 0.2;
    scene.children.forEach(c => {
      if (c.isAmbientLight) c.intensity = dayNight === 'day' ? 0.8 : 0.3;
    });
  }

  function toggleMute() {
    const btn = document.getElementById('btnMute');
    isMuted = !isMuted;
    btn.textContent = isMuted ? '🔇 Mudo' : '🔊 Som';
    if (ambientAudio) {
      if (isMuted) ambientAudio.pause();
      else ambientAudio.play().catch(() => {});
    }
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      if (!ambientAudio) {
        ambientAudio = new Audio('https://cdn.pixabay.com/audio/2022/11/22/audio_4b5f4d363a.mp3');
        ambientAudio.loop = true;
        ambientAudio.volume = 0.15;
        if (!isMuted) ambientAudio.play().catch(() => {});
      }
    } catch (e) {}
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
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  }

  function zoomBy(f) {
    if (!built || flying) return;
    const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
    if (off.length() > 0.8 && off.length() < 7) {
      camera.position.copy(controls.target).add(off);
      controls.update();
    }
  }

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

  function enterPC() {
    if (mode !== 'room' || flying) return;
    savedPose = { pos: camera.position.clone(), target: controls.target.clone() };
    mode = 'pc';
    wrap.setAttribute('data-mode', 'pc');
    const pcPos = new THREE.Vector3(0.85, 1.0, -0.1);
    const dist = Math.max(0.95, 0.8 / (W / H) + 0.1);
    flyTo(new THREE.Vector3(pcPos.x - 0.1, pcPos.y + 0.04, pcPos.z + dist), pcPos, 1100);
  }

  function exitPC() {
    if (mode !== 'pc' || flying) return;
    mode = 'room';
    wrap.setAttribute('data-mode', 'room');
    const pose = savedPose || roomPose();
    flyTo(pose.pos, pose.target, 1100);
  }
  window.exitPC = exitPC;

  function createPins() {
    roomTargets.forEach(obj => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 's3d-pin';
      const icon = obj.name === 'PC' ? '💻' :
                   obj.name === 'Monitor' ? '🖥️' :
                   obj.name === 'Keyboard' ? '⌨️' :
                   obj.name === 'Mouse' ? '🖱️' :
                   obj.name === 'Microphone' ? '🎙️' :
                   obj.name === 'Chair' ? '🪑' : '📦';
      el.innerHTML = `<span>${icon}</span><span class="s3d-pin-label">${obj.name}</span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (flying) return;
        playClick();
        const info = MAPA_OBJETOS[obj.name];
        if (info) abrirItemSetup(info.grupo, info.idx);
        else if (obj.name === 'PC') enterPC();
      });
      pinLayer.appendChild(el);
      pins.push({ el, obj, on: false });
    });
  }

  function updatePins() {
    camera.getWorldPosition(camV);
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      let show = !flying && mode === 'room';
      if (show) {
        const worldPos = new THREE.Vector3();
        p.obj.getWorldPosition(worldPos);
        const toCam = camV.clone().sub(worldPos).normalize();
        const normal = new THREE.Vector3(0, 0, 1);
        if (toCam.dot(normal) < 0.1) show = false;
        else {
          worldPos.project(camera);
          if (worldPos.z > 1 || worldPos.z < -1) show = false;
          else {
            const x = (worldPos.x * 0.5 + 0.5) * W;
            const y = (-worldPos.y * 0.5 + 0.5) * H;
            p.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          }
        }
      }
      if (show !== p.on) {
        p.on = show;
        p.el.classList.toggle('on', show);
      }
    }
  }

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
        if (composer) composer.setPixelRatio(1);
      }
    }

    runTweens(now);
    if (controls.enabled) controls.update();
    updatePins();

    try {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    } catch (e) {
      console.error('Erro no render:', e);
      if (composer) {
        composer = null;
        try { renderer.render(scene, camera); } catch (e2) {}
      }
    }

    raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (!raf && built && visible) {
      lastFrameTime = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

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

  async function build(w, h) {
    tmpV = new THREE.Vector3();
    camV = new THREE.Vector3();

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputEncoding = THREE.sRGBEncoding;
    } catch (err) {
      container.innerHTML = '<div class="s3d-fallback" style="color:#ff8a95">Seu navegador não conseguiu abrir o modo 3D.</div>';
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
    setupLights();

    try {
      await loadModel();
    } catch (e) {
      container.innerHTML = `<div class="s3d-fallback" style="color:#ff8a95">Erro ao carregar o modelo 3D.<br>Verifique se <code>assets/models/room.glb</code> existe.</div>`;
      return;
    }

    const savedLed = localStorage.getItem('setup_led') || 'purple';
    if (savedLed === 'purple') ledColor = '#a855f7';
    else if (savedLed === 'pink') ledColor = '#ff6ec7';
    else if (savedLed === 'cyan') ledColor = '#7dd3fc';
    else if (savedLed === 'gold') ledColor = '#ffd166';
    else ledColor = '#111111';
    aplicarCorLed();

    const pose = roomPose();
    camera.position.copy(pose.pos);

    if (typeof THREE.OrbitControls === 'undefined') {
      container.innerHTML = '<div class="s3d-fallback" style="color:#ff8a95">OrbitControls não carregou. Recarregue a página.</div>';
      return;
    }

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(pose.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.7;
    controls.minDistance = 0.8;
    controls.maxDistance = 7;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.update();

    setupPostProcessing();
    setupInteractivity();
    createPins();

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

    if (typeof THREE === 'undefined') {
      container.innerHTML = '<div class="s3d-fallback" style="color:#ff8a95">Não consegui carregar o Three.js. Recarregue a página 💜</div>';
      return;
    }

    setTimeout(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (w > 0 && h > 0 && !built) build(w, h);
    }, 100);

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      if (!built) build(w, h);
      else resize(w, h);
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

async function initSetup() {
  try {
    await carregarSetupData();
  } catch (e) {
    console.warn('Erro ao carregar dados do setup:', e);
  }

  if (typeof renderSonhos === 'function') { try { renderSonhos(); } catch (e) {} }
  if (typeof renderApoiadores === 'function') { try { renderApoiadores(); } catch (e) {} }

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