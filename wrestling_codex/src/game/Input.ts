import { emptyControls, type Controls } from './types';

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private padPrevious: boolean[] = [];
  private touchDown = new Set<string>();
  private touchPressed = new Set<string>();
  private stick = { x: 0, z: 0 };
  constructor(private active: () => boolean, private shortcut: (key: string) => void) {
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.clear);
  }
  private keydown = (e: KeyboardEvent) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
    if (!e.repeat && ['Escape', 'KeyC', 'KeyM', 'KeyH', 'KeyQ', 'KeyE'].includes(e.code)) this.shortcut(e.code);
    if (this.active() && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyK', 'KeyL', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault(); if (!this.down.has(e.code)) this.pressed.add(e.code); this.down.add(e.code);
    }
  };
  private keyup = (e: KeyboardEvent) => this.down.delete(e.code);
  clear = () => { this.down.clear(); this.pressed.clear(); this.touchDown.clear(); this.touchPressed.clear(); this.stick = { x: 0, z: 0 }; };
  read(): Controls {
    const c = emptyControls(), has = (...keys: string[]) => keys.some(k => this.down.has(k));
    c.x = Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft'));
    c.z = Number(has('KeyW', 'ArrowUp')) - Number(has('KeyS', 'ArrowDown'));
    c.primary = this.pressed.has('KeyJ') || this.touchPressed.has('primary');
    c.secondary = this.pressed.has('KeyK') || this.touchPressed.has('secondary');
    c.setup = this.pressed.has('KeyL') || this.touchPressed.has('setup');
    c.defend = has('Space') || this.touchDown.has('defend');
    c.primaryHeld = has('KeyJ') || this.touchDown.has('primary');
    c.sprint = has('ShiftLeft', 'ShiftRight');
    c.x += this.stick.x; c.z += this.stick.z;
    const pad = navigator.getGamepads?.()[0];
    if (pad) {
      const buttons = pad.buttons.map(b => b.pressed);
      c.x += Math.abs(pad.axes[0] ?? 0) > 0.16 ? pad.axes[0] : 0;
      c.z -= Math.abs(pad.axes[1] ?? 0) > 0.16 ? pad.axes[1] : 0;
      c.primary ||= !!buttons[0] && !this.padPrevious[0]; c.primaryHeld ||= !!buttons[0];
      c.secondary ||= !!buttons[2] && !this.padPrevious[2]; c.setup ||= !!buttons[1] && !this.padPrevious[1];
      c.defend ||= !!buttons[7] || !!buttons[5]; c.sprint ||= !!buttons[6];
      if (buttons[9] && !this.padPrevious[9]) this.shortcut('Escape'); this.padPrevious = buttons;
    }
    this.pressed.clear(); this.touchPressed.clear(); return c;
  }
  attachTouch() {
    for (const el of document.querySelectorAll<HTMLElement>('[data-touch]')) {
      const action = el.dataset.touch!;
      el.addEventListener('pointerdown', e => { if (!this.active()) return; e.preventDefault(); el.setPointerCapture(e.pointerId); this.touchDown.add(action); this.touchPressed.add(action); el.classList.add('held'); });
      const release = () => { this.touchDown.delete(action); el.classList.remove('held'); };
      el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release); el.addEventListener('lostpointercapture', release);
    }
    const joystick = document.querySelector<HTMLElement>('#joystick')!, knob = joystick.querySelector<HTMLElement>('i')!;
    let pointer: number | null = null;
    const move = (e: PointerEvent) => {
      const r = joystick.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width * 0.35), dy = (e.clientY - r.top - r.height / 2) / (r.height * 0.35), magnitude = Math.max(1, Math.hypot(dx, dy));
      this.stick = { x: dx / magnitude, z: -dy / magnitude };
      knob.style.transform = `translate(${this.stick.x * 30}px, ${-this.stick.z * 30}px)`;
    };
    joystick.addEventListener('pointerdown', e => { pointer = e.pointerId; joystick.setPointerCapture(pointer); move(e); });
    joystick.addEventListener('pointermove', e => { if (e.pointerId === pointer) move(e); });
    const end = () => { pointer = null; this.stick = { x: 0, z: 0 }; knob.style.transform = ''; };
    joystick.addEventListener('pointerup', end); joystick.addEventListener('pointercancel', end); joystick.addEventListener('lostpointercapture', end);
  }
  dispose() { window.removeEventListener('keydown', this.keydown); window.removeEventListener('keyup', this.keyup); window.removeEventListener('blur', this.clear); }
}
