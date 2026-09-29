import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment — same hand-written
// ambient-declaration-beside-plain-JS pattern. Like the beer tap (and unlike
// the purely static furniture), this one animates: it needs update(dt) every
// frame and activate() on contact.

export interface DevoxxLetters {
  readonly object: THREE.Object3D;
  /** The glyphs actually built, in order — index into this for activate()/isStanding(). */
  readonly letters: readonly string[];
  /** Total width of the wordmark in metres. */
  readonly width: number;
  /** Per-glyph local x offset (z is always 0) + footprint radius, for the caller's own Collider list — see the .js file's own comment. */
  readonly letterColliders: readonly { readonly x: number; readonly radius: number }[];
  /** False from the moment glyph `i` starts tipping over. */
  isStanding(i: number): boolean;
  /** True only once glyph `i` is all the way down and settled — false for the whole fall. */
  isFallen(i: number): boolean;
  /** Topples the given glyph (or a random standing one), or stands it back up if it's already down. Resolves false if it's mid-animation. */
  activate(index?: number): Promise<boolean>;
  /** Stands every glyph back up immediately. */
  reset(): void;
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createDevoxxLetters(options?: {
  text?: string;
  height?: number;
  depth?: number;
  gap?: number;
  color?: number;
  hashColor?: number;
  accentColor?: number;
  accentLast?: boolean;
  reducedMotion?: boolean;
}): DevoxxLetters;
