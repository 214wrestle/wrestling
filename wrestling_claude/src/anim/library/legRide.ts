import {registerHold} from '../clips';
import {holdAt,BALL,POST} from './kit';
registerHold({id:'legRide',A:[
 {base:holdAt('ride','A',0),hips:[0.28,0.5,-0.14],kneeL:[0.4,0.2,0.15],footL:[0.35,0.12,-0.1,0,35]},
 {hips:[0.12,0.59,-0.14],rot:[-8,32,0],kneeL:[0.26,0.34,0.1],footL:[0.08,0.25,0.21,0,45],footR:[0.3,BALL,-0.48,0,65],handL:[0.17,0.36,0.34],handR:[-0.08,0.4,0.03]}],
 B:[{base:holdAt('ride','B',0)},{hips:[0,0.44,-0.02],handL:[0.16,POST,0.4],handR:[-0.16,POST,0.4],elbowL:[0.2,0.26,0.2],elbowR:[-0.2,0.26,0.2]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-0.02,0]},{who:'A',hand:'R',on:'hips',at:[-0.08,0.02,0.08]}],struggle:{A:0.6,B:0.8},tempo:1.5});
registerHold({id:'closedPockets',A:[{base:holdAt('ride','A',0)},{base:holdAt('ride','A',0)}],
 B:[{base:holdAt('ride','B',0)},{base:holdAt('ride','B',0),handL:[0.12,0.28,0.16],handR:[-0.12,0.28,0.16],elbowL:[0.17,0.3,-0.02],elbowR:[-0.17,0.3,-0.02]}],struggle:{A:0.5,B:0.5},tempo:1.4});
registerHold({id:'catchRidingLeg',A:[{base:holdAt('legRide','A',1)},{base:holdAt('legRide','A',1),footL:[0.21,0.31,0.12,0,45]}],
 B:[{base:holdAt('legRide','B',1)},{base:holdAt('legRide','B',1),handL:[0.16,0.3,0.09],elbowL:[0.12,0.26,-0.01],handR:[-0.18,POST,0.4]}],
 contacts:[{who:'B',hand:'L',on:'shinL',at:[-0.025,-0.18,0.02]}],struggle:{A:0.8,B:1},tempo:1.5});
