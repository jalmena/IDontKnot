# 0007. The mathematical core is a standalone library with no rendering dependency

- Status: Proposed
- Date: 2026-11-23

This record fixes a boundary. The choice of interface framework and of the wider technology stack is a separate proposal.

## Context

The representation should be useful beyond this application, and must not depend on Three.js or any frontend technology. The core has to run in the browser, because interactive tutorials validate the user's rope as it moves, and in a test runner without a browser. The survey of existing software found no library that could be reused in a browser: the mature ones are Python and C++ programs that do not run there as they stand, and none of them models open ropes or objects.

## Decision

- The core is a separate package with no dependency on a renderer, a UI framework or the DOM. Its inputs and outputs are plain data: knot documents and arrays of numbers.
- It is written in TypeScript and runs unchanged in browsers, workers and Node.
- It contains: the document types and their validation, diagram algorithms (planarity, faces, PD conversion, moves), extraction of a diagram from geometry, invariants, comparison with graded results, and geometric checks.
- The rendering layer depends on the core. The core never depends on the rendering layer. A lint rule enforces the direction.
- Independent programs (Regina, SnapPy, knot Floer homology) are used offline, to generate fixtures. The project is licensed AGPL-3.0-only, so GPL-licensed code may legally be reused. Whether to do so is decided case by case; nothing is reused yet.
- WebAssembly is not used initially. It will be considered for a specific function when a measurement shows TypeScript is too slow for it.

## Consequences

- The format's portability rests on the specification, the JSON Schema and the fixtures, not on the implementation language. Another implementation can be validated against the same fixtures.
- Because the code is AGPL, another project can reuse the library only under compatible terms. The format itself can be implemented independently from its specification.
- The diagram model, with open and rigid components, exists in no other library and is written here. Invariants are written here first as well; adapting existing GPL code for a particular algorithm stays open where it saves real work.
- One language across core, interface and tests keeps the toolchain small. The development machine has no Rust toolchain today.
- Heavy computations must be kept off the main thread by running the core in a worker, which the plain-data interface allows.

## Alternatives considered

- **Rust compiled to WebAssembly from the start.** Faster, and reusable from native tools. Rejected for now: a second toolchain and a language boundary before any measurement shows a need. The plain-data interface keeps this door open function by function.
- **A Python core behind a server API.** Would allow reuse of existing mathematical software. Rejected: validation during a drag cannot wait on a network round trip, and the application should work offline.
- **Compiling Regina or SnapPy to WebAssembly.** Legally possible under this project's licence. Not pursued now: no WebAssembly build of either was found, both are large systems with native dependencies, and neither models open ropes or objects. Worth revisiting for specific invariants.
- **Core logic inside the rendering code.** The quickest start and the outcome this project exists to avoid.
