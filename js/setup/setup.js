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
  let container, wrap, W = 0, H = 0;
  let renderer, scene, camera, controls, raycaster;
  let model = null;
  let flying = false;
  let raf = 0;
  let savedPose = null;
  const roomTargets = [];
  const tweens = [];
  let hoveredObject = null;
  let dayNight = 'day';
  let audioCtx = null;

  const MAPA_OBJETOS = {
    'Cube320':   { grupo: 'pc',    idx: 0 } 
  };

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

  function loadModel() {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
      loader.setDRACOLoader(dracoLoader);

      loader.load('/assets/models/room.glb', (gltf) => {
        model = gltf.scene;
        
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (MAPA_OBJETOS[child.name]) {
              child.userData.interactive = true;
              roomTargets.push(child);
            }
          }
        });
        scene.add(model);
        resolve();
      }, undefined, (err) => {
        console.error('Erro ao carregar modelo:', err);
        reject(err);
      });
    });
  }

  function setupLights() {
    // Luz ambiente BRUTA pra ter certeza que nada fica preto
    const ambient = new THREE.AmbientLight(0xffffff, 3.0); 
    scene.add(ambient);
    
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xffffff, 4.0);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);
    
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight2.position.set(-5, -10, -5);
    scene.add(dirLight2);
  }

  function setupInteractivity() {
    const el = renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 36) return; 
      down = null;
      
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj.parent && obj.parent !== scene) obj = obj.parent;
        
        if (MAPA_OBJETOS[obj.name]) {
          const info = MAPA_OBJETOS[obj.name];
          abrirItemSetup(info.grupo, info.idx);
        } else {
          toast(`Objeto: ${obj.name}`, 'info');
        }
      }
    });
  }

  function tick(now) {
    if (!built || !visible) return;
    
    if (now) runTweens(now);
    if (controls && controls.enabled) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
    
    raf = requestAnimationFrame(tick);
  }

  function build(w, h) {
    W = w; H = h;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    // Fundo roxo pra debug
    renderer.setClearColor(0x1a102d, 1); 
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    raycaster = new THREE.Raycaster();

    setupLights();

    loadModel().then(() => {
      // 2. AUTO-FRAME MANUAL E SEGURO
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      console.log('🔍 DEBUG DO MODELO:');
      console.log('Tamanho (size):', size);
      console.log('Centro (center):', center);

      // Fallback se o cálculo der NaN (modelo quebrado)
      if (isNaN(size.x) || size.x === 0) {
          camera.position.set(0, 5, 15);
          controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.target.set(0, 0, 0);
      } else {
          // Posiciona a câmera muito longe pra ver a sala inteira
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          distance *= 1.5; // Zoom out extra

          const pos = center.clone().add(new THREE.Vector3(distance, distance * 0.5, distance));
          camera.position.copy(pos);
          camera.lookAt(center);

          controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.target.copy(center);
          controls.enableDamping = true;
          controls.update();
          
          savedPose = { pos: pos.clone(), target: center.clone() };
      }

      setupInteractivity();
      built = true;
      if (!raf) raf = requestAnimationFrame(tick);
    }).catch(() => {
      container.innerHTML = '<div style="color:#fff;text-align:center;padding-top:20%">Erro ao carregar a sala.</div>';
    });

    const backBtn = document.createElement('button');
    backBtn.className = 's3d-back';
    backBtn.innerHTML = '⟲ Resetar Câmera';
    backBtn.onclick = () => { if(savedPose) flyTo(savedPose.pos, savedPose.target, 1000); };
    container.appendChild(backBtn);
  }

  function init() {
    container = document.getElementById('setup360Container');
    if (!container) return;
    if (!built) build(container.clientWidth, container.clientHeight);
  }

  return { init };
})();

window.initSetup = function() {
  carregarSetupData();
  Setup3D.init();
};

document.addEventListener('DOMContentLoaded', () => {
  if (!window.__setupIniciado) {
    window.__setupIniciado = true;
    initSetup();
  }
});