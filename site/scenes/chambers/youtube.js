// WELL 04 — YOUTUBE — 44 m. Talks, recorded.
// A projection chamber, drawn flat. The whole room is one projected screen: an amber
// rectangle bigger than anything else down here, with the name and an enormous play
// triangle cut out of it, running into the right wall. The projector is a bone silhouette
// on the left, the beam a flat wedge, and the audience a row of heads. The link stands by
// the left wall, under the projector ('side').
// The image behind the cut-outs hard-cuts every 1.5 s.
// Palette (three colours, committed): plum #1E0B2A, amber #FFB000, bone #F2EDE2.

import { MONO, DISPLAY, HE, rgba, tracked } from './_shared.js';

// the inner edge of the frame's wall bands (the band plus its lit lip): text stays inside it
const wallIn = (g) => (g && g.wall ? g.wall + Math.max(4, Math.round(g.wall * 0.34)) : 0);

const PLUM = '#1E0B2A';
const AMBER = '#FFB000';
const BONE = '#F2EDE2';
const TAU = Math.PI * 2;

const REEL = `<svg width="54" height="34" viewBox="0 0 54 34" fill="none" aria-hidden="true">
  <circle cx="15" cy="17" r="13" stroke="var(--key)" stroke-width="2.4"/>
  <circle cx="39" cy="17" r="13" stroke="var(--key)" stroke-width="2.4"/>
  <circle cx="15" cy="17" r="3" fill="var(--key)"/>
  <circle cx="39" cy="17" r="3" fill="var(--key)"/>
</svg>`;

// --- layout: one function, every viewport ---------------------------------------
// The screen starts below the hole you fell through (top 20% stays open). On a wide screen
// the triangle is cut into the screen's left, where the rope comes down to the link, and the
// name into its right; on a phone the name is split around the rope (YOU | TUBE) with the
// triangle below it.
function layout(w, h, wall = 0, takeR = null) {
  const m = w < 640;
  if (m) {
    // a short landscape phone: the link stands by the left wall, the screen beside it
    const land = w > h && h < 500;
    const sx0 = land ? Math.max(w * 0.45, (takeR ? takeR.right : w * 0.55) + 14) : -2;
    const sx1 = w + 2, sy0 = h * 0.2, sy1 = h * (land ? 0.8 : 0.66);
    const pad = Math.max(18, w * (land ? 0.03 : 0.09));   // clear of the frame's wall bands
    return {
      m, land, sx0, sx1, sy0, sy1, pad,
      nameX: pad, nameW: w - pad * 2, nameTop: sy0 + pad * 0.8,
      tri: { area: 'below' },
      proj: null,
      headR: h * 0.022, headsY: sy1,
      tag: { x: Math.max(pad, wall + 12), y: sy0 - 12 },
    };
  }
  // the screen runs into the right wall band, which crops it
  const sx0 = w * 0.36, sx1 = w + 2, sy0 = h * 0.2, sy1 = h * 0.8;
  const inner = sx1 - Math.max(wall, 8) - sx0;      // the part of the screen you can see
  const pad = Math.max(28, inner * 0.05);
  const H = Math.min((sy1 - sy0) * 0.64, inner * 0.46 / 0.866);
  const W = H * 0.866;
  const triL = sx0 + pad * 1.2;
  const nameR = sx0 + inner - pad;
  const ps = Math.min(w * 0.12, h * 0.22) / 170;
  return {
    m, sx0, sx1, sy0, sy1, pad,
    nameX: triL + W + pad * 1.2, nameR, nameW: nameR - (triL + W + pad * 1.2), nameTop: sy0 + pad,
    tri: { area: 'right', H, W, l: triL, cy: (sy0 + sy1) / 2 - (sy1 - sy0) * 0.04 },
    proj: { x: sx0 - 186 * ps - w * 0.04, y: h * 0.27, s: ps, dir: 'right' },
    headR: Math.max(16, h * 0.03), headsY: sy1,
    tag: { x: sx0, y: sy0 - 14 },
  };
}

// Where the frame's rope (hole -> link) crosses the band [ya, yb]: [minX, maxX], or null.
// Mirrors the frame's curve (a straight drop, or a bend to an off-centre link), padded for
// its sway and thickness, so the name can be cut around it.
function ropeBand(g, ya, yb) {
  if (!g || !g.hole) return null;
  const x0 = g.hole.x, y0 = g.hole.y + g.hole.r * 0.4;
  const x1 = g.rope ? g.rope.x : x0, y1 = g.rope ? g.rope.y : g.h * 0.8;
  if (yb < y0 || ya > y1) return null;
  if (Math.abs(x1 - x0) < 2) return [x0 - 7, x0 + 7];
  const d = y1 - y0;
  const P = [[x0, y0], [x0, y0 + d * 0.55], [x1, y1 - d * 0.3], [x1, y1]];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const y = k[0] * P[0][1] + k[1] * P[1][1] + k[2] * P[2][1] + k[3] * P[3][1];
    if (y < ya || y > yb) continue;
    const x = k[0] * P[0][0] + k[1] * P[1][0] + k[2] * P[2][0] + k[3] * P[3][0];
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  return lo <= hi ? [lo - 7, hi + 7] : null;
}

// --- the image behind the triangle: four abstractions of a recorded talk -------
// Drawn in plum on amber, low contrast, so the triangle stays the hero.
function plate(c, x, y, w, h, k, t, still) {
  const ink = (a) => rgba(PLUM, a);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = AMBER;
  c.fillRect(x, y, w, h);
  const mx = x + w / 2, my = y + h / 2, R = Math.max(w, h);
  if (k === 0) {                                  // film leader: rings, cross, sweep
    c.fillStyle = ink(0.13);
    c.beginPath(); c.moveTo(mx, my);
    const a0 = -Math.PI / 2, a1 = a0 + (still ? 0.7 : ((t / 1500) % 1)) * TAU;
    c.arc(mx, my, R, a0, a1); c.closePath(); c.fill();
    c.strokeStyle = ink(0.22); c.lineWidth = Math.max(3, R * 0.008);
    for (const f of [0.22, 0.34]) { c.beginPath(); c.arc(mx, my, R * f, 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(x, my); c.lineTo(x + w, my); c.moveTo(mx, y); c.lineTo(mx, y + h); c.stroke();
  } else if (k === 1) {                           // a slide: heading bar and body lines
    c.fillStyle = ink(0.16);
    c.fillRect(x + w * 0.07, y + h * 0.1, w * 0.42, h * 0.11);
    for (let i = 0; i < 6; i++) c.fillRect(x + w * 0.07, y + h * (0.32 + i * 0.1), w * (0.3 + ((i * 37) % 50) / 100), h * 0.035);
  } else if (k === 2) {                           // a speaker, huge, off to the side
    c.fillStyle = ink(0.15);
    c.beginPath(); c.arc(x + w * 0.82, y + h * 0.36, h * 0.17, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x + w * 0.82, y + h * 1.02, h * 0.36, h * 0.46, 0, 0, TAU); c.fill();
    c.fillRect(x + w * 0.04, y + h * 0.08, w * 0.3, h * 0.5);
  } else {                                        // the recording: waveform bars
    c.fillStyle = ink(0.15);
    const n = 30;
    for (let i = 0; i < n; i++) {
      const bh = h * 0.8 * Math.abs(Math.sin(i * 0.9 + 1.3) * Math.cos(i * 0.31));
      c.fillRect(x + (i + 0.2) * (w / n), my - bh / 2, (w / n) * 0.55, bh);
    }
  }
  c.restore();
}

export default function make({ fx, audio }) {
  const reduced = !!fx.reducedMotion;
  const prng = fx.rnd(4404);
  let L = null, geo = null;
  let idx = 0, acc = 0, live = false, t0 = -1;
  // the link's box on screen (measured; the frame places it): short screens fit around it
  let takeR = null, takeAt = -1e9;
  const takeBox = (t) => {
    if (t - takeAt > 400) {
      takeAt = t;
      const a = document.querySelector('.ch[data-well="youtube"] .ch-take');
      const r = a && a.getBoundingClientRect();
      takeR = r && r.height ? { top: r.top, right: r.right, left: r.left } : null;
    }
    return takeR;
  };

  const RISE = 280;                               // ms from the room's first frame

  // the audience: a fixed row of heads, seeded
  const heads = [];
  for (let i = 0; i < 18; i++) heads.push({ x: (i + 0.15 + prng() * 0.7) / 18, s: 0.82 + prng() * 0.36, l: prng() * 0.4 });

  function projector(c, P, t) {
    // drawn in a 170-unit box; P.dir says where the lens points
    c.save();
    c.translate(P.x, P.y);
    c.scale(P.s, P.s);
    if (P.dir === 'down' || P.dir === 'right') { c.translate(170, 0); c.scale(-1, 1); }
    const spin = reduced ? 0.5 : t / 900;
    // reels
    for (const [rx, ry, rr] of [[52, 34, 34], [128, 30, 30]]) {
      c.fillStyle = BONE;
      c.beginPath(); c.arc(rx, ry, rr, 0, TAU); c.fill();
      c.fillStyle = PLUM;
      for (let i = 0; i < 3; i++) {
        const a = spin + i * TAU / 3;
        c.beginPath(); c.arc(rx + Math.cos(a) * rr * 0.5, ry + Math.sin(a) * rr * 0.5, rr * 0.24, 0, TAU); c.fill();
      }
      c.beginPath(); c.arc(rx, ry, rr * 0.12, 0, TAU); c.fill();
    }
    // body, lens hood, legs
    c.fillStyle = BONE;
    c.fillRect(20, 70, 140, 64);
    c.beginPath(); c.moveTo(20, 84); c.lineTo(-6, 76); c.lineTo(-6, 128); c.lineTo(20, 120); c.closePath(); c.fill();
    c.fillStyle = PLUM;
    c.fillRect(34, 84, 80, 6);
    c.fillRect(34, 98, 54, 6);
    c.fillStyle = BONE;
    c.fillRect(42, 134, 8, 46);
    c.fillRect(132, 134, 8, 46);
    c.restore();
  }

  function lensPoint(P) {
    // the lens tip in screen space
    if (P.dir === 'down' || P.dir === 'right') return { x: P.x + (170 - -6) * P.s, y: P.y + 102 * P.s };
    return { x: P.x - 6 * P.s, y: P.y + 102 * P.s };
  }

  return {
    pal: {
      ink: PLUM, stone: '#2A1238', stoneDark: PLUM, bone: BONE,
      key: AMBER, keyText: AMBER, cone: AMBER, dust: BONE,
    },
    frame: { vault: false, gauge: false, index: false, notes: false, title: false, air: false },
    takeHz: 220,
    take: {
      verb: 'TAKE A SEAT',
      cta: 'WATCH ON YOUTUBE',
      label: 'take a seat',
      host: 'youtube.com',
      art: REEL,
      pos: {
        // a short landscape phone sends the link to the bottom (the frame clamps it above
        // the exits), leaving the room above it for the hero
        get top() { return typeof innerHeight === 'number' && innerHeight < 500 && innerWidth > innerHeight ? '92%' : '78%'; },
        left: '50%',
      },
      variant: 'side',
    },
    // the screen carries the name; this keeps it in the document for readers and search
    ui: `<span style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">YouTube · יוטיוב · talks, recorded · 44 m</span>`,

    init(env) { geo = env.geo; L = env.layer(3); },

    onLanded() {
      live = true;
      audio.noise({ dur: 0.5, gain: 0.05, band: [400, 2600] });
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      const w = g.w, h = g.h;
      if (!(w >= 1 && h >= 1)) return;
      if (t0 < 0) t0 = t;
      const Y = layout(w, h, wallIn(g), takeBox(t));

      // hard cut, on the beat
      if (live && !reduced) {
        acc += dt;
        if (acc > 1500) {
          acc = 0; idx++;
          audio.noise({ dur: 0.06, gain: 0.04, band: [600, 3600] });
        }
      }

      c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      c.fillStyle = PLUM;
      c.fillRect(0, 0, w, h);

      // the screen rises into place in the first beat, on the room's own clock
      const q = reduced ? 1 : Math.min(1, Math.max(0, (t - t0) / RISE));
      const dy = (1 - fx.ease.outCubic(q)) * h * 0.55;
      c.save();
      c.translate(0, dy);

      // --- the screen, and the image on it
      const sw = Y.sx1 - Y.sx0, sh = Y.sy1 - Y.sy0;
      plate(c, Y.sx0, Y.sy0, sw, sh, idx % 4, t, reduced);

      // --- the name: cut out of the light, as big as the screen allows, never under the rope
      c.textBaseline = 'alphabetic';
      c.fillStyle = PLUM;
      let fs = sh * (Y.m ? 0.3 : 0.34);
      c.font = DISPLAY(100);
      const em = c.measureText('YOUTUBE').width / 100;
      const inL = Y.m ? Math.max(Y.land ? Y.sx0 + 12 : Y.pad, wallIn(g) + 12) : Y.nameX;
      const inR = Y.m ? w - Math.max(Y.pad, wallIn(g) + 12) : Y.nameR;
      let nameL = inL, nameR = inR, nameBase;
      if (Y.m) {
        fs = Math.min(fs, (inR - inL) / em);
        let band = ropeBand(g, Y.nameTop, Y.nameTop + fs * 0.9);
        if (band && (band[1] <= inL || band[0] >= inR)) band = null;   // the rope misses the screen
        nameBase = Y.nameTop + fs * 0.86;
        if (band) {
          const gap = Math.max(5, fs * 0.04);
          const wa = c.measureText('YOU').width / 100, wb = c.measureText('TUBE').width / 100;
          fs = Math.min(fs, (band[0] - gap - inL) / wa, (inR - band[1] - gap) / wb);
          nameBase = Y.nameTop + fs * 0.86;
          c.font = DISPLAY(fs);
          c.textAlign = 'right';
          c.fillText('YOU', band[0] - gap, nameBase);
          c.textAlign = 'left';
          c.fillText('TUBE', band[1] + gap, nameBase);
          nameL = band[0] - gap - wa * fs; nameR = band[1] + gap + wb * fs;
        } else {
          c.font = DISPLAY(fs);
          const mid = (inL + inR) / 2;
          c.textAlign = 'center';
          c.fillText('YOUTUBE', mid, nameBase);
          nameL = mid - em * fs / 2; nameR = mid + em * fs / 2;
        }
      } else {
        const band = ropeBand(g, Y.nameTop, Y.nameTop + fs);
        const from = band ? Math.max(inL, band[1] + 14) : inL;
        fs = Math.min(fs, (inR - from) / em);
        nameBase = Y.nameTop + fs * 0.86;
        c.font = DISPLAY(fs);
        c.textAlign = 'right';
        c.fillText('YOUTUBE', inR, nameBase);
        nameL = inR - em * fs;
      }
      const tight = Y.m;               // stays left of the rope on a phone
      const capTr = tight ? 1 : Y.m ? 2 : 3;
      c.font = MONO(tight ? 9 : Y.m ? 10 : 12, 700);
      let capW = 0;
      for (const ch of 'TALKS, RECORDED') capW += c.measureText(ch).width + capTr;
      // the Hebrew shares its line with the caption: it gives way rather than run into it
      let heFs = Math.max(16, fs * 0.24);
      c.font = HE(heFs, 800);
      const room = nameR - (nameL + 2 + capW + 10);
      const heW = c.measureText('יוטיוב').width;
      if (heW > room) { heFs = Math.max(10, heFs * room / heW); c.font = HE(heFs, 800); }
      c.textAlign = 'right';
      c.fillText('יוטיוב', nameR, nameBase + Math.max(16, fs * 0.24) * 1.35);
      c.textAlign = 'left';
      heFs = Math.max(16, fs * 0.24);
      c.font = MONO(tight ? 9 : Y.m ? 10 : 12, 700);
      tracked(c, 'TALKS, RECORDED', nameL + 2, nameBase + heFs * 1.2, { track: capTr });

      // --- the play triangle: a hole cut in the light
      let T;
      if (Y.tri.area === 'right') T = Y.tri;
      else {
        const top = nameBase + heFs * 2.2, bot = Y.sy1 - Y.headR * 3.2;
        const H = Math.max(10, Math.min(bot - top, w * 0.62 / 0.866));
        T = { H, W: H * 0.866, cy: (top + bot) / 2 };
        if (Y.land) { T.H = Math.min(T.H, (inR - inL) * 0.7 / 0.866); T.W = T.H * 0.866; }
        T.l = (inL + inR) / 2 - T.W / 3;
      }
      c.fillStyle = PLUM;
      c.beginPath();
      c.moveTo(T.l, T.cy - T.H / 2);
      c.lineTo(T.l + T.W, T.cy);
      c.lineTo(T.l, T.cy + T.H / 2);
      c.closePath();
      c.fill();

      // --- the audience, in silhouette against the light
      c.fillStyle = PLUM;
      const hr = Y.headR;
      c.save();
      c.beginPath(); c.rect(Y.sx0 - hr * 3, Y.sy0, sw + hr * 6, h); c.clip();
      for (const hd of heads) {
        const x = Y.sx0 + hd.x * sw, r = hr * hd.s;
        const base = Y.headsY + r * 0.7;
        c.beginPath(); c.arc(x, base - r * 1.9 - hd.l * r, r, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(x, base + r * 0.6, r * 2.1, r * 1.9, 0, Math.PI, 0); c.fill();
        c.fillRect(x - r * 2.1, base + r * 0.6, r * 4.2, h);
      }
      c.restore();

      // --- the beam: flat wedge from lens to the screen's near edge (wide screens only)
      if (Y.proj) {
        const lp = lensPoint(Y.proj);
        c.fillStyle = rgba(AMBER, 0.3);
        c.beginPath();
        c.moveTo(lp.x, lp.y - 12 * Y.proj.s);
        c.lineTo(Y.sx0, Y.sy0);
        c.lineTo(Y.sx0, Y.sy1);
        c.lineTo(lp.x, lp.y + 12 * Y.proj.s);
        c.closePath();
        c.fill();
        projector(c, Y.proj, t);
      }

      c.restore();

      // --- one quiet line of survey type, off to the side of the hole above
      c.textAlign = 'left';
      c.font = MONO(Y.m ? 9 : 10, 600);
      c.fillStyle = rgba(BONE, 0.72);
      tracked(c, '44.0 M BELOW DATUM', Y.tag.x, Y.tag.y + dy, { track: 3 });
    },

    dispose() { L = null; geo = null; },
  };
}
