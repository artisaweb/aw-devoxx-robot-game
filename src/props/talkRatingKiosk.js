import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Talk rating kiosk for a three.js scene: the post at a room exit with three big buttons
 * (green happy, yellow neutral, red sad) under a small "RATE THIS TALK" screen.
 *
 * Built in metres: 1,18 m tall, the button panel 0,52 m wide. The origin sits on the floor under
 * the post and the buttons face +Z.
 *
 *   const kiosk = createTalkRatingKiosk();
 *   scene.add(kiosk.object);
 *   kiosk.activate('good');   // 'good' | 'ok' | 'bad' (default 'good'); resolves after the thank-you
 *   kiosk.votes;              // { good, ok, bad } counted so far
 *   kiosk.update(delta);      // call every frame with the elapsed seconds
 */
export function createTalkRatingKiosk({ reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = 'TalkRatingKiosk';
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

  const body = new THREE.MeshStandardMaterial({ color: 0x232529, roughness: 0.4, metalness: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf39a1e, roughness: 0.4 });
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 48), body), 0, 0.015, 0);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.9, 0.08, 3, 0.02), body), 0, 0.47, 0);

  // Tilted head holding the screen and the buttons
  const head = new THREE.Group();
  head.position.set(0, 0.98, 0.03);
  head.rotation.x = -0.45; // leans back so the buttons face up towards the voter
  root.add(head);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.34, 0.09, 4, 0.03), body), 0, 0, 0, head);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.002), trim), 0, 0.02, 0.046, head, false);

  // screen
  const scrTex = canvasTex(1024, 256, () => {});
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.1), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })), 0, 0.095, 0.0465, head, false);
  let scrKey = '';
  function screen(line, color, face) {
    const key = line + color + face;
    if (key === scrKey) return;
    scrKey = key;
    const g = scrTex.userData.g, w = 1024, h = 256;
    g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 112px ${FONT}`;
    g.fillText(line, face ? w / 2 + 70 : w / 2, h / 2 + 6);
    if (face) drawFace(g, w / 2 - g.measureText(line).width / 2 - 40, h / 2, 70, face, color);
    scrTex.needsUpdate = true;
  }

  // buttons with a face printed on each dome
  const KINDS = {
    good: { color: '#2fbf5b', mood: 1 },
    ok: { color: '#f5c21b', mood: 0 },
    bad: { color: '#e5412f', mood: -1 },
  };
  function drawFace(g, x, y, r, kind, color) {
    const k = KINDS[kind];
    g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#16181b';
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.25, r * 0.12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + r * 0.35, y - r * 0.25, r * 0.12, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#16181b'; g.lineWidth = r * 0.12; g.lineCap = 'round';
    g.beginPath();
    if (k.mood === 0) { g.moveTo(x - r * 0.4, y + r * 0.35); g.lineTo(x + r * 0.4, y + r * 0.35); }
    else g.arc(x, y + (k.mood > 0 ? r * 0.05 : r * 0.7), r * 0.42, k.mood > 0 ? 0.15 * Math.PI : 1.15 * Math.PI, k.mood > 0 ? 0.85 * Math.PI : 1.85 * Math.PI);
    g.stroke();
  }
  const buttons = {};
  Object.entries(KINDS).forEach(([kind, k], i) => {
    const faceTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = k.color; g.fillRect(0, 0, w, h); drawFace(g, w / 2, h / 2, w * 0.42, kind, k.color); });
    faceTex.center.set(0.5, 0.5);
    faceTex.rotation = Math.PI / 2; // a cylinder cap maps its texture sideways; turn the face upright
    const side = new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.3, emissive: new THREE.Color(k.color), emissiveIntensity: 0.1 });
    const top = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.25, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.1 });
    const x = (i - 1) * 0.155;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.012, 40).rotateX(Math.PI / 2), body), x, -0.045, 0.048, head, false);
    const btn = add(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.022, 40).rotateX(Math.PI / 2), [side, top, side]), x, -0.045, 0.062, head);
    buttons[kind] = { btn, mats: [side, top], press: 0 };
  });

  // ---------- voting ----------
  const votes = { good: 0, ok: 0, bad: 0 };
  let cycle = null, time = 0;
  const T_THANKS = 1.8;

  function activate(kind = 'good') {
    if (!KINDS[kind]) throw new Error(`activate('${kind}'): use 'good', 'ok' or 'bad'`);
    if (cycle) return Promise.resolve(false);
    votes[kind] += 1;
    buttons[kind].press = 1;
    return new Promise((resolve) => { cycle = { t: 0, kind, resolve }; });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    for (const [kind, b] of Object.entries(buttons)) {
      b.press = Math.max(0, b.press - dt * 3);
      b.btn.position.z = 0.062 - Math.sin(Math.min(1, b.press * 1.5) * Math.PI / 2) * 0.008;
      const lit = cycle && cycle.kind === kind ? 1.2 : 0.1 + (reducedMotion ? 0 : Math.sin(time * 2 + kind.length) * 0.05);
      b.mats.forEach((m) => { m.emissiveIntensity = lit; });
    }
    if (cycle) {
      cycle.t += dt;
      screen('THANK YOU!', KINDS[cycle.kind].color, cycle.kind);
      if (cycle.t >= T_THANKS) { cycle.resolve(true); cycle = null; }
    } else screen('RATE THIS TALK', '#f39a1e', null);
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }

  update(0);
  return { object: root, activate, get votes() { return { ...votes }; }, get busy() { return !!cycle; }, update, dispose };
}
