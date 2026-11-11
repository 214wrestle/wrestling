import type { KitLook } from './material';
import { RESEARCHED_KITS, SCHOOL_KITS } from './schoolKits';

/**
 * The competition singlet a school wore in a given span of seasons (spring years, inclusive).
 * Colours override the school's current ones; anything left out keeps them. Each entry cites
 * what it was read from; `inferred` marks a span filled in from the entries around it.
 */
export interface EraKit {
  from: number;
  to: number;
  kit: KitLook;
  primary?: string;
  secondary?: string;
  piping?: string;
  /** Chest wordmark ('' for none: a logo-only chest) and its colour; left out keeps the school's. */
  mark?: string;
  markColor?: string;
  /** The wordmark's first line arches across the chest; '\n' in `mark` stacks lines (PENN over STATE). */
  markArch?: boolean;
  source: string;
  inferred?: boolean;
}

// NCAA uniform history (outputs/nov08-likeness/research-singlets.json): three-piece uniform with full
// tights from 1965–66; singlets allowed around 1970 but still over tights through the 1970s; tights
// largely gone by the late 1980s. Cuts were deep (low scoop, armholes down the ribs) through the 1990s,
// then rose; legs grew longer. Cut and leg values for those eras are that norm, marked inferred.
const RULES = 'https://intermatwrestle.com/articles.html/college/history-of-wrestling-uniforms-r81607';

export const ERA_KITS: Record<string, EraKit[]> = {
  iowa: [
    { from: 1960, to: 1970, kit: { cut: 0.9, leg: 0.12, panel: false, tights: '#151515' }, primary: '#151515', piping: '#ffcd00', source: RULES, inferred: true },
    { from: 1971, to: 1979, kit: { cut: 0.85, leg: 0.13, panel: false, tights: '#151515' }, primary: '#151515', piping: '#ffcd00', source: RULES, inferred: true },
    // Gable era: plain black ("the perfect singlet", Brands); Iowa PBS duals 1980–86 "in the black".
    { from: 1980, to: 1994, kit: { cut: 0.75, leg: 0.14, panel: false }, primary: '#151515', piping: '#ffcd00',
      source: 'https://www.pbs.org/video/university-of-iowa-vs-iowa-state-university-s3rgiz' },
    // Herky era 1994–95 to January 2009: all black, gold IOWA on the leg, thin gold hem stripes (2007 photo).
    { from: 1995, to: 2008, kit: { cut: 0.45, leg: 0.17, panel: false, hemStripes: '#ffcd00' }, primary: '#151515', piping: '#ffcd00',
      source: 'https://commons.wikimedia.org/wiki/File:Mark_Perry_wrestles_Michael_Patrovich.jpeg' },
    // 2009 NCAA final, Brent Metcalf (Tech-Fall): plain black (November 11 singlet review).
    { from: 2009, to: 2017, kit: { cut: 0.2, leg: 0.19, panel: false, hemStripes: '#ffcd00' }, primary: '#151515', piping: '#ffcd00',
      source: 'http://www.tech-fall.com/2009CLG/09NCAA52.html' },
    // Nike era: plain black, modern high cut, two thin gold hem stripes (2020 Iowa vs Penn State photos).
    { from: 2018, to: 2030, kit: { cut: 0, leg: 0.2, panel: false, hemStripes: '#ffcd00' }, primary: '#151515', piping: '#ffcd00',
      source: 'https://commons.wikimedia.org/wiki/Category:Iowa_State_Cyclones_vs_Penn_State_Nittany_Lions_wrestling_(01-31-2020)' },
  ],
  'iowa-state': [
    // Gable wore the three-piece uniform with tights in the 1970 NCAA final.
    { from: 1960, to: 1970, kit: { cut: 0.9, leg: 0.12, panel: false, tights: '#5c0d1f' }, primary: '#9e1736', piping: '#f5c635',
      source: 'https://intermatwrestle.com/articles.html/college/history-of-wrestling-uniforms-r81607' },
    { from: 1971, to: 1979, kit: { cut: 0.85, leg: 0.13, panel: false, tights: '#5c0d1f' }, primary: '#9e1736', piping: '#f5c635', source: RULES, inferred: true },
    // Iowa PBS duals 1980–86: Iowa State "in the red", home and away.
    { from: 1980, to: 1992, kit: { cut: 0.75, leg: 0.14, panel: false }, primary: '#9e1736', piping: '#f5c635',
      source: 'https://www.pbs.org/video/iowa-state-university-vs-university-of-iowa-rcdnst' },
    // 2002 NCAA final, Cael Sanderson (Getty 640617484): cardinal, gold ISU across the chest, gold piping, wide gold leg cuff.
    { from: 1993, to: 2005, kit: { cut: 0.35, leg: 0.17, panel: false, cuff: '#f5c635' }, primary: '#9e1736', piping: '#f5c635', mark: 'ISU', markColor: '#f5c635',
      source: 'https://www.gettyimages.com/detail/news-photo/cael-sanderson-of-iowa-state-university-defeats-jon-trenge-news-photo/640617484' },
    { from: 2006, to: 2012, kit: { cut: 0.2, leg: 0.19, panel: false, cuff: '#f5c635' }, primary: '#9e1736', piping: '#f5c635', source: RULES, inferred: true },
    // 2015 NCAA photos: solid cardinal, gold trim, gold I-STATE across the chest, wide gold leg cuffs.
    { from: 2013, to: 2016, kit: { cut: 0.1, leg: 0.2, panel: false, cuff: '#f5c635' }, primary: '#9e1736', piping: '#f5c635', mark: 'I-STATE', markColor: '#f5c635',
      source: 'https://cyclones.com/sports/wrestling/roster/michael-moreno/1333' },
    { from: 2017, to: 2030, kit: { cut: 0, leg: 0.2, panel: false, cuff: '#f5c635' }, primary: '#9e1736', piping: '#f5c635', source: RULES, inferred: true },
  ],
  'penn-state': [
    // Navy with the white waistband throughout (Koll-era design, per a fan forum; confirmed on 2020 photos).
    { from: 1960, to: 1979, kit: { cut: 0.88, leg: 0.12, panel: false, chestBand: '#ffffff', bandY: 1.03, tights: '#0b1a33' }, primary: '#001e44', piping: '#ffffff', source: RULES, inferred: true },
    // 1984 NCAA, Carl DeStefanis: navy, white stacked serif PENN / STATE, white waistband.
    { from: 1980, to: 1991, kit: { cut: 0.75, leg: 0.14, panel: false, chestBand: '#ffffff', bandY: 1.03 }, primary: '#001e44', piping: '#ffffff', mark: 'PENN\nSTATE',
      source: 'https://johnnythompsonnum1.blogspot.com/2021/08/defending-title-1984-those-who-did-and.html' },
    // Kerry McCoy, late 1990s (Daily Collegian): navy, white stacked PENN STATE, white waistband, two white hem stripes.
    { from: 1992, to: 2008, kit: { cut: 0.45, leg: 0.17, panel: false, chestBand: '#ffffff', bandY: 1.03, hemStripes: '#ffffff' }, primary: '#001e44', piping: '#ffffff', mark: 'PENN\nSTATE',
      source: 'https://www.psucollegian.com/sports/wrestling/kerry-mccoy-ed-ruth-and-kevin-jackson-are-trying-to-increase-diversity-in-wrestling-and/article_5c8d642a-4e07-11ea-bdee-8bc4b7f1f05c.html' },
    // Nick Lee vs Ohio State, 2020: navy, white PENN STATE, white waistband, two white hem stripes, high cut.
    { from: 2009, to: 2030, kit: { cut: 0, leg: 0.2, panel: false, chestBand: '#ffffff', bandY: 1.03, hemStripes: '#ffffff' }, primary: '#001e44', piping: '#ffffff',
      source: 'https://commons.wikimedia.org/wiki/File:Penn_State_Wrestling,_Nick_Lee_vs._Ohio_State.jpg' },
  ],
};

/**
 * The era singlet for a school in a season, if one is recorded: the hand entries above first, then the photo research
 * (outputs/nov11-singlets, generated into schoolKits.ts). A season outside every era takes the nearest one.
 */
export function eraKitFor(schoolId: string, season: number | undefined): EraKit | undefined {
  const eras = ERA_KITS[schoolId] ?? RESEARCHED_KITS[schoolId];
  if (!eras?.length) return undefined;
  if (season === undefined) return eras[eras.length - 1];
  return eras.find((k) => season >= k.from && season <= k.to)
    ?? eras.reduce((best, k) => (Math.min(Math.abs(season - k.from), Math.abs(season - k.to)) < Math.min(Math.abs(season - best.from), Math.abs(season - best.to)) ? k : best));
}

/** A school's colours and wordmark (researched), for schools not otherwise in the game, such as an Icon's own school. */
export const schoolColours = (kitId: string) => SCHOOL_KITS[kitId];

/** The kit id for a school name ("Fresno State" -> "fresno-state"). */
export const kitIdOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
