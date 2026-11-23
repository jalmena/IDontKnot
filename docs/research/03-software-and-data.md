# Existing knot software and data

Checked 2026-11-23. Release dates and licences come from PyPI, npm, crates.io and GitHub. Items marked *unverified* could not be confirmed and must be checked before anything relies on them. The last section records what was actually installed and run here.

## Summary

- **Nothing mature exists for the browser.** npm has no knot-theory package. The only proven client-side tool is KnotFolio, which is an application, not a library. No tool models open ropes together with objects, so the diagram model has to be written for this project.
- **Good independent oracles exist for development time.** SnapPy, Regina and Szabó's knot Floer calculator are actively maintained and can check our own implementation from outside.
- **The best-known data sets carry no stated licence.** KnotInfo and the Knot Atlas ask to be cited but grant no reuse terms. They can be consulted and used to check our results; their tables should not be copied into the product without written permission.
- **Open curves are poorly served.** The tools that analyse knots in open chains are either unmaintained (pyknotid, Knoto-ID) or restricted to non-commercial use (Topoly).

## Tools

| Tool | Computes | Language | Licence | Latest | Open curves | Role for this project |
| --- | --- | --- | --- | --- | --- | --- |
| SnapPy | Hyperbolic structure, volume, identification of a complement against censuses | Python, C | GPL-2.0-or-later | 3.3.2, 2026-03 | No | Development-time oracle |
| spherogram | Link diagrams from PD, DT or braid input; simplification; polynomial invariants (inside Sage only) | Python | GPL-2.0-or-later | 2.4.1, 2026-02 | No | Development-time oracle |
| Regina | Links from PD or Gauss codes; Jones, HOMFLY-PT, Alexander; 3-manifolds | C++, Python | GPL-2.0-or-later | 7.4.x, 2025-11 | No | Development-time oracle |
| knot_floer_homology | Knot Floer homology: Seifert genus, fibredness, tau | C++, Python | GPL-2.0-or-later | 1.2.2, 2025-01 | No | Development-time oracle |
| khoca | Khovanov and sl(N) homology | C++, Python | GPL-2.0-or-later | 1.5, 2026-03 | No | Possible later oracle |
| SageMath link module | Jones, Alexander, HOMFLY-PT, Khovanov | Python | GPL (Sage-wide; *unverified* for the module) | 10.x | No | Heavy; only if Regina proves insufficient |
| libhomfly | HOMFLY-PT | C | Unlicense per GitHub (a 2018 packaging review noted mixed tags) | active | No | Possible later oracle |
| pyknotid | Gauss codes and invariants of space curves, closing open curves | Python | MIT | 0.5.3, 2018; last push 2023 | Yes | Reference for open-curve handling; unmaintained |
| Knoto-ID | Knotoid invariants of open curves | C++ | GPL-2.0-or-later | README says no longer maintained | Yes | Reference for knotoid methods |
| Topoly | Polynomial invariants, knotoids, spatial graphs (Yamada) | C++, Python | "Free for non-commercial use" | 1.2.3, 2026-11 | Yes | Not usable (licence) |
| KnotFolio | Draw a diagram in the browser and identify it | JavaScript | GPL-2.0-or-later | last push 2024-01 | No (*unverified*) | Prior art; its code could be adapted under this project's licence |
| KnotPlot | Visualisation, editing, relaxation | C | Proprietary, paid | 1.022, 2024 | n/a | Prior art for interaction; not usable |
| KnotInfo, LinkInfo | Tables of invariants of knots and links of low crossing number | Data | **None stated**; citation requested | live | n/a | Consult and cross-check only |
| database_knotinfo | The KnotInfo tables as a Python package | Data | "GPL" on the packaging; data terms not stated | 2026.11.2 | n/a | Development-time lookup only |
| Knot Atlas, KnotTheory\` | Tables and a Mathematica package | Mathematica | *Unverified*; no licence text found | n/a | No | Consult only |
| yui (Rust crates) | Links, Khovanov and knot Floer homology | Rust | MIT (workspace; per-crate *unverified*) | 0.5.1, 2026-10 | No | Young; a possible future WebAssembly route |
| ncknot (Rust) | Kauffman bracket, Jones, Alexander, signature | Rust | GPL-3.0 | 2026-11, one star | No | Too new to rely on |
| Knotscape, KLO, JavaKh, KymoKnot, ridgerunner | Various | Various | Unclear or unavailable | Old | Mixed | Not suitable |

## Licence position

General information, not legal advice. This project is licensed AGPL-3.0-only (Product Owner decision, 2026-11-23).

- **GPL code can be combined with this project.** Code under GPL-2.0-or-later or GPL-3.0 may be used under GPL-3.0, and GPL-3.0 code may be combined with AGPL-3.0 code. That covers SnapPy, spherogram, Regina, knot_floer_homology, khoca and KnotFolio. Reusing them is a technical question, not a legal obstacle.
- **Running a program as a separate development-time process places no obligation on this repository.** The fixtures here are values computed by running such programs; the repository contains none of their code.
- **Non-commercial and proprietary tools** (Topoly, KnotPlot) are not used. Their terms are incompatible with the AGPL.
- **Unlicensed data** (KnotInfo, Knot Atlas) is treated as "permission needed", whatever this project's own licence. Standard names such as `3_1` and individual mathematical facts are not anyone's property, but the compiled tables are someone's work. If the product ever needs a bundled identification table, the clean route is to compute it ourselves and check it against theirs, or to ask the maintainers.
- **Anyone reusing this project's code must comply with the AGPL.** The document format can be implemented independently from its specification.

## What was verified by running it

In a throwaway Python 3.13 environment on the development machine:

- `snappy`, `spherogram`, `regina`, `knot_floer_homology` and `database_knotinfo` all install from PyPI on Linux without building anything.
- **spherogram's polynomial invariants do not work outside Sage.** `jones_polynomial`, `alexander_polynomial`, `signature` and `determinant` raise `SageNotAvailable`. This matters for the oracle design: spherogram alone is not enough.
- **Regina computes the Jones and Alexander polynomials in plain Python** from a PD code. It is the polynomial oracle.
- SnapPy identifies hyperbolic complements (figure-eight, 5_2, 10_132, Whitehead link, Borromean rings all came back with their census names). It returns nothing for torus knots and composite knots, which are not hyperbolic. Identification of those must rest on invariants.
- knot Floer homology returned Seifert genus and fibredness for every knot tried.
- A Jones polynomial computed by a state-sum prototype written for this project agreed with Regina on all 21 reference diagrams.

## Consequences

1. The diagram model is written here, in a language that runs in the browser, because no existing library models open ropes and objects. Existing GPL code may be adapted for individual algorithms where that saves work.
2. The oracle set is Regina (polynomials), SnapPy (identification of hyperbolic cases), knot Floer homology (genus, fibredness), each run offline to produce committed fixtures. Normal CI does not need them installed.
3. Identification in the product cannot lean on someone else's table. It is either computed here or omitted.
4. Open-curve analysis has no trustworthy oracle. The approach in the foundations report, closing open ropes by an explicit rule and then using closed-knot tools, is partly a response to that.
