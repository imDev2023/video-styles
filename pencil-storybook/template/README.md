# pencil-storybook template

Working code for the pencil-storybook style, cleaned from `js-kit/autumn/` ("How Autumn Got Its Colors").
As shipped it renders that film's picture pixel for pixel, so a fresh copy is a known-good starting point.
The score matches too, except one cue that the original played 1.3 s early and the template now times from the picture.

## Where to copy it

Copy this folder to `js-kit/<name>/` in the workspace, not to `videos/<name>/`.
The scripts import skia-canvas, midi-writer-js and spessasynth_core by bare name, and Node finds them by walking up to `js-kit/node_modules`.
From any other folder the imports fail with `ERR_MODULE_NOT_FOUND`.

```bash
cp -R "styles/pencil-storybook/template" "js-kit/<name>"
cd "js-kit/<name>"
node fetch-assets.mjs        # Caveat font into assets/fonts/, soundfont into ~/soundfonts/ if missing
```

Needs Node 20 or newer and the system `ffmpeg` and `ffprobe` on the PATH.

## Commands

```bash
node render.mjs test 4.5 12      # full-size PNG stills at those times -> out/test/
node render.mjs beats            # one still per STORY beat in config.mjs -> out/test/beat_*.png
node render.mjs sheet 3          # contact sheet, a frame every 3 s -> out/test/sheet.jpg
node render.mjs board            # storyboard, one numbered panel per STORY beat -> out/test/board.jpg
node textcheck.mjs               # text cut off, overlapping or under the phone UI, on sampled frames; exit 1 on a fail
node run.mjs                     # full render in parallel segments -> out/silent.mp4 (about 40 s for 60 s of video)
node ../../styles/tools/deadbeats.mjs out/silent.mp4   # stretches over 3 s where nothing changes; exit 1 when found
node music.mjs                   # out/score.mid, out/music_raw.wav, out/ir.wav (about 10 s)
node master.mjs                  # reverb, fades, gain and true-peak limiter, mux -> out/<slug>.mp4; fails if loudness is out of spec
```

To try another soundfont without touching the picture:

```bash
node music.mjs ~/soundfonts/Arachno.sf2 arachno
node master.mjs arachno          # -> out/<slug>_arachno.mp4
```

Copy the export you keep to the workspace root, as the workspace `CLAUDE.md` asks.

## Files

| File | Per-video? | What it holds |
| --- | --- | --- |
| `config.mjs` | yes | Size, fps, length, palette, font, title and end card, fades, camera smoothing, story beats, text-check limits, render, music and mastering settings. |
| `world.mjs` | yes | Geometry, the hero's path, camera keyframes and every scene. Exports `cameraKeys`, `BACKGROUND`, `SCENES`, `TIMES`. |
| `score.mjs` | yes | Instruments, chords, melody and the cues that land on `TIMES`. |
| `lib.mjs` | no | The pencil and crayon pen (`Pen`) and geometry helpers. |
| `frame.mjs` | no | Font loading, camera smoothing and the frame compositor (paper, layers, title, end card, fades). |
| `render.mjs` | no | Stills, beats, contact sheet, storyboard and segment rendering. |
| `textcheck.mjs` | no | Hooks every text draw and flags strings cut off, overlapping or under the phone UI; limits in `config.mjs` `CHECK`. |
| `run.mjs` | no | Parallel segment render and lossless concat, with a frame-count check. |
| `music.mjs` | no | MIDI writing, MIDI channel check, soundfont render, synthetic reverb impulse. |
| `master.mjs` | no | ffmpeg master and mux, then loudness and duration report; exits non-zero when out of spec. |
| `fetch-assets.mjs` | no | Fetches the font and soundfont. |

Everything generated goes to `out/`, which the repository ignores.
