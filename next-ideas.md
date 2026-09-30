# Next ideas

Unbuilt idea-box items grouped by area, each with enough context to pick back up later without
re-reading the full brainstorm history.

## Level 3 (Lunch Rush) — a rare escape-tool pickup

*Lower conviction — only worth building if playtesting says the endless mode
gets too punishing once the crowd-chase mechanic is in full swing.*

A rare pickup that gives Biggy a brief one-time way out of a chase. Three
options were brainstormed, not built:

- **"Second Wind" energy drink** (recommended) — a rare 7th buffet-adjacent
  pickup, low spawn chance like the crab sandwich, that for ~4-5s halves
  `sizeScale`'s movement penalty rather than removing it (still reads as
  "Biggy," just briefly less sluggish). Cheapest to build: reuses `grow()`'s
  existing division-by-`sizeScale` movement math with a temporary multiplier
  layered on top.
- **A one-time "sidestep" dash** — a short fixed-distance lateral hop,
  independent of `currentSpeed`/momentum. Reads as a genuinely different
  skill tool rather than a stat buff, but costs more to build (a new movement
  path bypassing normal accel/momentum code).
- **Temporary chase-immunity bubble** — weakest fit. Removes the challenge
  rather than giving the player something to *do*, unlike every other pickup
  in the game.

Recommendation if built: Second Wind, since it reuses the most existing
plumbing and is the most honest reading of "agility window" for a robot
whose whole identity is size/slowness.

## Swag/booth coupling — gameplay effects

Every booth has its own signature swag item now (crown, key, sunglasses,
cap, drone, sticker, shirt), but swag is still purely cosmetic (score + a worn accessory, no gameplay effect). 

Two open decisions if this gets picked up:
- Whether to give swag types actual gameplay effects at all, or leave them
  cosmetic — see `swagAccessories.md`'s "Effects on Voxxy" section for the
  options menu (not decided).
- If any effect ships: whether a hazard wearing a stolen item also gains the
  effect, and whether the drone (not obviously "worn") is even stealable.

## Ground-floor layout — walkability / narrow-gap hazard evasion

Two related ideas, actually the same design applied at different scopes:

- **Narrow-gap hazard evasion** (`sponsor-booths.md`): gaps small enough for
  the player but awkward for a hazard's simple wall-bounce steering — a
  level-design mechanic that currently only exists by accident in a few
  booth clusters.
- **Ground floor reads as boring/empty**: booths sit on the sides as solid
  blocks (not really walkable — seen as one whole) with a big blank middle.

Same options menu covers both, since carving real gaps *through* a booth
cluster is the concrete version of the narrow-gap idea:

- **Option A (recommended first)** — carve real gaps through each booth
  cluster: turn each booth's prop cluster (currently one solid collider group
  via `getBoothColliders()`) into 2-3 smaller collider islands with real
  walkable gaps, sized for the player but tight for a hazard. Lowest risk —
  reshapes colliders in place, doesn't move anything, directly answers "not
  walkable."
- **Option B** — pull 1-2 booths into the empty middle. Directly answers the
  blank-middle complaint, but booth positions are referenced from multiple
  systems (Level 1's `SWAG_ITEM_DEFS` pickup positions, hazard wander
  waypoints, `Game.ts` collider lists, minimap markers) that would all need
  re-verifying — a coordinated multi-file move, easy to get subtly wrong.
- **Option C** — add small new center-floor props (benches, sign stands)
  purely to break up the middle, leaving all 7 booths untouched. Lowest risk
  to existing reachability/collision math, but only addresses the empty
  middle, not booth walkability.

Recommendation: Option A first (cheapest, directly answers the walkability
complaint, zero risk to existing pickup/waypoint positions), then reassess
whether the middle still reads as empty before attempting B or C.

## Visual polish

- **Ambience.** There is no music and no room tone — no crowd murmur in the
  exhibition hall, no muffled talk bleeding out of Room 4's doors, no hum in
  the empty deep end of the corridor. Every sound in the game is a one-shot
  event. A continuous bed would do more for "you are at a conference" than any
  further prop.
- **The other seven auditoriums.** Room 4 is the only one with a real
  interior; 3, 5, 6, 7, 8, 9 and 10 are closed doors with nothing behind them.
  Opening even one more would want its own reason to go in, not just a second
  copy of the same seating.
