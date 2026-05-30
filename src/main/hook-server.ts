import * as http from 'http';
import type { ActivityState } from '../shared/types';

export interface HookEvent {
  source: 'claude' | 'codex';
  kind: string;
}

/** Hook `kind` -> pet ActivityState. */
const KIND_TO_STATE: Record<string, ActivityState> = {
  working: 'working',
  tool: 'tool',
  idle: 'idle',
};

/**
 * Tiny localhost server that receives hook/notify events from Claude Code /
 * Codex and turns them into precise ActivityState updates. Bound to 127.0.0.1
 * only; ignores anything but POST /event with a small JSON body.
 */
export class HookServer {
  private server: http.Server | null = null;

  constructor(private onEvent: (state: ActivityState, ev: HookEvent) => void) {}

  /** Returns true if the server bound to the port, false if it was taken. */
  start(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        if (req.method !== 'POST' || req.url !== '/event') {
          res.writeHead(404);
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 4096) req.destroy(); // cap payload
        });
        req.on('end', () => {
          try {
            const ev = JSON.parse(body) as HookEvent;
            const state = KIND_TO_STATE[ev.kind];
            if (state) this.onEvent(state, ev);
          } catch {
            // ignore malformed payloads
          }
          res.writeHead(204);
          res.end();
        });
      });
      server.on('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        this.server = server;
        resolve(true);
      });
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}
