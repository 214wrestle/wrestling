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
  KeyI: 'scramble',
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
  lowSingle?: boolean;
  scramble?: boolean;
}

export const NO_PAD: PadState = { x: 0, y: 0, shoot: false, fight: false, sprawl: false, level: false };

export type Device = 'keyboard' | 'gamepad' | 'touch';

export class Input {
  private held = new Set<string>();
  private listeners = new Map<ActionName, Array<() => void>>();
  /** Set by the on-screen controls on touch devices. */
  touch: PadState = { ...NO_PAD };
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
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (action !== 'confirm' || this.held.size > 0) e.preventDefault();
    this.setDevice('keyboard');
    if (!this.held.has(action)) this.emit(action as ActionName);
    this.held.add(action);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    this.held.delete(action);
  };

  private onPad = (e: GamepadEvent) => {
    this.padIndex = e.gamepad.index;
  };

  private onBlur = () => {
    this.held.clear();
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
    const dead = (v: number) => (Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8);
    let x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let y = (this.held.has('up') ? 1 : 0) - (this.held.has('down') ? 1 : 0);
    let shoot = this.held.has('shoot');
    let fight = this.held.has('fight');
    let sprawl = this.held.has('sprawl');
    let level = this.held.has('level');
    if (pad) {
      x += dead(pad.axes[0] ?? 0);
      y -= dead(pad.axes[1] ?? 0);
      shoot = shoot || !!pad.buttons[0]?.pressed;
      fight = fight || !!pad.buttons[2]?.pressed;
      sprawl = sprawl || !!pad.buttons[1]?.pressed || !!pad.buttons[5]?.pressed;
      level = level || (pad.buttons[7]?.value ?? 0) > 0.4 || (pad.buttons[6]?.value ?? 0) > 0.4;
    }
    x += this.touch.x;
    y += this.touch.y;
    shoot = shoot || this.touch.shoot;
    fight = fight || this.touch.fight;
    sprawl = sprawl || this.touch.sprawl;
    level = level || this.touch.level;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, shoot, fight, sprawl, level, lowSingle: this.held.has('lowSingle') || !!this.touch.lowSingle || !!pad?.buttons[4]?.pressed, scramble: this.held.has('scramble') || !!this.touch.scramble || !!pad?.buttons[3]?.pressed };
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
    if (this.device === 'touch' && navigator.vibrate && strength > 0.3) navigator.vibrate(Math.round(ms * 0.6));
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    window.removeEventListener('gamepadconnected', this.onPad as EventListener);
    window.removeEventListener('blur', this.onBlur);
    this.listeners.clear();
  }
}
