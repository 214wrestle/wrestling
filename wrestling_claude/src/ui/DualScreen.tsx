import { useEffect, useState } from 'react';
import { byId } from '../sim/roster';
import { choiceFor, currentBout, dualWinner, pickList, teamName, teamScore, type DualBout } from '../sim/dual';
import type { GameApi, UiState } from '../game/store';
import { Key } from './glyphs';
import { Tile } from './TitleScreen';

const weightLabel = (w: number) => (w === 285 ? 'HWT' : `${w} lbs`);
const SHORT: Record<string, string> = {
  fall: 'Fall',
  'technical-fall': 'Tech fall',
  'major-decision': 'Major',
  decision: 'Dec',
  'sudden-victory': 'SV',
  tiebreaker: 'TB',
};

/** One line on a finished bout: who won, how, the score and the team points. */
function boutLine(b: DualBout): string {
  const r = b.result!;
  const how = SHORT[r.type] ?? r.type;
  const score = r.type === 'fall' ? '' : ` ${r.score[r.winner]}–${r.score[r.winner === 0 ? 1 : 0]}`;
  return `${how}${score} · +${r.teamPoints}${r.simulated ? ' · sim' : ''}`;
}

/**
 * The dual meet between bouts (owner, November 10): the team score, the bout sheet, and at the weight up next their
 * starter and your pick list, highest rating first, with nothing picked for you.
 */
export function DualScreen({ state, api }: { state: UiState; api: GameApi }) {
  const d = state.dual!;
  const [busy, setBusy] = useState(false);
  const score = teamScore(d);
  const bout = currentBout(d);
  const index = bout ? d.bouts.indexOf(bout) : d.bouts.length;
  const done = !bout;
  const final = done ? dualWinner(d) : null;
  const names = [teamName(d.teams[0]), teamName(d.teams[1])];
  const sim = () => {
    // Let the button show its state before the bout runs (a few tenths of a second).
    setBusy(true);
    window.setTimeout(() => { api.simDual(); setBusy(false); }, 30);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && bout?.ours && choiceFor(d, bout) !== null) api.wrestleDual();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let running: [number, number] = [0, 0];
  return (
    <div className="title dual">
      <aside className="title__panel">
        <header className="dual__board" aria-label="Team score">
          {([0, 1] as const).map((side) => (
            <div key={side} className={`dual__team dual__team--${side ? 'r' : 'l'}`}>
              <span className={`tape__corner tape__corner--${side ? 'green' : 'red'}`} />
              <span className="dual__name">{names[side]}</span>
              <span className="dual__score">{score[side]}</span>
            </div>
          ))}
          <div className="dual__meta">Dual meet · {done ? 'Final' : `Bout ${index + 1} of ${d.bouts.length}`}{bout && bout.weight === d.marquee ? ' · Marquee bout' : ''}</div>
        </header>

        {d.toss.odd === undefined ? (
          <section className="field dual__toss">
            <h2>Coin toss</h2>
            <p className="dual__winner">{names[0]} win{names[0].endsWith('S') ? '' : 's'} the toss</p>
            <p className="field__note">Pick odd or even bouts. In those bouts your wrestler has the choice of position in the second period; {names[1]} has it in the others, alternating weight to weight.</p>
            <div className="dual__actions">
              <button type="button" className="menu__btn" onClick={() => api.pickOddEven(true)}>Odd bouts (1st, 3rd, 5th…)</button>
              <button type="button" className="menu__btn" onClick={() => api.pickOddEven(false)}>Even bouts (2nd, 4th, 6th…)</button>
            </div>
          </section>
        ) : bout ? (
          <section className="field">
            <p className="field__note dual__tossnote">{d.toss.winner === 0 ? `${names[0]} won the toss and took ${d.toss.odd === 0 ? 'odd' : 'even'} bouts` : `${names[1]} won the toss and took ${d.toss.odd === 1 ? 'odd' : 'even'} bouts`}. This bout: {choiceFor(d, bout) === 0 ? 'you have the choice in the second period' : `${names[1]} has the choice in the second period`}.</p>
            <h2>{weightLabel(bout.weight)} · their wrestler</h2>
            <div className="tiles">
              <Tile w={byId(bout.theirs)} on onPick={() => {}} corner="green" team />
            </div>
            <h2>Your wrestler</h2>
            <p className="field__note">{bout.ours ? 'Ready. Wrestle it yourself, or sim it.' : 'Pick who wrestles. Highest rating first.'}</p>
            <div className="tiles">
              {pickList(d.teams[0], bout.weight).map((w) => (
                <Tile key={w.id} w={w} on={bout.ours === w.id} onPick={() => api.pickDual(w.id)} corner="red" team />
              ))}
            </div>
            <div className="dual__actions">
              <button type="button" className="cta" disabled={!bout.ours || busy} onClick={() => api.wrestleDual()}>
                <span>Wrestle</span>
                <Key>Enter</Key>
              </button>
              <button type="button" className="menu__btn" disabled={!bout.ours || busy} onClick={sim}>
                {busy ? 'Simulating…' : 'Sim bout'}
              </button>
            </div>
          </section>
        ) : (
          <section className="field dual__final">
            <h2>Final</h2>
            <p className="dual__winner">{final!.side === null ? 'The dual is a tie' : `${names[final!.side]} win${names[final!.side].endsWith('S') ? '' : 's'}`}</p>
            <p className="field__note">{final!.how}</p>
            <button type="button" className="cta" onClick={() => api.leaveDual()}>
              <span>New dual</span>
            </button>
          </section>
        )}

        {!done && (
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.leaveDual()}>
            Leave dual
          </button>
        )}
      </aside>

      <section className="tape" aria-label="Bout sheet">
        <table className="dual-sheet dual-sheet--bouts">
          <thead>
            <tr><th>Wt</th><th>{names[0]}</th><th>{names[1]}</th><th title="Second-period choice, from the dual's coin toss">Choice</th><th>Result</th><th>Team</th></tr>
          </thead>
          <tbody>
            {d.bouts.map((b) => {
              const r = b.result;
              if (r) running = r.winner === 0 ? [running[0] + r.teamPoints, running[1]] : [running[0], running[1] + r.teamPoints];
              const ours = b.ours ? byId(b.ours) : null;
              const theirs = byId(b.theirs);
              return (
                <tr key={b.weight} className={`${b === bout ? 'dual-sheet__now' : ''} ${r ? (r.winner === 0 ? 'dual-sheet__won' : 'dual-sheet__lost') : ''}`}>
                  <td>{b.weight === 285 ? 'HWT' : b.weight}{b.weight === d.marquee && <span className="dual-sheet__star" title="Marquee bout, saved for last"> ★</span>}</td>
                  <td className={r?.winner === 0 ? 'lead' : ''}>{ours ? ours.lastName : b === bout ? 'Pick ›' : '—'}</td>
                  <td className={r?.winner === 1 ? 'lead' : ''}>{theirs.lastName}</td>
                  <td className="dual-sheet__choice">{choiceFor(d, b) === null ? '' : choiceFor(d, b) === 0 ? names[0].split(' ').map((x) => x[0]).join('') : names[1].split(' ').map((x) => x[0]).join('')}</td>
                  <td>{r ? boutLine(b) : ''}</td>
                  <td>{r ? `${running[0]}–${running[1]}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="field__note">NCAA team points: decision 3, major decision 4, technical fall 5, fall 6. Ties go to more bouts won, then falls, technical falls, major decisions and total match points.</p>
      </section>
    </div>
  );
}
