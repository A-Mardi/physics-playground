import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import createPhysics from '../web/public/engine/physics.js';
const e = await createPhysics();
const data = () => {
  const start = e._world_data() / 4;
  return e.HEAPF32.slice(start, start + e._world_count() * 12);
};
const body = (id) => {
  const d = data();
  for (let i = 0; i < d.length; i += 12) if (d[i] === id) return d.slice(i, i + 12);
  throw Error('missing body');
};
e._world_reset();
const falling = e._body_add(0, 700, 100, 40, 40, 0, 0);
for (let i = 0; i < 120; i++) e._world_step(1 / 120);
assert.ok(body(falling)[3] > 400, 'gravity advances position');
for (let i = 0; i < 1000; i++) e._world_step(1 / 120);
assert.ok(Math.abs(body(falling)[3] - 820) < 2, 'circle rests on floor without sinking');
assert.ok(Math.abs(body(falling)[8]) < 5, 'resting body remains stable');
e._world_reset();
e._world_gravity(0, 0);
e._world_material(1, 0);
const a = e._body_add(0, 600, 400, 40, 40, 0, 0),
  b = e._body_add(0, 700, 400, 40, 40, 0, 0);
e._body_velocity(a, 100, 0, 0);
e._body_velocity(b, -100, 0, 0);
for (let i = 0; i < 60; i++) e._world_step(1 / 120);
assert.ok(
  body(a)[7] < 0 && body(b)[7] > 0,
  'equal disks exchange direction after elastic collision',
);
e._world_reset();
const fixed = e._body_add(1, 700, 400, 200, 20, 0.2, 1);
const box = e._body_add(1, 700, 100, 40, 40, 0, 0);
for (let i = 0; i < 2000; i++) e._world_step(1 / 120);
assert.equal(body(fixed)[3], 400, 'static obstacle is immovable');
assert.ok([...body(box)].every(Number.isFinite), 'rotated contacts keep finite state');
assert.ok(body(box)[3] < 850, 'box stays inside floor');
assert.equal(e._body_add(0, 0, 0, NaN, 20, 0, 0), -1, 'reject invalid dimensions');
e._world_reset();
for (let i = 0; i < 240; i++)
  e._body_add(i % 2, 35 + (i % 30) * 45, 40 + Math.floor(i / 30) * 50, 24, 24, 0, 0);
const start = performance.now();
for (let i = 0; i < 600; i++) e._world_step(1 / 120);
const elapsed = performance.now() - start;
assert.ok([...data()].every(Number.isFinite), 'stress simulation remains finite');
assert.ok(e._world_candidates() < (244 * 243) / 2, 'broadphase prunes candidate pairs');
console.log(
  JSON.stringify(
    {
      tests: 'passed',
      bodies: 240,
      steps: 600,
      elapsedMs: +elapsed.toFixed(2),
      averageStepMs: +(elapsed / 600).toFixed(3),
      candidatePairs: e._world_candidates(),
      allPairs: (244 * 243) / 2,
      runtime: process.version,
    },
    null,
    2,
  ),
);
