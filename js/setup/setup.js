/* ============================================================
   SETUP — ARRASTAR E SOLTAR (DRAG & DROP)
   ============================================================ */

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
  let dragControls = null;

  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  // 1. Carrega a Sala
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
    
    // 2. Carrega o PC e ativa o Arrastar
    carregarPCRealista();
  });

  function carregarPCRealista() {
    loader.load('/assets/models/free_gaming_pc.glb', (gltf) => {
      pcRealista = gltf.scene;
      
      // Ajusta o tamanho
      const box = new THREE.Box3().setFromObject(pcRealista);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      pcRealista.scale.set(1.2/maxDim, 1.2/maxDim, 1.2/maxDim); // Ajuste o tamanho aqui se precisar
      
      // Posição inicial (ele vai nascer no meio, vc arrasta ele pra mesa)
      pcRealista.position.set(0, 0, 0); 
      
      scene.add(pcRealista);

      // Ativa o controle de arrastar
      configurarArrastar();

    }, undefined, (error) => console.error(error));
  }

  function configurarArrastar() {
    // Cria o controle de arrastar do Three.js
    dragControls = new THREE.DragControls([pcRealista], camera, renderer.domElement);
    
    // Quando começar a arrastar, desliga a rotação da câmera
    dragControls.addEventListener('dragstart', function () {
      controls.enabled = false;
      pcRealista.rotation.y = 0; // Alinha o PC para frente quando você pegar ele
    });

    // Quando soltar o mouse, liga a rotação da câmera de novo e mostra a posição
    dragControls.addEventListener('dragend', function () {
      controls.enabled = true;
      console.log(`📍 POSIÇÃO FINAL DO PC: X: ${pcRealista.position.x.toFixed(2)}, Y: ${pcRealista.position.y.toFixed(2)}, Z: ${pcRealista.position.z.toFixed(2)}`);
      
      // Dica: Aqui a gente pode salvar a posição no navegador pra ele lembrar
      localStorage.setItem('pcX', pcRealista.position.x);
      localStorage.setItem('pcY', pcRealista.position.y);
      localStorage.setItem('pcZ', pcRealista.position.z);
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
  }
  animate();
});