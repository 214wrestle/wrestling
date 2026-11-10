import { startStyle } from './styles';

/**
 * Production entry for the character art-direction mockups (mockups.html), so
 * they can be hosted as a static site. ?v=<style> shows that style with the same
 * parameters as ?lab=style in development (&orbit=1, &view=…); without it, a
 * menu lists the styles.
 */

const STYLES = [
  { id: 'cartoon', name: 'Stylized toon', note: 'Cel-shaded comic look with ink outlines' },
  { id: 'lowpoly', name: 'Low-poly sculpt', note: 'Faceted and phone-friendly' },
  { id: 'realistic', name: 'Broadcast realism', note: 'Grounded anatomy; the slowest to load' },
  { id: 'current', name: 'Current look', note: 'Today’s characters, for comparison' },
];

const COMPARISON = 'docs/style-mockups/';

const css = `
  .mk-menu { min-height: 100vh; box-sizing: border-box; padding: 32px 16px; color: #eceae6;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 760px; margin: 0 auto; }
  .mk-menu h1 { font-size: 26px; margin: 0 0 6px; }
  .mk-menu p { color: #a2a6ae; margin: 0 0 20px; }
  .mk-menu a { color: #ff8a80; }
  .mk-card { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; background: #1a1d23;
    border: 1px solid #2c3038; border-radius: 12px; padding: 14px 16px; margin: 0 0 10px; }
  .mk-card b { font-size: 17px; }
  .mk-card span { color: #a2a6ae; flex: 1 1 220px; }
  .mk-card a { text-decoration: none; border: 1px solid #3a3f49; border-radius: 999px; padding: 5px 12px; color: #eceae6; }
  .mk-card a.primary { background: #eceae6; color: #111; border-color: #eceae6; }
  .mk-nav { position: fixed; right: 10px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 6px; z-index: 5;
    font: 600 12px system-ui, sans-serif; }
  .mk-nav a { background: rgba(13, 15, 19, 0.82); color: #fff; text-decoration: none; padding: 6px 10px;
    border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.18); }
  .mk-nav a[aria-current="page"] { background: #fff; color: #111; }
  .mk-loading { position: fixed; inset: 0; display: grid; place-items: center; color: #eceae6;
    font: 16px system-ui, sans-serif; background: #0d0f13; z-index: 10; }
`;

function addStyles(): void {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

function menu(host: HTMLElement): void {
  const cards = STYLES.map(
    (s) => `<div class="mk-card"><b>${s.name}</b><span>${s.note}</span>
      <a class="primary" href="?v=${s.id}&orbit=1">3D view</a><a href="?v=${s.id}">Six-shot sheet</a></div>`,
  ).join('');
  host.innerHTML = `<main class="mk-menu">
    <h1>Mat Rivals — character style mockups</h1>
    <p>Three candidate art styles for the wrestlers, each showing Kyle Dake (Cornell) vs David Taylor
    (Penn State) from the 2013 NCAA 165&nbsp;lb final. In the 3D view, drag to orbit and scroll or pinch
    to zoom. Scores and notes are on the <a href="${COMPARISON}">comparison page</a>.</p>
    ${cards}
  </main>`;
}

function nav(current: string, orbit: boolean): void {
  const bar = document.createElement('nav');
  bar.className = 'mk-nav';
  const mode = orbit ? '&orbit=1' : '';
  bar.innerHTML =
    STYLES.map(
      (s) => `<a href="?v=${s.id}${mode}"${s.id === current ? ' aria-current="page"' : ''}>${s.name}</a>`,
    ).join('') +
    `<a href="?v=${current}${orbit ? '' : '&orbit=1'}">${orbit ? 'Sheet' : '3D view'}</a><a href="./mockups.html">All</a>`;
  document.body.appendChild(bar);
}

async function main(): Promise<void> {
  addStyles();
  const host = document.getElementById('root');
  if (!host) throw new Error('Missing #root');
  const params = new URLSearchParams(location.search);
  const v = params.get('v');
  if (!v) {
    menu(host);
    return;
  }
  // Bodies are generated on load, which blocks the page for a few seconds.
  const loading = document.createElement('div');
  loading.className = 'mk-loading';
  loading.textContent = 'Building athletes…';
  document.body.appendChild(loading);
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  await startStyle(host);
  loading.remove();
  nav(v, params.get('orbit') === '1');
}

void main();
