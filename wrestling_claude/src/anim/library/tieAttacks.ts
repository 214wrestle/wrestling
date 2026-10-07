import {registerMove} from '../clips';
import {stanceAt,holdAt,BALL} from './kit';
const startA=stanceAt({x:0,z:-0.5,yaw:0},1);
const startB=stanceAt({x:0,z:0.5,yaw:180},1);
const end={x:0,z:0.4,yaw:180};
registerMove({id:'duckUnder',A:[{t:0,pose:{base:startA}},
 {t:0.35,pose:{hips:[-0.22,0.56,0],spine:[20,0,0],head:[-18,0,0],handL:[-0.16,1.1,0.4],footL:[-0.38,BALL,0.14,25,15]}},
 {t:0.65,pose:{hips:[-0.4,0.82,0.48],rot:[110,15,0],handR:[0.05,1,0.6],footR:[-0.35,BALL,0.7,120,20]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.4,pose:{handR:[-0.2,1.4,0.24],rot:[180,12,-12]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}]});
registerMove({id:'superDuck',A:[{t:0,pose:{base:startA}},
 {t:0.3,pose:{hips:[-0.38,0.3,-0.06],rot:[40,45,0],spine:[35,0,0],handL:[-0.32,0.15,0.15],footL:[-0.6,BALL,0.2,50,40]}},
 {t:0.65,pose:{hips:[-0.48,0.59,0.7],rot:[145,22,0],footL:[-0.65,BALL,0.75,140,25],handR:[0.1,0.85,0.6]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.4,pose:{hips:[0,0.94,0.58],rot:[180,8,-15]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}]});
registerMove({id:'slideBy',A:[{t:0,pose:{base:startA}},
 {t:0.32,pose:{hips:[0.38,0.9,0],rot:[-45,12,0],handL:[0,1.25,0.4],handR:[-0.1,1.1,0.42],footR:[0.5,BALL,0.17,-40,20]}},
 {t:0.65,pose:{hips:[0.45,0.85,0.58],rot:[-130,15,0],handR:[0,1,0.68],footL:[0.3,BALL,0.76,-140,20]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.45,pose:{hips:[-0.14,0.89,0.1],rot:[150,32,0],handL:[-0.2,1.05,-0.1]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}]});
registerMove({id:'firemansCarry',A:[{t:0,pose:{base:startA}},
 {t:0.3,pose:{hips:[0.05,0.42,0.14],rot:[-75,18,0],spine:[20,0,0],handL:[0.18,1.1,0.5],handR:[0.1,0.7,0.4],footR:[0.22,BALL,-0.1,-90,70]}},
 {t:0.55,pose:{hips:[0.06,0.67,0.28],rot:[-90,25,25],spine:[12,0,15]}},
 {t:0.8,land:true,pose:{hips:[-0.15,0.38,0.48],rot:[-150,65,0]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.55,pose:{hips:[0.12,1.1,0.25],rot:[180,88,35],footL:[-0.35,0.7,0.5,150,20],footR:[0.45,0.8,0.1,180,25]}},
 {t:0.8,land:true,pose:{hips:[0,0.25,0.55],rot:[180,75,0,110]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}]});
registerMove({id:'tieAttackCounter',A:[{t:0,pose:{base:startA}},{t:1,pose:{base:holdAt('fhl','B',0,{x:0,z:0.1,yaw:180})}}],B:[{t:0,pose:{base:startB}},{t:1,pose:{base:holdAt('fhl','A',0,{x:0,z:0.1,yaw:180})}}]});

// Upright ankle brush with an opposing upper-body pull, then follow to control.
registerMove({id:'footSweep',A:[{t:0,pose:{base:startA}},
 {t:0.22,pose:{hips:[-0.16,0.88,-0.12],rot:[-12,8,0],handL:[-0.16,1.25,0.35],handR:[0.2,1.12,0.34],footL:[-0.4,BALL,-0.3,0,0],elbowL:[-0.32,1.18,0.15],wristL:[0,0,90],look:0}},
 {t:0.46,pose:{hips:[-0.18,0.8,0.14],rot:[-30,10,-8],handL:[-0.3,1.22,0.2],handR:[0.05,1.1,0.22],footR:[0.28,0.12,0.6,35,15]}},
 {t:0.62,pose:{hips:[-0.37,0.72,0.18],rot:[-65,20,-10],footR:[-0.43,0.14,0.48,-40,20],handL:[-0.38,0.92,0.35],handR:[-0.1,0.8,0.4]}},
 {t:0.8,land:true,pose:{hips:[-0.12,0.45,0.4],rot:[-130,45,0],footL:[-0.4,BALL,0.55,-100,30]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},
 {t:0.22,pose:{hips:[0.1,0.92,0.45],rot:[170,8,0],footL:[0.26,BALL,0.37,180,0]}},
 {t:0.46,pose:{hips:[-0.02,0.87,0.45],rot:[160,8,-18],footL:[0.22,0.12,0.4,175,20]}},
 {t:0.62,pose:{hips:[-0.25,0.59,0.48],rot:[150,20,-55],footL:[-0.3,0.14,0.32,140,25],footR:[0.4,BALL,0.63,170,0]}},
 {t:0.8,land:true,pose:{hips:[-0.12,0.24,0.55],rot:[180,65,0,105]}},
 {t:1,pose:{base:holdAt('ride','B',0,end)}}],
 contacts:[
  {who:'A',hand:'L',on:'neck',at:[.08,0,-.03],from:.15,to:.56},
  // Defender peels at the collar-control wrist before balance is broken.
  {who:'B',hand:'R',on:'forearmL',at:[0,-.08,.02],from:.18,to:.57},
  {who:'A',hand:'R',on:'forearmL',at:[0,-.06,.025],from:.15,to:.78},
  {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.9,to:1},
  {who:'A',hand:'R',on:'spine',at:[0,.02,.11],from:.9,to:1},
 ]});
