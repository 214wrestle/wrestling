import { DEFAULT_MATCHUP } from '../sim/roster';
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

export type Screen = 'title' | 'loading' | 'playing' | 'results';

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
  nearFall: { active: boolean; timer: number };
  prompts: Record<ButtonId, ButtonPrompt>;
  /** A move to react to right now (the opponent just shot, say). */
  react: { button: ButtonId; label: string; id: number } | null;
  /** Feedback on the player's last press. */
  flash: { button: ButtonId; result: 'ok' | 'won' | 'lost' | 'blocked'; id: number } | null;
  stats: [WrestlerStats, WrestlerStats];
  announcement: Announcement | null;
  lastScore: ScoreEvent | null;
  scoreLog: ScoreEvent[];
  result: MatchResult | null;
  awaitingChoice: boolean;
  introFocus: Side | null;
  showHelp: boolean;
  muted: boolean;
  paused: boolean;
  fps: number;
  touchControls: boolean;
  device: Device;
  /** Selected matchup on the title screen. */
  matchup: [string, string];
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
  nearFall: { active: false, timer: 0 },
  prompts: idlePrompts(),
  react: null,
  flash: null,
  stats: [emptyStats(), emptyStats()],
  announcement: null,
  lastScore: null,
  scoreLog: [],
  result: null,
  awaitingChoice: false,
  introFocus: null,
  showHelp: false,
  muted: false,
  paused: false,
  fps: 0,
  touchControls: false,
  device: 'keyboard',
  matchup: [...DEFAULT_MATCHUP],
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
  preview: (matchup: [string, string]) => void;
  start: (options: { humanSide: Side; difficulty: Difficulty; matchup: [string, string]; quick: boolean }) => void;
  rematch: () => void;
  toTitle: () => void;
  choosePosition: (pos: StartPosition) => void;
  setPaused: (paused: boolean) => void;
  toggleHelp: () => void;
  toggleMute: () => void;
  setTouch: (state: { x: number; y: number; shoot: boolean; fight: boolean; sprawl: boolean; level: boolean }) => void;
  skipIntros: () => void;
}
