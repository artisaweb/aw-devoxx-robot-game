import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern.

export interface CandyGrabbingMachine {
  readonly object: THREE.Object3D;
  /** One claw grab. Resolves false immediately if busy/out of stock, true once the sweet lands in the tray. Visual only — do not gate gameplay rewards on this resolving. */
  activate(): Promise<boolean>;
  setOutOfStock(outOfStock: boolean): void;
  readonly outOfStock: boolean;
  /** True while a grab cycle's animation is still playing. */
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createCandyGrabbingMachine(options?: { reducedMotion?: boolean }): CandyGrabbingMachine;
