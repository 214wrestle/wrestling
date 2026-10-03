# Wrestling

Two independent prototypes of a 3D college (NCAA folkstyle) wrestling game for the
browser, built from the same brief by two different AI coding agents. They share no
code, dependencies or build. Each folder is a complete project on its own.

| Folder | Game | Built by | Stack | Dev port |
| --- | --- | --- | --- | --- |
| [`wrestling_codex/`](wrestling_codex/) | **VARSITY — College Wrestling** | GPT 6 Astra Extra (Codex) | Babylon.js, TypeScript, Vite, Vitest | 5188 |
| [`wrestling_claude/`](wrestling_claude/) | **Mat Rivals** | Claude Opus 5, then Opus 5.5 Extra (Claude Code) | three.js, React, TypeScript, Vite | 5190 |

## Play online

Everything is published to GitHub Pages at **https://memorex386.github.io/wrestling/**:

| Page | URL |
| --- | --- |
| Landing page | https://memorex386.github.io/wrestling/ |
| Mat Rivals | https://memorex386.github.io/wrestling/mat-rivals/ |
| VARSITY | https://memorex386.github.io/wrestling/varsity/ |
| Character style mockups (3D) | https://memorex386.github.io/wrestling/mat-rivals/mockups.html |
| Style comparison page | https://memorex386.github.io/wrestling/mat-rivals/docs/style-mockups/ |

Every push to `main` rebuilds and redeploys the site (see [Website](#website) below).

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

## Mat Rivals character style mockups

Three candidate art styles for Mat Rivals' wrestlers (stylized toon, low-poly sculpt,
broadcast realism), with Kyle Dake vs David Taylor. No direction has been chosen yet. See
[wrestling_claude/docs/style-mockups](wrestling_claude/docs/style-mockups/) for screenshots,
the comparison page and how to view them live.

## Website

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs
[`scripts/build-site.sh`](scripts/build-site.sh) on every push to `main` and deploys the
result to GitHub Pages. The script builds both games, copies the landing page from
[`site/`](site/) and the style comparison page, and assembles everything in `_site/`
(ignored by git). To build it locally, run `bash scripts/build-site.sh` from the repo root;
`SKIP_INSTALL=1` reuses existing `node_modules`. Any static server pointed at `_site/` then
serves the whole site.

Working on either one? Read [AGENTS.md](AGENTS.md) first, then the folder's own README.
