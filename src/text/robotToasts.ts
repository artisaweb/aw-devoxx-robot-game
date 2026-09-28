// A robot's own narrator-style toast lines — a deadpan or self-deprecating
// aside about itself, not attendee speech (see attendeeDialogue.ts for that),
// shown via Hud.showQuoteToast(). Kept as its own category rather than merged
// into attendeeDialogue.ts's arrays since who's "speaking" is genuinely
// different — same reasoning docs/robot-characteristics.md gives for keeping
// these separate. Same random-pick shape as attendeeDialogue.ts's accessors.

/**
 * Biggy's own aside about visibly getting bigger — shown via
 * Hud.showQuoteToast() every GROWTH_TOAST_EVERY sandwiches (see
 * LunchRush.ts). Never a complaint, just affectionate self-directed ribbing
 * at his own expense (matches "robots are earnest" — he's in on the joke).
 */
export const GROWTH_TOASTS = [
  'Biggy definitely runs on mayonnaise now.',
  'Somewhere, a structural engineer is concerned.',
  'New personal record: forklift required.',
  "Biggy's turning radius now has its own zip code.",
  'At this rate, Biggy qualifies as a food group.',
  "Biggy has entered his 'big lunch era'.",
  'Someone should mention portion control. Too late now.',
  "Biggy's shadow just got its own postal code.",
];

/**
 * Droid's deadpan lines shown the instant a topple starts (see
 * docs/robot-characteristics.md "Droid's topple — worked out in detail"),
 * via Hud.showQuoteToast(), same pattern as GROWTH_TOASTS above.
 */
export const DROID_TOPPLE_TOASTS = ['...I meant to do that.', 'Systems nominal. Pride: not.'];

/**
 * Biggy's own aside the instant his hunger meter crosses into the low band
 * (see LunchRush.ts's HUNGER_LOW_THRESHOLD) — a warning that's still in his
 * voice rather than a bare HUD number, same "human reaction" spirit as
 * GROWTH_TOASTS above.
 */
export const HUNGER_LOW_TOASTS = [
  "Biggy's stomach is staging a protest.",
  'Somewhere, a vending machine is calling his name.',
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

export function randomGrowthToast(): string {
  return pick(GROWTH_TOASTS);
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
