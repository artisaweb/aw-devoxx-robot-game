import {
  LEVEL_COPY,
  ENERGY_LABEL,
  HUNGER_LABEL,
  scoreLabel,
  timeRemainingLabel,
  survivedLabel,
  LEVEL_INTROS,
  INTRO_START_HINT,
  fellMessageFallback,
  allCollectedMessage,
  timeUpMessage,
  DAY_END_TITLE,
  DAY_END_ROW_LABELS,
  NEW_BEST_TEXT,
  personalBestText,
  PRESS_R_NEW_DAY,
  TOUCH_INTRO_CONTROLS,
  TOUCH_INTRO_START_HINT,
  TOUCH_NEXT_PROMPT,
  TOUCH_NEW_DAY,
  touchToggleLabel,
} from '../text/hudCopy';
import {
  HALL_WIDTH,
  HALL_DEPTH,
  FOYER_DEPTH,
  FOYER_WIDTH,
  FIRST_FLOOR_HALL_ZONE,
  FIRST_FLOOR_ROOM4_ZONE,
  FIRST_FLOOR_ROOM4_DOORWAY,
  FIRST_FLOOR_CLAMP_X_MIN,
  FIRST_FLOOR_CLAMP_X_MAX,
  FIRST_FLOOR_CLAMP_Z_MIN,
  FIRST_FLOOR_CLAMP_Z_MAX,
} from '../scene/ExhibitionHall';
import { isLocalHost } from '../util/env';

// Full-size room shapes for the minimap — deliberately not FIRST_FLOOR_ZONES,
// whose auditorium entries are recessed (plus tiny separate doorway slivers)
// for collision purposes; the minimap should draw the rooms as they actually
// look, not as the robot's walkable footprint.
const FIRST_FLOOR_MINIMAP_ZONES = [FIRST_FLOOR_HALL_ZONE, FIRST_FLOOR_ROOM4_ZONE];

const MINIMAP_SIZE = 150;

/**
 * The whole-session tally shown on "A Day at Devoxx"'s end screen — Biggy's
 * permanent fall is the only real end the game has, so it doubles as the
 * end of the day. `best`/`isNewBest` back a
 * personal-best line via localStorage (Game.ts owns reading/writing it) —
 * deliberately just a per-browser personal best, not a shared leaderboard,
 * so it doesn't matter that it's trivially editable via devtools.
 */
export interface DayEndSummary {
  voxxy: number;
  droid: number;
  biggy: number;
  total: number;
  best: number | null;
  isNewBest: boolean;
}

export class Hud {
  private scoreEl: HTMLDivElement;
  private timeEl: HTMLDivElement;
  private messageEl: HTMLDivElement;
  private energyFillEl: HTMLDivElement;
  // Level 3's hunger bar — see update()'s hungerFraction param.
  private hungerWrap: HTMLDivElement;
  private hungerFillEl: HTMLDivElement;
  private introEl: HTMLDivElement;
  private introHidden = false;
  private introLevel: 1 | 2 | 3 = 1;
  // Whether the on-screen touch controls are showing (see TouchControls.ts) —
  // swaps every key-naming line for its tap-shaped twin in hudCopy.ts.
  private touchMode = false;
  /** Set by Game.ts — called when the intro panel's touch-controls switch is tapped. */
  onTouchToggle: (() => void) | null = null;
  private container: HTMLElement;
  private lastMessageHtml = '';
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;
  private toastEl: HTMLDivElement;
  private toastHideTimer: ReturnType<typeof setTimeout> | null = null;
  // Shown while a level transition's setRobotModel() switch is still
  // in flight (see Robot.isLoadingModel) — the previous robot's model keeps
  // standing in during that window with no other visual cue otherwise.
  private modelLoadingEl: HTMLDivElement;
  // Only created when isLocalHost() — same reasoning as Game.ts's ?x=/?z=
  // debug params this pairs with: reading off the coordinates to build a
  // debug URL shouldn't be possible in a hosted build either.
  private debugCoordsEl: HTMLDivElement | null = null;
  private lastDebugState: { x: number; z: number; headingRad: number; level: 1 | 2 | 3 } | null = null;
  private debugCopyFeedbackUntil = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0;
      display: flex; justify-content: space-between;
      padding: 16px 24px; pointer-events: none;
      font-family: sans-serif; color: white;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      font-size: 20px; font-weight: 600;
    `;
    this.scoreEl = document.createElement('div');
    this.timeEl = document.createElement('div');
    bar.appendChild(this.scoreEl);
    bar.appendChild(this.timeEl);

    const energyWrap = document.createElement('div');
    energyWrap.style.cssText = `
      position: absolute; bottom: 20px; left: 24px;
      display: flex; align-items: center; gap: 8px; pointer-events: none;
      font-family: sans-serif; color: white; font-size: 14px; font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    `;
    const energyLabel = document.createElement('div');
    energyLabel.textContent = ENERGY_LABEL;
    const energyTrack = document.createElement('div');
    energyTrack.style.cssText = `
      width: 220px; height: 14px;
      background: rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.7);
      border-radius: 7px; overflow: hidden;
    `;
    this.energyFillEl = document.createElement('div');
    this.energyFillEl.style.cssText = `
      height: 100%; width: 100%; background: #2ecc71;
      transition: width 0.1s linear, background-color 0.2s linear;
    `;
    energyTrack.appendChild(this.energyFillEl);
    energyWrap.appendChild(energyLabel);
    energyWrap.appendChild(energyTrack);

    // Level 3 only (see update()'s hungerFraction param — undefined for
    // Levels 1-2, which hides this entirely rather than showing an empty/full
    // bar that means nothing there). Stacked directly above the energy bar,
    // same visual language (label + track + fill), since it's the same kind
    // of "resource you're managing" readout.
    this.hungerWrap = document.createElement('div');
    this.hungerWrap.style.cssText = `
      position: absolute; bottom: 42px; left: 24px;
      align-items: center; gap: 8px; pointer-events: none;
      font-family: sans-serif; color: white; font-size: 14px; font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); display: none;
    `;
    const hungerLabel = document.createElement('div');
    hungerLabel.textContent = HUNGER_LABEL;
    const hungerTrack = document.createElement('div');
    hungerTrack.style.cssText = `
      width: 220px; height: 14px;
      background: rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.7);
      border-radius: 7px; overflow: hidden;
    `;
    this.hungerFillEl = document.createElement('div');
    this.hungerFillEl.style.cssText = `
      height: 100%; width: 100%; background: #2ecc71;
      transition: width 0.1s linear, background-color 0.2s linear;
    `;
    hungerTrack.appendChild(this.hungerFillEl);
    this.hungerWrap.appendChild(hungerLabel);
    this.hungerWrap.appendChild(hungerTrack);

    this.messageEl = document.createElement('div');
    this.messageEl.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: sans-serif; color: white; font-size: 32px; font-weight: 700;
      text-shadow: 0 2px 6px rgba(0,0,0,0.9); text-align: center;
      white-space: pre-line; display: none; pointer-events: none;
      width: max-content; max-width: calc(100% - 48px);
    `;

    this.introEl = document.createElement('div');
    this.introEl.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: sans-serif; color: white; text-align: center;
      text-shadow: 0 2px 6px rgba(0,0,0,0.9); pointer-events: none;
      background: rgba(0,0,0,0.35); padding: 24px 32px; border-radius: 12px;
      transition: opacity 0.4s ease; white-space: pre-line;
      width: max-content; max-width: min(760px, calc(100% - 32px)); box-sizing: border-box;
    `;
    // The panel itself ignores the pointer (so it never eats a tap meant for
    // the game), but its touch-controls switch is a real button — delegated
    // here once because showIntro() rewrites the panel's innerHTML.
    this.introEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest('[data-touch-toggle]') as HTMLButtonElement | null;
      if (!button || this.introHidden) return;
      button.blur();
      this.onTouchToggle?.();
    });
    this.showIntro(1);

    this.toastEl = document.createElement('div');
    this.toastEl.style.cssText = `
      position: absolute; top: 96px; left: 50%; transform: translate(-50%, -12px);
      max-width: 480px; font-family: sans-serif; color: white; text-align: center;
      font-size: 17px; font-weight: 600; line-height: 1.4;
      text-shadow: 0 2px 6px rgba(0,0,0,0.9); pointer-events: none;
      background: rgba(0,0,0,0.45); padding: 12px 20px; border-radius: 10px;
      opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    this.modelLoadingEl = document.createElement('div');
    this.modelLoadingEl.style.cssText = `
      position: absolute; bottom: 20px; left: 50%; transform: translate(-50%, 0);
      font-family: sans-serif; color: white; font-size: 14px; font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8); pointer-events: none;
      background: rgba(0,0,0,0.45); padding: 6px 14px; border-radius: 8px;
      display: none;
    `;

    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = MINIMAP_SIZE;
    this.minimapCanvas.height = MINIMAP_SIZE;
    this.minimapCanvas.style.cssText = `
      position: absolute; top: 64px; right: 24px;
      width: ${MINIMAP_SIZE}px; height: ${MINIMAP_SIZE}px;
      background: rgba(0,0,0,0.55); border: 2px solid rgba(255,255,255,0.4);
      border-radius: 8px; pointer-events: none;
    `;
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable for minimap');
    this.minimapCtx = ctx;

    container.style.position = 'relative';
    container.appendChild(bar);
    container.appendChild(energyWrap);
    container.appendChild(this.hungerWrap);
    container.appendChild(this.minimapCanvas);
    container.appendChild(this.messageEl);
    container.appendChild(this.toastEl);
    container.appendChild(this.introEl);
    container.appendChild(this.modelLoadingEl);
    // A phone rotating, or a car screen resizing its browser pane, can cross
    // the compact threshold — re-render the briefing rather than just refit it.
    window.addEventListener('resize', () => {
      if (!this.introHidden) this.showIntro(this.introLevel);
      this.fitCentered(this.messageEl);
    });

    if (isLocalHost()) {
      this.debugCoordsEl = document.createElement('div');
      this.debugCoordsEl.title = 'Click to copy a debug URL for this exact spot';
      this.debugCoordsEl.style.cssText = `
        position: absolute; bottom: 20px; right: 24px;
        font-family: monospace; color: #7CFC9A; font-size: 13px;
        text-shadow: 0 1px 3px rgba(0,0,0,0.9); pointer-events: auto; cursor: pointer;
        background: rgba(0,0,0,0.45); padding: 6px 10px; border-radius: 6px;
      `;
      this.debugCoordsEl.addEventListener('click', () => this.copyDebugUrl());
      container.appendChild(this.debugCoordsEl);
    }
  }

  /**
   * Writes the last position updateDebugCoords() saw into the page's own URL
   * (?level=&x=&z=&heading=, matching what Game.ts's constructor reads back)
   * via replaceState — no reload, so it doesn't interrupt whatever's running
   * — and best-effort copies that URL to the clipboard so it's ready to
   * paste/bookmark/share for reproducing this exact spot later. Briefly
   * shows "Copied!" in place of the coordinates so the click has visible
   * feedback; updateDebugCoords() skips overwriting it until that expires.
   */
  private copyDebugUrl(): void {
    if (!this.lastDebugState) return;
    const { x, z, headingRad, level } = this.lastDebugState;
    const headingDeg = Math.round(((headingRad * 180) / Math.PI) % 360);
    const url = new URL(window.location.href);
    url.searchParams.set('level', String(level));
    url.searchParams.set('x', x.toFixed(2));
    url.searchParams.set('z', z.toFixed(2));
    url.searchParams.set('heading', String(headingDeg));
    history.replaceState(null, '', url);

    navigator.clipboard?.writeText(url.toString()).catch(() => {
      // Clipboard access can be denied/unavailable (permissions, insecure
      // context) — the URL bar itself already updated either way, so this
      // is a nice-to-have, not the actual mechanism.
    });

    if (this.debugCoordsEl) {
      this.debugCoordsEl.textContent = 'Copied!';
      this.debugCopyFeedbackUntil = performance.now() + 900;
    }
  }

  /**
   * Local-only readout (see isLocalHost()) of the robot's live position — a
   * no-op in a hosted build.
   *
   * `y` is shown but deliberately not stored in lastDebugState: the copied
   * debug URL carries only x/z/heading, because y is always derived from the
   * floor's own height function rather than taken from the URL. It's on the
   * readout because standing somewhere and reading back the height the game
   * actually gave you is the only cheap way to check a tiered or stepped
   * surface (auditorium rows, either staircase) against the height function
   * that's supposed to describe it.
   */
  updateDebugCoords(x: number, y: number, z: number, headingRad: number, level: 1 | 2 | 3): void {
    if (!this.debugCoordsEl) return;
    this.lastDebugState = { x, z, headingRad, level };
    // Leave the click's "Copied!" feedback up for its full window instead of
    // stomping it the very next frame (this runs every tick).
    if (performance.now() < this.debugCopyFeedbackUntil) return;
    const headingDeg = Math.round(((headingRad * 180) / Math.PI) % 360);
    this.debugCoordsEl.textContent = `L${level} x:${x.toFixed(1)} y:${y.toFixed(2)} z:${z.toFixed(1)} h:${headingDeg}°`;
  }

  /** Briefly shows a piece of collected knowledge (or any short toast text). */
  showQuoteToast(text: string): void {
    if (this.toastHideTimer) clearTimeout(this.toastHideTimer);
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastEl.style.transform = 'translate(-50%, 0)';
    this.toastHideTimer = setTimeout(() => {
      this.toastEl.style.opacity = '0';
      this.toastEl.style.transform = 'translate(-50%, -12px)';
    }, 3200);
  }

  /**
   * Toggles the small "Loading <robot>..." cue for a robot-model switch in
   * flight (see Robot.isLoadingModel) — call every frame with the current
   * state, same polling pattern as update()/updateMinimap() below, rather
   * than a one-shot show/hide pair, since the switch's completion isn't a
   * discrete event Game.ts otherwise observes.
   */
  setModelLoading(loading: boolean, robotId: string): void {
    this.modelLoadingEl.style.display = loading ? 'block' : 'none';
    if (loading) {
      const label = robotId.charAt(0).toUpperCase() + robotId.slice(1);
      this.modelLoadingEl.textContent = `Loading ${label}...`;
    }
  }

  /**
   * Redraws the corner minimap for whichever map layout is currently active.
   * `mapLayout` denotes the map geometry (1 = ground floor, 2 = first floor),
   * not the game level number — Level 3 (Lunch Rush) reuses the ground
   * floor's own layout, so Game.ts passes 1 for it too.
   */
  updateMinimap(
    robotX: number,
    robotZ: number,
    heading: number,
    pickups: { x: number; z: number; collected: boolean }[],
    kiosks: { x: number; z: number; color: string }[],
    mapLayout: 1 | 2,
  ): void {
    const ctx = this.minimapCtx;
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    const bounds =
      mapLayout === 1
        ? { xMin: -HALL_WIDTH / 2, xMax: HALL_WIDTH / 2, zMin: -HALL_DEPTH / 2, zMax: HALL_DEPTH / 2 + FOYER_DEPTH }
        : {
            xMin: FIRST_FLOOR_CLAMP_X_MIN,
            xMax: FIRST_FLOOR_CLAMP_X_MAX,
            zMin: FIRST_FLOOR_CLAMP_Z_MIN,
            zMax: FIRST_FLOOR_CLAMP_Z_MAX,
          };
    const margin = 10;
    const scaleX = (MINIMAP_SIZE - margin * 2) / (bounds.xMax - bounds.xMin);
    const scaleZ = (MINIMAP_SIZE - margin * 2) / (bounds.zMax - bounds.zMin);
    const toPx = (x: number) => margin + (x - bounds.xMin) * scaleX;
    const toPy = (z: number) => margin + (z - bounds.zMin) * scaleZ;
    const rect = (x1: number, z1: number, x2: number, z2: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(toPx(x1), toPy(z1), toPx(x2) - toPx(x1), toPy(z2) - toPy(z1));
    };

    if (mapLayout === 1) {
      rect(-HALL_WIDTH / 2, -HALL_DEPTH / 2, HALL_WIDTH / 2, HALL_DEPTH / 2, '#5a5a54'); // hall
      rect(-FOYER_WIDTH / 2, HALL_DEPTH / 2, FOYER_WIDTH / 2, HALL_DEPTH / 2 + FOYER_DEPTH, '#6a5a44'); // reception (walkable)
    } else {
      // The hall plus every auditorium off it, at their real (full) size —
      // see FIRST_FLOOR_MINIMAP_ZONES's own comment. First zone is always
      // the hall (its own dark corridor color); the rest are auditoriums.
      FIRST_FLOOR_MINIMAP_ZONES.forEach((zone, i) => {
        const color = i === 0 ? '#3a3742' : '#2e2b33';
        rect(zone.x - zone.halfW, zone.z - zone.halfD, zone.x + zone.halfW, zone.z + zone.halfD, color);
      });
      // The Room 4 doorway itself — otherwise indistinguishable from the rest
      // of the wall between the hall and the room at this scale (the user: "it
      // should be clear where the door between the hall and the room is, now
      // it is a bit hard to find"). Drawn oversized relative to its own real
      // halfD (a few meters) — at true scale it would round to under a pixel.
      const door = FIRST_FLOOR_ROOM4_DOORWAY;
      const doorPx = toPx(door.x);
      const doorPy = toPy(door.z);
      const doorMarkerHalf = 5;
      ctx.fillStyle = '#4ad0ff';
      ctx.fillRect(doorPx - doorMarkerHalf, doorPy - doorMarkerHalf, doorMarkerHalf * 2, doorMarkerHalf * 2);
      ctx.strokeStyle = '#0a2530';
      ctx.lineWidth = 1;
      ctx.strokeRect(doorPx - doorMarkerHalf, doorPy - doorMarkerHalf, doorMarkerHalf * 2, doorMarkerHalf * 2);
    }

    // Uncollected pickups — small gold dots. Collected ones drop off the map
    // the same way their world mesh disappears, rather than lingering as a
    // stale marker for something no longer there to find.
    ctx.fillStyle = '#f6d743';
    for (const pickup of pickups) {
      if (pickup.collected) continue;
      ctx.beginPath();
      ctx.arc(toPx(pickup.x), toPy(pickup.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Refuel kiosks — fixed square markers, each in its own accent color so
    // multiple stations read as distinct rather than duplicate icons.
    for (const kiosk of kiosks) {
      const size = 6;
      ctx.fillStyle = kiosk.color;
      ctx.fillRect(toPx(kiosk.x) - size / 2, toPy(kiosk.z) - size / 2, size, size);
    }

    // Robot — a dot with a short heading wedge (forward = (sin h, cos h) in
    // world space, which maps directly to (+x, +z) on this canvas).
    const px = toPx(robotX);
    const py = toPy(robotZ);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.sin(heading) * 9, py + Math.cos(heading) * 9);
    ctx.stroke();
  }

  /** Hides the intro/controls panel as soon as the player presses any key. */
  hideIntro(): void {
    if (this.introHidden) return;
    this.introHidden = true;
    this.introEl.style.opacity = '0';
    // A faded-out panel's switch would otherwise stay tappable, invisibly.
    const toggle = this.introEl.querySelector<HTMLButtonElement>('[data-touch-toggle]');
    if (toggle) toggle.style.pointerEvents = 'none';
  }

  /**
   * Shrinks a centred panel (the intro briefing, the end screens) until it
   * fits between the HUD's top and bottom bars — a landscape phone or a car
   * screen can be under 400px tall, where Level 3's briefing would otherwise
   * run off the top and put its touch switch on top of the energy bar.
   * Measures offsetWidth/Height, which a transform doesn't affect, so it's
   * stable to call repeatedly.
   */
  private fitCentered(el: HTMLElement): void {
    const H = this.container.clientHeight;
    const W = this.container.clientWidth;
    const reserveTop = 56; // the top score bar
    // The bottom energy/hunger bars — and in portrait with touch controls on,
    // the whole band the stick and buttons occupy, since there's no room
    // beside them the way there is in landscape.
    const reserveBottom = this.touchMode && H > W ? 230 : 56;
    const availH = H - reserveTop - reserveBottom;
    const availW = W - 24;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    const scale = h > 0 && w > 0 ? Math.min(1, availH / h, availW / w) : 1;
    el.style.top = `${reserveTop + availH / 2}px`;
    el.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
  }

  /** Short screens (landscape phones, in-car displays) get the intro panel's compact type sizes. */
  private get compact(): boolean {
    return this.container.clientHeight < 520;
  }

  /** Switches every key-naming line to its touch wording, re-rendering the intro panel if it's up. */
  setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    if (!this.introHidden) this.showIntro(this.introLevel);
  }

  /**
   * Populates and (re-)shows the intro/controls panel for `level` — called at
   * the start of every level, not just the very first, and left showing
   * until hideIntro() fires on the player's first *control* keypress (see
   * Game.ts's `awaitingStart`, which holds the level frozen for exactly as
   * long as this panel is up, so the briefing can be read without the timer
   * already draining behind it). Used to be a short two-line banner that
   * auto-faded after 2.6s for Levels 2-3 (see LEVEL_INTROS's own comment for
   * why that changed). Never actually removes introEl from the DOM
   * (hideIntro() above just fades it) so it's always there to re-show.
   */
  showIntro(level: 1 | 2 | 3): void {
    this.introLevel = level;
    const { title, description } = LEVEL_INTROS[level];
    const controls = this.touchMode ? TOUCH_INTRO_CONTROLS[level] : LEVEL_INTROS[level].controls;
    const startHint = this.touchMode ? TOUCH_INTRO_START_HINT : INTRO_START_HINT;
    // tabindex=-1 and the mousedown preventDefault keep the switch from ever
    // taking focus: a focused button is "clicked" by Space, which is also the
    // jump key that starts the level.
    const c = this.compact;
    this.introEl.style.padding = c ? '14px 20px' : '24px 32px';
    this.introEl.innerHTML = `
      <div style="font-size: ${c ? 21 : 28}px; font-weight: 700; margin-bottom: ${c ? 4 : 8}px;">${title}</div>
      <div style="font-size: ${c ? 14 : 18}px; margin-bottom: ${c ? 8 : 16}px;">${description}</div>
      <div style="font-size: ${c ? 13 : 16}px; opacity: 0.9;">${controls}</div>
      <div style="font-size: ${c ? 14 : 16}px; font-weight: 700; margin-top: ${c ? 8 : 16}px;">${startHint}</div>
      <button type="button" data-touch-toggle tabindex="-1" onmousedown="event.preventDefault()" style="
        margin-top: ${c ? 8 : 14}px; pointer-events: auto; cursor: pointer; touch-action: manipulation;
        font: 600 14px sans-serif; color: white; padding: 8px 14px; border-radius: 18px;
        background: ${this.touchMode ? 'rgba(46,204,113,0.35)' : 'rgba(255,255,255,0.12)'};
        border: 1px solid rgba(255,255,255,0.5);
      ">${touchToggleLabel(this.touchMode)}</button>
    `;
    this.introHidden = false;
    this.introEl.style.opacity = '1';
    this.fitCentered(this.introEl);
  }

  update(
    score: number,
    // Counts down for Levels 1-2's fixed-timer rounds; counts *up* (survived
    // seconds) for Level 3's endless mode — see the level === 3 branch below.
    clockValue: number,
    finished: boolean,
    energyFraction: number,
    timeBonus: number,
    level: 1 | 2 | 3,
    // Only ever provided once Level 3 has actually ended (see Game.ts) —
    // that's the one event that ends the whole day, so this is also the
    // trigger for the day-end screen rather than the plain per-round message.
    dayEnd?: DayEndSummary,
    // Level 3 only (see LunchRush.ts's hunger mechanic) — undefined for
    // Levels 1-2, which hides the bar entirely rather than showing one stuck
    // at some meaningless fixed value.
    hungerFraction?: number,
  ): void {
    const copy = this.touchMode ? { ...LEVEL_COPY[level], nextPrompt: TOUCH_NEXT_PROMPT[level] } : LEVEL_COPY[level];
    this.scoreEl.textContent = scoreLabel(copy.itemLabel, score);
    this.timeEl.textContent = level === 3 ? survivedLabel(clockValue) : timeRemainingLabel(clockValue);

    const pct = Math.round(energyFraction * 100);
    this.energyFillEl.style.width = `${pct}%`;
    this.energyFillEl.style.backgroundColor = pct < 25 ? '#e74c3c' : pct < 60 ? '#f1c40f' : '#2ecc71';

    this.hungerWrap.style.display = hungerFraction === undefined ? 'none' : 'flex';
    if (hungerFraction !== undefined) {
      const hungerPct = Math.round(hungerFraction * 100);
      this.hungerFillEl.style.width = `${hungerPct}%`;
      this.hungerFillEl.style.backgroundColor = hungerPct < 25 ? '#e74c3c' : hungerPct < 60 ? '#f1c40f' : '#2ecc71';
    }

    this.messageEl.style.display = finished ? 'block' : 'none';
    if (!finished) this.lastMessageHtml = '';
    if (finished) {
      if (level === 3 && dayEnd) {
        this.messageEl.innerHTML = this.buildDayEndHtml(dayEnd);
      } else if (level === 3) {
        // Defensive fallback only — Level 3 finishing should always come
        // with a summary (see Game.ts). Biggy's permanent failure, no timer,
        // no time bonus, just the comedic game-over beat.
        this.messageEl.textContent = fellMessageFallback(copy.itemLabel, score, copy.nextPrompt);
      } else {
        this.messageEl.textContent =
          timeBonus > 0
            ? allCollectedMessage(copy.collectedNoun, timeBonus, copy.itemLabel, score, copy.nextPrompt)
            : timeUpMessage(copy.itemLabel, score, copy.nextPrompt);
      }
      // update() runs every frame; only re-measure when the screen's content changed.
      if (this.messageEl.innerHTML !== this.lastMessageHtml) {
        this.lastMessageHtml = this.messageEl.innerHTML;
        this.fitCentered(this.messageEl);
      }
    }
  }

  /**
   * "A Day at Devoxx" end screen — the comedic Biggy game-over beat, then a
   * per-robot breakdown (not just the total) so it stays visible that all
   * three robots' performance actually mattered, not just Biggy's endless
   * one. Uses innerHTML (unlike every other message here) specifically to
   * get the score rows to align as real columns — a proportional sans-serif
   * font can't align that with plain text + spaces the way a monospace font
   * could.
   */
  private buildDayEndHtml(dayEnd: DayEndSummary): string {
    const row = (label: string, pts: number, emphasize = false): string => `
      <div style="display: flex; justify-content: space-between; gap: 28px; ${emphasize ? 'font-weight: 700; font-size: 19px;' : ''}">
        <span>${label}</span><span>${pts} pts</span>
      </div>`;

    const bestLine = dayEnd.isNewBest
      ? NEW_BEST_TEXT
      : dayEnd.best !== null
        ? personalBestText(dayEnd.best)
        : '';

    return `
      <div style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">${DAY_END_TITLE}</div>
      <div style="display: inline-block; text-align: left; font-size: 17px; line-height: 1.7; margin-top: 10px;">
        ${row(DAY_END_ROW_LABELS.voxxy, dayEnd.voxxy)}
        ${row(DAY_END_ROW_LABELS.droid, dayEnd.droid)}
        ${row(DAY_END_ROW_LABELS.biggy, dayEnd.biggy)}
        <div style="border-top: 1px solid rgba(255,255,255,0.4); margin: 8px 0;"></div>
        ${row(DAY_END_ROW_LABELS.total, dayEnd.total, true)}
      </div>
      ${bestLine ? `<div style="font-size: 15px; margin-top: 10px; opacity: 0.9;">${bestLine}</div>` : ''}
      <div style="font-size: 18px; font-weight: 700; margin-top: 18px;">${this.touchMode ? TOUCH_NEW_DAY : PRESS_R_NEW_DAY}</div>
    `;
  }
}
