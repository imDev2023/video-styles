#!/usr/bin/env node
// Frame strip: EVERY frame of a short stretch of a finished render, tiled into one image with its frame number on each.
// A contact sheet shows the shape of a piece; a strip shows its motion: a turn, a take, a jump, a transition, a seam.
// Read it like a viewer: where is the eye at each frame, and how many frames does each thing get (24 frames = 1 s)?
// Timing failures (a read that flashes by in three frames, two reads on top of each other, a pop between frames,
// every part moving at once) are visible here and invisible on a sheet.
//
// Works for any pipeline: it only needs the video file, ffprobe and ffmpeg (with drawtext) on the PATH, and Node 18 or newer.
//
//   node styles/tools/strip.mjs out/final.mp4 --from 15.2 --dur 0.5                     # 12 frames at 24 fps, 6 per row
//   node styles/tools/strip.mjs out/final.mp4 --from 6.3 --dur 1 --cols 8 --w 200       # a longer stretch, smaller tiles
//   node styles/tools/strip.mjs out/final.mp4 --from 15.2 --dur 0.5 --out out/check/strip-cut.jpg
//
// The idea is the --strip mode of render.mjs in JohnHeibel/ClaudeAnimationBase (MIT), written here on ffmpeg so it
// takes any mp4 instead of a page that re-renders frames.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const from = Number(flag('--from', '0'));
const dur = Number(flag('--dur', '0.5'));
const cols = Math.max(1, parseInt(flag('--cols', '6'), 10));
const w = Math.max(64, parseInt(flag('--w', '240'), 10));
let out = flag('--out', null);
const video = args[0];
if (!video || !fs.existsSync(video) || !(dur > 0)) {
  console.error('usage: node styles/tools/strip.mjs <video> --from <s> --dur <s> [--cols 6] [--w 240] [--out strip.jpg]');
  process.exit(2);
}

const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,nb_frames',
  '-of', 'csv=p=0', video], { encoding: 'utf8' });
if (probe.status !== 0) { console.error(probe.stderr.trim()); process.exit(2); }
const [rate, nbFrames] = probe.stdout.trim().split(',');
const [num, den = '1'] = rate.split('/');
const fps = Number(num) / Number(den);
const first = Math.round(from * fps);
const n = Math.max(1, Math.round(dur * fps));
const last = Math.min(first + n - 1, (Number(nbFrames) || Infinity) - 1);
const count = last - first + 1;
const rows = Math.ceil(count / cols);
if (!out) out = `${path.basename(video, path.extname(video))}-strip-${first}-${last}.jpg`;
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

// drawtext's n counts from the first decoded frame, so add the start frame to label each tile with its film frame number.
const label = `drawtext=text='%{eif\\:n+${first}\\:d}':fontsize=${Math.round(w / 5)}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4:x=8:y=8`;
const vf = `select='between(n\\,${first}\\,${last})',${label},scale=${w}:-2,tile=${cols}x${rows}:padding=4:margin=4:color=0x202020`;
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', vf, '-vsync', 'vfr', '-frames:v', '1', '-q:v', '3', out], { encoding: 'utf8' });
if (r.status !== 0 || !fs.existsSync(out)) { console.error(r.stderr.trim() || 'ffmpeg wrote nothing'); process.exit(2); }
console.log(`${out}: frames ${first} to ${last} (${count} frames, ${(count / fps).toFixed(2)} s at ${fps} fps), ${cols} per row`);
