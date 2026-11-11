import { STILL_INTENSITY } from '../anim/clips';
import {isArmBar} from '../sim/armBars';
import {legRideQuality,LEG_CLEAR_THRESHOLD} from '../sim/legRideQuality';
import { SHOT_CLIPS, LEG_HOLDS } from '../sim/moves';
import type { AnimView } from '../anim/Animator';
import type { MatchSim } from '../sim/MatchSim';
import type { Athlete, Position } from '../sim/bout';
import { otherSide } from '../sim/types';
import type { Side } from '../sim/types';

/** Most breakdowns are the near-arm chop; every fourth is the far-tricep drive. Presentation only. */
const breakdownVariants = new WeakMap<object, string>();
let breakdownCount = 0;
function breakdownClip(p: object): string {
  let clip = breakdownVariants.get(p);
  if (!clip) {
    clip = ++breakdownCount % 4 === 0 ? 'breakdownDrive' : 'breakdown';
    breakdownVariants.set(p, clip);
  }
  return clip;
}

/**
 * Translates the simulation into what each body should be showing.
 *
 * The sim speaks in positions and acts ("in on a double, 62% of the way to the
 * finish"); the animator speaks in clips, frames and progress. This is the
 * dictionary between the two, and the only place that knows both vocabularies.
 */

const HOLD_FOR_SUB = { ride: 'ride', flat: 'flat', standing: 'standing', exposed: 'exposed', spladle: 'spladle' } as const;

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
    attemptedTechnique: a.attemptedTechnique,
    actT: a.actT,
    actDur: a.actDur,
    hand: a.hand,
    oppHand: o.hand,
    tie: a.tie,
    oppTie: o.tie,
    stamina: a.stamina,
    exertion: a.exertion,
    relaxed,
  };
}

function soloView(a: Athlete, clip: string, u: number): AnimView {
  return { mode: 'solo', clip, x: a.pos.x, z: a.pos.z, yaw: a.yaw, u, stamina: a.stamina, exertion: a.exertion };
}

function pairedFor(p: Position, side: Side, athletes: [Athlete, Athlete], rideQuality=1): AnimView | null {
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
        clip: (p.counterGrip ?? 0) > 0.01 ? 'spladleSetup' : LEG_HOLDS[p.shot],
        hold: true,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: p.mirror,
        u: 0,
        // Single-leg elevation is separate from finishing pressure. An unlifted
        // capture stays low until the player lifts or commits to the finish.
        progress: Math.max(0, Math.min(1, (p.counterGrip ?? 0) > 0.01 ? p.counterGrip!
          : p.shot === 'single' || p.shot === 'highCrotch' ? p.lifted ?? 0 : p.progress)),
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
        mirror: p.mirror ?? false,
        u: 0,
        progress: Math.max(0, Math.min(1, p.recover)),
        intensity: p.intensity,
        ...base,
      };
    case 'mat': {
      let progress = 0;
      if (p.sub === 'ride') progress = 1 - p.base;
      // Flat: how far up he has worked, plus each push as a heave and each chop as a drop (owner: show the work).
      else if (p.sub === 'flat') progress = Math.min(1, p.base / 0.68 + 0.3 * (p.heave ?? 0));
      else if (p.sub === 'standing') progress = p.escape;
      // On his back, how flat he lies is the fight: the top man's pin pressure against the
      // bottom man's fight to get off it. Fighting hard keeps a shoulder up.
      else if (p.sub === 'exposed') progress = Math.min(1, p.pin - 0.6 * Math.max(0, p.fight));
      else progress = Math.min(1, p.pin);
      const matLegs = p.sub === 'ride' || p.sub === 'flat';
      const legClip = matLegs && (p.legCaught ?? 0) > 0.05 ? (p.sub==='flat' ? 'catchRidingLegFlat' : 'catchRidingLeg') : matLegs && (p.legRide ?? 0) > 0 ? (p.sub==='flat' ? ((p.legRide??0)>=.8?'legRidePressure':'legRideFlat') : 'legRide') : matLegs && (p.pockets ?? 0) > 0.3 && (p.sub !== 'flat' || p.base < 0.15 && (p.heave ?? 0) < 0.2) ? (p.sub==='flat' ? 'closedPocketsFlat' : 'closedPockets') : null;
      if (legClip) progress = legClip==='legRidePressure' ? rideQuality : (legClip === 'catchRidingLeg' || legClip === 'catchRidingLegFlat') ? Math.min(1,p.legCaught!/LEG_CLEAR_THRESHOLD) : (legClip === 'closedPockets' || legClip === 'closedPocketsFlat') ? p.pockets! : p.legRide!;
      return {
        mode: 'paired',
        clip: p.sub==='exposed' && isArmBar(p.turnStyle) ? p.turnStyle+'Pin' : p.sub === 'exposed' && p.turnStyle === 'cradle' ? 'cradleHold' : legClip ?? HOLD_FOR_SUB[p.sub],
        hold: true,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: p.mirror ?? false,
        u: 0,
        progress: Math.max(0, Math.min(1, progress)),
        intensity: p.intensity,
        pockets: matLegs ? p.pockets ?? 0 : undefined,
        hands: p.sub === 'ride' ? p.hands ?? 0 : undefined,
        resistance: p.sub==='exposed' && (p.turnStyle==='cradle'||isArmBar(p.turnStyle)) ? Math.max(0,Math.min(1,p.fight)) : undefined,
        ...base,
      };
    }
    case 'move':
      return {
        mode: 'paired',
        clip: p.id === 'breakdown' ? breakdownClip(p) : isArmBar(p.turnStyle) && (p.id==='fightOff'||p.id==='fall') ? p.turnStyle+(p.id==='fightOff'?'Exit':'Fall') : p.turnStyle==='cradle' && p.id==='fightOff' ? 'cradleFightOff' : p.turnStyle==='cradle' && p.id==='fall' ? 'cradleFall' : p.id,
        hold: false,
        role: p.A === side ? 'A' : 'B',
        frame: p.frame,
        mirror: p.mirror,
        u: Math.min(1, p.t / p.dur),
        progress: 0,
        intensity: 1,
        dist: p.id === 'stuffed' || p.id === 'stuffedSingle' || p.id === 'shotDouble' || p.id === 'shotSingle' || p.id === 'shotHighCrotch' || p.id === 'shotLowSingle' ? p.dist : undefined,
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
        const pressure=p.kind==='mat'?legRideQuality(sim.bout.wrestlers[p.A],p.legRide??0,ath[p.A].stamina,p.legCaught):1;
        const paired = pairedFor(p, side, ath,pressure);
        // Set on the marks waiting for the whistle: nobody moves.
        if (paired?.mode === 'paired' && sim.phase === 'setPosition') paired.intensity = STILL_INTENSITY;
        v = paired ?? stanceView(me, them, p.kind === 'free');
        break;
      }
      case 'handshake':
        v = { ...stanceView(me, them, true), shake: sim.phaseT > 0.25 && sim.phaseT < 1.45 } as AnimView;
        break;
      case 'whistle':
        // Up off the mat and back to the center, upright; a tired man walks it with hands on hips.
        v = { mode: 'walk', x: me.pos.x, z: me.pos.z, yaw: me.yaw, vx: me.vel.x, vz: me.vel.z, stamina: me.stamina, exertion: 0 };
        break;
      default:
        v = stanceView(me, them, true);
        break;
    }
    out.push(v);
  }
  return out as [AnimView, AnimView];
}
