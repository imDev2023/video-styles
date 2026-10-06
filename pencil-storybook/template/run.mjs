// ENGINE - full render: segments of RENDER.segFrames frames rendered in parallel (one node
// process each), then joined without re-encoding into out/silent.mp4.
//   node run.mjs
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RENDER } from './config.mjs';
import { NF } from './frame.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const segDir = path.join(here, 'out', 'segs');
fs.rmSync(segDir, { recursive: true, force: true }); // never concatenate stale segments from an older cut
fs.mkdirSync(segDir, { recursive: true });
const SEG = RENDER.segFrames, N = Math.ceil(NF / SEG);
const segName = (i) => `s${String(i).padStart(3, '0')}.mp4`;
const t0 = performance.now();
const children = new Set();

let next = 0, done = 0;
await new Promise((resolve, reject) => {
  const launch = () => {
    while (children.size < RENDER.workers && next < N) {
      const i = next++;
      const ch = spawn(process.execPath, ['render.mjs', 'seg', String(i * SEG), String(Math.min(NF, (i + 1) * SEG)), path.join(segDir, segName(i))], { cwd: here, stdio: 'inherit' });
      children.add(ch);
      ch.on('close', (code) => {
        children.delete(ch);
        if (code) { for (const c of children) c.kill(); return reject(new Error(`segment ${i} failed with exit code ${code}`)); }
        done++; console.log(`segment ${done}/${N}`);
        if (done === N) resolve(); else launch();
      });
    }
  };
  launch();
});

// Relative names in the list file: the concat demuxer resolves them next to the list, so the
// space in the workspace path never has to be quoted or escaped.
fs.writeFileSync(path.join(segDir, 'list.txt'), Array.from({ length: N }, (_, i) => `file '${segName(i)}'`).join('\n') + '\n');
const out = path.join(here, 'out', 'silent.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(segDir, 'list.txt'), '-c', 'copy', out]);
const frames = execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', out]).toString().trim();
console.log(`rendered ${NF} frames in ${((performance.now() - t0) / 1000).toFixed(0)} s -> out/silent.mp4 (${frames} frames in file)`);
if (Number(frames) !== NF) { console.error(`ERROR: expected ${NF} frames, file has ${frames}`); process.exit(1); }
