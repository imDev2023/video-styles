// Capture one PNG at the middle of every beat (or at the times given) into out/snapshots.
// Usage: node tools/snapshot.mjs [t1,t2,...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PROJECT, loadConfig, sec } from './config.mjs';

const cfg = loadConfig();
const mids = cfg.beats.map((b, i, all) => {
  const end = i + 1 < all.length ? all[i + 1].start : cfg.duration;
  return sec((b.start + end) / 2);
});
const at = process.argv[2] || mids.join(',');
const outDir = join(PROJECT, 'out', 'snapshots');
mkdirSync(outDir, { recursive: true });
execFileSync('npx', ['--yes', 'hyperframes@0.8.140', 'snapshot', PROJECT, '--at', at, '--no-end', '--output', outDir], { stdio: 'inherit' });
