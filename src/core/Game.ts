import * as THREE from 'three';
import {
  createExhibitionHall,
  createFirstFloor,
  getColumnColliders,
  getBoothPlatformColliders,
  getAuditoriumRowWallColliders,
  getAuditoriumStageColliders,
  getHallwayPropColliders,
  updateAuditoriumScreen,
  getFirstFloorHeightAt,
  getGroundFloorHeightAt,
  getStairEnclosureColliders,
  getLunchTableColliders,
  getDevoxxLetterColliders,
  updateDevoxxLetters,
  resetDevoxxLetters,
  getSideStairRailingColliders,
  getChargingDockColliders,
  getChargingDockMarkers,
  updateChargingDocks,
  getContactPropColliders,
  updateContactProps,
  FIRST_FLOOR_SPAWN,
  FLOOR_HEIGHT,
  Collider,
} from '../scene/ExhibitionHall';
import { createSponsorBooths, getBoothColliders, KING_KIOSK_POS } from '../scene/sponsorBooths';
import { createLighting } from '../scene/lighting';
import { Robot } from '../entities/Robot';
import { InputManager } from '../input/InputManager';
import { TouchControls } from '../input/TouchControls';
import { FollowCamera } from '../camera/FollowCamera';
import { SwagRun, STUN_DURATION as VOXXY_STUN_DURATION, POST_STUN_GRACE as VOXXY_POST_STUN_GRACE, COFFEE_MACHINE_POS } from '../gameplay/SwagRun';
import { KnowledgeRun, TOPPLE_DURATION, TOPPLE_RISE_DURATION, POST_TOPPLE_GRACE, OBSTACLE_DEFS } from '../gameplay/KnowledgeRun';
import { LunchRush, STUN_DURATION as BIGGY_STUMBLE_DURATION, POST_STUN_GRACE as BIGGY_POST_STUN_GRACE, JAVA_MACHINE_POS } from '../gameplay/LunchRush';
import { KIOSK_COLLIDER_RADIUS } from '../gameplay/vendingMachine';
import { Hud, DayEndSummary } from '../ui/Hud';
import { playSfx } from '../audio/sfx';
import { isLocalHost } from '../util/env';

// Personal-best total, kept in localStorage — per-browser, not a shared
// leaderboard, so it not mattering that it's trivially editable via devtools
// is a feature of the design, not an oversight.
const BEST_SCORE_KEY = 'dayAtDevoxx.bestScore';
// Seconds remaining at which the timer-low SFX fires (Levels 1-2 only —
// Level 3 has no timer). One-shot on crossing this, not a per-second replay.
const TIMER_LOW_THRESHOLD = 5;
// Length of beer-pour.wav, so Biggy's burp lands after the glass is full
// rather than over the pour. Kept in sync by hand with tools/gen_sfx.py's
// sfx_beer_pour() — the WAVs are static files, not decoded buffers, so
// nothing in the runtime knows their duration.
const BEER_POUR_DURATION = 1.21;
// The keys that start a level from its intro panel — exactly the movement/
// boost/jump keys Robot.update() itself reads, nothing else. A control key
// rather than literally any key (the user: "would pause the game until the
// first control key is pushed"): the level is genuinely frozen while the
// briefing is up, so Escape/Enter/a stray modifier shouldn't drop the player
// into a running round they weren't looking at yet. Kept in sync by hand with
// Robot.update()'s own isDown() calls — there's no shared key map to derive it
// from, and the intro panel's copy (INTRO_START_HINT) names these too.
const START_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space',
];

// Three sequential single-robot levels, not one shared world — Level 1 is
// Voxxy's Swag Run on the ground floor, Level 2 is Droid's Knowledge Run on
// the first floor, Level 3 is Biggy's Lunch Rush back on the ground floor,
// redressed for lunchtime. All three now have their own real 3D
// model/rig/clips — a single Robot instance persists across all three
// levels, switching which model it wears via setRobotModel() at each
// transition below, rather than spawning a separate character per robot;
// only the map, the running minigame, and the HUD copy change otherwise.
// Unlike Levels 1-2, Level 3 has no timer and no
// "next level" — it's Biggy's own endless/high-score mode (see LunchRush.ts).
// Biggy's permanent fall is the only way Level 3 ever ends, which makes it
// the only real end the whole game has too: finishing it shows "A Day at
// Devoxx"'s end screen (a per-robot score breakdown + combined total, see
// finalizeDayEnd()/Hud.ts), and restarting starts the whole day over from
// Level 1, not just Level 3 again.

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private robot = new Robot();
  private input = new InputManager();
  private followCamera: FollowCamera;
  private groundFloorGroup = createExhibitionHall();
  private firstFloorGroup = createFirstFloor();
  private sponsorBoothsScene = createSponsorBooths();
  private sponsorBoothsGroup = this.sponsorBoothsScene.group;
  // Shared prop across Level 1 (SwagRun.ts) and Level 3 (LunchRush.ts) — see
  // tick() for the per-frame .update(dt) call and each level's own
  // update(...) call for where .activate() gets triggered on touch.
  private beerTap = this.sponsorBoothsScene.beerTap;
  // Columns + sponsor-booth landmarks (vault door, F1 car, lion statue,
  // rope-maze stanchions) + both kiosks — both the player and Swag Run's
  // hazards route around these.
  private groundColliders: Collider[] = [
    ...getColumnColliders(),
    ...getBoothColliders(),
    ...getBoothPlatformColliders(),
    ...getStairEnclosureColliders(),
    // Back in Level 1 too, now that the table meshes themselves are built by
    // createExhibitionHall() (shared with Level 3), not LunchRush.ts alone —
    // The user: "add these tables also in level 1? makes the map less empty...
    // can be used to escape the npcs?" Height-gated like the booth desks
    // (getLunchTableColliders), so hazards (who can't jump) can't follow.
    ...getLunchTableColliders(),
    // The foyer's DEVOXX letters — solid extruded glyphs standing taller than
    // the robot can jump, so they're real obstacles, not set dressing. Read
    // from the live list createExhibitionHall() filled rather than a second
    // hand-kept copy of their coordinates; safe to spread here because the
    // groundFloorGroup field above is initialized first.
    ...getDevoxxLetterColliders('ground'),
    // The entrance-end charging dock's column (its pad is walk-on, see
    // getChargingDockColliders).
    ...getChargingDockColliders('ground'),
    // The walk-into-me props that are actually solid — see
    // getContactPropColliders for why not all of them are.
    ...getContactPropColliders('ground'),
    { x: COFFEE_MACHINE_POS[0], z: COFFEE_MACHINE_POS[1], radius: KIOSK_COLLIDER_RADIUS },
    { x: KING_KIOSK_POS[0], z: KING_KIOSK_POS[1], radius: KIOSK_COLLIDER_RADIUS },
  ];
  // AV carts/projector stands in the Level 2 corridor, the WiFi kiosk, and
  // the jump-gated walls between Room 4's seating rows — the actual
  // "parkour to reach the score bubble" mechanic (see
  // getAuditoriumRowWallColliders' own comment for why a wall, not a
  // height-gated platform, is what makes this genuinely require a jump).
  // Those row-wall colliders are `robotOnly` (see Collider.robotOnly) —
  // hazards climb every row freely, so firstFloorHazardColliders (below)
  // strips them back out for KnowledgeRun.ts's own collider loop, which has
  // no height-based exemption logic of its own.
  private firstFloorColliders: Collider[] = [
    ...OBSTACLE_DEFS.map((def) => ({ x: def.pos[0], z: def.pos[1], radius: def.radius })),
    ...getAuditoriumRowWallColliders(),
    ...getHallwayPropColliders(),
    // The first floor's one set, up on Room 4's stage deck. Deliberately
    // not `robotOnly`: unlike the row walls, these are solid objects the
    // attendees should route around too, so they stay in
    // firstFloorHazardColliders below.
    ...getDevoxxLetterColliders('first'),
    ...getChargingDockColliders('first'),
    ...getContactPropColliders('first'),
    // The balustrades around both mid-corridor stairwells. These are the only
    // thing keeping anyone out of a 3m trench in the corridor floor now that
    // the flights drop into the hall itself rather than through its side walls
    // — see getSideStairRailingColliders.
    ...getSideStairRailingColliders(),
    // Room 4's stage, height-gated at its own top face (see
    // getAuditoriumStageColliders) — without this the stage has a walkable
    // top surface but nothing stopping you walking into it, and
    // getFirstFloorHeightAt would pop the robot 0.4m up onto the deck
    // unasked. Level 2's attendees ignore Collider.height, so the same
    // entries block them at every height: the podium is a real refuge.
    ...getAuditoriumStageColliders(),
  ];
  private firstFloorHazardColliders: Collider[] = this.firstFloorColliders.filter((c) => !c.robotOnly);
  // Same ground floor as Level 1 (columns + booths), plus KING's candy
  // machine reused as-is (see LunchRush.ts's own comment) — Level 3's own
  // JAVA machine replaces Swag Run's coffee machine, which doesn't exist in
  // this level's world.
  private lunchColliders: Collider[] = [
    ...getColumnColliders(),
    ...getBoothColliders(),
    ...getBoothPlatformColliders(),
    ...getStairEnclosureColliders(),
    ...getLunchTableColliders(),
    ...getDevoxxLetterColliders('ground'), // same foyer letters as Level 1 — same ground floor, redressed
    ...getChargingDockColliders('ground'),
    { x: JAVA_MACHINE_POS[0], z: JAVA_MACHINE_POS[1], radius: KIOSK_COLLIDER_RADIUS },
    { x: KING_KIOSK_POS[0], z: KING_KIOSK_POS[1], radius: KIOSK_COLLIDER_RADIUS },
  ];
  // Charging docks on the minimap, in the dock's own charging cyan so they read
  // as distinct from the gold refuel kiosks and KING's pink claw. Both floors:
  // the user asked for the ground-floor one on "both levels" (it serves Level 1
  // and Level 3, the two that share that map), and Level 2's three are the
  // whole reason the docks exist, so hiding those would be the odd choice.
  // Built once — docks never move, and updateMinimap runs every frame.
  private groundDockMarkers = getChargingDockMarkers('ground').map((d) => ({ ...d, color: '#3fd8ff' }));
  private firstFloorDockMarkers = getChargingDockMarkers('first').map((d) => ({ ...d, color: '#3fd8ff' }));
  private clock = new THREE.Clock();
  private level: 1 | 2 | 3 = 1;
  private swagRun: SwagRun | undefined = new SwagRun();
  private knowledgeRun: KnowledgeRun | undefined;
  private lunchRun: LunchRush | undefined;
  private hud: Hud;
  private touchControls: TouchControls;
  // Last frame's held-key snapshot — lets tick() detect a genuinely fresh
  // press (see the awaitingStart and finished branches' own comments) rather
  // than a key that was already held when the screen in question appeared.
  private prevDownKeys: ReadonlySet<string> = new Set();
  // True while a level's intro panel is up and the level itself is frozen —
  // nothing but ambient animation runs, so the timer isn't already draining
  // and the hazards aren't already closing in while the player reads the
  // briefing (the user: "the game is already running while reading the
  // text"). Cleared by the first fresh START_KEYS press in tick(). Set at
  // every point that calls hud.showIntro(), which is every level start
  // including the very first — hence `true` here, not just in the
  // transitions.
  private awaitingStart = true;
  // Voxxy's and Droid's final scores, captured at each level hand-off since
  // their runs get torn down before the day ends — Biggy's is read live from
  // lunchRun.score instead, since nothing tears that down until the day
  // actually ends.
  private dayScore = { voxxy: 0, droid: 0 };
  // Computed once, the first frame Level 3 reports finished (see tick()) —
  // caching it avoids recomputing/re-writing localStorage every frame while
  // the end screen sits there.
  private dayEndSummary: DayEndSummary | undefined;
  // Edge-detection state for the timer-low/energy-empty SFX (see tick()) —
  // both are one-shot "just crossed the threshold" cues, not a sound that
  // plays every frame the condition holds. Reset at the start of every level
  // that has the relevant resource, so a fresh round can't inherit a stale
  // value from whatever the previous level ended on.
  private prevTimeRemaining = Infinity;
  private prevEnergyFraction = 1;
  // Whether the robot was standing on a charging pad last frame — the edge
  // that fires charge-up.wav. Unlike the two fields above this one needs no
  // per-level reset: a level transition relocates the robot off any pad, so
  // the next frame's own `charge > 0` is already false.
  private wasCharging = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // Neutral near-black rather than navy — reads as the tall black ceiling
    // void seen in the exhibition floor reference photos, not a night sky.
    this.scene.background = new THREE.Color(0x0c0c0e);
    this.scene.add(this.groundFloorGroup);
    this.scene.add(this.sponsorBoothsGroup);
    this.firstFloorGroup.visible = false;
    this.scene.add(this.firstFloorGroup);
    this.scene.add(createLighting());
    this.scene.add(this.robot.mesh);
    this.robot.setInvincible(VOXXY_STUN_DURATION + VOXXY_POST_STUN_GRACE);
    this.scene.add(this.swagRun!.group);

    this.followCamera = new FollowCamera(container.clientWidth / container.clientHeight);
    this.hud = new Hud(container);
    // After the HUD so the controls sit on top of it; the intro panel's
    // switch and the HUD's wording both follow the controls' own state.
    this.touchControls = new TouchControls(container, this.input);
    this.hud.setTouchMode(this.touchControls.isEnabled);
    this.hud.onTouchToggle = () => this.touchControls.toggle();
    this.touchControls.onChange = (on) => this.hud.setTouchMode(on);

    window.addEventListener('resize', this.onResize);

    // Debug query params — ?level=2/3 jumps straight to a level (chaining
    // the normal advanceToLevelX() transitions rather than a separate
    // direct-init path, so a skipped level's score stays honestly 0), and
    // ?x=&z= (optionally &heading=, in degrees) then drops the robot at an
    // exact spot, for reproducing a bug report/screenshot without a one-off
    // console call. y and floor are derived, never taken from the URL, so a
    // stale/wrong y can't be typed in by mistake.
    //
    // Gated to isLocalHost() (2026-09-25, tightened from the original
    // no-gate version) — the user: once this got a companion ?x=/?z= param,
    // "only accept them when running locally" outweighed "anyone can reach
    // it, the score cost is the deterrent." A hosted build (judges, a
    // shared link) now ignores these entirely rather than trusting a lower
    // score to discourage using them.
    if (isLocalHost()) {
      const params = new URLSearchParams(window.location.search);
      const debugLevel = params.get('level');
      if (debugLevel === '2' || debugLevel === '3') {
        this.advanceToLevel2();
        if (debugLevel === '3') this.advanceToLevel3();
      }

      const debugX = params.get('x');
      const debugZ = params.get('z');
      if (debugX !== null && debugZ !== null) {
        const x = Number(debugX);
        const z = Number(debugZ);
        if (Number.isFinite(x) && Number.isFinite(z)) {
          const headingDeg = Number(params.get('heading') ?? '0');
          const heading = Number.isFinite(headingDeg) ? (headingDeg * Math.PI) / 180 : 0;
          // Level 2 is the only one upstairs — Level 3 is Biggy back on the
          // ground floor, redressed for lunchtime (see advanceToLevel3). This
          // used to read `level === 1 ? 'ground' : 'first'`, which dropped
          // ?level=3&x=&z= onto the first floor instead: the robot landed at
          // the corridor's own height (4.5) and floated above the lunch hall.
          const floor = this.level === 2 ? 'first' : 'ground';
          const y = floor === 'first' ? getFirstFloorHeightAt(x, z) : getGroundFloorHeightAt(x, z);
          this.robot.setMap(floor, { x, y, z, heading });
        }
      }
    }
  }

  private onResize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
    this.followCamera.onResize(clientWidth / clientHeight);
  };

  start(): void {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /**
   * A robot standing in the wet floor's puddle gets the same reaction that
   * level's own attendee collision gives it — Voxxy short-circuits, Droid
   * topples, Biggy stumbles — rather than a fourth, separate hazard response
   * (the user: "should stun the robot in a similar way as a collision with an
   * npc does"). Attendees are never zapped: they don't run on electricity, and
   * more practically updateContactProps is only ever handed the robot.
   *
   * The invincibility window matches each branch's own, so the puddle can't
   * land a second hit while the robot is still getting up from the first; the
   * prop's own refractory (WET_FLOOR_REFRACTORY) is sized to outlast the
   * longest of them and leave time to walk back out of the water.
   */
  private zapInPuddle(): void {
    playSfx('wet-floor-zap');
    if (this.level === 2) {
      this.robot.topple(TOPPLE_DURATION, TOPPLE_RISE_DURATION);
      this.robot.setInvincible(TOPPLE_DURATION + TOPPLE_RISE_DURATION + POST_TOPPLE_GRACE);
      setTimeout(() => {
        if (this.level === 2) playSfx('droid-getup');
      }, TOPPLE_DURATION * 1000);
    } else if (this.level === 3) {
      // Routed through LunchRush rather than stunning directly: level 3 ends on
      // three hits close together once Biggy is big enough, and that ledger
      // counts hits, not attendees. A zap that bypassed it would be a free
      // stun — he could stand in the puddle all day while three bumps from the
      // crowd put him down. Which does mean a grown Biggy chased across this
      // puddle can lose the run to it; that is the same deal the crowd offers,
      // and unlike the crowd the puddle has a metre-high yellow sign on it.
      const { stumbled, fell, growthToast } = this.lunchRun!.registerExternalHit(this.robot);
      if (fell) {
        this.robot.fallOver();
        playSfx('biggy-fall');
      } else if (stumbled) {
        this.robot.stun(BIGGY_STUMBLE_DURATION);
        this.robot.setInvincible(BIGGY_STUMBLE_DURATION + BIGGY_POST_STUN_GRACE);
      }
      if (growthToast) this.hud.showQuoteToast(growthToast);
    } else {
      this.robot.stun(VOXXY_STUN_DURATION);
      this.robot.setInvincible(VOXXY_STUN_DURATION + VOXXY_POST_STUN_GRACE);
    }
  }

  /** Level 1 finished → tear it down, load Level 2 (Droid, first floor) in its place. */
  private advanceToLevel2(): void {
    this.dayScore.voxxy = this.swagRun!.score; // capture before teardown — see dayScore's own comment
    this.scene.remove(this.swagRun!.group);
    this.swagRun = undefined;
    this.groundFloorGroup.visible = false;
    this.sponsorBoothsGroup.visible = false;
    this.firstFloorGroup.visible = true;

    this.level = 2;
    this.knowledgeRun = new KnowledgeRun();
    this.scene.add(this.knowledgeRun.group);
    this.robot.setMap('first', { x: FIRST_FLOOR_SPAWN.x, y: FLOOR_HEIGHT, z: FIRST_FLOOR_SPAWN.z, heading: FIRST_FLOOR_SPAWN.heading });
    this.robot.setRobotModel('droid');
    this.prevTimeRemaining = Infinity;
    this.prevEnergyFraction = 1;
    // Droid's own full topple cycle (~3.7s) — longer than Voxxy's/Biggy's, since
    // a spawn-time hit costs exactly as much recovery time as a mid-round one.
    this.robot.setInvincible(TOPPLE_DURATION + TOPPLE_RISE_DURATION + POST_TOPPLE_GRACE);
    this.hud.showIntro(2);
    this.awaitingStart = true;
  }

  /** Level 2 finished → tear it down, load Level 3 (Biggy, back on the ground floor) in its place. */
  private advanceToLevel3(): void {
    this.dayScore.droid = this.knowledgeRun!.score; // capture before teardown — see dayScore's own comment
    this.scene.remove(this.knowledgeRun!.group);
    this.knowledgeRun = undefined;
    this.firstFloorGroup.visible = false;
    this.groundFloorGroup.visible = true;
    this.sponsorBoothsGroup.visible = true;

    this.level = 3;
    this.lunchRun = new LunchRush();
    this.dayEndSummary = undefined; // a fresh Level 3 attempt hasn't ended yet
    this.scene.add(this.lunchRun.group);
    this.robot.reset();
    this.robot.setRobotModel('biggy');
    this.robot.setInvincible(BIGGY_STUMBLE_DURATION + BIGGY_POST_STUN_GRACE);
    this.prevEnergyFraction = 1; // Level 3 has no timer, so only energy needs resetting here
    this.hud.showIntro(3);
    this.awaitingStart = true;
  }

  /**
   * The day ended (Biggy fell) → start a whole new day, back at Level 1 —
   * not a Level-3-only replay. Since Level 3 finishing means the day (and
   * its combined score) is over, "play again" means playing the whole day
   * again, not just the last level of it.
   */
  private restartDay(): void {
    this.scene.remove(this.lunchRun!.group);
    this.lunchRun = undefined;
    this.dayScore = { voxxy: 0, droid: 0 };
    this.dayEndSummary = undefined;

    this.level = 1;
    this.swagRun = new SwagRun();
    this.scene.add(this.swagRun.group);
    // A new day, so the DEVOXX letters are standing again — both floors' sets
    // survive a restart otherwise (neither floor group is rebuilt here), which
    // would open the next day with whatever the last one knocked over still
    // face-down. Deliberately not done at the Level 1->2->3 hand-offs: those
    // are the same day, and a letter Voxxy knocked over should still be lying
    // there when Biggy comes through at lunchtime.
    resetDevoxxLetters();
    this.robot.reset();
    this.robot.setRobotModel('voxxy');
    this.robot.setInvincible(VOXXY_STUN_DURATION + VOXXY_POST_STUN_GRACE);
    this.prevTimeRemaining = Infinity;
    this.prevEnergyFraction = 1;
    this.hud.showIntro(1);
    this.awaitingStart = true;
  }

  private onContinue(): void {
    if (this.level === 1) this.advanceToLevel2();
    else if (this.level === 2) this.advanceToLevel3();
    else this.restartDay();
  }

  /**
   * Called once, the first frame Level 3 reports finished — tallies the
   * whole day and updates the personal-best record. Type/shape validation
   * only on the stored value, not a magnitude "is this plausible" check:
   * Level 3 is endless by design, so there's no real ceiling to compare
   * against. This is a per-browser personal best, not a shared leaderboard, so it not
   * mattering that it's trivially editable via devtools is by design.
   */
  private finalizeDayEnd(): DayEndSummary {
    const voxxy = this.dayScore.voxxy;
    const droid = this.dayScore.droid;
    const biggy = this.lunchRun!.score;
    const total = voxxy + droid + biggy;

    const previousBest = this.loadBestScore();
    const isNewBest = previousBest === null || total > previousBest;
    if (isNewBest) this.saveBestScore(total);

    return { voxxy, droid, biggy, total, best: isNewBest ? total : previousBest, isNewBest };
  }

  private loadBestScore(): number | null {
    try {
      const raw = localStorage.getItem(BEST_SCORE_KEY);
      if (raw === null || raw.trim() === '') return null; // Number('') is 0, not NaN — would otherwise read as a real (wrong) best of 0
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      return null; // private browsing / storage disabled — just show no best line
    }
  }

  private saveBestScore(total: number): void {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(total));
    } catch {
      // Nothing else depends on this succeeding — the end screen just won't
      // show a "Personal Best" line next time.
    }
  }

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    // Room 4's screen has its own tiny render-loop hook (ExhibitionHall.ts
    // has no ticking of its own otherwise) — live typing/scrolling, not a
    // static bake, matching the user's Gemini reference prototypes' "coding on
    // the screen" feel. Harmless to call outside Room 4 (just redraws an
    // off-screen canvas nobody's looking at), so it's gated to level 2 only
    // to avoid the wasted work, not for correctness.
    if (this.level === 2) updateAuditoriumScreen(dt);
    const activeColliders =
      this.level === 1 ? this.groundColliders : this.level === 2 ? this.firstFloorColliders : this.lunchColliders;
    const finished =
      this.level === 1 ? this.swagRun!.finished : this.level === 2 ? this.knowledgeRun!.finished : this.lunchRun!.finished;

    const currentDown = this.input.downKeys();

    if (this.awaitingStart) {
      // Intro panel is up: the level is frozen (no timer, no hazards, no
      // movement) until the player presses a control key for the first time.
      // Same fresh-press diff as the finished branch below, and for a sharper
      // reason: hud.showIntro() is called from inside onContinue(), so the
      // very key that dismissed the previous level's end screen is still held
      // this frame — a plain isDown() check would start the next level in the
      // same frame its briefing appeared — which is exactly what the old
      // "any key currently down hides the intro" line at the bottom of tick()
      // did, making Levels 2 and 3 flash their panel for a single frame.
      for (const key of START_KEYS) {
        if (currentDown.has(key) && !this.prevDownKeys.has(key)) {
          this.awaitingStart = false;
          this.hud.hideIntro();
          break;
        }
      }
      // Ambient-only tick while frozen — the robot keeps breathing (and a
      // just-swapped GLTF leaves its T-pose) without any of update()'s timers
      // running, so spawn invincibility still starts when play does.
      this.robot.updateIdle(dt);
      this.beerTap.update(dt);
      // No mover passed: a letter already mid-topple when the panel came up
      // keeps falling instead of freezing at an angle, but nothing new gets
      // knocked over while the level is frozen.
      updateDevoxxLetters(dt, this.robot.mapMode);
      // Docks keep their idle ring breathing behind the intro panel; no mover,
      // so nothing charges while the level is frozen.
      updateChargingDocks(dt, this.robot.mapMode);
    } else if (finished) {
      // Freeze in place once the level ends — walking around behind the
      // overlay read as a bug, and it's what the continue prompt is for.
      // Any key continues for Levels 1-2 — the intro panel that follows is
      // stricter (a control key, see the awaitingStart branch above), which
      // is what keeps this screen's keypress from also starting the next
      // level. Level 3's
      // "finished" screen is the whole day's end summary, not just a level
      // transition, and the user specifically wants R there (not any key), so a
      // stray keypress right after the score appears can't restart the day
      // by accident. Either way, this diffs against last frame's held keys
      // rather than checking "is it down right now": a bare "any key is
      // down" test (or checking KeyR alone without the diff) would fire if
      // the relevant key was already held the moment the level finished
      // (e.g. still holding Shift when Biggy falls mid-chase, or already
      // holding R from a previous restart) — a key already down does
      // nothing until it's released and pressed again.
      let justPressed = false;
      if (this.level === 3) {
        justPressed = currentDown.has('KeyR') && !this.prevDownKeys.has('KeyR');
      } else {
        for (const key of currentDown) {
          if (!this.prevDownKeys.has(key)) {
            justPressed = true;
            break;
          }
        }
      }
      if (justPressed) this.onContinue();
    } else {
      this.robot.update(dt, this.input, activeColliders);
      // Shared across levels 1 and 3 (not level 2, where sponsorBoothsGroup
      // is hidden anyway) — animates regardless of which level is active.
      this.beerTap.update(dt);
      // The DEVOXX letters, on whichever floor the robot is actually standing
      // on. Passing the robot's position and size is what lets a glyph topple
      // when he runs into it — size because Biggy's push-out distance grows
      // with him, so a fixed trigger radius would stop firing as he eats (see
      // updateDevoxxLetters).
      updateDevoxxLetters(dt, this.robot.mapMode, {
        x: this.robot.position.x,
        y: this.robot.position.y,
        z: this.robot.position.z,
        sizeScale: this.robot.sizeScale,
      });
      // Charging docks, same shape: ExhibitionHall can't import Robot, so it
      // reports the energy earned by standing on a pad this frame and the
      // restore happens here. Accrued per second rather than handed over in one
      // lump like the kiosks — the cost is the time spent standing there.
      const charge = updateChargingDocks(dt, this.robot.mapMode, {
        x: this.robot.position.x,
        y: this.robot.position.y,
        z: this.robot.position.z,
        sizeScale: this.robot.sizeScale,
      });
      if (charge > 0) this.robot.restoreEnergy(charge);
      // One sound per visit to a pad, not one per frame: charging is a
      // sustained action, so the rising edge of "earning charge" is the event,
      // and stepping off and back on is a new one. Not gated on the level —
      // the pads exist on both floors.
      if (charge > 0 && !this.wasCharging) playSfx('charge-up');
      this.wasCharging = charge > 0;
      // The walk-into-me props. Only the robot is passed as a mover, which is
      // what keeps the attendees out of it — they have no business squeaking a
      // duck, and (see the wet floor) they don't run on electricity.
      for (const kind of updateContactProps(dt, this.robot.mapMode, {
        x: this.robot.position.x,
        y: this.robot.position.y,
        z: this.robot.position.z,
        sizeScale: this.robot.sizeScale,
      })) {
        if (kind === 'duck') playSfx('duck-squeak');
        if (kind === 'wet-floor') this.zapInPuddle();
      }

      if (this.level === 1) {
        const { stunned, pickedUp, drankBeer, rechargedFrom } = this.swagRun!.update(dt, this.robot, activeColliders, this.beerTap);
        if (stunned) {
          this.robot.stun(VOXXY_STUN_DURATION);
          // Purely visual — SwagRun.ts's own stunCooldown already blocks a
          // re-trigger for this same window; this just makes that window
          // visible (see Robot.ts's invincibleTimer comment).
          this.robot.setInvincible(VOXXY_STUN_DURATION + VOXXY_POST_STUN_GRACE);
          playSfx('voxxy-shortcircuit');
        }
        if (pickedUp) playSfx('pickup');
        if (drankBeer) playSfx('beer-pour');
        if (rechargedFrom) playSfx(rechargedFrom === 'coffee' ? 'coffee-pour' : 'candy-drop');
        this.robot.setCarriedItemCount(this.swagRun!.score);
      } else if (this.level === 2) {
        // Hazards get the row-wall-free list (see firstFloorHazardColliders'
        // own comment) — they climb every seat row freely; only the robot's
        // own update() above needs the robotOnly walls.
        const { toppled, toppleToast, collectedQuote } = this.knowledgeRun!.update(dt, this.robot, this.firstFloorHazardColliders);
        if (toppled) {
          this.robot.topple(TOPPLE_DURATION, TOPPLE_RISE_DURATION);
          this.robot.setInvincible(TOPPLE_DURATION + TOPPLE_RISE_DURATION + POST_TOPPLE_GRACE);
          playSfx('droid-thud');
          // No frame-level hook into the rise-phase's own start (that's
          // entirely internal to Robot.ts's toppleDownTimer/toppleRiseTimer);
          // scheduling off the fixed TOPPLE_DURATION is safe here specifically
          // because KnowledgeRun.ts's own stunCooldown already blocks a
          // re-trigger for the whole down+rise+grace window, so this timer
          // can't fire early against a topple that got restarted mid-flight.
          // The level check (here, in zapInPuddle and on Biggy's burp) is for
          // a round that ends inside the delay: time running out mid-topple
          // and a quick keypress would otherwise play Droid getting up over
          // Biggy's briefing.
          setTimeout(() => {
            if (this.level === 2) playSfx('droid-getup');
          }, TOPPLE_DURATION * 1000);
        }
        // Order matters: showQuoteToast() replaces rather than queues, and a
        // same-frame nugget-pickup-plus-hit should surface the topple line,
        // not have it silently clobbered by the pickup quote.
        if (collectedQuote) {
          this.hud.showQuoteToast(collectedQuote);
          playSfx('pickup');
        }
        if (toppleToast) this.hud.showQuoteToast(toppleToast);
      } else {
        const { stumbled, fell, growthToast, pickedUp, drankBeer, rechargedFrom } = this.lunchRun!.update(dt, this.robot, activeColliders, this.beerTap);
        if (fell) {
          this.robot.fallOver();
          playSfx('biggy-fall');
        } else if (stumbled) {
          this.robot.stun(BIGGY_STUMBLE_DURATION);
          this.robot.setInvincible(BIGGY_STUMBLE_DURATION + BIGGY_POST_STUN_GRACE);
          playSfx('hit');
        }
        if (pickedUp) playSfx('pickup');
        if (drankBeer) {
          playSfx('beer-pour');
          // Biggy alone gets the burp (the user: "especially when it is Biggy,
          // a burp is allowed") — level 3 is the only level he's in, so the
          // branch is the check. Scheduled off BEER_POUR_DURATION rather than
          // hooked to the pour finishing: playSfx is fire-and-forget by design
          // and has no completion callback, and the tap's own cooldown is far
          // longer than this delay, so two pours can't overlap into a
          // double-burp.
          setTimeout(() => {
            if (this.level === 3) playSfx('biggy-burp');
          }, BEER_POUR_DURATION * 1000);
        }
        if (rechargedFrom) playSfx(rechargedFrom === 'coffee' ? 'coffee-pour' : 'candy-drop');
        if (growthToast) this.hud.showQuoteToast(growthToast);
      }

      // Timer-low/energy-empty — one-shot on crossing the threshold, not
      // every frame the condition holds (see prevTimeRemaining/
      // prevEnergyFraction's own field comments for the reset discipline).
      if (this.level !== 3) {
        const timeRemaining = this.level === 1 ? this.swagRun!.timeRemaining : this.knowledgeRun!.timeRemaining;
        if (this.prevTimeRemaining > TIMER_LOW_THRESHOLD && timeRemaining <= TIMER_LOW_THRESHOLD) {
          playSfx('timer-low');
        }
        this.prevTimeRemaining = timeRemaining;
      }
      if (this.prevEnergyFraction > 0 && this.robot.energyFraction <= 0) {
        playSfx('energy-empty');
      }
      this.prevEnergyFraction = this.robot.energyFraction;
    }

    this.prevDownKeys = new Set(currentDown);
    // Only now may a touch control's quick tap be let go — this frame has seen it.
    this.input.endFrame();
    this.touchControls.setNewDayVisible(this.level === 3 && this.lunchRun!.finished);

    if (this.level === 1) {
      this.hud.update(this.swagRun!.score, this.swagRun!.timeRemaining, this.swagRun!.finished, this.robot.energyFraction, this.swagRun!.timeBonus, 1);
      this.hud.updateMinimap(
        this.robot.position.x,
        this.robot.position.z,
        this.robot.heading,
        this.swagRun!.swagMarkers,
        [
          { x: COFFEE_MACHINE_POS[0], z: COFFEE_MACHINE_POS[1], color: '#c9a24b' },
          { x: KING_KIOSK_POS[0], z: KING_KIOSK_POS[1], color: '#ff5f8f' },
          ...this.groundDockMarkers,
        ],
        1,
      );
    } else if (this.level === 2) {
      this.hud.update(this.knowledgeRun!.score, this.knowledgeRun!.timeRemaining, this.knowledgeRun!.finished, this.robot.energyFraction, this.knowledgeRun!.timeBonus, 2);
      this.hud.updateMinimap(
        this.robot.position.x,
        this.robot.position.z,
        this.robot.heading,
        this.knowledgeRun!.knowledgeMarkers,
        this.firstFloorDockMarkers,
        2,
      );
    } else {
      // Level 3 finishing is the only way the day ends — tally it exactly
      // once (finalizeDayEnd also writes the personal-best record) and keep
      // reusing the cached summary every subsequent frame the end screen sits
      // on screen, rather than recomputing/rewriting localStorage each frame.
      if (this.lunchRun!.finished && !this.dayEndSummary) {
        this.dayEndSummary = this.finalizeDayEnd();
      }
      // Level 3 has no countdown — survivedTime counts up instead (Hud shows
      // it as "Survived: Xs" for level 3), and there's no time-bonus concept.
      this.hud.update(
        this.lunchRun!.score,
        this.lunchRun!.survivedTime,
        this.lunchRun!.finished,
        this.robot.energyFraction,
        0,
        3,
        this.dayEndSummary,
        this.lunchRun!.hungerFraction,
      );
      this.hud.updateMinimap(
        this.robot.position.x,
        this.robot.position.z,
        this.robot.heading,
        this.lunchRun!.sandwichMarkers,
        [
          { x: JAVA_MACHINE_POS[0], z: JAVA_MACHINE_POS[1], color: '#c9a24b' },
          { x: KING_KIOSK_POS[0], z: KING_KIOSK_POS[1], color: '#ff5f8f' },
          ...this.groundDockMarkers,
        ],
        // Level 3 reuses the ground floor's own map layout for the minimap,
        // regardless of the game-level number.
        1,
      );
    }

    this.hud.updateDebugCoords(this.robot.position.x, this.robot.position.y, this.robot.position.z, this.robot.heading, this.level);
    this.hud.setModelLoading(this.robot.isLoadingModel, this.robot.loadingRobotId);

    const cameraCollidables =
      this.level === 2 ? [this.firstFloorGroup] : [this.groundFloorGroup, this.sponsorBoothsGroup];
    this.followCamera.update(this.robot, dt, cameraCollidables);
    this.renderer.render(this.scene, this.followCamera.camera);
  }
}
