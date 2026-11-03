import { registerHold, registerMove } from '../clips';
import { holdAt } from './kit';
// Before the roll, the defender bends over the single to collect the arm
// and near leg. Progress comes from the contested capture meter.
registerHold({
 id:'spladleSetup',
 A:[{base:holdAt('legsSingle','A',0.35)},
    {base:holdAt('legsSingle','A',0.2),head:[20,-15,0],spine:[26,-10,0]}],
 B:[{base:holdAt('legsSingle','B',0.2),hips:[-0.06,0.62,0.34],rot:[170,30,6],spine:[24,10,-8]},
    {hips:[-0.10,0.56,0.25],rot:[150,42,6],spine:[28,14,-8],
     footL:[-0.24,0.04,0.10,160,12],kneeL:[-0.32,0.4,-0.12]}],
 contacts:[{who:'A',hand:'L',on:'shinR',at:[0,-0.04,-0.05]},
   {who:'A',hand:'R',on:'thighR',at:[0.03,-0.32,0.07]},
   {who:'B',hand:'L',on:'forearmR',at:[0,-0.08,0]},
   {who:'B',hand:'R',on:'thighL',at:[0,-0.24,0]}],
 struggle:{A:.65,B:.6},tempo:1.5,
});
// Defender sits behind the shot, splits the attacker's legs and folds the
// trapped attacker toward his shoulders. Role A is the holder in the hold.
registerHold({
 id:'spladle',
 A:[{hips:[0.24,0.2,0.14],rot:[-90,70,0],spine:[18,0,0],head:[-12,0,0],
   footL:[-0.27,0.16,-0.18,-60,30],footR:[0.38,0.12,0.54,-90,30],
   kneeL:[-0.16,0.45,0.03],kneeR:[0.32,0.4,0.26],
   handL:[0.10,0.32,0.20],handR:[0.15,0.4,0.23]},
   {hips:[0.22,0.19,0.14],spine:[22,0,0]}],
 B:[{hips:[0,0.37,-0.04],rot:[0,-150,0],spine:[42,0,0],head:[35,0,0],
   footL:[-0.26,0.24,0.49,0,25],footR:[0.31,0.2,0.4,0,25],
   kneeL:[-0.28,0.56,0.2],kneeR:[0.3,0.57,0.17],
   handL:[-0.22,0.08,0.37],handR:[0.25,0.08,0.38]},
   {hips:[0,0.37,-0.04],rot:[0,-155,0],spine:[42,0,0],head:[55,0,0]}],
 contacts:[{who:'A',hand:'L',on:'thighL',at:[0.06,-0.24,0.04]},
   {who:'A',hand:'R',on:'thighL',at:[0,-0.24,0]}],
 struggle:{A:0.25,B:0.35},tempo:1,
});
// Roles remain those of the original leg battle until the counter wins control.
registerMove({id:'spladleCounter',
 A:[{t:0,pose:{base:holdAt('spladleSetup','A',1)}},
   {t:0.5,pose:{hips:[0.04,0.48,0.12],rot:[0,-55,0],spine:[30,0,0],head:[25,0,0]}},
   {t:1,pose:{base:holdAt('spladle','B',0)}}],
 B:[{t:0,pose:{base:holdAt('spladleSetup','B',1)}},
   {t:0.5,pose:{hips:[0.24,0.35,0.20],rot:[210,60,0],spine:[22,0,0],handL:[0.10,0.33,0.25]}},
   {t:1,pose:{base:holdAt('spladle','A',0),rot:[270,70,0]}}],
 contacts:[
   {who:'B',hand:'R',on:'thighL',at:[0,-0.24,0]},
   {who:'B',hand:'L',on:'forearmR',at:[0,-0.08,0],to:.12},
   {who:'B',hand:'L',on:'thighL',at:[.06,-.24,.04],from:.65},
   {who:'A',hand:'L',on:'shinR',at:[0,-.04,-.05],to:.15},
   {who:'A',hand:'R',on:'thighR',at:[.03,-.32,.07],to:.15},
 ],
});
