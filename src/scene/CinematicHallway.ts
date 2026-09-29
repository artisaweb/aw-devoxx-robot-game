import * as THREE from 'three';
import { createFoldingTable, createEventChair } from '../props/eventFurniture';

// Pure presentation: this file has no Collider/game-state imports at all, and
// doesn't know which (if any) of its door slots has a real room behind it.
// ExhibitionHall.ts owns those decisions and the numbers that drive them;
// this class just draws what it's told to, the same "caller decides the
// numbers, this just builds geometry" split every other zone in that file
// already follows.

export interface HallwayDoorGap {
  side: 'left' | 'right';
  z: number; // local z (hall-center-relative) of the gap's own center
  halfGap: number; // half-width of the actual wall opening, in z
}

export interface HallwayOpenDoorSlot {
  side: 'left' | 'right';
  z: number; // must match one of doorZPositions exactly (within rounding)
  /** How tall the open frame stands — should reach the real wall's own height on the far side (e.g. Room 4's AUDITORIUM_WALL_HEIGHT) so no gap is left above it. */
  height: number;
}

export interface HallwayPalette {
  floor: number;
  wall: number;
  ceiling: number;
  fabricPillar: number;
  uplightColors: number[]; // cycled across pillar pairs
  furniture: number;
  doorFrame: number;
}

export interface CinematicHallwayOptions {
  corridorHalfWidth: number; // walkable center, half-width
  sideDepth: number; // furniture/door strip depth on each side
  halfLength: number; // half the hall's total length (z extent)
  ceilingHeight: number;
  doorsPerSide: number;
  /** Local z of each door pair, near-end (positive z) to far-end — length must equal doorsPerSide. */
  doorZPositions: number[];
  /** Real openings left in the side walls (e.g. the one door with a real room behind it) — everywhere else the wall is solid, matching every other decorative door in this game (a prop on a solid wall, not a hole). */
  wallGaps?: HallwayDoorGap[];
  /** Door slots that should read as a real, walked-through open doorway (tall posts, no leaf, no glow) instead of the default closed decorative door. */
  openDoorSlots?: HallwayOpenDoorSlot[];
  palette?: Partial<HallwayPalette>;
  /** Real THREE.PointLights are expensive at this scale — only every Nth pillar gets one; the rest still read as lit via the instanced mesh's own emissive material. 1 = every pillar, 0.5 = every other, etc. */
  lightDensity?: number;
}

const DEFAULT_PALETTE: HallwayPalette = {
  floor: 0x0a0a0a,
  wall: 0x050505,
  ceiling: 0x010101,
  fabricPillar: 0xffffff,
  uplightColors: [0xff0088, 0x5500ff, 0x00aaff],
  furniture: 0x111111,
  doorFrame: 0x111111,
};

const PILLAR_SPACING = 18; // matches the prototype's own spacing
const TABLE_SPACING = 6;
const DOOR_WIDTH = 4;
const DOOR_HEIGHT = 3.5;
const DOOR_CLEARANCE_Z = 4.5; // furniture skips within this of any door's own z, same as the prototype

// Collider radii for the furniture/kiosk props below — sized to each prop's
// own geometry (table: BoxGeometry(2, 0.75, 4), chair: BoxGeometry(0.5, 0.6,
// 0.5), kiosk pole+screen: a thin CylinderGeometry(0.05,...) plus a small
// board), same "radius describes the object's own footprint" convention
// `KnowledgeRun.ts`'s `OBSTACLE_DEFS` already uses — the generic
// mover-clearance push-out (`WALL_CLEARANCE`/`MOVER_CLEARANCE` in
// Robot.ts/ExhibitionHall.ts) is what adds the actual walking buffer on top,
// not a fudge factor guessed in here.
const TABLE_COLLIDER_RADIUS = 1.4;
const CHAIR_COLLIDER_RADIUS = 0.35;
const KIOSK_COLLIDER_RADIUS = 0.4;
const FIXTURE_COLLIDER_RADIUS = 0.45;

// Each prop's own true top surface height (local, relative to the hallway's
// own floor) — matches each mesh's own geometry exactly (table center y=0.375
// + half its 0.75 height; chair center y=0.3 + half its 0.6 height; fixture
// puck center y=0.15 + half its 0.3 height), not a guessed clearance number.
// ExhibitionHall.ts uses this both as the jump-clear threshold (a real jump
// clears these trivially, well under the ~1.36 max jump height) and as the
// actual standing-surface height once cleared — without the latter, jumping
// onto a table dropped the mover straight through it to the flat floor below
// (the user: "when jumping on the table, i fall into it").
const TABLE_TOP_HEIGHT = 0.75;
// 0.46 (was 0.6, matching the old plain box's own height) — event-furniture.js's
// createEventChair() has a real 46cm seat height, not a 60cm cube top; kept
// in sync so jumping onto a chair lands on its actual seat, not floating
// above/sinking into it (same bug class as TABLE_TOP_HEIGHT's own comment).
const CHAIR_TOP_HEIGHT = 0.46;
const FIXTURE_TOP_HEIGHT = 0.3;

// Room-number signage, modeled on the real venue's look: a big red
// backdrop panel with an
// oversized white numeral bleeding off the top edge, a black angled door
// panel standing in front of it with a small blue check-in screen set into
// it, and a free-standing kiosk on a pole to the side. Applied to the 7
// closed (decorative) door slots only — Room 4's real open doorway keeps its
// own tall-posts-no-leaf treatment from buildDoorFronts, untouched.
function createRoomNumberTexture(num: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c81e2c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f2f2f2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 640px "Arial Narrow", Arial, sans-serif';
  // Oversized and pushed past the canvas's own bottom/top edges so the
  // numeral bleeds off-panel, matching the reference photo's cropped "7".
  ctx.fillText(String(num), canvas.width / 2, canvas.height * 0.96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let doorSignTexture: THREE.CanvasTexture | null = null;
function getDoorSignTexture(): THREE.CanvasTexture {
  if (doorSignTexture) return doorSignTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#050914';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#2f6fe0';
  ctx.fillRect(12, 12, 104, 104);
  ctx.fillStyle = '#eaf2ff';
  ctx.fillRect(26, 26, 26, 26);
  ctx.fillRect(76, 26, 26, 26);
  ctx.fillRect(26, 76, 26, 26);
  ctx.fillRect(64, 64, 18, 18);
  doorSignTexture = new THREE.CanvasTexture(canvas);
  return doorSignTexture;
}

let kioskScreenTexture: THREE.CanvasTexture | null = null;
function getKioskScreenTexture(): THREE.CanvasTexture {
  if (kioskScreenTexture) return kioskScreenTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, '#ffcf3f');
  grad.addColorStop(1, '#2b6cb8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 122, 128, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEVOXX', 64, 146);
  kioskScreenTexture = new THREE.CanvasTexture(canvas);
  return kioskScreenTexture;
}

export class CinematicHallway extends THREE.Group {
  readonly corridorHalfWidth: number;
  readonly sideDepth: number;
  readonly halfLength: number;
  readonly ceilingHeight: number;
  readonly doorZPositions: number[];
  private readonly palette: HallwayPalette;
  private readonly openDoorSlots: HallwayOpenDoorSlot[];
  /** Local x/z/uplight-color of every pillar that got a real light+fixture mesh — populated by buildPillars(), purely for the fixture's own emissive colour (visual only). */
  private litPillarFixtures: { x: number; z: number; color: number }[] = [];
  /** Local x/z of every pillar, lit or not — populated by buildPillars(), read by pillarColliderPositions(). Every pillar gets the same collider regardless of whether it also got a light+fixture. */
  private allPillarXZ: { x: number; z: number }[] = [];

  constructor(options: CinematicHallwayOptions) {
    super();
    this.corridorHalfWidth = options.corridorHalfWidth;
    this.sideDepth = options.sideDepth;
    this.halfLength = options.halfLength;
    this.ceilingHeight = options.ceilingHeight;
    this.doorZPositions = options.doorZPositions;
    this.palette = { ...DEFAULT_PALETTE, ...options.palette };
    this.openDoorSlots = options.openDoorSlots ?? [];
    const lightDensity = options.lightDensity ?? 0.5;
    const wallGaps = options.wallGaps ?? [];

    const halfWidth = this.corridorHalfWidth + this.sideDepth;

    this.buildFloorAndCeiling(halfWidth);
    this.buildSideWalls(halfWidth, wallGaps);
    this.buildPillars(lightDensity);
    this.buildFurniture(halfWidth);
    this.buildDoorFronts(this.openDoorSlots);
  }

  /** Local (hall-center-relative) x/z/side of the 7 door slots with no real room behind them — the ones buildRoomSignage() actually decorates. Shared by buildDoorFronts() and the collider getters below so "which slots are closed" has one answer. */
  private closedSlotPositions(): { x: number; z: number; side: 'left' | 'right' }[] {
    const isOpen = (slot: { side: 'left' | 'right'; z: number }) =>
      this.openDoorSlots.some((o) => o.side === slot.side && Math.abs(o.z - slot.z) < 0.01);
    return this.doorLocalPositions().filter((s) => !isOpen(s));
  }

  /** Local z of every table/chair furniture slot (doors' own clearance zones excluded) — shared by buildFurniture() and furnitureColliderPositions() so both agree on where furniture actually stands. */
  private furnitureSlotZ(): number[] {
    const slots: number[] = [];
    for (let z = -this.halfLength + TABLE_SPACING; z <= this.halfLength - TABLE_SPACING; z += TABLE_SPACING) {
      const nearDoor = this.doorZPositions.some((dz) => Math.abs(z - dz) < DOOR_CLEARANCE_Z);
      if (!nearDoor) slots.push(z);
    }
    return slots;
  }

  /** Local x/z/radius/topHeight for every table and chair — real Colliders so the hallway's furniture actually blocks movement instead of being walk-through set dressing (the user: "the lamp and tables/chairs should be real objects, now we can just walk through"). ExhibitionHall.ts adds its own hall-center world offset, same as doorLocalPositions(). */
  furnitureColliderPositions(): { x: number; z: number; radius: number; topHeight: number }[] {
    const halfWidth = this.corridorHalfWidth + this.sideDepth;
    const tableX = halfWidth - this.sideDepth * 0.3;
    const chairX = halfWidth - this.sideDepth * 0.6;
    const colliders: { x: number; z: number; radius: number; topHeight: number }[] = [];
    this.furnitureSlotZ().forEach((z) => {
      for (const side of [-1, 1]) {
        colliders.push({ x: side * tableX, z, radius: TABLE_COLLIDER_RADIUS, topHeight: TABLE_TOP_HEIGHT });
        for (const chairOffset of [-1.2, 1.2]) {
          colliders.push({ x: side * chairX, z: z + chairOffset, radius: CHAIR_COLLIDER_RADIUS, topHeight: CHAIR_TOP_HEIGHT });
        }
      }
    });
    return colliders;
  }

  /** Local x/z/radius for every closed door slot's free-standing check-in kiosk (the pole + glowing screen that reads as a floor lamp) — same reasoning as furnitureColliderPositions(). */
  kioskColliderPositions(): { x: number; z: number; radius: number }[] {
    return this.closedSlotPositions().map((slot) => {
      const inward = slot.side === 'left' ? 1 : -1;
      return { x: slot.x + inward * 0.9, z: slot.z - 1.6, radius: KIOSK_COLLIDER_RADIUS };
    });
  }

  /**
   * Local x/z/radius for every pillar's base, lit or not — every pillar gets
   * the same small footprint collider regardless of whether it also got a
   * light+fixture, so movement blocking doesn't depend on which pillars
   * happened to draw the lightDensity roll (the user: "the light effect on the
   * pillars is nice, but some have no light effect and can be walked
   * through"). `height` is left for ExhibitionHall.ts to attach (it needs the
   * hallway's own absolute world Y, which this pure-presentation class
   * doesn't track) — a jump-clearable collider, not a flat wall, per the user's
   * "I would prefer if we are able to jump on it".
   */
  pillarColliderPositions(): { x: number; z: number; radius: number; topHeight: number }[] {
    return this.allPillarXZ.map((p) => ({ x: p.x, z: p.z, radius: FIXTURE_COLLIDER_RADIUS, topHeight: FIXTURE_TOP_HEIGHT }));
  }

  /** Local (hall-center-relative) x/z of every door slot, near-end first — ExhibitionHall.ts adds its own hall-center world offset to these. */
  doorLocalPositions(): { x: number; z: number; side: 'left' | 'right' }[] {
    const halfWidth = this.corridorHalfWidth + this.sideDepth;
    const positions: { x: number; z: number; side: 'left' | 'right' }[] = [];
    for (const z of this.doorZPositions) {
      positions.push({ x: -halfWidth, z, side: 'left' });
      positions.push({ x: halfWidth, z, side: 'right' });
    }
    return positions;
  }

  private buildFloorAndCeiling(halfWidth: number): void {
    const floorMat = new THREE.MeshStandardMaterial({ color: this.palette.floor, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2, this.halfLength * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);

    // Unlit and basic-material on purpose — the "blackout" canvas the real
    // venue photos show reads as a near-void overhead, not a lit surface.
    const ceilingMat = new THREE.MeshBasicMaterial({ color: this.palette.ceiling });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2, this.halfLength * 2 + 20), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.ceilingHeight;
    this.add(ceiling);
  }

  private buildSideWalls(halfWidth: number, wallGaps: HallwayDoorGap[]): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: this.palette.wall, roughness: 1 });
    const wallHeight = this.ceilingHeight * 0.7;

    for (const side of ['left', 'right'] as const) {
      const x = side === 'left' ? -halfWidth : halfWidth;
      const gaps = wallGaps
        .filter((g) => g.side === side)
        .sort((a, b) => a.z - b.z);
      // Build the wall as the spans *between* gaps (and before/after the
      // first/last one) — a real opening only where the caller asked for
      // one, solid everywhere else, same principle as every other wall in
      // this game (a decorative door is a prop on a solid wall, not a hole).
      const spanStarts = [-this.halfLength, ...gaps.map((g) => g.z + g.halfGap)];
      const spanEnds = [...gaps.map((g) => g.z - g.halfGap), this.halfLength];
      for (let i = 0; i < spanStarts.length; i++) {
        const z1 = spanStarts[i];
        const z2 = spanEnds[i];
        const len = z2 - z1;
        if (len <= 0.01) continue;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, wallHeight, len), wallMat);
        wall.position.set(x, wallHeight / 2, z1 + len / 2);
        this.add(wall);
      }
    }
  }

  private buildPillars(lightDensity: number): void {
    const pillarX = this.corridorHalfWidth + this.sideDepth * 0.4; // planted in the furniture strip, not the walkway
    const pillarHeight = this.ceilingHeight * 0.65;
    const geo = new THREE.CylinderGeometry(2.5, 0.5, pillarHeight, 24, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      color: this.palette.fabricPillar,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x1a0a12,
      emissiveIntensity: 0.4,
    });

    const positions: { x: number; z: number; colorIndex: number }[] = [];
    let colorIndex = 0;
    for (let z = -this.halfLength + PILLAR_SPACING / 2; z <= this.halfLength - PILLAR_SPACING / 2; z += PILLAR_SPACING) {
      positions.push({ x: -pillarX, z, colorIndex });
      positions.push({ x: pillarX, z, colorIndex });
      colorIndex++;
    }

    const pillars = new THREE.InstancedMesh(geo, mat, positions.length);
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m.makeTranslation(p.x, pillarHeight / 2, p.z);
      pillars.setMatrixAt(i, m);
    });
    pillars.instanceMatrix.needsUpdate = true;
    this.add(pillars);
    this.allPillarXZ = positions.map((p) => ({ x: p.x, z: p.z }));

    // Real dynamic lights only every Nth pillar *pair* (lightDensity) — one
    // per pillar at this hall's length would be dozens of live PointLights, a
    // real perf cost the "keep draw calls low" ask is about even though it
    // only named the InstancedMesh swaps explicitly. Skipped pillars still
    // read as lit via the fabric's own emissive tint above.
    //
    // Selecting by `colorIndex` (one per z, shared by both sides) rather than
    // by `positions`' own flat array index — `positions` interleaves
    // left/right per z (even index = left, odd = right), and with
    // lightDensity 0.5 the resulting step of 2 exactly matched that
    // interleaving, so `i % step === 0` was *always* the left pillar and
    // *never* the right one, hall-length-wide (the user: "the pillars on the
    // right side are not lighting up"). Selecting per z-pair and lighting
    // both sides together avoids that alias entirely, and reads as the more
    // natural design anyway — a real venue wouldn't light one side of a
    // pillar pair and not its mirror.
    const step = Math.max(1, Math.round(1 / Math.max(lightDensity, 0.01)));
    const colors = this.palette.uplightColors;
    const fixtureGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.3, 16);
    const litPillars: { x: number; z: number; color: number }[] = [];
    positions.forEach((p) => {
      if (p.colorIndex % step !== 0) return;
      const color = colors[p.colorIndex % colors.length];
      litPillars.push({ x: p.x, z: p.z, color });

      // A real, visible uplighter fixture at the pillar's base, fully in its
      // own assigned colour — not just a bare light source with nothing to
      // see or collide with (the user: "the lamp... should be real objects, now
      // we can just walk through"). fixtureColliderPositions() gives it a
      // matching Collider.
      const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        emissive: color,
        emissiveIntensity: 2.2,
        roughness: 0.5,
      });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(p.x, 0.15, p.z);
      this.add(fixture);

      // Positioned just outside the tube's own tapered surface (not on its
      // central axis) — a light on the axis sits *behind* the visible
      // exterior face relative to its outward normal, so standard N·L
      // lighting gives it almost nothing to work with no matter how strong
      // it is; that's the real reason "only the bottom has a little bit of
      // the colour" (the base's steep taper was the one place the axis
      // still barely counted as "outward"). Offset by the pillar's own
      // radius at this height (from the same 2.5→0.5 taper CylinderGeometry
      // above uses) plus a hair of clearance, toward the corridor side —
      // grazing light up a real surface instead of glowing from inside it.
      // Shallower falloff (decay 1, not the default 2) carries the colour
      // further up the pillar's height too (the user: "the lamps should...give
      // more light / being fully in the colour").
      const lightHeightFraction = 0.35;
      const pillarRadiusAtLightHeight = 2.5 - lightHeightFraction * (2.5 - 0.5);
      const inward = p.x < 0 ? 1 : -1; // toward the corridor centerline
      const light = new THREE.PointLight(color, 9, 26, 1);
      light.position.set(p.x + inward * (pillarRadiusAtLightHeight + 0.15), pillarHeight * lightHeightFraction, p.z);
      this.add(light);
    });
    this.litPillarFixtures = litPillars;
  }

  // Real event-furniture.js models (src/props/) instead of plain instanced
  // boxes — per the user's own call after the instancing-vs-real-models
  // tradeoff was raised directly ("commit first what was already adapted,
  // then go ahead with this"). No InstancedMesh equivalent in that
  // generator, so this is genuinely more draw calls at hallway scale
  // (~29 table slots × 2 sides × (1 table + 2 chairs) ≈ 170 objects) —
  // flagged for a real FPS check after building, not assumed fine.
  private buildFurniture(halfWidth: number): void {
    const slots = this.furnitureSlotZ();
    const tableX = halfWidth - this.sideDepth * 0.3;
    const chairX = halfWidth - this.sideDepth * 0.6;
    // width/depth swapped from event-furniture.js's own default (1.2 wide x
    // 0.6 deep, front along +Z) to match the old box's footprint (2 wide x
    // 4 deep along the hallway's own length) — keeps TABLE_COLLIDER_RADIUS
    // meaningful without re-tuning it.
    slots.forEach((z) => {
      for (const side of [-1, 1] as const) {
        const table = createFoldingTable({ width: 2, depth: 4, height: TABLE_TOP_HEIGHT, color: this.palette.furniture });
        table.object.position.set(side * tableX, 0, z);
        this.add(table.object);

        for (const chairOffset of [-1.2, 1.2]) {
          const chair = createEventChair();
          chair.object.position.set(side * chairX, 0, z + chairOffset);
          // Faces the table (which sits further from the corridor center
          // than the chair does) — default orientation faces +Z.
          chair.object.rotation.y = side * (Math.PI / 2);
          this.add(chair.object);
        }
      }
    });
  }

  private buildDoorFronts(openDoorSlots: HallwayOpenDoorSlot[]): void {
    const findOpen = (slot: { side: 'left' | 'right'; z: number }) =>
      openDoorSlots.find((o) => o.side === slot.side && Math.abs(o.z - slot.z) < 0.01);

    const allSlots = this.doorLocalPositions();
    const closedSlots = this.closedSlotPositions();

    // Closed decorative doors — real venue-photo signage (see the comment
    // above createRoomNumberTexture). Only 7 of these exist, so building each
    // individually (rather than instancing) is the simpler choice — an
    // InstancedMesh needs one shared material/texture, but each door's red
    // panel carries its own room number.
    this.buildRoomSignage(closedSlots);

    // Real open doorways: no leaf, no glow — just two tall posts flanking
    // the gap, reaching the real wall's own height on the far side (passed
    // in per slot) so there's no open strip left above a shorter frame —
    // exactly the gap that let the hallway show through above the old
    // door-height frame from deep inside the room.
    const postMat = new THREE.MeshStandardMaterial({ color: this.palette.doorFrame });
    allSlots.forEach((slot) => {
      const open = findOpen(slot);
      if (!open) return;
      const inward = slot.side === 'left' ? 1 : -1;
      const postX = slot.x + inward * 0.25;
      const halfDoorWidth = DOOR_WIDTH / 2;
      for (const postZ of [slot.z - halfDoorWidth - 0.25, slot.z + halfDoorWidth + 0.25]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, open.height, 0.5), postMat);
        post.position.set(postX, open.height / 2, postZ);
        this.add(post);
      }
      const light = new THREE.PointLight(0xffffff, 1.2, 10);
      light.position.set(slot.x + inward * 2, open.height * 0.6, slot.z);
      this.add(light);
    });
  }

  /** Real floor-plan room numbers: left side runs 3→6, right side 10→7, both near-end to far-end — matches `doorZPositions`' own near-to-far ordering (index 1 is Room 4, confirmed by ExhibitionHall.ts's own ROOM4_ZONE anchor). */
  private roomNumberForSlot(slot: { side: 'left' | 'right'; z: number }): number {
    const idx = this.doorZPositions.indexOf(slot.z);
    return slot.side === 'left' ? 3 + idx : 10 - idx;
  }

  private buildRoomSignage(closedSlots: { x: number; z: number; side: 'left' | 'right' }[]): void {
    const wallHeight = this.ceilingHeight * 0.7;
    const panelHeight = wallHeight * 0.85;
    const panelWidth = 5.5;
    const doorSignTexture = getDoorSignTexture();
    const kioskTexture = getKioskScreenTexture();

    closedSlots.forEach((slot) => {
      const inward = slot.side === 'left' ? 1 : -1;
      const num = this.roomNumberForSlot(slot);
      const group = new THREE.Group();

      // Red backdrop panel, numeral bleeding off the top — same read as the
      // real venue's room-number signage. Emissive (not just lit), same
      // convention as the fabric pillars above — a plain lit material reads
      // as flat black in this hallway's near-zero ambient light.
      const numTexture = createRoomNumberTexture(num);
      const backdropMat = new THREE.MeshStandardMaterial({
        map: numTexture,
        emissive: 0xffffff,
        emissiveMap: numTexture,
        emissiveIntensity: 0.5,
        roughness: 0.85,
      });
      const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth, panelHeight), backdropMat);
      // Clears the solid wall's own face (the wall box extends to slot.x +
      // inward*0.25) — any closer and the panel sits inside the wall's own
      // geometry, invisible from the corridor.
      backdrop.position.set(slot.x + inward * 0.3, panelHeight / 2, slot.z);
      backdrop.rotation.y = (inward * Math.PI) / 2;
      group.add(backdrop);

      // Black double doors, centered on the backdrop panel and flush with
      // its own facing (no extra twist) — sized as a real double-door pair
      // rather than one narrow leaf, and centered on the panel's own z so it
      // reads as standing ON the red backdrop instead of off to one side of
      // it (both were reported as wrong: "the door is a bit small (double
      // doors instead) and it is not placed on it").
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
      const doorHeight = panelHeight * 0.6;
      const leafWidth = panelWidth * 0.4;
      // Leaves overlap slightly rather than sitting a real gap apart — a real
      // gap let the red backdrop show through the slit, which read as "the
      // door has nothing behind it" instead of a closed double door (the user:
      // "if we remove the small gap between the two doors, it is no longer
      // visually that there is nothing behind it"). The seam itself still
      // reads from the two leaves' own edges/lighting, no gap needed for it.
      const leafOverlap = 0.03;
      const doorAngle = (inward * Math.PI) / 2;
      const doorX = slot.x + inward * 0.32;
      for (const leafSide of [-1, 1] as const) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, doorHeight, 0.15), doorMat);
        leaf.position.set(doorX, doorHeight / 2, slot.z + leafSide * (leafWidth / 2 - leafOverlap));
        leaf.rotation.y = doorAngle;
        group.add(leaf);
      }

      // Small blue check-in screen set into the right-hand leaf, facing the
      // same way as the doors.
      const signMat = new THREE.MeshBasicMaterial({ map: doorSignTexture });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), signMat);
      sign.position.set(doorX + inward * 0.09, doorHeight * 0.55, slot.z + leafWidth / 2 - leafOverlap);
      sign.rotation.y = doorAngle;
      group.add(sign);

      // Free-standing check-in kiosk on a pole beside the door, matching the
      // reference photo's stand-alone screen next to the black panel.
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), poleMat);
      pole.position.set(slot.x + inward * 0.9, 0.75, slot.z - 1.6);
      group.add(pole);
      const kioskMat = new THREE.MeshBasicMaterial({ map: kioskTexture });
      const kiosk = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.65), kioskMat);
      kiosk.position.set(slot.x + inward * 0.9, 1.55, slot.z - 1.6);
      kiosk.rotation.y = (inward * Math.PI) / 2;
      group.add(kiosk);

      const light = new THREE.PointLight(0xff3344, 1, 8);
      light.position.set(slot.x + inward * 1.5, panelHeight * 0.7, slot.z);
      group.add(light);

      this.add(group);
    });
  }
}
