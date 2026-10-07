#!/usr/bin/env node
// Dead-beat check: finds stretches of a finished render where the picture barely changes.
// Something new should happen on screen every 2 to 4 seconds (a move, a reveal, a reaction, a cut);
// a stretch longer than --max seconds with no visible change is a dead beat the eye tends to forgive on a contact sheet.
//
// Works for any pipeline: it only needs the video file, ffprobe and ffmpeg on the PATH, and Node 18 or newer.
// It decodes the film to small grayscale frames and measures each frame's change against the frame half a second earlier.
//
//   node styles/tools/deadbeats.mjs out/silent.mp4                       # default: warn on stretches over 3 s
//   node styles/tools/deadbeats.mjs out/final.mp4 --max 2.5              # stricter limit for a fast-cut piece
//   node styles/tools/deadbeats.mjs out/final.mp4 --exempt 14-15.5,56-60  # deliberate holds (a silence, an end card) are allowed
//   node styles/tools/deadbeats.mjs out/final.mp4 --json                 # machine-readable result on stdout
//
// Exit status: 0 when no stretch is longer than --max, 1 when one is, 2 on a usage or decode error.
//
// Adapted from the DEAD BEATS section of tools/review.mjs in the animate skill
// (https://github.com/cth9191/animate), MIT License, Copyright (c) 2026 cth9191.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions
// of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : dflt; };
const has = (name) => { const i = args.indexOf(name); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const json = has('--json');
const deadMax = Number(flag('--max', '3'));
const exempt = (flag('--exempt', '') || '').split(',').filter(Boolean).map((r) => {
  const [a, b] = r.split('-').map(Number);
  if (!(a >= 0) || !(b > a)) usage(`bad --exempt range "${r}" (want a-b in seconds, like 14-15.5)`);
  return [a, b];
});
const video = args[0];
if (!video || !(deadMax > 0)) usage();
if (!fs.existsSync(video)) usage(`no file at ${video}`);

function usage(msg) {
  if (msg) console.error(`deadbeats: ${msg}`);
  console.error('usage: node deadbeats.mjs <video> [--max 3] [--exempt a-b,c-d] [--json]');
  process.exit(2);
}

// ---- probe: frame rate and size
const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height', '-of', 'csv=p=0', video], { encoding: 'utf8' });
if (probe.status !== 0) { console.error(probe.stderr || 'ffprobe failed'); process.exit(2); }
const [wStr, hStr, rate] = probe.stdout.trim().split(',');
const [num, den] = rate.split('/').map(Number);
const fps = num / (den || 1), FW = Number(wStr), FH = Number(hStr);

// ---- decode to small grayscale frames (96 px wide, even height) so a 60 s film is a few MB in memory
const SW = 96, SH = Math.max(2, Math.round((SW * FH) / FW / 2) * 2), PX = SW * SH;
const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `scale=${SW}:${SH}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
if (dec.status !== 0) { console.error(dec.stderr.toString() || 'ffmpeg failed'); process.exit(2); }
const raw = dec.stdout, nFrames = Math.floor(raw.length / PX);
if (nFrames < 2) { console.error('deadbeats: decoded fewer than two frames'); process.exit(2); }
const frameDiff = (fa, fb) => { let d = 0; for (let i = 0; i < PX; i++) d += Math.abs(raw[fa * PX + i] - raw[fb * PX + i]); return d / PX; };

// ---- the picture's change over half a second, sampled four times a second
const step = Math.max(1, Math.round(fps / 4)), lag = Math.max(1, Math.round(fps / 2)), pts = [];
for (let f = lag; f < nFrames; f += step) pts.push([f, frameDiff(f, f - lag)]);
const sorted = pts.map((p) => p[1]).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 0;
// "still" is well under the film's own typical change, with a floor so a film that never moves is not graded on a curve
const thr = Math.max(0.8, 0.25 * med);
const isExempt = (t) => exempt.some(([a, b]) => t >= a && t < b);
const runs = []; let r0 = null;
for (const [f, d] of [...pts, [nFrames, Infinity]]) {
  const t = f / fps, still = d < thr && !isExempt(t);
  if (still && r0 == null) r0 = t;
  else if (!still && r0 != null) { if (t - r0 >= deadMax) runs.push([r0, t]); r0 = null; }
}

const result = {
  file: path.basename(video), frames: nFrames, fps, duration: nFrames / fps,
  medianChange: med, stillBelow: thr, deadMax, exempt,
  deadBeats: runs.map(([a, b]) => ({ t0: a, t1: b, seconds: b - a })),
  pass: runs.length === 0,
};
if (json) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`DEAD BEATS in ${result.file}: ${nFrames} frames at ${+fps.toFixed(3)} fps (${result.duration.toFixed(2)} s)`);
  console.log(`  change over ${(lag / fps).toFixed(2)} s, sampled every ${(step / fps).toFixed(2)} s on ${SW}x${SH} grayscale; median ${med.toFixed(2)}, "still" below ${thr.toFixed(2)}${exempt.length ? `; exempt ${exempt.map(([a, b]) => `${a}-${b}s`).join(', ')}` : ''}`);
  for (const [a, b] of runs) console.log(`  WARN  ${a.toFixed(2)}-${b.toFixed(2)} s: ${(b - a).toFixed(1)} s with nothing new on screen (limit ${deadMax} s). Add a move, a reveal, a reaction or a cut, or pass --exempt if the hold is deliberate.`);
  console.log(`dead beats: ${runs.length ? 'WARN' : 'PASS'} (${runs.length} stretch${runs.length === 1 ? '' : 'es'} over ${deadMax} s)`);
}
process.exit(runs.length ? 1 : 0);
