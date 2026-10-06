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
