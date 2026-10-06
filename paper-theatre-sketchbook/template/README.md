# Paper theatre and sketchbook template

A HyperFrames project that draws a twin-panel explainer on one canvas, every frame a pure function of time.
As shipped it rebuilds the 47.5 s dinosaur example.

Needs Node 22 or newer, ffmpeg and ffprobe, and network access the first time `npx` fetches HyperFrames 0.8.106.

## Commands

```bash
npm run assets                 # fonts (if missing) and music; a silent placeholder if config.js has no music
npm run check                  # sync config.js into index.html, then lint, runtime, layout, motion, contrast
npm run snapshot               # one PNG per beat midpoint into out/snapshots/
npm run snapshot -- 8,29.5     # or at chosen times
npm run window -- 26 2         # a 2 s draft render from 26 s into out/window-26-2.mp4
npm run dev                    # Studio preview in the foreground (agents: npx hyperframes preview --background)
npm run render                 # full render into out/video.mp4 (24 fps, delivery quality)
npm run sync                   # only stamp config.js into index.html and meta.json
```

## Files

| File | Per video? | What it holds |
| --- | --- | --- |
| `config.js` | yes | Title, duration, beats (id, start, chapter, label, caption), fades, boil, palette, music. |
| `scenes.js` | yes | `landscape(t)` and one drawing per beat id. Its header documents the contract. |
| `engine.js` | no | Page layout, dual paper and pencil rendering, beat dissolves, `fade` layers, text fitting, paper texture, boil. |
| `index.html` | no | The composition root: canvas, progress line, `<audio>`, fonts, the paused GSAP timeline. Durations and audio attributes are stamped by `npm run sync`. |
| `fetch-assets.mjs` | no | Restores the pinned fonts and fetches or converts the music. |
| `tools/` | no | `sync-config.mjs`, `snapshot.mjs`, `render-window.mjs` and the shared config loader. |
| `assets/fonts/` | no | Caveat 700 and Work Sans 500 (latin subsets) with their SIL Open Font License texts. |

## Music

Set `music.url` (a direct download link) or `music.source` (a local file) in `config.js`, add `music.credit`, and run `npm run assets`.
The file lands in `assets/music/`, which is git-ignored: never commit audio.

See `styles/paper-theatre-sketchbook/PLAYBOOK.md` in the style library for the full process and the gotchas.
