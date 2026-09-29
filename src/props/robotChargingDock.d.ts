import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern. Animated like the beer tap and
// the DEVOXX letters: update(dt) every frame, activate() on use.

export interface RobotChargingDock {
  readonly object: THREE.Object3D;
  /** Radius of the walk-on floor pad (it is under AUTO_STEP_HEIGHT, so it has no collider of its own). */
  readonly padRadius: number;
  /** The charging column's footprint, local to the dock's origin and before rotation — it stands behind the pad at -Z. */
  readonly columnCollider: { readonly x: number; readonly z: number; readonly radius: number };
  /** Plays the ~8s charge/hold/fade cycle. Visual only; resolves false if already running. */
  activate(): Promise<boolean>;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createRobotChargingDock(options?: { reducedMotion?: boolean }): RobotChargingDock;
