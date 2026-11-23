# Product brief

Draft, discovery in progress. Decisions are recorded here as the Product Owner takes them, so that none is asked twice.

## What it is

IdontKnot is an interactive knot encyclopedia and an experimental laboratory. It has three complementary sides:

- **Explore**: discover, inspect and compare knots and rope structures.
- **Experiment**: manipulate rope, explore mathematical representations, create new configurations.
- **Learn**: understand how knots are constructed through interactive tutorials.

Its differentiator is that the system reasons about knots through a mathematical model. It does not merely draw them.

## Principles

- Six disciplines are first-class from the start: climbing, mountaineering and arboriculture; nautical; shibari; pioneering, lashings and rope structures; general and decorative; mathematical knot theory. A new discipline must not need an architectural change.
- No gamification: no streaks, points or engagement mechanics.
- Safety: a description is never presented as proof that a knot is safe. Claims are sourced and carry an evidence class. No strength or working load is computed or invented.
- English by default, Spanish selectable from the first release, more languages possible. Translations are kept apart from knot data.
- Self-hosted, Docker-compatible, configured by environment variables, with no cloud dependency. The running application is not exposed publicly.

## Decisions taken

| Date | Topic | Decision |
| --- | --- | --- |
| 2026-11-23 | Library structure | One library. Each knot has one page. A discipline is a lens that filters the library, changes the visual theme and brings forward that discipline's names, uses and safety notes. Discovery by purpose lives inside as filters. |
| 2026-11-23 | Tutorials in the first release | Guided manipulation: the user drags the working end, and each move (over, under, through a loop, round an object) is recognised and checked against the step. The rope follows constraints, not physics. Step-by-step playback is always available and is built first. |
| 2026-11-23 | Accounts | Reading is open to anyone who can reach the instance. Creating or editing knots and saving configurations needs an account. |
| 2026-11-23 | Shibari | Always visible, like the other five disciplines. No gate. Its content carries consent, circulation and nerve-compression information as part of each knot's documentation. |
| 2026-11-23 | Repository | Public. This reverses the initial plan of a private repository. |
| 2026-11-23 | CI | GitHub-hosted runners. No self-hosted runner. |
| 2026-11-23 | Licence | AGPL-3.0-only for all code, as in Nevus. |

## Open decisions

- Licence of the content: texts and illustrations.
- Visual identity: logo, typography, palettes, and how themes change by discipline.
- 3D interaction details, editor capabilities, content organisation and the first set of knots.
- Technology stack.
- App store integration: name, identifier, port, category, store card.

## Not goals

- Gamification.
- Computing strength, security or any safety judgement.
- Hosting the application for the public.
