import { buildLidSurface } from '../body/realistic/lidSurface';
import type { V3 } from '../body/math';
const radius=.0119, globe:V3=[0,0,0],margin:V3[]=[],outer:V3[]=[];
for(let i=0;i<=48;i++) {
 const theta=i*Math.PI*2/48,x=.0108*Math.cos(theta),y=(Math.sin(theta)>=0?.0032:.0025)*Math.sin(theta)+x*.06;
 margin.push([x,y,Math.sqrt(radius**2-x*x-y*y)+.00015]);
 outer.push([.019*Math.cos(theta),.014*Math.sin(theta),.008]);
}
const mesh=buildLidSurface(margin,outer,globe,radius,4,9);
let exposed=0,worst=0,sampled=0;
for(let k=0;k<mesh.indices.length;k+=3) {
 const ids=[mesh.indices[k],mesh.indices[k+1],mesh.indices[k+2]];
 for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]) {
  const p=[0,0,0];for(let j=0;j<3;j++)for(let d=0;d<3;d++)p[d]+=mesh.positions[ids[j]*3+d]*weights[j];
  const r2=p[0]**2+p[1]**2;if(r2>=radius**2)continue;
  sampled++;const depth=Math.sqrt(radius**2-r2)-p[2];
  if(depth>0.00001){exposed++;worst=Math.max(worst,depth);}
 }
}
console.log({sampled,exposed,worstPenetrationMm:worst*1000});
if(exposed)throw new Error('Lid triangles penetrate the globe');
