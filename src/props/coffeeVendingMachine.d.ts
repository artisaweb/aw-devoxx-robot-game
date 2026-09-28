import type * as THREE from 'three';

// Hand-written ambient declaration for coffeeVendingMachine.js — kept as
// plain JS (not converted to .ts) so it stays a straightforward diff against
// the original AI-generated source if it's ever regenerated. TypeScript
// picks this file up automatically for any `import ... from './coffeeVendingMachine'`
// (a .d.ts beside a same-named .js satisfies module resolution on its own,
// no `allowJs` needed).

export interface CoffeeVendingMachine {
  readonly object: THREE.Object3D;
  /** Starts one brew cycle (~10s total). Resolves false immediately if busy/out of stock, true once the cup is ready. Visual only — do not gate gameplay rewards on this resolving. */
  activate(): Promise<boolean>;
  setOutOfStock(outOfStock: boolean): void;
  readonly outOfStock: boolean;
  /** True while a brew cycle's animation is still playing. */
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createCoffeeVendingMachine(options?: { reducedMotion?: boolean }): CoffeeVendingMachine;
