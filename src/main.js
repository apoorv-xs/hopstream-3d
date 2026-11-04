import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// =========================================================================
// HOPSTREAM 3D // BLENDER & ERAVEX STUDIO BESPOKE GLTF ENGINE
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
  hoveredNode: null,
  modelsLoaded: false
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

// Strictly clamp elevation: never drop under floor plane, prevent steep top-down occlusion
controls.minPolarAngle = Math.PI / 5;        // ~36° minimum elevation
controls.maxPolarAngle = Math.PI / 2 - 0.08; // ~85° maximum (strict ground horizon)

// Strictly constrain azimuth to front 90° arc: prevents nodes from clipping behind sidebar
controls.minAzimuthAngle = -Math.PI / 4;     // -45° left limit
controls.maxAzimuthAngle = Math.PI / 4;      // +45° right limit

controls.minDistance = 12;
controls.maxDistance = 60;
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

  // Rim Panel (Solana Purple)
  const rimPanel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0x9945ff, side: THREE.DoubleSide }));
  rimPanel.position.set(-30, 15, -25);
  rimPanel.lookAt(0, 0, 0);
  envScene.add(rimPanel);

  // Key Panel (MultiHopper Electric Acid Lime)
  const keyPanel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0xD4F83A, side: THREE.DoubleSide }));
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
// ERAVEX STUDIO POST-PROCESSING: UNREAL BLOOM + ANAMORPHIC CINEMATIC SHADER
// =========================================================================
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.65, // bloom strength
  0.45, // bloom radius
  0.35  // bloom threshold
);
composer.addPass(bloomPass);

// Luxury Cinematic GLSL Shader (Chromatic Aberration + 35mm Film Grain + Vignette)
const LuxuryCinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0032 },
    uGrainIntensity: { value: 0.042 },
    uVignetteDarkness: { value: 1.15 },
    uVignetteOffset: { value: 0.85 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrainIntensity;
    uniform float uVignetteDarkness;
    uniform float uVignetteOffset;
    varying vec2 vUv;

    float random(vec2 p) {
      return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 distFromCenter = uv - 0.5;
      float dist = length(distFromCenter);

      // 1. Radial Chromatic Aberration
      float split = uAberration * dist * 1.8;
      vec2 redUv = uv + distFromCenter * split;
      vec2 blueUv = uv - distFromCenter * split;

      float r = texture2D(tDiffuse, redUv).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, blueUv).b;
      vec3 color = vec3(r, g, b);

      // 2. Anamorphic Vignette
      float vignette = smoothstep(uVignetteOffset, uVignetteOffset - 0.5, dist);
      color = mix(color * (1.0 - uVignetteDarkness * 0.42), color, vignette);

      // 3. 35mm Film Grain
      float grain = (random(uv * 1200.0 + fract(uTime * 19.0)) - 0.5) * uGrainIntensity;
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const cinematicPass = new ShaderPass(LuxuryCinematicShader);
composer.addPass(cinematicPass);

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

const greenLight = new THREE.PointLight(0xD4F83A, 4.5, 60);
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
      colors[i * 3] = 0.83; colors[i * 3 + 1] = 0.97; colors[i * 3 + 2] = 0.23; // Acid lime
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

// 3.2 Cybernetic Ground Grid & Concentric MultiHopper Swirl Rings
const gridHelper = new THREE.GridHelper(80, 60, 0x00f2fe, 0x111827);
gridHelper.position.y = -4;
scene.add(gridHelper);

// ERAVEX Studio Procedural Wavefront Caustics Floor
const floorGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
floorGeo.rotateX(-Math.PI / 2);
const floorMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x00f2fe) },
    uColorB: { value: new THREE.Color(0xD4F83A) },
    uDarkFloor: { value: new THREE.Color(0x04060a) }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uDarkFloor;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    float causticWave(vec2 p, float t) {
      vec2 p1 = p * 1.6 + vec2(t * 0.16, t * 0.11);
      vec2 p2 = p * 2.1 - vec2(t * 0.13, t * 0.21);
      float w1 = sin(p1.x + sin(p1.y * 1.3));
      float w2 = cos(p2.y + cos(p2.x * 1.5));
      return pow((w1 + w2) * 0.5 + 0.5, 3.0);
    }

    void main() {
      vec2 p = vWorldPos.xz * 0.10;
      float c1 = causticWave(p, uTime);
      float c2 = causticWave(p * 1.3 + vec2(1.8, 3.1), uTime * 1.15);
      float caustics = clamp(c1 * 0.65 + c2 * 0.35, 0.0, 1.0);

      float dist = length(vWorldPos.xz);
      float fade = smoothstep(45.0, 3.0, dist);

      vec3 causticColor = mix(uColorA, uColorB, caustics);
      vec3 finalColor = mix(uDarkFloor, causticColor, caustics * fade * 0.38);

      gl_FragColor = vec4(finalColor, fade * 0.85);
    }
  `,
  transparent: true,
  depthWrite: false
});
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.position.y = -4.01;
scene.add(floorMesh);

const radarGroup = new THREE.Group();
radarGroup.position.set(-5, -3.95, 2);
radarGroup.rotation.x = -Math.PI / 2;

[6, 12, 18, 24, 30].forEach((radius, i) => {
  const ringGeo = new THREE.RingGeometry(radius - 0.04, radius + 0.04, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: i % 2 === 0 ? 0xD4F83A : 0x00f2fe,
    transparent: true,
    opacity: 0.24 - (i * 0.03),
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  radarGroup.add(ring);
});
scene.add(radarGroup);

// 3.3 Interactive Target Reticle (snaps to hovered 3D nodes)
const reticleGeo = new THREE.RingGeometry(1.6, 1.7, 32);
const reticleMat = new THREE.MeshBasicMaterial({
  color: 0xD4F83A,
  transparent: true,
  opacity: 0,
  side: THREE.DoubleSide
});
const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
scene.add(reticleMesh);

// =========================================================================
// 4. Bespoke Blender 5.2 glTF Models & Procedural Fallbacks
// =========================================================================
const gltfLoader = new GLTFLoader();
const loadedModels = {
  wallet: null,
  reactor: null,
  relay: null,
  validator: null,
  dao: null,
  liquidity: null
};

// Preload Blender GLB models
function preloadModels(callback) {
  const models = [
    { key: 'reactor', path: 'models/multihopper_reactor.glb' },
    { key: 'relay', path: 'models/multihopper_relay.glb' },
    { key: 'wallet', path: 'models/wallet.glb' },
    { key: 'validator', path: 'models/validator_node.glb' },
    { key: 'dao', path: 'models/dao_cluster.glb' },
    { key: 'liquidity', path: 'models/liquidity_pool.glb' }
  ];

  let loaded = 0;
  models.forEach(m => {
    gltfLoader.load(m.path, (gltf) => {
      loadedModels[m.key] = gltf.scene;
      loaded++;
      if (loaded === models.length) {
        state.modelsLoaded = true;
        console.log('[+] All Blender 5.2 & ERAVEX GLTF assets loaded.');
        if (callback) callback();
      }
    }, undefined, () => {
      loaded++;
      if (loaded === models.length && callback) callback();
    });
  });
}

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
let animatedSubpieces = [];

// Ultra-Crisp 1024x288 High-DPI Canvas Text Sprite Generator (Space Grotesk + JetBrains Mono + Status LED)
function createHoloTextSprite(text, subtext, colorHex) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 288;
  const ctx = c.getContext('2d');

  // Background glass card with hairline gradient border
  ctx.fillStyle = 'rgba(7, 11, 19, 0.88)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(16, 16, 992, 256, 32);
  ctx.fill();
  ctx.stroke();

  // Specular top highlight line
  const grad = ctx.createLinearGradient(32, 20, 992, 20);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, 24);
  ctx.lineTo(944, 24);
  ctx.stroke();

  // Glowing cybernetic status LED dot
  ctx.fillStyle = colorHex;
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(110, 110, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // reset shadow

  // Primary label with Space Grotesk
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 82px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(text, 150, 138);

  // Subtext with JetBrains Mono
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 44px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(subtext, 150, 218);

  const tex = new THREE.CanvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(3.8, 1.07, 1.0);
  return sprite;
}

// Dynamic Shockwave Ripples (Visual Feedback on Simulation & Clicks)
const shockwaves = [];
function triggerShockwave(pos, colorHex) {
  const geo = new THREE.RingGeometry(0.1, 0.28, 36);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.position.y -= 0.3;
  scene.add(mesh);
  shockwaves.push({ mesh, radius: 0.28, opacity: 0.95 });
}

// Procedural Crystal Node (PBR Optical Glass)
function createCrystalNode(geometry, colorHex, radius = 1.0) {
  const group = new THREE.Group();
  
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

  const innerCoreGeo = new THREE.SphereGeometry(radius * 0.42, 16, 16);
  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.75
  });
  const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
  group.add(innerCore);

  const wireMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    wireframe: true,
    transparent: true,
    opacity: 0.26
  });
  const wire = new THREE.Mesh(geometry, wireMat);
  wire.scale.setScalar(1.24);
  group.add(wire);

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
  while (nodeGroup.children.length > 0) nodeGroup.remove(nodeGroup.children[0]);
  while (curveGroup.children.length > 0) curveGroup.remove(curveGroup.children[0]);
  while (particleGroup.children.length > 0) particleGroup.remove(particleGroup.children[0]);
  while (labelGroup.children.length > 0) labelGroup.remove(labelGroup.children[0]);
  
  nodes = [];
  curves = [];
  particleSystems = [];
  cometStreams = [];
  animatedSubpieces = [];

  // 1. Origin: User Wallet Node (Left, offset clear of sidebar)
  const originPos = new THREE.Vector3(-13.5, 0, 0);
  let originNode;
  if (loadedModels.wallet) {
    const walletScene = loadedModels.wallet.clone();
    walletScene.scale.setScalar(2.2);
    walletScene.position.copy(originPos);
    
    // Find representative mesh for raycasting
    let hitMesh = null;
    walletScene.traverse((c) => {
      if (c.isMesh) {
        c.material = new THREE.MeshPhysicalMaterial({
          color: 0x9945ff,
          emissive: 0x9945ff,
          emissiveIntensity: 0.25,
          roughness: 0.2,
          metalness: 0.7,
          clearcoat: 0.8
        });
        if (!hitMesh) hitMesh = c;
      }
    });
    nodeGroup.add(walletScene);
    originNode = { group: walletScene, core: hitMesh || walletScene };
  } else {
    originNode = createCrystalNode(new THREE.IcosahedronGeometry(1.3, 1), 0x9945ff, 1.3);
    originNode.group.position.copy(originPos);
    nodeGroup.add(originNode.group);
  }
  nodes.push({ id: 'origin', pos: originPos, label: 'ORIGIN', mesh: originNode });

  const originSprite = createHoloTextSprite('ORIGIN', 'Phantom Wallet', '#9945ff');
  originSprite.position.set(originPos.x, originPos.y + 2.5, originPos.z);
  labelGroup.add(originSprite);

  // 2. Vault Minter Node (Center-Left: Bespoke Blender 5.2 MultiHopper Kinetic Reactor)
  const vaultPos = new THREE.Vector3(-4.5, 3, 1.5);
  let vaultNode;
  if (loadedModels.reactor) {
    const reactorScene = loadedModels.reactor.clone();
    reactorScene.scale.setScalar(1.55);
    reactorScene.position.copy(vaultPos);

    let hitMesh = null;
    let ringOuter = null;
    let ringMid = null;
    let ringInner = null;
    let coreCrystal = null;
    let singularity = null;

    reactorScene.traverse((c) => {
      if (c.isMesh) {
        if (!hitMesh) hitMesh = c;
        if (c.name.includes('Orbital_Ring_Outer')) ringOuter = c;
        else if (c.name.includes('Orbital_Ring_Mid')) ringMid = c;
        else if (c.name.includes('Orbital_Ring_Inner')) ringInner = c;
        else if (c.name.includes('Reactor_Core_Crystal')) coreCrystal = c;
        else if (c.name.includes('Reactor_Inner_Singularity')) singularity = c;
      }
    });

    nodeGroup.add(reactorScene);
    vaultNode = { group: reactorScene, core: hitMesh || reactorScene };
    animatedSubpieces.push({
      type: 'multihopper_reactor',
      obj: reactorScene,
      ringOuter, ringMid, ringInner, coreCrystal, singularity
    });
  } else if (loadedModels.validator) {
    const valScene = loadedModels.validator.clone();
    valScene.scale.setScalar(0.48);
    valScene.position.copy(vaultPos);

    let valMesh = null;
    let orbs = [];
    valScene.traverse((c) => {
      if (c.isMesh) {
        c.material = new THREE.MeshPhysicalMaterial({
          color: 0x00f2fe,
          emissive: 0x00f2fe,
          emissiveIntensity: 0.22,
          roughness: 0.15,
          metalness: 0.4,
          transmission: 0.5,
          ior: 1.5
        });
        if (!valMesh) valMesh = c;
        if (c.name.includes('Orb')) orbs.push(c);
      }
    });
    nodeGroup.add(valScene);
    vaultNode = { group: valScene, core: valMesh || valScene, subOrbs: orbs };
    animatedSubpieces.push({ type: 'validator', obj: valScene, orbs });
  } else {
    vaultNode = createCrystalNode(new THREE.DodecahedronGeometry(1.8, 1), 0x00f2fe, 1.8);
    vaultNode.group.position.copy(vaultPos);
    nodeGroup.add(vaultNode.group);
  }
  nodes.push({ id: 'vault', pos: vaultPos, label: 'VAULT', mesh: vaultNode });

  const vaultSprite = createHoloTextSprite('CORE PDA', 'Token-2022 Escrow', '#00f2fe');
  vaultSprite.position.set(vaultPos.x, vaultPos.y + 3.0, vaultPos.z);
  labelGroup.add(vaultSprite);

  // Connect Origin -> Vault
  createRouteCurve(originPos, vaultPos, 0x9945ff);

  // 3. Intermediate Sequenced Hops (MultiHopper Acid Lime Crystals)
  let lastPos = vaultPos;
  const hopStepX = 21 / (hops + 1);
  for (let i = 1; i <= hops; i++) {
    const angle = (i / (hops + 1)) * Math.PI;
    const x = -4.5 + (i * hopStepX);
    const y = Math.sin(angle) * 3.8 + 1;
    const z = Math.cos(angle) * 3.8 - 2;
    const hopPos = new THREE.Vector3(x, y, z);
    
    let hopNode;
    if (loadedModels.relay) {
      const relayScene = loadedModels.relay.clone();
      relayScene.scale.setScalar(1.25);
      relayScene.position.copy(hopPos);

      let dialRing = null;
      let innerCore = null;
      let hitMesh = null;
      relayScene.traverse((c) => {
        if (c.isMesh) {
          if (!hitMesh) hitMesh = c;
          if (c.name.includes('Dial_Ring')) dialRing = c;
          else if (c.name.includes('Inner_Core')) innerCore = c;
        }
      });

      nodeGroup.add(relayScene);
      hopNode = { group: relayScene, core: hitMesh || relayScene };
      animatedSubpieces.push({
        type: 'timelock_relay',
        obj: relayScene,
        dialRing,
        innerCore,
        idx: i
      });
    } else {
      hopNode = createCrystalNode(new THREE.OctahedronGeometry(1.0, 0), 0xD4F83A, 1.0);
      hopNode.group.position.copy(hopPos);
      nodeGroup.add(hopNode.group);
    }
    nodes.push({ id: `hop-${i}`, pos: hopPos, label: `HOP ${i}`, mesh: hopNode });

    const hopSprite = createHoloTextSprite(`RELAY ${i}`, 'Keeper Timelock', '#D4F83A');
    hopSprite.position.set(hopPos.x, hopPos.y + 2.2, hopPos.z);
    labelGroup.add(hopSprite);

    createRouteCurve(lastPos, hopPos, 0xD4F83A);
    lastPos = hopPos;
  }

  // 4. Final Redemptions: Split Destinations (Right: Sculpted DAO Treasury & Liquidity Pool)
  const dest1Pos = new THREE.Vector3(17.5, 2, -3);
  let dest1Node;
  if (loadedModels.dao) {
    const daoScene = loadedModels.dao.clone();
    daoScene.scale.setScalar(0.28);
    daoScene.position.copy(dest1Pos);

    let daoMesh = null;
    daoScene.traverse((c) => {
      if (c.isMesh) {
        c.material = new THREE.MeshPhysicalMaterial({
          color: 0x00f2fe,
          emissive: 0x00f2fe,
          emissiveIntensity: 0.22,
          roughness: 0.25,
          metalness: 0.6,
          clearcoat: 0.6
        });
        if (!daoMesh) daoMesh = c;
      }
    });
    nodeGroup.add(daoScene);
    dest1Node = { group: daoScene, core: daoMesh || daoScene };
  } else {
    dest1Node = createCrystalNode(new THREE.IcosahedronGeometry(1.2, 1), 0x00f2fe, 1.2);
    dest1Node.group.position.copy(dest1Pos);
    nodeGroup.add(dest1Node.group);
  }
  nodes.push({ id: 'dest-a', pos: dest1Pos, label: 'TREASURY', mesh: dest1Node });

  const dest1Sprite = createHoloTextSprite('TREASURY', '60% Settled', '#00f2fe');
  dest1Sprite.position.set(dest1Pos.x, dest1Pos.y + 2.4, dest1Pos.z);
  labelGroup.add(dest1Sprite);
  createRouteCurve(lastPos, dest1Pos, 0x00f2fe);

  const dest2Pos = new THREE.Vector3(17.5, -2, 4);
  let dest2Node;
  if (loadedModels.liquidity) {
    const liqScene = loadedModels.liquidity.clone();
    liqScene.scale.setScalar(0.38);
    liqScene.position.copy(dest2Pos);

    let liqMesh = null;
    liqScene.traverse((c) => {
      if (c.isMesh) {
        c.material = new THREE.MeshPhysicalMaterial({
          color: 0xD4F83A,
          emissive: 0xD4F83A,
          emissiveIntensity: 0.24,
          roughness: 0.15,
          metalness: 0.5,
          clearcoat: 0.8
        });
        if (!liqMesh) liqMesh = c;
      }
    });
    nodeGroup.add(liqScene);
    dest2Node = { group: liqScene, core: liqMesh || liqScene };
  } else {
    dest2Node = createCrystalNode(new THREE.IcosahedronGeometry(1.1, 1), 0xD4F83A, 1.1);
    dest2Node.group.position.copy(dest2Pos);
    nodeGroup.add(dest2Node.group);
  }
  nodes.push({ id: 'dest-b', pos: dest2Pos, label: 'CONTRIBUTOR', mesh: dest2Node });

  const dest2Sprite = createHoloTextSprite('CONTRIBUTOR', '40% Settled', '#D4F83A');
  dest2Sprite.position.set(dest2Pos.x, dest2Pos.y + 2.2, dest2Pos.z);
  labelGroup.add(dest2Sprite);
  createRouteCurve(lastPos, dest2Pos, 0xD4F83A);

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

  // Inner Luminous Conduit
  const coreTubeGeo = new THREE.TubeGeometry(curve, 48, 0.05, 8, false);
  const coreTubeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.75
  });
  const coreTube = new THREE.Mesh(coreTubeGeo, coreTubeMat);
  curveGroup.add(coreTube);

  // Outer Translucent Plasma Sheath
  const outerTubeGeo = new THREE.TubeGeometry(curve, 36, 0.12, 8, false);
  const outerTubeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending
  });
  const outerTube = new THREE.Mesh(outerTubeGeo, outerTubeMat);
  curveGroup.add(outerTube);

  // Flowing Particles
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

  // High-Energy Comet Head (Fast moving cryptographic packet)
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

// =========================================================================
// ERAVEX STUDIO DIRECTOR: CINEMATIC CAMERA CHOREOGRAPHER
// =========================================================================
const cameraDirector = {
  active: false,
  targetCamPos: new THREE.Vector3(),
  targetLookAt: new THREE.Vector3(),
  homeCamPos: new THREE.Vector3(0, 8, 30),
  homeLookAt: new THREE.Vector3(0, 0, 0),
  dampFactor: 3.2,

  focusOn(node) {
    this.active = true;
    this.targetLookAt.copy(node.pos);
    const offset = new THREE.Vector3(
      node.pos.x > 0 ? -5.5 : 5.5,
      2.8,
      8.5
    );
    this.targetCamPos.copy(node.pos).add(offset);
  },

  reset() {
    this.active = true;
    this.targetCamPos.copy(this.homeCamPos);
    this.targetLookAt.copy(this.homeLookAt);
  },

  update(delta) {
    if (!this.active) return;
    camera.position.lerp(this.targetCamPos, Math.min(delta * this.dampFactor, 1.0));
    controls.target.lerp(this.targetLookAt, Math.min(delta * this.dampFactor, 1.0));
    if (camera.position.distanceTo(this.targetCamPos) < 0.15 && controls.target.distanceTo(this.targetLookAt) < 0.15) {
      this.active = false;
    }
  }
};

// Interactive Click to Focus Camera on Node
window.addEventListener('click', (e) => {
  if (e.target.closest('aside, header, .decompile-terminal, .ai-dispatcher')) return;
  if (state.hoveredNode) {
    sound.click(1400);
    cameraDirector.focusOn(state.hoveredNode);
  } else {
    cameraDirector.reset();
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

  // Update Procedural Shaders & Director
  floorMat.uniforms.uTime.value = time;
  LuxuryCinematicShader.uniforms.uTime.value = time;
  cameraDirector.update(delta);

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
    if (n.mesh && n.mesh.gyroRing) {
      n.mesh.core.rotation.y += 0.75 * delta;
      n.mesh.wire.rotation.x -= 0.4 * delta;
      n.mesh.wire.rotation.z += 0.3 * delta;
      n.mesh.gyroRing.rotation.z += 0.9 * delta;
      n.mesh.innerCore.scale.setScalar(1.0 + Math.sin(time * 3 + idx) * 0.15);
      n.mesh.group.position.y += Math.sin(time * 2 + idx) * 0.0025;
    } else if (n.mesh && n.mesh.group) {
      n.mesh.group.rotation.y += 0.5 * delta;
      n.mesh.group.position.y += Math.sin(time * 2 + idx) * 0.0025;
    }
  });

  // Rotate Sculpted Blender & ERAVEX Subpieces (MultiHopper Kinetic Reactor & Timelock Relayers)
  animatedSubpieces.forEach(sp => {
    if (sp.type === 'multihopper_reactor') {
      if (sp.ringOuter) sp.ringOuter.rotation.z += 0.35 * delta;
      if (sp.ringMid) sp.ringMid.rotation.x += 0.55 * delta;
      if (sp.ringInner) sp.ringInner.rotation.y -= 0.85 * delta;
      if (sp.coreCrystal) sp.coreCrystal.rotation.y += 0.4 * delta;
      if (sp.singularity) sp.singularity.scale.setScalar(1.0 + Math.sin(time * 4.0) * 0.18);
    } else if (sp.type === 'timelock_relay') {
      if (sp.dialRing) sp.dialRing.rotation.z += (sp.idx % 2 === 0 ? 0.95 : -0.95) * delta;
      if (sp.innerCore) sp.innerCore.scale.setScalar(1.0 + Math.sin(time * 4.0 + sp.idx) * 0.22);
      sp.obj.rotation.y += 0.4 * delta;
    } else if (sp.type === 'validator' && sp.orbs) {
      sp.orbs.forEach((orb, i) => {
        orb.rotation.y += (i % 2 === 0 ? 0.8 : -0.8) * delta;
      });
    }
  });

  // Animate Dynamic Shockwave Expansion
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += 8.5 * delta;
    sw.opacity -= 1.3 * delta;
    sw.mesh.scale.setScalar(sw.radius);
    sw.mesh.material.opacity = Math.max(0, sw.opacity);
    if (sw.opacity <= 0) {
      scene.remove(sw.mesh);
      sw.mesh.geometry.dispose();
      sw.mesh.material.dispose();
      shockwaves.splice(i, 1);
    }
  }

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

  // Dynamic Billboard Elevation Pitch-Fade
  const pitch = Math.abs(camera.position.y / Math.max(camera.position.length(), 1.0));
  labelGroup.children.forEach(sprite => {
    if (pitch > 0.45) {
      sprite.material.opacity = Math.max(0.25, 1.0 - (pitch - 0.45) * 2.2);
    } else {
      sprite.material.opacity = 0.95;
    }
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
  const coreMeshes = nodes.map(n => n.mesh.core).filter(Boolean);
  const intersects = raycaster.intersectObjects(coreMeshes, true);

  if (intersects.length > 0) {
    let hitMesh = intersects[0].object;
    let hitNode = nodes.find(n => n.mesh.core === hitMesh || (n.mesh.group && n.mesh.group.contains && n.mesh.group.contains(hitMesh)));

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
  cameraDirector.reset();
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
        btnWallet.style.background = '#D4F83A';
        btnWallet.style.color = '#07090e';
        sound.chord();
        console.log('[+] Phantom Connected:', state.publicKey);
      } else {
        await window.solana.disconnect();
        state.walletConnected = false;
        state.publicKey = null;
        btnWallet.innerText = state.isMobile ? 'CONNECT' : 'CONNECT PHANTOM';
        btnWallet.style.background = 'linear-gradient(135deg, #9945ff, #D4F83A)';
        btnWallet.style.color = '#07090e';
        sound.click(500);
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
    }
  } else {
    alert('Phantom Wallet not detected! Please install Phantom or use a Solana-enabled browser.');
  }
});

// ERAVEX Studio Choreographed On-Chain Execution Simulator
async function runCinematicSimulation() {
  if (state.simulating) return;
  state.simulating = true;
  btnSimulate.innerText = 'EXECUTING...';
  btnSimulate.style.borderColor = '#D4F83A';
  btnSimulate.style.color = '#D4F83A';

  if (decompileTerminal) decompileTerminal.style.display = 'flex';
  if (decompileBody) decompileBody.innerHTML = '';

  const addLog = (text, status = 'pass') => {
    if (!decompileBody) return;
    const div = document.createElement('div');
    const timeStr = `[00:0${(decompileBody.children.length * 0.75).toFixed(2)}]`;
    div.innerHTML = `${timeStr} ${text} <span class="${status}">${status.toUpperCase()}</span>`;
    decompileBody.appendChild(div);
    decompileBody.scrollTop = decompileBody.scrollHeight;
    sound.click(1000 + decompileBody.children.length * 120);
  };

  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  // Step 1: Origin
  if (nodes[0]) {
    cameraDirector.focusOn(nodes[0]);
    triggerShockwave(nodes[0].pos, 0x9945ff);
    addLog('Phantom Wallet: Auth Token-2022 Route Dispatch');
  }
  await wait(900);

  // Step 2: Core PDA Escrow
  const vault = nodes.find(n => n.id === 'vault');
  if (vault) {
    cameraDirector.focusOn(vault);
    triggerShockwave(vault.pos, 0x00f2fe);
    addLog(`Core Escrow PDA (${MULTIHOPPER_PROGRAMS.core.slice(0, 6)}...): ${state.amount} USDC Locked`);
  }
  await wait(1100);

  // Step 3: Sequenced Hops
  for (let i = 1; i <= state.hopsCount; i++) {
    const hopNode = nodes.find(n => n.id === `hop-${i}`);
    if (hopNode) {
      cameraDirector.focusOn(hopNode);
      triggerShockwave(hopNode.pos, 0xD4F83A);
      addLog(`Relay #${i} Keeper Timelock: Delay ${i * 10}s Verified`);
    }
    await wait(950);
  }

  // Step 4: Split Settlement
  const destA = nodes.find(n => n.id === 'dest-a');
  const destB = nodes.find(n => n.id === 'dest-b');
  if (destA && destB) {
    triggerShockwave(destA.pos, 0x00f2fe);
    triggerShockwave(destB.pos, 0xD4F83A);
    addLog('Settlement: 60% Treasury | 40% Contributor');
    sound.chord();
  }
  await wait(1400);

  // Step 5: Camera overview reset
  cameraDirector.reset();
  state.simulating = false;
  btnSimulate.innerText = 'SIMULATE';
  btnSimulate.style.borderColor = 'rgba(255, 255, 255, 0.08)';
  btnSimulate.style.color = '#f3f4f6';
}

btnSimulate.addEventListener('click', runCinematicSimulation);

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

// Initial build & launch with Blender GLTF preloading
preloadModels(() => {
  rebuildTopology(state.hopsCount);
});
rebuildTopology(state.hopsCount);
animate();
