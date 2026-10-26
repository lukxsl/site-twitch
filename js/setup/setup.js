/* ============================================================
   SETUP — DESIGN PREMIUM DO PC (SEM BLENDER)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  // --- 1. CONFIGURAÇÃO BÁSICA ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0511);
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
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
  controls.enablePan = false; // Não deixa a pessoa perder o PC de vista

  // Luzes Globais
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2);
  keyLight.position.set(5, 5, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1); // Luz azulada para dar clima gamer
  fillLight.position.set(-5, 2, 5);
  scene.add(fillLight);

  // Variáveis de estado
  let roomModel = null;
  let pcCloseupGroup = null;
  let isInsidePC = false;
  let isHoveringComp = false;
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
    const box = new THREE.Box3().setFromObject(roomModel);
    const center = box.getCenter(new THREE.Vector3());
    roomModel.position.sub(center);
    scene.add(roomModel);

    // Caixa invisível no PC da sala
    const pcHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2), 
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 })
    );
    pcHitbox.position.set(3.5, 1.5, -1.5); // Ajuste onde fica o PC na sua sala
    pcHitbox.userData.isPC = true;
    scene.add(pcHitbox);
    clickablePCs.push(pcHitbox);

    // Câmera inicial
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0, 0, 0);
    controls.update();
    
    buildPCCloseup(); // Cria o PC novo
    setupInteractivity();
  });

  // --- 3. CONSTRUINDO O PC (DESIGN PREMIUM) ---
  function buildPCCloseup() {
    pcCloseupGroup = new THREE.Group();
    pcCloseupGroup.visible = false;
    scene.add(pcCloseupGroup);

    // 1. O GABINETE BRANCO (A estrutura)
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.2, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    
    // Fundo e laterais do gabinete
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(4, 4.5, 0.1), whiteMat);
    backPanel.position.z = -1.5;
    pcCloseupGroup.add(backPanel);

    const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), whiteMat);
    bottomPanel.position.y = -2.25;
    pcCloseupGroup.add(bottomPanel);

    const topPanel = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 3), whiteMat);
    topPanel.position.y = 2.25;
    pcCloseupGroup.add(topPanel);

    // O VIDRO TEMPERADO (Frente)
    const glassMat = new THREE.MeshPhysicalMaterial({ 
      color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 1, 
      transparent: true, opacity: 0.15, ior: 1.5, thickness: 0.5 
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(4, 4.5, 0.05), glassMat);
    glass.position.z = 1.5;
    pcCloseupGroup.add(glass);

    // Luzes RGB dentro do gabinete
    const light1 = new THREE.PointLight(0xa855f7, 3, 10); // Roxo
    light1.position.set(0, 2, 0);
    pcCloseupGroup.add(light1);
    const light2 = new THREE.PointLight(0x7dd3fc, 2, 10); // Azul
    light2.position.set(0, -2, 0);
    pcCloseupGroup.add(light2);

    // 2. PLACA DE VÍDEO (RTX Branca)
    const gpuGroup = new THREE.Group();
    gpuGroup.position.set(0, -1.2, 0);
    gpuGroup.userData = { isComp: true, nome: 'RTX 3060 12GB Branca', linkKabum: 'rtx 3060 branca', linkAmazon: 'rtx 3060 white' };
    
    // Corpo da GPU
    const gpuBody = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 1.2), whiteMat);
    gpuGroup.add(gpuBody);
    // Detalhes prateados
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
    const gpuAccent = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 0.1), silverMat);
    gpuAccent.position.set(0, 0.5, 0.6);
    gpuGroup.add(gpuAccent);
    
    // Logo Nvidia verde brilhante
    const gpuGreen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.05), new THREE.MeshBasicMaterial({ color: 0x76b900 }));
    gpuGreen.position.set(1, 0.1, 0.63);
    gpuGroup.add(gpuGreen);

    // Fans da GPU (Fazendo elas parecerem reais)
    for(let i=0; i<3; i++) {
      const fanGroup = new THREE.Group();
      fanGroup.position.set(-1.1 + (i * 1.1), 0, 0.61);
      
      const fanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32), darkMat);
      fanBase.rotation.x = Math.PI / 2;
      fanGroup.add(fanBase);
      
      // Pás do cooler
      for(let j=0; j<9; j++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.02), silverMat);
        blade.rotation.z = (j / 9) * Math.PI * 2;
        blade.position.set(Math.cos(blade.rotation.z) * 0.17, Math.sin(blade.rotation.z) * 0.17, 0);
        fanGroup.add(blade);
      }
      gpuGroup.add(fanGroup);
    }
    pcCloseupGroup.add(gpuGroup);
    clickableComponents.push(gpuGroup);

    // 3. WATER COOLER
    const waterGroup = new THREE.Group();
    waterGroup.position.set(0, 1.2, 0);
    waterGroup.userData = { isComp: true, nome: 'Water Cooler Risemode Aura RGB', linkKabum: 'water cooler risemode aura', linkAmazon: 'water cooler risemode' };
    
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 32), whiteMat);
    pump.rotation.x = Math.PI / 2;
    waterGroup.add(pump);
    
    // Tela ou anel RGB do water cooler
    const rgbRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
    rgbRing.position.z = 0.26;
    waterGroup.add(rgbRing);
    
    const pumpGlass = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.1 }));
    pumpGlass.position.z = 0.25;
    waterGroup.add(pumpGlass);
    
    pcCloseupGroup.add(waterGroup);
    clickableComponents.push(waterGroup);

    // 4. MEMÓRIAS RAM
    const ramGroup = new THREE.Group();
    ramGroup.position.set(1.4, 0.8, 0);
    ramGroup.userData = { isComp: true, nome: '48GB RAM Corsair Vengeance RGB', linkKabum: 'memoria ram 48gb corsair', linkAmazon: 'memoria ram corsair 48gb' };
    
    for(let i=0; i<4; i++) {
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.5), darkMat);
      stick.position.x = i * 0.2;
      ramGroup.add(stick);
      // Brilho no topo da RAM
      const rgbTop = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.45), new THREE.MeshBasicMaterial({ color: 0xff6ec7 }));
      rgbTop.position.set(i * 0.2, 0.7, 0);
      ramGroup.add(rgbTop);
    }
    pcCloseupGroup.add(ramGroup);
    clickableComponents.push(ramGroup);
  }

  // --- 4. ENTRAR E SAIR DO PC (Câmera Cinemática) ---
  function enterPC() {
    if(isInsidePC) return;
    isInsidePC = true;
    
    roomModel.visible = false;
    pcCloseupGroup.visible = true;
    pcCloseupGroup.rotation.y = -0.5; // Começa de lado
    
    // Câmera focada no gabinete
    controls.target.set(0, 0, 0);
    camera.position.set(2, 1, 9);
    controls.update();
    
    document.getElementById('btnSairPC').style.display = 'block';
  }

  function exitPC() {
    if(!isInsidePC) return;
    isInsidePC = false;
    
    roomModel.visible = true;
    pcCloseupGroup.visible = false;
    
    const box = new THREE.Box3().setFromObject(roomModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0,0,0);
    controls.update();
    
    document.getElementById('btnSairPC').style.display = 'none';
  }
  window.exitPC = exitPC;

  // --- 5. INTERATIVIDADE E HOVER ---
  function setupInteractivity() {
    const el = renderer.domElement;
    let down = null;

    // Clique
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
      } else {
        const hits = raycaster.intersectObjects(clickableComponents, true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj && !obj.userData.isComp) obj = obj.parent;
          if (obj) abrirModalComponente(obj.userData);
        }
      }
    });

    // Hover (Passar o mouse)
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !isInsidePC) return;
      
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableComponents, true);
      
      if (hits.length > 0) {
        el.style.cursor = 'pointer';
        let obj = hits[0].object;
        while (obj && !obj.userData.isComp) obj = obj.parent;
        
        if (obj && !isHoveringComp) {
          isHoveringComp = true;
          // Efeito de brilho ao passar o mouse
          obj.children.forEach(child => {
            if(child.material && child.material.emissive) {
                child.material.emissive.setHex(0x333333);
            }
          });
        }
      } else {
        el.style.cursor = 'grab';
        if (isHoveringComp) {
          isHoveringComp = false;
          // Tira o brilho
          clickableComponents.forEach(group => {
            group.children.forEach(child => {
                if(child.material && child.material.emissive) {
                    child.material.emissive.setHex(0x000000);
                }
            });
          });
        }
      }
    });
  }

  // --- 6. MODAL ---
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

  // --- 7. LOOP DE ANIMAÇÃO ---
  function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled) controls.update();
    
    // Rotação automática lenta no PC (Cinemática)
    if (isInsidePC && pcCloseupGroup.visible && !controls.enabled) {
        // Isso roda só enquanto a pessoa não clicar pra girar com o mouse
    } else if (isInsidePC && pcCloseupGroup.visible) {
        pcCloseupGroup.rotation.y += 0.003;
    }
    
    renderer.render(scene, camera);
  }
  animate();
});