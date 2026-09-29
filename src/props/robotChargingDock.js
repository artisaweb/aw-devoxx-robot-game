import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Robot charging dock for a three.js scene: a round floor pad a robot stands on, with a charging
 * column behind it that has a battery meter, a status light and a small display.
 *
 * Built in metres: pad Ø 1,20 m and 7 cm high, column 1,45 m tall; 1,20 m wide and 1,45 m deep in total.
 * The origin sits on the floor at the centre of the pad and the column stands behind it (−Z), so a
 * robot on the pad faces +Z.
 *
 *   const dock = createRobotChargingDock();
 *   scene.add(dock.object);
 *   dock.activate();          // charges from 0 to 100 %; resolves true when full, false if already charging
 *   dock.update(delta);       // call every frame with the elapsed seconds
 *
 * The dock idles with a slow breathing ring. It has no out-of-order state.
 *
 * Adopted from private/assets/ai-fe-playground/robot-charging-dock.js. The only additions are the
 * two read-only descriptors on the return (padRadius, columnCollider) that let ExhibitionHall.ts
 * place one and collide it without re-measuring the model by hand; the dock's own geometry and
 * charge cycle are untouched. activate() drives the visuals only — the energy a robot actually
 * gains is accrued per second by updateChargingDocks() over in ExhibitionHall.ts, the same
 * fire-and-forget split coffeeVendingMachine.js already uses (its own comment explains why
 * gameplay must not wait on the animation's Promise).
 */
export function createRobotChargingDock({ reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = 'RobotChargingDock';
  const FONT = '"Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.userData.g = c.getContext('2d');
    return t;
  }
  const add = (mesh, x, y, z, parent = root, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const ORANGE = new THREE.Color(0xff8a1e), CYAN = new THREE.Color(0x3fd8ff), GREEN = new THREE.Color(0x49f07a);
  const graphite = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.6 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.6, metalness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.25, metalness: 1 });

  // ---------- pad ----------
  const PAD_R = 0.6, PAD_H = 0.07;
  add(new THREE.Mesh(new THREE.CylinderGeometry(PAD_R, PAD_R + 0.02, PAD_H, 64), graphite), 0, PAD_H / 2, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(PAD_R, 0.012, 10, 96).rotateX(Math.PI / 2), chrome), 0, PAD_H, 0, root, false);
  const padTex = canvasTex(1024, 1024, (g, w, h) => {
    const c = w / 2;
    g.fillStyle = '#202328'; g.fillRect(0, 0, w, h);
    for (let r = 80; r < c; r += 60) { g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); }
    // hazard arcs around the edge
    g.lineWidth = 34;
    for (let i = 0; i < 12; i++) {
      g.strokeStyle = i % 2 ? '#1a1c20' : '#ff8a1e';
      g.beginPath(); g.arc(c, c, c - 40, (i / 12) * Math.PI * 2, ((i + 1) / 12) * Math.PI * 2); g.stroke();
    }
    // lightning bolt
    g.fillStyle = '#ff8a1e';
    g.beginPath();
    [[0.54, 0.26], [0.38, 0.54], [0.5, 0.54], [0.44, 0.76], [0.64, 0.44], [0.52, 0.44], [0.6, 0.26]].forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
    g.closePath(); g.fill();
  });
  const padTop = add(new THREE.Mesh(new THREE.CircleGeometry(PAD_R - 0.01, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: padTex, emissiveMap: padTex, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.5 })), 0, PAD_H + 0.001, 0, root, false);
  padTop.receiveShadow = true;

  // glowing ring set into the pad, plus ripple rings that run inwards while charging
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: ORANGE.clone(), emissiveIntensity: 1 });
  add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 8, 96).rotateX(Math.PI / 2), ringMat), 0, PAD_H + 0.002, 0, root, false);
  const ripples = [0, 1, 2].map(() => {
    const m = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    return add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 6, 96).rotateX(Math.PI / 2), m), 0, PAD_H + 0.004, 0, root, false);
  });
  // soft light column that rises from the pad while charging
  const beamTex = canvasTex(8, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: CYAN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 1.7, 48, 1, true), beamMat), 0, PAD_H + 0.85, 0, root, false);
  beam.castShadow = false;

  // ---------- column ----------
  const COL_Z = -PAD_R - 0.13;
  add(new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.45, 0.24, 4, 0.05), graphite), 0, 0.725, COL_Z);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.62, 0.02, 2, 0.01), darker), 0, 0.78, COL_Z + 0.12, root, false);
  const SEGMENTS = 5;
  const segMats = Array.from({ length: SEGMENTS }, (_, i) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x0d0e10, emissive: GREEN.clone(), emissiveIntensity: 0, roughness: 0.3 });
    add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.095, 0.014, 2, 0.006), m), 0, 0.52 + i * 0.115, COL_Z + 0.132, root, false);
    return m;
  });
  // battery cap on top of the meter
  add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.02, 2, 0.006), darker), 0, 1.11, COL_Z + 0.12, root, false);

  // display and status light
  add(new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.11, 0.02, 2, 0.008), darker), 0, 1.25, COL_Z + 0.12, root, false);
  const dispTex = canvasTex(512, 200, () => {});
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.085), new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false })), 0, 1.25, COL_Z + 0.1315, root, false);
  let dispKey = '';
  function display(text, sub, color) {
    const key = text + sub + color;
    if (key === dispKey) return;
    dispKey = key;
    const g = dispTex.userData.g, w = 512, h = 200;
    g.fillStyle = '#07090b'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 16;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 76px ${FONT}`; g.fillText(text, w / 2, 78);
    g.shadowBlur = 0; g.globalAlpha = 0.8; g.font = `500 40px ${FONT}`; g.fillText(sub, w / 2, 152); g.globalAlpha = 1;
    dispTex.needsUpdate = true;
  }
  const statusMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: ORANGE.clone(), emissiveIntensity: 1.5, roughness: 0.2 });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), statusMat), 0, 1.45, COL_Z, root, false);

  // cable from the column into the pad
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 0.25, COL_Z + 0.1), new THREE.Vector3(0.2, 0.06, COL_Z + 0.2), new THREE.Vector3(0.24, 0.035, -PAD_R + 0.02),
  ]), 20, 0.016, 10), darker);
  cable.castShadow = true;
  root.add(cable);

  // ---------- charging ----------
  const T_CHARGE = reducedMotion ? 2 : 4.5, T_HOLD = 2.5, T_FADE = 1.2;
  let cycle = null, time = 0;

  function activate() {
    if (cycle) return Promise.resolve(false);
    return new Promise((resolve) => { cycle = { t: 0, resolve }; });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    let level = 0, charging = false, full = false, fade = 0;
    if (cycle) {
      cycle.t += dt;
      const t = cycle.t;
      if (t < T_CHARGE) { charging = true; level = t / T_CHARGE; }
      else if (t < T_CHARGE + T_HOLD) {
        full = true; level = 1;
        if (cycle.resolve) { cycle.resolve(true); cycle.resolve = null; }
      } else if (t < T_CHARGE + T_HOLD + T_FADE) { fade = (t - T_CHARGE - T_HOLD) / T_FADE; level = 1 - fade; }
      else cycle = null;
    }

    // battery meter
    segMats.forEach((m, i) => {
      const fill = THREE.MathUtils.clamp(level * SEGMENTS - i, 0, 1);
      m.emissive.copy(level < 0.25 ? ORANGE : GREEN);
      m.emissiveIntensity = fill * (full ? 1.6 + Math.sin(time * 6) * 0.3 : 1.4);
    });
    // pad ring, ripples and light column
    const breathe = reducedMotion ? 0.7 : 0.55 + Math.sin(time * 1.6) * 0.35;
    ringMat.emissive.copy(charging ? CYAN : full ? GREEN : ORANGE);
    ringMat.emissiveIntensity = charging ? 1.6 + Math.sin(time * 10) * 0.4 : full ? 1.6 : breathe;
    ripples.forEach((r, i) => {
      const k = (time * 0.9 + i / 3) % 1;
      r.scale.setScalar(0.55 * (1 - k) + 0.08);
      r.material.opacity = charging && !reducedMotion ? Math.sin(k * Math.PI) * 0.9 : 0;
    });
    beamMat.color.copy(full ? GREEN : CYAN);
    const beamTarget = charging ? 0.22 + Math.sin(time * 8) * 0.04 : full ? 0.16 : 0;
    beamMat.opacity += (beamTarget - beamMat.opacity) * Math.min(1, dt * 4);
    beam.visible = beamMat.opacity > 0.005;
    statusMat.emissive.copy(charging ? CYAN : full ? GREEN : ORANGE);
    statusMat.emissiveIntensity = charging ? (Math.sin(time * 12) > 0 ? 2.5 : 0.6) : 1.5;

    if (charging) display('CHARGING', `${Math.floor(level * 100)} %`, '#3fd8ff');
    else if (full) display('FULL', '100 %', '#49f07a');
    else if (fade > 0) display('DONE', 'HAVE FUN', '#49f07a');
    else display('READY', 'STEP ON THE PAD', '#ff8a1e');
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  update(0);
  return {
    object: root,
    /** Radius of the floor pad, for the caller's own "is the robot on it" test — the pad is 7cm high, under AUTO_STEP_HEIGHT, so it is walked onto rather than collided with. */
    padRadius: PAD_R,
    /**
     * The column's own footprint, local to the dock's origin and before any rotation: it stands
     * behind the pad at -Z, not on it. Reported here rather than measured at the placement site so
     * collision can't drift from the model — same reason devoxxLetters.js reports letterColliders.
     */
    columnCollider: { x: 0, z: COL_Z, radius: Math.hypot(0.34, 0.24) / 2 },
    activate,
    get busy() { return !!cycle; },
    update,
    dispose,
  };
}
