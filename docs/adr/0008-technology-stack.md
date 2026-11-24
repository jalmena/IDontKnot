# 0008. Technology stack

- Status: Accepted (Product Owner, 2026-11-24, for the server language; the rest are implementation choices)
- Date: 2026-11-24

## Context

ADR 0007 fixed that the mathematical core is a TypeScript library with no rendering dependency, because it must run in the browser. The remaining choices are the server, the interface, the 3D layer, storage and tooling. The owner's other projects use FastAPI with React (Nevus) and Go (Tabernacle), and their conventions are reused where they fit.

Versions were read from the npm registry on 2026-11-24.

## Decision

| Concern | Choice |
| --- | --- |
| Language and runtime | TypeScript 7 throughout, Node 24 |
| Layout | One repository, pnpm workspaces: `packages/core`, `apps/web`, `apps/server` |
| Interface | React 19, Vite 8, React Router 8, TanStack Query |
| 3D | Three.js with the classic WebGL renderer, in an imperative viewport module wrapped by one React component |
| Server | Hono on Node: one process serving the API and the built interface |
| Storage | SQLite through Node's built-in `node:sqlite` module, in a data directory |
| Accounts | Cookie sessions; passwords hashed with argon2id |
| Search | A client-side index (MiniSearch) built from the library |
| Languages | i18next; English and Spanish; interface text kept apart from knot data |
| Offline | A service worker through `vite-plugin-pwa` |
| Tests | Vitest and fast-check for unit and property tests; Playwright with axe for end-to-end and accessibility; committed oracle fixtures |
| Quality | ESLint, Prettier, stylelint, commitizen for Conventional Commits, gitleaks, Renovate |
| Delivery | One container image, non-root, `PUID`/`PGID`, `/healthz`, data under `/data` |
| CI | GitHub-hosted runners, two stages: cheap checks, then end-to-end and image |

## Consequences

- The server validates every knot document with the same code the browser uses. There is one implementation of the model, not two.
- One language and one package manager keep the toolchain small.
- The server stack differs from the owner's other projects, so their server code cannot be copied. Their CI, container and repository conventions are reused.
- The 3D layer is written by hand: tube geometry with rotation-minimising frames, picking against the centerline, the crossing halo. That is work, and it is the work this product is about.
- `node:sqlite` removes a native dependency that would have to be built for each architecture. If it proves limiting, `better-sqlite3` is a drop-in replacement behind the same small data-access module.
- A client-side search index is enough for a library of tens or hundreds of knots. Thousands would call for full-text search on the server.

## Alternatives considered

- **A Python server (FastAPI), as in Nevus.** Familiar, with accounts and migrations already solved there. Rejected: the server could not run the core, so it would either not validate documents or duplicate the model in a second language.
- **A Go server, as in Tabernacle.** A single small binary. Rejected for the same reason.
- **React Three Fiber.** Convenient for declarative scenes. Not adopted: almost everything here is geometry that changes every frame and bespoke picking, which are simpler to control imperatively, and the binding constrains the React version.
- **Svelte with Threlte, or Vue with TresJS.** Capable. Not adopted: React is what the owner's other interface uses, and nothing here needs another framework.
- **A physics engine.** Out of scope for the first releases (see the rendering research).
- **WebGPU.** Kept as a later option. Firefox on Linux does not enable it by default.
