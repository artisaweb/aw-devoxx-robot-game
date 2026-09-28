import * as THREE from 'three';
import { KIOSK_SIGNAGE } from '../text/signage';
import { createCoffeeVendingMachine as createCoffeeVendingMachineAsset, CoffeeVendingMachine } from '../props/coffeeVendingMachine';
import { createCandyGrabbingMachine as createCandyGrabbingMachineAsset, CandyGrabbingMachine } from '../props/candyGrabbingMachine';

// Generic labeled kiosk: a "JAVA" coffee machine (energy) and a KING "CANDY"
// machine (time bonus) share this shape — same solid-box-with-readable-status
// silhouette, different label/accent/body color. Both read a status label
// rather than a colored light, which was too easy to miss at a glance while
// being chased.
const PANEL_COLOR = 0x1c2329;
const AVAILABLE_COLOR = '#2ecc71';
const UNAVAILABLE_COLOR = '#e74c3c';

function createLabelTexture(text: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1c2329';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStatusTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.fillStyle = color;
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Half-width of the kiosk body (1.1 wide) — SwagRun.ts/Game.ts use this plus
// ROBOT_RADIUS to make kiosks solid obstacles instead of walk-through props.
export const KIOSK_COLLIDER_RADIUS = 0.55;

export interface Kiosk {
  readonly group: THREE.Object3D;
  /** true = "AVAILABLE" label, false = "OUT OF STOCK" label (on cooldown). */
  setAvailable(available: boolean): void;
}

export interface KioskConfig {
  label: string;
  accentColor: string;
  bodyColor: number;
  trimColor: number;
  /** Status-label text pair, e.g. AVAILABLE/OUT OF STOCK or CONNECTED/NO SIGNAL. */
  availableLabel: string;
  unavailableLabel: string;
}

export function createKiosk(config: KioskConfig): Kiosk {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.0, 0.6),
    new THREE.MeshStandardMaterial({ color: config.bodyColor, roughness: 0.5, metalness: 0.2 }),
  );
  body.position.y = 1.0;
  group.add(body);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 1.15, 0.05),
    new THREE.MeshStandardMaterial({ color: PANEL_COLOR, roughness: 0.3, metalness: 0.1 }),
  );
  panel.position.set(0, 0.85, 0.33);
  group.add(panel);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.32),
    new THREE.MeshBasicMaterial({ map: createLabelTexture(config.label, config.accentColor) }),
  );
  label.position.set(0, 1.75, 0.31);
  group.add(label);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.06, 0.62),
    new THREE.MeshStandardMaterial({ color: config.trimColor, roughness: 0.4, metalness: 0.3 }),
  );
  trim.position.y = 1.98;
  group.add(trim);

  // Status plane sits just in front of the panel's own front face (panel
  // spans z ∈ [0.305, 0.355] at half-thickness 0.025) — z = 0.37 clears it.
  const availableTexture = createStatusTexture(config.availableLabel, AVAILABLE_COLOR);
  const unavailableTexture = createStatusTexture(config.unavailableLabel, UNAVAILABLE_COLOR);
  const statusMat = new THREE.MeshBasicMaterial({ map: availableTexture });
  const status = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), statusMat);
  status.position.set(0, 1.4, 0.37);
  group.add(status);

  const dispenserSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.6 }),
  );
  dispenserSlot.position.set(0, 0.2, 0.33);
  group.add(dispenserSlot);

  let currentlyAvailable = true;
  return {
    group,
    setAvailable(available: boolean) {
      if (available === currentlyAvailable) return;
      currentlyAvailable = available;
      statusMat.map = available ? availableTexture : unavailableTexture;
      statusMat.needsUpdate = true;
    },
  };
}

export type { CoffeeVendingMachine };

/**
 * The exhibition hall's coffee corner. Restores energy (see SwagRun.ts/
 * LunchRush.ts). Built from the standalone `coffeeVendingMachine.js`
 * generator (see `src/props/`) rather than `createKiosk()`'s simple
 * box-with-a-label shape — richer model, richer API: callers get
 * `.activate()` (plays a ~10s brew animation — fire-and-forget, don't gate
 * the actual energy-restore on its Promise resolving, since the gameplay
 * cooldown is much shorter than the animation), `.setOutOfStock(bool)`
 * (replaces the old `setAvailable`, sense inverted), and `.update(dt)`
 * (must be called every frame — the old Kiosk shape never needed this).
 */
export function createVendingMachine(): CoffeeVendingMachine {
  return createCoffeeVendingMachineAsset();
}

export type { CandyGrabbingMachine };

/**
 * KING's "free candy" machine, per the sponsor-booths brainstorm — built
 * from the standalone `candyGrabbingMachine.js` generator (see
 * `src/props/`), a claw machine rather than a dispenser slot. Its cabinet
 * was recolored to KING's own orange directly in that file (see its own
 * comment) rather than the generator's default pink. Same richer API as
 * `createVendingMachine()` above — see that function's own comment for the
 * activate()/setOutOfStock()/update() usage notes, identical here.
 */
export function createCandyMachine(): CandyGrabbingMachine {
  return createCandyGrabbingMachineAsset();
}

/**
 * Level 2's refuel kiosk — a WiFi hotspot stand instead of a coffee/candy
 * machine. Same createKiosk()
 * machinery, different (very-true-to-conferences) status copy.
 */
export function createWifiKiosk(): Kiosk {
  return createKiosk({
    label: KIOSK_SIGNAGE.wifi.label,
    accentColor: '#3dd6d0',
    bodyColor: 0x24313a,
    trimColor: 0x3dd6d0,
    availableLabel: KIOSK_SIGNAGE.wifi.availableLabel,
    unavailableLabel: KIOSK_SIGNAGE.wifi.unavailableLabel,
  });
}

