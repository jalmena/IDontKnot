# Architecture decision records

Each record states one decision, why it was made and what was rejected. Records are numbered and never renumbered. A decision that is replaced keeps its file and gains a pointer to its successor.

## Status values

- **Proposed**: written and argued, not yet accepted. Nothing may depend on it being final.
- **Accepted**: agreed. For decisions that affect the product (what users can do, see or rely on), acceptance is the Product Owner's.
- **Superseded by NNNN**: replaced.
- **Rejected**: considered and turned down; kept for the reasoning.

## Index

| No. | Decision | Status |
| --- | --- | --- |
| [0001](0001-layered-knot-model.md) | A knot is described in four independent layers | Proposed |
| [0002](0002-strand-visit-code.md) | The strand-visit code is the stored form of a diagram | Proposed |
| [0003](0003-objects-and-end-roles.md) | Objects and end roles are part of the topological description | Proposed |
| [0004](0004-material-coordinate-centerlines.md) | Geometry is a centerline in material coordinates and rope-diameter units | Proposed |
| [0005](0005-checked-construction-operations.md) | Tying is a sequence of operations with checked effects | Proposed |
| [0006](0006-graded-equivalence.md) | Comparisons return a grade and its evidence, never a boolean | Proposed |
| [0007](0007-core-independent-of-rendering.md) | The mathematical core is a standalone library with no rendering dependency | Proposed |

## Template

```markdown
# NNNN. Title

- Status: Proposed
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
## Alternatives considered
```
