#!/usr/bin/env python3
"""Generate the IDontKnot mark candidates as SVG.

The mark is the initials IDK written as ":DK" (the I split into two segments).
Drawn upright it is a figure: two eyes, a smile, and two arms holding a rope
with the hands together. Rotated a quarter turn anticlockwise it reads ":DK".

Everything is computed on a 256-unit canvas so that a later round changes
parameters instead of redrawing.

Usage:  make_marks.py OUT_DIR   (for example: python3 sources/make_marks.py svg)
"""
import sys
from pathlib import Path

PALETTES = {
    "hemp":  {"paper": "#F3EDE2", "ink": "#221E1A", "accent": "#B8431F",
              "paper_dark": "#1A1714", "ink_dark": "#EFE7DA", "accent_dark": "#EC7A50"},
    "chart": {"paper": "#F4F5F2", "ink": "#121A2B", "accent": "#2450C8",
              "paper_dark": "#0F1522", "ink_dark": "#E8ECF4", "accent_dark": "#7C9DFF"},
    "slate": {"paper": "#F1F0EA", "ink": "#1D2320", "accent": "#7A5C0A",
              "paper_dark": "#151917", "ink_dark": "#ECEAE2", "accent_dark": "#DDB85C"},
}


def wrap(body, label, view="0 0 256 256", bg=None):
    rect = f'<rect x="-512" y="-512" width="1280" height="1280" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{label}">'
            f"{rect}{body}</svg>\n")


def figure_a(ink, accent, bead=True):
    """A, the person: rope-weight strokes, round caps."""
    s = 24
    g = f'<g fill="none" stroke="{ink}" stroke-width="{s}" stroke-linecap="round" stroke-linejoin="round">'
    g += '<path d="M76 30H100M156 30H180"/>'                      # the I, split: two eyes
    g += '<path d="M76 80H180A52 52 0 0 1 76 80Z"/>'              # the D: a smile
    g += '<path d="M76 180H180M76 222L128 180L180 222"/>'         # the K: a rope and two arms
    g += "</g>"
    if bead:
        g += f'<circle cx="128" cy="180" r="19" fill="{accent}"/>'  # the knot, in the hands
    return g


def figure_b(ink, accent):
    """B, the diagram: a thin line, and at the joint of the K a ring with the rope threaded through it,
    over on one side and under on the other, drawn the way knot diagrams are drawn."""
    s, cx, cy, r, cut = 12, 128, 176, 24, 14     # stroke, ring centre and radius, half-gap at a crossing
    import math
    a = cut / r                                    # half-angle of the gap in the ring where the rope passes over it
    x0, y0 = cx + r * math.cos(math.pi + a), cy + r * math.sin(math.pi + a)
    x1, y1 = cx + r * math.cos(math.pi - a), cy + r * math.sin(math.pi - a)
    k = r * math.sqrt(0.5)
    g = f'<g fill="none" stroke="{ink}" stroke-width="{s}" stroke-linecap="round" stroke-linejoin="round">'
    g += '<path d="M70 28H100M156 28H186"/>'
    g += '<path d="M70 70H186A58 58 0 0 1 70 70Z"/>'
    g += f'<path d="M{x0:.2f} {y0:.2f}A{r} {r} 0 1 1 {x1:.2f} {y1:.2f}"/>'               # ring, broken where the rope is over
    g += f'<path d="M70 {cy}H{cx + r - cut}M{cx + r + cut} {cy}H186"/>'                    # rope, broken where it is under
    g += f'<path d="M{cx - k:.2f} {cy + k:.2f}L76 {cy + 52}M{cx + k:.2f} {cy + k:.2f}L180 {cy + 52}"/>'  # arms
    g += "</g>"
    return g


def figure_c(block, glyph):
    """C, the seal: solid shapes reversed out of a rounded block."""
    g = f'<rect x="8" y="8" width="240" height="240" rx="54" fill="{block}"/>'
    g += f'<g fill="{glyph}">'
    g += '<rect x="68" y="40" width="44" height="26" rx="13"/><rect x="144" y="40" width="44" height="26" rx="13"/>'
    g += '<path d="M68 86H188A60 60 0 0 1 68 86Z"/>'
    g += '<rect x="68" y="164" width="120" height="26" rx="5"/>'
    g += '<path d="M128 178L198 222H160L128 202L96 222H58Z"/>'
    g += "</g>"
    return g


def horizontal(body):
    """The same drawing turned a quarter turn anticlockwise: it now reads :DK."""
    return f'<g transform="rotate(-90 128 128)">{body}</g>'


def palette_card(name, title, p):
    """One palette shown on its light and its dark paper, with mark A and the three swatches."""
    def half(x, paper, ink, accent):
        g = f'<rect x="{x}" y="0" width="320" height="320" fill="{paper}"/>'
        g += f'<g transform="translate({x + 76} 24) scale(0.66)">{figure_a(ink, accent)}</g>'
        for i, (label, colour) in enumerate((("paper", paper), ("ink", ink), ("accent", accent))):
            cx = x + 62 + i * 98
            g += f'<circle cx="{cx}" cy="238" r="20" fill="{colour}" stroke="{ink}" stroke-opacity="0.35" stroke-width="1.5"/>'
            g += (f'<text x="{cx}" y="282" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="{ink}">{colour}</text>'
                  f'<text x="{cx}" y="300" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" fill="{ink}" fill-opacity="0.7">{label}</text>')
        return g
    body = half(0, p["paper"], p["ink"], p["accent"]) + half(320, p["paper_dark"], p["ink_dark"], p["accent_dark"])
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" role="img" aria-label="Palette {title}">{body}</svg>\n'


def main(out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    p = PALETTES["hemp"]
    files = {}
    for theme, (paper, ink, accent) in {"": (p["paper"], p["ink"], p["accent"]),
                                        "-dark": (p["paper_dark"], p["ink_dark"], p["accent_dark"])}.items():
        files[f"mark-a{theme}.svg"] = wrap(figure_a(ink, accent), "IDontKnot mark, the person", bg=paper)
        files[f"mark-b{theme}.svg"] = wrap(figure_b(ink, accent), "IDontKnot mark, the diagram", bg=paper)
        files[f"mark-c{theme}.svg"] = wrap(figure_c(ink, paper), "IDontKnot mark, the seal", bg=paper)
        files[f"mark-a-horizontal{theme}.svg"] = wrap(horizontal(figure_a(ink, accent)), "IDontKnot monogram :DK", bg=paper)
        files[f"mark-b-horizontal{theme}.svg"] = wrap(horizontal(figure_b(ink, accent)), "IDontKnot monogram :DK", bg=paper)
        files[f"mark-c-horizontal{theme}.svg"] = wrap(horizontal(figure_c(ink, paper)), "IDontKnot monogram :DK", bg=paper)
    files["mark-a-mono.svg"] = wrap(figure_a("#000000", "#000000"), "IDontKnot mark, one colour", bg="#FFFFFF")
    files["mark-b-mono.svg"] = wrap(figure_b("#000000", "#000000"), "IDontKnot mark, one colour", bg="#FFFFFF")
    files["mark-c-mono.svg"] = wrap(figure_c("#000000", "#FFFFFF"), "IDontKnot mark, one colour", bg="#FFFFFF")
    files["mark-a-bare.svg"] = wrap(figure_a(p["ink"], p["accent"]), "IDontKnot mark")
    files["mark-b-bare.svg"] = wrap(figure_b(p["ink"], p["accent"]), "IDontKnot mark")
    files["mark-c-bare.svg"] = wrap(figure_c(p["ink"], p["paper"]), "IDontKnot mark")
    titles = {"hemp": "Hemp and tar", "chart": "Ink and chart", "slate": "Slate and brass"}
    for key, pal in PALETTES.items():
        files[f"palette-{key}.svg"] = palette_card(key, titles[key], pal)
    for name, text in files.items():
        (out / name).write_text(text)
    print(len(files), "files written to", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "svg")
