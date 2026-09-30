import * as THREE from 'three';
import { HALL_WIDTH, HALL_DEPTH, Collider, LUNCH_TABLE_ZONES } from '../scene/ExhibitionHall';
import { Robot, ROBOT_RADIUS, WALL_CLEARANCE } from '../entities/Robot';
import { createGlowSprite, HALO_BASE_SIZE, BEACON_BASE_SIZE, BEACON_HEIGHT } from './swagAccessories';
import { AttendeeArchetype, createAttendeeMesh } from './attendeeModels';
import { createVendingMachine, createCandyMachine, KIOSK_COLLIDER_RADIUS, CoffeeVendingMachine, CandyGrabbingMachine } from './vendingMachine';
import { KING_KIOSK_POS, BEER_TAP_POS, BEER_TAP_COLLIDER_RADIUS } from '../scene/sponsorBooths';
import { BeerTap } from '../props/beerTap';
import { createSandwich, Sandwich } from '../props/sandwiches';
import { createSpeechBubble, SpeechBubble } from './speechBubble';
import { randomLunchQueueLine, randomLunchChaseLine, randomLunchCaughtReaction, randomLunchBumpReaction } from '../text/attendeeDialogue';
import { randomHungerLowToast, randomHungerStarvedToast, randomWobblingToast } from '../text/robotToasts';

// Level 3 — Biggy, "Lunch Rush". Same ground-floor map as Voxxy's Swag Run,
// redressed for lunchtime rather than a fourth separate map. Deliberately
// NOT the same engine shape as Levels 1-2 in one important way: there is no
// round timer and no early-finish — this is Biggy's own endless/high-score
// mode (see "finished" below), so `update()`'s return/consumption shape
// differs from SwagRun/KnowledgeRun's.

// Built from the standalone sandwiches.js generator (src/props/) instead of
// a hand-built shared mesh with a swappable filling color — each type has
// its own fixed, distinct visual now, so SANDWICH_FILLING_COLOR is gone.
// sandwiches.js ships 6 types (crab, club, cheese, ham-cheese, tuna,
// chicken-curry) with no vegetarian match for the old 'veggie' — kept the
// roster at 4 total (3 commons + the crab jackpot, same shape as before)
// rather than expanding the balance-tuning surface: 'cheese' is a direct
// rename, 'ham-cheese' takes over 'ham''s old tuning (closest match),
// 'club' takes over 'veggie''s old slot/tuning (new visual, same numbers —
// not a rebalance, just carrying the old values to their new type names).
type SandwichType = 'crab' | 'club' | 'cheese' | 'ham-cheese';
const COMMON_TYPES: SandwichType[] = ['ham-cheese', 'club', 'cheese'];

// Score + growth per sandwich — eating is a self-inflicted difficulty ramp,
// not a free good thing. Crab is the jackpot: best
// score, biggest size hit, rare, and short-lived on the table (see
// CRAB_SPAWN_CHANCE/CRAB_LIFETIME below) — a real risk/reward call.
const SANDWICH_SCORE: Record<SandwichType, number> = { 'ham-cheese': 1, club: 1, cheese: 1, crab: 5 };
// Trimmed down from the original 0.12/0.1/0.14/0.3 (the user: "biggy is still
// growing way too fast") — on top of Robot.grow()'s own late-run taper, since
// a smaller flat rate is what actually slows the *early* game, when the taper
// itself is still at full strength.
const SANDWICH_GROWTH: Record<SandwichType, number> = { 'ham-cheese': 0.08, club: 0.07, cheese: 0.1, crab: 0.2 };

// Six separate small tables rather than one long buffet row — see
// ExhibitionHall.ts's LUNCH_TABLE_ZONES for why "between" and "hall-center"
// are each split into two (the user: wide tables gave the player a permanent
// safe spot a chaser could never route around). Positions/sizes live there
// (so the tables are real jumpable/standable platforms, not just decoration)
// — these tuples are read from it rather than duplicated, same convention
// BOOTH_PLATFORM_ZONES already established.
const LEFT_TABLE_POS: [number, number] = [LUNCH_TABLE_ZONES[0].x, LUNCH_TABLE_ZONES[0].z];
const BETWEEN_A_POS: [number, number] = [LUNCH_TABLE_ZONES[1].x, LUNCH_TABLE_ZONES[1].z];
const BETWEEN_B_POS: [number, number] = [LUNCH_TABLE_ZONES[2].x, LUNCH_TABLE_ZONES[2].z];
const RIGHT_TABLE_POS: [number, number] = [LUNCH_TABLE_ZONES[3].x, LUNCH_TABLE_ZONES[3].z];
const MIDDLE_A_POS: [number, number] = [LUNCH_TABLE_ZONES[4].x, LUNCH_TABLE_ZONES[4].z];
const MIDDLE_B_POS: [number, number] = [LUNCH_TABLE_ZONES[5].x, LUNCH_TABLE_ZONES[5].z];

const SLOT_POSITIONS: [number, number][] = [
  [LEFT_TABLE_POS[0], LEFT_TABLE_POS[1] - 0.9],
  [LEFT_TABLE_POS[0], LEFT_TABLE_POS[1] + 0.9],
  [BETWEEN_A_POS[0] - 1, BETWEEN_A_POS[1]],
  [BETWEEN_A_POS[0] + 1, BETWEEN_A_POS[1]],
  [BETWEEN_B_POS[0] - 1, BETWEEN_B_POS[1]],
  [BETWEEN_B_POS[0] + 1, BETWEEN_B_POS[1]],
  [RIGHT_TABLE_POS[0], RIGHT_TABLE_POS[1] - 0.9],
  [RIGHT_TABLE_POS[0], RIGHT_TABLE_POS[1] + 0.9],
  [MIDDLE_A_POS[0], MIDDLE_A_POS[1]],
  [MIDDLE_B_POS[0], MIDDLE_B_POS[1]],
];
const PICKUP_RADIUS = 1.4;
// The tables are now real, solid, jumpable obstacles (see LUNCH_TABLE_ZONES
// in ExhibitionHall.ts) — their own ground-level collider pushes Biggy back
// to roughly (tableShortHalf 1.1 + wallClearance, up to 4.1 at
// MAX_SIZE_SCALE) from the sandwich itself, which sits on the table's own
// footprint. The user: "both is fine, when you jump on it, but also coming
// close enough in a position where your arm could theoretically fetch it"
// — so eating works two ways: jumped up on the table (tight PICKUP_RADIUS,
// same as standing right at it), or from ground level just outside the
// pushed-back distance (this wider radius, standing in for a reach across
// the edge) — see the onTable check in update() below.
const GROUND_REACH_RADIUS = 4.5;
/**
 * Biggy's own reach, which has to grow with him.
 *
 * GROUND_REACH_RADIUS above is tuned for an ungrown robot, and the diners
 * (who never grow) keep using it as-is. Biggy is different: his push-out
 * distance from every collider is `radius + WALL_CLEARANCE * growthScale`, so
 * the bigger he gets the further the table holds him off the sandwich sitting
 * on it — while a fixed reach stays put. Measured at MAX_SIZE_SCALE, that
 * silently put 4 of the 10 slots out of ground-level range, including both
 * ends of the right-hand table (the KING booth's colliders crowd it, so it
 * loses out first): closest he could get was 4.65m against a 4.5m reach.
 *
 * This is the same failure the JAVA machine already hit once ("i was running
 * into it and it did nothing"), which is why COFFEE_RADIUS and
 * BEER_TAP_RADIUS are both derived from MAX_SIZE_SCALE rather than guessed.
 * Scaling by the same WALL_CLEARANCE term that pushes him back keeps the two
 * in step at every size instead of only at the extremes.
 */
function groundReachFor(sizeScale: number): number {
  return GROUND_REACH_RADIUS + WALL_CLEARANCE * (sizeScale - 1);
}
const SANDWICH_SURFACE_Y = 0.8; // must match LUNCH_TABLE_ZONES' shared height
const SANDWICH_Y_TOLERANCE = 0.4; // same magnitude as SwagRun's PICKUP_Y_TOLERANCE
const SLOT_RESPAWN_COOLDOWN = 5; // seconds an emptied slot waits before restocking
const CRAB_SPAWN_CHANCE = 0.22; // per restock roll, while crab hasn't run out for the run
const CRAB_LIFETIME = 5; // seconds an uneaten crab sandwich sits before someone else grabs it
const CRAB_SERVE_LIMIT = 6; // after this many crab sandwiches eaten this run, the table's out for good

// Moved off the table row and in beside Stairs A's own wall — per the real
// floor plan, which shows food-vendor zones tucked right against the stair
// enclosures. x = -11 clears that wall (at x = -16) by 5, comfortably past
// the ~4.1 minimum (wallColliderRadius 1.0 + wallClearance 3.12 at
// MAX_SIZE_SCALE) needed to stay reachable even at Biggy's largest.
export const JAVA_MACHINE_POS: [number, number] = [-11, -13];
// Both kiosks' own collider (KIOSK_COLLIDER_RADIUS, in lunchColliders) pushes
// Biggy back to KIOSK_COLLIDER_RADIUS + wallClearance from its center — and
// unlike Level 1's Voxxy, Biggy's wallClearance scales with growth, up to
// 1.2*2.6=3.12 at MAX_SIZE_SCALE (see Robot.ts). A touch radius has to clear
// that worst case or the machine becomes unreachable partway through a run
// (SwagRun.ts's own COFFEE_RADIUS/CANDY_RADIUS don't need this — Voxxy never
// grows). This was a real bug: COFFEE_RADIUS here used to be a bare 1.3,
// less than even the *unscaled* minimum approach distance (0.55+1.2=1.75) —
// the JAVA machine was unreachable from the very first sandwich eaten. The user:
// "i was running into it and it did nothing."
const KIOSK_REACH_MAX_GROWTH = KIOSK_COLLIDER_RADIUS + WALL_CLEARANCE * 2.6 + 0.15;
const COFFEE_RADIUS = KIOSK_REACH_MAX_GROWTH;
const COFFEE_BOOST = 40;
const COFFEE_COOLDOWN = 8;
// KING's candy machine, same as Level 1's — the user: "the candy machine was
// already a part of the KING booth" (the KING booth itself already renders
// in Level 3, being part of sponsorBoothsGroup, which both levels share;
// only the candy machine PROP itself was Level-1-only, built by SwagRun.ts
// into its own group). Positioned at KING_KIOSK_POS, right next to that
// real booth, rather than at the old (now-dropped) "lunch" sign's spot —
// The user: "you can drop the sign lunch... no added value in level 3."
// Energy-only here (half of JAVA's, same ratio as Level 1) — Level 1's own
// candy machine also adds a time bonus, but Level 3 has no round timer for
// that to apply to.
const CANDY_RADIUS = KIOSK_REACH_MAX_GROWTH;
const CANDY_ENERGY_BOOST = 20;
const CANDY_COOLDOWN = 8;

// The beer tap (sponsorBooths.ts, a standalone landmark shared with Level 1)
// had no gameplay hook at all — the user: "it looks like it has no effect now."
// Restores hunger here same as a sandwich (see HUNGER_RESTORE_PER_SANDWICH
// below), but at a real cost — robot.applyTipsy() briefly makes the actual
// movement/facing direction drift off whatever the player steers toward,
// which is exactly the wrong moment to lose precise control if the crowd's
// already closing in. A genuine risk/reward call, unlike Level 1's version
// of this same landmark (SwagRun.ts), which has no hunger to restore and so
// is pure downside there. Same reachability requirement as the kiosks above.
const BEER_TAP_RADIUS = BEER_TAP_COLLIDER_RADIUS + WALL_CLEARANCE * 2.6 + 0.15;
const BEER_TAP_TIPSY_DURATION = 5;
const BEER_TAP_COOLDOWN = 8;

// Attendees spawn over time from the entrance and walk to the back of a
// growing queue at the table — the crowd visibly grows the longer a run
// goes — rather than chasing on sight the way
// Levels 1-2's hazards do. Getting close to a queued attendee — and
// *especially* eating a sandwich right next to one — can provoke them into
// breaking off and actively chasing Biggy down, which is what actually
// drives this level's difficulty up over a long run, on top of Biggy getting
// bigger and slower with every bite.
// 'wandering' is the post-grab loiter: a diner that has just taken a sandwich
// drifts around the buffet for a leg or two before heading for the exit,
// instead of turning on the spot and beelining out. The user, watching the
// crowd sit on the middle tables: "they should not stay in that one spot, and
// really take the sandwich away, and also walk a bit around: it should be a
// bit random, taking sandwiches and walking around."
type DinerState = 'approaching' | 'queued' | 'grabbing' | 'wandering' | 'chasing' | 'leaving';

const ATTENDEE_SPAWN_POINT: [number, number] = [0, 17]; // walking in from the entrance/foyer side
// Anchored just behind the table's own left end, extending toward +x (right,
// back along the table) rather than the old -x (further left) — the old
// direction ran the queue line straight through where the new Stairs A
// enclosure now stands. At MAX_ATTENDEES * QUEUE_SPACING = 19.6m, the queue
// now ends around x = 7.6, nowhere near either enclosure.
const QUEUE_ANCHOR: [number, number] = [-12, -18];
const QUEUE_DIR: [number, number] = [1, 0];
const QUEUE_SPACING = 1.4;
const MAX_ATTENDEES = 14;
const SPAWN_INTERVAL_START = 4.5;
const SPAWN_INTERVAL_FLOOR = 1.3;
const SPAWN_INTERVAL_RAMP = 0.03; // seconds shaved off the spawn interval per second survived — the actual difficulty curve
const APPROACH_SPEED = 2.2;
const LEAVE_SPEED = 2.6;
const QUEUE_PATIENCE_MIN = 10; // seconds a queued attendee waits before giving up and leaving
const QUEUE_PATIENCE_MAX = 18;
// How many diners may be away from the line fetching food at once. The queue
// used to serve exactly one at a time ("a real line serves one person at a
// time"), which was the other half of why the outer tables were safe: one
// grabber, always sent to the nearest slot, never got past the middle of the
// buffet. Five keeps the line reading as a line while putting enough traffic
// on the floor that no table stays untouched for long.
const MAX_CONCURRENT_GRABBERS = 5;
// Per second, per queued diner, while a grabber slot is free — a staggered
// trickle rather than the whole line breaking for the table the instant one
// opens up.
const GRAB_CHANCE_PER_SEC = 1.5;
// Post-grab loiter (see DinerState's 'wandering'). Legs are short and start
// from wherever the diner already is, so a wanderer stays around the buffet
// where it's a real obstacle, and is gone in a few seconds either way — a
// long walk would let wanderers fill MAX_ATTENDEES and starve the queue.
// A diner that can't reach the sandwich it claimed gives up after this long,
// releases the claim and leaves. Local steering rounds an obstacle, it does
// not solve a maze, so some trips across a hall full of booths and stair
// enclosures will simply fail — without this the failures are permanent: a
// 600s headless run ended with four diners still walking at a table they'd
// claimed minutes earlier, each holding a sandwich reserved that nobody could
// then take. Generous enough that an honest walk to the far table (about 40m
// at APPROACH_SPEED, plus detours) finishes comfortably.
const GRAB_TIMEOUT = 30;
// Same reasoning as GRAB_TIMEOUT, for a loiter leg: a wander target is a
// random point that may well sit inside a table or a booth, and a diner that
// can never stand on it would otherwise wander for the rest of the run. A
// 600s headless run had ~11 of the 14 attendees permanently wandering, which
// starved the queue and cut the buffet's throughput to a third. Timing the
// leg out just counts it as walked.
const WANDER_LEG_TIMEOUT = 8;
const WANDER_LEGS_MIN = 1;
const WANDER_LEGS_MAX = 2;
const WANDER_LEG_MIN_DISTANCE = 4;
const WANDER_LEG_MAX_DISTANCE = 10;
// The band the buffet actually occupies — wander targets are clamped into it
// so a random leg can't send a diner off into an empty corner of a 90x60 hall.
const WANDER_X_LIMIT = 36;
const WANDER_Z_MIN = -24;
const WANDER_Z_MAX = 14;
const CHASE_SPEED = 5.0; // below the robot's own unboosted 6 — evadable early, much less so once Biggy's grown and slowed down
const CHASE_TURN_RATE = 3.2;
const CHASE_TIMEOUT = 6; // seconds a chase lasts before the attendee gives up
const CHASE_DETECTION_RADIUS = 4; // passive: just walking this close to a queued attendee risks provoking them
const PASSIVE_CHASE_CHANCE_PER_SEC = 0.3; // while within CHASE_DETECTION_RADIUS
const STEAL_ALERT_RADIUS = 6; // active: eating a sandwich this close to a queued/approaching attendee provokes them for sure
const HAZARD_RADIUS = 1.0;
// Diners steer straight at a fixed point ('approaching'/'grabbing') or at
// Biggy's live position ('chasing') with no real obstacle avoidance — same
// simple shape as every other hazard in this game. Splitting the sandwich
// tables into six smaller ones (see LUNCH_TABLE_ZONES's own comment) put
// several of them right along diners' most common paths (spawn → queue,
// and any chase that crosses the buffet), and a straight-line steer walking
// square into one of those tables gets pushed back out by exactly the
// distance it just walked forward — a stable equilibrium the diner can't
// escape on its own (the user: "the npcs get stuck at the lunch tables... and
// are not picking the sandwiches up"). checkAndEscapeIfStuck() below is the
// fix: periodically confirms a diner is actually making progress, and gives
// it a random sideways nudge if not, letting normal steering resume from a
// new spot next frame — cheap trial-and-error instead of real pathfinding,
// same "good enough" bar as the rest of this game's collision handling.
const STUCK_CHECK_INTERVAL = 1; // seconds between progress checks
const STUCK_MIN_PROGRESS = 0.4; // must cover at least this much ground per check interval, or it's stuck
const STUCK_ESCAPE_DISTANCE = 1.5; // meters, one-time sideways nudge when stuck
const HAZARD_WALK_CYCLE_RATE = 2.5;
const HAZARD_LEG_SWING = 0.5;
const HAZARD_ARM_SWING_RATIO = 0.6;
const GRIPE_HEIGHT = 2.15;
const GRIPE_DURATION = 2.5;
const GRIPE_INTERVAL_MIN = 4;
const GRIPE_INTERVAL_MAX = 8;
const HIT_REACTION_DURATION = 2.0;
const SPEECH_VISIBLE_RANGE = 8;

export const STUN_DURATION = 1.0; // "stumble" duration for a hit below FALL_THRESHOLD — recoverable, same shape as Levels 1-2
export const POST_STUN_GRACE = 1.0;
// Below this sizeScale, a collision is just a stumble (brief control loss,
// recoverable) — permadeath on the very first hit risks reading as unfair.
// At/above it, a collision starts counting toward the real
// fall below instead of always just stumbling.
const FALL_THRESHOLD = 1.4;
// Once at/above FALL_THRESHOLD, a single bump used to be an instant permanent
// fall — the user, after playing the mobility/boost tuning pass: "only do the
// final hit when 2 or 3 hits are made closely after each other... make the
// endgame more fun." A grown Biggy now stumbles (recoverable, same as
// below FALL_THRESHOLD) on a fall-risk hit too, and only actually goes down
// once FALL_HIT_COMBO_REQUIRED such hits land within FALL_HIT_COMBO_WINDOW
// seconds of each other — getting bumped once while wobbling is still
// dangerous, but creating distance after a hit (or just landing far enough
// apart in time) resets the danger instead of ending the run on the spot.
const FALL_HIT_COMBO_REQUIRED = 3;
const FALL_HIT_COMBO_WINDOW = 5; // seconds since the last qualifying hit that still counts toward the combo

// Hunger — a second, independent permanent-fall trigger: a meter that drains
// over time and refills on eating, game-over on empty. Deliberately additive, not a replacement
// for the hazard-collision fall above: the two are separate pressures (avoid
// the crowd vs. keep eating) that compound as a run goes on, since a bigger
// Biggy is also slower to reach the next sandwich in time.
const HUNGER_MAX = 100;
// Drain rate itself ramps with survived time (the user: "hunger timer very slow,
// should become faster the longer we are in level 3... with a limit to keep
// it playable") rather than staying flat — a flat rate meant a run that
// found one reliable table could coast forever once fed. Starts slow enough
// to fail a fresh run in ~85s if the buffet's ignored entirely, ramps up to
// double that pace by HUNGER_DRAIN_RAMP_DURATION survived, and holds there
// (capped) rather than climbing forever into an unplayable instant-drain.
//
// Sped up across the board 2026-09-29 — the user: "level 3 hungry bar goes
// very slow, almost no need to look at it." The bar was background noise you
// could ignore while playing the crowd.
//
// Note these are *base* rates, not times-to-starve: the drain ramps while you
// survive, so a full bar empties well before HUNGER_MAX/HUNGER_DRAIN_RATE_BASE
// seconds. Measured by simulating a run that never eats: the old numbers
// emptied the bar in 61s, these empty it in 39s, with the low-hunger warning
// (HUNGER_LOW_THRESHOLD) landing at 31s instead of 48s. Each sandwich buys
// about 12s early on and about 6s once the ramp is at its cap, so the level's
// own loop — keep eating — is now a real clock rather than a formality.
const HUNGER_DRAIN_RATE_BASE = HUNGER_MAX / 50; // per second, at survivedTime = 0
const HUNGER_DRAIN_RATE_MAX = HUNGER_MAX / 25; // per second, the late-run cap
const HUNGER_DRAIN_RAMP_DURATION = 70; // seconds to go from base to max
// Flat per sandwich regardless of type — keeps the mental math simple ("about
// 4 sandwiches keeps me topped up") rather than needing a second per-type
// balancing table on top of SANDWICH_SCORE/SANDWICH_GROWTH.
const HUNGER_RESTORE_PER_SANDWICH = 25;
const HUNGER_LOW_THRESHOLD = 25; // one-shot warning toast when crossing below this

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Builds a slot's full visual: the real sandwich model (src/props/sandwiches.js)
 * wrapped in a group with the same halo+beacon glow-sprite pair the old
 * hand-built mesh had (a readability affordance, not part of the sandwich's
 * own model — kept as-is rather than dropped along with the old geometry).
 */
function createSandwichVisual(type: SandwichType): { group: THREE.Group; sandwich: Sandwich; halo: THREE.Sprite } {
  const sandwich = createSandwich(type);
  const group = new THREE.Group();
  group.add(sandwich.object);

  const halo = createGlowSprite(HALO_BASE_SIZE * 0.7, type === 'crab' ? 0.85 : 0.5);
  if (type === 'crab') halo.material.color.set(0xff6f61);
  group.add(halo);
  const beacon = createGlowSprite(BEACON_BASE_SIZE, 0.85);
  beacon.position.y = BEACON_HEIGHT;
  group.add(beacon);

  return { group, sandwich, halo };
}

interface SandwichSlot {
  x: number;
  z: number;
  type: SandwichType | null;
  mesh: THREE.Object3D | null; // wrapper group added to the scene — see createSandwichVisual
  sandwich: Sandwich | null; // same object as mesh's child — kept separately for update()/dispose()
  halo: THREE.Sprite | null;
  pulseTime: number; // drives the halo's own pulse — the old mesh reused its own continuous spin for this, which sandwiches.js's model doesn't have (it wiggles only while idle, not a constant spin)
  cooldown: number;
  activeTimer: number; // crab only — expires if not eaten in time
}

interface Diner {
  x: number;
  z: number;
  heading: number;
  radius: number;
  mesh: THREE.Object3D;
  state: DinerState;
  targetX: number;
  targetZ: number;
  chaseTimer: number;
  queueTimer: number;
  walkPhase: number;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  bubble: SpeechBubble;
  gripeTimer: number;
  // The slot this diner is on its way to, while 'grabbing' — held so two
  // diners sent out at once can't be given the same sandwich (see
  // pickTargetSlot), and cleared the moment it stops grabbing.
  targetSlot: SandwichSlot | null;
  // Remaining post-grab loiter legs, while 'wandering' (see DinerState).
  wanderLegs: number;
  // Which way round this diner committed to going while detouring (see
  // headingAvoiding). Reset whenever it picks a new destination, so a fresh
  // leg isn't steered by a commitment made for the previous one.
  detour: { side: number };
  // Seconds left to reach the slot it claimed, while 'grabbing' (see
  // GRAB_TIMEOUT), or to finish the current loiter leg, while 'wandering'
  // (see WANDER_LEG_TIMEOUT) — one destination at a time, so one timer.
  legTimer: number;
  // See checkAndEscapeIfStuck's own comment.
  stuckCheckTimer: number;
  stuckCheckX: number;
  stuckCheckZ: number;
}

function findWalkParts(mesh: THREE.Object3D): Pick<Diner, 'legL' | 'legR' | 'armL' | 'armR'> {
  const parts: Pick<Diner, 'legL' | 'legR' | 'armL' | 'armR'> = {};
  mesh.traverse((child) => {
    switch (child.userData.walkPart) {
      case 'legL':
        parts.legL = child;
        break;
      case 'legR':
        parts.legR = child;
        break;
      case 'armL':
        parts.armL = child;
        break;
      case 'armR':
        parts.armR = child;
        break;
    }
  });
  return parts;
}

// How far ahead a diner looks for something to walk around. Comfortably more
// than the one step it is about to take, so the turn begins while there's
// still room to make it rather than after the push-out has already stalled it.
const AVOID_LOOKAHEAD = 5;

/**
 * The heading to walk to reach (targetX, targetZ) while clearing whatever is
 * in the way — the straight-line heading when the path is clear, rotated just
 * far enough to graze the nearest blocker's edge when it isn't.
 *
 * This is what stops diners living on the lunch tables. They steer in a
 * straight line and get pushed back out of a collider by exactly the distance
 * they just walked into it, which is a stable equilibrium they can't escape:
 * the spawn-to-queue line passes 1.96m from the hall-center-left table, whose
 * push-out radius is 2.0m, so *every* arriving attendee walked into that one
 * table and milled around it (the user: "they are now walking on the tables
 * for a very long time"). checkAndEscapeIfStuck's random sideways nudge only
 * ever bought a second before the same straight-line steer walked back in.
 *
 * Deliberately one step of local avoidance, not pathfinding — it turns around
 * a single obstacle, and if that turn leads into a second one it re-solves
 * next frame. That's the same "good enough" bar as the rest of this game's
 * collision handling, and the stuck-escape below still backstops the corner
 * cases it can't reason about. Not used for 'chasing': a chaser's dumb,
 * turn-rate-limited beeline is what makes the tables a real escape tool for
 * Biggy (the user: "can be used to escape the npcs?"), so giving chasers
 * avoidance would quietly remove the level's main defensive option.
 */
function headingAvoiding(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
  radius: number,
  colliders: Collider[],
  // Which way round this mover committed to going, remembered across frames
  // (0 = not currently detouring). See the tangent block below for why this
  // can't be re-decided every frame.
  detour: { side: number },
): number {
  const dx = targetX - x;
  const dz = targetZ - z;
  const distToTarget = Math.hypot(dx, dz);
  const desired = distToTarget > 0.001 ? Math.atan2(dx, dz) : 0;
  const ux = Math.sin(desired);
  const uz = Math.cos(desired);

  // Nearest collider whose clearance circle the straight path actually enters,
  // ignoring anything behind us or beyond the target.
  const reach = Math.min(AVOID_LOOKAHEAD, distToTarget);
  let blocker: Collider | undefined;
  let blockerAlong = Infinity;
  for (const c of colliders) {
    const relX = c.x - x;
    const relZ = c.z - z;
    const along = relX * ux + relZ * uz;
    if (along <= 0 || along > reach || along >= blockerAlong) continue;
    const clearance = c.radius + radius;
    if (Math.abs(relX * uz - relZ * ux) >= clearance) continue;
    // You can't walk around the thing you're walking to. A grabbing diner's
    // target is a sandwich sitting on a table, which is inside that table's
    // own collider — without this, the one obstacle it must approach is the
    // one it would circle forever.
    const targetDx = targetX - c.x;
    const targetDz = targetZ - c.z;
    if (targetDx * targetDx + targetDz * targetDz < clearance * clearance) continue;
    blocker = c;
    blockerAlong = along;
  }
  if (!blocker) {
    detour.side = 0; // path is clear — any commitment from an earlier detour is spent
    return desired;
  }

  const relX = blocker.x - x;
  const relZ = blocker.z - z;
  const centerDist = Math.hypot(relX, relZ);
  const clearance = blocker.radius + radius;
  // Already inside the clearance circle (the push-out loop puts diners exactly
  // on its edge, and float error can leave them a hair inside): there is no
  // tangent to aim for, so just head straight out before resuming.
  if (centerDist <= clearance) return Math.atan2(-relX, -relZ);

  // Aim at the blocker's edge rather than its center: offset from the bearing
  // to it by the half-angle its clearance circle subtends.
  //
  // Which side to pass on is decided ONCE, on the frame the detour starts,
  // and held until the way to the target is clear again. Re-deciding it every
  // frame is what made the first version of this useless against a wall:
  // every long wall in this game is modelled as a row of circles, so rounding
  // one circle immediately presents the next, whose "shorter way round" is
  // back the way you came. Diners sat in that oscillation permanently — a
  // 600s headless run had four of them stuck against the Stairs A enclosure
  // for up to 579s, never getting nearer than 15m to the outer tables, while
  // still holding those tables' sandwiches reserved. Committing to a side
  // turns the same local rule into wall-following, which does get round.
  const toBlocker = Math.atan2(relX, relZ);
  const tangentOffset = Math.asin(clearance / centerDist);
  if (detour.side === 0) {
    const diff = ((toBlocker - desired + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    detour.side = diff > 0 ? -1 : 1;
  }
  return toBlocker + detour.side * tangentOffset;
}

/** Steps (x, z) toward (targetX, targetZ) at `speed`, returning the new position/heading and whether it arrived this step. */
function stepToward(
  x: number,
  z: number,
  targetX: number,
  targetZ: number,
  speed: number,
  dt: number,
  // Omit to walk a dead-straight line (see headingAvoiding on why 'chasing'
  // does exactly that).
  avoid?: { radius: number; colliders: Collider[]; detour: { side: number } },
): { x: number; z: number; heading: number; arrived: boolean } {
  const dx = targetX - x;
  const dz = targetZ - z;
  const dist = Math.hypot(dx, dz);
  const direct = dist > 0.001 ? Math.atan2(dx, dz) : 0;
  if (dist <= speed * dt) return { x: targetX, z: targetZ, heading: direct, arrived: true };
  const heading = avoid
    ? headingAvoiding(x, z, targetX, targetZ, avoid.radius, avoid.colliders, avoid.detour)
    : direct;
  return { x: x + Math.sin(heading) * speed * dt, z: z + Math.cos(heading) * speed * dt, heading, arrived: false };
}

/**
 * See STUCK_ESCAPE_DISTANCE's own comment. Call once per frame for any diner
 * in a state that's actively steering somewhere ('approaching'/'chasing'/
 * 'grabbing'/'wandering'/'leaving') — not 'queued' (stationary by design). 'leaving' in
 * particular needs this just as much as the others: the end-of-update()
 * removal filter only drops a diner once it's within 0.5m of
 * ATTENDEE_SPAWN_POINT, so one wedged against a table on its way out would
 * otherwise never be removed at all, silently and permanently occupying one
 * of MAX_ATTENDEES' 14 slots. Mutates `d.x`/`d.z` directly on an escape; the
 * boundary clamp and collider push-out loop that already runs right after
 * every state's movement block still apply this same frame, so a nudge can
 * never land the diner outside the hall or inside a *different* solid
 * object.
 */
function checkAndEscapeIfStuck(d: Diner, dt: number): void {
  d.stuckCheckTimer -= dt;
  if (d.stuckCheckTimer > 0) return;
  d.stuckCheckTimer = STUCK_CHECK_INTERVAL;
  const progressed = Math.hypot(d.x - d.stuckCheckX, d.z - d.stuckCheckZ);
  d.stuckCheckX = d.x;
  d.stuckCheckZ = d.z;
  if (progressed >= STUCK_MIN_PROGRESS) return;
  const perpAngle = d.heading + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  d.x += Math.sin(perpAngle) * STUCK_ESCAPE_DISTANCE;
  d.z += Math.cos(perpAngle) * STUCK_ESCAPE_DISTANCE;
}

const ATTENDEE_ARCHETYPES: AttendeeArchetype[] = ['live-coder', 'java-godfather', 'keynote-legend', 'booth-recruiter'];

export class LunchRush {
  readonly group = new THREE.Group();
  private slots: SandwichSlot[] = [];
  private javaMachine: CoffeeVendingMachine;
  private javaCooldown = 0;
  private candyMachine: CandyGrabbingMachine;
  private candyCooldown = 0;
  private beerTapCooldown = 0;
  private crabServedCount = 0;
  private diners: Diner[] = [];
  private spawnTimer = SPAWN_INTERVAL_START;
  // See SwagRun.ts's identical field for why this doesn't start at 0.
  private hitCooldown = STUN_DURATION + POST_STUN_GRACE;
  private nextArchetype = 0;
  score = 0;
  sandwichesEaten = 0;
  survivedTime = 0;
  finished = false;
  hunger = HUNGER_MAX;
  private hungerLowToastShown = false; // one-shot per run, re-armed if hunger recovers back above the threshold
  // See FALL_HIT_COMBO_REQUIRED's own comment — tracks consecutive
  // fall-risk hits landing within FALL_HIT_COMBO_WINDOW of each other.
  private fallRiskComboCount = 0;
  private lastFallRiskHitTime = -Infinity;

  constructor() {
    // Table meshes themselves are built once by createExhibitionHall() now,
    // shared with Level 1 (see LUNCH_TABLE_ZONES's own comment) — this class
    // only adds the sandwich-slot/kiosk logic on top of them.

    for (const [x, z] of SLOT_POSITIONS) {
      this.slots.push({ x, z, type: null, mesh: null, sandwich: null, halo: null, pulseTime: 0, cooldown: Math.random() * SLOT_RESPAWN_COOLDOWN, activeTimer: 0 });
    }

    this.javaMachine = createVendingMachine();
    this.javaMachine.object.position.set(JAVA_MACHINE_POS[0], 0, JAVA_MACHINE_POS[1]);
    this.group.add(this.javaMachine.object);

    this.candyMachine = createCandyMachine();
    this.candyMachine.object.position.set(KING_KIOSK_POS[0], 0, KING_KIOSK_POS[1]);
    this.group.add(this.candyMachine.object);
  }

  /** Live snapshot for the minimap — a slot with no current sandwich reads as "collected" (hidden dot). */
  get sandwichMarkers(): { x: number; z: number; collected: boolean }[] {
    return this.slots.map((s) => ({ x: s.x, z: s.z, collected: s.type === null }));
  }

  /** For Hud.update()'s hunger bar — same 0-1 shape as Robot.energyFraction. */
  get hungerFraction(): number {
    return this.hunger / HUNGER_MAX;
  }

  /**
   * A stocked sandwich slot for a diner to go fetch, chosen uniformly at
   * random among those nobody is already on their way to.
   *
   * Deliberately random rather than nearest-first, which is what it used to
   * be. The queue stands at x -12..7.6, so the nearest stocked slot was
   * essentially always one of the two "between" tables in the middle of the
   * hall — the left table at x -30 and the right one at x +30 were never once
   * chosen, which is exactly the safe spot the user found: "sandwiches on the
   * tables outer left and outer right are very safe to take - all npcs are
   * concentrated in the middle". Uniform choice over the ten slots sends 2 in
   * 10 diners to each outer table, so no table is reliably unattended.
   *
   * The claim check matters now that several diners fetch at once
   * (MAX_CONCURRENT_GRABBERS): without it two of them would walk to the same
   * sandwich and one would arrive to find it gone.
   */
  private pickTargetSlot(): SandwichSlot | null {
    const claimed = new Set<SandwichSlot>();
    for (const d of this.diners) {
      if (d.state === 'grabbing' && d.targetSlot) claimed.add(d.targetSlot);
    }
    const available = this.slots.filter((s) => s.type && !claimed.has(s));
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Sends a diner off on one more loiter leg: a short hop from wherever it is
   * now, clamped into the band the buffet actually occupies so a random
   * direction can't march it into an empty corner of the hall.
   */
  private setWanderTarget(d: Diner): void {
    d.detour.side = 0;
    d.legTimer = WANDER_LEG_TIMEOUT;
    const angle = Math.random() * Math.PI * 2;
    const distance = WANDER_LEG_MIN_DISTANCE + Math.random() * (WANDER_LEG_MAX_DISTANCE - WANDER_LEG_MIN_DISTANCE);
    d.targetX = THREE.MathUtils.clamp(d.x + Math.sin(angle) * distance, -WANDER_X_LIMIT, WANDER_X_LIMIT);
    d.targetZ = THREE.MathUtils.clamp(d.z + Math.cos(angle) * distance, WANDER_Z_MIN, WANDER_Z_MAX);
  }

  private spawnDiner(): void {
    // Only counts diners actually headed for/standing in the line — chasers
    // and diners on their way out don't hold a slot, or a churning queue
    // would eventually assign two attendees the same spot and stack them.
    const queueIndex = this.diners.filter((d) => d.state === 'approaching' || d.state === 'queued').length;
    const archetype = ATTENDEE_ARCHETYPES[this.nextArchetype % ATTENDEE_ARCHETYPES.length];
    this.nextArchetype += 1;
    const mesh = createAttendeeMesh(archetype);
    mesh.position.set(ATTENDEE_SPAWN_POINT[0], 0, ATTENDEE_SPAWN_POINT[1]);
    this.group.add(mesh);

    const bubble = createSpeechBubble();
    bubble.sprite.position.y = GRIPE_HEIGHT;
    mesh.add(bubble.sprite);

    this.diners.push({
      x: ATTENDEE_SPAWN_POINT[0],
      z: ATTENDEE_SPAWN_POINT[1],
      heading: 0,
      radius: HAZARD_RADIUS,
      mesh,
      state: 'approaching',
      targetX: QUEUE_ANCHOR[0] + QUEUE_DIR[0] * queueIndex * QUEUE_SPACING,
      targetZ: QUEUE_ANCHOR[1] + QUEUE_DIR[1] * queueIndex * QUEUE_SPACING,
      chaseTimer: 0,
      queueTimer: 0,
      walkPhase: Math.random() * Math.PI * 2,
      ...findWalkParts(mesh),
      bubble,
      gripeTimer: GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN),
      targetSlot: null,
      wanderLegs: 0,
      detour: { side: 0 },
      legTimer: 0,
      stuckCheckTimer: STUCK_CHECK_INTERVAL,
      stuckCheckX: ATTENDEE_SPAWN_POINT[0],
      stuckCheckZ: ATTENDEE_SPAWN_POINT[1],
    });
  }

  /**
   * The run-ending arithmetic for one hit, wherever it came from. Once Biggy
   * is past FALL_THRESHOLD it takes FALL_HIT_COMBO_REQUIRED hits inside
   * FALL_HIT_COMBO_WINDOW to put him down; below it, every hit is a
   * recoverable stumble. Shared rather than inlined because the puddle
   * (registerExternalHit) has to land on exactly the same ledger as an
   * attendee — two copies would drift.
   */
  private bookHit(robot: Robot): { stumbled: boolean; fell: boolean; growthToast?: string } {
    if (robot.sizeScale < FALL_THRESHOLD) return { stumbled: true, fell: false };
    this.fallRiskComboCount =
      this.survivedTime - this.lastFallRiskHitTime <= FALL_HIT_COMBO_WINDOW ? this.fallRiskComboCount + 1 : 1;
    this.lastFallRiskHitTime = this.survivedTime;
    if (this.fallRiskComboCount >= FALL_HIT_COMBO_REQUIRED) {
      this.finished = true;
      return { stumbled: false, fell: true };
    }
    return {
      stumbled: true,
      fell: false,
      growthToast: this.fallRiskComboCount === FALL_HIT_COMBO_REQUIRED - 1 ? randomWobblingToast() : undefined,
    };
  }

  /**
   * Books a hit that didn't come from an attendee — the wet floor's puddle
   * (Game.ts's zapInPuddle). Level 3's ending rule counts *hits*, not
   * attendees specifically, so a zap that skipped this would be a free stun
   * the fall logic can't see: three bumps from the crowd end a grown Biggy,
   * but he could stand in the water all day. Respects and then re-arms
   * hitCooldown, so a zap and an attendee can't both land in the same window.
   */
  registerExternalHit(robot: Robot): { stumbled: boolean; fell: boolean; growthToast?: string } {
    if (this.finished || this.hitCooldown > 0) return { stumbled: false, fell: false };
    this.hitCooldown = STUN_DURATION + POST_STUN_GRACE;
    return this.bookHit(robot);
  }

  /** Advances the endless round. Returns whether Biggy stumbled (recoverable) or fell (permanent, see Robot.fallOver), plus an optional growth-milestone toast. */
  update(dt: number, robot: Robot, colliders: Collider[], beerTap: BeerTap): { stumbled: boolean; fell: boolean; growthToast?: string; pickedUp: boolean; drankBeer?: boolean; rechargedFrom?: 'coffee' | 'candy' } {
    if (this.finished) return { stumbled: false, fell: false, pickedUp: false };

    this.survivedTime += dt;
    let growthToast: string | undefined;

    // Hunger — see HUNGER_DRAIN_RATE_BASE's own comment for why this exists
    // alongside the hazard-collision fall below rather than replacing it, and
    // why the rate itself ramps with survived time instead of staying flat.
    const drainRamp = Math.min(1, this.survivedTime / HUNGER_DRAIN_RAMP_DURATION);
    const drainRate = HUNGER_DRAIN_RATE_BASE + (HUNGER_DRAIN_RATE_MAX - HUNGER_DRAIN_RATE_BASE) * drainRamp;
    this.hunger = Math.max(0, this.hunger - drainRate * dt);
    if (this.hunger <= 0) {
      // Ends the round the same way a hazard-caused fall does (fell: true —
      // Game.ts reacts to that uniformly, calling robot.fallOver() and
      // playing biggy-fall.wav regardless of which trigger caused it), just
      // with its own toast line instead of hazard-fall's silence, and
      // skipping the rest of this frame's hazard/pickup processing entirely
      // since the round is already over.
      this.finished = true;
      return { stumbled: false, fell: true, pickedUp: false, growthToast: randomHungerStarvedToast() };
    }
    if (this.hunger <= HUNGER_LOW_THRESHOLD) {
      if (!this.hungerLowToastShown) {
        this.hungerLowToastShown = true;
        growthToast = randomHungerLowToast();
      }
    } else {
      this.hungerLowToastShown = false; // re-arm once hunger recovers back above the threshold
    }

    const robotX = robot.position.x;
    const robotZ = robot.position.z;
    const robotRadius = ROBOT_RADIUS * robot.sizeScale;
    let pickedUp = false;

    // Sandwich table: each slot independently empties and restocks.
    for (const slot of this.slots) {
      if (slot.type && slot.mesh && slot.sandwich && slot.halo) {
        slot.sandwich.update(dt);
        slot.pulseTime += dt;
        const pulse = 0.85 + 0.15 * Math.sin(slot.pulseTime * 3);
        slot.halo.scale.set(HALO_BASE_SIZE * 0.7 * pulse, HALO_BASE_SIZE * 0.7 * pulse, 1);

        if (slot.type === 'crab') {
          slot.activeTimer -= dt;
          if (slot.activeTimer <= 0) {
            // Nobody grabbed it in time — it's gone, same as it disappearing to another attendee.
            slot.sandwich.dispose();
            this.group.remove(slot.mesh);
            slot.mesh = null;
            slot.sandwich = null;
            slot.halo = null;
            slot.type = null;
            slot.cooldown = SLOT_RESPAWN_COOLDOWN;
            continue;
          }
        }

        const dx = robotX - slot.x;
        const dz = robotZ - slot.z;
        const onTable = Math.abs(robot.position.y - SANDWICH_SURFACE_Y) < SANDWICH_Y_TOLERANCE;
        const reach = onTable ? PICKUP_RADIUS : groundReachFor(robot.sizeScale);
        if (dx * dx + dz * dz < reach * reach) {
          const type = slot.type;
          this.score += SANDWICH_SCORE[type];
          this.sandwichesEaten += 1;
          if (type === 'crab') this.crabServedCount += 1;
          robot.grow(SANDWICH_GROWTH[type]);
          pickedUp = true;
          this.hunger = Math.min(HUNGER_MAX, this.hunger + HUNGER_RESTORE_PER_SANDWICH);

          // Eating right next to an attendee who came here to eat provokes
          // them for sure, unlike the weaker passive proximity check below.
          // 'grabbing' and 'wandering' count too: taking the sandwich out from
          // under someone walking to that very table is the most provocative
          // thing Biggy can do, and those are the diners now spread across the
          // whole buffet rather than bunched in the line.
          for (const d of this.diners) {
            if (d.state !== 'queued' && d.state !== 'approaching' && d.state !== 'grabbing' && d.state !== 'wandering') continue;
            const ddx = d.x - slot.x;
            const ddz = d.z - slot.z;
            if (ddx * ddx + ddz * ddz < STEAL_ALERT_RADIUS * STEAL_ALERT_RADIUS) {
              // Drop any claim on a slot before switching goals, or
              // pickTargetSlot would keep that sandwich reserved for a diner
              // that is now chasing Biggy instead.
              d.targetSlot = null;
              d.state = 'chasing';
              d.chaseTimer = CHASE_TIMEOUT;
              d.bubble.show(randomLunchChaseLine(), HIT_REACTION_DURATION);
            }
          }

          // Eaten instantly (matches the existing arcade-quick feel, same as
          // the coffee/candy machines) — no time to see sandwiches.js's own
          // hop-spin activate() before removal, so it's not triggered here.
          slot.sandwich.dispose();
          this.group.remove(slot.mesh);
          slot.mesh = null;
          slot.sandwich = null;
          slot.halo = null;
          slot.type = null;
          slot.cooldown = SLOT_RESPAWN_COOLDOWN;
        }
      } else {
        slot.cooldown -= dt;
        if (slot.cooldown <= 0) {
          const crabAvailable = this.crabServedCount < CRAB_SERVE_LIMIT;
          const type: SandwichType = crabAvailable && Math.random() < CRAB_SPAWN_CHANCE ? 'crab' : pick(COMMON_TYPES);
          const { group, sandwich, halo } = createSandwichVisual(type);
          group.position.set(slot.x, 0.85, slot.z);
          this.group.add(group);
          slot.mesh = group;
          slot.sandwich = sandwich;
          slot.halo = halo;
          slot.pulseTime = 0;
          slot.type = type;
          slot.activeTimer = type === 'crab' ? CRAB_LIFETIME : 0;
        }
      }
    }

    // See SwagRun.ts's identical declaration — same two kiosks, same reason one
    // slot is enough.
    let rechargedFrom: 'coffee' | 'candy' | undefined;

    this.javaMachine.update(dt);
    this.javaCooldown = Math.max(0, this.javaCooldown - dt);
    const javaAvailable = this.javaCooldown <= 0;
    this.javaMachine.setOutOfStock(!javaAvailable);
    if (javaAvailable) {
      const dx = robotX - JAVA_MACHINE_POS[0];
      const dz = robotZ - JAVA_MACHINE_POS[1];
      if (dx * dx + dz * dz < COFFEE_RADIUS * COFFEE_RADIUS) {
        robot.restoreEnergy(COFFEE_BOOST);
        this.javaCooldown = COFFEE_COOLDOWN;
        rechargedFrom = 'coffee';
        // Fire-and-forget — see SwagRun.ts's identical coffee-machine comment.
        if (!this.javaMachine.busy) void this.javaMachine.activate();
      }
    }

    this.candyMachine.update(dt);
    this.candyCooldown = Math.max(0, this.candyCooldown - dt);
    const candyAvailable = this.candyCooldown <= 0;
    this.candyMachine.setOutOfStock(!candyAvailable);
    if (candyAvailable) {
      const dx = robotX - KING_KIOSK_POS[0];
      const dz = robotZ - KING_KIOSK_POS[1];
      if (dx * dx + dz * dz < CANDY_RADIUS * CANDY_RADIUS) {
        robot.restoreEnergy(CANDY_ENERGY_BOOST);
        this.candyCooldown = CANDY_COOLDOWN;
        rechargedFrom = 'candy';
        if (!this.candyMachine.busy) void this.candyMachine.activate();
      }
    }

    this.beerTapCooldown = Math.max(0, this.beerTapCooldown - dt);
    const beerTapAvailable = this.beerTapCooldown <= 0;
    beerTap.setOutOfStock(!beerTapAvailable);
    let drankBeer = false;
    if (beerTapAvailable) {
      const dx = robotX - BEER_TAP_POS[0];
      const dz = robotZ - BEER_TAP_POS[1];
      if (dx * dx + dz * dz < BEER_TAP_RADIUS * BEER_TAP_RADIUS) {
        this.hunger = Math.min(HUNGER_MAX, this.hunger + HUNGER_RESTORE_PER_SANDWICH);
        robot.applyTipsy(BEER_TAP_TIPSY_DURATION);
        this.beerTapCooldown = BEER_TAP_COOLDOWN;
        drankBeer = true;
        if (!beerTap.busy) void beerTap.activate();
      }
    }

    // Spawn rate ramps up with survived time — the actual difficulty curve:
    // the crowd visibly grows the longer a run
    // goes, on top of Biggy himself getting bigger and slower.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.diners.length < MAX_ATTENDEES) {
      this.spawnDiner();
      const interval = Math.max(SPAWN_INTERVAL_FLOOR, SPAWN_INTERVAL_START - this.survivedTime * SPAWN_INTERVAL_RAMP);
      this.spawnTimer = interval + Math.random() * 0.6;
    }

    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    const halfW = HALL_WIDTH / 2 - 1;
    const halfD = HALL_DEPTH / 2 - 1;
    let stumbled = false;
    let fell = false;

    // The diner queue used to be pure decoration — nothing ever actually took
    // a sandwich off the table, so a queued diner just stood there griping
    // until patience ran out or it broke off to chase Biggy (the user: "it looks
    // like the npcs aren't really grabbing the sandwiches, they are stuck").
    //
    // Serving was then limited to the single front-of-line diner, on the
    // reasoning that a real line serves one person at a time. Combined with
    // nearest-slot targeting that turned out to be half of why the buffet's
    // two outer tables were free food: one grabber at a time, always sent to
    // whatever was closest to the line, never reached them. Now up to
    // MAX_CONCURRENT_GRABBERS are out at once, each breaking off on its own
    // random roll rather than in lockstep, so the line still reads as a line
    // and the floor still has traffic on it.
    let activeGrabbers = this.diners.reduce((n, d) => n + (d.state === 'grabbing' ? 1 : 0), 0);
    // Every navigating state except 'chasing' walks around obstacles rather
    // than into them — see headingAvoiding for why chasers are the exception.
    const avoidFor = (d: Diner) => ({ radius: HAZARD_RADIUS, colliders, detour: d.detour });

    for (const d of this.diners) {
      if (fell) break; // game's over — stop advancing anyone else this frame

      switch (d.state) {
        case 'approaching': {
          const step = stepToward(d.x, d.z, d.targetX, d.targetZ, APPROACH_SPEED, dt, avoidFor(d));
          d.x = step.x;
          d.z = step.z;
          d.heading = step.heading;
          if (step.arrived) {
            d.state = 'queued';
            d.queueTimer = QUEUE_PATIENCE_MIN + Math.random() * (QUEUE_PATIENCE_MAX - QUEUE_PATIENCE_MIN);
          }
          break;
        }
        case 'queued': {
          d.queueTimer -= dt;
          if (d.queueTimer <= 0) {
            d.state = 'leaving';
            d.targetX = ATTENDEE_SPAWN_POINT[0];
            d.targetZ = ATTENDEE_SPAWN_POINT[1];
            break;
          }
          if (activeGrabbers < MAX_CONCURRENT_GRABBERS && Math.random() < GRAB_CHANCE_PER_SEC * dt) {
            const slot = this.pickTargetSlot();
            if (slot) {
              d.state = 'grabbing';
              d.targetSlot = slot;
              d.targetX = slot.x;
              d.targetZ = slot.z;
              d.detour.side = 0;
              d.legTimer = GRAB_TIMEOUT;
              activeGrabbers += 1;
              break;
            }
          }
          const dxToRobot = robotX - d.x;
          const dzToRobot = robotZ - d.z;
          if (dxToRobot * dxToRobot + dzToRobot * dzToRobot < CHASE_DETECTION_RADIUS * CHASE_DETECTION_RADIUS) {
            if (Math.random() < PASSIVE_CHASE_CHANCE_PER_SEC * dt) {
              d.state = 'chasing';
              d.chaseTimer = CHASE_TIMEOUT;
              d.bubble.show(randomLunchChaseLine(), HIT_REACTION_DURATION);
            }
          }
          break;
        }
        case 'grabbing': {
          d.legTimer -= dt;
          if (d.legTimer <= 0) {
            // Couldn't get there — drop the claim so the sandwich is free for
            // someone who can, and go home. See GRAB_TIMEOUT.
            d.targetSlot = null;
            activeGrabbers -= 1;
            d.state = 'leaving';
            d.detour.side = 0;
            d.targetX = ATTENDEE_SPAWN_POINT[0];
            d.targetZ = ATTENDEE_SPAWN_POINT[1];
            break;
          }
          // Steers at the slot's exact coordinates, same as 'approaching',
          // but "arrives" as soon as it's within GROUND_REACH_RADIUS rather
          // than reaching the literal point — the table's own collider (see
          // the colliders loop just below) pushes anything solid back before
          // it can stand exactly on the sandwich, the same reason Biggy's own
          // ground-level eating uses this radius instead of PICKUP_RADIUS.
          const dxToSlot = d.targetX - d.x;
          const dzToSlot = d.targetZ - d.z;
          if (dxToSlot * dxToSlot + dzToSlot * dzToSlot < GROUND_REACH_RADIUS * GROUND_REACH_RADIUS) {
            // Recheck rather than trust the slot found when this leg started —
            // Biggy (or the sandwich's own crab-lifetime timeout) may have
            // taken it in the meantime, in which case this diner just leaves
            // empty-handed rather than idling to look for a second target.
            const slot = d.targetSlot;
            if (slot && slot.type && slot.mesh) {
              slot.sandwich?.dispose();
              this.group.remove(slot.mesh);
              slot.mesh = null;
              slot.sandwich = null;
              slot.halo = null;
              slot.type = null;
              slot.cooldown = SLOT_RESPAWN_COOLDOWN;
            }
            d.targetSlot = null;
            activeGrabbers -= 1;
            // Sandwich in hand, now drift around the buffet for a leg or two
            // before heading out — see DinerState's 'wandering'.
            d.state = 'wandering';
            d.detour.side = 0;
            d.wanderLegs = WANDER_LEGS_MIN + Math.floor(Math.random() * (WANDER_LEGS_MAX - WANDER_LEGS_MIN + 1));
            this.setWanderTarget(d);
          } else {
            const step = stepToward(d.x, d.z, d.targetX, d.targetZ, APPROACH_SPEED, dt, avoidFor(d));
            d.x = step.x;
            d.z = step.z;
            d.heading = step.heading;
          }
          break;
        }
        case 'wandering': {
          d.legTimer -= dt;
          const step = stepToward(d.x, d.z, d.targetX, d.targetZ, APPROACH_SPEED, dt, avoidFor(d));
          d.x = step.x;
          d.z = step.z;
          d.heading = step.heading;
          if (step.arrived || d.legTimer <= 0) {
            d.wanderLegs -= 1;
            if (d.wanderLegs > 0) {
              this.setWanderTarget(d);
            } else {
              d.state = 'leaving';
              d.targetX = ATTENDEE_SPAWN_POINT[0];
              d.targetZ = ATTENDEE_SPAWN_POINT[1];
            }
          }
          // A wanderer is loose on the floor with a sandwich Biggy wants, so
          // it's provokable like a queued one — otherwise the safest moment in
          // the level would be standing next to the diner who just took the
          // sandwich you were going for.
          const dxToRobot = robotX - d.x;
          const dzToRobot = robotZ - d.z;
          if (dxToRobot * dxToRobot + dzToRobot * dzToRobot < CHASE_DETECTION_RADIUS * CHASE_DETECTION_RADIUS) {
            if (Math.random() < PASSIVE_CHASE_CHANCE_PER_SEC * dt) {
              d.state = 'chasing';
              d.chaseTimer = CHASE_TIMEOUT;
              d.bubble.show(randomLunchChaseLine(), HIT_REACTION_DURATION);
            }
          }
          break;
        }
        case 'chasing': {
          d.chaseTimer -= dt;
          if (d.chaseTimer <= 0) {
            d.state = 'leaving';
            d.targetX = ATTENDEE_SPAWN_POINT[0];
            d.targetZ = ATTENDEE_SPAWN_POINT[1];
            break;
          }
          const dxToRobot = robotX - d.x;
          const dzToRobot = robotZ - d.z;
          const targetHeading = Math.atan2(dxToRobot, dzToRobot);
          const diff = ((targetHeading - d.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          const maxDelta = CHASE_TURN_RATE * dt;
          d.heading += THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
          d.x += Math.sin(d.heading) * CHASE_SPEED * dt;
          d.z += Math.cos(d.heading) * CHASE_SPEED * dt;
          break;
        }
        case 'leaving': {
          const step = stepToward(d.x, d.z, d.targetX, d.targetZ, LEAVE_SPEED, dt, avoidFor(d));
          d.x = step.x;
          d.z = step.z;
          d.heading = step.heading;
          break;
        }
      }

      if (d.state !== 'queued') {
        checkAndEscapeIfStuck(d, dt);
      }

      d.x = THREE.MathUtils.clamp(d.x, -halfW, halfW);
      d.z = THREE.MathUtils.clamp(d.z, -halfD, halfD);
      for (const c of colliders) {
        const dx = d.x - c.x;
        const dz = d.z - c.z;
        const minDist = c.radius + d.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          d.x = c.x + (dx / dist) * minDist;
          d.z = c.z + (dz / dist) * minDist;
        }
      }

      // NPC-vs-NPC separation — same push-out-along-the-normal technique as
      // the collider loop just above, against every other diner. O(n²) is
      // fine at MAX_ATTENDEES (14). Deliberately skipped whenever either
      // diner is 'queued' or 'leaving':
      //  - 'queued' diners stand QUEUE_SPACING (1.4) apart by design, closer
      //    than their own radius sum (2*HAZARD_RADIUS = 2.0) — a deliberate
      //    "standing in line" look, not accidental overlap. Enforcing full
      //    separation there would permanently shove them off their assigned
      //    queue slot.
      //  - 'leaving' diners all converge on ATTENDEE_SPAWN_POINT and are
      //    only removed once within a small radius of it (see the filter at
      //    the end of update()); pushing them apart there would stop some of
      //    them from ever reaching that removal radius, leaking diners
      //    forever in an endless-mode run.
      // That leaves 'approaching', 'grabbing', 'wandering' and 'chasing'
      // diners actually separated — the genuinely free-moving states where two
      // diners converging on the same spot is an accident, not a designed
      // formation.
      if (d.state !== 'queued' && d.state !== 'leaving') {
        for (const other of this.diners) {
          if (other === d) continue;
          if (other.state === 'queued' || other.state === 'leaving') continue;
          const dx = d.x - other.x;
          const dz = d.z - other.z;
          const minDist = d.radius + other.radius;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
            d.x = other.x + (dx / dist) * minDist;
            d.z = other.z + (dz / dist) * minDist;
          }
        }
        d.x = THREE.MathUtils.clamp(d.x, -halfW, halfW);
        d.z = THREE.MathUtils.clamp(d.z, -halfD, halfD);
      }

      d.mesh.position.set(d.x, 0, d.z);
      d.mesh.rotation.y = d.heading;

      const moving = d.state !== 'queued';
      const speed = d.state === 'chasing' ? CHASE_SPEED : d.state === 'queued' ? 0 : APPROACH_SPEED;
      if (moving) {
        d.walkPhase += speed * dt * HAZARD_WALK_CYCLE_RATE;
        const swing = Math.sin(d.walkPhase) * HAZARD_LEG_SWING;
        if (d.legL) d.legL.rotation.x = swing;
        if (d.legR) d.legR.rotation.x = -swing;
        if (d.armL) d.armL.rotation.x = -swing * HAZARD_ARM_SWING_RATIO;
        if (d.armR) d.armR.rotation.x = swing * HAZARD_ARM_SWING_RATIO;
      }

      if (d.state === 'queued') {
        d.gripeTimer -= dt;
        if (d.gripeTimer <= 0) {
          d.bubble.show(randomLunchQueueLine(), GRIPE_DURATION);
          d.gripeTimer = GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN);
        }
      }
      d.bubble.update(dt);
      const dxToRobot = robotX - d.x;
      const dzToRobot = robotZ - d.z;
      const distToRobotSq = dxToRobot * dxToRobot + dzToRobot * dzToRobot;
      d.bubble.sprite.visible = d.bubble.hasMessage() && distToRobotSq < SPEECH_VISIBLE_RANGE * SPEECH_VISIBLE_RANGE;

      if (this.hitCooldown <= 0 && distToRobotSq < (d.radius + robotRadius) * (d.radius + robotRadius)) {
        this.hitCooldown = STUN_DURATION + POST_STUN_GRACE;
        const wasChasing = d.state === 'chasing';
        d.bubble.show(wasChasing ? randomLunchCaughtReaction() : randomLunchBumpReaction(), HIT_REACTION_DURATION);
        if (wasChasing) {
          d.state = 'leaving';
          d.targetX = ATTENDEE_SPAWN_POINT[0];
          d.targetZ = ATTENDEE_SPAWN_POINT[1];
        }
        const outcome = this.bookHit(robot);
        stumbled = stumbled || outcome.stumbled;
        fell = fell || outcome.fell;
        growthToast = outcome.growthToast ?? growthToast;
      }
    }

    // Diners that walked all the way back off-map (gave up chasing, or their
    // queue patience ran out) are done — remove them for good rather than
    // growing the array forever over a long endless run.
    this.diners = this.diners.filter((d) => {
      if (d.state !== 'leaving') return true;
      const dx = d.x - ATTENDEE_SPAWN_POINT[0];
      const dz = d.z - ATTENDEE_SPAWN_POINT[1];
      if (dx * dx + dz * dz > 0.25) return true;
      this.group.remove(d.mesh);
      return false;
    });

    return { stumbled, fell, growthToast, pickedUp, drankBeer, rechargedFrom };
  }
}
