import { useEffect, useState } from 'react';
import { formatClock, formatRidingTime, periodLabel } from '../sim/rules';
import { MEET } from '../sim/roster';
import type { ButtonId, GameApi, UiState } from '../game/store';
import type { Side } from '../sim/types';
import { Glyph, Key, PositionIcon } from './glyphs';

const CORNER = ['red', 'green'] as const;

/* ------------------------------------------------------------- scorebug --- */

function Scorebug({ state }: { state: UiState }) {
  const w = state.wrestlers!;
  const rt = state.ridingTime;
  const rtSide: Side = rt >= 0 ? 0 : 1;
  const showRt = Math.abs(rt) >= 1;
  return (
    <div className="bug">
      {([0, 1] as Side[]).map((side) => (
        <div
          key={side}
          className={`bug__team bug__team--${side === 0 ? 'l' : 'r'}`}
          style={{ ['--school' as string]: w[side].school.primary, ['--ink' as string]: w[side].school.secondary }}
        >
          <span className={`bug__corner bug__corner--${CORNER[side]}`} />
          <span className="bug__who">
            <span className="bug__school">{w[side].school.name}</span>
            <span className="bug__name">{w[side].lastName}</span>
          </span>
          <span className="bug__score" key={state.score[side]}>
            {state.score[side]}
          </span>
          {state.top === side && <span className="bug__tag">Top</span>}
        </div>
      ))}
      <div className="bug__clock">
        <span className="bug__period">{periodLabel(state.period)}</span>
        <span className={`bug__time ${state.clock <= 10 && state.phase === 'wrestling' ? 'bug__time--hot' : ''}`}>
          {formatClock(state.clock)}
        </span>
        {showRt && (
          <span className="bug__rt" style={{ color: w[rtSide].school.accent }}>
            RT {formatRidingTime(Math.abs(rt)).replace('+', '')} {Math.abs(rt) >= 60 ? '· +1' : ''}
          </span>
        )}
      </div>
      {state.nearFall.active && (
        <div className="bug__nearfall">
          Near fall <strong>{state.nearFall.timer.toFixed(1)}</strong>
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
  if (state.touchControls && state.device === 'touch') return null;
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
            {(p.state === 'mash' || p.state === 'hold') && <span className="pad__hint">{p.state === 'mash' ? 'mash' : 'hold'}</span>}
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
          {w.lastName}
          {detail ? ` · ${detail}` : ''}
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
          {x.school.name} {x.school.nickname}
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

function Choice({ state, api }: { state: UiState; api: GameApi }) {
  const options: Array<{ id: 'neutral' | 'top' | 'bottom'; label: string; note: string }> = [
    { id: 'neutral', label: 'Neutral', note: 'On your feet. Shots, ties and sprawls.' },
    { id: 'top', label: 'Top', note: 'Ride him, break him down, turn him for back points.' },
    { id: 'bottom', label: 'Bottom', note: 'Escape for one, reverse for two.' },
  ];
  return (
    <div className="modal" role="dialog" aria-label="Choose your position">
      <div className="modal__card">
        <div className="modal__kicker">Period {state.period + 1}</div>
        <h3>Your choice</h3>
        <div className="choices">
          {options.map((o, i) => (
            <button key={o.id} type="button" className="choices__btn" onClick={() => api.choosePosition(o.id)} autoFocus={i === 0}>
              <PositionIcon kind={o.id} />
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
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toTitle()}>
            Leave match
          </button>
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
      <ScoreBanner state={state} />
      <Nameplate state={state} />
      {state.announcement && (
        <div className={`call call--${state.announcement.tone}`} key={`call-${state.announcement.id}`}>
          <strong>{state.announcement.text}</strong>
          {state.announcement.detail && <em>{state.announcement.detail}</em>}
        </div>
      )}
      {state.react && live && (
        <div className="react" key={`react-${state.react.id}`}>
          <Glyph id={state.react.button} device={state.device} />
          <strong>{state.react.label}</strong>
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
      {state.awaitingChoice && <Choice state={state} api={api} />}
      {state.paused && <Pause state={state} api={api} />}
      {import.meta.env.DEV && new URLSearchParams(location.search).has('fps') && <div className="fps">{state.fps} fps</div>}
    </div>
  );
}
