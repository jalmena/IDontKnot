# 0003. Objects and end roles are part of the topological description

- Status: Proposed
- Date: 2026-11-23

## Context

Classical knot theory studies closed curves and nothing else. Practical knots break that frame in two ways, both confirmed on the reference diagrams:

- A clove hitch with its pole removed is a rope with two removable kinks. The hitch exists only relative to the pole.
- The reef knot and the thief knot have the same diagram. They differ in which ends carry load.

A model built only from classical notions would call the clove hitch nothing and the reef and thief knots identical.

## Decision

1. **Rigid objects are components of the diagram.** A pole, ring, bar or limb is represented by its axis curve, marked `rigid`, and crosses ropes like any other strand. A ring is a closed rigid component.
2. **Ends carry roles.** A rope end is `standing`, `working`, `tail` or `fixed`. An object end is `blocked` or `open`, which states whether a loop can be slipped over it.
3. **A document states the sense in which it claims an identity**: which ends are held and how open ropes are closed.

## Consequences

- Hitches, lashings and ties around a body are first-class, not special cases.
- Tying methods that drop a loop over a post are expressible, and are distinguished from methods that need an end.
- Two documents with the same diagram and different roles are different knots for the library, and the same diagram for the mathematics. The comparison functions report both facts.
- Thick objects are approximated by their axis. A rope lying on a wide surface is not modelled.
- Roles are editorial knowledge. A program cannot infer which end is loaded from the shape.

## Alternatives considered

- **Objects only in the geometry layer**, as obstacles for display. Rejected: the validator could not tell a clove hitch from a tangle of kinks.
- **Closing every rope and every object and working with classical links only.** Useful as a computation, and offered as such, but it discards the roles and depends on an arbitrary choice of how to close.
- **A full spatial-graph model from the start.** More general than needed now. Junctions are reserved so that it can be reached later.
