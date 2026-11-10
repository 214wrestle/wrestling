import { TouchBuffer } from './TouchBuffer';
import type { TouchKey } from './TouchGestures';
/**
 * Input.
 *
 * Keyboard, gamepad and touch all collapse into one shape: a screen-space stick
 * and four buttons. The game turns the stick into a world direction using the
 * camera, so "right" always means toward your opponent in the side view, and
 * gameplay never learns what device is in use.
 */

export type ActionName = 'shoot' | 'fight' | 'sprawl' | 'confirm' | 'pause' | 'help' | 'mute';

const KEY_MAP: Record<string, string> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyJ: 'shoot',
  KeyU: 'lowSingle',
  KeyQ: 'legRide',
  KeyZ: 'closePockets',
  KeyG: 'catchLeg',
  KeyE: 'liftLeg',
  KeyR: 'tripLeg',
  KeyT: 'doubleLeg',
  KeyF: 'driveLeg',
  KeyI: 'scramble',
  KeyX: 'sitOut',
  KeyO: 'duckUnder',
  KeyB: 'superDuck',
  KeyV: 'slideBy',
  KeyN: 'footSweep',
  KeyC: 'firemansCarry',
  Space: 'shoot',
  KeyK: 'fight',
  KeyL: 'sprawl',
  ShiftLeft: 'level',
  ShiftRight: 'level',
  Enter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
  KeyH: 'help',
  KeyM: 'mute',
};

export interface PadState {
  /** Screen-space stick: x right, y up (into the screen). */
  x: number;
  y: number;
  shoot: boolean;
  fight: boolean;
  sprawl: boolean;
  level: boolean;
  legRide?: boolean;
  closePockets?: boolean;
  catchLeg?: boolean;
  legAction?: 'lift' | 'trip' | 'double' | 'drive';
  sustainedEffort?: boolean;
  technique?: 'duckUnder' | 'superDuck' | 'slideBy' | 'firemansCarry' | 'footSweep';
  lowSingle?: boolean;
  scramble?: boolean;
  sitOut?: boolean;
}

export const NO_PAD: PadState = { x: 0, y: 0, shoot: false, fight: false, sprawl: false, level: false };

export type Device = 'keyboard' | 'gamepad' | 'touch';

export class Input {
  private held = new Set<string>();
  private heldKeys = new Set<string>();
  // Keep short keyboard presses between fixed steps, just like touch taps.
  private keyboardBuffer = new TouchBuffer();
  private listeners = new Map<ActionName, Array<() => void>>();
  /** Set by the on-screen controls on touch devices. */
  private touchBuffer = new TouchBuffer();
  get touch(): PadState { return this.touchBuffer.current; }
  set touch(value: PadState) { this.touchBuffer.set(value); }
  clearTouch(): void { this.touchBuffer.clear(); }
  /** Menus/resets discard released taps while retaining keys physically down. */
  clearKeyboardPresses(): void {
    this.keyboardBuffer.clear();
    this.queueKeyboard();
  }
  // Remember who supplied a queued shot even after a normal quick release.
  // A keyboard/controller shot takes ownership so touch cancellation cannot erase it.
  private touchShotOwner: 'shoot' | 'lowSingle' | undefined;
  private touchTechniqueOwner = false;
  private previousTechnique: PadState['technique'];
  get ownsTouchTechnique(): boolean { return this.touchTechniqueOwner; }
  private previousShotCommand = false;
  private previousLowSingle = false;
  cancelTouch(key?: TouchKey): boolean {
    const cancelShot = !!this.touchShotOwner && (!key || key === this.touchShotOwner);
    if (cancelShot) {
      this.touchShotOwner = undefined;
      // Game also clears Bout's corresponding command history for a fresh re-press.
      this.previousShotCommand = false;
      this.previousLowSingle = false;
    }
    if (this.touchTechniqueOwner && (!key || key === 'technique')) {
      this.touchTechniqueOwner = false;
      this.previousTechnique = undefined;
    }
    if (key) this.touchBuffer.cancel(key); else this.clearTouch();
    return cancelShot;
  }
  private padIndex: number | null = null;
  private padPrev: boolean[] = [];
  /** Last device the player touched, for button glyphs. */
  device: Device = 'keyboard';
  onDevice: ((d: Device) => void) | null = null;

  constructor(private target: EventTarget = window) {
    this.target.addEventListener('keydown', this.onKeyDown as EventListener);
    this.target.addEventListener('keyup', this.onKeyUp as EventListener);
    window.addEventListener('gamepadconnected', this.onPad as EventListener);
    window.addEventListener('blur', this.onBlur);
  }

  private setDevice(d: Device): void {
    if (this.device === d) return;
    this.device = d;
    this.onDevice?.(d);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    // Let form controls keep their keys.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (action !== 'confirm' || this.held.size > 0) e.preventDefault();
    this.setDevice('keyboard');
    if (this.heldKeys.has(e.code)) return; // OS key repeat is not another attempt.
    this.heldKeys.add(e.code);
    if (!this.held.has(action)) this.emit(action as ActionName);
    this.held.add(action);
    this.queueKeyboard();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    this.heldKeys.delete(e.code);
    // J/Space, both shifts and movement aliases share an action. Releasing
    // one physical key must not release another key that is still down.
    if (![...this.heldKeys].some(code => KEY_MAP[code] === action)) this.held.delete(action);
    this.queueKeyboard();
  };

  private queueKeyboard(): void {
    const has = (action: string) => this.held.has(action);
    // A fresh finish choice wins while an older key is still down. This lets
    // Lift flow into Trip/Drive without requiring a precisely timed release.
    const finishKeys: Partial<Record<string, NonNullable<PadState['legAction']>>> = {
      KeyE: 'lift', KeyR: 'trip', KeyT: 'double', KeyF: 'drive',
    };
    const legAction = [...this.heldKeys].reverse().map(code => finishKeys[code]).find(Boolean);
    this.keyboardBuffer.set({
      ...NO_PAD,
      shoot: has('shoot'), fight: has('fight'), sprawl: has('sprawl'), level: has('level'),
      lowSingle: has('lowSingle'), scramble: has('scramble'), sitOut: has('sitOut'),
      legRide: has('legRide'), closePockets: has('closePockets'), catchLeg: has('catchLeg'),
      technique: (['duckUnder','superDuck','slideBy','firemansCarry','footSweep'] as const).find(has),
      legAction,
    });
  }

  private onPad = (e: GamepadEvent) => {
    this.padIndex = e.gamepad.index;
  };

  private onBlur = () => {
    this.held.clear();
    this.heldKeys.clear();
    this.keyboardBuffer.clear();
    this.clearTouch();
  };

  on(action: ActionName, fn: () => void): () => void {
    const list = this.listeners.get(action) ?? [];
    list.push(fn);
    this.listeners.set(action, list);
    return () => {
      const current = this.listeners.get(action);
      if (current) this.listeners.set(action, current.filter((f) => f !== fn));
    };
  }

  private emit(action: ActionName): void {
    for (const fn of this.listeners.get(action) ?? []) fn();
  }

  private gamepad(): Gamepad | null {
    if (this.padIndex === null) return null;
    return navigator.getGamepads?.()[this.padIndex] ?? null;
  }

  /** Poll once per frame: gamepad edges fire the same action events. */
  poll(): void {
    const pad = this.gamepad();
    if (!pad) return;
    const map: Array<[number, ActionName]> = [
      [0, 'shoot'],
      [2, 'fight'],
      [1, 'sprawl'],
      [9, 'pause'],
      [8, 'help'],
    ];
    for (const [i, name] of map) {
      const now = !!pad.buttons[i]?.pressed;
      if (now && !this.padPrev[i]) {
        this.setDevice('gamepad');
        this.emit(name);
      }
      this.padPrev[i] = now;
    }
    if (Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0) > 0.4) this.setDevice('gamepad');
  }

  /** This frame's stick and buttons. */
  state(): PadState {
    const pad = this.gamepad();
    const touch = this.touchBuffer.sample();
    const keyboard = this.keyboardBuffer.sample();
    const dead = (v: number) => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8);
    let x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let y = (this.held.has('up') ? 1 : 0) - (this.held.has('down') ? 1 : 0);
    let shoot = keyboard.shoot;
    let fight = keyboard.fight;
    let sprawl = keyboard.sprawl;
    let level = keyboard.level;
    if (pad) {
      x += dead(pad.axes[0] ?? 0);
      y -= dead(pad.axes[1] ?? 0);
      // The d-pad steers like the stick (up, down, left, right); the position picks the move.
      x += (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      y += (pad.buttons[12]?.pressed ? 1 : 0) - (pad.buttons[13]?.pressed ? 1 : 0);
      shoot = shoot || !!pad.buttons[0]?.pressed;
      fight = fight || !!pad.buttons[2]?.pressed;
      sprawl = sprawl || !!pad.buttons[1]?.pressed || !!pad.buttons[5]?.pressed;
      level = level || (pad.buttons[7]?.value ?? 0) > 0.4 || (pad.buttons[6]?.value ?? 0) > 0.4;
    }
    const otherLowSingle = !!keyboard.lowSingle || !!pad?.buttons[4]?.pressed;
    const lowSingle = otherLowSingle || !!touch.lowSingle;
    const lowEdge = lowSingle && !this.previousLowSingle;
    // Match Bout's low-single-to-shoot edge. Switching devices without a
    // released sample does not create a new shot or transfer its ownership.
    const shotCommand = shoot || touch.shoot || lowEdge;
    if (shoot || otherLowSingle) this.touchShotOwner = undefined;
    else if (shotCommand && !this.previousShotCommand) {
      this.touchShotOwner = lowEdge && touch.lowSingle ? 'lowSingle' : touch.shoot ? 'shoot' : undefined;
    }
    this.previousShotCommand = shotCommand;
    this.previousLowSingle = lowSingle;
    x += touch.x;
    y += touch.y;
    shoot = shoot || touch.shoot;
    fight = fight || touch.fight;
    sprawl = sprawl || touch.sprawl;
    level = level || touch.level;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    // Simple controls: no technique buttons on the controller; stick + position choose them.
    const padTechnique: PadState['technique'] = undefined;
    const technique = keyboard.technique ?? touch.technique ?? padTechnique;
    // Track the effective choice, preserving a released tap until it is consumed.
    if (keyboard.technique || !touch.technique && padTechnique) this.touchTechniqueOwner = false;
    else if (technique && technique !== this.previousTechnique) this.touchTechniqueOwner = !!touch.technique;
    this.previousTechnique = technique;
    return { x, y, shoot, fight, sprawl, level, technique, legRide: keyboard.legRide || touch.legRide, closePockets: keyboard.closePockets || touch.closePockets, catchLeg: keyboard.catchLeg || touch.catchLeg, legAction: keyboard.legAction ?? touch.legAction, sustainedEffort: shoot || fight || sprawl, lowSingle, scramble: keyboard.scramble || !!touch.scramble || !!pad?.buttons[3]?.pressed, sitOut: keyboard.sitOut || !!touch.sitOut || !!pad?.buttons[11]?.pressed };
  }

  /** A short controller buzz for impacts and scores. */
  rumble(strength: number, ms: number): void {
    const pad = this.gamepad() as (Gamepad & { vibrationActuator?: { playEffect: (t: string, p: object) => Promise<unknown> } }) | null;
    pad?.vibrationActuator
      ?.playEffect('dual-rumble', {
        duration: ms,
        strongMagnitude: Math.min(1, strength),
        weakMagnitude: Math.min(1, strength * 0.6),
      })
      .catch(() => undefined);
    // Browsers reject vibration before the first tap and log an error for it.
    if (this.device === 'touch' && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false && strength > 0.3) navigator.vibrate(Math.round(ms * 0.6));
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    window.removeEventListener('gamepadconnected', this.onPad as EventListener);
    window.removeEventListener('blur', this.onBlur);
    this.listeners.clear();
  }
}
