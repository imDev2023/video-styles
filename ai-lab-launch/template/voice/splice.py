"""Splice a re-recorded line into a take, so one changed line keeps the rest of the approved read.

python3 splice.py <take> <n> <new line audio> <out.wav>

n is the line's number in config.voice.lines (1-based), which already holds the new words. The old line is found in
the take as the speech between the last word of line n-1 and the first word of line n+1: Whisper's words are aligned
to the script's, and the lines either side are unchanged, so the old line's own words are never needed. Its speech
runs are replaced by the new take's speech, the pauses either side are kept as they were, and each join is a 10 ms
equal-power crossfade inside a pause, so no click. process.py then tightens and levels the result like any take.
"""
import difflib
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import librosa
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

from process import HOP, SR, runs, speech_mask

HERE = Path(__file__).resolve().parent
LINES = json.loads((HERE.parent / "config.json").read_text())["voice"]["lines"]
MARGIN, FADE = 0.03, 0.01  # cut this far into the pauses; crossfade this long at each join

letters = lambda s: re.sub(r"[^a-z]", "", s.lower())


def tokens(line):
    return [letters(t) for t in re.sub(r"\[[a-z ]+\]", "", line).split() if letters(t)]


def speech_spans(y):
    n = int(HOP * SR)
    return [(a * n / SR, b * n / SR) for a, b in runs(speech_mask(y))]


def join(a, b):
    """a then b, overlapped by FADE with an equal-power crossfade."""
    k = int(FADE * SR)
    ramp = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    return np.concatenate([a[:-k], a[-k:] * (1 - ramp) + b[:k] * ramp, b[k:]])


if __name__ == "__main__":
    take, n, new, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    if not 1 < n < len(LINES):
        raise SystemExit("splice.py finds a line by its neighbours, so it cannot take the first or the last line")
    y, _ = librosa.load(take, sr=SR, mono=True)
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(librosa.resample(y, orig_sr=SR, target_sr=16000), word_timestamps=True, language="en", condition_on_previous_text=False)
    heard = [(letters(w.word), w.start, w.end) for s in segs for w in s.words if letters(w.word)]
    # the script as the take was read: every line but n (the new words), whose own tokens may not match
    before = [t for line in LINES[: n - 1] for t in tokens(line)]
    after = [t for line in LINES[n:] for t in tokens(line)]
    # Whisper splits compounds ("launch pad"), so align letters, not words: each heard word's letters, then the script's
    sm = difflib.SequenceMatcher(None, [h[0] for h in heard], before + ["?"] * len(tokens(LINES[n - 1])) + after, autojunk=False)
    pairs = {j: i for blk in sm.get_matching_blocks() for i, j in zip(range(blk.a, blk.a + blk.size), range(blk.b, blk.b + blk.size))}
    last_prev, first_next = len(before) - 1, len(before) + len(tokens(LINES[n - 1]))
    if last_prev not in pairs or first_next not in pairs:
        raise SystemExit(f"could not find line {n - 1}'s last word or line {n + 1}'s first word in the take")
    t_prev, t_next = heard[pairs[last_prev]][2], heard[pairs[first_next]][1]
    # the old line: the speech runs that start after line n-1 has ended and end before line n+1 starts (Whisper's word
    # edges can be a little late, so a run counts by its middle)
    sp = speech_spans(y)
    mine = [(a, b) for a, b in sp if t_prev < (a + b) / 2 < t_next]
    first_next_run = next(a for a, b in sp if (a + b) / 2 >= t_next)
    if not mine:
        raise SystemExit(f"no speech between {t_prev:.2f} and {t_next:.2f} s")
    a, b = mine[0][0], mine[-1][1]
    prev_end = max(e for s, e in sp if e <= a + 1e-9)
    if a - prev_end < 2 * MARGIN or first_next_run - b < 2 * MARGIN:
        raise SystemExit("the pauses around the line are too short to cut in")
    z, _ = librosa.load(new, sr=SR, mono=True)
    nz = speech_spans(z)
    na, nb = nz[0][0], nz[-1][1]
    if nb > len(z) / SR - MARGIN:
        raise SystemExit(f"{new}: its speech runs to the end of the file, so its last word may be cut off")
    lo, hi = int((a - MARGIN) * SR), int((b + MARGIN) * SR)
    piece = z[max(0, int((na - MARGIN) * SR)) : int((nb + MARGIN) * SR)]
    spliced = join(join(y[:lo], piece), y[hi:])
    sf.write(out, spliced, SR, subtype="PCM_24")
    print(f"line {n}: old speech {a:.3f} to {b:.3f} s ({b - a:.2f} s, pauses {a - prev_end:.2f} s before and {first_next_run - b:.2f} s after)")
    print(f"new speech {na:.3f} to {nb:.3f} s of {Path(new).name} ({nb - na:.2f} s); {len(y) / SR:.2f} s -> {len(spliced) / SR:.2f} s -> {out}")
