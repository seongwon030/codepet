import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, type Rect, type ActivityState } from '../shared/types';

/**
 * Minimal, sandboxed bridge exposed to the renderer as `window.petApi`.
 * Renderer never gets direct ipcRenderer / node access.
 */
contextBridge.exposeInMainWorld('petApi', {
  /** Report interactive rects so main can toggle click-through. */
  reportBounds: (rects: Rect[]): void => {
    ipcRenderer.send(IpcChannels.ReportBounds, rects);
  },
  /** Subscribe to activity-state changes. Returns an unsubscribe fn. */
  onActivity: (cb: (state: ActivityState) => void): (() => void) => {
    const listener = (_e: unknown, state: ActivityState) => cb(state);
    ipcRenderer.on(IpcChannels.ActivityState, listener);
    return () => ipcRenderer.removeListener(IpcChannels.ActivityState, listener);
  },
});
