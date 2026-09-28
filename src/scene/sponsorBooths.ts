import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Collider, BOOTH_PLATFORM_ZONES } from './ExhibitionHall';
import { SPONSOR_SIGNAGE, BELGIAN_PROVINCES } from '../text/signage';
import { createBeerTap as createBeerTapAsset, BeerTap } from '../props/beerTap';

// Seven sponsor-booth set pieces from the brainstorm in
// assets/reference/venue/ground-floor-reception-and-exhibition/sponsor-booths.md —
// original stylized props referencing each sponsor by name/product, not their
// actual logos/trademarks (same reasoning as the NPC-likeness policy in
// docs/game-design.md: a wink for people who recognize it, never a
// reproduction). Two (RocketMind, Goggles Cloud) are the jumpable furniture
// from BOOTH_PLATFORM_ZONES in ExhibitionHall.ts — that file is the single
// source of truth for their footprint/height, this module just places
// matching visuals. The other five are solid ground-level landmarks with
// colliders from getBoothColliders(), which both the player (Game.ts) and
// hazards (SwagRun.ts) route around. KING's interactive candy kiosk itself is
// built by SwagRun.ts (mirrors the JAVA machine's per-frame cooldown logic) —
// this module only places its statue landmark; KING_KIOSK_POS is exported so
// the two sit next to each other without overlapping.
//
// Layout is spread across the open floor in two vertical columns (x ≈ -25 and
// x ≈ 25) running the depth of the hall — matching a real expo hall (see
// hall-interior-crowd-wide.jpg: kiosks scattered among the crowd, not backed
// against a wall) rather than lining the walls. Deliberately clear of the
// center lane (x ≈ 0), which is where COFFEE_MACHINE_POS (SwagRun.ts) already
// sits — columns leave it standing clear, which also happens to roughly
// match its real-world spot. "Devoxx Polo Pickup" is the one thing that's
// actually wall-mounted, being a fixed venue fixture, not a booth — see
// docs/venue-map.svg for how these land relative to both the code hall
// (60x40) and the architect's real, slightly smaller plan.
//
// x≈±25 clears the column grid's last line (COLUMN_SPACING=10, columns at
// x=±10/±20) with real margin, in the strip between the columns and the
// outer wall (HALL_WIDTH/2 - wallClearance ≈ 28.8, so there's still a
// comfortable buffer to the wall itself) — wide enough for each booth's own
// internal gaps to work as a real hazard-evasion mechanic, not just a
// pickup-reachability afterthought.

// The candy machine is a separate object (built by SwagRun.ts, not part of
// createKINGBooth's own group), so unlike every other prop below it can't
// ride along with a rotateBooth() wrapper — this constant is its real,
// final, already-in-world-space position, chosen directly (not rotated at
// all, since nothing rotates it).
// Whole KING cluster (LION/TABLE/SHELF/KIOSK/BOOTH_PLATFORM_ZONES[2]) shifted
// by the same (+6, +2) — see BOOTH_PLATFORM_ZONES's own comment in
// ExhibitionHall.ts for why (1.5x hall resize + new Stairs A/B enclosures).
// A rigid shift keeps every sub-position's offset from KING_LION_POS
// (the rotation pivot) identical, so the booth's internal layout is
// untouched — only where the whole cluster sits moved.
// Whole cluster shifted by (+10, 0) — the user: "move the king booth to the
// outer wall." Backdrop's own +x extent (roughly cx+1.65 after rotation)
// leaves 3.35m clear of the wall at x=45 (and the robot's own hard clamp
// at x=43.8), while x=40 sits past the column grid's own last line (35),
// same "booth in the wall-margin strip beyond the last column" pattern
// Vaultius/every other booth already uses.
export const KING_KIOSK_POS: [number, number] = [37, -4];
const KING_LION_POS: [number, number] = [40, -11];
// Right column (x>0): -90° turns the booth's built-in +z front to face -x,
// toward the hall center. Pivot is the lion statue itself, not the booth's
// floor-pad center — arbitrary but fine, since rotateBooth/rotateCollider
// are exact for any pivot.
const KING_ROTATION = { cx: KING_LION_POS[0], cz: KING_LION_POS[1], angle: -Math.PI / 2 };
// Pre-rotation local position of the high-top table mesh — deliberately
// NOT the same value as BOOTH_PLATFORM_ZONES[2] (its real, post-rotation
// world position): this group gets rotated by rotateBooth() after being
// built, so a mesh placed at the zone's own (already-rotated) x/z would be
// rotated a SECOND time, landing it somewhere else entirely from its own
// jump-platform collision. Rotating this local point through KING_ROTATION
// lands exactly on BOOTH_PLATFORM_ZONES[2].
const KING_TABLE_LOCAL: [number, number] = [36, -8];
// Relocated (2026-09-27): the user — "the vaultius booth should be placed
// somewhere else in a good location" — the back-left corner it landed in
// after the hall resize sat only 6m from the outer wall and right beside
// the new Stairs A enclosure/left lunch table cluster, a cramped, easy-to-
// miss spot. Moved to the open front-center floor (previously nothing but
// the beer tap and the middle lunch table out there), clear of the column
// grid, both stair enclosures, and every other prop.
const VAULTIUS_VAULT_POS: [number, number] = [-10, 18];
// Pivot for rotateBooth/rotateCollider — the floor pad's own center
// (VAULTIUS_VAULT_POS[1] - 0.2, matching floorNeon's placement below), not
// the vault position itself, so the pad stays centered under the booth
// after rotating. Left column (x<0): +90° turns the booth's built-in +z
// front to face +x, toward the hall center.
const VAULTIUS_ROTATION = { cx: VAULTIUS_VAULT_POS[0], cz: VAULTIUS_VAULT_POS[1] - 0.2, angle: Math.PI / 2 };
// Shifted by (-5, +8) — same reasoning as KING/BOOTH_PLATFORM_ZONES above.
const MIRACLE_CAR_POS: [number, number] = [-30, 24];
const MIRACLE_ROTATION = { cx: MIRACLE_CAR_POS[0], cz: MIRACLE_CAR_POS[1] - 0.4, angle: Math.PI / 2 };
// Shifted by (-5, +1) — same reasoning as KING/BOOTH_PLATFORM_ZONES above.
const TINY_CENTER: [number, number] = [-30, 6];
const TINY_ROTATION = { cx: TINY_CENTER[0], cz: TINY_CENTER[1] - 0.2, angle: Math.PI / 2 };
// Right column, between KING and Goggles Cloud — completes the 7th platinum
// sponsor from sponsor-booths.md alongside the other six. Shifted by
// (+5, +1) — same reasoning as KING/BOOTH_PLATFORM_ZONES above.
const OMNIWARE_POS: [number, number] = [30, 4];
const OMNIWARE_ROTATION = { cx: OMNIWARE_POS[0], cz: OMNIWARE_POS[1] - 0.2, angle: -Math.PI / 2 };
// Ghost offset from the real rack, in each direction. 4.5 is the smallest
// value that clears both the real rack's own collider AND OmniWare's own
// backdrop-wall colliders by a real margin, so you can actually walk between
// each rack rather than seeing three racks with no walkable gap between them.
const OMNIWARE_GHOST_OFFSET = 4.5;
// RocketMind's and Goggles Cloud's desks are pivoted about their own zone
// center (BOOTH_PLATFORM_ZONES swapped halfW/halfD to match, in
// ExhibitionHall.ts), so position is unchanged — only the angle matters.
const ROCKETMIND_ROTATION = { cx: BOOTH_PLATFORM_ZONES[0].x, cz: BOOTH_PLATFORM_ZONES[0].z, angle: Math.PI / 2 };
const GOGGLES_ROTATION = { cx: BOOTH_PLATFORM_ZONES[1].x, cz: BOOTH_PLATFORM_ZONES[1].z, angle: -Math.PI / 2 };

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, ...opts });
}

function cssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// Every booth below was built facing along +/-z, as if backed against a wall
// behind the aisle. A real expo booth standing in a side column instead
// faces sideways INTO the aisle that runs past it (see
// hall-interior-crowd-wide.jpg: kiosks along both sides, fronts turned
// toward the center walkway) — rotateBooth()/rotateCollider() turn a
// booth's front from +z to face the hall center (+x for the left column at
// x≈-18, -x for the right column at x≈18) around a given pivot point,
// without touching any of the booth's own local geometry.
function rotateBooth(booth: THREE.Object3D, cx: number, cz: number, angle: number): THREE.Object3D {
  const pivot = new THREE.Group();
  pivot.position.set(cx, 0, cz);
  booth.position.set(-cx, 0, -cz);
  pivot.rotation.y = angle;
  pivot.add(booth);
  return pivot;
}

function rotateCollider(c: Collider, cx: number, cz: number, angle: number): Collider {
  const dx = c.x - cx;
  const dz = c.z - cz;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { ...c, x: cx + dx * cos + dz * sin, z: cz - dx * sin + dz * cos };
}

// Print-poster style texture — a solid accent-color panel with bold white
// text, styled after the real sponsor's real flat-orange banner in
// assets/reference/venue/ground-floor-reception-and-exhibition/booths/ing-booth.jpeg
// rather than a glowing sci-fi screen, which is what the original
// sprite-based sign looked like. Matte MeshStandardMaterial (no emissive, no
// transparency) — print signage, not a digital display. No header/label text
// (dropped per feedback — it read as clutter, not part of what any booth
// actually needs to say).
function createBannerTexture(text: string, accentCss: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = accentCss;
  ctx.fillRect(0, 0, w, h);

  const maxTextWidth = w - 60;
  let fontSize = 72;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (ctx.measureText(text).width > maxTextWidth && fontSize > 28) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Same print-poster look as createBannerTexture above, but on a wide,
// short canvas (~5.8:1) matching the small in-booth name signs that
// actually use it (KING/Vaultius's own PlaneGeometry, ~3.2x0.55/2.6x0.45) —
// createBannerTexture's own canvas is portrait (512x640, built for the
// standalone pylon banners' own tall aspect), and a texture always stretches
// to fill whatever plane it's mapped onto with no aspect correction of its
// own, so reusing it here squished the text down to a barely-readable sliver
// (the user: "the text is barely readable on the booth"). Font sizing/fit logic
// otherwise identical.
function createBoothSignTexture(text: string, accentCss: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 165;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = accentCss;
  ctx.fillRect(0, 0, w, h);

  const maxTextWidth = w - 80;
  let fontSize = 110;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (ctx.measureText(text).width > maxTextWidth && fontSize > 40) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const BANNER_WIDTH = 0.55;
const BANNER_HEIGHT = 2.1;

/**
 * A free-standing, reusable "totem" banner: a square pylon with the same
 * print-poster texture on all four vertical faces (BoxGeometry's material
 * order is [+x, -x, +y, -y, +z, -z], so the name reads correctly whichever
 * side the player approaches from — a physical pylon reads as real event
 * signage, where a camera-facing Sprite would look flat/digital) on a short
 * round foot, standing on the floor beside its booth rather than floating in
 * the air.
 */
function createBoothBanner(text: string, accentHex: number, x: number, z: number): THREE.Object3D {
  const texture = createBannerTexture(text, cssHex(accentHex));
  const sideMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
  const capMat = mat(accentHex, { roughness: 0.6 });

  const pylon = new THREE.Mesh(
    new THREE.BoxGeometry(BANNER_WIDTH, BANNER_HEIGHT, BANNER_WIDTH),
    [sideMat, sideMat, capMat, capMat, sideMat, sideMat],
  );
  pylon.position.y = BANNER_HEIGHT / 2;

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 16), mat(0x2b2b2b, { roughness: 0.6 }));
  base.position.y = 0.06;

  const group = new THREE.Group();
  group.add(base, pylon);
  group.position.set(x, 0, z);
  return group;
}

// RocketMind's own gradient sign texture (magenta -> orange -> yellow) with
// its name + tagline — distinct from every other booth's flat-accent banner,
// fitting its "sci-fi IDE of 2040" framing rather than diluting it into the
// shared plain style.
function createRocketMindSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 213; // matches createHangingBoothSign's 1.8:0.75 plate aspect
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#ff0055');
  gradient.addColorStop(0.5, '#ff5500');
  gradient.addColorStop(1, '#ffaa00');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.rocketMind.name, canvas.width / 2, 88);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(SPONSOR_SIGNAGE.rocketMind.tagline, canvas.width / 2, 148);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Simulated floating lines of code inside the holographic screen — reads
// clearly as "an IDE" rather than a flat glowing rectangle.
function createCodeScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0a1622';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4fd1ff';
  for (const y of [22, 40, 58, 76, 94, 112, 130]) {
    ctx.fillRect(16, y, 60 + Math.random() * 140, 8);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The literal rocket the booth is named after — a low-poly prop standing
// near the jump-desk, per the generated concept art. Purely decorative
// (see getBoothColliders() for its collider).
// Offset (0, +5.0) from the desk (BOOTH_PLATFORM_ZONES[0]), in the local
// pre-rotation frame — +z is the only direction with real room: pushing
// further in local x runs into the actual hall wall (this booth's local x
// maps to world z after its rotation, and the wall clamp is only ~1.6m
// further out), while pushing in -z runs straight into this booth's own
// backdrop wall 2.3m away. +z also happens to land the rocket toward the
// aisle the booth's rotated front faces.
const ROCKETMIND_ROCKET_POS: [number, number] = [BOOTH_PLATFORM_ZONES[0].x, BOOTH_PLATFORM_ZONES[0].z + 5.0];
function createRocketProp(x: number, z: number): THREE.Object3D {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 16), mat(0x1c1c1e, { roughness: 0.5, metalness: 0.4 }));
  pad.position.set(x, 0.05, z);
  group.add(pad);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 10), mat(0xf0f0f0, { roughness: 0.25 }));
  body.position.set(x, 0.5, z);
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 10), mat(0xff0055, { roughness: 0.2 }));
  nose.position.set(x, 1.075, z);
  group.add(nose);

  const finGeom = new THREE.BoxGeometry(0.05, 0.35, 0.22);
  const finMat = mat(0x1c1c1e, { roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const fin = new THREE.Mesh(finGeom, finMat);
    fin.position.set(x + Math.cos(angle) * 0.2, 0.28, z + Math.sin(angle) * 0.2);
    fin.rotation.y = -angle;
    fin.rotation.x = 0.15;
    group.add(fin);
  }

  return group;
}

// A small shelf unit with folded-item props — first built for KING, now
// shared so a second booth wanting the same "real photo has a swag shelf"
// detail doesn't duplicate it. Purely decorative (no relation to SwagRun's
// real pickup system). `shelfColor` is the wood/metal the shelf boards
// themselves are made of; `foldColors` are the folded items sitting on them
// (one per shelf, bottom to top).
function createSwagShelf(x: number, z: number, shelfColor: number, foldColors: number[]): THREE.Object3D {
  const group = new THREE.Group();
  const shelfMat = mat(shelfColor, { roughness: 0.7 });
  for (let i = 0; i < foldColors.length; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.5), shelfMat);
    shelf.position.set(x, 0.4 + i * 0.45, z);
    group.add(shelf);
  }
  foldColors.forEach((color, i) => {
    const fold = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), mat(color, { roughness: 0.8 }));
    fold.position.set(x - 0.15 + i * 0.16, 0.4 + i * 0.45 + 0.08, z);
    group.add(fold);
  });
  return group;
}

// A physical bronze key, lying flat — Vaultius's own counter display.
function createDisplayKey(x: number, y: number, z: number, rotationY: number): THREE.Object3D {
  const group = new THREE.Group();
  const bronze = mat(0xcd7f32, { roughness: 0.3, metalness: 0.8 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 10), bronze);
  group.add(shaft);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.02, 10, 16), bronze);
  bow.position.y = 0.19;
  group.add(bow);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), bronze);
  teeth.position.y = -0.15;
  group.add(teeth);
  group.rotation.x = Math.PI / 2;
  group.rotation.z = rotationY;
  group.position.set(x, y, z);
  return group;
}

// Classic green ATM welcome screen — a Euro sign, since the real sponsor
// this parodies is a Belgian/Dutch bank.
function createATMScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#04140a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4fe37a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('€', canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Miracle Systems' backdrop screen — name + a genuinely neutral corporate
// slogan about performance, not licensing cost (see docs/game-design.md): the
// joke lives entirely in the name/rhyme and the F1 car, never in anything
// that reads as a real complaint about the real sponsor's licensing.
function createMiracleSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#111116';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d90429';
  ctx.fillRect(0, 0, canvas.width, 20);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.miracleSystems.name, canvas.width / 2, 170);
  ctx.fillStyle = '#ffb703';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.miracleSystems.tagline, canvas.width / 2, 260);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A single F1 wheel — tire, chrome rim, gold center cap — shared by all four
// corners of the car below.
function createRacingWheel(radius: number, width: number): THREE.Object3D {
  const group = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), mat(0x1c1c1c, { roughness: 0.9 }));
  tire.rotation.z = Math.PI / 2;
  group.add(tire);
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.01, 14),
    mat(0xeeeeee, { metalness: 0.9, roughness: 0.15 }),
  );
  rim.rotation.z = Math.PI / 2;
  group.add(rim);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.02, 10),
    mat(0xffb703, { metalness: 0.8, roughness: 0.25 }),
  );
  cap.rotation.z = Math.PI / 2;
  group.add(cap);
  return group;
}

// --- RocketMind: "the IDE of 2040" — a holographic display over its jump-desk,
// a low-poly rocket standing beside it (the booth's namesake), and a small
// backdrop wall behind — all with generous clearance around the desk itself,
// since there's no reason to crowd it (contrast KING, whose cluster of props
// needed an explicit playability check — see docs/game-design.md).
function createRocketMindBooth(): THREE.Object3D {
  const zone = BOOTH_PLATFORM_ZONES[0];
  const group = new THREE.Group();

  // Small uncollided backdrop, same convention as KING's — behind the desk,
  // out of the way of any approach/jump angle.
  const backdrop = new THREE.Mesh(
    new RoundedBoxGeometry(3, 2, 0.25, 4, 0.06),
    mat(0x1c1c22, { roughness: 0.4, metalness: 0.3 }),
  );
  const backdropZ = zone.z - zone.halfD - 1.1;
  backdrop.position.set(zone.x, 1.1, backdropZ);
  group.add(backdrop);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.08),
    new THREE.MeshBasicMaterial({ map: createRocketMindSignTexture() }),
  );
  sign.position.set(zone.x, 1.1, backdropZ + 0.14);
  group.add(sign);

  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(zone.halfW * 2, zone.height, zone.halfD * 2),
    mat(0x111114, { roughness: 0.3, metalness: 0.6 }),
  );
  desk.position.set(zone.x, zone.height / 2, zone.z);
  group.add(desk);

  // Magenta LED underglow strip, per the concept — a thin emissive band just
  // under the desk's top edge.
  const underGlow = new THREE.Mesh(
    new THREE.BoxGeometry(zone.halfW * 2 + 0.02, 0.04, zone.halfD * 2 + 0.02),
    new THREE.MeshBasicMaterial({ color: 0xff00ff }),
  );
  underGlow.position.set(zone.x, zone.height - 0.05, zone.z);
  group.add(underGlow);

  const hologram = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.75),
    new THREE.MeshBasicMaterial({ map: createCodeScreenTexture(), transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  hologram.position.set(zone.x, zone.height + 1.2, zone.z);
  group.add(hologram);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.03, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x4fd1ff, emissive: 0x4fd1ff, emissiveIntensity: 1.5 }),
  );
  ring.position.set(zone.x, zone.height + 0.55, zone.z);
  group.add(ring);

  group.add(createRocketProp(ROCKETMIND_ROCKET_POS[0], ROCKETMIND_ROCKET_POS[1]));

  return group;
}

// Goggles Cloud's backdrop screen — name + a genuinely safe pun-on-the-name
// tagline (vision, not "this is confusing").
function createGogglesCloudSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4285f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.gogglesCloud.name, canvas.width / 2, 100);
  ctx.font = '34px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.gogglesCloud.tagline, canvas.width / 2, 175);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A fluffy 6-sphere cloud cluster, the same recipe repeated at different
// positions/scales for three distinct clouds rather than one blob.
function createCloudPuff(x: number, y: number, z: number, scale: number): THREE.Object3D {
  const group = new THREE.Group();
  const cloudMat = mat(0xffffff, { roughness: 0.95 });
  const spheres: [number, number, number, number][] = [
    [0, 0, 0, 0.38],
    [-0.3, -0.05, 0.1, 0.3],
    [0.3, -0.05, -0.1, 0.28],
    [0.18, 0.18, 0.1, 0.25],
    [-0.2, 0.12, -0.08, 0.22],
    [0, -0.08, 0.22, 0.26],
  ];
  for (const [dx, dy, dz, r] of spheres) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 14), cloudMat);
    puff.position.set(dx, dy, dz);
    group.add(puff);
  }
  group.scale.setScalar(scale);
  group.position.set(x, y, z);
  return group;
}

// A literal pair of goggles resting on the desk — the direct visual pun the
// name is actually about, the same idea as RocketMind getting a real rocket.
function createGogglesProp(x: number, y: number, z: number): THREE.Object3D {
  const group = new THREE.Group();
  const gold = mat(0xfbbc05, { metalness: 0.9, roughness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8ab4f8, transmission: 0.85, roughness: 0.1 });
  for (const dx of [-0.14, 0.14]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 12, 24), gold);
    ring.position.set(dx, 0, 0);
    group.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 16), glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(dx, 0, 0);
    group.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), gold);
  bridge.rotation.z = Math.PI / 2;
  group.add(bridge);
  group.rotation.x = -Math.PI / 6;
  group.position.set(x, y, z);
  return group;
}

// --- Goggles Cloud: fluffy clouds hanging from a chrome canopy frame over
// its jump-desk, with a literal pair of goggles resting on the desk itself.
function createGogglesCloudBooth(): THREE.Object3D {
  const zone = BOOTH_PLATFORM_ZONES[1];
  const group = new THREE.Group();

  // Small uncollided backdrop, same convention as the other rebuilt booths.
  const backdrop = new THREE.Mesh(new RoundedBoxGeometry(3.6, 2.4, 0.2, 4, 0.05), mat(0x4285f4, { roughness: 0.4 }));
  backdrop.position.set(zone.x, 1.3, zone.z - zone.halfD - 1.1);
  group.add(backdrop);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 0.75),
    new THREE.MeshBasicMaterial({ map: createGogglesCloudSignTexture() }),
  );
  sign.position.set(zone.x, 1.55, zone.z - zone.halfD - 0.99);
  group.add(sign);

  // Floor accent — same layered trick as the other booths.
  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(4.6, 0.04, 3.8, 4, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(zone.x, 0.02, zone.z - 0.3);
  group.add(floorNeon);

  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(zone.halfW * 2, zone.height, zone.halfD * 2),
    mat(0xf8f9fa, { roughness: 0.5 }),
  );
  desk.position.set(zone.x, zone.height / 2, zone.z);
  group.add(desk);
  const deskAccent = new THREE.Mesh(
    new RoundedBoxGeometry(zone.halfW * 1.7, zone.height * 0.75, 0.08, 4, 0.03),
    mat(0x4285f4, { roughness: 0.3 }),
  );
  deskAccent.position.set(zone.x, zone.height * 0.5, zone.z + zone.halfD + 0.01);
  group.add(deskAccent);

  group.add(createGogglesProp(zone.x - 0.3, zone.height + 0.12, zone.z + 0.1));

  // Chrome canopy frame suspending three separate clouds by wires, instead
  // of one static blob floating in place.
  const chrome = mat(0xdddddd, { metalness: 0.9, roughness: 0.1 });
  const postGeom = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 10);
  for (const dx of [-1.3, 1.3]) {
    const post = new THREE.Mesh(postGeom, chrome);
    post.position.set(zone.x + dx, 1.6, zone.z);
    group.add(post);
  }
  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 10), chrome);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(zone.x, 3.2, zone.z);
  group.add(topBar);

  const cloudDefs: [number, number, number, number][] = [
    [-0.6, 3.55, 0.15, 1.05],
    [0.7, 3.7, -0.2, 1.2],
    [0.05, 3.85, 0.3, 0.9],
  ];
  for (const [dx, y, dz, scale] of cloudDefs) {
    group.add(createCloudPuff(zone.x + dx, y, zone.z + dz, scale));
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.2 - y, 6), chrome);
    wire.position.set(zone.x + dx, y + (3.2 - y) / 2, zone.z + dz);
    group.add(wire);
  }

  return group;
}

// --- KING: gold lion statue on a pedestal in front of an orange back-wall
// banner, flanked by a high-top counter table and the candy kiosk (built by
// SwagRun.ts) — matches the real booth's composition in
// assets/reference/venue/ground-floor-reception-and-exhibition/booths/ing-booth.jpeg
// (backdrop wall behind a centerpiece, furniture flanking left/right) rather
// than a single statue standing alone in open floor.
const KING_PEDESTAL_HEIGHT = 0.5;
// The high-top counter is a real jump platform (BOOTH_PLATFORM_ZONES[2], not
// a hardcoded position here) — same "hazards can't jump" escape as the
// RocketMind/Goggles Cloud desks, per the generated concept's "Jump Platform"
// label.
// Faceted low-poly gold — Icosahedron/Dodecahedron/Tetrahedron with
// flatShading, not smooth spheres — reads as a deliberate "origami trophy"
// statue rather than a mascot-suit costume.
function createLowPolyLion(x: number, y: number, z: number): THREE.Object3D {
  const group = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xffb300,
    metalness: 0.7,
    roughness: 0.3,
    clearcoat: 0.5,
    flatShading: true,
  });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), gold);
  body.scale.set(0.95, 0.85, 1.5);
  body.position.set(0, 0.4, 0);
  group.add(body);

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), gold);
  head.position.set(0, 0.62, 0.42);
  group.add(head);

  const maneGeom = new THREE.TetrahedronGeometry(0.18, 0);
  const manePositions: [number, number, number][] = [
    [0.14, 0.58, 0.3],
    [-0.14, 0.58, 0.3],
    [0, 0.72, 0.24],
    [0.18, 0.48, 0.18],
    [-0.18, 0.48, 0.18],
  ];
  for (const [mx, my, mz] of manePositions) {
    const manePart = new THREE.Mesh(maneGeom, gold);
    manePart.position.set(mx, my, mz);
    manePart.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    group.add(manePart);
  }

  const legGeom = new THREE.CylinderGeometry(0.05, 0.025, 0.36, 5);
  for (const [lx, lz] of [
    [-0.15, 0.3],
    [0.15, 0.3],
    [-0.15, -0.24],
    [0.15, -0.24],
  ]) {
    const leg = new THREE.Mesh(legGeom, gold);
    leg.position.set(lx, 0.18, lz);
    leg.rotation.z = lx < 0 ? 0.1 : -0.1;
    group.add(leg);
  }

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.012, 0.36, 4), gold);
  tail.position.set(0, 0.28, -0.48);
  tail.rotation.x = -Math.PI / 4;
  group.add(tail);

  group.position.set(x, y, z);
  return group;
}

// The back-wall arches were plain dark glass — self-illuminated icon panels
// instead, so the booth's own backdrop actually advertises what's here: a
// gift box (swag is hidden in this booth's floor footprint, see SwagRun.ts)
// and a wrapped candy (the real candy kiosk sitting right next to it).
// MeshBasicMaterial, not Standard — reads as backlit/glowing regardless of
// scene lighting, matching the arch frame around it.
function createArchIconTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  draw(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSwagArchTexture(): THREE.CanvasTexture {
  return createArchIconTexture((ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(cx - 70, cy - 35, 140, 110);
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(cx - 13, cy - 35, 26, 110);
    ctx.fillRect(cx - 70, cy - 10, 140, 26);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 35);
      ctx.lineTo(cx + side * 34, cy - 68);
      ctx.lineTo(cx + side * 6, cy - 35);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function createCandyArchTexture(): THREE.CanvasTexture {
  return createArchIconTexture((ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#ff4d8d';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 58, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 55, cy - 40);
      ctx.lineTo(cx + side * 100, cy - 55);
      ctx.lineTo(cx + side * 100, cy - 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + side * 55, cy + 40);
      ctx.lineTo(cx + side * 100, cy + 55);
      ctx.lineTo(cx + side * 100, cy + 8);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function createKINGBooth(): THREE.Object3D {
  const group = new THREE.Group();
  const [x, z] = KING_LION_POS;
  const tableZone = BOOTH_PLATFORM_ZONES[2];
  // tableZone.x/z is the platform's real (post-rotation) world position —
  // rotateBooth() rotates this whole group a second time, so placing the
  // table mesh at tableZone.x/z directly would rotate it TWICE, landing the
  // visible table somewhere else entirely from its own jump-platform
  // collision. Use the pre-rotation local point instead — KING_TABLE_LOCAL —
  // chosen so
  // rotating it through KING_ROTATION lands exactly on tableZone.x/z; only
  // tableZone.height (unaffected by a Y-axis rotation) is still read from
  // tableZone itself.
  const [tableLocalX, tableLocalZ] = KING_TABLE_LOCAL;

  // Back wall — a real thin wall (not just a flat plane) but deliberately
  // small/uncollided, per feedback that a full enclosed booth would hurt
  // floor navigability. RoundedBoxGeometry (from the prototype) instead of a
  // hard-edged box reads noticeably less like a placeholder primitive.
  const backdrop = new THREE.Mesh(new RoundedBoxGeometry(4, 2.5, 0.3, 4, 0.08), mat(0xe8630f, { roughness: 0.4 }));
  const backdropZ = z - 1.5;
  backdrop.position.set(x, 1.25, backdropZ);
  group.add(backdrop);

  // Name sign in the clear band above the arches below — no separate
  // hanging sign, consistent with every other booth (see
  // docs/game-design.md — having some booths hang a sign and others not
  // would read as an unintentional inconsistency, not a deliberate style
  // choice).
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.55),
    new THREE.MeshBasicMaterial({ map: createBoothSignTexture(SPONSOR_SIGNAGE.king.name, cssHex(0xe8630f)) }),
  );
  sign.position.set(x, 2.15, backdropZ + 0.16);
  group.add(sign);

  // Glowing window arches on the back wall — a direct callback to the real
  // booth photo's own backlit arches (booths/ing-booth.jpeg), which the
  // original build never actually picked up on. Each now shows what it's
  // actually advertising instead of plain dark glass: swag on the left,
  // candy (the real kiosk right next to this booth) on the right.
  const neonOrange = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const archIcons = [createSwagArchTexture(), createCandyArchTexture()];
  [-0.7, 0.7].forEach((dx, i) => {
    const arch = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.5, 0.1, 4, 0.25), neonOrange);
    arch.position.set(x + dx, 1.1, z - 1.34);
    group.add(arch);
    const glass = new THREE.Mesh(
      new RoundedBoxGeometry(0.58, 1.35, 0.14, 4, 0.2),
      new THREE.MeshBasicMaterial({ map: archIcons[i] }),
    );
    glass.position.set(x + dx, 1.1, z - 1.32);
    group.add(glass);
  });

  // Floor accent — a glowing cyan boundary with a darker pad on top,
  // slightly smaller so only its border stays visible (same layering trick
  // as the prototype: two flat boxes, the top one inset).
  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(5.2, 0.05, 4.2, 4, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(x, 0.02, z - 0.3);
  group.add(floorNeon);
  const floorPad = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.06, 4.0), mat(0x33333b, { roughness: 0.9 }));
  floorPad.position.set(x, 0.03, z - 0.3);
  group.add(floorPad);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, KING_PEDESTAL_HEIGHT, 16),
    mat(0x1c1c1e, { roughness: 0.4, metalness: 0.3 }),
  );
  pedestal.position.set(x, KING_PEDESTAL_HEIGHT / 2, z);
  group.add(pedestal);

  group.add(createLowPolyLion(x, KING_PEDESTAL_HEIGHT, z));

  // High-top wooden counter table, flanking the pedestal opposite the candy
  // kiosk (KING_KIOSK_POS). Top surface sits exactly at tableZone.height so
  // the walkable jump-platform height matches what you see.
  const tableTopThickness = 0.06;
  const tableMat = mat(0x8b5a2b, { roughness: 0.7 });
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, tableTopThickness, 20), tableMat);
  tableTop.position.set(tableLocalX, tableZone.height - tableTopThickness / 2, tableLocalZ);
  group.add(tableTop);
  const legHeight = tableZone.height - tableTopThickness;
  const tableLegGeom = new THREE.CylinderGeometry(0.04, 0.04, legHeight, 8);
  for (const [lx, lz] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ]) {
    const leg = new THREE.Mesh(tableLegGeom, mat(0x3a3a3a, { roughness: 0.6, metalness: 0.4 }));
    leg.position.set(tableLocalX + lx, legHeight / 2, tableLocalZ + lz);
    group.add(leg);
  }

  return group;
}

// --- Vaultius: an oversized vault door landmark.
// Vaultius furniture positions kept as their own constants (not computed
// inline) so both the visual builder and getBoothColliders() agree on where
// they actually are, same convention as KING's table/shelf. Each position
// was checked by brute-force search against the vault, each other, the
// nearby support columns, and the booth's own backdrop wall (easy to place
// something behind/inside the wall by accident, since the wall itself moves
// with the same rotation), rather than hand-placed and hoped for.
// All three shifted by (-5, -19), matching VAULTIUS_VAULT_POS's own move.
const VAULTIUS_KEY_COUNTER_POS: [number, number] = [-5.45, 18.55];
const VAULTIUS_KIOSK_POS: [number, number] = [-10.2, 22.55];
const VAULTIUS_SHELF_POS: [number, number] = [-14.95, 18.3];

function createVaultiusBooth(): THREE.Object3D {
  const group = new THREE.Group();
  const [x, z] = VAULTIUS_VAULT_POS;
  const silver = mat(0x9aa0a6, { roughness: 0.3, metalness: 0.7 });
  const bronze = mat(0xcd7f32, { roughness: 0.3, metalness: 0.8 });

  // Small uncollided backdrop behind the archway, same convention as
  // KING's/RocketMind's — cool dark blue-grey rather than either of those
  // booths' warm tones, giving Vaultius its own identity. Taller than the
  // other booths' backdrops (3.2 vs ~2.2-2.6) because the vault archway
  // below stacks up to y≈2.4 — a backdrop the same height as those other
  // booths' would top out level with the archway, leaving no real clear
  // band for the sign.
  const backdrop = new THREE.Mesh(new RoundedBoxGeometry(3.2, 3.2, 0.25, 4, 0.06), mat(0x232830, { roughness: 0.5 }));
  const backdropZ = z - 1.8;
  backdrop.position.set(x, 1.6, backdropZ);
  group.add(backdrop);

  // Glowing cyan window arches on the backdrop, same rig as KING's.
  const neonCyan = new THREE.MeshBasicMaterial({ color: 0x4fd1ff });
  const archGlass = mat(0x14181e, { roughness: 0.5 });
  for (const dx of [-0.55, 0.55]) {
    const arch = new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.3, 0.1, 4, 0.22), neonCyan);
    arch.position.set(x + dx, 1.1, z - 1.66);
    group.add(arch);
    const glass = new THREE.Mesh(new RoundedBoxGeometry(0.48, 1.15, 0.14, 4, 0.18), archGlass);
    glass.position.set(x + dx, 1.1, z - 1.64);
    group.add(glass);
  }

  // Name sign in the clear band above the archway (top ≈2.4) — no separate
  // hanging sign, consistent with every other booth.
  // Dark navy-teal background rather than the bright cyan used for the glow
  // elements above — white text needs real contrast to read, which a flat
  // bright-cyan panel wouldn't give it.
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.45),
    new THREE.MeshBasicMaterial({ map: createBoothSignTexture(SPONSOR_SIGNAGE.vaultius.name, cssHex(0x1c3a4d)) }),
  );
  sign.position.set(x, 2.75, backdropZ + 0.14);
  group.add(sign);

  // Floor accent — same "bright box + inset darker pad" trick as KING's,
  // cyan to match the backdrop arches instead of KING's orange booth.
  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(5.6, 0.05, 4.6, 4, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(x, 0.02, z - 0.2);
  group.add(floorNeon);
  const floorPad = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.06, 4.4), mat(0x2a2e35, { roughness: 0.9 }));
  floorPad.position.set(x, 0.03, z - 0.2);
  group.add(floorPad);

  // The vault archway — stacked blocks forming two pillars and a lintel — a
  // real "walk-up-to-a-vault" shape instead of a plain panel.
  const blockSize = 0.4;
  const blockGeo = new RoundedBoxGeometry(blockSize, blockSize, blockSize, 4, 0.03);
  for (let row = 0; row < 5; row++) {
    const y = 0.2 + row * blockSize;
    for (const dx of [-0.75, 0.75]) {
      const block = new THREE.Mesh(blockGeo, silver);
      block.position.set(x + dx, y, z);
      group.add(block);
    }
  }
  for (const dx of [-0.5, 0, 0.5]) {
    const block = new THREE.Mesh(blockGeo, silver);
    block.position.set(x + dx, 0.2 + 5 * blockSize, z);
    group.add(block);
  }

  const door = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 24), silver);
  door.rotation.x = Math.PI / 2;
  door.position.set(x, 1.3, z + 0.25);
  group.add(door);

  // Wheel lock — a hub + four spokes at 45° increments (up from the
  // original's two crossing spokes), bronze to match the display keys below.
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 10, 24), bronze);
  wheel.position.set(x, 1.3, z + 0.4);
  group.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), bronze);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(x, 1.3, z + 0.4);
  group.add(hub);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), bronze);
    spoke.rotation.z = (i * Math.PI) / 4;
    spoke.position.set(x, 1.3, z + 0.4);
    group.add(spoke);
  }

  // Key display counter, flanking the vault opposite the take-a-number
  // kiosk — three physical bronze keys laid out on top.
  const counterMat = mat(0x555a5f, { roughness: 0.6, metalness: 0.4 });
  const counter = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.7, 0.6, 4, 0.05), counterMat);
  counter.position.set(VAULTIUS_KEY_COUNTER_POS[0], 0.35, VAULTIUS_KEY_COUNTER_POS[1]);
  group.add(counter);
  const keyRotations = [-0.2, 0.1, -0.1];
  keyRotations.forEach((rot, i) => {
    group.add(
      createDisplayKey(
        VAULTIUS_KEY_COUNTER_POS[0] - 0.25 + i * 0.25,
        0.71,
        VAULTIUS_KEY_COUNTER_POS[1],
        rot,
      ),
    );
  });

  // ATM — a small, universally-liked bank prop. A take-a-number kiosk here
  // would carry an unwanted "you'll be waiting in line" undertone (same
  // reasoning behind Tiny's queue-maze concept getting dropped — see
  // docs/game-design.md "Tiny"), rather than anything actually flattering.
  const atmBody = new THREE.Mesh(new RoundedBoxGeometry(0.5, 1.1, 0.4, 4, 0.05), silver);
  atmBody.position.set(VAULTIUS_KIOSK_POS[0], 0.55, VAULTIUS_KIOSK_POS[1]);
  group.add(atmBody);
  const atmScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.22),
    new THREE.MeshBasicMaterial({ map: createATMScreenTexture() }),
  );
  atmScreen.position.set(VAULTIUS_KIOSK_POS[0], 0.85, VAULTIUS_KIOSK_POS[1] + 0.21);
  atmScreen.rotation.x = -0.1;
  group.add(atmScreen);
  // A bill peeking out of the cash slot — a small, cheerful "here's your
  // money" beat.
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.1), mat(0x8fd9a0, { roughness: 0.6 }));
  bill.position.set(VAULTIUS_KIOSK_POS[0], 0.42, VAULTIUS_KIOSK_POS[1] + 0.19);
  bill.rotation.x = -0.15;
  group.add(bill);

  group.add(createSwagShelf(VAULTIUS_SHELF_POS[0], VAULTIUS_SHELF_POS[1], 0x555a5f, [0x114488, 0x1c5fa0, 0x0a2a4d]));

  return group;
}

// --- Miracle Systems: an F1 car on a display turntable — a wink at the real
// sponsor's actual F1 team sponsorship. Sidepods, a helmet, an air intake,
// endplates, a rear DRS flap, and proper multi-part wheels. Red/gold to
// match a real F1 livery.
function createMiracleSystemsBooth(): THREE.Object3D {
  const group = new THREE.Group();
  const [x, z] = MIRACLE_CAR_POS;
  const brandRed = mat(0xd90429, { roughness: 0.2, metalness: 0.3 });
  const darkCarbon = mat(0x111116, { roughness: 0.4, metalness: 0.8 });
  const gold = mat(0xffb703, { metalness: 0.9, roughness: 0.2 });

  // Small uncollided backdrop + canopy overhang, same convention as
  // KING/RocketMind/Vaultius — behind the car, out of the approach path.
  const backdrop = new THREE.Mesh(new RoundedBoxGeometry(4.5, 3.0, 0.25, 4, 0.05), darkCarbon);
  backdrop.position.set(x, 1.5, z - 2.6);
  group.add(backdrop);
  const canopy = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.2, 1.6, 4, 0.02), brandRed);
  canopy.position.set(x, 2.95, z - 1.9);
  group.add(canopy);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.3),
    new THREE.MeshBasicMaterial({ map: createMiracleSignTexture() }),
  );
  screen.position.set(x, 1.9, z - 2.46);
  group.add(screen);

  // Floor accent, same layered trick as the other booths.
  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(5.4, 0.05, 5.4, 4, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xff1e27, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(x, 0.02, z - 0.4);
  group.add(floorNeon);
  const floorPad = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 5.2), mat(0x181820, { roughness: 0.5 }));
  floorPad.position.set(x, 0.03, z - 0.4);
  group.add(floorPad);

  // Display turntable — a real "showroom" stage rather than the car just
  // standing on the floor, matching the celebratory "look what this can do"
  // framing rather than anything about cost.
  const stageBase = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 0.15, 28), darkCarbon);
  stageBase.position.set(x, 0.075, z);
  group.add(stageBase);
  const stageRim = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.03, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffb703 }));
  stageRim.rotation.x = Math.PI / 2;
  stageRim.position.set(x, 0.14, z);
  group.add(stageRim);

  const carY = 0.47; // chassis center — sits flush on the stage's top surface
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.35, 2.2, 4, 0.05), brandRed);
  chassis.position.set(x, carY, z);
  group.add(chassis);
  const nose = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.2, 1.2, 4, 0.03), brandRed);
  nose.position.set(x, carY - 0.05, z + 1.3);
  group.add(nose);
  for (const dx of [-0.4, 0.4]) {
    const sidepod = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.3, 1.1, 4, 0.05), brandRed);
    sidepod.position.set(x + dx, carY, z + 0.1);
    group.add(sidepod);
  }
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), darkCarbon);
  cockpit.position.set(x, carY + 0.12, z + 0.1);
  group.add(cockpit);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), gold);
  helmet.position.set(x, carY + 0.2, z + 0.1);
  group.add(helmet);
  const airIntake = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), darkCarbon);
  airIntake.rotation.x = -Math.PI / 3;
  airIntake.position.set(x, carY + 0.28, z - 0.25);
  group.add(airIntake);

  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.35), darkCarbon);
  frontWing.position.set(x, carY - 0.12, z + 1.8);
  group.add(frontWing);
  for (const dx of [-0.8, 0.8]) {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.45), brandRed);
    endplate.position.set(x + dx, carY - 0.05, z + 1.8);
    group.add(endplate);
  }

  const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.35), brandRed);
  rearWingMain.position.set(x, carY + 0.35, z - 1.1);
  group.add(rearWingMain);
  const rearWingDRS = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.2), darkCarbon);
  rearWingDRS.position.set(x, carY + 0.43, z - 1.1);
  group.add(rearWingDRS);
  for (const dx of [-0.6, 0.6]) {
    const sideplate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.5), darkCarbon);
    sideplate.position.set(x + dx, carY + 0.25, z - 1.1);
    group.add(sideplate);
  }

  for (const [wx, wz, radius, width] of [
    [-0.75, 1.25, 0.24, 0.22],
    [0.75, 1.25, 0.24, 0.22],
    [-0.78, -0.75, 0.28, 0.32],
    [0.78, -0.75, 0.28, 0.32],
  ] as [number, number, number, number][]) {
    const wheel = createRacingWheel(radius, width);
    wheel.position.set(x + wx, carY - 0.05, z + wz);
    group.add(wheel);
  }

  return group;
}

// A glowing abstract network (nodes + connections, not a literal map) behind
// a matching "Tiny, on a national scale." line — the actual joke for Tiny's
// booth: a modest, humble counter with a comparatively oversized screen
// behind it, celebrating real reach rather than an invented complaint about
// service speed (see docs/game-design.md "Tiny" for why the earlier
// queue-maze concept got replaced).
// Belgium's real 10 provinces, each with a green "online" dot, are the
// actual content of Tiny's oversized screen (copy lives in
// src/text/signage.ts along with the rest of this booth's copy). Genuine
// geographic facts read as more charming and less like an invented boast
// than a generic "look how big we are" line.

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createTinyReachScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const accent = '#3aa8a0';

  ctx.fillStyle = '#0f121d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.name, canvas.width / 2, 105);
  ctx.fillStyle = accent;
  ctx.font = 'bold 30px monospace';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.tagline, canvas.width / 2, 155);
  ctx.fillStyle = '#8a99ad';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.subtitle, canvas.width / 2, 205);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(120, 228);
  ctx.lineTo(canvas.width - 120, 228);
  ctx.stroke();

  const colWidth = 155;
  const rowHeight = 90;
  const gapX = 18;
  const gapY = 20;
  const startX = (canvas.width - (5 * colWidth + 4 * gapX)) / 2;
  const startY = 258;
  BELGIAN_PROVINCES.forEach((province, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = startX + col * (colWidth + gapX);
    const y = startY + row * (rowHeight + gapY);

    ctx.fillStyle = 'rgba(58, 168, 160, 0.1)';
    ctx.strokeStyle = 'rgba(58, 168, 160, 0.5)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, colWidth, rowHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(x + colWidth / 2, y + 26, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(province, x + colWidth / 2, y + 62);
  });

  drawRoundedRect(ctx, 120, 518, canvas.width - 240, 130, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.footerTitle, canvas.width / 2, 568);
  ctx.fillStyle = '#8a99ad';
  ctx.font = '18px monospace';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.footerSubtitle, canvas.width / 2, 608);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Tiny: a deliberately modest counter (a laptop, a stool) dwarfed by a
// genuinely oversized, floor-grounded screen showing its actual reach — the
// contrast (small team, huge civic footprint) is the whole joke, and it's a
// flattering one.
function createTinyBooth(): THREE.Object3D {
  const group = new THREE.Group();
  const [cx, cz] = TINY_CENTER;
  const chrome = mat(0xcccccc, { metalness: 0.9, roughness: 0.2 });

  // Giant screen, grounded to the floor by two structural legs rather than
  // just floating — big enough that the modest counter in front of it reads
  // as a real size contrast, not a subtle one.
  const screenZ = cz - 1.2;
  const screenFrame = new THREE.Mesh(new RoundedBoxGeometry(4.6, 3.0, 0.2, 4, 0.05), mat(0x1a1d28, { metalness: 0.8, roughness: 0.3 }));
  screenFrame.position.set(cx, 1.7, screenZ);
  group.add(screenFrame);
  for (const dx of [-2.1, 2.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 10), chrome);
    leg.position.set(cx + dx, 1.7, screenZ);
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.7), chrome);
    foot.position.set(cx + dx, 0.03, screenZ);
    group.add(foot);
  }
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.9),
    new THREE.MeshBasicMaterial({ map: createTinyReachScreenTexture() }),
  );
  screen.position.set(cx, 1.7, screenZ + 0.11);
  group.add(screen);

  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(4.8, 0.04, 3.4, 4, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x3aa8a0, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(cx, 0.02, cz - 0.2);
  group.add(floorNeon);

  // The counter itself stays deliberately small — "Tiny" is true of the
  // footprint you see in person, not of what it actually does. A laptop and
  // a stool, nothing more, sell "modest" better than an empty desk does.
  // Positioned far enough from the screen (cz+2.3/cz+1.9) to clear the
  // screen's backdrop-wall collider radius (see getBoothColliders) and leave
  // a real walkable gap to the booth's swag.
  const woodMat = mat(0x2d3245, { roughness: 0.4 });
  const counter = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.85, 0.45, 4, 0.04), woodMat);
  counter.position.set(cx, 0.425, cz + 2.3);
  group.add(counter);

  const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.18), chrome);
  laptopBase.position.set(cx, 0.858, cz + 2.3);
  group.add(laptopBase);
  const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.01), chrome);
  laptopScreen.rotation.x = -0.2;
  laptopScreen.position.set(cx, 0.94, cz + 2.22);
  group.add(laptopScreen);

  const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20), woodMat);
  stoolSeat.position.set(cx, 0.55, cz + 1.9);
  group.add(stoolSeat);
  const stoolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.53, 12), chrome);
  stoolPole.position.set(cx, 0.265, cz + 1.9);
  group.add(stoolPole);
  const stoolBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), chrome);
  stoolBase.position.set(cx, 0.01, cz + 1.9);
  group.add(stoolBase);

  return group;
}

// OmniWare's backdrop screen — name + "run anywhere," never "clone" (which
// read as "cheap knockoff" — see the naming brainstorm in sponsor-booths.md).
function createOmniWareSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1f212d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(0, 0, canvas.width, 12);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 88px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.omniWare.name, canvas.width / 2, 100);
  ctx.fillStyle = '#00e5ff';
  ctx.font = '34px monospace';
  ctx.fillText(SPONSOR_SIGNAGE.omniWare.tagline, canvas.width / 2, 175);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A small floating status tag ("VM: READY" etc.) hovering over a ghost
// instance — a cyan-bordered readout, matching the hologram aesthetic.
function createVMTagTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px monospace';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A curved data-connection tube between the real rack and a ghost instance —
// visualizes "spinning up a copy," rather than just floating boxes with no
// relationship drawn between them.
function createDataLineTube(p1: THREE.Vector3, p2: THREE.Vector3): THREE.Object3D {
  const mid = new THREE.Vector3((p1.x + p2.x) / 2, p1.y + 0.3, (p1.z + p2.z) / 2);
  const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 20, 0.012, 8, false),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
  );
}

// A server rack — 8 stacked blades in an outer frame, either a real unit
// (dark chassis, random green/cyan front LEDs, a glass door) or a ghost
// instance (translucent cyan + a wireframe outer shell, no LEDs/door) —
// same shape both times, since the joke is "identical copies, none of them
// real."
function buildServerRack(isGhost: boolean): THREE.Object3D {
  const group = new THREE.Group();
  const frameMat = isGhost
    ? new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00a3ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.35 })
    : mat(0x1f212d, { metalness: 0.8, roughness: 0.3 });
  const bladeMat = isGhost ? frameMat : mat(0x2d3041, { metalness: 0.6, roughness: 0.4 });

  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.85, 2.2, 0.85, 4, 0.03), frameMat);
  frame.position.y = 1.1;
  group.add(frame);

  for (let i = 0; i < 8; i++) {
    const y = 0.22 + i * 0.24;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.75), bladeMat);
    blade.position.set(0, y, 0);
    group.add(blade);
    if (!isGhost) {
      for (let l = 0; l < 3; l++) {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 8, 8),
          new THREE.MeshBasicMaterial({ color: Math.random() > 0.2 ? 0x39ff14 : 0x00f0ff }),
        );
        led.position.set(-0.25 + l * 0.06, y, 0.385);
        group.add(led);
      }
    }
  }

  if (isGhost) {
    const wireShell = new THREE.Mesh(
      new THREE.BoxGeometry(0.87, 2.22, 0.87),
      new THREE.MeshBasicMaterial({ color: 0x80f3ff, wireframe: true, transparent: true, opacity: 0.25 }),
    );
    wireShell.position.y = 1.1;
    group.add(wireShell);
  } else {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 2.0, 0.03),
      new THREE.MeshPhysicalMaterial({ color: 0x111625, transmission: 0.6, roughness: 0.2 }),
    );
    door.position.set(0, 1.1, 0.4);
    group.add(door);
  }

  return group;
}

// --- OmniWare: a real server rack flanked by two translucent "ghost" VM
// instances (with their own floating status tags and data-connection
// lines), a wink at spinning up virtual machines. The ghosts are the visual
// joke: same rack, translucent copies, none of them "real."
function createOmniWareBooth(): THREE.Object3D {
  const group = new THREE.Group();
  const [x, z] = OMNIWARE_POS;

  // Small uncollided backdrop, same convention as the other rebuilt booths.
  const backdrop = new THREE.Mesh(new RoundedBoxGeometry(3.8, 2.6, 0.2, 4, 0.05), mat(0x222533, { roughness: 0.6 }));
  backdrop.position.set(x, 1.4, z - 1.9);
  group.add(backdrop);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 0.75),
    new THREE.MeshBasicMaterial({ map: createOmniWareSignTexture() }),
  );
  sign.position.set(x, 1.9, z - 1.79);
  group.add(sign);

  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(4.0, 0.04, 3.2, 4, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(x, 0.02, z - 0.2);
  group.add(floorNeon);

  const realRack = buildServerRack(false);
  realRack.position.set(x, 0, z - 0.2);
  group.add(realRack);

  const ghostLeft = buildServerRack(true);
  ghostLeft.position.set(x - OMNIWARE_GHOST_OFFSET, 0, z + 0.2);
  group.add(ghostLeft);
  const ghostRight = buildServerRack(true);
  ghostRight.position.set(x + OMNIWARE_GHOST_OFFSET, 0, z + 0.2);
  group.add(ghostRight);

  for (const [text, dx] of [
    [SPONSOR_SIGNAGE.omniWare.vmReady, -OMNIWARE_GHOST_OFFSET],
    [SPONSOR_SIGNAGE.omniWare.vmActive, OMNIWARE_GHOST_OFFSET],
  ] as [string, number][]) {
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.3),
      new THREE.MeshBasicMaterial({ map: createVMTagTexture(text), transparent: true, side: THREE.DoubleSide }),
    );
    tag.position.set(x + dx, 2.4, z + 0.2);
    group.add(tag);
  }

  group.add(
    createDataLineTube(
      new THREE.Vector3(x, 1.2, z - 0.2),
      new THREE.Vector3(x - OMNIWARE_GHOST_OFFSET, 1.2, z + 0.2),
    ),
  );
  group.add(
    createDataLineTube(
      new THREE.Vector3(x, 1.2, z - 0.2),
      new THREE.Vector3(x + OMNIWARE_GHOST_OFFSET, 1.2, z + 0.2),
    ),
  );

  return group;
}

// A standalone beer-tap stand — not tied to any of the 7 sponsor booths.
// The user: real Devoxx has both a sponsor booth that gives away beer every
// year AND an evening where the conference itself taps beer — this is a
// generic stand-in for either, not a specific sponsor, matching this
// project's own "a wink, not a reproduction" policy for real brands/venue
// details (see docs/game-design.md). Placed in open floor clear of the
// column grid, both stair enclosures, and every other booth/table.
export const BEER_TAP_POS: [number, number] = [10, 15];
// Built from the standalone beerTap.js generator (src/props/) — a full bar
// setup on a 4.0x3.4m deck (counter, tap, two kegs, three stools, two high
// tables with two stools each), not the small counter+kegs+tap-tower stand
// this used to hand-build. Collider radius recomputed for the new
// footprint via the same diagonal-half-extent approximation every other
// boxy prop in this file already uses: hypot(2.0, 1.7) ≈ 2.63 (was 1.3).
// Exported so SwagRun.ts/LunchRush.ts can derive their own touch radius from
// it (same reachability requirement as every kiosk — see COFFEE_RADIUS's own
// comment in SwagRun.ts) instead of guessing a separate number.
export const BEER_TAP_COLLIDER_RADIUS = 2.63;

/**
 * Ground-level solid obstacles the player and hazards both push out against.
 *
 * Every booth below rotates 90° in place (rotateBooth in createSponsorBooths)
 * so its front faces sideways into the aisle instead of up/down the hall —
 * these colliders have to go through the exact same rotateCollider(pivot,
 * angle) to stay lined up with what's actually rendered. Each booth also
 * gets 1-2 small colliders across its own backdrop panel — those panels are
 * built deliberately uncollided (see sponsor-booths.md), so without these a
 * player could walk straight through the "wall" behind any of them from the
 * far side. The wallClearance ground-floor movement already adds (1.2, from
 * MOVER_CLEARANCE) around any small collider is plenty to block a thin
 * panel, so these are tiny "core" radii, not full wall-sized ones.
 */
export function getBoothColliders(): Collider[] {
  const colliders: Collider[] = [];

  const rotated = (raw: Collider[], rot: { cx: number; cz: number; angle: number }) =>
    raw.forEach((c) => colliders.push(rotateCollider(c, rot.cx, rot.cz, rot.angle)));

  // Backdrop wall z-offsets below are written relative to each booth's own
  // anchor constant (never a bare number), so moving a booth can't silently
  // leave a stale absolute coordinate behind; each expression mirrors the
  // exact backdropZ formula used in that booth's own create*Booth() function.
  //
  // Each backdrop is covered by exactly TWO small colliders straddling its
  // center, relying on MOVER_CLEARANCE to bridge the gap between them — that
  // only works if each collider's own offset from center is no more than
  // (radius + MOVER_CLEARANCE), so their clearance zones actually overlap in
  // the middle. A wider offset leaves an uncovered strip walkable straight
  // through the panel's own center.
  rotated(
    [
      { x: ROCKETMIND_ROCKET_POS[0], z: ROCKETMIND_ROCKET_POS[1], radius: 0.4 },
      { x: BOOTH_PLATFORM_ZONES[0].x - 1.2, z: BOOTH_PLATFORM_ZONES[0].z - BOOTH_PLATFORM_ZONES[0].halfD - 1.1, radius: 0.2 },
      { x: BOOTH_PLATFORM_ZONES[0].x + 1.2, z: BOOTH_PLATFORM_ZONES[0].z - BOOTH_PLATFORM_ZONES[0].halfD - 1.1, radius: 0.2 },
    ],
    ROCKETMIND_ROTATION,
  );
  rotated(
    [
      { x: BOOTH_PLATFORM_ZONES[1].x - 1.2, z: BOOTH_PLATFORM_ZONES[1].z - BOOTH_PLATFORM_ZONES[1].halfD - 1.1, radius: 0.2 },
      { x: BOOTH_PLATFORM_ZONES[1].x + 1.2, z: BOOTH_PLATFORM_ZONES[1].z - BOOTH_PLATFORM_ZONES[1].halfD - 1.1, radius: 0.2 },
    ],
    GOGGLES_ROTATION,
  );
  rotated(
    [
      { x: KING_LION_POS[0], z: KING_LION_POS[1], radius: 0.7 },
      { x: KING_LION_POS[0] - 1.0, z: KING_LION_POS[1] - 1.5, radius: 0.2 },
      { x: KING_LION_POS[0] + 1.0, z: KING_LION_POS[1] - 1.5, radius: 0.2 },
    ],
    KING_ROTATION,
  );
  rotated(
    [
      { x: VAULTIUS_VAULT_POS[0], z: VAULTIUS_VAULT_POS[1], radius: 1.5 },
      { x: VAULTIUS_KEY_COUNTER_POS[0], z: VAULTIUS_KEY_COUNTER_POS[1], radius: 0.5 },
      { x: VAULTIUS_KIOSK_POS[0], z: VAULTIUS_KIOSK_POS[1], radius: 0.35 },
      { x: VAULTIUS_SHELF_POS[0], z: VAULTIUS_SHELF_POS[1], radius: 0.45 },
      { x: VAULTIUS_VAULT_POS[0] - 0.8, z: VAULTIUS_VAULT_POS[1] - 1.8, radius: 0.2 },
      { x: VAULTIUS_VAULT_POS[0] + 0.8, z: VAULTIUS_VAULT_POS[1] - 1.8, radius: 0.2 },
    ],
    VAULTIUS_ROTATION,
  );
  rotated(
    [
      { x: MIRACLE_CAR_POS[0], z: MIRACLE_CAR_POS[1], radius: 2.0 }, // bigger turntable stage now
      { x: MIRACLE_CAR_POS[0] - 1.1, z: MIRACLE_CAR_POS[1] - 2.6, radius: 0.2 },
      { x: MIRACLE_CAR_POS[0] + 1.1, z: MIRACLE_CAR_POS[1] - 2.6, radius: 0.2 },
    ],
    MIRACLE_ROTATION,
  );
  rotated(
    [
      // Screen is 4.6 wide (halfW 2.3); wall-collider radius 0.4 (reach 1.6)
      // so the two colliders' clearance zones overlap by a full 1.0m in the
      // middle and reach 0.3m past each physical edge. This wall's reach
      // also constrains the counter+stool cluster's own gap from it — see
      // createTinyBooth for the matching mesh position.
      { x: TINY_CENTER[0], z: TINY_CENTER[1] + 2.1, radius: 0.55 }, // Tiny's counter + stool
      { x: TINY_CENTER[0] - 1.1, z: TINY_CENTER[1] - 1.2, radius: 0.4 },
      { x: TINY_CENTER[0] + 1.1, z: TINY_CENTER[1] - 1.2, radius: 0.4 },
    ],
    TINY_ROTATION,
  );
  rotated(
    [
      // Three separate colliders (not one shared blob) so the visible gaps
      // between the real rack and each ghost are actually walkable.
      { x: OMNIWARE_POS[0], z: OMNIWARE_POS[1] - 0.2, radius: 0.5 }, // real rack
      { x: OMNIWARE_POS[0] - OMNIWARE_GHOST_OFFSET, z: OMNIWARE_POS[1] + 0.2, radius: 0.45 }, // ghost left
      { x: OMNIWARE_POS[0] + OMNIWARE_GHOST_OFFSET, z: OMNIWARE_POS[1] + 0.2, radius: 0.45 }, // ghost right
      { x: OMNIWARE_POS[0] - 1.0, z: OMNIWARE_POS[1] - 1.9, radius: 0.2 },
      { x: OMNIWARE_POS[0] + 1.0, z: OMNIWARE_POS[1] - 1.9, radius: 0.2 },
    ],
    OMNIWARE_ROTATION,
  );

  // Beer-tap stand — standalone, not rotated (it doesn't back onto an aisle wall like the booths above).
  colliders.push({ x: BEER_TAP_POS[0], z: BEER_TAP_POS[1], radius: BEER_TAP_COLLIDER_RADIUS });

  return colliders;
}

export interface SponsorBoothsScene {
  readonly group: THREE.Object3D;
  /** Shared with Level 1 (SwagRun.ts) and Level 3 (LunchRush.ts) — Game.ts owns calling `.update(dt)` on this every frame and passing it into each level's own touch-trigger logic. */
  readonly beerTap: BeerTap;
}

export function createSponsorBooths(): SponsorBoothsScene {
  const group = new THREE.Group();
  group.add(rotateBooth(createRocketMindBooth(), ROCKETMIND_ROTATION.cx, ROCKETMIND_ROTATION.cz, ROCKETMIND_ROTATION.angle));
  group.add(rotateBooth(createGogglesCloudBooth(), GOGGLES_ROTATION.cx, GOGGLES_ROTATION.cz, GOGGLES_ROTATION.angle));
  group.add(rotateBooth(createKINGBooth(), KING_ROTATION.cx, KING_ROTATION.cz, KING_ROTATION.angle));
  group.add(rotateBooth(createVaultiusBooth(), VAULTIUS_ROTATION.cx, VAULTIUS_ROTATION.cz, VAULTIUS_ROTATION.angle));
  group.add(rotateBooth(createMiracleSystemsBooth(), MIRACLE_ROTATION.cx, MIRACLE_ROTATION.cz, MIRACLE_ROTATION.angle));
  group.add(rotateBooth(createTinyBooth(), TINY_ROTATION.cx, TINY_ROTATION.cz, TINY_ROTATION.angle));
  group.add(rotateBooth(createOmniWareBooth(), OMNIWARE_ROTATION.cx, OMNIWARE_ROTATION.cz, OMNIWARE_ROTATION.angle));

  const beerTap = createBeerTapAsset();
  beerTap.object.position.set(BEER_TAP_POS[0], 0, BEER_TAP_POS[1]);
  group.add(beerTap.object);

  return { group, beerTap };
}
