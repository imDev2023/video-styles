// Contact sheet from a render: one frame every N seconds (default 2), six per row, timestamp in the corner.
//   node scripts/contact-sheet.mjs renders/story.mp4 [seconds-per-frame] [out.jpg]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { at } from './lib.mjs';

const [input, every = '2', outArg] = process.argv.slice(2);
if (!input) throw new Error('Usage: node scripts/contact-sheet.mjs <video> [seconds-per-frame] [out.jpg]');
const src = resolve(process.cwd(), input);
const out = outArg ? resolve(process.cwd(), outArg) : at('snapshots', 'contact_sheet.jpg');
mkdirSync(dirname(out), { recursive: true });
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' }));
const count = Math.floor(dur / Number(every)) + 1;
const rows = Math.ceil(count / 6);
const vf = `fps=1/${every},scale=384:216:flags=lanczos,drawtext=text='%{eif\\:t\\:d}s':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=4,tile=6x${rows}:padding=4:color=0x111111`;
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-frames:v', '1', '-q:v', '4', out]);
console.log(`Wrote ${out} (${count} frames)`);
