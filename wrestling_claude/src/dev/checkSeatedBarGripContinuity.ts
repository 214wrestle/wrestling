import {sampleMove,sampleHold} from '../anim/clips';
import {createLocal} from '../anim/spec';
import {registerSeatedBarDrafts} from '../lab/doubleBarFinishDraft';
for(const scale of [.9,1,1.15])for(const mirror of [false,true]){
 registerSeatedBarDrafts(scale);
 const hand=mirror?'R':'L';
 for(const variant of ['armBar','wristBar']){
  const entry=sampleMove(variant+'SeatedTurnDraft','A',1,mirror,createLocal()).find(c=>c.hand===hand);
  const hold=sampleHold(variant+'SeatedFinishDraft','A',0,0,0,mirror,createLocal()).find(c=>c.hand===hand);
  if(!entry||!hold)throw Error('Missing contact');
  if(variant==='armBar'&&(entry.on!==hold.on||entry.palm!==hold.palm||entry.at.some((v,i)=>Math.abs(v-hold.at[i])>1e-8)))throw Error(`${variant} anchor jumps at landing`);
  if(variant==='wristBar'&&Math.abs(entry.at[1]+.10)>1e-8)throw Error('Wrist-bar anchor changed');
 }
}
console.log('Single seated bar entry/hold anchors continuous; wrist-bar entry anchor preserved across mirrors and sizes');
