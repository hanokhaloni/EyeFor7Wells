// THE SURFACE — the night-desert hub. Seven wells punched into the ground, seen from
// above. The cursor is a lamp; darkness everywhere else. The field is the navigation.
//
// Layers (all inside ctx.root):
//   z1  canvas  ground   : cached dark base + cached lit ground revealed through a light mask,
//                          then live wells (ripples, dust, rims, callout lines, lamp, vignette)
//   z60 DOM     survey UI: identity, coordinates, found-count ticks, hint
//   z65 DOM     readout  : the hovered/focused well's identity card
//   z70 DOM     hits     : invisible focusable buttons (keyboard + click targets)

import { WELLS } from '../data/wells.js';

/* ───────────────────────────── palette ───────────────────────────── */
const C = {
  night: [11, 14, 26],
  night2: [20, 26, 46],
  deep: [5, 7, 16],
  bone: [242, 237, 226],
  sand: [232, 135, 58],
  water: [59, 232, 176],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const TAU = Math.PI * 2;

/* Hand-surveyed anchors. Not a grid, not a ring — a scatter someone walked to. */
const ANCHOR = {
  whatsapp:  [0.150, 0.330],
  discord:   [0.305, 0.665],
  meetup:    [0.505, 0.215],
  youtube:   [0.730, 0.490],
  instagram: [0.885, 0.300],
  facebook:  [0.690, 0.820],
  seventh:   [0.175, 0.855],
};
/* chalk triangulation network, by index into the six real wells */
const NET = [[0, 2], [2, 4], [2, 3], [3, 5], [1, 5], [0, 1], [1, 3], [4, 3]];

const LR_BASE = 330;   // lamp reach, css px
const MS = 0.3;        // light-mask resolution scale

/* ───────────────────────────── state ───────────────────────────── */
let ctxRef = null, fx = null, audio = null, store = null, root = null;
let L = null, base = null, lit = null, scratch = null, mask = null;
let W = 0, H = 0, SD = 1, SC = 1, LR = LR_BASE;
let wells = [], real = [], seventh = null;
let mx = -9999, my = -9999, lx = 0, ly = 0, haveMouse = false;
let awake = null, focused = null, prevAwake = null;
let parts = [], ghosts = [];
let uiEl = null, cardEl = null, cardParts = null, hitWrap = null, hits = [], tickEls = [];
let falling = null, ready = false, exited = false;
let offs = [], timers = [];
let acc = { wind: 1800, drip: 4000, drift: 0, flick: 0 };
let anomaly = 0, anomalyAt = 0, lampJit = 0, lampFlick = 1;
let discovered = new Set(), opened = new Set();
let vgrad = null, tNow = 0, cardSide = 1, cardAnchor = null;
let hintEl = null, hintGone = false, fontsRebuilt = false;

/* ───────────────────────────── small helpers ───────────────────────────── */
const mkc = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { c, x: c.getContext('2d') };
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// a circle with hand-drawn wobble
function wobPath(x2d, cx, cy, r, amp, seed) {
  const r2 = fx.rnd(seed);
  const n = 54;
  x2d.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r + (r2() - 0.5) * amp + Math.sin(a * 3 + seed) * amp * 0.35;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.97;
    i ? x2d.lineTo(px, py) : x2d.moveTo(px, py);
  }
  x2d.closePath();
}

// a chalk line that drifts off true
function chalkLine(x2d, x1, y1, x2, y2, seed, segs = 9) {
  const r = fx.rnd(seed);
  x2d.beginPath();
  x2d.moveTo(x1, y1);
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const jx = (r() - 0.5) * 3.4, jy = (r() - 0.5) * 3.4;
    x2d.lineTo(lerp(x1, x2, t) + (i === segs ? 0 : jx), lerp(y1, y2, t) + (i === segs ? 0 : jy));
  }
  x2d.stroke();
}

/* ───────────────────────────── layout ───────────────────────────── */
function layout() {
  W = window.innerWidth; H = window.innerHeight;
  SD = L ? L.dpr : 1;
  SC = clamp(Math.min(W, H) / 900, 0.66, 1.3);
  LR = LR_BASE * clamp(Math.min(W, H) / 900, 0.74, 1.25);

  const pad = fx.rnd(4747);
  for (const w of wells) {
    const a = ANCHOR[w.id] || [0.5, 0.5];
    // seeded hand-jitter: identical every load, surveyed-not-snapped
    const jx = (pad() - 0.5) * 0.055, jy = (pad() - 0.5) * 0.05;
    w.nx = clamp(a[0] + jx, 0.06, 0.94);
    w.ny = clamp(a[1] + jy, 0.1, 0.9);
    w.x = 0.075 * W + w.nx * 0.85 * W;
    w.y = 0.145 * H + w.ny * 0.74 * H;
    w.r = (18 + (w.depth || 24) * 0.4) * SC;
    if (w.id === 'seventh') w.r = 31 * SC;
  }
  // the seventh's alternate survey positions — it does not stay where you left it
  if (seventh) {
    const q = fx.rnd(7177);
    seventh.spots = [[seventh.x, seventh.y]];
    for (let i = 0; i < 4; i++) {
      seventh.spots.push([
        (0.09 + q() * 0.3) * W,
        (0.42 + q() * 0.46) * H,
      ]);
    }
    const s = seventh.spots[seventh.spotI % seventh.spots.length];
    seventh.x = s[0]; seventh.y = s[1];
  }

  base = mkc(W * SD, H * SD);
  lit = mkc(W * SD, H * SD);
  scratch = mkc(W * SD, H * SD);
  mask = mkc(Math.max(140, W * MS), Math.max(100, H * MS));
  base.x.setTransform(SD, 0, 0, SD, 0, 0);
  lit.x.setTransform(SD, 0, 0, SD, 0, 0);

  drawBase(base.x);
  drawLit(lit.x);

  vgrad = L.ctx2d.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.22, W * 0.5, H * 0.52, Math.max(W, H) * 0.78);
  vgrad.addColorStop(0, rgba(C.deep, 0));
  vgrad.addColorStop(0.5, rgba(C.deep, 0.3));
  vgrad.addColorStop(0.78, rgba(C.deep, 0.72));
  vgrad.addColorStop(1, rgba(C.deep, 1));

  if (!haveMouse) { mx = W * 0.5; my = H * 0.52; lx = mx; ly = my; }
  placeHits();
}

/* ───────────────────────────── the dark ground (cached) ───────────────────────────── */
function drawBase(x) {
  x.clearRect(0, 0, W, H);
  x.fillStyle = rgba(C.night, 1);
  x.fillRect(0, 0, W, H);

  // giant flat shapes: dune fields, bigger than the screen
  const r = fx.rnd(9011);
  for (let i = 0; i < 5; i++) {
    const y0 = (-0.1 + i * 0.26) * H + (r() - 0.5) * 60;
    x.fillStyle = rgba(C.night2, 0.1 + r() * 0.13);
    x.beginPath();
    x.moveTo(-60, y0);
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const px = -60 + ((W + 120) * s) / steps;
      const cy = y0 + (r() - 0.5) * H * 0.2;
      x.quadraticCurveTo(px - (W + 120) / steps / 2, cy, px, y0 + (r() - 0.5) * H * 0.1);
    }
    x.lineTo(W + 60, H + 60);
    x.lineTo(-60, H + 60);
    x.closePath();
    x.fill();
  }

  // the dry wadi — a wide dark channel cutting the field
  x.fillStyle = rgba(C.deep, 0.5);
  x.beginPath();
  x.moveTo(-40, H * 0.14);
  x.quadraticCurveTo(W * 0.4, H * 0.42, W * 0.52, H * 0.6);
  x.quadraticCurveTo(W * 0.62, H * 0.78, W + 40, H * 0.98);
  x.lineTo(W + 40, H * 1.1);
  x.quadraticCurveTo(W * 0.55, H * 0.92, W * 0.42, H * 0.66);
  x.quadraticCurveTo(W * 0.3, H * 0.4, -40, H * 0.3);
  x.closePath();
  x.fill();

  // coarse grit so the void is never flat
  for (let i = 0; i < 1400; i++) {
    const px = r() * W, py = r() * H;
    x.fillStyle = rgba(C.bone, 0.005 + r() * 0.012);
    x.fillRect(px, py, 1, 1);
  }

  // the night closes over all of it
  x.fillStyle = rgba(C.deep, 0.52);
  x.fillRect(0, 0, W, H);

  // one chalk arc bigger than the screen, and the survey baseline —
  // the only two things visible in the dark besides your own lamp
  x.strokeStyle = rgba(C.bone, 0.05);
  x.lineWidth = 1.6;
  x.beginPath();
  x.arc(-W * 0.22, H * 1.28, Math.max(W, H) * 1.32, -1.5, 0.25);
  x.stroke();
  x.strokeStyle = rgba(C.bone, 0.035);
  x.setLineDash([26, 20]);
  x.beginPath();
  x.moveTo(-20, H * 0.115); x.lineTo(W + 20, H * 0.185);
  x.stroke();
  x.setLineDash([]);

  // barely-there depressions where the wells are
  for (const w of real) {
    const g = x.createRadialGradient(w.x, w.y, w.r * 0.1, w.x, w.y, w.r * 1.7);
    g.addColorStop(0, rgba(C.deep, 0.34));
    g.addColorStop(0.55, rgba(C.deep, 0.15));
    g.addColorStop(1, rgba(C.deep, 0));
    x.fillStyle = g;
    x.beginPath(); x.arc(w.x, w.y, w.r * 1.7, 0, TAU); x.fill();
    x.strokeStyle = rgba(C.night2, 0.3);
    x.lineWidth = 1;
    wobPath(x, w.x, w.y, w.r, 1.6, 31 + w.n * 7); x.stroke();
  }
}

/* ───────────────────────────── the lit ground (cached) ───────────────────────────── */
function drawLit(x) {
  x.clearRect(0, 0, W, H);
  const r = fx.rnd(9011); // same seed as base → same shapes, different ink

  x.fillStyle = rgba(C.night2, 0.95);
  x.fillRect(0, 0, W, H);
  x.fillStyle = rgba(C.sand, 0.09);
  x.fillRect(0, 0, W, H);

  for (let i = 0; i < 5; i++) {
    const y0 = (-0.1 + i * 0.26) * H + (r() - 0.5) * 60;
    x.fillStyle = i % 2 ? rgba(C.sand, 0.075) : rgba(C.bone, 0.04);
    x.beginPath();
    x.moveTo(-60, y0);
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const px = -60 + ((W + 120) * s) / steps;
      const cy = y0 + (r() - 0.5) * H * 0.2;
      x.quadraticCurveTo(px - (W + 120) / steps / 2, cy, px, y0 + (r() - 0.5) * H * 0.1);
    }
    x.lineTo(W + 60, H + 60); x.lineTo(-60, H + 60); x.closePath(); x.fill();
    // the crest of each dune, chalked
    x.strokeStyle = rgba(C.bone, 0.1); x.lineWidth = 1;
    x.beginPath(); x.moveTo(-60, y0);
    for (let s = 1; s <= steps; s++) {
      const px = -60 + ((W + 120) * s) / steps;
      x.lineTo(px, y0 + (r() - 0.5) * H * 0.08);
    }
    x.stroke();
  }

  // the wadi, lighter: dry sand in the channel
  x.fillStyle = rgba(C.night, 0.55);
  x.beginPath();
  x.moveTo(-40, H * 0.14);
  x.quadraticCurveTo(W * 0.4, H * 0.42, W * 0.52, H * 0.6);
  x.quadraticCurveTo(W * 0.62, H * 0.78, W + 40, H * 0.98);
  x.lineTo(W + 40, H * 1.1);
  x.quadraticCurveTo(W * 0.55, H * 0.92, W * 0.42, H * 0.66);
  x.quadraticCurveTo(W * 0.3, H * 0.4, -40, H * 0.3);
  x.closePath();
  x.fill();

  // two chalk arcs bigger than the screen — survey radii from an origin off-frame
  x.strokeStyle = rgba(C.bone, 0.075);
  x.lineWidth = 1.4;
  x.setLineDash([14, 11]);
  for (const k of [0.62, 0.98]) {
    x.beginPath();
    x.arc(-W * 0.22, H * 1.28, Math.max(W, H) * k * 1.35, -1.5, 0.25);
    x.stroke();
  }
  x.setLineDash([]);

  // halftone sand stipple
  for (let i = 0; i < 2600; i++) {
    const px = r() * W, py = r() * H, s = 0.5 + r() * 1.1;
    x.fillStyle = rgba(C.bone, 0.02 + r() * 0.06);
    x.fillRect(px, py, s, s);
  }

  // loose survey grid: tick crosses, hand placed
  x.strokeStyle = rgba(C.bone, 0.22);
  x.lineWidth = 1;
  const gs = 118 * SC;
  for (let gx = gs * 0.6; gx < W; gx += gs) {
    for (let gy = gs * 0.6; gy < H; gy += gs) {
      const jx = gx + (r() - 0.5) * 16, jy = gy + (r() - 0.5) * 16, k = 3.4;
      x.beginPath();
      x.moveTo(jx - k, jy); x.lineTo(jx + k, jy);
      x.moveTo(jx, jy - k); x.lineTo(jx, jy + k);
      x.stroke();
    }
  }

  // the triangulation network between the six known wells
  x.lineWidth = 1;
  x.setLineDash([7, 9]);
  NET.forEach((pr, i) => {
    const a = real[pr[0]], b = real[pr[1]];
    if (!a || !b) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const ax = a.x + Math.cos(ang) * a.r * 1.5, ay = a.y + Math.sin(ang) * a.r * 1.5;
    const bx = b.x - Math.cos(ang) * b.r * 1.5, by = b.y - Math.sin(ang) * b.r * 1.5;
    x.strokeStyle = rgba(C.bone, 0.3);
    chalkLine(x, ax, ay, bx, by, 100 + i * 13, 10);
  });
  x.setLineDash([]);

  // bearings, written on the lines
  x.font = `600 ${Math.round(7.5 * SC)}px "IBM Plex Mono", monospace`;
  x.fillStyle = rgba(C.bone, 0.42);
  NET.forEach((pr, i) => {
    if (i % 2) return;
    const a = real[pr[0]], b = real[pr[1]];
    if (!a || !b) return;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const deg = Math.round(((ang * 180) / Math.PI + 450) % 360);
    const label = `${String(deg).padStart(3, '0')}°  ${Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 7)}M`;
    x.save();
    x.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
    let rot = ang;
    if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;
    x.rotate(rot);
    x.fillText(label, -x.measureText(label).width / 2, -5);
    x.restore();
  });

  for (const w of real) drawWellLit(x, w);
}

function drawWellLit(x, w) {
  const { x: cx, y: cy, r } = w;

  // disturbed sand, lamp-warm
  let g = x.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.9);
  g.addColorStop(0, rgba(C.sand, 0.14));
  g.addColorStop(0.45, rgba(C.sand, 0.05));
  g.addColorStop(1, rgba(C.sand, 0));
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, r * 2.9, 0, TAU); x.fill();

  // topographic depression contours
  x.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    x.strokeStyle = rgba(C.bone, 0.13 - i * 0.025);
    wobPath(x, cx, cy, r * (1 + i * 0.42), 2.6 + i, 211 + w.n * 17 + i * 5);
    x.stroke();
  }

  // the mouth: a hole, not a disc
  x.fillStyle = rgba(C.deep, 1);
  wobPath(x, cx, cy, r, 1.2, 77 + w.n * 3); x.fill();
  g = x.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();

  // stone rim — bone, chalk-imperfect, lit from above
  x.lineWidth = 2.1 * SC;
  x.strokeStyle = rgba(C.bone, 0.4);
  wobPath(x, cx, cy, r + 2.2 * SC, 1.5, 77 + w.n * 3); x.stroke();
  x.lineWidth = 3.2 * SC;
  x.strokeStyle = rgba(C.bone, 0.62);
  x.beginPath();
  x.arc(cx, cy, r + 2.2 * SC, Math.PI * 1.1, Math.PI * 1.92);
  x.stroke();
  x.lineWidth = 2.4 * SC;
  x.strokeStyle = rgba(C.sand, 0.4);
  x.beginPath();
  x.arc(cx, cy, r + 4.4 * SC, Math.PI * 0.12, Math.PI * 0.78);
  x.stroke();

  // hatch ticks: the stones around the mouth
  const rr = fx.rnd(401 + w.n * 29);
  x.lineWidth = 1.2 * SC;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + rr() * 0.1;
    const l = (4 + rr() * 6) * SC;
    x.strokeStyle = rgba(C.bone, 0.1 + rr() * 0.22);
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * (r + 3 * SC), cy + Math.sin(a) * (r + 3 * SC));
    x.lineTo(cx + Math.cos(a) * (r + 3 * SC + l), cy + Math.sin(a) * (r + 3 * SC + l));
    x.stroke();
  }

  // surveyed station number, chalked beside the mouth
  x.font = `600 ${Math.round(9 * SC)}px "IBM Plex Mono", monospace`;
  x.fillStyle = rgba(C.bone, 0.42);
  x.fillText(`7W-0${w.n}`, cx + r + 10 * SC, cy - r - 6 * SC);

  // wells already opened keep a chalk X — the field remembers
  if (opened.has(w.id)) {
    x.strokeStyle = rgba(C.water, 0.5);
    x.lineWidth = 2 * SC;
    const k = r * 0.52;
    x.beginPath();
    x.moveTo(cx - k, cy - r - 14 * SC); x.lineTo(cx + k, cy - r - 14 * SC + k * 1.1);
    x.moveTo(cx + k, cy - r - 14 * SC); x.lineTo(cx - k, cy - r - 14 * SC + k * 1.1);
    x.stroke();
  }
}

/* ───────────────────────────── light mask ───────────────────────────── */
function renderMask() {
  const m = mask.x, mw = mask.c.width, mh = mask.c.height;
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, mw, mh);

  if (fx.reducedMotion) {
    m.fillStyle = 'rgba(255,255,255,0.72)';
    m.fillRect(0, 0, mw, mh);
  } else {
    m.fillStyle = 'rgba(255,255,255,0.016)';
    m.fillRect(0, 0, mw, mh);
    const sx = lx * MS, sy = ly * MS, lr = Math.max(8, (LR * lampFlick + lampJit) * MS);
    const g = m.createRadialGradient(sx, sy, 0, sx, sy, lr);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.46)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = g;
    m.fillRect(0, 0, mw, mh);
  }

  // a woken or remembered well holds its own pool of visibility
  for (const w of wells) {
    if (w.rev <= 0.02 || w.id === 'seventh') continue;
    const sx = w.x * MS, sy = w.y * MS, lr = (w.r * 3.4 + 40) * MS;
    const g = m.createRadialGradient(sx, sy, 0, sx, sy, lr);
    g.addColorStop(0, `rgba(255,255,255,${(0.55 + 0.45 * w.wake) * w.rev})`);
    g.addColorStop(0.55, `rgba(255,255,255,${0.3 * w.rev})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = g;
    m.beginPath(); m.arc(sx, sy, lr, 0, TAU); m.fill();
  }

  // the seventh eats light. it does not get revealed; it gets subtracted.
  if (seventh && seventh.exists) {
    m.globalCompositeOperation = 'destination-out';
    const sx = seventh.x * MS, sy = seventh.y * MS;
    const lr = (seventh.r * 1.18) * MS;
    const g = m.createRadialGradient(sx, sy, 0, sx, sy, lr);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.84, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = g;
    m.beginPath(); m.arc(sx, sy, lr, 0, TAU); m.fill();
    m.globalCompositeOperation = 'source-over';
  }
}

/* ───────────────────────────── live frame ───────────────────────────── */
function render() {
  const g = L.ctx2d;
  g.clearRect(0, 0, W, H);
  g.drawImage(base.c, 0, 0, W, H);

  renderMask();
  const s = scratch.x;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, scratch.c.width, scratch.c.height);
  s.drawImage(lit.c, 0, 0);
  s.globalCompositeOperation = 'destination-in';
  s.drawImage(mask.c, 0, 0, scratch.c.width, scratch.c.height);
  s.globalCompositeOperation = 'source-over';
  g.drawImage(scratch.c, 0, 0, W, H);

  // ── live well behaviour ────────────────────────────────────────────
  for (const w of real) drawWellLive(g, w);
  if (seventh && seventh.exists) drawSeventh(g);

  // ── the ghosts the seventh leaves behind ───────────────────────────
  for (const gh of ghosts) {
    g.strokeStyle = rgba(C.bone, 0.055 * gh.a);
    g.lineWidth = 1;
    g.setLineDash([3, 6]);
    g.beginPath(); g.arc(gh.x, gh.y, gh.r, 0, TAU); g.stroke();
    g.setLineDash([]);
    g.fillStyle = rgba(C.bone, 0.07 * gh.a);
    g.font = `600 ${Math.round(8 * SC)}px "IBM Plex Mono", monospace`;
    g.fillText('VACANT', gh.x - 18 * SC, gh.y + gh.r + 12 * SC);
  }

  // ── dust ───────────────────────────────────────────────────────────
  for (const p of parts) {
    const a = (1 - p.t / p.life);
    const dl = clamp(1 - Math.hypot(p.x - lx, p.y - ly) / (LR * 1.1), 0.08, 1);
    g.fillStyle = rgba(p.c, a * a * 0.5 * dl);
    g.fillRect(p.x, p.y, p.s, p.s);
  }

  // ── the callout line to the readout card ───────────────────────────
  if (cardAnchor && awake && awake.wake > 0.08) {
    const w = awake, a = clamp(awake.wake * 1.4, 0, 1);
    const ex = w.x + cardSide * (w.r + 6 * SC), ey = w.y;
    g.strokeStyle = rgba(C.bone, 0.5 * a);
    g.lineWidth = 1;
    g.setLineDash([5, 5]);
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(ex + cardSide * 26, ey);
    g.lineTo(cardAnchor[0], cardAnchor[1]);
    g.lineTo(cardAnchor[0] + cardSide * 16, cardAnchor[1]);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = rgba(C.bone, 0.6 * a);
    g.beginPath(); g.arc(ex, ey, 1.8, 0, TAU); g.fill();
  }

  // ── the lamp itself ────────────────────────────────────────────────
  if (!fx.reducedMotion || haveMouse) {
    g.globalCompositeOperation = 'lighter';
    const lg = g.createRadialGradient(lx, ly, 0, lx, ly, LR * 0.8);
    lg.addColorStop(0, rgba(C.sand, 0.15 * lampFlick));
    lg.addColorStop(0.3, rgba(C.sand, 0.06 * lampFlick));
    lg.addColorStop(1, rgba(C.sand, 0));
    g.fillStyle = lg;
    g.beginPath(); g.arc(lx, ly, LR * 0.8, 0, TAU); g.fill();
    const cg = g.createRadialGradient(lx, ly, 0, lx, ly, 26 * SC);
    cg.addColorStop(0, rgba(C.bone, 0.3 * lampFlick));
    cg.addColorStop(1, rgba(C.bone, 0));
    g.fillStyle = cg;
    g.beginPath(); g.arc(lx, ly, 26 * SC, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';

    // reticle — the body cursor is hidden, this is it
    g.strokeStyle = rgba(C.bone, 0.5 * lampFlick);
    g.lineWidth = 1;
    g.beginPath(); g.arc(lx, ly, 9.5, 0, TAU); g.stroke();
    g.beginPath();
    g.moveTo(lx - 15, ly); g.lineTo(lx - 11, ly);
    g.moveTo(lx + 11, ly); g.lineTo(lx + 15, ly);
    g.moveTo(lx, ly - 15); g.lineTo(lx, ly - 11);
    g.moveTo(lx, ly + 11); g.lineTo(lx, ly + 15);
    g.stroke();
  }

  // ── the anomaly: something is at a place where nothing is ──────────
  if (anomaly > 0.01 && seventh && !seventh.exists) {
    const a = anomaly;
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = rgba(C.bone, 0.32);
    g.lineWidth = 1;
    g.setLineDash([2, 7]);
    g.beginPath(); g.arc(seventh.x, seventh.y, seventh.r * 1.1, 0, TAU); g.stroke();
    g.setLineDash([]);
    g.fillStyle = rgba(C.bone, 0.5);
    g.font = `700 ${Math.round(26 * SC)}px "Heebo", sans-serif`;
    g.fillText('ז', seventh.x - 7 * SC, seventh.y + 9 * SC);
    g.restore();
  }

  // ── falling: the ground opens ──────────────────────────────────────
  if (falling) {
    const p = clamp(falling.p, 0, 1);
    const w = falling.w;
    g.fillStyle = rgba(C.deep, 1);
    g.beginPath();
    g.arc(w.x, w.y, w.r + (Math.max(W, H) * 1.3) * fx.ease.inCubic(p), 0, TAU);
    g.fill();
  }

  g.fillStyle = vgrad;
  g.fillRect(0, 0, W, H);
}

function drawWellLive(g, w) {
  if (w.rev < 0.02 && w.wake < 0.02) return;
  const { x: cx, y: cy, r } = w;
  const br = 1 + Math.sin(tNow / 560 + w.n * 1.7) * 0.016 * (0.3 + w.wake);
  const a = w.rev;

  // breathing rim: heat haze on the stones
  if (w.wake > 0.01) {
    g.strokeStyle = rgba(C.sand, 0.5 * w.wake);
    g.lineWidth = (2.6 + 1.6 * Math.sin(tNow / 300 + w.n)) * SC;
    g.beginPath();
    g.arc(cx, cy, (r + 3.5 * SC) * br, Math.PI * 0.1, Math.PI * 0.82);
    g.stroke();
    g.strokeStyle = rgba(C.bone, 0.72 * w.wake);
    g.lineWidth = 3 * SC;
    g.beginPath();
    g.arc(cx, cy, (r + 2.4 * SC) * br, Math.PI * 1.08, Math.PI * 1.95);
    g.stroke();
  }

  // water, far below. the reward colour, and only here.
  const alive = Math.max(w.wake, opened.has(w.id) ? 0.22 * a : 0);
  if (alive > 0.015) {
    g.save();
    g.beginPath(); g.arc(cx, cy, r * 0.94, 0, TAU); g.clip();
    const depthK = clamp(1 - (w.depth || 20) / 90, 0.22, 0.9);
    const ry = r * 0.3 * depthK + r * 0.1;
    g.fillStyle = rgba(C.water, 0.055 * alive);
    g.beginPath(); g.ellipse(cx, cy + r * 0.1, r * 0.62, ry, 0, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) {
      const ph = ((tNow / 1500) + i / 3 + w.ripple) % 1;
      const rr = r * (0.1 + ph * 0.56);
      g.strokeStyle = rgba(C.water, (1 - ph) * 0.42 * alive);
      g.lineWidth = 1.3 * SC;
      g.beginPath();
      g.ellipse(cx, cy + r * 0.1, rr, rr * (0.3 * depthK + 0.1), 0, 0, TAU);
      g.stroke();
    }
    g.fillStyle = rgba(C.water, 0.5 * alive);
    g.beginPath(); g.arc(cx - r * 0.18, cy + r * 0.02, 1.4 * SC, 0, TAU); g.fill();
    g.restore();
  }

  // focus bracket — keyboard gets the same reveal, plus a frame
  if (focused === w) {
    const k = r + 15 * SC, t = 7 * SC;
    g.strokeStyle = rgba(C.bone, 0.85);
    g.lineWidth = 1.6 * SC;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.moveTo(cx + sx * k - sx * t, cy + sy * k);
      g.lineTo(cx + sx * k, cy + sy * k);
      g.lineTo(cx + sx * k, cy + sy * k - sy * t);
      g.stroke();
    }
  }
}

function drawSeventh(g) {
  const w = seventh;
  const { x: cx, y: cy, r } = w;
  const flick = 0.5 + 0.5 * Math.sin(tNow / 90) * Math.sin(tNow / 37);
  const a = w.rev;

  // the hole. the light never gets in, so we draw it ourselves — wrongly.
  g.fillStyle = rgba(C.deep, 1);
  wobPath(g, cx, cy, r * 1.12, 2.2, 909); g.fill();

  // no stone rim. only a chalk ring someone drew and then scratched out.
  g.strokeStyle = rgba(C.bone, 0.1 + 0.55 * a + 0.07 * flick);
  g.lineWidth = 1.5 * SC;
  g.setLineDash([2, 5]);
  wobPath(g, cx, cy, r + 4 * SC, 2.6, 909); g.stroke();
  g.lineWidth = 1 * SC;
  g.strokeStyle = rgba(C.bone, 0.06 + 0.3 * a);
  wobPath(g, cx, cy, r + 15 * SC, 5, 913); g.stroke();
  g.setLineDash([]);

  // struck through: the station number that was erased from the sheet
  if (a > 0.05) {
    g.strokeStyle = rgba(C.bone, 0.3 * a);
    g.lineWidth = 1.2 * SC;
    g.beginPath();
    g.moveTo(cx + r + 8 * SC, cy - r - 2 * SC);
    g.lineTo(cx + r + 52 * SC, cy - r - 14 * SC);
    g.stroke();
    g.font = `600 ${Math.round(9 * SC)}px "IBM Plex Mono", monospace`;
    g.fillStyle = rgba(C.bone, 0.34 * a);
    g.fillText('7W-0' + (flick > 0.72 ? '7' : '?'), cx + r + 10 * SC, cy - r - 6 * SC);
  }

  // dry: no water. a cold bone shimmer, the wrong colour for a well.
  if (w.wake > 0.02 || w.rev > 0.3) {
    const aw = Math.max(w.wake, w.rev * 0.5);
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    for (let i = 0; i < 4; i++) {
      const ph = ((tNow / 2600) * (i % 2 ? -1 : 1) + i / 4 + 10) % 1;
      g.strokeStyle = rgba(C.bone, (1 - ph) * 0.18 * aw);
      g.lineWidth = 1 * SC;
      g.beginPath();
      g.ellipse(cx, cy, r * ph * 0.9, r * ph * 0.26, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
    // a number that cannot decide what it is
    g.fillStyle = rgba(C.bone, 0.26 * aw + 0.12 * flick * aw);
    g.font = `700 ${Math.round(22 * SC)}px "Heebo", sans-serif`;
    const gl = flick > 0.72 ? '7' : 'ז';
    g.fillText(gl, cx - 7 * SC, cy - r - 16 * SC);
  }

  if (focused === w) {
    const k = r + 17 * SC, t = 7 * SC;
    g.strokeStyle = rgba(C.bone, 0.75);
    g.lineWidth = 1.6 * SC;
    g.setLineDash([3, 3]);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.moveTo(cx + sx * k - sx * t, cy + sy * k);
      g.lineTo(cx + sx * k, cy + sy * k);
      g.lineTo(cx + sx * k, cy + sy * k - sy * t);
      g.stroke();
    }
    g.setLineDash([]);
  }
}

/* ───────────────────────────── dust ───────────────────────────── */
function puff(x, y, n, spread, col, up) {
  if (parts.length > 320) return;
  const r = fx.rnd((x * 13 + y * 7 + n) | 1 || 7);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, v = (0.2 + r() * 1.5) * spread;
    parts.push({
      x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - (up || 0) * (0.2 + r() * 0.8),
      t: 0, life: 500 + r() * 1100, s: r() < 0.25 ? 2 : 1,
      c: col || (r() < 0.3 ? C.bone : C.sand),
    });
  }
}

/* ───────────────────────────── DOM ───────────────────────────── */
const CSS = `
.sf-wrap{position:absolute;inset:0;z-index:60;pointer-events:none;
  font-family:var(--font-mono);color:var(--bone)}
.sf-blk{position:absolute;font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;line-height:2.1}
.sf-tl{left:28px;top:26px}
.sf-tr{right:28px;top:26px;text-align:right}
.sf-bl{left:28px;bottom:24px}
.sf-mark{font-family:var(--font-display);font-size:27px;letter-spacing:.18em;line-height:1;
  margin-bottom:7px;color:var(--bone)}
.sf-he{font-family:var(--font-he);font-size:13px;letter-spacing:.16em;opacity:.62;direction:rtl;
  margin-bottom:9px}
.sf-dim{opacity:.4}
.sf-dim2{opacity:.28}
.sf-rule{width:52px;height:1px;background:var(--bone);opacity:.22;margin:9px 0}
.sf-tr .sf-rule{margin-left:auto}
.sf-ticks{display:flex;gap:5px;margin-top:9px;align-items:center}
.sf-tick{width:13px;height:3px;background:var(--bone);opacity:.16;transition:all 260ms cubic-bezier(.2,.9,.1,1)}
.sf-tick[data-s="seen"]{opacity:.45}
.sf-tick[data-s="open"]{background:var(--water);opacity:1;box-shadow:0 0 7px var(--water)}
.sf-tick[data-s="q"]{width:13px;background:none;opacity:.5;height:auto;font-size:9px;line-height:3px;
  letter-spacing:0;text-align:center}
.sf-hint{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);font-size:9.5px;
  letter-spacing:.42em;text-transform:uppercase;opacity:.34;transition:opacity 700ms}
.sf-hint[data-gone="1"]{opacity:0}

.sf-card{position:absolute;z-index:65;width:252px;pointer-events:none;opacity:0;
  font-family:var(--font-mono);color:var(--bone);
  transition:opacity 120ms linear, transform 160ms cubic-bezier(.16,1.1,.3,1)}
.sf-card[data-on="1"]{opacity:1}
.sf-card__n{font-family:var(--font-display);font-size:13px;letter-spacing:.3em;opacity:.5}
.sf-card__name{font-family:var(--font-display);font-size:38px;line-height:.98;letter-spacing:.02em;
  margin-top:2px}
.sf-card__he{font-family:var(--font-he);font-weight:700;font-size:17px;direction:rtl;opacity:.72;
  margin-top:3px}
.sf-card__role{font-size:9px;letter-spacing:.2em;text-transform:uppercase;opacity:.5;margin-top:9px;
  line-height:1.7}
.sf-card__meta{display:flex;align-items:center;gap:8px;margin-top:11px;font-size:9px;
  letter-spacing:.2em;opacity:.8}
.sf-card__bar{flex:1;height:3px;background:rgba(242,237,226,.16);position:relative;overflow:hidden}
.sf-card__bar i{position:absolute;inset:0 auto 0 0;background:var(--water);width:0;
  transition:width 240ms cubic-bezier(.16,1,.3,1)}
.sf-card__open{margin-top:12px;font-size:9px;letter-spacing:.34em;color:var(--water);opacity:.9}
.sf-card[data-side="r"] .sf-card__he{text-align:left}
.sf-card[data-side="l"]{text-align:right}
.sf-card[data-side="l"] .sf-card__he{text-align:right}
.sf-card[data-side="l"] .sf-card__meta{flex-direction:row-reverse}
.sf-card[data-dry="1"] .sf-card__bar i{background:var(--bone);opacity:.3}
.sf-card[data-dry="1"] .sf-card__open{color:var(--bone);opacity:.45}
.sf-card[data-dry="1"] .sf-card__name{opacity:.5;letter-spacing:.3em}

.sf-hits{position:absolute;inset:0;z-index:70}
.sf-hit{position:absolute;background:none;border:0;padding:0;cursor:none;outline:none;
  -webkit-appearance:none;border-radius:50%}
.sf-hit::-moz-focus-inner{border:0}
@media (prefers-reduced-motion:reduce){
  .sf-card{transition:opacity 100ms linear}
}
`;

function buildDOM() {
  const st = document.createElement('style');
  st.textContent = CSS;
  root.appendChild(st);

  uiEl = document.createElement('div');
  uiEl.className = 'sf-wrap';
  uiEl.innerHTML = `
    <div class="sf-blk sf-tl">
      <div class="sf-mark">7 WELLS</div>
      <div class="sf-he">באר שבע</div>
      <div class="sf-dim">NEGEV / <span style="font-family:var(--font-he)">ישראל</span></div>
      <div class="sf-dim2">INDIE GAME DEVELOPERS</div>
    </div>
    <div class="sf-blk sf-tr">
      <div class="sf-dim">FIELD SURVEY 7W—01</div>
      <div class="sf-dim2">31°15′14″N&nbsp; 34°47′58″E</div>
      <div class="sf-rule"></div>
      <div class="sf-dim2">SHEET 1 / 1 &nbsp;·&nbsp; SCALE 1:7</div>
    </div>
    <div class="sf-blk sf-bl">
      <div class="sf-dim">WELLS FOUND &nbsp;<span class="sf-count">0</span> / 07</div>
      <div class="sf-ticks"></div>
    </div>
    <div class="sf-hint">SWEEP THE DARK</div>`;
  root.appendChild(uiEl);

  const tw = uiEl.querySelector('.sf-ticks');
  tickEls = wells.map(() => {
    const i = document.createElement('i');
    i.className = 'sf-tick';
    tw.appendChild(i);
    return i;
  });
  hintEl = uiEl.querySelector('.sf-hint');

  cardEl = document.createElement('div');
  cardEl.className = 'sf-card';
  cardEl.setAttribute('aria-hidden', 'true');
  cardEl.innerHTML = `
    <div class="sf-card__n"></div>
    <div class="sf-card__name"></div>
    <div class="sf-card__he"></div>
    <div class="sf-card__role"></div>
    <div class="sf-card__meta"><span class="sf-card__depth"></span>
      <span class="sf-card__bar"><i></i></span></div>
    <div class="sf-card__open">OPEN ↵</div>`;
  root.appendChild(cardEl);
  cardParts = {
    n: cardEl.querySelector('.sf-card__n'),
    name: cardEl.querySelector('.sf-card__name'),
    he: cardEl.querySelector('.sf-card__he'),
    role: cardEl.querySelector('.sf-card__role'),
    depth: cardEl.querySelector('.sf-card__depth'),
    bar: cardEl.querySelector('.sf-card__bar i'),
    open: cardEl.querySelector('.sf-card__open'),
  };

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
    b.addEventListener('focus', () => { focused = w; lookAt(w); });
    b.addEventListener('blur', () => { if (focused === w) focused = null; });
    b.addEventListener('click', (e) => { e.preventDefault(); open(w); });
    hitWrap.appendChild(b);
    return b;
  });
  root.appendChild(hitWrap);
  paintTicks();
}

function placeHits() {
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i], b = hits[i];
    if (!b) continue;
    const k = Math.max(w.r * 2.1, 54);
    b.style.left = (w.x - k / 2) + 'px';
    b.style.top = (w.y - k / 2) + 'px';
    b.style.width = k + 'px';
    b.style.height = k + 'px';
    const on = w.id !== 'seventh' || (seventh && seventh.exists);
    b.style.display = on ? 'block' : 'none';
    b.tabIndex = on ? 0 : -1;
  }
}

function paintTicks() {
  let n = 0;
  for (let i = 0; i < wells.length; i++) {
    const w = wells[i], el = tickEls[i];
    if (!el) continue;
    if (w.id === 'seventh' && !(seventh && seventh.exists)) {
      el.dataset.s = 'q'; el.textContent = '?';
      continue;
    }
    el.textContent = '';
    if (opened.has(w.id)) { el.dataset.s = 'open'; n++; }
    else if (discovered.has(w.id)) { el.dataset.s = 'seen'; n++; }
    else el.dataset.s = '';
  }
  const c = uiEl && uiEl.querySelector('.sf-count');
  if (c) c.textContent = String(n).padStart(2, '0');
}

function paintCard(w) {
  if (!w) { cardEl.dataset.on = '0'; cardAnchor = null; return; }
  const dry = w.id === 'seventh';
  cardEl.dataset.dry = dry ? '1' : '0';
  if (dry) {
    cardParts.n.textContent = '7W—??';
    cardParts.name.textContent = '— — — —';
    cardParts.he.textContent = 'ז';
    cardParts.role.textContent = 'UNMARKED · DRY · NOT ON THE SHEET';
    cardParts.depth.textContent = 'DEPTH ——— M';
    cardParts.bar.style.width = '0%';
    cardParts.open.textContent = 'LEAN IN ↵';
  } else {
    cardParts.n.textContent = `7W—0${w.n}`;
    cardParts.name.textContent = w.name;
    cardParts.he.textContent = w.he;
    cardParts.role.textContent = w.role;
    cardParts.depth.textContent = `DEPTH ${String(w.depth).padStart(2, '0')} M`;
    cardParts.bar.style.width = clamp((w.depth / 70) * 100, 6, 100) + '%';
    cardParts.open.textContent = opened.has(w.id) ? 'RE-ENTER ↵' : 'DESCEND ↵';
  }

  cardSide = w.x < W * 0.52 ? 1 : -1;
  const cw = 252;
  let left = cardSide === 1 ? w.x + w.r + 70 * SC : w.x - w.r - 70 * SC - cw;
  left = clamp(left, 24, W - cw - 24);
  const top = clamp(w.y - 96, 86, H - 230);
  cardEl.style.left = left + 'px';
  cardEl.style.top = top + 'px';
  cardEl.dataset.side = cardSide === 1 ? 'r' : 'l';
  cardEl.dataset.on = '1';
  cardEl.style.transform = `translateX(${cardSide * 0}px)`;
  cardAnchor = [cardSide === 1 ? left - 14 : left + cw + 14, top + 10];
}

/* ───────────────────────────── behaviour ───────────────────────────── */
function lookAt(w) {
  // keyboard moves the lamp too, so focus gets the same reveal as hover
  mx = w.x; my = w.y;
  haveMouse = true;
}

function wake(w) {
  if (!w) return;
  w.ripple = Math.random();
  if (w.id === 'seventh') {
    audio.tone(52, { dur: 0.9, type: 'triangle', gain: 0.1, slideTo: 37 });
    audio.noise({ dur: 0.7, gain: 0.05, band: [70, 320] });
    puff(w.x, w.y, 10, 0.5, C.bone, 0.3);
  } else {
    const pitch = clamp(1.45 - (w.depth || 20) / 80, 0.5, 1.45);
    audio.drip({ pitch });
    audio.noise({ dur: 0.26, gain: 0.05, band: [500, 2600] });
    puff(w.x, w.y, 22, 1.1, null, 0.9);
  }
  if (!discovered.has(w.id)) { discovered.add(w.id); paintTicks(); }
  if (!hintGone) {
    hintGone = true;
    if (hintEl) hintEl.dataset.gone = '1';
  }
}

function open(w) {
  if (!w || falling || !ready) return;
  const target = w.id === 'seventh' ? 'seventh' : 'chamber';
  try { store.mark(w.id); } catch {}
  opened.add(w.id);
  paintTicks();
  cardEl.dataset.on = '0';
  cardAnchor = null;

  if (w.id === 'seventh') {
    audio.tone(140, { dur: 1.1, type: 'sawtooth', gain: 0.13, slideTo: 24 });
    audio.noise({ dur: 0.9, gain: 0.1, band: [40, 500] });
  } else {
    audio.tone(300, { dur: 0.85, type: 'triangle', gain: 0.16, slideTo: 44 });
    audio.thud({ gain: 0.34, delay: 0.42 });
    audio.drip({ pitch: 0.7, delay: 0.5 });
  }
  puff(w.x, w.y, 46, 2.4, null, 1.6);
  fx.shake(560, 16);

  if (fx.reducedMotion) {
    fx.flash(rgba(C.deep, 1), 220);
    timers.push(setTimeout(() => { if (!exited) ctxRef.go(target, { wellId: w.id }); }, 220));
    return;
  }
  falling = { w, p: 0, dur: 700, target };
  root.style.transformOrigin = `${w.x}px ${w.y}px`;
}

/* ───────────────────────────── scene ───────────────────────────── */
export default {
  id: 'surface',

  enter(ctx) {
    ctxRef = ctx; fx = ctx.fx; audio = ctx.audio; store = ctx.store; root = ctx.root;
    exited = false; ready = false; falling = null;
    parts = []; ghosts = []; offs = []; timers = [];
    awake = null; prevAwake = null; focused = null;
    anomaly = 0; anomalyAt = 0; lampJit = 0; lampFlick = 1;
    hintGone = false; fontsRebuilt = false; cardAnchor = null;
    acc = { wind: 1400, drip: 3000, drift: 0, flick: 0 };
    haveMouse = false; mx = -9999; my = -9999;

    opened = new Set();
    discovered = new Set();
    for (const w of WELLS) { try { if (store.seen(w.id)) { opened.add(w.id); discovered.add(w.id); } } catch {} }

    wells = WELLS.map((w) => ({
      ...w, x: 0, y: 0, r: 20, nx: 0, ny: 0,
      rev: 0, wake: 0, ripple: Math.random(),
    }));
    real = wells.filter((w) => w.id !== 'seventh');
    seventh = wells.find((w) => w.id === 'seventh') || null;
    if (seventh) {
      seventh.spotI = 0;
      seventh.spots = [];
      // the seventh is not on the sheet until you have been down two wells
      const realSeen = real.filter((w) => opened.has(w.id)).length;
      seventh.exists = realSeen >= 2;
      seventh.lastMove = 0;
    }
    if (hintGone === false && opened.size >= 2) hintGone = true;

    L = fx.layer(root, 1);
    buildDOM();
    layout();
    if (hintGone && hintEl) hintEl.dataset.gone = '1';

    fx.grain(true);
    audio.drone('surface');

    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)); };

    on(window, 'pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!haveMouse) { haveMouse = true; lx = mx; ly = my; }
    }, { passive: true });

    on(window, 'pointerdown', (e) => {
      if (falling) return;
      // tapping the bare ground is not nothing: it raises dust
      const hitWell = wells.some((w) => (w.id !== 'seventh' || seventh.exists) &&
        Math.hypot(e.clientX - w.x, e.clientY - w.y) < Math.max(w.r * 1.4, 32));
      if (hitWell) return;
      if (e.clientY > H - 70 && e.clientX > W - 180) return; // sound button
      puff(e.clientX, e.clientY, 11, 0.8, null, 0.5);
      audio.noise({ dur: 0.18, gain: 0.05, band: [160, 900] });
    }, { passive: true });

    on(window, 'keydown', (e) => {
      if (falling) return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault();
        const dir = k === 'ArrowLeft' ? [-1, 0] : k === 'ArrowRight' ? [1, 0] : k === 'ArrowUp' ? [0, -1] : [0, 1];
        step(dir);
      } else if (k === 'Enter' || k === ' ') {
        const ae = document.activeElement;
        if (ae && ae.classList && ae.classList.contains('sf-hit')) return; // button handles it
        e.preventDefault();
        open(focused || awake);
      } else if (k === 'Tab' && focused == null) {
        // let the browser do it; the focus handler takes over
      }
    });

    on(window, 'blur', () => { haveMouse = false; });

    // chalk is drawn with real type — redraw once the fonts land
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (exited || fontsRebuilt) return;
        fontsRebuilt = true;
        try { drawLit(lit.x); } catch {}
      }).catch(() => {});
    }

    ready = true;
  },

  update(dt, t) {
    if (!ready || exited || !L) return;
    try { tick(dt, t); } catch (e) { /* never take down the site */ }
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
    try { if (L) L.destroy(); } catch {}
    L = null;
    try { if (root) root.style.transform = ''; } catch {}
    base = lit = scratch = mask = null;
    parts = []; ghosts = [];
    awake = null; focused = null; falling = null;
  },
};

/* ───────────────────────────── per-frame logic ───────────────────────────── */
function step(dir) {
  const from = focused || awake || { x: lx, y: ly };
  let best = null, bs = -1e9;
  for (const w of wells) {
    if (w === from) continue;
    if (w.id === 'seventh' && !(seventh && seventh.exists)) continue;
    const dx = w.x - from.x, dy = w.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const al = (dx / d) * dir[0] + (dy / d) * dir[1];
    if (al < 0.25) continue;
    const s = al * 1000 - d;
    if (s > bs) { bs = s; best = w; }
  }
  if (!best) return;
  const i = wells.indexOf(best);
  if (hits[i]) hits[i].focus();
  else { focused = best; lookAt(best); }
  audio.tone(880, { dur: 0.05, type: 'square', gain: 0.03 });
}

function tick(dt, t) {
  tNow = t;
  const k = Math.min(1, dt / 90);

  // the lamp lags the hand, and it flickers like a lamp
  lx = lerp(lx, mx, Math.min(1, dt / 70));
  ly = lerp(ly, my, Math.min(1, dt / 70));
  lampJit = Math.sin(t / 211) * 16 + Math.sin(t / 73) * 7;
  lampFlick = 0.93 + 0.07 * Math.sin(t / 130) + 0.03 * Math.sin(t / 41);

  // ── reveal + wake ────────────────────────────────────────────────
  let near = null, nd = 1e9;
  for (const w of wells) {
    const vis = w.id !== 'seventh' || (seventh && seventh.exists);
    const d = Math.hypot(mx - w.x, my - w.y);
    let target = 0;
    if (vis) {
      target = Math.pow(clamp(1 - (d - w.r) / (LR * 0.92), 0, 1), 0.75);
      if (focused === w) target = 1;
      if (opened.has(w.id)) target = Math.max(target, 0.3);
      if (fx.reducedMotion) target = 1;
      if (w.id === 'seventh') target = Math.min(target, 0.72); // never fully legible
    }
    w.rev += (target - w.rev) * k;
    if (vis && d < w.r * 1.7 + 82 && d < nd) { nd = d; near = w; }
    if (vis && target > 0.62 && !discovered.has(w.id) && !opened.has(w.id)) {
      discovered.add(w.id); paintTicks();
    }
  }
  if (focused && (!near || near !== focused)) near = focused;
  awake = falling ? null : near;

  for (const w of wells) {
    const tgt = awake === w ? 1 : 0;
    w.wake += (tgt - w.wake) * Math.min(1, dt / (tgt ? 90 : 220));
    if (awake === w && w.wake > 0.4 && Math.random() < 0.3) {
      puff(w.x + (Math.random() - 0.5) * w.r * 1.6, w.y + (Math.random() - 0.5) * w.r * 1.6,
        1, 0.4, null, 0.5);
    }
  }
  if (awake !== prevAwake) {
    if (awake) { wake(awake); paintCard(awake); }
    else paintCard(null);
    prevAwake = awake;
  } else if (awake) {
    // keep the card glued if the well moved under it
    if (awake.id === 'seventh' && awake.moved) { paintCard(awake); awake.moved = false; }
  }

  // ── the seventh misbehaves ───────────────────────────────────────
  if (seventh) {
    if (!seventh.exists) {
      const realSeen = real.filter((w) => opened.has(w.id)).length;
      if (realSeen >= 2) {
        seventh.exists = true;
        seventh.lastMove = t;
        placeHits(); paintTicks();
        audio.tone(44, { dur: 1.6, type: 'triangle', gain: 0.1, slideTo: 31 });
        puff(seventh.x, seventh.y, 30, 1.4, C.bone, 1.2);
      } else {
        // something is there that is not there yet
        const d = Math.hypot(mx - seventh.x, my - seventh.y);
        if (d < LR * 0.6 && t - anomalyAt > 2400) {
          anomalyAt = t;
          anomaly = 1;
          audio.tone(61, { dur: 0.3, type: 'square', gain: 0.045 });
        }
        anomaly = Math.max(0, anomaly - dt / 420);
        if (anomaly > 0.2) lampFlick *= 0.55 + 0.45 * Math.sin(t / 19);
      }
    } else {
      // it does not stay where you left it — but only while unobserved
      const d = Math.hypot(mx - seventh.x, my - seventh.y);
      const unobserved = d > LR * 1.05 && awake !== seventh && focused !== seventh;
      if (unobserved && t - seventh.lastMove > 3200 && seventh.spots.length > 1) {
        seventh.lastMove = t;
        ghosts.push({ x: seventh.x, y: seventh.y, r: seventh.r + 4, a: 1, t: 0 });
        if (ghosts.length > 4) ghosts.shift();
        seventh.spotI = (seventh.spotI + 1 + ((Math.random() * 2) | 0)) % seventh.spots.length;
        const s = seventh.spots[seventh.spotI];
        seventh.x = s[0]; seventh.y = s[1];
        seventh.moved = true;
        seventh.rev = 0;
        placeHits();
        puff(seventh.x, seventh.y, 12, 0.7, C.bone, 0.6);
        audio.noise({ dur: 0.4, gain: 0.035, band: [90, 420] });
      }
    }
  }
  for (const g of ghosts) { g.t += dt; g.a = Math.max(0, 1 - g.t / 26000); }

  // ── dust physics ─────────────────────────────────────────────────
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;
    p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.004 * dt * 0.06;
  }

  // ── ambience ─────────────────────────────────────────────────────
  acc.wind -= dt;
  if (acc.wind <= 0) {
    acc.wind = 5200 + Math.random() * 7000;
    audio.noise({ dur: 2.4, gain: 0.022, band: [260, 1500] });
  }
  acc.drip -= dt;
  if (acc.drip <= 0) {
    acc.drip = 7000 + Math.random() * 11000;
    const w = real[(Math.random() * real.length) | 0];
    audio.drip({ pitch: clamp(1.3 - (w.depth || 20) / 80, 0.45, 1.3) });
  }

  // ── falling ──────────────────────────────────────────────────────
  if (falling) {
    falling.p += dt / falling.dur;
    const p = clamp(falling.p, 0, 1);
    const sc = 1 + 4.2 * fx.ease.inCubic(p);
    root.style.transform = `scale(${sc})`;
    if (falling.p >= 1) {
      const target = falling.target, id = falling.w.id;
      falling = null;
      fx.flash(rgba(C.deep, 1), 260);
      if (!exited) ctxRef.go(target, { wellId: id });
      return;
    }
  }

  render();
}
