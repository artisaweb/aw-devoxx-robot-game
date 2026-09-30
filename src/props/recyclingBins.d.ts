import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment.

export type RecyclingBinType = 'pmd' | 'paper' | 'rest';

export interface RecyclingStation {
  readonly object: THREE.Object3D;
  /** Drops something in through that bin's flap. Resolves false if the bin is full or already running. */
  activate(type?: RecyclingBinType): Promise<boolean>;
  setFull(type: RecyclingBinType, full: boolean): void;
  isFull(type: RecyclingBinType): boolean;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createRecyclingStation(options?: { reducedMotion?: boolean }): RecyclingStation;
