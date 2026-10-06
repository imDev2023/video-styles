// ENGINE - masters the music and muxes it onto the silent render, then measures the result.
//   node master.mjs [tag]     uses out/music_raw[_tag].wav, writes out/audio[_tag].wav and out/<slug>[_tag].mp4
// Chain: convolution reverb (out/ir.wav, wet level MASTER.reverbWet) mixed with the dry signal,
// trim to the video length, fade in and out, loudnorm. No video re-encode: -c:v copy.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIDEO, MUSIC, MASTER } from './config.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = (f) => path.join(here, 'out', f);
const tag = process.argv[2] ? '_' + process.argv[2] : '';
for (const f of ['silent.mp4', `music_raw${tag}.wav`, 'ir.wav']) {
  if (!fs.existsSync(out(f))) { console.error(`missing out/${f}: run ${f === 'silent.mp4' ? 'node run.mjs' : 'node music.mjs'} first`); process.exit(1); }
}
const D = VIDEO.DUR, M = MASTER;
const chain = [
  '[0:a]asplit=2[dry][wet]',
  '[wet][1:a]afir=dry=0:wet=1[w]',
  `[w]volume=${M.reverbWet}[wv]`,
  '[dry][wv]amix=inputs=2:weights=1 1:normalize=0[m]',
  `[m]atrim=0:${D},afade=t=in:d=${M.fadeIn},afade=t=out:st=${D - M.fadeOut}:d=${M.fadeOut},loudnorm=I=${M.lufs}:TP=${M.truePeak}:LRA=${M.lra}[o]`,
].join(';');
// -ar is required: loudnorm upsamples to 192 kHz internally and would otherwise pass that on.
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', out(`music_raw${tag}.wav`), '-i', out('ir.wav'), '-filter_complex', chain, '-map', '[o]', '-ar', String(MUSIC.sampleRate), out(`audio${tag}.wav`)], { stdio: 'inherit' });
const final = out(`${VIDEO.slug}${tag}.mp4`);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', out('silent.mp4'), '-i', out(`audio${tag}.wav`), '-c:v', 'copy', '-c:a', 'aac', '-b:a', M.aacBitrate, '-shortest', final], { stdio: 'inherit' });

// measure: stream durations, integrated loudness and true peak of the finished file
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,sample_rate,duration', '-of', 'csv=p=0', final]).toString().trim();
// ebur128 prints its summary on stderr
const ebu = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', final, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const summary = ebu.slice(ebu.lastIndexOf('Summary:'));
const lufs = summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1], tp = summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1];
console.log(`wrote ${path.relative(here, final)}`);
console.log(`streams (type, sample rate, duration):\n${probe}`);
console.log(`integrated loudness ${lufs} LUFS (target ${M.lufs}), true peak ${tp} dBTP (ceiling ${M.truePeak})`);
