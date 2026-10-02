# Wrestling

Two independent prototypes of a 3D college (NCAA folkstyle) wrestling game for the
browser, built from the same brief by two different AI coding agents. They share no
code, dependencies or build. Each folder is a complete project on its own.

| Folder | Game | Built by | Stack | Dev port |
| --- | --- | --- | --- | --- |
| [`wrestling_codex/`](wrestling_codex/) | **VARSITY — College Wrestling** | GPT 6 Astra Extra (Codex) | Babylon.js, TypeScript, Vite, Vitest | 5188 |
| [`wrestling_claude/`](wrestling_claude/) | **Mat Rivals** | Claude Opus 5, then Opus 5.5 Extra (Claude Code) | three.js, React, TypeScript, Vite | 5190 |

## Quick start

Node.js 22+ and npm. Run commands **inside the project folder**, not at the root:
there is no root `package.json` or workspace.

```bash
cd wrestling_codex && npm ci && npm run dev    # http://localhost:5188
cd wrestling_claude && npm ci && npm run dev   # http://localhost:5190
```

They use different ports and can run at the same time. On Windows,
`wrestling_codex/Play Varsity.cmd` installs dependencies, starts a hidden server and
opens the browser; `Stop Varsity.cmd` stops it.

## How the two differ

| | VARSITY (`wrestling_codex`) | Mat Rivals (`wrestling_claude`) |
| --- | --- | --- |
| Rendering | Babylon.js scene, procedural characters | three.js; bodies sculpted from signed-distance muscle masses, meshed in a worker |
| UI | Plain DOM / TypeScript | React 19 |
| Animation | Procedural poses per action | IK pose targets, planted footwork, paired move clips pinned to the other body |
| Rules | NCAA folkstyle, 3/2/2 periods, riding time, overtime | NCAA folkstyle, 3/2/2 periods, riding time, overtime, stalling |
| Tests | Vitest rules tests (`npm test`) + Playwright browser scripts | Typecheck, AI-vs-AI balance report (`npm run sim:stats`), `?lab=` review views |
| Extra docs | `docs/ARCHITECTURE.md`, `RULES.md`, `VERIFICATION.md`, `CREDITS.md` | Architecture and extension notes in its README |

## Status (checked 2026-10-02)

- `wrestling_codex`: `npm ci`, `npm test` (29 passing) and `npm run build` succeed;
  dev server serves on 5188.
- `wrestling_claude`: `npm ci`, `npm run typecheck`, `npm run build` and
  `npm run sim:stats` succeed; dev server serves on 5190.
- Neither has been tested on a physical phone or with a hardware gamepad.

Working on either one? Read [AGENTS.md](AGENTS.md) first, then the folder's own README.
