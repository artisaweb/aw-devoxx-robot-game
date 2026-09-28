import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Cinema chair for a three.js scene: black velvet seat and back (colour option), armrests with a cup holder,
 * a fold-up seat and a brass seat number on the back.
 *
 * Built in metres: 0,56 m from armrest centre to armrest centre, 1,02 m tall, 0,72 m deep with the
 * seat down. The origin sits on the floor under the centre and the chair faces +Z.
 *
 *   const chair = createCinemaChair({ number: 12 });
 *   scene.add(chair.object);
 *   chair.activate();            // folds the seat down, or back up; resolves when it has settled
 *   chair.update(delta);         // call every frame with the elapsed seconds
 *
 * For a row, place chairs 0,56 m apart and pass leftArm: false to every chair after the first,
 * so neighbours share one armrest.
 */
export function createCinemaChair({
  number = 12, color = 0x18181b, seatDown = false, leftArm = true, rightArm = true, reducedMotion = false,
} = {}) {
  const root = new THREE.Group();
  root.name = 'CinemaChair';
  const HALF = 0.28;

  const add = (mesh, x, y, z, parent = root) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  // Velvet with stitched vertical channels
  const channels = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let x = w / 4; x < w; x += w / 4) {
      const grd = g.createLinearGradient(x - 14, 0, x + 14, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(x - 14, 0, 28, h);
    }
  });
  const velvet = new THREE.MeshPhysicalMaterial({
    color, map: channels, roughness: 0.9, sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.06), // a faint velvet sheen keeps black readable
  });
  const velvetPlain = velvet.clone(); velvetPlain.map = null;
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.55, metalness: 0.1 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x232326, roughness: 0.4, metalness: 0.1 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.3, metalness: 1 });

  // Side standards with armrests
  const sides = [leftArm && -1, rightArm && 1].filter(Boolean);
  for (const s of sides) {
    const x = s * HALF;
    add(new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.6, 0.6, 3, 0.02), shellMat), x, 0.3, -0.04);
    add(new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.035, 0.6, 3, 0.014), armMat), x, 0.635, -0.02);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.58), shellMat), x, 0.006, -0.04); // floor plate
  }
  if (rightArm) {
    // cup holder at the front of the right armrest
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.03, 32), armMat), HALF, 0.64, 0.25);
    const hole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 32), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 })), HALF, 0.6545, 0.25);
    hole.castShadow = false;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0035, 8, 40).rotateX(Math.PI / 2), brass), HALF, 0.656, 0.25);
  }

  // Backrest: velvet cushion on a black shell, reclined
  const back = new THREE.Group();
  back.position.set(0, 0.42, -0.26);
  back.rotation.x = -0.2;
  root.add(back);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.62, 0.12, 4, 0.05), [velvetPlain, velvetPlain, velvetPlain, velvetPlain, velvet, velvetPlain]), 0, 0.33, 0.02, back);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.64, 0.05, 3, 0.02), shellMat), 0, 0.33, -0.05, back);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.1, 0.13, 4, 0.045), velvetPlain), 0, 0.6, 0.03, back); // head roll
  const plateTex = canvasTex(256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#e6c373'); grd.addColorStop(1, '#a8802f');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1d08'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 92px Georgia, "Times New Roman", serif';
    g.fillText(String(number), w / 2, h / 2 + 6);
  });
  const plate = add(new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.3, metalness: 0.8 })), 0, 0.56, -0.0765, back);
  plate.rotation.y = Math.PI; // readable from the row behind

  // Seat on a hinge at its back edge
  const SEAT_UP = -1.42, SEAT_DOWN = -0.06;
  const seat = new THREE.Group();
  seat.position.set(0, 0.42, -0.12); // far enough forward that the folded seat clears the backrest
  root.add(seat);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.49, 0.11, 0.47, 4, 0.045), [velvetPlain, velvetPlain, velvet, velvetPlain, velvetPlain, velvetPlain]), 0, 0.01, 0.245, seat);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.47, 0.04, 0.45, 2, 0.015), shellMat), 0, -0.055, 0.245, seat);
  for (const s of [-1, 1]) {
    const hinge = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 16).rotateZ(Math.PI / 2), shellMat), s * 0.24, 0, 0.02, seat);
    hinge.castShadow = false;
  }

  // ---------- fold animation: a damped spring towards the target angle ----------
  let target = seatDown ? SEAT_DOWN : SEAT_UP;
  let angle = target, vel = 0;
  let pending = null;
  seat.rotation.x = angle;

  function activate() {
    if (pending) return Promise.resolve(false);
    target = target === SEAT_DOWN ? SEAT_UP : SEAT_DOWN;
    return new Promise((resolve) => { pending = resolve; });
  }
  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (reducedMotion) { angle = target; vel = 0; }
    else {
      // a few substeps keep the stiff spring stable
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        vel += ((target - angle) * 110 - vel * 11) * h;
        angle += vel * h;
      }
    }
    seat.rotation.x = angle;
    if (pending && Math.abs(target - angle) < 0.004 && Math.abs(vel) < 0.02) { pending(true); pending = null; }
  }
  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  return {
    object: root,
    activate,
    get seatDown() { return target === SEAT_DOWN; },
    get busy() { return !!pending; },
    update,
    dispose,
  };
}
