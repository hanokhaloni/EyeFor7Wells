// boot-intro — the title sequence ("the day before the night").
//
// A performance cut on beats, not a loading screen. Everything is authored into a
// millisecond timeline (BEATS + CUES) that `update()` walks on wall-clock time
// (`now - t0`); nothing animates by CSS transition. One canvas layer, flat fills
// only: no vignette, no gradients, no grain (the global grain is switched off for
// the intro and restored on exit).
//
// The spine:  a horizon slab wipes the dark  ->  a sun slams up over the Negev,
// then slams again past the frame  ->  seven marks are struck into hot sand  ->
// the marks fall open into seven holes, and one hole punches out to fill the frame
// ->  a 7 at frame height  ->  7 WELLS  ->  באר שבע, glossed WELL / SEVEN, each word
// slammed full-frame  ->  a drop lands on the 7 and fills it green  ->  the camera
// falls into the 7, a black mouth opens out of it and covers the frame  ->  hard cut
// to the night surface.
//
// Palette: the day beats keep their sand / rust; every dark beat is the site's warm
// ink ground, and the mouths (holes, the ending) are the site's mouth black. No navy.

const EASE = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outBack: (t) => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2),
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
// 0..1 ramp between two absolute times inside a beat
const seg = (t, a, b) => clamp01((t - a) / Math.max(1, b - a));

// hex colour mix, for the mark -> hole morph (a solid colour, not a gradient)
function mix(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',') + ')';
}

const F_DISPLAY = "'Anton', 'Arial Narrow', Impact, sans-serif";
const F_HE = "'Heebo', 'Arial Hebrew', sans-serif";
const F_MONO = "'IBM Plex Mono', monospace";
const FONT_TIMEOUT = 1200;

// The intro's palette, fixed here so a token rework elsewhere cannot repaint it.
// Night family (shared with the surface): ground, wadi, mouth, bone.
// Day beats (the intro only): sand, rust. The water green lives only in the 7.
const COL = {
  ground: '#1B1410',  // warm ink: every dark beat
  wadi:   '#5A3418',  // dark ochre: the opening slab
  mouth:  '#060403',  // holes, and the black mouth that ends the intro
  bone:   '#F2EDE2',
  sand:   '#E8873A',  // day sand
  rust:   '#B8341F',  // day ground
  water:  '#3BE8B0',
};

// ---------------------------------------------------------------- scene state
let S = null;

const FULL = [
  { at: 0,    name: 'survey', dur: 700 },   // ground/wadi/bone  — the horizon slab wipes the frame
  { at: 700,  name: 'sun',    dur: 850 },   // ground/rust/sand  — the sun slams up, twice
  { at: 1550, name: 'seven',  dur: 1150 },  // sand/rust/bone    — seven marks struck
  { at: 2700, name: 'holes',  dur: 680 },   // sand/mouth/bone   — the marks fall open; one punches out
  { at: 3380, name: 'big7',   dur: 350 },   // ground/bone       — a 7 at frame height
  { at: 3730, name: 'title',  dur: 400 },   // ground/bone/sand  — 7 WELLS + באר שבע
  { at: 4130, name: 'word',   dur: 900 },   // ground/bone/sand  — the gloss: WELL / SEVEN slams
  { at: 5030, name: 'water',  dur: 450 },   // ground/bone/water — the drop fills the 7
  { at: 5480, name: 'down',   dur: 800 },   // ground -> mouth   — the fall into the 7
];
const STAMP_T0 = 110, STAMP_GAP = 72, STAMP_DUR = 120;
// sun: rise, then the second hit (the disc slams past both frame edges)
const SUN_HIT = 430;
// holes: the marks fall open, then hole 05 punches out to fill the frame
const HOLE_MORPH = [30, 360], PUNCH = [440, 620], PUNCH_HOLE = 4;
// word: the gloss slams each word full-frame, then the card returns lit
const GLOSS_HIT1 = 200, GLOSS_HIT2 = 380, GLOSS_BACK = 560;
const SHORT = [
  { at: 0,    name: 'word',  dur: 720 },
  { at: 720,  name: 'water', dur: 300 },
  { at: 1020, name: 'down',  dur: 600 },
];
const STILL = [{ name: 'word', at: 0, dur: 1500 }];
// a cue more than this late (ms) is skipped instead of fired
const CUE_LATE = 400;
// a frame gap longer than this (ms) is a freeze (debugger, stall), not elapsed time;
// shorter gaps count in full unless the tab was hidden during them
const MAX_GAP = 1000;

// Fit a single line of text to a width: returns the font px size.
function fitSize(c, text, font, size, maxW) {
  c.font = font(size);
  const w = c.measureText(text).width;
  return w > maxW ? size * (maxW / w) : size;
}

// Glyph metrics at 100px with the 'middle' baseline (fallbacks if metrics are missing).
function metrics(c, text, font) {
  c.font = font;
  c.textBaseline = 'middle';
  const m = c.measureText(text);
  return {
    w: m.width,
    a: m.actualBoundingBoxAscent || 36,
    d: m.actualBoundingBoxDescent || 36,
  };
}

// A point deep inside the 7's stem (offset from the glyph's left / middle-baseline
// origin) and the stem's width there. The drop lands on it, and the camera falls
// into it at the end, so it must be inside the ink, whatever the face renders.
const STEM_CACHE = new Map();
function stemPoint(size) {
  const key = Math.round(size);
  if (STEM_CACHE.has(key)) return STEM_CACHE.get(key);
  let res = null;
  try {
    const k = Math.min(1, 320 / size);
    const s = size * k;
    const cv = document.createElement('canvas');
    let c = cv.getContext('2d', { willReadFrequently: true });
    c.font = s + 'px ' + F_DISPLAY;
    c.textBaseline = 'middle';
    const m = c.measureText('7');
    const a = m.actualBoundingBoxAscent || s * 0.36, d = m.actualBoundingBoxDescent || s * 0.36;
    cv.width = Math.ceil(m.width + 8);
    cv.height = Math.ceil(a + d + 8);
    c = cv.getContext('2d', { willReadFrequently: true });
    c.font = s + 'px ' + F_DISPLAY;
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText('7', 4, 4 + a);
    const img = c.getImageData(0, 0, cv.width, cv.height).data;
    const on = (x, y) => img[(y * cv.width + x) * 4 + 3] > 140;
    let best = null;
    for (const fr of [0.62, 0.7, 0.78, 0.86]) {
      const y = Math.round(4 + (a + d) * fr);
      let x = 0;
      while (x < cv.width) {
        if (on(x, y)) {
          let x1 = x;
          while (x1 < cv.width && on(x1, y)) x1++;
          if (!best || x1 - x > best.run) best = { run: x1 - x, cx: (x + x1) / 2, cy: y };
          x = x1;
        } else x++;
      }
    }
    if (best && best.run > 2) res = { dx: (best.cx - 4) / k, dy: (best.cy - 4 - a) / k, run: best.run / k };
  } catch {}
  if (!res) res = { dx: size * 0.2, dy: size * 0.25, run: size * 0.12 };
  STEM_CACHE.set(key, res);
  return res;
}

// =============================================================== layout
// Wide frames: 7 and WELLS side by side, the Hebrew under them.
// Tall frames (phone): stacked — a big 7, WELLS across the width, then the Hebrew,
// so the card fills the height instead of a third of it.
function layout(c) {
  const { W, H } = S;
  const U = Math.min(W, H);
  const tall = H > W * 1.25;
  const m7 = metrics(c, '7', '100px ' + F_DISPLAY);
  const mw = metrics(c, 'WELLS', '100px ' + F_DISPLAY);
  const L = { U, tall };

  if (!tall) {
    // the 7 at 100, WELLS at 40, gap 9
    const tot = m7.w + 9 + mw.w * 0.4;
    const f = Math.min((W * 0.88) / tot, (H * 0.4) / (m7.a + m7.d));
    L.s7 = 100 * f; L.sw = 40 * f;
    L.w7 = m7.w * f; L.ww = mw.w * 0.4 * f;
    L.a7 = m7.a * f; L.d7 = m7.d * f;
    L.aw = mw.a * 0.4 * f; L.dw = mw.d * 0.4 * f;
    L.x7 = (W - tot * f) / 2;
    L.xw = L.x7 + L.w7 + 9 * f;
  } else {
    const f = Math.min((H * 0.31) / (m7.a + m7.d), (W * 0.62) / m7.w);
    const fw = (W * 0.86) / mw.w;
    L.s7 = 100 * f; L.sw = 100 * fw;
    L.w7 = m7.w * f; L.ww = mw.w * fw;
    L.a7 = m7.a * f; L.d7 = m7.d * f;
    L.aw = mw.a * fw; L.dw = mw.d * fw;
    L.x7 = (W - L.w7) / 2;
    L.xw = (W - L.ww) / 2;
  }

  // Hebrew row, fitted
  let sh = tall ? L.sw * 0.62 : L.s7 * 0.27;
  c.font = '900 ' + sh + 'px ' + F_HE;
  let wSheva = c.measureText('שבע').width, wBeer = c.measureText('באר').width;
  let hgap = sh * 0.38;
  const hf = Math.min(1, (W * (tall ? 0.84 : 0.88)) / (wSheva + hgap + wBeer));
  sh *= hf; wSheva *= hf; wBeer *= hf; hgap *= hf;
  Object.assign(L, { sh, wSheva, wBeer, hgap });

  L.lab = Math.max(12, U * (tall ? 0.036 : 0.032));
  L.len = Math.max(14, U * 0.05);
  L.vgap = (tall ? L.sw : L.s7) * 0.07;
  const glossH = L.sh * 0.6 + L.len + L.lab * 1.8;

  if (!tall) {
    const cardH = L.a7 + L.d7 + L.vgap + L.sh + glossH;
    L.y7 = (H - cardH) / 2 + L.a7 - H * 0.02;
    L.yw = L.y7;
    L.hy = L.y7 + L.d7 + L.vgap + L.sh * 0.5;
  } else {
    const g1 = H * 0.04;
    const cardH = L.a7 + L.d7 + g1 + L.aw + L.dw + L.vgap * 1.4 + L.sh + glossH;
    L.y7 = (H - cardH) / 2 + L.a7 - H * 0.03;
    L.yw = L.y7 + L.d7 + g1 + L.aw;
    L.hy = L.yw + L.dw + L.vgap * 1.4 + L.sh * 0.5;
  }
  L.stem = stemPoint(L.s7);
  return L;
}

// =============================================================== drawing parts

// The assembled title card. Every late beat renders through this one function.
// o.drain (0..1): the black mouth opening inside the green 7, scaled about the stem.
function drawCard(c, o) {
  const { W, H } = S;
  const L = S.lay;
  const bone = COL.bone;
  c.textBaseline = 'middle';
  c.textAlign = 'left';

  const a = EASE.outQuint(clamp01(o.titleIn / 0.62));
  const b = EASE.outQuint(clamp01((o.titleIn - 0.22) / 0.62));

  // the hero numeral
  const x7 = L.x7 + (1 - a) * -W * 0.9;
  const ty = L.y7;
  c.font = L.s7 + 'px ' + F_DISPLAY;
  c.fillStyle = bone;
  c.fillText('7', x7, ty);
  // geometry of the 7, for the drop and the mouth
  S.geo = {
    x: x7, w: L.w7, top: ty - L.a7, bot: ty + L.d7, ty,
    px: x7 + L.stem.dx, py: ty + L.stem.dy, run: L.stem.run,
  };
  if (o.water > 0) {
    // the drop has landed: the 7 fills with water from the bottom up
    const top = ty - L.a7, bot = ty + L.d7;
    const y = lerp(bot, top - 2, o.water);
    c.save();
    c.beginPath();
    c.rect(x7 - L.s7 * 0.1, y, L.w7 + L.s7 * 0.2, bot - y + L.s7 * 0.1);
    c.clip();
    c.fillStyle = COL.water;
    c.fillText('7', x7, ty);
    c.restore();
  }
  if (o.drain > 0) {
    // the mouth opens out of the 7: a black 7 grows from the stem point
    const G = S.geo;
    c.save();
    c.translate(G.px, G.py);
    c.scale(o.drain, o.drain);
    c.translate(-G.px, -G.py);
    c.fillStyle = COL.mouth;
    c.fillText('7', x7, ty);
    c.restore();
  }

  const xw = L.xw + (1 - b) * W * 0.95;
  c.font = L.sw + 'px ' + F_DISPLAY;
  c.fillStyle = bone;
  c.fillText('WELLS', xw, L.yw);
  // sand rule riding under the word
  c.fillStyle = COL.sand;
  c.fillRect(xw, L.yw + L.dw + L.U * 0.012, L.ww * b, Math.max(3, L.U * 0.008));

  // ---- באר שבע -------------------------------------------------------------
  if (o.hebIn > 0) {
    const e = EASE.outQuint(o.hebIn);
    const hy = L.hy;
    const dy = (1 - e) * H * 0.42;
    c.font = '900 ' + L.sh + 'px ' + F_HE;
    // visual (left-to-right) order of "באר שבע" is שבע then באר
    const hx0 = (W - (L.wSheva + L.hgap + L.wBeer)) / 2;
    c.fillStyle = bone;
    c.textAlign = 'left';
    c.fillText('שבע', hx0, hy + dy);
    c.fillText('באר', hx0 + L.wSheva + L.hgap, hy + dy);

    // ---- the gloss: this is the whole idea ---------------------------------
    if (o.glossIn > 0) {
      const g = EASE.outCubic(o.glossIn);
      const top = hy + dy + L.sh * 0.6;
      const pairs = [
        [hx0 + L.wSheva / 2, 'SEVEN'],
        [hx0 + L.wSheva + L.hgap + L.wBeer / 2, 'WELL'],
      ];
      c.fillStyle = COL.sand;
      c.textAlign = 'center';
      c.font = '600 ' + Math.round(L.lab) + 'px ' + F_MONO;
      try { c.letterSpacing = '0.22em'; } catch {}
      for (const [px, label] of pairs) {
        c.fillRect(px - Math.max(1, L.U * 0.002), top, Math.max(2, L.U * 0.004), L.len * g);
        if (g > 0.75) c.fillText(label, px, top + L.len + L.lab * 1.05);
      }
      try { c.letterSpacing = '0px'; } catch {}
    }
  }

  // ---- who this is: one small bone line in the clear band above the card -----
  if (o.glossIn > 0) {
    const txt = "INDIE GAME DEVS · BE'ER SHEVA";
    try { c.letterSpacing = '0.3em'; } catch {}
    const fs = fitSize(c, txt, (s) => '500 ' + s + 'px ' + F_MONO, Math.max(11, L.U * 0.017), W * 0.86);
    c.font = '500 ' + fs + 'px ' + F_MONO;
    c.save();
    c.globalAlpha = EASE.outCubic(clamp01(o.glossIn));
    c.fillStyle = bone;
    c.textAlign = 'center';
    const cardTop = L.y7 - L.a7;
    c.fillText(txt, W / 2, Math.max(fs * 2, Math.min(cardTop * 0.5, cardTop - fs * 2.5)));
    c.restore();
    try { c.letterSpacing = '0px'; } catch {}
  }

  // ---- survey footer -------------------------------------------------------
  if (o.labelIn > 0) {
    const txt = "BE'ER SHEVA · NEGEV · 31°15'N 34°47'E";
    try { c.letterSpacing = '0.3em'; } catch {}
    const fs = fitSize(c, txt, (s) => '500 ' + s + 'px ' + F_MONO, Math.max(10, L.U * 0.0145), W * 0.9);
    c.font = '500 ' + fs + 'px ' + F_MONO;
    c.fillStyle = bone;
    c.textAlign = 'center';
    const n = Math.round(txt.length * clamp01(o.labelIn));
    c.fillText(txt.slice(0, n), W / 2, H - Math.max(58, L.U * 0.07));
    try { c.letterSpacing = '0px'; } catch {}
  }
}

// A full-frame slammed word: the second hit of the gloss.
function drawSlam(c, word, bg, ink) {
  const { W, H } = S;
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  const size = fitSize(c, word, (s) => s + 'px ' + F_DISPLAY, H * 0.9, W * 0.96);
  c.font = size + 'px ' + F_DISPLAY;
  c.fillStyle = ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(word, W / 2, H / 2 + size * 0.02);
}

// The 7 alone, at frame height: the hit before WELLS lands.
function drawBig7(c, t) {
  const { W, H } = S;
  c.fillStyle = COL.ground;
  c.fillRect(0, 0, W, H);
  const m = metrics(c, '7', '100px ' + F_DISPLAY);
  const f = Math.min((H * 0.9) / (m.a + m.d), (W * 0.9) / m.w);
  const k = lerp(1.22, 1, EASE.outQuint(seg(t, 0, 140)));   // the slam overshoot
  const h = (m.a + m.d) * f, w = m.w * f;
  c.save();
  c.translate(W / 2, H / 2);
  c.scale(k, k);
  c.font = 100 * f + 'px ' + F_DISPLAY;
  c.fillStyle = COL.bone;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('7', -w / 2, -h / 2 + m.a * f);
  c.restore();
}

// One of the seven: a struck mark that later falls open into a hole.
function drawMark(c, i, appear, morph, opt) {
  const { W, H, marks } = S;
  const U = Math.min(W, H);
  const tall = H > W;
  const D = Math.max(W, H * 0.7); // hole scale: big enough to read on a phone
  const m = marks[i];
  const from = opt.from, to = opt.to, ink = opt.ink, rim = opt.rim;
  const mo = EASE.inOutCubic(morph);
  const ap = EASE.outQuint(clamp01(appear));
  if (ap <= 0) return;

  // Struck bars: spaced wider and stood nearly upright on a tall frame, so no two
  // bars ever touch (their tilt over the bar height was what closed the gaps).
  const sx = 0.5 + (i - 3) * (tall ? 0.13 : 0.118);
  const barH = Math.min(H * 0.46, W * 0.62);
  const rotK = Math.min(1, (W / H) / 1.2);

  const cx = lerp(W * sx, W * m.hx, mo);
  const cy = lerp(H * 0.5, H * m.hy, mo);
  const bw = lerp(W * (tall ? 0.048 : 0.05), D * m.r * 2.0, mo);
  const bh = lerp(barH, D * m.r * 1.5, mo);
  const rad = lerp(Math.max(1, W * 0.004), Math.min(bw, bh) / 2, mo);
  const k = lerp(tall ? 1.15 : 1.32, 1, ap); // the strike overshoot

  c.save();
  c.translate(cx, cy);
  c.rotate(m.rot * rotK * (1 - mo));
  c.scale(k, lerp(1.5, 1, ap));
  c.fillStyle = from === to ? from : mix(from, to, clamp01(mo * 1.25));
  c.beginPath();
  if (c.roundRect) c.roundRect(-bw / 2, -bh / 2, bw, bh, rad);
  else c.rect(-bw / 2, -bh / 2, bw, bh);
  c.fill();
  if (rim && mo > 0.35) {
    c.strokeStyle = rim;
    c.lineWidth = Math.max(2, U * 0.006);
    c.stroke();
  }
  c.restore();

  // the index, surveyed
  if (ap > 0.6) {
    c.fillStyle = ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '600 ' + Math.round(Math.max(11, U * 0.022)) + 'px ' + F_MONO;
    c.fillText('0' + (i + 1), cx, cy + bh * 0.5 + Math.max(14, U * 0.04));
  }
}

// Skip ink per beat: bone on the dark and rust frames, ink on the light ones.
function skipInk(name, t) {
  switch (name) {
    case 'seven': return t < 200 ? 'ink' : 'bone';     // the rust wedge has crossed the corner
    case 'holes': return t < PUNCH[0] + 120 ? 'ink' : 'bone';
    case 'word':  return S.mode === 'full' && t >= GLOSS_HIT1 && t < GLOSS_BACK ? 'ink' : 'bone';
    default: return 'bone';
  }
}

// =============================================================== the beat render
function render() {
  const { L0, W, H } = S;
  const c = L0.ctx2d;
  c.globalAlpha = 1;
  c.textBaseline = 'middle';

  if (!S.started) {
    c.fillStyle = COL.ground;
    c.fillRect(0, 0, W, H);
    return;
  }
  S.lay = layout(c);
  const U = S.lay.U;

  const beat = S.beat;
  const t = S.T - beat.at;         // ms inside this beat
  const p = clamp01(t / beat.dur); // 0..1
  const still = S.mode === 'still';
  const full = S.mode === 'full';
  const horizon = H * 0.62;

  const ink = skipInk(beat.name, t);
  if (ink !== S.skipInk) {
    S.skipInk = ink;
    try { S.skip.style.color = ink === 'ink' ? COL.ground : COL.bone; } catch {}
  }

  switch (beat.name) {
    // ------------------------------------- the horizon slab wipes the dark
    case 'survey': {
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      // the wadi slab and its bone lip wipe the full width by 260ms
      const g = EASE.outQuint(seg(t, 0, 260));
      const edge = W * g;
      c.fillStyle = COL.wadi;
      c.fillRect(0, horizon, edge, H - horizon);
      const lip = Math.max(6, U * 0.014);
      c.fillStyle = COL.bone;
      c.fillRect(0, horizon - lip, edge, lip);
      // seven survey posts, struck on the line where the marks will land
      const tall = H > W;
      c.textAlign = 'center';
      c.font = '600 ' + Math.round(Math.max(12, U * 0.026)) + 'px ' + F_MONO;
      for (let i = 0; i < 7; i++) {
        const x = W * (0.5 + (i - 3) * (tall ? 0.13 : 0.118));
        const a0 = 230 + i * 45;
        const e = EASE.outQuint(seg(t, a0, a0 + 90));
        if (e <= 0) continue;
        const ph = U * 0.13 * e;
        const pw = Math.max(4, U * 0.009);
        c.fillStyle = COL.bone;
        c.fillRect(x - pw / 2, horizon - lip - ph, pw, ph);
        if (e > 0.7) c.fillText('0' + (i + 1), x, horizon - lip - U * 0.13 - U * 0.035);
      }
      if (t > 300) {
        c.textAlign = 'left';
        c.fillStyle = COL.sand;
        const txt = "31°15'N  34°47'E";
        const n = Math.round(txt.length * seg(t, 300, 560));
        c.font = '600 ' + Math.round(Math.max(13, U * 0.03)) + 'px ' + F_MONO;
        try { c.letterSpacing = '0.3em'; } catch {}
        c.fillText(txt.slice(0, n), W * 0.055, horizon + U * 0.1);
        try { c.letterSpacing = '0px'; } catch {}
      }
      break;
    }

    // ------------------------------------------- the sun slams, then slams again
    case 'sun': {
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      const hit = t >= SUN_HIT;
      // second hit: the horizon jumps and the disc blows past both frame edges
      const hz = hit ? H * 0.7 : horizon;
      let R, cy;
      if (!hit) {
        const rise = EASE.outBack(seg(t, 0, 360));
        R = Math.max(H * 0.6, W * 0.32);
        cy = hz + R - (R * 1.5) * rise;
      } else {
        // wider than the frame, top still on screen: the curve reads, the edges crop
        const k = EASE.outQuint(seg(t, SUN_HIT, SUN_HIT + 160));
        R = Math.max(W * 0.75, H * 0.45) * lerp(0.92, 1, k);
        cy = H * 0.1 + R;
      }
      c.fillStyle = COL.sand;
      c.beginPath();
      c.arc(W * 0.5, cy, R, 0, Math.PI * 2);
      c.fill();
      // hot ground swallows the lower part of the disc
      c.fillStyle = COL.rust;
      c.fillRect(0, hz, W, H - hz);
      c.fillStyle = COL.bone;
      c.fillRect(0, hz - 1, W, Math.max(3, U * 0.004));
      // heat bands struck onto the ground one by one, after the second hit
      if (hit) {
        c.fillStyle = COL.sand;
        const n = Math.min(4, Math.floor((t - SUN_HIT - 40) / 60) + 1);
        for (let i = 0; i < n; i++) {
          const y = hz + (H - hz) * (0.16 + i * 0.2);
          const bw = W * (0.9 - i * 0.2);
          c.fillRect((W - bw) / 2, y, bw, Math.max(4, U * (0.016 - i * 0.003)));
        }
      }
      break;
    }

    // ------------------------------------------------ seven marks, hot sand
    case 'seven': {
      c.fillStyle = COL.sand;
      c.fillRect(0, 0, W, H);
      // one enormous rust wedge sweeping the whole frame
      const q = EASE.outQuint(seg(t, 0, 280));
      const ex = -W * 0.35 + W * 1.4 * q;   // stops short: a sand wedge survives bottom-right
      c.fillStyle = COL.rust;
      c.beginPath();
      c.moveTo(-W * 0.4, -H * 0.1);
      c.lineTo(ex, -H * 0.1);
      c.lineTo(ex - H * 0.62, H * 1.1);
      c.lineTo(-W * 0.4, H * 1.1);
      c.closePath();
      c.fill();
      const ms = { from: COL.bone, to: COL.mouth, ink: COL.bone, rim: null };
      for (let i = 0; i < 7; i++) {
        const a0 = STAMP_T0 + i * STAMP_GAP;
        drawMark(c, i, seg(t, a0, a0 + STAMP_DUR), 0, ms);
      }
      break;
    }

    // ------------------------- the marks fall open: 7 holes, and one punches out
    case 'holes': {
      c.fillStyle = COL.sand;
      c.fillRect(0, 0, W, H);
      const mo = seg(t, HOLE_MORPH[0], HOLE_MORPH[1]);
      const mh = { from: COL.bone, to: COL.mouth, ink: COL.mouth, rim: COL.bone };
      for (let i = 0; i < 7; i++) if (i !== PUNCH_HOLE || t < PUNCH[0]) drawMark(c, i, 1, mo, mh);
      if (t >= PUNCH[0]) {
        // the second hit: hole 05 slams open past every edge of the frame
        const m = S.marks[PUNCH_HOLE];
        const D = Math.max(W, H * 0.7);
        const k = EASE.outCubic(seg(t, PUNCH[0], PUNCH[1]));
        const diag = Math.hypot(W, H);
        const cx = lerp(W * m.hx, W * 0.5, k), cy = lerp(H * m.hy, H * 0.5, k);
        const rx = lerp(D * m.r, diag * 0.62, k);
        const ry = rx * lerp(0.75, 1, k);
        c.fillStyle = COL.mouth;
        c.beginPath();
        c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = COL.bone;
        c.lineWidth = Math.max(3, U * lerp(0.006, 0.05, k));
        c.stroke();
        if (k >= 0.999) { c.fillRect(0, 0, W, H); }
      }
      break;
    }

    // ------------------------------------------- a 7 at frame height
    case 'big7': {
      drawBig7(c, t);
      break;
    }

    // -------------------------------------------------------------- 7 WELLS
    case 'title': {
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      drawCard(c, {
        titleIn: 0.4 + 0.6 * seg(t, 0, 260),   // the 7 is already home; WELLS slams in
        hebIn: seg(t, 120, 340),
        glossIn: 0, labelIn: 0, water: 0, drain: 0,
      });
      break;
    }

    // ------------------------------------- באר שבע : the name IS the place
    case 'word': {
      // the second hit: WELL, then SEVEN, slammed at full frame (Hebrew reading order)
      if (full && t >= GLOSS_HIT1 && t < GLOSS_HIT2) { drawSlam(c, 'WELL', COL.sand, COL.mouth); break; }
      if (full && t >= GLOSS_HIT2 && t < GLOSS_BACK) { drawSlam(c, 'SEVEN', COL.bone, COL.mouth); break; }
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      const d = beat.dur;
      drawCard(c, {
        titleIn: still || full ? 1 : seg(t, 0, 320),
        hebIn: still || full ? 1 : seg(t, d * 0.1, d * 0.1 + 260),
        glossIn: still ? 1 : full ? seg(t, 0, 180) : seg(t, d * 0.4, d * 0.4 + 240),
        labelIn: still ? 1 : full ? seg(t, GLOSS_BACK, GLOSS_BACK + 240) : seg(t, d * 0.6, d * 0.6 + 240),
        water: 0, drain: 0,
      });
      break;
    }

    // ------------------------------------------- the drop lands on the 7
    case 'water': {
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      const land = beat.dur * 0.42;
      const fill = EASE.outCubic(seg(t, land, beat.dur * 0.9));
      drawCard(c, S.card(fill));
      const G = S.geo;
      const dx = G.px;                // the stem of the 7
      const hitY = G.bot;
      const fall = EASE.inCubic(seg(t, 0, land));
      c.fillStyle = COL.water;
      if (fall < 1) {
        const y = lerp(-U * 0.06, hitY, fall);
        const r = Math.max(5, U * 0.016);
        const ry = r * (1 + fall * 1.6);
        c.fillRect(dx - r * 0.35, y - ry * 6, r * 0.7, ry * 6);
        c.beginPath();
        c.ellipse(dx, y, r, ry, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        // flat splash ring at the foot of the 7
        const r = EASE.outQuint(seg(t, land, beat.dur));
        const lw = Math.max(1, U * 0.012 * (1 - r));
        if (lw > 1) {
          c.strokeStyle = COL.water;
          c.lineWidth = lw;
          c.beginPath();
          c.ellipse(dx, hitY, U * 0.35 * r + 4, (U * 0.35 * r + 4) * 0.22, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
      break;
    }

    // ------------------- the fall into the 7: its black mouth covers the frame
    case 'down': {
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      const END_FILL = 0.84;
      if (p >= END_FILL) {
        // fully covered: mouth black, held to the hard cut (the surface's mouth colour)
        c.fillStyle = COL.mouth;
        c.fillRect(0, 0, W, H);
        break;
      }
      // anchor = the stem point of the finished card's 7
      drawCard(c, Object.assign(S.card(1), { drain: 0 }));  // sets S.geo
      const G = S.geo;
      const diag = Math.hypot(W, H);
      const zMax = (2.6 * diag) / Math.max(4, G.run);
      const z = Math.exp(Math.log(zMax) * EASE.inCubic(p / END_FILL));
      // the mouth: a black 7 opening inside the green one, closing its rim as we fall
      const drain = p < 0.2 ? 0.86 * EASE.outQuint(p / 0.2) : lerp(0.86, 1, clamp01((p - 0.2) / 0.45));
      c.fillStyle = COL.ground;
      c.fillRect(0, 0, W, H);
      c.save();
      c.translate(G.px, G.py);
      c.scale(z, z);
      c.translate(-G.px, -G.py);
      drawCard(c, Object.assign(S.card(1), { drain }));
      c.restore();
      break;
    }
  }
}

// ===================================================================== scene
export default {
  id: 'boot-intro',

  enter(ctx) {
    const fx = ctx.fx;
    const RM = !!fx.reducedMotion;
    const seen = !!ctx.store.get('intro.seen', false);
    const mode = RM ? 'still' : seen ? 'short' : 'full';
    const beats = RM ? STILL : seen ? SHORT : FULL;

    // Flat frames: no global grain while the intro plays (restored in exit), and
    // no CSS fade on this scene's root: the intro opens and closes on hard cuts.
    try { fx.grain(false); } catch {}
    try { ctx.root.style.animation = 'none'; ctx.root.style.background = COL.ground; } catch {}
    // A camera shake moves the whole stage; whatever is behind it must be the same
    // warm ink, never the page's own background. Restored on exit.
    let prevBg = null;
    try { prevBg = document.body.style.background; document.body.style.background = COL.ground; } catch {}

    const mk = (z) => {
      let L;
      try { L = fx.layer(ctx.root, z); } catch { L = fx.layer(z); }
      if (L && L.canvas && L.canvas.parentNode !== ctx.root) ctx.root.appendChild(L.canvas);
      return L;
    };
    const L0 = mk(1);

    // Hand-placed, not random: the field has to read as seven separate holes.
    // Sorted by x so each mark falls open to the right of the previous one and no
    // two marks cross on the way.
    const FIELD = [
      [0.155, 0.34, 0.042], [0.335, 0.72, 0.032], [0.470, 0.27, 0.036],
      [0.545, 0.85, 0.034], [0.630, 0.58, 0.045], [0.745, 0.29, 0.029],
      [0.880, 0.62, 0.039],
    ];
    const R = fx.rnd(0xbe7);
    const marks = FIELD.map((f) => ({
      hx: f[0], hy: f[1], r: f[2],
      rot: (R() - 0.5) * 0.2,
    }));

    S = {
      ctx, fx, RM, mode, beats, marks, L0, prevBg,
      T: 0,
      t0: 0,
      started: false,
      fontsReady: false,
      last: 0,
      done: false,
      beat: beats[0],
      bi: 0,
      offs: [],
      timers: [],
      skipInk: null,
      get W() { return L0.w || window.innerWidth; },
      get H() { return L0.h || window.innerHeight; },
      // the finished card, reused by water/down
      card: (water) => ({
        titleIn: 1, hebIn: 1, glossIn: 1, labelIn: 1,
        water: water === undefined ? 0 : clamp01(water),
        drain: 0,
      }),
    };

    // ---- the small skip: flat bone or ink (picked per beat), no blend mode ----
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'skip';
    skip.setAttribute('aria-label', 'skip intro');
    skip.style.cssText =
      'position:absolute;left:16px;bottom:14px;z-index:12;background:none;border:0;padding:8px;' +
      'color:' + COL.bone + ';font-family:var(--font-mono);font-weight:600;font-size:11px;letter-spacing:.3em;' +
      'text-transform:uppercase;opacity:1;cursor:pointer';
    ctx.root.appendChild(skip);
    S.skip = skip;

    const finish = () => {
      if (S.done) return;
      S.done = true;
      try { ctx.store.set('intro.seen', true); } catch {}
      // Hard cut into the hub: no cross-fade, so there is no frame of bare background
      // between the black mouth and the hub.
      try { ctx.go('surface', { from: 'boot-intro' }, { cut: true }); } catch (e) { console.warn('[intro] handoff', e); }
    };
    S.finish = finish;

    const bail = (e) => {
      if (S.done) return;
      if (e) { try { e.preventDefault(); } catch {} }
      finish();
    };
    S.bail = bail;

    // Any key skips — but never swallow a browser shortcut or Tab focus.
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // A key aimed at a control outside the intro (the #sound toggle, say) belongs
      // to that control: Enter / Space there must not skip.
      try {
        const el = e.target;
        if (el && el.closest && !ctx.root.contains(el) &&
            el.closest('button,a[href],input,select,textarea,[role="button"],[role="switch"],[contenteditable="true"]')) return;
      } catch {}
      if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      bail(e);
    };
    const onDown = (e) => bail(e);
    window.addEventListener('keydown', onKey, true);
    ctx.root.addEventListener('pointerdown', onDown);
    skip.addEventListener('click', onDown);
    S.offs.push(() => window.removeEventListener('keydown', onKey, true));
    S.offs.push(() => ctx.root.removeEventListener('pointerdown', onDown));

    // A hidden tab is a pause: note it so the gap spanning it is not counted.
    const onVis = () => { if (S && document.hidden) S.hid = true; };
    document.addEventListener('visibilitychange', onVis);
    S.offs.push(() => document.removeEventListener('visibilitychange', onVis));

    // ---- audio cues (silent when muted, which is the default) ---------------
    const A = ctx.audio;
    const B = Object.fromEntries(FULL.map((b) => [b.name, b.at]));
    const CUES = RM ? [] : mode === 'short' ? [
      { at: 10,   fn: () => A.tone(180, { dur: 0.5, type: 'triangle', gain: 0.12, slideTo: 300 }) },
      { at: 850,  fn: () => A.drip({ pitch: 1.1 }) },
      { at: 1020, fn: () => { A.thud({ gain: 0.5 }); A.tone(240, { dur: 0.6, type: 'sine', gain: 0.12, slideTo: 60 }); } },
    ] : [
      { at: 10,   fn: () => { A.thud({ gain: 0.3 }); A.tone(48, { dur: 0.9, type: 'sine', gain: 0.1, slideTo: 96 }); } },
      { at: B.sun, fn: () => { A.noise({ dur: 0.5, gain: 0.1, band: [300, 2600] }); A.tone(140, { dur: 0.5, type: 'triangle', gain: 0.1, slideTo: 300 }); } },
      { at: B.sun + SUN_HIT, fn: () => { A.thud({ gain: 0.4 }); A.noise({ dur: 0.3, gain: 0.12, band: [200, 1800] }); } },
      { at: B.seven, fn: () => A.noise({ dur: 0.25, gain: 0.14, band: [700, 5000] }) },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        at: B.seven + STAMP_T0 + i * STAMP_GAP,
        fn: () => { A.thud({ gain: 0.14 + i * 0.018 }); A.tone(200 + i * 42, { dur: 0.1, type: 'square', gain: 0.045 }); },
      })),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        at: B.holes + 50 + i * 45,
        fn: () => A.drip({ pitch: 1.5 - i * 0.12 }),
      })),
      { at: B.holes + PUNCH[0], fn: () => { A.thud({ gain: 0.55 }); A.noise({ dur: 0.35, gain: 0.1, band: [80, 900] }); } },
      { at: B.big7, fn: () => { A.thud({ gain: 0.5 }); A.tone(320, { dur: 0.3, type: 'triangle', gain: 0.1, slideTo: 160 }); } },
      { at: B.title, fn: () => { A.thud({ gain: 0.34 }); A.tone(196, { dur: 0.45, type: 'sine', gain: 0.1, slideTo: 262 }); } },
      { at: B.word + GLOSS_HIT1, fn: () => { A.thud({ gain: 0.45 }); A.tone(262, { dur: 0.16, type: 'square', gain: 0.05 }); } },
      { at: B.word + GLOSS_HIT2, fn: () => { A.thud({ gain: 0.5 }); A.tone(392, { dur: 0.16, type: 'square', gain: 0.05 }); } },
      { at: B.water + 190, fn: () => A.drip({ pitch: 1 }) },
      { at: B.down, fn: () => { A.thud({ gain: 0.6 }); A.tone(300, { dur: 0.85, type: 'sine', gain: 0.14, slideTo: 44 }); A.noise({ dur: 0.8, gain: 0.08, band: [80, 900] }); } },
    ];

    // ---- visual cues: hits (small: the stage edge must never show) -----------
    const VIS = RM ? [] : mode === 'short' ? [
      { at: 1020, fn: () => fx.shake(260, 5) },
    ] : [
      { at: B.sun + SUN_HIT, fn: () => fx.shake(200, 6) },
      ...[0, 2, 4, 6].map((i) => ({ at: B.seven + STAMP_T0 + i * STAMP_GAP, fn: () => fx.shake(70, 3) })),
      { at: B.holes + PUNCH[0], fn: () => fx.shake(200, 6) },
      { at: B.big7, fn: () => fx.shake(180, 6) },
      { at: B.word + GLOSS_HIT1, fn: () => fx.shake(110, 4) },
      { at: B.word + GLOSS_HIT2, fn: () => fx.shake(110, 5) },
    ];

    S.cues = [...CUES, ...VIS].sort((a, b) => a.at - b.at).map((q) => ({ ...q, fired: false }));
    S.END = beats[beats.length - 1].at + beats[beats.length - 1].dur + (RM ? 60 : 40);

    // Warm the module cache for the hand-off target while the intro plays.
    try { import('./surface.js').catch(() => {}); } catch {}

    // Fonts first: the clock (t0) does not start until Anton, Heebo and Plex Mono
    // are in, or FONT_TIMEOUT passes, so no beat ever draws in a fallback face.
    // The clock itself starts on the first rAF tick after this (see update), so a
    // background tab that loads the fonts while rAF is paused does not run the clock.
    const start = () => {
      if (!S || S.fontsReady) return;
      STEM_CACHE.clear();   // stem points measured before the face landed are wrong
      S.fontsReady = true;
    };
    try {
      if (document.fonts && document.fonts.load) {
        const loads = [
          document.fonts.load("64px 'Anton'", '7 WELLS SEVEN'),
          document.fonts.load("900 64px 'Heebo'", 'באר שבע'),
          document.fonts.load("600 16px 'IBM Plex Mono'", "0123456789 SEVEN°'"),
          document.fonts.load("500 16px 'IBM Plex Mono'", "INDIE GAME DEVS · BE'ER SHEVA 31°15'N"),
        ].map((pr) => pr.catch(() => {}));
        Promise.race([
          Promise.all(loads),
          new Promise((res) => S.timers.push(setTimeout(res, FONT_TIMEOUT))),
        ]).then(start, start);
      } else start();
    } catch { start(); }

    render();
  },

  update(dt, now) {
    if (!S || S.done) return;
    // The timeline follows wall-clock time, anchored at t0 (the first frame after
    // the fonts are in). `now` is the rAF timestamp (same clock as performance.now()).
    const t = typeof now === 'number' && isFinite(now) ? now : performance.now();
    if (!S.started) {
      if (!S.fontsReady || document.hidden) return;
      S.started = true;
      S.t0 = t;
      S.last = t;
    }
    // A pause (the tab was hidden during the gap, or a freeze longer than MAX_GAP)
    // does not advance the timeline: the intro resumes where it stopped. Any other
    // gap counts in full, so slow frames on a weak CPU still hand off on time.
    const gap = t - S.last;
    const hidden = S.hid || document.hidden;
    S.hid = false;
    if (hidden) S.t0 += gap;
    else if (gap > MAX_GAP) S.t0 += gap - 17;
    S.last = t;
    S.T = Math.max(S.T, t - S.t0);

    // A late cue still fires (slow frames), but a cue we have long overshot is
    // dropped rather than replayed in a burst of shakes and thuds.
    for (let i = 0; i < S.cues.length; i++) {
      const q = S.cues[i];
      if (!q.fired && S.T >= q.at) {
        q.fired = true;
        if (S.T - q.at <= CUE_LATE) { try { q.fn(); } catch {} }
      }
    }

    while (S.bi < S.beats.length - 1 && S.T >= S.beats[S.bi + 1].at) S.bi++;
    S.beat = S.beats[S.bi];

    if (S.T >= S.END) { S.finish(); return; }

    try { render(); } catch (e) { console.warn('[intro] render', e); }
  },

  resize() {
    if (!S || S.done) return;
    try { render(); } catch {}
  },

  exit() {
    if (!S) return;
    const s = S;
    S = null;
    try { s.fx.grain(true); } catch {}
    try { document.body.style.background = s.prevBg || ''; } catch {}
    try { s.offs.forEach((off) => off()); } catch {}
    try { s.timers.forEach((id) => clearTimeout(id)); } catch {}
    try { s.skip && s.skip.remove(); } catch {}
    try { s.L0 && s.L0.destroy && s.L0.destroy(); } catch {}
  },
};
