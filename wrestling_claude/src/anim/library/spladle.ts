import { registerHold, registerMove } from '../clips';
import { holdAt } from './kit';
// Defender sits behind the shot, splits the attacker's legs and folds the
// trapped attacker toward his shoulders. Role A is the holder in the hold.
registerHold({
 id:'spladle',
 A:[{hips:[0.28,0.2,0.02],rot:[-90,70,0],spine:[18,0,0],head:[-12,0,0],
   footL:[-0.27,0.16,-0.18,-60,30],footR:[0.38,0.12,0.54,-90,30],
   kneeL:[-0.16,0.45,0.03],kneeR:[0.32,0.4,0.26],
   handL:[-0.12,0.42,0.18],handR:[0.15,0.4,0.23]},
   {hips:[0.24,0.19,0.02],spine:[22,0,0]}],
 B:[{hips:[0,0.37,-0.04],rot:[0,80,0,150],spine:[42,0,0],head:[-25,0,0],
   footL:[-0.26,0.24,0.49,0,25],footR:[0.31,0.2,0.4,0,25],
   kneeL:[-0.28,0.56,0.2],kneeR:[0.3,0.57,0.17],
   handL:[-0.22,0.08,0.37],handR:[0.25,0.08,0.38]},
   {hips:[0,0.29,-0.04],rot:[0,86,0,174],spine:[50,0,0]}],
 contacts:[{who:'A',hand:'L',on:'shinL',at:[0,0.12,0]},
   {who:'A',hand:'R',on:'thighR',at:[0,-0.15,0]}],
 struggle:{A:0.25,B:0.35},tempo:1,
});
// Roles remain those of the original leg battle until the counter wins control.
registerMove({id:'spladleCounter',
 A:[{t:0,pose:{base:holdAt('legsSingle','A',0.4)}},
   {t:0.5,pose:{hips:[0.04,0.48,0.12],rot:[0,72,0,80],spine:[30,0,0]}},
   {t:1,pose:{base:holdAt('spladle','B',0)}}],
 B:[{t:0,pose:{base:holdAt('legsSingle','B',0.4)}},
   {t:0.5,pose:{hips:[0.28,0.35,0.1],rot:[-70,60,0],spine:[22,0,0]}},
   {t:1,pose:{base:holdAt('spladle','A',0)}}],
});
