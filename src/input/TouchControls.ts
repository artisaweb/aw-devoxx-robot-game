import type { InputManager } from './InputManager';
import { TOUCH_BUTTON_LABELS } from '../text/hudCopy';

// On-screen controls for anything without a keyboard — phones, tablets, an
// in-car screen. They don't drive the robot themselves: every control just
// holds down the key it stands for (InputManager.pressVirtual), so
// Robot.update(), Game.ts's START_KEYS and every fresh-press diff work
// unchanged, and the keyboard keeps working alongside them.
//
// Shown automatically on a device that reports a touch screen, and switched
// on at the first real touch on one that doesn't (some in-car browsers and
// kiosks under-report), unless the player has switched them off from the
// intro panel — an explicit choice wins over both and is remembered.

const STORAGE_KEY = 'devoxx-touch-controls';
const STICK_SIZE = 132;
const KNOB_SIZE = 58;
// Fraction of the stick's travel before a direction counts as held. 0.38 of
// the radius means a 45° push holds both of its keys (sin 45° ≈ 0.71), which
// matters here: steering is tank-style (A/D turn, W/S drive), so "forward
// while turning" is two keys at once from a single thumb.
const STICK_THRESHOLD = 0.38;

function readStoredChoice(): boolean | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'on' ? true : stored === 'off' ? false : null;
  } catch {
    return null;
  }
}

function storeChoice(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode / blocked storage — the choice just lasts this visit.
  }
}

function looksLikeTouchDevice(): boolean {
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: coarse)').matches;
  return coarse || navigator.maxTouchPoints > 0;
}

// Keeps a finger that slides off its control still owning it. Best-effort:
// setPointerCapture throws for a pointer the browser no longer considers
// active, and a throw here must not leave the control half-pressed.
function capturePointer(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Without capture the control still releases on its own pointerup.
  }
}

export class TouchControls {
  private root = document.createElement('div');
  private stickBase = document.createElement('div');
  private stickKnob = document.createElement('div');
  private newDayButton: HTMLButtonElement;
  private jumpButton: HTMLButtonElement;
  private boostButton: HTMLButtonElement;
  private enabled: boolean;
  private explicitChoice: boolean;
  private stickPointer: number | null = null;
  private stickKeys = new Set<string>();
  // Each hold button's own "let go" — see releaseAll().
  private buttonResets: (() => void)[] = [];
  /** Called whenever the controls are shown or hidden, so the HUD can switch its wording. */
  onChange: ((on: boolean) => void) | null = null;

  constructor(
    container: HTMLElement,
    private input: InputManager,
  ) {
    const stored = readStoredChoice();
    this.explicitChoice = stored !== null;
    this.enabled = stored ?? looksLikeTouchDevice();

    this.root.style.cssText = `
      position: absolute; inset: 0; pointer-events: none;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
      font-family: sans-serif;
    `;
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    this.buildStick();
    this.jumpButton = this.root.appendChild(
      this.buildHoldButton(TOUCH_BUTTON_LABELS.jump, 'Space', 88, 'calc(24px + env(safe-area-inset-right))', 'calc(76px + env(safe-area-inset-bottom))', '46,204,113'),
    );
    this.boostButton = this.root.appendChild(
      this.buildHoldButton(TOUCH_BUTTON_LABELS.boost, 'ShiftLeft', 72, 'calc(124px + env(safe-area-inset-right))', 'calc(40px + env(safe-area-inset-bottom))', '241,196,15'),
    );
    // Level 3's end screen restarts the day on R only, never on any key, so a
    // stray press can't throw the score away — the touch equivalent is its
    // own button that only exists while that screen is up, rather than R on
    // one of the pads.
    this.newDayButton = this.buildHoldButton(TOUCH_BUTTON_LABELS.newDay, 'KeyR', 0, '50%', 'calc(10px + env(safe-area-inset-bottom))', '52,152,219');
    this.newDayButton.style.display = 'none';
    this.root.appendChild(this.newDayButton);

    container.appendChild(this.root);
    this.applyVisibility();
    this.layout(container);
    window.addEventListener('resize', () => this.layout(container));

    window.addEventListener('pointerdown', this.onAnyPointerDown, { capture: true });
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.releaseAll);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** The intro panel's switch — an explicit choice, remembered across visits. */
  toggle(): void {
    this.explicitChoice = true;
    storeChoice(!this.enabled);
    this.setEnabled(!this.enabled);
  }

  /** Shows NEW DAY only while Level 3's day-end screen is up (see Game.tick()). */
  setNewDayVisible(visible: boolean): void {
    const display = visible && this.enabled ? 'flex' : 'none';
    if (this.newDayButton.style.display !== display) this.newDayButton.style.display = display;
  }

  private setEnabled(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    this.applyVisibility();
    this.onChange?.(on);
  }

  // Sized for a tablet; shrunk toward each control's own corner on shorter
  // screens (a landscape phone is ~360-430px tall) so JUMP stays clear of the
  // minimap above it and the stick clear of the intro panel.
  private layout(container: HTMLElement): void {
    const scale = Math.min(1, Math.max(0.62, container.clientHeight / 580));
    const t = `scale(${scale.toFixed(3)})`;
    this.stickBase.style.transformOrigin = 'bottom left';
    this.stickBase.style.transform = t;
    for (const button of [this.jumpButton, this.boostButton]) {
      button.style.transformOrigin = 'bottom right';
      button.style.transform = t;
    }
    // Centred on its right: 50% anchor, and kept under the end screen's text.
    this.newDayButton.style.transformOrigin = 'bottom center';
    this.newDayButton.style.transform = `translateX(50%) ${t}`;
  }

  private applyVisibility(): void {
    this.root.style.display = this.enabled ? 'block' : 'none';
    if (!this.enabled) this.releaseAll();
  }

  private onAnyPointerDown = (e: PointerEvent): void => {
    if (this.enabled || this.explicitChoice || e.pointerType !== 'touch') return;
    // A touch on the switch itself is the player choosing — leave it to toggle().
    if ((e.target as HTMLElement | null)?.closest?.('[data-touch-toggle]')) return;
    this.setEnabled(true);
  };

  private releaseAll = (): void => {
    this.input.releaseAllVirtual();
    // The buttons too, not just the keys: a button still holding a pointer id
    // whose pointerup never came would ignore every later touch.
    for (const reset of this.buttonResets) reset();
    this.stickKeys.clear();
    this.stickPointer = null;
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  };

  private buildStick(): void {
    this.stickBase.style.cssText = `
      position: absolute; left: calc(28px + env(safe-area-inset-left)); bottom: calc(76px + env(safe-area-inset-bottom));
      width: ${STICK_SIZE}px; height: ${STICK_SIZE}px; border-radius: 50%;
      background: rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.45);
      pointer-events: auto; touch-action: none;
    `;
    this.stickKnob.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: ${KNOB_SIZE}px; height: ${KNOB_SIZE}px; border-radius: 50%;
      background: rgba(255,255,255,0.55); border: 2px solid rgba(255,255,255,0.8);
      pointer-events: none;
    `;
    this.stickBase.appendChild(this.stickKnob);
    this.root.appendChild(this.stickBase);

    this.stickBase.addEventListener('pointerdown', (e) => {
      if (this.stickPointer !== null) return;
      e.preventDefault();
      this.stickPointer = e.pointerId;
      this.moveStick(e);
      capturePointer(this.stickBase, e.pointerId);
    });
    this.stickBase.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPointer) this.moveStick(e);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.setStickKeys(new Set());
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    };
    this.stickBase.addEventListener('pointerup', end);
    this.stickBase.addEventListener('pointercancel', end);
    this.stickBase.addEventListener('lostpointercapture', end);
  }

  private moveStick(e: PointerEvent): void {
    const rect = this.stickBase.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (e.clientX - (rect.left + radius)) / radius;
    let dy = (e.clientY - (rect.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const travel = (STICK_SIZE - KNOB_SIZE) / 2;
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx * travel}px), calc(-50% + ${dy * travel}px))`;

    const keys = new Set<string>();
    if (dy < -STICK_THRESHOLD) keys.add('KeyW');
    if (dy > STICK_THRESHOLD) keys.add('KeyS');
    if (dx < -STICK_THRESHOLD) keys.add('KeyA');
    if (dx > STICK_THRESHOLD) keys.add('KeyD');
    this.setStickKeys(keys);
  }

  private setStickKeys(keys: Set<string>): void {
    for (const code of this.stickKeys) if (!keys.has(code)) this.input.releaseVirtual(code);
    for (const code of keys) if (!this.stickKeys.has(code)) this.input.pressVirtual(code);
    this.stickKeys = keys;
  }

  private buildHoldButton(label: string, code: string, size: number, right: string, bottom: string, rgb: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = -1;
    button.textContent = label;
    const shape = size > 0 ? `width: ${size}px; height: ${size}px; border-radius: 50%;` : 'padding: 14px 26px; border-radius: 26px;';
    button.style.cssText = `
      position: absolute; right: ${right}; bottom: ${bottom}; ${shape}
      display: flex; align-items: center; justify-content: center;
      font: 700 15px sans-serif; color: white; letter-spacing: 0.5px;
      background: rgba(${rgb},0.35); border: 2px solid rgba(${rgb},0.9);
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      pointer-events: auto; touch-action: none; cursor: pointer;
    `;
    let pointer: number | null = null;
    button.addEventListener('pointerdown', (e) => {
      if (pointer !== null) return;
      e.preventDefault();
      pointer = e.pointerId;
      button.style.background = `rgba(${rgb},0.7)`;
      this.input.pressVirtual(code);
      capturePointer(button, e.pointerId);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      button.style.background = `rgba(${rgb},0.35)`;
      this.input.releaseVirtual(code);
    };
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    this.buttonResets.push(() => {
      pointer = null;
      button.style.background = `rgba(${rgb},0.35)`;
    });
    return button;
  }
}
