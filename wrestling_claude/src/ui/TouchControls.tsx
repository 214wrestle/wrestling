import { useCallback, useEffect, useRef, useState } from 'react';
import { NO_PAD, type PadState } from '../engine/Input';
import { TouchGestures, type TouchKey } from '../engine/TouchGestures';
import type { GameApi, UiState } from '../game/store';

/**
 * On-screen controls for touch devices: a thumb stick on the left, the three
 * contextual buttons and a level button on the right. They feed the same pad
 * state the keyboard does.
 */
export function TouchControls({ state, api }: { state: UiState; api: GameApi }) {
  const [feedback, setFeedback] = useState<{ text: string; result: string; id: number } | null>(null);
  const [shown, setShown] = useState(state.flash);
  const [held, setHeld] = useState<string | null>(null);
  const noticeId = useRef(0);
  useEffect(() => {
    if (!state.flash) return;
    setShown(state.flash);
    const label = state.flash.label ?? state.prompts[state.flash.button].label;
    const result = state.flash.result;
    const detail = result === 'blocked' ? 'Blocked' : result === 'lost' ? 'Opponent resisted' : result === 'won' ? 'Successful' : label === 'Squeeze' ? 'Tightening' : 'Working';
    setFeedback({ text: `${label} · ${detail}`, result, id: ++noticeId.current });
    const timer = window.setTimeout(() => setShown(null), 600);
    return () => window.clearTimeout(timer);
  }, [state.flash]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1400);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const capture = (e: React.PointerEvent<HTMLDivElement>) => {
    const button = (e.target as HTMLElement).closest('button');
    if (!button || button.disabled) return;
    button.setPointerCapture(e.pointerId);
    button.dataset.held = 'true';
    setHeld(button.textContent);
    const label = button.querySelector('.touch__label')?.textContent ?? button.childNodes[0]?.textContent ?? button.textContent;
    setFeedback({ text: `${label} · Attempted`, result: 'attempt', id: ++noticeId.current });
  };
  const pinning = state.meters.some(m => m.label === 'Pin');
  const contest = state.meters.length > 0 && state.position !== 'Neutral';
  const contestHint = pinning
    ? state.top === state.humanSide ? 'Tap or hold Squeeze to tighten' : 'Tap or hold to fight off your back'
    : state.position === 'In on the legs' ? 'Hold a finish; watch your progress'
    : state.position === 'Defending the shot' ? 'Tap or hold to resist the finish'
    : state.meters.some(m => m.label === 'Base') ? state.top === state.humanSide ? 'Break down their base to open a turn' : 'Build your base to set up an escape'
    : state.meters.some(m => m.label === 'Escape') ? state.top === state.humanSide ? 'Return or cut; stop their escape' : 'Keep working to break their grip'
    : 'Keep working; watch the hold progress';
  const hint = (key: 'shoot' | 'fight' | 'sprawl') => {
    const prompt = state.prompts[key];
    if (prompt.label === '—') return 'Unavailable';
    if (pinning || prompt.state === 'mash') return 'Tap or hold';
    return prompt.state === 'hold' ? 'Hold' : 'Tap';
  };
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const stick = useRef({ x: 0, y: 0 });
  const gestures = useRef(new TouchGestures());
  const stickPointer = useRef<number | null>(null);
  const buttonGroup = useRef<HTMLDivElement>(null);
  const push = useCallback(() => {
    api.setTouch({ ...NO_PAD, ...stick.current, ...gestures.current.state() });
  }, [api]);

  const reset = useCallback(() => {
    gestures.current.clear();
    stick.current = { x: 0, y: 0 };
    stickPointer.current = null;
    if (knobRef.current) knobRef.current.style.transform = '';
    buttonGroup.current?.querySelectorAll<HTMLButtonElement>('[data-held]').forEach(b => { delete b.dataset.held; });
    setHeld(null);
    api.cancelTouch();
  }, [api]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      api.cancelTouch();
    };
  }, [api, reset]);
  const legActionSet = state.legActions?.join(',') ?? '';
  useEffect(() => { reset(); }, [state.position, legActionSet, reset]);

  const endAction = (e: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const key = gestures.current.end(e.pointerId);
    if (!key) return; // Normal release already handled before lostpointercapture.
    if (!gestures.current.has(key)) {
      delete e.currentTarget.dataset.held;
      if (cancelled) api.cancelTouch(key);
    }
    setHeld(gestures.current.size ? 'Working' : null);
    push();
  };
  const bindAction = (key: TouchKey, value: boolean | NonNullable<PadState['technique']> | NonNullable<PadState['legAction']> = true) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      gestures.current.begin(e.pointerId, key, value);
      push();
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => endAction(e, false),
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => endAction(e, true),
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => endAction(e, true),
  });

  const track = (e: React.PointerEvent) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const len = Math.hypot(nx, ny);
    if (len > 1) {
      nx /= len;
      ny /= len;
    }
    stick.current = { x: nx, y: -ny };
    if (knobRef.current) knobRef.current.style.transform = `translate(${nx * 34}px, ${ny * 34}px)`;
    push();
  };

  const release = (e: React.PointerEvent) => {
    if (stickPointer.current !== e.pointerId) return;
    stickPointer.current = null;
    stick.current = { x: 0, y: 0 };
    if (knobRef.current) knobRef.current.style.transform = '';
    push();
  };

  return (
    <div className="touch">
      <div
        ref={padRef}
        className="touch__pad"
        onPointerDown={(e) => {
          if (stickPointer.current !== null) return;
          stickPointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          track(e);
        }}
        onPointerMove={(e) => {
          if (stickPointer.current === e.pointerId) track(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span ref={knobRef} className="touch__knob" />
      </div>
      <div ref={buttonGroup} className="touch__buttons" onPointerDownCapture={capture}>
        <div className="touch__status">
          <div className={`touch__notice touch__notice--${feedback?.result ?? 'idle'}`} role="status" key={feedback?.id}>{feedback?.text ?? (held ? 'Keep working' : 'Tap a move to attempt it')}</div>
          {contest && <div className="touch__contest">
            {state.meters.map(m => <label key={m.label} data-tone={m.tone}>{m.label}<progress max="1" value={Math.max(0, Math.min(1, m.value))} />{Math.round(Math.max(0, Math.min(1, m.value)) * 100)}%</label>)}
            {([state.humanSide, state.humanSide === 0 ? 1 : 0] as const).map(side => <label key={side}>{side === state.humanSide ? 'Your stamina' : 'Rival stamina'}<progress max="1" value={state.stamina[side]} />{Math.round(state.stamina[side] * 100)}%</label>)}
            <small>{contestHint}</small>
          </div>}
        </div>
        {state.top !== null && state.meters.some(m => m.label === 'Base') && (state.top === state.humanSide ? ['legRide'] as const : ['closePockets','catchLeg'] as const).map(key => <button key={key} className="touch__btn touch__btn--small" {...bindAction(key)}>{ {legRide:'Work legs in',closePockets:'Close pockets',catchLeg:'Catch / clear leg'}[key] }<small className="touch__hint">Hold</small></button>)}

        {state.legActions?.map(action => <button key={action} className="touch__btn touch__btn--small" {...bindAction('legAction', action)}>{ {lift:'Lift leg',trip:'Trip',double:'Switch double',drive:'Drive back'}[action] }<small className="touch__hint">Hold</small></button>)}


        {state.position === 'Neutral' && <details className="touch__techniques"><summary className="touch__btn touch__btn--small">Techniques</summary><div>{(['duckUnder','superDuck','slideBy','firemansCarry','footSweep'] as const).map((move,i)=><button key={move} type="button" className="touch__btn" {...bindAction('technique', move)}>{['Duck under','Super duck','Slide by','Fireman’s','Foot sweep'][i]}<small className="touch__hint">Tap</small></button>)}</div></details>}
        {(['lowSingle', 'scramble'] as const).map(key => <button key={key} hidden={key === 'lowSingle' ? state.position !== 'Neutral' : state.position === 'Neutral' || state.position === '—'} type="button" className="touch__btn" {...bindAction(key)}>{key === 'lowSingle' ? 'Low single' : 'Scramble'}<small className="touch__hint">Tap</small></button>)}
        {(['sprawl', 'fight', 'shoot'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`touch__btn touch__btn--${key} touch__btn--${state.prompts[key].state} ${shown?.button === key ? `touch__btn--${shown.result}` : ''}`}
            disabled={state.prompts[key].state === 'off' && state.prompts[key].label === '—'}
            {...bindAction(key)}
          >
<span className="touch__label">{state.prompts[key].label}</span><small className="touch__hint">{hint(key)}</small>
          </button>
        ))}
        <button
          type="button"
          className="touch__btn touch__btn--level"
          {...bindAction('level')}
        >
          {state.top === state.humanSide ? 'Cut' : 'Lower'}
        </button>
      </div>
    </div>
  );
}
