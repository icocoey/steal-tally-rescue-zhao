"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type MissionPhase =
  | "reach_ruji"
  | "steal_tally"
  | "deliver_tally"
  | "complete";

interface MissionState {
  phase: MissionPhase;
  hasInnerToken: boolean;
  hasTigerTally: boolean;
  checkpointId: "entrance" | "inner_court" | "tally_acquired";
}

interface NpcConfig {
  id: string;
  kind: "eunuch" | "king" | "ruji" | "general";
  patrolPath?: [number, number, number][];
  viewDistance?: number;
  viewAngle?: number;
}

interface NoiseEvent {
  position: [number, number, number];
  intensity: number;
  source: "walk" | "run" | "prop" | "interaction";
}

type DialogueAction = "ruji" | "general" | "dismiss";

interface DialogueState {
  speaker: string;
  title: string;
  body: string;
  action: DialogueAction;
}

interface UiState {
  started: boolean;
  paused: boolean;
  phase: MissionPhase;
  objective: string;
  chapter: string;
  prompt: string;
  suspicion: number;
  sleepAlert: number;
  tallyProgress: number;
  banner: string;
  stance: "潜行" | "行走" | "奔跑";
  dialogue: DialogueState | null;
  ending: boolean;
  soundOn: boolean;
  quality: "high" | "low";
}

interface Obstacle {
  x: number;
  z: number;
  hx: number;
  hz: number;
  occludes?: boolean;
  active?: () => boolean;
}

interface EunuchAgent {
  group: THREE.Group;
  cone: THREE.Mesh;
  config: NpcConfig;
  route: THREE.Vector3[];
  routeIndex: number;
  routeDirection: 1 | -1;
  suspicion: number;
  state: "patrol" | "suspicious" | "caught" | "distracted";
  speed: number;
}

const PHASE_COPY: Record<MissionPhase, { chapter: string; objective: string }> = {
  reach_ruji: { chapter: "第一幕 · 帘影寻人", objective: "避开内侍，穿过屏风迷宫找到如姬" },
  steal_tally: { chapter: "第二幕 · 无声盗符", objective: "进入内廷，勿惊醒大王，取走案上虎符" },
  deliver_tally: { chapter: "第三幕 · 暗角交符", objective: "从侧门返回大厅，将虎符交给接应将军" },
  complete: { chapter: "终幕 · 救赵", objective: "虎符已交，魏军将启" },
};

const INITIAL_UI: UiState = {
  started: false,
  paused: false,
  phase: "reach_ruji",
  ...PHASE_COPY.reach_ruji,
  prompt: "",
  suspicion: 0,
  sleepAlert: 0,
  tallyProgress: 0,
  banner: "",
  stance: "行走",
  dialogue: null,
  ending: false,
  soundOn: true,
  quality: "high",
};

const COMMAND_EVENT = "tally-game-command";

function emitCommand(command: string) {
  window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: command }));
}

function createLabel(text: string, color = "#f3d58a") {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(3.45, 1, 1);
  sprite.position.y = 3.7;
  return sprite;
}

function createPuppet(
  main: number,
  accent: number,
  label?: string,
  scale = 1,
) {
  const group = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({
    color: main,
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent,
    roughness: 0.48,
    metalness: 0.16,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x100d0c, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.35, 0.28), mainMat);
  torso.position.y = 1.55;
  torso.castShadow = true;
  group.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.34), accentMat);
  belt.position.y = 1.1;
  belt.castShadow = true;
  group.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.39, 18, 12), mainMat);
  head.scale.z = 0.55;
  head.position.y = 2.55;
  head.castShadow = true;
  group.add(head);

  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.18, 0.42), darkMat);
  hat.position.y = 2.94;
  hat.castShadow = true;
  group.add(hat);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const armGeo = new THREE.BoxGeometry(0.25, 1.12, 0.22);
  const armL = new THREE.Mesh(armGeo, mainMat);
  const armR = new THREE.Mesh(armGeo, mainMat);
  armL.position.y = -0.46;
  armR.position.y = -0.46;
  leftArm.position.set(-0.68, 2.05, 0);
  rightArm.position.set(0.68, 2.05, 0);
  leftArm.add(armL);
  rightArm.add(armR);
  group.add(leftArm, rightArm);

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(0.32, 1.08, 0.3);
  const legL = new THREE.Mesh(legGeo, darkMat);
  const legR = new THREE.Mesh(legGeo, darkMat);
  legL.position.y = -0.46;
  legR.position.y = -0.46;
  leftLeg.position.set(-0.28, 0.78, 0);
  rightLeg.position.set(0.28, 0.78, 0);
  leftLeg.add(legL);
  rightLeg.add(legR);
  group.add(leftLeg, rightLeg);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.15, 20), accentMat);
  base.position.y = 0.1;
  base.receiveShadow = true;
  group.add(base);

  if (label) group.add(createLabel(label));
  group.scale.setScalar(scale);
  group.userData.rig = { leftArm, rightArm, leftLeg, rightLeg, torso, head };
  return group;
}

function createVisionCone(distance: number, angle: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const segments = 24;
  for (let i = 0; i <= segments; i += 1) {
    const theta = -angle / 2 + (i / segments) * angle;
    shape.lineTo(Math.sin(theta) * distance, Math.cos(theta) * distance);
  }
  shape.lineTo(0, 0);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xd8a14b,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.y = 0.08;
  return cone;
}

function segmentHitsBox(a: THREE.Vector3, b: THREE.Vector3, box: Obstacle) {
  if (box.active && !box.active()) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let tMin = 0;
  let tMax = 1;
  for (const [start, delta, min, max] of [
    [a.x, dx, box.x - box.hx, box.x + box.hx],
    [a.z, dz, box.z - box.hz, box.z + box.hz],
  ] as [number, number, number, number][]) {
    if (Math.abs(delta) < 0.0001) {
      if (start < min || start > max) return false;
    } else {
      const inv = 1 / delta;
      let t1 = (min - start) * inv;
      let t2 = (max - start) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

export default function GameExperience() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ui, setUi] = useState<UiState>(INITIAL_UI);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070909);
    scene.fog = new THREE.FogExp2(0x080908, 0.021);

    const camera = new THREE.PerspectiveCamera(43, mount.clientWidth / mount.clientHeight, 0.1, 150);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xb88d58, 0x111718, 1.05);
    scene.add(ambient);
    const moon = new THREE.DirectionalLight(0x89a9bd, 2.1);
    moon.position.set(-15, 24, -12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -30;
    moon.shadow.camera.right = 30;
    moon.shadow.camera.top = 45;
    moon.shadow.camera.bottom = -25;
    scene.add(moon);

    const mission: MissionState = {
      phase: "reach_ruji",
      hasInnerToken: false,
      hasTigerTally: false,
      checkpointId: "entrance",
    };
    let started = false;
    let paused = false;
    let ending = false;
    let soundOn = true;
    let quality: "high" | "low" = "high";
    let dialogue: DialogueState | null = null;
    let banner = "";
    let bannerUntil = 0;
    let prompt = "";
    let sleepAlert = 0;
    let tallyProgress = 0;
    let cameraScale = 1;
    let lastUiUpdate = 0;
    let lastAlertTone = 0;
    let footstepTravel = 0;
    let audioContext: AudioContext | null = null;
    const keys = new Set<string>();
    const obstacles: Obstacle[] = [];
    const clock = new THREE.Clock();

    const playTone = (frequency: number, duration = 0.1, gain = 0.025, type: OscillatorType = "sine") => {
      if (!soundOn) return;
      audioContext ??= new AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();
      const osc = audioContext.createOscillator();
      const amp = audioContext.createGain();
      osc.frequency.value = frequency;
      osc.type = type;
      amp.gain.setValueAtTime(gain, audioContext.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      osc.connect(amp).connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    };

    const playFootstep = (metalFactor: number, crouching: boolean, running: boolean) => {
      if (!soundOn) return;
      audioContext ??= new AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();

      const now = audioContext.currentTime;
      const duration = crouching ? 0.055 : running ? 0.105 : 0.08;
      const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        const decay = 1 - index / samples.length;
        samples[index] = (Math.random() * 2 - 1) * decay * decay;
      }

      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const amp = audioContext.createGain();
      const baseGain = crouching ? 0.012 : running ? 0.055 : 0.03;
      const metalBoost = 1 + metalFactor * 2.2;
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = crouching ? 380 : running ? 920 : 650;
      amp.gain.setValueAtTime(baseGain * metalBoost, now);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(amp).connect(audioContext.destination);
      source.start(now);

      const thud = audioContext.createOscillator();
      const thudAmp = audioContext.createGain();
      thud.type = "sine";
      thud.frequency.setValueAtTime(running ? 88 : 72, now);
      thud.frequency.exponentialRampToValueAtTime(48, now + duration);
      thudAmp.gain.setValueAtTime(baseGain * 0.45 * metalBoost, now);
      thudAmp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      thud.connect(thudAmp).connect(audioContext.destination);
      thud.start(now);
      thud.stop(now + duration);

      if (metalFactor > 0.08) {
        const ring = audioContext.createOscillator();
        const ringAmp = audioContext.createGain();
        ring.type = "triangle";
        ring.frequency.value = 480 + metalFactor * 190;
        ringAmp.gain.setValueAtTime(0.012 * metalFactor, now);
        ringAmp.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        ring.connect(ringAmp).connect(audioContext.destination);
        ring.start(now);
        ring.stop(now + 0.12);
      }
    };

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x171818, roughness: 0.92, metalness: 0.02 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x8f5f24, roughness: 0.55, metalness: 0.18 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3b1716, roughness: 0.82 });
    const screenMat = new THREE.MeshStandardMaterial({ color: 0xb79b70, roughness: 0.92, side: THREE.DoubleSide });
    const inkMat = new THREE.MeshStandardMaterial({ color: 0x201d19, roughness: 0.9 });

    const makeStage = (x: number, z: number, w: number, d: number) => {
      const stage = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), floorMat);
      stage.position.set(x, -0.28, z);
      stage.receiveShadow = true;
      scene.add(stage);
      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.57, d)),
        new THREE.LineBasicMaterial({ color: 0x9f6d2b, transparent: true, opacity: 0.65 }),
      );
      border.position.copy(stage.position);
      scene.add(border);
    };
    makeStage(0, -2, 30, 34);
    makeStage(0, 26, 22, 22);

    const addBox = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      material: THREE.Material,
      collide = true,
      occludes = true,
      active?: () => boolean,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      if (collide) obstacles.push({ x, z, hx: w / 2, hz: d / 2, occludes, active });
      return mesh;
    };

    addBox(-15.2, 1.6, -2, 0.6, 3.2, 34, woodMat);
    addBox(15.2, 1.6, -2, 0.6, 3.2, 34, woodMat);
    addBox(0, 1.6, -19.2, 30, 3.2, 0.6, woodMat);
    addBox(-11.2, 1.6, 26, 0.6, 3.2, 22, woodMat);
    addBox(11.2, 1.6, 26, 0.6, 3.2, 22, woodMat);
    addBox(0, 1.6, 37.2, 22, 3.2, 0.6, woodMat);
    addBox(-14, 1.6, 15, 2, 3.2, 0.7, woodMat);
    addBox(-5.5, 1.6, 15, 7, 3.2, 0.7, woodMat);
    addBox(8.5, 1.6, 15, 13, 3.2, 0.7, woodMat);

    const mainDoor = addBox(
      0,
      1.55,
      15,
      4,
      3.1,
      0.42,
      edgeMat,
      true,
      true,
      () => !mission.hasInnerToken,
    );
    const sideDoor = addBox(
      -11,
      1.55,
      15,
      4,
      3.1,
      0.42,
      edgeMat,
      true,
      true,
      () => !mission.hasTigerTally,
    );

    const screens: THREE.Mesh[] = [];
    const addScreen = (x: number, z: number, w: number, d: number) => {
      const panel = addBox(x, 1.35, z, w, 2.7, d, screenMat, true, true);
      screens.push(panel);
      const ink = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.09, d + 0.015), inkMat);
      ink.position.set(x, 1.32, z);
      ink.rotation.x = Math.PI / 2;
      scene.add(ink);
      return panel;
    };
    addScreen(-5.5, -12, 8, 0.42);
    addScreen(7.5, -8.5, 9, 0.42);
    addScreen(-5.5, -4.5, 0.42, 9);
    addScreen(5.5, -0.5, 0.42, 8);
    addScreen(-0.5, 4, 10, 0.42);
    addScreen(9.5, 7.2, 0.42, 7.5);
    addScreen(-6, 10.5, 9, 0.42);

    for (const [x, z] of [
      [-12, -15], [12, -15], [-12, 12], [12, 12], [-8, 34], [8, 34],
    ]) {
      addBox(x, 1.9, z, 0.75, 3.8, 0.75, edgeMat);
      const lantern = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.72, 12),
        new THREE.MeshStandardMaterial({ color: 0xd0923d, emissive: 0x6b2609, emissiveIntensity: 1.9 }),
      );
      lantern.position.set(x, 3.15, z);
      scene.add(lantern);
      const light = new THREE.PointLight(0xff9b45, 12, 10, 2);
      light.position.set(x, 3.1, z);
      scene.add(light);
    }

    const bed = addBox(5.5, 0.6, 30.5, 6.4, 1.2, 3.8, woodMat);
    const bedding = addBox(5.5, 1.24, 30.5, 5.8, 0.18, 3.2,
      new THREE.MeshStandardMaterial({ color: 0x6b2020, roughness: 0.78 }), false);
    bed.userData.decor = bedding;
    const table = addBox(1.2, 0.7, 30.2, 1.8, 1.4, 1.6, woodMat);
    table.userData.role = "tally-table";

    const tallyGroup = new THREE.Group();
    const tallyMat = new THREE.MeshStandardMaterial({ color: 0xd5a542, metalness: 0.72, roughness: 0.28, emissive: 0x5a2d05, emissiveIntensity: 0.45 });
    for (const offset of [-0.23, 0.23]) {
      const half = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.92), tallyMat);
      half.position.x = offset;
      half.rotation.y = offset * 0.45;
      half.castShadow = true;
      tallyGroup.add(half);
    }
    tallyGroup.position.set(1.2, 1.55, 30.2);
    scene.add(tallyGroup);
    const tallyLight = new THREE.PointLight(0xf4bd54, 4, 4);
    tallyLight.position.set(1.2, 2.2, 30.2);
    scene.add(tallyLight);

    const noiseProps: { position: THREE.Vector3; triggered: boolean; mesh: THREE.Object3D }[] = [];
    for (const [x, z] of [[-4, 22.5], [0.2, 25.2], [-3.2, 29.2]]) {
      const stand = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.08, 10, 20), tallyMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.55;
      stand.add(ring);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.4, 8), edgeMat);
      post.position.y = 0.6;
      stand.add(post);
      stand.position.set(x, 0, z);
      scene.add(stand);
      noiseProps.push({ position: new THREE.Vector3(x, 0, z), triggered: false, mesh: stand });
      obstacles.push({ x, z, hx: 0.55, hz: 0.55, occludes: false });
    }

    const player = createPuppet(0x214a45, 0xc79a45, undefined, 0.78);
    player.position.set(0, 0, -16);
    player.rotation.y = 0;
    scene.add(player);

    const ruji = createPuppet(0x7d303d, 0xd3a85b, "如姬", 0.86);
    ruji.position.set(11.5, 0, 11.3);
    ruji.rotation.y = -Math.PI / 2;
    scene.add(ruji);

    const king = createPuppet(0x8d3429, 0xd6aa43, "大王 · 熟睡", 0.9);
    king.position.set(5.5, 1.2, 30.5);
    king.rotation.z = -Math.PI / 2;
    king.rotation.y = Math.PI / 2;
    scene.add(king);

    const general = createPuppet(0x242d34, 0xc09445, "接应将军", 0.9);
    general.position.set(-12, 0, -15.7);
    general.rotation.y = Math.PI / 2;
    scene.add(general);

    const eunuchConfigs: NpcConfig[] = [
      { id: "eunuch-west", kind: "eunuch", patrolPath: [[-11, 0, -15], [-11, 0, -5], [-7, 0, -5], [-7, 0, -15]], viewDistance: 7.4, viewAngle: 1.18 },
      { id: "eunuch-east", kind: "eunuch", patrolPath: [[12.8, 0, -13], [12.8, 0, -6], [7, 0, -6], [7, 0, -3], [12.8, 0, -3]], viewDistance: 7.8, viewAngle: 1.16 },
      { id: "eunuch-north", kind: "eunuch", patrolPath: [[-3, 0, 6], [7, 0, 6], [7, 0, 12], [-3, 0, 12]], viewDistance: 7, viewAngle: 1.12 },
    ];

    const eunuchs: EunuchAgent[] = eunuchConfigs.map((config, index) => {
      const puppet = createPuppet(0x24343b, 0x7d9b96, undefined, 0.72);
      const route = config.patrolPath!.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      puppet.position.copy(route[0]);
      scene.add(puppet);
      const cone = createVisionCone(config.viewDistance!, config.viewAngle!);
      scene.add(cone);
      return {
        group: puppet,
        cone,
        config,
        route,
        routeIndex: 1,
        routeDirection: 1,
        suspicion: 0,
        state: "patrol",
        speed: 1.55 + index * 0.08,
      };
    });

    const updateDoorVisuals = () => {
      mainDoor.visible = !mission.hasInnerToken;
      sideDoor.visible = !mission.hasTigerTally;
      tallyGroup.visible = !mission.hasTigerTally;
      tallyLight.visible = !mission.hasTigerTally;
    };

    const showBanner = (message: string, seconds = 2.8) => {
      banner = message;
      bannerUntil = clock.elapsedTime + seconds;
    };

    const setPlayerAtCheckpoint = () => {
      if (mission.checkpointId === "entrance") player.position.set(0, 0, -16);
      if (mission.checkpointId === "inner_court") player.position.set(0, 0, 18.2);
      if (mission.checkpointId === "tally_acquired") player.position.set(-10.8, 0, 18.2);
      player.rotation.y = 0;
    };

    const resetAgents = () => {
      eunuchs.forEach((agent) => {
        agent.group.position.copy(agent.route[0]);
        agent.routeIndex = 1;
        agent.routeDirection = 1;
        agent.suspicion = 0;
        agent.state = agent.config.id === "eunuch-north" && mission.phase !== "reach_ruji" ? "distracted" : "patrol";
      });
    };

    const resetCheckpoint = (reason: string) => {
      playTone(92, 0.38, 0.05, "sawtooth");
      setPlayerAtCheckpoint();
      sleepAlert = 0;
      tallyProgress = 0;
      footstepTravel = 0;
      noiseProps.forEach((prop) => { prop.triggered = false; });
      resetAgents();
      showBanner(reason, 3.4);
    };

    const completeDialogue = () => {
      if (!dialogue) return;
      const action = dialogue.action;
      dialogue = null;
      if (action === "ruji" && mission.phase === "reach_ruji") {
        mission.phase = "steal_tally";
        mission.hasInnerToken = true;
        mission.checkpointId = "inner_court";
        updateDoorVisuals();
        eunuchs[2].state = "distracted";
        playTone(523, 0.16, 0.03);
        window.setTimeout(() => playTone(659, 0.22, 0.025), 120);
        showBanner("如姬已引开近侍 · 内廷门开启", 4);
      }
      if (action === "general" && mission.phase === "deliver_tally") {
        mission.phase = "complete";
        mission.checkpointId = "tally_acquired";
        ending = true;
        playTone(196, 0.35, 0.04, "triangle");
        window.setTimeout(() => playTone(294, 0.5, 0.035, "triangle"), 220);
      }
    };

    const distanceXZ = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);
    const tallyPosition = new THREE.Vector3(1.2, 0, 30.2);

    const metalProximity = () => {
      let nearest = distanceXZ(player.position, tallyPosition);
      for (const prop of noiseProps) nearest = Math.min(nearest, distanceXZ(player.position, prop.position));
      return THREE.MathUtils.clamp(1 - nearest / 4.5, 0, 1);
    };

    const tryInteract = () => {
      if (dialogue) {
        completeDialogue();
        return;
      }
      if (mission.phase === "reach_ruji" && distanceXZ(player.position, ruji.position) < 2.4) {
        dialogue = {
          speaker: "如姬",
          title: "宫灯之下",
          body: "公子有恩于我父。持此令牌入内廷，我会引开近侍。大王浅眠——到了寝殿，脚步务必比灯影更轻。",
          action: "ruji",
        };
        playTone(440, 0.14, 0.02);
        return;
      }
      if (!mission.hasInnerToken && Math.abs(player.position.z - 15) < 2.2 && Math.abs(player.position.x) < 3) {
        showBanner("内廷门紧锁 · 先找到如姬", 2.4);
        return;
      }
      if (distanceXZ(player.position, general.position) < 2.6) {
        if (!mission.hasTigerTally) {
          dialogue = { speaker: "接应将军", title: "暗角低语", body: "虎符未至，三军不可妄动。速去，莫让宫灯照见你的影子。", action: "dismiss" };
        } else if (mission.phase === "deliver_tally") {
          dialogue = { speaker: "接应将军", title: "虎符合契", body: "两半相合，兵权为证。今夜之后，魏军东出，邯郸之围可解。", action: "general" };
        }
      }
    };

    const noiseEvents: NoiseEvent[] = [];
    const emitNoise = (intensity: number, source: NoiseEvent["source"]) => {
      noiseEvents.push({ position: [player.position.x, 0, player.position.z], intensity, source });
    };

    const playerCollides = (x: number, z: number) => {
      const radius = 0.48;
      if (x < -14.45 || x > 14.45 || z < -18.45 || z > 36.45) return true;
      if (z > 15.2 && (x < -10.45 || x > 10.45)) return true;
      return obstacles.some((box) => {
        if (box.active && !box.active()) return false;
        return Math.abs(x - box.x) < box.hx + radius && Math.abs(z - box.z) < box.hz + radius;
      });
    };

    const npcCollides = (x: number, z: number) => {
      const radius = 0.46;
      if (x < -14.45 || x > 14.45 || z < -18.45 || z > 36.45) return true;
      if (z > 15.2 && (x < -10.45 || x > 10.45)) return true;
      return obstacles.some((box) => {
        if (box.active && !box.active()) return false;
        return Math.abs(x - box.x) < box.hx + radius && Math.abs(z - box.z) < box.hz + radius;
      });
    };

    const animatePuppet = (puppet: THREE.Group, time: number, moving: boolean, crouching = false) => {
      const rig = puppet.userData.rig as Record<string, THREE.Object3D>;
      const swing = moving ? Math.sin(time * 9) * 0.55 : Math.sin(time * 2) * 0.04;
      rig.leftArm.rotation.x = swing;
      rig.rightArm.rotation.x = -swing;
      rig.leftLeg.rotation.x = -swing * 0.7;
      rig.rightLeg.rotation.x = swing * 0.7;
      rig.torso.rotation.z = moving ? Math.sin(time * 9) * 0.025 : 0;
      rig.head.rotation.y = Math.sin(time * 1.4) * 0.05;
      puppet.scale.y = crouching ? 0.64 : THREE.MathUtils.lerp(puppet.scale.y, 0.78, 0.18);
    };

    const updatePlayer = (dt: number, time: number) => {
      const canMove = started && !paused && !dialogue && !ending;
      const input = new THREE.Vector3();
      if (canMove) {
        const forwardAxis = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
        const strafeAxis = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
        const cameraForward = new THREE.Vector3();
        camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();
        const cameraRight = new THREE.Vector3().crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();
        input.addScaledVector(cameraForward, forwardAxis).addScaledVector(cameraRight, strafeAxis);
      }
      const crouching = keys.has("ControlLeft") || keys.has("ControlRight");
      const running = !crouching && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
      const speed = crouching ? 2 : running ? 6.4 : 3.75;
      const moving = input.lengthSq() > 0;
      if (moving) {
        input.normalize();
        const previousX = player.position.x;
        const previousZ = player.position.z;
        const nextX = player.position.x + input.x * speed * dt;
        const nextZ = player.position.z + input.z * speed * dt;
        if (!playerCollides(nextX, player.position.z)) player.position.x = nextX;
        if (!playerCollides(player.position.x, nextZ)) player.position.z = nextZ;
        player.rotation.y = Math.atan2(input.x, input.z);
        const traveled = Math.hypot(player.position.x - previousX, player.position.z - previousZ);
        if (traveled > 0) {
          const metalFactor = metalProximity();
          footstepTravel += traveled;
          const stepDistance = crouching ? 0.72 : running ? 0.88 : 0.62;
          if (footstepTravel >= stepDistance) {
            footstepTravel %= stepDistance;
            playFootstep(metalFactor, crouching, running);
          }
        }
        if (traveled > 0 && mission.phase === "steal_tally" && player.position.z > 15.4) {
          const metalBoost = 1 + metalProximity() * 1.5;
          emitNoise((crouching ? 0.1 : running ? 0.85 : 0.34) * metalBoost, running ? "run" : "walk");
        }
      } else {
        footstepTravel = 0;
      }
      animatePuppet(player, time, moving, crouching);
      return { moving, crouching, running };
    };

    const updateEunuchs = (dt: number, time: number) => {
      let maxSuspicion = 0;
      const detectionActive = mission.phase === "reach_ruji" || mission.phase === "deliver_tally";
      for (const agent of eunuchs) {
        const distracted = agent.state === "distracted" || (agent.config.id === "eunuch-north" && mission.phase !== "reach_ruji");
        agent.group.visible = !distracted;
        agent.cone.visible = detectionActive && !distracted;
        if (distracted || !detectionActive) {
          agent.suspicion = Math.max(0, agent.suspicion - dt * 1.5);
          continue;
        }
        const target = agent.route[agent.routeIndex];
        const toTarget = target.clone().sub(agent.group.position);
        toTarget.y = 0;
        if (toTarget.length() < 0.22) {
          agent.routeIndex = (agent.routeIndex + agent.routeDirection + agent.route.length) % agent.route.length;
        } else {
          toTarget.normalize();
          const nextX = agent.group.position.x + toTarget.x * agent.speed * dt;
          const nextZ = agent.group.position.z + toTarget.z * agent.speed * dt;
          if (npcCollides(nextX, nextZ)) {
            agent.routeDirection = agent.routeDirection === 1 ? -1 : 1;
            agent.routeIndex = (agent.routeIndex + agent.routeDirection + agent.route.length) % agent.route.length;
            agent.group.rotation.y += Math.PI;
          } else {
            agent.group.position.set(nextX, agent.group.position.y, nextZ);
            agent.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
          }
        }
        animatePuppet(agent.group, time + agent.routeIndex, true);
        agent.cone.position.set(agent.group.position.x, 0.08, agent.group.position.z);
        agent.cone.rotation.y = agent.group.rotation.y;

        const toPlayer = player.position.clone().sub(agent.group.position);
        toPlayer.y = 0;
        const distance = toPlayer.length();
        const forward = new THREE.Vector3(Math.sin(agent.group.rotation.y), 0, Math.cos(agent.group.rotation.y));
        const angleOk = distance > 0 && forward.dot(toPlayer.clone().normalize()) > Math.cos(agent.config.viewAngle! / 2);
        const blocked = obstacles.some((box) => box.occludes !== false && segmentHitsBox(agent.group.position, player.position, box));
        const seesPlayer = distance < agent.config.viewDistance! && angleOk && !blocked;

        if (seesPlayer) {
          agent.state = "suspicious";
          agent.suspicion = Math.min(1, agent.suspicion + dt / 0.8);
          (agent.cone.material as THREE.MeshBasicMaterial).color.setHex(0xe64f33);
          (agent.cone.material as THREE.MeshBasicMaterial).opacity = 0.28;
          if (time - lastAlertTone > 0.38) {
            playTone(170 + agent.suspicion * 180, 0.08, 0.018, "square");
            lastAlertTone = time;
          }
        } else {
          agent.state = "patrol";
          agent.suspicion = Math.max(0, agent.suspicion - dt / 1.15);
          (agent.cone.material as THREE.MeshBasicMaterial).color.setHex(0xd8a14b);
          (agent.cone.material as THREE.MeshBasicMaterial).opacity = 0.16;
        }
        maxSuspicion = Math.max(maxSuspicion, agent.suspicion);
        if (agent.suspicion >= 1) {
          agent.state = "caught";
          resetCheckpoint("被内侍发现 · 已退回本段检查点");
          break;
        }
      }
      return maxSuspicion;
    };

    const updateNoise = (dt: number) => {
      if (mission.phase !== "steal_tally" || player.position.z < 15.2) {
        noiseEvents.length = 0;
        sleepAlert = Math.max(0, sleepAlert - dt * 0.2);
        return;
      }
      const kingPos = king.position;
      let total = 0;
      for (const event of noiseEvents) {
        const distance = Math.hypot(event.position[0] - kingPos.x, event.position[2] - kingPos.z);
        total += event.intensity * THREE.MathUtils.clamp(1 - distance / 10.5, 0, 1);
      }
      noiseEvents.length = 0;

      for (const prop of noiseProps) {
        const near = distanceXZ(player.position, prop.position) < 1.05;
        if (near && !prop.triggered) {
          prop.triggered = true;
          sleepAlert = Math.min(1, sleepAlert + 0.28);
          playTone(760, 0.34, 0.04, "triangle");
          showBanner("铜铃轻响 · 大王翻了个身", 2.1);
        }
        if (!near && distanceXZ(player.position, prop.position) > 1.55) prop.triggered = false;
      }

      sleepAlert = THREE.MathUtils.clamp(sleepAlert + total * dt * 0.72 - dt * 0.085, 0, 1);
      if (sleepAlert > 0.62 && clock.elapsedTime - lastAlertTone > 0.55) {
        playTone(115, 0.16, 0.025, "sine");
        lastAlertTone = clock.elapsedTime;
      }
      if (sleepAlert >= 1) resetCheckpoint("大王惊醒 · 已退回内廷入口");
    };

    const updateTally = (dt: number) => {
      if (mission.phase !== "steal_tally" || mission.hasTigerTally) return;
      const near = distanceXZ(player.position, tallyPosition) < 2.05;
      if (near && keys.has("KeyE") && !dialogue) {
        tallyProgress = Math.min(1, tallyProgress + dt / 1.15);
        emitNoise(0.24, "interaction");
        if (tallyProgress >= 1) {
          mission.hasTigerTally = true;
          mission.phase = "deliver_tally";
          mission.checkpointId = "tally_acquired";
          sleepAlert = 0;
          tallyProgress = 0;
          updateDoorVisuals();
          resetAgents();
          playTone(392, 0.12, 0.03);
          window.setTimeout(() => playTone(587, 0.25, 0.025), 100);
          showBanner("虎符入手 · 西侧暗门已经开启", 4);
        }
      } else {
        tallyProgress = Math.max(0, tallyProgress - dt * 1.8);
      }
    };

    const updatePrompt = () => {
      prompt = "";
      if (dialogue || ending) return;
      if (mission.phase === "reach_ruji" && distanceXZ(player.position, ruji.position) < 2.5) prompt = "E · 与如姬密谈";
      else if (mission.phase === "steal_tally" && distanceXZ(player.position, tallyPosition) < 2.2) prompt = `长按 E · 取走虎符${tallyProgress ? ` ${Math.round(tallyProgress * 100)}%` : ""}`;
      else if (distanceXZ(player.position, general.position) < 2.7) prompt = mission.hasTigerTally ? "E · 交付虎符" : "E · 与将军低语";
      else if (!mission.hasInnerToken && Math.abs(player.position.z - 15) < 2.1 && Math.abs(player.position.x) < 3) prompt = "E · 查看紧锁的内廷门";
    };

    const updateCamera = (dt: number) => {
      const offset = new THREE.Vector3(14 * cameraScale, 18 * cameraScale, -20 * cameraScale);
      const desired = player.position.clone().add(offset);
      const factor = 1 - Math.exp(-dt * 4.6);
      camera.position.lerp(desired, factor);
      const look = player.position.clone();
      look.y = 1.15;
      camera.lookAt(look);
    };

    const publishUi = (time: number, maxSuspicion: number, stance: UiState["stance"]) => {
      if (time - lastUiUpdate < 0.08) return;
      lastUiUpdate = time;
      const copy = PHASE_COPY[mission.phase];
      setUi({
        started,
        paused,
        phase: mission.phase,
        objective: copy.objective,
        chapter: copy.chapter,
        prompt,
        suspicion: maxSuspicion,
        sleepAlert,
        tallyProgress,
        banner: bannerUntil > time ? banner : "",
        stance,
        dialogue,
        ending,
        soundOn,
        quality,
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyE"].includes(event.code)) {
        event.preventDefault();
        keys.add(event.code);
      }
      if (event.code === "Escape" && started && !ending) {
        paused = !paused;
        keys.clear();
      }
      if (event.code === "KeyE" && !event.repeat && started && !paused) tryInteract();
      if ((event.code === "Enter" || event.code === "Space") && dialogue) completeDialogue();
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onWheel = (event: WheelEvent) => {
      cameraScale = THREE.MathUtils.clamp(cameraScale + Math.sign(event.deltaY) * 0.08, 0.82, 1.28);
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<string>).detail;
      if (command === "start") {
        started = true;
        paused = false;
        audioContext ??= new AudioContext();
        playTone(220, 0.14, 0.025, "triangle");
        window.setTimeout(() => playTone(330, 0.22, 0.02, "triangle"), 120);
        showBanner("宫门已闭 · 你的影子必须先找到如姬", 4.2);
      }
      if (command === "continue") paused = false;
      if (command === "dialogue") completeDialogue();
      if (command === "sound") soundOn = !soundOn;
      if (command === "quality") {
        quality = quality === "high" ? "low" : "high";
        renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio, 1.6) : 0.9);
        renderer.shadowMap.enabled = quality === "high";
      }
      if (command === "restart") {
        mission.phase = "reach_ruji";
        mission.hasInnerToken = false;
        mission.hasTigerTally = false;
        mission.checkpointId = "entrance";
        ending = false;
        paused = false;
        dialogue = null;
        updateDoorVisuals();
        resetCheckpoint("任务重新开始");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener(COMMAND_EVENT, onCommand);

    updateDoorVisuals();
    resetAgents();
    camera.position.set(14, 18, -36);
    camera.lookAt(0, 1, -14);

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      let maxSuspicion = 0;
      let stance: UiState["stance"] = "行走";
      if (!paused) {
        const movement = updatePlayer(dt, time);
        stance = movement.crouching ? "潜行" : movement.running ? "奔跑" : "行走";
        maxSuspicion = updateEunuchs(dt, time);
        updateNoise(dt);
        updateTally(dt);
        updatePrompt();
      }
      updateCamera(dt);
      ruji.position.y = Math.sin(time * 1.5) * 0.035;
      if (!ending) {
        const kingRig = king.userData.rig as Record<string, THREE.Object3D>;
        kingRig.torso.scale.y = 1 + Math.sin(time * 1.4) * 0.025;
      }
      tallyGroup.rotation.y = Math.sin(time * 1.2) * 0.12;
      renderer.render(scene, camera);
      publishUi(time, maxSuspicion, stance);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener(COMMAND_EVENT, onCommand);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      void audioContext?.close();
    };
  }, []);

  const phaseNumber = ui.phase === "reach_ruji" ? "壹" : ui.phase === "steal_tally" ? "贰" : ui.phase === "deliver_tally" ? "叁" : "终";

  return (
    <main className="game-shell">
      <div ref={mountRef} className="scene-mount" aria-label="窃符救赵三维潜行游戏" />

      <section className="sr-only" aria-label="任务流程">
        <h1>窃符救赵任务</h1>
        <ol>
          <li>避开内侍，穿过屏风迷宫找到如姬</li>
          <li>进入内廷，勿惊醒大王，盗取虎符</li>
          <li>从侧门返回大厅，将虎符交给接应将军</li>
        </ol>
        <p>完成全部任务后显示任务完成。</p>
      </section>

      <header className="game-hud" aria-live="polite">
        <div className="brand-lockup">
          <span className="seal">符</span>
          <div><strong>窃符救赵</strong><small>STEAL THE TALLY</small></div>
        </div>
        <div className="mission-copy">
          <span className="chapter-number">{phaseNumber}</span>
          <div><small>{ui.chapter}</small><strong>{ui.objective}</strong></div>
        </div>
        <div className="hud-actions">
          <button type="button" onClick={() => emitCommand("sound")}>{ui.soundOn ? "音效 · 开" : "音效 · 关"}</button>
          <button type="button" onClick={() => emitCommand("quality")}>光影 · {ui.quality === "high" ? "高" : "简"}</button>
        </div>
      </header>

      <aside className="status-rail">
        <div className={`meter-card ${ui.suspicion > 0.02 ? "is-active" : ""}`}>
          <div><span>◉ 内侍警觉</span><em>{ui.suspicion > 0.7 ? "危险" : ui.suspicion > 0.02 ? "可疑" : "隐蔽"}</em></div>
          <div className="meter"><i style={{ width: `${ui.suspicion * 100}%` }} /></div>
        </div>
        <div className={`meter-card sleep ${ui.phase === "steal_tally" ? "is-visible" : ""}`}>
          <div><span>◒ 大王睡意</span><em>{ui.sleepAlert > 0.68 ? "将醒" : "沉睡"}</em></div>
          <div className="meter"><i style={{ width: `${ui.sleepAlert * 100}%` }} /></div>
        </div>
        <span className="stance">步态 · {ui.stance}</span>
      </aside>

      {ui.banner && <div className="scene-banner">{ui.banner}</div>}
      {ui.prompt && <div className="interaction-prompt"><kbd>E</kbd><span>{ui.prompt.replace(/^E · |^长按 E · /, "")}</span></div>}

      {!ui.started && (
        <section className="intro-card">
          <div className="intro-veil" />
          <div className="intro-content">
            <p className="eyebrow">战国 · 魏宫夜行</p>
            <div className="intro-title"><span>窃</span><span>符</span><span>救</span><span>赵</span></div>
            <p className="intro-lead">宫门已闭，邯郸危在旦夕。<br />你是信陵君的门客，今夜只有一件事不可失手。</p>
            <button className="start-button" type="button" onClick={() => emitCommand("start")}><span>入宫</span><small>BEGIN THE MISSION</small></button>
            <div className="controls-strip"><span>WASD 移动</span><span>Shift 奔跑</span><span>Ctrl 蹲行</span><span>E 交互</span></div>
            <p className="adaptation">取材于“窃符救赵”的游戏化改编 · 非史实复原</p>
          </div>
        </section>
      )}

      {ui.dialogue && (
        <section className="dialogue-card" role="dialog" aria-modal="true" aria-labelledby="dialogue-title">
          <div className="speaker-stamp">{ui.dialogue.speaker.slice(0, 1)}</div>
          <div className="dialogue-copy">
            <small>{ui.dialogue.title}</small>
            <h2 id="dialogue-title">{ui.dialogue.speaker}</h2>
            <p>{ui.dialogue.body}</p>
            <button type="button" onClick={() => emitCommand("dialogue")}>继续 <kbd>Enter</kbd></button>
          </div>
        </section>
      )}

      {ui.paused && !ui.dialogue && (
        <section className="pause-card" role="dialog" aria-modal="true">
          <small>幕间</small><h2>任务暂停</h2>
          <button type="button" onClick={() => emitCommand("continue")}>继续潜行</button>
          <button className="secondary" type="button" onClick={() => emitCommand("restart")}>重新开始</button>
        </section>
      )}

      {ui.ending && (
        <section className="ending-card" aria-live="assertive">
          <div className="ending-curtain left" /><div className="ending-curtain right" />
          <div className="army-shadow" aria-hidden="true">♞　♟　♞　♟　♞　♟　♞</div>
          <div className="ending-content">
            <div className="tally-seal"><span>兵</span></div>
            <p className="eyebrow">THE TALLY IS JOINED</p>
            <h1>窃符救赵</h1>
            <p>两半虎符合契，宫门之外，三军将发。</p>
            <strong>任务完成</strong>
            <button type="button" onClick={() => emitCommand("restart")}>再演一局</button>
          </div>
        </section>
      )}

      <footer className="game-footer"><span>ESC 暂停</span><span>鼠标滚轮 · 调整镜头</span><span>屏风可遮挡内侍视线</span></footer>
    </main>
  );
}
