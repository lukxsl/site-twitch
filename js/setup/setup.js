/* ============================================================
   SETUP — PURO 3D (MODO FOCO TOTAL)
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('setup360Container');
  if (!container) return;

  // 1. Configuração Básica
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0511); // Fundo escuro do site

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.1; // Não deixa a câmera ir pra baixo do chão

  // 2. Iluminação (Luzes fortes para garantir que o modelo apareça)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // 3. Carregar o Modelo (Bruno Simon's Room)
  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/');
  loader.setDRACOLoader(dracoLoader);

  loader.load('/assets/models/room.glb', (gltf) => {
    const model = gltf.scene;
    
    // Centraliza o modelo no mundo
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x += (model.position.x - center.x);
    model.position.y += (model.position.y - center.y);
    model.position.z += (model.position.z - center.z);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Se o modelo estiver muito escuro, força as texturas a reagirem à luz
        if (child.material) {
           child.material.envMapIntensity = 1;
        }
      }
    });

    scene.add(model);

    // 4. Auto-Frame: Ajusta a câmera pro tamanho exato do modelo
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.2;

    camera.position.set(distance * 0.8, distance * 0.5, distance);
    camera.lookAt(0, 0, 0);
    
    controls.target.set(0, 0, 0);
    controls.update();

  }, undefined, (error) => {
    console.error('Erro ao carregar o modelo:', error);
    container.innerHTML = '<div style="color:white; text-align:center; padding: 50px;">Erro ao carregar o arquivo 3D.<br>Verifique se o room.glb está na pasta assets/models/</div>';
  });

  // 5. Loop de Renderização
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Ajustar tamanho da tela
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
});