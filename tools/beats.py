#!/usr/bin/env python3
"""Beat grid, onsets and loudness of a music track, for placing cuts and hits on the music.

Works for any pipeline: it needs the audio (or a video with an audio track), ffmpeg on the PATH and numpy.
It decodes the file to mono 44.1 kHz, measures spectral flux (full band, and under 150 Hz for the kick),
finds the tempo and phase as the comb over the whole track that lands on the most onset energy (80 to 180 BPM),
snaps each grid beat to the strongest onset within 40 ms, and picks the downbeat as the phase of four with the most kick.

    python3 styles/tools/beats.py music.wav                 # summary on stderr, JSON on stdout
    python3 styles/tools/beats.py music.mp3 --fps 30        # frame numbers at the film's fps (default 24)
    python3 styles/tools/beats.py final.mp4 > beats.json    # a finished film's own track
    python3 styles/tools/beats.py music.wav --bpm 130      # search only within 4 BPM of the tempo you know

JSON: {duration, fps, bpm, period, phase, beats: [{t, f, n, bar_pos, strength, low}],
       onsets: [{t, f, strength, low}], loudness: [{t, db}] (per 0.25 s)}
strength and low are the flux at the beat, normalised to the track's 95th percentile; bar_pos 0 is the downbeat.
The detector assumes a steady 4/4 grid: for a rubato score (the storybook styles) read the onsets, not the grid.
Run it on the music alone, trimmed to the film's segment: a voice-over on top misleads the tempo (the Stoker mix reads
81 BPM where its music file reads the true 130), and a grid from the whole track has the wrong phase for a film that
starts the track mid-way.

Adapted from tools/python/beats.py in makevoid/motion-graphics-music-video-skill
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

RATE = 44100
HOP = 256
N_FFT = 2048


def decode_mono(path):
    """Any audio or video file to mono float32 at RATE, through ffmpeg."""
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    y = np.frombuffer(raw, dtype=np.float32)
    if len(y) < N_FFT * 4:
        raise SystemExit(f"{path}: no audio, or too short to analyse")
    return y


def flux(mag, lo, hi):
    band = np.log1p(100 * mag[lo:hi])
    d = np.diff(band, axis=1, prepend=band[:, :1])
    return np.maximum(d, 0).sum(axis=0)


def norm(x):
    x = x - np.median(x)
    return np.clip(x / (np.percentile(x, 95) + 1e-9), 0, None)


def analyse(y, fps, bpm_hint=None):
    win = np.hanning(N_FFT).astype(np.float32)
    n = 1 + (len(y) - N_FFT) // HOP
    frames = np.lib.stride_tricks.as_strided(y, shape=(n, N_FFT), strides=(y.strides[0] * HOP, y.strides[0]))
    mag = np.abs(np.fft.rfft(frames * win, axis=1)).T
    freqs = np.fft.rfftfreq(N_FFT, 1.0 / RATE)
    t = (np.arange(n) * HOP + N_FFT / 2) / RATE

    full = norm(flux(mag, 1, len(freqs)))
    low = norm(flux(mag, 1, int(np.searchsorted(freqs, 150))))
    env = full + low
    frame_rate = RATE / HOP

    # Tempo and phase: the comb (period, offset) over the whole track that lands on the most onset energy,
    # coarse then fine. Autocorrelation was about 0.4 percent off, a beat and a half of drift over 140 s.
    def comb(period, ph):
        idx = np.round((np.arange(ph, t[-1], period) - t[0]) * frame_rate).astype(int)
        idx = idx[(idx >= 0) & (idx < len(env))]
        return env[idx].mean()

    def best(bpms, n_phase):
        cands = []
        for bpm in bpms:
            p = 60 / bpm
            phs = np.linspace(0, p, n_phase, endpoint=False)
            scores = [comb(p, ph) for ph in phs]
            k = int(np.argmax(scores))
            cands.append((scores[k], p, phs[k]))
        return max(cands)

    # With a known tempo (--bpm) the coarse search stays within 4 BPM of it: on a short excerpt the open search can
    # lock onto a related tempo (97.5 for a 130 BPM track, a 3:4 comb) and move by a whole tempo when the excerpt shifts 35 ms.
    coarse = np.arange(bpm_hint - 4, bpm_hint + 4, 0.25) if bpm_hint else np.arange(80, 180, 0.25)
    _, period, _ = best(coarse, 48)
    _, period, phase = best(np.arange(60 / period - 0.3, 60 / period + 0.3, 0.02), 128)
    grid = np.arange(phase, t[-1], period)

    # Snap every grid beat to the strongest onset within 40 ms (small tempo drift).
    beats = []
    for i, bt in enumerate(grid):
        k = int(round((bt - t[0]) * frame_rate))
        lo_k, hi_k = max(k - 6, 0), min(k + 7, len(env))
        if lo_k >= hi_k:
            continue
        j = lo_k + int(np.argmax(env[lo_k:hi_k]))
        beats.append({"t": round(float(t[j]), 3), "n": i, "strength": round(float(full[j]), 2), "low": round(float(low[j]), 2)})

    # Downbeat: the phase of four with the most kick energy.
    bar = int(np.argmax([sum(b["low"] for b in beats if b["n"] % 4 == p) for p in range(4)]))
    for b in beats:
        b["bar_pos"] = (b["n"] - bar) % 4
        b["f"] = int(round(b["t"] * fps))

    # Onsets: local maxima of the envelope above threshold, at least 90 ms apart.
    onsets = []
    thr = 1.2
    last = -1.0
    for j in range(1, len(env) - 1):
        if env[j] >= thr and env[j] >= env[j - 1] and env[j] > env[j + 1] and t[j] - last >= 0.09:
            onsets.append({"t": round(float(t[j]), 3), "f": int(round(t[j] * fps)),
                           "strength": round(float(full[j]), 2), "low": round(float(low[j]), 2)})
            last = t[j]

    step = int(0.25 * RATE)
    loud = []
    for i in range(0, len(y) - step + 1, step):
        rms = float(np.sqrt(np.mean(y[i:i + step] ** 2)) + 1e-9)
        loud.append({"t": round(i / RATE, 2), "db": round(20 * np.log10(rms), 1)})

    return {"duration": round(len(y) / RATE, 3), "fps": fps, "bpm": round(60 / period, 2),
            "period": round(period, 4), "phase": round(float(phase), 4),
            "beats": beats, "onsets": onsets, "loudness": loud}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("file", help="audio file, or a video with an audio track")
    ap.add_argument("--fps", type=float, default=24.0, help="film frame rate for the frame numbers (default 24)")
    ap.add_argument("--bpm", type=float, default=None, help="the tempo you know; the search then stays within 4 BPM of it")
    a = ap.parse_args()
    d = analyse(decode_mono(a.file), a.fps, a.bpm)
    downs = [b["t"] for b in d["beats"] if b["bar_pos"] == 0]
    print(f"{a.file}: {d['duration']:.2f} s, {d['bpm']} BPM, {len(d['beats'])} beats, {len(downs)} downbeats "
          f"(first at {downs[0] if downs else '-'} s), {len(d['onsets'])} onsets", file=sys.stderr)
    json.dump(d, sys.stdout)
    print()


if __name__ == "__main__":
    main()
