import { EffortPulse } from '../anim/effortPulse';
for(const hz of [30,60,120]) {
  const pulse=new EffortPulse(); let max=0,repeatPeaks=0;
  for(let frame=0;frame<hz*2;frame++) {
    // Repeated feedback every frame is deliberately worse than normal input.
    pulse.trigger('fight',false,'ok'); pulse.advance(1/hz,.42);
    const value=Math.sin(Math.PI*pulse.age/.42);
    max=Math.max(max,value); if(value>.95) repeatPeaks++;
  }
  if(max<.95 || repeatPeaks<3) throw new Error(`Repeated input starved motion at ${hz}Hz`);
  for(let frame=0;frame<hz*2;frame++) pulse.advance(1/hz,.42);
  if(pulse.age<.42) throw new Error('Animation kept repeating after input stopped');
  pulse.trigger('shoot',false,'lost');
  if(pulse.age!==0 || pulse.button!=='shoot') throw new Error('New action did not begin immediately');
}
console.log('Repeated effort reaches full motion at 30/60/120Hz, then settles; new actions start immediately');

for(const hz of [30,60,120]) {
  const pulse=new EffortPulse(); let max=0;
  for(let frame=0;frame<hz;frame++) {
    pulse.trigger('shoot',false,frame%2 ? 'blocked' : 'lost');
    const duration=pulse.result==='lost' ? .65 : .42;
    pulse.advance(1/hz,duration);
    max=Math.max(max,Math.sin(Math.PI*pulse.age/(pulse.result==='lost' ? .65 : .42)));
  }
  if(max<.95) throw new Error(`Changing outcomes starved motion at ${hz}Hz`);
}
const pending=new EffortPulse();
pending.trigger('shoot',false,'lost'); pending.advance(.2,.65);
pending.trigger('shoot',false,'blocked');
if(pending.age!==.2 || pending.result!=='lost') throw new Error('Queued result interrupted active attempt');
pending.advance(.46,.65);
if(String(pending.result)!=='blocked') throw new Error('Queued outcome was discarded');
pending.trigger('shoot',false,'ok'); pending.clearQueued(); pending.advance(1,.42);
if(pending.age<.42) throw new Error('Position change retained queued repeat');
console.log('Alternating outcomes preserve motion and replay the latest result; clearing cancels repeats');
