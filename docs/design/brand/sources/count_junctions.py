#!/usr/bin/env python3
"""Count stroke junctions per letter in a typeface, as a measure of how "knotted" its letterforms are.

Each letter is rendered large, thinned to a one-pixel skeleton, short spurs (artefacts of corners) are pruned,
and the points where three or more skeleton branches meet are counted. An I drawn as a plain stick scores 0;
an I drawn like the section of an I-beam scores 2.

This is a proxy, not a typographic judgement: it depends on the rendering size and on the pruning length.

Usage:  count_junctions.py WORD FONT.ttf [FONT.ttf ...]
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize
from scipy import ndimage as ndi

SIZE = 360                      # font size in pixels
PRUNE = 16                      # spur length removed, about half a stroke width at this size
K8 = np.ones((3, 3), int)


def neighbours(sk):
    return ndi.convolve(sk.astype(int), K8, mode="constant") - sk


def junctions(font, ch):
    box = font.getbbox(ch)
    img = Image.new("L", (box[2] - box[0] + 40, box[3] - box[1] + 40), 0)
    ImageDraw.Draw(img).text((20 - box[0], 20 - box[1]), ch, font=font, fill=255)
    sk = skeletonize(np.array(img) > 127)
    for _ in range(PRUNE):                       # remove end pixels repeatedly: deletes short spurs
        sk = sk & ~(sk & (neighbours(sk) == 1))
    branch = sk & (neighbours(sk) >= 3)
    labels, n = ndi.label(ndi.binary_dilation(branch, iterations=4))
    return n


def main():
    word, paths = sys.argv[1], sys.argv[2:]
    letters = list(dict.fromkeys(word))
    rows = []
    for p in paths:
        font = ImageFont.truetype(p, SIZE)
        per = {ch: junctions(font, ch) for ch in letters}
        rows.append((sum(per[ch] for ch in word), Path(p).stem, per))
    rows.sort(reverse=True)
    print(f"{'typeface':22s} total  " + "  ".join(letters))
    for total, name, per in rows:
        print(f"{name:22s} {total:5d}  " + "  ".join(str(per[ch]) for ch in letters))


if __name__ == "__main__":
    main()
