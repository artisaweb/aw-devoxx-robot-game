import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOOTH_PLATFORM_ZONES } from '../ExhibitionHall';
import { SPONSOR_SIGNAGE } from '../../text/signage';
import { mat, cssHex, createBoothSignTexture } from './shared';


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
// at x=43.8), while x=40 sits past the column grid's own last line (35), in
// the wall-margin strip beyond it — the one booth out there, since the
// others stand between gridlines at x≈±30 and Vaultius has since moved to
// the front-center floor.
export const KING_KIOSK_POS: [number, number] = [37, -4];
export const KING_LION_POS: [number, number] = [40, -11];
// Right column (x>0): -90° turns the booth's built-in +z front to face -x,
// toward the hall center. Pivot is the lion statue itself, not the booth's
// floor-pad center — arbitrary but fine, since rotateBooth/rotateCollider
// are exact for any pivot.
export const KING_ROTATION = { cx: KING_LION_POS[0], cz: KING_LION_POS[1], angle: -Math.PI / 2 };
// Pre-rotation local position of the high-top table mesh — deliberately
// NOT the same value as BOOTH_PLATFORM_ZONES[2] (its real, post-rotation
// world position): this group gets rotated by rotateBooth() after being
// built, so a mesh placed at the zone's own (already-rotated) x/z would be
// rotated a SECOND time, landing it somewhere else entirely from its own
// jump-platform collision. Rotating this local point through KING_ROTATION
// lands exactly on BOOTH_PLATFORM_ZONES[2].
const KING_TABLE_LOCAL: [number, number] = [36, -8];

// --- KING: gold lion statue on a pedestal in front of an orange back-wall
// banner, flanked by a high-top counter table and the candy kiosk (built by
// SwagRun.ts) — matches a real booth's composition (backdrop wall behind a
// centerpiece, furniture flanking left/right) rather
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


export function createKINGBooth(): THREE.Object3D {
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
  // hanging sign, consistent with every other booth — having some booths
  // hang a sign and others not would read as an unintentional
  // inconsistency, not a deliberate style choice.
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
