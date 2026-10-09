#!/usr/bin/env python3
"""The storyboard sheet (check-in 3) and the seam sheet, from stills rendered by film/render.mjs.

    cd film && node render.mjs events                              # writes out/events.json (the anchors the seams sit on)
    node render.mjs stills $(python3 ../tools/board.py times)      # one still per panel, and 0.1 s either side of every seam
    cd .. && python3 tools/board.py                                # -> out/storyboard.jpg (numbered panels with their reads), out/seams.jpg

The panels and seams live in config.json under "storyboard":
  panels: [{"t": <film time of the still>, "title": "scene 1: the name", "reads": ["what the viewer must understand, with its start and end", ...]}]
  seams:  ["s2", "drop", ...]  anchor names from config.anchors; each seam shows the frame 0.1 s before and after it.
Open both sheets for the operator with `open out/storyboard.jpg out/seams.jpg` in the same turn as the message.
"""
import json
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "out"
CFG = json.load(open(HERE / "config.json"))
SB = CFG["storyboard"]


def anchors():
    ev = OUT / "events.json"
    if not ev.exists():
        sys.exit("out/events.json is missing: run `node render.mjs events` in film/ first")
    return json.load(open(ev))["T"]


def seam_times():
    T = anchors()
    return [(name, T[name], round(T[name] - 0.1, 2), round(T[name] + 0.1, 2)) for name in SB["seams"]]


def still(t):
    return OUT / "stills" / f"t{t:.2f}.png"


def fonts():
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22), ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 17)
    except OSError:
        f = ImageFont.load_default()
        return f, f


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "times":
        times = [p["t"] for p in SB["panels"]] + [t for _, _, a, b in seam_times() for t in (a, b)]
        print(" ".join(f"{t:g}" for t in times))
        return
    panels, seams = SB["panels"], seam_times()
    missing = [still(p["t"]) for p in panels if not still(p["t"]).exists()] + [still(t) for _, _, a, b in seams for t in (a, b) if not still(t).exists()]
    if missing:
        sys.exit("missing stills: " + ", ".join(m.name for m in missing) + "\nrender them with: cd film && node render.mjs stills $(python3 ../tools/board.py times)")
    fb, fr = fonts()
    cell, tx, pad, cols = 560, 150, 16, 2
    rows = (len(panels) + 1) // 2
    sheet = Image.new("RGB", (cols * (cell + pad) + pad, rows * (cell + tx + pad) + pad), "#f4f5f8")
    d = ImageDraw.Draw(sheet)
    for i, p in enumerate(panels):
        x, y = pad + (i % cols) * (cell + pad), pad + (i // cols) * (cell + tx + pad)
        sheet.paste(Image.open(still(p["t"])).convert("RGB").resize((cell, cell), Image.LANCZOS), (x, y))
        d.text((x, y + cell + 6), f"{i + 1}. {p['t']:g} s, {p['title']}", fill="#1a1512", font=fb)
        yy = y + cell + 34
        for j, r in enumerate(p["reads"]):
            for line in textwrap.wrap(("reads: " if j == 0 else "") + r, 62):
                d.text((x, yy), line, fill="#3a332d", font=fr)
                yy += 21
    sheet.save(OUT / "storyboard.jpg", quality=88)
    c = 420
    s2 = Image.new("RGB", (2 * c + 40, len(seams) * (c + 30) + 10), "#f4f5f8")
    d2 = ImageDraw.Draw(s2)
    for i, (name, t, a, b) in enumerate(seams):
        y = 10 + i * (c + 30)
        for j, tt in enumerate((a, b)):
            s2.paste(Image.open(still(tt)).convert("RGB").resize((c, c), Image.LANCZOS), (10 + j * (c + 20), y))
        d2.text((10, y + c + 4), f"{name} {t:.2f} s: 0.1 s before (left) and after (right)", fill="#1a1512", font=fr)
    s2.save(OUT / "seams.jpg", quality=85)
    print("wrote", OUT / "storyboard.jpg", f"({len(panels)} panels) and", OUT / "seams.jpg", f"({len(seams)} seams)")


if __name__ == "__main__":
    main()
