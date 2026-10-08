# Style folder format

Every style in this library has the same shape, so a fresh session can rebuild it without having seen the original.
This is a public repository, so read "What may be committed" before adding anything.

## Layout

```
styles/<style-name>/
  README.md        what the style looks like, sounds like, when to use it, and its finished examples
  BRIEF.md         the prompt to start a new video in this style, with inputs and working defaults
  PLAYBOOK.md      the step-by-step process and every gotcha found while making it
  template/        the working code, ready to copy into videos/<name>/ and run
    config.*       everything that changes per video (text, timings, colours, asset lists) in one place
    fetch-assets.* downloads every third-party asset the style needs (music, SFX, images, fonts)
  reference/       contact sheet and a few stills (JPEG, under 400 KB each)
styles/tools/      checks shared by every style, which need only the finished video, ffmpeg and Node
```

## README.md

- One paragraph on the look and one on the sound.
- When to reach for this style and when not to.
- The finished examples: the source folder under `videos/` or `js-kit/`, the export name, length, resolution and fps.
- The stack in one line (for example "pycairo frames piped to ffmpeg, fluidsynth score").

## BRIEF.md

The prompt a user pastes to start a new video in this style.
It names the inputs to ask for, the defaults to use when one is skipped, the shape of the script or story, the direction, the structure, the sound and the build.
Write it so it reflects what actually worked, not what was first asked for: defaults that turned out not to work are replaced with ones that did, and say why in PLAYBOOK.md.

It also names the three check-ins, in order, and says that nothing is animated or scored before the third is approved, because a wrong story or look costs a full build:

1. Story check: a numbered beat table (time, what happens, the bridge into the next beat, the sound's role) to approve, change or redirect.
2. Look check: 2 to 4 full-size frames of the most different beats, approved frame by frame.
3. Storyboard check: every beat as one numbered panel in the approved look, approved by panel number.
   Under each panel, its reads: what the viewer must understand in that beat, in order, each with a start and an end time.
   A read needs time to be found and understood, no two important reads overlap, and the film's last read lands before the end; a beat whose reads do not fit is lengthened or loses a read, never squeezed.
   The reads are the timing sheet the strip check reads against (adopted from the animation guide in JohnHeibel/ClaudeAnimationBase, MIT).

Each one names the exact command that produces its frames in this style.

## PLAYBOOK.md

1. Setup: what to copy where, what to install (point to `TOOLKIT.md` in the workspace for what already exists).
2. The steps in order, each with the exact command.
3. Checks before showing anyone anything (stills, contact sheet, QA scripts).
   Every style includes the dead-beat check (`tools/deadbeats.mjs` on the silent or final render, with any deliberate hold named in `--exempt`) and a text check for strings cut off by the frame edge, overlapping other text, or under the phone UI on a vertical frame.
   Where the text check is measured by code, say which script; where it is still done by eye, list every string the style draws and where it sits, and name the hook point for a port.
   Every style also runs the hard-cut check (`tools/cuts.py`: `--max 0` where the style promises continuous motion, `--max N` where it cuts between N + 1 scenes on purpose, and `--beats` from `tools/beats.py` where it cuts on the music) and reads a frame strip (`tools/strip.mjs`) of every transition and every key motion against the panel's reads: how many frames each read gets, whether two reads overlap, whether anything pops between frames or every part moves at once.
   Check the storyboard and the strips against the common failures: a sign or caption that repeats the story, a hero standing still while nothing happens, everything moving at one brisk speed with no holds, a moment over before the viewer understands it, faces that snap between expressions, every part moving at once or two things mirrored in sync, a hard cut where a transition was promised, and a film that just starts or just stops.
   Report the checks' numbers, not "looks good".
4. Gotchas: every problem found while making the examples, as "symptom, cause, fix".
5. Open questions or known weak spots.

## template/

- Working code, copied from the finished example and cleaned: no absolute paths (build paths from the file's own location with `fileURLToPath(new URL('.', import.meta.url))` in Node or `Path(__file__).resolve()` in Python; never `URL.pathname`, because the workspace path contains a space).
- Per-video content lives in the config file, not scattered through the code. Where splitting engine from content would take a rewrite, leave the scenes in place and mark clearly at the top of each file which parts are per-video.
- A short `template/README.md` with the commands to run it.
- It must run: smoke-test it from a scratch copy (one still or a 1 to 2 second render) before committing.

## What may be committed (public repository)

- Yes: code, Markdown, MIDI written by our own code, the variable font files under the SIL Open Font License, small reference JPEGs.
- No: API keys or `.env` files (code reads keys from the workspace `.env` at run time); music or SFX downloaded from Pixabay, Mixkit or similar (their licences allow use in a video but not redistributing the file); stock photo libraries (fetch them with `fetch-assets`); voice recordings; rendered video; soundfonts; anything over 2 MB.
- The repository's `.gitignore` excludes the usual offenders, but check `git status` before every commit.
