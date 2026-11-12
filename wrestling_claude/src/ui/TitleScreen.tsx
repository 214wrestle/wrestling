import { careerCredentials } from '../sim/credentials';
import { schoolLabel } from '../sim/schoolAbbr';
import './branding.css';
import { wrestlerFamilyNote, morenoMatchupNote, ncaaMatchupNotes, historicalMeetingText } from '../sim/easterEggs';
import { useEffect, useState } from 'react';
import type { Difficulty } from '../sim/ai';
import { MEET, ROSTER, LEGENDS_TEAMS, LEGENDS_WEIGHTS, byId } from '../sim/roster';
import type { Wrestler } from '../sim/types';
import { ABILITY_KEYS, ABILITY_LABELS } from '../sim/attributeRatings';
import { cornerPick, marquee, pickList } from '../sim/dual';
import { tournamentField } from '../sim/tournament';
import type { GameApi, UiState } from '../game/store';
import { Key } from './glyphs';

const DIFFICULTIES: Array<{ id: Difficulty; label: string; blurb: string }> = [
  { id: 'practice', label: 'Practice', blurb: 'Cooperative partner. No attacks or counters. Unlimited time and position resets.' },
  { id: 'walk-on', label: 'Junior Varsity', blurb: 'Very forgiving. Plenty of time to set up and finish moves.' },
  { id: 'starter', label: 'Varsity', blurb: 'Light resistance with generous openings. Player-friendly matches.' },
  { id: 'all-american', label: 'All-American', blurb: 'More active, but still forgiving—even with a lower-rated wrestler.' },
];

const ATTRS: Array<[Exclude<keyof Wrestler['attributes'], 'legRiding' | 'throws' | 'riding' | 'turning' | 'pinning' | 'bottom' | 'shots' | 'scrambling'>, string]> = [
  ['quickness', 'Quickness'],
  ['strength', 'Strength'],
  ['conditioning', 'Conditioning'],
  ['mat', 'Mat'],
  ['defense', 'Defense'],
];

/** A wrestler's card. An Icon shows his own school, except in a dual (`team`), where he wrestles for the Icons. */
export function Tile({ w, on, onPick, corner, team = false }: { w: Wrestler; on: boolean; onPick: () => void; corner?: 'red' | 'green'; team?: boolean }) {
  return (
    <button
      type="button"
      className={`tile ${on ? 'tile--on' : ''}`}
      style={{ ['--school' as string]: w.school.primary, ['--accent' as string]: w.school.accent }}
      onClick={onPick}
      aria-pressed={on}
    >
      <span className="tile__flag" />
      <span className="tile__school">{schoolLabel(w, team).name}</span>
      <span className="tile__name-row"><span className="tile__name">
        <span className="tile__first">{w.firstName}</span> {w.lastName}
      </span><span className="tile__rating" title={w.rating === undefined ? "Historical rating research pending" : "Overall rating"}>{w.rating ?? "Unrated"}</span></span>
      {w.legends?.nickname && <span className="tile__meta">“{w.legends.nickname}”</span>}
      {careerCredentials(w.ncaaCareer, `${w.firstName} ${w.lastName}`) && <span className="tile__meta tile__credentials" title="College and senior international credentials · Career falls from owner-provided graphic · AA means All-American">{careerCredentials(w.ncaaCareer, `${w.firstName} ${w.lastName}`)}</span>}
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
  // Single match or a dual meet (owner, November 10: all 12 weights, pick your man at each one).
  const [mode, setMode] = useState<'single' | 'dual' | 'tournament'>(state.dual ? 'dual' : state.tournament ? 'tournament' : 'single');
  // Dual order: up from 118 (owner), or an NCAA-style draw for the starting weight.
  const [draw, setDraw] = useState(false);

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

  const dualTeams: [string, string] = [yourTeam, theirTeam !== yourTeam ? theirTeam : LEGENDS_TEAMS.find(t => t.id !== yourTeam)!.id];
  const dualReady = difficulty !== 'practice';
  const go = () => mode === 'tournament'
    ? dualReady && api.startTournament({ pick, difficulty, quick })
    : mode === 'dual'
    ? dualReady && api.startDual({ teams: dualTeams, difficulty, quick, draw })
    : api.start({ humanSide: 0, difficulty, matchup: [pick, opponent], quick });

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
          <h2>Mode</h2>
          <div className="seg">
            <button type="button" className={`seg__btn ${mode === 'single' ? 'seg__btn--on' : ''}`} onClick={() => setMode('single')} aria-pressed={mode === 'single'}>Single match</button>
            <button type="button" className={`seg__btn ${mode === 'dual' ? 'seg__btn--on' : ''}`} onClick={() => setMode('dual')} aria-pressed={mode === 'dual'}>Dual meet</button>
            <button type="button" className={`seg__btn ${mode === 'tournament' ? 'seg__btn--on' : ''}`} onClick={() => setMode('tournament')} aria-pressed={mode === 'tournament'}>Tournament</button>
          </div>
          <p className="field__note">{mode === 'tournament' ? 'One weight, the best 32 by rating from any school (yours always in), seeded, teammates apart in the first round. Championship bracket and NCAA double-elimination consolations, places 1st to 8th. Wrestle or sim your matches.' : mode === 'dual' ? 'Team against team at all 12 weights. Before each bout you pick your wrestler at that weight; wrestle the bout or sim it.' : 'One bout at one weight.'}</p>
        </section>

        {mode === 'dual' ? <section className="field">
          <h2>Your team</h2>
          <select aria-label="Your team" className="roster-select" value={yourTeam} onChange={e => setYourTeam(e.target.value)}>
            {LEGENDS_TEAMS.map(t => <option key={t.id} value={t.id}>{t.team}</option>)}
          </select>
          <h2>Opponent team</h2>
          <select aria-label="Opponent team" className="roster-select" value={dualTeams[1]} onChange={e => setTheirTeam(e.target.value)}>
            {LEGENDS_TEAMS.filter(t => t.id !== yourTeam).map(t => <option key={t.id} value={t.id}>{t.team}</option>)}
          </select>
          <p className="field__note">{LEGENDS_TEAMS.find(t => t.id === dualTeams[1])?.staff.join(' · ')}</p>
          <h2>First bout</h2>
          <div className="seg">
            <button type="button" className={`seg__btn ${!draw ? 'seg__btn--on' : ''}`} onClick={() => setDraw(false)} aria-pressed={!draw}>118 and up</button>
            <button type="button" className={`seg__btn ${draw ? 'seg__btn--on' : ''}`} onClick={() => setDraw(true)} aria-pressed={draw}>Draw: marquee last</button>
          </div>
          <p className="field__note">{draw ? (() => {
            const m = marquee(dualTeams);
            return `The draw saves the marquee bout for last: ${m.weight === 285 ? 'HWT' : m.weight}, ${m.ours.lastName} vs ${m.theirs.lastName} (${m.titles} titles between them). The bouts start at the next weight and wrap round.`;
          })() : '118 first, then 125, 133 and on up to heavyweight.'}</p>
        </section> : <>
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

        {mode === 'single' && <section className="field">
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
        </section>}</>}

        <section className="field field--row">
          <div className="field__col">
            <h2>Difficulty</h2>
            <div className="seg">
              {DIFFICULTIES.filter((d) => mode === 'single' || d.id !== 'practice').map((d) => (
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

        {mode === 'single' && [you, them].filter(w => wrestlerFamilyNote(w)).map(w => <p className="field__note matchup-history" key={`family-${w.id}`}>{wrestlerFamilyNote(w)}</p>)}
        {mode === 'single' && ncaaMatchupNotes(you, them).map(meeting => <p className="field__note matchup-history" key={`${meeting.year}-${meeting.round}-${meeting.weight}`}><strong>NCAA history:</strong> {historicalMeetingText(meeting)} <a href={meeting.source} target="_blank" rel="noopener noreferrer">View source</a></p>)}

        <button type="button" className="cta" onClick={go}>
          <span>{mode === 'tournament' ? (dualReady ? 'Start the tournament' : 'Pick a difficulty') : mode === 'dual' ? (dualReady ? 'Start the dual' : 'Pick a difficulty') : difficulty==='practice'?'Practice':'Wrestle'}</span>
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

      {mode === 'tournament' ? <section className="tape" aria-label="Tournament field">
        <div className="tape__head">
          <div className="tape__side" style={{ ['--school' as string]: you.school.primary }}>
            <span className="tape__corner tape__corner--red" />
            <span className="tape__name">{weight === 285 ? 'Heavyweight' : `${weight} lbs`} field</span>
          </div>
        </div>
        <table className="dual-sheet">
          <thead><tr><th>Seed</th><th>Wrestler</th><th>Team</th><th>Rating</th></tr></thead>
          <tbody>
            {tournamentField(weight, you).map((id, i) => {
              const w = byId(id);
              return <tr key={id} className={id === pick ? 'dual-sheet__now' : ''}>
                <td>{i + 1}</td><td>{w.firstName} {w.lastName}</td><td>{schoolLabel(w).name}</td><td><em>{w.rating ?? '—'}</em></td>
              </tr>;
            })}
          </tbody>
        </table>
        <p className="field__note">The best 32 at the weight by rating, your pick always in, seeded by rating; teammates never meet in the first round.</p>
      </section> : mode === 'dual' ? <section className="tape" aria-label="Dual lineups">
        <div className="tape__head">
          <div className="tape__side" style={{ ['--school' as string]: you.school.primary }}>
            <span className="tape__corner tape__corner--red" />
            <span className="tape__name">{LEGENDS_TEAMS.find(t => t.id === dualTeams[0])?.team}</span>
          </div>
          <div className="tape__vs">vs</div>
          <div className="tape__side tape__side--right">
            <span className="tape__corner tape__corner--green" />
            <span className="tape__name">{LEGENDS_TEAMS.find(t => t.id === dualTeams[1])?.team}</span>
          </div>
        </div>
        <table className="dual-sheet">
          <thead><tr><th>Wt</th><th>Your options (you pick before each bout)</th><th>Their starter</th></tr></thead>
          <tbody>
            {LEGENDS_WEIGHTS.map(wt => {
              const mine = pickList(dualTeams[0], wt), theirs = cornerPick(dualTeams[1], wt);
              return <tr key={wt}>
                <td>{wt === 285 ? 'HWT' : wt}</td>
                <td>{mine[0].firstName} {mine[0].lastName} <em>{mine[0].rating ?? '—'}</em>{mine.length > 1 && <span className="dual-sheet__more"> +{mine.length - 1} more</span>}</td>
                <td>{theirs.firstName} {theirs.lastName} <em>{theirs.rating ?? '—'}</em></td>
              </tr>;
            })}
          </tbody>
        </table>
        <p className="field__note">Nothing is set up front: when each bout comes up you pick your wrestler at that weight from your list, highest rating first. Decision 3, major 4, tech fall 5, fall 6.</p>
      </section> :
      <section className="tape" aria-label="Tale of the tape">
        <div className="tape__head">
          <div className="tape__side" style={{ ['--school' as string]: you.school.primary }}>
            <span className="tape__corner tape__corner--red" />
            <span className="tape__school">{schoolLabel(you).name}</span>
            <span className="tape__name">{you.firstName} {you.lastName}</span>
            <span className="tape__meta">
              {you.weightClass === 285 ? 'HWT' : `${you.weightClass} lbs`} · Legends
            </span>
          </div>
          <div className="tape__vs">vs</div>
          <div className="tape__side tape__side--right" style={{ ['--school' as string]: them.school.primary }}>
            <span className="tape__corner tape__corner--green" />
            <span className="tape__school">{schoolLabel(them).name}</span>
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
        {you.abilities && them.abilities && (
          <details className="roster-notes tape__abilities">
            <summary>Attribute ratings</summary>
            <table>
              <tbody>
                {ABILITY_KEYS.map((k) => {
                  const a = you.abilities![k], b = them.abilities![k];
                  return (
                    <tr key={k}>
                      <td className={a > b ? 'tape__better' : ''}>{a}</td>
                      <th scope="row">{ABILITY_LABELS[k]}</th>
                      <td className={b > a ? 'tape__better' : ''}>{b}</td>
                    </tr>
                  );
                })}
                {(['pace', 'brawler'] as const).map((k) => (
                  <tr key={k} className="tape__style-grade">
                    <td>{you.styleGrades?.[k] ? `${you.styleGrades[k]}/5` : '—'}</td>
                    <th scope="row">{k === 'pace' ? 'Pace (style)' : 'Brawler (style)'}</th>
                    <td>{them.styleGrades?.[k] ? `${them.styleGrades[k]}/5` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Built from each wrestler’s college results and researched strengths; an unresearched category stays at his career level.</p>
          </details>
        )}
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
        {(you.signature || them.signature) && <div className="tape__styles tape__signature">
          <span>{you.signature ? `Signature: ${you.signature.label}` : ''}</span>
          <span>{them.signature ? `Signature: ${them.signature.label}` : ''}</span>
        </div>}
      </section>}
    </div>
  );
}
