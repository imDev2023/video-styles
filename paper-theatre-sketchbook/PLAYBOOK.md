# Playbook: paper theatre and sketchbook

How the dinosaur example was made, how to make the next one from the template, and every problem found on the way.
The style was inspired by Kevin T. Ngo's animation "The history of the dinosaurs in under a minute"; no frames or files from it are in this folder.

## 1. Setup

- Tools: Node 22 or newer, ffmpeg and ffprobe on PATH, and network access for the first `npx` call.
  `TOOLKIT.md` in the workspace root lists what is already installed on this machine (Node 26, ffmpeg 8.0, HyperFrames 0.8.140 in `js-kit/`).
- HyperFrames runs through `npx --yes hyperframes@0.8.140`, pinned in `template/package.json`; nothing is installed into the project.
  The first run downloads the CLI and its headless Chrome; `npx hyperframes doctor` reports what is missing.
  The pin moved from 0.8.106 to 0.8.140 on 2026-10-08 after a scratch copy of this template rendered the same 2 s window on both versions with identical frames (mean absolute difference 0.0); before any further bump, repeat that test (`npm run window -- 26 2` on both pins, compare the frames) rather than trusting the changelog.
- Skills to load before editing composition code, in this order:
  `hyperframes` (the entry point and router), `hyperframes-core` (the composition contract: `data-*` timing, one paused timeline, determinism), and `hyperframes-cli` (check, snapshot, render).
  The example was authored through the `general-video` workflow (`authoringSkill` in `hyperframes.json`, `workflow: general-video` in its brief).
  Load `hyperframes-registry` only to install registry items such as `hw-boil`, and `hyperframes-audio` only for fades or ducking beyond the simple lane the template writes.
- Copy the template into a new video folder:

```bash
cp -R styles/paper-theatre-sketchbook/template videos/<slug>
cd videos/<slug>
```

## 2. Steps

1. Fill in `config.js`: slug, title, description, duration, panel names, range, beats, palette and music.
   Each beat needs an `id` that `scenes.js` will draw.
2. Get the assets.
   Fonts are already in `assets/fonts/` (both SIL Open Font License); this restores them if missing and fetches or converts the music, or writes a silent placeholder:

```bash
npm run assets
```

3. Rewrite `scenes.js` for the new topic: `landscape(t)` plus one function per beat id.
   Keep its header contract; reuse the dinosaur helpers (`sun`, `fern`, `tree`, `leg`, the walk-cycle bounce) as patterns.
4. Gate it.
   This stamps the config into `index.html` and runs lint, runtime, layout, motion and contrast checks:

```bash
npm run check
```

5. Look at it (see section 3), and fix until it reads well:

```bash
npm run snapshot                 # one PNG per beat midpoint into out/snapshots/
npm run snapshot -- 7.8,8,8.2    # or any times
npm run window -- 26 2           # out/window-26-2.mp4, a 2 s draft render from 26 s
npx hyperframes preview --background   # Studio, for scrubbing; stop with --stop
```

6. When approved, render and copy the export to the workspace root:

```bash
npm run render                   # out/video.mp4, 24 fps, delivery quality
cp out/video.mp4 ../../<slug>.mp4
```

## 3. Checks before showing anyone anything

- `npm run check` passes with 0 errors and 0 warnings.
  Its contrast line always says `0/0 text checks`, because all text is on the canvas; that is not a pass for the text, so read it on the frames.
- `npm run snapshot`: one frame per beat.
  Both panels must tell the same moment; nothing important may be clipped by a panel edge; the dark beat's silhouettes must still be visible on the left.
- `npm run window -- <boundary - 1> 2` for every beat boundary: the dissolve must be clean (no shape showing through another) and no colour may snap.
- Make a contact sheet of the finished render and look at it whole:

```bash
ffmpeg -i out/video.mp4 -vf "fps=1/2,scale=384:-1,tile=6x4:padding=6:margin=6:color=0xe9e2cc" -frames:v 1 -q:v 4 out/contact_sheet.jpg
```

- Probe the export: duration equals `config.duration`, 24 fps, an audio stream present.

```bash
ffprobe -v error -show_entries stream=codec_type,r_frame_rate,duration -of compact out/video.mp4
```

- Dead-beat check on the render, with the shared tool from the library root: something new should happen on screen every 2 to 4 seconds, and the check flags any stretch over 3 s where the picture barely changes.

```bash
node ../../styles/tools/deadbeats.mjs out/video.mp4     # exit 1 on any stretch over 3 s
```

  It measures each frame against the frame half a second earlier on a 96 px grayscale copy, with "still" set at a quarter of the film's own median change.
  This style's median change is low (about 1.0 on the dinosaur film, because the stage holds and only the characters move), so the floor of 0.8 applies, and on the finished export it flags 0.5 to 3.5 s: the opening egg beat before anything hatches.
  Give the opening beat idle life (a wobble, a crack, a bird crossing) rather than exempt it.
- Hard-cut check on the render: every beat change is meant to dissolve, so any hard cut is a bug.

  ```bash
  python3 ../../styles/tools/cuts.py out/video.mp4 --max 0   # exit 1 on any hard cut
  ```

  It measures each frame against the frame before on a 96 px grayscale copy (a cut is a jump of 18, or 20 times the film's median change, never under 4, and three times its neighbours).
  This style's median change is tiny (0.19 on the dinosaur film), so the floor of 4 applies, and on the finished export it reports 4 cut events, at 8, 17, 25 and 35 s (jumps of 4.8 to 8.9): the beat changes that the dinosaur re-render replaces with dissolves.
  Until that re-render, the gate fails, which is the point.
- Frame strips of every dissolve, read against the panel's reads from the storyboard check.

  ```bash
  node ../../styles/tools/strip.mjs out/video.mp4 --from <t> --dur 0.75   # every frame of a dissolve, numbered
  ```

  Both panels should change together through the dissolve, and the caption should not be readable on top of two different pictures; count the frames the new beat's first read gets after the dissolve ends.
- Determinism check: the same snapshot taken in two different orders must be identical, or state is leaking between frames, which breaks seeking in Studio and every re-render.

  ```bash
  npm run snapshot -- 8,29.5 && cp out/snapshots/*8.00*.png /tmp/a.png && npm run snapshot -- 29.5,8 && cmp /tmp/a.png out/snapshots/*8.00*.png && echo identical
  ```

  Pick times on either side of a dissolve, because a cached beat state only shows when the frames cross it.
- Text check: the title, the two panel names, the label under each panel, the caption, the chapter name and the range footer.
  The engine shrinks any string to its `maxWidth`, so cut-off is rare, but a long caption at y 998 can touch the chapter name and the range footer at y 1028, and a long label can touch the card edge.
  At the first and last frame of every beat and at the middle of each dissolve, confirm that no string touches another and that none comes within 3 px of the frame or a card edge.
  This is still a manual check here; the measured version lives in `pencil-storybook/template/textcheck.mjs`, and a port is nearly verbatim from the animate skill's browser version: open `index.html` in Playwright, hook `CanvasRenderingContext2D.prototype.fillText`, and call `window.PaperTheatre.drawFrame(t)` for the sampled times after `PaperTheatre.ready()`.

## 4. Gotchas (symptom, cause, fix)

- Symptom: handwritten text renders in a fallback cursive.
  Cause: the HyperFrames renderer does not fetch web fonts by family name, and canvas text never triggers a font load on its own.
  Fix: ship the `.woff2`, declare it with `@font-face` in `index.html`, and `await document.fonts.load(...)` before the first draw (the engine's `ready()` does this).
- Symptom: the small labels look different on another machine or in Docker.
  Cause: the original drew them with the generic `sans-serif`, which resolves to whatever the render machine has.
  Fix: the template bundles Work Sans 500 and uses it by name.
- Symptom: the "->" arrow in the range footer renders as a box or a fallback glyph.
  Cause: Google's latin subsets of Caveat and Work Sans do not contain U+2192.
  Fix: the engine draws the arrow as two strokes; keep `range.from` and `range.to` as plain text.
- Symptom: a render comes out blank, or frozen on its first frame.
  Cause: the timeline was registered on `window.__timelines` before the async font load finished (lint rule `gsap_timeline_registered_before_async_build`), or the boot threw.
  Fix: register `window.__timelines.main` as the last line inside the `ready()` callback, as `index.html` does.
- Symptom: changing the video length in a script has no effect, or the end is cut off.
  Cause: HyperFrames reads the root `data-duration` once, before any script runs.
  Fix: `config.js` is the single source; `npm run sync` (run by check, snapshot, window and render) stamps it into `index.html`, and the engine throws "root data-duration differs" if they disagree, which fails `check`.
- Symptom: `check` warns `clip_media_fit` and the audio slot ends early.
  Cause: the music file is shorter than the video.
  Fix: use a track at least as long as `duration`; the silent placeholder carries a `.placeholder` marker and `npm run assets` rebuilds it when the duration changes.
- Symptom: the render is silent.
  Cause: an `<audio>` without an `id` is never mixed (lint `media_missing_id`), or the placeholder is still in place.
  Fix: keep `id="soundtrack"`; `fetch-assets` prints a warning while the placeholder is used.
- Symptom: in the original export the sky snaps from peach to ochre at 8 s, and the hills snap from charcoal to green at 35 s while the sky is still dark.
  Cause: colours were chosen with `t < x ? a : b`, and the hills ignored the darkness factor that drives the sky.
  Fix: blend every colour change with `mixColor` over an envelope, and drive sky, hills, sun and ash from the same `night` value (done in the template's `scenes.js`).
- Symptom: in the original export characters pop in and out at every beat boundary, and the forest vanishes in one frame at 27 s.
  Cause: each beat drew only inside its own time window, and the trees had a hard end time.
  Fix: `actorFade` cross-dissolves beats around each boundary, and the forest now fades out under the impact flash.
- Symptom: during a fade, a character's legs show through its body and palm leaves show through their trunk.
  Cause: lowering `globalAlpha` fades each shape on its own, so overlaps add up.
  Fix: wrap anything that fades in `api.fade(alpha, () => ...)`, which draws it opaque into an offscreen layer and composites the layer; the engine does this for beat dissolves.
- Symptom: a frame throws `IndexSizeError` or draws nothing during a dissolve.
  Cause: in a cross-dissolve a beat runs slightly before its start, so `u` is negative and a size like `60 + u * 360` goes below zero.
  Fix: guard such shapes with `u >= 0`; the engine's `ellipse` also clamps radii to 0.
- Symptom: a long caption or label runs off the frame and `check` still passes.
  Cause: the layout audit cannot see canvas text.
  Fix: the engine shrinks title, labels and caption to fit their slots; still keep captions under about 45 characters.
- Symptom: something changes between two renders of the same frame, or reverse scrubbing in Studio looks different from playing forward.
  Cause: `Math.random`, `Date`, or state carried from one frame to the next.
  Fix: every position is a closed-form function of time; use `api.hash(n)` for fixed scatter, and ballistic formulas (position from `u` and `u * u`) for bursts and falling ash.
- Symptom: the pencil boil is hard to notice.
  Cause: the whole sketch panel moves by about 1 px at 8 poses a second, copying the original.
  Fix: raise `boil.amp` in `config.js` (2 to 3 px is clearly hand-drawn) and look at a window render before committing to it.
- Symptom: a folder named `Work%20Folder` appears next to the real workspace.
  Cause: a Node script built a path from `URL.pathname`, which keeps the space encoded.
  Fix: the tools use `fileURLToPath(new URL(..., import.meta.url))`; after a new script's first run, list the folder above the workspace and check that no name contains `%`.
- Symptom: there is no way to render just a few seconds.
  Cause: `hyperframes render` has no start or end flags.
  Fix: `npm run window -- <start> <length>` renders a temporary copy whose root duration is the window length and whose engine adds the start as a time offset.
- Symptom: `compositions/components/hw-boil.html` sits in the original project but nothing uses it.
  Cause: `npx hyperframes add hw-boil` installs the registry component's self-preview file along with its Caveat font, and the original only borrowed its quantized-pose idea and its font.
  Fix: the template leaves it out; install it only if you want its SVG boil and draw-on helpers for DOM elements.
- Symptom: the project folder grows by megabytes after previewing.
  Cause: Studio and `snapshot` write `.hyperframes/`, `.thumbnails/`, `.media/`, `.waveform-cache/` and `snapshots/` (the original holds 7 MB of PNGs).
  Fix: the template's `.gitignore` excludes them, and its snapshot script writes into `out/`.
- Symptom: the colours in `DESIGN.md` of the original do not match its frames (ink #303e67).
  Cause: the code was tuned after the design note was written; the code uses #35466e.
  Fix: the template's `config.js` palette is taken from the code, not the note.
- Symptom: the original's soundtrack cannot be published.
  Cause: it was extracted from the inspiration video.
  Fix: never copy it; use a licensed track or compose one, and record the credit in `config.js`.

## 5. Open questions and weak spots

- GSAP loads from jsDelivr at render time, so a render needs network access.
  Vendoring `gsap.min.js` into `assets/` would make renders fully offline; check its licence terms before committing it to the public repository.
- Rendering is slow: the 2 s window took about 28 s with screenshot capture on one worker, so the full 47.5 s is several minutes.
  `npx hyperframes benchmark` can compare worker counts.
- The layout is fixed at 1920x1080; a 9:16 or 1:1 version needs the panels stacked and new geometry in `engine.js`.
- In the dark beat the paper-cutout survivor bird is near-black on near-black and barely reads on the left panel; a lighter rim or a slightly lighter ground would help.
- The impact flash and the meteor overlap the predator at the moment of impact, which reads as the meteor hitting it; decide on purpose for a new topic whether the turning point should hit a character.
- The template keeps the original's drawings so it can be checked against the export; a smaller generic example scene set would make a cleaner starting point for non-nature topics.
- The music was characterised by measurement, not by listening; audition any new bed against the dark beat before the full render.
