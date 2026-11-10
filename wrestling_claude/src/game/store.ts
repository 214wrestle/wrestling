import { DEFAULT_MATCHUP } from '../sim/roster';
import { DEFAULT_PLAN, type MatchPlan } from '../sim/strategy';
import type { Difficulty } from '../sim/ai';
import type { Device } from '../engine/Input';
import type {
  Announcement,
  MatchPhase,
  MatchResult,
  ScoreEvent,
  Side,
  StartPosition,
  Wrestler,
} from '../sim/types';

/**
 * UI state.
 *
 * React draws the overlay; the 3D loop owns everything else. A tiny observable
 * store keeps the two apart — the game pushes snapshots a few times a second and
 * React re-renders from them, with no reconciler work in the frame loop.
 */

export type Screen = 'title' | 'dual' | 'tournament' | 'loading' | 'playing' | 'results';

export interface WrestlerStats {
  takedowns: number;
  escapes: number;
  reversals: number;
  nearFalls: number;
  stuffs: number;
  shotsAttempted: number;
}

export type ButtonId = 'shoot' | 'fight' | 'sprawl';

export interface ButtonPrompt {
  label: string;
  /** idle: available; hot: an opening right now; off: nothing to do; mash: hammer it. */
  state: 'idle' | 'hot' | 'off' | 'mash' | 'hold';
  /** The same button with the stick or Lower: what else it does here (e.g. "Sideways: Slide-by"). */
  alt?: string;
}

export interface Meter {
  label: string;
  value: number;
  /** Whose side the meter favours when full. */
  tone: 'you' | 'them' | 'neutral';
  /** Optional marker, e.g. the threshold that unlocks a move. */
  mark?: number;
}

export type PositionLabel = 'Neutral' | 'Top' | 'Bottom' | 'In on the legs' | 'Defending the shot' | 'Front headlock' | 'Head trapped' | 'Scramble' | '—';

export interface UiState {
  screen: Screen;
  loading: number;
  phase: MatchPhase;
  period: number;
  clock: number;
  score: [number, number];
  ridingTime: number;
  wrestlers: [Wrestler, Wrestler] | null;
  humanSide: Side;
  difficulty: Difficulty;
  quick: boolean;
  stamina: [number, number];
  hand: [number, number];
  position: PositionLabel;
  top: Side | null;
  meters: Meter[];
  legActions?: readonly ('lift' | 'trip' | 'double' | 'drive')[];
  /** Which way to move at the edge of the mat right now, or when locked hands is a risk (edgeHintFor, handsHintFor). */
  edgeHint?: string;
  nearFall: { active: boolean; timer: number; earned: number };
  prompts: Record<ButtonId, ButtonPrompt>;
  /** A move to react to right now (the opponent just shot, say). */
  react: { button: ButtonId; label: string; id: number } | null;
  /** Feedback on the player's last press. */
  flash: { button: ButtonId; label?: string; result: 'ok' | 'won' | 'lost' | 'blocked'; id: number } | null;
  stats: [WrestlerStats, WrestlerStats];
  announcement: Announcement | null;
  lastScore: ScoreEvent | null;
  scoreLog: ScoreEvent[];
  result: MatchResult | null;
  awaitingChoice: boolean;
  /** Toss winner once the disc is flipped; null before. */
  coinTossWinner: Side | null;
  /** The toss winner may defer this choice to the third period. */
  canDefer: boolean;
  /** Your match plan and the opponent corner's current one. */
  plan: MatchPlan;
  opponentPlan: MatchPlan;
  /** Tonight's referee, as he reads stalling (e.g. "is quick on stalling"). */
  refereeNote: string;
  /** Per wrestler: warned for stalling yet, and how many stalling points he has given up. */
  stalls: [{ warned: boolean; points: number }, { warned: boolean; points: number }];
  topRestartCut: boolean;
  introFocus: Side | null;
  showHelp: boolean;
  muted: boolean;
  paused: boolean;
  fps: number;
  touchControls: boolean;
  device: Device;
  /** Selected matchup on the title screen. */
  matchup: [string, string];
  /** The dual meet in progress (dual mode), or null for a single match. */
  dual: import('../sim/dual').Dual | null;
  /** The tournament in progress, or null. */
  tournament: import('../sim/tournament').Tournament | null;
  /** Other bouts in the bracket are being simmed. */
  tournamentBusy: boolean;
}

const emptyStats = (): WrestlerStats => ({
  takedowns: 0,
  escapes: 0,
  reversals: 0,
  nearFalls: 0,
  stuffs: 0,
  shotsAttempted: 0,
});

const idlePrompts = (): Record<ButtonId, ButtonPrompt> => ({
  shoot: { label: 'Shoot', state: 'idle' },
  fight: { label: 'Hand fight', state: 'idle' },
  sprawl: { label: 'Sprawl', state: 'idle' },
});

export const initialState: UiState = {
  screen: 'title',
  loading: 0,
  phase: 'attract',
  period: 1,
  clock: 180,
  score: [0, 0],
  ridingTime: 0,
  wrestlers: null,
  humanSide: 0,
  difficulty: 'starter',
  quick: false,
  stamina: [1, 1],
  hand: [0, 0],
  position: 'Neutral',
  top: null,
  meters: [],
  nearFall: { active: false, timer: 0, earned: 0 },
  prompts: idlePrompts(),
  react: null,
  flash: null,
  stats: [emptyStats(), emptyStats()],
  announcement: null,
  lastScore: null,
  scoreLog: [],
  result: null,
  awaitingChoice: false,
  coinTossWinner: null,
  canDefer: false,
  plan: DEFAULT_PLAN,
  opponentPlan: DEFAULT_PLAN,
  refereeNote: '',
  stalls: [{ warned: false, points: 0 }, { warned: false, points: 0 }],
  topRestartCut: false,
  introFocus: null,
  showHelp: false,
  muted: false,
  paused: false,
  fps: 0,
  touchControls: false,
  device: 'keyboard',
  matchup: [...DEFAULT_MATCHUP],
  dual: null,
  tournament: null,
  tournamentBusy: false,
};

export class UiStore {
  private state: UiState = { ...initialState };
  private subscribers = new Set<() => void>();

  getSnapshot = (): UiState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  };

  set(patch: Partial<UiState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof UiState>) {
      if (this.state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const fn of this.subscribers) fn();
  }
}

/** Commands the UI can send back into the game. */
export interface GameApi {
  setTopTurn: (choice:import('../sim/armBars').TopTurnChoice | undefined)=>void;
  preview: (matchup: [string, string]) => void;
  start: (options: { humanSide: Side; difficulty: Difficulty; matchup: [string, string]; quick: boolean; choice?: Side | null }) => void;
  rematch: () => void;
  toTitle: () => void;
  choosePosition: (pos: StartPosition | 'defer') => void;
  setPlan: (plan: MatchPlan) => void;
  setPaused: (paused: boolean) => void;
  toggleHelp: () => void;
  toggleMute: () => void;
  setTouch: (state: import("../engine/Input").PadState) => void;
  cancelTouch: (key?: import("../engine/TouchGestures").TouchKey) => void;
  skipIntros: () => void;
  chooseTopRestart: (cut: boolean) => void;
  /** Dual meet: start one, pick the wrestler at the current weight, wrestle or sim the bout, back to the dual. */
  startDual: (options: { teams: [string, string]; difficulty: Difficulty; quick: boolean; draw?: boolean }) => void;
  pickDual: (id: string) => void;
  /** The dual's toss winner (the player's team) picks odd or even bouts. */
  pickOddEven: (odd: boolean) => void;
  wrestleDual: () => void;
  simDual: () => void;
  toDual: () => void;
  leaveDual: () => void;
  /** Tournament: start one at a weight with his pick, wrestle or sim his next match, sim the rest, back, leave. */
  startTournament: (options: { pick: string; difficulty: Difficulty; quick: boolean }) => void;
  wrestleTournament: () => void;
  simTournamentBout: () => void;
  simTournamentRest: () => void;
  toTournament: () => void;
  leaveTournament: () => void;
}
