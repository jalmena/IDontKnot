# 0004. Geometry is a centerline in material coordinates and rope-diameter units

- Status: Proposed
- Date: 2026-11-23

## Context

The geometry layer must serve rendering, animation between tying steps, extraction of the diagram, overlap tests and, later, simulation. It must be readable by tools other than this application.

## Decision

- A rope is a **centerline curve with a radius**. Meshes are produced by viewers and never stored.
- Every control point carries a **material coordinate** *s*: arc length along the unstretched rope from its start. The same *s* is the same point of rope in every frame.
- Lengths are in **diameters of the reference rope**. Real dimensions are metadata.
- Three curve types are allowed: polyline, centripetal Catmull-Rom and uniform cubic B-spline. The specification fixes how each is sampled to a polyline. All algorithms work on the sampled polyline.
- Rigid objects have simple shapes: pole, ring, or a curve with a radius.

## Consequences

- Frames interpolate point for point, so animation between steps needs no matching step.
- Named parts of a rope (standing part, a bight, the working end) are intervals of *s* and stay attached to the same rope material as the knot is tied.
- Crossings can carry their *s* values, which ties the topology layer to the geometry layer.
- Rope does not stretch in this model. Stretch is out of scope.
- Dimensionless units make documents comparable and make "is this bend too tight" a matter of comparing with 1.
- A constant circular cross-section rules out webbing and tapered rope for now.

## Alternatives considered

- **Bézier chains or NURBS.** Familiar from drawing tools. Rejected as the base form because control points do not lie on the rope, which complicates both editing by dragging and storing simulation output. They can be converted on import.
- **Fourier or other global parametrisations.** Elegant for closed mathematical knots, unusable for an open rope being tied.
- **Storing a mesh or a rendered model.** Ties the data to one renderer and loses the centerline every algorithm needs.
- **Real-world units.** Every document would need its rope diameter before any tolerance could be interpreted.
