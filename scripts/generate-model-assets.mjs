import { mkdir, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

globalThis.FileReader ??= class FileReader {
  result = null;
  onloadend = null;
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
  async readAsDataURL(blob) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    this.result = `data:${blob.type};base64,${bytes.toString("base64")}`;
    this.onloadend?.();
  }
};

const scene = new THREE.Scene();
scene.name = "PalacePuppetAsset";
const root = new THREE.Group();
root.name = "Puppet";
scene.add(root);

const mats = {
  Main: new THREE.MeshStandardMaterial({ name: "Main", color: 0x4a3430, roughness: 0.72 }),
  Accent: new THREE.MeshStandardMaterial({ name: "Accent", color: 0xc79a45, roughness: 0.42, metalness: 0.15 }),
  Skin: new THREE.MeshStandardMaterial({ name: "Skin", color: 0xd3ad88, roughness: 0.82 }),
  Dark: new THREE.MeshStandardMaterial({ name: "Dark", color: 0x120d0b, roughness: 0.8 }),
};

function mesh(name, geometry, material, position, parent = root) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.position.set(...position);
  result.castShadow = true;
  parent.add(result);
  return result;
}

const torso = mesh("Torso", new THREE.BoxGeometry(1.05, 1.35, 0.3), mats.Main, [0, 1.55, 0]);
mesh("Belt", new THREE.BoxGeometry(1.15, 0.18, 0.36), mats.Accent, [0, 1.1, 0]);
const skirt = mesh("Skirt", new THREE.ConeGeometry(0.75, 1.18, 10, 2, true), mats.Main, [0, 0.68, 0]);
skirt.rotation.y = Math.PI / 10;
const head = mesh("Head", new THREE.SphereGeometry(0.39, 20, 14), mats.Skin, [0, 2.55, 0]);
head.scale.z = 0.55;
mesh("Hat", new THREE.BoxGeometry(0.86, 0.18, 0.42), mats.Dark, [0, 2.94, 0]);
mesh("Crown", new THREE.CylinderGeometry(0.13, 0.2, 0.46, 10), mats.Accent, [0, 3.2, 0]);
mesh("Pendant", new THREE.OctahedronGeometry(0.11), mats.Accent, [0, 0.86, -0.25]);

for (const x of [-0.14, 0.14]) mesh(`Eye${x}`, new THREE.SphereGeometry(0.034, 8, 6), mats.Dark, [x, 2.61, -0.215]);

const leftArm = new THREE.Group();
const rightArm = new THREE.Group();
leftArm.name = "LeftArm";
rightArm.name = "RightArm";
leftArm.position.set(-0.68, 2.05, 0);
rightArm.position.set(0.68, 2.05, 0);
mesh("LeftArmMesh", new THREE.BoxGeometry(0.25, 1.12, 0.24), mats.Main, [0, -0.46, 0], leftArm);
mesh("RightArmMesh", new THREE.BoxGeometry(0.25, 1.12, 0.24), mats.Main, [0, -0.46, 0], rightArm);
const sleeveGeometry = new THREE.ConeGeometry(0.36, 0.78, 10, 2, true);
const leftSleeve = mesh("LeftSleeve", sleeveGeometry, mats.Main, [0, -0.64, 0], leftArm);
const rightSleeve = mesh("RightSleeve", sleeveGeometry, mats.Main, [0, -0.64, 0], rightArm);
leftSleeve.rotation.z = rightSleeve.rotation.z = Math.PI;
root.add(leftArm, rightArm);

const leftLeg = new THREE.Group();
const rightLeg = new THREE.Group();
leftLeg.name = "LeftLeg";
rightLeg.name = "RightLeg";
leftLeg.position.set(-0.28, 0.78, 0);
rightLeg.position.set(0.28, 0.78, 0);
mesh("LeftLegMesh", new THREE.BoxGeometry(0.3, 1.08, 0.3), mats.Dark, [0, -0.46, 0], leftLeg);
mesh("RightLegMesh", new THREE.BoxGeometry(0.3, 1.08, 0.3), mats.Dark, [0, -0.46, 0], rightLeg);
mesh("LeftShoe", new THREE.BoxGeometry(0.36, 0.15, 0.55), mats.Dark, [0, -1.0, -0.11], leftLeg);
mesh("RightShoe", new THREE.BoxGeometry(0.36, 0.15, 0.55), mats.Dark, [0, -1.0, -0.11], rightLeg);
root.add(leftLeg, rightLeg);
mesh("Base", new THREE.CylinderGeometry(0.72, 0.82, 0.15, 20), mats.Accent, [0, 0.1, 0]);

const times = [0, 0.5, 1];
const quatValues = (axis, angles) => angles.flatMap((angle) => {
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  return [q.x, q.y, q.z, q.w];
});
const xAxis = new THREE.Vector3(1, 0, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const track = (node, angles, axis = xAxis) => new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, quatValues(axis, angles));
const positionTrack = (node, values) => new THREE.VectorKeyframeTrack(`${node}.position`, times, values);

const clips = [
  new THREE.AnimationClip("idle", 1, [positionTrack("Torso", [0, 1.55, 0, 0, 1.575, 0, 0, 1.55, 0])]),
  new THREE.AnimationClip("walk", 1, [track("LeftArm", [-0.42, 0.42, -0.42]), track("RightArm", [0.42, -0.42, 0.42]), track("LeftLeg", [0.34, -0.34, 0.34]), track("RightLeg", [-0.34, 0.34, -0.34])]),
  new THREE.AnimationClip("run", 1, [track("LeftArm", [-0.78, 0.78, -0.78]), track("RightArm", [0.78, -0.78, 0.78]), track("LeftLeg", [0.55, -0.55, 0.55]), track("RightLeg", [-0.55, 0.55, -0.55])]),
  new THREE.AnimationClip("crouch", 1, [positionTrack("Torso", [0, 1.25, 0, 0, 1.22, 0, 0, 1.25, 0]), track("LeftLeg", [0.22, 0.28, 0.22]), track("RightLeg", [0.22, 0.28, 0.22])]),
  new THREE.AnimationClip("interact", 1, [track("RightArm", [0, -1.2, 0], zAxis), track("LeftArm", [0, 0.45, 0], zAxis)]),
  new THREE.AnimationClip("sleep", 1, [positionTrack("Torso", [0, 1.55, 0, 0, 1.58, 0, 0, 1.55, 0]), track("LeftArm", [0.18, 0.23, 0.18]), track("RightArm", [-0.18, -0.23, -0.18])]),
  new THREE.AnimationClip("handoff", 1, [track("LeftArm", [0, 1.0, 0], zAxis), track("RightArm", [0, -1.0, 0], zAxis)]),
];

const exporter = new GLTFExporter();
const binary = await exporter.parseAsync(scene, { binary: true, animations: clips, onlyVisible: true });
const outputDir = new URL("../public/assets/models/", import.meta.url);
await mkdir(outputDir, { recursive: true });
await writeFile(new URL("palace-puppet.glb", outputDir), Buffer.from(binary));
console.log(`Generated palace-puppet.glb (${Buffer.byteLength(Buffer.from(binary))} bytes)`);
