import {P} from './posture';
import type {LocalPose} from './spec';

// Shared endpoint for the pin, turn and recovery support paths.
export const DOUBLE_BAR_FRONT_SUPPORT_X=.70;
export const isArmBarPin=(clip:string)=>(/^(armBar|wristBar|barHalf|doubleBar)Pin$/.test(clip)||clip==='armBarSupportedSeatedFinishDraft');

/** Keep both bent arms with the rolling trunk while the double bar is seated.
 * Pair-space hand keys otherwise remain in the air as the torso turns over. */
export function applyDoubleBarDefender(p:LocalPose,clip:string,u:number,hold:boolean,mirror=false):void {
 if(!clip.startsWith('doubleBar'))return;
 const ramp=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
 const weight=hold||clip==='doubleBarFall'||(clip==='doubleBarSupportedRecoverDraft'||clip==='doubleBarSupportedEntryDraft'||clip==='doubleBarHeadPostEntryDraft'||clip==='doubleBarHeadPostRecoverDraft')?1:clip==='doubleBarTurn'?ramp((u-.1)/.18):
  clip==='doubleBarSupportedReleaseDraft'?1-ramp(u/.20):clip==='doubleBarExit'?1-ramp(u/.4):clip==='doubleBarResisted'?ramp((u-.12)/.18)*(1-ramp((u-.55)/.18)):0;
 const roll=p[P.HIPS_Q+3],c=Math.cos(roll),s=Math.sin(roll);
 for(const side of [1,-1]){
  const left=side===1;
  // The second arm stays posted until the rider gathers it. Keep this in
  // post-mirror space so the same capture order survives a right-side turn.
  const second=left===mirror;
  const capture=clip==='doubleBarTurn'&&second?ramp((u-.10)/.18):1;
  for(const [at,x,y,z] of [[left?P.HAND_L:P.HAND_R,side*.13,.15,.18],
   [left?P.ELBOW_L:P.ELBOW_R,side*.34,.06,.40]] as const){
   const target=[p[P.HIPS]+x*c-y*s,p[P.HIPS+1]+x*s+y*c,p[P.HIPS+2]+z];
   if(clip==='doubleBarTurn'&&second){
    const post=at===(left?P.HAND_L:P.HAND_R)?[side*.22,.06,.62]:[side*.40,.13,.38];
    for(let axis=0;axis<3;axis++)target[axis]=post[axis]+(target[axis]-post[axis])*capture;
   }
   for(let axis=0;axis<3;axis++)p[at+axis]+=(target[axis]-p[at+axis])*weight;
  }
 }
}
/** Move the trunk around planted supports; the contact solver carries the bar
 * with the controlled forearm rather than pulling a detached hand through air. */
export function applyArmBarResistance(p:LocalPose,top:boolean,value:number,mirror:boolean,seated=false,scale=1):void {
 const amount=Math.max(0,Math.min(1,value)),side=mirror?-1:1;
 // Rock the lifted pelvis about the upper-back support rather than lifting
 // the shoulder plane with the hips. Pair pitch is shared across mirrors.
 if(seated&&!top){
  p[P.HIPS_Q+1]+=Math.asin(.04*amount/(.38*scale));
  p[P.HEAD]+=.35*amount;
 }
 p[P.HIPS+1]+=(top?(seated?0:.018):.04)*amount;
 // Seated resistance loads the planted base: lift/rotate without sliding the
 // pelvis sideways beneath arm targets secured by the opponent.
 if(!seated)p[P.HIPS]+=(top?.018:.025)*side*amount;
 p[P.SPINE+2]+=(top?.045:.16)*side*amount;
}
export function applyArmBarEffort(p:LocalPose,clip:string,top:boolean,reaction:boolean,button:string,amount:number,mirror:boolean,resistance=0,scale=1,pairedAmount=amount):boolean {
 // Lab seated finish uses the same paired effort response; match routing is unchanged.
 const seatedDraft=clip==='armBarSeatedFinishDraft'||clip==='armBarSupportedSeatedFinishDraft';
 if(seatedDraft)clip='armBarPin';
 if(!isArmBarPin(clip))return false;
 const side=mirror?-1:1,offense=top!==reaction;
 const barElbow=mirror?P.ELBOW_R:P.ELBOW_L;
 if(offense){
  if(top){
   // Sit-through pressure comes from extending the back over planted feet.
   // Chest-down combinations retain their separate downward drive.
   p[P.HIPS+1]+=(seatedDraft?0:clip==='armBarPin'?.035:-.025)*amount;
   p[P.HIPS+2]+=.025*amount;
   p[P.SPINE]+=(clip==='armBarPin'?-.08:.10)*amount;
   p[barElbow]-=.025*side*amount;
  }else{
   if(seatedDraft){
    // Tightening settles the existing bridge, with the same support geometry
    // on the way down as on the way up. Never push below the authored flat pose.
    const before=Math.max(0,Math.min(1,resistance));
    const after=before*(1-Math.max(0,Math.min(1,pairedAmount)));
    p[P.HIPS+1]+=.04*(after-before);
    p[P.HIPS_Q+1]+=Math.asin(.04*after/(.38*scale))-Math.asin(.04*before/(.38*scale));
    p[P.HEAD]+=.35*(after-before);
    p[P.SPINE+2]+=.16*(after-before)*side;
   }else p[P.SPINE+2]-=.065*side*amount;
   p[P.HEAD+1]-=.035*side*amount;
   p[barElbow+2]-=.018*amount;
  }
 }else{
  if(top){
   // In the seated finish the rider absorbs a bridge through the trunk,
   // keeping the seated pelvis supported instead of floating upward.
   if(!seatedDraft)p[P.HIPS+1]+=.025*amount;
   p[P.SPINE+2]+=.07*side*amount;
  }else{
   // A bridge drives off both feet; turning in adds more shoulder rotation.
   const lift=(button==='shoot'?.075:.045)*amount;
   if(seatedDraft&&button==='shoot'){
    // Bridge about the same upper-back support used by steady resistance.
    // Compose with the existing pelvis lift rather than translating the
    // shoulder plane upward when the player presses Bridge.
    const existing=.04*Math.max(0,Math.min(1,resistance));
    const supportLength=.38*scale;
    p[P.HIPS_Q+1]+=Math.asin((existing+lift)/supportLength)-Math.asin(existing/supportLength);
    p[P.HEAD]+=.35*lift/.04;
   }
   p[P.HIPS+1]+=lift;
   if(!(seatedDraft&&button==='shoot'))p[P.SPINE+2]+=(button==='fight'?.20:.10)*side*amount;
   p[P.HEAD+1]+=.045*side*amount;
   p[barElbow+2]+=.025*amount;
  }
 }
 // Carry the trapped wrist outside the rotating rib cage during the bridge.
 // The rider follows the same secured grip rather than holding it in space.
 if(seatedDraft&&!top&&!offense){
  const barHand=mirror?P.HAND_R:P.HAND_L;
  p[barHand]+=.025*side*amount;
  p[barHand+1]+=.015*amount;
  p[barElbow]+=.015*side*amount;
 }
 // Hand targets on the defender carry the secured grips with the struggle.
 // The rider follows via contacts instead of reaching toward a stationary arm.
 if(!top){
  const farHand=mirror?P.HAND_L:P.HAND_R;
  const farElbow=mirror?P.ELBOW_L:P.ELBOW_R;
  if(clip==='barHalfPin'&&!offense){
   // The cleared bar-side arm can now fight the half. Bring that hand
   // inward toward the neck/controlling arm while turning the shoulder;
   // the opposite arm remains threaded by the half, not a free-hand post.
   const freeHand=mirror?P.HAND_R:P.HAND_L;
   p[freeHand]-=.12*side*amount;
   p[freeHand+1]+=.08*amount;
   p[freeHand+2]+=.14*amount;
   p[barElbow]-=.055*side*amount;
   p[barElbow+2]+=.06*amount;
  }else if(clip==='wristBarPin'){
   // Tightening draws the captured wrist toward the torso. Fighting returns
   // it toward the shoulder while the elbow works beneath the chest.
   p[farHand+2]+=(offense?-.035:.045)*amount;
   p[farHand+1]+=(offense?-.015:.025)*amount;
   p[farElbow+2]+=(offense?-.018:.030)*amount;
  }else if(clip==='doubleBarPin'){
   // Both arms are controlled: show both elbows working, not a free-arm post.
   p[farElbow+2]+=(offense?-.018:.025)*amount;
   for(const hand of [P.HAND_L,P.HAND_R]){
    p[hand+2]+=(offense?-.018:.025)*amount;
    p[hand+1]+=(offense?-.010:.018)*amount;
   }
  }
 }
 return true;
}

/** Two staggered steps around the turn, with a supporting foot between them. */
export function applyArmBarTurnSteps(p:LocalPose,clip:string,u:number,mirror:boolean):void {
 const turn=/^(armBar|wristBar|barHalf|doubleBar)Turn$/.test(clip);
 const exit=/^(armBar|wristBar|barHalf|doubleBar)Exit$/.test(clip);
 if(/^(armBar|wristBar|barHalf|doubleBar)Resisted$/.test(clip)){
  // Establish the pressure base one foot at a time. When the defender
  // clears the bar, step back into the ride instead of skating both feet.
  const wrist=clip==='wristBarResisted';
  const first=wrist?.30:.18,land=wrist?.48:.35,release=wrist?.68:.55,recover=wrist?.84:.78;
  const paths=u<=release?([
   [false,0,first,[-.18,-.98],[-.22,-.65]],
   [true,first,land,[.55,-.92],[.62,-.50]],
  ] as const):([
   [true,release,recover,[.62,-.50],[.55,-.92]],
   [false,recover,1,[-.22,-.65],[-.18,-.98]],
  ] as const);
  for(const [left,from,to,start,end] of paths){
   const t=Math.max(0,Math.min(1,(u-from)/(to-from))),k=t*t*(3-2*t);
   const foot=left!==mirror?P.FOOT_L:P.FOOT_R;
   p[foot]=(start[0]+(end[0]-start[0])*k)*(mirror?-1:1);
   p[foot+1]=.025+.065*Math.sin(Math.PI*t)**2;
   p[foot+2]=start[1]+(end[1]-start[1])*k;
  }
  return;
 }
 if(!turn&&!exit)return;
 if(clip==='barHalfTurn'&&u>=.38){
  const t=Math.max(0,Math.min(1,(u-.56)/.34)),k=t*t*(3-2*t);
  const hand=mirror?P.HAND_R:P.HAND_L;
  p[hand]=(.22+(-.14-.22)*k)*(mirror?-1:1);
  p[hand+1]=.30+(.24-.30)*k;
  p[hand+2]=.35+(.29-.35)*k;
 }
 if(clip==='armBarTurn'&&u>=.28&&u<=1){
  // Walk the trailing foot toward the head, then kick it through during
  // the upward-facing finish. The opposite foot remains the pressure base.
  const paths=[
   [true,.28,.6,[.66,-.54],[.75,.4]],
   [false,.6,.78,[-.26,-.7],[.65,.35]],
   [false,.78,1,[.65,.35],[.65,-.45]],
  ] as const;
  for(const [left,from,to,start,end] of paths){
   if(!left&&from===.6&&u>.78)continue;
   if(!left&&from===.78&&u<.78)continue;
   const t=Math.max(0,Math.min(1,(u-from)/(to-from))),k=t*t*(3-2*t);
   const foot=left!==mirror?P.FOOT_L:P.FOOT_R;
   p[foot]=(start[0]+(end[0]-start[0])*k)*(mirror?-1:1);
   p[foot+1]=.025+.11*Math.sin(Math.PI*t)**2;
   p[foot+2]=start[1]+(end[1]-start[1])*k;
  }
  return;
 }
 const frontX=clip.startsWith('doubleBar')?DOUBLE_BAR_FRONT_SUPPORT_X:.75;
 if(turn&&u>=.28&&u<=1){
  // Drive around a planted support, then transfer weight before stepping the
  // trailing foot. The pose spline otherwise slides both feet during the turn.
  for(const [left,from,to,start,end] of [
   [true,.28,.6,[.66,-.54],[frontX,.4]],
   [false,.6,.78,[-.26,-.7],[.65,-.45]],
  ] as const){
   const t=Math.max(0,Math.min(1,(u-from)/(to-from))),k=t*t*(3-2*t);
   const foot=left!==mirror?P.FOOT_L:P.FOOT_R;
   p[foot]=(start[0]+(end[0]-start[0])*k)*(mirror?-1:1);
   p[foot+1]=.025;
   p[foot+2]=start[1]+(end[1]-start[1])*k;
  }
 }
 if(exit&&u>=0&&u<=1){
  // The pose spline can drift even between identical foot keys. Explicit
  // support paths keep the planted foot still while the other repositions.
  const paths=u<=.5?([
   [true,.25,.5,[frontX,.4],[.66,-.54]],
   [false,0,.25,[.65,-.45],[-.26,-.7]],
  ] as const):([
   [true,.75,1,[.66,-.54],[.55,-.92]],
   [false,.5,.75,[-.26,-.7],[-.18,-.98]],
  ] as const);
  for(const [left,from,to,start,end] of paths){
   const t=Math.max(0,Math.min(1,(u-from)/(to-from))),k=t*t*(3-2*t);
   const foot=left!==mirror?P.FOOT_L:P.FOOT_R;
   p[foot]=(start[0]+(end[0]-start[0])*k)*(mirror?-1:1);
   p[foot+1]=.025;
   p[foot+2]=start[1]+(end[1]-start[1])*k;
  }
 }
 const steps=turn?[[.28,.6,true],[.6,.78,false]] as const:[[0,.25,false],[.25,.5,true],[.5,.75,false],[.75,1,true]] as const;
 for(const [from,to,left] of steps){
  if(u<=from||u>=to)continue;
  const wave=Math.sin(Math.PI*(u-from)/(to-from))**2;
  const leg=left!==mirror;
  p[(leg?P.FOOT_L:P.FOOT_R)+1]+=.11*wave;
  p[(leg?P.KNEE_L:P.KNEE_R)+1]+=.07*wave;
 }
}
