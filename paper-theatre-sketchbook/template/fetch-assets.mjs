// Fetch every third-party asset this style needs. Safe to run again: it skips what exists.
//
// Fonts (SIL Open Font License, committed with the template; this restores them if missing):
//   Caveat 700 latin  - the exact file the HyperFrames hw-boil registry component ships.
//   Work Sans 500 latin - Google Fonts.
// Music: never committed (Pixabay-style licences allow use in a video, not redistribution).
//   config.js music.url    -> downloaded, then converted to music.file with ffmpeg
//   config.js music.source -> a local file, converted to music.file with ffmpeg
//   neither                -> a SILENT placeholder of the right length, so check and render
//                             still run. Replace it before delivery.
// Needs Node 22+ (built-in fetch) and ffmpeg and ffprobe on PATH.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { PROJECT, loadConfig, sec } from './tools/config.mjs';

const FONTS = [
  {
    file: 'assets/fonts/Caveat-700-latin.woff2',
    url: 'https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/components/hw-boil/assets/fonts/Caveat-700-latin.woff2',
    sha256: '891951df5e8b5b0f0bc760d31375405e795c666b5add70437de12d4a6482b33f',
  },
  {
    file: 'assets/fonts/WorkSans-500-latin.woff2',
    url: 'https://fonts.gstatic.com/s/worksans/v24/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K3vXBi8Jpo3ZKyHaQQ.woff2',
    sha256: '3bad5131c1cab1d41ea8124a389fd738c7176496aefde45788a914bc1477e24f',
  },
  { file: 'assets/fonts/OFL-Caveat.txt', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt' },
  { file: 'assets/fonts/OFL-WorkSans.txt', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/worksans/OFL.txt' },
];

const abs = (p) => (isAbsolute(p) ? p : join(PROJECT, p));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fonts() {
  for (const f of FONTS) {
    const out = abs(f.file);
    if (existsSync(out)) {
      if (f.sha256 && sha(readFileSync(out)) !== f.sha256) {
        console.warn(`fonts: ${f.file} differs from the pinned file; text will not match the reference frames.`);
      }
      continue;
    }
    const buf = await download(f.url);
    if (f.sha256 && sha(buf) !== f.sha256) {
      throw new Error(`fonts: ${f.url} changed upstream (sha256 mismatch). Pick the new file on purpose and update the hash.`);
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`fonts: fetched ${f.file}`);
  }
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
}

function probeSeconds(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(String(out).trim());
}

async function music(cfg) {
  const m = cfg.music;
  const out = abs(m.file);
  // The silent placeholder carries a marker file, so it is rebuilt when the duration changes.
  const marker = `${out}.placeholder`;
  if (existsSync(out) && existsSync(marker) && (m.url || m.source || readFileSync(marker, 'utf8').trim() !== sec(cfg.duration))) {
    rmSync(out); rmSync(marker);
  }
  if (existsSync(out)) {
    const len = probeSeconds(out);
    if (len + 0.05 < cfg.duration) console.warn(`music: ${m.file} is ${len.toFixed(2)} s but the video is ${cfg.duration} s; HyperFrames will cut the audio slot short.`);
    console.log(`music: ${m.file} present${existsSync(marker) ? ' (silent placeholder)' : ''}`);
    return;
  }
  mkdirSync(dirname(out), { recursive: true });
  let input = null, temp = null;
  if (m.url) {
    temp = join(tmpdir(), `pts-music-${process.pid}`);
    writeFileSync(temp, await download(m.url));
    input = temp;
  } else if (m.source) {
    input = abs(m.source);
    if (!existsSync(input)) throw new Error(`music: source ${m.source} not found`);
  }
  if (input) {
    ffmpeg(['-i', input, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', out]);
    if (temp) rmSync(temp, { force: true });
    console.log(`music: wrote ${m.file}${m.credit ? ` (${m.credit})` : ' - add the credit to config.js'}`);
    const len = probeSeconds(out);
    if (len + 0.05 < cfg.duration) console.warn(`music: the track is ${len.toFixed(2)} s but the video is ${cfg.duration} s; pick a longer track or loop it.`);
  } else {
    ffmpeg(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', sec(cfg.duration), '-c:a', 'aac', '-b:a', '64k', out]);
    writeFileSync(marker, sec(cfg.duration) + '\n');
    console.warn(`music: no url or source in config.js, wrote a SILENT placeholder to ${m.file}. Replace it before delivery.`);
  }
}

const cfg = loadConfig();
await fonts();
await music(cfg);
