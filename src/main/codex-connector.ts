import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Codex integration via its `notify` program (config.toml). Unlike Claude
 * hooks (mergeable arrays), Codex `notify` is a SINGLE program — so we never
 * overwrite an existing one (it may be oh-my-codex / Computer Use). We only
 * auto-install when there is no notify at all; otherwise Codex is left to the
 * process-polling baseline.
 *
 * Note: Codex `notify` only fires on turn completion, so it maps to `idle`
 * ("done"). Codex "working" comes from process polling.
 */
const MARKER = 'desktop-pet-notify';
const CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');

export type CodexNotifyState = 'ours' | 'foreign' | 'none';

function notifyScript(port: number): string {
  return [
    '#!/bin/bash',
    `# ${MARKER} — posts Codex turn-complete to Desktop Pet`,
    `curl -s -m 2 -X POST http://127.0.0.1:${port}/event \\`,
    `  -H 'content-type: application/json' \\`,
    `  -d '{"source":"codex","kind":"idle"}' >/dev/null 2>&1`,
    '',
  ].join('\n');
}

function readConfig(configPath: string): string {
  return fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
}

export function codexNotifyState(configPath: string = CONFIG_PATH): CodexNotifyState {
  const text = readConfig(configPath);
  if (text.includes(MARKER)) return 'ours';
  if (/^\s*notify\s*=/m.test(text)) return 'foreign';
  return 'none';
}

export function isCodexConnected(configPath: string = CONFIG_PATH): boolean {
  return codexNotifyState(configPath) === 'ours';
}

/** Insert a top-level key line before the first [table] (TOML requires it above tables). */
function insertTopLevel(text: string, line: string): string {
  const lines = text.split('\n');
  const tableIdx = lines.findIndex((l) => /^\s*\[/.test(l));
  if (tableIdx === -1) {
    const sep = text.length && !text.endsWith('\n') ? '\n' : '';
    return `${text}${sep}${line}\n`;
  }
  lines.splice(tableIdx, 0, line);
  return lines.join('\n');
}

export type CodexConnectResult =
  | { ok: true }
  | { ok: false; reason: 'existing-notify' | 'error'; error?: string };

export function connectCodex(
  port: number,
  scriptPath: string,
  configPath: string = CONFIG_PATH,
): CodexConnectResult {
  try {
    const state = codexNotifyState(configPath);
    if (state === 'ours') return { ok: true }; // idempotent
    if (state === 'foreign') return { ok: false, reason: 'existing-notify' };

    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, notifyScript(port));
    fs.chmodSync(scriptPath, 0o755);

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const backup = `${configPath}.desktop-pet-backup`;
    if (fs.existsSync(configPath) && !fs.existsSync(backup)) {
      fs.copyFileSync(configPath, backup);
    }
    const line = `notify = ["/bin/bash", ${JSON.stringify(scriptPath)}] # ${MARKER}`;
    fs.writeFileSync(configPath, insertTopLevel(readConfig(configPath), line));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', error: (e as Error).message };
  }
}

export function disconnectCodex(configPath: string = CONFIG_PATH): { ok: boolean; error?: string } {
  try {
    if (!fs.existsSync(configPath)) return { ok: true };
    const kept = fs
      .readFileSync(configPath, 'utf8')
      .split('\n')
      .filter((l) => !l.includes(MARKER))
      .join('\n');
    fs.writeFileSync(configPath, kept);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export const CodexConfigPath = CONFIG_PATH;
