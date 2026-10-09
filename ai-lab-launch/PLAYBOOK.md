# Playbook: AI lab launch film

How to make a new film in this style, in order, with the commands.
Read `TOOLKIT.md` in the video workspace first: everything used here is already installed there.

## 1. Setup

```bash
cd "<workspace>"                                   # the AI video workspace; its .env holds ELEVENLABS_API_KEY
cp -R styles/ai-lab-launch/template videos/<name>   # the template expects to live two folders under the workspace
cd videos/<name>
python3 fetch-assets.py                            # font, song, SFX and the example's images (about 20 s)
```

`film/render.mjs` loads Playwright from the workspace's `js-kit/node_modules`.
If the project lives somewhere else, set `JS_KIT=<workspace>/js-kit`.
Python needs librosa, soundfile, scipy, numba, Pillow and faster-whisper, all listed in `TOOLKIT.md`.

## 2. Gather the inputs

1. Ask for the inputs listed in `BRIEF.md`; take defaults for anything skipped.
2. Brand: if the product's code is in the workspace, read its colour tokens and font from its CSS and layout (Stoker: `globals.css` and `layout.tsx`), and its icon.
3. Logo on a white page: `python3 tools/recolor_logo.py <icon.png> <bg> <fg1> <fg2> <new1> <new2>` turns an icon on a dark tile into ink and accent on transparency (`assets/logo.png`).
4. Screenshots: capture the product's site with `agent-browser` in its own named session, light mode (`set media light`), retina (`set viewport 1440 1000 2`), then close that session by name.
5. Images: `python3 tools/search_images.py openverse <queries...>` and `python3 tools/search_images.py picsum` make numbered contact sheets; look at them and pick by number into `config.images.<set>.items`.
   The sets are `coins` (collage and burst, 480 px, 130+), `hero` (full-bleed, 1600 px, about 14, bold and dark enough for white text), `fire` (the result card's 16th-note run, 720 px, about 12 of one subject), `parrot` (the settings picture, 720 px, about 10 of one subject; put the brightest one where the 16th-note roll stops, see Gotchas).
   Rename the sets freely; `config.scenes.*.set` points at them.
6. Song: put its CDN URL in `config.music.url`, run `python3 fetch-assets.py music`, then `python3 tools/find_drop.py <approx>` and write the measured attack into `config.music.drop`.

## 3. Script and voice

1. Write the 9 lines into `config.voice.lines` (shape in `BRIEF.md`).
2. `python3 voice/tts.py takes` writes 4 takes (one per seed).
3. Measure each take before sending it: `python3 voice/measure.py voice/takes/take1.mp3,voice/takes/take2.mp3 more any` prints the transcript and the loudness and pitch of the stressed words.
   Send the user the 4 files and that table; let them pick.
4. If one line is off: `python3 voice/tts.py line <n> "<text>"` makes 4 versions with the neighbouring lines as context; measure them; splice only if one beats the take.
5. Set `config.voice.take`, then `python3 voice/process.py` tightens pauses (over 0.28 s down to 0.2 s), levels phrases (85% toward the median, gain moved only inside pauses), and writes `voice/voice.wav` and `voice/words.json`.
6. Set `config.anchors`: each scene boundary is a word index in `words.json` plus the word expected there, so a new take with different words fails loudly instead of cutting in the wrong place.
   Set `config.captions` to the word ranges each caption types, `config.display.comma_after` for spoken dashes, and `config.display.gradient_word`.

## 4. Map the product

Everything per product lives in `config.scenes`:

- `prompt.text`: what the glass prompt bar types (Stoker: `$EMBER`, a coin name).
- `result`: the card's image set, the fixed part of its label (`base`), the chip prefix, and which tile the spoken input word picks (`pick_tile`).
- `tiles`: [title, subtitle, tag] for the grid and ring, and the label sequence on the card (Stoker: Quote Assets).
  Draw them as typographic tiles in the brand's style; do not use other companies' logos.
- `settings.sliders`: three sliders, each tied to the anchor word that names it, with its range and value format.

## 5. Stills before anything else

```bash
cd film && node render.mjs stills 1.2 4.2 6.3 9.8 12.3 14.2 17.9 21.5
```

Pick times that show each scene (shift them to the new film's anchors), look at every still at full size, and also render the moments either side of every scene change (anchor minus 0.1 s and plus 0.1 s).
Crop the glass and the carets at 2x and look closely: a double caret or a frosted rectangle with hard edges is visible only there.
Show the user 8 stills on one sheet and wait for a go.

For the storyboard check, `tools/board.py` (in `videos/stoker-coming-soon/` until it is ported here) pastes the stills into `out/storyboard.jpg`, numbered with each panel's reads, and `out/seams.jpg`, the frame 0.1 s either side of every scene change.
Edit its `PANELS` list when the anchors move, and open both sheets for the operator with `open out/storyboard.jpg out/seams.jpg` in the same turn as the message.

## 6. Render, mix, check

```bash
node render.mjs events            # sound events from the same timeline
node render.mjs full 10           # 10 parallel workers; about 0.7 s per frame each, so a 23 s film takes about 3 min
cd ../audio && python3 mix.py     # prints voice over music for every phrase; all should read +9.0 dB
python3 master.py                 # -14 LUFS, true peak under -1 dBTP
cd .. && ffmpeg -y -i out/silent.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/film.mp4
python3 qa.py out/film.mp4        # contact sheet, single-frame pop scan, voice over music table
node ../../styles/tools/deadbeats.mjs out/film.mp4 --exempt 21-23   # dead-beat check; the end-card hold is the one deliberate exemption
```

The dead-beat check is the shared tool from the library root: something new should happen on screen every 2 to 4 seconds, and it flags any stretch over 3 s where the picture barely changes (each frame against the frame half a second earlier, on a 96 px grayscale copy, "still" at a quarter of the film's own median change).
On the Stoker export it flags 19.5 to 23.0 s: the logo and the closing line, held 2 s by design and then the fade.
Exempt only the held end card, and let the check see everything before it; this style's constant camera drift should keep every other scene alive.

Cut check against the music: this style cuts its photos on 16th notes, so every hard cut should sit on the song's grid.

```bash
python3 ../../styles/tools/beats.py out/music-cut.wav --fps 60 > out/beats.json           # the music alone, trimmed to the film's segment (see below)
python3 ../../styles/tools/cuts.py out/film.mp4 --min-gap 2 --beats out/beats.json --grid 4  # every hard cut, with its distance from the 16th grid
```

Make `out/music-cut.wav` with `ffmpeg -ss <DROP_IN_SONG minus T.drop> -t <DUR> -i assets/music/<song>.mp3 out/music-cut.wav` (`audio/mix.py` holds both numbers); the detector on the mix with the voice on top reads 81 BPM where the music file reads its true 130, and a grid from the whole track has the wrong phase.
On the Stoker export it finds 32 cut events (the photo runs, merged within 2 frames), all 32 within 50 ms of the 16th grid at 130.02 BPM with a median offset of 26.5 ms, drifting from 0 to -48 ms across the film: the film's `SIX` constant and the song's measured tempo disagree by a hair, which no viewer sees but a longer film would.
Only 9 of 32 sit on the beat itself (grid 1), as designed: the runs are 16ths.

Frame strips of every scene change and of the first photo run, read against the panel's reads from the storyboard check.

```bash
node ../../styles/tools/strip.mjs out/film.mp4 --from <t> --dur 0.5 --cols 10   # every frame of a hand-off at 60 fps, numbered
```

A hand-off should carry its zoom across the seam (no pop between two frames), the typed line's first read should get its frames before the next control appears, and a 16th-note run should change on every 7th frame and nowhere else.

Determinism check: the same still rendered in two different orders must be identical, or state is leaking between frames (a typed-caret counter, a cached image index), which breaks the parallel workers and every re-render.

```bash
cd film && node render.mjs stills 4 12 && cp out/stills/t4*.png /tmp/a.png && node render.mjs stills 12 4 && cmp /tmp/a.png out/stills/t4*.png && echo identical
```

Pick times on either side of a scene hand-off and inside a 16th-note run, where a cached index would show.

Text check: the typed captions, the chip names, the slider labels, the prompt bar text and the closing line.
At the last frame of every caption (fully typed) and at the first and last frame of every scene, confirm that no string comes within 3 px of the frame edge, that no two strings overlap (the caption pill over the burst in scene 7, the chip over the result card in scene 3), and that the gradient word's glow does not run under the next line.
This is still a manual check here; the measured version lives in `pencil-storybook/template/textcheck.mjs`, and a port is nearly verbatim from the animate skill's browser version: `film/render.mjs` already drives the page in Playwright, so hook `CanvasRenderingContext2D.prototype.fillText` there and sample the frames.

Copy the finished export to the workspace root under the video's name.

## Gotchas

- **Library voice refused.**
  Symptom: ElevenLabs answers 402 `paid_plan_required`.
  Cause: free accounts cannot use Voice Library voices (Samara X) through the API.
  Fix: use a premade voice (Lily was chosen for Stoker) or upgrade; tell the user before substituting.
- **Stress lands on the wrong word.**
  Symptom: in "The more they trade, the MORE you earn", every take stressed the first "more".
  Cause: the phrase opens on a full breath; rewording ("trade... the MORE") made it worse.
  Fix: measure with `voice/measure.py`; if eight regenerations do not beat the take, keep the take and tell the user.
- **Whisper puts words late.**
  Symptom: captions type up to half a second after the word.
  Cause: one Whisper pass over the whole read drifts.
  Fix: `process.py` cuts at every 100 ms pause, transcribes chunks alone and pins each chunk's first word to its measured onset.
- **Whisper mishears.**
  Symptom: "BUN" for burn, "It's" for its.
  Fix: `process.py` takes timings from Whisper and text from the script, and stops if the word counts differ.
- **Listed drop time is wrong.**
  Symptom: the music's hit lands a beat off the verb line.
  Cause: Pixabay listed 75.39 s; the bass lands at 75.72 s, and 75.39 sat in the silent gap before it.
  Fix: `tools/find_drop.py`.
- **Ghost caret and half-and-half images.**
  Symptom: two faint carets, or two photos blended in one frame.
  Cause: the 8 motion-blur subframes straddle a letter appearing or a 16th-note switch.
  Fix: discrete state reads `tq(t)`, the frame's centre time (`engine.js`); motion still uses the subframe time.
  Any new discrete thing (a counter, a switch, a roll) must read `tq(t)` too.
- **Caret jumps ahead of the letter.**
  Fix: the caret glides with the letter's 0.06 s fade (`drawCaption`).
- **Captions overlap at a scene change.**
  Symptom: "A Solana launchpad" and "made for creators" typed in the same place during a crossfade.
  Fix: the outgoing caption clears just before the cut; between two white-page scenes use `out: 'through'` so the old scene finishes fading before the new one arrives, and stagger the new scene's content (`enter` in scene 6).
- **The name types over the burst.**
  Fix: start the collapse 0.4 s before the name is spoken so it types onto a clear page.
- **Muddy square behind the settings panel.**
  Cause: the blurred wash of the picture had hard square edges.
  Fix: a radial `destination-in` mask on the wash canvas.
- **Poster effect looks muddy.**
  Fix: order the picture set so the image showing when the 16th-note roll stops (index `1 + floor((set3 - set2) / sixteenth) % (n - 1)`) is a bright one on a light background; use 4 levels.
- **Unsplash blocks headless browsers** ("Oh noes!" page), so its search API cannot be scripted.
  Fix: Lorem Picsum serves about 1000 Unsplash photos at any size with no key; Openverse `source=stocksnap&license=cc0` gives CC0 photos up to 960 px (enough for cards, too soft for full bleed).
- **StockSnap's CDN refuses Python's default user agent** (HTTP 403).
  Fix: `fetch-assets.py` uses curl with a browser user agent.
- **Pixabay pages hit a Cloudflare challenge headless.**
  Fix: open the page headed with agent-browser to find the CDN URL; the CDN itself downloads with curl.
  Pixabay may mark a track "Content ID Registered": the licence allows use, but YouTube may claim it; tell the user.
- **Mixkit refuses some WAV downloads (403).**
  Fix: use the file's MP3 link instead.
- **pedalboard's Limiter is not a limiter.**
  Symptom: true peaks at +0.1 dBTP and audible squash.
  Cause: it is JUCE's two-stage compressor with make-up gain to 0 dBFS.
  Fix: `audio/master.py` has a numpy look-ahead true-peak limiter (4x oversampled detector, 5 ms look-ahead, 80 ms release).
- **ffmpeg loudnorm linear mode fails** with "Invalid argument" on `offset` when reaching the target would push true peak over the ceiling; limit first (as `master.py` does).
- **Music too loud for the duck.**
  Symptom: phrases need 20 to 46 dB of mid duck, or the soft lines cannot reach +9 dB.
  Fix: lower `config.music.gain_db` until a typical phrase needs about 16 dB (the 85% design point); `mix.py` also ducks the whole bed a little more for a phrase that still falls short.
- **Canvas pixel reads fail on `file://`.**
  Fix: `render.mjs` serves the project over a local HTTP server.
- **ffmpeg prints "Truncating packet of size 6220800 to 65536"** when reading raw frames from the pipe; frames are complete (checked by frame count and stills), so it is harmless.
- **Paths with a space.**
  Never build a filesystem path from `URL.pathname`; use `fileURLToPath(new URL('.', import.meta.url))` in Node and `Path(__file__).resolve()` in Python, and after the first run check `ls /Volumes/Farhan` for folders containing `%20`.
- **A product repo can be on another branch.**
  Another session may have the product's repo checked out on a branch where a file you read earlier no longer exists; read it from history with `git show <commit>:<path>` instead of checking anything out.
- **Blank page before scene 2.**
  Symptom: the frame before the cut to the full-bleed flashes is empty white.
  Cause: the collage drift and the card fades were timed in seconds from the first film, so with a slower read the cards had left long before this film's later cut.
  Fix: time them to the anchor (`T.s2 - 2.5` for the drift, `T.s2 - 0.2` for the fades), never to absolute seconds; every motion in a scene hangs on the anchor that starts or ends it (in `videos/stoker-coming-soon/film/scenes.js` until ported).
- **Hue shift turns the settings picture the wrong colour.**
  Symptom: the fire set went green under a positive shift; the parrot set went pink at 250.
  Cause: a hue rotation moves every colour in the photo, not only the one you meant.
  Fix: pick a set that already sits in the brand's hue (the fire set for an ember brand) and keep `settings.hue` within about 10 degrees of 360 (350 for Stoker); render the settings still at a few hues onto one sheet before choosing.
- **Whisper splits a compound.**
  Symptom: `process.py` stops with "found 50 words, the script has 49" because "launchpad" came back as "launch pad".
  Fix: merge adjacent Whisper words whose letters add up to the script token before pairing (`videos/stoker-coming-soon/voice/process.py` until ported).
- **A slider that is a choice, not a number.**
  Symptom: "Payout 0.7" for a setting whose values are "in coin" or "in SOL".
  Fix: a `stops` list on the slider (`"stops": ["in coin", "in SOL"]`) shows the stop nearest the slider's value instead of a formatted number (in `scenes.js` of the same film until ported).
- **Greys from the old brand.**
  Symptom: with a warm palette the shadows, hairlines and slider tracks still read cool blue-grey.
  Cause: `engine.js` and `scenes.js` carried the first film's cobalt-era greys as literals.
  Fix: every grey comes from the brand (`inkA(alpha)` for shadows and hairlines; `line`, `rail` and `ring` in `config.brand`); grep both files for `rgba(` and `#` literals when porting to a new brand (same film until ported).
- **A regenerated line rarely beats the take.**
  Symptom: four regenerations of the MORE line reached +3.8 dB of stress against the take's +7.4 dB.
  Fix: measure, keep the take, tell the user; budget one round of regenerations, not an afternoon.

## Known weak spots

- The voice reads a little slower than the reference film, so the Stoker film is 23 s instead of 22 s.
- Scene layouts are tuned for one-line captions of about the Stoker lengths; a much longer line needs its caption size in `config.captions` reduced.
- Only one song has been used; `config.mix.sfx_plan` gains were tuned by measurement, not by ear.
- The template does not yet carry what the second film (`videos/stoker-coming-soon/`, 2026-10-08) added: the six gotchas above that say "until ported", a price chart in the result card on the stressed verb, a counting glass pill in scene 5, the domain line under the closing line (`config.product.domain`) and `tools/board.py`.
  Porting them is the last step of that film's ticket; until then copy those parts from the film folder, not from here.
