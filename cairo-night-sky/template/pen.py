"""The pencil-and-crayon engine. Nothing in this file is specific to one video.

- math and shape helpers (Bezier curves, ellipses, stars, gears, rounded rects)
- D, the pen: boiling pencil outlines, crayon hatching that colours a shape in,
  flat paper fills, dots and handwritten text
- small reusable props: faces, grass tufts, flowers
- the camera (keyframes + Gaussian smoothing), paper grain and the night-sky wash

All drawing happens in world coordinates; D divides line widths and jitter by the
camera zoom, so strokes keep the same thickness on screen at every zoom level.
"""
import math

import cairo
import numpy as np

from config import W, H, FPS, DUR, PAPER, INK, FONT

NF = int(DUR * FPS)


# ---------------------------------------------------------------- math helpers
def fract(x): return x - math.floor(x)
def hsh(a, b=0, c=0): return fract(math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453)
def cl(x, a=0.0, b=1.0): return max(a, min(b, x))
def sm(x): x = cl(x); return x * x * (3 - 2 * x)
def lerp(a, b, u): return a + (b - a) * u
def lerp3(a, b, u): return (lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u))
def prog(t, t0, d): return cl((t - t0) / d)


def sq(t, t0):
    """Damped squash wobble that starts at t0 (1 -> 0 over about 1.4 s)."""
    dt = t - t0
    if dt < 0 or dt > 1.4: return 0.0
    return math.exp(-5 * dt) * math.cos(14 * dt)


def bez_pt(b, u):
    p0, p1, p2, p3 = b; v = 1 - u
    return (v**3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u**3 * p3[0],
            v**3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u**3 * p3[1])


def bez_tan(b, u):
    p0, p1, p2, p3 = b; v = 1 - u
    return (3 * v * v * (p1[0] - p0[0]) + 6 * v * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]),
            3 * v * v * (p1[1] - p0[1]) + 6 * v * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1]))


def bez(b, n=24): return [bez_pt(b, i / n) for i in range(n + 1)]


def bez_at_x(b, x):
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if bez_pt(b, mid)[0] < x: lo = mid
        else: hi = mid
    return bez_pt(b, lo)


def ell(cx, cy, rx, ry, a0=0.0, a1=2 * math.pi, n=28, rot=0.0):
    out = []
    cr, sr = math.cos(rot), math.sin(rot)
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + x * cr - y * sr, cy + x * sr + y * cr))
    return out


def xf(pts, tx=0.0, ty=0.0, rot=0.0, sx=1.0, sy=1.0, ox=0.0, oy=0.0):
    """Scale and rotate points about (ox, oy), then translate."""
    cr, sr = math.cos(rot), math.sin(rot)
    out = []
    for x, y in pts:
        x = (x - ox) * sx; y = (y - oy) * sy
        out.append((ox + tx + x * cr - y * sr, oy + ty + x * sr + y * cr))
    return out


def rrect(x, y, w, h, r=14, n=5):
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -math.pi / 2), (x + w - r, y + h - r, 0),
                       (x + r, y + h - r, math.pi / 2), (x + r, y + r, math.pi)):
        pts += ell(cx, cy, r, r, a0, a0 + math.pi / 2, n)
    return pts


def star_pts(cx, cy, ro, ri, rot=0.0):
    return [(cx + (ro if i % 2 == 0 else ri) * math.cos(rot - math.pi / 2 + i * math.pi / 5),
             cy + (ro if i % 2 == 0 else ri) * math.sin(rot - math.pi / 2 + i * math.pi / 5)) for i in range(10)]


def gear(cx, cy, ro, ri, n, rot):
    pts = []; step = 2 * math.pi / n
    for i in range(n):
        a = rot + i * step
        for off, r in ((-0.22, ri), (-0.13, ro), (0.13, ro), (0.22, ri)):
            pts.append((cx + r * math.cos(a + off * step * 2), cy + r * math.sin(a + off * step * 2)))
    return pts


def surf(b, u, R=15.0):
    """Point R units above a Bezier track (on the side facing up), where a ball of radius R rolls."""
    x, y = bez_pt(b, u); tx, ty = bez_tan(b, u)
    L = math.hypot(tx, ty) or 1
    nx, ny = ty / L, -tx / L
    if ny > 0: nx, ny = -nx, -ny
    return (x + nx * R, y + ny * R)


def arc(P, Q, Hh):
    """Parabolic hop from P to Q that peaks Hh units above the straight line."""
    return lambda u: (lerp(P[0], Q[0], u), lerp(P[1], Q[1], u) - 4 * Hh * u * (1 - u))


# ---------------------------------------------------------------- the pen
class D:
    """One frame's pen. z is camera zoom, t the time, (cx, cy) the camera centre in world units."""

    def __init__(s, c, z, t, cx, cy):
        s.c, s.z, s.t = c, z, t
        s.b = int(t * 8) % 3          # boil: 3 outline poses cycling at 8 poses per second
        s.x0, s.x1 = cx - W / 2 / z, cx + W / 2 / z
        s.y0, s.y1 = cy - H / 2 / z, cy + H / 2 / z

    def vis(s, pts, m=40):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        mm = m / s.z
        return not (max(xs) < s.x0 - mm or min(xs) > s.x1 + mm or max(ys) < s.y0 - mm or min(ys) > s.y1 + mm)

    def line(s, pts, seed=1, closed=False, w=1.8, col=INK, a=0.9, jit=1.1):
        """Pencil line: resampled every 13 screen px, jittered per boil pose, drawn twice
        (a full stroke plus a thinner, fainter offset stroke) so it reads as graphite."""
        if len(pts) < 2 or not s.vis(pts): return
        z, c = s.z, s.c
        step = 13 / z
        src = list(pts) + ([pts[0]] if closed else [])
        P = []
        for i in range(len(src) - 1):
            x0, y0 = src[i]; x1, y1 = src[i + 1]
            k = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
            for j in range(k): P.append((lerp(x0, x1, j / k), lerp(y0, y1, j / k)))
        P.append(src[-1])
        n = len(P)
        c.set_line_join(cairo.LINE_JOIN_ROUND); c.set_line_cap(cairo.LINE_CAP_ROUND)
        for wf, af, bo in ((1.0, a, 0), (0.55, a * 0.5, 5)):
            c.set_line_width(w * wf / z); c.set_source_rgba(col[0], col[1], col[2], af)
            for i, (x, y) in enumerate(P):
                idx = 0 if (closed and i == n - 1) else i   # closed shapes: last point reuses first jitter, no gap
                jx = (hsh(seed, idx, s.b + bo) - 0.5) * 2 * jit / z
                jy = (hsh(seed + 0.5, idx, s.b + bo) - 0.5) * 2 * jit / z
                if i == 0: c.move_to(x + jx, y + jy)
                else: c.line_to(x + jx, y + jy)
            c.stroke()

    def solid(s, pts, col=PAPER, a=1.0):
        """Flat fill, usually paper colour, so a shape hides what is drawn behind it."""
        if len(pts) < 3 or not s.vis(pts): return
        c = s.c
        c.new_path()
        for i, (x, y) in enumerate(pts):
            (c.move_to if i == 0 else c.line_to)(x, y)
        c.close_path()
        c.set_source_rgba(col[0], col[1], col[2], a); c.fill()

    def dot(s, x, y, r, col, a=1.0):
        c = s.c
        c.new_path(); c.arc(x, y, r, 0, 2 * math.pi)
        c.set_source_rgba(col[0], col[1], col[2], a); c.fill()

    def fill(s, pts, col, p, seed=1, w=3.0, sp=4.3, ang=None):
        """Crayon hatching clipped to the shape. p in 0..1 is how much is coloured in:
        strokes appear in a seeded random order, and a second, cross-hatch layer starts at p = 0.55.
        Hatching does not boil (fixed seed), only outlines do."""
        if p <= 0 or len(pts) < 3 or not s.vis(pts): return
        c, z = s.c, s.z
        xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
        cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
        Dg = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) + 4 / z
        c.save()
        c.new_path()
        for i, (x, y) in enumerate(pts):
            (c.move_to if i == 0 else c.line_to)(x, y)
        c.close_path(); c.clip()
        A = ang if ang is not None else 0.45 + hsh(seed) * 0.9
        c.set_line_cap(cairo.LINE_CAP_ROUND)
        c.set_line_width(w / z)
        for li, (a, spf) in enumerate(((A, 1.0), (A + 1.0, 1.5))):
            if li == 1 and p < 0.55: break
            pp = p if li == 0 else (p - 0.55) / 0.45
            dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
            N = max(2, int(Dg / (sp * spf / z)))
            order = sorted(range(N), key=lambda k: hsh(seed, k, 3 + li))
            for k in order[:int(pp * N + 0.999)]:
                o = -Dg / 2 + (k + 0.5) * Dg / N
                sh = 0.84 + 0.32 * hsh(seed, k, 9)
                c.set_source_rgba(min(1, col[0] * sh), min(1, col[1] * sh), min(1, col[2] * sh), 0.8)
                bx, by = cx + nx * o, cy + ny * o
                wob = (hsh(seed, k, 11) - 0.5) * 2.4 / z
                c.move_to(bx - dx * Dg / 2, by - dy * Dg / 2)
                c.line_to(bx + nx * wob, by + ny * wob)
                c.line_to(bx + dx * Dg / 2, by + dy * Dg / 2)
                c.stroke()
        c.restore()

    def text(s, txt, x, y, size, col=INK, a=1.0, reveal=1.0, center=False):
        """Handwritten text. reveal 0..1 wipes it in left to right. Size is in world units."""
        c = s.c
        c.select_font_face(FONT, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        c.set_font_size(size)
        w = c.text_extents(txt)[4]
        if reveal <= 0: return w      # the clip box has 4 px padding, so 0 would still show a sliver
        if center: x -= w / 2
        c.save()
        c.rectangle(x - 4, y - size * 1.2, w * reveal + 8, size * 1.8); c.clip()
        c.move_to(x, y); c.set_source_rgba(col[0], col[1], col[2], a); c.show_text(txt)
        c.restore()
        return w


# ---------------------------------------------------------------- reusable props
def face(d, x, y, s, seed, col=INK, happy=True, closed=False):
    """Two eyes (dots, or sleepy arcs when closed) and a smile."""
    for ex in (-7 * s, 7 * s):
        if closed: d.line(ell(x + ex, y, 3.5 * s, 2.5 * s, 0, math.pi, 6), seed + ex, w=1.5, col=col)
        else: d.dot(x + ex, y, 1.8 * s, col)
    if happy: d.line(ell(x, y + 6 * s, 5 * s, 3.5 * s, 0.1, math.pi - 0.1, 8), seed + 3, w=1.5, col=col)


def grass(d, x, y, seed, p):
    """Five-blade tuft whose pencil turns green as p goes 0 -> 1."""
    col = (lerp(INK[0], 0.15, p), lerp(INK[1], 0.55, p), lerp(INK[2], 0.2, p))
    for k in range(5):
        dx = (k - 2) * 7
        d.line(bez(((x + dx * 0.4, y), (x + dx * 0.6, y - 14), (x + dx, y - 24), (x + dx * 1.5, y - 30 - 5 * hsh(seed, k))), 6),
               seed + k, w=1.6, col=col)


def flower(d, x, y, h, seed, col, tp, leaf=(0.22, 0.66, 0.27), centre=(1.0, 0.83, 0.17)):
    """Swaying six-petal flower of height h, coloured in from time tp."""
    t = d.t
    p = prog(t, tp, 1.2)
    sway = math.sin(t * 1.5 + seed) * 3
    top = (x + sway, y - h)
    d.line(bez(((x, y), (x + 4, y - h * 0.4), (x - 4, y - h * 0.7), top), 8), seed, w=1.8, col=lerp3(INK, (0.2, 0.55, 0.22), p))
    lf = ell(x + 9, y - h * 0.35, 11, 4, 0, 2 * math.pi, 10, rot=-0.5)
    d.fill(lf, leaf, p, seed + 1, w=2.2, sp=3); d.line(lf, seed + 2, closed=True, w=1.3)
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        pet = ell(top[0] + 12 * math.cos(a), top[1] + 12 * math.sin(a), 9, 5, 0, 2 * math.pi, 10, rot=a)
        d.fill(pet, col, p, seed + 3 + k, w=2.2, sp=3); d.line(pet, seed + 10 + k, closed=True, w=1.3)
    c0 = ell(top[0], top[1], 6, 6, n=10)
    d.fill(c0, centre, p, seed + 20, w=2.2, sp=3); d.line(c0, seed + 21, closed=True, w=1.3)


def draw_title(d, t, T):
    """World-space title, each line wiped in after the previous one."""
    p = prog(t, T["t0"], T["dur"])
    n = len(T["lines"])
    for k, txt in enumerate(T["lines"]):
        d.text(txt, T["x"], T["y"] + k * T["gap"], T["size"], reveal=cl(p * n - k), center=True)


# ---------------------------------------------------------------- camera
def build_cams(keys, follow, boost, smooth, spark_pos):
    """Per-frame (cx, cy, zoom). keys: (t, x, y, zoom). follow: (t0, t1, step, zoom) spans
    where keys are added on the spark. boost: zoom factor for keys before boost['until']."""
    keys = list(keys)
    for t0, t1, step, zoom in follow:
        tt = t0 + step
        while tt < t1:
            p = spark_pos(tt); keys.append((tt, p[0], p[1], zoom)); tt += step
    keys.sort(key=lambda k: k[0])
    keys = [(k[0], k[1], k[2], k[3] * (boost["factor"] if k[0] < boost["until"] else 1.0)) for k in keys]
    ts = np.array([k[0] for k in keys])
    arr = np.zeros((NF, 3))
    for j in range(3):
        arr[:, j] = np.interp(np.arange(NF) / FPS, ts, [k[j + 1] for k in keys])
    sigma = smooth * FPS
    ker = np.exp(-0.5 * (np.arange(-int(3 * sigma), int(3 * sigma) + 1) / sigma) ** 2)
    ker /= ker.sum()
    pad = len(ker) // 2
    for j in range(3):
        p = np.pad(arr[:, j], pad, mode="edge")
        arr[:, j] = np.convolve(p, ker, mode="valid")
    return arr


# ---------------------------------------------------------------- paper and sky
def paper_grain(layers=((6, 0.010), (14, 0.006)), vignette=0.035, seed=3):
    """Multiplier (H, W, 1) uint16 in 0.9..1.0 * 256: very low-frequency smooth blotches plus a faint vignette.
    Keep it this soft: per-pixel or blocky noise turned into crawling grain after H.264."""
    from PIL import Image
    rng = np.random.RandomState(seed)
    g = np.zeros((H, W))
    for cells, amp in layers:
        small = rng.normal(0, 1, (cells, cells)).astype(np.float32)
        g += np.asarray(Image.fromarray(small).resize((W, H), Image.BICUBIC), dtype=np.float64) * amp
    yy, xx = np.mgrid[0:H, 0:W]
    vig = 1 - vignette * (((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / (W / 2) ** 2) ** 1.2
    return (np.clip((1 - np.abs(g)) * vig, 0.9, 1.0) * 256).astype(np.uint16)[:, :, None]


def sky_wash(c, t, S):
    """Night falling: diagonal crayon strokes fill the top band of the screen above a wavy edge.
    Screen space, drawn before the camera transform, so it does not move with the world."""
    p = prog(t, S["t0"], S["dur"])
    if p <= 0: return
    c.save()
    c.new_path(); c.move_to(0, 0); c.line_to(W, 0)
    for i in range(W, -1, -20):
        c.line_to(i, S["base"] + 28 * math.sin(i / 70) + 14 * math.sin(i / 23))
    c.close_path(); c.clip()
    a = S["angle"]
    dx, dy = math.cos(a), math.sin(a); nx, ny = -dy, dx
    Dg = math.hypot(W, 400) + 50; N = int(Dg / S["spacing"])
    order = sorted(range(N), key=lambda k: hsh(7, k, 1))
    c.set_line_width(S["width"]); c.set_line_cap(cairo.LINE_CAP_ROUND)
    col = S["color"]
    for k in order[:int(p * N)]:
        o = -Dg / 2 + (k + 0.5) * Dg / N
        sh = 0.85 + 0.3 * hsh(7, k, 2)
        c.set_source_rgba(col[0] * sh, col[1] * sh, col[2] * sh, S["alpha"])
        bx, by = W / 2 + nx * o, 160 + ny * o
        c.move_to(bx - dx * Dg / 2, by - dy * Dg / 2); c.line_to(bx + dx * Dg / 2, by + dy * Dg / 2)
        c.stroke()
    c.restore()
