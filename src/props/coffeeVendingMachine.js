import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Coffee vending machine for a three.js scene.
 *
 * Built in metres: 0,76 m wide, 1,83 m tall, 0,78 m deep. The origin sits on the floor at the
 * centre of the footprint and the front faces +Z.
 *
 *   const machine = createCoffeeVendingMachine();
 *   scene.add(machine.object);
 *   machine.activate();           // plays one brew cycle; resolves false when out of stock or busy
 *   machine.setOutOfStock(true);  // shows the out-of-stock state
 *   machine.update(delta);        // call every frame with the elapsed seconds
 *
 * Canvas labels use "Big Shoulders Display", "Familjen Grotesk" and VT323 when the page has
 * loaded them, and fall back to system faces otherwise. Load the fonts before creating the
 * machine if you want them. The scene should have an environment map for the metal to read well.
 */
export function createCoffeeVendingMachine({ reducedMotion = false } = {}) {
  const DISPLAY = '"Big Shoulders Display", Impact, "Arial Narrow", sans-serif';
  const BODY = '"Familjen Grotesk", "Helvetica Neue", Arial, sans-serif';
  const LCD_FONT = 'VT323, "Courier New", monospace';

  const root = new THREE.Group();
  root.name = 'CoffeeVendingMachine';
  const shake = new THREE.Group(); // everything that vibrates while grinding
  root.add(shake);

  // ---------- helpers ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.userData.g = g;
    return t;
  }
  function fitFont(g, text, font, size, maxW) {
    let s = size;
    g.font = font.replace('%s', s);
    while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = font.replace('%s', s); }
  }
  function label(text, w, h, color = '#2c3335', size = 0.72) {
    const cw = Math.round(w * 2600), ch = Math.round(h * 2600);
    const tex = canvasTex(cw, ch, (g) => {
      fitFont(g, text, `700 %spx ${BODY}`, Math.round(ch * size), cw - 8);
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
  const add = (mesh, x, y, z, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    shake.add(mesh);
    return mesh;
  };
  const inside = (m) => { const c = m.clone(); c.side = THREE.BackSide; return c; };

  // ---------- materials ----------
  const MAT = {
    enamel: new THREE.MeshStandardMaterial({ color: 0x0e3a32, roughness: 0.34, metalness: 0.1, envMapIntensity: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xbfc4c6, roughness: 0.3, metalness: 0.95, envMapIntensity: 0.8 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x5a6062, roughness: 0.42, metalness: 0.9, envMapIntensity: 0.5 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0d1010, roughness: 0.45, metalness: 0.2 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd4a24c, roughness: 0.28, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121414, roughness: 0.9 }),
    hidden: new THREE.MeshBasicMaterial({ visible: false }),
  };

  // ---------- cabinet ----------
  const FRONT = 0.376;
  const BAY = { x0: -0.29, x1: 0.03, y0: 0.50, y1: 0.90 };

  add(new THREE.Mesh(new RoundedBoxGeometry(0.76, 1.76, 0.52, 4, 0.03), MAT.enamel), 0, 0.95, -0.13);
  const doorShape = rr(new THREE.Shape(), -0.374, 0.076, 0.374, 1.824, 0.035);
  doorShape.holes.push(rr(new THREE.Path(), BAY.x0, BAY.y0, BAY.x1, BAY.y1, 0.02));
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(doorShape, {
    depth: 0.254, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 8,
  }), MAT.enamel), 0, 0, 0.116);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.07, 0.66), MAT.rubber), 0, 0.035, -0.02);
  for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.007, 0.004), MAT.black), -0.08, 0.12 + i * 0.022, FRONT + 0.001, false);

  // Dispensing bay: an open steel box seen from inside
  const bayW = BAY.x1 - BAY.x0 - 0.024, bayH = BAY.y1 - BAY.y0 - 0.014, bayD = 0.24;
  const bayCx = (BAY.x0 + BAY.x1) / 2, bayCy = (BAY.y0 + BAY.y1) / 2;
  const bayFloorY = bayCy - bayH / 2, bayTopY = bayCy + bayH / 2;
  const bayMat = inside(MAT.darkSteel);
  add(new THREE.Mesh(new THREE.BoxGeometry(bayW, bayH, bayD), [bayMat, bayMat, bayMat, bayMat, MAT.hidden, bayMat]), bayCx, bayCy, FRONT - bayD / 2, false);
  add(new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.02, 0.012, 0.2), MAT.black), bayCx, bayFloorY + 0.006, 0.25, false);
  for (let i = 0; i < 9; i++) add(new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.03, 0.006, 0.009), MAT.steel), bayCx, bayFloorY + 0.015, 0.165 + i * 0.022, false);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xfff1dc });
  add(new THREE.Mesh(new THREE.BoxGeometry(bayW - 0.03, 0.004, 0.01), ledMat), bayCx, bayTopY - 0.003, FRONT - 0.02, false);
  const bayLight = new THREE.PointLight(0xffecd6, 1.2, 0.75, 2);
  bayLight.position.set(bayCx, bayTopY - 0.04, 0.32);
  shake.add(bayLight);

  const CUP_POS = new THREE.Vector3(bayCx, bayFloorY + 0.021, 0.255);
  const NOZZLE_Y = bayTopY - 0.061;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.05, 20), MAT.steel), CUP_POS.x, bayTopY - 0.025, CUP_POS.z, false);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0045, 0.014, 16), MAT.darkSteel), CUP_POS.x, NOZZLE_Y + 0.007, CUP_POS.z, false);

  // "JAVA COFFEE" down both sides of the cabinet
  const sideTex = canvasTex(320, 1400, (g, w, h) => {
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f2c86e';
    fitFont(g, 'JAVA COFFEE', `800 %spx ${DISPLAY}`, 250, h - 120);
    g.fillText('JAVA COFFEE', 0, 8);
    g.restore();
  });
  for (const s of [-1, 1]) {
    const decal = add(new THREE.Mesh(new THREE.PlaneGeometry(0.26, 1.14),
      new THREE.MeshStandardMaterial({ map: sideTex, transparent: true, roughness: 0.4 })), s * 0.3815, 1.0, -0.02, false);
    decal.rotation.y = s * Math.PI / 2;
  }

  // ---------- illuminated menu ----------
  // Every drink is free of charge, so the machine shows no prices and has no coin slot
  const DRINKS = [
    ['Espresso', 40, 92], ['Lungo', 110, 90], ['Cappuccino', 180, 68],
    ['Latte macchiato', 250, 65], ['Hot chocolate', 200, 75], ['Black tea', 220, 95],
  ];
  const PW = 0.44, PH = 0.735, PCX = -0.13, PCY = 1.385;
  const posterTex = canvasTex(1024, 1710, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2d1c12'); bg.addColorStop(1, '#130b07');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d5a4f'; g.fillRect(0, 0, W, 250);
    g.fillStyle = '#d9a441'; g.fillRect(0, 250, W, 8);
    g.textAlign = 'center'; g.fillStyle = '#f2c86e';
    fitFont(g, 'JAVA COFFEE', `800 %spx ${DISPLAY}`, 156, W - 80);
    g.fillText('JAVA COFFEE', W / 2, 168);
    g.fillStyle = '#bfe0d5'; g.font = `600 32px ${BODY}`;
    g.fillText('BEAN TO CUP  ·  9 G PER SHOT  ·  9 BAR', W / 2, 220);
    // cup seen from above
    const cx = W / 2, cy = 555;
    const glow = g.createRadialGradient(cx, cy, 60, cx, cy, 420);
    glow.addColorStop(0, 'rgba(255,190,110,0.32)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = glow; g.fillRect(0, 260, W, 600);
    const disc = (r, fill, dx = 0, dy = 0) => { g.fillStyle = fill; g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill(); };
    disc(250, 'rgba(0,0,0,0.35)', 14, 20); disc(250, '#ebe4d8'); disc(192, '#f8f5ef');
    const crema = g.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 168);
    crema.addColorStop(0, '#d8ad72'); crema.addColorStop(0.55, '#a8683a'); crema.addColorStop(1, '#4e2610');
    disc(166, crema);
    g.fillStyle = '#f3e4c8';
    g.beginPath(); g.moveTo(cx, cy + 80);
    g.bezierCurveTo(cx - 130, cy - 5, cx - 80, cy - 118, cx, cy - 52);
    g.bezierCurveTo(cx + 80, cy - 118, cx + 130, cy - 5, cx, cy + 80);
    g.fill();
    // menu
    DRINKS.forEach(([name, ml, temp], i) => {
      const y = 890 + i * 122;
      g.strokeStyle = '#d9a441'; g.lineWidth = 4;
      g.beginPath(); g.arc(88, y + 8, 32, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#d9a441'; g.textAlign = 'center'; g.font = `700 44px ${DISPLAY}`;
      g.fillText(String(i + 1), 88, y + 23);
      g.textAlign = 'left'; g.fillStyle = '#f4e8d6'; g.font = `600 52px ${BODY}`;
      g.fillText(name, 148, y + 12);
      g.fillStyle = '#b3977b'; g.font = `400 30px ${BODY}`;
      g.fillText(`${ml} ml  ·  ${temp} °C`, 150, y + 54);
      g.fillStyle = 'rgba(217,164,65,0.22)'; g.fillRect(56, y + 78, W - 112, 2);
    });
    g.textAlign = 'center'; g.fillStyle = '#f2c86e'; g.font = `800 64px ${DISPLAY}`;
    g.fillText('ALL DRINKS FREE OF CHARGE', W / 2, H - 50);
  });
  const posterMat = new THREE.MeshStandardMaterial({ map: posterTex, emissiveMap: posterTex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.9 });
  add(new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), posterMat), PCX, PCY, FRONT + 0.001, false);

  // Out-of-stock overlay on the menu
  const oosTex = canvasTex(1024, 1710, (g, W, H) => {
    g.fillStyle = 'rgba(8,5,3,0.62)'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H * 0.46); g.rotate(-0.12);
    g.fillStyle = '#c8321f'; g.fillRect(-W, -110, W * 2, 220);
    g.fillStyle = '#fff'; g.fillRect(-W, -110, W * 2, 7); g.fillRect(-W, 103, W * 2, 7);
    g.fillStyle = '#fff4ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'OUT OF STOCK', `800 %spx ${DISPLAY}`, 150, W - 60);
    g.fillText('OUT OF STOCK', 0, -2);
    g.restore();
  });
  const oos = add(new THREE.Mesh(new THREE.PlaneGeometry(PW, PH),
    new THREE.MeshBasicMaterial({ map: oosTex, transparent: true, toneMapped: false })), PCX, PCY, FRONT + 0.004, false);
  oos.visible = false;

  add(new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0.2, envMapIntensity: 2.2, depthWrite: false,
  })), PCX, PCY, FRONT + 0.008, false);
  const fr = 0.012;
  [[PW + fr * 2, fr, 0, PH / 2 + fr / 2], [PW + fr * 2, fr, 0, -PH / 2 - fr / 2], [fr, PH, -PW / 2 - fr / 2, 0], [fr, PH, PW / 2 + fr / 2, 0]]
    .forEach(([w, h, x, y]) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.014), MAT.steel), PCX + x, PCY + y, FRONT + 0.007));

  // ---------- control plate ----------
  const PLX = 0.25, PF = 0.39;
  add(new THREE.Mesh(new RoundedBoxGeometry(0.2, 1.0, 0.014, 2, 0.006), MAT.steel), PLX, 1.24, FRONT + 0.007);
  add(label('JC-1830 · 230 V', 0.12, 0.018, '#3d4446', 0.7), PLX - 0.022, 1.715, PF + 0.0005, false);

  // Status lamp: blinks red while out of stock
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a1512, emissive: 0xff3b24, emissiveIntensity: 0, roughness: 0.2 });
  const lamp = add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampMat), PLX + 0.068, 1.715, PF, false);
  lamp.rotation.x = Math.PI / 2;
  add(new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0022, 8, 32), MAT.darkSteel), PLX + 0.068, 1.715, PF, false);

  // LCD
  add(new THREE.Mesh(new RoundedBoxGeometry(0.182, 0.078, 0.01, 2, 0.004), MAT.black), PLX, 1.63, PF + 0.005);
  const lcdTex = canvasTex(512, 188, () => {});
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.164, 0.06), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false })), PLX, 1.63, PF + 0.0105, false);
  let lcdKey = '';
  function lcd(l1, l2, red = false) {
    const key = `${l1}|${l2}|${red}`;
    if (key === lcdKey) return;
    lcdKey = key;
    const g = lcdTex.userData.g, w = 512, h = 188;
    g.fillStyle = red ? '#160403' : '#140a02'; g.fillRect(0, 0, w, h);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.shadowColor = red ? 'rgba(255,60,40,0.85)' : 'rgba(255,150,30,0.85)'; g.shadowBlur = 14;
    g.fillStyle = red ? '#ff5a3c' : '#ffb44a';
    fitFont(g, l1, `%spx ${LCD_FONT}`, 76, w - 44); g.fillText(l1, 22, 82);
    fitFont(g, l2, `%spx ${LCD_FONT}`, 76, w - 44); g.fillText(l2, 22, 160);
    g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1.5);
    lcdTex.needsUpdate = true;
  }

  // Drink buttons (backlit faces)
  const BREW_BUTTON = 1; // the Lungo button lights up during a brew
  const buttonMats = DRINKS.map(([name, ml], i) => {
    const tex = canvasTex(512, 148, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#262d2d'); bg.addColorStop(1, '#121616');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e0ab48'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = `800 84px ${DISPLAY}`;
      g.fillText(String(i + 1), 52, h / 2 + 4);
      g.fillStyle = 'rgba(224,171,72,0.4)'; g.fillRect(96, 26, 3, h - 52);
      g.textAlign = 'left'; g.fillStyle = '#efe7da';
      fitFont(g, name.toUpperCase(), `600 %spx ${BODY}`, 44, w - 140);
      g.fillText(name.toUpperCase(), 118, h / 2 - 14);
      g.fillStyle = '#9fb1aa'; g.font = `400 30px ${BODY}`;
      g.fillText(`${ml} ml`, 118, h / 2 + 30);
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.35 });
    const y = 1.525 - i * 0.065;
    add(new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.055, 0.014, 2, 0.005), MAT.black), PLX, y, PF + 0.007);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.172, 0.049), mat), PLX, y, PF + 0.0142, false);
    return mat;
  });

  // "Free" plaque where a coin slot would be
  add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.008, 2, 0.006), MAT.black), PLX, 0.95, PF + 0.004);
  add(label('FREE', 0.14, 0.05, '#f2c86e', 0.85), PLX, 0.962, PF + 0.0085, false);
  add(label('OF CHARGE', 0.14, 0.022, '#f2c86e', 0.8), PLX, 0.922, PF + 0.0085, false);

  // ---------- cup, stream, steam ----------
  const cupTex = canvasTex(1024, 256, (g, w) => {
    g.fillStyle = '#f5f2ea'; g.fillRect(0, 0, w, 256);
    g.fillStyle = '#1d5a4f'; g.fillRect(0, 70, w, 120);
    g.fillStyle = '#d9a441'; g.fillRect(0, 62, w, 6); g.fillRect(0, 192, w, 6);
    g.fillStyle = '#f2c86e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 78px ${DISPLAY}`;
    g.fillText('JAVA COFFEE', w * 0.25, 132); g.fillText('JAVA COFFEE', w * 0.75, 132);
  });
  const cupProfile = [[0.001, 0], [0.026, 0], [0.038, 0.11], [0.0393, 0.1112], [0.0386, 0.1126], [0.0368, 0.11], [0.0247, 0.005], [0.001, 0.005]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cupMats = {
    paper: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.75, side: THREE.DoubleSide, transparent: true }),
    sleeve: new THREE.MeshStandardMaterial({ map: cupTex, roughness: 0.6, transparent: true }),
    coffee: new THREE.MeshStandardMaterial({ color: 0x2e170a, roughness: 0.22, transparent: true }),
  };
  const cup = new THREE.Group();
  const cupBody = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 48), cupMats.paper);
  cupBody.castShadow = true;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0374, 0.0275, 0.09, 48, 1, true), cupMats.sleeve);
  sleeve.position.y = 0.057;
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), cupMats.coffee);
  cup.add(cupBody, sleeve, liquid);
  cup.visible = false;
  shake.add(cup);
  const innerR = (h) => 0.0247 + (0.0368 - 0.0247) * (h - 0.005) / 0.105;

  const streamMat = new THREE.MeshStandardMaterial({ color: 0x2e170a, roughness: 0.15 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), streamMat);
  stream.visible = false;
  shake.add(stream);

  const steamTex = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,0.55)'); r.addColorStop(0.5, 'rgba(255,255,255,0.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const steam = Array.from({ length: reducedMotion ? 8 : 24 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false;
    shake.add(s);
    return { s, life: 0, max: 1, vx: 0, vz: 0 };
  });

  // ---------- state + animation ----------
  // One brew cycle, in seconds: grind → cup drops → pour → settle → ready → cup clears.
  const T = { grind: 1.4, drop: 0.7, pour: 3.4, settle: 0.6, ready: 3, clear: 0.8 };
  const FILL = 0.62; // share of the cup's height the coffee reaches
  let outOfStock = false;
  let cycle = null;    // { t, resolve }
  let denied = 0;      // seconds left of the "can't activate" blink
  let time = 0, steamAcc = 0;

  function setOutOfStock(v) {
    outOfStock = !!v;
    oos.visible = outOfStock;
    posterMat.emissiveIntensity = outOfStock ? 0.35 : 0.85;
  }

  function activate() {
    if (cycle) return Promise.resolve(false);
    if (outOfStock) { denied = 1.2; return Promise.resolve(false); }
    return new Promise((resolve) => {
      cycle = { t: 0, resolve };
      cup.visible = false;
      liquid.visible = false;
      Object.values(cupMats).forEach((m) => { m.opacity = 1; });
    });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    shake.position.set(0, 0, 0);
    denied = Math.max(0, denied - dt);

    let lines = outOfStock ? ['OUT OF STOCK', 'SORRY'] : ['READY', 'SELECT DRINK'];
    let brewing = false;
    let emitSteam = false;

    if (cycle) {
      const c = cycle;
      c.t += dt;
      const t1 = T.grind, t2 = t1 + T.drop, t3 = t2 + T.pour, t4 = t3 + T.settle, t5 = t4 + T.ready, t6 = t5 + T.clear;
      brewing = c.t < t4;
      stream.visible = false;
      if (c.t < t1) {
        lines = ['LUNGO', 'GRINDING 9 G'];
        if (!reducedMotion) shake.position.x = Math.sin(time * 95) * 0.0006;
      } else if (c.t < t2) {
        lines = ['LUNGO', 'PLACING CUP'];
        const k = (c.t - t1) / T.drop;
        const top = bayTopY + 0.02;
        const e = k < 0.72 ? (k / 0.72) ** 2 : 1 - Math.sin(((k - 0.72) / 0.28) * Math.PI) * 0.06;
        cup.visible = true;
        cup.position.set(CUP_POS.x, top + (CUP_POS.y - top) * e, CUP_POS.z);
        cup.rotation.z = Math.sin(k * 9) * 0.04 * (1 - k);
      } else if (c.t < t3) {
        const p = (c.t - t2) / T.pour;
        lines = ['LUNGO', `POURING ${Math.floor(p * 100)}%`];
        cup.position.copy(CUP_POS); cup.rotation.z = 0;
        const h = 0.005 + FILL * 0.105 * p;
        const r = innerR(h);
        liquid.visible = true;
        liquid.position.y = h;
        liquid.scale.set(r, 1, r);
        const surfaceY = CUP_POS.y + h, len = NOZZLE_Y - surfaceY;
        const wob = reducedMotion ? 0 : Math.sin(time * 40) * 0.0004;
        stream.visible = true;
        stream.scale.set(0.0021 + wob, len, 0.0021 + wob);
        stream.position.set(CUP_POS.x, surfaceY + len / 2, CUP_POS.z);
        emitSteam = p > 0.5;
      } else if (c.t < t5) {
        lines = c.t < t4 ? ['LUNGO', 'ALMOST READY'] : ['ENJOY!', '110 ML · 90 °C'];
        cupMats.coffee.color.lerp(new THREE.Color(0x8a5a30), Math.min(1, dt * 1.5)); // crema settles on top
        emitSteam = true;
        if (c.t >= t4 && c.resolve) { c.resolve(true); c.resolve = null; }
      } else if (c.t < t6) {
        const o = 1 - (c.t - t5) / T.clear;
        Object.values(cupMats).forEach((m) => { m.opacity = o; });
      } else {
        cup.visible = false;
        cupMats.coffee.color.setHex(0x2e170a);
        cycle = null;
      }
    }
    if (denied > 0) lines = ['OUT OF STOCK', 'TRY LATER'];

    // Backlights, lamp, LCD
    const pulse = 0.8 + Math.sin(time * 6) * 0.35;
    buttonMats.forEach((m, i) => {
      m.emissiveIntensity = outOfStock ? 0.05 : brewing ? (i === BREW_BUTTON ? pulse : 0.08) : 0.5;
    });
    const blinkRate = denied > 0 ? 14 : 5;
    lampMat.emissiveIntensity = outOfStock && Math.sin(time * blinkRate) > 0 ? 3 : 0;
    ledMat.color.setHex(cycle ? 0xfff1dc : 0xb8ad9c);
    bayLight.intensity = cycle ? 1.6 : 0.6;
    lcd(lines[0], lines[1], outOfStock || denied > 0);

    // Steam
    if (emitSteam) {
      steamAcc += dt * (reducedMotion ? 5 : 14);
      while (steamAcc >= 1) {
        steamAcc -= 1;
        const p = steam.find((q) => q.life <= 0);
        if (!p) break;
        p.life = p.max = 1.6 + Math.random() * 1.2;
        p.s.position.set(cup.position.x + (Math.random() - 0.5) * 0.03, cup.position.y + 0.1, cup.position.z + (Math.random() - 0.5) * 0.03);
        p.vx = (Math.random() - 0.5) * 0.02; p.vz = 0.01 + Math.random() * 0.02;
        p.s.visible = true;
      }
    }
    for (const p of steam) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = 1 - p.life / p.max;
      p.s.position.x += p.vx * dt;
      p.s.position.y += (0.07 + k * 0.05) * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(0.025 + k * 0.07);
      p.s.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.32;
      if (p.life <= 0) p.s.visible = false;
    }
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  lcd('READY', 'SELECT DRINK');
  return {
    object: root,
    activate,
    setOutOfStock,
    get outOfStock() { return outOfStock; },
    get busy() { return !!cycle; },
    update,
    dispose,
  };
}
