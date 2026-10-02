import { describe, it, expect } from 'vitest';
import { Match } from '../src/game/Match';
import { emptyControls, type Controls } from '../src/game/types';
import { nearFallPoints, ridingPoint, stallingPenalty } from '../src/game/rules';

function live(speed = 1) { const match = new Match({ clockSpeed: speed }, 811); match.start(); match.beginWrestling(); return match; }
function tick(m: Match, seconds: number, a: Partial<Controls> = {}, b: Partial<Controls> = {}) {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.step(1 / 60, { ...emptyControls(), ...a }, { ...emptyControls(), ...b });
}
describe('NCAA scoring invariants', () => {
  it('uses two, three and four near-fall counts without rounding early', () => {
    expect([0, 1.999, 2, 3, 4, 9].map(nearFallPoints)).toEqual([0, 0, 2, 3, 4, 4]);
  });
  it('awards only a net minute of riding time', () => {
    expect(ridingPoint(90, 31)).toBeNull(); expect(ridingPoint(90, 30)).toBe(0); expect(ridingPoint(0, 60)).toBe(1);
  });
  it('implements the escalating stalling sequence', () => {
    expect([1, 2, 3, 4, 5].map(stallingPenalty)).toEqual([0, 1, 1, 2, 'disqualification']);
  });
  it('ends at a fifteen-point advantage', () => {
    const m = live(); m.award(0, 12, 'TAKEDOWN'); expect(m.state.result).toBeNull();
    m.award(0, 3, 'TAKEDOWN'); expect(m.state.result?.method).toBe('Technical fall');
  });
  it('does not double award a near fall when a hold is released', () => {
    const m = live(); m.setGround(0); m.state.exposure = 4.2; m.state.nearFallCount = 4.2;
    expect(m.state.score).toEqual([0, 0]); m.releaseNearFall(); m.releaseNearFall(); expect(m.state.score).toEqual([4, 0]);
  });
  it('requires pressure and a continuous second with both shoulders down for a fall', () => {
    const m = live(); m.setGround(0); m.state.exposure = 2; m.state.nearFallCount = 2; m.state.control = 97;
    tick(m, 0.85, { primaryHeld: true }); expect(m.state.result).toBeNull();
    tick(m, 0.4, { primaryHeld: true }); expect(m.state.result?.method).toBe('Fall');
  });
  it('a defensive bridge breaks the pin count', () => {
    const m = live(); m.setGround(0); m.state.exposure = 2; m.state.nearFallCount = 2; m.state.control = 97;
    tick(m, 0.6, { primaryHeld: true }); expect(m.state.pin).toBeGreaterThan(0);
    tick(m, 0.1, { primaryHeld: true }, { defend: true }); expect(m.state.pin).toBe(0); expect(m.state.result).toBeNull();
  });
});
describe('match flow and timekeeping', () => {
  it('pauses simulation and input while paused', () => {
    const m = live(); m.pause(); const snapshot = structuredClone(m.state);
    tick(m, 3, { primary: true, x: 1 }); expect(m.state).toEqual(snapshot);
  });
  it('offers a second-period position choice and honors deferral', () => {
    const m = live(); m.state.firstChoice = 0; m.state.secondChoice = 1; m.endPeriod();
    expect(m.state.period).toBe(2); expect(m.state.remaining).toBe(120); expect(m.state.choiceFor).toBe(0);
    m.choose('defer'); expect(m.state.choiceFor).toBe(1); expect(m.state.secondChoice).toBe(0);
    m.choose('bottom'); expect(m.state.top).toBe(0); expect(m.state.phase).toBe('wrestling');
    m.endPeriod(); expect(m.state.choiceFor).toBe(0); expect(m.state.canDefer).toBe(false);
  });
  it('adds riding time once at the end of regulation, then enters overtime if tied', () => {
    const m = live(); m.state.period = 3; m.state.score = [2, 3]; m.state.riding = [61, 0]; m.endPeriod();
    expect(m.state.score).toEqual([3, 3]); expect(m.state.stage).toBe('sudden'); expect(m.state.remaining).toBe(120);
    m.endPeriod(); expect(m.state.score).toEqual([3, 3]); expect(m.state.stage).toBe('tiebreak1');
  });
  it('the first sudden-victory score wins', () => {
    const m = live(); m.state.period = 3; m.endPeriod(); m.award(1, 3, 'TAKEDOWN');
    expect(m.state.result).toMatchObject({ winner: 1, method: 'Sudden victory' });
  });
  it('allows the entire pair of tiebreakers, then decides by overtime riding time', () => {
    const m = live(); m.state.period = 3; m.endPeriod(); m.endPeriod();
    expect(m.state.stage).toBe('tiebreak1'); m.award(0, 1, 'ESCAPE'); expect(m.state.result).toBeNull();
    m.endPeriod(); expect(m.state.stage).toBe('tiebreak2'); expect(m.state.result).toBeNull();
    m.award(1, 1, 'ESCAPE'); m.state.overtimeRiding = [20, 18]; m.endPeriod();
    expect(m.state.result).toMatchObject({ winner: 0, method: 'Riding time' });
  });
  it('uses a one-minute sudden-victory period in later overtime rounds', () => {
    const m = live(); m.state.period = 3; for (let i = 0; i < 4; i++) m.endPeriod();
    expect(m.state.stage).toBe('sudden'); expect(m.state.overtimeRound).toBe(2); expect(m.state.remaining).toBe(60);
  });
  it('clips riding time at the horn even in accelerated mode', () => {
    const m = live(2); m.setGround(0); m.state.remaining = 0.01;
    m.step(1 / 60, emptyControls(), emptyControls()); expect(m.state.riding[0]).toBeCloseTo(0.01, 5);
  });
  it('restarts only when both athletes have left the competition circle', () => {
    const m = live(); m.state.wrestlers[0].x = 5.5; m.state.wrestlers[1].x = 4;
    tick(m, 0.1); expect(m.state.restartTime).toBe(0);
    m.state.wrestlers[0].x = 5.4; m.state.wrestlers[1].x = 6.7; tick(m, 0.1); expect(m.state.restartTime).toBeGreaterThan(0); expect(m.state.score).toEqual([0, 0]);
  });
  it('a rematch clears scores, positions, warnings and riding time', () => {
    const m = live(); m.award(0, 3, 'TAKEDOWN'); m.setGround(0); m.stall(1); tick(m, 2); m.start();
    expect(m.state.score).toEqual([0, 0]); expect(m.state.riding).toEqual([0, 0]); expect(m.state.top).toBeNull(); expect(m.state.wrestlers[1].warnings).toBe(0); expect(m.state.phase).toBe('intro');
  });
  it('does not let an escape determine first offensive scoring choice', () => {
    const m = live(); m.award(0, 1, 'ESCAPE'); expect(m.state.firstScorer).toBeNull();
    m.award(1, 3, 'TAKEDOWN'); expect(m.state.firstScorer).toBe(1);
  });
  it('allows the first tiebreaker chooser to defer', () => {
    const m = live(); m.state.firstScorer = 0; m.state.period = 3; m.endPeriod(); m.endPeriod();
    expect(m.state.choiceFor).toBe(0); expect(m.state.canDefer).toBe(true);
    m.choose('defer'); expect(m.state.choiceFor).toBe(1); m.choose('bottom'); m.endPeriod();
    expect(m.state.choiceFor).toBe(0); expect(m.state.canDefer).toBe(false);
  });
  it('awards final near-fall and riding points together before deciding technical fall', () => {
    const m = live(); m.state.period = 3; m.state.score = [11, 0]; m.state.riding = [0, 70];
    m.setGround(0); m.state.exposure = 4.1; m.state.nearFallCount = 4.1; m.endPeriod();
    expect(m.state.score).toEqual([15, 1]); expect(m.state.result?.method).toBe('Major decision');
  });
  it('does not complete an attack after the horn on a fractional final frame', () => {
    const m = live(2); m.state.remaining = 0.001;
    m.state.exchange = { kind: 'takedown', actor: 0, age: 0.84, duration: 0.85, quality: 1, startX: 0, startZ: 0, directionX: 1, directionZ: 0 };
    m.step(1 / 60, emptyControls(), emptyControls()); expect(m.state.score).toEqual([0, 0]); expect(m.state.phase).toBe('break');
  });
});
describe('wrestling interactions', () => {
  it('buffers a late follow-up without mutating caller controls', () => {
    const m = live(); m.state.wrestlers[0].x = -0.7; m.state.wrestlers[1].x = 0.7;
    m.state.wrestlers[0].cooldown = 0.18;
    const press = { ...emptyControls(), setup: true }, idle = emptyControls();
    m.step(1 / 60, press, idle); expect(m.state.wrestlers[0].setup).toBe(0);
    for (let i = 0; i < 15; i++) m.step(1 / 60, idle, idle);
    expect(m.state.wrestlers[0].setup).toBeGreaterThan(0.3); expect(idle).toEqual(emptyControls());
  });
  it('expires early presses so actions do not fire unexpectedly much later', () => {
    const m = live(); m.state.wrestlers[0].cooldown = 0.8;
    m.step(1 / 60, { ...emptyControls(), primary: true }, emptyControls()); tick(m, 1);
    expect(m.state.wrestlers[0].attempts).toBe(0);
  });
  it('accelerates into a step and brakes quickly when released', () => {
    const m = live(); m.state.wrestlers[0].x = -3;
    m.step(1 / 60, { ...emptyControls(), z: 1 }, emptyControls());
    expect(m.state.wrestlers[0].speed).toBeGreaterThan(0); expect(m.state.wrestlers[0].speed).toBeLessThan(0.5);
    tick(m, 0.2, { z: 1 }); expect(m.state.wrestlers[0].speed).toBeGreaterThan(1);
    tick(m, 0.2); expect(m.state.wrestlers[0].speed).toBe(0);
  });
  it('keeps neutral body spacing under sustained inward movement', () => {
    const m = live(); tick(m, 2, { x: 1 }, { x: -1 }); expect(m.distance()).toBeGreaterThanOrEqual(0.979);
  });
  it('preserves the approach heading when establishing mat control', () => {
    const m = live(); m.state.wrestlers[0].heading = 0.6; m.setGround(0);
    expect(m.state.wrestlers[1].heading).toBeCloseTo(0.6);
    const [a, b] = m.state.wrestlers; expect((b.x - a.x) * Math.sin(0.6) + (b.z - a.z) * Math.cos(0.6)).toBeCloseTo(0.6);
  });
  it('does not award points for out-of-range attacks', () => {
    const m = live(); m.state.wrestlers[0].x = -3; m.state.wrestlers[1].x = 3;
    tick(m, 2, { primary: true }); expect(m.state.score).toEqual([0, 0]); expect(m.state.top).toBeNull();
  });
  it('a set-up shot scores three and establishes top control', () => {
    const m = live(); m.state.wrestlers[0].x = -0.7; m.state.wrestlers[1].x = 0.7; m.state.wrestlers[0].setup = 0.9;
    m.step(1 / 60, { ...emptyControls(), primary: true }, emptyControls()); tick(m, 2);
    expect(m.state.score).toEqual([3, 0]); expect(m.state.top).toBe(0);
  });
  it('a timely sprawl stops an unprepared double leg', () => {
    const m = live(); m.state.wrestlers[0].x = -0.7; m.state.wrestlers[1].x = 0.7;
    m.step(1 / 60, { ...emptyControls(), primary: true }, { ...emptyControls(), defend: true }); tick(m, 2, {}, { defend: true });
    expect(m.state.score).toEqual([0, 0]); expect(m.state.top).toBeNull(); expect(m.state.wrestlers[1].setup).toBeGreaterThan(0);
  });
  it('an optional release awards exactly one escape point', () => {
    const m = live(); m.setGround(0); m.state.wrestlers[0].cooldown = 0;
    m.step(1 / 60, { ...emptyControls(), setup: true }, emptyControls()); tick(m, 1);
    expect(m.state.score).toEqual([0, 1]); expect(m.state.top).toBeNull();
  });
});
