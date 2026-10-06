// Original procedural jungle bed: air, distant birds, flowing water, rain, thunder and night insects.
// Generated offline as PCM from our own code: no samples, no music, no API calls.
// PER-VIDEO: which scenes get water, rain, thunder and night insects is set in config.json "ambience" by scene id.
// Usage: node scripts/generate-ambience.mjs   (reads timing.json, writes assets/ambience.wav)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { at, loadConfig } from './lib.mjs';

export function renderAmbience(scenes, amb, outFile) {
  const total = scenes.reduce((a, s) => Math.max(a, s.start + s.duration), 0);
  const byId = Object.fromEntries(scenes.map((s, i) => [s.id, { ...s, i }]));
  const span = (id) => { const s = byId[id]; return s ? [s.start, s.start + s.duration] : null; };
  const water = (amb.waterScenes || []).map(span).filter(Boolean);
  const rainSpan = span(amb.rainScene);
  const thunderAt = amb.thunder && byId[amb.thunder.scene] ? byId[amb.thunder.scene].start + (amb.thunder.at ?? 1) : null;
  const nightFrom = byId[amb.nightFrom]?.start ?? Infinity;

  const sr = 48000, n = Math.round(total * sr), pcm = Buffer.alloc(n * 4), TAU = Math.PI * 2;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const fade = (t, start, end) => clamp((t - start) / 0.65) * clamp((end - t) / 0.85);
  let seed = (amb.seed ?? 761947) >>> 0, lp = 0, lp2 = 0;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const birds = Math.max(0, Math.floor((total - 6.9) / 2.45) + 1);
  for (let i = 0; i < n; i++) {
    const t = i / sr, white = noise();
    lp = 0.993 * lp + 0.007 * white; lp2 = 0.96 * lp2 + 0.04 * white;
    let v = lp * 0.29;
    let river = 0; for (const [a, b] of water) river += fade(t, a, b);
    v += river * (lp2 * 0.13 + white * 0.009);
    const rain = rainSpan ? fade(t, rainSpan[0] + 0.1, rainSpan[1] + 0.35) : 0;
    v += rain * (white * 0.028 + lp2 * 0.24);
    if (thunderAt !== null) { const th = t - thunderAt; if (th > 0 && th < 3) v += lp * 0.65 * Math.exp(-th / 1.25) * Math.min(1, th * 8); }
    let left = v, right = v;
    for (let b = 0; b < birds; b++) {
      const tt = t - (0.9 + b * 2.45);
      if (tt >= 0 && tt < 0.42 && rain < 0.3) {
        const env = Math.pow(Math.sin(Math.PI * tt / 0.42), 2), pitch = 1650 + (b % 4) * 235;
        const chirp = Math.sin(TAU * (pitch * tt + 500 * tt * tt) + Math.sin(tt * 65) * 2.3) * env * 0.035;
        left += chirp * (b % 2 ? 0.5 : 1); right += chirp * (b % 2 ? 1 : 0.5);
      }
    }
    const night = fade(t, nightFrom, total);
    const insect = Math.pow(Math.max(0, Math.sin(t * TAU * 3.1)), 12) * Math.sin(t * TAU * 4700) * 0.011 * night;
    left += insect; right += insect * 0.7;
    const env = clamp(t / 1.3) * clamp((total - t) / 1.5);
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(left * env * 32767))), i * 4);
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(right * env * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  mkdirSync(at('assets'), { recursive: true });
  writeFileSync(outFile, Buffer.concat([h, pcm]));
  return total;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cfg = loadConfig();
  const scenes = JSON.parse(readFileSync(at('timing.json'), 'utf8'));
  const total = renderAmbience(scenes, cfg.ambience || {}, at('assets', 'ambience.wav'));
  console.log(`Wrote assets/ambience.wav (${total.toFixed(2)} s stereo, 48 kHz)`);
}
