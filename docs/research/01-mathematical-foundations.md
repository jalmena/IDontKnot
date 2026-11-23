# Mathematical foundations

Research report, version 0.1, 2026-11-23.

This report establishes what a "knot" has to mean for this project, which mathematical tools apply, and what a program can and cannot decide. The design that follows from it is in the [knot document model](../spec/knot-document-model.md).

Three kinds of statement appear, and are kept apart:

- **Established**: a published result, cited by key into [references.md](references.md), which records whether each citation has been checked against its source.
- **Computed**: verified here by running code, with the result stored in [the reference diagrams](../../fixtures/topology/reference-diagrams.json).
- **Proposed**: a design position of this project.

## 1. Four different objects are all called knots

| Object | Example | Classical knot theory covers it? |
| --- | --- | --- |
| A closed curve, or several | Trefoil, Borromean rings, a sling, a Turk's head | Yes: knots and links |
| An open rope with two ends | Overhand knot, figure-eight stopper, bowline | Not directly |
| Ropes together with objects | Clove hitch on a pole, cow hitch on a ring, a lashing, a tie around a limb | No |
| Ropes that branch or join | Eye splice, a net, a treenet | No: these are spatial graphs |

A mathematical knot is a closed curve in space, and two knots are the same when one can be deformed into the other without cutting (ambient isotopy). **Under that definition every open rope is unknotted**: any knot in it can be undone by feeding an end back through. This is not a technicality. It is the reason knots can be tied at all, and it means the notion of sameness has to be chosen deliberately for open ropes.

## 2. Senses in which two configurations can be the same

| | Sense | What may change | Use |
| --- | --- | --- | --- |
| S1 | Same diagram | Names of crossings only | Checking a geometry frame against its diagram |
| S2 | Same with ends held | Any deformation that does not move a rope end across a strand, and does not pass rope through an object | **The identity of a finished knot.** For one rope this is exactly classical knot type. |
| S3 | Same with ends free | Any deformation at all | Everything is equivalent to a straight rope. This is reachability: what tying and untying do. |
| S4 | Same dressing | Only tightening and small adjustments | What tyers mean by "the same knot, properly dressed". Finer than S2. |

Proposed: the library identifies a knot by a curated reference configuration (S4), the mathematics compares in sense S2, and tying is movement within S3. Mixing these up is the source of most confusion about "knot recognition".

Two computed examples show why S2 alone cannot be the identity of a practical knot:

- The **slipped overhand knot** closes to the unknot. With its ends held it is, topologically, no knot. It is still a distinct and useful knot.
- The **reef knot and the thief knot** have the same diagram. They differ in which ends carry the load.

## 3. Diagrams and codes

A diagram is a projection of the configuration to a plane, in general position, recording at each crossing which strand is over. Two diagrams show the same knot (S2) exactly when they are related by a sequence of the three Reidemeister moves [Reidemeister 1927; Alexander-Briggs 1926].

Codes are ways of writing a diagram down. The [comparison](02-representation-comparison.md) treats them in detail; the facts that matter are:

- A **Gauss code** walks along each component and lists the crossings met, with over or under. With a sign at each crossing it determines a connected diagram on the sphere completely.
- A signed Gauss code need not correspond to any drawable diagram. Those that do not are **virtual knots** [Kauffman 1999]. Drawability is decidable quickly: the code defines a surface, and the diagram is planar exactly when that surface has genus 0. Computed: the trefoil's code is planar for two of its eight sign assignments.
- **Unsigned codes are ambiguous for composite knots.** Computed: one alternating six-crossing code is planar under four sign assignments, two of which are granny knots and two square knots. Dowker-Thistlethwaite codes share the weakness: a code determines a prime knot only up to mirror image, and in a composite knot each factor can be reflected independently [Dowker-Thistlethwaite 1983].
- A **PD code** lists the four arcs around each crossing in rotational order. It carries the same information as a signed Gauss code and is the exchange format of the research software.
- Every link is the closure of a **braid** [Alexander 1923]. Braid words generate families (torus knots, plaits, Turk's heads) and are a poor fit for hitches and loops.

## 4. Reidemeister moves and tying moves

The instructions for this project warn against confusing mathematical moves with physical tying. They are different, and they are precisely related.

Performed by hand, the Reidemeister moves are familiar operations:

| Move | By hand |
| --- | --- |
| I | Twist a bight into a loop, or untwist it |
| II | Slide a bight over or under another strand, or pull it back |
| III | Slide a strand across a crossing of two others |

None of them changes the knot with ends held (S2). That is their definition.

The operation they leave out is **moving an end across a strand**. In the theory of knotoids (section 6) this is called a forbidden move, because allowing it makes every open diagram trivial. In robotics it is the "cross" primitive that planners add to the Reidemeister moves in order to tie knots at all [Wakamatsu-Arai-Hirai 2006]. For this project it is the essential tying move.

Proposed consequences, which follow directly from the definitions:

1. **Every operation that can change a knot (S2) moves an end across a strand.** Leading an end over a strand, tucking it through a loop, taking a turn round a pole and threading a ring are all runs of this one move.
2. **A knot tied in the bight, without using an end, is trivial in sense S2 as far as the rope alone is concerned.** Its existence depends on an object in a loop, on which parts are loaded, or on friction. Slipped knots are the clearest case: the last tuck is made with a bight, which is a Reidemeister II move, so pulling the end spills the knot.
3. **Slipping a loop over the end of a post is the same move seen from the other side**: the object's end crosses the rope. This is why it matters whether an object's end is accessible.
4. A stored tying sequence can be checked: each step must change the diagram in the way its operation allows.

Computed illustration: in the overhand knot's tying sequence, after the end has crossed into the loop but before it leaves, the two ends of the rope lie in different faces of the diagram. The rope is, at that moment, a knotoid that is not yet a knot.

## 5. Invariants

An invariant is a quantity computed from a diagram that is the same for every diagram of the same knot. If an invariant differs, the knots differ. **If it agrees, nothing follows.**

| Invariant | Cost | Tells apart | Known blind spots |
| --- | --- | --- | --- |
| Number of components, linking numbers | Trivial | Coarse structure | Whitehead link: linking number 0, yet linked (computed) |
| Writhe, crossing count of a diagram | Trivial | Nothing: these are properties of the diagram, not of the knot | |
| Three-colourability and other colourings | Linear algebra | Trefoil from unknot | Many knots |
| Alexander polynomial | Polynomial time | Many small knots | Blind to mirror images; granny and square knots agree (computed); equals 1 for some non-trivial knots |
| Jones polynomial | #P-hard in general, even for alternating links [Jaeger-Vertigan-Welsh 1990]; sub-exponential in the crossing number by treewidth methods [Burton 2018]; fast for small diagrams | Mirror images of the trefoil (computed); granny from square (computed) | 5_1 and 10_132 agree (computed). Whether it detects the unknot is open; it does up to 24 crossings [Tuzun-Sikora 2021]. It does not detect unlinks [Eliahou-Kauffman-Thistlethwaite 2003]. |
| HOMFLY-PT polynomial | As for Jones | More than Jones or Alexander | Also agrees on some pairs, mutants among them |
| Knot group | Presentation is easy; comparing groups is hard | With its peripheral system it is a complete invariant [Waldhausen 1968] | The group alone is not: the granny and square knots have isomorphic groups |
| Khovanov homology | Heavy | Detects the unknot [Kronheimer-Mrowka 2011] | |
| Knot Floer homology | Heavy, exponential time, good software exists | Detects the unknot, the genus [Ozsváth-Szabó 2004] and fibredness [Ghiggini 2008; Ni 2007] | |
| Hyperbolic geometry of the complement | Numerical | **Complete for hyperbolic knots**, through canonical decompositions, and certifiable with interval arithmetic [Hoffman et al. 2016]. Nearly all tabulated knots are hyperbolic. | Undefined for torus, composite and other non-hyperbolic knots, which include the most common practical ones (the overhand knot is a torus knot) |

The computed pair deserves emphasis. The cinquefoil 5_1 and the knot 10_132 have the same Jones polynomial up to mirror image, the same Alexander polynomial, the same genus, and both are fibred. They are different knots: 10_132 is hyperbolic and 5_1 is not. A program that declared knots equal when "the invariants match" would be wrong at ten crossings.

Proposed: the core implements the cheap invariants and the Jones polynomial first. They are sufficient to prove most small knots different and are educational in their own right. Homology theories and hyperbolic geometry are left to the offline oracle: they are the strongest tools available, and they exist only in large research programs written in Python and C++ that do not run in a browser as they stand.

## 6. What can be decided

**Closed knots.**

- Whether two diagrams show the same knot is decidable [Haken 1962; Hemion 1979; Matveev 2007; Kuperberg 2019]. No polynomial-time algorithm is known, and the general algorithms are not practical.
- For hyperbolic knots, which are the great majority of tabulated knots, comparison through the geometry of the complement is complete and practical, and is how the large tables were built. It is not available for torus and composite knots.
- Recognising the unknot is in NP [Hass-Lagarias-Pippenger 1999] and in co-NP [Kuperberg 2014, assuming the generalised Riemann hypothesis; Lackenby 2021, unconditionally]. A quasi-polynomial algorithm was announced in talks in 2021 and has not been published; this report does not rely on it.
- Two diagrams of the same knot are joined by a bounded number of Reidemeister moves, but the general bound is a tower of exponentials [Coward-Lackenby 2014]. For a diagram of the unknot with *c* crossings, (236*c*)^11 moves suffice [Lackenby 2015]. A search for moves therefore terminates in principle and may be hopeless in practice: deciding whether a diagram can be untangled within a given number of moves is NP-complete [de Mesmay et al. 2021], and some unknot diagrams must first be made more complicated before they simplify.
- Some natural quantities are not known to be computable at all. The unknotting number is one [Lackenby 2018].
- Tables exist of all prime knots up to 20 crossings [Hoste-Thistlethwaite-Weeks 1998; Burton 2020; Thistlethwaite 2025].

**Open ropes.**

- One rope with its ends held (S2) is a "long knot", and long knots correspond exactly to closed knots. Everything above applies after closing the rope outside the knot.
- Several ropes with their ends held form a tangle [Conway 1970]. Equivalence is still decidable in principle; in practice one compares closures and uses link invariants that keep track of which component is which.
- If an end lies inside the diagram, there is no canonical closure. The diagram is a **knotoid** [Turaev 2012], with its own invariants [Gügümcü-Kauffman 2017]. The knotoid type of a curve in space depends on the direction it is viewed from, so tools for proteins report a map of types over all directions [Goundaroulis et al. 2017; Dorier et al. 2018], or close the curve at random many times and report a distribution [Millett-Dobay-Stasiak 2005]. Invariants that vary continuously as an open curve moves have also been defined [Panagiotou-Kauffman 2020]. **The knot type of an open curve with free ends is a statistic, not an invariant.** The honest result is "depends on the closure".

**Objects and graphs.**

- A rope with thin rigid objects can be treated as a link in which some components are marked rigid, or more generally as a spatial graph [Kauffman 1989]. Invariants exist [Yamada 1989] and are weaker and less supported by software.

**Geometry.**

- The diagram of a polygonal curve seen from a generic direction is computable exactly. Near-degenerate views need care, and can be avoided by choosing another direction.
- A 3D shape for a given diagram can always be constructed and is never unique.

Proposed position of the product, on this evidence:

1. It never claims two configurations are equivalent because they look alike, or because some invariants agree.
2. It claims equivalence only with a move sequence, and difference only with a differing invariant.
3. Otherwise it reports that the question is undetermined, and with what it tried.
4. It claims a knot type for an open rope only under a stated closure rule.

## 7. Geometry of rope

A rope is modelled as a tube of constant radius around a centerline. This is the model of the mathematical literature on rope length: the least length of rope of unit thickness needed to tie a knot [Cantarella-Kusner-Sullivan 2002], with thickness defined through the global radius of curvature [Gonzalez-Maddocks 1999]. Tight configurations are computed numerically, never in closed form except for trivial cases, by methods such as shrink-on-no-overlaps [Pierański 1998], constrained gradient descent [Ashton et al. 2011] and repulsive energies [Yu-Schumacher-Crane 2021].

For this project:

- Tightness and non-overlap are checkable conditions on a centerline.
- A "tightest" shape of a mathematical knot is a reasonable canonical picture of it.
- **Thick rope obeys a different theory from thin curves.** There is a configuration of two thick loops that are not linked, and yet cannot be pulled apart without stretching or thinning the rope [Coward-Hass 2015]. A topological proof that something can be undone is therefore not a proof that a real rope can be undone. The product must not present one as the other.
- **The tight shape of an ideal tube is not the dressed shape of a real knot.** Real rope has bending stiffness and friction, and a practical knot is dressed in a particular way on purpose. Canonical tight shapes are suitable for mathematical knots; practical knots need authored or simulated shapes.

## 8. What physics can be modelled

Rope mechanics is an active research field, and its results are narrower than might be expected.

- Classical analyses treat hitches as friction problems on a cylinder [Bayman 1977; Maddocks-Keller 1987] and predict whether an idealised hitch holds.
- Elastic rod theory describes loose and tight overhand knots in stiff filaments and matches experiment [Audoly-Clauvelin-Neukirch 2007; Jawed et al. 2015]. Detailed experiments and simulations have mapped the internal contact of the trefoil and the clove hitch [Johanns et al. 2021; Sano et al. 2022].
- For bends between two ropes, simple counts read off the diagram (crossings, twist, circulation) were shown to predict *relative* resistance to pulling through, for example that the reef knot is more stable than the thief and granny knots [Patil et al. 2020]. The experiments used one thin fibre, and the authors state that complex knots need material-specific models.
- Studies of failure exist for particular cases: where a knotted filament breaks [Pierański et al. 2001], how a shoelace knot fails under repeated impact [Daily-Diamond et al. 2017], and how the strength of surgical knots depends on friction and plastic deformation [Johanns et al. 2023].
- Simulation of rods with contact is well developed: discrete elastic rods [Bergou et al. 2008], position-based and Cosserat rods [Umetani et al. 2014; Kugelstadt-Schömer 2016], extended position-based dynamics [Macklin et al. 2016], and contact for thin objects that guarantees no penetration [Li et al. 2021; Chen et al. 2025].

All of these use idealised rods under a single slow load. **None predicts the breaking strength of a practical knot, its security under cyclic or shaking loads, or the effect of rope construction.**

What this supports:

| Realistic to model | Not realistic to model |
| --- | --- |
| Tightening a loose configuration into a snug one without the rope passing through itself | Breaking strength, or strength retained by a knot |
| A plausible dressed shape for display | Whether a specific knot holds in a specific rope under a specific load |
| Qualitative comparisons within one family, labelled as a model's output | Slippage, creep, cyclic loading, wet or icy rope |
| Feedback while a user drags a rope | Anything about a person's safety |

Strength depends on the material's failure under combined tension, bending and compression at the point where the rope enters the knot, on construction and on wear. No validated predictive model was found. **Proposed: the product never computes a strength, a working load or a safety judgement. Such figures appear only as cited measurements with their conditions.** Topological correctness implies nothing about mechanical reliability.

Physical simulation is therefore a possible later layer for shape and feel, not a foundation and not a source of facts.

## 9. Representing the act of tying

Robotics has the most developed formal treatment.

- "Knot planning from observation" [Morita et al. 2003; Takamatsu et al. 2006] represents the rope by listing its crossings in order from one end, each with an identifier, over or under, and a sign. That is a signed Gauss code of an open curve: the same representation this report arrives at. Its primitives are the three Reidemeister moves and a **cross** move in which an end passes over or under a segment, and the authors observe that cross moves alone suffice to tie any knot.
- Wakamatsu, Arai and Hirai [2006] use a crossing sequence and four basic operations, one of which is the endpoint move.
- Later planners and learning systems keep this state and these primitives [Saha-Isto 2007; Sudry et al. 2023].
- A real-time simulator in which a user ties knots and a recogniser names them was demonstrated in 2004 [Brown-Latombe-Montgomery 2004].

**There is no established standard notation for tying procedures.** The knotting literature has rich vocabulary (bight, loop, turn, round turn, tuck, nip, standing part, working end [Ashley 1944]) and structural studies of particular families. The closest formal precedents are a robot language for knot tying [Hopcroft-Kearney-Krafft 1991] and move languages for necktie knots [Fink-Mao 1999; Hirsch et al. 2015].

Proposed: adopt the crossing-sequence state, which has two decades of use behind it, and add a vocabulary of operations named in tyers' terms, each defined by its effect on the diagram (section 4 and the document model). The contribution here is not the state representation. It is carrying it to several ropes and to objects, tying it to geometry through a material coordinate, and checking tutorials against it.

## 10. Consequences for the design

1. Describe a configuration in separate layers: topology, geometry, construction, sourced annotations. (ADR 0001)
2. Store diagrams as signed crossing sequences along each rope, which handles open ropes natively and matches both the robotics representation and how tying proceeds. (ADR 0002)
3. Make objects and the roles of ends part of the topological description. (ADR 0003)
4. Store geometry as centerlines with a material coordinate. (ADR 0004)
5. Describe tying as checked operations. (ADR 0005)
6. Report comparisons as graded results with evidence. (ADR 0006)
7. Keep the core independent of rendering, and verify it against independent software offline. (ADR 0007)

## 11. Limits of this report

- Citations are listed with their verification status in [references.md](references.md). Most were checked against the publisher's record or the arXiv abstract; a few are marked as cited from memory.
- Spatial graphs, virtual knot theory and tangle classification were surveyed only as far as needed to place them.
- The statement that tangle equivalence is decidable in principle is made by analogy with the closed case and was not traced to a specific source.
- Performance of every algorithm mentioned is unmeasured until a first implementation exists.
