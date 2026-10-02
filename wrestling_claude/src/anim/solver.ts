import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Bone } from 'three';
import { BONE_DEF } from '../body/skeleton';
import type { BoneName } from '../body/skeleton';
import { FOOT, P } from './posture';
import type { Posture } from './posture';

/**
 * Turns a posture into bone rotations.
 *
 * The pelvis is placed directly, the spine and neck are distributed bends, and
 * every limb is a two-bone IK chain aimed at its target with the middle joint
 * pushed toward a pole point. Hinges always bend about the bone's local X axis,
 * the same convention the mesh was skinned with.
 */

export interface SolverRig {
  bones: Record<BoneName, Bone>;
  scale: number;
}

const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const _mid = new Vector3();
const _end = new Vector3();
const _cRoot = new Vector3();
const _cDir = new Vector3();
const _cPole = new Vector3();
const _cMid = new Vector3();
const _cEnd = new Vector3();
const _cHinge = new Vector3();
const _cY = new Vector3();
const _cZ = new Vector3();
const _m = new Matrix4();
const _q1 = new Quaternion();
const _q2 = new Quaternion();
const _q3 = new Quaternion();
const _qUpperW = new Quaternion();
const _qLowerW = new Quaternion();
const _e = new Euler(0, 0, 0, 'YXZ');
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

interface ChainRest {
  l1: number;
  l2: number;
  /** Inverse of each bone's rest basis (hinge X, limb along -Y). */
  restInv1: Quaternion;
  restInv2: Quaternion;
}

function restBasisInverse(childOffset: readonly number[]): Quaternion {
  const dir = new Vector3(childOffset[0], childOffset[1], childOffset[2]).normalize();
  const y = dir.clone().negate();
  const x = new Vector3(1, 0, 0);
  // Make x exactly perpendicular to y.
  x.addScaledVector(y, -x.dot(y)).normalize();
  const z = new Vector3().crossVectors(x, y);
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return q.invert();
}

function chain(upperChild: BoneName, lowerChild: BoneName, scale: number): ChainRest {
  const a = BONE_DEF[upperChild].offset;
  const b = BONE_DEF[lowerChild].offset;
  return {
    l1: Math.hypot(a[0], a[1], a[2]) * scale,
    l2: Math.hypot(b[0], b[1], b[2]) * scale,
    restInv1: restBasisInverse(a),
    restInv2: restBasisInverse(b),
  };
}

export class Solver {
  private leg: ChainRest;
  private arm: ChainRest;
  private toeOffset: Vector3;
  private armOffsetL: Vector3;
  private armOffsetR: Vector3;
  private headEye: Vector3;
  /** World orientation of each upper bone after the last solve. */
  readonly worldQ = {} as Record<BoneName, Quaternion>;

  constructor(private rig: SolverRig) {
    const s = rig.scale;
    this.leg = chain('shinL', 'footL', s);
    this.arm = chain('forearmL', 'handL', s);
    const t = BONE_DEF.toeL.offset;
    this.toeOffset = new Vector3(t[0], t[1], t[2]).multiplyScalar(s);
    const al = BONE_DEF.armL.offset;
    const ar = BONE_DEF.armR.offset;
    this.armOffsetL = new Vector3(al[0], al[1], al[2]).multiplyScalar(s);
    this.armOffsetR = new Vector3(ar[0], ar[1], ar[2]).multiplyScalar(s);
    this.headEye = new Vector3(0, 0.09, 0.08).multiplyScalar(s);
    for (const name of Object.keys(rig.bones) as BoneName[]) this.worldQ[name] = new Quaternion();
  }

  get limbLengths() {
    return { thigh: this.leg.l1, shin: this.leg.l2, arm: this.arm.l1, forearm: this.arm.l2 };
  }

  apply(p: Posture): void {
    const b = this.rig.bones;

    // Pelvis.
    b.hips.position.set(p[P.HIPS], p[P.HIPS + 1], p[P.HIPS + 2]);
    b.hips.quaternion.set(p[P.HIPS_Q], p[P.HIPS_Q + 1], p[P.HIPS_Q + 2], p[P.HIPS_Q + 3]);

    // Spine: the bend is shared between the lumbar and thoracic segments.
    const sp = p[P.SPINE];
    const sy = p[P.SPINE + 1];
    const sr = p[P.SPINE + 2];
    b.spine.quaternion.setFromEuler(_e.set(sp * 0.45, sy * 0.45, sr * 0.45, 'YXZ'));
    b.chest.quaternion.setFromEuler(_e.set(sp * 0.55, sy * 0.55, sr * 0.55, 'YXZ'));
    b.neck.quaternion.identity();
    b.head.quaternion.identity();
    b.shoulderL.quaternion.identity();
    b.shoulderR.quaternion.identity();
    b.hips.updateMatrixWorld(true);

    // Head: authored angles, pulled toward the look target.
    let hp = p[P.HEAD];
    let hy = p[P.HEAD + 1];
    const hr = p[P.HEAD + 2];
    const lw = p[P.LOOK_W];
    if (lw > 0.001) {
      b.chest.getWorldQuaternion(_q1);
      b.head.getWorldPosition(_v1).add(_v2.copy(this.headEye).applyQuaternion(_q1));
      _v2.set(p[P.LOOK] - _v1.x, p[P.LOOK + 1] - _v1.y, p[P.LOOK + 2] - _v1.z);
      _v2.applyQuaternion(_q1.invert());
      const lookYaw = Math.atan2(_v2.x, _v2.z);
      const lookPitch = Math.atan2(-_v2.y, Math.hypot(_v2.x, _v2.z));
      hy += (clamp(lookYaw, -1.3, 1.3) - hy) * lw;
      hp += (clamp(lookPitch, -0.95, 1.0) - hp) * lw;
    }
    b.neck.quaternion.setFromEuler(_e.set(hp * 0.45, hy * 0.4, hr * 0.4, 'YXZ'));
    b.head.quaternion.setFromEuler(_e.set(hp * 0.55, hy * 0.6, hr * 0.6, 'YXZ'));

    // Legs.
    this.solveLeg(p, 'L');
    this.solveLeg(p, 'R');

    // Arms.
    b.chest.updateMatrixWorld(true);
    this.solveArm(p, 'L');
    this.solveArm(p, 'R');

    b.hips.updateMatrixWorld(true);
  }

  private solveLeg(p: Posture, side: 'L' | 'R'): void {
    const b = this.rig.bones;
    const thigh = b[`thigh${side}`];
    const shin = b[`shin${side}`];
    const foot = b[`foot${side}`];
    const toe = b[`toe${side}`];
    const f = side === 'L' ? P.FOOT_L : P.FOOT_R;
    const knee = side === 'L' ? P.KNEE_L : P.KNEE_R;

    // Foot orientation in the world, then the ankle that puts the ball on target.
    const yaw = p[f + FOOT.YAW];
    const heel = p[f + FOOT.HEEL];
    const roll = p[f + FOOT.ROLL];
    const footW = _q3.setFromEuler(_e.set(heel, yaw, roll, 'YXZ'));
    _v1.set(p[f], p[f + 1], p[f + 2]).sub(_v2.copy(this.toeOffset).applyQuaternion(footW));

    thigh.getWorldPosition(_v3);
    b.hips.getWorldQuaternion(_q1);
    _v2.set(p[knee], p[knee + 1], p[knee + 2]);
    this.solveChain(_v3, _v1, _v2, this.leg, true, _q1, thigh, shin);

    // Foot: local = shinWorld^-1 * footWorld.
    foot.quaternion.copy(_qLowerW).invert().multiply(footW);
    // Toes stay flat on the mat as the heel comes up.
    const flat = clamp(p[P.TOES + (side === 'L' ? 0 : 1)], 0, 1);
    const toeFlat = _q2.setFromEuler(_e.set(0, yaw, roll, 'YXZ'));
    _q1.copy(footW).invert().multiply(toeFlat);
    toe.quaternion.identity().slerp(_q1, flat);
  }

  private solveArm(p: Posture, side: 'L' | 'R'): void {
    const b = this.rig.bones;
    const clav = b[`shoulder${side}`];
    const arm = b[`arm${side}`];
    const fore = b[`forearm${side}`];
    const hand = b[`hand${side}`];
    const h = side === 'L' ? P.HAND_L : P.HAND_R;
    const e = side === 'L' ? P.ELBOW_L : P.ELBOW_R;
    const w = side === 'L' ? P.WRIST_L : P.WRIST_R;
    const sh = side === 'L' ? P.SHRUG_L : P.SHRUG_R;
    const sign = side === 'L' ? 1 : -1;

    const target = _v1.set(p[h], p[h + 1], p[h + 2]);
    b.chest.getWorldQuaternion(_q1);
    clav.getWorldPosition(_v3);

    // The shoulder girdle follows the reach a little: up for high hands,
    // forward for long ones.
    _v2.copy(target).sub(_v3).applyQuaternion(_q2.copy(_q1).invert());
    const reach = _v2.length() || 1;
    const dy = _v2.y / reach;
    const dz = _v2.z / reach;
    const over = Math.max(0, reach - (this.arm.l1 + this.arm.l2) * 0.85);
    const elev = p[sh] + clamp(dy, -0.4, 1) * 0.22;
    const prot = p[sh + 1] + clamp(dz, -0.6, 1) * 0.2 + Math.min(0.25, over * 1.5);
    clav.quaternion.setFromEuler(_e.set(0, -prot * sign, elev * sign, 'YXZ'));

    // Shoulder joint and the arm chain's parent orientation.
    const parentQ = _q2.copy(_q1).multiply(clav.quaternion);
    const offset = side === 'L' ? this.armOffsetL : this.armOffsetR;
    _v3.add(_mid.copy(offset).applyQuaternion(parentQ));
    _end.set(p[e], p[e + 1], p[e + 2]);
    this.solveChain(_v3, target, _end, this.arm, false, parentQ, arm, fore);

    hand.quaternion.setFromEuler(_e.set(p[w], p[w + 2] * sign, p[w + 1] * sign, 'YXZ'));
  }

  /**
   * Two-bone IK in world space. Writes local rotations for both bones and
   * leaves the lower bone's world rotation in _qLowerW.
   */
  private solveChain(
    rootIn: Vector3,
    targetIn: Vector3,
    poleIn: Vector3,
    c: ChainRest,
    isLeg: boolean,
    parentWorld: Quaternion,
    upper: Bone,
    lower: Bone,
  ): void {
    // Private copies: callers pass shared scratch vectors.
    const root = _cRoot.copy(rootIn);
    const dir = _cDir.copy(targetIn).sub(root);
    let dist = dir.length();
    if (dist < 1e-6) {
      dir.set(0, -1, 0);
      dist = 1e-6;
    } else {
      dir.divideScalar(dist);
    }
    dist = clamp(dist, Math.abs(c.l1 - c.l2) + 1e-3, (c.l1 + c.l2) * 0.9995);

    // Pole, projected perpendicular to the limb line.
    const pp = _cPole.copy(poleIn).sub(root);
    pp.addScaledVector(dir, -pp.dot(dir));
    if (pp.lengthSq() < 1e-10) {
      pp.crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y_AXIS : Z_AXIS);
      if (!isLeg) pp.negate();
    }
    pp.normalize();

    const a = (c.l1 * c.l1 - c.l2 * c.l2 + dist * dist) / (2 * dist);
    const hgt = Math.sqrt(Math.max(0, c.l1 * c.l1 - a * a));
    const mid = _cMid.copy(root).addScaledVector(dir, a).addScaledVector(pp, hgt);
    const end = _cEnd.copy(root).addScaledVector(dir, dist);

    // Hinge axis: normal of the bend plane.
    const hinge = _cHinge;
    if (isLeg) hinge.crossVectors(pp, dir);
    else hinge.crossVectors(dir, pp);
    hinge.normalize();

    // Upper bone basis: X = hinge, Y = back along the bone.
    const y = _cY.copy(mid).sub(root).normalize().negate();
    const z = _cZ.crossVectors(hinge, y);
    _m.makeBasis(hinge, y, z);
    _qUpperW.setFromRotationMatrix(_m).multiply(c.restInv1);

    y.copy(end).sub(mid).normalize().negate();
    z.crossVectors(hinge, y);
    _m.makeBasis(hinge, y, z);
    _qLowerW.setFromRotationMatrix(_m).multiply(c.restInv2);

    upper.quaternion.copy(parentWorld).invert().multiply(_qUpperW);
    lower.quaternion.copy(_qUpperW).invert().multiply(_qLowerW);
  }

  /** Re-aim one arm at a new wrist target, after both bodies are posed. */
  reachArm(p: Posture, side: 'L' | 'R'): void {
    this.solveArm(p, side);
    this.rig.bones[`shoulder${side}`].updateMatrixWorld(true);
  }
}
