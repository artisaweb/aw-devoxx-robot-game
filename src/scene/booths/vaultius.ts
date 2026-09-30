import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SPONSOR_SIGNAGE } from '../../text/signage';
import { mat, cssHex, createBoothSignTexture } from './shared';

// Relocated (2026-09-27): the user — "the vaultius booth should be placed
// somewhere else in a good location" — the back-left corner it landed in
// after the hall resize sat only 6m from the outer wall and right beside
// the new Stairs A enclosure/left lunch table cluster, a cramped, easy-to-
// miss spot. Moved to the open front-center floor (previously nothing but
// the beer tap and the middle lunch table out there), clear of the column
// grid, both stair enclosures, and every other prop.
export const VAULTIUS_VAULT_POS: [number, number] = [-10, 18];
// Pivot for rotateBooth/rotateCollider — the floor pad's own center
// (VAULTIUS_VAULT_POS[1] - 0.2, matching floorNeon's placement below), not
// the vault position itself, so the pad stays centered under the booth
// after rotating. Left column (x<0): +90° turns the booth's built-in +z
// front to face +x, toward the hall center.
export const VAULTIUS_ROTATION = { cx: VAULTIUS_VAULT_POS[0], cz: VAULTIUS_VAULT_POS[1] - 0.2, angle: Math.PI / 2 };

// A small shelf unit with folded-item props — first built for KING, and kept
// as its own builder when Vaultius wanted the same "real photo has a swag
// shelf" detail; Vaultius is the booth that uses it now. Purely decorative
// (no relation to SwagRun's real pickup system). `shelfColor` is the
// wood/metal the shelf boards themselves are made of; `foldColors` are the
// folded items sitting on them (one per shelf, bottom to top).
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

// --- Vaultius: an oversized vault door landmark.
// Vaultius furniture positions kept as their own constants (not computed
// inline) so both the visual builder and getBoothColliders() agree on where
// they actually are, same convention as KING's table/shelf. Each position
// was checked by brute-force search against the vault, each other, the
// nearby support columns, and the booth's own backdrop wall (easy to place
// something behind/inside the wall by accident, since the wall itself moves
// with the same rotation), rather than hand-placed and hoped for.
// All three shifted by (-5, -19), matching VAULTIUS_VAULT_POS's own move.
export const VAULTIUS_KEY_COUNTER_POS: [number, number] = [-5.45, 18.55];
export const VAULTIUS_KIOSK_POS: [number, number] = [-10.2, 22.55];
export const VAULTIUS_SHELF_POS: [number, number] = [-14.95, 18.3];

export function createVaultiusBooth(): THREE.Object3D {
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
  // reasoning behind Tiny's queue-maze concept getting dropped), rather than
  // anything actually flattering.
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
