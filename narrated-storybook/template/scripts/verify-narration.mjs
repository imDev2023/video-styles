// Checks that what is actually heard matches the script, word for word, with whisper.cpp on the CPU.
// GPU (Metal) Whisper on this machine produced unreliable word timings, so this always runs with
// --no-gpu and --no-flash-attn. Punctuation and case are ignored; every word must match.
//
//   node scripts/verify-narration.mjs                       voice-only stem built from voice-edit.json (after assemble)
//   node scripts/verify-narration.mjs --from renders/x.mp4  the audio of a finished render (voice plus ambience)
//
// whisper-cli and ggml-small.en.bin come from HyperFrames' own install under ~/.cache/hyperframes/whisper.
// If they are missing, run `npx hyperframes transcribe <any short wav>` once, or set WHISPER_CLI and WHISPER_MODEL.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { at, ROOT, loadConfig } from './lib.mjs';

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const from = fromIdx >= 0 ? resolve(process.cwd(), args[fromIdx + 1]) : null;
const cfg = loadConfig();

const whisperDir = join(homedir(), '.cache', 'hyperframes', 'whisper');
const cli = process.env.WHISPER_CLI || join(whisperDir, 'whisper.cpp', 'build', 'bin', 'whisper-cli');
const model = process.env.WHISPER_MODEL || join(whisperDir, 'models', 'ggml-small.en.bin');
for (const [what, p] of [['whisper-cli', cli], ['model', model]]) {
  if (!existsSync(p)) throw new Error(`${what} not found at ${p}. Run "npx hyperframes transcribe <any wav>" once to install it, or set WHISPER_CLI / WHISPER_MODEL.`);
}

const tmp = mkdtempSync(join(tmpdir(), 'storybook-verify-'));
try {
  let wav, source;
  if (from) {
    if (!existsSync(from)) throw new Error(`No such file: ${from}`);
    wav = join(tmp, 'input.wav');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', from, '-vn', '-ac', '1', '-ar', '16000', wav]);
    source = `render audio: ${relative(ROOT, from) || from}`;
  } else {
    const edit = JSON.parse(readFileSync(at('voice-edit.json'), 'utf8'));
    const timing = JSON.parse(readFileSync(at('timing.json'), 'utf8'));
    const total = timing.reduce((a, s) => Math.max(a, s.start + s.duration), 0);
    const inputs = edit.flatMap((v) => ['-i', at(v.path)]);
    const chains = edit.map((v, i) => `[${i}:a]adelay=${Math.round(v.start * 1000)}:all=1[a${i}]`).join(';');
    const mix = `${chains};${edit.map((_, i) => `[a${i}]`).join('')}amix=inputs=${edit.length}:normalize=0,apad,atrim=0:${total.toFixed(3)}[out]`;
    wav = at('assets', 'narration-verification.wav');
    execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', mix, '-map', '[out]', '-ac', '1', '-ar', '16000', wav]);
    source = 'voice-only stem from voice-edit.json (assets/narration-verification.wav)';
  }

  const base = join(tmp, 'transcript');
  execFileSync(cli, ['-m', model, '-f', wav, '-l', 'en', '-ng', '-nfa', '-oj', '-of', base, '-np'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const result = JSON.parse(readFileSync(`${base}.json`, 'utf8'));
  const segments = result.transcription.map((s) => ({ from: s.offsets.from / 1000, to: s.offsets.to / 1000, text: s.text.trim() }));

  const norm = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);
  const expected = norm(cfg.scenes.map((s) => s.narration).join(' '));
  const heard = norm(segments.map((s) => s.text).join(' '));

  // Word-level LCS diff, reported as hunks of expected versus heard.
  const n = expected.length, m = heard.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = expected[i] === heard[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const diffs = []; let i = 0, j = 0, cur = null;
  const flush = () => { if (cur) { diffs.push({ at_word: cur.at, expected: cur.e.join(' '), heard: cur.h.join(' ') }); cur = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && expected[i] === heard[j]) { flush(); i++; j++; continue; }
    cur = cur || { at: i, e: [], h: [] };
    if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) cur.h.push(heard[j++]); else cur.e.push(expected[i++]);
  }
  flush();

  const match = diffs.length === 0;
  const report = {
    verified_at: new Date().toISOString(),
    source,
    method: 'whisper.cpp small.en on CPU (-ng -nfa); case and punctuation ignored; every word compared',
    narration_matches: match,
    expected_words: n,
    heard_words: m,
    diffs,
    segments,
  };
  const outName = from ? 'verification-render.json' : 'verification.json';
  writeFileSync(at(outName), JSON.stringify(report, null, 2) + '\n');
  for (const s of segments) console.log(`[${s.from.toFixed(2).padStart(6)} - ${s.to.toFixed(2).padStart(6)}] ${s.text}`);
  if (match) console.log(`\nPASS: all ${n} words heard as written. Report: ${outName}`);
  else {
    console.log(`\nFAIL: ${diffs.length} difference(s). Report: ${outName}`);
    for (const d of diffs) console.log(`  word ${d.at_word}: expected "${d.expected}" heard "${d.heard}"`);
    process.exitCode = 1;
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
