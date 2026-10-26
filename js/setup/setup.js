/* ============================================================
   SETUP — MODO FÁCIL DE POSICIONAMENTO (USE AS SETAS DO TECLADO)
   ============================================================ */

const DEBUG_MODE = true; 

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0511);
  
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  let roomModel = null;
  let pcRealista = null;
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickableComponents = [];

  // Variáveis para controlar o PC com o teclado
  const pcPos = { x: 3.8, y: 1.8, z: -1.2 };
  const pcScale = 1.5; // Tamanho do PC

  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  // Carrega a Sala
  loader.load('/assets/models/room.glb', (gltf) => {
    roomModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(roomModel);
    const center = box.getCenter(new THREE.Vector3());
    roomModel.position.sub(center);
    scene.add(roomModel);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim * 1.2, maxDim * 0.8, maxDim * 1.5);
    controls.target.set(0, 0, 0);
    controls.update();
    
    carregarPCRealista();
    setupInteractivity();
    
    // Mostra as instruções na tela
    const inst = document.createElement('div');
    inst.style.cssText = 'position:absolute; top:10px; left:10px; color:white; background:rgba(0,0,0,0.7); padding:10px; border-radius:8px; font-family:sans-serif; z-index:100; font-size:12px;';
    inst.innerHTML = `
      <b>🛠️ MODO DE AJUSTE (Teclado)</b><br>
      X: Setas Esq/Dir | Y: Setas Cima/Baixo<br>
      Z: PgUp / PgDown | Tamanho: W / S<br>
      <span style="color:#a855f7">(Olhe o console do F12 para ver as coordenadas)</span>
    `;
    container.appendChild(inst);
  });

  function carregarPCRealista() {
    loader.load('/assets/models/free_gaming_pc.glb', (gltf) => {
      pcRealista = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(pcRealista);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      pcRealista.scale.set(pcScale/maxDim, pcScale/maxDim, pcScale/maxDim);
      pcRealista.position.set(pcPos.x, pcPos.y, pcPos.z);
      pcRealista.rotation.y = -Math.PI / 4; // Inclina um pouco para ver o vidro

      // --- Adesivos (Hitboxes) ---
      const criarHitbox = (nome, pos, tamanho, cor, dados) => {
        const hb = new THREE.Mesh(
          new THREE.BoxGeometry(tamanho.x, tamanho.y, tamanho.z),
          new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5 })
        );
        hb.position.set(pos.x, pos.y, pos.z);
        hb.userData = { isComp: true, ...dados };
        pcRealista.add(hb);
        clickableComponents.push(hb);
      };

      // Caixas menores e mais precisas (baseado na sua imagem)
      criarHitbox('GPU', { x: 0, y: -0.2, z: 0.2 }, { x: 1.2, y: 0.3, z: 0.8 }, 0x00ff00, { nome: 'Placa de Vídeo RX 9060 XT', linkKabum: 'rx 9060 xt', linkAmazon: 'rx 9060 xt' });
      criarHitbox('WaterCooler', { x: -0.4, y: 0.6, z: 0.1 }, { x: 0.6, y: 0.6, z: 0.6 }, 0x0000ff, { nome: 'Water Cooler Risemode', linkKabum: 'water cooler risemode', linkAmazon: 'water cooler risemode' });
      criarHitbox('RAM', { x: 0.3, y: 0.4, z: 0.1 }, { x: 0.3, y: 0.6, z: 0.6 }, 0xff00ff, { nome: '48GB de RAM', linkKabum: 'memoria ram 48gb', linkAmazon: 'memoria ram 48gb' });

      scene.add(pcRealista);
      
      // Cria a caixa de clique na sala (invisível para simular o clique no PC)
      const clickBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshBasicMaterial({visible: false}));
      clickBox.position.copy(pcRealista.position);
      clickBox.position.y += 0.5;
      clickBox.userData.isPC = true;
      scene.add(clickBox);
      
      // --- CONTROLE PELO TECLADO ---
      window.addEventListener('keydown', (e) => {
        let changed = false;
        // Move o PC inteiro
        if (e.key === 'ArrowLeft') { pcPos.x -= 0.1; changed = true; }
        if (e.key === 'ArrowRight') { pcPos.x += 0.1; changed = true; }
        if (e.key === 'ArrowUp') { pcPos.y += 0.1; changed = true; }
        if (e.key === 'ArrowDown') { pcPos.y -= 0.1; changed = true; }
        if (e.key === 'PageUp') { pcPos.z += 0.1; changed = true; }
        if (e.key === 'PageDown') { pcPos.z -= 0.1; changed = true; }

        if (changed && pcRealista) {
          pcRealista.position.set(pcPos.x, pcPos.y, pcPos.z);
          clickBox.position.copy(pcRealista.position);
          clickBox.position.y += 0.5;
          console.log(`Posição atual do PC -> X: ${pcPos.x.toFixed(2)}, Y: ${pcPos.y.toFixed(2)}, Z: ${pcPos.z.toFixed(2)}`);
        }
      });

    }, undefined, (error) => console.error(error));
  }

  // Interatividade (Clique)
  function setupInteractivity() {
    const el = renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      if ((e.clientX - down.x)**2 + (e.clientY - down.y)**2 > 36) return; 
      down = null;
      
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      // Se clicar no PC, foca nele
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && obj.parent !== scene) obj = obj.parent;
        
        if (obj.userData.isPC) {
          // Foca no PC
          controls.target.copy(pcRealista.position);
          camera.position.set(pcRealista.position.x + 2, pcRealista.position.y + 1, pcRealista.position.z + 2);
          controls.update();
        }
      }
      
      // Se clicar em uma peça com adesivo
      const hitsComp = raycaster.intersectObjects(clickableComponents, true);
      if (hitsComp.length > 0) {
         abrirModalComponente(hitsComp[0].object.userData);
      }
    });
  }

  function abrirModalComponente(dados) {
    const dlg = document.getElementById('pcModal');
    if(!dlg) return;
    document.getElementById('pcModalTitle').innerText = dados.nome;
    document.getElementById('pcModalBody').innerHTML = `
      <a href="https://www.kabum.com.br/busca/${encodeURIComponent(dados.linkKabum)}" target="_blank" class="btn" style="background:#ff6500; margin-bottom:10px;">🛒 KaBuM</a>
      <a href="https://www.amazon.com.br/s?k=${encodeURIComponent(dados.linkAmazon)}" target="_blank" class="btn" style="background:#ff9900; color:#000;">📦 Amazon</a>
    `;
    dlg.showModal();
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
});