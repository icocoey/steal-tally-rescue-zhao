import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/GameExperience.tsx", import.meta.url), "utf8");

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
