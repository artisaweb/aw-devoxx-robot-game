import * as THREE from 'three';

// Generic "conference hero" archetypes for attendee hazards in Swag Run:
// original character designs, only loosely inspired by real speakers'
// general style (hair/beard/silhouette),
// never a named or identifiable likeness. All four share one body skeleton
// (leg/torso/head heights) so swagAccessories.ts's shared HAZARD_SPOTS anchor
// table lands correctly regardless of which archetype stole an item.
export type AttendeeArchetype = 'live-coder' | 'java-godfather' | 'keynote-legend' | 'booth-recruiter';

const SKIN = 0xd9a06b;

function mat(color: number, roughness = 0.5, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

// Hip height legs pivot from, so a walk-cycle rotation swings the whole leg
// naturally rather than spinning a capsule around its own middle.
const HIP_Y = 0.87;

/**
 * Shared lower body: legs + feet, common to every archetype. Each leg is its
 * own pivot group anchored at the hip and tagged in userData so SwagRun's
 * walk-cycle animation can find and rotate it without a full skeleton.
 */
function buildLegs(pantsColor: number): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [];
  const legGeom = new THREE.CapsuleGeometry(0.16, 0.42, 4, 8);
  const footGeom = new THREE.SphereGeometry(0.12, 8, 8);
  const pantsMat = mat(pantsColor, 0.7);
  const shoeMat = mat(0x1a1a1a, 0.6);
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.15, HIP_Y, 0);
    pivot.userData.walkPart = side < 0 ? 'legL' : 'legR';

    const leg = new THREE.Mesh(legGeom, pantsMat);
    leg.position.set(0, 0.45 - HIP_Y, 0);
    pivot.add(leg);

    const foot = new THREE.Mesh(footGeom, shoeMat);
    foot.position.set(0, 0.1 - HIP_Y, 0.04);
    foot.scale.set(1, 0.6, 1.4);
    pivot.add(foot);

    parts.push(pivot);
  }
  return parts;
}

/** Shared torso capsule, common center/height so accessory anchors line up. */
function buildTorso(color: number, roughness = 0.5): THREE.Mesh {
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 4, 8), mat(color, roughness));
  torso.position.set(0, 1.05, 0);
  return torso;
}

/** Shared arms, optionally bending the right one forward to hold a prop. */
function buildArms(sleeveColor: number, holdingProp: boolean): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [];
  const armGeom = new THREE.CapsuleGeometry(0.09, 0.36, 4, 8);
  const armMat = mat(sleeveColor, 0.6);
  const skinMat = mat(SKIN, 0.5);

  // Tagged for SwagRun's walk-cycle animation. The prop-holding arm keeps its
  // static pose (already bent to hold something) rather than swinging into it.
  const leftArm = new THREE.Mesh(armGeom, armMat);
  leftArm.position.set(-0.38, 1.05, 0);
  leftArm.rotation.z = 0.15;
  leftArm.userData.walkPart = 'armL';
  parts.push(leftArm);

  const rightArm = new THREE.Mesh(armGeom, armMat);
  if (holdingProp) {
    rightArm.position.set(0.36, 1.15, 0.14);
    rightArm.rotation.z = -0.9;
    rightArm.rotation.x = -0.3;
  } else {
    rightArm.position.set(0.38, 1.05, 0);
    rightArm.rotation.z = -0.15;
    rightArm.userData.walkPart = 'armR';
  }
  parts.push(rightArm);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skinMat);
  hand.position.copy(holdingProp ? new THREE.Vector3(0.5, 1.32, 0.28) : new THREE.Vector3(0.42, 0.86, 0));
  parts.push(hand);

  return parts;
}

/** Shared head — skin sphere at the common anchor height every archetype builds on. */
function buildHead(): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [];
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 8), mat(SKIN));
  neck.position.set(0, 1.42, 0);
  parts.push(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), mat(SKIN));
  head.position.set(0, 1.68, 0);
  parts.push(head);

  return parts;
}

function buildDrink(cupColor: number, liquidColor: number): THREE.Object3D {
  const group = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 10), mat(cupColor));
  group.add(cup);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), mat(liquidColor));
  liquid.position.y = 0.08;
  group.add(liquid);
  group.position.set(0.5, 1.38, 0.28);
  return group;
}

// --- Archetype 1: the Live-Coder — young, hoodie, messenger bag, tousled hair, thick glasses.
function createLiveCoder(): THREE.Object3D {
  const root = new THREE.Group();
  root.add(...buildLegs(0x2c3e6b));
  root.add(buildTorso(0x4a4a52, 0.8));
  root.add(...buildArms(0x4a4a52, false));
  root.add(...buildHead());

  const hairMat = mat(0x2b1d12, 0.7);
  for (const [dx, dz, s] of [[0, 0, 0.15], [0.12, 0.1, 0.1], [-0.13, 0.08, 0.1], [0.05, -0.15, 0.1]] as const) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), hairMat);
    tuft.position.set(dx, 1.86, dz);
    root.add(tuft);
  }

  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.06), mat(0x111111));
  glasses.position.set(0, 1.68, 0.25);
  root.add(glasses);

  const bagStrap = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.75, 0.03),
    mat(0x8a5a2b, 0.7),
  );
  bagStrap.position.set(-0.05, 1.05, 0.1);
  bagStrap.rotation.z = 0.6;
  root.add(bagStrap);

  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.1), mat(0x8a5a2b, 0.7));
  bag.position.set(0.1, 0.72, 0.12);
  root.add(bag);

  return root;
}

// --- Archetype 2: the Java Godfather — silver hair, full beard, warm blazer, coffee mug.
function createJavaGodfather(): THREE.Object3D {
  const root = new THREE.Group();
  root.add(...buildLegs(0x2b2b2e));
  root.add(buildTorso(0x6e3b2e, 0.4));
  root.add(...buildArms(0x6e3b2e, true));
  root.add(...buildHead());
  root.add(buildDrink(0xf2f2f2, 0x4a2c17));

  const hairMat = mat(0xcfd3d6, 0.6);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairCap.position.set(0, 1.7, 0);
  root.add(hairCap);

  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), hairMat);
  beard.scale.set(0.9, 1.1, 0.7);
  beard.position.set(0, 1.55, 0.1);
  root.add(beard);

  const vestTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 16), mat(0xc9a24b, 0.5, 0.3));
  vestTrim.position.set(0, 1.24, 0);
  root.add(vestTrim);

  return root;
}

// --- Archetype 3: the Keynote Legend — dark glossy jacket, slicked hair, permanent sunglasses, mic clip.
function createKeynoteLegend(): THREE.Object3D {
  const root = new THREE.Group();
  root.add(...buildLegs(0x141414));
  root.add(buildTorso(0x161616, 0.15));
  root.add(...buildArms(0x161616, false));
  root.add(...buildHead());

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x1a1410, 0.3));
  hair.position.set(0, 1.71, 0);
  root.add(hair);

  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.07), mat(0x0a0a0a, 0.2, 0.5));
  shades.position.set(0, 1.68, 0.25);
  root.add(shades);

  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat(0x888888, 0.4, 0.6));
  mic.position.set(0.15, 1.25, 0.28);
  root.add(mic);

  return root;
}

// --- Archetype 4: the Booth Recruiter — bright polo, lanyard badge, tote bag, tidy hair.
function createBoothRecruiter(): THREE.Object3D {
  const root = new THREE.Group();
  root.add(...buildLegs(0x3d3d3d));
  root.add(buildTorso(0xd7263d, 0.6));
  root.add(...buildArms(0xd7263d, true));
  root.add(...buildHead());

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(0x3a2a1a, 0.6));
  hair.position.set(0, 1.72, 0);
  root.add(hair);

  const lanyard = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 16), mat(0x2266cc));
  lanyard.rotation.x = Math.PI / 2;
  lanyard.position.set(0, 1.32, 0.05);
  root.add(lanyard);

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.02), mat(0xf2f2f2));
  badge.position.set(0, 1.15, 0.28);
  root.add(badge);

  const toteBag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.14), mat(0xf4c542, 0.7));
  toteBag.position.set(0.48, 0.95, 0.2);
  root.add(toteBag);

  return root;
}

export function createAttendeeMesh(archetype: AttendeeArchetype): THREE.Object3D {
  switch (archetype) {
    case 'live-coder':
      return createLiveCoder();
    case 'java-godfather':
      return createJavaGodfather();
    case 'keynote-legend':
      return createKeynoteLegend();
    case 'booth-recruiter':
      return createBoothRecruiter();
  }
}
