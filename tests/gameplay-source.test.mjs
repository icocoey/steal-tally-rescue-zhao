import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/GameExperience.tsx", import.meta.url), "utf8");
const visuals = await readFile(new URL("../app/game/visuals.ts", import.meta.url), "utf8");
const pagesConfig = await readFile(new URL("../vite.pages.config.ts", import.meta.url), "utf8");

test("movement is camera-relative so A and D match screen direction", () => {
  assert.match(source, /cameraRight/);
  assert.match(source, /Number\(keys\.has\("KeyD"\)\) - Number\(keys\.has\("KeyA"\)\)/);
});

test("eunuchs predict collisions and reverse their patrol", () => {
  assert.match(source, /const npcCollides/);
  assert.match(source, /agent\.routeDirection = agent\.routeDirection === 1 \? -1 : 1/);
});

test("footsteps become louder and more resonant near metal", () => {
  assert.match(source, /const playFootstep/);
  assert.match(source, /const metalBoost = 1 \+ metalFactor \* 2\.2/);
  assert.match(source, /ring\.frequency\.value/);
});

test("GLB characters use named actions and keep a procedural fallback", () => {
  assert.match(visuals, /GLTFLoader/);
  assert.match(visuals, /SkeletonUtils\.clone/);
  assert.match(visuals, /new THREE\.AnimationMixer/);
  for (const action of ["idle", "walk", "run", "crouch", "interact", "sleep", "handoff"]) {
    assert.match(visuals, new RegExp(`"${action}"`));
  }
  assert.match(visuals, /using procedural puppet/);
});

test("cloth and candle effects support the quality switch", () => {
  assert.match(visuals, /class FlameLight/);
  assert.match(visuals, /uStrength/);
  assert.match(source, /updateClothPanels\(clothPanels, time, quality\)/);
  assert.match(source, /flame\.setQuality\(quality, index\)/);
});

test("GitHub Pages base follows the repository name", () => {
  assert.match(pagesConfig, /process\.env\.GITHUB_REPOSITORY/);
  assert.match(pagesConfig, /`\/\$\{repositoryName\}\/`/);
});
