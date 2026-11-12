// Owner, November 12: what the pace and brawler grades do in a match ("Pace and brawler"). Same man, graded
// differently: pace drives the AI's tempo and makes his own work on the feet cheaper; a brawler ties up more,
// pressures, circles less and wears the other man down; a finesse man (brawler 1) circles more and ties up less.
import { Bout, TIE_UP } from '../sim/bout';
import { WrestlerAI } from '../sim/ai';
import { PROTOTYPE_ROSTER, ROSTER } from '../sim/roster';
import { NO_COMMAND } from '../sim/types';
import type { Command, Wrestler } from '../sim/types';
import type { Position } from '../sim/bout';
import { applyStyleGrades } from '../sim/attributeRatings';
import { pinningMultiplier } from '../sim/careerAwards';
import { scorerStep } from '../sim/techFalls';
import { scorerPlan } from '../sim/strategy';
import { MatchSim } from '../sim/MatchSim';
const ok = (x: boolean, m: string) => { if (!x) throw Error(m); };
const DT = 1 / 60;
const base = PROTOTYPE_ROSTER[0];
const graded = (pace?: number, brawler?: number): Wrestler => {
  const w: Wrestler = { ...base, motion: undefined, styleGrades: { ...(pace ? { pace } : {}), ...(brawler ? { brawler } : {}) } };
  applyStyleGrades(w);
  return w;
};
/** The same man with researched ability grades (throws, physicality). */
const withGrades = (w: Wrestler, grades: Wrestler['grades']): Wrestler => ({ ...w, grades });
const opp = PROTOTYPE_ROSTER[1];

// --- Tendencies ---------------------------------------------------------------------------------------------
{
  const fast = graded(5).motion!, slow = graded(1).motion!, brawl = graded(undefined, 5).motion!, clean = graded(undefined, 1).motion!;
  ok(fast.tempo > 1.1 && slow.tempo < 0.9 && fast.attackRate > slow.attackRate, 'pace sets tempo and attack rate');
  ok(brawl.pressure > 1.1 && brawl.circle < 0.9 && clean.circle > 1.1 && brawl.handActivity > clean.handActivity, 'brawler pressures and circles less; finesse circles more');
  ok(graded().motion === undefined, 'ungraded: no change');
  const tom = ROSTER.find((w) => w.firstName === 'Tom' && w.lastName === 'Brands')!;
  ok((tom.motion?.pressure ?? 1) > 1.2 && tom.styleGrades?.brawler === 5, `Tom Brands (brawler 5) presses (${tom.motion?.pressure.toFixed(2)})`);
  const rby = ROSTER.find((w) => w.lastName === 'Bravo-Young')!;
  ok((rby.motion?.circle ?? 1) > 1.25, `Bravo-Young (finesse) circles (${rby.motion?.circle.toFixed(2)})`);
}

// --- Work cost: the same minute of hand fighting from range, pace 5 against pace 1 -----------------------------
const tick = (b: Bout, frames: number, c0: Partial<Command> = {}, c1: Partial<Command> = {}) => {
  for (let i = 0; i < frames; i++) b.tick(DT, [{ ...NO_COMMAND, ...c0 }, { ...NO_COMMAND, ...c1 }]);
};
const tapMinute = (w: Wrestler) => {
  const b = new Bout([w, opp], {}, 11); b.setNeutral({ x: 0, z: 0 }, 0, 1.25); tick(b, 20);
  const a = b.athletes[0]; a.stamina = 0.9;
  for (let i = 0; i < 120; i++) (b as any).spend(a, 0.005); // a minute of taps, two a second
  return 0.9 - a.stamina;
};
{
  const fast = tapMinute(graded(5)), even = tapMinute(graded()), slow = tapMinute(graded(1));
  ok(fast < even && even < slow, `a high-pace man's work costs less (pace 5 ${fast.toFixed(3)}, ungraded ${even.toFixed(3)}, pace 1 ${slow.toFixed(3)})`);
  console.log(`Work cost, a minute of taps: pace 5 ${(fast * 100).toFixed(1)}%, ungraded ${(even * 100).toFixed(1)}%, pace 1 ${(slow * 100).toFixed(1)}%`);
}

// --- Heavy hands: twenty seconds tied up with a brawler takes more out of you ------------------------------------
const tiedWith = (w: Wrestler) => {
  const b = new Bout([w, opp], {}, 12); b.setNeutral({ x: 0, z: 0 }, 0, 0.9); tick(b, 10);
  const [a, o] = b.athletes; a.hand = 0.8; a.tie = 'collar'; o.hand = 0.7; o.tie = 'collar'; o.stamina = 0.5;
  for (let i = 0; i < 20 * 60; i++) { a.hand = Math.max(a.hand, TIE_UP.lock); tick(b, 1); }
  return 0.5 - o.stamina;
};
{
  const brawl = tiedWith(graded(undefined, 5)), clean = tiedWith(graded(undefined, 1));
  ok(brawl > clean + 0.04, `tied with a brawler costs him more (${brawl.toFixed(3)} vs ${clean.toFixed(3)})`);
  console.log(`Twenty seconds tied up: his stamina cost with a brawler ${(brawl * 100).toFixed(1)}%, with a finesse man ${(clean * 100).toFixed(1)}%`);
}

// --- The AI: tie-ups and attacks per neutral minute, same man graded differently -----------------------------
const aiMinutes = (w: Wrestler, seeds = 24) => {
  let ties = 0, presses = 0, mins = 0;
  for (let s = 0; s < seeds; s++) {
    const b = new Bout([w, opp], { onTell: () => {} } as any, 100 + s); b.setNeutral({ x: 0, z: 0 }, 0, 1.4);
    const ai = new WrestlerAI(0, 'starter', 300 + s), ai1 = new WrestlerAI(1, 'starter', 500 + s);
    let was = 0;
    for (let i = 0; i < 60 * 30 && b.position.kind === 'neutral'; i++) {
      const c0 = ai.update(DT, b, true), c1 = ai1.update(DT, b, true);
      if (c0.fight || c0.shoot) presses++;
      b.tick(DT, [c0, c1]);
      const tied = b.athletes[0].hand >= 0.62 ? 1 : 0; if (tied && !was) ties++; was = tied;
      mins += DT / 60;
    }
  }
  return { ties: ties / mins, presses: presses / mins };
};
{
  const brawl = aiMinutes(graded(undefined, 5)), clean = aiMinutes(graded(undefined, 1));
  ok(brawl.ties > clean.ties * 1.2, `the AI brawler ties up more (${brawl.ties.toFixed(1)} vs ${clean.ties.toFixed(1)} a minute)`);
  const fast = aiMinutes(graded(5)), slow = aiMinutes(graded(1));
  ok(fast.presses > slow.presses * 1.15, `the AI high-pace man attacks more (${fast.presses.toFixed(1)} vs ${slow.presses.toFixed(1)} presses a minute)`);
  console.log(`AI per neutral minute: ties brawler ${brawl.ties.toFixed(1)} / finesse ${clean.ties.toFixed(1)}; presses pace 5 ${fast.presses.toFixed(1)} / pace 1 ${slow.presses.toFixed(1)}`);
}

// --- Throws and physicality (owner, November 12: "Throws and physicality") -------------------------------------
{
  const nickal = ROSTER.find((w) => w.firstName === 'Bo' && w.lastName === 'Nickal')!;
  ok(nickal.grades?.throws !== undefined && nickal.attributes.throws === nickal.abilities!.throws / 100, `a researched thrower's throws attribute is his throws category (${nickal.attributes.throws?.toFixed(2)})`);
  const mocco = ROSTER.find((w) => w.firstName === 'Steve' && w.lastName === 'Mocco')!;
  ok(mocco.attributes.strength === mocco.abilities!.physicality / 100, 'strength is his physicality');
  // From a body lock, Hand fight: lateral drops landed out of 200, and how many put him straight to his back.
  const drops = (thrower: Wrestler, victim: Wrestler) => {
    let n = 0, back = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const b = new Bout([thrower, victim], {}, seed); b.setNeutral({ x: 0, z: 0 }, 0, 0.8); tick(b, 20);
      const A = b.athletes[0]; A.hand = 0.9; A.tie = 'bodyLock';
      tick(b, 1, { fight: true });
      if ((b.position as Position).kind === 'move' && (b.position as any).id === 'lateralDrop') {
        n++;
        for (let i = 0; i < 120 && b.position.kind === 'move'; i++) tick(b, 1);
        const q = b.position as any; if (q.kind === 'mat' && q.sub === 'exposed' && !(q.flash > 0)) back++;
      }
    }
    return { n, back };
  };
  const plain = drops(base, opp), thrower = drops(withGrades(base, { throws: 5 }), opp), vsPhysical = drops(base, withGrades(opp, { physicality: 5 }));
  ok(thrower.n > plain.n + 10, `a throws-5 man lands more lateral drops (${thrower.n} vs ${plain.n} of 200)`);
  ok(vsPhysical.n < plain.n - 5, `a physicality-5 man is harder to throw (${vsPhysical.n} vs ${plain.n})`);
  console.log(`Lateral drops of 200 from a body lock: ungraded ${plain.n}, thrower ${thrower.n}, into a physical man ${vsPhysical.n}`);
  // Tied up and both pushing: the physical man moves the pair his way.
  const shove = (w: Wrestler) => {
    const b = new Bout([w, opp], {}, 5); b.setNeutral({ x: 0, z: 0 }, 0, 0.9); tick(b, 10);
    const [a, o] = b.athletes; a.hand = 0.8; a.tie = 'collar'; o.hand = 0.7; o.tie = 'collar';
    const start = { ...a.pos };
    for (let i = 0; i < 90; i++) {
      const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
      a.drive = 1; o.drive = 1; a.hand = Math.max(a.hand, 0.7); o.hand = Math.max(o.hand, 0.7);
      b.tick(DT, [{ ...NO_COMMAND, moveX: dx / d, moveZ: dz / d }, { ...NO_COMMAND, moveX: -dx / d, moveZ: -dz / d }]);
    }
    const dx = o.pos.x - start.x, dz = o.pos.z - start.z;
    return Math.hypot(a.pos.x - start.x, a.pos.z - start.z) * Math.sign(dx * (a.pos.x - start.x) + dz * (a.pos.z - start.z) || 1);
  };
  const strong = shove(withGrades(base, { physicality: 5 })), even = shove(base);
  ok(strong > even + 0.05, `pushing tied up, the physical man drives him back (${strong.toFixed(2)} m vs ${even.toFixed(2)} m)`);
  console.log(`Head to head pushing 1.5 s: physical man moves ${strong.toFixed(2)} m forward, ungraded ${even.toFixed(2)} m`);
  // The AI thrower goes for it more from a body lock.
  const tries = (w: Wrestler) => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const b = new Bout([w, opp], { onTell: () => {} } as any, seed); b.setNeutral({ x: 0, z: 0 }, 0, 0.8); tick(b, 20);
      const A = b.athletes[0]; A.hand = 0.9; A.tie = 'bodyLock';
      const ai = new WrestlerAI(0, 'starter', 40 + seed);
      for (let i = 0; i < 60; i++) { const c = ai.update(DT, b, true); if (c.technique === 'lateralDrop') { n++; break; } A.hand = 0.9; A.tie = 'bodyLock'; b.tick(DT, [NO_COMMAND, NO_COMMAND]); }
    }
    return n;
  };
  const keen = tries(withGrades(base, { throws: 5 })), usual = tries(base);
  ok(keen > usual * 1.3, `the AI thrower looks for the drop more (${keen} vs ${usual} of 300 in a second)`);
  console.log(`AI from a body lock, throws within a second: thrower ${keen}, ungraded ${usual} of 300`);
}

// --- Riding and turning (owner, November 12: "Riding and turning") ---------------------------------------------
{
  const retherford = ROSTER.find((w) => w.firstName === 'Zain' && w.lastName === 'Retherford')!;
  ok(retherford.attributes.riding === retherford.abilities!.riding / 100 && retherford.attributes.turning === retherford.abilities!.turning / 100, 'riding and turning are their own match attributes');
  ok((retherford.motion?.turnPreference ?? 1) > 1, 'a researched turner prefers turning');
  // AI on top against AI underneath from the referee's position, 25 s each: escapes and reversals given up, and
  // near-fall points scored, over 160 starts.
  const ride = (topMan: Wrestler) => {
    let escapes = 0, nearFall = 0, held = 0;
    for (let seed = 1; seed <= 160; seed++) {
      let esc = false;
      const b = new Bout([topMan, opp], { score: (side: number, kind: string) => { if (side === 1) esc = true; else if (/^nearFall\d$/.test(kind)) nearFall += Number(kind.slice(-1)); } } as any, 2000 + seed);
      b.setReferee(0, { x: 0, z: 0 }, 0);
      const ai = new WrestlerAI(0, 'starter', 60 + seed), ai1 = new WrestlerAI(1, 'starter', 90 + seed);
      for (let i = 0; i < 60 * 25 && !esc; i++) b.tick(DT, [ai.update(DT, b, true), ai1.update(DT, b, true)]);
      if (esc) escapes++; else held++;
    }
    return { escapes, nearFall, held };
  };
  const plain = ride(base), rider = ride(withGrades(base, { riding: 5 })), turner = ride(withGrades(base, { turning: 5 }));
  ok(rider.escapes < plain.escapes - 6, `a riding-5 man gives up fewer escapes (${rider.escapes} vs ${plain.escapes} of 160)`);
  ok(turner.nearFall > plain.nearFall * 1.15, `a turning-5 man scores more near-fall points (${turner.nearFall} vs ${plain.nearFall})`);
  console.log(`25 s on top, 160 starts: escapes/reversals given up ungraded ${plain.escapes}, rider ${rider.escapes}; near-fall points ungraded ${plain.nearFall}, turner ${turner.nearFall}, rider ${rider.nearFall}`);
}

// --- Pinning and bottom (owner, November 12: "Pinning and bottom") ---------------------------------------------
{
  ok(pinningMultiplier('Bo Nickal', 2) === 1.4, 'the owner\'s elite pinners keep 1.4 whatever the grade');
  ok(Math.abs(pinningMultiplier('Unknown Athlete', 2) - 1.2) < 1e-9 && Math.abs(pinningMultiplier('Unknown Athlete', -1) - 0.9) < 1e-9 && pinningMultiplier('Unknown Athlete') === 1, 'graded pin pressure: 5 is 1.2, 2 is 0.9, ungraded 1');
  // Half a second squeezing a man on his back (as check:pin-profile): pin pressure by grade.
  const squeeze = (top: Wrestler) => {
    const b = new Bout([top, opp], {}, 12);
    b.position = { kind: 'mat', A: 0, sub: 'exposed', t: 0, frame: { x: 0, z: 0, yaw: 0 }, base: .4, control: .5, escape: 0, expo: 0, awarded: 0, pin: 0, pinHold: 0, fight: 0, commit: 0, basing: 0, turnCool: 0, intensity: 0 } as any;
    for (let i = 0; i < 30; i++) b.tick(DT, [{ ...NO_COMMAND, shoot: true, sustainedEffort: true } as any, NO_COMMAND]);
    return (b.position as any).pin as number;
  };
  const pinner = squeeze(withGrades(base, { pinning: 5 })), even = squeeze(base), soft = squeeze(withGrades(base, { pinning: 1 }));
  ok(pinner > even * 1.1 && soft < even * 0.9, `pin pressure by grade (5: ${pinner.toFixed(3)}, ungraded ${even.toFixed(3)}, 1: ${soft.toFixed(3)})`);
  // Underneath from the referee's position, 25 s against the AI on top, 160 starts: how often he gets out.
  const out = (bottomMan: Wrestler) => {
    let n = 0;
    for (let seed = 1; seed <= 160; seed++) {
      let esc = false;
      const b = new Bout([opp, bottomMan], { score: (side: number) => { if (side === 1) esc = true; } } as any, 3000 + seed);
      b.setReferee(0, { x: 0, z: 0 }, 0);
      const ai = new WrestlerAI(0, 'starter', 160 + seed), ai1 = new WrestlerAI(1, 'starter', 190 + seed);
      for (let i = 0; i < 60 * 25 && !esc; i++) b.tick(DT, [ai.update(DT, b, true), ai1.update(DT, b, true)]);
      if (esc) n++;
    }
    return n;
  };
  const slick = out(withGrades(base, { bottom: 5 })), plain = out(base);
  ok(slick > plain + 6, `a bottom-5 man gets out more (${slick} vs ${plain} of 160)`);
  console.log(`Pin pressure in half a second: pinner ${pinner.toFixed(3)}, ungraded ${even.toFixed(3)}, non-pinner ${soft.toFixed(3)}; escapes/reversals in 25 s underneath: bottom-5 ${slick}, ungraded ${plain} of 160`);
}

// --- Shots and defense (owner, November 12: "Shots and defense") ---------------------------------------------------
{
  const dake = ROSTER.find((w) => w.firstName === 'Kyle' && w.lastName === 'Dake') ?? ROSTER[0];
  ok(dake.attributes.shots === dake.abilities!.shots / 100, 'shots is its own match attribute');
  const shooter = withGrades(base, { shots: 5 });
  applyStyleGrades(shooter);
  ok((shooter.motion?.attackRate ?? 1) > 1.1, 'a researched shooter shoots more');
  // AI against AI from neutral, 30 s each, 200 starts (tells wired as in MatchSim): takedowns he scores.
  const tds = (a: Wrestler, d: Wrestler) => {
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let td = false;
      const ais = [new WrestlerAI(0, 'starter', 260 + seed), new WrestlerAI(1, 'starter', 290 + seed)];
      const b = new Bout([a, d], { tell: (to: number, what: any) => ais[to].onTell(what), score: (side: number, kind: string) => { if (side === 0 && kind === 'takedown') td = true; } } as any, 4000 + seed);
      b.setNeutral({ x: 0, z: 0 }, 0, 1.4);
      for (let i = 0; i < 60 * 30 && !td; i++) b.tick(DT, [ais[0].update(DT, b, true), ais[1].update(DT, b, true)]);
      if (td) n++;
    }
    return n;
  };
  // Graded as the roster builds him: the category pulls his rating halfway to 97 (shots or defense 0.06 up from an
  // 85), plus the step effects and, for the shooter, the AI's attack rate.
  const full = (w: Wrestler, k: 'shots' | 'defense'): Wrestler => {
    const g = { ...withGrades(w, { [k]: 5 }), attributes: { ...w.attributes, [k]: (k === 'shots' ? w.attributes.quickness : w.attributes.defense) + 0.06 } };
    applyStyleGrades(g);
    return g;
  };
  const plain = tds(base, opp), shot = tds(full(base, 'shots'), opp), wall = tds(base, full(opp, 'defense'));
  ok(shot > plain + 10, `a shots-5 man scores more takedowns (${shot} vs ${plain} of 200)`);
  ok(wall < plain - 10, `against a defense-5 man he scores fewer (${wall} vs ${plain} of 200)`);
  console.log(`Takedowns in 30 s from neutral, 200 starts: ungraded ${plain}, shooter (5) ${shot}, into a defender (5) ${wall}`);
}

// --- Scrambling and explosiveness (owner, November 12: "Scrambling and explosiveness") --------------------------------
{
  const any = ROSTER.find((w) => w.grades?.scrambling === 5)!;
  ok(any.attributes.scrambling === any.abilities!.scrambling / 100, 'scrambling is its own match attribute');
  // Graded as the roster builds him: the category 0.06 up from an 85 plus the step effects.
  const scrambler = (w: Wrestler, g: number): Wrestler => ({ ...withGrades(w, { scrambling: g }), attributes: { ...w.attributes, scrambling: w.attributes.quickness + (g - 3) * 0.03 } });
  // He is being finished on (a double, before it is awarded) and scrambles: how often he breaks it up, 400 tries.
  const breakUps = (d: Wrestler) => {
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const b = new Bout([opp, d], {}, 5000 + seed * 7919); b.setNeutral({ x: 0, z: 0 }, 0, 1);
      for (let i = 0; i < 5; i++) (b as any).rng.next(); // consecutive seeds start with close draws
      (b as any).startMove('finishDouble', 0, (b as any).pairFrame(0), false);
      (b as any).requestScramble(b.athletes[1]);
      if (b.position.kind !== 'move') n++;
    }
    return n;
  };
  const slick = breakUps(scrambler(base, 5)), plain = breakUps(base), stiff = breakUps(scrambler(base, 1));
  ok(slick > plain + 20 && stiff < plain - 20, `a scrambler breaks up finishes more (5: ${slick}, ungraded ${plain}, 1: ${stiff} of 400)`);
  // A burst (a snap right as he reaches): an explosive man's move is quicker.
  const snapDur = (w: Wrestler) => {
    const b = new Bout([w, opp], {}, 7); b.setNeutral({ x: 0, z: 0 }, 0, 1);
    (b as any).startMove('snapDown', 0, (b as any).pairFrame(0), false);
    const before = (b.position as any).dur as number;
    (b as any).burst(1, 0);
    return (b.position as any).dur / before;
  };
  const pop = snapDur(withGrades(base, { explosiveness: 5 })), even = snapDur(base), flat = snapDur(withGrades(base, { explosiveness: 1 }));
  ok(pop < even && even < flat, `an explosive man's burst is quicker (5: ${pop.toFixed(3)}, ungraded ${even.toFixed(3)}, 1: ${flat.toFixed(3)} of the move's time)`);
  console.log(`Finishes broken up by a scramble, 400 tries: scrambler (5) ${slick}, ungraded ${plain}, (1) ${stiff}; a burst snap takes ${(pop * 100).toFixed(1)}% of the move's time (explosive 5), ${(even * 100).toFixed(1)}% ungraded, ${(flat * 100).toFixed(1)}% (1)`);
}

// --- Endurance and athleticism (owner, November 12: "Endurance and athleticism") -------------------------------------
{
  // A minute of taps (as the pace check), then 4 s breathing in stance from half a tank.
  const breathe = (w: Wrestler) => {
    const b = new Bout([w, opp], {}, 13); b.setNeutral({ x: 0, z: 0 }, 0, 2.2); tick(b, 10);
    const a = b.athletes[0]; a.stamina = 0.5;
    tick(b, 4 * 60);
    return a.stamina - 0.5;
  };
  const tank = withGrades(base, { endurance: 5 }), soft = withGrades(base, { endurance: 1 });
  const cost5 = tapMinute(tank), cost = tapMinute(base), cost1 = tapMinute(soft);
  ok(cost5 < cost * 0.95 && cost1 > cost * 1.05, `endurance: his work costs less (5: ${cost5.toFixed(3)}, ungraded ${cost.toFixed(3)}, 1: ${cost1.toFixed(3)})`);
  const back5 = breathe(tank), back = breathe(base), back1 = breathe(soft);
  ok(back5 > back * 1.05 && back1 < back * 0.95, `endurance: he breathes back faster (5: +${back5.toFixed(3)}, ungraded +${back.toFixed(3)}, 1: +${back1.toFixed(3)})`);
  // Off balance: a stumble after a stopped shot, and foot speed in stance.
  const stumble = (w: Wrestler) => {
    const b = new Bout([w, opp], {}, 14); b.setNeutral({ x: 0, z: 0 }, 0, 1.4);
    (b as any).setAct(b.athletes[0], 'stagger', 0.5);
    return b.athletes[0].actDur;
  };
  const run = (w: Wrestler) => {
    const b = new Bout([w, opp], {}, 15); b.setNeutral({ x: 0, z: 0 }, 0, 3); tick(b, 10);
    const x0 = b.athletes[0].pos.x, z0 = b.athletes[0].pos.z;
    tick(b, 60, { moveZ: 1 });
    return Math.hypot(b.athletes[0].pos.x - x0, b.athletes[0].pos.z - z0);
  };
  const ath = withGrades(base, { athleticism: 5 }), clumsy = withGrades(base, { athleticism: 1 });
  ok(stumble(ath) < stumble(base) && stumble(base) < stumble(clumsy), 'athleticism: back from a stumble sooner');
  const r5 = run(ath), r = run(base), r1 = run(clumsy);
  ok(r5 > r && r > r1, `athleticism: quicker feet (5: ${r5.toFixed(2)} m, ungraded ${r.toFixed(2)} m, 1: ${r1.toFixed(2)} m in a second)`);
  console.log(`Endurance: a minute of taps ${(cost5 * 100).toFixed(1)}% / ${(cost * 100).toFixed(1)}% / ${(cost1 * 100).toFixed(1)}% (5 / ungraded / 1); 4 s breathing +${(back5 * 100).toFixed(1)}% / +${(back * 100).toFixed(1)}% / +${(back1 * 100).toFixed(1)}%. Athleticism: a 0.5 s stumble lasts ${stumble(ath).toFixed(2)} / ${stumble(base).toFixed(2)} / ${stumble(clumsy).toFixed(2)} s; a second's run ${r5.toFixed(2)} / ${r.toFixed(2)} / ${r1.toFixed(2)} m`);
}

// --- Clutch and heart (owner, November 12: "Clutch and heart") -------------------------------------------------------
{
  const edgeIn = (w: Wrestler, late: boolean, lead: number) => {
    const b = new Bout([w, base], {}, 16); b.late = late; b.scoreLead = [lead, -lead];
    return (b as any).edge(0) as number;
  };
  const clutch = withGrades(base, { clutch: 5 }), choke = withGrades(base, { clutch: 1 }), heart = withGrades(base, { heart: 5 });
  ok(edgeIn(clutch, true, 0) > 0.13 && edgeIn(choke, true, -2) < -0.13, 'clutch: his edge late in a close match');
  ok(edgeIn(clutch, false, 0) === 0 && edgeIn(clutch, true, 6) === 0, 'clutch: nothing early or in a blowout');
  ok(edgeIn(heart, false, -4) > 0.09 && edgeIn(heart, false, 2) === 0, 'heart: his edge while trailing');
  // AI against AI from neutral in the third period, tied, 30 s each, 200 starts: takedowns he scores.
  const lateTds = (a: Wrestler) => {
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let td = false;
      const ais = [new WrestlerAI(0, 'starter', 660 + seed), new WrestlerAI(1, 'starter', 690 + seed)];
      const b = new Bout([a, opp], { tell: (to: number, what: any) => ais[to].onTell(what), score: (side: number, kind: string) => { if (side === 0 && kind === 'takedown') td = true; } } as any, 8000 + seed);
      b.late = true; b.setNeutral({ x: 0, z: 0 }, 0, 1.4);
      for (let i = 0; i < 60 * 30 && !td; i++) b.tick(DT, [ais[0].update(DT, b, true), ais[1].update(DT, b, true)]);
      if (td) n++;
    }
    return n;
  };
  const c5 = lateTds(clutch), c3 = lateTds(base), c1 = lateTds(choke);
  ok(c5 > c3 && c3 > c1 && c5 > c1 + 10, `clutch: more takedowns tied in the third (5: ${c5}, ungraded ${c3}, 1: ${c1} of 200)`);
  // Near empty: a minute of taps from 30%.
  const emptyMinute = (w: Wrestler) => {
    const b = new Bout([w, opp], {}, 11); b.setNeutral({ x: 0, z: 0 }, 0, 1.25); tick(b, 20);
    const a = b.athletes[0]; a.stamina = 0.3;
    for (let i = 0; i < 40; i++) (b as any).spend(a, 0.005);
    return 0.3 - a.stamina;
  };
  const e5 = emptyMinute(heart), e3 = emptyMinute(base);
  ok(e5 < e3 * 0.9, `heart: work near empty costs less (${e5.toFixed(4)} vs ${e3.toFixed(4)})`);
  console.log(`Clutch: takedowns tied in the third, 30 s, 200 starts — 5: ${c5}, ungraded ${c3}, 1: ${c1}. Heart: 20 s of taps from 30% costs ${(e5 * 100).toFixed(2)}% vs ${(e3 * 100).toFixed(2)}%`);
}

// --- Bonus-point scorer from career tech falls (owner, November 12: "Yes, use them") ------------------------------
{
  ok(scorerStep('David Taylor') === 2 && scorerStep('Mark Perry') === -1 && scorerStep('Unknown Athlete') === 0, 'scorer steps from tech falls per win');
  const named = (first: string, last: string): Wrestler => ({ ...base, firstName: first, lastName: last });
  const taylor = named('David', 'Taylor');
  const edgeUp = (w: Wrestler, lead: number) => { const b = new Bout([w, base], {}, 18); b.scoreLead = [lead, -lead]; return (b as any).edge(0) as number; };
  ok(edgeUp(taylor, 9) > 0.09 && edgeUp(taylor, 5) === 0, 'a scorer\'s edge once he is up by a major');
  const p = scorerPlan({ style: 'defensive', focus: 'none', top: 'ride' } as any, 6, 2);
  ok(p.style === 'balanced' && p.top === 'cut', 'a scorer\'s corner keeps wrestling and cuts him loose when ahead');
  ok(scorerPlan({ style: 'defensive', focus: 'none', top: 'ride' } as any, 6, 0).style === 'defensive', 'others still protect');
  // The AI corner's lead protection, 8 up: a +2 scorer keeps going, an ungraded man protects.
  const protects = (ai: Wrestler) => {
    const sim: any = new MatchSim([base, ai], {});
    sim.humanSide = 0; sim.score = [0, 8]; sim.protectLead();
    return !!sim.bout.plans[1].protect;
  };
  ok(!protects(taylor) && protects(base), 'up 8, a scorer does not protect the lead');
}

// --- The AI's choice of position (owner playtest, November 12: bottom almost always; top only for elite turners and
// pinners; neutral against an elite top man) -------------------------------------------------------------------------
{
  const who = (n: string) => ROSTER.find((w) => `${w.firstName} ${w.lastName}` === n)!;
  const pick = (ai: Wrestler, other: Wrestler) => (new MatchSim([other, ai], {}) as any).aiChoosePosition(1) as string;
  const plain = { ...base, grades: {} }, slick = { ...base, grades: { bottom: 4 } };
  ok(pick(who('Dan Gable'), plain) === 'top' && pick(who('David Taylor'), plain) === 'top', 'elite turners and pinners pick top');
  ok(pick(plain, opp) === 'bottom', 'everyone else picks bottom');
  ok(pick(plain, who('Zain Retherford')) === 'neutral' && pick(slick, who('Zain Retherford')) === 'bottom', 'neutral against an elite top man, unless he is strong underneath');
  let n = 0, top = 0;
  for (const a of ROSTER) for (const b of ROSTER) if (a !== b && a.weightClass === b.weightClass) { n++; if (pick(a, b) === 'top') top++; }
  ok(top / n < 0.12, `top is rare (${(top / n * 100).toFixed(1)}% of same-weight pairs)`);
  console.log(`AI position choice: top in ${(top / n * 100).toFixed(1)}% of same-weight pairs`);
}
