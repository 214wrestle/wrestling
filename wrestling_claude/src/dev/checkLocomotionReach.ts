import {Bone,Vector3} from 'three';
import {BONES} from '../body/skeleton';
import type {BoneName} from '../body/skeleton';
import {Solver} from '../anim/solver';
import {Footwork} from '../anim/footwork';
import {DEFAULT_STANCE,stancePose,scaleLocal} from '../anim/stance';
import {createLocal,localToWorld} from '../anim/spec';
import {P,createPosture} from '../anim/posture';
let worst=0,context='';
for(const scale of [.9,1,1.15]) for(const level of [.25,.45,.8]) for(const speed of [.65,2.7]) {
  const bones={} as Record<BoneName,Bone>;
  for(const def of BONES){const b=new Bone();b.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=b;if(def.parent)bones[def.parent].add(b);}
  const solver=new Solver({bones,scale}),gait=new Footwork(),local=createLocal(),p=createPosture();
  for(let frame=0;frame<120;frame++) {
    stancePose({...DEFAULT_STANCE,level},local);scaleLocal(local,scale);
    localToWorld(local,{x:speed*frame/60,z:0,yaw:0},p);
    gait.update(1/60,p,speed,0,1,false,scale);gait.apply(p,1);solver.apply(p);
    for(const [side,at] of [['L',P.FOOT_L],['R',P.FOOT_R]] as const){
      const actual=bones[`toe${side}`].getWorldPosition(new Vector3());
      const error=actual.distanceTo(new Vector3(p[at],p[at+1],p[at+2]));
      if(error>worst){worst=error;context=`scale=${scale} level=${level} speed=${speed} frame=${frame}`;}
    }
  }
}
console.log(`Worst solved foot/target error ${worst.toFixed(4)}m (${context})`);
if(worst>.025)throw Error('Locomotion exceeds anatomical leg reach');
