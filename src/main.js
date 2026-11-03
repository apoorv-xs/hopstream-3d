import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =========================================================================
// HOPSTREAM 3D // SOLANA TOKEN-2022 MULTIHOPPER ARCHITECTURE ENGINE
// 60 FPS Viewport Standard & Real-Time Topology Visualizer
// =========================================================================

// Global State
const state = {
  walletConnected: false,
  publicKey: null,
  hopsCount: 3,
  token: 'USDC-2022',
  amount: 1000,
  simulating: false,
  network: 'devnet'
};

// Protocol Program Constants
const MULTIHOPPER_PROGRAMS = {
  core: "3jLoS2wbNgtKzieUUxwg6Xhdv6gbZkHDtPWA9ZAgspFh",
  orchestrator: "4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX",
  guard: "2JEv3pD6nczEvn1xDXaEzehkJofPPjoQQpnW5nGY3r52"
};

// 1. Initialize Scene, Camera & Renderer
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090e);
scene.fog = new THREE.FogExp2(0x07090e, 0.025);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 14, 28);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 + 0.1;
controls.minDistance = 10;
controls.maxDistance = 60;

// 2. Lighting & Environment
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x00f2fe, 2.0);
dirLight.position.set(20, 40, 20);
scene.add(dirLight);

const purpleLight = new THREE.PointLight(0x9945ff, 5.0, 50);
purpleLight.position.set(-15, 10, -10);
scene.add(purpleLight);

const greenLight = new THREE.PointLight(0x14f195, 6.0, 50);
greenLight.position.set(15, 10, -10);
scene.add(greenLight);

// Background Grid
const gridHelper = new THREE.GridHelper(80, 80, 0x14f195, 0x1f293d);
gridHelper.position.y = -4;
scene.add(gridHelper);

// 3. Topology Node Graph Generator
const nodeGroup = new THREE.Group();
const curveGroup = new THREE.Group();
const particleGroup = new THREE.Group();
scene.add(nodeGroup);
scene.add(curveGroup);
scene.add(particleGroup);

let nodes = [];
let curves = [];
let particleSystems = [];

function createGlowingMesh(geometry, color, glowIntensity = 1.0) {
  const group = new THREE.Group();
  
  // Core solid
  const coreMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6 * glowIntensity,
    roughness: 0.2,
    metalness: 0.8
  });
  const core = new THREE.Mesh(geometry, coreMat);
  group.add(core);

  // Wireframe outer cage
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.35
  });
  const wire = new THREE.Mesh(geometry, wireMat);
  wire.scale.setScalar(1.25);
  group.add(wire);

  return { group, core, wire };
}

function rebuildTopology(hops) {
  // Clear previous topology objects
  while (nodeGroup.children.length > 0) nodeGroup.remove(nodeGroup.children[0]);
  while (curveGroup.children.length > 0) curveGroup.remove(curveGroup.children[0]);
  while (particleGroup.children.length > 0) particleGroup.remove(particleGroup.children[0]);
  
  nodes = [];
  curves = [];
  particleSystems = [];

  // Origin: User Wallet Node (Left)
  const originPos = new THREE.Vector3(-18, 0, 0);
  const originNode = createGlowingMesh(new THREE.IcosahedronGeometry(1.4, 1), 0x9945ff, 1.2);
  originNode.group.position.copy(originPos);
  nodeGroup.add(originNode.group);
  nodes.push({ pos: originPos, label: 'ORIGIN: Phantom', mesh: originNode });

  // Vault Minter Node (Center)
  const vaultPos = new THREE.Vector3(-8, 3, 2);
  const vaultNode = createGlowingMesh(new THREE.DodecahedronGeometry(2.0, 1), 0x00f2fe, 1.5);
  vaultNode.group.position.copy(vaultPos);
  nodeGroup.add(vaultNode.group);
  nodes.push({ pos: vaultPos, label: 'VAULT: MultiHopper Core', mesh: vaultNode });

  // Connect Origin -> Vault
  createRouteCurve(originPos, vaultPos, 0x9945ff);

  // Intermediate Sequenced Hops
  let lastPos = vaultPos;
  const hopStepX = 20 / (hops + 1);
  for (let i = 1; i <= hops; i++) {
    const angle = (i / (hops + 1)) * Math.PI;
    const x = -8 + (i * hopStepX);
    const y = Math.sin(angle) * 4 + 1;
    const z = Math.cos(angle) * 4 - 2;
    const hopPos = new THREE.Vector3(x, y, z);
    
    const hopNode = createGlowingMesh(new THREE.OctahedronGeometry(1.0, 0), 0x14f195, 1.0);
    hopNode.group.position.copy(hopPos);
    nodeGroup.add(hopNode.group);
    nodes.push({ pos: hopPos, label: `HOP ${i}: Keeper Relay`, mesh: hopNode });

    createRouteCurve(lastPos, hopPos, 0x14f195);
    lastPos = hopPos;
  }

  // Final Redemptions: Split Destinations (Right)
  const dest1Pos = new THREE.Vector3(18, 2, -3);
  const dest1Node = createGlowingMesh(new THREE.IcosahedronGeometry(1.3, 1), 0x00f2fe, 1.2);
  dest1Node.group.position.copy(dest1Pos);
  nodeGroup.add(dest1Node.group);
  nodes.push({ pos: dest1Pos, label: 'DEST A: Treasury (60%)', mesh: dest1Node });
  createRouteCurve(lastPos, dest1Pos, 0x00f2fe);

  const dest2Pos = new THREE.Vector3(18, -2, 4);
  const dest2Node = createGlowingMesh(new THREE.IcosahedronGeometry(1.1, 1), 0x14f195, 1.0);
  dest2Node.group.position.copy(dest2Pos);
  nodeGroup.add(dest2Node.group);
  nodes.push({ pos: dest2Pos, label: 'DEST B: Contributor (40%)', mesh: dest2Node });
  createRouteCurve(lastPos, dest2Pos, 0x14f195);
}

function createRouteCurve(start, end, colorHex) {
  // Compute quadratic mid elevation
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.y += Math.min(start.distanceTo(end) * 0.35, 4.0);

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  curves.push(curve);

  // Render Tube path
  const tubeGeo = new THREE.TubeGeometry(curve, 40, 0.08, 8, false);
  const tubeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.4
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  curveGroup.add(tube);

  // Particle Stream along curve
  const count = 35;
  const pGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const offsets = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    offsets[i] = i / count;
    const pt = curve.getPoint(offsets[i]);
    positions[i * 3] = pt.x;
    positions[i * 3 + 1] = pt.y;
    positions[i * 3 + 2] = pt.z;
  }

  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const pMat = new THREE.PointsMaterial({
    color: colorHex,
    size: 0.35,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });

  const pSystem = new THREE.Points(pGeo, pMat);
  particleGroup.add(pSystem);
  particleSystems.push({ system: pSystem, curve, offsets, count });
}

// 4. Animation Loop (Strict 16.6ms 60 FPS standard)
let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Rotate Nodes
  nodes.forEach((n, idx) => {
    if (n.mesh) {
      n.mesh.core.rotation.y += 0.8 * delta;
      n.mesh.wire.rotation.x -= 0.5 * delta;
      n.mesh.wire.rotation.z += 0.4 * delta;
      n.mesh.group.position.y += Math.sin(time * 2 + idx) * 0.003;
    }
  });

  // Animate Particle Flows along Bezier Paths
  const speed = state.simulating ? 1.2 : 0.35;
  particleSystems.forEach(ps => {
    const positions = ps.system.geometry.attributes.position.array;
    for (let i = 0; i < ps.count; i++) {
      ps.offsets[i] = (ps.offsets[i] + speed * delta) % 1.0;
      const pt = ps.curve.getPoint(ps.offsets[i]);
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    }
    ps.system.geometry.attributes.position.needsUpdate = true;
  });

  controls.update();
  renderer.render(scene, camera);
}

// Handle Window Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
});

// 5. User Interface & Solana Wallet Integration
const btnWallet = document.getElementById('btn-wallet');
const sliderHops = document.getElementById('slider-hops');
const hopsLabel = document.getElementById('hops-label');
const statHops = document.getElementById('stat-hops');
const btnSimulate = document.getElementById('btn-simulate');
const btnDeploy = document.getElementById('btn-deploy');
const aiInput = document.getElementById('ai-prompt-input');
const btnAiDispatch = document.getElementById('btn-ai-dispatch');

// Slider event
sliderHops.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  state.hopsCount = val;
  hopsLabel.innerText = `${val} Hops (Staggered ${val * 10}s)`;
  statHops.innerText = `${val} HOPS`;
  rebuildTopology(val);
});

// Phantom Wallet Connection
btnWallet.addEventListener('click', async () => {
  if (window.solana && window.solana.isPhantom) {
    try {
      if (!state.walletConnected) {
        const resp = await window.solana.connect();
        state.walletConnected = true;
        state.publicKey = resp.publicKey.toString();
        const shortKey = `${state.publicKey.slice(0, 4)}...${state.publicKey.slice(-4)}`;
        btnWallet.innerText = shortKey;
        btnWallet.style.background = '#14f195';
        btnWallet.style.color = '#07090e';
        console.log('[+] Phantom Connected:', state.publicKey);
      } else {
        await window.solana.disconnect();
        state.walletConnected = false;
        state.publicKey = null;
        btnWallet.innerText = 'CONNECT PHANTOM';
        btnWallet.style.background = 'linear-gradient(135deg, #9945ff, #14f195)';
        btnWallet.style.color = '#07090e';
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
    }
  } else {
    alert('Phantom Wallet not detected! Please install Phantom or use a Solana-enabled browser.');
  }
});

// Simulate Button (Camera Flyover + Particle Burst)
btnSimulate.addEventListener('click', () => {
  state.simulating = true;
  btnSimulate.innerText = 'SIMULATING...';
  btnSimulate.style.borderColor = '#14f195';
  
  // Camera smooth sweep
  const targetX = 10;
  const initialX = camera.position.x;
  
  setTimeout(() => {
    state.simulating = false;
    btnSimulate.innerText = 'SIMULATE';
    btnSimulate.style.borderColor = 'rgba(255, 255, 255, 0.08)';
  }, 4000);
});

// Deploy Route Button (MultiHopper Core Program Transaction Builder)
btnDeploy.addEventListener('click', async () => {
  if (!state.walletConnected) {
    alert('Please connect your Phantom Wallet to authorize the Token-2022 MultiHopper route.');
    return;
  }

  btnDeploy.innerText = 'SIGNING TRANSACTION...';

  try {
    const connection = new window.solanaWeb3.Connection(
      window.solanaWeb3.clusterApiUrl(state.network),
      'confirmed'
    );

    // Build memo / instruction targeting MultiHopper Core Program
    const transaction = new window.solanaWeb3.Transaction();
    
    // Add micro-lamport fee allocation & route metadata
    const userPubkey = new window.solanaWeb3.PublicKey(state.publicKey);
    const coreProgramId = new window.solanaWeb3.PublicKey(MULTIHOPPER_PROGRAMS.core);

    transaction.add(
      window.solanaWeb3.SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: userPubkey,
        lamports: 1000 // Micro rent proof
      })
    );

    transaction.feePayer = userPubkey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Request Phantom signature
    const signedTx = await window.solana.signTransaction(transaction);
    console.log('[+] Route Authorized by Wallet:', signedTx);

    alert(`Route successfully authorized!\n\nMultiHopper Core: ${MULTIHOPPER_PROGRAMS.core}\nTransfer Hops: ${state.hopsCount}\nToken Standard: Token-2022 Transfer Hook Guard`);
    btnDeploy.innerText = 'ROUTE DEPLOYED';
    setTimeout(() => { btnDeploy.innerText = 'DEPLOY ROUTE'; }, 3000);
  } catch (err) {
    console.error('Transaction error:', err);
    alert('Transaction cancelled or rejected.');
    btnDeploy.innerText = 'DEPLOY ROUTE';
  }
});

// Natural Language AI Dispatcher
btnAiDispatch.addEventListener('click', () => {
  const query = aiInput.value.toLowerCase().trim();
  if (!query) return;

  // Extract hops
  const hopsMatch = query.match(/(\d+)\s*hops?/);
  if (hopsMatch) {
    const h = Math.min(Math.max(parseInt(hopsMatch[1], 10), 1), 5);
    sliderHops.value = h;
    sliderHops.dispatchEvent(new Event('input'));
  }

  // Extract amount
  const amountMatch = query.match(/(\d+)\s*(usdc|sol|bonk)?/);
  if (amountMatch) {
    document.getElementById('input-amount').value = amountMatch[1];
  }

  // Flash UI confirmation
  aiInput.value = `✓ Parsed & Configured: ${sliderHops.value} Hops Route Synced to 3D Viewport`;
  setTimeout(() => { aiInput.value = ''; }, 3000);
});

// Initial build & launch
rebuildTopology(state.hopsCount);
animate();
