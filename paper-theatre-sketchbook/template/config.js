/* PER-VIDEO CONTENT. Everything that changes from one video to the next lives here:
   text, beat timings, palette, boil, music.
   The drawings for each beat live in scenes.js (also per-video).
   engine.js is the style itself and should not need edits.

   This file is a plain browser script so index.html can load it without a fetch.
   The Node tools (sync-config.mjs, fetch-assets.mjs, render-window.mjs) read it too,
   so keep it a single object literal assigned to root.VIDEO.

   After changing `duration`, `music` or `title`, run `npm run sync` (check and render
   run it for you). It stamps them into index.html, because HyperFrames reads the root
   data-duration before any script runs. */
(function (root) {
  root.VIDEO = {
    slug: 'dinosaur-history',
    title: 'A tiny history of dinosaurs',
    description: 'Two illustrated views of dinosaur history',
    duration: 47.5, // seconds; the last beat ends here
    fps: 24,

    // Small sans labels above each panel.
    panels: { left: 'PAPER THEATRE', right: 'THE SKETCHBOOK' },
    // Footer range on the right: "<from>  ->  <to>" with a drawn arrow.
    range: { from: '230 MILLION YEARS', to: 'TODAY' },

    // One entry per story beat, in order. `id` must match a function in scenes.js.
    // chapter: small sans label bottom left. label: Caveat under both panels.
    // caption: the big Caveat line under the panels.
    beats: [
      { id: 'hatch',     start: 0,  chapter: 'TRIASSIC',          label: '230 million years ago', caption: 'Small beginnings.' },
      { id: 'giants',    start: 8,  chapter: 'JURASSIC',          label: '160 million years ago', caption: 'A world of giants.' },
      { id: 'meeting',   start: 17, chapter: 'CRETACEOUS',        label: '68 million years ago',  caption: 'Life in every shape.' },
      { id: 'visitor',   start: 25, chapter: 'THE TURNING POINT', label: '66 million years ago',  caption: 'Then, the sky changed.' },
      { id: 'winter',    start: 29, chapter: 'AFTER THE IMPACT',  label: '66 million years ago',  caption: 'A world transformed.' },
      { id: 'survivors', start: 35, chapter: 'A NEW CHAPTER',     label: 'The survivors',         caption: 'Their descendants still fly.' },
      { id: 'today',     start: 43, chapter: 'STILL HERE',        label: 'Today',                 caption: 'The story is still flying.' },
    ],

    // Seconds of cross-dissolve for characters at a beat boundary, and of
    // fade-out then fade-in for the beat text. 0 gives the hard cuts of the original export.
    actorFade: 0.5,
    textFade: 0.25,

    // Pencil-panel boil: the whole sketch re-poses `fps` times a second by up to `amp` px.
    boil: { fps: 8, amp: 1.1 },

    // Design tokens. Scenes read these as P.<name>.
    palette: {
      paper: '#f4f0df',   // page and sketchbook paper
      card: '#e9e2cc',    // panel mount
      ink: '#35466e',     // pencil line, Caveat text
      label: '#766d58',   // small sans labels
      ochre: '#d6ac4c',
      teal: '#398878',
      rust: '#c67743',
      dark: '#302d23',    // paper-cutout silhouettes
      green: '#697348',
      progress: '#a65b34',
      speck: '78,58,23',  // rgb of the paper fibre specks
    },

    // Music bed. fetch-assets.mjs fills `file` from `url` or `source`; with neither it
    // writes a silent placeholder so the project still checks and renders.
    // Never commit the audio file (see the style's PLAYBOOK.md for licences).
    music: {
      file: 'assets/music/soundtrack.m4a',
      url: '',      // direct download link to an mp3/m4a/wav you are licensed to use
      source: '',   // or a local path (relative to this folder or absolute)
      credit: '',   // who made it and under which licence, for the video description
      fadeIn: 0.4,
      fadeOut: 2.0,
      volume: 1,
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
