// ENGINE - writes the score from score.mjs to MIDI with midi-writer-js, checks its channels,
// renders it with a soundfont through spessasynth_core, and writes a synthetic reverb impulse.
//   node music.mjs                          default soundfont from config.mjs
//   node music.mjs <soundfont.sf2|sf3> [tag]  try another soundfont; outputs get a _<tag> suffix
// Outputs (in out/): score.mid, music_raw[_tag].wav, ir.wav. Then run master.mjs [tag].
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MidiWriter from 'midi-writer-js';
import { audioToWav, BasicMIDI, SoundBankLoader, SpessaLog, SpessaSynthProcessor, SpessaSynthSequencer } from 'spessasynth_core';
import { VIDEO, MUSIC } from './config.mjs';
import { TIMES } from './world.mjs';
import { INSTRUMENTS, compose } from './score.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = path.join(here, 'out');
await fs.mkdir(outDir, { recursive: true });
const SF = process.argv[2] || MUSIC.soundfont, tag = process.argv[3] ? '_' + process.argv[3] : '';
const BEAT = 60 / MUSIC.bpm, BAR = BEAT * 4, TPS = 128 / BEAT; // midi-writer-js uses 128 ticks per beat
const rnd = (() => { let a = MUSIC.seed; return () => { a = (a * 1664525 + 1013904223) % 4294967296; return a / 4294967296; }; })();

// ---- compose
const pending = [];
function add(name, sec, dur, pitch, vel = 70, human = true) {
  if (!INSTRUMENTS[name]) throw new Error(`score uses unknown instrument "${name}"`);
  const t = Math.max(0, sec + (human ? (rnd() - 0.5) * 0.016 : 0));
  const v = Math.max(1, Math.min(127, Math.round(vel + (human ? (rnd() - 0.5) * 8 : 0))));
  pending.push([name, t, dur, pitch, v]);
}
compose({ add, bar: (k) => k * BAR, BEAT, BAR, TIMES });

// ---- write MIDI. midi-writer-js trap: NoteEvent channels are 1-based but ProgramChangeEvent
// channels are 0-based. Getting it wrong makes every instrument play its neighbour's program.
const tracks = Object.entries(INSTRUMENTS).map(([name, [program, ch]]) => {
  if (ch < 1 || ch > 16) throw new Error(`${name}: channel ${ch} is outside 1..16`);
  const tr = new MidiWriter.Track(); tr.setTempo(MUSIC.bpm); tr.addTrackName(name);
  tr.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: program, channel: ch - 1 }));
  pending.filter((e) => e[0] === name).sort((a, b) => a[1] - b[1]).forEach(([, t, d, p, v]) =>
    tr.addEvent(new MidiWriter.NoteEvent({ pitch: [p], duration: 'T' + Math.max(8, Math.round(d * TPS)), startTick: Math.round(t * TPS), velocity: v, channel: ch })));
  return tr;
});
const midiBytes = new MidiWriter.Writer(tracks).buildFile();
checkChannels(midiBytes);
await fs.writeFile(path.join(outDir, 'score.mid'), midiBytes);

// ---- render with the soundfont
// midi-writer-js ends every track with two EndOfTrack events; spessasynth drops the extra one and
// warns once per track. Harmless (no notes are lost), so only that exact message is filtered.
const warn = SpessaLog.logFunctions.warn;
SpessaLog.logFunctions.warn = (...m) => { if (m[0] !== 'Unexpected EndOfTrack. Removing!') warn(...m); };
const toAB = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const midi = BasicMIDI.fromArrayBuffer(toAB(Buffer.from(midiBytes)));
const bank = SoundBankLoader.fromArrayBuffer(toAB(await fs.readFile(SF).catch(() => {
  throw new Error(`soundfont not found: ${SF}\nRun "node fetch-assets.mjs" or pass a soundfont path.`);
})));
const sr = MUSIC.sampleRate, synth = new SpessaSynthProcessor(sr, { eventsEnabled: false });
synth.soundBankManager.addSoundBank(bank, 'main'); await synth.processorInitialized;
synth.setSystemParameter('autoAllocateVoices', true);
const seq = new SpessaSynthSequencer(synth); seq.loadNewSongList([midi]); seq.play();
const n = Math.ceil(sr * (VIDEO.DUR + MUSIC.tail)), L = new Float32Array(n), Rr = new Float32Array(n), t0 = performance.now();
for (let done = 0; done < n;) { seq.processTick(); const b = Math.min(128, n - done); synth.process(L, Rr, done, b); done += b; }
let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
console.log(`soundbank ${path.basename(SF)}; MIDI ${midi.duration.toFixed(1)} s; notes ${pending.length}; peak ${(20 * Math.log10(peak || 1e-9)).toFixed(1)} dBFS; rendered in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
if (peak < 1e-4) throw new Error('the render is silent: check the soundfont and the score');
await fs.writeFile(path.join(outDir, `music_raw${tag}.wav`), new Uint8Array(audioToWav([L, Rr], sr)));

// ---- synthetic concert-hall impulse response (stereo) for ffmpeg afir in master.mjs:
// decaying noise that gets darker over time, with a quiet first 12 ms as pre-delay.
const irN = Math.floor(sr * MUSIC.reverbSeconds), ir = new Float32Array(irN * 2);
for (let c = 0; c < 2; c++) { let lp = 0; for (let i = 0; i < irN; i++) { const e = Math.exp(-i / (sr * 0.55)), x = (rnd() * 2 - 1); lp += (x - lp) * (0.35 + 0.5 * Math.exp(-i / (sr * 0.4))); ir[i * 2 + c] = lp * e * (i < sr * 0.012 ? 0.15 : 1); } }
await fs.writeFile(path.join(outDir, 'ir.wav'), wav16Interleaved(ir, 2, sr));
console.log(`wrote out/score.mid, out/music_raw${tag}.wav, out/ir.wav`);

// 16-bit PCM WAV from interleaved floats, normalised to the peak.
function wav16Interleaved(data, channels, rate) {
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40);
  let pk = 0; for (const v of data) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < data.length; i++) buf.writeInt16LE(Math.round((data[i] / (pk || 1)) * 32000), 44 + i * 2);
  return buf;
}

// Reads the MIDI file back and fails if any track plays notes on a channel other than the one
// its program change was sent on, or puts a pitched instrument on channel 10 (index 9).
function checkChannels(bytes) {
  const d = Uint8Array.from(bytes); let pos = 14, trackNo = 0;
  const vlq = () => { let v = 0, b; do { b = d[pos++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };
  while (pos < d.length) {
    const len = (d[pos + 4] << 24) | (d[pos + 5] << 16) | (d[pos + 6] << 8) | d[pos + 7], end = pos + 8 + len;
    pos += 8; trackNo++; let status = 0, name = `track ${trackNo}`; const pc = new Set(), notes = new Set();
    while (pos < end) {
      vlq();
      if (d[pos] & 0x80) status = d[pos++];
      if (status === 0xff) { const meta = d[pos++], l = vlq(); if (meta === 0x03) name = Buffer.from(d.subarray(pos, pos + l)).toString(); pos += l; continue; }
      if (status === 0xf0 || status === 0xf7) { pos += vlq(); continue; }
      const type = status & 0xf0, ch = status & 0x0f;
      if (type === 0xc0 || type === 0xd0) { if (type === 0xc0) pc.add(ch); pos += 1; } else { if (type === 0x90) notes.add(ch); pos += 2; }
    }
    const bad = [...notes].filter((ch) => !pc.has(ch));
    const one = (s) => [...s].map((c) => c + 1).join(', ') || 'none';
    if (bad.length) throw new Error(`MIDI channel check failed: "${name}" plays notes on channel ${one(bad)} but its program change is on channel ${one(pc)} (channels shown 1-based)`);
    if (notes.has(9) && INSTRUMENTS[name]?.[1] !== 10) throw new Error(`"${name}" plays on channel 10, which is percussion`);
    pos = end;
  }
  console.log(`MIDI channel check passed (${trackNo} tracks)`);
}
