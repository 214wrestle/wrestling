import { registerMove } from '../clips';
import { BALL, POST, holdAt } from './kit';

// Rear trip: block the ankle and rotate the waist without lifting both feet.
registerMove({
  id: 'standingTrip',
  A: [
    {t:0,pose:{base:holdAt('standing','A',0)}},
    {t:.4,pose:{hips:[.12,.78,-.28],rot:[0,22,0],spine:[14,0,0],footL:[.3,BALL,.12,0,0],footR:[-.25,BALL,-.35,0,0]}},
    {t:.7,land:true,pose:{hips:[.15,.48,-.15],rot:[-12,55,0],spine:[22,-12,0]}},
    {t:1,pose:{base:holdAt('ride','A',.2,{x:0,z:.05,yaw:0})}},
  ],
  B: [
    {t:0,pose:{base:holdAt('standing','B',0),palms:[1,1]}},
    {t:.4,pose:{hips:[.12,.78,.1],rot:[-15,25,0],footL:[.2,BALL,.1,0,0],footR:[-.16,BALL,0,0,0]}},
    {t:.60,pose:{hips:[.12,.54,.08],rot:[-20,60,0],spine:[6,0,0],handL:[.3,POST,.4],handR:[-.15,POST,.45]}},
    {t:.7,land:true,pose:{hips:[.12,.43,.06],rot:[-20,70,0],handL:[.3,POST,.4],handR:[-.15,POST,.45],palms:[1,1]}},
    {t:1,pose:{base:holdAt('ride','B',.4,{x:0,z:.05,yaw:0})}},
  ],
  contacts:[{who:'A',hand:'L',on:'spine',at:[.04,0,.13],from:0,to:.7},{who:'A',hand:'R',on:'spine',at:[-.04,0,.13],from:0,to:.7},{who:'A',hand:'R',on:'spine',at:[0,.02,.11],from:.75,to:1},{who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.75,to:1}],
});

// Crotch lift: squat, scoop inside the thigh, elevate, then guide down to a ride.
registerMove({
  id:'crotchLift',
  A:[
    {t:0,pose:{base:holdAt('standing','A',0)}},
    {t:.25,pose:{hips:[0,.58,-.27],spine:[20,0,0],footL:[.23,BALL,-.25,10,0],footR:[-.23,BALL,-.35,-10,0],kneeL:[.3,.35,.08],kneeR:[-.3,.35,-.02]}},
    {t:.5,pose:{hips:[0,.82,-.22],rot:[0,8,0],spine:[-8,0,0],footL:[.23,BALL,-.25,10,0],footR:[-.23,BALL,-.35,-10,0],kneeL:[.3,.5,.08],kneeR:[-.3,.5,-.02]}},
    {t:.72,land:true,pose:{hips:[.1,.5,-.15],rot:[-10,55,0],spine:[24,-8,0]}},
    {t:1,pose:{base:holdAt('ride','A',.2,{x:0,z:.05,yaw:0})}},
  ],
  B:[
    {t:0,pose:{base:holdAt('standing','B',0),palms:[1,1]}},
    {t:.25,pose:{hips:[0,.8,.05],spine:[12,0,0]}},
    {t:.5,pose:{hips:[0,1.13,.08],rot:[0,15,0],footL:[.22,.42,.22,0,30],footR:[-.22,.37,0,0,30]}},
    {t:.62,pose:{hips:[0,.57,.06],rot:[0,62,0],spine:[6,0,0],handL:[.24,POST,.42],handR:[-.24,POST,.42]}},
    {t:.72,land:true,pose:{hips:[0,.46,.05],rot:[0,70,0],handL:[.24,POST,.42],handR:[-.24,POST,.42],palms:[1,1]}},
    {t:1,pose:{base:holdAt('ride','B',.4,{x:0,z:.05,yaw:0})}},
  ],
  contacts:[{who:'A',hand:'L',on:'spine',at:[.04,0,.13],from:0,to:.7},{who:'A',hand:'R',on:'thighL',at:[0,-.08,.04],from:.18,to:.65},{who:'A',hand:'R',on:'spine',at:[0,.02,.11],from:.72,to:1},{who:'A',hand:'L',on:'forearmL',at:[0,-.04,-.035],from:.75,to:1}],
});
