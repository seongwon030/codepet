import { Pet } from './pet';
import type { ActivityState, Rect } from '../shared/types';
import type { PetState } from './state-machine';

/** States that warrant full-rate animation; others run at a low battery FPS. */
const ACTIVE_STATES: ReadonlyArray<PetState> = ['walking', 'working', 'tool', 'dragged'];
const BATTERY_FPS = 8;

interface Size {
  width: number;
  height: number;
}

/**
 * Owns the pets, the render loop, and the battery-aware scheduler.
 * Uses requestAnimationFrame while any pet is active; drops to a low-FPS
 * timer when everything is idle/sleeping to spare GPU/battery.
 */
export class PetEngine {
  private pets: Pet[] = [];
  private running = false;
  private paused = false;
  private last = 0;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastBoundsReport = 0;
  private lastActivity: ActivityState = 'idle';

  constructor(
    private ctx: CanvasRenderingContext2D,
    private getBounds: () => Size,
    private reportBounds: (rects: Rect[]) => void,
  ) {}

  add(pet: Pet): void {
    this.pets.push(pet);
  }

  /** Replace the current pets, re-applying the live activity (tray pet picker). */
  setPets(pets: Pet[]): void {
    this.pets = pets;
    for (const pet of pets) pet.dispatch({ type: 'activity', state: this.lastActivity });
    this.ensureRunning();
  }

  setActivity(state: ActivityState): void {
    this.lastActivity = state;
    for (const pet of this.pets) pet.dispatch({ type: 'activity', state });
    this.ensureRunning();
  }

  /** Begin dragging a pet. */
  startDrag(pet: Pet): void {
    pet.dispatch({ type: 'dragStart' });
    this.ensureRunning();
  }

  /** Drop a pet and restore it to the current activity (so it keeps working if a session is live). */
  endDrag(pet: Pet): void {
    pet.dispatch({ type: 'dragEnd' });
    pet.dispatch({ type: 'activity', state: this.lastActivity });
    this.ensureRunning();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.ensureRunning();
  }

  petAt(x: number, y: number): Pet | null {
    for (let i = this.pets.length - 1; i >= 0; i--) {
      const b = this.pets[i].bounds();
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return this.pets[i];
      }
    }
    return null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.schedule();
  }

  private ensureRunning(): void {
    if (this.running && this.raf === 0 && this.timer === null) this.schedule();
  }

  private anyActive(): boolean {
    return this.pets.some((p) => ACTIVE_STATES.includes(p.state));
  }

  private schedule(): void {
    if (!this.running) return;
    if (this.anyActive() && !this.paused) {
      this.raf = requestAnimationFrame((t) => this.tick(t));
    } else {
      this.timer = setTimeout(() => this.tick(performance.now()), 1000 / BATTERY_FPS);
    }
  }

  private tick(now: number): void {
    this.raf = 0;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const dt = Math.min(100, now - this.last);
    this.last = now;

    const bounds = this.getBounds();
    if (!this.paused) {
      for (const pet of this.pets) pet.update(dt, bounds, now);
    }
    this.render(bounds);

    if (now - this.lastBoundsReport > 100) {
      this.lastBoundsReport = now;
      this.reportBounds(this.pets.map((p) => p.bounds()));
    }
    this.schedule();
  }

  private render(bounds: Size): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, bounds.width, bounds.height);
    for (const pet of this.pets) {
      const c = pet.center();
      pet.sprite.draw(ctx, c.x, c.y, pet.size.width, pet.state, pet.clock, pet.facing);
    }
  }
}
