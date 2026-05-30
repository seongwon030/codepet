import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

/**
 * Creates the transparent, always-on-top, click-through overlay window that
 * covers the primary display. Per spec: never fullscreen:true; apply
 * visibleOnFullScreen AFTER ready-to-show; start click-through.
 */
export function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:false lets the preload require app modules (shared/types).
      // Safe here: the overlay only ever loads local, trusted files — no
      // remote content — and the renderer still has no direct node access.
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  // Start fully click-through; the cursor poller in main toggles this.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.once('ready-to-show', () => {
    // Must be applied after ready-to-show or it silently fails (spec 6.1).
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.showInactive();
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  return win;
}
