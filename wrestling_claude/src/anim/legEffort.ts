import {P} from './posture';
import type {LocalPose} from './spec';

/** Paired effort before contact solving. Grounded feet stay planted while
 * hips/head yield; hands follow their existing opponent-bone anchors. */
export function applyLegEffort(p:LocalPose,clip:string,attacker:boolean,reaction:boolean,button:string,amount:number,mirror:boolean):boolean {
 if(!['legsDouble','legsSingle','legsHighCrotch','legsLowSingle'].includes(clip))return false;
 const attackingEffort=attacker!==reaction;
 const side=mirror?-1:1;
 if(attackingEffort){
  if(attacker){
   p[P.HIPS+2]+=.045*amount;
   p[P.SPINE]+=.07*amount;
   if(clip==='legsHighCrotch')p[P.HIPS+1]+=.025*amount;
   if(clip==='legsSingle')p[P.SPINE+1]+=.07*side*amount;
  }else{
   // The defender's hips give ground over the support foot. Only a foot
   // already off the mat is pulled with a single-leg effort.
   p[P.HIPS+2]+=.03*amount;
   p[P.SPINE]-=.06*amount;
   if(clip==='legsSingle'||clip==='legsHighCrotch'){
    const trapped=mirror?P.FOOT_L:P.FOOT_R;
    if(p[trapped+1]>.12){p[trapped+2]-=.045*amount;p[trapped+1]+=.02*amount;}
   }
  }
 }else if(button==='sprawl'){
  if(attacker){p[P.HIPS+1]-=.025*amount;p[P.SPINE]+=.12*amount;p[P.HEAD]+=.12*amount;}
  else{p[P.HIPS+2]+=.05*amount;p[P.HIPS+1]-=.035*amount;p[P.SPINE]+=.08*amount;}
 }else{
  // Clearing hands/whizzer pressure turns the upper body across the grip.
  p[P.SPINE+1]+=(attacker?-.08:.12)*side*amount;
  p[P.HEAD+1]+=(attacker?-.06:.06)*side*amount;
 }
 return true;
}
