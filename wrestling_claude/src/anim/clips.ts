import {Euler,Quaternion} from 'three';
import type { BoneName } from '../body/skeleton';
import { MIRROR } from '../body/skeleton';
import { P } from './posture';
import { compileSpec, compileTrack, createLocal, mirrorLocal, sampleTrack } from './spec';
import type { CompiledTrack, Key, LocalPose, PoseSpec, V3 } from './spec';

/**
 * Paired clips: two bodies authored together in one frame.
 *
 * Moves are timelines (keys at normalised time for each role). Holds are the
 * positions wrestlers fight in — a front headlock, a ride — authored as two
 * poles along a progress axis (just got there .. about to break) plus a living
 * struggle on top. Contacts pin a hand to a bone of the other body, so a grip
 * stays a grip however the bodies move.
 */

export type Role = 'A' | 'B';

export interface Contact {
  /** Whose hand. */
  who: Role;
  hand: 'L' | 'R';
  /** Bone on the other body. */
  on: BoneName;
  /** Offset in that bone's local frame (canonical metres). */
  at: V3;
  /** Optional smooth movement along the contacted bone, before mirroring. */
  atPath?: {t:number;at:V3}[];
  /** Normalised time window for moves; holds ignore it. */
  from?: number;
  to?: number;
  /** Fade in/out, normalised time. */
  fade?: number;
  /** Cradle hands join after the head and knee have been gathered. */
  claspFrom?: number;
  /** Joined palms anchored behind the back, independent of cradle gathering. */
  backClasp?: boolean;
  /** Place the palm surface, rather than the wrist, at a grip anchor. */
  palm?: boolean;
  /** For holds, gather the grip over this fraction of progress. */
  progressFade?: number;
  /** Anatomical elbow guide for a wrapping arm; coordinates on the opponent. */
  elbowGuide?: { on: BoneName; at: V3; path?: {t:number;at:V3}[] };
}

export interface FootContact {
  /** Hold progress needed to seat the hook. */
  progressFade?: number;
  who: Role;
  foot: 'L' | 'R';
  on: BoneName;
  at: V3;
  from?: number;
  to?: number;
  fade?: number;
}

export interface MoveClip {
  id: string;
  A: Key[];
  B: Key[];
  contacts?: Contact[];
  footContacts?: FootContact[];
  /** Lift the rider's moving foot smoothly without changing the torso track. */
  footSwings?: {foot:'L'|'R';from:number;to:number;height:number}[];
  /** Frame-space toe anchors held still while the opposite foot steps. */
  footPlants?: {foot:'L'|'R';from:number;to:number;at:V3}[];
  /** Frame-space elbow guide offset, isolated to a smooth time interval. */
  elbowOffsets?: {who:Role;hand:'L'|'R';from:number;peak:number;to:number;offset:V3}[];
  /** Local hand rotation pulse, in XYZ degrees, before pose mirroring. */
  wristTurns?: {who:Role;hand:'L'|'R';from:number;peak:number;to:number;angles:V3}[];
  /** Absolute local wrist orientations for an independently timed roll path. */
  wristPaths?: {who:Role;hand:'L'|'R';keys:{t:number;rotation:[number,number,number,number]}[]}[];
  /** Root distance the clip was authored at, for warping shots. */
  startDist?: number;
  /** Normalised time by which the warp has fully closed. */
  warpBy?: number;
}

export interface HoldClip {
  id: string;
  /** Progress 0 and progress 1 poses for each role. */
  A: [PoseSpec, PoseSpec];
  B: [PoseSpec, PoseSpec];
  contacts?: Contact[];
  footContacts?: FootContact[];
  /** Struggle amplitude per role (metres / degrees scale). */
  struggle?: { A: number; B: number };
  /** Cycle speed of the struggle, Hz. */
  tempo?: number;
}

interface CompiledMove {
  clip: MoveClip;
  A: CompiledTrack;
  B: CompiledTrack;
}

interface CompiledHold {
  clip: HoldClip;
  A: [LocalPose, LocalPose];
  B: [LocalPose, LocalPose];
}

const moves = new Map<string, CompiledMove>();
const holds = new Map<string, CompiledHold>();

export function registerMove(clip: MoveClip): void {
  moves.set(clip.id, { clip, A: compileTrack(clip.A, null), B: compileTrack(clip.B, null) });
}

export function registerHold(clip: HoldClip): void {
  const a0 = compileSpec(clip.A[0], null);
  const b0 = compileSpec(clip.B[0], null);
  holds.set(clip.id, {
    clip,
    A: [a0, compileSpec(clip.A[1], a0)],
    B: [b0, compileSpec(clip.B[1], b0)],
  });
}

/** A hold's pose at a given progress, without the struggle — for joining moves to it. */
export function holdLocal(id: string, role: Role, progress: number): LocalPose {
  const h = holds.get(id);
  if (!h) throw new Error(`Hold ${id} must be registered before moves that use it`);
  const [p0, p1] = role === 'A' ? h.A : h.B;
  const out = createLocal();
  for (let i = 0; i < P.SIZE; i++) out[i] = p0[i] + (p1[i] - p0[i]) * progress;
  return out;
}

export const hasMove = (id: string) => moves.has(id);
export const hasHold = (id: string) => holds.has(id);
export const moveClip = (id: string) => moves.get(id)?.clip;
export const holdClip = (id: string) => holds.get(id)?.clip;

/* --------------------------------------------------------------- sampling */

export interface ActiveContact {
  hand: 'L' | 'R';
  on: BoneName;
  at: V3;
  weight: number;
  clasp?: boolean;
  backClasp?: boolean;
  palm?: boolean;
  elbowGuide?: { on: BoneName; at: V3 };
}

const _tmp = createLocal();

function contactsAt(list: Contact[] | undefined, role: Role, u: number, mirror: boolean, hold: boolean): ActiveContact[] {
  const out: ActiveContact[] = [];
  if (!list) return out;
  for (const c of list) {
    if (c.who !== role) continue;
    let w = 1;
    if (!hold) {
      const from = c.from ?? 0;
      const to = c.to ?? 1;
      const fade = c.fade ?? 0.06;
      if (u < from - fade || u > to + fade) continue;
      if (u < from) w = 1 - (from - u) / fade;
      else if (u > to) w = 1 - (u - to) / fade;
    }
    if (w <= 0) continue;
    let anchor=c.at;
    if(!hold&&c.atPath?.length){
      const keys=c.atPath;anchor=keys[0].at;
      for(let i=1;i<keys.length;i++){
        const a=keys[i-1],b=keys[i];
        if(u>=b.t){anchor=b.at;continue;}
        const k=Math.max(0,Math.min(1,(u-a.t)/(b.t-a.t))),blend=k*k*(3-2*k);
        anchor=a.at.map((v,j)=>v+(b.at[j]-v)*blend) as V3;break;
      }
    }
    let guide=c.elbowGuide;
    if(guide?.path?.length&&!hold){
      const keys=guide.path;
      let at=keys[0].at;
      for(let i=1;i<keys.length;i++){
        const a=keys[i-1],b=keys[i];
        if(u>=b.t){at=b.at;continue;}
        const k=Math.max(0,Math.min(1,(u-a.t)/(b.t-a.t))),w=k*k*(3-2*k);
        at=a.at.map((v,j)=>v+(b.at[j]-v)*w) as V3;break;
      }
      guide={on:guide.on,at};
    }
    out.push(
      mirror
        ? {
            hand: c.hand === 'L' ? 'R' : 'L',
            on: (MIRROR[c.on] ?? c.on) as BoneName,
            at: [-anchor[0], anchor[1], anchor[2]],
            weight: w,
            palm: c.palm, backClasp:c.backClasp,
            elbowGuide: guide ? {on:(MIRROR[guide.on]??guide.on) as BoneName,at:[-guide.at[0],guide.at[1],guide.at[2]]}:undefined,
            clasp: c.claspFrom!==undefined && (hold || u>=c.claspFrom),
          }
        : { hand: c.hand, on: c.on, at: anchor, weight: w, palm:c.palm, backClasp:c.backClasp, elbowGuide:guide, clasp:c.claspFrom!==undefined && (hold || u>=c.claspFrom) },
    );
  }
  return out;
}

/** Sample a move for one role at normalised time `u` into a frame-space pose. */
export function sampleMove(id: string, role: Role, u: number, mirror: boolean, out: LocalPose): ActiveContact[] {
  const m = moves.get(id);
  if (!m) return [];
  sampleTrack(role === 'A' ? m.A : m.B, u, out);
  // Plants are authored for the rider; apply before mirroring so the support
  // side swaps consistently with the paired pose. Leg reach is still physical.
  if(role==='A')for(const swing of m.clip.footSwings??[]){
    if(swing.to<=swing.from||u<=swing.from||u>=swing.to)continue;
    const phase=(u-swing.from)/(swing.to-swing.from);
    const at=swing.foot==='L'?P.FOOT_L:P.FOOT_R;
    out[at+1]+=swing.height*Math.sin(Math.PI*phase)**2;
  }
  if(role==='A')for(const plant of m.clip.footPlants??[]){
    if(u<plant.from||u>plant.to)continue;
    const at=plant.foot==='L'?P.FOOT_L:P.FOOT_R;
    for(let axis=0;axis<3;axis++)out[at+axis]=plant.at[axis];
  }
  for(const guide of m.clip.elbowOffsets??[]){
    if(guide.who!==role||guide.peak<=guide.from||guide.to<=guide.peak||u<=guide.from||u>=guide.to)continue;
    const phase=u<=guide.peak?(u-guide.from)/(guide.peak-guide.from):(guide.to-u)/(guide.to-guide.peak);
    const weight=phase*phase*(3-2*phase),at=guide.hand==='L'?P.ELBOW_L:P.ELBOW_R;
    for(let axis=0;axis<3;axis++)out[at+axis]+=guide.offset[axis]*weight;
  }
  for(const turn of m.clip.wristTurns??[]){
    if(turn.who!==role||turn.peak<=turn.from||turn.to<=turn.peak||u<=turn.from||u>=turn.to)continue;
    const phase=u<=turn.peak?(u-turn.from)/(turn.peak-turn.from):(turn.to-u)/(turn.to-turn.peak);
    const weight=phase*phase*(3-2*phase),at=turn.hand==='L'?P.WRIST_L:P.WRIST_R;
    const base=new Quaternion().setFromEuler(new Euler(out[at],out[at+2],out[at+1],'YXZ'));
    const offset=new Quaternion().setFromEuler(new Euler(...turn.angles.map(a=>a*Math.PI/180) as [number,number,number]));
    const q=base.multiply(new Quaternion().slerp(offset,weight));
    const e=new Euler().setFromQuaternion(q,'YXZ');
    out[at]=e.x;out[at+1]=e.z;out[at+2]=e.y;
  }
  for(const path of m.clip.wristPaths??[]){
    const keys=path.keys;
    if(path.who!==role||keys.length<2||u<keys[0].t||u>keys[keys.length-1].t)continue;
    let i=0;while(i<keys.length-2&&u>keys[i+1].t)i++;
    const a=keys[i],b=keys[i+1],t=(u-a.t)/(b.t-a.t);
    const q=new Quaternion().fromArray(a.rotation).slerp(new Quaternion().fromArray(b.rotation),t);
    const e=new Euler().setFromQuaternion(q,'YXZ'),at=path.hand==='L'?P.WRIST_L:P.WRIST_R;
    out[at]=e.x;out[at+1]=e.z;out[at+2]=e.y;
  }
  if (mirror) mirrorLocal(out, out);
  return contactsAt(m.clip.contacts, role, u, mirror, false);
}

/** Hold intensity at which the struggle is exactly zero: both men set and still. */
export const STILL_INTENSITY = -1 / 3;

/** Sample a hold: blend the poles by progress and add the struggle. */
export function sampleHold(
  id: string,
  role: Role,
  progress: number,
  phase: number,
  intensity: number,
  mirror: boolean,
  out: LocalPose,
): ActiveContact[] {
  const h = holds.get(id);
  if (!h) return [];
  const [p0, p1] = role === 'A' ? h.A : h.B;
  const k = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < P.SIZE; i++) out[i] = p0[i] + (p1[i] - p0[i]) * k;

  // The struggle: hips and shoulders working against each other, never still.
  const amp = (h.clip.struggle?.[role] ?? 0.5) * (0.25 + 0.75 * intensity);
  const w = phase * Math.PI * 2 * (h.clip.tempo ?? 1.2);
  const r = role === 'A' ? 0 : 1.7;
  const s1 = Math.sin(w + r);
  const s2 = Math.sin(w * 1.63 + r * 2.1);
  const s3 = Math.sin(w * 0.71 + r * 0.6);
  out[P.HIPS] += s1 * 0.02 * amp;
  out[P.HIPS + 1] += s2 * 0.012 * amp;
  out[P.HIPS + 2] += s3 * 0.018 * amp;
  out[P.HIPS_Q] += s3 * 0.05 * amp;
  out[P.SPINE] += s2 * 0.06 * amp;
  out[P.SPINE + 2] += s1 * 0.05 * amp;
  out[P.HEAD + 1] += s3 * 0.08 * amp;
  for (const at of [P.HAND_L, P.HAND_R]) {
    out[at] += Math.sin(w * 2.1 + at) * 0.015 * amp;
    out[at + 2] += Math.cos(w * 1.7 + at) * 0.015 * amp;
  }
  if(id==='ride'){
    // Owner, November 10: "they lay on each other a ton". The ride is a fight, not a rest: the bottom man keeps
    // building (hips up, chest and head up) and shifting his weight; the rider chest-drives and walks his hips around
    // the other way. Knees and feet stay where they are; locked hands follow through contact closure.
    const work=0.55+0.45*intensity;
    const build=Math.sin(w*1.5+r), sway=Math.sin(w*0.55), drive=Math.sin(w*1.5+r+1.1);
    if(role==='B'){
      out[P.HIPS+1]+=.03*build*work;
      out[P.HIPS]+=.025*sway*work;
      out[P.SPINE]-=.08*Math.max(0,build)*work;
      out[P.HEAD]-=.16*Math.max(0,build)*work;
      out[P.SPINE+2]+=.05*sway*work;
    } else {
      out[P.HIPS]-=.03*sway*work;
      out[P.HIPS+2]+=.025*Math.max(0,drive)*work;
      out[P.HIPS+1]-=.015*Math.max(0,drive)*work;
      out[P.SPINE]+=.12*Math.max(0,drive)*work;
      out[P.HIPS_Q]-=.03*sway*work;
    }
  }
  if(id==='cradleHold' && role==='B'){
    // Attempts to extend the trapped leg; the free leg kicks harder for leverage.
    const kick=(.5+.5*Math.sin(w*1.35))*amp;
    out[P.FOOT_L+2]+=.018*kick;
    out[P.FOOT_R+2]-=.24*kick;
    out[P.FOOT_R+1]+=.08*kick;
  }
  if (mirror) mirrorLocal(out, out);
  const contacts=contactsAt(h.clip.contacts, role, 0, mirror, true);
  for(const contact of contacts){
    const source=h.clip.contacts?.find(c=>c.who===role && (mirror ? (c.hand==='L'?'R':'L') : c.hand)===contact.hand);
    if(source?.progressFade){
      const reach=Math.min(1,k/source.progressFade);
      contact.weight*=reach*reach*(3-2*reach);
    }
  }
  return contacts;
}

/** Scale positions of a frame-space pose for a body that is not 1.76 m. */
export function scalePose(lp: LocalPose, s: number): void {
  if (s === 1) return;
  for (const at of [P.HIPS, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.HAND_L, P.HAND_R, P.ELBOW_L, P.ELBOW_R]) {
    // Heights scale with the body; positions on the mat stay where the pair put them.
    lp[at + 1] *= s;
  }
  void _tmp;
}

/** Ball-of-foot anchors for paired leg entanglements; ordinary clips opt out. */
export function sampleFootContacts(id: string, role: Role, u: number, mirror: boolean, hold: boolean) {
  const list=(hold?holds.get(id)?.clip:moves.get(id)?.clip)?.footContacts;
  return contactsAt(list?.map(c=>({...c,hand:c.foot})),role,u,mirror,hold)
    .map(({hand,on,at,weight})=>{
      const contact=list?.find(c=>c.who===role&&(mirror?(c.foot==='L'?'R':'L'):c.foot)===hand);
      const gather=hold&&contact?.progressFade?Math.min(1,u/contact.progressFade):1;
      return {foot:hand,on,at,weight:weight*gather};
    });
}
