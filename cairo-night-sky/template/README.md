# cairo-night-sky template

Python engine and the full "How the Night Got Its Stars" story as a working example.
Copy this folder to `videos/<name>/` in the workspace, then edit it there; never edit the template in place for one video.

## Files

| File | What it is | Per video? |
| --- | --- | --- |
| `config.py` | Size, length, palette, font, title and end card, the shared timeline, camera keys, score data, soundfont paths, mix levels. | Yes, edit first. |
| `world.py` | World geometry, the spark's path (`SEGS`), one `scene_*` function per contraption, paint order. | Yes, rewrite for a new story. |
| `music.py` | `compose()` and `fx_cues()` at the top are the score and its event cues; the rest is the engine (MIDI writer, stem render, mix, master). | Top section only. |
| `music_synth.py` | No-soundfont fallback score (numpy synthesis), same cue times. | Cue section only. |
| `pen.py` | The pencil and crayon engine, props (faces, grass, flowers), camera, paper grain, night sky wash. | No. |
| `render.py` | Frame loop, ffmpeg pipe, preview modes, mux. | No. |

## Commands

Run from anywhere; every path is built from the script's own folder.
Previews go to `test/`, renders and audio to `out/` (both are ignored by git).

```bash
python3 render.py test 4.5 9.6 14.5     # one PNG per time, about 0.5 s each
python3 render.py sheet                 # contact sheet, a frame every 2 s -> test/sheet.jpg (about 7 s)
python3 render.py sheet 1               # every 1 s
python3 render.py clip 20 22            # silent 2 s clip of one section -> out/clip.mp4
python3 music.py                        # score -> out/audio.wav (about 30 s)
python3 music_synth.py                  # fallback score without soundfonts -> out/audio.wav (about 3 s)
python3 render.py full                  # whole video, silent -> out/silent.mp4 (about 2 to 3 minutes on 20 cores)
python3 render.py mux                   # out/silent.mp4 + out/audio.wav -> out/<NAME>.mp4
```

## Requirements

- Python 3.12 with pycairo, numpy, pillow and pedalboard (versions in the workspace `TOOLKIT.md`).
- ffmpeg with libx264 and aac on `PATH`.
- For `music.py` only: `fluidsynth` on `PATH`, plus these files under `~/soundfonts` (or set `SOUNDFONT_DIR`):
  - `salamander/SalamanderGrandPianoV3_48khz24bit/SalamanderGrandPianoV3.sfz`, the Salamander Grand Piano V3 SFZ sample set (about 1.8 GB).
  - `MuseScore_General.sf3`, the MuseScore General soundfont.
  - `sfizz-dl/sfizz-1.2.3-macos/usr/local/bin/sfizz_render`, from the sfizz 1.2.3 macOS release.
- These are third-party files and are never committed to this repository.
  Download them from their publishers and check each licence before use.
- The font is Bradley Hand Bold, which ships with macOS.
  On another system set `FONT` in `config.py` to an installed handwriting face such as Caveat, and check a still, because cairo falls back to a plain sans without any warning.

## Verified

Smoke-tested from a scratch copy on 2026-10-06: `test`, `sheet`, `clip`, `music.py`, `music_synth.py` and `mux` all ran.
Frames match the original `videos/night-stars/render.py` pixel for pixel, apart from the title-sliver fix (0 to 1.5 s) and a handful of anti-aliased pixels from float rounding.
`music.py` writes MIDI and `audio.wav` bit-identical to the original (-15.3 LUFS integrated, -4.3 dBFS peak).
