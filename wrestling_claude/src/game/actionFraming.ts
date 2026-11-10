import type {ActionFraming} from '../engine/CameraRig';
import type {Position} from '../sim/bout';
import {ARM_BAR_GRIP_RELEASE,isArmBar} from '../sim/armBars';
import {CRADLE_GRIP_RELEASE} from '../sim/moves';
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Track exposure through its entry and release rather than switching framing
 * off the instant the referee starts a fall or a wrestler starts escaping. */
export function actionFraming(pos:Position,wrestling:boolean,radius:number):ActionFraming {
 let pin=0;
 if(wrestling){
  if(pos.kind==='mat'&&(pos.sub==='exposed'||pos.sub==='spladle'))pin=1;
  if(pos.kind==='move'){
   const u=pos.t/pos.dur;
   if(pos.id==='fall')pin=1;
   else if(pos.id==='fightOff'){
    const release=pos.turnStyle==='cradle'?CRADLE_GRIP_RELEASE:isArmBar(pos.turnStyle)?ARM_BAR_GRIP_RELEASE:.5;
    pin=1-smooth((u-release)/(1-release));
   }else if(['cradle','halfNelson','tilt','spladleCounter','sitOutTurn','sitOutPull','sitOutEscape'].includes(pos.id)||/^(armBar|wristBar|barHalf|doubleBar)Turn$/.test(pos.id))pin=smooth((u-.3)/.5);
  }
 }
 return {pin,mirror:'mirror' in pos?pos.mirror:false,edge:wrestling?smooth((radius-3.6)/1.1):0};
}
