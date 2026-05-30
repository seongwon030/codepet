import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from 'electron';
import * as path from 'path';
import psList from 'ps-list';
import { createOverlayWindow } from './overlay-window';
import { ActivityDetector, DEFAULT_PATTERNS, type ProcLike } from './activity-detector';
import { HookServer } from './hook-server';
import { connectClaude, disconnectClaude, isClaudeConnected, ClaudeSettingsPath } from './connector';
import {
  connectCodex,
  disconnectCodex,
  isCodexConnected,
  codexNotifyState,
  CodexConfigPath,
} from './codex-connector';
import { IpcChannels, type Rect, type RosterEntry } from '../shared/types';

/** Fixed localhost port for the hook server (embedded in installed hook commands). */
const HOOK_PORT = 38917;

/** Per-display overlay with its own click-through / drag state. */
interface OverlayCtx {
  win: BrowserWindow;
  rects: Rect[];
  clickThrough: boolean;
  dragLocked: boolean;
}

let overlays: OverlayCtx[] = [];
let detector: ActivityDetector | null = null;
let hookServer: HookServer | null = null;
let tray: Tray | null = null;
let paused = false;
let roster: RosterEntry[] = [];
let currentPetId = '';
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Send a message to every live overlay window. */
function broadcast(channel: string, payload: unknown): void {
  for (const o of overlays) {
    if (!o.win.isDestroyed()) o.win.webContents.send(channel, payload);
  }
}

function overlayForSender(senderId: number): OverlayCtx | undefined {
  return overlays.find((o) => !o.win.isDestroyed() && o.win.webContents.id === senderId);
}

/** Toggle each overlay's click-through based on whether the cursor is over a pet. */
function startCursorPoller(): void {
  pollTimer = setInterval(() => {
    const cursor = screen.getCursorScreenPoint();
    for (const o of overlays) {
      if (o.win.isDestroyed()) continue;
      if (o.dragLocked) {
        // Don't flip click-through mid-drag — it would interrupt mousemove (stutter).
        if (o.clickThrough) {
          o.win.setIgnoreMouseEvents(false);
          o.clickThrough = false;
        }
        continue;
      }
      const b = o.win.getBounds();
      const lx = cursor.x - b.x;
      const ly = cursor.y - b.y;
      const inside = lx >= 0 && ly >= 0 && lx <= b.width && ly <= b.height;
      const over =
        inside &&
        o.rects.some((r) => lx >= r.x && lx <= r.x + r.width && ly >= r.y && ly <= r.y + r.height);
      if (over && o.clickThrough) {
        o.win.setIgnoreMouseEvents(false);
        o.clickThrough = false;
      } else if (!over && !o.clickThrough) {
        o.win.setIgnoreMouseEvents(true, { forward: true });
        o.clickThrough = true;
      }
    }
  }, 40);
}

/** (Re)create one overlay window per display. */
function createOverlays(): void {
  for (const o of overlays) {
    if (!o.win.isDestroyed()) o.win.destroy();
  }
  overlays = [];
  for (const display of screen.getAllDisplays()) {
    const win = createOverlayWindow(display);
    overlays.push({ win, rects: [], clickThrough: true, dragLocked: false });
    win.webContents.on('did-finish-load', () => {
      if (win.isDestroyed()) return;
      // sync a freshly-loaded window to the current state
      if (detector) win.webContents.send(IpcChannels.ActivityState, detector.state);
      if (currentPetId) win.webContents.send(IpcChannels.SelectPet, [currentPetId]);
      if (paused) win.webContents.send(IpcChannels.SetPaused, true);
    });
  }
  // eslint-disable-next-line no-console
  console.log(`[desktop-pet] overlays ready: ${overlays.length} display(s).`);
}

function buildTrayMenu(): Menu {
  const petSubmenu: Electron.MenuItemConstructorOptions[] = roster.map((p) => ({
    label: p.name,
    type: 'radio',
    checked: p.id === currentPetId,
    click: () => {
      currentPetId = p.id;
      updateTrayIcon(p.id);
      broadcast(IpcChannels.SelectPet, [p.id]); // show exactly one pet, on every display
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
        broadcast(IpcChannels.SetPaused, paused);
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    isClaudeConnected()
      ? {
          label: 'Disconnect Claude Code',
          click: () => {
            disconnectClaude();
            tray?.setContextMenu(buildTrayMenu());
          },
        }
      : { label: 'Connect Claude Code…', click: onConnectClaude },
    isCodexConnected()
      ? {
          label: 'Disconnect Codex',
          click: () => {
            disconnectCodex();
            tray?.setContextMenu(buildTrayMenu());
          },
        }
      : { label: 'Connect Codex…', click: onConnectCodex },
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

/** Tray action: install Claude Code hooks after explicit consent. */
function onConnectClaude(): void {
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Connect', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'Connect Desktop Pet to Claude Code?',
    detail:
      `This adds hooks to ${ClaudeSettingsPath} (a backup is saved alongside it) so the pet ` +
      `reacts precisely to your Claude sessions — typing, tool use, and done. You can disconnect anytime.`,
  });
  if (choice !== 0) return;
  const res = connectClaude(HOOK_PORT);
  if (!res.ok) dialog.showErrorBox('Connect failed', res.error ?? 'Unknown error');
  tray?.setContextMenu(buildTrayMenu());
}

/** Tray action: install a Codex notify, but never overwrite an existing one. */
function onConnectCodex(): void {
  if (codexNotifyState() === 'foreign') {
    dialog.showMessageBoxSync({
      type: 'info',
      buttons: ['OK'],
      message: 'Codex already has a notify program',
      detail:
        `Desktop Pet won't modify it (it may be oh-my-codex / Computer Use). Codex is still ` +
        `detected via process polling, so the pet reacts while Codex is running.`,
    });
    return;
  }
  const choice = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Connect', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    message: 'Connect Desktop Pet to Codex?',
    detail:
      `This adds a notify entry to ${CodexConfigPath} (backed up) so the pet idles when a Codex ` +
      `turn finishes. Restart Codex to apply. You can disconnect anytime.`,
  });
  if (choice !== 0) return;
  const scriptPath = path.join(app.getPath('userData'), 'codex-notify.sh');
  const res = connectCodex(HOOK_PORT, scriptPath);
  if (!res.ok && res.reason === 'error') {
    dialog.showErrorBox('Connect Codex failed', res.error ?? 'Unknown error');
  }
  tray?.setContextMenu(buildTrayMenu());
}

app.whenReady().then(() => {
  // Menu-bar agent: no Dock icon. (Packaged build also sets LSUIElement=1.)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  ipcMain.on(IpcChannels.ReportBounds, (e, rects: Rect[]) => {
    const o = overlayForSender(e.sender.id);
    if (o) o.rects = Array.isArray(rects) ? rects : [];
  });

  ipcMain.on(IpcChannels.Roster, (_e, list: RosterEntry[]) => {
    roster = Array.isArray(list) ? list : [];
    if (!currentPetId && roster.length) currentPetId = roster[0].id;
    updateTrayIcon(currentPetId);
    tray?.setContextMenu(buildTrayMenu());
  });

  ipcMain.on(IpcChannels.DragLock, (e, locked: boolean) => {
    const o = overlayForSender(e.sender.id);
    if (!o) return;
    o.dragLocked = Boolean(locked);
    if (o.dragLocked && !o.win.isDestroyed()) {
      o.win.setIgnoreMouseEvents(false);
      o.clickThrough = false;
    }
  });

  createOverlays();
  startCursorPoller();
  createTray();

  // Rebuild overlays when the display layout changes (monitor plugged/unplugged).
  const onDisplayChange = (): void => createOverlays();
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  screen.on('display-metrics-changed', onDisplayChange);

  // "Bot" feature: detect Claude/Codex sessions and drive pet activity.
  detector = new ActivityDetector(
    async () => (await psList()) as ProcLike[],
    (state) => {
      // eslint-disable-next-line no-console
      console.log('[desktop-pet] activity:', state);
      broadcast(IpcChannels.ActivityState, state);
    },
    {
      patterns: DEFAULT_PATTERNS,
      excludeSubstrings: ['desktop-pet'],
      ignorePids: [process.pid],
      sleepAfterMs: 5 * 60 * 1000,
    },
    Date.now(),
  );
  detector.start(2000);

  // Local hook server for precise Claude/Codex states (used when connected via tray).
  hookServer = new HookServer((state) => {
    detector?.noteHook(state, Date.now());
  });
  hookServer.start(HOOK_PORT).then((ok) => {
    // eslint-disable-next-line no-console
    console.log(
      `[desktop-pet] hook server 127.0.0.1:${HOOK_PORT}: ${ok ? 'listening' : 'port busy'}`,
    );
  });

  // Global quit hotkey (also available via the tray): Cmd/Ctrl+Shift+P.
  globalShortcut.register('CommandOrControl+Shift+P', () => app.quit());

  // eslint-disable-next-line no-console
  console.log('[desktop-pet] cursor poller running.');
});

// Menu-bar app: keep running when overlays are hidden/closed.
app.on('window-all-closed', () => {
  // Intentionally do not quit on macOS.
});

app.on('will-quit', () => {
  if (pollTimer) clearInterval(pollTimer);
  detector?.stop();
  hookServer?.stop();
  globalShortcut.unregisterAll();
});
