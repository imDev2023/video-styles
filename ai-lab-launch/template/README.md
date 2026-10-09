# ai-lab-launch template

Copy this folder to `<workspace>/videos/<name>/`, edit `config.json`, and run the steps in `../PLAYBOOK.md`.
As shipped, `config.json` is the Stoker coming-soon film (2026-10-09) and re-renders it exactly (you supply `assets/logo.png` and the voice).

```bash
python3 fetch-assets.py                        # font, song, SFX, image sets into assets/
python3 tools/find_drop.py                     # measure the drop, put it in config.music.drop (then confirm it with cuts.py below)
python3 voice/tts.py takes                     # 4 voice takes (needs ELEVENLABS_API_KEY in the workspace .env)
python3 voice/process.py                       # tighten, level, word timings -> voice/voice.wav, voice/words.json
cd film && node render.mjs stills 1.2 6.3 17.9 # look check: a few stills first
node render.mjs events                         # sound events and the anchors (out/events.json)
node render.mjs stills $(python3 ../tools/board.py times) && cd .. && python3 tools/board.py   # storyboard check: out/storyboard.jpg, out/seams.jpg
cd film && node render.mjs full 10 && cd ../audio && python3 mix.py && python3 master.py
cd .. && ffmpeg -y -i out/silent.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/film.mp4
python3 qa.py out/film.mp4                     # contact sheet, single-frame pops, voice over music
cd film && node textcheck.mjs && cd ..         # every string drawn: cut off, overlapping, under a glow
node ../../styles/tools/deadbeats.mjs out/film.mp4 --exempt 20-22.25
ffmpeg -ss <drop minus T.drop> -t <duration> -i assets/music/song.mp3 out/music-cut.wav
python3 ../../styles/tools/beats.py out/music-cut.wav --fps 60 --bpm 130 > out/beats.json
python3 ../../styles/tools/cuts.py out/film.mp4 --min-gap 2 --beats out/beats.json --grid 4
node ../../styles/tools/strip.mjs out/film.mp4 --from <seam minus 0.25> --dur 0.5 --cols 10 --w 200 --out out/check/strip-<name>.jpg
```

| Path | What it is |
| --- | --- |
| `config.json` | Everything per video: script, voice, song, brand (with its greys), anchors, captions, gradient words, scene content, the optional chart and pill, image sources, mix, storyboard panels, text-check allowances. |
| `film/engine.js` | Glass, aura, typed captions, camera, crossfades, motion blur. Same for every video. |
| `film/scenes.js` | The seven scenes; reads only the config. |
| `film/render.mjs` | Playwright renderer: stills, events, segments, full film; exports the page opener for the text check. |
| `film/textcheck.mjs` | Hooks every text draw in the page and flags strings cut off by the frame, overlapping, or under a gradient word's glow. |
| `voice/` | `tts.py` (ElevenLabs), `process.py` (tighten, level, word table, compound merge), `measure.py` (stress per word). |
| `audio/` | `mix.py` (3-band sidechain, per-phrase solve, SFX by peak), `master.py` (limiter, -14 LUFS). |
| `qa.py` | Contact sheet, single-frame pop scan, voice over music table. |
| `tools/` | `find_drop.py`, `recolor_logo.py`, `search_images.py`, `board.py` (storyboard and seam sheets from `config.storyboard`). |
| `fetch-assets.py` | Downloads everything the public repo cannot hold. |
