import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Candy grabbing (claw) machine for a three.js scene.
 *
 * Built in metres: 0,80 m wide, 1,85 m tall, 0,80 m deep (the control panel sticks out 0,11 m
 * at the front). The origin sits on the floor at the centre of the footprint and the front faces +Z.
 *
 *   const machine = createCandyGrabbingMachine();
 *   scene.add(machine.object);
 *   machine.activate();           // one grab; resolves true when the sweet lands in the prize tray,
 *                                 // false when out of stock or busy
 *   machine.setOutOfStock(true);  // empties the machine and hangs the out-of-stock sign
 *   machine.update(delta);        // call every frame with the elapsed seconds
 *
 * The machine switches to out of stock on its own when the last sweet has been grabbed;
 * setOutOfStock(false) refills it. Canvas labels use "Fredoka" when the page has loaded it and
 * fall back to system faces otherwise. The scene should have an environment map for the chrome.
 */
export function createCandyGrabbingMachine({ reducedMotion = false } = {}) {
  const FONT = '"Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
  const root = new THREE.Group();
  root.name = 'CandyGrabbingMachine';

  // ---------- helpers ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  function fitFont(g, text, font, size, maxW) {
    let s = size;
    g.font = font.replace('%s', s);
    while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = font.replace('%s', s); }
  }
  function label(text, w, h, color) {
    const cw = Math.round(w * 2600), ch = Math.round(h * 2600);
    const tex = canvasTex(cw, ch, (g) => {
      fitFont(g, text, `700 %spx ${FONT}`, Math.round(ch * 0.72), cw - 8);
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, cw / 2, ch / 2 + 1);
    });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 }));
  }
  function rr(p, x0, y0, x1, y1, r) {
    p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.quadraticCurveTo(x1, y0, x1, y0 + r);
    p.lineTo(x1, y1 - r); p.quadraticCurveTo(x1, y1, x1 - r, y1); p.lineTo(x0 + r, y1);
    p.quadraticCurveTo(x0, y1, x0, y1 - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0);
    return p;
  }
  function add(mesh, x, y, z, parent = root, cast = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

  // ---------- materials ----------
  // Cabinet ("pink") and its matching acrylic accent recolored to KING's own
  // orange (0xe8630f, matching sponsorBooths.ts's createKINGBooth) — the
  // generator's own default palette (pink cabinet, pink-tinted glass) has no
  // connection to this game's booth, so it's swapped here rather than left
  // as the generic default. Kept as the `pink`/`acrylic` keys (not renamed)
  // to keep every other reference in this file an unchanged diff.
  const MAT = {
    pink: new THREE.MeshStandardMaterial({ color: 0xe8630f, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.35 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xfff1dc, roughness: 0.5, envMapIntensity: 0.4 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.2, metalness: 1 }),
    darkChrome: new THREE.MeshStandardMaterial({ color: 0x6d7275, roughness: 0.35, metalness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.5, metalness: 0.2 }),
    mint: new THREE.MeshStandardMaterial({ color: 0xa8e6d4, roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.05, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    acrylic: new THREE.MeshStandardMaterial({ color: 0xffb347, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    hidden: new THREE.MeshBasicMaterial({ visible: false }),
  };

  // ---------- base cabinet with prize tray ----------
  const FRONT = 0.396;
  const PRIZE = { x0: -0.30, x1: -0.08, y0: 0.18, y1: 0.38 };
  add(new THREE.Mesh(new THREE.BoxGeometry(0.81, 0.06, 0.81), MAT.black), 0, 0.03, 0);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.85, 0.66, 4, 0.025), MAT.pink), 0, 0.425, -0.07);
  const frontShape = rr(new THREE.Shape(), -0.394, 0.006, 0.394, 0.844, 0.02);
  frontShape.holes.push(rr(new THREE.Path(), PRIZE.x0, PRIZE.y0, PRIZE.x1, PRIZE.y1, 0.02));
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(frontShape, {
    depth: 0.128, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 8,
  }), MAT.pink), 0, 0, 0.262);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.806, 0.03, 0.02), MAT.cream), 0, 0.62, FRONT + 0.004); // trim stripe

  // Prize tray recess and smoked flap
  const pw = PRIZE.x1 - PRIZE.x0 - 0.02, ph = PRIZE.y1 - PRIZE.y0 - 0.014, pd = 0.12;
  const pcx = (PRIZE.x0 + PRIZE.x1) / 2, pcy = (PRIZE.y0 + PRIZE.y1) / 2;
  const trayMat = MAT.darkChrome.clone(); trayMat.side = THREE.BackSide;
  add(new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), [trayMat, trayMat, trayMat, trayMat, MAT.hidden, trayMat]), pcx, pcy, FRONT - pd / 2, root, false);
  const trayFloorY = pcy - ph / 2;
  const flap = new THREE.Group();
  flap.position.set(pcx, PRIZE.y1 - 0.01, FRONT - 0.012);
  root.add(flap);
  add(new THREE.Mesh(new THREE.PlaneGeometry(pw, 0.1), new THREE.MeshStandardMaterial({
    color: 0x2a1a22, transparent: true, opacity: 0.55, roughness: 0.1, envMapIntensity: 1.5, side: THREE.DoubleSide,
  })), 0, -0.05, 0, flap, false);
  add(label('PRIZE', 0.12, 0.028, '#fff1dc'), pcx, PRIZE.y1 + 0.03, FRONT + 0.001, root, false);

  // Free to play: a chrome plaque instead of a coin door
  add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.08, 0.01, 2, 0.008), MAT.chrome), 0.22, 0.47, FRONT + 0.005);
  add(label('FREE PLAY', 0.14, 0.036, '#8a1f45'), 0.22, 0.47, FRONT + 0.0105, root, false);

  // Control panel: joystick, grab button, status lamp
  const panel = new THREE.Group();
  panel.position.set(0, 0.865, 0.43);
  panel.rotation.x = 0.2;
  root.add(panel);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.05, 0.16, 3, 0.015), MAT.cream), 0, 0, 0, panel);
  const stick = new THREE.Group();
  stick.position.set(-0.13, 0.025, 0.01);
  panel.add(stick);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.008, 28), MAT.black), 0, 0.004, 0, stick);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.07, 12), MAT.chrome), 0, 0.04, 0, stick);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 16), new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.25 })), 0, 0.08, 0, stick);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 32), MAT.black), 0.13, 0.03, 0.01, panel);
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffc107, emissiveIntensity: 0.2, roughness: 0.3 });
  const button = add(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.035, 0.018, 32), buttonMat), 0.13, 0.043, 0.01, panel);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a1512, emissive: 0xff3b24, emissiveIntensity: 0, roughness: 0.2 });
  add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampMat), 0.32, 0.025, 0.01, panel, false);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0022, 8, 32).rotateX(Math.PI / 2), MAT.darkChrome), 0.32, 0.026, 0.01, panel, false);

  // ---------- glass play area ----------
  const FLOOR_Y = 0.87, TOP_Y = 1.585, IN = 0.385;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.02, 0.77), MAT.mint), 0, FLOOR_Y - 0.01, 0);
  for (const [x, z] of [[-IN, -IN], [IN, -IN], [-IN, IN], [IN, IN]]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.03, TOP_Y - FLOOR_Y + 0.03, 0.03), MAT.chrome), x, (FLOOR_Y + TOP_Y) / 2, z);
  }
  [[0.8, 0.03, 0, IN], [0.8, 0.03, 0, -IN], [0.03, 0.8, IN, 0], [0.03, 0.8, -IN, 0]].forEach(([w, d, x, z]) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), MAT.chrome), x, TOP_Y, z);
  });
  const gh = TOP_Y - FLOOR_Y;
  const glassFront = add(new THREE.Mesh(new THREE.PlaneGeometry(0.74, gh), MAT.glass), 0, FLOOR_Y + gh / 2, IN, root, false);
  glassFront.renderOrder = 2;
  for (const s of [-1, 1]) {
    const side = add(new THREE.Mesh(new THREE.PlaneGeometry(0.74, gh), MAT.glass), s * IN, FLOOR_Y + gh / 2, 0, root, false);
    side.rotation.y = Math.PI / 2;
    side.renderOrder = 2;
  }
  const backTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffe3ec'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 4);
    for (let x = -w; x < w; x += 64) { g.fillStyle = '#ffb3cb'; g.fillRect(x, -h, 26, h * 2); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i * 97) % w, (i * 53) % h, 6, 0, Math.PI * 2); g.fill(); }
  });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.74, gh), new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.7 })), 0, FLOOR_Y + gh / 2, -IN + 0.012, root, false);
  const inLight = new THREE.PointLight(0xfff4e6, 2.2, 1.6, 2);
  inLight.position.set(0, TOP_Y - 0.06, 0.1);
  root.add(inLight);

  // Prize chute in the front-left corner
  const CHUTE = new THREE.Vector3(-0.265, FLOOR_Y, 0.265);
  const wallA = add(new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.14), MAT.acrylic), -0.16, FLOOR_Y + 0.07, 0.265, root, false);
  wallA.rotation.y = Math.PI / 2;
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.14), MAT.acrylic), -0.265, FLOOR_Y + 0.07, 0.16, root, false);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.21), MAT.chrome), -0.16, FLOOR_Y + 0.14, 0.265, root, false);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.012, 0.012), MAT.chrome), -0.265, FLOOR_Y + 0.14, 0.16, root, false);
  const hole = add(new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.19), new THREE.MeshBasicMaterial({ color: 0x0a0608 })), CHUTE.x, FLOOR_Y + 0.001, CHUTE.z, root, false);
  hole.rotation.x = -Math.PI / 2;

  // ---------- header marquee ----------
  add(new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.26, 0.8, 4, 0.025), MAT.pink), 0, 1.72, 0);
  const signTex = canvasTex(1024, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#fff3b0'); bg.addColorStop(1, '#ffd23f');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'CANDY GRAB', `700 %spx ${FONT}`, 150, w - 80);
    g.lineJoin = 'round'; g.lineWidth = 18; g.strokeStyle = '#8a1f45';
    g.strokeText('CANDY GRAB', w / 2, h / 2 + 6);
    g.fillStyle = '#ff4f7b'; g.fillText('CANDY GRAB', w / 2, h / 2 + 6);
  });
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.165), signMat), 0, 1.72, 0.401, root, false);
  const bulbGeo = new THREE.SphereGeometry(0.009, 12, 8);
  const bulbPos = [];
  for (let i = 0; i < 11; i++) bulbPos.push([-0.35 + i * 0.07, 1.828]);
  for (const y of [1.765, 1.675]) bulbPos.push([0.37, y]);
  for (let i = 10; i >= 0; i--) bulbPos.push([-0.35 + i * 0.07, 1.612]);
  for (const y of [1.675, 1.765]) bulbPos.push([-0.37, y]);
  const bulbs = bulbPos.map(([x, y]) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffd27a, emissiveIntensity: 1, roughness: 0.3 });
    add(new THREE.Mesh(bulbGeo, m), x, y, 0.402, root, false);
    return m;
  });

  // Out-of-stock sign, hung behind the front glass
  const oos = new THREE.Group();
  oos.position.set(0, TOP_Y - 0.015, IN - 0.02);
  root.add(oos);
  const oosTex = canvasTex(1024, 360, (g, w, h) => {
    g.fillStyle = '#c8321f';
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 36) : g.rect(0, 0, w, h); g.fill();
    g.strokeStyle = '#fff4ec'; g.lineWidth = 12;
    g.beginPath(); g.roundRect ? g.roundRect(22, 22, w - 44, h - 44, 24) : g.rect(22, 22, w - 44, h - 44); g.stroke();
    g.fillStyle = '#fff4ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'OUT OF STOCK', `700 %spx ${FONT}`, 150, w - 110);
    g.fillText('OUT OF STOCK', w / 2, h / 2 + 6);
  });
  const oosBoard = add(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.162),
    new THREE.MeshBasicMaterial({ map: oosTex, toneMapped: false, side: THREE.DoubleSide })), 0, -0.2, 0, oos, false);
  for (const x of [-0.17, 0.17]) {
    const cord = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.12, 6), MAT.black), x, -0.06, 0, oos, false);
    cord.rotation.z = x > 0 ? -0.05 : 0.05;
  }
  oosBoard.castShadow = false;
  oos.visible = false;

  // ---------- gantry + claw ----------
  const RAIL_Y = 1.55;
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.77), MAT.darkChrome), s * 0.365, RAIL_Y, 0, root, false);
  const bridge = add(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.018, 0.03), MAT.darkChrome), 0, RAIL_Y, 0, root, false);
  const carriage = add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.07), MAT.black), 0, RAIL_Y - 0.015, 0, root, false);
  const pendulum = new THREE.Group(); // swings cable and claw together
  root.add(pendulum);
  const cable = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6), MAT.black), 0, 0, 0, pendulum, false);
  const claw = new THREE.Group();
  pendulum.add(claw);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 24), MAT.pink), 0, 0.02, 0, claw);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.035, 24), MAT.chrome), 0, 0, 0, claw);
  const fingers = [0, 1, 2].map((i) => {
    const yaw = new THREE.Group();
    yaw.rotation.y = (i / 3) * Math.PI * 2;
    claw.add(yaw);
    const pivot = new THREE.Group();
    pivot.position.set(0.02, -0.0175, 0);
    yaw.add(pivot);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.065, 0.012), MAT.chrome), 0, -0.0325, 0, pivot);
    const tip = add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.035, 0.012), MAT.chrome), -0.0126, -0.0772, 0, pivot);
    tip.rotation.z = -0.8;
    return pivot;
  });
  const F_CLOSED = 0.08, F_OPEN = 0.62, F_GRIP = 0.2;
  const UP = 0.1;
  const HOME = new THREE.Vector2(CHUTE.x, CHUTE.z);
  const clawState = { x: HOME.x, z: HOME.y, drop: UP, fingers: F_CLOSED, tiltX: 0, tiltZ: 0 };

  // ---------- candy pile (instanced) ----------
  const body = new THREE.SphereGeometry(0.018, 14, 10).scale(1.35, 1, 1);
  const endL = new THREE.ConeGeometry(0.013, 0.018, 10).rotateZ(-Math.PI / 2).translate(-0.031, 0, 0);
  const endR = new THREE.ConeGeometry(0.013, 0.018, 10).rotateZ(Math.PI / 2).translate(0.031, 0, 0);
  const candyGeo = mergeGeometries([body, endL, endR]);
  [body, endL, endR].forEach((g) => g.dispose());
  const COLORS = ['#ff4f7b', '#ffd23f', '#3ec1d3', '#7bd389', '#b388eb', '#ff8c42', '#f7f7f2', '#e63946'].map((c) => new THREE.Color(c));
  const candyMat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.1 });

  const pile = [];
  const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); // same heap every time
  for (let layer = 0; layer < 4; layer++) {
    for (let ix = -6; ix <= 6; ix++) {
      for (let iz = -6; iz <= 6; iz++) {
        const x = ix * 0.052 + (rand() - 0.5) * 0.03 + (layer % 2) * 0.026;
        const z = iz * 0.052 + (rand() - 0.5) * 0.03 + (layer % 2) * 0.026;
        if (Math.abs(x) > 0.34 || Math.abs(z) > 0.34) continue;
        if (x < -0.12 && z > 0.12) continue; // keep the chute clear
        const mound = 0.11 * (1 - Math.min(1, Math.hypot(x, z + 0.05) / 0.5) ** 2);
        const y = layer * 0.027;
        if (y > mound) continue;
        pile.push({
          pos: new THREE.Vector3(x, FLOOR_Y + 0.017 + y + rand() * 0.008, z),
          quat: new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.9, rand() * Math.PI * 2, (rand() - 0.5) * 0.9)),
          color: COLORS[Math.floor(rand() * COLORS.length)],
          taken: false,
        });
      }
    }
  }
  const candies = new THREE.InstancedMesh(candyGeo, candyMat, pile.length);
  candies.castShadow = true; candies.receiveShadow = true;
  const m4 = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Vector3(0, 0, 0);
  function writeInstance(i) {
    const c = pile[i];
    m4.compose(c.pos, c.quat, c.taken ? ZERO : ONE);
    candies.setMatrixAt(i, m4);
  }
  pile.forEach((c, i) => { writeInstance(i); candies.setColorAt(i, c.color); });
  root.add(candies);

  // ---------- state ----------
  let outOfStock = false;
  let cycle = null;      // { steps, i, t, resolve, candy, target }
  let prize = null;      // sweet on its way to / lying in the prize tray
  let denied = 0, time = 0, pressT = 0, signSwing = 0, flapSwing = 0;
  const prevXZ = new THREE.Vector2(clawState.x, clawState.z);

  function setOutOfStock(v) {
    outOfStock = !!v;
    if (!outOfStock) pile.forEach((c, i) => { if (c.taken) { c.taken = false; writeInstance(i); } });
    candies.visible = !outOfStock;
    candies.instanceMatrix.needsUpdate = true;
    oos.visible = outOfStock;
    signSwing = outOfStock ? 0.12 : 0;
    signMat.emissiveIntensity = outOfStock ? 0.15 : 0.9;
  }

  function pickTarget() {
    const left = pile.map((c, i) => [c, i]).filter(([c]) => !c.taken);
    if (!left.length) return null;
    const reachable = left.filter(([c]) => Math.abs(c.pos.x) <= 0.31 && Math.abs(c.pos.z) <= 0.31);
    if (reachable.length) left.splice(0, left.length, ...reachable);
    left.sort((a, b) => b[0].pos.y - a[0].pos.y);
    return left[Math.floor(Math.random() * Math.min(12, left.length))][1];
  }

  function activate() {
    if (cycle || (prize && !prize.landed)) return Promise.resolve(false);
    if (outOfStock) { denied = 1.2; signSwing = 0.18; return Promise.resolve(false); }
    const idx = pickTarget();
    if (idx === null) { setOutOfStock(true); return Promise.resolve(false); }
    if (prize) { root.remove(prize.mesh); prize = null; }
    return new Promise((resolve) => {
      const c = pile[idx];
      const from = new THREE.Vector2(clawState.x, clawState.z), to = new THREE.Vector2(c.pos.x, c.pos.z);
      const travel = (a, b) => Math.max(0.7, a.distanceTo(b) / 0.26);
      // claw hub height that puts closed fingertips just under the sweet
      const downDrop = (RAIL_Y - 0.0325) - (c.pos.y + 0.092);
      const move = (a, b) => (k) => { const e = easeInOut(k); clawState.x = lerp(a.x, b.x, e); clawState.z = lerp(a.y, b.y, e); };
      const steps = [
        { dur: 0.35, run: (k) => { pressT = Math.sin(k * Math.PI); } },
        { dur: travel(from, to), run: move(from, to) },
        { dur: 0.3, run: (k) => { clawState.fingers = lerp(F_CLOSED, F_OPEN, k); } },
        { dur: 1.1, run: (k) => { clawState.drop = lerp(UP, downDrop, easeInOut(k)); } },
        { dur: 0.45, run: (k) => { clawState.fingers = lerp(F_OPEN, F_GRIP, k); }, end: () => grab(idx) },
        { dur: 1.1, run: (k) => { clawState.drop = lerp(downDrop, UP, easeInOut(k)); } },
        { dur: travel(to, HOME), run: move(to, HOME) },
        { dur: 0.3, run: (k) => { clawState.fingers = lerp(F_GRIP, F_OPEN, k); }, end: release },
        { dur: 0.35, run: (k) => { clawState.fingers = lerp(F_OPEN, F_CLOSED, k); } },
      ];
      cycle = { steps, i: 0, t: 0, resolve, candy: null };
    });
  }

  function grab(idx) {
    const c = pile[idx];
    c.taken = true;
    writeInstance(idx);
    candies.instanceMatrix.needsUpdate = true;
    const mesh = new THREE.Mesh(candyGeo, new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.25, metalness: 0.1, transparent: true }));
    mesh.castShadow = true;
    mesh.position.copy(c.pos);
    mesh.quaternion.copy(c.quat);
    root.add(mesh);
    root.updateMatrixWorld(true);
    claw.attach(mesh);
    cycle.candy = mesh;
  }

  function release() {
    const mesh = cycle.candy;
    if (!mesh) return;
    root.updateMatrixWorld(true);
    root.attach(mesh);
    prize = { mesh, t: 0, y0: mesh.position.y, x0: mesh.position.x, z0: mesh.position.z, landed: false, resolve: cycle.resolve };
    cycle.resolve = null;
    cycle.candy = null;
  }

  // ---------- per-frame ----------
  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    denied = Math.max(0, denied - dt);

    if (cycle) {
      const s = cycle.steps[cycle.i];
      cycle.t += dt;
      const k = Math.min(1, cycle.t / s.dur);
      s.run(k);
      if (k >= 1) {
        if (s.end) s.end();
        cycle.i += 1; cycle.t = 0;
        if (cycle.i >= cycle.steps.length) cycle = null;
      }
    }

    // Prize: falls down the chute, then pops out in the tray
    if (prize) {
      const p = prize;
      p.t += dt;
      const fallT = 0.36, hideT = 0.25, popT = 0.35;
      if (p.t < fallT) {
        const tt = p.t;
        p.mesh.position.set(p.x0, p.y0 - 0.5 * 9.81 * tt * tt, p.z0);
        p.mesh.rotation.x += dt * 6;
      } else if (p.t < fallT + hideT) {
        p.mesh.visible = false;
      } else if (p.t < fallT + hideT + popT) {
        const k = (p.t - fallT - hideT) / popT;
        p.mesh.visible = true;
        p.mesh.position.set(pcx, lerp(PRIZE.y1 - 0.03, trayFloorY + 0.017, k * k), lerp(FRONT - 0.1, FRONT - 0.05, k));
        p.mesh.rotation.set(0, 0.4, k * 2);
      } else if (!p.landed) {
        p.landed = true;
        p.mesh.rotation.set(0, 0.4, 0);
        flapSwing = 0.5;
        if (p.resolve) p.resolve(true);
        if (pile.every((c) => c.taken)) setOutOfStock(true);
      }
    }

    // Gantry, cable, claw
    clawState.x = THREE.MathUtils.clamp(clawState.x, -0.32, 0.32);
    clawState.z = THREE.MathUtils.clamp(clawState.z, -0.32, 0.32);
    const vx = (clawState.x - prevXZ.x) / Math.max(dt, 1e-4), vz = (clawState.z - prevXZ.y) / Math.max(dt, 1e-4);
    prevXZ.set(clawState.x, clawState.z);
    bridge.position.z = clawState.z;
    carriage.position.set(clawState.x, RAIL_Y - 0.015, clawState.z);
    pendulum.position.set(clawState.x, RAIL_Y - 0.0325, clawState.z);
    cable.scale.y = clawState.drop;
    cable.position.y = -clawState.drop / 2;
    claw.position.y = -clawState.drop;
    fingers.forEach((f) => { f.rotation.z = clawState.fingers; });
    const swing = reducedMotion ? 0 : 1;
    clawState.tiltX = lerp(clawState.tiltX, vz * 0.35 * swing, Math.min(1, dt * 5));
    clawState.tiltZ = lerp(clawState.tiltZ, -vx * 0.35 * swing, Math.min(1, dt * 5));
    pendulum.rotation.set(clawState.tiltX, 0, clawState.tiltZ);

    // Controls follow the claw
    stick.rotation.set(THREE.MathUtils.clamp(vz * 1.4, -0.35, 0.35), 0, THREE.MathUtils.clamp(-vx * 1.4, -0.35, 0.35));
    button.position.y = 0.043 - pressT * 0.008;
    buttonMat.emissiveIntensity = cycle ? 1.2 : outOfStock ? 0 : 0.2;
    pressT = cycle && cycle.i === 0 ? pressT : 0;

    // Lights
    const chase = Math.floor(time * 12);
    bulbs.forEach((m, i) => {
      if (outOfStock) m.emissiveIntensity = 0;
      else if (cycle || (prize && !prize.landed)) m.emissiveIntensity = (i + chase) % 4 === 0 ? 3 : 0.35;
      else m.emissiveIntensity = reducedMotion ? 1.2 : 1.1 + Math.sin(time * 2 + i * 0.7) * 0.5;
    });
    lampMat.emissiveIntensity = outOfStock && Math.sin(time * (denied > 0 ? 14 : 5)) > 0 ? 3 : 0;

    // Sign and flap swing
    signSwing *= Math.exp(-dt * 1.6);
    oos.rotation.z = reducedMotion ? 0 : Math.sin(time * 3.2) * signSwing;
    flapSwing *= Math.exp(-dt * 3);
    flap.rotation.x = -Math.abs(Math.sin(time * 9)) * flapSwing;
  }

  function dispose() {
    if (prize) root.remove(prize.mesh);
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  update(0);
  return {
    object: root,
    activate,
    setOutOfStock,
    get outOfStock() { return outOfStock; },
    get busy() { return !!cycle || (!!prize && !prize.landed); },
    update,
    dispose,
  };
}
