# Rules and simulation scope

This game models **NCAA men's collegiate folkstyle**, using the 2025–26 / 2026–27
rules as the reference. It does not use freestyle scoring or professional wrestling.

## Implemented

| Situation | Behavior |
| --- | --- |
| Regulation | Three periods: 3 minutes, 2 minutes, 2 minutes |
| Takedown | 3 points, after the attack establishes control |
| Escape | 1 point when bottom returns to neutral, including optional release |
| Reversal | 2 points when bottom gains top control |
| Near fall | 2, 3 or 4 points at 2, 3 or 4 real-time counts; awarded on release or at the horn, once per hold |
| Fall | Both shoulders modeled flat under pressure for one continuous real-time second; bridging breaks the count |
| Technical fall | 15-point margin |
| Major decision | 8–14-point final margin |
| Decision | Smaller regulation margin, or a scored overtime win |
| Riding time | 1 point for a net minute at regulation's end; near-fall and riding points at the final horn are considered together |
| Period choice | Toss winner chooses top/bottom/neutral or defers in period 2; other chooser receives period 3 |
| Out of bounds | Restart at center in the existing control position, with no freestyle step-out point |
| Stalling | Warning, 1, 1, 2, disqualification |
| Sudden victory | First overtime period lasts 2 minutes, first score wins |
| Tiebreakers | Two 30-second periods; both must be completed unless a fall, technical fall or disqualification ends the match |
| Overtime choice | First offensive scorer in regulation (excluding escapes and penalties) receives the first choice; otherwise a new toss. First choice can defer. |
| Overtime riding | Regulation riding time resets for overtime; after both tiebreakers, a tied score is decided by at least 1 second net overtime riding advantage |
| Further overtime | If still tied, 1-minute sudden victory followed by another pair of tiebreakers |

At a buzzer, the simulation clips the final step so an attack cannot finish after
time has expired. Pause, position selection and boundary restarts stop the clocks.

## Gameplay approximations

- **Quick pace** accelerates match and riding clocks 2×; **Real time** uses actual
  regulation duration. Reaction windows, referee near-fall counts and fall counts
  are not accelerated. Quick pace is an explicit convenience mode.
- Contact, control, shoulder position and boundary support are represented by
  gameplay states and body-radius approximations, not a biomechanical simulation.
  The visual rig interpolates toward those states.
- The stalling referee uses a 45 match-second inactivity heuristic. NCAA stalling
  is a referee judgment, not a universal 45-second rule. Position-specific five
  counts are not independently modeled in this version.
- This move set does not enter locked-hands or illegal-hold states. It does not
  simulate injuries, blood time, cautions/false starts, unsportsmanlike conduct,
  coach challenges, medical defaults, tournament team points or weigh-ins.
- Exceptional overtime injury-timeout scenarios and their extra riding-time
  point provisions are not modeled, since there are no injury timeouts.
- No takedown in the current move set goes directly into a near-fall hold; it
  first establishes ordinary top control. Direct-to-back takedowns would need
  the rule delaying a technical-fall/sudden-victory finish until the near-fall
  opportunity concludes.

The prototype covers the normal single-match flow and common scoring. It should
not be described as implementing every officiating provision in the rule book.

## Primary references

- [NCAA men's wrestling playing rules](https://www.ncaa.org/championships/playing-rules/mens-wrestling-playing-rules/)
- [NCAA rules book](https://ncaaorg.s3.amazonaws.com/championships/sports/wrestling/rules/PRMWR_RulesBook.pdf), especially rules 2.3, 3.14–3.17, 4.2–4.5 and the penalty table.
- [2025–26 / 2026–27 case book](https://ncaaorg.s3.amazonaws.com/championships/sports/wrestling/rules/mens/2025-27PRMWR_CaseBook.pdf), updated February 13, 2026.
- [Three-point takedown and near-fall changes](https://www.ncaa.org/news/media-center-3-point-takedown-approved-in-wrestling/)
- [2025–27 major rules changes](https://ncaaorg.s3.amazonaws.com/championships/sports/wrestling/rules/mens/2025-27PRMWR_MajorRulesChanges.pdf)

Reviewed October 1, 2026. These references guide scoring; all art, school names,
athletes and presentation are original fictional game content.
