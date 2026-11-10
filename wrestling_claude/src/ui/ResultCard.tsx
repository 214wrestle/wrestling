import { useEffect } from 'react';
import { schoolLabel } from '../sim/schoolAbbr';
import { describeWinType, formatClock, formatRidingTime, periodLabel } from '../sim/rules';
import type { GameApi, UiState } from '../game/store';
import type { Side } from '../sim/types';
import { Key } from './glyphs';
import { teamName, teamScore } from '../sim/dual';
import { isDone, stillIn } from '../sim/tournament';

const STATS: Array<[string, 'takedowns' | 'escapes' | 'reversals' | 'nearFalls' | 'stuffs' | 'shotsAttempted']> = [
  ['Takedowns', 'takedowns'],
  ['Escapes', 'escapes'],
  ['Reversals', 'reversals'],
  ['Near falls', 'nearFalls'],
  ['Shots taken', 'shotsAttempted'],
  ['Shots stuffed', 'stuffs'],
];

export function ResultCard({ state, api }: { state: UiState; api: GameApi }) {
  // In a dual meet the bout goes on the team score and the next weight follows.
  const dual = state.dual;
  // In a tournament the match goes in the bracket and the next round follows.
  const tour = state.tournament;
  const w = state.wrestlers;
  const result = state.result;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') { if (tour) api.toTournament(); else if (dual) api.toDual(); else api.rematch(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, dual, tour]);
  if (!w || !result) return null;
  const winner = w[result.winner];
  const margin = Math.abs(result.score[0] - result.score[1]);
  const youWon = result.winner === state.humanSide;
  const method =
    result.type === 'fall'
      ? state.difficulty === 'practice' ? 'Fall · Practice' : `Fall · ${formatClock(Math.max(0, result.clock))} left in ${periodLabel(result.period)}`
      : `${describeWinType(result.type, margin)} · ${result.score[result.winner]}–${result.score[result.winner === 0 ? 1 : 0]}`;

  return (
    <div className="result" style={{ ['--school' as string]: winner.school.primary, ['--accent' as string]: winner.school.accent }}>
      <div className="result__card">
        <div className="result__kicker">{youWon ? 'You win' : 'You lose'}{tour ? ' · Legends Championships' : ` · ${result.teamPoints} team points`}{dual && ` · Dual ${teamName(dual.teams[0])} ${teamScore(dual)[0]}–${teamScore(dual)[1]} ${teamName(dual.teams[1])}`}</div>
        <div className="result__winner">
          <span className="result__school">{schoolLabel(winner, !!dual).name}</span>
          <h2>
            <span>{winner.firstName}</span> {winner.lastName}
          </h2>
          <div className="result__method">{method}</div>
        </div>

        <div className="result__score">
          {([0, 1] as Side[]).map((side) => (
            <div key={side} className={`result__side ${side === result.winner ? 'result__side--won' : ''}`} style={{ ['--school' as string]: w[side].school.primary }}>
              <span className="result__team">{schoolLabel(w[side], !!dual).name}</span>
              <span className="result__name">{w[side].lastName}</span>
              <span className="result__pts">{result.score[side]}</span>
            </div>
          ))}
        </div>

        <div className="result__grid">
          <table className="result__stats">
            <thead>
              <tr>
                <th>{w[0].lastName}</th>
                <th />
                <th>{w[1].lastName}</th>
              </tr>
            </thead>
            <tbody>
              {STATS.map(([label, key]) => {
                const a = state.stats[0][key];
                const b = state.stats[1][key];
                return (
                  <tr key={key}>
                    <td className={a > b ? 'lead' : ''}>{a}</td>
                    <td className="result__statlabel">{label}</td>
                    <td className={b > a ? 'lead' : ''}>{b}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={3} className="result__rt">
                  Riding time {formatRidingTime(state.ridingTime)}
                </td>
              </tr>
            </tbody>
          </table>

          <ol className="result__log">
            {state.scoreLog.length === 0 && <li className="result__empty">No points scored</li>}
            {state.scoreLog.map((e) => (
              <li key={e.id} style={{ ['--school' as string]: w[e.side].school.primary }}>
                <span className="result__logpts">+{e.points}</span>
                <span className="result__logtext">
                  <strong>{e.label}</strong>
                  <em>
                    {w[e.side].lastName} · {periodLabel(e.period)} {formatClock(e.clock)}
                  </em>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {tour ? <div className="result__row">
          <button type="button" className="cta cta--small" onClick={() => api.toTournament()} autoFocus>
            <span>{isDone(tour) ? 'Final placings' : stillIn(tour) ? 'Back to the bracket' : 'The bracket'}</span>
            <Key>Enter</Key>
          </button>
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.leaveTournament()}>
            Leave tournament
          </button>
        </div> : dual ? <div className="result__row">
          <button type="button" className="cta cta--small" onClick={() => api.toDual()} autoFocus>
            <span>{dual.bouts.every(b => b.result) ? 'Final score' : 'Next bout'}</span>
            <Key>Enter</Key>
          </button>
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.leaveDual()}>
            Leave dual
          </button>
        </div> : <div className="result__row">
          <button type="button" className="cta cta--small" onClick={() => api.rematch()} autoFocus>
            <span>Rematch</span>
            <Key>Enter</Key>
          </button>
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toTitle()}>
            Change wrestlers
          </button>
        </div>}
      </div>
    </div>
  );
}
