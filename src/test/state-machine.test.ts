import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextState } from '../renderer/state-machine';

test('dragStart -> dragged from any state', () => {
  assert.equal(nextState('idle', { type: 'dragStart' }), 'dragged');
  assert.equal(nextState('working', { type: 'dragStart' }), 'dragged');
  assert.equal(nextState('sleeping', { type: 'dragStart' }), 'dragged');
});

test('dragEnd -> idle', () => {
  assert.equal(nextState('dragged', { type: 'dragEnd' }), 'idle');
});

test('activity working/running -> working (drag is not overridden)', () => {
  assert.equal(nextState('idle', { type: 'activity', state: 'working' }), 'working');
  assert.equal(nextState('idle', { type: 'activity', state: 'running' }), 'working');
  assert.equal(nextState('dragged', { type: 'activity', state: 'working' }), 'dragged');
});

test('activity idle resumes wandering but does not wake a sleeping pet', () => {
  assert.equal(nextState('working', { type: 'activity', state: 'idle' }), 'idle');
  assert.equal(nextState('sleeping', { type: 'activity', state: 'idle' }), 'sleeping');
});

test('wander only from idle; arrived only from walking', () => {
  assert.equal(nextState('idle', { type: 'wander' }), 'walking');
  assert.equal(nextState('working', { type: 'wander' }), 'working');
  assert.equal(nextState('walking', { type: 'arrived' }), 'idle');
  assert.equal(nextState('idle', { type: 'arrived' }), 'idle');
});

test('idleTimeout: idle -> sleeping only', () => {
  assert.equal(nextState('idle', { type: 'idleTimeout' }), 'sleeping');
  assert.equal(nextState('walking', { type: 'idleTimeout' }), 'walking');
});

test('activity tool/sleeping map through', () => {
  assert.equal(nextState('idle', { type: 'activity', state: 'tool' }), 'tool');
  assert.equal(nextState('working', { type: 'activity', state: 'sleeping' }), 'sleeping');
});
