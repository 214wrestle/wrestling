import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from '../game/Game';
import { UiStore } from '../game/store';
import type { UiState } from '../game/store';
import { TitleScreen } from './TitleScreen';
import { Hud } from './Hud';
import { ResultCard } from './ResultCard';
import { TouchControls } from './TouchControls';
import { HelpPanel } from './HelpPanel';

const store = new UiStore();

function Loading({ state }: { state: UiState }) {
  return (
    <div className="loading" role="status">
      <div className="loading__mark">
        Mat<span>Rivals</span>
      </div>
      <div className="loading__bar">
        <i style={{ transform: `scaleX(${Math.max(0.08, state.loading)})` }} />
      </div>
      <div className="loading__text">Building the athletes…</div>
    </div>
  );
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const state: UiState = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    if (!canvasRef.current) return;
    const instance = new Game(canvasRef.current, store);
    setGame(instance);
    return () => instance.dispose();
  }, []);

  return (
    <div className={`app app--${state.screen}`}>
      <div className="stage">
        <canvas ref={canvasRef} className="viewport" />
        <div className="vignette" />
      </div>

      {state.screen === 'title' && game && <TitleScreen state={state} api={game} />}
      {state.screen === 'loading' && <Loading state={state} />}
      {(state.screen === 'playing' || state.screen === 'results') && game && <Hud state={state} api={game} />}
      {state.screen === 'results' && game && <ResultCard state={state} api={game} />}
      {state.screen === 'playing' && state.touchControls && game && !state.result && <TouchControls state={state} api={game} />}
      {state.showHelp && game && <HelpPanel api={game} />}
    </div>
  );
}
