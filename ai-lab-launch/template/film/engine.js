// The ai-lab-launch engine: liquid glass, pastel aura, typed captions, camera drift, crossfades and
// motion-blurred frames. Nothing in this file changes per video; content comes from ../config.json
// and the scenes in scenes.js. Every frame is a pure function of time: seek(t) draws it.

export const W = 1440, H = 1440;          // design space; layouts in scenes.js are in these units
export const XA = 0.1, XD = 0.35;         // scene crossfades start 0.1 s before a phrase and last 0.35 s

// Shared state, filled by load().
export const S = { cfg: null, words: [], T: {}, IMG: {}, CAP: {}, C: {}, SIX: 0, V0: 0 };

// ---------------------------------------------------------------- small helpers
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const eSine = (p) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(p));
export const eOut3 = (p) => 1 - Math.pow(1 - clamp(p), 3);
export const eIn3 = (p) => Math.pow(clamp(p), 3);
export const eInOut3 = (p) => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
export const eOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(p)));
export const fade = (t, a, d = 0.35, ease = eSine) => ease((t - a) / d);
// While subframes are rendered, TQ is the frame's centre time. Discrete things (typed letters, the caret,
// 16th-note switches) read it, so motion blur never averages two states into a ghost caret or a half-and-half image.
let TQ = null;
export const tq = (t) => (TQ === null ? t : TQ);
export function rng(seed) { // mulberry32: fixed seeds keep every frame reproducible
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function canvas(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export const font = (ctx, weight, size, stretch = 'normal') => { ctx.font = `${weight} ${size}px ${S.cfg.brand.font.family}`; ctx.fontStretch = stretch; };
export function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
export function mix(a, b, p) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((A >> s) & 255, (B >> s) & 255, clamp(p)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------------------------------------------------------------- loading
export async function load(build) {
  const cfg = S.cfg = await (await fetch('../config.json')).json();
  S.V0 = cfg.render.voice_lead_in;
  S.SIX = 60 / cfg.music.bpm / 4;
  const b = cfg.brand;
  S.C = { ink: b.ink, ink2: b.ink2, ink3: b.ink3, line: '#e3e6ee', cobaltStrong: b.accentStrong, cobalt: b.accent, peri: b.accent2, plate: b.plate, fog: b.fog };
  const wj = await (await fetch('../voice/words.json')).json();
  for (const w of wj.words) S.words.push({ ...w, t0: w.t0 + S.V0, t1: w.t1 + S.V0 });
  for (const [k, [i, expect]] of Object.entries(cfg.anchors)) {
    const got = S.words[i] && S.words[i].w.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (got !== expect) throw new Error(`anchor ${k}: word ${i} is "${S.words[i] && S.words[i].w}", expected "${expect}"`);
    S.T[k] = S.words[i].t0;
  }
  S.T.end = Math.ceil((S.words[cfg.anchors.last[0]].t1 + cfg.render.hold_end) * cfg.render.fps) / cfg.render.fps;

  const man = await (await fetch('../assets/img/manifest.json')).json();
  const img = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  for (const k of Object.keys(man)) S.IMG[k] = await Promise.all(man[k].map((m) => img('../assets/' + m.file)));
  S.IMG.logo = await img('../' + b.logo);
  const ff = new FontFace(b.font.family, `url(../${b.font.file})`, { weight: '100 900', stretch: b.font.stretch });
  document.fonts.add(await ff.load());
  buildShadow();
  build();
}

export function posterize(im, levels = 4) {
  const c = canvas(im.width, im.height), x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) for (let k = 0; k < 3; k++) p[i + k] = Math.round(Math.round((p[i + k] / 255) * levels) / levels * 255);
  x.putImageData(d, 0, 0);
  return c;
}

// One soft lift shadow, drawn once and stretched under every card.
let SHADOW;
function buildShadow() {
  SHADOW = canvas(400, 400);
  const x = SHADOW.getContext('2d');
  x.shadowColor = 'rgba(18,24,38,0.30)'; x.shadowBlur = 48; x.shadowOffsetX = 2000; x.shadowOffsetY = 18;
  x.fillStyle = '#000'; rr(x, 100 - 2000, 100, 200, 200, 22); x.fill();
}
export function shadow(ctx, cx, cy, w, h, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha * 0.9;
  ctx.drawImage(SHADOW, cx - w, cy - h, w * 2, h * 2);
  ctx.restore();
}

// ---------------------------------------------------------------- captions
// A caption is laid out at its finished width, then typed letter by letter at the spoken moments.
// No full stops on screen; a spoken dash becomes a comma where config.display.comma_after says so.
function display(w, i) {
  const d = S.cfg.display;
  let s = d.comma_after.includes(i) ? w + ',' : w;
  s = s.replace(/\.\.\.$/, '').replace(/[.?!]$/, '');
  return d.lowercase.includes(s) ? s.toLowerCase() : s;
}
function letterTimes(word, n) {
  const dur = clamp((word.t1 - word.t0) * 0.75, 0.04, n * 0.075);
  return Array.from({ length: n }, (_, k) => word.t0 + (dur * k) / n);
}
export function caption(idx, style, extra = {}) {
  const cap = { style, chars: [], ...extra };
  const c = canvas(8, 8).getContext('2d');
  font(c, style.weight, style.size, style.stretch);
  c.letterSpacing = style.spacing || '0px';
  let text = '';
  const marks = [];
  idx.forEach((i, n) => {
    const w = S.words[i], s = display(w.w, i);
    const times = letterTimes(w, s.length);
    if (n > 0) marks.push({ ch: ' ', t: w.t0, grad: false });
    [...s].forEach((ch, k) => marks.push({ ch, t: times[k], grad: style.grad && w.w.toLowerCase() === style.grad, word: i }));
    text += (n ? ' ' : '') + s;
  });
  const full = c.measureText(text).width;
  let pre = '';
  for (const m of marks) { m.x = c.measureText(pre).width; pre += m.ch; m.x1 = c.measureText(pre).width; cap.chars.push(m); }
  cap.width = full;
  cap.text = text;
  cap.tFirst = marks[0].t;
  cap.tLast = marks[marks.length - 1].t;
  return cap;
}
// Typed text that is not in the voice (the prompt in the bar).
export function typedText(text, t0, step, style) {
  const c = canvas(8, 8).getContext('2d');
  font(c, style.weight, style.size, style.stretch);
  const cap = { style, chars: [] };
  let pre = '';
  [...text].forEach((ch, k) => { const m = { ch, t: t0 + k * step }; m.x = c.measureText(pre).width; pre += ch; m.x1 = c.measureText(pre).width; cap.chars.push(m); });
  cap.width = c.measureText(text).width; cap.text = text; cap.tFirst = t0; cap.tLast = t0 + (text.length - 1) * step;
  return cap;
}
export function drawCaption(ctx, cap, t, x, y, { alpha = 1, align = 'center', color, caret = true, caretHold = 0.6 } = {}) {
  t = tq(t);
  if (alpha <= 0.001 || t < cap.tFirst) return;
  const s = cap.style, C = S.C;
  const x0 = align === 'center' ? x - cap.width / 2 : x;
  ctx.save();
  font(ctx, s.weight, s.size, s.stretch);
  ctx.letterSpacing = s.spacing || '0px';
  ctx.textBaseline = 'alphabetic';
  let lastX = x0;
  // Gradient word: a faint glow first, then the letters in the brand gradient.
  const g = cap.chars.filter((m) => m.grad);
  let grad = null;
  if (g.length) {
    grad = ctx.createLinearGradient(x0 + g[0].x, 0, x0 + g[g.length - 1].x1, 0);
    const stops = S.cfg.brand.gradient;
    stops.forEach((col, i) => grad.addColorStop(i / (stops.length - 1), col));
  }
  for (const m of cap.chars) {
    if (t < m.t) break;
    const k = clamp((t - m.t) / 0.06);
    const a = alpha * k;
    lastX = x0 + m.x + (m.x1 - m.x) * eSine(k);   // the caret glides with the letter as it fades in
    if (m.ch === ' ') continue;
    ctx.globalAlpha = a;
    if (m.grad) {
      ctx.save();
      ctx.shadowColor = S.cfg.brand.glow; ctx.shadowBlur = s.size * 0.45;
      ctx.fillStyle = grad; ctx.globalAlpha = a * 0.55;
      ctx.fillText(m.ch, x0 + m.x, y);
      ctx.restore();
      ctx.globalAlpha = a;
      ctx.fillStyle = grad;
    } else ctx.fillStyle = color || s.color;
    ctx.fillText(m.ch, x0 + m.x, y);
  }
  if (caret) {
    const ca = alpha * (1 - fade(t, cap.tLast + caretHold, 0.3));
    if (ca > 0) {
      ctx.globalAlpha = ca;
      ctx.fillStyle = color || s.color;
      const cw = Math.max(3, s.size * 0.045);
      ctx.fillRect(lastX + s.size * 0.06, y - s.size * 0.78, cw, s.size * 0.98);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- camera
// Each scene pushes 1.00 -> 1.04; a scene that takes over the last one's content starts at its end zoom.
let CAMS = [];
export function setCameras(list) {
  CAMS = list;
  let prevEnd = 1;
  for (const c of CAMS) { c.z0 = c[2] === 'handoff' ? prevEnd : 1; prevEnd = c.z0 + 0.04; }
}
function drift(p) { return p < 0 ? 0.7 * p : p > 1 ? 1 + 0.7 * (p - 1) : 0.7 * p + 0.3 * eSine(p); }
export function zoomAt(i, t) { const c = CAMS[i]; return c.z0 + 0.04 * drift((t - c[0]) / (c[1] - c[0])); }
export function camera(ctx, z) { ctx.setTransform(z, 0, 0, z, (1 - z) * W / 2, (1 - z) * H / 2); }
const toScreen = (z, x, y) => [W / 2 + (x - W / 2) * z, H / 2 + (y - H / 2) * z];

// ---------------------------------------------------------------- liquid glass
// Frost the scene behind the shape, bend it along the edge like thick glass, then milk, sheen, rim.
export function glass(ctx, bg, x, y, w, h, r, { alpha = 1, z = 1, milk = 0.34 } = {}) {
  if (alpha <= 0.001) return;
  [x, y] = toScreen(z, x, y); w *= z; h *= z; r *= z;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  shadow(ctx, x + w / 2, y + h / 2 + 6, w * 0.62, h * 0.66, 0.8);
  const m = 40, sx = Math.max(0, x - m), sy = Math.max(0, y - m), sw = Math.min(W - sx, w + 2 * m), sh = Math.min(H - sy, h + 2 * m);
  // body: the scene behind, frosted
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.filter = 'blur(14px) saturate(1.25)';
  ctx.drawImage(bg, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.filter = 'none';
  ctx.restore();
  // edge: a lightly blurred copy magnified 1.06x, seen only in a 12 px band
  const band = 12 * z, k = 1.06, cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  rr(ctx, x, y, w, h, r); rr(ctx, x + band, y + band, w - 2 * band, h - 2 * band, Math.max(0, r - band));
  ctx.clip('evenodd');
  ctx.filter = 'blur(2px) saturate(1.3)';
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  ctx.drawImage(bg, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.filter = 'none';
  ctx.restore();
  // milk and sheen
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = `rgba(255,255,255,${milk})`; ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();
  // rim: bright on top-left, softer on bottom-right, plus a hairline of ink for definition
  const rim = ctx.createLinearGradient(x, y, x + w, y + h);
  rim.addColorStop(0, 'rgba(255,255,255,0.95)'); rim.addColorStop(0.5, 'rgba(255,255,255,0.45)'); rim.addColorStop(1, 'rgba(255,255,255,0.85)');
  ctx.lineWidth = 2 * z; ctx.strokeStyle = rim; rr(ctx, x + z, y + z, w - 2 * z, h - 2 * z, r - z); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(18,24,38,0.08)'; rr(ctx, x - 0.5, y - 0.5, w + 1, h + 1, r); ctx.stroke();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  const top = ctx.createLinearGradient(0, y, 0, y + 3 * z);
  top.addColorStop(0, 'rgba(255,255,255,1)'); top.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.lineWidth = 3 * z; ctx.strokeStyle = top; rr(ctx, x + 1.5 * z, y + 1.5 * z, w - 3 * z, h - 3 * z, r - 1.5 * z); ctx.stroke();
  const low = ctx.createLinearGradient(0, y + h - 14 * z, 0, y + h);
  low.addColorStop(0, 'rgba(18,24,38,0)'); low.addColorStop(1, 'rgba(18,24,38,0.06)');
  ctx.fillStyle = low; ctx.fillRect(x, y + h - 14 * z, w, 14 * z);
  ctx.restore();
  ctx.restore();
}

// A slow pastel aura in the brand colours, so the glass has something to bend.
export function aura(ctx, t, cx, cy, s = 1, alpha = 1) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const [col, a, rad, sp, ph] of S.cfg.brand.aura) {
    const bx = cx + Math.cos(t * sp * 2 * Math.PI + ph) * 190 * s, by = cy + Math.sin(t * sp * 1.6 * Math.PI + ph * 1.3) * 90 * s;
    const R = rad * s;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, R);
    g.addColorStop(0, hexA(col, a)); g.addColorStop(0.55, hexA(col, a * 0.5)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(bx - R, by - R, 2 * R, 2 * R);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- shared drawing
export function card(ctx, im, cx, cy, size, { alpha = 1, rot = 0, r = 0.09, shadowA = 1, filter = null } = {}) {
  if (alpha <= 0.001 || size <= 1) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy); ctx.rotate(rot);
  shadow(ctx, 0, 6, size * 0.62, size * 0.62, shadowA);
  rr(ctx, -size / 2, -size / 2, size, size, size * r); ctx.clip();
  if (filter) ctx.filter = filter;
  ctx.drawImage(im, -size / 2, -size / 2, size, size);
  ctx.restore();
}
export function cover(ctx, im, z = 1) {
  const s = Math.max(W / im.width, H / im.height) * z;
  ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
}
// "BASE/LABEL": a two-part mark with the brand's slash between the parts (for example a coin/quote pair).
export function slashMark(ctx, base, label, x, y, size, { color = '#fff', slash = S.C.peri, alpha = 1, labelAlpha = 0.72 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha;
  font(ctx, 800, size, 'expanded'); ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color; ctx.fillText(base, x, y);
  let w = ctx.measureText(base).width;
  ctx.fillStyle = slash; ctx.fillText('/', x + w + size * 0.02, y);
  w += ctx.measureText('/').width + size * 0.04;
  ctx.globalAlpha *= labelAlpha; ctx.fillStyle = color;
  if (typeof label === 'function') label(ctx, x + w, y); else ctx.fillText(label, x + w, y);
  ctx.restore();
}

// ---------------------------------------------------------------- the frame
// scenes: [{ a, b, draw(L, t), out?: 'through' }]. 'through' lets an outgoing white-page scene clear
// before the next arrives, so captions in the same place never overlap.
let SCENES = [];
export function setScenes(list) { SCENES = list; }
const LAYERS = [];
function layer() {
  const c = canvas(), b = canvas();
  return { c, ctx: c.getContext('2d'), bg: b, bctx: b.getContext('2d') };
}
let octx;
export function seek(t) {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = 1;
  octx.fillStyle = '#fff'; octx.fillRect(0, 0, W, H);
  let n = 0;
  for (const s of SCENES) {
    const through = s.out === 'through';
    const vis = t >= (s.a ? s.a - XA : -1) && t < (through ? s.b - XA + 0.14 : s.b - XA + XD);
    if (!vis) continue;
    const L = LAYERS[n] || (LAYERS[n] = layer()); n++;
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.filter = 'none';
    L.ctx.clearRect(0, 0, W, H);
    s.draw(L, t);
    octx.globalAlpha = (s.a ? fade(t, s.a - XA, XD) : 1) * (through ? 1 - fade(t, s.b - XA - 0.2, 0.32) : 1);
    octx.drawImage(L.c, 0, 0);
  }
  octx.globalAlpha = 1;
}

// Render one output frame: average `subs` subframes across the shutter (0.5 = 180 degrees).
let ACC;
export function frameRGB(f) {
  const { subframes: subs, fps, shutter } = S.cfg.render;
  const n = W * H;
  if (!ACC) ACC = new Uint16Array(n * 3);
  ACC.fill(0);
  for (let s = 0; s < subs; s++) {
    const t = f / fps + ((s + 0.5) / subs - 0.5) * (shutter / fps);
    TQ = f / fps;
    seek(Math.max(0, t));
    const d = octx.getImageData(0, 0, W, H).data;
    for (let i = 0, j = 0; i < n * 4; i += 4, j += 3) { ACC[j] += d[i]; ACC[j + 1] += d[i + 1]; ACC[j + 2] += d[i + 2]; }
  }
  TQ = null;
  const out = new Uint8Array(n * 3), half = subs >> 1;
  for (let j = 0; j < n * 3; j++) out[j] = (ACC[j] + half) / subs;
  let bin = '';
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function boot(build, events) {
  octx = document.getElementById('out').getContext('2d', { willReadFrequently: true });
  window.film = {
    ready: load(build).then(() => ({ duration: S.T.end, T: S.T, frames: Math.round(S.T.end * S.cfg.render.fps) })),
    seek, events, frameRGB,
  };
}
