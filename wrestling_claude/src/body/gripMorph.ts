import {BufferAttribute,type BufferGeometry} from 'three';
import {bindPose} from './anatomy';
import {m3Apply} from './math';
type Point=[number,number,number];
const fingers=[[.023,.0096,.04,.032],[.004,.01,.043,.035],[-.015,.0094,.04,.033],[-.032,.0085,.032,.027]];
/** Two independent hand targets: finger hook and thumb adduction for a Gable grip. */
export function addGripMorph(g:BufferGeometry,side:1|-1,scale:number):void {
 if(g.morphAttributes.position?.length)return;
 const pos=g.getAttribute('position'),normal=g.getAttribute('normal');
 const targets=[new Float32Array(pos.count*3),new Float32Array(pos.count*3)];
 const bind=bindPose(scale),hand=side===1?'handL':'handR';
 const rot=bind.rot[hand],origin=bind.pos[hand],rest=bind.rest[hand];
 const inverse=new Float64Array([rot[0],rot[3],rot[6],rot[1],rot[4],rot[7],rot[2],rot[5],rot[8]]);
 for(let v=0;v<pos.count;v++){
  const local=m3Apply(inverse,[pos.getX(v)-origin[0],pos.getY(v)-origin[1],pos.getZ(v)-origin[2]]);
  const p:Point=[(local[0]+rest[0])*side/scale,(local[1]+rest[1])/scale,(local[2]+rest[2])/scale];
  let nearest=Infinity,delta:Point=[0,0,0],radius=0;
  for(const [z,r,lp,ld] of fingers){
   const old:Point[]=[[.19,.797,z],[.185,.797-lp,z+z*.06],[.172,.797-lp-ld*.92,z+z*.1]];
   const next:Point[]=[old[0]];
   for(let j=0;j<2;j++){
    const angle=[55,115][j]*Math.PI/180,length=Math.hypot(...old[j+1].map((x,k)=>x-old[j][k]));
    next.push([next[j][0]-Math.sin(angle)*length,next[j][1]-Math.cos(angle)*length,old[j+1][2]]);
   }
   for(let j=0;j<2;j++){
    const a=old[j],d=old[j+1].map((x,k)=>x-a[k]);
    const t=Math.max(0,Math.min(1,d.reduce((s,x,k)=>s+x*(p[k]-a[k]),0)/d.reduce((s,x)=>s+x*x,0)));
    const radial=p.map((x,k)=>x-a[k]-t*d[k]),distance=Math.hypot(...radial);
    if(distance>=nearest)continue;
    nearest=distance;radius=r;
    const angle=-([55,115][j]*Math.PI/180-Math.atan2(-d[0],-d[1]));
    const c=Math.cos(angle),s=Math.sin(angle),offset=[radial[0]*c-radial[1]*s,radial[0]*s+radial[1]*c,radial[2]];
    delta=next[j].map((x,k)=>x+t*(next[j+1][k]-x)+offset[k]-p[k]) as Point;
   }
  }
  const weight=Math.max(0,Math.min(1,(.801-p[1])/.012))*Math.max(0,Math.min(1,(radius*1.6-nearest)/(radius*.4)));
  const thumb=Math.max(0,Math.min(1,(p[2]-.032)/.012))*Math.max(0,Math.min(1,(.858-p[1])/.045));
  const fingerWorld=m3Apply(rot,[delta[0]*weight*scale*side,delta[1]*weight*scale,delta[2]*weight*scale]);
  const thumbWorld=m3Apply(rot,[0,0,-.018*thumb*scale]);
  for(let k=0;k<3;k++){targets[0][v*3+k]=fingerWorld[k];targets[1][v*3+k]=thumbWorld[k];}
 }
 g.morphTargetsRelative=true;
 g.morphAttributes.position=targets.map(t=>new BufferAttribute(t,3));
 g.morphAttributes.normal=targets.map(t=>{
  const absolute=new Float32Array(t.length);for(let i=0;i<t.length;i++)absolute[i]=pos.array[i]+t[i];
  const copy=g.clone();copy.morphAttributes={};copy.setAttribute('position',new BufferAttribute(absolute,3));copy.computeVertexNormals();
  const n=copy.getAttribute('normal'),delta=new Float32Array(t.length);for(let i=0;i<t.length;i++)delta[i]=n.array[i]-normal.array[i];copy.dispose();
  return new BufferAttribute(delta,3);
 });
}
