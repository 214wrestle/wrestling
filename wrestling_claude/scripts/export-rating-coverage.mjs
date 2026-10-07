import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
const result=await build({stdin:{contents:"export {ROSTER} from './src/sim/roster'; export {COLLEGE_RECORDS} from './src/sim/ratings'; export {PROVISIONAL_RATINGS} from './src/sim/provisionalRatings';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {ROSTER,COLLEGE_RECORDS,PROVISIONAL_RATINGS}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const athletes=ROSTER.map(w=>({id:w.id,name:`${w.firstName} ${w.lastName}`,school:w.school.name,weight:w.weightClass,role:w.legends.role,
 status:w.ncaaCareer?'verified':PROVISIONAL_RATINGS[`${w.firstName} ${w.lastName}`]?'provisional':'pending',rating:w.rating??null,
 ...(PROVISIONAL_RATINGS[`${w.firstName} ${w.lastName}`]?{resolution:PROVISIONAL_RATINGS[`${w.firstName} ${w.lastName}`]}:{}),
 collegeRecordStatus:COLLEGE_RECORDS[`${w.firstName} ${w.lastName}`]?.evidenceStatus ?? (COLLEGE_RECORDS[`${w.firstName} ${w.lastName}`]?'verified':'pending'),
 collegeRecord:COLLEGE_RECORDS[`${w.firstName} ${w.lastName}`]??null,
 ...(w.ncaaCareer?.activeThrough?{careerState:'active',verifiedThrough:w.ncaaCareer.activeThrough}:{}),
 countedSeasons:w.ncaaCareer?.counted.map(s=>({year:s.year,place:s.place,...(s.division?{division:s.division}:{}),source:s.source}))??[],
 excludedSeasons:w.ncaaCareer?.excluded.map(s=>({year:s.year,place:s.place,...(s.division?{division:s.division}:{}),source:s.source}))??[]}));
const verified=athletes.filter(a=>a.status==='verified');
const recordGaps=[...new Set(verified.filter(a=>a.collegeRecordStatus==='pending').map(a=>a.name))].sort();
const recordsVerified=[...new Set(athletes.filter(a=>a.collegeRecordStatus==='verified').map(a=>a.name))];
const report={generated:new Date().toISOString(),rosterSlots:athletes.length,verifiedSlots:verified.length,pendingSlots:athletes.filter(a=>a.status==='pending').length,provisionalSlots:athletes.filter(a=>a.status==='provisional').length,
 statusScope:'status and verified counts refer only to NCAA counted-season coverage; collegeRecordStatus tracks the separate college W-L input. Ratings remain provisional.',
 verifiedCareers:new Set(verified.map(a=>a.name)).size,verifiedCollegeRecords:recordsVerified.length,
 provisionalCollegeRecords:new Set(athletes.filter(a=>a.collegeRecordStatus==='provisional-reconstruction').map(a=>a.name)).size,
 placementVerifiedCareersMissingCollegeRecord:recordGaps.length,athletes};
await writeFile('docs/rosters/rating-coverage.json',JSON.stringify(report,null,2)+'\n');
await writeFile('outputs/college-record-evidence-gaps.json',JSON.stringify({note:'NCAA counted-season coverage is complete for these careers, but college W-L remains unverified. No assumed record adjustment.',names:recordGaps},null,2)+'\n');
console.log(`${report.verifiedCareers} complete NCAA placement careers across ${report.verifiedSlots} slots; ${report.provisionalSlots} provisional resolutions; ${report.pendingSlots} unresolved slots; ${recordGaps.length} completed-placement careers still missing college W-L`);
