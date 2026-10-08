# Video styles

A library of proven video styles.
Each one was made into a finished film first, then turned into a reusable folder: the prompt to start a new film, a playbook of every step and gotcha, working template code, and reference stills.
Every style's template was smoke-tested from a fresh copy and re-renders its original film.

## Styles

| Style | What it is | Reach for it when | Stack |
| --- | --- | --- | --- |
| [ai-lab-launch](ai-lab-launch/) | 22 s square launch film: white page, typed captions on the voice, liquid-glass controls, real photos on 16th notes, a music drop on the verb line. | Launching a product, model or app with an input, an output and a few settings. | HTML canvas, Playwright, ElevenLabs, faster-whisper, numpy mix |
| [pencil-storybook](pencil-storybook/) | Wordless picture-book story drawn live in boiling pencil and crayon hatching, characters with faces, a composed orchestral score. | A 12 to 60 s "how X got its Y" children's story with characters and a camera that travels. | skia-canvas and roughjs in Node, spessasynth score |
| [cairo-night-sky](cairo-night-sky/) | A glowing spark rides a Rube Goldberg chain reaction in pencil and crayon, one continuous camera, ending under a crayon night sky; a lullaby with a cue per event. | A 30 to 60 s wordless chain reaction where each object colours itself in as the hero reaches it. | pycairo in Python, sfizz piano and fluidsynth |
| [paper-theatre-sketchbook](paper-theatre-sketchbook/) | One story told twice at once: a paper-cutout diorama and a pencil sketchbook side by side, the same drawings moving in sync. | A short explainer or history where a two-panel "stage and notebook" framing helps. | HyperFrames HTML composition |
| [narrated-storybook](narrated-storybook/) | Flat-vector picture book painted in Canvas 2D, one hero through six places, a warm narrator reading a 100-word story over code-generated ambience. | A gentle narrated bedtime-style story, 45 to 60 s, 16:9. | HyperFrames, Gemini or ElevenLabs voice, whisper.cpp check |

## How to use a style

1. Read the style's `README.md`, then `BRIEF.md`, then `PLAYBOOK.md`.
2. Copy its `template/` where its playbook says (usually `<workspace>/videos/<name>/`), fill its config, and run its fetch-assets script.
3. Follow the playbook, and run its checks before showing anyone anything.
4. Write what you learn back here: new gotchas into `PLAYBOOK.md`, better defaults into `BRIEF.md`, engine fixes into `template/`.

Every brief walks through three check-ins before anything is animated: a beat table to approve, 2 to 4 look frames, then a storyboard of every beat with each panel's reads (what the viewer must understand, each with a start and an end time).
Every playbook's checks include measured ones: a dead-beat check (`tools/deadbeats.mjs`), a hard-cut check (`tools/cuts.py`, gated or compared with the beat grid from `tools/beats.py`), frame strips of every transition (`tools/strip.mjs`) read against the reads, and a text check (cut off, overlapping, under the phone UI), measured by code in pencil-storybook and by eye elsewhere until ported.

`FORMAT.md` describes the folder shape for a new style and what may be committed.

## Shared tools

`tools/deadbeats.mjs <video> [--max 3] [--exempt a-b,...]` finds stretches where the picture barely changes, from the video file alone (ffmpeg, ffprobe and Node 18 or newer).
It exits 1 when a stretch is longer than the limit, so a playbook can treat it as a gate.

`tools/cuts.py <video> [--max N] [--min-gap f] [--beats beats.json --grid 4]` lists every hard cut (a frame whose 96 px grayscale picture jumps from the frame before) with its time, merges cuts within `--min-gap` frames into one event, exits 1 when there are more events than `--max`, and with `--beats` reports how many events sit on the music's grid (ffmpeg, ffprobe, Python 3 and numpy).

`tools/beats.py <audio or video> [--fps 24]` prints the beat grid (BPM, phase, every beat with its bar position and strength), the onsets and the loudness per quarter second as JSON, for placing cuts and hits on the music and for `cuts.py --beats` (ffmpeg and numpy).
It assumes a steady 4/4 grid, so for a rubato score read its onsets rather than its beats, and run it on the music alone: the Stoker mix with the voice on top reads 81 BPM where the music file reads its true 130.

`tools/strip.mjs <video> --from <s> --dur <s> [--cols 6] [--w 240] [--out strip.jpg]` tiles every frame of a short stretch into one image with the frame number on each tile, for reading a transition or a key motion frame by frame (ffmpeg with drawtext, ffprobe and Node 18 or newer).

`tools/sfx.mjs cues.json picture.mp4 out.mp4 [--bed bed.wav --bed-vol .5 --bed-at 0 --lufs -14] [--keep-audio]` synthesizes sound effects (pop, whoosh, whip, tick, thump, crack, sparkle, buzz, scratch, drip, boing, riser, splash, click, step, fall, chime, chirp, burner) at the times in a cue list, mixes them over an optional bed or the picture's own track, loudness-normalises to -14 LUFS with a true-peak ceiling, and muxes the result onto the picture (Node 18 or newer, ffmpeg and ffprobe).
Write the cue list from the beat table's sound-cue column, each cue about 0.03 s before its visual.

`cuts.py` and `beats.py` are adapted from makevoid/motion-graphics-music-video-skill (MIT, Copyright (c) 2026 makevoid) and keep its notice in their headers; `sfx.mjs` is adapted from buildwithhanif/claude-animation-skill (MIT, Copyright (c) 2026 Hanif) with its notice; `strip.mjs` is written on ffmpeg after the strip mode of JohnHeibel/ClaudeAnimationBase.

## Assets and licences

This repository holds code, documents, MIDI written by code, a few SIL Open Font License fonts and small reference stills.
It does not hold downloaded music, sound effects, stock photos, voice recordings or renders: their licences allow use in a film but not redistribution, so every style fetches them at build time.
API keys are read from the workspace `.env` at run time and never written into files.
The workspace's `TOOLKIT.md` lists the tools each style expects to find installed.

## Licence

The code and documents are under the MIT licence (`LICENSE`).
`tools/deadbeats.mjs` and `pencil-storybook/template/textcheck.mjs` are adapted from the animate skill (https://github.com/cth9191/animate, MIT, Copyright (c) 2026 cth9191) and keep its notice in their headers.
The fonts in `paper-theatre-sketchbook/template/assets/fonts/` stay under the SIL Open Font License that ships beside them.
The reference stills are frames from the finished films and contain third-party photographs (CC0 from StockSnap and Unsplash-licensed photos via Lorem Picsum); those photographs keep their own licences.
