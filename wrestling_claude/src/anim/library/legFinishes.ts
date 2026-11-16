import { registerMove } from '../clips';
import { holdAt, BALL, POST } from './kit';
// The outside trip attacks the planted leg; the drive finish carries the
// defender backwards before he posts and lands. They retain the elevated leg.
registerMove({id:'liftedLegTrip',A:[
 {t:0,pose:{base:holdAt('legsSingle','A',1)}},
 {t:0.35,pose:{hips:[0.16,0.86,0.25],rot:[-35,12,0],footL:[-0.12,BALL,0.64,-35,15],footR:[0.36,BALL,0.1,-35,20]}},
 {t:0.58,pose:{handL:[0.05,0.54,0.7],elbowL:[-0.12,0.7,0.45]}},
 {t:0.7,land:true,pose:{hips:[0.4,0.48,0.5],rot:[-80,30,-8],spine:[20,0,0],footL:[0.66,BALL,0.28,-85,15],footR:[0.18,BALL,0.76,-90,20],kneeR:[0.28,0.12,0.62],handR:[0.24,0.48,0.84],elbowR:[0.54,0.63,0.62]}},
 {t:1,pose:{base:holdAt('ride','A',0,{x:0.3,z:0.8,yaw:-90})}}],B:[
 {t:0,pose:{base:holdAt('legsSingle','B',1)}},
 {t:0.35,pose:{hips:[0,0.91,0.62],rot:[160,0,20],footL:[-0.12,0.1,0.64,160,30],footR:[0.18,0.64,0.3,160,35]}},
 {t:0.7,land:true,pose:{hips:[0.25,0.25,0.84],rot:[-90,55,0,-65],handL:[0.48,POST,0.98],footL:[-0.1,0.06,0.8,-70,70]}},
 {t:1,pose:{base:holdAt('ride','B',0,{x:0.3,z:0.8,yaw:-90})}}],contacts:[{who:'A',hand:'L',on:'shinR',at:[0,-0.08,-0.04],from:0,to:0.50},{who:'A',hand:'R',on:'thighR',at:[0.02,-0.3,0.05],from:0,to:0.38},{who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:0.44,to:1},{who:'A',hand:'L',on:'forearmL',at:[0,-0.12,0],from:0.9,to:1}]});
// Carry the elevated knee around the hip as the defender turns to his base.
// This is a bend-direction guide, not a literal knee location.
registerMove({id:'liftedLegDrive',A:[
 {t:0,pose:{base:holdAt('legsSingle','A',1)}},
 // Drive off the outside angle, not square, turning in only as he goes down.
 {t:0.35,pose:{hips:[0.17,0.86,0.46],rot:[-28,18,0],footL:[0.36,BALL,0.62,-15,20],footR:[0.02,BALL,0.16,-30,20]}},
 {t:0.58,pose:{handL:[-0.2,0.54,1.0],elbowL:[-0.42,0.7,0.8]}},
 {t:0.7,land:true,pose:{hips:[0.08,0.47,0.85],rot:[0,48,0],footL:[0.3,BALL,1.12,0,20],footR:[-0.2,BALL,0.65,0,55],kneeR:[-0.2,0.14,0.88],handL:[-0.2,0.4,1.2],handR:[0.15,0.6,1.2],elbowL:[-0.42,0.62,1.0],elbowR:[0.4,0.7,1.0]}},
 {t:1,pose:{base:holdAt('ride','A',0,{x:0,z:1.1,yaw:180})}}],B:[
 {t:0,pose:{base:holdAt('legsSingle','B',1)}},
 {t:0.35,pose:{hips:[0,0.92,0.9],rot:[180,-15,0],footL:[-0.2,BALL,1.18,180,30],footR:[0.13,0.62,0.65,180,35]}},
 {t:0.7,land:true,pose:{hips:[0,0.3,1.2],rot:[180,-40,0],kneeR:[3,1.6,0.8],handL:[-0.4,POST,1.35],handR:[0.4,POST,1.35]}},
 {t:1,pose:{base:holdAt('ride','B',0,{x:0,z:1.1,yaw:180})}}],contacts:[{who:'A',hand:'L',on:'shinR',at:[0,-0.08,-0.04],from:0,to:0.50},{who:'A',hand:'R',on:'thighR',at:[0.02,-0.3,0.05],from:0,to:0.4},{who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:0.44,to:1},{who:'A',hand:'L',on:'forearmL',at:[0,-0.04,-0.035],from:0.78,to:1}]});
// The dump (situation options, owner November 15: "single leg: trips, switch to double, dump"): leg up and him
// heavy on you, whizzering over or leaning in. Step the back foot round behind you and turn the corner the way he
// leans, pulling the leg round and down: his own weight carries him past your hip and he lands on his side next to
// you, and you come round behind him. He ends where the turn left him, beside the attacker's start.
const DUMP_END = { x: 0.35, z: 0.15, yaw: 180 };
registerMove({id:'liftedLegDump',A:[
 {t:0,pose:{base:holdAt('legsSingle','A',1)}},
 // The pivot: the back foot swings round behind, the hips turn toward his free side, the chest stays on the leg.
 {t:0.3,pose:{hips:[0.1,0.84,0.0],rot:[55,20,0],footR:[0.32,BALL,-0.18,60,20],footL:[0.06,BALL,0.16,20,15]}},
 // Turning the corner: pulling the leg round and down as he comes over the top.
 {t:0.52,pose:{hips:[0.14,0.72,0.08],rot:[115,30,0],spine:[18,0,0],footR:[0.36,BALL,0.02,120,30],footL:[-0.1,BALL,0.1,90,30]}},
 {t:0.68,land:true,pose:{hips:[0.1,0.56,0.24],rot:[160,38,0],spine:[16,0,0],footL:[-0.12,BALL,0.02,170,60],footR:[0.3,BALL,-0.04,170,60],handL:[0.45,0.36,0.3],handR:[0.22,0.42,0.44]}},
 {t:1,pose:{base:holdAt('ride','A',0,DUMP_END)}}],B:[
 {t:0,pose:{base:holdAt('legsSingle','B',1)}},
 // He hops to stay with the leg, his weight still over the attacker's back.
 {t:0.3,pose:{hips:[0.12,0.9,0.42],rot:[200,18,10],footL:[0.1,BALL,0.62,200,30]}},
 // Over the top: tipping past the attacker's hip, reaching to post.
 {t:0.52,pose:{hips:[0.32,0.62,0.3],rot:[220,40,-35],spine:[16,0,-10],footL:[0.2,0.12,0.6,220,50],handL:[0.45,0.3,0.0],handR:[0.62,0.32,0.18]}},
 {t:0.68,land:true,pose:{hips:[0.38,0.26,0.2],rot:[190,55,-60],handL:[0.42,POST,-0.12],handR:[0.62,POST,0.0],footL:[0.2,0.08,0.55,200,70]}},
 {t:1,pose:{base:holdAt('ride','B',0,DUMP_END)}}],contacts:[{who:'A',hand:'L',on:'shinR',at:[0,-0.08,-0.04],from:0,to:0.56},{who:'A',hand:'R',on:'thighR',at:[0.02,-0.3,0.05],from:0,to:0.5},{who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:0.62,to:1},{who:'A',hand:'L',on:'forearmL',at:[0,-0.04,-0.035],from:0.86,to:1}]});
