// WELL 02 — DISCORD — 30 m.
// A resonant cave. The rock is one flat field of violet; out of it opens a mouth, and
// inside the mouth the cave repeats itself, arch inside arch, narrowing to a throat you
// cannot see the end of. That nest of arches is the resonance: rings of sound travelling
// inward, slowly. Somebody once said hello into it; the cave is still giving it back,
// one letter shorter each time. The name is cut into the rock over the mouth, split
// where the rope from the hole above passes through it: DIS | CORD.
//
// Palette, committed: cave void, violet rock, lilac.

import { DISPLAY, HE, MONO, rgba, tracked, mix } from './_shared.js';

// the inner edge of the frame's wall bands (the band plus its lit lip): text stays inside it
const wallIn = (g) => (g && g.wall ? g.wall + Math.max(4, Math.round(g.wall * 0.34)) : 0);

const VOID = '#0E0A24';
const ROCK = '#5B3DF5';
const LILAC = '#E8E1FF';

const ECHO = ['HELLO', 'ELLO', 'LLO', 'LO', 'O'];

const MOUTH_ART = `<svg width="70" height="58" viewBox="0 0 70 58" fill="none" aria-hidden="true">
  <path d="M6 56 V30 A29 27 0 0 1 64 30 V56" stroke="${LILAC}" stroke-width="5"/>
  <path d="M20 56 V34 A15 14 0 0 1 50 34 V56" stroke="${ROCK}" stroke-width="5"/>
</svg>`;

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
  let L = null, geo = null, live = false, toneAcc = 0;
  let mouth = null, mouthKey = '';
  // the link's top on screen (measured; the frame places it): the echoes stop above it
  let linkTop = null, takeAt = -1e9, artBox = null;
  const takeTop = (t) => {
    if (t - takeAt > 400) {
      takeAt = t;
      const a = document.querySelector('.ch[data-well="discord"] .ch-take');
      const r = a && a.getBoundingClientRect();
      linkTop = r && r.height ? r.top : null;
      const art = a && a.querySelector('.ch-take__art');
      const q = art && art.getBoundingClientRect();
      artBox = q && q.height ? { l: q.left, r: q.right, t: q.top } : null;
    }
    return linkTop;
  };

  // The mouth outline, in absolute px: a rough-cut arch on a flat floor. Seeded, so it is
  // the same cave every visit; rebuilt only when the viewport changes.
  function buildMouth(g) {
    const key = g.w + 'x' + g.h;
    if (key === mouthKey) return mouth;
    mouthKey = key;
    const r = fx.rnd(3307);
    const mob = g.w < 700;
    const cx = g.w / 2;
    const hw = g.w * (mob ? 0.45 : 0.33);
    // the crown sits low enough that the name fits under the hole you fell through
    const top = g.h * (mob ? 0.34 : 0.4);
    const floor = g.h * 0.96;
    const spring = mix(top, floor, mob ? 0.42 : 0.5);   // where the walls go vertical
    const pts = [];
    pts.push([cx - hw * 1.02, floor]);
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI + (i / N) * Math.PI;         // left wall, over the crown, right wall
      const j = i === 0 || i === N ? 0 : (r() - 0.5) * hw * 0.07;
      const x = cx + Math.cos(a) * (hw + j);
      const y = spring + Math.sin(a) * (spring - top + j * 0.6);
      pts.push([x, y]);
    }
    pts.push([cx + hw * 1.02, floor]);
    // the throat: arches shrink toward a point low in the mouth
    const vp = [cx, mix(top, floor, 0.66)];
    mouth = { pts, cx, hw, top, floor, spring, vp, mob };
    return mouth;
  }

  function mouthPath(c, m, s, dy) {
    c.beginPath();
    m.pts.forEach(([x, y], i) => {
      const X = m.vp[0] + (x - m.vp[0]) * s;
      const Y = m.vp[1] + (y - m.vp[1]) * s + dy;
      i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    });
    c.closePath();
  }

  return {
    // the cave replaces the vault, the title, the depth readout, the index and the notes
    // and the flat wall bands: everything here is rock, edge to edge
    frame: { vault: false, gauge: false, notes: false, index: false, title: false, air: false, walls: false },
    pal: {
      ink: VOID, stone: ROCK, stoneDark: VOID,
      key: ROCK, keyText: LILAC, cone: ROCK, bone: LILAC, dust: LILAC,
    },
    takeHz: 220,
    take: {
      verb: 'SPEAK INTO THE CAVE',
      cta: 'JOIN ON DISCORD',
      label: 'speak into the cave',
      host: 'discord.gg',
      art: MOUTH_ART,
      pos: {
        // a short landscape phone sends the link to the bottom (the frame clamps it above
        // the exits), leaving the room above it for the hero
        get top() { return typeof innerHeight === 'number' && innerHeight < 500 && innerWidth > innerHeight ? '92%' : '80%'; },
        left: '50%',
      },
      variant: 'hang',
    },
    ui: `<span style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">Discord · דיסקורד · the voice channel · 30 m</span>`,

    init(env) { geo = env.geo; L = env.layer(3); },

    onLanded() {
      live = true;
      // the cave answers the landing: one low call, then its echoes
      audio.tone(110, { dur: 1.2, type: 'triangle', gain: 0.08, slideTo: 146 });
      for (let i = 1; i <= 3; i++) {
        audio.tone(146, { dur: 0.9, type: 'sine', gain: 0.05 / i, delay: 0.5 * i });
      }
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      const { w, h } = g;
      if (!(w >= 1 && h >= 1)) return;
      const m = buildMouth(g);
      const e = fx.ease.outCubic(Math.min(1, g.fallP));
      const dy = (1 - e) * h * 0.9;                    // the cave rises into view as you fall

      // --- the rock: everything is rock
      c.fillStyle = ROCK;
      c.fillRect(0, 0, w, h);

      // --- the name cut into the rock above the mouth
      c.textBaseline = 'alphabetic';
      const nameY = m.top - (m.mob ? h * 0.035 : h * 0.03);
      const inL = wallIn(g) + (m.mob ? 12 : 18);   // inside the frame's wall bands
      const inR = w - inL;
      // the cap line stays under the top fifth (on a short screen: just under the hole)
      const sky = h < 520 && g.hole ? g.hole.y + g.hole.r + 6 : h * 0.2;
      let fs = Math.min((m.top - h * 0.04) * 0.9, (nameY - sky) / 0.84);
      c.font = DISPLAY(fs);
      const nw = c.measureText('DISCORD').width;
      const maxW = Math.min(w * (m.mob ? 0.84 : 0.62), inR - inL);
      if (nw > maxW) { fs *= maxW / nw; c.font = DISPLAY(fs); }
      // the rope passes through the name: cut it there, DIS | CORD
      let band = ropeBand(g, nameY - fs * 0.9, nameY + 4);
      // on a short screen the link's art hangs up into the name: part the name around it too
      takeTop(t);
      if (artBox && artBox.t < nameY + 4) {
        band = band ? [Math.min(band[0], artBox.l - 2), Math.max(band[1], artBox.r + 2)] : [artBox.l - 2, artBox.r + 2];
      }
      const nameBase = nameY + dy;
      c.fillStyle = VOID;
      if (band) {
        const gap = Math.max(6, fs * 0.05);
        c.font = DISPLAY(100);
        const wa = c.measureText('DIS').width / 100, wb = c.measureText('CORD').width / 100;
        fs = Math.min(fs, (band[0] - gap - inL) / wa, (inR - band[1] - gap) / wb);
        c.font = DISPLAY(fs);
        c.textAlign = 'right';
        c.fillText('DIS', band[0] - gap, nameBase);
        c.textAlign = 'left';
        c.fillText('CORD', band[1] + gap, nameBase);
      } else {
        c.textAlign = 'center';
        c.fillText('DISCORD', m.cx, nameBase);
      }

      // small, against the giant name: Hebrew and the survey line, flanking the crown,
      // each kept to its own side of the rope
      const lab = m.mob ? 10 : 12;
      c.font = HE(m.mob ? 18 : 30, 800);
      c.textAlign = 'left';
      const hx = m.mob ? inL : Math.max(w * 0.045, inL);
      const hy = m.mob ? nameBase + 34 : m.spring + dy;
      c.fillText('דיסקורד', hx, hy);
      c.font = MONO(lab, 600);
      if (m.mob) {
        // two short lines right of the rope
        const lb = ropeBand(g, nameY + 10, nameY + 50);
        const room = inR - (lb ? lb[1] + 6 : w / 2);
        const tr = room < 150 ? 0.6 : 1.4;
        c.font = MONO(room < 150 ? 9 : lab, 600);
        // tucked close under the name: the crown of the mouth is right below
        tracked(c, '30 M', inR, nameBase + 15, { track: tr, align: 'right' });
        tracked(c, 'THE VOICE CHANNEL', inR, nameBase + 28, { track: tr, align: 'right' });
      } else {
        // two short lines, so the label stays on the rock clear of the mouth
        c.font = DISPLAY(30);
        c.textAlign = 'right';
        const rx = Math.min(w * 0.955, inR);
        c.fillText('30 M', rx, m.spring + dy - 30);
        c.font = MONO(lab, 600);
        c.textAlign = 'left';                            // tracked() places each glyph itself
        tracked(c, 'THE VOICE CHANNEL', rx, m.spring + dy, { track: 2.4, align: 'right' });
      }

      // --- the mouth, and the cave repeating itself inside it
      c.fillStyle = VOID;
      mouthPath(c, m, 1, dy);
      c.fill();

      c.save();
      mouthPath(c, m, 1, dy);
      c.clip();
      const R = 0.8;                                    // each arch is 80% of the last
      const u = reduced ? 0.35 : t / 5200;              // sound travelling inward
      const ph = u - Math.floor(u);
      const n = Math.floor(u);
      for (let k = 1; k <= 13; k++) {
        const s = Math.pow(R, k - ph);
        if (s < 0.04) break;
        const lit = ((k - n) % 2 + 2) % 2 === 0;
        c.fillStyle = lit ? rgba(ROCK, 0.62 * Math.pow(s, 0.9)) : VOID;
        mouthPath(c, m, s, dy);
        c.fill();
      }
      // the throat: past the last arch it is just dark
      c.restore();

      // --- the echo, one letter shorter each time it comes back
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      // stacked down the throat, each echo smaller and fainter than the last
      let size = m.hw * (m.mob ? 0.4 : 0.3);
      let y = m.top + (m.spring - m.top) * (m.mob ? 0.42 : 0.36) + dy;
      const lt = takeTop(t);
      // a short screen: the first echo shrinks to clear the link, and the rest stop above it
      if (lt != null && h < 520) size = Math.max(14, Math.min(size, (lt - 6 - (y - dy)) / 0.45));
      for (let i = 0; i < ECHO.length; i++) {
        // the echoes die away above the link, never behind it
        const stop = artBox ? Math.max(lt, artBox.t) : lt;
        if (lt != null && y - dy + size * 0.45 > stop - 4) break;
        c.font = DISPLAY(size);
        c.fillStyle = rgba(LILAC, [0.95, 0.55, 0.34, 0.2, 0.12][i]);
        c.fillText(ECHO[i], m.cx, y);
        const next = size * 0.56;
        y += size * 0.42 + next * 0.42 + size * 0.06;
        size = next;
      }

      // --- the floor line at the lip of the mouth
      c.strokeStyle = rgba(LILAC, 0.5);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(m.cx - m.hw * 1.02, m.floor + dy);
      c.lineTo(m.cx + m.hw * 1.02, m.floor + dy);
      c.stroke();

      // --- the room answers, now and then (sound only, never motion)
      if (live) {
        toneAcc += dt;
        if (toneAcc > 7000) {
          toneAcc = 0;
          audio.tone(98, { dur: 0.7, type: 'sine', gain: 0.04 });
          audio.tone(98, { dur: 0.7, type: 'sine', gain: 0.02, delay: 0.6 });
        }
      }
    },

    resize() { mouthKey = ''; },

    dispose() { L = null; geo = null; mouth = null; },
  };
}
