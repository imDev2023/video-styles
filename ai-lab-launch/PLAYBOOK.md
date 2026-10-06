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

## 6. Render, mix, check

```bash
node render.mjs events            # sound events from the same timeline
node render.mjs full 10           # 10 parallel workers; about 0.7 s per frame each, so a 23 s film takes about 3 min
cd ../audio && python3 mix.py     # prints voice over music for every phrase; all should read +9.0 dB
python3 master.py                 # -14 LUFS, true peak under -1 dBTP
cd .. && ffmpeg -y -i out/silent.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/film.mp4
python3 qa.py out/film.mp4        # contact sheet, single-frame pop scan, voice over music table
```

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

## Known weak spots

- The voice reads a little slower than the reference film, so the Stoker film is 23 s instead of 22 s.
- Scene layouts are tuned for one-line captions of about the Stoker lengths; a much longer line needs its caption size in `config.captions` reduced.
- Only one song has been used; `config.mix.sfx_plan` gains were tuned by measurement, not by ear.
