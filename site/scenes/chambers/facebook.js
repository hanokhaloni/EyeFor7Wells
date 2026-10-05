// WELL 06 — FACEBOOK — 70 m. The oldest well, and the deepest.
// The depth IS the room: an enormous "70", cut out of the dark like a core sample, with
// the strata showing through the numerals. Everything outside them is near-black flat
// shapes: the same layers at a whisper, and a black slab of bedrock the numerals sink
// into. A bone survey line rides the pointer and reads the depth it crosses.
// Labels are neutral geology (layer names only), not history and not measurements.
// Palette (three colours, committed): black #060607, cobalt #2F4BFF, bone #EDE6D6.

import { MONO, DISPLAY, rgba, tracked } from './_shared.js';

// the inner edge of the frame's wall bands (the band plus its lit lip): text stays inside it
const wallIn = (g) => (g && g.wall ? g.wall + Math.max(4, Math.round(g.wall * 0.34)) : 0);

const BLACK = '#060607';
const COBALT = '#2F4BFF';
const BONE = '#EDE6D6';
const COBALT_TEXT = '#8E9CFF';   // cobalt lifted for small type on black
const TAU = Math.PI * 2;

const RING = `<svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
  <circle cx="22" cy="22" r="19" stroke="var(--key-text)" stroke-width="2.4"/>
  <circle cx="22" cy="22" r="9" stroke="var(--key-text)" stroke-width="2"/>
  <circle cx="22" cy="22" r="3" fill="var(--key-text)"/>
</svg>`;

// nominal layers, top to bottom. f = top of the layer as a fraction of 70 m.
const LAYERS = [
  { n: 'I',   name: 'LOESS',    f: 0 },
  { n: 'II',  name: 'GRAVEL',   f: 0.12 },
  { n: 'III', name: 'CHALK',    f: 0.27 },
  { n: 'IV',  name: 'FLINT',    f: 0.44 },
  { n: 'V',   name: 'MARL',     f: 0.53 },
  { n: 'VI',  name: 'BEDROCK',  f: 0.77 },
];
function layout(w, h, linkTop = null, hole = null) {
  const m = w < 640;
  // the numerals start below the hole you fell through (top 20% kept open; on a short
  // screen, just under the hole) and fit inside the frame's walls at every width: 80% of a
  // phone, 56% of a desktop
  const short = h < 520 && linkTop != null;
  const top = short && hole ? Math.min(h * 0.2, hole.y + hole.r + 6) : h * 0.2;
  const fs = Math.max(1, Math.min(h * 0.6, (w * (m ? 0.8 : 0.56)) / 0.988));
  const gw = fs * 0.988;
  // the bedrock slab swallows the foot of the numerals
  const slabY = Math.min(h * 0.66, top + fs * 0.875 - fs * 0.12);
  // on a phone the numerals sit a little left, leaving the right edge to the layer chips
  let fs2 = m ? Math.min(fs, (w * 0.74) / 0.988) : fs;
  // a short screen: the core (down to the slab that swallows its foot) stands clear above
  // the link's plate
  if (short) fs2 = Math.max(24, Math.min(fs2, (linkTop - 8 - top) / 0.755));
  const gw2 = fs2 * 0.988;
  const cx = m ? w / 2 - w * 0.035 : w / 2;
  return { m, short, fs: fs2, gw: gw2, top, slabY: Math.min(slabY, top + fs2 * 0.755), cx, x0: cx - gw2 / 2, x1: cx + gw2 / 2 };
}

// draw the strata (full strength) into c over the band [top, bottom]
function strata(c, w, h, Y, prng) {
  const span = Y.slabY - Y.top;
  const yOf = (f) => Y.top + f * span;
  c.fillStyle = BLACK;
  c.fillRect(0, 0, w, h);
  // jagged boundaries, fixed per layout
  const edge = LAYERS.map(() => {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) pts.push((prng() - 0.5) * span * 0.035);
    return pts;
  });
  const band = (i, fill) => {
    const y0 = yOf(LAYERS[i].f), y1 = i + 1 < LAYERS.length ? yOf(LAYERS[i + 1].f) : h + 10;
    const e0 = edge[i], e1 = edge[i + 1] || null;
    c.beginPath();
    for (let k = 0; k < e0.length; k++) {
      const x = (k / (e0.length - 1)) * w;
      k ? c.lineTo(x, y0 + (i ? e0[k] : 0)) : c.moveTo(x, y0 + (i ? e0[k] : 0));
    }
    for (let k = (e1 ? e1.length : 2) - 1; k >= 0; k--) {
      const x = (k / ((e1 ? e1.length : 2) - 1)) * w;
      c.lineTo(x, y1 + (e1 ? e1[k] : 0));
    }
    c.closePath();
    fill(y0, y1);
  };
  // I loess: solid cobalt
  band(0, () => { c.fillStyle = COBALT; c.fill(); });
  // II gravel: black, packed bone pebbles
  band(1, (y0, y1) => {
    c.fillStyle = BLACK; c.fill();
    c.save(); c.clip();
    c.fillStyle = BONE;
    const r = Math.max(3, span * 0.012);
    for (let y = y0 - r; y < y1 + r; y += r * 3.2) {
      for (let x = ((y / r) % 2) * r * 1.6; x < w; x += r * 3.2) {
        c.beginPath(); c.ellipse(x + (prng() - 0.5) * r, y + (prng() - 0.5) * r, r * (0.6 + prng() * 0.6), r * (0.45 + prng() * 0.4), prng() * 3, 0, TAU); c.fill();
      }
    }
    c.restore();
  });
  // III chalk: solid bone
  band(2, () => { c.fillStyle = BONE; c.fill(); });
  // IV flint: black, a seam of cobalt nodules
  band(3, (y0, y1) => {
    c.fillStyle = BLACK; c.fill();
    c.save(); c.clip();
    c.fillStyle = COBALT;
    const my = (y0 + y1) / 2, r = (y1 - y0) * 0.32;
    for (let x = 0; x < w; x += r * 3.1) {
      c.beginPath(); c.ellipse(x + prng() * r, my + (prng() - 0.5) * r * 0.6, r * (1 + prng() * 0.5), r * (0.55 + prng() * 0.3), 0, 0, TAU); c.fill();
    }
    c.restore();
  });
  // V marl: cobalt, bone bedding lines
  band(4, (y0, y1) => {
    c.fillStyle = COBALT; c.fill();
    c.save(); c.clip();
    c.fillStyle = BONE;
    const lh = Math.max(2, span * 0.006);
    for (let y = y0 + (y1 - y0) * 0.2; y < y1; y += (y1 - y0) / 4.2) c.fillRect(0, y, w, lh);
    c.restore();
  });
  // VI bedrock: black, struck through with bone joints
  band(5, (y0, y1) => {
    c.fillStyle = BLACK; c.fill();
    c.save(); c.clip();
    c.strokeStyle = BONE;
    c.lineWidth = Math.max(2, span * 0.006);
    for (let x = -h; x < w; x += span * 0.14) {
      c.beginPath(); c.moveTo(x, y0); c.lineTo(x + (y1 - y0) * 0.6, y1); c.stroke();
    }
    c.restore();
  });
}

export default function make({ fx, audio }) {
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  let cache = null, cacheKey = '';
  let onMove = null;
  const pointer = { y: null };
  let lineY = null, dripAcc = 0, live = false, t0 = -1;
  let titleBottom = 0, titleAt = -1e9, linkTop = null, takeAt = -1e9;
  const RISE = 280;                                // ms from the room's first frame
  let drop = null;

  function build(w, h, dpr, Y) {
    const mk = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const cc = cv.getContext('2d');
      cc.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { cv, cc };
    };
    const A = mk(), B = mk();
    // the numerals, filled with the strata
    strata(B.cc, w, h, Y, fx.rnd(6070));
    B.cc.globalCompositeOperation = 'destination-in';
    B.cc.font = DISPLAY(Y.fs);
    B.cc.textAlign = 'center';
    B.cc.textBaseline = 'alphabetic';
    const base = Y.top + Y.fs * 0.875;
    B.cc.fillText('70', Y.cx, base);
    B.cc.globalCompositeOperation = 'source-over';
    B.cc.strokeStyle = BONE;
    B.cc.lineWidth = Math.max(2, Y.fs * 0.004);
    B.cc.strokeText('70', Y.cx, base);

    // the room: the same layers at a whisper, as flat dark shapes
    strata(A.cc, w, h, Y, fx.rnd(6070));
    A.cc.fillStyle = rgba(BLACK, 0.86);
    A.cc.fillRect(0, 0, w, h);
    A.cc.drawImage(B.cv, 0, 0, w, h);

    // the slab the numerals sink into
    const p = fx.rnd(77);
    A.cc.fillStyle = BLACK;
    A.cc.beginPath();
    A.cc.moveTo(0, Y.slabY);
    const n = 14;
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([(i / n) * w, Y.slabY + (i && i < n ? (p() - 0.5) * h * 0.018 : 0)]);
    for (const [x, y] of pts) A.cc.lineTo(x, y);
    A.cc.lineTo(w, h); A.cc.lineTo(0, h); A.cc.closePath(); A.cc.fill();
    A.cc.strokeStyle = BONE;
    A.cc.lineWidth = 2;
    A.cc.beginPath();
    pts.forEach(([x, y], i) => (i ? A.cc.lineTo(x, y) : A.cc.moveTo(x, y)));
    A.cc.stroke();
    return { A, base };
  }

  return {
    pal: {
      ink: BLACK, stone: '#101016', stoneDark: BLACK, bone: BONE,
      key: COBALT, keyText: COBALT_TEXT, cone: BONE, dust: BONE,
    },
    frame: { vault: false, gauge: false, index: false, notes: false, title: true, air: false },
    takeHz: 150,
    take: {
      verb: 'DIG IN',
      cta: 'FOLLOW ON FACEBOOK',
      label: 'dig in',
      host: 'facebook.com',
      art: RING,
      pos: {
        // a short landscape phone sends the link to the bottom (the frame clamps it above
        // the exits), leaving the room above it for the hero
        get top() { return typeof innerHeight === 'number' && innerHeight < 500 && innerWidth > innerHeight ? '92%' : '76%'; },
        left: '50%',
      },
      variant: 'plate',
    },

    init(env) {
      geo = env.geo;
      L = env.layer(3);
      onMove = (e) => { pointer.y = e.clientY; };
      window.addEventListener('pointermove', onMove, { passive: true });
      if (document.fonts && document.fonts.load) {
        document.fonts.load('100px Anton').then(() => { cacheKey = ''; }).catch(() => {});
      }
    },

    onLanded() {
      live = true;
      audio.noise({ dur: 1.2, gain: 0.05, band: [40, 300] });
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      const w = g.w, h = g.h;
      if (!(w >= 1 && h >= 1)) return;
      if (t0 < 0) t0 = t;
      if (t - takeAt > 400) {
        takeAt = t;
        // the plate and its call (the ring above them may hang on the core, like the rope)
        const a = document.querySelector('.ch[data-well="facebook"] .ch-take__txt') || document.querySelector('.ch[data-well="facebook"] .ch-take');
        const r = a && a.getBoundingClientRect();
        linkTop = r && r.height ? Math.round(r.top / 6) * 6 : null;
      }
      const Y = layout(w, h, linkTop, g.hole);

      const fontOk = !document.fonts || document.fonts.check('100px Anton');
      const key = `${w}x${h}@${L.dpr}:${fontOk}:${h < 520 ? linkTop : 0}`;
      if (key !== cacheKey || !cache) {
        try { cache = build(w, h, L.dpr, Y); cacheKey = key; } catch (e) { cache = null; }
      }

      c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      c.fillStyle = BLACK;
      c.fillRect(0, 0, w, h);

      // the core rises into place in the first beat, on the room's own clock
      const q = reduced ? 1 : Math.min(1, Math.max(0, (t - t0) / RISE));
      const dy = (1 - fx.ease.outCubic(q)) * h * 0.6;
      c.save();
      c.translate(0, dy);
      if (cache && cache.A.cv.width >= 1 && cache.A.cv.height >= 1) c.drawImage(cache.A.cv, 0, 0, w, h);

      const span = Y.slabY - Y.top;

      // --- a drop, falling through the counter of the 0, now and then
      if (live && !reduced) {
        dripAcc += dt;
        if (dripAcc > 7400) {
          dripAcc = 0;
          audio.drip({ pitch: 0.55 });
          drop = { y: Y.top + span * 0.08, v: 0 };
        }
      }
      if (drop) {
        drop.v += dt * 0.0022;
        drop.y += drop.v * dt;
        const dx = Y.cx + Y.gw * 0.25;
        c.fillStyle = BONE;
        c.beginPath(); c.ellipse(dx, drop.y, Math.max(3, Y.fs * 0.008), Math.max(5, Y.fs * 0.014), 0, 0, TAU); c.fill();
        if (drop.y > Y.slabY - 4) drop = null;
      }

      // --- the survey line: follows the pointer, else drifts slowly down the core
      let target;
      if (pointer.y != null) target = pointer.y - dy;
      else if (reduced) target = Y.top + span * 0.36;
      else target = Y.top + span * (0.5 + 0.42 * Math.sin(t / 4200));
      // the readout rides on the left: keep it under the frame's title block
      if (t - titleAt > 500) {
        titleAt = t;
        const id = document.querySelector('.ch[data-well="facebook"] .ch-id');
        const r = id && id.getBoundingClientRect();
        titleBottom = r && r.height ? r.bottom : 0;
      }
      const floor = Math.max(Y.top + 2, titleBottom + 16 - dy);
      target = Math.max(floor, Math.min(Y.slabY - 4, target));
      lineY = lineY == null || reduced ? target : lineY + (target - lineY) * Math.min(1, dt * 0.012);
      const depth = ((lineY - Y.top) / span) * 70;
      let cur = 0;
      for (let i = 0; i < LAYERS.length; i++) if (depth >= LAYERS[i].f * 70) cur = i;

      c.fillStyle = BONE;
      c.fillRect(0, Math.round(lineY), w, 1.5);
      c.font = MONO(Y.m ? 10 : 11, 600);
      c.textAlign = 'left';
      const dtxt = depth.toFixed(1) + ' M';
      const tw = c.measureText(dtxt).width + dtxt.length * 2 + 14;
      const inset = wallIn(g) + (Y.m ? 10 : 16);   // inside the frame's wall bands
      const tx = inset + 7;
      c.fillStyle = BONE;
      c.fillRect(tx - 7, lineY - 10, tw, 20);
      c.fillStyle = BLACK;
      tracked(c, dtxt, tx, lineY + 4, { track: 2 });

      // --- the core log: layer names at their depths, legible, on black
      for (let i = 0; i < LAYERS.length; i++) {
        const y0 = Y.top + LAYERS[i].f * span;
        const y1 = i + 1 < LAYERS.length ? Y.top + LAYERS[i + 1].f * span : Y.slabY;
        const my = (y0 + y1) / 2;
        const on = i === cur;
        if (Y.m) {
          // phone: chips inside the right wall; only the layer under the line is named
          // (a short screen packs the core too tight for six chips: only that one shows)
          if (Y.short && !on) continue;
          const label = on ? LAYERS[i].n + ' ' + LAYERS[i].name : LAYERS[i].n;
          c.font = MONO(10, 600);
          const lw = c.measureText(label).width + label.length * 1.6 + 14;
          c.fillStyle = on ? BONE : BLACK;
          c.fillRect(w - inset - lw, my - 10, lw, 20);
          c.fillStyle = on ? BLACK : BONE;
          tracked(c, label, w - inset - lw + 7, my + 4, { track: 1.6 });
        } else {
          const lx = Y.x1 + 30;
          c.fillStyle = on ? BONE : rgba(BONE, 0.45);
          c.fillRect(Y.x1 + 6, Math.round(y0), 16, 1.5);
          c.font = MONO(12, 700);
          c.fillStyle = on ? COBALT_TEXT : rgba(COBALT_TEXT, 0.8);
          tracked(c, LAYERS[i].n, lx, my - 4, { track: 2 });
          c.font = DISPLAY(on ? 30 : 22);
          c.fillStyle = on ? BONE : rgba(BONE, 0.78);
          tracked(c, LAYERS[i].name, lx + 34, my + 8, { track: 1.5 });
        }
      }

      // --- the unit, small, hard against the giant numerals
      if (!Y.m) {
        c.font = MONO(11, 700);
        c.fillStyle = BONE;
        c.textAlign = 'left';
        tracked(c, 'M BELOW DATUM', Y.x1 + 30, Y.top - 12, { track: 3 });
      }
      c.restore();
    },

    dispose() {
      if (onMove) window.removeEventListener('pointermove', onMove);
      onMove = null; L = null; geo = null; cache = null;
    },
  };
}
