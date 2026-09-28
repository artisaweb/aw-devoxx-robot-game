/**
 * True when the page is being served from a local dev server rather than a
 * real deployment — gates debug-only features (URL query params that jump
 * levels/teleport the robot, the on-screen coordinate readout) so they're
 * unavailable once the game is actually hosted, not just discouraged.
 */
export function isLocalHost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}
