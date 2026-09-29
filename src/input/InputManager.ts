export class InputManager {
  private down = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => this.down.add(e.code);
  private onKeyUp = (e: KeyboardEvent) => this.down.delete(e.code);

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Snapshot of every key currently held — for callers that need to diff frame-to-frame (e.g. detecting a fresh "any key" press without re-triggering on a key that was already held before). */
  downKeys(): ReadonlySet<string> {
    return this.down;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
