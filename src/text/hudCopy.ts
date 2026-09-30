// UI chrome copy — level labels/prompts, each level's intro panel, and the
// various HUD messages/end-screen strings. Lower tone-review risk than
// attendeeDialogue.ts/robotToasts.ts/knowledgeQuotes.ts (this is mostly plain
// status text, not jokes), but centralized here too so it's all
// reviewable/translatable in one place. Consumed by src/ui/Hud.ts and (for
// the on-screen buttons' own labels) src/input/TouchControls.ts.

/** Per-level item/label/prompt copy — see Hud.ts's update() and buildDayEndHtml(). */
export const LEVEL_COPY: Record<1 | 2 | 3, { itemLabel: string; collectedNoun: string; nextPrompt: string }> = {
  1: { itemLabel: 'Swag', collectedNoun: 'swag', nextPrompt: 'Press any key for Level 2' },
  2: { itemLabel: 'Knowledge', collectedNoun: 'knowledge', nextPrompt: 'Press any key for Level 3' },
  // Level 3 ending is always "the day" ending too (see DayEndSummary in
  // Hud.ts) — this plain nextPrompt only ever surfaces as a defensive
  // fallback if a summary somehow isn't available yet. R specifically, not
  // any key — Game.ts's tick() requires the same for the real end screen.
  3: { itemLabel: 'Sandwiches', collectedNoun: 'sandwiches', nextPrompt: 'Press R to start a new day' },
};

export const ENERGY_LABEL = '⚡ Energy';
export const HUNGER_LABEL = '🍽️ Hunger';

/** Top-bar score readout, e.g. "Swag: 3" (see Hud.ts's update()). */
export function scoreLabel(itemLabel: string, score: number): string {
  return `${itemLabel}: ${score}`;
}

/** Top-bar clock readout — counts down for Levels 1-2, counts up for Level 3's endless mode. */
export function timeRemainingLabel(seconds: number): string {
  return `Time: ${Math.ceil(seconds)}s`;
}
export function survivedLabel(seconds: number): string {
  return `Survived: ${Math.floor(seconds)}s`;
}

/**
 * Shown at the bottom of every intro panel — load-bearing, not decoration:
 * the level genuinely doesn't start until a control key is pressed (see
 * Game.ts's `awaitingStart`), so without this line a player who taps Enter
 * or Escape sees a frozen world and reads it as broken. Says "movement key"
 * rather than "any key" because only the movement/boost/jump keys actually
 * start the run — the level-finished screen's own "press any key" prompt
 * (LEVEL_COPY.nextPrompt) is a different screen with different rules.
 */
export const INTRO_START_HINT = 'Press a movement key to start';

/**
 * Per-level intro panel (see Hud.ts's showIntro()) — title/description/
 * controls shown at the start of every level, not just the very first
 * (used to be a short two-line banner that auto-faded after 2.6s for
 * Levels 2-3; the user: "keep this shown until any key is pressed," same as
 * Level 1 already did, and fill in details that had gone missing — Biggy's
 * hunger bar and the fact that a fall now takes 3 close-together hits, not
 * one). Since 2026-09-29 the panel is dismissed by a *control* key rather
 * than any key, and the level stays frozen until then (see INTRO_START_HINT
 * above and Game.ts's `awaitingStart`) — the user: "the game is already
 * running while reading the text." Note the `&#10;` line breaks in `controls` — these pair with the
 * panel's `white-space: pre-line` CSS, not a literal `\n`.
 */
export const LEVEL_INTROS: Record<1 | 2 | 3, { title: string; description: string; controls: string }> = {
  1: {
    title: 'Level 1 — Swag Run',
    description: "Collect the swag before time runs out — avoid the attendees, they'll make you drop it!",
    controls: 'WASD / Arrows — move&#10;Shift — boost (uses ⚡ energy)&#10;Space — jump (uses ⚡ energy)',
  },
  2: {
    title: 'Level 2 — Knowledge Run',
    description:
      "Collect the conference wisdom before the talk starts — a hazard's bump topples Droid, and he's slow to get back up!",
    controls: 'WASD / Arrows — move&#10;Shift — boost (uses ⚡ energy)&#10;Space — jump (uses ⚡ energy)',
  },
  3: {
    title: 'Level 3 — Lunch Rush',
    description:
      "Endless mode — keep Biggy's 🍽️ Hunger up by eating (it drains faster the longer you survive), but every bite makes him bigger, slower, and easier to knock down. Once he's big enough, it takes 3 hits close together to end the run — one bump alone is just a stumble. Boosting still lets you outrun the crowd, as long as you've got ⚡ energy.",
    controls: 'WASD / Arrows — move&#10;Shift — boost (uses ⚡ energy)&#10;Space — jump onto a table to eat',
  },
};

/** Defensive fallback message if Level 3 ever finishes without a DayEndSummary (see Hud.ts's update()). */
export function fellMessageFallback(itemLabel: string, score: number, nextPrompt: string): string {
  return `I've fallen and I can't get up!\n${itemLabel} eaten: ${score}\n${nextPrompt}`;
}

/** Levels 1-2's early-finish message (every pickup found before time ran out). */
export function allCollectedMessage(collectedNoun: string, timeBonus: number, itemLabel: string, score: number, nextPrompt: string): string {
  return `All ${collectedNoun} collected!\nTime bonus: +${timeBonus}\n${itemLabel} collected: ${score}\n${nextPrompt}`;
}

/** Levels 1-2's plain time-out message. */
export function timeUpMessage(itemLabel: string, score: number, nextPrompt: string): string {
  return `Time's up!\n${itemLabel} collected: ${score}\n${nextPrompt}`;
}

// "A Day at Devoxx" end screen (see Hud.ts's buildDayEndHtml()) — the
// comedic Biggy game-over beat doubles as the end of the whole day.
export const DAY_END_TITLE = "I've fallen and I can't get up!";
export const DAY_END_ROW_LABELS = {
  voxxy: 'Voxxy — Swag Run',
  droid: 'Droid — Knowledge Run',
  biggy: 'Biggy — Lunch Rush',
  total: 'TOTAL FOR THE DAY',
};
export const NEW_BEST_TEXT = 'New Personal Best!';
export function personalBestText(best: number): string {
  return `Personal Best: ${best} pts`;
}
export const PRESS_R_NEW_DAY = 'Press R to start a new day';

// On-screen touch controls (see src/input/TouchControls.ts) — phones,
// tablets, in-car screens, anything without a keyboard. When they're showing,
// every line above that names a key has a tap-shaped twin here, picked by
// Hud.ts's touch mode; the keyboard keeps working either way.
export const TOUCH_INTRO_CONTROLS: Record<1 | 2 | 3, string> = {
  1: 'Left stick — move&#10;BOOST — hold to boost (uses ⚡ energy)&#10;JUMP — jump (uses ⚡ energy)',
  2: 'Left stick — move&#10;BOOST — hold to boost (uses ⚡ energy)&#10;JUMP — jump (uses ⚡ energy)',
  3: 'Left stick — move&#10;BOOST — hold to boost (uses ⚡ energy)&#10;JUMP — jump onto a table to eat',
};
export const TOUCH_INTRO_START_HINT = 'Touch a control to start';
export const TOUCH_NEXT_PROMPT: Record<1 | 2 | 3, string> = {
  1: 'Touch any control for Level 2',
  2: 'Touch any control for Level 3',
  3: 'Tap NEW DAY to start a new day',
};
export const TOUCH_NEW_DAY = 'Tap NEW DAY to start a new day';
export const TOUCH_BUTTON_LABELS = { jump: 'JUMP', boost: 'BOOST', newDay: 'NEW DAY' };
/** The intro panel's show/hide switch for the touch controls. */
export function touchToggleLabel(on: boolean): string {
  return on ? '👆 Touch controls: ON' : '👆 Touch controls: OFF';
}
/** Phone-sized screens fold the minimap away behind this chip (see Hud.ts's applyMinimapLayout()). */
export const MINIMAP_CHIP_LABEL = '🗺️ MAP';
export const MINIMAP_TAP_TO_HIDE = 'Tap to hide the map';
