import {availableTouchKeys} from '../ui/touchActions';
import { TouchBuffer } from '../engine/TouchBuffer';
import { NO_PAD } from '../engine/Input';
import { TouchGestures } from '../engine/TouchGestures';
const ok=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const g = new TouchGestures();
g.begin(1,'fight',true);g.begin(2,'fight',true);
ok(g.state().fight,'two fingers engage effort');
ok(g.end(1)==='fight' && g.state().fight,'releasing first finger retains second hold');
ok(g.end(1)===undefined && g.state().fight,'duplicate lost-capture does not release another finger');
g.end(2);ok(!g.state().fight,'final finger release ends effort');
g.begin(3,'fight',true);g.begin(4,'sprawl',true);g.end(3);
ok(!g.state().fight && g.state().sprawl,'distinct held controls are independent');
g.begin(5,'legAction','lift');g.begin(6,'legAction','trip');
ok(g.state().legAction==='trip','latest selected leg action takes priority');
g.end(6);ok(g.state().legAction==='lift','releasing latest selection restores still-held lift');
g.clear();ok(g.size===0 && Object.keys(g.state()).length===0,'blur/position/unmount clear every gesture');
console.log('Pointer ownership, duplicate capture loss, simultaneous effort and reset verified');

g.begin(7,'shoot',true);g.begin(8,'shoot',true);g.begin(9,'sprawl',true);
ok(g.cancelKey('shoot'),'context change cancels both fingers on relabeled action');
ok(!g.state().shoot && g.state().sprawl,'unrelated defensive hold survives relabel');
ok(g.end(7)===undefined && g.end(8)===undefined,'late releases from old context cannot act');
ok(!g.cancelKey('shoot'),'repeated cancellation is harmless');
g.begin(10,'shoot',true);ok(g.state().shoot,'fresh deliberate press works after relabel');
console.log('Context cancellation clears relabeled gestures while preserving unrelated holds');

const buffer=new TouchBuffer();
g.clear();g.begin(11,'shoot',true);g.begin(12,'sprawl',true);
buffer.set({...NO_PAD,...g.state()});
// Relabel before the next simulation sample: discard the buffered old action.
g.cancelKey('shoot');buffer.cancel('shoot');buffer.set({...NO_PAD,...g.state()});
const transitioned=buffer.sample();
ok(!transitioned.shoot && transitioned.sprawl,'queued pre-transition tap cannot become new action');
g.begin(13,'shoot',true);buffer.set({...NO_PAD,...g.state()});
ok(buffer.sample().shoot,'fresh post-transition tap survives buffering');
console.log('Relabeled actions cannot replay through the pending input buffer');

// Simple controls: the panel is Shoot, Hand fight, Sprawl and Lower (plus Sit out on bottom).
// Bottom's Lower catches the leg and exists only while his legs are coming in; when they
// leave, a finger holding it must be cancelled with its queued input.
const ride={position:'Top' as const,top:0 as const,humanSide:0 as const,meters:[{label:'Base',value:.5,tone:'you' as const}],legActions:undefined};
const standing={...ride,meters:[]};
const legsComing={...ride,top:1 as const,meters:[{label:'Base',value:.5,tone:'them' as const},{label:'Opening the pocket',value:.4,tone:'them' as const}]};
const legsGone={...legsComing,meters:[{label:'Base',value:.5,tone:'them' as const}]};
const before=availableTouchKeys(legsComing),after=availableTouchKeys(legsGone);
ok(before.has('level')&&!after.has('level'),'bottom Lower appears only while his legs come in');
g.clear();g.begin(21,'level',true);g.begin(22,'level',true);g.begin(23,'fight',true);
buffer.set({...NO_PAD,...g.state()});
for(const key of before)if(!after.has(key)){g.cancelKey(key);buffer.cancel(key);}
buffer.set({...NO_PAD,...g.state()});
const goneInput=buffer.sample();
ok(!goneInput.level && goneInput.fight,'disappearing leg control clears both fingers and queued input');
ok(g.end(21)===undefined&&g.end(22)===undefined,'late release of disappeared control is inert');
ok(!g.state().level,'legs coming back cannot revive removed hold');
g.begin(24,'level',true);ok(g.state().level,'new catch requires deliberate new press');
console.log('Disappearing contextual controls cancel held and buffered input without reviving it');

const top=availableTouchKeys(ride),topStanding=availableTouchKeys(standing);
ok(top.has('level')&&topStanding.has('level'),'top can cut (tap) or work legs in (hold) with Lower');
ok(!availableTouchKeys({...ride,position:'Bottom',top:1}).has('level'),'bottom has no inactive Lower button');
ok(!availableTouchKeys({...ride,meters:[{label:'Pin',value:.5,tone:'you'}]}).has('level'),'top cannot cut from pinning combination');
ok(availableTouchKeys({...standing,position:'Neutral',top:null}).has('level'),'neutral retains level change');
ok(availableTouchKeys({...standing,position:'In on the legs',top:null}).has('level'),'leg finishes offer Lower for the double switch');
console.log('Lower appears only where it has an effect');

for(const state of [ride,standing,legsComing,{...standing,position:'Neutral' as const,top:null},{...standing,position:'In on the legs' as const,top:null}]){
 const keys=availableTouchKeys(state);
 for(const gone of ['technique','lowSingle','scramble','legAction','legRide','closePockets','catchLeg'] as const)ok(!keys.has(gone),`simple controls never show ${gone}`);
 ok(keys.size<=5,'never more than five buttons');
}
console.log('Touch panel stays at Shoot, Hand fight, Sprawl, Lower and Sit out');
