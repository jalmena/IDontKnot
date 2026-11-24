# 0006. Comparisons return a grade and its evidence, never a boolean

- Status: Accepted (Product Owner, 2026-11-24)
- Date: 2026-11-23

## Context

Deciding whether two diagrams show the same knot is possible in principle and has no known efficient algorithm. In practice a program can prove two knots different by finding an invariant that differs, and can prove them the same by exhibiting a sequence of moves, but it can fail to do either. Agreement of invariants proves nothing: the reference diagrams include two different knots that share their Jones polynomial, Alexander polynomial, genus and fibredness.

A function that answers yes or no would have to guess in exactly the cases where guessing is dangerous.

## Decision

Every comparison and identification function returns one of four grades, with evidence:

| Grade | Evidence |
| --- | --- |
| `identical` | The renaming that maps one diagram onto the other |
| `equivalent` | An explicit sequence of moves |
| `different` | The invariant that differs and both values |
| `undetermined` | The invariants that agree and the limits of the search |

Every result states its scope: which ends were held, which objects were included, how open ropes were closed. Identification against a table returns all candidates consistent with the computed invariants.

The interface shows the grade. It never renders `undetermined` as "the same" or as "different".

## Consequences

- The product can state exactly what it knows, which is the stated standard for this project.
- Features built on comparison (checking a tutorial step, finding related knots, detecting a duplicate in the editor) must handle four outcomes.
- For the small diagrams of practical knots, `undetermined` should be rare. How rare is to be measured, not assumed.
- Visual similarity plays no part in any comparison.

## Alternatives considered

- **A boolean with a confidence score.** Rejected: a number invites treating 0.95 as yes, and there is no principled probability to report.
- **Declaring knots equal when a chosen set of invariants agrees.** Rejected on the evidence of the fixtures.
- **Not offering comparison at all.** Rejected: validation of tying steps depends on it.
