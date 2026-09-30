import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOOTH_PLATFORM_ZONES } from '../ExhibitionHall';
import { SPONSOR_SIGNAGE } from '../../text/signage';
import { mat } from './shared';

// RocketMind's and Goggles Cloud's desks are pivoted about their own zone
// center (BOOTH_PLATFORM_ZONES swapped halfW/halfD to match, in
// ExhibitionHall.ts), so position is unchanged — only the angle matters.
export const ROCKETMIND_ROTATION = { cx: BOOTH_PLATFORM_ZONES[0].x, cz: BOOTH_PLATFORM_ZONES[0].z, angle: Math.PI / 2 };

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
export const ROCKETMIND_ROCKET_POS: [number, number] = [BOOTH_PLATFORM_ZONES[0].x, BOOTH_PLATFORM_ZONES[0].z + 5.0];
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

// --- RocketMind: "the IDE of 2040" — a holographic display over its jump-desk,
// a low-poly rocket standing beside it (the booth's namesake), and a small
// backdrop wall behind — all with generous clearance around the desk itself,
// since there's no reason to crowd it (contrast KING, whose cluster of props
// needed an explicit playability check).
export function createRocketMindBooth(): THREE.Object3D {
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
