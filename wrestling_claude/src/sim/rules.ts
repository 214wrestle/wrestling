/**
 * NCAA collegiate wrestling rules, expressed as data.
 *
 * Everything the referee needs to know lives here so rule changes are a single
 * edit. No rendering or input concepts may enter this file.
 */

/** Regulation periods, in seconds. NCAA: 3:00 / 2:00 / 2:00. */
export const PERIOD_LENGTHS = [180, 120, 120] as const;

/** Sudden victory overtime — first scorer wins. */
export const SUDDEN_VICTORY_LENGTH = 60;

/** Each wrestler gets one 30s tiebreaker ride. */
export const TIEBREAKER_LENGTH = 30;

/** Ultimate ride-out: rider must hold for the full 30s. */
export const ULTIMATE_RIDEOUT_LENGTH = 30;

export const POINTS = {
  takedown: 3,
  escape: 1,
  reversal: 2,
  /** Near fall held 2–4 seconds. */
  nearFall2: 2,
  /** Near fall held 5+ seconds. */
  nearFall4: 4,
  penalty: 1,
  stalling: 1,
  ridingTime: 1,
} as const;

/** Match ends immediately at this point margin. */
export const TECH_FALL_MARGIN = 15;

/** Margin that upgrades a decision to a major decision. */
export const MAJOR_DECISION_MARGIN = 8;

/** Net advantage time needed for the riding-time point. */
export const RIDING_TIME_THRESHOLD = 60;

/** Seconds of exposure before a near fall is awarded. */
export const NEAR_FALL_2_SECONDS = 2;
export const NEAR_FALL_4_SECONDS = 5;

/** Seconds both shoulders must be held to the mat for a fall. */
export const FALL_HOLD_SECONDS = 2;

/** Stalling warning precedes the first stalling point. */
export const STALL_WARNING_SECONDS = 5.5;

/* ---------------------------------------------------------------- mat ----- */

/** NCAA mat geometry, in metres. */
export const MAT = {
  /** Half-width of the full 42' square mat. */
  halfSize: 6.4,
  /** Radius of the 32' competition circle — out of bounds beyond this. */
  circleRadius: 4.88,
  /** Radius of the 10' centre circle. */
  centerRadius: 1.524,
  /** Length of each starting line. */
  startingLine: 0.91,
  /** Mat thickness. */
  thickness: 0.055,
} as const;

/* ------------------------------------------------------------- outcomes --- */

export type WinType =
  | 'fall'
  | 'technical-fall'
  | 'major-decision'
  | 'decision'
  | 'sudden-victory'
  | 'tiebreaker'
  | 'ultimate-rideout'
  | 'default';

/** Team points awarded in a dual meet, by win type. */
export const DUAL_TEAM_POINTS: Record<WinType, number> = {
  fall: 6,
  'technical-fall': 5,
  'major-decision': 4,
  decision: 3,
  'sudden-victory': 3,
  tiebreaker: 3,
  'ultimate-rideout': 3,
  default: 6,
};

export function describeWinType(type: WinType, margin: number): string {
  switch (type) {
    case 'fall':
      return 'Fall';
    case 'technical-fall':
      return `Technical Fall (${margin}-point margin)`;
    case 'major-decision':
      return 'Major Decision';
    case 'sudden-victory':
      return 'Sudden Victory';
    case 'tiebreaker':
      return 'Tiebreaker';
    case 'ultimate-rideout':
      return 'Ultimate Ride-Out';
    case 'default':
      return 'Default';
    default:
      return 'Decision';
  }
}

/** Classify a regulation win from the final margin. */
export function classifyDecision(margin: number): WinType {
  if (margin >= TECH_FALL_MARGIN) return 'technical-fall';
  if (margin >= MAJOR_DECISION_MARGIN) return 'major-decision';
  return 'decision';
}

/** Period label shown on the scoreboard. */
export function periodLabel(period: number): string {
  if (period <= 3) return `P${period}`;
  if (period === 4) return 'SV';
  if (period === 5) return 'TB1';
  if (period === 6) return 'TB2';
  return 'RO';
}

export function periodLength(period: number): number {
  if (period <= 3) return PERIOD_LENGTHS[period - 1] ?? 120;
  if (period === 4) return SUDDEN_VICTORY_LENGTH;
  if (period === 5 || period === 6) return TIEBREAKER_LENGTH;
  return ULTIMATE_RIDEOUT_LENGTH;
}

/** True for overtime periods, where scoring can end the match outright. */
export function isOvertime(period: number): boolean {
  return period >= 4;
}

/** Format a clock as M:SS, or SS.t under ten seconds for tension. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 10) return s.toFixed(1).padStart(4, '0');
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

/** Format net riding time as +M:SS / -M:SS. */
export function formatRidingTime(net: number): string {
  const sign = net >= 0 ? '+' : '-';
  const abs = Math.abs(net);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}
