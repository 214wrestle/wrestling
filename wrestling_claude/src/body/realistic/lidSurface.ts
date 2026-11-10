import type { MeshData } from './mesher';
import type { V3 } from '../math';

/** Continuous orbital skin patch. Its outer row must be sampled from the face
 * surface; this avoids the detached concentric tubes of the SDF experiments.
 * Coordinates, bone and part are supplied by the caller's head-space contract.
 */
export function buildLidSurface(
  margin: readonly V3[], orbital: readonly V3[], globe: V3,
  radius: number, bone: number, part: number, rows = 16,
): MeshData {
  if(margin.length !== orbital.length || margin.length < 3 || rows < 2 || !Number.isInteger(rows) || radius <= 0)
    throw new Error('Invalid lid surface boundaries');
  if(!Number.isFinite(radius) || !Number.isInteger(bone) || bone < 0 ||
    [...margin,...orbital,globe].some(p=>p.length!==3 || p.some(v=>!Number.isFinite(v))))
    throw new Error('Non-finite lid surface geometry');
  const cols=margin.length, count=cols*(rows+1);
  const positions=new Float32Array(count*3), normals=new Float32Array(count*3);
  const skinIndex=new Uint16Array(count*4), skinWeight=new Float32Array(count*4);
  const parts=new Float32Array(count).fill(part), indices:number[]=[];
  for(let r=0;r<=rows;r++) for(let c=0;c<cols;c++) {
    const t=r/rows, ease=t*t*(3-2*t), a=margin[c], b=orbital[c], i=r*cols+c;
    const x=a[0]+(b[0]-a[0])*ease, y=a[1]+(b[1]-a[1])*ease;
    const z=a[2]+(b[2]-a[2])*ease;
    // Cover the globe until blending into the sampled face boundary. Exact
    // boundary positions are retained so adjacent skin can share the seam.
    const coverRadius=radius*1.04;
    const globeZ=globe[2]+Math.sqrt(Math.max(0,coverRadius*coverRadius-(x-globe[0])**2-(y-globe[1])**2));
    positions.set([x,y,r===0||r===rows?z:Math.max(z,globeZ+0.00015*(1-t))],i*3);
    skinIndex[i*4]=bone;skinWeight[i*4]=1;
    if(r<rows&&c<cols-1) {
      const j=i+cols;
      indices.push(i,j,i+1,i+1,j,j+1);
    }
  }
  for(let k=0;k<indices.length;k+=3) {
    const [a,b,c]=indices.slice(k,k+3), p=a*3,q=b*3,s=c*3;
    const ux=positions[q]-positions[p],uy=positions[q+1]-positions[p+1],uz=positions[q+2]-positions[p+2];
    const vx=positions[s]-positions[p],vy=positions[s+1]-positions[p+1],vz=positions[s+2]-positions[p+2];
    const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
    for(const v of [a,b,c]) for(let d=0;d<3;d++) normals[v*3+d]+=n[d];
  }
  for(let i=0;i<count;i++) {
    const n=Math.hypot(normals[i*3],normals[i*3+1],normals[i*3+2]);
    if(n)for(let d=0;d<3;d++)normals[i*3+d]/=n;
    else normals[i*3+2]=1;
  }
  return {positions,normals,indices:Uint32Array.from(indices),skinIndex,skinWeight,part:parts};
}
