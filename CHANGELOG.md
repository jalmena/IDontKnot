# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Research reports on the mathematics of knots, existing software, rendering, and the product landscape, with a bibliography that records which citations were checked.
- A proposed knot document model and a validation strategy.
- Nine architecture decision records, all accepted.
- Twenty-one reference diagrams with expected values, cross-checked against independent software, and the scripts that generate them.
- The product brief, the architecture overview, the roadmap, and the contributing and security guides.
- The brand identity: mark, wordmark, colours and rules of use.
- The mathematical core, version 0: diagram validation, planarity, PD codes, the Jones polynomial, closed braids, and extraction of a diagram from a curve in space. It reproduces every reference diagram.
- A server with a health check and a diagram check.
- The first page of the application: a laboratory for torus knots and links, drawn in 3D as laid rope, in English and Spanish.
- A container image and a two-stage CI workflow.
- Six rope styles for the 3D view, one per discipline: jute, kernmantle, three-strand polyester, sisal, braided cotton and a plain line.
- Rope drawn as it is made: laid rope as three strands with their yarns and fibres, braided rope with its woven sheath, loose fibres on natural rope, room lighting and soft shadows where one rope passes over another.
- A 2D diagram of the knot beside the 3D view, with gaps where a rope passes under and numbered crossings.
- Knot documents in the core: components, named parts of a rope, the diagram, and shapes in space with the rules they must keep.
- The first knot of the library: a figure-eight knot, checked against the reference diagram.
- A page for a knot of the library, which the application now opens on: the rope in 3D, its diagram, the parts of the rope named on both views and brought out when chosen, and what the core computes for it.

### Changed

- The torus knot laboratory moved to `/lab`.
