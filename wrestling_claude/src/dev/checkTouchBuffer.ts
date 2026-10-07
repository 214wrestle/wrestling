import { TouchBuffer } from '../engine/TouchBuffer';
import { NO_PAD } from '../engine/Input';
const ok=(v:unknown,m:string)=>{if(!v)throw Error(m)};
for(const key of ['shoot','fight','sprawl','level','lowSingle','scramble','legRide','closePockets','catchLeg'] as const){
 const b=new TouchBuffer();
 b.set({...NO_PAD,[key]:true}); b.set({...NO_PAD});
 ok(b.sample()[key],`${key}: sub-frame tap retained`);
 ok(!b.sample()[key],`${key}: released tap not stuck`);
 b.set({...NO_PAD,[key]:true}); b.set({...NO_PAD});
 b.set({...NO_PAD,[key]:true}); b.set({...NO_PAD});
 ok(b.sample()[key],`${key}: first rapid tap`);
 ok(!b.sample()[key],`${key}: release between taps`);
 ok(b.sample()[key],`${key}: second rapid tap`);
 b.clear();b.set({...NO_PAD,[key]:true});
 for(let n=0;n<120;n++)ok(b.sample()[key],`${key}: hold stays continuous`);
 b.clear();ok(!b.sample()[key],`${key}: clearing prevents ghost input`);
}
for(const [key,value] of [['technique','slideBy'],['legAction','lift']] as const){
 const b=new TouchBuffer();b.set({...NO_PAD,[key]:value});b.set({...NO_PAD});
 ok(b.sample()[key]===value,`${key}: quick tap retained`);ok(!b.sample()[key],`${key}: released`);
}
console.log('Touch taps, rapid retaps, holds, special controls and clearing verified');

// A cancelled pointer must not replay a queued tap on the next simulation step.
for (const key of ['shoot','fight','sprawl','level','lowSingle','scramble','legRide','closePockets','catchLeg','technique','legAction'] as const) {
 const b = new TouchBuffer();
 const value = key === 'technique' ? 'slideBy' : key === 'legAction' ? 'lift' : true;
 b.set({...NO_PAD,[key]:value}); b.cancel(key);
 ok(!b.sample()[key],`${key}: cancellation discards queued attempt`);
 b.set({...NO_PAD,[key]:value}); ok(b.sample()[key],`${key}: next deliberate press still works`);
}
const independent = new TouchBuffer();
independent.set({...NO_PAD,shoot:true,fight:true}); independent.cancel('shoot');
const afterCancel = independent.sample();
ok(!afterCancel.shoot && afterCancel.fight,'cancelling one control preserves the other');
console.log('Cancelled gestures cannot replay ghost presses or cancel unrelated controls');
