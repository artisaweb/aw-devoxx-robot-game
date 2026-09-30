# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

"A Day at Devoxx" — a browser-based 3D game entry for Devoxx Belgium's "Robot Games" competition (see `private/spec/rules.md` for the full rules; deadline **2026-09-30 23:59 CEST**). Three sequential single-robot levels set in Kinepolis Antwerp:

1. **Voxxy — Swag Run** (ground floor / exhibition hall): timed swag collection.
2. **Droid — Knowledge Run** (first floor): timed quote collection, with jump-gated auditorium seating rows.
3. **Biggy — Lunch Rush** (ground floor, redressed for lunchtime): endless/high-score mode — no timer, ends permanently when Biggy falls.

Stack: Vite + TypeScript + Three.js, client-only — no backend, no framework. Entirely vibecoded.

## Commands

```
npm install
npm run dev       # Vite dev server
npm run build     # tsc -b (typecheck) && vite build — this IS the type check; there's no separate lint/typecheck script
npm run preview   # serve the production build locally
```

No test suite and no lint config exist in this repo — `npm run build` (via `tsc -b`, `strict: true`) is the only automated correctness check.

`tools/gen_sfx.py` regenerates `public/audio/*.wav` procedurally (oscillators/noise, no samples) — run with `python3 tools/gen_sfx.py` (needs only `numpy`) if a sound needs tuning.

## Architecture

### One Robot instance, three levels, one Game orchestrator

`src/core/Game.ts` is the composition root. A single `Robot` (`src/entities/Robot.ts`) persists across all three levels rather than being recreated — level transitions (`advanceToLevel2`/`advanceToLevel3`/`restartDay`) call `robot.setRobotModel(id)` to swap the GLTF model/rig/clips and `robot.setMap(floor, spawn)` to reset movement state and relocate it. Each level is its own gameplay engine class (`SwagRun`, `KnowledgeRun`, `LunchRush` in `src/gameplay/`) with its own `.group` added/removed from the scene and its own `.update(dt, robot, colliders, ...)` called from `Game.tick()`; only one is active at a time. Level 3 has a structurally different shape (no timer, no `finished`-then-advance — it just runs until `lunchRun.finished`, set when Biggy's hunger hits zero or he falls), so don't assume all three engines share an identical `update()` contract.

Debug entry points (gated to `isLocalHost()`, see `src/util/env.ts` — ignored on any hosted build): `?level=2` / `?level=3` jump straight to a level by chaining the real transitions (so skipped levels honestly score 0), and `?x=&z=&heading=` drops the robot at an exact spot for reproducing a bug report.

### Two floors, joined by a closed door, not visible geometry

`Floor = 'ground' | 'first'` (`src/scene/ExhibitionHall.ts`). The two levels' maps are not architecturally connected — the real venue's stairwell between them is behind closed doors the player never sees, so the floors are joined by a closed door rather than modelled connecting geometry. This means they can have entirely separate visual identities and don't need to line up spatially.

Nothing teleports the player between floors: the level transitions do it, via `Game.ts`'s `advanceToLevel2()`/`advanceToLevel3()`, which call `robot.setMap(floor, spawn)` and swap which floor group is visible. A `DoorLink`/`findDoorTeleport` mechanism existed but was never called and was removed (2026-09-29). Every visible stair and door in the game — the ground-floor enclosures, Stair C at the corridor's far end, the two mid-corridor stairwells — is real geometry that dead-ends at a closed door. When adding anything level-transition-related, change the transition in `Game.ts`; don't reach for a ramp, a connecting corridor, or a teleport trigger.

### Collision: `Collider[]`, clearance derived from the mover

`Collider` (`x, z, radius`, optional `height`, optional `robotOnly`) is the shared primitive for both floors and all three levels' hazards. Two rules hold everywhere in this system:

- **Clearance is a property of the mover, not the wall.** `MOVER_CLEARANCE` (`ExhibitionHall.ts`) / `WALL_CLEARANCE` (`Robot.ts`, re-exported from the same constant) is how far *any* character's body/limbs extend past its logical position; both floors' collision and every interactive object's trigger radius read from this one constant rather than guessing per-wall or per-object numbers. Biggy's clearance additionally scales with `growthScale` as he grows (`colliderReach()` in `Robot.ts`).
- **The ground floor has a real outer bounding box** (`HALL_WIDTH`/`HALL_DEPTH` clamps in `Robot.tryMove()`). **The first floor does not** — each room's walls are the only boundary, enforced by checking the destination against `isOnFirstFloor()` zone membership directly, not by inferring bounds from whatever zone the mover is currently in (that misclassifies right at a shared wall between two rooms).

`height` on a `Collider` makes it only block at or below that y (a booth desk's sides, not its top once you've jumped up); `robotOnly` colliders (Room 4's row walls) apply to the player's own movement but are stripped out before being passed to a level's hazard-update loop (see `firstFloorHazardColliders` in `Game.ts`) — hazards climb every row freely, the robot must jump each one.

Sponsor booths live one-per-file in `src/scene/booths/` over a shared `shared.ts` (material shorthand, the rotate-into-place pair, the name-sign texture). `sponsorBooths.ts` stays the entry point: it keeps `getBoothColliders`, `createSponsorBooths` and the beer tap, and re-exports `KING_KIOSK_POS`.

### Text content lives in `src/text/`, not inline in gameplay code

Dialogue, HUD copy, knowledge quotes, robot toasts, and signage each have their own file in `src/text/` and are imported by the gameplay/UI code that displays them. When editing jokes, toasts, or any player-facing copy, edit these files, not the engine files that call them.

### Procedural props vs. GLTF models

`src/props/*.js` (+ hand-written `.d.ts` companions) are procedurally-generated Three.js geometry (beer tap, vending/candy machines, event furniture, sandwiches, the DEVOXX letters, the charging dock, and the four walk-into contact props: rubber duck, recycling bins, talk-rating kiosk, wet-floor sign) — no external model files. `public/models/*.glb` are the three robots' real rigged models/animation clips (AI-generated, loaded via `voxxyModel.ts`'s `loadRobotAsset`). A `Sprite` added to `groundFloorGroup` or `sponsorBoothsGroup` must set `raycast = () => {}` — `FollowCamera`'s occlusion raycast against those groups otherwise hits the sprite and blacks out the screen.

### `private/` is local-only, not part of the repo

`private/` is entirely gitignored (`git ls-files` shows zero tracked files under it). It holds design specs (`private/spec/*.md` — game design, competition rules, brainstorm/GenAI logs, asset pipeline notes), reference photos/videos of the real venue, and AI-prototype HTML playgrounds — useful context for *why* something looks the way it does, but none of it ships in the actual submission. Before building venue geometry or a robot likeness from scratch, check the relevant files under `private/assets/reference/` directly (view the images) rather than inferring from filenames or code comments.

## Competition constraints worth knowing before making design calls

- Must keep all three robots essential and visually distinct (Voxxy quick/light, Droid tall/deliberate, Biggy heavy/slow) — this is a scored criterion, not flavor text.
- Must not reuse the competition's own reference robot model assets.
- Scoring weights originality (40/100) and realism/"building behaves like a building" (20/100) highest — favor plausible physics/weight and a distinctive concept over generic reuse when in doubt.
