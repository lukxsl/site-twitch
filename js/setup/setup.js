/* ============================================================
   SETUP — CENA 3D COM PC REALISTA E INTERATIVO
   ============================================================ */

// Mude para false quando terminar de alinhar as caixas!
const DEBUG_MODE = true; 

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0511);
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

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
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  let roomModel = null;
  let pcRealista = null;
  let isInsidePC = false;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickablePCs = [];
  const clickableComponents = []; // Array para as peças do PC

  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  // --- CARREGA A SALA ---
  loader.load('/assets/models/room.glb', (gltf) => {
    roomModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(roomModel);
    const center = box.getCenter(new THREE.Vector3());
    roomModel.position.sub(center);
    scene.add(roomModel);

    const pcHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2), 
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 })
    );
    pcHitbox.position.set(3.5, 1.5, -1.5); 
    pcHitbox.userData.isPC = true;
    scene.add(pcHitbox);
    clickablePCs.push(pcHitbox);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0, 0, 0);
    controls.update();
    
    carregarPCRealista();
    setupInteractivity();
  });

  // --- CARREGA O PC E CRIA AS CAIXAS DAS PEÇAS ---
  function carregarPCRealista() {
    loader.load('/assets/models/free_gaming_pc.glb', (gltf) => {
      pcRealista = gltf.scene;
      pcRealista.visible = false; 
      
      const box = new THREE.Box3().setFromObject(pcRealista);
      const center = box.getCenter(new THREE.Vector3());
      pcRealista.position.sub(center);
      
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const escala = 6 / maxDim; 
      pcRealista.scale.set(escala, escala, escala);

      // ==========================================
      // CRIAÇÃO DAS HITBOXES (Caixas das Peças)
      // ==========================================
      const criarHitbox = (nome, pos, tamanho, cor, dados) => {
        const hb = new THREE.Mesh(
          new THREE.BoxGeometry(tamanho.x, tamanho.y, tamanho.z),
          new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: DEBUG_MODE ? 0.5 : 0 })
        );
        hb.position.set(pos.x, pos.y, pos.z);
        hb.userData = { isComp: true, ...dados };
        
        // Adiciona a hitbox como filha do PC para ela girar junto
        pcRealista.add(hb);
        clickableComponents.push(hb);
      };

      // Ajuste as posições (X, Y, Z) e os tamanhos abaixo:
      // A Placa de Vídeo geralmente fica na horizontal, no meio/baixo.
      criarHitbox('GPU', { x: 0, y: -0.5, z: 0 }, { x: 4, y: 1, z: 1.5 }, 0x00ff00, { 
        nome: 'Placa de Vídeo RX 9060 XT', 
        linkKabum: 'rx 9060 xt', 
        linkAmazon: 'rx 9060 xt' 
      });

      // O Water Cooler fica no topo, em cima do processador.
      criarHitbox('WaterCooler', { x: -1, y: 2, z: 0 }, { x: 2, y: 2, z: 2 }, 0x0000ff, { 
        nome: 'Water Cooler Risemode Aura', 
        linkKabum: 'water cooler risemode', 
        linkAmazon: 'water cooler risemode' 
      });

      // As RAMs ficam ao lado do processador.
      criarHitbox('RAM', { x: 1.5, y: 1, z: 0 }, { x: 1, y: 2, z: 2 }, 0xff00ff, { 
        nome: '48GB de RAM DDR4', 
        linkKabum: 'memoria ram 48gb', 
        linkAmazon: 'memoria ram 48gb' 
      });

      scene.add(pcRealista);
    }, undefined, (error) => {
      console.error("Erro ao carregar o PC:", error);
    });
  }

  // --- ENTRAR E SAIR ---
  function enterPC() {
    if(isInsidePC || !pcRealista) return;
    isInsidePC = true;
    roomModel.visible = false;
    pcRealista.visible = true;
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 12); // Câmera de frente para o PC
    controls.update();
    document.getElementById('btnSairPC').style.display = 'block';
  }

  function exitPC() {
    if(!isInsidePC) return;
    isInsidePC = false;
    roomModel.visible = true;
    pcRealista.visible = false;
    const box = new THREE.Box3().setFromObject(roomModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0,0,0);
    controls.update();
    document.getElementById('btnSairPC').style.display = 'none';
  }
  window.exitPC = exitPC;

  // --- CLIQUE E MODAL ---
  function setupInteractivity() {
    const el = renderer.domElement;
    let down = null;

    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 36) return; // Arrastou o mouse, ignora
      down = null;
      
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      if (!isInsidePC) {
        // Clicou na caixa vermelha da sala
        const hits = raycaster.intersectObjects(clickablePCs, true);
        if (hits.length > 0) enterPC();
      } else {
        // Clicou nas caixas das peças dentro do PC
        const hits = raycaster.intersectObjects(clickableComponents, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          abrirModalComponente(obj.userData);
        }
      }
    });
  }

  function abrirModalComponente(dados) {
    const dlg = document.getElementById('pcModal');
    if(!dlg) return;
    const qKabum = encodeURIComponent(dados.linkKabum);
    const qAmazon = encodeURIComponent(dados.linkAmazon);

    document.getElementById('pcModalTitle').innerText = dados.nome;
    document.getElementById('pcModalBody').innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <p>Confira as especificações e encontre o melhor preço:</p>
        <a href="https://www.kabum.com.br/busca/${qKabum}" target="_blank" rel="noopener" class="btn" style="background: #ff6500;">🛒 Buscar na KaBuM</a>
        <a href="https://www.amazon.com.br/s?k=${qAmazon}" target="_blank" rel="noopener" class="btn" style="background: #ff9900; color: #000;">📦 Buscar na Amazon</a>
      </div>
    `;
    dlg.showModal();
  }

  // --- LOOP ---
  function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled) controls.update();
    
    // Gira o PC
    if (isInsidePC && pcRealista && pcRealista.visible) {
        pcRealista.rotation.y += 0.003; 
    }
    
    renderer.render(scene, camera);
  }
  animate();
});