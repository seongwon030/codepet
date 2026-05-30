import { app, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron';
import psList from 'ps-list';
import { createOverlayWindow } from './overlay-window';
import { ActivityDetector, DEFAULT_PATTERNS, type ProcLike } from './activity-detector';
import { IpcChannels, type Rect } from '../shared/types';

let overlay: BrowserWindow | null = null;
let detector: ActivityDetector | null = null;

/** Interactive rects (pets/box) most recently reported by the renderer. */
let interactiveRects: Rect[] = [];
/** Whether the overlay currently ignores mouse events (click-through). */
let clickThrough = true;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Spike core: toggle click-through based on whether the cursor is over a pet. */
function startCursorPoller(win: BrowserWindow): void {
  pollTimer = setInterval(() => {
    if (win.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const b = win.getBounds();
    const lx = cursor.x - b.x;
    const ly = cursor.y - b.y;
    const over = interactiveRects.some(
      (r) => lx >= r.x && lx <= r.x + r.width && ly >= r.y && ly <= r.y + r.height,
    );
    if (over && clickThrough) {
      win.setIgnoreMouseEvents(false);
      clickThrough = false;
    } else if (!over && !clickThrough) {
      win.setIgnoreMouseEvents(true, { forward: true });
      clickThrough = true;
    }
  }, 40);
}

app.whenReady().then(() => {
  // Menu-bar agent: no Dock icon. (Packaged build also sets LSUIElement=1.)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  ipcMain.on(IpcChannels.ReportBounds, (_e, rects: Rect[]) => {
    interactiveRects = Array.isArray(rects) ? rects : [];
  });

  overlay = createOverlayWindow();
  startCursorPoller(overlay);

  // "Bot" feature: detect Claude/Codex sessions and drive pet activity.
  detector = new ActivityDetector(
    async () => (await psList()) as ProcLike[],
    (state) => {
      // eslint-disable-next-line no-console
      console.log('[desktop-pet] activity:', state);
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send(IpcChannels.ActivityState, state);
      }
    },
    {
      patterns: DEFAULT_PATTERNS,
      excludeSubstrings: ['desktop-pet'],
      ignorePids: [process.pid],
      sleepAfterMs: 5 * 60 * 1000,
    },
    Date.now(),
  );
  // Re-push the current state once the renderer finishes loading (covers
  // detector emits that happen before the page is ready).
  overlay.webContents.on('did-finish-load', () => {
    if (overlay && detector) {
      overlay.webContents.send(IpcChannels.ActivityState, detector.state);
    }
  });
  detector.start(2000);

  // Spike quit path (no tray yet): Cmd/Ctrl+Shift+P quits.
  globalShortcut.register('CommandOrControl+Shift+P', () => app.quit());

  // eslint-disable-next-line no-console
  console.log('[desktop-pet] overlay ready; cursor poller running.');
});

// Menu-bar app: keep running when the overlay is hidden/closed.
app.on('window-all-closed', () => {
  // Intentionally do not quit on macOS.
});

app.on('will-quit', () => {
  if (pollTimer) clearInterval(pollTimer);
  detector?.stop();
  globalShortcut.unregisterAll();
});
