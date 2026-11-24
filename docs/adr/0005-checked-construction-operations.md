# 0005. Tying is a sequence of operations with checked effects

- Status: Accepted (Product Owner, 2026-11-24)
- Date: 2026-11-23

## Context

Tutorials must do more than play an animation: the user manipulates the rope and the system judges the step. The same description should drive animation, guided exercises and alternative tying methods.

Mathematics supplies the Reidemeister moves, which relate diagrams of the same knot. They are not tying instructions. Robotics research on rope manipulation supplies a workable bridge: describe the rope by its crossing sequence, and manipulation by a few primitives, one of which moves an end across a strand (Morita and others, 2003; Wakamatsu, Arai and Hirai, 2006). No standard notation for tying procedures exists in the knotting literature.

## Decision

A tying method is a list of steps. Each step names an operation from a small vocabulary and records the diagram that results. Each operation has a defined, machine-checkable effect on the diagram:

- `arrange`, `twist` and `bight-across` are rearrangements by Reidemeister moves. They cannot change the knot while the ends are held.
- `cross`, `tuck`, `turn`, `reeve` and `slip-over` move an end across strands. They are the only operations that can change the knot.

A validator confirms that each step's result follows from the previous state by the named operation. The wording of a step is translated content held elsewhere, keyed by the step's identifier.

## Consequences

- A tutorial is a verifiable document. A mistake in authoring is caught by a test, not by a reader.
- An interactive exercise can recognise what the user did by comparing the diagram before and after a drag with the diagram the step expects, without scripting the motion.
- Several methods for one knot are several lists ending in equivalent states.
- The distinction between knots tied with an end and knots tied in the bight falls out of the vocabulary, and with it an explanation of why slipped knots spill.
- Recognising a free-form drag as an operation requires extracting the diagram from live geometry robustly. That is the main technical risk of interactive tutorials.
- `arrange` steps can be hard to verify exactly, because confirming that two diagrams show the same knot is hard in general (ADR 0006). Authors can break a rearrangement into smaller steps.

## Alternatives considered

- **Keyframes only.** Enough for playback. Rejected as the description of tying because it cannot say whether a user's step is right.
- **Reidemeister moves as the vocabulary.** Rejected: they cannot express the moves that actually tie a knot, and tyers do not think in them.
- **Recorded hand trajectories or physical scripts.** Tied to one rope, one size and one simulator.
- **Free text steps.** Kept as the human-readable layer, not as the definition.
