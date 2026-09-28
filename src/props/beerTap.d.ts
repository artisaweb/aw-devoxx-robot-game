import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern.

export interface BeerTap {
  readonly object: THREE.Object3D;
  /** Pours one glass. Resolves false immediately if busy/out of stock, true once the glass is full. Visual only — do not gate gameplay effects (Robot.applyTipsy) on this resolving. */
  activate(): Promise<boolean>;
  setOutOfStock(outOfStock: boolean): void;
  readonly outOfStock: boolean;
  /** True while a pour cycle's animation is still playing. */
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createBeerTap(options?: { reducedMotion?: boolean }): BeerTap;
