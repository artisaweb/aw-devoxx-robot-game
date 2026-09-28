import * as THREE from 'three';
import { createBarStool, createHighTable } from './eventFurniture.js';

/**
 * Beer bar display for a three.js scene, set up on the floor as one piece. On a 4,0 × 3,4 m wooden
 * deck: a bar counter with a printed front, oak top, lit header board and a chrome tap column (lit
 * badge, pull handle, drip tray) with clean glasses; two kegs behind the counter; three bar stools
 * at the counter; two high standing tables in stretch covers with two stools each.
 *
 * Built in metres; the counter top is at 1,05 m and the header reaches 2,35 m. The origin sits on
 * the floor at the centre of the deck and the bar faces +Z.
 *
 *   const stand = createBeerTap();
 *   scene.add(stand.object);
 *   stand.activate();           // pours one glass; resolves true when it's full, false when out of stock or busy
 *   stand.setOutOfStock(true);  // header, badge and a tag on the handle all show OUT OF STOCK
 *   stand.update(delta);        // call every frame with the elapsed seconds
 *
 * Canvas labels use "Alfa Slab One" when the page has loaded it and fall back to system faces
 * otherwise. The scene should have an environment map for the chrome and the glass.
 */
export function createBeerTap({ reducedMotion = false } = {}) {
  const FONT = '"Alfa Slab One", Rockwell, Georgia, serif';
  const root = new THREE.Group();
  root.name = 'BeerStand';
  const COUNTER_H = 1.05;
  const bar = new THREE.Group(); // the tap and its glass, standing on the counter top
  bar.position.y = COUNTER_H;
  root.add(bar);

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
  function add(mesh, x, y, z, parent = bar, cast = true) {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

  // ---------- materials ----------
  const MAT = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xe2e5e7, roughness: 0.24, metalness: 1, envMapIntensity: 1.5 }),
    brushed: new THREE.MeshStandardMaterial({ color: 0xb9bdc0, roughness: 0.4, metalness: 1, envMapIntensity: 1.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x151414, roughness: 0.3, metalness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2c2d, roughness: 0.5, metalness: 0.6 }),
  };

  // ---------- drip tray ----------
  const TRAY_Z = 0.055;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.018, 0.15), MAT.brushed), 0, 0.009, TRAY_Z);
  for (let i = 0; i < 13; i++) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.13), MAT.dark), -0.144 + i * 0.024, 0.02, TRAY_Z, bar, false);
  }

  // ---------- column ----------
  const COL_Z = -0.05;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.012, 40), MAT.chrome), 0, 0.006, COL_Z);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.042, 0.34, 40), MAT.chrome), 0, 0.18, COL_Z);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.041, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), MAT.chrome), 0, 0.35, COL_Z);

  // Lit badge on the column front: normal and out-of-stock faces
  const badgeFace = (oos) => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = oos ? '#8e1d12' : '#1b1410';
    g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = oos ? '#ffd9cf' : '#e8b04a'; g.lineWidth = 18;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 26, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (oos) {
      g.fillStyle = '#fff4ec';
      fitFont(g, 'STOCK', `%spx ${FONT}`, 104, w - 150);
      g.fillText('OUT OF', w / 2, h / 2 - 58);
      g.fillText('STOCK', w / 2, h / 2 + 62);
    } else {
      const glow = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2 - 40);
      glow.addColorStop(0, '#ffcf5a'); glow.addColorStop(1, '#d98a16');
      g.fillStyle = glow;
      g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 44, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a1605';
      fitFont(g, 'PILS', `%spx ${FONT}`, 170, w - 170);
      g.fillText('PILS', w / 2, h / 2 + 8);
      g.font = `40px ${FONT}`;
      g.fillText('5,2 % VOL', w / 2, h / 2 + 118);
    }
  });
  const badgeTex = { ok: badgeFace(false), oos: badgeFace(true) };
  const badgeMat = new THREE.MeshStandardMaterial({ map: badgeTex.ok, emissiveMap: badgeTex.ok, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.4 });
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.01, 40).rotateX(Math.PI / 2), MAT.chrome), 0, 0.235, COL_Z + 0.042);
  const badge = add(new THREE.Mesh(new THREE.CircleGeometry(0.04, 40), badgeMat), 0, 0.235, COL_Z + 0.0475, bar, false);

  // ---------- faucet + handle ----------
  const FAUCET_Y = 0.3;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 24).rotateX(Math.PI / 2), MAT.chrome), 0, FAUCET_Y, COL_Z + 0.075);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 16), MAT.chrome), 0, FAUCET_Y, TRAY_Z);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.034, 20), MAT.chrome), 0, FAUCET_Y - 0.03, TRAY_Z);
  const SPOUT_Y = FAUCET_Y - 0.047;

  const handle = new THREE.Group(); // pivots on top of the faucet; +X rotation pulls it towards the drinker
  handle.position.set(0, FAUCET_Y + 0.018, TRAY_Z);
  bar.add(handle);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 16), MAT.chrome), 0, 0.012, 0, handle);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.012, 0.15, 24), MAT.black), 0, 0.1, 0, handle);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.019, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.black), 0, 0.175, 0, handle);
  const handleLabel = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#e8b04a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1605'; g.fillRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#e8b04a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2);
    fitFont(g, 'PILS', `%spx ${FONT}`, 150, h - 80);
    g.fillText('PILS', 0, 6);
    g.restore();
  });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.07), new THREE.MeshStandardMaterial({ map: handleLabel, roughness: 0.4 })), 0, 0.11, 0.0175, handle, false);

  // Out-of-stock tag, looped over the handle
  const tag = new THREE.Group();
  tag.position.set(0, 0.14, 0.019);
  handle.add(tag);
  const tagTex = canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = '#c8321f';
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 30) : g.rect(0, 0, w, h); g.fill();
    g.strokeStyle = '#fff4ec'; g.lineWidth = 10;
    g.beginPath(); g.roundRect ? g.roundRect(18, 18, w - 36, h - 36, 20) : g.rect(18, 18, w - 36, h - 36); g.stroke();
    g.fillStyle = '#fff4ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'STOCK', `%spx ${FONT}`, 110, w - 110);
    g.fillText('OUT OF', w / 2, h / 2 - 62);
    g.fillText('STOCK', w / 2, h / 2 + 62);
    g.fillStyle = '#5a130b'; g.beginPath(); g.arc(w / 2, 44, 12, 0, Math.PI * 2); g.fill();
  });
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.063), new THREE.MeshBasicMaterial({ map: tagTex, toneMapped: false, side: THREE.DoubleSide })), 0, -0.052, 0.004, tag, false);
  for (const s of [-1, 1]) {
    const cord = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.03, 6), MAT.black), s * 0.006, -0.012, 0.002, tag, false);
    cord.rotation.z = s * 0.35;
  }
  tag.visible = false;

  // ---------- glass, beer, foam, stream ----------
  const GLASS_H = 0.15, R_BOTTOM = 0.029, R_TOP = 0.042, WALL = 0.0025, BASE = 0.01;
  const glassProfile = [
    [0.001, 0], [R_BOTTOM, 0], [R_TOP, GLASS_H], [R_TOP - WALL, GLASS_H],
    [R_BOTTOM - WALL, BASE], [0.001, BASE],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, roughness: 0.04, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false });
  const beerMat = new THREE.MeshStandardMaterial({ color: 0xe0a21c, emissive: 0x6a3a00, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.92 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfbf4e2, roughness: 0.9, transparent: true });
  const glass = new THREE.Group();
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 48), glassMat);
  glassMesh.renderOrder = 2;
  const beer = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40), beerMat);
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40), foamMat);
  beer.visible = foam.visible = false;
  glass.add(glassMesh, beer, foam);
  glass.visible = false;
  bar.add(glass);
  const innerR = (y) => (R_BOTTOM - WALL) + ((R_TOP - WALL) - (R_BOTTOM - WALL)) * (y - BASE) / (GLASS_H - BASE);

  // Beer and foam are rebuilt as frustums that follow the glass taper at the current level
  function setFrustum(mesh, y0, y1) {
    if (y1 - y0 < 0.0005) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.CylinderGeometry(innerR(y1) - 0.0004, innerR(y0) - 0.0004, y1 - y0, 40);
    mesh.position.y = (y0 + y1) / 2;
  }

  const bubbleCount = reducedMotion ? 0 : 36;
  const bubbleGeo = new THREE.BufferGeometry();
  const bubblePos = new Float32Array(bubbleCount * 3);
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
  const bubbles = new THREE.Points(bubbleGeo, new THREE.PointsMaterial({ color: 0xfff3c4, size: 0.0022, transparent: true, opacity: 0.8, depthWrite: false }));
  bubbles.visible = false;
  glass.add(bubbles);
  const seedBubble = (i, top) => {
    const a = Math.random() * Math.PI * 2, y = BASE + Math.random() * Math.max(0.001, top - BASE);
    const r = Math.random() * innerR(y) * 0.8;
    bubblePos[i * 3] = Math.cos(a) * r; bubblePos[i * 3 + 1] = y; bubblePos[i * 3 + 2] = Math.sin(a) * r;
  };

  const streamMat = new THREE.MeshStandardMaterial({ color: 0xe8ae2a, emissive: 0x6a3a00, emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.9 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), streamMat);
  stream.visible = false;
  bar.add(stream);

  // ---------- the stand: counter, front print, oak top, header board, spare glasses ----------
  const W = 1.6, D = 0.6, TOP_T = 0.04;
  const standBlack = new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.6, metalness: 0.2 });
  add(new THREE.Mesh(new THREE.BoxGeometry(W, COUNTER_H - TOP_T - 0.08, D), standBlack), 0, 0.08 + (COUNTER_H - TOP_T - 0.08) / 2, 0, root);
  add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.08, D - 0.08), MAT.black), 0, 0.04, 0, root); // recessed plinth
  const oakTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '70,40,15' : '190,140,90'},${0.12 + Math.random() * 0.15})`;
      g.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * h;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6);
      g.stroke();
    }
  });
  add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, TOP_T, D + 0.1), new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.45 })), 0, COUNTER_H - TOP_T / 2, 0.02, root);

  const frontTex = canvasTex(1600, 900, (g, w, h) => {
    g.fillStyle = '#151414'; g.fillRect(0, 0, w, h);
    const band = g.createLinearGradient(0, 0, 0, h);
    band.addColorStop(0, '#f2b632'); band.addColorStop(1, '#c9831a');
    g.fillStyle = band; g.fillRect(0, h * 0.2, w, h * 0.5);
    g.fillStyle = '#151414'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitFont(g, 'PILS ON TAP', `%spx ${FONT}`, 250, w - 200);
    g.fillText('PILS ON TAP', w / 2, h * 0.45);
    g.fillStyle = '#f2b632'; g.font = `64px ${FONT}`;
    g.fillText('BIER  ·  BIÈRE  ·  BEER', w / 2, h * 0.84);
  });
  add(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, COUNTER_H - TOP_T - 0.12), new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.7 })),
    0, 0.1 + (COUNTER_H - TOP_T - 0.12) / 2, D / 2 + 0.001, root, false);

  // Header board on two uprights at the back of the counter
  const POST_Z = -D / 2 + 0.04, HEADER_Y = 2.17;
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 0.04), standBlack), s * (W / 2 - 0.04), COUNTER_H + 0.65, POST_Z, root);
  add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.36, 0.05), standBlack), 0, HEADER_Y, POST_Z, root);
  const headerFace = (oos) => canvasTex(1600, 360, (g, w, h) => {
    g.fillStyle = oos ? '#c8321f' : '#151414'; g.fillRect(0, 0, w, h);
    g.strokeStyle = oos ? '#fff4ec' : '#f2b632'; g.lineWidth = 10; g.strokeRect(20, 20, w - 40, h - 40);
    g.fillStyle = oos ? '#fff4ec' : '#f2b632'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const text = oos ? 'OUT OF STOCK' : 'BEER';
    fitFont(g, text, `%spx ${FONT}`, 220, w - 160);
    g.fillText(text, w / 2, h / 2 + 10);
  });
  const headerTex = { ok: headerFace(false), oos: headerFace(true) };
  const headerMat = new THREE.MeshStandardMaterial({ map: headerTex.ok, emissiveMap: headerTex.ok, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.5 });
  add(new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.34), headerMat), 0, HEADER_Y, POST_Z + 0.026, root, false);

  // Clean glasses upside down on a drip mat, next to the tap
  const matMesh = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.008, 0.2), MAT.black), 0.5, COUNTER_H + 0.004, 0.05, root);
  matMesh.castShadow = false;
  const spareGlassGeo = new THREE.LatheGeometry(glassProfile, 40);
  const spareGlassMat = glassMat.clone(); // own material: the poured glass fades out, these stay
  [[0.41, 0.0], [0.5, 0.0], [0.59, 0.0], [0.455, 0.09], [0.545, 0.09]].forEach(([x, z]) => {
    const g = new THREE.Mesh(spareGlassGeo, spareGlassMat);
    g.position.set(x, COUNTER_H + 0.008 + GLASS_H, 0.01 + z);
    g.rotation.x = Math.PI; // upside down
    g.renderOrder = 2;
    root.add(g);
  });

  // ---------- state + animation ----------
  const GLASS_REST = new THREE.Vector3(0, 0.022, TRAY_Z);
  const GLASS_AWAY = new THREE.Vector3(0, 0.022, TRAY_Z + 0.28);
  const PULL = 0.62;
  const BEER_TOP = 0.128, FOAM_TOP = 0.147; // full glass: beer up to 12,8 cm, head up to 14,7 cm
  let outOfStock = false;
  let cycle = null;
  let denied = 0, time = 0, tagSwing = 0;
  let level = { beer: BASE, foam: BASE };

  function setOutOfStock(v) {
    outOfStock = !!v;
    tag.visible = outOfStock;
    tagSwing = outOfStock ? 0.3 : 0;
    const t = outOfStock ? badgeTex.oos : badgeTex.ok;
    badgeMat.map = t; badgeMat.emissiveMap = t;
    badgeMat.needsUpdate = true;
    const ht = outOfStock ? headerTex.oos : headerTex.ok;
    headerMat.map = ht; headerMat.emissiveMap = ht;
    headerMat.needsUpdate = true;
  }

  function activate() {
    if (cycle) return Promise.resolve(false);
    if (outOfStock) { denied = 0.9; tagSwing = 0.45; return Promise.resolve(false); }
    return new Promise((resolve) => {
      level = { beer: BASE, foam: BASE };
      beer.visible = foam.visible = false;
      [glassMat, beerMat, foamMat].forEach((m, i) => { m.opacity = [0.2, 0.92, 1][i]; });
      const slide = (a, b) => (k) => { glass.position.lerpVectors(a, b, easeInOut(k)); };
      const setLevel = (beerY, foamY) => {
        level = { beer: beerY, foam: foamY };
        setFrustum(beer, BASE, beerY);
        setFrustum(foam, beerY, foamY);
      };
      const steps = [
        { dur: 0.6, start: () => { glass.visible = true; }, run: slide(GLASS_AWAY, GLASS_REST) },
        { dur: 0.35, run: (k) => { handle.rotation.x = PULL * easeInOut(k); } },
        { dur: 3.6, pour: true, run: (k) => {
          // the head builds first, then beer rises underneath it
          const b = lerp(BASE, BEER_TOP, easeInOut(k));
          const head = lerp(0.004, FOAM_TOP - BEER_TOP, Math.min(1, k * 1.6));
          setLevel(b, Math.min(GLASS_H - 0.001, b + head));
        } },
        { dur: 0.35, run: (k) => { handle.rotation.x = PULL * (1 - easeInOut(k)); }, end: () => { resolve(true); } },
        { dur: 1.8, run: (k) => { setLevel(BEER_TOP, lerp(FOAM_TOP, FOAM_TOP - 0.003, k)); } }, // head settles
        { dur: 0.7, run: slide(GLASS_REST, GLASS_AWAY) },
        { dur: 0.5, run: (k) => { [glassMat, beerMat, foamMat].forEach((m, i) => { m.opacity = [0.2, 0.92, 1][i] * (1 - k); }); },
          end: () => { glass.visible = false; } },
      ];
      cycle = { steps, i: 0, t: 0, started: false };
    });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    denied = Math.max(0, denied - dt);
    stream.visible = false;

    if (cycle) {
      const s = cycle.steps[cycle.i];
      if (!cycle.started) { cycle.started = true; if (s.start) s.start(); }
      cycle.t += dt;
      const k = Math.min(1, cycle.t / s.dur);
      s.run(k);
      if (s.pour && k < 0.97) {
        const surface = GLASS_REST.y + level.foam;
        const len = SPOUT_Y - surface;
        const wob = reducedMotion ? 0 : Math.sin(time * 40) * 0.0003;
        stream.visible = len > 0;
        stream.scale.set(0.0032 + wob, len, 0.0032 + wob);
        stream.position.set(0, surface + len / 2, TRAY_Z);
      }
      if (k >= 1) {
        if (s.end) s.end();
        cycle.i += 1; cycle.t = 0; cycle.started = false;
        if (cycle.i >= cycle.steps.length) cycle = null;
      }
    }

    // Bubbles rise through the beer
    bubbles.visible = bubbleCount > 0 && glass.visible && level.beer > BASE + 0.01;
    if (bubbles.visible) {
      for (let i = 0; i < bubbleCount; i++) {
        bubblePos[i * 3 + 1] += dt * (0.02 + (i % 5) * 0.006);
        if (bubblePos[i * 3 + 1] > level.beer - 0.002 || bubblePos[i * 3 + 1] < BASE) seedBubble(i, level.beer * 0.4);
      }
      bubbleGeo.attributes.position.needsUpdate = true;
    }

    // Denied pull: the handle jiggles, nothing flows
    if (!cycle) handle.rotation.x = denied > 0 && !reducedMotion ? Math.abs(Math.sin(denied * 18)) * 0.18 * denied : 0;
    badgeMat.emissiveIntensity = outOfStock ? (denied > 0 && Math.sin(time * 16) > 0 ? 1.4 : 0.8) : 0.9;
    tagSwing *= Math.exp(-dt * 1.4);
    tag.rotation.set(reducedMotion ? 0 : Math.sin(time * 4.5) * tagSwing * 0.6, 0, reducedMotion ? 0 : Math.sin(time * 3.7) * tagSwing);
  }

  // ---------- the display around the stand: deck, kegs, stools, high tables ----------
  const display = new THREE.Group();
  display.name = 'BeerBarDisplay';
  const DECK_T = 0.025, DECK_W = 4.0, DECK_D = 3.4, STAND_Z = -1.0;
  const plankTex = canvasTex(1024, 1024, (g, w, h) => {
    const n = 12;
    for (let i = 0; i < n; i++) {
      g.fillStyle = ['#7a5234', '#86603d', '#6f4a2e'][i % 3];
      g.fillRect(0, (i * h) / n, w, h / n);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, ((i + 1) * h) / n - 3, w, 3);
      const cut = ((i * 379) % 10) / 10 * w;
      g.fillRect(cut, (i * h) / n, 3, h / n);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(${Math.random() < 0.5 ? '50,30,15' : '170,120,80'},0.18)`;
        const y = (i * h) / n + Math.random() * (h / n);
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 4); g.stroke();
      }
    }
  });
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping;
  plankTex.repeat.set(DECK_W / 1.8, DECK_D / 1.8); // 15 cm planks
  add(new THREE.Mesh(new THREE.BoxGeometry(DECK_W, DECK_T, DECK_D), new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.7 })), 0, DECK_T / 2, 0, display, false);
  for (const [w, d, x, z] of [[DECK_W + 0.02, 0.02, 0, DECK_D / 2], [DECK_W + 0.02, 0.02, 0, -DECK_D / 2], [0.02, DECK_D, DECK_W / 2, 0], [0.02, DECK_D, -DECK_W / 2, 0]]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(w, DECK_T + 0.004, d), standBlack), x, (DECK_T + 0.004) / 2, z, display, false); // edge trim
  }
  display.add(root);
  root.position.set(0, DECK_T, STAND_Z);

  // Two 50 L kegs on the bartender's side, one with a coupler line up to the counter
  const kegMat = new THREE.MeshStandardMaterial({ color: 0xc3c7ca, roughness: 0.3, metalness: 1 });
  for (const x of [-0.35, 0.1]) {
    const keg = new THREE.Group();
    keg.position.set(x, DECK_T, STAND_Z - 0.55);
    display.add(keg);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 40), kegMat), 0, 0.3, 0, keg);
    for (const y of [0.04, 0.2, 0.4, 0.56]) add(new THREE.Mesh(new THREE.TorusGeometry(0.202, 0.008, 8, 48).rotateX(Math.PI / 2), kegMat), 0, y, 0, keg, false);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16), MAT.black), 0, 0.62, 0, keg, false);
  }
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, DECK_T + 0.64, STAND_Z - 0.55), new THREE.Vector3(0.1, DECK_T + 0.8, STAND_Z - 0.4), new THREE.Vector3(0.05, DECK_T + 0.9, STAND_Z - 0.3),
  ]), 12, 0.006, 8), new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.4 }));
  display.add(line);

  // Seating: three stools at the counter, two high tables with two stools each
  const extras = [];
  const place = (piece, x, z, ry = 0) => {
    piece.object.position.set(x, DECK_T, z);
    piece.object.rotation.y = ry;
    display.add(piece.object);
    extras.push(piece);
  };
  for (const x of [-0.55, 0, 0.55]) place(createBarStool(), x, STAND_Z + 0.62);
  for (const [tx, tz, a] of [[-1.25, 0.65, 0.3], [1.2, 0.85, -0.4]]) {
    place(createHighTable(), tx, tz);
    for (const da of [0, Math.PI * 0.95]) {
      const ang = a + da + Math.PI / 2;
      place(createBarStool(), tx + Math.cos(ang) * 0.52, tz + Math.sin(ang) * 0.52);
    }
  }

  function dispose() {
    extras.forEach((e) => e.dispose());
    display.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    badgeTex.ok.dispose(); badgeTex.oos.dispose(); headerTex.ok.dispose(); headerTex.oos.dispose();
  }

  for (let i = 0; i < bubbleCount; i++) seedBubble(i, BASE + 0.001);
  update(0);
  return {
    object: display,
    activate,
    setOutOfStock,
    get outOfStock() { return outOfStock; },
    get busy() { return !!cycle; },
    update,
    dispose,
  };
}
