# Mat Rivals

A 3D collegiate wrestling game for the browser, played under NCAA rules.

Built by Claude Opus 5, then continued by Claude Opus 5.5 Extra. It lives in the
`wrestling_claude/` folder of the [`memorex386/wrestling`](https://github.com/memorex386/wrestling)
repository, next to an independent alternative (`wrestling_codex/`, VARSITY). The two share
no code. Agents: see [AGENTS.md](AGENTS.md).

Node.js 22+ and npm, run from this folder:

```bash
npm ci
npm run dev      # http://localhost:5190
npm run build    # production bundle
npm run typecheck
npm run sim:stats -- 40 starter   # AI-vs-AI balance report, no rendering
```

## What a session looks like

Title screen (pick your wrestler, opponent, difficulty and match length, with the two
athletes squaring off behind a tale of the tape) → walk-out and introductions → handshake
→ first period → coin toss and second-period position choice → remaining periods, with
the other wrestler choosing before period three →
sudden victory, tiebreakers and the ultimate ride-out if it is still tied → the official
raises the winner's hand → a scorecard with stats and the scoring log.

## Controls

Movement is screen-relative: the camera keeps your wrestler on the left, so **right always
closes on your opponent**.

| | On your feet | Scramble | On top | On bottom |
|---|---|---|---|---|
| `J` / `Space` | shoot (out of range: a fake) | drive through / spin behind | tilt, half nelson (once he is broken down) | stand up, turn out |
| `K` | hand fight; with a collar tie, snap down | whizzer / snap him back down | break down | switch, hand control |
| `L` | sprawl | sprawl hips / clear your head | ride tight, return to the mat | base up, fight off your back |
| `Shift` | drop your level | | | |

`H` how to wrestle · `Esc` pause · `M` mute · `Enter` skip the introductions. Gamepads use
A / X / B and the triggers; touch devices get a thumb stick and four buttons. The action
pad in the corner always shows what each button does right now, lights up when the
position gives you an opening, and flashes the result of every press.

## How the wrestling works

Nothing is a dice roll in a vacuum; position decides it.

- **On the feet**, each wrestler has a level, a lean (balance) and hand-fight control.
  Shots from the right distance against a high or leaning opponent are hard to stop; long
  shots into a low stance get sprawled on. Lean on a man who gives ground and you fall
  forward into a snap down. Square up for a double, come off an angle for a single. Fakes
  pull sprawls. Being in the middle of something (reaching, recovering from a sprawl) is
  when you get taken down.
- **In on the legs** it is a finishing battle that tips toward whoever is winning: drive
  through for the takedown, or the defender kicks his hips back and ends on top in a front
  headlock. A double won quickly by a strong man with gas left sometimes goes up in the
  air: a lift, a turn of the corner and a safe return to the mat.
- **In a front headlock** the top man snaps him down before he spins behind — spinning on
  a man whose hips are still under him rarely works — and the bottom man digs his head out.
- **On the mat**, the bottom man's base fights the top man's control. Whoever just scored
  the takedown or reversal starts with a tight hold. Build a base before you stand up — a
  stand-up off a weak base into a tight rider just gets chopped back down — then break the
  lock with hand fighting before you turn out. On top, ride tight, chop him down and turn
  him once he is flat. A switch beats weight that is out front: the harder the top man
  just committed, the better it works, and the man who gets switched lands with no base.
  Back points come at two and five seconds of exposure, a fall at one second of shoulders
  flat.

Stamina matters throughout: bursts cost, footwork mostly does not, and a tired wrestler
shoots slower and sprawls later. The AI reads what a player can see, reacts on a human
delay, and gets sharper and more patient with difficulty rather than clairvoyant.

## How it is put together

```
src/
  sim/        the referee, the clock and the wrestling — no rendering
    rules.ts      NCAA constants and mat geometry
    bout.ts       positions, balance, hand fighting, shots, scrambles, mat wrestling
    moves.ts      transitions between positions: timing, scoring, where bodies end up
    MatchSim.ts   periods, choices, overtime, scoring, stalling, riding time
    ai.ts         the opponent
    roster.ts     schools, wrestlers and the official
  body/       athletes built from code
    anatomy.ts    a sculpted body as signed-distance muscle masses, per bone
    mesher.ts     surface nets, projection to the true surface, skin weights
    generate.ts   body, fine head and hands, headgear (runs in a worker)
    material.ts   one shader paints skin, singlet, wordmark, shoes, hair, face
    Character.ts  skinned meshes on the shared skeleton, headgear and eyes
  anim/       motion
    posture.ts    a pose as targets (hips, feet, hands, poles) and a critically damped spring
    solver.ts     two-bone IK with pole vectors, look-at, shoulder girdle
    stance.ts     the neutral stance, generated from level, lean and fatigue
    footwork.ts   planted feet that step when the body moves — no sliding
    clips.ts      paired moves and holds, with grips pinned to the other body
    library/      every hold and move, authored in the pair's frame
    Animator.ts   picks the pose, blends, plants feet, adds mass and impacts, closes grips
  game/       Game.ts wiring, sim-to-animation views, button prompts, UI store
  engine/     renderer, camera, input (keyboard, gamepad, touch), synthesised audio
  arena/      mat, gym, crowd, scoreboard
  ui/         title, HUD, action pad, results, help, touch controls
  lab/        development-only review views (see below)
  dev/        simStats.ts, the AI-vs-AI balance report behind npm run sim:stats
```

### Decisions worth knowing about

**Bodies are sculpted, not modelled.** Each athlete is a smooth union of anatomical masses
(traps, delts, lats, quads, calves…) in signed-distance form, polygonised at load time and
skinned from the same masses that shape it. A new wrestler is a row of data; builds,
heights and hair styles change the shape, not an art file. The singlet, its trim and
panels, the chest wordmark, shoes and ankle bands are all decided per pixel in the shader
from where the pixel sat in the bind pose.

**Poses are targets, not angles.** A pose says where the hips, the balls of the feet and
the wrists go; knees and elbows bend toward pole points. Feet stay planted, hands land on
the other body, and blends travel in target space so nothing breaks mid-transition.

**A move is a contract between two bodies.** Every paired move and hold is authored in one
frame for both wrestlers, its first and last keys are taken from the stance or hold it
leaves and lands in, and contacts pin a hand to a bone of the other body for as long as
the grip lasts. The simulation only needs a move's timing, scoring and end placement.

**Feel is layered on top.** Input presses are buffered so an early tap still counts,
impacts freeze-frame for a beat and shake the camera, controllers rumble, and every body
carries a little mass: the trunk lags hard accelerations and settles with some overshoot.

## Extending it

- **New move** → an entry in `sim/moves.ts`, its trigger in `sim/bout.ts`, and its clip in
  `anim/library/`. Review it with the lab before playing it.
- **New wrestler or school** → `sim/roster.ts`.
- **Rule change** → `sim/rules.ts`; feel and balance numbers live at the top of
  `sim/bout.ts` and next to each action. After changing one, run `npm run sim:stats`:
  it plays AI-vs-AI matches through the simulation and reports how often each move
  happens, how much of the match is spent on the mat, how long rides last and how
  matches end. Two AIs score more than a person does, so read it for shape — a loop, a
  dead position, a move that never or always happens — not for exact numbers.
- **Camera language** → the `SHOTS` table in `engine/CameraRig.ts`.

### The lab

In development, `?lab=…` replaces the game with review views rendered from fixed cameras:

- `?lab=body&pose=rest|bind|bend&focus=hands` — a body from six angles.
- `?lab=stance&d=1.0` — two wrestlers squared up.
- `?lab=pair&clip=finishDouble&strip=1&cam=side` — a move as a six-frame strip;
  `&hold=1&t=0.5` shows a hold at a given progress.
- `?lab=style&v=cartoon|lowpoly|realistic|current` — the character art-direction mockups,
  as a six-shot sheet; `&orbit=1` to rotate. See [docs/style-mockups](docs/style-mockups/).
  The same mockups are also built as a standalone page, `mockups.html`, which is published at
  https://memorex386.github.io/wrestling/mat-rivals/mockups.html.

`window.matRivals` exposes the running `Game` (and `.sim`) for poking at live state.

## Status

Desktop is the main target: 60 fps at 1440×810 in a headless Chromium, no console errors
across full matches. Phones get a lower mesh resolution, touch controls and a compact
layout; they have been checked at phone size in a browser, not yet on a physical device.

The playable selection uses the locked College Wrestling Legends v1.1 roster: 26 teams,
312 default starter slots, plus Coach’s Choice entries with explicitly assigned weights.
Team and weight selectors keep opponents in the same class. Choices without assigned
weights and all special notes are preserved in the roster notes without guessing a slot.
The verbatim source is `docs/rosters/master-roster-v1.1.txt`; the runtime catalog is
`src/sim/legends-roster.json`. Appearances, uniforms and equal gameplay ratings are
provisional; displayed names and slots are locked, but these are not athlete likenesses
or verified historical profiles. No fictional records are displayed for Legends.
Signature moves and commentary hooks are retained as notes pending implementation.

The original four fictional profiles remain only as deterministic balance-check fixtures.
The art-direction mockups in
[docs/style-mockups](docs/style-mockups/) use two real wrestlers, Kyle Dake and David Taylor,
by the owner's choice.
