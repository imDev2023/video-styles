# Playbook: pencil storybook

How to make a video in this style from start to finish, and every problem met so far.
Paths are relative to the workspace folder, which contains a space, so always quote them in the shell.

## 1. Setup

Read `TOOLKIT.md` in the workspace first: everything this style needs is already installed there.

| Need | Where it is | Notes |
| --- | --- | --- |
| Node.js 20 or newer | v26.9.0 on this machine | Global `fetch` and `os.availableParallelism` are used. |
| skia-canvas 3.0.8, midi-writer-js 3.2.1, spessasynth_core 4.3.22 | `js-kit/node_modules` | Only these three are imported. |
| ffmpeg and ffprobe with libx264 and aac | system ffmpeg 8.0 | Called by name from the PATH. |
| Caveat variable font (OFL) | `~/Library/Fonts/Caveat[wght].ttf` | `fetch-assets.mjs` copies it into `assets/fonts/`, or downloads it from google/fonts. |
| MuseScore_General.sf3 (MIT) | `~/soundfonts/` | `fetch-assets.mjs` downloads it if it is missing. Arachno and Timbres of Heaven are also in `~/soundfonts/`. |
| Python mido (optional) | Anaconda Python | Only for the manual MIDI dump in section 3. |

Copy the template into `js-kit/`, not `videos/`, because the scripts import packages by bare name and Node only finds `js-kit/node_modules` by walking up from the script:

```bash
cd "/path/to/AI-video-genetration"
cp -R styles/pencil-storybook/template js-kit/<slug>
cd js-kit/<slug>
node fetch-assets.mjs
node render.mjs beats          # proves the copy works: these are stills of the autumn film
```

Nothing new needs installing.
If you do install something, add it to `TOOLKIT.md` in the same session.

## 2. Steps

### 2.1 Settings and story beats (`config.mjs`)

Set `VIDEO` (slug, size, fps, length), `TITLE`, `END`, and the palette.
Write the story as `STORY` beats, one line and one time each, from the beat table the operator approved at the story check (`BRIEF.md`, check-in 1).
`node render.mjs beats` renders one still per beat and is the main loop for the whole build.
`node render.mjs board` tiles the same stills into one numbered storyboard (`out/test/board.jpg`) for the storyboard check-in; the operator answers by panel number.

### 2.2 The world (`world.mjs`)

This file is per-video and is replaced for a new story; the autumn version is the worked example.
It must export `cameraKeys()`, `BACKGROUND`, `SCENES` and `TIMES`.

1. Lay out the stations in world units, ground at `y = 0`, up is negative `y`, one unit is one pixel at zoom 1.
   Autumn put the oak at x 150, two leaf trampolines at 365 and 560, a log ramp from 700 to 1010, a seesaw at 1180, a stump at 1360, a web at 1650, three paint pots from 1900 to 2300 and a pond at 2540.
   The creek then winds down to a second ground line at `y = 1400`, where the water wheel, the brush gantry, the maple and the hedgehog sit.
2. Name every beat time as a constant (`T_SEESAW = 10.7`, `T_WEB = 12.4`, the pot times) and derive later times from the motion (the bucket tip time `T_TIP` is found by scanning the wheel's angle table).
3. Write the hero's path as a list of `[t0, t1, fn(u)]` segments.
   Use `arcFn(P, Q, H)` for a parabolic hop of height `H`, `surf(bezier, u, R)` to roll along a curve with the hero's radius `R`, and hold positions (on the seesaw, in the web, in the boat) as their own cases.
4. Draw each scene as a function `(p, t)` using the pen: `p.solid(pts)`, then `p.fill(pts, colour, amount, seed)`, then `p.line(pts, seed, { closed: true })`.
   Animate `amount` with `prog(t, t0, d)` so a prop colours itself in just before the hero arrives.
   Use `sq(t, t0)` from `world.mjs` (a decaying cosine) to squash a prop when the hero lands on it.
   Give every shape its own seeds; reusing a seed makes neighbours hatch at the same angle.
5. Anything that accumulates over time (an angle driven by a varying speed, a painted state) is computed once at module load into a table or a per-object time, never stepped frame by frame.
   Autumn integrates the water wheel speed into the `WT` table and precomputes the moment the brush passes each maple leaf (`paintT`).
6. List the scene functions in `SCENES` from back to front.
   A later scene's `p.solid` underlay hides earlier lines, which is how overlaps stay clean.
7. Write the camera as `[t, x, y, zoom]` keys.
   Follow a moving hero by sampling its path (autumn samples the creek every 0.4 s), and end with a key past the last second.
8. Export `TIMES` with every event the music should hit.

Check with stills after every change:

```bash
node render.mjs test 4.5 10.2 37      # any times, full size, into out/test/
node render.mjs beats
node render.mjs sheet 3               # out/test/sheet.jpg, 20 frames for 60 s
```

A still takes well under a second, so check often and look at every one.

### 2.3 The score (`score.mjs`)

1. Fill `INSTRUMENTS` with `[GM program (0-based), MIDI channel (1-based)]`, one instrument per channel, skipping channel 10 unless it is percussion.
2. In `compose()`, lay one chord per bar from a progression, add the beds, then the melody phrases act by act, then the cues on `TIMES`.
   `add(name, seconds, duration, pitch, velocity, humanise)` humanises timing by up to 8 ms and velocity by up to 4 unless `humanise` is false; keep cues unhumanised so they land on the frame.
3. Render and listen:

```bash
node music.mjs                         # out/score.mid, out/music_raw.wav, out/ir.wav; fails loudly on a channel mix-up or silence
```

### 2.4 Full render, master and export

```bash
node run.mjs                           # out/silent.mp4; 1800 frames in about 30 to 40 s with 12 workers
node master.mjs                        # out/<slug>.mp4, then prints stream durations, loudness and true peak
cp out/<slug>.mp4 ../../               # the workspace keeps the latest export of every video at its root
```

To compare soundfonts without re-rendering the picture:

```bash
node music.mjs ~/soundfonts/Arachno.sf2 arachno && node master.mjs arachno
node music.mjs ~/soundfonts/TimbresOfHeaven.sf2 timbres && node master.mjs timbres
```

## 3. Checks before showing anyone anything

1. `node render.mjs beats` and `node render.mjs sheet 3`, then open and look at every image.
   Look for props coloured in before their beat, characters cut by the frame edge, a hero hidden behind a prop, empty frames, and the title or end card overlapping something important.
2. `run.mjs` fails unless `out/silent.mp4` has exactly `DUR x FPS` frames.
3. Seams between parallel segments (every `segFrames` frames, 150 by default): pull the last and first frame of each pair and compare them side by side; motion should continue smoothly.

   ```bash
   for n in 149 150 299 300; do ffmpeg -v error -y -i out/silent.mp4 -vf "select=eq(n\,$n)" -frames:v 1 out/test/seam_$n.png; done
   ```

4. `music.mjs` checks the MIDI channels itself; to see them by hand:

   ```bash
   python3 -c "import mido; [print(t.name, {m.channel for m in t if m.type=='program_change'}, {m.channel for m in t if m.type=='note_on'}) for t in mido.MidiFile('out/score.mid').tracks]"
   ```

   Each track's two sets must be equal, and 0-based channel 9 must only appear on a percussion track.
5. `master.mjs` prints the result: video and audio durations must both equal `DUR`, integrated loudness must be within 1 LU of -15 LUFS, and true peak at or below -2 dBTP.
   It exits non-zero when loudness or true peak is out of spec; check the durations by eye.
6. A contact sheet of the actual export, with every frame pulled at an exact time (see gotcha 11 for why not the `fps` filter):

   ```bash
   mkdir -p out/sheet; i=0; for t in 1 4 7 10 13 16 19 22 25 28 31 34 37 40 43 46 49 52 55 58; do ffmpeg -v error -y -ss $t -i out/<slug>.mp4 -frames:v 1 -vf scale=270:270 out/sheet/f$(printf %02d $i).png; i=$((i+1)); done
   ffmpeg -v error -y -i out/sheet/f%02d.png -vf "tile=5x4:padding=6:margin=6:color=0xe6dfcf" -frames:v 1 -q:v 4 out/sheet.jpg
   ```

7. Watch the whole export once with sound, and check that every cue lands on its event.
8. Text check, measured rather than eyeballed: a cropped label looks fine on a contact sheet, and a one-frame overlap is never on the sheet at all.

   ```bash
   node textcheck.mjs              # every 6th frame plus every STORY beat, about 10 s
   node textcheck.mjs --every 1    # every frame, about 75 s, for the final pass
   ```

   It hooks every `fillText` and `strokeText` on the frame canvas, traces each string's box through the camera transform to screen space, and fails (exit 1) on text cut off by the frame edge or overlapping other text; on a vertical frame it also warns about text under the phone UI (top 240/1920, bottom 420/1920 and right 140/1080 of the frame, or `CHECK.safe` in `config.mjs`).
   A deliberate crowd of text goes in `CHECK.textIgnore` as `[t0, t1, "why"]` so the check still guards the rest of the film.
   On autumn it passes at every frame; with the title baselines moved 55 px apart and the end card at y 1100 it reports the overlap and the cut-off, so it does catch what it claims to.
9. Dead-beat check on the silent render, with the shared tool from the library root: something new should happen on screen every 2 to 4 seconds, and a stretch longer than 3 s where the picture barely changes is a hold the eye forgives on a contact sheet but not in the film.

   ```bash
   node ../../styles/tools/deadbeats.mjs out/silent.mp4                 # exit 1 on any stretch over 3 s
   node ../../styles/tools/deadbeats.mjs out/silent.mp4 --exempt 56-60  # when a hold is deliberate, say so
   ```

   It decodes the film to 96 px grayscale and measures each frame against the frame half a second earlier; "still" is a quarter of the film's own median change, so the boiling pencil does not hide a dead beat (autumn's median change is 5.8, still is below 1.45, and it passes with no stretch over 2 s).
10. Hard-cut check on the silent render: this style promises one travelling camera, so any hard cut is a bug.

   ```bash
   python3 ../../styles/tools/cuts.py out/silent.mp4 --max 0   # exit 1 on any hard cut
   ```

   It measures each frame against the frame before on a 96 px grayscale copy (a cut is a jump of 18, or 20 times the film's median change, never under 4, and three times its neighbours).
   Autumn's median change is 0.87, so its limit is 17.4, and it reports 0 cut events.
11. Frame strips of every hand-off, read against the panel's reads from the storyboard check.

   ```bash
   node ../../styles/tools/strip.mjs out/silent.mp4 --from <t> --dur 0.5   # every frame of a hand-off, numbered
   ```

   Count the frames each read gets (30 frames is 1 s here); a read under 8 frames, two reads on the same frames, or a pop between two frames means the beat table changes, not the drawing.
12. Determinism check: the same frame rendered in two different orders must be identical, or state is leaking between frames (a counter, a cached hand-off point), which breaks the parallel segments and every re-render.

   ```bash
   node render.mjs test 12 40 && cp out/test/t12*.png /tmp/a.png && node render.mjs test 40 12 && cmp /tmp/a.png out/test/t12*.png && echo identical
   ```

   Pick times that straddle a hand-off, because a cached hand-off only shows when the frames cross it.

## 4. Gotchas

Each one is symptom, cause, fix.

1. **Fills shimmer, or the outline does not boil (roughjs, The Moon Boat).**
   Symptom: with roughjs the whole drawing crawls every frame, crayon fill included, or nothing moves at all.
   Cause: roughjs draws fill and outline from one random seed per call, so a shared seed makes both boil or both freeze.
   Fix: draw the fill and the outline in separate calls; the fill gets a fixed seed (`1000 + id`), the outline a seed that changes every 1/8 s (`id * 17 + (pose % 3) * 101` with `pose = floor(t * 8)`).
   The template's own pen does the same thing by design: hatch order and angle depend only on the seed, and only `Pen.line` reads the boil pose.
2. **Every instrument plays the wrong sound (midi-writer-js channels).**
   Symptom: the melody comes out as the neighbouring instrument, silently, with no error anywhere.
   Cause: in midi-writer-js, `NoteEvent` channels are 1-based but `ProgramChangeEvent` channels are 0-based, so passing the same number to both shifts every program by one channel.
   Fix: `ProgramChangeEvent({ channel: ch - 1 })` and `NoteEvent({ channel: ch })`; `music.mjs` now reads the file back and stops if any track's note channel differs from its program channel.
   The Moon Boat score shipped with this bug and was fixed and re-muxed on 2026-10-02.
3. **A pitched part turns into drum hits.**
   Symptom: random percussion where a melody should be.
   Cause: General MIDI channel 10 is always percussion.
   Fix: keep pitched instruments off channel 10 (autumn uses 1 to 8 and 11 to 16); `music.mjs` rejects it.
4. **Stills are not written (skia-canvas `saveAs`).**
   Symptom: the test command finishes, but no PNG appears.
   Cause: `saveAs` is deprecated in skia-canvas 3 and wrote no file.
   Fix: `await canvas.toFile(path)`; for video, `await canvas.toBuffer('raw')` and pipe RGBA to ffmpeg.
5. **Outputs vanish into a second `Work%20Folder` tree (`URL.pathname`).**
   Symptom: a script runs without error, but its files are missing; a folder named `/Volumes/Farhan/Work%20Folder/...` has appeared next to the real one.
   Cause: `new URL('.', import.meta.url).pathname` keeps the space percent-encoded, and `mkdir` creates the encoded name; this happened on 2026-10-01.
   Fix: always `fileURLToPath(new URL('.', import.meta.url))` from `node:url`.
   After the first run of any new script that writes files, run `ls /Volumes/Farhan` and confirm no name contains `%`.
   That stray tree also held another project's file, so never delete such a folder without asking the owner.
6. **Trying a better soundfont overwrote the previous render, or forced a re-render.**
   Symptom: each soundfont trial replaced `music_raw.wav`; the Arachno and Timbres of Heaven versions had to be renamed by hand.
   Cause: the original `music.mjs` had one fixed output name.
   Fix: `node music.mjs <soundfont> <tag>` writes `music_raw_<tag>.wav`, and `node master.mjs <tag>` muxes it with `-c:v copy`, so the picture is never re-rendered.
   Levels differ a lot by soundfont (the same score peaks at -8.6 dBFS with MuseScore_General and -18.2 dBFS with GeneralUser GS), so always go through `master.mjs`, never mux the raw render.
   spessasynth_core reads `.sf2` and `.sf3`; an `.sfz` set such as Salamander needs sfizz (see `TOOLKIT.md`).
7. **The audio track comes out at 96 kHz.**
   Symptom: `moon-boat-js.mp4` has 96 kHz AAC audio.
   Cause: ffmpeg `loudnorm` upsamples to 192 kHz internally and passes that rate on, and the AAC encoder then caps it at 96 kHz.
   Fix: put `-ar 44100` after the loudnorm filter (`master.mjs` uses `MUSIC.sampleRate`).
8. **A cue plays 1.3 s before its event (found while building this style).**
   Symptom: in the shipped autumn film the celesta "bucket tips" sparkle plays at 32.2 s, but the bucket tips at 33.5 s.
   Cause: the cue time was typed by hand into the score, while the real time comes out of the water wheel simulation.
   Fix: `world.mjs` exports `TIMES` (including `T_TIP`) and `score.mjs` uses it.
   The shipped export and both soundfont variants were re-scored from the template and re-muxed onto the unchanged picture on 2026-10-07; the MIDI diff against the old score was exactly those 14 notes, moved 1.29 s later.
9. **A jump or pop every 5 seconds in the full render.**
   Symptom: motion snaps at segment boundaries (frames 150, 300, ...).
   Cause: each segment is rendered by a fresh process that starts at its own first frame, so any state carried from frame to frame resets there.
   Fix: make every frame a pure function of `t`; integrate anything cumulative into a table at load time; check the seams (section 3).
10. **Fourteen "Unexpected EndOfTrack. Removing!" warnings.**
    Symptom: one warning per track every time the music renders.
    Cause: midi-writer-js ends each track with two EndOfTrack events, and spessasynth_core deletes the extra one.
    Fix: harmless, no notes are lost; `music.mjs` filters exactly that message so real warnings stay visible.
11. **Contact sheet labels are wrong (found while building this style).**
    Symptom: a tile labelled 13 s showed the action from about 14.5 s.
    Cause: ffmpeg's `fps=1/3` filter picks frames by rounding timestamps, not at the exact sample times, and the offset adds to `-ss`.
    Fix: pull each frame with its own `-ss <t> -frames:v 1` and tile the PNGs (section 3), or use `node render.mjs sheet`.
12. **Paper texture turns to grain after encoding (from the sister night-stars style).**
    Symptom: a noisy paper texture looks blocky and grainy in the H.264 export.
    Cause: fine noise is exactly what H.264 compresses worst.
    Fix: keep the paper a flat colour and let the hatching carry the texture; encode at CRF 16.
13. **The master misses its loudness and true-peak targets (found while re-scoring autumn).**
    Symptom: the shipped autumn exports measured -13.3, -14.0 and -13.6 LUFS against a -15 target, and the Timbres of Heaven one had a -1.4 dBTP true peak against a -2 ceiling; the old `master.mjs` printed the numbers but did not fail.
    Cause: single-pass ffmpeg `loudnorm` lands 1 to 2 LU hot on these 60 s scores, and AAC encoding adds a few tenths of a dB of true peak after it.
    Two-pass `loudnorm` with measured values does hit -15, but the reverb mix peaks near 0 dBTP, so it cannot stay linear and falls back to dynamic mode, which rides the gain and squeezes the loudness range.
    Fix: `master.mjs` now applies a plain gain, then ffmpeg `alimiter` (5 ms look-ahead, 80 ms release, `level=false`, `latency=true`) on 4x oversampled audio so it limits true peaks, aimed 0.5 dB under the ceiling (`MASTER.limiterHeadroom`) for the AAC overshoot, and iterates the gain until the EBU R128 meter reads the target.
    It exits non-zero if the finished file is more than 1 LU off or over the ceiling.
    On autumn the limiter acts on 1 to 2 percent of the film, at most 2 to 4 dB, the output is sample-aligned with its input (`latency=true` removes the look-ahead delay), and all three soundfonts land at -15.0 to -15.2 LUFS and -2.4 to -2.5 dBTP.

### Hardening in the template (not problems that were hit)

- `run.mjs` clears `out/segs/` on every run and fails unless the output has exactly `DUR x FPS` frames, so segments from an older cut can never be concatenated into a new one.
- The concat list holds bare segment names, which ffmpeg resolves next to the list file, so the workspace path never has to be quoted inside it.
- `frame.mjs` registers the Caveat file from `assets/fonts/` with `FontLibrary.use`, and warns if the family is missing, because skia-canvas silently substitutes a default face; Caveat is installed system-wide here, so this was never hit.
- The palette lives in `config.mjs`; the original `world.mjs` declared `COPPER` below the scene that used it, which only worked because scenes run after the module has loaded.
- `music.mjs` stops with an error if the soundfont is missing or the render is silent.

## 5. Open questions and known weak spots

- The pendulum brush gantry (a tall post, a crossbeam and a hanging arm) reads like a gallows in stills, especially at 34 to 49 s in the contact sheet; a new story should use an A-frame or a tree branch.
- For the first 17 s the ground line sits at 70 to 80 percent of the frame height, so the bottom quarter of the frame is empty paper; framing the ground lower would use the square frame better.
- `world.mjs` is one long hand-written file of magic numbers; a new story means rewriting it, and only the pen, camera, compositor, render and audio engine carry over.
  A small library of reusable props (trampoline, seesaw, pot with lid, wheel, character bodies) would make the next film faster.
- Text has no pencil treatment: the title and "yum!" are clean filled glyphs, slightly crisper than the rest of the drawing.
- The template has only been run on this Intel Mac with Node 26; the parallel render uses up to 12 workers.
- No preferred soundfont has been recorded among MuseScore_General, Arachno and Timbres of Heaven; the main export uses MuseScore_General.
- The 12 s Moon Boat path (roughjs, single process) is not in the template; for a single-scene vignette, set `DUR` to 12, hold one camera key and draw ambient motion only.
