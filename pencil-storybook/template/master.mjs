// ENGINE - masters the music and muxes it onto the silent render, then measures the result.
//   node master.mjs [tag]     uses out/music_raw[_tag].wav, writes out/audio[_tag].wav and out/<slug>[_tag].mp4
// Chain: convolution reverb (out/ir.wav, wet level MASTER.reverbWet) mixed with the dry signal,
// trim to the video length, fades, then gain plus a true-peak limiter, with the gain iterated
// until the EBU R128 meter reads MASTER.lufs. No video re-encode: -c:v copy.
// Fails unless the finished file is within 1 LU of the target and under the true-peak ceiling.
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
const D = VIDEO.DUR, M = MASTER, SR = MUSIC.sampleRate;
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });

// 1. reverb, trim and fades, kept as 32-bit float so the gain stage below never clips
const mix = out(`premaster${tag}.wav`);
const chain = [
  '[0:a]asplit=2[dry][wet]',
  '[wet][1:a]afir=dry=0:wet=1[w]',
  `[w]volume=${M.reverbWet}[wv]`,
  '[dry][wv]amix=inputs=2:weights=1 1:normalize=0[m]',
  `[m]atrim=0:${D},afade=t=in:d=${M.fadeIn},afade=t=out:st=${D - M.fadeOut}:d=${M.fadeOut}[o]`,
].join(';');
ffmpeg('-i', out(`music_raw${tag}.wav`), '-i', out('ir.wav'), '-filter_complex', chain, '-map', '[o]', '-c:a', 'pcm_f32le', mix);

// 2. gain, then a look-ahead limiter on 4x oversampled audio, so it catches the true (inter-sample)
// peaks the meter reads. It aims MASTER.limiterHeadroom dB under the ceiling because AAC encoding
// adds a few tenths of a dB of overshoot. latency=true removes the look-ahead delay, so cues stay on
// their frames. loudnorm is not used: single-pass it lands 1 to 2 LU hot on these 60 s scores, and
// two-pass it cannot stay linear (the mix peaks near 0 dBTP) and falls back to riding the gain.
const limit = 10 ** ((M.truePeak - M.limiterHeadroom) / 20);
const master = out(`audio${tag}.wav`);
let gain = M.lufs - measure(mix).lufs, got;
for (let i = 0; i < 8; i++) {
  ffmpeg('-i', mix, '-af', `volume=${gain.toFixed(3)}dB,aresample=${SR * 4},alimiter=limit=${limit}:attack=5:release=80:level=false:latency=true,aresample=${SR}`, '-c:a', 'pcm_s24le', master);
  got = measure(master);
  if (Math.abs(got.lufs - M.lufs) < 0.1) break;
  gain += M.lufs - got.lufs;
}
console.log(`master: gain ${gain >= 0 ? '+' : ''}${gain.toFixed(2)} dB -> ${got.lufs} LUFS, true peak ${got.tp} dBTP before AAC`);

// 3. mux
const final = out(`${VIDEO.slug}${tag}.mp4`);
ffmpeg('-i', out('silent.mp4'), '-i', master, '-c:v', 'copy', '-c:a', 'aac', '-b:a', M.aacBitrate, '-shortest', final);

// measure: stream durations, integrated loudness and true peak of the finished file
const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,sample_rate,duration', '-of', 'csv=p=0', final]).toString().trim();
const res = measure(final);
console.log(`wrote ${path.relative(here, final)}`);
console.log(`streams (type, sample rate, duration):\n${probe}`);
console.log(`integrated loudness ${res.lufs} LUFS (target ${M.lufs}), loudness range ${res.lra} LU, true peak ${res.tp} dBTP (ceiling ${M.truePeak})`);
if (Math.abs(res.lufs - M.lufs) > 1 || res.tp > M.truePeak) {
  console.error('out of spec: loudness must be within 1 LU of the target and the true peak at or under the ceiling');
  process.exit(1);
}

// EBU R128 integrated loudness, loudness range and true peak; ebur128 prints its summary on stderr
function measure(file) {
  const ebu = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const s = ebu.slice(ebu.lastIndexOf('Summary:'));
  const num = (re) => Number(s.match(re)?.[1]);
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), tp: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}
