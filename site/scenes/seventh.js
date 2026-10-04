// THE SEVENTH WELL — "באר שבע / the dig"
//
// A hand-surveyed dry plot seen from above. You carry a dowsing rod (mouse or arrows).
// The rod twitches toward buried water and reports a moisture reading; STRIKE (click /
// space) to sink a pit. Hit water and a well mouth opens, green, named in Hebrew after
// one of the six real 7 Wells channels. Six of them sit on a ring. Open all six and the
// vein closes into a circle around the one place you never dowsed — the dry shaft you
// have been standing next to the whole time. The seventh well is in the middle of the
// other six. You dig it yourself.
//
// Owns: site/scenes/seventh.js only.

import { WELLS } from '../data/wells.js';

const TAU = Math.PI * 2;
const SIX = WELLS.filter((w) => w.id !== 'seventh').slice(0, 6);

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
.s7__slug {
  position:absolute; left:22px; top:20px; z-index:6; pointer-events:none;
  font-family:var(--font-mono); font-size:10px; letter-spacing:.24em;
  text-transform:uppercase; color:var(--bone); opacity:.34; line-height:1.9;
}
.s7__slug b { font-family:var(--font-display); font-size:30px; letter-spacing:.06em;
  display:block; opacity:.5; line-height:1; margin-bottom:6px; font-weight:400; }

.s7__pay {
  position:absolute; inset:0; z-index:8; display:grid; place-items:center;
  text-align:center; padding:6vh 7vw; opacity:0; overflow:auto; overscroll-behavior:contain;
  transition:opacity 900ms ease-out;
  background:radial-gradient(ellipse at 50% 52%, rgba(5,7,16,.93) 0%, rgba(5,7,16,.86) 38%, rgba(5,7,16,.1) 78%, transparent 100%);
}
.s7__pay[data-in="1"] { opacity:1; }
.s7__payin { max-width:min(760px, 86vw); }
.s7__kick { font-family:var(--font-mono); font-size:10px; letter-spacing:.3em;
  text-transform:uppercase; color:var(--bone); opacity:.55; margin-bottom:26px; }
.s7__kick i { color:var(--water); font-style:normal; opacity:1; }
.s7__big { font-family:var(--font-he); direction:rtl; font-weight:900;
  font-size:clamp(46px, 9vw, 104px); line-height:.94; color:var(--water);
  text-shadow:0 0 44px rgba(59,232,176,.4); margin-bottom:6px; }
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
function geo() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W * 0.5;
  const cy = H * 0.52;
  const R = Math.max(150, Math.min(W * 0.27, H * 0.37));
  return { W, H, cx, cy, R };
}

function nodeXY(n, g) {
  return { x: g.cx + Math.cos(n.a) * g.R * n.rr, y: g.cy + Math.sin(n.a) * g.R * n.rr };
}

// --------------------------------------------------------------------- static art
function buildStatic(g) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(g.W * dpr);
  c.height = Math.round(g.H * dpr);
  const x = c.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ground
  const bg = x.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, Math.max(g.W, g.H) * 0.78);
  bg.addColorStop(0, '#111729');
  bg.addColorStop(0.45, '#0B0E1A');
  bg.addColorStop(1, '#050710');
  x.fillStyle = bg;
  x.fillRect(0, 0, g.W, g.H);

  // sand speckle — hand texture, deterministic
  const r = S.ctx.fx.rnd(7777);
  x.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) {
    const px = r() * g.W;
    const py = r() * g.H;
    const s = r();
    x.fillStyle = s > 0.86 ? 'rgba(242,237,226,.085)' : 'rgba(232,135,58,.055)';
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
  const chalk = (rad, alpha, wob) => {
    x.strokeStyle = `rgba(242,237,226,${alpha})`;
    x.lineWidth = 1.4;
    x.beginPath();
    for (let a = 0; a <= TAU + 0.01; a += 0.045) {
      const rr = rad + Math.sin(a * 3.1 + wob) * wob * 2.2 + Math.sin(a * 7.7) * 1.4;
      const px = g.cx + Math.cos(a) * rr;
      const py = g.cy + Math.sin(a) * rr;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  };
  chalk(g.R * 1.3, 0.42, 1.6);
  chalk(g.R * 1.345, 0.16, 2.6);
  chalk(g.R * 0.52, 0.1, 2.0);

  // rim ticks every 15deg, long every 90, numbered at the quarters
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const long = i % 6 === 0;
    const r0 = g.R * 1.3;
    const r1 = r0 + (long ? 18 : 8);
    x.strokeStyle = `rgba(242,237,226,${long ? 0.5 : 0.24})`;
    x.lineWidth = long ? 1.8 : 1;
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
    x.strokeStyle = 'rgba(242,237,226,.065)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(g.cx + Math.cos(a) * r0, g.cy + Math.sin(a) * r0);
    x.lineTo(g.cx + Math.cos(a) * r1, g.cy + Math.sin(a) * r1);
    x.stroke();
  }

  // faint ghost ring where the vein lies — a surveyor's guess, not an answer
  x.setLineDash([2, 9]);
  x.strokeStyle = 'rgba(242,237,226,.12)';
  x.lineWidth = 1;
  x.beginPath();
  x.arc(g.cx, g.cy, g.R, 0, TAU);
  x.stroke();
  x.setLineDash([]);

  // rim legend + field annotations in the survey voice
  x.textAlign = 'center';
  x.font = '10px "IBM Plex Mono", monospace';
  x.fillStyle = 'rgba(242,237,226,.46)';
  x.fillText('3 1 ° 1 5 ′ N    3 4 ° 4 7 ′ E', g.cx, Math.max(22, g.cy - g.R * 1.3 - 28));
  x.font = '9px "IBM Plex Mono", monospace';
  x.fillStyle = 'rgba(242,237,226,.26)';
  x.fillText('P L O T   V I I   —   U N N A M E D', g.cx, Math.min(g.H - 16, g.cy + g.R * 1.3 + 32));
  x.font = '700 15px Heebo, "Arial Hebrew", sans-serif';
  x.fillStyle = 'rgba(242,237,226,.17)';
  x.fillText('שדה יבש', g.cx - g.R * 1.02, g.cy - g.R * 0.86);
  x.font = '9px "IBM Plex Mono", monospace';
  x.fillStyle = 'rgba(242,237,226,.17)';
  x.fillText('DRY FIELD', g.cx - g.R * 1.02, g.cy - g.R * 0.86 + 14);
  x.textAlign = 'left';

  S.stat = c;
  S.statDpr = dpr;
}

// ------------------------------------------------------------------------- build
function makeNodes() {
  const r = S.ctx.fx.rnd(4747);
  return SIX.map((w, i) => ({
    a: -Math.PI / 2 + (i / 6) * TAU + (r() - 0.5) * 0.38,
    rr: 0.86 + r() * 0.27,
    open: false,
    openT: -1,
    well: w,
  }));
}

function reset(hard) {
  const g = geo();
  S.nodes = makeNodes();
  S.pits = [];
  S.ripples = [];
  S.centreOpen = false;
  S.phase = 'play';
  S.hintT = 0;
  S.taught = false;
  S.floodT = 0;
  S.closeT = -1;
  S.strikes = 0;
  S.rod.x = S.rod.tx = g.cx + g.R * 1.05;
  S.rod.y = S.rod.ty = g.cy - g.R * 0.62;
  S.rod.ang = 0;
  S.rod.buzz = 0;
  if (hard && S.pay) { S.pay.remove(); S.pay = null; }
}

// --------------------------------------------------------------------- mechanics
function nearestClosed(g) {
  let best = null;
  let bd = 1e9;
  for (const n of S.nodes) {
    if (n.open) continue;
    const p = nodeXY(n, g);
    const d = dist(S.rod.x, S.rod.y, p.x, p.y);
    if (d < bd) { bd = d; best = { n, p, d }; }
  }
  return best;
}

function reading(g) {
  if (S.phase !== 'play') return { heat: 0, t: null };
  const t = nearestClosed(g);
  if (!t) return { heat: 0, t: null };
  const Rh = g.R * 1.5;
  const heat = Math.max(0, 1 - t.d / Rh);
  return { heat: Math.pow(heat, 1.35), t };
}

function openNode(n, g, ctx) {
  n.open = true;
  n.openT = S.t;
  S.hintT = 0;
  const p = nodeXY(n, g);
  S.ripples.push({ x: p.x, y: p.y, t: 0, life: 1500, water: true });
  const k = S.nodes.filter((q) => q.open).length;
  ctx.audio.drip({ pitch: 0.82 + k * 0.1 });
  ctx.audio.tone(140 + k * 26, { dur: 0.7, type: 'triangle', gain: 0.1, slideTo: 280 + k * 40 });
  ctx.fx.shake(170, 4);
  if (k === 6) {
    S.phase = 'ring';
    S.closeT = S.t;
    S.hintT = 0;
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
  const g = geo();
  S.ripples.push({ x: g.cx, y: g.cy, t: 0, life: 2600, water: true, big: true });
  try { ctx.store.set('seventh.found', true); ctx.store.mark('seventh'); } catch {}
  ctx.audio.thud({ gain: 0.6 });
  ctx.audio.tone(55, { dur: 3.6, type: 'sine', gain: 0.18, slideTo: 110 });
  for (let i = 0; i < 7; i++) ctx.audio.drip({ pitch: 0.6 + i * 0.16, delay: 0.18 + i * 0.17 });
  ctx.audio.noise({ dur: 2.2, gain: 0.07, band: [160, 1400], delay: 0.1 });
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

  if (S.phase === 'ring') {
    if (dist(S.rod.x, S.rod.y, g.cx, g.cy) < Math.max(52, g.R * 0.3)) { resolve(ctx); return; }
  } else {
    const hitR = Math.max(36, g.R * 0.19);
    let hit = null;
    for (const n of S.nodes) {
      if (n.open) continue;
      const p = nodeXY(n, g);
      if (dist(S.rod.x, S.rod.y, p.x, p.y) < hitR) { hit = n; break; }
    }
    if (hit) { openNode(hit, g, ctx); return; }
  }

  // dry: a pit, a dust puff, and a number you can triangulate from
  const { heat } = reading(g);
  S.pits.push({
    nx: S.rod.x / g.W, ny: S.rod.y / g.H,
    val: S.phase === 'ring' ? -1 : heat,
    t: S.t,
    seed: Math.random() * 10,
  });
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
        '<span style="color:var(--sand)">DRY</span>';
    }
  };
  el.addEventListener('click', click);
  S.listeners.push([el, 'click', click]);
  requestAnimationFrame(() => { if (S.pay === el) el.dataset.in = '1'; });
  const btn = el.querySelector('[data-act="surface"]');
  if (btn) setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch {} }, 1200);
}

// -------------------------------------------------------------------------- draw
function drawRod(x, g, heat, target) {
  const r = S.rod;
  const len = 48;
  const buzz = r.buzz * (S.reduced ? 2 : 5);
  const bx = r.x + (Math.random() - 0.5) * buzz;
  const by = r.y + (Math.random() - 0.5) * buzz;

  // lamp pool — the light you carry
  const pr = 58 + heat * 86;
  const lg = x.createRadialGradient(bx, by, 0, bx, by, pr);
  lg.addColorStop(0, `rgba(232,135,58,${0.15 + heat * 0.2})`);
  lg.addColorStop(0.5, `rgba(232,135,58,${0.05 + heat * 0.08})`);
  lg.addColorStop(1, 'rgba(232,135,58,0)');
  x.fillStyle = lg;
  x.beginPath();
  x.arc(bx, by, pr, 0, TAU);
  x.fill();

  // the V rod, pointing where it reads
  const a = r.ang;
  const spread = 0.52 - heat * 0.27;
  x.strokeStyle = heat > 0.55 ? 'rgba(232,135,58,.95)' : 'rgba(242,237,226,.82)';
  x.lineWidth = 2.4;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  // handle
  x.beginPath();
  x.moveTo(bx - Math.cos(a) * 22, by - Math.sin(a) * 22);
  x.lineTo(bx - Math.cos(a) * 8, by - Math.sin(a) * 8);
  x.stroke();
  // the fork
  for (const s of [-1, 1]) {
    x.beginPath();
    x.moveTo(bx - Math.cos(a) * 8, by - Math.sin(a) * 8);
    x.lineTo(bx + Math.cos(a + s * spread) * len, by + Math.sin(a + s * spread) * len);
    x.stroke();
  }
  // tip bead
  const tipx = bx + Math.cos(a) * (len * 0.74);
  const tipy = by + Math.sin(a) * (len * 0.74);
  x.beginPath();
  x.arc(tipx, tipy, 2.5 + heat * 5.5, 0, TAU);
  x.fillStyle = heat > 0.78 ? '#F2EDE2' : heat > 0.4 ? '#E8873A' : 'rgba(242,237,226,.6)';
  x.shadowColor = '#E8873A';
  x.shadowBlur = heat * 26;
  x.fill();
  x.shadowBlur = 0;

  // moisture readout — the survey voice. flips below the rod near the top edge.
  const flip = by < 70;
  const rx = bx > g.W - 150 ? bx - 96 : bx + 20;
  x.font = '600 12px "IBM Plex Mono", monospace';
  x.textAlign = 'left';
  const lbl = S.phase === 'ring' ? '— — —' : heat < 0.03 ? '· · ·' : heat.toFixed(2);
  x.fillStyle = heat > 0.55 ? 'rgba(232,135,58,.95)' : 'rgba(242,237,226,.6)';
  x.fillText(lbl, rx, by + (flip ? 34 : -18));
  x.font = '9px "IBM Plex Mono", monospace';
  x.fillStyle = 'rgba(242,237,226,.3)';
  x.fillText('MOISTURE', rx, by + (flip ? 21 : -31));

  // first-time affordance, in-world chalk, never a dialog
  if (!S.taught) {
    const p = 0.5 + 0.5 * Math.sin(S.t * 0.005);
    x.strokeStyle = `rgba(242,237,226,${0.18 + p * 0.3})`;
    x.lineWidth = 1;
    x.setLineDash([3, 5]);
    x.beginPath();
    x.arc(bx, by, 26 + p * 4, 0, TAU);
    x.stroke();
    x.setLineDash([]);
    x.font = '10px "IBM Plex Mono", monospace';
    x.fillStyle = `rgba(242,237,226,${0.35 + p * 0.45})`;
    x.textAlign = 'center';
    x.fillText('S T R I K E', bx, by + 48);
    x.font = '9px "IBM Plex Mono", monospace';
    x.fillStyle = 'rgba(242,237,226,.4)';
    x.fillText('CLICK · SPACE   ·   MOVE: MOUSE · ARROWS', bx, by + 62);
  }
  x.textAlign = 'left';

  // target lock bracket at very high heat — the rod has found it
  if (heat > 0.8 && target) {
    const w = 15;
    x.strokeStyle = `rgba(232,135,58,${(heat - 0.8) * 4})`;
    x.lineWidth = 1.5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      x.beginPath();
      x.moveTo(target.p.x + sx * w, target.p.y + sy * w * 0.45);
      x.lineTo(target.p.x + sx * w, target.p.y + sy * w);
      x.lineTo(target.p.x + sx * w * 0.45, target.p.y + sy * w);
      x.stroke();
    }
  }
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
      x.strokeStyle = 'rgba(59,232,176,.62)';
      x.lineWidth = 2.6;
      x.shadowColor = '#3BE8B0';
      x.shadowBlur = 14;
      x.stroke();
      x.shadowBlur = 0;
      x.strokeStyle = 'rgba(59,232,176,.9)';
      x.lineWidth = 1;
      x.stroke();
    } else {
      // a crack reaching for the piece that is still missing — the directional hint
      x.strokeStyle = 'rgba(242,237,226,.3)';
      x.lineWidth = 1.3;
      x.stroke();
      x.setLineDash([2, 7]);
      x.strokeStyle = 'rgba(242,237,226,.14)';
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
  for (const n of S.nodes) {
    if (!n.open) continue;
    const p = nodeXY(n, g);
    const age = Math.min(1, (S.t - n.openT) / 620);
    const e = S.reduced ? 1 : 1 - Math.pow(1 - age, 3);
    const rr = (14 + Math.sin(S.t * 0.002 + n.a * 3) * 1.4) * e;

    const gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 3.4);
    gr.addColorStop(0, 'rgba(59,232,176,.9)');
    gr.addColorStop(0.3, 'rgba(59,232,176,.38)');
    gr.addColorStop(1, 'rgba(59,232,176,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(p.x, p.y, rr * 3.4, 0, TAU);
    x.fill();

    x.fillStyle = '#050710';
    x.beginPath();
    x.arc(p.x, p.y, rr, 0, TAU);
    x.fill();
    x.strokeStyle = 'rgba(59,232,176,.95)';
    x.lineWidth = 2;
    x.stroke();
    x.fillStyle = `rgba(59,232,176,${0.5 + 0.3 * Math.sin(S.t * 0.003 + n.a * 5)})`;
    x.beginPath();
    x.arc(p.x, p.y, rr * 0.45, 0, TAU);
    x.fill();

    // named in Hebrew, outward from the ring
    const out = n.a;
    const lx = p.x + Math.cos(out) * 40;
    const ly = p.y + Math.sin(out) * 40;
    x.globalAlpha = e;
    x.textAlign = Math.cos(out) < -0.25 ? 'right' : Math.cos(out) > 0.25 ? 'left' : 'center';
    x.font = '700 19px Heebo, "Arial Hebrew", sans-serif';
    x.fillStyle = 'rgba(59,232,176,.95)';
    x.fillText(n.well.he, lx, ly + 2);
    x.font = '9px "IBM Plex Mono", monospace';
    x.fillStyle = 'rgba(242,237,226,.5)';
    x.fillText(n.well.name + '  ·  ' + n.well.n, lx, ly + 17);
    x.globalAlpha = 1;
    x.textAlign = 'left';
  }
}

function drawCentre(x, g) {
  const closed = S.phase === 'ring' || S.phase === 'flood' || S.phase === 'done';
  const rr = Math.max(30, g.R * 0.17);

  // the dry shaft: a mouth already dug, and empty
  x.save();
  x.beginPath();
  x.arc(g.cx, g.cy, rr, 0, TAU);
  x.fillStyle = '#04050C';
  x.fill();
  x.strokeStyle = closed ? 'rgba(59,232,176,.5)' : 'rgba(242,237,226,.3)';
  x.lineWidth = 1.6;
  x.stroke();

  // cracks radiating from a well that gave nothing
  x.strokeStyle = closed ? 'rgba(59,232,176,.3)' : 'rgba(242,237,226,.12)';
  x.lineWidth = 1;
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
    x.font = '9px "IBM Plex Mono", monospace';
    x.textAlign = 'center';
    x.fillStyle = 'rgba(242,237,226,.3)';
    x.fillText('D R Y', g.cx, g.cy + 3);
    x.textAlign = 'left';
    return;
  }

  // ring closed: six lines converge, the shaft bleeds green, the goal is unmissable
  const since = S.t - S.closeT;
  const e = Math.min(1, since / 1100);
  for (const n of S.nodes) {
    const p = nodeXY(n, g);
    const d = dist(p.x, p.y, g.cx, g.cy);
    const t = Math.max(0, Math.min(1, e * 1.25 - 0.1));
    x.strokeStyle = `rgba(59,232,176,${0.1 + 0.22 * t})`;
    x.lineWidth = 1;
    x.setLineDash([3, 6]);
    x.beginPath();
    x.moveTo(p.x, p.y);
    const k = (d - rr) / d * t;
    x.lineTo(p.x + (g.cx - p.x) * k, p.y + (g.cy - p.y) * k);
    x.stroke();
    x.setLineDash([]);
  }

  const pulse = 0.5 + 0.5 * Math.sin(S.t * (S.reduced ? 0.0014 : 0.0032));
  const gr = x.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, rr * (1.7 + pulse * 0.5));
  gr.addColorStop(0, `rgba(59,232,176,${(0.3 + pulse * 0.35) * e})`);
  gr.addColorStop(0.55, `rgba(59,232,176,${0.1 * e})`);
  gr.addColorStop(1, 'rgba(59,232,176,0)');
  x.fillStyle = gr;
  x.beginPath();
  x.arc(g.cx, g.cy, rr * (1.7 + pulse * 0.5), 0, TAU);
  x.fill();

  if (S.phase === 'ring') {
    x.textAlign = 'center';
    x.font = '700 22px Heebo, "Arial Hebrew", sans-serif';
    x.fillStyle = `rgba(59,232,176,${(0.55 + pulse * 0.45) * e})`;
    x.fillText('השביעית', g.cx, g.cy + rr + 36);
    x.font = '10px "IBM Plex Mono", monospace';
    x.fillStyle = `rgba(242,237,226,${0.5 * e})`;
    // the room only says it out loud if you hesitate
    const late = Math.min(1, Math.max(0, (since - 6500) / 2500));
    x.fillText(late > 0
      ? 'S E V E N T H  ·  S T R I K E   H E R E'
      : 'S E V E N T H', g.cx, g.cy + rr + 54);
    x.textAlign = 'left';
  }
}

function drawPits(x, g) {
  for (const p of S.pits) {
    const px = p.nx * g.W;
    const py = p.ny * g.H;
    const age = S.t - p.t;
    // dust puff on the way out
    if (age < 500) {
      const t = age / 500;
      x.fillStyle = `rgba(232,135,58,${0.22 * (1 - t)})`;
      x.beginPath();
      x.arc(px, py, 7 + t * 26, 0, TAU);
      x.fill();
    }
    x.strokeStyle = 'rgba(242,237,226,.26)';
    x.lineWidth = 1.2;
    const s = 5;
    x.beginPath();
    x.moveTo(px - s, py - s); x.lineTo(px + s, py + s);
    x.moveTo(px + s, py - s); x.lineTo(px - s, py + s);
    x.stroke();
    x.font = '8px "IBM Plex Mono", monospace';
    x.textAlign = 'center';
    x.fillStyle = 'rgba(242,237,226,.34)';
    x.fillText(p.val < 0 ? '—' : ('.' + String(Math.round(p.val * 100)).padStart(2, '0')), px, py + 17);
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
    // hint from the node nearest the centre-of-field so it is always findable
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
      if (got) { x.fillStyle = '#3BE8B0'; x.shadowColor = '#3BE8B0'; x.shadowBlur = 12; x.fill(); x.shadowBlur = 0; }
      x.strokeStyle = got ? '#3BE8B0' : 'rgba(242,237,226,.4)';
      x.lineWidth = 1.3;
      x.stroke();
      x.restore();
      continue;
    }
    x.arc(px, y, 5, 0, TAU);
    if (got) {
      x.fillStyle = '#3BE8B0';
      x.shadowColor = '#3BE8B0';
      x.shadowBlur = 10;
      x.fill();
      x.shadowBlur = 0;
    } else {
      x.strokeStyle = 'rgba(242,237,226,.34)';
      x.lineWidth = 1.2;
      x.stroke();
    }
  }
  x.font = '10px "IBM Plex Mono", monospace';
  x.textAlign = 'right';
  x.fillStyle = open === 7 ? 'rgba(59,232,176,.9)' : 'rgba(242,237,226,.44)';
  x.fillText('W A T E R   ' + open + ' / 7', right + 2, y + 26);
  x.textAlign = 'left';
}

function drawFlood(x, g) {
  const dur = S.reduced ? 1100 : 2500;
  const t = Math.min(1, S.floodT / dur);
  const e = 1 - Math.pow(1 - t, 2.4);
  const rad = e * Math.max(g.W, g.H) * 0.86;
  const gr = x.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, Math.max(1, rad));
  gr.addColorStop(0, `rgba(59,232,176,${0.5 * (1 - t * 0.45)})`);
  gr.addColorStop(0.35, `rgba(59,232,176,${0.2 * (1 - t * 0.3)})`);
  gr.addColorStop(0.85, `rgba(59,232,176,${0.07})`);
  gr.addColorStop(1, 'rgba(59,232,176,0)');
  x.fillStyle = gr;
  x.beginPath();
  x.arc(g.cx, g.cy, Math.max(1, rad), 0, TAU);
  x.fill();

  if (!S.reduced) {
    for (let i = 0; i < 4; i++) {
      const tt = t - i * 0.12;
      if (tt <= 0) continue;
      x.strokeStyle = `rgba(242,237,226,${0.2 * (1 - tt)})`;
      x.lineWidth = 2;
      x.beginPath();
      x.arc(g.cx, g.cy, tt * rad * 1.05, 0, TAU);
      x.stroke();
    }
  }
}

// --------------------------------------------------------------------------- API
export default {
  id: 'seventh',

  enter(ctx) {
    const g = geo();
    const style = document.createElement('style');
    style.textContent = CSS;
    ctx.root.appendChild(style);

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
      keys: new Set(),
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
    slug.innerHTML = '<b>VII</b>NO NAME · NO DEPTH<br>SURVEY STATUS: <span style="color:var(--sand)">DRY</span>';
    ctx.root.appendChild(slug);
    S.slug = slug;

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 's7__exit';
    exit.innerHTML = '↑ surface &nbsp;<span style="opacity:.6">[esc]</span>';
    ctx.root.appendChild(exit);
    const onExit = () => ctx.go('surface', { from: 'seventh' });
    exit.addEventListener('click', onExit);
    S.listeners.push([exit, 'click', onExit]);

    // ---- input: pointer and keyboard drive the same rod target
    const onMove = (e) => {
      if (!S) return;
      S.rod.tx = e.clientX;
      S.rod.ty = e.clientY;
      S.usedMouse = true;
    };
    const onDown = (e) => {
      if (!S) return;
      if (e.target && e.target.closest && e.target.closest('button')) return;
      // you strike where you point, not where the rod has drifted to
      S.rod.x = S.rod.tx = e.clientX;
      S.rod.y = S.rod.ty = e.clientY;
      strike(ctx);
    };
    const onKey = (e) => {
      if (!S) return;
      if (e.target && e.target.tagName === 'BUTTON') return;
      const k = e.key;
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        strike(ctx);
        return;
      }
      if (/^(Arrow(Up|Down|Left|Right)|w|a|s|d|W|A|S|D)$/.test(k)) {
        e.preventDefault();
        S.keys.add(k.length === 1 ? k.toLowerCase() : k);
      }
    };
    const onKeyUp = (e) => {
      if (!S) return;
      const k = e.key;
      S.keys.delete(k.length === 1 ? k.toLowerCase() : k);
    };
    const onBlur = () => { if (S) S.keys.clear(); };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    S.listeners.push(
      [window, 'pointermove', onMove],
      [window, 'pointerdown', onDown],
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
        if (S.slug) {
          S.slug.innerHTML = '<b>VII</b>NO NAME · DEPTH: FOUND<br>SURVEY STATUS: ' +
            '<span style="color:var(--water)">WATER</span>';
        }
      }
    }

    // keyboard nudges the same target the mouse sets
    if (S.keys.size) {
      let kx = 0;
      let ky = 0;
      if (S.keys.has('ArrowLeft') || S.keys.has('a')) kx -= 1;
      if (S.keys.has('ArrowRight') || S.keys.has('d')) kx += 1;
      if (S.keys.has('ArrowUp') || S.keys.has('w')) ky -= 1;
      if (S.keys.has('ArrowDown') || S.keys.has('s')) ky += 1;
      const l = Math.hypot(kx, ky) || 1;
      const sp = 0.72 * dt;
      S.rod.tx += (kx / l) * sp;
      S.rod.ty += (ky / l) * sp;
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
    if (heat > 0.14 && target) {
      const a0 = Math.atan2(target.p.y - S.rod.y, target.p.x - S.rod.x);
      want = a0 + (1 - heat) * Math.sin(S.t * 0.004) * 1.5;
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

    // ------------------------------------------------------------------ render
    const x = S.L.ctx2d;
    x.clearRect(0, 0, S.L.w, S.L.h);
    if (S.stat) {
      if (S.stat.width !== Math.round(g.W * S.statDpr) ||
          S.stat.height !== Math.round(g.H * S.statDpr)) buildStatic(g);
      x.drawImage(S.stat, 0, 0, g.W, g.H);
    }
    drawHint(x, g);
    drawVein(x, g);
    drawPits(x, g);
    drawCentre(x, g);
    drawNodes(x, g);
    drawRipples(x);
    if (S.phase === 'flood' || S.phase === 'done') drawFlood(x, g);
    if (S.phase === 'play' || S.phase === 'ring') drawRod(x, g, heat, target);
    drawHud(x, g);
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
