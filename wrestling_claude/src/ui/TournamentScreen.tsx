import { useEffect } from 'react';
import { byId } from '../sim/roster';
import { boutsAhead, isDone, pairOf, placements, playerMatch, seedOf, stillIn, type Tournament, type TournamentMatch } from '../sim/tournament';
import type { GameApi, UiState } from '../game/store';
import { Key } from './glyphs';
import { Tile } from './TitleScreen';
import { schoolLabel } from '../sim/schoolAbbr';

const SHORT: Record<string, string> = {
  fall: 'Fall', 'technical-fall': 'TF', 'major-decision': 'MD', decision: 'Dec', 'sudden-victory': 'SV', tiebreaker: 'TB', bye: 'Bye',
};
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** "(5) David Taylor PSU" for a slot (owner: first and last name and the school's abbreviation), or bye / not yet. */
function who(t: Tournament, id: string | null | undefined): string {
  if (id === null) return 'bye';
  if (id === undefined) return '—';
  const w = byId(id);
  return `(${seedOf(t, id)}) ${w.firstName} ${w.lastName} ${abbr(id)}`;
}
// An Icon shows his own school here (owner: Icons are a team only in duals).
const abbr = (id: string) => schoolLabel(byId(id)).abbr;

/** One line in a bracket box: seed and name (cut short if it must be), then the school, always shown. */
function Who({ t, id }: { t: Tournament; id: string | null | undefined }) {
  if (id === null || id === undefined) return <>{id === null ? 'bye' : '—'}</>;
  const w = byId(id);
  return <><span className="tbox__name">({seedOf(t, id)}) {w.firstName} {w.lastName}</span><span className="tbox__abbr">{abbr(id)}</span></>;
}

function resultText(m: TournamentMatch): string {
  const r = m.result;
  if (!r) return '';
  if (r.type === 'bye') return 'Bye';
  const how = SHORT[r.type] ?? r.type;
  return r.type === 'fall' ? how : `${how} ${r.score[r.winner]}–${r.score[r.winner === 0 ? 1 : 0]}`;
}

function MatchBox({ t, m }: { t: Tournament; m: TournamentMatch }) {
  const pair = pairOf(t, m);
  const mine = pair.includes(t.player);
  return (
    <div className={`tbox ${mine ? 'tbox--mine' : ''} ${m.result?.type === 'bye' ? 'tbox--bye' : ''}`}>
      {pair.map((id, i) => (
        <span key={i} className={`tbox__who ${m.result && m.result.winner === i ? 'tbox__who--won' : ''} ${id === t.player ? 'tbox__who--you' : ''}`}><Who t={t} id={id} /></span>
      ))}
      {m.result && m.result.type !== 'bye' && <span className="tbox__res">{resultText(m)}{m.result.simulated ? '' : ' · wrestled'}</span>}
    </div>
  );
}

const CHAMP: Array<[string, string]> = [['r1-', 'First round'], ['r2-', 'Second round'], ['qf-', 'Quarters'], ['sf-', 'Semis'], ['final', 'Final']];
const CONSI: Array<[string, string]> = [['c1-', 'Consi 1'], ['c2-', 'Consi 2'], ['c3-', 'Consi 3'], ['c4-', 'Blood round'], ['c5-', 'Consi QF'], ['c6-', 'Consi SF']];

function Rounds({ t, rounds }: { t: Tournament; rounds: Array<[string, string]> }) {
  return (
    <div className="tbracket" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
      {rounds.map(([prefix, label]) => (
        <div key={prefix} className="tbracket__col">
          <div className="tbracket__head">{label}</div>
          {/* Each round spreads over the full height, so a match sits midway between the two that feed it. */}
          <div className="tbracket__body">
            {t.matches.filter((m) => m.id.startsWith(prefix)).map((m) => <MatchBox key={m.id} t={t} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The tournament between matches (owner, November 10): your seed and your next match with Wrestle or Sim bout, your
 * path so far, and the whole bracket, championship and consolation, with the placings once they are known.
 */
export function TournamentScreen({ state, api }: { state: UiState; api: GameApi }) {
  const t = state.tournament!;
  const busy = state.tournamentBusy;
  const next = playerMatch(t);
  const inIt = stillIn(t);
  const done = isDone(t);
  const me = byId(t.player);
  const places = placements(t);
  const myPlace = places.find((p) => p.id === t.player)?.place;
  const opp = next ? (() => { const [a, b] = pairOf(t, next); return (a === t.player ? b : a)!; })() : null;
  const mine = t.matches.filter((m) => m.result && m.result.type !== 'bye' && pairOf(t, m).includes(t.player));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && next && !busy) api.wrestleTournament();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="title dual tournament">
      <aside className="title__panel">
        <header className="dual__board" aria-label="Tournament">
          <div className="dual__team dual__team--l">
            <span className="tape__corner tape__corner--red" />
            <span className="dual__name">{schoolLabel(me).name} · seed {seedOf(t, t.player)}</span>
            <span className="tournament__name">{me.firstName} {me.lastName}</span>
          </div>
          <div className="dual__meta">{t.weight === 285 ? 'Heavyweight' : `${t.weight} lbs`} · Legends Championships · {t.entrants.length} men</div>
        </header>

        {busy || (next && boutsAhead(t) > 0) ? (
          <section className="field"><p className="dual__winner">Simulating other bouts…</p><p className="field__note">The rest of the bracket wrestles on.</p></section>
        ) : next && opp ? (
          <section className="field">
            <h2>{next.round}{next.side === 'consolation' ? ' · consolation' : ''}</h2>
            <p className="field__note">{next.side === 'consolation' ? 'Lose again and you are out.' : next.id === 'final' ? 'For the title.' : next.side === 'placement' ? `For ${next.round}.` : 'Win and keep going on the championship side; lose and you wrestle back.'}</p>
            <div className="tiles">
              <Tile w={byId(opp)} on onPick={() => {}} corner="green" />
            </div>
            <p className="field__note">Seed {seedOf(t, opp)} · {schoolLabel(byId(opp)).name}</p>
            <div className="dual__actions">
              <button type="button" className="cta" onClick={() => api.wrestleTournament()}>
                <span>Wrestle</span>
                <Key>Enter</Key>
              </button>
              <button type="button" className="menu__btn" onClick={() => api.simTournamentBout()}>Sim bout</button>
            </div>
          </section>
        ) : (
          <section className="field dual__final">
            <h2>{done ? 'Final placings' : 'Your tournament'}</h2>
            <p className="dual__winner">
              {myPlace === 1 ? 'National champion' : myPlace ? `${ordinal(myPlace)} place · All-American` : inIt ? 'Waiting on the bracket' : 'Out: two losses'}
            </p>
            {!done && !inIt && <button type="button" className="menu__btn" onClick={() => api.simTournamentRest()}>Sim the rest</button>}
            {done && <button type="button" className="cta" onClick={() => api.leaveTournament()}><span>New tournament</span></button>}
          </section>
        )}

        {mine.length > 0 && (
          <section className="field">
            <h2>Your matches</h2>
            <table className="dual-sheet">
              <tbody>
                {mine.map((m) => {
                  const pair = pairOf(t, m);
                  const meSlot = pair[0] === t.player ? 0 : 1;
                  const won = m.result!.winner === meSlot;
                  return (
                    <tr key={m.id} className={won ? 'dual-sheet__won' : 'dual-sheet__lost'}>
                      <td>{m.round}</td>
                      <td>{who(t, pair[meSlot === 0 ? 1 : 0])}</td>
                      <td className="lead">{won ? 'W' : 'L'} {resultText(m)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {!done && (
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.leaveTournament()}>
            Leave tournament
          </button>
        )}
      </aside>

      <section className="tape tournament__tape" aria-label="Bracket">
        {places.length > 0 && (
          <>
            <div className="tbracket__head">Placings{places.length === 8 ? ' · All-Americans' : ''}</div>
            <ol className="tournament__places">
              {places.map((p) => (
                <li key={p.place} className={p.id === t.player ? 'tbox__who--you' : ''}>
                  <strong>{ordinal(p.place)}</strong> {who(t, p.id)}
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="tbracket__title">Championship</div>
        <Rounds t={t} rounds={CHAMP} />
        <div className="tbracket__title">Consolation</div>
        <Rounds t={t} rounds={CONSI} />
        <div className="tbracket__title">Placement</div>
        <div className="tbracket" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {['final', 'p3', 'p5', 'p7'].map((id) => {
            const m = t.matches.find((x) => x.id === id)!;
            return (
              <div key={id} className="tbracket__col">
                <div className="tbracket__head">{m.round}</div>
                <MatchBox t={t} m={m} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
