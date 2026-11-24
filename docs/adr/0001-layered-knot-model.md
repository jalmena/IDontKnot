# 0001. A knot is described in four independent layers

- Status: Accepted (Product Owner, 2026-11-24)
- Date: 2026-11-23

## Context

A knot can be described by where the rope is in space, by what crosses what, or by how it was tied. Each answers different questions. Positions alone render well but say nothing a program can reason about. A diagram alone can be reasoned about but does not say what the dressed knot looks like. A tying sequence alone needs an interpreter to produce either.

The project needs all three: a viewer, validation of tutorial steps, and an editor. It also needs to keep sourced claims about real ropes apart from mathematics.

## Decision

A knot document has four layers:

1. **Topology**: components, their ends, and a diagram with over and under at every crossing.
2. **Geometry**: one or more frames of centerline curves in space.
3. **Construction**: one or more sequences of tying operations.
4. **Annotations**: sourced statements, held on the library entry that points at the document.

Every layer is optional. No layer is the single source of truth. Where two layers claim to describe the same thing, the claim is checked by machine: a geometry frame must project to its diagram, and the last construction step must equal the diagram.

## Consequences

- The viewer needs only geometry, the validator only topology, the tutorial engine topology and construction. Each can be built and tested separately.
- Authoring is more work than recording positions, because the layers must agree. The checks turn that work into a guarantee.
- A document produced by another tool can be useful with one layer. A mathematical table entry has topology only.
- Consistency checking becomes a core capability that must exist early.

## Alternatives considered

- **Geometry as the only stored form**, deriving diagrams on demand. Simple, and the diagram can indeed be derived. Rejected because it makes hand-placed points the definition of every knot, gives tutorial steps no meaning beyond "the rope moved", and cannot express a mathematical knot that has no preferred shape.
- **Topology as the only stored form**, generating geometry. Rejected because generated shapes do not reliably match the dressed form of a practical knot, and dressing matters.
- **Construction as the only stored form.** Rejected because producing good geometry from abstract operations amounts to simulation, which is a research risk, not a foundation.
