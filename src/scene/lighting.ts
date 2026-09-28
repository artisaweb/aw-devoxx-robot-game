import * as THREE from 'three';

// Reference photos show the exhibition floor as bright and open under a tall
// black ceiling void, lit by scattered white spotlights (plus the soffit's own
// warm glow in ExhibitionHall.ts) — not a moody, dimly-lit space.
const SPOTLIGHT_POSITIONS: [number, number][] = [
  [-15, -10],
  [15, -10],
  [-15, 10],
  [15, 10],
];

export function createLighting(): THREE.Group {
  const group = new THREE.Group();

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  group.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(20, 30, 10);
  group.add(directional);

  for (const [x, z] of SPOTLIGHT_POSITIONS) {
    const spot = new THREE.PointLight(0xfff2df, 25, 22, 2);
    spot.position.set(x, 7, z);
    group.add(spot);
  }

  return group;
}
