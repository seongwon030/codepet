import type { AnimDef, AnimName } from '../shared/types';
import type { PetState } from './state-machine';

/** Maps a behavioral PetState to a sprite animation name. */
export function animForState(state: PetState): AnimName {
  switch (state) {
    case 'walking':
      return 'walk';
    case 'working':
    case 'tool':
      return 'working';
    case 'sleeping':
      return 'sleeping';
    default:
      return 'idle';
  }
}

/** A drawable pet appearance. */
export interface SpriteSource {
  ready(): boolean;
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    state: PetState,
    clockMs: number,
    facing: 1 | -1,
  ): void;
}

/** Blits frames from a PNG sprite sheet (rows = animations, cols = frames). */
export class SheetSprite implements SpriteSource {
  private img: HTMLImageElement = new Image();
  private loaded = false;

  constructor(
    src: string,
    private frameWidth: number,
    private frameHeight: number,
    private anims: Partial<Record<AnimName, AnimDef>>,
  ) {
    this.img.onload = () => {
      this.loaded = true;
    };
    this.img.src = src;
  }

  ready(): boolean {
    return this.loaded;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    state: PetState,
    clockMs: number,
    facing: 1 | -1,
  ): void {
    if (!this.loaded) return;
    const anim = this.anims[animForState(state)] ?? this.anims.idle;
    if (!anim) return;
    const frame = Math.floor((clockMs / 1000) * anim.fps) % Math.max(1, anim.frames);
    const sx = frame * this.frameWidth;
    const sy = anim.row * this.frameHeight;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(facing, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.img,
      sx,
      sy,
      this.frameWidth,
      this.frameHeight,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    ctx.restore();
  }
}

/** Code-drawn placeholder pet (a small cat) — no assets required. */
export class ProceduralSprite implements SpriteSource {
  constructor(
    private body = '#6ca8ff',
    private accent = '#ff8aa0',
  ) {}

  ready(): boolean {
    return true;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    state: PetState,
    clockMs: number,
    facing: 1 | -1,
  ): void {
    const s = size;
    const t = clockMs / 1000;
    let bob = Math.sin(t * 2) * s * 0.02;
    let eyesOpen = Math.sin(t * 1.7) > -0.97; // occasional blink
    let working = false;
    let sleeping = false;
    let tailSway = Math.sin(t * 2) * 0.12;

    switch (state) {
      case 'walking':
        bob = Math.abs(Math.sin(t * 9)) * s * 0.05;
        tailSway = Math.sin(t * 9) * 0.28;
        break;
      case 'working':
      case 'tool':
        working = true;
        bob = Math.sin(t * 6) * s * 0.012;
        break;
      case 'sleeping':
        sleeping = true;
        eyesOpen = false;
        bob = 0;
        break;
      default:
        break;
    }

    ctx.save();
    ctx.translate(cx, cy - bob);
    ctx.scale(facing, 1);

    // ground shadow
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.42 + bob, s * 0.3, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // tail
    ctx.strokeStyle = this.body;
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.18);
    ctx.quadraticCurveTo(-s * 0.42, s * 0.06 + tailSway * s, -s * 0.34, -s * 0.12 - tailSway * s);
    ctx.stroke();

    // body + head
    ctx.fillStyle = this.body;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.12, s * 0.24, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 0.16, s * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // ears
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, -s * 0.28);
    ctx.lineTo(-s * 0.08, -s * 0.44);
    ctx.lineTo(-s * 0.02, -s * 0.28);
    ctx.closePath();
    ctx.moveTo(s * 0.18, -s * 0.28);
    ctx.lineTo(s * 0.08, -s * 0.44);
    ctx.lineTo(s * 0.02, -s * 0.28);
    ctx.closePath();
    ctx.fill();

    // eyes
    if (eyesOpen) {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-s * 0.08, -s * 0.17, s * 0.03, 0, Math.PI * 2);
      ctx.arc(s * 0.08, -s * 0.17, s * 0.03, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 0.16);
      ctx.lineTo(-s * 0.04, -s * 0.16);
      ctx.moveTo(s * 0.04, -s * 0.16);
      ctx.lineTo(s * 0.12, -s * 0.16);
      ctx.stroke();
    }

    // nose
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // working: tiny laptop + blinking type dots
    if (working) {
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(-s * 0.16, s * 0.22, s * 0.32, s * 0.06);
      ctx.fillStyle = '#9cc4ff';
      ctx.fillRect(-s * 0.14, s * 0.06, s * 0.28, s * 0.16);
      ctx.fillStyle = '#fff';
      const dots = Math.floor(t * 3) % 4;
      for (let i = 0; i < dots; i++) {
        ctx.beginPath();
        ctx.arc(-s * 0.06 + i * s * 0.05, s * 0.14, s * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // sleeping: floating Z (unflipped)
    if (sleeping) {
      ctx.save();
      ctx.fillStyle = this.body;
      ctx.font = `${Math.round(s * 0.16)}px -apple-system, system-ui, sans-serif`;
      const rise = (t * 22) % (s * 0.4);
      ctx.globalAlpha = Math.max(0, 1 - rise / (s * 0.4));
      ctx.fillText('Z', cx + s * 0.16, cy - s * 0.26 - rise);
      ctx.restore();
    }
  }
}
