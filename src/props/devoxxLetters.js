import * as THREE from 'three';

/**
 * Free-standing "#DEVOXX" letters for a three.js scene, like the painted block letters on the
 * Devoxx stage: white letters, a light grey #, and the last X in orange.
 *
 * Built in metres: 1,00 m tall and 0,30 m deep by default; "#DEVOXX" is about 6,0 m long.
 * The origin sits on the floor at the centre of the word and the letters face +Z.
 *
 *   const letters = createDevoxxLetters();          // or { height: 1.2, depth: 0.35 }
 *   scene.add(letters.object);
 *   letters.activate();       // knocks a random standing letter over; call it on a fallen one to stand it up
 *   letters.activate(6);      // knocks over (or lifts) letter 6, the orange X
 *   letters.reset();          // stands every letter up again
 *   letters.update(delta);    // call every frame with the elapsed seconds
 *
 * Supported characters: # D E V O X. There is no out-of-stock state: the letters are either there or not.
 *
 * Adopted from private/assets/ai-fe-playground/devoxx-letters.js. Two additions for the game's
 * sake, both read-only and neither touching the topple itself: `letterColliders` (so the caller can
 * give each glyph a real Collider — see ExhibitionHall.ts's addDevoxxLetters) and `isStanding`, so a
 * caller can drop a fallen glyph's collider instead of leaving an invisible wall where a letter is
 * visibly lying flat on the floor.
 */
export function createDevoxxLetters({
  text = '#DEVOXX', height = 1.0, depth = 0.3, gap = 0.07,
  color = 0xf3f1ec, hashColor = 0xc5c9ce, accentColor = 0xe06f0b, accentLast = true, reducedMotion = false,
} = {}) {
  const root = new THREE.Group();
  root.name = 'DevoxxLetters';

  // ---------- glyphs, drawn on a 1-unit-tall grid ----------
  const T = 0.2; // stroke weight
  function roundRect(p, x0, y0, x1, y1, r) {
    p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.quadraticCurveTo(x1, y0, x1, y0 + r);
    p.lineTo(x1, y1 - r); p.quadraticCurveTo(x1, y1, x1 - r, y1); p.lineTo(x0 + r, y1);
    p.quadraticCurveTo(x0, y1, x0, y1 - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0);
    return p;
  }
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };

  const GLYPHS = {
    D: { w: 0.78, shapes() {
      const w = this.w, R = 0.34, r = 0.15;
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(w - R, 0); s.quadraticCurveTo(w, 0, w, R); s.lineTo(w, 1 - R);
      s.quadraticCurveTo(w, 1, w - R, 1); s.lineTo(0, 1); s.lineTo(0, 0);
      const h = new THREE.Path();
      h.moveTo(T, T); h.lineTo(w - T - r, T); h.quadraticCurveTo(w - T, T, w - T, T + r); h.lineTo(w - T, 1 - T - r);
      h.quadraticCurveTo(w - T, 1 - T, w - T - r, 1 - T); h.lineTo(T, 1 - T); h.lineTo(T, T);
      s.holes.push(h);
      return [s];
    } },
    E: { w: 0.64, shapes() {
      const w = this.w, m = w * 0.86;
      return [poly([[0, 0], [w, 0], [w, T], [T, T], [T, 0.5 - T / 2], [m, 0.5 - T / 2], [m, 0.5 + T / 2], [T, 0.5 + T / 2], [T, 1 - T], [w, 1 - T], [w, 1], [0, 1]])];
    } },
    V: { w: 0.86, shapes() {
      const w = this.w;
      return [poly([[0, 1], [0.235, 1], [w / 2, 0.3], [w - 0.235, 1], [w, 1], [w / 2 + 0.14, 0], [w / 2 - 0.14, 0]])];
    } },
    O: { w: 0.86, shapes() {
      const s = roundRect(new THREE.Shape(), 0, 0, this.w, 1, 0.36);
      s.holes.push(roundRect(new THREE.Path(), T, T, this.w - T, 1 - T, 0.16));
      return [s];
    } },
    X: { w: 0.8, shapes() {
      // two crossing arms of width a at top and bottom
      const w = this.w, a = 0.25, s = (w - 2 * a) / (2 * (w - a)), k = w - a;
      const cy = 1 - s, sx = 0.5 * k; // crotch heights and side notch offsets
      return [poly([[0, 1], [a, 1], [w / 2, cy], [w - a, 1], [w, 1], [w - sx, 0.5], [w, 0], [w - a, 0], [w / 2, 1 - cy], [a, 0], [0, 0], [sx, 0.5]])];
    } },
    '#': { w: 0.84, shapes() {
      // two slanted uprights and two cross bars; the bars are made a hair thinner in depth (see below)
      const w = this.w, lean = 0.1, sw = 0.17;
      const upright = (x) => poly([[x, 0], [x + sw, 0], [x + sw + lean, 1], [x + lean, 1]]);
      const bar = (y) => poly([[0, y], [w, y], [w, y + 0.16], [0, y + 0.16]]);
      return [upright(0.16), upright(0.16 + 0.34), Object.assign(bar(0.27), { bar: true }), Object.assign(bar(0.6), { bar: true })];
    } },
  };

  // ---------- build the word ----------
  const chars = [...text.toUpperCase()];
  chars.forEach((c) => { if (!GLYPHS[c]) throw new Error(`createDevoxxLetters: no glyph for "${c}". Supported: # D E V O X`); });
  const lastIndex = chars.length - 1;
  const matWhite = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const matHash = new THREE.MeshStandardMaterial({ color: hashColor, roughness: 0.5 });
  const matAccent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.45 });
  const D = depth / height, B = 0.018; // depth and bevel on the unit grid
  const totalW = chars.reduce((sum, c) => sum + GLYPHS[c].w, 0) + gap / height * (chars.length - 1);

  let cursor = -totalW / 2;
  const letters = chars.map((c, i) => {
    const g = GLYPHS[c];
    const mat = c === '#' ? matHash : accentLast && i === lastIndex ? matAccent : matWhite;
    // Each letter hangs from a pivot on its bottom front edge, so it can tip forward onto the floor
    const pivot = new THREE.Group();
    pivot.position.set((cursor + g.w / 2) * height, 0, (D / 2 + B) * height);
    root.add(pivot);
    for (const shape of g.shapes()) {
      const inset = shape.bar ? 0.004 : 0; // keeps the # bars from z-fighting with the uprights
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: D - inset * 2, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 3, curveSegments: 10,
      });
      geo.translate(-g.w / 2, B, -D / 2 + inset);
      geo.scale(height, height, height);
      geo.translate(0, 0, -(D / 2 + B) * height); // relative to the pivot on the front edge
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      pivot.add(mesh);
    }
    cursor += g.w + gap / height;
    return { char: c, pivot, angle: 0, target: 0, vel: 0, resolve: null, width: g.w * height };
  });

  // ---------- falling ----------
  const DOWN = Math.PI / 2; // lying on its face
  const G = 9.81;

  function activate(index) {
    let i = index;
    if (i === undefined) {
      const standing = letters.map((l, k) => k).filter((k) => letters[k].target === 0 && !letters[k].resolve);
      if (!standing.length) return Promise.resolve(false);
      i = standing[Math.floor(Math.random() * standing.length)];
    }
    const l = letters[i];
    if (!l || l.resolve) return Promise.resolve(false);
    l.target = l.target === 0 ? DOWN : 0;
    l.vel = l.target === DOWN ? 0.4 : 0; // a small nudge to start the tip
    return new Promise((resolve) => { l.resolve = resolve; });
  }

  function reset() {
    letters.forEach((l) => {
      l.angle = 0; l.target = 0; l.vel = 0;
      l.pivot.rotation.x = 0;
      if (l.resolve) { l.resolve(true); l.resolve = null; }
    });
  }

  function update(dt) {
    dt = Math.min(dt, 0.05);
    for (const l of letters) {
      if (!l.resolve) continue;
      if (reducedMotion) { l.angle = l.target; }
      else if (l.target === DOWN) {
        // topple: gravity on the letter's centre of mass, pivoting on its front edge
        const lever = Math.hypot(0.5, D / 2 + B) * height;
        const tipOffset = Math.atan2(D / 2 + B, 0.5); // angle it must pass before it truly falls
        l.vel += (G / lever) * Math.sin(Math.max(0.02, l.angle - tipOffset + 0.35)) * dt * 1.4;
        l.angle += l.vel * dt;
        if (l.angle >= DOWN) {
          l.angle = DOWN;
          l.vel = Math.abs(l.vel) > 1.2 ? -Math.abs(l.vel) * 0.18 : 0; // one small bounce off the floor
        }
      } else {
        // stand back up with an eased lift
        l.vel = Math.min(l.vel + dt * 4, 2.2);
        l.angle = Math.max(0, l.angle - l.vel * dt);
      }
      l.pivot.rotation.x = l.angle;
      const settled = l.target === DOWN ? l.angle >= DOWN - 1e-4 && l.vel === 0 : l.angle <= 0;
      if (settled) { l.angle = l.target; l.vel = 0; l.pivot.rotation.x = l.angle; l.resolve(true); l.resolve = null; }
    }
  }

  function dispose() {
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    [matWhite, matHash, matAccent].forEach((m) => m.dispose());
  }

  return {
    object: root,
    letters: letters.map((l) => l.char),
    width: totalW * height,
    /**
     * Per-glyph offset along the word's own local x axis, plus the footprint radius of a circle
     * around that glyph — half its own diagonal, the same circle-around-a-box approximation every
     * other boxy prop in this game uses for its collider. The pivot already sits at the glyph's
     * centre, so this is just read back off it rather than re-derived from the layout cursor.
     */
    letterColliders: letters.map((l) => ({ x: l.pivot.position.x, radius: Math.hypot(l.width, depth) / 2 })),
    /** False from the moment a glyph starts tipping over (and true again the moment it starts getting back up). */
    isStanding: (i) => letters[i] !== undefined && letters[i].target === 0,
    /**
     * True only once a glyph is all the way down and settled — still false for the whole fall.
     * A caller giving a fallen letter's collider up has to wait for this: while it's tipping it is
     * still visibly standing in the way, and dropping the collider at the start of the fall lets
     * the mover walk straight through the letter it just knocked over.
     */
    isFallen: (i) => letters[i] !== undefined && letters[i].target === DOWN && !letters[i].resolve,
    activate,
    reset,
    get busy() { return letters.some((l) => l.resolve); },
    update,
    dispose,
  };
}
