import { PetEngine } from './pet-engine';
import { Pet } from './pet';
import { ProceduralSprite, SheetSprite, type SpriteSource } from './sprite';
import type { ActivityState, PetManifest, Rect } from '../shared/types';

interface PetApi {
  reportBounds: (rects: Rect[]) => void;
  onActivity: (cb: (state: ActivityState) => void) => () => void;
}
const bridge = (window as unknown as { petApi: PetApi }).petApi;

/** Build a drawable sprite from a manifest (sheet if fully specified, else procedural). */
function makeSprite(m: PetManifest): SpriteSource {
  if (m.source === 'sheet' && m.sheet && m.frameWidth && m.frameHeight && m.animations) {
    return new SheetSprite(m.sheet, m.frameWidth, m.frameHeight, m.animations);
  }
  const c = m.colors ?? { body: '#6ca8ff', accent: '#ff8aa0' };
  return new ProceduralSprite(c.body, c.accent);
}

// Built-in placeholder roster (US-004). User PNGs replace/extend this via manifests later.
const ROSTER: PetManifest[] = [
  {
    id: 'cat',
    name: 'Cat',
    source: 'procedural',
    displaySize: 112,
    colors: { body: '#6ca8ff', accent: '#ff8aa0' },
  },
];

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const maybeCtx = canvas.getContext('2d');
if (!maybeCtx) throw new Error('[desktop-pet] 2d canvas context unavailable');
const ctx = maybeCtx;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

const engine = new PetEngine(
  ctx,
  () => ({ width: window.innerWidth, height: window.innerHeight }),
  (rects) => bridge.reportBounds(rects),
);

for (const m of ROSTER) {
  const size = { width: m.displaySize, height: m.displaySize };
  const start = {
    x: Math.max(0, window.innerWidth / 2 - size.width / 2),
    y: Math.max(0, window.innerHeight / 2 - size.height / 2),
  };
  engine.add(new Pet(m.id, makeSprite(m), size, start));
}

engine.start();
bridge.onActivity((state) => engine.setActivity(state));

// eslint-disable-next-line no-console
console.log(`[desktop-pet] renderer: pet engine started (${ROSTER.length} pet)`);
