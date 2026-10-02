import { Match } from '../game/Match';
import { clockText, type Choice, type Difficulty } from '../game/types';

interface Actions { start: () => void; menu: () => void; pause: () => void; sound: () => void; camera: () => void; quality: () => void; }
const mark = '<span class="monogram">V<span>•</span></span>';
const key = (name: string) => `<kbd>${name}</kbd>`;

export class UI {
  private root: HTMLElement;
  private lastPhase = '';
  private lastEvent = -1;
  private helpOpen = false;
  private helpPaused = false;
  private announcedResult = false;
  private refs: Record<string, HTMLElement> = {};
  constructor(private match: Match, private actions: Actions) {
    this.root = document.querySelector('#app')!;
    this.root.innerHTML = `
      <div id="boot"><span class="boot-mark">V</span><span>OPENING THE FIELDHOUSE</span><i></i></div>
      <header class="brandbar"><a class="brand" href="#" aria-label="Varsity home">${mark}<span>VARSITY<small>COLLEGE WRESTLING</small></span></a><div class="venue"><span class="live-dot"></span> NORTHWOOD FIELDHOUSE <span class="venue-divider">/</span> 157 LB</div><nav><button id="sound" class="utility" aria-label="Toggle sound">SOUND <b>ON</b></button><button id="fullscreen" class="utility" aria-label="Toggle fullscreen">⛶ <span>FULLSCREEN</span></button></nav></header>
      <section id="menu" class="menu screen">
        <div class="hero"><div class="eyebrow"><span class="dash"></span> THE COLLEGIATE WRESTLING EXPERIENCE</div><h1>OWN<br>THE <em>MAT.</em></h1><p class="hero-copy">Find your opening. Finish your shot.<br>Make every second count.</p>
          <div class="match-settings"><div class="setting-label">YOUR COMPETITION <span>01 — EXHIBITION</span></div><div class="segmented difficulty" role="group" aria-label="Opponent difficulty"><button data-difficulty="club" class="selected">Club<small>Find your feet</small></button><button data-difficulty="varsity">Varsity<small>Earn your points</small></button><button data-difficulty="champion">All-American<small>No easy openings</small></button></div><div class="clock-setting"><span>Match pace</span><div class="segmented small"><button data-speed="2" class="selected">QUICK · 2× CLOCK</button><button data-speed="1">REAL TIME · 7 MIN</button></div></div></div>
          <button id="start" class="primary cta">STEP ON THE MAT <span>↗</span></button><button id="learn" class="text-button">${key('H')} Learn the controls <span>→</span></button>
        </div><aside class="matchup"><div class="matchup-top"><span class="pill">TONIGHT’S MATCHUP</span><span>157 LB / MEN’S FOLKSTYLE</span></div><div class="team-row"><div class="school-badge home">N</div><div><small>YOU · HOME</small><strong>NORTHWOOD</strong><span>Eli Mercer <i>19–3</i></span></div></div><div class="versus"><span></span> VS <span></span></div><div class="team-row"><div class="school-badge away">R</div><div><small>CPU · AWAY</small><strong>RIDGEFIELD</strong><span>Noah Hayes <i>17–5</i></span></div></div><div class="matchup-bottom">A small gym. A big night.</div></aside>
        <div class="menu-footer"><span>INDEPENDENT GAME · FICTIONAL SCHOOLS</span><span>SEASON 01 <i>/</i> PLAYABLE PROTOTYPE</span></div>
      </section>
      <div id="hud" class="screen hidden"><div class="scorebug"><div class="score-team home"><div class="team-abbr">N<small>YOU</small></div><div class="team-label"><b>NORTHWOOD</b><span>E. MERCER</span><i><em id="op0stamina"></em></i></div><strong id="score0">0</strong></div><div class="score-time"><small id="period">PERIOD 1</small><strong id="clock">3:00</strong><span id="pace">2× MATCH CLOCK</span></div><div class="score-team away"><strong id="score1">0</strong><div class="team-label"><b>RIDGEFIELD</b><span>N. HAYES</span><i><em id="op1stamina"></em></i></div><div class="team-abbr">R<small>CPU</small></div></div></div><div class="ride-strip"><span>157 LB · EXHIBITION</span><b id="ride">RIDING TIME — EVEN</b><span id="stage">NEUTRAL</span></div>
        <div class="match-tools"><button id="camera" class="tool">${key('C')} Camera</button><button id="pause" class="tool">${key('ESC')} Pause</button></div>
        <div id="toast" class="toast" aria-live="polite"><strong id="toast-title"></strong><span id="toast-detail"></span></div>
        <div id="danger" class="danger hidden"><span>NEAR FALL</span><strong id="danger-title">BRIDGE NOW</strong><div><i id="pin-fill"></i></div><small id="danger-detail">HOLD SPACE TO KEEP A SHOULDER UP</small></div>
        <div class="bottom-hud"><div class="athlete-status"><div><span>YOUR STAMINA</span><b id="stamina-value">100</b></div><div class="stamina-track"><i id="stamina-fill"></i></div><small id="stamina-tip">Stay patient. Make your attack count.</small></div><div class="position-panel"><div><span id="meter-label">CREATE AN OPENING</span><b id="meter-value">0%</b></div><div class="position-track"><i id="meter-fill"></i></div><p id="coach">Get close. Tap L to hand fight, then J to shoot.</p></div><div class="movement-hint">${key('W')}${key('A')}${key('S')}${key('D')}<span>MOVE</span>${key('SHIFT')}<span>DRIVE</span></div></div>
        <div class="actionbar"><div class="action-context"><b id="position-name">NEUTRAL</b><span id="action-status">CLOSE THE DISTANCE</span></div>${[['primary','J'],['secondary','K'],['setup','L'],['defend','SPACE']].map(([action, binding]) => `<button class="action-key ${action === 'defend' ? 'defense' : ''}" id="action-${action}" data-touch="${action}">${key(binding)}<span><b id="${action === 'defend' ? 'defend' : action}-label"></b><small id="${action}-detail"></small></span><i></i></button>`).join('')}</div>
        <div id="touch" class="touch-controls"><div id="joystick" aria-label="Movement joystick"><i></i></div><div class="touch-actions"><button data-touch="setup" id="touch-setup">SETUP</button><button data-touch="secondary" id="touch-secondary">SNAP</button><button data-touch="primary" id="touch-primary">SHOT</button><button data-touch="defend" class="touch-defense">DEFEND · HOLD</button></div></div>
      </div>
      <section id="intro" class="screen hidden intro"><div class="intro-stripe"><span class="eyebrow">NORTHWOOD FIELDHOUSE · COLLEGIATE EXHIBITION</span><div><strong>ELI <em>MERCER</em></strong><span>157<br><small>POUNDS</small></span><strong>NOAH <em>HAYES</em></strong></div><p>NORTHWOOD TIMBERWOLVES <i>VS</i> RIDGEFIELD HAWKS</p></div><button id="skip" class="button-light">Skip introductions →</button></section>
      <section id="break" class="screen modal-backdrop hidden"><div class="dialog period-dialog"><span class="eyebrow" id="break-kicker">END OF PERIOD</span><h2 id="break-title">YOUR CHOICE.</h2><p id="break-detail"></p><div class="break-score"><span>NORTHWOOD <b id="break-score0">0</b></span><span>RIDGEFIELD <b id="break-score1">0</b></span></div><div id="choices"><button data-choice="bottom"><b>BOTTOM</b><span>Build your base. Escape for 1.</span><i>↗</i></button><button data-choice="top"><b>TOP</b><span>Control the ride. Work for a fall.</span><i>↗</i></button><button data-choice="neutral"><b>NEUTRAL</b><span>Stay on your feet. Hunt 3 points.</span><i>↗</i></button><button data-choice="defer" id="defer"><b>DEFER</b><span>Keep your choice for period 3.</span><i>→</i></button></div><p id="ai-choice" class="waiting">The wrestlers return to the center…</p></div></section>
      <section id="paused" class="screen modal-backdrop hidden"><div class="dialog pause-dialog"><span class="eyebrow">TAKE A BREATH</span><h2>TIME OUT.</h2><p>The match is paused.</p><button id="resume" class="primary">BACK TO THE MATCH <span>→</span></button><button id="pause-help" class="secondary">Controls & rules</button><button id="quality" class="secondary">Graphics: HIGH</button><button id="restart" class="secondary">Restart match</button><button id="back-menu" class="text-button">Return to locker room →</button></div></section>
      <section id="finished" class="screen hidden result-screen"><div class="result-panel"><span class="eyebrow">THE FINAL WHISTLE</span><h2 id="result-title">VICTORY.</h2><p id="result-subtitle">NORTHWOOD TAKES THE MAT</p><div class="result-method" id="result-method"></div><div class="final-score"><div><span>NORTHWOOD</span><strong id="final0">0</strong></div><span>—</span><div><span>RIDGEFIELD</span><strong id="final1">0</strong></div></div><div class="result-stats"><div><b id="stat-td">0</b><span>TAKEDOWNS</span></div><div><b id="stat-esc">0</b><span>ESCAPES</span></div><div><b id="stat-ride">0:00</b><span>RIDING TIME</span></div></div><p id="result-note"></p><button id="rematch" class="primary">RUN IT BACK <span>↗</span></button><button id="result-menu" class="text-button">Return to locker room →</button></div></section>
      <section id="help" class="modal-backdrop hidden"><div class="dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><button id="close-help" class="close" aria-label="Close controls">×</button><span class="eyebrow">WIN THE POSITION. WIN THE POINTS.</span><h2 id="help-title">KNOW YOUR MOVES.</h2><p>Move with WASD or the arrow keys. Tap attacks; hold defense.<br>Start on Club and use Quick pace for your first match.</p><div class="control-table"><div class="table-head"><b>KEY</b><b>ON YOUR FEET</b><b>ON TOP</b><b>ON BOTTOM</b></div><div>${key('J')}<span>Double-leg shot</span><span>Half nelson / turn</span><span>Stand up / escape</span></div><div>${key('K')}<span>Snap-down</span><span>Breakdown</span><span>Switch / reversal</span></div><div>${key('L')}<span>Hand fight / setup</span><span>Release opponent (+1)</span><span>Hip heist / escape</span></div><div>${key('SPACE')}<span>Sprawl</span><span>Defend the ride</span><span>Brace / bridge</span></div></div><div class="help-tips"><article><b>01 <span>SET UP YOUR SHOT</span></b><p>Get within arm’s reach. Hand fight twice with L, then shoot with J. If they’re bracing for a shot, use K to snap them down.</p></article><article><b>02 <span>CHAIN YOUR WRESTLING</span></b><p>On top, alternate breakdowns and turns. On bottom, alternate J and K. Repeating one move is less effective and drains your stamina.</p></article><article><b>03 <span>FINISH OR FIGHT OFF</span></b><p>Turn them onto their back, then hold J to flatten both shoulders. Caught on your back? Hold SPACE immediately to bridge out.</p></article></div><div class="rules-note"><b>COLLEGIATE FOLKSTYLE SCORING</b><p>Takedown 3 · Escape 1 · Reversal 2 · Near fall 2–4.<br>Periods: 3 / 2 / 2 minutes. A 15-point lead is a technical fall. A net minute of riding time earns 1 point at the end of regulation. A tie goes to sudden victory, then paired 30-second tiebreakers.</p><small>Quick mode accelerates the match and riding-time clocks by 2×. Referee counts stay in real time. Gameplay simplifies contact and officiating; this is an independent prototype, not an NCAA-licensed product.</small></div><div class="help-footer"><span>${key('C')} CAMERA &nbsp; ${key('Q')}${key('E')} ORBIT &nbsp; ${key('M')} SOUND &nbsp; ${key('ESC')} PAUSE</span><span>GAMEPAD: A SHOT · X SNAP · B SETUP · RT DEFEND</span></div></div></section>
      <div class="portrait-tip">BEST PLAYED IN LANDSCAPE ↻</div>
    `;
    this.root.querySelector('.brand')!.addEventListener('click', e => e.preventDefault());
    for (const el of this.root.querySelectorAll<HTMLElement>('[id]')) this.refs[el.id] = el;
    const click = (id: string, action: () => void) => this.refs[id].addEventListener('click', action);
    click('start', actions.start); click('rematch', actions.start); click('restart', actions.start);
    click('pause', actions.pause); click('resume', actions.pause); click('camera', actions.camera); click('sound', actions.sound);
    click('back-menu', actions.menu); click('result-menu', actions.menu); click('skip', () => match.beginWrestling());
    click('learn', () => this.toggleHelp()); click('pause-help', () => this.toggleHelp()); click('close-help', () => this.toggleHelp());
    click('quality', actions.quality);
    click('fullscreen', () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => {}); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) button.addEventListener('click', () => {
      match.settings.difficulty = button.dataset.difficulty as Difficulty; this.settings();
    });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-speed]')) button.addEventListener('click', () => { match.settings.clockSpeed = Number(button.dataset.speed); this.settings(); });
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-choice]')) button.addEventListener('click', () => match.choose(button.dataset.choice as Choice));
    this.settings();
  }
  ready() { this.refs.boot.classList.add('hidden'); }
  settings() {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) button.classList.toggle('selected', button.dataset.difficulty === this.match.settings.difficulty);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-speed]')) button.classList.toggle('selected', Number(button.dataset.speed) === this.match.settings.clockSpeed);
    this.refs.sound.innerHTML = `SOUND <b>${this.match.settings.sound ? 'ON' : 'OFF'}</b>`;
    this.refs.quality.textContent = `Graphics: ${this.match.settings.quality.toUpperCase()}`;
    try { localStorage.setItem('varsity-settings-v1', JSON.stringify(this.match.settings)); } catch { /* Storage is optional. */ }
  }
  toggleHelp() {
    this.helpOpen = !this.helpOpen;
    if (this.helpOpen) {
      this.helpPaused = ['wrestling', 'intro', 'break'].includes(this.match.state.phase);
      if (this.helpPaused) this.actions.pause();
      this.refs['close-help'].focus();
    } else if (this.helpPaused) { this.helpPaused = false; this.actions.pause(); }
    this.refs.help.classList.toggle('hidden', !this.helpOpen);
  }
  escape() { if (this.helpOpen) this.toggleHelp(); else this.actions.pause(); }
  closeHelp() { this.helpOpen = false; this.helpPaused = false; this.refs.help.classList.add('hidden'); }
  private text(id: string, value: string) { if (this.refs[id].textContent !== value) this.refs[id].textContent = value; }
  update() {
    const s = this.match.state, p = s.wrestlers[0], o = s.wrestlers[1];
    if (s.phase !== this.lastPhase) {
      for (const phase of ['menu', 'intro', 'break', 'paused', 'finished']) this.refs[phase].classList.toggle('hidden', phase !== s.phase);
      this.refs.hud.classList.toggle('hidden', !['wrestling', 'paused'].includes(s.phase));
      document.body.dataset.phase = s.phase; this.lastPhase = s.phase;
    }
    this.text('score0', String(s.score[0])); this.text('score1', String(s.score[1])); this.text('period', this.match.periodLabel); this.text('clock', clockText(s.remaining));
    this.refs.clock.classList.toggle('urgent', s.remaining < 20 && s.phase === 'wrestling');
    this.text('pace', this.match.settings.clockSpeed === 1 ? 'REGULATION CLOCK' : '2× MATCH CLOCK');
    const ride = s.stage === 'regulation' ? s.riding[0] - s.riding[1] : s.overtimeRiding[0] - s.overtimeRiding[1];
    this.text('ride', Math.abs(ride) < 1 ? 'RIDING TIME — EVEN' : `RIDING TIME ${ride > 0 ? 'NWD' : 'RFD'} +${clockText(Math.abs(ride))}${Math.abs(ride) >= 60 && s.stage === 'regulation' ? ' · +1' : ''}`);
    this.text('stage', s.top === null ? 'NEUTRAL' : s.top === 0 ? 'NORTHWOOD IN CONTROL' : 'RIDGEFIELD IN CONTROL');
    this.text('stamina-value', `${Math.round(p.stamina)}`); this.refs['stamina-fill'].style.width = `${p.stamina}%`;
    this.refs['op0stamina'].style.width = `${p.stamina}%`; this.refs['op1stamina'].style.width = `${o.stamina}%`;
    this.refs['stamina-fill'].classList.toggle('low', p.stamina < 25);
    this.text('stamina-tip', p.stamina < 25 ? 'Create space. Breathe. Recover.' : 'Stay patient. Make your attack count.');
    const ground = s.top !== null, top = s.top === 0;
    const value = ground ? s.control : p.setup * 100;
    this.text('meter-label', ground ? (top ? 'YOUR MAT CONTROL' : 'BREAK THEIR CONTROL') : 'CREATE AN OPENING');
    this.text('meter-value', `${Math.round(value)}%`); this.refs['meter-fill'].style.width = `${value}%`;
    this.refs['meter-fill'].classList.toggle('opponent', ground && !top);
    this.text('coach', ground ? top ? 'Alternate K and J to build control and turn.' : 'Alternate J and K. Defend when they attack.' : p.setup > 0.6 ? 'Opening ready. J to shoot — K if they sprawl.' : 'Get close. Tap L to hand fight, then J to shoot.');
    const labels = ground ? top ? ['HALF NELSON / TURN', 'BREAKDOWN', 'RELEASE (+1)', 'DEFEND THE RIDE'] : ['STAND UP / ESCAPE', 'SWITCH / REVERSE', 'HIP HEIST', 'BRACE / BRIDGE'] : ['DOUBLE LEG', 'SNAP DOWN', 'HAND FIGHT', 'SPRAWL / DEFEND'];
    ['primary-label', 'secondary-label', 'setup-label', 'defend-label'].forEach((id, i) => this.text(id, labels[i]));
    const exposure = s.exposure > 0, distance = this.match.distance();
    if (exposure) {
      this.text('primary-label', top ? 'PINNING PRESSURE' : 'BUILD YOUR BASE');
      this.text('defend-label', top ? 'COMMITTED TO THE PIN' : 'BRIDGE OUT');
      this.text('coach', top ? 'Hold J to press their shoulders to the mat.' : 'Hold SPACE to lift a shoulder and recover your base.');
    }
    const details = exposure ? top ? ['HOLD · FLATTEN SHOULDERS','WAIT FOR THE RELEASE','WAIT FOR THE RELEASE','HOLD · STAY BALANCED'] : ['BRIDGE TO RECOVER FIRST','BRIDGE TO RECOVER FIRST','BRIDGE TO RECOVER FIRST','HOLD · LIFT A SHOULDER'] : ground ? top ? ['TURN THEIR SHOULDERS','BREAK THEIR BASE','GIVE UP 1 POINT','HOLD · STOP THE ESCAPE'] : ['1 PT · CLEAR THE HANDS','2 PT · COME OUT ON TOP','1 PT · CLEAR YOUR HIPS','HOLD · RESIST THE TURN'] : ['3 PT · ATTACK THE LEGS','3 PT · COUNTER A SPRAWL','SET UP YOUR NEXT ATTACK','HOLD · HIPS BACK'];
    this.text('position-name', exposure ? top ? 'FINISH THE FALL' : 'BACK IN DANGER' : ground ? top ? 'TOP · YOU CONTROL' : 'BOTTOM · BUILD YOUR BASE' : 'NEUTRAL · ON YOUR FEET');
    this.text('action-status', exposure ? top ? 'HOLD J TO APPLY PRESSURE' : 'HOLD SPACE TO BRIDGE' : s.exchange ? 'EXCHANGE IN PROGRESS' : p.cooldown > 0 ? (p.cooldown < 0.35 ? 'LINK YOUR NEXT MOVE NOW' : `RECOVERING · ${p.cooldown.toFixed(1)}s`) : p.stamina < 16 ? 'LOW STAMINA · RECOVER' : !ground && distance > 1.9 ? 'STEP INTO REACH' : !ground && p.setup > 0.6 ? 'OPENING READY · ATTACK' : 'READY · TAP A MOVE');
    const moveKeys: Record<string, string> = { shot: 'primary', turn: 'primary', standup: 'primary', snap: 'secondary', breakdown: 'secondary', switch: 'secondary', handfight: 'setup', heist: 'setup', sprawl: 'defend' };
    ['primary','secondary','setup','defend'].forEach((action, i) => {
      this.text(`${action}-detail`, exposure && top && i === 3 ? 'USE J TO APPLY PRESSURE' : details[i]);
      const card = this.refs[`action-${action}`];
      card.classList.toggle('executing', action === 'defend' ? p.defending : moveKeys[p.move] === action && p.moveTime < p.moveDuration);
      card.classList.toggle('unavailable', exposure && (top ? i !== 0 : i !== 3));
      card.style.setProperty('--recovery', `${action === 'defend' ? 100 : (1 - Math.min(1, p.cooldown / (ground ? 0.82 : 1.3))) * 100}%`);
    });
    this.text('touch-primary', ground ? top ? 'TURN' : 'ESCAPE' : 'SHOT'); this.text('touch-secondary', ground ? top ? 'BREAK' : 'SWITCH' : 'SNAP'); this.text('touch-setup', ground ? top ? 'RELEASE' : 'HEIST' : 'SETUP');
    this.refs.danger.classList.toggle('hidden', s.exposure === 0 || s.phase !== 'wrestling');
    this.text('danger-title', top ? 'HOLD FOR THE FALL' : 'BRIDGE NOW');
    this.text('danger-detail', top ? 'HOLD J · FLATTEN BOTH SHOULDERS' : 'HOLD SPACE · KEEP A SHOULDER UP');
    this.refs['pin-fill'].style.width = `${s.pin * 100}%`;
    const event = s.events[s.events.length - 1];
    if (event && event.id !== this.lastEvent) {
      this.lastEvent = event.id; this.text('toast-title', event.text); this.text('toast-detail', event.detail);
      this.refs.toast.dataset.kind = event.kind; this.refs.toast.dataset.side = String(event.side ?? '');
    }
    this.refs.toast.classList.toggle('visible', !!event && s.age - event.at < (event.kind === 'score' ? 3.2 : 2.3) && s.phase === 'wrestling');
    if (s.phase === 'break') {
      this.text('break-kicker', this.match.periodLabel);
      this.text('break-title', s.choiceFor === 0 ? 'YOUR CHOICE.' : s.choiceFor === 1 ? 'THEIR CHOICE.' : 'OVERTIME.');
      this.text('break-detail', s.choiceFor === 0 ? (s.canDefer ? s.stage === 'regulation' ? 'You won the toss. Choose your starting position or defer.' : 'Your first tiebreaker choice. Choose a position or defer.' : 'Choose where you want to start.') : s.choiceFor === 1 ? 'Ridgefield is choosing a starting position.' : 'First score wins. Both wrestlers start on their feet.');
      this.refs.defer.querySelector('span')!.textContent = s.stage === 'regulation' ? 'Keep your choice for period 3.' : 'Keep your choice for the second tiebreaker.';
      this.text('break-score0', String(s.score[0])); this.text('break-score1', String(s.score[1]));
      this.refs.choices.classList.toggle('hidden', s.choiceFor !== 0); this.refs.defer.classList.toggle('hidden', !s.canDefer); this.refs['ai-choice'].classList.toggle('hidden', s.choiceFor === 0);
    }
    if (s.result && !this.announcedResult) {
      this.announcedResult = true;
      this.text('result-title', s.result.winner === 0 ? 'VICTORY.' : 'NEXT TIME.');
      this.text('result-subtitle', s.result.winner === 0 ? 'ELI MERCER · NORTHWOOD' : 'NOAH HAYES · RIDGEFIELD WINS');
      this.text('result-method', `${s.result.method.toUpperCase()} · ${s.result.time}`);
      this.text('final0', String(s.score[0])); this.text('final1', String(s.score[1])); this.text('stat-td', String(p.takedowns)); this.text('stat-esc', String(p.escapes)); this.text('stat-ride', clockText(s.riding[0]));
      this.text('result-note', s.result.winner === 0 ? 'The work speaks for itself. See you on the mat.' : 'Every match teaches you something. Find the next opening.');
    }
    if (!s.result) this.announcedResult = false;
  }
}
