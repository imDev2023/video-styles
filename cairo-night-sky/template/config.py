"""Everything that changes per video, in one place.

The values below reproduce "How the Night Got Its Stars" (48 s, 1080x1080, 30 fps).
For a new video, change this file first, then the scene code in world.py
(world geometry and the spark's path) and the cue section at the top of music.py.

Times are in seconds from the start of the video.
Picture (world.py) and score (music.py) both read the TIMELINE values,
so a beat moved here moves its sound with it.
"""
import os
from pathlib import Path

# ------------------------------------------------------------------ output
NAME = "night-stars"          # final export is out/<NAME>.mp4
W = H = 1080                  # square canvas
FPS = 30
DUR = 48.0
CRF = 16                      # libx264 quality; 16 keeps thin pencil lines clean
WORKERS = None                # render processes; None = every CPU core

# ------------------------------------------------------------------ palette (RGB 0..1)
PAPER = (0.957, 0.937, 0.886)  # warm cream page
INK = (0.27, 0.21, 0.20)       # soft brown-black pencil
SUN_C = (0.99, 0.74, 0.16)
RED = (0.86, 0.13, 0.16)
GREEN = (0.22, 0.66, 0.27)
BROWN = (0.58, 0.37, 0.22)
BLUE = (0.30, 0.52, 0.86)
YELLOW = (1.0, 0.83, 0.17)
GREY = (0.52, 0.52, 0.58)
COPPER = (0.82, 0.50, 0.26)
CREAM = (0.97, 0.90, 0.72)
PURPLE = (0.55, 0.32, 0.72)
PINK = (0.95, 0.52, 0.60)

# Handwriting face. Bradley Hand Bold ships with macOS.
# If cairo cannot find the family it silently falls back to a default sans, so check a still.
# Caveat, Patrick Hand, Kalam and Gaegu are also installed on the workspace machine (see TOOLKIT.md).
FONT = "Bradley Hand"

# ------------------------------------------------------------------ words
# Title is drawn in world space above the opening shot and stays in the world,
# so it reappears small in the sky in the final wide shot.
TITLE = dict(lines=("How the Night", "Got Its Stars"), x=300, y=-610, size=86, gap=90, t0=0.3, dur=2.4)
# End card is drawn in screen space over the last shot.
END = dict(text="The End.", x=W / 2, y=1010, size=64, t_in=40.0, t_out=46.0, fade=1.5)
SIGN = "STAR MAKER"           # painted on the machine
OWL_SAYS = "hoo!"             # speech bubble when the owl wakes

# ------------------------------------------------------------------ timeline shared by picture and music
SPARK_POP = 3.4               # the spark appears on the hilltop
MUSH_T = [9.1, 10.0, 11.1]    # spark lands on mushroom 1, 2, 3
LEDGE_LAND = 12.7             # spark lands on the owl's branch
OWL_WAKE = 13.8               # owl opens its eyes and hops
SLIDE_T0, SLIDE_T1 = 16.0, 19.6   # spark rides the long bunting slide
WHEEL_T0, WHEEL_T1 = 20.2, 21.7   # water wheel turns a quarter
WHEEL_TICKS = 20.3            # nine ratchet ticks, 0.16 s apart
MACHINE_ON = 24.9             # spark drops into the chimney, machine starts
MACHINE_OFF = 29.5            # rumble and heartbeat stop
STAR_T0 = 26.0                # first star leaves the chimney
STAR_DT = 0.55                # gap between stars
STAR_FLY = 1.9                # flight time of one star
FINALE = 32.5                 # triangle hit, constellation lines start soon after
CONST_T0, CONST_DT = 33.0, 0.7    # constellation line k starts at CONST_T0 + k * CONST_DT
MOON_T = 36.5                 # moon pops in

# Night falls: diagonal blue crayon hatching fills the top of the SCREEN (not the world).
SKY = dict(t0=31.0, dur=9.0, base=320, color=(0.40, 0.53, 0.90), alpha=0.55, angle=0.5, spacing=7, width=6)

# ------------------------------------------------------------------ camera
# (time, world x, world y, zoom). Zoom 1.0 shows a 1080x1080 window of the world.
# Keys are linearly interpolated, then smoothed with a Gaussian of CAM_SMOOTH seconds,
# so the camera arrives a little early and leaves a little late. Leave a margin.
CAMERA_KEYS = [
    (0, 300, -330, 1.0), (3.3, 320, -300, 1.05), (4.5, 420, -200, 1.15), (6.5, 700, -110, 1.1),
    (8.4, 1160, -130, 1.1), (9.4, 1420, -170, 1.0), (10.6, 1680, -280, 0.9),
    (11.8, 2030, -480, 0.75), (12.9, 2400, -340, 1.0), (14.4, 2580, -300, 1.1),
    (15.5, 2780, -200, 1.0), (15.9, 2780, -80, 0.85),
    (19.9, 420, 1200, 1.05), (20.8, 400, 1270, 1.15), (22.0, 560, 1350, 1.1),
    (23.5, 840, 1420, 1.0), (25.0, 1150, 1340, 0.95), (26.4, 1200, 1240, 0.85),
    (28.5, 1500, 900, 0.55), (31.0, 1450, 450, 0.38), (34.0, 1375, 290, 0.33),
    (60.0, 1375, 290, 0.33),
]
# Spans where the camera locks onto the spark: (t0, t1, step, zoom).
# A key is added every `step` seconds at the spark's position.
CAMERA_FOLLOW = [(SLIDE_T0, SLIDE_T1, 0.2, 0.72)]
# Late global push-in: every key before `until` has its zoom multiplied by `factor`.
CAMERA_BOOST = dict(factor=1.25, until=26.5)
CAM_SMOOTH = 0.5

# ------------------------------------------------------------------ music
BEAT = 0.625                  # 96 bpm
# Chord voicings (MIDI notes) for the string pad, roots for the pizzicato bass, arpeggio notes.
CHORD_VOICES = {"C": (48, 55, 64), "Am": (45, 52, 60), "F": (41, 48, 57), "G": (43, 50, 59)}
CHORD_ROOTS = {"C": 48, "Am": 45, "F": 41, "G": 43}
CHORD_ARPS = {"C": (60, 64, 67), "Am": (57, 60, 64), "F": (53, 57, 60), "G": (55, 59, 62)}
# One chord per 4-beat bar. If the list is shorter than the video, the last chord repeats.
PROGRESSION = ["C", "Am", "F", "G"] * 3 + ["C"] + ["F", "G", "Am", "F", "G", "C", "C"]
CLIMAX_BAR = 13               # from this bar: louder pad, octave piano, flute doubles the melody
BUILD_BARS = (10, 12)         # machine bars: busier arpeggio and bass
# Celesta melody: bar -> [(beat offset, MIDI note, length in beats)]
MELODY = {
    2: [(0, 76, 1), (1, 79, 1), (2, 84, 2)], 3: [(0, 81, 1), (1, 79, 1), (2, 76, 2)],
    4: [(0, 77, 1), (1, 81, 1), (2, 84, 2)], 5: [(0, 83, 1), (1, 79, 1), (2, 74, 2)],
    6: [(0, 79, 1), (1, 84, 1), (2, 88, 2)], 7: [(0, 86, 1), (1, 84, 1), (2, 81, 2)],
    8: [(0, 84, 1), (1, 81, 1), (2, 77, 2)], 9: [(0, 79, .5), (.5, 81, .5), (1, 83, 1), (2, 86, 2)],
    13: [(0, 81, 1), (1, 84, 1), (2, 89, 2)], 14: [(0, 88, 1), (1, 86, 1), (2, 83, 2)],
    15: [(0, 84, 1), (1, 88, 1), (2, 93, 2)], 16: [(0, 89, 1), (1, 88, 1), (2, 84, 2)],
    17: [(0, 86, 1), (1, 83, 1), (2, 79, 1), (3, 83, 1)], 18: [(0, 84, 4)],
}
# C major pentatonic, used for every cue so cues always sit in the key.
PENT = [72, 74, 76, 79, 81, 84, 86, 88, 91]
HUMANIZE_SEED = 11            # timing and velocity jitter is seeded, so builds are repeatable

# Soundfonts are not part of this repository. They live in ~/soundfonts on the workspace machine
# (override with the SOUNDFONT_DIR environment variable). See template/README.md for sources.
SOUNDFONT_DIR = Path(os.environ.get("SOUNDFONT_DIR", "~/soundfonts")).expanduser()
PIANO_SFZ = SOUNDFONT_DIR / "salamander/SalamanderGrandPianoV3_48khz24bit/SalamanderGrandPianoV3.sfz"
REST_SF = SOUNDFONT_DIR / "MuseScore_General.sf3"
SFIZZ_DIR = SOUNDFONT_DIR / "sfizz-dl/sfizz-1.2.3-macos/usr/local"   # bin/sfizz_render and lib/

# Mix: each stem is peak-normalised to these levels before effects; master peak after limiting.
MIX = dict(rest_peak=0.60, piano_peak=0.62, piano_gain=0.95, fx_gain=0.35, master_peak=0.58,
           fade_in=0.4, fade_out=2.5)
