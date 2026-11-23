# Validation and testing strategy for the mathematical core

Draft 0.1. It describes how the core will be tested once it exists, and what has already been checked.

## Principles

1. **Independent evidence.** Every mathematical function has at least one test whose expected value did not come from that function: an independent program, or a theorem.
2. **Properties before examples.** Where a theorem states that something must hold for every input, the test generates inputs and checks the property.
3. **Provenance.** Every stored expected value records how it was obtained and with which tool versions.
4. **Graded answers.** Tests of comparison functions check the grade and the evidence, not a boolean. "Undetermined" is a correct answer in many cases and is tested as such.
5. **No silent approximations.** Geometric tests state their tolerance.

## Test layers

| Layer | What is checked | How |
| --- | --- | --- |
| Schema | Documents conform to the JSON Schema | Schema validation of every fixture and every library document |
| Structure | Rules T1-T5 of the [document model](knot-document-model.md): crossings visited twice, signs valid, the code is planar, ends in one face | Unit tests, including codes that must be rejected (the trefoil code with mixed signs has genus 1) |
| Round trips | Serialise and parse; strand-visit code to PD code and back; braid word to diagram | Equality after the round trip |
| Invariance | Invariants do not change under renaming of crossings, a different starting point on a closed strand, random Reidemeister moves, or rotating a 3D curve before projecting it | Property-based tests |
| Symmetry laws | Mirror image: the Jones polynomial maps *t* to 1/*t*, the Alexander polynomial is unchanged, the writhe changes sign. Connected sum: the Jones and Alexander polynomials multiply, the genus adds. | Property-based tests on generated sums and mirrors |
| Oracle | Values agree with independent software | Committed fixtures generated offline (below) |
| Geometry | Rules G1-G5: length is preserved, no overlap, curvature bound, the projection equals the declared diagram | Unit tests on authored frames; property tests on generated curves |
| Construction | Each step's diagram differs from the previous one in the way its operation allows; the last step equals the knot's diagram; alternative methods end in equivalent states | Validation of every method in the library |

## The oracle

Independent programs are run offline, by hand, to produce fixtures that are committed. Ordinary CI reads the fixtures and does not need the programs.

| Quantity | Oracle |
| --- | --- |
| Jones polynomial, Alexander polynomial | Regina |
| Name of a hyperbolic knot or link, hyperbolic volume | SnapPy |
| Seifert genus, fibredness | knot Floer homology |
| Known values for tabulated knots | KnotInfo, consulted for comparison, not copied |

Limits found while setting it up: spherogram's polynomial invariants need SageMath and are not available from a plain installation; SnapPy names only hyperbolic complements, so torus knots and composite knots are confirmed by their invariants; and **there is no independent oracle for open ropes with objects**. Those cases are checked by closing them under a stated rule and by structural tests.

## The reference diagrams

[fixtures/topology/reference-diagrams.json](../../fixtures/topology/reference-diagrams.json) holds 21 diagrams. For every one, the code passed the planarity test, and the Jones polynomial computed by the prototype equals Regina's.

| Diagram | What it is there to test |
| --- | --- |
| `unknot-kink` | A one-crossing diagram of the unknot; the degenerate case of one arc meeting itself |
| `trefoil-right`, `trefoil-left` | Mirror images are different knots: V = t + t³ − t⁴ against its reflection |
| `figure-eight` | An amphichiral knot: the Jones polynomial is symmetric; SnapPy names it 4_1 |
| `cinquefoil`, `torus-3-4` | Torus knots, which SnapPy cannot name; `torus-3-4` is non-alternating |
| `three-twist` | A six-crossing diagram of the five-crossing knot 5_2: a diagram is not minimal just because it is given |
| `knot-10-132` | **Same Jones polynomial, Alexander polynomial, genus and fibredness as the cinquefoil, yet a different knot** (it is hyperbolic, volume 4.0569). Identification must not stop at agreement of invariants. |
| `granny-closed`, `square-closed` | Composite knots with the same Alexander polynomial and different Jones polynomials |
| `hopf-positive`, `hopf-negative` | Linking number and its sign |
| `whitehead` | Linking number 0 but linked |
| `borromean` | Three components, pairwise unlinked, jointly linked |
| `overhand-knot` | An open rope whose closure is the trefoil |
| `figure-eight-stopper` | An open rope whose closure is 4_1 |
| `slipped-overhand` | An open rope whose closure is the unknot: a real knot that is topologically trivial |
| `reef-knot`, `granny-knot` | Two ropes; closures are the square and granny knots |
| `thief-knot` | The same diagram as the reef knot with different end roles |
| `clove-hitch-on-pole` | A rope and a rigid object; without the pole the rope is trivial |

The open and two-rope diagrams were derived by hand and then checked; the signs of the clove hitch were computed from an explicit layout. Their agreement with the planarity test and with the expected closures is evidence that the format can express them, not a proof that every detail matches a particular drawing in a particular book.

## Cases to add with the first implementation

Mathematical:

- The Perko pair: two table entries that are the same knot, as a test of proving equivalence by moves.
- The Conway and Kinoshita-Terasaka knots: mutants with trivial Alexander polynomial and equal Jones polynomials, distinguished by genus.
- Hard diagrams of the unknot that cannot be simplified without first adding crossings.
- A split link, to test that separate pieces are detected.
- Codes that must be rejected: non-planar, a crossing visited once, both visits over.

Practical:

- Bowline and its relatives; sheet bend against bowline (the same structure, cut differently).
- Round turn and two half hitches; cow hitch on a ring; double fisherman's.
- Alpine butterfly with and without an object in its loop.
- A Turk's head and a three-strand plait from generators.
- A square lashing on two poles.
- An open rope whose end lies in an inner face, where the honest answer about its knot type is `undetermined`.

Each practical case will be authored in the editor or from a 3D model and checked by projection, not written by hand.

## Where tests run

- Unit and property tests run on every pull request.
- Fixture regeneration is manual and offline; a pull request that changes fixtures shows the change in review.
- A CI check confirms that committed fixtures are schema-valid and that the core reproduces every expected value.

## Performance

Budgets will be set from measurements on the development machine and on a phone once a first implementation exists. Quantities to measure: extracting a diagram from a polyline of 2,000 segments, the Jones polynomial as a function of crossing number, and the thickness test per frame.
