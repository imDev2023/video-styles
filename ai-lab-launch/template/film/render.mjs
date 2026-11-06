// Render the film with Playwright: config.render fps and motion-blur subframes, raw frames piped to ffmpeg.
//
//   node render.mjs stills <t> [t...]      PNG stills into ../out/stills/
//   node render.mjs events                 sound events into ../out/events.json
//   node render.mjs seg <f0> <f1> <out>    one segment of frames
//   node render.mjs full [workers]         every frame, in parallel segments, into ../out/silent.mp4
//
// textcheck.mjs imports open() from here: the served page with window.film ready, plus an optional script injected before it loads.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'out');
// Playwright comes from the workspace's js-kit (the template is copied into <workspace>/videos/<name>/).
const JS_KIT = process.env.JS_KIT || path.resolve(ROOT, '../../js-kit');
const require = createRequire(path.join(JS_KIT, 'package.json'));
const { chromium } = require('playwright');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const W = 1440, FPS = CFG.render.fps;

// every type the page loads: an image served without its type never decodes (an SVG logo stalls the film's load)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

export async function open({ init = null, initArg = undefined } = {}) {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 760, height: 760 } });
  if (init) await page.addInitScript(init, initArg);
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/film/index.html`);
  const info = await page.evaluate(() => window.film.ready);
  return { srv, browser, page, info, close: async () => { await browser.close(); srv.close(); } };
}

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  return { p, done };
}
const raw = ['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${W}`, '-r', String(FPS), '-i', '-'];
async function frame(page, f) {
  return Buffer.from(await page.evaluate((f) => window.film.frameRGB(f), f), 'base64');
}
async function write(p, buf) { if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r)); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const [mode, ...args] = process.argv.slice(2);
if (!isMain) {
  // imported by textcheck.mjs: no command runs
} else if (mode === 'stills') {
  const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
  const { page, close, info } = await open();
  for (const a of args) {
    const t = Number(a), f = Math.round(t * FPS);
    const { p, done } = ffmpeg([...raw, '-frames:v', '1', path.join(dir, `t${t.toFixed(2)}.png`)]);
    await write(p, await frame(page, f)); p.stdin.end(); await done;
    console.log('still', t, '->', `t${t.toFixed(2)}.png`);
  }
  console.log(JSON.stringify(info.T));
  await close();
} else if (mode === 'events') {
  const { page, close, info } = await open();
  const ev = await page.evaluate(() => window.film.events());
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify({ T: info.T, duration: info.duration, frames: info.frames, events: ev }, null, 1));
  console.log(ev.length, 'events, duration', info.duration);
  await close();
} else if (mode === 'seg') {
  const [f0, f1, out] = [Number(args[0]), Number(args[1]), args[2]];
  const { page, close } = await open();
  const { p, done } = ffmpeg([...raw, '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', out]);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await write(p, await frame(page, f));
    if ((f - f0) % 30 === 0) console.log(`seg ${f0}-${f1}: frame ${f} (${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)} ms/frame)`);
  }
  p.stdin.end(); await done; await close();
} else if (mode === 'full') {
  const workers = Number(args[0] || 6);
  const { info, close } = await open(); await close();
  const n = info.frames, per = Math.ceil(n / workers);
  const segDir = path.join(OUT, 'segs'); fs.mkdirSync(segDir, { recursive: true });
  const segs = [];
  await Promise.all(Array.from({ length: workers }, (_, i) => {
    const a = i * per, b = Math.min(n, a + per), file = path.join(segDir, `seg${String(i).padStart(2, '0')}.mp4`);
    segs.push(file);
    return new Promise((res, rej) => {
      const c = spawn(process.execPath, [fileURLToPath(import.meta.url), 'seg', String(a), String(b), file], { stdio: 'inherit' });
      c.on('close', (code) => (code ? rej(new Error('segment ' + i)) : res()));
    });
  }));
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, segs.sort().map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
  const { done } = ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(OUT, 'silent.mp4')]);
  await done;
  console.log('silent.mp4:', n, 'frames');
} else {
  console.log('usage: stills|events|seg|full');
}
