/* ============================================================
   SETUP — CENA 3D ULTIMATE (GLB + BLOOM + TOUR + DEBUG)
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
      </div>
    </div>`;
  $('dlg').showModal();
}
window.abrirItemSetup = abrirItemSetup;

/* ============================================================
   Setup3D — O MOTOR DEFINITIVO
   ============================================================ */
const Setup3D = (function () {
  let built = false, visible = false;
  let container, wrap, W = 0, H = 0;
  let renderer, scene, camera, controls, raycaster, composer;
  let model = null;
  let raf = 0;
  let savedPose = null;
  const roomTargets = [];
  const tweens = [];
  let dayNight = 'day';

  // Mapeamento (vamos usar o Cube320 pois é o que o modelo tem)
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
    controls.enabled = false;
    tween(dur, (e) => {
      camera.position.lerpVectors(p0, pos, e);
      controls.target.lerpVectors(t0, target, e);
      camera.lookAt(controls.target);
    }, () => {
      camera.position.copy(pos);
      controls.target.copy(target);
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
        
        // CENTRALIZA O MODELO NO MUNDO (MUITO IMPORTANTE)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center); // Move o modelo para o centro (0,0,0)

        // DEBUG: Adiciona uma caixa verde ao redor do modelo. Se a caixa aparecer, o modelo está lá!
        const helper = new THREE.BoxHelper(model, 0x00ff00);
        scene.add(helper);

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (MAPA_OBJETOS[child.name]) {
              roomTargets.push(child);
            }
          }
        });
        scene.add(model);
        resolve(box);
      }, undefined, (err) => {
        console.error('Erro ao carregar modelo:', err);
        reject(err);
      });
    });
  }

  function setupLights() {
    // Luzes focadas no centro (0,0,0)
    const ambient = new THREE.AmbientLight(0xffffff, 2.0); 
    scene.add(ambient);
    
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
    scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    
    // Luzes coloridas para dar o tom gamer
    const p1 = new THREE.PointLight(0xa855f7, 2, 50);
    p1.position.set(5, 5, 5);
    scene.add(p1);
    const p2 = new THREE.PointLight(0xff6ec7, 2, 50);
    p2.position.set(-5, 5, -5);
    scene.add(p2);
  }

  function setupPostProcessing() {
    if (typeof THREE.EffectComposer === 'undefined') return;
    try {
      const renderScene = new THREE.RenderPass(scene, camera);
      const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 1.0, 0.4, 0.85);
      composer = new THREE.EffectComposer(renderer);
      composer.addPass(renderScene);
      composer.addPass(bloomPass);
    } catch (e) { composer = null; }
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
          abrirItemSetup(MAPA_OBJETOS[obj.name].grupo, MAPA_OBJETOS[obj.name].idx);
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
    
    // Requer o pós-processamento para o Bloom funcionar
    if (composer) composer.render();
    else renderer.render(scene, camera);
    
    raf = requestAnimationFrame(tick);
  }

  function build(w, h) {
    W = w; H = h;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x0a0511, 1); 
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    raycaster = new THREE.Raycaster();

    setupLights();
    setupPostProcessing();

    loadModel().then((box) => {
      // Como o modelo agora está no centro (0,0,0), a câmera fica fácil.
      // Tamanho do modelo: 10x6x10. Vamos colocar a câmera a 15 metros de distância.
      
      camera.position.set(0, 5, 15); 
      camera.lookAt(0, 0, 0);

      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxDistance = 30;
      controls.minDistance = 2;
      controls.maxPolarAngle = Math.PI / 2 + 0.1; // Permite olhar um pouco pra baixo
      controls.update();
      
      savedPose = { pos: camera.position.clone(), target: controls.target.clone() };

      setupInteractivity();
      built = true;
      if (!raf) raf = requestAnimationFrame(tick);
    }).catch(() => {
      container.innerHTML = '<div style="color:#fff;text-align:center;padding-top:20%">Erro ao carregar o modelo.</div>';
    });

    // Botão Resetar
    const backBtn = document.createElement('button');
    backBtn.className = 's3d-back';
    backBtn.innerHTML = '⟲ Resetar Câmera';
    backBtn.style.display = 'flex';
    backBtn.onclick = () => { if(savedPose) flyTo(savedPose.pos, savedPose.target, 1000); };
    container.appendChild(backBtn);
  }

  function init() {
    container = document.getElementById('setup360Container');
    if (!container) return;
    if (!built) build(container.clientWidth, container.clientHeight);

    window.addEventListener('resize', () => {
      if (!built) return;
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (composer) composer.setSize(w, h);
    });
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