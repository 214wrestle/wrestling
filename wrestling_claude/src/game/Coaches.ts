import type { Scene } from 'three';
import { Animator } from '../anim/Animator';
import type { AnimView } from '../anim/Animator';
import type { CharacterRig } from '../body/Character';
import { COACH_CHAIRS } from '../arena/gym';
import type { MatchSim } from '../sim/MatchSim';
import { OFFICIAL } from '../sim/roster';
import { iconSchool } from '../sim/schoolAbbr';
import { kitIdOf, schoolColours } from '../body/realistic/eraKits';
import { otherSide } from '../sim/types';
import type { ScoreEvent, Side, Wrestler } from '../sim/types';

/**
 * Corner coaches (owner, November 11: "a coach in the corner during the matches ... who has reactions to good and
 * bad results for their wrestler"). One per wrestler, seated in his corner chair in a polo in the school's colours.
 * Seated and watching, with bursts of coaching (more while his man is on bottom); up and urging on a near fall; fists
 * pumping when his man scores and hands on his head when he gives up points; at the end the winner's coach celebrates
 * and the loser's slumps. Generic coaches, not likenesses of real people.
 */

type Clip = 'coachSit' | 'coachYell' | 'coachUrge' | 'coachCheer' | 'coachDismay' | 'coachLoss';

/** How long each reaction lasts, seconds: [small score, 2 points or more]. */
export const COACH_REACTION = { cheer: [1.6, 2.6], dismay: [1.3, 2.2] } as const;

/** Loop rates (cycles per second) for each clip. */
const RATE: Record<Clip, number> = { coachSit: 0.22, coachYell: 1.3, coachUrge: 1.15, coachCheer: 1.7, coachDismay: 0.6, coachLoss: 0 };

const HAIR = ['#2a211b', '#4a3a2c', '#6b6158', '#8d867e', '#1b1612', '#5a4632'];

/** A generic coach for a wrestler's corner: his school's colours, the build and hair varied by school. */
export function coachFor(w: Wrestler, side: Side): Wrestler {
  let h = 0;
  for (const ch of w.school.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = (k: number) => ((h >>> k) % 1000) / 1000;
  // An Icon's coach is from the school he wrestled for, in its colours.
  const icon = iconSchool(w);
  const own = icon ? schoolColours(kitIdOf(icon)) : undefined;
  const school = own ? { ...w.school, primary: own.primary, secondary: own.secondary } : w.school;
  return {
    ...OFFICIAL,
    id: `coach-${side}-${icon ? kitIdOf(icon) : w.school.id}`,
    firstName: 'Coach',
    lastName: icon ?? w.school.name,
    school,
    build: 0.45 + r(3) * 0.35,
    height: 1.74 + r(7) * 0.12,
    hairColor: HAIR[h % HAIR.length],
    hairStyle: 'crop',
  };
}

interface CoachBody { char: CharacterRig; anim: Animator; side: Side }

export class Coaches {
  private bodies: CoachBody[] = [];
  private reaction: ({ clip: 'coachCheer' | 'coachDismay'; t: number } | null)[] = [null, null];
  private yellIn: number[] = [3, 5];
  private yelling: number[] = [0, 0];
  private time = 0;
  private disposed = false;

  constructor(private scene: Scene, private build: (w: Wrestler) => Promise<CharacterRig>) {}

  async load(wrestlers: readonly [Wrestler, Wrestler]): Promise<void> {
    const chars = await Promise.all(wrestlers.map((w, i) => this.build(coachFor(w, i as Side))));
    if (this.disposed) {
      for (const c of chars) c.dispose();
      return;
    }
    this.bodies = chars.map((char, i) => {
      const anim = new Animator(char);
      anim.instant = true;
      this.scene.add(char.root);
      return { char, anim, side: i as Side };
    });
  }

  /** Points on the board: his coach is up pumping his fists, the other's hands go to his head. */
  onScore(e: ScoreEvent): void {
    const big = e.points >= 2 ? 1 : 0;
    this.reaction[e.side] = { clip: 'coachCheer', t: COACH_REACTION.cheer[big] };
    if (e.kind !== 'ridingTime') this.reaction[otherSide(e.side)] = { clip: 'coachDismay', t: COACH_REACTION.dismay[big] };
  }

  /** Which clip each coach is in right now (for checks and the Lab). */
  clipFor(side: Side, sim: MatchSim): Clip {
    const pos = sim.bout.position;
    const phase = sim.phase;
    if ((phase === 'celebration' || phase === 'results') && sim.result) return sim.result.winner === side ? 'coachCheer' : 'coachLoss';
    const r = this.reaction[side];
    if (r) return r.clip;
    if (phase !== 'wrestling') return 'coachSit';
    if (pos.kind === 'mat' && pos.sub === 'exposed') return 'coachUrge';
    return this.yelling[side] > 0 ? 'coachYell' : 'coachSit';
  }

  /** Advance the reactions and coaching bursts (also before the bodies have loaded). */
  tick(dt: number, sim: MatchSim): void {
    this.time += dt;
    const pos = sim.bout.position;
    for (const s of [0, 1] as const) {
      const r = this.reaction[s];
      if (r && (r.t -= dt) <= 0) this.reaction[s] = null;
      // Coaching in bursts while they wrestle, more often while his man is on bottom.
      if (this.yelling[s] > 0) this.yelling[s] -= dt;
      else if (sim.phase === 'wrestling' && (this.yellIn[s] -= dt) <= 0) {
        const bottom = pos.kind === 'mat' && pos.A !== s;
        this.yelling[s] = 1.3 + Math.random() * 1.2;
        this.yellIn[s] = (bottom ? 2 : 3.5) + Math.random() * (bottom ? 3 : 6);
      }
    }
  }

  update(dt: number, sim: MatchSim, wrestlers: readonly [Animator, Animator] | null): void {
    this.tick(dt, sim);
    for (const b of this.bodies) {
      const s = b.side;
      const clip = this.clipFor(s, sim);
      const chair = COACH_CHAIRS[s];
      // Turned a little toward the action, but square to his chair.
      const toward = Math.atan2(sim.center.x - chair.x, sim.center.z - chair.z);
      let d = toward - chair.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const yaw = chair.yaw + Math.max(-0.45, Math.min(0.45, d));
      const view: AnimView = { mode: 'solo', clip, x: chair.x, z: chair.z, yaw, u: this.time * RATE[clip], stamina: 1, exertion: 0 };
      const watch = wrestlers ? wrestlers[s] : null;
      b.anim.update(Math.max(dt, 1e-4), view, watch);
      b.anim.applyContacts(Math.max(dt, 1e-4), watch);
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const b of this.bodies) {
      this.scene.remove(b.char.root);
      b.char.dispose();
    }
    this.bodies = [];
  }
}
