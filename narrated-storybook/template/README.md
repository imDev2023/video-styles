# Narrated storybook template

A HyperFrames project that paints a picture-book story in Canvas 2D and plays one narration clip per scene over a procedural ambience bed.
The example content is "Mila and the whispering jungle"; replace it.
Read `../PLAYBOOK.md` before starting a new video.

## Files

| File | Per-video? | What it is |
| --- | --- | --- |
| `config.json` | Yes | Title text, timing rules, voice settings, ambience cues and the scene list with narration. |
| `scene-renderer.js` | Bottom half | The engine (backdrop, cat, creatures, text) on top, the per-video scene painters in `SCENES` at the bottom. |
| `fetch-assets.mjs` | No | Copies Georgia Bold from the system fonts, or downloads Gelasio (OFL) with `--ofl`. |
| `scripts/generate-voice.mjs` | No | Gemini or ElevenLabs narration, one clip per scene, into `audio_meta.json`. Metered. |
| `scripts/assemble.mjs` | No | Fits the clips to the film and writes `index.html`, `compositions/`, `timing.json`, `voice-edit.json`, `STORYBOARD.md`, `assets/ambience.wav`. |
| `scripts/generate-ambience.mjs` | No | The procedural bed (assemble calls it for you). |
| `scripts/verify-narration.mjs` | No | whisper.cpp on the CPU, word-for-word check against `config.json`. |
| `scripts/contact-sheet.mjs` | No | One frame every 2 s from a render, tiled. |

Everything `assemble.mjs` writes is generated: change `config.json` or the scripts and run it again instead of editing the output.

## Commands

Run from the workspace root, then from the new project folder.

```sh
cp -R styles/narrated-storybook/template/. videos/<name>/
cd videos/<name>

node fetch-assets.mjs                                   # title font
node scripts/assemble.mjs --silent-preview              # picture only, lengths from config previewSeconds
npx --yes hyperframes@0.8.106 check                     # lint, runtime, layout, motion
npx --yes hyperframes@0.8.106 snapshot --describe false --no-end --at 3,19,26.5,43

node scripts/generate-voice.mjs --dry-run               # free: shows words, provider, whether the key is in .env
node scripts/generate-voice.mjs                         # metered API call
node scripts/assemble.mjs                               # fit narration, write the project
node scripts/verify-narration.mjs                       # about 2.5 min on the CPU for 47 s

npx --yes hyperframes@0.8.106 render --fps 24 --quality delivery -o renders/<name>.mp4
node scripts/verify-narration.mjs --from renders/<name>.mp4
node scripts/contact-sheet.mjs renders/<name>.mp4
```

Smoke render of the first two seconds, with no narration and no API:

```sh
node scripts/assemble.mjs --silent-preview --trim 2
npx --yes hyperframes@0.8.106 render --fps 24 --quality draft -o renders/smoke-2s.mp4
```

Run `node scripts/assemble.mjs` (without `--trim`) afterwards, or the project stays two seconds long.

Always pass `--describe false` to `snapshot`: without it HyperFrames sends every frame to Gemini vision when a Gemini key is set.

Keys are read at run time from the nearest `.env` above the project (`GEMINI_API_KEY`, `Gemini_API_Key` or `GOOGLE_API_KEY`, and `ELEVENLABS_API_KEY`) and are never written to any file.
