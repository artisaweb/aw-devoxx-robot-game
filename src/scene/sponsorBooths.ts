import * as THREE from 'three';
import { Collider, BOOTH_PLATFORM_ZONES } from './ExhibitionHall';
import { createBeerTap as createBeerTapAsset, BeerTap } from '../props/beerTap';
import { rotateBooth, rotateCollider } from './booths/shared';
import { ROCKETMIND_ROTATION, ROCKETMIND_ROCKET_POS, createRocketMindBooth } from './booths/rocketMind';
import { GOGGLES_ROTATION, createGogglesCloudBooth } from './booths/gogglesCloud';
import { KING_KIOSK_POS, KING_LION_POS, KING_ROTATION, createKINGBooth } from './booths/king';
import {
  VAULTIUS_VAULT_POS,
  VAULTIUS_ROTATION,
  VAULTIUS_KEY_COUNTER_POS,
  VAULTIUS_KIOSK_POS,
  VAULTIUS_SHELF_POS,
  createVaultiusBooth,
} from './booths/vaultius';
import { MIRACLE_CAR_POS, MIRACLE_ROTATION, createMiracleSystemsBooth } from './booths/miracleSystems';
import { TINY_CENTER, TINY_ROTATION, createTinyBooth } from './booths/tinyReach';
import { OMNIWARE_POS, OMNIWARE_ROTATION, OMNIWARE_GHOST_OFFSET, createOmniWareBooth } from './booths/omniWare';

// Re-exported from its own booth module so the many existing importers of
// this path (Game.ts, SwagRun.ts) don't all have to move — this file stays
// the sponsor-booth entry point, it just no longer holds every booth's
// geometry.
export { KING_KIOSK_POS };


// Seven sponsor-booth set pieces —
// original stylized props referencing each sponsor by name/product, not their
// actual logos/trademarks (same "wink for people who recognize it, never a
// reproduction" policy as the NPCs). Two (RocketMind, Goggles Cloud) are the jumpable furniture
// from BOOTH_PLATFORM_ZONES in ExhibitionHall.ts — that file is the single
// source of truth for their footprint/height, this module just places
// matching visuals. The other five are solid ground-level landmarks with
// colliders from getBoothColliders(), which both the player (Game.ts) and
// hazards (SwagRun.ts) route around. KING's interactive candy kiosk itself is
// built by SwagRun.ts (mirrors the JAVA machine's per-frame cooldown logic) —
// this module only places its statue landmark; KING_KIOSK_POS is exported so
// the two sit next to each other without overlapping.
//
// Layout is spread across the open floor, mostly in two vertical columns
// (x ≈ -30 and x ≈ 30, KING a little further out at 37-40) running the depth
// of the hall, with Vaultius and the beer tap standing in nearer the middle at
// x ≈ -10 and x ≈ 10 — matching a real expo hall (kiosks scattered among the crowd, not
// backed against a wall) rather than lining the walls. Deliberately clear of
// the center lane (x ≈ 0), which is where COFFEE_MACHINE_POS (SwagRun.ts)
// already sits — columns leave it standing clear, which also happens to
// roughly match its real-world spot.
//
// x≈±30 sits midway between two of the column grid's lines (COLUMN_SPACING=10,
// columns at x=±5/±15/±25/±35) — see BOOTH_PLATFORM_ZONES's own comment in
// ExhibitionHall.ts for why the booths moved out here after the 1.5x hall
// resize — with a comfortable buffer to the outer wall (HALL_WIDTH/2 -
// MOVER_CLEARANCE = 43.8) — wide enough for each booth's own internal gaps to
// work as a real hazard-evasion mechanic, not just a pickup-reachability
// afterthought.

// A standalone beer-tap stand — not tied to any of the 7 sponsor booths.
// The user: real Devoxx has both a sponsor booth that gives away beer every
// year AND an evening where the conference itself taps beer — this is a
// generic stand-in for either, not a specific sponsor, matching this
// project's own "a wink, not a reproduction" policy for real brands/venue
// details. Placed in open floor clear of the
// column grid, both stair enclosures, and every other booth/table.
export const BEER_TAP_POS: [number, number] = [10, 15];
// Built from the standalone beerTap.js generator (src/props/) — a full bar
// setup on a 4.0x3.4m deck (counter, tap, two kegs, three stools, two high
// tables with two stools each), not the small counter+kegs+tap-tower stand
// this used to hand-build. Collider radius recomputed for the new
// footprint via the same diagonal-half-extent approximation every other
// boxy prop in this file already uses: hypot(2.0, 1.7) ≈ 2.63 (was 1.3).
// Exported so SwagRun.ts/LunchRush.ts can derive their own touch radius from
// it (same reachability requirement as every kiosk — see COFFEE_RADIUS's own
// comment in SwagRun.ts) instead of guessing a separate number.
export const BEER_TAP_COLLIDER_RADIUS = 2.63;

/**
 * Ground-level solid obstacles the player and hazards both push out against.
 *
 * Every booth below rotates 90° in place (rotateBooth in createSponsorBooths)
 * so its front faces sideways into the aisle instead of up/down the hall —
 * these colliders have to go through the exact same rotateCollider(pivot,
 * angle) to stay lined up with what's actually rendered. Each booth also
 * gets 1-2 small colliders across its own backdrop panel — those panels are
 * built deliberately uncollided, so without these a
 * player could walk straight through the "wall" behind any of them from the
 * far side. The wallClearance ground-floor movement already adds (1.2, from
 * MOVER_CLEARANCE) around any small collider is plenty to block a thin
 * panel, so these are tiny "core" radii, not full wall-sized ones.
 */
export function getBoothColliders(): Collider[] {
  const colliders: Collider[] = [];

  const rotated = (raw: Collider[], rot: { cx: number; cz: number; angle: number }) =>
    raw.forEach((c) => colliders.push(rotateCollider(c, rot.cx, rot.cz, rot.angle)));

  // Backdrop wall z-offsets below are written relative to each booth's own
  // anchor constant (never a bare number), so moving a booth can't silently
  // leave a stale absolute coordinate behind; each expression mirrors the
  // exact backdropZ formula used in that booth's own create*Booth() function.
  //
  // Each backdrop is covered by exactly TWO small colliders straddling its
  // center, relying on MOVER_CLEARANCE to bridge the gap between them — that
  // only works if each collider's own offset from center is no more than
  // (radius + MOVER_CLEARANCE), so their clearance zones actually overlap in
  // the middle. A wider offset leaves an uncovered strip walkable straight
  // through the panel's own center.
  rotated(
    [
      { x: ROCKETMIND_ROCKET_POS[0], z: ROCKETMIND_ROCKET_POS[1], radius: 0.4 },
      { x: BOOTH_PLATFORM_ZONES[0].x - 1.2, z: BOOTH_PLATFORM_ZONES[0].z - BOOTH_PLATFORM_ZONES[0].halfD - 1.1, radius: 0.2 },
      { x: BOOTH_PLATFORM_ZONES[0].x + 1.2, z: BOOTH_PLATFORM_ZONES[0].z - BOOTH_PLATFORM_ZONES[0].halfD - 1.1, radius: 0.2 },
    ],
    ROCKETMIND_ROTATION,
  );
  rotated(
    [
      { x: BOOTH_PLATFORM_ZONES[1].x - 1.2, z: BOOTH_PLATFORM_ZONES[1].z - BOOTH_PLATFORM_ZONES[1].halfD - 1.1, radius: 0.2 },
      { x: BOOTH_PLATFORM_ZONES[1].x + 1.2, z: BOOTH_PLATFORM_ZONES[1].z - BOOTH_PLATFORM_ZONES[1].halfD - 1.1, radius: 0.2 },
    ],
    GOGGLES_ROTATION,
  );
  rotated(
    [
      { x: KING_LION_POS[0], z: KING_LION_POS[1], radius: 0.7 },
      { x: KING_LION_POS[0] - 1.0, z: KING_LION_POS[1] - 1.5, radius: 0.2 },
      { x: KING_LION_POS[0] + 1.0, z: KING_LION_POS[1] - 1.5, radius: 0.2 },
    ],
    KING_ROTATION,
  );
  rotated(
    [
      { x: VAULTIUS_VAULT_POS[0], z: VAULTIUS_VAULT_POS[1], radius: 1.5 },
      { x: VAULTIUS_KEY_COUNTER_POS[0], z: VAULTIUS_KEY_COUNTER_POS[1], radius: 0.5 },
      { x: VAULTIUS_KIOSK_POS[0], z: VAULTIUS_KIOSK_POS[1], radius: 0.35 },
      { x: VAULTIUS_SHELF_POS[0], z: VAULTIUS_SHELF_POS[1], radius: 0.45 },
      { x: VAULTIUS_VAULT_POS[0] - 0.8, z: VAULTIUS_VAULT_POS[1] - 1.8, radius: 0.2 },
      { x: VAULTIUS_VAULT_POS[0] + 0.8, z: VAULTIUS_VAULT_POS[1] - 1.8, radius: 0.2 },
    ],
    VAULTIUS_ROTATION,
  );
  rotated(
    [
      { x: MIRACLE_CAR_POS[0], z: MIRACLE_CAR_POS[1], radius: 2.0 }, // bigger turntable stage now
      { x: MIRACLE_CAR_POS[0] - 1.1, z: MIRACLE_CAR_POS[1] - 2.6, radius: 0.2 },
      { x: MIRACLE_CAR_POS[0] + 1.1, z: MIRACLE_CAR_POS[1] - 2.6, radius: 0.2 },
    ],
    MIRACLE_ROTATION,
  );
  rotated(
    [
      // Screen is 4.6 wide (halfW 2.3); wall-collider radius 0.4 (reach 1.6)
      // so the two colliders' clearance zones overlap by a full 1.0m in the
      // middle and reach 0.3m past each physical edge. This wall's reach
      // also constrains the counter+stool cluster's own gap from it — see
      // createTinyBooth for the matching mesh position.
      { x: TINY_CENTER[0], z: TINY_CENTER[1] + 2.1, radius: 0.55 }, // Tiny's counter + stool
      { x: TINY_CENTER[0] - 1.1, z: TINY_CENTER[1] - 1.2, radius: 0.4 },
      { x: TINY_CENTER[0] + 1.1, z: TINY_CENTER[1] - 1.2, radius: 0.4 },
    ],
    TINY_ROTATION,
  );
  rotated(
    [
      // Three separate colliders (not one shared blob) so the visible gaps
      // between the real rack and each ghost are actually walkable.
      { x: OMNIWARE_POS[0], z: OMNIWARE_POS[1] - 0.2, radius: 0.5 }, // real rack
      { x: OMNIWARE_POS[0] - OMNIWARE_GHOST_OFFSET, z: OMNIWARE_POS[1] + 0.2, radius: 0.45 }, // ghost left
      { x: OMNIWARE_POS[0] + OMNIWARE_GHOST_OFFSET, z: OMNIWARE_POS[1] + 0.2, radius: 0.45 }, // ghost right
      { x: OMNIWARE_POS[0] - 1.0, z: OMNIWARE_POS[1] - 1.9, radius: 0.2 },
      { x: OMNIWARE_POS[0] + 1.0, z: OMNIWARE_POS[1] - 1.9, radius: 0.2 },
    ],
    OMNIWARE_ROTATION,
  );

  // Beer-tap stand — standalone, not rotated (it doesn't back onto an aisle wall like the booths above).
  colliders.push({ x: BEER_TAP_POS[0], z: BEER_TAP_POS[1], radius: BEER_TAP_COLLIDER_RADIUS });

  return colliders;
}

export interface SponsorBoothsScene {
  readonly group: THREE.Object3D;
  /** Shared with Level 1 (SwagRun.ts) and Level 3 (LunchRush.ts) — Game.ts owns calling `.update(dt)` on this every frame and passing it into each level's own touch-trigger logic. */
  readonly beerTap: BeerTap;
}

export function createSponsorBooths(): SponsorBoothsScene {
  const group = new THREE.Group();
  group.add(rotateBooth(createRocketMindBooth(), ROCKETMIND_ROTATION.cx, ROCKETMIND_ROTATION.cz, ROCKETMIND_ROTATION.angle));
  group.add(rotateBooth(createGogglesCloudBooth(), GOGGLES_ROTATION.cx, GOGGLES_ROTATION.cz, GOGGLES_ROTATION.angle));
  group.add(rotateBooth(createKINGBooth(), KING_ROTATION.cx, KING_ROTATION.cz, KING_ROTATION.angle));
  group.add(rotateBooth(createVaultiusBooth(), VAULTIUS_ROTATION.cx, VAULTIUS_ROTATION.cz, VAULTIUS_ROTATION.angle));
  group.add(rotateBooth(createMiracleSystemsBooth(), MIRACLE_ROTATION.cx, MIRACLE_ROTATION.cz, MIRACLE_ROTATION.angle));
  group.add(rotateBooth(createTinyBooth(), TINY_ROTATION.cx, TINY_ROTATION.cz, TINY_ROTATION.angle));
  group.add(rotateBooth(createOmniWareBooth(), OMNIWARE_ROTATION.cx, OMNIWARE_ROTATION.cz, OMNIWARE_ROTATION.angle));

  const beerTap = createBeerTapAsset();
  beerTap.object.position.set(BEER_TAP_POS[0], 0, BEER_TAP_POS[1]);
  group.add(beerTap.object);

  return { group, beerTap };
}
