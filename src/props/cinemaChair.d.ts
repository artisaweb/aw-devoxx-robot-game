import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern.

export interface CinemaChair {
  readonly object: THREE.Object3D;
  /** Folds the seat down, or back up; resolves when it has settled. */
  activate(): Promise<boolean>;
  readonly seatDown: boolean;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createCinemaChair(options?: {
  number?: number;
  color?: number;
  seatDown?: boolean;
  leftArm?: boolean;
  rightArm?: boolean;
  reducedMotion?: boolean;
}): CinemaChair;
