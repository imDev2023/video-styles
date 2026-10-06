"""Voice takes from ElevenLabs, called directly over HTTP (no MCP). Script and voice come from ../config.json.

python3 tts.py takes            # one take per seed in config.voice.seeds, each a single read of the whole script
python3 tts.py line <n> <text>  # 4 takes of line n (1-based) for splicing, with its neighbours as context

The key is read at run time from ELEVENLABS_API_KEY in the workspace .env (two folders up from the project),
or from the ENV_FILE environment variable. Free accounts can only use premade voices: a Voice Library voice
answers 402 paid_plan_required.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
CFG = json.loads((PROJECT / "config.json").read_text())
VOICE, MODEL = CFG["voice"]["voice_id"], CFG["voice"]["model"]
LINES = CFG["voice"]["lines"]


def key():
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    env = Path(os.environ.get("ENV_FILE", PROJECT.parents[1] / ".env"))
    for line in env.read_text().splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit(f"ELEVENLABS_API_KEY missing from {env}")


def tts(text, out, seed, prev=None, nxt=None):
    payload = {"text": text, "model_id": MODEL, "seed": seed}
    if prev:
        payload["previous_text"] = prev
    if nxt:
        payload["next_text"] = nxt
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=json.dumps(payload).encode(),
        headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            out.write_bytes(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{e.code}: {e.read().decode()[:400]}")
    print("wrote", out.relative_to(PROJECT))


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "takes":
        (HERE / "takes").mkdir(exist_ok=True)
        text = " ".join(LINES)
        for i, seed in enumerate(CFG["voice"]["seeds"], 1):
            tts(text, HERE / "takes" / f"take{i}.mp3", seed)
    elif mode == "line":
        n, text = int(sys.argv[2]), sys.argv[3]
        prev, nxt = " ".join(LINES[: n - 1]) or None, " ".join(LINES[n:]) or None
        (HERE / "lines").mkdir(exist_ok=True)
        for i, seed in enumerate([101, 202, 303, 404], 1):
            tts(text, HERE / "lines" / f"line{n}_{i}.mp3", seed, prev, nxt)
