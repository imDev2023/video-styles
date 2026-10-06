"""Fallback soundtrack with no soundfonts: numpy-synthesised music box, sine pad and event effects.

  python3 music_synth.py   -> out/audio.wav  (a few seconds)

This was the first soundtrack of the original video, before the sampled score in music.py replaced it.
It sounds thinner and more toy-like, but it needs nothing beyond numpy, so use it for quick
previews or on a machine without ~/soundfonts. The cue section is PER-VIDEO and reads config.py.
"""
import wave
from pathlib import Path

import numpy as np

from config import (DUR, BEAT, SPARK_POP, MUSH_T, LEDGE_LAND, OWL_WAKE, SLIDE_T0, SLIDE_T1, WHEEL_TICKS,
                    MACHINE_ON, MACHINE_OFF, STAR_T0, STAR_DT, STAR_FLY, MOON_T)

HERE = Path(__file__).resolve().parent
SR = 44100
N = int(DUR * SR)
L = np.zeros(N); Rr = np.zeros(N)
rng = np.random.RandomState(5)


def mix(sig, t0, amp=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[:N - i]
    L[i:i + len(sig)] += sig * amp * (1 - max(0, pan))
    Rr[i:i + len(sig)] += sig * amp * (1 + min(0, pan))


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)


def bell(f, dur=1.6):
    t = np.arange(int(dur * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d)
            for a, r, d in ((1, 1, 3.2), (0.45, 2.01, 5), (0.22, 3.98, 8), (0.12, 5.4, 12)))
    return s * np.minimum(1, t * 400)


def pad(f, dur):
    t = np.arange(int(dur * SR)) / SR
    env = np.minimum(1, t / 0.8) * np.minimum(1, (dur - t) / 0.8)
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2 * t + 1)) * env


def lowpass_noise(dur, k):
    x = rng.normal(0, 1, int(dur * SR))
    return np.convolve(x, np.ones(k) / k, mode="same")


def sweep(f0, f1, dur, decay=4):
    t = np.arange(int(dur * SR)) / SR
    f = f0 + (f1 - f0) * (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)


# ------------------------------------------------------------------ PER-VIDEO
PENT = [60, 62, 64, 67, 69, 72, 74, 76, 79]
CHORDS = [(48, 55, 64), (45, 52, 60), (41, 48, 57), (43, 50, 59)]   # C Am F G

# pad: one chord per bar, fading in over the first bars and out over the last 6 s
bar = BEAT * 4
for b in range(int(DUR / bar) + 1):
    t0 = b * bar
    g = min(1, 0.35 + t0 / 12) * (1 - max(0, (t0 - (DUR - 6)) / 6))
    for m in CHORDS[b % 4]:
        mix(pad(hz(m), bar + 0.8), t0, 0.045 * g, 0.0)

# music-box melody: half time until the machine starts, an octave up for the finale
pattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 3, 4, 6, 5, 4, 2]
for k in range(int(DUR / BEAT)):
    t0 = k * BEAT
    if t0 < 2.0 or t0 > DUR - 3: continue
    if t0 < 24 and k % 2: continue
    idx = pattern[k % len(pattern)]
    mix(bell(hz(PENT[idx] + (12 if t0 > 33 else 0)), 1.8), t0, 0.16 * (1 - max(0, (t0 - (DUR - 6)) / 3)), (k % 5 - 2) * 0.15)

# sound effects, one per on-screen event
mix(sweep(900, 1800, 0.35, 6), SPARK_POP, 0.25)
for i, t0 in enumerate(MUSH_T):
    mix(sweep(260 + 60 * i, 520 + 90 * i, 0.35, 5), t0, 0.35)
    mix(bell(hz(PENT[i * 2 + 2] + 12), 1.2), t0, 0.25)
mix(lowpass_noise(0.12, 30) * np.exp(-np.arange(int(0.12 * SR)) / SR * 40), LEDGE_LAND, 3.0)
for dt, f in ((0.0, 330), (0.45, 290)):                           # owl hoo: vibrato sine
    t = np.arange(int(0.4 * SR)) / SR
    mix(np.sin(2 * np.pi * f * t + 3 * np.sin(2 * np.pi * 6 * t)) * np.sin(np.pi * t / 0.4) ** 2, OWL_WAKE + 0.2 + dt, 0.35)
d = SLIDE_T1 - SLIDE_T0
t = np.arange(int(d * SR)) / SR
mix(lowpass_noise(d, 12) * np.sin(np.pi * t / d) ** 1.5, SLIDE_T0, 1.4, 0.1)
for k in range(9):
    mix(lowpass_noise(0.04, 6) * np.exp(-np.arange(int(0.04 * SR)) / SR * 90), WHEEL_TICKS + k * 0.16, 2.2)
d = MACHINE_OFF - MACHINE_ON
t = np.arange(int(d * SR)) / SR
mix((lowpass_noise(d, 40) * 3 + np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 110 * t + 8 * np.sin(2 * np.pi * 7 * t)) * 0.2)
    * np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 1.0), MACHINE_ON, 0.18)
for i in range(9):
    t0 = STAR_T0 + STAR_DT * i
    mix(sweep(300, 1400, 0.25, 8), t0, 0.3)
    mix(bell(hz(PENT[(i * 2) % 9] + 12), 2.2), t0 + STAR_FLY, 0.30, (i - 4) * 0.15)
for j, m in enumerate((72, 76, 79, 84)):
    mix(bell(hz(m), 3.5), MOON_T + j * 0.12, 0.16)

# ------------------------------------------------------------------ master: soft tanh clip + fades
env = np.minimum(1, np.arange(N) / SR / 0.5) * np.minimum(1, (DUR - np.arange(N) / SR) / 2.0)
out = np.stack([L * env, Rr * env], 1)
out = np.tanh(out * 1.1) / np.tanh(1.1)
out = out / max(1e-9, np.abs(out).max()) * 0.9
(HERE / "out").mkdir(exist_ok=True)
with wave.open(str(HERE / "out" / "audio.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype("<i2").tobytes())
print("wrote", HERE / "out" / "audio.wav", N / SR, "s")
