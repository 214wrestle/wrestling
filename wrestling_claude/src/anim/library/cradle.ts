import {registerHold,registerMove} from '../clips';
import {holdAt,BALL} from './kit';
// Near-side head-to-knee cradle: both hands stay on the head/near leg while
// the defender's near knee is folded up. The far leg remains free to bridge.
registerHold({id:'cradleHold',A:[
 {base:holdAt('exposed','A',0),hips:[-0.42,0.25,0.05],rot:[0,86,0],spine:[8,0,0],head:[-8,-10,0],footL:[-0.65,BALL,-0.7,-15,80],footR:[-0.1,BALL,-0.75,15,80],kneeL:[-0.62,0.06,-0.3],kneeR:[-0.1,0.06,-0.35],elbowL:[-0.16,0.12,0.65],elbowR:[-0.62,0.2,0.4],wristL:[-20,0,40],wristR:[-20,0,-40]},
 {hips:[-0.4,0.23,0.08],spine:[12,0,0]}],B:[
 {base:holdAt('exposed','B',0),hips:[0,0.19,0.02],rot:[0,90,0,150],spine:[4,0,0],head:[-20,0,0],kneeL:[-0.05,0.24,0.42],footL:[0,BALL,-0.12,160,0],kneeR:[0.3,0.7,-0.35],footR:[0.24,BALL,-0.5,200,0]},
 {hips:[0,0.17,0.02],rot:[0,90,0,170],spine:[6,0,0]}],
 contacts:[{who:'A',hand:'L',on:'neck',at:[0.04,0,-0.07],claspFrom:0},{who:'A',hand:'R',on:'shinL',at:[0,0.1,0.025],claspFrom:0},{who:'B',hand:'L',on:'forearmL',at:[0,-0.16,0.025]},{who:'B',hand:'R',on:'handL',at:[0,-0.02,0.025]}],struggle:{A:0.45,B:0.7},tempo:1.5});
registerMove({id:'cradle',A:[{t:0,pose:{base:holdAt('flat','A',0)}},
 {t:0.3,pose:{hips:[-0.2,0.4,0.05],rot:[0,55,0],spine:[30,0,0]}},
 {t:0.5,pose:{hips:[-0.42,0.34,0.08],rot:[0,65,0],spine:[20,0,0]}},
 {t:0.7,pose:{hips:[-0.42,0.28,0.08],rot:[0,80,0],spine:[12,0,0]}},
 {t:1,pose:{base:holdAt('cradleHold','A',0)}}],B:[{t:0,pose:{base:holdAt('flat','B',0)}},
 {t:0.3,pose:{hips:[0,0.33,0],spine:[25,0,0],kneeL:[-0.05,0.24,0.42],footL:[0,BALL,-0.12,160,0]}},
 {t:0.5,pose:{hips:[0,0.28,0.02],rot:[0,90,0,35],spine:[20,0,0],head:[-20,0,0]}},
 {t:0.7,pose:{hips:[0,0.2,0.02],rot:[0,90,0,115],spine:[4,0,0]}},
 {t:1,pose:{base:holdAt('cradleHold','B',0)}}],contacts:[
 {who:'A',hand:'L',on:'neck',at:[0.04,0,-0.07],from:0.2,to:1,claspFrom:0.5},
 {who:'A',hand:'R',on:'shinL',at:[0,0.1,0.025],from:0.2,to:1,claspFrom:0.5},
 {who:'B',hand:'L',on:'forearmL',at:[0,-0.16,0.025],from:0.6,to:1},
 {who:'B',hand:'R',on:'handL',at:[0,-0.02,0.025],from:0.6,to:1}]});
