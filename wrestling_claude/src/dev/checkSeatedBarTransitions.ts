import {sampleMove,sampleHold,holdLocal} from '../anim/clips';
import {createLocal,mirrorLocal} from '../anim/spec';
import {registerSeatedBarDrafts} from '../lab/doubleBarFinishDraft';
let maxDelta=0;
for(const scale of [.9,1,1.15])for(const mirror of [false,true])for(const role of ['A','B'] as const){
 registerSeatedBarDrafts(scale);
 for(const clip of ['armBarSeatedExitDraft','armBarSeatedFallDraft']){
  const a=createLocal(),b=createLocal();
  const from=sampleHold('armBarSeatedFinishDraft',role,0,0,0,mirror,a);
  const to=sampleMove(clip,role,0,mirror,b);
  for(let i=0;i<a.length;i++)maxDelta=Math.max(maxDelta,Math.abs(a[i]-b[i]));
  if(JSON.stringify(from)!==JSON.stringify(to))throw Error('Initial grip changes at '+clip);
 }
 // Exit keys use holdAt/holdLocal, before runtime idle struggle is applied.
 const end=createLocal(),flat=holdLocal('flat',role,0);
 sampleMove('armBarSeatedExitDraft',role,1,mirror,end);
 if(mirror)mirrorLocal(flat,flat);
 for(let i=0;i<end.length;i++)maxDelta=Math.max(maxDelta,Math.abs(end[i]-flat[i]));
 if(sampleMove('armBarSeatedExitDraft',role,.41,mirror,createLocal()).length)throw Error('Bar fails to release');
}
if(maxDelta>1e-5)throw Error('Endpoint jump '+maxDelta);
console.log({maxDelta,note:'Authored endpoint/contact checks only; dynamic recovery still requires validation.'});
