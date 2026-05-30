import { PetEngine } from './pet-engine';
import { Pet } from './pet';
import { ProceduralSprite, SheetSprite, StaticSprite, type SpriteSource } from './sprite';
import type { ActivityState, PetManifest, Rect, RosterEntry } from '../shared/types';

interface PetApi {
  reportBounds: (rects: Rect[]) => void;
  reportRoster: (roster: RosterEntry[]) => void;
  setDragLock: (locked: boolean) => void;
  onActivity: (cb: (state: ActivityState) => void) => () => void;
  onSelectPet: (cb: (ids: string[]) => void) => () => void;
  onSetPaused: (cb: (paused: boolean) => void) => () => void;
}
const bridge = (window as unknown as { petApi: PetApi }).petApi;

/** Build a drawable sprite from a manifest (sheet if fully specified, else procedural). */
function makeSprite(m: PetManifest): SpriteSource {
  // paths are relative to the app assets dir, resolved from the renderer html
  if (m.source === 'static' && m.sheet) {
    return new StaticSprite(`../assets/${m.sheet}`);
  }
  if (m.source === 'sheet' && m.sheet && m.frameWidth && m.frameHeight && m.animations) {
    return new SheetSprite(`../assets/${m.sheet}`, m.frameWidth, m.frameHeight, m.animations);
  }
  const c = m.colors ?? { body: '#6ca8ff', accent: '#ff8aa0' };
  return new ProceduralSprite(c.body, c.accent);
}

// 5 pets from user-provided static PNGs (assets/pets/*.png). Single-image art,
// animated procedurally (bob/flip + working dots + sleeping Z) by StaticSprite.
const ROSTER: PetManifest[] = [
  { id: 'cat', name: 'Cat', source: 'static', sheet: 'pets/cat.png', displaySize: 110 },
  { id: 'dog', name: 'Dog', source: 'static', sheet: 'pets/dog.png', displaySize: 104 },
  { id: 'duck', name: 'Duck', source: 'static', sheet: 'pets/duck.png', displaySize: 104 },
  { id: 'seal', name: 'Seal', source: 'static', sheet: 'pets/seal.png', displaySize: 112 },
  { id: 'whale', name: 'Whale', source: 'static', sheet: 'pets/whale.png', displaySize: 120 },
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

function buildPet(m: PetManifest, index: number, total: number): Pet {
  const size = { width: m.displaySize, height: m.displaySize };
  const w = window.innerWidth;
  const h = window.innerHeight;
  // spread pets across the width, alternating a little vertically
  const x = Math.max(0, ((index + 1) / (total + 1)) * w - size.width / 2);
  const y = Math.max(0, h * 0.5 + (index % 2 === 0 ? -1 : 1) * h * 0.12 - size.height / 2);
  return new Pet(m.id, makeSprite(m), size, { x, y });
}

function showPets(ids: string[]): void {
  const manifests = ids.length ? ROSTER.filter((m) => ids.includes(m.id)) : ROSTER;
  engine.setPets(manifests.map((m, i) => buildPet(m, i, manifests.length)));
}

showPets([ROSTER[0].id]); // one pet at a time; switch via the tray
engine.start();

// tray <-> renderer wiring
bridge.reportRoster(ROSTER.map((m) => ({ id: m.id, name: m.name })));
bridge.onActivity((state) => engine.setActivity(state));
bridge.onSelectPet((ids) => showPets(ids));
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
  bridge.setDragLock(true); // keep overlay interactive for the whole drag
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
  bridge.setDragLock(false);
});

// eslint-disable-next-line no-console
console.log(`[desktop-pet] renderer: pet engine started (roster ${ROSTER.length}, showing 1)`);
