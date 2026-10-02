# Varsity — agent guide

Built by GPT 6 Astra Extra (Codex). This folder is one of two independent games in the
`wrestling` repository; see the root `AGENTS.md`. Do not integrate it with the sibling
`wrestling_claude/` project or any API, account, deployment pipeline or
analytics.

Read README.md, docs/ARCHITECTURE.md and docs/RULES.md before extending gameplay.
Use the local npm scripts. Port 5188 belongs to this game.

## Run and check

Node.js 22+ and npm, from this folder:

```bash
npm ci            # restore dependencies
npm test          # Vitest rules and match tests (no browser)
npm run build     # tsc --noEmit + vite build into dist/
npm run dev       # http://localhost:5188, hot reload
```

On Windows, `Play Varsity.cmd` does the install/start/open steps and writes logs to
`.runtime/`; `Stop Varsity.cmd` stops that server.

Optional browser checks need the dev server running and a local Chrome. Set
`CHROME_PATH` if Chrome is not at `C:/Program Files/Google/Chrome/Application/chrome.exe`:

```bash
node tests/browser-smoke.mjs
node tests/browser-flows.mjs
node tests/play-match.mjs
node tests/player-visuals.mjs
```

Screenshots go to the ignored `test-results/` folder.

## Invariants

The simulation is authoritative; renderer poses never award points. Preserve the
fixed-step clock, seeded randomness and ability to test rules without a browser.
Test new scoring behavior with focused Vitest cases. Visually inspect animation
and interface changes in Chrome. Keep fonts, graphics and sound self-contained.
