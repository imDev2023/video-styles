// ENGINE - text check. Every string the film draws (fillText / strokeText) is traced to screen space on sampled
// frames and flagged when it is cut off by the frame edge, overlaps other text, or sits under the phone UI.
// A contact sheet does not show these: a cropped label reads as "fine" at thumbnail size, and a one-frame
// overlap is never on the sheet at all. Trust this over your eye.
//
//   node textcheck.mjs                  every CHECK.textEvery-th frame plus every STORY beat (about 4 s for 60 s)
//   node textcheck.mjs --every 1        every frame (slow, for a final pass)
//   node textcheck.mjs --json           machine-readable result
//
// Exit status 0 when no text is cut off or overlapping (safe-zone hits are warnings), 1 otherwise.
// Deliberate crowding (a storm of speech bubbles flying past the edges) goes in config.mjs CHECK.textIgnore
// as [t0, t1, "why"] ranges; issues inside them print as OK (allowed), not FAIL.
//
// Pen.text clips a partly revealed string, so a string mid-reveal is measured at its full final width;
// the check judges where the text will sit once it is fully drawn, which is what matters.
//
// Adapted from tools/textcheck.mjs in the animate skill (https://github.com/cth9191/animate), which hooks
// the browser's CanvasRenderingContext2D; this one hooks skia-canvas's, the same API.
// MIT License, Copyright (c) 2026 cth9191. Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation files (the "Software"), to deal in the
// Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright notice and this permission
// notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import { Canvas, CanvasRenderingContext2D } from 'skia-canvas';
import { VIDEO, STORY, CHECK } from './config.mjs';
import { NF, loadFonts, buildCams, camAt, drawFrame } from './frame.mjs';

const { W, H, FPS } = VIDEO;
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const json = args.includes('--json');
const every = Math.max(1, Number(flag('--every', CHECK.textEvery ?? 6)));
const ignore = CHECK.textIgnore ?? [];
// The phone UI (platform chrome) covers the top, bottom and right edge of a vertical film. Scaled from the
// 1080x1920 zones in the animate grammar (what matters sits inside x 60-940, y 250-1500).
const safe = H > W ? (CHECK.safe ?? { top: Math.round(240 * H / 1920), bottom: Math.round(420 * H / 1920), right: Math.round(140 * W / 1080) }) : null;

// ---- hook every text draw on the real frame canvas and record its screen-space box
const rec = [];
const alphaOf = (style) => { const m = /rgba?\(([^)]+)\)/.exec(String(style)); if (!m) return 1; const parts = m[1].split(',').map((s) => parseFloat(s)); return parts.length > 3 ? parts[3] : 1; };
const P = CanvasRenderingContext2D.prototype;
const wrap = (name) => {
  const orig = P[name];
  P[name] = function (str, x, y, maxW) {
    const s = String(str);
    if (s.trim() && this.canvas.width === W && this.canvas.height === H && this.globalAlpha * alphaOf(this.fillStyle) > 0.05) {
      const m = this.measureText(s), w = maxW != null ? Math.min(m.width, maxW) : m.width;
      const al = this.textAlign, x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
      const asc = m.actualBoundingBoxAscent || 0, desc = m.actualBoundingBoxDescent || 0;
      const tf = this.getTransform();
      const pts = [[x0, y - asc], [x0 + w, y - asc], [x0 + w, y + desc], [x0, y + desc]].map(([px, py]) => [tf.a * px + tf.c * py + tf.e, tf.b * px + tf.d * py + tf.f]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      rec.push({ s, q: pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
    }
    return orig.apply(this, arguments);
  };
  return () => { P[name] = orig; };
};
const undo = [wrap('fillText'), wrap('strokeText')];

// ---- polygon helpers, so rotated or skewed text is judged by its real box, not its screen-aligned bounds
const area = (Q) => { let s = 0; for (let i = 0; i < Q.length; i++) { const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % Q.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s) / 2; };
const clip = (A, B) => { // Sutherland-Hodgman: convex polygon A clipped by convex polygon B
  const sgn = Math.sign((B[1][0] - B[0][0]) * (B[2][1] - B[0][1]) - (B[1][1] - B[0][1]) * (B[2][0] - B[0][0])) || 1;
  let out = A;
  for (let i = 0; i < B.length && out.length; i++) {
    const a = B[i], b = B[(i + 1) % B.length], inside = (p) => sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
    const inp = out; out = [];
    for (let j = 0; j < inp.length; j++) {
      const cur = inp[j], prev = inp[(j + inp.length - 1) % inp.length];
      const hit = () => { const dx = cur[0] - prev[0], dy = cur[1] - prev[1], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; const t = den ? ((a[0] - prev[0]) * ey - (a[1] - prev[1]) * ex) / den : 0; return [prev[0] + t * dx, prev[1] + t * dy]; };
      if (inside(cur)) { if (!inside(prev)) out.push(hit()); out.push(cur); } else if (inside(prev)) out.push(hit());
    }
  }
  return out;
};

// ---- render the sampled frames
loadFonts();
const cams = buildCams();
const canvas = new Canvas(W, H), ctx = canvas.getContext('2d');
const frames = new Set();
for (let f = 0; f < NF; f += every) frames.add(f);
for (const { t } of STORY) { const f = Math.round(t * FPS); if (f >= 0 && f < NF) frames.add(f); }
frames.add(NF - 1);
const issues = new Map();
const add = (kind, text, t) => { const k = kind + '|' + text; const v = issues.get(k); if (v) { v.t1 = t; v.n++; } else issues.set(k, { kind, text, t0: t, t1: t, n: 1 }); };
const CUT = 'cut off by the frame edge', OVER = 'overlaps other text', SAFE = 'under the phone UI (safe zone)';
let sampled = 0;
for (const f of [...frames].sort((a, b) => a - b)) {
  const t = f / FPS;
  rec.length = 0; drawFrame(ctx, t, camAt(cams, t)); sampled++;
  const seen = new Map();
  for (const b of rec) { const k = `${b.s}|${Math.round(b.x0)}|${Math.round(b.y0)}`; if (!seen.has(k)) seen.set(k, b); }
  const boxes = [...seen.values()].filter((b) => b.x1 - b.x0 > 2 && b.y1 - b.y0 > 2);
  for (const b of boxes) {
    const label = b.s.length > 40 ? b.s.slice(0, 40) + '...' : b.s;
    // single characters (a "z" over a sleeper, a "?") are decoration a close-up may crop; words are not
    if (b.s.trim().length > 1 && (b.x0 < -3 || b.y0 < -3 || b.x1 > W + 3 || b.y1 > H + 3)) add(CUT, label, t);
    else if (safe && b.y0 > safe.top && (b.y1 > H - safe.bottom + 2 || (b.x1 > W - safe.right + 2 && b.y0 < H - safe.bottom))) add(SAFE, label, t);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.s === b.s || a.s.includes(b.s) || b.s.includes(a.s)) continue;
    if (Math.min(a.x1, b.x1) <= Math.max(a.x0, b.x0) || Math.min(a.y1, b.y1) <= Math.max(a.y0, b.y0)) continue;
    const small = Math.min(area(a.q), area(b.q));
    if (area(clip(a.q, b.q)) > 0.25 * small) add(OVER, `"${a.s.slice(0, 24)}" x "${b.s.slice(0, 24)}"`, t);
  }
}
undo.forEach((u) => u());

// ---- report
const allowed = (i) => ignore.find(([a, b]) => i.t0 >= a - 1e-6 && i.t1 <= b + 1e-6);
const all = [...issues.values()], ok = all.filter(allowed), rest = all.filter((i) => !allowed(i));
const bad = rest.filter((i) => i.kind !== SAFE), warn = rest.filter((i) => i.kind === SAFE);
const span = (i) => `${i.t0.toFixed(2)}${i.t1 > i.t0 ? `-${i.t1.toFixed(2)}` : ''} s`;
if (json) console.log(JSON.stringify({ sampled, every, safe, fail: bad, warn, allowed: ok, pass: !bad.length }, null, 2));
else {
  console.log(`TEXT (every string drawn, traced to screen; ${sampled} frames sampled, every ${every}${every === 1 ? '' : 'th'} frame plus every STORY beat${safe ? `; phone safe zone top ${safe.top}, bottom ${safe.bottom}, right ${safe.right}` : ''})`);
  for (const i of [...bad, ...warn]) console.log(`  ${bad.includes(i) ? 'FAIL' : 'WARN'}  ${i.kind}: ${i.text}  at ${span(i)} (${i.n} frame${i.n === 1 ? '' : 's'})`);
  for (const [a, b, why] of ignore) { const n = ok.filter((i) => i.t0 >= a - 1e-6 && i.t1 <= b + 1e-6).length; if (n) console.log(`  OK    ${n} issue${n === 1 ? '' : 's'} in ${a}-${b} s allowed by CHECK.textIgnore: ${why || ''}`); }
  console.log(`text: ${bad.length ? 'FAIL' : 'PASS'} (${bad.length} cut-off/overlap, ${warn.length} in the safe zone)`);
}
process.exit(bad.length ? 1 : 0);
