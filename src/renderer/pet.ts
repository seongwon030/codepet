import { nextState, type PetEvent, type PetState } from './state-machine';
import { clamp, pickTarget, stepToward, type Size, type Vec } from './movement';
import type { Rect } from '../shared/types';
import type { SpriteSource } from './sprite';

/**
 * A single pet: position + behavioral state + animation clock.
 * Pure-ish: `update` mutates self but delegates decisions to the tested
 * state-machine / movement helpers.
 */
export class Pet {
  state: PetState = 'idle';
  pos: Vec;
  facing: 1 | -1 = 1;
  /** ms accumulated, drives sprite animation phase. */
  clock = 0;

  private target: Vec | null = null;
  private idleSince = 0;
  private nextWanderAt = 0;

  constructor(
    public readonly id: string,
    public readonly sprite: SpriteSource,
    public readonly size: Size,
    start: Vec,
  ) {
    this.pos = start;
  }

  dispatch(event: PetEvent): void {
    this.state = nextState(this.state, event);
  }

  /** px/frame walk speed, scaled to pet size. */
  private speed(): number {
    return Math.max(1, this.size.width * 0.018);
  }

  /** Advance by `dt` ms at absolute engine time `now`, within `bounds`. */
  update(dt: number, bounds: Size, now: number): void {
    this.clock += dt;
    if (this.state !== 'idle') this.idleSince = 0;

    if (this.state === 'walking') {
      if (!this.target) this.target = pickTarget(bounds, this.size);
      const next = stepToward(this.pos, this.target, this.speed());
      if (next.pos.x !== this.pos.x) this.facing = next.pos.x >= this.pos.x ? 1 : -1;
      this.pos = clamp(next.pos, bounds, this.size);
      if (next.arrived) {
        this.target = null;
        this.dispatch({ type: 'arrived' });
        this.idleSince = now;
        this.nextWanderAt = now + 1500 + Math.random() * 3500;
      }
    } else if (this.state === 'idle') {
      if (this.idleSince === 0) {
        this.idleSince = now;
        this.nextWanderAt = now + 1200 + Math.random() * 2500;
      }
      if (now >= this.nextWanderAt) this.dispatch({ type: 'wander' });
    }
  }

  bounds(): Rect {
    return { x: this.pos.x, y: this.pos.y, width: this.size.width, height: this.size.height };
  }

  center(): Vec {
    return { x: this.pos.x + this.size.width / 2, y: this.pos.y + this.size.height / 2 };
  }
}
