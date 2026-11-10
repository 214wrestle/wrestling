import { BufferAttribute, type BufferGeometry } from 'three';
import { bindPose } from './anatomy';
import { m3Apply } from '../math';

// Finger centerlines match anatomy.ts. Grip flexes each phalanx around its
// joint while retaining segment length and the meshed cross-section.
const fingers = [
  [.0232,.0099,.041,.034,20,44,60],
  [.0055,.0103,.044,.037,22,48,63],
  [-.0123,.0098,.041,.034,25,52,67],
  [-.028,.0089,.034,.028,28,56,71],
];
type Point = [number,number,number];
function line(f:number[],closed:boolean):Point[] {
  const [z,,lp,ld,c0,c1,c2]=f;
  const angles=closed?[65,125,160]:[c0,c1,c2];
  const lengths=[lp,ld*.56,ld*.44];
  const points:Point[]=[[.19,.784,z]];
  for(let i=0;i<3;i++){
    const a=angles[i]*Math.PI/180,p=points[i],l=lengths[i];
    points.push([p[0]-Math.sin(a)*l,p[1]-Math.cos(a)*l,p[2]+z*.04*l]);
  }
  return points;
}

/** Only fine hand meshes receive this target; wrist/palm/feet stay unchanged. */
export function addGripMorph(g:BufferGeometry,side:1|-1,scale:number):void {
  const pos=g.getAttribute('position'), base=g.getAttribute('normal');
  const delta=new Float32Array(pos.count*3);
  const target=new Float32Array(pos.count*3);
  const bind=bindPose(scale),hand=side===1?'handL':'handR';
  const rot=bind.rot[hand],origin=bind.pos[hand],rest=bind.rest[hand];
  const inverse=new Float64Array([rot[0],rot[3],rot[6],rot[1],rot[4],rot[7],rot[2],rot[5],rot[8]]);
  for(let v=0;v<pos.count;v++){
    const local=m3Apply(inverse,[pos.getX(v)-origin[0],pos.getY(v)-origin[1],pos.getZ(v)-origin[2]]);
    const p:Point=[(local[0]+rest[0])*side/scale,(local[1]+rest[1])/scale,(local[2]+rest[2])/scale];
    let distance=Infinity, displacement:Point=[0,0,0],radius=0;
    for(const f of fingers){
      const old=line(f,false), next=line(f,true);
      for(let j=0;j<3;j++){
        const a=old[j],b=old[j+1],d=b.map((x,k)=>x-a[k]);
        const t=Math.max(0,Math.min(1,d.reduce((sum,x,k)=>sum+x*(p[k]-a[k]),0)/d.reduce((sum,x)=>sum+x*x,0)));
        const center=a.map((x,k)=>x+t*d[k]);
        const r=p.map((x,k)=>x-center[k]);
        const dist=Math.hypot(...r);
        if(dist>=distance)continue;
        distance=dist;radius=f[1];
        const angle=-([65,125,160][j]-f[4+j])*Math.PI/180;
        const c=Math.cos(angle),s=Math.sin(angle);
        const rotated=[r[0]*c-r[1]*s,r[0]*s+r[1]*c,r[2]];
        displacement=next[j].map((x,k)=>x+t*(next[j+1][k]-x)+rotated[k]-p[k]) as Point;
      }
    }
    const root=Math.max(0,Math.min(1,(.788-p[1])/.015));
    const radial=Math.max(0,Math.min(1,(radius*1.7-distance)/(radius*.45)));
    const w=root*radial;
    const worldDelta=m3Apply(rot,[displacement[0]*w*scale*side,displacement[1]*w*scale,displacement[2]*w*scale]);
    for(let k=0;k<3;k++){
      const d=worldDelta[k];
      delta[v*3+k]=d;target[v*3+k]=pos.array[v*3+k]+d;
    }
  }
  // Recompute the closed-hand normals so highlights follow the finger bend.
  const closed=g.clone();closed.setAttribute('position',new BufferAttribute(target,3));closed.computeVertexNormals();
  const normal=closed.getAttribute('normal'), nd=new Float32Array(delta.length);
  for(let i=0;i<nd.length;i++)nd[i]=normal.array[i]-base.array[i];
  closed.dispose();
  g.morphTargetsRelative=true;
  g.morphAttributes.position=[new BufferAttribute(delta,3)];
  g.morphAttributes.normal=[new BufferAttribute(nd,3)];
}
