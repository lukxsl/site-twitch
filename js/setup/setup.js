/* ============================================================
   SETUP — CENA 3D + MODO CLOSE-UP NO PC INTERATIVO
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  // --- 1. CONFIGURAÇÃO BÁSICA E RESIZE ---
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

  // Luzes da cena
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  // Variáveis de estado
  let roomModel = null;
  let pcCloseupGroup = null;
  let isInsidePC = false;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickablePCs = [];
  const clickableComponents = [];

  // --- 2. CARREGAR A SALA ---
  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  loader.load('/assets/models/room.glb', (gltf) => {
    roomModel = gltf.scene;
    
    // Centraliza
    const box = new THREE.Box3().setFromObject(roomModel);
    const center = box.getCenter(new THREE.Vector3());
    roomModel.position.sub(center);
    scene.add(roomModel);

    // Caixa invisível no PC da sala
    const pcHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2), 
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 })
    );
    // Posicione a caixa em cima do gabinete da sua sala (ajuste os valores se precisar)
    pcHitbox.position.set(3.5, 1.5, -1.5); 
    pcHitbox.userData.isPC = true;
    scene.add(pcHitbox);
    clickablePCs.push(pcHitbox);

    // Posição inicial da câmera (vendo a sala)
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    
    controls.target.set(0, 0, 0);
    controls.update();
    
    // Criar o PC Close-up (invisível por enquanto)
    buildPCCloseup();
    
    setupInteractivity();
  });


  // --- 3. CONSTRUINDO O PC CLOSE-UP ---
  function buildPCCloseup() {
    pcCloseupGroup = new THREE.Group();
    pcCloseupGroup.visible = false; // Começa escondido
    scene.add(pcCloseupGroup);

    // Material do Gabinete (Vidro e Branco)
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.1, transmission: 1, transparent: true, opacity: 0.3 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.2, metalness: 0.1 });
    
    // O Vidro do Gabinete
    const caseGeo = new THREE.BoxGeometry(4, 4, 3);
    const caseMesh = new THREE.Mesh(caseGeo, glassMat);
    pcCloseupGroup.add(caseMesh);

    // A estrutura branca (Bordas)
    const edges = new THREE.EdgesGeometry(caseGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
    pcCloseupGroup.add(line);

    // A) PLACA DE VÍDEO (RTX)
    const gpuGroup = new THREE.Group();
    gpuGroup.position.set(0, -1, 0);
    gpuGroup.userData = { isComp: true, nome: 'RTX 3060 12GB Branca', linkKabum: 'rtx 3060 branca', linkAmazon: 'rtx 3060 white' };
    
    const gpuBody = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    gpuGroup.add(gpuBody);
    // Detalhe verde da Nvidia
    const gpuGreen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x76b900 }));
    gpuGreen.position.set(1, 0.45, 0);
    gpuGroup.add(gpuGreen);
    // Fans da GPU
    for(let i=0; i<3; i++) {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      fan.rotation.x = Math.PI / 2;
      fan.position.set(-1 + i, 0, 0.55);
      gpuGroup.add(fan);
    }
    pcCloseupGroup.add(gpuGroup);
    clickableComponents.push(gpuGroup);

    // B) WATER COOLER (Processador)
    const waterGroup = new THREE.Group();
    waterGroup.position.set(0, 1, 0);
    waterGroup.userData = { isComp: true, nome: 'Water Cooler Risemode Aura RGB', linkKabum: 'water cooler risemode aura', linkAmazon: 'water cooler risemode' };
    
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pump.rotation.x = Math.PI / 2;
    waterGroup.add(pump);
    // Anel RGB do water cooler
    const rgbRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 16, 32), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
    rgbRing.position.z = 0.25;
    waterGroup.add(rgbRing);
    pcCloseupGroup.add(waterGroup);
    clickableComponents.push(waterGroup);

    // C) MEMÓRIAS RAM
    const ramGroup = new THREE.Group();
    ramGroup.position.set(1.5, 0.5, 0);
    ramGroup.userData = { isComp: true, nome: '48GB RAM Corsair Vengeance RGB', linkKabum: 'memoria ram 48gb corsair', linkAmazon: 'memoria ram corsair 48gb' };
    
    for(let i=0; i<4; i++) {
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      stick.position.x = i * 0.15;
      ramGroup.add(stick);
      // RGB Topo da RAM
      const rgbTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.35), new THREE.MeshBasicMaterial({ color: 0xff6ec7 }));
      rgbTop.position.set(i * 0.15, 0.6, 0);
      ramGroup.add(rgbTop);
    }
    pcCloseupGroup.add(ramGroup);
    clickableComponents.push(ramGroup);
  }

  // --- 4. TRANSIÇÃO (ENTRAR E SAIR DO PC) ---
  function enterPC() {
    if(isInsidePC) return;
    isInsidePC = true;
    
    // Esconde a sala, mostra o PC
    roomModel.visible = false;
    pcCloseupGroup.visible = true;
    
    // Move a câmera para ver o PC de perto
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 8); // Distância para ver o gabinete todo
    controls.update();
    
    // Mostra o botão de voltar
    document.getElementById('btnSairPC').style.display = 'block';
  }

  function exitPC() {
    if(!isInsidePC) return;
    isInsidePC = false;
    
    // Mostra a sala, esconde o PC
    roomModel.visible = true;
    pcCloseupGroup.visible = false;
    
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

  // --- 5. INTERATIVIDADE (CLIQUE) ---
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
      
      // Se estiver na sala, testa o clique no PC
      if (!isInsidePC) {
        const hits = raycaster.intersectObjects(clickablePCs, true);
        if (hits.length > 0) enterPC();
      } 
      // Se estiver no PC, testa o clique nos componentes
      else {
        const hits = raycaster.intersectObjects(clickableComponents, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          // Sobe na hierarquia para achar o grupo com os dados
          while (obj && !obj.userData.isComp) obj = obj.parent;
          
          if (obj) {
            abrirModalComponente(obj.userData);
          }
        }
      }
    });
  }

  // --- 6. MODAL DE COMPONENTE ---
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

  // --- 7. LOOP ---
  function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled) controls.update();
    // Rotação suave no PC close-up
    if (isInsidePC && pcCloseupGroup.visible) {
        pcCloseupGroup.rotation.y += 0.002;
    }
    renderer.render(scene, camera);
  }
  animate();
});