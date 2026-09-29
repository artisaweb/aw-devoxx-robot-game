import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOOTH_PLATFORM_ZONES } from '../ExhibitionHall';
import { SPONSOR_SIGNAGE } from '../../text/signage';
import { mat } from './shared';

export const GOGGLES_ROTATION = { cx: BOOTH_PLATFORM_ZONES[1].x, cz: BOOTH_PLATFORM_ZONES[1].z, angle: -Math.PI / 2 };


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
export function createGogglesCloudBooth(): THREE.Object3D {
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
// SwagRun.ts) — matches a real booth's composition (backdrop wall behind a
// centerpiece, furniture flanking left/right) rather
// than a single statue standing alone in open floor.
