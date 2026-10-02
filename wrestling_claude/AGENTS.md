# Mat Rivals — agent guide

Built by Claude Opus 5, then continued by Claude Opus 5.5 Extra (Claude Code). This
folder is one of two independent games in the `wrestling` repository; see the root
`AGENTS.md`. Do not integrate it with the sibling `wrestling_codex/` project or
any backend.

Read README.md first: it has the module map, the design decisions and where to add
moves, wrestlers and rules. Port 5190 belongs to this game.

## Run and check

Node.js 22+ and npm, from this folder:

```bash
npm ci                            # restore dependencies
npm run typecheck                 # tsc --noEmit
npm run build                     # tsc -b + vite build into dist/
npm run sim:stats -- 40 starter   # AI-vs-AI balance report, no rendering
npm run dev                       # http://localhost:5190, hot reload
```

There is no unit-test suite. Use these instead:

- **Rules or balance changes** (`src/sim/`): run `npm run sim:stats` before and after,
  and compare the shape — move frequencies, mat share, ride length, how matches end.
  Look for loops, dead positions or moves that never/always happen.
- **Animation or body changes**: open the dev-only lab views, for example
  `http://localhost:5190/?lab=pair&clip=finishDouble&strip=1&cam=side`,
  `?lab=stance&d=1.0` or `?lab=body&pose=rest`. See README "The lab".
- **Live state**: `window.matRivals` exposes the running `Game` (and `.sim`) in the
  browser console.
- Play a full match in the browser and check the console stays free of errors.

`mat-rivals-before-after.png` is a reference screenshot from development, not a
runtime asset.

## Invariants

- `src/sim/` is the referee and never imports rendering code; animation reads the
  sim, never the other way round.
- Moves are authored as paired clips in the pair's frame (`src/anim/library/`); the
  sim only needs a move's timing, scoring and end placement.
- Bodies are generated from data in `src/body/`; there are no model files to edit.
- Keep audio synthesised and assets self-contained.
