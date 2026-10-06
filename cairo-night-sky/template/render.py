"""Frame renderer: pycairo frames piped as raw video to ffmpeg. Engine only; the story is in config.py and world.py.

usage (run from anywhere; paths are relative to this file):
  python3 render.py test 4.5 9.6 ...   one PNG per time into test/
  python3 render.py sheet [step]       contact sheet, one frame every `step` s (default 2) -> test/sheet.jpg
  python3 render.py clip 20 22         short silent clip of that time range -> out/clip.mp4
  python3 render.py full               whole video, silent -> out/silent.mp4
  python3 render.py mux                out/silent.mp4 + out/audio.wav -> out/<NAME>.mp4
"""
import os
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import cairo
import numpy as np

import config as C
import pen
import world

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
TEST = HERE / "test"
W, H, FPS, NF = C.W, C.H, C.FPS, pen.NF

CAM = None
GRAIN = None


def init():
    global CAM, GRAIN
    CAM = pen.build_cams(C.CAMERA_KEYS, C.CAMERA_FOLLOW, C.CAMERA_BOOST, C.CAM_SMOOTH, world.spark_pos)
    GRAIN = pen.paper_grain()


def render(i):
    """Frame i as raw BGR bytes (cairo ARGB32 is B, G, R, A in memory on little-endian machines)."""
    t = i / FPS
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    c = cairo.Context(surface)
    c.set_source_rgb(*C.PAPER); c.paint()
    cx, cy, z = CAM[min(i, NF - 1)]
    pen.sky_wash(c, t, C.SKY)
    c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-cx, -cy)
    world.draw_world(pen.D(c, z, t, cx, cy), t)
    c.identity_matrix()
    E = C.END
    if E and t > E["t_in"]:
        d2 = pen.D(c, 1.0, t, W / 2, H / 2)
        a = pen.sm(pen.prog(t, E["t_in"], E["fade"])) * (1 - pen.sm(pen.prog(t, E["t_out"], E["fade"])))
        d2.text(E["text"], E["x"], E["y"], E["size"], a=a, center=True)
    arr = np.ndarray((H, W, 4), np.uint8, buffer=surface.get_data())
    out = ((arr[:, :, :3].astype(np.uint16) * GRAIN) >> 8).astype(np.uint8)
    return out.tobytes()


def to_image(raw):
    from PIL import Image
    return Image.fromarray(np.frombuffer(raw, np.uint8).reshape(H, W, 3)[:, :, ::-1])   # BGR -> RGB


def encode(frames, path):
    OUT.mkdir(exist_ok=True)
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", str(C.CRF),
                           "-preset", "medium", str(path)], stdin=subprocess.PIPE)
    with Pool(C.WORKERS or os.cpu_count(), initializer=init) as pool:
        for n, fr in enumerate(pool.imap(render, frames, chunksize=4)):
            ff.stdin.write(fr)
            if n % 120 == 0: print("frame", n, "/", len(frames), flush=True)
    ff.stdin.close()
    if ff.wait() != 0: sys.exit("ffmpeg failed")
    print("wrote", path)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"
    args = sys.argv[2:]
    if mode == "test":
        init()
        TEST.mkdir(exist_ok=True)
        for tt in args:
            p = TEST / f"t{float(tt):05.1f}.png"
            to_image(render(int(round(float(tt) * FPS)))).save(p)
            print("wrote", p)
    elif mode == "sheet":
        from PIL import Image
        step = float(args[0]) if args else 2.0
        times = [k * step for k in range(int(C.DUR / step))]
        TEST.mkdir(exist_ok=True)
        cols, th = 6, 320
        rows = (len(times) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (th + 4), rows * (th + 4)), "white")
        with Pool(C.WORKERS or os.cpu_count(), initializer=init) as pool:
            raws = pool.map(render, [int(round(t * FPS)) for t in times])
        for k, raw in enumerate(raws):
            sheet.paste(to_image(raw).resize((th, th), Image.LANCZOS), ((k % cols) * (th + 4), (k // cols) * (th + 4)))
        sheet.save(TEST / "sheet.jpg", quality=85)
        print("wrote", TEST / "sheet.jpg", f"({len(times)} frames, every {step} s)")
    elif mode == "clip":
        a, b = float(args[0]), float(args[1])
        encode(list(range(int(a * FPS), min(NF, int(b * FPS)))), OUT / "clip.mp4")
    elif mode == "full":
        encode(list(range(NF)), OUT / "silent.mp4")
    elif mode == "mux":
        src, aud, dst = OUT / "silent.mp4", OUT / "audio.wav", OUT / f"{C.NAME}.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-i", str(aud), "-c:v", "copy",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", str(dst)], check=True)
        print("wrote", dst)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
