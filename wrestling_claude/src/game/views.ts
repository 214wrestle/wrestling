import { SHOT_CLIPS, LEG_HOLDS } from '../sim/moves';
import type { AnimView } from '../anim/Animator';
import type { MatchSim } from '../sim/MatchSim';
import type { Athlete, Position } from '../sim/bout';
import { otherSide } from '../sim/types';
import type { Side } from '../sim/types';

/**
 * Translates the simulation into what each body should be showing.
 *
 * The sim speaks in positions and acts ("in on a double, 62% of the way to the
 * finish"); the animator speaks in clips, frames and progress. This is the
 * dictionary between the two, and the only place that knows both vocabularies.
 */

const HOLD_FOR_SUB = { ride: 'ride', flat: 'flat', standing: 'standing', exposed: 'exposed' } as const;

function stanceView(a: Athlete, o: Athlete, relaxed: boolean): AnimView {
  return {
    mode: 'stance',
    x: a.pos.x,
    z: a.pos.z,
    yaw: a.yaw,
    vx: a.vel.x,
    vz: a.vel.z,
    level: a.level,
    lean: a.lean,
    lead: a.lead,
    act: a.act,
    actT: a.actT,
    actDur: a.actDur,
    hand: a.hand,
    oppHand: o.hand,
    stamina: a.stamina,
    exertion: a.exertion,
    relaxed,
  };
}

function soloView(a: Athlete, clip: string, u: number): AnimView {
  return { mode: 'solo', clip, x: a.pos.x, z: a.pos.z, yaw: a.yaw, u, stamina: a.stamina, exertion: a.exertion };
}

function pairedFor(p: Position, side: Side, athletes: [Athlete, Athlete]): AnimView | null {
  const me = athletes[side];
  const base = { stamina: me.stamina, exertion: me.exertion };
  switch (p.kind) {
    case 'shot':
      return {
        mode: 'paired',
        clip: SHOT_CLIPS[p.shot],
        hold: false,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: p.mirror,
        u: Math.min(1, p.t / p.dur),
        progress: 0,
        intensity: 1,
        dist: p.dist,
        ...base,
      };
    case 'legs':
      return {
        mode: 'paired',
        clip: LEG_HOLDS[p.shot],
        hold: true,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: p.mirror,
        u: 0,
        progress: Math.max(0, Math.min(1, p.progress)),
        intensity: p.intensity,
        ...base,
      };
    case 'fhl':
      return {
        mode: 'paired',
        clip: 'fhl',
        hold: true,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: false,
        u: 0,
        progress: Math.max(0, Math.min(1, p.recover)),
        intensity: p.intensity,
        ...base,
      };
    case 'mat': {
      let progress = 0;
      if (p.sub === 'ride') progress = 1 - p.base;
      else if (p.sub === 'flat') progress = Math.min(1, p.base / 0.68);
      else if (p.sub === 'standing') progress = p.escape;
      else progress = Math.min(1, p.pin);
      return {
        mode: 'paired',
        clip: HOLD_FOR_SUB[p.sub],
        hold: true,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: false,
        u: 0,
        progress: Math.max(0, Math.min(1, progress)),
        intensity: p.intensity,
        ...base,
      };
    }
    case 'move':
      return {
        mode: 'paired',
        clip: p.id,
        hold: false,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: p.mirror,
        u: Math.min(1, p.t / p.dur),
        progress: 0,
        intensity: 1,
        dist: p.id === 'stuffed' || p.id === 'shotDouble' || p.id === 'shotSingle' || p.id === 'shotHighCrotch' || p.id === 'shotLowSingle' ? p.dist : undefined,
        ...base,
      };
    default:
      return null;
  }
}

/** Build both wrestlers' views for this frame. */
export function wrestlerViews(sim: MatchSim): [AnimView, AnimView] {
  const ath = sim.bout.athletes;
  const out: AnimView[] = [];
  for (const side of [0, 1] as Side[]) {
    const me = ath[side];
    const them = ath[otherSide(side)];
    let v: AnimView;
    switch (sim.phase) {
      case 'attract':
      case 'intros': {
        const walking = Math.hypot(me.vel.x, me.vel.z) > 0.05;
        v = walking
          ? { mode: 'walk', x: me.pos.x, z: me.pos.z, yaw: me.yaw, vx: me.vel.x, vz: me.vel.z, stamina: 1, exertion: 0 }
          : stanceView(me, them, true);
        break;
      }
      case 'celebration':
      case 'results': {
        const won = sim.result?.winner === side;
        const t = sim.phase === 'results' ? 9 : sim.phaseT;
        if (won) v = t > 3.2 ? soloView(me, 'handRaised', 0) : soloView(me, 'celebrate', t / 1.5);
        else v = soloView(me, 'dejected', 0);
        break;
      }
      case 'wrestling':
      case 'setPosition': {
        const p = sim.bout.position;
        const paired = pairedFor(p, side, ath);
        v = paired ?? stanceView(me, them, p.kind === 'free');
        break;
      }
      case 'handshake':
        v = { ...stanceView(me, them, true), shake: sim.phaseT > 0.25 && sim.phaseT < 1.45 } as AnimView;
        break;
      default:
        v = stanceView(me, them, true);
        break;
    }
    out.push(v);
  }
  return out as [AnimView, AnimView];
}
