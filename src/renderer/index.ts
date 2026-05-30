import { PetEngine } from './pet-engine';
import { Pet } from './pet';
import { ProceduralSprite, SheetSprite, type SpriteSource } from './sprite';
import type { ActivityState, PetManifest, Rect, RosterEntry } from '../shared/types';

interface PetApi {
  reportBounds: (rects: Rect[]) => void;
  reportRoster: (roster: RosterEntry[]) => void;
  onActivity: (cb: (state: ActivityState) => void) => () => void;
  onSelectPet: (cb: (id: string) => void) => () => void;
  onSetPaused: (cb: (paused: boolean) => void) => () => void;
}
const bridge = (window as unknown as { petApi: PetApi }).petApi;

/** Build a drawable sprite from a manifest (sheet if fully specified, else procedural). */
function makeSprite(m: PetManifest): SpriteSource {
  if (m.source === 'sheet' && m.sheet && m.frameWidth && m.frameHeight && m.animations) {
    // sheet path is relative to the app assets dir, resolved from the renderer html
    return new SheetSprite(`../assets/${m.sheet}`, m.frameWidth, m.frameHeight, m.animations);
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

function buildPet(m: PetManifest): Pet {
  const size = { width: m.displaySize, height: m.displaySize };
  const start = {
    x: Math.max(0, window.innerWidth / 2 - size.width / 2),
    y: Math.max(0, window.innerHeight / 2 - size.height / 2),
  };
  return new Pet(m.id, makeSprite(m), size, start);
}

function showPet(id: string): void {
  const m = ROSTER.find((p) => p.id === id) ?? ROSTER[0];
  engine.setPets([buildPet(m)]);
}

showPet(ROSTER[0].id);
engine.start();

// tray <-> renderer wiring
bridge.reportRoster(ROSTER.map((m) => ({ id: m.id, name: m.name })));
bridge.onActivity((state) => engine.setActivity(state));
bridge.onSelectPet((id) => showPet(id));
bridge.onSetPaused((paused) => engine.setPaused(paused));

// Drag: pointer-down on a pet (only delivered when main toggled the overlay
// interactive because the cursor is over a pet) picks it up; it follows the
// cursor and is dropped on pointer-up, then resumes the current activity.
let dragPet: Pet | null = null;
let dragOffset = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
  const pet = engine.petAt(e.clientX, e.clientY);
  if (!pet) return;
  dragPet = pet;
  dragOffset = { x: e.clientX - pet.pos.x, y: e.clientY - pet.pos.y };
  engine.startDrag(pet);
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!dragPet) return;
  dragPet.moveTo(
    { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y },
    { width: window.innerWidth, height: window.innerHeight },
  );
});

window.addEventListener('mouseup', () => {
  if (!dragPet) return;
  engine.endDrag(dragPet);
  dragPet = null;
});

// eslint-disable-next-line no-console
console.log(`[desktop-pet] renderer: pet engine started (${ROSTER.length} pet)`);
