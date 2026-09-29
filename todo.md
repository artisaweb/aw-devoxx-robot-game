# Review notes — 2026-09-29 pass

Every item below is its own commit, newest last, so any one of them can be reverted on its own
without touching the others. `npm run build` passes at every commit.

```
d28cd4e  Freeze each level until the player presses a control key   (pre-existing WIP, not my task)
f04d4fc  Add the DEVOXX letters and dress Room 4 with event branding (tasks 1 + 2)
093a215  Spread the Level 2 knowledge nuggets across the whole floor (task 3)
287951a  Send Level 3 diners to every table, and stop them living on one (task 4)
ccd9da0  Make Level 3's hunger bar a pressure you actually watch      (task 5)
3ac2c4a  Give a grown Biggy a visible teeter                          (task 6)
d4e5620  Add the two mid-corridor staircases to Level 2              (task 8)
27363b9  Split sponsorBooths.ts into one module per booth            (task 10)
a324712  Fix ?level=3 debug placement dropping the robot on the first floor (found on the way)
5ce87c4  Rewrite the README with screenshots and real detail          (task 9)
```

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

**Hunger drain: 85s → 50s to starve from full**, late-run cap 40s → 25s, ramp 90s → 70s. Per
sandwich restore is unchanged, so "about four sandwiches keeps me topped up" still holds. This is
the one number most likely to need another pass — it's a feel thing, and I couldn't play-test it
(see below).

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

- [ ] **Biggy's teeter (task 6).** Needs a grown Biggy and actual animation; I saw neither. The
      amplitude is a guess. Eat a few sandwiches and tell me if it's too subtle or too seasick.
- [ ] **The Level 3 crowd (task 4).** The avoidance steering, the spread across all six tables and
      the post-grab wandering are all unobserved in motion. Worth a full run.
- [ ] **Hunger pacing (task 5).** Pure feel.
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
