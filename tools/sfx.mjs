#!/usr/bin/env node
// Sound effects from the picture's own timeline, synthesized: no sample library, nothing to licence.
// Write the cues from the beat table's sound-cue column (a cue sits about 0.03 s BEFORE its visual: late reads as broken,
// early reads as synced), mix them with an optional music bed, loudness-normalise, limit, and mux onto the picture.
//
//   node styles/tools/sfx.mjs cues.json picture.mp4 out.mp4 [--bed bed.wav --bed-vol .5 --bed-at 2.0 --lufs -14]
//   node styles/tools/sfx.mjs cues.json picture.mp4 out.mp4 --keep-audio      # mix the cues over the picture's own track
//
// cues.json: [{ "sfx": "pop", "t": 0.94, "vol": .5 }, { "sfx": "whoosh", "t": 1.08, "dur": .5, "pan": -.4 }, ...]
// sfx: pop | whoosh | whip | tick | thump | crack | sparkle | buzz | scratch | drip | boing | riser |
//      splash | click | step | fall | chime | chirp | burner    (per cue: vol 0..1, dur s, pan -1..1, pitch multiplier)
//
// The mix gets a two-pass loudnorm (default -14 LUFS, true peak -1.5 dBTP) and then a 4x oversampled limiter at -3.1 dBFS,
// because AAC adds up to 1.5 dB of inter-sample overshoot on dense hit-heavy mixes. Report the numbers ffmpeg prints.
// Needs Node 18 or newer, ffmpeg and ffprobe on the PATH; a bed must be a 16-bit PCM WAV.
//
// Adapted from scripts/sound.mjs in buildwithhanif/claude-animation-skill (https://github.com/buildwithhanif/claude-animation-skill),
// MIT License, Copyright (c) 2026 Hanif.
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions
// of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SR = 48000;
const R = (() => { let s = 9; return () => (s = (s * 16807) % 2147483647) / 2147483647 * 2 - 1; })();
function tone(dur, f) { const n = Math.round(dur * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = f(i / SR, i / n); return o; }
const env = (u, a = .01, r = .9) => Math.min(1, u / a) * Math.pow(1 - u, r * 4);
function bandNoise(dur, fLo, fHi, shape) { let lp = 0, hp = 0, prev = 0; return tone(dur, (t, u) => { const w = R(); const f = fLo + (fHi - fLo) * (shape ? shape(u) : u);
  const a = Math.min(1, 2 * Math.PI * f / SR); lp += a * (w - lp); hp = lp - prev; prev = lp; return hp * 3 * env(u, .05, .6); }); }
export const SFX = {
  pop: (d = .14) => tone(d, (t, u) => Math.sin(2 * Math.PI * (900 - 600 * u) * t) * env(u, .005, 1.2) * .8),
  tick: (d = .03) => tone(d, (t, u) => Math.sin(2 * Math.PI * 2600 * t) * (1 - u) * .6),
  thump: (d = .28) => { let ph = 0; return tone(d, (t, u) => { ph += 2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) / SR; return Math.sin(ph) * Math.exp(-t * 12) * .9; }); },
  crack: (d = .18) => tone(d, (t, u) => R() * Math.exp(-t * 40) * .8 + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 25) * .4),
  whoosh: (d = .5) => bandNoise(d, 300, 2400, (u) => Math.sin(u * Math.PI)),
  whip: (d = .3) => bandNoise(d, 800, 5000, (u) => u),
  riser: (d = 1.2) => bandNoise(d, 200, 3000, (u) => u * u),
  scratch: (d = .25) => tone(d, (t, u) => R() * (.5 + .5 * Math.sin(t * 90)) * env(u, .02, .5) * .5),
  sparkle: (d = .9) => tone(d, (t, u) => [2093, 2637, 3136, 4186].reduce((s, f, k) => s + Math.sin(2 * Math.PI * f * t) * Math.exp(-(t - k * .08 > 0 ? t - k * .08 : 99) * 6) * (t > k * .08 ? 1 : 0), 0) * .22),
  drip: (d = .2) => tone(d, (t, u) => Math.sin(2 * Math.PI * (600 + 900 * u) * t) * env(u, .005, 1) * .6),
  boing: (d = .5) => tone(d, (t, u) => Math.sin(2 * Math.PI * (220 + 60 * Math.sin(t * 40) * (1 - u)) * t) * env(u, .01, .8) * .6),
  splash: (d = .45) => { const a = bandNoise(d, 900, 4200, (u) => 1 - u); return tone(d, (t, u) => a[Math.floor(u * (a.length - 1))] * 1.2 * Math.exp(-t * 7) + Math.sin(2 * Math.PI * (500 + 700 * Math.exp(-t * 20)) * t) * Math.exp(-t * 18) * .35); },
  click: (d = .05) => tone(d, (t, u) => (Math.sin(2 * Math.PI * 3400 * t) * .5 + R() * .5) * Math.exp(-t * 180) * .9),
  step: (d = .04) => tone(d, (t, u) => (Math.sin(2 * Math.PI * 900 * t) * .6 + R() * .3) * Math.exp(-t * 140) * .5),
  fall: (d = .45) => tone(d, (t, u) => Math.sin(2 * Math.PI * (1800 - 1300 * u) * t) * Math.min(1, u * 8) * (1 - u) * .35),
  chime: (d = 1.2) => tone(d, (t, u) => [1047, 1319, 1568, 2093].reduce((s, f, k) => s + (t > k * .07 ? Math.sin(2 * Math.PI * f * t) * Math.exp(-(t - k * .07) * 3.5) : 0), 0) * .2),
  chirp: (d = .18) => tone(d, (t, u) => Math.sin(2 * Math.PI * (2600 + 1800 * Math.sin(u * Math.PI)) * t) * Math.sin(u * Math.PI) * (u < .45 || u > .55 ? 1 : .2) * .35),
  burner: (d = 1.0) => { const a = bandNoise(d, 180, 900, (u) => .5 + .5 * Math.sin(u * Math.PI)); return tone(d, (t, u) => a[Math.floor(u * (a.length - 1))] * 1.4 * Math.min(1, u * 8) * (1 - u)); },
  buzz: (d = .6) => { let ph = 0; return tone(d, (t, u) => { ph += (215 + 18 * Math.sin(t * 38)) / SR; return (2 * (ph % 1) - 1) * .3 * Math.min(1, t / .08, (d - t) / .2) * (.7 + .3 * Math.sin(t * 90)); }); },
};
function readWav(file) {        // 16-bit PCM wav -> mono float at SR (nearest-sample resample)
  const b = fs.readFileSync(file); let o = 12, fmt, data; while (o < b.length) { const id = b.toString("ascii", o, o + 4), sz = b.readUInt32LE(o + 4); if (id === "fmt ") fmt = o + 8; if (id === "data") { data = [o + 8, sz]; break; } o += 8 + sz; }
  if (!fmt || !data) throw new Error(`${file}: not a PCM WAV`);
  if (b.readUInt16LE(fmt) !== 1 || b.readUInt16LE(fmt + 14) !== 16) throw new Error(`${file}: the bed must be 16-bit PCM (ffmpeg -i bed -c:a pcm_s16le bed16.wav)`);
  const ch = b.readUInt16LE(fmt + 2), sr = b.readUInt32LE(fmt + 4), n = data[1] / (2 * ch), out = new Float32Array(Math.round(n * SR / sr));
  for (let i = 0; i < out.length; i++) { const j = Math.min(n - 1, Math.floor(i * sr / SR)); let v = 0; for (let c = 0; c < ch; c++) v += b.readInt16LE(data[0] + (j * ch + c) * 2); out[i] = v / ch / 32768; }
  return out;
}
function writeWav(file, L, Rr) {
  const n = L.length, b = Buffer.alloc(44 + n * 4); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.tanh(L[i]) * 32000), 44 + i * 4); b.writeInt16LE(Math.round(Math.tanh(Rr[i]) * 32000), 46 + i * 4); } fs.writeFileSync(file, b);
}
export function mix(cues, dur, bed, bedVol = .5, bedAt = 0) {
  const n = Math.round(dur * SR), L = new Float32Array(n), Rr = new Float32Array(n);
  if (bed) { const B = readWav(bed), o = Math.round(bedAt * SR); for (let i = 0; i + o < n && i < B.length; i++) { L[i + o] += B[i] * bedVol; Rr[i + o] += B[i] * bedVol; } }
  for (const c of cues) {
    if (!SFX[c.sfx]) throw new Error(`unknown sfx "${c.sfx}" at ${c.t} s (have ${Object.keys(SFX).join(", ")})`);
    let s = SFX[c.sfx](c.dur), v = c.vol ?? .5, pan = c.pan ?? 0, i0 = Math.round(c.t * SR);
    if (c.pitch && c.pitch !== 1) { const q = new Float32Array(Math.floor(s.length / c.pitch)); for (let i = 0; i < q.length; i++) q[i] = s[Math.floor(i * c.pitch)]; s = q; }
    for (let i = 0; i < s.length && i0 + i < n; i++) if (i0 + i >= 0) { L[i0 + i] += s[i] * v * (1 - pan); Rr[i0 + i] += s[i] * v * (1 + pan); }
  }
  return [L, Rr];
}
if (process.argv[1] && process.argv[1].endsWith("sfx.mjs")) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a.splice(i, 2)[1] : d; };
  const has = (k) => { const i = a.indexOf(k); if (i >= 0) { a.splice(i, 1); return true; } return false; };
  const bed = opt("--bed", null), bedVol = parseFloat(opt("--bed-vol", ".5")), bedAt = parseFloat(opt("--bed-at", "0")), I = opt("--lufs", "-14"), keep = has("--keep-audio");
  const [cueFile, pic, out] = a;
  if (!cueFile || !pic || !out) { console.error("usage: node styles/tools/sfx.mjs cues.json picture.mp4 out.mp4 [--bed bed.wav --bed-vol .5 --bed-at 0 --lufs -14] [--keep-audio]"); process.exit(2); }
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", pic]).toString());
  let cues, L, Rr;
  try { cues = JSON.parse(fs.readFileSync(cueFile, "utf8")); [L, Rr] = mix(cues, dur, bed, bedVol, bedAt); }
  catch (e) { console.error(`sfx: ${e.message}`); process.exit(2); }
  const tmp = out.replace(/\.mp4$/, "") + ".mix.wav"; writeWav(tmp, L, Rr);
  // --keep-audio: the picture's own track and the cues are summed before the loudness stage
  const inputs = keep ? ["-i", pic, "-i", tmp] : ["-i", pic, "-i", tmp];
  const pre = keep ? "[0:a][1:a]amix=inputs=2:normalize=0[m];[m]" : "[1:a]";
  const measureSrc = keep ? `-i "${pic}" -i "${tmp}" -filter_complex "[0:a][1:a]amix=inputs=2:normalize=0,loudnorm=I=${I}:TP=-1.5:print_format=json"` : `-i "${tmp}" -af loudnorm=I=${I}:TP=-1.5:print_format=json`;
  let meas; try { meas = JSON.parse((execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats ${measureSrc} -f null - 2>&1`]).toString().match(/\{[^{]*input_i[\s\S]*?\}/) || ["{}"])[0]); } catch { meas = {}; }
  const ln = meas.input_i
    ? `loudnorm=I=${I}:TP=-1.5:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:linear=true,aresample=192000,alimiter=limit=0.7:level=false:attack=1:release=40,aresample=48000`
    : `loudnorm=I=${I}:TP=-1.5,alimiter=limit=0.7:level=false`;
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", `${pre}${ln}[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
  fs.unlinkSync(tmp);
  const check = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -i "${out}" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\\s+(I:|Peak:)" | tr -s ' ' | tr '\\n' ' '`]).toString().trim();
  console.log(`wrote ${out}: ${cues.length} cues${bed ? " over a bed" : ""}${keep ? " over the picture's track" : ""}${meas.input_i ? `, mix was ${meas.input_i} LUFS` : ""}; result ${check}`);
}
