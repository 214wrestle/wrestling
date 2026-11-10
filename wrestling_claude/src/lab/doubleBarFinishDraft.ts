import '../anim/library';
import {DOUBLE_BAR_FRONT_SUPPORT_X} from '../anim/armBarEffort';
import {SkinnedMesh,Vector3,type Group} from 'three';
import {BONE_INDEX} from '../body/skeleton';
import {registerHold,registerMove,holdClip,moveClip,sampleMove,type MoveClip,type Contact} from '../anim/clips';
import {holdAt,BALL} from '../anim/library/kit';
import {compileSpec,createLocal,type PoseSpec} from '../anim/spec';
import {P} from '../anim/posture';

// Lab-only interpretation of the Esposito demonstration at 2:48.
// Not routed from match simulation: contact/support validation is unfinished.
const A:PoseSpec={base:holdAt('doubleBarPin','A',0),
 hips:[.6,.6,.3],rot:[-90,120,0],spine:[-5,0,0],head:[20,0,0],
 footL:[.9,BALL,.9,90,30],footR:[.95,BALL,-.4,90,30],
 kneeL:[.55,.3,.5],kneeR:[.55,.3,-.1],
 elbowL:[.3,.12,.6],elbowR:[.3,.12,.05]};
const B:PoseSpec={base:holdAt('doubleBarPin','B',0),rot:[0,90,0,170],head:[18,0,0]};
const contacts:Contact[]=(['L','R'] as const).map(hand=>({who:'A',hand,on:'chest',at:[0,.03,-.14],backClasp:true,
 elbowGuide:{on:'chest',at:[hand==='L'?.35:-.35,.03,-.45]}}));
// Separate support study: retain the existing grip/feet while bringing the
// defender's low shoulder surface above the mat. Not a gameplay replacement.
registerHold({id:'doubleBarSupportedPinDraft',
 A:[{base:holdAt('doubleBarPin','A',0),hips:[.01,.36,.02],footL:[.65,BALL,.4,-55,65],footR:[.57,BALL,-.45,-30,65]}, {base:holdAt('doubleBarPin','A',0),hips:[.01,.36,.02],footL:[.65,BALL,.4,-55,65],footR:[.57,BALL,-.45,-30,65]}],
 B:[{base:holdAt('doubleBarPin','B',0),hips:[0,.20,0]}, {base:holdAt('doubleBarPin','B',0),hips:[0,.20,0]}],
 contacts:contacts.map(c=>({...c,elbowGuide:{on:'chest',at:[c.hand==='L'?.26:-.26,.03,-.45]}})),
 struggle:{A:0,B:0},tempo:1});
// Open the hands before following the defender's roll. This deliberately
// keeps the supported starting body still through the first hand transfer.
const releaseStartA:PoseSpec={base:holdAt('doubleBarSupportedPinDraft','A',0)};
const releaseStartB:PoseSpec={base:holdAt('doubleBarSupportedPinDraft','B',0)};
const openHands:PoseSpec={...releaseStartA,handL:[-.25,.25,.45],elbowL:[-.35,.35,.4],handR:[-.3,.20,.2],elbowR:[-.45,.25,.25]};
const releaseDraft:MoveClip={id:'doubleBarSupportedReleaseDraft',A:[
 {t:0,pose:releaseStartA},{t:.2,stop:true,pose:openHands},
 {t:.5,pose:{...openHands,hips:[.16,.38,-.12],rot:[-12,72,0],footR:[-.26,BALL,-.7,0,65],kneeR:[-.12,.08,-.38],handL:[.15,.65,.30],elbowL:[.35,.55,.10],handR:[-.22,.30,.35],elbowR:[-.32,.28,.28]}},
 {t:.8,pose:{base:holdAt('flat','A',0),hips:[.24,.35,-.16],footL:[.66,BALL,-.54,0,65],kneeL:[.58,.08,-.14]}},
 {t:1,pose:{base:holdAt('flat','A',0)}}],B:[
 {t:0,pose:releaseStartB},{t:.25,stop:true,pose:releaseStartB},
 {t:.5,pose:{...releaseStartB,hips:[.03,.24,.02],rot:[0,90,0,105],kneeL:[-.25,.35,-.35],kneeR:[.25,.35,-.35],footL:[-.15,BALL,-.65,120,0],footR:[.2,BALL,-.65,150,0]}},
 {t:.75,pose:{base:holdAt('flat','B',0),hips:[.04,.25,.04],rot:[0,90,0,55],kneeL:[.3,.16,-.55],kneeR:[-.3,.16,-.55],handL:[.22,.06,.56],elbowL:[.35,.14,.42]}},
 {t:1,pose:{base:holdAt('flat','B',0)}}],
 footPlants:[{foot:'L',from:0,to:.58,at:[.65,BALL,.4]},{foot:'R',from:0,to:.2,at:[.57,BALL,-.45]},{foot:'R',from:.5,to:1,at:[-.26,BALL,-.7]}],
 contacts:contacts.map(c=>({...c,to:0,fade:.20,elbowGuide:{on:'chest',at:[c.hand==='L'?.26:-.26,.03,-.45]}}))};
const releaseLanding=releaseDraft.A.find(k=>k.t===.5)!;releaseLanding.stop=true;
releaseDraft.A.push({...releaseLanding,t:.58});releaseDraft.A.sort((a,b)=>a.t-b.t);
// Both bodies share the settling phase; otherwise the defender rotates
// underneath a stationary rider and defeats the new shoulder clearance.
releaseDraft.A.find(k=>k.t===.8)!.t=.88;
releaseDraft.B.find(k=>k.t===.75)!.t=.83;
const defenderLanding=releaseDraft.B.find(k=>k.t===.5)!;defenderLanding.stop=true;
releaseDraft.B.push({...defenderLanding,t:.58});releaseDraft.B.sort((a,b)=>a.t-b.t);
// Recover through a kneeling base before folding forward into the flat ride.
// Explicit spine/head angles avoid inheriting the inverted pin's upper body.
releaseDraft.A.push({t:.72,stop:true,pose:{base:holdAt('ride','A',0),
 hips:[.24,.42,-.22],rot:[-15,25,0],spine:[12,0,0],head:[10,0,0],look:0,
 footR:[-.26,BALL,-.7,0,65],kneeR:[-.12,.05,-.35],
 footL:[.66,BALL,-.54,0,65],kneeL:[.58,.05,-.14],
 handL:[.35,.55,.25],elbowL:[.55,.55,-.05],
 handR:[-.20,.52,.25],elbowR:[-.35,.5,.05]}});
releaseDraft.A.sort((a,b)=>a.t-b.t);
registerMove(releaseDraft);
export function registerHeadPostDraft(hipHeight=.6,scale=1,opponentScale=1){
 // Offset the head beyond the far shoulder while keeping the clasp within reach.
 // Both body scales matter: a tall rider on a smaller defender is the tightest case.
 const rootX=.525*scale-.28*opponentScale;
 const supported:PoseSpec={...A,hips:[rootX,hipHeight,.2],footL:[rootX+.3*scale,BALL,.2+.5*scale,-90,30],footR:[rootX+.35*scale,BALL,.2-.6*scale,-90,30]};
 registerHold({id:'doubleBarHeadPostDraft',A:[supported,supported],B:[B,B],contacts,struggle:{A:0,B:0},tempo:1});
 // Supported counterpart: make room for the back clasp and move the rider's
 // whole support base outward rather than stretching just the upper body.
 const clearX=rootX-.10;
 const clearA:PoseSpec={...supported,hips:[clearX,hipHeight,.2],footL:[clearX+.3*scale,BALL,.2+.5*scale,-90,30],footR:[clearX+.35*scale,BALL,.2-.6*scale,-90,30]};
 const clearB:PoseSpec={...B,hips:[0,.23,0]};
 registerHold({id:'doubleBarSupportedHeadPostDraft',A:[clearA,clearA],B:[clearB,clearB],contacts,struggle:{A:0,B:0},tempo:1});
 // Defensive attempt, not an automatic escape: feet drive a hip lift and
 // shoulder turn while the rider keeps the head/foot base and joined hands.
 const base=compileSpec(B,null);
 const bridge:PoseSpec={...B,hips:[base[P.HIPS],base[P.HIPS+1]+.04,base[P.HIPS+2]],rot:[0,90,0,155],spine:[-8,0,0]};
 registerHold({id:'doubleBarHeadPostBridgeDraft',A:[supported,supported],B:[B,bridge],contacts,struggle:{A:0,B:0},tempo:1});

 // Experimental approach: move the rear support first, then the forward foot,
 // before lowering the head post. Retain the joined palms throughout.
 const start:PoseSpec={base:holdAt('doubleBarPin','A',0)};
 const entry:MoveClip={id:'doubleBarHeadPostEntryDraft',footPlants:[
  {foot:'L',from:0,to:.34,at:[DOUBLE_BAR_FRONT_SUPPORT_X,BALL,.4]},
  {foot:'R',from:.34,to:1,at:[rootX+.35*scale,BALL,.2-.6*scale]},
  {foot:'L',from:.7,to:1,at:[rootX+.3*scale,BALL,.2+.5*scale]}],A:[
  {t:0,pose:start},
  {t:.18,pose:{...start,hips:[.05,.30,.04],footR:[rootX+.35*scale,.14,.2-.6*scale,-60,30]}},
  {t:.34,pose:{...start,hips:[rootX+.06,hipHeight-.03,.08],rot:[-55,98,0],footR:supported.footR}},
  {t:.52,pose:{...supported,hips:[rootX-.03,hipHeight-.02,.2],rot:[-75,110,0],footL:[rootX+.3*scale,.15,.2+.5*scale,-90,30]}},
  {t:.7,stop:true,pose:supported},
  {t:1,pose:supported}],B:[{t:0,pose:{base:holdAt('doubleBarPin','B',0)}},{t:.7,pose:B},{t:1,pose:B}],contacts:contacts.map(c=>({...c,elbowGuide:{on:'chest',at:c.elbowGuide!.at,
  path:[{t:0,at:[c.hand==='L'?.26:-.26,.03,-.45]},
   {t:.34,at:c.hand==='L'?[.08,.4,.03]:[.3,-.16,-.16]},
   {t:.56,at:c.hand==='L'?[.35,.03,-.45]:[.3,-.16,-.16]},
   {t:.78,at:c.elbowGuide!.at}]}}))};
 registerMove(entry);
 const supportedStart:PoseSpec={base:holdAt('doubleBarSupportedPinDraft','A',0)};
 const supportedEntry:MoveClip={id:'doubleBarSupportedEntryDraft',contacts:entry.contacts,footPlants:[
  {foot:'L',from:0,to:.34,at:[.65,BALL,.4]},
  {foot:'R',from:.34,to:1,at:[clearX+.35*scale,BALL,.2-.6*scale]},
  {foot:'L',from:.7,to:1,at:[clearX+.3*scale,BALL,.2+.5*scale]}],A:[
  {t:0,pose:supportedStart},
  {t:.18,pose:{...supportedStart,hips:[.04,.35,.04],footR:[clearX+.35*scale,.14,.2-.6*scale,-60,30]}},
  {t:.34,pose:{...supportedStart,hips:[clearX+.06,hipHeight-.005,.08],rot:[-55,98,0],footR:clearA.footR}},
  {t:.52,pose:{...clearA,hips:[clearX-.015,hipHeight-.01,.2],rot:[-75,110,0],footL:[clearX+.3*scale,.15,.2+.5*scale,-90,30]}},
  {t:.7,stop:true,pose:clearA},{t:1,pose:clearA}],B:[
  {t:0,pose:{base:holdAt('doubleBarSupportedPinDraft','B',0)}},
  {t:.7,pose:clearB},{t:1,pose:clearB}]};
 registerMove(supportedEntry);
 // Starting hypothesis for a retained-grip rebase; validate the springs and
 // contacts in this direction independently before attaching the release.
 for(const forward of [entry,supportedEntry]){
 const recoveryA=forward.A.slice().reverse().map(key=>({...key,t:1-key.t}));
 const landing=recoveryA.find(key=>Math.abs(key.t-.66)<.001)!;
 landing.stop=true;
 recoveryA.find(key=>Math.abs(key.t-.82)<.001)!.t=.87;
 recoveryA.push({...landing,t:.74,stop:true});recoveryA.sort((a,b)=>a.t-b.t);
 registerMove({...forward,id:forward===entry?'doubleBarHeadPostRecoverDraft':'doubleBarSupportedRecoverDraft',
  A:recoveryA,
  B:forward.B.slice().reverse().map(key=>({...key,t:1-key.t})),
  footPlants:forward.footPlants?.map(p=>({...p,from:1-p.to,to:p.foot==='R'?.74:1-p.from})),
  contacts:forward.contacts?.map(c=>({...c,elbowGuide:c.elbowGuide?{...c.elbowGuide,
   path:c.elbowGuide.path?.slice().reverse().map(key=>({...key,t:1-key.t}))}:undefined}))});
 }

}
/** Actual skinned head surface, excluding neck-blended vertices and headgear. */
export function headSurfaceMinimum(root:Group):number{
 root.updateMatrixWorld(true);let minimum=Infinity;
 root.traverse(object=>{
  if(!(object instanceof SkinnedMesh))return;
  const index=object.geometry.getAttribute('skinIndex'),weight=object.geometry.getAttribute('skinWeight');
  if(!index||!weight)return;
  object.skeleton.update();
  for(let i=0;i<index.count;i++){
   let headWeight=0;
   for(let j=0;j<4;j++)if(index.getComponent(i,j)===BONE_INDEX.head)headWeight+=weight.getComponent(i,j);
   if(headWeight<.99)continue;
   minimum=Math.min(minimum,object.getVertexPosition(i,new Vector3()).applyMatrix4(object.matrixWorld).y);
  }
 });
 if(!Number.isFinite(minimum))throw Error('Head-post review requires skinned head vertices');
 return minimum;
}
registerHeadPostDraft();

// Owner correction: the finishing hip is seated beside the defender, not
// suspended above him. Separate drafts preserve the previous experiments.
export function registerSeatedBarDrafts(topScale=1,bottomScale=1){
 // Isolated flat-ride grounding study; production flat remains unchanged.
 const flat=holdClip('flat')!;
 registerHold({...flat,id:'flatGroundedDraft',
  contacts:flat.contacts!.map(c=>c.hand==='L'?{...c,palm:true,at:[0,-.20,.04]}:{...c,palm:true}),
  A:([0,1] as const).map(progress=>{const base=holdAt('flat','A',progress);base[P.FOOT_L+1]=base[P.FOOT_R+1]=.035*topScale;return {base};}) as [PoseSpec,PoseSpec],
  B:([0,1] as const).map(progress=>{const base=holdAt('flat','B',progress);base[P.HIPS+1]+=Math.max(0,bottomScale-1)*.24;return {base,palms:[1,1],
   handL:[.18,.065,.64],handR:[-.18,.065,.64],
   footL:[.13,.04,-.98,0,80],footR:[-.13,.04,-.98,0,80],toes:[1,1],
   elbowL:[.55,.35,.75],elbowR:[-.55,.35,.75]};}) as [PoseSpec,PoseSpec]});
// Lab-only following-pressure study: follow the defender's pelvis and back
// orientation as he builds his base; retain grounded feet and both grip anchors.
 const grounded=holdClip('flatGroundedDraft')!;
 registerHold({...grounded,id:'flatPressureDraft',
  contacts:grounded.contacts!.map(c=>c.hand==='R'?{...c,at:[-.18,.02,0]}:c),
  A:([0,1] as const).map(progress=>{
  const base=holdAt('flatGroundedDraft','A',progress);
  const bottom=holdAt('flatGroundedDraft','B',progress);
  base[P.HIPS]=bottom[P.HIPS]+.10;
  // Both torso thicknesses contribute to back/chest spacing.
  base[P.HIPS+1]=bottom[P.HIPS+1]+.11*(topScale+bottomScale)+.02;
  base[P.HIPS+2]=bottom[P.HIPS+2]-.08+.15*(bottomScale-topScale);
  for(let axis=0;axis<4;axis++)base[P.HIPS_Q+axis]=bottom[P.HIPS_Q+axis];
  for(let axis=0;axis<3;axis++)base[P.SPINE+axis]=bottom[P.SPINE+axis];
  // Keep chest pressure while supporting hips above the defender's pelvis.
  // Scale the extra rotation so larger torsos do not travel farther into the back.
  base[P.SPINE]+=(8+4*progress/topScale)*Math.PI/180;
  return {base};
 }) as [PoseSpec,PoseSpec]});
for(const bar of ['armBar','wristBar','barHalf','doubleBar']){
 const barBall=bar==='armBar'?.04:BALL;
 const seated:PoseSpec={base:holdAt(bar+'Pin','A',0),
  hips:[.34,.12*topScale+.01,-.20],rot:[0,65,0,180],spine:[-12,0,0],head:[12,0,0],look:0,
  footL:[.82,barBall,.08,20,0],footR:[.72,barBall,-.62,0,0],
  kneeL:[.76,.3,.22],kneeR:[.70,.25,-.3]};
 // The single-bar free hand posts beside the seated hip; only the bar arm stays gripped.
 if(bar==='armBar'){seated.elbowL=[.27,.42,.50];seated.handR=[.72,.065,.32];seated.elbowR=[.72,.28,.50];seated.palms=[0,1];seated.hips=[.46,.12*topScale+.01,-.20];}
 if(bar==='barHalf'||bar==='doubleBar'){seated.hips=[.46,.12*topScale,.10];seated.rot=[-60,45,0,180];}
 if(bar==='doubleBar')seated.hips=[.46,.12*topScale,-.05];
 const defender:PoseSpec=bar==='wristBar'
  ?{base:holdAt('armBarPin','B',0),handR:[.18,.24,.25],elbowR:[-.20,.30,.40]}
  :bar==='barHalf'?{base:holdAt('armBarPin','B',0),head:[-12,-18,0]}
  :bar==='doubleBar'?{base:holdAt('doubleBarPin','B',0),hips:[0,.20,0]}
  :{base:holdAt(bar+'Pin','B',0)};
 defender.hips=[0,.20,0];
 if(bar==='armBar'){defender.handR=[-.45,.32,.55];defender.elbowR=[-.55,.65,.35];}
 if(bar==='armBar'||bar==='wristBar'||bar==='barHalf'){defender.handL=[.20,.22,.24];defender.elbowL=[.40,.18,.43];}
 if(bar==='armBar'){defender.wristL=[-25,0,60];defender.handL=[.24,.25,.28];defender.elbowL=[.50,.28,.50];
  defender.footL=[-.22,.04,-.42,160,0];defender.footR=[.24,.04,-.38,200,0];}
 const seatedContacts=bar==='barHalf'?holdClip('barHalfPin')!.contacts!.map(c=>c.hand==='L'
  ?holdClip('armBarPin')!.contacts!.find(c=>c.hand==='L')!
  :{...c,elbowGuide:{on:'neck' as const,at:[.28,-.08,-.05] as [number,number,number]}}):holdClip(bar+'Pin')!.contacts;
 registerHold({id:bar+'SeatedFinishDraft',A:[seated,seated],
  B:[defender,defender],
  contacts:bar==='armBar'?seatedContacts!.filter(c=>c.hand==='L').map(c=>({...c,at:[0,-.08,.04] as [number,number,number],palm:true})):seatedContacts,struggle:{A:0,B:0},tempo:1});
 if(bar==='armBar'){
  // Keep the seated endpoint when the defender clears the bar or the fall ends.
  // Separate lab paths: inherited recovery intermediates still need motion/contact review.
  const seatedHold=holdClip('armBarSeatedFinishDraft')!;
  // The supported recovery gathers the defender's leg from its own source pose.
  // Preserve the earlier seated finish and its entry/fall studies unchanged.
  const supportedDefender:PoseSpec={...defender,footR:[.12,.04,-.48,200,0]};
  registerHold({...seatedHold,id:'armBarSupportedSeatedFinishDraft',B:[supportedDefender,supportedDefender]});
  const exit=moveClip('armBarExit')!;
  registerMove({...exit,id:'armBarSeatedExitDraft',
   A:exit.A.map((key,i)=>i===0?{...key,pose:seated}:key),
   B:exit.B.map((key,i)=>i===0?{...key,pose:defender}:key),
   contacts:[...seatedHold.contacts!.map(c=>({...c,from:0,to:.25,fade:.15})),
    // Re-establish wrist control, then the waist as the defender rolls prone.
    // Acquire during recovery so the flat hold inherits an established grip.
    ...holdClip('flat')!.contacts!.map(c=>({...c,from:c.hand==='L'?.70:.78,to:1,fade:.25}))]});
  // Isolated recovery into the supported ride; keep the original exit intact.
  registerMove({...exit,id:'armBarPressureSeatedExitDraft',
   A:exit.A.map((key,i)=>i===0?{...key,pose:seated}:key.t===.25?{...key,stop:true,pose:{...key.pose,hips:[.34,.36,-.14],footL:seated.footL,kneeL:seated.kneeL,footR:[-.26,.04,-.7,0,65],handR:[.72,.065,.32],elbowR:[.72,.28,.50],palms:[0,1]}}:key.t===1?{...key,pose:{base:holdAt('flatPressureDraft','A',0)}}:key.t===.75?{...key,pose:{base:holdAt('flatPressureDraft','A',0),footL:[.66,barBall,-.54,0,65],kneeL:[.58,.08,-.14],handL:[.22,.13,.57],elbowL:[.45,.34,.43]}}:key.t===.5?{...key,pose:{...key.pose,footL:[.66,.04,-.54,0,65],footR:[-.26,.04,-.7,0,65],handL:[.40,.18,.50],elbowL:[.58,.36,.43],handR:[-.30,.68,.05],elbowR:[-.48,.75,.25]}}:key),
   B:exit.B.map((key,i)=>i===0?{...key,pose:defender}:key.t===.3?{...key,pose:{...key.pose,footL:[-.15,.05,-.65,120,0],footR:[.2,.05,-.65,150,0],toes:[1,1],handR:[-.28,.20,.55],elbowR:[-.55,.50,.65],handL:[.32,.22,.36],elbowL:[.52,.34,.52],palms:[0,1]}}:key.t===.6?{...key,pose:{...key.pose,footL:[.13,.04,-.98,0,80],footR:[-.13,.04,-.98,0,80],toes:[1,1],handR:[-.18,.065,.64],elbowR:[-.55,.35,.75],palms:[0,1]}}:key.t===1?{...key,pose:{base:holdAt('flatPressureDraft','B',0)}}:key),
   contacts:[...seatedHold.contacts!.map(c=>({...c,from:0,to:.25,fade:.15})),
    ...holdClip('flatPressureDraft')!.contacts!.map(c=>({...c,from:c.hand==='L'?.70:.78,to:1,fade:.25}))]});
  // Preserve the earlier shoulder-route study as a separate baseline.
  const baselineRecovery=moveClip('armBarPressureSeatedExitDraft')!;
  const baselineShoulder=createLocal();sampleMove(baselineRecovery.id,'A',.375,false,baselineShoulder);
  const baselineWithShoulder:MoveClip={...baselineRecovery,A:[...baselineRecovery.A,
   {t:.375,pose:{base:baselineShoulder,footL:[.80,.16,-.20,0,25],kneeL:[.85,.25,-.10],handR:[.55,.65,.45],elbowR:[.75,.50,.55],palms:[0,0]} as PoseSpec}
  ].sort((a,b)=>a.t-b.t)};
  // Recover a supported kneeling base before folding onto the prone defender.
  // Keep the release/limb targets, but stop driving the chest through his roll.
  const kneelingRecovery=moveClip('armBarPressureSeatedExitDraft')!;
  const kneelingKey=kneelingRecovery.A.find(key=>key.t===.5)!;
  const kneelingPose:PoseSpec={...kneelingKey.pose,hips:[.34,.40,-.12],rot:[-15,45,0],spine:[8,0,0],head:[10,0,0],handL:[.18,.35,.10],elbowL:[.45,.48,.15],handR:[-.30,.65,.55],elbowR:[-.50,.60,.60]};
  registerMove({...kneelingRecovery,A:[
   ...kneelingRecovery.A.map(key=>key.t===.5?{...key,stop:true,pose:kneelingPose}:key.t===.75?{...key,t:.88}:key),
   {t:.68,stop:true,pose:kneelingPose},
   // Carry the released hand outside the ribs before reaching down to the wrist.
   {t:.78,pose:{...kneelingPose,handL:[.46,.40,.48],elbowL:[.66,.50,.30]} as PoseSpec}
  ].sort((a,b)=>a.t-b.t)});
  const waistTransfer=moveClip('armBarPressureSeatedExitDraft')!;
  registerMove({...waistTransfer,contacts:[
   ...seatedHold.contacts!.map(c=>({...c,from:0,to:.25,fade:.15})),
   {who:'A',hand:'L',on:'hips',at:[.18,.02,0],palm:true,from:.55,to:.65,fade:.10},
   ...holdClip('flatPressureDraft')!.contacts!.map(c=>({...c,from:c.hand==='L'?.92:.95,to:1,fade:.20}))
  ]});
  // Lift the free arm around the shoulder rather than sweeping across the chest.
  const pressureRecovery=moveClip('armBarPressureSeatedExitDraft')!;
  const shoulderRoute=createLocal();
  sampleMove(pressureRecovery.id,'A',.375,false,shoulderRoute);
  registerMove({...pressureRecovery,A:[...pressureRecovery.A,
   {t:.375,pose:{base:shoulderRoute,footL:[.80,.16,-.20,0,25],kneeL:[.85,.25,-.10],handR:[.55,.65,.45],elbowR:[.75,.50,.55],palms:[0,0]} as PoseSpec}].sort((a,b)=>a.t-b.t)});
  // Gather the bent leg clear of the seated rider before rolling to base.
  const lateralRise=moveClip('armBarPressureSeatedExitDraft')!;
  registerMove({...lateralRise,B:lateralRise.B.map((key,i)=>i===0?{...key,pose:supportedDefender}:key),A:lateralRise.A.map(key=>key.t===.25?{...key,pose:{...key.pose,hips:[.55,.36,-.14],spine:[-18,0,22]} as PoseSpec}:key)});
  const legRecovery=moveClip('armBarPressureSeatedExitDraft')!;
  const gatheredLeg=createLocal();sampleMove(legRecovery.id,'B',.15,false,gatheredLeg);
  registerMove({...legRecovery,B:[...legRecovery.B,
   {t:.15,pose:{base:gatheredLeg,footR:[.18,.04,-.52,170,0]} as PoseSpec}
  ].sort((a,b)=>a.t-b.t)});
  // Reach toward the wrist before declaring the new control fully engaged.
  const wristApproach=moveClip('armBarPressureSeatedExitDraft')!;
  const wristApproachPose=createLocal();sampleMove(wristApproach.id,'A',.84,false,wristApproachPose);
  registerMove({...wristApproach,A:[...wristApproach.A.map(key=>key.t===.88?{...key,pose:{...key.pose,handL:[.27,.15,.63]} as PoseSpec}:key),
   {t:.84,pose:{base:wristApproachPose,handL:[.27,.15,.63],elbowL:[.48,.34,.43]} as PoseSpec}
  ].sort((a,b)=>a.t-b.t)});
  // Keep the supported recovery opt-in until its full contact audit passes.
  registerMove({...moveClip('armBarPressureSeatedExitDraft')!,id:'armBarSupportedSeatedExitDraft'});
  registerMove(baselineWithShoulder);
  registerMove({id:'armBarSeatedFallDraft',
   A:[{t:0,pose:seated},{t:1,stop:true,pose:seated}],
   B:[{t:0,pose:defender},{t:1,stop:true,pose:defender}],contacts:seatedHold.contacts});
  const source=moveClip('armBarTurn')!;
  const groundedTop:PoseSpec={base:holdAt('flat','A',0),hips:[.13,.345,-.14],
   footL:[.50,barBall,-.72,-20,80],footR:[-.18,barBall,-.78,15,80],
   kneeL:[.60,.15,-.30],kneeR:[-.25,.15,-.30]};
  const groundedBottom:PoseSpec={base:holdAt('flat','B',0),
   footL:[.13,.075,-.98,0,150],footR:[-.13,.075,-.98,0,150],
   kneeL:[.14,.25,-.40],kneeR:[-.14,.25,-.40],
   handL:[.16,.08,.66],handR:[-.16,.08,.66],
   elbowL:[.50,.60,.45],elbowR:[-.50,.60,.45]};
  registerHold({id:'armBarFlatDraft',A:[groundedTop,groundedTop],
   B:[groundedBottom,groundedBottom],contacts:holdClip('flat')!.contacts!.map(c=>({...c,palm:true,...(c.hand==='L'?{at:[0,-.2,.04] as [number,number,number]}:{})})),struggle:{A:0,B:0},tempo:1});
  const gatheredBottom:PoseSpec={...source.B.find(k=>k.t===.28)!.pose,
   footL:groundedBottom.footL,footR:groundedBottom.footR,
   kneeL:groundedBottom.kneeL,kneeR:groundedBottom.kneeR,
   handR:[-.22,.10,.62],elbowR:[-.50,.85,.38]};
  const stepBase=createLocal();
  sampleMove('armBarTurn','A',.14,false,stepBase);
  const gathered:PoseSpec={...source.A.find(k=>k.t===.28)!.pose,hips:[.38,.38,-.20],
   footL:[.66,barBall,-.54,0,65],kneeL:[.68,.32,-.32],
   footR:[.05,barBall,-.45,-10,65],kneeR:[.18,.40,-.22]};
  const trapped:PoseSpec={...source.B.find(k=>k.t===.44)!.pose,hips:[0,.14,.04],
   handR:gatheredBottom.handR,elbowR:gatheredBottom.elbowR,footL:groundedBottom.footL,footR:groundedBottom.footR,
   kneeL:groundedBottom.kneeL,kneeR:groundedBottom.kneeR};
  // Stieber Part4 1:35–2:00: backward steps circle the head before
  // the defender rolls. Keep the bar; the waist hand clears for the circle.
  const circle:PoseSpec={...gathered,hips:[.48,.39,.26],rot:[-55,72,0],
   footL:[.85,barBall,.04,-45,65],footR:[.30,.14,-.30,-25,45],
   kneeL:[.72,.40,.28],kneeR:[.42,.45,-.10],
   handR:[.20,.38,.45],elbowR:[.10,.60,.50]};
  registerMove({...source,id:'armBarSeatedTurnDraft',
   A:[{t:0,pose:groundedTop},
    {t:.14,hipsVelocity:[(.28-.13)/.28,(.38-.345)/.28,(-.12+.14)/.28],pose:{base:stepBase,footL:[.50,barBall,-.72,-20,80],footR:[.05,barBall,-.45,-10,65],kneeL:[.60,.15,-.30],kneeR:[.18,.70,-.22]}},
    {t:.28,pose:gathered},
    {t:.44,pose:{...gathered,hips:[.40,.39,.04],rot:[-30,72,0],
     footL:circle.footL,kneeL:circle.kneeL,
     handR:[-.20,.70,.50],elbowR:[-.30,.75,.30]}},
    {t:.58,pose:{...circle,elbowL:[.45,.31,.53],handR:[-.25,.35,.65],elbowR:[-.30,.50,.60],palms:[0,0]}},
    {t:.72,pose:{...circle,elbowL:[.36,.37,.63],hips:[.55,.40,.40],rot:[-85,55,0],
     footR:[.66,barBall,.12,-65,65],kneeR:[.68,.22,.36],
     handR:[0,.30,.65],elbowR:[-.20,.55,.65],palms:[0,0]}},
    {t:.86,pose:{...seated,elbowL:[.26,.44,.50],hips:[.56,.22,-.12],rot:[-15,65,0,140],
     kneeL:[.76,.55,.22],kneeR:[.70,.55,-.3],
     handR:[.60,.065,.36],elbowR:[.72,.28,.50],palms:[0,1]}},
    {t:.94,stop:true,pose:seated},{t:1,stop:true,pose:seated}],
   B:[{t:0,pose:groundedBottom},
    {t:.14,pose:{...groundedBottom,handL:[.25,.20,.48],elbowL:[.60,.60,.45]}},
    {t:.28,pose:gatheredBottom},
    {t:.44,pose:trapped},{t:.58,pose:trapped},
    {t:.72,pose:{...source.B.find(k=>k.t===.6)!.pose,handL:[.22,.33,.32],elbowL:[.40,.30,.48],handR:[-.48,.28,.58],elbowR:[-.55,.70,.38],
     footL:[.13,.12,-.98,0,150],footR:[-.13,.12,-.98,0,150],
     kneeL:[.30,.40,-.55],kneeR:[-.30,.40,-.55]}},
    {t:.86,pose:{...defender,elbowL:[.40,.18,.43],hips:[0,.23,0],rot:[0,90,0,140],
     footL:[-.22,.12,-.42,160,0],footR:[.24,.12,-.38,200,0]}},
    {t:.94,stop:true,pose:defender},{t:1,land:true,pose:defender}],
   elbowOffsets:[{who:'B',hand:'L',from:.84,peak:.89,to:.96,offset:[.10,.10,.07]}],
   wristTurns:[{who:'B',hand:'L',from:.14,peak:.27,to:.44,angles:[-20,0,20]},{who:'B',hand:'L',from:.38,peak:.49,to:.70,angles:[0,0,-20]}],
   wristPaths:[{who:'B',hand:'L',keys:[{"t":0.7045454545454546,"rotation":[-0.5590834803937301,-0.5185856587041819,0.4862809879303144,0.4266443217888888]},{"t":0.7121212121212122,"rotation":[-0.5457619869900748,-0.5618209750004093,0.447164458973007,0.43190854615023866]},{"t":0.7196969696969697,"rotation":[-0.5099146601883,-0.5810742361889698,0.42987445049786227,0.46642011981862136]},{"t":0.7272727272727273,"rotation":[-0.4692181390978467,-0.5973391519250844,0.4090676784398982,0.505651965263428]},{"t":0.7348484848484849,"rotation":[-0.4395114751508682,-0.6354543782595214,0.36100225982909406,0.5222114176842556]},{"t":0.7424242424242424,"rotation":[-0.41666215283009095,-0.6323791606343211,0.34482748982277106,0.554601884108729]},{"t":0.75,"rotation":[-0.39114851861218747,-0.6291791106630326,0.31728852646744854,0.592000400392501]},{"t":0.7575757575757576,"rotation":[-0.3433280792221256,-0.6005093517470608,0.2992268446939266,0.6572500619220112]},{"t":0.7651515151515151,"rotation":[-0.31665484730982985,-0.5513400256901881,0.3048808875635738,0.7090849935977905]},{"t":0.7727272727272727,"rotation":[-0.28376628562852,-0.4945385009854625,0.31297478263611267,0.7595756391680312]},{"t":0.7803030303030303,"rotation":[-0.27590379675945115,-0.4414740353289831,0.31389051946145413,0.7940091390256675]},{"t":0.7878787878787878,"rotation":[-0.2606280517999776,-0.36725912167836444,0.3348856393530596,0.8276746732346454]},{"t":0.7954545454545454,"rotation":[-0.25856992894272696,-0.30033393248204227,0.321870234834409,0.8598492151383681]},{"t":0.803030303030303,"rotation":[-0.25692541583841805,-0.22385751078938024,0.31571666612359967,0.8855507508275504]},{"t":0.8106060606060606,"rotation":[-0.26120886213432704,-0.1456980870530004,0.30684441790868083,0.9035421965629882]},{"t":0.8181818181818182,"rotation":[-0.274651225650858,-0.0684086033674444,0.2942693497233086,0.9128485729009046]},{"t":0.8257575757575758,"rotation":[-0.2574046613120602,0.019317520107014187,0.2803236538831281,0.9245476314529992]},{"t":0.8333333333333334,"rotation":[-0.24837084177937835,0.10280785571181536,0.2619963725040136,0.926876674942508]},{"t":0.8409090909090909,"rotation":[-0.24645105966438724,0.18071190885352084,0.2422979187750448,0.9208131187956105]},{"t":0.8484848484848485,"rotation":[-0.21035084834067053,0.26131642530367344,0.21218932942561025,0.9178463569393189]},{"t":0.8560606060606061,"rotation":[-0.17948609734742,0.33194254675605345,0.17837476805404015,0.9087251116997731]},{"t":0.8636363636363636,"rotation":[-0.15268924078353505,0.3919089379141234,0.14282419825828863,0.8959322678215403]}]}],
   contacts:source.contacts!.map(c=>({...c,...(c.hand==='L'?{from:0,fade:.05,atPath:[{t:0,at:[0,-.20,.04] as [number,number,number]},{t:.28,at:[0,-.10,.04] as [number,number,number]},{t:.58,at:[0,-.08,.04] as [number,number,number]},{t:.78,at:[0,-.08,.04] as [number,number,number]},{t:.89,at:[0,-.06,.04] as [number,number,number]},{t:.94,at:[0,-.08,.04] as [number,number,number]}]}:{}),palm:true})).flatMap(c=>c.hand==='L'?[c]:[
    {...c,from:0,to:.42,fade:.10}]),
   // Alternate support: settle the right foot before lifting the left
   // through the head circle, rather than dragging both along the mat.
   footSwings:[{foot:'R',from:0,to:.14,height:.08},
    {foot:'L',from:.14,to:.44,height:.12},{foot:'R',from:.72,to:.90,height:.13}],
   footPlants:[{foot:'L',from:0,to:.14,at:[.50,barBall,-.72]},
    {foot:'R',from:.14,to:.44,at:[.05,barBall,-.45]},
    {foot:'L',from:.44,to:.72,at:[.85,barBall,.04]}]
  });
 }

 if(bar==='wristBar'){
  // Owner-directed seated wrist finish, pending clarification: Stieber Part2
  // demonstrates a chest-to-chest finish, not this sit-out. Preserve separately.
  const single=moveClip('armBarSeatedTurnDraft')!;
  const wristBottom=(t:number):Pick<PoseSpec,'handR'|'elbowR'>=>t<.28
   ?{handR:[-.16,.08,.66],elbowR:[-.50,.60,.45]}
   :t<=.58?{handR:[.16,.25,.52],elbowR:[-.50,.65,.65]}
   :t<.86?{handR:[.20,.40,.58],elbowR:[-.30,.60,.60]}
   :{handR:[.12,.42,.42],elbowR:[-.45,.65,.40]};
  const finishA:PoseSpec={base:holdAt('armBarSeatedFinishDraft','A',0),elbowL:[.44,.25,.46],hips:[.34,.12*topScale+.01,-.20],palms:[0,0],handR:[.12,.42,.44],elbowR:[.24,.54,.58]};
  const finishB:PoseSpec={base:holdAt('armBarSeatedFinishDraft','B',0),wristL:[0,0,0],elbowL:[.40,.18,.43],...wristBottom(1)};
  const wristContact:Contact={who:'A',hand:'R',on:'handR',at:[0,0,.025],palm:true};
  registerHold({id:'wristBarSeatedFinishDraft',A:[finishA,finishA],B:[finishB,finishB],
   contacts:[...holdClip('armBarSeatedFinishDraft')!.contacts!.filter(c=>c.hand==='L'),wristContact],
   struggle:{A:0,B:0},tempo:1});
  registerMove({...single,id:'wristBarSeatedTurnDraft',elbowOffsets:undefined,wristTurns:undefined,wristPaths:undefined,
   A:single.A.map(k=>({...k,pose:k.t===0?k.pose:k.t>=.94?finishA:{...k.pose,palms:[0,0],
    ...(k.t>=.58?{elbowL:(k.t>=.86?[.44,.25,.46]:[.42,.30,.42]) as [number,number,number]}:{}),
    ...(k.t===.86?{hips:[.42,.22,-.12] as [number,number,number],palms:[0,0] as [number,number]}:{}),
    handR:k.t<.28?[.10,.65,.55]:k.t<=.58?[.16,.27,.55]:k.t<.86?[.20,.40,.60]:[.12,.42,.44],
    ...(k.t>=.14&&k.t<.72?{elbowR:[-.15,.65,.65] as [number,number,number]}:{}),
    ...(k.t>=.72?{elbowR:[.24,.54,.58] as [number,number,number]}:{})}})),
   // Roll over the shoulder surface, then settle back to the authored hold.
   // The foot anchors stay on their existing support path.
   B:single.B.map(k=>({...k,pose:k.t>=.94?finishB:{...k.pose,...wristBottom(k.t),...(k.t>=.86?{wristL:[0,0,0] as [number,number,number]}:{}),
    ...(k.t===.72?{handL:[.13,.29,.26] as [number,number,number],elbowL:[.34,.20,.40] as [number,number,number]}:{}),
    ...(k.t===.72||k.t===.86?{hips:[k.pose.hips![0],k.pose.hips![1]+.025,k.pose.hips![2]] as [number,number,number]}:{})}})),
   contacts:[...single.contacts!.filter(c=>c.hand==='L').map(c=>({...c,atPath:undefined,from:.28,fade:.18,at:[0,-.10,.04] as [number,number,number]})),
    {...single.contacts!.find(c=>c.hand==='R')!,from:0,to:.10,fade:.05},
    {...wristContact,from:.28,to:1,fade:.16}]
  });
 }

}
}
registerSeatedBarDrafts();
