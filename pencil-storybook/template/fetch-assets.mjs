// Fetches every third-party asset this style needs. Safe to run again: it skips what is there.
//   node fetch-assets.mjs
// - Caveat variable font (SIL Open Font License) -> assets/fonts/, with its licence.
//   Copied from ~/Library/Fonts when installed there, otherwise downloaded from google/fonts.
// - MuseScore_General.sf3 (40 MB, MIT licence) -> the path in config.mjs MUSIC.soundfont
//   (~/soundfonts/ by default). Soundfonts are never committed; they live outside the repo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT, MUSIC } from './config.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/';
const ASSETS = [
  { dest: path.join(here, FONT.file), local: path.join(os.homedir(), 'Library', 'Fonts', path.basename(FONT.file)), url: GF + encodeURIComponent(path.basename(FONT.file)), minBytes: 100e3 },
  { dest: path.join(here, path.dirname(FONT.file), 'OFL.txt'), url: GF + 'OFL.txt' },
  { dest: MUSIC.soundfont, url: 'https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/MuseScore_General.sf3', minBytes: 30e6 },
];

let failed = 0;
for (const a of ASSETS) {
  const rel = a.dest.startsWith(here) ? path.relative(here, a.dest) : a.dest.replace(os.homedir(), '~');
  if (fs.existsSync(a.dest)) { console.log(`ok       ${rel}`); continue; }
  fs.mkdirSync(path.dirname(a.dest), { recursive: true });
  if (a.local && fs.existsSync(a.local)) { fs.copyFileSync(a.local, a.dest); console.log(`copied   ${rel}`); continue; }
  try {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (a.minBytes && buf.length < a.minBytes) throw new Error(`only ${buf.length} bytes, expected at least ${a.minBytes}`);
    fs.writeFileSync(a.dest, buf);
    console.log(`fetched  ${rel} (${(buf.length / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    failed++; console.error(`FAILED   ${rel} from ${a.url}: ${e.message}`);
  }
}
if (failed) process.exit(1);
