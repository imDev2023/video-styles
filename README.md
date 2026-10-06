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

`FORMAT.md` describes the folder shape for a new style and what may be committed.

## Assets and licences

This repository holds code, documents, MIDI written by code, a few SIL Open Font License fonts and small reference stills.
It does not hold downloaded music, sound effects, stock photos, voice recordings or renders: their licences allow use in a film but not redistribution, so every style fetches them at build time.
API keys are read from the workspace `.env` at run time and never written into files.
The workspace's `TOOLKIT.md` lists the tools each style expects to find installed.
