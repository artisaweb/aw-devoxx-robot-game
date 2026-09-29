import * as THREE from 'three';
import { CinematicHallway } from './CinematicHallway';
import { createDevoxxLetters, DevoxxLetters } from '../props/devoxxLetters';
import { createRobotChargingDock, RobotChargingDock } from '../props/robotChargingDock';
import { EVENT_SIGNAGE } from '../text/signage';

// Rough blockout proportions from the real venue's floor plan
// (one large rectangular hall, evenly spaced structural columns, two staircases
// up to the auditorium level along one long wall). Not pixel-traced.
// Bumped 1.5x (60x40 -> 90x60) per the user: "i believe the proportions of the
// exhibition hall should be a lot larger now" — the shell (walls, floor,
// ceiling, column grid) all scale automatically from these two constants.
// Booths, hazards, and kiosk positions (sponsorBooths.ts, SwagRun.ts,
// LunchRush.ts) are hand-placed absolute coordinates that do *not* auto-scale
// — they're unchanged, so the hall now reads as noticeably roomier with the
// same layout inside it, not a stretched one. Redistributing those across
// the extra space is a real follow-up pass of its own, not bundled into this
// one (matching how the first-floor hallway rebuild handled its own
// oversized-corridor problem: shell first, then correct pacing/pickups once
// the new scale was confirmed live).
export const HALL_WIDTH = 90; // x extent (meters)
export const HALL_DEPTH = 60; // z extent (meters)
export const WALL_HEIGHT = 8; // taller hall reads closer to the real venue photos' scale
export const COLUMN_SPACING = 10;
export const COLUMN_SIZE = 1;
const SOFFIT_HEIGHT = WALL_HEIGHT - 1;

// How far any character's body/limbs extend past its logical (x, z) position
// against a wall or solid prop — a property of the *mover*, not any
// particular wall, so both floors' collision systems read it from here
// instead of each guessing their own number. Matches Robot.ts's
// WALL_CLEARANCE (ROBOT_RADIUS 0.6 + 0.6 arm-swing allowance) exactly;
// defined here rather than imported from Robot.ts to avoid a circular
// import (Robot.ts already imports plenty from this file).
export const MOVER_CLEARANCE = 1.2;

// Entrance foyer, attached beyond the hall's front wall (+z). Full width of
// the reception-area frontage, not a narrow single doorway — a single
// opening across the whole width is simpler and closer to reality than a
// strip in front of a desk (per plan feedback).
//
// Used to be a detailed reception mockup (desk, check-in monitor, queue-rope
// stanchions) reached by a hard jump-up ledge. Revised twice the same day:
// first per the user ("I would respect the proportions and the elevation, with
// a stair in between, as in the example html file prototype"), pointing at
// the architect's floor plan's own wheelchair-ramp switchback beside the
// marked stair — the elevation change is real, so the ledge became a real
// walkable staircase. Then, rather than fully detailing the reception area
// to match reference photos: "if we are not going to proper style the
// reception hall, we could end the stairs we have now in place leading to
// the reception, with these glass doors being closed" — the desk/monitor/
// queue mockup is gone, replaced by a short landing capped with closed
// glass doors, the same look (and the same createGlassDoorTexture()) as
// the first-floor hallway's own stair-down ending.
export const FOYER_WIDTH = 26;
export const DOORWAY_WIDTH = FOYER_WIDTH; // no separate bottleneck: the gate is the same width as the room beyond it
export const FOYER_DEPTH = 10; // stair run + a short landing, not a full reception room
export const FOYER_FLOOR_Y = 1.0;
const FOYER_WALL_HEIGHT = 4;

// A real walkable staircase up from the hall to the elevated foyer — see
// FOYER_DEPTH's own comment for why. Same "rise strictly under
// AUTO_STEP_HEIGHT, not equal to it" margin the first-floor stairs already
// learned the hard way (floating-point noise can tip an exactly-equal
// comparison the wrong way, mid-descent/ascent).
const ENTRANCE_STAIR_RISE = 0.25;
const ENTRANCE_STAIR_TREAD_DEPTH = 1.2;
const NUM_ENTRANCE_STAIRS = Math.round(FOYER_FLOOR_Y / ENTRANCE_STAIR_RISE);
const ENTRANCE_STAIR_RUN_DEPTH = NUM_ENTRANCE_STAIRS * ENTRANCE_STAIR_TREAD_DEPTH;

export interface Collider {
  x: number;
  z: number;
  radius: number;
  // When set, this collider only pushes back a mover whose own y is below
  // this height — e.g. a jump-platform desk's sides should block walking
  // into them at ground level, but not fight the robot once it has actually
  // jumped up and is standing on top. Omitted (the common case) means solid
  // at every height, same as before this field existed.
  height?: number;
  // When true, only Robot.ts's own movement respects this collider —
  // KnowledgeRun.ts's hazards skip it entirely (see its collider loop's own
  // comment). Used for Room 4's row walls: the user's call after seeing the
  // landing redesign — hazards should climb every seat row freely (no jump,
  // no energy cost) while the *robot* still needs a real jump per row, so
  // the tension is energy management under a chasing hazard, not a hazard
  // being permanently walled off by geometry it can't climb.
  robotOnly?: boolean;
}

export interface RaisedZone {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  height: number;
}

// The real venue's staircases up to the auditorium level sit behind closed
// doors, out of sight from the exhibition hall floor — not an open ramp or a
// visible stairwell; the stair is behind a wall, after a double door.
// Modeling a staircase the player never sees would be a lot of geometry to
// make it read as a real level change, while still reading as "just part of
// the ground floor" — a door teleport sidesteps that entirely: walking up to
// either side instantly moves the robot to the other. It also means the two
// floors don't need to look architecturally connected at all — each can have
// its own identity (bright open exhibition hall vs. dark cinema corridor),
// like two distinct maps joined by a door.
export type Floor = 'ground' | 'first';

export const FLOOR_HEIGHT = 4.5; // first floor's story height
// -13, not the tidier -10 — that's exactly a column gridline (COLUMN_SPACING=10,
// gridlines at 0/±10/±20) and a column sits at (x=-10, z=-10) between the door
// and the hall's center, which would leave a robot walking straight toward
// the door stuck bouncing off it.
export const FIRST_FLOOR_CENTER_X = -13; // Stairs A/B door, on the ground floor's back wall

// First-floor layout — first decided 2026-09-24 as one real auditorium
// replacing four smaller mirrored rooms, then rebuilt at a much bigger,
// real-convention-center scale on 2026-09-26 to match the real floor plan
// (8 auditoriums total, 4 per side fanning out from one wide central
// corridor). Still only ONE of the 8 is a real playable interior — the
// other 7 stay closed-door props with nothing behind them, same scope
// decision as before, just at the new scale. See CinematicHallway.ts for the
// hallway shell itself; this file only decides the numbers (matching every
// other zone's own "visual size decided here, collision recess derived
// below" pattern) and builds the one real interior + the 7 decorative doors.
// Scaled down 2026-09-26 after a live playtest of the first pass ("it is
// probably too wide now indeed... somewhere in between half and 3 quarter of
// it") — corridor/side-depth/ceiling at ~0.65x their original spec numbers;
// length untouched since the width, not the length, was the actual
// complaint.
const HALLWAY_CORRIDOR_HALF_WIDTH = 7; // 14m walkable center
const HALLWAY_SIDE_DEPTH = 8; // furniture/door strip each side
const HALLWAY_HALF_LENGTH = 90; // 180m total — unchanged, no complaint about length
const HALLWAY_CEILING_HEIGHT = 12;
const HALLWAY_HALF_WIDTH = HALLWAY_CORRIDOR_HALF_WIDTH + HALLWAY_SIDE_DEPTH;
// 4 doors per side, local z relative to the hall's own center, near
// (entrance) end first — leaves ~35m of margin at each end for the entrance
// area and the far screen/stairs area, matching the reference prototype's
// own proportions. Room "4" (the one real interior) sits behind the 2nd
// slot, matching the real plan's own top-to-bottom order (3/4/5/6).
const HALLWAY_DOOR_Z_POSITIONS = [55, 25, -5, -35];
const HALL_ZONE: RaisedZone = {
  x: FIRST_FLOOR_CENTER_X,
  z: -49,
  halfW: HALLWAY_HALF_WIDTH,
  halfD: HALLWAY_HALF_LENGTH,
  height: FLOOR_HEIGHT,
};
// Reverted 2026-09-26, same day as the rotation attempt above: the user's call
// after seeing it live — "before this hall change, the cinema room was
// okay, we should probably revert it to that state... nvm the orientation,
// since the other rooms aren't implemented, they won't be in the way." Back
// to the pre-hallway-rebuild shape and orientation (rake along Z, entrance
// on the X-facing wall partway up the seating, real wall gap rather than a
// teleport) — only `x`/`z` change, to reattach to the new (bigger, kept)
// hallway's own left wall and door slot instead of the old small hall's.
// `halfW`/`halfD` are the exact pre-rebuild numbers, not re-derived —
// this is a revert, not a fresh resize.
// `z` re-derived, same day: the doorway's own position
// (buildAuditorium's `entranceCenterZ = zone.z - zone.halfD +
// STAGE_CLEARANCE`) doesn't land at the room's own `z` — it's offset toward
// the screen — so anchoring `z` directly at the door-slot position (as the
// first pass did) put the *room* there but left the *actual walkable
// doorway* ~19m further along, well past where the visible door-front prop
// sits. Solved for `z` so `entranceCenterZ` itself lands on the door slot
// instead (the user: "just move the room a bit so the door is around
// x:-26.41 z:-23.79").
const ROOM4_ZONE: RaisedZone = {
  x: HALL_ZONE.x - HALLWAY_HALF_WIDTH - 20,
  z: HALL_ZONE.z + HALLWAY_DOOR_Z_POSITIONS[1] + 24 - 5, // + halfD (24, below) - STAGE_CLEARANCE (5, declared later in this file) — solved so entranceCenterZ lands on the door slot
  halfW: 20,
  halfD: 24,
  height: FLOOR_HEIGHT,
};

// Every zone whose floor isn't flat — i.e. every real auditorium, at full
// (visual) size — for getFirstFloorHeightAt's tier lookup below. Only one
// now (see the DECIDED note above), kept as an array for the loop shape
// below rather than special-cased, in case a second real auditorium is ever
// added back deliberately.
const AUDITORIUM_ZONES: RaisedZone[] = [ROOM4_ZONE];

// The stage/podium at the front of an auditorium. Its numbers live here, not
// inside buildAuditorium, because the collision and height functions below
// have to agree with the mesh exactly — the same "one source for geometry and
// collision" rule every other raised surface in this file follows.
//
// It used to be pure scenery: no collider, no height entry. You could walk
// straight through it and, if you jumped, straight down through its top (the
// user: "in the past, i felt through it, i could walk, but not on top of
// it"). Now it's a real platform — STAGE_HEIGHT is above Robot.ts's
// AUTO_STEP_HEIGHT (0.3), so it can't be strolled onto, and well under the
// ~1.36m jump, so one jump puts you up there.
const STAGE_HEIGHT = 0.4;
const STAGE_DEPTH = 3;
/** The mesh's own footprint, shared by buildAuditorium and the collider/height functions. */
function auditoriumStage(zone: RaisedZone): { x: number; z: number; halfW: number; halfD: number; topY: number } {
  return {
    x: zone.x,
    z: zone.z - zone.halfD + STAGE_DEPTH / 2 + 0.5,
    halfW: zone.halfW * 0.7, // the mesh is roomHalfW * 1.4 wide
    halfD: STAGE_DEPTH / 2,
    topY: zone.height + STAGE_HEIGHT,
  };
}

/**
 * Height-gated colliders for every auditorium stage — blocks walking onto it
 * at floor level (so it has to be jumped) without fighting the robot once
 * it's standing up there, exactly like the lunch tables downstairs.
 *
 * Spaced as several circles along the long axis rather than one big circle,
 * for the same reason getLunchTableColliders does it: a single diagonal
 * radius around a 28x3 slab would block a huge disk of open apron.
 *
 * Level 2's attendees ignore Collider.height entirely (see KnowledgeRun's own
 * collider loop), so they are blocked by this at every height and cannot
 * follow the player up — the podium is a real refuge, the same way the lunch
 * tables are in Level 3.
 */
export function getAuditoriumStageColliders(): Collider[] {
  const colliders: Collider[] = [];
  for (const zone of AUDITORIUM_ZONES) {
    const stage = auditoriumStage(zone);
    const spacing = stage.halfD * 1.5;
    const count = Math.max(2, Math.ceil((stage.halfW * 2) / spacing) + 1);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      colliders.push({
        x: stage.x - stage.halfW + t * stage.halfW * 2,
        z: stage.z,
        radius: stage.halfD,
        height: stage.topY,
      });
    }
  }
  return colliders;
}

/** The stage's own top surface, when standing over one — checked before the seating rows, which would otherwise claim this same patch of floor as flat apron. */
function auditoriumStageSurfaceHeightAt(x: number, z: number): number | undefined {
  for (const zone of AUDITORIUM_ZONES) {
    const stage = auditoriumStage(zone);
    if (Math.abs(x - stage.x) <= stage.halfW && Math.abs(z - stage.z) <= stage.halfD) return stage.topY;
  }
  return undefined;
}
// Named export for consumers that need the one real auditorium's full-size
// zone (e.g. KnowledgeRun scattering pickups/hazards across it) — safer
// than positionally destructuring FIRST_FLOOR_ZONES, which silently breaks
// if a zone is ever added or reordered.
export { HALL_ZONE as FIRST_FLOOR_HALL_ZONE, ROOM4_ZONE as FIRST_FLOOR_ROOM4_ZONE };

// A real, walkable staircase down from the hall's far end (by Room 6/7, the
// last door pair) to a small lower lobby with closed glass doors "outside" —
// per the real venue photos (auditorium-stage-screen-sponsors.jpg,
// hallway_85s.jpg/hallway_110s.jpg) and the user's own prototype (`ideas/wider
// hall with connections to the room and extra assets.html`, whose stairs
// used an 0.5 rise — too steep here: Robot.ts's AUTO_STEP_HEIGHT is 0.3, and
// anything steeper is a real ledge (falls, or needs a jump), which a
// walking staircase shouldn't be). Nothing teleports the player between
// floors — the levels advance on their own (Game.ts's advanceToLevelX) — and
// nothing stops a player walking straight up to this end, so this has to hold
// up as real geometry underfoot, not just look right from a distance.
// Strictly *under* AUTO_STEP_HEIGHT (0.3), not equal to it — verified live
// that exactly 0.3 isn't actually safe: floating-point noise from repeated
// `FLOOR_HEIGHT - n * STAIR_RISE` subtraction occasionally nudges a step's
// real height a hair below the exact boundary, which very occasionally
// tipped `groundY < y - AUTO_STEP_HEIGHT` (Robot.ts) the wrong way and
// triggered a brief real ledge-fall mid-descent. A real margin, not just a
// smaller number, is what actually fixes it.
const STAIR_RISE = 0.25;
const STAIR_TREAD_DEPTH = 1.2;
const NUM_STAIRS = 12; // 3.0m total drop — comfortable, not a jump-gated climb like the auditorium's own rows
const STAIR_PIT_DEPTH = 6; // the lower lobby floor, beyond the last step
const STAIR_RUN_DEPTH = NUM_STAIRS * STAIR_TREAD_DEPTH;
const STAIR_ZONE_HALF_WIDTH = HALLWAY_CORRIDOR_HALF_WIDTH; // matches the walkable corridor's own width, narrower than the hall's furniture strips either side
const STAIR_ZONE_HALF_D = (STAIR_RUN_DEPTH + STAIR_PIT_DEPTH) / 2;
const STAIR_TOP_Z = HALL_ZONE.z - HALL_ZONE.halfD; // the hall's own true far wall plane — the stairs start exactly there, no gap
const STAIR_ZONE: RaisedZone = {
  x: HALL_ZONE.x,
  z: STAIR_TOP_Z - STAIR_ZONE_HALF_D,
  halfW: STAIR_ZONE_HALF_WIDTH,
  halfD: STAIR_ZONE_HALF_D,
  height: FLOOR_HEIGHT - NUM_STAIRS * STAIR_RISE, // the lower lobby's own flat floor height
};

/** Descends one real step at a time toward the pit, then flattens out — mirrors auditoriumRowHeightAt's own shape (a per-position height function paired with a single flat RaisedZone), just going down instead of up. */
function stairHeightAt(x: number, z: number): number | undefined {
  if (Math.abs(x - STAIR_ZONE.x) > STAIR_ZONE.halfW || Math.abs(z - STAIR_ZONE.z) > STAIR_ZONE.halfD) return undefined;
  const distIntoStairs = STAIR_TOP_Z - z; // 0 at the top (hall side), growing toward the pit
  if (distIntoStairs >= STAIR_RUN_DEPTH) return STAIR_ZONE.height;
  const step = Math.floor(distIntoStairs / STAIR_TREAD_DEPTH);
  return FLOOR_HEIGHT - (step + 1) * STAIR_RISE;
}

// Bridges the hall's own recessed far edge to the stair zone's own (raw,
// unrecessed on this side — it's a real opening, not a wall) near edge —
// same "small zone spanning exactly the gap a recess leaves" principle as
// makeDoorwayZone, just along z instead of x, and not reusing that function
// directly since it's coupled to the auditorium-door-specific geometry
// (STAGE_CLEARANCE, entranceSide). Narrower than the hall itself (matches
// STAIR_ZONE's own width) — the stairs don't span the hall's full width,
// only its walkable corridor.
const HALL_STAIR_BRIDGE: RaisedZone = {
  x: HALL_ZONE.x,
  z: STAIR_TOP_Z + MOVER_CLEARANCE / 2, // midpoint of [STAIR_TOP_Z, STAIR_TOP_Z + MOVER_CLEARANCE] — the exact gap the recess on either side leaves
  halfW: STAIR_ZONE.halfW,
  halfD: MOVER_CLEARANCE / 2 + 0.1,
  height: FLOOR_HEIGHT,
};

// The mid-corridor pair of staircases down, one through each side wall — the
// real first-floor plan (private/assets/reference/venue/.../plan-first-floor-
// rooms-3-10.jpg) marks three ways down off this corridor: a left/right pair
// level with rooms 4 and 9 ("◀ Ground floor ▶") and one at the far end. Only
// the far-end one existed (Stair C, above); the user: "two stairs are missing
// on level 2."
//
// Placeholders in the sense that matters for gameplay: they descend one real
// flight and stop at a closed door, with nothing linking them to the ground
// floor (the user: "these stairs end in the closed two rooms on the ground
// floor (just placeholder, not real link between the two floors)"). That's
// true of every stair in this game — Stair C included — so it's the house
// pattern here, not an exception.
//
// Real walkable geometry all the same, for exactly the reason Stair C is:
// nothing stops the player walking up to a visible opening, so it has to hold
// up underfoot rather than only from a distance.
//
// Orientation, rebuilt 2026-09-29. These first ran *across* the corridor —
// each flight punched through a side wall and descended outward along x, into
// space outside the building's own footprint. The user: "the stair at the left
// side and right side is correct in dimensions, but the orientation is not
// correct, they should rotate 90 degrees and are going down within the hall,
// make sure we don't fall into it, but where they are located now is just
// wrong." So the dimensions below are untouched and only the axis and position
// changed: each run now descends along z, parallel to the corridor, sunk into
// the hall's own floor against a side wall — which is also how the first-floor
// plan draws them, as runs beside the corridor between the room blocks rather
// than as openings in its walls.
//
// That swap is what makes the railing below load-bearing rather than dressing.
// Outside the building the old wells were guarded for free, because the hall's
// own zone simply didn't reach them. Sunk into the hall floor there is no such
// boundary to lean on: HALL_ZONE covers the well's whole footprint, so
// isOnFirstFloor is true standing over it and getFirstFloorHeightAt hands back
// the step height wherever you are. Nothing but a real collider keeps a robot
// out of a 3m hole — see getSideStairRailingColliders.
const SIDE_STAIR_HALF_WIDTH = 3; // 6m wide opening — a venue staircase, not a room-wide gap
// Same rise/tread/step count/pit as Stair C — these read as the same
// building's stairs because they are built from the same numbers.
const SIDE_STAIR_RUN_LENGTH = STAIR_RUN_DEPTH + STAIR_PIT_DEPTH;
const SIDE_STAIR_ZONE_HALF_D = SIDE_STAIR_RUN_LENGTH / 2;
// Each well hugs a side wall, so its outer edge lands on the wall plane and its
// 6m width eats into the furniture strip rather than the walking corridor.
const SIDE_STAIR_CENTER_X_LEFT = HALL_ZONE.x - HALLWAY_HALF_WIDTH + SIDE_STAIR_HALF_WIDTH;
const SIDE_STAIR_CENTER_X_RIGHT = HALL_ZONE.x + HALLWAY_HALF_WIDTH - SIDE_STAIR_HALF_WIDTH;
// Solved rather than picked, because the left wall is the binding constraint and
// the fit is tight. Room 4's frontage is a real opening in that wall from
// z -29 all the way to z 19, and the next door-front prop south of it sits at
// z -54 with a 5.5m signage panel (so its edge is z -51.25). That leaves 22.25m
// of usable wall against a 20.4m run: the flight starts MOVER_CLEARANCE clear of
// Room 4's edge and descends away from it, which puts its far end at -50.6, just
// clear of that panel. The right wall has no room frontage and is 24.5m clear
// between the same two door slots, so the pair still sits at one z.
const SIDE_STAIR_TOP_Z = -29 - MOVER_CLEARANCE;

/**
 * One mid-corridor staircase. `topZ` is where the first step drops below the
 * hall floor and `dirZ` which way it descends, which is all sideStairHeightAt
 * needs to reuse Stair C's own per-step formula.
 */
interface SideStair {
  zone: RaisedZone;
  topZ: number;
  dirZ: -1 | 1;
}

/** Both wells descend the same way — away from Room 4 and from the end of the corridor the robot arrives at, so the open top is the end you reach first. */
const SIDE_STAIR_DIR_Z = -1;

const SIDE_STAIRS: SideStair[] = [SIDE_STAIR_CENTER_X_LEFT, SIDE_STAIR_CENTER_X_RIGHT].map((centerX) => ({
  zone: {
    x: centerX,
    z: SIDE_STAIR_TOP_Z + SIDE_STAIR_DIR_Z * SIDE_STAIR_ZONE_HALF_D,
    halfW: SIDE_STAIR_HALF_WIDTH,
    halfD: SIDE_STAIR_ZONE_HALF_D,
    height: FLOOR_HEIGHT - NUM_STAIRS * STAIR_RISE,
  },
  topZ: SIDE_STAIR_TOP_Z,
  dirZ: SIDE_STAIR_DIR_Z,
}));

/**
 * True anywhere inside either mid-corridor stairwell (see SIDE_STAIRS).
 *
 * The player may walk down these; Level 2's attendees may not (KnowledgeRun
 * applies this alongside its isOnFirstFloor bounds check). They are
 * placeholder scenery ending at a closed door, so an attendee that wanders
 * down one has left the level for good — measured before this existed, one
 * hazard in six four-minute runs walked into a stairwell and was still down
 * there 210 seconds later, which quietly removes a tenth of the level's
 * difficulty and parks a visibly stuck attendee at the bottom.
 */
export function isInSideStairwell(x: number, z: number): boolean {
  return SIDE_STAIRS.some(
    ({ zone }) => Math.abs(x - zone.x) <= zone.halfW && Math.abs(z - zone.z) <= zone.halfD,
  );
}

/** stairHeightAt's own formula — see SideStair. Returns undefined anywhere outside both runs, so callers fall through to the normal zone height. */
function sideStairHeightAt(x: number, z: number): number | undefined {
  for (const stair of SIDE_STAIRS) {
    const { zone } = stair;
    if (Math.abs(x - zone.x) > zone.halfW || Math.abs(z - zone.z) > zone.halfD) continue;
    const distIntoStairs = (z - stair.topZ) * stair.dirZ; // 0 at the top (hall floor), growing toward the landing
    if (distIntoStairs >= STAIR_RUN_DEPTH) return zone.height;
    const step = Math.floor(distIntoStairs / STAIR_TREAD_DEPTH);
    return FLOOR_HEIGHT - (step + 1) * STAIR_RISE;
  }
  return undefined;
}

/**
 * The balustrade that keeps a robot from walking off the hall floor into a
 * well: down the corridor-facing long edge of each one and across its far end,
 * leaving only the top of the flight open. This is the entire fall guard (see
 * SIDE_STAIRS' own note on why zone membership can't do it any more).
 *
 * Circles along a line, like getStairEnclosureColliders — but spaced off
 * ROW_WALL_MIN_REACH's own lesson rather than by eye. A run of circles blocks
 * at `reach` only directly in front of one; exactly between two it blocks at
 * sqrt(reach² − (spacing/2)²), and it's that worst case that has to hold,
 * because the failure it allows here isn't clipping a wall — it's slipping
 * between two posts into a 3m drop.
 */
const SIDE_STAIR_RAIL_RADIUS = 0.5;
const SIDE_STAIR_RAIL_SPACING = (SIDE_STAIR_RAIL_RADIUS + MOVER_CLEARANCE) * 0.5;
export function getSideStairRailingColliders(): Collider[] {
  const colliders: Collider[] = [];
  const line = (x1: number, z1: number, x2: number, z2: number) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const count = Math.max(2, Math.ceil(length / SIDE_STAIR_RAIL_SPACING) + 1);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      colliders.push({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t, radius: SIDE_STAIR_RAIL_RADIUS });
    }
  };
  for (const { zone } of SIDE_STAIRS) {
    // The corridor-facing edge is whichever of the well's long sides faces the
    // hall's centreline; the other one is the building's own side wall.
    const railX = zone.x + Math.sign(HALL_ZONE.x - zone.x) * SIDE_STAIR_HALF_WIDTH;
    const topZ = zone.z - SIDE_STAIR_DIR_Z * SIDE_STAIR_ZONE_HALF_D;
    const farZ = zone.z + SIDE_STAIR_DIR_Z * SIDE_STAIR_ZONE_HALF_D;
    line(railX, topZ, railX, farZ);
    line(railX, farZ, zone.x - Math.sign(HALL_ZONE.x - zone.x) * SIDE_STAIR_HALF_WIDTH, farZ);
  }
  return colliders;
}

// Half-width of the gap between the hall and an auditorium, in the wall they
// share — the visual wall-gap in createFirstFloor() and the walkable
// doorway zone below both derive from this.
const AUDITORIUM_ENTRANCE_GAP_HALF = 2.5;
// Seating rises one real ROW at a time, not one continuous smooth ramp and
// not grouped into a handful of big flat landings either (2026-09-24
// redesign, then revised same day). The room
// first rose in ~22 tiny TIER_RISE=0.26 steps, all under Robot.ts's
// AUTO_STEP_HEIGHT — read as real stadium stairs but meant the whole room
// was reachable by just walking (the user: "walking through them is not the
// solution"). That became six big flat landings gated by real jump walls —
// but the user's next call added a second axis: *every* row should step up, and
// hazards should climb that freely while the *robot* alone needs to jump it
// — landings-as-hazard-safe-havens isn't the point, energy management under
// a hazard that can still follow you is. A continuous height function alone
// can't force a jump (it only decides where a mover's y snaps to once
// already at some x/z — nothing stops the horizontal move that gets it
// there); only a real collider can, which is why every row boundary below
// gets one (getAuditoriumRowWallColliders) — marked `robotOnly` so
// KnowledgeRun.ts's hazards skip it and just climb (see Collider.robotOnly).
// ROW_RISE itself is real-cinema-scale, not deliberately jump-sized the way
// the old per-landing rise was: the jump requirement now comes purely from
// the collider being robotOnly, not from the rise being tall.
const ROW_RISE = 0.35;
const STAGE_CLEARANCE = 5; // where the entrance doorway sits (see buildAuditorium's entranceCenterZ) — a real flat crossing, not a jump
// ROOM4_ZONE.z is solved backward from this so buildAuditorium's own
// entranceCenterZ lands exactly on the hallway's door-slot position — fails
// loudly if a future change to STAGE_CLEARANCE/ROOM4_ZONE.halfD silently
// reopens the "door doesn't line up with the door-front prop" gap the user
// caught live (2026-09-26).
{
  const actualDoorZ = ROOM4_ZONE.z - ROOM4_ZONE.halfD + STAGE_CLEARANCE;
  const expectedDoorZ = HALL_ZONE.z + HALLWAY_DOOR_Z_POSITIONS[1];
  if (Math.abs(actualDoorZ - expectedDoorZ) > 0.01) {
    throw new Error(
      `Room 4 doorway misaligned: entranceCenterZ (${actualDoorZ}) doesn't match the hallway door slot (${expectedDoorZ}). Re-derive ROOM4_ZONE.z.`,
    );
  }
}
// A row wall isn't a thin line, it's a row of circle colliders each blocking
// ROW_WALL_RADIUS + MOVER_CLEARANCE around their center (see
// getAuditoriumRowWallColliders) — its true reach extends that far to either
// side of its nominal z. Caught live (with the earlier landing system, same
// underlying issue): too thin a buffer here lets that reach bleed into the
// doorway zone itself, so a robot can barely clear the door before the first
// wall starts blocking it. APRON_DEPTH derives the buffer from that same
// reach instead of a guessed literal — past the doorway's own far edge, past
// the wall's full blocking reach, plus a couple meters of genuinely clear
// floor to actually walk into the room on.
//
// The radius itself is deliberately small. Unlike BOOTH_PLATFORM_ZONES's own
// radius (a real ledge/desk object's actual footprint, which the collider
// has to match), this wall is pure mechanism — nothing is visually that
// size, so there's no footprint to honor. Every extra meter of radius is
// pure "dead zone" every row has to reserve near its own far wall (see
// SEAT_CLEARANCE_PAST_WALL below), eaten directly out of the depth available
// for open floor and seats. Kept only big enough that a sane number of
// circles (ROW_WALL_SPACING) still cover the room's width with real overlap.
const ROW_WALL_RADIUS = 0.6;
// A row wall's real push-out radius (see getAuditoriumRowWallColliders) —
// reused below for both the doorway buffer and for sizing rows themselves.
const ROW_WALL_REACH = ROW_WALL_RADIUS + MOVER_CLEARANCE;
// Row-wall colliders are spaced this far apart along x. Tighter than the
// bare "no gap" requirement (2×reach) on purpose — see ROW_WALL_MIN_REACH's
// own comment for why the spacing itself, not just whether it leaves a gap,
// turned out to matter. 0.3× (not the earlier 0.5×) for extra margin — see
// SEAT_CLEARANCE_PAST_WALL's own comment for why that margin turned out to
// matter too.
const ROW_WALL_SPACING = ROW_WALL_REACH * 0.3;
// Caught live (the user: "i can walk through the chairs"): ROW_WALL_REACH is the
// wall's blocking distance only exactly at a collider's own x — a robot
// approaching exactly *between* two circles is blocked sooner (closer to the
// wall, not farther — a smaller reach there means less protection), at only
// sqrt(REACH² − (spacing/2)²). At the original spacing (reach×1.8, sized
// only to rule out a walk-through gap, never to keep this distance uniform)
// that worst case left a robot's own body overlapping furniture placed using
// the best-case reach. Tightening the spacing keeps the guaranteed worst
// case close to the best case — everything below measures clearance from
// THIS worst case, never the best case, so it can't recur.
const ROW_WALL_MIN_REACH = Math.sqrt(ROW_WALL_REACH ** 2 - (ROW_WALL_SPACING / 2) ** 2);
const APRON_DEPTH = STAGE_CLEARANCE + AUDITORIUM_ENTRANCE_GAP_HALF + ROW_WALL_REACH + 2;
// (ROBOT_RADIUS matches Robot.ts's own exported constant; not imported here
// to avoid a circular import back into a file Robot.ts itself imports from.)
const ROBOT_RADIUS = 0.6;
const SEAT_HALF_DEPTH = 0.34; // half of SEAT_DEPTH below, matching the cushion geometry
const RISER_THICKNESS = 0.3; // matches the riser box geometry below
// Where the seat sits relative to the wall — not measured *back* from it (a
// distance the robot needs to stay clear of, as every earlier round of this
// treated it), but *forward* into the narrow band right against it that the
// robot's own body can never reach at all. Traced through tryMove()'s actual
// push-out math by hand before writing this, since every earlier round's
// version of this constant had the relationship backwards: the robot's
// CENTER stops at `wallZ − reach` (a *center*-to-center distance), and
// nothing stops it walking through anything positioned *before* that point —
// the seat has no collision of its own, so anywhere short of the wall's own
// stopping zone gets walked straight through, robot body and all. The one
// stretch of floor the robot's body genuinely cannot reach is the sliver
// from the wall itself out to `ROW_WALL_MIN_REACH − ROBOT_RADIUS` — that's
// where the seat has to live for "at the back, not walked through" to be
// true simultaneously. Two independent floors on how close its near edge
// (facing the robot) can get:
//  1. Clear of the riser's own visual thickness, plus a small real gap —
//     otherwise the chair clips into the very step it's supposedly behind.
//  2. Clear of the robot's worst-case body reach, plus a safety buffer —
//     the actual bug this round ("i can walk through the chairs"), now
//     measured from the correct end.
// Both are asserted live before ever landing in the room — see
// buildAuditorium's own seat-placement comment for the verification method.
const SEAT_CLEARANCE_PAST_WALL = RISER_THICKNESS / 2 + 0.1 + SEAT_HALF_DEPTH;
const SEAT_CLEARANCE_CEILING = ROW_WALL_MIN_REACH - ROBOT_RADIUS - 0.2 - SEAT_HALF_DEPTH;
if (SEAT_CLEARANCE_PAST_WALL > SEAT_CLEARANCE_CEILING) {
  // A future change to any of the constants above (radius, spacing, robot
  // size, seat depth) could close this gap again — fail loudly at build
  // time instead of silently reintroducing the overlap bug this comment is
  // about, the same class of mistake three straight rounds already made
  // silently.
  throw new Error(
    `Room 4 seat placement unsafe: SEAT_CLEARANCE_PAST_WALL (${SEAT_CLEARANCE_PAST_WALL}) exceeds the robot-overlap ceiling (${SEAT_CLEARANCE_CEILING}). Tighten ROW_WALL_SPACING or shrink RISER_THICKNESS/SEAT_HALF_DEPTH.`,
  );
}
// One real seat row per tier, not two. The user's own test caught why a second,
// "front" row can never work here, no matter how it's placed: "in the one,
// we can't walk through (good thing), and in the other, we can (not a good
// thing). The one that is fine is the one closest to the next level." The
// back row works because it sits in the sliver right against the wall the
// robot's body can never reach (see SEAT_CLEARANCE_PAST_WALL above) — but
// that only exists once, at the wall. A second row sitting anywhere *else*
// in the tier is, by definition, somewhere the robot's ordinary walk already
// passes through freely on its way to that same wall — there's no other
// place in a flat tier for an unreachable band to exist. Once you've jumped
// into a tier at all, you're already at its one height everywhere in it, so
// no second, later "wall" inside the same tier could ever add a real jump
// requirement either — it would just already be satisfied. The only way to
// make a second row of seats genuinely blocking is to give it its own tier,
// which is exactly what removing SEAT_ROWS_PER_TIER buys back: the row
// budget below is smaller with one row than it was with two, so more,
// shallower real tiers fit in the same room depth — closer to "every row is
// a real jump," the original ask, not further from it.
const OPEN_FLOOR_MIN = 1.0;
const SEAT_DEPTH = 0.68;
const MIN_ROW_DEPTH = OPEN_FLOOR_MIN + SEAT_DEPTH + SEAT_CLEARANCE_PAST_WALL;
const NUM_ROWS = Math.floor((ROOM4_ZONE.halfD * 2 - APRON_DEPTH) / MIN_ROW_DEPTH);
// Derived from ROOM4_ZONE's own depth rather than a fixed literal, same
// single-source-of-truth principle as the old tier system — a future resize
// can't silently leave the visible rows and the walkable row heights
// (auditoriumRowHeightAt) disagreeing.
const ROW_DEPTH = (ROOM4_ZONE.halfD * 2 - APRON_DEPTH) / NUM_ROWS;

// Real, height-gated wall colliders at every row boundary, robotOnly (see
// Collider.robotOnly) — this is the piece that actually forces the robot to
// jump (auditoriumRowHeightAt only decides where a mover's y snaps to once
// it's at some x/z; it can't stop the horizontal move that got it there),
// while leaving hazards free to climb every row without one. Spans the
// room's FULL width per this project's own wall-coverage rule (see
// feedback_mover_derived_clearance / the sponsor-booth backdrop fix this
// same file's history already went through): a single circle can't
// represent a 40m-wide wall, so this is several circles — spaced tightly
// enough (ROW_WALL_SPACING) that the wall's own blocking distance stays
// close to uniform across its width, not just close enough to rule out a
// gap (see ROW_WALL_MIN_REACH's own comment for why that distinction
// mattered here).
export function getAuditoriumRowWallColliders(): Collider[] {
  const zone = ROOM4_ZONE;
  const count = Math.ceil((zone.halfW * 2) / ROW_WALL_SPACING) + 1;
  const colliders: Collider[] = [];
  for (let row = 0; row < NUM_ROWS; row++) {
    // Front edge of `row` itself (row 0's wall sits APRON_DEPTH past the
    // doorway, not at it — see APRON_DEPTH) — blocks up to the height a
    // mover needs to be standing on `row`.
    const boundaryZ = zone.z - zone.halfD + APRON_DEPTH + row * ROW_DEPTH;
    const blockHeight = zone.height + (row + 1) * ROW_RISE;
    for (let i = 0; i < count; i++) {
      const x = zone.x - zone.halfW + (i * (zone.halfW * 2)) / (count - 1);
      colliders.push({ x, z: boundaryZ, radius: ROW_WALL_RADIUS, height: blockHeight, robotOnly: true });
    }
  }
  return colliders;
}

// The hallway's own furniture (tables/chairs), check-in kiosks, and pillars
// were pure set dressing — no Collider at all — until the user reported "the
// lamp and tables/chairs should be real objects, now we can just walk
// through". CinematicHallway.ts's own getters return LOCAL (hall-center-
// relative) positions, same convention as its doorLocalPositions() —
// translated here by the live instance's own world position, so this can
// never drift from what actually got built.
export function getHallwayPropColliders(): Collider[] {
  if (!hallwayInstance) return [];
  const wx = hallwayInstance.position.x;
  const wz = hallwayInstance.position.z;
  const toCollider = (p: { x: number; z: number; radius: number }): Collider => ({ x: wx + p.x, z: wz + p.z, radius: p.radius });
  // Jump-clearable (a real `height`, not a flat wall) — the user first asked for
  // this on the pillars ("I would prefer if we are able to jump on it"),
  // then explicitly for the tables too ("cannot jump on the tables"). Chairs
  // get the same treatment for consistency — they're smaller than the
  // tables right next to them, so leaving them as flat walls while the
  // tables became jumpable would make the *smaller* object the harder
  // obstacle, backwards from how it reads visually. Kiosks stay flat (not
  // asked for, and a standing pole+screen reads more like a wall-mounted
  // post to route around than furniture to hop over).
  //
  // `height` here is each prop's own true top surface (from `topHeight`),
  // not a shared guessed clearance number — it doubles as both the jump-clear
  // threshold (a real jump clears these trivially, well under the ~1.36 max
  // jump height) and, via getHallwayPropSurfaceHeightAt() below, the actual
  // surface the mover lands ON — without that second half, jumping onto a
  // table dropped the mover straight through it to the hall's flat floor
  // (the user: "when jumping on the table, i fall into it").
  const toStandable = (p: { x: number; z: number; radius: number; topHeight: number }): Collider => ({
    ...toCollider(p),
    height: hallwayInstance!.position.y + p.topHeight,
  });
  return [
    ...hallwayInstance.furnitureColliderPositions().map(toStandable),
    ...hallwayInstance.kioskColliderPositions().map(toCollider),
    ...hallwayInstance.pillarColliderPositions().map(toStandable),
  ];
}

// getFirstFloorHeightAt's own furniture-aware lookup — the hallway's tables/
// chairs/pillar fixtures aren't zones (RaisedZone is one flat/tiered
// rectangle; these are scattered circular footprints), so they need their
// own check rather than fitting into findFirstFloorZone. Returns the tallest
// prop surface the position falls within, or undefined if it's clear of all
// of them (the normal zone height applies). Reuses getHallwayPropColliders()
// rather than recomputing footprints a second way — same "one answer" reason
// every other collider/height pair in this file shares a single source.
function getHallwayPropSurfaceHeightAt(x: number, z: number): number | undefined {
  let best: number | undefined;
  for (const c of getHallwayPropColliders()) {
    if (c.height === undefined) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz <= c.radius * c.radius && (best === undefined || c.height > best)) {
      best = c.height;
    }
  }
  return best;
}

// An auditorium's own collision footprint recesses short of *every* side —
// the hall on its entrance-facing side, the neighboring auditorium (for Room
// 4/9, whose screen wall touches Room 5/8's back wall directly), and its own
// solid outer wall too. A doorway zone is about there being a real opening to
// walk through, but the recess itself is about the *mover* needing room next
// to any wall — an outer wall with genuinely nothing on the other side still
// needs that same clearance; it just never gets a bridging doorway zone.
// isOnFirstFloor then only lets you cross from the hall into a room through a
// small bridging "doorway" zone (built below) at the actual entrance's
// location — everywhere else along a recessed wall, the recess leaves a true
// gap no zone covers, blocked exactly like any other decorative wall. The
// recess amount is MOVER_CLEARANCE (a property of whatever's walking through
// here, not this wall specifically) rather than its own independently-guessed
// margin.

type WallSide = 'left' | 'right' | 'near' | 'far';

/** Shrinks `base` by `margin` on one side (x for left/right, z for near/far), leaving the opposite edge fixed. */
function recessWall(base: RaisedZone, side: WallSide, margin: number): RaisedZone {
  if (side === 'left' || side === 'right') {
    const leftEdge = base.x - base.halfW;
    const rightEdge = base.x + base.halfW;
    const newLeft = side === 'left' ? leftEdge + margin : leftEdge;
    const newRight = side === 'right' ? rightEdge - margin : rightEdge;
    return { x: (newLeft + newRight) / 2, z: base.z, halfW: (newRight - newLeft) / 2, halfD: base.halfD, height: base.height };
  }
  const nearEdge = base.z + base.halfD;
  const farEdge = base.z - base.halfD;
  const newNear = side === 'near' ? nearEdge - margin : nearEdge;
  const newFar = side === 'far' ? farEdge + margin : farEdge;
  return { x: base.x, z: (newNear + newFar) / 2, halfW: base.halfW, halfD: (newNear - newFar) / 2, height: base.height };
}

// recessWall/MOVER_CLEARANCE apply to any RaisedZone with a real wall on a
// given side — the hall itself needs the same treatment (see
// FIRST_FLOOR_ZONES below), so this is named generically rather than
// auditorium-specific.
/** A zone's collision footprint, recessed by MOVER_CLEARANCE on every side named that touches a real wall. */
function recessedZone(base: RaisedZone, ...sides: WallSide[]): RaisedZone {
  return sides.reduce((zone, side) => recessWall(zone, side, MOVER_CLEARANCE), base);
}

/**
 * A small zone bridging a recessed wall back to whatever's on its other
 * side, exactly at a real doorway — centered on the shared wall plane itself
 * (not weighted toward either side), spanning MOVER_CLEARANCE past it in
 * both directions plus a small safety overlap. That symmetry matters: this
 * bridges between two *independently* recessed zones (an auditorium's own
 * recess and the hall's own recess), so it must reach whichever recessed
 * edge is farthest from the wall on either side, not just one of them.
 */
function makeDoorwayZone(base: RaisedZone, entranceSide: 'left' | 'right'): RaisedZone {
  const wallEdgeX = entranceSide === 'left' ? base.x - base.halfW : base.x + base.halfW; // the room's true (visual) wall, shared with the hall's own wall at this x
  const entranceCenterZ = base.z - base.halfD + STAGE_CLEARANCE;
  return {
    x: wallEdgeX,
    z: entranceCenterZ,
    halfW: MOVER_CLEARANCE + 0.1, // bridges both the room's recess and the hall's recess, plus a small safety overlap on each end
    halfD: AUDITORIUM_ENTRANCE_GAP_HALF,
    height: base.height, // flat, matching the hall — the room's own tier climb starts just past this
  };
}

// Named (not inlined into FIRST_FLOOR_ZONES below) so the HUD's minimap can
// mark exactly where this door is instead of leaving it to be inferred from
// where two zone rectangles happen to touch — the user: "on the map hud it
// should be clear where the door between the hall and the room is, now it
// is a bit hard to find."
const ROOM4_DOORWAY_ZONE = makeDoorwayZone(ROOM4_ZONE, 'right');
export { ROOM4_DOORWAY_ZONE as FIRST_FLOOR_ROOM4_DOORWAY };

export const FIRST_FLOOR_ZONES: RaisedZone[] = [
  // The hall's own four walls (end-caps built directly in
  // createFirstFloor(), side walls by CinematicHallway) are exactly as real
  // and solid as any room's — recessed the same way every room is, so the
  // mover keeps its usual clearance against them too.
  recessedZone(HALL_ZONE, 'near', 'far', 'left', 'right'),
  // Room 4 is the only real interior (see the DECIDED note above) — its own
  // solid outer walls are 'left'/'right' (the room's dead-end side wall) and
  // 'near' (the wall opposite the screen, capping the room on the corridor
  // side with nothing behind it). Recessing is about the *mover* needing
  // room near any wall, not about there being a gap to walk through — that's
  // the separate doorway zone just below.
  recessedZone(ROOM4_ZONE, 'right', 'far', 'left', 'near'),
  ROOM4_DOORWAY_ZONE,
  // The stairs down from the hall's far end (see STAIR_ZONE's own comment) —
  // real walls on 'left'/'right' (framing the opening) and 'far' (the closed
  // glass doors at the bottom); 'near' stays unrecessed since that's the open
  // connection back up to the hall, bridged by HALL_STAIR_BRIDGE below.
  recessedZone(STAIR_ZONE, 'left', 'right', 'far'),
  HALL_STAIR_BRIDGE,
  // The mid-corridor pair (see SIDE_STAIRS) needs no entry of its own any
  // more, and no bridge either. Both existed because the wells used to sit
  // outside the hall, past its wall, so they had to add their own walkable
  // footprint and then stitch it to the hall across the wall's clearance gap.
  // Sunk into the hall's floor they are simply part of it: HALL_ZONE already
  // covers them, its own wall recess already keeps a mover off the side wall
  // the well backs onto, and what stops anyone entering other than down the
  // steps is the railing, not a zone edge.
];

// Bounds for Robot.ts's tryMove/FollowCamera's camera clamp/Hud's minimap —
// computed from FIRST_FLOOR_ZONES instead of hand-maintained, so adding or
// resizing a zone can't silently leave one of those three consumers out of
// sync.
function computeBounds(zones: RaisedZone[]): { xMin: number; xMax: number; zMin: number; zMax: number } {
  return {
    xMin: Math.min(...zones.map((z) => z.x - z.halfW)),
    xMax: Math.max(...zones.map((z) => z.x + z.halfW)),
    zMin: Math.min(...zones.map((z) => z.z - z.halfD)),
    zMax: Math.max(...zones.map((z) => z.z + z.halfD)),
  };
}
const firstFloorBounds = computeBounds(FIRST_FLOOR_ZONES);
export const FIRST_FLOOR_CLAMP_X_MIN = firstFloorBounds.xMin;
export const FIRST_FLOOR_CLAMP_X_MAX = firstFloorBounds.xMax;
export const FIRST_FLOOR_CLAMP_Z_MIN = firstFloorBounds.zMin;
export const FIRST_FLOOR_CLAMP_Z_MAX = firstFloorBounds.zMax;

// Where a robot arriving via Stairs A/B lands — in from the hall's near
// (entrance) wall, derived from HALL_ZONE rather than a hardcoded literal so
// a future resize of the hall can't strand this spawn outside every zone.
//
// The 3m this used to be was enough for the robot but not for the *camera*:
// FollowCamera chases from 8m back, and at 3m that spot fell outside the near
// wall entirely, so its occlusion raycast hit the laser barrier standing at
// the near limit and pulled the shot in to MIN_CAMERA_DIST. Level 2 opened on
// a close-up of the back of Droid's head crossed by laser beams — you could
// see the barrier behind him and nothing of the corridor he's actually facing
// (the user: "droid starts faced towards the end of the map (the lasers),
// this is not logic"). His *heading* was never wrong: π faces -z, down the
// corridor toward the rooms and away from the barrier. Only the framing was.
//
// Deliberately not imported from FollowCamera.ts: that module already imports
// this one, and a cycle would evaluate this spawn before the constant exists.
const CAMERA_CHASE_CLEARANCE = 12; // > FollowCamera's OFFSET.z (8) + WALL_MARGIN (1.5)
export const FIRST_FLOOR_SPAWN = {
  x: FIRST_FLOOR_CENTER_X,
  z: HALL_ZONE.z + HALL_ZONE.halfD - CAMERA_CHASE_CLEARANCE,
  heading: Math.PI,
};

function findFirstFloorZone(x: number, z: number): RaisedZone | undefined {
  return FIRST_FLOOR_ZONES.find(
    (zone) => Math.abs(x - zone.x) <= zone.halfW && Math.abs(z - zone.z) <= zone.halfD,
  );
}

/**
 * True if (x, z) falls inside any first-floor room's own rectangle. Used to
 * hard-stop movement at a room's real walls (Robot.ts reverts a move that
 * would land outside every zone) instead of the "wander off the edge, fall
 * through" tolerance used elsewhere — that tolerance is fine for wide-open
 * space, but a decorative wall (an auditorium's screen wall) didn't actually
 * block you, so walking or jumping past it dropped you in the empty gap
 * between zones with nothing there ("no man's land" / "you bug out of the
 * game"). Checking membership directly like this (rather than inferring
 * "which zone am I in, therefore what are my bounds" from the current
 * position) avoids an edge case at shared walls: right at the hall/Room 4
 * boundary, that inference could misclassify which zone you're "in" and
 * briefly grant the wrong room's full width. The raked-seating row height
 * (see auditoriumRowHeightAt below) rides on top of this flat rectangle
 * membership test — the room's *footprint* stays simple rectangle math even
 * though its *floor height* isn't flat.
 */
export function isOnFirstFloor(x: number, z: number): boolean {
  return findFirstFloorZone(x, z) !== undefined;
}

function auditoriumRowHeightAt(zone: RaisedZone, x: number, z: number): number | undefined {
  if (Math.abs(x - zone.x) > zone.halfW || Math.abs(z - zone.z) > zone.halfD) return undefined;
  const distFromScreen = z - (zone.z - zone.halfD);
  if (distFromScreen < APRON_DEPTH) return zone.height;
  const row = Math.min(NUM_ROWS - 1, Math.floor((distFromScreen - APRON_DEPTH) / ROW_DEPTH));
  return zone.height + (row + 1) * ROW_RISE;
}

// Jumpable sponsor-booth furniture (a desk you can hop onto, per the "jump
// over a chair/table" sponsor-booths brainstorm) — hazards can't jump, so
// standing on one of these is a genuine escape. Defined here (not in
// sponsorBooths.ts) so this stays the single source of truth for ground
// height; sponsorBooths.ts imports these same zones to place matching visual
// geometry, so the walkable footprint and what you see always agree.
// Each booth these belong to faces sideways into the aisle rather than
// up/down the hall (see rotateBooth()/rotateCollider() in sponsorBooths.ts).
// A zone rotated exactly 90° about its own center only needs halfW/halfD
// swapped (position unchanged) — true for RocketMind's and Goggles Cloud's
// zones. KING's table is pivoted about the lion statue elsewhere on its
// booth instead, so its x/z is precomputed here by hand via the same
// rotation formula sponsorBooths.ts uses for everything else on that booth
// (KING_TABLE_LOCAL, rotated through KING_ROTATION, lands exactly on this
// x/z) — RaisedZone has no rotation field of its own.
// Repositioned for the 1.5x hall resize + the new Stairs A/B enclosures
// (see STAIR_A_POS/STAIR_B_POS above): the old x≈±25 column sat almost
// exactly on the resized column grid's own x=25 line, and both z≈±15/±16
// values now land inside the enclosures' own footprint. Every sponsor booth
// anchor moved out to x≈±30 (clear of both the x=25/35 gridlines and the
// enclosures' x=16..24/-24..-16 span) and spread across the hall's full
// depth instead of the old ±17 band, so the swag pickups they carry (see
// SwagRun.ts) actually make the player cover the enlarged floor. Each
// booth's own internal layout (rotation pivot, sub-prop offsets) is
// unchanged — only these anchors moved.
export const BOOTH_PLATFORM_ZONES: RaisedZone[] = [
  { x: -30, z: -6, halfW: 0.9, halfD: 1.2, height: 0.9 }, // RocketMind display desk
  { x: 30, z: 24, halfW: 0.9, halfD: 1.2, height: 0.9 }, // Goggles Cloud desk
  { x: 37, z: -15, halfW: 0.45, halfD: 0.45, height: 1.1 }, // KING high-top counter
];

// Level 3's own sandwich tables (LunchRush.ts) — jumpable/standable like the
// sponsor-booth desks above, per the user: "make sure that the table where the
// sandwiches are on are jumpable." Defined here rather than in
// LunchRush.ts for the same single-source-of-truth reason as
// BOOTH_PLATFORM_ZONES — LunchRush.ts imports these same zones for its own
// table visuals/slot positions. Sized to each table's own actual footprint
// (`createLunchTable`'s width/depth), height 0.8 matching that function's
// tabletop surface. Since getGroundFloorHeightAt/its colliders are shared
// across both ground-floor levels, these also become invisible jumpable
// platforms in Level 1 (no visible table there) — a minor, harmless quirk
// rather than a real conflict, not worth a parallel per-level height system.
// The "between" and "hall-center" tables used to be single wide slabs
// (halfW 7 and 4 — a 14m and 8m wall respectively). The user: "make the sandwich
// tables smaller and where there is a big one, replace it with two or three
// smaller ones, so the npcs can chase around the tables... now if you stay
// behind it, you are safe" — diners steer straight at Biggy with a
// turn-rate-limited heading and no real pathfinding (see LunchRush.ts's
// 'chasing' case), so a wide-enough obstacle directly between a chaser and
// Biggy just pins the chaser against its near face forever, with no way to
// go around. Splitting each wide table into two smaller ones with a real gap
// between them turns that into an obstacle a chaser can actually route
// around (same fix shape as the "Narrow-gap hazard evasion" idea already
// noted for the sponsor booths). Left/right also shrunk slightly (halfD 2 ->
// 1.3) for the same "smaller tables" ask, though they were never wide enough
// to cause the hiding-spot problem on their own.
// Left/right tables moved from x=∓28 to x=∓30 — the user: "that door is too
// close to the table, causing the npcs to get stuck in between the door and
// the table." At x=∓28, the gap to Stair A/B's own outer wall (x=∓24,
// collider radius 1.0) was only 4m — SwagRun.ts's hazards push out to
// (colliderRadius + HAZARD_RADIUS 1.0), so the wall needs 2.0m clearance and
// the table (halfW 1.1) needs 2.1m; combined (4.1m) already exceeded the
// 4m gap, trapping a hazard that wandered in. x=∓30 gives 6m, a real 1.9m
// clear passage (this project's own "mover-derived clearance" rule — derive
// from the mover's actual radius, don't guess a number that merely looks ok).
export const LUNCH_TABLE_ZONES: RaisedZone[] = [
  { x: -30, z: -15, halfW: 1.1, halfD: 1.3, height: 0.8 }, // left table, beside Stair A
  { x: -4, z: -16, halfW: 1.5, halfD: 1.1, height: 0.8 }, // between-left, split from the old single wide table
  { x: 4, z: -16, halfW: 1.5, halfD: 1.1, height: 0.8 }, // between-right
  { x: 30, z: -15, halfW: 1.1, halfD: 1.3, height: 0.8 }, // right table, beside Stair B
  { x: -2.5, z: 4, halfW: 1, halfD: 1.1, height: 0.8 }, // hall-center-left, split from the old single wide table
  { x: 2.5, z: 4, halfW: 1, halfD: 1.1, height: 0.8 }, // hall-center-right
];

function findBoothPlatform(x: number, z: number): RaisedZone | undefined {
  return BOOTH_PLATFORM_ZONES.find(
    (zone) => Math.abs(x - zone.x) <= zone.halfW && Math.abs(z - zone.z) <= zone.halfD,
  ) ?? LUNCH_TABLE_ZONES.find((zone) => Math.abs(x - zone.x) <= zone.halfW && Math.abs(z - zone.z) <= zone.halfD);
}

/**
 * Ground-level XZ colliders for the jump platforms above — height-limited
 * (Collider.height) so this blocks approaching at ground level without also
 * fighting the robot once it's actually standing on top. Approximated as a
 * circle (the diagonal from center to a corner) — same approximation every
 * other boxy prop in this game already uses.
 */
export function getBoothPlatformColliders(): Collider[] {
  return BOOTH_PLATFORM_ZONES.map((zone) => ({
    x: zone.x,
    z: zone.z,
    radius: Math.sqrt(zone.halfW * zone.halfW + zone.halfD * zone.halfD),
    height: zone.height,
  }));
}

/**
 * Same height-gated-collider idea as getBoothPlatformColliders, but for
 * LUNCH_TABLE_ZONES specifically — a single diagonal-radius circle badly
 * overestimates an elongated table's real footprint (the 20-wide "between"
 * table would otherwise block a 10m-radius disk of open floor), so this
 * spaces several circles (radius = the table's own short half-dimension)
 * along its long axis instead, the same multi-circle-per-wall technique
 * getStairEnclosureColliders/getAuditoriumRowWallColliders already use.
 */
export function getLunchTableColliders(): Collider[] {
  const colliders: Collider[] = [];
  for (const zone of LUNCH_TABLE_ZONES) {
    const isXLong = zone.halfW >= zone.halfD;
    const shortHalf = isXLong ? zone.halfD : zone.halfW;
    const longHalf = isXLong ? zone.halfW : zone.halfD;
    const spacing = shortHalf * 1.5;
    const count = Math.max(2, Math.ceil((longHalf * 2) / spacing) + 1);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const offset = -longHalf + t * longHalf * 2;
      colliders.push({
        x: isXLong ? zone.x + offset : zone.x,
        z: isXLong ? zone.z : zone.z + offset,
        radius: shortHalf,
        height: zone.height,
      });
    }
  }
  return colliders;
}

/** A buffet table's own stand — width/depth given separately (not a single "size") so the same builder covers both the long between/middle tables and the small, deep left/right ones tucked beside the stair enclosures. Moved here from LunchRush.ts so createExhibitionHall() can build it once, shared with Level 1 — see LUNCH_TABLE_ZONES's own comment. */
function createLunchTable(centerX: number, centerZ: number, width: number, depth: number): THREE.Object3D {
  const group = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e });
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), topMat);
  top.position.set(centerX, 0.75, centerZ);
  group.add(top);
  const legDx = width / 2 - 0.3;
  const legDz = depth / 2 - 0.3;
  for (const [dx, dz] of [
    [-legDx, -legDz],
    [legDx, -legDz],
    [-legDx, legDz],
    [legDx, legDz],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), legMat);
    leg.position.set(centerX + dx, 0.375, centerZ + dz);
    group.add(leg);
  }
  return group;
}

function buildColumnPositions(): { x: number; z: number }[] {
  const positions: { x: number; z: number }[] = [];
  const halfW = HALL_WIDTH / 2;
  const halfD = HALL_DEPTH / 2;
  const margin = COLUMN_SPACING; // keep columns off the walls
  for (let x = -halfW + margin; x <= halfW - margin; x += COLUMN_SPACING) {
    for (let z = -halfD + margin; z <= halfD - margin; z += COLUMN_SPACING) {
      positions.push({ x, z });
    }
  }
  return positions;
}

const columnPositions = buildColumnPositions();

export function getColumnColliders(): Collider[] {
  return columnPositions.map((p) => ({ x: p.x, z: p.z, radius: COLUMN_SIZE * 0.75 }));
}

/** True while (x, z) is over the foyer's footprint (its floor sits at FOYER_FLOOR_Y). */
export function isOverFoyer(x: number, z: number): boolean {
  return z > HALL_DEPTH / 2 && Math.abs(x) <= FOYER_WIDTH / 2;
}

/** Climbs one real step at a time from the hall floor up to the foyer, then hands off to the flat foyer height — same per-position-height-function-paired-with-a-flat-zone shape as auditoriumRowHeightAt/stairHeightAt elsewhere in this file, just for the ground floor's own elevation change. */
function entranceStairHeightAt(x: number, z: number): number | undefined {
  if (Math.abs(x) > DOORWAY_WIDTH / 2) return undefined;
  const distIntoStair = z - HALL_DEPTH / 2; // 0 at the hall's own wall, growing toward the foyer
  if (distIntoStair < 0 || distIntoStair >= ENTRANCE_STAIR_RUN_DEPTH) return undefined;
  const step = Math.floor(distIntoStair / ENTRANCE_STAIR_TREAD_DEPTH);
  return (step + 1) * ENTRANCE_STAIR_RISE;
}

// Two separate height functions, not one gated by a position check — each
// only ever looks at its own floor's geometry, so a bug on one floor (a zone
// misplaced, a bound miscalculated) can't silently read the other floor's
// data. Robot.ts/FollowCamera.ts pick which one applies from the robot's own
// explicit `currentFloor` state, never by inferring it from (x, z).

/** Ground floor height at (x, z): a booth platform, FOYER_FLOOR_Y over the foyer, else 0. */
export function getGroundFloorHeightAt(x: number, z: number): number {
  const platform = findBoothPlatform(x, z);
  if (platform) return platform.height;
  const stairHeight = entranceStairHeightAt(x, z);
  if (stairHeight !== undefined) return stairHeight;
  return isOverFoyer(x, z) ? FOYER_FLOOR_Y : 0;
}

/**
 * First floor height at (x, z): a raked-seating tier if standing in one of
 * the auditoriums, else whichever FIRST_FLOOR_ZONES rectangle contains it,
 * else 0 (the void below).
 */
export function getFirstFloorHeightAt(x: number, z: number): number {
  // Before the rows: the stage sits inside the apron, which auditoriumRowHeightAt
  // would otherwise report as flat floor, dropping anyone standing on it.
  const stageHeight = auditoriumStageSurfaceHeightAt(x, z);
  if (stageHeight !== undefined) return stageHeight;
  for (const zone of AUDITORIUM_ZONES) {
    const rowHeight = auditoriumRowHeightAt(zone, x, z);
    if (rowHeight !== undefined) return rowHeight;
  }
  const stairHeight = stairHeightAt(x, z);
  if (stairHeight !== undefined) return stairHeight;
  const sideStairHeight = sideStairHeightAt(x, z);
  if (sideStairHeight !== undefined) return sideStairHeight;
  const propHeight = getHallwayPropSurfaceHeightAt(x, z);
  if (propHeight !== undefined) return propHeight;
  const zone = findFirstFloorZone(x, z);
  return zone ? zone.height : 0;
}

export function createExhibitionHall(): THREE.Group {
  const hall = new THREE.Group();
  const halfW = HALL_WIDTH / 2;
  const halfD = HALL_DEPTH / 2;
  // Cleared, not appended to — a second call would otherwise leave colliders
  // (and a live, still-ticking prop) for a set of letters no longer in any
  // scene, same reason hallwayInstance is reassigned rather than collected.
  clearDevoxxLetters('ground');
  clearChargingDocks('ground');

  // Colors from the real venue: the exhibition floor reads bright and open
  // (white walls/columns, mid-gray carpet) under a tall black ceiling void —
  // distinct from the moody dark corridor look of the auditorium level upstairs.
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x9a9a94 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0efe9 });
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xe8e6df });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, HALL_DEPTH), floorMat);
  floor.rotation.x = -Math.PI / 2;
  hall.add(floor);

  const wallThickness = 0.5;
  const frontSegmentWidth = (HALL_WIDTH - DOORWAY_WIDTH) / 2;
  const wallDefs = [
    // Back wall: solid — the stairs behind it are a closed door (see
    // above), not a walk-through gap.
    { w: HALL_WIDTH, d: wallThickness, x: 0, z: -halfD },
    // front wall, split either side of the (full-width) entrance opening
    { w: frontSegmentWidth, d: wallThickness, x: -(DOORWAY_WIDTH / 2 + frontSegmentWidth / 2), z: halfD },
    { w: frontSegmentWidth, d: wallThickness, x: DOORWAY_WIDTH / 2 + frontSegmentWidth / 2, z: halfD },
    { w: wallThickness, d: HALL_DEPTH, x: -halfW, z: 0 }, // left
    { w: wallThickness, d: HALL_DEPTH, x: halfW, z: 0 }, // right
  ];
  for (const wDef of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wDef.w, WALL_HEIGHT, wDef.d), wallMat);
    wall.position.set(wDef.x, WALL_HEIGHT / 2, wDef.z);
    hall.add(wall);
  }

  for (const pos of columnPositions) {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(COLUMN_SIZE, WALL_HEIGHT, COLUMN_SIZE),
      columnMat,
    );
    column.position.set(pos.x, WALL_HEIGHT / 2, pos.z);
    hall.add(column);
  }

  hall.add(createSoffit());
  hall.add(createEntranceFoyer());
  // Stairs A/B as freestanding walled enclosures standing in the open floor
  // — see createStairEnclosure's own comment above for the full reasoning.
  // Each gets a door on both its left and right walls.
  hall.add(createStairEnclosure(STAIR_A_POS[0], STAIR_A_POS[1])); // Stair A
  hall.add(createStairEnclosure(STAIR_B_POS[0], STAIR_B_POS[1])); // Stair B

  // Lunch tables, shared with Level 3 (see LUNCH_TABLE_ZONES's own comment)
  // — the user: "there is something to say to add these tables also in level 1?
  // makes the map less empty... can be used to escape the npcs?" Built here
  // (not by SwagRun.ts/LunchRush.ts separately) so both levels render the
  // exact same visible tables their shared getLunchTableColliders() already
  // blocks/gates — a level with the collider but no visible mesh is exactly
  // the invisible-wall bug just fixed for Level 1. Height-gated the same way
  // as BOOTH_PLATFORM_ZONES's own desks, so hazards (who can't jump) can't
  // follow onto one — a genuine escape route in Level 1 too, no extra code.
  for (const zone of LUNCH_TABLE_ZONES) {
    hall.add(createLunchTable(zone.x, zone.z, zone.halfW * 2, zone.halfD * 2));
  }

  // The ground floor's one charging dock, in the entrance half. Both this
  // floor's levels already have two energy sources each, but all of them sit in
  // the hall's middle and back — the coffee machine at (0, -8), JAVA at
  // (-11, -13), KING's candy claw way over at (37, -4) — so the whole entrance
  // end had none.
  //
  // Tucked into the hall's front-right corner rather than standing in the open
  // floor, per the user ("a bit more to the wall / in a corner"): 5m off each
  // wall, turned 225° so the column backs into the corner and the pad faces
  // out into the hall on the diagonal you actually approach from. That also
  // keeps it clear of everything around it — 7m to the column at (35, 20), 10m
  // to Goggles Cloud's desk at (30, 24).
  //
  // Column positions are worth checking against rather than eyeballing:
  // buildColumnPositions lays them at x = ±5/±15/±25/±35 and z = 0/±10/±20 (a
  // margin of one COLUMN_SPACING off each wall, so *not* on the round tens). A
  // first attempt at (16, 21) sat 1.4m from the column at (15, 20) — inside
  // that column's own push-out, which left the dock unreachable and half-buried
  // in it.
  addChargingDock(hall, 'ground', { x: 40, y: 0, z: 25, rotationY: Math.PI * 1.25 });

  return hall;
}

// Stairs A/B, rebuilt as real freestanding enclosures inside the hall rather
// than a door on the hall's own outer wall — per the real floor plan
// (plan-ground-floor-labeled.jpg/exhibition.webm), which shows two distinct
// walled rectangles standing in the open floor, columns behind them, not a
// hole in the perimeter wall. The user: "the stairs a/b i would like to see as a
// part of the exhibition hall itself, surrounded by walls, that will be
// similar to reality... add it between walls, with a double door at the
// left side for the left one and the right side for the right one, this is
// an extra thing on the exhibition floor making it less blank for both
// level 1 and level 3." Each enclosure ended up with a door on BOTH its
// left and right walls — the user's follow-up correction: "there is one door
// at the left/right (original), and one at the other side (also
// left/right). so one door left, one door right, for each of the stair
// rooms" (a first attempt had misread the floor plan's second door as
// being on the front/back wall instead). Still purely decorative/closed
// (see createStairDoorMesh's own comment) — only the shape changed, from a
// door in a wall to a small walled room with doors in two of its own walls.
const STAIR_ENCLOSURE_WIDTH = 8;
const STAIR_ENCLOSURE_DEPTH = 8;
const STAIR_ENCLOSURE_WALL_THICKNESS = 0.5;
// Column-grid midpoints (COLUMN_SPACING gridlines are at multiples of 10
// from the wall margin), not guessed numbers — keeps each enclosure clear of
// the columns around it instead of a wall clipping through one.
const STAIR_ENCLOSURE_Z = -HALL_DEPTH / 2 + 15;
export const STAIR_A_POS: [number, number] = [-20, STAIR_ENCLOSURE_Z];
export const STAIR_B_POS: [number, number] = [20, STAIR_ENCLOSURE_Z];

function createStairEnclosure(centerX: number, centerZ: number): THREE.Group {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0efe9 });
  const halfW = STAIR_ENCLOSURE_WIDTH / 2;
  const halfD = STAIR_ENCLOSURE_DEPTH / 2;
  // Front + back walls (z-facing) — full width, solid. Per the user's own
  // correction ("one door left, one door right, for each of the stair
  // rooms"), both doors on each enclosure sit on its two X-facing (left and
  // right) walls, not front/back — an earlier pass mistakenly put the
  // second door on the far z wall instead.
  for (const zSign of [-1, 1] as const) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(STAIR_ENCLOSURE_WIDTH, WALL_HEIGHT, STAIR_ENCLOSURE_WALL_THICKNESS),
      wallMat,
    );
    wall.position.set(centerX, WALL_HEIGHT / 2, centerZ + zSign * halfD);
    group.add(wall);
  }

  // Both side walls — full, solid, uncut panels with the (purely
  // decorative/closed, per createStairDoorMesh's own comment) door mounted
  // flush against the outer face, rather than cut into a gap the door has
  // to line up with exactly. The user, after the gap-in-the-opening version
  // showed a visible seam: "there is a gap between the walls and the door,
  // maybe just do a full wall and place the door in front of it? easier
  // fix?" — simpler and it can't ever show a gap, since there's no cut
  // edge for the door to misalign with.
  for (const xSign of [-1, 1] as const) {
    const wallX = centerX + xSign * halfW;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(STAIR_ENCLOSURE_WALL_THICKNESS, WALL_HEIGHT, STAIR_ENCLOSURE_DEPTH),
      wallMat,
    );
    wall.position.set(wallX, WALL_HEIGHT / 2, centerZ);
    group.add(wall);

    // Built at local origin (0,0,0) then positioned/rotated as a whole —
    // createStairDoorMesh places its meshes directly at the x/z arguments
    // it's given, so passing (0,0,0) keeps everything centered on this
    // group's own local origin, safe to rotate in place afterward (unlike
    // passing a real world position, which would revolve around the wrong
    // point once rotated). Offset outward past the wall's own outer face so
    // the door reads as mounted on it, not buried inside/z-fighting with it.
    const door = createStairDoorMesh(0, 0, 0);
    door.rotation.y = Math.PI / 2;
    door.position.set(wallX + xSign * (STAIR_ENCLOSURE_WALL_THICKNESS / 2 + 0.08), 0, centerZ);
    group.add(door);
  }

  return group;
}

/** Real colliders for a stair enclosure's own walls — several circles per wall (same technique as getAuditoriumRowWallColliders) so a straight wall blocks with roughly uniform reach along its length. Every wall is a full, solid, uncut panel (see createStairEnclosure's own comment on why) — no gap to route around here either. */
export function getStairEnclosureColliders(): Collider[] {
  const spacing = 1.6;
  const radius = 1.0;
  const segmentColliders = (x1: number, z1: number, x2: number, z2: number): Collider[] => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const count = Math.max(2, Math.ceil(length / spacing) + 1);
    const out: Collider[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      out.push({ x: x1 + dx * t, z: z1 + dz * t, radius });
    }
    return out;
  };

  const colliders: Collider[] = [];
  for (const pos of [STAIR_A_POS, STAIR_B_POS]) {
    const [centerX, centerZ] = pos;
    const halfW = STAIR_ENCLOSURE_WIDTH / 2;
    const halfD = STAIR_ENCLOSURE_DEPTH / 2;
    // Front + back walls (z-facing) — solid, full width.
    colliders.push(...segmentColliders(centerX - halfW, centerZ + halfD, centerX + halfW, centerZ + halfD));
    colliders.push(...segmentColliders(centerX - halfW, centerZ - halfD, centerX + halfW, centerZ - halfD));
    // Both side walls (x-facing) — solid, full depth.
    for (const xSign of [-1, 1] as const) {
      const wallX = centerX + xSign * halfW;
      colliders.push(...segmentColliders(wallX, centerZ - halfD, wallX, centerZ + halfD));
    }
  }
  return colliders;
}

// The free-standing DEVOXX letters (src/props/devoxxLetters.js), placed in the
// two spots the real set turns up — the user: "can be used in the cinema room
// on the podium and in the exhibition hall above the stair, would remove the
// devoxx letters in the hall on the first floor". One prop, two placements;
// each one's position/rotation lives at its own build site below, and every
// glyph it plants registers a real collider here so the set never becomes
// walk-through set dressing.
//
// The prop is the user's own playground prototype
// (private/assets/ai-fe-playground/devoxx-letters.html), adopted wholesale: each
// glyph hangs off a pivot on its bottom front edge and topples forward under
// its own gravity when something runs into it. Note the topple always goes
// toward the wordmark's local +z, whichever side it was hit from — so the
// podium set, which faces the seats the robot walks in from, always falls
// toward the robot rather than away. At this scale it lands about where the
// robot is standing and reads as comic; per-side fall directions would mean
// changing the prototype's own animation, which isn't what was asked for.
//
// DEVOXX_LETTER_HEIGHT is deliberately above the robot's own max jump
// (JUMP_VELOCITY 7 under this game's gravity tops out around 1.36m) — nothing
// in this file gives a standing glyph a standable top surface, so a glyph short
// enough to jump onto would drop the robot straight through it, the same bug
// the hallway's tables hit ("when jumping on the table, i fall into it"). It
// matters more since the letters moved onto Room 4's podium, which is itself a
// 0.4m platform: that much of the reach is free before the jump even starts.
const DEVOXX_LETTER_HEIGHT = 1.5;
const groundFloorLetterColliders: Collider[] = [];
const firstFloorLetterColliders: Collider[] = [];

/**
 * One placed wordmark: the live prop plus, per glyph, the world position and the
 * very Collider object sitting in the arrays above — so toppling a glyph can
 * retire its collider by mutating it in place, and neither Game.ts's collider
 * composition nor KnowledgeRun's own `robotOnly` filter has to know this
 * happens (nothing is ever added to or removed from those arrays).
 */
interface PlacedDevoxxLetters {
  floor: Floor;
  /** The surface the set stands on — a mover below it can't reach the letters, see updateDevoxxLetters. */
  baseY: number;
  prop: DevoxxLetters;
  glyphs: { index: number; x: number; z: number; radius: number; collider: Collider }[];
}
const placedDevoxxLetters: PlacedDevoxxLetters[] = [];

/** Real colliders for every DEVOXX glyph actually built, per floor — populated by addDevoxxLetters() at build time (never a parallel hand-kept coordinate list, same reason getHallwayPropColliders() reads the live hallway instance). */
export function getDevoxxLetterColliders(floor: Floor): Collider[] {
  return floor === 'ground' ? groundFloorLetterColliders : firstFloorLetterColliders;
}

/**
 * Stands every glyph on both floors back up and un-retires its collider.
 *
 * Needed because the letters outlive the levels: one Robot walks all three, and
 * the two floor groups are built once (Game.ts's own field initializers) rather
 * than per level, so a glyph knocked over stays knocked over — which is the
 * right fiction *within* a day and the wrong one across days. Only restartDay
 * calls this; a letter toppled during Voxxy's run is still lying there when
 * Biggy walks the same floor at lunchtime, because it's the same day.
 *
 * Restoring the collider is what makes this more than cosmetic: without it a
 * letter would stand back up as something the robot walks straight through.
 */
// Robot charging docks (src/props/robotChargingDock.js) — stand on the pad and
// energy accrues while you stay there. A venue fixture rather than one level's
// prop, so this file owns them the same way it owns the DEVOXX letters, not the
// way SwagRun.ts owns its own coffee machine.
//
// Why they exist at all, and why the first floor gets three to the ground
// floor's one: Level 1 has the coffee machine and KING's candy claw, Level 3
// has JAVA and the same claw, and Level 2 had *nothing* — no energy source
// anywhere on the first floor. That's the level where energy is the actual
// currency: Room 4 is 16 jump-gated rows at JUMP_ENERGY_COST (20) each, 320
// against a 100 cap, so reaching the back row was gated on standing still
// waiting out ENERGY_REGEN_RATE while ten hazards roam a 32s round.
//
// Deliberately no cooldown, unlike the kiosks. Those hand over a flat amount on
// touch, so they need a re-trigger guard; a dock's cost is the seconds you
// spend standing on it, which limits it by itself and is the whole point —
// stopping to charge with hazards closing is the decision. Brushing past at a
// run gives a small top-up, stopping gives a full bar.
const DOCK_ENERGY_PER_SECOND = 40; // plus the passive ENERGY_REGEN_RATE (18) running alongside, so a full bar is a ~1.7s stop
// The prop is authored at real-world scale — a 1.2m pad and a 1.45m column —
// which put it under the robot's own eyeline and read as a toy beside him (the
// user: "it could also be a bit bigger, now it is rather small compared to the
// robot"). 1.5x gives an 1.8m pad he stands on comfortably and a 2.2m column
// that reads as a real fixture. Applied to the whole Object3D rather than
// threaded through the generator's own dimensions, so the model stays byte-for-
// byte the playground's; everything collision-related below multiplies by the
// same factor rather than re-measuring, and the pad stays 10cm high — still
// under AUTO_STEP_HEIGHT, so it's walked onto rather than jumped.
const DOCK_SCALE = 1.5;

interface PlacedChargingDock {
  floor: Floor;
  x: number;
  z: number;
  /** The surface the pad sits on — same reason the letters track theirs (a mover on another level can't use this one). */
  baseY: number;
  prop: RobotChargingDock;
  padRadius: number;
}
const placedChargingDocks: PlacedChargingDock[] = [];
const groundFloorDockColliders: Collider[] = [];
const firstFloorDockColliders: Collider[] = [];

/** Where each dock stands on `floor`, for the HUD's own minimap markers — read from what was actually built, like every other list in this file. */
export function getChargingDockMarkers(floor: Floor): { x: number; z: number }[] {
  return placedChargingDocks.filter((d) => d.floor === floor).map((d) => ({ x: d.x, z: d.z }));
}

/** Colliders for every dock's column (never its pad — that's 7cm, under AUTO_STEP_HEIGHT, and is meant to be stood on). */
export function getChargingDockColliders(floor: Floor): Collider[] {
  return floor === 'ground' ? groundFloorDockColliders : firstFloorDockColliders;
}

function clearChargingDocks(floor: Floor): void {
  for (let i = placedChargingDocks.length - 1; i >= 0; i--) {
    if (placedChargingDocks[i].floor === floor) placedChargingDocks.splice(i, 1);
  }
  (floor === 'ground' ? groundFloorDockColliders : firstFloorDockColliders).length = 0;
}

/** Plants one charging dock, pad facing +z before `rotationY` turns it, and registers its column as a real collider. */
function addChargingDock(
  group: THREE.Group,
  floor: Floor,
  placement: { x: number; y: number; z: number; rotationY: number },
): void {
  const dock = createRobotChargingDock();
  dock.object.position.set(placement.x, placement.y, placement.z);
  dock.object.rotation.y = placement.rotationY;
  dock.object.scale.setScalar(DOCK_SCALE);
  group.add(dock.object);

  // Same local-offset rotation the letters use: (x, z) about y by θ — but every
  // local offset is scaled first, since the group it belongs to is.
  const cos = Math.cos(placement.rotationY);
  const sin = Math.sin(placement.rotationY);
  const col = dock.columnCollider;
  const colX = col.x * DOCK_SCALE;
  const colZ = col.z * DOCK_SCALE;
  (floor === 'ground' ? groundFloorDockColliders : firstFloorDockColliders).push({
    x: placement.x + colX * cos + colZ * sin,
    z: placement.z - colX * sin + colZ * cos,
    radius: col.radius * DOCK_SCALE,
  });

  placedChargingDocks.push({
    floor,
    x: placement.x,
    z: placement.z,
    baseY: placement.y,
    prop: dock,
    padRadius: dock.padRadius * DOCK_SCALE,
  });
}

/**
 * Ticks every dock on `floor` and returns the energy the mover earned this
 * frame — this file can't import Robot.ts (circular; Robot.ts imports plenty
 * from here), so the caller applies it via robot.restoreEnergy().
 *
 * The reach is `padRadius + MOVER_CLEARANCE * sizeScale`, derived rather than
 * picked, and the derivation is forced by the model: the column stands only
 * 0.73m behind the pad's centre while its collider holds a mover
 * `radius + MOVER_CLEARANCE * sizeScale` away, so nothing can ever physically
 * occupy the pad's centre — an ungrown robot stops about 0.68m in front of it,
 * and Biggy at MAX_SIZE_SCALE a full 2.6m out. A literal "is it on the pad"
 * test would therefore work for nobody, and a fixed radius would quietly stop
 * working as Biggy grows, exactly the bug LunchRush's groundReachFor() and
 * COFFEE_RADIUS were both written to fix ("i was running into it and it did
 * nothing"). Scaling by the same term that pushes him back keeps the two in
 * step at every size.
 */
export function updateChargingDocks(
  dt: number,
  floor: Floor,
  mover?: { x: number; y: number; z: number; sizeScale: number },
): number {
  let energy = 0;
  for (const dock of placedChargingDocks) {
    if (dock.floor !== floor) continue;
    dock.prop.update(dt);
    if (!mover || Math.abs(mover.y - dock.baseY) > 1.0) continue;
    const reach = dock.padRadius + MOVER_CLEARANCE * mover.sizeScale;
    const dx = mover.x - dock.x;
    const dz = mover.z - dock.z;
    if (dx * dx + dz * dz > reach * reach) continue;
    energy += DOCK_ENERGY_PER_SECOND * dt;
    // Visual only, and fire-and-forget: the cycle runs ~8s while a charge here
    // is usually over in under two, so it finishes after the robot has gone.
    if (!dock.prop.busy) void dock.prop.activate();
  }
  return energy;
}

export function resetDevoxxLetters(): void {
  for (const placed of placedDevoxxLetters) {
    placed.prop.reset();
    for (const glyph of placed.glyphs) {
      glyph.collider.radius = glyph.radius;
      delete glyph.collider.height; // standing glyphs block at every height — see addDevoxxLetters' own call site comments
    }
  }
}

/** Drops every record for one floor — the floor's own create* function is about to rebuild them (see createExhibitionHall's own reset comment). */
function clearDevoxxLetters(floor: Floor): void {
  for (let i = placedDevoxxLetters.length - 1; i >= 0; i--) {
    if (placedDevoxxLetters[i].floor === floor) placedDevoxxLetters.splice(i, 1);
  }
  (floor === 'ground' ? groundFloorLetterColliders : firstFloorLetterColliders).length = 0;
}

/**
 * Plants one DEVOXX wordmark, facing +z before `rotationY` turns it, and
 * records a collider per glyph in `out`. The prop reports its glyphs' offsets
 * along its own local x axis; rotating (x, 0) about y by θ gives
 * (x·cosθ, −x·sinθ), which is all this needs to put them in world space.
 */
function addDevoxxLetters(
  group: THREE.Group,
  floor: Floor,
  placement: { x: number; y: number; z: number; rotationY: number },
): void {
  const out = floor === 'ground' ? groundFloorLetterColliders : firstFloorLetterColliders;
  const letters = createDevoxxLetters({
    text: EVENT_SIGNAGE.standingLetters,
    height: DEVOXX_LETTER_HEIGHT,
  });
  letters.object.position.set(placement.x, placement.y, placement.z);
  letters.object.rotation.y = placement.rotationY;
  group.add(letters.object);

  const cos = Math.cos(placement.rotationY);
  const sin = Math.sin(placement.rotationY);
  const placed: PlacedDevoxxLetters = { floor, baseY: placement.y, prop: letters, glyphs: [] };
  letters.letterColliders.forEach((glyph, index) => {
    const collider: Collider = {
      x: placement.x + glyph.x * cos,
      z: placement.z - glyph.x * sin,
      radius: glyph.radius,
    };
    out.push(collider);
    placed.glyphs.push({ index, x: collider.x, z: collider.z, radius: glyph.radius, collider });
  });
  placedDevoxxLetters.push(placed);
}

/**
 * Per-frame tick for both letter sets on `floor`, and the "ran into it" trigger.
 *
 * `moverSizeScale` is the robot's own `sizeScale`: a collider holds any mover
 * off at `radius + MOVER_CLEARANCE * sizeScale` (see Robot.ts's colliderReach),
 * so a fixed trigger distance would simply never fire for a grown Biggy, who
 * gets held further out the bigger he is — the same failure LunchRush's
 * groundReachFor() was written to fix ("i was running into it and it did
 * nothing"). Deriving it from the same term keeps the two in step at every
 * size instead of only at the extremes.
 *
 * A glyph's collider is retired only once it is all the way down and settled,
 * never while it is falling. It then lies flat, roughly `depth` (0.3m) tall,
 * which is Robot.ts's own AUTO_STEP_HEIGHT — genuinely steppable — so keeping
 * it would leave an invisible wall where the player can see there's no longer a
 * letter standing.
 *
 * Getting this wrong is what made the letters walk-through for a pass (the
 * user: "we can walk through the letters now, that is not a good evolution").
 * Two mistakes compounded: the collider was given up the instant the topple
 * *started*, and the trigger radius was 0.2m wider than the push-out. Together
 * that meant a glyph fell and went intangible slightly before the robot could
 * ever be blocked by it, so walking at the wordmark dropped every glyph in
 * range and passed straight through. Hence both rules here: the trigger sits at
 * the push-out distance exactly, so it only fires on real contact, and the
 * collider outlives the fall.
 *
 * Contact plus height is the trigger; there's deliberately no "and it's moving"
 * test. The only way to that distance is to walk into the glyph, since its own
 * collider is what holds the robot there — and a position-delta movement check
 * would read as *stopped* in precisely the frame the robot is pressed up
 * against the letter, which is the one frame that has to count.
 *
 * The height gate is not belt-and-braces, it's load-bearing, and Room 4's
 * podium set is why. Those letters stand on the stage deck, while the stage's
 * own colliders are a row of circles (getAuditoriumStageColliders) rather than
 * one solid slab — so a robot down on the apron, threading the gap between two
 * of those circles, gets to within ~1.93m of the letter row against a ~2.06m
 * trigger. Without this gate the podium letters would topple as the player
 * merely walked past the stage, never having jumped up to them. Requiring the
 * mover to be at the set's own standing surface says the real rule directly:
 * you have to be up there with them.
 */
export function updateDevoxxLetters(
  dt: number,
  floor: Floor,
  mover?: { x: number; y: number; z: number; sizeScale: number },
): void {
  for (const placed of placedDevoxxLetters) {
    if (placed.floor !== floor) continue;
    placed.prop.update(dt);
    // Every glyph's collider tracks the glyph's own real state, every frame,
    // rather than being switched off at the moment something decides to topple
    // it. One rule, so a collider can never disagree with what's on screen —
    // including after resetDevoxxLetters stands the whole set back up.
    //
    // Retiring sets both fields, for the two movers that read them
    // differently: `height` is what actually frees the robot — Robot.tryMove
    // skips any collider whose height the mover is already at or above, and
    // nothing in this game stands below y=0 — while the hazards' own loops have
    // no height logic at all and only ever see `minDist = c.radius + h.radius`,
    // so zeroing the radius shrinks their berth to their own body. They still
    // walk around a fallen glyph rather than through it, which is what it looks
    // like they should do.
    for (const glyph of placed.glyphs) {
      const fallen = placed.prop.isFallen(glyph.index);
      if (fallen && glyph.collider.radius !== 0) {
        glyph.collider.radius = 0;
        glyph.collider.height = Number.NEGATIVE_INFINITY;
      } else if (!fallen && glyph.collider.radius === 0) {
        glyph.collider.radius = glyph.radius;
        delete glyph.collider.height;
      }
    }

    // 0.2 is under Room 4's own STAGE_HEIGHT (0.4), so the apron below can
    // never qualify, while still allowing for landing/float noise on the deck.
    if (!mover || mover.y < placed.baseY - 0.2) continue;
    for (const glyph of placed.glyphs) {
      if (!placed.prop.isStanding(glyph.index)) continue;
      // Exactly the push-out distance this glyph holds the robot at, plus only
      // enough slack to survive floating-point noise. Anything wider would tip
      // the letter before the robot could touch it — see this function's own
      // comment on the walk-through regression.
      const contact = glyph.radius + MOVER_CLEARANCE * mover.sizeScale + 0.05;
      const dx = mover.x - glyph.x;
      const dz = mover.z - glyph.z;
      if (dx * dx + dz * dz > contact * contact) continue;
      void placed.prop.activate(glyph.index);
    }
  }
}

// A closed double door — the only visible sign of the staircases behind the
// wall. Reused at every stairwell mounting point (the ground-floor enclosures
// and both mid-corridor flights) so they read as the same kind of thing.
function createStairDoorMesh(centerX: number, baseY: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2822 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44 });
  const signMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x2a7a2a,
    emissiveIntensity: 0.4,
  });

  const doorWidth = 2.6;
  const doorHeight = 2.6;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.3, doorHeight + 0.2, 0.15), frameMat);
  frame.position.set(centerX, baseY + (doorHeight + 0.2) / 2, z);
  group.add(frame);

  const leafWidth = doorWidth / 2 - 0.06;
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, doorHeight, 0.1), leafMat);
    leaf.position.set(centerX + side * (leafWidth / 2 + 0.03), baseY + doorHeight / 2, z + 0.05);
    group.add(leaf);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), frameMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(centerX + side * 0.15, baseY + doorHeight / 2, z + 0.12);
    group.add(handle);
  }

  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.05), signMat);
  sign.position.set(centerX, baseY + doorHeight + 0.4, z + 0.1);
  group.add(sign);

  return group;
}

// A sci-fi laser fence — stands in for a real wall where the conference's
// own decorated area ends but the venue itself keeps going (the user: "some
// scifi lasers stopping a robot from going there"). Two emitter posts and a
// few horizontal beams between them, spanning the hall's own full width
// (`halfWidth`) so it blocks every approach, not just the center corridor —
// same span the wall it replaces used to cover.
function createLaserBarrier(centerX: number, baseY: number, z: number, halfWidth: number): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
  const postHeight = 4;
  const postGeo = new THREE.CylinderGeometry(0.15, 0.15, postHeight, 12);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(centerX + side * (halfWidth - 0.3), baseY + postHeight / 2, z);
    group.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({
      color: 0x2a0505,
      emissive: 0xff1a1a,
      emissiveIntensity: 1.5,
    }));
    cap.position.set(centerX + side * (halfWidth - 0.3), baseY + postHeight, z);
    group.add(cap);
  }

  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const beamLength = (halfWidth - 0.3) * 2;
  const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, beamLength, 8);
  const beamHeights = [0.6, 1.4, 2.2, 3.0];
  beamHeights.forEach((beamY) => {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(centerX, baseY + beamY, z);
    group.add(beam);
  });

  const glow = new THREE.PointLight(0xff2222, 3, 12);
  glow.position.set(centerX, baseY + 1.8, z);
  group.add(glow);

  return group;
}

// A flat wall built from the room's own base y, not stepped to match the
// risers — fine everywhere except the *far* end, where the seating floor has
// already climbed NUM_ROWS*ROW_RISE by the time it reaches the back row. A
// flat 7 (this constant's old value) left only ~1.4m of wall above the back
// row's own floor — short enough for the camera to look clean over it into
// the hallway (the user: "there is a wall missing here, we should not be able to
// view from the cinema room the hallway"). Same +7 clearance the entrance
// already enjoys (where the floor is still at the room's base y), carried up
// to the highest floor point too.
const AUDITORIUM_WALL_HEIGHT = 7 + NUM_ROWS * ROW_RISE;

interface AuditoriumMats {
  floorMat: THREE.MeshStandardMaterial;
  wallMat: THREE.MeshStandardMaterial;
  stageMat: THREE.MeshStandardMaterial;
  screenMat: THREE.MeshStandardMaterial;
  seatMat: THREE.MeshStandardMaterial;
  riserMat: THREE.MeshStandardMaterial;
  aisleLightMat: THREE.MeshStandardMaterial;
}

// Original, made-up snippet — not transcribed from any real codebase or
// talk — styled after a generic Java/Spring live-coding session, since
// that's the dominant flavor of what's actually on stage at a Java
// conference. Loops forever (see updateAuditoriumScreen) — a live-typing,
// scrolling terminal, not a frozen frame, matching the "coding on the
// screen" feel from the user's own Gemini reference prototypes.
const AUDITORIUM_SCREEN_CODE: { text: string; kind: 'keyword' | 'comment' | 'string' | 'annotation' | 'plain' }[] = [
  { text: '@RestController', kind: 'annotation' },
  { text: 'public class TalkController {', kind: 'keyword' },
  { text: '', kind: 'plain' },
  { text: '  // live-reloads between slides, no redeploy', kind: 'comment' },
  { text: '  @GetMapping("/talks/{id}/status")', kind: 'annotation' },
  { text: '  Status status(@PathVariable String id) {', kind: 'keyword' },
  { text: '    var room = venue.find(id);', kind: 'plain' },
  { text: '    return room.isFull()', kind: 'plain' },
  { text: '      ? Status.of("standing room only")', kind: 'string' },
  { text: '      : Status.of("seats available");', kind: 'string' },
  { text: '  }', kind: 'plain' },
  { text: '', kind: 'plain' },
  { text: '  // TODO: handle the coffee-break stampede', kind: 'comment' },
  { text: '  @PostMapping("/talks/{id}/questions")', kind: 'annotation' },
  { text: '  void ask(@PathVariable String id, String q) {', kind: 'keyword' },
  { text: '    mic.queue(q);', kind: 'plain' },
  { text: '  }', kind: 'plain' },
  { text: '}', kind: 'plain' },
];
const AUDITORIUM_SCREEN_COLORS: Record<string, string> = {
  keyword: '#ff7b72',
  comment: '#6e7681',
  string: '#a5d6ff',
  annotation: '#d2a8ff',
  plain: '#c9d1d9',
};
const AUDITORIUM_SCREEN_LINE_HEIGHT = 44;
const AUDITORIUM_SCREEN_START_Y = 70;
const AUDITORIUM_SCREEN_VISIBLE_LINES = 17;
const AUDITORIUM_SCREEN_CHARS_PER_SECOND = 26;
const AUDITORIUM_SCREEN_LINE_HOLD = 0.4; // pause after a line finishes typing, before it scrolls up
const AUDITORIUM_SCREEN_CURSOR_BLINK = 0.5;

// Module-level animation state for the one real screen in the game (Room 4
// is the only built auditorium — see the DECIDED note near AUDITORIUM_ZONES)
// — a per-instance object would be over-engineering for a single screen.
// Ticked from Game.ts's tick() (see updateAuditoriumScreen) since this file,
// unlike KnowledgeRun.ts/SwagRun.ts, has no render-loop hook of its own.
// Set once by createFirstFloor() — getHallwayPropColliders() reads the live
// instance's own local collider-position getters and translates them by its
// world position, same "visual and walkable geometry can't drift apart"
// principle as every other zone in this file.
let hallwayInstance: CinematicHallway | null = null;

let auditoriumScreenCtx: CanvasRenderingContext2D | null = null;
let auditoriumScreenTexture: THREE.CanvasTexture | null = null;
let auditoriumBufferStart = 0; // index (mod AUDITORIUM_SCREEN_CODE.length) of the topmost visible line
let auditoriumTypedChars = 0; // chars revealed so far on the bottom (currently-typing) line
let auditoriumHoldTimer = 0;
let auditoriumCursorTimer = 0;
let auditoriumCursorOn = true;

function auditoriumScreenLineAt(i: number) {
  const n = AUDITORIUM_SCREEN_CODE.length;
  return AUDITORIUM_SCREEN_CODE[((i % n) + n) % n];
}

function redrawAuditoriumScreen(): void {
  if (!auditoriumScreenCtx || !auditoriumScreenTexture) return;
  const ctx = auditoriumScreenCtx;
  const canvas = ctx.canvas;
  ctx.fillStyle = '#0d1117'; // dark IDE background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '34px "Courier New", monospace';
  ctx.textBaseline = 'top';

  for (let row = 0; row < AUDITORIUM_SCREEN_VISIBLE_LINES; row++) {
    const isCurrent = row === AUDITORIUM_SCREEN_VISIBLE_LINES - 1;
    const line = auditoriumScreenLineAt(auditoriumBufferStart + row);
    const text = isCurrent ? line.text.slice(0, Math.floor(auditoriumTypedChars)) : line.text;
    ctx.fillStyle = AUDITORIUM_SCREEN_COLORS[line.kind];
    const rowY = AUDITORIUM_SCREEN_START_Y + row * AUDITORIUM_SCREEN_LINE_HEIGHT;
    ctx.fillText(text, 60, rowY);
    // Blinking caret only on the line actively being typed, so it reads as
    // "live," not a static screenshot.
    if (isCurrent && auditoriumCursorOn) {
      const caretX = 60 + ctx.measureText(text).width + 6;
      ctx.fillStyle = '#c9d1d9';
      ctx.fillRect(caretX, rowY, 16, 30);
    }
  }
  auditoriumScreenTexture.needsUpdate = true;
}

/**
 * Advances the screen's typing/scrolling animation by one frame — call every
 * tick while Room 4 exists (Game.ts's tick(), level 2 only; harmless but
 * wasted work to call it while the screen isn't visible). Typing a line,
 * holding briefly once it's complete, then scrolling the whole buffer up by
 * one and starting the next line — cycling AUDITORIUM_SCREEN_CODE forever.
 */
export function updateAuditoriumScreen(dt: number): void {
  if (!auditoriumScreenCtx) return;
  auditoriumCursorTimer += dt;
  if (auditoriumCursorTimer >= AUDITORIUM_SCREEN_CURSOR_BLINK) {
    auditoriumCursorTimer -= AUDITORIUM_SCREEN_CURSOR_BLINK;
    auditoriumCursorOn = !auditoriumCursorOn;
  }
  const currentLine = auditoriumScreenLineAt(auditoriumBufferStart + AUDITORIUM_SCREEN_VISIBLE_LINES - 1);
  if (auditoriumHoldTimer > 0) {
    auditoriumHoldTimer -= dt;
    if (auditoriumHoldTimer <= 0) {
      auditoriumBufferStart++;
      auditoriumTypedChars = 0;
    }
  } else {
    auditoriumTypedChars += AUDITORIUM_SCREEN_CHARS_PER_SECOND * dt;
    if (auditoriumTypedChars >= currentLine.text.length) {
      auditoriumTypedChars = currentLine.text.length;
      auditoriumHoldTimer = AUDITORIUM_SCREEN_LINE_HOLD;
    }
  }
  redrawAuditoriumScreen();
}

function createAuditoriumScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  auditoriumScreenCtx = canvas.getContext('2d')!;
  auditoriumScreenTexture = new THREE.CanvasTexture(canvas);
  auditoriumScreenTexture.colorSpace = THREE.SRGBColorSpace;
  redrawAuditoriumScreen();
  return auditoriumScreenTexture;
}

// The hallway's own screen, hung over the stairs down (per
// auditorium-stage-screen-sponsors.jpg) — a static event-branding texture,
// not a second consumer of auditoriumScreenTexture: that module-level
// singleton's own comment already calls it out as "the one real screen in
// the game," and it redraws live-typing code, which is the wrong content
// for a lobby-facing event banner. A plain baked canvas instead.
function createStairScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#3a2a55');
  grad.addColorStop(0.55, '#c9433f');
  grad.addColorStop(1, '#f2b23c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 150px "Arial Narrow", Arial, sans-serif';
  // Plain wordmark, no separator glyph between the two X's (the user: "no need
  // to have that character between the two xx-s") and no printed date at
  // all (the user: "pick the date of this year? or no date at all, to not make
  // it 'outdated'" — no date is the one option that never goes stale).
  ctx.fillText('DEVOXX', canvas.width / 2, canvas.height * 0.55);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The branded flight case parked beside the AV table at the stage's edge, per
// room7-signage-screen-red-wall.jpg — a small, real detail of a dressed
// conference stage rather than an invented one.
function createCrateLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#16305c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const [top, bottom] = EVENT_SIGNAGE.crate;
  ctx.font = '900 62px "Arial Narrow", Arial, sans-serif';
  ctx.fillText(top, canvas.width / 2, canvas.height * 0.38);
  ctx.font = '700 34px "Arial Narrow", Arial, sans-serif';
  ctx.fillText(bottom, canvas.width / 2, canvas.height * 0.68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A bright, daylight-ish glass-door look for the closed exit at the bottom of
// the stairs (per hallway_110s.jpg: floor-to-ceiling glazing, dark mullions,
// daylight and greenery beyond) — decorative only, this level doesn't need a
// working ground-floor exit here (the user: "may be closed in this level of the
// game").
function createGlassDoorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // Blown-out daylight, not a muted pastel sky — a real glass door reads as
  // near-white against a dark interior (first pass used soft pale tones that
  // read as a dim violet smudge once actually lit in the scene, easy to miss
  // entirely from a normal walking approach).
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#f3faff');
  sky.addColorStop(0.5, '#d8ecff');
  sky.addColorStop(1, '#a9c9e0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(15,20,28,0.9)';
  ctx.lineWidth = 10;
  for (let i = 1; i < 4; i++) {
    const x = (canvas.width / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.5);
  ctx.lineTo(canvas.width, canvas.height * 0.5);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The hall's far end (by Room 6/7, the last door pair) opens onto a real
// staircase down to a small lower lobby with closed glass "exit" doors —
// per the real venue photos and STAIR_ZONE's own comment. Built directly
// here (not inside CinematicHallway.ts) since it's specific to this game's
// own two-stair layout, same as Room 4's screen/stage — CinematicHallway
// stays a generic, game-agnostic hallway shell.
/**
 * One mid-corridor staircase down (see SIDE_STAIRS): a flight sunk into the
 * hall's own floor alongside a side wall, a small landing, and a closed double
 * door at the bottom standing in for the ground-floor room behind it.
 *
 * Built along z, so every step's top face is placed from the same
 * `FLOOR_HEIGHT - (i + 1) * STAIR_RISE` that sideStairHeightAt returns for that
 * band — the visual geometry and the walkable height function come from one
 * formula, the same rule every tiered zone in this file follows.
 *
 * Note what this does *not* build any more, now that the well is inside the
 * hall rather than beyond its wall: no full-height walls framing the flight
 * (they'd stand in the middle of the corridor), and no ceiling over it (it
 * opens to the hall's own). What replaces them is a waist-high balustrade
 * along the two open edges, matched exactly by getSideStairRailingColliders.
 */
function buildSideStair(group: THREE.Group, stair: SideStair): void {
  const { zone, topZ, dirZ } = stair;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24, roughness: 1 });
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2a2730, roughness: 0.6, metalness: 0.5 });

  const runCenterZ = topZ + dirZ * (SIDE_STAIR_RUN_LENGTH / 2);
  const farZ = topZ + dirZ * SIDE_STAIR_RUN_LENGTH;
  const inward = Math.sign(HALL_ZONE.x - zone.x); // toward the corridor's centreline
  const railX = zone.x + inward * SIDE_STAIR_HALF_WIDTH;

  const stepGeo = new THREE.BoxGeometry(SIDE_STAIR_HALF_WIDTH * 2, STAIR_RISE, STAIR_TREAD_DEPTH);
  for (let i = 0; i < NUM_STAIRS; i++) {
    const treadTopY = FLOOR_HEIGHT - (i + 1) * STAIR_RISE;
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.set(
      zone.x,
      treadTopY - STAIR_RISE / 2,
      topZ + dirZ * (i * STAIR_TREAD_DEPTH + STAIR_TREAD_DEPTH / 2),
    );
    group.add(step);
  }

  // The landing beyond the last step.
  const landing = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_STAIR_HALF_WIDTH * 2, STAIR_PIT_DEPTH), stepMat);
  landing.rotation.x = -Math.PI / 2;
  landing.position.set(zone.x, zone.height, topZ + dirZ * (STAIR_RUN_DEPTH + STAIR_PIT_DEPTH / 2));
  group.add(landing);

  // Dead end: a solid wall with the same closed double door the building's
  // other stairwells use, which is what "ends in the closed rooms on the
  // ground floor" looks like from this side. No teleport — see SIDE_STAIRS.
  const wallBaseY = zone.height;
  const wallTopY = FLOOR_HEIGHT;
  const endWall = new THREE.Mesh(
    new THREE.BoxGeometry(SIDE_STAIR_HALF_WIDTH * 2, wallTopY - wallBaseY, 0.5),
    wallMat,
  );
  endWall.position.set(zone.x, (wallTopY + wallBaseY) / 2, farZ);
  group.add(endWall);

  // The trench's own two long sides, below floor level only. The hall's floor
  // now has a hole in it here and its side walls start at floor level, so
  // without these the cut edge looks straight out into nothing from down in the
  // well — a flight of steps floating in a black slot rather than a stairwell
  // with sides.
  for (const sideX of [zone.x - SIDE_STAIR_HALF_WIDTH, zone.x + SIDE_STAIR_HALF_WIDTH]) {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, wallTopY - wallBaseY, SIDE_STAIR_RUN_LENGTH),
      wallMat,
    );
    sideWall.position.set(sideX, (wallTopY + wallBaseY) / 2, runCenterZ);
    group.add(sideWall);
  }
  // createStairDoorMesh builds facing +z, which is back up the flight when the
  // run descends toward -z — so the one that descends the other way is turned.
  const door = createStairDoorMesh(0, 0, 0);
  door.position.set(zone.x, zone.height, farZ - dirZ * 0.3);
  if (dirZ === 1) door.rotation.y = Math.PI;
  group.add(door);

  // The balustrade: the whole reason a robot can walk past one of these
  // without ending up at the bottom of it. Waist-high would look right and be
  // wrong — the robot clears ~1.36m in a jump, so anything shorter than that
  // is either something it can hop over into the well or, worse, a rail with
  // an invisible wall stacked above it. RAIL_HEIGHT sits just above the jump,
  // so what's drawn and what blocks are the same thing.
  const RAIL_HEIGHT = 1.5;
  const railY = FLOOR_HEIGHT + RAIL_HEIGHT / 2;
  const longRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, RAIL_HEIGHT, SIDE_STAIR_RUN_LENGTH),
    railMat,
  );
  longRail.position.set(railX, railY, runCenterZ);
  group.add(longRail);
  const endRail = new THREE.Mesh(
    new THREE.BoxGeometry(SIDE_STAIR_HALF_WIDTH * 2, RAIL_HEIGHT, 0.2),
    railMat,
  );
  endRail.position.set(zone.x, railY, farZ);
  group.add(endRail);

  // Lights down the run and over the landing. Not optional dressing: the
  // corridor's own lighting doesn't reach into a sunken well, so without these
  // the opening reads as a black hole rather than as somewhere you can go, and
  // the steps themselves are invisible to judge distance against.
  const lightPlan: [number, number][] = [
    [3, FLOOR_HEIGHT - 0.5], // just inside the opening
    [9, FLOOR_HEIGHT - 2], // mid-flight, following the descent down
    [STAIR_RUN_DEPTH + 1, zone.height + 3], // over the landing and its door
  ];
  for (const [alongRun, lightY] of lightPlan) {
    const light = new THREE.PointLight(0xdfe6ff, 2.5, 16, 1.4);
    light.position.set(zone.x, lightY, topZ + dirZ * alongRun);
    group.add(light);
  }
}

function buildStairsAndScreen(group: THREE.Group, y: number): void {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24, roughness: 1 });
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });

  // Full sightline coverage top-to-bottom, learned the hard way earlier this
  // same day (Room 4's own back wall was sized for its flat apron and came up
  // short once the seating floor climbed toward the back row) — sized from
  // the *lowest* point these walls have to cover (the pit floor) up to the
  // hall's own ceiling height, not from STAIR_TOP_Z's flat reference.
  const wallBaseY = STAIR_ZONE.height;
  const wallTopY = FLOOR_HEIGHT + HALLWAY_CEILING_HEIGHT;
  const wallHeight = wallTopY - wallBaseY;
  const wallCenterY = (wallTopY + wallBaseY) / 2;
  const pitFarZ = STAIR_ZONE.z - STAIR_ZONE.halfD;

  // Two solid stubs capping the hall's own far wall on either side of the
  // stair opening (the opening itself spans only the walkable corridor's
  // width, not the hall's full width including its furniture strips).
  const stubWidth = HALL_ZONE.halfW - STAIR_ZONE.halfW;
  for (const side of [-1, 1] as const) {
    const stubX = HALL_ZONE.x + side * (STAIR_ZONE.halfW + stubWidth / 2);
    const stub = new THREE.Mesh(new THREE.BoxGeometry(stubWidth, wallHeight, 0.5), wallMat);
    stub.position.set(stubX, wallCenterY, STAIR_TOP_Z);
    group.add(stub);
  }

  // Side walls flanking the stair run + pit, from the opening down to the
  // glass doors at the very bottom.
  for (const side of [-1, 1] as const) {
    const sideX = HALL_ZONE.x + side * STAIR_ZONE.halfW;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallHeight, STAIR_ZONE.halfD * 2), wallMat);
    wall.position.set(sideX, wallCenterY, STAIR_ZONE.z);
    group.add(wall);
  }

  // The steps themselves — thin slabs whose top face matches stairHeightAt's
  // own per-step formula exactly (same "visual geometry and the walkable
  // height function can't drift apart" principle as every tiered zone in
  // this file), stacked so each step's own underside meets the next step
  // down's top face with no gap (same shape as the original prototype's
  // stairs, at a walkable rise instead of its jump-gated 0.5).
  const stepGeo = new THREE.BoxGeometry(STAIR_ZONE.halfW * 2, STAIR_RISE, STAIR_TREAD_DEPTH);
  for (let i = 0; i < NUM_STAIRS; i++) {
    const treadTopY = FLOOR_HEIGHT - (i + 1) * STAIR_RISE;
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.set(HALL_ZONE.x, treadTopY - STAIR_RISE / 2, STAIR_TOP_Z - (i * STAIR_TREAD_DEPTH + STAIR_TREAD_DEPTH / 2));
    group.add(step);
  }

  // The lower lobby floor, beyond the last step.
  const pitFloor = new THREE.Mesh(new THREE.PlaneGeometry(STAIR_ZONE.halfW * 2, STAIR_PIT_DEPTH), stepMat);
  pitFloor.rotation.x = -Math.PI / 2;
  pitFloor.position.set(HALL_ZONE.x, STAIR_ZONE.height, STAIR_TOP_Z - STAIR_RUN_DEPTH - STAIR_PIT_DEPTH / 2);
  group.add(pitFloor);

  // Closed glass exit doors at the very bottom (hallway_110s.jpg) — a solid
  // backing wall (so it occludes and blocks exactly like every other wall
  // here) with three separate double-door-shaped glass panels mounted on it,
  // not one undifferentiated pane (the user: "missing the doors going to the
  // outside... in reality it is like the 3 double [doors]") — matching the
  // reference photo's own three floor-to-ceiling glazed sets side by side,
  // with real dark mullion posts between them (geometry, not just texture
  // lines, so they read at a glance). Decorative only: this level doesn't
  // need a working outside exit here.
  const farWall = new THREE.Mesh(new THREE.BoxGeometry(STAIR_ZONE.halfW * 2, wallHeight, 0.5), wallMat);
  farWall.position.set(HALL_ZONE.x, wallCenterY, pitFarZ);
  group.add(farWall);
  const glassTexture = createGlassDoorTexture();
  // Unlit on purpose — a real backlit glass door reads as flatly bright
  // regardless of the room's own lighting, and MeshStandardMaterial's
  // emissive path here rendered as a dim, muddy tint even at a high
  // emissiveIntensity (confirmed live: correct config, still dim — a basic
  // unlit material sidesteps whatever was eating the brightness and shows
  // the texture's own colour exactly, same guaranteed-legible approach the
  // room-number backdrops and door signs already rely on). DoubleSide for
  // the same reason the ground floor's own copy of this needs it — a solid
  // backing wall sits right behind these in normal play, but there's no
  // reason to leave a plane that's only visible from one specific approach
  // direction when the fix is one line.
  const glassMat = new THREE.MeshBasicMaterial({ map: glassTexture, side: THREE.DoubleSide });
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  const doorHeight = 6.5;
  const doorWidth = 3.8;
  const doorSpacing = 4.4;
  const doorCenterY = STAIR_ZONE.height + doorHeight / 2;
  [-doorSpacing, 0, doorSpacing].forEach((offsetX) => {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth, doorHeight), glassMat);
    // + toward the hall (less-negative z), not - : the pit's far wall sits
    // at the *most* negative z here, so anything meant to stand in front of
    // it (facing the approaching player) needs a *larger* z, not smaller —
    // the original -0.3 put the whole door assembly behind the solid wall,
    // fully occluded, which is the real reason it read as "missing" (found
    // via a raycast from the camera toward the door's own position hitting
    // the wall first, closer than the door itself).
    door.position.set(HALL_ZONE.x + offsetX, doorCenterY, pitFarZ + 0.3);
    group.add(door);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.3, doorHeight + 0.4, 0.3), mullionMat);
    mullion.position.set(HALL_ZONE.x + offsetX + doorSpacing / 2, doorCenterY, pitFarZ + 0.25);
    group.add(mullion);
    // A light for each door, close enough to read clearly rather than
    // relying on one distant light for the whole wall (the first pass's
    // single light left this area reading as flat black from a normal
    // walking approach, even though the geometry itself was correctly there
    // — confirmed by a raycast/scene-graph check before concluding it was a
    // lighting problem rather than a missing-mesh one).
    const doorLight = new THREE.PointLight(0xdfeaff, 4, 12, 1);
    doorLight.position.set(HALL_ZONE.x + offsetX, doorCenterY, pitFarZ + 1.5);
    group.add(doorLight);
  });
  const outerMullionMat = mullionMat;
  [-doorSpacing * 1.5, doorSpacing * 1.5].forEach((offsetX) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, doorHeight + 0.4, 0.3), outerMullionMat);
    post.position.set(HALL_ZONE.x + offsetX, doorCenterY, pitFarZ + 0.25);
    group.add(post);
  });

  // The run itself sits beyond the hallway's own pillar lighting (pillars
  // stop at the hall's own halfLength) — one light partway down so the
  // steps themselves aren't a dark void between the screen glow at the top
  // and the glass-door glow at the bottom.
  const stairMidLight = new THREE.PointLight(0xffffff, 2, 16);
  stairMidLight.position.set(HALL_ZONE.x, FLOOR_HEIGHT - 1, STAIR_TOP_Z - STAIR_RUN_DEPTH / 2);
  group.add(stairMidLight);

  // The DEVOXX screen, hung right at the top of the stairs facing back up
  // the corridor — the first thing you see from far down the hall, matching
  // auditorium-stage-screen-sponsors.jpg's own composition.
  const screenTexture = createStairScreenTexture();
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    roughness: 0.35,
  });
  const screenWidth = STAIR_ZONE.halfW * 2 - 4;
  const screenHeight = screenWidth / 2;
  const screenCenterY = wallTopY - screenHeight / 2 - 1;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth, screenHeight), screenMat);
  screen.position.set(HALL_ZONE.x, screenCenterY, STAIR_TOP_Z - 0.2);
  group.add(screen);
  const screenLight = new THREE.PointLight(0xffe8c2, 3, 18);
  screenLight.position.set(HALL_ZONE.x, screenCenterY, STAIR_TOP_Z + 3);
  group.add(screenLight);
}

/**
 * One big, real, walkable auditorium — used for both Room 4 and its mirror
 * Room 9, entrance on whichever wall faces the hall. Geometry mirrors
 * `zone`/ROW_RISE/ROW_DEPTH/NUM_ROWS/APRON_DEPTH exactly, same
 * single-source-of-truth principle as the rest of this file, so the visible
 * rows and getFirstFloorHeightAt's/getAuditoriumRowWallColliders' own
 * walkable-and-jumpable rows always agree.
 */
// Rotated 90° on 2026-09-26 (matching the real floor plan's rake-away-
// from-the-corridor layout), then reverted the same day after the user saw it
// live: "before this hall change, the cinema room was okay, we should
// probably revert it to that state... nvm the orientation, since the other
// rooms aren't implemented, they won't be in the way." The rotation also
// introduced a real wall-dimension bug (w/d swapped on every wall) on top
// of not looking right, so this reverts to the pre-rotation geometry below
// rather than trying to fix the rotated version further. Only ROOM4_ZONE's
// `x`/`z` changed (to
// reattach to the new, bigger hallway's own wall/door slot) — this function
// itself is unchanged from before the rotation attempt.
function buildAuditorium(
  group: THREE.Group,
  zone: RaisedZone,
  entranceSide: 'left' | 'right',
  y: number,
  mats: AuditoriumMats,
): void {
  const roomHalfW = zone.halfW;
  const roomHalfD = zone.halfD;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomHalfW * 2, roomHalfD * 2), mats.floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(zone.x, y, zone.z);
  group.add(floor);

  // Entrance is a gap in the wall facing the hall — a real side entrance
  // partway up the raked seating, not a door at the very back row, but
  // centered on the STAGE_CLEARANCE boundary rather than the room's absolute
  // z-middle. It stays at plain STAGE_CLEARANCE (not APRON_DEPTH) — the
  // whole apron out to APRON_DEPTH is flat at `zone.height`, so the doorway
  // just needs to land somewhere inside that flat stretch; the first real
  // jump wall sits further in, at APRON_DEPTH, with clear room to walk in
  // first (see APRON_DEPTH's own comment). The opposite side wall (away from
  // the hall) stays solid.
  const entranceGapHalf = AUDITORIUM_ENTRANCE_GAP_HALF;
  const entranceCenterZ = zone.z - roomHalfD + STAGE_CLEARANCE;
  const entranceX = entranceSide === 'left' ? zone.x - roomHalfW : zone.x + roomHalfW;
  const solidX = entranceSide === 'left' ? zone.x + roomHalfW : zone.x - roomHalfW;
  // z = zone.z - roomHalfD is the far edge (screen wall); z = zone.z +
  // roomHalfD is the near edge (closest to the hall's own near wall).
  const farSegLength = entranceCenterZ - entranceGapHalf - (zone.z - roomHalfD);
  const nearSegLength = zone.z + roomHalfD - (entranceCenterZ + entranceGapHalf);
  const wallDefs = [
    { w: roomHalfW * 2, d: 0.5, x: zone.x, z: zone.z - roomHalfD }, // far (screen) wall
    { w: roomHalfW * 2, d: 0.5, x: zone.x, z: zone.z + roomHalfD }, // near wall
    { w: 0.5, d: roomHalfD * 2, x: solidX, z: zone.z }, // solid side, away from the hall
    { w: 0.5, d: farSegLength, x: entranceX, z: zone.z - roomHalfD + farSegLength / 2 },
    { w: 0.5, d: nearSegLength, x: entranceX, z: zone.z + roomHalfD - nearSegLength / 2 },
  ];
  for (const wDef of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wDef.w, AUDITORIUM_WALL_HEIGHT, wDef.d), mats.wallMat);
    wall.position.set(wDef.x, y + AUDITORIUM_WALL_HEIGHT / 2, wDef.z);
    group.add(wall);
  }

  // Stage + a big screen along the far wall, redone against actual venue
  // footage rather than a flat colored box: a dark bezel frame around the
  // picture area (the real screen reads as a bright rectangle floating in a
  // near-black room, not a colored slab with visible edges), a light-truss
  // rig hanging just above/in front of it, and (below, once the stage's own
  // front edge is known) the branded standing letters the footage shows in
  // front of every real screen shot — that last part was described here
  // before it was ever built, and is only actually true as of this pass.
  const stageDepth = STAGE_DEPTH;
  const stageSpec = auditoriumStage(zone);
  const stage = new THREE.Mesh(new THREE.BoxGeometry(stageSpec.halfW * 2, STAGE_HEIGHT, stageDepth), mats.stageMat);
  stage.position.set(stageSpec.x, y + STAGE_HEIGHT / 2, stageSpec.z);
  group.add(stage);

  const screenWidth = roomHalfW * 1.5;
  const screenHeight = 7;
  const screenZ = zone.z - roomHalfD + 0.4;
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(screenWidth + 0.6, screenHeight + 0.6, 0.2), bezelMat);
  bezel.position.set(zone.x, y + 3.8, screenZ - 0.05);
  group.add(bezel);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(screenWidth, screenHeight, 0.12), mats.screenMat);
  screen.position.set(zone.x, y + 3.8, screenZ + 0.05);
  group.add(screen);

  // Truss rig: a shallow triangular ladder of thin bars spanning the screen's
  // width, hung just above/in front of its top edge — see keynote_hi_3s.jpg.
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.6, roughness: 0.4 });
  const trussY = y + 3.8 + screenHeight / 2 + 0.5;
  const trussZ = screenZ + 0.6;
  for (const rail of [-0.25, 0.25]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, screenWidth, 6), trussMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(zone.x, trussY + rail, trussZ);
    group.add(bar);
  }
  const trussStruts = Math.max(2, Math.round(screenWidth / 3));
  for (let i = 0; i <= trussStruts; i++) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), trussMat);
    strut.rotation.x = Math.PI / 4;
    strut.position.set(zone.x - screenWidth / 2 + (screenWidth * i) / trussStruts, trussY, trussZ);
    group.add(strut);
  }

  // The DEVOXX letters (see addDevoxxLetters) facing the seats — one of the
  // two spots the same set gets reused in, up on the stage deck where the real
  // ones stand (keynote_hi_3s.jpg). The user: "can be used in the cinema room
  // on the podium".
  //
  // They sat on the apron floor until the stage became a real platform
  // (STAGE_HEIGHT), because a robot walking clean through the stage while
  // bouncing off lettering apparently floating 40cm above its own feet was
  // the one arrangement that read wrong in motion. Now the deck is solid and
  // standable, so the collision and the picture agree up here too: jump onto
  // the podium and the letters are objects you walk around, not scenery you
  // pass through.
  //
  // A standing glyph's collider carries no `height`, unlike the stage's own,
  // so it blocks at every level — which is right: at floor level the stage
  // already blocks this footprint, and once you're up on the deck the letters
  // should still be solid. Nothing can jump over them either; they stand 1.5m
  // on a 0.4m deck, well past the ~1.36m jump. A glyph knocked over by a robot
  // running into it gives its collider up entirely (updateDevoxxLetters).
  addDevoxxLetters(group, 'first', {
    x: stageSpec.x,
    y: stageSpec.topY,
    // Toward the deck's front edge rather than its middle, so they read
    // against the screen from the seats instead of hugging the back wall.
    z: stageSpec.z + stageSpec.halfD * 0.35,
    rotationY: 0,
  });

  // A charging dock on the flat apron, at the foot of the climb — the most
  // valuable of the four by a distance (see DOCK_ENERGY_PER_SECOND's own
  // comment). Every row above costs a 20-energy jump against a 100 cap, so
  // without this the only way to refill mid-room was to stand still and wait
  // out the passive regen; with it, "top up before committing to the climb"
  // becomes a real decision made under a 32s clock.
  //
  // Set aside against the room's far side wall — its dead end, the one opposite
  // the entrance (the user: "put the chargers on the first floor a bit aside",
  // then "add the charging dock in the cinema room to the other side of the
  // room"). Turned a quarter so the column backs into that wall and the pad
  // faces back across the apron.
  //
  // It sat by the entrance wall for a pass, which made it something you walked
  // past on the way in. Over here it's a genuine detour — the full width of the
  // room from the door, and away from the aisle you climb — so topping up costs
  // you the walk as well as the seconds standing on it, which is the decision
  // the docks exist to create.
  //
  // Clear of everything around it: the room's walkable edge is x -66.8 and the
  // column lands at -64.1, the stage's own footprint stops at x -62 and sits
  // 6m south anyway, row 0's wall is 3.3m north, and the apron quote at
  // (-48, -23) is right across the room.
  addChargingDock(group, 'first', {
    x: zone.x - 15,
    y,
    z: zone.z - roomHalfD + 8,
    rotationY: Math.PI / 2,
  });

  // Warm wash across the letters and the stage front, from just in front of
  // them. The scene's own ambient already makes them legible — this is for
  // the raked, spotlit look the reference frames have, not for legibility.
  const stageTopY = y + 0.4; // the stage box's own top face (0.4 tall, centered at y+0.2)
  for (const offsetX of [-3, 3]) {
    const wash = new THREE.PointLight(0xfff1dc, 3, 9, 1.5);
    wash.position.set(zone.x + offsetX, y + 2, stage.position.z + stageDepth / 2 + 1.6);
    group.add(wash);
  }

  // AV table and the branded flight case beside it at the stage's edge, per
  // room7-signage-screen-red-wall.jpg — the speaker's own kit, left of the
  // letters so it never sits in front of them.
  const crateGroup = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.95 });
  const avTable = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 0.8), clothMat);
  avTable.position.set(zone.x - roomHalfW * 0.42, stageTopY + 0.375, zone.z - roomHalfD + stageDepth - 0.4);
  crateGroup.add(avTable);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x16305c, roughness: 0.8 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.75), crateMat);
  const crateX = zone.x - roomHalfW * 0.42 - 1.5;
  const crateZ = zone.z - roomHalfD + stageDepth - 0.4;
  crate.position.set(crateX, stageTopY + 0.35, crateZ);
  crateGroup.add(crate);
  // Unlit label plane on the crate's audience-facing side — same
  // guaranteed-legible treatment the room-number signs and glass doors use.
  const crateLabelMat = new THREE.MeshBasicMaterial({ map: createCrateLabelTexture() });
  const crateLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.41), crateLabelMat);
  crateLabel.position.set(crateX, stageTopY + 0.38, crateZ + 0.38);
  crateGroup.add(crateLabel);
  group.add(crateGroup);

  // No room-number panel in here. It used to hang on the solid side wall
  // facing the entrance, which put the room's own number on the wall opposite
  // its door and visible through the doorway from the corridor — reading as
  // signage for the hall rather than for the room (the user: "the room number
  // is being used for whatever reason at the other side of the room"). It now
  // lives where every other room's does, beside the doorway itself
  // (CinematicHallway's createRoomNumberPanel).

  // Real per-row stadium seating: every single row gets its own riser (see
  // ROW_RISE's own comment) — no grouping into flat multi-row plateaus. Seat
  // count per row derives from the room's own width instead of a fixed
  // literal — a hardcoded "6" left most of a real-scale room's much wider
  // rows bare (a real bug this same file's own 2026-09-24 dated entry
  // claimed was already fixed; it wasn't — fixed for real here).
  const aisleHalf = 1.4;
  const seatSpacing = 1.05;
  const riserWidth = roomHalfW - aisleHalf - 0.5;
  const seatsPerSide = Math.max(1, Math.floor(riserWidth / seatSpacing));

  // Individual cinema seats (cushion + backrest + a shared-style armrest
  // pad between seats, not one flat cube, matching the real venue's
  // flip-up-armrest style) via InstancedMesh: at 16 tiers × ~17 seats ×
  // 2 sides, one mesh per seat-part
  // would still be several hundred draw calls for this room.
  //
  // One real row of chairs per tier, bunched against the tier's BACK edge
  // (the wall that gates the NEXT tier), not the front. Five rounds of
  // correction from the user, each catching something the last one missed:
  // (1) chairs at the near edge — wrong, that's the wall already cleared,
  // leaving the *next* wall unmarked; (2) chairs at the far edge but too
  // close to it — "i can walk through the chairs": the clearance was
  // measured against the wall's *best-case* blocking distance, not its
  // worst case; (3) fixed the worst-case math but with the wrong sign on the
  // robot's own radius, over-corrected into "these are even at the
  // beginning... you should expect them to start at the back"; (4) fixed the
  // sign for real (see SEAT_CLEARANCE_PAST_WALL's own comment) and, with the
  // clearance now much smaller, added a *second* row for density — which
  // reintroduced the original problem one level up: "in the one, we can't
  // walk through (good thing), and in the other, we can (not a good thing).
  // The one that is fine is the one closest to the next level." The back row
  // works because it sits in the one sliver of a tier the robot's body can
  // never reach; a second row anywhere else in the same flat tier is, by
  // definition, ordinary floor the robot already walks through freely, and
  // no second "wall" inside one tier can add a real jump requirement either
  // — you're already at that tier's one height everywhere in it the moment
  // you land. One row it is — see MIN_ROW_DEPTH's own comment for why this
  // makes rows *shallower*, not sparser: more of them fit.
  const totalSeats = NUM_ROWS * seatsPerSide * 2;
  const seatCushionGeo = new THREE.BoxGeometry(0.65, 0.12, 0.68);
  const seatBackGeo = new THREE.BoxGeometry(0.65, 0.55, 0.1);
  const armrestGeo = new THREE.BoxGeometry(0.07, 0.14, 0.6);
  const seatCushions = new THREE.InstancedMesh(seatCushionGeo, mats.seatMat, totalSeats);
  const seatBacks = new THREE.InstancedMesh(seatBackGeo, mats.seatMat, totalSeats);
  // One extra armrest per row-side (seatsPerSide+1) to cap both ends, not
  // just one per seat — otherwise the last seat in each row reads as armless.
  const armrests = new THREE.InstancedMesh(armrestGeo, mats.riserMat, NUM_ROWS * (seatsPerSide + 1) * 2);
  const m = new THREE.Matrix4();
  let seatIndex = 0;
  let armrestIndex = 0;

  for (let row = 0; row < NUM_ROWS; row++) {
    // Relative to `y`, matching auditoriumRowHeightAt's
    // `zone.height + (row + 1) * ROW_RISE` exactly (zone.height is `y`
    // itself for every RaisedZone in this file).
    const rowHeight = (row + 1) * ROW_RISE;
    const rowZStart = zone.z - roomHalfD + APRON_DEPTH + row * ROW_DEPTH;
    const rowZCenter = rowZStart + ROW_DEPTH / 2;
    // Where the chairs sit — see SEAT_CLEARANCE_PAST_WALL's own comment above
    // for the five-round history of getting this placement right. The row's
    // *center* sits SEAT_CLEARANCE_PAST_WALL from the *next* tier's wall —
    // right up against it, in the band the robot's own body can never reach,
    // not measured back from it. Everything ahead of it, back to the tier's
    // own entry, is genuinely open floor — "people to move in front of them."
    const seatZ = rowZStart + ROW_DEPTH - SEAT_CLEARANCE_PAST_WALL;
    // Previous row's height (0 for row 0, meaning the flat apron).
    const prevHeight = row === 0 ? 0 : row * ROW_RISE;

    // Flat tread floor for this one row.
    const treadFloor = new THREE.Mesh(new THREE.PlaneGeometry(roomHalfW * 2, ROW_DEPTH - 0.05), mats.floorMat);
    treadFloor.rotation.x = -Math.PI / 2;
    treadFloor.position.set(zone.x, y + rowHeight + 0.01, rowZCenter);
    group.add(treadFloor);

    // Riser at the row's front edge — the visual match for the real
    // jump-gate collider at this same z (getAuditoriumRowWallColliders,
    // robotOnly). Real stadium-seating scale (ROW_RISE), not a tall wall —
    // the jump requirement comes from the collider being robotOnly, not
    // from this being hard to see over.
    const riserHeight = rowHeight - prevHeight;
    const riser = new THREE.Mesh(new THREE.BoxGeometry(roomHalfW * 2, riserHeight, RISER_THICKNESS), mats.riserMat);
    riser.position.set(zone.x, y + prevHeight + riserHeight / 2, rowZStart);
    group.add(riser);

    // Red LED tread marks along the riser's top-front edge — the "jump up
    // here" cue (for the robot; hazards ignore it and just climb), same
    // discrete-dots (not one solid bar) convention as the reference photo's
    // own dotted tread lighting.
    const dotSpacing = 0.6;
    const dotCount = Math.max(2, Math.floor((roomHalfW * 2 - 1) / dotSpacing));
    for (let d = 0; d <= dotCount; d++) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), mats.aisleLightMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(zone.x - roomHalfW + 0.5 + d * dotSpacing, y + rowHeight + 0.02, rowZStart + 0.16);
      group.add(dot);
    }

    for (const side of [-1, 1]) {
      for (let i = 0; i < seatsPerSide; i++) {
        const seatX = zone.x + side * (aisleHalf + 0.5 + i * seatSpacing);
        m.makeTranslation(seatX, y + rowHeight + 0.32, seatZ);
        seatCushions.setMatrixAt(seatIndex, m);
        // +0.29, not -0.29: the screen sits at the room's low-z (far) end,
        // so seated robots/hazards face toward decreasing z — the backrest
        // has to sit on the high-z side (behind them), not toward the
        // screen. Had this backward at first (the user: "the seats feel the
        // other way around now").
        m.makeTranslation(seatX, y + rowHeight + 0.62, seatZ + 0.29);
        seatBacks.setMatrixAt(seatIndex, m);
        seatIndex++;

        // Armrest at this seat's near edge, shared visually with whichever
        // seat sits on the other side of it — same "shared stanchion"
        // convention real cinema rows use.
        const armX = zone.x + side * (aisleHalf + 0.5 + i * seatSpacing - seatSpacing / 2);
        m.makeTranslation(armX, y + rowHeight + 0.4, seatZ + 0.1);
        armrests.setMatrixAt(armrestIndex, m);
        armrestIndex++;
      }
      // Cap the far end of the row with one more armrest.
      const farArmX = zone.x + side * (aisleHalf + 0.5 + seatsPerSide * seatSpacing - seatSpacing / 2);
      m.makeTranslation(farArmX, y + rowHeight + 0.4, seatZ + 0.1);
      armrests.setMatrixAt(armrestIndex, m);
      armrestIndex++;
    }

    // Aisle walkway accent strip for this row, at the row's own height — a
    // faint strip light marks it distinctly from the seats either side.
    const aisleStripMat = new THREE.MeshStandardMaterial({ color: 0x2a2830, emissive: 0x442233, emissiveIntensity: 0.3 });
    const aisleStrip = new THREE.Mesh(new THREE.PlaneGeometry(aisleHalf * 1.6, ROW_DEPTH - 0.1), aisleStripMat);
    aisleStrip.rotation.x = -Math.PI / 2;
    aisleStrip.position.set(zone.x, y + rowHeight + 0.02, rowZCenter);
    group.add(aisleStrip);
  }
  seatCushions.instanceMatrix.needsUpdate = true;
  seatBacks.instanceMatrix.needsUpdate = true;
  armrests.instanceMatrix.needsUpdate = true;
  group.add(seatCushions);
  group.add(seatBacks);
  group.add(armrests);
}


// The first floor: a wide central hall running the floor's full length, with
// one real, big, walkable auditorium (Room 4, at real scale — see the
// DECIDED note by ROOM4_ZONE) on the left, plus the other 6 session rooms
// (3, 6, 7, 9, 8, 10) as closed-door props along the hall's side walls. The
// hall *is* the corridor/landing space — there's no separate lobby. Geometry
// mirrors FIRST_FLOOR_ZONES exactly so the walkable footprint and what you
// see always agree. Both entry walls
// carry their own closed door too — walking back up to one teleports you
// back down.
export function createFirstFloor(): THREE.Group {
  const group = new THREE.Group();
  // Visuals build from the full-size (non-recessed) zones — the collision
  // recess in FIRST_FLOOR_ZONES only affects where the robot can actually
  // walk, not where the walls are drawn.
  const hall = HALL_ZONE;
  const room4 = ROOM4_ZONE;
  const y = FLOOR_HEIGHT;
  clearDevoxxLetters('first'); // see createExhibitionHall's own reset
  clearChargingDocks('first');
  const hallWallHeight = 6; // end-caps only — CinematicHallway's own side walls use HALLWAY_CEILING_HEIGHT-derived scale

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2e2b33 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f1d24 });
  const stageMat = new THREE.MeshStandardMaterial({ color: 0x17151a });
  // "Coding on the screen" — the room's own centerpiece, per the user's ask —
  // a baked syntax-highlighted code frame (createAuditoriumScreenTexture)
  // rather than a flat colored slab.
  const screenTexture = createAuditoriumScreenTexture();
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.9,
    roughness: 0.35,
  });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1c2438 }); // dark blue-black, matching the cinema seating photos
  const riserMat = new THREE.MeshStandardMaterial({ color: 0x0f0e12 });
  const aisleLightMat = new THREE.MeshStandardMaterial({
    color: 0xff2020,
    emissive: 0xff2020,
    emissiveIntensity: 2,
  });
  const auditoriumMats: AuditoriumMats = { floorMat, wallMat, stageMat, screenMat, seatMat, riserMat, aisleLightMat };

  // The hallway shell itself — floor, ceiling, side walls, fabric pillars,
  // furniture, and all 8 door-fronts (see CinematicHallway.ts) — built from
  // the exact same numbers HALL_ZONE/ROOM4_ZONE above are made from, so the
  // visuals and the walkable footprint can't drift apart. Room 4 is reached
  // by a real, walkable wall gap again (reverted — see ROOM4_ZONE's own
  // note), so the hall's own wall stays open along Room 4's *entire*
  // frontage — same as the pre-hallway-rebuild design, where it was Room 4's
  // own (much narrower) door that actually gated the entrance, not the
  // hall's wall. The other 7 door-fronts still sit on fully solid wall,
  // exactly like before.
  const hallway = new CinematicHallway({
    corridorHalfWidth: HALLWAY_CORRIDOR_HALF_WIDTH,
    sideDepth: HALLWAY_SIDE_DEPTH,
    halfLength: HALLWAY_HALF_LENGTH,
    ceilingHeight: HALLWAY_CEILING_HEIGHT,
    doorsPerSide: HALLWAY_DOOR_Z_POSITIONS.length,
    doorZPositions: HALLWAY_DOOR_Z_POSITIONS,
    // Room 4's whole frontage, and nothing else. The mid-corridor stairs used
    // to need an opening in each side wall too, back when they descended
    // outward through it; now that they drop into the hall's own floor beside
    // those walls (see SIDE_STAIRS), a gap there would just be a hole in the
    // corridor. z is hall-relative here, unlike SIDE_STAIRS' world values.
    wallGaps: [{ side: 'left', z: ROOM4_ZONE.z - hall.z, halfGap: ROOM4_ZONE.halfD }],
    // Punch the two stairwells out of the floor. Sinking a flight into the hall
    // isn't enough on its own — the hall's floor is one plane across its whole
    // footprint, so without this it simply runs over the trench and the steps
    // sit under a lid (the user, looking straight at one: "there is a floor in
    // between that should be removed where the stair is").
    floorHoles: SIDE_STAIRS.map(({ zone }) => ({
      x: zone.x - hall.x,
      z: zone.z - hall.z,
      halfW: zone.halfW,
      halfD: zone.halfD,
    })),
    // Room 4's own door reads as a real open doorway, not a closed prop —
    // no leaf, posts as tall as Room 4's own wall so there's no open strip
    // left above a shorter frame (the user: "remove the door now, keep the
    // wall, higher then now... this should be open so we can walk through
    // it, mimicking an open door").
    openDoorSlots: [{ side: 'left', z: HALLWAY_DOOR_Z_POSITIONS[1], height: AUDITORIUM_WALL_HEIGHT }],
    // Keep both stairwells clear — and now that each one is a 20.4m trench in
    // the floor rather than a doorway in the wall, "clear" means its whole
    // length, not just the approach. The furniture row sits 2.4m off the wall
    // and the pillars 4.8m, both inside a well that reaches 6m in from it, so
    // without this a table would hang in mid-air over the steps and its
    // collider with it.
    clearZones: [
      { z: SIDE_STAIRS[0].zone.z - hall.z, halfZ: SIDE_STAIR_ZONE_HALF_D },
      // Room 4's doorway needs the same treatment: the pillar row's own
      // spacing landed one lit pillar 2m off the doorway's centre, square in
      // the walk-in line (the user: "remove the lamp in front of the cinema
      // room door"). Sized to the walkable gap itself, not the much wider
      // wall opening above — the pillar's own half-width is added by
      // isInClearZone, so this only ever drops the one pair standing in it.
      { z: HALLWAY_DOOR_Z_POSITIONS[1], halfZ: AUDITORIUM_ENTRANCE_GAP_HALF },
    ],
    // Every pillar lit, not just every other pair (the user: "some pilars are
    // not lighting up") — at only 10 pillar pairs total in this hall, 20
    // live lights is well within budget; the density knob stays configurable
    // for a much longer hallway that might actually need it.
    lightDensity: 1,
  });
  hallway.position.set(hall.x, y, hall.z);
  group.add(hallway);
  hallwayInstance = hallway;

  // Near end (Stairs A/B): a capped wall here reads as a real architectural
  // dead end, which isn't accurate — the user: "between room 3 and 10, the venue
  // doesn't stop, but the conference part of it does in reality... it
  // should be better visually to have the hall keep on running, but
  // something should stop us from navigating towards it." The floor/ceiling
  // now keep going past the walkable limit into a dark, unlit stretch (no
  // pillars/furniture there — it's real venue space, just not part of the
  // conference), and a sci-fi laser barrier stands at the actual limit
  // instead of a wall. Nothing about collision changes: the wall here was
  // always purely decorative — `isOnFirstFloor`'s own zone recess is the
  // real boundary, unchanged (see `FIRST_FLOOR_ZONES`'s `recessedZone(HALL_ZONE, ...,
  // 'near', ...)`), so the barrier is positioned to sit exactly there rather
  // than merely near it.
  const hallNearZ = hall.z + hall.halfD;
  const nearExtensionDepth = 24;
  const unusedFloorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const unusedCeilingMat = new THREE.MeshBasicMaterial({ color: 0x010101 });
  const unusedFloor = new THREE.Mesh(new THREE.PlaneGeometry(hall.halfW * 2, nearExtensionDepth), unusedFloorMat);
  unusedFloor.rotation.x = -Math.PI / 2;
  unusedFloor.position.set(hall.x, y, hallNearZ + nearExtensionDepth / 2);
  group.add(unusedFloor);
  const unusedCeiling = new THREE.Mesh(new THREE.PlaneGeometry(hall.halfW * 2, nearExtensionDepth), unusedCeilingMat);
  unusedCeiling.rotation.x = Math.PI / 2;
  unusedCeiling.position.set(hall.x, y + HALLWAY_CEILING_HEIGHT, hallNearZ + nearExtensionDepth / 2);
  group.add(unusedCeiling);
  group.add(createLaserBarrier(hall.x, y, hallNearZ - MOVER_CLEARANCE, hall.halfW));

  // Two charging docks along the corridor, both set well aside in the furniture
  // strips rather than out in the walking lane (the user: "a bit aside"). The
  // whole hall is walkable — HALL_ZONE.halfW is 15, the full width including
  // both strips, so the recessed limit is x -26.8..0.8, not just the 14m
  // centre — but the strips are where the tables, chairs and pillars already
  // live, so that's where a fixture belongs. Each sits in the clear band
  // between the corridor's own visual edge (x = ±7 local) and the chairs and
  // pillars at ±10.2, and each lands between furniture slots in z rather than
  // beside one: the slots run every 6m, which puts them on world z ≡ -49 (mod
  // 6). Nearest neighbour to either dock is ~2.5m.
  //
  // The midpoint one also sits deliberately *off* ROOM_WAYPOINTS' own hall
  // point at (FIRST_FLOOR_CENTER_X, -46), which wandering hazards steer
  // straight at. Making the refuel a contested tile would be a defensible
  // design, but it should be a decision rather than an accident of two features
  // picking the same coordinate.
  addChargingDock(group, 'first', { x: hall.x - 8.5, y, z: hall.z + 3, rotationY: 0 });
  // The far one serves the deep end, between the quotes at z=-85 and z=-115 —
  // the longest stretch of the level with nothing on it, and the furthest point
  // from anywhere else to recover. Opposite strip from the midpoint dock, so
  // the two don't read as a repeated fixture down one side.
  addChargingDock(group, 'first', { x: hall.x + 8.5, y, z: -100, rotationY: 0 });

  // No DEVOXX letters along this corridor: a set stood in the left furniture
  // strip here for one pass, and the user cut it when the prop gained
  // its topple ("would remove the devoxx letters in the hall on the first
  // floor"). The two that remain are the ones you can actually walk up to and
  // knock over — Room 4's podium and the foyer above the entrance stair —
  // rather than a third that only ever read as wallpaper you squeeze past.

  // Far end (Stair C, by Room 6/7): a real descending staircase down to a
  // closed-glass-door exit lobby, not a closed door prop — see
  // buildStairsAndScreen's own comment for why (the user: "at the end of the
  // hall... there should be stairs going down to the exit outside").
  buildStairsAndScreen(group, y);

  // Room 4 — the one real, big, walkable auditorium (see the DECIDED note by
  // ROOM4_ZONE above). Entrance faces the hall, on Room 4's right/east side.
  // No room number passed in: the "4" is signage on the corridor side of the
  // doorway, derived from the floor plan by CinematicHallway's own
  // roomNumberForSlot(), so there's no second place for it to disagree with.
  buildAuditorium(group, room4, 'right', y, auditoriumMats);

  // The mid-corridor stairs down, through the wall gaps opened above.
  for (const stair of SIDE_STAIRS) buildSideStair(group, stair);

  return group;
}

// Entrance foyer beyond the front opening: bright, lower-ceilinged, with an
// orange-lit reception backdrop, sitting on a real ledge above the taller
// hall, matching the real venue's look. The ledge is a jump-up / fall-down
// obstacle (see Robot.ts), not a walkable ramp.
function createEntranceFoyer(): THREE.Group {
  const group = new THREE.Group();
  const halfD = HALL_DEPTH / 2;
  const foyerHalfW = FOYER_WIDTH / 2;
  const y = FOYER_FLOOR_Y;
  // The landing beyond the stair run, not a full reception room — see
  // FOYER_DEPTH's own comment.
  const flatStart = halfD + ENTRANCE_STAIR_RUN_DEPTH;
  const flatDepth = FOYER_DEPTH - ENTRANCE_STAIR_RUN_DEPTH;
  const flatCenterZ = flatStart + flatDepth / 2;

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0efe9 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff8a3d,
    emissive: 0xff8a3d,
    emissiveIntensity: 0.6,
  });
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.85 });

  // The flat reception floor only — the stair run below has its own stepped
  // geometry instead of one flat plane cutting through the steps.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FOYER_WIDTH, flatDepth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, y, flatCenterZ);
  group.add(floor);

  // A real walkable staircase up from the hall floor, not a cliff to jump
  // onto — see FOYER_DEPTH's own comment for why this changed. Thin stacked
  // slabs, same shape as the other two staircases built this session, at a
  // rise safely under AUTO_STEP_HEIGHT so it's walkable on foot.
  const stepGeo = new THREE.BoxGeometry(DOORWAY_WIDTH, ENTRANCE_STAIR_RISE, ENTRANCE_STAIR_TREAD_DEPTH);
  for (let i = 0; i < NUM_ENTRANCE_STAIRS; i++) {
    const treadTopY = (i + 1) * ENTRANCE_STAIR_RISE;
    const step = new THREE.Mesh(stepGeo, stepMat);
    step.position.set(0, treadTopY - ENTRANCE_STAIR_RISE / 2, halfD + i * ENTRANCE_STAIR_TREAD_DEPTH + ENTRANCE_STAIR_TREAD_DEPTH / 2);
    group.add(step);
  }

  const wallThickness = 0.5;
  // Side walls span the *full* depth (stairs + flat reception), floor to
  // ceiling, so there's no gap where the floor is lower than the flat
  // reception's own base — the far (accent) wall only backs the flat area.
  const wallHeight = y + FOYER_WALL_HEIGHT;
  const wallCenterY = wallHeight / 2;
  const foyerCenterZ = halfD + FOYER_DEPTH / 2;
  const foyerWallDefs = [
    { w: FOYER_WIDTH, d: wallThickness, x: 0, z: halfD + FOYER_DEPTH }, // far wall (accent)
    { w: wallThickness, d: FOYER_DEPTH, x: -foyerHalfW, z: foyerCenterZ }, // left
    { w: wallThickness, d: FOYER_DEPTH, x: foyerHalfW, z: foyerCenterZ }, // right
  ];
  for (const wDef of foyerWallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wDef.w, wallHeight, wDef.d), wallMat);
    wall.position.set(wDef.x, wallCenterY, wDef.z);
    group.add(wall);
  }

  const accentStrip = new THREE.Mesh(new THREE.BoxGeometry(FOYER_WIDTH * 0.8, 0.3, 0.1), accentMat);
  accentStrip.position.set(0, y + FOYER_WALL_HEIGHT * 0.7, halfD + FOYER_DEPTH - 0.2);
  group.add(accentStrip);

  // Closed glass doors capping the landing — see FOYER_DEPTH's own comment
  // for why this replaced the detailed desk/queue mockup. Three panels with
  // real mullion posts between them, reusing the exact same texture/material
  // approach as the first-floor hallway's own stair-down ending (that one
  // had a real occlusion bug from a sign error — positioned correctly here
  // from the start). DoubleSide, though: an unrotated PlaneGeometry's default
  // +Z normal happened to face the camera in the hallway's own case (camera
  // approaches from +z there) but faces *away* from it here (camera
  // approaches from -z, out of the hall) — confirmed by raycast: the ray
  // passed clean through the door and hit the far wall behind it instead.
  // Same single-sided-plane bug class this project has hit more than once
  // now; DoubleSide makes it approach-direction-proof instead of relying on
  // guessing the right rotation.
  const glassTexture = createGlassDoorTexture();
  const glassMat = new THREE.MeshBasicMaterial({ map: glassTexture, side: THREE.DoubleSide });
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 });
  const doorHeight = FOYER_WALL_HEIGHT * 0.85;
  const doorWidth = FOYER_WIDTH / 3 - 1;
  const doorSpacing = FOYER_WIDTH / 3;
  const doorCenterY = y + doorHeight / 2;
  const doorZ = halfD + FOYER_DEPTH - 0.3; // just in front of the far wall, facing the hall
  [-doorSpacing, 0, doorSpacing].forEach((offsetX) => {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth, doorHeight), glassMat);
    door.position.set(offsetX, doorCenterY, doorZ);
    group.add(door);
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.25, doorHeight + 0.3, 0.25), mullionMat);
    mullion.position.set(offsetX + doorSpacing / 2, doorCenterY, doorZ + 0.05);
    group.add(mullion);
  });
  const doorLight = new THREE.PointLight(0xdfeaff, 3, 12, 1);
  doorLight.position.set(0, doorCenterY, doorZ + 1.5);
  group.add(doorLight);

  // The DEVOXX letters on the landing, facing back out over the hall — the
  // user's own placement, twice: "the ground floor between the small stair and
  // the closed doors leading to the reception", then "in the exhibition hall
  // above the stair". Sits ~2m clear of the doors and ~2.8m past the top step,
  // so neither the stair run nor the glass doors is crowded, and the landing is
  // 26m wide against the wordmark's ~7.5m — the robot walks around either end
  // rather than being funnelled, and can walk into any glyph to knock it over.
  addDevoxxLetters(group, 'ground', {
    x: 0,
    y,
    z: halfD + FOYER_DEPTH - 2.4,
    rotationY: Math.PI,
  });

  return group;
}

// The exhibition floor's most recognizable non-generic detail: a suspended white
// soffit with a warm amber backlit edge, marking a walkway threshold — matching
// the real venue's angled cove-lit canopy over the crowd.
function createSoffit(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f4ef });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xffb347,
    emissiveIntensity: 1.8,
  });

  const soffitWidth = HALL_WIDTH * 0.5;
  const soffitDepth = 6;

  const body = new THREE.Mesh(new THREE.BoxGeometry(soffitWidth, 0.6, soffitDepth), bodyMat);
  body.position.set(0, SOFFIT_HEIGHT, 0);
  group.add(body);

  for (const zSide of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(soffitWidth, 0.08, 0.08), glowMat);
    strip.position.set(0, SOFFIT_HEIGHT - 0.32, (zSide * soffitDepth) / 2 + zSide * 0.05);
    group.add(strip);
  }

  return group;
}
