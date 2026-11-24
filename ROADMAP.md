# Roadmap

A roadmap is a plan, not a promise. Nothing listed here exists until its phase is marked done, and the order can change when a decision or a risk changes. This version was presented to the Product Owner on 2026-11-24.

## Where things stand

| Area | Status |
| --- | --- |
| Research | Done. See [docs/research](docs/research/). Open checks are listed at the end of each report. |
| Product discovery | Mostly done. Decisions are in [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md). Open: 3D interaction details, the knots after the first, content licence. |
| Architecture | Decided. See [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/adr](docs/adr/README.md). |
| Design and branding | The identity is decided: [docs/design/brand](docs/design/brand/README.md). Open: a light variant, themes by discipline, iconography, motion. |
| Implementation | Phases 1, 3 and 4 are done, and phase 2 except graded comparison. In phase 4 the end of the rope is led along the finished knot; steps with shapes of their own are not built yet; see [ARCHITECTURE.md](ARCHITECTURE.md) for exactly what exists. Not yet measured on a real tablet. |

## Phases

Each phase ends with something that can be run and tried. Later phases depend on earlier ones unless noted.

| # | Phase | What it delivers | Done when |
| --- | --- | --- | --- |
| 1 | Foundations | Repository layout, CI in two stages, the container image, a running shell of the application in English and Spanish | The image builds in CI, starts, answers `/healthz`, and the shell opens in a browser |
| 2 | Core v0 | The diagram model, validation, planarity, PD conversion, the Jones polynomial, extraction of a diagram from geometry, graded comparison | Every reference fixture is reproduced, and the property tests pass |
| 3 | Viewer | Rope drawn as a tube, orbit and zoom, the 2D diagram with gaps beside it, labelled parts | One knot can be inspected end to end, on desktop and tablet |
| 4 | Tutorial playback | Steps, animation between frames, speed control, stepping forward and back | One knot's tying method plays and can be scrubbed |
| 5 | Authoring tool and first content | An internal tool to draw a diagram and produce geometry; about a dozen complete knots across the six disciplines | Each of those knots passes validation and has sourced documentation in both languages |
| 6 | Library | One library with discipline lenses, search by name and synonym, filters by purpose and structure, knot pages with sources | A knot can be found without knowing its name |
| 7 | Guided manipulation | The user drags the working end; each move is recognised and checked against the step | A tutorial can be completed by hand, with playback as the fallback |
| 8 | Accounts and user documents | Sign-in to edit, saved configurations, import and export | A configuration can be saved, exported, and imported into another instance |
| 9 | Themes, offline use, release | Themes by discipline, installable offline application, app store entry, version 1.0 | Installed from the app store on the home lab |

Later, in no fixed order: the editor opened to users; a rope-tightening solver; further invariants; junctions (splices, nets); more disciplines and more content.

## Main risks

| Risk | Phase | Mitigation |
| --- | --- | --- |
| Recognising reliably what the user did when dragging a rope | 7 | Phases 3 to 6 are useful without it. Start with constrained moves. Extraction of diagrams from geometry is built and tested in phase 2. |
| Legibility of over and under on thick rope, on small screens | 3 | The 2D diagram is always available. The crossing halo is prototyped early. |
| Producing good 3D shapes from diagrams for the authoring tool | 5 | Authored shapes are acceptable; generated ones are a convenience. Start with a simple relaxation. |
| Performance on tablets | 3, 7 | Quality tiers; measure on real hardware in each phase. |
| Content takes longer than code | 5 | A dozen knots, not a hundred. Every claim sourced, which is slow by design. |

## What would change this plan

A decision by the Product Owner; a measurement that contradicts an assumption; a phase that turns out not to be useful by itself.
