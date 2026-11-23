# Comparison of candidate representations

Companion to the [foundations report](01-mathematical-foundations.md). Each section compares the candidates for one layer of the model and ends with the choice made in the [document model](../spec/knot-document-model.md).

## 1. What should be the stored truth?

| Approach | Strengths | Weaknesses |
| --- | --- | --- |
| **Geometry only**: 3D points per frame; diagrams derived on demand | Rendering is immediate. Any shape can be stored. | Hand-placed points become the definition of every knot. A tutorial step has no meaning a program can check. A mathematical knot has no preferred shape to store. |
| **Topology only**: a diagram; geometry generated | Compact, exact, comparable. | Generated shapes do not reliably look like the dressed practical knot, and dressing matters. |
| **Construction only**: a tying program; everything else produced by running it | One description drives tutorial, animation and result. | Turning abstract operations into good geometry is simulation: a research risk. |
| **Layers with machine-checked agreement** | Each consumer reads the layer it needs. Authoring errors are caught by checks. Partial documents are still useful. | More to author. Consistency checking must be built early. |

**Choice: layers with checked agreement** (ADR 0001).

## 2. Notations for the diagram

| Notation | Records | Open ropes | Several components | Objects | Handedness | Determines the diagram | Authoring by hand | Fit with tying steps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gauss code, unsigned | Order of crossings along the curve, over or under at each visit | Natural | Yes | As extra components | No | No | Easy | Good |
| **Gauss code, signed** (the strand-visit code) | The same, plus a sign per crossing | Natural | Yes | As extra components | Yes | Yes, for a connected diagram on the sphere | Easy except for signs | Good: an end move appends a visit |
| Dowker-Thistlethwaite code | For each odd-numbered visit, the even number met at the same crossing | No | Extensions exist | No | No | Not for composite knots | Easy | Poor |
| Planar diagram (PD) code | Four arc labels around every crossing, in rotational order | Extensions exist | Yes | As extra components | Yes | Yes | Tedious and error-prone | Poor: arc labels shift with every change |
| Braid word | A sequence of generators; the knot is the closure of the braid | Open braids are plaits | Yes | No | Yes | Yes, as a closed braid | Easy for braids, unnatural otherwise | Poor |
| Conway notation | Tangles combined by a small algebra | No | Yes | No | Yes | For the families it covers | Easy for those families | Poor |
| Knotoid diagram | A diagram of an open arc whose ends may lie in any face | Its purpose | One arc; extensions exist | No | Yes | Yes | n/a (a concept, coded as a Gauss or PD variant) | Good in concept |
| Spatial graph diagram | A diagram with vertices of any degree | Yes | Yes | Yes | Yes | Yes | n/a | Good in concept |

Notes on the table:

- **Unsigned Gauss codes are ambiguous.** The alternating code `1o 2u 3o 4u 5o 6u 4o 5u 6o 1u 2o 3u` can be drawn on a sphere with four sign assignments. Two give granny knots and two give the square knot. This was computed with the prototype in [tools/oracle](../../tools/oracle/).
- **Signs are constrained by planarity.** For the trefoil's code only all-positive and all-negative signs are planar, so in a prime diagram the signs carry one bit: which mirror image.
- **A signed Gauss code and a PD code hold the same information** for a connected diagram. The difference is ergonomic. The Gauss form follows the rope; the PD form sits at the crossings.
- **A signed Gauss code may describe nothing drawable.** Such codes define *virtual* knots. They are detected by computing the genus of the surface the code embeds in, and rejected.
- **Knotoids and spatial graphs are concepts, not competing file formats.** The strand-visit code with open components *is* a knotoid diagram code; with rigid components and reserved junctions it reaches towards spatial graphs.
- **Braid words and Conway notation are generators.** They produce whole families from a few parameters: torus knots, Turk's heads, plaits, twist knots, pretzel links.

**Choice: the signed Gauss code, extended to open and rigid components, as the stored form** (ADR 0002). PD, DT, braid and unsigned Gauss codes are import and export formats. Internally the algorithms work on the planar map derived from the stored form.

## 3. Giving an open rope a knot type

| Approach | What it gives | Limits |
| --- | --- | --- |
| Hold the ends: treat them as fixed at the boundary of a ball around the knot | The standard notion for a finished knot. One rope is then a classical knot; several ropes are a tangle. | Requires the ends to reach the outside of the diagram unobstructed. Says nothing about a knot tied in the bight. |
| Close the curve by a fixed rule (join the ends directly, or extend them to infinity) | A classical knot, so all standard tools apply | Depends on the rule and on where the ends happen to be |
| Close in many random directions and report the distribution | A robust statistic for long, tangled chains | A distribution, not an answer; meant for proteins and polymers |
| Knotoids: keep the arc open and forbid moving an end across a strand | A proper theory of open diagrams with its own invariants | Depends on the direction of projection; no objects; little software |
| Include the objects and treat the whole as a tangle or graph | Covers hitches and lashings | Fewer invariants; no independent software to check against |

**Choice:** the document states its closure rule explicitly. The default for practical knots is that the ends are held in the outer face. Objects are components of the diagram (ADR 0003). When the ends lie in inner faces and no rule is declared, no knot type is claimed.

## 4. Curves for the geometry

| Curve | Passes through its control points | Smoothness | Local editing | Closed curves | Suits simulation output | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Polyline | Yes | Corners | Yes | Yes | It is the simulation state | The working form of every algorithm |
| Catmull-Rom, centripetal | Yes | Tangent-continuous | Yes | Yes | Yes | Authoring and interchange |
| Uniform cubic B-spline | No | Curvature-continuous | Yes | Yes | Needs fitting | Smooth display, generated shapes |
| Cubic Bézier chain | Only at joins | Depends on handles | Yes | Yes | Needs fitting | Import from drawing tools |
| NURBS | No | High | Yes | Yes | Needs fitting | More machinery than a rope needs |
| Fourier series | No | Infinite | No: every coefficient moves the whole curve | Only closed | No | Mathematical knots only |
| Biarcs | Yes | Tangent-continuous | Yes | Yes | Needs fitting | Exact thickness computations; a later refinement |

**Choice:** polyline, centripetal Catmull-Rom and uniform cubic B-spline, each with a fixed sampling rule, every point carrying a material coordinate (ADR 0004).

## 5. Describing how a knot is tied

| Approach | Can play back | Can judge a user's step | Independent of rope size and renderer | Readable by a tyer |
| --- | --- | --- | --- | --- |
| Keyframes | Yes | No | Partly | No |
| Recorded hand or end trajectories | Yes | Only by geometric closeness | No | No |
| Reidemeister move sequences | Not as tying | Only for rearrangements | Yes | No |
| Crossing sequence plus manipulation primitives (from robotics) | With generated or stored geometry | Yes | Yes | Partly |
| Free text | No | No | Yes | Yes |
| Physical script: grasps and forces in a simulator | Yes | In principle | No | No |

**Choice:** operations from a small vocabulary with defined effects on the diagram, each step storing its resulting diagram and optionally a geometry frame, with the wording held separately (ADR 0005). This combines the fourth row with keyframes for presentation and text for people.

## 6. Language and runtime of the core

| Option | Runs in the browser | Reuse outside the web | Toolchain cost | Existing libraries to reuse |
| --- | --- | --- | --- | --- |
| TypeScript | Natively | Node; other languages through the format and fixtures | None beyond the frontend's | None |
| Rust to WebAssembly | Yes, with a build step and a language boundary | Native tools and bindings | A second toolchain, absent from the development machine | Young crates only |
| Python on a server | No; needs a network call per check | Yes | A backend service | Mature |

**Choice:** TypeScript, behind a plain-data interface that allows individual functions to move to WebAssembly if measurements require it (ADR 0007).
