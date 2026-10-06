import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const result=await build({entryPoints:['src/sim/roster.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {ROSTER}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const athletes=ROSTER.map(w=>({id:w.id,name:`${w.firstName} ${w.lastName}`,school:w.school.name,weight:w.weightClass,role:w.legends.role,
 status:w.ncaaCareer?'verified':'pending',rating:w.rating??null,
 countedSeasons:w.ncaaCareer?.counted.map(s=>({year:s.year,place:s.place,source:s.source}))??[],
 excludedSeasons:w.ncaaCareer?.excluded.map(s=>({year:s.year,place:s.place,source:s.source}))??[]}));
const verified=athletes.filter(a=>a.status==='verified');
const report={generated:new Date().toISOString(),rosterSlots:athletes.length,verifiedSlots:verified.length,pendingSlots:athletes.length-verified.length,
 verifiedCareers:new Set(verified.map(a=>a.name)).size,athletes};
await writeFile('docs/rosters/rating-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(`${report.verifiedCareers} verified careers across ${report.verifiedSlots} slots; ${report.pendingSlots} pending slots`);
