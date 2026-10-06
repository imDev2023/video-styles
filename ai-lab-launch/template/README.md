# ai-lab-launch template

Copy this folder to `<workspace>/videos/<name>/`, edit `config.json`, and run the steps in `../PLAYBOOK.md`.
As shipped, `config.json` is the Stoker launch film and re-renders it exactly (you supply `assets/logo.png` and the voice).

```bash
python3 fetch-assets.py                        # font, song, SFX, image sets into assets/
python3 tools/find_drop.py                     # measure the drop, put it in config.music.drop
python3 voice/tts.py takes                     # 4 voice takes (needs ELEVENLABS_API_KEY in the workspace .env)
python3 voice/process.py                       # tighten, level, word timings -> voice/voice.wav, voice/words.json
cd film && node render.mjs stills 1.2 6.3 17.9 # check stills first
node render.mjs events && node render.mjs full 10
cd ../audio && python3 mix.py && python3 master.py
cd .. && ffmpeg -y -i out/silent.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/film.mp4
python3 qa.py out/film.mp4
```

| Path | What it is |
| --- | --- |
| `config.json` | Everything per video: script, voice, song, brand, anchors, captions, scene content, image sources, mix. |
| `film/engine.js` | Glass, aura, typed captions, camera, crossfades, motion blur. Same for every video. |
| `film/scenes.js` | The seven scenes; reads only the config. |
| `film/render.mjs` | Playwright renderer: stills, events, segments, full film. |
| `voice/` | `tts.py` (ElevenLabs), `process.py` (tighten, level, word table), `measure.py` (stress per word). |
| `audio/` | `mix.py` (3-band sidechain, per-phrase solve, SFX by peak), `master.py` (limiter, -14 LUFS). |
| `qa.py` | Contact sheet, single-frame pop scan, voice over music table. |
| `tools/` | `find_drop.py`, `recolor_logo.py`, `search_images.py`. |
| `fetch-assets.py` | Downloads everything the public repo cannot hold. |
