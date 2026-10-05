// THE SURFACE — the desert hub. Seven wells punched into the ground, seen from above, at night.
//
// Revision 4. Night, without the mud. The site night palette, all flat fills:
//   warm-ink ground · dark-ochre wadi (hard edge, no stroke) · sand ONLY where the lamp falls
//   and on lit lips · black mouths · bone type · orange for glints, focus and the seventh.
// Light is the event, the ground is the mystery. Every mouth keeps a thin moonlit sand lip on
// its far wall (always findable); the lamp lights the wall that faces it with a fat crescent and
// shows one orange glint deep down. Names are always on in full bone on black plates.
// Idle breathes in hard cuts: grit streaks, and a mouth that glints by itself now and then.
// The seventh is earned: three passes of the lamp (the `?` only points it there). Found, it is a square hole,
// black with an orange rim, and the find is saved.
//
// Layers (all inside ctx.root):
//   z1  canvas  the field (everything drawn flat, every frame — it is a handful of shapes);
//               the reticle is drawn here too, under the type
//   z70 DOM     hits: focusable buttons over each mouth+plate (keyboard, click, touch)
//   z72 DOM     ui: identity, entered-count pips, the `?` pip (after the wells in tab order)

import { WELLS } from '../data/wells.js';

/* ───────────────────────────── palette ───────────────────────────── */
const C = {
  ground: [27, 20, 16],    // #1B1410 warm ink night
  wadi: [90, 52, 24],      // #5A3418 dark ochre
  sand: [222, 166, 104],   // #DEA668 light: lamp + lit lips only
  ink: [6, 4, 3],          // #060403 mouths, plates, the drop
  bone: [242, 237, 226],   // #F2EDE2 type
  hot: [255, 92, 20],      // #FF5C14 glints, focus, the seventh
};
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const TAU = Math.PI * 2;
// the moon is up and to the left; its light lands on the far (lower-right) inner wall
const MOON = (() => { const x = -0.62, y = -0.78, d = Math.hypot(x, y); return [x / d, y / d]; })();

/* Hand-placed survey, in a safe frame. Landscape and portrait are composed separately. */
const LAND = {
  whatsapp: [0.10, 0.20], meetup: [0.42, 0.08], instagram: [0.86, 0.10],
  discord: [0.13, 0.68], youtube: [0.47, 0.62], facebook: [0.80, 0.60],
};
const PORT = {
  // a zigzag down the tall axis: every mouth on the left of its own name, no shared rows
  instagram: [0.05, 0.05], meetup: [0.52, 0.18], whatsapp: [0.11, 0.31],
  youtube: [0.37, 0.46], discord: [0.11, 0.67], facebook: [0.60, 0.89],
};
/* the wadi: one hard flat band, corner to corner, no outline */
const WADI_TOP = [[-0.08, 0.05], [0.30, 0.29], [0.62, 0.50], [1.08, 0.76]];
const WADI_BOT = [[1.08, 0.93], [0.62, 0.80], [0.30, 0.60], [-0.08, 0.36]];

const FALL_MS = 520;          // swallow (0–.58) · black (.58–.70) · one glint (.70–1) · cut
const HINT = 'CARRY THE LAMP';

/* ───────────────────────────── state ───────────────────────────── */
let ctxRef = null, fx = null, audio = null, store = null, root = null, L = null;
let W = 0, H = 0, BASE = 900, NF = 40, LR = 200, portrait = false;
let wells = [], real = [], seventh = null;
let mx = -9999, my = -9999, lx = -9999, ly = -9999, lampOn = false, haveMouse = false, retOn = false;
let awake = null, focused = null, sel = null, prevAwake = null, lastPtr = 'mouse';
let parts = [], stakes = [], links = [];
let uiEl = null, hitWrap = null, hits = [], pipEls = [], qBtn = null, hintEl = null;
let falling = null, cut = false, ready = false, exited = false;
let offs = [], timers = [], watchdog = 0, lastRenderAt = 0, tNow = 0, tickErr = false;
let acc = { wind: 1800, drip: 4000 };
let opened = new Set(), foundFlash = 0, jumpFlash = 0, lastLampMove = 0;
let hintGone = false, enteredAt = 0;
// idle: hard-cut events
let glint = null, nextGlint = 0, grit = null, nextGrit = 0;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const vis = (w) => w.id !== 'seventh' || (seventh && seventh.exists);
const FONT_NAME = (px) => `${Math.round(px)}px "Anton", "Arial Narrow", Impact, sans-serif`;
const FONT_MONO = (px) => `600 ${Math.round(px)}px "IBM Plex Mono", ui-monospace, monospace`;
const FONT_HE = (px) => `700 ${Math.round(px)}px "Heebo", sans-serif`;
const lampR = () => LR * (fx.reducedMotion ? 1 : 1 + 0.012 * Math.sin(tNow / 140));

/* ───────────────────────────── layout ───────────────────────────── */
function layout() {
  W = window.innerWidth; H = window.innerHeight;
  portrait = H > W * 1.15;
  BASE = portrait ? Math.min(H * 0.75, W * 1.4) : Math.min(H, W * 0.66);
  NF = clamp(Math.min(H * (portrait ? 0.045 : 0.052), W * 0.08), 22, 58);
  LR = clamp(Math.min(W, H) * 0.24 + 30, 110, 300);        // the lamp disc
  const A = portrait ? PORT : LAND;
  const fx0 = 0.06, fw = 0.88;
  const fy0 = portrait ? 0.115 : 0.12, fh = portrait ? 0.79 : 0.78;

  for (const w of real) {
    const a = A[w.id] || [0.5, 0.5];
    w.x = (fx0 + a[0] * fw) * W;
    w.y = (fy0 + a[1] * fh) * H;
    // depth is the size, and the contrast is the point
    w.r = Math.max(portrait ? 9 : 11, BASE * 0.15 * Math.pow((w.depth || 20) / 70, 1.1));
    w.rim = Math.max(2, Math.round(w.r * 0.05));
  }

  const g = L.ctx2d;
  const ui = uiRects();
  placePlates(g, ui);
  // hit boxes: the mouth and its plate, as one door
  for (const w of real) {
    let x0 = w.x - w.r, y0 = w.y - w.r, x1 = w.x + w.r, y1 = w.y + w.r;
    if (w.plate) {
      const [px, py, pw, ph] = w.plate;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px + pw); y1 = Math.max(y1, py + ph);
    }
    const pad = 6;
    w.box = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
    if (w.box[2] < 48) { w.box[0] -= (48 - w.box[2]) / 2; w.box[2] = 48; }
    if (w.box[3] < 48) { w.box[1] -= (48 - w.box[3]) / 2; w.box[3] = 48; }
  }
  // where each woken well's small print goes: the side that covers no other mouth or name
  for (const w of real) placeCard(g, w, ui);

  // the seventh: a square, and a handful of places it might be instead
  if (seventh) {
    seventh.r = Math.max(18, BASE * 0.052);
    const q = fx.rnd(7177);
    const spots = [];
    const clear = (x, y) => {
      const R = [x - seventh.r * 2.6, y - seventh.r * 2.6, seventh.r * 5.2, seventh.r * 5.2];
      return real.every((w) => !rectCircle(R, w.x, w.y, w.r + 12) && !(w.plate && rectRect(R, w.plate, 8))) &&
        spots.every((p) => Math.hypot(x - p[0], y - p[1]) > seventh.r * 6) &&
        !(x < 300 && y < 120) && !(x < 320 && y > H - 120) && !(x > W - 180 && y > H - 80);
    };
    for (let k = 0; k < 600 && spots.length < 5; k++) {
      const c = [(0.08 + q() * 0.84) * W, (0.16 + q() * 0.74) * H];
      if (clear(c[0], c[1])) spots.push(c);
    }
    if (!spots.length) spots.push([W * 0.5, H * 0.92]);
    seventh.spots = spots;
    const s = spots[seventh.spotI % spots.length];
    seventh.x = s[0]; seventh.y = s[1];
    placeSeventhBox();
  }

  buildLinks();
  if (!haveMouse && !lampOn) { mx = my = lx = ly = -9999; }
  placeHits();
}

// the fixed HUD (identity, count, hint, sound) as rects the type should stay off
function uiRects() {
  const out = [];
  const add = (el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push([r.left, r.top, r.width, r.height]);
  };
  try {
    if (uiEl) {
      add(uiEl.querySelector('.sf-id'));
      add(uiEl.querySelector('.sf-count'));
      if (!hintGone) add(uiEl.querySelector('.sf-hint'));
    }
    add(document.getElementById('sound'));
  } catch {}
  return out;
}

const HARD = 1e6;
const PLATE_PAD = 6;
const PLATE_SCALES = [1, 0.88, 0.76, 0.66, 0.56];

// Name plates: always on. Every plate is placed so that it never touches another plate or another
// mouth: beside the mouth first (right, then left, nudged up/down), then above or below it, and
// as a last resort the name steps down in size. A few placement orders are tried and the
// cheapest whole sheet wins, so one greedy early choice cannot box a later name in.
function placePlates(g, ui) {
  for (const w of real) {
    w.nf = NF;
    g.font = FONT_NAME(NF);
    w.tw = g.measureText(w.name).width;
    w.inside = w.tw + NF * 0.4 < w.r * 1.7;
    w.plate = null; w.side = 1;
  }
  const outs = real.filter((w) => !w.inside);
  const orders = [
    outs.slice().sort((a, b) => b.r - a.r),
    outs.slice().sort((a, b) => a.x - b.x),
    outs.slice().sort((a, b) => b.x - a.x),
    outs.slice().sort((a, b) => a.y - b.y),
    outs.slice().sort((a, b) => b.y - a.y),
  ];
  const apply = (res) => {
    for (const [w, c] of res) { w.plate = c.R.map(Math.round); w.side = c.side; w.nf = c.nf; w.tw = c.tw; }
  };
  let best = null, bc = Infinity;
  for (const ord of orders) {
    const placed = [], res = new Map();
    let cost = 0;
    for (const w of ord) {
      const c = bestPlate(g, w, placed, ui);
      res.set(w, c); placed.push(c.R); cost += c.s;
    }
    // the sheet is judged with its cards too: a card that must cover a neighbour costs dear
    apply(res);
    for (const w of outs) { const cs = placeCard(g, w, ui); cost += cs >= HARD ? 1e4 : cs; }
    if (cost < bc) { bc = cost; best = res; }
  }
  apply(best);
}

function bestPlate(g, w, placed, ui) {
  let best = null, bs = Infinity;
  const m0 = cardMetrics(g, w);
  // is there room for this well's card off a plate at R (below or above, either edge)?
  const cardRoom = (R) => {
    const sw = Math.max(R[2], Math.min(m0.rw, Math.max(R[2] - NF * 0.6, m0.vw, 110)) + NF * 0.6, m0.vw + NF * 0.6);
    for (const sy of [R[1] + R[3], R[1] - m0.h]) {
      for (const sx of [R[0], R[0] + R[2] - sw]) {
        const C2 = [sx, sy, sw, m0.h];
        if (sx < 4 || sy < 4 || sx + sw > W - 4 || sy + m0.h > H - 4) continue;
        if (real.some((o) => o !== w && rectCircle(C2, o.x, o.y, o.r + o.rim + 6))) continue;
        if (placed.some((q) => rectRect(C2, q, 0))) continue;
        return true;
      }
    }
    return false;
  };
  for (const sc of PLATE_SCALES) {
    const nf = NF * sc;
    g.font = FONT_NAME(nf);
    const tw = g.measureText(w.name).width;
    const ph = nf * 1.2, pw = tw + nf * 0.6, gap = Math.max(6, nf * 0.14) + w.rim;
    const cands = [];
    for (const dy of [0, -0.6, 0.6, -1, 1]) {
      const y0 = w.y - ph / 2 + dy * ph, ds = Math.abs(dy) * 40;
      cands.push({ R: [w.x + w.r + gap, y0, pw, ph], side: 1, s: ds });
      cands.push({ R: [w.x - w.r - gap - pw, y0, pw, ph], side: -1, s: ds + 6 });
    }
    for (const up of [true, false]) {
      const y0 = up ? w.y - w.r - gap - ph : w.y + w.r + gap;
      for (const [x0, xs] of [[w.x - pw / 2, 0], [w.x - w.r, 4], [w.x + w.r - pw, 4]]) {
        cands.push({ R: [x0, y0, pw, ph], side: 1, s: 60 + xs + (up ? 0 : 6) });
      }
    }
    for (const c of cands) {
      const R = c.R;
      let s = c.s + (1 - sc) * 3000;
      if (R[0] < 8 || R[1] < 8 || R[0] + R[2] > W - 8 || R[1] + R[3] > H - 8) s += HARD;
      for (const o of real) if (o !== w && rectCircle(R, o.x, o.y, o.r + o.rim + 4)) s += HARD;
      for (const p of placed) if (rectRect(R, p, PLATE_PAD)) s += HARD;
      for (const u of ui) if (rectRect(R, u, 4)) s += 2e4;
      if (s < HARD && !cardRoom(R)) s += 300;
      if (s < bs) { bs = s; best = { R, side: c.side, s, nf, tw }; }
    }
  }
  return best;
}

function cardMetrics(g, w, wrapAt = Infinity) {
  const mf = clamp(NF * 0.27, 10, 13);
  const hf = clamp(NF * 0.36, 13, 19);
  const lh = mf * 1.7;
  g.font = FONT_MONO(mf);
  // the role on one line, or broken into lines no wider than wrapAt
  const lines = [];
  let cur = '';
  for (const word of w.role.toUpperCase().split(' ')) {
    const t = cur ? cur + ' ' + word : word;
    if (cur && g.measureText(t).width > wrapAt) { lines.push(cur); cur = word; } else cur = t;
  }
  lines.push(cur);
  const rw = Math.max(...lines.map((l) => g.measureText(l).width));
  const vw = g.measureText(`${String(w.depth).padStart(2, '0')} M   RE-ENTER ↵`).width;
  return { mf, hf, lh, rw, vw, lines, h: hf * 1.35 + lh * (lines.length + 1) + mf * 0.9 };
}

// The woken well's small print hangs off its plate (below, above, or beside it) and never covers
// another mouth (nor, wherever there is room, another name). The plate grows to the card's width, so that strip counts too.
// A long role may break onto two lines to make the card narrow enough to fit.
function placeCard(g, w, ui) {
  w.card = null;
  if (w.inside) return 0;
  const [px, py, pw, ph] = w.plate;
  const m0 = cardMetrics(g, w);
  const variants = [[m0, 0]];
  const narrow = Math.max(pw - NF * 0.6, m0.vw, 110);
  if (m0.rw > narrow + 1) variants.push([cardMetrics(g, w, narrow), 20]);
  let best = null, bs = Infinity;
  for (const [m, vs] of variants) {
    const sw = Math.max(pw, m.rw + NF * 0.6, m.vw + NF * 0.6);
    const cands = [];
    for (const below of [true, false]) {
      for (const alignL of [w.side > 0, w.side <= 0]) {
        const sx = clamp(alignL ? px : px + pw - sw, 8, W - sw - 8);
        cands.push({ sx, sy: below ? py + ph : py - m.h, below, s: (below ? 0 : 5) + (alignL === (w.side > 0) ? 0 : 3) });
      }
      // slid along the plate, for a wide card in a crowded corner
      for (let k = 1; k < 8; k++) {
        const sx = clamp(px + pw - sw + (k / 8) * (sw - pw), 8, W - sw - 8);
        cands.push({ sx, sy: below ? py + ph : py - m.h, below, s: (below ? 10 : 15) + k * 0.1 });
      }
    }
    // beside the plate, top-aligned with it (the plate strip and the card read as one block)
    cands.push({ sx: px + pw, sy: py, below: true, beside: true, s: 30 });
    cands.push({ sx: px - sw, sy: py, below: true, beside: true, s: 32 });
    for (const c of cands) {
      const R = [c.sx, c.sy, sw, m.h];
      const strip = c.beside ? null : [Math.min(c.sx, px), py, Math.max(c.sx + sw, px + pw) - Math.min(c.sx, px), ph];
      let s = c.s + vs;
      if (R[0] < 4 || R[1] < 4 || R[0] + R[2] > W - 4 || R[1] + R[3] > H - 4) s += HARD;
      for (const o of real) {
        if (o === w) continue;
        for (const r of strip ? [R, strip] : [R]) {
          // the strip is plate-height type, so it keeps the plates' clearance
          if (rectCircle(r, o.x, o.y, o.r + o.rim + (r === R ? 6 : 4))) s += HARD;
          if (o.plate && rectRect(r, o.plate, 0)) s += 1500;     // brief, while woken; still avoided
        }
      }
      for (const u of ui) if (rectRect(R, u, 2)) s += 800;
      if (rectCircle(R, w.x, w.y, w.r + w.rim + 2)) s += 400;
      if (s < bs) {
        bs = s;
        best = { sx: c.sx, sy: Math.round(c.sy), sw, h: m.h, lines: m.lines, below: c.below, rects: strip ? [R, strip] : [R] };
      }
    }
  }
  w.card = best;
  return bs;
}

// the found seventh's two-line card, beside the square, on the side that covers nothing
function sevCardRect() {
  const s = seventh;
  if (!s || !s.exists || !L) return null;
  const g = L.ctx2d;
  const mf = clamp(NF * 0.27, 10, 13);
  g.font = FONT_MONO(mf);
  const tw = Math.max(g.measureText('NOT ON THE SHEET').width, g.measureText('DRY. TAP AGAIN ↓').width) + mf * 2;
  const th = mf * 4.2;
  const k = s.r + Math.max(4, Math.round(s.r * 0.16)) + Math.max(4, s.r * 0.1);
  const opts = [[s.x + k, s.y - k], [s.x - k - tw, s.y - k], [s.x + k, s.y + k - th], [s.x - k - tw, s.y + k - th],
    [s.x - tw / 2, s.y + k], [s.x - tw / 2, s.y - k - th]];
  let best = null, bs = Infinity;
  opts.forEach(([bx, by], i) => {
    const R = [bx, by, tw, th];
    let sc = i;
    if (bx < 4 || by < 4 || bx + tw > W - 4 || by + th > H - 4) sc += HARD;
    for (const o of real) {
      if (rectCircle(R, o.x, o.y, o.r + o.rim + 6)) sc += 1e4;
      if (o.plate && rectRect(R, o.plate, 4)) sc += 1e4;
    }
    if (sc < bs) { bs = sc; best = R; }
  });
  return { R: best, mf };
}

// the extra area a well owns while it is woken or selected: its card
function cardRects(w) {
  if (w === seventh) { const c = sevCardRect(); return c ? [c.R] : []; }
  return w.card ? w.card.rects : [];
}
const active = (w) => w === sel || w === awake;

// the door a well's button covers: its mouth + plate box, plus its card while it is active
function boxOf(w) {
  const b = w.box;
  if (!b || !active(w)) return b;
  let x0 = b[0], y0 = b[1], x1 = b[0] + b[2], y1 = b[1] + b[3];
  for (const r of cardRects(w)) {
    x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]);
    x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

// distance from a point to what you can see of a well: mouth, plate, and card while active
function shapeDist(w, x, y) {
  const rd = (R) => Math.hypot(x - clamp(x, R[0], R[0] + R[2]), y - clamp(y, R[1], R[1] + R[3]));
  let d = w === seventh ? rd(w.box) : Math.max(0, Math.hypot(x - w.x, y - w.y) - (w.r + w.rim));
  if (w.plate) d = Math.min(d, rd(w.plate));
  if (active(w)) for (const r of cardRects(w)) d = Math.min(d, rd(r));
  return d;
}

// which well a point means: the nearest mouth-or-plate among the doors that contain it,
// never whichever button happens to be later in the DOM
function pick(x, y) {
  let best = null, bd = Infinity;
  for (const w of wells) {
    if (!vis(w) || !w.box) continue;
    const b = boxOf(w);
    if (!inBox(b, x, y)) continue;
    const d = shapeDist(w, x, y) - (active(w) ? 0.01 : 0);
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}

function placeSeventhBox() {
  const s = seventh, k = s.r * 1.35;
  s.box = [s.x - k, s.y - k, k * 2, k * 2];
}

function rectCircle(R, cx, cy, r) {
  const nx = clamp(cx, R[0], R[0] + R[2]), ny = clamp(cy, R[1], R[1] + R[3]);
  return Math.hypot(cx - nx, cy - ny) < r;
}
function rectRect(a, b, pad = 0) {
  return a[0] < b[0] + b[2] + pad && a[0] + a[2] + pad > b[0] &&
    a[1] < b[1] + b[3] + pad && a[1] + a[3] + pad > b[1];
}
const inBox = (b, x, y) => x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];

// one quiet triangulation set: a minimum spanning tree over the wells you have entered
function buildLinks() {
  const k = real.filter((w) => opened.has(w.id));
  links = [];
  if (k.length < 2) return;
  const inT = [k[0]], out = k.slice(1);
  while (out.length) {
    let bi = 0, bj = 0, bd = 1e9;
    for (let i = 0; i < inT.length; i++) for (let j = 0; j < out.length; j++) {
      const d = Math.hypot(inT[i].x - out[j].x, inT[i].y - out[j].y);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
    links.push([inT[bi], out[bj]]);
    inT.push(out.splice(bj, 1)[0]);
  }
}

/* ───────────────────────────── drawing ───────────────────────────── */
function bandPath(g, top, bot) {
  g.beginPath();
  top.forEach((p, i) => (i ? g.lineTo(p[0] * W, p[1] * H) : g.moveTo(p[0] * W, p[1] * H)));
  bot.forEach((p) => g.lineTo(p[0] * W, p[1] * H));
  g.closePath();
}
const disc = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };

function render() {
  const g = L.ctx2d;
  if (cut) { g.fillStyle = rgb(C.ink); g.fillRect(0, 0, W, H); return; }

  // 1. ground: night
  g.fillStyle = rgb(C.ground);
  g.fillRect(0, 0, W, H);

  // 2. the wadi: one hard dark-ochre band
  g.fillStyle = rgb(C.wadi);
  bandPath(g, WADI_TOP, WADI_BOT);
  g.fill();

  // 3. the lamp: a flat dusk ring, then a flat disc of sand over everything. light is the event.
  const lr = lampR();
  if (lampOn) {
    g.fillStyle = rgb(C.wadi);
    disc(g, lx, ly, lr * 1.2);
    g.fillStyle = rgb(C.sand);
    disc(g, lx, ly, lr);
  }

  // 4. the unfound seventh eats light: under the lamp, a square where the light does not land
  if (seventh && !seventh.exists && lampOn) {
    g.save();
    g.beginPath(); g.arc(lx, ly, lr, 0, TAU); g.clip();
    const k = seventh.r * 1.15;
    g.fillStyle = rgb(C.ground);
    g.fillRect(seventh.x - k, seventh.y - k, k * 2, k * 2);
    g.restore();
  }

  // 5. the triangulation between wells you have been down, and the stakes you planted
  if (links.length) {
    g.strokeStyle = rgb(C.wadi);
    g.lineWidth = 2;
    g.beginPath();
    for (const [a, b] of links) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); }
    g.stroke();
  }
  g.strokeStyle = rgb(C.bone);
  g.lineWidth = 2;
  for (const st of stakes) {
    const k = 6 * clamp(st.t / 120, 0, 1);
    g.beginPath();
    g.moveTo(st.x - k, st.y - k); g.lineTo(st.x + k, st.y + k);
    g.moveTo(st.x + k, st.y - k); g.lineTo(st.x - k, st.y + k);
    g.stroke();
  }

  // 6. the mouths
  for (const w of real) drawMouth(g, w, lr);
  if (seventh && seventh.exists) drawSeventh(g);

  // 7. idle grit: a hard streak of wind-lifted grit, there for a beat and gone
  if (grit && tNow < grit.until) {
    g.fillStyle = rgb(C.bone);
    for (const r of grit.rects) g.fillRect(r[0], r[1], r[2], r[3]);
  }

  // 8. the reticle sits under the type, so it never covers a name
  if (retOn && haveMouse && lastPtr !== 'touch' && !falling) {
    g.fillStyle = rgb(C.hot);
    g.fillRect(mx - 11, my - 1, 22, 2);
    g.fillRect(mx - 1, my - 11, 2, 22);
  }

  // 9. names, always on, full bone
  for (const w of real) drawName(g, w);
  if (seventh && seventh.exists) drawSeventhCard(g);
  const top = awake && awake !== seventh ? awake : null;
  if (top) drawSmallPrint(g, top);

  // 10. kicked dust
  for (const p of parts) {
    if (p.t > p.life) continue;
    g.fillStyle = rgb(p.c);
    g.fillRect(p.x, p.y, p.s, p.s);
  }

  // 11. the descent
  if (falling) drawFall(g);

  // 12. the seventh, found: the system breaks for a beat
  if (foundFlash > 0) {
    g.fillStyle = rgb(C.hot);
    g.fillRect(0, 0, W, H);
    g.fillStyle = rgb(C.ink);
    const fs = Math.min(H * 1.1, W * 1.6);
    g.font = FONT_NAME(fs);
    const t = '7';
    g.fillText(t, W / 2 - g.measureText(t).width / 2, H / 2 + fs * 0.37);
  }
}

// A mouth: an ochre stone lip, a black hole, a thin moonlit far wall (always), and — when the
// lamp is over it — a fat sand crescent on the wall that faces the lamp and one orange glint
// deep down in the water.
function drawMouth(g, w, lr) {
  const { x: cx, y: cy, r } = w;
  const on = w.wake;

  // light from the lamp, or from an idle glint
  let lit = null, deep = false;
  if (lampOn && lx > -9000) {
    const dx = lx - cx, dy = ly - cy, d = Math.hypot(dx, dy);
    if (d < lr + r * 0.6) {
      lit = d > 0.5 ? [dx / d, dy / d] : [MOON[0], MOON[1]];
      deep = d < lr * 0.85 + r * 0.2;
    }
  }
  if (!lit && glint && glint.w === w && tNow < glint.until) { lit = glint.u; deep = true; }

  // focus/awake: one hard orange ring
  if (on > 0.3 || focused === w || sel === w) {
    g.fillStyle = rgb(C.hot);
    disc(g, cx, cy, r + w.rim + Math.max(4, r * 0.06));
  }
  // the stone lip
  g.fillStyle = rgb(C.wadi);
  disc(g, cx, cy, r + w.rim);

  // the hole and its lit walls
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  g.fillStyle = rgb(C.sand);
  g.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
  const tm = Math.max(3, r * 0.08);                 // moonlit far wall
  g.beginPath(); g.arc(cx + MOON[0] * tm, cy + MOON[1] * tm, r, 0, TAU); g.clip();
  g.fillStyle = rgb(C.ink);
  if (lit) {
    const tl = Math.max(4, r * 0.24);               // the wall facing the lamp
    disc(g, cx + lit[0] * tl, cy + lit[1] * tl, r);
  } else {
    g.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
  }
  g.restore();

  // the glint: one orange disc deep down, only under light
  if (deep || (on > 0.3 && !w.inside)) {
    const u = lit || MOON;
    const gr = Math.max(2.5, r * 0.09);
    let k = 0.32;
    if (w.inside) {
      // keep the glint off the name and the small print: slide it out along the light
      const tx = w.tw / 2 + gr + 4, ty0 = -NF * 0.95, ty1 = NF * (on > 0.05 ? 2.6 : 0.5);
      while (k < 0.8) {
        const gx = u[0] * r * k, gy = u[1] * r * k;
        if (!(Math.abs(gx) < tx && gy > ty0 - gr && gy < ty1 + gr)) break;
        k += 0.04;
      }
    }
    g.fillStyle = rgb(C.hot);
    disc(g, cx + u[0] * r * k, cy + u[1] * r * k, gr);
  }
}

function drawName(g, w) {
  const { x: cx, y: cy } = w;
  const on = w.wake;
  g.font = FONT_NAME(NF);
  if (w.inside) {
    g.fillStyle = rgb(C.bone);
    g.fillText(w.name, cx - w.tw / 2, cy + NF * 0.36 - (on > 0.05 ? NF * 0.32 : 0));
    if (opened.has(w.id)) {
      g.fillStyle = rgb(C.hot);
      g.fillRect(cx - w.tw / 2, cy + NF * 0.52 - (on > 0.05 ? NF * 0.32 : 0), w.tw, Math.max(3, NF * 0.08));
    }
  } else {
    const [px, py, pw, ph] = w.plate, nf = w.nf;
    g.font = FONT_NAME(nf);
    g.fillStyle = rgb(C.ink);
    g.fillRect(px, py, pw, ph);
    if (opened.has(w.id)) {             // been down there: an orange notch on the plate
      g.fillStyle = rgb(C.hot);
      g.fillRect(w.side > 0 ? px : px + pw - nf * 0.12, py, nf * 0.12, ph);
    }
    g.fillStyle = rgb(C.bone);
    g.fillText(w.name, px + nf * 0.3, py + ph / 2 + nf * 0.36);
  }

  // keyboard focus / touch selection: hard orange corner brackets
  if (focused === w || sel === w) {
    const b = w.box, t = Math.max(10, NF * 0.3);
    g.strokeStyle = rgb(C.hot);
    g.lineWidth = 3;
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = b[0] + sx * b[2], y = b[1] + sy * b[3];
      const dx = sx ? -1 : 1, dy = sy ? -1 : 1;
      g.beginPath();
      g.moveTo(x + dx * t, y); g.lineTo(x, y); g.lineTo(x, y + dy * t);
      g.stroke();
    }
  }
}

// The only thing the lamp adds: Hebrew, the role, the depth, and the verb.
function drawSmallPrint(g, w) {
  const a = w.wake;
  if (a < 0.05) return;
  const touchy = lastPtr === 'touch' && sel === w;
  const verb = touchy ? 'TAP AGAIN ↓' : (opened.has(w.id) ? 'RE-ENTER ↵' : 'DESCEND ↵');
  const m = cardMetrics(g, w);
  const { mf, hf, lh } = m;
  const role = w.role.toUpperCase();
  const depth = `${String(w.depth).padStart(2, '0')} M`;
  g.font = FONT_MONO(mf);
  const rw = g.measureText(role).width;
  const vw = g.measureText(depth + '   ' + verb).width;

  if (w.inside) {
    // inside the big mouth, under the name
    const y = w.y + NF * 0.36 - NF * 0.32 + hf * 1.45;
    if (a < 0.35) return;
    g.font = FONT_HE(hf);
    g.fillStyle = rgb(C.bone);
    const hw = g.measureText(w.he).width;
    g.fillText(w.he, w.x - hw / 2, y);
    g.font = FONT_MONO(mf);
    g.fillText(role, w.x - rw / 2, y + lh);
    g.fillStyle = rgb(C.hot);
    g.fillText(depth + '   ' + verb, w.x - vw / 2, y + lh * 2);
    return;
  }
  const [px, py, pw, ph] = w.plate;
  const cd = w.card;
  if (!cd) return;
  const sw = cd.sw, sx = cd.sx;
  const sh = cd.h * clamp(a * 1.3, 0, 1);
  const sy = cd.below ? cd.sy : cd.sy + (cd.h - sh);
  g.fillStyle = rgb(C.ink);
  g.fillRect(sx, sy, sw, sh);
  // the name plate grows to the card's width, so plate + card are one flat block
  if (sx < px || sx + sw > px + pw) {
    g.fillRect(Math.min(sx, px), py, Math.max(sx + sw, px + pw) - Math.min(sx, px), ph);
    const nf = w.nf;
    g.font = FONT_NAME(nf);
    g.fillStyle = rgb(C.bone);
    g.fillText(w.name, px + nf * 0.3, py + ph / 2 + nf * 0.36);
    if (opened.has(w.id)) {
      g.fillStyle = rgb(C.hot);
      g.fillRect(w.side > 0 ? px : px + pw - nf * 0.12, py, nf * 0.12, ph);
    }
  }
  g.save();
  g.beginPath(); g.rect(sx, sy, sw, sh); g.clip();
  const tx = sx + NF * 0.3;
  let y = cd.sy + hf * 1.15;
  g.font = FONT_HE(hf);
  g.fillStyle = rgb(C.bone);
  g.fillText(w.he, tx, y);
  g.font = FONT_MONO(mf);
  for (const line of cd.lines) { y += lh; g.fillText(line, tx, y); }
  y += lh;
  g.fillStyle = rgb(C.hot);
  g.fillText(depth + '   ' + verb, tx, y);
  g.restore();
}

// Found: a square hole — black, with a hard orange rim — the only wrong shape on the sheet.
function drawSeventh(g) {
  const s = seventh, { x: cx, y: cy, r } = s;
  const inv = jumpFlash > 0;
  const rim = Math.max(4, Math.round(r * 0.16));
  if (s.wake > 0.02 || focused === s || sel === s) {
    g.fillStyle = rgb(C.bone);
    const k = r + rim + Math.max(4, r * 0.1);
    g.fillRect(cx - k, cy - k, k * 2, k * 2);
  }
  g.fillStyle = rgb(C.hot);
  g.fillRect(cx - r - rim, cy - r - rim, (r + rim) * 2, (r + rim) * 2);
  g.fillStyle = rgb(inv ? C.hot : C.ink);
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  const fs = r * 1.2;
  g.font = FONT_NAME(fs);
  g.fillStyle = rgb(inv ? C.ink : C.hot);
  const glyph = (!fx.reducedMotion && Math.sin(tNow / 170) * Math.sin(tNow / 61) > 0.55) ? 'ז' : '7';
  if (glyph === 'ז') g.font = FONT_HE(fs * 0.9);
  const gw = g.measureText(glyph).width;
  g.fillText(glyph, cx - gw / 2, cy + fs * 0.36);
}

function drawSeventhCard(g) {
  const s = seventh;
  if (!(s.wake > 0.05 || sel === s)) return;
  const c = sevCardRect();
  if (!c) return;
  const { mf } = c, [bx, by, tw, th] = c.R;
  g.font = FONT_MONO(mf);
  const t1 = 'NOT ON THE SHEET', t2 = lastPtr === 'touch' && sel === s ? 'DRY. TAP AGAIN ↓' : 'DRY. OR IS IT ↵';
  g.fillStyle = rgb(C.ink);
  g.fillRect(bx, by, tw, th);
  g.fillStyle = rgb(C.bone);
  g.fillText(t1, bx + mf, by + mf * 1.7);
  g.fillStyle = rgb(C.hot);
  g.fillText(t2, bx + mf, by + mf * 3.4);
}

/* The descent: the mouth's black swallows the frame (its lit wall rushing past the lens), a beat
   of pure black, one orange glint far below, then a hard cut. */
function drawFall(g) {
  const w = falling.w;
  const p = clamp(falling.p, 0, 1);
  const sq = w.id === 'seventh';
  const SW = 0.58;
  if (p < SW) {
    const e = fx.ease.inCubic(p / SW);
    const R = w.r + Math.hypot(W, H) * 1.15 * e;
    const u = falling.u;
    if (sq) {
      const rim = Math.max(4, R * 0.16);
      g.fillStyle = rgb(C.hot);
      g.fillRect(w.x - R - rim, w.y - R - rim, (R + rim) * 2, (R + rim) * 2);
      g.fillStyle = rgb(C.ink);
      g.fillRect(w.x - R, w.y - R, R * 2, R * 2);
    } else {
      g.save();
      g.beginPath(); g.arc(w.x, w.y, R, 0, TAU); g.clip();
      g.fillStyle = rgb(C.sand);
      g.fillRect(w.x - R - 1, w.y - R - 1, R * 2 + 2, R * 2 + 2);
      g.fillStyle = rgb(C.ink);
      disc(g, w.x + u[0] * R * 0.24, w.y + u[1] * R * 0.24, R);
      g.restore();
    }
    return;
  }
  g.fillStyle = rgb(C.ink);
  g.fillRect(0, 0, W, H);
  if (p >= 0.70) {
    // one glint at the bottom of the shaft
    const gr = Math.max(6, Math.min(W, H) * (p >= 0.86 ? 0.03 : 0.018));
    g.fillStyle = rgb(C.hot);
    if (sq) g.fillRect(W / 2 - gr, H * 0.56 - gr, gr * 2, gr * 2);
    else disc(g, W / 2, H * 0.56, gr);
  }
}

/* ───────────────────────────── dust ───────────────────────────── */
function puff(x, y, n, spread, up) {
  if (parts.length > 260) return;
  const r = fx.rnd(((x * 13 + y * 7 + n) | 0) || 7);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, v = (0.3 + r() * 1.5) * spread;
    parts.push({
      x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - (up || 0) * (0.2 + r() * 0.8),
      t: 0, life: 380 + r() * 700, s: r() < 0.3 ? 3 : 2,
      c: r() < 0.6 ? C.wadi : C.bone,
    });
  }
}

/* ───────────────────────────── idle ───────────────────────────── */
function idle(t) {
  if (fx.reducedMotion || falling) { glint = null; grit = null; return; }
  if (t >= nextGlint) {
    // one mouth catches light from nowhere; a hard on, a hard off. the first lands near 6.5s.
    const pool = real.filter((w) => w !== awake);
    const w = pool[(Math.random() * pool.length) | 0];
    const a = Math.random() * TAU;
    glint = w ? { w, u: [Math.cos(a), Math.sin(a)], until: t + 900 + Math.random() * 500 } : null;
    nextGlint = t + 4200 + Math.random() * 4200;
    if (w) audio.drip({ pitch: clamp(1.3 - (w.depth || 20) / 80, 0.45, 1.3) });
  }
  if (t >= nextGrit) {
    const y0 = (0.15 + Math.random() * 0.75) * H, x0 = Math.random() * W * 0.6;
    const n = 4 + ((Math.random() * 4) | 0), rects = [];
    let x = x0;
    for (let i = 0; i < n; i++) {
      const len = 10 + Math.random() * 70;
      rects.push([Math.round(x), Math.round(y0 + (Math.random() - 0.5) * 22), Math.round(len), Math.random() < 0.3 ? 3 : 2]);
      x += len + 14 + Math.random() * 60;
    }
    grit = { rects, until: t + 150 };
    nextGrit = t + 4000 + Math.random() * 2000;
    audio.noise({ dur: 0.12, gain: 0.03, band: [1400, 4200] });
  }
}

/* ───────────────────────────── DOM ───────────────────────────── */
const CSS = `
.sf-ui{position:absolute;inset:0;z-index:72;pointer-events:none;font-family:var(--font-mono);color:var(--bone)}
.sf-ui[data-off="1"]{visibility:hidden}
.sf-id{position:absolute;left:24px;top:20px;line-height:1}
.sf-mark{font-family:var(--font-display);font-size:26px;letter-spacing:.14em;color:${hex(C.bone)}}
.sf-he{font-family:var(--font-he);font-weight:700;font-size:14px;letter-spacing:.1em;margin-top:6px;direction:rtl;text-align:left;color:${hex(C.bone)}}
.sf-tag{font-family:var(--font-mono);font-weight:600;font-size:10px;letter-spacing:.2em;margin-top:7px;white-space:nowrap;color:${hex(C.bone)}}
.sf-count{position:absolute;left:24px;bottom:20px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:${hex(C.bone)}}
.sf-pips{display:flex;gap:6px;margin-top:9px;align-items:center}
.sf-pip{display:block;width:16px;height:16px;box-sizing:border-box;border:2px solid ${hex(C.bone)};background:${hex(C.ink)}}
.sf-pip[data-s="open"]{background:${hex(C.hot)};border-color:${hex(C.hot)}}
button.sf-q{width:30px;height:30px;margin:-7px 0 -7px 4px;border:2px solid ${hex(C.hot)};padding:0;cursor:pointer;box-sizing:border-box;
  background:${hex(C.ink)};color:${hex(C.hot)};font:600 13px var(--font-mono);line-height:26px;
  text-align:center;pointer-events:auto;outline:none}
button.sf-q:hover,button.sf-q:focus-visible{background:${hex(C.hot)};color:${hex(C.ink)}}
button.sf-q[data-s="found"]{background:${hex(C.ink)};color:${hex(C.hot)};border-width:4px;line-height:22px}
button.sf-q[data-s="found"]:hover,button.sf-q[data-s="found"]:focus-visible{background:${hex(C.hot)};color:${hex(C.ink)}}
.sf-hint{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);font-size:11px;letter-spacing:.34em;
  text-transform:uppercase;white-space:nowrap;color:${hex(C.bone)}}
.sf-hint[data-gone="1"]{display:none}
.sf-hits{position:absolute;inset:0;z-index:70;pointer-events:none}
.sf-hit{position:absolute;background:none;border:0;padding:0;cursor:none;outline:none;pointer-events:auto;
  -webkit-appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.sf-hit::-moz-focus-inner{border:0}
@media (max-width:560px){.sf-hint{display:none}.sf-mark{font-size:22px}.sf-id{left:16px;top:14px}.sf-count{left:16px;bottom:16px}.sf-tag{font-size:9px;letter-spacing:.14em;margin-top:5px}}
@media (max-height:420px){.sf-id{display:grid;grid-template-columns:auto auto;column-gap:14px;align-items:baseline}
  .sf-tag{grid-column:2;grid-row:1;align-self:center;margin-top:0;font-size:9px;letter-spacing:.16em;line-height:1.35}
  .sf-tag span{display:block}.sf-tag .sf-dot{display:none}.sf-he{grid-column:1}}
`;

function buildDOM() {
  const st = document.createElement('style');
  st.textContent = CSS;
  root.appendChild(st);

  // the wells come first in the DOM, so they come first in Tab order
  hitWrap = document.createElement('div');
  hitWrap.className = 'sf-hits';
  hits = wells.map((w, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-hit';
    b.dataset.i = String(i);
    b.setAttribute('aria-label', w.id === 'seventh'
      ? 'unmarked well — dry'
      : `well ${w.n} of 7 — ${w.name}, ${w.role}, depth ${w.depth} metres`);
    b.addEventListener('focus', () => { focused = w; });
    b.addEventListener('blur', () => { if (focused === w) focused = null; });
    b.addEventListener('click', (e) => {
      e.preventDefault();
      // a pointer means the nearest mouth-or-plate under it, not whichever button is on top
      const t = e.detail !== 0 ? (pick(e.clientX, e.clientY) || w) : w;
      // touch: first tap previews, second tap (on the well or its card) descends.
      // keyboard & mouse: straight down.
      if (e.detail !== 0 && lastPtr === 'touch' && sel !== t) {
        sel = t;
        mx = t.x; my = t.y; lampOn = true; lx = mx; ly = my;
        placeHits();
        return;
      }
      open(t);
    });
    hitWrap.appendChild(b);
    return b;
  });
  root.appendChild(hitWrap);

  uiEl = document.createElement('div');
  uiEl.className = 'sf-ui';
  uiEl.innerHTML = `
    <div class="sf-id"><div class="sf-mark">7 WELLS</div><div class="sf-he">באר שבע</div><div class="sf-tag"><span>INDIE GAME DEVS</span><span class="sf-dot"> · </span><span>BE'ER SHEVA</span></div></div>
    <div class="sf-count"><div>ENTERED <span class="sf-n">00</span> / 07</div><div class="sf-pips"></div></div>
    <div class="sf-hint">${HINT}</div>`;
  root.appendChild(uiEl);
  const pw = uiEl.querySelector('.sf-pips');
  pipEls = wells.map((w) => {
    if (w.id === 'seventh') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sf-q';
      b.textContent = '?';
      b.addEventListener('click', (e) => pokeSeventh(e.detail === 0));
      pw.appendChild(b);
      qBtn = b;
      return b;
    }
    const i = document.createElement('i');
    i.className = 'sf-pip';
    i.title = w.name;
    pw.appendChild(i);
    return i;
  });
  hintEl = uiEl.querySelector('.sf-hint');
  paintPips();
}

function placeHits() {
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i], b = hits[i];
    if (!b || !w.box) continue;
    const x = boxOf(w);
    b.style.left = x[0] + 'px';
    b.style.top = x[1] + 'px';
    b.style.width = x[2] + 'px';
    b.style.height = x[3] + 'px';
    b.style.zIndex = active(w) ? '2' : '1';
    const on = vis(w);
    b.style.display = on ? 'block' : 'none';
    b.tabIndex = on ? 0 : -1;
  }
}

function paintPips() {
  let n = 0;
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i], el = pipEls[i];
    if (!el) continue;
    const o = opened.has(w.id);
    if (o) n++;
    if (w.id === 'seventh') {
      const there = seventh && seventh.exists;
      el.textContent = there ? '7' : '?';
      el.dataset.s = there ? 'found' : '';
      el.setAttribute('aria-label', there
        ? 'the seventh well — found. activate to look at it'
        : 'the seventh well — not on the sheet. activate to search for it');
    } else el.dataset.s = o ? 'open' : '';
  }
  const c = uiEl && uiEl.querySelector('.sf-n');
  if (c) c.textContent = String(n).padStart(2, '0');
}

/* ───────────────────────────── behaviour ───────────────────────────── */
function wake(w) {
  if (!w) return;
  if (w.id === 'seventh') {
    audio.tone(52, { dur: 0.9, type: 'triangle', gain: 0.1, slideTo: 37 });
    audio.noise({ dur: 0.5, gain: 0.05, band: [70, 320] });
  } else {
    audio.drip({ pitch: clamp(1.45 - (w.depth || 20) / 80, 0.5, 1.45) });
    audio.noise({ dur: 0.2, gain: 0.04, band: [500, 2600] });
    puff(w.x, w.y - w.r, 10, 0.9, 0.7);
  }
  dropHint();
}

function dropHint() {
  if (hintGone) return;
  hintGone = true;
  if (hintEl) hintEl.dataset.gone = '1';
}

// the `?` pip hints: the lamp drifts to the edge of where the sheet is wrong, so the square of
// shadow shows at its rim. finding it is still three passes of your own. (from the keyboard,
// where there is no lamp to carry, each press is one pass.)
function pokeSeventh(byKey) {
  if (!seventh || falling) return;
  if (seventh.exists) {
    const i = wells.indexOf(seventh);
    if (hits[i]) hits[i].focus();
    return;
  }
  if (!byKey) {
    const ox = lampOn && lx > -9000 ? lx : W / 2, oy = lampOn && ly > -9000 ? ly : H / 2;
    let dx = ox - seventh.x, dy = oy - seventh.y, d = Math.hypot(dx, dy);
    if (d < 1) { dx = 1; dy = 0; d = 1; }
    const k = LR * 0.82;          // outside the pass zone (0.6), inside the lamp's disc
    mx = clamp(seventh.x + (dx / d) * k, 0, W); my = clamp(seventh.y + (dy / d) * k, 0, H);
    if (Math.hypot(mx - seventh.x, my - seventh.y) < LR * 0.62) { mx = seventh.x + (dx / d) * k; my = seventh.y + (dy / d) * k; }
    if (lx < -9000) { lx = mx; ly = my; }
    lampOn = true;
    sel = null;
    lastLampMove = tNow;
    audio.tone(61, { dur: 0.35, type: 'square', gain: 0.05 });
    dropHint();
    return;
  }
  // the swing itself is the pass: if the lamp is already resting there, count it now;
  // otherwise its arrival counts it (once)
  const there = lampOn && Math.hypot(lx - seventh.x, ly - seventh.y) < LR * 0.6;
  if (there) seventh.passes += 1;
  seventh.inZone = there;
  mx = seventh.x + seventh.r * 1.6; my = seventh.y - seventh.r * 1.2;
  lampOn = true;
  lastLampMove = tNow;
  audio.tone(61 - seventh.passes * 6, { dur: 0.35, type: 'square', gain: 0.05 });
  dropHint();
  if (seventh.passes >= 3) findSeventh();
}

function plantStake(x, y) {
  stakes.push({ x, y, t: 0 });
  if (stakes.length > 12) stakes.shift();
  puff(x, y, 8, 0.7, 0.5);
  audio.noise({ dur: 0.14, gain: 0.05, band: [180, 1100] });
  dropHint();
}

function findSeventh() {
  if (!seventh || seventh.exists) return;
  seventh.exists = true;
  seventh.lastMove = tNow;
  try { store.set('seventh.located', true); } catch {}
  placeHits(); paintPips();
  audio.tone(44, { dur: 1.4, type: 'sawtooth', gain: 0.12, slideTo: 31 });
  audio.thud({ gain: 0.5 });
  if (!fx.reducedMotion) { foundFlash = 150; fx.shake(240, 10); }
}

// move the found seventh to a spot well away from wherever the lamp is resting
function relocateSeventh(t) {
  const s = seventh;
  const cands = s.spots.map((p, i) => i).filter((i) => i !== s.spotI);
  if (!cands.length) return;
  const far = cands.filter((i) => !lampOn || Math.hypot(s.spots[i][0] - lx, s.spots[i][1] - ly) > LR * 1.4);
  const pool = far.length ? far : cands;
  s.spotI = pool[(Math.random() * pool.length) | 0];
  const p = s.spots[s.spotI];
  s.x = p[0]; s.y = p[1];
  s.lastMove = t;
  placeSeventhBox(); placeHits();
  jumpFlash = 110;
  audio.noise({ dur: 0.12, gain: 0.05, band: [90, 420] });
}

function open(w) {
  if (!w || falling || cut || !ready) return;
  const target = w.id === 'seventh' ? 'seventh' : 'chamber';
  try { store.mark(w.id); } catch {}
  if (w.id === 'seventh') { try { store.set('seventh.located', true); } catch {} }
  opened.add(w.id);
  paintPips();
  sel = null;
  // the HUD leaves the frame for the drop
  try { uiEl.dataset.off = '1'; } catch {}
  if (w.id === 'seventh') {
    audio.tone(140, { dur: 1.1, type: 'sawtooth', gain: 0.13, slideTo: 24 });
    audio.noise({ dur: 0.9, gain: 0.1, band: [40, 500] });
  } else {
    audio.tone(300, { dur: 0.5, type: 'triangle', gain: 0.16, slideTo: 44 });
    audio.thud({ gain: 0.34, delay: 0.26 });
  }
  if (fx.reducedMotion) { hardCut(target, w.id); return; }
  fx.shake(220, 10);
  let u = MOON;
  if (lampOn && lx > -9000) {
    const dx = lx - w.x, dy = ly - w.y, d = Math.hypot(dx, dy);
    if (d > 0.5) u = [dx / d, dy / d];
  }
  falling = { w, p: 0, dur: FALL_MS, target, u };
  audio.tone(1320, { dur: 0.08, type: 'sine', gain: 0.05, delay: FALL_MS * 0.0007 });
}

// The drop ends on a cut, not a fade: the next scene lands fully opaque on the next frame,
// and between the two there is only black — never the page's navy.
function hardCut(target, id) {
  cut = true;
  try { render(); } catch {}
  try { uiEl.dataset.off = '1'; } catch {}
  if (!exited) ctxRef.go(target, { wellId: id }, { cut: true });
}

/* ───────────────────────────── scene ───────────────────────────── */
export default {
  id: 'surface',

  enter(ctx) {
    ctxRef = ctx; fx = ctx.fx; audio = ctx.audio; store = ctx.store; root = ctx.root;
    exited = false; ready = false; falling = null; cut = false;
    parts = []; stakes = []; links = []; offs = []; timers = [];
    awake = null; prevAwake = null; focused = null; sel = null; qBtn = null;
    foundFlash = 0; jumpFlash = 0; hintGone = false; retOn = false; tickErr = false;
    acc = { wind: 1400, drip: 3000 };
    haveMouse = false; lampOn = false; mx = my = lx = ly = -9999;
    lastRenderAt = performance.now();
    enteredAt = -1; glint = null; grit = null;

    // arrive on a cut too: opaque night from the first frame, no fade over the page colour
    try {
      root.style.animation = 'none';
      root.style.opacity = '1';
      root.style.zIndex = '50';       // above whatever scene is still leaving underneath
      root.style.background = rgb(C.ground);
    } catch {}

    try {
      opened = new Set();
      for (const w of WELLS) { try { if (store.seen(w.id)) opened.add(w.id); } catch {} }

      wells = WELLS.map((w) => ({ ...w, x: 0, y: 0, r: 20, rim: 2, wake: 0 }));
      real = wells.filter((w) => w.id !== 'seventh');
      seventh = wells.find((w) => w.id === 'seventh') || null;
      if (seventh) {
        seventh.spotI = 0; seventh.passes = 0; seventh.inZone = false; seventh.lastMove = 0;
        let was = false;
        // located on the surface, or already dug below (seventh.found is the seventh scene's own key)
        try { was = !!(store.get('seventh.located', false) || store.get('seventh.found', false)); } catch {}
        seventh.exists = was || opened.has('seventh');
      }
      if (opened.size >= 1) hintGone = true;

      L = fx.layer(root, 1);
      buildDOM();
      layout();
      if (hintGone && hintEl) hintEl.dataset.gone = '1';
      fx.grain(false);        // flat means flat
      audio.drone('surface');
    } catch (e) {
      try { document.body.classList.add('show-cursor'); } catch {}
      console.warn('[surface] build failed', e);
      return;
    }

    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)); };

    let px = null, py = null;
    on(window, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      lastPtr = e.pointerType || 'mouse';
      const moved = px === null ? 0 : Math.hypot(e.clientX - px, e.clientY - py);
      px = e.clientX; py = e.clientY;
      if (focused && moved > 3) {
        const ae = document.activeElement;
        if (ae && ae.classList && ae.classList.contains('sf-hit')) ae.blur();
        focused = null;
      }
      if (moved > 0) { sel = null; lastLampMove = tNow; }
      mx = e.clientX; my = e.clientY;
      if (!haveMouse) { haveMouse = true; lx = mx; ly = my; }
      lampOn = true; retOn = true;
    }, { passive: true });

    on(window, 'pointerdown', (e) => {
      lastPtr = e.pointerType || 'mouse';
      if (falling || cut) return;
      if (e.pointerType === 'touch') {
        retOn = false;
        mx = e.clientX; my = e.clientY; lampOn = true; lastLampMove = tNow;
        if (!haveMouse) { lx = mx; ly = my; }
      }
      const t = e.target;
      if (t && t.closest && t.closest('.sf-hit,#sound,.sf-q')) return;
      sel = null;
      plantStake(e.clientX, e.clientY);
    }, { passive: true, capture: true });

    on(window, 'keydown', (e) => {
      if (falling || cut) return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        step(k === 'ArrowLeft' ? [-1, 0] : k === 'ArrowRight' ? [1, 0] : k === 'ArrowUp' ? [0, -1] : [0, 1]);
      } else if (k === 'Enter' || k === ' ') {
        const ae = document.activeElement;
        if (ae && ae.tagName === 'BUTTON') return;
        e.preventDefault();
        open(focused || awake);
      }
    });

    on(window, 'blur', () => { retOn = false; });
    on(document, 'pointerleave', () => { retOn = false; });
    on(document.documentElement, 'mouseleave', () => { retOn = false; });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (!exited) { try { layout(); } catch {} } }).catch(() => {});
    }

    watchdog = setInterval(() => {
      if (exited) return;
      const stalled = performance.now() - lastRenderAt > 1200;
      try { document.body.classList.toggle('show-cursor', stalled); } catch {}
    }, 900);

    ready = true;
  },

  update(dt, t) {
    if (!ready || exited || !L) return;
    try { tick(dt, t); lastRenderAt = performance.now(); } catch (e) {
      if (!tickErr) { tickErr = true; console.warn('[surface] frame failed', e); }
    }
  },

  resize() {
    if (!ready || exited) return;
    try { layout(); } catch {}
  },

  exit() {
    exited = true; ready = false;
    for (const f of offs) { try { f(); } catch {} }
    offs = [];
    for (const id of timers) clearTimeout(id);
    timers = [];
    if (watchdog) { clearInterval(watchdog); watchdog = 0; }
    try { document.body.classList.remove('show-cursor'); } catch {}
    try { fx.grain(true); } catch {}
    // the leaving layer stays solid (no fade-out over the page colour) until the router removes it
    try { if (root) { root.style.animation = 'none'; root.style.zIndex = '0'; } } catch {}
    try { if (L) L.destroy(); } catch {}
    L = null;
    parts = []; stakes = []; links = []; glint = null; grit = null;
    awake = null; focused = null; sel = null; falling = null; qBtn = null;
  },
};

/* ───────────────────────────── per-frame logic ───────────────────────────── */
function step(dir) {
  const from = focused || awake || sel || { x: W / 2, y: H / 2 };
  let best = null, bs = -1e9;
  for (const w of wells) {
    if (w === from || !vis(w)) continue;
    const dx = w.x - from.x, dy = w.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const al = (dx / d) * dir[0] + (dy / d) * dir[1];
    if (al < 0.25) continue;
    const s = al * 1000 - d;
    if (s > bs) { bs = s; best = w; }
  }
  if (!best && !(focused || awake || sel)) best = real[0];
  if (!best) return;
  const i = wells.indexOf(best);
  if (hits[i]) hits[i].focus();
  audio.tone(880, { dur: 0.05, type: 'square', gain: 0.03 });
}

function tick(dt, t) {
  tNow = t;
  if (enteredAt < 0) {
    enteredAt = t;
    nextGlint = t + 6200 + Math.random() * 500;   // first unprompted glint: ~6.2–6.7s, held ≥0.9s
    nextGrit = t + 2600 + Math.random() * 1200;
  }

  if (cut) { render(); return; }

  // the lamp lags the hand (not under reduced motion)
  const lag = fx.reducedMotion ? 1 : Math.min(1, dt / 60);
  if (lx < -9000) { lx = mx; ly = my; }
  lx = lerp(lx, mx, lag); ly = lerp(ly, my, lag);

  // ── who is awake ─────────────────────────────────────────────
  let near = null;
  if (haveMouse && lastPtr !== 'touch') near = pick(mx, my);
  if (sel) near = sel;
  if (focused) near = focused;
  awake = falling ? null : near;
  for (const w of wells) {
    const tgt = awake === w ? 1 : 0;
    w.wake = fx.reducedMotion ? tgt : w.wake + (tgt - w.wake) * Math.min(1, dt / (tgt ? 70 : 140));
  }
  if (awake !== prevAwake) { if (awake) wake(awake); prevAwake = awake; placeHits(); }

  // ── the seventh ──────────────────────────────────────────────
  if (seventh) {
    if (!seventh.exists) {
      // earned: three separate passes of the lamp across the spot where the light will not land
      const d = Math.hypot(lx - seventh.x, ly - seventh.y);
      if (lampOn && d < LR * 0.6) {
        if (!seventh.inZone) {
          seventh.inZone = true;
          seventh.passes++;
          audio.tone(61 - seventh.passes * 6, { dur: 0.3, type: 'square', gain: 0.045 });
        }
      } else if (d > LR * 0.9) seventh.inZone = false;
      if (seventh.passes >= 3) findSeventh();
    } else {
      // it does not stay where you left it, but only while nobody is looking — and it jumps.
      // a lamp left resting does not count as looking.
      const d = Math.hypot(lx - seventh.x, ly - seventh.y);
      const parked = t - lastLampMove > 2500;
      const lookedAt = lampOn && d < LR * 1.1 && !parked;
      const engaged = awake === seventh || focused === seventh || sel === seventh;
      if (!lookedAt && !engaged && t - seventh.lastMove > 3600 && seventh.spots.length > 1) relocateSeventh(t);
    }
  }
  if (foundFlash > 0) foundFlash -= dt;
  if (jumpFlash > 0) jumpFlash -= dt;
  for (const st of stakes) st.t += dt;

  idle(t);

  // ── dust ─────────────────────────────────────────────────────
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;
    p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.004 * dt * 0.06;
  }

  // ── ambience ─────────────────────────────────────────────────
  acc.wind -= dt;
  if (acc.wind <= 0) { acc.wind = 5200 + Math.random() * 7000; audio.noise({ dur: 2.4, gain: 0.022, band: [260, 1500] }); }
  acc.drip -= dt;
  if (acc.drip <= 0) {
    acc.drip = 7000 + Math.random() * 11000;
    const w = real[(Math.random() * real.length) | 0];
    audio.drip({ pitch: clamp(1.3 - (w.depth || 20) / 80, 0.45, 1.3) });
  }

  // ── falling ──────────────────────────────────────────────────
  if (falling) {
    falling.p += dt / falling.dur;
    if (falling.p >= 1) {
      const { target, w } = falling;
      falling = null;
      hardCut(target, w.id);
      return;
    }
  }

  render();
}
