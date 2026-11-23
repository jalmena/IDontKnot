# 0002. The strand-visit code is the stored form of a diagram

- Status: Proposed
- Date: 2026-11-23

## Context

Knot theory offers several notations for a diagram: Gauss codes, Dowker-Thistlethwaite codes, planar diagram (PD) codes, braid words, Conway notation. They were designed for closed mathematical knots. This project also needs open ropes, several ropes, and objects. The [comparison](../research/02-representation-comparison.md) weighs them.

## Decision

A diagram is stored as a **strand-visit code**: for each component, the ordered list of crossings it passes through, each marked over or under, plus a sign for every crossing. This is a signed Gauss code extended to open components, several components and rigid components.

The PD code, the faces and the rotation at each crossing are derived from it when an algorithm needs them. Braid words, DT codes, PD codes and unsigned Gauss codes are import and export formats.

A code is valid only if it can be drawn on a sphere. This is tested by computing the genus of the map it defines.

## Consequences

- An open rope is a list that begins and ends. No special case.
- The order of visits is the order along the rope, so crossings line up with material coordinates, and a tying step that leads an end across a strand appends one visit. The stored form matches how tying proceeds.
- It reads the way knot tyers speak: over, under, over.
- It is the representation robotics research on knot tying has used for two decades (the "P-data" of Morita and others, 2003), which is evidence that it carries what manipulation planning needs.
- Signs are tedious to assign by hand. In practice they are computed from geometry or fixed by the planarity test, which leaves only mirror images to choose between for a prime diagram.
- The relative placement of pieces that do not cross is not recorded. That is acceptable: it does not affect the configuration in space.
- Junctions of three or more ends need an addition that records the order of ends around the junction. It is reserved.

## Alternatives considered

- **PD code as the stored form.** Equally expressive for connected diagrams and the standard interchange format of the research software. Rejected as the stored form because it has no native open ends, is hard to read and write by hand, and hides the order along the rope. It remains the main exchange format with other tools.
- **Dowker-Thistlethwaite code.** Compact, but for one component, does not record handedness, and does not distinguish some composite knots. Import and export only.
- **Unsigned Gauss code.** Rejected: one alternating twelve-visit code is planar under four sign assignments, two giving granny knots and two the square knot (computed, see the fixtures).
- **Braid words.** A generator for families, not a general representation: a hitch or a bowline has no natural braid form.
