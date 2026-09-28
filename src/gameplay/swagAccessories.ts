import * as THREE from 'three';

// Each swag pickup has a concrete identity (not just "the Nth item collected"):
// the world pickup, the worn accessory, and whatever a hazard steals are all
// built from the same geometry, so what you see on the ground is exactly what
// ends up worn. Seven types, one signature item per booth — cap and crown
// share the same head anchor and are mutually exclusive (HEAD_SLOT_TYPES
// below); key and drone are worn at a fixed, static spot rather than
// tracking any moving limb, since hand-tracking isn't worth the complexity.
export type SwagType = 'cap' | 'shirt' | 'sunglasses' | 'sticker' | 'crown' | 'key' | 'drone';

/** KING's crown and Miracle Systems' cap both want the head anchor — wearing
 * either one replaces whichever of the two is currently worn there (see
 * Robot.ts's addAccessory). */
export const HEAD_SLOT_TYPES: ReadonlySet<SwagType> = new Set(['cap', 'crown']);

const STICKER_COLORS = [0xffd23f, 0xff6b6b, 0x9b59b6, 0x1abc9c, 0x3498db];
const GOLD = 0xffd700;
const BRONZE = 0xcd7f32;
const DRONE_BODY_COLOR = 0x2c2c34;
const DRONE_ACCENT_COLOR = 0xff6b35;
// Matches createMiracleSignTexture's own red/gold in sponsorBooths.ts, not a
// separately-invented racing palette.
const MIRACLE_RED = 0xd90429;
const MIRACLE_GOLD = 0xffb703;
// Matches createGogglesProp's own desk-prop palette in sponsorBooths.ts —
// the worn goggles are meant to read as "the same pair," not a new design.
const GOGGLES_GOLD = 0xfbbc05;
const GOGGLES_LENS_BLUE = 0x8ab4f8;
// Matches createTinyReachScreenTexture's own accent teal in sponsorBooths.ts.
const TINY_TEAL = 0x3aa8a0;

// Soft radial falloff, reused across every world pickup's glow sprites — one
// canvas texture shared by all of them rather than one per item.
let glowTexture: THREE.CanvasTexture | null = null;
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,232,150,0.55)');
  gradient.addColorStop(1, 'rgba(255,232,150,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

/** Shared glow-sprite factory — reused by any world pickup across every level. */
export function createGlowSprite(size: number, opacity: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: 0xfff2c2,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  // Opts out of FollowCamera's own occlusion raycast (intersectObjects over
  // groundFloorGroup/sponsorBoothsGroup) — a Sprite's default raycast can
  // report a spurious near hit when the camera-to-robot sightline passes
  // close to one, snapping the camera in to a black/inside-geometry view.
  sprite.raycast = () => {};
  return sprite;
}

// A little mechanical beetle — the beer tap's "tipsy" tell (Robot.ts) used a
// plain soft glow dot here at first, which didn't read as anything in
// particular circling the head. The user: "the 3 dots going around the head,
// should be clearer robotic bugs going around." Bold, simple shapes (an oval
// shell + a few short leg strokes + antennae + one bright eye) rather than
// fine linework, since these render small (orbiting at a fraction of the
// robot's own head size) — detail would just disappear.
let tipsyBugTexture: THREE.CanvasTexture | null = null;
function getTipsyBugTexture(): THREE.CanvasTexture {
  if (tipsyBugTexture) return tipsyBugTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const cx = 48;
  const cy = 52;

  ctx.strokeStyle = '#1c2b1a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (const t of [-0.6, 0, 0.6]) {
      const hipX = cx + side * 16;
      const hipY = cy + t * 12;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(hipX + side * 16, hipY + 10);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = '#2a3a26';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 9, cy - 24);
    ctx.quadraticCurveTo(cx + side * 20, cy - 34, cx + side * 24, cy - 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + side * 24, cy - 40, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#2a3a26';
    ctx.fill();
  }

  const shellGradient = ctx.createRadialGradient(cx - 8, cy - 10, 2, cx, cy, 26);
  shellGradient.addColorStop(0, '#a7e88f');
  shellGradient.addColorStop(0.55, '#7ed957');
  shellGradient.addColorStop(1, '#4d9a34');
  ctx.fillStyle = shellGradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(28,43,26,0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx, cy + 24);
  ctx.stroke();
  for (const dy of [-10, 2, 14]) {
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + dy);
    ctx.lineTo(cx + 18, cy + dy);
    ctx.stroke();
  }

  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  ctx.arc(cx, cy - 16, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffdd55';
  ctx.beginPath();
  ctx.arc(cx, cy - 16, 2.4, 0, Math.PI * 2);
  ctx.fill();

  tipsyBugTexture = new THREE.CanvasTexture(canvas);
  tipsyBugTexture.colorSpace = THREE.SRGBColorSpace;
  return tipsyBugTexture;
}

/** A small orbiting "robotic bug" sprite for Robot.ts's tipsy effect (see Robot.applyTipsy) — same raycast opt-out as createGlowSprite. */
export function createTipsyBugSprite(size: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: getTipsyBugTexture(),
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.raycast = () => {};
  return sprite;
}

// Base sizes for the two glow layers a pickup wears — a wide, soft aura
// around it, plus a smaller, brighter beacon sitting above it so it still
// reads clearly once the hall fills up with more props/booths around it.
export const HALO_BASE_SIZE = 1.2;
export const BEACON_BASE_SIZE = 0.55;
export const BEACON_HEIGHT = 0.65;

// Shared 8x8 black/white checkerboard — the racing-flag motif on Miracle
// Systems' cap. One canvas, cached, the same convention as getGlowTexture.
let checkeredFlagTexture: THREE.CanvasTexture | null = null;
function getCheckeredFlagTexture(): THREE.CanvasTexture {
  if (checkeredFlagTexture) return checkeredFlagTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const squares = 8;
  const size = canvas.width / squares;
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#111111' : '#ffffff';
      ctx.fillRect(x * size, y * size, size, size);
    }
  }
  checkeredFlagTexture = new THREE.CanvasTexture(canvas);
  return checkeredFlagTexture;
}

// A dome + forward brim instead of a literal cone, which read as a party/
// witch hat rather than a cap (a bare cone has no detail that reads as
// "headwear category: cap" specifically). `domeAngle` goes a bit past a
// hemisphere so the dome hugs the sides of the head rather than sitting like
// a shallow lid, and the whole assembly is re-centered on local y=0 (`shift`)
// so it still sits correctly on the unchanged head anchor (spots.cap).
// Miracle Systems' only signature item (see HEAD_SLOT_TYPES) — racing red to
// match createMiracleSignTexture's own palette, plus a checkered-flag patch
// and a gold button, rather than a generic colored cap.
function buildCap(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: MIRACLE_RED });
  const radius = 0.46;
  const domeAngle = Math.PI * 0.55;
  const rimY = radius * Math.cos(domeAngle); // height of the dome's open rim, pre-recenter
  const brimThickness = 0.035;
  const brimY = rimY - brimThickness * 0.5;
  const shift = (radius + brimY) / 2;

  const crown = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10, 0, Math.PI * 2, 0, domeAngle), mat);
  crown.position.y = -shift;
  group.add(crown);

  // Flat, forward-projecting brim/visor — the single detail that reads as
  // "cap" rather than "dome". thetaStart/thetaLength center the wedge on
  // +Z, matching the front-facing convention used elsewhere in this file
  // (e.g. sunglasses sit at a positive Z offset). Sized to project well
  // past the dome's own radius and tilted slightly down, so it reads as a
  // distinct bill at gameplay distance rather than blending into the dome's
  // silhouette.
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.24, radius + 0.24, brimThickness, 24, 1, false, -0.5, 1.0),
    mat,
  );
  brim.position.y = rimY - shift;
  brim.rotation.x = -0.2;
  group.add(brim);

  // Checkered-flag patch on the front of the dome — the detail that actually
  // reads as "racing" rather than just "a red cap". Slightly proud of the
  // dome's own radius so it doesn't z-fight with the sphere underneath.
  const flagSize = radius * 0.55;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(flagSize, flagSize),
    new THREE.MeshBasicMaterial({ map: getCheckeredFlagTexture(), side: THREE.DoubleSide }),
  );
  const flagAngle = domeAngle * 0.55; // partway up the front of the dome, not right at the rim
  flag.position.set(0, radius * Math.cos(flagAngle) - shift, radius * Math.sin(flagAngle) * 1.02);
  flag.rotation.x = -(Math.PI / 2 - flagAngle);
  group.add(flag);

  // Small gold button on top, matching createRacingWheel's own gold accent —
  // a cheap extra bit of "racing gear" detail.
  const button = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.09, 8, 8),
    new THREE.MeshStandardMaterial({ color: MIRACLE_GOLD, metalness: 0.7, roughness: 0.25 }),
  );
  button.position.y = radius - shift;
  group.add(button);

  return group;
}
// Second rework (2026-09-24) — the first pass (a slightly tapered band with
// horizontal sleeve tubes) still read as a belt, not a shirt, once actually
// looked at on the real bodies: it was only ~0.3-0.4 tall next to a torso
// radius of 0.5-0.85, so it covered a thin slice of the torso, not "chest to
// waist." Worse, the sleeve tubes stuck straight out sideways at a fixed
// angle, which never lines up with any body's actual arm attachment —
// Voxxy's arms come off the torso diagonally, a hazard's human arms hang
// straight down — so on every body the "sleeves" looked like a separate
// tube poking through the middle rather than part of the garment.
//
// This version: a genuinely tall torso panel (height scales with radius, not
// capped near-flat) so it reads as a shirt at a glance, and short rounded
// shoulder caps instead of angled tubes — a cap sitting at the top-side
// corner reads as "short sleeve" regardless of what angle the real arm
// underneath is, so it works on every body type without per-body tuning.
// Slightly flared hem (wider at the bottom than the chest) like a loose tee,
// not tapered the other way, which would read as a dress/cone.
//
// Deliberately not fighting the chest sticker anchor for space the way the
// first version did: a shirt tall enough to cover part of that spot is
// realistic layering (a sticker on your chest isn't visible under a shirt
// over it), not a rendering bug.
// A small chest-print texture — Tiny's own novelty-shirt joke ("ask me
// about my [thing]" is a real t-shirt trope), riffing on its own
// "TINY FOOTPRINT • NATIONAL SCALE" tagline (createTinyReachScreenTexture in
// sponsorBooths.ts) rather than inventing an unrelated joke. Transparent
// background so it reads as printed text on fabric, not a patch.
let tinyShirtTextTexture: THREE.CanvasTexture | null = null;
function getTinyShirtTextTexture(): THREE.CanvasTexture {
  if (tinyShirtTextTexture) return tinyShirtTextTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('ASK ME ABOUT MY', canvas.width / 2, 68);
  ctx.fillText('NATIONAL FOOTPRINT', canvas.width / 2, 106);
  tinyShirtTextTexture = new THREE.CanvasTexture(canvas);
  tinyShirtTextTexture.colorSpace = THREE.SRGBColorSpace;
  return tinyShirtTextTexture;
}

// Tiny's only signature item (see the confirmed pairing table) — teal to
// match createTinyReachScreenTexture's own accent color, plus a chest print
// of its own tagline joke, rather than a generic colored shirt.
function buildShirt(radius: number): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: TINY_TEAL, side: THREE.DoubleSide });

  // shirtRadius is tuned to roughly hug each body's actual surface, which
  // means a shirt built at that exact radius sits almost coincident with the
  // body mesh underneath — the two nearly-tangent surfaces Z-fight, showing
  // as a jagged interference pattern rather than a clean fabric surface.
  // Building it noticeably larger than shirtRadius (not smaller) keeps it
  // unambiguously outside the body.
  const height = radius * 0.85;
  const bottomRadius = radius * 1.08;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.98, bottomRadius, height, 20, 1, true), mat);
  group.add(torso);

  // The tube's open, zero-thickness wall is fine at the neckline (the collar
  // ring sits right at that opening, and the body's own head/neck occludes
  // any see-through), but left open at the hem it lets the camera see clean
  // through to the far inside wall from most angles, showing as a jagged
  // zigzag where the near and far rims visually overlap. A flat disc closes
  // just that end.
  const hem = new THREE.Mesh(new THREE.CircleGeometry(bottomRadius, 20), mat);
  hem.rotation.x = -Math.PI / 2;
  hem.position.y = -height / 2;
  group.add(hem);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.4, radius * 0.06, 8, 20), mat);
  collar.position.y = height / 2;
  collar.rotation.x = Math.PI / 2;
  group.add(collar);

  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.65),
      mat,
    );
    cap.position.set(side * radius * 0.88, height / 2 - radius * 0.15, 0);
    cap.rotation.z = side > 0 ? -Math.PI / 2.2 : Math.PI / 2.2;
    group.add(cap);
  }

  // Chest print — a flat decal rather than a UV-mapped texture on the
  // tapered torso cylinder itself, sitting just proud of its front surface
  // (radius*0.98 at this height) so it doesn't z-fight.
  // z-offset must clear the torso's actual radius at this height (which
  // tapers from radius*0.98 at the collar to radius*1.08 at the hem, so
  // ~radius*1.03 at the vertical center where this sits) — 1.02 looked like
  // a safe margin at a glance but was actually *inside* the surface by a
  // hair, silently hiding the print inside the torso mesh. Confirmed with a
  // standalone geometry check (no browser needed) after this shipped
  // invisible in every profile without the DOM erroring.
  const print = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.3, radius * 0.8),
    new THREE.MeshBasicMaterial({ map: getTinyShirtTextTexture(), transparent: true, side: THREE.DoubleSide }),
  );
  print.position.set(0, 0, radius * 1.15);
  group.add(print);

  return group;
}
// Goggles Cloud's only signature item (see the confirmed pairing table) — a
// literal pair of goggles (gold rings, blue glass, elastic straps sweeping
// back) matching createGogglesProp's own desk-prop palette, rather than a
// flat black bar that reads as generic sunglasses regardless of sponsor.
function buildSunglasses(): THREE.Object3D {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: GOGGLES_GOLD, metalness: 0.9, roughness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: GOGGLES_LENS_BLUE,
    transparent: true,
    opacity: 0.75,
    roughness: 0.15,
  });
  for (const dx of [-0.19, 0.19]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 10, 20), gold);
    ring.position.set(dx, 0, 0);
    group.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(dx, 0, 0);
    group.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), gold);
  bridge.rotation.z = Math.PI / 2;
  group.add(bridge);

  // Elastic straps sweeping back from each lens — the detail that reads as
  // "goggles" (worn snug around the head) rather than "sunglasses" (folded
  // temple arms), matching how they'd actually sit if worn.
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6), strapMat);
    strap.position.set(side * 0.32, 0, -0.09);
    strap.rotation.x = Math.PI / 2.5;
    strap.rotation.z = side > 0 ? -0.35 : 0.35;
    group.add(strap);
  }
  return group;
}
// A sticker needs to read as a flat, thin disc stuck to a surface — the old
// version was a SphereGeometry, which reads as a ball/bead no matter how
// it's lit or rotated, since a sphere has no flat face at all. This builds a
// short, wide cylinder (a coin shape) standing on its flat face rather than
// its rim, plus a slightly larger white backing disc just behind it so the
// colored face reads as a sticker with a visible border/edge instead of a
// color patch blending straight into the body. Built along local Y then
// rotated 90° so the flat faces point along Z (outward, toward wherever the
// per-slot position offset in WornSpots.stickers puts it) rather than up.
function buildSticker(colorIndex: number): THREE.Object3D {
  const color = STICKER_COLORS[colorIndex % STICKER_COLORS.length];
  const group = new THREE.Group();
  const border = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.01, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  );
  border.position.y = -0.008;
  group.add(border);
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.02, 16),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }),
  );
  group.add(face);
  group.rotation.x = Math.PI / 2;
  return group;
}

// KING's signature item — a gold band with a few spikes, worn at the same
// head anchor as `cap` (see HEAD_SLOT_TYPES).
function buildCrown(): THREE.Object3D {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.22, 12, 1, true), gold);
  group.add(band);
  const spikeCount = 5;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), gold);
    spike.position.set(Math.cos(angle) * 0.4, 0.2, Math.sin(angle) * 0.4);
    group.add(spike);
  }
  return group;
}

// Vaultius's signature item — the same bronze key shape as its counter
// display (createDisplayKey in sponsorBooths.ts), worn at a fixed angle
// rather than tracking a moving hand.
function buildKey(): THREE.Object3D {
  const group = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: BRONZE, roughness: 0.3, metalness: 0.8 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10), bronze);
  group.add(shaft);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 10, 16), bronze);
  bow.position.y = 0.22;
  group.add(bow);
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.025), bronze);
  teeth.position.y = -0.17;
  group.add(teeth);
  group.rotation.z = Math.PI / 2.4;
  return group;
}

// RocketMind's signature item — a small hovering drone, worn at a fixed
// spot above/behind the head rather than actually following Voxxy in world
// space, since real tracking would be a separate system.
function buildDrone(): THREE.Object3D {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: DRONE_BODY_COLOR, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), bodyMat);
  body.scale.set(1, 0.7, 1);
  group.add(body);
  const accent = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    new THREE.MeshStandardMaterial({ color: DRONE_ACCENT_COLOR, emissive: DRONE_ACCENT_COLOR, emissiveIntensity: 0.8 }),
  );
  accent.position.z = 0.12;
  group.add(accent);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), rotorMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(side * 0.17, 0.02, 0);
    group.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 12), rotorMat);
    rotor.position.set(side * 0.3, 0.06, 0);
    group.add(rotor);
  }
  return group;
}

function buildItem(type: SwagType, colorIndex: number, shirtRadius: number): THREE.Object3D {
  switch (type) {
    case 'cap':
      return buildCap();
    case 'shirt':
      return buildShirt(shirtRadius);
    case 'sunglasses':
      return buildSunglasses();
    case 'sticker':
      return buildSticker(colorIndex);
    case 'crown':
      return buildCrown();
    case 'key':
      return buildKey();
    case 'drone':
      return buildDrone();
  }
}

interface WornSpots {
  cap: [number, number, number];
  shirtY: number;
  shirtRadius: number;
  sunglasses: [number, number, number];
  key: [number, number, number];
  drone: [number, number, number];
  stickers: [number, number, number][];
}

// Tuned for voxxyModel.ts: head centered ~y=1.85 (top ~2.25), torso centered ~y=0.95.
const VOXXY_SPOTS: WornSpots = {
  cap: [0, 2.28, 0],
  shirtY: 0.95,
  shirtRadius: 0.5,
  sunglasses: [0, 1.86, 0.42],
  key: [0.42, 0.72, 0.22], // held at the hip, static — see the key's build note
  drone: [0, 2.62, -0.32], // hovering above/behind the head, clear of the cap/crown slot
  stickers: [
    [0.32, 1.9, 0.2],
    [-0.32, 1.9, 0.2],
    [0.4, 1.0, 0.3],
    [-0.4, 1.0, 0.3],
    [0, 0.7, -0.4],
  ],
};

// Tuned for the real voxxy.glb once it loads. Its proportions are nothing
// like the placeholder's (a much bigger head on a short, wide-hipped body),
// so VOXXY_SPOTS above landed several of these buried inside the head or
// sitting on the neck like a choker. These numbers come from sampling the
// loaded model's actual *skinned* vertex positions (not raw bind-pose
// geometry — a first attempt at this measured the undeformed rest mesh via
// `mesh.matrixWorld` alone, which ignores bone transforms entirely and gave
// a bogus ~1.7 total height; skinning bone matrices in by hand, the same
// way the vertex shader does, gives the real, currently-posed shape) at
// several heights. Model's own
// landmarks (world Y, robot at y=0): overall height ~2.89, hips/legs wide
// (~1.1 radius) up to ~0.6, torso narrowing through ~0.9-1.2, narrowest at
// the neck ~1.5, head widening from ~1.8 to its widest ~2.1-2.4, tapering
// to the top at ~2.89.
const VOXXY_REAL_MODEL_SPOTS: WornSpots = {
  cap: [0, 2.7, 0], // resting on the domed head, just below its actual ~2.89 peak
  shirtY: 0.85, // mid-torso, between the wide hips (~0.6) and the narrow neck (~1.5)
  shirtRadius: 0.85,
  sunglasses: [0, 2.2, 0.62], // head's widest band (~2.1-2.4) at its front surface
  key: [0.75, 0.4, 0.3], // hip height, where the body is at its widest (~1.1 radius)
  drone: [0, 3.3, -0.45], // clear above the actual ~2.89 head top
  stickers: [
    [0.35, 1.1, 0.4],
    [-0.35, 1.1, 0.4],
    [0.55, 0.55, 0.5],
    [-0.55, 0.55, 0.5],
    [0, 0.4, -0.7],
  ],
};

// Tuned for attendeeModels.ts's shared body skeleton: legs to ~y=0.7, torso
// centered y=1.05, head centered y=1.68 (top ~1.96) — every archetype builds
// on these same heights so one anchor table works for all four.
const HAZARD_SPOTS: WornSpots = {
  cap: [0, 2.05, 0],
  shirtY: 1.05,
  shirtRadius: 0.36,
  sunglasses: [0, 1.68, 0.28],
  key: [0.34, 0.85, 0.2],
  drone: [0, 2.28, -0.28],
  stickers: [
    [0.32, 1.1, 0.22],
    [-0.32, 1.1, 0.22],
    [0.28, 0.62, 0.2],
    [-0.28, 0.62, 0.2],
    [0, 1.5, -0.18],
  ],
};

/**
 * A pickup lying in the world, shaped like the actual item it is, wrapped in
 * a glowing aura + beacon so it stays easy to spot once more props/booths
 * clutter the space around it. The item mesh keeps spinning (SwagRun.ts
 * rotates the returned group); the glow sprites always face the camera
 * regardless, so that rotation never visibly affects them. `group.userData.glow`
 * exposes the halo sprite so SwagRun.ts can pulse it over time.
 */
export function createWorldSwagItem(type: SwagType, colorIndex: number): THREE.Object3D {
  const group = new THREE.Group();
  group.add(buildItem(type, colorIndex, 0.5));

  const halo = createGlowSprite(HALO_BASE_SIZE, 0.55);
  group.add(halo);

  const beacon = createGlowSprite(BEACON_BASE_SIZE, 0.85);
  beacon.position.y = BEACON_HEIGHT;
  group.add(beacon);

  group.userData.glow = halo;
  return group;
}

/**
 * The same item worn on a body. `slotIndex` only matters for stickers (which
 * body of accumulated ones this is, so they don't all stack in one spot).
 */
export function createWornAccessory(
  type: SwagType,
  // 'voxxy' targets the procedural placeholder shown before voxxy.glb loads;
  // 'voxxy-real' targets that real, differently-proportioned model once it's
  // in (see VOXXY_REAL_MODEL_SPOTS's own note) — Robot.ts picks whichever is
  // actually on screen right now.
  profile: 'voxxy' | 'voxxy-real' | 'hazard',
  colorIndex: number,
  slotIndex: number,
): THREE.Object3D {
  const spots = profile === 'voxxy' ? VOXXY_SPOTS : profile === 'voxxy-real' ? VOXXY_REAL_MODEL_SPOTS : HAZARD_SPOTS;
  const mesh = buildItem(type, colorIndex, spots.shirtRadius);

  switch (type) {
    case 'cap':
      mesh.position.set(...spots.cap);
      break;
    case 'shirt':
      mesh.position.set(0, spots.shirtY, 0);
      break;
    case 'sunglasses':
      mesh.position.set(...spots.sunglasses);
      break;
    case 'sticker': {
      const offset = spots.stickers[slotIndex % spots.stickers.length];
      mesh.position.set(...offset);
      break;
    }
    case 'crown':
      // Shares the cap's head anchor — HEAD_SLOT_TYPES makes the two mutually
      // exclusive before either ever reaches this point.
      mesh.position.set(...spots.cap);
      break;
    case 'key':
      mesh.position.set(...spots.key);
      break;
    case 'drone':
      mesh.position.set(...spots.drone);
      break;
  }

  return mesh;
}
