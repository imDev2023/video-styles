// PER-VIDEO - the whole world of "How Autumn Got Its Colors": geometry, the hero's journey,
// camera keyframes and every scene. Replace this file's contents for a new story, keeping the
// four exports the engine reads:
//
//   cameraKeys()   -> [[t, x, y, zoom], ...]  world-space camera keyframes (frame.mjs smooths them)
//   BACKGROUND     -> [(pen, t) => ...]       screen-space layers drawn before the camera transform
//   SCENES         -> [(pen, t) => ...]       world-space layers in back-to-front order
//   TIMES          -> { name: seconds }       picture events the score syncs to (score.mjs)
//
// Rules that keep the parallel render correct: every frame must be a pure function of t.
// Anything that accumulates over time (the water wheel angle below) is integrated once into a
// lookup table at module load, never stepped frame by frame, because each render segment starts
// in a fresh process at its own first frame.
//
// World units: ground line at y = 0, up is negative y. The camera zoom is about 1 for a 1080 px
// view, so one world unit is one screen pixel at zoom 1.
import { hsh, cl, sm, lerp, prog, mix3, rgba, bezPt, bez, ell, xf, surf, arcFn, bezAtX, face } from './lib.mjs';
import { VIDEO, PALETTE } from './config.mjs';

const { W } = VIDEO;
const { INK, GREEN, DGREEN, RED, ORANGE, GOLD, BROWN, DBROWN, BLUE, CREAM, GREY, PINK, TAN, SQUIRREL, COPPER } = PALETTE;
const R = 15; // acorn radius
const AUTUMN = [GOLD, ORANGE, RED];
const sq = (t, t0) => { const d = t - t0; return d < 0 || d > 1.4 ? 0 : Math.exp(-5 * d) * Math.cos(14 * d); };

// ------------------------------------------------------------------ geometry and timeline
const LEAFA = [365, -250], LEAFB = [560, -160];
const LOG = [[700, -120], [820, -100], [920, -40], [1010, 0]];
const PIVOT = [1180, -70], TH0 = -0.30, TH1 = 0.30, T_SEESAW = 10.7;
const STUMP = [1360, -210];
const WEB = [1650, -290], T_WEB = 12.4, T_WEB_OUT = 12.62;
const POTS = [{ x: 1900, c: RED, t: 13.5 }, { x: 2100, c: ORANGE, t: 14.45 }, { x: 2300, c: GOLD, t: 15.4 }];
const POT_H = 80;
const CREEK_PTS = [[2480, 10], [2650, 70], [2900, 200], [3000, 450], [2900, 750], [2600, 1000], [2400, 1250], [2200, 1340], [1950, 1350], [1816, 1347]];
const T_CREEK0 = 17.0, T_CREEK1 = 29.0;
const WC = [1700, 1290], WR = 130;
const PEND = [1100, 480], ARM = 520, CANOPY = [1100, 1000];
const CHUTE = [[1596, 1196], [1560, 1215], [1510, 1300], [1462, 1368]];

const plankPt = (th, lx, ly) => [PIVOT[0] + lx * Math.cos(th) - ly * Math.sin(th), PIVOT[1] + lx * Math.sin(th) + ly * Math.cos(th)];
const theta = (t) => {
  if (t < T_SEESAW) return TH0;
  const d = t - T_SEESAW;
  return d < 0.14 ? lerp(TH0, TH1, sm(d / 0.14)) : TH1 - 0.05 * Math.exp(-6 * (d - 0.14)) * Math.cos(20 * (d - 0.14));
};
const webSag = (t) => { const d = t - T_WEB; if (d < 0) return 0; if (d < 0.2) return 70 * sm(d / 0.2); return 70 * Math.exp(-6 * (d - 0.2)) * Math.cos(18 * (d - 0.2)); };

// creek: Catmull-Rom through points, arc-length parametrised
const CREEK = (() => {
  const P = CREEK_PTS, out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const u = k / 24, u2 = u * u, u3 = u2 * u;
      out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]);
    }
  }
  out.push(P[P.length - 1]);
  const s = [0]; for (let i = 1; i < out.length; i++) s.push(s[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, s, L: s[s.length - 1] };
})();
function creekAt(sv) {
  const { pts, s, L } = CREEK; sv = cl(sv, 0, L);
  let lo = 0, hi = s.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= sv) lo = m; else hi = m; }
  const u = (sv - s[lo]) / (s[hi] - s[lo] || 1), a = pts[lo], b = pts[hi];
  const tx = b[0] - a[0], ty = b[1] - a[1], Ln = Math.hypot(tx, ty) || 1;
  return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), tx: tx / Ln, ty: ty / Ln };
}
const boatS = (t) => CREEK.L * sm((t - T_CREEK0) / (T_CREEK1 - T_CREEK0));
const boatPos = (t) => { const c = creekAt(boatS(t)); const bob = 4 * Math.sin(t * 2.3); return [c.x, c.y - 8 + bob, Math.atan2(c.ty, c.tx) * 0.5 + 0.05 * Math.sin(t * 1.7)]; };

// water wheel angle table
const OM = (t) => (t < 28.6 ? 0 : 0.95 * sm((t - 28.6) / 2.4) * (1 - 0.85 * sm((t - 44) / 3)));
const WT = []; { let th = 0; for (let i = 0; i <= 61 * 300; i++) { WT.push(th); th += OM(i / 300) / 300; } }
const WOFF = 0.45 - WT[Math.round(29.2 * 300)];
const thetaW = (t) => WT[Math.min(WT.length - 1, Math.max(0, Math.round(t * 300)))] + WOFF;
const T_TIP = (() => { for (let i = Math.round(29.2 * 300); i < WT.length; i++) if (WT[i] + WOFF >= 3.927) return i / 300; return 34; })();
const bucketPivot = (t, k) => { const a = thetaW(t) + k * Math.PI / 2; return [WC[0] + WR * Math.cos(a), WC[1] + WR * Math.sin(a)]; };
const tipAngle = (t) => (t < T_TIP ? 0 : -1.15 * sm((t - T_TIP) / 0.35) * (1 - sm((t - T_TIP - 0.9) / 0.6)));
const bucketAcorn = (t) => { const [px, py] = bucketPivot(t, 0), tau = tipAngle(t); const c = Math.cos(tau), s = Math.sin(tau); return [px + 0 * c - 27 * s, py + 0 * s + 27 * c]; };

// pendulum brush
const alpha = (t) => 0.72 * sm((t - 29.6) / 2.5) * (1 - sm((t - 43.5) / 2.0)) * Math.sin(1.55 * (t - 29.6));
const brushTip = (t) => { const a = alpha(t); return [PEND[0] + ARM * Math.sin(a), PEND[1] + ARM * Math.cos(a)]; };
const brushColor = (t) => AUTUMN[Math.floor(Math.max(0, t - 30) / 1.3) % 3];

// maple leaves: painted by the brush as it passes
const NL = 96;
const LEAVES = Array.from({ length: NL }, (_, i) => {
  const r = 285 * Math.sqrt((i + 0.5) / NL), a = i * 2.39996;
  const x = CANOPY[0] + r * Math.cos(a), y = CANOPY[1] + 0.9 * r * Math.sin(a);
  let paintT = 99, col = AUTUMN[i % 3];
  for (let tt = 29.6; tt < 46; tt += 1 / 30) { const [bx, by] = brushTip(tt); if (Math.hypot(bx - x, by - y) < 125) { paintT = tt; col = brushColor(tt); break; } }
  if (paintT > 43.5) { paintT = 43.5 + 2 * hsh(i, 1); col = AUTUMN[Math.floor(hsh(i, 2) * 3)]; }
  const falls = hsh(i, 5) < 0.55;
  return { x, y, rot: (hsh(i, 3) - 0.5) * 2.4, sz: 30 + 16 * hsh(i, 4), paintT, col, falls, tf: 45.5 + hsh(i, 6) * 6.5, dur: 3.2 + 2.2 * hsh(i, 7), lx: 760 + hsh(i, 8) * 900, gy: 1388 + hsh(i, 9) * 8 };
});
const leafShape = (x, y, sz, rot) => {
  const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10, a = Math.PI * u; pts.push([sz * 0.5 * Math.cos(Math.PI - a), -sz * 0.28 * Math.sin(a) * (1 - 0.25 * u)]); }
  for (let i = 9; i >= 1; i--) { const u = i / 10, a = Math.PI * u; pts.push([sz * 0.5 * Math.cos(Math.PI - a), sz * 0.28 * Math.sin(a) * (1 - 0.25 * u)]); }
  return xf(pts, { tx: x, ty: y, rot });
};

// ------------------------------------------------------------------ the acorn's journey
const A0 = [345, -366];
const trampA = [LEAFA[0] + 2, LEAFA[1] - 22 - R], trampB = [LEAFB[0], LEAFB[1] - 20 - R];
const potTop = (i) => [POTS[i].x, -(POT_H + 17) - R];
const logEnd = surf(LOG, 1, R);
const plankLow = (th) => plankPt(th, -95, -8 - R);
const SEGS = [
  [4.1, 4.75, (u) => [lerp(A0[0], trampA[0], u), lerp(A0[1], trampA[1], u * u)]],
  [4.75, 5.6, arcFn(trampA, trampB, 150)],
  [5.6, 6.4, arcFn(trampB, surf(LOG, 0, R), 110)],
  [6.4, 8.4, (u) => surf(LOG, u ** 1.6, R)],
  [8.4, 9.4, (u) => [lerp(logEnd[0], plankLow(TH0)[0], u), lerp(logEnd[1], plankLow(TH0)[1], u)]],
  [T_SEESAW + 0.02, 12.4, arcFn(plankLow(TH1), [WEB[0], WEB[1] - R], 440)],
  [T_WEB_OUT, 13.5, arcFn([WEB[0], WEB[1] - R + 20], potTop(0), 210)],
  [13.5, 14.45, arcFn(potTop(0), potTop(1), 170)],
  [14.45, 15.4, arcFn(potTop(1), potTop(2), 170)],
  [15.4, 16.9, arcFn(potTop(2), [CREEK_PTS[0][0], CREEK_PTS[0][1] - 24], 200)],
  [28.75, 29.2, (u) => { const b = boatPos(28.75), k = bucketAcorn(29.2); return arcFn([b[0], b[1] - 22], k, 40)(u); }],
  [T_TIP + 0.35, T_TIP + 0.8, (u) => arcFn(bucketAcorn(T_TIP + 0.35), surf(CHUTE, 0, R), 30)(u)],
  [T_TIP + 0.8, T_TIP + 2.3, (u) => surf(CHUTE, u ** 1.5, R)],
  [T_TIP + 2.3, T_TIP + 2.6, arcFn(surf(CHUTE, 1, R), [1472, 1356], 20)],
];
export const T_CATCH = T_TIP + 2.6;
function acornAt(t) {
  if (t < 3.0) return t < 0 ? null : { x: A0[0], y: A0[1], sc: 1, spin: 0.3 * Math.sin(t * 2) * 0.1 };
  if (t < 4.1) { const w = (t - 3.0) / 1.1; return { x: A0[0], y: A0[1], sc: 1, spin: Math.sin(t * 30) * 0.25 * w }; }
  if (t >= T_SEESAW - 1.3 && t < T_SEESAW + 0.02) { const th = theta(t); const p = plankLow(th); return { x: p[0], y: p[1], sc: 1, spin: 0 }; }
  if (t >= 12.4 && t < T_WEB_OUT) { return { x: WEB[0], y: WEB[1] - R + webSag(t), sc: 1, spin: 0 }; }
  if (t >= 16.9 && t < 28.75) { const b = boatPos(t); return { x: b[0], y: b[1] - 22, sc: 1, spin: 0 }; }
  if (t >= 29.2 && t < T_TIP + 0.35) { const k = bucketAcorn(t); return { x: k[0], y: k[1], sc: 1, spin: 0 }; }
  if (t >= T_CATCH) { const bob = 3 * Math.sin(t * 5); return { x: 1472, y: 1356 + bob, sc: 1, spin: 0 }; }
  for (const [t0, t1, fn] of SEGS) if (t >= t0 && t < t1) { const [x, y] = fn((t - t0) / (t1 - t0)); return { x, y, sc: 1, spin: (x + y) * 0.04 }; }
  return null;
}

// ------------------------------------------------------------------ camera
// [t, x, y, zoom]. The camera centre (x, y) is in world units; zoom 1 shows 1080 world units.
// Hold a framing by repeating it; follow a moving hero by sampling its path (the creek ride).
// End with a key past the video's end so the last frames have something to interpolate to.
export function cameraKeys() {
  const keys = [[0, 260, -380, 0.95], [3, 300, -340, 1.0], [4.1, 330, -300, 1.2], [5.5, 470, -170, 1.4], [7.2, 790, -120, 1.4], [9.0, 1080, -110, 1.4],
    [10.2, 1250, -170, 1.2], [11.5, 1450, -330, 0.85], [12.6, 1650, -220, 1.15], [14, 1950, -150, 1.25], [16, 2250, -150, 1.15], [17, 2520, -60, 1.1]];
  for (let t = 17.5; t < 28.6; t += 0.4) { const c = creekAt(boatS(t)); keys.push([t, c.x, c.y, 0.75]); }
  keys.push([29.2, 1850, 1230, 1.1], [31, 1750, 1100, 0.8], [34, 1420, 1030, 0.72], [37, 1380, 1000, 0.72], [40, 1300, 1000, 0.72], [44, 1350, 1080, 0.85],
    [49, 1350, 1130, 0.9], [52, 1400, 900, 0.6], [55, 1500, 500, 0.38], [57, 1500, 420, 0.34], [100, 1500, 420, 0.34]);
  return keys;
}

// ------------------------------------------------------------------ scenes
function grass(p, x, y, seed, pg, col = GREEN) {
  const c = mix3(INK, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], pg);
  for (let k = 0; k < 5; k++) { const dx = (k - 2) * 7; p.line(bez([[x + dx * 0.4, y], [x + dx * 0.6, y - 14], [x + dx, y - 24], [x + dx * 1.5, y - 30 - 5 * hsh(seed, k)]], 6), seed + k, { w: 1.6, col: c }); }
}
function flower(p, t, x, y, h, seed, col, tp) {
  const pg = prog(t, tp, 1.2), sw = Math.sin(t * 1.5 + seed) * 3, top = [x + sw, y - h];
  p.line(bez([[x, y], [x + 4, y - h * 0.4], [x - 4, y - h * 0.7], top], 8), seed, { w: 1.8, col: mix3(INK, [0.2, 0.55, 0.22], pg) });
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; const pet = ell(top[0] + 12 * Math.cos(a), top[1] + 12 * Math.sin(a), 9, 5, 0, Math.PI * 2, 10, a); p.fill(pet, col, pg, seed + 3 + k, { w: 2.2, sp: 3 }); p.line(pet, seed + 10 + k, { closed: true, w: 1.3 }); }
  const c0 = ell(top[0], top[1], 6, 6, 0, Math.PI * 2, 10); p.fill(c0, GOLD, pg, seed + 20, { w: 2.2, sp: 3 }); p.line(c0, seed + 21, { closed: true, w: 1.3 });
}

function sceneGround(p, t) {
  p.line([[-300, 0], [2640, 0]], 1, { w: 2 });
  p.line([[250, 1400], [2700, 1400]], 2, { w: 2 });
  for (const [gx, s] of [[-130, 1], [60, 2], [700, 3], [900, 4], [1010, 5], [1120, 6], [1500, 7], [1560, 8], [1800, 9], [2000, 10], [2200, 11], [2400, 12]]) grass(p, gx, 0, s, prog(t, 4 + gx / 500, 1.5));
  for (const [gx, s] of [[330, 21], [520, 22], [820, 23], [980, 24], [1290, 25], [1380, 26], [1900, 27], [2100, 28], [2300, 29]]) grass(p, gx, 1400, s, prog(t, 30, 3), GOLD);
  for (const [fx, fh, fs, fc, ft] of [[-60, 46, 500, PINK, 4.6], [90, 38, 510, GOLD, 4.8], [640, 44, 520, ORANGE, 6.0], [780, 50, 530, PINK, 6.8], [1060, 40, 540, RED, 7.6], [1470, 36, 550, GOLD, 12], [1780, 44, 560, PINK, 12.6], [2030, 52, 570, ORANGE, 14], [2400, 40, 580, GOLD, 15.8]]) flower(p, t, fx, 0, fh, fs, fc, ft);
}

function sceneOak(p, t) {
  const paint = prog(t, 48, 6), sway = 3 * Math.sin(t * 0.8);
  const C = [[150, -540, 175], [10, -480, 125], [290, -500, 135], [150, -670, 125], [-80, -420, 95], [390, -455, 90], [230, -640, 100], [60, -640, 100]];
  C.forEach(([cx, cy, r], i) => { const pts = ell(cx + sway * (i % 3) * 0.3, cy, r, r * 0.88, 0, Math.PI * 2, 24); p.solid(pts); p.fill(pts, mix3(GREEN, GOLD, paint), 1, 20 + i); p.line(pts, 30 + i, { closed: true, w: 2 }); });
  const trunk = [[40, 0], [78, -120], [62, -300], [92, -390], [212, -390], [192, -300], [218, -120], [262, 0]];
  p.solid(trunk); p.fill(trunk, BROWN, 1, 10); p.line(trunk, 11, { closed: true, w: 2.2 });
  for (let k = 0; k < 4; k++) p.line([[100 + k * 36, -330 + 40 * hsh(k, 1)], [104 + k * 36, -70 - 40 * hsh(k, 2)]], 12 + k, { w: 1.2, a: 0.5 });
  const surprised = t > 3.9 && t < 8, blink = (t % 4.5) < 0.12;
  if (surprised) { for (const ex of [-22, 22]) { p.dot(150 + ex, -250, 9, [1, 0.98, 0.9]); p.line(ell(150 + ex, -250, 9, 9, 0, Math.PI * 2, 10), 16 + ex, { closed: true, w: 1.6 }); p.dot(150 + ex + 2, -248, 3, INK); } p.line(ell(150, -215, 8, 11, 0, Math.PI * 2, 10), 17, { closed: true, w: 1.8 }); }
  else face(p, 150, -250, 3.0, 18, { closed: !blink && t < 3.9, happy: true });
  const br = bez([[200, -330], [260, -350], [300, -380], [335, -392]], 12), br2 = br.map(([x, y], i) => [x, y + 22 - 14 * i / 12]);
  const brp = [...br, ...br2.reverse()]; p.solid(brp); p.fill(brp, BROWN, 1, 14); p.line(brp, 15, { closed: true, w: 1.9 });
  p.line(bez([[335, -392], [342, -386], [346, -380], [345, -374]], 4), 19, { w: 1.6 });
}

function sceneTrampolines(p, t) {
  [[LEAFA, 4.75, 40], [LEAFB, 5.6, 50]].forEach(([c, th, id], i) => {
    const s = 1 - 0.55 * sq(t, th), rx = i ? 80 : 90, ry = i ? 20 : 22, pg = prog(t, th - 0.2, 1);
    p.line(bez([[c[0], 0], [c[0] - 8, c[1] * 0.4], [c[0] + 6, c[1] * 0.75], [c[0], c[1] + 6]], 10), id, { w: 2.2, col: mix3(INK, DGREEN, pg) });
    const lf = ell(c[0], c[1], rx, ry * s, 0, Math.PI * 2, 24, i ? -0.1 : 0.08);
    p.solid(lf); p.fill(lf, mix3(GREEN, GOLD, 0), Math.max(0.35, pg), id + 1); p.line(lf, id + 2, { closed: true, w: 2 });
    p.line([[c[0] - rx * 0.8, c[1]], [c[0] + rx * 0.8, c[1]]], id + 3, { w: 1.2, a: 0.5 });
  });
  const logTop = bez(LOG, 16), logBot = logTop.map(([x, y]) => [x, y + 34]);
  const poly = [...logTop, ...logBot.reverse()];
  p.solid(poly); p.fill(poly, BROWN, prog(t, 5.8, 1.2), 60); p.line(poly, 61, { closed: true, w: 2 });
  p.line(ell(700, -103, 12, 20, 0, Math.PI * 2, 12), 62, { closed: true, w: 1.6 });
  for (const [sx, sid] of [[735, 64], [850, 65], [940, 66]]) { const [qx, qy] = bezAtX(LOG, sx); p.line([[sx, qy + 30], [sx + 3, 0]], sid, { w: 3 }); p.line([[sx - 18, 0], [sx + 20, 0]], sid + 3, { w: 1.6 }); }
  for (let k = 0; k < 4; k++) { const [x, y] = bezPt(LOG, 0.2 + k * 0.2); p.line([[x, y + 8], [x + 14, y + 22]], 63 + k, { w: 1.2, a: 0.6 }); }
}

function sceneSquirrel(p, t) {
  const th = theta(t);
  const prop = [[1148, 0], [PIVOT[0], PIVOT[1]], [1212, 0]];
  p.solid(prop); p.fill(prop, DBROWN, prog(t, 9.6, 1), 70); p.line(prop, 71, { closed: true, w: 2 });
  const pl =[[-130, -8], [130, -8], [130, 8], [-130, 8]].map(([x, y]) => plankPt(th, x, y));
  p.solid(pl); p.fill(pl, TAN, prog(t, 9.4, 1.2), 72); p.line(pl, 73, { closed: true, w: 2 });
  p.dot(PIVOT[0], PIVOT[1], 5, DBROWN);
  const stump = [[1318, 0], [1322, -120], [1316, -205], [1404, -205], [1400, -120], [1408, 0]];
  p.solid(stump); p.fill(stump, BROWN, prog(t, 9, 1.4), 74); p.line(stump, 75, { closed: true, w: 2 });
  p.line(ell(1360, -205, 44, 9, 0, Math.PI * 2, 16), 76, { closed: true, w: 1.8 });
  // squirrel
  let q = [STUMP[0], STUMP[1]], crouch = 0;
  if (t >= 10.7) q = plankPt(th, 105, -8);
  else if (t >= 10.2) { const u = (t - 10.2) / 0.5; q = arcFn(STUMP, plankPt(TH0, 105, -8), 70)(u); }
  else if (t > 9.8) crouch = sm((t - 9.8) / 0.4);
  const [qx, qy] = q;
  const pg = prog(t, 9.2, 1.4);
  const body = ell(qx, qy - 30 + crouch * 6, 26, 34 - crouch * 6, 0, Math.PI * 2, 18), head = ell(qx + 6, qy - 72 + crouch * 10, 20, 19, 0, Math.PI * 2, 14);
  const tail = bez([[qx - 18, qy - 14], [qx - 70, qy - 30], [qx - 62, qy - 130], [qx - 24, qy - 118]], 14).concat(bez([[qx - 24, qy - 118], [qx - 40, qy - 70], [qx - 34, qy - 40], [qx - 18, qy - 14]], 8));
  p.solid(tail); p.fill(tail, SQUIRREL, pg, 77); p.line(tail, 78, { closed: true, w: 2 });
  p.solid(body); p.fill(body, SQUIRREL, pg, 79); p.line(body, 80, { closed: true, w: 2 });
  p.solid(head); p.fill(head, SQUIRREL, pg, 81); p.line(head, 82, { closed: true, w: 2 });
  for (const ex of [-8, 12]) { const ear = [[qx + ex, qy - 88 + crouch * 10], [qx + ex + 4, qy - 108 + crouch * 10], [qx + ex + 14, qy - 88 + crouch * 10]]; p.fill(ear, SQUIRREL, pg, 83 + ex, { w: 2.4 }); p.line(ear, 85 + ex, { closed: true, w: 1.6 }); }
  p.dot(qx + 14, qy - 74 + crouch * 10, 2.4, INK); p.dot(qx + 24, qy - 69 + crouch * 10, 2.6, INK);
  p.line(ell(qx + 10, qy - 62 + crouch * 10, 7, 4, 0.2, Math.PI - 0.2, 8), 87, { w: 1.4 });
  const belly = ell(qx + 4, qy - 24, 13, 20, 0, Math.PI * 2, 12); p.fill(belly, CREAM, pg, 88, { w: 2.4 });
}

function sceneWeb(p, t) {
  const sag = webSag(t), cx = WEB[0], cy = WEB[1] + 0;
  p.line([[1480, 0], [1486, -160], [1476, -330]], 90, { w: 2.2 }); p.line([[1830, 0], [1822, -170], [1836, -330]], 91, { w: 2.2 });
  const rings = [0, 0.25, 0.5, 0.75, 1], pts = rings.map((rj) => Array.from({ length: 16 }, (_, k) => { const a = k * Math.PI / 8; return [cx + rj * 178 * Math.cos(a), cy + rj * 118 * Math.sin(a) + sag * (1 - rj)]; }));
  for (let k = 0; k < 16; k += 1) p.line([pts[0][k], pts[4][k]], 92 + k, { w: 1.2, a: 0.7, col: [0.45, 0.42, 0.45] });
  for (let j = 1; j < 5; j++) p.line(pts[j], 110 + j, { closed: true, w: 1.2, a: 0.75, col: [0.45, 0.42, 0.45] });
  p.line([[1476, -330], pts[4][8]], 120, { w: 1.4, a: 0.6 }); p.line([[1836, -330], pts[4][0]], 121, { w: 1.4, a: 0.6 });
  const sx = 1560, sy = -440 + 14 * Math.sin(t * 1.4), pg = prog(t, 11.8, 1.2);
  p.line([[sx, -330], [sx, sy - 12]], 122, { w: 1.2, a: 0.7 });
  const bd = ell(sx, sy, 16, 14, 0, Math.PI * 2, 12), hd = ell(sx, sy - 18, 10, 9, 0, Math.PI * 2, 10);
  for (let k = 0; k < 4; k++) for (const sg of [-1, 1]) p.line([[sx + sg * 12, sy - 2 + k * 3], [sx + sg * 30, sy - 14 + k * 9], [sx + sg * 36, sy + 6 + k * 9]], 123 + k + sg * 5, { w: 1.5 });
  p.solid(bd); p.fill(bd, [0.45, 0.30, 0.55], pg, 130); p.line(bd, 131, { closed: true, w: 1.8 });
  p.solid(hd); p.fill(hd, [0.45, 0.30, 0.55], pg, 132); p.line(hd, 133, { closed: true, w: 1.6 });
  p.dot(sx - 4, sy - 19, 2, [1, 1, 1]); p.dot(sx + 4, sy - 19, 2, [1, 1, 1]);
}

function scenePots(p, t) {
  POTS.forEach((pt, i) => {
    const s = sq(t, pt.t) * 0.12, pg = prog(t, pt.t - 0.15, 0.9);
    const body = [[pt.x - 48, 0], [pt.x - 55, -POT_H * (1 - s)], [pt.x + 55, -POT_H * (1 - s)], [pt.x + 48, 0]];
    p.solid(body); p.fill(body, mix3(GREY, pt.c, 0.75), pg, 140 + i); p.line(body, 141 + i, { closed: true, w: 2 });
    p.line([[pt.x - 52, -POT_H * 0.55], [pt.x + 52, -POT_H * 0.55]], 142 + i, { w: 1.4, a: 0.7 });
    const topY = -POT_H * (1 - s);
    const open = t >= pt.t ? sm((t - pt.t) / 0.15) * (0.85 + 0.15 * Math.exp(-4 * (t - pt.t)) * Math.cos(16 * (t - pt.t))) : 0;
    const rim = ell(pt.x, topY, 55, 14, 0, Math.PI * 2, 22);
    p.solid(rim); p.fill(rim, pt.c, open > 0 ? 1 : 0, 143 + i, { w: 3 }); p.line(rim, 144 + i, { closed: true, w: 2 });
    const hinge = [pt.x - 55, topY - 3], lid = xf(ell(pt.x, topY - 3, 55, 13, 0, Math.PI * 2, 22), { rot: -1.25 * open, ox: hinge[0], oy: hinge[1] });
    p.solid(lid); p.fill(lid, [0.72, 0.72, 0.76], 1, 145 + i); p.line(lid, 146 + i, { closed: true, w: 2 });
    if (t > pt.t && t < pt.t + 1.4) for (let d = 0; d < 14; d++) {
      const dt = t - pt.t, vx = (hsh(i, d, 1) - 0.5) * 340, vy = -300 - 220 * hsh(i, d, 2), x = pt.x + vx * dt, y = topY - 10 + vy * dt + 520 * dt * dt;
      if (y < 0) p.dot(x, y, 3.5 + 3 * hsh(i, d, 3), pt.c, 1 - dt / 1.4);
    }
  });
  const pond = ell(2540, 8, 150, 30, 0, Math.PI * 2, 30);
  p.solid(pond); p.fill(pond, BLUE, prog(t, 14.5, 2.5), 150, { sp: 5 }); p.line(pond, 151, { closed: true, w: 2 });
  for (let k = 0; k < 3; k++) p.line(ell(2530 + k * 30, 8 + k * 3, 14 + k * 5, 4 + k, 0, Math.PI * 2, 12), 152 + k, { closed: true, w: 1.1, a: 0.5 });
}

function sceneCreek(p, t) {
  const { pts, s: S, L } = CREEK, sb = t < T_CREEK0 ? 0 : boatS(t) + 120;
  const edge = (sg, upTo) => { const out = []; for (let i = 0; i < pts.length; i += 2) { if (S[i] > upTo) break; const c = creekAt(S[i]), w = 34 + 12 * Math.sin(S[i] * 0.01); out.push([c.x - c.ty * w * sg, c.y + c.tx * w * sg]); } return out; };
  const rib = (upTo) => { const a = edge(1, upTo), b = edge(-1, upTo); return [...a, ...b.reverse()]; };
  const full = rib(L + 1), painted = t > T_CREEK0 - 0.5 ? rib(sb) : [];
  p.solid(full);
  if (painted.length > 4) p.fill(painted, BLUE, 1, 160, { sp: 5, alpha: 0.7 });
  p.line(edge(1, L + 1), 161, { w: 1.9 }); p.line(edge(-1, L + 1), 162, { w: 1.9 });
  for (let sv = 60; sv < L - 40; sv += 130) { const c = creekAt(sv), o = sv % 260 ? 14 : -14; p.line(bez([[c.x - 14, c.y + o], [c.x - 4, c.y + o - 4], [c.x + 6, c.y + o + 4], [c.x + 16, c.y + o]], 6), 170 + sv, { w: 1.2, a: 0.55 }); }
  for (let sv = 150; sv < L - 100; sv += 210) { const c = creekAt(sv), side = (sv / 210) % 2 ? 1 : -1; grass(p, c.x - c.ty * 60 * side, c.y + c.tx * 60 * side + 12, 180 + sv, prog(t, 18, 6)); }
}

function sceneBoat(p, t) {
  if (t < 14) return;
  const [bx, by, rot] = boatPos(t < T_CREEK0 ? T_CREEK0 : Math.min(t, T_CREEK1));
  const x = t < T_CREEK0 ? CREEK_PTS[0][0] : bx, y = t < T_CREEK0 ? CREEK_PTS[0][1] - 8 + 4 * Math.sin(t * 2.3) : by;
  const leaf = xf(leafShape(0, 0, 90, 0), { tx: x, ty: y, rot: rot * 0.6 });
  p.solid(leaf); p.fill(leaf, GOLD, 1, 190, { w: 2.6 }); p.line(leaf, 191, { closed: true, w: 2 });
  p.line(xf([[-40, 0], [44, 0]], { tx: x, ty: y, rot: rot * 0.6 }), 192, { w: 1.2, a: 0.6 });
}

function sceneWheel(p, t) {
  const [cx, cy] = WC, th = thetaW(t), pg = prog(t, 28.4, 1.4);
  p.line([[cx - 8, cy], [cx - 84, 1400]], 200, { w: 2.4 }); p.line([[cx + 8, cy], [cx + 84, 1400]], 201, { w: 2.4 });
  const rim = ell(cx, cy, WR, WR, 0, Math.PI * 2, 48);
  p.fill(rim, BROWN, pg * 0.35, 202, { sp: 5 }); p.line(rim, 203, { closed: true, w: 2.2 });
  p.line(ell(cx, cy, WR - 14, WR - 14, 0, Math.PI * 2, 48), 204, { closed: true, w: 1.2, a: 0.6 });
  for (let k = 0; k < 8; k++) { const a = th + k * Math.PI / 4; p.line([[cx, cy], [cx + WR * Math.cos(a), cy + WR * Math.sin(a)]], 205 + k, { w: 1.8 }); }
  for (let k = 0; k < 8; k++) { const a = th + k * Math.PI / 4 + Math.PI / 8; const q =[[WR - 6, -12], [WR + 22, -12], [WR + 22, 12], [WR - 6, 12]].map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]); p.fill(q, TAN, pg, 215 + k, { w: 2.4 }); p.line(q, 225 + k, { closed: true, w: 1.6 }); }
  for (let k = 0; k < 4; k++) {
    const [px, py] = bucketPivot(t, k), tau = k === 0 ? tipAngle(t) : 0;
    const rot = (pts) => pts.map(([x, y]) => [px + x * Math.cos(tau) - y * Math.sin(tau), py + x * Math.sin(tau) + y * Math.cos(tau)]);
    const body = rot([[-22, 6], [22, 6], [18, 44], [-18, 44]]);
    p.line(rot([[-22, 6], [0, -8], [22, 6]]), 240 + k, { w: 1.4 });
    p.solid(body); p.fill(body, COPPER, pg, 245 + k, { w: 2.6 }); p.line(body, 250 + k, { closed: true, w: 1.8 });
  }
  const hub = ell(cx, cy, 14, 14, 0, Math.PI * 2, 12); p.fill(hub, COPPER, pg, 260); p.line(hub, 261, { closed: true });
  // splash where the creek meets the wheel
  if (t > 27 && t < 46) for (let d = 0; d < 6; d++) { const ph = ((t * 1.7 + d / 6) % 1); p.dot(1850 - ph * 40 + hsh(d, 1) * 20, 1350 - 45 * Math.sin(Math.PI * ph) * (0.6 + hsh(d, 2)), 3, BLUE, (1 - ph) * 0.8); }
}

function sceneChute(p, t) {
  const top = bez(CHUTE, 16), bot = top.map(([x, y]) => [x, y + 16]), poly = [...top, ...bot.reverse()];
  p.solid(poly); p.fill(poly, GREEN, prog(t, 31, 2.5), 270, { w: 2.6 }); p.line(poly, 271, { closed: true, w: 1.9 });
}

function sceneMaple(p, t) {
  const trunk = [[1040, 1400], [1075, 1250], [1060, 1120], [1140, 1120], [1125, 1250], [1170, 1400]];
  p.solid(trunk); p.fill(trunk, BROWN, prog(t, 28.5, 2), 280); p.line(trunk, 281, { closed: true, w: 2.2 });
  LEAVES.forEach((lf, i) => {
    let x = lf.x, y = lf.y, rot = lf.rot, landed = false;
    const col = mix3(GREEN, lf.col, sm((t - lf.paintT) / 0.7));
    if (lf.falls && t > lf.tf) {
      const u = (t - lf.tf) / lf.dur;
      if (u >= 1) landed = true;
      const uu = cl(u);
      x = lerp(lf.x, lf.lx, sm(uu) * 0.75 + uu * 0.25) + 70 * Math.sin(uu * 9 + i) * (1 - uu * 0.4);
      y = lerp(lf.y, lf.gy, uu * uu * 0.4 + uu * 0.6);
      rot = lf.rot + 4 * uu + Math.sin(uu * 11 + i) * 0.6;
      if (landed) { x = lf.lx; y = lf.gy; rot = lf.rot * 0.4; }
    } else { x += 3 * Math.sin(t * 1.5 + i); y += 2 * Math.sin(t * 1.2 + i * 0.7); rot += 0.1 * Math.sin(t * 1.3 + i); }
    const sh = landed ? leafShape(x, y, lf.sz, rot).map(([a, b]) => [a, y + (b - y) * 0.3]) : leafShape(x, y, lf.sz, rot);
    p.solid(sh); p.fill(sh, col, 1, 300 + i, { w: 2.6, sp: 3.4 }); p.line(sh, 400 + i, { closed: true, w: 1.3 });
  });
}

function sceneGantry(p, t) {
  const pg = prog(t, 29, 1.5);
  const beam = [[728, PEND[1] - 14], [PEND[0] + 22, PEND[1] - 14], [PEND[0] + 22, PEND[1] + 14], [728, PEND[1] + 14]];
  p.solid(beam); p.fill(beam, DBROWN, pg, 500, { w: 3 }); p.line(beam, 501, { closed: true, w: 2 });
  const post = [[736, PEND[1] + 14], [782, PEND[1] + 14], [790, 1400], [728, 1400]];
  p.solid(post); p.fill(post, DBROWN, pg, 502, { w: 3 }); p.line(post, 503, { closed: true, w: 2 });
  p.line([[760, 680], [900, PEND[1] + 14]], 504, { w: 2.4 }); p.line([[760, 700], [920, PEND[1] + 14]], 505, { w: 1.2, a: 0.5 });
  const a = alpha(t), [tx, ty] = brushTip(t), dx = Math.sin(a), dy = Math.cos(a);
  p.line([PEND, [tx, ty]], 506, { w: 5 }); p.line([[PEND[0] + 3, PEND[1]], [tx + 3, ty]], 507, { w: 1.4, a: 0.6 });
  p.dot(PEND[0], PEND[1], 8, [0.3, 0.25, 0.25]);
  const bc = brushColor(t), nx = -dy, ny = dx;
  const brush = [[tx - nx * 40, ty - ny * 40], [tx + nx * 40, ty + ny * 40], [tx + nx * 34 + dx * 80, ty + ny * 34 + dy * 80], [tx - nx * 34 + dx * 80, ty - ny * 34 + dy * 80]];
  const ferrule = [[tx - nx * 40 - dx * 18, ty - ny * 40 - dy * 18], [tx + nx * 40 - dx * 18, ty + ny * 40 - dy * 18], [tx + nx * 40, ty + ny * 40], [tx - nx * 40, ty - ny * 40]];
  p.solid(brush); p.fill(brush, bc, 1, 510, { w: 3 }); p.line(brush, 511, { closed: true, w: 2 });
  p.solid(ferrule); p.fill(ferrule, GREY, 1, 512); p.line(ferrule, 513, { closed: true, w: 1.8 });
  if (t > 30 && t < 45) for (let d = 0; d < 5; d++) { const ph = (t * 1.3 + d / 5) % 1; p.dot(tx + dx * 80 + (hsh(d, 3) - 0.5) * 50, ty + dy * 80 + ph * 160, 3.5, bc, 1 - ph); }
  // rope from the wheel crank to the arm
  const crank = [WC[0] + 70 * Math.cos(thetaW(t)), WC[1] + 70 * Math.sin(thetaW(t))], arm = [PEND[0] + 210 * dx, PEND[1] + 210 * dy];
  if (t > 28.5) { const mid = [(crank[0] + arm[0]) / 2, (crank[1] + arm[1]) / 2 + 40]; p.line(bez([crank, [lerp(crank[0], mid[0], 0.7), lerp(crank[1], mid[1], 0.7)], [lerp(arm[0], mid[0], 0.7), lerp(arm[1], mid[1], 0.7)], arm], 20), 520, { w: 1.4, a: 0.8 }); p.dot(crank[0], crank[1], 4, DBROWN); p.dot(arm[0], arm[1], 4, DBROWN); }
}

function sceneHedgehog(p, t) {
  const hx = 1425, hy = 1352, happy = t > T_CATCH, hop = happy ? -18 * Math.abs(Math.sin((t - T_CATCH) * 6)) * Math.exp(-0.5 * (t - T_CATCH)) : 0;
  const pg = prog(t, 33, 2), y0 = hy + hop;
  for (let k = 0; k < 34; k++) { const a = Math.PI + (k / 33) * Math.PI * 1.0 - 0.2, r1 = 44, r2 = 62 + 8 * hsh(k, 1); p.line([[hx - 10 + r1 * Math.cos(a), y0 + r1 * 0.9 * Math.sin(a)], [hx - 10 + r2 * Math.cos(a), y0 + r2 * 0.95 * Math.sin(a)]], 600 + k, { w: 1.8, col: DBROWN }); }
  const body = ell(hx - 4, y0, 52, 44, 0, Math.PI * 2, 22);
  p.solid(body); p.fill(body, [0.70, 0.52, 0.34], pg, 640); p.line(body, 641, { closed: true, w: 2 });
  const head = ell(hx + 38, y0 + 8, 24, 20, 0, Math.PI * 2, 14); p.solid(head); p.fill(head, TAN, pg, 642); p.line(head, 643, { closed: true, w: 2 });
  p.dot(hx + 60, y0 + 10, 4, INK); p.dot(hx + 40, y0 + 2, 2.6, INK);
  p.line(ell(hx + 44, y0 + 16, 7, 4, 0.2, Math.PI - 0.2, 8), 644, { w: 1.4 });
  const arm = happy ? [[hx + 28, y0 + 22], [hx + 48, y0 + 12], [1472, 1358]] : [[hx + 28, y0 + 22], [hx + 56, y0 + 16], [hx + 70, y0 + 6]];
  p.line(arm, 645, { w: 3.2, col: DBROWN });
  for (const lx of [-20, 14]) p.line([[hx + lx, y0 + 42], [hx + lx + 4, 1400]], 646 + lx, { w: 2.2 });
  if (happy && t < T_CATCH + 3.5) {
    const pb = sm(prog(t, T_CATCH + 0.2, 0.3)) * (1 - sm(prog(t, T_CATCH + 3.0, 0.4)));
    const bx = 1420, by = 1240, bub = ell(bx, by, 62 * pb, 34 * pb, 0, Math.PI * 2, 22);
    p.solid(bub, [1, 0.98, 0.92]); p.line(bub, 650, { closed: true, w: 1.8 });
    p.solid([[bx + 20 * pb, by + 28 * pb], [hx + 20, y0 - 44], [bx + 44 * pb, by + 20 * pb]], [1, 0.98, 0.92]); p.line([[bx + 20 * pb, by + 28 * pb], [hx + 20, y0 - 44], [bx + 44 * pb, by + 20 * pb]], 651, { w: 1.8 });
    p.text('yum!', bx, by + 12 * pb, 42 * pb, { a: pb, center: true });
  }
}

function sceneAcorn(p, t) {
  const a = acornAt(t); if (!a) return;
  const { x, y, spin } = a, c = Math.cos(spin), s = Math.sin(spin);
  const rotp = (pts) => pts.map(([px, py]) => [x + (px - x) * c - (py - y) * s, y + (px - x) * s + (py - y) * c]);
  if (t > 4.1 && t < 28 && !(t > T_CREEK0 - 1)) for (let k = 1; k < 6; k++) { const q = acornAt(t - 0.04 * k); if (q) p.dot(q.x, q.y, 4 - 0.5 * k, GOLD, 0.35 - 0.05 * k); }
  const body = rotp(ell(x, y + 2, R * 0.85, R * 1.05, 0, Math.PI * 2, 16)), cap = rotp(ell(x, y - R * 0.45, R * 0.95, R * 0.62, Math.PI, Math.PI * 2, 12).concat([[x + R * 0.95, y - R * 0.45]]));
  p.solid(body, [0.95, 0.86, 0.7]); p.fill(body, TAN, 1, 700, { w: 2.4, sp: 3 }); p.line(body, 701, { closed: true, w: 1.8 });
  p.solid(cap); p.fill(cap, DBROWN, 1, 702, { w: 2.2, sp: 2.6 }); p.line(cap, 703, { closed: true, w: 1.8 });
  p.line(rotp([[x, y - R * 1.05], [x + 2, y - R * 1.35]]), 704, { w: 2 });
}

// Screen-space sunset: diagonal crayon strokes revealed in random order, clipped under a wavy
// horizon, so the sky is "coloured in" over 8 s at the end.
function sceneSky(p, t) {
  const pr = prog(t, 50, 8); if (pr <= 0) return;
  const ctx = p.c;
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
  for (let i = W; i >= 0; i -= 20) ctx.lineTo(i, 300 + 26 * Math.sin(i / 70) + 12 * Math.sin(i / 23));
  ctx.closePath(); ctx.clip();
  const ang = 0.5, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, Dg = Math.hypot(W, 400) + 50, N = Math.floor(Dg / 7);
  const ord = Array.from({ length: N }, (_, k) => k).sort((a, b) => hsh(7, a, 1) - hsh(7, b, 1));
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let q = 0; q < Math.floor(pr * N); q++) { const k = ord[q], o = -Dg / 2 + (k + 0.5) * Dg / N, sh = 0.85 + 0.3 * hsh(7, k, 2); ctx.strokeStyle = rgba([0.99 * sh > 1 ? 1 : 0.99 * sh, 0.74 * sh, 0.36 * sh], 0.5); const bx = W / 2 + nx * o, by = 150 + ny * o; ctx.beginPath(); ctx.moveTo(bx - dx * Dg / 2, by - dy * Dg / 2); ctx.lineTo(bx + dx * Dg / 2, by + dy * Dg / 2); ctx.stroke(); }
  ctx.restore();
}

// ------------------------------------------------------------------ exports read by the engine
export const BACKGROUND = [sceneSky];
// Back to front. A later scene's paper underlay (p.solid) hides an earlier scene's lines.
export const SCENES = [
  sceneGround, sceneCreek, sceneMaple,
  sceneOak, sceneTrampolines, sceneSquirrel, sceneWeb, scenePots,
  sceneChute, sceneWheel, sceneGantry, sceneHedgehog,
  sceneBoat, sceneAcorn,
];
// Picture events for the score. Derive them from the motion code, never retype them by hand.
export const TIMES = { T_SEESAW, T_WEB, POTS: POTS.map((q) => q.t), T_TIP, T_CATCH };
