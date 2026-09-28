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
/** @deprecated kept as an alias — was the only robot when this was named. */
export type VoxxyAnimationName = RobotAnimationName;

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
