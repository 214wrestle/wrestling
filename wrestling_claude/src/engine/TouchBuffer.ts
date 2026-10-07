import { NO_PAD, type PadState } from './Input';
const buttons = ['shoot','fight','sprawl','level','lowSingle','scramble','legRide','closePockets','catchLeg'] as const;
import type { TouchKey } from './TouchGestures';
type Key = TouchKey;
/** Preserve pointer edges between fixed simulation steps, including rapid retaps. */
export class TouchBuffer {
  current: PadState = { ...NO_PAD };
  private pending = new Map<Key, Array<boolean | string>>();
  private last: Partial<Record<Key, boolean | string>> = {};
  set(next: PadState): void {
    for (const key of [...buttons, 'technique', 'legAction'] as Key[]) {
      const value = next[key];
      if (value && value !== this.current[key]) {
        const queue = this.pending.get(key) ?? [];
        if (queue.length < 6) queue.push(value);
        this.pending.set(key, queue);
      }
    }
    this.current = { ...next };
  }
  sample(): PadState {
    const result = { ...this.current };
    for (const key of [...buttons, 'technique', 'legAction'] as Key[]) {
      const queue = this.pending.get(key);
      // An intervening release lets the simulation recognize a second press.
      const value = queue?.length ? (this.last[key] ? undefined : queue.shift()) : this.current[key];
      Object.assign(result, { [key]: value ?? (buttons.includes(key as typeof buttons[number]) ? false : undefined) });
      this.last[key] = value;
    }
    return result;
  }
  cancel(key: TouchKey): void {
    this.pending.delete(key);
    delete this.last[key];
    Object.assign(this.current, { [key]: buttons.includes(key as typeof buttons[number]) ? false : undefined });
  }
  clear(): void { this.current = { ...NO_PAD }; this.pending.clear(); this.last = {}; }
}
