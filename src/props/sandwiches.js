import * as THREE from 'three';

/**
 * Popular sandwiches for a three.js scene.
 *
 *   crab           half baguette, crab salad with surimi sticks on lettuce
 *   club           two toasted triangles: chicken, bacon, egg, tomato, lettuce
 *   cheese         half baguette, young Gouda slices on lettuce
 *   ham-cheese     half baguette, ham, cheese, tomato, egg, cucumber (Belgian "smos")
 *   tuna           half baguette, tuna salad with red onion rings
 *   chicken-curry  half baguette, curry chicken salad with pineapple chunks
 *
 * Built in metres (a half baguette is 26 cm long). The origin sits on the surface under the centre
 * of the sandwich and its long side faces +Z. Each sandwich carries a cocktail-stick flag with its name.
 *
 *   const sandwich = createSandwich('crab');
 *   scene.add(sandwich.object);
 *   sandwich.activate();       // a small hop and spin; resolves false while one is still playing
 *   sandwich.update(delta);    // call every frame with the elapsed seconds
 *
 * There is no out-of-stock state: a sandwich is either in the scene or it isn't.
 *
 * The flag uses "Fredoka" when the page has loaded it and falls back to system faces otherwise.
 */
export const SANDWICH_TYPES = [
  { id: 'crab', label: 'Crab' },
  { id: 'club', label: 'Club' },
  { id: 'cheese', label: 'Cheese' },
  { id: 'ham-cheese', label: 'Ham & cheese' },
  { id: 'tuna', label: 'Tuna' },
  { id: 'chicken-curry', label: 'Chicken curry' },
];

export function createSandwich(type = 'crab', { reducedMotion = false } = {}) {
  const info = SANDWICH_TYPES.find((t) => t.id === type);
  if (!info) throw new Error(`Unknown sandwich "${type}". Use one of: ${SANDWICH_TYPES.map((t) => t.id).join(', ')}`);
  const FONT = '"Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';

  const root = new THREE.Group();
  root.name = `Sandwich:${type}`;
  const hop = new THREE.Group(); // moves during activate()
  root.add(hop);
  const food = new THREE.Group(); // bread and fillings
  hop.add(food);

  // Seeded randomness, so each sandwich type looks the same every time
  let seed = [...type].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const range = (a, b) => a + (b - a) * rnd();

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
  const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  function place(mesh, parent, x, y, z) {
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function dots(g, n, color, r0, r1, area) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const [x, y] = area();
      g.beginPath(); g.arc(x, y, range(r0, r1), 0, Math.PI * 2); g.fill();
    }
  }

  // Round slices: tomato, cucumber, egg
  const sliceKinds = {
    tomato: { rim: '#c9291a', draw(g, w) {
      const c = w / 2;
      g.fillStyle = '#c9291a'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ef5543'; g.beginPath(); g.arc(c, c, c * 0.88, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        g.save(); g.translate(c + Math.cos(a) * c * 0.45, c + Math.sin(a) * c * 0.45); g.rotate(a);
        g.fillStyle = '#f7a28c'; g.beginPath(); g.ellipse(0, 0, c * 0.3, c * 0.2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f4d77f';
        for (let s = 0; s < 6; s++) { g.beginPath(); g.ellipse(range(-c * 0.18, c * 0.18), range(-c * 0.1, c * 0.1), 5, 3, rnd() * 3, 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
      g.fillStyle = '#e24736'; g.beginPath(); g.arc(c, c, c * 0.18, 0, Math.PI * 2); g.fill();
    } },
    cucumber: { rim: '#35602a', draw(g, w) {
      const c = w / 2;
      g.fillStyle = '#35602a'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#9cc766'; g.beginPath(); g.arc(c, c, c * 0.92, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e1eebc'; g.beginPath(); g.arc(c, c, c * 0.86, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.fillStyle = '#cadf9c';
        g.beginPath(); g.ellipse(c + Math.cos(a) * c * 0.3, c + Math.sin(a) * c * 0.3, c * 0.28, c * 0.16, a, 0, Math.PI * 2); g.fill();
        dots(g, 5, '#f4f7df', 3, 5, () => [c + Math.cos(a) * c * range(0.15, 0.45), c + Math.sin(a) * c * range(0.15, 0.45)]);
      }
    } },
    egg: { rim: '#fbf8f0', draw(g, w) {
      const c = w / 2;
      g.fillStyle = '#fbf8f0'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f7cf5e'; g.beginPath(); g.arc(c + 6, c - 4, c * 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#efb32f'; g.beginPath(); g.arc(c + 6, c - 4, c * 0.4, 0, Math.PI * 2); g.fill();
    } },
  };
  const sliceMats = {};
  function sliceMaterials(kind) {
    if (!sliceMats[kind]) {
      const k = sliceKinds[kind];
      const face = std(0xffffff, 0.45, { map: canvasTex(256, 256, (g, w) => k.draw(g, w)) });
      sliceMats[kind] = [std(k.rim, 0.5), face, face];
    }
    return sliceMats[kind];
  }
  const slice = (kind, r, h = 0.005) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), sliceMaterials(kind));

  // A lettuce leaf lying flat, wavy towards its edges
  const lettuceMat = std(0xffffff, 0.55, { vertexColors: true, side: THREE.DoubleSide });
  function lettuceLeaf(w, d) {
    const g = new THREE.PlaneGeometry(w, d, 16, 10).rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = [], c = new THREE.Color();
    const ph = [rnd() * 6, rnd() * 6];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const edge = Math.min(1, (Math.abs(z) / (d / 2)) ** 2 + (Math.abs(x) / (w / 2)) ** 4);
      p.setY(i, edge * (0.004 * Math.sin(x * 140 + ph[0]) + 0.003 * Math.sin(z * 210 + ph[1])) - edge * 0.003);
      c.set(edge > 0.6 ? '#6fa832' : '#b9d97a').lerp(new THREE.Color('#8fc043'), rnd() * 0.5);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, lettuceMat);
  }

  // A thin slab (cheese, ham) that droops where it overhangs the bread
  function droopSlab(w, d, h, support, droop, wave = 0) {
    const g = new THREE.BoxGeometry(w, h, d, 10, 1, 10);
    const p = g.attributes.position;
    const ph = rnd() * 6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const over = Math.max(0, Math.abs(z) - support);
      p.setY(i, p.getY(i) - (over * droop) ** 2 * 60 + wave * Math.sin(x * 90 + ph) * (0.4 + over * 30));
    }
    g.computeVertexNormals();
    return g;
  }

  // A lumpy salad spread (crab, tuna, curry) with vertex-coloured variation
  function saladBlob(len, width, height, color) {
    const g = new THREE.SphereGeometry(1, 64, 20);
    const p = g.attributes.position, col = [];
    const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    const base = new THREE.Color(color), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.16 * Math.sin(x * 9 + ph[0]) * Math.cos(z * 7 + ph[1]) + 0.1 * Math.sin((x + z) * 19 + ph[2]);
      const s = 1 + n * (0.4 + 0.6 * Math.max(0, y));
      p.setXYZ(i, x * (len / 2) * s, (y < 0 ? y * 0.15 : y) * height * s, z * (width / 2) * (s + 0.05));
      c.copy(base).offsetHSL(0, 0, n * 0.3 + (rnd() - 0.5) * 0.06);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, std(0xffffff, 0.5, { vertexColors: true }));
  }
  // Scatter small pieces over the top of a salad blob
  function scatterOn(blob, count, geo, mat, minY = 0.35) {
    const p = blob.geometry.attributes.position;
    const top = Math.max(...Array.from({ length: p.count }, (_, i) => p.getY(i)));
    const cand = [];
    for (let i = 0; i < p.count; i++) if (p.getY(i) > top * minY) cand.push(i);
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      const i = cand[Math.floor(rnd() * cand.length)];
      v.set(p.getX(i), p.getY(i) - 0.001, p.getZ(i));
      q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3));
      s.setScalar(range(0.7, 1.3));
      inst.setMatrixAt(k, m.compose(v, q, s));
    }
    inst.castShadow = true;
    blob.add(inst);
    return inst;
  }

  // ---------- half baguette ----------
  const L = 0.26, R = 0.032;
  const prof = (t) => Math.max(0.0006, R * Math.max(0, 1 - Math.abs(t) ** 3) ** (1 / 3));
  function crustTex(top) {
    return canvasTex(512, 1024, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0);
      if (top) { grd.addColorStop(0, '#9c5a22'); grd.addColorStop(0.5, '#d49a4f'); grd.addColorStop(1, '#9c5a22'); }
      else { grd.addColorStop(0, '#b7773a'); grd.addColorStop(0.5, '#a3642c'); grd.addColorStop(1, '#b7773a'); }
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      if (top) {
        for (let i = 0; i < 5; i++) { // the slashes on top
          g.save(); g.translate(w / 2 + range(-12, 12), h * (0.16 + i * 0.17)); g.rotate(0.5);
          g.fillStyle = '#eec98d'; g.beginPath(); g.ellipse(0, 0, 34, 118, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#e1b273'; g.beginPath(); g.ellipse(4, 0, 18, 96, 0, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
      dots(g, 900, 'rgba(255,248,230,0.35)', 0.8, 2.2, () => [rnd() * w, rnd() * h]); // flour
    });
  }
  function crumbFace() {
    const s = new THREE.Shape();
    const N = 40;
    for (let i = 0; i <= N; i++) { const t = -1 + (2 * i) / N; const x = t * L / 2, z = prof(t); i ? s.lineTo(x, z) : s.moveTo(x, z); }
    for (let i = N; i >= 0; i--) { const t = -1 + (2 * i) / N; s.lineTo(t * L / 2, -prof(t)); }
    return s;
  }
  const crumbTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f2dfb6'; g.fillRect(0, 0, w, h);
    dots(g, 160, 'rgba(190,150,90,0.45)', 1, 4, () => [rnd() * w, rnd() * h]);
  });
  crumbTex.wrapS = crumbTex.wrapT = THREE.RepeatWrapping;
  crumbTex.repeat.set(12, 12);
  const crumbMat = std(0xffffff, 0.9, { map: crumbTex });

  function baguette(fill) {
    const N = 40;
    const pts = Array.from({ length: N + 1 }, (_, i) => { const t = -1 + (2 * i) / N; return new THREE.Vector2(prof(t), (t * L) / 2); });
    const BOTTOM_H = 0.55, TOP_H = 0.82;
    const base = R * BOTTOM_H;

    const bottom = new THREE.Group();
    bottom.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 24, 0, Math.PI).rotateZ(-Math.PI / 2).scale(1, BOTTOM_H, 1), std(0xffffff, 0.75, { map: crustTex(false) })));
    bottom.add(new THREE.Mesh(new THREE.ShapeGeometry(crumbFace()).rotateX(-Math.PI / 2), crumbMat));
    bottom.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
    bottom.position.y = base;
    food.add(bottom);

    const layers = new THREE.Group();
    food.add(layers);
    const ctx = { L, R, y: base, group: layers, halfWidth: (x) => prof((2 * x) / L) };
    fill(ctx);

    const top = new THREE.Group();
    top.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 24, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, TOP_H, 1), std(0xffffff, 0.7, { map: crustTex(true) })));
    top.add(new THREE.Mesh(new THREE.ShapeGeometry(crumbFace()).rotateX(Math.PI / 2), crumbMat));
    top.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
    top.position.set(0.004, ctx.y, -0.002);
    top.rotation.z = 0.025;
    food.add(top);
    return { flagAt: new THREE.Vector3(-L * 0.18, ctx.y + R * TOP_H * 0.92, 0) };
  }

  // Filling layers for a baguette; each one raises ctx.y
  const fillings = {
    lettuce(ctx) {
      for (let i = 0; i < 4; i++) {
        const leaf = place(lettuceLeaf(ctx.L * 0.3, ctx.R * 2.5), ctx.group, -ctx.L * 0.33 + i * ctx.L * 0.22, ctx.y + 0.002, range(-0.004, 0.004));
        leaf.rotation.y = range(-0.2, 0.2);
      }
      ctx.y += 0.004;
    },
    slices(ctx, kind, n, r) {
      for (let i = 0; i < n; i++) {
        const x = -ctx.L * 0.36 + ((i + 0.5) / n) * ctx.L * 0.72;
        const s = place(slice(kind, r), ctx.group, x, ctx.y + 0.0025, (i % 2 ? 1 : -1) * ctx.halfWidth(x) * 0.55);
        s.rotation.set(range(-0.08, 0.08), rnd() * 3, range(-0.08, 0.08));
      }
      ctx.y += 0.005;
    },
    cheese(ctx, n = 4) {
      const mat = std(0xf2c14a, 0.45);
      for (let i = 0; i < n; i++) {
        const x = -ctx.L * 0.3 + (i / (n - 1)) * ctx.L * 0.6;
        const m = place(new THREE.Mesh(droopSlab(0.085, ctx.R * 2.6, 0.0025, ctx.R * 0.8, 1), mat), ctx.group, x, ctx.y + 0.0015 + (i % 2) * 0.0012, range(-0.004, 0.004));
        m.rotation.y = range(-0.15, 0.15);
      }
      ctx.y += 0.005;
    },
    ham(ctx, n = 4) {
      const hamTex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#e8928c'; g.fillRect(0, 0, w, h);
        dots(g, 60, 'rgba(250,200,195,0.6)', 4, 14, () => [rnd() * w, rnd() * h]);
        g.fillStyle = '#f6d9d0'; g.fillRect(0, 0, w, 14); // fat rim
      });
      const mat = std(0xffffff, 0.5, { map: hamTex });
      for (let i = 0; i < n; i++) {
        const x = -ctx.L * 0.3 + (i / (n - 1)) * ctx.L * 0.6;
        const m = place(new THREE.Mesh(droopSlab(0.08, ctx.R * 2.7, 0.002, ctx.R * 0.75, 1.1, 0.0022), mat), ctx.group, x, ctx.y + 0.003, range(-0.004, 0.004));
        m.rotation.y = range(-0.25, 0.25);
      }
      ctx.y += 0.007;
    },
    salad(ctx, color, height = 0.02) {
      const blob = place(saladBlob(ctx.L * 0.84, ctx.R * 2.05, height, color), ctx.group, 0, ctx.y, 0);
      ctx.y += height * 0.78; // the lid sinks into the salad a little
      return blob;
    },
  };

  // ---------- club: two toasted triangles ----------
  function club() {
    const S = 0.1; // triangle legs, 10 cm
    const triShape = (scale = 1, wav = 0) => {
      const pts = [[0, 0], [S, 0], [0, S]].map(([x, y]) => [(x - S / 3) * scale, (y - S / 3) * scale]);
      const s = new THREE.Shape();
      const steps = wav ? 14 : 1;
      let first = true;
      for (let e = 0; e < 3; e++) {
        const [ax, ay] = pts[e], [bx, by] = pts[(e + 1) % 3];
        const nx = by - ay, ny = -(bx - ax), nl = Math.hypot(nx, ny);
        for (let k = 0; k < steps; k++) {
          const t = k / steps, off = wav ? wav * (0.5 + Math.sin(t * 22 + e * 2 + rnd()) * 0.5) : 0;
          const x = ax + (bx - ax) * t + (nx / nl) * off, y = ay + (by - ay) * t + (ny / nl) * off;
          first ? s.moveTo(x, y) : s.lineTo(x, y);
          first = false;
        }
      }
      return s;
    };
    const slab = (shape, h, bevel = 0) => new THREE.ExtrudeGeometry(shape, {
      depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4,
    }).rotateX(-Math.PI / 2).translate(0, bevel, 0);

    const toastTex = canvasTex(256, 256, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
      grd.addColorStop(0, '#f1d7a2'); grd.addColorStop(0.7, '#d9a45c'); grd.addColorStop(1, '#b97a36');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      dots(g, 220, 'rgba(160,110,55,0.35)', 1, 3.5, () => [rnd() * w, rnd() * h]);
    });
    toastTex.repeat.set(1 / S, 1 / S);
    toastTex.offset.set(0.33, 0.33);
    const toastMats = [std(0xffffff, 0.8, { map: toastTex }), std(0xa8672d, 0.8)];
    const baconTex = canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#a8412c'; g.fillRect(0, 0, w, h);
      for (let y = 6; y < h; y += 16) { g.fillStyle = '#f0c9ae'; g.fillRect(0, y, w, 5); }
    });
    baconTex.wrapS = baconTex.wrapT = THREE.RepeatWrapping;
    baconTex.repeat.set(12, 30);
    const baconMats = [std(0xffffff, 0.5, { map: baconTex }), std(0x9a3a26, 0.5)];
    const chickenMat = std(0xeed8b6, 0.7);
    const greens = std(0x7fb33a, 0.55, { side: THREE.DoubleSide });

    function triangle() {
      const g = new THREE.Group();
      let y = 0;
      const layer = (geo, mat, h) => { place(new THREE.Mesh(geo, mat), g, 0, y, 0); y += h; };
      const toast = () => layer(slab(triShape(), 0.011, 0.0022), toastMats, 0.0154);
      toast();
      layer(slab(triShape(1.07, 0.004), 0.0015), greens, 0.002);
      for (const [x, z] of [[0.012, -0.006], [-0.018, -0.012]]) place(slice('tomato', 0.024), g, x, y + 0.0025, z);
      y += 0.005;
      layer(slab(triShape(0.99, 0.0015), 0.008), chickenMat, 0.008);
      toast();
      layer(slab(triShape(1.05, 0.003), 0.003), baconMats, 0.003);
      for (const [x, z] of [[0.014, -0.01], [-0.016, -0.004]]) place(slice('egg', 0.017), g, x, y + 0.0025, z);
      y += 0.005;
      layer(slab(triShape(1.07, 0.004), 0.0015), greens, 0.002);
      toast();
      return { g, top: y };
    }
    // Cut sides face +Z: rotating by -3π/4 turns the hypotenuse towards the front
    const a = triangle(), b = triangle();
    a.g.position.set(-0.075, 0, 0.005); a.g.rotation.y = -3 * Math.PI / 4 + 0.22;
    b.g.position.set(0.075, 0, -0.005); b.g.rotation.y = -3 * Math.PI / 4 - 0.22;
    food.add(a.g, b.g);
    // plain cocktail stick in the second half; the flag goes in the first
    place(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.1, 8), std(0xd9b98a, 0.7)), b.g, 0, b.top + 0.02, 0);
    return { flagAt: new THREE.Vector3(-0.075, a.top, 0.005) };
  }

  // ---------- build the chosen sandwich ----------
  let built;
  if (type === 'club') built = club();
  else built = baguette((ctx) => {
    fillings.lettuce(ctx);
    if (type === 'crab') {
      const blob = fillings.salad(ctx, '#e98f6c', 0.022);
      scatterOn(blob, 60, new THREE.BoxGeometry(0.004, 0.0025, 0.003), std(0xe8583a, 0.5));
      // surimi sticks poking out along the sides
      const surimiTex = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = '#fbf3ea'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ea4b2c'; g.fillRect(0, 0, w * 0.55, h);
        g.fillStyle = '#f2835f'; g.fillRect(w * 0.55, 0, w * 0.08, h);
      });
      const surimiMat = std(0xffffff, 0.45, { map: surimiTex });
      for (let i = 0; i < 6; i++) {
        const x = -L * 0.34 + (i / 5) * L * 0.68;
        const stick = place(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.032, 16), surimiMat), ctx.group,
          x, ctx.y - 0.004, (i % 2 ? 1 : -1) * prof((2 * x) / L) * 0.85);
        stick.rotation.set(Math.PI / 2 + range(-0.3, 0.3), 0, range(-0.6, 0.6));
      }
    } else if (type === 'cheese') {
      fillings.cheese(ctx, 5);
    } else if (type === 'ham-cheese') {
      fillings.ham(ctx);
      fillings.cheese(ctx, 4);
      fillings.slices(ctx, 'tomato', 3, 0.022);
      fillings.slices(ctx, 'egg', 3, 0.016);
      fillings.slices(ctx, 'cucumber', 4, 0.014);
    } else if (type === 'tuna') {
      const blob = fillings.salad(ctx, '#a89272', 0.02);
      scatterOn(blob, 50, new THREE.BoxGeometry(0.004, 0.003, 0.004), std(0x8f7c60, 0.6));
      const onionMat = std(0xb05a9a, 0.4);
      for (let i = 0; i < 5; i++) {
        const x = -L * 0.32 + (i / 4) * L * 0.64;
        const ring = place(new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0017, 8, 28), onionMat), ctx.group,
          x, ctx.y - 0.002, (i % 2 ? 1 : -1) * prof((2 * x) / L) * 0.7);
        ring.rotation.set(Math.PI / 2 + range(-0.2, 0.2), 0, rnd() * 3);
      }
    } else if (type === 'chicken-curry') {
      const blob = fillings.salad(ctx, '#e7b43c', 0.021);
      scatterOn(blob, 26, new THREE.BoxGeometry(0.008, 0.007, 0.008), std(0xf7dc55, 0.4), 0.2); // pineapple
      scatterOn(blob, 40, new THREE.BoxGeometry(0.003, 0.001, 0.002), std(0x4f7a2a, 0.6)); // herbs
    }
  });

  // ---------- cocktail-stick flag with the sandwich's name ----------
  const flagTex = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = '#fdfaf3'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2c2622'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const text = info.label.toUpperCase();
    let size = 120;
    g.font = `700 ${size}px ${FONT}`;
    while (g.measureText(text).width > w - 50 && size > 20) { size -= 4; g.font = `700 ${size}px ${FONT}`; }
    g.fillText(text, w / 2, h / 2 + 6);
    g.fillStyle = '#d9a441'; g.fillRect(0, h - 22, w, 22);
  });
  const flagMat = std(0xffffff, 0.8, { map: flagTex });
  const flag = new THREE.Group();
  flag.position.copy(built.flagAt);
  hop.add(flag);
  place(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.1, 8), std(0xd9b98a, 0.7)), flag, 0, 0.02, 0);
  const flagPivot = new THREE.Group();
  flagPivot.position.y = 0.055;
  flag.add(flagPivot);
  place(new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), flagMat), flagPivot, 0.026, 0, 0.0004);
  place(new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), flagMat), flagPivot, 0.026, 0, -0.0004).rotation.y = Math.PI;

  // ---------- animation ----------
  let cycle = null, time = 0, wiggle = 0;

  function activate() {
    if (cycle) return Promise.resolve(false);
    return new Promise((resolve) => { cycle = { t: 0, dur: reducedMotion ? 0.5 : 1.1, resolve }; });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    time += dt;
    if (cycle) {
      cycle.t += dt;
      const k = Math.min(1, cycle.t / cycle.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      hop.position.y = Math.sin(k * Math.PI) * (reducedMotion ? 0.01 : 0.045);
      hop.rotation.y = reducedMotion ? 0 : e * Math.PI * 2;
      if (k >= 1) { hop.position.y = 0; hop.rotation.y = 0; cycle.resolve(true); cycle = null; wiggle = 0.25; }
    }
    wiggle *= Math.exp(-dt * 2);
    flagPivot.rotation.y = reducedMotion ? 0 : Math.sin(time * 7) * wiggle;
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
    type,
    label: info.label,
    activate,
    get busy() { return !!cycle; },
    update,
    dispose,
  };
}
