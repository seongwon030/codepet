import { contextBridge, ipcRenderer } from 'electron';
import {
  IpcChannels,
  type ActivityState,
  type Rect,
  type RosterEntry,
} from '../shared/types';

/**
 * Minimal, sandboxed bridge exposed to the renderer as `window.petApi`.
 * Renderer never gets direct ipcRenderer / node access.
 */
contextBridge.exposeInMainWorld('petApi', {
  /** Report interactive rects so main can toggle click-through. */
  reportBounds: (rects: Rect[]): void => {
    ipcRenderer.send(IpcChannels.ReportBounds, rects);
  },
  /** Report the available pets so main can build the tray picker. */
  reportRoster: (roster: RosterEntry[]): void => {
    ipcRenderer.send(IpcChannels.Roster, roster);
  },
  /** Subscribe to activity-state changes. Returns an unsubscribe fn. */
  onActivity: (cb: (state: ActivityState) => void): (() => void) => {
    const listener = (_e: unknown, state: ActivityState) => cb(state);
    ipcRenderer.on(IpcChannels.ActivityState, listener);
    return () => ipcRenderer.removeListener(IpcChannels.ActivityState, listener);
  },
  /** Subscribe to the set of visible pet ids chosen in the tray. */
  onSelectPet: (cb: (ids: string[]) => void): (() => void) => {
    const listener = (_e: unknown, ids: string[]) => cb(ids);
    ipcRenderer.on(IpcChannels.SelectPet, listener);
    return () => ipcRenderer.removeListener(IpcChannels.SelectPet, listener);
  },
  /** Subscribe to pause/resume from the tray. */
  onSetPaused: (cb: (paused: boolean) => void): (() => void) => {
    const listener = (_e: unknown, paused: boolean) => cb(paused);
    ipcRenderer.on(IpcChannels.SetPaused, listener);
    return () => ipcRenderer.removeListener(IpcChannels.SetPaused, listener);
  },
});
