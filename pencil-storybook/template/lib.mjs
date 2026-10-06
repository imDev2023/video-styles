// ENGINE - the reusable pencil and crayon pen for skia-canvas. Nothing in here is per-video.
// (A port of the Python night-stars pen.)
//
// Colours are [r, g, b] arrays in 0..1. Geometry is plain arrays of [x, y] points in world units.
//
//   const p = new Pen(ctx, zoom, t, camX, camY, W, H);   // one per frame and per transform
//   p.solid(pts)                 paper-coloured underlay, hides whatever is behind the shape
//   p.fill(pts, col, amount, seed, { w, sp, ang, alpha })
//                                crayon hatching clipped to the shape. `amount` 0..1 reveals the
//                                strokes in a fixed random order (seeded), so animating it from 0
//                                to 1 "colours the shape in". A second cross-hatch layer appears
//                                above 0.55. Fills never boil: the stroke order and angle depend
//                                only on `seed`, never on time.
//   p.line(pts, seed, { closed, w, col, a, jit })
//                                pencil outline: resampled every 13 px, jittered by `jit` px,
//                                drawn twice (a full stroke and a faint offset second pass).
//                                The jitter pose changes 8 times a second and cycles through 3
//                                poses (`this.b`), which is the "boiling line" of the style.
//   p.dot(x, y, r, col, a)       a plain filled dot (eyes, paint drops, sparkles)
//   p.text(txt, x, y, size, { col, a, reveal, center, font, weight })
//                                handwriting text; `reveal` 0..1 wipes it on from the left.
//
// Draw order per shape is always solid, then fill, then line, so the outline sits on top.
// Give every shape its own pair of seeds (fill seed and line seed) so neighbours do not
// hatch in the same direction. Line widths and jitter are in screen pixels: they are
// divided by the zoom, so the pencil looks the same at every camera distance.
// `Pen.vis` culls shapes outside the camera view; keep that cheap test first in new methods.
export const INK = [0.27, 0.21, 0.20];
export const PAPER = [0.957, 0.937, 0.886];

export const fract = (x) => x - Math.floor(x);
export const hsh = (a, b = 0, c = 0) => fract(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);
export const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, u) => a + (b - a) * u;
export const prog = (t, t0, d) => cl((t - t0) / d);
export const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
export const rgba = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// ---- geometry
export function bezPt(b, u) {
  const [p0, p1, p2, p3] = b, v = 1 - u;
  return [v ** 3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u ** 3 * p3[0],
          v ** 3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u ** 3 * p3[1]];
}
export function bezTan(b, u) {
  const [p0, p1, p2, p3] = b, v = 1 - u;
  return [3 * v * v * (p1[0] - p0[0]) + 6 * v * u * (p2[0] - p1[0]) + 3 * u * u * (p3[0] - p2[0]),
          3 * v * v * (p1[1] - p0[1]) + 6 * v * u * (p2[1] - p1[1]) + 3 * u * u * (p3[1] - p2[1])];
}
export const bez = (b, n = 24) => Array.from({ length: n + 1 }, (_, i) => bezPt(b, i / n));
export function ell(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 28, rot = 0) {
  const cr = Math.cos(rot), sr = Math.sin(rot), out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, x = rx * Math.cos(a), y = ry * Math.sin(a);
    out.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return out;
}
export function xf(pts, { tx = 0, ty = 0, rot = 0, sx = 1, sy = 1, ox = 0, oy = 0 } = {}) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  return pts.map(([x, y]) => { x = (x - ox) * sx; y = (y - oy) * sy; return [ox + tx + x * cr - y * sr, oy + ty + x * sr + y * cr]; });
}
export function rrect(x, y, w, h, r = 14, n = 5) {
  const pts = [];
  for (const [cx, cy, a0] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]])
    pts.push(...ell(cx, cy, r, r, a0, a0 + Math.PI / 2, n));
  return pts;
}
export const starPts = (cx, cy, ro, ri, rot = 0, n = 5) => Array.from({ length: n * 2 }, (_, i) => {
  const r = i % 2 ? ri : ro, a = rot - Math.PI / 2 + i * Math.PI / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
export function surf(b, u, R) {
  const [x, y] = bezPt(b, u); const [tx, ty] = bezTan(b, u); const L = Math.hypot(tx, ty) || 1;
  let nx = ty / L, ny = -tx / L; if (ny > 0) { nx = -nx; ny = -ny; }
  return [x + nx * R, y + ny * R];
}
export const arcFn = (P, Q, H) => (u) => [lerp(P[0], Q[0], u), lerp(P[1], Q[1], u) - 4 * H * u * (1 - u)];
export function bezAtX(b, x) { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (bezPt(b, m)[0] < x) lo = m; else hi = m; } return bezPt(b, lo); }

const orderCache = new Map();
function order(seed, n, salt) {
  const key = seed + '|' + n + '|' + salt;
  let o = orderCache.get(key);
  if (!o) { o = Array.from({ length: n }, (_, i) => i).sort((a, b) => hsh(seed, a, salt) - hsh(seed, b, salt)); orderCache.set(key, o); }
  return o;
}

export class Pen {
  // ctx: skia-canvas 2D context, z: zoom, t: time in seconds, (cx, cy): camera centre in world
  // units, W x H: frame size. this.b is the boil pose: 8 changes a second, 3 poses in a cycle.
  constructor(ctx, z, t, cx, cy, W, H) {
    this.c = ctx; this.z = z; this.t = t; this.b = Math.floor(t * 8) % 3;
    this.x0 = cx - W / 2 / z; this.x1 = cx + W / 2 / z; this.y0 = cy - H / 2 / z; this.y1 = cy + H / 2 / z;
  }
  vis(pts, m = 40) {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (const p of pts) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; }
    const mm = m / this.z;
    return !(b < this.x0 - mm || a > this.x1 + mm || d < this.y0 - mm || c > this.y1 + mm);
  }
  line(pts, seed = 1, { closed = false, w = 1.8, col = INK, a = 0.9, jit = 1.1 } = {}) {
    if (pts.length < 2 || !this.vis(pts)) return;
    const { c, z } = this, step = 13 / z;
    const src = closed ? [...pts, pts[0]] : pts, P = [];
    for (let i = 0; i < src.length - 1; i++) {
      const [x0, y0] = src[i], [x1, y1] = src[i + 1], k = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let j = 0; j < k; j++) P.push([lerp(x0, x1, j / k), lerp(y0, y1, j / k)]);
    }
    P.push(src[src.length - 1]);
    const n = P.length;
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [wf, af, bo] of [[1, a, 0], [0.55, a * 0.5, 5]]) {
      c.lineWidth = w * wf / z; c.strokeStyle = rgba(col, af);
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const idx = closed && i === n - 1 ? 0 : i;
        const x = P[i][0] + (hsh(seed, idx, this.b + bo) - 0.5) * 2 * jit / z;
        const y = P[i][1] + (hsh(seed + 0.5, idx, this.b + bo) - 0.5) * 2 * jit / z;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  path(pts) { const c = this.c; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  solid(pts, col = PAPER, a = 1) { if (pts.length < 3 || !this.vis(pts)) return; this.path(pts); this.c.fillStyle = rgba(col, a); this.c.fill(); }
  dot(x, y, r, col, a = 1) { const c = this.c; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = rgba(col, a); c.fill(); }
  fill(pts, col, p, seed = 1, { w = 3, sp = 4.3, ang = null, alpha = 0.8 } = {}) {
    if (p <= 0 || pts.length < 3 || !this.vis(pts)) return;
    const { c, z } = this;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const q of pts) { a0 = Math.min(a0, q[0]); a1 = Math.max(a1, q[0]); b0 = Math.min(b0, q[1]); b1 = Math.max(b1, q[1]); }
    const cx = (a0 + a1) / 2, cy = (b0 + b1) / 2, Dg = Math.hypot(a1 - a0, b1 - b0) + 4 / z;
    c.save(); this.path(pts); c.clip();
    const A = ang ?? 0.45 + hsh(seed) * 0.9;
    c.lineCap = 'round'; c.lineWidth = w / z;
    for (let li = 0; li < 2; li++) {
      if (li === 1 && p < 0.55) break;
      const pp = li === 0 ? p : (p - 0.55) / 0.45, a = li === 0 ? A : A + 1.0, spf = li === 0 ? 1 : 1.5;
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const N = Math.max(2, Math.floor(Dg / (sp * spf / z))), ord = order(seed, N, 3 + li), cnt = Math.min(N, Math.ceil(pp * N));
      for (let q = 0; q < cnt; q++) {
        const k = ord[q], o = -Dg / 2 + (k + 0.5) * Dg / N, sh = 0.84 + 0.32 * hsh(seed, k, 9);
        c.strokeStyle = rgba([Math.min(1, col[0] * sh), Math.min(1, col[1] * sh), Math.min(1, col[2] * sh)], alpha);
        const bx = cx + nx * o, by = cy + ny * o, wob = (hsh(seed, k, 11) - 0.5) * 2.4 / z;
        c.beginPath(); c.moveTo(bx - dx * Dg / 2, by - dy * Dg / 2); c.lineTo(bx + nx * wob, by + ny * wob); c.lineTo(bx + dx * Dg / 2, by + dy * Dg / 2); c.stroke();
      }
    }
    c.restore();
  }
  text(txt, x, y, size, { col = INK, a = 1, reveal = 1, center = false, font = 'Caveat', weight = 700 } = {}) {
    const c = this.c; c.save(); c.font = `${weight} ${size}px ${font}`;
    const w = c.measureText(txt).width; if (center) x -= w / 2;
    c.beginPath(); c.rect(x - 4, y - size * 1.2, w * reveal + 8, size * 1.8); c.clip();
    c.fillStyle = rgba(col, a); c.fillText(txt, x, y); c.restore(); return w;
  }
}
export function face(p, x, y, s, seed, { col = INK, happy = true, closed = false } = {}) {
  for (const ex of [-7 * s, 7 * s]) {
    if (closed) p.line(ell(x + ex, y, 3.5 * s, 2.5 * s, 0, Math.PI, 6), seed + ex, { w: 1.5, col });
    else p.dot(x + ex, y, 1.8 * s, col);
  }
  if (happy) p.line(ell(x, y + 6 * s, 5 * s, 3.5 * s, 0.1, Math.PI - 0.1, 8), seed + 3, { w: 1.5, col });
}
