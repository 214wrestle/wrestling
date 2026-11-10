import '../lab/doubleBarFinishDraft';
import {sampleMove} from '../anim/clips';
import {P} from '../anim/posture';
import {createLocal} from '../anim/spec';
// A changing elbow route must not disturb the locked palms or swap handedness.
let previous:number[][]|undefined;
for(let i=0;i<=240;i++){
 const u=i/240;
 const left=sampleMove('doubleBarHeadPostEntryDraft','A',u,false,createLocal());
 const right=sampleMove('doubleBarHeadPostEntryDraft','A',u,true,createLocal());
 if(left.length!==2||right.length!==2)throw Error('Entry lost a clasp contact');
 const current:number[][]=[];
 for(const c of left){
  const mirrored=right.find(m=>m.hand!==c.hand)!;
  if(c.weight!==1||!c.backClasp||c.at.join(',')!=='0,0.03,-0.14')throw Error('Moving guide disturbed clasp');
  const a=c.elbowGuide!.at,b=mirrored.elbowGuide!.at;
  if(Math.abs(a[0]+b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])>1e-10)throw Error('Guide mirror mismatch');
  current.push(a);
 }
 if(previous)for(let j=0;j<2;j++)if(Math.hypot(...current[j].map((v,k)=>v-previous![j][k]))>.03)throw Error('Elbow pole jumps between samples');
 previous=current;
}
for(const mirror of [false,true]){
 const pose=createLocal();let first:number[]|undefined;
 for(let i=0;i<=34;i++){
  sampleMove('doubleBarHeadPostEntryDraft','A',i/100,mirror,pose);
  const at=mirror?P.FOOT_R:P.FOOT_L,point=Array.from(pose.slice(at,at+3));
  if(!first)first=point;
  if(point.some((v,j)=>Math.abs(v-first![j])>1e-8))throw Error('Planted toe target anticipates its step');
 }
}
console.log('241 entry samples: continuous elbow guides, mirrored handedness, unchanged clasp anchors.');
