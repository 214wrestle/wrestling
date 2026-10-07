import { careerCredentials } from '../sim/credentials';
import './branding.css';
import { wrestlerFamilyNote, morenoMatchupNote, ncaaMatchupNotes, historicalMeetingText } from '../sim/easterEggs';
import { useEffect, useState } from 'react';
import type { Difficulty } from '../sim/ai';
import { MEET, ROSTER, LEGENDS_TEAMS, LEGENDS_WEIGHTS, byId } from '../sim/roster';
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
      <span className="tile__name-row"><span className="tile__name">
        <span className="tile__first">{w.firstName}</span> {w.lastName}
      </span><span className="tile__rating" title={w.rating === undefined ? "Historical rating research pending" : "Overall rating"}>{w.rating ?? "Unrated"}</span></span>
      {w.legends?.nickname && <span className="tile__meta">“{w.legends.nickname}”</span>}
      {careerCredentials(w.ncaaCareer, `${w.firstName} ${w.lastName}`) && <span className="tile__meta tile__credentials" title="Verified NCAA and senior international credentials · AA means All-American">{careerCredentials(w.ncaaCareer, `${w.firstName} ${w.lastName}`)}</span>}
      <span className="tile__meta">
        {w.weightClass === 285 ? 'HWT' : `${w.weightClass} lbs`} · {w.legends?.role === 'choice' ? 'Coach’s Choice' : 'Starter'}
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

  const weight = byId(pick).weightClass;
  const [yourTeam, setYourTeam] = useState(byId(pick).school.id);
  const [theirTeam, setTheirTeam] = useState(byId(opponent).school.id);
  const pool = (team: string, at = weight) => ROSTER.filter(w => w.school.id === team && w.weightClass === at);
  const choosePick = (id: string) => {
    setPick(id);
    if (id === opponent) {
      const replacement = ROSTER.find(w => w.weightClass === weight && w.id !== id)!;
      setOpponent(replacement.id); setTheirTeam(replacement.school.id);
    }
  };
  const changeWeight = (at: number) => {
    const a = pool(yourTeam, at)[0];
    const b = pool(theirTeam, at).find(w => w.id !== a.id)
      ?? ROSTER.find(w => w.weightClass === at && w.id !== a.id)!;
    setPick(a.id); setOpponent(b.id); setTheirTeam(b.school.id);
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
          <h1 className="brand__mark brand__mark--legends">
            Legends<span>of College</span><span>Wrestling</span>
          </h1>
          <div className="brand__event">
            {MEET.event} · {MEET.round}
          </div>
        </header>

        <section className="field">
          <h2>Weight class</h2>
          <select aria-label="Weight class" className="roster-select" value={weight} onChange={e => changeWeight(Number(e.target.value))}>
            {LEGENDS_WEIGHTS.map(w => <option key={w} value={w}>{w === 285 ? 'HWT' : `${w} lbs`}</option>)}
          </select>
          <h2>Your team</h2>
          <select aria-label="Your team" className="roster-select" value={yourTeam} onChange={e => {
            setYourTeam(e.target.value); choosePick(pool(e.target.value)[0].id);
          }}>
            {LEGENDS_TEAMS.map(t => <option key={t.id} value={t.id}>{t.team}</option>)}
          </select>
          <p className="field__note">{LEGENDS_TEAMS.find(t => t.id === yourTeam)?.staff.join(' · ')}</p>
          <h2>Your wrestler</h2>
          <div className="tiles">
            {pool(yourTeam).map((w) => (
              <Tile key={w.id} w={w} on={pick === w.id} onPick={() => choosePick(w.id)} corner="red" />
            ))}
          </div>
        </section>

        <section className="field">
          <h2>Opponent team</h2>
          <select aria-label="Opponent team" className="roster-select" value={theirTeam} onChange={e => {
            setTheirTeam(e.target.value);
            setOpponent(pool(e.target.value).find(w => w.id !== pick)?.id ?? pool(e.target.value)[0].id);
          }}>
            {LEGENDS_TEAMS.filter(t => pool(t.id).some(w => w.id !== pick)).map(t => <option key={t.id} value={t.id}>{t.team}</option>)}
          </select>
          <p className="field__note">{LEGENDS_TEAMS.find(t => t.id === theirTeam)?.staff.join(' · ')}</p>
          <h2>Opponent</h2>
          <div className="tiles tiles--three">
            {pool(theirTeam).filter((w) => w.id !== pick).map((w) => (
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

        {[you, them].filter(w => wrestlerFamilyNote(w)).map(w => <p className="field__note matchup-history" key={`family-${w.id}`}>{wrestlerFamilyNote(w)}</p>)}
        {ncaaMatchupNotes(you, them).map(meeting => <p className="field__note matchup-history" key={`${meeting.year}-${meeting.round}-${meeting.weight}`}><strong>NCAA history:</strong> {historicalMeetingText(meeting)} <a href={meeting.source} target="_blank" rel="noopener noreferrer">View source</a></p>)}

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
          <span><Key>U</Key> low single</span>
          <span><Key>I</Key> scramble</span>
          <span>
            <Key>Shift</Key> lower / cut
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
            <span className="tape__name">{you.firstName} {you.lastName}</span>
            <span className="tape__meta">
              {you.weightClass === 285 ? 'HWT' : `${you.weightClass} lbs`} · Legends
            </span>
          </div>
          <div className="tape__vs">vs</div>
          <div className="tape__side tape__side--right" style={{ ['--school' as string]: them.school.primary }}>
            <span className="tape__corner tape__corner--green" />
            <span className="tape__school">{them.school.name}</span>
            <span className="tape__name">{them.firstName} {them.lastName}</span>
            <span className="tape__meta">
              {them.weightClass === 285 ? 'HWT' : `${them.weightClass} lbs`} · Legends
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
        <p className="field__note">Ratings are provisional. Estimates and developmental ratings are identified in wrestler bios; appearances remain prototypes.</p>
        {[you, them].filter(w => w.legends?.bioNote).map(w => <p className="field__note" key={w.id}>{w.firstName} {w.lastName}: {w.legends!.bioNote}</p>)}
        {morenoMatchupNote(you, them) && <p className="field__note">{morenoMatchupNote(you, them)}</p>}
        <details className="roster-notes"><summary>Locked roster notes and Coach’s Choice</summary>
          <p>{you.school.rosterNotes}</p>
          <p>Choices without assigned weights are preserved here for later placement.</p>
        </details>
        {[you, them].map(w => w.profile && <details className="roster-notes" key={`refs-${w.id}`}><summary>{w.firstName} {w.lastName}: appearance and film references</summary><p>{w.profile.era} · {w.profile.appearanceStatus}</p><p>{w.profile.summary}</p><ul>{w.profile.sources.map(ref => <li key={ref.url}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.label}</a> ({ref.kind})</li>)}</ul></details>)}
        <div className="tape__styles">
          <span>“{you.style}”</span>
          <span>“{them.style}”</span>
        </div>
      </section>
    </div>
  );
}
