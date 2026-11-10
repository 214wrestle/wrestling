import { DEFAULT_MOTION, type StanceLook, type WrestlingStyle } from './athleteProfiles';
import type { Signature, Wrestler } from './types';

/**
 * How real wrestlers wrestled in college, from match film, recaps and coach profiles (each entry
 * cites its sources). Applied after the per-name stance look in `roster.ts`, so anything left out
 * keeps that. These are interpretations of the sources, not measured technique frequencies.
 *
 * Only `motion` fields change the match itself (shot mix, turn preference, pace); `lead` and
 * `look` are animation only. Ratings and attributes are never touched here.
 */
export interface ResearchedStyle {
  /** +1 left foot leads, -1 right foot leads. */
  lead?: 1 | -1;
  look?: Partial<StanceLook>;
  motion?: Partial<WrestlingStyle>;
  /** One line on how he wrestles, for the tale of the tape. */
  summary?: string;
  sources: { label: string; url: string }[];
}

export const ATHLETE_STYLES: Record<string, ResearchedStyle> = {
  'Michael Moreno': {
    look: { stanceWidth: 1.0, levelOffset: 0, stagger: 0.8 },
    motion: { topPatience: 1.2, turnPreference: 1.15, preferredTurn: 'cradle' },
    summary: 'Patient top control with a cradle; ties up in the collar and hand fights from a moderate stance.',
    sources: [
      { label: '2015 Big 12 photo vs Oklahoma State: collar and wrist hand fight, moderate stagger', url: 'https://dxbhsrqyrr690.cloudfront.net/sidearm.nextgen.sites/isuni.sidearmsports.com/images/2015/6/24/Moreno_Michael_Big12_2014_15_2.JPG' },
      { label: '2013 NCAA report: cradle and spladle pins', url: 'https://cyclones.com/news/2013/3/22/206873161' },
    ],
  },
  // From outputs/nov08-likeness/research-*.json: only tendencies a source names (signature attacks, pinning, stance height, pace).
  "Barry Davis": { motion: {shots: {double: 0.25, single: 0.6, highCrotch: 0.15}}, summary: "Single-leg specialist; relentless, low and physical.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.youtube.com/watch?v=SPNqFB2sIq4"}, {label: "Style source", url: "https://www.youtube.com/watch?v=VgniYX9Vr14"}] },
  "Tom Brands": { look: {levelOffset: -0.07}, sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://vault.si.com/vault/1996/06/03/wrestlemania-the-brands-twins-who-live-to-inflict-pain-on-the-mat-are-on-track-for-the-atlanta-olympics"}, {label: "Style source", url: "https://sportsspectrum.com/?p=11026"}] },
  "Terry Brands": { look: {levelOffset: -0.07}, sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://vault.si.com/vault/1996/06/03/wrestlemania-the-brands-twins-who-live-to-inflict-pain-on-the-mat-are-on-track-for-the-atlanta-olympics"}, {label: "Style source", url: "https://fanaticwrestling.com/products/the-art-of-crushing-pressure-by-terry-brands"}] },
  "Lincoln McIlravy": { look: {levelOffset: -0.08}, motion: {handActivity: 1.2}, summary: "Very low stance and deep level changes; arm drags into leg attacks.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/Lincoln_McIlravy"}, {label: "Style source", url: "https://content.usawmembership.com/articles/2256"}] },
  "Mark Perry": { motion: {attackRate: 0.85, topPatience: 1.2, turnPreference: 1.3}, summary: "Mat specialist: patient on his feet, dangerous turns on top, comfortable scrambling.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/perry-comfortable-and-confident-in-new-weight-class-r65920"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/perry-defeats-rival-hendricks-to-win-title-r68010"}] },
  "Ed Banach": { motion: {turnPreference: 1.3}, summary: "Violent pinner: 73 career falls; quick and strong on his feet.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.college-sports-journal.com/perseverance-and-character-helped-banachs-propel-iowa-wrestling-to-new-heights"}, {label: "Style source", url: "https://mail.njsportsheroes.com/edbanachbxw.html"}] },
  "Duane Goldman": { motion: {circle: 1.1}, summary: "Creative, unusual offense: drags and moves few had seen.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://hawkeyesports.com/news/2009/09/04/4-time-ncaa-finalist-goldman-to-ui-hall-of-fame"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/1983_NCAA_Division_I_Wrestling_Championships"}] },
  "Stephen Buchanan II": { motion: {shots: {double: 0.6, single: 0.2, highCrotch: 0.2}}, summary: "Power double leg; elite counter-wrestler who punishes bad shots.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.flowrestling.org/articles/13589931-stephen-buchanan-vs-josh-barr-wrestling-preview-prediction"}, {label: "Style source", url: "https://www.flowrestling.org/articles/13742987-1-stephen-buchanan-thriving-in-amazing-experience-with-iowa-wrestling"}] },
  "Lou Banach": { motion: {turnPreference: 1.3}, summary: "Quick pinner: three falls in 10:35 at the 1983 NCAAs.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.college-sports-journal.com/perseverance-and-character-helped-banachs-propel-iowa-wrestling-to-new-heights"}, {label: "Style source", url: "https://njsportsheroes.com/loubanachbxw.html"}] },
  "Matt McDonough": { motion: {shots: {double: 0.2, single: 0.65, highCrotch: 0.15}}, summary: "Sweep single specialist; chains attacks and finishes on the back side.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://fanaticwrestling.com/products/the-bread-butter-sweep-single-by-matt-mcdonough"}, {label: "Style source", url: "https://fanaticwrestling.com/blogs/news/finish-the-back-side-single-leg-with-matt-mcdonough"}] },
  "Mark Ironside": { motion: {turnPreference: 1.35}, summary: "Bonus-point machine: 38 pins and 34 majors.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://win-magazine.com/?p=404"}, {label: "Style source", url: "https://hawkeyesports.com/news/2020/01/3/wrestling-getting-what-you-earn"}] },
  "Jay Borschel": { motion: {circle: 1.15}, summary: "Funky, technical and scrambly; a capable pinner.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://iawrestle.com/2015/05/05/jay-borschel-opens-the-wrestling-lab/"}, {label: "Style source", url: "https://hawkeyesports.com/roster/jay-borschel/"}] },
  "Lee Fullhart": { motion: {handActivity: 1.15}, summary: "Underhook offense into leg attacks.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.themat.com/news/2004/april/15/feature--determination-and-har-9738"}, {label: "Style source", url: "https://nwhof.org/hall_of_fame/bio/6185"}] },
  "Steve Mocco": { motion: {handActivity: 1.3, pressure: 1.2}, summary: "Heavy hands and intimidating ties; foot sweeps; a pinner.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.newson6.com/story/5e3687262f69d76f6209d01e/osu-wrestler-puts-fear-in-the-biggest-men-in-college-wrestling"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/Steve_Mocco"}] },
  "Eric Juergens": { summary: "Cross-ankle pick, among the best in the game.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://www.flowrestling.org/articles/12557748-5-underrated-iowa-wrestling-stars-that-deserve-more-credit"}] },
  "Brent Metcalf": { motion: {turnPreference: 1.3}, sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa.json"}, {label: "Style source", url: "https://hawkeyesports.com/roster/brent-metcalf/"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/Brent_Metcalf"}] },
  "Dan Gable": { motion: {turnPreference: 1.35, pressure: 1.25, tempo: 1.2, preferredTurn: 'barHalf'}, summary: "Relentless pace and pressure; dominant pinner with bars and halfs: 76 falls in 118 matches.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/intermat-rewind-gable-owings-r72033/"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/Dan_Gable"}] },
  "Nate Carr": { motion: {tempo: 1.1, turnPreference: 0.85}, summary: "Quick and slick on his feet; scores fast, rarely pins.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://www.pbs.org/video/university-of-iowa-vs-iowa-state-university-s3rgiz"}, {label: "Style source", url: "https://api.nwhof.org/hall_of_fame/bio/986"}] },
  "David Carr": { look: {stagger: 1.1}, motion: {shots: {double: 0.45, single: 0.4, highCrotch: 0.15}}, summary: "Works from range: outside doubles and sweep singles, snaps into go-behinds.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/2021-22s-top-50-collegiate-wrestlers-5-david-carr-iowa-state-r89553"}, {label: "Style source", url: "https://iowastatedaily.com/251984/sports/takeaways-david-carr-takes-home-first-ncaa-title-40-years-after-his-dads-first"}] },
  "Joe Heskett": { motion: {shots: {double: 0.55, single: 0.3, highCrotch: 0.15}, turnPreference: 1.25}, summary: "Double leg and a pinner from any position: 58 career falls.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://iowastatedaily.com/201847/sports/heskett-writes-new-chapter-in-old-book"}, {label: "Style source", url: "https://api.nwhof.org/hall_of_fame/bio/12732"}] },
  "Cael Sanderson": { look: {levelOffset: 0.05}, motion: {circle: 1.2, tempo: 1.1}, summary: "Upright and always moving: ankle picks, snaps and leg attacks off motion; smothering on top.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://www.csmonitor.com/2001/0323/p12s1.html"}, {label: "Style source", url: "https://bloodyelbow.com/2020/05/23/takedown-breakdown-how-cael-sanderson-ankle-picked-daniel-cormier"}] },
  "Eric Voelker": { motion: {shots: {double: 0.65, single: 0.2, highCrotch: 0.15}, turnPreference: 0.8}, summary: "Power double leg that drives through opponents.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://www.pbs.org/video/university-of-iowa-vs-iowa-state-university-5ua88o"}, {label: "Style source", url: "https://api.nwhof.org/hall_of_fame/bio/12701"}] },
  "Chris Taylor": { motion: {turnPreference: 1.3}, summary: "Enormous heavyweight pinner (70 falls at Iowa State); good takedowns and a suplex.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://slamwrestling.net/legend/chris-taylor/"}, {label: "Style source", url: "https://api.nwhof.org/hall_of_fame/bio/2523"}] },
  "Tim Krieger": { motion: {topPatience: 1.3}, summary: "Ferocious rider, among the toughest on top in the country.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-iowa-state.json"}, {label: "Style source", url: "https://www.pbs.org/video/university-of-iowa-vs-iowa-state-university-5ua88o"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/two-time-ncaa-champ-krieger-to-be-inducted-into-mason-city-high-hall-of-fame-r79204"}] },
  "Nick Lee": { motion: {shots: {double: 0.25, single: 0.25, highCrotch: 0.5}}, summary: "High crotches and inside singles.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/2021-22s-top-50-collegiate-wrestlers-4-nick-lee-penn-state-r89558"}, {label: "Style source", url: "https://www.flowrestling.org/video/6374053-behind-the-dirt-nick-lees-fonzi-duck"}] },
  "Zain Retherford": { motion: {handActivity: 1.25, topPatience: 1.25, turnPreference: 1.3}, summary: "Heavy hand fighting to wear opponents down; punishing, physical top game.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://gopsusports.com/news/2016/02/01/blog-retherford-nolf-prove-to-be-lethal-combination-for-opponents"}, {label: "Style source", url: "https://www.psucollegian.com/sports/wrestling/how-penn-state-wrestling-s-zain-retherford-ascended-to-legendary-status/article_d5574e26-1523-11e8-9095-f722a2279f8e.html"}] },
  "Ed Ruth": { motion: {topPatience: 1.2}, summary: "Dynamic and explosive on his feet; a strong rider.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://gopsusports.com/news/2014/03/22/penn-state-wrestlers-win-fourth-straight-national-championship"}, {label: "Style source", url: "https://blackhistory.psu.edu/timeline/ed_ruth_becomes_first_three-time_ncaa_champ.html"}] },
  "Roman Bravo-Young": { motion: {circle: 1.25, tempo: 1.15}, summary: "Footwork, speed and slick takedowns.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/Roman_Bravo-Young"}, {label: "Style source", url: "https://www.ufc.com/news/new-sport-same-flair-roman-bravo-young-ufc-fight-pass"}] },
  "Bo Nickal": { motion: {turnPreference: 1.35}, summary: "Dangerous in every position, off underhooks, overhooks and leg defense; elite pinner (two Schalles Awards).", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://www.flowrestling.org/articles/6755000-the-bo-nickal-wrestling-biography"}, {label: "Style source", url: "https://intermatwrestle.com/articles.html/college/nickal-looking-to-cash-in-again-with-second-ncaa-title-r84341"}] },
  "Carter Starocci": { motion: {pressure: 1.15, topPatience: 1.15}, summary: "Relentless, physically dominating attacker and rider.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://fanaticwrestling.com/products/state-of-domination-championship-guide-to-top-position-mastery-by-carter-starocci"}, {label: "Style source", url: "https://www.aol.com/news/toughest-penn-state-wrestler-ever-100207636.html"}] },
  "Cary Kolat": { motion: {turnPreference: 1.25}, summary: "Dominant scorer and pinner: 53 college falls.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://magazine.campbell.edu/articles/still-the-best/"}, {label: "Style source", url: "https://en.wikipedia.org/wiki/Cary_Kolat"}] },
  "Vincenzo Joseph": { motion: {pressure: 1.1}, summary: "Presses the action: go-behinds and slide-bys.", sources: [{label: "Research notes", url: "outputs/nov08-likeness/research-penn-state.json"}, {label: "Style source", url: "https://www.papowerwrestling.com/?p=29884"}, {label: "Style source", url: "https://naviga.triblive.com/sports/vincenzo-joseph-tops-josh-shields-on-to-ncaa-finals"}] },
};

/**
 * Signature finishes (owner's list, November 9), only where a source names the habit. Research notes are the
 * nov08-likeness files (their own cited sources inside); owner-selected scramble specialists say so.
 */
const PSU = 'outputs/nov08-likeness/research-penn-state.json';
const IOWA = 'outputs/nov08-likeness/research-iowa.json';
const ISU = 'outputs/nov08-likeness/research-iowa-state.json';
const OWNER_SCRAMBLE = 'Owner-selected scramble specialist (athleteProfiles.isScrambleSpecialist)';
export const SIGNATURES: Record<string, Signature & { sources: string[] }> = {
  'Spencer Lee': { label: 'Snap to the front headlock and go behind', fhl: 'goBehind', sources: [IOWA] },
  'Cael Sanderson': { label: 'Snap downs into go-behinds', fhl: 'goBehind', sources: [ISU] },
  'David Carr': { label: 'Snap to go-behind; cradles', fhl: 'goBehind', turn: 'cradle', sources: [ISU] },
  'Vincenzo Joseph': { label: 'Go-behinds', fhl: 'goBehind', sources: [PSU] },
  'Zain Retherford': { label: 'Suffocating legs on top', legRider: true, sources: [PSU] },
  'David Taylor': { label: 'Tilts into leg rides', legRider: true, sources: [PSU] },
  'Bo Nickal': { label: 'Counter scrambles off leg defense', legCounter: 'scrambleRoll', sources: [PSU] },
  'Jason Nolf': { label: 'Creative scrambles', legCounter: 'scrambleRoll', sources: [PSU] },
  'Ben Askren': { label: 'Funk: rolls through on shots', legCounter: 'scrambleRoll', sources: ['https://mutigers.com/news/2008/06/18/olympic-wrestler-missouris-ben-askren-meets-the-press', OWNER_SCRAMBLE] },
  'Yianni Diakomihalis': { label: 'Funk: rolls through on shots', legCounter: 'scrambleRoll', sources: [OWNER_SCRAMBLE] },
  'Jesse Delgado': { label: 'Scrambles through shots', legCounter: 'scrambleRoll', sources: [OWNER_SCRAMBLE] },
  'Jax Forrest': { label: 'Scrambles through shots', legCounter: 'scrambleRoll', sources: [OWNER_SCRAMBLE] },
  'Aaron Holker': { label: 'Funky scrambler', legCounter: 'scrambleRoll', sources: [ISU] },
  'Jay Borschel': { label: 'Funky scrambles', legCounter: 'scrambleRoll', sources: [IOWA] },
  'Dan Gable': { label: 'Arm bars on top', turn: 'armBar', sources: [ISU] },
  'Michael Moreno': { label: 'Cradles', turn: 'cradle', sources: ['https://cyclones.com/news/2013/3/22/206873161'] },
  'Mark Perry': { label: 'Rolls and reversals from the bottom', bottom: 'granbyRoll', sources: [IOWA] },
};

/** Apply a researched style on top of the wrestler's drawn stance and motion. */
export function applyResearchedStyle(w: Wrestler): void {
  const sig = SIGNATURES[`${w.firstName} ${w.lastName}`];
  if (sig) {
    const { sources: _sources, ...signature } = sig;
    w.signature = signature;
    if (signature.turn) w.motion = { ...(w.motion ?? DEFAULT_MOTION), preferredTurn: signature.turn };
  }
  const s = ATHLETE_STYLES[`${w.firstName} ${w.lastName}`];
  if (!s) return;
  if (s.lead) w.lead = s.lead;
  if (s.look && w.stanceLook) w.stanceLook = { ...w.stanceLook, ...s.look };
  if (s.motion) {
    const base: WrestlingStyle = w.motion ?? DEFAULT_MOTION;
    w.motion = { ...base, ...s.motion, shots: s.motion.shots ?? base.shots, ...(sig?.turn ? { preferredTurn: sig.turn } : {}) };
  }
  if (s.summary) w.style = s.summary;
}
