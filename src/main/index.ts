import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import * as path from 'path';
import psList from 'ps-list';
import { createOverlayWindow } from './overlay-window';
import { ActivityDetector, DEFAULT_PATTERNS, type ProcLike } from './activity-detector';
import { IpcChannels, type Rect, type RosterEntry } from '../shared/types';

let overlay: BrowserWindow | null = null;
let detector: ActivityDetector | null = null;
let tray: Tray | null = null;
let paused = false;
let roster: RosterEntry[] = [];
let currentPetId = '';

/** Interactive rects (pets/box) most recently reported by the renderer. */
let interactiveRects: Rect[] = [];
/** Whether the overlay currently ignores mouse events (click-through). */
let clickThrough = true;
/** While true (a drag is in progress), the poller keeps the overlay interactive. */
let dragLocked = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Spike core: toggle click-through based on whether the cursor is over a pet. */
function startCursorPoller(win: BrowserWindow): void {
  pollTimer = setInterval(() => {
    if (win.isDestroyed()) return;
    if (dragLocked) {
      // Don't flip click-through mid-drag — it would interrupt mousemove (stutter).
      if (clickThrough) {
        win.setIgnoreMouseEvents(false);
        clickThrough = false;
      }
      return;
    }
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

function sendToOverlay(channel: string, payload: unknown): void {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, payload);
}

function buildTrayMenu(): Menu {
  const petSubmenu: Electron.MenuItemConstructorOptions[] = roster.map((p) => ({
    label: p.name,
    type: 'radio',
    checked: p.id === currentPetId,
    click: () => {
      currentPetId = p.id;
      updateTrayIcon(p.id);
      sendToOverlay(IpcChannels.SelectPet, [p.id]); // show exactly one pet
    },
  }));

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'Desktop Pet', enabled: false },
    { type: 'separator' },
    roster.length
      ? { label: 'Pet', submenu: petSubmenu }
      : { label: 'Pet (loading…)', enabled: false },
    {
      label: paused ? 'Resume' : 'Pause',
      click: () => {
        paused = !paused;
        sendToOverlay(IpcChannels.SetPaused, paused);
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit Desktop Pet', click: () => app.quit() },
  ];
  return Menu.buildFromTemplate(template);
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../assets/trayTemplate.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Desktop Pet');
  tray.setContextMenu(buildTrayMenu());
  // eslint-disable-next-line no-console
  console.log('[desktop-pet] tray ready, iconEmpty=', icon.isEmpty());
}

/** Set the menu-bar icon to the current pet's image (color, ~18px). */
function updateTrayIcon(petId: string): void {
  if (!tray || !petId) return;
  const img = nativeImage.createFromPath(path.join(__dirname, '../assets/pets', `${petId}.png`));
  if (!img.isEmpty()) tray.setImage(img.resize({ height: 18 }));
}

app.whenReady().then(() => {
  // Menu-bar agent: no Dock icon. (Packaged build also sets LSUIElement=1.)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  ipcMain.on(IpcChannels.ReportBounds, (_e, rects: Rect[]) => {
    interactiveRects = Array.isArray(rects) ? rects : [];
  });

  ipcMain.on(IpcChannels.Roster, (_e, list: RosterEntry[]) => {
    roster = Array.isArray(list) ? list : [];
    if (!currentPetId && roster.length) currentPetId = roster[0].id;
    updateTrayIcon(currentPetId);
    tray?.setContextMenu(buildTrayMenu());
  });

  ipcMain.on(IpcChannels.DragLock, (_e, locked: boolean) => {
    dragLocked = Boolean(locked);
    if (dragLocked && overlay && !overlay.isDestroyed()) {
      overlay.setIgnoreMouseEvents(false);
      clickThrough = false;
    }
  });

  overlay = createOverlayWindow();
  startCursorPoller(overlay);
  createTray();

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

  // Global quit hotkey (also available via the tray): Cmd/Ctrl+Shift+P.
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
