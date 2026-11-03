import {Matrix4,Quaternion,Vector3} from 'three';

/** Palm contact surface in the standard hand's local skeleton coordinates. */
export function palmSurface(hand:'L'|'R',scale:number):Vector3 {
 return new Vector3(hand==='L'?-.018:.018,-.048,.019).multiplyScalar(scale);
}

/** Hook a wrist/forearm with fingers down its length and palm facing inward. */
export function palmGrip(target:Vector3,outward:Vector3,along:Vector3,hand:'L'|'R',scale:number){
 const x=outward.clone().normalize().multiplyScalar(hand==='L'?1:-1);
 const y=along.clone().addScaledVector(x,-along.dot(x)).normalize();
 const z=new Vector3().crossVectors(x,y).normalize();
 const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
 return {wrist:target.clone().sub(palmSurface(hand,scale).applyQuaternion(rotation)),rotation};
}

/** Opposed palms, with the fingers of each hand wrapping toward the other wrist. */
export function gableGrip(clasp:Vector3,towardBody:Vector3,hand:'L'|'R',scale:number,headArm=hand==='L'){
 const x=new Vector3(0,1,0);
 const y=new Vector3(towardBody.x,0,towardBody.z).normalize();
 if(y.lengthSq()<.5)y.set(0,0,1);
 if(headArm)y.negate();
 const z=new Vector3().crossVectors(x,y);
 const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
 const wrist=clasp.clone().sub(palmSurface(hand,scale).applyQuaternion(rotation));
 return {wrist,rotation};
}

/** A joined back grip follows the rib cage through a roll, rather than using
 * the cradle's mat-relative orientation. Fingers oppose across the back. */
export function backGableGrip(clasp:Vector3,chestRotation:Quaternion,hand:'L'|'R',scale:number){
 const x=new Vector3(0,1,0);
 const y=new Vector3(hand==='L'?1:-1,0,0);
 const z=new Vector3().crossVectors(x,y);
 const rotation=chestRotation.clone().multiply(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z)));
 return {wrist:clasp.clone().sub(palmSurface(hand,scale).applyQuaternion(rotation)),rotation};
}
