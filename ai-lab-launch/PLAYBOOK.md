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
   Fill `config.brand.line`, `rail` and `ring` (the hairline, the slider rail and the knob ring) in the brand's own greys; shadows and tints take the ink at an alpha (`inkA`), so nothing on the page carries another brand's grey.
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
   To splice: `python3 voice/splice.py <take> <n> voice/lines/line<n>_<k>.mp3 voice/takes/<take>-line<n>.wav` finds the old line between its unchanged neighbours (Whisper's words aligned to the script), swaps its speech for the new take's, keeps the pauses either side, and joins each side with a 10 ms crossfade inside a pause; then point `config.voice.take` at the result.
   The same path changes a line's words after the voice is approved: put the new words in `config.voice.lines` first (they are the context and the script `process.py` checks against).
5. Set `config.voice.take`, then `python3 voice/process.py` tightens pauses (over 0.28 s down to 0.2 s), levels phrases (85% toward the median, gain moved only inside pauses), and writes `voice/voice.wav` and `voice/words.json`.
6. Set `config.anchors`: each scene boundary is a word index in `words.json` plus the word expected there, so a new take with different words fails loudly instead of cutting in the wrong place.
   Set `config.captions` to the word ranges each caption types, `config.display.comma_after` for spoken dashes, and `config.display.gradient_words`: the stressed words as the script spells them (`["ANY", "MORE"]`), so the capitals that tell the voice where to lean are the letters that take the gradient, and the first "more" does not; each gets a soft landing in the sound events.

## 4. Map the product

Everything per product lives in `config.scenes`:

- `prompt.text`: what the glass prompt bar types (Stoker: `$HEARTH`, a made-up coin).
  A made-up name must not be a real coin or a rival's: the first cut typed `$EMBER`, which is the token of EmberCurve, a rival launchpad, and the owner had it taken out of every film.
- `result`: the card's image set, the fixed part of its label (`base`), the chip prefix, and which tile the spoken input word picks (`pick_tile`).
  The coming-soon film's card reads `STOKER`, the platform's own coin, and lands on `SPY` (the owner's review of version 3, 2026-11-06), while its bar still types `$HEARTH`.
  The picked tile need not be one of the eight in the grid: `SPY` is tile 8, so it shows only in the roll and on the card.
- `tiles`: [title, subtitle, tag] for the grid and ring, and the label sequence on the card (Stoker: Quote Assets).
  Draw them as typographic tiles in the brand's style; do not use other companies' logos.
- `settings.sliders`: three sliders, each tied to the anchor word that names it, with its range and value format; a slider that is a choice rather than a number lists its `stops` (`["in coin", "in SOL"]`) and shows the stop its position has reached.
- `chart` (optional): `{"anchor": "trades", "bars": 9}` climbs a small price chart inside the result card once that word is spoken; leave it out for no chart.
- `pill` (optional): `{"anchor": "earn", "text": "You earn {value}% of every trade", "from": 0, "to": 0.5, "decimals": 2, "duration": 0.6}` counts a number up in a glass pill under the scene 5 lines; leave it out for no pill.
- `product.domain`: the address that fades in under the closing line on the end card; empty for none.
- `brand.logo_light` (optional, for a logo with a ring in it): a white-hot light that circles the ring once the logo lands (`ringLight()` in `film/scenes.js`).
  On the logo's impact the ring flares, the light whips round once and then circles clockwise with a short warm trail to the end; it is added onto the ring with the 'lighter' blend and clipped to the logo's tile, so the page never changes.
  It takes the ring in the logo's own units (`viewbox`, `ring` as centre x, centre y, radius and stroke width, `tile_radius`) and its timing (`start` s after `T.logo`, `from` degrees, `whip` extra laps settling over `settle` s, then a lap every `period` s); the Stoker ring circles every 2.4 s.
  Leave it out for a still logo.
- `storyboard`: the panels (time, title, reads) and the seam anchors that `tools/board.py` lays out for the storyboard check.
- `check.text_ignore`: stretches where strings may cross the frame edge on purpose, as `[anchor, from, to, why]` (the tiles flying in).

## 5. Stills before anything else

```bash
cd film && node render.mjs stills 1.2 4.2 6.3 9.8 12.3 14.2 17.9 21.5
```

Pick times that show each scene (shift them to the new film's anchors), look at every still at full size, and also render the moments either side of every scene change (anchor minus 0.1 s and plus 0.1 s).
Crop the glass and the carets at 2x and look closely: a double caret or a frosted rectangle with hard edges is visible only there.
Show the user 8 stills on one sheet and wait for a go.

For the storyboard check, `tools/board.py` pastes the stills into `out/storyboard.jpg`, numbered with each panel's reads, and `out/seams.jpg`, the frame 0.1 s either side of every scene change.

```bash
cd film && node render.mjs events                              # the anchors the seams sit on (out/events.json)
node render.mjs stills $(python3 ../tools/board.py times)      # one still per panel, and 0.1 s either side of every seam
cd .. && python3 tools/board.py                                # -> out/storyboard.jpg, out/seams.jpg
```

The panels and the seam anchors live in `config.storyboard`; edit the reads there when the anchors move.
Open both sheets for the operator with `open out/storyboard.jpg out/seams.jpg` in the same turn as the message.

## 6. Render, mix, check

```bash
node render.mjs events            # sound events from the same timeline
node render.mjs full 10           # 10 parallel workers; about 0.7 s per frame each, so a 23 s film takes about 3 min
cd ../audio && python3 mix.py     # prints voice over music for every phrase; all should read +9.0 dB
python3 master.py                 # -14 LUFS, true peak under -1 dBTP
cd .. && ffmpeg -y -i out/silent.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/film.mp4
python3 qa.py out/film.mp4        # contact sheet, single-frame pop scan, voice over music table
node ../../styles/tools/deadbeats.mjs out/film.mp4 --exempt 20-22.25   # dead-beat check; the end-card hold is the one deliberate exemption
```

On the coming-soon export `qa.py` reads 1335 frames, 0 single-frame pops outside the 16th-note runs, 32 jumps inside them, and +9.0 dB of voice over music on every phrase but the last ("Coming soon" sits at +20.6 dB because the music is already fading under the end card).
The dead-beat check is the shared tool from the library root: something new should happen on screen every 2 to 4 seconds, and it flags any stretch over 3 s where the picture barely changes (each frame against the frame half a second earlier, on a 96 px grayscale copy, "still" at a quarter of the film's own median change).
On the first Stoker export it flags 19.5 to 23.0 s, the logo and the closing line held 2 s by design and then the fade; on the coming-soon export (median change 19.2, still below 4.8) it passes with 0 stretches once 20 to 22.25 s is exempt.
Exempt only the held end card, and let the check see everything before it; this style's constant camera drift should keep every other scene alive.

Cut check against the music: this style cuts its photos on 16th notes, so every hard cut should sit on the song's grid.

```bash
python3 ../../styles/tools/beats.py out/music-cut.wav --fps 60 --bpm 130 > out/beats.json   # the music alone, trimmed to the film's segment (see below), with the tempo you know
python3 ../../styles/tools/cuts.py out/film.mp4 --min-gap 2 --beats out/beats.json --grid 4  # every hard cut, with its distance from the 16th grid
```

Make `out/music-cut.wav` with `ffmpeg -ss <DROP_IN_SONG minus T.drop> -t <DUR> -i assets/music/<song>.mp3 out/music-cut.wav` (`audio/mix.py` holds both numbers); the detector on the mix with the voice on top reads 81 BPM where the music file reads its true 130, and a grid from the whole track has the wrong phase.
Pass `--bpm` with `config.music.bpm`: on a 22 s excerpt the open search locked onto 97.5 BPM (a 3:4 comb) when the trim moved by 35 ms.
On the first Stoker export it finds 32 cut events (the photo runs, merged within 2 frames), all 32 within 50 ms of the 16th grid at 130.02 BPM with a median offset of 26.5 ms, drifting from 0 to -48 ms across the film: the film's `SIX` constant and the song's measured tempo disagree by a hair, which no viewer sees but a longer film would.
On the coming-soon export (drop at 75.72 s, grid from `beats.py --bpm 130`) it finds 30 cut events, 30 of 30 within 50 ms of the grid at 130.04 BPM with a median offset of 19.0 ms; with the drop at 75.755 s the same cuts sat at a median of 34.9 ms and 3 of 30 fell outside 50 ms.
Only a quarter of the cuts sit on the beat itself (grid 1), as designed: the runs are 16ths.

Frame strips of every scene change and of the first photo run, read against the panel's reads from the storyboard check.

```bash
node ../../styles/tools/strip.mjs out/film.mp4 --from <t> --dur 0.5 --cols 10   # every frame of a hand-off at 60 fps, numbered
```

A hand-off should carry its zoom across the seam (no pop between two frames), the typed line's first read should get its frames before the next control appears, and a 16th-note run should change on every 7th frame and nowhere else.
On the coming-soon export (strips at every seam, the input hand-off, the first photo run and the ring opening): every run changes on frames 7 apart (a 16th is 6.92 frames at 130 BPM and 60 fps), each outgoing line is gone before the next types in its place, and the only near-empty page is the 4 frames of the `through` fade before "The more they trade".

Determinism check: the same still rendered in two different orders must be identical, or state is leaking between frames (a typed-caret counter, a cached image index), which breaks the parallel workers and every re-render.

```bash
cd film && node render.mjs stills 4 12 && cp out/stills/t4*.png /tmp/a.png && node render.mjs stills 12 4 && cmp /tmp/a.png out/stills/t4*.png && echo identical
```

Pick times on either side of a scene hand-off and inside a 16th-note run, where a cached index would show (the coming-soon film: 6.35, 9.05 and 14.65 s, identical in both orders).

Text check, measured:

```bash
cd film && node textcheck.mjs              # every 6th frame, the frame after each caption is typed, the frames either side of every anchor; about 25 s
node textcheck.mjs --every 1               # every frame, for the final pass
```

It hooks every `fillText` in the film page (installed through `open()` in `render.mjs` before `scenes.js` loads), traces each string to screen space, joins the letters typed under one caption into one string (`drawCaption` tags the context with `ctx.__textGroup`), and fails on a string within 3 px of the frame edge, two strings overlapping by more than a quarter of the smaller, or a gradient word's glow (its shadow blur) running under other text.
Stretches where strings may cross the edge on purpose go in `config.check.text_ignore` as `[anchor, from, to, why]`; on the coming-soon film the eight Quote Asset tiles fly in from outside the frame for 0.95 s after `s4`, 20 allowed issues.
It found three real faults on this film that no sheet showed (see the gotchas on lines sharing the page and tiles crossing); after the fixes it samples 260 frames and passes with 0 cut off, 0 overlapping and 0 under a glow.

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
  Fix: time them to the anchor (`T.s2 - 2.5` for the drift, `T.s2 - 0.2` for the fades), never to absolute seconds; every motion in a scene hangs on the anchor that starts or ends it.
- **Hue shift turns the settings picture the wrong colour.**
  Symptom: the fire set went green under a positive shift; the parrot set went pink at 250.
  Cause: a hue rotation moves every colour in the photo, not only the one you meant.
  Fix: pick a set that already sits in the brand's hue (the fire set for an ember brand) and keep `settings.hue` within about 10 degrees of 360 (350 for Stoker); render the settings still at a few hues onto one sheet before choosing.
- **Whisper splits a compound.**
  Symptom: `process.py` stops with "found 50 words, the script has 49" because "launchpad" came back as "launch pad".
  Fix: merge adjacent Whisper words whose letters add up to the script token before pairing (`voice/process.py`).
- **A slider that is a choice, not a number.**
  Symptom: "Payout 0.7" for a setting whose values are "in coin" or "in SOL".
  Fix: a `stops` list on the slider (`"stops": ["in coin", "in SOL"]`) shows the stop nearest the slider's value instead of a formatted number.
- **Greys from the old brand.**
  Symptom: with a warm palette the shadows, hairlines and slider tracks still read cool blue-grey.
  Cause: `engine.js` and `scenes.js` carried the first film's cobalt-era greys as literals.
  Fix: every grey comes from the brand (`inkA(alpha)` for shadows and hairlines; `line`, `rail` and `ring` in `config.brand`); grep both files for `rgba(` and `#` literals when porting to a new brand.
- **A regenerated line rarely beats the take.**
  Symptom: four regenerations of the MORE line reached +3.8 dB of stress against the take's +7.4 dB.
  Fix: measure, keep the take, tell the user; budget one round of regenerations, not an afternoon.
- **The read promises a gradient the frame does not show.**
  Symptom: the approved story said "ANY" types in the gradient, the storyboard read said so, the frame showed plain ink: the engine took one gradient word per film and the config named "more".
  Fix: `config.display.gradient_words` lists every stressed word as the script spells it; read the storyboard's reads against the frames, not only the frames.
- **Hue shift goes the long way round.**
  Symptom: with `settings.hue` at 350 the fire behind the panel turned green, then purple, for 0.9 s before settling, visible only on the contact sheet at 13.5 s.
  Cause: the shift animated from 0 to 350 degrees, a tour of the whole wheel, where 10 degrees the other way was meant.
  Fix: `picState` turns the short way (350 becomes -10); keep the config value as the brand's hue, not a direction.
- **Two lines share the page at a hand-off.**
  Symptom: "and it just trades" typed over "Pair it with a stock" for 3 frames while the old line was still fading.
  Cause: the old line faded out from the new line's anchor instead of before it.
  Fix: the outgoing line fades from `CAP.next.tFirst - 0.36` over 0.32 s, so it is gone before the first letter (the scene 1 pattern); the text check measures it.
- **Tiles cross each other as the grid opens into a ring.**
  Symptom: the mid-left tile crossed to the bottom-right through the card, and two tiles passed through each other.
  Cause: ring slots were handed out in reading order while the grid cells sit at compass angles.
  Fix: each tile takes the ring slot nearest its own cell (its grid angle plus 22.5 degrees), so no two paths cross; the ring looks the same.
- **A tile wipes across the caption as it flies in.**
  Symptom: the top-centre tile, entering from above, covered "Pair it with a stock" for 4 frames.
  Fix: draw the tiles before the captions and the prompt bar, so they fly in under the text; the fly-in's edge crossings are allowed in `config.check.text_ignore`.
- **The drop's attack and the beat grid disagree by 35 ms.**
  Symptom: `tools/find_drop.py` put the attack at 75.755 s; the comb grid from `beats.py` over the film's segment, and the first film's value, say 75.72 s, and the cuts sat a steady 35 to 38 ms after the detected beats.
  Fix: confirm the drop with `beats.py --bpm` and `cuts.py` on the trimmed music and use the value that centres the cuts on the grid; both are within a frame of the kicks, so neither is audible, but the measured one is the one to keep.
- **The beat detector locks onto a related tempo.**
  Symptom: `beats.py` read 97.5 BPM on the 22 s excerpt after the trim moved by 35 ms, 130 before.
  Fix: pass `--bpm 130` (`config.music.bpm`); the search then stays within 4 BPM of it.
- **A changed caption is a changed voice line.**
  Symptom: the review asked for "Every payment, on the blockchain" in place of "on the public ledger"; typing the new words over the old read would show one thing while she says another.
  Cause: every caption is a range of the read's own words (`config.captions`), typed at the moments she says them.
  Fix: re-record only that line and splice it into the approved take (section 3, step 4), pick the take nearest the old line's pace and median pitch (the Stoker splice: 2.25 s against 2.18 s, 202 Hz against 204 Hz), run `process.py`, then move every later anchor and caption by the change in word count (one fewer word moved `logo`, `tagline`, `last` and three captions up by one).
- **The typing caret draws a "$" through every S.**
  Symptom: for one frame in each typed S (the S of "Stoker" in "This is Stoker" and on the end card, the S of "Solana"), the caret stood in the letter's middle and the pair read as "$"; frame strips show it, a contact sheet never does.
  Cause: `drawCaption` glided the caret across each letter while the letter faded in, so the caret crossed every glyph halfway through its fade.
  Fix: the caret steps past a letter as it starts, as an editor's does, and the letter fades in behind it (`engine.js`, 2026-11-06); read a strip of the end card's first typed letters after any change to the caret.
- **A longer coin name runs off the card.**
  Symptom: with the coin renamed from EMBER to HEARTH, the card's label "HEARTH/GOOGLx" ran 25 px past the card's right edge during the roll, and the card's clip cut its last letter; the text check passed, because it only measures against the frame's edges.
  Cause: the label was set at a fixed 0.085 of the card, whatever its length.
  Fix: `buildLabel()` in `film/scenes.js` sets one size for the whole roll, the largest at which the widest quote fits with equal margins (0.07 of the card each side), at most 0.085; check a new name or quote list with a still on the roll's widest label.
- **An SVG logo cannot load.**
  Cause: `film/render.mjs` serves files with a type from its `TYPES` table, which had no `.svg`, and an image sent as `application/octet-stream` does not decode; the Stoker teasers' engine (`js-kit/stoker-teasers/`) stalled on the same thing.
  Fix: `image/svg+xml` is in the table now (2026-11-06, for the Stoker ring); add any new file type there before the page loads it.
  An SVG is the better logo: the browser draws it at the size the end card asks for, so it stays sharp through the scale-in.
- **The ring's ignition washes out its colours.**
  Symptom: in the first try at the Stoker ring's light, the whole ring turned pale yellow for half a second after the logo's impact, and the ember-to-amber ramp that makes the mark was gone.
  Cause: the ignition flare added a near-white stroke over the whole ring at 0.45 to 0.55 alpha with the 'lighter' blend, which pushes orange to white.
  Fix: flare in the ring's own warm tones at 0.2 to 0.3 alpha, decaying over 0.3 s, and keep the white for the moving light's head; read the ring at 2x in the frames 0.05 to 0.5 s after the impact.
- **A changed end card re-encodes frames before the change.**
  Symptom: after the ring's light was added, frames 1116 to 1138 of the coming-soon film differed from the earlier render, though the light starts at frame 1139 and stills of those frames from the old and new code are identical.
  Cause: x264's look-ahead weighs a frame by the frames that follow it, so a change shifts the encoding of up to about 25 frames before it (49 to 61 dB PSNR, invisible).
  Fix: none needed; to prove a change touches nothing before it, compare lossless stills from both versions of the code, not the encoded frames.
  To re-render only a late change, render just the `full` run's segments that hold it (`render.mjs seg <f0> <f1> out/segs/segNN.mp4` with the same boundaries, `ceil(frames / workers)` apart), concatenate `out/segs/list.txt` again, and copy the audio stream from the previous export instead of mixing it again; drop `-shortest` when copying, or the last video frame goes.
- **A short pick makes the chip too narrow for the roll.**
  Symptom: with the card's pick changed from TSLAx to SPY, "paired with GOOGLx" (264.9 px) was wider than the chip sized for "paired with SPY" (257.8 px), so its white letters would have run past the black pill onto the white page; the text check cannot see it, because it measures strings against the frame, not against the shape behind them.
  Cause: the chip took its width from the picked name alone, which was among the widest while TSLAx was the pick.
  Fix: the chip takes the width of the widest name in `scenes.tiles` (`scene34()` in `film/scenes.js`), as the card's label already does; for the Stoker list it grew 32 px, and every name keeps 28 px or more each side.

## Known weak spots

- The voice reads a little slower than the reference film, so the Stoker film is 23 s instead of 22 s.
- Scene layouts are tuned for one-line captions of about the Stoker lengths; a much longer line needs its caption size in `config.captions` reduced.
- Only one song has been used; `config.mix.sfx_plan` gains were tuned by measurement, not by ear.
- The reference stills are from the first film; the coming-soon film's contact sheet joins them once its export is approved.
- The cut check's grid comes from a comb snapped to onsets within 40 ms, so its offsets scatter by about 20 ms around the true alignment; read the median, not one cut.
