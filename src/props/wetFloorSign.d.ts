import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment.

export interface WetFloorSign {
  readonly object: THREE.Object3D;
  /**
   * Electrocutes whatever stepped in the puddle: bolts up over it, sparks, a
   * blue flicker and the sign rattling. `height` is how far up the bolts
   * reach — pass the robot's own height so a tall one isn't zapped at the
   * knees. Resolves false if already running.
   */
  activate(options?: { height?: number }): Promise<boolean>;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createWetFloorSign(options?: { reducedMotion?: boolean }): WetFloorSign;
