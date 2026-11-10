import {Input,NO_PAD} from '../engine/Input';
import {Bout,type Position} from '../sim/bout';
import {PROTOTYPE_ROSTER} from '../sim/roster';
import {NO_COMMAND} from '../sim/types';
const ok=(v:boolean,m:string)=>{if(!v)throw Error(m)};
// Exercise the real device adapters with minimal browser event surfaces.
const win=new EventTarget();
Object.defineProperty(globalThis,'window',{value:win,configurable:true});
let pressed=false;
Object.defineProperty(globalThis,'navigator',{value:{getGamepads:()=>[{axes:[0,0],buttons:[{pressed}, {}, {}]}]},configurable:true});
const send=(target:EventTarget,type:string,data:object)=>{
 const e=new Event(type,{cancelable:true});Object.assign(e,data);target.dispatchEvent(e);
};
function run(device:'keyboard'|'gamepad'|'touch',hz:number){
 const target=new EventTarget(),input=new Input(target);
 const b=new Bout([PROTOTYPE_ROSTER[0],PROTOTYPE_ROSTER[1]],{},21);
 b.position={kind:'mat',A:0,sub:'exposed',t:0,frame:{x:0,z:0,yaw:0},base:.4,control:.5,escape:0,expo:0,awarded:0,pin:.1,pinHold:0,fight:0,commit:0,basing:0,turnCool:0,intensity:0};
 if(device==='keyboard')send(target,'keydown',{code:'KeyJ'});
 if(device==='gamepad'){pressed=true;send(win,'gamepadconnected',{gamepad:{index:0}});}
 if(device==='touch')input.touch={...NO_PAD,shoot:true};
 for(let i=0;i<hz*.6;i++){
  const pad=input.state();
  ok(!!pad.sustainedEffort,`${device} enables hold effort`);
  b.tick(1/hz,[{...NO_COMMAND,shoot:pad.shoot,sustainedEffort:pad.sustainedEffort},NO_COMMAND]);
 }
 if(device==='keyboard')send(target,'keyup',{code:'KeyJ'});
 if(device==='gamepad')pressed=false;
 if(device==='touch')input.touch={...NO_PAD};
 ok(!input.state().sustainedEffort,`${device} release ends holding`);
 input.dispose();
 return {gas:b.athletes[0].stamina,pin:(b.position as Extract<Position,{kind:'mat'}>).pin};
}
for(const hz of [30,60,120]){
 const keyboard=run('keyboard',hz);
 for(const device of ['gamepad','touch'] as const){
  const other=run(device,hz);
  ok(Math.abs(keyboard.gas-other.gas)<1e-9&&Math.abs(keyboard.pin-other.pin)<1e-9,`${hz}Hz ${device} equals keyboard pressure and cost`);
 }
}
console.log('Real keyboard/gamepad/touch adapters produce equal pin effort, cost and release at30/60/120Hz');
