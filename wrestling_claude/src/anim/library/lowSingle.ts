import { registerHold, registerMove } from '../clips';
import { BALL, POST, holdAt, stanceAt } from './kit';
// Ankle shelf, head beside the knee: no high-crotch rise or elevated thigh grip.
registerHold({id:'legsLowSingle', A:[
 {base:holdAt('legsSingle','A',0),hips:[0.2,0.29,0.08],rot:[-12,35,0],spine:[15,0,0],head:[-20,-12,0],kneeL:[0.22,0.055,0.24],footL:[0.22,BALL,-0.05,0,65],footR:[-0.18,BALL,-0.38,-15,55],handL:[0.15,0.09,0.35],handR:[0.12,0.15,0.43]},
 {hips:[0.25,0.34,0.16],handL:[0.16,0.1,0.35],handR:[0.12,0.19,0.43]}],
 B:[{base:holdAt('legsSingle','B',0),hips:[-0.03,0.65,0.82],rot:[180,40,0],spine:[6,0,0],head:[-24,0,0],handL:[0.1,0.64,0.2],handR:[0.22,0.8,0.36],footR:[0.15,0.08,0.36,180,25],footL:[-0.25,BALL,0.72,180,15]}, {hips:[-0.08,0.63,0.88],rot:[170,43,-5],footR:[0.15,0.15,0.38,180,40]}],contacts:[{who:'B',hand:'R',on:'head',at:[0.08,0.10,-0.03]},{who:'B',hand:'L',on:'chest',at:[-0.1,0.12,-0.07]},{who:'A',hand:'L',on:'shinR',at:[0.035,-0.36,0.02]},{who:'A',hand:'R',on:'shinR',at:[-0.035,-0.31,-0.015]}],struggle:{A:1,B:1},tempo:1.8});
registerMove({id:'shotLowSingle',startDist:1,warpBy:0.7,A:[
 {t:0,pose:{base:stanceAt({x:0,z:-0.5,yaw:0},1)}},
 {t:0.28,pose:{hips:[0.12,0.38,-0.3],rot:[-12,25,0],spine:[20,0,0],handL:[0.12,0.18,0.02],handR:[0.16,0.22,0.06]}},
 {t:0.7,pose:{hips:[0.2,0.26,0.04],kneeL:[0.22,0.055,0.24],footL:[0.22,BALL,-0.05,0,65],footR:[-0.18,BALL,-0.4,-15,55],handL:[0.15,0.09,0.35],handR:[0.12,0.15,0.43]}},
 {t:1,pose:{base:holdAt('legsLowSingle','A',0)}}], B:[{t:0,pose:{base:stanceAt({x:0,z:0.5,yaw:180},1)}},{t:0.55,pose:{hips:[-0.03,0.72,0.58],rot:[180,40,0],spine:[12,0,0],handL:[0.2,0.65,0.16],handR:[0.0,0.72,0.16]}},{t:1,pose:{base:holdAt('legsLowSingle','B',0)}}],contacts:[
 {who:'B',hand:'R',on:'head',at:[0.08,0.10,-0.03],from:0.65,to:1},
 {who:'B',hand:'L',on:'chest',at:[-0.1,0.12,-0.07],from:0.7,to:1},
 {who:'A',hand:'L',on:'shinR',at:[0.035,-0.36,0.02],from:0.82,to:1},
 {who:'A',hand:'R',on:'shinR',at:[-0.035,-0.31,-0.015],from:0.82,to:1}
]});
const END={x:-0.3,z:0.88,yaw:90};
registerMove({id:'finishLowSingle',A:[
 {t:0,pose:{base:holdAt('legsLowSingle','A',1)}},
 {t:0.35,pose:{hips:[0.3,0.32,0.35],rot:[30,48,0],handL:[0.12,0.12,0.42],handR:[0.12,0.22,0.42],footR:[0,BALL,0.05,30,40]}},
 {t:0.5,pose:{hips:[0.16,0.33,0.53],rot:[55,48,0],kneeL:[0.1,0.055,0.47],footL:[0.04,BALL,0.18,55,60],footR:[-0.08,BALL,0.34,55,45]}},
 {t:0.68,land:true,pose:{hips:[-0.06,0.35,0.7],rot:[75,35,0],handL:[-0.2,0.12,0.75],handR:[-0.22,0.24,0.72],footL:[-0.18,BALL,0.35,85,55],footR:[-0.26,BALL,0.8,85,55]}},
 {t:1,pose:{base:holdAt('ride','A',0,END)}}],B:[
 {t:0,pose:{base:holdAt('legsLowSingle','B',1)}},
 {t:0.35,pose:{hips:[-0.16,0.48,0.78],rot:[140,52,-12],footR:[0.12,0.24,0.44,160,40],handL:[0.25,0.18,0.65],handR:[0.18,0.32,0.42]}},
 {t:0.5,pose:{hips:[-0.26,0.35,0.86],rot:[110,62,-18],handL:[0.1,POST,0.64],handR:[0.12,0.17,0.95],footL:[-0.25,BALL,0.72,150,35],footR:[0.04,0.25,0.62,120,55],palms:[1,0]}},
 {t:0.68,land:true,pose:{hips:[-0.28,0.24,0.94],rot:[90,75,0,30],handL:[0.15,POST,0.72],handR:[0.15,POST,1.1],footL:[-0.1,0.07,1.15,90,70],footR:[-0.1,0.16,0.75,90,60]}},
 {t:1,pose:{base:holdAt('ride','B',0,END)}}],contacts:[
 {who:'B',hand:'R',on:'head',at:[0.08,0.10,-0.03],from:0,to:0.2,fade:0.08},
 {who:'B',hand:'L',on:'chest',at:[-0.1,0.12,-0.07],from:0,to:0.18,fade:0.08},
 {who:'A',hand:'L',on:'shinR',at:[0.035,-0.36,0.02],from:0,to:0.56,fade:0.09},
 {who:'A',hand:'R',on:'shinR',at:[-0.035,-0.31,-0.015],from:0,to:0.48,fade:0.09},
 {who:'A',hand:'R',on:'chest',at:[0.1,-0.08,0.08],from:0.66,to:0.8,fade:0.08},
 {who:'A',hand:'R',on:'spine',at:[0,0.02,0.11],from:0.9,to:1},
 {who:'A',hand:'L',on:'forearmL',at:[0,-0.04,-0.035],from:0.92,to:1}
]});
