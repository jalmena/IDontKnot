#!/usr/bin/env python3
"""Generate the IDontKnot mark and app icon as SVG.

The mark is the initials IDK written as ":DK", with the I split into two segments.
Upright it is a figure: two eyes, a smile, and two arms whose hands hold a rope on
either side of a knot. Turned a quarter turn anticlockwise it reads ":DK".

Drawn on a 256-unit canvas, one stroke weight (24), flat ends, exactly symmetric
about the vertical axis.

Usage:  make_brand.py OUT_DIR
"""
import sys
from pathlib import Path

GREEN_EDGE = "#05140B"     # outer edge of the vignette, darkest surface
GREEN = "#0B2315"          # the brand surface
GREEN_GLOW = "#123524"     # centre of the vignette
IVORY = "#F3EAD3"          # ink on green
GOLD = "#C9A867"           # the accent, flat: the knot and the initials; small sizes and interface
SATIN = ("#C9A867", "#EAD2A0", "#D2B47C", "#E3CB98", "#C4A577")   # the accent as a soft sheen, for large uses only

SATIN_DEFS = ('<linearGradient id="satin" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="230" y2="150" spreadMethod="reflect">'
              + "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in zip((0, 0.3, 0.55, 0.8, 1), SATIN))
              + "</linearGradient>")
VIGNETTE_DEFS = (f'<radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="{GREEN_GLOW}"/>'
                 f'<stop offset="1" stop-color="{GREEN_EDGE}"/></radialGradient>')


def figure(ink, knot):
    g = f'<g fill="none" stroke="{ink}" stroke-width="24" stroke-linecap="butt" stroke-linejoin="miter">'
    g += '<path d="M64 30H112M144 30H192"/>'                        # the I, split in two: the eyes
    g += '<path d="M64 80H192M76 80A52 52 0 0 0 180 80"/>'          # the D: the smile
    g += '<path d="M64 180H192M110 180L76 224M146 180L180 224"/>'   # the K: a rope, and an arm to each side of the knot
    g += "</g>"
    g += f'<circle cx="128" cy="180" r="17" fill="{knot}"/>'        # the knot
    return g


def svg(body, label, defs=""):
    d = f"<defs>{defs}</defs>" if defs else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="{label}">{d}{body}</svg>\n'


def icon(knot):
    return ('<rect x="8" y="8" width="240" height="240" rx="54" fill="url(#vignette)"/>'
            f'<g transform="translate(128 126) scale(0.8) translate(-128 -126)">{figure(IVORY, knot)}</g>')


def main(out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    files = {
        "mark.svg": svg(figure(IVORY, GOLD), "IDontKnot"),
        "mark-satin.svg": svg(figure(IVORY, "url(#satin)"), "IDontKnot", SATIN_DEFS),
        "mark-one-colour.svg": svg(figure("#000000", "#000000"), "IDontKnot"),
        "icon.svg": svg(icon(GOLD), "IDontKnot", VIGNETTE_DEFS),
        "icon-satin.svg": svg(icon("url(#satin)"), "IDontKnot", VIGNETTE_DEFS + SATIN_DEFS),
    }
    for name, text in files.items():
        (out / name).write_text(text)
    print(len(files), "files written to", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "svg")
