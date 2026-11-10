import {Bone,Group,Vector3} from 'three';
import {BONES,type BoneName} from '../body/skeleton';
import {Animator} from '../anim/Animator';
import {DEFAULT_MOTION} from '../sim/athleteProfiles';
import {sampleMove,sampleHold} from '../anim/clips';
import {createLocal} from '../anim/spec';
import '../anim/library';
function make(scale:number,phase=.5){
 const bones={} as Record<BoneName,Bone>,root=new Group();
 for(const def of BONES){const bone=new Bone();bone.position.set(...def.offset).multiplyScalar(scale);bones[def.name]=bone;if(def.parent)bones[def.parent].add(bone);else root.add(bone);}
 const random=Math.random;
 Math.random=()=>phase;
 let anim:Animator;
 try { anim=new Animator({bones,root,scale,boneList:Object.values(bones),dispose:()=>{},motion:DEFAULT_MOTION,setExertion:()=>{}}); } finally { Math.random=random; }
 anim.instant=true;
 return {anim,bones,scale};
}
let worst=0,context='';
for(const clip of ['shotDouble','shotSingle','shotHighCrotch','shotLowSingle']) for(const mirror of [false,true]) for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) for(const hz of [30,60,120]) for(const duration of [.25,.4,.65]) {
 const a=make(scales[0]),b=make(scales[1]);
 const frames=Math.ceil(duration*hz);
 for(let i=0;i<=frames;i++){
  const u=Math.min(1,i/(duration*hz)),base={mode:'paired' as const,clip,hold:false,frame:{x:0,z:0,yaw:.6},mirror,u,progress:0,intensity:0,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(u<.85)continue;
  for(const c of sampleMove(clip,'B',u,mirror,createLocal())) {
   const bone=a.bones[c.on];bone.updateWorldMatrix(true,false);
   const target=new Vector3(...c.at).multiplyScalar(a.scale).applyMatrix4(bone.matrixWorld);
   const gap=b.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target);
   if(gap>worst){worst=gap;context=`${clip} mirror=${mirror} scales=${scales} hz=${hz} duration=${duration} u=${u.toFixed(2)} hand=${c.hand}`;}
  }
 }
}
console.log(`Worst defensive wrist/anchor gap ${worst.toFixed(4)}m (${context})`);

if(worst>.015)throw Error('Fast entry leaves the defensive wrist detached from its anchor');

// Follow both wrestlers through the real entry-to-hold transition, including
// different initial finishing progress and opponent sizes.
let transitionWorst=0, transitionContext='';
const gaps=new Map<string,number>();
for(const [clip,hold] of [['shotDouble','legsDouble'],['shotSingle','legsSingle'],['shotHighCrotch','legsHighCrotch'],['shotLowSingle','legsLowSingle']])
for(const mirror of [false,true]) for(const scales of [[1,1],[.9,1.15],[1.15,.9]])
for(const hz of [30,60,120]) for(const progress of [0,.35,.7,1]) for(const phase of [.1,.5,.9]) {
 const a=make(scales[0],phase),b=make(scales[1],1-phase);
 const duration=.3,frames=Math.ceil((duration+2)*hz);
 for(let i=0;i<=frames;i++){
  const time=i/hz,isHold=time>duration,u=Math.min(1,time/duration);
  const base={mode:'paired' as const,clip:isHold?hold:clip,hold:isHold,frame:{x:0,z:0,yaw:.6},mirror,u,progress,intensity:.7,stamina:1,exertion:0};
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(!isHold && u<.98)continue;
  for(const [role,own,opp] of [['A',a,b],['B',b,a]] as const){
   const contacts=isHold?sampleHold(hold,role,progress,time,.7,mirror,createLocal()):sampleMove(clip,role,u,mirror,createLocal());
   for(const c of contacts){
    const bone=opp.bones[c.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    const gap=own.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target);
    const key=`${clip} ${role} ${scales}`;
    gaps.set(key,Math.max(gaps.get(key)??0,gap));
    if(gap>transitionWorst){transitionWorst=gap;transitionContext=`${clip} role=${role} hand=${c.hand} mirror=${mirror} scales=${scales} hz=${hz} progress=${progress} time=${time.toFixed(3)} target=${target.toArray().map(v=>v.toFixed(2))} shoulder=${own.bones[`arm${c.hand}`].getWorldPosition(new Vector3()).toArray().map(v=>v.toFixed(2))}`;}
   }
  }
 }
}
console.log(`Worst entry-to-hold wrist/anchor gap ${transitionWorst.toFixed(4)}m (${transitionContext})`);

console.log(`High-crotch transition maximum ${Math.max(...[...gaps].filter(([key])=>key.startsWith('shotHighCrotch')).map(([,gap])=>gap)).toFixed(4)}m`);
for(const [key,gap] of gaps) {
 if(gap>.02) throw Error(`Held leg attack loses contact: ${key} ${gap}m`);
}

// Repeated offensive/defensive effort must retain the same wrist anchors while
// hips and head react. Exercise both corners, sizes, mirrors and frame rates.
let effortWorst=0, effortContext='';
for(const hold of ['legsDouble','legsSingle','legsHighCrotch','legsLowSingle','closedPocketsFlat','legRide','legRideFlat','catchRidingLeg'])
for(const mirror of [false,true]) for(const scales of [[1,1],[.9,1.15],[1.15,.9]])
for(const hz of [30,60,120]) for(const button of ['shoot','sprawl','fight']) {
 const a=make(scales[0]),b=make(scales[1]);
 const progress=hold==='catchRidingLeg'?.7:.35;
 for(let i=0;i<hz*2;i++) {
  const base={mode:'paired' as const,clip:hold,hold:true,frame:{x:0,z:0,yaw:.6},mirror,u:0,progress,intensity:.7,stamina:1,exertion:0};
  if(i>hz/2){a.anim.effort(button,button!=='shoot');b.anim.effort(button,button==='shoot');}
  a.anim.update(1/hz,{...base,role:'A'},b.anim);b.anim.update(1/hz,{...base,role:'B'},a.anim);
  a.anim.applyContacts(1/hz,b.anim);b.anim.applyContacts(1/hz,a.anim);
  if(i<hz/2)continue;
  for(const [role,own,opp] of [['A',a,b],['B',b,a]] as const) {
   for(const c of sampleHold(hold,role,progress,i/hz,.7,mirror,createLocal())) {
    const bone=opp.bones[c.on];bone.updateWorldMatrix(true,false);
    const target=new Vector3(...c.at).multiplyScalar(opp.scale).applyMatrix4(bone.matrixWorld);
    const gap=own.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target);
    if(gap>effortWorst){effortWorst=gap;effortContext=`${hold} ${button} ${role} ${c.hand} mirror=${mirror} scales=${scales} hz=${hz}`;}
   }
  }
 }
}
console.log(`Worst active leg-effort wrist/anchor gap ${effortWorst.toFixed(4)}m (${effortContext})`);
if(effortWorst>.02)throw Error('Leg effort detached a wrist from its opponent anchor');

// Closing a pocket must visibly tuck the threatened arm while retaining the
// opposite support and the rider's forearm grip, including mirrored bodies.
for(const hold of ['legRide','legRideFlat'])for(const mirror of [false,true])for(const scales of [[1,1],[.9,1.15],[1.15,.9]]) {
 const poses=[];
 for(const pockets of [0,1]) {
  const a=make(scales[0]),b=make(scales[1]);
  const base={mode:'paired' as const,clip:hold,hold:true,frame:{x:0,z:0,yaw:0},mirror,u:0,progress:.5,intensity:0,stamina:1,exertion:0,pockets};
  for(let i=0;i<60;i++) {
   a.anim.update(1/60,{...base,role:'A'},b.anim);b.anim.update(1/60,{...base,role:'B'},a.anim);
   a.anim.applyContacts(1/60,b.anim);b.anim.applyContacts(1/60,a.anim);
  }
  const controlled=mirror?'R':'L',support=mirror?'L':'R';
  poses.push({hand:b.anim.bonePos(`hand${controlled}`,new Vector3()),post:b.anim.bonePos(`hand${support}`,new Vector3())});
  for(const c of sampleHold(hold,'A',.5,1,0,mirror,createLocal())){
   const bone=b.bones[c.on];bone.updateWorldMatrix(true,false);
   const target=new Vector3(...c.at).multiplyScalar(b.scale).applyMatrix4(bone.matrixWorld);
   if(a.anim.bonePos(`hand${c.hand}`,new Vector3()).distanceTo(target)>.02)throw Error('Pocket defense detached rider grip');
  }
 }
 if(poses[0].hand.distanceTo(poses[1].hand)<.06)throw Error('Pocket defense did not move controlled arm');
 if(poses[0].post.distanceTo(poses[1].post)>.015)throw Error('Pocket defense moved opposite support palm');
}
console.log('Pocket defense moves the threatened arm, retains support palm and rider grip');
