import {isArmBar} from '../sim/armBars';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from '../game/Game';
import { UiStore } from '../game/store';
import type { UiState } from '../game/store';
import { TitleScreen } from './TitleScreen';
import { Hud } from './Hud';
import { ResultCard } from './ResultCard';
import { TouchControls } from './TouchControls';
import {TopTurnPicker} from './TopTurnPicker';
import { HelpPanel } from './HelpPanel';

const store = new UiStore();

function Loading({ state }: { state: UiState }) {
  return (
    <div className="loading" role="status">
      <div className="loading__mark">
        Legends<span>of College Wrestling</span>
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
      {state.screen === 'playing' && state.phase === 'wrestling' && state.touchControls && game && !state.result && <TouchControls state={state} api={game} />}
      {state.difficulty==='practice' && (state.screen==='playing'||state.screen==='results') && game && <div className="practice-panel" aria-label="Practice controls">
        <strong>Practice · unlimited time</strong>
        <span>Cooperative partner · choose a position to reset</span>
        {(['Standing','Top','Bottom'] as const).map(position=><button key={position} onClick={()=>{
          const sim=game.resetPractice();if(!sim)return;game.setPaused(false);
          if(position==='Standing')sim.bout.setNeutral({x:0,z:0},0);
          else sim.bout.setReferee(position==='Top'?state.humanSide:(state.humanSide===0?1:0),{x:0,z:0},0);
        }}>{position}</button>)}
      </div>}
      {import.meta.env.DEV && new URLSearchParams(location.search).has('practice') && (state.screen === 'playing'||state.screen === 'results') && game && <div style={{position:'absolute',left:8,top:110,zIndex:20,display:'flex',flexWrap:'wrap',maxWidth:'95vw',gap:4}}>
        {(['Pin top','Pin bottom','Bar top','Bar bottom','Spladle top','Spladle bottom','Ride top','Ride bottom','Flat top','Flat bottom','Leg ride bottom','Weak base','Single','Lifted single','Double','Low single','High crotch'] as const).map(label => <button style={{color:'#fff',background:'#223145',fontSize:11,padding:6,borderRadius:5}} key={label} onClick={() => {
          const sim = game.resetPractice();
          if (!sim) return;
          game.setPaused(false);
          sim.phase = 'wrestling'; sim.clock = 180;
          game.cancelTouch();
          sim.bout.setReferee(label.includes('bottom') || label === 'Weak base' ? 1 : 0,{x:new URLSearchParams(location.search).has('edge')?4.4:0,z:0},0);
          if (sim.bout.position.kind === 'mat') sim.bout.position.base = label === 'Weak base' ? .1 : .6;
          if (sim.bout.position.kind === 'mat' && label === 'Leg ride bottom') Object.assign(sim.bout.position,{sub:'flat',base:.1,legRide:1,pockets:0,legCaught:0});
          if(sim.bout.position.kind==='mat' && label==='Flat top') Object.assign(sim.bout.position,{sub:'flat',base:.3,control:.5,turnCool:0});
          if (sim.bout.position.kind === 'mat' && label === 'Flat bottom') Object.assign(sim.bout.position,{sub:'flat',base:.1,legRide:.5,pockets:.8,legCaught:.4});
          if(sim.bout.position.kind==='mat' && label.startsWith('Bar')){
            const requested=new URLSearchParams(location.search).get('bar');
            Object.assign(sim.bout.position,{sub:'exposed',turnStyle:isArmBar(requested)?requested:'barHalf',mirror:new URLSearchParams(location.search).has('mirror'),pin:.2});
          }
          if (sim.bout.position.kind === 'mat' && (label.startsWith('Pin') || label.startsWith('Spladle'))) { sim.bout.position.sub = label.startsWith('Spladle') ? 'spladle' : 'exposed'; sim.bout.position.turnStyle = label.startsWith('Pin') ? 'cradle' : undefined; sim.bout.position.pin = .2; }
          if (label === 'Single' || label === 'Lifted single' || label === 'Double' || label === 'Low single' || label === 'High crotch') sim.bout.position = {kind:'legs',A:0,shot:label === 'Double' ? 'double' : label === 'Low single' ? 'lowSingle' : label === 'High crotch' ? 'highCrotch' : 'single',mirror:false,t:0,frame:{x:0,z:0,yaw:0},progress:.6,intensity:0,lifted:label === 'Lifted single' ? .5 : 0};
          sim.bout.athletes.forEach(a => {a.stamina=1});
        }}>{label}</button>)}
      </div>}
      {state.screen==='playing' && game && <TopTurnPicker state={state} api={game} />}
      {state.showHelp && game && <HelpPanel api={game} />}
    </div>
  );
}
