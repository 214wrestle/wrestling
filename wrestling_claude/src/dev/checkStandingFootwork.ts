import {Bone,Group,Vector3} from 'three';
import {BONES} from '../body/skeleton';
import type {BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import '../anim/library';
for(const yaw of [0,1.2]) {
 const make=()=>{const bones={} as Record<BoneName,Bone>,root=new Group();for(const def of BONES){const b=new Bone();b.position.set(...def.offset);bones[def.name]=b;if(def.parent)bones[def.parent].add(b);else root.add(b);}const a=new Animator({bones,root,scale:1,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}});a.instant=true;return a;};
 const a=make(),b=make();let plants=0,lift=0,headGap=Infinity;
 b.footwork.onPlant=()=>plants++;
 for(let i=0;i<180;i++){
   const base={mode:'paired' as const,clip:'standing',hold:true,frame:{x:0,z:0,yaw},mirror:false,u:0,progress:Math.min(1,i/90),intensity:0,stamina:1,exertion:0};
   a.update(1/60,{...base,role:'A'},b);b.update(1/60,{...base,role:'B'},a);
   a.applyContacts(1/60,b);b.applyContacts(1/60,a);
   headGap=Math.min(headGap,a.headPos(new Vector3()).distanceTo(b.headPos(new Vector3())));
   const l=b.bonePos('toeL',new Vector3()),r=b.bonePos('toeR',new Vector3());
   if(i>20 && Math.min(l.y,r.y)>.05)throw Error('Standing turn lost support');
   lift=Math.max(lift,l.y-.025,r.y-.025);
 }
 if(headGap<.20)throw Error('Standing control overlaps head centers');
 if(!plants || lift<.02)throw Error('Standing turn slid feet instead of stepping');
}
console.log('Standing escape turns take grounded steps with live hand contacts at both world orientations');
