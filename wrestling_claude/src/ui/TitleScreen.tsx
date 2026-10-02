import { useEffect, useState } from 'react';
import type { Difficulty } from '../sim/ai';
import { MEET, ROSTER, byId } from '../sim/roster';
import type { Wrestler } from '../sim/types';
import type { GameApi, UiState } from '../game/store';
import { Key } from './glyphs';

const DIFFICULTIES: Array<{ id: Difficulty; label: string; blurb: string }> = [
  { id: 'walk-on', label: 'Walk-on', blurb: 'Slow to react. Learn the positions.' },
  { id: 'starter', label: 'Starter', blurb: 'Sprawls on time and punishes lazy shots.' },
  { id: 'all-american', label: 'All-American', blurb: 'Reads you, waits for openings, never stops.' },
];

const ATTRS: Array<[keyof Wrestler['attributes'], string]> = [
  ['quickness', 'Quickness'],
  ['strength', 'Strength'],
  ['conditioning', 'Conditioning'],
  ['mat', 'Mat'],
  ['defense', 'Defense'],
];

const feetInches = (m: number) => {
  const inches = Math.round(m / 0.0254);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
};

function Tile({ w, on, onPick, corner }: { w: Wrestler; on: boolean; onPick: () => void; corner?: 'red' | 'green' }) {
  return (
    <button
      type="button"
      className={`tile ${on ? 'tile--on' : ''}`}
      style={{ ['--school' as string]: w.school.primary, ['--accent' as string]: w.school.accent }}
      onClick={onPick}
      aria-pressed={on}
    >
      <span className="tile__flag" />
      <span className="tile__school">{w.school.name}</span>
      <span className="tile__name">
        <span className="tile__first">{w.firstName}</span> {w.lastName}
      </span>
      <span className="tile__meta">
        {w.year} · {w.record.wins}-{w.record.losses}
        {w.seed ? ` · #${w.seed}` : ''}
      </span>
      {on && corner && <span className={`tile__corner tile__corner--${corner}`}>{corner === 'red' ? 'Red' : 'Green'}</span>}
    </button>
  );
}

export function TitleScreen({ state, api }: { state: UiState; api: GameApi }) {
  const [pick, setPick] = useState(state.matchup[0]);
  const [opponent, setOpponent] = useState(state.matchup[1]);
  const [difficulty, setDifficulty] = useState<Difficulty>(state.difficulty);
  const [quick, setQuick] = useState(state.quick);

  useEffect(() => {
    api.preview([pick, opponent]);
  }, [api, pick, opponent]);

  const choosePick = (id: string) => {
    setPick(id);
    if (id === opponent) setOpponent(ROSTER.find((w) => w.id !== id)!.id);
  };

  const go = () => api.start({ humanSide: 0, difficulty, matchup: [pick, opponent], quick });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') go();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const you = byId(pick);
  const them = byId(opponent);
  const blurb = DIFFICULTIES.find((d) => d.id === difficulty)!.blurb;

  return (
    <div className="title">
      <aside className="title__panel">
        <header className="brand">
          <div className="brand__kicker">College Wrestling · NCAA Rules</div>
          <h1 className="brand__mark">
            Mat<span>Rivals</span>
          </h1>
          <div className="brand__event">
            {MEET.event} · {MEET.round}
          </div>
        </header>

        <section className="field">
          <h2>Your wrestler</h2>
          <div className="tiles">
            {ROSTER.map((w) => (
              <Tile key={w.id} w={w} on={pick === w.id} onPick={() => choosePick(w.id)} corner="red" />
            ))}
          </div>
        </section>

        <section className="field">
          <h2>Opponent</h2>
          <div className="tiles tiles--three">
            {ROSTER.filter((w) => w.id !== pick).map((w) => (
              <Tile key={w.id} w={w} on={opponent === w.id} onPick={() => setOpponent(w.id)} corner="green" />
            ))}
          </div>
        </section>

        <section className="field field--row">
          <div className="field__col">
            <h2>Difficulty</h2>
            <div className="seg">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`seg__btn ${difficulty === d.id ? 'seg__btn--on' : ''}`}
                  onClick={() => setDifficulty(d.id)}
                  aria-pressed={difficulty === d.id}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="field__note">{blurb}</p>
          </div>
          <div className="field__col field__col--narrow">
            <h2>Match</h2>
            <div className="seg">
              <button type="button" className={`seg__btn ${!quick ? 'seg__btn--on' : ''}`} onClick={() => setQuick(false)} aria-pressed={!quick}>
                Full
              </button>
              <button type="button" className={`seg__btn ${quick ? 'seg__btn--on' : ''}`} onClick={() => setQuick(true)} aria-pressed={quick}>
                Quick
              </button>
            </div>
            <p className="field__note">{quick ? '1:30 · 1:00 · 1:00' : '3:00 · 2:00 · 2:00'}</p>
          </div>
        </section>

        <button type="button" className="cta" onClick={go}>
          <span>Wrestle</span>
          <Key>Enter</Key>
        </button>

        <div className="title__keys">
          <span>
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key> move
          </span>
          <span>
            <Key>J</Key> shoot
          </span>
          <span>
            <Key>K</Key> hand fight
          </span>
          <span>
            <Key>L</Key> sprawl
          </span>
          <span>
            <Key>Shift</Key> level
          </span>
          <span>
            <Key>H</Key> how to wrestle
          </span>
        </div>
      </aside>

      <section className="tape" aria-label="Tale of the tape">
        <div className="tape__head">
          <div className="tape__side" style={{ ['--school' as string]: you.school.primary }}>
            <span className="tape__corner tape__corner--red" />
            <span className="tape__school">{you.school.name}</span>
            <span className="tape__name">{you.lastName}</span>
            <span className="tape__meta">
              {you.year} · {feetInches(you.height)} · {you.record.wins}-{you.record.losses}
            </span>
          </div>
          <div className="tape__vs">vs</div>
          <div className="tape__side tape__side--right" style={{ ['--school' as string]: them.school.primary }}>
            <span className="tape__corner tape__corner--green" />
            <span className="tape__school">{them.school.name}</span>
            <span className="tape__name">{them.lastName}</span>
            <span className="tape__meta">
              {them.year} · {feetInches(them.height)} · {them.record.wins}-{them.record.losses}
            </span>
          </div>
        </div>
        <div className="tape__rows">
          {ATTRS.map(([key, label]) => {
            const a = you.attributes[key];
            const b = them.attributes[key];
            return (
              <div className="tape__row" key={key}>
                <span className="tape__bar tape__bar--l">
                  <i style={{ width: `${a * 100}%`, background: you.school.accent }} />
                </span>
                <span className={`tape__label ${a > b ? 'tape__label--l' : b > a ? 'tape__label--r' : ''}`}>{label}</span>
                <span className="tape__bar">
                  <i style={{ width: `${b * 100}%`, background: them.school.accent }} />
                </span>
              </div>
            );
          })}
        </div>
        <div className="tape__styles">
          <span>“{you.style}”</span>
          <span>“{them.style}”</span>
        </div>
      </section>
    </div>
  );
}
