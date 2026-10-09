# Brief: AI lab launch film

Paste everything below the line into a new session, from the video workspace.
It is the brief the Stoker film was made from, updated with what actually worked.

---

<inputs>
Ask me for: my product's name, a one-line pitch, my logo, 3-6 screenshots of my product (or permission to capture them from its site), 40+ images of what it makes (or photos of it), my brand colours and font, which ElevenLabs voice to use, and a royalty-free song with a clear drop (the file or page, and roughly where the drop is).
If I skip any, use the defaults: brand colours and font read from my product's code if it is in this workspace, the ElevenLabs premade voice Lily (pFZP5JQG7iQjIQuC4Bku) on eleven_v4, CC0 photos from StockSnap via Openverse and Unsplash photos via Lorem Picsum, and Pixabay "Cascade Breathe" (130 BPM, drop measured at 75.72 s).
My ElevenLabs key is ELEVENLABS_API_KEY in the workspace .env; a free account can only use premade voices.
</inputs>

<script>
Write a 9-line voiceover in this shape and map every line to my product:
"This is [name]. A [category]... made for [value]. [Verb] in ANY [range]. Show it a [input] - and it just... gets you. The more you use it, the BETTER it gets. Tune its [setting]. Its [setting]. Its [setting]. Every [output] - exactly how you see it. [Name]. [Out now / Live on X]."
Light emotion tags only: [softly] on the quiet lines, [excited] on the [Verb] line.
The opener gets no tag and a plain full stop.
Check the closing claim is true: say "Live on X" or "Coming soon" if the product has not launched.
</script>

<voice>
Call the ElevenLabs API directly with my key, no MCP.
Generate 4 takes of the whole script in one read and let me pick, with a measured table of how hard each take stresses the key words.
If one line is off, regenerate only that line 4 times (with its neighbours as context) and splice the best one into my take; keep the original line if no regeneration beats it.
Cut every pause over 0.28 s down to 0.2 s, then level each phrase 85% of the way to the median level, changing gain only inside the pauses.
For word timings, cut the read at every pause of 100 ms or more, transcribe each chunk on its own with Whisper and pin each chunk's first word to its measured onset.
Take the words' text from the script, not from Whisper.
</voice>

<direction>
A square launch film, 1440x1440 at 60fps, about 22 seconds, in the style of an AI lab's launch: a white page, one typeface, black ink, real images, and every caption typed word by word at the exact moment it's spoken.
Every control (the prompt bar, the settings panel, the caption pill) is liquid glass: the scene behind it frosted, its edge bending that scene like thick glass, a top sheen, a bright rim and a soft lift shadow.
Put a slow pastel aura in my brand colours, or a blurred wash of the photo, behind it.
The one word she stresses types in a gradient of my brand colours with a faint glow behind it.
Motion rules: the camera always drifts (a 1.0 to 1.04 push per scene, and when one scene hands its content to the next, the next starts at the zoom the last one ended on), nothing pops in (fades of at least 0.3s, eased), images switch on 16th notes with a click each, scene changes land on phrase starts, and the music's drop lands on the [Verb] line.
No full stops on screen; a spoken dash becomes a comma.
Banned: selection-box highlights, beat-snapped slams, white flashes, 3D, templates, other companies' logos or characters in the images.
</direction>

<structure>
Seven scenes, each hung on the voice:
1. "This is [name]": a collage of my images drifts out as the name types in big, then the category line replaces it.
2. "made for [value]": full-bleed flashes of my best images on 16th notes into the drop, with the line typed over them in white.
3.
The drop: a glass prompt bar types my product's real input, then the result card switches on every 16th, with a black chip that rolls to each new name and a strip of thumbnails.
4. "Show it a [input]": 8 tiles fly into a 3x3 grid around the result card, then open into a ring as "it just gets you" types.
5. "The more you use it, the better it gets": two typed lines, the stressed word in the gradient.
6.
The settings: a glass panel of 3 sliders, each moving as she names it.
The picture shifts hue a little (pick a set already near the brand colour; a large shift recolours the whole photo), rolls new images on 16ths, then turns poster, and a blurred wash of its own colours shifts with it behind the glass.
7. "Every [output], exactly how you see it": 120 of my images burst from the centre behind a glass caption pill, then collapse into my logo before the name types, with the closing line underneath.
Hold 2s.
Swap the prompt bar, the results, the tiles and the sliders for my product's real input, outputs and settings.
</structure>

<sound>
Start the song so its measured drop lands on the [Verb] line, and anchor the beat grid there.
Measure the drop yourself; listed drop times are often off by a third of a second.
Duck the music under the voice with a 3-band sidechain (lows 30%, mids 85%, air 55%; 0.3s hold, 50ms look-ahead, 0.5s release), then move each phrase's mids until the voice sits 9 dB over the music between 300 Hz and 4 kHz.
One downloaded Mixkit SFX per event, placed by its measured peak: a click on every image switch, a key on every typed letter, a soft landing on the stressed word, whooshes, and impacts on the drop and the logo, trimmed around their peak.
Fade the music on a dB curve under the end card.
Master to -14 LUFS with true peaks under -1 dBTP using a transparent look-ahead limiter.
</sound>

<check-ins>
Three check-ins, in this order, and nothing is animated or mixed before the third is approved: a wrong script or look costs a full build and a voice run.
1. Story check (text only, before any code): a numbered beat table with one row per scene: the spoken line, the time it starts, what the picture does, the bridge into the next scene (what hands its content on, and at what zoom), and the sound's role (where the drop lands, where the clicks and whooshes are, where the music fades).
   Wait for "approve", "change beats" or "different angle", then generate the voice takes from the approved script.
2. Look check (2 to 4 frames): the most different scenes as full-size stills (`node render.mjs stills <t> <t> <t>` in film/): the name typing over the collage, the glass prompt bar on the drop, the settings panel, the logo collapse.
   Wait for a thumbs up per frame or "change the look".
3. Storyboard check (every scene): the 8 to 10 stills from PLAYBOOK.md section 5, one per scene plus the moments either side of a scene change, numbered in order on one sheet, with a second sheet of the frame either side of every seam; open both sheets for me.
   Under each panel, list its reads: what the viewer must understand in that scene, in order, each with a start and an end time (the typed line, then the control, then the result), so no read is shorter than it needs and no two important reads overlap.
   Wait for thumbs up or down by panel number, redraw what is down, and show the set again until every panel is up.
</check-ins>

<build>
Use the ai-lab-launch template from the video-styles library: copy it to videos/<name>/, fill config.json, run fetch-assets.py, and follow its PLAYBOOK.md.
After the full render and before you show me anything: a contact sheet, a frame-diff scan for single-frame pops (only the 16th-note runs may jump), the voice-over-music ratio for every phrase, the dead-beat check and the text check from PLAYBOOK.md section 6, with their numbers.
</build>

<start>
Ask me for the inputs, write the script and show me the beat table, send me 4 voice takes to pick, then the look frames and the storyboard before the full render.
</start>
