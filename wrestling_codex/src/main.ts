import './style.css';
import { Match } from './game/Match';
import { Input } from './game/Input';
import { Arena } from './render/Arena';
import { Sound } from './audio/Sound';
import { UI } from './ui/UI';
import type { MatchSettings } from './game/types';

function loadSettings(): Partial<MatchSettings> {
  try {
    const raw = JSON.parse(localStorage.getItem('varsity-settings-v1') ?? '{}');
    return {
      difficulty: ['club', 'varsity', 'champion'].includes(raw.difficulty) ? raw.difficulty : 'club',
      clockSpeed: raw.clockSpeed === 1 ? 1 : 2,
      sound: raw.sound !== false,
      quality: raw.quality === 'balanced' ? 'balanced' : 'high',
    };
  } catch { return {}; }
}

const match = new Match(loadSettings(), Date.now() & 0xffff);
const sound = new Sound(); sound.setEnabled(match.settings.sound);
let arena: Arena;
let input: Input;
const ui = new UI(match, {
  start: () => { ui.closeHelp(); input?.clear(); void sound.start(); match.start(); },
  menu: () => { ui.closeHelp(); input?.clear(); match.reset(false); },
  pause: () => { input?.clear(); match.pause(); },
  sound: () => { match.settings.sound = !match.settings.sound; sound.setEnabled(match.settings.sound); void sound.start(); ui.settings(); },
  camera: () => arena?.cycleCamera(),
  quality: () => { match.settings.quality = match.settings.quality === 'high' ? 'balanced' : 'high'; arena?.quality(match.settings.quality); ui.settings(); },
});

try {
  arena = new Arena(document.querySelector<HTMLCanvasElement>('#arena')!); arena.quality(match.settings.quality);
  input = new Input(() => match.state.phase === 'wrestling', code => {
    if (code === 'Escape') ui.escape();
    if (code === 'KeyH') ui.toggleHelp();
    if (code === 'KeyC') arena.cycleCamera();
    if (code === 'KeyQ') arena.rotate(-Math.PI / 6);
    if (code === 'KeyE') arena.rotate(Math.PI / 6);
    if (code === 'KeyM') { match.settings.sound = !match.settings.sound; sound.setEnabled(match.settings.sound); ui.settings(); }
  });
  input.attachTouch();
  let previous = performance.now(), accumulator = 0, eventId = 0, frames = 0;
  const fixed = 1 / 60;
  arena.engine.runRenderLoop(() => {
    const now = performance.now(), elapsed = Math.min((now - previous) / 1000, 0.1); previous = now;
    accumulator += elapsed;
    while (accumulator >= fixed) {
      const controls = input.read(), movement = arena.movement(controls.x, controls.z);
      controls.x = movement.x; controls.z = movement.z;
      match.step(fixed, controls); accumulator -= fixed;
    }
    for (const e of match.state.events) if (e.id > eventId) {
      eventId = e.id;
      if (e.kind === 'score') { sound.score(); arena.impact(); }
      else if (e.kind === 'whistle') sound.whistle();
      else if (e.kind === 'finish') sound.finish();
    }
    arena.update(match.state, elapsed); ui.update();
    if (++frames === 3) ui.ready();
  });
  const autoPause = () => { if (['wrestling', 'intro', 'break'].includes(match.state.phase)) { input.clear(); match.pause(); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  window.addEventListener('blur', autoPause);
  // Development-only, explicit test hook: not included in the production build.
  if (import.meta.env.DEV) Object.assign(window, { __VARSITY__: { match, arena, input, ui } });
  if (import.meta.hot) import.meta.hot.dispose(() => { input.dispose(); sound.dispose(); arena.dispose(); window.removeEventListener('blur', autoPause); });
} catch (error) {
  console.error(error);
  document.querySelector('#boot')!.innerHTML = '<strong>The arena could not open.</strong><p>Try Chrome or Edge with hardware acceleration enabled, then reload.</p><button onclick="location.reload()">Try again</button>';
}
