/** NCAA tournament results only; no invented points for cancelled events or missing data. */
export interface NcaaSeason {
  year: number;
  place: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'qualifier';
  outstandingWrestler?: boolean;
  source: string;
}
export interface CareerScore {
  counted: Array<NcaaSeason & { points: number }>;
  excluded: Array<NcaaSeason & { points: number }>;
  placementPoints: number;
  bonusPoints: number;
  total: number;
  eligibilitySeasons: 3 | 4;
  averagePlacementPoints: number;
  averagePoints: number;
  tier: string;
  provisionalRating: number;
}
export function seasonPoints(season: NcaaSeason): number {
  // 3rd = 7: the owner's 10/9/…/2 scale leaves 8 unused.
  const placement = season.place === 0 ? 0 : season.place === 'qualifier' ? 1 : season.place <= 2 ? 11 - season.place : 10 - season.place;
  return placement + (season.outstandingWrestler ? 1 : 0);
}
export function scoreCareer(seasons: readonly NcaaSeason[], eligibilitySeasons: 3 | 4 = 4): CareerScore {
  if (new Set(seasons.map(s => s.year)).size !== seasons.length) throw new Error('Duplicate NCAA season');
  const sorted = seasons.map(s => {
    if (!Number.isInteger(s.year) || (s.place !== 'qualifier' && (!Number.isInteger(s.place) || s.place < 0 || s.place > 8))) throw new Error('Invalid NCAA result');
    return {...s, points: seasonPoints(s)};
  }).sort((a, b) => b.points - a.points || b.year - a.year);
  const counted = sorted.slice(0, eligibilitySeasons);
  const bonusPoints = counted.filter(s => s.outstandingWrestler).length;
  const total = counted.reduce((sum, s) => sum + s.points, 0);
  const averagePlacementPoints = (total - bonusPoints) / eligibilitySeasons;
  const tier = averagePlacementPoints >= 10 ? 'Champion' : averagePlacementPoints >= 9 ? 'Finalist' : averagePlacementPoints >= 7 ? 'Top three' : averagePlacementPoints >= 2 ? 'All-American' : 'Qualifier';
  return {counted, excluded: sorted.slice(eligibilitySeasons), placementPoints: total - bonusPoints, bonusPoints, total,
    eligibilitySeasons, averagePlacementPoints, averagePoints: total / eligibilitySeasons, tier,
    provisionalRating: Math.min(98, Math.round(placementRating(averagePlacementPoints) + bonusPoints))};
}
const gableSource = 'https://nwhof.org/national-wrestling-hall-of-fame/champions-database?tab=ncaa&wrestler=38';
export const CAREER_RECORDS: Record<string, NcaaSeason[]> = {
  'Ed Banach': [{"year":1980,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"},{"year":1981,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"},{"year":1982,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"},{"year":1983,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"}],
  'Barry Davis': [{"year":1981,"place":7,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"},{"year":1982,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"},{"year":1983,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"},{"year":1985,"place":1,"outstandingWrestler":true,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=69"}],
  'Lee Fullhart': [{"year":1996,"place":4,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1997,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1998,"place":3,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1999,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"}],
  'Mark Ironside': [{"year":1995,"place":6,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1996,"place":3,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1997,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1998,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"}],
  'Duane Goldman': [{"year":1983,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1984,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1985,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},{"year":1986,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"}],
  'Lincoln McIlravy': [{"year":1993,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=71"},{"year":1994,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=71"},{"year":1995,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=71"},{"year":1997,"place":1,"outstandingWrestler":true,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=71"}],
  'Mark Perry': [{"year":2005,"place":2,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=72"},{"year":2006,"place":3,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=72"},{"year":2007,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=72"},{"year":2008,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=72"}],
  'Joe Williams': [{"year":1994,"place":7,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=73"},{"year":1996,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=73"},{"year":1997,"place":1,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=73"},{"year":1998,"place":1,"outstandingWrestler":true,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=73"}],
  'Jim Zalesky': [{"year":1981,"place":5,"source":"https://nwhof.org/hall_of_fame/bio/1156"},{"year":1982,"place":1,"source":"https://nwhof.org/hall_of_fame/bio/1156"},{"year":1983,"place":1,"source":"https://nwhof.org/hall_of_fame/bio/1156"},{"year":1984,"place":1,"outstandingWrestler":true,"source":"https://nwhof.org/hall_of_fame/bio/1156"}],
  'Jeff McGinness': [{"year":1994,"place":5,"source":"https://nwhof.org/national-wrestling-hall-of-fame/champions-database?tab=ncaa&wrestler=12746"},{"year":1995,"place":1,"source":"https://nwhof.org/national-wrestling-hall-of-fame/champions-database?tab=ncaa&wrestler=12746"},{"year":1996,"place":"qualifier","source":"https://nwhof.org/brackets/66#page=6"},{"year":1998,"place":1,"source":"https://nwhof.org/national-wrestling-hall-of-fame/champions-database?tab=ncaa&wrestler=12746"}],
  'Kyle Dake': [2010,2011,2012,2013].map(year=>({year,place:1,outstandingWrestler:year===2013,source:'https://cornellbigred.com/news/2013/3/23/WREST_0323131012.aspx?path=wrest'})),
  'David Taylor': [
    {year:2011,place:2,source:'https://gopsusports.com/news/2014/04/01/david-taylor-wins-hodge-trophy-award-for-second-time'},
    {year:2012,place:1,outstandingWrestler:true,source:'https://gopsusports.com/news/2012/04/1/season-wrap-up-nittany-lion-wrestling-season-ending-notes'},
    {year:2013,place:2,source:'https://gopsusports.com/news/2014/04/01/david-taylor-wins-hodge-trophy-award-for-second-time'},
    {year:2014,place:1,outstandingWrestler:true,source:'https://www.psu.edu/news/athletics/story/nittany-lion-wrestlers-win-fourth-consecutive-national-championship'},
  ],
  'Tom Brands': [1989,1990,1991,1992].map(year=>({year,place:year===1989?4:1,outstandingWrestler:year===1992,source:'https://nwhof.org/hall_of_fame/bio_by_name/tom-brands'})),
  'Terry Brands': [
    {year:1989,place:0,source:'https://nwhof.org/brackets/59'},
    {year:1990,place:1,source:'https://nwhof.org/hall_of_fame/bio_by_name/terry-brands'},
    {year:1991,place:2,source:'https://nwhof.org/hall_of_fame/bio_by_name/terry-brands'},
    {year:1992,place:1,source:'https://nwhof.org/hall_of_fame/bio_by_name/terry-brands'},
  ],
  'Michael Moreno': [
    {year:2012,place:0,source:'https://cyclones.com/documents/download/2023/6/12/Record_Book.pdf'},
    {year:2013,place:6,source:'https://cyclones.com/news/2013/3/23/206897262'},
    {year:2014,place:5,source:'https://cyclones.com/news/2014/3/22/209441544'},
    {year:2015,place:'qualifier',source:'https://cyclones.com/news/2015/4/10/210013592'},
  ],
  'Cael Sanderson': [1999, 2000, 2001, 2002].map(year => ({year, place: 1, outstandingWrestler: true, source: 'https://cyclones.com/honors/hall-of-fame/cael-sanderson/176'})),
  'Dan Gable': [
    {year: 1968, place: 1, source: gableSource},
    {year: 1969, place: 1, outstandingWrestler: true, source: 'https://cyclones.com/documents/download/2025/5/14/Record_Book_25_26.pdf'},
    {year: 1970, place: 2, source: gableSource},
  ],
};

/** Explicit verified eligibility; never infer from a missing season. */
export const ELIGIBILITY_SEASONS: Record<string, 3 | 4> = {'Dan Gable': 3};

/** Provisional anchors; interpolate between average placement point levels. */
export function placementRating(average: number): number {
  const anchors = [[0,50],[1,60],[2,70],[3,74],[4,78],[5,82],[6,86],[7,90],[9,95],[10,98]];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i], [px, py] = anchors[i-1];
    if (average <= x) return py + (y-py) * (Math.max(px, average)-px) / (x-px);
  }
  return 98;
}

export interface CollegeRecord { wins: number; losses: number; ties?: number; source: string; }
export const COLLEGE_RECORDS: Record<string, CollegeRecord> = {
  'Ed Banach': {"wins":141,"losses":9,"ties":1,"source":"https://nwhof.org/hall_of_fame/bio/88"},
  'Barry Davis': {"wins":162,"losses":9,"ties":1,"source":"https://navysports.com/news/2026/4/1/navy-wrestling-assistant-coach-barry-davis-announces-his-retirement.aspx"},
  'Lee Fullhart': {"wins":107,"losses":18,"ties":0,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},
  'Mark Ironside': {"wins":127,"losses":10,"ties":0,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},
  'Duane Goldman': {"wins":132,"losses":10,"ties":0,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=70"},
  'Lincoln McIlravy': {"wins":96,"losses":3,"ties":0,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=71"},
  'Mark Perry': {"wins":96,"losses":16,"ties":0,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=72"},
  'Joe Williams': {"wins":129,"losses":9,"ties":0,"source":"https://storage.googleapis.com/hawkeyesports-com/2023/11/ad81eaac-2023-24-media-guide.pdf#page=73"},
  'Jim Zalesky': {"wins":131,"losses":8,"ties":1,"source":"https://nwhof.org/hall_of_fame/bio/1156"},
  'Jeff McGinness': {"wins":127,"losses":16,"ties":0,"source":"https://nwhof.org/national-wrestling-hall-of-fame/champions-database?tab=ncaa&wrestler=12746"},
  'Kyle Dake': {wins:137,losses:4,source:'https://cornellbigred.com/news/2013/3/23/WREST_0323131012.aspx?path=wrest'},
  'David Taylor': {wins:134,losses:3,source:'https://gopsusports.com/news/2014/04/01/david-taylor-wins-hodge-trophy-award-for-second-time'},
  'Tom Brands': {wins:158,losses:7,ties:2,source:'https://hawkeyesports.com/sports/wrestling/roster/season/2024-25/staff/tom-brands'},
  'Terry Brands': {wins:137,losses:7,source:'https://hof.hawkeyesports.com/inductees/terry-michael-brands/'},
  'Michael Moreno': {wins:91,losses:37,source:'https://cyclones.com/sports/wrestling/roster/michael-moreno/1333'},
  'Cael Sanderson': {wins: 159, losses: 0, source: 'https://cyclones.com/honors/hall-of-fame/cael-sanderson/176'},
};
export function recordAdjustment(record: CollegeRecord): number {
  const ties = record.ties ?? 0;
  if ([record.wins, record.losses, ties].some(v => !Number.isInteger(v) || v < 0) || record.wins + record.losses + ties === 0) throw new Error('Invalid college record');
  // Ties count as half a win. Modest adjustment: 75% is neutral, 100% adds 1.
  return 4 * ((record.wins + ties / 2) / (record.wins + record.losses + ties) - 0.75);
}
export function overallRating(name: string, career: CareerScore, record?: CollegeRecord): number {
  if (name === 'Dan Gable' || name === 'Cael Sanderson') return 99;
  return Math.min(98, Math.max(0, Math.round(placementRating(career.averagePlacementPoints) + career.bonusPoints + (record ? recordAdjustment(record) : 0))));
}
