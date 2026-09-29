export type SfxName =
  | 'pickup'
  | 'hit'
  | 'timer-low'
  | 'energy-empty'
  | 'voxxy-shortcircuit'
  | 'droid-thud'
  | 'droid-getup'
  | 'biggy-fall'
  | 'beer-pour'
  | 'biggy-burp';

const DEFAULT_VOLUME = 0.55;

/**
 * Fire-and-forget playback. `play()` returns a Promise that rejects if the
 * browser blocks it (no user gesture registered yet, tab backgrounded, etc.)
 * — never let that surface as an unhandled rejection, same tolerance this
 * project already gives other best-effort browser APIs (clipboard writes,
 * localStorage).
 */
export function playSfx(name: SfxName, volume = DEFAULT_VOLUME): void {
  const audio = new Audio(`/audio/${name}.wav`);
  audio.volume = volume;
  audio.play().catch(() => {});
}
