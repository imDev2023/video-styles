#!/usr/bin/env python3
"""Hard-cut check: finds the frames of a finished render whose picture differs sharply from the previous one.

Works for any pipeline: it needs only the video file, ffmpeg and ffprobe on the PATH, and numpy.
It decodes the film to 96x54 grayscale and measures each frame's mean absolute difference from the frame before.
A frame is a cut when its difference is at least the limit and at least three times the median of its six neighbours
on each side, so a steady pan or a boiling line does not count. The limit is --thr (absolute, default 18 on the 0 to
255 scale) or --rel times the film's own median change (default 20, so a quiet two-panel film still shows its cuts),
whichever is lower, but never under --floor (default 4): a caption popping in moves the thumbnail by 1 to 3, a
scene change by 5 or more, a whole-frame cut by 20 or more.

    python3 styles/tools/cuts.py out/final.mp4                     # list every cut with its time
    python3 styles/tools/cuts.py out/final.mp4 --max 0             # gate: exit 1 when there is any hard cut
    python3 styles/tools/cuts.py out/final.mp4 --min-gap 6         # cuts within 6 frames of each other count as one event
    python3 styles/tools/cuts.py out/final.mp4 --beats out/beats.json --grid 4   # how many cuts sit on the 16th-note grid
    python3 styles/tools/cuts.py out/final.mp4 --json              # machine-readable result on stdout

A style that cuts on purpose (a launch film on the beat) passes the JSON from beats.py with --beats and reads how many
cut events land within --tolerance ms (default 50, about a frame at 24 fps) of a grid point (--grid points per beat,
default 4), plus the median offset, which shows a grid whose phase drifts from the film's; a story style that promises
continuous motion gates on --max 0.
Exit status: 0 when the count is within --max (or no --max was given), 1 when it is over, 2 on a decode error.

Adapted from tools/python/cuts.py in makevoid/motion-graphics-music-video-skill
(https://github.com/makevoid/motion-graphics-music-video-skill), MIT License, Copyright (c) 2026 makevoid.
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions
of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
"""
import argparse
import json
import subprocess
import sys

import numpy as np

W, H = 96, 54


def fps_of(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                          "-of", "csv=p=0", video], capture_output=True, text=True, check=True).stdout.strip().strip(",")
    num, den = (out.split("/") + ["1"])[:2]
    return float(num) / float(den)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("video")
    ap.add_argument("--thr", type=float, default=18.0, help="absolute difference that is always a cut (default 18)")
    ap.add_argument("--rel", type=float, default=20.0, help="multiple of the film's median change that is a cut (default 20)")
    ap.add_argument("--floor", type=float, default=4.0, help="the limit never drops under this (default 4)")
    ap.add_argument("--min-gap", type=int, default=0, help="merge cuts closer than this many frames into one event")
    ap.add_argument("--max", type=int, default=None, help="gate: fail when more than this many cuts (events) are found")
    ap.add_argument("--beats", help="beats.py JSON: report how many cut events sit on its grid")
    ap.add_argument("--grid", type=int, default=4, help="grid points per beat for --beats (default 4, sixteenth notes)")
    ap.add_argument("--tolerance", type=float, default=50.0, help="milliseconds a cut may sit from a grid point (default 50)")
    ap.add_argument("--json", action="store_true", help="JSON on stdout instead of the list")
    a = ap.parse_args()

    try:
        fps = fps_of(a.video)
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                             capture_output=True, check=True).stdout
    except subprocess.CalledProcessError as e:
        print(f"cuts: cannot decode {a.video}: {e.stderr.decode(errors='replace').strip()}", file=sys.stderr)
        sys.exit(2)
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)
    diff = np.concatenate([[0.0], np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))])
    median = float(np.median(diff[1:])) if len(diff) > 1 else 0.0
    limit = max(a.floor, min(a.thr, a.rel * median) if median > 0 else a.thr)

    cuts = []
    for i in range(1, len(diff)):
        near = np.concatenate([diff[max(i - 6, 1):i], diff[i + 1:i + 7]])
        if diff[i] >= limit and diff[i] >= 3 * (np.median(near) if len(near) else 0):
            cuts.append({"f": i, "t": round(i / fps, 3), "diff": round(float(diff[i]), 1)})

    events = []
    for c in cuts:
        if events and c["f"] - events[-1]["last"] <= a.min_gap:
            events[-1]["last"] = c["f"]
            events[-1]["n"] += 1
            events[-1]["diff"] = max(events[-1]["diff"], c["diff"])
        else:
            events.append({"f": c["f"], "t": c["t"], "last": c["f"], "n": 1, "diff": c["diff"]})

    on_grid = None
    if a.beats:
        with open(a.beats) as fh:
            bj = json.load(fh)
        period = bj["period"]
        grid = sorted(b["t"] + k * period / a.grid for b in bj["beats"] for k in range(a.grid))
        for e in events:
            nearest = min(grid, key=lambda g: abs(e["t"] - g)) if grid else None
            e["grid_off_ms"] = round((e["t"] - nearest) * 1000, 1) if nearest is not None else None
        offs = [abs(e["grid_off_ms"]) for e in events if e["grid_off_ms"] is not None]
        on_grid = sum(1 for o in offs if o <= a.tolerance)
        median_off = round(float(np.median(offs)), 1) if offs else None

    result = {"video": a.video, "fps": fps, "frames": len(frames), "median_change": round(median, 2), "limit": round(limit, 2),
              "cuts": cuts, "events": events, "on_grid": on_grid, "median_grid_off_ms": median_off if a.beats else None}
    if a.json:
        json.dump(result, sys.stdout)
        print()
    else:
        print(f"{a.video}: {len(frames)} frames at {fps:g} fps, median change {median:.2f}, cut limit {limit:.1f}")
        for e in events:
            span = f" ({e['n']} cuts to frame {e['last']})" if e["n"] > 1 else ""
            off = f"  {e['grid_off_ms']:+6.1f} ms from the grid" if e.get("grid_off_ms") is not None else ""
            print(f"  cut at frame {e['f']:5d}  {e['t']:7.2f} s  change {e['diff']:5.1f}{span}{off}")
        print(f"  {len(events)} cut event(s)" + (f", limit {a.max}" if a.max is not None else ""))
        if on_grid is not None:
            print(f"  {on_grid} of {len(events)} within {a.tolerance:g} ms of the {a.grid}-per-beat grid, median offset {median_off} ms")
    if a.max is not None and len(events) > a.max:
        sys.exit(1)


if __name__ == "__main__":
    main()
