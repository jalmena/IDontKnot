# Oracle scripts

Development-time scripts that generate the reference diagrams in [fixtures/topology/reference-diagrams.json](../../fixtures/topology/reference-diagrams.json) and check them against independent mathematical software.

These are research prototypes. They are not part of the application and are never shipped. They call GPL-licensed programs as separate tools; no code from those programs is in this repository.

## Files

- `diagram_prototype.py`: a small reference implementation of the diagram conventions proposed in the [knot document model](../../docs/spec/knot-document-model.md): conversion of signed strand-visit codes to PD codes, the planarity test (with and without open ends), the Kauffman bracket and Jones polynomial, and closed-braid input.
- `make_fixtures.py`: builds each reference diagram, computes its expected values and refuses to write anything unless the independent tools agree.

## Running

```sh
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python snappy regina knot_floer_homology database_knotinfo
.venv/bin/python -I make_fixtures.py ../../fixtures/topology/reference-diagrams.json
```

The script prints one line per diagram and fails on the first disagreement.

## What is checked

| Check | By |
| --- | --- |
| The code describes a diagram that can be drawn on a sphere | Genus of the combinatorial map, this prototype |
| Jones polynomial | This prototype's state sum, and Regina, which must agree exactly |
| Alexander polynomial | Regina |
| Seifert genus, fibredness | knot Floer homology |
| Name of the knot or link, hyperbolic volume | SnapPy census identification (hyperbolic cases only) |
| For open ropes: all ends lie in one face, and the closure has the expected invariants | This prototype, then the checks above on the closure |

`database_knotinfo` is used only to look up braid words for two knots. No table from it is stored here.
