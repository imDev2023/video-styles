// ENGINE - turns the per-video world (world.mjs) and settings (config.mjs) into frames.
// Nothing in here is per-video: change the title, end card, fades and camera smoothing in
// config.mjs, and the scenes and camera keyframes in world.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FontLibrary } from 'skia-canvas';
import { cl, sm, lerp, prog, rgba, rrect, Pen } from './lib.mjs';
import { VIDEO, PALETTE, FONT, TITLE, END, FADE, CAMERA } from './config.mjs';
import { cameraKeys, BACKGROUND, SCENES } from './world.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const { W, H, FPS, DUR } = VIDEO;
export const NF = Math.round(DUR * FPS);

// Register the handwriting font from assets/ (fetch-assets.mjs) so the render does not depend on
// what happens to be installed. skia-canvas silently substitutes a default face for a missing
// family, so a missing font is reported loudly here instead.
export function loadFonts() {
  const file = path.join(here, FONT.file);
  if (fs.existsSync(file)) FontLibrary.use(FONT.family, [file]);
  else if (!FontLibrary.has(FONT.family)) console.warn(`WARNING: font "${FONT.family}" not found. Run "node fetch-assets.mjs" or text will render in a fallback face.`);
}

// Per-frame camera [x, y, zoom]: linear interpolation between keyframes, then a Gaussian blur
// over time (sigma CAMERA.smooth seconds) so every move eases in and out.
export function buildCams() {
  const keys = cameraKeys();
  const arr = Array.from({ length: NF }, () => [0, 0, 0]);
  for (let i = 0; i < NF; i++) {
    const t = i / FPS; let j = 0; while (j < keys.length - 2 && keys[j + 1][0] <= t) j++;
    const a = keys[j], b = keys[j + 1], u = cl((t - a[0]) / (b[0] - a[0]));
    for (let k = 0; k < 3; k++) arr[i][k] = lerp(a[k + 1], b[k + 1], u);
  }
  const sigma = CAMERA.smooth * FPS, half = Math.ceil(3 * sigma), ker = []; let sum = 0;
  for (let i = -half; i <= half; i++) { const v = Math.exp(-0.5 * (i / sigma) ** 2); ker.push(v); sum += v; }
  const out = arr.map(() => [0, 0, 0]);
  for (let i = 0; i < NF; i++) for (let k = 0; k < 3; k++) { let s = 0; for (let q = -half; q <= half; q++) s += ker[q + half] * arr[Math.min(NF - 1, Math.max(0, i + q))][k]; out[i][k] = s / sum; }
  return out;
}
export const camAt = (cams, t) => cams[Math.min(cams.length - 1, Math.max(0, Math.round(t * FPS)))];

const envelope = (t, [s0, sd], [h0, hd]) => sm(prog(t, s0, sd)) * (1 - sm(prog(t, h0, hd)));

export function drawFrame(ctx, t, cam) {
  const [cx, cy, z] = cam;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = rgba(PALETTE.PAPER); ctx.fillRect(0, 0, W, H);
  const sp = new Pen(ctx, 1, t, W / 2, H / 2, W, H); // screen-space pen
  for (const layer of BACKGROUND) layer(sp, t);
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
  const p = new Pen(ctx, z, t, cx, cy, W, H); // world-space pen
  for (const scene of SCENES) scene(p, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // title banner: paper card, light crayon hatch, pencil border, two lines of handwriting
  const tb = envelope(t, TITLE.show, TITLE.hide);
  if (tb > 0.01) {
    ctx.save(); ctx.globalAlpha = tb;
    const [bx, by, bw, bh] = TITLE.box, ban = rrect(bx, by, bw, bh, TITLE.radius, 6);
    sp.solid(ban, PALETTE.BANNER); sp.fill(ban, TITLE.hatch, TITLE.hatchAmount, 801, { w: 3, sp: 5 }); sp.line(ban, 802, { closed: true, w: 2.6 });
    TITLE.lines.forEach((line, i) => sp.text(line, W / 2, TITLE.baselines[i], TITLE.size, { center: true, reveal: 1, font: FONT.family, weight: FONT.weight }));
    ctx.restore();
  }
  const en = envelope(t, END.show, END.hide);
  if (en > 0.01) sp.text(END.text, W / 2, END.y, END.size, { center: true, a: en, font: FONT.family, weight: FONT.weight });

  // fade in from paper and out to paper
  const fade = Math.max(1 - t / FADE.in, 0, (t - (DUR - FADE.out)) / FADE.out);
  if (fade > 0) { ctx.globalAlpha = Math.min(1, fade); ctx.fillStyle = rgba(PALETTE.PAPER); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
