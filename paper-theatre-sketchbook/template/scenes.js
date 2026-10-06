/* PER-VIDEO DRAWINGS. Replace this file for a new topic.
   It holds the worked example: the dinosaur story from videos/dinosaur-history,
   re-timed against the beats in config.js.

   Contract with engine.js:
     window.SCENES = (api) => ({ landscape(t), beats: { <beat id>(u, t, beat) } })
   - Coordinates are panel pixels: 0..api.W (866) by 0..api.H (822). Ground line near y 700.
   - Every function runs twice per frame: api.pencil is false for the paper-cutout panel
     and true for the sketchbook panel. Pick colours with api.look(paper, pencil).
     api.shape only outlines and api.hatch only hatches in the pencil panel.
   - landscape(t) runs every frame and should change smoothly (use api.mixColor and
     api.smooth envelopes, never `t < x ? a : b` for colours).
   - To fade anything made of overlapping shapes, wrap it in api.fade(alpha, () => ...),
     never in a lowered globalAlpha, or the overlaps show through.
   - beats[id](u, t) runs while that beat is on screen, with u = seconds since the beat's
     start. During a cross-dissolve u can be slightly negative or past the beat's end, so
     guard anything that breaks on a negative size.
   - Pure functions of time only: no Math.random, no Date, no state carried between frames.
     Use api.hash(n) for fixed pseudo-random placement.
   - api.B.<id> is each beat's start time; use it instead of hard-coded seconds. */
window.SCENES = function (api) {
  'use strict';
  const { P, B, clamp, smooth, mix, mixColor, hash, look, shape, line, ellipse, group, hatch, fade } = api;
  // Use api.c at draw time (never cache it): the engine swaps it for an offscreen
  // layer while a beat cross-dissolves.

  // ---- scenery --------------------------------------------------------------
  function sun(x, y, r) {
    ellipse(x, y, r, r, look('#f9e9b3', '#efc854'), look(null, P.ink));
    if (api.pencil) {
      ellipse(x + 1, y - 2, r * 0.66, r * 0.7, null, P.rust);
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        line(`M ${x + Math.cos(a) * (r + 12)} ${y + Math.sin(a) * (r + 12)} l ${Math.cos(a) * 12} ${Math.sin(a) * 12}`, P.ink, 1.4);
      }
    }
  }
  function fern(x, y, s = 1) {
    group(x, y, s, Math.sin(api.clock * 0.8 + x) * 0.04, () => {
      line('M 0 0 Q -10 -60 8 -130', look('#4e5933', P.ink), 2.4);
      for (let j = 1; j < 9; j++) {
        const yy = -j * 14, w = (10 - j) * 4;
        shape(`M 0 ${yy} Q ${-w} ${yy - 26} ${-w - 5} ${yy - 13} Q -8 ${yy + 3} 0 ${yy}`, look('#616d3b', '#82995c'));
        shape(`M 1 ${yy} Q ${w} ${yy - 30} ${w + 4} ${yy - 18} Q 10 ${yy + 2} 1 ${yy}`, look('#738048', '#85a776'));
      }
    });
  }
  function tree(x, y, s = 1) {
    group(x, y, s, Math.sin(api.clock * 0.4) * 0.02, () => {
      shape('M -12 0 L -7 -250 L 8 -250 L 18 0 Z', look('#5b5033', '#caa477'));
      for (let j = 0; j < 7; j++) {
        const a = -Math.PI + (j * Math.PI) / 6;
        const xx = Math.cos(a) * 125, yy = -230 + Math.sin(a) * 78;
        shape(`M 0 -245 Q ${xx * 0.45} ${yy - 45} ${xx} ${yy} Q ${xx * 0.6} ${yy + 8} 0 -238`, look('#737844', '#729870'));
      }
    });
  }

  // ---- characters -------------------------------------------------------------
  function egg(x, y, s, t, cracked = false) {
    group(x, y, s, Math.sin(t * 9) * 0.035, () => {
      const d = 'M -47 0 C -70 -37 -43 -128 0 -132 C 44 -132 72 -36 47 0 C 23 26 -25 28 -47 0 Z';
      shape(d, look('#e4c174', '#f7eed3'));
      hatch(d, '#c5a256');
      for (let i = 0; i < 9; i++) ellipse((hash(i + 5) - 0.5) * 65, -20 - hash(i + 44) * 80, 3 + hash(i) * 3, 2, look('#ba924d', '#c9a366'));
      if (cracked) line('M -51 -48 L -28 -57 L -14 -43 L 4 -66 L 18 -43 L 39 -59 L 57 -45', look(P.dark, P.ink), 3);
    });
  }
  // One leg swinging on a sine: phase drives the walk cycle.
  function leg(x, y, phase, color) {
    group(x, y, 1, Math.sin(phase) * 0.34, () => shape('M -13 -10 Q -27 15 -15 45 L -17 73 L 11 73 Q 19 68 10 63 L 3 62 L 10 26 L 17 0 Z', color));
  }
  function theropod(x, y, s, t, color = P.teal, lookTurn = 0) {
    group(x, y + Math.abs(Math.sin(t * 5)) * 5, s, 0, () => {
      const col = look(P.dark, color);
      leg(-25, -57, t * 5 + Math.PI, look('#453d29', '#d0a45a'));
      const body = 'M -94 -111 Q -144 -99 -220 -141 Q -182 -85 -105 -77 Q -68 -30 -3 -61 Q 25 -84 28 -123 L 49 -166 Q 91 -159 105 -177 Q 110 -201 81 -211 Q 47 -224 26 -206 Q 5 -178 -8 -160 Q -44 -141 -94 -111 Z';
      shape(body, col); hatch(body, color);
      group(34, -190, 1, lookTurn, () => {
        ellipse(33, -3, 5.3, 6.3, look('#e7d79d', '#fff8e5')); ellipse(34, -3, 2.4, 3, P.ink);
        line('M 63 10 Q 47 19 27 11', look('#c6ad6e', P.ink), 1.8);
        if (api.pencil) shape('M 32 17 l 5 7 l 4 -7 l 5 7 l 4 -8', P.paper);
      });
      shape('M -4 -128 Q 7 -104 28 -107 L 38 -116 L 28 -103 Q 11 -88 -8 -113', col);
      leg(-52, -57, t * 5, col);
      if (api.pencil) for (let j = 0; j < 8; j++) ellipse(-92 + j * 13, -99 - Math.sin(j * 0.3) * 18, 6, 3, P.rust);
    });
  }
  function longneck(x, y, s, t) {
    group(x, y, s, 0, () => {
      const col = look('#494932', '#73a48b');
      for (let j = 0; j < 2; j++) group(-50 + j * 120, -60, 1, Math.sin(t * 2 + j) * 0.11, () => shape('M -20 0 L -21 99 L 14 99 L 16 8 Z', look('#606047', '#cab975')));
      const d = 'M -110 -120 Q -169 -103 -249 -155 Q -208 -97 -129 -85 Q -99 -44 56 -65 Q 112 -94 113 -181 L 106 -308 Q 108 -334 145 -332 Q 173 -336 166 -357 Q 135 -373 111 -355 Q 66 -339 74 -288 L 75 -193 Q 64 -146 30 -143 Q -48 -169 -110 -120 Z';
      shape(d, col); hatch(d, P.teal);
      for (let j = 0; j < 2; j++) group(-78 + j * 124, -65, 1, Math.sin(t * 2 + j + Math.PI) * 0.12, () => shape('M -19 0 L -15 107 L 19 107 L 12 2 Z', col));
      ellipse(147, -350, 3.7, 4, P.ink); line('M 167 -343 L 145 -339', P.ink, 1.5);
      if (api.pencil) for (let j = 0; j < 6; j++) line(`M ${-110 + j * 26} -131 q -10 22 5 34`, P.teal, 5);
    });
  }
  function triceratops(x, y, s, t) {
    group(x, y, s, 0, () => {
      const col = look('#48412b', '#dda744');
      for (let j = 0; j < 4; j++) leg(-80 + j * 46, -44, t * 3 + j, col);
      shape('M -125 -110 L -191 -141 L -147 -82 Q -94 -29 15 -56 Q 63 -37 92 -69 L 128 -68 L 150 -88 L 129 -96 L 123 -130 Q 86 -164 40 -143 Q -72 -167 -125 -110 Z', col);
      shape('M 42 -91 Q -4 -147 16 -174 Q 53 -208 83 -174 Q 100 -143 80 -114 Z', look('#675b39', '#e2bc62'));
      shape('M 95 -136 L 92 -218 L 112 -143 M 118 -121 L 142 -188 L 135 -114', look('#cfb16d', '#f5eacb'));
      ellipse(109, -112, 4, 4, P.ink); line('M 132 -86 L 119 -82', P.ink, 1.5);
    });
  }
  function bird(x, y, s, t, perched = false) {
    group(x, y, s, Math.sin(t * 2) * 0.08, () => {
      shape('M -36 -10 Q -22 -30 8 -21 Q 10 -42 31 -39 Q 52 -36 43 -15 Q 31 12 5 12 Q -16 18 -36 -10 L -70 -28 L -53 4 Z', look(P.dark, '#c67a3e'));
      shape('M 43 -29 L 66 -21 L 42 -17 Z', look('#b89849', '#e3b34e'));
      ellipse(33, -29, 3, 3, look('#ead89d', P.ink));
      group(-9, -8, 1, perched ? -0.1 : Math.sin(t * 12) * 0.85, () => shape('M 0 0 Q -29 -35 -38 -82 Q 1 -63 24 -20 Q 23 -1 0 0 Z', look('#393a2d', '#729890')));
      if (perched) line('M 0 12 L -2 31 L -14 33 M 16 10 L 16 29 L 29 31', look(P.dark, P.ink), 2.5);
    });
  }
  function dragonfly(x, y, s, t) {
    group(x, y, s, Math.sin(t * 2) * 0.15, () => {
      for (let k = 0; k < 4; k++) {
        group(0, 0, 1, (k < 2 ? -1 : 1) * (0.5 + Math.sin(t * 42) * 0.14), () => ellipse(k % 2 ? 22 : -22, -12, 30, 9, look('#ccbd82', '#f4edcf'), look(null, P.ink)));
      }
      ellipse(0, 0, 36, 5, look(P.dark, '#d2a551'), look(null, P.ink));
      ellipse(29, -3, 9, 9, look(P.dark, '#dca958'), look(null, P.ink));
    });
  }

  // ---- landscape: runs every frame, changes smoothly ----------------------------
  function landscape(t) {
    // Impact winter: 0 by day, 1 at full dark. Drives sky, hills, sun and ash together.
    const night = smooth((t - (B.winter - 0.5)) / 1.2) * (1 - smooth((t - (B.survivors - 0.5)) / 2.5));
    api.c.fillStyle = look(mixColor('#deb785', '#d8bc61', smooth((t - (B.giants - 0.6)) / 1.2)), P.paper);
    api.c.fillRect(0, 0, api.W, api.H);
    if (!api.pencil) { api.c.fillStyle = `rgba(26,25,32,${night * 0.96})`; api.c.fillRect(0, 0, api.W, api.H); }
    fade(1 - night * 0.9, () => sun(702, 140, 37));
    if (!api.pencil) {
      shape('M 0 637 Q 140 612 267 648 T 545 631 T 866 648 L 866 822 L 0 822 Z', mixColor('#7b7848', '#393335', night));
      shape('M 0 710 Q 230 660 475 716 T 866 701 L 866 822 L 0 822 Z', mixColor('#595b36', '#302c2a', night));
    } else {
      line('M 22 700 Q 178 697 311 701 T 585 699 T 842 702', P.ink, 1.8);
    }
    // Hatch-beat seedlings hand over to the forest, which goes in the impact flash.
    const seedlings = 1 - smooth((t - (B.giants - 0.5)) / 1);
    fade(seedlings, () => { fern(743, 701, 0.55); fern(146, 700, 0.36); });
    const forest = smooth((t - (B.giants - 1)) / 2) * (1 - smooth((t - (B.winter - 0.6)) / 0.8));
    fade(forest, () => {
      tree(98, 698, 0.95); tree(791, 699, 0.72); fern(183, 701, 0.95); fern(751, 705, 1.05); fern(33, 704, 0.75);
    });
    // Falling ash, a pure function of time since the impact.
    const ash = t >= B.winter ? smooth((t - B.winter) / 0.4) * (1 - smooth((t - (B.survivors + 0.2)) / 0.8)) : 0;
    fade(ash, () => {
      for (let i = 0; i < 48; i++) {
        const xx = hash(i) * api.W, yy = (hash(i + 90) * api.H + (t - B.winter) * (25 + hash(i + 5) * 40)) % api.H;
        ellipse(xx, yy, 1 + hash(i) * 2, 3, look('#969084', '#726d69'));
      }
    });
    if (t > B.survivors) {
      const growth = smooth((t - B.survivors) / 4);
      for (let i = 0; i < 8; i++) fern(45 + i * 111, 705, growth * (0.5 + hash(i + 2) * 0.8));
    }
  }

  // ---- beats: u = seconds since the beat started, t = absolute time ------------
  const beats = {
    hatch(u, t) {
      const hatchAt = 2.8, reveal = smooth((u - hatchAt) / 1.1);
      if (u < 3.9) egg(430, 683, 1.4 * (1 - reveal * 0.4), u, u > 1.5);
      if (u > hatchAt) {
        theropod(430 + smooth((u - 4) / 3) * 80, 664, 0.12 + reveal * 0.7, u, P.ochre);
        if (u < 5) group(430, 680, 1.2, 0, () => shape('M -57 -49 L -30 -59 L -14 -43 L 4 -60 L 20 -43 L 42 -55 L 59 -45 Q 60 20 0 20 Q -55 20 -57 -49', look('#dfba70', '#f4e4bf')));
      }
      dragonfly(170 + u * 41, 350 + Math.sin(u * 2) * 30, 0.75, t);
    },
    giants(u, t) {
      longneck(330 + u * 13, 645, 0.98, u);
      longneck(695 + Math.sin(u * 0.3) * 10, 656, 0.52, u + 2);
      dragonfly(670 - u * 29, 272 + Math.sin(u) * 23, 0.7, t);
    },
    meeting(u, t) {
      theropod(258 + smooth(u / 3) * 80, 656, 1.04, u, P.teal);
      // Negative x scale mirrors the triceratops so it faces the predator.
      group(650 - smooth(u / 3) * 35, 664, -0.91, 0, () => { api.c.scale(1, -1); triceratops(0, 0, 1, u); });
      dragonfly(140 + u * 72, 221 + Math.sin(t) * 18, 0.62, t);
    },
    visitor(u, t) {
      theropod(370 - u * 10, 668, 0.92, t, P.teal);
      const k = smooth(u / 3.5), xx = mix(890, 330, k), yy = mix(-60, 630, k);
      group(xx, yy, 1, -0.6, () => {
        shape('M 0 0 L 75 -178 L 34 -24 L 100 -112 L 44 14 Z', look('#ebc56b', '#e7ba4e'));
        ellipse(0, 0, 27 + u * 3, 31 + u * 3, look('#aa5934', '#b8633b'), look(null, P.ink));
      });
    },
    winter(u) {
      // Ballistic burst: every particle position is a closed-form function of u.
      if (u >= 0 && u < 2.4) {
        fade(1 - clamp(u / 2.4), () => {
          ellipse(360, 643, 60 + u * 360, 45 + u * 180, look('#e6ca80', '#d4af61'));
          for (let i = 0; i < 32; i++) {
            const a = hash(i) * Math.PI * 2, v = 100 + hash(i + 8) * 260;
            ellipse(360 + Math.cos(a) * v * u, 643 + Math.sin(a) * v * u + u * u * 65, 3 + hash(i + 4) * 9, 4, look('#e4b35c', P.ink));
          }
        });
      }
      shape('M 300 702 L 330 665 L 387 676 L 409 701 Z', look('#222322', '#b4aea1'));
      shape('M 539 702 L 559 686 L 601 700 Z', look('#222322', '#b4aea1'));
    },
    survivors(u, t) {
      const lift = smooth((u - 2) / 4);
      bird(420 + lift * 170, 655 - lift * 355, 1.1, u, u < 2);
      if (u > 4) {
        for (let i = 0; i < 5; i++) {
          const tt = u - 4 - i * 0.18;
          if (tt > 0) bird(-90 + tt * 155 - i * 36, 360 - i * 43 + Math.sin(tt) * 14, 0.32 + hash(i) * 0.18, t + i);
        }
      }
    },
    today(u, t) {
      bird(530 + u * 105, 310 - u * 33, 0.85, t);
      egg(430, 685, 1.35, t * 0.35);
    },
  };

  return { landscape, beats };
};
