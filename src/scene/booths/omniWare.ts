import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SPONSOR_SIGNAGE } from '../../text/signage';
import { mat } from './shared';

// Right column, between KING and Goggles Cloud — completes the 7th platinum
// sponsor alongside the other six. Shifted by
// (+5, +1) — same reasoning as KING's own shift (king.ts) and
// BOOTH_PLATFORM_ZONES in ExhibitionHall.ts.
export const OMNIWARE_POS: [number, number] = [30, 4];
export const OMNIWARE_ROTATION = { cx: OMNIWARE_POS[0], cz: OMNIWARE_POS[1] - 0.2, angle: -Math.PI / 2 };
// Ghost offset from the real rack, in each direction. 4.5 is the smallest
// value that clears both the real rack's own collider AND OmniWare's own
// backdrop-wall colliders by a real margin, so you can actually walk between
// each rack rather than seeing three racks with no walkable gap between them.
export const OMNIWARE_GHOST_OFFSET = 4.5;

// OmniWare's backdrop screen — name + "run anywhere," never "clone" (which
// read as "cheap knockoff").
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
export function createOmniWareBooth(): THREE.Object3D {
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
