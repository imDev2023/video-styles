# Brief: narrated storybook

Paste the block below to start a new video in this style, then fill in or delete the bracketed lines.

```text
Make a new narrated storybook video in the "narrated-storybook" style from the video-styles library
(styles/narrated-storybook in the AI video workspace).
Read the style's README.md, BRIEF.md and PLAYBOOK.md first, then copy template/ to videos/<name>/.

Story: [one or two sentences: who the hero is, where they go, what they learn]
Hero: [species, name, look; default: the template's amber tabby cat with a coral neckerchief, renamed]
Setting: [default: the template's jungle, from dawn to night]
Message, said in the last line: [default: a small act of courage turns a strange place into home]
Length: [default: follow the narration, about 45 to 50 seconds for six scenes]
Narrator: [default: Gemini 3.8 Flash TTS, voice Sulafat, warm British female storyteller]
Title and closing line: [default: derived from the story]

Ask me for anything above that is missing before writing code.
Show me the six narration lines and silent stills of every scene for approval before generating any narration,
because the voice is a metered API call.
```

## Inputs to ask for

| Input | Default when skipped |
| --- | --- |
| Story premise and message | Ask; this one has no default. |
| Hero | The template's cat, renamed. Any other animal means new drawing code in `scene-renderer.js`; say so and agree the extra time. |
| Setting | The jungle backdrop, with the mood running day, day, day, rain, night, night. |
| Length | Let the film follow the narration (`timing.targetSeconds: null`). If a fixed length is required, write 85 to 95 words for 47 s. |
| Narrator | Gemini `gemini-3.8-flash-tts`, voice `Sulafat`, with the delivery prompt from `config.json`. |
| Narrator, if Gemini is unavailable | ElevenLabs `eleven_v4` with a premade voice such as Lily (`pFZP5JQG7iQjIQuC4Bku`); the owner's free account cannot use Voice Library voices. |
| Language | English (the verifier uses the English Whisper model). |

## Shape of the story

- Six scenes, one narration line each, 14 to 19 words per line, one or two sentences.
- The arc that worked: arrival and curiosity, a surprise, a brave moment, a hardship and shelter, wonder, rest and the message.
- Every line names one action the picture can show in a single wide shot (walks in, jumps back, leaps, shelters, looks up, curls up).
- The last sentence of the last line states the message plainly and softly.
- Write numbers as words, avoid names Whisper will misspell, and keep ellipses rare: the verifier compares every word.
- About 2.06 words per second is the narrator's natural pace, so 100 words read in about 49 s before any speed-up.

## Direction

- Full-bleed picture-book painting, never panels, split screens or cards.
- One locked-off wide shot per scene with one clear hero action; motion comes from the hero, small creatures, weather, particles and a slow parallax drift.
- Cut straight from scene to scene; the narration starts 0.16 s after each cut (0.65 s in the first scene).
- Keep the hero's warm orange readable against every background; let the palette travel from warm daylight to cool night.
- Opening title over the first scene, fading out at about 75 percent of it; closing line fading in at the start of the last scene; small numbered chapter labels on the scenes between.
- All text is painted after the foreground so leaves and vines never cross it.
- No captions and no word-timed effects.

## Structure

| Scene | Mood | What happens | Text on screen |
| --- | --- | --- | --- |
| 1 | day | The hero walks into the world. | Title, tagline |
| 2 | day | A surprise or a new friend. | 02 / chapter |
| 3 | day | The brave moment. | 03 / chapter |
| 4 | rain | Trouble, then shelter. | 04 / chapter |
| 5 | night | Wonder. | 05 / chapter |
| 6 | night | Rest, home, the message. | Closing line, 06 / chapter |

## Sound

- Narration only, one clip per scene, each normalised to -18 LUFS, with the whole read sped up by at most 1.2x (`timing.maxTempo`) when a fixed length is set.
- The procedural ambience bed from `scripts/generate-ambience.mjs`, with water, rain, thunder and night insects assigned to scenes by id in `config.json`.
- No music by default; if music is wanted, fetch it in `fetch-assets.mjs` and never commit it.

## Build

1. Copy the template, run `node fetch-assets.mjs`, and write the story into `config.json`.
2. Adapt or write the scene painters in the `SCENES` table at the bottom of `scene-renderer.js`.
3. `node scripts/assemble.mjs --silent-preview`, `check`, and stills of every scene with `snapshot --describe false`; show them with the six lines and wait for approval.
4. `node scripts/generate-voice.mjs --dry-run`, then the real run once approved.
5. `node scripts/assemble.mjs` and `node scripts/verify-narration.mjs`; fix any mismatch by regenerating that line with `--only <scene>`.
6. Render at 24 fps, quality delivery, then verify the render's audio, make a contact sheet, check loudness, and only then show it.
