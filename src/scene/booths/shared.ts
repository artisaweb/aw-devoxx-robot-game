import * as THREE from 'three';
import { Collider } from '../ExhibitionHall';

// Helpers every sponsor booth in this folder shares: the material shorthand,
// the rotate-into-place pair that lets each booth be authored facing +z, and
// the name-sign canvas texture.

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

// Print-poster style texture for the small in-booth name signs (KING and
// Vaultius's own PlaneGeometry, ~3.2x0.55 / 2.6x0.45): a solid accent-color
// panel with bold white text, styled after a real sponsor's real flat-orange
// banner rather than a glowing sci-fi screen. Matte MeshStandardMaterial (no
// emissive, no transparency) — print signage, not a digital display.
//
// The canvas is deliberately wide and short (~5.8:1) to match those plates: a
// texture always stretches to fill whatever plane it's mapped onto with no
// aspect correction of its own, and a portrait canvas squished the text down
// to a barely-readable sliver here (the user: "the text is barely readable on
// the booth").
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
