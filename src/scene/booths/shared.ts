import * as THREE from 'three';
import { Collider } from '../ExhibitionHall';

// Helpers every sponsor booth in this folder shares: the material shorthand,
// the rotate-into-place pair that lets each booth be authored facing +z, and
// the banner/sign canvas textures. Extracted from the single 1622-line
// sponsorBooths.ts this folder replaces — the code is unchanged, only its
// address is.

export function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, ...opts });
}

export function cssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// Every booth below was built facing along +/-z, as if backed against a wall
// behind the aisle. A real expo booth standing in a side column instead
// faces sideways INTO the aisle that runs past it (kiosks along both sides,
// fronts turned toward the center walkway) — rotateBooth()/rotateCollider() turn a
// booth's front from +z to face the hall center (+x for the left column at
// x≈-18, -x for the right column at x≈18) around a given pivot point,
// without touching any of the booth's own local geometry.
export function rotateBooth(booth: THREE.Object3D, cx: number, cz: number, angle: number): THREE.Object3D {
  const pivot = new THREE.Group();
  pivot.position.set(cx, 0, cz);
  booth.position.set(-cx, 0, -cz);
  pivot.rotation.y = angle;
  pivot.add(booth);
  return pivot;
}

export function rotateCollider(c: Collider, cx: number, cz: number, angle: number): Collider {
  const dx = c.x - cx;
  const dz = c.z - cz;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { ...c, x: cx + dx * cos + dz * sin, z: cz - dx * sin + dz * cos };
}

// Print-poster style texture — a solid accent-color panel with bold white
// text, styled after a real sponsor's real flat-orange banner,
// rather than a glowing sci-fi screen, which is what the original
// sprite-based sign looked like. Matte MeshStandardMaterial (no emissive, no
// transparency) — print signage, not a digital display. No header/label text
// (dropped per feedback — it read as clutter, not part of what any booth
// actually needs to say).
//
// NOTE: createBannerTexture / BANNER_WIDTH / BANNER_HEIGHT / createBoothBanner
// below are currently unreferenced — no booth calls createBoothBanner. That
// predates this folder's split out of the old single sponsorBooths.ts; the
// monolith just made it hard to see. Kept rather than deleted because it's a
// finished, working prop that a booth could still be given, but nothing in the
// game builds one today.
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
export function createBoothSignTexture(text: string, accentCss: string): THREE.CanvasTexture {
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
export function createBoothBanner(text: string, accentHex: number, x: number, z: number): THREE.Object3D {
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
