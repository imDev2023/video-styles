"""Stress and level of words in a voice file: python3 measure.py <file> [words...]"""
import sys, warnings
warnings.filterwarnings("ignore")
import librosa, numpy as np
from faster_whisper import WhisperModel

M = WhisperModel("small.en", device="cpu", compute_type="int8")


def report(path, focus):
    y, sr = librosa.load(path, sr=22050)
    segs, _ = M.transcribe(path, word_timestamps=True)
    ws = [w for s in segs for w in s.words]
    rms = lambda a, b: 20 * np.log10(np.sqrt(np.mean(y[int(a * sr):int(b * sr)] ** 2)) + 1e-9)
    f0, _, _ = librosa.pyin(y, fmin=120, fmax=500, sr=sr)
    mp = np.nanmedian(f0)
    def pitch(a, b):
        fr = f0[int(a * sr / 512):int(b * sr / 512)]; fr = fr[~np.isnan(fr)]
        return np.median(fr) / mp if len(fr) else 0
    med = np.median([rms(w.start, w.end) for w in ws])
    text = " ".join(w.word.strip() for w in ws)
    parts = [f"{w.word.strip(' .,')}@{w.start:.2f} {rms(w.start, w.end) - med:+.1f}dB p{pitch(w.start, w.end):.2f}"
             for w in ws if w.word.strip(" .,").lower() in focus]
    print(f"{path}: {len(y) / sr:.2f}s, median word {med:.1f} dBFS, f0 {mp:.0f} Hz | {text}\n    " + " | ".join(parts))


if __name__ == "__main__":
    focus = [a.lower() for a in sys.argv[2:]] or ["more"]
    for f in sys.argv[1].split(","):
        report(f, focus)
