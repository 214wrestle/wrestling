import {registerMove,sampleMove} from '../anim/clips';
import {createLocal,type V3} from '../anim/spec';
const start:V3=[.1,-.10,.04],end:V3=[.1,-.08,.04];
const contact={who:'A' as const,hand:'L' as const,on:'forearmL' as const,at:start,from:0,to:1,atPath:[{t:.28,at:start},{t:.58,at:end}]};
registerMove({id:'contactPathCheck',A:[{t:0,pose:{}},{t:1,pose:{}}],B:[{t:0,pose:{}},{t:1,pose:{}}],contacts:[contact]});
for(const mirror of [false,true])for(const t of [0,.1,.28,.43,.58,1]){
 const contacts=sampleMove('contactPathCheck','A',t,mirror,createLocal());
 const c=contacts[0],phase=Math.max(0,Math.min(1,(t-.28)/.30)),blend=phase*phase*(3-2*phase);
 const expected=[mirror?-.1:.1,-.10+.02*blend,.04];
 if(c.at.some((v,i)=>Math.abs(v-expected[i])>1e-8)||c.on!==(mirror?'forearmR':'forearmL'))throw Error('Incorrect contact path/mirror');
 if(sampleMove('contactPathCheck','B',t,mirror,createLocal()).length)throw Error('Role leakage');
}
if(start[1]!==-.10||end[1]!==-.08)throw Error('Authored anchors mutated');
console.log('Contact path endpoints, smooth midpoint, mirrors, role isolation and source preservation pass');
