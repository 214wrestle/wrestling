import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:5188/', { waitUntil: 'networkidle' });
await page.locator('#boot').waitFor({ state: 'hidden' });
await page.getByRole('button', { name: 'STEP ON THE MAT' }).click();
await page.waitForTimeout(7000);
console.log('Introduction completed automatically. Playing through keyboard input.');
const started = Date.now(); let lastAction = 0, actions = 0, holding = '', firstGround = false, firstDanger = false;
let lastReport = 0;
while (Date.now() - started < 270000) {
  const s = await page.evaluate(() => {
    const g = window.__VARSITY__, s = g.match.state, p = s.wrestlers[0], o = s.wrestlers[1];
    return { phase: s.phase, top: s.top, score: s.score, remaining: s.remaining, period: s.period, stage: s.stage, control: s.control, exposure: s.exposure, choiceFor: s.choiceFor, p, o, exchange: s.exchange, fps: g.arena.engine.getFps(), alpha: g.arena.camera.alpha };
  });
  if (Date.now() - lastReport > 25000) { console.log('PLAY', JSON.stringify({ phase: s.phase, period: s.period, stage: s.stage, score: s.score, remaining: Math.ceil(s.remaining), fps: Math.round(s.fps) })); lastReport = Date.now(); }
  if (s.phase === 'finished') break;
  if (s.phase === 'break') {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'Space']) await page.keyboard.up(k);
    holding = '';
    if (s.choiceFor === 0) await page.locator('[data-choice="bottom"]').click();
    await page.waitForTimeout(200); continue;
  }
  if (s.phase === 'paused') { await page.getByRole('button', { name: 'BACK TO THE MATCH' }).click(); continue; }
  const danger = s.exposure > 0;
  const attack = s.exchange && s.exchange.actor === 1 && ['shot', 'snap'].includes(s.exchange.kind);
  const hold = danger ? (s.top === 0 ? 'KeyJ' : 'Space') : attack ? 'Space' : '';
  if (hold !== holding) { if (holding) await page.keyboard.up(holding); if (hold) await page.keyboard.down(hold); holding = hold; }
  if (s.top !== null && !firstGround) { await page.screenshot({ path: 'test-results/played-ground.png' }); firstGround = true; }
  if (danger && !firstDanger) { await page.screenshot({ path: 'test-results/played-nearfall.png' }); firstDanger = true; }
  if (s.top === null) {
    const dx = s.o.x - s.p.x, dz = s.o.z - s.p.z, d = Math.hypot(dx, dz);
    const screenX = -Math.sin(s.alpha) * dx + Math.cos(s.alpha) * dz, screenZ = -Math.cos(s.alpha) * dx - Math.sin(s.alpha) * dz;
    const wanted = new Set();
    if (d > 1.32 && !s.exchange) { if (Math.abs(screenX) > 0.3) wanted.add(screenX > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(screenZ) > 0.3) wanted.add(screenZ > 0 ? 'KeyW' : 'KeyS'); }
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) if (wanted.has(k)) await page.keyboard.down(k); else await page.keyboard.up(k);
    if (!s.exchange && d < 1.8 && s.p.cooldown <= 0 && s.p.stamina > 24 && Date.now() - lastAction > 650) {
      await page.keyboard.press(s.p.setup < 0.64 ? 'KeyL' : s.o.defending ? 'KeyK' : 'KeyJ'); lastAction = Date.now(); actions++;
    }
  } else {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k);
    if (!danger && !s.exchange && s.p.cooldown <= 0 && s.p.stamina > 14 && Date.now() - lastAction > 850) {
      await page.keyboard.press(actions % 2 ? 'KeyJ' : 'KeyK'); lastAction = Date.now(); actions++;
    }
  }
  await page.waitForTimeout(100);
}
for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'Space']) await page.keyboard.up(k);
const final = await page.evaluate(() => ({ result: window.__VARSITY__.match.state.result, score: window.__VARSITY__.match.state.score, events: window.__VARSITY__.match.state.events.map(e => e.text) }));
console.log('COMPLETE', JSON.stringify(final));
if (!final.result) throw new Error('Match did not finish within 270 seconds');
await page.waitForTimeout(2800); await page.screenshot({ path: 'test-results/played-result.png' });
await page.getByRole('button', { name: 'RUN IT BACK' }).click();
const reset = await page.evaluate(() => ({ phase: window.__VARSITY__.match.state.phase, score: window.__VARSITY__.match.state.score }));
console.log('REMATCH', JSON.stringify(reset), 'ERRORS', JSON.stringify(errors));
await browser.close();
