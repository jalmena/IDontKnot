# Environment reconnaissance

Date: 2026-11-23. Everything here comes from read-only inspection. Nothing outside this repository was changed.

## Development machine

| Item | Finding |
| --- | --- |
| System | Fedora 43, Intel integrated graphics |
| JavaScript | Node 24, npm 11, corepack present (pnpm can be activated through it) |
| Python | 3.13 and 3.14, uv |
| Containers | **Podman. Docker is not installed, and Podman has no compose provider.** |
| Not installed | Rust, Go, make, just, Inkscape |
| Graphics tools | ImageMagick and ffmpeg |
| Browsers | Firefox, and a Playwright Chromium build |

Consequences:

- Container images are built and smoke-tested locally with Podman. The Dockerfile must stay compatible with both Podman and Docker, because CI and CasaOS use Docker.
- Local orchestration cannot rely on `docker compose`. The application should run as a single container, which also matches the low-operations goal.
- A Rust-to-WebAssembly module would need a toolchain that is not present. That is a cost to weigh if one is ever proposed, not a blocker.
- Firefox on Linux does not enable WebGPU by default (see the rendering research), so this machine exercises the WebGL2 path in Firefox and the WebGPU path only in Chromium.

## Repository

- The repository was created private and empty on 2026-11-23. **The Product Owner made it public the same day.** Two findings led to that: on the account's plan a private repository cannot have protected branches, rulesets, required status checks or auto-merge; and the app store assumes publicly pullable images (below).
- Being public, the repository can use rulesets. The pattern to copy is the one on Nevus: pull request required with zero approvals, required status checks with the strict policy, deletion and non-fast-forward blocked.
- Everything pushed here is public. Documents must not contain secrets or details of private infrastructure, and all content must be original or reusable under a stated licence.
- The repository has no licence yet. Until one is chosen, all rights are reserved by default.

## CI in Nevus and Tabernacle

The project instructions assumed both projects run CI on self-hosted runners. That is no longer the case.

| | Nevus | Tabernacle |
| --- | --- | --- |
| CI runs on | GitHub-hosted runners | GitHub-hosted runners |
| Self-hosted runner | Registered to the repository, online, unused since 1.1.0 | Registered to the repository, online, unused |
| Branch model | `develop` and `main`, release branches | `main` only |
| Commit style | Conventional Commits, checked by commitizen | Plain sentences |
| Release | A tag builds a multi-architecture image and pushes it to GHCR | Same |

Nevus's `DEVELOPMENT.md` explains the history: its self-hosted runner was a small container on the home lab and one run took about an hour, so CI moved to GitHub-hosted runners, which are free for public repositories.

**Decision (Product Owner, 2026-11-23): this project uses GitHub-hosted runners.** No self-hosted runner is set up. That is also the safer choice for a public repository, where a self-hosted runner would execute code from pull requests opened by anyone.

Patterns worth reusing from Nevus:

- Two-stage CI: cheap checks first (commit messages, secret scan, dependency audit, lint, types, unit tests, build), expensive jobs only if they pass (end-to-end, container image).
- commitizen for Conventional Commits, version bumps and the changelog; gitleaks; Renovate with a minimum release age and pinned action digests; pre-commit hooks.
- pnpm with a `.node-version` file; Vitest; Playwright with axe accessibility checks; a cached browser download.
- Container checks: image size budget, `/healthz`, the index answering `200` without a session (CasaOS accepts only `200` or `401`), the process running as uid 1000, and `PUID`/`PGID` honoured on a root-owned bind mount.

## The app store

Conventions, from its README and lint:

- One folder per app under `Apps/<App>/` with `docker-compose.yml` (store metadata under `x-casaos`), `icon.svg`, `thumbnail.png` and `screenshot-*.png`.
- The compose `name` is the CasaOS identity and `x-casaos.id` (`io.github.<owner>.<app>`) the ZimaOS identity. Neither is ever renamed.
- Images are pinned to an exact version. Asset URLs are absolute. Locale keys are lowercase. Store text is English only. Host ports are unique across stores. Categories come from a fixed list.
- Every pull request lints the definitions, validates each compose file, checks that every pinned image exists with an anonymous `docker manifest inspect`, and builds the store.

With a public repository and a public image, this application can be added the same way as the existing two. The integration design is still to be agreed before the store is changed: the app's name and identifier, host port, category, and the store card. The app store was not modified.

## Tools and skills adopted so far

| Need | Tool | Origin | Use |
| --- | --- | --- | --- |
| Mathematical oracle | SnapPy 3.3.2, spherogram 2.4.1, Regina 7.4, knot_floer_homology, database_knotinfo, in a throwaway Python 3.13 environment | PyPI | Development time only: cross-checking fixtures. Never shipped. See [tools/oracle](../../tools/oracle/). |
| Brand and logo work | `graphic-designer` skill | Already installed | To be used in the identity phase |
| Interface direction and review | `frontend-design`, `web-design-guidelines` skills | Already installed | To be used for prototypes and UI review |
| Code and security review | Reviewer agents from the installed `ecc` plugin | Already installed | To be used selectively on implementation pull requests |
| Browser testing | Playwright Chromium, Chrome DevTools automation | Already installed | End-to-end checks of the running application |
| GitHub | `gh` CLI | Already installed | Repository, issues, pull requests |

No external skill or plugin was installed in this phase. Research used four narrowly scoped agents with distinct questions: three bounded surveys on a mid-tier model, and one literature verification on a stronger model.
