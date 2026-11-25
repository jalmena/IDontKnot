# IDontKnot

An interactive encyclopedia and laboratory for knots, rope systems and knot theory, built to be self-hosted.

**Status: first prototype.** The mathematical core exists and reproduces the reference diagrams. The application, in English and Spanish, opens on its library of knots and has a torus knot laboratory beside it. The library holds one knot so far, a figure-eight knot: its page shows it in 3D and as a diagram, names the parts of its rope, ties it step by step and gives what the core computes for it. There is no search of the library, no exercise done by hand and no account yet; see the [roadmap](ROADMAP.md).

## Run it

Requires Node 24. If `pnpm` is not on your path, put `corepack` in front of each command.

```sh
pnpm install
pnpm --filter @idontknot/web build
pnpm start
```

Open <http://localhost:8080>. Stop it with Ctrl+C.

While developing, `pnpm dev` runs the interface with live reload on <http://localhost:5173> and the server on port 8080.

| Command | What it does |
| --- | --- |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | Static checks |
| `pnpm test` | Unit and property tests, including the reference diagrams |
| `pnpm e2e` | The application in a real browser, at desktop and tablet sizes. Run `pnpm exec playwright install chromium` once first. |
| `docker build -f deploy/Dockerfile -t idontknot:local .` | Builds the container image (Podman works the same way) |
| `docker run --rm -p 8080:8080 -v ./data:/data idontknot:local` | Runs it |

## What is here

| Path | Contents |
| --- | --- |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | What the product is, and the decisions taken so far |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system is structured |
| [ROADMAP.md](ROADMAP.md) | The phases of work and their risks |
| [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CHANGELOG.md](CHANGELOG.md) | How changes are made, how to report a vulnerability, what has changed |
| [docs/design/brand/](docs/design/brand/README.md) | The brand identity |
| [docs/discovery/environment-reconnaissance.md](docs/discovery/environment-reconnaissance.md) | Development machine, GitHub, CI runner and app store findings, and the tools adopted so far |
| [docs/research/01-mathematical-foundations.md](docs/research/01-mathematical-foundations.md) | What a knot is for this project, what can and cannot be computed |
| [docs/research/02-representation-comparison.md](docs/research/02-representation-comparison.md) | Candidate representations compared |
| [docs/research/03-software-and-data.md](docs/research/03-software-and-data.md) | Existing knot software and data sets, with licences |
| [docs/research/04-rendering-geometry-physics.md](docs/research/04-rendering-geometry-physics.md) | Rendering rope in a browser, geometry, physics options |
| [docs/research/05-product-landscape-and-sources.md](docs/research/05-product-landscape-and-sources.md) | Existing products, content provenance, safety sources |
| [docs/research/references.md](docs/research/references.md) | Bibliography, with the verification status of each entry |
| [docs/spec/knot-document-model.md](docs/spec/knot-document-model.md) | The knot document model (draft 0.1) |
| [docs/spec/validation-strategy.md](docs/spec/validation-strategy.md) | How the mathematics will be tested |
| [docs/adr/](docs/adr/README.md) | Architecture decision records |
| [fixtures/topology/reference-diagrams.json](fixtures/topology/reference-diagrams.json) | 21 reference diagrams with expected values, cross-checked against independent tools |
| [tools/oracle/](tools/oracle/) | The development-time scripts that generated and checked the fixtures |

## Safety

Nothing in this repository is evidence that a knot is safe to use. A correct diagram says nothing about strength, security or suitability for a load. See the safety sections of the research documents for how claims will be sourced.

## Licence

IDontKnot is licensed under the GNU Affero General Public License, version 3.0 only. See [LICENSE](LICENSE).
