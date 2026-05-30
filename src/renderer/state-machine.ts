import type { ActivityState } from '../shared/types';

/** A single pet's behavioral/visual state. */
export type PetState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'tool'
  | 'sleeping'
  | 'dragged';

/** Events that drive the pet state machine. */
export type PetEvent =
  | { type: 'activity'; state: ActivityState } // external Claude/Codex signal
  | { type: 'dragStart' }
  | { type: 'dragEnd' }
  | { type: 'wander' } // idle -> walking (a target was picked)
  | { type: 'arrived' } // walking -> idle (reached target)
  | { type: 'idleTimeout' }; // long idle -> sleeping

/**
 * Pure transition function for one pet. No side effects, no time, no DOM —
 * fully unit-testable.
 *
 * Rules:
 * - Drag overrides everything (dragStart -> dragged; dragEnd -> idle).
 * - External activity drives working/tool/sleeping; it never overrides a drag.
 * - idle <-> walking is the free wander loop, used only while activity is idle.
 * - A sleeping pet wakes on activity (working/running/tool) or drag, not on
 *   an `idle` activity signal.
 */
export function nextState(current: PetState, event: PetEvent): PetState {
  switch (event.type) {
    case 'dragStart':
      return 'dragged';
    case 'dragEnd':
      return 'idle';
    case 'activity':
      if (current === 'dragged') return 'dragged'; // drag wins
      switch (event.state) {
        case 'working':
        case 'running':
          return 'working';
        case 'tool':
          return 'tool';
        case 'sleeping':
          return 'sleeping';
        case 'idle':
          return current === 'sleeping' ? 'sleeping' : 'idle';
      }
      return current;
    case 'wander':
      return current === 'idle' ? 'walking' : current;
    case 'arrived':
      return current === 'walking' ? 'idle' : current;
    case 'idleTimeout':
      return current === 'idle' ? 'sleeping' : current;
    default:
      return current;
  }
}
