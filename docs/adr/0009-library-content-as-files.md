# 0009. Library content lives in the repository as files

- Status: Accepted (Product Owner, 2026-11-24)
- Date: 2026-11-24

## Context

The library is the set of documented knots: their knot documents, names, texts in each language, classification, claims with sources, and illustrations. It could live in the instance's database and be edited through the application, or in files under version control.

The content has requirements a database does not meet by itself: every safety-relevant claim must be traceable to a source, every text and image must carry its licence and provenance, and every knot document must pass the mathematical validation.

## Decision

- Library content is a tree of files in this repository, one folder per knot: the knot document, the library entry, and the texts per language.
- Content changes go through pull requests like code. CI validates every document against the schema and with the core, and checks that claims carry an evidence class and a source.
- The library is packaged into the container image. An instance serves the library it was built with.
- What users create in an instance (their own configurations, and later their own knots) is stored in that instance's database, not in the repository.

## Consequences

- The library has history, review and automated validation.
- A mistake in content is caught before release, by a test.
- Updating the library means releasing a new image. That is acceptable for curated content and matches how the application is updated.
- Editing content requires a pull request. The internal authoring tool therefore exports files; it does not write to a production database.
- Because the repository is public and AGPL-licensed, the licence of texts and illustrations has to be decided explicitly. It is an open decision.
- User-created content and library content are two stores with one format. Moving a user's knot into the library is an export followed by a pull request.

## Alternatives considered

- **Everything in the database, edited through the application.** More direct for editing. Rejected: no history or review, each instance would diverge, and validation would have to run at edit time only.
- **A separate repository for content.** Cleaner separation of licences and release rhythms. Deferred: more to maintain from the first day, and the content format is still moving with the code. It can be split out later without changing the format.
