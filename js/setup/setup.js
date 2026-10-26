/* ============================================================
   SETUP — CENA 3D COM PC REALISTA DO GITHUB
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  // 1. CONFIGURAÇÃO DA TELA
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0511);
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Avisa o 3D para se ajustar quando a tela abre (resolve o problema da tela preta)
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  });
  resizeObserver.observe(container);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Luzes
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // Variáveis
  let roomModel = null;
  let pcRealista = null;
  let isInsidePC = false;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickablePCs = [];

  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  // 2. CARREGA A SALA
  loader.load('/assets/models/room.glb', (gltf) => {
    roomModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(roomModel);
    const center = box.getCenter(new THREE.Vector3());
    roomModel.position.sub(center);
    scene.add(roomModel);

    // Caixa invisível na sala para clicar e entrar no PC
    const pcHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2), 
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 })
    );
    pcHitbox.position.set(3.5, 1.5, -1.5); // Ajustado para onde o PC da sala fica
    pcHitbox.userData.isPC = true;
    scene.add(pcHitbox);
    clickablePCs.push(pcHitbox);

    // Posição inicial da câmera
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Carrega o PC realista
    carregarPCRealista();
    
    setupInteractivity();
  });

  // 3. CARREGA O PC DO GITHUB (free_gaming_pc.glb)
  function carregarPCRealista() {
    loader.load('/assets/models/free_gaming_pc.glb', (gltf) => {
      pcRealista = gltf.scene;
      pcRealista.visible = false; // Começa escondido
      
      // Ajusta o tamanho e a posição do PC para ficar centralizado
      const box = new THREE.Box3().setFromObject(pcRealista);
      const center = box.getCenter(new THREE.Vector3());
      pcRealista.position.sub(center);
      
      // Escala o PC para caber na tela
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const escala = 6 / maxDim; // Ajuste a escala se necessário
      pcRealista.scale.set(escala, escala, escala);

      scene.add(pcRealista);
    }, undefined, (error) => {
      console.error("Erro ao carregar o PC realista:", error);
      alert("Erro ao carregar o PC. Verifique se o arquivo free_gaming_pc.glb está na pasta assets/models/");
    });
  }

  // 4. ANIMAÇÃO DE ENTRAR E SAIR DO PC
  function enterPC() {
    if(isInsidePC || !pcRealista) return;
    isInsidePC = true;
    
    // Esconde a sala e mostra o PC
    roomModel.visible = false;
    pcRealista.visible = true;
    
    // Posiciona a câmera para ver o PC de perto
    controls.target.set(0, 0, 0);
    camera.position.set(0, 2, 10); 
    controls.update();
    
    document.getElementById('btnSairPC').style.display = 'block';
  }

  function exitPC() {
    if(!isInsidePC) return;
    isInsidePC = false;
    
    // Mostra a sala e esconde o PC
    roomModel.visible = true;
    pcRealista.visible = false;
    
    // Reseta a câmera
    const box = new THREE.Box3().setFromObject(roomModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0,0,0);
    controls.update();
    
    document.getElementById('btnSairPC').style.display = 'none';
  }
  window.exitPC = exitPC;

  // 5. CLIQUE
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
      
      if (!isInsidePC) {
        const hits = raycaster.intersectObjects(clickablePCs, true);
        if (hits.length > 0) enterPC();
      }
    });
  }

  // 6. LOOP DE ANIMAÇÃO (Gira o PC lentamente)
  function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled) controls.update();
    
    if (isInsidePC && pcRealista && pcRealista.visible) {
        pcRealista.rotation.y += 0.005; // Rotação do PC
    }
    
    renderer.render(scene, camera);
  }
  animate();
});