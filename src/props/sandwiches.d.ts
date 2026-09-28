import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern.

export type SandwichTypeId = 'crab' | 'club' | 'cheese' | 'ham-cheese' | 'tuna' | 'chicken-curry';

export const SANDWICH_TYPES: ReadonlyArray<{ readonly id: SandwichTypeId; readonly label: string }>;

export interface Sandwich {
  readonly object: THREE.Object3D;
  readonly type: SandwichTypeId;
  readonly label: string;
  /** A small hop-and-spin (~1.1s). Resolves false while one is still playing. Visual only — do not gate gameplay rewards (score/growth) on this resolving, same reasoning as the machines' activate(). */
  activate(): Promise<boolean>;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createSandwich(type?: SandwichTypeId, options?: { reducedMotion?: boolean }): Sandwich;
