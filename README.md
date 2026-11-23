# IDontKnot

An interactive encyclopedia and laboratory for knots, rope systems and knot theory, built to be self-hosted.

**Status: discovery and research.** There is no application yet. This repository currently holds the research that the first design decisions rest on, a proposed data model, and a small set of machine-checked reference diagrams.

## What is here

| Path | Contents |
| --- | --- |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | What the product is, and the decisions taken so far |
| [docs/discovery/environment-reconnaissance.md](docs/discovery/environment-reconnaissance.md) | Development machine, GitHub, CI runner and app store findings, and the tools adopted so far |
| [docs/research/01-mathematical-foundations.md](docs/research/01-mathematical-foundations.md) | What a knot is for this project, what can and cannot be computed |
| [docs/research/02-representation-comparison.md](docs/research/02-representation-comparison.md) | Candidate representations compared |
| [docs/research/03-software-and-data.md](docs/research/03-software-and-data.md) | Existing knot software and data sets, with licences |
| [docs/research/04-rendering-geometry-physics.md](docs/research/04-rendering-geometry-physics.md) | Rendering rope in a browser, geometry, physics options |
| [docs/research/05-product-landscape-and-sources.md](docs/research/05-product-landscape-and-sources.md) | Existing products, content provenance, safety sources |
| [docs/research/references.md](docs/research/references.md) | Bibliography, with the verification status of each entry |
| [docs/spec/knot-document-model.md](docs/spec/knot-document-model.md) | Proposed canonical data model (draft 0.1) |
| [docs/spec/validation-strategy.md](docs/spec/validation-strategy.md) | How the mathematics will be tested |
| [docs/adr/](docs/adr/) | Architecture decision records (all currently *proposed*) |
| [fixtures/topology/reference-diagrams.json](fixtures/topology/reference-diagrams.json) | 21 reference diagrams with expected values, cross-checked against independent tools |
| [tools/oracle/](tools/oracle/) | The development-time scripts that generated and checked the fixtures |

## Safety

Nothing in this repository is evidence that a knot is safe to use. A correct diagram says nothing about strength, security or suitability for a load. See the safety sections of the research documents for how claims will be sourced.

## Licence

IDontKnot is licensed under the GNU Affero General Public License, version 3.0 only. See [LICENSE](LICENSE).
