import type { GameApi } from '../game/store';
import { Key } from './glyphs';

interface Row {
  key: string;
  move: string;
  note: string;
}

const GROUPS: Array<{ title: string; lead: string; rows: Row[] }> = [
  {
    title: 'On your feet',
    lead: 'Distance, level and hands decide everything. Right on the stick always moves you toward him.',
    rows: [
      {key:'U / LB',move:'Low single',note:'Attack the ankle from neutral. John Smith favors this entry.'},
      {key:'I / Y',move:'Scramble',note:'Contest grips and control with a burst of movement. Costs stamina; points require a completed finish or reversal. Press at any time; during a committed transition it queues for the next live position.'},
      { key: 'J', move: 'Shoot', note: 'From about an arm’s length. Square up for a double, come off an angle for a single. Out of range it is a fake that can pull his sprawl.' },
      { key: 'K', move: 'Hand fight', note: 'Win ties for wrist control, then a collar tie. With the collar, K snaps him down — best when he is leaning on you or standing tall.' },
      { key: 'L', move: 'Sprawl', note: 'Hips back the instant he shoots. Early is fine, late gets you taken down. Sprawling at nothing leaves you open.' },
      { key: 'Shift', move: 'Level', note: 'Sink your hips: better shots and a stronger sprawl, slower feet.' },
    ],
  },
  {
    title: 'Scrambles',
    lead: 'A shot that gets in is a fight to finish it.',
    rows: [
      { key: 'J', move: 'Drive through', note: 'Hold it (and push into him) to finish the shot.' },
      { key: 'L / K', move: 'Sprawl hips / whizzer', note: 'Defending: hammer it to kick your legs back and end up on top.' },
      { key: 'J', move: 'Spin behind', note: 'From a front headlock: go around for the takedown. K snaps him back down first.' },
      { key: 'K / L', move: 'Clear your head', note: 'Caught in a front headlock: hammer to dig out and get back to your feet.' },
    ],
  },
  {
    title: 'On top',
    lead: 'Break him down before you try to turn him.',
    rows: [
      { key: 'K', move: 'Break down', note: 'Chop the arm and drive. Each one lowers his base. It also commits you — he can switch.' },
      { key: 'J', move: 'Tilt / half nelson', note: 'Only when his base is low or he is flat. Back points at two and five seconds; hold the squeeze for the fall.' },
      { key: 'L', move: 'Ride / return', note: 'Tighten the ride. If he stands up, L lifts him and brings him back down.' },
    ],
  },
  {
    title: 'On bottom',
    lead: 'Get your base, then get out.',
    rows: [
      { key: 'J', move: 'Stand up', note: 'Works from a good base. Then K for hand control and J to turn out for the escape.' },
      { key: 'K', move: 'Switch', note: 'Time it right after he chops or drives — a reversal and you are on top.' },
      { key: 'L', move: 'Base up', note: 'Rebuild your base; from flat, hammer to push back up. On your back, hammer to fight off.' },
    ],
  },
];

export function HelpPanel({ api }: { api: GameApi }) {
  return (
    <div className="modal modal--help" onClick={() => api.toggleHelp()}>
      <div className="help" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How to wrestle">
        <div className="help__head">
          <div>
            <div className="modal__kicker">Controls & rules</div>
            <h3>How to wrestle</h3>
          </div>
          <button type="button" className="menu__btn menu__btn--ghost" onClick={() => api.toggleHelp()}>
            Close <Key>H</Key>
          </button>
        </div>
        <div className="help__grid">
          {GROUPS.map((g) => (
            <section key={g.title} className="help__group">
              <h4>{g.title}</h4>
              <p>{g.lead}</p>
              <ul>
                {g.rows.map((r, i) => (
                  <li key={i}>
                    <Key>{r.key}</Key>
                    <span>
                      <strong>{r.move}</strong> {r.note}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="help__rules">
          <span>Takedown 3</span>
          <span>Escape 1</span>
          <span>Reversal 2</span>
          <span>Near fall 2 / 4</span>
          <span>Riding time 1 (a minute net)</span>
          <span>Tech fall at 15</span>
          <span>Fall: shoulders down, one second</span>
          <span>Gamepad: A shoot · X hand fight · B sprawl · triggers level</span>
        </div>
      </div>
    </div>
  );
}
