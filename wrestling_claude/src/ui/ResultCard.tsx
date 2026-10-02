import { useEffect } from 'react';
import { describeWinType, formatClock, formatRidingTime, periodLabel } from '../sim/rules';
import type { GameApi, UiState } from '../game/store';
import type { Side } from '../sim/types';
import { Key } from './glyphs';

const STATS: Array<[string, 'takedowns' | 'escapes' | 'reversals' | 'nearFalls' | 'stuffs' | 'shotsAttempted']> = [
  ['Takedowns', 'takedowns'],
  ['Escapes', 'escapes'],
  ['Reversals', 'reversals'],
  ['Near falls', 'nearFalls'],
  ['Shots taken', 'shotsAttempted'],
  ['Shots stuffed', 'stuffs'],
];

export function ResultCard({ state, api }: { state: UiState; api: GameApi }) {
  const w = state.wrestlers;
  const result = state.result;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') api.rematch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);
  if (!w || !result) return null;
  const winner = w[result.winner];
  const margin = Math.abs(result.score[0] - result.score[1]);
  const youWon = result.winner === state.humanSide;
  const method =
    result.type === 'fall'
      ? `Fall · ${formatClock(Math.max(0, result.clock))} left in ${periodLabel(result.period)}`
      : `${describeWinType(result.type, margin)} · ${result.score[result.winner]}–${result.score[result.winner === 0 ? 1 : 0]}`;

  return (
    <div className="result" style={{ ['--school' as string]: winner.school.primary, ['--accent' as string]: winner.school.accent }}>
      <div className="result__card">
        <div className="result__kicker">{youWon ? 'You win' : 'You lose'} · {result.teamPoints} team points</div>
        <div className="result__winner">
          <span className="result__school">{winner.school.name}</span>
          <h2>
            <span>{winner.firstName}</span> {winner.lastName}
          </h2>
          <div className="result__method">{method}</div>
        </div>

        <div className="result__score">
          {([0, 1] as Side[]).map((side) => (
            <div key={side} className={`result__side ${side === result.winner ? 'result__side--won' : ''}`} style={{ ['--school' as string]: w[side].school.primary }}>
              <span className="result__team">{w[side].school.name}</span>
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

        <div className="result__row">
          <button type="button" className="cta cta--small" onClick={() => api.rematch()} autoFocus>
            <span>Rematch</span>
            <Key>Enter</Key>
          </button>
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toTitle()}>
            Change wrestlers
          </button>
        </div>
      </div>
    </div>
  );
}
