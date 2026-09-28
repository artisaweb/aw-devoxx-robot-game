// A robot's own narrator-style toast lines — a deadpan or self-deprecating
// aside about itself, not attendee speech (see attendeeDialogue.ts for that),
// shown via Hud.showQuoteToast(). Kept as its own category rather than merged
// into attendeeDialogue.ts's arrays since who's "speaking" is genuinely
// different. Same random-pick shape as attendeeDialogue.ts's accessors.

/**
 * Droid's deadpan lines shown the instant a topple starts, via
 * Hud.showQuoteToast().
 */
export const DROID_TOPPLE_TOASTS = [
  'Balance.exe has stopped responding.',
  'Recalculating... from the floor.',
  'That one is going in the post-mortem.',
  'Core dumped. Send help.',
];

/**
 * Biggy's own aside the instant his hunger meter crosses into the low band
 * (see LunchRush.ts's HUNGER_LOW_THRESHOLD) — a warning that's still in his
 * voice rather than a bare HUD number, same "human reaction" spirit as
 * the other toast categories in this file.
 */
export const HUNGER_LOW_TOASTS = [
  "Biggy's stomach is staging a protest.",
  'Biggy could really go for a snack right about now.',
];

/**
 * Shown the instant hunger actually hits zero — this is Biggy's *other*
 * permanent-fall trigger alongside a diner knocking him over (see
 * FALL_THRESHOLD in LunchRush.ts), so it gets its own distinct line rather
 * than reusing "I've fallen and can't get up," which is specifically about
 * being knocked over, not running out of steam.
 */
export const HUNGER_STARVED_TOASTS = [
  "Biggy's stomach finally caught up with his ambitions.",
  'Ran out of fuel. Mayonnaise reserves: critical.',
  'Even Biggy has limits. Turns out this was one.',
];

/**
 * Shown after a bump lands while Biggy's already wobbling, one hit away from
 * the real fall (see FALL_HIT_COMBO_REQUIRED in LunchRush.ts) — a clear
 * "get clear now" warning in his own voice, distinct from the growth/hunger
 * toasts since it's about immediate danger, not a milestone.
 */
export const WOBBLING_TOASTS = [
  "One more bump and it's floor time.",
  "Biggy's doing the math on how bad this fall would be.",
  'Steady... steady... this is not steady.',
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function randomDroidToppleToast(): string {
  return pick(DROID_TOPPLE_TOASTS);
}

export function randomHungerLowToast(): string {
  return pick(HUNGER_LOW_TOASTS);
}

export function randomHungerStarvedToast(): string {
  return pick(HUNGER_STARVED_TOASTS);
}

export function randomWobblingToast(): string {
  return pick(WOBBLING_TOASTS);
}
