// Fits the narration clips to the film, generates the ambience bed, and writes every generated project file:
// timing.json, voice-edit.json, compositions/<scene>.html, index.html, STORYBOARD.md, meta.json.
// Never hand-edit those outputs: change config.json or this script and run it again.
//
//   node scripts/assemble.mjs                    real build from audio_meta.json (after generate-voice.mjs)
//   node scripts/assemble.mjs --silent-preview   no narration; scene lengths from config previewSeconds
//   node scripts/assemble.mjs --silent-preview --trim 2   same, but the root timeline stops at 2 s (smoke render)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { at, loadConfig, probeDuration } from './lib.mjs';
import { renderAmbience } from './generate-ambience.mjs';

const args = process.argv.slice(2);
const silent = args.includes('--silent-preview');
const trimArg = args.indexOf('--trim');
const trim = trimArg >= 0 ? Number(args[trimArg + 1]) : null;
if (trimArg >= 0 && !(trim > 0)) throw new Error('--trim needs a positive number of seconds');

const cfg = loadConfig();
const T = cfg.timing;
const W = cfg.width, H = cfg.height;
const scenesCfg = cfg.scenes;
const offsets = scenesCfg.map((_, i) => (i === 0 ? T.firstVoiceAt : T.voiceOffset));

let durations = scenesCfg.map((s) => s.previewSeconds ?? 7);
let voices = [];
let speed = 1;

if (!silent) {
  const metaFile = at('audio_meta.json');
  if (!existsSync(metaFile)) throw new Error('audio_meta.json is missing. Run node scripts/generate-voice.mjs first, or use --silent-preview.');
  const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
  const raw = scenesCfg.map((s) => {
    const v = meta.voices.find((x) => x.id === s.id);
    if (!v) throw new Error(`No narration clip for scene "${s.id}" in audio_meta.json. Regenerate it with --only ${s.id}.`);
    if (!existsSync(at(v.path))) throw new Error(`Narration file ${v.path} is missing`);
    return v;
  });
  const totalVoice = raw.reduce((a, v) => a + v.duration_s, 0);
  const fixed = offsets.reduce((a, o) => a + o + T.sceneTail, 0) + T.endHold;
  const room = T.targetSeconds ? T.targetSeconds - fixed : Infinity;
  const tooFast = (s) => new Error(`The narration (${totalVoice.toFixed(2)} s) needs ${s.toFixed(3)}x speed-up to fit ${T.targetSeconds} s; the limit is ${T.maxTempo}x. Shorten the script, raise timing.targetSeconds, or set it to null to let the film follow the narration.`);
  speed = Math.max(1, totalVoice / room);
  mkdirSync(at('assets', 'voice'), { recursive: true });
  // atempo and loudnorm each add a few milliseconds per clip, so measure the processed clips and re-fit until they fit.
  for (let pass = 0; ; pass++) {
    if (speed > T.maxTempo) throw tooFast(speed);
    voices = raw.map((v) => {
      const out = `assets/voice/${v.id}-final.wav`;
      const filters = [];
      if (speed > 1.0005) filters.push(`atempo=${speed.toFixed(5)}`);
      filters.push(`loudnorm=I=${cfg.voice.loudnessLUFS ?? -18}:TP=-2:LRA=8`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', at(v.path), '-af', filters.join(','), '-ar', '48000', '-ac', '1', at(out)]);
      return { id: v.id, source: v.path, path: out, duration_s: probeDuration(at(out)), speed: +speed.toFixed(5) };
    });
    const processed = voices.reduce((a, v) => a + v.duration_s, 0);
    if (processed <= room + 1e-4) break;
    if (pass >= 3) throw new Error(`Could not fit the narration into ${T.targetSeconds} s after ${pass + 1} passes`);
    speed *= (processed + 0.002) / room;
  }
  voices.forEach((v, i) => { durations[i] = offsets[i] + v.duration_s + T.sceneTail; });
  durations[durations.length - 1] += T.endHold;
  if (T.targetSeconds) durations[durations.length - 1] += T.targetSeconds - durations.reduce((a, b) => a + b, 0);
  console.log(`Narration ${totalVoice.toFixed(2)} s, pitch-preserving tempo ${speed.toFixed(3)}x`);
}

let start = 0;
const scenes = scenesCfg.map((s, i) => {
  const out = { id: s.id, index: i, draw: s.draw, chapter: s.chapter, start: +start.toFixed(6), duration: +durations[i].toFixed(6) };
  start += durations[i];
  return out;
});
const total = +start.toFixed(6);
const rootDur = trim ? Math.min(trim, total) : total;
voices.forEach((v, i) => { v.start = +(scenes[i].start + offsets[i]).toFixed(6); });

if (!trim) {
  writeFileSync(at('timing.json'), JSON.stringify(scenes, null, 2) + '\n');
  if (!silent) writeFileSync(at('voice-edit.json'), JSON.stringify(voices, null, 2) + '\n');
}

const ambienceFile = 'assets/ambience.wav';
renderAmbience(scenes, cfg.ambience || {}, at(ambienceFile));

// ---------- HTML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const fmt = (n) => +n.toFixed(6);

rmSync(at('compositions'), { recursive: true, force: true });
mkdirSync(at('compositions'), { recursive: true });
for (const s of scenes) {
  const d = fmt(s.duration);
  writeFileSync(at('compositions', `${s.id}.html`), `<!doctype html><html><body><template>
<style>#${s.id}{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}#${s.id}-art{width:100%;height:100%;display:block}</style>
<div id="${s.id}" data-composition-id="${s.id}" data-duration="${d}" data-width="${W}" data-height="${H}"><canvas id="${s.id}-art" width="${W}" height="${H}" data-layout-allow-overflow aria-label="${esc(s.chapter)}"></canvas></div>
<script>(()=>{window.__timelines=window.__timelines||{};const art=new window.StoryRenderer(document.getElementById('${s.id}-art'));const clock={t:0};const draw=()=>art.draw(${js(s.draw)},clock.t,${d},${s.index},${js(s.chapter)});const tl=gsap.timeline({paused:true});tl.to(clock,{t:${d},duration:${d},ease:'none',onUpdate:draw},0);draw();window.__timelines[${js(s.id)}]=tl;})();</script>
</template></body></html>
`);
}

const visible = scenes.filter((s) => s.start < rootDur);
const hosts = visible.map((s) => `<div id="host-${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${fmt(Math.min(s.duration, rootDur - s.start))}" data-track-index="${s.index}" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`).join('\n');
const voiceTags = voices.filter((v) => v.start < rootDur).map((v) => `<audio id="voice-${v.id}" src="${v.path}" data-start="${v.start}" data-duration="${fmt(Math.min(v.duration_s, rootDur - v.start))}" data-track-index="${scenes.length + 1}" data-volume="1"></audio>`).join('\n');
const vol = cfg.ambience?.volume ?? 0.32;
const fadeIn = Math.min(1.5, rootDur / 3), fadeOut = Math.max(fadeIn, rootDur - 2);
const automation = esc(JSON.stringify({ version: 1, lanes: [{ target: 'volume', points: [{ t: 0, v: 0 }, { t: fmt(fadeIn), v: vol }, { t: fmt(fadeOut), v: vol }, { t: fmt(rootDur), v: 0 }] }] }));
const ambienceTag = `<audio id="ambience" src="${ambienceFile}" data-start="0" data-duration="${fmt(rootDur)}" data-track-index="${scenes.length + 2}" data-volume="${vol}" data-automation="${automation}"></audio>`;

const fontFile = 'assets/fonts/title-serif.ttf';
if (!existsSync(at(fontFile))) console.warn('Warning: assets/fonts/title-serif.ttf is missing. Run node fetch-assets.mjs, or titles fall back to a local Georgia or the default serif.');
const font = `@font-face{font-family:StorySerif;src:url('${fontFile}') format('truetype'),local('Georgia Bold'),local('Georgia-Bold');font-weight:400 700;font-display:block}`;
const story = { title: cfg.title, text: cfg.text };

writeFileSync(at('index.html'), `<!doctype html><html lang="${esc(cfg.voice?.lang || 'en')}"><head><meta charset="utf-8"><title>${esc(cfg.title)}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${font}*{box-sizing:border-box}body{margin:0;background:${cfg.background}}#root{width:100%;height:100%;position:relative;overflow:hidden}.clip{position:absolute;inset:0}#journey-line{position:absolute;left:144px;bottom:58px;width:1632px;height:2px;background:#e9dbac;opacity:.5;transform-origin:left center;z-index:20}</style>
<script>window.STORY=${js(story)};</script>
<script src="scene-renderer.js"></script></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${fmt(rootDur)}" data-fps="${cfg.fps}" data-width="${W}" data-height="${H}">
${hosts}
<div id="journey-line"></div>
${voiceTags}
${ambienceTag}
</div>
<script>window.__timelines=window.__timelines||{};const main=gsap.timeline({paused:true});main.fromTo('#journey-line',{scaleX:0},{scaleX:${fmt(rootDur / total)},duration:${fmt(rootDur)},ease:'none'},0);window.__timelines.main=main;</script>
</body></html>
`);

if (!trim) {
  const board = scenes.map((s) => `## Frame ${s.index + 1}\nstatus: animated\nsrc: compositions/${s.id}.html\nstart: ${s.start.toFixed(3)}\nduration: ${s.duration.toFixed(3)}\n${s.chapter}. Narration: "${scenesCfg[s.index].narration}"\n`).join('\n');
  writeFileSync(at('STORYBOARD.md'), `# ${cfg.title} (${total.toFixed(2)} seconds)\n\nGenerated by scripts/assemble.mjs from config.json. Do not edit by hand.\n\n${board}`);
}
writeFileSync(at('meta.json'), JSON.stringify({ id: cfg.slug, name: cfg.slug }, null, 2) + '\n');

console.log(scenes.map((s) => `${s.id}: ${s.start.toFixed(2)}-${(s.start + s.duration).toFixed(2)} s`).join('\n'));
console.log(`Film ${total.toFixed(2)} s${trim ? `, root trimmed to ${rootDur} s for a smoke render` : ''}${silent ? ' (silent preview, no narration)' : ''}`);
