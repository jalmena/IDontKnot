#!/usr/bin/env python3
"""Round 3: the mark built from the chosen typeface (Bitter), beside the rope-stroke mark A2, in a greener jewel palette.

The letters : D K are taken from the font's own outlines, set in a row, and turned a quarter turn clockwise
so that the row reads from top to bottom as a figure: eyes, smile, arms.

Usage:  make_round3.py BITTER_VARIABLE.ttf OUT_DIR
"""
import colorsys
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_marks import wrap  # noqa: E402
from make_round2 import figure as rope_figure  # noqa: E402

GOLD, GOLD_DARK, WHITE = "#E6BE5A", "#8C6710", "#FFFFFF"
# contrast of white on each surface, kept identical to round 2 while the hue moves
TARGETS = {"deep": 13.05, "base": 8.46, "bright": 5.91, "jewel": 3.89}
HUES = {"teal": 188, "green_teal": 172, "emerald": 160}


def lum(rgb):
    def lin(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def surface(hue, target, sat=0.80):
    """The colour of this hue on which white text has exactly the target contrast."""
    lo, hi = 0.0, 0.6
    for _ in range(40):
        mid = (lo + hi) / 2
        rgb = colorsys.hls_to_rgb(hue / 360, mid, sat)
        if 1.05 / (lum(rgb) + 0.05) > target:
            lo = mid
        else:
            hi = mid
    r, g, b = colorsys.hls_to_rgb(hue / 360, (lo + hi) / 2, sat)
    return "#{:02X}{:02X}{:02X}".format(round(r * 255), round(g * 255), round(b * 255))


def palette(hue):
    return {k: surface(hue, t) for k, t in TARGETS.items()}


def gradient(p, gid="g"):
    return (f'<defs><linearGradient id="{gid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="{p["deep"]}"/>'
            f'<stop offset="0.55" stop-color="{p["base"]}"/><stop offset="1" stop-color="{p["jewel"]}"/></linearGradient></defs>')


class Face:
    def __init__(self, path, weight):
        self.font = instancer.instantiateVariableFont(TTFont(path), {"wght": weight})
        self.glyphs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.cap = self.font["OS/2"].sCapHeight

    def outline(self, ch):
        name = self.cmap[ord(ch)]
        pen = SVGPathPen(self.glyphs); self.glyphs[name].draw(pen)
        bp = BoundsPen(self.glyphs); self.glyphs[name].draw(bp)
        return pen.getCommands(), bp.bounds, self.font["hmtx"][name][0]


def letters_row(face, ink, split_i, gap=0.0):
    """Returns (svg, width, left edge of the K) for the row ':DK' (or split I, D, K) in font units, y pointing up."""
    parts, x = [], 0.0
    first = "I" if split_i else ":"
    for ch in (first, "D", "K"):
        d, (x0, y0, x1, y1), adv = face.outline(ch)
        if ch == "I":
            half, cut = face.cap / 2, face.cap * 0.11
            for i, (ya, yb) in enumerate(((half + cut, face.cap + 50), (-50, half - cut))):
                parts.append(f'<clipPath id="i{i}"><rect x="{x0 - 20}" y="{ya}" width="{x1 - x0 + 40}" height="{yb - ya}"/></clipPath>'
                             f'<g transform="translate({x - x0} 0)"><path d="{d}" fill="{ink}" clip-path="url(#i{i})"/></g>')
        else:
            parts.append(f'<path d="{d}" fill="{ink}" transform="translate({x - x0} 0)"/>')
        if ch == "K":
            k_left = x
        x += (x1 - x0) + face.cap * gap
    return "".join(parts), x - face.cap * gap, k_left


def type_figure(face, ink, accent, split_i, bead=(0.30, 0.47, 0.17), gap=0.16, size=212):
    """The row turned clockwise into a figure, fitted to the 256 canvas. bead = (x from the K's left edge, y, radius), in cap heights."""
    row, width, k_left = letters_row(face, ink, split_i, gap)
    if bead:
        bx, by, br = bead
        row += f'<circle cx="{k_left + bx * face.cap}" cy="{by * face.cap}" r="{br * face.cap}" fill="{accent}"/>'
    s = min(size / width, 150 / face.cap)
    # font units (y up) -> canvas: flip y, scale, then rotate the row a quarter turn clockwise about the canvas centre
    inner = f'<g transform="translate({128 - s * width / 2} {124 + s * face.cap / 2}) scale({s} {-s})">{row}</g>'
    return f'<g transform="rotate(90 128 124)">{inner}</g>', inner


def flat_figure(ink, accent):
    """A2 with one change: flat ends and sharp corners instead of round ones, like the typeface's terminals. No serifs."""
    g = f'<g fill="none" stroke="{ink}" stroke-width="24" stroke-linecap="butt" stroke-linejoin="miter">'
    g += '<path d="M64 30H112M144 30H192"/>'
    g += '<path d="M64 80H192M76 80A52 52 0 0 0 180 80"/>'
    g += '<path d="M64 180H192M110 180L76 224M146 180L180 224"/>'
    g += "</g>"
    g += f'<circle cx="128" cy="180" r="17" fill="{accent}"/>'
    return g


def slab_figure(ink, accent):
    """A2 redrawn with the typeface's manners: flat ends and slab serifs on the D, on the K's stem and on its arms."""
    g = f'<g fill="none" stroke="{ink}" stroke-width="24" stroke-linecap="butt" stroke-linejoin="miter">'
    g += '<path d="M64 30H112M144 30H192"/>'                                   # the split I: two flat-ended bars
    g += '<path d="M60 80H196M76 80A52 52 0 0 0 180 80"/>'                     # the D: its stem overhangs the bowl like a serif
    g += '<path d="M64 180H192M64 158V202M192 158V202"/>'                      # the K's stem, with a slab at each end
    g += '<path d="M110 180L80 220M146 180L176 220M58 222H100M156 222H198"/>'  # the arms, each ending in a slab
    g += "</g>"
    g += f'<circle cx="128" cy="180" r="17" fill="{accent}"/>'
    return g


def icon(p, body):
    return gradient(p) + f'<rect x="8" y="8" width="240" height="240" rx="54" fill="url(#g)"/><g transform="translate(128 126) scale(0.8) translate(-128 -126)">{body}</g>'


def palette_card(name, p):
    body = gradient(p) + '<rect width="560" height="250" fill="#FFFFFF"/><rect x="16" y="16" width="218" height="218" rx="18" fill="url(#g)"/>'
    body += f'<g transform="translate(47 45) scale(0.61)">{rope_figure(WHITE, GOLD, "hands")}</g>'
    for i, key in enumerate(("deep", "base", "bright", "jewel")):
        x, y = 256 + (i % 2) * 148, 16 + (i // 2) * 112
        body += f'<rect x="{x}" y="{y}" width="136" height="76" rx="10" fill="{p[key]}"/>'
        body += f'<text x="{x + 68}" y="{y + 44}" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="600" fill="#FFFFFF">{p[key]}</text>'
        body += f'<text x="{x + 68}" y="{y + 96}" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#10302B">{key}</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 250" role="img" aria-label="Palette {name}">{body}</svg>\n'


def main(font_path, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    face = Face(font_path, 700)
    pals = {name: palette(h) for name, h in HUES.items()}
    p = pals["emerald"]
    files = {}
    for name, pal in pals.items():
        files[f"r3-palette-{name}.svg"] = palette_card(name, pal)
        print(name, pal)
    variants = {
        "rope": (rope_figure(WHITE, GOLD, "hands"), None),
        "flat": (flat_figure(WHITE, GOLD), None),
        "slab": (slab_figure(WHITE, GOLD), None),
        "type-colon": type_figure(face, WHITE, GOLD, split_i=False),
        "type-split": type_figure(face, WHITE, GOLD, split_i=True),
    }
    for key, (upright, row) in variants.items():
        files[f"r3-mark-{key}.svg"] = wrap(upright, f"IDontKnot mark, {key}", bg=p["base"])
        files[f"r3-icon-{key}.svg"] = wrap(icon(p, upright), f"IDontKnot app icon, {key}")
        files[f"r3-mark-{key}-bare.svg"] = wrap(upright, "IDontKnot mark")
        if row:
            files[f"r3-mark-{key}-row.svg"] = wrap(row, "IDontKnot monogram", bg=p["base"])
    for name, text in files.items():
        (out / name).write_text(text)
    print(len(files), "files written to", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "svg")
