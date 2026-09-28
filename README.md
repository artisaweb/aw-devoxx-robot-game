# A Day at Devoxx

A browser-based 3D game entry for Devoxx Belgium's "Robot Games" competition.

## Run it

```
npm install
npm run dev
```

Open the local URL Vite prints. Controls: `W`/`A`/`S`/`D` or arrow keys to walk around, Shift to boost, Space to jump.

## Status

Three sequential single-robot levels, all playable:

1. **Voxxy — Swag Run** (ground floor - exhibition hall): collect swag against a countdown; wandering attendees splash you, briefly stunning you and stealing your last swag.
2. **Droid — Knowledge Run** (first floor): collect one-line "conference wisdom" nuggets. Watch out — eager seat-grabbers can run into you.
3. **Biggy — Lunch Rush** (ground floor - exhibition hall): no timer, an endless high-score chaser. Every sandwich eaten makes Biggy permanently bigger, slower, and harder to turn; colliding with an attendee is a recoverable stumble early on, but a permanent fall once he's grown enough. The queueing crowd itself gets more dangerous over a long run — getting close, or eating a sandwich right next to someone, can make them break off and chase.

## Tech stack

Vite + TypeScript + Three.js, client-only (no backend). Vibecoded the entire game with GenAI.

## License

The source code in this repository is [MIT licensed](./LICENSE). The 3D robot model assets (`public/models/*.glb`) are AI-generated.