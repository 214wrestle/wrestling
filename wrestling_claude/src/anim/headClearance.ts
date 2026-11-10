import { Quaternion, Vector3 } from 'three';
import type { Animator } from './Animator';

/**
 * Heads never pass through the other wrestler. Each body is posed from its own clip, so in ties,
 * head-to-head hand fighting, front headlocks and shots a head could sink into the opponent's head,
 * neck or torso. After both poses are solved (and before hands grip, so grips follow), each head is
 * tested as a sphere against the other man's head, neck and torso capsules; where it is inside, the
 * neck (and, for a deep overlap, the upper chest) tips just enough to bring it back to the surface.
 * Contact the clips author — forehead to forehead, crown in the ribs, a head under the chest — stays
 * touching; only overlap is removed.
 */

interface Capsule { a: Vector3; b: Vector3; r: number }

// A head is about 15 cm wide and 20 cm front to back; a sphere this size lets heads meet side by side in a tie.
const HEAD_R = 0.088;
const tmp = new Vector3();

function headCenter(an: Animator, out: Vector3): Vector3 {
  const head = an.character.bones.head;
  head.updateWorldMatrix(true, false);
  return out.set(0, 0.075 * an.scale, 0.02 * an.scale).applyMatrix4(head.matrixWorld);
}

function joint(an: Animator, name: 'hips' | 'spine' | 'chest' | 'neck' | 'head'): Vector3 {
  return an.character.bones[name].getWorldPosition(new Vector3());
}

/** The other man's solid parts a head can hit: head, neck, rib cage and belly. */
function volumes(an: Animator): Capsule[] {
  const s = an.scale;
  const hips = joint(an, 'hips'), spine = joint(an, 'spine'), chest = joint(an, 'chest'), neck = joint(an, 'neck');
  const hc = headCenter(an, new Vector3());
  // The rib cage ends below the shoulder line; the neck joint sits at the base of the neck.
  const ribTop = chest.clone().lerp(neck, 0.8);
  return [
    { a: hc, b: hc.clone(), r: HEAD_R * s },
    { a: neck, b: hc.clone().lerp(neck, 0.45), r: 0.055 * s },
    { a: chest, b: ribTop, r: 0.125 * s },
    { a: hips, b: spine.lerp(chest, 0.5), r: 0.13 * s },
  ];
}

function closest(p: Vector3, c: Capsule, out: Vector3): Vector3 {
  const ab = tmp.copy(c.b).sub(c.a);
  const len2 = ab.lengthSq();
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, out.copy(p).sub(c.a).dot(ab) / len2)) : 0;
  return out.copy(c.a).addScaledVector(ab, t);
}

/** Review only: how deep a head is inside each of the other man's parts (head, neck, ribs, belly), metres. */
export function overlapParts(head: Animator, body: Animator): Record<'head' | 'neck' | 'ribs' | 'belly', number> {
  const hc = headCenter(head, new Vector3());
  const r = HEAD_R * head.scale;
  const q = new Vector3();
  const [h, n, ribs, belly] = volumes(body).map(c => Math.max(0, r + c.r - hc.distanceTo(closest(hc, c, q))));
  return { head: h, neck: n, ribs, belly };
}

/** How far (and which way) a head must move to leave the other body; zero when clear. */
export function headOverlap(head: Animator, body: Animator, out = new Vector3()): Vector3 {
  out.set(0, 0, 0);
  const hc = headCenter(head, new Vector3());
  const r = HEAD_R * head.scale;
  const q = new Vector3();
  for (const c of volumes(body)) {
    closest(hc, c, q);
    const d = hc.distanceTo(q);
    const pen = r + c.r - d;
    if (pen <= 0) continue;
    // Coincident centres: push back along the head's own facing.
    const n = d > 1e-5 ? q.sub(hc).multiplyScalar(-1 / d) : new Vector3(0, 1, 0);
    // Keep the larger push along each direction rather than summing overlapping volumes.
    const along = out.dot(n);
    if (pen > along) out.addScaledVector(n, pen - Math.max(0, along));
  }
  return out;
}

const qa = new Quaternion(), qb = new Quaternion(), qc = new Quaternion();

/** Rotates a bone about its own joint so that a point it carries moves by `move` (perpendicular part). */
function swing(an: Animator, name: 'neck' | 'chest', point: Vector3, move: Vector3, maxAngle: number): Vector3 {
  const bone = an.character.bones[name];
  bone.updateWorldMatrix(true, false);
  const pivot = bone.getWorldPosition(new Vector3());
  const arm = point.clone().sub(pivot);
  const len = arm.length();
  if (len < 1e-4) return new Vector3();
  const axis = new Vector3().crossVectors(arm, move);
  const sin = axis.length() / (len * len);
  if (sin < 1e-5) return new Vector3();
  axis.normalize();
  const angle = Math.min(maxAngle, Math.atan(sin));
  // World rotation about the joint, expressed in the bone's parent space.
  qa.setFromAxisAngle(axis, angle);
  bone.parent!.getWorldQuaternion(qb);
  bone.getWorldQuaternion(qc);
  bone.quaternion.copy(qb.clone().invert().multiply(qa).multiply(qc));
  bone.updateWorldMatrix(false, true);
  return arm.clone().applyQuaternion(qa).sub(arm);
}

/**
 * Moves one head out of the other body: the neck tips first, then the upper chest, and whatever is
 * left (a head buried in a front headlock or on a shot) slides the body back along the mat.
 */
function clearHead(head: Animator, push: Vector3, chest = true, slide = true): Vector3 {
  if (push.lengthSq() < 1e-8) return new Vector3();
  const hc = headCenter(head, new Vector3());
  const moved = swing(head, 'neck', hc, push, 0.55);
  const rest = push.clone().sub(moved);
  // The chest carries the arms, so it tips only a little (a hand 60 cm out moves far for a small angle).
  if (chest && rest.length() > 0.004 * head.scale) rest.sub(swing(head, 'chest', hc.add(moved), rest, 0.12));
  if (slide) slideBody(head, rest);
  return rest;
}

/** Slides a whole body along the mat (no vertical move) so its head leaves the other body. */
function slideBody(an: Animator, push: Vector3): void {
  const flat = new Vector3(push.x, 0, push.z);
  const len = flat.length();
  if (len < 0.004 * an.scale) return;
  flat.multiplyScalar(Math.min(len, 0.15 * an.scale) / len);
  const hips = an.character.bones.hips;
  const parent = hips.parent!;
  parent.updateWorldMatrix(true, false);
  const world = hips.getWorldPosition(new Vector3());
  const from = parent.worldToLocal(world.clone());
  const to = parent.worldToLocal(world.add(flat));
  hips.position.add(to.sub(from));
  hips.updateWorldMatrix(false, true);
}

/** The correction each head currently carries, eased frame to frame so it never jumps. */
const applied = new WeakMap<Animator, Vector3>();
/** The extra correction for an overlap deeper than 4 cm, which follows faster but still never jumps. */
const deepApplied = new WeakMap<Animator, Vector3>();

function chase(store: WeakMap<Animator, Vector3>, an: Animator, target: Vector3, maxSpeed: number, dt: number): Vector3 {
  const cur = store.get(an) ?? new Vector3();
  const step = target.clone().sub(cur);
  if (step.length() > maxSpeed * dt) step.setLength(maxSpeed * dt);
  cur.add(step);
  store.set(an, cur);
  return cur.clone();
}

/** Eases a head's correction toward what this frame needs: quickly, but never faster than 3 m/s. */
function ease(an: Animator, target: Vector3, dt: number): Vector3 {
  const cur = applied.get(an) ?? new Vector3();
  const step = target.clone().sub(cur).multiplyScalar(1 - Math.exp(-dt / 0.03));
  const max = 3 * dt;
  if (step.length() > max) step.setLength(max);
  cur.add(step);
  applied.set(an, cur);
  return cur.clone();
}

/**
 * Resolve both heads against the other body. Head-to-head overlap is shared; a head inside the
 * other's neck or torso is the head's to clear (the torso is the heavier, held part of the pose).
 * The correction eases in and out over a few frames, so a head meeting or leaving contact never pops.
 * `slide` allows the last-resort slide along the mat; only in paired holds (front headlock, shots), where
 * the bodies are locked together. In open stance the footwork owns the body, and shifting it there on top
 * of the footwork made the arms pop.
 */
export function resolveHeadClearance(a: Animator, b: Animator, dt = 1 / 60, slide: [boolean, boolean] = [true, true]): void {
  const pa = headOverlap(a, b), pb = headOverlap(b, a);
  if (pa.lengthSq() > 1e-8 && pb.lengthSq() > 1e-8) { pa.multiplyScalar(0.5); pb.multiplyScalar(0.5); }
  // A little extra, since tipping the neck moves the head on an arc and under-delivers slightly.
  clearHead(a, ease(a, pa.multiplyScalar(1.1), dt), true, slide[0]);
  clearHead(b, ease(b, pb.multiplyScalar(1.1), dt), true, slide[1]);
  // Never deep inside, even while the easing catches up: anything past 4 cm follows at up to 6 m/s,
  // with the neck and a slide only (no chest tip that would swing the arms).
  for (const [h, o, i] of [[a, b, 0], [b, a, 1]] as const) {
    const left = headOverlap(h, o);
    const deep = left.length() - 0.04 * h.scale;
    clearHead(h, chase(deepApplied, h, deep > 0 ? left.setLength(deep) : new Vector3(), 6, dt), false, slide[i]);
  }
}
