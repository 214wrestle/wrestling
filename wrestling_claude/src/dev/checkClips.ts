import '../anim/library';
import { hasMove, hasHold, sampleMove, sampleHold } from '../anim/clips';
import { createLocal } from '../anim/spec';
import { MOVES, HOLD_PLACES, SHOT_CLIPS, LEG_HOLDS } from '../sim/moves';

// A missing registered clip silently leaves a default pose in the renderer.
// Check the actual sim-to-animation contracts, including both mirrored roles.
for (const id of Object.keys(MOVES)) {
  if (!hasMove(id)) throw new Error(`Missing animation: ${id}`);
  for (const role of ['A', 'B'] as const) for (const mirror of [false, true]) for (let step = 0; step <= 20; step++) {
    const pose = createLocal();
    sampleMove(id, role, step / 20, mirror, pose);
    if (!pose.every(Number.isFinite)) throw new Error(`Invalid move pose: ${id}`);
  }
}
for (const id of Object.keys(HOLD_PLACES)) {
  if (!hasHold(id)) throw new Error(`Missing hold: ${id}`);
  for (const role of ['A', 'B'] as const) for (const mirror of [false, true]) for (const progress of [0, 0.5, 1]) {
    const pose = createLocal();
    sampleHold(id, role, progress, 0.4, 1, mirror, pose);
    if (!pose.every(Number.isFinite)) throw new Error(`Invalid hold pose: ${id}`);
  }
}
for (const shot of ['double', 'single', 'highCrotch'] as const) {
  if (!hasMove(SHOT_CLIPS[shot]) || !hasHold(LEG_HOLDS[shot])) throw new Error(`Incomplete attack: ${shot}`);
}
console.log('Every simulation move and hold has finite paired animation poses, including mirrored high crotches');
