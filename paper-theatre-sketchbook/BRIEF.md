# Brief: a new paper theatre and sketchbook explainer

Paste everything below the line into a fresh session, then fill in or skip the inputs.

---

Make a short explainer video in the "paper theatre and sketchbook" style from my style library.
Read `styles/paper-theatre-sketchbook/README.md` and `PLAYBOOK.md` first, and look at the stills in `reference/`.
Build it from `styles/paper-theatre-sketchbook/template/` copied into `videos/<slug>/`; do not start from a blank HyperFrames project.
Load the `hyperframes` skill, then `hyperframes-core` and `hyperframes-cli`, before touching composition code.

## Inputs (ask me for these; use the default when I skip one)

- Topic: what the story is about.
  No default; ask.
- Message: the one sentence the ending should leave behind.
  Default: the topic's "and it is still going" line, like "The story is still flying."
- Title: the handwritten line at the top.
  Default: "A tiny history of <topic>".
- Length: default 45 to 50 seconds.
  Keep it between 30 and 90.
- Beats: default 7, each 4 to 9 seconds.
  The example used 8, 9, 8, 4, 6, 8 and 4.5 seconds.
- Panel names: default "PAPER THEATRE" and "THE SKETCHBOOK".
- Range footer: the "from -> to" on the bottom right.
  Default: the story's first and last time or stage, in capitals, like "230 MILLION YEARS -> TODAY".
- Palette: default the example's tokens in `config.js` (ivory paper, navy ink, ochre, teal, rust, olive).
  Change the sky colours per beat to fit the topic, and keep the paper, ink and label colours.
- Music: a licensed track at least as long as the video, as a direct link or a local file, plus its credit line.
  Default: compose an original bed with the JavaScript kit (see `js-kit/moon-boat/music.mjs` and the soundfont notes in `TOOLKIT.md`): gentle, warm, about 90 to 100 BPM, sparse notes, a major key, building in the middle, dropping for the dark beat and swelling at the end.
  Never reuse audio ripped from a reference video.

## Story shape

- A single arc from a small beginning to "still here today", told in 5 to 8 beats.
- Each beat has: a chapter name (2 to 4 words in capitals), a short label shown under both panels (a date, era or stage, under 40 characters), and one caption line (under 45 characters, a full sentence with a full stop).
- Include one turning point: a short beat where something arrives or breaks, followed by a dark or quiet beat, then a recovery.
  The left panel goes dark for it while the sketchbook stays on paper; that contrast is the strongest moment of the style.
- End on an image that rhymes with the opening (the example opens and closes on an egg).

## Direction

- One fixed stage, no camera moves, no hard cuts.
  The landscape persists and changes smoothly; characters cross-dissolve at beat edges.
- Every subject is a handful of flat SVG path strings drawn on Canvas 2D, with 1 to 3 moving parts (legs, neck, wings, head).
  Motion comes from sines on those parts plus slow drift across the panel.
- Each drawing is written once and renders twice: flat dark cutouts on the left, ink outline plus hatching and colour on the right.
  Use the engine's `look(paper, pencil)` for every colour that differs between the panels.
- Keep to the example's palette and line weights; one accent colour per character.
- Everything is a pure function of time: no `Math.random`, no state carried between frames.
- Text stays handwritten Caveat for the title, labels and captions, and the small sans labels stay Work Sans; both fonts ship with the template.

## Structure

- `config.js`: slug, title, description, duration, panel names, range, the beat list (id, start, chapter, label, caption), fades, boil, palette, music.
- `scenes.js`: one drawing function per beat id plus `landscape(t)`.
  Replace the dinosaur drawings; keep the file's contract (see its header).
- `engine.js`, `index.html` and `tools/`: leave alone unless the style itself changes.

## Sound

- One music bed, no voice, no sound effects, faded in over 0.4 s and out over the last 2 s (set in `config.js`).
- Master the bed to about -16 to -19 LUFS integrated with a true peak under -2 dBFS before handing it to `fetch-assets`.
- Put the music credit in `config.js` and in the video description.

## Build and checks

- `npm run assets`, then `npm run check` until it passes with no warnings.
- `npm run snapshot` and look at every frame: check that both panels read clearly, nothing is clipped at a panel edge, and the dark beat's silhouettes are still visible.
- `npm run window -- <start> 2` around every beat boundary and the turning point, and watch them.
- Show me the snapshots and window clips before the full render.
- Full render only after I approve: `npm run render` (24 fps, delivery quality), then copy `out/video.mp4` to the workspace root as `<slug>.mp4`.
