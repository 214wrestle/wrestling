import { Quaternion, Vector3 } from 'three';
import { createPosture, P } from '../../../anim/posture';
import { Solver } from '../../../anim/solver';
import { createLocal, localToWorld } from '../../../anim/spec';
import { DEFAULT_STANCE, stancePose } from '../../../anim/stance';
import type { Rig } from '../shared';

/**
 * A collar-and-elbow tie for the match views, posed through the game's own
 * Solver: the same generated stance the harness uses, leaning in, with each
 * wrestler's lead hand cupping the back of the other's neck and the other hand
 * on the opponent's collar-tie elbow. Hand targets are read off the opponent's
 * solved skeleton and refined over a few passes, the way a paired clip would
 * hand its targets to the Solver in the game.
 */

const _v = new Vector3();
const _q = new Quaternion();
const _left = new Vector3();
const _back = new Vector3();
const _a = new Vector3();
const _b = new Vector3();

function sideVectors(r: Rig): void {
  r.bones.chest.getWorldQuaternion(_q);
  _left.set(1, 0, 0).applyQuaternion(_q);
  _back.set(0, 0, -1).applyQuaternion(_q);
}

export function makeTie(A: Rig, B: Rig): () => void {
  const solvers = [new Solver(A), new Solver(B)];
  const rigs = [A, B];
  const local = createLocal();
  const world = [createPosture(), createPosture()];
  const frames = [
    { x: -0.47, z: 0, yaw: Math.PI / 2 },
    { x: 0.47, z: 0, yaw: -Math.PI / 2 },
  ];

  const base = (i: number) => {
    const r = rigs[i];
    stancePose({ ...DEFAULT_STANCE, level: 0.38, lean: 0.6, lead: 1 }, local);
    // Lean the chest into the tie.
    local[P.SPINE] += 0.1;
    // Chin up, eyes level: the faces stay readable from the broadcast camera.
    local[P.HEAD] = -0.75;
    local[P.LOOK_W] = 0.35;
    const hipsY = local[P.HIPS + 1];
    // Collar-tie elbow down in front of the chest; the other elbow down and out.
    local[P.ELBOW_L] = 0.12;
    local[P.ELBOW_L + 1] = hipsY - 0.25;
    local[P.ELBOW_L + 2] = 0.5;
    local[P.ELBOW_R] = -0.5;
    local[P.ELBOW_R + 1] = hipsY - 0.3;
    local[P.ELBOW_R + 2] = 0.2;
    // Scale the frame-space pose for this body (the stance is authored for 1.76 m).
    for (const at of [P.HIPS, P.FOOT_L, P.FOOT_R, P.KNEE_L, P.KNEE_R, P.ELBOW_L, P.ELBOW_R]) {
      local[at] *= r.scale;
      local[at + 1] *= r.scale;
      local[at + 2] *= r.scale;
    }
    localToWorld(local, frames[i], world[i]);
  };

  const targets = (me: number) => {
    const opp = rigs[1 - me];
    const w = world[me];
    sideVectors(opp);
    // Collar tie: the wrist at the side of the opponent's neck, palm round the back of it.
    opp.bones.neck.getWorldPosition(_a);
    opp.bones.head.getWorldPosition(_b);
    _v.copy(_a).lerp(_b, 0.55).addScaledVector(_left, -0.065 * opp.scale).addScaledVector(_back, 0.035 * opp.scale);
    w[P.HAND_L] = _v.x;
    w[P.HAND_L + 1] = _v.y;
    w[P.HAND_L + 2] = _v.z;
    // The other hand cups the opponent's collar-tie elbow from outside.
    opp.bones.forearmL.getWorldPosition(_a);
    _v.copy(_a).addScaledVector(_left, 0.045 * opp.scale);
    _v.y -= 0.03;
    w[P.HAND_R] = _v.x;
    w[P.HAND_R + 1] = _v.y;
    w[P.HAND_R + 2] = _v.z;
    // Eyes on the opponent.
    opp.bones.head.getWorldPosition(_a);
    w[P.LOOK] = _a.x;
    w[P.LOOK + 1] = _a.y + 0.05;
    w[P.LOOK + 2] = _a.z;
    // Wrists: the collar hand flexes round the neck, the elbow hand cups.
    w[P.WRIST_L] = 0.5;
    w[P.WRIST_L + 1] = 0;
    w[P.WRIST_L + 2] = 0.6;
    w[P.WRIST_R] = 0.35;
    w[P.WRIST_R + 2] = -0.2;
  };

  return () => {
    base(0);
    base(1);
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < 2; i++) {
        solvers[i].apply(world[i]);
        rigs[i].root.updateMatrixWorld(true);
      }
      targets(0);
      targets(1);
    }
    for (let i = 0; i < 2; i++) {
      solvers[i].apply(world[i]);
      rigs[i].root.updateMatrixWorld(true);
    }
  };
}
