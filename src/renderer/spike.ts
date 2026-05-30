// Spike 0 renderer: a draggable box that reports its bounds to main.
// NOTE: no value-level import/export here — this compiles to a plain <script>.
// Types are inlined; the bridge comes from preload as window.petApi.

interface SpikeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PetApi {
  reportBounds: (rects: SpikeRect[]) => void;
  onActivity: (cb: (state: string) => void) => () => void;
}

// NB: contextBridge exposes a global named `petApi`; use a different local
// identifier to avoid an "already declared" collision in global script scope.
const bridge = (window as unknown as { petApi: PetApi }).petApi;
const box = document.getElementById('box') as HTMLDivElement;

let dragging = false;
let offsetX = 0;
let offsetY = 0;

function currentRect(): SpikeRect {
  const r = box.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function reportBounds(): void {
  bridge.reportBounds([currentRect()]);
}

box.addEventListener('mousedown', (e: MouseEvent) => {
  dragging = true;
  box.classList.add('dragging');
  const r = box.getBoundingClientRect();
  offsetX = e.clientX - r.left;
  offsetY = e.clientY - r.top;
  e.preventDefault();
});

window.addEventListener('mousemove', (e: MouseEvent) => {
  if (!dragging) return;
  box.style.left = `${e.clientX - offsetX}px`;
  box.style.top = `${e.clientY - offsetY}px`;
  reportBounds();
});

window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  box.classList.remove('dragging');
  reportBounds();
});

// Report initial bounds, and re-report periodically to cover any layout shifts.
reportBounds();
window.setInterval(reportBounds, 500);
