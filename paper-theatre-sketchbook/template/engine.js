/* STYLE ENGINE - paper theatre and sketchbook. No per-video content lives here.

   What it owns:
   - The fixed 1920x1080 page: header labels, title, two mounted panels, the label
     under each panel, the caption, the chapter label and the range footer.
   - Drawing every frame as a pure function of time (drawFrame(t)). No random state,
     no accumulated simulation, so HyperFrames can seek, reverse and render in parallel.
   - Dual rendering: scenes.js draws each beat once, and the engine runs it twice,
     once with pencil=false (left panel, flat paper cutouts) and once with
     pencil=true (right panel, ink outlines, hatching and the boil).
   - Beat bookkeeping from config.js: which beat is on, cross-dissolves at beat edges,
     text fades.
   - Seeded paper texture and the quantized boil (pose and hash convention adapted
     from the HyperFrames hw-boil registry component).

   What scenes.js gets: see `api` below. */
(() => {
  'use strict';
  const cfg = window.VIDEO;
  if (!cfg) throw new Error('config.js did not load: window.VIDEO is missing');
  const P = cfg.palette;
  const W = 1920, H = 1080;
  // Each panel: a mounted card with a shadow, and a clipped drawing area inside it.
  const CARD = { x: 70, y: 81, w: 880, h: 872, step: 900 };
  const PANEL = { x: 77, y: 88, w: 866, h: 822 };
  const FONT_SCRIPT = 'Caveat';
  const FONT_SANS = '"Work Sans"';

  let canvas = null, c = null, scenes = null, paperTex = null;
  let pencil = false, clock = 0;

  // ---- maths -------------------------------------------------------------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const mix = (a, b, t) => a + (b - a) * t;
  // Deterministic 0..1 hash. Never use Math.random in a composition.
  const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgbCache = new Map();
  function rgb(hex) {
    let v = rgbCache.get(hex);
    if (!v) {
      const h = hex.replace('#', '');
      v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      rgbCache.set(hex, v);
    }
    return v;
  }
  // Blend two #rrggbb colours. Use it for every colour change over time,
  // so nothing snaps at a beat boundary.
  function mixColor(a, b, t) {
    t = clamp(t);
    const x = rgb(a), y = rgb(b);
    return `rgb(${Math.round(mix(x[0], y[0], t))},${Math.round(mix(x[1], y[1], t))},${Math.round(mix(x[2], y[2], t))})`;
  }

  // ---- drawing primitives (shared by both panels) -------------------------
  // look(paperValue, pencilValue): pick per panel.
  const look = (paperValue, pencilValue) => (pencil ? pencilValue : paperValue);

  // A filled SVG path. In the pencil panel it also gets an ink outline plus a faint
  // offset second stroke, which is what reads as a pencil line.
  function shape(d, fill, stroke = P.ink, width = 2.1) {
    const path = new Path2D(d);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (fill) { c.fillStyle = fill; c.fill(path); }
    if (pencil && stroke) {
      c.strokeStyle = stroke; c.lineWidth = width; c.stroke(path);
      c.save(); c.translate(0.7, -0.6); c.globalAlpha *= 0.24; c.lineWidth = 0.85; c.stroke(path); c.restore();
    }
  }
  // A stroked path in both panels.
  function line(d, color = P.ink, width = 2) { const old = pencil; pencil = true; shape(d, null, color, width); pencil = old; }
  function ellipse(x, y, rx, ry, fill, stroke = null) {
    c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.8; c.stroke(); }
  }
  // Local transform: translate, rotate, uniform scale.
  function group(x, y, s, r, fn) { c.save(); c.translate(x, y); c.rotate(r); c.scale(s, s); fn(); c.restore(); }
  // Text shrinks to fit maxWidth. HyperFrames' layout audit cannot see canvas text,
  // so an over-long caption would otherwise run off the frame without any warning.
  function fit(str, size, family, weight, maxWidth) {
    c.font = `${weight} ${size}px ${family}`;
    if (maxWidth) {
      const w = c.measureText(str).width;
      if (w > maxWidth) c.font = `${weight} ${Math.floor(size * maxWidth / w)}px ${family}`;
    }
  }
  function text(str, x, y, size, color = P.ink, align = 'center', maxWidth = 0) {
    c.fillStyle = color; c.textAlign = align; fit(str, size, FONT_SCRIPT, 700, maxWidth); c.fillText(str, x, y);
  }
  function sans(str, x, y, size, align, maxWidth = 0) {
    c.fillStyle = P.label; c.textAlign = align; fit(str, size, FONT_SANS, 500, maxWidth); c.fillText(str, x, y);
  }
  // Diagonal pencil hatching clipped to a path. Pencil panel only.
  function hatch(d, color, seed = 0) {
    if (!pencil) return;
    const path = new Path2D(d);
    c.save(); c.clip(path); c.globalAlpha *= 0.36; c.strokeStyle = color; c.lineWidth = 1.3;
    for (let i = 0; i < 100; i++) {
      const y = -330 + i * 7, off = hash(i + seed) * 12;
      c.beginPath(); c.moveTo(-300 + off, y); c.lineTo(400, y + 140); c.stroke();
    }
    c.restore();
  }

  // ---- paper texture (seeded, static) -----------------------------------
  function buildPaper() {
    paperTex = document.createElement('canvas');
    paperTex.width = 900; paperTex.height = 860;
    const pc = paperTex.getContext('2d');
    for (let i = 0; i < 42000; i++) {
      const x = hash(i * 3) * 900, y = hash(i * 3 + 1) * 860, a = 0.025 + hash(i * 3 + 2) * 0.065;
      pc.fillStyle = `rgba(${P.speck},${a})`;
      pc.fillRect(x, y, hash(i + 3) * 2.6 + 0.5, 0.7);
    }
  }
  const texture = () => c.drawImage(paperTex, 0, 0, PANEL.w, PANEL.h);

  // ---- beats --------------------------------------------------------------
  const beats = cfg.beats.map((b, i, all) => ({ ...b, end: i + 1 < all.length ? all[i + 1].start : cfg.duration }));
  const B = Object.fromEntries(beats.map((b) => [b.id, b.start]));
  function validateBeats() {
    if (!beats.length) throw new Error('config.js: beats is empty');
    if (beats[0].start !== 0) throw new Error('config.js: the first beat must start at 0');
    const seen = new Set();
    beats.forEach((b, i) => {
      if (seen.has(b.id)) throw new Error(`config.js: duplicate beat id "${b.id}"`);
      seen.add(b.id);
      if (!(b.end > b.start)) throw new Error(`config.js: beat "${b.id}" has no length (check start times and duration)`);
      if (i && b.start <= beats[i - 1].start) throw new Error('config.js: beat starts must increase');
    });
  }
  function beatIndex(t) {
    let i = 0;
    while (i + 1 < beats.length && t >= beats[i + 1].start) i++;
    return i;
  }
  // Characters cross-dissolve, centred on the boundary.
  function actorAlpha(i, t) {
    const b = beats[i], f = cfg.actorFade || 0, last = beats.length - 1;
    if (f <= 0) return i === beatIndex(t) ? 1 : 0;
    const a = i === 0 ? 1 : smooth((t - (b.start - f / 2)) / f);
    const z = i === last ? 1 : 1 - smooth((t - (b.end - f / 2)) / f);
    return a * z;
  }
  // Beat text fades out, then the next fades in, so two lines never overlap.
  function textAlpha(t) {
    const i = beatIndex(t), b = beats[i], f = cfg.textFade || 0, last = beats.length - 1;
    if (f <= 0) return 1;
    const a = i === 0 ? 1 : smooth((t - b.start) / f);
    const z = i === last ? 1 : 1 - smooth((t - (b.end - f)) / f);
    return a * z;
  }

  // ---- one panel ----------------------------------------------------------
  // ---- fades -------------------------------------------------------------
  // fade(alpha, fn): draw fn() opaque into an offscreen layer, then composite the layer
  // with alpha. Lowering globalAlpha instead fades every shape on its own, so overlaps
  // show through (a character's legs through its body, palm leaves through the trunk).
  // Works at any nesting depth and under any transform.
  const layers = [];
  let fadeDepth = 0, panelBase = null;
  function fade(alpha, fn) {
    if (alpha <= 0.001) return;
    if (alpha >= 0.999 || !panelBase) { c.save(); if (alpha < 0.999) c.globalAlpha *= alpha; fn(); c.restore(); return; }
    let L = layers[fadeDepth];
    if (!L) {
      const cv = document.createElement('canvas'); cv.width = PANEL.w; cv.height = PANEL.h;
      L = layers[fadeDepth] = { cv, ctx: cv.getContext('2d') };
    }
    fadeDepth++;
    const main = c;
    c = L.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, PANEL.w, PANEL.h);
    c.setTransform(panelBase.inverse().multiply(main.getTransform()));
    c.save(); fn(); c.restore();
    c = main;
    fadeDepth--;
    c.save(); c.setTransform(panelBase); c.globalAlpha *= alpha; c.drawImage(L.cv, 0, 0); c.restore();
  }

  // ---- one panel ----------------------------------------------------------
  function story(t) {
    panelBase = c.getTransform();
    scenes.landscape(t);
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      fade(actorAlpha(i, t), () => scenes.beats[b.id](t - b.start, t, b));
    }
    texture();
    panelBase = null;
  }

  function rangeFooter(y) {
    const right = 1832, gap = 14, arrow = 24;
    sans(cfg.range.to, right, y, 17, 'right');
    c.font = `500 17px ${FONT_SANS}`;
    const x2 = right - c.measureText(cfg.range.to).width - gap, x1 = x2 - arrow, ay = y - 6;
    c.save(); c.strokeStyle = P.label; c.lineWidth = 1.4; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x1, ay); c.lineTo(x2, ay); c.moveTo(x2 - 6, ay - 4); c.lineTo(x2, ay); c.lineTo(x2 - 6, ay + 4); c.stroke();
    c.restore();
    sans(cfg.range.from, x1 - gap, y, 17, 'right');
  }

  function drawFrame(time) {
    clock = clamp(time, 0, cfg.duration);
    const t = clock, beat = beats[beatIndex(t)], ta = textAlpha(t);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.clearRect(0, 0, W, H); c.fillStyle = P.paper; c.fillRect(0, 0, W, H);
    sans(cfg.panels.left, 88, 55, 20, 'left', 420);
    sans(cfg.panels.right, 1832, 55, 20, 'right', 420);
    text(cfg.title, 960, 55, 34, P.ink, 'center', 1000);
    for (let j = 0; j < 2; j++) {
      c.save(); c.translate(CARD.x + j * CARD.step, CARD.y);
      c.shadowColor = '#362b2420'; c.shadowBlur = 13; c.shadowOffsetY = 5;
      c.fillStyle = P.card; c.fillRect(0, 0, CARD.w, CARD.h); c.restore();
      c.save(); c.translate(PANEL.x + j * CARD.step, PANEL.y);
      c.beginPath(); c.rect(0, 0, PANEL.w, PANEL.h); c.clip();
      pencil = j === 1;
      if (pencil && cfg.boil && cfg.boil.amp) {
        // Quantized, index-derived pose: the sketch re-poses boil.fps times a second.
        const q = Math.floor(t * cfg.boil.fps);
        c.translate((hash(q) - 0.5) * cfg.boil.amp, (hash(q + 91) - 0.5) * cfg.boil.amp);
      }
      story(t);
      c.restore();
      c.save(); c.globalAlpha = ta; text(beat.label, CARD.x + CARD.w / 2 + j * CARD.step, 940, 31, P.ink, 'center', CARD.w - 40); c.restore();
    }
    pencil = false;
    c.save(); c.globalAlpha = ta;
    text(beat.caption, 960, 998, 41, P.ink, 'center', 1700);
    sans(beat.chapter, 88, 1028, 17, 'left', 760);
    c.restore();
    rangeFooter(1028);
  }

  // ---- boot ---------------------------------------------------------------
  const api = {
    W: PANEL.w, H: PANEL.h, P, B,
    // The current 2D context. It changes while api.fade draws into a layer,
    // so always use api.c at draw time; never keep a copy of it.
    get c() { return c; },
    get pencil() { return pencil; },
    get clock() { return clock; },
    clamp, smooth, mix, mixColor, hash, look,
    shape, line, ellipse, group, text, hatch, fade,
    beat: (id) => beats.find((b) => b.id === id),
  };

  function init() {
    validateBeats();
    const rootEl = document.querySelector('[data-composition-id]');
    const authored = Number(rootEl && rootEl.getAttribute('data-duration'));
    if (authored !== span.length) {
      throw new Error(`index.html root data-duration (${authored}) differs from config.js duration (${span.length}). Run "npm run sync".`);
    }
    canvas = document.getElementById('art');
    c = canvas.getContext('2d');
    document.body.style.background = P.paper;
    const bar = document.getElementById('progress');
    if (bar) bar.style.background = P.progress;
    buildPaper();
    if (typeof window.SCENES !== 'function') throw new Error('scenes.js did not load: window.SCENES is missing');
    scenes = window.SCENES(api);
    for (const b of beats) {
      if (typeof scenes.beats[b.id] !== 'function') throw new Error(`scenes.js has no drawing for beat "${b.id}"`);
    }
    drawFrame(span.offset);
  }

  // Normally the whole video. tools/render-window.mjs sets timeOffset and windowLength
  // to render a short slice: composition time 0 then draws video time timeOffset.
  const span = {
    offset: cfg.timeOffset || 0,
    length: cfg.windowLength || cfg.duration,
    total: cfg.duration,
  };

  window.PaperTheatre = {
    config: cfg,
    span,
    // t is composition time; the drawn video time is t + span.offset.
    drawFrame: (t) => drawFrame(t + span.offset),
    // Resolve after both fonts are loaded, so the first drawn frame already uses them.
    ready: () => Promise.all([
      document.fonts.load(`700 40px ${FONT_SCRIPT}`),
      document.fonts.load(`500 20px ${FONT_SANS}`),
    ]).then(init),
  };
})();
