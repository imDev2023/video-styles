"""Score and soundtrack: a gentle C-major lullaby plus a cue for every on-screen event.

  python3 music.py        -> out/score_piano.mid, out/score_rest.mid, out/stem_*.wav, out/audio.wav  (about 30 s)

PER-VIDEO: compose() and fx_cues() at the top of this file. The score data (chords, melody, tempo)
is in config.py; compose() turns it into parts and adds the event cues timed from config's TIMELINE.
ENGINE (below the line): MIDI writer, stem render (piano through sfizz + Salamander Grand,
everything else through fluidsynth + MuseScore_General), pedalboard effects, mix and master.

Channels are raw 0-based MIDI channels; 9 is General MIDI drums, so never give an instrument channel 9.
"""
import os
import random
import struct
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

import config as C
from config import (DUR, BEAT, PENT, SPARK_POP, MUSH_T, LEDGE_LAND, OWL_WAKE, SLIDE_T0, SLIDE_T1, WHEEL_TICKS,
                    MACHINE_ON, MACHINE_OFF, STAR_T0, STAR_DT, STAR_FLY, FINALE, MOON_T)

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

# channel -> General MIDI program (0-based)
CELESTA, MUSICBOX, PIANO, STRINGS, HARP, PIZZ, FLUTE, BASSOON, TREM, DRUMS = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
PROGRAMS = {CELESTA: 8, MUSICBOX: 10, PIANO: 0, STRINGS: 48, HARP: 46, PIZZ: 45, FLUTE: 73, BASSOON: 70, TREM: 44}
# GM drum notes used: 36 kick (soft heartbeat), 76 hi wood block (bounces), 77 low wood block, 81 open triangle

BAR = BEAT * 4
NBARS = int(DUR / BAR) + 1
TPS = 480 / BEAT              # ticks per second at 480 ppq
rnd = random.Random(C.HUMANIZE_SEED)
events = []                   # (tick, order, bytes)


def add(ch, t, dur, note, vel, human=True):
    """One note. human=True adds +-8 ms and +-4 velocity of seeded jitter; cues use human=False to stay on the frame."""
    if human:
        t += rnd.uniform(-0.008, 0.008); vel += rnd.randint(-4, 4)
    t = max(0.0, t)
    vel = max(1, min(127, int(vel)))
    on = int(t * TPS); off = int((t + max(0.05, dur)) * TPS)
    events.append((on, 1, bytes([0x90 | ch, note, vel])))
    events.append((off, 0, bytes([0x80 | ch, note, 0])))


def bar_t(k): return k * BAR


# =============================================================================================
# PER-VIDEO: the score
# =============================================================================================
def compose():
    chords = [C.PROGRESSION[min(k, len(C.PROGRESSION) - 1)] for k in range(NBARS)]
    CH, ROOT, ARP = C.CHORD_VOICES, C.CHORD_ROOTS, C.CHORD_ARPS
    climax, (b0, b1) = C.CLIMAX_BAR, C.BUILD_BARS

    # strings pad, swelling bar by bar, a step louder at the climax
    for k, c in enumerate(chords):
        vel = 38 + min(30, k * 3) + (14 if k >= climax else 0)
        for n in CH[c]:
            add(STRINGS, bar_t(k), BAR + 0.15, n, vel)

    # music box opening: slow arpeggio over the first two bars
    for k in (0, 1):
        for j, n in enumerate(ARP[chords[k]] + (ARP[chords[k]][0] + 12,)):
            add(MUSICBOX, bar_t(k) + j * BEAT, 1.2, n + 12, 58)

    # soft piano arpeggios in eighths, busier in the build, octave-lifted at the climax
    for k in range(2, NBARS):
        c = chords[k]; a = ARP[c]
        pat = (0, 1, 2, 1, 0, 1, 2, 1) if not (b0 <= k <= b1) else (0, 1, 2, 1, 2, 1, 2, 1)
        for j, idx in enumerate(pat):
            v = 38 + (8 if k >= climax else 0) + (6 if j % 4 == 0 else 0)
            add(PIANO, bar_t(k) + j * BEAT / 2, BEAT, a[idx] + (12 if k >= climax and j % 2 else 0), v)

    # pizzicato bass
    for k in range(3, NBARS - 1):
        r = ROOT[chords[k]]
        add(PIZZ, bar_t(k), 0.4, r, 72)
        add(PIZZ, bar_t(k) + 2 * BEAT, 0.4, r + (7 if k % 2 else 0), 60)
        if b0 <= k <= b1: add(PIZZ, bar_t(k) + 3 * BEAT, 0.3, r + 12, 56)

    # celesta melody; flute and low piano double it from the climax
    for k, notes in C.MELODY.items():
        for off, n, d in notes:
            v = 78 if k >= climax else 70
            add(CELESTA, bar_t(k) + off * BEAT, d * BEAT * 0.95, n, v)
            if k >= climax:
                add(FLUTE, bar_t(k) + off * BEAT, d * BEAT, n - 12, 52)
                add(PIANO, bar_t(k) + off * BEAT, d * BEAT, n - 24, 52)

    # machine section: trembling strings build and a soft heartbeat that speeds up
    t = MACHINE_ON
    while t < 30.0:
        r = (t - MACHINE_ON) / 5.1
        for n in (48, 55, 60):
            add(TREM, t, 0.2, n, int(30 + 40 * r), human=False)
        t += 0.25
    t = MACHINE_ON
    while t < MACHINE_OFF:
        add(DRUMS, t, 0.1, 36, int(36 + 28 * (t - MACHINE_ON) / 4.6))
        t += 0.625 if t < 27 else 0.3125
    for j in range(16):                                                      # celesta pulses while it works
        add(CELESTA, 25.0 + j * BEAT / 2, 0.3, 84 if j % 2 else 79, 46 + j)

    # event cues, one per thing that happens on screen
    for j, n in enumerate((67, 71, 74, 79, 83, 86, 91, 95)):                 # spark pops in: harp glissando
        add(HARP, SPARK_POP + j * 0.045, 1.2, n, 70, human=False)
    add(CELESTA, SPARK_POP + 0.05, 1.0, 96, 80, human=False)
    for i, t0 in enumerate(MUSH_T):                                          # mushroom bounces
        add(DRUMS, t0, 0.1, 76, 90, human=False)
        add(CELESTA, t0, 0.5, (76, 79, 84)[i] + 12, 88, human=False)
        add(PIZZ, t0, 0.3, (52, 55, 60)[i], 96, human=False)
    add(DRUMS, LEDGE_LAND, 0.1, 77, 80, human=False)                         # lands on the branch: tok
    add(BASSOON, OWL_WAKE + 0.2, 0.40, 55, 90, human=False)                  # owl: hoo
    add(BASSOON, OWL_WAKE + 0.65, 0.55, 52, 90, human=False)
    for j in range(14):                                                      # slide: rising harp run
        add(HARP, SLIDE_T0 + j * 0.26, 0.6, PENT[j % 9] - 12 + 12 * (j // 9), 62 + j)
    for j in range(9):                                                       # wheel ratchet ticks
        add(MUSICBOX, WHEEL_TICKS + j * 0.16, 0.3, 84 + (j % 3) * 2, 62)
    for i in range(9):                                                       # each star: launch + landing
        t0 = STAR_T0 + STAR_DT * i
        add(HARP, t0, 1.2, PENT[i] - 12, 84, human=False)
        add(CELESTA, t0 + STAR_FLY, 1.5, PENT[(i * 2) % 9] + 12, 82, human=False)
    for j, n in enumerate((60, 64, 67, 72, 76, 79, 84, 88)):                 # moon arrives
        add(HARP, MOON_T + j * 0.09, 1.8, n, 76, human=False)
    add(DRUMS, FINALE, 1.5, 81, 70, human=False)                             # triangle: finale begins
    add(DRUMS, bar_t(18), 2.0, 81, 80, human=False)                          # final chord
    add(PIANO, bar_t(18), 3.0, 60, 70); add(PIANO, bar_t(18), 3.0, 72, 70)


def fx_cues(put, lp, sr):
    """Quiet noise effects under the score. put(signal, t0, amp); lp(dur, k) is k-sample box-filtered noise."""
    d = SLIDE_T1 - SLIDE_T0                                                  # slide whoosh
    put(lp(d, 14) * np.sin(np.pi * np.arange(int(d * sr)) / sr / d) ** 1.5, SLIDE_T0, 0.9)
    d = MACHINE_OFF - MACHINE_ON; q = np.arange(int(d * sr)) / sr           # machine rumble with a 55 Hz hum
    put((lp(d, 40) * 3 + np.sin(2 * np.pi * 55 * q) * 0.4) * np.minimum(1, q / 0.5) * np.minimum(1, (d - q) / 1.0), MACHINE_ON, 0.10)
    for k in range(9):                                                       # wheel ticks
        put(lp(0.04, 6) * np.exp(-np.arange(int(0.04 * sr)) / sr * 90), WHEEL_TICKS + k * 0.16, 1.4)


# =============================================================================================
# ENGINE
# =============================================================================================
def write_midi(path, only=None, skip=None):
    """Type-0 MIDI of the events, keeping channels in `only` or dropping channels in `skip`."""
    keep = lambda ch: (only is None or ch in only) and (skip is None or ch not in skip)
    ev = []
    for ch, p in PROGRAMS.items():
        if keep(ch): ev.append((0, -1, bytes([0xC0 | ch, p])))
    ev.append((0, -2, bytes([0xFF, 0x51, 0x03]) + int(round(BEAT * 1e6)).to_bytes(3, "big")))
    ev += [e for e in events if keep(e[2][0] & 0x0F)]
    ev.sort(key=lambda e: (e[0], e[1]))       # note-offs (order 0) before note-ons (1) on the same tick
    data = b""; last = 0
    for tick, _, b in ev:
        dt = tick - last; last = tick
        vlq = [dt & 0x7F]; dt >>= 7
        while dt: vlq.append((dt & 0x7F) | 0x80); dt >>= 7
        data += bytes(reversed(vlq)) + b
    data += b"\x00\xFF\x2F\x00"
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, 480) + b"MTrk" + struct.pack(">I", len(data)) + data)


def render_stems(mid_p, mid_r, raw_p, raw_r):
    sfizz = C.SFIZZ_DIR / "bin" / "sfizz_render"
    for f in (C.REST_SF, C.PIANO_SFZ, sfizz):
        if not f.exists(): sys.exit(f"missing {f}\nSee template/README.md (soundfonts), or run music_synth.py for a no-soundfont score.")
    subprocess.run(["fluidsynth", "-ni", "-g", "1.0", "-r", "44100", "-T", "wav", "-F", str(raw_r), str(C.REST_SF), str(mid_r)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run([str(sfizz), "--sfz", str(C.PIANO_SFZ), "--midi", str(mid_p), "--wav", str(raw_p), "-s", "44100", "-q", "3"],
                   check=True, env=dict(os.environ, DYLD_LIBRARY_PATH=str(C.SFIZZ_DIR / "lib")),
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def load(path):
    with wave.open(str(path)) as w:
        sr_ = w.getframerate(); ch_ = w.getnchannels()
        a_ = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float64) / 32768
    a_ = a_.reshape(-1, ch_)
    return (np.repeat(a_, 2, 1) if ch_ == 1 else a_), sr_


def main():
    from pedalboard import Pedalboard, Reverb, Compressor, Limiter, HighpassFilter

    compose()
    OUT.mkdir(exist_ok=True)
    mid_p, mid_r = OUT / "score_piano.mid", OUT / "score_rest.mid"
    raw_p, raw_r = OUT / "stem_piano.wav", OUT / "stem_rest.wav"
    write_midi(mid_p, only={PIANO}); write_midi(mid_r, skip={PIANO})
    render_stems(mid_p, mid_r, raw_p, raw_r)

    rest, sr = load(raw_r); pno, sr2 = load(raw_p)
    assert sr == sr2 == 44100
    N = int(DUR * sr)
    fit = lambda a_: np.pad(a_, ((0, max(0, N - len(a_))), (0, 0)))[:N]
    M = C.MIX
    rest = fit(rest); pno = fit(pno)
    # Salamander comes out of sfizz near -15 dB peak, so both stems are peak-normalised before mixing.
    rest = rest / max(1e-9, np.abs(rest).max()) * M["rest_peak"]
    pno = pno / max(1e-9, np.abs(pno).max()) * M["piano_peak"]

    def fx_chain(a_, board): return board(a_.T.astype(np.float32), sr).T.astype(np.float64)
    pno = fx_chain(pno, Pedalboard([HighpassFilter(60), Reverb(room_size=0.55, damping=0.55, wet_level=0.20, dry_level=0.85, width=1.0)]))
    rest = fx_chain(rest, Pedalboard([HighpassFilter(45), Compressor(threshold_db=-20, ratio=2.0, attack_ms=15, release_ms=200),
                                      Reverb(room_size=0.62, damping=0.45, wet_level=0.24, dry_level=0.80, width=1.0)]))
    x = rest + pno * M["piano_gain"]
    tt = np.arange(N) / sr

    nrng = np.random.RandomState(5)
    def lp(dur, k): return np.convolve(nrng.normal(0, 1, int(dur * sr)), np.ones(k) / k, mode="same")
    fx = np.zeros(N)
    def put(sig, t0, amp):
        i = int(t0 * sr); sig = sig[:N - i]; fx[i:i + len(sig)] += sig * amp
    fx_cues(put, lp, sr)
    x = x + fx[:, None] * M["fx_gain"]

    env = np.minimum(1, tt / M["fade_in"]) * np.minimum(1, (DUR - tt) / M["fade_out"])
    x = x * env[:, None]
    # pedalboard's Limiter is a compressor with make-up gain, not a transparent peak limiter,
    # so the final level is set by the peak normalise after it.
    x = fx_chain(x, Pedalboard([Compressor(threshold_db=-14, ratio=1.8, attack_ms=25, release_ms=250), Limiter(threshold_db=-1.0)]))
    x = x / max(1e-9, np.abs(x).max()) * M["master_peak"]
    with wave.open(str(OUT / "audio.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    print("wrote", OUT / "audio.wav", len(x) / sr, "s; notes:", len(events) // 2)


if __name__ == "__main__":
    main()
