"""Find candidate images and make numbered contact sheets to pick from by eye.

python3 tools/search_images.py openverse dog cat frog "neon sign"   # CC0 StockSnap photos, 16 per query
python3 tools/search_images.py picsum                              # the whole Lorem Picsum library (about 1000 Unsplash photos)

Writes .search/<source>.json (every candidate with its URL and credit) and .search/<source>_N.jpg sheets.
Pick by number, then copy the chosen entries into config.images.<set>.items.
Leave out anything carrying someone else's brand or character (logos on shoes, cartoon characters, signage you can read).
"""
import json
import subprocess
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / ".search"
OUT.mkdir(exist_ok=True)
UA = "Mozilla/5.0"


def get(url):
    return subprocess.run(["curl", "-sfL", "-A", UA, url], capture_output=True, check=True).stdout


src = sys.argv[1]
items = []
if src == "openverse":
    for q in sys.argv[2:]:
        u = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({"q": q, "source": "stocksnap", "license": "cc0", "page_size": 16})
        for r in json.loads(get(u))["results"]:
            items.append({"url": r["url"], "credit": r.get("creator"), "page": r.get("foreign_landing_url"), "license": "CC0", "q": q})
elif src == "picsum":
    for p in range(1, 12):
        for v in json.loads(get(f"https://picsum.photos/v2/list?page={p}&limit=100")):
            items.append({"picsum": int(v["id"]), "credit": v["author"], "page": v["url"], "license": "Unsplash License"})
(OUT / f"{src}.json").write_text(json.dumps(items, indent=1))

thumbs = OUT / "thumbs"
thumbs.mkdir(exist_ok=True)


def thumb(i_it):
    i, it = i_it
    p = thumbs / f"{src}_{i}.jpg"
    if not p.exists():
        url = f"https://picsum.photos/id/{it['picsum']}/240/240" if "picsum" in it else it["url"]
        p.write_bytes(get(url))
    return p


with ThreadPoolExecutor(16) as ex:
    paths = list(ex.map(thumb, enumerate(items)))
f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 14)
C, T = 12, 150
for s in range(0, len(items), 144):
    chunk = list(enumerate(paths))[s : s + 144]
    im = Image.new("RGB", (C * T, ((len(chunk) + C - 1) // C) * T), "white")
    d = ImageDraw.Draw(im)
    for k, (i, p) in enumerate(chunk):
        x, y = (k % C) * T, (k // C) * T
        im.paste(ImageOps.fit(Image.open(p).convert("RGB"), (T - 4, T - 4)), (x + 2, y + 2))
        d.rectangle([x + 2, y + 2, x + 40, y + 20], fill="black")
        d.text((x + 4, y + 3), str(i), fill="yellow", font=f)
    im.save(OUT / f"{src}_{s // 144}.jpg", quality=82)
print(len(items), "candidates; sheets in", OUT)
