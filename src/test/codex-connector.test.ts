import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  connectCodex,
  disconnectCodex,
  isCodexConnected,
  codexNotifyState,
} from '../main/codex-connector';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dp-codex-'));
}

test('connect installs notify above the first table when none exists', () => {
  const dir = tmpDir();
  const cfg = path.join(dir, 'config.toml');
  const script = path.join(dir, 'codex-notify.sh');
  fs.writeFileSync(cfg, 'model = "gpt-5.5"\n\n[some.table]\ntrust_level = "trusted"\n');

  assert.equal(codexNotifyState(cfg), 'none');
  const r = connectCodex(38917, script, cfg);
  assert.deepEqual(r, { ok: true });
  assert.equal(isCodexConnected(cfg), true);

  const text = fs.readFileSync(cfg, 'utf8');
  // our notify line exists, and sits BEFORE the [some.table] header
  assert.ok(text.includes('desktop-pet-notify'));
  assert.ok(text.indexOf('notify =') < text.indexOf('[some.table]'));
  // script written + executable
  assert.ok(fs.existsSync(script));
  assert.ok((fs.statSync(script).mode & 0o100) !== 0);
  // backup created
  assert.ok(fs.existsSync(`${cfg}.desktop-pet-backup`));
});

test('connect REFUSES to overwrite an existing (foreign) notify', () => {
  const dir = tmpDir();
  const cfg = path.join(dir, 'config.toml');
  const original = 'model = "gpt-5.5"\nnotify = ["/opt/oh-my-codex/notify"]\n';
  fs.writeFileSync(cfg, original);

  assert.equal(codexNotifyState(cfg), 'foreign');
  const r = connectCodex(38917, path.join(dir, 'codex-notify.sh'), cfg);
  assert.deepEqual(r, { ok: false, reason: 'existing-notify' });
  // config is untouched
  assert.equal(fs.readFileSync(cfg, 'utf8'), original);
});

test('connect is idempotent; disconnect removes only our line', () => {
  const dir = tmpDir();
  const cfg = path.join(dir, 'config.toml');
  const script = path.join(dir, 'codex-notify.sh');
  fs.writeFileSync(cfg, 'model = "gpt-5.5"\n');

  connectCodex(38917, script, cfg);
  connectCodex(38917, script, cfg); // second time: no-op
  const occurrences = fs.readFileSync(cfg, 'utf8').split('desktop-pet-notify').length - 1;
  assert.equal(occurrences, 1);

  disconnectCodex(cfg);
  assert.equal(isCodexConnected(cfg), false);
  assert.ok(fs.readFileSync(cfg, 'utf8').includes('model = "gpt-5.5"')); // user config kept
  assert.ok(!fs.readFileSync(cfg, 'utf8').includes('desktop-pet-notify'));
});
