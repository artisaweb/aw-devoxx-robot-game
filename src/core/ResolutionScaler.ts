import type * as THREE from 'three';

// Lowers the render resolution on a device that can't hold the frame rate,
// instead of cutting what the scene shows. Level 2's corridor is lit by ~44
// real point lights and every lit pixel pays for all of them, so fill cost is
// pixels x lights: a phone at 3x density ran it far below 30 fps while a
// desktop holds 60. Pixel count is the lever that leaves the lighting (and
// the desktop picture) exactly as designed — a fast device never drops.
//
// Only ever steps down within a level; reset() at each level start goes back
// to full resolution, since Levels 1 and 3 are much cheaper than Level 2. The
// briefing panel freezes each level but keeps rendering, so the scaler has
// usually settled before the player's first move.

const MAX_PIXEL_RATIO = 2; // beyond 2x the extra pixels aren't visible, only paid for
const MIN_PIXEL_RATIO = 0.75;
const TARGET_FPS = 50;
const WINDOW_SECONDS = 1;
// Skipped after every reset — a level transition's model load stalls the
// first frames, which says nothing about what the level itself costs.
const SETTLE_SECONDS = 2;

export class ResolutionScaler {
  private ratio: number;
  private lastTime = 0;
  private settle = SETTLE_SECONDS;
  private frames = 0;
  private elapsed = 0;
  // The step just taken, so the next window can check it actually helped.
  private previousRatio = 0;
  private previousFps = 0;
  private locked = false;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.ratio = this.maxRatio();
    renderer.setPixelRatio(this.ratio);
  }

  private maxRatio(): number {
    return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  }

  private apply(ratio: number): void {
    this.ratio = ratio;
    this.renderer.setPixelRatio(ratio);
  }

  reset(): void {
    this.settle = SETTLE_SECONDS;
    this.frames = 0;
    this.elapsed = 0;
    this.previousRatio = 0;
    this.locked = false;
    if (this.ratio !== this.maxRatio()) this.apply(this.maxRatio());
  }

  /** Once per rendered frame. */
  update(): void {
    const now = performance.now();
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;
    if (this.locked || dt <= 0) return;
    // A backgrounded tab or a load stall — not a steady frame rate.
    if (dt > 0.25) {
      this.frames = 0;
      this.elapsed = 0;
      return;
    }
    if (this.settle > 0) {
      this.settle -= dt;
      return;
    }
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < WINDOW_SECONDS) return;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;

    // A step that bought (almost) nothing means the frame rate isn't set by
    // pixel count — iOS Low Power Mode caps rAF at 30, say. Undo it and stop,
    // rather than blurring the picture all the way down for nothing.
    if (this.previousRatio && fps < this.previousFps * 1.1) {
      this.apply(this.previousRatio);
      this.locked = true;
      return;
    }
    this.previousRatio = 0;
    if (fps >= TARGET_FPS || this.ratio <= MIN_PIXEL_RATIO) return;

    // Fill cost goes with pixel count, i.e. the ratio squared — aim straight
    // at 60 rather than creeping down a fixed step per second.
    const next = Math.max(MIN_PIXEL_RATIO, this.ratio * Math.max(0.6, Math.sqrt(fps / 60)));
    this.previousRatio = this.ratio;
    this.previousFps = fps;
    this.apply(Math.round(next * 100) / 100);
  }

  get pixelRatio(): number {
    return this.ratio;
  }
}
