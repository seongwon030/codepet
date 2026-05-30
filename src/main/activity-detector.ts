import type { ActivityState } from '../shared/types';

/** Minimal shape of a process record (subset of ps-list's output). */
export interface ProcLike {
  pid: number;
  name?: string;
  cmd?: string;
}

export interface DetectorConfig {
  /** cmd patterns that identify a Claude/Codex CLI process. */
  patterns: RegExp[];
  /** if a cmd contains any of these, it is never treated as an agent (e.g. our own app). */
  excludeSubstrings: string[];
  /** pids to ignore (self + helpers). */
  ignorePids: number[];
  /** ms with no agent process before transitioning idle -> sleeping. */
  sleepAfterMs: number;
}

/**
 * Match claude/codex as a path segment or word, tolerating `claude-code`.
 * Matching by full `cmd` (not ps-list's 15-char-truncated `name`).
 */
export const DEFAULT_PATTERNS: RegExp[] = [
  /(^|[/\s])claude(-code)?($|[/\s])/i,
  /(^|[/\s])codex($|[/\s])/i,
];

/** Pure: does this command line look like a Claude/Codex CLI process? */
export function isAgentProcess(
  cmd: string,
  patterns: RegExp[],
  excludeSubstrings: string[],
): boolean {
  if (!cmd) return false;
  if (excludeSubstrings.some((s) => cmd.includes(s))) return false;
  return patterns.some((re) => re.test(cmd));
}

/** Pure: is any agent process currently running (cmd-matched, self/excluded removed)? */
export function detectRunning(procs: ProcLike[], cfg: DetectorConfig): boolean {
  return procs.some((p) => {
    if (cfg.ignorePids.includes(p.pid)) return false;
    return isAgentProcess(p.cmd ?? p.name ?? '', cfg.patterns, cfg.excludeSubstrings);
  });
}

/** Pure: map (running?, ms since last running) to an ActivityState. */
export function computeState(
  running: boolean,
  msSinceRunning: number,
  sleepAfterMs: number,
): ActivityState {
  if (running) return 'running';
  if (msSinceRunning >= sleepAfterMs) return 'sleeping';
  return 'idle';
}

/**
 * Polls a process lister and emits ActivityState changes. The lister is
 * injected so the core is unit-testable without spawning processes.
 */
export class ActivityDetector {
  private lastRunningAt: number;
  private current: ActivityState = 'idle';
  private emittedOnce = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private list: () => Promise<ProcLike[]>,
    private onChange: (state: ActivityState) => void,
    private cfg: DetectorConfig,
    startTime = 0,
  ) {
    this.lastRunningAt = startTime;
  }

  get state(): ActivityState {
    return this.current;
  }

  /** Poll once with an explicit `now` (ms). Returns the resolved state. */
  async poll(now: number): Promise<ActivityState> {
    let procs: ProcLike[] = [];
    try {
      procs = await this.list();
    } catch {
      return this.current; // listing failed this tick; keep last state
    }
    const running = detectRunning(procs, this.cfg);
    if (running) this.lastRunningAt = now;
    const next = computeState(running, now - this.lastRunningAt, this.cfg.sleepAfterMs);
    if (next !== this.current || !this.emittedOnce) {
      this.current = next;
      this.emittedOnce = true;
      this.onChange(next);
    }
    return next;
  }

  start(intervalMs: number): void {
    void this.poll(Date.now());
    this.timer = setInterval(() => void this.poll(Date.now()), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
