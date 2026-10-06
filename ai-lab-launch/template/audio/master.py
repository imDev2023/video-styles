"""Master mix_raw.wav to -14 LUFS integrated with true peaks under -1 dBTP.

Gain plus a transparent look-ahead true-peak limiter (4x oversampled detector, 5 ms look-ahead,
80 ms release), iterated until ffmpeg's EBU R128 meter reads -14.0 LUFS.
pedalboard's Limiter is not used: it is JUCE's two-stage compressor with make-up gain to 0 dBFS.
"""
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from numba import njit
from scipy.ndimage import minimum_filter1d
from scipy.signal import resample_poly

HERE = Path(__file__).resolve().parent
CFG = __import__("json").loads((HERE.parent / "config.json").read_text())
TARGET, CEIL = CFG["mix"]["lufs"], CFG["mix"]["true_peak"]


def measure(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summary = out[out.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return i, tp


@njit(cache=True)
def release(g, coef):
    out = np.empty_like(g)
    cur = 1.0
    for n in range(len(g)):
        cur = g[n] if g[n] < cur else coef * cur + (1 - coef) * g[n]
        out[n] = cur
    return out


def limit(y, sr, ceiling_db):
    c = 10 ** (ceiling_db / 20)
    up = resample_poly(y, 4, 1, axis=0)
    peak = np.abs(up).max(axis=1).reshape(-1, 4).max(axis=1)[: len(y)]
    want = np.minimum(1.0, c / np.maximum(peak, 1e-9))
    la = int(0.005 * sr)
    # Look ahead: each sample already knows the smallest gain needed in the next 5 ms, and the step is smoothed
    # over that window so the gain ramps down before the peak instead of clipping it.
    g = minimum_filter1d(want, size=2 * la + 1, origin=-la, mode="nearest")
    g = np.convolve(np.pad(g, (la, 0), mode="edge"), np.ones(la) / la, mode="valid")[: len(y)]
    g = np.minimum(g, minimum_filter1d(want, size=la, mode="nearest"))
    g = release(g.astype(np.float64), np.exp(-1 / (0.08 * sr)))
    return y * g[:, None]


x, sr = sf.read(HERE / "mix_raw.wav", dtype="float64")
i0, tp0 = measure(HERE / "mix_raw.wav")
print(f"raw: {i0:.2f} LUFS, true peak {tp0:.2f} dBTP")
gain = TARGET - i0
for _ in range(8):
    y = limit(x * 10 ** (gain / 20), sr, CEIL - 0.3)
    sf.write(HERE / "mix.wav", y, sr, subtype="PCM_24")
    i, tp = measure(HERE / "mix.wav")
    print(f"gain {gain:+.2f} dB -> {i:.2f} LUFS, true peak {tp:.2f} dBTP")
    if abs(i - TARGET) < 0.05 and tp <= CEIL:
        break
    gain += TARGET - i
