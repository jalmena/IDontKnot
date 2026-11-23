#!/usr/bin/env python3
"""Round 2: direction A in the jewel palette, with three treatments of the joint where the hands meet.

Usage:  make_round2.py OUT_DIR
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_marks import wrap, horizontal  # noqa: E402

JEWEL = {
    "teal_deep": "#063640", "teal": "#0B5560", "teal_bright": "#0E6F76", "jewel": "#15908C",
    "gold": "#E6BE5A", "gold_dark": "#8C6710", "gold_mid": "#A87C17",
    "white": "#FFFFFF", "paper": "#F5FAF9",
}
GRADIENT = ('<defs><linearGradient id="jewel" x1="0" y1="1" x2="1" y2="0">'
            f'<stop offset="0" stop-color="{JEWEL["teal_deep"]}"/><stop offset="0.55" stop-color="{JEWEL["teal"]}"/>'
            f'<stop offset="1" stop-color="{JEWEL["jewel"]}"/></linearGradient></defs>')


def figure(ink, accent, joint):
    """joint: 'bead' (round 1), 'hands' (each hand grips the rope beside the knot), 'ring' (a ring binds the joint)."""
    g = f'<g fill="none" stroke="{ink}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">'
    g += '<path d="M76 30H100M156 30H180"/>'
    g += '<path d="M76 80H180A52 52 0 0 1 76 80Z"/>'
    g += '<path d="M76 180H180"/>'
    if joint == "hands":
        g += '<path d="M76 222L110 180M180 222L146 180"/>'
    else:
        g += '<path d="M76 222L128 180L180 222"/>'
    g += "</g>"
    if joint == "ring":
        g += f'<circle cx="128" cy="180" r="21" fill="none" stroke="{accent}" stroke-width="11"/>'
    else:
        g += f'<circle cx="128" cy="180" r="{17 if joint == "hands" else 19}" fill="{accent}"/>'
    return g


def icon(joint):
    return (GRADIENT + '<rect x="8" y="8" width="240" height="240" rx="54" fill="url(#jewel)"/>'
            f'<g transform="translate(128 126) scale(0.8) translate(-128 -126)">{figure(JEWEL["white"], JEWEL["gold"], joint)}</g>')


def palette_card():
    j = JEWEL
    sw = [("teal deep", j["teal_deep"], j["white"]), ("teal", j["teal"], j["white"]), ("teal bright", j["teal_bright"], j["white"]),
          ("jewel", j["jewel"], j["white"]), ("gold", j["gold"], j["teal_deep"]), ("gold dark", j["gold_dark"], j["white"]),
          ("white", j["white"], j["teal_deep"]), ("paper", j["paper"], j["teal_deep"])]
    body = GRADIENT + '<rect width="880" height="330" fill="#FFFFFF"/><rect x="20" y="20" width="290" height="290" rx="20" fill="url(#jewel)"/>'
    body += f'<g transform="translate(69 69) scale(0.75)">{figure(j["white"], j["gold"], "bead")}</g>'
    for i, (name, colour, text) in enumerate(sw):
        x, y = 340 + (i % 4) * 132, 20 + (i // 4) * 150
        body += f'<rect x="{x}" y="{y}" width="120" height="96" rx="12" fill="{colour}" stroke="#063640" stroke-opacity="0.25"/>'
        body += f'<text x="{x + 60}" y="{y + 54}" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="600" fill="{text}">{colour}</text>'
        body += f'<text x="{x + 60}" y="{y + 118}" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" fill="#063640">{name}</text>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 330" role="img" aria-label="Jewel palette">{body}</svg>\n'


def main(out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    j = JEWEL; files = {}
    for joint in ("bead", "hands", "ring"):
        files[f"r2-mark-{joint}.svg"] = wrap(figure(j["white"], j["gold"], joint), f"IDontKnot mark, {joint}", bg=j["teal"])
        files[f"r2-mark-{joint}-light.svg"] = wrap(figure(j["teal"], j["gold_mid"], joint), f"IDontKnot mark, {joint}", bg=j["paper"])
        files[f"r2-mark-{joint}-horizontal.svg"] = wrap(horizontal(figure(j["white"], j["gold"], joint)), "IDontKnot monogram :DK", bg=j["teal"])
        files[f"r2-mark-{joint}-bare.svg"] = wrap(figure(j["white"], j["gold"], joint), "IDontKnot mark")
        files[f"r2-mark-{joint}-bare-light.svg"] = wrap(figure(j["teal"], j["gold_mid"], joint), "IDontKnot mark")
        files[f"r2-icon-{joint}.svg"] = wrap(icon(joint), f"IDontKnot app icon, {joint}")
        files[f"r2-mark-{joint}-mono.svg"] = wrap(figure("#000000", "#000000", joint), "IDontKnot mark, one colour", bg="#FFFFFF")
    files["r2-palette.svg"] = palette_card()
    for name, text in files.items():
        (out / name).write_text(text)
    print(len(files), "files written to", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "svg")
