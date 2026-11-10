import { teamScore } from '../sim/dual';
import { iconSchool, schoolLabel } from '../sim/schoolAbbr';
import { useEffect, useState } from 'react';
import { formatClock, formatRidingTime, overtimePart, overtimeRound, periodLabel } from '../sim/rules';
import { MEET } from '../sim/roster';
import type { ButtonId, GameApi, UiState } from '../game/store';
import type { Side } from '../sim/types';
import { actionInstruction } from '../game/prompts';
import { Glyph, Key, PositionIcon } from './glyphs';
import { PLAN_FOCUS, PLAN_STYLES, PLAN_TOP, topPlanOf, type TopPlan } from '../sim/strategy';

const CORNER = ['red', 'green'] as const;

/* ------------------------------------------------------------- scorebug --- */

function Scorebug({ state }: { state: UiState }) {
  const w = state.wrestlers!;
  const rt = state.ridingTime;
  const rtSide: Side = rt >= 0 ? 0 : 1;
  const showRt = Math.abs(rt) >= 1;
  return (
    <div className={`bug${state.difficulty === 'practice' ? ' bug--practice' : ''}`}>
      {([0, 1] as Side[]).map((side) => (
        <div
          key={side}
          className={`bug__team bug__team--${side === 0 ? 'l' : 'r'}`}
          style={{ ['--school' as string]: w[side].school.primary, ['--ink' as string]: w[side].school.secondary }}
        >
          <span className={`bug__corner bug__corner--${CORNER[side]}`} />
          <span className="bug__who">
            <span className="bug__school">{schoolLabel(w[side], !!state.dual).name}</span>
            <span className="bug__name">{w[side].lastName}</span>
          </span>
          {(state.stalls[side].warned || state.stalls[side].points > 0) && (
            <span className="bug__stall" title="Stalling: warned, then a point for each call">
              {state.stalls[side].points ? `Stall ${state.stalls[side].points}` : 'Warned'}
            </span>
          )}
          <span className="bug__score" key={state.score[side]}>
            {state.score[side]}
          </span>
          {state.top === side && <span className="bug__tag">Top</span>}
        </div>
      ))}
      <div className="bug__clock">
        <span className="bug__period">{periodLabel(state.period)}</span>
        <span className={`bug__time ${state.clock <= 10 && state.phase === 'wrestling' ? 'bug__time--hot' : ''}`}>
          {state.difficulty==='practice'?'∞':formatClock(state.clock)}
        </span>
        {state.dual && (
          <span className="bug__dual">Dual {teamScore(state.dual)[0]}–{teamScore(state.dual)[1]}</span>
        )}
        {showRt && (
          <span className="bug__rt" style={{ color: w[rtSide].school.accent }}>
            RT {formatRidingTime(Math.abs(rt)).replace('+', '')} {Math.abs(rt) >= 60 ? '· +1' : ''}
          </span>
        )}
      </div>
      {state.nearFall.active && (
        <div className="bug__nearfall">
          Near fall <strong>{state.nearFall.earned ? `${state.nearFall.earned} earned` : state.nearFall.timer.toFixed(1)}</strong>
          {state.nearFall.earned > 0 && <span className="bug__nearfall-note">Awarded on release</span>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- player card --- */

function Bar({ value, tone, mark }: { value: number; tone: string; mark?: number }) {
  return (
    <span className="bar">
      <span className="bar__fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})`, background: tone }} />
      {mark !== undefined && <span className="bar__mark" style={{ left: `${mark * 100}%` }} />}
    </span>
  );
}

function PlayerCard({ state }: { state: UiState }) {
  const w = state.wrestlers!;
  const you = state.humanSide;
  const them: Side = you === 0 ? 1 : 0;
  const gas = state.stamina[you];
  return (
    <div className="card" style={{ ['--school' as string]: w[you].school.primary }}>
      <div className="card__head">
        <span className={`card__corner card__corner--${CORNER[you]}`} />
        <span className="card__name">{w[you].lastName}</span>
        <span className="card__pos">{state.position}</span>
      </div>
      <div className="card__row">
        <span className="card__label">Gas</span>
        <Bar value={gas} tone={gas > 0.35 ? 'var(--good)' : gas > 0.15 ? 'var(--warn)' : 'var(--bad)'} />
      </div>
      {state.meters.map((m) => (
        <div className="card__row" key={m.label}>
          <span className="card__label">{m.label}</span>
          <Bar value={m.value} tone={m.tone === 'you' ? 'var(--gold)' : m.tone === 'them' ? 'var(--bad)' : 'var(--muted-ink)'} mark={m.mark} />
        </div>
      ))}
      <div className="card__row card__row--them">
        <span className="card__label">{w[them].lastName}</span>
        <Bar value={state.stamina[them]} tone="var(--muted-ink)" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- action pad --- */

function ActionPad({ state }: { state: UiState }) {
  const flash = state.flash;
  const [shown, setShown] = useState(flash);
  useEffect(() => {
    if (!flash) return;
    setShown(flash);
    const t = window.setTimeout(() => setShown(null), 420);
    return () => window.clearTimeout(t);
  }, [flash]);
  // Touch buttons are already visible before the first touch, and stay
  // visible after keyboard/gamepad input on hybrid devices. Do not stack a
  // second action pad under them based on the last input device.
  if (state.touchControls) return null;
  const order: ButtonId[] = ['shoot', 'fight', 'sprawl'];
  return (
    <div className="pad" aria-label="Moves">
      {order.map((id) => {
        const p = state.prompts[id];
        const f = shown && shown.button === id ? shown : null;
        const react = state.react && state.react.button === id;
        return (
          <div
            key={id}
            className={`pad__btn pad__btn--${id} pad__btn--${react ? 'hot' : p.state} ${f ? `pad__btn--${f.result}` : ''}`}
          >
            <Glyph id={id} device={state.device} />
            <span className="pad__label">{p.label}</span>
            <span className="pad__hint">{actionInstruction(p, id)}</span>
            {p.alt && <span className="pad__alt">{p.alt}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- callouts --- */

function ScoreBanner({ state }: { state: UiState }) {
  const e = state.lastScore;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!e) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(t);
  }, [e]);
  if (!e || !visible || !state.wrestlers) return null;
  const w = state.wrestlers[e.side];
  const [title, detail] = e.label.split(' — ');
  return (
    <div className={`score score--${e.side === 0 ? 'l' : 'r'}`} key={e.id} style={{ ['--school' as string]: w.school.primary, ['--ink' as string]: w.school.secondary }}>
      <span className="score__pts">+{e.points}</span>
      <span className="score__text">
        <strong>{title}</strong>
        <em>
          {e.kind === 'stalling' ? `1 point to ${e.side === 0 ? 'red' : 'green'}` : <>{w.lastName}{detail ? ` · ${detail}` : ''}</>}
        </em>
      </span>
    </div>
  );
}

function Nameplate({ state }: { state: UiState }) {
  const w = state.wrestlers!;
  if (state.phase !== 'intros' || state.introFocus === null) return null;
  const x = w[state.introFocus];
  return (
    <div className={`plate plate--${state.introFocus === 0 ? 'l' : 'r'}`} key={state.introFocus} style={{ ['--school' as string]: x.school.primary, ['--accent' as string]: x.school.accent }}>
      <span className="plate__bar" />
      <div className="plate__body">
        <span className="plate__school">
          {state.dual || !iconSchool(x) ? `${x.school.name} ${x.school.nickname}` : iconSchool(x)}
        </span>
        <span className="plate__name">
          <span>{x.firstName}</span> {x.lastName}
        </span>
        <span className="plate__meta">
          {x.legends ? 'Legends' : x.year} · {x.weightClass === 285 ? 'HWT' : `${x.weightClass} lbs`}
          {!x.legends && ` · ${x.record.wins}-${x.record.losses}`} 
          {x.seed ? ` · No. ${x.seed} seed` : ''} · {x.hometown}
        </span>
      </div>
      <span className={`plate__corner plate__corner--${CORNER[state.introFocus]}`}>{state.introFocus === 0 ? 'Red' : 'Green'}</span>
    </div>
  );
}

/** Your corner's game plan: chosen on the walk-out, changed between periods. */
function PlanCard({ state, api, inline = false }: { state: UiState; api: GameApi; inline?: boolean }) {
  const opp = state.opponentPlan;
  const oppStyle = PLAN_STYLES.find(s => s.id === opp.style)!.label;
  const oppFocus = PLAN_FOCUS.find(f => f.id === opp.focus)!.label;
  const style = PLAN_STYLES.find(s => s.id === state.plan.style)!;
  const focus = PLAN_FOCUS.find(f => f.id === state.plan.focus)!;
  return (
    <div className={`plan${inline ? ' plan--inline' : ''}`} aria-label="Match plan">
      <div className="plan__head"><strong>Game plan</strong><span>Rival corner: {oppStyle}{opp.focus !== 'none' ? ` · ${oppFocus}` : ''}</span></div>
      <div className="plan__row" role="group" aria-label="Style">
        {PLAN_STYLES.map(s => <button key={s.id} type="button" aria-pressed={state.plan.style === s.id} onClick={() => api.setPlan({ ...state.plan, style: s.id })}>{s.label}</button>)}
      </div>
      <small className="plan__note">{style.note}</small>
      <div className="plan__row plan__row--focus" role="group" aria-label="Focus">
        {PLAN_FOCUS.map(f => <button key={f.id} type="button" aria-pressed={state.plan.focus === f.id} onClick={() => api.setPlan({ ...state.plan, focus: f.id })}>{f.label}</button>)}
      </div>
      <small className="plan__note">{focus.note}</small>
      <div className="plan__row" role="group" aria-label="On top">
        {PLAN_TOP.map(t => <button key={t.id} type="button" aria-pressed={topPlanOf(state.plan) === t.id} onClick={() => api.setPlan({ ...state.plan, top: t.id })}>{t.label}</button>)}
      </div>
      <small className="plan__note">On top: {PLAN_TOP.find(t => t.id === topPlanOf(state.plan))!.note}</small>
      {state.refereeNote && <small className="plan__note plan__note--ref">{state.refereeNote}</small>}
    </div>
  );
}

/** On top at the whistle: the top plan, picked right there (it stays the plan until changed). */
function TopRestart({ state, api }: { state: UiState; api: GameApi }) {
  const current = state.topRestartCut ? 'cut' : topPlanOf(state.plan);
  const choose = (top: TopPlan) => { api.setPlan({ ...state.plan, top }); api.chooseTopRestart(top === 'cut'); };
  return (
    <div className="top-restart">
      <strong>At the whistle</strong>
      {PLAN_TOP.map(t => <button key={t.id} type="button" aria-pressed={current === t.id} title={t.note} onClick={() => choose(t.id)}>{t.id === 'cut' ? 'Cut · give 1' : t.label}</button>)}
    </div>
  );
}

/** The disc flip between the first and second periods. */
function CoinToss({ state }: { state: UiState }) {
  const w = state.coinTossWinner;
  if (w === null || !state.wrestlers) return null;
  const name = state.wrestlers[w].lastName;
  return (
    <div className="toss" aria-label="Coin toss">
      <div className={`toss__disc toss__disc--${CORNER[w]}`}><span className="toss__face toss__face--red">Red</span><span className="toss__face toss__face--green">Green</span></div>
      <strong>{CORNER[w] === 'red' ? 'Red' : 'Green'} · {name}</strong>
      <em>{state.dual ? `${w === state.humanSide ? 'You have' : 'He has'} the choice from the dual's coin toss: top, bottom, neutral, or defer to the third period` : `${w === state.humanSide ? 'You' : 'He'} won the toss: top, bottom, neutral, or defer to the third period`}</em>
    </div>
  );
}

function Choice({ state, api }: { state: UiState; api: GameApi }) {
  const options: Array<{ id: 'neutral' | 'top' | 'bottom' | 'defer'; label: string; note: string }> = [
    { id: 'neutral', label: 'Neutral', note: 'On your feet. Shots, ties and sprawls.' },
    { id: 'top', label: 'Top', note: 'Ride him, break him down, turn him for back points.' },
    { id: 'bottom', label: 'Bottom', note: 'Escape for one, reverse for two.' },
    ...(state.canDefer ? [{ id: 'defer' as const, label: 'Defer', note: state.period >= 3 ? 'He chooses now; you choose the second tiebreaker period.' : 'He chooses now; you choose in the third period.' }] : []),
  ];
  const next = state.period + 1;
  const kicker = next <= 3 ? `Period ${next}` : `Tiebreaker ${overtimeRound(next)} · ${overtimePart(next) === 1 ? 'first' : 'second'} 30 seconds`;
  return (
    <div className="modal" role="dialog" aria-label="Choose your position">
      <div className="modal__card modal__card--choice">
        <div className="modal__kicker">{kicker}</div>
        <h3>Your choice</h3>
        {state.difficulty !== 'practice' && <PlanCard state={state} api={api} inline />}
        <div className="choices">
          {options.map((o, i) => (
            <button key={o.id} type="button" className="choices__btn" onClick={() => api.choosePosition(o.id)} autoFocus={i === 0}>
              {o.id !== 'defer' && <PositionIcon kind={o.id} />}
              <strong>{o.label}</strong>
              <em>{o.note}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pause({ state, api }: { state: UiState; api: GameApi }) {
  return (
    <div className="modal" role="dialog" aria-label="Paused">
      <div className="modal__card modal__card--narrow">
        <div className="modal__kicker">Injury time</div>
        <h3>Paused</h3>
        <div className="menu">
          <button type="button" className="menu__btn menu__btn--primary" onClick={() => api.setPaused(false)} autoFocus>
            Resume <Key>Esc</Key>
          </button>
          <button type="button" className="menu__btn" onClick={() => api.toggleHelp()}>
            How to wrestle <Key>H</Key>
          </button>
          <button type="button" className="menu__btn" onClick={() => api.toggleMute()}>
            Sound {state.muted ? 'off' : 'on'} <Key>M</Key>
          </button>
          {state.tournament ? <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toTournament()}>
            Back to the bracket (match not scored)
          </button> : state.dual ? <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toDual()}>
            Back to the dual (bout not scored)
          </button> : <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toTitle()}>
            Leave match
          </button>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hud --- */

export function Hud({ state, api }: { state: UiState; api: GameApi }) {
  if (!state.wrestlers) return null;
  const live = !state.result && state.phase !== 'intros' && state.phase !== 'handshake';
  return (
    <div className="hud">
      <Scorebug state={state} />
      {live && <PlayerCard state={state} />}
      {live && <ActionPad state={state} />}
      {live && !state.touchControls && state.edgeHint && <div className="edge-hint" role="status">{state.edgeHint}</div>}
      {state.phase === 'setPosition' && state.top === state.humanSide && <TopRestart state={state} api={api} />}
      <ScoreBanner state={state} />
      <Nameplate state={state} />
      {state.announcement && (
        <div className={`call call--${state.announcement.tone}`} key={`call-${state.announcement.id}`}>
          <strong>{state.announcement.text}</strong>
          {state.announcement.detail && <em>{state.announcement.detail}</em>}
        </div>
      )}
      {state.react && live && state.prompts[state.react.button].label !== '—' && (
        <div className={`react${state.touchControls ? ' react--touch' : ''}`} key={`react-${state.react.id}`}>
          {!state.touchControls && <Glyph id={state.react.button} device={state.device} />}
          <strong>{state.react.label}</strong>
          {state.touchControls && <small>{actionInstruction(state.prompts[state.react.button], state.react.button)} {state.prompts[state.react.button].label}</small>}
        </div>
      )}
      {(state.phase === 'intros' || state.phase === 'handshake') && (
        <>
          <div className="meetline">
            {MEET.event} · {MEET.round} · {MEET.venue}
          </div>
          {state.phase === 'intros' && (
            <button type="button" className="skip" onClick={() => api.skipIntros()}>
              Skip <Key>Enter</Key>
            </button>
          )}
        </>
      )}
      {state.phase === 'coinToss' && <CoinToss state={state} />}
      {state.difficulty !== 'practice' && !state.result && !state.awaitingChoice && ['intros', 'handshake', 'coinToss', 'periodBreak', 'positionChoice'].includes(state.phase) && <PlanCard state={state} api={api} />}
      {state.awaitingChoice && <Choice state={state} api={api} />}
      {state.paused && <Pause state={state} api={api} />}
      {import.meta.env.DEV && new URLSearchParams(location.search).has('fps') && <div className="fps">{state.fps} fps</div>}
    </div>
  );
}
