import {registerHold,registerMove} from '../clips';
import {holdAt,BALL,POST} from './kit';
registerHold({id:'legRide',A:[
 {base:holdAt('ride','A',0),hips:[0.28,0.5,-0.14],kneeL:[0.4,0.2,0.15],footL:[0.35,0.12,-0.1,0,35]},
 {hips:[0.12,0.54,-0.08],rot:[-8,38,0],kneeL:[0.26,0.34,0.1],footL:[0.08,0.25,0.21,0,45],footR:[0.3,BALL,-0.48,0,65],handL:[0.17,0.36,0.34],handR:[-0.08,0.4,0.03]}],
 B:[{base:holdAt('ride','B',0)},{hips:[0,0.44,-0.02],kneeL:[.4,.3,.3],kneeR:[-.4,.3,.3],handL:[0.16,POST,0.4],handR:[-0.16,POST,0.4],elbowL:[0.2,0.26,0.2],elbowR:[-0.2,0.26,0.2]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-0.02,0]},{who:'A',hand:'R',on:'hips',at:[-0.08,0.02,0.08]}],struggle:{A:0.6,B:0.8},tempo:1.5});
registerHold({id:'closedPockets',A:[{base:holdAt('ride','A',0)},{base:holdAt('ride','A',0)}],
 B:[{base:holdAt('ride','B',0)},{base:holdAt('ride','B',0),handL:[0.12,0.28,0.16],handR:[-0.12,0.28,0.16],elbowL:[0.17,0.3,-0.02],elbowR:[-0.17,0.3,-0.02]}],struggle:{A:0.5,B:0.5},tempo:1.4});
// Catch first, then shift weight over the free-hand post. The rider follows
// the hip displacement while keeping waist control; catching a leg is no escape.
registerHold({id:'catchRidingLeg',A:[
 {base:holdAt('legRide','A',1)},
 {base:holdAt('legRide','A',1),hips:[.24,.56,-.13],rot:[-14,38,-8],
  footL:[.3,.31,.1,0,45],kneeL:[.48,.35,.14]}],
 B:[{base:holdAt('legRide','B',1)},
    {base:holdAt('legRide','B',1),hips:[.1,.4,-.04],rot:[0,76,-12],
     footL:[.43,BALL,-.4,0,65],kneeL:[.46,.18,.06],
     handL:[.25,.3,.09],elbowL:[.22,.26,-.01],handR:[-.16,POST,.4]}],
 contacts:[{who:'B',hand:'L',on:'shinL',at:[-.025,-.18,.02],progressFade:.45},
           {who:'A',hand:'R',on:'hips',at:[-.08,.02,.08]}],
 struggle:{A:.8,B:1},tempo:1.5});

// Sealing the elbows while broken down must not lift the defender to referee's
// position. Keep the belly/legs down and let the rider follow the protected arm.
registerHold({id:'closedPocketsFlat',
 A:[{base:holdAt('flat','A',0)},{base:holdAt('flat','A',0)}],
 B:[{base:holdAt('flat','B',0)},
    {base:holdAt('flat','B',0),handL:[.12,.07,.4],handR:[-.12,.07,.4],elbowL:[.16,.1,.22],elbowR:[-.16,.1,.22]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.2,0]},
           {who:'A',hand:'R',on:'hips',at:[-.13,.02,0]}],
 struggle:{A:.5,B:.5},tempo:1.4});

// Hunter Gamble / CMPTV T2_jP8mhmn4: protect the elbow, sit to a hip,
// split the legs, chest over the front thigh, then circle below the rider.
// Authoring lab only: no automatic escape or reversal is implied by this pose.
registerHold({id:'seatedLegDefense',
 A:[{base:holdAt('ride','A',0),hips:[.12,.105,-.32],rot:[-5,38,0],
     spine:[12,0,0],palms:[0,1],footL:[.25,.10,.30,0,55],kneeL:[.65,.05,.05],
     footR:[-.44,BALL,-.42,0,70],kneeR:[-.65,.3,-.06],
     handL:[.18,.28,.24],handR:[-.42,POST,.04],elbowR:[-.43,.24,-.12]},{}],
 B:[{base:holdAt('ride','B',0),hips:[.06,.085,.07],rot:[0,62,-10],
     spine:[8,0,0],head:[-25,0,0],
     footL:[.22,.045,.73,0,30],kneeL:[.6,.16,.43],
     footR:[-.32,.04,-.71,0,15],kneeR:[-.65,.20,-.3],
     handL:[.20,.09,.50],elbowL:[.22,.14,.30],
     handR:[-.22,POST,.55],elbowR:[-.34,.20,.31]},{}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.02,0]}],
 struggle:{A:.3,B:.3},tempo:1.2});

registerMove({id:'sitAndCircleLegDefense',
 footContacts:[{who:'A',foot:'L',on:'thighL',at:[.075,-.22,.08],from:.46,to:.88,fade:.12}],
 A:[{t:0,pose:{base:holdAt('legRide','A',1),kneeL:[.65,.05,.05],kneeR:[-.65,.3,-.06]}},
    {t:.18,pose:{base:holdAt('legRide','A',1),hips:[.14,.48,-.14],kneeL:[.65,.05,.05],kneeR:[-.65,.3,-.06]}},
    {t:.46,pose:{base:holdAt('seatedLegDefense','A',0)}},
    {t:.54,pose:{base:holdAt('seatedLegDefense','A',0,{x:0,z:0,yaw:8}),footR:[-.44,BALL,-.42,0,70],handR:[-.42,POST,.04]}},
    {t:.60,pose:{base:holdAt('seatedLegDefense','A',0,{x:.01,z:0,yaw:13}),footR:[-.49,.14,-.34,10,70],handR:[-.4,.12,.14]}},
    {t:.7,pose:{base:holdAt('seatedLegDefense','A',0,{x:.02,z:0,yaw:20})}},
    {t:.77,pose:{base:holdAt('seatedLegDefense','A',0,{x:.025,z:.005,yaw:26}),footR:[-.537,BALL,-.245,20,70],handR:[-.332,POST,.23]}},
    {t:.85,pose:{base:holdAt('seatedLegDefense','A',0,{x:.03,z:.01,yaw:35}),footR:[-.56,.14,-.11,35,70],handR:[-.27,.12,.32]}},
    {t:1,pose:{base:holdAt('seatedLegDefense','A',0,{x:.04,z:.02,yaw:45})}}],
 B:[{t:0,pose:{base:holdAt('legRide','B',1),kneeL:[.4,.3,.3],kneeR:[-.4,.3,.3]}},
    {t:.09,pose:{kneeL:[.5,.3,.3],kneeR:[-.6,.2,.3]}},
    {t:.18,pose:{base:holdAt('legRide','B',1),
       handL:[.15,.31,.18],elbowL:[.16,.30,.01],kneeL:[.6,.3,.3],kneeR:[-.6,.2,-.1]}},
    {t:.32,pose:{hips:[.06,.28,.03],rot:[0,68,-10],
       footL:[.58,.16,.20,0,45],footR:[-.30,BALL,-.65,0,30],
       kneeL:[.75,.45,.38],kneeR:[-.6,.25,-.3]}},
    {t:.46,pose:{base:holdAt('seatedLegDefense','B',0)}},
    {t:.54,pose:{base:holdAt('seatedLegDefense','B',0,{x:0,z:.01,yaw:8}),handR:[-.22,POST,.55]}},
    {t:.60,pose:{base:holdAt('seatedLegDefense','B',0,{x:.01,z:.02,yaw:16}),handR:[-.08,.14,.6]}},
    {t:.7,pose:{base:holdAt('seatedLegDefense','B',0,{x:.02,z:.03,yaw:28})}},
    {t:.77,pose:{base:holdAt('seatedLegDefense','B',0,{x:.025,z:.035,yaw:34}),handR:[.084,POST,.619]}},
    {t:.85,pose:{base:holdAt('seatedLegDefense','B',0,{x:.03,z:.04,yaw:44}),handR:[.22,.14,.59]}},
    {t:1,pose:{base:holdAt('seatedLegDefense','B',0,{x:.04,z:.05,yaw:55})}}],
 contacts:[{who:'A',hand:'R',on:'hips',at:[-.08,.02,.08],from:0,to:.3,fade:.12},
           {who:'A',hand:'L',on:'forearmL',at:[0,-.02,0],from:0,to:1}]});

// Preserve the rotated landing frame; returning to the unrotated setup would
// unwind the circle as soon as the defensive action ends.
registerHold({id:'seatedLegDefenseExit',
 A:[{base:holdAt('seatedLegDefense','A',0,{x:.04,z:.02,yaw:45})},{}],
 B:[{base:holdAt('seatedLegDefense','B',0,{x:.04,z:.05,yaw:55})},{}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.02,0]}],
 struggle:{A:.3,B:.3},tempo:1.2});

// A controlled return to the base after the rider follows the hip circle.
// No escape/reversal is implied: the top wrestler still owns control.
registerHold({id:'seatedDefenseUnhook',
 A:[{base:holdAt('seatedLegDefense','A',0),hips:[.12,.18,-.27],footL:[.68,.14,.28,0,55],kneeL:[.9,.05,.2]},{}],
 B:[{base:holdAt('seatedLegDefense','B',0)},{}]});
registerHold({id:'seatedDefenseGather',
 A:[{base:holdAt('seatedLegDefense','A',0),hips:[.14,.28,-.22],rot:[-10,50,0],
     footL:[.65,.12,-.25,0,55],footR:[-.4,BALL,-.45,0,70],
     kneeL:[.8,.05,.1],kneeR:[-.6,.4,-.05]},{}],
 B:[{base:holdAt('seatedLegDefense','B',0),hips:[.06,.25,.07],rot:[0,75,-5],
     footL:[.35,.09,.1,0,55],footR:[-.25,.04,-.6,0,60],
     kneeL:[.6,.12,.25],kneeR:[-.4,.2,.05],
     handL:[.2,POST,.55],handR:[-.2,POST,.55],palms:[1,1]},{}]});
registerHold({id:'seatedDefenseBase',
 A:[{base:holdAt('ride','A',1),hips:[.12,.54,-.08],rot:[-8,38,0],
     kneeL:[.5,.3,.25],kneeR:[-.3,.3,.2]},{}],
 B:[{base:holdAt('legRide','B',1)},{}]});
registerHold({id:'seatedDefenseRecovered',
 A:[{base:holdAt('seatedDefenseBase','A',0,{x:.04,z:.02,yaw:55})},{}],
 B:[{base:holdAt('seatedDefenseBase','B',0,{x:.04,z:.05,yaw:55})},{}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.02,0]},
           {who:'A',hand:'R',on:'hips',at:[-.08,.02,.08]}],
 struggle:{A:.4,B:.4},tempo:1.2});
registerMove({id:'recoverSeatedLegDefense',
 A:[{t:0,pose:{base:holdAt('seatedLegDefenseExit','A',0)}},
    {t:.25,pose:{base:holdAt('seatedDefenseUnhook','A',0,{x:.04,z:.02,yaw:55})}},
    {t:.5,pose:{base:holdAt('seatedDefenseGather','A',0,{x:.04,z:.02,yaw:55})}},
    {t:1,pose:{base:holdAt('seatedDefenseRecovered','A',0)}}],
 B:[{t:0,pose:{base:holdAt('seatedLegDefenseExit','B',0)}},
    {t:.5,pose:{base:holdAt('seatedDefenseGather','B',0,{x:.04,z:.05,yaw:55})}},
    {t:1,pose:{base:holdAt('seatedDefenseRecovered','B',0)}}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.02,0]},
           {who:'A',hand:'R',on:'hips',at:[-.08,.02,.08],from:.85,fade:.2}]});

// Open space beneath the hips before threading the boot. A broken-down chest
// is not a pelvis pinned to the mat: the defender draws the knees underneath.
// Keep that low base while the rider occupies the opening.
registerHold({id:'legRideFlat',
 footContacts:[{who:'A',foot:'L',on:'thighL',at:[-.11,-.30,.07],progressFade:.65}],
 A:[{base:holdAt('flat','A',0),hips:[.18,.50,-.10],rot:[-10,78,0],
     kneeR:[-.5,.4,-.4],kneeL:[.5,.12,-.12]},
    {base:holdAt('flat','A',0),kneeR:[-.5,.4,-.4],hips:[.18,.46,-.10],rot:[-10,78,0],
     kneeL:[.5,.12,-.12],footL:[.08,.22,.05,0,45]}],
 B:[{base:holdAt('flat','B',0),hips:[0,.30,0],rot:[0,82,0],
     footL:[.22,BALL,-.58,0,65],footR:[-.22,BALL,-.58,0,65],
     kneeL:[.4,.04,.25],kneeR:[-.4,.04,.25]},
    {hips:[0,.24,0],rot:[0,88,0],footL:[.22,.16,-.94,0,90],kneeL:[.4,.14,-.32],footR:[-.22,BALL,-.85,0,80],kneeR:[-.4,.04,-.22]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.2,0]},
           {who:'A',hand:'R',on:'hips',at:[-.13,.02,0]}],
 struggle:{A:.5,B:.5},tempo:1.4});

// Share the low supported base with the established leg ride.
registerHold({id:'legRideFlatCatchSetup',
 A:[{base:holdAt('flat','A',0),hips:[.18,.50,-.10],rot:[-10,78,0],
     kneeR:[-.5,.4,-.4],kneeL:[.5,.12,-.12]},
    {base:holdAt('flat','A',0),kneeR:[-.5,.4,-.4],hips:[.18,.46,-.10],rot:[-10,78,0],
     kneeL:[.5,.12,-.12],footL:[.08,.22,.05,0,45]}],
 B:[{base:holdAt('flat','B',0),hips:[0,.30,0],rot:[0,82,0],
     footL:[.22,BALL,-.58,0,65],footR:[-.22,BALL,-.58,0,65],
     kneeL:[.4,.04,.25],kneeR:[-.4,.04,.25]},
    {hips:[0,.24,0],rot:[0,88,0],footL:[.22,.16,-.94,0,90],kneeL:[.4,.14,-.32],footR:[-.22,BALL,-.85,0,80],kneeR:[-.4,.04,-.22]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.2,0]},
           {who:'A',hand:'R',on:'hips',at:[-.13,.02,0]}],
 struggle:{A:.5,B:.5},tempo:1.4});

// A flattened defender reaches back on the inside of the boot and turns a hip
// toward the free forearm. The rider follows that turn without granting a base-up.
registerHold({id:'catchRidingLegFlat',
 footContacts:[{who:'A',foot:'L',on:'thighL',at:[-.11,-.30,.07]}],
 A:[{base:holdAt('legRideFlat','A',1)},
    {base:holdAt('legRideFlatCatchSetup','A',1),hips:[.25,.49,-.07],rot:[-12,78,-8],
     kneeL:[.48,.12,-.15],footL:[.35,.20,-.05,0,45]}],
 B:[{base:holdAt('legRideFlat','B',1)},
    {base:holdAt('legRideFlatCatchSetup','B',1),hips:[.07,.24,.04],rot:[65,85,-20],
     handL:[.3,.16,.04],elbowL:[.37,.14,.21],handR:[-.16,.05,.66]}],
 contacts:[{who:'B',hand:'L',on:'shinL',at:[-.025,-.20,.02],progressFade:1},
           {who:'A',hand:'R',on:'hips',at:[-.13,.02,0]}],
 struggle:{A:.5,B:.5},tempo:1.4});

// Owner-approved October 13 shallow/bad ride reference. Preserve the loose
// initial inside hook for weak leg riders; this is not a secure deep ride.
registerHold({id:'legRideShallow',
 A:[{base:holdAt('legRideFlat','A',1)},{}],
 B:[{base:holdAt('legRideFlat','B',0),hips:[0,.28,0],rot:[0,82,0],
     footL:[.25,.19,-.62,0,65],kneeL:[.4,.25,.25]},{}],
 footContacts:[{who:'A',foot:'L',on:'thighL',at:[-.11,-.24,.07]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.2,0]},
           {who:'A',hand:'R',on:'hips',at:[-.13,.02,0]}],
 struggle:{A:.5,B:.5},tempo:1.4});

// Established low-base ride: pressure, rather than entry progress, is the axis.
// Keep a plausible knee bend even at the loose end of the range.
registerHold({id:'legRidePressure',
 A:[{base:holdAt('legRideFlat','A',1),hips:[.18,.49,-.10]},
    {base:holdAt('legRideFlat','A',1)}],
 B:[{base:holdAt('legRideShallow','B',0),footL:[.25,.17,-.82,0,80],kneeL:[.4,.17,-.15],
     footR:[-.22,BALL,-.85,0,80],kneeR:[-.4,.04,-.22]},
    {base:holdAt('legRideFlat','B',1)}],
 footContacts:[{who:'A',foot:'L',on:'thighL',at:[-.11,-.30,.07]}],
 contacts:[{who:'A',hand:'L',on:'forearmL',at:[0,-.2,0]},
           {who:'A',hand:'R',on:'hips',at:[-.13,.02,0]}],
 struggle:{A:.5,B:.5},tempo:1.4});
