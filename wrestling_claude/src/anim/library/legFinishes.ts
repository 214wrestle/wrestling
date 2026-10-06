import { registerMove } from '../clips';
import { holdAt, BALL, POST } from './kit';
// The outside trip attacks the planted leg; the drive finish carries the
// defender backwards before he posts and lands. They retain the elevated leg.
registerMove({id:'liftedLegTrip',A:[
 {t:0,pose:{base:holdAt('legsSingle','A',1)}},
 {t:0.35,pose:{hips:[0.16,0.86,0.25],rot:[-35,12,0],footL:[-0.12,BALL,0.64,-35,15],footR:[0.36,BALL,0.1,-35,20]}},
 {t:0.7,land:true,pose:{hips:[0.3,0.55,0.5],rot:[-80,40,0],footL:[0.52,BALL,0.38,-90,35],footR:[0.48,BALL,0.72,-90,60]}},
 {t:1,pose:{base:holdAt('ride','A',0,{x:0.3,z:0.8,yaw:-90})}}],B:[
 {t:0,pose:{base:holdAt('legsSingle','B',1)}},
 {t:0.35,pose:{hips:[0,0.91,0.62],rot:[160,0,20],footL:[-0.12,0.1,0.64,160,30],footR:[0.18,0.64,0.3,160,35]}},
 {t:0.7,land:true,pose:{hips:[0.25,0.25,0.84],rot:[-90,55,0,-65],handL:[0.48,POST,0.98],footL:[-0.1,0.06,0.8,-70,70]}},
 {t:1,pose:{base:holdAt('ride','B',0,{x:0.3,z:0.8,yaw:-90})}}],contacts:[{who:'A',hand:'L',on:'shinR',at:[0,-0.08,-0.04],from:0,to:0.55},{who:'A',hand:'R',on:'thighR',at:[0.02,-0.3,0.05],from:0,to:0.55}]});
registerMove({id:'liftedLegDrive',A:[
 {t:0,pose:{base:holdAt('legsSingle','A',1)}},
 {t:0.35,pose:{hips:[0.08,0.88,0.48],rot:[0,15,0],footL:[0.28,BALL,0.65,0,20],footR:[-0.08,BALL,0.18,0,20]}},
 {t:0.7,land:true,pose:{hips:[0.08,0.55,0.85],rot:[0,48,0],footL:[0.3,BALL,1.0,0,50],footR:[-0.2,BALL,0.7,0,50]}},
 {t:1,pose:{base:holdAt('ride','A',0,{x:0,z:1.1,yaw:180})}}],B:[
 {t:0,pose:{base:holdAt('legsSingle','B',1)}},
 {t:0.35,pose:{hips:[0,0.92,0.9],rot:[180,-15,0],footL:[-0.2,BALL,1.18,180,30],footR:[0.13,0.62,0.65,180,35]}},
 {t:0.7,land:true,pose:{hips:[0,0.3,1.2],rot:[180,-40,0],handL:[-0.4,POST,1.35],handR:[0.4,POST,1.35]}},
 {t:1,pose:{base:holdAt('ride','B',0,{x:0,z:1.1,yaw:180})}}],contacts:[{who:'A',hand:'L',on:'shinR',at:[0,-0.08,-0.04],from:0,to:0.55},{who:'A',hand:'R',on:'thighR',at:[0.02,-0.3,0.05],from:0,to:0.55}]});
