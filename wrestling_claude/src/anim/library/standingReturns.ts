import { registerMove } from '../clips';
import { BALL, POST, holdAt } from './kit';

// Rear trip: block the ankle and rotate the waist without lifting both feet.
registerMove({
  id: 'standingTrip',
  A: [
    {t:0,pose:{base:holdAt('standing','A',0)}},
    {t:.4,pose:{hips:[.12,.78,-.28],rot:[0,22,0],spine:[14,0,0],footL:[.3,BALL,.12,0,0],footR:[-.25,BALL,-.35,0,0]}},
    {t:.7,land:true,pose:{hips:[.15,.48,-.15],rot:[-12,55,0],spine:[22,-12,0],handL:[.24,.3,.42],elbowL:[.48,.45,.2]}},
    {t:1,pose:{base:holdAt('ride','A',.2,{x:0,z:.05,yaw:0})}},
  ],
  B: [
    {t:0,pose:{base:holdAt('standing','B',0),palms:[1,1]}},
    {t:.4,pose:{hips:[.12,.78,.1],rot:[-15,25,0],footL:[.2,BALL,.1,0,0],footR:[-.16,BALL,0,0,0]}},
    {t:.60,pose:{hips:[.12,.54,.08],rot:[-20,60,0],spine:[6,0,0],handL:[.3,POST,.4],handR:[-.15,POST,.45]}},
    {t:.7,land:true,pose:{hips:[.12,.43,.06],rot:[-20,70,0],handL:[.3,POST,.4],handR:[-.15,POST,.45],palms:[1,1]}},
    {t:1,pose:{base:holdAt('ride','B',.4,{x:0,z:.05,yaw:0})}},
  ],
  contacts:[{who:'A',hand:'L',on:'spine',at:[.04,0,.13],from:0,to:.60,fade:.08},{who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:0,to:1},{who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.94,to:1,fade:.23}],
});

// Crotch lift: squat, scoop inside the thigh, elevate, then guide down to a ride.
registerMove({
  id:'crotchLift',
  A:[
    {t:0,pose:{base:holdAt('standing','A',0)}},
    {t:.25,pose:{hips:[0,.58,-.27],spine:[20,0,0],footL:[.23,BALL,-.25,10,0],footR:[-.23,BALL,-.35,-10,0],kneeL:[.3,.35,.08],kneeR:[-.3,.35,-.02]}},
    // Arched back under him at the top of the lift (the mat return's swing, mirrored to the scooped side).
    {t:.5,pose:{hips:[-.04,.88,-.2],rot:[18,2,0],spine:[-10,12,0],head:[-10,0,0],footL:[.23,BALL,-.25,10,0],footR:[-.23,BALL,-.35,-10,0],kneeL:[.3,.5,.08],kneeR:[-.3,.5,-.02]}},
    {t:.72,land:true,pose:{hips:[.1,.5,-.15],rot:[-10,55,0],spine:[24,-8,0],handL:[.24,.3,.42],elbowL:[.48,.45,.2]}},
    {t:1,pose:{base:holdAt('ride','A',.2,{x:0,z:.05,yaw:0})}},
  ],
  B:[
    {t:0,pose:{base:holdAt('standing','B',0),palms:[1,1]}},
    {t:.25,pose:{hips:[0,.8,.05],spine:[12,0,0]}},
    // Up high on the scoop, then driven straight down to his hips and chest (owner, November 10: with authority).
    // Tipped nearly horizontal at the top, legs out to the scooped side at the rider's head height (video review,
    // November 11: DPS "50 Mat Returns @ 2023 NCAA's", CpvYR02LFmc at 100 s, Robb v Hill). He used to go straight up
    // and stay upright, feet half a metre off the mat.
    {t:.4,pose:{hips:[0,1.2,.05],rot:[0,10,-6],footL:[.24,.5,.2,0,30],footR:[-.2,.44,.02,0,30]}},
    {t:.52,pose:{hips:[.08,1.16,.04],rot:[34,38,-48],footL:[.74,.95,.16,10,40],footR:[.5,.84,.3,-10,40]}},
    {t:.64,pose:{hips:[0,.62,.06],rot:[0,66,0],spine:[6,0,0],handL:[.24,POST+.08,.42],handR:[-.24,POST+.08,.42]}},
    {t:.72,land:true,pose:{hips:[0,.34,.05],rot:[0,82,0],spine:[-6,0,0],handL:[.26,POST,.42],handR:[-.24,POST,.42],palms:[1,1]}},
    {t:.84,pose:{hips:[0,.4,.05],rot:[0,76,0],handL:[.24,POST,.42],handR:[-.24,POST,.42],palms:[1,1]}},
    {t:1,pose:{base:holdAt('ride','B',.4,{x:0,z:.05,yaw:0})}},
  ],
  contacts:[{who:'A',hand:'L',on:'spine',at:[.04,0,.13],from:0,to:.60,fade:.08},{who:'A',hand:'R',on:'thighL',at:[0,-.08,.04],from:.18,to:.6},{who:'A',hand:'R',on:'spine',at:[-.04,.03,.12],from:.74,to:1,fade:.2},{who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.94,to:1,fade:.23}],
});
