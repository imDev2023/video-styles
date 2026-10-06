// Generates one narration clip per scene from config.json and records them in audio_meta.json.
// This is a METERED external API call. Keys are read at run time from the nearest .env above the project
// (GEMINI_API_KEY / Gemini_API_Key / GOOGLE_API_KEY, or ELEVENLABS_API_KEY) and are never written anywhere.
//
//   node scripts/generate-voice.mjs --dry-run              show what would be sent; no network, no key needed
//   node scripts/generate-voice.mjs                        all scenes, provider from config.voice.provider
//   node scripts/generate-voice.mjs --only river,rain      regenerate some scenes, keep the rest
//   node scripts/generate-voice.mjs --provider elevenlabs  override the provider for this run
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { at, loadConfig, loadEnv, probeDuration, redact } from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const dryRun = args.includes('--dry-run');
const cfg = loadConfig();
const provider = flag('provider') || cfg.voice.provider;
const only = flag('only') ? new Set(flag('only').split(',')) : null;
const scenes = cfg.scenes.filter((s) => !only || only.has(s.id));
if (only) for (const id of only) if (!cfg.scenes.some((s) => s.id === id)) throw new Error(`--only names unknown scene "${id}"`);
if (!['gemini', 'elevenlabs'].includes(provider)) throw new Error(`Unknown provider "${provider}" (gemini | elevenlabs)`);
const pc = cfg.voice[provider];

const env = loadEnv();
const key = provider === 'gemini' ? env.GEMINI_API_KEY : env.ELEVENLABS_API_KEY;

if (dryRun) {
  console.log(`provider ${provider}, model ${pc.model}, voice ${pc.voiceName || pc.voice}`);
  console.log(`key ${provider === 'gemini' ? 'GEMINI_API_KEY' : 'ELEVENLABS_API_KEY'}: ${key ? 'found in .env' : 'MISSING'}`);
  if (pc.style) console.log(`style: ${pc.style}`);
  let words = 0;
  for (const s of scenes) { const n = s.narration.trim().split(/\s+/).length; words += n; console.log(`  ${s.id.padEnd(12)} ${String(n).padStart(3)} words  ${s.narration}`); }
  console.log(`${words} words, about ${(words / 160 * 60).toFixed(1)} s at 160 wpm. Nothing was sent.`);
  process.exit(0);
}
if (!key) throw new Error(`No ${provider === 'gemini' ? 'Gemini' : 'ElevenLabs'} key in the workspace .env`);

function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Gemini TTS through the Interactions API, the same call the HyperFrames media-use adapter makes.
// 3.8 models take the delivery direction as a speech_metadata annotation and return WAV; older ones return PCM.
async function gemini(text, wavAbs) {
  const modern = pc.model.startsWith('gemini-3.8-');
  const content = { type: 'text', text: !modern && pc.style ? `Read the following text with this delivery: ${pc.style}\n\n${text}` : text };
  if (modern && pc.style) content.annotations = [{ type: 'speech_metadata', style: pc.style }];
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', signal: AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ model: pc.model, input: [{ type: 'user_input', content: [content] }], response_format: modern ? { type: 'audio', mime_type: 'audio/wav' } : { type: 'audio' }, generation_config: { speech_config: [{ voice: pc.voice }] }, store: false }),
  });
  if (!r.ok) throw new Error(`Gemini TTS HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const j = await r.json();
  if (j.status !== 'completed') throw new Error(`Gemini TTS did not complete (${j.status})`);
  const audio = (j.steps || []).filter((s) => s.type === 'model_output').flatMap((s) => s.content || []).filter((p) => p.type === 'audio');
  if (audio.length !== 1 || !audio[0].data) throw new Error('Gemini TTS returned no single audio block');
  let bytes = Buffer.from(audio[0].data, 'base64');
  const mime = audio[0].mime_type || '';
  if (/^audio\/l16/i.test(mime)) bytes = pcmToWav(bytes, Number(/rate=(\d+)/i.exec(mime)?.[1] || 24000));
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Gemini TTS returned unsupported audio (${mime})`);
  writeFileSync(wavAbs, bytes);
}

// ElevenLabs over HTTP. Free accounts can only use premade voices through the API; Voice Library voices return
// HTTP 402 paid_plan_required. previous_text and next_text keep the read continuous across per-scene clips.
async function elevenlabs(text, wavAbs, idx) {
  const body = { text, model_id: pc.model, seed: pc.seed ?? 11 };
  if (pc.context !== false) {
    const all = cfg.scenes.map((s) => s.narration.trim());
    if (idx > 0) body.previous_text = all.slice(0, idx).join(' ');
    if (idx < all.length - 1) body.next_text = all.slice(idx + 1).join(' ');
  }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${pc.voice}?output_format=mp3_44100_128`, {
    method: 'POST', signal: AbortSignal.timeout(180000),
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
  if (r.status === 402) throw new Error('ElevenLabs HTTP 402 paid_plan_required: this voice needs a paid plan. Pick a premade voice (for example Lily, pFZP5JQG7iQjIQuC4Bku) in config.voice.elevenlabs.voice.');
  if (!r.ok) throw new Error(`ElevenLabs HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const tmp = mkdtempSync(join(tmpdir(), 'storybook-tts-'));
  try {
    const mp3 = join(tmp, `line${idx}.mp3`);
    writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '44100', wavAbs]);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const metaFile = at('audio_meta.json');
const prev = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : { voices: [] };
if (only && prev.tts_provider && prev.tts_provider !== provider) console.warn(`Warning: mixing ${prev.tts_provider} and ${provider} clips in one film will sound like two narrators.`);
mkdirSync(at('assets', 'voice'), { recursive: true });
const voices = new Map((only ? prev.voices : []).map((v) => [v.id, v]));
try {
  for (const s of scenes) {
    const idx = cfg.scenes.findIndex((x) => x.id === s.id);
    const rel = `assets/voice/${s.id}.wav`;
    process.stdout.write(`${s.id}: `);
    await (provider === 'gemini' ? gemini(s.narration.trim(), at(rel)) : elevenlabs(s.narration.trim(), at(rel), idx));
    const duration_s = +probeDuration(at(rel)).toFixed(3);
    voices.set(s.id, { id: s.id, path: rel, duration_s, text: s.narration.trim() });
    console.log(`${duration_s} s`);
  }
} catch (e) {
  console.error(`\n${redact(e.message, key)}`);
  process.exitCode = 1;
}
const ordered = cfg.scenes.map((s) => voices.get(s.id)).filter(Boolean);
writeFileSync(metaFile, JSON.stringify({ tts_provider: provider, model: pc.model, voice_id: pc.voice, voices: ordered, total_duration_s: +ordered.reduce((a, v) => a + v.duration_s, 0).toFixed(3) }, null, 2) + '\n');
console.log(`audio_meta.json: ${ordered.length}/${cfg.scenes.length} clips. Next: node scripts/assemble.mjs, then node scripts/verify-narration.mjs`);
