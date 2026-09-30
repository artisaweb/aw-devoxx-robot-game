import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SPONSOR_SIGNAGE } from '../../text/signage';
import { mat } from './shared';

// Shifted by (-5, +8) — same reasoning as KING's own shift (king.ts) and
// BOOTH_PLATFORM_ZONES in ExhibitionHall.ts.
export const MIRACLE_CAR_POS: [number, number] = [-30, 24];
export const MIRACLE_ROTATION = { cx: MIRACLE_CAR_POS[0], cz: MIRACLE_CAR_POS[1] - 0.4, angle: Math.PI / 2 };

// Miracle Systems' backdrop screen — name + a genuinely neutral corporate
// slogan about performance, not licensing cost — the
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

// --- Miracle Systems: an F1 car on a display turntable — a wink at the real
// sponsor's actual F1 team sponsorship. Sidepods, a helmet, an air intake,
// endplates, a rear DRS flap, and proper multi-part wheels. Red/gold to
// match a real F1 livery.
export function createMiracleSystemsBooth(): THREE.Object3D {
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
