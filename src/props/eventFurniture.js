import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Temporary event furniture for a three.js scene: the folding tables and stacking chairs that get
 * set up along the side of a hall for a quick laptop session.
 *
 * Built in metres, origin on the floor under the centre, front facing +Z.
 *
 *   const table = createFoldingTable();          // 1,20 × 0,60 m, 74 cm high
 *   const chair = createEventChair();            // seat at 46 cm, 90 cm tall
 *   const stool = createBarStool();              // seat at 76 cm, for bar counters and high tables
 *   const high = createHighTable();              // Ø 70 cm standing table at 1,10 m in a stretch cover
 *   chair.object.position.set(0, 0, 0.45);
 *   chair.object.rotation.y = Math.PI;           // turn it to face the table
 *   scene.add(table.object, chair.object);
 *
 * Neither piece animates; call dispose() when you remove one for good.
 */

function tube(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 14), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function speckle(base, spots, n, size) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.fillStyle = spots[i % spots.length];
      g.fillRect(Math.random() * w, Math.random() * h, size, size);
    }
  });
}
function disposer(root) {
  return () => root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}

/** Folding event table: black blow-moulded top on black steel folding legs. */
export function createFoldingTable({ width = 1.2, depth = 0.6, height = 0.74, color = 0x1d1e20 } = {}) {
  const root = new THREE.Group();
  root.name = 'FoldingTable';
  const TOP_T = 0.045;
  const topTex = speckle('#ffffff', ['rgba(255,255,255,0.35)', 'rgba(0,0,0,0.3)'], 1400, 2);
  topTex.repeat.set(3, 3);
  const top = new THREE.Mesh(new RoundedBoxGeometry(width, TOP_T, depth, 3, 0.014),
    new THREE.MeshStandardMaterial({ color, map: topTex, roughness: 0.55 }));
  top.position.y = height - TOP_T / 2;
  top.castShadow = top.receiveShadow = true;
  root.add(top);

  const steel = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.5, metalness: 0.6 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x1b1d1e, roughness: 0.8 });
  const under = height - TOP_T;
  const r = 0.0125;
  for (const sx of [-1, 1]) {
    const x = sx * (width / 2 - 0.12);
    const zs = [-(depth / 2 - 0.07), depth / 2 - 0.07];
    // U-shaped leg frame: two legs, a top bar under the table and a knee brace
    for (const z of zs) {
      root.add(tube(new THREE.Vector3(x, 0.018, z), new THREE.Vector3(x, under - 0.02, z), r, steel));
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.02, 14), plastic);
      foot.position.set(x, 0.01, z);
      root.add(foot);
    }
    root.add(tube(new THREE.Vector3(x, under - 0.02, zs[0]), new THREE.Vector3(x, under - 0.02, zs[1]), r, steel));
    root.add(tube(new THREE.Vector3(x, 0.2, zs[0]), new THREE.Vector3(x, 0.2, zs[1]), r * 0.8, steel));
    // folding brace from mid-frame up to the underside
    root.add(tube(new THREE.Vector3(x, 0.42, 0), new THREE.Vector3(x - sx * 0.3, under - 0.012, 0), r * 0.8, steel));
    root.add(tube(new THREE.Vector3(x, 0.2, 0), new THREE.Vector3(x, 0.42, 0), r * 0.8, steel));
    // hinge brackets under the top
    for (const z of zs) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), steel);
      bracket.position.set(x, under - 0.01, z);
      root.add(bracket);
    }
  }
  // stiffening rails along the underside
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, 0.018, 0.022), steel);
    rail.position.set(0, under - 0.009, sz * (depth / 2 - 0.1));
    rail.castShadow = true;
    root.add(rail);
  }
  return { object: root, dispose: disposer(root) };
}

/** Stacking event chair: black steel frame with padded black fabric seat and back. */
export function createEventChair({ fabric = 0x1c1c1f, frame = 0x1a1b1d } = {}) {
  const root = new THREE.Group();
  root.name = 'EventChair';
  const steel = new THREE.MeshStandardMaterial({ color: frame, roughness: 0.4, metalness: 0.7 });
  const fabricTex = speckle('#ffffff', ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.10)'], 5000, 1.5);
  fabricTex.repeat.set(2, 2);
  const cloth = new THREE.MeshStandardMaterial({ color: fabric, map: fabricTex, roughness: 0.95 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.7 });
  const r = 0.011, SEAT_Y = 0.44, X = 0.205;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  for (const sx of [-1, 1]) {
    const x = sx * X;
    // rear leg continues up into the back post
    root.add(tube(V(x, 0.012, -0.22), V(x, SEAT_Y, -0.19), r, steel));
    root.add(tube(V(x, SEAT_Y, -0.19), V(x, 0.9, -0.25), r, steel));
    root.add(tube(V(x, 0.012, 0.22), V(x, SEAT_Y, 0.19), r, steel)); // front leg
    root.add(tube(V(x, SEAT_Y, -0.19), V(x, SEAT_Y, 0.19), r, steel)); // side rail
    for (const [y, z] of [[SEAT_Y, 0.19], [SEAT_Y, -0.19]]) {
      const j = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), steel);
      j.position.set(x, y, z);
      root.add(j);
    }
    for (const z of [-0.22, 0.22]) {
      const glide = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.012, 12), black);
      glide.position.set(x, 0.006, z);
      root.add(glide);
    }
  }
  root.add(tube(V(-X, SEAT_Y, 0.19), V(X, SEAT_Y, 0.19), r, steel));
  root.add(tube(V(-X, SEAT_Y, -0.19), V(X, SEAT_Y, -0.19), r, steel));
  root.add(tube(V(-X, 0.88, -0.248), V(X, 0.88, -0.248), r, steel)); // top bar for stacking and lifting

  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.06, 0.43, 3, 0.022), cloth);
  seat.position.set(0, SEAT_Y + 0.041, 0.005);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.41, 0.27, 0.045, 3, 0.02), cloth);
  back.position.set(0, 0.7, -0.219);
  back.rotation.x = -Math.atan2(0.06, 0.46); // follows the back posts
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.26, 0.012, 2, 0.005), black);
  shell.position.set(0, 0.7, -0.246);
  shell.rotation.x = back.rotation.x;
  [seat, back, shell].forEach((m) => { m.castShadow = m.receiveShadow = true; root.add(m); });

  return { object: root, dispose: disposer(root) };
}

/** Bar stool: black round padded seat at 76 cm on four splayed steel legs with a foot ring. */
export function createBarStool({ fabric = 0x1c1c1f, frame = 0x1a1b1d } = {}) {
  const root = new THREE.Group();
  root.name = 'BarStool';
  const steel = new THREE.MeshStandardMaterial({ color: frame, roughness: 0.4, metalness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: fabric, roughness: 0.9 });
  const SEAT_Y = 0.76;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const foot = new THREE.Vector3(Math.cos(a) * 0.22, 0.01, Math.sin(a) * 0.22);
    const top = new THREE.Vector3(Math.cos(a) * 0.13, SEAT_Y - 0.04, Math.sin(a) * 0.13);
    root.add(tube(foot, top, 0.011, steel));
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.009, 8, 40).rotateX(Math.PI / 2), steel);
  ring.position.y = 0.3;
  ring.castShadow = true;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 32), steel);
  plate.position.y = SEAT_Y - 0.03;
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.175, 0.06, 40), cloth);
  seat.position.y = SEAT_Y;
  [plate, seat].forEach((m) => { m.castShadow = m.receiveShadow = true; });
  root.add(ring, plate, seat);
  return { object: root, dispose: disposer(root) };
}

/** High standing table (statafel), Ø 70 cm at 1,10 m, in a fitted black stretch cover. */
export function createHighTable({ color = 0x18181a, diameter = 0.7, height = 1.1 } = {}) {
  const root = new THREE.Group();
  root.name = 'HighTable';
  const R = diameter / 2;
  // cover profile from the centre of the top, down the waist, out to the base
  const prof = [
    [0.001, height], [R - 0.02, height], [R, height - 0.02], [R, height - 0.06],
    [R * 0.55, height - 0.2], [0.07, height * 0.5], [0.08, height * 0.35], [R * 0.6, 0.08], [R * 0.85, 0.005], [0.001, 0.005],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cover = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), new THREE.MeshStandardMaterial({
    color, roughness: 0.7, side: THREE.DoubleSide,
  }));
  cover.castShadow = cover.receiveShadow = true;
  root.add(cover);
  return { object: root, dispose: disposer(root) };
}
