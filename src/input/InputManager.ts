export class InputManager {
  private down = new Set<string>();
  // Keys held by the on-screen touch controls (see TouchControls.ts), kept
  // apart from the keyboard's so lifting a finger can't release a key the
  // keyboard is still holding, or the other way round. Everything that reads
  // input (Robot.update()'s isDown() calls, Game.ts's START_KEYS and
  // fresh-press diffs) sees the union and can't tell the two apart.
  private virtualDown = new Set<string>();
  // A tap can land and lift between two frames — pointerdown and pointerup in
  // the same event-loop turn — and the game only samples keys once per tick,
  // so a quick tap on Jump would never be seen. A virtual key pressed since
  // the last endFrame() therefore stays down until that frame has read it.
  private pressedThisFrame = new Set<string>();
  private pendingRelease = new Set<string>();
  private merged = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => this.down.add(e.code);
  private onKeyUp = (e: KeyboardEvent) => this.down.delete(e.code);

  isDown(code: string): boolean {
    return this.down.has(code) || this.virtualDown.has(code);
  }

  /** Snapshot of every key currently held — for callers that need to diff frame-to-frame (e.g. detecting a fresh "any key" press without re-triggering on a key that was already held before). */
  downKeys(): ReadonlySet<string> {
    if (this.virtualDown.size === 0) return this.down;
    this.merged.clear();
    for (const code of this.down) this.merged.add(code);
    for (const code of this.virtualDown) this.merged.add(code);
    return this.merged;
  }

  /** Holds `code` down on behalf of an on-screen control, exactly as if the key were pressed. */
  pressVirtual(code: string): void {
    this.virtualDown.add(code);
    this.pressedThisFrame.add(code);
    this.pendingRelease.delete(code);
  }

  /** Lets go of a virtual key — deferred to the end of the frame if no frame has seen it yet (see pressedThisFrame). */
  releaseVirtual(code: string): void {
    if (this.pressedThisFrame.has(code)) this.pendingRelease.add(code);
    else this.virtualDown.delete(code);
  }

  /** Drops every virtual key at once — for blur/visibility changes, where a pointerup may never arrive. */
  releaseAllVirtual(): void {
    this.virtualDown.clear();
    this.pressedThisFrame.clear();
    this.pendingRelease.clear();
  }

  /** Called once at the end of Game.tick(), after the frame has sampled input. */
  endFrame(): void {
    for (const code of this.pendingRelease) this.virtualDown.delete(code);
    this.pendingRelease.clear();
    this.pressedThisFrame.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
