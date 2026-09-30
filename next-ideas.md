# Next ideas

Unbuilt ideas, grouped by area, each with enough context to pick back up without re-reading the
brainstorm history. Roughly in the order we'd build them.

## Atmosphere

- **Ambience.** There is no music and no room tone: no crowd murmur in the exhibition hall, no
  muffled talk bleeding out of Room 4's doors, no hum in the empty deep end of the corridor.
  Every sound in the game is a one-shot event. A continuous bed would do more for "you are at a
  conference" than any further prop.
- **The other seven auditoriums.** Room 4 is the only one with a real interior; 3, 5, 6, 7, 8, 9
  and 10 are closed doors with nothing behind them. Opening even one more would want its own
  reason to go in, not just a second copy of the same seating.

## Ground-floor layout: walkability and narrow-gap evasion

Two related ideas, really the same design at different scopes:

- **Narrow-gap evasion:** gaps small enough for the player but awkward for a hazard's simple
  wall-bounce steering. A level-design mechanic that currently only exists by accident in a few
  booth clusters.
- **The floor reads as empty:** the booths sit along the sides as solid blocks (you can't walk
  through them) around a big blank middle.

One options menu covers both, since carving real gaps *through* a booth cluster is the concrete
version of the narrow-gap idea:

- **Option A (recommended first):** split each booth's prop cluster (currently one solid collider
  group, via `getBoothColliders()`) into two or three smaller collider islands with real walkable
  gaps, sized for the player but tight for a hazard. Lowest risk: it reshapes colliders in place,
  moves nothing, and directly answers "not walkable".
- **Option B:** pull one or two booths into the empty middle. Answers the blank middle directly,
  but booth positions are referenced from several systems (Level 1's `SWAG_ITEM_DEFS` pickup
  positions, hazard wander waypoints, the collider lists in `Game.ts`, minimap markers) that would
  all need re-verifying. A coordinated multi-file move, easy to get subtly wrong.
- **Option C:** add small new props to the middle of the floor (benches, sign stands), leaving all
  seven booths untouched. Lowest risk to existing reachability and collision, but it only
  addresses the empty middle, not walking through the booths.

Recommendation: A first, then reassess whether the middle still reads as empty before trying B
or C.

## Swag with a purpose

Every booth has its own signature swag item (crown, key, sunglasses, cap, drone, sticker, shirt),
but swag is still cosmetic: a point and a worn accessory, no gameplay effect.

Open decisions if this gets picked up:

- Whether swag types get gameplay effects at all, or stay cosmetic.
- If any effect ships: whether an attendee wearing a stolen item gains it too (so the crowd slowly
  arms itself with what you dropped), and whether the drone, which isn't obviously "worn", can be
  stolen at all.

## Level 2 (Knowledge Run): make a jump a dodge

In Level 1 an attendee only hits Voxxy when they're at the same height, so a well-timed jump
clears them. Level 2 has no such check: an attendee can topple Droid mid-jump. Giving Droid the
same rule would make the jump, which already costs energy on every seating row, a real escape
from a chase as well.

## Level 3 (Lunch Rush): a rare escape pickup

*Lower conviction: only worth building if playtesting says the endless mode gets too punishing
once the crowd is chasing in earnest.*

A rare pickup that gives Biggy a brief, one-time way out of a chase. Three options were
brainstormed:

- **"Second Wind" energy drink (recommended):** a rare extra pickup on the buffet, as scarce as
  the crab sandwich, that for four or five seconds halves the movement penalty of Biggy's size
  rather than removing it, so he still reads as Biggy, just briefly less sluggish. Cheapest to
  build: the movement code already divides by `sizeScale` (see `grow()`), so it's a temporary
  multiplier on top.
- **A one-time sidestep dash:** a short fixed-distance hop sideways, independent of
  `currentSpeed` and momentum. A genuinely different skill rather than a stat buff, but it needs
  a new movement path that bypasses the normal acceleration code.
- **A temporary chase-immunity bubble:** the weakest fit. It removes the challenge instead of
  giving the player something to *do*, unlike every other pickup in the game.
