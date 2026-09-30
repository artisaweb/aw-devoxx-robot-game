import * as THREE from 'three';
import {
  Collider,
  getFirstFloorHeightAt,
  isOnFirstFloor,
  isInSideStairwell,
  FIRST_FLOOR_ROOM4_ZONE,
  FIRST_FLOOR_CENTER_X,
} from '../scene/ExhibitionHall';
import { Robot } from '../entities/Robot';
import { createGlowSprite, HALO_BASE_SIZE, BEACON_BASE_SIZE, BEACON_HEIGHT } from './swagAccessories';
import { AttendeeArchetype, createAttendeeMesh } from './attendeeModels';
import { createSpeechBubble, SpeechBubble } from './speechBubble';
import { randomConfusedGripe, randomConfusedReaction } from '../text/attendeeDialogue';
import { randomDroidToppleToast } from '../text/robotToasts';
import { KNOWLEDGE_QUOTES, KnowledgeQuoteId } from '../text/knowledgeQuotes';

// Level 2 — Droid, "Knowledge Run". Same
// engine/shape as Voxxy's Swag Run (timer, pickups, wandering hazards, a
// refuel kiosk, early finish + time bonus), reskinned for the first-floor
// corridor/Room 4/Stair C lobby map instead of the ground-floor hall.
// Nothing here depends on which mesh the robot is wearing (Droid's real
// model, or his low-poly stand-in while it downloads — see Robot.ts's
// loadRobotModel).

// Which "conference wisdom" quote (see src/text/knowledgeQuotes.ts — that's
// where to add/edit/translate the actual joke text) sits at each nugget
// position. Spread across the two areas of the first floor: a few along the
// hall, one on Room 4's flat apron (reachable by just walking in), and the
// rest across the real ROWS (see ExhibitionHall.ts's
// auditoriumRowHeightAt/getAuditoriumRowWallColliders — NUM_ROWS is derived
// from MIN_ROW_DEPTH: one real seat row per tier, not two, since a second row
// anywhere in a flat tier is just ordinary floor a robot already walks
// through freely — only the row sitting right against the *next* tier's wall
// is genuinely unreachable without a jump) — every row beyond the apron is
// genuinely jump-gated for the robot (though not for hazards — see
// Collider.robotOnly), so climbing toward the back of the room to collect
// these is the intended parkour.
// Re-derived 2026-09-26: the "move the room so the door lines up" fix
// shifted ROOM4_ZONE.z by +19 without this file being updated to match —
// every Room 4 position here was pointing at empty space or a wall (the user:
// "no longer mapped correctly on the map"). Also rebalanced the hall/room
// split, same day: the hall grew to 180m long but still only held 3 of the
// 13 pickups, while Room 4 (much smaller) held the other 10 — moved 3 more
// out to the hall (6/7 split now) per the user's own follow-up ("spread some of
// the quotes in the hall itself"). Every position also zig-zags across x
// (the aisle's own left/right safe margin for Room 4, the corridor's clear
// width for the hall) instead of sitting on one exact line, per his earlier
// "spread across the map, not one line" ask.
//
// Re-spread again 2026-09-29 (the user: "level 2 knowledge bubbles need to be
// spread a lot more"), to 7 hall / 5 Room 4. Two things were actually wrong:
//
//  - The hall used barely half its own length. The corridor runs z -139..41,
//    but the five positions sat between z 30 and -115 with a 60m dead stretch
//    between z -25 and -85 — the longest walk in the level had nothing in it.
//    The seven now reach from the Stairs A/B arrival to the Stair C end, and
//    swing across the corridor's full clear width (x -18..-8, inset from the
//    -20..-6 walkable edges by MOVER_CLEARANCE) rather than the old ±3m
//    wobble around the centerline.
//  - Room 4 held 7 of the 12 inside a 2.8m-wide column. That column is not a
//    mistake to widen: it's the central aisle (aisleHalf 1.4 in
//    buildAuditorium), and every metre either side of it is seating, so a
//    nugget out there could only be collected by walking through chairs.
//    Spreading Room 4 means thinning it, not widening it — two quotes moved
//    out to the empty corridor, and the remaining five re-spaced over the
//    same full row-0-to-back-row climb so the jump-gated progression keeps
//    its depth (the deepest nugget is still the back row, 16 jumps in).
//
// Room 4 z values are row centers, from row r = -16.55 + r * ROW_DEPTH
// (ROW_DEPTH 2.294, derived in ExhibitionHall.ts).
const QUOTE_DEFS: { pos: [number, number]; quoteId: KnowledgeQuoteId }[] = [
  { pos: [-17, 34], quoteId: 'stream-single-use' }, // hall, right off the Stairs A/B arrival
  { pos: [-9, 14], quoteId: 'debugging-detective' }, // hall, opposite side of the corridor
  { pos: [-16, -8], quoteId: 'microservice-monolith' }, // hall, just past Room 4's door
  { pos: [-8.5, -38], quoteId: 'java-write-debug' }, // hall, in the old dead stretch
  { pos: [-17.5, -62], quoteId: 'cloud-other-computer' }, // hall, in the old dead stretch
  { pos: [-9.5, -95], quoteId: 'ai-code-review' }, // hall
  { pos: [-16, -126], quoteId: 'undocumented-feature' }, // hall, down by the Stair C end
  { pos: [-48, -23], quoteId: 'kubernetes-cluster' }, // Room 4, flat apron near the screen — no jump needed
  { pos: [-49.3, -14.26], quoteId: 'demo-worked-yesterday' }, // Room 4, row 1 (2 jumps deep)
  { pos: [-46.7, -5.08], quoteId: 'architecture-legacy' }, // Room 4, row 5 (6 jumps deep)
  { pos: [-49.3, 6.39], quoteId: 'ai-confident-wrong' }, // Room 4, row 10 (11 jumps deep)
  { pos: [-48, 17.4], quoteId: 'technical-debt-loan' }, // Room 4, row 15 — the back row, 16 jumps deep (pulled in slightly from the tier's own raw edge — MOVER_CLEARANCE recesses the walkable zone short of it)
  // Two nuggets that sit *on* something rather than on the floor. Neither
  // needed new machinery: getFirstFloorHeightAt already resolves the stage
  // surface and any hallway prop's top, so groundY comes out right and the
  // pickup's own y-tolerance lines up with wherever the robot has to stand.
  // Room 4's podium, beside the DEVOXX letters (which stand at x -48) and
  // under the live-coding screen. The stage is 0.4m — over AUTO_STEP_HEIGHT,
  // so it's a jump, and the stage's own colliders are height-gated at its top
  // exactly like the seat rows, so the jump is what clears them.
  { pos: [-40, -26.5], quoteId: 'live-coding-audience' },
  // On a corridor table — the right-hand furniture row (x -0.4) at the slot
  // local z -30, sitting between the z -62 and z -95 nuggets rather than
  // crowding either. Table tops are jumpable by design (their colliders are
  // height-gated), so this is the hall's equivalent of the podium one.
  { pos: [-0.4, -79], quoteId: 'hallway-track' },
];
const PICKUP_RADIUS = 1.4;
// Tight tolerance, same as SwagRun's booth pickups — safe now that each
// nugget's groundY comes from getFirstFloorHeightAt at its own (x, z)
// instead of a flat assumption, so it's always accurate whether the nugget
// sits on the flat hall/apron or partway up a tier.
const PICKUP_Y_TOLERANCE = 0.4;

// Hazards roam the whole first floor — hall and every real auditorium — not
// just the flat hall rectangle. Their y comes from getFirstFloorHeightAt
// every frame, the same tier-aware height function the robot itself follows,
// so they climb the raked seating instead of clipping through it. Movement
// bounds use isOnFirstFloor — the same real-zone membership check Robot.ts's
// tryMove uses — so they only ever enter a room through its actual doorway,
// same as the player. Speeds and detection radius sit above Level 1's, and
// the bigger map plus tougher, more numerous hazards (able to chase into a
// room) is what makes this level harder, not a tighter timer.
//
// Seven hazards: six down the hall corridor (x=-13), plus one seeded inside
// Room 4 a few meters off its zone center, so entering the room guarantees
// exposure rather than relying on a wanderer drifting in (ROOM_VISIT_CHANCE,
// 40% per leg).
//
// There were ten until 2026-09-29, one per auditorium — but only Room 4 was
// ever built, so the entries for rooms 5, 8 and 9 sat outside every zone in
// FIRST_FLOOR_ZONES. Measured: those three never moved a single centimetre in
// a full round, because every candidate step failed the isOnFirstFloor check
// and bounced them in place. The level has therefore always played with seven.
// Removing them changes nothing a player can see and drops three frozen
// meshes from under the floor. If the other rooms ever get built, re-add one
// spawn each here.
const HAZARD_START: [number, number, number, AttendeeArchetype][] = [
  [-13, 20, 3.4, 'live-coder'],
  [-13, -10, 1.0, 'keynote-legend'],
  [-13, -40, 5.0, 'booth-recruiter'],
  [-13, -70, 0.5, 'java-godfather'],
  [-13, -100, 2.2, 'live-coder'],
  [-13, -130, 4.1, 'keynote-legend'],
  [-45, -15, 1.7, 'booth-recruiter'], // Room 4, native to the room instead of just passing through
];
const HAZARD_RADIUS = 1.0;
const HAZARD_WANDER_SPEED = 2.4; // above Level 1's 2.2
const HAZARD_CHASE_SPEED = 6.2; // above Level 1's 5.8, and above the robot's own unboosted 6 — boost is required to outrun one here
const HAZARD_WANDER_TURN_RATE = 3.0;
const HAZARD_CHASE_TURN_RATE = 2.8;
const HAZARD_WANDER_LEG_MIN = 1.2;
const HAZARD_WANDER_LEG_MAX = 3.0;
const HAZARD_WANDER_MAX_TURN = Math.PI / 2;
const HAZARD_DETECTION_RADIUS = 10; // above Level 1's 9
// `chasing` used to be pure proximity — recomputed fresh every frame from
// distToRobotSq, with no timeout — so a hazard within HAZARD_DETECTION_RADIUS
// never lost interest on its own, and HAZARD_CHASE_SPEED (6.2) already beats
// the robot's own unboosted top speed (6). The user: "once the npcs are
// following you, you are lost... there should be a high chance to lose
// their interest after hitting on you for some time, to be able to escape
// with a fair chance." Now a chase gives up after HAZARD_CHASE_DURATION_MAX
// seconds regardless of distance (matches LunchRush.ts's diners' own
// CHASE_TIMEOUT), then HAZARD_CHASE_GIVEUP_COOLDOWN more seconds of forced
// disinterest — long enough to actually put distance between you, not just
// a one-frame reprieve before it notices you again.
const HAZARD_CHASE_DURATION_MAX = 7;
const HAZARD_CHASE_GIVEUP_COOLDOWN = 5;

// Points a wandering (non-chasing) hazard can occasionally head straight
// for, steering like a chase target rather than picking a random heading —
// without this, a hazard only ever aims roughly at a room while actively
// chasing a robot already inside one, and plain random wander essentially
// never threads a ~2.5m-wide doorway in a 16m-wide hall by chance. This is
// what makes hazards roam the room in practice, not just in principle. Used
// to be one point per room (four small rooms); now that Room 4 alone is
// real-scale, a single center point would
// have every wandering hazard converge on the same spot in a room this big
// — spread across the room's own depth/width instead (apron, two rows either
// side of the aisle, back row), plus one hall point so hazards still
// occasionally beeline to the corridor itself. Room 4's row walls are
// `robotOnly` (see Collider.robotOnly / firstFloorHazardColliders in
// Game.ts) — hazards climb every row exactly like flat ground, so there's no
// hazard-safe depth to avoid seeding here the way there briefly was; a
// hazard can and will patrol all the way to the back row.
const ROOM_WAYPOINTS: { x: number; z: number }[] = [
  { x: FIRST_FLOOR_ROOM4_ZONE.x, z: FIRST_FLOOR_ROOM4_ZONE.z - FIRST_FLOOR_ROOM4_ZONE.halfD + 3 }, // flat apron, near the screen
  { x: FIRST_FLOOR_ROOM4_ZONE.x - FIRST_FLOOR_ROOM4_ZONE.halfW * 0.6, z: FIRST_FLOOR_ROOM4_ZONE.z }, // mid-depth, left of the aisle
  { x: FIRST_FLOOR_ROOM4_ZONE.x + FIRST_FLOOR_ROOM4_ZONE.halfW * 0.6, z: FIRST_FLOOR_ROOM4_ZONE.z }, // mid-depth, right of the aisle
  { x: FIRST_FLOOR_ROOM4_ZONE.x, z: FIRST_FLOOR_ROOM4_ZONE.z + FIRST_FLOOR_ROOM4_ZONE.halfD - 3 }, // back row
  { x: FIRST_FLOOR_CENTER_X, z: -46 }, // the hall itself, roughly its midpoint
];
const ROOM_VISIT_CHANCE = 0.4; // odds a new wander leg becomes a room visit instead of a random-heading leg
const ROOM_VISIT_ARRIVAL_RADIUS = 2.5; // close enough to the visit's waypoint (or lure spot) to call it over
const ROOM_VISIT_MAX_DURATION = 12; // give up and resume normal wander if a doorway proves hard to line up with
// A pickup-triggered lure leg (see the nugget pickup loop in update() below)
// is meant to read as "drawn to the commotion for a moment," not a full
// detour — much shorter than an ordinary room visit. 4-6s felt like the
// right window: long enough to actually see a hazard react and turn toward
// the spot, short enough that it doesn't hijack the rest of a wandering
// hazard's round. 5s splits that range.
const PICKUP_LURE_DURATION = 5;
const HAZARD_WALL_ESCAPE_DURATION = 0.5;
const HAZARD_WALK_CYCLE_RATE = 2.5;
const HAZARD_LEG_SWING = 0.5;
const HAZARD_ARM_SWING_RATIO = 0.6;
const GRIPE_HEIGHT = 2.15;
const GRIPE_DURATION = 2.5;
// Short — see SwagRun.ts's identical constant for why (a 9-18s interval
// meant a hazard barely spoke once per round).
const GRIPE_INTERVAL_MIN = 3;
const GRIPE_INTERVAL_MAX = 6;
const HIT_REACTION_DURATION = 2.0;
// A bubble only actually renders within this distance — see SwagRun.ts's
// identical constant and speechBubble.ts's hasMessage()/visible split.
const SPEECH_VISIBLE_RANGE = 6;
// Droid's topple: a two-phase failure, not Voxxy's single flat stun. Down is
// full control loss; rise lets him turn but not move. Down + rise is ~3.2s
// of lost control vs. Voxxy's 1.2s stun (STUN_DURATION in SwagRun.ts), with
// the same 1.0s grace after each (so a ~4.2s window vs. ~2.2s) — the point
// is a longer, distinctly slower recovery for the tall/deliberate robot.
export const TOPPLE_DURATION = 2.0;
export const TOPPLE_RISE_DURATION = 1.2;
const ROUND_DURATION = 32; // more ground to cover now (a ~180m hall plus Room 4's raked auditorium) and more nuggets to find
const TIME_BONUS_PER_PICKUP = 3;
// Was 0.5s (shorter than Voxxy's POST_STUN_GRACE 1.0s) on the theory that a
// camping hazard needs less extra cooldown since the topple's own down/rise
// window is already generous — that reasoning assumed a single hazard,
// though. Bumped to match Voxxy/Biggy after real playtesting: Level 2 had
// 10 hazards at the time (up from 6; seven since 2026-09-29, see
// HAZARD_START) and hazards actively converge on the player's last pickup,
// so Droid regularly rises surrounded by several at once, not one camper —
// 0.5s wasn't enough to move clear of a crowd already in range.
export const POST_TOPPLE_GRACE = 1.0;
// A couple of solid obstacles left in the corridor — AV carts, solid
// colliders hazards must route around too, same pattern as the Tiny
// rope-maze. Simple box props, no need for the sponsor-booth level of
// detail.
function createAvCart(): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.9, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2e2e33, roughness: 0.6 }),
  );
  body.position.y = 0.45;
  group.add(body);
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.05, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1e }),
  );
  shelf.position.y = 0.75;
  group.add(shelf);
  for (const [dx, dz] of [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]] as const) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(dx, 0.08, dz);
    group.add(wheel);
  }
  return group;
}

export const OBSTACLE_DEFS: { pos: [number, number]; radius: number }[] = [
  { pos: [-13, -31], radius: 0.75 }, // AV cart
  { pos: [-13, -69], radius: 0.75 }, // AV cart, near the far end
];

function createKnowledgeNuggetMesh(): THREE.Object3D {
  const group = new THREE.Group();
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff2c2, emissive: 0xffdd66, emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  group.add(bulb);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3a3a }),
  );
  base.position.y = -0.2;
  group.add(base);

  const halo = createGlowSprite(HALO_BASE_SIZE, 0.55);
  group.add(halo);
  const beacon = createGlowSprite(BEACON_BASE_SIZE, 0.85);
  beacon.position.y = BEACON_HEIGHT;
  group.add(beacon);
  group.userData.glow = halo;
  return group;
}

interface Nugget {
  x: number;
  z: number;
  groundY: number;
  quote: string;
  mesh: THREE.Object3D;
  collected: boolean;
}

interface Hazard {
  x: number;
  z: number;
  heading: number;
  radius: number;
  mesh: THREE.Object3D;
  wanderTarget: number;
  wanderTimer: number;
  // Set while on a deliberate "visit this room" leg (see ROOM_WAYPOINTS) —
  // takes over steering from wanderTarget until arrival, timeout, or a chase
  // interrupts it. Null means an ordinary random-heading wander leg.
  roamTarget: { x: number; z: number } | null;
  roamElapsed: number;
  // How long the current roamTarget leg is allowed to run before giving up
  // (compared against roamElapsed) — ROOM_VISIT_MAX_DURATION for an ordinary
  // room-visit leg, or the shorter PICKUP_LURE_DURATION when the target was
  // set by a nearby Knowledge-nugget pickup instead (see the pickup loop in
  // update()). A per-hazard field rather than a single constant so the two
  // kinds of leg can expire on different schedules while sharing the same
  // roamTarget/roamElapsed steering code.
  roamDuration: number;
  wallEscapeTimer: number;
  // See HAZARD_CHASE_DURATION_MAX's own comment — how long this hazard has
  // been continuously chasing, and (once it gives up) how long it stays
  // uninterested before it can start chasing again.
  chaseTimer: number;
  chaseCooldown: number;
  walkPhase: number;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  bubble: SpeechBubble;
  gripeTimer: number;
}

function findWalkParts(mesh: THREE.Object3D): Pick<Hazard, 'legL' | 'legR' | 'armL' | 'armR'> {
  const parts: Pick<Hazard, 'legL' | 'legR' | 'armL' | 'armR'> = {};
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

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function reflectHeadingOffNormal(heading: number, nx: number, nz: number): number {
  const vx = Math.sin(heading);
  const vz = Math.cos(heading);
  const dot = vx * nx + vz * nz;
  return Math.atan2(vx - 2 * dot * nx, vz - 2 * dot * nz);
}

export class KnowledgeRun {
  readonly group = new THREE.Group();
  private nuggets: Nugget[] = [];
  private hazards: Hazard[] = [];
  // See SwagRun.ts's identical field for why this doesn't start at 0 — set to
  // Droid's own full topple cycle (down + rise + grace, ~4.2s), not a shorter
  // flat number, since a spawn-time hit costs exactly as much recovery time
  // as a mid-round one does.
  private stunCooldown = TOPPLE_DURATION + TOPPLE_RISE_DURATION + POST_TOPPLE_GRACE;
  score = 0;
  timeRemaining = ROUND_DURATION;
  finished = false;
  timeBonus = 0;

  constructor() {
    for (const def of QUOTE_DEFS) {
      const groundY = getFirstFloorHeightAt(def.pos[0], def.pos[1]);
      const mesh = createKnowledgeNuggetMesh();
      mesh.position.set(def.pos[0], groundY + 1.3, def.pos[1]);
      this.group.add(mesh);
      this.nuggets.push({ x: def.pos[0], z: def.pos[1], groundY, quote: KNOWLEDGE_QUOTES[def.quoteId], mesh, collected: false });
    }

    for (const def of OBSTACLE_DEFS) {
      const groundY = getFirstFloorHeightAt(def.pos[0], def.pos[1]);
      const mesh = createAvCart();
      mesh.position.set(def.pos[0], groundY, def.pos[1]);
      this.group.add(mesh);
    }

    for (const [x, z, heading, archetype] of HAZARD_START) {
      const mesh = createAttendeeMesh(archetype);
      mesh.position.set(x, getFirstFloorHeightAt(x, z), z);
      this.group.add(mesh);

      const bubble = createSpeechBubble();
      bubble.sprite.position.y = GRIPE_HEIGHT;
      mesh.add(bubble.sprite);

      this.hazards.push({
        x,
        z,
        heading,
        radius: HAZARD_RADIUS,
        mesh,
        wanderTarget: heading,
        wanderTimer: 0,
        roamTarget: null,
        roamElapsed: 0,
        roamDuration: ROOM_VISIT_MAX_DURATION,
        wallEscapeTimer: 0,
        chaseTimer: 0,
        chaseCooldown: 0,
        walkPhase: Math.random() * Math.PI * 2,
        ...findWalkParts(mesh),
        bubble,
        gripeTimer: GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN),
      });
    }
  }

  /** Live snapshot for the minimap — same shape as SwagRun's swagMarkers. */
  get knowledgeMarkers(): { x: number; z: number; collected: boolean }[] {
    return this.nuggets;
  }

  /**
   * Books a topple that didn't come from an attendee — the wet floor's puddle
   * (Game.ts's zapInPuddle) — on the same stunCooldown an attendee's own hit
   * arms, so a hazard can't restart the topple while Droid is still down or
   * getting up from the zap. Returns false, and the caller skips the topple,
   * while a hit's window is still running — same contract as SwagRun's and
   * LunchRush's registerExternalHit.
   */
  registerExternalHit(): boolean {
    if (this.finished || this.stunCooldown > 0) return false;
    this.stunCooldown = TOPPLE_DURATION + TOPPLE_RISE_DURATION + POST_TOPPLE_GRACE;
    return true;
  }

  /** Advances the round; returns whether the robot toppled this frame (plus its deadpan toast), and any quote just collected. */
  update(dt: number, robot: Robot, colliders: Collider[]): { toppled: boolean; toppleToast?: string; collectedQuote?: string } {
    if (this.finished) return { toppled: false };

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining === 0) {
      this.finished = true;
      return { toppled: false };
    }

    const robotX = robot.position.x;
    const robotZ = robot.position.z;
    const robotY = robot.position.y;
    let collectedQuote: string | undefined;

    for (const n of this.nuggets) {
      if (n.collected) continue;
      n.mesh.rotation.y += dt * 1.2;
      const glow = n.mesh.userData.glow as THREE.Sprite | undefined;
      if (glow) {
        const pulse = 0.85 + 0.15 * Math.sin(n.mesh.rotation.y * 2);
        glow.scale.set(HALO_BASE_SIZE * pulse, HALO_BASE_SIZE * pulse, 1);
      }
      const dx = robotX - n.x;
      const dz = robotZ - n.z;
      const onRightSurface = Math.abs(robotY - n.groundY) < PICKUP_Y_TOLERANCE;
      if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS && onRightSurface) {
        n.collected = true;
        n.mesh.visible = false;
        this.score += 1;
        this.timeRemaining += TIME_BONUS_PER_PICKUP;
        collectedQuote = n.quote;

        // Every hazard not already actively chasing gets pulled toward this
        // pickup's spot for a few seconds — mirrors Lunch Rush's "eating a
        // sandwich near a queued attendee guarantees a chase" behavior.
        // Reuses the existing
        // roamTarget/roamElapsed steering (see ROOM_WAYPOINTS handling below)
        // instead of a second parallel steering system — same arrival/timeout
        // logic, just a shorter PICKUP_LURE_DURATION and a different
        // destination. "Chasing" is recomputed here with the same
        // HAZARD_DETECTION_RADIUS threshold the hazard loop below uses, so
        // this never overrides a hazard actually hunting the robot right now
        // — and if one starts chasing later this same frame, that branch
        // nulls roamTarget unconditionally, so an active chase always wins.
        for (const h of this.hazards) {
          const dxChase = robotX - h.x;
          const dzChase = robotZ - h.z;
          const isChasing = dxChase * dxChase + dzChase * dzChase < HAZARD_DETECTION_RADIUS * HAZARD_DETECTION_RADIUS;
          if (isChasing) continue;
          h.roamTarget = { x: n.x, z: n.z };
          h.roamElapsed = 0;
          h.roamDuration = PICKUP_LURE_DURATION;
        }
      }
    }

    // Same early-finish shape as Level 1 (see SwagRun.ts): every nugget
    // found ends the round now, leftover time converts to points scaled by
    // score.
    if (!this.finished && this.nuggets.every((n) => n.collected)) {
      this.timeBonus = Math.round(this.timeRemaining) * this.score;
      this.score += this.timeBonus;
      this.timeRemaining = 0;
      this.finished = true;
      return { toppled: false, collectedQuote };
    }

    this.stunCooldown = Math.max(0, this.stunCooldown - dt);

    let toppled = false;
    let toppleToast: string | undefined;

    for (const h of this.hazards) {
      const dxToRobot = robotX - h.x;
      const dzToRobot = robotZ - h.z;
      const distToRobotSq = dxToRobot * dxToRobot + dzToRobot * dzToRobot;

      if (h.chaseCooldown > 0) h.chaseCooldown -= dt;
      const withinDetection = distToRobotSq < HAZARD_DETECTION_RADIUS * HAZARD_DETECTION_RADIUS;
      let chasing = withinDetection && h.chaseCooldown <= 0;
      if (chasing) {
        h.chaseTimer += dt;
        if (h.chaseTimer >= HAZARD_CHASE_DURATION_MAX) {
          chasing = false;
          h.chaseTimer = 0;
          h.chaseCooldown = HAZARD_CHASE_GIVEUP_COOLDOWN;
        }
      } else {
        h.chaseTimer = 0;
      }

      if (h.wallEscapeTimer > 0) {
        h.wallEscapeTimer -= dt;
      } else if (chasing) {
        h.roamTarget = null; // a chase always takes priority over a room visit in progress
        const targetHeading = Math.atan2(dxToRobot, dzToRobot);
        const diff = normalizeAngle(targetHeading - h.heading);
        const maxDelta = HAZARD_CHASE_TURN_RATE * dt;
        h.heading += THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
      } else if (h.roamTarget) {
        // Steer straight at the roam target, chase-style, rather than a
        // fixed heading — a fixed heading would overshoot as it approaches
        // and never actually thread the doorway.
        h.roamElapsed += dt;
        const dxRoam = h.roamTarget.x - h.x;
        const dzRoam = h.roamTarget.z - h.z;
        const arrived = dxRoam * dxRoam + dzRoam * dzRoam < ROOM_VISIT_ARRIVAL_RADIUS * ROOM_VISIT_ARRIVAL_RADIUS;
        if (arrived || h.roamElapsed > h.roamDuration) {
          h.roamTarget = null;
          h.wanderTimer = 0; // pick a fresh ordinary leg next frame
        } else {
          const targetHeading = Math.atan2(dxRoam, dzRoam);
          const diff = normalizeAngle(targetHeading - h.heading);
          const maxDelta = HAZARD_WANDER_TURN_RATE * dt;
          h.heading += THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
        }
      } else {
        h.wanderTimer -= dt;
        if (h.wanderTimer <= 0) {
          if (Math.random() < ROOM_VISIT_CHANCE) {
            h.roamTarget = ROOM_WAYPOINTS[Math.floor(Math.random() * ROOM_WAYPOINTS.length)];
            h.roamElapsed = 0;
            h.roamDuration = ROOM_VISIT_MAX_DURATION;
          } else {
            h.wanderTarget = h.heading + (Math.random() * 2 - 1) * HAZARD_WANDER_MAX_TURN;
            h.wanderTimer = HAZARD_WANDER_LEG_MIN + Math.random() * (HAZARD_WANDER_LEG_MAX - HAZARD_WANDER_LEG_MIN);
          }
        }
        if (!h.roamTarget) {
          const diff = normalizeAngle(h.wanderTarget - h.heading);
          const maxDelta = HAZARD_WANDER_TURN_RATE * dt;
          h.heading += THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
        }
      }

      const speed = chasing ? HAZARD_CHASE_SPEED : HAZARD_WANDER_SPEED;
      let nextX = h.x + Math.sin(h.heading) * speed * dt;
      let nextZ = h.z + Math.cos(h.heading) * speed * dt;

      // Real-zone membership, not a rectangle — the same per-axis check
      // Robot.ts's tryMove uses (curX/curZ fixed throughout, so a shared
      // wall between two rooms can't misclassify which one the check means),
      // so a hazard only ever crosses into a room through its actual
      // doorway, same as the player.
      // Attendees are additionally kept out of the two mid-corridor
      // stairwells, which the player can walk down but which dead-end at a
      // closed door — see isInSideStairwell for why one wandering down there
      // is worse than it sounds.
      const canStand = (x: number, z: number) => isOnFirstFloor(x, z) && !isInSideStairwell(x, z);
      const curX = h.x;
      const curZ = h.z;
      let bounced = false;
      if (!canStand(nextX, curZ)) {
        h.heading = -h.heading;
        nextX = curX;
        bounced = true;
      }
      if (!canStand(curX, nextZ)) {
        h.heading = Math.PI - h.heading;
        nextZ = curZ;
        bounced = true;
      }
      if (!canStand(nextX, nextZ)) {
        nextX = curX;
        nextZ = curZ;
        bounced = true;
      }
      for (const c of colliders) {
        const dx = nextX - c.x;
        const dz = nextZ - c.z;
        const minDist = c.radius + h.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;
          nextX = c.x + nx * minDist;
          nextZ = c.z + nz * minDist;
          h.heading = reflectHeadingOffNormal(h.heading, nx, nz);
          bounced = true;
        }
      }

      // NPC-vs-NPC separation: same push-out-along-the-normal technique as
      // the collider loop just above, but against every *other* hazard in
      // this same array instead of a fixed prop. O(n²) is fine at this
      // array's size (seven hazards → 42 pair checks/frame). Deliberately
      // doesn't touch heading/wallEscapeTimer the way a real wall bounce
      // does — this only needs to keep two hazards from visually stacking,
      // not resolve a dense cluster in one frame like a rigid-body solver
      // would. Re-validated against isOnFirstFloor afterward: a push that
      // would land a hazard in the no-man's-land between zones is discarded,
      // leaving the hazard at its pre-push position for this frame instead.
      for (const other of this.hazards) {
        if (other === h) continue;
        const dx = nextX - other.x;
        const dz = nextZ - other.z;
        const minDist = h.radius + other.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const pushedX = other.x + (dx / dist) * minDist;
          const pushedZ = other.z + (dz / dist) * minDist;
          if (canStand(pushedX, pushedZ)) {
            nextX = pushedX;
            nextZ = pushedZ;
          }
        }
      }

      if (bounced) {
        h.wallEscapeTimer = HAZARD_WALL_ESCAPE_DURATION;
        if (!chasing) {
          h.wanderTarget = h.heading;
          h.wanderTimer = HAZARD_WANDER_LEG_MIN;
        }
      }

      h.x = nextX;
      h.z = nextZ;
      // Tier-aware, same as the robot — this is what makes climbing into a
      // room's raked seating work instead of clipping through it.
      h.mesh.position.set(h.x, getFirstFloorHeightAt(h.x, h.z), h.z);
      h.mesh.rotation.y = h.heading;

      h.walkPhase += speed * dt * HAZARD_WALK_CYCLE_RATE;
      const swing = Math.sin(h.walkPhase) * HAZARD_LEG_SWING;
      if (h.legL) h.legL.rotation.x = swing;
      if (h.legR) h.legR.rotation.x = -swing;
      if (h.armL) h.armL.rotation.x = -swing * HAZARD_ARM_SWING_RATIO;
      if (h.armR) h.armR.rotation.x = swing * HAZARD_ARM_SWING_RATIO;

      h.gripeTimer -= dt;
      if (h.gripeTimer <= 0 && !chasing) {
        h.bubble.show(randomConfusedGripe(), GRIPE_DURATION);
        h.gripeTimer = GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN);
      }
      h.bubble.update(dt);
      h.bubble.sprite.visible = h.bubble.hasMessage() && distToRobotSq < SPEECH_VISIBLE_RANGE * SPEECH_VISIBLE_RANGE;

      if (this.stunCooldown <= 0 && distToRobotSq < h.radius * h.radius) {
        toppled = true;
        toppleToast = randomDroidToppleToast();
        this.stunCooldown = TOPPLE_DURATION + TOPPLE_RISE_DURATION + POST_TOPPLE_GRACE;
        h.bubble.show(randomConfusedReaction(), HIT_REACTION_DURATION);
        h.gripeTimer = GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN);
        // Droid doesn't visibly wear knowledge the way Voxxy wears swag — the
        // "drop the last pickup" beat becomes losing a
        // point instead of a worn item coming off.
        this.score = Math.max(0, this.score - 1);
      }
    }

    return { toppled, toppleToast, collectedQuote };
  }
}
