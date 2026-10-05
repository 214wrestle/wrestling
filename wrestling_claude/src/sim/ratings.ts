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
