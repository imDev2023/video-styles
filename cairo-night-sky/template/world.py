"""PER-VIDEO: the world of "How the Night Got Its Stars" and the spark's path through it.

Everything in this file is story content. For a new video, replace it:
  1. the world geometry (section "world"): track curves, prop positions;
  2. SEGS, the spark's path as timed pieces (roll along a curve, hop in an arc, ride a wheel);
  3. one scene_* function per contraption, each colouring itself in with d.fill(..., prog(t, ...))
     when the spark reaches it;
  4. draw_world, which sets the paint order (later = on top).

World units: the ground line is y = 0, y grows downward (cairo), one unit is one pixel at zoom 1.
The opening hill sits near x = 0; this video's lower level (slide end, wheel, machine) sits on y = 1500.
Shared beat times come from config.py so music.py can hit them.
"""
import math

from config import (PAPER, INK, SUN_C, RED, GREEN, BROWN, BLUE, YELLOW, GREY, COPPER, CREAM, PURPLE, PINK,
                    TITLE, SIGN, OWL_SAYS, SPARK_POP, MUSH_T, LEDGE_LAND, OWL_WAKE, SLIDE_T0, SLIDE_T1,
                    WHEEL_T0, WHEEL_T1, MACHINE_ON, STAR_T0, STAR_DT, STAR_FLY, CONST_T0, CONST_DT, MOON_T)
from pen import (cl, sm, lerp, lerp3, prog, sq, hsh, bez, bez_pt, bez_tan, bez_at_x, ell, xf, rrect,
                 star_pts, gear, surf, arc, face, grass, flower, draw_title)

# ---------------------------------------------------------------- world
R = 15.0                                                        # spark radius
SL1 = ((300, -190), (400, -170), (520, -60), (640, 0))          # hill's down slope
HILL = bez(((-250, 0), (-150, -140), (100, -195), (300, -190)), 20) + bez(SL1, 14)[1:]
MUSH = [(1340, 38, 58), (1570, 52, 90), (1830, 72, 130)]        # x, cap radius, stem height
LEDGE = ((2335, -338), (2480, -336), (2650, -300), (2810, -262))  # owl's branch
SLIDE = ((2810, -70), (2200, 60), (1200, 1000), (520, 1150))    # long bunting slide down to the lower level
RAMP = ((455, 1308), (540, 1330), (700, 1420), (840, 1500))     # wheel to machine
WHEEL_C = (330, 1305)
WHEEL_R = 110
CHIMNEY = (1337, 1048)
OWL_X = 2570
OWL_Y = bez_at_x(LEDGE, OWL_X)[1]
STARS = [(900, -880), (1130, -930), (1350, -870), (1560, -800), (1600, -640), (1900, -610),
         (1880, -790), (2350, -900), (500, -760)]               # where each star lands in the sky
CONST = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 3)]  # constellation lines between stars


def mush_top(i, sy=1.0):
    x, r, h = MUSH[i]
    return (x - 6, -(h + 0.7 * r * sy) - R)


def _wheel_pos(u):
    th = -math.pi / 2 + (math.pi / 2) * sm(u)
    ox, oy = math.cos(th), math.sin(th)
    return (WHEEL_C[0] + WHEEL_R * ox - ox * 5, WHEEL_C[1] + WHEEL_R * oy - oy * 5)


def wheel_theta(t):
    return -math.pi / 2 + (math.pi / 2) * sm(prog(t, WHEEL_T0, WHEEL_T1 - WHEEL_T0)) if t < WHEEL_T1 else 0.0


# ---------------------------------------------------------------- the spark's path
# (t0, t1, fn(u)) with u = 0..1 across the piece. Pieces must touch end to end in time and space.
_A0 = surf(SL1, 1)
_RAMP_END = surf(RAMP, 1)
_CUP0 = (WHEEL_C[0], WHEEL_C[1] - WHEEL_R - 14)
SEGS = [
    (3.9, 6.4, lambda u: surf(SL1, u ** 1.7)),                                  # roll down the hill (accelerating)
    (6.4, 8.5, lambda u: (lerp(_A0[0], 1255, u), lerp(_A0[1], -R, u))),         # roll along the ground to the pebble
    (8.5, MUSH_T[0], arc((1255, -R), mush_top(0), 60)),                         # pebble -> mushroom 1
    (MUSH_T[0], MUSH_T[1], arc(mush_top(0), mush_top(1), 140)),                 # bounce
    (MUSH_T[1], MUSH_T[2], arc(mush_top(1), mush_top(2), 200)),                 # bounce
    (MUSH_T[2], LEDGE_LAND, arc(mush_top(2), surf(LEDGE, 0), 430)),             # big bounce up to the branch
    (LEDGE_LAND, 15.3, lambda u: surf(LEDGE, u ** 1.3)),                        # roll past the owl
    (15.3, SLIDE_T0, lambda u: (lerp(surf(LEDGE, 1)[0], surf(SLIDE, 0)[0], u),
                                lerp(surf(LEDGE, 1)[1], surf(SLIDE, 0)[1], u * u))),   # drop off the branch tip
    (SLIDE_T0, SLIDE_T1, lambda u: surf(SLIDE, u ** 1.2)),                      # ride the slide
    (SLIDE_T1, WHEEL_T0, arc(surf(SLIDE, 1), _CUP0, 15)),                       # hop into the top wheel cup
    (WHEEL_T0, WHEEL_T1, _wheel_pos),                                           # wheel turns a quarter
    (WHEEL_T1, 22.2, arc((WHEEL_C[0] + WHEEL_R - 5, WHEEL_C[1]), surf(RAMP, 0), 8)),
    (22.2, 23.9, lambda u: surf(RAMP, u ** 1.5)),                               # roll down the ramp
    (23.9, MACHINE_ON, lambda u: (lerp(_RAMP_END[0], 1030, u), lerp(_RAMP_END[1], 1500 - R, u))),  # into the door
]


def spark_pos(t):
    """(x, y, scale) of the spark, or None when it is not on screen."""
    if t < SPARK_POP or t >= MACHINE_ON: return None
    if t < SEGS[0][0]:
        p = surf(SL1, 0)
        return (p[0], p[1], sm((t - SPARK_POP) / 0.4))          # pop in
    for t0, t1, fn in SEGS:
        if t0 <= t < t1:
            x, y = fn((t - t0) / (t1 - t0))
            return (x, y, 1.0 if t < MACHINE_ON - 0.15 else cl((MACHINE_ON - t) / 0.15))
    p = surf(SL1, 0)
    return (p[0], p[1], 1.0)


def star_state(i, t):
    """(x, y, radius, rot, landed) for star i, or None before launch."""
    t0 = STAR_T0 + STAR_DT * i
    if t < t0: return None
    u = (t - t0) / STAR_FLY
    tx, ty = STARS[i]
    if u >= 1: return (tx, ty, 48 + 3 * math.sin(t * 3 + i), 0.15 * math.sin(t * 2 + i), True)
    e = sm(u)
    side = (hsh(i, 5) - 0.5) * 2
    x = lerp(CHIMNEY[0], tx, e) + side * 140 * math.sin(math.pi * e)
    y = lerp(CHIMNEY[1], ty, e) - 120 * math.sin(math.pi * e)
    return (x, y, lerp(22, 48, e), u * 9 * (1 if side > 0 else -1), False)


# ---------------------------------------------------------------- scenes
def scene_sun(d, t):
    sy = lerp(-330, -60, sm((t - 0.8) / 4.4))       # sun sets behind the hill
    cx = 330
    pp = prog(t, 0.4, 1.8)
    rot = t * 0.3
    for k in range(12):
        a = rot + k * math.pi / 6
        d.line([(cx + 80 * math.cos(a), sy + 80 * math.sin(a)), (cx + 108 * math.cos(a), sy + 108 * math.sin(a))],
               40 + k, w=2.2, col=lerp3(INK, (0.9, 0.55, 0.1), pp))
    disc = ell(cx, sy, 70, 70, n=30)
    d.solid(disc, (1, 0.95, 0.75))
    d.fill(disc, SUN_C, pp, 41)
    d.line(disc, 42, closed=True, w=2.2)
    face(d, cx, sy + 4, 2.4, 43, closed=True)
    for ex in (-30, 30): d.dot(cx + ex, sy + 22, 7, PINK, 0.5 * pp)
    # hill: the paper-coloured solid hides the lower half of the sun
    hill_solid = HILL + [(640, 130), (-250, 130)]
    d.solid(hill_solid)
    d.fill(HILL + [(640, 0), (-250, 0)], GREEN, prog(t, 4.6, 2.0), 51)
    d.line(HILL, 52, w=2.0)
    for gx, gs in ((-130, 1), (40, 2), (150, 3), (560, 4), (700, 5), (900, 6), (1010, 7), (1170, 8)):
        grass(d, gx, 0, gs, prog(t, 4.6 + max(0, gx) / 400, 1.5))


def scene_mush(d, t):
    # pebble
    rock = ell(1255, -9, 24, 15, 0, 2 * math.pi, 14)
    d.solid(rock); d.fill(rock, GREY, prog(t, 8.0, 0.8), 61); d.line(rock, 62, closed=True)
    for i, (x, r, h) in enumerate(MUSH):
        hit = MUSH_T[i]
        s_ = sq(t, hit) * (1.0 if i < 2 else 1.5)    # squash when the spark lands
        syc = 1 - 0.30 * s_
        w = r * 0.32
        stem = [(x - w, 0), (x - w * 0.8, -h * 0.5), (x - w * 0.7, -h + 6), (x + w * 0.7, -h + 6), (x + w * 0.8, -h * 0.5), (x + w, 0)]
        pcap = prog(t, hit - 0.1, 1.0)
        d.solid(stem); d.fill(stem, CREAM, pcap, 70 + i); d.line(stem, 71 + i, closed=True)
        face(d, x, -h * 0.45, r / 24, 72 + i, closed=(s_ < 0.1))
        cap = ell(x, -h, r, 0.7 * r, math.pi, 2 * math.pi, 18) + bez(((x + r, -h), (x + r * 0.5, -h + 0.25 * r), (x - r * 0.5, -h + 0.25 * r), (x - r, -h)), 8)
        cap = xf(cap, 0, 0, 0, 1, syc, x, -h)
        d.solid(cap); d.fill(cap, RED, pcap, 75 + i)
        if pcap > 0.7:
            for k, (dx, dy) in enumerate(((-0.5, -0.3), (0.05, -0.5), (0.5, -0.25), (-0.1, -0.15))):
                dd = xf(ell(x + dx * r, -h + dy * r * 0.7 * 1.2, r * 0.13, r * 0.13, n=10), 0, 0, 0, 1, syc, x, -h)
                d.solid(dd, (1, 0.97, 0.9), cl((pcap - 0.7) / 0.3))
        d.line(cap, 76 + i, closed=True, w=2.0)
        for gx in (x - r * 1.1, x + r * 1.0):
            grass(d, gx, 0, 80 + i, pcap)


def scene_owl(d, t):
    # stump
    stump = [(2250, 0), (2262, -160), (2252, -345), (2330, -342), (2345, -170), (2352, 0)]
    pst = prog(t, 12.3, 1.5)
    d.solid(stump); d.fill(stump, BROWN, pst, 90); d.line(stump, 91, closed=True)
    for k, bx in enumerate((2275, 2300, 2325)):
        d.line([(bx, -300 + 40 * hsh(k, 1)), (bx + 4, -60 - 40 * hsh(k, 2))], 92 + k, w=1.2, a=0.55)
    # branch
    top = bez(LEDGE, 22)
    bot = [(x + 0, y + 24 - 12 * i / 22) for i, (x, y) in enumerate(top)]
    br = top + bot[::-1]
    d.solid(br); d.fill(br, BROWN, pst, 95); d.line(br, 96, closed=True)
    d.line([(2300, -190), (2540, -292)], 97, w=1.8)
    d.line([(2300, -170), (2548, -278)], 98, w=1.4, a=0.6)
    for k in range(3):
        lf = ell(2800 + k * 20, -262 - 18 - k * 14, 22, 9, 0, 2 * math.pi, 12, rot=-0.6 + k * 0.5)
        d.fill(lf, GREEN, pst, 100 + k); d.line(lf, 103 + k, closed=True, w=1.5)
    # owl: asleep (closed eyes, floating z's) until OWL_WAKE, then a hop with a wing flap
    u = (t - OWL_WAKE) / 0.8
    hop = -46 * math.sin(math.pi * u) if 0 < u < 1 else 0.0
    cx, cy = OWL_X, OWL_Y - 46 + hop
    awake = t >= OWL_WAKE
    po = prog(t, 13.2, 1.0)
    flap = -0.9 * math.sin(math.pi * 2 * u) if 0 < u < 1 else 0.0
    wl = bez(((cx - 33, cy - 22), (cx - 52, cy - 8), (cx - 50, cy + 18), (cx - 30, cy + 34)), 8)
    wr = bez(((cx + 33, cy - 22), (cx + 52, cy - 8), (cx + 50, cy + 18), (cx + 30, cy + 34)), 8)
    wl += bez(((cx - 30, cy + 34), (cx - 40, cy + 10), (cx - 40, cy - 8), (cx - 33, cy - 22)), 8)
    wr += bez(((cx + 30, cy + 34), (cx + 40, cy + 10), (cx + 40, cy - 8), (cx + 33, cy - 22)), 8)
    wl = xf(wl, 0, 0, flap, 1, 1, cx - 33, cy - 22); wr = xf(wr, 0, 0, -flap, 1, 1, cx + 33, cy - 22)
    d.fill(wl, (0.48, 0.30, 0.18), po, 124, w=2.4); d.fill(wr, (0.48, 0.30, 0.18), po, 125, w=2.4)
    body = ell(cx, cy, 35, 46, n=26)
    d.solid(body); d.fill(body, (0.66, 0.44, 0.26), po, 110)
    for k, (bx, by) in enumerate(((-12, 14), (0, 18), (12, 14), (-6, 28), (6, 28))):
        d.line(ell(cx + bx, cy + by, 7, 5, 0.1, math.pi - 0.1, 6), 111 + k, w=1.3, a=0.7)
    d.line(body, 120, closed=True, w=2.0)
    for sgn in (-1, 1):
        ear = [(cx + sgn * 31, cy - 30), (cx + sgn * 27, cy - 58), (cx + sgn * 10, cy - 43)]
        d.fill(ear, (0.66, 0.44, 0.26), po, 121 + sgn); d.line(ear, 123 + sgn, closed=True, w=1.8)
    d.line(wl, 125, closed=True, w=2.0); d.line(wr, 126, closed=True, w=2.0)
    m = spark_pos(t)
    look = cl(((m[0] if m else cx) - cx) / 60, -1, 1) * 4      # pupils follow the spark
    for sgn in (-1, 1):
        ex, ey = cx + sgn * 15, cy - 14
        if awake:
            e = ell(ex, ey, 13.5, 13.5, n=14)
            d.solid(e, (1, 0.97, 0.85)); d.fill(e, YELLOW, po, 127 + sgn, w=2.0); d.line(e, 129 + sgn, closed=True, w=1.8)
            d.dot(ex + look, ey + 1, 4.2, INK)
        else:
            d.line(ell(ex, ey, 11, 7, 0.1, math.pi - 0.1, 8), 131 + sgn, w=2.0)
    d.fill([(cx - 5, cy - 4), (cx + 5, cy - 4), (cx, cy + 9)], (0.98, 0.62, 0.15), po, 133)
    d.line([(cx - 5, cy - 4), (cx + 5, cy - 4), (cx, cy + 9)], 134, closed=True, w=1.6)
    for sgn in (-1, 1):
        fy = OWL_Y
        d.line([(cx + sgn * 12, fy - 2), (cx + sgn * 12 + sgn * 6, fy)], 135 + sgn, w=1.6)
    if not awake and t > 11:
        for k, (zs, off) in enumerate(((26, 0), (36, 0.9))):
            ph = (t * 0.8 + off) % 2.0
            d.text("z" if k == 0 else "Z", cx + 36 + ph * 14, cy - 56 - ph * 34, zs, a=cl(1 - ph / 2.0) * 0.8)
    pb = sm(prog(t, OWL_WAKE + 0.2, 0.25)) * (1 - sm(prog(t, OWL_WAKE + 1.4, 0.3)))
    if pb > 0.01:
        bx, by = cx - 92, cy - 120
        bub = ell(bx, by, 64 * pb, 36 * pb, n=22)
        d.solid(bub, (1, 0.98, 0.92)); d.line(bub, 140, closed=True, w=1.8)
        tail = [(bx + 30 * pb, by + 28 * pb), (cx - 38, cy - 62), (bx + 52 * pb, by + 18 * pb)]
        d.solid(tail, (1, 0.98, 0.92)); d.line(tail, 141, w=1.8)
        d.text(OWL_SAYS, bx, by + 12 * pb, 38 * pb, a=pb, center=True)


def scene_slide(d, t):
    top = bez(SLIDE, 90)
    bot = []
    for i in range(91):
        u = i / 90; x, y = bez_pt(SLIDE, u); tx, ty = bez_tan(SLIDE, u); L = math.hypot(tx, ty)
        nx, ny = -ty / L, tx / L
        if ny < 0: nx, ny = -nx, -ny
        bot.append((x + nx * 12, y + ny * 12))
    d.line(top, 150, w=2.2); d.line(bot, 151, w=1.7)
    cols = [RED, YELLOW, BLUE, GREEN, PINK, PURPLE]
    for k in range(1, 15):                          # bunting flags colour in as the spark passes each one
        u = k / 15
        x, y = bez_pt(SLIDE, u); tx, ty = bez_tan(SLIDE, u); L = math.hypot(tx, ty)
        tx, ty = tx / L, ty / L
        nx, ny = -ty, tx
        if ny < 0: nx, ny = -nx, -ny
        sx, sy = x + nx * 12, y + ny * 12
        tri = [(sx - tx * 20, sy - ty * 20), (sx + tx * 20, sy + ty * 20), (sx + nx * 36, sy + ny * 36)]
        tp = SLIDE_T0 + (SLIDE_T1 - SLIDE_T0) * (u ** (1 / 1.2))   # inverse of the u ** 1.2 easing in SEGS
        d.fill(tri, cols[k % 6], prog(t, tp, 0.6), 160 + k, w=2.6, sp=3.2)
        d.line(tri, 180 + k, closed=True, w=1.6)


def scene_wheel(d, t):
    cx, cy = WHEEL_C
    pw = prog(t, 19.8, 1.4)
    d.line([(cx - 6, cy), (cx - 62, 1500)], 200, w=2.2); d.line([(cx + 6, cy), (cx + 62, 1500)], 201, w=2.2)
    d.line([(cx - 40, 1400), (cx + 40, 1400)], 202, w=1.6)
    th = wheel_theta(t)
    rim = ell(cx, cy, WHEEL_R, WHEEL_R, n=40)
    d.fill(rim, (0.50, 0.70, 0.92), pw * 0.35, 203)
    d.line(rim, 204, closed=True, w=2.0)
    d.line(ell(cx, cy, WHEEL_R - 12, WHEEL_R - 12, n=40), 205, closed=True, w=1.2, a=0.6)
    for k in range(4):
        phi = th + k * math.pi / 2
        ox, oy = math.cos(phi), math.sin(phi)
        d.line([(cx, cy), (cx + ox * WHEEL_R, cy + oy * WHEEL_R)], 206 + k, w=2.0)
        bc = (cx + ox * (WHEEL_R + 10), cy + oy * (WHEEL_R + 10))
        bowl = ell(bc[0], bc[1], 26, 26, phi + math.pi / 2, phi + 3 * math.pi / 2, 12)
        d.fill(bowl, COPPER, pw, 210 + k, w=2.4)
        d.line(bowl, 214 + k, closed=True, w=2.0)
    hub = ell(cx, cy, 14, 14, n=12)
    d.fill(hub, COPPER, pw, 220); d.line(hub, 221, closed=True)
    # slide end post
    d.line([(520, 1150), (520, 1500)], 222, w=1.4, a=0.5)


def scene_machine_back(d, t):
    """Chimney, drawn before the spark and smoke so they pass behind the machine front."""
    p = prog(t, 23.6, 1.5)
    ch = [(1310, 1190), (1312, 1058), (1364, 1058), (1366, 1190)]
    d.solid(ch); d.fill(ch, (0.76, 0.36, 0.30), p, 230); d.line(ch, 231, closed=True)
    rim = [(1300, 1058), (1376, 1058), (1376, 1040), (1300, 1040)]
    d.solid(rim); d.fill(rim, (0.60, 0.28, 0.25), p, 232); d.line(rim, 233, closed=True)


def shake(t):
    env = sm(prog(t, MACHINE_ON, 0.4)) * (1 - sm(prog(t, 29.0, 1.2)))
    return (math.sin(t * 47) * 2.4 * env, math.cos(t * 61) * 1.8 * env)


def scene_machine(d, t):
    ox, oy = shake(t)
    M = lambda pts: xf(pts, ox, oy)
    p = prog(t, 23.6, 1.6)
    act = max(0.0, t - MACHINE_ON)
    roof = M([(985, 1184), (1200, 1100), (1415, 1184)])
    body = M(rrect(1000, 1180, 400, 320, 18))
    d.solid(body)
    d.fill(body, (0.42, 0.66, 0.80), p, 240)
    d.line(body, 241, closed=True, w=2.2)
    d.solid(roof); d.fill(roof, (0.78, 0.30, 0.28), p, 242); d.line(roof, 243, closed=True, w=2.2)
    board = M(rrect(1060, 1198, 280, 52, 8))
    d.solid(board, (1, 0.97, 0.88)); d.fill(board, CREAM, p, 244); d.line(board, 245, closed=True)
    d.text(SIGN, 1200 + ox, 1236 + oy, 34, center=True, a=0.9)
    # porthole
    glow = prog(t, 25.1, 1.2)
    ph = M(ell(1150, 1330, 58, 58, n=30))
    d.solid(ph, (1, 0.98, 0.9)); d.fill(ph, YELLOW, glow, 246, w=3.2)
    d.line(ph, 247, closed=True, w=2.2); d.line(M(ell(1150, 1330, 67, 67, n=30)), 248, closed=True, w=1.6)
    if glow > 0:
        for k in range(8):
            a = t * 1.3 + k * math.pi / 4
            d.line(M([(1150 + 74 * math.cos(a), 1330 + 74 * math.sin(a)), (1150 + 74 * math.cos(a) + 14 * glow * math.cos(a), 1330 + 74 * math.sin(a) + 14 * glow * math.sin(a))]),
                   250 + k, w=2.0, col=(0.9, 0.6, 0.1))
    # gears
    g1 = M(gear(1295, 1405, 58, 44, 10, act * 1.4)); g2 = M(gear(1222, 1462, 38, 27, 8, -act * 2.1 + 0.2))
    d.solid(g1, (1, 0.97, 0.9)); d.fill(g1, COPPER, p, 260); d.line(g1, 261, closed=True, w=1.8)
    d.solid(g2, (1, 0.97, 0.9)); d.fill(g2, COPPER, p, 262); d.line(g2, 263, closed=True, w=1.8)
    d.line(M(ell(1295, 1405, 10, 10, n=10)), 264, closed=True, w=1.6)
    d.line(M(ell(1222, 1462, 7, 7, n=10)), 265, closed=True, w=1.6)
    # dial
    dl = M(ell(1345, 1290, 30, 30, n=20))
    d.solid(dl, (1, 0.98, 0.92)); d.line(dl, 266, closed=True, w=1.8)
    ang = -2.4 + 1.9 * sm(prog(t, MACHINE_ON, 3.0)) + 0.08 * math.sin(t * 30) * (1 if MACHINE_ON < t < 29.5 else 0)
    d.line(M([(1345, 1290), (1345 + 24 * math.cos(ang), 1290 + 24 * math.sin(ang))]), 267, w=2.2, col=RED)
    # door
    door = M(ell(1032, 1500, 34, 58, math.pi, 2 * math.pi, 14) + [(1066, 1500)])
    d.solid(door, (0.97, 0.94, 0.88)); d.fill(door, (0.33, 0.27, 0.30), p, 268, w=3.4)
    d.line(door, 269, closed=True, w=2.0)


def scene_mole(d, t):
    p = prog(t, 24.0, 1.2)
    bob = 2.0 * math.sin(t * 6) if t > MACHINE_ON else 0
    cx, cy = 1495, 1460 + bob
    ox, oy = shake(t)
    ccx, ccy = 1398 + ox, 1385 + oy
    crank = ell(ccx, ccy, 24, 24, n=16)
    d.solid(crank, PAPER); d.line(crank, 270, closed=True, w=1.8)
    phi = (t - MACHINE_ON) * 6 if t > MACHINE_ON else 0.0
    hx, hy = ccx + 24 * math.cos(phi), ccy + 24 * math.sin(phi)
    d.line([(ccx, ccy), (hx, hy)], 271, w=2.6)
    d.dot(hx, hy, 5, GREY)
    body = ell(cx, cy, 42, 40, n=24)
    d.fill(body, (0.50, 0.44, 0.47), p, 272); d.line(body, 273, closed=True, w=2.0)
    belly = ell(cx - 6, cy + 8, 24, 24, n=16)
    d.fill(belly, (0.85, 0.7, 0.6), p, 274, w=2.4)
    for sgn, (ex, ey) in enumerate(((cx - 24, cy - 14), (cx - 4, cy - 16))):
        g = ell(ex, ey, 11, 11, n=12)
        d.solid(g, (1, 1, 1)); d.fill(g, (0.7, 0.88, 0.95), p, 275 + sgn, w=2.0); d.line(g, 277 + sgn, closed=True, w=1.8)
        d.dot(ex - 1, ey + 1, 2.8, INK)
    d.line([(cx - 13, cy - 15), (cx - 15, cy - 15)], 279, w=3)
    snout = [(cx - 40, cy + 2), (cx - 62, cy + 10), (cx - 40, cy + 20)]
    d.fill(snout, PINK, p, 280); d.line(snout, 281, closed=False, w=1.8)
    d.dot(cx - 62, cy + 10, 4, (0.3, 0.2, 0.25))
    # arm: shoulder -> elbow -> handle
    sx, sy = cx - 32, cy + 6
    ex, ey = (sx + hx) / 2 + 4, (sy + hy) / 2 + 18
    d.line([(sx, sy), (ex, ey), (hx, hy)], 282, w=3.2, col=(0.4, 0.34, 0.37))
    for sgn in (-1, 1):
        d.line([(cx + sgn * 12, cy + 38), (cx + sgn * 12 + sgn * 8, 1500)], 283 + sgn, w=1.8)


def scene_smoke(d, t):
    for i in range(14):
        t0 = 25.2 + 0.45 * i
        a = t - t0
        if a < 0 or a > 2.6 or t0 > 31: continue
        x = CHIMNEY[0] + 12 * math.sin(a * 2 + i) + 20 * a
        y = 1030 - 95 * a
        r = 12 + 15 * a
        d.line(ell(x, y, r, r * 0.9, n=14), 290 + i, closed=True, w=1.5, a=(1 - a / 2.6) * 0.8, col=GREY)


FLOWERS = ((-60, 46, 500, PINK, 4.6), (95, 38, 510, YELLOW, 4.8), (610, 44, 520, PURPLE, 6.0),
           (800, 50, 530, PINK, 6.8), (1100, 40, 540, RED, 7.6), (1450, 36, 550, YELLOW, 9.5),
           (1700, 44, 560, PINK, 10.4), (1980, 52, 570, PURPLE, 11.5), (2110, 40, 580, YELLOW, 12.0),
           (260, 44, 600, PINK, 22.0), (600, 40, 610, YELLOW, 23.0), (1580, 48, 620, PURPLE, 24.0),
           (1700, 34, 630, PINK, 24.2))     # x, height, seed (>= 600 means lower level), colour, colour-in time


def scene_decor(d, t):
    for fx, fh, fs, fc, ft in FLOWERS:
        flower(d, fx, 1500 if fs >= 600 else 0, fh, fs, fc, ft)
    d.line([(-300, 0), (2420, 0)], 1, w=2.0)          # upper ground line
    d.line([(150, 1500), (1700, 1500)], 2, w=2.0)     # lower ground line
    for gx, gs in ((2200, 11), (2380, 12)):
        grass(d, gx, 0, gs, prog(t, 12.3, 1.5))
    for gx, gs in ((230, 21), (420, 22), (640, 23), (1560, 24), (1640, 25)):
        grass(d, gx, 1500, gs, prog(t, 22.0, 2.0))


def draw_spark(d, t):
    pp = spark_pos(t)
    if not pp: return
    x, y, sc = pp
    if sc >= 1:                                       # sparkle trail from the last 7 positions
        for k in range(1, 8):
            q = spark_pos(t - 0.035 * k)
            if q and q[2] >= 1:
                d.dot(q[0] + (hsh(k, d.b) - 0.5) * 4, q[1] + (hsh(k, d.b, 1) - 0.5) * 4, max(1.2, 5.5 - 0.7 * k), YELLOW, 0.55 - 0.07 * k)
    body = ell(x, y, R * sc, R * sc, n=16)
    d.solid(body, (1, 0.95, 0.6)); d.fill(body, YELLOW, 1, 77, w=2.6, sp=3)
    d.line(body, 78, closed=True, w=1.8)
    for k in range(8):
        a = t * 2.5 + k * math.pi / 4
        d.line([(x + R * sc * 1.35 * math.cos(a), y + R * sc * 1.35 * math.sin(a)),
                (x + R * sc * (1.9 + 0.35 * math.sin(t * 9 + k)) * math.cos(a), y + R * sc * (1.9 + 0.35 * math.sin(t * 9 + k)) * math.sin(a))],
               300 + k, w=1.6, col=(0.92, 0.6, 0.1))


def draw_stars(d, t):
    for i in range(len(STARS)):
        st = star_state(i, t)
        if not st: continue
        x, y, r, rot, landed = st
        pts = star_pts(x, y, r, r * 0.42, rot)
        d.solid(pts, (1, 0.96, 0.7), 0.9)
        d.fill(pts, YELLOW, prog(t, STAR_T0 + STAR_DT * i, 0.5), 320 + i, w=3.0, sp=3.4)
        d.line(pts, 330 + i, closed=True, w=2.2)
        if landed:
            for k in range(8):
                a = k * math.pi / 4 + 0.4
                l0, l1 = r * 1.15, r * (1.5 + 0.3 * math.sin(t * 4 + k + i))
                d.line([(x + l0 * math.cos(a), y + l0 * math.sin(a)), (x + l1 * math.cos(a), y + l1 * math.sin(a))],
                       340 + k + 10 * i, w=1.8, col=(0.96, 0.9, 0.55), a=0.9)
        elif int(t * 30) % 2 == 0:
            for k in range(3):
                d.dot(x - (hsh(i, k, d.b) * 30 + 10), y + 25 + hsh(i, k, 5) * 30, 2.5, YELLOW, 0.7)
    for k, (a, b) in enumerate(CONST):                # dashed chalk lines join landed stars
        la = STAR_T0 + STAR_DT * max(a, b) + STAR_FLY
        pp = prog(t, CONST_T0 + CONST_DT * k, 0.8)
        if pp <= 0 or t < la: continue
        A, B = STARS[a], STARS[b]
        dx, dy = B[0] - A[0], B[1] - A[1]; L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        s0 = (A[0] + ux * 62, A[1] + uy * 62); e0 = (B[0] - ux * 62, B[1] - uy * 62)
        n = max(2, int(L / 40))
        for j in range(n):
            u0, u1 = j / n, (j + 0.55) / n
            if u0 > pp: break
            d.line([(lerp(s0[0], e0[0], u0), lerp(s0[1], e0[1], u0)), (lerp(s0[0], e0[0], min(u1, pp)), lerp(s0[1], e0[1], min(u1, pp)))],
                   360 + k * 20 + j, w=2.4, col=(0.99, 0.97, 0.88), a=0.95)


def draw_moon(d, t):
    p = sm(prog(t, MOON_T, 1.2))
    if p <= 0: return
    cx, cy = 2640, -1080
    r = 120 * p * (1 + 0.04 * math.sin(t * 2))
    disc = ell(cx, cy, r, r, n=36)
    d.solid(disc, (1, 0.98, 0.85)); d.fill(disc, (0.99, 0.93, 0.62), p, 400, w=3.4, sp=4)
    d.line(disc, 401, closed=True, w=2.4)
    face(d, cx, cy - 4, 5.0 * p, 402, closed=True)
    for sgn in (-1, 1): d.dot(cx + sgn * 62 * p, cy + 24 * p, 14 * p, PINK, 0.45)
    for k, (dx, dy, rr) in enumerate(((-60, -60, 14), (62, -40, 10), (-30, 64, 11))):
        d.line(ell(cx + dx * p, cy + dy * p, rr * p, rr * p, n=10), 403 + k, closed=True, w=1.4, a=0.5)


def draw_world(d, t):
    """Paint order: back to front."""
    scene_decor(d, t)
    draw_title(d, t, TITLE)
    scene_sun(d, t)
    scene_mush(d, t)
    scene_owl(d, t)
    scene_slide(d, t)
    scene_wheel(d, t)
    scene_machine_back(d, t)
    scene_smoke(d, t)
    draw_spark(d, t)
    scene_machine(d, t)
    scene_mole(d, t)
    draw_stars(d, t)
    draw_moon(d, t)
