/* ============================================================
   SETUP — CENA 3D COM INTERAÇÃO NO PC
   ============================================================ */

// --- CONFIGURAÇÃO DE DEBUG (Mude para false quando terminar de alinhar) ---
const DEBUG_MODE = true; 
// -------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  // 1. Configuração Básica
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0511);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000); // Aspect ratio inicial seguro
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // === O SEGREDO PARA NÃO FICAR PRETO ===
  // Isso avisa o 3D para se ajustar quando a aba do setup for aberta
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  });
  resizeObserver.observe(container);
  // =======================================

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

  // 2. Iluminação
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // 3. Variáveis Globais do PC
  let pcHitbox, monitorScreen;
  let isInsidePC = false;
  const savedCameraPos = new THREE.Vector3();
  const savedControlsTarget = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // 4. Carregar o Modelo
  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  loader.load('/assets/models/room.glb', (gltf) => {
    const model = gltf.scene;
    
    // Centraliza o modelo no mundo
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);

    // --- CRIAÇÃO DOS OBJETOS INTERATIVOS ---
    
    // A) A HITBOX DO PC (Caixa Vermelha no modo debug)
    // Olhando sua foto, o PC fica na mesa da direita. Vamos mover a caixa pra lá.
    const hitboxGeo = new THREE.BoxGeometry(2, 2, 2); 
    const hitboxMat = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: DEBUG_MODE ? 0.5 : 0, 
      depthWrite: false
    });
    pcHitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    pcHitbox.position.set(3, 2, -1); // <--- Mudei para 3, 2, -1. Vamos ajustar!
    pcHitbox.userData.type = 'pc';
    scene.add(pcHitbox);

    // B) A TELA DO MONITOR (Quadrado Azul no modo debug)
    const screenGeo = new THREE.PlaneGeometry(3, 1.8); // Tamanho mais próximo de um monitor
    const screenMat = new THREE.MeshBasicMaterial({ 
      color: 0x0000ff, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: DEBUG_MODE ? 0.5 : 0
    });
    monitorScreen = new THREE.Mesh(screenGeo, screenMat);
    monitorScreen.position.set(2, 2.2, -0.5); // <--- Ajustei para ficar na frente da tela
    monitorScreen.rotation.y = -Math.PI / 2; // Gira a tela para ficar de frente pro jogador
    monitorScreen.userData.type = 'screen';
    scene.add(monitorScreen);

    // --- AJUSTE DE CÂMERA INICIAL ---
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.2;

    camera.position.set(distance * 0.8, distance * 0.5, distance);
    camera.lookAt(0, 0, 0);
    
    controls.target.set(0, 0, 0);
    controls.update();

    // 5. Configurar Interação (Clique)
    setupInteractivity();

  }, undefined, (error) => {
    console.error('Erro ao carregar:', error);
  });

  // ==========================================
  // FUNÇÕES DE TRANSIÇÃO DE CÂMERA (VOO)
  // ==========================================
  function flyToCamera(targetPos, targetLookAt, duration, onComplete) {
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();

    function animateCamera(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTarget, targetLookAt, ease);
      camera.lookAt(controls.target);

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else if (onComplete) {
        onComplete();
      }
    }
    requestAnimationFrame(animateCamera);
  }

  function enterPC() {
    if (isInsidePC) return;
    isInsidePC = true;
    controls.enabled = false;

    savedCameraPos.copy(camera.position);
    savedControlsTarget.copy(controls.target);

    // Vai pra frente da tela do monitor
    const targetPos = new THREE.Vector3(monitorScreen.position.x + 3, monitorScreen.position.y, monitorScreen.position.z);
    const targetLook = monitorScreen.position.clone();

    flyToCamera(targetPos, targetLook, 1500, () => {
      monitorScreen.material.opacity = 1;
      monitorScreen.material.color.setHex(0x111111); 
      
      // Coloque a URL da sua foto da tela do PC aqui:
      // new THREE.TextureLoader().load('https://sualink.com/foto.jpg', (tex) => {
      //   monitorScreen.material.map = tex;
      //   monitorScreen.material.needsUpdate = true;
      // });
      
      document.getElementById('btnSairPC').style.display = 'block';
    });
  }

  function exitPC() {
    if (!isInsidePC) return;
    isInsidePC = false;
    document.getElementById('btnSairPC').style.display = 'none';

    monitorScreen.material.opacity = DEBUG_MODE ? 0.5 : 0;
    monitorScreen.material.color.setHex(0x0000ff);

    flyToCamera(savedCameraPos, savedControlsTarget, 1200, () => {
      controls.enabled = true;
    });
  }

  window.exitPC = exitPC;

  // ==========================================
  // INTERATIVIDADE (CLIQUE)
  // ==========================================
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
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects([pcHitbox], true);
      
      if (hits.length > 0 && !isInsidePC) {
        enterPC();
      }
    });
  }

  // 6. Loop de Renderização
  function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled) controls.update();
    
    // Só renderiza se a tela tiver tamanho (evita erro)
    if (container.clientWidth > 0 && container.clientHeight > 0) {
        renderer.render(scene, camera);
    }
  }
  animate();
});