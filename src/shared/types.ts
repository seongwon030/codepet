/** A rectangle in renderer/window CSS pixels (DIP), origin at window top-left. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Unified activity state derived by the Activity Detector.
 * Polling can only produce `running` (process exists) vs `idle`/`sleeping`.
 * `working`/`tool` precision comes from hook mode (v0.2).
 */
export type ActivityState = 'idle' | 'running' | 'working' | 'tool' | 'sleeping';

/** IPC channel names shared between main, preload, and renderer. */
export const IpcChannels = {
  /** renderer -> main: interactive (clickable) rects in window coords */
  ReportBounds: 'pet:bounds',
  /** main -> renderer: current activity state */
  ActivityState: 'pet:activity',
} as const;
