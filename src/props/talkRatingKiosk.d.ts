import type * as THREE from 'three';

// See coffeeVendingMachine.d.ts's own comment.

export type TalkRating = 'good' | 'ok' | 'bad';

export interface TalkRatingKiosk {
  readonly object: THREE.Object3D;
  /** Presses one of the three buttons and plays the thank-you. Resolves false if already running. */
  activate(rating?: TalkRating): Promise<boolean>;
  readonly votes: { good: number; ok: number; bad: number };
  readonly busy: boolean;
  update(dt: number): void;
  dispose(): void;
}

export function createTalkRatingKiosk(options?: { reducedMotion?: boolean }): TalkRatingKiosk;
