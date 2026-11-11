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
    lead: 'Set it up, then execute: the tie you hold and where you push the stick pick the move, and the button shows its name. Sideways means across him; back means away from him.',
    rows: [
      { key: 'J', move: 'Shoot', note: 'From about an arm’s length: square for a double, off an angle for a single. Out of range it is a fake. Set it up first (a fake, hand fighting, an angle): the button lights while your shot is set up. Shoot while it is dark and he sprawls on it and counters.' },
      { key: 'J', move: 'Off a tie', note: 'Collar tie: high crotch, or an ankle pick while he reacts to your snap. Underhook: knee pick.' },
      { key: 'J', move: 'Reshot', note: 'His bad shot is blocked and he stumbles up: shoot now. Yours is stopped short: come up and go again.' },
      { key: 'K', move: 'Hand fight', note: 'Win his wrists, then a tie: tall for a collar tie, low (Shift) for an underhook.' },
      { key: 'K', move: 'Collar tie', note: 'Snap him down. Sideways: duck under. Back: foot sweep.' },
      { key: 'K', move: 'Underhook', note: 'Throw-by. Shift + K pummels the second arm in for a body lock; then K is a lateral drop.' },
      { key: 'K', move: 'His underhook', note: 'Pummel your arm back inside. Sideways + K: headlock (risky).' },
      { key: 'K', move: 'Sideways', note: 'With his wrist: slide-by. His collar tie on you: duck under. Out of reach: super duck (risky).' },
      { key: 'Shift + J', move: 'Low attacks', note: 'With a tie or his wrist: fireman’s carry. From outside: low single.' },
      { key: 'L', move: 'Sprawl', note: 'Hips back on his level change. Your reflex sprawl is late; reading it yourself stuffs far more. Biting on a fake leaves you open.' },
      { key: 'Shift', move: 'Lower', note: 'Sink your hips: better shots and a stronger sprawl, slower feet.' },
    ],
  },
  {
    title: 'Scrambles',
    lead: 'A shot that gets in is a fight to finish it.',
    rows: [
      { key: 'J', move: 'Drive through', note: 'Hold to finish. Sideways + J trips; Shift + J goes to the double. Hold K first to lift the leg.' },
      { key: 'L', move: 'Crossface', note: 'Sprawl early, on his level change. Beat the shot and you are on top in a front headlock.' },
      { key: 'K', move: 'Whizzer', note: 'On a single or high crotch: beat it and you kick the leg free back to your feet.' },
      { key: 'J', move: 'Counter', note: 'He is in on your legs: crackdown before he is deep, sit through on a deep single with the leg low, scramble roll when he has nearly finished (miss it and he scores).' },
      { key: 'K', move: 'Scramble', note: 'While he is finishing a takedown on you: fight it. Costs stamina.' },
      { key: 'J', move: 'Spin behind / chin whip', note: 'From a front headlock: spin behind when he is flat, chin whip as he comes up, J + Shift for a cement mixer to his back. K snaps him back down; L shucks him by while he drives in.' },
      { key: 'K / L', move: 'Clear your head', note: 'Caught in a front headlock: hammer to dig out and get back up.' },
    ],
  },
  {
    title: 'On top',
    lead: 'At the whistle pick a plan: Turn him (back points), Ride (riding time, harder to escape) or Cut (let him up for one). Ride without trying a turn and the referee calls stalling.',
    rows: [
      { key: 'K', move: 'Break down', note: 'Chop the arm and drive; each one lowers his base. It commits you, so he can switch.' },
      { key: 'J', move: 'Turn him', note: 'Tilt or half nelson once his base is low or he is flat; with your legs in it is a turk. Pick a bar or a cradle in Top attack. Hold the squeeze for the fall. A tilt or a loose throw is a quick 2 as he bellies out; squeezing tightens it for more.' },
      { key: 'L', move: 'Ride / return', note: 'Tighten the ride. If he stands up, L lifts him and returns him, J trips him, K is a crotch lift: a clean return puts him flat; tired, a big lift can be a slam (a point to him). Lock your hands only once he is on his feet: grabbing while he is still on a knee, or as a return lands, is locked hands (a point to him).' },
      { key: 'Shift', move: 'Cut / legs in', note: 'Tap to cut him loose (he gets 1). Hold to throw in the legs.' },
    ],
  },
  {
    title: 'On bottom',
    lead: 'Get your base, then get out. On a phone, tap repeatedly or hold a button to build effort while fighting off your back or breaking a grip.',
    rows: [
      { key: 'J', move: 'Stand up', note: 'From a good base, best right off the whistle or with hand control. Then K for hand control and J to turn out, or K + Shift for a standing switch. Returned to the mat: J as you come down to turn in the moment you land (miss and you land flatter).' },
      { key: 'K', move: 'Hand control · Switch', note: 'Take his hand at your waist: your stand-up and sit-out work far better with it and with back pressure (L builds your base into him). Right after he chops or drives it is a switch: a reversal puts you on top.' },
      { key: 'X', move: 'Sit out', note: 'Sit through and turn in. Risky: he can pull you to your back. X + Shift is a Granby roll.' },
      { key: 'L', move: 'Base up', note: 'Rebuild your base; on your back, hammer to fight off. Against his legs it closes your pockets; Shift catches the leg.' },
    ],
  },
  {
    title: 'At the edge',
    lead: 'Near the line, where you move matters. A hint above your buttons says which way.',
    rows: [
      { key: 'Move', move: 'Toward the line', note: 'In trouble (he is on your legs, in a front headlock, riding you): get out for a restart. On your back, or with his takedown all but done, that is fleeing: a stalling call.' },
      { key: 'Move', move: 'To the center', note: 'In control: turn him back in before you finish or turn him. About to lose him while he stands: push out to restart on top (the referee may call it).' },
      { key: 'Move', move: 'On your feet', note: 'Walk him to the line: if he backs out, it is stalling on him. Your back to it: circle off.' },
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
          <span>Near fall 2 / 3 / 4 (2, 3, 4 seconds)</span>
          <span>Riding time 1 (a minute net)</span>
          <span>Tech fall at 15</span>
          <span>Fall: shoulders down, one second</span>
          <span>Gamepad: A shoot · X hand fight · B sprawl · triggers lower / cut · stick or d-pad steers and picks the move</span>
        </div>
      </div>
    </div>
  );
}
