import { useCallback, useEffect, useRef } from 'react';
import type { PadState } from '../engine/Input';
import type { GameApi, UiState } from '../game/store';

/**
 * On-screen controls for touch devices: a thumb stick on the left, the three
 * contextual buttons and a level button on the right. They feed the same pad
 * state the keyboard does.
 */
export function TouchControls({ state, api }: { state: UiState; api: GameApi }) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const stick = useRef({ x: 0, y: 0 });
  const legAction = useRef<PadState['legAction']>(undefined);
  const technique = useRef<PadState["technique"]>(undefined);
  const buttons = useRef({ shoot: false, fight: false, sprawl: false, level: false, lowSingle: false, scramble: false, legRide: false, closePockets: false, catchLeg: false });

  const push = useCallback(() => {
    api.setTouch({ ...stick.current, ...buttons.current, technique: technique.current, legAction: legAction.current });
  }, [api]);

  useEffect(
    () => () => api.setTouch({ x: 0, y: 0, shoot: false, fight: false, sprawl: false, level: false }),
    [api],
  );

  useEffect(() => {
    technique.current = undefined;
    legAction.current = undefined;
    buttons.current.lowSingle = false;
    buttons.current.scramble = false;
    buttons.current.legRide = false;
    buttons.current.closePockets = false;
    buttons.current.catchLeg = false;
    push();
  }, [state.position, push]);

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

  const release = () => {
    stick.current = { x: 0, y: 0 };
    if (knobRef.current) knobRef.current.style.transform = '';
    push();
  };

  const hold = (key: 'shoot' | 'fight' | 'sprawl' | 'level' | 'lowSingle' | 'scramble' | 'legRide' | 'closePockets' | 'catchLeg', down: boolean) => {
    buttons.current[key] = down;
    push();
  };

  return (
    <div className="touch">
      <div
        ref={padRef}
        className="touch__pad"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          track(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === 'touch') track(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span ref={knobRef} className="touch__knob" />
      </div>
      <div className="touch__buttons">
        {state.top !== null && (state.position === 'Top' || state.position === 'Bottom') && (state.top === state.humanSide ? ['legRide'] as const : ['closePockets','catchLeg'] as const).map(key => <button key={key} className="touch__btn touch__btn--small" onPointerDown={() => hold(key,true)} onPointerUp={() => hold(key,false)} onPointerLeave={() => hold(key,false)} onPointerCancel={() => hold(key,false)}>{ {legRide:'Work legs in',closePockets:'Close pockets',catchLeg:'Catch / clear leg'}[key] }</button>)}

        {state.position === 'In on the legs' && (['lift','trip','double','drive'] as const).map(action => <button key={action} className="touch__btn touch__btn--small" onPointerDown={() => {legAction.current=action;push()}} onPointerUp={() => {legAction.current=undefined;push()}} onPointerCancel={() => {legAction.current=undefined;push()}} onPointerLeave={() => {legAction.current=undefined;push()}}>{ {lift:'Lift leg',trip:'Trip',double:'Switch double',drive:'Drive back'}[action] }</button>)}
        

        {state.position === 'Neutral' && <details className="touch__techniques"><summary className="touch__btn touch__btn--small">Techniques</summary><div>{(['duckUnder','superDuck','slideBy','firemansCarry'] as const).map((move,i)=><button key={move} type="button" className="touch__btn" onPointerDown={()=>{technique.current=move;push()}} onPointerUp={()=>{technique.current=undefined;push()}} onPointerLeave={()=>{technique.current=undefined;push()}} onPointerCancel={()=>{technique.current=undefined;push()}}>{['Duck under','Super duck','Slide by','Fireman’s'][i]}</button>)}</div></details>}
        {(['lowSingle', 'scramble'] as const).map(key => <button key={key} hidden={key === 'lowSingle' ? state.position !== 'Neutral' : state.position === 'Neutral' || state.position === '—'} type="button" className="touch__btn" onPointerDown={() => hold(key,true)} onPointerUp={() => hold(key,false)} onPointerLeave={() => hold(key,false)} onPointerCancel={() => hold(key,false)}>{key === 'lowSingle' ? 'Low single' : 'Scramble'}</button>)}
        {(['sprawl', 'fight', 'shoot'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={`touch__btn touch__btn--${key} touch__btn--${state.prompts[key].state}`}
            onPointerDown={() => hold(key, true)}
            onPointerUp={() => hold(key, false)}
            onPointerLeave={() => hold(key, false)}
            onPointerCancel={() => hold(key, false)}
          >
            {state.prompts[key].label}
          </button>
        ))}
        <button
          type="button"
          className="touch__btn touch__btn--level"
          onPointerDown={() => hold('level', true)}
          onPointerUp={() => hold('level', false)}
          onPointerLeave={() => hold('level', false)}
          onPointerCancel={() => hold('level', false)}
        >
          {state.top === state.humanSide ? 'Cut' : 'Lower'}
        </button>
      </div>
    </div>
  );
}
