# Product brief

Draft, discovery in progress. Decisions are recorded here as the Product Owner takes them, so that none is asked twice.

## What it is

IDontKnot is an interactive knot encyclopedia and an experimental laboratory. It has three complementary sides:

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
| 2026-11-23 | Devices | Desktop and tablet are equal first-class targets: mouse and touch are both designed for from the start. A tablet propped beside a real rope is the typical learning setup. Phones work, with simplified manipulation. |
| 2026-11-23 | Editor | Opens to users after the tutorials. It exists earlier as an internal authoring tool for library content. The first release can save, import and export configurations, not draw them from scratch. |
| 2026-11-23 | First content | Few and complete: about a dozen essential knots spread over the six disciplines, each with every layer (3D view, diagram, guided tutorial, uses, limits, sources). |
| 2026-11-23 | Name | The product is written **IDontKnot**. |
| 2026-11-23 | Logo brief | The mark should integrate the initials IDK as `:DK`: the I split into two segments like a colon. Read vertically, as an emoticon, it is a happy person (eyes, smile) with hands together as if tying a knot. |
| 2026-11-24 | Brand identity | Mark: the `:DK` figure in rope-weight strokes with flat ends, a hand on each side of the knot. Typeface: Bitter. Colours: a near-black forest green, ivory and a satin gold, with flat gold at small sizes and in the interface. Detailed in `docs/design/brand/README.md`. |
| 2026-11-24 | Reviewing alternatives | Alternatives are shown and chosen locally. Only the chosen result and a short record of the decision go into the repository. |
| 2026-11-24 | Decision records | The seven architecture decision records proposed with the research are accepted. |
| 2026-11-24 | Server | TypeScript on Node, so that the server validates knots with the same core as the browser. |
| 2026-11-24 | Library content | Files in the repository, reviewed by pull request and packaged into the image. What users create is stored in the instance's database. |
| 2026-11-24 | Rope style and discipline | Each discipline has a rope style it is drawn with. Where the discipline is chosen, the rope selector sits beside it and follows the discipline unless a "customise" checkbox is ticked. Rope names carry no discipline. |
| 2026-11-24 | Library order by discipline | The same knots, ordered by their importance in the chosen discipline; knots a discipline does not use can be hidden. |

## Open decisions

- Licence of the content: texts and illustrations.
- Visual identity, remaining: a variant for light surfaces, themes by discipline, iconography and motion.
- 3D interaction details, editor capabilities, content organisation and the first set of knots.
- App store integration: name, identifier, port, category, store card.

## Not goals

- Gamification.
- Computing strength, security or any safety judgement.
- Hosting the application for the public.
