import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Recycling station for a three.js scene: three bins in the Belgian sorting colours,
 * PMD (blue), paper and cardboard (yellow) and rest (grey), each with a push flap in the lid.
 *
 * Built in metres: each bin is 0,42 × 0,42 m and 0,92 m tall; the station is 1,38 m wide.
 * The origin sits on the floor at the centre of the station and the bins face +Z.
 *
 *   const bins = createRecyclingStation();
 *   scene.add(bins.object);
 *   bins.activate('pmd');           // 'pmd' | 'paper' | 'rest': something drops in through the flap
 *   bins.setFull('paper', true);    // rubbish sticks out of the lid and a red FULL sticker appears
 *   bins.update(delta);             // call every frame with the elapsed seconds
 *
 * activate() on a full bin makes the flap jiggle and resolves false.
 */
export const BIN_TYPES = ['pmd', 'paper', 'rest'];

export function createRecyclingStation({ reducedMotion = false } = {}) {
  const root = new THREE.Group();
  root.name = 'RecyclingStation';
  const FONT = '"Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }
  const add = (mesh, x, y, z, parent, cast = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const SPEC = {
    pmd: { color: '#1f6fc5', title: 'PMD', sub: 'Plastic · Metal · Drink cartons' },
    paper: { color: '#f2bd0d', title: 'PAPIER', sub: 'Paper · Cardboard', dark: true },
    rest: { color: '#5b5f64', title: 'REST', sub: 'Everything else' },
  };
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2e32, roughness: 0.55, metalness: 0.2 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const W = 0.42, H = 0.85, LID = 0.07, GAP = 0.06;

  // pictograms for the labels
  function icon(g, type, x, y, s, ink) {
    g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = s * 0.08; g.lineJoin = 'round';
    if (type === 'pmd') {
      g.beginPath(); // bottle
      g.moveTo(x - s * 0.55, y + s * 0.6); g.lineTo(x - s * 0.55, y - s * 0.1); g.lineTo(x - s * 0.4, y - s * 0.35);
      g.lineTo(x - s * 0.4, y - s * 0.6); g.lineTo(x - s * 0.2, y - s * 0.6); g.lineTo(x - s * 0.2, y - s * 0.35);
      g.lineTo(x - s * 0.05, y - s * 0.1); g.lineTo(x - s * 0.05, y + s * 0.6); g.closePath(); g.fill();
      g.fillRect(x + s * 0.15, y - s * 0.15, s * 0.4, s * 0.75); // can
    } else if (type === 'paper') {
      g.save(); g.translate(x, y); g.rotate(-0.12);
      g.strokeRect(-s * 0.4, -s * 0.55, s * 0.8, s * 1.1);
      for (let i = 0; i < 4; i++) g.fillRect(-s * 0.26, -s * 0.33 + i * s * 0.22, s * 0.52, s * 0.06);
      g.restore();
    } else {
      g.beginPath(); // bin with a lid and handle
      g.moveTo(x - s * 0.38, y - s * 0.3); g.lineTo(x + s * 0.38, y - s * 0.3); g.lineTo(x + s * 0.3, y + s * 0.6); g.lineTo(x - s * 0.3, y + s * 0.6); g.closePath(); g.fill();
      g.fillRect(x - s * 0.48, y - s * 0.46, s * 0.96, s * 0.1);
      g.fillRect(x - s * 0.12, y - s * 0.58, s * 0.24, s * 0.1);
      g.fillStyle = SPEC.rest.color;
      for (const dx of [-0.16, 0, 0.16]) g.fillRect(x + dx * s - s * 0.03, y - s * 0.16, s * 0.06, s * 0.62);
    }
  }

  // rubbish that drops in or sticks out, by type
  const itemMats = {
    bottle: new THREE.MeshStandardMaterial({ color: 0x8fd3ff, roughness: 0.1, transparent: true, opacity: 0.7 }),
    can: new THREE.MeshStandardMaterial({ color: 0xd8342a, roughness: 0.3, metalness: 0.8 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: 0.9, flatShading: true }),
    box: new THREE.MeshStandardMaterial({ color: 0xb58a57, roughness: 0.85 }),
    bag: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6 }),
  };
  function makeItem(type, variant = 0) {
    let m;
    if (type === 'pmd' && variant % 2 === 0) {
      m = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.03, 0], [0.03, 0.13], [0.012, 0.17], [0.012, 0.19], [0.001, 0.19]].map(([x, y]) => new THREE.Vector2(x, y)), 16), itemMats.bottle);
    } else if (type === 'pmd') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 20), itemMats.can);
    } else if (type === 'paper' && variant % 2 === 0) {
      const g = new THREE.IcosahedronGeometry(0.05, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + Math.random() * 0.4), pos.getY(i) * (0.8 + Math.random() * 0.4), pos.getZ(i) * (0.8 + Math.random() * 0.4));
      g.computeVertexNormals();
      m = new THREE.Mesh(g, itemMats.paper);
    } else if (type === 'paper') {
      m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.1), itemMats.box);
    } else {
      m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12).scale(1, 0.8, 0.9), itemMats.bag);
    }
    m.castShadow = true;
    return m;
  }

  const bins = {};
  BIN_TYPES.forEach((type, i) => {
    const spec = SPEC[type];
    const bin = new THREE.Group();
    bin.position.x = (i - 1) * (W + GAP);
    root.add(bin);
    const lidMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.4 });
    add(new THREE.Mesh(new RoundedBoxGeometry(W, H, W, 3, 0.03), bodyMat), 0, H / 2, 0, bin);
    add(new THREE.Mesh(new RoundedBoxGeometry(W + 0.02, LID, W + 0.02, 3, 0.02), lidMat), 0, H + LID / 2, 0, bin);
    add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, 0.05, W + 0.004), lidMat), 0, 0.1, 0, bin, false); // colour band at the foot
    const hole = add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14).rotateX(-Math.PI / 2), holeMat), 0, H + LID + 0.001, 0.05, bin, false);
    hole.castShadow = false;
    // push flap hinged at the back edge of the opening
    const flap = new THREE.Group();
    flap.position.set(0, H + LID + 0.006, 0.05 - 0.07);
    bin.add(flap);
    add(new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.01, 0.15, 2, 0.004), lidMat), 0, 0, 0.075, flap);

    // label: pictogram, title, subtitle, and a FULL sticker that shows when full
    const labelTex = (full) => canvasTex(512, 640, (g, w, h) => {
      g.fillStyle = spec.color; g.beginPath(); g.roundRect ? g.roundRect(0, 0, w, h, 40) : g.rect(0, 0, w, h); g.fill();
      const ink = spec.dark ? '#1b1c1e' : '#ffffff';
      icon(g, type, w / 2, 230, 220, ink);
      g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 104px ${FONT}`; g.fillText(spec.title, w / 2, 450);
      g.font = `500 34px ${FONT}`; g.fillText(spec.sub, w / 2, 530);
      if (full) {
        g.save(); g.translate(w / 2, 260); g.rotate(-0.25);
        g.fillStyle = '#d62d1f'; g.fillRect(-230, -70, 460, 140);
        g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(-215, -55, 430, 110);
        g.fillStyle = '#ffffff'; g.font = `700 110px ${FONT}`; g.fillText('FULL', 0, 6);
        g.restore();
      }
    });
    const texs = { ok: labelTex(false), full: labelTex(true) };
    const labelMat = new THREE.MeshStandardMaterial({ map: texs.ok, roughness: 0.5 });
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), labelMat), 0, 0.52, W / 2 + 0.001, bin, false);

    // overflow shown when full: pieces poking out of the opening, flap propped open
    const overflow = new THREE.Group();
    overflow.visible = false;
    bin.add(overflow);
    [[-0.05, 0.02, 0.4], [0.05, 0.08, -0.5], [0, 0.04, 1.4], [0.06, 0.11, 2.2]].forEach(([x, z, r], k) => {
      const it = makeItem(type, k);
      it.position.set(x, H + LID + 0.02 + (k % 2) * 0.02, z);
      it.rotation.set(r, r * 1.7, r * 0.6);
      overflow.add(it);
    });

    bins[type] = { bin, flap, labelMat, texs, overflow, full: false, cycle: null };
  });

  // ---------- throwing things away ----------
  function setFull(type, v) {
    const b = bins[type];
    if (!b) throw new Error(`setFull('${type}'): use ${BIN_TYPES.join(', ')}`);
    b.full = !!v;
    b.overflow.visible = b.full;
    b.labelMat.map = b.full ? b.texs.full : b.texs.ok;
    b.labelMat.needsUpdate = true;
  }

  function activate(type = BIN_TYPES[Math.floor(Math.random() * BIN_TYPES.length)]) {
    const b = bins[type];
    if (!b) throw new Error(`activate('${type}'): use ${BIN_TYPES.join(', ')}`);
    if (b.cycle) return Promise.resolve(false);
    return new Promise((resolve) => {
      if (b.full) { b.cycle = { t: 0, jiggle: true, resolve: () => resolve(false) }; return; }
      const item = makeItem(type, Math.floor(Math.random() * 2));
      item.position.set(0, H + 0.45, 0.05);
      b.bin.add(item);
      b.cycle = { t: 0, item, resolve: () => resolve(true) };
    });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    for (const b of Object.values(bins)) {
      const c = b.cycle;
      if (b.full && !c) { b.flap.rotation.x = -0.5; continue; } // propped open by the rubbish
      if (!c) { b.flap.rotation.x = 0; continue; }
      c.t += dt;
      if (c.jiggle) {
        b.flap.rotation.x = -0.5 + (reducedMotion ? 0 : Math.sin(c.t * 40) * 0.08 * (1 - c.t / 0.6));
        if (c.t >= 0.6) { b.cycle = null; c.resolve(); }
        continue;
      }
      // the item falls, pushes the flap down, and disappears into the bin
      const top = H + 0.45, lidY = H + LID;
      const fallT = Math.sqrt((2 * (top - lidY)) / 9.81);
      if (c.t < fallT) {
        c.item.position.y = top - 0.5 * 9.81 * c.t * c.t;
        c.item.rotation.x += dt * 8;
      } else {
        const k = (c.t - fallT) / 0.5;
        c.item.position.y = lidY - k * 0.2;
        c.item.visible = c.item.position.y > lidY - 0.06;
        b.flap.rotation.x = k < 1 ? Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 0.9 * (1 - k) ** 0.5 : 0; // swings inward, then closes
        if (k >= 1) {
          b.flap.rotation.x = 0;
          b.bin.remove(c.item); c.item.geometry.dispose();
          b.cycle = null; c.resolve();
        }
      }
    }
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    Object.values(bins).forEach((b) => { b.texs.ok.dispose(); b.texs.full.dispose(); });
  }

  return {
    object: root,
    activate,
    setFull,
    isFull: (type) => !!bins[type]?.full,
    get busy() { return Object.values(bins).some((b) => b.cycle); },
    update,
    dispose,
  };
}
