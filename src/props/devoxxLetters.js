import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The venue's free-standing DEVOXX letters: chunky white slab glyphs with the
 * final X in orange, standing on the floor (see
 * private/assets/reference/venue/videos/frames/letters_hi_3s.jpg — the real
 * ones sit in the open, roughly 1.5 m tall, and the same set gets moved around
 * the building over the week).
 *
 * Built in metres, origin on the floor at the wordmark's own centre, reading
 * face toward +Z:
 *
 *   const letters = createDevoxxLetters();
 *   letters.object.position.set(0, 0, 8);
 *   letters.object.rotation.y = Math.PI;   // turn the face toward -Z
 *   scene.add(letters.object);
 *
 * Every glyph is a real extruded shape rather than a canvas-textured plane —
 * these are walked past at arm's length in all three spots they're placed, and
 * a flat billboard reads as a sticker the moment the camera swings off-axis.
 *
 * `letterColliders` gives each glyph's own local x offset + footprint radius so
 * the caller can turn them into real `Collider`s at whatever position/rotation
 * it placed the group (see ExhibitionHall.ts's addDevoxxLetters) — the caller
 * can't derive those from the group itself, and a hand-copied second list of
 * offsets is exactly the drift this project has been bitten by before.
 */

// Unit em: every glyph is authored 1.0 tall with y from 0 (floor) to 1, then
// scaled to the requested height. Stroke thickness is the one number the
// whole alphabet is proportioned from.
const STROKE = 0.24;
const GLYPH_GAP = 0.1; // between glyph bounding boxes, same unit em

/** Each glyph as a THREE.Shape in the unit em above. Only the six DEVOXX needs. */
const GLYPHS = {
  D() {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.42, 0);
    s.bezierCurveTo(0.92, 0.06, 0.92, 0.94, 0.42, 1);
    s.lineTo(0, 1);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(STROKE, STROKE);
    hole.lineTo(0.42, STROKE);
    hole.bezierCurveTo(0.66, 0.28, 0.66, 0.72, 0.42, 1 - STROKE);
    hole.lineTo(STROKE, 1 - STROKE);
    hole.closePath();
    s.holes.push(hole);
    return s;
  },
  E() {
    const s = new THREE.Shape();
    const mid = STROKE / 2;
    s.moveTo(0, 0);
    s.lineTo(0.62, 0);
    s.lineTo(0.62, STROKE);
    s.lineTo(STROKE, STROKE);
    s.lineTo(STROKE, 0.5 - mid);
    s.lineTo(0.56, 0.5 - mid);
    s.lineTo(0.56, 0.5 + mid);
    s.lineTo(STROKE, 0.5 + mid);
    s.lineTo(STROKE, 1 - STROKE);
    s.lineTo(0.62, 1 - STROKE);
    s.lineTo(0.62, 1);
    s.lineTo(0, 1);
    s.closePath();
    return s;
  },
  V() {
    const s = new THREE.Shape();
    s.moveTo(0, 1);
    s.lineTo(0.24, 1);
    s.lineTo(0.37, 0.26); // inner apex, a hair above the floor — a real V's ink trap
    s.lineTo(0.5, 1);
    s.lineTo(0.74, 1);
    s.lineTo(0.44, 0);
    s.lineTo(0.3, 0);
    s.closePath();
    return s;
  },
  O() {
    const s = new THREE.Shape();
    s.absellipse(0.4, 0.5, 0.4, 0.5, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absellipse(0.4, 0.5, 0.4 - STROKE, 0.5 - STROKE, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  },
  // Every vertex solved from the four arm edges rather than eyeballed — the
  // notches are where those edges actually cross (arm A runs top-left to
  // bottom-right, arm B top-right to bottom-left, both 0.24 wide in x), so
  // the waist stays symmetric instead of drifting off-centre.
  X() {
    const s = new THREE.Shape();
    s.moveTo(0, 1);
    s.lineTo(0.24, 1);
    s.lineTo(0.38, 0.731); // top notch
    s.lineTo(0.52, 1);
    s.lineTo(0.76, 1);
    s.lineTo(0.5, 0.5); // right notch
    s.lineTo(0.76, 0);
    s.lineTo(0.52, 0);
    s.lineTo(0.38, 0.269); // bottom notch
    s.lineTo(0.24, 0);
    s.lineTo(0, 0);
    s.lineTo(0.26, 0.5); // left notch
    s.closePath();
    return s;
  },
};

const WORD = ['D', 'E', 'V', 'O', 'X', 'X'];

export function createDevoxxLetters({
  height = 1.5,
  depth = 0.5,
  color = 0xf4f3ee,
  // The last X only — the real set's one coloured glyph. Defaults to the same
  // orange the entrance foyer's own accent strip uses, since that's the one
  // spot where the two are in frame together.
  accentColor = 0xff8a3d,
  emissiveIntensity = 0.35,
} = {}) {
  const root = new THREE.Group();
  root.name = 'DevoxxLetters';

  // Extruded at depth/height so the single uniform scale below lands the
  // requested depth in metres — scaling x/y only would squash the extrusion
  // instead, and scaling the whole Group would scale any collider maths the
  // caller derives from it too.
  const extrude = { depth: depth / height, bevelEnabled: false, curveSegments: 8 };

  const geometries = WORD.map((char) => {
    const geo = new THREE.ExtrudeGeometry(GLYPHS[char](), extrude);
    geo.scale(height, height, height);
    geo.computeBoundingBox();
    return geo;
  });

  // Lay the glyphs out left to right from their real bounding boxes, not from
  // the authored widths — the D's and O's curves decide their own extents.
  const gap = GLYPH_GAP * height;
  const widths = geometries.map((g) => g.boundingBox.max.x - g.boundingBox.min.x);
  const width = widths.reduce((sum, w) => sum + w, 0) + gap * (WORD.length - 1);

  const letterColliders = [];
  let cursor = -width / 2;
  geometries.forEach((geo, i) => {
    const bb = geo.boundingBox;
    const centerX = cursor + widths[i] / 2;
    geo.translate(centerX - (bb.min.x + bb.max.x) / 2, -bb.min.y, -depth / 2);
    // Half the footprint's own diagonal — the same circle-around-a-box
    // approximation every other boxy prop in this game uses for its collider.
    letterColliders.push({ x: centerX, radius: Math.hypot(widths[i], depth) / 2 });
    cursor += widths[i] + gap;
  });

  // Merged per material: the whole wordmark is 2 draw calls rather than 6,
  // and it gets placed three times over.
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    // These stand in a near-black corridor and a blacked-out auditorium as
    // well as the bright foyer — a purely lit material reads as a flat grey
    // slab in two of the three, same reason the hallway's fabric pillars and
    // room signage carry their own emissive tint.
    emissive: color,
    emissiveIntensity,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.55,
    emissive: accentColor,
    emissiveIntensity,
  });

  const accentIndex = WORD.length - 1;
  const plain = mergeGeometries(geometries.filter((_, i) => i !== accentIndex));
  root.add(new THREE.Mesh(plain, material));
  root.add(new THREE.Mesh(geometries[accentIndex], accentMaterial));
  // mergeGeometries clones into a new buffer; the sources it consumed are
  // dead weight from here on (the accent glyph's own geometry is still live).
  geometries.forEach((geo, i) => {
    if (i !== accentIndex) geo.dispose();
  });

  return {
    object: root,
    width,
    letterColliders,
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    },
  };
}
