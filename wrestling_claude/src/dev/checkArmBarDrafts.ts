import '../anim/library';
import {sampleHold,sampleMove} from '../anim/clips';
import {P} from '../anim/posture';
import {createLocal} from '../anim/spec';
for(const id of ['armBar','wristBar','barHalf','doubleBar'])for(const role of ['A','B'] as const)for(const mirror of [false,true]){
 for(let i=0;i<=20;i++)for(const suffix of ['Turn','Resisted']){
  const p=createLocal();sampleMove(id+suffix,role,i/20,mirror,p);
  if(!p.every(Number.isFinite))throw Error(`${id}${suffix} invalid pose`);
 }
 for(const [move,hold] of [[id+'Turn',id+'Pin'],[id+'Resisted','flat']]){
  const end=createLocal(),next=createLocal();
  sampleMove(move,role,1,mirror,end);sampleHold(hold,role,0,0,0,mirror,next);
  // Holds add breathing even with zero exertion; compare only authored root height.
  if(Math.abs(end[P.HIPS+1]-next[P.HIPS+1])>.01)throw Error(`${move} root discontinuity`);
 }
}
console.log('Four arm-bar drafts: both roles, mirrored sides, finite turns/resisted paths and landing height checked. Contact realism remains unverified.');
