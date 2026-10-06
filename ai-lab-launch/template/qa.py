"""Checks before anyone sees the film.

python3 qa.py out/film.mp4

1. Contact sheet: one still every 0.75 s, into out/contact_sheet.jpg.
2. Frame-diff scan: flags any frame that jumps far more than the frames around it (a single-frame pop).
   Only the 16th-note image runs are allowed to jump; frames inside them are listed separately.
3. Voice over music for every phrase, from audio/report.json.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
video = Path(sys.argv[1])
ev = json.load(open(ROOT / "out/events.json"))
T, FPS = ev["T"], 60
S = 240  # analysis size

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"scale={S}:{S}:flags=area", "-f", "rawvideo",
                      "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, S, S, 3).astype(np.float32)
n = len(frames)
print(f"{video.name}: {n} frames, {n / FPS:.3f} s")

# 1. contact sheet
step = int(0.75 * FPS)
idx = list(range(0, n, step))
cols, tile = 8, 300
rows = (len(idx) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tile, rows * (tile + 26)), "#e9ebf0")
d = ImageDraw.Draw(sheet)
f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
full = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"select='not(mod(n\\,{step}))',scale={tile - 6}:{tile - 6}",
                       "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
thumbs = np.frombuffer(full, np.uint8).reshape(-1, tile - 6, tile - 6, 3)
for k, (i, th) in enumerate(zip(idx, thumbs)):
    x, y = (k % cols) * tile, (k // cols) * (tile + 26)
    sheet.paste(Image.fromarray(th), (x + 3, y + 3))
    d.text((x + 6, y + tile - 1), f"{i / FPS:5.2f}s", fill="#4a5468", font=f)
sheet.save(ROOT / "out/contact_sheet.jpg", quality=90)
print("contact sheet:", len(idx), "stills")

# 2. frame-diff scan
diff = np.zeros(n)
diff[1:] = np.abs(frames[1:] - frames[:-1]).mean(axis=(1, 2, 3))
card_in = T["drop"] + 0.42
runs = [(T["s2"] - 0.15, T["drop"] + 0.02, "full-bleed 16ths"), (card_in, T["pick"] + 0.12, "result card 16ths"),
        (T["set2"] - 0.02, T["set3"] + 0.02, "settings seed roll 16ths")]
def in_run(t):
    return next((r[2] for r in runs if r[0] <= t <= r[1]), None)
flags, allowed = [], []
for i in range(2, n - 2):
    local = np.median(np.r_[diff[i - 6 : i - 1], diff[i + 2 : i + 7]]) if i > 6 else np.median(diff[1:i])
    # a pop: this frame changes far more than its neighbours do, and visibly so
    if diff[i] > 2.5 and diff[i] > 4 * max(local, 0.25):
        (allowed if in_run(i / FPS) else flags).append((i, i / FPS, round(float(diff[i]), 2), round(float(local), 2), in_run(i / FPS)))
print(f"single-frame pops outside the 16th-note runs: {len(flags)}")
for i, t, dv, lc, _ in flags:
    print(f"  frame {i} ({t:.3f} s): diff {dv} vs local {lc}")
print(f"jumps inside the 16th-note runs (allowed): {len(allowed)}")
print(f"largest frame diff outside runs: {max((diff[i] for i in range(1, n) if not in_run(i / FPS)), default=0):.2f}")

# 3. voice over music
rows = json.load(open(ROOT / "audio/report.json"))
print("voice over music, 300 Hz to 4 kHz:")
for r in rows:
    print(f"  {r['t0']:6.2f}-{r['t1']:6.2f}  {r['voice_over_music_db']:+5.1f} dB  {r['text']}")
json.dump({"frames": n, "pops": flags, "allowed_jumps": len(allowed), "diff": [round(float(x), 3) for x in diff]},
          open(ROOT / "out/qa.json", "w"))
