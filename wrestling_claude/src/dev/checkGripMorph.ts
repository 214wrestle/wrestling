import {buildBodyNow} from '../body/factory';
import {addGripMorph} from '../body/gripMorph';
for(const scale of [.9,1.15]){
 const buffers=buildBodyNow({scale,mass:.5,hair:'crop',clothing:'singlet'},'low',false);
 for(const [i,hand] of buffers.hands.entries()){
  const before=Float32Array.from(hand.getAttribute('position').array);
  addGripMorph(hand,i===0?1:-1,scale);
  const targets=hand.morphAttributes.position!;
  if(targets.length!==2)throw new Error('Missing finger/thumb targets');
  for(const [n,target] of targets.entries()){
   let moved=0,max=0;
   for(let v=0;v<target.count;v++){
    const d=Math.hypot(target.getX(v),target.getY(v),target.getZ(v));
    if(!Number.isFinite(d))throw new Error('Nonfinite grip mesh');
    if(d>1e-6)moved++;max=Math.max(max,d);
   }
   if(!moved||max>.13*scale)throw new Error('Invalid grip deformation');
   console.log({scale,hand:i,target:n,moved,max});
  }
  if(before.some((x,j)=>x!==hand.getAttribute('position').array[j]))throw new Error('Rest hand mutated');
  const saved=targets[0];addGripMorph(hand,i===0?1:-1,scale);
  if(hand.morphAttributes.position![0]!==saved)throw new Error('Cached hand targets rebuilt');
 }
}
