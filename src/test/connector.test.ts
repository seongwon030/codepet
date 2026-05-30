import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { connectClaude, disconnectClaude, isClaudeConnected } from '../main/connector';

function tmpSettingsPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-conn-'));
  return path.join(dir, 'settings.json');
}

const userHooks = {
  hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo user-stop' }] }] },
  permissions: { allow: ['Bash'] },
};

test('connect adds marked hooks, preserves existing user config, backs up', () => {
  const sp = tmpSettingsPath();
  fs.writeFileSync(sp, JSON.stringify(userHooks));
  assert.equal(isClaudeConnected(sp), false);

  const r = connectClaude(38917, sp);
  assert.equal(r.ok, true);
  assert.equal(isClaudeConnected(sp), true);

  const json = JSON.parse(fs.readFileSync(sp, 'utf8'));
  // our entries present across the expected events
  assert.ok(JSON.stringify(json.hooks.UserPromptSubmit).includes('desktop-pet-hook'));
  assert.ok(JSON.stringify(json.hooks.PreToolUse).includes('"matcher"')); // tool events take a matcher
  // user's own Stop hook preserved (alongside ours)
  assert.ok(JSON.stringify(json.hooks.Stop).includes('echo user-stop'));
  // unrelated config untouched
  assert.deepEqual(json.permissions, { allow: ['Bash'] });
  // backup written
  assert.ok(fs.existsSync(`${sp}.desktop-pet-backup`));
});

test('disconnect removes only our hooks, keeps the user hooks', () => {
  const sp = tmpSettingsPath();
  fs.writeFileSync(sp, JSON.stringify(userHooks));
  connectClaude(38917, sp);

  const d = disconnectClaude(sp);
  assert.equal(d.ok, true);
  assert.equal(isClaudeConnected(sp), false);

  const json = JSON.parse(fs.readFileSync(sp, 'utf8'));
  assert.ok(JSON.stringify(json.hooks.Stop).includes('echo user-stop')); // user hook stays
  assert.ok(!JSON.stringify(json).includes('desktop-pet-hook')); // ours gone
  assert.equal(json.hooks.UserPromptSubmit, undefined); // event that was only ours removed
});

test('connect is idempotent (re-connect does not duplicate)', () => {
  const sp = tmpSettingsPath();
  connectClaude(38917, sp);
  connectClaude(38917, sp);
  const json = JSON.parse(fs.readFileSync(sp, 'utf8'));
  const occurrences = JSON.stringify(json.hooks.UserPromptSubmit).split('desktop-pet-hook').length - 1;
  assert.equal(occurrences, 1);
});
