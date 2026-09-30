import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern as every other prop here.

export interface RubberDuck {
  readonly object: THREE.Object3D;
  /** Squeeze and wobble. Visual only; resolves false if already running. */
  activate(): Promise<boolean>;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

/** `size` is the duck's length in metres (default 0.12 — a real bath duck). */
export function createRubberDuck(options?: { size?: number; color?: number; reducedMotion?: boolean }): RubberDuck;
