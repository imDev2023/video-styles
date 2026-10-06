# Playbook: cairo-night-sky

## 1. Setup

- Copy the template into the workspace (`/Volumes/Farhan/Work Folder/Dev/AI/AI-video-genetration` on the owner's machine), never edit it in place:

  ```bash
  cp -R styles/cairo-night-sky/template videos/<name>
  cd videos/<name>
  ```

- Everything needed is already installed on the workspace machine; check `TOOLKIT.md` in the workspace before installing anything.
  The parts this style uses: Python 3.12 with pycairo 1.28, numpy 2.0.2, pillow and pedalboard 0.9.25; ffmpeg 8 with libx264 and aac; fluidsynth 2.6.1; sfizz_render 1.2.3; `~/soundfonts/MuseScore_General.sf3` and the Salamander Grand Piano V3 SFZ set; the macOS font Bradley Hand Bold.
- There is no `fetch-assets` script: the style downloads nothing at build time.
  The soundfonts and sfizz are referenced from `~/soundfonts` (override with `SOUNDFONT_DIR`) and are never copied into the repository.
  On a machine without them, `music_synth.py` makes a thinner score from pure numpy.

## 2. Steps

1. Write the beat sheet: every station, its start time, what colours in, and the cue it makes.
   Put the shared times in `config.py` (the TIMELINE block), because `world.py` and `music.py` both read them.
2. Edit `config.py`: `NAME`, `DUR`, title, end card, sign and bubble text, palette, timeline, camera keys, chords and melody.
3. Rewrite `world.py`: geometry first, then `SEGS` (the hero's path as timed pieces that meet end to end), then one `scene_*` per station, then the paint order in `draw_world`.
   Check the path with stills at every piece boundary before drawing details.
4. Preview stills at every beat:

   ```bash
   python3 render.py test 1.5 4.5 9.6 14.5 21 25.5 28.5 38
   ```

5. Contact sheet of the whole timeline (about 7 s):

   ```bash
   python3 render.py sheet        # test/sheet.jpg, a frame every 2 s
   ```

6. Short clips of anything that moves fast (bounces, the wheel, the machine shake):

   ```bash
   python3 render.py clip 8.5 12.8
   ```

7. Score (about 30 s, the sfizz piano render is most of it):

   ```bash
   python3 music.py               # out/audio.wav, out/score_*.mid, out/stem_*.wav
   ```

8. Full render (about 2 to 3 minutes for 48 s on 20 cores) and mux:

   ```bash
   python3 render.py full         # out/silent.mp4
   python3 render.py mux          # out/<NAME>.mp4
   ```

9. Copy the export to the workspace root under a descriptive name, as the workspace `CLAUDE.md` asks.

## 3. Checks before showing anyone

- Stills at the start of every station and at every launch: the hero is on screen, never hidden behind the wrong layer, and the object it touches colours in on that beat.
- The very first frames: no stray marks where unrevealed text will appear.
- The text is in the handwriting face, not a plain sans (cairo falls back silently).
- `test/sheet.jpg`: the camera never loses the hero, and the final wide shot frames the whole world with the payoff in the sky.
- Loudness and length:

  ```bash
  ffmpeg -hide_banner -nostats -i out/audio.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
  ffprobe -v error -show_entries format=duration -of csv=p=0 out/<NAME>.mp4
  ```

  Expect about -15 LUFS integrated, the peak near -4 dBFS, and the exact `DUR`.
- Watch the muxed file once with sound: every cue lands on its event.
- When changing engine code, diff a few frames against a known-good build; tiny float differences can move a handful of anti-aliased pixels (see the last gotcha), anything bigger is a real change.

## 4. Gotchas

Each one is symptom, cause, fix.

- **Paper looked grainy and crawled after encoding.**
  Per-pixel or blocky noise in the paper texture turns into shimmering H.264 artefacts.
  Use only very low-frequency noise (6x6 and 14x14 random grids, bicubic upscaled), clamp the multiplier to 0.9 to 1.0, and encode at CRF 16; `pen.paper_grain` does this.
- **Colours swapped (a blue sun) in previews.**
  cairo's ARGB32 surface is B, G, R, A in memory on little-endian machines.
  Pipe it to ffmpeg as `bgr24`, and flip the channels before saving with PIL, as `render.to_image` does.
- **A tiny stray tick under the first title line before the second line appears.**
  The text reveal clips to a box with 4 px of padding, so a reveal of 0 still showed a sliver of the first letter.
  `D.text` now returns without drawing when `reveal <= 0` (this was a visible flaw in the original export from 0 to 1.5 s).
- **A preview still showed the frame before the one asked for.**
  `int(t * FPS)` truncates float error, for example `int(4.1 * 30)` is 122, not 123.
  The template rounds to the nearest frame.
- **Pencil lines got thicker or thinner as the camera zoomed.**
  Line widths and jitter are in world units.
  `D` divides width and jitter by the zoom so strokes stay the same on screen; text is not divided, so the title deliberately shrinks into a small sky label in the wide shot.
- **Closed outlines showed a gap at the seam.**
  The last resampled point got different jitter from the first.
  `D.line` reuses the first point's jitter for the closing point.
- **Hatching would flicker if it boiled with the outlines.**
  Only outline jitter uses the boil index; `D.fill` uses a fixed seed per shape, so colour stays put while lines wobble.
- **The camera arrived late or cut the hero off at the frame edge.**
  The keys are smoothed with a 0.5 s Gaussian, which rounds corners and spreads every move over about 1.5 s.
  Put keys 0.3 to 0.5 s ahead of the action, and for fast stretches use `CAMERA_FOLLOW`, which adds a key on the hero every 0.2 s.
- **The chain-reaction framing needed a late push-in.**
  The original code multiplies the zoom of every key before 26.5 s by 1.25 after the keys were written, which reads as a late fix for props looking too small (inferred from the code, not recorded).
  It is kept as `CAMERA_BOOST` so the keys match the original; for a new video, tune the keys at their final zoom and set the factor to 1.0.
- **The hero showed through, or vanished behind, the machine.**
  Paint order is draw order.
  The machine is split into a back part (chimney, drawn before the hero and the smoke) and a front part (drawn after), and most shapes are first filled with paper colour (`d.solid`) so they hide what is behind them.
- **The text came out in a plain sans.**
  cairo's toy font API silently falls back when a family is missing; Bradley Hand ships only with macOS.
  Check a still with text, and set `FONT` to an installed face (Caveat, Kalam, Patrick Hand and Gaegu are installed on the workspace machine).
- **fluidsynth would not play the grand piano.**
  The Salamander Grand is an SFZ sample set, and fluidsynth only reads SF2 and SF3.
  `music.py` writes two MIDI files, renders the piano channel with sfizz and everything else with fluidsynth and MuseScore General, then mixes the stems.
- **The piano stem came out very quiet.**
  sfizz renders Salamander at about -15 dB peak.
  Both stems are peak-normalised (0.60 and 0.62) before effects and mixing.
- **The level was hard to control with pedalboard's Limiter.**
  pedalboard's `Limiter` is a compressor with make-up gain, not a transparent peak limiter.
  The final level is set by a peak normalise to 0.58 after it; for a true-peak ceiling use the numpy look-ahead limiter in `videos/stoker-launch/audio/master.py`.
- **Event cues sounded a little early or late.**
  `add()` humanises timing by up to 8 ms and velocity by up to 4.
  Cues pass `human=False`; only the bed parts are humanised, and the jitter is seeded so builds repeat exactly.
- **A cue played as a drum hit instead of an instrument.**
  The MIDI writer uses raw 0-based channels, and channel 9 is General MIDI percussion.
  Keep instruments on channels 0 to 8 and 10 to 15.
  If you port the score to midi-writer-js, see the channel off-by-one note in `TOOLKIT.md`.
- **The docstrings did not match what the code did.**
  The original `music.py` said "fluidsynth + GeneralUser GS" long after it moved to Salamander plus MuseScore General (fuller strings, winds and harp), and kept an unused `SF2` path.
  When the sound changes, update the docstring and `README.md` in the same edit.
- **The first soundtrack wrote `audio.wav` into whatever folder it was run from.**
  The original `audio.py` used a bare relative path.
  Every path in the template is built from `Path(__file__).resolve().parent`; never from `URL.pathname`, because the workspace path contains a space.
- **Importing the score started a full audio render.**
  The original `music.py` ran at import and imported `render.py` (and cairo) just to read a few times.
  Shared times now live in `config.py`, and `music.py` only renders inside `main()`.
- **Render workers were hard-coded to 16.**
  The template uses `WORKERS` from `config.py`, defaulting to every core.
- **The mux can come out a frame short.**
  ffmpeg's `-shortest` cuts to the shorter stream, and the frame count is `int(DUR * FPS)`.
  Keep `DUR * FPS` a whole number so the video and the `DUR`-long audio match.
- **sfizz library path.**
  `TOOLKIT.md` says `sfizz_render` needs `DYLD_LIBRARY_PATH`; on the installed 1.2.3 build `otool -L` shows only system libraries, so it is not strictly needed.
  `music.py` still sets it, which is harmless, but it passes it directly to the binary: through `shell=True` or a `/bin/sh` script, macOS strips every `DYLD_*` variable.
- **Two builds of the same code differed by a few pixels.**
  The camera smoothing (`np.convolve`) can round differently in the last bits between runs, and a tiny zoom change can flip how many points a line is resampled into.
  This is harmless; only worry about differences larger than a few anti-aliased edges.

## 5. Open questions and weak spots

- The night-sky wash is drawn in screen space and starts at 31 s, before the camera settles at 34 s, so the hatching slides over the world during the pullback and partly covers the small title in the sky.
  Starting it after the camera stops, or drawing it in world space, would be cleaner.
- The last 8 s are a held wide shot with only twinkles and the end card; a final small character beat (the owl turning, the mole waving) or a shorter tail would help.
- In the final wide shot (zoom 0.33) the world sits in the lower middle and its details are tiny; vertical 1080x1920 has not been tried.
- The engine (`pen.py`, `render.py`, the bottom of `music.py`) is reusable, but `world.py` is hand-placed numbers, so a new story means rewriting it almost entirely.
- No voice-over or captions; pair with a narrated style if a story needs words.
