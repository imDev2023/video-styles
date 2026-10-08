# Playbook: narrated storybook

## 1. Setup

Read `TOOLKIT.md` in the workspace root first; everything this style needs is already installed there.
It needs Node 22 or newer (26.9 is installed), the system ffmpeg and ffprobe, and HyperFrames 0.8.140 through `npx --yes hyperframes@0.8.140`, which also brings its own Chrome.
The pin moved from 0.8.106 to 0.8.140 on 2026-10-08 after a scratch copy of this template passed `check` and gave identical snapshots at 3 s and 19 s on both versions; before any further bump, repeat that test rather than trusting the changelog.
The narration check uses whisper.cpp and the `ggml-small.en.bin` model that HyperFrames installs under `~/.cache/hyperframes/whisper`; on a new machine run `npx hyperframes transcribe <any short wav>` once to install them.
Nothing is installed with npm inside the project: it has no dependencies.

From the workspace root (quote the path, it contains a space):

```sh
cp -R styles/narrated-storybook/template/. videos/<name>/
cd videos/<name>
node fetch-assets.mjs
```

`fetch-assets.mjs` copies Georgia Bold from the system fonts into `assets/fonts/title-serif.ttf` (it may not be redistributed, so it is never committed).
With `--ofl`, or on a machine without Georgia, it downloads Gelasio instead, an SIL Open Font License serif drawn to Georgia's metrics.
There is no music or stock media to fetch.

Keys live in the workspace `.env` and are read at run time by `scripts/lib.mjs`, which walks up from the project to the nearest `.env`.
Gemini accepts `GEMINI_API_KEY`, `Gemini_API_Key` (the owner's spelling) or `GOOGLE_API_KEY`; ElevenLabs uses `ELEVENLABS_API_KEY`.
No script prints, logs or writes a key, and error messages are redacted.

## 2. Steps

### 2.1 Story and config

Write the six narration lines, the chapter titles, the title text and the ambience cues into `config.json`.
Each scene's `draw` names a painter in the `SCENES` table at the bottom of `scene-renderer.js`; reuse the six Mila painters or write new ones from the engine's parts (`cat`, `sleepingCat`, `butterfly`, `frog`, `river`, `leaf`, `fern`, `monstera`, `title`, `chapter`).
Painters must be pure functions of the scene progress `u` (0 to 1) and local time `t`; use `rand(i)` for placement, never `Math.random()` or `Date.now()`.
Set `previewSeconds` per scene to roughly the expected line length (words divided by 2.06, plus 0.5 s) so the silent preview paces like the real film.

### 2.2 Silent preview and stills

```sh
node scripts/assemble.mjs --silent-preview
npx --yes hyperframes@0.8.140 check
npx --yes hyperframes@0.8.140 snapshot --describe false --no-end --at 3,10,19,26.5,33,43
```

Look at every still at full size, then show the stills and the six lines for approval before spending anything on narration.
`npx --yes hyperframes@0.8.140 preview` opens the Studio for scrubbing (an agent should use `preview --background`, `preview --status` and `preview --stop`).

### 2.3 Narration

```sh
node scripts/generate-voice.mjs --dry-run      # free; prints the words, the provider and whether the key was found
node scripts/generate-voice.mjs                # metered; one clip per scene into assets/voice/<id>.wav
node scripts/generate-voice.mjs --only river   # redo one line, keep the others
```

The default is Gemini `gemini-3.8-flash-tts` with voice `Sulafat`, called over the Gemini Interactions API exactly as the HyperFrames media-use adapter does.
The delivery is steered only by the `style` prompt ("Clear, flowing delivery around 160 words per minute. Short natural pauses, no long dramatic gaps."), because Gemini TTS refuses a speed parameter.
Lines are generated one per scene rather than as one long read, so a bad line can be replaced on its own and every scene cut lands on a sentence boundary.
For ElevenLabs set `voice.provider` to `elevenlabs` or pass `--provider elevenlabs`; the script sends `previous_text` and `next_text` so separate lines keep one continuous read.
On the owner's free ElevenLabs account only premade voices work through the API; the default is Lily (`pFZP5JQG7iQjIQuC4Bku`) with model `eleven_v4`, both already proven in the Stoker film.

### 2.4 Fit the narration to the film

```sh
node scripts/assemble.mjs
```

Each scene lasts `offset + clip + sceneTail`, where the offset is 0.65 s for the first scene and 0.16 s for the rest, and the tail is 0.26 s; the last scene also gets `endHold` (0.6 s).
With `timing.targetSeconds` set, the whole read is sped up by one pitch-preserving `atempo` factor until it fits, then each clip is normalised with `loudnorm=I=-18:TP=-2:LRA=8` at 48 kHz mono, and the last scene absorbs any remainder so the film is exact.
The script refuses anything faster than `timing.maxTempo` (1.2x) and tells you to shorten the script instead.
With `targetSeconds: null` the clips play at natural speed and the film is as long as the story.
`assemble.mjs` also regenerates `assets/ambience.wav` from the new timing and writes `timing.json`, `voice-edit.json` (clip, start, length and tempo), `compositions/`, `index.html`, `STORYBOARD.md` and `meta.json`.

### 2.5 Verify the narration

```sh
node scripts/verify-narration.mjs
```

This rebuilds the voice-only track exactly as placed in the film (16 kHz mono, written to `assets/narration-verification.wav`), runs whisper.cpp `small.en` on the CPU with `-ng -nfa` (no GPU, no flash attention), and compares every word with `config.json`, ignoring case and punctuation.
It prints the timed segments, writes `verification.json`, and exits non-zero with each difference ("expected X heard Y") when anything is off.
It takes about 2.5 minutes for 47 s on this machine.
The timings it prints are coarse segment times for orientation only; nothing in the film is driven by them.

### 2.6 Render and verify the render

```sh
npx --yes hyperframes@0.8.140 render --fps 24 --quality delivery -o renders/<name>.mp4
node scripts/verify-narration.mjs --from renders/<name>.mp4
node scripts/contact-sheet.mjs renders/<name>.mp4
ffmpeg -hide_banner -i renders/<name>.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12
cp renders/<name>.mp4 ../../<name>.mp4
```

The second verification transcribes the finished mix (voice plus ambience) and writes `verification-render.json`; it proves the ambience does not mask any word.
The workspace keeps the latest export of each video in its root folder.

## 3. Checks before showing anyone

- `npx --yes hyperframes@0.8.140 check` passes with 0 errors and 0 warnings.
- Stills of every scene at full size, looked at by eye: text not crossed by foliage, hero face clear, hero readable against the background, nothing clipped at the frame edge.
- `verify-narration.mjs` passes on the stem and on the render.
- The contact sheet shows six distinct scenes, a palette that travels from day to night, and no blank frames at the cuts.
- `ffprobe` shows 1920x1080, 24 fps, the expected duration and an AAC track; loudness lands near -15 LUFS integrated with the true peak below -1 dBTP (the original measured -15.2 LUFS and -1.9 dBTP).
- Listen once end to end: no clipped first or last word at a cut, no audible tempo artefacts.
- Dead-beat check on the render, with the shared tool from the library root: something new should happen on screen every 2 to 4 seconds, and the check flags any stretch over 3 s where the picture barely changes.

  ```bash
  node ../../styles/tools/deadbeats.mjs renders/<name>.mp4     # exit 1 on any stretch over 3 s
  ```

  It measures each frame against the frame half a second earlier on a 96 px grayscale copy, with "still" set at a quarter of the film's own median change (floor 0.8).
  On the finished jungle film it flags 38.5 to 47.0 s: the last scene, where the hero sleeps and only the fireflies drift.
  A narrated film may hold a picture while the voice carries it, but 8 s is long; give the closing scene one more small event (a firefly landing on the nose, the tail curling, a star appearing) or pass `--exempt` knowingly and say so in the session summary.
- Hard-cut check on the render: this style cuts between its six scenes on purpose, so five cut events are expected and more means a jump inside a scene.

  ```bash
  python3 ../../styles/tools/cuts.py renders/<name>.mp4 --max 5   # exit 1 on a sixth cut event
  ```

  It measures each frame against the frame before on a 96 px grayscale copy (a cut is a jump of 18, or 20 times the film's median change, never under 4, and three times its neighbours); the jungle film's median change is 0.27, so its limit is 5.3.
  On the finished jungle film it reports 11 events: the five scene cuts at 7.4, 14.3, 23.0, 29.7 and 38.0 s, plus six jumps of 6 to 11 between 23.1 and 24.0 s, which a strip shows to be the storm scene's fade-in stepping every three frames instead of easing; fix the stepped fade in the re-render, and until then pass `--min-gap 24` so the stepped fade counts as one event.
- Frame strips of every scene cut, read against the panel's reads from the storyboard check.

  ```bash
  node ../../styles/tools/strip.mjs renders/<name>.mp4 --from <t> --dur 0.5   # every frame of a cut, numbered
  ```

  The cut should land on the narration's phrase start, the new scene's first read (the place, then the hero) should get its frames before the voice names it, and a fade should change a little on every frame, not in steps.
- Determinism check: the same scene still taken in two different orders must be identical, or a painter is keeping state between frames, which breaks seeking and every re-render.
  Take the stills with the snapshot command from the look check at two times in one order, then in the other order, and `cmp` the PNG of the shared time; pick times on either side of a scene cut.
- Text check: the title and tagline, the chapter labels and the closing line.
  In the still of every scene and at the first and last frame of each text window, confirm that no string comes within 3 px of the frame edge, that no two strings overlap, and that no leaf or vine crosses a string (the text is painted after the foreground, so this only fails when a painter draws foliage late).
  This is still a manual check here; the measured version lives in `pencil-storybook/template/textcheck.mjs`, and a port follows the animate skill's browser version: open the composition in Playwright, hook `CanvasRenderingContext2D.prototype.fillText`, and drive the HyperFrames timeline to the sampled times.

## 4. Gotchas

1. **GPU Whisper word timings were wrong.**
Symptom: the word timings that the HyperFrames audio engine produced for the original takes were judged unreliable and discarded (`audio_meta.json` records "GPU word alignment rejected").
Cause: that pass ran whisper.cpp on the GPU (Metal, with flash attention, on this Intel Mac's AMD GPU); the exact failure was not recorded.
Fix: transcribe on the CPU with `whisper-cli -ng -nfa`, use the result only to verify the words, and drive every cut from clip durations instead of word timings; the style has no word-timed captions on purpose.

2. **A fixed 47 s forced a 1.16x speed-up.**
Symptom: the 104-word read came back at 50.5 s, and fitting it into 47 s needed `atempo` 1.159 in the original (1.166 with the template's end hold).
Cause: the length was fixed before the script was written, and Gemini TTS has no speed control.
Fix: either let the film follow the narration (`targetSeconds: null`) or write 85 to 95 words for 47 s so the speed-up stays near 1.1x; `assemble.mjs` refuses anything above `maxTempo`.

3. **Processed clips overran the target by 65 ms.**
Symptom: `assemble.mjs` reported "Scenes overrun the target by 0.065 s" when the template was first run on the original takes.
Cause: `atempo` and `loudnorm` each add a few milliseconds per clip, so `raw / tempo` underestimates the processed length.
Fix: the script measures the processed clips and nudges the tempo until they fit (one extra pass in practice).

4. **The original could clip the last word.**
Symptom: none audible in the export, but the original assembler accepted a last scene only 0.12 s longer than its clip.
Cause: the last clip starts 0.16 s into its scene, so that check allowed the scene to end 40 ms before the voice did.
Fix: every scene now ends `sceneTail` after its clip, and the last one adds `endHold`.

5. **Ambience needed two assemble runs.**
Symptom: the original README ran `assemble`, `generate-ambience`, then `assemble` again.
Cause: the ambience needs the scene timing, and `index.html` only includes the ambience if the file already exists.
Fix: `assemble.mjs` generates the ambience itself right after computing the timing.

6. **Vines cut through the chapter labels and the tagline.**
Symptom: labels read "ONE BRA/E LEAP" and "SOMEWH ERE TO BELONG" in the export, and a vine crossed the "S" of the tagline.
Cause: text was painted before `foreground()`, whose dangling vines pass over the top-left corner.
Fix: every scene's `text()` runs after the foreground.

7. **The leaf stem crossed the cat's face in the rain scene.**
Symptom: a dark green line ran down through her muzzle while she sheltered.
Cause: the whole leaf, stem included, was drawn after the cat.
Fix: the stalk is drawn before the cat on a path that rises behind her back, left of her head, and only the canopy is drawn after her.

8. **A dark disc showed around the crescent moon.**
Symptom: a slightly mismatched circle sat next to the moon in the night scene.
Cause: the crescent was a full moon with a sky-coloured disc painted over it, and the sky behind is a gradient with trunks.
Fix: `crescent()` clips the bite out with an even-odd clip path, so nothing is painted there.

9. **Some art was invisible.**
Symptom: the dawn sun and a second moon existed in the code but never appeared.
Cause: they were painted before the trunk layers, which covered them.
Fix: removed; paint sky objects in a scene's `skyFront` hook (after the trunks) when they must be seen, and in `skyBack` when trunks should cover them (the stars).

10. **`snapshot` sends frames to Gemini.**
Symptom: a metered Gemini vision call is made for the captured frames, using the workspace key.
Cause: HyperFrames 0.8.140 runs `--describe` by default whenever `GEMINI_API_KEY` is set.
Fix: always pass `--describe false` (the `npm run snapshot` script does).

11. **The checks cannot see canvas text.**
Symptom: `check` reports "0/0 text checks pass WCAG AA" and no layout issues even when a label is unreadable.
Cause: all text is pixels on a canvas, so the DOM audits have nothing to inspect.
Fix: judge every scene from full-size stills by eye.

12. **The Gemini key has a non-standard name.**
Symptom: "No Gemini key" although the key is in `.env`.
Cause: the owner's `.env` spells it `Gemini_API_Key`.
Fix: `scripts/lib.mjs` maps `Gemini_API_Key` and `GOOGLE_API_KEY` onto `GEMINI_API_KEY`.

13. **ElevenLabs returns HTTP 402 `paid_plan_required`.**
Symptom: the request fails for a voice picked from the Voice Library.
Cause: the owner's ElevenLabs account is on the free tier, and the API only serves premade voices to free accounts.
Fix: use a premade voice (Lily `pFZP5JQG7iQjIQuC4Bku`, or Rachel `21m00Tcm4TlvDq8ikWAM`); the script names this fix in its error.

14. **The media-use ElevenLabs route cannot run here.**
Symptom: the HyperFrames media-use audio engine would drop every ElevenLabs line as "TTS failed - omitted".
Cause: that route shells out to the Python `elevenlabs` package, which is not installed on this machine.
Fix: `generate-voice.mjs` calls both providers over plain HTTPS and needs no package and no path into `~/.agents`.

15. **Gemini TTS rejects a speed setting.**
Symptom: "Gemini TTS uses style for pacing; omit speed or use 1".
Cause: the Gemini TTS models take pacing only from the delivery prompt.
Fix: ask for "around 160 words per minute" in the style prompt and fit the length with `atempo` afterwards.

16. **The original project pinned an older HyperFrames.**
Symptom: `npm run check` in the original downloads hyperframes 0.8.97 although 0.8.140 is installed.
Cause: its scripts pin `npx --yes hyperframes@0.8.97`.
Fix: the template pins 0.8.140, the version in `TOOLKIT.md`; the CLI reports 0.8.138 as latest, which has not been tested with this style.

17. **Generated files get stamped and cached.**
Symptom: `data-hf-id` attributes appear in `index.html` and the compositions, and `.hyperframes/`, `.thumbnails/`, `.waveform-cache/` and `.media/` appear in the project.
Cause: the Studio and `check` stamp element ids and cache thumbnails and waveforms.
Fix: harmless; `assemble.mjs` rewrites the generated files from scratch, and the template's `.gitignore` excludes the caches and the generated files.

18. **GSAP loads from a CDN.**
Symptom: expected without network (not tested): GSAP fails to load, no timeline registers, and the scenes cannot animate.
Cause: `index.html` loads `gsap@3.14.2` from cdn.jsdelivr.net, as the original did.
Fix: render online, or copy `gsap.min.js` from `js-kit/node_modules/gsap/dist/` next to the project and point the script tag at it.

19. **Whisper merges or drops punctuation.**
Symptom: "Sometimes, finding" is heard as "Sometimes finding", and "leap... and" as "leap, and".
Cause: Whisper writes its own punctuation.
Fix: the verifier compares words only; write numbers as words so "three" is not heard as "3".

20. **The contact sheet timestamps came out doubled.**
Symptom: labels read 0, 4, 8 seconds for frames taken every 2 seconds.
Cause: after `fps=1/2`, ffmpeg's `t` is already the real time, and the first attempt multiplied it by 2.
Fix: `scripts/contact-sheet.mjs` prints `t` as is.

21. **The original had a Gemini "listening" check that never produced a report.**
Symptom: `scripts/verify-voice.mjs` in the original sends the clips to Gemini and asks for transcripts, but no `voice-verification.json` exists.
Cause: unknown; the CPU Whisper check became the gate instead.
Fix: not ported; the local Whisper check is free, deterministic and was what proved the export.

## 5. Open questions and weak spots

- Chapter labels are 18 px sans at 1080p: fine full screen, small on a phone; 22 to 24 px may read better.
- The engine draws one character well; a different hero needs new drawing code, and that is the slowest part of a new story.
- Every shot is locked off; a slow push-in per scene would add life but has not been tried.
- Title and closing fades are timed inside the dawn and home painters, not in `config.json`.
- 16:9 only; a vertical cut would need a new layout for every scene.
- There is no mastering step: the final -15.2 LUFS came from HyperFrames' own mix of -18 LUFS voice and the 0.32 ambience, so measure every new export.
- Gemini 3.8 Flash TTS is used through the Interactions API, which may change; if it does, compare with the HyperFrames media-use adapter (`media-use/audio/scripts/lib/gemini-tts.mjs`).
- The ElevenLabs route in `generate-voice.mjs` follows the request the Stoker film used successfully but has not yet produced a storybook narration.
