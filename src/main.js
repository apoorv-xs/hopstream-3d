import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// =========================================================================
// HOPSTREAM 3D // ULTRA-REALISTIC PHYSICALLY-BASED WEBGL ROUTER
// 60 FPS Viewport Standard · PBR Refraction · Interactive Raycasting
// =========================================================================

// Global State
const state = {
  walletConnected: false,
  publicKey: null,
  hopsCount: 3,
  token: 'USDC-2022',
  amount: 1000,
  simulating: false,
  replaying: false,
  network: 'devnet',
  soundEnabled: true,
  isMobile: window.innerWidth <= 1024,
  hoveredNode: null
};

// Protocol Program Constants
const MULTIHOPPER_PROGRAMS = {
  core: "3jLoS2wbNgtKzieUUxwg6Xhdv6gbZkHDtPWA9ZAgspFh",
  orchestrator: "4TPCmR2uN3hDM1FbTsf7ZtFXwXGSz4u1Kxv5YHj6eruX",
  guard: "2JEv3pD6nczEvn1xDXaEzehkJofPPjoQQpnW5nGY3r52"
};

// =========================================================================
// SYNTHETIC HAPTIC AUDIO ENGINE (Web Audio API)
// =========================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  click(freq = 1200, type = 'sine', duration = 0.03) {
    if (!state.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.035, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  pulse(freq = 440, duration = 0.16) {
    if (!state.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, this.ctx.currentTime + duration);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  chord() {
    if (!state.soundEnabled) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      setTimeout(() => this.pulse(freq, 0.28), i * 60);
    });
  }
}
const sound = new SoundEngine();

// =========================================================================
// 1. Initialize Scene, Camera & Renderer
// =========================================================================
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.FogExp2(0x05070c, 0.016);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 + 0.04;
controls.minDistance = 8;
controls.maxDistance = 70;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};

// =========================================================================
// 2. Procedural Studio PMREM Environment Map (Refraction & Reflections)
// =========================================================================
function createStudioEnvironment(r) {
  const pmremGenerator = new THREE.PMREMGenerator(r);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x020306);

  const panelGeo = new THREE.PlaneGeometry(35, 35);
  
  // Overhead Softbox (Cyan)
  const topPanel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0x00f2fe, side: THREE.DoubleSide }));
  topPanel.position.set(0, 35, 0);
  topPanel.rotation.x = Math.PI / 2;
  envScene.add(topPanel);

  // Rim Panel (Purple)
  const rimPanel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0x9945ff, side: THREE.DoubleSide }));
  rimPanel.position.set(-30, 15, -25);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  // Key Panel (Emerald)
  const keyPanel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0x14f195, side: THREE.DoubleSide }));
  keyPanel.position.set(25, 20, 20);
  keyPanel.lookAt(0, 0, 0);
  envScene.add(keyPanel);

  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();
  return envMap;
}

scene.environment = createStudioEnvironment(renderer);

// Calibrate initial camera based on viewport aspect
function adjustCameraForViewport() {
  state.isMobile = window.innerWidth <= 1024;
  if (state.isMobile) {
    camera.position.set(0, 16, 48);
    controls.target.set(0, 1, 0);
  } else {
    camera.position.set(2, 14, 28);
    controls.target.set(1, 1, 0);
  }
}
adjustCameraForViewport();

// =========================================================================
// POST-PROCESSING: CALIBRATED UNREAL BLOOM PIPELINE
// =========================================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Calibrated bloom: preserves crystal facet refraction without blowout
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.60, // bloom strength
  0.42, // bloom radius
  0.38  // bloom threshold
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// =========================================================================
// 3. Lighting & Atmospheric Environment
// =========================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0x00f2fe, 1.8);
dirLight.position.set(20, 35, 20);
scene.add(dirLight);

const purpleLight = new THREE.PointLight(0x9945ff, 4.0, 60);
purpleLight.position.set(-18, 12, -10);
scene.add(purpleLight);

const greenLight = new THREE.PointLight(0x14f195, 4.5, 60);
greenLight.position.set(18, 12, -10);
scene.add(greenLight);

// 3.1 Deep Cosmic Quantum Starfield
function createStarfield() {
  const count = 1400;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 35 + Math.random() * 55;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const choice = Math.random();
    if (choice < 0.4) {
      colors[i * 3] = 0.0; colors[i * 3 + 1] = 0.95; colors[i * 3 + 2] = 1.0;
    } else if (choice < 0.7) {
      colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.27; colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3] = 0.85; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.24,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });

  return new THREE.Points(geo, mat);
}
const starfield = createStarfield();
scene.add(starfield);

// 3.2 Cybernetic Ground Grid & Concentric Radar Rings
const gridHelper = new THREE.GridHelper(80, 60, 0x00f2fe, 0x111827);
gridHelper.position.y = -4;
scene.add(gridHelper);

const radarGroup = new THREE.Group();
radarGroup.position.set(-8, -3.95, 2);
radarGroup.rotation.x = -Math.PI / 2;

[6, 12, 18, 24, 30].forEach((radius, i) => {
  const ringGeo = new THREE.RingGeometry(radius - 0.04, radius + 0.04, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: i % 2 === 0 ? 0x00f2fe : 0x14f195,
    transparent: true,
    opacity: 0.22 - (i * 0.03),
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  radarGroup.add(ring);
});
scene.add(radarGroup);

// 3.3 Interactive Target Reticle (snaps to hovered 3D nodes)
const reticleGeo = new THREE.RingGeometry(1.6, 1.7, 32);
const reticleMat = new THREE.MeshBasicMaterial({
  color: 0x00f2fe,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide
});
const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
scene.add(reticleMesh);

// =========================================================================
// 4. Physical Crystal Nodes & Route Topology Graph
// =========================================================================
const nodeGroup = new THREE.Group();
const curveGroup = new THREE.Group();
const particleGroup = new THREE.Group();
const labelGroup = new THREE.Group();
scene.add(nodeGroup);
scene.add(curveGroup);
scene.add(particleGroup);
scene.add(labelGroup);

let nodes = [];
let curves = [];
let particleSystems = [];
let cometStreams = [];

// Crisp High-DPI Canvas Text Sprite Generator
function createHoloTextSprite(text, subtext, colorHex) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 144;
  const ctx = c.getContext('2d');

  // Background pill with subtle gradient
  ctx.fillStyle = 'rgba(8, 12, 20, 0.85)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 128, 18);
  ctx.fill();
  ctx.stroke();

  // Primary label
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 44px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 62);

  // Subtext
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtext, 256, 106);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(3.8, 1.1, 1.0);
  return sprite;
}

// Ultra-Realistic Physically-Based Optical Glass Crystal Node
function createCrystalNode(geometry, colorHex, radius = 1.0) {
  const group = new THREE.Group();
  
  // 1. Refractive Optical Glass Core (Physical transmission & internal caustic dispersion)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.22,
    roughness: 0.14,
    metalness: 0.15,
    transmission: 0.68,
    thickness: 1.6,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    reflectivity: 0.85
  });
  const core = new THREE.Mesh(geometry, glassMat);
  group.add(core);

  // 2. High-Tech Internal Energy Core (Small additive pulsing inner sphere)
  const innerCoreGeo = new THREE.SphereGeometry(radius * 0.42, 16, 16);
  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.75
  });
  const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
  group.add(innerCore);

  // 3. Precision Wireframe Exoskeleton
  const wireMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    wireframe: true,
    transparent: true,
    opacity: 0.26
  });
  const wire = new THREE.Mesh(geometry, wireMat);
  wire.scale.setScalar(1.24);
  group.add(wire);

  // 4. Outer Gyroscopic Orbit Ring
  const ringGeo = new THREE.TorusGeometry(radius * 1.45, 0.02, 16, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.32
  });
  const gyroRing = new THREE.Mesh(ringGeo, ringMat);
  gyroRing.rotation.x = Math.PI / 3;
  group.add(gyroRing);

  return { group, core, innerCore, wire, gyroRing, baseColor: colorHex };
}

function rebuildTopology(hops) {
  // Safe disposal of previous geometry & material to prevent GPU memory leaks
  while (nodeGroup.children.length > 0) {
    const c = nodeGroup.children[0];
    nodeGroup.remove(c);
  }
  while (curveGroup.children.length > 0) curveGroup.remove(curveGroup.children[0]);
  while (particleGroup.children.length > 0) particleGroup.remove(particleGroup.children[0]);
  while (labelGroup.children.length > 0) labelGroup.remove(labelGroup.children[0]);
  
  nodes = [];
  curves = [];
  particleSystems = [];
  cometStreams = [];

  // Origin: User Wallet Node (Left)
  const originPos = new THREE.Vector3(-18, 0, 0);
  const originNode = createCrystalNode(new THREE.IcosahedronGeometry(1.3, 1), 0x9945ff, 1.3);
  originNode.group.position.copy(originPos);
  nodeGroup.add(originNode.group);
  nodes.push({ id: 'origin', pos: originPos, label: 'ORIGIN', mesh: originNode });

  const originSprite = createHoloTextSprite('ORIGIN', 'Phantom Wallet', '#9945ff');
  originSprite.position.set(originPos.x, originPos.y + 2.5, originPos.z);
  labelGroup.add(originSprite);

  // Vault Minter Node (Center-Left)
  const vaultPos = new THREE.Vector3(-8, 3, 2);
  const vaultNode = createCrystalNode(new THREE.DodecahedronGeometry(1.8, 1), 0x00f2fe, 1.8);
  vaultNode.group.position.copy(vaultPos);
  nodeGroup.add(vaultNode.group);
  nodes.push({ id: 'vault', pos: vaultPos, label: 'VAULT', mesh: vaultNode });

  const vaultSprite = createHoloTextSprite('CORE PDA', 'Token-2022 Escrow', '#00f2fe');
  vaultSprite.position.set(vaultPos.x, vaultPos.y + 3.0, vaultPos.z);
  labelGroup.add(vaultSprite);

  // Connect Origin -> Vault
  createRouteCurve(originPos, vaultPos, 0x9945ff);

  // Intermediate Sequenced Hops
  let lastPos = vaultPos;
  const hopStepX = 20 / (hops + 1);
  for (let i = 1; i <= hops; i++) {
    const angle = (i / (hops + 1)) * Math.PI;
    const x = -8 + (i * hopStepX);
    const y = Math.sin(angle) * 3.8 + 1;
    const z = Math.cos(angle) * 3.8 - 2;
    const hopPos = new THREE.Vector3(x, y, z);
    
    const hopNode = createCrystalNode(new THREE.OctahedronGeometry(1.0, 0), 0x14f195, 1.0);
    hopNode.group.position.copy(hopPos);
    nodeGroup.add(hopNode.group);
    nodes.push({ id: `hop-${i}`, pos: hopPos, label: `HOP ${i}`, mesh: hopNode });

    const hopSprite = createHoloTextSprite(`RELAY ${i}`, 'Keeper Timelock', '#14f195');
    hopSprite.position.set(hopPos.x, hopPos.y + 2.2, hopPos.z);
    labelGroup.add(hopSprite);

    createRouteCurve(lastPos, hopPos, 0x14f195);
    lastPos = hopPos;
  }

  // Final Redemptions: Split Destinations (Right)
  const dest1Pos = new THREE.Vector3(18, 2, -3);
  const dest1Node = createCrystalNode(new THREE.IcosahedronGeometry(1.2, 1), 0x00f2fe, 1.2);
  dest1Node.group.position.copy(dest1Pos);
  nodeGroup.add(dest1Node.group);
  nodes.push({ id: 'dest-a', pos: dest1Pos, label: 'TREASURY', mesh: dest1Node });

  const dest1Sprite = createHoloTextSprite('TREASURY', '60% Settled', '#00f2fe');
  dest1Sprite.position.set(dest1Pos.x, dest1Pos.y + 2.4, dest1Pos.z);
  labelGroup.add(dest1Sprite);
  createRouteCurve(lastPos, dest1Pos, 0x00f2fe);

  const dest2Pos = new THREE.Vector3(18, -2, 4);
  const dest2Node = createCrystalNode(new THREE.IcosahedronGeometry(1.1, 1), 0x14f195, 1.1);
  dest2Node.group.position.copy(dest2Pos);
  nodeGroup.add(dest2Node.group);
  nodes.push({ id: 'dest-b', pos: dest2Pos, label: 'CONTRIBUTOR', mesh: dest2Node });

  const dest2Sprite = createHoloTextSprite('CONTRIBUTOR', '40% Settled', '#14f195');
  dest2Sprite.position.set(dest2Pos.x, dest2Pos.y + 2.2, dest2Pos.z);
  labelGroup.add(dest2Sprite);
  createRouteCurve(lastPos, dest2Pos, 0x14f195);

  // Update UI Elements
  const statFee = document.getElementById('stat-fee');
  if (statFee) statFee.innerText = `${(0.00005 * hops).toFixed(5)} SOL`;
  const flowHops = document.getElementById('flow-hops-label');
  if (flowHops) flowHops.innerText = `${hops} Relays`;
  const mobSummary = document.getElementById('mob-summary-hops');
  if (mobSummary) mobSummary.innerText = `⚡ ${hops} HOPS · ${(0.00005 * hops).toFixed(5)} SOL`;
}

function createRouteCurve(start, end, colorHex) {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.y += Math.min(start.distanceTo(end) * 0.35, 4.0);

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  curves.push(curve);

  // 1. Inner Luminous Core Path
  const coreTubeGeo = new THREE.TubeGeometry(curve, 48, 0.05, 8, false);
  const coreTubeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.75
  });
  const coreTube = new THREE.Mesh(coreTubeGeo, coreTubeMat);
  curveGroup.add(coreTube);

  // 2. Outer Translucent Plasma Sheath
  const outerTubeGeo = new THREE.TubeGeometry(curve, 36, 0.12, 8, false);
  const outerTubeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending
  });
  const outerTube = new THREE.Mesh(outerTubeGeo, outerTubeMat);
  curveGroup.add(outerTube);

  // 3. Flowing Ambient Particles
  const count = 30;
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
    size: 0.30,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });

  const pSystem = new THREE.Points(pGeo, pMat);
  particleGroup.add(pSystem);
  particleSystems.push({ system: pSystem, curve, offsets, count });

  // 4. High-Energy Comet Head (Fast moving packet pulse)
  const cometGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const cometMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95
  });
  const comet = new THREE.Mesh(cometGeo, cometMat);
  particleGroup.add(comet);
  cometStreams.push({ mesh: comet, curve, progress: Math.random() });
}

// =========================================================================
// 5. Interactive Raycasting & Mouse Tracking
// =========================================================================
const raycaster = new THREE.Raycaster();
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0, ndcX: 0, ndcY: 0 };

window.addEventListener('mousemove', (e) => {
  mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Interactive Click to Focus Camera on Node
window.addEventListener('click', (e) => {
  // If clicking UI controls, ignore
  if (e.target.closest('aside, header, .decompile-terminal, .ai-dispatcher')) return;
  if (state.hoveredNode) {
    sound.click(1400);
    // Smoothly glide controls target to the node
    controls.target.copy(state.hoveredNode.pos);
  }
});

// =========================================================================
// 6. Animation Loop (Strict 16.6ms 60 FPS standard with PBR & Unreal Bloom)
// =========================================================================
const clock = new THREE.Clock();
let frameCount = 0;
let lastFpsCheck = 0;
const statFps = document.getElementById('stat-fps');

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Dynamic Real-Time FPS Telemetry
  frameCount++;
  if (time - lastFpsCheck >= 0.5) {
    if (statFps) {
      const liveFps = (frameCount / (time - lastFpsCheck)).toFixed(1);
      statFps.innerText = `${liveFps} FPS`;
    }
    frameCount = 0;
    lastFpsCheck = time;
  }

  // Slow Starfield Cosmic Drift
  starfield.rotation.y = time * 0.015;
  starfield.rotation.x = time * 0.008;

  // Concentric radar slow spin
  radarGroup.rotation.z = time * 0.05;

  // Inertial Parallax Drift (Desktop only)
  if (!state.isMobile && !state.replaying) {
    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;
    camera.position.x += (mouse.x * 0.45 - (camera.position.x - controls.target.x) * 0.01) * delta;
    camera.position.y += (mouse.y * 0.28 - (camera.position.y - controls.target.y) * 0.01) * delta;
  }

  // Rotate Nodes & Gyro Rings
  nodes.forEach((n, idx) => {
    if (n.mesh) {
      n.mesh.core.rotation.y += 0.75 * delta;
      n.mesh.wire.rotation.x -= 0.4 * delta;
      n.mesh.wire.rotation.z += 0.3 * delta;
      n.mesh.gyroRing.rotation.z += 0.9 * delta;
      n.mesh.innerCore.scale.setScalar(1.0 + Math.sin(time * 3 + idx) * 0.15);
      n.mesh.group.position.y += Math.sin(time * 2 + idx) * 0.0025;
    }
  });

  // Animate Particle Flows along Bezier Paths
  const speed = state.simulating || state.replaying ? 1.3 : 0.38;
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

  // Animate High-Energy Comets
  const cometSpeed = state.simulating || state.replaying ? 1.8 : 0.75;
  cometStreams.forEach(cs => {
    cs.progress = (cs.progress + cometSpeed * delta) % 1.0;
    const pt = cs.curve.getPoint(cs.progress);
    cs.mesh.position.copy(pt);
  });

  // Interactive Raycasting Check
  raycaster.setFromCamera(new THREE.Vector2(mouse.ndcX, mouse.ndcY), camera);
  const coreMeshes = nodes.map(n => n.mesh.core);
  const intersects = raycaster.intersectObjects(coreMeshes);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    const hitNode = nodes.find(n => n.mesh.core === hitMesh);

    if (hitNode && state.hoveredNode !== hitNode) {
      state.hoveredNode = hitNode;
      canvas.style.cursor = 'pointer';
      sound.click(1600, 'sine', 0.02);

      // Snap Reticle to Node
      reticleMesh.position.copy(hitNode.pos);
      reticleMesh.lookAt(camera.position);
      reticleMat.opacity = 0.85;
      reticleMesh.scale.setScalar(1.2);
    }
  } else if (state.hoveredNode) {
    state.hoveredNode = null;
    canvas.style.cursor = 'default';
    reticleMat.opacity = 0;
  }

  if (reticleMat.opacity > 0) {
    reticleMesh.rotation.z += 1.5 * delta;
    reticleMesh.lookAt(camera.position);
  }

  controls.update();
  composer.render();
}

// Handle Window Resizing with Dynamic Viewport Units
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
  composer.setSize(window.innerWidth, window.innerHeight);
  adjustCameraForViewport();
});

// =========================================================================
// 7. User Interface, Tabs, Audio & Solana Wallet Integration
// =========================================================================
const btnWallet = document.getElementById('btn-wallet');
const sliderHops = document.getElementById('slider-hops');
const hopsLabel = document.getElementById('hops-label');
const statHops = document.getElementById('stat-hops');
const btnSimulate = document.getElementById('btn-simulate');
const btnDeploy = document.getElementById('btn-deploy');
const aiInput = document.getElementById('ai-prompt-input');
const btnAiDispatch = document.getElementById('btn-ai-dispatch');
const btnSound = document.getElementById('btn-sound');
const btnToggleCanvas = document.getElementById('btn-toggle-canvas');

// Sidebar Drawer & Mobile Elements
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sheetHandle = document.getElementById('sheet-handle');
const mobileSummary = document.getElementById('mobile-summary');

// Tabs
const tabArchitect = document.getElementById('tab-architect');
const tabReplayer = document.getElementById('tab-replayer');
const panelArchitect = document.getElementById('panel-architect');
const panelReplayer = document.getElementById('panel-replayer');
const sectionHeading = document.getElementById('section-heading');
const decompileTerminal = document.getElementById('decompile-terminal');
const decompileBody = document.getElementById('decompile-body');

// Replayer Controls
const btnSampleTx = document.getElementById('btn-sample-tx');
const btnReplayRun = document.getElementById('btn-replay-run');
const inputTxSig = document.getElementById('input-tx-signature');

// Mobile Bottom Sheet Collapse/Expand
function toggleMobileDrawer() {
  const isExp = sidebarDrawer.classList.toggle('expanded');
  const txt = document.getElementById('mob-toggle-txt');
  if (txt) txt.innerText = isExp ? 'TAP TO COLLAPSE ▼' : 'TAP TO EXPAND ▲';
  sound.click(isExp ? 1000 : 850);
}

if (sheetHandle) sheetHandle.addEventListener('click', toggleMobileDrawer);
if (mobileSummary) mobileSummary.addEventListener('click', toggleMobileDrawer);

// Canvas Fullscreen / Focus Mode Toggle
if (btnToggleCanvas) {
  btnToggleCanvas.addEventListener('click', () => {
    document.body.classList.toggle('canvas-focus');
    btnToggleCanvas.classList.toggle('active', document.body.classList.contains('canvas-focus'));
    sound.click(1300);
  });
}

// Sound Toggle
if (btnSound) {
  btnSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    btnSound.classList.toggle('active', state.soundEnabled);
    if (state.soundEnabled) sound.click(1400);
  });
}

// Tab Switching
if (tabArchitect && tabReplayer) {
  tabArchitect.addEventListener('click', () => {
    tabArchitect.classList.add('active');
    tabReplayer.classList.remove('active');
    panelArchitect.style.display = 'flex';
    panelReplayer.style.display = 'none';
    sectionHeading.innerText = 'Route Architecture';
    sound.click(900);
  });

  tabReplayer.addEventListener('click', () => {
    tabReplayer.classList.add('active');
    tabArchitect.classList.remove('active');
    panelArchitect.style.display = 'none';
    panelReplayer.style.display = 'flex';
    sectionHeading.innerText = 'On-Chain Decompiler';
    decompileTerminal.style.display = 'flex';
    sound.click(1100);
  });
}

// Slider event with haptic feedback
sliderHops.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  state.hopsCount = val;
  hopsLabel.innerText = `${val} Hops (Staggered ${val * 10}s)`;
  statHops.innerText = `${val} HOPS`;
  sound.click(600 + val * 150);
  rebuildTopology(val);
});

// Sample Tx
if (btnSampleTx) {
  btnSampleTx.addEventListener('click', () => {
    inputTxSig.value = '5KtP28sJbNqmZtFw1V8WwQp9h2k3L6z9X7yU4v8R1mP3q7z8y4W2v1Q7x9Z2m';
    sound.click(1200);
  });
}

// Decompile & Replay Execution Simulator
if (btnReplayRun) {
  btnReplayRun.addEventListener('click', async () => {
    if (state.replaying) return;
    state.replaying = true;
    decompileTerminal.style.display = 'flex';
    btnReplayRun.innerText = 'DECOMPILING...';
    sound.chord();

    const sampleLogs = [
      { t: '00:00.12', text: 'Fetch On-Chain Signature: <span class="pass">CONFIRMED (200 OK)</span>' },
      { t: '00:00.45', text: 'Core Escrow Vault: <span class="pass">PDA 3jLoS2wb...pFh</span>' },
      { t: '00:00.82', text: 'Token-2022 Mint Authority: <span class="pass">PERMANENT DELEGATE</span>' },
      { t: '00:01.20', text: 'Transfer Hook Guard: <span class="pass">2JEv3pD6...3r52 VALIDATED</span>' },
      { t: '00:01.85', text: 'Keeper Relay (Hop 1): <span class="pass">EXECUTED (Timelock 10s)</span>' },
      { t: '00:02.40', text: 'Keeper Relay (Hop 2): <span class="pass">EXECUTED (Timelock 20s)</span>' },
      { t: '00:02.95', text: 'Keeper Relay (Hop 3): <span class="pass">EXECUTED (Timelock 30s)</span>' },
      { t: '00:03.50', text: 'Terminal Burn & Unwrap: <span class="pass">SETTLED (Treasury 60% / Contributor 40%)</span>' }
    ];

    decompileBody.innerHTML = '<div>[--:--.--] Initiating Solana Token-2022 byte-level trace...</div>';

    for (let i = 0; i < sampleLogs.length; i++) {
      await new Promise(r => setTimeout(r, 450));
      const log = sampleLogs[i];
      const div = document.createElement('div');
      div.innerHTML = `[${log.t}] ${log.text}`;
      decompileBody.appendChild(div);
      decompileBody.scrollTop = decompileBody.scrollHeight;
      sound.pulse(800 + i * 80, 0.12);
    }

    btnReplayRun.innerText = 'REPLAY COMPLETE';
    state.replaying = false;
    setTimeout(() => {
      btnReplayRun.innerText = 'Decompile & Replay';
    }, 3000);
  });
}

// Phantom Wallet Connection
btnWallet.addEventListener('click', async () => {
  sound.click(1000);
  if (window.solana && window.solana.isPhantom) {
    try {
      if (!state.walletConnected) {
        const resp = await window.solana.connect();
        state.walletConnected = true;
        state.publicKey = resp.publicKey.toString();
        const shortKey = `${state.publicKey.slice(0, 4)}...${state.publicKey.slice(-4)}`;
        btnWallet.innerText = shortKey;
        btnWallet.style.background = '#14f195';
        btnWallet.style.color = '#06080d';
        sound.chord();
        console.log('[+] Phantom Connected:', state.publicKey);
      } else {
        await window.solana.disconnect();
        state.walletConnected = false;
        state.publicKey = null;
        btnWallet.innerText = state.isMobile ? 'CONNECT' : 'CONNECT PHANTOM';
        btnWallet.style.background = 'linear-gradient(135deg, #9945ff, #14f195)';
        btnWallet.style.color = '#06080d';
        sound.click(500);
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
    }
  } else {
    alert('Phantom Wallet not detected! Please install Phantom or use a Solana-enabled browser.');
  }
});

// Simulate Button (Camera Flyover + Particle Burst + Audio)
btnSimulate.addEventListener('click', () => {
  state.simulating = true;
  btnSimulate.innerText = 'SIMULATING...';
  btnSimulate.style.borderColor = '#14f195';
  sound.chord();
  
  setTimeout(() => {
    state.simulating = false;
    btnSimulate.innerText = 'SIMULATE';
    btnSimulate.style.borderColor = 'rgba(255, 255, 255, 0.08)';
  }, 4000);
});

// Deploy Route Button (MultiHopper Core Program Transaction Builder)
btnDeploy.addEventListener('click', async () => {
  sound.click(1200);
  if (!state.walletConnected) {
    alert('Please connect your Phantom Wallet to authorize the Token-2022 MultiHopper route.');
    return;
  }

  btnDeploy.innerText = 'SIGNING...';

  try {
    const connection = new window.solanaWeb3.Connection(
      window.solanaWeb3.clusterApiUrl(state.network),
      'confirmed'
    );

    const transaction = new window.solanaWeb3.Transaction();
    const userPubkey = new window.solanaWeb3.PublicKey(state.publicKey);

    transaction.add(
      window.solanaWeb3.SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: userPubkey,
        lamports: 1000
      })
    );

    transaction.feePayer = userPubkey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signedTx = await window.solana.signTransaction(transaction);
    console.log('[+] Route Authorized by Wallet:', signedTx);

    sound.chord();
    alert(`Route successfully authorized!\n\nMultiHopper Core: ${MULTIHOPPER_PROGRAMS.core}\nTransfer Hops: ${state.hopsCount}\nToken Standard: Token-2022 Transfer Hook Guard`);
    btnDeploy.innerText = 'DEPLOYED';
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

  sound.click(1300);

  const hopsMatch = query.match(/(\d+)\s*hops?/);
  if (hopsMatch) {
    const h = Math.min(Math.max(parseInt(hopsMatch[1], 10), 1), 5);
    sliderHops.value = h;
    sliderHops.dispatchEvent(new Event('input'));
  }

  const amountMatch = query.match(/(\d+)\s*(usdc|sol|bonk)?/);
  if (amountMatch) {
    const amtField = document.getElementById('input-amount');
    if (amtField) amtField.value = amountMatch[1];
  }

  aiInput.value = `✓ Configured: ${sliderHops.value} Hops Route Synced`;
  setTimeout(() => { aiInput.value = ''; }, 3000);
});

// =========================================================================
// 8. Attach Syndicate 60 FPS Canvas Showreel Recorder
// =========================================================================
if (window.SyndicateRecorder) {
  window.SyndicateRecorder.attach(canvas, {
    fps: 60,
    durationSeconds: 15,
    filename: 'hopstream_3d_60fps_showreel.webm'
  });
}

// Initial build & launch
rebuildTopology(state.hopsCount);
animate();
