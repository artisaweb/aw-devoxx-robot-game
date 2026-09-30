import { createCoffeeVendingMachine as createCoffeeVendingMachineAsset, CoffeeVendingMachine } from '../props/coffeeVendingMachine';
import { createCandyGrabbingMachine as createCandyGrabbingMachineAsset, CandyGrabbingMachine } from '../props/candyGrabbingMachine';

// Half-width of the kiosk body (1.1 wide) — Game.ts registers it as each
// kiosk's collider, so kiosks are solid obstacles instead of walk-through
// props. The mover's own clearance (WALL_CLEARANCE, see Robot.ts) is added on
// top of it by the push-out, which is why SwagRun.ts/LunchRush.ts size their
// touch radii as this plus WALL_CLEARANCE.
export const KIOSK_COLLIDER_RADIUS = 0.55;

export type { CoffeeVendingMachine };

/**
 * The exhibition hall's coffee corner. Restores energy (see SwagRun.ts/
 * LunchRush.ts). Built from the standalone `coffeeVendingMachine.js`
 * generator (see `src/props/`) — a real animated model, not a simple
 * box-with-a-label shape: callers get `.activate()` (plays a ~10s brew
 * animation — fire-and-forget, don't gate the actual energy-restore on its
 * Promise resolving, since the gameplay cooldown is much shorter than the
 * animation), `.setOutOfStock(bool)`, and `.update(dt)` (must be called
 * every frame).
 */
export function createVendingMachine(): CoffeeVendingMachine {
  return createCoffeeVendingMachineAsset();
}

export type { CandyGrabbingMachine };

/**
 * KING's "free candy" machine, per the sponsor-booths brainstorm — built
 * from the standalone `candyGrabbingMachine.js` generator (see
 * `src/props/`), a claw machine rather than a dispenser slot. Its cabinet
 * was recolored to KING's own orange directly in that file (see its own
 * comment) rather than the generator's default pink. Same richer API as
 * `createVendingMachine()` above — see that function's own comment for the
 * activate()/setOutOfStock()/update() usage notes, identical here.
 */
export function createCandyMachine(): CandyGrabbingMachine {
  return createCandyGrabbingMachineAsset();
}

