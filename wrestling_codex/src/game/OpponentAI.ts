import { emptyControls, type Controls, type Difficulty, type MatchState } from './types';

/** An opponent is an input producer. It cannot directly award points or change poses. */
export interface OpponentController {
  reset(delay?: number): void;
  decide(state: Readonly<MatchState>, difficulty: Difficulty, dt: number, random: () => number): Controls;
}

export class OpponentAI implements OpponentController {
  private think = 1;
  private defenseTime = 0;
  reset(delay = 1) { this.think = delay; this.defenseTime = 0; }

  decide(s: Readonly<MatchState>, difficulty: Difficulty, dt: number, random: () => number): Controls {
    const a = s.wrestlers[1], p = s.wrestlers[0], c = emptyControls();
    const skill = difficulty === 'club' ? 0 : difficulty === 'varsity' ? 1 : 2;
    const dx = p.x - a.x, dz = p.z - a.z, dist = Math.hypot(dx, dz);
    const approach = dist > (a.stamina < 28 ? 2.6 : 1.38) ? 1 : dist < 1.12 ? -0.7 : 0;
    c.x = dx / Math.max(dist, 0.01) * approach; c.z = dz / Math.max(dist, 0.01) * approach;
    if (approach === 0) { c.x += Math.sin(s.age * 0.8) * 0.24; c.z += Math.cos(s.age * 0.8) * 0.5; }
    if (Math.hypot(a.x, a.z) > 4.15) { c.x -= a.x * 0.4; c.z -= a.z * 0.4; }
    const attack = s.exchange && s.exchange.actor === 0 && ['shot', 'snap'].includes(s.exchange.kind);
    if (attack) {
      this.defenseTime += dt;
      c.defend = this.defenseTime > [0.72, 0.43, 0.23][skill] && p.setup < [0.2, 0.6, 0.85][skill];
    } else this.defenseTime = 0;
    if (s.exposure > 0) {
      c.defend = s.top === 0 && s.exposure > [2.8, 1.5, 0.65][skill];
      c.primaryHeld = s.top === 1; return c;
    }
    this.think -= dt;
    if (this.think <= 0) {
      this.think = [1.6, 1.1, 0.82][skill] + random() * 0.7;
      const r = random();
      if (s.top === null && dist < 1.95 && a.stamina > 28) {
        if (a.setup < 0.45 && r < 0.72) c.setup = true;
        else if (p.defending && r < 0.7) c.secondary = true;
        else c.primary = true;
      } else if (s.top === 1) {
        c.primary = r > 0.3; c.secondary = !c.primary;
      } else if (s.top === 0) {
        c.primary = r > 0.38; c.secondary = !c.primary;
      }
    }
    if (s.top === 1) c.defend = a.stamina > 40 && Math.sin(s.age * 1.3) > 0.1;
    if (s.top === 0) c.defend = a.stamina > 42 && Math.sin(s.age) > 0.6;
    return c;
  }
}
