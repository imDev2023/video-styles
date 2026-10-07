// PER-VIDEO - every setting that changes from one story to the next and is not drawing code.
// The drawing itself (geometry, motion paths, camera keyframes, scenes) is in world.mjs and the
// score is in score.mjs; both are per-video files too. The engine files never need editing.
//
// The values below are the finished "How Autumn Got Its Colors" (60 s, 1080x1080, 30 fps).
import os from 'node:os';
import path from 'node:path';
import { INK, PAPER } from './lib.mjs';

export const VIDEO = {
  slug: 'how-autumn-got-its-colors', // final export is out/<slug>.mp4
  W: 1080,
  H: 1080,
  FPS: 30,
  DUR: 60, // seconds
};

// Palette. [r, g, b] in 0..1. INK and PAPER are the style's own pencil and paper; keep them.
// Story colours are bright crayon tones at about 0.6 to 0.95 saturation, never pure primaries.
export const PALETTE = {
  INK, PAPER,
  GREEN: [0.30, 0.66, 0.30], DGREEN: [0.20, 0.52, 0.28],
  RED: [0.84, 0.17, 0.14], ORANGE: [0.96, 0.52, 0.12], GOLD: [0.99, 0.78, 0.16],
  BROWN: [0.58, 0.38, 0.22], DBROWN: [0.40, 0.27, 0.17], TAN: [0.85, 0.65, 0.40],
  BLUE: [0.38, 0.62, 0.90], CREAM: [0.97, 0.90, 0.72], GREY: [0.55, 0.55, 0.60],
  PINK: [0.95, 0.55, 0.60], SQUIRREL: [0.86, 0.46, 0.18], COPPER: [0.82, 0.50, 0.26],
  BANNER: [0.99, 0.96, 0.88], // title banner paper
};

// Handwriting font. fetch-assets.mjs puts the OFL-licensed file at FONT.file; render.mjs
// registers it, and falls back to an installed system font of the same family.
export const FONT = { family: 'Caveat', weight: 700, file: 'assets/fonts/Caveat[wght].ttf' };

// Title banner (screen space). Times in seconds: [start, duration] of the fade in and fade out.
export const TITLE = {
  lines: ['How Autumn', 'Got Its Colors'],
  show: [0.2, 0.8], hide: [6.2, 1.0],
  box: [120, 60, 840, 160], radius: 22,
  hatch: PALETTE.GOLD, hatchAmount: 0.35,
  size: 78, baselines: [135, 205],
};

// End card (screen space).
export const END = { text: 'The End.', show: [56, 1.5], hide: [59.2, 0.8], y: 1010, size: 76 };

// Fade from paper at the start and back to paper at the end, in seconds.
export const FADE = { in: 0.4, out: 0.8 };

// Camera smoothing: per-frame camera = keyframes in world.mjs, linearly interpolated, then a
// Gaussian blur over time with this sigma in seconds. 0.5 s gives the soft "handheld rostrum" glide.
export const CAMERA = { smooth: 0.5 };

// The story, beat by beat. `node render.mjs beats` renders one still per beat into out/test/,
// which is the first check after any change. Keep it in step with world.mjs.
export const STORY = [
  { t: 1.0, beat: 'Title banner over a sleepy oak; an acorn hangs on a branch.' },
  { t: 3.5, beat: 'The acorn wobbles; the oak opens its eyes in surprise.' },
  { t: 4.9, beat: 'The acorn drops and bounces off two leaf trampolines.' },
  { t: 7.5, beat: 'It rolls down a log ramp towards a seesaw.' },
  { t: 10.2, beat: 'A squirrel leaps from its stump onto the seesaw and launches the acorn.' },
  { t: 12.5, beat: 'The acorn lands in a spider web, which boings it on.' },
  { t: 14.5, beat: 'It hops over three paint pots, red, orange and gold, popping their lids.' },
  { t: 17.5, beat: 'It lands in a leaf boat, and the creek is coloured in as the boat sails down.' },
  { t: 26.0, beat: 'The creek winds down the hill to a water wheel.' },
  { t: 29.3, beat: 'The acorn hops into a wheel bucket; the wheel starts turning.' },
  { t: 33.4, beat: 'The wheel swings a pendulum paintbrush through the green maple.' },
  { t: 36.5, beat: 'The bucket tips, the acorn slides down a chute; the hedgehog says "yum!".' },
  { t: 41.0, beat: 'Every leaf the brush touches turns red, orange or gold.' },
  { t: 47.0, beat: 'The painted leaves fall and settle on the ground.' },
  { t: 52.0, beat: 'The oak turns gold and a sunset sky is crayoned in.' },
  { t: 58.0, beat: 'The camera pulls back over the whole machine: "The End."' },
];

// Text check (textcheck.mjs). textEvery: sample every Nth frame (every STORY beat is always sampled).
// textIgnore: [t0, t1, "why"] ranges where crowded or cropped text is deliberate. safe: the phone UI zone
// for a vertical film as { top, bottom, right } in pixels, or null to scale the default 1080x1920 zone
// (top 240, bottom 420, right 140). The dead-beat check is the shared styles/tools/deadbeats.mjs and takes
// its limits on the command line (PLAYBOOK.md section 3).
export const CHECK = {
  textEvery: 6,
  textIgnore: [],
  safe: null,
};

// Rendering. Segments are rendered in parallel by run.mjs, then concatenated without re-encoding.
export const RENDER = {
  segFrames: 150, // 5 s per segment at 30 fps
  workers: Math.max(1, Math.min(12, os.availableParallelism() - 1)),
  crf: 16, preset: 'medium', gop: 30,
};

// Music. score.mjs holds the notes; music.mjs renders them with spessasynth_core.
export const MUSIC = {
  soundfont: path.join(os.homedir(), 'soundfonts', 'MuseScore_General.sf3'),
  bpm: 96, // 24 bars of 4/4 at 96 bpm = 60 s exactly
  sampleRate: 44100,
  tail: 3, // seconds rendered past VIDEO.DUR so the last notes ring out
  seed: 99, // humanisation and impulse-response random seed
  reverbSeconds: 2.2, // length of the synthetic concert-hall impulse response
};

// Mastering (master.mjs): convolution reverb, fades, gain and true-peak limiter, mux.
export const MASTER = {
  reverbWet: 0.35,
  fadeIn: 0.5, fadeOut: 3.0,
  lufs: -15, truePeak: -2, // integrated loudness target and true-peak ceiling of the finished file
  limiterHeadroom: 0.5, // dB under the ceiling the limiter aims for; AAC encoding adds a little overshoot
  aacBitrate: '192k',
};
