# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Research reports on the mathematics of knots, existing software, rendering, and the product landscape, with a bibliography that records which citations were checked.
- A proposed knot document model and a validation strategy.
- Nine architecture decision records, all accepted.
- Twenty-one reference diagrams with expected values, cross-checked against independent software, and the scripts that generate them.
- The product brief, the architecture overview, the roadmap, and the contributing and security guides.
- The brand identity: mark, wordmark, colours and rules of use.
- The mathematical core, version 0: diagram validation, planarity, PD codes, the Jones polynomial, closed braids, and extraction of a diagram from a curve in space. It reproduces every reference diagram.
- A server with a health check and a diagram check.
- The first page of the application: a laboratory for torus knots and links, drawn in 3D as laid rope, in English and Spanish.
- A container image and a two-stage CI workflow.
- Six rope styles for the 3D view, one per discipline: jute, kernmantle, three-strand polyester, sisal, braided cotton and a plain line.
- Rope drawn as it is made: laid rope as three strands with their yarns and fibres, braided rope with its woven sheath, loose fibres on natural rope, room lighting and soft shadows where one rope passes over another.
- A 2D diagram of the knot beside the 3D view, with gaps where a rope passes under and numbered crossings.
- Knot documents in the core: components, named parts of a rope, the diagram, and shapes in space with the rules they must keep.
- The first knot of the library: a figure-eight knot, checked against the reference diagram.
- A page for a knot of the library, which the application now opens on: the rope in 3D or its diagram, the parts of the rope named on both and brought out when chosen, and what the core computes for it.
- The construction layer in the core: a method of tying as steps, each checked against the shape and against the operation it names.
- A knot tied step by step on its page: the figure-eight knot, with play, pause, single steps, a slider and three speeds, in English and Spanish.
- The list of the knots of the library, each with its picture in the rope that is chosen.
- Tightening in the core: the shapes an open rope passes through as its knot is drawn tight by both ends, without stretching or passing through itself; and a tool that writes them into a knot of the library as frames, which are checked like any other.
- Laying out in the core: a knot's document made from a drawing of its rope in the plane, with its parts and the steps that tie it placed by the crossings the rope meets. A tool writes a knot of the library from its drawing, and a test makes every knot again and compares.
- A second knot in the library: the overhand knot.
- The licence of the content of the library: Creative Commons Attribution-ShareAlike 4.0.
- A "Tighten" button on the page of a knot, beside "Next": the knot is seen to tighten, the view closes in on it and the light moves up over it. "Loosen" brings it back.

### Changed

- The torus knot laboratory moved to `/lab`.
- Both pages share one layout that fits one screen of a laptop: the view with the title of the page inside it, and a panel of the same height beside it.
- The diagram is shown in place of the 3D view, by a switch on the view, instead of beside it.
- The surface of each rope is computed once: the browser keeps it for the next visit, every view of the page shares it, and a rope seen before is drawn at once. The files of the build are served so that the browser keeps them too.
- A check that passes is no longer announced; one that fails is shown at the bottom of the panel.
- While a knot is tied step by step, the names of the parts of its rope appear as the rope forms them.
- The end of a laid rope shows the cut end of each of its strands; it was closed by a disc across the whole rope, which showed when the end was seen from in front.
- Shadows are aimed at what the view looks at, so that they stay fine however far the rope runs out of it.
- The application is organised by knot. It opens on the list of knots; a knot that is chosen opens above the list, which stays under it as a row. Its page has two tabs: the knot, with the parts of its rope and how it is tied, and what the core computes. The menu is now "Knots" and "Laboratory".
- The choice of rope is called "Material", sits inside the view opposite the title, and is kept from one page to the next.
