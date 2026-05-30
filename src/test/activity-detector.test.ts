import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityState } from '../shared/types';
import {
  isAgentProcess,
  detectRunning,
  computeState,
  ActivityDetector,
  DEFAULT_PATTERNS,
  type DetectorConfig,
  type ProcLike,
} from '../main/activity-detector';

const cfg: DetectorConfig = {
  patterns: DEFAULT_PATTERNS,
  excludeSubstrings: ['desktop-pet'],
  ignorePids: [999],
  sleepAfterMs: 1000,
};

test('isAgentProcess matches claude/codex by cmd, honors excludes', () => {
  assert.equal(isAgentProcess('node /usr/local/bin/claude code', DEFAULT_PATTERNS, ['desktop-pet']), true);
  assert.equal(isAgentProcess('node /opt/@anthropic-ai/claude-code/cli.js', DEFAULT_PATTERNS, ['desktop-pet']), true);
  assert.equal(isAgentProcess('/opt/homebrew/bin/codex', DEFAULT_PATTERNS, ['desktop-pet']), true);
  // our own app: excluded even though path contains 'claude'
  assert.equal(
    isAgentProcess('/Users/me/Desktop/desktop-pet/.bin/claude', DEFAULT_PATTERNS, ['desktop-pet']),
    false,
  );
  assert.equal(isAgentProcess('vim claudefile.txt', DEFAULT_PATTERNS, ['desktop-pet']), false);
  assert.equal(isAgentProcess('', DEFAULT_PATTERNS, ['desktop-pet']), false);
});

test('detectRunning ignores configured pids', () => {
  assert.equal(detectRunning([{ pid: 999, cmd: 'claude' }], cfg), false); // ignored pid
  assert.equal(detectRunning([{ pid: 1, cmd: 'claude code' }], cfg), true);
  assert.equal(detectRunning([{ pid: 1, cmd: 'bash -l' }], cfg), false);
});

test('computeState maps running/idle/sleeping', () => {
  assert.equal(computeState(true, 99999, 1000), 'running');
  assert.equal(computeState(false, 500, 1000), 'idle');
  assert.equal(computeState(false, 1000, 1000), 'sleeping');
});

test('detector emits initial state then transitions to sleeping', async () => {
  const emitted: ActivityState[] = [];
  let procs: ProcLike[] = [{ pid: 1, cmd: 'claude code' }];
  const d = new ActivityDetector(async () => procs, (s) => emitted.push(s), cfg, 0);
  assert.equal(await d.poll(0), 'running');
  procs = [];
  assert.equal(await d.poll(100), 'idle');
  assert.equal(await d.poll(2000), 'sleeping');
  assert.deepEqual(emitted, ['running', 'idle', 'sleeping']);
});

test('detector emits the first poll even when state is unchanged (idle)', async () => {
  const emitted: ActivityState[] = [];
  const d = new ActivityDetector(async () => [], (s) => emitted.push(s), cfg, 0);
  await d.poll(0); // no agent, within threshold -> idle, but first emit fires
  assert.deepEqual(emitted, ['idle']);
});
