# Review notes — 2026-09-29 pass

Every item below is its own commit, newest last, so any one of them can be reverted on its own
without touching the others. `npm run build` passes at every commit.

**The ten tasks**

```
d28cd4e  Freeze each level until the player presses a control key   (pre-existing WIP, not my task)
f04d4fc  Add the DEVOXX letters and dress Room 4 with event branding (tasks 1 + 2)
093a215  Spread the Level 2 knowledge nuggets across the whole floor (task 3)
287951a  Send Level 3 diners to every table, and stop them living on one (task 4)
c803329    ^ fixes 287951a, which only half worked — see "What testing found"
ccd9da0  Make Level 3's hunger bar a pressure you actually watch      (task 5)
3ac2c4a  Give a grown Biggy a visible teeter                          (task 6)
d4e5620  Add the two mid-corridor staircases to Level 2              (task 8)
27363b9  Split sponsorBooths.ts into one module per booth            (task 10)
5ce87c4  Rewrite the README with screenshots and real detail          (task 9)
```

**Bugs found by testing, and fixed**

```
a324712  ?level=3 debug placement dropped the robot on the first floor
395b140  Keep Level 2's attendees out of the new stairwells (a regression d4e5620 introduced)
0154068  Drop three Level 2 hazards that never moved — see below
2cd9d62  Scale Biggy's food reach with his size (4 of 10 slots went unreachable at full size)
7fe6ed8  Make Room 4's stage a real platform you have to jump onto
a323450  Stand the DEVOXX letters on the Room 4 podium
```

**Cleanup**

```
88afba5  Remove dead code: the unused booth banner, a deprecated alias, an unused const
53afea3  Remove the unused door-teleport subsystem
4af574d  Correct the hallway letters' clearance comment with the measured value
b28443b  Fix AGENTS.md where this pass made it wrong
95a0298 / 0e32dda / fbd1c9c   the stream quote — swapped, rewritten, then restored on your call
```

## What testing found

Chrome refused to run the game (its window is hidden, which suspends the
animation loop), so I built a headless harness instead: esbuild bundles the real
`LunchRush` / `KnowledgeRun` for Node against a small DOM stub, and the real
update loop runs at a fixed 60Hz with a stubbed Robot. That found two things I
would otherwise have handed you broken.

**The diner fix (`287951a`) only half worked, and I had to fix it again
(`c803329`).** Simulating 600s and counting which table each sandwich came from:

| | sandwiches taken | from the outer tables | diners left stranded |
| --- | --- | --- | --- |
| before this pass | 117 | 0 (0%) | 0 |
| after `287951a` | 29 | 0 (0%) | 4, stuck up to 579s |
| after `c803329` | 70 | 20 (28.6%) | 0 |

The middle row is the one that matters: my first attempt made things *worse*.
Diners pinned themselves against the Stairs A enclosure — local avoidance
oscillates against a wall, because every wall here is a row of circles and
rounding one presents the next — and because a claimed sandwich stayed reserved
until the diner arrived, four of the fourteen attendees spent the whole run
holding outer-table sandwiches hostage. Committing to one side of a detour for
its duration turns the same rule into wall-following, and timeouts on both the
grab trip and the wander leg stop a failed trip from lasting forever.

The 117 in the first row is not a target to beat: those came from diners grabbing
from where they stood in the queue without walking anywhere, which is the
behaviour you asked me to fix.

**The hunger numbers in my commit message were wrong**, and the comment in
`LunchRush.ts` is now corrected (the correction rode along in `c803329`). The
drain *ramps* while you survive, so the constants are base rates, not
times-to-starve. Measured on a run that never eats: the old tuning emptied the
bar in **61s** (not 85s), the new one empties it in **39s** (not 50s), with the
low warning at 31s. 39s is aggressive — this is the number most worth a second
opinion once you can play it.

**Three more checks, all clean:**

*Nothing the new DEVOXX letter colliders block.* Adding them to the Level 1 and
Level 3 collider lists could have made a pickup unreachable — the same class of
bug as above. All 8 swag pickups, all 10 sandwich slots and both vending
machines are clear of them. The foyer set is only ~6.3m wide on a 26m landing,
so there is plenty of room round either end.

*All 12 Level 2 nuggets* are on walkable floor and not inside any obstacle, and
the Room 4 ones still sit at the intended climb: 4.50 on the apron, then 5.20,
6.60, 8.35, and 10.10 at the back row.

*The teeter scales as intended and is correctly suppressed.* Peak roll while
standing still, by size: 1.0 → 0.00°, 1.4 → 2.3°, 1.8 → 4.7°, 2.2 → 7.0°,
2.6 → 9.6° (about 14° at full size once walking adds TEETER_MOVING_BOOST). A
fallen robot, a toppled one, and any robot that never grew all read exactly 0 —
so Voxxy and Droid are genuinely untouched. What's still unverified is only
whether ~14° *looks* right.

## A pre-existing bug, since fixed

**Three of Level 2's ten attendees spawned outside the map** — fixed in
`0154068`. `HAZARD_START` in `KnowledgeRun.ts` seeded one hazard per
auditorium, but only Room 4 was ever built; the other three entries were
labelled "Room 9", "Room 5's door slot" and "Room 8's door slot" for rooms that
don't exist. Their positions `(6, -24)`, `(-28, -54)` and `(6, -54)` fell
outside every walkable zone, so `getFirstFloorHeightAt` returned 0 and they sat
in the void below the floor.

Measured before touching it: those three **never moved a single centimetre** in
a full 32s round, because every candidate step failed the `isOnFirstFloor`
check and bounced them in place. They were frozen meshes 4.5m under the floor,
outside the walls — invisible, and doing nothing.

So Level 2 has *always* played with seven working hazards, not ten, and this
predates everything else in this pass (verified identical before and after).
Deleting the three changes nothing a player can see. I chose that over
relocating them into the corridor, which would have been a real ~40% difficulty
increase on a level nobody has ever actually played that way — that one is a
design call, and the comment now records where to re-add them if rooms 5, 8 and
9 ever get built.

## Things I decided for you

You were away, so I assumed rather than asked. Each of these is the reversible kind of call — if
one is wrong, revert that commit and tell me which way you wanted it.

**The working tree already had two unrelated half-finished changes in it**, and they didn't build
(a duplicate import and a call to a `text:` option that doesn't exist on the letters prop). One
was the intro-freeze work from an earlier request, the other was the DEVOXX letters. I committed
the intro-freeze on its own first (`d28cd4e`) so your task commits stay cleanly revertible, then
finished the letters. The letter colliders were also built but never consumed by anything — the
set was walk-through scenery. They're wired into all three collider lists now.

**Level 2 quotes went from a 5 hall / 7 Room 4 split to 7 / 5.** Room 4's seven all sat inside a
2.8m-wide column, which looks like the obvious thing to spread — but that column is the central
aisle, and everything either side of it is seating, so a nugget out there could only be collected
by walking through chairs. So I thinned Room 4 rather than widening it, and used the corridor's
own unused length instead: it runs z -139..41 but had nothing at all between z -25 and -85. The
deepest Room 4 nugget is still the back row, 16 jumps in.

**Level 3 diners now fetch three at a time, not one.** The old "a real queue serves one person at
a time" rule was half the reason the outer tables were safe. The line still reads as a line, but
it has visible gaps in it now while people are away at the buffet. If that looks wrong, the knob
is `MAX_CONCURRENT_GRABBERS` in `LunchRush.ts`.

**Hunger drain roughly 1.5x faster**: base rate 85s → 50s, late-run cap 40s → 25s, ramp 90s → 70s.
Because the drain ramps, what that actually means is a full bar emptying in **39s instead of 61s**
— measured, see "What testing found" above. Per-sandwich restore is unchanged. This is the one
number most likely to need another pass; it's a feel thing.

**Biggy's teeter maxes at about 14° of roll** at full size, zero at normal size. Amplitude is
`TEETER_MAX_AMPLITUDE` in `Robot.ts`. Guessed — see below.

**The two new staircases are walkable, and end at a closed door.** You said placeholder, not a
real floor link, so neither has a `DOOR_LINKS` teleport. I made them genuinely walkable anyway,
because that's what Stair C at the far end already does and nothing stops a player walking up to a
visible opening. They drop one flight (3m) to a landing at y=1.5 and stop at the same closed
double door the building's other stairwells use — same as Stair C, which also doesn't reach y=0.
They sit at z=-39, clear of Room 4's frontage and midway between the door props at -24 and -54.
`CinematicHallway` grew a `clearZones` option so the furniture row and the fabric pillars don't
stand in front of either opening.

**`createBoothBanner` is dead code.** Nothing in the game calls it, and nothing did before the
split either — the 1622-line file just hid it. I left it in `booths/shared.ts` with a note rather
than deleting ~100 lines of working prop you might still want. Say the word and it goes.

## Please look at these yourself

I could not run the game properly. Chrome's animation loop is suspended while its window is in the
background, so the game only advances about one frame per screenshot — enough to check static
geometry, not enough to play anything. Everything below is therefore built and reasoned about but
**not** seen in motion:

- [ ] **Biggy's teeter (task 6).** The maths is now verified (see above) — it scales smoothly to
      about 14° at full size and is correctly off for Voxxy, Droid and a downed Biggy. What no
      test can tell me is whether that *reads* as "barely standing" or as seasick. Eat a few
      sandwiches and say which way to push `TEETER_MAX_AMPLITUDE`.
- [ ] **The Level 3 crowd (task 4).** Now measured rather than guessed (see above), but measured
      with Biggy parked and invincible — never *watched*. Whether a busy buffet reads well, and
      whether diners visibly walk sensible routes, still needs eyes.
- [ ] **Hunger pacing (task 5).** 39s from full to empty if you never eat. Pure feel, and the
      number I'd most expect you to want changed.
- [ ] **That attendees no longer using the stairwells is what you want.** Making the stairs
      walkable also made them walkable for hazards, and one run in six lost a hazard down one
      permanently. They're now excluded (`395b140`). If you'd rather see attendees heading down
      the stairs as scenery, that's doable — it just needs them to come back up.
- [ ] **How the two new staircases look.** Their *geometry* I did verify, by standing on them and
      reading back the height the game gives: 1m in → 4.25, 2m → 4.00, 6m → 3.00, 8m → 2.75, and
      1.50 on the landing, on both flights, all exactly matching the step formula. But I never got
      a clean look down one — they're dark, and I added lights down the run partly on that basis.
- [ ] **The Level 3 README screenshot** shows the opening moment, so the tables are bare and there
      is no crowd. If you grab a better one mid-run, drop it at
      `docs/screenshots/level3-lunch-rush.jpg` and the README picks it up.

## Small thing I added

The localhost debug readout now shows `y` as well as x/z/heading. It's what made the staircase
heights checkable at all, and it's what turned up the `?level=3` spawn bug (`a324712`) — Biggy was
being placed on the *first* floor, floating 4.5m above the lunch hall, because the debug code read
"level 1 is downstairs, everything else is upstairs" and Level 3 is downstairs too.
