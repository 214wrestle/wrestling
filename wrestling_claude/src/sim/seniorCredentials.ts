/** Senior Worlds/Olympics only: bio display, never NCAA rating inputs. */
export interface SeniorHonors { olympicGold:number;worldGold:number;olympicSilver?:number;worldSilver?:number;olympicBronze?:number;worldBronze?:number;source:string; }
export const SENIOR_HONORS:Record<string,SeniorHonors>={
 'Dan Gable':{olympicGold:1,worldGold:1,source:'https://api.nwhof.org/national-wrestling-hall-of-fame/bio/38'},
 'Yojiro Uetake':{olympicGold:2,worldGold:0,source:'https://cms.uww.org/person/yojiro-utake'},
 'Dan Hodge':{olympicGold:0,worldGold:0,olympicSilver:1,source:'https://soonersports.com/sports/2019/8/9/211043996'},
 'Lee Roy Smith':{olympicGold:0,worldGold:0,worldSilver:1,source:'https://nwhof.org/staff/1'},
 'John Smith':{olympicGold:2,worldGold:4,source:'https://www.themat.com/news/2020/august/06/history-lesson-john-smith'},
 // Three World bronzes corroborated by USAW's 2020 career retrospective:
 // https://www.themat.com/news/2020/november/19/throwback-thursday-jordan-burroughs-gold-matches
 'Jordan Burroughs':{olympicGold:1,worldGold:6,worldBronze:3,source:'https://www.themat.com/news/athlete-of-week/2022/september/22/jordan-burroughs-selected-as-usa-wrestling-athlete-of-the-week'},
};
export function seniorCredentials(name?:string):string|undefined {
 const h=name?SENIOR_HONORS[name]:undefined;if(!h)return;
 const parts:string[]=[];const gold=h.olympicGold+h.worldGold;
 if(gold)parts.push(h.olympicGold&&h.worldGold?`${gold}x World/Olympic Champ`:h.olympicGold?`${h.olympicGold}x Olympic Champ`:`${h.worldGold}x World Champ`);
 for(const [count,label] of [[h.olympicSilver,'Olympic Silver Medalist'],[h.worldSilver,'World Silver Medalist'],[h.olympicBronze,'Olympic Bronze Medalist'],[h.worldBronze,'World Bronze Medalist']] as const)if(count)parts.push(`${count}x ${label}`);
 return parts.join(' · ')||undefined;
}
