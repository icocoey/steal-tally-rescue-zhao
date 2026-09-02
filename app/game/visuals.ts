import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export type CharacterAction =
  | "idle"
  | "walk"
  | "run"
  | "crouch"
  | "interact"
  | "sleep"
  | "handoff";

export interface CharacterAssetConfig {
  id: string;
  url: string;
  scale: number;
  materialVariants: {
    main: number;
    accent: number;
    skin?: number;
    dark?: number;
  };
  animationNames: Record<CharacterAction, string>;
  fallback: {
    main: number;
    accent: number;
    role: "player" | "ruji" | "king" | "general" | "eunuch";
  };
}

export interface AnimatedCharacter {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<CharacterAction, THREE.AnimationAction>;
  currentAction: CharacterAction;
}

export interface AnimatedCloth {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  phase: number;
}

const ACTIONS: CharacterAction[] = [
  "idle",
  "walk",
  "run",
  "crouch",
  "interact",
  "sleep",
  "handoff",
];

const animationNames = Object.fromEntries(ACTIONS.map((action) => [action, action])) as Record<CharacterAction, string>;

export const CHARACTER_ASSETS: Record<CharacterAssetConfig["fallback"]["role"], CharacterAssetConfig> = {
  player: {
    id: "player",
    url: "assets/models/palace-puppet.glb",
    scale: 0.78,
    materialVariants: { main: 0x214a45, accent: 0xc79a45, skin: 0xd8b38b, dark: 0x100d0c },
    animationNames,
    fallback: { main: 0x214a45, accent: 0xc79a45, role: "player" },
  },
  ruji: {
    id: "ruji",
    url: "assets/models/palace-puppet.glb",
    scale: 0.86,
    materialVariants: { main: 0x7d303d, accent: 0xd3a85b, skin: 0xe1b995, dark: 0x241316 },
    animationNames,
    fallback: { main: 0x7d303d, accent: 0xd3a85b, role: "ruji" },
  },
  king: {
    id: "king",
    url: "assets/models/palace-puppet.glb",
    scale: 0.9,
    materialVariants: { main: 0x8d3429, accent: 0xd6aa43, skin: 0xdab087, dark: 0x180c09 },
    animationNames,
    fallback: { main: 0x8d3429, accent: 0xd6aa43, role: "king" },
  },
  general: {
    id: "general",
    url: "assets/models/palace-puppet.glb",
    scale: 0.9,
    materialVariants: { main: 0x242d34, accent: 0xc09445, skin: 0xcba27d, dark: 0x080b0d },
    animationNames,
    fallback: { main: 0x242d34, accent: 0xc09445, role: "general" },
  },
  eunuch: {
    id: "eunuch",
    url: "assets/models/palace-puppet.glb",
    scale: 0.72,
    materialVariants: { main: 0x24343b, accent: 0x7d9b96, skin: 0xcaa37e, dark: 0x0b1114 },
    animationNames,
    fallback: { main: 0x24343b, accent: 0x7d9b96, role: "eunuch" },
  },
};

const loader = new GLTFLoader();
const sharedAssets = new Map<string, Promise<GLTF>>();

export function assetUrl(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  return new URL(cleanPath, document.baseURI).toString();
}

function createLabel(text: string, color = "#f3d58a") {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(5, 8, 8, .78)";
  ctx.roundRect(20, 16, 344, 76, 20);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "600 34px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 192, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(3.45, 1, 1);
  sprite.position.y = 3.7;
  return sprite;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  name?: string,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

export function createDetailedPuppet(config: CharacterAssetConfig, label?: string) {
  const group = new THREE.Group();
  group.name = `${config.id}-character-root`;
  const visual = new THREE.Group();
  visual.name = `${config.id}-procedural-fallback`;
  group.add(visual);

  const mainMat = new THREE.MeshStandardMaterial({ color: config.fallback.main, roughness: 0.7, metalness: 0.04, side: THREE.DoubleSide });
  const accentMat = new THREE.MeshStandardMaterial({ color: config.fallback.accent, roughness: 0.42, metalness: 0.18 });
  const skinMat = new THREE.MeshStandardMaterial({ color: config.materialVariants.skin ?? 0xd2aa83, roughness: 0.82 });
  const darkMat = new THREE.MeshStandardMaterial({ color: config.materialVariants.dark ?? 0x100d0c, roughness: 0.8 });

  const torso = addMesh(visual, new THREE.BoxGeometry(1.05, 1.35, 0.3), mainMat, [0, 1.55, 0], "Torso");
  addMesh(visual, new THREE.BoxGeometry(1.15, 0.18, 0.36), accentMat, [0, 1.1, 0.02], "Belt");
  const skirt = addMesh(visual, new THREE.ConeGeometry(0.75, 1.18, 8, 1, true), mainMat, [0, 0.68, 0], "Skirt");
  skirt.rotation.y = Math.PI / 8;
  const head = addMesh(visual, new THREE.SphereGeometry(0.39, 18, 12), skinMat, [0, 2.55, 0], "Head");
  head.scale.z = 0.55;

  addMesh(visual, new THREE.BoxGeometry(0.86, 0.18, 0.42), darkMat, [0, 2.94, 0], "Hat");
  const crownHeight = config.fallback.role === "king" || config.fallback.role === "general" ? 0.62 : 0.38;
  addMesh(visual, new THREE.CylinderGeometry(0.14, 0.2, crownHeight, 8), accentMat, [0, 3.18, 0], "Crown");

  const faceLine = new THREE.MeshBasicMaterial({ color: 0x21110f });
  for (const x of [-0.14, 0.14]) addMesh(visual, new THREE.SphereGeometry(0.035, 8, 6), faceLine, [x, 2.61, -0.215]);
  const mask = addMesh(visual, new THREE.TorusGeometry(0.18, 0.025, 6, 16, Math.PI), accentMat, [0, 2.48, -0.205], "FacePaint");
  mask.rotation.z = Math.PI;

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  leftArm.name = "LeftArm";
  rightArm.name = "RightArm";
  leftArm.position.set(-0.68, 2.05, 0);
  rightArm.position.set(0.68, 2.05, 0);
  addMesh(leftArm, new THREE.BoxGeometry(0.25, 1.12, 0.24), mainMat, [0, -0.46, 0]);
  addMesh(rightArm, new THREE.BoxGeometry(0.25, 1.12, 0.24), mainMat, [0, -0.46, 0]);
  const sleeveGeo = new THREE.ConeGeometry(0.36, 0.78, 8, 1, true);
  const leftSleeve = addMesh(leftArm, sleeveGeo, mainMat, [0, -0.64, 0.02], "LeftSleeve");
  const rightSleeve = addMesh(rightArm, sleeveGeo, mainMat, [0, -0.64, 0.02], "RightSleeve");
  leftSleeve.rotation.z = Math.PI;
  rightSleeve.rotation.z = Math.PI;
  visual.add(leftArm, rightArm);

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  leftLeg.name = "LeftLeg";
  rightLeg.name = "RightLeg";
  leftLeg.position.set(-0.28, 0.78, 0);
  rightLeg.position.set(0.28, 0.78, 0);
  addMesh(leftLeg, new THREE.BoxGeometry(0.3, 1.08, 0.3), darkMat, [0, -0.46, 0]);
  addMesh(rightLeg, new THREE.BoxGeometry(0.3, 1.08, 0.3), darkMat, [0, -0.46, 0]);
  addMesh(leftLeg, new THREE.BoxGeometry(0.36, 0.15, 0.55), darkMat, [0, -1.0, -0.11], "LeftShoe");
  addMesh(rightLeg, new THREE.BoxGeometry(0.36, 0.15, 0.55), darkMat, [0, -1.0, -0.11], "RightShoe");
  visual.add(leftLeg, rightLeg);

  addMesh(visual, new THREE.CylinderGeometry(0.72, 0.82, 0.15, 20), accentMat, [0, 0.1, 0], "Base");
  const pendant = addMesh(visual, new THREE.OctahedronGeometry(0.11), accentMat, [0, 0.88, -0.25], "Pendant");
  pendant.rotation.z = Math.PI / 4;

  if (label) group.add(createLabel(label));
  group.scale.setScalar(config.scale);
  group.userData.baseScale = config.scale;
  group.userData.fallbackVisual = visual;
  group.userData.rig = { leftArm, rightArm, leftLeg, rightLeg, torso, head, skirt, leftSleeve, rightSleeve };
  return group;
}

function loadShared(url: string) {
  const resolved = assetUrl(url);
  let request = sharedAssets.get(resolved);
  if (!request) {
    request = loader.loadAsync(resolved);
    sharedAssets.set(resolved, request);
  }
  return request;
}

export async function attachCharacterAsset(root: THREE.Group, config: CharacterAssetConfig) {
  try {
    const gltf = await loadShared(config.url);
    const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    model.name = `${config.id}-gltf-model`;
    model.scale.setScalar(1);
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const materials = sourceMaterials.map((source) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        const key = source.name.toLowerCase();
        if (key.includes("main")) material.color.setHex(config.materialVariants.main);
        if (key.includes("accent")) material.color.setHex(config.materialVariants.accent);
        if (key.includes("skin")) material.color.setHex(config.materialVariants.skin ?? 0xd2aa83);
        if (key.includes("dark")) material.color.setHex(config.materialVariants.dark ?? 0x100d0c);
        return material;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    root.add(model);
    const fallback = root.userData.fallbackVisual as THREE.Object3D | undefined;
    if (fallback) fallback.visible = false;

    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map<CharacterAction, THREE.AnimationAction>();
    for (const action of ACTIONS) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, config.animationNames[action]);
      if (clip) actions.set(action, mixer.clipAction(clip));
    }
    const character: AnimatedCharacter = { root, mixer, actions, currentAction: "idle" };
    actions.get("idle")?.play();
    root.userData.animatedCharacter = character;
    return character;
  } catch (error) {
    console.warn(`[assets] ${config.id} GLB failed; using procedural puppet.`, error);
    return null;
  }
}

export function updateAnimatedCharacter(root: THREE.Group, action: CharacterAction, delta: number) {
  const character = root.userData.animatedCharacter as AnimatedCharacter | undefined;
  if (!character) return false;
  if (character.currentAction !== action) {
    const previous = character.actions.get(character.currentAction);
    const next = character.actions.get(action) ?? character.actions.get("idle");
    previous?.fadeOut(0.16);
    next?.reset().fadeIn(0.16).play();
    character.currentAction = action;
  }
  character.mixer.update(delta);
  return true;
}

export function createClothPanel(width: number, height: number, color: number, phase: number, strength = 0.11): AnimatedCloth {
  const geometry = new THREE.PlaneGeometry(width, height, Math.max(6, Math.round(width * 3)), 12);
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: phase },
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float freeEdge = 1.0 - smoothstep(0.74, 1.0, uv.y);
        p.z += sin(uv.x * 10.0 + uTime * 1.15 + uPhase) * uStrength * freeEdge;
        p.z += sin(uv.y * 17.0 - uTime * 0.58 + uPhase * 1.7) * uStrength * 0.32 * freeEdge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float fold = 0.84 + 0.16 * sin(vUv.x * 42.0);
        float edge = smoothstep(0.0, 0.035, vUv.x) * smoothstep(1.0, 0.965, vUv.x);
        gl_FragColor = vec4(uColor * fold, 0.94 * edge);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, material, phase };
}

export function updateClothPanels(panels: AnimatedCloth[], time: number, quality: "high" | "low") {
  for (const panel of panels) {
    panel.material.uniforms.uTime.value = quality === "high" ? time : Math.floor(time * 12) / 12;
  }
}

export class FlameLight {
  readonly root = new THREE.Group();
  readonly flame: THREE.Mesh;
  readonly light: THREE.PointLight;
  readonly smoke: THREE.Points;
  readonly phase: number;
  readonly baseIntensity: number;
  private highQuality = true;

  constructor(position: THREE.Vector3, phase: number, baseIntensity = 11) {
    this.phase = phase;
    this.baseIntensity = baseIntensity;
    this.root.position.copy(position);

    const metal = new THREE.MeshStandardMaterial({ color: 0x76502c, metalness: 0.72, roughness: 0.3 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xc77732, emissive: 0x7d2606, emissiveIntensity: 1.5, roughness: 0.68, transparent: true, opacity: 0.92 });
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.72, 12), paper);
    fixture.castShadow = true;
    this.root.add(fixture);
    const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 14), metal);
    const rimBottom = rimTop.clone();
    rimTop.rotation.x = rimBottom.rotation.x = Math.PI / 2;
    rimTop.position.y = 0.36;
    rimBottom.position.y = -0.36;
    this.root.add(rimTop, rimBottom);

    this.flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.flame.scale.set(0.7, 1.75, 0.7);
    this.flame.position.y = 0.02;
    this.root.add(this.flame);

    this.light = new THREE.PointLight(0xff9b45, baseIntensity, 10, 2);
    this.root.add(this.light);

    const smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0.44, 0, 0.05, 0.7, 0, -0.05, 0.98, 0, 0.02, 1.25, 0,
    ], 3));
    this.smoke = new THREE.Points(smokeGeometry, new THREE.PointsMaterial({ color: 0x9b8874, size: 0.13, transparent: true, opacity: 0.18, depthWrite: false }));
    this.root.add(this.smoke);
  }

  setQuality(quality: "high" | "low", index = 0) {
    this.highQuality = quality === "high";
    this.smoke.visible = this.highQuality;
    this.light.visible = this.highQuality || index % 2 === 0;
    this.light.distance = this.highQuality ? 10 : 7;
  }

  update(time: number) {
    const wave = Math.sin(time * 7.1 + this.phase) * 0.08 + Math.sin(time * 13.7 + this.phase * 1.9) * 0.045;
    this.flame.scale.y = 1.72 + wave * 2.2;
    this.flame.scale.x = this.flame.scale.z = 0.7 - wave * 0.4;
    this.flame.rotation.z = wave * 0.7;
    this.light.intensity = this.baseIntensity * (this.highQuality ? 1 : 0.72) * (1 + wave);
    this.light.color.setHSL(0.075 + wave * 0.025, 0.9, 0.66);
    this.smoke.rotation.y = time * 0.22 + this.phase;
    (this.smoke.material as THREE.PointsMaterial).opacity = 0.14 + Math.sin(time * 1.7 + this.phase) * 0.04;
  }
}
