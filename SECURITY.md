# Security

## Scope

IDontKnot is built to be self-hosted on a private network. It is not designed to be exposed to the internet, and it should not be.

## Supported versions

Only the latest release receives fixes. There is no release yet.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately to the maintainer through their GitHub profile. If the repository's Security tab offers "Report a vulnerability", use that instead.

Include what you found, how to reproduce it, and the version or commit. You will get an acknowledgement, and a fix or an explanation of why none is needed.

## What the project does

- No secrets in the repository. A secret scan runs on every pull request.
- Dependencies are audited in CI and updated through reviewed pull requests, with a delay after each upstream release.
- The container runs as a non-root user.
- Configuration and secrets come from environment variables, never from files in the image.
- Passwords are stored only as argon2id hashes.

## What the project does not do

- It makes no claim about the safety of any knot. See the safety notes in the documentation.
- It does not send data anywhere. There is no telemetry.
