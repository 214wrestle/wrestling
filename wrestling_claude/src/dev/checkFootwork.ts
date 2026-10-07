import { Footwork } from '../anim/footwork';
import { createPosture, P, BALL_Y, FOOT } from '../anim/posture';
for (const walking of [false,true]) for (const hz of [30,60,120]) for (const [vx,vz] of [[0,.85],[.65,0],[0,-.65]]) {
  const gait=new Footwork(); const p=createPosture(); let plants=0, maxLift=0;
  gait.onPlant=()=>plants++;
  const previous=[0,0,0,0];
  for(let frame=0;frame<hz*4;frame++) {
    const t=frame/hz;
    p[P.HIPS]=vx*t; p[P.HIPS+2]=vz*t;
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
      p[at]=vx*t+side*(walking?.11:.19); p[at+1]=BALL_Y;
      p[at+2]=vz*t+(walking?0:side*.17);
    }
    p[P.FOOT_L+FOOT.HEEL]=p[P.FOOT_R+FOOT.HEEL]=0;
    gait.update(1/hz,p,vx,vz,1,walking); gait.apply(p,1);
    if(walking) for(const at of [P.FOOT_L,P.FOOT_R]) {
      const heel=p[at+FOOT.HEEL];
      const heelClearance=p[at+1]-BALL_Y+.23*Math.sin(Math.min(0,heel));
      if(heelClearance < -1e-6) throw Error('Landing heel rotation exceeds foot clearance');
    }
    const left=p[P.FOOT_L+1]-BALL_Y,right=p[P.FOOT_R+1]-BALL_Y;
    if(left>.0001 && right>.0001) throw Error('Both feet airborne during grounded locomotion');
    maxLift=Math.max(maxLift,left,right);
    const coords=[p[P.FOOT_L],p[P.FOOT_L+2],p[P.FOOT_R],p[P.FOOT_R+2]];
    if(frame>0 && coords.some((v,i)=>Math.abs(v-previous[i])>.16)) throw Error(`Foot target jumped: walk=${walking} hz=${hz} velocity=${vx},${vz} frame=${frame} delta=${coords.map((v,i)=>v-previous[i])}`);
    previous.splice(0,4,...coords);
  }
  if(plants<5 || maxLift<(walking?.05:.025)) throw Error('Missing readable step cycles');
  if(maxLift>(walking?.066:.046)) throw Error('Locomotion is lifting feet like high-knee marching');
}
console.log('Forward, reverse and lateral steps retain ground support and readable lift at 30/60/120 Hz');

// Start, pivot while moving, reverse, then release input. Feet must settle.
for(const hz of [30,60,120]) {
  const gait=new Footwork(),p=createPosture(); let x=0,z=0,latePlants=0;
  gait.onPlant=()=>{ if(time>4) latePlants++; };
  let time=0,previous:number[]|undefined,maxSpeed=0;
  let previousHeights: number[] | undefined;
  for(let frame=0;frame<hz*5;frame++) {
    time=frame/hz;
    const yaw=time<1?0:time<2?(time-1)*Math.PI/2:Math.PI/2;
    const speed=time<1.5?.85:time<2.5?-.65:0;
    const vx=Math.sin(yaw)*speed,vz=Math.cos(yaw)*speed;
    x+=vx/hz;z+=vz/hz;
    p[P.HIPS]=x; p[P.HIPS+2]=z;
    p[P.FOOT_L+FOOT.HEEL]=p[P.FOOT_R+FOOT.HEEL]=0;
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
      p[at]=x+side*.11*Math.cos(yaw);p[at+1]=BALL_Y;
      p[at+2]=z-side*.11*Math.sin(yaw);p[at+3]=yaw;
    }
    gait.update(1/hz,p,vx,vz,1,true);gait.apply(p,1);
    const coords=[p[P.FOOT_L],p[P.FOOT_L+2],p[P.FOOT_R],p[P.FOOT_R+2]];
    if(previous) maxSpeed=Math.max(maxSpeed,...coords.map((v,i)=>Math.abs(v-previous![i])*hz));
    const heights=[p[P.FOOT_L+1],p[P.FOOT_R+1]];
    if(previous && previousHeights) for(let foot=0;foot<2;foot++) {
      if(Math.abs(heights[foot]-BALL_Y)<1e-7 && Math.abs(previousHeights[foot]-BALL_Y)<1e-7) {
        if(Math.hypot(coords[foot*2]-previous[foot*2],coords[foot*2+1]-previous[foot*2+1])>.0001)
          throw Error('Planted foot slid during direction change');
      }
    }
    previousHeights=heights;
    previous=coords;
  }
  if(latePlants) throw Error('Walking kept stepping after stopping');
  if(Math.max(Math.abs(p[P.FOOT_L+FOOT.HEEL]),Math.abs(p[P.FOOT_R+FOOT.HEEL]))>.001)
    throw Error('Walking left a heel raised after settling to a stop');
  if(maxSpeed>5) throw Error(`Direction change jerked foot: ${maxSpeed} m/s at ${hz}Hz`);
}
console.log('Turning/reversing footsteps remain bounded and settle after input release');

for (const [vx,vz,expected] of [[.65,0,0],[-.65,0,1],[0,.65,0],[0,-.65,1]]) {
  const gait=new Footwork(), p=createPosture(); let first=-1;
  gait.onPlant=foot=>{if(first<0)first=foot;};
  for(let frame=0;frame<90;frame++) {
    const t=frame/60;
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
      p[at]=vx*t+side*.19;p[at+1]=BALL_Y;p[at+2]=vz*t+side*.17;
    }
    gait.update(1/60,p,vx,vz);gait.apply(p,1);
    if(p[P.FOOT_L]-p[P.FOOT_R]<.08) throw Error('Shuffle closed/crossed lateral base');
  }
  if(first!==expected)throw Error('Trailing foot initiated directional shuffle');
}
console.log('Wrestling steps open in the travel direction before the trailing foot follows');

for(const hz of [30,60,120]) for(const [vx,vz] of [[2.7,0],[-2.7,0],[0,2.7],[0,-2.7]]) {
  const gait=new Footwork(),p=createPosture(); let lag=0;
  for(let frame=0;frame<hz*3;frame++) {
    const t=frame/hz;
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
      p[at]=vx*t+side*.19;p[at+1]=BALL_Y;p[at+2]=vz*t+side*.17;
    }
    gait.update(1/hz,p,vx,vz);gait.apply(p,1);
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]])
      lag=Math.max(lag,Math.hypot(p[at]-(vx*t+side*.19),p[at+2]-(vz*t+side*.17)));
  }
  if(lag>.55)throw Error(`Fast stance foot lag ${lag.toFixed(3)}m at ${hz}Hz`);
}
console.log('Fast match-speed steps keep foot lag inside .55m');

// Stationary quarter turns need short clearance steps, not full walking knee lift.
for(const hz of [30,60,120]) for(const scale of [.9,1,1.15]) {
  const gait=new Footwork(),p=createPosture(); let lift=0,plants=0;
  gait.onPlant=()=>plants++;
  for(let frame=0;frame<hz*3;frame++) {
    const yaw=frame<hz*.4?0:Math.PI/2;
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
      p[at]=side*.11*scale*Math.cos(yaw);p[at+1]=BALL_Y*scale;
      p[at+2]=-side*.11*scale*Math.sin(yaw);p[at+FOOT.YAW]=yaw;
      p[at+FOOT.HEEL]=0;
    }
    gait.update(1/hz,p,0,0,1,true,scale);gait.apply(p,1);
    lift=Math.max(lift,(p[P.FOOT_L+1]-BALL_Y*scale)/scale,(p[P.FOOT_R+1]-BALL_Y*scale)/scale);
  }
  if(plants!==2 || lift<.025 || lift>.06) throw Error(`Pivot must take two low steps: ${plants} plants, ${lift}m lift`);
}
console.log('Stationary turns use low clearance steps across body sizes and frame rates');

// A direction reversal in early swing must not teleport the airborne foot.
for(const hz of [60,120,240]) {
  const gait=new Footwork(),p=createPosture();let z=0,previous:number[]|undefined,maxSpeed=0;
  const pose=()=>{for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
    p[at]=side*.11;p[at+1]=BALL_Y;p[at+2]=z;p[at+FOOT.YAW]=0;p[at+FOOT.HEEL]=0;
  }};
  pose();gait.reset(p);z=.15;
  for(let frame=0;frame<hz*.65;frame++) {
    const velocity=frame/hz<.12?1:-1;
    z+=velocity/hz;pose();gait.update(1/hz,p,0,velocity,1,true);gait.apply(p,1);
    const coords=[p[P.FOOT_L+2],p[P.FOOT_R+2]];
    if(previous)maxSpeed=Math.max(maxSpeed,...coords.map((v,i)=>Math.abs(v-previous![i])*hz));
    previous=coords;
  }
  console.log(`Early-swing reversal at ${hz}Hz: ${maxSpeed.toFixed(3)}m/s peak foot speed`);
  if(maxSpeed>4)throw Error('Airborne foot snapped when walking direction reversed');
}

// Release walking input at different points in the stride, not only after reversal.
for(const hz of [30,60,120]) for(const stopAt of [.3,.5,.7,.9,1.1,1.3,1.5]) {
  const gait=new Footwork(),p=createPosture();
  for(let frame=0;frame<hz*4;frame++) {
    const time=frame/hz,z=.85*Math.min(time,stopAt);
    p[P.HIPS+2]=z;
    for(const [at,side] of [[P.FOOT_L,1],[P.FOOT_R,-1]]) {
      p[at]=side*.11;p[at+1]=BALL_Y;p[at+2]=z;
      p[at+FOOT.YAW]=0;p[at+FOOT.HEEL]=0;
    }
    gait.update(1/hz,p,0,time<stopAt?.85:0,1,true);gait.apply(p,1);
  }
  const heel=Math.max(Math.abs(p[P.FOOT_L+FOOT.HEEL]),Math.abs(p[P.FOOT_R+FOOT.HEEL]));
  if(heel>.001)throw Error(`Heel stays lifted after stop at ${stopAt}s (${hz}Hz): ${heel}rad`);
}
console.log('Walking heels settle after stopping at different stride phases');
