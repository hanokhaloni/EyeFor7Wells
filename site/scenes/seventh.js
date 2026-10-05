// THE SEVENTH WELL — "באר שבע / the dig"
//
// A hand-surveyed dry plot seen from above. You carry a dowsing rod (mouse, arrows, or a
// drag anywhere on a touch screen). The rod twitches toward buried water and reports a
// moisture reading against a gauge with a marked water line; STRIKE (click / space /
// tap) to sink a pit. Hit water and a well mouth opens, green, named in Hebrew after
// one of the six real 7 Wells channels. Six of them sit on a ring. Open all six and the
// vein closes into a circle around the one place you never dowsed — the dry shaft you
// have been standing next to the whole time. The seventh well is in the middle of the
// other six. You dig it yourself.
//
// Owns: site/scenes/seventh.js only.

import { WELLS } from '../data/wells.js';

const TAU = Math.PI * 2;
const SIX = WELLS.filter((w) => w.id !== 'seventh').slice(0, 6);

// The reading scale. One number decides everything: a strike hits iff reading >= WATER_T.
const WATER_T = 0.8;
const BANDS = [
  { max: 0.3, name: 'DRY' },
  { max: 0.55, name: 'DAMP' },
  { max: WATER_T, name: 'WET' },
  { max: 2, name: 'WATER' },
];
const bandOf = (h) => BANDS.find((b) => h < b.max).name;
const shown = (h) => Math.floor(Math.min(1, h) * 100 + 1e-6) / 100; // never rounds up past the line
const CLOSE_T = 0.6;  // a miss at or above this is "close"
const STEP = 24;      // px per arrow tap
const TAP_SLOP = 6;   // a touch that travels this far is never a strike
const TAP_MS = 350;   // ...nor one held longer than this (by event time stamps)

// site night palette (CONTRACT) — flat fills only. Water-green is the seventh's own
// signal: it is the water you find.
const C = {
  ground: '#1B1410',
  mouth: '#060403',
  sand: '#DEA668',
  bone: '#F2EDE2',
  accent: '#FF5C14',
  water: '#3BE8B0',
};
const bone = (a) => `rgba(242,237,226,${a})`;
const sand = (a) => `rgba(222,166,104,${a})`;
const water = (a) => `rgba(59,232,176,${a})`;
const accent = (a) => `rgba(255,92,20,${a})`;

const KEYDIR = {
  ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
};

// ---------------------------------------------------------------------------- state
let S = null;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// --------------------------------------------------------------------------- styles
const CSS = `
.s7 { position:absolute; inset:0; }
.s7__exit {
  position:absolute; left:22px; bottom:20px; z-index:6;
  background:none; border:0; padding:8px 10px 8px 0;
  font-family:var(--font-mono); font-size:10px; letter-spacing:.22em;
  text-transform:uppercase; color:var(--bone); opacity:.5; cursor:none;
  transition:opacity 180ms, color 180ms;
}
.s7__exit:hover, .s7__exit:focus-visible { opacity:1; color:var(--water); outline:none; }
.s7__exit:focus-visible { text-decoration:underline; }
.s7__sr { position:absolute; width:1px; height:1px; margin:-1px; padding:0; border:0;
  overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }
.s7 canvas, .s7 .fx-layer { touch-action:none; }
.s7__slug {
  position:absolute; left:22px; top:20px; z-index:6; pointer-events:none;
  font-family:var(--font-mono); font-size:10px; letter-spacing:.24em;
  text-transform:uppercase; color:var(--bone); opacity:.34; line-height:1.9;
}
@media (max-width:359px) { .s7__slug { font-size:9px; letter-spacing:.12em; } }
.s7__slug b { font-family:var(--font-display); font-size:30px; letter-spacing:.06em;
  display:block; opacity:.5; line-height:1; margin-bottom:6px; font-weight:400; }
/* short landscape (phone on its side): compact chrome; must match geo().short */
@media (max-height:479px) and (min-aspect-ratio:23/20) {
  .s7__slug { left:16px; top:14px; letter-spacing:.12em; }
  .s7__slug b { font-size:20px; margin-bottom:3px; }
  .s7__exit { left:16px; bottom:10px; }
}

.s7__pay {
  position:absolute; inset:0; z-index:8; display:grid; place-items:center;
  text-align:center; padding:6vh 7vw; opacity:0; overflow:auto; overscroll-behavior:contain;
  transition:opacity 900ms ease-out;
  background:rgba(27,20,16,.92);
}
.s7__pay[data-in="1"] { opacity:1; }
.s7__payin { max-width:min(760px, 86vw); }
.s7__kick { font-family:var(--font-mono); font-size:10px; letter-spacing:.3em;
  text-transform:uppercase; color:var(--bone); opacity:.55; margin-bottom:26px; }
.s7__kick i { color:var(--water); font-style:normal; opacity:1; }
.s7__big { font-family:var(--font-he); direction:rtl; font-weight:900;
  font-size:clamp(46px, 9vw, 104px); line-height:.94; color:var(--water);
  margin-bottom:6px; }
.s7__lat { font-family:var(--font-display); font-size:clamp(14px,1.7vw,20px);
  letter-spacing:.42em; color:var(--bone); opacity:.6; margin-bottom:34px; }
.s7__he2 { font-family:var(--font-he); direction:rtl; font-weight:700;
  font-size:clamp(19px,2.6vw,30px); color:var(--bone); line-height:1.6; }
.s7__en2 { font-family:var(--font-mono); font-size:11px; letter-spacing:.26em;
  text-transform:uppercase; color:var(--water); opacity:.85; margin-top:10px; }
.s7__fine { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.2em;
  text-transform:uppercase; color:var(--bone); opacity:.44; line-height:2.2; margin-top:30px; }
.s7__iso { unicode-bidi:isolate; }
.s7__row { margin-top:36px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.s7__btn { font-family:var(--font-mono); font-size:10px; letter-spacing:.24em;
  text-transform:uppercase; padding:11px 18px; cursor:none;
  background:none; color:var(--bone); border:1px solid rgba(242,237,226,.26);
  transition:all 180ms; }
.s7__btn:hover, .s7__btn:focus-visible {
  color:var(--night); background:var(--water); border-color:var(--water); outline:none; }
.s7__btn--key { color:var(--water); border-color:rgba(59,232,176,.5); }
`;

// --------------------------------------------------------------------- geometry
// distance from a point to a rectangle (0 inside)
const dRect = (px, py, r) => Math.hypot(
  Math.max(r.x0 - px, 0, px - r.x1), Math.max(r.y0 - py, 0, py - r.y1));

let GEO = null;
function geo() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (GEO && GEO.W === W && GEO.H === H) return GEO;
  const portrait = W < H * 1.15;
  const narrow = W < 640;
  // short landscape (a phone on its side): compact chrome, readout docked in the left
  // column, no floating hint. Must match the CSS media query.
  const short = !portrait && H < 480;
  let cx = W * 0.5;
  // portrait: the ring (1.3R chalk + ticks) fits between the top chrome and the
  // gauge along the bottom; landscape: the ring takes the largest circle that clears
  // every piece of chrome (corners, gauge column, docked readout) and the screen edge.
  let cy;
  let R;
  if (portrait) {
    // top to bottom: chrome | ring (+ticks) | readout dock | gauge
    const top = TOP_SAFE + 22;
    const bot = gaugeTop(H) - 34 - 62 - 26;
    R = Math.max(80, Math.min(W * 0.34, (bot - top) / 2.6, H * 0.3));
    cy = bot - 1.3 * R >= top + 1.3 * R ? bot - 1.3 * R : (top + bot) / 2;
  } else {
    const g0 = { W, H, portrait, narrow, short };
    const rects = chromeRects(g0);
    if (short) rects.push({ x0: 0, x1: LEFT_COL, y0: 0, y1: H });
    // the outer reach of the ring: chalk at 1.3R plus the long ticks (18px)
    const capRo = 1.3 * Math.min(W * 0.27, H * 0.37) + 18;
    let best = null;
    const sx = Math.max(1, W * 0.004);
    const sy = Math.max(1, H * 0.01);
    for (let y = H * 0.4; y <= H * 0.6; y += sy) {
      for (let xx = W * 0.3; xx <= W * 0.7; xx += sx) {
        let Ro = Math.min(capRo, y - 8, H - y - 8);
        for (const r of rects) Ro = Math.min(Ro, dRect(xx, y, r) - 6);
        const sc = Ro - Math.abs(xx - W * 0.5) * 0.03 - Math.abs(y - H * 0.5) * 0.03;
        if (!best || sc > best.sc) best = { sc, x: xx, y, Ro };
      }
    }
    cx = best.x;
    cy = best.y;
    R = Math.max(56, (best.Ro - 18) / 1.3);
  }
  GEO = { W, H, cx, cy, R, portrait, narrow, short };
  return GEO;
}
const TOP_SAFE = 100; // below the slug and the WATER n/7 counter on a phone
const LEFT_COL = 158; // short landscape: slug, docked readout and exit share this column
const gaugeTop = (H) => H - (H < 700 ? 112 : 128);

// every piece of fixed chrome, as the boxes its text actually occupies (plus air)
function chromeRects(g) {
  const { W, H } = g;
  const s = g.short;
  const out = [
    { x0: 0, x1: s ? 150 : 232, y0: 0, y1: s ? 80 : 100 },     // slug
    { x0: W - 165, x1: W, y0: 0, y1: 78 },                     // WATER n/7
    { x0: 0, x1: s ? 160 : 180, y0: H - (s ? 40 : 50), y1: H }, // exit
    { x0: W - 140, x1: W, y0: H - 42, y1: H },                 // sound toggle
  ];
  const gb = gaugeBox(g);
  out.push(gb.vertical
    ? { x0: gb.x0 - 22, x1: W, y0: gb.y0 - 32, y1: gb.y1 + 10 }
    : { x0: 0, x1: W, y0: gb.y0 - 30, y1: gb.y1 + 28 });
  if (s) out.push(leftDock(g));
  const dk = g.portrait && g.R ? dockBox(g) : null;
  if (dk) out.push({ x0: 0, x1: W, y0: dk.y0 - 4, y1: dk.y1 + 4 });
  return out;
}

// short landscape: the readout docks in the left column, between slug and exit
function leftDock(g) {
  return g.short ? { x0: 16, x1: LEFT_COL - 8, y0: 88, y1: g.H - 46 } : null;
}

// the gauge: one flat block. Right edge on landscape, along the bottom on portrait.
function gaugeBox(g) {
  if (!g.portrait && g.short) {
    // compact: thinner, and starting under the counter, ending above the sound toggle
    const BW = 28;
    const x0 = g.W - 64 - BW;
    return { vertical: true, x0, x1: x0 + BW, y0: 106, y1: g.H - 50, BW, small: true };
  }
  if (!g.portrait) {
    const BW = 40;
    const x0 = g.W - 70 - BW;
    return { vertical: true, x0, x1: x0 + BW, y0: 130, y1: g.H - 100, BW };
  }
  const BW = g.H < 700 ? 30 : 36;
  const y0 = gaugeTop(g.H);
  return { vertical: false, x0: 24, x1: g.W - 24, y0, y1: y0 + BW, BW };
}

// portrait: the free band between the ring and the gauge, where the readout docks
// as a fixed instrument (the finger is on the glass; a floating number fights the
// names). Null when the band is too thin (e.g. 320x568): the readout floats instead.
function dockBox(g) {
  if (!g.portrait) return null;
  const y0 = g.cy + g.R * 1.3 + 26;
  const y1 = gaugeBox(g).y0 - 34;
  return y1 - y0 >= 62 ? { x0: 24, x1: g.W - 24, y0, y1 } : null;
}

// rod + readout scale: big on a desktop, still sane on a phone
function rodScale(g) {
  return Math.max(1.6, Math.min(3, Math.min(g.W, g.H) / 300));
}

// rectangles that the floating readout must never land on
const ovl = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

// an open well's mouth: bold, at least twice the old 15px, never wider than the
// spacing between wells allows (MIN_GAP * R between centres)
function mouthR(g) { return Math.max(30, Math.min(44, g.R * 0.12)); }
const shaftR = (g) => Math.max(30, g.R * 0.17);

// Where every open well's name sits, and where the SEVENTH caption sits: placed, not
// assumed. Each box is tried in order of preference around its owner and taken only
// when it clears the chrome, the gauge, the legend, every open mouth, the shaft and
// the boxes already placed. The newest well is placed first, at full size; a name
// that finds no room steps down a size. Cached until the layout can change.
const HE_FONT = (px) => `700 ${px}px Heebo, "Arial Hebrew", sans-serif`;
const MONO = (px) => `700 ${px}px "IBM Plex Mono", monospace`;
function layout(g) {
  const fonts = document.fonts ? document.fonts.status : '';
  const key = [g.W, g.H, S.seed, S.nodes.map((n) => (n.open ? 1 : 0)).join(''),
    S.phase === 'ring' ? 1 : 0, (S.legend || []).length, fonts].join('|');
  if (S.lay && S.lay.key === key) return S.lay;
  if (!S.mctx) S.mctx = document.createElement('canvas').getContext('2d');
  const m = S.mctx;
  const mw = (font, t) => { m.font = font; return m.measureText(t).width; };
  const mr = mouthR(g);
  const rr = shaftR(g);
  const M = 6; // screen margin
  const obs = chromeRects(g).concat(S.legend || []);
  const disc = (x, y, r) => ({ x0: x - r, x1: x + r, y0: y - r, y1: y + r });
  const open = S.nodes.filter((n) => n.open);
  for (const n of open) { const p = nodeXY(n, g); obs.push(disc(p.x, p.y, mr + 6)); }
  // the shaft, and in the ring phase its wet patch is where the eye goes: keep it clear
  obs.push(disc(g.cx, g.cy, rr + 6));
  const hits = (b) => {
    if (b.x0 < M || b.y0 < M || b.x1 > g.W - M || b.y1 > g.H - M) return Infinity;
    let c = 0;
    for (const o of obs) c += ovl(b, o);
    return c;
  };
  // a box of w x h pushed off a circle (x, y, r) along angle th
  const off = (x, y, r, th, w, h) => {
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const d = r + Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2;
    const bx = x + ux * d;
    const by = y + uy * d;
    return { x0: bx - w / 2, x1: bx + w / 2, y0: by - h / 2, y1: by + h / 2 };
  };


  const labels = new Map();
  const order = open.slice().sort((a, b) => b.openT - a.openT);
  const base = g.narrow ? 16 : 19;
  for (const n of order) {
    const p = nodeXY(n, g);
    const out = Math.atan2(p.y - g.cy, p.x - g.cx);
    const dirs = [0, 1, -1, 2, -2, 3, -3, 4, 5, -5, 6, -6, 7, -7, 8].map((k) => out + (k * Math.PI) / 8);
    let pick = null;
    let fallback = null;
    // last resorts on a crowded small screen: the Hebrew alone, then a little smaller
    for (const tier of [2.25, 2, 1.5, 1.25, 1, 0.99, 0.85]) {
      const solo = tier < 1;
      const he = Math.round(base * tier);
      const en = tier >= 2 ? 12 : tier >= 1.25 ? 11 : 9;
      const name = g.narrow ? n.well.name : n.well.name + '  ·  ' + n.well.n;
      const w = (solo ? mw(HE_FONT(he), n.well.he) : Math.max(mw(HE_FONT(he), n.well.he), mw(MONO(en), name))) + 10;
      const h = Math.round(he * 1.05 + (solo ? 2 : 4 + en + 2));
      for (const gap of [6, 22, 40]) {
        for (const th of dirs) {
          const box = off(p.x, p.y, mr + gap, th, w, h);
          const c = hits(box);
          const L = { box, he, en, name: solo ? '' : name };
          if (c === 0) { pick = L; break; }
          if (tier === 0.85 && (!fallback || c < fallback.c)) fallback = { ...L, c };
        }
        if (pick) break;
      }
      if (pick) break;
    }
    if (!pick) pick = fallback;
    labels.set(n, pick);
    obs.push(pick.box);
  }

  // SEVENTH: a plate near the shaft, below it by preference, wherever it fits
  let caption = null;
  if (S.phase === 'ring') {
    const late = 'S E V E N T H  ·  S T R I K E   H E R E';
    const early = 'S E V E N T H';
    const angs = [];
    for (let k = 0; k < 24; k++) angs.push((k / 24) * TAU);
    const pref = (a) => Math.abs(((a - Math.PI / 2 + Math.PI * 3) % TAU) - Math.PI);
    angs.sort((a, b) => pref(a) - pref(b));
    let fb = null;
    for (const [he, sub, txt] of [[22, 10, late], [22, 10, early], [18, 9, early]]) {
      const w = Math.max(96, mw(MONO(sub), txt) + 20, mw(HE_FONT(he), 'השביעית') + 20);
      const h = Math.round(he + sub + 14);
      for (let d = rr + 6; d < g.R * 1.4 && !caption; d += 8) {
        for (const a of angs) {
          const box = off(g.cx, g.cy, d, a, w, h);
          const c = hits(box);
          if (c === 0) { caption = { box, he, sub, full: txt === late }; break; }
          if (!fb || c < fb.c) fb = { box, he, sub, full: false, c };
        }
      }
      if (caption) break;
    }
    // no free ground near the shaft (a small phone, the six packed round it): the
    // docked instrument carries the caption instead of dropping it
    if (!caption) caption = dockBox(g) || leftDock(g) ? { inDock: true } : fb;
    if (caption && caption.box) obs.push(caption.box);
  }

  S.lay = { key, labels, caption };
  return S.lay;
}

// the ghost "dry field" note: only while the field is still dry
function ghostXY(g) {
  // inside the plot, between the inner chalk (0.52R) and the vein (R), off every line
  return g.narrow || g.short
    ? { x: g.cx, y: g.cy - g.R * 0.72 }
    : { x: g.cx - g.R * 0.5, y: g.cy - g.R * 0.52 };
}

function hitR(g) { return Math.max(36, g.R * 0.19); }
function centreHitR(g) { return Math.max(52, g.R * 0.3); }

function nodeXY(n, g) {
  return { x: g.cx + Math.cos(n.a) * g.R * n.rr, y: g.cy + Math.sin(n.a) * g.R * n.rr };
}

// --------------------------------------------------------------------- static art
function buildStatic(g) {
  // a 0x0 viewport (minimised, hidden iframe) has nothing to draw into
  if (g.W < 1 || g.H < 1) { S.stat = null; return; }
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.max(1, Math.round(g.W * dpr));
  c.height = Math.max(1, Math.round(g.H * dpr));
  const x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ground: flat warm ink
  x.fillStyle = C.ground;
  x.fillRect(0, 0, g.W, g.H);

  // sand speckle — hand texture, deterministic
  const r = S.ctx.fx.rnd(7777);
  x.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) {
    const px = r() * g.W;
    const py = r() * g.H;
    const s = r();
    x.fillStyle = s > 0.86 ? bone(0.07) : sand(0.07);
    x.fillRect(px, py, s > 0.97 ? 2 : 1, 1);
  }
  // wind-combed dune lines
  x.strokeStyle = 'rgba(242,237,226,.035)';
  x.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y0 = r() * g.H;
    x.beginPath();
    for (let px = -20; px < g.W + 20; px += 26) {
      const yy = y0 + Math.sin((px + i * 90) * 0.004) * 16 + Math.sin(px * 0.019) * 3;
      px === -20 ? x.moveTo(px, yy) : x.lineTo(px, yy);
    }
    x.stroke();
  }

  // the surveyed basin: a chalk circle drawn by hand, twice, slightly off
  const chalk = (rad, alpha, wob, lw = 1.4) => {
    x.strokeStyle = bone(alpha);
    x.lineWidth = lw;
    x.beginPath();
    for (let a = 0; a <= TAU + 0.01; a += 0.045) {
      const rr = rad + Math.sin(a * 3.1 + wob) * wob * 2.2 + Math.sin(a * 7.7) * 1.4;
      const px = g.cx + Math.cos(a) * rr;
      const py = g.cy + Math.sin(a) * rr;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  };
  // the plot ring: a bold chalk stroke, the edge of where you may dig
  const ringW = Math.max(3, g.R * 0.014);
  chalk(g.R * 1.3, 0.55, 1.6, ringW);
  chalk(g.R * 1.345, 0.16, 2.6, 1.4);
  chalk(g.R * 0.52, 0.12, 2.0, 1.6);

  // rim ticks every 15deg, long every 90
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const long = i % 6 === 0;
    const r0 = g.R * 1.3;
    const r1 = r0 + (long ? 18 : 8);
    x.strokeStyle = bone(long ? 0.6 : 0.3);
    x.lineWidth = long ? ringW : 1.4;
    x.beginPath();
    x.moveTo(g.cx + Math.cos(a) * r0, g.cy + Math.sin(a) * r0);
    x.lineTo(g.cx + Math.cos(a) * r1, g.cy + Math.sin(a) * r1);
    x.stroke();
  }

  // surveyor's spokes — hand-ruled, stopping short, imperfect
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    const r0 = g.R * (0.56 + r() * 0.1);
    const r1 = g.R * (1.12 + r() * 0.16);
    x.strokeStyle = bone(0.07);
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(g.cx + Math.cos(a) * r0, g.cy + Math.sin(a) * r0);
    x.lineTo(g.cx + Math.cos(a) * r1, g.cy + Math.sin(a) * r1);
    x.stroke();
  }

  // faint ghost ring where the vein lies — a surveyor's guess, not an answer
  x.setLineDash([2, 9]);
  x.strokeStyle = bone(0.14);
  x.lineWidth = 1;
  x.beginPath();
  x.arc(g.cx, g.cy, g.R, 0, TAU);
  x.stroke();
  x.setLineDash([]);

  // the survey legend: placed only where it has room. Above the ring, else below
  // it, else in the free column under the slug; never on the chrome or the gauge.
  const COORD = '3 1 ° 1 5 ′ N    3 4 ° 4 7 ′ E';
  const PLOT = 'P L O T   V I I   —   U N N A M E D';
  const ringTop = g.cy - g.R * 1.3 - 22;
  const ringBot = g.cy + g.R * 1.3 + 22;
  const gb = gaugeBox(g);
  const dock = dockBox(g);
  const floor = dock ? dock.y0 - 6 : g.portrait ? gb.y0 - 30 : g.H - 58; // above the gauge label / the exit
  const ceil = g.narrow ? TOP_SAFE + 12 : 34;       // under the slug + counter
  const lines = [[COORD, '10px', 0.5], [PLOT, '9px', 0.3]];
  const placed = [];
  let below = ringBot + 12;
  // the coordinates prefer the top band (ceil already clears the slug + counter)
  if (ringTop - 6 >= ceil) placed.push([0, g.cx, Math.max(ceil, ringTop - 6), 'center']);
  for (let i = 0; i < 2; i++) {
    if (placed.some((q) => q[0] === i)) continue;
    if (below <= floor) { placed.push([i, g.cx, below, 'center']); below += 18; }
  }
  // landscape fallback: the column under the slug, if the ring leaves it free
  // (a short screen docks the readout there instead)
  if (!g.portrait && !g.short) {
    let ly = 132;
    for (let i = 0; i < 2; i++) {
      if (placed.some((q) => q[0] === i)) continue;
      x.font = lines[i][1] + ' "IBM Plex Mono", monospace';
      if (22 + x.measureText(lines[i][0]).width < g.cx - g.R * 1.3 - 30) {
        placed.push([i, 22, ly, 'left']); ly += 18;
      }
    }
  }
  S.legend = [];
  for (const [i, px, py, al] of placed) {
    x.textAlign = al;
    x.font = lines[i][1] + ' "IBM Plex Mono", monospace';
    const tw = x.measureText(lines[i][0]).width;
    const lx0 = al === 'center' ? px - tw / 2 : px;
    S.legend.push({ x0: lx0, x1: lx0 + tw, y0: py - 12, y1: py + 4 });
    x.fillStyle = bone(lines[i][2]);
    x.fillText(lines[i][0], px, py);
  }
  x.textAlign = 'left';

  S.stat = c;
  S.statDpr = dpr;
}

// ------------------------------------------------------------------------- build
// A fresh layout per visit (and per "dig again"), within limits that keep it
// solvable: one well per sixth of the ring (so the vein still closes in order),
// a minimum spacing so no two strike zones meet, radii between the dry shaft and
// the plot edge, and the centre shaft always the point the six converge on.
const MIN_GAP = 0.8;   // in R units: > 2 strike radii even at the floored hit size
const RR_MIN = 0.84;   // clear of the centre's own strike zone (0.3R)
const RR_MAX = 1.1;    // inside the plot ring (1.3R) with room for the strike zone
function makeNodes(seed, g) {
  const r = S.ctx.fx.rnd(seed);
  // the bold mouth stays inside the plot ring, and clear of the dry shaft
  const mr = mouthR(g);
  const hi = Math.min(RR_MAX, (g.R * 1.3 - mr - 6) / g.R);
  const lo = Math.max(Math.min(RR_MIN, hi - 0.06), (shaftR(g) + mr + 6) / g.R);
  for (let tries = 0; tries < 400; tries++) {
    const base = r() * TAU;
    const pts = SIX.map((w, i) => ({
      a: base + (i / 6) * TAU + (r() - 0.5) * 0.9,
      rr: lo + r() * Math.max(0, hi - lo),
    }));
    let ok = true;
    for (let i = 0; i < 6 && ok; i++) {
      for (let j = i + 1; j < 6; j++) {
        const d = Math.hypot(
          Math.cos(pts[i].a) * pts[i].rr - Math.cos(pts[j].a) * pts[j].rr,
          Math.sin(pts[i].a) * pts[i].rr - Math.sin(pts[j].a) * pts[j].rr);
        if (d < MIN_GAP) { ok = false; break; }
      }
    }
    if (!ok) continue;
    return SIX.map((w, i) => ({ ...pts[i], open: false, openT: -1, well: w }));
  }
  // never reached in practice; the even ring is always valid
  return SIX.map((w, i) => ({
    a: -Math.PI / 2 + (i / 6) * TAU, rr: Math.max(lo, Math.min(hi, 0.97)), open: false, openT: -1, well: w,
  }));
}

function reset(hard) {
  const g = geo();
  S.seed = ((Math.random() * 4294967295) >>> 0) || 7;
  S.nodes = makeNodes(S.seed, g);
  S.lay = null;
  S.pits = [];
  S.ripples = [];
  S.centreOpen = false;
  S.phase = 'play';
  S.hintT = 0;
  S.taught = false;
  S.floodT = 0;
  S.closeT = -1;
  S.strikes = 0;
  S.cutT = -1e9;
  S.cutWell = null;
  S.missT = -1e9;
  S.lastStrike = null;
  S.lastBand = null;
  // start on the driest spot beside the shaft, so the first reading is honestly low
  let best = null;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const px = g.cx + Math.cos(a) * g.R * 0.3;
    const py = g.cy + Math.sin(a) * g.R * 0.3;
    const h = rawReading(px, py, g, 'play').heat;
    if (!best || h < best.h) best = { px, py, h };
  }
  S.rod.x = S.rod.tx = best.px;
  S.rod.y = S.rod.ty = best.py;
  S.rod.ang = 0;
  S.rod.buzz = 0;
  S.aim = { x: S.rod.tx, y: S.rod.ty, t: 0, said: true };
  if (hard && S.pay) { S.pay.remove(); S.pay = null; }
  setExitTabbable(false);
  say('Plot seven, dry. Reading dry, ' + shown(best.h).toFixed(2) + '. Water 0 of 7.');
}

// during play the exit is reachable by Escape and by pointer, never by Tab/Space
function setExitTabbable(on) {
  if (S && S.exit) S.exit.tabIndex = on ? 0 : -1;
}

// visually hidden live status. Nothing is throttled: strike results are spoken at
// once, and the reading is spoken once the aim comes to rest (see update), so a
// sweeping rod never floods a reader and a stopped one is never stale.
function say(text) {
  if (!S) return;
  if (S.sr) S.sr.textContent = text;
  else S.srQueue = text;
}


// --------------------------------------------------------------------- mechanics
function nearestClosed(g, rx = S.rod.x, ry = S.rod.y) {
  let best = null;
  let bd = 1e9;
  for (const n of S.nodes) {
    if (n.open) continue;
    const p = nodeXY(n, g);
    const d = dist(rx, ry, p.x, p.y);
    if (d < bd) { bd = d; best = { n, p, d }; }
  }
  return best;
}

// Moisture curve. Inside the strike radius it reads WATER_T..1; outside it decays
// exponentially, so open sand reads clearly low (< .3 once ~0.7R from any water) and
// the jump across the line is the strike radius itself — no hidden threshold.
function curve(d, hr, g) {
  if (d <= hr) return WATER_T + (1 - WATER_T) * (1 - d / hr);
  // where the strike radius is floored (small screens) the fall-off steepens to match
  const L = Math.max(30, g.R * 0.5 - (hr - g.R * 0.19));
  return WATER_T * Math.exp(-(d - hr) / L);
}

function rawReading(rx, ry, g, phase) {
  if (phase === 'ring') {
    const d = dist(rx, ry, g.cx, g.cy);
    return { heat: curve(d, centreHitR(g), g), t: { n: null, p: { x: g.cx, y: g.cy }, d } };
  }
  if (phase !== 'play') return { heat: 0, t: null };
  const t = nearestClosed(g, rx, ry);
  if (!t) return { heat: 0, t: null };
  return { heat: curve(t.d, hitR(g), g), t };
}

function reading(g) {
  return rawReading(S.rod.x, S.rod.y, g, S.phase);
}

function openCount() { return S.nodes.filter((q) => q.open).length + (S.centreOpen ? 1 : 0); }

function openNode(n, g, ctx) {
  n.open = true;
  n.openT = S.t;
  S.hintT = 0;
  const p = nodeXY(n, g);
  S.ripples.push({ x: p.x, y: p.y, t: 0, life: 1500, water: true });
  // the misses that found this well are history now: they would sit on its name
  const lb = layout(g).labels.get(n).box;
  S.pits = S.pits.filter((q) => {
    const px = q.nx * g.W;
    const py = q.ny * g.H;
    const box = { x0: px - 26, x1: px + 26, y0: py - 8, y1: py + 24 };
    return dist(px, py, p.x, p.y) > hitR(g) * 2.2 && !ovl(box, lb);
  });
  const k = S.nodes.filter((q) => q.open).length;
  // the beat: a hard cut to a flat water-green frame carrying the well's name
  S.cutT = S.t;
  S.cutWell = n.well;
  S.cutK = k;
  ctx.audio.drip({ pitch: 0.82 + k * 0.1 });
  ctx.audio.tone(140 + k * 26, { dur: 0.7, type: 'triangle', gain: 0.1, slideTo: 280 + k * 40 });
  ctx.fx.shake(170, 4);
  say('Water! ' + n.well.name + ', ' + n.well.he + '. Water ' + k + ' of 7.' +
    (k === 6 ? ' The ring is closed. Six lines meet at the dry centre. Dig it.' : ''), true);
  if (k === 6) {
    S.phase = 'ring';
    S.closeT = S.t;
    S.hintT = 0;
    S.lastBand = null;
    ctx.audio.tone(98, { dur: 2.4, type: 'sine', gain: 0.14, slideTo: 196 });
    ctx.audio.tone(147, { dur: 2.2, type: 'triangle', gain: 0.07, slideTo: 294, delay: 0.1 });
    ctx.fx.shake(520, 7);
  }
}

function resolve(ctx) {
  if (S.phase === 'flood' || S.phase === 'done') return;
  S.phase = 'flood';
  S.floodT = 0;
  S.centreOpen = true;
  S.pits = []; // the end card shows the six and the seventh, not the misses
  const g = geo();
  S.ripples.push({ x: g.cx, y: g.cy, t: 0, life: 2600, water: true, big: true });
  try { ctx.store.set('seventh.found', true); ctx.store.mark('seventh'); } catch {}
  ctx.audio.thud({ gain: 0.6 });
  ctx.audio.tone(55, { dur: 3.6, type: 'sine', gain: 0.18, slideTo: 110 });
  for (let i = 0; i < 7; i++) ctx.audio.drip({ pitch: 0.6 + i * 0.16, delay: 0.18 + i * 0.17 });
  ctx.audio.noise({ dur: 2.2, gain: 0.07, band: [160, 1400], delay: 0.1 });
  say('Water at seven of seven. Be\'er Sheva: the well of seven.', true);
  if (!ctx.fx.reducedMotion) {
    ctx.fx.flash('rgba(59,232,176,.5)', 420);
    ctx.fx.shake(900, 10);
  }
}

function strike(ctx) {
  if (!S || S.phase === 'flood' || S.phase === 'done') return;
  const g = geo();
  S.taught = true;
  S.strikes++;
  S.rod.buzz = 1;
  // you strike where you aim: a rod still swinging in lands on its target first,
  // so the number just spoken (at rest) is the number that decides the strike
  S.rod.x = S.rod.tx;
  S.rod.y = S.rod.ty;
  if (S.aim) { S.aim.x = S.rod.tx; S.aim.y = S.rod.ty; S.aim.said = true; }

  // one source of truth: the number on the gauge decides the strike
  const { heat, t: target } = reading(g);
  if (heat >= WATER_T && target) {
    if (S.phase === 'ring') { resolve(ctx); return; }
    if (target.n) { openNode(target.n, g, ctx); return; }
  }

  // striking a mouth that is already open: it splashes, it does not leave a pit
  for (const n of S.nodes) {
    if (!n.open) continue;
    const p = nodeXY(n, g);
    if (dist(S.rod.x, S.rod.y, p.x, p.y) < hitR(g)) {
      S.ripples.push({ x: p.x, y: p.y, t: 0, life: 700, water: true });
      ctx.audio.drip({ pitch: 1.3 });
      say(n.well.name + ' is already open. Water ' + openCount() + ' of 7.', true);
      return;
    }
  }

  // dry: a pit, a dust puff, and a number you can triangulate from
  const close = heat >= CLOSE_T;
  S.pits.push({
    nx: S.rod.x / g.W, ny: S.rod.y / g.H,
    val: shown(heat),
    close,
    t: S.t,
    seed: Math.random() * 10,
  });
  S.lastStrike = shown(heat);
  if (close) S.missT = S.t;
  say((close ? 'Close. ' : 'Dry. ') + bandOf(heat).toLowerCase() + ', ' + shown(heat).toFixed(2) +
    '. Water needs ' + WATER_T.toFixed(2) + '.', true);
  if (S.pits.length > 34) S.pits.shift();
  S.ripples.push({ x: S.rod.x, y: S.rod.y, t: 0, life: 620, water: false });
  ctx.audio.noise({ dur: 0.26, gain: 0.16, band: [110, 820] });
  ctx.audio.tone(78, { dur: 0.2, type: 'sine', gain: 0.1, slideTo: 44 });
  ctx.fx.shake(110, 3);
}

// ------------------------------------------------------------------------ payoff
function buildPayoff(ctx, returning) {
  if (S.pay) return;
  const el = document.createElement('div');
  el.className = 's7__pay';
  el.innerHTML =
    '<div class="s7__payin">' +
      '<div class="s7__kick">' + (returning
        ? 'PLOT VII · 31°15′N 34°47′E · <i>THE WATER REMEMBERS YOU</i>'
        : 'PLOT VII · 31°15′N 34°47′E · <i>WATER AT 7 / 7</i>') + '</div>' +
      '<div class="s7__big">באר שבע</div>' +
      '<div class="s7__lat">WELL OF SEVEN</div>' +
      '<div class="s7__he2">באר לא מוצאים.<br>באר חופרים.</div>' +
      '<div class="s7__en2">A well is not found. A well is dug.</div>' +
      '<div class="s7__fine">' + (returning
        ? 'YOU CAME BACK TO A WELL YOU DUG.<br>IT IS STILL WET.'
        : 'SIX WELLS WERE DUG BY OTHERS.<br>THE SEVENTH IS WHOEVER DIGS NEXT.') + '</div>' +
      '<div class="s7__row">' +
        '<button class="s7__btn s7__btn--key" data-act="surface">↑ the other six</button>' +
        '<button class="s7__btn" data-act="again">↺ dig it again</button>' +
      '</div>' +
      '<div class="s7__fine" style="margin-top:22px;opacity:.32">7 WELLS INDIES' +
        '<span class="s7__iso"> · </span>' +
        '<span class="s7__iso" style="font-family:var(--font-he);direction:rtl">באר שבע</span>' +
        '<span class="s7__iso"> · #7WELLS</span></div>' +
    '</div>';
  S.root.appendChild(el);
  S.pay = el;
  const click = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'surface') { ctx.go('surface', { from: 'seventh' }); return; }
    reset(true);
    ctx.audio.noise({ dur: 0.5, gain: 0.1, band: [90, 700] });
    if (S.slug) {
      S.slug.innerHTML = '<b>VII</b>NO NAME · NO DEPTH<br>SURVEY STATUS: ' +
        '<span style="color:#DEA668">DRY</span>';
    }
  };
  el.addEventListener('click', click);
  S.listeners.push([el, 'click', click]);
  requestAnimationFrame(() => { if (S.pay === el) el.dataset.in = '1'; });
  const btn = el.querySelector('[data-act="surface"]');
  if (btn) setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch {} }, 1200);
}

// -------------------------------------------------------------------------- draw
// what the floating readout must keep off: chrome, gauge, open names, the ghost note
function blockers(g) {
  const out = chromeRects(g);
  for (const b of S.legend || []) out.push(b);
  const L = layout(g);
  const mr = mouthR(g);
  for (const n of S.nodes) {
    if (!n.open) continue;
    out.push(L.labels.get(n).box);
    const p = nodeXY(n, g);
    out.push({ x0: p.x - mr, x1: p.x + mr, y0: p.y - mr, y1: p.y + mr });
  }
  const rr = shaftR(g);
  out.push({ x0: g.cx - rr, x1: g.cx + rr, y0: g.cy - rr, y1: g.cy + rr });
  if (L.caption && L.caption.box) out.push(L.caption.box);
  if (ghostOn()) {
    const p = ghostXY(g);
    out.push({ x0: p.x - 50, x1: p.x + 50, y0: p.y - 16, y1: p.y + 18 });
  }
  return out;
}

// the SEVENTH caption as the instrument's own label: השביעית · SEVENTH (left-aligned),
// stepped down until it fits the width it is given
function dockCaption(x, px, py, fpx, maxW) {
  const pulse = 0.5 + 0.5 * Math.sin(S.t * (S.reduced ? 0.0014 : 0.0032));
  let f = fpx;
  let hw = 0;
  for (; f > 8; f--) {
    x.font = HE_FONT(Math.round(f * 1.3));
    hw = x.measureText('השביעית').width;
    x.font = MONO(f);
    if (hw + f * 0.6 + x.measureText('·  SEVENTH').width <= maxW) break;
  }
  x.font = HE_FONT(Math.round(f * 1.3));
  x.fillStyle = water(0.7 + pulse * 0.3);
  x.fillText('השביעית', px, py);
  x.font = MONO(f);
  x.fillStyle = bone(0.7);
  x.fillText('·  SEVENTH', px + hw + f * 0.6, py);
}

function drawRod(x, g, heat, target) {
  const r = S.rod;
  const s = rodScale(g);
  const len = 60 * s;
  const buzz = r.buzz * (S.reduced ? 2 : 6) * (s / 1.5);
  const bx = r.x + (Math.random() - 0.5) * buzz;
  const by = r.y + (Math.random() - 0.5) * buzz;
  const wet = heat >= WATER_T;
  const hot = heat > 0.55;
  const ink = wet ? C.water : hot ? C.accent : C.bone;

  // lamp pool — the light you carry: a flat disc of sand light
  const pr = (40 + heat * 60) * s;
  x.fillStyle = sand(0.07 + heat * 0.09);
  x.beginPath();
  x.arc(bx, by, pr, 0, TAU);
  x.fill();

  // the V rod, pointing where it reads — a bold, full stroke
  const a = r.ang;
  const spread = 0.5 - heat * 0.28;
  x.strokeStyle = ink;
  x.lineWidth = 5 * s;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(bx - Math.cos(a) * 12 * s, by - Math.sin(a) * 12 * s);
  x.lineTo(bx, by);
  x.stroke();
  for (const sg of [-1, 1]) {
    x.beginPath();
    x.moveTo(bx, by);
    x.lineTo(bx + Math.cos(a + sg * spread) * len, by + Math.sin(a + sg * spread) * len);
    x.stroke();
  }
  // tip bob
  const tipx = bx + Math.cos(a) * (len * 0.8);
  const tipy = by + Math.sin(a) * (len * 0.8);
  x.beginPath();
  x.arc(tipx, tipy, (4 + heat * 6) * s, 0, TAU);
  x.fillStyle = wet ? C.water : hot ? C.accent : C.sand;
  x.fill();
  // plumb ring: the exact spot a strike lands
  x.lineWidth = Math.max(3, s * 1.8);
  x.strokeStyle = ink;
  x.beginPath();
  x.arc(bx, by, 9 * s, 0, TAU);
  x.stroke();
  x.fillStyle = C.mouth;
  x.beginPath();
  x.arc(bx, by, 9 * s - x.lineWidth / 2, 0, TAU);
  x.fill();

  // moisture readout — big, in whichever quadrant is free: away from the rod,
  // off every open name, off the chrome and the gauge. Hysteresis stops flicker.
  const fs = Math.round(Math.min(84, Math.max(52, 26 * s)));
  const lblFs = Math.max(11, Math.round(fs * 0.2));
  const bandFs = Math.max(12, Math.round(fs * 0.3));
  x.font = `700 ${fs}px "IBM Plex Mono", monospace`;
  const bw = Math.max(x.measureText('0.00').width, fs * 2.4);
  const bh = lblFs + fs + bandFs + 12;
  const gap = 14 * s;
  const closeNow = S.t - S.missT < 1600;
  const bandTxt = closeNow ? 'CLOSE — DIG NEARBY' : wet ? 'WATER · STRIKE' : bandOf(heat);
  const bandInk = closeNow ? C.accent : wet ? C.water : bone(0.75);
  const lbl = S.phase === 'ring' ? 'TO CENTRE' : 'MOISTURE';
  const dock = dockBox(g);
  const side = leftDock(g);
  // the SEVENTH caption, when the field had no room for it, rides in the instrument
  const capDock = S.phase === 'ring' && !!(layout(g).caption || {}).inDock;
  let rb = null;
  if (side) {
    // short landscape: a fixed instrument in the left column, stacked
    //   MOISTURE / 0.32 / DAMP  (+ a two-line chalk hint until the first strike)
    const fw = side.x1 - side.x0;
    x.font = MONO(100);
    const fsV = Math.round(Math.min(52, (100 * fw) / x.measureText('0.00').width));
    const lF = 11;
    let bF = 13;
    x.font = MONO(bF);
    while (bF > 9 && x.measureText('CLOSE — DIG NEARBY').width > fw) { bF--; x.font = MONO(bF); }
    const hint = !S.taught;
    const hF = 10;
    const stackH = lF + 6 + fsV + 8 + bF + (hint ? 14 + hF * 2 + 6 : 0);
    let y = Math.max(side.y0, (side.y0 + side.y1) / 2 - stackH / 2);
    x.textAlign = 'left';
    x.textBaseline = 'top';
    x.font = MONO(lF);
    x.fillStyle = bone(0.62);
    if (capDock) dockCaption(x, side.x0, y, lF, side.x1 - side.x0); else x.fillText(lbl, side.x0, y);
    y += lF + 6;
    x.font = MONO(fsV);
    x.fillStyle = ink;
    x.fillText(shown(heat).toFixed(2), side.x0, y);
    y += fsV + 8;
    x.font = MONO(bF);
    x.fillStyle = bandInk;
    x.fillText(bandTxt, side.x0, y);
    if (hint) {
      y += bF + 14;
      const p = 0.5 + 0.5 * Math.sin(S.t * 0.005);
      x.font = MONO(hF);
      x.fillStyle = bone(0.5 + p * 0.4);
      x.fillText(S.touch ? 'DRAG TO DOWSE' : 'MOVE TO DOWSE', side.x0, y);
      x.fillText(S.touch ? 'TAP TO STRIKE' : 'CLICK · SPACE', side.x0, y + hF + 6);
    }
    x.textBaseline = 'alphabetic';
  } else if (dock) {
    // docked: [ 0.32 | MOISTURE / DAMP ] centred in the band above the gauge
    const fsD = Math.round(Math.min(64, dock.y1 - dock.y0 - 12));
    const sFs = Math.max(12, Math.round(fsD * 0.3));
    x.font = `700 ${fsD}px "IBM Plex Mono", monospace`;
    const vw = x.measureText('0.00').width;
    x.font = `700 ${sFs}px "IBM Plex Mono", monospace`;
    const sw = Math.max(x.measureText(lbl).width, x.measureText('CLOSE — DIG NEARBY').width);
    const xs = Math.max(dock.x0, g.cx - (vw + 16 + sw) / 2);
    const ym = (dock.y0 + dock.y1) / 2;
    x.textAlign = 'left';
    x.textBaseline = 'middle';
    x.font = `700 ${fsD}px "IBM Plex Mono", monospace`;
    x.fillStyle = ink;
    x.fillText(shown(heat).toFixed(2), xs, ym);
    x.font = `700 ${sFs}px "IBM Plex Mono", monospace`;
    x.fillStyle = bone(0.62);
    if (capDock) dockCaption(x, xs + vw + 16, ym - sFs * 0.7, sFs, g.W - 12 - (xs + vw + 16)); else x.fillText(lbl, xs + vw + 16, ym - sFs * 0.7);
    x.fillStyle = bandInk;
    x.fillText(bandTxt, xs + vw + 16, ym + sFs * 0.7);
    x.textBaseline = 'alphabetic';
  } else {
  // eight candidate spots around the rod: four diagonal, four square-on
  const Q = [
    [gap, -gap - bh, 'left'], [-gap - bw, -gap - bh, 'right'],
    [-gap - bw, gap, 'right'], [gap, gap, 'left'],
    [gap * 2.4, -bh / 2, 'left'], [-gap * 2.4 - bw, -bh / 2, 'right'],
    [-bw / 2, -gap * 2.4 - bh, 'center'], [-bw / 2, gap * 2.4, 'center'],
  ];
  const block = blockers(g);
  // the fork itself, sampled along both tines and the handle
  const fork = [];
  for (const sg of [-1, 1]) {
    for (let i = 2; i <= 8; i++) {
      fork.push([bx + Math.cos(a + sg * spread) * len * (i / 8), by + Math.sin(a + sg * spread) * len * (i / 8)]);
    }
  }
  fork.push([bx - Math.cos(a) * 12 * s, by - Math.sin(a) * 12 * s], [bx, by]);
  const boxAt = (q) => {
    const x0 = bx + Q[q][0];
    const y0 = by + Q[q][1];
    return { x0, x1: x0 + bw, y0, y1: y0 + bh };
  };
  const cost = (q) => {
    const b = boxAt(q);
    let c = 0;
    // off-screen is the worst
    c += (Math.max(0, 8 - b.x0) + Math.max(0, b.x1 - (g.W - 8)) +
      Math.max(0, 8 - b.y0) + Math.max(0, b.y1 - (g.H - 8))) * bh * 6;
    const bi = { x0: b.x0 - 10, x1: b.x1 + 10, y0: b.y0 - 10, y1: b.y1 + 10 };
    for (const k of block) c += ovl(bi, k) * 2;
    const pad = 8 + 2.5 * s;
    for (const [fx, fy] of fork) {
      if (fx > b.x0 - pad && fx < b.x1 + pad && fy > b.y0 - pad && fy < b.y1 + pad) c += bw * bh * 0.25;
    }
    if (q === 2 || q === 3 || q === 7) c += bw * bh * 0.02; // a touch prefers above the finger
    if (q >= 4) c += bw * bh * 0.01;                         // diagonals read best
    return c;
  };
  let best = 0;
  let bc = Infinity;
  for (let q = 0; q < Q.length; q++) {
    const c = cost(q);
    if (c < bc) { bc = c; best = q; }
  }
  if (S.rq == null || S.rq >= Q.length || cost(S.rq) > bc + bw * bh * 0.08) S.rq = best;
  rb = boxAt(S.rq);
  const al = Q[S.rq][2];
  const ax = al === 'right' ? rb.x1 : al === 'left' ? rb.x0 : (rb.x0 + rb.x1) / 2;
  x.textAlign = al;
  x.textBaseline = 'top';
  x.font = `700 ${lblFs}px "IBM Plex Mono", monospace`;
  x.fillStyle = bone(0.62);
  x.fillText(lbl, ax, rb.y0);
  x.font = `700 ${fs}px "IBM Plex Mono", monospace`;
  x.fillStyle = ink;
  x.fillText(shown(heat).toFixed(2), ax, rb.y0 + lblFs + 2);
  x.font = `700 ${bandFs}px "IBM Plex Mono", monospace`;
  x.fillStyle = bandInk;
  x.fillText(bandTxt, ax, rb.y0 + lblFs + fs + 6);
  x.textBaseline = 'alphabetic';
  }

  // first-time affordance, in-world chalk, never a dialog; touch-specific on a phone.
  // A short screen has no room around the rod for it: the docked readout carries it.
  if (!S.taught && !g.short && g.H >= 400) {
    const p = 0.5 + 0.5 * Math.sin(S.t * 0.005);
    x.strokeStyle = bone(0.2 + p * 0.3);
    x.lineWidth = 1.5;
    x.setLineDash([3, 5]);
    x.beginPath();
    x.arc(bx, by, 18 * s + p * 4, 0, TAU);
    x.stroke();
    x.setLineDash([]);
    const l1 = S.touch ? 'DRAG ANYWHERE TO DOWSE' : 'MOVE TO DOWSE · CLICK TO STRIKE';
    const l2 = S.touch ? 'TAP TO STRIKE' : 'OR ARROWS · SPACE';
    x.font = '700 12px "IBM Plex Mono", monospace';
    const w = Math.max(x.measureText(l1).width, x.measureText(l2).width);
    // on the side of the rod away from the readout
    const hx = Math.max(12 + w / 2, Math.min(g.W - 12 - w / 2, bx));
    // beyond the fork's full reach, so it never crosses the rod at any angle
    const low = g.portrait ? gaugeBox(g).y0 - 36 : g.H - 60;
    let up = rb ? rb.y0 > by - bh / 2 : false;
    if (up && by - len - 30 - 14 < TOP_SAFE) up = false;
    else if (!up && by + len + 26 + 20 > low) up = by - len - 30 - 14 >= TOP_SAFE;
    const hy = up ? by - len - 30 : by + len + 26;
    x.textAlign = 'center';
    x.fillStyle = C.ground;
    x.fillRect(hx - w / 2 - 8, hy - 15, w + 16, 38);
    x.fillStyle = bone(0.6 + p * 0.4);
    x.fillText(l1, hx, hy);
    x.fillStyle = bone(0.65);
    x.fillText(l2, hx, hy + 17);
  }
  x.textAlign = 'left';

  // target lock bracket once the reading crosses the water line
  if (wet && target) {
    const w = 14 * s;
    x.strokeStyle = C.water;
    x.lineWidth = Math.max(3, 1.6 * s);
    x.lineCap = 'square';
    for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      x.beginPath();
      x.moveTo(target.p.x + qx * w, target.p.y + qy * w * 0.45);
      x.lineTo(target.p.x + qx * w, target.p.y + qy * w);
      x.lineTo(target.p.x + qx * w * 0.45, target.p.y + qy * w);
      x.stroke();
    }
    x.lineCap = 'round';
  }
}

// the scale: one flat colour block with the water line cut across it. Right edge on
// landscape, along the bottom on portrait. Remembers your last strike for comparison.
function drawGauge(x, g, heat) {
  const h = Math.min(1, heat);
  const wet = h >= WATER_T;
  const { vertical, x0, x1, y0, y1, BW } = gaugeBox(g);
  const pos = (v) => (vertical ? y1 - (y1 - y0) * v : x0 + (x1 - x0) * v);

  x.save();
  // the empty track: a flat mouth-black slot
  x.fillStyle = C.mouth;
  x.fillRect(x0, y0, x1 - x0, y1 - y0);
  // the reading: one flat block of one colour
  x.fillStyle = wet ? C.water : h > 0.55 ? C.accent : C.bone;
  if (vertical) x.fillRect(x0, pos(h), BW, y1 - pos(h));
  else x.fillRect(x0, y0, pos(h) - x0, BW);

  // band cuts: ground-coloured notches through the block, no outlines
  x.fillStyle = C.ground;
  for (const v of [0.3, 0.55]) {
    if (vertical) x.fillRect(x0, pos(v) - 1.5, BW, 3);
    else x.fillRect(pos(v) - 1.5, y0, 3, BW);
  }
  // THE line
  x.fillStyle = C.water;
  if (vertical) x.fillRect(x0 - 10, pos(WATER_T) - 3, BW + 20, 6);
  else x.fillRect(pos(WATER_T) - 3, y0 - 10, 6, BW + 20);

  // last strike marker
  if (S.lastStrike != null) {
    const v = pos(Math.min(1, S.lastStrike));
    x.fillStyle = S.t - S.missT < 1600 ? C.accent : bone(0.85);
    x.beginPath();
    if (vertical) { x.moveTo(x0 - 4, v); x.lineTo(x0 - 16, v - 8); x.lineTo(x0 - 16, v + 8); }
    else { x.moveTo(v, y0 - 4); x.lineTo(v - 8, y0 - 16); x.lineTo(v + 8, y0 - 16); }
    x.fill();
  }

  // labels
  const band = bandOf(h);
  const labels = [['DRY', 0.15], ['DAMP', 0.425], ['WET', 0.675], ['WATER', 0.9]];
  const lf = gaugeBox(g).small ? 11 : 12;
  x.font = `700 ${lf}px "IBM Plex Mono", monospace`;
  for (const [name, v] of labels) {
    const on = name === band;
    x.fillStyle = name === 'WATER' ? water(on ? 1 : 0.8) : bone(on ? 1 : 0.5);
    if (vertical) {
      x.textAlign = 'left';
      // on a short gauge WATER rides above the ".80" line label instead of on it
      const ly = name === 'WATER' ? Math.min(pos(v) + 4, pos(WATER_T) - 26) : pos(v) + 4;
      x.fillText(name, x1 + 12, ly);
    } else {
      x.textAlign = 'center';
      x.fillText(name, pos(v), y1 + 20);
    }
  }
  x.font = `700 ${lf}px "IBM Plex Mono", monospace`;
  x.fillStyle = C.water;
  if (vertical) {
    x.textAlign = 'left';
    x.fillText('.80', x1 + 12, pos(WATER_T) - 10);
    x.fillStyle = bone(0.62);
    x.textAlign = 'center';
    x.fillText('MOISTURE', (x0 + x1) / 2, y0 - 18);
  } else {
    x.textAlign = 'center';
    x.fillText('.80', pos(WATER_T), y0 - 14);
    x.fillStyle = bone(0.62);
    x.textAlign = 'left';
    x.fillText('MOISTURE', x0, y0 - 14);
  }
  x.restore();
  x.textAlign = 'left';
}

// Eye4U beat: on a hit, a hard cut to a flat water-green frame with the name in it.
// Reduced motion gets a soft, low-alpha wash instead of the cut.
function drawCut(x, g) {
  const age = S.t - S.cutT;
  if (S.reduced) {
    if (age < 0 || age > 450) return;
    x.fillStyle = water(0.14 * (1 - age / 450));
    x.fillRect(0, 0, g.W, g.H);
    return;
  }
  if (age < 0 || age > 120 || !S.cutWell) return;
  x.fillStyle = C.water;
  x.fillRect(0, 0, g.W, g.H);
  x.fillStyle = C.mouth;
  x.textAlign = 'center';
  x.font = '900 100px Heebo, "Arial Hebrew", sans-serif';
  const w100 = x.measureText(S.cutWell.he).width || 100;
  const fs = Math.min(g.H * 0.42, (100 * g.W * 0.86) / w100);
  x.font = `900 ${Math.round(fs)}px Heebo, "Arial Hebrew", sans-serif`;
  x.fillText(S.cutWell.he, g.cx, g.H * 0.5 + fs * 0.3);
  x.font = `${Math.round(Math.max(14, fs * 0.16))}px Anton, "Arial Narrow", sans-serif`;
  x.fillText(S.cutWell.name + '  ·  WATER ' + S.cutK + ' / 7', g.cx, g.H * 0.5 + fs * 0.3 + Math.max(30, fs * 0.5));
  x.textAlign = 'left';
}

// the ghost note "dry field": true only while the field is still dry
function ghostOn() {
  return S.phase === 'play' && !S.nodes.some((n) => n.open);
}
function drawGhost(x, g) {
  if (!ghostOn()) return;
  const p = ghostXY(g);
  x.textAlign = 'center';
  x.font = '700 15px Heebo, "Arial Hebrew", sans-serif';
  x.fillStyle = bone(0.22);
  x.fillText('שדה יבש', p.x, p.y);
  x.font = '9px "IBM Plex Mono", monospace';
  x.fillText('DRY FIELD', p.x, p.y + 14);
  x.textAlign = 'left';
}

function drawVein(x, g) {
  const open = S.nodes.map((n, i) => ({ n, i, p: nodeXY(n, g) }));
  x.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = open[i];
    const b = open[(i + 1) % 6];
    const both = a.n.open && b.n.open;
    const half = a.n.open !== b.n.open;
    if (!both && !half) continue;

    const from = a.n.open ? a : b;
    const to = a.n.open ? b : a;
    const frac = both ? 1 : 0.46 + Math.sin(S.t * 0.0013 + i) * 0.04;

    // jagged vein path
    const seg = 9;
    const pts = [];
    for (let k = 0; k <= seg; k++) {
      const t = (k / seg) * frac;
      const px = from.p.x + (to.p.x - from.p.x) * t;
      const py = from.p.y + (to.p.y - from.p.y) * t;
      const w = Math.sin(k * 2.7 + i * 5.1) * 7 * (k === 0 || k === seg ? 0 : 1);
      const nx = -(to.p.y - from.p.y);
      const ny = (to.p.x - from.p.x);
      const nl = Math.hypot(nx, ny) || 1;
      pts.push([px + (nx / nl) * w, py + (ny / nl) * w]);
    }
    x.beginPath();
    pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    if (both) {
      x.strokeStyle = C.water;
      x.lineWidth = Math.max(3, g.R * 0.014);
      x.stroke();
    } else {
      // a crack reaching for the piece that is still missing — the directional hint
      x.strokeStyle = bone(0.42);
      x.lineWidth = 2;
      x.stroke();
      x.setLineDash([2, 7]);
      x.strokeStyle = bone(0.22);
      x.beginPath();
      const last = pts[pts.length - 1];
      x.moveTo(last[0], last[1]);
      x.lineTo(from.p.x + (to.p.x - from.p.x) * 0.72, from.p.y + (to.p.y - from.p.y) * 0.72);
      x.stroke();
      x.setLineDash([]);
    }
  }
}

function drawNodes(x, g) {
  const mr = mouthR(g);
  const lay = layout(g);
  // the wet patch never reaches a neighbour's mouth
  const halo = Math.min(mr * 1.5, MIN_GAP * g.R - mr - 4);
  for (const n of S.nodes) {
    if (!n.open) continue;
    const p = nodeXY(n, g);
    // it lands: straight after the cut the mouth slams in oversized and settles
    const age = Math.min(1, Math.max(0, S.t - n.openT - 120) / 420);
    const land = S.reduced ? 1 : 1 + 0.45 * Math.pow(1 - age, 3);
    const r = mr * land;

    // a flat wet patch, then the mouth: one bold disc of water with a dark throat
    if (halo > mr + 2) {
      x.fillStyle = water(0.16);
      x.beginPath();
      x.arc(p.x, p.y, halo * land, 0, TAU);
      x.fill();
    }
    x.fillStyle = C.water;
    x.beginPath();
    x.arc(p.x, p.y, r, 0, TAU);
    x.fill();
    x.fillStyle = C.mouth;
    x.beginPath();
    x.arc(p.x, p.y, r * (0.34 + 0.03 * Math.sin(S.t * 0.003 + n.a * 5)), 0, TAU);
    x.fill();

    // named in Hebrew, large, beside it, wherever layout() found room
    const L = lay.labels.get(n);
    if (!L) continue;
    const b = L.box;
    const mx = (b.x0 + b.x1) / 2;
    x.globalAlpha = S.reduced ? 1 : Math.min(1, Math.max(0, S.t - n.openT - 120) / 160);
    x.textAlign = 'center';
    x.font = HE_FONT(L.he);
    x.fillStyle = C.water;
    const hy = b.y0 + L.he * 0.82;
    x.fillText(n.well.he, mx, hy);
    x.font = MONO(L.en);
    x.fillStyle = bone(0.75);
    if (L.name) x.fillText(L.name, mx, hy + L.he * 0.23 + 4 + L.en * 0.8);
    x.globalAlpha = 1;
    x.textAlign = 'left';
  }
}

function drawCentre(x, g) {
  const closed = S.phase === 'ring' || S.phase === 'flood' || S.phase === 'done';
  const rr = shaftR(g);
  const since = S.t - S.closeT;
  const e = !closed ? 0 : S.reduced ? 1 : Math.min(1, since / 700);
  const pulse = 0.5 + 0.5 * Math.sin(S.t * (S.reduced ? 0.0014 : 0.0032));

  // ring closed: a flat wet patch spreads under the shaft
  if (closed) {
    x.fillStyle = water((0.16 + pulse * 0.16) * e);
    x.beginPath();
    x.arc(g.cx, g.cy, rr * (1.6 + pulse * 0.35), 0, TAU);
    x.fill();
  }

  // the dry shaft: a mouth already dug, and empty
  x.save();
  x.beginPath();
  x.arc(g.cx, g.cy, rr, 0, TAU);
  x.fillStyle = C.mouth;
  x.fill();
  x.strokeStyle = closed ? C.water : bone(0.55);
  x.lineWidth = closed ? 4 : 3;
  x.stroke();

  // cracks radiating from a well that gave nothing
  x.strokeStyle = closed ? water(0.4) : bone(0.16);
  x.lineWidth = 1.2;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + 0.3;
    x.beginPath();
    x.moveTo(g.cx + Math.cos(a) * rr, g.cy + Math.sin(a) * rr);
    let px = g.cx + Math.cos(a) * rr;
    let py = g.cy + Math.sin(a) * rr;
    let aa = a;
    for (let k = 0; k < 4; k++) {
      aa += (S.crackJit[i * 4 + k] - 0.5) * 0.7;
      px += Math.cos(aa) * rr * 0.3;
      py += Math.sin(aa) * rr * 0.3;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  x.restore();

  if (!closed) {
    x.font = '700 10px "IBM Plex Mono", monospace';
    x.textAlign = 'center';
    x.fillStyle = bone(0.45);
    x.fillText('D R Y', g.cx, g.cy + 4);
    x.textAlign = 'left';
    return;
  }

  // six lines drive into the centre: full stroke, bold, one flat colour
  const t = S.reduced ? 1 : 1 - Math.pow(1 - Math.min(1, since / 600), 3);
  x.lineCap = 'round';
  x.strokeStyle = C.water;
  x.lineWidth = Math.max(9, g.R * 0.06);
  for (const n of S.nodes) {
    const p = nodeXY(n, g);
    const d = dist(p.x, p.y, g.cx, g.cy) || 1;
    const k = ((d - rr) / d) * t;
    x.beginPath();
    x.moveTo(p.x, p.y);
    x.lineTo(p.x + (g.cx - p.x) * k, p.y + (g.cy - p.y) * k);
    x.stroke();
  }

  if (S.phase === 'ring') {
    // the room only says it out loud if you hesitate
    // placed by layout(): below the shaft by preference, else wherever it fits
    const cap = layout(g).caption;
    if (!cap || cap.inDock) return;
    const late = since > 6500 && cap.full;
    const l2 = late ? 'S E V E N T H  ·  S T R I K E   H E R E' : 'S E V E N T H';
    const b = cap.box;
    const mx = (b.x0 + b.x1) / 2;
    // a ground plate so the converging lines never cut through the words
    x.fillStyle = C.ground;
    x.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    x.textAlign = 'center';
    const ty = b.y0 + cap.he + 2;
    x.font = HE_FONT(cap.he);
    x.fillStyle = water((0.7 + pulse * 0.3) * e);
    x.fillText('השביעית', mx, ty);
    x.font = MONO(cap.sub);
    x.fillStyle = bone(0.7 * e);
    x.fillText(l2, mx, ty + cap.sub + 6);
    x.textAlign = 'left';
  }
}

function drawPits(x, g) {
  const lay = layout(g);
  const names = S.nodes.filter((n) => n.open).map((n) => lay.labels.get(n).box);
  for (const p of S.pits) {
    const px = p.nx * g.W;
    const py = p.ny * g.H;
    const age = S.t - p.t;
    // dust puff on the way out
    if (age < 500) {
      const t = age / 500;
      x.fillStyle = sand(0.24 * (1 - t));
      x.beginPath();
      x.arc(px, py, 7 + t * 26, 0, TAU);
      x.fill();
    }
    x.strokeStyle = p.close ? C.accent : bone(0.45);
    x.lineWidth = 2;
    const s = 6;
    x.beginPath();
    x.moveTo(px - s, py - s); x.lineTo(px + s, py + s);
    x.moveTo(px + s, py - s); x.lineTo(px - s, py + s);
    x.stroke();
    // a miss never prints its number over an open well's name
    const tb = { x0: px - 34, x1: px + 34, y0: py + 8, y1: py + 22 };
    if (names.some((b) => ovl(b, tb))) continue;
    x.font = '700 10px "IBM Plex Mono", monospace';
    x.textAlign = 'center';
    x.fillStyle = p.close ? C.accent : bone(0.55);
    const v = '.' + String(Math.round(p.val * 100)).padStart(2, '0');
    x.fillText(p.close ? v + ' CLOSE' : v, px, py + 19);
    x.textAlign = 'left';
  }
}

function drawRipples(x) {
  for (const r of S.ripples) {
    const t = r.t / r.life;
    if (t >= 1) continue;
    const n = r.big ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const tt = t - i * 0.14;
      if (tt <= 0) continue;
      const rad = tt * (r.big ? 520 : r.water ? 150 : 56);
      x.strokeStyle = r.water
        ? `rgba(59,232,176,${0.5 * (1 - tt)})`
        : `rgba(242,237,226,${0.26 * (1 - tt)})`;
      x.lineWidth = r.water ? 2 : 1;
      x.beginPath();
      x.arc(r.x, r.y, rad, 0, TAU);
      x.stroke();
    }
  }
}

// the room leaning toward a visitor who is floundering — in-world, no words
function drawHint(x, g) {
  const t0 = 21000;
  if (S.hintT < t0) return;
  let target = null;
  if (S.phase === 'play') {
    const nc = nearestClosed(g);
    // hint from the closed node nearest the rod: it points where the player already is
    target = nc ? nc.p : null;
    if (!target) return;
  } else if (S.phase === 'ring') {
    target = { x: g.cx, y: g.cy };
  } else return;

  const str = Math.min(1, (S.hintT - t0) / 9000);
  const period = 2400;
  const ph = (S.hintT % period) / period;
  for (let i = 0; i < 3; i++) {
    const tt = ph - i * 0.2;
    if (tt <= 0 || tt >= 1) continue;
    x.strokeStyle = `rgba(242,237,226,${0.3 * str * (1 - tt)})`;
    x.lineWidth = 1.4;
    x.beginPath();
    x.arc(target.x, target.y, tt * g.R * 0.75, 0, TAU);
    x.stroke();
  }
  // deep hint: the thing itself starts to show through the sand
  if (S.hintT > t0 + 14000 && S.phase === 'play') {
    const p = 0.5 + 0.5 * Math.sin(S.t * 0.003);
    x.fillStyle = `rgba(59,232,176,${0.1 + p * 0.16})`;
    x.beginPath();
    x.arc(target.x, target.y, 6 + p * 3, 0, TAU);
    x.fill();
  }
}

function drawHud(x, g) {
  const open = S.nodes.filter((n) => n.open).length + (S.centreOpen ? 1 : 0);
  const gapx = 17;
  const right = g.W - 30;
  const y = 40;
  for (let i = 6; i >= 0; i--) {
    const px = i === 6 ? right : right - 30 - (5 - i) * gapx;
    const got = i < 6 ? S.nodes[i] && S.nodes[i].open : S.centreOpen;
    x.beginPath();
    if (i === 6) {
      x.save();
      x.translate(px, y);
      x.rotate(Math.PI / 6);
      x.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        const r = 6.4;
        k ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      x.closePath();
      if (got) { x.fillStyle = C.water; x.fill(); }
      x.strokeStyle = got ? C.water : bone(0.55);
      x.lineWidth = 2;
      x.stroke();
      x.restore();
      continue;
    }
    x.arc(px, y, 5, 0, TAU);
    if (got) {
      x.fillStyle = C.water;
      x.fill();
    } else {
      x.strokeStyle = bone(0.5);
      x.lineWidth = 2;
      x.stroke();
    }
  }
  x.font = '600 12px "IBM Plex Mono", monospace';
  x.textAlign = 'right';
  x.fillStyle = open === 7 ? C.water : bone(0.75);
  x.fillText('W A T E R   ' + open + ' / 7', right + 2, y + 26);
  x.textAlign = 'left';
}

function drawFlood(x, g) {
  const dur = S.reduced ? 1100 : 2500;
  const t = Math.min(1, S.floodT / dur);
  const e = 1 - Math.pow(1 - t, 2.4);
  const rad = e * Math.max(g.W, g.H) * 0.86;
  // a flat sheet of water spreading from the shaft, thinning as it goes
  x.fillStyle = water(0.32 * (1 - t * 0.6));
  x.beginPath();
  x.arc(g.cx, g.cy, Math.max(1, rad), 0, TAU);
  x.fill();

  if (!S.reduced) {
    for (let i = 0; i < 4; i++) {
      const tt = t - i * 0.12;
      if (tt <= 0) continue;
      x.strokeStyle = bone(0.3 * (1 - tt));
      x.lineWidth = 3;
      x.beginPath();
      x.arc(g.cx, g.cy, tt * rad * 1.05, 0, TAU);
      x.stroke();
    }
  }
}

// keyboard and touch never push the rod off the surveyed plot (the outer chalk ring)
function clampToPlot(g) {
  const r = S.rod;
  const dx = r.tx - g.cx;
  const dy = r.ty - g.cy;
  const d = Math.hypot(dx, dy);
  const lim = g.R * 1.3;
  if (d > lim) { r.tx = g.cx + (dx / d) * lim; r.ty = g.cy + (dy / d) * lim; }
}

// --------------------------------------------------------------------------- API
export default {
  id: 'seventh',

  enter(ctx) {
    const g = geo();
    const style = document.createElement('style');
    style.textContent = CSS;
    ctx.root.appendChild(style);

    ctx.root.classList.add('s7');
    const L = ctx.fx.layer(ctx.root, 1);

    const crackJit = [];
    const cj = ctx.fx.rnd(9173);
    for (let i = 0; i < 64; i++) crackJit.push(cj());

    S = {
      ctx, root: ctx.root, L, style,
      crackJit,
      reduced: ctx.fx.reducedMotion,
      t: 0, hintT: 0, floodT: 0, closeT: -1, strikes: 0,
      phase: 'play', taught: false, centreOpen: false,
      nodes: [], pits: [], ripples: [],
      rod: { x: 0, y: 0, tx: 0, ty: 0, ang: 0, buzz: 0 },
      keys: new Map(),
      touch: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
      drag: null,
      rq: null,
      sr: null, srQueue: null, srNext: 0,
      cutT: -1e9, cutWell: null, missT: -1e9, lastStrike: null, lastBand: null,
      listeners: [],
      pay: null,
      stat: null,
      gen: {},
    };

    reset(false);
    buildStatic(g);

    // chrome: identity + a way out that never leaves the screen
    const slug = document.createElement('div');
    slug.className = 's7__slug';
    slug.innerHTML = '<b>VII</b>NO NAME · NO DEPTH<br>SURVEY STATUS: <span style="color:#DEA668">DRY</span>';
    ctx.root.appendChild(slug);
    S.slug = slug;

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 's7__exit';
    exit.innerHTML = '↑ surface &nbsp;<span style="opacity:.6">[esc]</span>';
    exit.setAttribute('aria-label', 'Back to the surface (Escape)');
    ctx.root.appendChild(exit);
    S.exit = exit;
    setExitTabbable(false);
    const onExit = () => ctx.go('surface', { from: 'seventh' });
    exit.addEventListener('click', onExit);
    S.listeners.push([exit, 'click', onExit]);

    const sr = document.createElement('div');
    sr.className = 's7__sr';
    sr.setAttribute('role', 'status');
    sr.setAttribute('aria-live', 'polite');
    sr.setAttribute('aria-atomic', 'true');
    ctx.root.appendChild(sr);
    S.sr = sr;
    say('The seventh well. A dry plot. Arrow keys move the dowsing rod, Space strikes. ' +
      'Water reads ' + WATER_T.toFixed(2) + ' or more. Reading dry. Water 0 of 7.');

    // ---- input
    // mouse: the rod follows the pointer, a press strikes where you point.
    // touch/pen: a drag anywhere steers the rod (relative, so the finger never hides
    // it); a release with < TAP_SLOP px of travel strikes at the rod.
    const onMove = (e) => {
      if (!S) return;
      if (e.pointerType === 'mouse') {
        S.rod.tx = e.clientX;
        S.rod.ty = e.clientY;
        return;
      }
      const d = S.drag;
      if (!d || d.id !== e.pointerId) return;
      // every pixel of a drag steers, so a careful nudge is a nudge; any travel past
      // TAP_SLOP marks the gesture as a drag, which never strikes
      if (dist(e.clientX, e.clientY, d.x0, d.y0) >= TAP_SLOP) d.moved = true;
      S.rod.tx += e.clientX - d.lx;
      S.rod.ty += e.clientY - d.ly;
      d.lx = e.clientX;
      d.ly = e.clientY;
      clampToPlot(geo());
    };
    const onDown = (e) => {
      if (!S) return;
      if (e.target && e.target.closest && e.target.closest('button, .s7__pay')) return;
      if (e.pointerType === 'mouse') {
        S.touch = false;
        if (e.button !== 0) return;
        // you strike where you point, not where the rod has drifted to
        S.rod.x = S.rod.tx = e.clientX;
        S.rod.y = S.rod.ty = e.clientY;
        strike(ctx);
        return;
      }
      S.touch = true;
      if (S.drag) return; // one finger steers
      S.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY,
        moved: false, t0: e.timeStamp };
    };
    const onUp = (e) => {
      if (!S || !S.drag || S.drag.id !== e.pointerId) return;
      const d = S.drag;
      S.drag = null;
      // strike only on a clean tap: short, and it never travelled TAP_SLOP px
      const tap = !d.moved && dist(e.clientX, e.clientY, d.x0, d.y0) < TAP_SLOP &&
        e.timeStamp - d.t0 < TAP_MS;
      if (tap) {
        // a tap's own jitter does not move the aim
        S.rod.tx -= d.lx - d.x0;
        S.rod.ty -= d.ly - d.y0;
        strike(ctx);
      }
    };
    const onCancel = (e) => {
      if (S && S.drag && S.drag.id === e.pointerId) S.drag = null;
    };
    const onKey = (e) => {
      if (!S) return;
      const tgt = e.target;
      if (S.phase === 'flood' || S.phase === 'done') return;
      if (tgt && tgt.closest && tgt.closest('.s7__pay')) return;
      // a focused shell button (the sound toggle) keeps Space/Enter, but the arrows
      // still steer; the exit button never takes Space/Enter during play
      const foreignBtn = tgt && tgt.tagName === 'BUTTON' && tgt !== S.exit;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === ' ' || k === 'enter' || k === 'Enter') {
        if (foreignBtn) return;
        e.preventDefault();
        if (!e.repeat) strike(ctx);
        return;
      }
      const dir = KEYDIR[k];
      if (!dir) return;
      e.preventDefault();
      if (S.keys.has(k)) return; // auto-repeat is handled by the hold ramp in update()
      S.keys.set(k, S.t);
      S.rod.tx += dir[0] * STEP;
      S.rod.ty += dir[1] * STEP;
      clampToPlot(geo());
    };
    const onKeyUp = (e) => {
      if (!S) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      S.keys.delete(k);
    };
    const onBlur = () => { if (S) { S.keys.clear(); S.drag = null; } };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    S.listeners.push(
      [window, 'pointermove', onMove],
      [window, 'pointerdown', onDown],
      [window, 'pointerup', onUp],
      [window, 'pointercancel', onCancel],
      [window, 'keydown', onKey],
      [window, 'keyup', onKeyUp],
      [window, 'blur', onBlur],
    );

    ctx.audio.drone('seventh');
    ctx.fx.grain(true);

    // a repeat visitor is acknowledged, not replayed at
    if (ctx.store.get('seventh.found', false)) {
      for (const n of S.nodes) { n.open = true; n.openT = -4000; }
      S.phase = 'done';
      S.centreOpen = true;
      S.closeT = -4000;
      S.floodT = 4000;
      S.taught = true;
      setExitTabbable(true);
      say('The seventh well. You dug it already. Water at seven of seven.', true);
      buildPayoff(ctx, true);
      if (S.slug) {
        S.slug.innerHTML = '<b>VII</b>NO NAME · DEPTH: FOUND<br>SURVEY STATUS: ' +
          '<span style="color:var(--water)">WATER</span>';
      }
    }
  },

  update(dt) {
    if (!S || !S.L) return;
    const g = geo();
    S.t += dt;
    if (S.phase === 'play' || S.phase === 'ring') S.hintT += dt;
    if (S.phase === 'flood') {
      S.floodT += dt;
      const dur = S.reduced ? 1100 : 2500;
      if (S.floodT > dur * 0.45 && !S.pay) buildPayoff(S.ctx, false);
      if (S.floodT > dur) {
        S.phase = 'done';
        setExitTabbable(true);
        if (S.slug) {
          S.slug.innerHTML = '<b>VII</b>NO NAME · DEPTH: FOUND<br>SURVEY STATUS: ' +
            '<span style="color:var(--water)">WATER</span>';
        }
      }
    }

    // keyboard: each tap already stepped STEP px in onKey; a held key, after a short
    // pause, glides and accelerates (0.08 -> 0.45 px/ms over ~1.4s), clamped to the plot.
    if (S.keys.size) {
      let kx = 0;
      let ky = 0;
      let held = 0;
      for (const [k, t0] of S.keys) {
        const h = S.t - t0;
        if (h < 260) continue;
        const dir = KEYDIR[k];
        kx += dir[0];
        ky += dir[1];
        held = Math.max(held, h);
      }
      if (kx || ky) {
        const l = Math.hypot(kx, ky) || 1;
        const sp = (0.08 + 0.37 * Math.min(1, (held - 260) / 1400)) * dt;
        S.rod.tx += (kx / l) * sp;
        S.rod.ty += (ky / l) * sp;
        clampToPlot(g);
      }
    }
    S.rod.tx = Math.max(14, Math.min(g.W - 14, S.rod.tx));
    S.rod.ty = Math.max(14, Math.min(g.H - 14, S.rod.ty));

    // the rod has weight
    const k = S.reduced ? 1 : Math.min(1, dt / 55);
    S.rod.x += (S.rod.tx - S.rod.x) * (S.reduced ? 1 : 0.22 + k * 0.1);
    S.rod.y += (S.rod.ty - S.rod.y) * (S.reduced ? 1 : 0.22 + k * 0.1);
    S.rod.buzz = Math.max(0, S.rod.buzz - dt / 220);

    const { heat, t: target } = reading(g);

    // dowsing: locks on when it reads, wanders when it does not
    let want;
    if (heat > 0.04 && target) {
      const a0 = Math.atan2(target.p.y - S.rod.y, target.p.x - S.rod.x);
      want = a0 + (1 - heat) * Math.sin(S.t * 0.004) * 0.7;
    } else {
      want = S.rod.ang + 0.0007 * dt + Math.sin(S.t * 0.0011) * 0.02;
    }
    let d = ((want - S.rod.ang + Math.PI * 3) % TAU) - Math.PI;
    S.rod.ang += d * Math.min(1, dt / 120) * (0.25 + heat * 0.55);

    // geiger click: enrichment only, never the solve channel
    if (S.phase === 'play' && heat > 0.12 && S.ctx.audio.enabled) {
      const gap = 620 - heat * 480;
      if (S.t - (S.lastTick || 0) > gap) {
        S.lastTick = S.t;
        S.ctx.audio.tone(170 + heat * 760, { dur: 0.045, type: 'square', gain: 0.035 });
      }
    }

    for (const r of S.ripples) r.t += dt;
    S.ripples = S.ripples.filter((r) => r.t < r.life);

    // live status: once the aim comes to rest, speak the reading there. Not
    // throttled; a strike result stays until the aim moves again.
    if (S.aim && (S.phase === 'play' || S.phase === 'ring')) {
      const A = S.aim;
      if (Math.abs(S.rod.tx - A.x) > 0.5 || Math.abs(S.rod.ty - A.y) > 0.5) {
        A.x = S.rod.tx; A.y = S.rod.ty; A.t = S.t; A.said = false;
      } else if (!A.said && S.t - A.t >= 120 && !S.keys.size) {
        A.said = true;
        const h = rawReading(A.x, A.y, g, S.phase).heat;
        const band = bandOf(h);
        say((S.phase === 'ring' ? 'To centre: ' : '') + band.toLowerCase() + ', ' +
          shown(h).toFixed(2) + '. Water ' + openCount() + ' of 7.' +
          (band === 'WATER' ? ' Strike now.' : ''));
      }
    }

    // ------------------------------------------------------------------ render
    // a 0x0 viewport has nothing to draw into (drawImage of a 0-size canvas throws)
    if (g.W < 1 || g.H < 1 || !S.L.w || !S.L.h) return;
    const x = S.L.ctx2d;
    x.clearRect(0, 0, S.L.w, S.L.h);
    if (!S.stat || S.stat.width !== Math.max(1, Math.round(g.W * S.statDpr)) ||
        S.stat.height !== Math.max(1, Math.round(g.H * S.statDpr))) buildStatic(g);
    if (S.stat && S.stat.width >= 1 && S.stat.height >= 1) x.drawImage(S.stat, 0, 0, g.W, g.H);
    drawGhost(x, g);
    drawHint(x, g);
    drawVein(x, g);
    drawPits(x, g);
    drawCentre(x, g);
    drawNodes(x, g);
    drawRipples(x);
    if (S.phase === 'flood' || S.phase === 'done') drawFlood(x, g);
    if (S.phase === 'play' || S.phase === 'ring') {
      drawGauge(x, g, heat);
      drawRod(x, g, heat, target);
    }
    drawHud(x, g);
    drawCut(x, g);

  },

  resize() {
    if (!S) return;
    buildStatic(geo());
  },

  exit() {
    if (!S) return;
    try {
      for (const [t, type, fn] of S.listeners) t.removeEventListener(type, fn);
      S.keys.clear();
      if (S.L && S.L.destroy) S.L.destroy();
      if (S.style) S.style.remove();
      if (S.pay) S.pay.remove();
      if (S.ctx && S.ctx.audio) S.ctx.audio.drone('seventh', false);
    } catch (e) {
      console.warn('[seventh] exit', e);
    }
    S = null;
  },
};
