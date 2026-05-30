/** A 2D point (top-left origin of a pet, in window CSS px). */
export interface Vec {
  x: number;
  y: number;
}

/** A width/height pair. */
export interface Size {
  width: number;
  height: number;
}

/** Clamp a position so a pet of `pet` size stays fully inside `bounds`. */
export function clamp(pos: Vec, bounds: Size, pet: Size): Vec {
  const maxX = Math.max(0, bounds.width - pet.width);
  const maxY = Math.max(0, bounds.height - pet.height);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

/**
 * Pick a random reachable target (top-left) within bounds.
 * `rng` is injected (defaults to Math.random) so tests are deterministic.
 */
export function pickTarget(bounds: Size, pet: Size, rng: () => number = Math.random): Vec {
  const maxX = Math.max(0, bounds.width - pet.width);
  const maxY = Math.max(0, bounds.height - pet.height);
  return { x: rng() * maxX, y: rng() * maxY };
}

/**
 * Step `pos` toward `target` by at most `speed` px.
 * Returns the new position and whether the target was reached.
 */
export function stepToward(
  pos: Vec,
  target: Vec,
  speed: number,
): { pos: Vec; arrived: boolean } {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed || dist === 0) {
    return { pos: { x: target.x, y: target.y }, arrived: true };
  }
  const ratio = speed / dist;
  return { pos: { x: pos.x + dx * ratio, y: pos.y + dy * ratio }, arrived: false };
}
