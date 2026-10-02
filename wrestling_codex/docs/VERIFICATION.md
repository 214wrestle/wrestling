# Verification — October 1, 2026

## Automated checks

- 29 focused Vitest cases pass: scoring, riding time, near falls, falls, technical
  falls, period choice, deferral, overtime, boundaries, restart and buzzer handling;
  input buffering/expiration, input immutability, acceleration/braking, body spacing
  and preserved ground heading are included.
- TypeScript checking and the Vite production build pass.
- Chrome player checks exercise mouse setup, buffered keyboard attacks, takedown,
  top control, breakdown, pin pressure and the distinct bottom hip heist. The
  contextual labels and highlights are asserted and screenshots captured.
- Browser flow checks cover period choices, pause, camera orbit/presets, graphics
  quality, and emulated phone layouts/input.
- The final player revision completed all three periods through keyboard input:
  Northwood won a 17–9 major decision at 7:00. The rematch returned to introductions
  with both scores at zero, and no browser errors were reported. An earlier match
  also exercised a fall and rematch. Source hot reload interrupted one intermediate
  test; the final full run was performed with source held stable.
- Production smoke checks verify loading, keyboard actions, pause/menu, absence of
  the development hook, browser errors and external asset requests.

## Visual review

Inspected rendered Chrome screenshots of the menu, introductions, neutral stance,
shot contact, riding, breakdown, face-up exposure, hip heist, help, period choice,
finish, and mobile layouts. The tested desktop view is 1440 × 900. Observed render
throughput was approximately 60 fps on this computer; this is not a hardware-wide
performance guarantee. Screenshots are in ignored `test-results/`.

## Practical limits

The athletes are stylized procedural meshes. Their motion uses constrained poses
and contact targets, not motion capture, a full skeletal asset pipeline or a force-
based grappling simulation. Interpenetration remains possible during transitions.
The referee and rules cover the playable match flow with the approximations listed
in RULES.md. Physical-phone and hardware-gamepad testing remain outstanding.

Run `node tests/player-visuals.mjs` for the focused player/control pass. The browser
scripts require the running dev server; production-smoke.mjs expects a production
preview at 127.0.0.1:5190. Avoid editing source during a playthrough, since Vite hot
reload intentionally restarts the game.
