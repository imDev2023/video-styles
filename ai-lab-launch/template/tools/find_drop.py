"""Measure the song: tempo, beat grid and the real drop near the one you were told.

python3 tools/find_drop.py [approx_seconds]     # default: config.music.drop

Listed drop times are often wrong: Pixabay said 75.39 s for Cascade Breathe, the bass actually lands at 75.72 s,
and 75.39 sat inside the silent gap before it. Put the measured attack in config.music.drop.
"""
import json
import sys
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import butter, sosfiltfilt

PROJECT = Path(__file__).resolve().parents[1]
CFG = json.loads((PROJECT / "config.json").read_text())
approx = float(sys.argv[1]) if len(sys.argv) > 1 else CFG["music"]["drop"]
y, sr = librosa.load(PROJECT / CFG["music"]["file"], sr=22050, mono=True)

_, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
n = np.arange(len(beats))
period, phase = np.polyfit(n, beats, 1)
print(f"tempo {60 / period:.2f} BPM (linear fit over {len(beats)} beats); librosa beat phase {phase % period:.3f} s")
print("librosa sometimes locks onto off-beats: check the kick sits on the grid, not half a beat away")

low = sosfiltfilt(butter(4, 150, btype="low", fs=sr, output="sos"), y)
hop = int(0.005 * sr)
env = np.sqrt(np.convolve(low**2, np.ones(hop) / hop, mode="same"))[::hop]
db = 20 * np.log10(env + 1e-9)
t = np.arange(len(db)) * 0.005
# A drop is a step: the low band is much louder in the 0.4 s after a moment than in the 0.4 s before it.
k = int(0.4 / 0.005)
csum = np.cumsum(np.r_[0, db])
after = np.full_like(db, -99.0)
before = np.full_like(db, -99.0)
after[: len(db) - k] = (csum[k + 1 : len(db) + 1] - csum[1 : len(db) - k + 1]) / k
before[k:] = (csum[k : len(db)] - csum[: len(db) - k]) / k
step = np.where((t > approx - 2) & (t < approx + 2) & (before > -98) & (after > -98), after - before, -99)
print(f"\nbiggest low-band (<150 Hz) steps within 2 s of {approx:.2f} s (attack = where the level first reaches halfway):")
seen = []
for i in np.argsort(step)[::-1]:
    if step[i] < 0 or len(seen) == 3:
        break
    if any(abs(t[i] - s) < 0.5 for s in seen):
        continue
    seen.append(t[i])
    j0, j1 = max(0, i - k), min(len(db), i + k)
    mid = (before[i] + after[i]) / 2
    attack = t[j0 + int(np.argmax(db[j0:j1] > mid))]
    print(f"  step {step[i]:+5.1f} dB around {t[i]:7.3f} s -> attack at {attack:7.3f} s")
for s in np.arange(int(approx) - 2, int(approx) + 3):
    m = (t >= s) & (t < s + 1)
    print(f"  second {s}: low-band level {np.mean(db[m]):6.1f} dB")
