// The seven scenes of an ai-lab-launch film, hung on the voice. Layout and motion live here;
// every word, label, image set and anchor comes from ../config.json (see PLAYBOOK.md, "Mapping a product").
//   1 "This is <name>"        collage drifts out as the name types, then the category line replaces it
//   2 "made for <value>"      full-bleed images on 16th notes into the drop, line typed in white
//   3 the drop                glass prompt bar types, result card switches on every 16th with a rolling chip
//   4 "<input> ... gets you"  tiles fly into a 3x3 grid around the card, then open into a ring; an optional chart climbs in the card
//   5 "the more ..."          two typed lines, the stressed word in the brand gradient, an optional counting glass pill
//   6 the settings            glass panel of 3 sliders; the picture shifts hue, rolls seeds, turns poster
//   7 "Every <output> ..."    120 images burst behind a glass pill, then collapse into the logo
import {
  S, W, H, XA, clamp, lerp, eSine, eOut3, eIn3, eInOut3, eOutExpo, fade, tq, rng, rr, canvas, font, hexA, mix,
  posterize, shadow, caption, typedText, drawCaption, setCameras, zoomAt, camera, glass, aura, card, cover, slashMark,
  setScenes, boot,
} from './engine.js';

let CAP, T, C, SIX, IMG, SC, TILES, COLLAGE, BURST;
const set = (name) => IMG[name];

function build() {
  ({ CAP, T, C, SIX, IMG } = S);
  SC = S.cfg.scenes;
  IMG.poster = set(SC.settings.set).map((im) => posterize(im));
  const r = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const cap = (key, color, extra = {}) => {
    const [[a, b], weight, size, stretch] = S.cfg.captions[key];
    return caption(r(a, b), { weight, size, stretch: stretch || 'normal', color, ...extra });
  };
  Object.assign(CAP, {
    name: cap('name', C.ink), category: cap('category', C.ink), made: cap('made', '#fff'),
    verb: cap('verb', C.ink), input: cap('input', C.ink), getsyou: cap('getsyou', C.ink),
    more1: cap('more1', C.ink3), more2: cap('more2', C.ink),
    every: cap('every', C.ink), wordmark: cap('wordmark', C.ink), tagline: cap('tagline', C.ink3),
  });
  CAP.prompt = typedText(SC.prompt.text, T.drop + 0.1, 0.065, { weight: 600, size: 38, stretch: 'normal', color: C.ink });

  setCameras([[0, T.s2], [T.s2, T.drop], [T.drop, T.s4], [T.s4, T.s5, 'handoff'], [T.s5, T.s6], [T.s6, T.s7], [T.s7, T.end]]);
  buildCollage(); buildBurst(); buildTiles();
  setScenes([
    { a: 0, b: T.s2, draw: scene1 }, { a: T.s2, b: T.drop, draw: scene2 }, { a: T.drop, b: T.s5, draw: scene34, out: 'through' },
    { a: T.s5, b: T.s6, draw: scene5, out: 'through' }, { a: T.s6, b: T.s7, draw: scene6, out: 'through' }, { a: T.s7, b: T.end + 1, draw: scene7 },
  ]);
}

// ---------------------------------------------------------------- scene 1: "This is <name>"
function buildCollage() {
  const r = rng(7), ims = set(SC.collage.set), n = SC.collage.count;
  COLLAGE = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.25;
    return { im: ims[i % ims.length], a, rad: 500 + (r() - 0.5) * 140, size: 118 + r() * 70, rot: (r() - 0.5) * 0.16, d: r() * 0.25, spin: (r() - 0.5) * 0.08 };
  });
}
function scene1(L, t) {
  const z = zoomAt(0, t), ctx = L.ctx;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  camera(ctx, z);
  const out = eIn3((t - (T.s2 - 2.5)) / 2.85);   // the collage drifts out past the frame, timed to leave just after the cut to scene 2
  for (const c of COLLAGE) {
    const rad = c.rad * (1 + 0.07 * (t / 3) + 1.15 * out);
    const a = c.a + 0.04 * t;
    const alpha = fade(t, c.d, 0.45) * (1 - fade(t, T.s2 - 0.2 + c.d * 0.5, 0.45));   // the last cards are still leaving as scene 2 flashes in: never a blank page
    card(ctx, c.im, W / 2 + Math.cos(a) * rad, H / 2 + Math.sin(a) * rad * 0.92, c.size, { alpha, rot: c.rot + c.spin * t });
  }
  const cat = CAP.category.tFirst;
  const nameA = 1 - fade(t, cat - 0.36, 0.32);   // gone before the category line types in its place
  drawCaption(ctx, CAP.name, t, W / 2, H / 2 + 36 - 18 * eSine((t - cat + 0.36) / 0.32), { alpha: nameA, caretHold: 9 });
  drawCaption(ctx, CAP.category, t, W / 2, H / 2 + 27, { alpha: 1 - fade(t, T.s2 - XA - 0.3, 0.3), caretHold: 9 });   // gone exactly as the crossfade starts, so it never shares the page with "made for"
}

// ---------------------------------------------------------------- scene 2: "made for <value>", full-bleed 16ths
function heroIndex(t) { return Math.floor((tq(t) - T.drop) / SIX); }
function scene2(L, t) {
  const z = zoomAt(1, t), ctx = L.ctx, hero = set(SC.hero.set);
  const k = heroIndex(t);
  const im = hero[((k % hero.length) + hero.length) % hero.length];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  cover(ctx, im, z * 1.02);
  const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1000);
  v.addColorStop(0, 'rgba(8,10,18,0.30)'); v.addColorStop(1, 'rgba(8,10,18,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  camera(ctx, z);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 30;
  drawCaption(ctx, CAP.made, t, W / 2, H / 2 + 30);
  ctx.restore();
}

// ---------------------------------------------------------------- scenes 3 and 4: the drop, then the input
const tile = (i) => { const [t, n, c] = SC.tiles[i % SC.tiles.length]; return { t, n, c }; };
function buildTiles() {
  // The 3x3 grid around the result card; the centre cell is the card itself.
  const r = rng(11), cell = 300, gap = 26, CY = 770;
  const order = [0, 1, 2, 3, 5, 6, 7, 8];
  TILES = order.map((cellIdx, i) => {
    const gx = (cellIdx % 3) - 1, gy = Math.floor(cellIdx / 3) - 1;
    const ang = Math.atan2(gy, gx) + (r() - 0.5) * 0.4;
    const ringA = Math.atan2(gy, gx) + Math.PI / 8;   // the ring slot nearest the tile's own cell, one half-slot round: no two paths cross
    return {
      q: tile(i), col: SC.tile_colors[i % SC.tile_colors.length], gx: W / 2 + gx * (cell + gap), gy: CY + gy * (cell + gap),
      fromX: W / 2 + Math.cos(ang) * 1300, fromY: CY + Math.sin(ang) * 1300,
      rx: W / 2 + Math.cos(ringA) * 520, ry: CY + Math.sin(ringA) * 445, d: i * 0.06, bob: r() * 6.28,
    };
  });
}
function drawTile(ctx, tl, cx, cy, size, alpha) {
  if (alpha <= 0.001) return;
  const q = tl.q, s = size, x = cx - s / 2, y = cy - s / 2;
  ctx.save(); ctx.globalAlpha *= alpha;
  shadow(ctx, cx, cy + 6, s * 0.62, s * 0.62, 0.8);
  ctx.save(); rr(ctx, x, y, s, s, s * 0.1); ctx.clip();
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y, s, s);
  const tint = ctx.createRadialGradient(x + s * 0.2, y + s * 0.15, 0, x + s * 0.2, y + s * 0.15, s * 1.1);
  tint.addColorStop(0, hexA(tl.col, 0.26)); tint.addColorStop(0.6, hexA(tl.col, 0.07)); tint.addColorStop(1, hexA(tl.col, 0));
  ctx.fillStyle = tint; ctx.fillRect(x, y, s, s);
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = C.inkA(0.07); rr(ctx, x, y, s, s, s * 0.1); ctx.stroke();
  const mr = s * 0.15, mx = x + s * 0.11 + mr, my = y + s * 0.11 + mr;
  ctx.fillStyle = tl.col; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  font(ctx, 800, s * 0.13, 'expanded'); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(q.t[0], mx, my + s * 0.006);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  font(ctx, 800, s * 0.145, 'expanded'); ctx.fillStyle = C.ink;
  ctx.fillText(q.t, x + s * 0.11, y + s * 0.75);
  font(ctx, 500, s * 0.075); ctx.fillStyle = C.ink2;
  ctx.fillText(q.n, x + s * 0.11, y + s * 0.88);
  font(ctx, 600, s * 0.062); const tw = ctx.measureText(q.c).width;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rr(ctx, x + s * 0.89 - tw - s * 0.1, y + s * 0.13, tw + s * 0.1, s * 0.12, s * 0.06); ctx.fill();
  ctx.fillStyle = C.ink2; ctx.fillText(q.c, x + s * 0.89 - tw - s * 0.05, y + s * 0.213);
  ctx.restore();
}
// Which result image and label the card shows: both switch on every 16th once the card is up,
// until the spoken input word picks one (config scenes.result.pick_tile).
const CARD_IN = () => T.drop + 0.42;
function cardStep(t) { return stepAt(tq(t)); }
function stepAt(t) {
  const first = Math.ceil((CARD_IN() + 0.12 - T.drop) / SIX);
  const k = Math.floor((t - T.drop) / SIX);
  if (t >= T.pick) return -1;
  return Math.max(0, k - first + 1);
}
function scene34(L, t) {
  const ctx = L.ctx, bctx = L.bctx, res = set(SC.result.set), pick = SC.result.pick_tile;
  const z = t < T.s4 ? zoomAt(2, t) : zoomAt(3, t);
  const toPair = eInOut3((t - T.s4) / 0.62);         // card moves to the centre of the grid
  const toRing = eInOut3((t - T.s4b) / 0.72);        // grid opens into a ring
  const barA = fade(t, T.drop - XA, 0.4) * (1 - fade(t, T.s4 - 0.05, 0.32));
  // background: white page with the aura behind the prompt bar
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, W, H);
  camera(bctx, z);
  aura(bctx, t, W / 2, 404, 1.0, barA);
  aura(bctx, t + 3, W / 2, 770, 1.5, 0.55 * fade(t, T.s4b - 0.1, 0.6));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.bg, 0, 0);
  camera(ctx, z);

  // tiles first, so they fly in under the captions and the bar: fly into the grid, then open into a ring
  for (const tl of TILES) {
    const fly = eOut3((t - T.s4 - 0.12 - tl.d) / 0.62);
    const a = fade(t, T.s4 + 0.1 + tl.d, 0.32);
    let x = lerp(tl.fromX, tl.gx, fly), y = lerp(tl.fromY, tl.gy, fly), s = 300;
    x = lerp(x, tl.rx, toRing); y = lerp(y, tl.ry, toRing); s = lerp(s, 222, toRing);
    y += Math.sin(t * 1.3 + tl.bob) * 5 * toRing;
    drawTile(ctx, tl, x, y, s, a);
  }

  // caption over the bar, then the scene 4 captions; each line is gone before the next types in its place
  drawCaption(ctx, CAP.verb, t, W / 2, 300, { alpha: 1 - fade(t, T.s4 - 0.1, 0.3), caretHold: 9 });
  drawCaption(ctx, CAP.input, t, W / 2, 150, { alpha: 1 - fade(t, CAP.getsyou.tFirst - 0.36, 0.32), caretHold: 9 });
  drawCaption(ctx, CAP.getsyou, t, W / 2, 150);

  // prompt bar
  const by = 360 - 16 * (1 - barA);
  glass(ctx, L.bg, W / 2 - 390, by, 780, 92, 46, { alpha: barA, z });
  camera(ctx, z);
  if (barA > 0.001) {
    ctx.save(); ctx.globalAlpha = barA;
    const ix = W / 2 - 390 + 22, iy = by + 18;
    ctx.save(); rr(ctx, ix, iy, 56, 56, 28); ctx.clip(); ctx.drawImage(set(SC.prompt.set)[0], ix, iy, 56, 56); ctx.restore();
    if (t < CAP.prompt.tFirst) { font(ctx, 500, 38); ctx.fillStyle = C.ink3; ctx.globalAlpha = barA * 0.7; ctx.fillText(SC.prompt.placeholder, ix + 76, by + 59); ctx.globalAlpha = barA; }
    drawCaption(ctx, CAP.prompt, t, ix + 76, by + 59, { align: 'left', alpha: barA, caretHold: 9 });
    ctx.fillStyle = C.cobalt; ctx.beginPath(); ctx.arc(W / 2 + 390 - 46, by + 46, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ax = W / 2 + 390 - 46, ay = by + 46;
    ctx.beginPath(); ctx.moveTo(ax, ay + 11); ctx.lineTo(ax, ay - 11); ctx.moveTo(ax - 9, ay - 2); ctx.lineTo(ax, ay - 11); ctx.lineTo(ax + 9, ay - 2); ctx.stroke();
    ctx.restore();
  }

  // the result card
  const cin = fade(t, CARD_IN(), 0.36);
  const cs = lerp(lerp(560, 300, toPair), 440, toRing);
  const cx = W / 2, cy = lerp(500 + 280 + 18 * (1 - cin), 770, toPair);
  const step = cardStep(t);
  const resIm = step < 0 ? res[0] : res[step % res.length];
  const label = step < 0 ? tile(pick) : tile(step);
  card(ctx, resIm, cx, cy, cs * (0.97 + 0.03 * cin), { alpha: cin, r: 0.07 });
  if (cin > 0.001) {
    ctx.save(); ctx.globalAlpha = cin;
    rr(ctx, cx - cs / 2, cy - cs / 2, cs, cs, cs * 0.07); ctx.clip();
    const g = ctx.createLinearGradient(0, cy + cs * 0.1, 0, cy + cs / 2);
    g.addColorStop(0, 'rgba(10,12,20,0)'); g.addColorStop(1, 'rgba(10,12,20,0.62)');
    ctx.fillStyle = g; ctx.fillRect(cx - cs / 2, cy, cs, cs / 2);
    // Once the chart's anchor word is spoken (config scenes.chart: "trades"), a small price chart climbs inside the card:
    // the pair is live and moving. No chart when scenes.chart is absent.
    const ch = SC.chart, chartT = ch && T[ch.anchor];
    const chartA = chartT ? fade(t, chartT - 0.15, 0.3) * toRing : 0;
    if (chartA > 0.001) {
      const n = ch.bars || 9, left = cx - cs / 2 + cs * 0.1, right = cx + cs / 2 - cs * 0.1, base = cy + cs * 0.26, bw = ((right - left) / n) * 0.52;
      const jit = (i) => ((i * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < n; i++) {
        const grow = eOut3((t - chartT + 0.1 - i * 0.06) / 0.5);
        const h = (0.1 + 0.075 * i + 0.05 * jit(i)) * cs * grow, wick = 0.07 * cs * grow;
        const x = left + ((right - left) * (i + 0.24)) / n;
        ctx.globalAlpha = cin * chartA;
        ctx.fillStyle = C.cobalt; rr(ctx, x, base - h, bw, h, bw * 0.3); ctx.fill();
        ctx.fillStyle = C.peri; rr(ctx, x + bw / 2 - 2, base - h - wick, 4, wick, 2); ctx.fill();
      }
      ctx.globalAlpha = cin;
    }
    // The label side of the mark rolls to each new name.
    const tr = tq(t), roll = step < 0 ? eOut3((tr - T.pick) / 0.09) : eOut3(((tr - T.drop) / SIX - Math.floor((tr - T.drop) / SIX)) / 0.75);
    const prev = step < 0 ? tile(stepAt(T.pick - 0.001)) : tile(Math.max(0, step - 1));
    const size = cs * 0.085, px = cx - cs / 2 + cs * 0.07, py = cy + cs / 2 - cs * 0.075;
    slashMark(ctx, SC.result.base, (c, qx, qy) => {
      c.save(); c.beginPath(); c.rect(qx - 4, qy - size * 1.05, cs, size * 1.35); c.clip();
      if (step !== 0) { c.globalAlpha *= 1 - roll; c.fillText(prev.t, qx, qy - size * 1.1 * roll); c.globalAlpha = cin * 0.72 * roll; }
      c.fillText(label.t, qx, qy + size * 1.1 * (1 - (step === 0 ? 1 : roll)));
      c.restore();
    }, px, py, size);
    ctx.restore();
  }

  // the black chip under the card, and the thumbnail strip
  const chipA = cin * (1 - fade(t, T.s4 - 0.05, 0.3));
  if (chipA > 0.001) {
    ctx.save(); ctx.globalAlpha = chipA;
    font(ctx, 600, 28);
    const text = SC.result.chip_prefix + label.t;
    const tw = ctx.measureText(SC.result.chip_prefix + tile(pick).t).width + 56;
    const chy = cy + cs / 2 + 34;
    ctx.fillStyle = C.ink; rr(ctx, W / 2 - tw / 2, chy, tw, 54, 27); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, chy + 37);
    ctx.textAlign = 'left';
    const n = Math.min(9, res.length), ts = 62, gap = 14, sx = W / 2 - (n * ts + (n - 1) * gap) / 2, sy = chy + 92;
    const cur = step < 0 ? 0 : step % res.length;
    for (let i = 0; i < n; i++) {
      const on = i === cur % n;
      const s = on ? ts * 1.12 : ts;
      ctx.globalAlpha = chipA * (on ? 1 : 0.42);
      ctx.save(); rr(ctx, sx + i * (ts + gap) + (ts - s) / 2, sy + (ts - s) / 2, s, s, 12); ctx.clip();
      ctx.drawImage(res[i], sx + i * (ts + gap) + (ts - s) / 2, sy + (ts - s) / 2, s, s); ctx.restore();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- scene 5: "The more ..., the MORE ..."
function scene5(L, t) {
  const z = zoomAt(4, t), ctx = L.ctx, bctx = L.bctx;
  // a glass pill under the two lines counts a number up once its anchor word is spoken (config scenes.pill: anchor, text with
  // {value}, from, to, decimals, duration); none when scenes.pill is absent. The aura behind it makes the glass read.
  const pill = SC.pill, pillT = pill && T[pill.anchor];
  const pillA = pillT ? fade(t, pillT - 0.05, 0.4) : 0;
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, W, H);
  camera(bctx, z);
  aura(bctx, t + 5, W / 2, 960, 0.9, 0.7 * pillA);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.bg, 0, 0);
  camera(ctx, z);
  drawCaption(ctx, CAP.more1, t, W / 2, 618, { caretHold: CAP.more2.tFirst - CAP.more1.tLast - 0.05 });
  drawCaption(ctx, CAP.more2, t, W / 2, 790, { caretHold: 9 });
  if (pillA > 0.001) {
    const pw = 620, ph = 84, px = W / 2 - pw / 2, py = 930 + 14 * (1 - pillA);
    glass(ctx, L.bg, px, py, pw, ph, 42, { alpha: pillA, z });
    camera(ctx, z);
    const count = eOut3((tq(t) - pillT) / (pill.duration || 0.6));   // reads the frame's centre time, so the blur never shows two values
    const value = lerp(pill.from || 0, pill.to, count).toFixed(pill.decimals || 0);
    ctx.save(); ctx.globalAlpha = pillA; font(ctx, 600, 32); ctx.textAlign = 'center';
    ctx.fillStyle = C.ink2; ctx.fillText(pill.text.replace('{value}', value), W / 2, py + 54);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- scene 6: the settings
// A slider shows a number (scale, decimals, suffix) or, with `stops`, the label its position has reached: a choice, not a quantity.
const sliders = () => SC.settings.sliders.map((s) => ({
  ...s, t: T[s.anchor],
  val: (v) => (s.stops ? s.stops[Math.min(s.stops.length - 1, Math.round(v * (s.stops.length - 1)))] : `${(v * s.scale).toFixed(s.decimals)}${s.suffix}`),
}));
function picState(t) {
  const n = set(SC.settings.set).length;
  // the shift takes the short way round the wheel: a hue of 350 is a 10 degree turn, not a 350 degree tour through green and purple
  const turn = ((SC.settings.hue % 360) + 540) % 360 - 180;
  const hue = turn * eInOut3((t - T.set1) / 0.9);
  let im = 0;
  const tt = t;
  t = tq(t);
  if (t >= T.set2) im = 1 + Math.max(0, Math.floor((t - T.set2) / SIX)) % (n - 1);
  if (t >= T.set3) im = 1 + Math.floor((T.set3 - T.set2) / SIX - 1e-9) % (n - 1);
  const poster = fade(tt, T.set3, 0.4);
  return { hue, im, poster };
}
let WASH;
function scene6(L, t) {
  const z = zoomAt(5, t), ctx = L.ctx, bctx = L.bctx, pics = set(SC.settings.set);
  const ps = picState(t);
  const filt = `hue-rotate(${ps.hue.toFixed(2)}deg)`;
  // background: white, the aura, and a blurred wash of the picture's own colours
  if (!WASH) WASH = canvas(360, 360);
  const wx = WASH.getContext('2d');
  wx.setTransform(1, 0, 0, 1, 0, 0); wx.clearRect(0, 0, 360, 360);
  wx.filter = `${filt} blur(22px) saturate(1.3)`;
  wx.drawImage(pics[ps.im], 40, 40, 280, 280);
  if (ps.poster > 0) { wx.globalAlpha = ps.poster; wx.drawImage(IMG.poster[ps.im], 40, 40, 280, 280); wx.globalAlpha = 1; }
  wx.filter = 'none';
  wx.globalCompositeOperation = 'destination-in';
  const m = wx.createRadialGradient(180, 180, 40, 180, 180, 175);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  wx.fillStyle = m; wx.fillRect(0, 0, 360, 360);
  wx.globalCompositeOperation = 'source-over';
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, W, H);
  camera(bctx, z);
  aura(bctx, t, W / 2, H / 2, 1.6, 0.9);
  bctx.globalAlpha = 0.62; bctx.drawImage(WASH, W / 2 - 1000, H / 2 - 1000, 2000, 2000); bctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.bg, 0, 0);
  camera(ctx, z);
  // The aura arrives with the crossfade; the panel and picture rise in once the last scene's words have cleared.
  const enter = fade(t, T.s6 + 0.02, 0.4);
  const px = 148, py = 430 + 22 * (1 - enter), pw = 520, ph = 580, qx = 712, qs = 580;
  card(ctx, pics[ps.im], qx + qs / 2, py + qs / 2, qs, { r: 0.06, filter: filt, alpha: enter });
  if (ps.poster > 0) card(ctx, IMG.poster[ps.im], qx + qs / 2, py + qs / 2, qs, { r: 0.06, filter: filt, alpha: ps.poster * enter, shadowA: 0 });
  glass(ctx, L.bg, px, py, pw, ph, 38, { z, alpha: enter });
  camera(ctx, z);
  ctx.save();
  ctx.globalAlpha = enter;
  font(ctx, 600, 20); ctx.letterSpacing = '3px'; ctx.fillStyle = C.ink2; ctx.fillText(SC.settings.header, px + 44, py + 72);
  ctx.letterSpacing = '0px';
  const SL = sliders();
  SL.forEach((s, i) => {
    const y = py + 172 + i * 140;
    const move = eInOut3((t - s.t) / 0.75);
    const v = lerp(s.from, s.to, move);
    const on = fade(t, s.t - 0.05, 0.3) * (i === SL.length - 1 ? 1 : 1 - fade(t, SL[i + 1].t - 0.05, 0.3));
    font(ctx, 600, 34); ctx.fillStyle = mix(C.ink3, C.ink, on); ctx.fillText(s.label, px + 44, y);
    font(ctx, 500, 26); ctx.fillStyle = mix(C.ink3, C.ink2, on); ctx.textAlign = 'right'; ctx.fillText(s.val(v), px + pw - 44, y); ctx.textAlign = 'left';
    const tx = px + 44, tw = pw - 88, ty = y + 40;
    ctx.fillStyle = C.inkA(0.12); rr(ctx, tx, ty - 4, tw, 8, 4); ctx.fill();
    ctx.fillStyle = mix(C.rail, C.cobalt, on); rr(ctx, tx, ty - 4, tw * v, 8, 4); ctx.fill();
    shadow(ctx, tx + tw * v, ty + 3, 22, 22, 0.7);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx + tw * v, ty, 17, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = mix(C.ring, C.cobalt, on); ctx.stroke();
  });
  ctx.restore();
}

// ---------------------------------------------------------------- scene 7: every output, then the logo
function buildBurst() {
  const r = rng(23), ims = set(SC.burst.set), n = SC.burst.count;
  BURST = Array.from({ length: n }, (_, i) => {
    const f = Math.sqrt((i + 0.5) / n);
    const a = i * 2.39996 + (r() - 0.5) * 0.3;
    const rad = (150 + 820 * f) * (0.92 + r() * 0.16);
    return { im: ims[(i + SC.burst.offset) % ims.length], a, rad, size: lerp(178, 118, f) * (0.85 + r() * 0.3), rot: (r() - 0.5) * 0.08, d: f * 0.38, back: (1 - f) * 0.18 };
  });
}
function scene7(L, t) {
  const z = zoomAt(6, t), ctx = L.ctx, bctx = L.bctx;
  const collapse = (b) => eIn3((t - T.logo + 0.42 - b.back) / 0.5);
  bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, W, H);
  camera(bctx, z);
  aura(bctx, t, W / 2, H / 2, 1.25, fade(t, T.s7 - XA, 0.5) * (1 - fade(t, T.logo - 0.4, 0.5)));
  for (let i = BURST.length - 1; i >= 0; i--) {
    const b = BURST[i];
    const out = eOutExpo((t - T.s7 + 0.05 - b.d) / 0.95);
    const col = collapse(b);
    const rad = b.rad * out * (1 + 0.05 * (t - T.s7)) * (1 - col);
    const a = b.a + 0.05 * (t - T.s7);
    const alpha = fade(t, T.s7 - 0.05 + b.d, 0.3) * (1 - fade(t, T.logo - 0.22 - b.back, 0.32));
    card(bctx, b.im, W / 2 + Math.cos(a) * rad, H / 2 + Math.sin(a) * rad, b.size * lerp(0.35, 1, out) * (1 - 0.75 * col), { alpha, rot: b.rot * out, r: 0.1 });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.bg, 0, 0);
  // glass caption pill
  const pillA = fade(t, T.s7 - XA, 0.4) * (1 - fade(t, T.logo - 0.42, 0.32));
  const pw = CAP.every.width + 120;
  glass(ctx, L.bg, W / 2 - pw / 2, H / 2 - 50, pw, 100, 50, { alpha: pillA, z, milk: 0.58 });
  camera(ctx, z);
  drawCaption(ctx, CAP.every, t, W / 2, H / 2 + 16, { alpha: pillA, caretHold: 9 });
  // the logo, the name and the tagline
  const la = fade(t, T.logo - 0.12, 0.45, eOut3);
  if (la > 0.001) {
    const lh = S.cfg.brand.logo_height * lerp(0.9, 1, la), lw = lh * IMG.logo.width / IMG.logo.height;
    ctx.save(); ctx.globalAlpha = la;
    ctx.drawImage(IMG.logo, W / 2 - lw / 2, 585 - lh / 2 + 12 * (1 - la), lw, lh);
    ctx.restore();
  }
  drawCaption(ctx, CAP.wordmark, t, W / 2, 822, { caretHold: CAP.tagline.tFirst - CAP.wordmark.tLast - 0.05 });
  drawCaption(ctx, CAP.tagline, t, W / 2, 912, { caretHold: 0.9 });
  // the address under the closing line, once it has been read (config product.domain; nothing when it is empty)
  const domain = S.cfg.product.domain, da = domain ? fade(t, CAP.tagline.tLast + 0.25, 0.45) : 0;
  if (da > 0.001) {
    ctx.save(); ctx.globalAlpha = da; font(ctx, 500, 30); ctx.letterSpacing = '1px'; ctx.textAlign = 'center';
    ctx.fillStyle = C.ink3; ctx.fillText(domain, W / 2, 978 + 8 * (1 - da)); ctx.restore();
  }
}

// ---------------------------------------------------------------- sound events, from the same timeline
function events() {
  const ev = [];
  const keys = (cap) => cap.chars.filter((m) => m.ch !== ' ').forEach((m) => ev.push({ t: m.t, k: 'key' }));
  Object.values(CAP).forEach(keys);
  for (let k = heroIndex(T.s2) + 1; T.drop + k * SIX < T.drop; k++) ev.push({ t: T.drop + k * SIX, k: 'click' });
  for (let s = 1; ; s++) { const tt = T.drop + (Math.ceil((CARD_IN() + 0.12 - T.drop) / SIX) + s - 1) * SIX; if (tt >= T.pick) break; ev.push({ t: tt, k: 'click' }); }
  ev.push({ t: T.pick, k: 'click' });
  for (let k = 1; T.set2 + k * SIX < T.set3; k++) ev.push({ t: T.set2 + k * SIX, k: 'click' });
  ev.push({ t: T.set2, k: 'click' });
  for (const cap of Object.values(CAP)) {   // a soft landing on the last letter of every stressed (gradient) word
    const grad = cap.chars.filter((m) => m.grad);
    if (grad.length) ev.push({ t: grad[grad.length - 1].t + 0.03, k: 'land' });
  }
  ev.push({ t: T.drop, k: 'impact_drop' }, { t: T.drop, k: 'riser_peak' });
  ev.push({ t: 1.0, k: 'whoosh_2' }, { t: T.s4 + 0.4, k: 'whoosh_1' }, { t: T.s4b + 0.3, k: 'whoosh_2' }, { t: T.s7 + 0.25, k: 'whoosh_1' });
  ev.push({ t: T.logo + 0.3, k: 'impact_logo' });
  return ev.sort((a, b) => a.t - b.t);
}

boot(build, events);
