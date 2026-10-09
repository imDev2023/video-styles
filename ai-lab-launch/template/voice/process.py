"""Tighten and level the chosen take, then build the word table.

python3 process.py [takes/take2.mp3]   # default: config.voice.take

1. Pauses over 0.28 s are cut down to 0.2 s.
2. Each phrase (the speech between pauses) is moved 85% of the way to the median
   phrase level. Gain changes only inside the pauses, with a short ramp there.
3. The read is cut at every pause of 100 ms or more, each chunk is transcribed on its
   own with Whisper, and the chunk's first word is pinned to the chunk's measured onset.
   A single Whisper pass over the whole read puts words up to half a second late.

Writes voice.wav (44.1 kHz mono) and words.json.
"""
import json
from pathlib import Path
import re
import sys
import warnings

warnings.filterwarnings("ignore")
import librosa
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

from tts import LINES

HERE = Path(__file__).resolve().parent

SR = 44100
HOP = 0.005  # 5 ms analysis frames
MAX_PAUSE, NEW_PAUSE = 0.28, 0.20
CHUNK_PAUSE = 0.10
LEVEL_PULL = 0.85


def frame_db(y):
    n = int(HOP * SR)
    frames = y[: len(y) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt(np.mean(frames**2, axis=1)) + 1e-9)


def speech_mask(y):
    db = frame_db(y)
    # Threshold relative to the loud part of the read, so breaths and room tone count as pause.
    thr = np.percentile(db, 95) - 38
    on = db > thr
    # Close gaps shorter than 30 ms (stop consonants) and drop blips shorter than 25 ms.
    on = close_gaps(on, int(0.03 / HOP))
    on = ~close_gaps(~on, int(0.025 / HOP))
    return on


def close_gaps(mask, k):
    m = mask.copy()
    i = 0
    while i < len(m):
        if not m[i]:
            j = i
            while j < len(m) and not m[j]:
                j += 1
            if 0 < i and j < len(m) and j - i < k:
                m[i:j] = True
            i = j
        else:
            i += 1
    return m


def runs(mask):
    """(start, end) frame index pairs of True runs."""
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]:
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out


def tighten(y):
    """Cut pauses over MAX_PAUSE down to NEW_PAUSE; return audio and phrase spans in it."""
    n = int(HOP * SR)
    sp = [(a * n, b * n) for a, b in runs(speech_mask(y))]
    lead = int(0.12 * SR)  # a little air before the first word and after the last
    pieces, spans, pos = [], [], 0

    def add(seg):
        nonlocal pos
        pieces.append(seg)
        pos += len(seg)

    add(y[max(0, sp[0][0] - lead) : sp[0][0]])
    for k, (a, b) in enumerate(sp):
        spans.append([pos / SR, (pos + b - a) / SR])
        add(y[a:b])
        if k + 1 < len(sp):
            nxt = sp[k + 1][0]
            if (nxt - b) / SR <= MAX_PAUSE:
                add(y[b:nxt])
            else:
                h = int(NEW_PAUSE / 2 * SR)
                add(y[b : b + h])
                add(y[nxt - h : nxt])
    add(y[sp[-1][1] : sp[-1][1] + lead])
    # Speech runs closer than 0.15 s belong to one phrase.
    phrases = [spans[0]]
    for a, b in spans[1:]:
        if a - phrases[-1][1] < 0.15:
            phrases[-1][1] = b
        else:
            phrases.append([a, b])
    return np.concatenate(pieces), phrases


def level(y, phrases):
    def rms_db(a, b):
        s = y[int(a * SR) : int(b * SR)]
        return 20 * np.log10(np.sqrt(np.mean(s**2)) + 1e-9)

    lv = np.array([rms_db(a, b) for a, b in phrases])
    med = np.median(lv)
    gains = LEVEL_PULL * (med - lv)
    env = np.zeros(len(y))
    env[:] = gains[0]
    for k in range(1, len(phrases)):
        # Ramp from the previous phrase's gain to this one's inside the pause between them.
        p_end, n_start = phrases[k - 1][1], phrases[k][0]
        a, b = int(p_end * SR), int(n_start * SR)
        env[a:b] = np.linspace(gains[k - 1], gains[k], max(b - a, 1))[: b - a]
        env[b:] = gains[k]
    return y * 10 ** (env / 20), lv, gains


def chunk_onsets(y):
    on = speech_mask(y)
    n = int(HOP * SR)
    sp = runs(on)
    chunks = [[sp[0][0] * n, sp[0][1] * n]]
    for a, b in sp[1:]:
        if (a * n - chunks[-1][1]) / SR >= CHUNK_PAUSE:
            chunks.append([a * n, b * n])
        else:
            chunks[-1][1] = b * n
    return chunks


def words_by_chunk(y, model):
    out = []
    for a, b in chunk_onsets(y):
        pad = int(0.08 * SR)
        seg = y[max(0, a - pad) : b + pad]
        segs, _ = model.transcribe(seg.astype(np.float32) if SR == 16000 else librosa.resample(seg, orig_sr=SR, target_sr=16000), word_timestamps=True, language="en", condition_on_previous_text=False)
        ws = [w for s in segs for w in s.words]
        if not ws:
            continue
        # Pin the chunk's first word to the measured onset and shift the rest with it.
        shift = a / SR - (max(0, a - pad) / SR + ws[0].start)
        for w in ws:
            out.append({"w": w.word.strip(), "t0": round(max(0, a - pad) / SR + w.start + shift, 3), "t1": round(max(0, a - pad) / SR + w.end + shift, 3)})
        out[-len(ws)]["t0"] = round(a / SR, 3)
    # Keep words monotonic: a word never ends after the next one starts.
    for i in range(len(out) - 1):
        out[i]["t1"] = min(out[i]["t1"], out[i + 1]["t0"])
    return out


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else str(HERE.parent / json.loads((HERE.parent / "config.json").read_text())["voice"]["take"])
    y, _ = librosa.load(src, sr=SR, mono=True)
    tight, phrases = tighten(y)
    leveled, lv, gains = level(tight, phrases)
    peak = np.max(np.abs(leveled))
    leveled = leveled * (10 ** (-3 / 20) / peak)  # peak at -3 dBFS before the mix
    sf.write(HERE / "voice.wav", leveled, SR, subtype="PCM_24")
    model = WhisperModel("small.en", device="cpu", compute_type="int8")
    words = words_by_chunk(leveled, model)
    # Whisper supplies the timings; the text comes from the script, which Whisper mishears ("BUN" for burn).
    script = [(tok, li) for li, l in enumerate(LINES) for tok in re.sub(r"\[[a-z ]+\]", "", l).split() if tok != "-"]
    # Whisper splits compounds ("launch pad" for launchpad): merge adjacent Whisper words whose letters add up to the script token.
    letters = lambda s: re.sub(r"[^a-z]", "", s.lower())
    merged, i = [], 0
    for tok, li in script:
        if i >= len(words):
            break
        w = dict(words[i]); i += 1
        while letters(w["w"]) != letters(tok) and i < len(words) and letters(tok).startswith(letters(w["w"]) + letters(words[i]["w"])[:1]) and len(letters(w["w"])) < len(letters(tok)):
            w["w"] += words[i]["w"]; w["t1"] = words[i]["t1"]; i += 1
        merged.append(w)
    if len(script) != len(merged) or i != len(words):
        raise SystemExit(f"Whisper found {len(words)} words ({len(merged)} after merging compounds), the script has {len(script)}: check the take")
    words = merged
    for w, (tok, li) in zip(words, script):
        w["w"], w["line"] = tok, li
    json.dump({"duration": round(len(leveled) / SR, 3), "phrases": [[round(a, 3), round(b, 3)] for a, b in phrases], "words": words}, open(HERE / "words.json", "w"), indent=1)
    print(f"raw {len(y) / SR:.2f}s -> tight {len(tight) / SR:.2f}s, {len(phrases)} phrases")
    for (a, b), l, g in zip(phrases, lv, gains):
        print(f"  phrase {a:6.2f}-{b:6.2f}  {l:6.1f} dB  gain {g:+.1f} dB")
    print(" ".join(f"{w['w']}@{w['t0']:.2f}" for w in words))
