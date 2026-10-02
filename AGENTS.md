# Agent guide — wrestling repository

This repository holds two **separate** game projects. Treat each folder as its own
project; the root is only a container.

| Folder | Game | Origin | Port | Its own guide |
| --- | --- | --- | --- | --- |
| `wrestling_codex/` | VARSITY (Babylon.js) | GPT 6 Astra Extra (Codex) | 5188 | `wrestling_codex/AGENTS.md` |
| `wrestling_claude/` | Mat Rivals (three.js + React) | Claude Opus 5 → Opus 5.5 Extra | 5190 | `wrestling_claude/AGENTS.md` |

## Rules for both

- Run `npm` commands inside the project folder. There is no root package or workspace;
  do not add one or share code between the two projects unless the owner asks.
- Change only the project the task is about. If the request is ambiguous ("the
  wrestling game"), ask which one, or say which one you are assuming.
- Keep each project's port. Both can run side by side.
- Neither project depends on any backend, account, API key or analytics.
  Keep assets (fonts, sound, graphics) self-contained; no runtime CDNs.
- Teams and athletes are fictional. Do not add real NCAA marks, schools or athletes.
- Before finishing, run that project's checks (listed in its `AGENTS.md`) and look at
  visual changes in a browser. Report what you could not verify.
- `node_modules/`, `dist/`, logs and screenshots are ignored. Restore dependencies with
  `npm ci`.

## Verified run commands

```bash
# VARSITY
cd wrestling_codex
npm ci
npm test           # Vitest rules/match tests, no browser needed
npm run build      # typecheck + production build
npm run dev        # http://localhost:5188

# Mat Rivals
cd wrestling_claude
npm ci
npm run typecheck
npm run build
npm run sim:stats -- 40 starter   # AI-vs-AI balance report
npm run dev        # http://localhost:5190
```
