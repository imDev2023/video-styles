"""Mix the film: voice, music with a 3-band sidechain duck, one SFX per event, loudness to -14 LUFS.

python3 mix.py           # writes mix_raw.wav and report.json next to this file

- The song starts so its drop (75.72 s) lands on "Launch", the first word of the [Verb] line.
- Music is split at 300 Hz and 4 kHz. Under the voice the bands duck by 30% (lows), 85% (mids) and 55% (air),
  with 50 ms look-ahead, 0.3 s hold and 0.5 s release. Then each phrase's mid duck is moved until the voice sits
  9 dB over the music between 300 Hz and 4 kHz.
- Each SFX is placed by its measured peak and trimmed around it.
- The music fades on a dB curve under the end card.
"""
import json
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CFG = json.load(open(ROOT / "config.json"))
MX = CFG["mix"]
SR = 48000
V0 = CFG["render"]["voice_lead_in"]   # the voice starts here on the film clock
DROP_IN_SONG = CFG["music"]["drop"]   # measured attack of the drop, in the song
DEPTH = MX["duck"]
TARGET_DB = MX["target_db"]
LOOKAHEAD, HOLD, ATTACK, RELEASE = MX["lookahead"], MX["hold"], MX["attack"], MX["release"]

ev = json.load(open(ROOT / "out/events.json"))
T, DUR = ev["T"], ev["duration"]
N = int(round(DUR * SR))
words = json.load(open(ROOT / "voice/words.json"))


def load(path, mono=False):
    y, _ = librosa.load(path, sr=SR, mono=mono)
    return y if y.ndim > 1 or mono else np.stack([y, y])


def band(x, lo=None, hi=None):
    if lo and hi:
        sos = butter(4, [lo, hi], btype="band", fs=SR, output="sos")
    elif lo:
        sos = butter(4, lo, btype="high", fs=SR, output="sos")
    else:
        sos = butter(4, hi, btype="low", fs=SR, output="sos")
    return sosfiltfilt(sos, x, axis=-1)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


# ---------------------------------------------------------------- voice
voice = np.zeros(N)
v = load(ROOT / "voice/voice.wav", mono=True)
i0 = int(V0 * SR)
voice[i0 : i0 + len(v)] = v[: N - i0]

# ---------------------------------------------------------------- music
song = load(ROOT / CFG["music"]["file"])
s0 = int(round((DROP_IN_SONG - T["drop"]) * SR))
music = song[:, s0 : s0 + N]
music = music * 10 ** (CFG["music"]["gain_db"] / 20)   # tune so a typical phrase lands near the 85% mid duck
fade_in = np.clip(np.arange(N) / (0.25 * SR), 0, 1)
music = music * fade_in

low = band(music, hi=300)
air = band(music, lo=4000)
mid = music - low - air          # exact reconstruction: low + mid + air == music

# Sidechain: voice activity with look-ahead and hold, smoothed with attack and release.
hop = int(0.005 * SR)
frames = voice[: N // hop * hop].reshape(-1, hop)
act = 20 * np.log10(np.sqrt(np.mean(frames**2, axis=1)) + 1e-12) > (rms_db(voice[voice != 0]) - 22)
la, hold = int(LOOKAHEAD / 0.005), int(HOLD / 0.005)
gate = np.zeros_like(act, dtype=float)
for k in np.flatnonzero(act):
    gate[max(0, k - la) : k + hold] = 1.0
env = np.zeros_like(gate)
a_up, a_dn = np.exp(-0.005 / ATTACK), np.exp(-0.005 / RELEASE)
for k in range(1, len(gate)):
    coef = a_up if gate[k] > env[k - 1] else a_dn
    env[k] = coef * env[k - 1] + (1 - coef) * gate[k]
env = np.repeat(env, hop)
env = np.pad(env, (0, N - len(env)), mode="edge")

# Per-phrase mid duck: solve the mid gain that puts the voice 9 dB over the music in 300 Hz to 4 kHz.
phrases = [(a + V0, b + V0) for a, b in words["phrases"]]
vb = band(voice, lo=300, hi=4000)
mb = band(music.mean(axis=0), lo=300, hi=4000)
low_g, air_g = 1 - DEPTH["low"] * env, 1 - DEPTH["air"] * env
mid_floor = np.full(N, 1 - DEPTH["mid"])
bed_floor = np.ones(N)
MID_MIN = 10 ** (-30 / 20)
report = []
for k, (a, b) in enumerate(phrases):
    ia, ib = int(a * SR), int(b * SR)
    seg_env = env[ia:ib]
    # music in the speech band after the fixed low and air ducks (they leak a little into 300 Hz to 4 kHz)
    m_fixed = band((low * low_g + air * air_g)[:, ia:ib].mean(axis=0), lo=300, hi=4000)
    m_mid = band(mid[:, ia:ib].mean(axis=0), lo=300, hi=4000)
    want = rms_db(vb[ia:ib]) - TARGET_DB
    # find the mid gain g (under full duck) that hits the target, by bisection on dB
    lo_g, hi_g = MID_MIN, 1.0
    for _ in range(40):
        g = (lo_g + hi_g) / 2
        mg = 1 - (1 - g) * seg_env
        got = rms_db(m_fixed + m_mid * mg)
        lo_g, hi_g = (g, hi_g) if got < want else (lo_g, g)
    # A soft phrase can still be short with the mids at their limit: duck the whole bed a little more.
    extra = 1.0
    got = rms_db(m_fixed + m_mid * (1 - (1 - g) * seg_env))
    if got > want:
        extra = max(10 ** (-9 / 20), 10 ** ((want - got) / 20))
    nxt = int(phrases[k + 1][0] * SR) if k + 1 < len(phrases) else N
    mid_floor[ia:nxt] = g
    bed_floor[ia:nxt] = extra
    if k == 0:
        mid_floor[:ia] = g
        bed_floor[:ia] = extra
mid_g = 1 - (1 - mid_floor) * env
bed_g = 1 - (1 - bed_floor) * env
ducked = (low * low_g + mid * mid_g + air * air_g) * bed_g

# The music fades on a dB curve under the end card: 0 dB to -60 dB, linear in dB.
fa, fb = T["logo"] + 0.6, DUR
t = np.arange(N) / SR
db = np.where(t < fa, 0, -60 * np.clip((t - fa) / (fb - fa), 0, 1))
ducked = ducked * 10 ** (db / 20) * (t < fb - 1 / SR)

# ---------------------------------------------------------------- SFX
SFX = json.load(open(ROOT / "assets/sfx/SFX.json"))
# (gain dB, seconds kept before the peak, seconds kept after it)
PLAN = {k: tuple(v) for k, v in MX["sfx_plan"].items()}
rng = np.random.default_rng(5)
sfx = np.zeros((2, N))
cache = {}
for e in ev["events"]:
    k = "riser" if e["k"] == "riser_peak" else e["k"]
    meta = SFX[k]
    if k not in cache:
        x = load(ROOT / "assets/sfx" / meta["file"])
        x = x / (np.max(np.abs(x)) + 1e-12)
        gain, pre, post = PLAN[k]
        p = int(meta["peak"] * SR)
        a, b = max(0, p - int(pre * SR)), min(x.shape[1], p + int(post * SR))
        x = x[:, a:b].copy()
        ramp_in, ramp_out = min(int(0.004 * SR), p - a), min(int(0.04 * SR), (b - p) // 2)
        if ramp_in > 0:
            x[:, :ramp_in] *= np.linspace(0, 1, ramp_in)
        x[:, -ramp_out:] *= np.linspace(1, 0, ramp_out) ** 2
        cache[k] = (x * 10 ** (gain / 20), p - a)
    x, peak_at = cache[k]
    jitter = 10 ** (rng.uniform(-2, 1) / 20) if k in ("key", "click") else 1
    start = int(round(e["t"] * SR)) - peak_at
    a, b = max(0, start), min(N, start + x.shape[1])
    if b > a:
        sfx[:, a:b] += x[:, a - start : b - start] * jitter

# ---------------------------------------------------------------- mix and report
mix = ducked + sfx + voice[None, :]
mix = mix / max(1.0, np.max(np.abs(mix)) / 0.98)
sf.write(HERE / "mix_raw.wav", mix.T, SR, subtype="PCM_24")

rows = []
music_mid_final = band(ducked.mean(axis=0), lo=300, hi=4000)
for k, (a, b) in enumerate(phrases):
    ia, ib = int(a * SR), int(b * SR)
    text = " ".join(w["w"] for w in words["words"] if a - 0.05 <= w["t0"] + V0 < b)
    rows.append({"phrase": k + 1, "t0": round(a, 2), "t1": round(b, 2), "text": text,
                 "voice_over_music_db": round(rms_db(vb[ia:ib]) - rms_db(music_mid_final[ia:ib]), 2),
                 "mid_duck_db": round(20 * np.log10(mid_floor[ia]), 1), "bed_extra_db": round(20 * np.log10(bed_floor[ia]), 1)})
json.dump(rows, open(HERE / "report.json", "w"), indent=1)
for r in rows:
    print(f"{r['phrase']:2d} {r['t0']:6.2f}-{r['t1']:6.2f}  {r['voice_over_music_db']:+5.1f} dB  (mids {r['mid_duck_db']:+5.1f}, bed {r['bed_extra_db']:+4.1f} dB)  {r['text']}")
