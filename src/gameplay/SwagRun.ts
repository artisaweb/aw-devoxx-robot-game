import * as THREE from 'three';
import { HALL_WIDTH, HALL_DEPTH, Collider, BOOTH_PLATFORM_ZONES } from '../scene/ExhibitionHall';
import { KING_KIOSK_POS, BEER_TAP_POS, BEER_TAP_COLLIDER_RADIUS } from '../scene/sponsorBooths';
import { BeerTap } from '../props/beerTap';
import { Robot, WALL_CLEARANCE } from '../entities/Robot';
import { SwagType, createWorldSwagItem, createWornAccessory, HALO_BASE_SIZE } from './swagAccessories';
import { AttendeeArchetype, createAttendeeMesh } from './attendeeModels';
import { createVendingMachine, createCandyMachine, KIOSK_COLLIDER_RADIUS, CoffeeVendingMachine, CandyGrabbingMachine } from './vendingMachine';
import { createSpeechBubble, SpeechBubble } from './speechBubble';
import { randomGripe, randomHitReaction } from '../text/attendeeDialogue';

// Positions deliberately avoid the column grid (multiples of 10 on both axes)
// and the staircase alcoves near z = -18.5, x = ±10. Each pickup has a real
// identity — what you see on the ground is exactly what ends up worn.
// groundY marks a pickup that sits on top of raised booth furniture (see
// BOOTH_PLATFORM_ZONES) rather than the hall floor — collecting it requires
// actually standing at that height, not just walking underneath (see the
// y-check in the pickup loop below).
// Each booth has its own signature swag type — the
// Goggles Cloud desk-top pickup mirrors RocketMind's jump-desk pickup
// exactly, same zone system, so it carries the same reachability guarantee.
// Positions below were moved alongside their booths for the 1.5x hall
// resize + new Stairs A/B enclosures (see BOOTH_PLATFORM_ZONES's own comment
// in ExhibitionHall.ts) — each is a fresh small clear-offset from its
// booth's new anchor, not a mechanical translate of the old offset, since a
// couple of the old offsets were only safe near the old anchor's position
// (e.g. Vaultius's old 'key' offset would land outside the hall wall from
// its new, much-further-back anchor). Still needs a driven-movement
// re-verification pass, same caution the original comment already called
// for.
const SWAG_ITEM_DEFS: { pos: [number, number]; type: SwagType; groundY?: number }[] = [
  // Nearest generic pickup to Vaultius (-10, 18, moved again since — see
  // its own comment in booths/vaultius.ts) — 'key' is Vaultius's signature
  // item, placed near it; 'cap' appears nowhere else but Miracle Systems'
  // own pickup below.
  { pos: [-13, 15], type: 'key' },
  { pos: [-29, 7.75], type: 'shirt' }, // near Tiny (-30, 6)
  // Nearest generic pickup to Miracle Systems (-30, 24) — 'cap' is Miracle
  // Systems' signature item; Goggles Cloud has its own desk-top sunglasses
  // pickup below instead, so the two types don't collide.
  { pos: [-31, 20.5], type: 'cap' },
  // Near the KING booth's own footprint (40, -11, moved to the outer wall —
  // see its own comment in booths/king.ts) — the glowing arch on its
  // back wall advertises "swag here."
  { pos: [40, -14], type: 'sticker' },
  { pos: [40, -7], type: 'crown' }, // KING's signature item, replacing its old cap
  // Only a second 'sticker' here, not a second sunglasses/shirt — this used
  // to also carry a stray sunglasses pickup (leftover from before the
  // one-signature-item-per-booth redesign) unconnected to any booth, plus a
  // 'shirt' pickup that had drifted to sit right next to Goggles Cloud's
  // own desk (wrong booth's branding — shirt is Tiny's teal/text design, not
  // Goggles Cloud's). Both removed: sunglasses and shirt are now visibly
  // branded to one specific sponsor each, so a stray or misplaced instance reads as a real mistake, not
  // a harmless duplicate — unlike sticker, which stays intentionally
  // generic and can appear anywhere.
  { pos: [8, -15], type: 'sticker' },
  // On top of the RocketMind jump-desk (BOOTH_PLATFORM_ZONES[0]) — the
  // "hide swag in the booths, use jumping to reach it" brainstorm idea.
  // Retyped from 'sticker' to 'drone', RocketMind's own signature item.
  { pos: [BOOTH_PLATFORM_ZONES[0].x, BOOTH_PLATFORM_ZONES[0].z], type: 'drone', groundY: BOOTH_PLATFORM_ZONES[0].height },
  // Mirrors the RocketMind pickup above exactly (same jump-desk system, just
  // BOOTH_PLATFORM_ZONES[1] instead of [0]) — Goggles Cloud's own sunglasses.
  { pos: [BOOTH_PLATFORM_ZONES[1].x, BOOTH_PLATFORM_ZONES[1].z], type: 'sunglasses', groundY: BOOTH_PLATFORM_ZONES[1].height },
];
// Must be smaller than the smallest booth-platform height (0.9) — this is
// "how close does robot.position.y need to be to the pickup's own surface
// height," not a jump-apex margin. Too large and standing on the floor right
// next to an elevated pickup would still count, defeating the whole "jump to
// reach it" point.
const PICKUP_Y_TOLERANCE = 0.4;

// A single "JAVA" vending machine: touch it to top up energy. Its red/green
// light communicates the cooldown directly (one shared resource now, rather
// than three redundant cups) instead of the machine just vanishing.
export const COFFEE_MACHINE_POS: [number, number] = [0, -8];
// Must clear KIOSK_COLLIDER_RADIUS + WALL_CLEARANCE — the closest the
// robot's center can ever actually get, per tryMove's collider pushout in
// Robot.ts. Any smaller and the boost becomes physically unreachable no
// matter how the robot approaches.
const COFFEE_RADIUS = KIOSK_COLLIDER_RADIUS + WALL_CLEARANCE + 0.15;
const COFFEE_BOOST = 40; // energy restored
const COFFEE_COOLDOWN = 8; // seconds before the machine is available again

// KING's "free candy" machine (sponsor-booths brainstorm) — a sugar rush: a
// smaller energy restore than JAVA's plus a small time bonus, rather than
// just duplicating the coffee machine's effect. Time bonus < cooldown so
// camping it is net negative time, same self-limiting shape as swag pickups.
// Same reachability requirement as COFFEE_RADIUS above.
const CANDY_RADIUS = KIOSK_COLLIDER_RADIUS + WALL_CLEARANCE + 0.15;
const CANDY_ENERGY_BOOST = 20; // half of JAVA's — candy's real value is the time bonus
const CANDY_TIME_BONUS = 5;
const CANDY_COOLDOWN = 8;

// The beer tap (sponsorBooths.ts, a standalone landmark shared with Level 3)
// was built with no gameplay hook at all — the user: "it looks like it has no
// effect now." Level 3 restores hunger there (see LunchRush.ts, a real risk
// vs. reward — see robot.applyTipsy()'s own doc comment for the actual
// effect), but Level 1 has no hunger to restore, so per the user's own call
// ("the negative effect can also be added to level 1, without filling the
// hungry bar as it is no concept there") this is pure downside here — a
// landmark to notice and route around, or touch for the joke, not a pickup
// worth detouring for. Same reachability requirement as every other kiosk.
const BEER_TAP_RADIUS = BEER_TAP_COLLIDER_RADIUS + WALL_CLEARANCE + 0.15;
const BEER_TAP_TIPSY_DURATION = 5;
const BEER_TAP_COOLDOWN = 8; // re-trigger guard, same shape as the kiosks above — not a "use it again for more" resource

// Wandering attendees (carrying a drink) rather than static spill zones —
// touching one "splashes" the robot. Each gets an initial position + heading;
// they bounce off the hall walls (the full HALL_WIDTH/HALL_DEPTH extent, not
// a local territory) and turn a little at random so their paths aren't
// perfectly predictable. Each is a distinct "conference hero" archetype —
// generic, only loosely inspired by real speakers' style, never a likeness —
// rather than an identical blue capsule.
//
// Spread one per quadrant of the (since-enlarged) hall rather than clustered
// in a small central box (was x=[-15,15], z=[-5,12] — booths/kiosks/pickups
// moved for the 1.5x hall resize, but hazard spawn/wander positions weren't
// touched in that pass). Random-walk wander diffuses
// slowly relative to a round's length, so the old cluster left the outer
// thirds of the map — where booths/pickups now actually are — with far less
// hazard traffic than the center. Positions offset from round multiples of
// 10 (the column grid) and re-checked against the *actual* groundColliders
// composition Game.ts wires hazards against (columns + booths + booth
// platforms + Stairs A/B enclosures + lunch tables + both kiosks) — an
// earlier pass here checked only columns + booths and missed that the two
// z=-15 spots actually overlapped the Stairs A/B enclosure walls (x = ∓24)
// by 0.7m. The back two are now z=-21 instead, clearing everything by 2.6m+;
// the front two (z=15) were already clear (3.25m+).
const HAZARD_START: [number, number, number, AttendeeArchetype][] = [
  [-30, -21, 0.3, 'live-coder'],
  [30, -21, 2.1, 'java-godfather'],
  [-25, 15, 4.0, 'keynote-legend'],
  [25, 15, 5.2, 'booth-recruiter'],
];

const PICKUP_RADIUS = 1.4;
const HAZARD_RADIUS = 1.0;
// Hazards never leave y=0 (see their per-frame position.set below), so
// standing on a jump platform (BOOTH_PLATFORM_ZONES — 0.9m+) is a genuine
// escape only if the stun check also gates on height, not just x/z distance.
// Must stay below every platform height or the escape they exist for
// wouldn't work.
const HAZARD_STUN_Y_TOLERANCE = 0.6;
const HAZARD_WANDER_SPEED = 2.2; // meters/second — deliberately slower than chase, so the
const HAZARD_CHASE_SPEED = 5.8; // speed change itself signals "it's noticed you". Just under
// the robot's unloaded walk speed (6) — outrunnable early, but carrying swag slows the robot
// down (see Robot's load penalty) until a chasing hazard is faster than you, forcing evasion.
const HAZARD_WANDER_TURN_RATE = 3.0; // radians/second — fast enough to finish a turn well
// within one wander leg, so it actually travels in the new direction instead of just spinning
const HAZARD_CHASE_TURN_RATE = 2.8; // radians/second, max heading change while chasing
const HAZARD_WANDER_LEG_MIN = 1.5; // seconds, how long a wander leg holds before picking a new one
const HAZARD_WANDER_LEG_MAX = 3.5;
const HAZARD_WANDER_MAX_TURN = Math.PI / 2; // new leg is at most a 90 degree turn from the current
// heading, not a full random direction — keeps paths meandering rather than reversing in place
const HAZARD_DETECTION_RADIUS = 9; // starts chasing once the robot is this close
const HAZARD_WALL_ESCAPE_DURATION = 0.5; // seconds a hazard just travels the bounce heading, ignoring chase/wander
const HAZARD_WALK_CYCLE_RATE = 2.5; // how fast the leg-swing phase advances per meter/second of speed
const HAZARD_LEG_SWING = 0.5; // radians, max leg swing
const HAZARD_ARM_SWING_RATIO = 0.6; // arm swing relative to leg swing, opposite phase
const GRIPE_HEIGHT = 2.15; // just above the head, clear of any worn cap
const GRIPE_DURATION = 2.5; // seconds the bubble stays up
// Short — a longer interval would mean a hazard barely speaks once during a
// ~20s round, and even then only if the player happens to be nearby (see
// SPEECH_VISIBLE_RANGE below).
const GRIPE_INTERVAL_MIN = 3;
const GRIPE_INTERVAL_MAX = 6;
const HIT_REACTION_DURATION = 2.0; // slightly snappier than an ambient gripe — a quick reaction, not a rant
// A bubble a hazard is "saying" only actually renders within this distance —
// unreadable from across the hall anyway, so there's no point showing it
// (see speechBubble.ts's hasMessage()/visible split this relies on). Just
// under HAZARD_DETECTION_RADIUS, so a hazard becoming legible to read lines
// up roughly with it becoming spatially relevant.
const SPEECH_VISIBLE_RANGE = 8;
export const STUN_DURATION = 1.2; // seconds
const ROUND_DURATION = 20; // seconds — kept low since pickups add time back
const TIME_BONUS_PER_SWAG = 3; // seconds added to the clock per pickup, Pac-Man-style
export const POST_STUN_GRACE = 1.0; // seconds of immunity after a stun ends, to avoid a stun-lock

interface Pickup {
  x: number;
  z: number;
  groundY: number;
  type: SwagType;
  colorIndex: number;
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
  wornCounts: Partial<Record<SwagType, number>>;
  // Briefly overrides chase/wander steering right after bouncing off a wall,
  // so the escape heading actually gets acted on instead of being discarded
  // the very next frame by chase re-aiming straight back at the wall.
  wallEscapeTimer: number;
  // Simple procedural walk cycle — advances with distance traveled, driving
  // the tagged leg/arm parts found on the mesh (see attendeeModels.ts).
  walkPhase: number;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  bubble: SpeechBubble;
  gripeTimer: number;
}

/** Finds the leg/arm parts attendeeModels.ts tags for the walk-cycle animation. */
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

/** Reflects a heading's velocity direction (sin, cos) across an outward normal (nx, nz). */
function reflectHeadingOffNormal(heading: number, nx: number, nz: number): number {
  const vx = Math.sin(heading);
  const vz = Math.cos(heading);
  const dot = vx * nx + vz * nz;
  return Math.atan2(vx - 2 * dot * nx, vz - 2 * dot * nz);
}

export class SwagRun {
  readonly group = new THREE.Group();
  private pickups: Pickup[] = [];
  private coffeeMachine: CoffeeVendingMachine;
  private coffeeCooldown = 0;
  private candyMachine: CandyGrabbingMachine;
  private candyCooldown = 0;
  private beerTapCooldown = 0;
  private hazards: Hazard[] = [];
  // Starts at this level's own full recovery-cycle length, not 0 — a fresh
  // round shouldn't let a hazard already standing at the spawn point hit the
  // player before they've even moved. Matching the real post-hit window
  // (rather than a shorter flat number) means spawn grace is never less time
  // than the player would get after surviving a hit mid-round.
  private stunCooldown = STUN_DURATION + POST_STUN_GRACE;
  score = 0;
  timeRemaining = ROUND_DURATION;
  finished = false;
  /** Set once, only on an early finish (all swag found) — 0 on a plain time-out. */
  timeBonus = 0;

  constructor() {
    let stickerColorCounter = 0;
    for (const def of SWAG_ITEM_DEFS) {
      const colorIndex = def.type === 'sticker' ? stickerColorCounter++ : 0;
      const groundY = def.groundY ?? 0;
      const mesh = createWorldSwagItem(def.type, colorIndex);
      mesh.position.set(def.pos[0], groundY + 1, def.pos[1]);
      this.group.add(mesh);
      this.pickups.push({ x: def.pos[0], z: def.pos[1], groundY, type: def.type, colorIndex, mesh, collected: false });
    }

    this.coffeeMachine = createVendingMachine();
    this.coffeeMachine.object.position.set(COFFEE_MACHINE_POS[0], 0, COFFEE_MACHINE_POS[1]);
    this.group.add(this.coffeeMachine.object);

    this.candyMachine = createCandyMachine();
    this.candyMachine.object.position.set(KING_KIOSK_POS[0], 0, KING_KIOSK_POS[1]);
    this.group.add(this.candyMachine.object);

    for (const [x, z, heading, archetype] of HAZARD_START) {
      const mesh = createAttendeeMesh(archetype);
      mesh.position.set(x, 0, z);
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
        wornCounts: {},
        wallEscapeTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
        ...findWalkParts(mesh),
        bubble,
        // Staggered per hazard so all four don't gripe in sync.
        gripeTimer: GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN),
      });
    }
  }

  /** Live snapshot for the minimap — same pickup objects, read-only from outside. */
  get swagMarkers(): { x: number; z: number; collected: boolean }[] {
    return this.pickups;
  }

  /**
   * Books a hit that didn't come from an attendee — the wet floor's puddle
   * (Game.ts's zapInPuddle) — on the same stunCooldown an attendee's own hit
   * arms. Without it the zap stunned Voxxy with that window still open, so an
   * attendee could land a second hit mid-zap (a fresh stun, and another piece
   * of swag gone) — exactly what POST_STUN_GRACE exists to prevent. Returns
   * false, and the caller skips the stun, while a hit's window is still
   * running — same contract as LunchRush's registerExternalHit.
   */
  registerExternalHit(): boolean {
    if (this.finished || this.stunCooldown > 0) return false;
    this.stunCooldown = STUN_DURATION + POST_STUN_GRACE;
    return true;
  }

  /** Advances the round — returns whether the robot was just splashed by a hazard, and whether a pickup was just collected (for the SFX layer, see Game.ts). */
  update(dt: number, robot: Robot, colliders: Collider[], beerTap: BeerTap): { stunned: boolean; pickedUp: boolean; drankBeer?: boolean; rechargedFrom?: 'coffee' | 'candy' } {
    if (this.finished) return { stunned: false, pickedUp: false };

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    if (this.timeRemaining === 0) {
      this.finished = true;
      return { stunned: false, pickedUp: false };
    }

    const robotX = robot.position.x;
    const robotZ = robot.position.z;
    const robotY = robot.position.y;
    let pickedUp = false;

    for (const p of this.pickups) {
      if (p.collected) continue;
      p.mesh.rotation.y += dt * 1.5;
      // Reuse the spin angle already tracked above as a free time source for
      // the halo's pulse, rather than keeping a separate elapsed-time field.
      const glow = p.mesh.userData.glow as THREE.Sprite | undefined;
      if (glow) {
        const pulse = 0.85 + 0.15 * Math.sin(p.mesh.rotation.y * 2);
        glow.scale.set(HALO_BASE_SIZE * pulse, HALO_BASE_SIZE * pulse, 1);
      }
      const dx = robotX - p.x;
      const dz = robotZ - p.z;
      const onRightSurface = Math.abs(robotY - p.groundY) < PICKUP_Y_TOLERANCE;
      if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS && onRightSurface) {
        p.collected = true;
        p.mesh.visible = false;
        robot.addAccessory(p.type, p.colorIndex);
        this.score += 1;
        this.timeRemaining += TIME_BONUS_PER_SWAG;
        pickedUp = true;
      }
    }

    // Every piece found — end the round right now instead of waiting out the
    // clock, same as a normal time-out. Leftover time converts to points,
    // scaled by how much swag actually survived to the end: dropped items
    // never respawn, so getting splashed after finding everything still
    // costs you here too, rather than the round quietly finishing at full
    // value regardless of what a hazard took.
    if (!this.finished && this.pickups.every((p) => p.collected)) {
      this.timeBonus = Math.round(this.timeRemaining) * this.score;
      this.score += this.timeBonus;
      this.timeRemaining = 0;
      this.finished = true;
      return { stunned: false, pickedUp };
    }

    // Which kiosk topped the robot up this frame, for Game.ts to sound. The
    // two are at opposite ends of the hall, so they can't both fire in one
    // frame and one slot is enough.
    let rechargedFrom: 'coffee' | 'candy' | undefined;

    this.coffeeMachine.update(dt);
    this.coffeeCooldown = Math.max(0, this.coffeeCooldown - dt);
    const coffeeAvailable = this.coffeeCooldown <= 0;
    this.coffeeMachine.setOutOfStock(!coffeeAvailable);
    if (coffeeAvailable) {
      const dx = robotX - COFFEE_MACHINE_POS[0];
      const dz = robotZ - COFFEE_MACHINE_POS[1];
      if (dx * dx + dz * dz < COFFEE_RADIUS * COFFEE_RADIUS) {
        robot.restoreEnergy(COFFEE_BOOST);
        this.coffeeCooldown = COFFEE_COOLDOWN;
        rechargedFrom = 'coffee';
        // Fire-and-forget — the energy restore above is immediate, matching
        // the existing arcade-quick refuel feel; the brew animation (~10s)
        // is purely a visual flourish, not gated on gameplay.
        if (!this.coffeeMachine.busy) void this.coffeeMachine.activate();
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
        this.timeRemaining += CANDY_TIME_BONUS;
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
        robot.applyTipsy(BEER_TAP_TIPSY_DURATION);
        this.beerTapCooldown = BEER_TAP_COOLDOWN;
        drankBeer = true;
        if (!beerTap.busy) void beerTap.activate();
      }
    }

    this.stunCooldown = Math.max(0, this.stunCooldown - dt);

    const halfW = HALL_WIDTH / 2 - 1;
    const halfD = HALL_DEPTH / 2 - 1;
    let stunned = false;

    for (const h of this.hazards) {
      const dxToRobot = robotX - h.x;
      const dzToRobot = robotZ - h.z;
      const distToRobotSq = dxToRobot * dxToRobot + dzToRobot * dzToRobot;
      const chasing = distToRobotSq < HAZARD_DETECTION_RADIUS * HAZARD_DETECTION_RADIUS;

      if (h.wallEscapeTimer > 0) {
        // Just bounced off a wall — hold the escape heading set below instead
        // of letting chase/wander immediately re-aim back into the wall,
        // which is what made hazards get stuck hugging it.
        h.wallEscapeTimer -= dt;
      } else if (chasing) {
        const targetHeading = Math.atan2(dxToRobot, dzToRobot);
        const diff = normalizeAngle(targetHeading - h.heading);
        const maxDelta = HAZARD_CHASE_TURN_RATE * dt;
        h.heading += THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
      } else {
        h.wanderTimer -= dt;
        if (h.wanderTimer <= 0) {
          h.wanderTarget = h.heading + (Math.random() * 2 - 1) * HAZARD_WANDER_MAX_TURN;
          h.wanderTimer =
            HAZARD_WANDER_LEG_MIN + Math.random() * (HAZARD_WANDER_LEG_MAX - HAZARD_WANDER_LEG_MIN);
        }
        const diff = normalizeAngle(h.wanderTarget - h.heading);
        const maxDelta = HAZARD_WANDER_TURN_RATE * dt;
        h.heading += THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
      }

      const speed = chasing ? HAZARD_CHASE_SPEED : HAZARD_WANDER_SPEED;
      let nextX = h.x + Math.sin(h.heading) * speed * dt;
      let nextZ = h.z + Math.cos(h.heading) * speed * dt;

      // Velocity is (sin(heading), cos(heading)) for (dx, dz). An X-wall hit
      // must flip dx while keeping dz (heading' = -heading); a Z-wall hit
      // must flip dz while keeping dx (heading' = PI - heading).
      let bounced = false;
      if (nextX < -halfW || nextX > halfW) {
        h.heading = -h.heading;
        nextX = THREE.MathUtils.clamp(nextX, -halfW, halfW);
        bounced = true;
      }
      if (nextZ < -halfD || nextZ > halfD) {
        h.heading = Math.PI - h.heading;
        nextZ = THREE.MathUtils.clamp(nextZ, -halfD, halfD);
        bounced = true;
      }
      // Solid obstacles (columns, sponsor-booth landmarks, kiosks) — reflect
      // the heading off the obstacle's outward normal rather than just
      // pushing the position out, which would leave the heading pointed
      // into the obstacle and cause the same kind of sticking the walls had.
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

      // NPC-vs-NPC separation — same push-out-along-the-normal technique as
      // the collider loop just above, but against every *other* hazard in
      // this array instead of a fixed prop. O(n²) is fine at four hazards.
      // Deliberately doesn't touch heading/wallEscapeTimer the way a real
      // wall bounce does — this only needs to keep two hazards from visually
      // stacking, not resolve a dense cluster in one frame like a
      // rigid-body solver would. Re-clamped to the hall bounds afterward,
      // since a push near a wall could otherwise shove a hazard out past
      // halfW/halfD.
      for (const other of this.hazards) {
        if (other === h) continue;
        const dx = nextX - other.x;
        const dz = nextZ - other.z;
        const minDist = h.radius + other.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          nextX = other.x + (dx / dist) * minDist;
          nextZ = other.z + (dz / dist) * minDist;
        }
      }
      nextX = THREE.MathUtils.clamp(nextX, -halfW, halfW);
      nextZ = THREE.MathUtils.clamp(nextZ, -halfD, halfD);

      if (bounced) {
        h.wallEscapeTimer = HAZARD_WALL_ESCAPE_DURATION;
        if (!chasing) {
          // Force a fresh wander leg too, so it doesn't resume steering
          // toward the wall the moment the escape window ends.
          h.wanderTarget = h.heading;
          h.wanderTimer = HAZARD_WANDER_LEG_MIN;
        }
      }

      h.x = nextX;
      h.z = nextZ;
      h.mesh.position.set(h.x, 0, h.z);
      h.mesh.rotation.y = h.heading;

      h.walkPhase += speed * dt * HAZARD_WALK_CYCLE_RATE;
      const swing = Math.sin(h.walkPhase) * HAZARD_LEG_SWING;
      if (h.legL) h.legL.rotation.x = swing;
      if (h.legR) h.legR.rotation.x = -swing;
      if (h.armL) h.armL.rotation.x = -swing * HAZARD_ARM_SWING_RATIO;
      if (h.armR) h.armR.rotation.x = swing * HAZARD_ARM_SWING_RATIO;

      // Ambient gripe bubble — pure flavor, no gameplay effect. Doesn't fire
      // while chasing (mid-chase is not the moment for a crab-sandwich rant).
      h.gripeTimer -= dt;
      if (h.gripeTimer <= 0 && !chasing) {
        h.bubble.show(randomGripe(), GRIPE_DURATION);
        h.gripeTimer = GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN);
      }
      h.bubble.update(dt);
      h.bubble.sprite.visible = h.bubble.hasMessage() && distToRobotSq < SPEECH_VISIBLE_RANGE * SPEECH_VISIBLE_RANGE;

      const onHazardLevel = Math.abs(robotY - h.mesh.position.y) < HAZARD_STUN_Y_TOLERANCE;
      if (this.stunCooldown <= 0 && onHazardLevel && distToRobotSq < h.radius * h.radius) {
        stunned = true;
        this.stunCooldown = STUN_DURATION + POST_STUN_GRACE;
        h.bubble.show(randomHitReaction(), HIT_REACTION_DURATION);
        // Push the next ambient gripe out so it doesn't immediately overwrite
        // the hit reaction a moment later.
        h.gripeTimer = GRIPE_INTERVAL_MIN + Math.random() * (GRIPE_INTERVAL_MAX - GRIPE_INTERVAL_MIN);
        const dropped = robot.dropLastAccessory();
        if (dropped) {
          this.score = Math.max(0, this.score - 1); // splashed — drop that exact piece of swag
          const slot = h.wornCounts[dropped.type] ?? 0;
          h.mesh.add(createWornAccessory(dropped.type, 'hazard', dropped.colorIndex, slot));
          h.wornCounts[dropped.type] = slot + 1; // ...and the attendee starts wearing it
        }
      }
    }

    return { stunned, pickedUp, drankBeer, rechargedFrom };
  }
}
