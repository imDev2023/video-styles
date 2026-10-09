// Text check for an ai-lab-launch film: every string the film draws (fillText / strokeText) is traced to screen space on
// sampled frames and flagged when it is cut off by the frame edge, overlaps other text, or is a gradient word whose glow
// runs under other text. A contact sheet does not show these: a cropped label reads as "fine" at thumbnail size, and a
// one-frame overlap is never on the sheet at all. Trust this over your eye.
//
//   node textcheck.mjs                 every 6th frame, plus the frame after every caption is fully typed and the frames either side of every anchor (about 30 s)
//   node textcheck.mjs --every 1       every frame (about 2 min, for the final pass)
//   node textcheck.mjs --json          machine-readable result
//
// Exit status 0 when no text is cut off, overlapping or under a glow, 1 otherwise.
// Deliberate crowding (the tiles flying in from outside the frame) goes in config.json under check.text_ignore as
// [anchor, from, to, "why"]: issues between T[anchor] + from and T[anchor] + to print as OK (allowed), not FAIL.
//
// The hook is installed into the film page before scenes.js loads (open() in render.mjs); drawCaption in engine.js tags
// the context with the caption it is typing (ctx.__textGroup), so letters drawn one at a time are judged as one string
// at the width typed so far.
//
// Adapted from tools/textcheck.mjs in the animate skill (https://github.com/cth9191/animate), which hooks the browser's
// CanvasRenderingContext2D the same way. MIT License, Copyright (c) 2026 cth9191. Permission is hereby granted, free of
// charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to
// do so, subject to the following conditions: The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { open } from './render.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const W = CFG.render.size, FPS = CFG.render.fps, MARGIN = 3;
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const json = args.includes('--json');
const every = Math.max(1, Number(flag('--every', 6)));

// ---- the hook, run inside the page before any script: records the screen-space box of every visible text draw
function hook(W) {
  window.__text = [];
  const alphaOf = (style) => { const m = /rgba?\(([^)]+)\)/.exec(String(style)); if (!m) return 1; const p = m[1].split(',').map((s) => parseFloat(s)); return p.length > 3 ? p[3] : 1; };
  const P = CanvasRenderingContext2D.prototype;
  for (const name of ['fillText', 'strokeText']) {
    const orig = P[name];
    P[name] = function (str, x, y, maxW) {
      const s = String(str), cv = this.canvas;
      if (s.trim() && cv.width === W && cv.height === W && this.globalAlpha * alphaOf(this.fillStyle) > 0.05) {
        const m = this.measureText(s), w = maxW != null ? Math.min(m.width, maxW) : m.width;
        const al = this.textAlign, x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
        const asc = m.actualBoundingBoxAscent || 0, desc = m.actualBoundingBoxDescent || 0;
        const tf = this.getTransform();
        const pts = [[x0, y - asc], [x0 + w, y - asc], [x0 + w, y + desc], [x0, y + desc]].map(([px, py]) => [tf.a * px + tf.c * py + tf.e, tf.b * px + tf.d * py + tf.f]);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        const size = parseFloat((/(\d+(\.\d+)?)px/.exec(this.font) || [0, 0])[1]) * tf.a;
        const glow = this.shadowBlur > 0 && alphaOf(this.shadowColor) > 0 ? this.shadowBlur * tf.a : 0;
        window.__text.push({ s, group: this.__textGroup || null, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), size, glow });
      }
      return orig.apply(this, arguments);
    };
  }
}

// ---- boxes of one frame: letters typed under one caption become one box (and one glow box for its gradient letters)
function boxesOf(rec) {
  const groups = new Map(), seen = new Set(), out = [];
  for (const r of rec) {
    if (r.group) {
      const g = groups.get(r.group) || { label: r.group, s: '', x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, glow: null, keys: new Set() };
      const key = Math.round(r.x0);                         // the glow pass and the fill pass draw the same letter at the same x
      if (!g.keys.has(key)) { g.keys.add(key); g.s += r.s; }
      g.x0 = Math.min(g.x0, r.x0); g.y0 = Math.min(g.y0, r.y0); g.x1 = Math.max(g.x1, r.x1); g.y1 = Math.max(g.y1, r.y1);
      if (r.glow) {
        const b = g.glow || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        b.x0 = Math.min(b.x0, r.x0 - r.glow); b.y0 = Math.min(b.y0, r.y0 - r.glow); b.x1 = Math.max(b.x1, r.x1 + r.glow); b.y1 = Math.max(b.y1, r.y1 + r.glow);
        g.glow = b;
      }
      groups.set(r.group, g);
    } else {
      const key = `${r.s}|${Math.round(r.x0)}|${Math.round(r.y0)}`;
      if (!seen.has(key)) { seen.add(key); out.push({ label: r.s, s: r.s, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, glow: null }); }
    }
  }
  return [...out, ...groups.values()].filter((b) => b.x1 - b.x0 > 2 && b.y1 - b.y0 > 2);
}
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const inter = (a, b) => area({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const short = (s) => (s.length > 36 ? s.slice(0, 36) + '...' : s);

// ---- sample frames: every N-th, the frame after each caption is fully typed, the frames either side of every anchor, the last
const { page, close, info } = await open({ init: hook, initArg: W });
const caps = await page.evaluate(() => window.film.captions());
const T = info.T, N = info.frames;
const frames = new Set();
for (let f = 0; f < N; f += every) frames.add(f);
for (const c of Object.values(caps)) frames.add(Math.round((c.tLast + 0.1) * FPS));
for (const [k, t] of Object.entries(T)) if (k !== 'end') { const f = Math.round(t * FPS); frames.add(f); frames.add(f - 1); }
frames.add(N - 1);
const sample = [...frames].filter((f) => f >= 0 && f < N).sort((a, b) => a - b);

const CUT = 'cut off by the frame edge', OVER = 'overlaps other text', GLOW = 'glow runs under other text';
const issues = new Map();
const add = (kind, text, t) => { const k = kind + '|' + text; const v = issues.get(k); if (v) { v.t1 = t; v.n++; } else issues.set(k, { kind, text, t0: t, t1: t, n: 1 }); };
for (const f of sample) {
  const t = f / FPS;
  const rec = await page.evaluate((t) => { window.__text.length = 0; window.film.seek(t); return window.__text; }, t);
  const boxes = boxesOf(rec);
  for (const b of boxes) {
    if (b.s.trim().length > 1 && (b.x0 < -MARGIN || b.y0 < -MARGIN || b.x1 > W + MARGIN || b.y1 > W + MARGIN)) add(CUT, short(b.label), t);
  }
  for (let i = 0; i < boxes.length; i++) for (let j = 0; j < boxes.length; j++) {
    if (i === j) continue;
    const a = boxes[i], b = boxes[j];
    if (a.label === b.label || a.label.includes(b.label) || b.label.includes(a.label)) continue;
    if (j > i && inter(a, b) > 0.25 * Math.min(area(a), area(b))) add(OVER, `"${short(a.label)}" x "${short(b.label)}"`, t);
    if (a.glow && inter(a.glow, b) > 4) add(GLOW, `"${short(a.label)}" over "${short(b.label)}"`, t);
  }
}
await close();

// ---- report
const ignore = (CFG.check && CFG.check.text_ignore) || [];
const ranges = ignore.map(([anchor, from, to, why]) => ({ a: T[anchor] + from, b: T[anchor] + to, why: `${anchor} ${from >= 0 ? '+' : ''}${from} to +${to} s: ${why || ''}` }));
const allowed = (i) => ranges.find((r) => i.t0 >= r.a - 1e-6 && i.t1 <= r.b + 1e-6);
const all = [...issues.values()], ok = all.filter(allowed), bad = all.filter((i) => !allowed(i));
const span = (i) => `${i.t0.toFixed(2)}${i.t1 > i.t0 ? `-${i.t1.toFixed(2)}` : ''} s`;
if (json) console.log(JSON.stringify({ sampled: sample.length, every, fail: bad, allowed: ok, pass: !bad.length }, null, 2));
else {
  console.log(`TEXT (every string drawn, traced to screen; ${sample.length} frames sampled: every ${every}${every === 1 ? '' : 'th'} frame, the frame after each caption is typed, the frames either side of every anchor)`);
  for (const i of bad) console.log(`  FAIL  ${i.kind}: ${i.text}  at ${span(i)} (${i.n} frame${i.n === 1 ? '' : 's'})`);
  for (const r of ranges) { const n = ok.filter((i) => i.t0 >= r.a - 1e-6 && i.t1 <= r.b + 1e-6); if (n.length) console.log(`  OK    ${n.length} issue${n.length === 1 ? '' : 's'} allowed by config.check.text_ignore (${r.why}): ${n.map((i) => `${i.kind}: ${i.text} at ${span(i)}`).join('; ')}`); }
  console.log(`text: ${bad.length ? 'FAIL' : 'PASS'} (${bad.filter((i) => i.kind === CUT).length} cut off, ${bad.filter((i) => i.kind === OVER).length} overlapping, ${bad.filter((i) => i.kind === GLOW).length} under a glow)`);
}
process.exit(bad.length ? 1 : 0);
