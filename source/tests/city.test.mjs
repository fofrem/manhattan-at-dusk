import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load() {
  const ctx = vm.createContext({console, Math, Float32Array});
  for (const file of ['math.js', 'city-physics.js', 'world.js']) vm.runInContext(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), ctx);
  return vm.runInContext('({makeCity, moveCamera, taxiPosition, VIEWPOINTS})', ctx);
}

test('city is reproducible and buildings leave every avenue clear', () => {
  const {makeCity} = load(), a = makeCity(), b = makeCity();
  assert.deepEqual(a.instances, b.instances);
  assert.ok(a.buildings.length >= 60);
  for (const box of a.buildings) {
    assert.ok(box.maxY > 5);
    // Every road occupies +/- 9m along X or +/- 8m along Z.
    for (let n = -3; n <= 3; n++) {
      assert.ok(box.maxX <= n * 64 - 9 || box.minX >= n * 64 + 9);
      assert.ok(box.maxZ <= n * 86 - 8 || box.minZ >= n * 86 + 8);
    }
  }
});

test('camera stops at walls and slides along them, including a long movement', () => {
  const {moveCamera} = load();
  const boxes = [{minX: 2, maxX: 8, minY: 0, maxY: 25, minZ: -8, maxZ: 8}];
  const p = moveCamera([0, 3, 0], [30, 0, 4], boxes);
  assert.ok(p[0] < 1.6 && p[0] > 1.3);
  assert.ok(Math.abs(p[2] - 4) < 0.01);
  const above = moveCamera([0, 30, 0], [10, 0, 0], boxes);
  assert.ok(Math.abs(above[0] - 10) < 1e-9);
  assert.ok(moveCamera([0, 2, 0], [0, -20, 0], boxes)[1] >= 1.7);
});

test('all viewpoints are outside solid buildings', () => {
  const {makeCity, VIEWPOINTS} = load(), city = makeCity();
  for (const {position:p} of VIEWPOINTS) for (const b of city.buildings) {
    assert.ok(!(p[0] > b.minX - .55 && p[0] < b.maxX + .55 && p[1] < b.maxY + .55 && p[2] > b.minZ - .55 && p[2] < b.maxZ + .55));
  }
});

test('taxis move, remain in road lanes and pause between blocks', () => {
  const {makeCity, taxiPosition} = load(), city = makeCity();
  assert.ok(city.taxis.length >= 24);
  let moving = 0;
  for (const taxi of city.taxis) {
    const first = taxiPosition(taxi, 0), next = taxiPosition(taxi, 2);
    if (Math.hypot(first.x - next.x, first.z - next.z) > .1) moving++;
    assert.ok(Number.isFinite(next.x + next.z));
    const lane = taxi.axis === 0 ? next.x : next.z;
    assert.ok(Math.abs(lane - taxi.lane) < 0.001);
  }
  assert.ok(moving > 10);
  const stopped = {...city.taxis[0], phase:0, speed:1};
  assert.deepEqual(taxiPosition(stopped,10.5),taxiPosition(stopped,13.5));
});
