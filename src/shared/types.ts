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
  /** renderer -> main: available pets (for the tray picker) */
  Roster: 'pet:roster',
  /** main -> renderer: select which pet to show */
  SelectPet: 'pet:select',
  /** main -> renderer: pause/resume the animation loop */
  SetPaused: 'pet:paused',
} as const;

/** A pet entry for the tray picker. */
export interface RosterEntry {
  id: string;
  name: string;
}

/** Animation names a pet sprite must provide. */
export type AnimName = 'idle' | 'walk' | 'working' | 'sleeping';

/** One animation row in a sprite sheet. */
export interface AnimDef {
  row: number; // row index in the sheet grid
  frames: number; // number of frames in this row
  fps: number;
  loop?: boolean;
}

/**
 * A pet definition. `source: 'procedural'` draws via code (placeholder).
 * `source: 'sheet'` blits frames from a PNG grid (drop-in for user art).
 */
export interface PetManifest {
  id: string;
  name: string;
  source: 'procedural' | 'sheet';
  /** on-screen size in CSS px (sheet art is downscaled to this). */
  displaySize: number;
  /** procedural-only: body/accent colors. */
  colors?: { body: string; accent: string };
  /** sheet-only: image path relative to the app's assets dir. */
  sheet?: string;
  frameWidth?: number;
  frameHeight?: number;
  animations?: Partial<Record<AnimName, AnimDef>>;
  license?: { source: string; type: string; author: string };
}
