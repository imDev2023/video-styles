// PER-VIDEO - the score for "How Autumn Got Its Colors": 24 bars of 4/4 at 96 bpm = 60 s.
// music.mjs (engine) calls compose() and renders the result; replace this file for a new story.
//
// Shape that worked: a music-box intro under the title, a celesta tune over a light
// guitar-and-pizzicato bed, the tune passed between celesta, flute, clarinet and piano as the
// story moves, a full strings-and-horn climax for the big moment, then a choir-and-harp finale.
// On top of the bed, short "cue" figures land exactly on picture events from world.mjs TIMES
// (marimba hits for bounces, a harp run for a launch, a bassoon "yum", a timpani roll).

// Instruments: name -> [General MIDI program (0-based), MIDI channel (1-based, 1..16)].
// One instrument per channel. Channel 10 is General MIDI percussion: use it only for drums.
export const INSTRUMENTS = {
  celesta: [8, 1], clarinet: [71, 2], flute: [73, 3], strings: [48, 4], horn: [60, 5], guitar: [24, 6], pizz: [45, 7],
  piano: [0, 8], harp: [46, 11], marimba: [12, 12], timpani: [47, 13], choir: [52, 14], bassoon: [70, 15], musicbox: [10, 16],
};

// add(instrument, startSeconds, durationSeconds, midiPitch, velocity = 70, humanise = true)
// bar(k) is the start of bar k in seconds; BEAT and BAR are lengths in seconds.
// TIMES holds picture events exported by world.mjs.
export function compose({ add, bar, BEAT, BAR, TIMES }) {
  const CH = { Am: { b: 45, t: [57, 60, 64] }, F: { b: 41, t: [53, 57, 60] }, C: { b: 48, t: [55, 60, 64] }, G: { b: 43, t: [55, 59, 62] }, Dm: { b: 50, t: [57, 62, 65] } };
  const PROG = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Dm', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Dm', 'Am', 'F', 'G', 'F', 'G', 'C', 'C'];
  const inBars = (k, a, b) => k >= a && k <= b;

  // ---- harmony and rhythm beds, one chord per bar
  PROG.forEach((name, k) => {
    const c = CH[name], t0 = bar(k);
    const swell = k < 2 ? 38 : k < 10 ? 46 : k < 14 ? 54 : k < 18 ? 66 : k < 22 ? 52 : 64;
    c.t.forEach((p) => add('strings', t0, BAR + 0.2, p - (k < 14 ? 0 : 12), swell, false));
    if (inBars(k, 2, 21)) for (let j = 0; j < 8; j++) { const idx = [0, 1, 2, 1, 0, 1, 2, 1][j]; add('guitar', t0 + j * BEAT / 2, BEAT * 0.9, c.t[idx], 44 + (j % 4 === 0 ? 8 : 0)); }
    if (inBars(k, 4, 21)) { add('pizz', t0, BEAT * 0.8, c.b, 74); add('pizz', t0 + 2 * BEAT, BEAT * 0.8, c.b + (k % 2 ? 7 : 0), 62); if (inBars(k, 10, 17)) add('pizz', t0 + 3 * BEAT, BEAT * 0.5, c.b + 12, 56); }
    if (inBars(k, 18, 21)) for (let j = 0; j < 8; j++) add('piano', t0 + j * BEAT / 2, BEAT * 0.9, [c.t[0] + 12, c.t[1] + 12, c.t[2] + 12, c.t[1] + 12][j % 4] + (j > 3 ? 12 : 0), 46);
    if (k >= 20) c.t.forEach((p) => add('choir', t0, BAR + 0.3, p + 12, k === 23 ? 52 : 44, false));
    if (inBars(k, 14, 17) || k >= 22) add('horn', t0, BAR, c.t[0], 60, false);
  });
  // intro music box under the title
  [69, 72, 76, 81, 76, 72, 69, 72].forEach((p, i) => add('musicbox', 0.4 + i * BEAT, 1.2, p + 12, 52));

  // ---- melody: two-bar phrases [beat, pitch, beats] over [Am F] [C G]
  const M1 = [[[0, 76, 1], [1, 72, 1], [2, 74, 1], [3, 76, 1]], [[0, 77, 2], [2, 72, 1], [3, 69, 1]]];
  const M2 = [[[0, 79, 1], [1, 76, 1], [2, 79, 1], [3, 84, 1]], [[0, 83, 2], [2, 79, 2]]];
  const M3 = [[[0, 76, 1.5], [1.5, 79, 0.5], [2, 81, 1], [3, 79, 1]], [[0, 77, 1], [1, 81, 1], [2, 84, 2]]];
  const M4 = [[[0, 84, 1], [1, 83, 1], [2, 79, 1], [3, 76, 1]], [[0, 74, 2], [2, 79, 1], [3, 83, 1]]];
  const phrase4 = (inst, k0, P, Q, vel, oct = 0) => { // four bars: P (2 bars) then Q (2 bars)
    P.forEach((notes, i) => notes.forEach(([b, p, d]) => add(inst, bar(k0 + i) + b * BEAT, d * BEAT * 0.95, p + oct, vel)));
    Q.forEach((notes, i) => notes.forEach(([b, p, d]) => add(inst, bar(k0 + 2 + i) + b * BEAT, d * BEAT * 0.95, p + oct, vel)));
  };
  phrase4('celesta', 2, M1, M2, 78);                                        // bars 2-5: the journey starts
  phrase4('celesta', 6, M1, M2, 76); phrase4('flute', 6, M1, M2, 54, -12);  // bars 6-9
  phrase4('clarinet', 10, M3, M4, 66, -12);                                 // bars 10-13: the creek
  phrase4('celesta', 10, M3, M4, 50, 12);
  phrase4('strings', 14, M1, M2, 78, -12); phrase4('horn', 14, M1, M2, 62, -24); phrase4('flute', 14, M1, M2, 72); phrase4('celesta', 14, M1, M2, 70, 12); // bars 14-17: climax, the painting
  phrase4('piano', 18, M3, M4, 60, 0); phrase4('celesta', 18, M3, M4, 56, 12); // bars 18-21: falling leaves
  [[84, 0, 4], [79, 0, 4], [76, 0, 4]].forEach(([p, b, d]) => add('flute', bar(22) + b, d * BEAT, p, 66, false));
  add('celesta', bar(22), BAR * 1.5, 88, 74, false); add('strings', bar(23), BAR, 72, 70, false);

  // ---- cues timed to the picture
  const hit = (t, p, v = 84) => add('marimba', t, 0.5, p, v, false);
  add('celesta', 4.1, 0.8, 91, 84, false);                                                      // acorn drops
  [[4.75, 81], [5.6, 84], [6.4, 88]].forEach(([t, p]) => { hit(t, p); add('celesta', t, 0.6, p + 12, 70, false); }); // trampoline and log bounces
  for (let i = 0; i < 8; i++) add('musicbox', 6.6 + i * 0.22, 0.4, [86, 83, 79, 76, 74, 71, 67, 64][i], 56); // log-ramp roll
  [67, 71, 74, 79, 83, 86, 91, 95].forEach((p, i) => add('harp', TIMES.T_SEESAW + i * 0.05, 1.2, p, 78, false)); // seesaw launch
  add('timpani', TIMES.T_SEESAW, 1.0, 38, 80, false);
  add('pizz', TIMES.T_WEB, 0.5, 40, 90, false); add('celesta', TIMES.T_WEB + 0.05, 0.9, 96, 80, false);        // spider web boing
  TIMES.POTS.forEach((t, i) => { hit(t, [76, 79, 84][i], 92); add('celesta', t, 0.5, [88, 91, 96][i], 68, false); }); // paint pot lids
  for (let b = 0; b < 12; b++) [64, 69, 72, 76, 72, 69].forEach((p, i) => add('harp', 17 + b * 1.0 + i * 0.16, 0.7, p + (b % 2 ? 0 : 5) - 5 + (b > 6 ? 2 : 0), 52 + (b % 3) * 4)); // creek ripples
  add('musicbox', 28.9, 0.3, 91, 64, false); add('musicbox', 29.0, 0.3, 88, 64, false); add('timpani', 29.2, 0.7, 45, 70, false); // hop into the bucket
  for (let s = 0; s < 14; s++) add('celesta', TIMES.T_TIP + s * 0.09, 0.6, 72 + (s * 2) % 17 + 12, 52 + s, false); // bucket tips
  add('bassoon', TIMES.T_CATCH, 0.35, 55, 92, false); add('bassoon', TIMES.T_CATCH + 0.4, 0.5, 52, 92, false);       // "yum!"
  for (let r = 0; r < 24; r++) add('timpani', 42.5 + r * 0.075, 0.2, 45, 40 + r * 2, false);                         // paint roll
  add('timpani', 44.6, 1.6, 45, 96, false);
  for (let s = 0; s < 22; s++) add('celesta', 45.4 + s * 0.28, 0.9, [96, 91, 88, 84, 93, 86][s % 6], 58 - Math.min(20, s), false); // leaves fall sparkle
  [60, 64, 67, 72, 76, 79, 84, 88].forEach((p, i) => add('harp', 52.0 + i * 0.1, 2.0, p, 78, false));               // finale rise
  add('timpani', bar(22), 2.5, 36, 90, false);
}
