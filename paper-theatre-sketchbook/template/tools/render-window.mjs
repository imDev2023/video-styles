// Render a short window of the video, for checking motion without a full render.
// HyperFrames render has no start/end flags, so this copies the project into
// a temporary folder, stamps a shorter root duration plus a time offset, renders
// there into out/window-<start>-<length>.mp4, and leaves the real index.html untouched.
// Usage: node tools/render-window.mjs <startSeconds> [lengthSeconds=2] [extra render flags]
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PROJECT, loadConfig, sec } from './config.mjs';
import { stampIndex } from './sync-config.mjs';

const HF = 'hyperframes@0.8.140';
const [startArg, lengthArg = '2', ...extra] = process.argv.slice(2);
const start = Number(startArg), length = Number(lengthArg);
const cfg = loadConfig();
if (!(start >= 0) || !(length > 0) || start + length > cfg.duration + 1e-6) {
  console.error(`usage: node tools/render-window.mjs <start> [length]  (start + length <= ${cfg.duration})`);
  process.exit(2);
}
const name = `window-${sec(start)}-${sec(length)}`;
const work = mkdtempSync(join(tmpdir(), 'pts-window-'));
mkdirSync(join(PROJECT, 'out'), { recursive: true });
for (const entry of ['index.html', 'config.js', 'engine.js', 'scenes.js', 'hyperframes.json', 'meta.json', 'assets']) {
  cpSync(join(PROJECT, entry), join(work, entry), { recursive: true });
}
let html = stampIndex(readFileSync(join(work, 'index.html'), 'utf8'), cfg, { duration: length, mediaStart: start });
// The engine adds this offset to every requested time (see PaperTheatre.drawFrame).
html = html.replace('<script src="config.js"></script>', () => `<script src="config.js"></script>\n<script>window.VIDEO.timeOffset = ${start}; window.VIDEO.windowLength = ${length};</script>`);
writeFileSync(join(work, 'index.html'), html);
const output = join(PROJECT, 'out', `${name}.mp4`);
try {
  execFileSync('npx', ['--yes', HF, 'render', work, '--fps', String(cfg.fps), '--quality', 'draft', '--output', output, ...extra], { stdio: 'inherit' });
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`window render: ${relative(PROJECT, output)}`);
