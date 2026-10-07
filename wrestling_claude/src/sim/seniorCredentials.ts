/** Senior Worlds/Olympics only: bio display, never NCAA rating inputs. */
export interface SeniorHonors { olympicGold:number;worldGold:number;olympicSilver?:number;worldSilver?:number;olympicBronze?:number;worldBronze?:number;source:string; }
export const SENIOR_HONORS:Record<string,SeniorHonors>={
 'Bobby Weaver':{olympicGold:1,worldGold:0,worldSilver:1,source:'https://lehighsports.com/news/2009/12/30/WREST_10313'},
 'Sam Gerson':{olympicGold:0,worldGold:0,olympicSilver:1,source:'https://pennathletics.com/story.aspx?file_date=11-24-2014&filename=5771a41fe4b0028e7235ae75_131492843341536113'},
 'Bill Smith':{olympicGold:1,worldGold:0,source:'https://nwhof.org/hall_of_fame/bio/31'},
 'Joe Colon':{olympicGold:0,worldGold:0,worldBronze:1,source:'https://unipanthers.com/news/2022/1/11/uni-wrestlings-joe-colon-to-be-inducted-into-glen-brand-hall-of-fame'},
 'Gerald Leeman':{olympicGold:0,worldGold:0,olympicSilver:1,source:'https://unipanthers.com/sports/2023/12/29/history-memorable-moments'},
 'Trent Hidlay':{olympicGold:0,worldGold:1,source:'https://gopack.com/news/2026/6/8/wrestling-former-teammates-fighting-for-a-spot-on-the-world-team'},
 'Nick Gwiazdowski':{olympicGold:0,worldGold:0,worldBronze:2,source:'https://cornellbigred.com/sports/wrestling/roster/coaches/nick-gwiazdowski/7837'},
 'Sam Henson':{olympicGold:0,worldGold:1,olympicSilver:1,worldBronze:1,source:'https://nwhof.org/hall_of_fame/bio/3521'},
 'Rick Sanders':{olympicGold:0,worldGold:1,olympicSilver:2,worldSilver:1,worldBronze:1,source:'https://nwhof.org/hall_of_fame/bio/74'},
 'Kevin Jackson':{olympicGold:1,worldGold:2,source:'https://lasportshall.com/?inductees=kevin-jackson'},
 'Kurt Angle':{olympicGold:1,worldGold:1,source:'https://clariongoldeneagles.com/honors/clarion-university-sports-hall-of-fame/kurts-angle/60'},
 'Stephen Neal':{olympicGold:0,worldGold:1,source:'https://gorunners.com/news/2021/11/24/wrestling-stephen-neal-to-be-inducted-into-csub-alumni-hall-of-fame'},
 'Jake Herbert':{olympicGold:0,worldGold:0,worldSilver:1,source:'https://nusports.com/news/2009/09/22/herbert-wrestles-to-silver-medal-at-2009-world-championships'},
 'Stephen Abas':{olympicGold:0,worldGold:0,olympicSilver:1,source:'https://gobulldogs.com/news/2004/8/28/Stephen_Abas_Claims_Olympic_Silver'},
 'Brandon Slay':{olympicGold:1,worldGold:0,source:'https://api.nwhof.org/national-wrestling-hall-of-fame/bio/3758'},
 'Les Gutches':{olympicGold:0,worldGold:1,worldBronze:1,source:'https://osubeavers.com/honors/hall-of-fame/les-gutches/102'},
 'Zeke Jones':{olympicGold:0,worldGold:1,olympicSilver:1,worldBronze:1,source:'https://thesundevils.com/asu-wrestling-senior-world-team-members'},
 'Jack Reinwand':{olympicGold:0,worldGold:0,worldBronze:1,source:'https://uwbadgers.com/news/2013/8/26/Hall_of_Fame_Class_of_2013_Jack_Reinwand'},
 'Jim Haines':{olympicGold:0,worldGold:0,worldSilver:1,source:'https://uwbadgers.com/news/2012/8/27/Hall_of_Fame_Class_of_2012_Jim_Haines'},
 'Andy Rein':{olympicGold:0,worldGold:0,olympicSilver:1,source:'https://nwhof.org/hall_of_fame/bio/5960'},
 'Donny Pritzlaff':{olympicGold:0,worldGold:0,worldBronze:1,source:'https://scarletknights.com/sports/wrestling/roster/coaches/donny-pritzlaff/4480'},
 'Lee Kemp':{olympicGold:0,worldGold:3,source:'https://uwwsports.com/sports/wrestling/roster/coaches/lee-kemp/731'},
 'Stevan Micic':{olympicGold:0,worldGold:1,worldBronze:1,source:'https://www.cliffkeenwrestlingclub.com/three-michigan-alums-capture-world-medals-in-belgrade/'},
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
