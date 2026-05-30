import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Marker embedded in our hook commands so we can find/remove only our entries. */
const MARKER = 'desktop-pet-hook';
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

/** Claude Code hook event -> pet activity kind. */
const EVENT_KINDS: Record<string, string> = {
  UserPromptSubmit: 'working',
  PostToolUse: 'working', // back to thinking after a tool finishes
  PreToolUse: 'tool',
  Stop: 'idle', // finished responding, waiting for the user
  SessionStart: 'idle',
  SessionEnd: 'idle',
};
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']); // these take a matcher

type Json = Record<string, unknown>;
interface HookCommand {
  type: string;
  command: string;
}
interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

function curlCommand(port: number, kind: string): string {
  return (
    `curl -s -m 2 -X POST http://127.0.0.1:${port}/event ` +
    `-H 'content-type: application/json' ` +
    `-d '{"source":"claude","kind":"${kind}"}' >/dev/null 2>&1 # ${MARKER}`
  );
}

function readSettings(settingsPath: string): Json {
  if (!fs.existsSync(settingsPath)) return {};
  const raw = fs.readFileSync(settingsPath, 'utf8');
  return raw.trim() ? (JSON.parse(raw) as Json) : {};
}

function isOurs(entry: HookEntry): boolean {
  return JSON.stringify(entry).includes(MARKER);
}

export function isClaudeConnected(settingsPath: string = SETTINGS_PATH): boolean {
  try {
    return fs.existsSync(settingsPath) && fs.readFileSync(settingsPath, 'utf8').includes(MARKER);
  } catch {
    return false;
  }
}

/** Install our hooks into ~/.claude/settings.json (backs up once, merges, idempotent). */
export function connectClaude(
  port: number,
  settingsPath: string = SETTINGS_PATH,
): { ok: boolean; error?: string } {
  try {
    const backupPath = `${settingsPath}.desktop-pet-backup`;
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    if (fs.existsSync(settingsPath) && !fs.existsSync(backupPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }
    const json = readSettings(settingsPath);
    const hooks = (json.hooks ?? {}) as Record<string, HookEntry[]>;

    for (const [event, kind] of Object.entries(EVENT_KINDS)) {
      const existing = Array.isArray(hooks[event]) ? hooks[event] : [];
      const withoutOurs = existing.filter((e) => !isOurs(e)); // idempotent re-install
      const entry: HookEntry = TOOL_EVENTS.has(event)
        ? { matcher: '.*', hooks: [{ type: 'command', command: curlCommand(port, kind) }] } // regex: all tools
        : { hooks: [{ type: 'command', command: curlCommand(port, kind) }] };
      hooks[event] = [...withoutOurs, entry];
    }

    json.hooks = hooks;
    fs.writeFileSync(settingsPath, `${JSON.stringify(json, null, 2)}\n`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Remove only our hook entries (surgical; backup is kept as a safety net). */
export function disconnectClaude(settingsPath: string = SETTINGS_PATH): { ok: boolean; error?: string } {
  try {
    if (!fs.existsSync(settingsPath)) return { ok: true };
    const json = readSettings(settingsPath);
    const hooks = json.hooks as Record<string, HookEntry[]> | undefined;
    if (hooks) {
      for (const event of Object.keys(hooks)) {
        const arr = hooks[event];
        if (Array.isArray(arr)) {
          const kept = arr.filter((e) => !isOurs(e));
          if (kept.length) hooks[event] = kept;
          else delete hooks[event];
        }
      }
      if (Object.keys(hooks).length === 0) delete json.hooks;
    }
    fs.writeFileSync(settingsPath, `${JSON.stringify(json, null, 2)}\n`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export const ClaudeSettingsPath = SETTINGS_PATH;
