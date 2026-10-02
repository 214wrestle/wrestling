# Architecture

## Boundaries

The simulation owns positions, contact states, resources, clocks and scoring. It
does not import the DOM, Babylon.js or Web Audio. Player input and opponent AI
produce the same `Controls` object. Rendering reads the resulting state and
interpolates presentation poses; no mesh collision or animation event awards points.

The main loop advances simulation in fixed 1/60-second steps, with bounded
catch-up. Rendering follows the actual frame interval. Blurring or hiding the
page pauses play. Only match and riding clocks use the selected clock multiplier;
shot reactions, near-fall counts and falls use real-time seconds.

## File map

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Composition, fixed-step loop, pause lifecycle, sound events |
| `src/game/types.ts` | Commands, state, events and result contracts |
| `src/game/rules.ts` | Scoring constants and pure threshold functions |
| `src/game/Match.ts` | Match transitions, wrestling exchanges, position and timekeeping |
| `src/game/OpponentAI.ts` | Replaceable opponent input strategy, difficulty and reaction timing |
| `src/game/Input.ts` | Keyboard, gamepad and touch normalization |
| `src/render/Arena.ts` | Scene, cameras, environment, lighting, instancing, scoreboard |
| `src/render/Wrestler.ts` | Procedural athlete anatomy and interpolated contextual poses |
| `src/render/materials.ts` | Reusable material, mesh and canvas-texture builders |
| `src/render/babylon.ts` | Explicit engine feature imports and required registration |
| `src/audio/Sound.ts` | Locally synthesized audio, enabled by a user gesture |
| `src/ui/UI.ts`, `src/style.css` | Menu, broadcast overlay, help, period and result screens |
| `tests/match.test.ts` | Deterministic rules and match regression tests |
| `tests/browser-*.mjs` | Render/input smoke checks and controlled late-match fixtures |
| `tests/play-match.mjs` | End-to-end keyboard match, finish and rematch |
| `scripts/play.ps1`, `scripts/stop.ps1` | Standalone Windows launcher and owned-process shutdown |

## Engine choice

Babylon.js is a mature TypeScript 3D engine with cameras, animation, scene graphs,
shadows, instancing, glTF support and WebGL/WebGPU renderers. This prototype uses
its WebGL engine for broad desktop/mobile browser compatibility. WebGPU is not
required. Vite bundles engine features and local font assets into a static build.

The current matches use controlled kinematics and explicit contact states, rather
than free ragdoll physics. This makes wrestling interactions readable and lets
rules be tested deterministically. Adding a physics library alone does not produce
credible two-person wrestling. A later animation/IK upgrade can use Babylon's
physics integration for secondary motion and collision while keeping scoring
inside the simulation. See [engine capabilities](https://www.babylonjs.com/specifications/)
and [documentation](https://doc.babylonjs.com/).

## Extending the game

### Athlete motion and input

Neutral movement accelerates and brakes with bounded velocity changes. A body
separation constraint prevents the two neutral roots from passing through each
other and removes inward velocity at contact. Takedowns align the two bodies
through the exchange; mat control preserves the attack direction. Escape spacing
changes continuously before control is released.

The procedural renderer has two-bone arm and leg reach constraints, alternating
foot plants during locomotion, articulated hands, and opponent-relative contact
targets for hand fighting, shots and riding. A hip heist has a separate seated
pose; breakdowns move the defender's base; exposure turns the torso face-up and
shifts the top wrestler over the chest. Poses blend into one another independently
of the scoring clock. These are controlled kinematics, not a rigid-body or soft-body
physics solver: limb collisions and contact forces remain approximations.

Inputs arriving in the final 350 ms of recovery can queue one follow-up action.
Old requests expire, and a fresh available action replaces the queue. The action
deck displays current position, purpose, recovery, active move and contextual pin
controls. Mouse, touch and keyboard feed the same commands.

1. **New move:** extend `Move` / `Exchange`, add the simulation's conditions,
   stamina costs, timing and outcome; add its rendering pose/animation and input
   label. Test successful, defended, out-of-range and buzzer cases.
2. **Better athlete assets:** replace `WrestlerView` with a glTF/skinned actor
   adapter preserving its `update(wrestler, matchState, dt, time)` boundary. Use
   authored two-person animation clips and IK targets; rendering must not mutate
   the score. Procedural assets remain a useful no-download fallback.
3. **New opponent:** implement `OpponentController`, inject it into `Match`.
   The controller returns commands, not score changes. Use the supplied seeded
   random source so a command sequence can be reproduced.
4. **Local two-player:** pass a second player's normalized `Controls` into
   `Match.step`. The second input already overrides AI for testing. A second
   input adapter, controller assignment screen and player-facing UI are still needed.
5. **Online play:** move authoritative simulation to a host/server and add input
   sequencing, snapshots and reconciliation. The current separation helps, but
   this release is not networked and does not claim rollback support.
6. **Rosters and seasons:** introduce data-driven team/athlete profiles and
   persistent competition state above `Match`. The current two profiles are
   intentionally fixed. Do not hardwire season state into the renderer.
7. **Phone performance:** begin with Balanced quality, profile on real devices,
   then consider merged crowd meshes, reduced materials and character LOD.

## Development and debugging

Run `npm run dev` for hot reload. The development build exposes
`window.__VARSITY__` (`match`, `arena`, `input`, `ui`) for controlled test fixtures
and scene inspection. Vite removes this hook from production builds.

Use `match.state.events` for scoring chronology; use `arena.engine.getFps()` for
render throughput. Pause before inspecting state interactively. To inspect rules
without a renderer, instantiate `Match` with a fixed seed and pass both inputs to
`step`. Reset state between scenarios; never fix a scoring bug in a UI label.

The renderer uses instances for spectators, a shared shadow map and procedural
canvas textures. Static geometry is frozen. Fonts, textures, geometry and audio
need no runtime internet access. Keep imports through the small Babylon gateway
instead of the package-wide barrel, which pulls in unused engine subsystems.

## Scope of the foundation

This is a playable vertical slice, not a finished commercial sports simulation.
There is no asset editor, full skeletal animation pipeline, online multiplayer,
replay system, persistence beyond settings, career mode or licensed content yet.
Those can be added through the boundaries above without rewriting the scoring core.
