import {registerMove} from '../clips';
import {stanceAt,holdAt,BALL,POST,PALM_DOWN} from './kit';
const startA=stanceAt({x:0,z:-0.5,yaw:0},1);
const startB=stanceAt({x:0,z:0.5,yaw:180},1);
const end={x:0,z:0.4,yaw:180};
registerMove({id:'duckUnder',A:[{t:0,pose:{base:startA}},
 {t:0.35,pose:{hips:[-0.22,0.56,0],spine:[20,0,0],head:[-18,0,0],handL:[-0.16,1.1,0.4],footL:[-0.38,BALL,0.14,25,15]}},
 {t:0.65,pose:{hips:[-0.4,0.82,0.48],rot:[110,15,0],handR:[0.05,1,0.6],footR:[-0.35,BALL,0.7,120,20]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.4,pose:{handR:[-0.2,1.4,0.24],rot:[180,12,-12]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 {who:'A',hand:'L',on:'forearmR',at:[0,-.08,.02],from:.12,to:.52,fade:.12},
 {who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.52,to:1,fade:.16},
 {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.86,to:1,fade:.12}
]});
registerMove({id:'superDuck',A:[{t:0,pose:{base:startA}},
 {t:0.3,pose:{hips:[-0.38,0.3,-0.06],rot:[40,45,0],spine:[35,0,0],handL:[-0.32,0.15,0.15],footL:[-0.6,BALL,0.2,50,40]}},
 {t:0.65,pose:{hips:[-0.48,0.59,0.7],rot:[145,22,0],footL:[-0.65,BALL,0.75,140,25],handR:[0.1,0.85,0.6]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.4,pose:{hips:[0,0.94,0.58],rot:[180,8,-15]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 // Secure rear cover after clearing the corner; carry both grips into the ride.
 {who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.72,to:1,fade:.18},
 {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.86,to:1,fade:.12}
]});
registerMove({id:'slideBy',A:[{t:0,pose:{base:startA}},
 {t:0.32,pose:{hips:[0.38,0.9,0],rot:[-45,12,0],handL:[0,1.25,0.4],handR:[-0.1,1.1,0.42],footR:[0.5,BALL,0.17,-40,20]}},
 {t:0.65,pose:{hips:[0.25,0.82,0.58],rot:[-130,20,0],handR:[-.02,.78,.49],elbowR:[.32,.91,.36],footL:[0.18,BALL,0.76,-140,20]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.45,pose:{hips:[-0.14,0.89,0.1],rot:[150,32,0],handL:[-0.2,1.05,-0.1]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 {who:'A',hand:'L',on:'armR',at:[0,-.16,.025],from:.12,to:.56,fade:.12},
 {who:'A',hand:'R',on:'forearmR',at:[0,-.12,.025],from:.12,to:.42,fade:.10},
 {who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.72,to:1,fade:.18},
 {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.86,to:1,fade:.12}
]});
registerMove({id:'firemansCarry',A:[{t:0,pose:{base:startA}},
 {t:0.3,pose:{hips:[0.05,0.42,0.14],rot:[-75,18,0],spine:[20,0,0],handL:[0.18,1.1,0.5],handR:[0.1,0.7,0.4],footR:[0.22,BALL,-0.1,-90,70]}},
 {t:0.55,pose:{hips:[0.06,0.67,0.28],rot:[-90,25,25],spine:[12,0,15]}},
 {t:0.8,land:true,pose:{hips:[-0.15,0.38,0.48],rot:[-150,65,0],handL:[.1,.55,.55],handR:[-.1,.45,.55],elbowL:[.25,.65,.35],elbowR:[-.35,.5,.35]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},{t:0.55,pose:{hips:[0.12,1.1,0.25],rot:[180,88,35],footL:[-0.35,0.7,0.5,150,20],footR:[0.45,0.8,0.1,180,25],handR:[-.20,1.08,.18],elbowR:[.01,.92,.20]}},
 {t:0.8,land:true,pose:{hips:[0,0.25,0.55],rot:[180,75,0,65],handL:[-.3,.18,.05],handR:[-.20,.28,.20],elbowL:[-.4,.36,.25],elbowR:[.06,.40,.22]}},
 {t:0.9,pose:{base:holdAt('ride','B',0,end),rot:[180,75,0,25]}},{t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 {who:'A',hand:'L',on:'armR',at:[0,-.24,.025],from:.22,to:.74,fade:.12},
 {who:'A',hand:'R',on:'thighR',at:[.02,-.24,.05],from:.28,to:.64,fade:.12}
]});
// Fireman's carry to the back (owner, November 11; Austin DeSanto "inside carry for 6", Earn Your Gold Medal
// zfsrEnyH3pM at 124-130 s): the same entry and carry across the shoulders, then he keeps turning and dumps him
// straight to his back, coming down chest to chest across him (the exposed hold the throws land in).
// Yaw 180 keeps his body pointing the way he is carried; 90 swung his legs a quarter turn across the mat as he landed.
export const CARRY_BACK_END={x:0,z:0.5,yaw:180};
registerMove({id:'firemansCarryBack',A:[{t:0,pose:{base:startA}},
 {t:0.3,pose:{hips:[0.05,0.42,0.14],rot:[-75,18,0],spine:[20,0,0],handL:[0.18,1.1,0.5],handR:[0.1,0.7,0.4],footR:[0.22,BALL,-0.1,-90,70]}},
 {t:0.55,pose:{hips:[0.06,0.67,0.28],rot:[-90,25,25],spine:[12,0,15]}},
 // Turning under him and following him down.
 {t:0.68,pose:{hips:[0.08,0.5,0.34],rot:[-110,50,10],spine:[16,0,6]}},
 {t:0.84,pose:{base:holdAt('exposed','A',0,CARRY_BACK_END)}},
 {t:1,pose:{base:holdAt('exposed','A',0,CARRY_BACK_END)}}],
 B:[{t:0,pose:{base:startB}},{t:0.55,pose:{hips:[0.12,1.1,0.25],rot:[180,88,35],footL:[-0.35,0.7,0.5,150,20],footR:[0.45,0.8,0.1,180,25],handR:[-.20,1.08,.18],elbowR:[.01,.92,.20]}},
 // Over the shoulders and turning to his back in the air.
 {t:0.66,pose:{hips:[0.1,0.82,0.42],rot:[180,90,0,110],footL:[-0.2,0.9,0.6,150,20],footR:[0.3,0.95,0.3,180,25],handL:[0.3,0.95,0.35],handR:[-0.25,1.0,0.3],elbowL:[0.55,0.9,0.3],elbowR:[-0.5,0.95,0.3]}},
 // Legs swinging down as his back comes to the mat (a hard ease here whipped the shin at 16 m/s).
 {t:0.76,pose:{hips:[0.05,0.42,0.5],rot:[180,90,0,118],footL:[-0.1,0.45,0.75,150,20],footR:[0.25,0.5,0.6,180,25],handL:[0.35,0.32,0.1],handR:[-0.3,0.55,0.22],elbowL:[0.6,0.2,0.2],elbowR:[-0.5,0.25,0.3]}},
 {t:0.86,pose:{base:holdAt('exposed','B',0,CARRY_BACK_END)}},
 {t:1,pose:{base:holdAt('exposed','B',0,CARRY_BACK_END)}}],contacts:[
 {who:'A',hand:'L',on:'armR',at:[0,-.24,.025],from:.22,to:.66,fade:.12},
 {who:'A',hand:'R',on:'thighR',at:[.02,-.24,.05],from:.28,to:.64,fade:.12},
 {who:'A',hand:'L',on:'neck',at:[0,.04,-.07],from:.78,to:1,fade:.2},
 {who:'A',hand:'R',on:'thighR',at:[0,-.2,.05],from:.82,to:1,fade:.1}
]});
registerMove({id:'tieAttackCounter',A:[{t:0,pose:{base:startA}},{t:1,pose:{base:holdAt('fhl','B',0,{x:0,z:0.1,yaw:180})}}],B:[{t:0,pose:{base:startB}},{t:1,pose:{base:holdAt('fhl','A',0,{x:0,z:0.1,yaw:180})}}],contacts:[
 {who:'B',hand:'L',on:'neck',at:[0,.02,.08],from:.22,to:1,fade:.16},
 {who:'B',hand:'R',on:'armL',at:[0,-.14,-.045],from:.30,to:1,fade:.16},
 {who:'A',hand:'R',on:'forearmL',at:[0,-.16,.04],from:.65,to:1,fade:.16}
]});

// Upright ankle brush with an opposing upper-body pull, then follow to control.
registerMove({id:'footSweep',A:[{t:0,pose:{base:startA}},
 {t:0.22,pose:{hips:[-0.16,0.88,-0.12],rot:[-12,8,0],handL:[-0.16,1.25,0.35],handR:[0.2,1.12,0.34],footL:[-0.4,BALL,-0.3,0,0],elbowL:[-0.32,1.18,0.15],wristL:[0,0,90],look:0}},
 {t:0.46,pose:{hips:[-0.18,0.8,0.14],rot:[-30,10,-8],handL:[-0.3,1.22,0.2],handR:[0.05,1.1,0.22],footR:[0.28,0.12,0.6,35,15]}},
 {t:0.62,pose:{hips:[-0.37,0.72,0.18],rot:[-65,20,-10],footR:[-0.43,0.14,0.48,-40,20],handL:[-0.38,0.92,0.35],handR:[-0.1,0.8,0.4]}},
 {t:0.8,land:true,pose:{hips:[-0.12,0.45,0.4],rot:[-130,45,0],handR:[-.1,.45,.55],elbowR:[-.35,.5,.35],footL:[-0.4,BALL,0.55,-100,30]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},
 {t:0.22,pose:{hips:[0.1,0.92,0.45],rot:[170,8,0],footL:[0.26,BALL,0.37,180,0]}},
 {t:0.46,pose:{hips:[-0.02,0.87,0.45],rot:[160,8,-18],footL:[0.22,0.12,0.4,175,20]}},
 {t:0.62,pose:{hips:[-0.25,0.59,0.48],rot:[150,20,-55],footL:[-0.3,0.14,0.32,140,25],footR:[0.4,BALL,0.63,170,0]}},
 {t:0.8,land:true,pose:{hips:[-0.12,0.24,0.55],rot:[180,65,0,65],handL:[-.3,.18,.05],handR:[.32,.28,.04],elbowL:[-.4,.36,.25],elbowR:[.43,.42,.25]}},
 {t:0.9,pose:{base:holdAt('ride','B',0,end),rot:[180,75,0,25]}},
 {t:1,pose:{base:holdAt('ride','B',0,end)}}],
 contacts:[
  {who:'A',hand:'L',on:'neck',at:[.08,0,-.03],from:.15,to:.56},
  // Defender peels at the collar-control wrist before balance is broken.
  {who:'B',hand:'R',on:'forearmL',at:[0,-.08,.02],from:.18,to:.57},
  {who:'A',hand:'R',on:'forearmL',at:[0,-.06,.025],from:.15,to:.78},
  {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.9,to:1},
 ]});

// Ankle pick off the collar tie (reference: David Taylor, "Outside Step Outside Reach Ankle
// Pick", 194gqX41S0Q, 1:54 to 2:08). Pull the head so he steps up on his lead foot, step
// outside it, drop and take the heel while the tie hand shoves the head back; he sits down.
registerMove({id:'anklePick',A:[{t:0,pose:{base:startA}},
 {t:0.2,pose:{hips:[-0.05,0.86,-0.42],rot:[-5,14,0],spine:[8,0,0]}},
 {t:0.42,pose:{hips:[-0.24,0.5,-0.08],rot:[-25,42,0],spine:[22,0,0],head:[-25,-10,0],footR:[-0.46,BALL,0.08,-25,30],footL:[0.12,BALL,-0.5,0,95]}},
 {t:0.58,pose:{hips:[-0.2,0.46,0.05],rot:[-10,48,0],spine:[26,0,0],footL:[0.1,BALL,-0.42,0,100]}},
 {t:0.78,land:true,pose:{hips:[-0.2,0.52,0.32],rot:[20,55,0],spine:[24,0,0],footR:[-0.5,BALL,0.3,10,40],footL:[0.08,BALL,-0.2,10,90]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},
 {t:0.2,pose:{hips:[0,0.9,0.42],rot:[180,18,0],spine:[14,0,0],head:[10,0,0],footL:[-0.17,BALL,0.3,180,10]}},
 {t:0.42,pose:{hips:[-0.02,0.88,0.44],rot:[180,16,0]}},
 {t:0.58,pose:{hips:[0.02,0.62,0.62],rot:[180,-20,0],spine:[-10,0,0],footL:[-0.15,0.3,0.36,180,10],footR:[0.18,BALL,0.62,180,20],handL:[-0.3,0.5,0.85],handR:[0.3,0.5,0.85]}},
 {t:0.74,land:true,pose:{hips:[0,0.2,0.78],rot:[180,-45,0],footL:[-0.15,0.32,0.32,180,10],footR:[0.2,BALL,0.42,180,20],handL:[-0.28,POST,0.98],handR:[0.28,POST,0.98],wristL:PALM_DOWN,wristR:PALM_DOWN}},
 {t:0.88,pose:{hips:[0,0.42,0.5],rot:[180,60,0],spine:[6,0,0]}},
 {t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 {who:'A',hand:'L',on:'neck',at:[0,.045,-.07],from:0,to:.56,fade:.1},
 {who:'A',hand:'R',on:'shinL',at:[0,-.36,.02],from:.4,to:.8,fade:.1},
 {who:'A',hand:'L',on:'thighL',at:[0,-.2,.06],from:.56,to:.86,fade:.12},
 {who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.82,to:1,fade:.14},
 {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.88,to:1,fade:.1},
]});

// Knee pick off the underhook (reference: Isaiah Martinez, "Underhook to a Far Knee Pick",
// cna5d3Bg5Ik, 0:25 to 0:37). The underhook lifts his near shoulder so his weight goes onto the
// far leg; step across, drop and pull that knee, and he tips onto his hip and back.
registerMove({id:'kneePick',A:[{t:0,pose:{base:startA}},
 {t:0.25,pose:{hips:[-0.08,0.8,-0.3],rot:[-15,20,0],spine:[10,0,-8],footR:[-0.25,BALL,-0.05,-20,20]}},
 {t:0.45,pose:{hips:[-0.22,0.6,0.0],rot:[-30,38,0],spine:[20,0,0],head:[-15,-10,0],footR:[-0.42,BALL,0.12,-30,35],footL:[0.15,BALL,-0.42,-10,80]}},
 {t:0.65,land:true,pose:{hips:[-0.22,0.52,0.3],rot:[-10,55,0],spine:[24,0,0],footR:[-0.5,BALL,0.35,-20,50],footL:[0.1,BALL,-0.15,0,95]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},
 {t:0.25,pose:{hips:[-0.04,0.9,0.45],rot:[180,8,-12],spine:[6,0,-10],handR:[0.3,1.25,0.3]}},
 {t:0.45,pose:{hips:[-0.12,0.72,0.55],rot:[195,-15,-25],footL:[-0.2,0.25,0.35,180,10],handL:[-0.5,0.6,0.7],handR:[0.25,0.75,0.55]}},
 {t:0.62,land:true,pose:{hips:[-0.2,0.2,0.65],rot:[200,-50,-30],handL:[-0.45,POST,0.85],handR:[0.15,0.35,0.75],wristL:PALM_DOWN,footL:[-0.15,0.3,0.25,180,10],footR:[0.2,BALL,0.35,180,20]}},
 {t:0.82,pose:{hips:[-0.05,0.42,0.48],rot:[180,60,0],spine:[6,0,0]}},
 {t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 {who:'A',hand:'L',on:'chest',at:[-.12,.1,-.1],from:0,to:.55,fade:.1},
 {who:'A',hand:'R',on:'thighL',at:[0,-.36,.05],from:.3,to:.72,fade:.1},
 {who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.8,to:1,fade:.14},
 {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.86,to:1,fade:.1},
]});

// Throw-by off the underhook: lift the underhook arm, pull him past and step behind.
registerMove({id:'throwBy',A:[{t:0,pose:{base:startA}},
 {t:0.3,pose:{hips:[0.3,0.88,-0.05],rot:[-40,14,0],handL:[0.05,1.3,0.35],footR:[0.45,BALL,0.12,-40,20]}},
 {t:0.62,pose:{hips:[0.25,0.82,0.55],rot:[-125,20,0],footL:[0.18,BALL,0.74,-140,20]}},
 {t:1,pose:{base:holdAt('ride','A',0,end)}}],
 B:[{t:0,pose:{base:startB}},
 {t:0.4,pose:{hips:[-0.18,0.86,0.05],rot:[145,34,0],handR:[-0.35,1.0,-0.15],footL:[-0.35,BALL,-0.05,140,15]}},
 {t:1,pose:{base:holdAt('ride','B',0,end)}}],contacts:[
 {who:'A',hand:'L',on:'chest',at:[-.12,.1,-.1],from:0,to:.42,fade:.1},
 {who:'A',hand:'R',on:'forearmR',at:[0,-.12,.025],from:.1,to:.4,fade:.1},
 {who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.66,to:1,fade:.16},
 {who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.84,to:1,fade:.12},
]});

// Lateral drop off a body lock (Keep Kids Wrestling body lock guide; Fanatic Wrestling, pinched-elbow
// lateral drop): hands locked behind his back, step in under his hips, lift, arch and turn to the left,
// landing chest to chest with him on his back.
const dropEnd={x:0.3,z:0.25,yaw:90};
registerMove({id:'lateralDrop',A:[{t:0,pose:{base:startA}},
 {t:0.22,pose:{hips:[0,0.78,-0.2],rot:[0,10,0],spine:[6,0,0],head:[-10,0,0],footL:[0.2,BALL,-0.16,10,10],footR:[-0.1,BALL,0.02,-10,10]}},
 {t:0.42,pose:{hips:[0.08,0.84,-0.12],rot:[-20,-24,-16],spine:[-16,0,-12],head:[-24,0,0],footL:[0.26,BALL,-0.22,20,0],footR:[-0.08,BALL,0.0,-20,10]}},
 {t:0.54,pose:{hips:[0.22,0.6,-0.08],rot:[-30,-6,-48],spine:[-8,0,-20],head:[-20,0,0]}},
 {t:0.66,land:true,pose:{base:holdAt('exposed','A',0,dropEnd)}},
 {t:1,pose:{base:holdAt('exposed','A',0,dropEnd)}}],
 // Feet flying (owner, November 11: "I'd love to see feet flying through the air on throws"): lifted clear, then
 // turned well past sideways over the arch so his legs go up past the thrower's head before he lands on his back. His
 // feet only reached 0.3 m on the lift and 0.7 m at the turn.
 B:[{t:0,pose:{base:startB}},
 {t:0.22,pose:{hips:[0,0.86,0.2],rot:[180,6,0],spine:[4,0,0]}},
 {t:0.4,pose:{hips:[0.06,1.12,0.12],rot:[180,-8,35],footL:[0.18,0.5,0.3,180,0],footR:[-0.1,0.42,0.28,180,0]}},
 // Arms already reaching for where they land (the landing pose's arms), so they do not whip there on impact.
 {t:0.52,pose:{base:holdAt('exposed','B',0,dropEnd),hips:[0.2,1.06,0.14],rot:[180,-6,118],spine:[4,0,0],head:[0,0,0],footL:[-0.25,1.55,0.26,180,0],footR:[-0.4,1.45,0.2,180,0]}},
 // Legs on the way down just before he lands.
 {t:0.6,pose:{base:holdAt('exposed','B',0,dropEnd),hips:[0.26,0.6,0.14],rot:[180,-6,115],spine:[4,0,0],head:[0,0,0],footL:[-0.4,0.85,0.26,180,0],footR:[-0.55,0.75,0.2,180,0]}},
 {t:0.66,land:true,pose:{base:holdAt('exposed','B',0,dropEnd)}},
 {t:1,pose:{base:holdAt('exposed','B',0,dropEnd)}}],contacts:[
 {who:'A',hand:'L',on:'spine',at:[.04,0,-.13],from:0,to:.6,fade:.1},
 {who:'A',hand:'R',on:'spine',at:[-.04,0,-.13],from:0,to:.6,fade:.1},
]});

// Headlock off his underhook (over-under hip toss; Jitsu IQ hip toss). Left arm round his head, right
// hand on his right wrist and forearm; turn your back into him with your hips under his, bend and throw him over the
// left hip so he lands on his back in front of you, and come down chest to chest on top of him.
// Landing frame yaw 270 (not -90): his facing turns a clean 90 degrees from 180, with no spin.
const headlockEnd={x:0.08,z:-0.62,yaw:270};
registerMove({id:'headlockThrow',A:[{t:0,pose:{base:startA}},
 // Turn in: back to his chest, hips under his, knees bent.
 {t:0.22,pose:{hips:[0.04,0.76,0.16],rot:[175,8,0],spine:[6,0,0],head:[-6,0,0],
   footL:[-0.14,BALL,0.2,175,10],footR:[0.2,BALL,0.12,170,10]}},
 // Load and throw: bend over, his weight comes onto the hip.
 {t:0.42,pose:{hips:[0.02,0.66,0.08],rot:[178,42,-8],spine:[24,0,-6],head:[12,0,0]}},
 // Follow him down, turning onto him.
 {t:0.56,pose:{hips:[0.0,0.5,-0.12],rot:[180,68,0],spine:[14,0,0],head:[0,0,0]}},
 {t:0.68,land:true,pose:{base:holdAt('exposed','A',0,headlockEnd)}},
 {t:1,pose:{base:holdAt('exposed','A',0,headlockEnd)}}],
 B:[{t:0,pose:{base:startB}},
 // Pulled onto his back, chest to the thrower's back, head over the left shoulder.
 {t:0.22,pose:{hips:[0,0.9,0.36],rot:[180,18,0],spine:[16,0,6],head:[20,0,0]}},
 // Over the hip: feet off the mat, body tipping over the thrower.
 {t:0.42,pose:{hips:[-0.02,1.16,0.12],rot:[200,62,0,30],footL:[0.12,0.95,0.55,180,0],footR:[0.24,1.05,0.5,180,0]}},
 // Feet flying (owner, November 11): at the top his legs go up over the thrower's head (1.65-1.75 m; they reached
 // 0.95 m), before he comes down on his back.
 {t:0.5,pose:{hips:[0.02,1.12,-0.08],rot:[230,80,0,95],footL:[0.2,1.75,0.3,230,0],footR:[0.32,1.65,0.2,230,0]}},
 // Upside over, on his back in the air in front of the thrower, then down.
 // Arms already reaching for where they land, so they do not whip there on impact.
 {t:0.58,pose:{base:holdAt('exposed','B',0,headlockEnd),hips:[0.04,0.82,-0.36],rot:[250,86,0,150],spine:[0,0,0],footL:[0.3,0.95,-0.2,250,0],footR:[0.42,0.85,-0.36,250,0]}},
 {t:0.68,land:true,pose:{base:holdAt('exposed','B',0,headlockEnd)}},
 {t:1,pose:{base:holdAt('exposed','B',0,headlockEnd)}}],contacts:[
 {who:'A',hand:'L',on:'neck',at:[0,.04,-.07],from:.1,to:.72,fade:.1},
 // His right hand controls the wrist and forearm through the turn. On the upper arm it was out of comfortable
 // reach once his back turned in, and the arm snapped across in two frames (16-21 m/s at 30%).
 {who:'A',hand:'R',on:'forearmR',at:[0,-.08,.025],from:.05,to:.5,fade:.1},
]});

// Whizzer kick-out (reference: "The Whizzer Kick | Single Leg Defense", S1rUJQXhnoY, 0:56 to
// 1:16). Armpit heavy on his shoulder, he drives it down, lifts the heel high and hops the leg
// free in a circle; the shooter goes to his hands and both come back up to their stance.
registerMove({id:'whizzerKick',A:[{t:0,pose:{base:holdAt('legsSingle','A',0)}},
 {t:0.3,pose:{hips:[0.28,0.6,0.08],rot:[-40,50,0],spine:[22,0,0]}},
 {t:0.5,land:true,pose:{hips:[0.24,0.44,0.1],rot:[-40,62,0],spine:[25,0,0],handL:[0.36,POST,0.5],handR:[0.06,POST,0.38],wristL:PALM_DOWN,wristR:PALM_DOWN}},
 {t:0.75,pose:{hips:[0.12,0.72,-0.25],rot:[-15,30,0],spine:[14,0,0]}},
 {t:1,pose:{base:stanceAt({x:0,z:-0.5,yaw:0},1)}}],
 B:[{t:0,pose:{base:holdAt('legsSingle','B',0)}},
 {t:0.3,pose:{hips:[-0.02,0.84,0.45],rot:[200,22,15],spine:[20,0,15],footR:[0.25,0.45,0.85,170,40]}},
 {t:0.55,pose:{hips:[0,0.86,0.62],rot:[190,15,5],footR:[0.3,BALL,0.85,170,20]}},
 {t:1,pose:{base:stanceAt({x:0,z:0.65,yaw:180},1)}}],contacts:[
 {who:'B',hand:'R',on:'armL',at:[0,-.07,-.045],from:0,to:.5,fade:.12},
 {who:'B',hand:'L',on:'head',at:[0,.1,-.04],from:0,to:.4,fade:.12},
]});
