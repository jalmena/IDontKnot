# Knot document model

Draft 0.1. Implemented in `packages/core`: components, parts, the topology layer, geometry frames with curves and rules G1 to G5, the tightening of a knot of one open rope, and the construction layer for methods led with the end of a rope (operations `cross` and `tuck`, rules C1 to C3). Not yet implemented: shapes of rigid objects, the other operations, library entries, the JSON Schema. The reasoning behind it is in the [foundations report](../research/01-mathematical-foundations.md) and the [comparison of representations](../research/02-representation-comparison.md). The decisions it embodies are recorded in the [decision records](../adr/README.md).

## 1. Purpose and rules

A *knot document* is a self-contained, renderer-independent description of one rope configuration: a mathematical knot, a practical knot, a hitch on an object, a bend between ropes.

1. **Four layers, each optional.** Topology (what crosses what), geometry (where the rope is in space), construction (how it is tied), and annotations. A document with only topology is valid. So is one with only geometry.
2. **No renderer concepts.** No meshes, materials, cameras or colours. A viewer derives those.
3. **Derived values are not stored as truth.** Invariants, PD codes and faces can be recomputed from the layers. If cached, they are marked as derived and can be checked.
4. **Layers that claim to agree are checked.** A geometry frame that says it realises a diagram must project to exactly that diagram.
5. **Plain JSON, versioned, with a JSON Schema**, so that tools unrelated to this project can read and write it.

Names, translations, disciplines, uses, safety notes and references are **not** in the knot document. They live in a *library entry* that points at one or more knot documents (section 8). This keeps translated and editorial content apart from technical data.

## 2. Conventions

- **Coordinates.** Right-handed. For diagrams the viewer sits on the +z axis looking towards −z, with x to the right and y up. "Over" means nearer the viewer: larger z.
- **Units.** Lengths are in diameters of the reference rope, so a rope of radius 0.5 has diameter 1. Real dimensions are metadata. Knots are scale-free; this keeps numbers comparable between documents.
- **Material coordinate.** Each rope has a coordinate *s*: arc length along the unstretched rope from its `start` end. A given value of *s* is the same point of the rope in every frame and every step. Parts of the rope, crossings and colours are all located by *s*.
- **Crossing sign.** `sign = sign((t_over × t_under) · z)`, where the tangents point in the direction of increasing *s*. `+1` is the right-handed crossing.
- **Identifiers** are lowercase ASCII slugs, stable, and never translated.

## 3. Components

```json
{ "id": "rope", "kind": "rope", "closed": false, "radius": 0.5, "length": 60,
  "ends": { "start": { "role": "standing" }, "end": { "role": "working" } } }
```

| Field | Meaning |
| --- | --- |
| `kind` | `rope` (flexible) or `rigid` (an object the rope is tied to: pole, ring, bar, post, carabiner, a limb) |
| `closed` | A loop with no ends (mathematical knots, slings, rings) or an arc with two ends |
| `ends.*.role` for ropes | `standing`: leads away to the load or the rest of the rope, treated as held. `working`: the end being manipulated. `tail`: the short free end of a finished knot. `fixed`: attached to something not modelled. |
| `ends.*.role` for rigid objects | `blocked`: nothing can pass around this end (the object continues or is attached). `open`: a loop can be slipped over this end. |

Rigid objects are described topologically by their axis curve, exactly like a rope, and geometrically by a shape (section 5). A pole whose ends cannot be reached is a rigid arc with two `blocked` ends. A post with a free top has one `open` end. A ring is a closed rigid component.

**Parts** name intervals of a rope by material coordinate, for labelling, colouring and for reference from construction steps:

```json
{ "id": "eye", "component": "rope", "from": 22.0, "to": 41.5, "type": "loop" }
```

Types: `standing-part`, `working-end`, `bight`, `loop`, `turn`, `eye`, `tail`.

## 4. Topology layer

A diagram is the projection of the configuration onto the x-y plane, with the over/under information at each crossing.

```json
"topology": {
  "closure": "exterior",
  "diagram": {
    "crossings": [ { "id": "c1", "sign": 1 }, { "id": "c2", "sign": 1 }, { "id": "c3", "sign": 1 } ],
    "strands": {
      "rope": [ ["c1","o"], ["c2","u"], ["c3","o"], ["c1","u"], ["c2","o"], ["c3","u"] ]
    }
  }
}
```

`strands` lists, for each component, the crossings it passes through in order of increasing *s*, each marked `o` (it passes over) or `u` (under). A closed component's list is cyclic. A visit may carry its material coordinate as a third element: `["c1","o",14.2]`.

This is a signed Gauss code, generalised to several components, open components and rigid components. In the documents it is called the **strand-visit code**.

### Validity

| Rule | Statement |
| --- | --- |
| T1 | Every crossing is visited exactly twice in the whole diagram, once `o` and once `u`. |
| T2 | Every sign is `+1` or `-1`. |
| T3 | The code can be drawn on a sphere: the combinatorial map defined by the strands and signs has genus 0. Codes of higher genus (virtual diagrams) are rejected. |
| T4 | Where material coordinates are given, they increase along each strand. |
| T5 | If `closure` is `exterior`, every rope end lies in one common face. Checked with the document: a rope with an end inside its knot cannot claim to be held outside it. |

T3 is not a formality. For the trefoil code above, only two of the eight possible sign assignments pass: all `+1` and all `-1`, the two mirror images.

### What the code determines

For a connected diagram the strands and signs determine the drawing on the sphere completely, including which face each end lies in. They determine the PD code, which is derived when an algorithm needs it. Split diagrams (pieces that do not cross each other) are allowed; how the pieces are placed relative to each other is not recorded, because it does not affect the configuration in space.

### Closure

An open rope has no knot type until a rule says what happens at its ends (see the foundations report). The `closure` field states the rule under which the document's identity is meant:

- `exterior`: all rope ends lie in the outer face and are regarded as held there. This is the normal case for a finished practical knot. A single rope then has the knot type of its closure; several ropes form a tangle.
- `none`: the components are closed, or no claim is made.

Other rules (closing over, closing under, averaging over many closures) can be added. The core already joins the ends of one open rope over the whole knot, or under it (`joinedAcross`): a join that passes over everything is the same knot whatever way it takes, and so is one that passes under; the views show both for a rope with an end inside its knot. A document whose ends lie in inner faces and that declares no rule makes no claim about knot type.

### Reserved: junctions

Splices, eyes and nets need points where three or more rope ends meet. The format reserves a `junctions` list, each junction naming the ends that meet and their order around the point. It is not part of the first implementation.

## 5. Geometry layer

```json
"geometry": {
  "frames": [ {
    "id": "dressed",
    "realises": "topology",
    "curves": {
      "rope": { "type": "catmull-rom", "points": [ [x, y, z, s], ... ] }
    },
    "shapes": {
      "pole": { "type": "pole", "from": [0,-20,0], "to": [0,20,0], "radius": 1.5 }
    }
  } ]
}
```

- A **frame** is one configuration in space. A document may hold several: the finished knot, a loosened view, one per construction step.
- A **curve** is the rope's centerline. Each control point carries its material coordinate, so frames can be interpolated point for point and parts stay attached to the same rope material.
- **Curve types**: `polyline`; `catmull-rom` (centripetal, passing through its points); `bspline` (uniform cubic, not yet defined). The polyline is the form every algorithm works on, and the format defines how a curve becomes one, so that independent tools obtain the same polyline:
  - A `polyline` is its own points.
  - Each span of a `catmull-rom` curve, from one control point to the next, is cut into 12 pieces of equal parameter. The parameter is centripetal: the knots are spaced by the square root of the distance between control points. At an open end, the missing neighbour is the mirror image of the next point through the end point. A closed curve has one more span, from its last point back to its first.
  - Along a span the material coordinate advances in proportion to the length of the polyline, from the coordinate of one control point to that of the next. A closed curve returns to its start at the length of its rope.
- **Shapes** for rigid objects: `pole` (segment with radius), `ring` (centre, normal, ring radius, bar radius), `curve` (any centerline with a radius).

### Drawings

The knots of the library are not written as documents by hand. Each has a drawing, `layout.json`, beside its document: the path of its rope in the plane as a list of points; at each crossing, whether the rope passes over or under there; and its parts and the steps that tie it, placed by the crossings the rope meets along itself ("from one diameter after the third crossing"). `tools/knots/lay.mjs` makes the document from the drawing: it gives the points their height and their material coordinates, reads the diagram from the shape, places the parts and the steps, works out the diagram each step leaves, and computes the tightening. A test makes every knot again and compares it with its file. Only a knot of one open rope can be drawn so far. A drawing whose rope ends both lie outside its knot is given the closure `exterior`; one with an end inside, as a bowline's tail is inside its eye, is given none, and makes no claim about what knot it would be with its ends joined.

### Tightening

`geometry.tightening` lists, by id, the frames a knot passes through as it is drawn tight: first the frame it is tied in, last the tightest. Every one of them is a frame like any other and keeps the rules below; the tightest declares `realises` when the first does, so that the tight knot is checked to be the same diagram. Between two of them a view moves each point of the rope, by its material coordinate, straight from its place in one to its place in the next.

The frames are computed, not drawn by hand: `tools/knots/tighten.mjs` writes them into the document, and they are kept with it. The computation makes the knot a little smaller step by step, and lets the rope it gives up run out into the two ends, which lengthen; after each step the rope is moved until it neither passes through itself, nor bends tighter than it can, nor stretches. Then the two ends are drawn apart, a little at a time, until the knot gives no more rope. Nothing rubs: the result is the shape a knot takes when pulled by both ends, not a statement about how it holds.

A rope in a knot drawn hard does not keep its thickness: it is pressed thinner where it bears on itself. A frame may say so with `pressed`, a part of the thickness of its ropes (0.1 for a tenth): in that frame, centerlines may come nearer by that much, and bends be tighter by that much, than rules G2 and G3 otherwise allow. The frames of a tightening in the library are pressed by a tenth, which the Product Owner chose from rendered alternatives; a rope held to all its thickness leaves the knot visibly looser than a real one. Only a knot of one open rope is tightened so far.

An eye is not drawn tight with the knot, since something stands in it: a part of type `eye` keeps its shape and goes with the knot as its two ends go, and the rope from the knot to it bends round gradually. A drawing may also say how its knot is tightened where it is not as for every knot (`tightening`, for instance a stiffer rope): the bowline is tightened with a stiffer rope, which keeps the rope from bending too sharply where it enters the eye before the knot has closed.

The named parts of a rope are stretches of its material in the frame the knot is tied in. In a tightened frame the same material lies elsewhere, so a view names the parts only on the frame the knot is tied in.

### Validity

| Rule | Statement |
| --- | --- |
| G1 | Material coordinates increase along each curve, an open curve runs from 0 to the length of its rope, and the sampled length of each span matches its difference in *s* within tolerance (rope does not stretch). |
| G2 | No overlap: points of rope that are not neighbours along the rope stay at least the sum of their radii apart, within tolerance and less what the frame says its rope is pressed by. The same holds between ropes and shapes. |
| G3 | The radius of curvature is nowhere smaller than the rope radius, within tolerance. |
| G4 | If the frame declares `realises`, projecting it along −z yields a diagram equal to the declared one up to renaming of crossings. |
| G5 | The projection is generic: no two crossings coincide and no strand is seen end-on. |

The tolerances of the first implementation: a span may differ from its difference in *s* by 2 % (or 2 % of the radius, for a very short span); centerlines may come 5 % closer than the sum of their radii, and a bend be 5 % tighter than the radius. For G2, two points of one rope are neighbours when they are less than one tightest turn apart along it: π times the diameter. "Equal up to renaming of crossings" in G4 means the same components passing over and under in the same order at crossings of the same signs; a closed component may start anywhere along itself.

## 6. Construction layer

A *method* is a sequence of steps. A knot may have several methods. Each step names an operation and gives the diagram that results (and, optionally, a geometry frame).

```json
"construction": { "methods": [ {
  "id": "end-through-loop",
  "steps": [
    { "id": "make-loop", "op": "cross", "actor": ["rope","end"], "pass": "under",
      "result": { "crossings": [ {"id":"c1","sign":1} ],
                  "strands": { "rope": [ ["c1","o"], ["c1","u"] ] } } },
    { "id": "through-loop", "op": "tuck", "actor": ["rope","end"], "passes": ["over","under"],
      "result": { "crossings": [ {"id":"c1","sign":1}, {"id":"c2","sign":1}, {"id":"c3","sign":1} ],
                  "strands": { "rope": [ ["c1","o"], ["c2","u"], ["c3","o"], ["c1","u"], ["c2","o"], ["c3","u"] ] } } }
  ]
} ] }
```

The operations are a small vocabulary. Each has a defined effect on the diagram, which is what makes a step checkable.

| Operation | In a tyer's words | Effect on the diagram | Can it change the knot with the ends held? |
| --- | --- | --- | --- |
| `arrange` | Dress, tidy, tighten, turn it over | Any rearrangement by Reidemeister moves | No |
| `twist` | Make a loop in the bight; add a twist | Adds or removes one kink | No |
| `bight-across` | Pass a bight over or under a strand | Adds or removes two crossings with the same strand | No |
| `cross` | Lead the end over or under a strand | Appends one crossing at that end | Yes |
| `tuck` | Pass the end through a loop | A short run of `cross` moves through one opening | Yes |
| `turn` | Take a turn or a round turn on an object | A run of `cross` moves over a rigid component | Yes |
| `reeve` | Thread the end through a ring or an eye | `cross` moves through the face bounded by a closed component | Yes |
| `slip-over` | Drop a loop over a post | The object's `open` end crosses strands | Yes, relative to the object |
| `join`, `cut` | Splice, attach, cut | Changes components and junctions | Reserved |

### Methods shown on a frame

The first implementation covers methods in which the end of a rope is led along the finished shape. Such a method names the frame it is shown on and how much rope is laid before the first step; each step says how far the end has come when it is done:

```json
{ "id": "with-the-end", "frame": "dressed", "start": 12,
  "steps": [
    { "id": "make-loop", "op": "cross", "actor": ["rope","end"], "pass": "over", "to": 37.8,
      "result": { "crossings": [ {"id":"c1","sign":1} ], "strands": { "rope": [ ["c1","u"], ["c1","o"] ] } } }
  ] }
```

`start` and `to` are material coordinates. The state at a coordinate is the frame with the rope cut there.

| Rule | Statement |
| --- | --- |
| C1 | Each step's result is the diagram of the frame with the rope cut at the step's `to`, up to renaming of crossings. |
| C2 | Each step's result follows from the state before it by the operation it names. For `cross`, the last crossing the end visits is new, it passes it as `pass` says, and without it the diagram is the state before. For `tuck`, the same for as many crossings as `passes` has entries. An operation the implementation cannot check is noted, not refused. |
| C3 | The last step's `to` is the length of the rope, and its result is the diagram of the topology layer. |

A step may instead carry a frame of its own; that is not implemented yet.

Two facts make this table more than a list (both are argued in the foundations report):

- The first three operations are exactly the Reidemeister moves, performed by hand. They never change the knot while the ends are held.
- Every operation that can change the knot involves an end crossing a strand. A knot tied without using an end is, as far as the rope alone is concerned, no knot at all: it owes its existence to an object, to a held loop, or to friction.

A validator checks each step: a `cross` must add exactly one crossing, at the stated end, with a strand that borders the face the end was in; a `twist` must be one kink; and so on. A tutorial is then a document that can be verified, and an interactive exercise can recognise what the user did by comparing diagrams before and after a drag.

The text shown to the user for each step is not in the knot document. Steps carry identifiers; the wording is translated content.

## 7. Equivalence and identification

Any function that compares or names configurations returns one of four grades, with the evidence, and always states the sense in which the comparison was made (which ends were held, which objects were included, which closure).

| Grade | Meaning | Evidence returned |
| --- | --- | --- |
| `identical` | The same diagram up to renaming | The renaming |
| `equivalent` | Proven the same | An explicit sequence of moves |
| `different` | Proven different | The invariant that differs, with both values |
| `undetermined` | Not proven either way | The invariants that agree and the search limits reached |

There is no boolean "same knot" function. Identification against a table returns the candidates consistent with the computed invariants, which may be more than one.

## 8. Library entries (outline)

A separate document type, specified later with the content model. A provisional first form exists beside each knot document, `entry.json`, and holds, by language: the name of the knot, the names of its parts, and for each method its name and what each step tells the person to do; its category; what it is for in each discipline that uses it, and what it is shown tied to there; and whether it jams after it has taken a load (`afterLoad`), which every knot states and which closes what it is for in every discipline but knot theory. What an entry will hold:

- Identity: canonical name, names by language, synonyms, reference numbers.
- Classification: disciplines, purposes, structural tags.
- Links to one or more knot documents (the knot, its variants, its tying methods).
- Claims: applications, limitations, rope requirements, safety considerations. Each claim has an evidence class (established, manufacturer specification, experimental observation, recommendation, unverified), a source and its conditions.
- Provenance and licence of every text and image.

## 9. Supported and unsupported structures

| Structure | Status in this draft |
| --- | --- |
| Closed knots and links | Supported |
| Open ropes with roles on their ends | Supported |
| Several ropes | Supported |
| Thin rigid objects: poles, bars, posts, rings, carabiners, limbs as capsules | Supported as rigid components |
| Parametric families (torus knots, Turk's heads, braids, plaits) | Supported through generators that emit documents; braid words are an input notation |
| Keyframed geometry and tying sequences | Supported |
| Junctions: splices, eyes, nets | Reserved in the format, not in the first implementation |
| Doubled rope (shibari), where two strands run side by side | Representable as one rope folded at a bight. A compact "doubled" form needs a ribbon model and is an open question. |
| Flat webbing, where twist matters | Not supported. Needs a framed curve. |
| Rope substructure: strands, whippings, seizings | Not supported. Would be components nested in components. |
| Sheets, tarps, surfaces with holes | Not supported, except holes approximated by rings |
| Tapered or variable-radius rope | Not supported |
| Virtual knots (codes that cannot be drawn on a sphere) | Rejected by rule T3 |
| Stretch, strength, slippage, load distribution as computed values | Not supported and not planned as outputs. See the foundations report. |

## 10. Extensibility

- **Versioning.** `formatVersion` follows semantic versioning. Readers accept documents of the same major version and ignore fields they do not know.
- **Extension fields.** Any object may carry keys beginning with `x-`. Tools must preserve them.
- **Open vocabularies.** Component kinds, end roles, part types, shape types, curve types and operations are open lists. An unknown value is kept and reported, not treated as an error, unless a validity rule depends on it.
- **New disciplines** need no change here. Disciplines are classification data on library entries.
- **Independence of layers.** A new layer, for example a physical-simulation state, can be added without touching the others.

## 11. Open questions

1. A compact representation for doubled rope.
2. How named openings (the loop a step tucks through) are referenced. Faces are derivable from the diagram, but a stable, readable way to name one is not settled.
3. Whether geometry frames for construction steps are authored, generated, or both. This depends on how good generated geometry turns out to be.
4. The sampling rule of `bspline` curves, and whether the tolerances of section 5 hold up once more knots are authored.
5. The name of the format. `idk-knot` is a working name.
