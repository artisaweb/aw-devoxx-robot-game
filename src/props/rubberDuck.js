import * as THREE from 'three';

/**
 * Rubber debugging duck for a three.js scene: a classic yellow bath duck to scatter around the map.
 *
 * Built in metres: 12 cm long by default (pass { size } for a bigger one). The origin sits on the
 * floor under the duck and it looks towards +Z.
 *
 *   const duck = createRubberDuck();          // or { size: 0.4, color: 0xff7a1a }
 *   duck.object.rotation.y = Math.random() * Math.PI * 2;
 *   scene.add(duck.object);
 *   duck.activate();          // a squeeze and a wobble; resolves when it has sprung back
 *   duck.update(delta);       // call every frame with the elapsed seconds
 */
export function createRubberDuck({ size = 0.12, color = 0xffcf1f, reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = 'RubberDuck';
  const squash = new THREE.Group(); // scales during activate()
  root.add(squash);
  const duck = new THREE.Group(); // built looking along +X on a 1-unit scale, then turned and scaled
  duck.rotation.y = -Math.PI / 2;
  duck.scale.setScalar(size);
  squash.add(duck);

  const rubber = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0 });
  const wingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.9), roughness: 0.3 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xff7a14, roughness: 0.3 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    duck.add(m);
    return m;
  };

  // Body: a squashed sphere with a flat bottom and a tail that curls up at the back
  const bodyGeo = new THREE.SphereGeometry(0.5, 40, 28);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i);
    const z = p.getZ(i);
    x *= 1.0; y *= 0.62;
    if (x < -0.15 && y > -0.05) y += (-x - 0.15) ** 2 * 1.6; // tail
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.25; // sits flat
    p.setXYZ(i, x, y, z * 0.74);
  }
  bodyGeo.computeVertexNormals();
  part(bodyGeo, rubber, 0, 0.26, 0);
  part(new THREE.SphereGeometry(0.28, 32, 24), rubber, 0.26, 0.68, 0);
  // beak: upper and lower halves
  part(new THREE.SphereGeometry(0.15, 24, 16), beakMat, 0.5, 0.63, 0, 1.35, 0.42, 1);
  part(new THREE.SphereGeometry(0.12, 24, 16), beakMat, 0.48, 0.57, 0, 1.2, 0.3, 0.85);
  // eyes with a highlight
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.045, 16, 12), eyeMat, 0.45, 0.77, s * 0.14);
    const hl = part(new THREE.SphereGeometry(0.014, 8, 6), shine, 0.485, 0.79, s * 0.15);
    hl.castShadow = false;
    const wing = part(new THREE.SphereGeometry(0.24, 24, 16), wingMat, -0.06, 0.33, s * 0.3, 1.35, 0.55, 0.28);
    wing.rotation.z = 0.35;
  }

  // ---------- squeeze ----------
  let cycle = null;
  function activate() {
    if (cycle) return Promise.resolve(false);
    return new Promise((resolve) => { cycle = { t: 0, resolve }; });
  }
  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (!cycle) return;
    cycle.t += dt;
    const t = cycle.t, dur = reducedMotion ? 0.3 : 0.9;
    const k = Math.min(1, t / dur);
    // a quick squash, then a decaying wobble back to shape
    const s = reducedMotion ? 0 : k < 0.18 ? -0.32 * Math.sin((k / 0.18) * Math.PI / 2) : -0.32 * Math.cos(((k - 0.18) / 0.82) * Math.PI * 3.5) * (1 - k) ** 1.6;
    squash.scale.set(1 - s * 0.45, 1 + s, 1 - s * 0.45);
    squash.rotation.z = reducedMotion ? 0 : Math.sin(k * Math.PI * 4) * 0.12 * (1 - k);
    if (k >= 1) { squash.scale.set(1, 1, 1); squash.rotation.z = 0; cycle.resolve(true); cycle = null; }
  }
  function dispose() {
    duck.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    [rubber, wingMat, beakMat, eyeMat, shine].forEach((m) => m.dispose());
  }

  return { object: root, activate, get busy() { return !!cycle; }, update, dispose };
}
