import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Procedural approximation of Voxxy from a reference image:
// round bear-eared head with a dark visor and glowing eyes, a teardrop torso with
// a white belly stripe and chest decal, and two stout teardrop legs ending in
// small dark feet. Built from primitives (no external asset) per the rules'
// ban on reusing the reference model directly. Root origin sits at ground level
// (feet touch y = 0), so callers can position it with plain y = 0 on flat ground.

const ORANGE = 0xf5821f;
const WHITE = 0xf2f2f2;
const DARK = 0x161616;
const EYE_COLOR = 0xffb347;

function orangeMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.35, metalness: 0.1 });
}
function whiteMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.4 });
}
function darkMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6 });
}
function eyeMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: EYE_COLOR,
    emissive: EYE_COLOR,
    emissiveIntensity: 1.2,
  });
}

// Marks a mesh as one Robot should tint (e.g. blue) while stunned — only the
// glossy orange shell, not the white/dark/eye accents.
function tintable(mesh: THREE.Mesh): THREE.Mesh {
  mesh.userData.tintable = true;
  return mesh;
}

export function createVoxxyMesh(): THREE.Object3D {
  const root = new THREE.Group();

  const legGeom = new THREE.CapsuleGeometry(0.22, 0.32, 4, 8);
  const footGeom = new THREE.SphereGeometry(0.14, 8, 8);
  for (const side of [-1, 1]) {
    const leg = tintable(new THREE.Mesh(legGeom, orangeMat()));
    leg.position.set(side * 0.22, 0.38, 0);
    root.add(leg);

    const foot = new THREE.Mesh(footGeom, darkMat());
    foot.position.set(side * 0.22, 0.12, 0.03);
    foot.scale.set(1, 0.7, 1.3);
    root.add(foot);
  }

  const torso = tintable(new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 16), orangeMat()));
  torso.scale.set(0.95, 1.15, 0.95);
  torso.position.set(0, 0.95, 0);
  root.add(torso);

  const belly = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 24), whiteMat());
  belly.rotation.x = Math.PI / 2;
  belly.position.set(0, 0.62, 0);
  root.add(belly);

  const decal = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), whiteMat());
  decal.position.set(0, 1.05, 0.44);
  root.add(decal);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), darkMat());
  neck.position.set(0, 1.5, 0);
  root.add(neck);

  const head = tintable(new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 20), orangeMat()));
  head.scale.set(1, 1.1, 1);
  head.position.set(0, 1.85, 0);
  root.add(head);

  const earGeom = new THREE.SphereGeometry(0.11, 12, 12);
  for (const side of [-1, 1]) {
    const ear = tintable(new THREE.Mesh(earGeom, orangeMat()));
    ear.position.set(side * 0.24, 2.14, -0.02);
    root.add(ear);
  }

  const antenna = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.1, 4, 8), whiteMat());
  antenna.position.set(0, 2.22, 0.04);
  root.add(antenna);

  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), darkMat());
  visor.scale.set(1, 0.85, 0.45);
  visor.position.set(0, 1.86, 0.24);
  root.add(visor);

  const eyeGeom = new THREE.SphereGeometry(0.045, 8, 8);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeom, eyeMat());
    eye.position.set(side * 0.11, 1.86, 0.4);
    root.add(eye);
  }

  const sensorGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12);
  for (const side of [-1, 1]) {
    const sensor = new THREE.Mesh(sensorGeom, whiteMat());
    sensor.rotation.z = Math.PI / 2;
    sensor.position.set(side * 0.37, 1.86, 0.02);
    root.add(sensor);
  }

  return root;
}

const DROID_GREY = 0x9aa0a6;
const DROID_GOLD = 0xc8a05a;
const BIGGY_RUST = 0xb85a24;
const BIGGY_NAVY = 0x2f3b52;

function flatMat(color: number, roughness = 0.45, metalness = 0.15): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/**
 * The scale that makes a stand-in stand exactly as tall as the .glb that will
 * replace it. Returned rather than applied, because applyBodyScale() owns
 * bodyGroup.scale outright — this goes into baseBodyScale, the same slot the
 * real model's own rescale lands in. Without it the real model arriving
 * mid-level reads as the robot suddenly changing size.
 */
function heightFitScale(root: THREE.Object3D, target: number): number {
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  return size.y > 0 ? target / size.y : 1;
}

/**
 * Droid's low-poly stand-in: tall, slim, deliberately-built humanoid — a
 * helmet head with a dark visor, wide shoulder pauldrons with gold rings, long
 * thin arms. Same rules as createVoxxyMesh above: primitives only, root origin
 * at the feet, and only the shell marked tintable.
 */
export function createDroidMesh(): THREE.Object3D {
  const root = new THREE.Group();
  const grey = () => flatMat(DROID_GREY, 0.4, 0.35);
  const dark = () => flatMat(0x2b2d31, 0.6, 0.2);

  const legGeom = new THREE.CapsuleGeometry(0.15, 0.78, 4, 8);
  for (const side of [-1, 1]) {
    const leg = tintable(new THREE.Mesh(legGeom, grey()));
    leg.position.set(side * 0.19, 0.62, 0);
    root.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.34), dark());
    foot.position.set(side * 0.19, 0.05, 0.05);
    root.add(foot);
  }

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.28), dark());
  hips.position.set(0, 1.12, 0);
  root.add(hips);

  const torso = tintable(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 4, 10), grey()));
  torso.scale.set(1, 1, 0.75);
  torso.position.set(0, 1.55, 0);
  root.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), dark());
  chest.position.set(0, 1.66, 0.22);
  root.add(chest);

  for (const side of [-1, 1]) {
    const pauldron = tintable(new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), grey()));
    pauldron.scale.set(1, 0.72, 1);
    pauldron.position.set(side * 0.38, 1.82, 0);
    root.add(pauldron);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 14), flatMat(DROID_GOLD, 0.35, 0.6));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(side * 0.38, 1.76, 0);
    root.add(ring);

    const arm = tintable(new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.62, 4, 8), grey()));
    arm.position.set(side * 0.4, 1.36, 0);
    root.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dark());
    hand.position.set(side * 0.4, 1.0, 0);
    root.add(hand);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), dark());
  neck.position.set(0, 1.97, 0);
  root.add(neck);

  const head = tintable(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), grey()));
  head.scale.set(1, 1.15, 1.05);
  head.position.set(0, 2.2, 0);
  root.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.1), dark());
  visor.position.set(0, 2.21, 0.17);
  root.add(visor);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat());
    eye.position.set(side * 0.07, 2.21, 0.22);
    root.add(eye);
  }

  return root;
}

/**
 * Biggy's low-poly stand-in: wide and round, a heavy rust-coloured belly under
 * a navy shell, stubby limbs and a single chest port. Shorter than Voxxy's and
 * much wider — the same "his design reads wide, not tall" reasoning as
 * ROBOT_HEIGHT's own note below.
 */
export function createBiggyMesh(): THREE.Object3D {
  const root = new THREE.Group();
  const rust = () => flatMat(BIGGY_RUST, 0.55, 0.2);
  const navy = () => flatMat(BIGGY_NAVY, 0.5, 0.25);
  const dark = () => flatMat(0x1f2229, 0.65, 0.15);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.16, 4, 8), navy());
    leg.position.set(side * 0.3, 0.26, 0);
    root.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.38), dark());
    foot.position.set(side * 0.3, 0.06, 0.05);
    root.add(foot);
  }

  const belly = tintable(new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14), rust()));
  belly.scale.set(1.12, 0.98, 1.06);
  belly.position.set(0, 0.92, 0);
  root.add(belly);

  // The navy upper shell: a hemisphere capping the belly, which is what makes
  // the silhouette read as Biggy rather than as a plain orange ball.
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.63, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), navy());
  shell.scale.set(1.12, 0.85, 1.06);
  shell.position.set(0, 0.92, 0);
  root.add(shell);

  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 14), dark());
  port.rotation.x = Math.PI / 2;
  port.position.set(0, 0.86, 0.64);
  root.add(port);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 8), navy());
    arm.position.set(side * 0.72, 0.82, 0);
    arm.rotation.z = side * 0.18;
    root.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), dark());
    hand.position.set(side * 0.78, 0.55, 0);
    root.add(hand);
  }

  const dome = tintable(new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), navy()));
  dome.scale.set(1.05, 0.9, 1);
  dome.position.set(0, 1.62, 0);
  root.add(dome);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.12), dark());
  brow.position.set(0, 1.66, 0.28);
  root.add(brow);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat());
    eye.position.set(side * 0.13, 1.58, 0.31);
    root.add(eye);
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), dark());
  antenna.position.set(0, 2.0, -0.04);
  root.add(antenna);

  return root;
}

/**
 * The low-poly stand-in for a robot, by id, plus the base scale to render it
 * at. Every robot has one now, not just Voxxy: a level transition used to
 * leave the *previous* robot's body on screen for the length of the next
 * one's download (10-34 MB per clip), so Level 2 could open with Voxxy
 * standing in for Droid. Falls back to Voxxy's for an unknown id rather than
 * throwing — a missing stand-in should never be what stops the game starting.
 *
 * Droid's and Biggy's are scaled to the exact height their .glb will land at,
 * so the swap when it arrives is invisible. Voxxy's deliberately isn't: it
 * predates the real models and things are tuned against its own proportions —
 * swagAccessories.ts's VOXXY_SPOTS anchor worn swag to it, Robot.ts's
 * SLEEPY_Y_PLACEHOLDER to its head height — so it keeps the size it has
 * always had. Swag is Voxxy's mechanic alone, so the other two have no such
 * couplings to respect.
 */
export function createPlaceholder(robotId: string): { object: THREE.Object3D; baseScale: number } {
  if (robotId === 'droid' || robotId === 'biggy') {
    const object = robotId === 'droid' ? createDroidMesh() : createBiggyMesh();
    return { object, baseScale: heightFitScale(object, ROBOT_HEIGHT[robotId]) };
  }
  return { object: createVoxxyMesh(), baseScale: 1 };
}

// AI-generated + rigged models, served from public/models so each is a plain
// static asset at runtime. Every robot's files follow the same convention:
// `${robotId}.glb` (base mesh + the walk clip) plus optional
// `${robotId}-run.glb` / `-jump.glb` / `-stun.glb` / `-idle.glb` siblings, one
// action baked per file (Blender exports one action at a time) rather than
// one GLB with every clip bundled. Dropping a new sibling file into
// public/models/ is the entire integration step for an EXISTING robot's new
// clip — no code change needed. Adding a robot's first clip (a new robotId
// altogether) does need loadRobotAsset(robotId) called from somewhere new
// (see Robot.ts's setRobotModel()) — that one part isn't drop-in.
//
// Exported at unit height (feet at local y = 0, head at y = 1) — ROBOT_HEIGHT
// rescales per robot to match the procedural placeholder's proportions so
// gameplay tuning (jump height, ledge clearance, camera look height) built
// against that placeholder doesn't need retuning. Droid's is taller than
// Voxxy's, matching his "tall" trait — purely
// a look; no gameplay mechanic currently keys off a robot's exact height.
// Biggy starts a little shorter than Voxxy, not taller — his design reads as
// wide/round rather than tall (the mesh's own proportions already carry
// that), and starting shorter leaves visible headroom for grow() to make him
// imposing by the time a Lunch Rush run is well underway, rather than
// starting big and growth barely reading at all.
const ROBOT_HEIGHT: Record<string, number> = { voxxy: 1.7, droid: 1.9, biggy: 1.6 };
const DEFAULT_HEIGHT = 1.7;
const gltfLoader = new GLTFLoader();

export type RobotAnimationName = 'walk' | 'run' | 'jump' | 'stun' | 'idle';

export interface RobotAsset {
  model: THREE.Object3D;
  clips: Partial<Record<RobotAnimationName, THREE.AnimationClip>>;
}

const OPTIONAL_CLIPS: { name: RobotAnimationName; suffix: string }[] = [
  { name: 'run', suffix: 'run' },
  { name: 'jump', suffix: 'jump' },
  { name: 'stun', suffix: 'stun' },
  { name: 'idle', suffix: 'idle' },
];

/** Loads the named robot's real model plus whatever animation clips are available. */
export async function loadRobotAsset(robotId: string): Promise<RobotAsset> {
  const base = await gltfLoader.loadAsync(`/models/${robotId}.glb`);
  const model = base.scene;
  model.scale.setScalar(ROBOT_HEIGHT[robotId] ?? DEFAULT_HEIGHT);
  // GLTFLoader binds each SkinnedMesh's bindMatrix from its matrixWorld at
  // parse time — before we scale the loaded scene here. Left alone, that
  // stale (unscaled) bindMatrix increasingly disagrees with the mesh's real
  // (now-scaled) matrixWorld as bones rotate away from rest pose, which
  // showed up as the limbs shearing into a mangled blob mid-walk-cycle while
  // the rest pose looked fine. Re-binding against the post-scale matrixWorld
  // fixes it.
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.userData.tintable = true;
    }
    if (child instanceof THREE.SkinnedMesh) {
      child.bind(child.skeleton, child.matrixWorld);
    }
  });

  const clips: Partial<Record<RobotAnimationName, THREE.AnimationClip>> = {};
  if (base.animations[0]) clips.walk = base.animations[0];

  const optional = await Promise.allSettled(
    OPTIONAL_CLIPS.map((source) => gltfLoader.loadAsync(`/models/${robotId}-${source.suffix}.glb`)),
  );
  optional.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value.animations[0]) {
      clips[OPTIONAL_CLIPS[i].name] = result.value.animations[0];
    }
  });

  return { model, clips };
}
