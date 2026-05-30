import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, pickTarget, stepToward } from '../renderer/movement';

const bounds = { width: 800, height: 600 };
const pet = { width: 64, height: 64 };

test('clamp keeps the pet fully within bounds', () => {
  assert.deepEqual(clamp({ x: -10, y: -10 }, bounds, pet), { x: 0, y: 0 });
  assert.deepEqual(clamp({ x: 1000, y: 1000 }, bounds, pet), { x: 736, y: 536 });
  assert.deepEqual(clamp({ x: 100, y: 120 }, bounds, pet), { x: 100, y: 120 });
});

test('pickTarget stays within bounds for rng extremes', () => {
  assert.deepEqual(pickTarget(bounds, pet, () => 0), { x: 0, y: 0 });
  assert.deepEqual(pickTarget(bounds, pet, () => 1), { x: 736, y: 536 });
});

test('stepToward moves toward target and reports arrival', () => {
  const far = stepToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 4);
  assert.equal(far.arrived, false);
  assert.deepEqual(far.pos, { x: 4, y: 0 });

  const near = stepToward({ x: 0, y: 0 }, { x: 3, y: 0 }, 4);
  assert.equal(near.arrived, true);
  assert.deepEqual(near.pos, { x: 3, y: 0 });
});

test('stepToward arrives exactly when already at target', () => {
  const here = stepToward({ x: 5, y: 5 }, { x: 5, y: 5 }, 4);
  assert.equal(here.arrived, true);
  assert.deepEqual(here.pos, { x: 5, y: 5 });
});
