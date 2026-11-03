import {DOUBLE_BAR_FRONT_SUPPORT_X} from '../armBarEffort';
import {ARM_BAR_GRIP_RELEASE} from '../../sim/armBars';
import {registerHold,registerMove,type Contact} from '../clips';
import type {PoseSpec} from '../spec';
import {holdAt,BALL} from './kit';

// Folkstyle bar arms: bent-arm control and chest/hip pressure, not a straight
// elbow submission. Left is authored; the pair's mirror produces the right.
// Selected top attacks use existing turn odds and delayed near-fall scoring.
const variants=['armBar','wristBar','barHalf','doubleBar'] as const;
for(const id of variants){
 const half=id==='barHalf',double=id==='doubleBar',wrist=id==='wristBar';
 const bottom:PoseSpec={base:holdAt('flat','B',0),
  handL:[.13,.29,.18],elbowL:[.34,.20,.40],
  handR:double?[-.13,.29,.18]:wrist?[-.24,.09,.44]:[-.22,.06,.62],
  elbowR:double?[-.34,.20,.40]:[-.40,.13,.38],...(id==='armBar'?{shrugL:[10,5] as [number,number]}:{})};
 const top:PoseSpec={base:holdAt('flat','A',0),hips:[double?.16:.28,.38,-.12],
  rot:[-12,76,0],kneeL:[.58,.08,-.14],kneeR:[-.12,.08,-.38],
  footL:[.66,BALL,-.54,0,65],footR:[-.26,BALL,-.7,0,65],
  handL:[.22,.30,.35],handR:half?[-.12,.38,.62]:double?[-.22,.30,.35]:wrist?[-.24,.12,.44]:[-.13,.28,.05],
  elbowL:[.42,.30,.42],elbowR:half?[-.30,.36,.58]:[-.32,.28,.28]};
 // Secure the bar while gathering the far wrist from its forward post;
 // then draw the wrist inward before driving the turn.
 const wristReachA:PoseSpec={base:holdAt('flat','A',0),hips:[.20,.32,0],
  handL:[.22,.30,.35],elbowL:[.42,.30,.42],
  handR:[-.16,.08,.65],elbowR:[-.4,.5,.8]};
 const wristLiftA:PoseSpec={base:holdAt('flat','A',0),hips:[.17,.35,-.03],
  handR:[-.3,.5,.4],elbowR:[-.4,.6,.3]};
 const wristReachB:PoseSpec={...bottom,handR:[-.16,.05,.66],elbowR:[-.5,-.4,.45]};
 const contacts:Contact[]=double?(['L','R'] as const).map(hand=>({who:'A',hand,on:'chest',at:[0,.03,-.14],backClasp:true,elbowGuide:{on:'chest',at:[hand==='L'?.26:-.26,.03,-.45]}})):[{who:'A',hand:'L',on:'forearmL',at:[0,-.10,.04]},
  {who:'A',hand:'R',on:half?'neck':double?'forearmR':wrist?'handR':'hips',
   at:half?[0,.02,-.06]:double?[0,-.10,.04]:wrist?[0,0,.025]:[-.13,.02,0],
   ...(half?{elbowGuide:{on:'armR' as const,at:[-.14,-.10,-.02] as [number,number,number]}}:{})}];
 // Authored interpretation of Stieber's elbow-clear/back-pressure finish.
 const finishContacts:Contact[]=half?contacts.map(c=>c.hand==='L'?{...c,on:'chest',at:[.10,.03,-.12],elbowGuide:{on:'chest',at:[.3,.03,-.3]}}:{...c,elbowGuide:{on:'chest',at:[.32,.12,.1]}}):contacts;
 const backB:PoseSpec={base:holdAt('exposed','B',0),
  handL:half?[.28,.16,.43]:wrist?[.23,.19,.24]:[.14,.19,.24],elbowL:half?[.38,.12,.30]:[.34,.15,.43],
  handR:double?[-.14,.19,.24]:wrist?[-.28,.16,.4]:id==='armBar'?[-.18,.22,.44]:[-.36,.14,.5],
  elbowR:double?[-.34,.15,.43]:[-.45,.16,.34],head:[double?18:-12,half?-18:0,0],...(id==='armBar'?{shrugL:[24,10] as [number,number]}:{})};
 const backA:PoseSpec={base:holdAt('exposed','A',0),hips:[double?.01:.22,double?.31:.34,.02],rot:[-35,76,0],
  footL:[double?DOUBLE_BAR_FRONT_SUPPORT_X:.75,BALL,.4,-55,65],footR:[.65,BALL,-.45,-30,65],
  kneeL:[.65,.06,.3],kneeR:[.55,.06,-.25],
  ...(half?{handL:[-.14,.24,.29] as [number,number,number]}:{}),
  elbowL:[.44,.25,.46],elbowR:half?[-.3,.3,.6]:[-.32,.27,.3],
  // Owner-described single-bar finish: sit through, hips upward, then arch
  // against the trapped shoulder while retaining the bent-arm control.
  ...(id==='armBar'?{hips:[.17,.24,.10] as [number,number,number],
   rot:[0,90,0,160] as [number,number,number,number],spine:[-18,0,0] as [number,number,number],
   kneeL:[.55,.70,.35] as [number,number,number],kneeR:[.55,.70,-.25] as [number,number,number]}:{})};
 registerHold({id:id+'Control',A:[top,{...top,hips:[double?.20:.32,.35,.02]}],
  B:[bottom,{...bottom,hips:[.04,.15,.04]}],contacts,struggle:{A:.35,B:.45},tempo:1.1});
 registerHold({id:id+'Pin',A:[backA,{...backA,hips:[double?.01:id==='armBar'?.17:.20,.31,.08]}],
  B:[backB,{...backB,hips:[.04,.19,.02]}],contacts:finishContacts,struggle:{A:.35,B:.6},tempo:1.2});
 registerMove({id:id+'Turn',A:[
  {t:0,pose:{base:holdAt('flat','A',0)}},
  ...(wrist?[{t:.11,pose:wristLiftA},{t:.22,pose:wristReachA}]:[]),
  {t:wrist?.38:.28,pose:half?{...top,handR:[-.18,.31,.48],elbowR:[-.36,.28,.40]}:top},
  // Bar first; the opposite hand threads beneath the upper arm before the half closes.
  {t:.6,pose:{...top,hips:[double?.20:.32,.34,.08],rot:id==='armBar'?[-45,76,0]:[-20,76,0],footL:[double?DOUBLE_BAR_FRONT_SUPPORT_X:.75,BALL,.4,-55,65],...(id==='armBar'?{hips:[.40,.34,.18] as [number,number,number]}:{})}},
  {t:.78,pose:{...backA,hips:[double?.06:.28,.35,.05],...(id==='armBar'?{rot:[0,90,0,80] as [number,number,number,number]}:{})}},
  {t:1,pose:backA}],B:[
  {t:0,pose:{base:holdAt('flat','B',0)}},
  ...(wrist?[{t:.22,pose:wristReachB}]:[]),
  {t:wrist?.38:.28,pose:bottom},
  ...(id==='armBar'?[{t:.44,pose:{...bottom,shrugL:[28,12] as [number,number],handL:[.13,.29,.26] as [number,number,number]}}]:[]),
  {t:.6,pose:{...bottom,...(id==='armBar'?{shrugL:[28,12] as [number,number],handL:[.13,.29,.26] as [number,number,number]}:{}),hips:[.04,.21,.04],rot:[0,90,0,65],kneeL:[.3,.16,-.55],kneeR:[-.3,.16,-.55]}},
  {t:.78,pose:{...bottom,hips:[.03,.19,.02],rot:[0,90,0,100],
   // The elbow clears as back pressure replaces the bar; recover the hand
   // toward the chest while the half still controls the opposite shoulder.
   ...(half?{handL:[.24,.17,.37] as [number,number,number],elbowL:[.36,.13,.32] as [number,number,number]}:{}),
   kneeL:[-.25,.35,-.35],kneeR:[.25,.35,-.35],footL:[-.15,BALL,-.65,120,0],footR:[.2,BALL,-.65,150,0]}},
  {t:1,land:true,pose:backB}],contacts:[...contacts.map(c=>({...c,...(half&&c.hand==='R'?{elbowGuide:{on:'chest' as const,at:[.32,.12,.1] as [number,number,number]}}:{}),from:wrist?(c.hand==='L'?.22:.3):half&&c.hand==='R'?.38:.28,to:half&&c.hand==='L'?.48:1,fade:wrist?.14:half&&c.hand==='R'?.26:half&&c.hand==='L'?.08:.18})),...(half?[{...finishContacts[0],from:.9,to:1,fade:.34}]:[])]});
 // The free palm stays planted while the bar-side elbow works underneath.
 // Do not slide that support sideways as the hips rise against the turn.
 const doubleClearA:PoseSpec={base:holdAt('flat','A',0),
  handL:[.25,.4,.25],handR:[-.25,.4,.25],elbowL:[.45,.5,.2],elbowR:[-.45,.5,.2]};
 const resistedBottom:PoseSpec=id==='armBar'?{...bottom,handR:[-.16,.05,.66],elbowR:[-.5,-.4,.45]}:bottom;
 // Defense keeps the free post, draws the elbow down and returns chest to mat.
 registerMove({id:id+'Resisted',A:[{t:0,pose:{base:holdAt('flat','A',0)}},...(wrist?[{t:.15,pose:wristLiftA},{t:.3,pose:wristReachA}]:[]),...(double?[{t:.28,pose:doubleClearA}]:[]),...(half?[{t:.22,pose:{base:holdAt('flat','A',0),handR:[-.26,.35,.3] as [number,number,number],elbowR:[-.4,.4,.3] as [number,number,number]}}]:[]),{t:wrist?.48:.35,pose:top},{t:wrist?.68:.55,pose:{...top,hips:[wrist?.35:.38,wrist?.43:.40,-.02],...(wrist?{rot:[-6,66,0] as [number,number,number],handR:[-.35,.65,.45] as [number,number,number],elbowR:[-.5,.75,.3] as [number,number,number]}:{})}},
  // Reclaim the waist with the rear hand while the other arm clears its bar.
  // Reusing the gathering pose here lifted both hands away from the ride.
  ...(double?[{t:.8,pose:{...doubleClearA,handL:[.25,.4,.25] as [number,number,number],handR:[-.25,.35,-.1] as [number,number,number],elbowL:[.45,.5,.2] as [number,number,number],elbowR:[.15,.45,-.3] as [number,number,number]}}]:[]),
  // Release the far wrist before the shoulder rises, then carry the hand
  // outside the shoulder before returning to the waist. Lower the hips as
  // the recovery step lands so the smaller rider keeps a grounded support.
  ...(wrist?[{t:.82,pose:{...top,hips:[.25,.36,-.08] as [number,number,number],handR:[-.4,.5,.45] as [number,number,number],elbowR:[-.6,.6,.3] as [number,number,number]}}]:[]),
  {t:1,pose:{base:holdAt('flat','A',0)}}],B:[{t:0,pose:{base:holdAt('flat','B',0)}},...(wrist?[{t:.3,pose:wristReachB}]:[]),{t:wrist?.48:.35,pose:resistedBottom},
  {t:wrist?.68:.55,pose:{...resistedBottom,hips:[.03,wrist?.22:.18,.04],handL:[.16,.12,.36],elbowL:[.24,.12,.42],
   // Without chest pressure, the defender raises the shoulder into the rider
   // before bringing the elbow back under the chest as the grip clears.
   ...(wrist?{rot:[0,82,0,35] as [number,number,number,number],spine:[-22,0,-8] as [number,number,number]}:{})}},
  {t:1,pose:{base:holdAt('flat','B',0)}}],contacts:contacts.map(c=>({...c,from:wrist?(c.hand==='L'?.3:.38):.3,to:wrist?(c.hand==='R'?.50:.68):.55,fade:.18}))});
 registerMove({id:id+'Exit',A:[{t:0,pose:backA},
   // Recover the rear support first; keep the forward foot planted until it lands.
   {t:.25,pose:{...top,hips:[.25,.36,-.05],rot:id==='armBar'?[0,76,0,80]:[-24,76,0],
    footL:[double?DOUBLE_BAR_FRONT_SUPPORT_X:.75,BALL,.4,-55,65],kneeL:[.65,.06,.3],...(half?{handR:[-.4,.5,.45] as [number,number,number],elbowR:[-.5,.5,.5] as [number,number,number]}:{}),...(double?{...backA,footR:top.footR,kneeR:top.kneeR}:{})}},
   // Once the half clears, recover toward the near ribs before the waist.
   // Holding the neck target until halfway forced a long last-moment reach.
   {t:.5,pose:half?{...top,handR:[-.35,.4,.2],elbowR:[-.5,.45,.2]}:top},
   {t:.75,pose:{base:holdAt('flat','A',0),footL:[.66,BALL,-.54,0,65],kneeL:[.58,.08,-.14],...(id==='armBar'?{hips:[.24,.35,-.16] as [number,number,number],rot:[0,80,0] as [number,number,number]}:{})}},
   {t:1,pose:{base:holdAt('flat','A',0)}}],
  B:[{t:0,pose:backB},
   // Clear the lock while rotating onto the side, then recover the free-arm post.
   {t:.3,pose:{...backB,hips:[.03,.20,.02],rot:[0,90,0,105],
    kneeL:[-.25,.35,-.35],kneeR:[.25,.35,-.35],footL:[-.15,BALL,-.65,120,0],footR:[.2,BALL,-.65,150,0]}},
  {t:.6,pose:{...bottom,...(id==='armBar'?{shrugL:[0,0] as [number,number]}:{}),hips:[.04,.21,.04],rot:[0,90,0,55],
    kneeL:[.3,.16,-.55],kneeR:[-.3,.16,-.55],handL:[.22,.06,.56],elbowL:[.35,.14,.42]}},
   {t:1,pose:{base:holdAt('flat','B',0)}}],
  contacts:finishContacts.map(c=>({...c,from:0,to:ARM_BAR_GRIP_RELEASE-(double?.22:.15),fade:double?.22:.15}))});
 registerMove({id:id+'Fall',A:[{t:0,pose:backA},...(double?[{t:.25,pose:{...backA,hips:[.01,.29,.04] as [number,number,number],rot:[-35,84,0] as [number,number,number]}}]:[]),{t:1,pose:{...backA,hips:[double?.01:.20,double?.25:.31,.08],...(double?{rot:[-35,90,0] as [number,number,number]}:{})}}],
  B:[{t:0,pose:backB},{t:1,pose:{...backB,rot:[0,90,0,170]}}],contacts:finishContacts});
}
