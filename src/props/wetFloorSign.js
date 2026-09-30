import * as THREE from 'three';

/**
 * Wet floor sign with a puddle, for a three.js scene. When a robot walks into the water,
 * activate() electrocutes it: lightning crackles over the puddle and up the robot, sparks fly,
 * a blue light flickers and the sign rattles.
 *
 * Built in metres: a yellow A-frame sign 0,64 m tall next to a puddle about 1,3 × 0,9 m.
 * The origin sits on the floor at the centre of the puddle; the sign stands at its back-left
 * and faces +Z.
 *
 *   const wet = createWetFloorSign();
 *   scene.add(wet.object);
 *   wet.activate();                  // zap; resolves when it has died down
 *   wet.activate({ height: 1.8 });   // bolts reach up to 1,8 m, for a taller robot
 *   wet.update(delta);               // call every frame with the elapsed seconds
 *
 * Signs use "Fredoka" when the page has loaded it and fall back to system faces otherwise.
 */
export function createWetFloorSign({ reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = 'WetFloorSign';
  const FONT = '"Fredoka", "Arial Black", "Helvetica Neue", Arial, sans-serif';

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  // ---------- puddle ----------
  const puddleShape = new THREE.Shape();
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 1 + 0.12 * Math.sin(a * 3 + 0.7) + 0.07 * Math.sin(a * 5 + 2.1) + 0.05 * Math.sin(a * 9);
    const x = Math.cos(a) * 0.65 * r, z = Math.sin(a) * 0.45 * r;
    i ? puddleShape.lineTo(x, z) : puddleShape.moveTo(x, z);
  }
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x6a8fb0, roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0.38,
    envMapIntensity: 2.4, emissive: 0x39c8ff, emissiveIntensity: 0, depthWrite: false,
  });
  const puddle = new THREE.Mesh(new THREE.ShapeGeometry(puddleShape, 12).rotateX(-Math.PI / 2), puddleMat); // face up
  puddle.position.y = 0.002;
  puddle.receiveShadow = true;
  root.add(puddle);
  // a few droplets around the edge
  const dropMat = puddleMat.clone();
  [[0.85, 0.2, 0.06], [-0.78, -0.3, 0.05], [0.4, 0.6, 0.04], [-0.3, 0.58, 0.035]].forEach(([x, z, r]) => {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r, 16).rotateX(-Math.PI / 2), dropMat);
    d.position.set(x, 0.002, z);
    root.add(d);
  });
  const inPuddle = () => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.85;
    return new THREE.Vector3(Math.cos(a) * 0.62 * r, 0.004, Math.sin(a) * 0.42 * r);
  };

  // ---------- A-frame sign ----------
  const face = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#ffd21a'; g.fillRect(0, 0, w, h);
    // warning triangle with a slipping figure
    const cx = w / 2, ty = 150, s = 330;
    g.fillStyle = '#16161a';
    g.beginPath(); g.moveTo(cx, ty); g.lineTo(cx + s / 2 + 30, ty + s + 20); g.lineTo(cx - s / 2 - 30, ty + s + 20); g.closePath(); g.fill();
    g.fillStyle = '#ffd21a';
    g.beginPath(); g.moveTo(cx, ty + 50); g.lineTo(cx + s / 2 - 5, ty + s - 8); g.lineTo(cx - s / 2 + 5, ty + s - 8); g.closePath(); g.fill();
    g.strokeStyle = '#16161a'; g.fillStyle = '#16161a'; g.lineWidth = 18; g.lineCap = 'round';
    g.beginPath(); g.arc(cx + 34, ty + 150, 20, 0, Math.PI * 2); g.fill(); // head
    g.beginPath();
    g.moveTo(cx + 22, ty + 178); g.lineTo(cx - 20, ty + 238); // body
    g.moveTo(cx - 20, ty + 238); g.lineTo(cx + 40, ty + 262); g.lineTo(cx + 78, ty + 244); // front leg kicking up
    g.moveTo(cx - 20, ty + 238); g.lineTo(cx - 60, ty + 280); // back leg
    g.moveTo(cx + 14, ty + 192); g.lineTo(cx - 44, ty + 176); // arm back
    g.moveTo(cx + 14, ty + 192); g.lineTo(cx + 62, ty + 176); // arm forward
    g.stroke();
    g.lineWidth = 8; g.beginPath(); g.moveTo(cx - 110, ty + 296); g.lineTo(cx + 110, ty + 296); g.stroke(); // floor line
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#16161a';
    g.font = `800 98px ${FONT}`; g.fillText('CAUTION', cx, 600);
    g.font = `800 84px ${FONT}`; g.fillText('WET FLOOR', cx, 700);
    g.fillStyle = 'rgba(22,22,26,0.85)'; g.font = `700 44px ${FONT}`;
    g.fillText('LET OP · GLAD', cx, 800);
    g.fillText('ATTENTION · GLISSANT', cx, 860);
  });
  const panelW0 = 0.3, panelW1 = 0.22, PANEL_H = 0.62, SPLAY = 0.2;
  const panelShape = new THREE.Shape();
  panelShape.moveTo(-panelW0 / 2, 0); panelShape.lineTo(panelW0 / 2, 0);
  panelShape.lineTo(panelW1 / 2, PANEL_H - 0.05); panelShape.quadraticCurveTo(panelW1 / 2, PANEL_H, panelW1 / 2 - 0.05, PANEL_H);
  panelShape.lineTo(-panelW1 / 2 + 0.05, PANEL_H); panelShape.quadraticCurveTo(-panelW1 / 2, PANEL_H, -panelW1 / 2, PANEL_H - 0.05);
  panelShape.lineTo(-panelW0 / 2, 0);
  const handle = new THREE.Path();
  handle.moveTo(-0.05, PANEL_H - 0.075); handle.lineTo(0.05, PANEL_H - 0.075); handle.lineTo(0.05, PANEL_H - 0.045); handle.lineTo(-0.05, PANEL_H - 0.045); handle.lineTo(-0.05, PANEL_H - 0.075);
  panelShape.holes.push(handle);
  const plastic = new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.45 });
  const printMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.45 });

  const sign = new THREE.Group(); // rattles during a zap
  sign.position.set(-0.62, 0, -0.42);
  sign.rotation.y = 0.35;
  root.add(sign);
  for (const s of [1, -1]) {
    // each panel leans out from the shared top hinge
    const panel = new THREE.Group();
    panel.position.y = PANEL_H * Math.cos(SPLAY);
    panel.rotation.x = -s * SPLAY; // both prints face outwards
    if (s < 0) panel.rotation.y = Math.PI;
    sign.add(panel);
    const geo = new THREE.ExtrudeGeometry(panelShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
    geo.translate(0, -PANEL_H, -0.006);
    const m = new THREE.Mesh(geo, plastic);
    m.castShadow = m.receiveShadow = true;
    panel.add(m);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(panelW1 * 0.98, PANEL_H * 0.72), printMat);
    print.position.set(0, -PANEL_H * 0.52, 0.0095);
    panel.add(print);
  }

  // ---------- electricity ----------
  const zapLight = new THREE.PointLight(0x7fd8ff, 0, 4, 2);
  zapLight.position.set(0, 0.5, 0);
  root.add(zapLight);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3fb8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const BOLTS = 7;
  const bolts = Array.from({ length: BOLTS }, () => {
    const core = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
    const glow = new THREE.Mesh(new THREE.BufferGeometry(), glowMat);
    core.frustumCulled = glow.frustumCulled = false;
    root.add(core, glow);
    return { core, glow };
  });
  function jagged(a, b, steps, jitter) {
    const pts = [];
    const dir = new THREE.Vector3().subVectors(b, a);
    for (let i = 0; i <= steps; i++) {
      const p = a.clone().addScaledVector(dir, i / steps);
      if (i > 0 && i < steps) {
        const j = jitter * Math.sin((i / steps) * Math.PI);
        p.x += (Math.random() - 0.5) * j; p.y += (Math.random() - 0.5) * j * 0.6; p.z += (Math.random() - 0.5) * j;
      }
      pts.push(p);
    }
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
  }
  function rebuildBolts(height) {
    bolts.forEach((b, i) => {
      let a, c;
      if (i < 3) { a = inPuddle(); c = inPuddle(); } // arcs across the water
      else { // up into whatever is standing in the puddle
        a = inPuddle();
        c = new THREE.Vector3((Math.random() - 0.5) * 0.3, height * (0.35 + Math.random() * 0.65), (Math.random() - 0.5) * 0.3);
      }
      const curve = jagged(a, c, 9, 0.18);
      b.core.geometry.dispose(); b.glow.geometry.dispose();
      b.core.geometry = new THREE.TubeGeometry(curve, 24, 0.0035, 4);
      b.glow.geometry = new THREE.TubeGeometry(curve, 24, 0.014, 5);
      b.core.visible = b.glow.visible = Math.random() > 0.2;
    });
  }

  // sparks
  const SPARKS = reducedMotion ? 40 : 160;
  const sparkPos = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xfff1b8, size: 0.018, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  root.add(sparks);
  function emitSpark(i, height) {
    const p = Math.random() < 0.6 ? inPuddle() : new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * height, (Math.random() - 0.5) * 0.3);
    sparkPos.set([p.x, p.y, p.z], i * 3);
    const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2;
    sparkVel.set([Math.cos(a) * sp, 1 + Math.random() * 2.5, Math.sin(a) * sp], i * 3);
    sparkLife[i] = 0.3 + Math.random() * 0.5;
  }
  sparkLife.fill(0);
  for (let i = 0; i < SPARKS; i++) sparkPos[i * 3 + 1] = -10; // parked out of sight

  // ---------- animation ----------
  const T_ZAP = 1.6, T_TAIL = 0.6;
  let cycle = null, time = 0;

  function activate({ height = 1.2 } = {}) {
    if (cycle) return Promise.resolve(false);
    return new Promise((resolve) => { cycle = { t: 0, height, next: 0, resolve }; });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    let power = 0;
    if (cycle) {
      cycle.t += dt;
      const t = cycle.t;
      if (t < T_ZAP) {
        // flickering envelope: fast random strobing that dies away
        power = (0.55 + 0.45 * Math.random()) * (1 - (t / T_ZAP) ** 3);
        cycle.next -= dt;
        if (cycle.next <= 0) { rebuildBolts(cycle.height); cycle.next = reducedMotion ? 0.2 : 0.05 + Math.random() * 0.04; }
        const burst = reducedMotion ? 1 : 6;
        for (let k = 0, i = 0; k < burst && i < SPARKS; i++) if (sparkLife[i] <= 0) { emitSpark(i, cycle.height); k++; }
      } else if (t >= T_ZAP + T_TAIL) { cycle.resolve(true); cycle = null; }
    }
    const boltsOn = cycle && cycle.t < T_ZAP;
    coreMat.opacity = boltsOn ? Math.min(1, power * 1.4) : 0;
    glowMat.opacity = boltsOn ? power * 0.55 : 0;
    bolts.forEach((b) => { if (!boltsOn) b.core.visible = b.glow.visible = false; });
    zapLight.intensity = boltsOn ? power * (reducedMotion ? 3 : 9) : 0;
    const glowTarget = boltsOn ? power * 1.5 : 0;
    puddleMat.emissiveIntensity += (glowTarget - puddleMat.emissiveIntensity) * Math.min(1, dt * (boltsOn ? 30 : 5));
    dropMat.emissiveIntensity = puddleMat.emissiveIntensity;
    sign.rotation.z = boltsOn && !reducedMotion ? (Math.random() - 0.5) * 0.05 : 0;
    sign.position.x = -0.62 + (boltsOn && !reducedMotion ? (Math.random() - 0.5) * 0.008 : 0);

    // sparks fly and fall
    let any = false;
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue;
      any = true;
      sparkLife[i] -= dt;
      sparkVel[i * 3 + 1] -= 9.81 * dt;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] = Math.max(0.005, sparkPos[i * 3 + 1] + sparkVel[i * 3 + 1] * dt);
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -10;
    }
    if (any || boltsOn) sparkGeo.attributes.position.needsUpdate = true;
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  return { object: root, activate, get busy() { return !!cycle; }, update, dispose };
}
