# Brief: a new cairo-night-sky video

Paste everything below the line to start a new video in this style.
Replace the parts in angle brackets, or leave them and the defaults apply.

---

Make a new short in the **cairo-night-sky** style from the video-styles library (`styles/cairo-night-sky/`).
Read its `README.md`, `PLAYBOOK.md` and the workspace `TOOLKIT.md` first, look at `reference/`, then copy `template/` to `videos/<name>/` and work only there.

## Inputs

Ask me for these in one message, and use the default for anything I skip:

1. **The story**: <a "How the X Got Its Y" origin tale, or any chain reaction where one small thing sets off something magical>.
   Default: invent one in that shape and pitch two options in one line each before building.
2. **Title**: default "How the <X> Got Its <Y>", two lines.
3. **The payoff**: what the machine or the chain produces, which must be visible in the final wide shot.
   Default: several of the title's objects launched one by one into the sky, joined into a shape, plus one bigger reveal (the original used nine stars, a constellation and a moon).
4. **Length**: default 48 s; keep it between 30 and 60 s.
5. **Format**: default 1080x1080 at 30 fps.
   Vertical 1080x1920 is possible but needs new camera keys and a taller sky band, so say so before starting.
6. **Characters**: default one sleeping creature that wakes up with a one-word speech bubble, and one helper who works the final machine.
7. **Palette**: default the template palette (cream paper, brown pencil, nursery crayon colours); for a different mood change only the crayon colours, keep the paper and ink.
8. **End card**: default "The End."

## Story shape

Proportions from the 48 s original; scale the times to the chosen length.

| Time | Share | Beat |
| --- | --- | --- |
| 0 to 3.4 s | 7% | Title wipes in above the opening scene; something ends the day (the sun sets behind a hill). |
| 3.4 s | | The hero (a small glowing object) pops in with a sound. |
| 3.9 to 24.9 s | 44% | The chain reaction: 5 or 6 stations, 2 to 4 s each, alternating rolls, bounces, a slide and a turn of a wheel; one station has a comic beat (a sleeper wakes, a bubble says one word). |
| 24.9 s | 52% | The hero drops into the final machine; it shakes, gears turn, a dial swings, smoke puffs. |
| 26 to 31 s | | The payoff objects launch one at a time (0.55 s apart, 1.9 s flight each). |
| 28.5 to 34 s | | The camera pulls back to the whole world; night falls as blue crayon hatching across the top of the screen. |
| 33 to 38 s | | The payoff resolves: lines join the objects, the big reveal pops in. |
| 40 to 46 s | | "The End." fades up and out over the held wide shot; the audio fades over the last 2.5 s. |

## Direction

- One continuous camera, no cuts.
  Close zoom (about 1.1 to 1.4) on the hero during the chain, about 0.33 for the final wide shot.
  Put camera keys 0.3 to 0.5 s ahead of the action, because the camera is smoothed.
- Everything starts as pencil line art and is coloured in with crayon hatching exactly when the hero reaches it, so colour shows the path the story has taken.
- Outlines boil at 8 poses per second; nothing is ever perfectly still.
- Characters are simple: dot eyes or sleepy arcs, a small smile, pink cheeks; squash on impact.
- Lay the world out on two levels (an upper ground line and a lower one) along a path that fits inside one square frame at the end, with empty sky above for the payoff.
- Text only where it belongs in the drawing: the title, a sign on the machine, one speech bubble, the end card.
  No captions, no narration.

## Sound

- A lullaby in C major at 96 bpm: string pad, celesta melody, soft sampled piano arpeggios, pizzicato bass, a music box for the first two bars, and flute doubling the tune for the final third.
- One cue per on-screen event, on the exact frame and not humanised: harp glissando for the hero's arrival, wood block plus celesta for bounces, a woodwind for the sleeper waking, a rising harp run for a slide, music-box ticks for a ratchet, tremolo strings and a quickening soft heartbeat while the machine works, a harp pluck per launch and a celesta ping per landing, a triangle for the finale.
- Keep every cue in C major pentatonic so it always sits in the key.
- Master to about -15 LUFS with the peak near -4 dBFS.

## Check-ins

Three check-ins, in this order, and nothing is animated or scored before the third is approved: a wrong story or look costs a full build.

1. Story check (text only, before any code).
   Show me a numbered beat table with one row per station, launch and reveal: the time, what happens, the bridge into the next beat (the physical hand-off), and the sound's role (where the quiet is, where the loudest hit lands).
   Wait for "approve", "change beats" or "different angle", and revise until approved; then write the times into `config.py`.
2. Look check (2 to 4 frames).
   Draw the two to four most different beats as full-size stills (`python3 render.py test <t> <t> <t>`): the title over the opening scene, a station mid-action, the machine at work, the final wide shot under the night sky.
   Wait for a thumbs up per frame, "change the look" or "try another style".
3. Storyboard check (every beat).
   Draw every beat in the approved look, render one still per beat (`python3 render.py test` with every beat time) and show them in order, numbered.
   Under each panel, list its reads: what the viewer must understand in that beat, in order, each with a start and an end time (the spark arrives, the station fires, the object colours in, the spark leaves), so no read is shorter than it needs and no two important reads overlap.
   Wait for thumbs up or down by panel number, redraw what is down, and show the set again until every panel is up.
   The panels are the film's own scene code, so nothing is drawn twice.

## Build

1. Put the words, timeline, camera keys and score data in `config.py`; rewrite the geometry, the hero's path and the scenes in `world.py`; adjust the cues in `music.py` `compose()`.
2. Show me the contact sheet (`render.py sheet`) before any full render.
3. Then `music.py`, `render.py full`, run the checks in `PLAYBOOK.md` section 3 (including the dead-beat check on `out/silent.mp4` and the text check) and report their numbers, then `render.py mux`, copy the export to the workspace root and tell me its path.
