# Contributing

## How changes are made

1. Branch from `main`. Name the branch after its purpose: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
2. Make small commits with [Conventional Commits](https://www.conventionalcommits.org/) messages, in English.
3. Open a pull request. Nothing is pushed directly to `main`; a ruleset enforces this.
4. Merge by squash once the pull request is accepted.

Versions follow [Semantic Versioning](https://semver.org/). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## Who accepts what

The Product Owner decides product vision and priorities, user experience, visual identity, scope, content direction, architectural trade-offs that affect the product, and release acceptance.

- **Product-level changes** (anything a user can see, do or rely on, and any change to an accepted decision record) are merged only after the Product Owner's explicit acceptance. A pull request without a formal GitHub review is not thereby accepted.
- **Small, low-risk changes** (bug fixes, refactoring without a change in behaviour, documentation, tests, dependency maintenance, internal performance work) may be merged by their author when the automated checks pass and the checklist below has been gone through.

When in doubt, ask.

### Checklist for self-merged changes

- [ ] The change does not alter the agreed scope or introduce a product decision.
- [ ] Every automated check passes.
- [ ] I read my own diff, line by line, as if someone else had written it.
- [ ] It follows the architecture and the accepted decision records.
- [ ] Nothing in it is described as working that was not run.
- [ ] No secret, private detail or unlicensed material is included.

## Alternatives are reviewed outside the repository

When there is a choice to make between alternatives (designs, palettes, layouts, approaches), the alternatives are shown to the Product Owner directly. Only the chosen result and a short record of the decision are committed. Exploration material does not go into pull requests.

## Authorship

Commits are made under the identity configured for this repository and carry no co-author trailers and no tool attribution. The same applies to pull request descriptions, source headers, release notes, documentation and the product itself.

## Language

Code, identifiers, comments, console output, documentation and commit messages are in English. The interface is in English and Spanish; its text lives in translation files, apart from knot data. Knot names, aliases, mathematical identifiers and codes are never translated.

## Content

The library covers disciplines where wrong information can hurt someone.

- Every safety-relevant statement carries an evidence class (established fact, manufacturer specification, experimental observation, recommendation, unverified) and a source.
- No breaking strength, working load or safety judgement is computed or invented. Figures are quoted only with their source and conditions.
- Text and illustrations are original, or reused under a licence that permits it, with the licence and attribution recorded beside them. Nothing is copied from proprietary applications, paid courses or copyrighted books.

## Architecture rules

- `packages/core` depends on nothing at run time and never on rendering or UI code.
- Comparisons of knots return a grade with evidence, never a bare yes or no.
- A significant decision gets a record in [docs/adr](docs/adr/README.md). A decision that changes gets a new record that supersedes the old one.

## Before opening a pull request

Run the checks locally and, for anything that affects the running application, start it and try the change in a browser. A successful build is not evidence that a feature works.
