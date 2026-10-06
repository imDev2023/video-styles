// ENGINE - frame renderer. Outputs go to out/ (ignored by git).
//   node render.mjs test 4.5 12 ...      full-size PNG stills at those times -> out/test/
//   node render.mjs beats                one still per STORY beat in config.mjs -> out/test/
//   node render.mjs sheet [step]         contact sheet, one frame every `step` s (default 3) -> out/test/sheet.jpg
//   node render.mjs seg <a> <b> <out>    frames a..b-1 to an H.264 segment (run.mjs calls this)
import { Canvas } from 'skia-canvas';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIDEO, STORY, RENDER, PALETTE } from './config.mjs';
import { rgba } from './lib.mjs';
import { NF, loadFonts, buildCams, camAt, drawFrame } from './frame.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const testDir = path.join(here, 'out', 'test');
const { W, H, FPS } = VIDEO;

loadFonts();
const cams = buildCams();
const canvas = new Canvas(W, H), ctx = canvas.getContext('2d');
const name = (t) => `t${t.toFixed(1).padStart(4, '0')}.png`;

async function still(t, file) {
  drawFrame(ctx, t, camAt(cams, t));
  // toFile, not saveAs: saveAs is deprecated in skia-canvas 3 and silently wrote nothing.
  await canvas.toFile(file);
  console.log(path.relative(here, file));
}

const mode = process.argv[2];
if (mode === 'test') {
  fs.mkdirSync(testDir, { recursive: true });
  for (const s of process.argv.slice(3)) { const t = parseFloat(s); await still(t, path.join(testDir, name(t))); }
} else if (mode === 'beats') {
  fs.mkdirSync(testDir, { recursive: true });
  for (const { t, beat } of STORY) { console.log(`${t.toFixed(1).padStart(5)} s  ${beat}`); await still(t, path.join(testDir, 'beat_' + name(t))); }
} else if (mode === 'sheet') {
  fs.mkdirSync(testDir, { recursive: true });
  const step = parseFloat(process.argv[3] || '3'), times = [];
  for (let t = 1; t < VIDEO.DUR; t += step) times.push(t);
  const cols = 5, cell = 270, pad = 6, rows = Math.ceil(times.length / cols);
  const sheet = new Canvas(pad + cols * (cell + pad), pad + rows * (cell + pad)), sc = sheet.getContext('2d');
  sc.fillStyle = '#e6dfcf'; sc.fillRect(0, 0, sheet.width, sheet.height);
  for (const [i, t] of times.entries()) {
    drawFrame(ctx, t, camAt(cams, t));
    const x = pad + (i % cols) * (cell + pad), y = pad + Math.floor(i / cols) * (cell + pad);
    sc.drawImage(canvas, x, y, cell, cell);
    const label = `${t.toFixed(1)} s`; sc.font = '16px sans-serif';
    sc.fillStyle = rgba(PALETTE.PAPER, 0.85); sc.fillRect(x + 4, y + 4, sc.measureText(label).width + 8, 24);
    sc.fillStyle = rgba(PALETTE.INK); sc.fillText(label, x + 8, y + 21);
  }
  const out = path.join(testDir, 'sheet.jpg');
  await sheet.toFile(out, { quality: 0.85 });
  console.log(path.relative(here, out), `(${times.length} frames)`);
} else if (mode === 'seg') {
  const a = parseInt(process.argv[3]), b = Math.min(NF, parseInt(process.argv[4])), out = process.argv[5];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(RENDER.crf), '-preset', RENDER.preset, '-g', String(RENDER.gop), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((resolve, reject) => ff.on('close', (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));
  for (let i = a; i < b; i++) {
    drawFrame(ctx, i / FPS, cams[i]);
    const buf = await canvas.toBuffer('raw');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await closed;
} else {
  console.log('usage: node render.mjs test <t...> | beats | sheet [step] | seg <a> <b> <out.mp4>');
  process.exit(1);
}
