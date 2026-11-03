/** Zero velocity at both ends avoids a jerk when a grip effort starts or stops. */
export function effortEnvelope(age: number, duration: number): number {
  if (age <= 0 || age >= duration || duration <= 0) return 0;
  const wave = Math.sin(Math.PI * age / duration);
  return wave * wave;
}
export type EffortResult = 'ok'|'won'|'lost'|'blocked';
/** Finish the current physical effort before replaying one queued repeat.
 * Button/result acknowledgements stay immediate in the UI; this only times motion.
 */
export class EffortPulse {
  age=1;
  button='fight';
  reaction=false;
  result: EffortResult='ok';
  private queued: EffortResult | undefined;
  private duration=.42;
  trigger(button:string,reaction:boolean,result:EffortResult,force=false):void {
    if(!force && this.age<this.duration && button===this.button && reaction===this.reaction) {
      // A new outcome must not interrupt the same physical attempt midway.
      // Keep its latest result for the next pulse; the UI acknowledges it now.
      this.queued=result;
      return;
    }
    this.age=0; this.button=button; this.reaction=reaction; this.result=result; this.queued=undefined;
  }
  clearQueued():void { this.queued=undefined; }
  advance(dt:number,duration:number):void {
    this.duration=duration;
    this.age+=dt;
    if(this.age>=duration && this.queued!==undefined) {
      this.age%=duration;
      this.result=this.queued;
      this.queued=undefined;
    }
  }
}
