# VARSITY — College Wrestling

A standalone, playable 3D collegiate folkstyle wrestling prototype. Northwood's
Eli Mercer faces Ridgefield's Noah Hayes at 157 lb in a complete exhibition:
introductions → wrestling → period choices → final whistle → celebration → rematch.

Built by GPT 6 Astra Extra (Codex). It lives in the `wrestling_codex/` folder of the
[`memorex386/wrestling`](https://github.com/memorex386/wrestling) repository, next to
an independent alternative (`wrestling_claude/`, Mat Rivals). The two share no code.
Agents: see [AGENTS.md](AGENTS.md).

## Play on this computer

Double-click **Play Varsity.cmd**, or open **http://localhost:5188/** when the game
server is already running. Double-click **Stop Varsity.cmd** to stop a server
started by the launcher. The launcher opens your default browser and keeps its
server hidden. Chrome or Edge with hardware acceleration is recommended.

Start with **Club** difficulty and **Quick** pace. The title screen's **Learn the
controls** button explains positioning, attacks and scoring. The game pauses when
its window loses focus.

| Control | Neutral | On top | On bottom |
| --- | --- | --- | --- |
| WASD / arrows | Move around the mat | — | Crawl toward a restart |
| Shift + movement | Drive faster; uses stamina | — | — |
| J | Double-leg shot | Half nelson / turn | Stand up / escape |
| K | Snap-down | Breakdown | Switch / reversal |
| L | Hand fight / create opening | Release (+1 to opponent) | Hip heist / escape |
| Hold Space | Sprawl | Defend the ride | Brace / bridge out |
| Hold J during near fall | — | Pinning pressure | — |
| C / Q / E | Camera preset / orbit left / orbit right | | |
| Esc / H / M | Pause / help / mute | | |

Get close, hand fight twice with **L**, then attack. A prepared shot is stronger.
Use **K** when an opponent is waiting to sprawl. On the mat, alternate **J** and
**K** rather than repeating one move. Stamina recovers when you stop exerting.

The move cards also work with a mouse. They change with your position, show what
each action achieves and highlight the action being performed. Their lower bars
show recovery; a late tap in the last 350 ms queues the next move. During a near
fall the cards change to pin pressure or bridging guidance.

Standard gamepad mappings are also implemented: left stick moves, A shoots, X
snaps, B sets up, RT defends, LT drives and Start pauses. Hardware gamepad testing
has not been performed.

## What's included

- A 3D college fieldhouse, animated athletes in headgear and singlets, referee,
  instanced spectators, maple court, competition mat, banners and live scoreboard.
- Contextual procedural animations for shots, sprawls, hand fighting, breakdowns,
  turns, escapes, switches, bridging, introductions and victory.
- Three AI difficulties, stamina and setup advantages, timed defense, mat control,
  boundary restarts, near falls and pins.
- 3/2/2 regulation periods, position choice and deferral, riding time, technical
  falls, decisions, sudden victory and paired tiebreakers. Details and boundaries
  are documented in [docs/RULES.md](docs/RULES.md).
- Synthesized whistle, impacts, crowd ambience and victory audio; volume can be muted.
- Three camera presets, orbit keys, fullscreen, pause, help, rematch and local settings.
- Basic phone controls and responsive layouts. Desktop remains the primary target.

The schools and athletes are fictional. This is an independent prototype using
NCAA men's folkstyle scoring, not an NCAA-licensed product. It uses stylized,
procedurally built characters, not scanned athletes or motion-captured wrestling.

## Run and develop

Node.js 22+ and npm are required. Run commands **inside this directory**:

```powershell
npm ci
npm run dev       # http://localhost:5188 — hot reload
npm test          # focused, browser-independent rules and match tests
npm run build    # typecheck and production build into dist/
npm run preview  # serve the production build, after stopping the dev server
```

The development server listens on the local network. A phone on the same network
can use this computer's LAN address with port 5188; prefer landscape orientation.
Firewall/network access and performance on a physical phone have not been verified.
The desktop launcher's console log lists available network URLs.

Optional browser checks, with the dev server running:

```powershell
node tests/browser-smoke.mjs
node tests/browser-flows.mjs
node tests/play-match.mjs
node tests/player-visuals.mjs
```

These use the Chrome installation at the path declared in each script. Set
`CHROME_PATH` to override it on a different computer. Screenshots are written to
the ignored `test-results/` directory. Browser-flow checks use development-only
fixtures to reach late-match states; `play-match.mjs` completes a match through
keyboard input and exercises the rematch button.

## Foundation

[Babylon.js](https://www.babylonjs.com/specifications/) provides the scene graph,
cameras, geometry, lighting, shadows, instancing and post-processing. TypeScript
keeps simulation contracts explicit; Vite provides hot reload and static builds;
Vitest tests rules without a GPU. No React render loop, backend, account, API key,
database, runtime CDN or analytics is required.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, simulation
boundaries and extension points, and [docs/VERIFICATION.md](docs/VERIFICATION.md)
for tested behavior and remaining work.
