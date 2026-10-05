// WELL 03 — MEETUP — 21 m.
// A gathering stage. One enormous marigold slab carries the group's name, cut in
// letters taller than a person, and it slams down as you arrive. Below it a ring of seats
// is worn into the floor, so wide it runs off both edges of the frame. People have
// scratched marks into the slab's lower edge: anonymous, uncounted. Tap the slab to cut
// your own. Palette (3): night navy, marigold, bone.

import { MONO, DISPLAY, HE, rgba, tracked, rough, TAU } from './_shared.js';

// the inner edge of the frame's wall bands (the band plus its lit lip): text stays inside it
const wallIn = (g) => (g && g.wall ? g.wall + Math.max(4, Math.round(g.wall * 0.34)) : 0);

const NAVY = '#101B3B';
const GOLD = '#F2B705';
const BONE = '#F2EDE2';

const CHISEL = `<svg width="30" height="40" viewBox="0 0 30 40" fill="none" aria-hidden="true">
  <path d="M15 2 V24" stroke="${GOLD}" stroke-width="5" stroke-linecap="square"/>
  <path d="M15 24 L9 32 L15 38 L21 32 Z" fill="${GOLD}"/>
</svg>`;

// Each line is cut in two where the rope from the hole above passes down the slab.
const LINES_WIDE = [['THE SOUTHERN', 'GAME PROGRAMMING'], ['MEETUP', 'GROUP']];
const LINES_TALL = [['THE', 'SOUTHERN'], ['GAME', 'PROGRAMMING'], ['MEETUP', 'GROUP']];
const LINES_SHORT = [['MEETUP', 'GROUP']];

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

export default function make({ fx, audio }) {
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  let t0 = -1, cutAcc = 0, slammed = false;
  const DROP = 300;                  // ms from the room's first frame: down well before the link
  let lay = null;                    // cached slab layout (per viewport)
  const marks = [];                  // scratches, slab-local coords, no number attached
  let markSeedDone = false;

  const jitter = [];
  { const r = fx.rnd(5209); for (let i = 0; i < 600; i++) jitter.push(r()); }
  let jp = 0;
  const jr = () => jitter[(jp = (jp + 1) % jitter.length)];


  // the link's box on screen (measured; the frame places it): short screens fit around it
  let takeR = null, takeAt = -1e9;
  const takeBox = (t) => {
    if (t - takeAt > 400) {
      takeAt = t;
      const a = document.querySelector('.ch[data-well="meetup"] .ch-take');
      const r = a && a.getBoundingClientRect();
      const tx = a && a.querySelector('.ch-take__txt');
      const q = tx && tx.getBoundingClientRect();
      const art = a && a.querySelector('.ch-take__art');
      const ab = art && art.getBoundingClientRect();
      takeR = r && r.height ? {
        top: r.top, right: r.right, left: r.left,
        txt: q && q.height ? q.top : r.top,
        art: ab && ab.height ? { l: ab.left, r: ab.right, t: ab.top } : null,
      } : null;
    }
    return takeR;
  };

  // --- layout: fit the name to the slab, line by line -------------------------------
  // rx: the rope's x on screen (null: no rope), gap: half the clear lane around it
  const layout = (c, w, h, wall, rx, gap, hole, linkTop) => {
    const narrow = w < 900;
    // a short landscape phone keeps only the name on the slab; the descriptor moves to the
    // survey line above it
    const lines = h < 520 && w > h ? LINES_SHORT : narrow ? LINES_TALL : LINES_WIDE;
    const gut = (wall || 0) + (w < 640 ? 12 : 40);
    let maxH = h * (narrow ? 0.25 : 0.28);
    const short = h < 520;
    const pad = short ? 8 : Math.max(18, h * 0.035);
    const strip = short ? 0 : narrow ? h * 0.07 : h * 0.06;    // the scratched band under the name
    // the slab hangs below the hole you fell through: the top 20% stays open
    // (on a short screen, just under the hole) and its foot stays above the link
    const y0 = short && hole ? hole.y + hole.r + 10 : Math.max(54, h * 0.2);
    if (linkTop != null) maxH = Math.max(12, Math.min(maxH, linkTop - 12 - y0 - pad * 2 - strip));
    const sp = 0.32;                 // the word space, in em, when there is no rope
    c.font = DISPLAY(100);
    let sizes = lines.map(([a, b]) => {
      const wa = c.measureText(a).width / 100, wb = c.measureText(b).width / 100;
      if (rx == null) return Math.min(w - gut * 2, 1500) / (wa + wb + sp);
      return Math.min((rx - gap - gut) / wa, (w - gut - rx - gap) / wb);
    });
    const lead = 0.98;              // Anton caps are tall: keep the lines apart
    const total = sizes.reduce((a, s) => a + s * lead, 0);
    if (total > maxH) sizes = sizes.map((s) => s * maxH / total);
    const textH = sizes.reduce((a, s) => a + s * lead, 0);
    const slabH = pad * 2 + textH + strip;
    return {
      lines, sizes, lead, pad, strip, textH, rx, gap,
      x: -80, y: y0, sw: w + 160, sh: slabH,
      rot: -0.03, cx: w / 2, cy: y0 + slabH / 2,
    };
  };

  const seedMarks = () => {
    if (markSeedDone || !lay) return;
    markSeedDone = true;
    const r = fx.rnd(3301);
    // loose clusters, not tallies: nobody kept score
    for (let k = 0; k < 9; k++) {
      const cx = 0.05 + r() * 0.9;
      const n = 2 + ((r() * 6) | 0);
      for (let i = 0; i < n; i++) {
        marks.push({
          u: cx + (r() - 0.5) * 0.05,
          v: 0.18 + r() * 0.6,
          a: -1.2 + (r() - 0.5) * 0.9,
          l: 0.45 + r() * 0.5,
          born: -1e9,
        });
      }
    }
  };

  const cut = (u, v, now) => {
    if (marks.length > 220) marks.shift();
    marks.push({ u, v, a: -1.2 + (Math.random() - 0.5) * 0.9, l: 0.5 + Math.random() * 0.5, born: now });
    audio.noise({ dur: 0.16, gain: 0.08, band: [1400, 5200] });
    audio.noise({ dur: 0.09, gain: 0.05, band: [220, 900], delay: 0.05 });
  };

  // tap the slab to cut a mark where you touched it
  let lastT = 0;
  const onDown = (e) => {
    if (!lay || !geo) return;
    const dx = e.clientX - lay.cx, dy = e.clientY - (lay.cy + slabOffset());
    const cs = Math.cos(-lay.rot), sn = Math.sin(-lay.rot);
    const lx = dx * cs - dy * sn + lay.sw / 2;
    const ly = dx * sn + dy * cs + lay.sh / 2;
    if (lx < 0 || lx > lay.sw || ly < 0 || ly > lay.sh) return;
    const stripTop = lay.sh - lay.strip - lay.pad * 0.6;
    const v = Math.max(0.05, Math.min(0.95, (ly - stripTop) / lay.strip));
    cut(lx / lay.sw, v, lastT);
  };

  let tNow = 0;
  const slabOffset = () => {
    if (reduced) return 0;
    if (!lay || t0 < 0) return -2000;
    const p = Math.min(1, Math.max(0, (tNow - t0) / DROP));
    const e = p * p * p;                           // it falls, it does not ease in
    return -(lay.y + lay.sh + 60) * (1 - e);
  };

  return {
    frame: { vault: false, gauge: false, index: false, notes: false, title: false, air: false },
    pal: {
      ink: NAVY, stone: '#1A2650', stoneDark: '#080E22',
      key: GOLD, keyText: GOLD, cone: '#2A3A6E', dust: BONE, bone: BONE,
    },
    takeHz: 420,
    take: {
      verb: 'cut your mark',
      cta: 'JOIN ON MEETUP',
      label: 'cut your mark',
      host: 'meetup.com',
      art: CHISEL,
      pos: {
        // a short landscape phone sends the link to the bottom (the frame clamps it above
        // the exits), leaving the room above it for the hero
        get top() { return typeof innerHeight === 'number' && innerHeight < 500 && innerWidth > innerHeight ? '92%' : '70%'; },
        left: '50%',
      },
      variant: 'plate',
    },

    init(env) {
      geo = env.geo;
      L = env.layer(3);
      L.canvas.addEventListener('pointerdown', onDown);
      // the slab is fitted to Anton's widths: refit once the face is in
      if (document.fonts && document.fonts.load) document.fonts.load('100px Anton').then(() => { lay = null; }).catch(() => {});
    },



    resize() { lay = null; },

    update(dt, t) {
      if (!L) return;
      tNow = t; lastT = t;
      if (t0 < 0) t0 = t;
      const g = geo();
      const { w, h } = g;
      if (!(w >= 1 && h >= 1)) return;
      const c = L.ctx2d;
      jp = 0;
      // the rope runs down through the slab: find its lane (rotation slack included)
      const band = ropeBand(g, h * 0.2, h * 0.6);
      const rxN = band ? Math.round((band[0] + band[1]) / 2) : null;
      const gapN = band ? Math.round((band[1] - band[0]) / 2 + 10 + 0.03 * h * 0.2) : 0;
      const tb = takeBox(t);
      // a short screen: the slab may run down past the link's art (the rope's end) to the
      // top of its plate, which leaves the name room to be read
      const shortL = h < 520 && w > h;
      const lt = tb ? Math.round((shortL ? tb.txt : tb.top) / 6) * 6 : null;
      if (lay && (lay.rx !== rxN || lay.gap !== gapN || lay.w !== w || lay.lt !== lt)) lay = null;
      if (!lay) { lay = layout(c, w, h, wallIn(g), rxN, gapN, g.hole, lt); lay.w = w; lay.lt = lt; }
      seedMarks();

      // --- the ground: one flat colour, edge to edge
      c.fillStyle = NAVY;
      c.fillRect(0, 0, w, h);

      // --- the ring of seats, too wide for the frame
      // the ring sits around the link (take.pos top 70%) and stops above the exit row
      const rcY = h * 0.7;
      const rx = w * (w < 640 ? 0.44 : 0.36);
      const ry = Math.min(rx * (w < 640 ? 0.5 : 0.3), h * 0.12);
      c.lineWidth = Math.max(2, w * 0.002);
      c.strokeStyle = rgba(BONE, 0.38);
      c.beginPath(); c.ellipse(g.cx, rcY, rx, ry, 0, 0, TAU); c.stroke();
      c.strokeStyle = rgba(BONE, 0.14);
      c.beginPath(); c.ellipse(g.cx, rcY, rx * 0.72, ry * 0.72, 0, 0, TAU); c.stroke();
      const seats = 14;
      const order = [];
      for (let i = 0; i < seats; i++) {
        const a = (i / seats) * TAU + 0.11;
        order.push({ a, near: (Math.sin(a) + 1) / 2 });
      }
      order.sort((p, q) => p.near - q.near);      // back seats first
      for (const s of order) {
        const sx = g.cx + Math.cos(s.a) * rx;
        const sy = rcY + Math.sin(s.a) * ry;
        const sw = rx * (0.03 + s.near * 0.07);
        const sh = sw * (w < 640 ? 0.5 : 0.4);
        c.fillStyle = GOLD;
        c.beginPath(); c.ellipse(sx, sy, sw, sh, 0, 0, TAU); c.fill();
        // the worn top of each seat: a flat bone crescent
        c.fillStyle = rgba(BONE, 0.85);
        c.beginPath(); c.ellipse(sx, sy - sh * 0.28, sw * 0.7, sh * 0.42, 0, 0, TAU); c.fill();
        c.fillStyle = GOLD;
        c.beginPath(); c.ellipse(sx, sy - sh * 0.14, sw * 0.62, sh * 0.36, 0, 0, TAU); c.fill();
      }

      // --- a tiny survey label against the giant slab (scale contrast)
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.font = MONO(10, 500);
      c.fillStyle = rgba(BONE, 0.72);
      const ly = Math.max(22, lay.y - 22 - w * 0.015);   // clear of the tilted slab
      const lx = wallIn(g) + (w < 640 ? 12 : 22);   // inside the wall bands
      if (shortL) c.font = MONO(9, 600);
      const lw = tracked(c, shortL ? 'THE SOUTHERN GAME PROGRAMMING' : w < 640 ? 'WELL 03 ·' : 'WELL 03 · MEETUP ·', lx, ly, { track: shortL ? 1 : w < 640 ? 2 : 3 });
      c.font = HE(13, 700);
      c.fillStyle = GOLD;
      if (!shortL) c.fillText('מיטאפ', lx + lw + 10, ly + 1);
      c.font = MONO(10, 500);
      c.fillStyle = rgba(BONE, 0.72);
      tracked(c, w < 640 ? '21 M' : '21 M BELOW', w - lx, ly, { track: w < 640 ? 2 : 3, align: 'right' });

      // --- a mark is cut, now and then, by nobody you can see
      if (slammed && !reduced) {
        cutAcc += dt;
        if (cutAcc > 5600) {
          cutAcc = 0;
          cut(0.06 + Math.random() * 0.88, 0.15 + Math.random() * 0.7, t);
        }
      }

      // --- the slab
      const off = slabOffset();
      if (!slammed && (reduced || t - t0 >= DROP)) {
        slammed = true;
        if (!reduced) { audio.thud({ gain: 0.5 }); fx.shake(260, 9); }
      }
      if (off > -(lay.y + lay.sh + 59)) {
        c.save();
        c.translate(lay.cx, lay.cy + off);
        c.rotate(lay.rot);
        const X = -lay.sw / 2, Y = -lay.sh / 2;
        // drop shadow: a flat offset block, not a blur
        c.fillStyle = rgba('#000000', 0.32);
        c.fillRect(X + 14, Y + 18, lay.sw, lay.sh);
        c.fillStyle = GOLD;
        c.fillRect(X, Y, lay.sw, lay.sh);

        // the name, cut in navy, each line parted where the rope runs down the slab
        const cutX = lay.rx == null ? null : lay.rx - lay.cx;
        let by = Y + lay.pad;
        lay.lines.forEach(([a, b], i) => {
          const s = lay.sizes[i];
          by += s * (i === 0 ? 0.86 : lay.lead);
          c.font = DISPLAY(s);
          c.fillStyle = NAVY;
          if (cutX == null) {
            c.textAlign = 'center';
            c.fillText(a + ' ' + b, 0, by - s * 0.06);
          } else {
            c.textAlign = 'right';
            c.fillText(a, cutX - lay.gap, by - s * 0.06);
            c.textAlign = 'left';
            c.fillText(b, cutX + lay.gap, by - s * 0.06);
          }
        });

        // the rope's lane: where the link's art hangs into the slab, the slab parts for it
        if (cutX != null && tb && tb.art && tb.art.t < lay.y + lay.sh + off) {
          const lane = Math.max((tb.art.r - tb.art.l) / 2 + 4, lay.gap * 0.85);
          c.fillStyle = NAVY;
          c.fillRect(cutX - lane, Y - 2, lane * 2, lay.sh + 24);
        }

        // the scratch band: a chalked rule, then uncounted marks
        const sTop = Y + lay.sh - lay.strip - lay.pad * 0.6;
        c.strokeStyle = rgba(NAVY, 0.55);
        c.lineWidth = 1.5;
        rough(c, X + 90, sTop - 6, X + lay.sw - 90, sTop - 6, { jitter: 1.2, prng: jr });
        const len = lay.strip * 0.7;
        for (const m of marks) {
          const mx = X + m.u * lay.sw, my = sTop + m.v * lay.strip;
          const age = t - m.born;
          const fresh = age < 1100 && age >= 0;
          c.strokeStyle = fresh ? BONE : rgba(NAVY, 0.82);
          c.lineWidth = fresh ? 3.2 : 2.2;
          const L2 = len * m.l * 0.5;
          const dx = Math.cos(m.a) * L2, dy = Math.sin(m.a) * L2;
          rough(c, mx - dx, my - dy, mx + dx, my + dy, { jitter: 1.1, steps: 3, prng: jr });
        }
        c.restore();
      }
    },

    dispose() {
      if (L) L.canvas.removeEventListener('pointerdown', onDown);
      L = null; geo = null; marks.length = 0;
    },
  };
}
