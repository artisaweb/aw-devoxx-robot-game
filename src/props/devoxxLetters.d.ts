import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern. Static prop: no
// activate()/update(), just object + dispose().

export interface DevoxxLetters {
  readonly object: THREE.Object3D;
  /** Total width of the wordmark in metres, from the glyphs' own bounding boxes. */
  readonly width: number;
  /** Per-glyph local x offset (z is always 0) + footprint radius, for the caller's own Collider list — see the .js file's own comment. */
  readonly letterColliders: readonly { readonly x: number; readonly radius: number }[];
  dispose(): void;
}

export function createDevoxxLetters(options?: {
  height?: number;
  depth?: number;
  color?: number;
  accentColor?: number;
  emissiveIntensity?: number;
}): DevoxxLetters;
