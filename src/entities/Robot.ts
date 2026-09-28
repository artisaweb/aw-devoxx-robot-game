import * as THREE from 'three';
import { InputManager } from '../input/InputManager';
import {
  Collider,
  Floor,
  HALL_WIDTH,
  HALL_DEPTH,
  DOORWAY_WIDTH,
  FOYER_WIDTH,
  FOYER_DEPTH,
  MOVER_CLEARANCE,
  getGroundFloorHeightAt,
  getFirstFloorHeightAt,
  isOnFirstFloor,
} from '../scene/ExhibitionHall';
import { createVoxxyMesh, loadRobotAsset, RobotAnimationName } from './voxxyModel';
import { SwagType, HEAD_SLOT_TYPES, createWornAccessory, createGlowSprite, createTipsyBugSprite } from '../gameplay/swagAccessories';
import { createSpeechBubble, SpeechBubble } from '../gameplay/speechBubble';

const MOVE_SPEED = 6; // meters/second
const BOOST_MULTIPLIER = 1.8;
const TURN_SPEED = Math.PI; // radians/second
export const ROBOT_RADIUS = 0.6; // collision radius — independent of the visual model's exact geometry
// Every collision surface (flat walls, and circular props — columns, booths,
// kiosks) gets extra clearance beyond ROBOT_RADIUS: the rigged model's arms
// swing outward mid walk-cycle well past the body's own collision circle, so
// clamping to ROBOT_RADIUS alone still lets a swinging arm visibly poke
// through whatever the torso was correctly stopped short of, walls and props
// alike. Sourced from ExhibitionHall.ts's MOVER_CLEARANCE (not computed
// independently here) so the ground floor's collider pushout and the first
// floor's room-wall recession always agree on how much clearance a mover
// needs. Re-exported here so gameplay code that places an interactive object
// (a kiosk you must walk up to and touch) can size its trigger radius to
// comfortably exceed it — otherwise the collider pushout keeps the robot's
// center farther away than the trigger radius ever checks, and the
// interaction becomes physically unreachable.
export const WALL_CLEARANCE = MOVER_CLEARANCE;
export const GROUND_Y = 0; // baseline hall floor height; voxxyModel's root sits at feet (local y = 0)
const JUMP_VELOCITY = 7; // meters/second, initial upward speed
const GRAVITY = 18; // meters/second^2
const LEDGE_CLEAR_MARGIN = 0.15; // how close to a ledge's height you must be (mid-jump) to climb onto it
const LEDGE_FALL_DELAY = 0.35; // seconds of "cartoon pause" after walking off a ledge, before gravity takes over
// Height changes at or under this auto-climb on foot, no jump needed (real
// stairs, e.g. the first floor's raked seating tiers); anything taller is a
// real ledge and stays jump-gated (the foyer's 1.0m step-up, the sponsor
// booths' 0.9m platforms — both comfortably above this).
const AUTO_STEP_HEIGHT = 0.3;

const ENERGY_MAX = 100;
const ENERGY_DRAIN_RATE = 35; // per second while boosting
const ENERGY_REGEN_RATE = 18; // per second while not boosting
const ENERGY_RESUME_THRESHOLD = 25; // must recover to at least this before boosting again after hitting 0
const JUMP_ENERGY_COST = 20; // flat cost per jump — shares the boost's energy pool
// Shown when a fresh jump/boost press can't go through for lack of energy —
// "the robot is too sleepy/low on charge to do that right now" rather than
// input silently doing nothing. Height differs per profile since the
// placeholder and the real .glb models aren't the same size (see
// swagAccessories.ts's VOXXY_SPOTS/VOXXY_REAL_MODEL_SPOTS cap-height notes);
// scaled by growthScale too so it still clears Biggy's head once he's grown.
const SLEEPY_TEXT = 'Zzz...';
const SLEEPY_DURATION = 1.2;
const SLEEPY_Y_PLACEHOLDER = 2.5;
// Was a single flat 3.1 for every real model — tuned against Voxxy's own
// baseBodyScale (1.7) and just happened to still clear Biggy's head too
// (1.6, close enough), but sat visibly too low over Droid's (1.9, notably
// taller). A margin scaled off ROBOT_HEIGHT alone (1.4 above baseBodyScale)
// still wasn't enough clearance for Droid once checked against the actual
// render — his blocky head sits higher above baseBodyScale's reference
// point than Voxxy's or Biggy's do, so the margin needs its own per-robot
// value rather than one shared number.
const SLEEPY_MARGIN_ABOVE_HEAD: Record<string, number> = { voxxy: 1.4, biggy: 1.4, droid: 2.3 };
const DEFAULT_SLEEPY_MARGIN_ABOVE_HEAD = 1.4;

// "Tipsy" — the beer tap's negative effect (see SwagRun.ts/LunchRush.ts for
// where it's actually triggered). The user: a landmark that gives something back
// (hunger in Level 3) but at a real cost, and a standalone hazard-ish detail
// in Level 1 (no hunger there to restore, so it's pure downside — something
// to notice and route around, or touch for the joke). Reuses the same
// per-robot head-height math as sleepyBubble (see SLEEPY_MARGIN_ABOVE_HEAD)
// for where the "bugs" orbit, rather than a second parallel height table.
const TIPSY_WOBBLE_AMPLITUDE = 0.6; // radians the actual movement/facing direction swings off the player's steering
const TIPSY_WOBBLE_RATE = 3; // radians/second the wobble oscillates at
const TIPSY_BUG_COUNT = 3;
const TIPSY_BUG_ORBIT_RADIUS = 0.55;
const TIPSY_BUG_ORBIT_SPEED = 5; // radians/second

const LOAD_PENALTY_PER_ITEM = 0.05; // 5% slower per carried item
const MIN_LOAD_FACTOR = 0.5; // never slower than half speed, however loaded

// Biggy's "Lunch Rush" growth (see docs/game-design.md "Level 3" and
// docs/robot-characteristics.md) — every sandwich makes him permanently
// bigger via grow(), which this file folds into real movement cost (speed,
// turn rate, acceleration, collision size) rather than leaving it a purely
// visual/HUD number. This is the Realism rules-alignment fix from the design
// doc: growth needed to cost more than a flat top-speed penalty. Voxxy and
// Droid never call grow(), so sizeScale stays 1 and none of this applies to
// them.
const MAX_SIZE_SCALE = 2.6; // clamp so a very long endless run doesn't grow Biggy into something unplayable
// meters/second^2 at size 1 — fast enough that Voxxy/Droid never perceive it
// (full speed reached in well under a frame's worth of visible ramp-up).
// Dividing this by sizeScale as Biggy grows is what makes him "accelerate and
// brake slowly" — an approximation of real momentum without pulling in a
// physics engine, matching how every other collision in this game is plain
// clamp/push-out math rather than cannon-es.
const BASE_ACCEL = 40;

const STUN_COLOR = 0x3a6ea5;
// Half-period of the post-hit invincibility blink, in seconds — fast enough
// to read as "flashing" rather than "fading," slow enough not to look like a
// rendering glitch.
const INVINCIBLE_BLINK_INTERVAL = 0.1;
const INVINCIBLE_BLINK_OPACITY = 0.35;
const ANIM_CROSSFADE = 0.15; // seconds

// Boost VFX: a steady core glow plus a small pooled ember-particle trail,
// both built from the same shared sprite the swag pickups already glow with
// (just re-tinted) rather than a new texture. A single pulsing sprite read as
// a flat glowing blob next to the now much higher-fidelity rigged model — the
// particles (spawn continuously while boosting, drift back/up, cool from
// hot-yellow to ember-red, shrink and fade over their own lifetime
// independent of the boost toggle) are what actually sells "fire."
const BOOST_CORE_COLOR = 0xff8a2a;
const BOOST_CORE_SIZE = 0.32;
const BOOST_CORE_FLICKER = 0.12; // fraction of size, pulsing
// Sized to comfortably cover the boost trail and a jump burst overlapping
// (e.g. jumping while already boosting) without either starving the other.
const BOOST_PARTICLE_POOL = 32;
const BOOST_PARTICLE_SPAWN_INTERVAL = 0.025; // seconds between spawns while boosting (40/s)
const BOOST_PARTICLE_LIFE_MIN = 0.32;
const BOOST_PARTICLE_LIFE_MAX = 0.55;
// Noticeably bigger than the core at spawn — small dim embers read as one
// blob together with it. The camera chases from directly behind, so motion
// along its view axis (world Z here) foreshortens almost to nothing; the
// spawn jitter and velocity spread below are weighted toward X/Y (screen
// left-right/up-down) rather than Z for exactly that reason.
const BOOST_PARTICLE_SIZE_MIN = 0.24;
const BOOST_PARTICLE_SIZE_MAX = 0.42;
const BOOST_PARTICLE_HOT = new THREE.Color(0xfff2b8); // freshly spawned
const BOOST_PARTICLE_COOL = new THREE.Color(0xb8280f); // about to die

// Jump-launch VFX: a one-shot burst from each hand (not a trail) fired the
// instant the jump input registers — same particle pool/palette as the boost
// trail (no new texture), but a different placement (under the arms, not the
// feet) and a different trigger (an instant burst on launch, not continuous
// while held) so it reads as its own thing rather than boost's effect
// reappearing in a second context.
const JUMP_BURST_COUNT_PER_ARM = 7;
const JUMP_BURST_LIFE_MIN = 0.22;
const JUMP_BURST_LIFE_MAX = 0.38;
const JUMP_BURST_SIZE_MIN = 0.2;
const JUMP_BURST_SIZE_MAX = 0.36;

// Both VFX above spawn from generic feet-trail/hand-burst points tuned
// against Voxxy's (and Droid's) humanoid silhouette — arms and feet. Biggy
// has neither in the same sense; instead he has three exhaust ports molded
// into his back, and per the user's call, boost should trail from the middle one
// while jump bursts from the two flanking ones, not from his (mostly
// stationary) arms. Positions measured directly off the actual mesh —
// Blender raycast from a straight-on back-view camera through each vent's
// pixel center, same ground-truth technique as his neck-pivot fix — rather
// than estimated from the reference photos, which were shot at an angle. All
// three are in the same unscaled, robot-local-unit space as the default
// origins above (baseBodyScale already baked in; only growthScale reapplied
// per-frame in applyBodyScale()).
// Measured off the actual mesh surface, then pushed further out behind him
// than that raw measurement — every VFX sprite here uses the engine default
// depthTest: true, and against Biggy's own curved belly (unlike Voxxy/
// Droid's generic points, which already sit in open air well clear of their
// slimmer bodies) even the normal-direction offset from the surface point
// wasn't enough clearance: the round belly's silhouette still won the depth
// test from most of the camera's approach angles, rendering nothing.
// Confirmed empirically in the live game (rendered with depthTest forced off
// to locate the vents, then walked the offset out step by step with it back
// on until each sprite reliably won its depth test again).
const BIGGY_EXHAUST_MID = new THREE.Vector3(0, 1.08, -0.85);
const BIGGY_EXHAUST_L = new THREE.Vector3(-0.32, 1.2, -0.95);
const BIGGY_EXHAUST_R = new THREE.Vector3(0.32, 1.2, -0.95);

// The generic (Voxxy/Droid) origins — low-and-behind for the boost trail,
// under each hand for the jump burst.
const DEFAULT_BOOST_ORIGIN = new THREE.Vector3(0, 0.18, -0.45);
const DEFAULT_JUMP_BURST_ORIGIN_L = new THREE.Vector3(-0.42, 0.35, 0.05);
const DEFAULT_JUMP_BURST_ORIGIN_R = new THREE.Vector3(0.42, 0.35, 0.05);

// Growth VFX (Biggy eating a sandwich, see grow()): a brief squash-pop
// overshoot on top of the real new scale, plus a sparkle burst radiating out
// from the belly — reusing the same particle pool/palette as the boost/jump
// effects above (no new texture) but a distinct placement and motion
// (centered, radiating outward in every direction rather than a directional
// trail/burst) so growth reads as its own moment, not a recolored boost.
// Without this, grow() was an instant, silent scale-snap — no feedback that
// something just happened at the exact moment it did.
const GROWTH_PULSE_DURATION = 0.35; // seconds
const GROWTH_PULSE_OVERSHOOT = 0.18; // fraction of scale, eased back down over the duration
const GROWTH_BURST_COUNT = 12;
const GROWTH_BURST_LIFE_MIN = 0.25;
const GROWTH_BURST_LIFE_MAX = 0.42;
const GROWTH_BURST_SIZE_MIN = 0.18;
const GROWTH_BURST_SIZE_MAX = 0.34;

interface BoostParticle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseSize: number;
}

export class Robot {
  readonly mesh: THREE.Object3D;
  heading = 0;
  private velocityY = 0;
  private grounded = true;
  // Height-gated colliders (Collider.height) already cleared during the
  // current airborne phase. tryMove()'s exemption check only reads *this
  // frame's* y, which falls continuously once past a jump's apex — without
  // memory, a wall whose height was only barely satisfied at the peak stops
  // being exempt a frame or two later while the mover is still deep inside
  // its push-out radius, snapping it a full reach's-worth back to the
  // boundary instead of continuing a smooth landing.
  // Cleared on landing, but only for colliders the mover has actually moved
  // clear of (see the landing branch in update()) — a collider whose reach
  // the mover is still standing inside when it lands can't be safely
  // forgotten either, for the identical reason: revoking it would go
  // straight from "exempt" to "blocked from here" in the same spot.
  // Keyed by object identity, which only works because every collider array
  // in this game (firstFloorColliders, groundColliders, lunchColliders) is a
  // stable field built once, not reconstructed per frame — the same
  // Collider objects recur across a jump's whole arc.
  private clearedThisJump = new Set<Collider>();
  private ledgeFallTimer = 0;
  private wasJumpDown = false;
  private wasBoostDown = false;
  private sleepyBubble: SpeechBubble;
  // See TIPSY_WOBBLE_AMPLITUDE's own comment (beer tap's negative effect).
  private tipsyTimer = 0;
  private tipsyPhase = 0;
  private tipsyBugPhase = 0;
  private tipsyBugGroup = new THREE.Group();
  private tipsyBugs: THREE.Sprite[] = [];
  private stunTimer = 0;
  private tintableParts: { mesh: THREE.Mesh; baseColor: THREE.Color }[] = [];
  private energy = ENERGY_MAX;
  private canBoost = true;
  private loadFactor = 1;
  private wornItems: { type: SwagType; colorIndex: number; mesh: THREE.Object3D }[] = [];
  // Biggy's Lunch Rush growth (see the MAX_SIZE_SCALE comment above) — a
  // multiplier on top of whatever the current body's own intrinsic scale is
  // (1 for the procedural placeholder, GLTF_HEIGHT once the real model
  // loads), never a replacement for it. currentSpeed is the momentum-lite
  // easing value the movement code below chases a target speed with.
  private growthScale = 1;
  // Counts down from GROWTH_PULSE_DURATION after each grow() — see
  // applyBodyScale()'s squash-pop overshoot and update()'s decay tick.
  private growPulseTimer = 0;
  private baseBodyScale = 1;
  // False until voxxy.glb's async load resolves — addAccessory uses this to
  // pick the anchor table actually tuned for whichever body is on screen
  // (see swagAccessories.ts's VOXXY_SPOTS vs VOXXY_REAL_MODEL_SPOTS note).
  private usingRealModel = false;
  // Which robot's model/clips are currently loaded or loading — see
  // setRobotModel()/loadRobotModel(). Starts 'voxxy' to match the constructor's
  // initial load, before setRobotModel() is ever called.
  private currentRobotId = 'voxxy';
  // True from the moment a loadRobotModel() call starts until *its own*
  // load settles (success or failure) — see isLoadingModel's own comment for
  // why the guard checks currentRobotId rather than trusting every call.
  private loadingModel = false;
  private currentSpeed = 0;
  private fallen = false;
  // Droid's topple (docs/robot-characteristics.md): a two-phase failure, not
  // a single stunTimer-style flat window. toppleDownTimer counts down first
  // (full control loss, held flat); once it hits 0, toppleRiseTimer takes
  // over (can turn, still can't move) using toppleRiseDuration to compute
  // how far back upright bodyGroup.rotation.x has eased.
  private toppleDownTimer = 0;
  private toppleRiseTimer = 0;
  private toppleRiseDuration = 0;
  // Every level already blocks a hazard from re-triggering a hit while its
  // own stunCooldown/hitCooldown is running (see SwagRun.ts/KnowledgeRun.ts/
  // LunchRush.ts) — real invincibility, just with no visual tell, which is
  // why it doesn't read as "invincible" to a player. This timer mirrors that
  // same window purely for the blink effect below; it has no gameplay effect
  // of its own.
  private invincibleTimer = 0;
  // Body lives in its own child group (siblings: worn swag accessories) so the
  // procedural placeholder can be swapped for the real GLTF model in place,
  // once it loads, without disturbing anything already worn.
  private bodyGroup: THREE.Object3D;
  // Live on this.mesh (not bodyGroup) so they survive the placeholder→GLTF
  // model swap untouched.
  private boostCore: THREE.Sprite;
  private boostParticles: BoostParticle[] = [];
  private boostSpawnAccum = 0;
  private boostOrigin = DEFAULT_BOOST_ORIGIN.clone(); // recomputed on growth (and per-robot) in applyBodyScale()
  // Approximate hand height/spread on the rigged model — static, not bone-
  // tracked (a launch burst is brief enough that a small mismatch against the
  // actual mid-swing arm position doesn't read), recomputed on growth like
  // boostOrigin. Biggy overrides both this and boostOrigin with his own
  // measured exhaust-port positions in applyBodyScale() — see
  // BIGGY_EXHAUST_MID/L/R above.
  private jumpBurstOriginL = DEFAULT_JUMP_BURST_ORIGIN_L.clone();
  private jumpBurstOriginR = DEFAULT_JUMP_BURST_ORIGIN_R.clone();
  // Animation plumbing — null/empty until the rigged model (with whichever
  // clips ship) loads; every call site tolerates missing actions, since which
  // clips exist grows over time (see voxxyModel.ts).
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<RobotAnimationName, THREE.AnimationAction>> = {};
  private currentActionName: RobotAnimationName | null = null;
  // Which level's map the robot is currently standing on — set explicitly by
  // Game.ts at each level transition, never inferred from position. Each
  // level is its own standalone map (see docs/game-design.md "Level
  // structure"), so this only ever changes at a controlled transition point,
  // not from walking across some in-world threshold.
  private currentMap: Floor = 'ground';

  constructor(mesh?: THREE.Object3D) {
    this.mesh = mesh ?? new THREE.Group();
    // Spawn off the column grid (columns land on multiples of COLUMN_SPACING)
    // so the robot doesn't start embedded in one.
    this.mesh.position.x = 0;
    this.mesh.position.z = 15;

    this.bodyGroup = createVoxxyMesh();
    this.mesh.add(this.bodyGroup);
    this.collectTintableParts();

    this.boostCore = createGlowSprite(BOOST_CORE_SIZE, 0.8);
    this.boostCore.material.color.set(BOOST_CORE_COLOR);
    this.boostCore.position.copy(this.boostOrigin); // low, trailing behind (-Z is "behind" at heading 0)
    this.boostCore.visible = false;
    this.mesh.add(this.boostCore);

    // Child of this.mesh, not bodyGroup, same as worn accessories — so its
    // height is something this file positions explicitly (see update()) each
    // frame rather than inheriting bodyGroup's scale/replacement.
    this.sleepyBubble = createSpeechBubble();
    this.mesh.add(this.sleepyBubble.sprite);

    // Same "child of this.mesh, positioned explicitly each frame" shape as
    // sleepyBubble above — the bugs orbit around whatever head height is
    // currently correct for this robot/growth, not a fixed local offset.
    // A textured little mechanical-beetle sprite (see createTipsyBugSprite),
    // not a plain glow dot — the user: "the 3 dots going around the head, should
    // be clearer robotic bugs going around."
    this.tipsyBugGroup.visible = false;
    this.mesh.add(this.tipsyBugGroup);
    for (let i = 0; i < TIPSY_BUG_COUNT; i++) {
      const bug = createTipsyBugSprite(0.34);
      this.tipsyBugGroup.add(bug);
      this.tipsyBugs.push(bug);
    }

    for (let i = 0; i < BOOST_PARTICLE_POOL; i++) {
      const sprite = createGlowSprite(BOOST_PARTICLE_SIZE_MIN, 0);
      sprite.visible = false;
      this.mesh.add(sprite);
      this.boostParticles.push({ sprite, velocity: new THREE.Vector3(), life: 0, maxLife: 1, baseSize: BOOST_PARTICLE_SIZE_MIN });
    }

    this.loadRobotModel('voxxy');
  }

  /**
   * Loads (or switches to) the named robot's real GLTF model + animation
   * clips — called once from the constructor for the game's starting robot
   * (Voxxy), and again by setRobotModel() at a level transition. The current
   * bodyGroup (placeholder or a previously-loaded robot) stays exactly as-is
   * until the new model actually finishes loading — no placeholder flash on
   * a switch, since whatever was already showing is a perfectly fine stand-in
   * for the brief load window.
   */
  private loadRobotModel(robotId: string): void {
    this.currentRobotId = robotId;
    this.loadingModel = true;
    loadRobotAsset(robotId)
      .then(({ model, clips }) => {
        // A newer switch superseded this in-flight load — drop this result,
        // the newer call's own .then()/.catch() owns loadingModel now.
        if (this.currentRobotId !== robotId) return;
        this.loadingModel = false;

        this.mesh.remove(this.bodyGroup);
        this.bodyGroup = model;
        this.mesh.add(this.bodyGroup);
        this.collectTintableParts();
        // model.scale is already the robot's real height (voxxyModel.ts's own
        // rescale) — capture it as the new base so grow() multiplies on top
        // of it instead of overwriting it back down to 1.
        this.baseBodyScale = model.scale.x;
        this.applyBodyScale();
        this.usingRealModel = true;
        // Anything worn before the model finished loading was anchored with
        // the placeholder's coordinates (addAccessory() picks a profile at
        // call time and never revisits it) — the real model's proportions
        // are different enough (see swagAccessories.ts's VOXXY_REAL_MODEL_SPOTS
        // note) that those items would otherwise stay mispositioned for the
        // rest of the run. Rebuild every currently-worn item now, once,
        // against the real profile.
        this.reanchorWornItems();

        this.mixer = new THREE.AnimationMixer(model);
        this.actions = {};
        this.currentActionName = null;
        for (const [name, clip] of Object.entries(clips) as [RobotAnimationName, THREE.AnimationClip][]) {
          const action = this.mixer.clipAction(clip);
          if (name !== 'walk' && name !== 'run') {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
          }
          this.actions[name] = action;
        }
      })
      .catch((err) => {
        if (this.currentRobotId === robotId) this.loadingModel = false;
        console.warn(`${robotId} GLTF model failed to load, keeping the previous body`, err);
      });
  }

  /**
   * Switches which robot's real model is shown — called at a level
   * transition (see Game.ts). No-op if already showing (or already mid-load
   * for) that robot.
   */
  setRobotModel(robotId: string): void {
    if (this.currentRobotId === robotId) return;
    this.loadRobotModel(robotId);
  }

  /**
   * True while a setRobotModel() switch is in flight — Game.ts polls this
   * each frame to show/hide a "Loading <robot>..." HUD cue instead of
   * silently letting the previous robot's model keep standing in with no
   * indication anything is happening.
   */
  get isLoadingModel(): boolean {
    return this.loadingModel;
  }

  /** Which robot's model is currently loaded/loading — for the HUD label above. */
  get loadingRobotId(): string {
    return this.currentRobotId;
  }

  /** Crossfades to the named action; no-op if that clip hasn't shipped yet. */
  private playAction(name: RobotAnimationName, timeScale = 1): void {
    const next = this.actions[name];
    if (!next || this.currentActionName === name) {
      if (next) next.timeScale = timeScale;
      return;
    }
    const prev = this.currentActionName ? this.actions[this.currentActionName] : undefined;
    next.reset().setEffectiveTimeScale(timeScale).fadeIn(ANIM_CROSSFADE).play();
    prev?.fadeOut(ANIM_CROSSFADE);
    this.currentActionName = name;
  }

  private collectTintableParts(): void {
    this.tintableParts = [];
    this.bodyGroup.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.userData.tintable &&
        child.material instanceof THREE.MeshStandardMaterial
      ) {
        this.tintableParts.push({ mesh: child, baseColor: child.material.color.clone() });
      }
    });
  }

  /** Reapplies growthScale on top of whichever body's own baseBodyScale is current. */
  private applyBodyScale(): void {
    const pulse = this.growPulseTimer > 0
      ? 1 + GROWTH_PULSE_OVERSHOOT * (this.growPulseTimer / GROWTH_PULSE_DURATION)
      : 1;
    this.bodyGroup.scale.setScalar(this.baseBodyScale * this.growthScale * pulse);
    // The boost VFX is a sibling of bodyGroup (see its own comment), so it
    // doesn't inherit the body's scale automatically — nudge its spawn origin
    // out with growth so it still trails from the right spot instead of
    // visibly detaching from an enlarged body. Biggy spawns from his back
    // exhaust ports instead of the generic feet/hand points every other
    // robot uses — see the BIGGY_EXHAUST_* comment above.
    const boostBase = this.currentRobotId === 'biggy' ? BIGGY_EXHAUST_MID : DEFAULT_BOOST_ORIGIN;
    this.boostOrigin.set(boostBase.x * this.growthScale, boostBase.y * this.growthScale, boostBase.z * this.growthScale);
    this.boostCore.position.copy(this.boostOrigin);
    const jumpLBase = this.currentRobotId === 'biggy' ? BIGGY_EXHAUST_L : DEFAULT_JUMP_BURST_ORIGIN_L;
    const jumpRBase = this.currentRobotId === 'biggy' ? BIGGY_EXHAUST_R : DEFAULT_JUMP_BURST_ORIGIN_R;
    this.jumpBurstOriginL.set(jumpLBase.x * this.growthScale, jumpLBase.y * this.growthScale, jumpLBase.z * this.growthScale);
    this.jumpBurstOriginR.set(jumpRBase.x * this.growthScale, jumpRBase.y * this.growthScale, jumpRBase.z * this.growthScale);
  }

  /**
   * Steady core glow + pooled ember particles. Particles already spawned keep
   * aging/drifting/fading even after `boosting` goes false (a trail that cuts
   * off mid-flight reads as broken), so their update loop runs unconditionally
   * — only spawning new ones is gated on `boosting`.
   */
  private updateBoostVfx(dt: number, boosting: boolean): void {
    this.boostCore.visible = boosting;
    if (boosting) {
      const flicker = 1 + Math.sin(performance.now() * 0.025) * BOOST_CORE_FLICKER;
      this.boostCore.scale.set(BOOST_CORE_SIZE * flicker, BOOST_CORE_SIZE * flicker, 1);

      this.boostSpawnAccum += dt;
      while (this.boostSpawnAccum >= BOOST_PARTICLE_SPAWN_INTERVAL) {
        this.boostSpawnAccum -= BOOST_PARTICLE_SPAWN_INTERVAL;
        this.spawnBoostParticle();
      }
    }

    for (const p of this.boostParticles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.addScaledVector(p.velocity, dt);
      const t = 1 - p.life / p.maxLife; // 0 = just spawned, 1 = about to die
      const size = p.baseSize * (1 - 0.4 * t);
      p.sprite.scale.set(size, size, 1);
      // Stays near-full brightness for most of its life, then drops off fast
      // right at the end — reads as a distinct spark winking out, rather than
      // the continuous dim-from-birth fade linear opacity gave (which left
      // most on-screen particles at any moment already faint).
      p.sprite.material.opacity = t < 0.55 ? 0.95 : 0.95 * (1 - (t - 0.55) / 0.45);
      p.sprite.material.color.copy(BOOST_PARTICLE_HOT).lerp(BOOST_PARTICLE_COOL, t);
    }
  }

  private spawnBoostParticle(): void {
    const g = this.growthScale;
    const jitterX = (Math.random() - 0.5) * 0.3 * g;
    const jitterY = (Math.random() - 0.5) * 0.14 * g;
    // X/Y dominate (visible spread on screen); Z stays modest since the
    // chase camera sits almost directly behind, foreshortening depth motion.
    this.spawnFireParticle(
      new THREE.Vector3(this.boostOrigin.x + jitterX, this.boostOrigin.y + jitterY, this.boostOrigin.z),
      new THREE.Vector3((Math.random() - 0.5) * 1.3 * g, (0.7 + Math.random() * 0.6) * g, (-0.35 - Math.random() * 0.35) * g),
      BOOST_PARTICLE_LIFE_MIN + Math.random() * (BOOST_PARTICLE_LIFE_MAX - BOOST_PARTICLE_LIFE_MIN),
      (BOOST_PARTICLE_SIZE_MIN + Math.random() * (BOOST_PARTICLE_SIZE_MAX - BOOST_PARTICLE_SIZE_MIN)) * g,
    );
  }

  /**
   * One-shot burst from each hand (or, for Biggy, his two side exhaust
   * ports), fired the instant a jump is triggered (see the jump-input
   * handling in update()) — same pool/palette as the boost trail, but a
   * downward-and-outward "pushing off" burst rather than a continuous
   * backward trail, and positioned away from wherever boost trails from, so
   * it reads as jump's own effect rather than boost bleeding in.
   */
  private spawnJumpBurst(): void {
    const g = this.growthScale;
    for (const origin of [this.jumpBurstOriginL, this.jumpBurstOriginR]) {
      const outward = Math.sign(origin.x) || 1;
      for (let i = 0; i < JUMP_BURST_COUNT_PER_ARM; i++) {
        this.spawnFireParticle(
          new THREE.Vector3(
            origin.x + (Math.random() - 0.5) * 0.12 * g,
            origin.y + (Math.random() - 0.5) * 0.12 * g,
            origin.z + (Math.random() - 0.5) * 0.12 * g,
          ),
          new THREE.Vector3(outward * (0.6 + Math.random() * 0.7) * g, (-1.1 - Math.random() * 0.8) * g, (Math.random() - 0.5) * 0.4 * g),
          JUMP_BURST_LIFE_MIN + Math.random() * (JUMP_BURST_LIFE_MAX - JUMP_BURST_LIFE_MIN),
          (JUMP_BURST_SIZE_MIN + Math.random() * (JUMP_BURST_SIZE_MAX - JUMP_BURST_SIZE_MIN)) * g,
        );
      }
    }
  }

  private spawnFireParticle(position: THREE.Vector3, velocity: THREE.Vector3, maxLife: number, baseSize: number): void {
    const p = this.boostParticles.find((candidate) => candidate.life <= 0);
    if (!p) return; // pool exhausted — this spawn is silently dropped

    p.sprite.position.copy(position);
    p.velocity.copy(velocity);
    p.maxLife = maxLife;
    p.life = maxLife;
    p.baseSize = baseSize;
    p.sprite.scale.set(baseSize, baseSize, 1);
    p.sprite.material.color.copy(BOOST_PARTICLE_HOT);
    p.sprite.material.opacity = 0.95;
    p.sprite.visible = true;
  }

  get isStunned(): boolean {
    return this.stunTimer > 0;
  }

  /** True while airborne (mid-jump) — used to let a well-timed jump clear the foyer ledge. */
  get isGrounded(): boolean {
    return this.grounded;
  }

  /** Fraction in [0, 1], for a HUD energy bar. */
  get energyFraction(): number {
    return this.energy / ENERGY_MAX;
  }

  /** Which level's map the robot is currently on — see setMap(). */
  get mapMode(): Floor {
    return this.currentMap;
  }

  /** How much bigger than baseline Biggy currently is (1 = normal) — see grow(). */
  get sizeScale(): number {
    return this.growthScale;
  }

  /**
   * How much of `growthScale` actually counts against movement (top speed,
   * turn rate, acceleration) — eased in with a quadratic curve rather than
   * matching size 1:1 (the user, after playing the new hunger mechanic: "when you
   * get followed, you have no chance to survive... ate 16 sandwiches, already
   * too slow"). Hunger now forces eating on a real cadence (see LunchRush.ts),
   * so a straight `/growthScale` penalty made Biggy lose his speed edge over
   * a chasing diner (CHASE_SPEED, 5 — see LunchRush.ts) after only 3-4
   * sandwiches, well before FALL_THRESHOLD (1.4) even makes a hit fatal.
   * This keeps early growth nearly full-speed and ramps the penalty in later,
   * converging on the exact same value `growthScale` itself would give at
   * MAX_SIZE_SCALE — so the "big and slow" endgame identity is unchanged,
   * only delayed until there's been real time to build up score first.
   * Collision size/wall clearance are NOT eased this way — those track
   * `growthScale` directly, since a physically bigger body needs the real
   * clearance regardless of how fast it can still move.
   */
  private get mobilityPenalty(): number {
    const t = (this.growthScale - 1) / (MAX_SIZE_SCALE - 1);
    return 1 + (MAX_SIZE_SCALE - 1) * t * t;
  }

  /** True once fallOver() has been called — Biggy's permanent Lunch Rush failure. */
  get hasFallen(): boolean {
    return this.fallen;
  }

  /** True during either phase of Droid's topple — down or rising. */
  get isToppled(): boolean {
    return this.toppleDownTimer > 0 || this.toppleRiseTimer > 0;
  }

  /** True while the post-hit invincibility window (see invincibleTimer) is running. */
  get isInvincible(): boolean {
    return this.invincibleTimer > 0;
  }

  /**
   * Purely visual — flags the blink effect in update() for `duration`
   * seconds. Callers pass the same total window their own stunCooldown/
   * hitCooldown already uses (control-loss duration + that level's own
   * grace constant), so the blink exactly covers a window that's already
   * really invincible, rather than introducing a second, out-of-sync
   * immunity period.
   */
  setInvincible(duration: number): void {
    this.invincibleTimer = Math.max(this.invincibleTimer, duration);
  }

  /** True while the beer tap's "tipsy" penalty (see TIPSY_WOBBLE_AMPLITUDE) is running. */
  get isTipsy(): boolean {
    return this.tipsyTimer > 0;
  }

  /**
   * The beer tap's negative effect (SwagRun.ts/LunchRush.ts) — doesn't block
   * input the way stun()/topple() do, just makes the actual movement/facing
   * direction drift off whatever the player is steering toward for
   * `duration` seconds, with a few "bugs" orbiting the head as the visible
   * tell (see update()).
   */
  applyTipsy(duration: number): void {
    this.tipsyTimer = Math.max(this.tipsyTimer, duration);
  }

  /** Called by gameplay systems (e.g. hazards) to briefly disable player control. */
  stun(duration: number): void {
    this.stunTimer = Math.max(this.stunTimer, duration);
    // A hit stops Biggy dead rather than leaving him coasting into the thing
    // that just hit him at his old speed once the stun wears off.
    this.currentSpeed = 0;
  }

  /**
   * Droid's topple (docs/robot-characteristics.md): reuses fallOver()'s
   * tilt technique made temporary and eased instead of permanent. Down
   * phase blocks turning too; the rise phase (driven by riseDuration) only
   * blocks movement, letting the player re-aim while Droid gets upright.
   * KnowledgeRun.ts's own stunCooldown is what stops a re-trigger mid-rise,
   * not this method — a call here always restarts from fully down.
   */
  topple(downDuration: number, riseDuration: number): void {
    this.toppleDownTimer = downDuration;
    this.toppleRiseTimer = 0;
    this.toppleRiseDuration = riseDuration;
    this.currentSpeed = 0;
  }

  /**
   * Biggy's Lunch Rush growth (see docs/game-design.md "Level 3") — every
   * sandwich makes him permanently bigger, which this file folds into real
   * movement cost, not just a bigger model (see MAX_SIZE_SCALE). Never called
   * by Voxxy/Droid's levels.
   *
   * Each sandwich's effect tapers off as Biggy nears MAX_SIZE_SCALE, instead
   * of a flat `amount` all the way to the cap (the user: growth should have an
   * "exponential lag"/"very small steps" late-run, not stay linear) — full
   * strength while there's plenty of headroom left, asymptotically smaller
   * as that headroom shrinks, so the last stretch to max size takes many more
   * sandwiches than the first stretch did.
   */
  grow(amount: number): void {
    const headroom = MAX_SIZE_SCALE - this.growthScale;
    const taperedAmount = amount * (headroom / (MAX_SIZE_SCALE - 1));
    this.growthScale = Math.min(MAX_SIZE_SCALE, this.growthScale + taperedAmount);
    this.growPulseTimer = GROWTH_PULSE_DURATION;
    this.applyBodyScale();
    this.spawnGrowthBurst();
  }

  private spawnGrowthBurst(): void {
    const g = this.growthScale;
    // Belly-height, slightly forward — matches where these round-bodied
    // designs actually bulge, not the object's local origin.
    const origin = new THREE.Vector3(0, 0.55 * g, 0.2 * g);
    for (let i = 0; i < GROWTH_BURST_COUNT; i++) {
      // Radiate outward in every direction (unlike boost's backward trail or
      // jump's downward-outward push) — a "poof" centered on the belly.
      const theta = Math.random() * Math.PI * 2;
      const upBias = 0.3 + Math.random() * 0.5;
      const speed = (0.5 + Math.random() * 0.6) * g;
      this.spawnFireParticle(
        new THREE.Vector3(
          origin.x + (Math.random() - 0.5) * 0.1 * g,
          origin.y + (Math.random() - 0.5) * 0.1 * g,
          origin.z + (Math.random() - 0.5) * 0.1 * g,
        ),
        new THREE.Vector3(Math.cos(theta) * speed, upBias * speed, Math.sin(theta) * speed),
        GROWTH_BURST_LIFE_MIN + Math.random() * (GROWTH_BURST_LIFE_MAX - GROWTH_BURST_LIFE_MIN),
        (GROWTH_BURST_SIZE_MIN + Math.random() * (GROWTH_BURST_SIZE_MAX - GROWTH_BURST_SIZE_MIN)) * g,
      );
    }
  }

  /**
   * Biggy's permanent Lunch Rush failure (see docs/robot-characteristics.md):
   * wide and top-heavy, once he goes down he can't get back up. LunchRush.ts
   * decides *when* this fires (gated to sizeScale, per the rules-alignment
   * playability fix — early hits just stumble) — this just plays it out.
   */
  fallOver(): void {
    this.fallen = true;
    this.currentSpeed = 0;
    this.bodyGroup.rotation.x = -Math.PI / 2;
  }

  /** Restores energy (e.g. from a coffee station), capped at full. */
  restoreEnergy(amount: number): void {
    this.energy = Math.min(ENERGY_MAX, this.energy + amount);
    if (this.energy >= ENERGY_RESUME_THRESHOLD) this.canBoost = true;
  }

  /** Puts on a specific piece of collected swag — same geometry as the world pickup. */
  addAccessory(type: SwagType, colorIndex: number): void {
    // KING's crown and Miracle Systems' cap share one head anchor — wearing
    // either one replaces whichever of the two is already worn there,
    // rather than stacking (see swagAccessories.md's head-slot conflict note).
    if (HEAD_SLOT_TYPES.has(type)) {
      const existingIndex = this.wornItems.findIndex((w) => HEAD_SLOT_TYPES.has(w.type));
      if (existingIndex !== -1) {
        const [existing] = this.wornItems.splice(existingIndex, 1);
        this.mesh.remove(existing.mesh);
      }
    }
    const stickerSlot = this.wornItems.filter((w) => w.type === 'sticker').length;
    const mesh = createWornAccessory(type, this.usingRealModel ? 'voxxy-real' : 'voxxy', colorIndex, stickerSlot);
    this.mesh.add(mesh);
    this.wornItems.push({ type, colorIndex, mesh });
  }

  /** Rebuilds every currently-worn item against the real model's anchors — see the GLTF-load callback's comment for why this exists. */
  private reanchorWornItems(): void {
    let stickerSlot = 0;
    for (const item of this.wornItems) {
      this.mesh.remove(item.mesh);
      const slot = item.type === 'sticker' ? stickerSlot++ : 0;
      item.mesh = createWornAccessory(item.type, 'voxxy-real', item.colorIndex, slot);
      this.mesh.add(item.mesh);
    }
  }

  /** Removes and returns the most recently worn item (e.g. swag dropped after a hit). */
  dropLastAccessory(): { type: SwagType; colorIndex: number } | null {
    const item = this.wornItems.pop();
    if (!item) return null;
    this.mesh.remove(item.mesh);
    return { type: item.type, colorIndex: item.colorIndex };
  }

  /** Each carried item makes the robot a little slower, down to MIN_LOAD_FACTOR. */
  setCarriedItemCount(count: number): void {
    this.loadFactor = Math.max(MIN_LOAD_FACTOR, 1 - count * LOAD_PENALTY_PER_ITEM);
  }

  /** Puts the robot back to its starting state for a replay, without reloading the model. */
  reset(): void {
    this.setMap('ground', { x: 0, y: GROUND_Y, z: 15, heading: 0 });
  }

  /**
   * Moves the robot onto a different level's map — a full reset of movement
   * state (energy, load, stun, jump physics) plus a fresh spawn transform,
   * used at level-transition points (see Game.ts). Never called mid-frame in
   * response to position, only from an explicit "level 1 done, start level
   * 2" style call.
   */
  setMap(mode: Floor, spawn: { x: number; y: number; z: number; heading: number }): void {
    this.currentMap = mode;
    this.mesh.position.set(spawn.x, spawn.y, spawn.z);
    this.heading = spawn.heading;
    this.velocityY = 0;
    this.grounded = true;
    this.clearedThisJump.clear();
    this.ledgeFallTimer = 0;
    this.wasJumpDown = false;
    this.wasBoostDown = false;
    this.sleepyBubble.show('', 0); // clears hasMessage() so a stale bubble doesn't linger into the new level
    this.stunTimer = 0;
    this.energy = ENERGY_MAX;
    this.canBoost = true;
    this.loadFactor = 1;
    for (const item of this.wornItems) this.mesh.remove(item.mesh);
    this.wornItems = [];
    this.currentSpeed = 0;
    this.fallen = false;
    this.toppleDownTimer = 0;
    this.toppleRiseTimer = 0;
    this.invincibleTimer = 0;
    this.tipsyTimer = 0;
    this.bodyGroup.rotation.x = 0;
    this.growthScale = 1;
    this.applyBodyScale();
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  update(dt: number, input: InputManager, colliders: Collider[]): void {
    let move = 0;
    let boosting = false;

    // Counts down unconditionally, through whichever control-loss phase is
    // running — it mirrors a level's own stunCooldown/hitCooldown, which
    // already ticks down the same way regardless of player input.
    if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);

    // Same unconditional countdown as invincibleTimer above — tipsy doesn't
    // block input, it just distorts the direction that input actually
    // produces (see the movement block below and the final mesh.rotation.y).
    if (this.tipsyTimer > 0) {
      this.tipsyTimer = Math.max(0, this.tipsyTimer - dt);
      this.tipsyPhase += dt * TIPSY_WOBBLE_RATE;
      this.tipsyBugPhase += dt * TIPSY_BUG_ORBIT_SPEED;
    }
    const tipsyWobble = this.tipsyTimer > 0 ? Math.sin(this.tipsyPhase) * TIPSY_WOBBLE_AMPLITUDE : 0;

    if (this.toppleDownTimer > 0) {
      // Fully down: no turning, no moving — same shape as a jump-cut stun,
      // just a longer, directional-fall read (see fallOver()'s rotation).
      this.toppleDownTimer = Math.max(0, this.toppleDownTimer - dt);
      if (this.toppleDownTimer === 0) this.toppleRiseTimer = this.toppleRiseDuration;
    } else if (this.toppleRiseTimer > 0) {
      // Rising: can turn (aim the next move) but still can't walk — the
      // "getting a knee under himself" beat docs/robot-characteristics.md
      // asks for, distinct from an instant stun/recover.
      this.toppleRiseTimer = Math.max(0, this.toppleRiseTimer - dt);
      const turnSpeed = TURN_SPEED / this.mobilityPenalty;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) this.heading += turnSpeed * dt;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) this.heading -= turnSpeed * dt;
    } else if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    } else {
      // Bigger Biggy turns slower too — not just top speed — so a grown
      // Biggy visibly can't snap-reorient the way Voxxy/Droid (sizeScale
      // always 1) can.
      const turnSpeed = TURN_SPEED / this.mobilityPenalty;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) this.heading += turnSpeed * dt;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) this.heading -= turnSpeed * dt;

      if (input.isDown('KeyW') || input.isDown('ArrowUp')) move += 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) move -= 1;

      const wantsToBoost = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      boosting = wantsToBoost && move !== 0 && this.canBoost && this.energy > 0;
      // Only on the fresh press, not every frame it's held — otherwise
      // holding Shift with no energy would spam the bubble nonstop.
      if (wantsToBoost && !this.wasBoostDown && move !== 0 && !boosting && (!this.canBoost || this.energy <= 0)) {
        this.sleepyBubble.show(SLEEPY_TEXT, SLEEPY_DURATION);
      }
      this.wasBoostDown = wantsToBoost;

      if (boosting) {
        this.energy = Math.max(0, this.energy - ENERGY_DRAIN_RATE * dt);
        if (this.energy === 0) this.canBoost = false;
      } else {
        this.energy = Math.min(ENERGY_MAX, this.energy + ENERGY_REGEN_RATE * dt);
        if (this.energy >= ENERGY_RESUME_THRESHOLD) this.canBoost = true;
      }

      // Boosting fully cancels the growth mobility penalty for top
      // speed/acceleration (not just discounts it) — the user: "make the boost
      // more compensating for Biggy, so he can still escape as long as he
      // has energy left." A grown Biggy who's out of energy is still
      // genuinely slow (see mobilityPenalty), but one with energy in reserve
      // sprints exactly like his un-grown self, same as Voxxy's own boost —
      // the real cost is the energy itself (see ENERGY_DRAIN_RATE), not a
      // permanently-crippled top speed. Turn rate is deliberately left
      // penalized even while boosting (computed earlier, before `boosting`
      // is known here) — a sprint is straight-line thrust, not agility.
      const boostedMobility = boosting ? 1 : this.mobilityPenalty;
      const targetSpeed = move * MOVE_SPEED * (boosting ? BOOST_MULTIPLIER : 1) * this.loadFactor / boostedMobility;
      // Momentum-lite: chase the target speed instead of snapping to it. At
      // sizeScale 1 the accel is high enough this is imperceptible; as Biggy
      // grows it divides down, so he genuinely accelerates and brakes slowly
      // (and, combined with the reduced turnSpeed above, carries speed into
      // turns rather than instantly redirecting — reads as real weight).
      const accel = BASE_ACCEL / boostedMobility;
      const maxDelta = accel * dt;
      this.currentSpeed += THREE.MathUtils.clamp(targetSpeed - this.currentSpeed, -maxDelta, maxDelta);

      if (Math.abs(this.currentSpeed) > 0.001) {
        const dx = Math.sin(this.heading + tipsyWobble) * this.currentSpeed * dt;
        const dz = Math.cos(this.heading + tipsyWobble) * this.currentSpeed * dt;
        this.tryMove(dx, dz, colliders);
      }

      const jumpDown = input.isDown('Space');
      if (jumpDown && !this.wasJumpDown && this.grounded) {
        if (this.energy >= JUMP_ENERGY_COST) {
          this.velocityY = JUMP_VELOCITY;
          this.grounded = false;
          this.energy -= JUMP_ENERGY_COST;
          if (this.energy < ENERGY_RESUME_THRESHOLD) this.canBoost = false;
          this.spawnJumpBurst();
        } else {
          this.sleepyBubble.show(SLEEPY_TEXT, SLEEPY_DURATION);
        }
      }
      this.wasJumpDown = jumpDown;
    }

    this.updateBoostVfx(dt, boosting);

    if (this.growPulseTimer > 0) {
      this.growPulseTimer = Math.max(0, this.growPulseTimer - dt);
      this.applyBodyScale();
    }

    this.sleepyBubble.update(dt);
    const margin = SLEEPY_MARGIN_ABOVE_HEAD[this.currentRobotId] ?? DEFAULT_SLEEPY_MARGIN_ABOVE_HEAD;
    const sleepyY = this.usingRealModel ? this.baseBodyScale + margin : SLEEPY_Y_PLACEHOLDER;
    this.sleepyBubble.sprite.position.y = sleepyY * this.growthScale;
    this.sleepyBubble.sprite.visible = this.sleepyBubble.hasMessage();

    this.tipsyBugGroup.visible = this.tipsyTimer > 0;
    if (this.tipsyBugGroup.visible) {
      this.tipsyBugGroup.position.y = sleepyY * this.growthScale;
      for (let i = 0; i < this.tipsyBugs.length; i++) {
        const angle = this.tipsyBugPhase + (i / this.tipsyBugs.length) * Math.PI * 2;
        const radius = TIPSY_BUG_ORBIT_RADIUS * this.growthScale;
        this.tipsyBugs[i].position.set(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.15, Math.sin(angle) * radius);
      }
    }

    // Droid's topple tilt: fully down through the down phase, then eased
    // back toward upright over the rise phase — same rotation.x technique
    // as Biggy's permanent fallOver(), just temporary. Guarded on !fallen
    // so a genuinely fallen Biggy is never re-tilted by this (the two
    // mechanics never actually run on the same robot instance, but the
    // guard keeps that assumption from being silently load-bearing).
    if (!this.fallen) {
      if (this.toppleDownTimer > 0) {
        this.bodyGroup.rotation.x = -Math.PI / 2;
      } else if (this.toppleRiseTimer > 0) {
        const risenFraction = 1 - this.toppleRiseTimer / this.toppleRiseDuration;
        this.bodyGroup.rotation.x = -Math.PI / 2 * (1 - risenFraction);
      } else {
        this.bodyGroup.rotation.x = 0;
      }
    }

    const stunTint = this.isStunned ? new THREE.Color(STUN_COLOR) : null;
    // Blinks for the entire invincibility window (down/rise/stun phase
    // included, not just the post-recovery grace tail) — using
    // invincibleTimer itself as the phase clock is fine since it counts
    // down at real-time rate just like an elapsed-time clock would.
    const blinkedOut =
      this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / INVINCIBLE_BLINK_INTERVAL) % 2 === 0;
    for (const part of this.tintableParts) {
      const material = part.mesh.material as THREE.MeshStandardMaterial;
      material.color.copy(stunTint ?? part.baseColor);
      material.transparent = this.invincibleTimer > 0;
      material.opacity = blinkedOut ? INVINCIBLE_BLINK_OPACITY : 1;
    }

    // Animation priority: airborne > stunned/toppled > walking > idle. Droid's
    // topple reuses the 'stun' clip (docs/robot-characteristics.md: "doesn't
    // need new tooling of its own") rather than a dedicated animation. Falls
    // through to the next tier for any clip that hasn't shipped yet (see
    // voxxyModel.ts) rather than erroring.
    if (!this.grounded) {
      this.playAction('jump');
    } else if (this.isStunned || this.isToppled) {
      this.playAction('stun');
    } else if (Math.abs(this.currentSpeed) > 0.1) {
      // Checks currentSpeed, not the raw move intent — Biggy's momentum (see
      // BASE_ACCEL) means he keeps sliding for a beat after a key is
      // released, and playing idle the instant `move` hits 0 froze his legs
      // mid-slide, which read as skating rather than braking.
      // Boosting gets its own clip (bigger stride, harder arm pump, forward
      // lean) rather than just time-scaling walk — falls back to a sped-up
      // walk if the run clip hasn't loaded yet, same tolerance as every other
      // optional clip (see voxxyModel.ts).
      if (boosting && this.actions.run) {
        this.playAction('run');
      } else {
        this.playAction('walk', boosting ? 1.6 : 1);
      }
    } else {
      this.playAction('idle');
      // No idle clip yet — freeze the last pose instead of looping a walk
      // cycle in place.
      if (!this.actions.idle) this.actions.walk?.setEffectiveTimeScale(0);
    }
    this.mixer?.update(dt);

    const groundY =
      this.currentMap === 'first'
        ? getFirstFloorHeightAt(this.mesh.position.x, this.mesh.position.z)
        : getGroundFloorHeightAt(this.mesh.position.x, this.mesh.position.z);
    if (this.ledgeFallTimer > 0) {
      // Walked off a ledge — hold position for a beat before actually falling.
      this.ledgeFallTimer -= dt;
    } else if (this.grounded) {
      if (groundY < this.mesh.position.y - AUTO_STEP_HEIGHT) {
        // A real ledge (bigger than a stair step) — trigger the fall-delay.
        this.ledgeFallTimer = LEDGE_FALL_DELAY;
        this.grounded = false;
      } else {
        // Flat ground, or a stair step (up or down) within AUTO_STEP_HEIGHT —
        // follow it directly. tryMove() already rejected any upward step
        // steeper than this without jumping, so there's nothing to gate here.
        this.mesh.position.y = groundY;
      }
    } else {
      this.velocityY -= GRAVITY * dt;
      this.mesh.position.y += this.velocityY * dt;
      if (this.mesh.position.y <= groundY) {
        this.mesh.position.y = groundY;
        this.velocityY = 0;
        this.grounded = true;
        // Landing starts the next jump fresh, but only for colliders the
        // mover has actually moved clear of. One whose reach it's still
        // standing inside — because the jump's time-of-flight ran out before
        // it finished crossing — can't be safely forgotten: that would flip
        // it from "exempt" to "blocked from right here" one frame later,
        // shoving the mover a full reach backward from a spot it just
        // legitimately landed on. Only drop a collider once its height is
        // met natively (redundant to keep) or it's no longer close enough to
        // matter.
        for (const c of [...this.clearedThisJump]) {
          if (c.height !== undefined && this.mesh.position.y >= c.height - 0.05) {
            this.clearedThisJump.delete(c);
            continue;
          }
          const dx = this.mesh.position.x - c.x;
          const dz = this.mesh.position.z - c.z;
          const reach = this.colliderReach(c);
          if (dx * dx + dz * dz >= reach * reach) this.clearedThisJump.delete(c);
        }
      }
    }

    this.mesh.rotation.y = this.heading + tipsyWobble;
  }

  // The push-out distance a collider enforces from its own center — shared by
  // tryMove()'s per-frame check and the landing branch's selective clear
  // below, which both need to agree on exactly how close is "still in
  // danger" for the same collider.
  private colliderReach(c: Collider): number {
    return c.radius + WALL_CLEARANCE * this.growthScale;
  }

  private tryMove(dx: number, dz: number, colliders: Collider[]): void {
    let nextX = this.mesh.position.x + dx;
    let nextZ = this.mesh.position.z + dz;
    // Grows with Biggy (see grow()) so a bigger body genuinely occupies more
    // space against walls/props/hazards, not just moving slower through the
    // same footprint.
    const wallClearance = WALL_CLEARANCE * this.growthScale;

    if (this.currentMap === 'ground') {
      const hallHalfW = HALL_WIDTH / 2 - wallClearance;
      const hallHalfD = HALL_DEPTH / 2 - wallClearance;

      // Beyond the hall's front wall lies the (wider) entrance foyer, reached only
      // through the (narrower) doorway gap in that wall. Crossing the wall plane
      // requires being within the doorway's actual gap; once through, the fuller
      // foyer width applies so you're not squeezed into the doorway's width the
      // whole time you're in there.
      const alreadyPastWall = this.mesh.position.z > HALL_DEPTH / 2 - wallClearance;
      const wantsPastWall = nextZ > hallHalfD;

      let xMin = -hallHalfW;
      let xMax = hallHalfW;
      let zMin = -hallHalfD;
      let zMax = hallHalfD;
      if (wantsPastWall) {
        // Beyond the hall's front wall lies the (wider) entrance foyer, reached
        // only through the (narrower) doorway gap in that wall.
        if (alreadyPastWall) {
          xMin = -(FOYER_WIDTH / 2 - wallClearance);
          xMax = FOYER_WIDTH / 2 - wallClearance;
          zMax = HALL_DEPTH / 2 + FOYER_DEPTH - wallClearance;
        } else {
          // Crossing the wall plane requires actually being within the
          // doorway's gap in X — not just any X, forced into the gap.
          // Approaching the wall far from the doorway (e.g. near a side wall)
          // stops at the solid wall segment instead of snapping sideways
          // into the gate.
          const gateHalfW = DOORWAY_WIDTH / 2 - wallClearance;
          const withinGateX = nextX >= -gateHalfW && nextX <= gateHalfW;
          if (withinGateX) {
            zMax = HALL_DEPTH / 2 + FOYER_DEPTH - wallClearance;
          }
          // else: leave zMax at the hall's own bound — a solid wall here, X untouched.
        }
      }

      nextX = THREE.MathUtils.clamp(nextX, xMin, xMax);
      nextZ = THREE.MathUtils.clamp(nextZ, zMin, zMax);

      // A real ledge (a booth platform, or the foyer before it had a real
      // staircase) blocks walking onto it — must jump — unless already
      // airborne near its height; walking off one is always allowed (see the
      // fall-delay in update()). The threshold is AUTO_STEP_HEIGHT, not a
      // smaller guessed number: this used to be a flat 0.05, which correctly
      // blocked the foyer's old 1.0m jump-ledge but also blocked the entrance
      // stairs added later (each step only rises 0.25) the same way, since
      // 0.05 is well under even a single real stair step. A true stair-step
      // increase and a real ledge need the same distinguishing line
      // everywhere in this file, not two different numbers for the same
      // concept on two floors.
      const currentGroundY = getGroundFloorHeightAt(this.mesh.position.x, this.mesh.position.z);
      const nextGroundY = getGroundFloorHeightAt(nextX, nextZ);
      if (nextGroundY > currentGroundY + AUTO_STEP_HEIGHT && this.mesh.position.y < nextGroundY - LEDGE_CLEAR_MARGIN) {
        nextX = this.mesh.position.x;
        nextZ = this.mesh.position.z;
      }
    }

    for (const c of colliders) {
      // A height-limited collider (a jump platform's sides) only blocks
      // approaching at ground level — once actually standing on top
      // (y at/above the platform), it shouldn't fight the robot walking
      // around up there. Sticky per jump, not re-checked every frame purely
      // against this instant's y (see clearedThisJump's own comment) — a
      // mover already granted clearance mid-air doesn't lose it just because
      // it's still falling toward its landing spot.
      if (c.height !== undefined) {
        if (this.clearedThisJump.has(c)) continue;
        if (this.mesh.position.y >= c.height - 0.05) {
          this.clearedThisJump.add(c);
          continue;
        }
      }
      const distX = nextX - c.x;
      const distZ = nextZ - c.z;
      const minDist = this.colliderReach(c);
      const distSq = distX * distX + distZ * distZ;
      if (distSq < minDist * minDist && distSq > 0) {
        const dist = Math.sqrt(distSq);
        nextX = c.x + (distX / dist) * minDist;
        nextZ = c.z + (distZ / dist) * minDist;
      }
    }

    if (this.currentMap === 'first') {
      // No shared outer bounding box up here — each room's own walls are the
      // boundary (see isOnFirstFloor): check the destination directly against
      // every real zone rather than
      // inferring bounds from "which zone am I in now", which misclassifies
      // right at a shared wall between two rooms.
      const curX = this.mesh.position.x;
      const curZ = this.mesh.position.z;
      if (!isOnFirstFloor(nextX, curZ)) nextX = curX;
      if (!isOnFirstFloor(curX, nextZ)) nextZ = curZ;
      if (!isOnFirstFloor(nextX, nextZ)) {
        nextX = curX;
        nextZ = curZ;
      }
    }

    this.mesh.position.x = nextX;
    this.mesh.position.z = nextZ;
  }
}
