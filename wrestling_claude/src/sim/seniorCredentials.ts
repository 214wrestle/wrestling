/** Senior Worlds/Olympics only: bio display, never NCAA rating inputs. */
export interface SeniorHonors { olympicGold:number;worldGold:number;olympicSilver?:number;worldSilver?:number;olympicBronze?:number;worldBronze?:number;source:string; }
export const SENIOR_HONORS:Record<string,SeniorHonors>={
 'Myles Amine':{olympicGold:0,worldGold:0,olympicBronze:1,worldBronze:1,source:'https://gostanford.com/news/2026/07/20/amine-joins-staff'},
 'Mason Parris':{olympicGold:0,worldGold:0,worldBronze:1,source:'https://www.themat.com/profiles/mason-parris'},
 'Adam Coon':{olympicGold:0,worldGold:0,worldSilver:1,source:'https://content.themat.com/2020-OlympicMediaGuide.pdf'},
 'Joe McFarland':{olympicGold:0,worldGold:0,worldSilver:1,source:'https://nwhof.org/national-wrestling-hall-of-fame/bio/4549'},
 'Randy Lewis':{olympicGold:1,worldGold:0,source:'https://hof.hawkeyesports.com/inductees/randall-scott-lewis/'},
 'Dave Schultz':{olympicGold:1,worldGold:1,worldSilver:3,worldBronze:2,source:'https://www.themat.com/news/2006/january/26/detailed-wrestling-biography-o-13935'},
 'Royce Alger':{olympicGold:0,worldGold:0,worldSilver:1,source:'https://api.nwhof.org/national-wrestling-hall-of-fame-dan-gable-museum/bio/12791'},
 'Tom Brands':{olympicGold:1,worldGold:1,source:'https://www.themat.com/news/2001/february/08/tom-brands-elected-as-distingu-1375'},
 'Terry Brands':{olympicGold:0,worldGold:2,olympicBronze:1,source:'https://nwhof.org/hall_of_fame/bio_by_name/terry-brands'},
 'Kenny Monday':{olympicGold:1,worldGold:1,olympicSilver:1,worldSilver:1,source:'https://nwhof.org/news/monday-feldman-inducted-into-uww-hall-of-fame'},
 'Cael Sanderson':{olympicGold:1,worldGold:0,worldSilver:1,source:'https://content.usawmembership.com/articles/10665'},
 'Kendall Cross':{olympicGold:1,worldGold:0,source:'https://nwhof.org/hall_of_fame/bio/771'},
 'Mark Schultz':{olympicGold:1,worldGold:2,source:'https://nwhof.org/national-wrestling-hall-of-fame/bio/100'},
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
 if(gold)parts.push(`${gold}x World/Olympic Champ`);
 const silver=(h.olympicSilver??0)+(h.worldSilver??0);
 const bronze=(h.olympicBronze??0)+(h.worldBronze??0);
 if(silver)parts.push(`${silver}x World/Olympic Silver Medalist`);
 if(bronze)parts.push(`${bronze}x World/Olympic Bronze Medalist`);
 return parts.join(' · ')||undefined;
}
