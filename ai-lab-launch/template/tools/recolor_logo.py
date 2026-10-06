"""Turn an app icon on a dark tile into a transparent logo for a white page.

python3 tools/recolor_logo.py <icon.png> <bg> <fg1> <fg2> <new1> <new2> [out=assets/logo.png]
example (Stoker: white S and a periwinkle slash on #121826, drawn as an ink S and a cobalt slash):
python3 tools/recolor_logo.py icon.png 121826 ffffff 7086ff 121826 2b45ff

Each pixel is solved as bg + a1*(fg1-bg) + a2*(fg2-bg) by least squares, so anti-aliased edges keep their
coverage as alpha, then repainted with the new colours.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)
src = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
bg, f1, f2, n1, n2 = (hexrgb(a.lstrip("#")) for a in sys.argv[2:7])
out = Path(sys.argv[7]) if len(sys.argv) > 7 else Path(__file__).resolve().parents[1] / "assets/logo.png"
ab = np.einsum("ij,hwj->hwi", np.linalg.pinv(np.stack([f1 - bg, f2 - bg], 1)), src - bg).clip(0, 1)
a1, a2 = ab[..., 0], ab[..., 1]
alpha = (a1 + a2).clip(0, 1)
rgb = (a1[..., None] * n1 + a2[..., None] * n2) / np.maximum(alpha, 1e-6)[..., None]
im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
im = im.crop(im.getbbox())
out.parent.mkdir(parents=True, exist_ok=True)
im.save(out)
print(out, im.size)
