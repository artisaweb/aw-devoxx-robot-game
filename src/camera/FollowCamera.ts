import * as THREE from 'three';
import { Robot } from '../entities/Robot';
import {
  HALL_WIDTH,
  HALL_DEPTH,
  FOYER_WIDTH,
  FOYER_DEPTH,
  getGroundFloorHeightAt,
  getFirstFloorHeightAt,
  FIRST_FLOOR_CLAMP_X_MIN,
  FIRST_FLOOR_CLAMP_X_MAX,
  FIRST_FLOOR_CLAMP_Z_MIN,
  FIRST_FLOOR_CLAMP_Z_MAX,
} from '../scene/ExhibitionHall';

const OFFSET = new THREE.Vector3(0, 4, -8); // behind and above, in robot-facing space
const LOOK_HEIGHT = 1.2;
const FOLLOW_RATE = 6; // higher = snappier
const WALL_MARGIN = 1.5; // keep the camera this far inside the hall walls
const CAMERA_WALL_MARGIN = 0.25; // stay this far in front of a wall the raycast hits, not flush against it
const MIN_CAMERA_DIST = 1.2; // never pull the camera closer to the character than this, however tight the space
// A phone held sideways: the vertical field of view is fixed, so on a screen
// this short the robot sits dead centre with the top ~40% of it ceiling and
// the floor ahead squeezed under the touch controls. Tilting down trades
// that ceiling for floor in front of the robot. Below 500px tall matches the
// HUD's own phone-sized threshold (Hud.ts's MINIMAP_SMALL_SCREEN); portrait
// and desktop screens keep the original framing.
const SHORT_LANDSCAPE_HEIGHT = 500;
const SHORT_LANDSCAPE_TILT = THREE.MathUtils.degToRad(9);

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private snapNext = false;
  private tilt = 0;

  constructor(width: number, height: number) {
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 500);
    this.onResize(width, height);
  }

  /**
   * Makes the next update() jump straight to the chase spot instead of
   * gliding there. For level transitions, where the robot is relocated to
   * another map: the glide from the previous level's spot took ~0.5s, and on
   * the way into Level 2 it showed the laser fence up close behind the
   * briefing panel.
   */
  snapOnNextUpdate(): void {
    this.snapNext = true;
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.tilt = width > height && height < SHORT_LANDSCAPE_HEIGHT ? SHORT_LANDSCAPE_TILT : 0;
  }

  /**
   * @param collidables Wall/scenery geometry to raycast against so a wall
   * between the camera and the character pulls the camera in front of it
   * instead of clipping through, rather than leaving it stuck behind the
   * wall the way the room-bound clamp alone would.
   */
  update(robot: Robot, dt: number, collidables: THREE.Object3D[]): void {
    const rotatedOffset = OFFSET.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), robot.heading);
    const desiredPos = robot.position.clone().add(rotatedOffset);
    const onFirstFloor = robot.mapMode === 'first';
    // Anchor camera height to the floor level (not the robot's actual y), so
    // jumping raises the robot relative to the camera instead of just
    // dragging the camera up with it (which made jumps invisible).
    const localGroundY = onFirstFloor
      ? getFirstFloorHeightAt(robot.position.x, robot.position.z)
      : getGroundFloorHeightAt(robot.position.x, robot.position.z);
    desiredPos.y = localGroundY + OFFSET.y;

    // The chase offset can land outside the level's own walls when the robot
    // is near one and turns (e.g. backed into a corner) — clamp it back
    // inside so the camera never ends up looking at the inside face of a
    // wall up close. Each level's map has its own bounds entirely (see
    // Robot.ts's mapMode) rather than inferring which applies from position.
    let xMin: number;
    let xMax: number;
    let zMin: number;
    let zMax: number;
    if (onFirstFloor) {
      xMin = FIRST_FLOOR_CLAMP_X_MIN + WALL_MARGIN;
      xMax = FIRST_FLOOR_CLAMP_X_MAX - WALL_MARGIN;
      zMin = FIRST_FLOOR_CLAMP_Z_MIN + WALL_MARGIN;
      zMax = FIRST_FLOOR_CLAMP_Z_MAX - WALL_MARGIN;
    } else {
      xMin = -(HALL_WIDTH / 2 - WALL_MARGIN);
      xMax = HALL_WIDTH / 2 - WALL_MARGIN;
      zMin = -(HALL_DEPTH / 2 - WALL_MARGIN);
      zMax = HALL_DEPTH / 2 - WALL_MARGIN;
      // The foyer beyond the front wall gets its own (wider) bounds, told
      // apart from the hall by position since you walk between them.
      if (robot.position.z > HALL_DEPTH / 2 - WALL_MARGIN) {
        xMin = -(FOYER_WIDTH / 2 - WALL_MARGIN);
        xMax = FOYER_WIDTH / 2 - WALL_MARGIN;
        zMax = HALL_DEPTH / 2 + FOYER_DEPTH - WALL_MARGIN;
      }
    }
    desiredPos.x = THREE.MathUtils.clamp(desiredPos.x, xMin, xMax);
    desiredPos.z = THREE.MathUtils.clamp(desiredPos.z, zMin, zMax);

    // The room-bound clamp above only accounts for the outer walls of
    // whichever space the robot is nominally in; a column, a booth, or the
    // near side of a wall the robot is standing right up against can still
    // land between the desired camera spot and the character. Raycast from
    // the character toward that spot and pull the camera in front of
    // whatever it hits first, so nothing can ever block the view of them.
    const lookOrigin = robot.position.clone().add(new THREE.Vector3(0, LOOK_HEIGHT, 0));
    const toCamera = desiredPos.clone().sub(lookOrigin);
    const distance = toCamera.length();
    if (distance > 0.01 && collidables.length > 0) {
      const direction = toCamera.divideScalar(distance);
      this.raycaster.set(lookOrigin, direction);
      this.raycaster.near = 0.05; // skip the character's own geometry right at the origin
      this.raycaster.far = distance;
      const hits = this.raycaster.intersectObjects(collidables, true);
      if (hits.length > 0) {
        const clearDistance = Math.max(hits[0].distance - CAMERA_WALL_MARGIN, MIN_CAMERA_DIST);
        desiredPos.copy(lookOrigin).addScaledVector(direction, clearDistance);
      }
    }

    const lerpFactor = this.snapNext ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt);
    this.snapNext = false;
    this.camera.position.lerp(desiredPos, lerpFactor);

    const lookAt = robot.position.clone().add(new THREE.Vector3(0, LOOK_HEIGHT, 0));
    this.camera.lookAt(lookAt);
    if (this.tilt) this.camera.rotateX(-this.tilt);
  }
}
