// All attendee/NPC speech-bubble copy lives here — one place to read and edit
// text without touching rendering code (speechBubble.ts) or gameplay logic
// (SwagRun.ts).
//
// Tone rule: everything here stays positive toward the event itself — no
// complaints about Devoxx/the venue/the organization, no bad vibes, nothing
// framed as theft, even playfully. That's a narrower rule than "no mishaps
// ever," though: griping about *each other* (someone beat you to the last
// crab sandwich) or shared developer folklore (the "demo gods" failing a
// live-coding talk — a real, beloved self-aware running joke speakers make
// about themselves, not a complaint about Devoxx) is fair game as long as it
// actually lands as funny rather than frustrated. Genuinely frustrated-
// attendee jokes — wifi complaints, cold coffee, endless queues, stolen
// badges — stay out entirely, with one narrow exception: "comic censoring"
// (grawlix-style #@!% standing in for swearing) is fine for a startled,
// self-directed exclamation at the moment of a mishap (spilling your own
// coffee, say) rather than a complaint — see the one hit-reaction line below
// that uses it. Deliberately just the one, though, not every line — it reads
// as a fun exception, not the norm.
//
// Several lines below are original jokes written from real Devoxx/
// dev-conference *themes* (crab sandwiches, schedule FOMO, the Kinepolis
// cinema venue, the "hallway track", sticker-collecting culture) rather than
// any specific person's actual words — same "inspired by, never copied" rule
// as the robot models and the NPC archetypes' speaker-style likenesses.

/** Shown periodically while a Level 1 hazard wanders (not while actively chasing) — pure flavor, no gameplay effect. */
export const AMBIENT_GRIPES = [
  "IT'S PASTA INSTEAD OF SANDWICHES TODAY?!", // the crab-sandwich craving, with a menu-swap twist
  'HAS ANYONE SEEN MY BADGE?',
  'ANYONE GOT A SPARE LAPTOP CHARGER?',
  'THE DEMO GODS SAID NO TODAY.', // the real, beloved "demo gods" running joke — self-aware, not a complaint about Devoxx
  'WHAT\'S THE WIFI PASSWORD AGAIN?', // same real theme as before, reframed as a friendly ask instead of a complaint
  'THREE GREAT TALKS, ONE ME!', // the classic overlapping-schedule FOMO, framed as excitement, not annoyance
  'WHICH SCREENING ROOM WAS I IN AGAIN?', // Kinepolis's numbered auditoriums, a real venue detail
  'I NEED MORE LAPTOP STICKERS!', // sticker-collecting from sponsor booths is real conference culture
  'THESE SEATS ARE SO COMFY, I ALMOST DOZED OFF', // it's a literal cinema — reclined movie seats, not conference chairs
  'WHAT TIME IS THE MOVIE?', // leans straight into "wait, this is a cinema"
  'WHAT TALK ARE YOU HEADED TO NEXT?', // the "hallway track" chatter Devoxx is known for
];

/**
 * Shown the instant a Level 1 hazard collides with / splashes the robot —
 * the attendee's reaction to spilling a drink on Voxxy *and* ending up with
 * whatever swag he just dropped. Distinct tone from the ambient lines above:
 * short reaction barks rather than wandering-around chatter. Kept
 * good-natured/apologetic — never framed as taking something on purpose —
 * attendees are comic relief, not antagonists, same "earnest, no villains"
 * rule as the robots themselves.
 */
export const HIT_REACTIONS = [
  'OOPS, MY BAD!',
  'NICE SWAG, THANKS!',
  'WHOOPSIE DAISY!',
  'SORRY, IT WAS HOT JAVA COFFEE!', // nice double meaning with the JAVA machine, and "hot" explains the short-circuit
  'OH #@!%, SORRY!', // the one grawlix-censored line — a startled reaction to the mishap itself, not a complaint
];

// Level 2 (Knowledge Run, first floor) — eager attendees rushing to grab a
// seat before a packed hero talk, a "seat-saving"
// hazard flavor. Same two-tier shape as Level 1's lines above (ambient
// wander-time chatter vs. a short reaction the instant they bump the robot),
// reskinned for the corridor/auditorium setting. Same positivity rule as
// above — enthusiasm about getting a good seat, not complaints about the venue.
export const CONFUSED_GRIPES = [
  'IS THIS EVEN THE RIGHT ROOM?',
  'ANYONE REMEMBER THE WIFI PASSWORD?',
  'THAT KEYNOTE WAS SO GOOD I FORGOT TO SIT DOWN!',
  'SAVE ME A SEAT, WILL YOU?',
];

export const CONFUSED_REACTIONS = [
  'SORRY, GOTTA GET A SEAT!',
  "EXCUSE ME, IT'S STARTING!",
  'IS THIS SEAT TAKEN — OH!',
  'SORRY, FRONT ROW OR BUST!',
  'WHOOPS, WRONG ROOM, WRONG ROBOT!',
];

// Level 3 (Lunch Rush, ground floor redressed) — attendees queueing for
// sandwiches, watching Biggy get visibly bigger with every one he eats.
// Three tiers instead of two, since this level added a real chase state (see
// LunchRush.ts): ambient queue chatter (teasing Biggy's size — affectionate,
// same "friendly fun" rule as every other hit-reaction in this file, never
// mean-spirited), a line barked the instant an attendee breaks off the queue
// to chase down a sandwich Biggy just grabbed nearby (food rivalry between
// attendees/robot, not a complaint about the event — same reasoning that
// already cleared "who took all the crab sandwiches"), and a line for
// actually catching him.
export const LUNCH_QUEUE_LINES = [
  "WHERE'S MY CRAB SANDWICH?!", // the flagship joke — they're famous and disappear fast
  'WHO ATE ALL THE CRAB SANDWICHES?!', // griping about fellow attendees, not the event — and "classic" frames it as fond tradition, not a real complaint
  'IS THAT ROBOT GETTING BIGGER?',
  'I SWEAR HE RUNS ON MAYONNAISE.',
  "HE'S HAD LIKE TEN OF THOSE ALREADY.",
  'AT THIS POINT HE IS PART OF THE BUFFET.',
  'WATCH OUT, HE IS ROLLING THIS WAY.',
];

// Two lines below were moved out of robotToasts.ts's GROWTH_TOASTS (dropped
// entirely — those leaned too hard on Biggy's size/weight itself, read as
// fat-shaming rather than affectionate ribbing). These two are about the
// comedic *volume of sandwiches eaten*, not his body, so they survive here as
// attendee reaction barks instead of Biggy's own self-directed toast.
export const LUNCH_CHASE_LINES = [
  'HEY, THAT ONE WAS MINE!',
  'I CALLED THAT SANDWICH!',
  'EXCUSE ME, I WAS NEXT!',
  "OH NO YOU DON'T!",
  'HE DEFINITELY RUNS ON MAYONNAISE!',
  'SOMEBODY CALL A STRUCTURAL ENGINEER!',
];

export const LUNCH_CAUGHT_REACTIONS = [
  'MINE NOW!',
  'BACK OF THE LINE, BIGGY!',
];

// Said when Biggy simply bumps into a queued/approaching attendee who
// wasn't chasing him — an accidental collision, not a food-rivalry moment,
// so it gets its own apologetic tone rather than reusing Level 1's swag
// pool (which doesn't fit a level with no swag) or the triumphant "caught
// you" lines above (which don't fit an accident either).
export const LUNCH_BUMP_REACTIONS = [
  'OOPS, PARDON ME!',
  'WATCH THE ELBOWS!',
  'WHOA, INCOMING!',
  'CAREFUL THERE, BIGGY!',
];

function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function randomGripe(): string {
  return pick(AMBIENT_GRIPES);
}

export function randomHitReaction(): string {
  return pick(HIT_REACTIONS);
}

export function randomConfusedGripe(): string {
  return pick(CONFUSED_GRIPES);
}

export function randomConfusedReaction(): string {
  return pick(CONFUSED_REACTIONS);
}

export function randomLunchQueueLine(): string {
  return pick(LUNCH_QUEUE_LINES);
}

export function randomLunchChaseLine(): string {
  return pick(LUNCH_CHASE_LINES);
}

export function randomLunchCaughtReaction(): string {
  return pick(LUNCH_CAUGHT_REACTIONS);
}

export function randomLunchBumpReaction(): string {
  return pick(LUNCH_BUMP_REACTIONS);
}
