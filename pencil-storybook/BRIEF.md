# Brief: a new pencil-storybook video

Paste the block below into a new session in the workspace folder, then answer the questions it asks.
Everything in it reflects what worked on "How Autumn Got Its Colors".
The reasons behind each default, and the things that did not work, are in `PLAYBOOK.md`.

---

```text
Make a new video in the pencil-storybook style.

SETUP
Before anything else, read styles/pencil-storybook/README.md, PLAYBOOK.md and template/README.md.
Look at every image in styles/pencil-storybook/reference/.
Read TOOLKIT.md in the workspace.
Copy styles/pencil-storybook/template to js-kit/<slug>/ (it must live under js-kit/ so node_modules resolves).
Run `node fetch-assets.mjs`, then `node render.mjs beats` once to prove the copy works before changing anything.

INPUTS
Ask me for these in one message, and use the default for anything I skip.
1. The story in one or two sentences.
   Default: a "How X Got Its Y" origin fable for children aged 3 to 7, such as "How the Rainbow Got Its Stripes".
2. The title text.
   Default: the "How X Got Its Y" sentence, split over two lines.
3. The hero, the small object that travels through the whole film.
   Default: something round and bouncy a child knows (an acorn, a pebble, a berry, a raindrop).
4. Length.
   Default: 60 s.
   Use 12 s for a single-scene vignette with ambient motion only.
5. Frame.
   Default: 1080x1080 at 30 fps.
   1080x1920 is untested: lay the stations out vertically and move the title box and end card in config.mjs.
6. Palette.
   Default: the template palette (leaf green, tomato red, pumpkin orange, sunflower gold, sky blue, bark brown) on the template paper and ink, plus a story set of three colours for the transformation (autumn used gold, orange and red).
7. Mood of the music.
   Default: whimsical and warm, chamber orchestra, 96 bpm, Am F C G.
8. Soundfont.
   Default: ~/soundfonts/MuseScore_General.sf3.
   Arachno and Timbres of Heaven are installed for comparison renders.
9. End card text.
   Default: "The End."

STORY SHAPE
The film is wordless and told only through picture and music.
It is one continuous world with no cuts.
The hero moves through 6 to 10 stations laid out left to right along a ground line, then down a path (a creek, a slide, a road) to a second level.
Each station is a simple contraption with a character that the hero bounces off, rolls down, is launched by, is caught in, or rides.
Every hand-off is a visible physical cause.
The middle of the film is a machine that transforms the world, which is the story's answer to "how X got its Y" (autumn: a water wheel drives a pendulum brush that paints the leaves).
A character reacts to the payoff (autumn: the hedgehog catches the acorn and says "yum!").
The ending is a slow pull-back that reveals the whole path at once while the last colour (a sky, a canopy) is crayoned in, then the end card.

DIRECTION
Draw everything with lib.mjs, always in the order solid underlay, crayon fill, boiling pencil outline.
Props start as uncoloured pencil and colour themselves in (fill amount 0 to 1 over 1 to 1.5 s) just before the hero reaches them, so colour follows the story.
The hero moves on parabolic hops (arcFn), rolls along surfaces (surf), squashes on impact, and leaves a short faint trail of dots while flying.
Keep most of the page as bare paper, with one point of interest at a time.
Frame the ground line in the lower third, so the bottom of the frame is not a wide band of empty paper.
Camera keyframes are [t, x, y, zoom] and are smoothed with a 0.5 s Gaussian.
Use zoom 1.1 to 1.4 for action, 0.7 to 0.85 for travelling and wide machines, and about 0.35 for the final reveal.
Characters are ellipses with dot eyes and arc mouths, and each gets a small reaction on its beat (a blink, wide eyes, a crouch, a hop).
Do not hang anything from a rope on an L-shaped post: in stills it reads as a gallows.
Use an A-frame or a tree branch instead.
Show the title on a hatched paper banner for the first 6 s, fade in from paper over 0.4 s and out to paper over 0.8 s.

STRUCTURE FOR 60 S (scale the times for other lengths)
0 to 4 s: the title over the starting place; the hero wobbles; a character notices.
4 to 17 s: the chain of stations, with a beat every 1 to 2 s.
17 to 29 s: the journey (the creek ride), with the camera following the hero.
29 to 45 s: the transformation machine and the character's reaction.
45 to 56 s: the result spreads (the leaves fall) and the camera starts to pull back.
56 to 60 s: the whole world in one view, the end card, the fade to paper.
Write these beats into config.mjs STORY with a time each.

SOUND
Write the score in score.mjs with one chord per bar.
Open with a music box under the title, then a celesta melody over a guitar and pizzicato bed.
Pass the tune between instruments act by act, bring in strings and horn for the climax, and end with choir and harp.
Put a short cue on every picture event, with its time taken from world.mjs TIMES and never typed by hand.
Use no voice and no downloaded music or sound effects.
Master with the synthetic hall reverb at 0.35 wet, a 0.5 s fade in, a 3 s fade out, -15 LUFS and a -2 dBTP ceiling.

CHECK-INS
Three check-ins, in this order, and nothing is animated or scored before the third is approved: a wrong story or look costs a full build.
1. Story check (text only, before any code).
   Show me a numbered beat table with one row per beat: the time, what happens, the bridge into the next beat (the physical hand-off), and the sound's role (where the quiet is, where the loudest hit lands).
   Wait for "approve", "change beats" or "different angle", and revise until approved; then write the table into config.mjs STORY.
2. Look check (2 to 4 frames).
   Draw the two to four most different beats as full-size stills (`node render.mjs test <t> <t> <t>`): the title over the opening place, a station mid-action, the machine, the final wide shot.
   Wait for a thumbs up per frame, "change the look" or "try another style".
3. Storyboard check (every beat).
   Draw every beat in the approved look and show `node render.mjs board`, one numbered panel per STORY beat with its time and line.
   Wait for thumbs up or down by panel number, redraw what is down, and show the board again until every panel is up.
   The panels are the film's own scene code, so nothing is drawn twice.

BUILD
Follow PLAYBOOK.md step by step.
Write config.mjs and STORY first, then world.mjs (layout, hero path, scenes, camera).
After every change run `node render.mjs beats` or `node render.mjs sheet 3` and look at the stills.
Then write score.mjs, and run `node run.mjs`, `node music.mjs` and `node master.mjs`.
Run every check in PLAYBOOK section 3, including `node textcheck.mjs` and the dead-beat check on out/silent.mp4, and report their numbers, not "looks good".
Show me the contact sheet and two or three stills before the full render.
Copy the final out/<slug>.mp4 to the workspace root.
```
