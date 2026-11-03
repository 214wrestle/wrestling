// Seated armbar: elbow hook and opposite wrist, head-circle turn, hip finish and release.
// Internal clip names retain their study suffix for existing diagnostic compatibility.
import './library';
import {Vector3,Quaternion,Euler} from 'three';
import {registerHold,registerMove,holdClip,moveClip,sampleMove,type MoveClip,type Contact} from './clips';
import {holdAt,BALL} from './library/kit';
import {compileSpec,createLocal,type PoseSpec} from './spec';
import {P} from './posture';
export function registerSeatedBarDrafts(topScale=1,bottomScale=1){
 // Shared grounded setup for the seated chain.
 const flat=holdClip('flat')!;
 registerHold({...flat,id:'flatGroundedDraft',
  contacts:flat.contacts!.map(c=>c.hand==='L'?{...c,palm:true,at:[0,-.20,.04]}:{...c,palm:true}),
  A:([0,1] as const).map(progress=>{const base=holdAt('flat','A',progress);base[P.FOOT_L+1]=base[P.FOOT_R+1]=.035*topScale;return {base};}) as [PoseSpec,PoseSpec],
  B:([0,1] as const).map(progress=>{const base=holdAt('flat','B',progress);base[P.HIPS+1]+=Math.max(0,bottomScale-1)*.24;return {base,palms:[1,1],
   handL:[.18,.065,.64],handR:[-.18,.065,.64],
   footL:[.13,.04,-.98,0,80],footR:[-.13,.04,-.98,0,80],toes:[1,1],
   elbowL:[.55,.35,.75],elbowR:[-.55,.35,.75]};}) as [PoseSpec,PoseSpec]});
// Follow the defender's pelvis and back
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
  // Keep the torso parallel to the defender during settling; weight comes from the supported pelvis placement.
  // Extra forward spinal flexion previously drove the chest through the back.
  // Fit grounded feet to this rider's actual leg length. Paired pose targets
  // share metres, whereas bone lengths scale with the athlete.
  const pelvis=new Vector3().fromArray(base,P.HIPS),q=new Quaternion().fromArray(base,P.HIPS_Q);
  const span=(.435+Math.hypot(.415,.01))*topScale*.98;
  for(const [at,sign] of [[P.FOOT_L,1],[P.FOOT_R,-1]] as const){
   const hip=new Vector3(.09*sign,-.04,0).multiplyScalar(topScale).applyQuaternion(q).add(pelvis);
   const footQ=new Quaternion().setFromEuler(new Euler(base[at+4],base[at+3],base[at+5],'YXZ'));
   const toeOffset=new Vector3(0,-.05,.135).multiplyScalar(topScale).applyQuaternion(footQ);
   const ankle=new Vector3().fromArray(base,at).sub(toeOffset);
   const dx=ankle.x-hip.x,dz=ankle.z-hip.z,dy=ankle.y-hip.y;
   const available=Math.sqrt(Math.max(0,span*span-dy*dy)),distance=Math.hypot(dx,dz);
   if(distance>available && distance>1e-6){
    base[at]=hip.x+dx*available/distance+toeOffset.x;
    base[at+2]=hip.z+dz*available/distance+toeOffset.z;
   }
  }
  return {base};
 }) as [PoseSpec,PoseSpec]});
for(const bar of ['armBar']){
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
  const supportedDefender:PoseSpec={...defender,hips:[0,.12*bottomScale,0],rot:[0,90,0,180],spine:[0,0,0],head:[0,0,0],look:0,handL:[-.28,.103,.292],elbowL:[-.412,.08,.407],wristL:[-25,40,60],handR:[.45,.32,.55],elbowR:[.55,.65,.35],footR:[.12,.04,-.48,200,0]};
  const pressureBase=compileSpec(seated,null);
  for(const at of [P.HIPS,P.FOOT_L,P.FOOT_R,P.KNEE_L,P.KNEE_R,P.HAND_L,P.HAND_R,P.ELBOW_L,P.ELBOW_R]){
   pressureBase[at]*=-1; pressureBase[at+2]=.55-pressureBase[at+2];
  }
  pressureBase[P.HIPS_Q]=180*Math.PI/180;
  pressureBase[P.FOOT_L+3]+=Math.PI;pressureBase[P.FOOT_R+3]+=Math.PI;
  pressureBase[P.HIPS_Q+1]=75*Math.PI/180;
  // Owner correction: right hip bears weight, left hip stays elevated.
  pressureBase[P.HIPS_Q+3]=120*Math.PI/180;
  pressureBase[P.HIPS+1]=.14*topScale;
  pressureBase[P.HIPS]-=.08;pressureBase[P.HIPS+1]+=.02;pressureBase[P.HIPS+2]+=.035;pressureBase[P.HIPS_Q]=200*Math.PI/180;
 pressureBase[P.HIPS]+=Math.max(.02,.11-(topScale-.9)*.4);pressureBase[P.HIPS+2]+=.015;
 const pressureSeat:PoseSpec={base:pressureBase,spine:[-12,0,0],kneeR:[-.63,.12,.94],kneeL:[-.72,.38,.48]};
  registerHold({...seatedHold,id:'armBarSupportedSeatedFinishDraft',A:[pressureSeat,pressureSeat],B:[supportedDefender,supportedDefender]});
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
  const kneelingPose:PoseSpec={...kneelingKey.pose,hips:[.34,.36,-.12],rot:[-30,45,0],spine:[12,0,0],head:[10,0,0],handL:[.18,.35,.10],elbowL:[.45,.48,.15],handR:[-.20,.55,.40],elbowR:[-.45,.60,.55]};
  registerMove({...kneelingRecovery,A:[
   ...kneelingRecovery.A.map(key=>key.t===.5?{...key,stop:true,pose:kneelingPose}:key.t===.75?{...key,t:.88}:key),
   {t:.68,stop:true,pose:{...kneelingPose,handL:[.52,.35,.24],elbowL:[.70,.46,.12],handR:[-.40,.48,.25],elbowR:[-.55,.55,.20]} as PoseSpec},
   // Carry the released hand outside the ribs before reaching down to the wrist.
   {t:.78,pose:{...kneelingPose,hips:[.34,.40,-.12],handL:[.46,.40,.48],elbowL:[.66,.50,.30],handR:[-.55,.28,.50],elbowR:[-.65,.40,.35]} as PoseSpec}
  ].sort((a,b)=>a.t-b.t)});
  const waistTransfer=moveClip('armBarPressureSeatedExitDraft')!;
  registerMove({...waistTransfer,contacts:[
   ...seatedHold.contacts!.map(c=>({...c,from:0,to:.25,fade:.15})),
   {who:'A',hand:'L',on:'hips',at:[.18,.02,0],palm:true,from:.55,to:.65,fade:.10},
   {who:'A',hand:'R',on:'chest',at:[-.05,.04,-.14],palm:true,from:.62,to:.70,fade:.16},
   ...holdClip('flatPressureDraft')!.contacts!.map(c=>({...c,from:c.hand==='L'?.92:.95,to:1,fade:.20}))
  ]});
  // Lift the free arm around the shoulder rather than sweeping across the chest.
  const pressureRecovery=moveClip('armBarPressureSeatedExitDraft')!;
  const shoulderRoute=createLocal();
  sampleMove(pressureRecovery.id,'A',.375,false,shoulderRoute);
  registerMove({...pressureRecovery,A:[...pressureRecovery.A,
   {t:.375,pose:{base:shoulderRoute,hips:[.50,shoulderRoute[P.HIPS+1],shoulderRoute[P.HIPS+2]],footL:[.80,.16,-.20,0,25],kneeL:[.85,.25,-.10],handR:[.20,.55,.75],elbowR:[.45,.55,.80],palms:[0,0]} as PoseSpec}].sort((a,b)=>a.t-b.t)});
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
  // Establish the outside knee before shifting the torso over the rolling defender.
  const kneeBaseRecovery=moveClip('armBarPressureSeatedExitDraft')!;
  registerMove({...kneeBaseRecovery,A:kneeBaseRecovery.A.map(key=>
   key.t===.375?{...key,pose:{...key.pose,footL:[.80,.04,-.50,0,65],kneeL:[.78,.08,-.12]}}:
   key.t===.5||key.t===.68?{...key,pose:{...key.pose,footL:[.66,.04,-.54,0,65],kneeL:[.64,.08,-.15]}}:key)});
  // Keep the supported recovery opt-in until its full contact audit passes.
  registerMove({...moveClip('armBarPressureSeatedExitDraft')!,id:'armBarSupportedSeatedExitDraft'});
  // Clear the planted boot surface while the defender turns out of exposure.
  // Route the free hand outside and above the rolling shoulder before
  // the chest contact is acquired; leave secured endpoints unchanged.
  const pressureExit=moveClip('armBarSupportedSeatedExitDraft')!;
  registerMove({...pressureExit,A:pressureExit.A.map((k,i)=>i===0?{...k,pose:pressureSeat}:k)});
  const exitHand=moveClip('armBarSupportedSeatedExitDraft')!;
  registerMove({...exitHand,A:exitHand.A.map(k=>{
   if(k.t!==.5&&k.t!==.68)return k;
   const base=compileSpec(k.pose,null);
   base[P.HAND_R]-=.10; base[P.HAND_R+1]+=.07;
   return {...k,pose:{base}};
  })});
  const exitBoot=moveClip('armBarSupportedSeatedExitDraft')!;
  registerMove({...exitBoot,B:exitBoot.B.map(k=>{
   if(k.t!==.15&&k.t!==.3)return k;
   const base=compileSpec(k.pose,null);base[P.FOOT_L+1]+=.012;
   return {...k,pose:{base}};
  })});

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
export function registerSupportedArmBarChain(topScale=1,bottomScale=1){
 registerSeatedBarDrafts(topScale,bottomScale);
 // Owner coaching: a secured elbow hook across the back plus opposite wrist.
 const controlled=holdClip('armBarSupportedSeatedFinishDraft')!;
 const backBar:Contact={who:'A',hand:'L',on:'chest',at:[.23,.03,-.04],palm:true,
  elbowGuide:{on:'forearmL',at:[.045,.02,-.02]}};
 const farWrist:Contact={who:'A',hand:'R',on:'forearmR',at:[0,-.245,.025],palm:true};
 registerHold({...controlled,A:controlled.A.map(p=>({...p,palms:[0,0]} as PoseSpec)) as [PoseSpec,PoseSpec],
  B:controlled.B.map(p=>({...p,handR:[-.27,.20,.60],elbowR:[0,.32,.62],wristR:[-60,0,0]} as PoseSpec)) as [PoseSpec,PoseSpec],contacts:[backBar,farWrist]});
 const pin=holdClip('armBarSupportedSeatedFinishDraft')!,flat=holdClip('flatPressureDraft')!;
 const turn=moveClip('armBarSeatedTurnDraft')!,fall=moveClip('armBarSeatedFallDraft')!;
 const flatPose=compileSpec(flat.A[0],null),plant:[number,number,number]=[flatPose[P.FOOT_L],flatPose[P.FOOT_L+1],flatPose[P.FOOT_L+2]];
 registerMove({...turn,id:'armBarSupportedSeatedTurnDraft',contacts:turn.contacts?.map(c=>c.hand==='R'?{...c,atPath:[{t:0,at:flat.contacts!.find(p=>p.hand==='R')!.at},{t:.28,at:c.at}]}:c),footPlants:turn.footPlants?.map(p=>p.from===0&&p.foot==='L'?{...p,at:plant}:p),A:turn.A.map(k=>k.t===0?{...k,pose:flat.A[0]}:k.t===.14?{...k,pose:{...k.pose,footL:[...plant,flatPose[P.FOOT_L+3]*180/Math.PI,flatPose[P.FOOT_L+4]*180/Math.PI]}}:k.t>=.94?{...k,pose:pin.A[0]}:k),B:turn.B.map(k=>k.t===0?{...k,pose:flat.B[0]}:k.t<=.58?{...k,pose:{...k.pose,footL:[.13,.04,-.98,0,80],footR:[-.13,.04,-.98,0,80],toes:[1,1]}}:k.t>=.94?{...k,pose:pin.B[0]}:k)});
 // Roll the defender's boots clear as heel orientation changes; preserve
 // planted entry and seated finish endpoints.
 const bootRoll=moveClip('armBarSupportedSeatedTurnDraft')!;
 registerMove({...bootRoll,B:bootRoll.B.map(k=>{
  if(k.t!==.72)return k;
  const base=compileSpec(k.pose,null);
  base[P.FOOT_L+1]+=.014; base[P.FOOT_R+1]+=.014;
  return {...k,pose:{base}};
 })});
 const clearTurn=moveClip('armBarSupportedSeatedTurnDraft')!;
 registerMove({...clearTurn,B:clearTurn.B.map(k=>{if(k.t!==.44&&k.t!==.58)return k;const base=compileSpec(k.pose,null);base[P.HAND_L+2]-=.035;return {...k,pose:{base}};})});


 const weightTurn=moveClip('armBarSupportedSeatedTurnDraft')!;
 registerMove({...weightTurn,A:weightTurn.A.map(k=>{if(k.t!==.14&&k.t!==.28)return k;const base=compileSpec(k.pose,null);base[P.HIPS+2]-=.08;return {...k,pose:{base}};})});
 const headArc=moveClip('armBarSupportedSeatedTurnDraft')!;
 const arcBase=createLocal();sampleMove(headArc.id,'A',.80,false,arcBase);
 registerMove({...headArc,A:[...headArc.A.map(k=>k.t===.72?{...k,pose:{...k.pose,handR:[-.10,.40,.95],elbowR:[-.30,.65,.90]} as PoseSpec}:k),{t:.80,pose:{base:arcBase,handR:[.35,.35,.85],elbowR:[.45,.65,.80]} as PoseSpec}].sort((a,b)=>a.t-b.t)});
 const sitSpace=moveClip('armBarSupportedSeatedTurnDraft')!;
 registerMove({...sitSpace,A:sitSpace.A.map(k=>{if(k.t!==.80&&k.t!==.86)return k;const base=compileSpec(k.pose,null);base[P.HIPS]+=Math.max(0,topScale-1)*.4;return {...k,pose:{base}};})});
 const postTurn=moveClip('armBarSupportedSeatedTurnDraft')!;
 registerMove({...postTurn,A:postTurn.A.map(k=>k.t===.86?{...k,pose:{...k.pose,handR:[.60,.20,.50],elbowR:[.72,.40,.50],palms:[0,1]} as PoseSpec}:k)});
 registerMove({...fall,id:'armBarSupportedSeatedFallDraft',A:fall.A.map(k=>({...k,pose:pin.A[0]})),B:fall.B.map(k=>({...k,pose:pin.B[0]})),contacts:pin.contacts});

 // Around-head experiment keeps A left hand on B left forearm throughout.
 const around=moveClip('armBarSupportedSeatedTurnDraft')!;
 const aroundPin=holdClip('armBarSupportedSeatedFinishDraft')!;
 registerMove({...around,
  A:around.A.filter(k=>k.t!==.80).map(k=>k.t===.72?{...k,pose:{...k.pose,hips:[.46,.43,.85],rot:[-110,60,0],footL:[.55,.04,.75,-100,45],footR:[-.20,.12,.95,-150,30],kneeL:[.65,.27,.8],kneeR:[.1,.4,1.05],handR:[-.2,.6,1.0],elbowR:[0,.75,1.0]} as PoseSpec}:k.t===.86?{...k,pose:{...aroundPin.A[0],hips:[-.40,.20,.82],rot:[-180,45,0,140],handR:[-.72,.18,.23],elbowR:[-.72,.4,.05]} as PoseSpec}:k.t>=.94?{...k,pose:aroundPin.A[0]}:k),
  B:around.B.map(k=>k.t===.72?{...k,pose:{...k.pose,handL:[-.10,.20,.35],elbowL:[-.28,.25,.55]} as PoseSpec}:k.t===.86?{...k,pose:{...k.pose,handL:[-.28,.103,.292],elbowL:[-.412,.08,.407],wristL:[-25,40,60]} as PoseSpec}:k.t>=.94?{...k,pose:aroundPin.B[0]}:k),
  elbowOffsets:[],wristPaths:[],
  footPlants:around.footPlants?.filter(p=>p.to<=.58),
  footSwings:[...(around.footSwings??[]).filter(p=>p.to<=.58),{foot:'R',from:.58,to:.72,height:.12},{foot:'L',from:.72,to:.94,height:.1}]
 });

 // Cross-step around the head before transferring support onto the right hip.
 const cross=moveClip('armBarSupportedSeatedTurnDraft')!;
 const crossSource=cross.A.find(k=>k.t===.58)!.pose;
 registerMove({...cross,A:[...cross.A.filter(k=>k.t<=.58),
  {t:.66,pose:{...crossSource,hips:[.52,.32,.44],rot:[-80,68,0,65],footL:[.85,.04,.04,-45,65],footR:[.72,.04,.60,-95,65],kneeL:[.78,.3,.25],kneeR:[.68,.3,.63]}},
  {t:.76,pose:{...crossSource,hips:[.22,.32,.72],rot:[-125,65,0,85],footL:[.15,.04,.90,-140,65],footR:[.72,.04,.60,-95,65],kneeL:[.2,.3,.8],kneeR:[.55,.3,.65]}},
  {t:.86,pose:{...aroundPin.A[0],hips:[-.22,.225,.826],rot:[-175,55,0,105],footL:[.15,.04,.90,-140,65],footR:[-.40,.04,.80,-180,40],kneeL:[-.1,.42,.75],kneeR:[-.45,.18,.9],handR:[-.72,.18,.23],elbowR:[-.72,.4,.05]}},
  {t:.94,stop:true,pose:aroundPin.A[0]},{t:1,stop:true,pose:aroundPin.A[0]}],
  B:cross.B.map(k=>k.t===.72?{...k,t:.76}:k),
  footPlants:[...(cross.footPlants??[]).filter(p=>p.to<=.58),
   {foot:'L',from:.58,to:.66,at:[.85,.04,.04]},
   {foot:'R',from:.66,to:.76,at:[.72,.04,.60]},
   {foot:'L',from:.76,to:.86,at:[.15,.04,.90]}],
  footSwings:[...(cross.footSwings??[]).filter(p=>p.to<=.58),
   {foot:'R',from:.58,to:.66,height:.09},{foot:'L',from:.66,to:.76,height:.10},
   {foot:'R',from:.76,to:.86,height:.09},{foot:'L',from:.86,to:.94,height:.07}]
 });

 const securedTurn=moveClip('armBarSupportedSeatedTurnDraft')!;
 registerMove({...securedTurn,
  A:securedTurn.A.map(k=>k.t>=.28?{...k,pose:{...k.pose,palms:[0,0]} as PoseSpec}:k),
  B:securedTurn.B.map(k=>k.t>=.28?{...k,pose:{...k.pose,...(k.t<=.44?{handR:[0,.40,.40],elbowR:[-.25,.48,.35],wristR:[10,0,0]}:k.t<=.58?{handR:[-.15,.32,.48],elbowR:[-.18,.43,.48],wristR:[-45,0,0]}:{handR:[-.27,.20,.60],elbowR:[0,.32,.62],wristR:[-60,0,0]})} as PoseSpec}:k),
  contacts:[...(securedTurn.contacts??[]).filter(c=>c.hand==='L').map(c=>({...c,to:.28,fade:.08})),
   {...backBar,from:.28,to:1,fade:.08,atPath:[{t:.28,at:[.10,.03,-.12]},{t:.86,at:[.10,.03,-.12]},{t:.94,at:[.23,.03,-.04]}]},{...farWrist,from:.28,to:1,fade:.08}]
 });
 // Follow the rolling defender from the actual opposite-side seated base.
 registerMove({id:'armBarSupportedSeatedExitDraft',A:[
  {t:0,pose:pin.A[0]},
  {t:.2,pose:{...pin.A[0],hips:[-.50,.26,.65],rot:[180,65,0,100],handR:[-.72,.065,.23],elbowR:[-.72,.32,.1],palms:[0,1]}},
  {t:.4,pose:{hips:[-.4,.36,.55],rot:[150,80,0],footL:[-.8,.04,.65,150,65],footR:[-.35,.04,.95,180,65],kneeL:[-.65,.08,.6],kneeR:[-.2,.15,.8],handL:[-.55,.36,.48],elbowL:[-.65,.5,.4],handR:[.1,.4,.6],elbowR:[.3,.6,.8]}},
  {t:.65,pose:{hips:[0,.4,.75],rot:[180,65,0],footL:[-.45,.04,.95,180,65],footR:[.35,.04,.8,130,65],kneeL:[-.3,.18,.9],kneeR:[.2,.2,.8],handL:[-.35,.38,.45],elbowL:[-.5,.5,.6],handR:[.35,.35,.5],elbowR:[.5,.5,.65]}},
  {t:.85,pose:{...flat.A[0],hips:[.35,.36,.2],rot:[-45,75,0],footL:[.65,.04,.45,-45,65],footR:[.45,.04,-.3,0,65],kneeL:[.5,.16,.4],kneeR:[.4,.08,-.1],handL:[.22,.3,.5],elbowL:[.45,.4,.55],handR:[-.35,.35,.05],elbowR:[-.50,.40,.05]}},
  {t:1,pose:flat.A[0]}],B:[
  {t:0,pose:pin.B[0]},
  {t:.2,pose:{...pin.B[0],hips:[0,.23,0],rot:[0,90,0,140],handL:[-.3,.16,.38],elbowL:[-.45,.2,.55]}},
  {t:.4,pose:{...pin.B[0],hips:[0,.25,0],rot:[0,90,0,90],palms:[1,1],handL:[-.4,.2,.5],elbowL:[-.5,.35,.55],handR:[.2,.14,.64],elbowR:[.4,.3,.6]}},
  {t:.65,pose:{...flat.B[0],hips:[0,.22,0],rot:[0,90,0,40],handL:[.25,.065,.6],elbowL:[.5,.3,.5],handR:[-.18,.065,.64],elbowR:[-.45,.3,.55]}},
  {t:.85,pose:flat.B[0]},{t:1,pose:flat.B[0]}],
  contacts:[...pin.contacts!.map(c=>({...c,from:0,to:.2,fade:.12})),...flat.contacts!.map(c=>({...c,from:c.hand==='L'?.8:.9,to:1,fade:.1}))],
  footSwings:[{foot:'L',from:.2,to:.4,height:.1},{foot:'R',from:.4,to:.65,height:.1},{foot:'L',from:.65,to:.85,height:.1},{foot:'R',from:.85,to:1,height:.08}]
 });

 // Release the locked arms before the bodies begin their recovery roll.
 const phasedExit=moveClip('armBarSupportedSeatedExitDraft')!;
 const retime=(t:number)=>.2+.8*t;
 registerMove({...phasedExit,
  A:[{t:0,pose:pin.A[0]},...phasedExit.A.map(k=>({...k,t:retime(k.t),...(k.t<=.2?{pose:{...k.pose,palms:[1,1],handL:[-.287,.075,.367],elbowL:k.t===.2?[-.334,.322,.450]:[-.450,.101,.479],handR:[-.310,.169,.567],elbowR:k.t===.2?[-.315,.376,.413]:[-.422,.261,.357]} as PoseSpec}:{})}))],
  B:[{t:0,pose:pin.B[0]},...phasedExit.B.map(k=>({...k,t:retime(k.t)}))],
  contacts:[...pin.contacts!.map(c=>({...c,from:0,to:.08,fade:.12})),...flat.contacts!.map(c=>({...c,from:retime(c.hand==='L'?.8:.9),to:1,fade:.08}))],
  footSwings:phasedExit.footSwings?.map(s=>({...s,from:retime(s.from),to:retime(s.to)}))
 });

 // Isolated defended-gather study: stop before the head circle, maintain
 // the pressure base briefly, then recover the captured elbow and flat ride.
 // Reuse the supported entry geometry rather than the incompatible legacy bar.
 const gather=moveClip('armBarSupportedSeatedTurnDraft')!;
 const times=[0,.12,.24,.36,.45,.55,.64,.76,.85,.88,1];
 // Defender clears the elbow first; rider follows back into control.
 // Separate timing makes the return a reaction rather than both bodies
 // retracing the capture together.
 const sourcePhase=(t:number,role:'A'|'B')=>role==='B'
  ?t<=.45?.28*t/.45:.28*Math.max(0,(.85-t)/.40)
  :t<=.45?.28*t/.45:t<=.55?.28:.28*(1-t)/.45;
 const track=(role:'A'|'B')=>times.map(t=>{
  const base=createLocal();sampleMove(gather.id,role,sourcePhase(t,role),false,base);
  // Failed gather stays low beside the opponent; do not replay the
  // successful head-circle's high knee pole on the recovery step.
  if(role==='A'&&t>0&&t<1)base[P.KNEE_R+1]=Math.min(base[P.KNEE_R+1],.16);
  return {t,pose:{base} as PoseSpec,stop:t===.45||t===.55};
 });
 registerMove({id:'armBarSupportedResistedDraft',A:track('A'),B:track('B'),
  // Preserve the support foot continuously across the sampled gather and
  // defender-led return; sparse pose samples must not interpolate its plant.
  footPlants:[{...gather.footPlants!.find(p=>p.foot==='R'&&p.from===.14)!,from:.225,to:.775}],
  // Retain the same forearm control through the blocked gather. Slide
  // toward the elbow as it folds, then follow it back to the outside post.
  contacts:flat.contacts!.map(c=>({...c,from:0,to:1,fade:.05,
   ...(c.hand==='L'?{atPath:[{t:0,at:c.at},{t:.45,at:[0,-.10,.04] as [number,number,number]},
    {t:.85,at:c.at},{t:1,at:c.at}]}:{})}))});

 // Once a control releases, low free hands must receive the mat on their palms.
 const palmExit=moveClip('armBarSupportedSeatedExitDraft')!;
 registerMove({...palmExit,A:palmExit.A.map(k=>({...k,pose:{...k.pose,palms:[1,1]} as PoseSpec})),B:palmExit.B.map(k=>({...k,pose:{...k.pose,palms:[1,1]} as PoseSpec}))});

 // Roll over the shoulder volume rather than through the floor.
 const rollClear=moveClip('armBarSupportedSeatedExitDraft')!;
 registerMove({...rollClear,B:rollClear.B.map(k=>{
  const lift=Math.abs(k.t-.36)<.001?.03:Math.abs(k.t-.52)<.001?.06:Math.abs(k.t-.72)<.001?.04:0;
  return lift&&k.pose.hips?{...k,pose:{...k.pose,hips:[k.pose.hips[0],k.pose.hips[1]+lift,k.pose.hips[2]]} as PoseSpec}:k;
 })});

 // Withdraw the bar hand above the mat before lowering it to a support post.
 const releasePost=moveClip('armBarSupportedSeatedExitDraft')!;
 registerMove({...releasePost,A:releasePost.A.map(k=>Math.abs(k.t-.2)<.001?{...k,pose:{...k.pose,handL:[-.38,.18,.35],elbowL:[-.50,.28,.48]} as PoseSpec}:k)});

 // Follow the cleared shoulder back toward the hips before reattaching.
 const follow=moveClip('armBarSupportedSeatedExitDraft')!;
 registerMove({...follow,A:follow.A.map(k=>{
  if(Math.abs(k.t-.52)<.001)return {...k,pose:{...k.pose,hips:[-.42,.38,.38],rot:[90,75,0],handL:[-.45,.34,.56],elbowL:[-.66,.48,.55],handR:[-.22,.40,.55],elbowR:[-.42,.55,.70]} as PoseSpec};
  if(Math.abs(k.t-.72)<.001)return {...k,pose:{...k.pose,hips:[-.25,.40,.08],rot:[35,80,0],footL:[-.55,.04,.20,35,65],footR:[-.20,.04,-.35,35,65],kneeL:[-.50,.20,.12],kneeR:[-.30,.20,-.15],handL:[.18,.30,.62],elbowL:[.35,.48,.58],handR:[-.38,.32,.20],elbowR:[-.60,.48,.20]} as PoseSpec};
  if(Math.abs(k.t-.88)<.001)return {...k,pose:flat.A[0]};
  return k;
 }),contacts:follow.contacts?.map(c=>(c.from??0)>.5?{...c,from:.94,fade:.06}:c)});

}
