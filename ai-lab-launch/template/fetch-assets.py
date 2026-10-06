"""Download every third-party asset listed in config.json into assets/ (none of these are committed).

python3 fetch-assets.py            # font, music, SFX and image sets
python3 fetch-assets.py images     # only one group: font | music | sfx | images

- font:   brand.font.url -> brand.font.file (SIL Open Font License).
- music:  music.url -> music.file. Pixabay's CDN accepts curl with a browser user agent; its pages need a headed
          browser (Cloudflare). Then run tools/find_drop.py to measure the real drop.
- sfx:    sfx.<event>.url (Mixkit) -> assets/sfx/<event>.<ext>, with each file's peak time in assets/sfx/SFX.json.
- images: images.<set>.items -> assets/img/<set>/NNN.jpg, square-cropped to images.<set>.size,
          with credits in assets/img/manifest.json. Items are {"url": ...} (StockSnap CC0 via Openverse) or
          {"picsum": id} (Unsplash photos served by Lorem Picsum at any size; unsplash.com blocks headless browsers).
"""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / "config.json").read_text())
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153 Safari/537.36"


def curl(url, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["curl", "-sfL", "-A", UA, "-o", str(out), url], check=True)


def font():
    f = CFG["brand"]["font"]
    curl(f["url"], HERE / f["file"])
    print("font:", f["file"])


def music():
    m = CFG["music"]
    curl(m["url"], HERE / m["file"])
    print("music:", m["file"], "- now run: python3 tools/find_drop.py")


def sfx():
    import librosa
    import numpy as np
    out = {}
    for name, s in CFG["sfx"].items():
        ext = s["url"].rsplit(".", 1)[-1]
        p = HERE / "assets/sfx" / f"{name}.{ext}"
        curl(s["url"], p)
        y, sr = librosa.load(p, sr=None, mono=True)
        out[name] = {"file": p.name, "duration": round(len(y) / sr, 3), "peak": round(float(np.argmax(np.abs(y))) / sr, 3),
                     "title": s.get("title", ""), "mixkit_id": s.get("mixkit_id"), "url": s["url"], "license": "Mixkit Sound Effects Free License"}
        print(f"sfx: {name:12s} {out[name]['duration']:5.2f} s, peak at {out[name]['peak']:.3f} s")
    (HERE / "assets/sfx/SFX.json").write_text(json.dumps(out, indent=1))


def images():
    from PIL import Image, ImageOps
    man = {}
    for name, spec in CFG["images"].items():
        size, items = spec["size"], spec["items"]
        folder = HERE / "assets/img" / name
        folder.mkdir(parents=True, exist_ok=True)

        def one(i_item):
            i, it = i_item
            out = folder / f"{i:03d}.jpg"
            url = f"https://picsum.photos/id/{it['picsum']}/{size}/{size}" if "picsum" in it else it["url"]
            raw = folder / f".{i:03d}.src"
            curl(url, raw)
            im = Image.open(raw).convert("RGB")
            ImageOps.fit(im, (size, size), Image.LANCZOS, centering=(0.5, 0.45)).save(out, quality=90)
            raw.unlink()
            return {"file": f"img/{name}/{i:03d}.jpg", "src": it.get("page", url), "creator": it.get("credit", ""), "license": it.get("license", "")}

        with ThreadPoolExecutor(12) as ex:
            man[name] = list(ex.map(one, enumerate(items)))
        print(f"images: {name:8s} {len(items)} at {size} px")
    (HERE / "assets/img/manifest.json").write_text(json.dumps(man, indent=1))


if __name__ == "__main__":
    groups = sys.argv[1:] or ["font", "music", "sfx", "images"]
    for g in groups:
        {"font": font, "music": music, "sfx": sfx, "images": images}[g]()
