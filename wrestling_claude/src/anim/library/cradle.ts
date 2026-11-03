import {CRADLE_GRIP_RELEASE} from '../../sim/moves';
import {registerHold,registerMove} from '../clips';
import {holdAt,BALL} from './kit';
// Near-side head-to-knee cradle: both hands stay on the head/near leg while
// the defender's near knee is folded up. The far leg remains free to bridge.
registerHold({id:'cradleHold',A:[
 {base:holdAt('exposed','A',0),hips:[0.24,0.30,0.36],rot:[-90,86,0],spine:[8,0,0],head:[-8,-10,0],footL:[0.95,BALL,0.02,90,80],footR:[0.95,BALL,0.72,90,80],kneeL:[0.6,0.06,0.1],kneeR:[0.6,0.06,0.65],elbowL:[0.02,0.1,0.72],elbowR:[0.02,0.08,0.25],wristL:[-20,0,40],wristR:[-20,0,-40]},
 {hips:[0.22,0.28,0.36],spine:[12,0,0]}],B:[
 {base:holdAt('exposed','B',0),hips:[0,0.19,0.02],rot:[0,90,0,150],spine:[4,0,0],head:[-20,0,0],kneeL:[-0.05,0.24,0.42],footL:[0,BALL,-0.12,160,0],kneeR:[0.3,0.7,-0.35],footR:[0.24,BALL,-0.5,200,0]},
 {hips:[0,0.17,0.02],rot:[0,90,0,170],spine:[6,0,0]}],
 contacts:[{who:'A',hand:'L',on:'neck',at:[0.04,0,-0.07],claspFrom:0},{who:'A',hand:'R',on:'shinL',at:[0,0.1,0.025],claspFrom:0},{who:'B',hand:'L',on:'forearmL',at:[0,-0.16,0.055],palm:true},{who:'B',hand:'R',on:'handL',at:[0,-0.02,0.035],palm:true}],struggle:{A:0.45,B:0.7},tempo:1.5});
registerMove({id:'cradle',A:[{t:0,pose:{base:holdAt('flat','A',0)}},
 {t:0.3,pose:{hips:[0.04,0.42,0.12],rot:[-25,55,0],spine:[25,0,0]}},
 {t:0.5,pose:{hips:[0.18,0.36,0.24],rot:[-60,65,0],spine:[18,0,0],footL:[0.75,BALL,0.02,70,80],footR:[0.8,BALL,0.7,70,80],kneeL:[0.45,0.08,0.1],kneeR:[0.5,0.08,0.62],elbowL:[0.02,0.1,0.72],elbowR:[0.02,0.08,0.25]}},
 {t:0.7,pose:{hips:[0.24,0.31,0.34],rot:[-85,80,0],spine:[12,0,0]}},
 {t:1,pose:{base:holdAt('cradleHold','A',0)}}],B:[{t:0,pose:{base:holdAt('flat','B',0)}},
 {t:0.3,pose:{hips:[0,0.33,0],spine:[25,0,0],kneeL:[-0.05,0.24,0.42],footL:[0,BALL,-0.12,160,0]}},
 {t:0.5,pose:{hips:[0,0.28,0.02],rot:[0,90,0,35],spine:[20,0,0],head:[-20,0,0]}},
 {t:0.7,pose:{hips:[0,0.2,0.02],rot:[0,90,0,115],spine:[4,0,0]}},
 {t:1,pose:{base:holdAt('cradleHold','B',0)}}],contacts:[
 {who:'A',hand:'L',on:'neck',at:[0.04,0,-0.07],from:0.2,to:1,claspFrom:0.5},
 {who:'A',hand:'R',on:'shinL',at:[0,0.1,0.025],from:0.2,to:1,claspFrom:0.5},
 {who:'B',hand:'L',on:'forearmL',at:[0,-0.16,0.055],palm:true,from:0.6,to:1},
 {who:'B',hand:'R',on:'handL',at:[0,-0.02,0.035],palm:true,from:0.6,to:1}]});

// Win the hand fight first, then extend the trapped leg and turn belly-down.
registerMove({id:'cradleFightOff',A:[
 {t:0,pose:{base:holdAt('cradleHold','A',0)}},
 {t:.2,pose:{hips:[.25,.33,.36],spine:[8,0,0]}},
 {t:.38,pose:{handL:[.03,.24,.65],handR:[.06,.20,.30],hips:[.24,.38,.25]}},
 {t:.68,pose:{hips:[.10,.40,-.10],rot:[-30,70,0],spine:[18,0,0],handL:[-.12,.12,.46],handR:[.15,.26,.12]}},
 {t:1,pose:{base:holdAt('flat','A',.3)}}],B:[
 {t:0,pose:{base:holdAt('cradleHold','B',0)}},
 {t:.18,pose:{hips:[0,.23,.02],spine:[0,0,0]}},
 {t:.4,pose:{footL:[-.08,.10,-.40,170,0],kneeL:[-.08,.24,.12],rot:[0,90,0,115],handL:[-.10,.22,.60],handR:[.10,.20,.52]}},
 {t:.7,pose:{hips:[0,.27,.01],rot:[0,86,0,45],spine:[15,0,0],handL:[-.23,.07,.53],handR:[.23,.07,.53],footL:[-.15,BALL,-.65,180,20]}},
 {t:1,pose:{base:holdAt('flat','B',.5)}}],contacts:[
 {who:'A',hand:'L',on:'neck',at:[.04,0,-.07],from:0,to:CRADLE_GRIP_RELEASE-.025,fade:.025,claspFrom:0},
 {who:'A',hand:'R',on:'shinL',at:[0,.1,.025],from:0,to:CRADLE_GRIP_RELEASE-.025,fade:.025,claspFrom:0},
 {who:'B',hand:'L',on:'forearmL',at:[0,-.16,.055],palm:true,from:0,to:.28,fade:.025},
 {who:'B',hand:'R',on:'handL',at:[0,-.02,.035],palm:true,from:0,to:.28,fade:.025},
 {who:'A',hand:'R',on:'hips',at:[-.13,.02,0],from:.78,to:1}]});

// Keep the cradle through the fall instead of switching to an unrelated pin.
registerMove({id:'cradleFall',A:[
 {t:0,pose:{base:holdAt('cradleHold','A',1)}},
 {t:.32,pose:{hips:[.22,.26,.36],spine:[12,0,0]}},
 {t:1,stop:true,pose:{hips:[.22,.26,.36]}}],B:[
 {t:0,pose:{base:holdAt('cradleHold','B',1)}},
 {t:.32,pose:{hips:[0,.15,.02],rot:[0,90,0,178]}},
 {t:1,stop:true,pose:{hips:[0,.15,.02],rot:[0,90,0,178]}}],contacts:[
 {who:'A',hand:'L',on:'neck',at:[.04,0,-.07],from:0,to:1,claspFrom:0},
 {who:'A',hand:'R',on:'shinL',at:[0,.1,.025],from:0,to:1,claspFrom:0},
 {who:'B',hand:'L',on:'forearmL',at:[0,-.16,.055],palm:true,from:0,to:1},
 {who:'B',hand:'R',on:'handL',at:[0,-.02,.035],palm:true,from:0,to:1}]});
