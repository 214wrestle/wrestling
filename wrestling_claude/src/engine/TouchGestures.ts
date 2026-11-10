import type { PadState } from './Input';
export type TouchKey = Exclude<keyof PadState, 'x' | 'y' | 'sustainedEffort'>;
type Value = boolean | NonNullable<PadState['technique']> | NonNullable<PadState['legAction']>;
/** Each finger owns its gesture; releasing one cannot release another. */
export class TouchGestures {
  private pointers = new Map<number, {key: TouchKey; value: Value}>();
  begin(pointer: number, key: TouchKey, value: Value): void { this.pointers.set(pointer, {key,value}); }
  end(pointer: number): TouchKey | undefined {
    const key = this.pointers.get(pointer)?.key;
    this.pointers.delete(pointer);
    return key;
  }
  cancelKey(key: TouchKey): boolean {
    let removed = false;
    for (const [pointer, gesture] of this.pointers) {
      if (gesture.key === key) { this.pointers.delete(pointer); removed = true; }
    }
    return removed;
  }
  /** Drop fingers whose contextual choice disappeared, retaining valid owners. */
  cancelUnavailable(key: TouchKey, available: readonly Value[]): boolean {
    let removed = false;
    for (const [pointer, gesture] of this.pointers) {
      if (gesture.key === key && !available.includes(gesture.value)) {
        this.pointers.delete(pointer); removed = true;
      }
    }
    return removed;
  }
  has(key: TouchKey): boolean { return [...this.pointers.values()].some(p => p.key === key); }
  get size(): number { return this.pointers.size; }
  state(): Partial<PadState> {
    const out: Partial<PadState> = {};
    for (const {key,value} of this.pointers.values()) Object.assign(out,{[key]:value});
    return out;
  }
  clear(): void { this.pointers.clear(); }
}
