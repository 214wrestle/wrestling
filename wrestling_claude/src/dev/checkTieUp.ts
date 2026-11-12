// Owner playtest, November 11: stamina ("Even when I'm just like head tapping and faking, I'm down to 0% stamina in the
// first period ... it needs to gradually go down ... on top, you should be recovering ... never at like 0 stamina
// unless it's like an overtime match") and tying up on the feet ("tie up and kind of pummel fight on your feet and fight
// for head position and underhooks ... that's where the throws come from ... There was no button to throw").
import { Bout, FATIGUE, TIE_UP, TAP_COST } from '../sim/bout';
import { PROTOTYPE_ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
import type { Command } from '../sim/types';
import { ContextControls } from '../game/contextControls';
import { readPrompts } from '../game/prompts';
import { MatchSim } from '../sim/MatchSim';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); };
const DT = 1 / 60;
const R = [PROTOTYPE_ROSTER[0], PROTOTYPE_ROSTER[1]] as const;
const spread = (s: number) => (s * 2654435761) >>> 0;
const tick = (b: Bout, frames: number, c0: Partial<Command> = {}, c1: Partial<Command> = {}) => {
  for (let i = 0; i < frames; i++) b.tick(DT, [{ ...NO_COMMAND, ...c0 }, { ...NO_COMMAND, ...c1 }]);
};
const neutral = (seed: number, gap = 0.95) => { const b = new Bout([R[0], R[1]], {}, spread(seed)); b.setNeutral({ x: 0, z: 0 }, 0, gap); tick(b, 20); return b; };

// --- Stamina ---------------------------------------------------------------------------------------------------
// A minute of fakes and head taps every half second at an arm's length: tired, not empty.
{
  const b = neutral(1, 1.25);
  for (let t = 0; t < 60; t += 0.5) { tick(b, 1, { fight: true }); tick(b, 29); }
  const s = b.athletes[0].stamina;
  ok(s > 0.4, `a minute of head taps leaves him above 40% (${(s * 100).toFixed(0)}%)`);
  ok(TAP_COST.fake < 0.01 && TAP_COST.reach < 0.01, 'a fake and a head tap are cheap');
}
// Gradual near empty in regulation; overtime has no cushion.
{
  const drain = (overtime: boolean) => {
    const b = neutral(2, 1.25); const a = b.athletes[0]; a.stamina = 0.2; b.overtime = overtime;
    (b as any).spend(a, 0.05); return 0.2 - a.stamina;
  };
  ok(drain(false) < drain(true) * 0.7, `near empty the drain slows in regulation, not in overtime (${drain(false).toFixed(3)} vs ${drain(true).toFixed(3)})`);
}
// A lead makes the work cheaper.
{
  const cost = (lead: number) => { const b = neutral(3, 1.25); b.scoreLead = [lead, -lead]; const a = b.athletes[0]; (b as any).spend(a, 0.1); return 1 - a.stamina; };
  ok(cost(8) < cost(0) * 0.8 && cost(-8) === cost(0), `leading by 8 the same work costs less (${cost(8).toFixed(3)} vs ${cost(0).toFixed(3)})`);
}
// On top and working: he still gets stamina back; ridden alone never empties the bottom man.
{
  const b = new Bout([R[0], R[1]], {}, spread(4)); b.setReferee(0, { x: 0, z: 0 }, 0); tick(b, 30);
  const [T, B] = b.athletes; T.stamina = 0.4; B.stamina = 0.6;
  for (let t = 0; t < 30; t += 0.6) { tick(b, 1, { fight: true }); tick(b, 35); if (b.position.kind !== 'mat') break; }
  ok(T.stamina > 0.4 || b.position.kind !== 'mat', `the rider chopping every 0.6 s still recovers (${(T.stamina * 100).toFixed(0)}%)`);
  const c = new Bout([R[0], R[1]], {}, spread(5)); c.setReferee(0, { x: 0, z: 0 }, 0); tick(c, 30);
  c.athletes[1].stamina = 0.32;
  tick(c, 60 * 40);
  ok(c.position.kind !== 'mat' || c.athletes[1].stamina >= FATIGUE.riddenFloor - 0.02, `ridden 40 s he does not drop under ${FATIGUE.riddenFloor} (${(c.athletes[1].stamina * 100).toFixed(0)}%)`);
}
// A stoppage gives a breath.
{
  const b = neutral(6, 1.25); b.athletes[0].stamina = 0.3; b.rest(5);
  ok(b.athletes[0].stamina > 0.4, 'five seconds of stoppage gives a breath back');
}
console.log('Stamina: taps cheap, gradual near empty (not in overtime), cheaper with a lead, rider recovers, ridden floor, rest at stoppages');

// --- Tying up ------------------------------------------------------------------------------------------------
// Close in, Hand fight ties up most of the time, and he usually ties back (head to head).
{
  let tied = 0, both = 0; const n = 200;
  for (let seed = 1; seed <= n; seed++) {
    const b = neutral(100 + seed, 0.95);
    tick(b, 1, { fight: true, tieUp: true }); tick(b, 40);
    const [a, o] = b.athletes;
    if (a.hand >= 0.62) { tied++; if (o.hand >= 0.62) both++; }
  }
  ok(tied / n > 0.55, `close in, one press ties up most of the time (${tied}/${n})`);
  ok(both / Math.max(1, tied) > 0.5, `and he usually ties back, head to head (${both}/${tied})`);
  console.log(`Tie up: one press ties ${tied}/${n}, head to head ${both}`);
  // The player's button: close in and untied it reads Tie up and asks for the tie.
  const b = neutral(77, 0.95); const ctl = new ContextControls();
  ok(ctl.map(DT, { x: 0, y: 0, shoot: false, fight: true, sprawl: false, level: false } as any, { x: 0, z: 0 }, b, 0).tieUp === true, 'close in, the player\'s Hand fight asks for the tie-up');
}
// Tied up: low hand fight pummels for the underhook; he keeps the overhook side, and his Hand fight is then the headlock.
{
  let hooks = 0, overhook = 0; const n = 120;
  for (let seed = 1; seed <= n; seed++) {
    const b = neutral(400 + seed, 0.9); const [a, o] = b.athletes;
    a.hand = 0.72; a.tie = 'collar'; o.hand = 0.66; o.tie = 'collar';
    tick(b, 1, { fight: true, level: true }); tick(b, 30, { level: true });
    if ((a.tie as string) === 'underhook' && a.hand >= 0.62) { hooks++; if (o.hand >= 0.62 && o.tie === 'collar') overhook++; }
  }
  ok(hooks > n * 0.3 && hooks < n * 0.9, `pummeling from the collar tie wins the underhook some of the time (${hooks}/${n})`);
  ok(overhook === hooks, `he keeps the overhook side (${overhook}/${hooks})`);
  const b = neutral(999, 0.9); const [a, o] = b.athletes;
  a.hand = 0.72; a.tie = 'underhook'; o.hand = 0.66; o.tie = 'collar';
  const ctl = new ContextControls();
  const pad: any = { x: 0, y: 0, shoot: false, fight: true, sprawl: false, level: false };
  ok(ctl.map(DT, pad, { x: 0, z: 0 }, b, 1).technique === 'headlock', 'over his underhook, Hand fight is the headlock (the throw on the button)');
  const ctl2 = new ContextControls();
  ok(ctl2.map(DT, { ...pad, level: true }, { x: 0, z: 0 }, b, 1).technique === undefined, 'and Lower + Hand fight pummels instead');
  console.log(`Pummel: collar to underhook ${hooks}/${n}, he keeps the overhook`);
}
// Tied up, moving drags him: circling keeps the pair together instead of breaking the tie.
{
  const b = neutral(7, 0.9); const [a, o] = b.athletes;
  a.hand = 0.72; a.tie = 'collar'; o.hand = 0.66; o.tie = 'collar';
  const start = { ...o.pos };
  for (let i = 0; i < 90; i++) {
    const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
    // Backing up and pulling him (half the time a step to the side too).
    const side = i < 45 ? 0 : 0.6;
    b.tick(DT, [{ ...NO_COMMAND, moveX: -dx / d * 0.8 - dz / d * side, moveZ: -dz / d * 0.8 + dx / d * side }, NO_COMMAND]);
  }
  const moved = Math.hypot(o.pos.x - start.x, o.pos.z - start.z);
  ok(a.hand >= 0.62 && b.distance() <= TIE_UP.hold + 0.12, `pulling him tied up keeps the tie (${b.distance().toFixed(2)} m)`);
  ok(moved > 0.5, `and drags him with him (${moved.toFixed(2)} m)`);
  console.log(`Move him around: backing up 1.5 s drags him ${moved.toFixed(2)} m, still tied at ${b.distance().toFixed(2)} m`);
}

// --- The buttons say it ------------------------------------------------------------------------------------------
// Close in and untied, Hand fight reads Tie up; over his underhook it reads Headlock (the throw); with a body lock,
// Lateral drop; out of tie range it is plain Hand fight.
{
  const sim: any = new MatchSim([R[0], R[1]], {}, 31);
  sim.phase = 'wrestling';
  const b: Bout = sim.bout; b.setNeutral({ x: 0, z: 0 }, 0, 0.95);
  const label = () => readPrompts(sim, 0).prompts.fight.label;
  const [a, o] = b.athletes;
  ok(label() === 'Tie up', `close in, Hand fight reads Tie up (${label()})`);
  b.setNeutral({ x: 0, z: 0 }, 0, 1.3);
  ok(label() === 'Hand fight', `a step out, it reads Hand fight (${label()})`);
  b.setNeutral({ x: 0, z: 0 }, 0, 0.9);
  a.hand = 0.66; a.tie = 'collar'; o.hand = 0.72; o.tie = 'underhook';
  ok(label() === 'Headlock', `over his underhook, Hand fight reads Headlock (${label()})`);
  a.hand = 0.9; a.tie = 'bodyLock'; o.hand = 0.3; o.tie = undefined;
  ok(label() === 'Lateral drop', `with a body lock, Lateral drop (${label()})`);
  a.hand = 0.72; a.tie = 'collar'; o.hand = 0.66; o.tie = 'collar';
  const read = readPrompts(sim, 0);
  ok(read.prompts.fight.label === 'Snap down' && /pummel/i.test(read.prompts.fight.alt ?? '') && read.meters[0]?.label === 'Tied up', `head to head: Snap down, Lower pummels, meter Tied up (${read.prompts.fight.label} / ${read.prompts.fight.alt} / ${read.meters[0]?.label})`);
  console.log('Buttons: Tie up close in, Headlock over his underhook, Lateral drop from a body lock, Tied up meter');
}
