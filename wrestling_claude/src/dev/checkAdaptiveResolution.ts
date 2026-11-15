// Dynamic resolution (owner, November 14: fluid like a PlayStation game, on a phone): a device that keeps up never
// changes; a slow GPU renders fewer pixels until it keeps up and does not flip back and forth; a slow CPU (pixels do not
// help) gets its resolution back and is left alone; menus and pauses never count.
import { AdaptiveResolution, ADAPTIVE_RES } from '../engine/AdaptiveResolution';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); };
const run = (frame: (scale: number, t: number) => number, seconds: number, active = true) => {
  let scale = 1, changes = 0;
  const a = new AdaptiveResolution((s) => { scale = s; changes++; });
  for (let t = 0; t < seconds;) { const w = frame(scale, t); a.update(w, active); t += w; }
  return { scale, changes };
};
// A device that holds 60 (vsync at 16.7 ms).
{ const r = run(() => 1 / 60, 120); ok(r.changes === 0 && r.scale === 1, `60 fps: no change (scale ${r.scale}, ${r.changes} changes)`); }
// GPU-bound phone: 8 ms of script plus 17 ms of pixels at full size.
{
  const r = run((s) => 0.008 + 0.017 * s * s, 120);
  ok(r.scale < 1 && r.scale >= ADAPTIVE_RES.min, `GPU-bound: steps down (scale ${r.scale.toFixed(2)})`);
  ok(0.008 + 0.017 * r.scale * r.scale <= ADAPTIVE_RES.slow, `GPU-bound: ends fast enough (${(1 / (0.008 + 0.017 * r.scale * r.scale)).toFixed(0)} fps)`);
  ok(r.changes <= 4, `GPU-bound: settles instead of flipping (${r.changes} changes in 2 minutes)`);
}
// CPU-bound: 25 ms whatever the pixels.
{ const r = run(() => 0.025, 120); ok(r.scale === 1, `CPU-bound: resolution put back (scale ${r.scale.toFixed(2)})`); ok(r.changes === 2, `CPU-bound: one try, then left alone (${r.changes} changes)`); }
// Menus, pauses and hidden tabs never count.
{ const r = run((s) => 0.008 + 0.017 * s * s, 60, false); ok(r.changes === 0, 'inactive frames never change the resolution'); }
// A short hitch (one slow second) is not a slow device.
{ const r = run((_s, t) => (t > 10 && t < 11 ? 0.03 : 1 / 60), 60); ok(r.changes === 0, `a one-second hitch changes nothing (${r.changes} changes)`); }
console.log('Adaptive resolution: holds 60 untouched, steps down a slow GPU without flipping, leaves a slow CPU alone');
