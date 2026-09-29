import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SPONSOR_SIGNAGE, BELGIAN_PROVINCES } from '../../text/signage';
import { mat } from './shared';

export const TINY_CENTER: [number, number] = [-30, 6];
export const TINY_ROTATION = { cx: TINY_CENTER[0], cz: TINY_CENTER[1] - 0.2, angle: Math.PI / 2 };
// Right column, between KING and Goggles Cloud — completes the 7th platinum
// sponsor alongside the other six. Shifted by
// (+5, +1) — same reasoning as KING/BOOTH_PLATFORM_ZONES above.

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createTinyReachScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 720;
  const ctx = canvas.getContext('2d')!;
  const accent = '#3aa8a0';

  ctx.fillStyle = '#0f121d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.name, canvas.width / 2, 105);
  ctx.fillStyle = accent;
  ctx.font = 'bold 30px monospace';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.tagline, canvas.width / 2, 155);
  ctx.fillStyle = '#8a99ad';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.subtitle, canvas.width / 2, 205);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(120, 228);
  ctx.lineTo(canvas.width - 120, 228);
  ctx.stroke();

  const colWidth = 155;
  const rowHeight = 90;
  const gapX = 18;
  const gapY = 20;
  const startX = (canvas.width - (5 * colWidth + 4 * gapX)) / 2;
  const startY = 258;
  BELGIAN_PROVINCES.forEach((province, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = startX + col * (colWidth + gapX);
    const y = startY + row * (rowHeight + gapY);

    ctx.fillStyle = 'rgba(58, 168, 160, 0.1)';
    ctx.strokeStyle = 'rgba(58, 168, 160, 0.5)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, colWidth, rowHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(x + colWidth / 2, y + 26, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(province, x + colWidth / 2, y + 62);
  });

  drawRoundedRect(ctx, 120, 518, canvas.width - 240, 130, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.footerTitle, canvas.width / 2, 568);
  ctx.fillStyle = '#8a99ad';
  ctx.font = '18px monospace';
  ctx.fillText(SPONSOR_SIGNAGE.tiny.footerSubtitle, canvas.width / 2, 608);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Tiny: a deliberately modest counter (a laptop, a stool) dwarfed by a
// genuinely oversized, floor-grounded screen showing its actual reach — the
// contrast (small team, huge civic footprint) is the whole joke, and it's a
// flattering one.
export function createTinyBooth(): THREE.Object3D {
  const group = new THREE.Group();
  const [cx, cz] = TINY_CENTER;
  const chrome = mat(0xcccccc, { metalness: 0.9, roughness: 0.2 });

  // Giant screen, grounded to the floor by two structural legs rather than
  // just floating — big enough that the modest counter in front of it reads
  // as a real size contrast, not a subtle one.
  const screenZ = cz - 1.2;
  const screenFrame = new THREE.Mesh(new RoundedBoxGeometry(4.6, 3.0, 0.2, 4, 0.05), mat(0x1a1d28, { metalness: 0.8, roughness: 0.3 }));
  screenFrame.position.set(cx, 1.7, screenZ);
  group.add(screenFrame);
  for (const dx of [-2.1, 2.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 10), chrome);
    leg.position.set(cx + dx, 1.7, screenZ);
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.7), chrome);
    foot.position.set(cx + dx, 0.03, screenZ);
    group.add(foot);
  }
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 2.9),
    new THREE.MeshBasicMaterial({ map: createTinyReachScreenTexture() }),
  );
  screen.position.set(cx, 1.7, screenZ + 0.11);
  group.add(screen);

  const floorNeon = new THREE.Mesh(
    new RoundedBoxGeometry(4.8, 0.04, 3.4, 4, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x3aa8a0, transparent: true, opacity: 0.8 }),
  );
  floorNeon.position.set(cx, 0.02, cz - 0.2);
  group.add(floorNeon);

  // The counter itself stays deliberately small — "Tiny" is true of the
  // footprint you see in person, not of what it actually does. A laptop and
  // a stool, nothing more, sell "modest" better than an empty desk does.
  // Positioned far enough from the screen (cz+2.3/cz+1.9) to clear the
  // screen's backdrop-wall collider radius (see getBoothColliders) and leave
  // a real walkable gap to the booth's swag.
  const woodMat = mat(0x2d3245, { roughness: 0.4 });
  const counter = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.85, 0.45, 4, 0.04), woodMat);
  counter.position.set(cx, 0.425, cz + 2.3);
  group.add(counter);

  const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.18), chrome);
  laptopBase.position.set(cx, 0.858, cz + 2.3);
  group.add(laptopBase);
  const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.01), chrome);
  laptopScreen.rotation.x = -0.2;
  laptopScreen.position.set(cx, 0.94, cz + 2.22);
  group.add(laptopScreen);

  const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 20), woodMat);
  stoolSeat.position.set(cx, 0.55, cz + 1.9);
  group.add(stoolSeat);
  const stoolPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.53, 12), chrome);
  stoolPole.position.set(cx, 0.265, cz + 1.9);
  group.add(stoolPole);
  const stoolBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), chrome);
  stoolBase.position.set(cx, 0.01, cz + 1.9);
  group.add(stoolBase);

  return group;
}

// OmniWare's backdrop screen — name + "run anywhere," never "clone" (which
// read as "cheap knockoff").
