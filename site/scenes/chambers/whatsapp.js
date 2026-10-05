// WELL 01 — WHATSAPP — 12 m.
// The shallowest well, so close to the surface that the talk up there pours straight in.
// The room is one enormous speech bubble: its tail runs up and out of the frame, back to
// the field the voices come from. The name is what it says. Above and below the name a
// faint band of chatter slides past as broken word-shards (sounds, not messages: nobody
// here is quoted, nothing is dated). A few small shards fall out of the bubble and drift
// down the shaft's edges, fading before they reach the link.
//
// Palette, committed: bottle green ground, chartreuse bubble, bone.

import { DISPLAY, HE, MONO, rgba, tracked, TAU } from './_shared.js';

// the inner edge of the frame's wall bands (the band plus its lit lip): text stays inside it
const wallIn = (g) => (g && g.wall ? g.wall + Math.max(4, Math.round(g.wall * 0.34)) : 0);

const GROUND = '#0B3326';
const BUBBLE = '#D4F25A';
const BONE = '#F2EDE2';

// Fragments of talk, deliberately not sentences: syllables, interjections, half-words.
const SHARDS = [
  'HAHA', 'WAIT—', 'OK OK', 'MM-HM', '??', 'YALLA', 'SO…', 'NO WAY', 'HM', '!!',
  'WHO—', '…AND', 'OOH', 'BRB', 'YES', 'HEH', 'LOL', '…', 'WHAT', 'NICE',
];
const SHARDS_HE = ['יאללה', 'חחח', 'רגע', 'נו?', 'אה', 'מי', 'סבבה', 'וואו', 'כן כן'];

// the hand-pull at the end of the cord; the frame hangs the link text under it
const RING = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <circle cx="32" cy="34" r="20" stroke="${BUBBLE}" stroke-width="7"/>
  <rect x="28" y="0" width="8" height="15" fill="${BUBBLE}"/>
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
  const prng = fx.rnd(1201);
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null, live = false, t0 = -1, tNow = 0, ownCord = true;
  const RISE = 280;                              // ms from the room's first frame
  let rows = [], rowsKey = '';
  const fall = [];
  let spawn = 600, dripAcc = 0, measure = 0, artTop = null, takeTop = null;

  // the bubble, in viewport terms; recomputed per frame (cheap) from the frame's ruler
  function shape(g, t) {
    const { w, h } = g;
    const mob = w < 700;
    // the bubble rises into place in the first beat, on the room's own clock
    const q = reduced || t0 < 0 ? 1 : Math.min(1, Math.max(0, (tNow - t0) / RISE));
    const rise = (1 - fx.ease.outCubic(q)) * h * 0.7;
    const br = reduced ? 1 : 1 + Math.sin(t / 820) * 0.006;
    const cx = w * 0.5;
    // between the hole you fell through and the link: the bubble's top stays under the
    // top fifth, its chin above the link's top (short screens shrink it to fit)
    const hb = g.hole ? g.hole.y + g.hole.r + 10 : 0;
    const lo = Math.max(h * 0.2, hb);
    const hiY = (takeTop != null ? takeTop : h * 0.8 - 100) - Math.max(12, h * 0.025);
    let ry = h * (mob ? 0.19 : 0.235);
    ry = Math.max(8, Math.min(ry, (hiY - lo) / 2));
    let cy = h * (mob ? 0.42 : 0.45);
    cy = Math.max(lo + ry, Math.min(cy, hiY - ry));
    cy += rise;
    ry *= br;
    const rx = Math.min(w * (mob ? 0.62 : 0.46), Math.max(ry * 2.2, w * 0.4)) * br;
    const takeY = h * (mob ? 0.73 : 0.775);
    return { mob, cx, cy, rx, ry, rise, takeY };
  }

  function bubblePath(c, s, g) {
    c.beginPath();
    c.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, TAU);
    // the tail: a wedge from the upper right of the bubble up and out of the frame
    const a1 = -1.15, a2 = -0.62;
    c.moveTo(s.cx + Math.cos(a1) * s.rx * 0.96, s.cy + Math.sin(a1) * s.ry * 0.96);
    c.lineTo(s.cx + s.rx * (s.mob ? 0.62 : 0.86), -g.h * 0.12 + s.rise);
    c.lineTo(s.cx + Math.cos(a2) * s.rx * 0.96, s.cy + Math.sin(a2) * s.ry * 0.96);
    c.closePath();
  }

  // rows of shards that scroll behind the name, each row a long strip we wrap
  function buildRows(c, s) {
    const key = Math.round(s.rx) + 'x' + Math.round(s.ry);
    if (key === rowsKey) return;
    rowsKey = key;
    const r = fx.rnd(77);
    rows = [];
    // two thin bands, one over the name and one under it, never through it
    const n = 2;
    for (let i = 0; i < n; i++) {
      const size = s.ry * 0.17;
      const he = i === 1;
      const pool = he ? SHARDS_HE : SHARDS;
      c.font = he ? HE(size, 500) : MONO(size, 500);
      const items = [];
      let width = 0;
      const gap = size * 0.7;
      while (width < s.rx * 4.2) {
        const text = pool[(r() * pool.length) | 0];
        if (items.length && items[items.length - 1].text === text) continue;
        const tw = c.measureText(text).width;
        items.push({ text, x: width });
        width += tw + gap;
      }
      rows.push({
        items, width, size, he,
        y: i ? 0.78 : -0.76,                         // as a fraction of ry from centre
        v: (i % 2 ? -1 : 1) * (0.018 + r() * 0.02),  // px per ms
        off: r() * width,
      });
    }
  }

  function pushFall(g, s) {
    const mob = s.mob;
    const side = prng() < 0.5;
    const he = prng() < 0.3;
    const pool = he ? SHARDS_HE : SHARDS;
    // the outer lanes only: well away from the link column
    fall.push({
      text: pool[(prng() * pool.length) | 0], he,
      x: side ? g.w * (0.1 + prng() * 0.1) : g.w * (0.8 + prng() * 0.1),
      y: s.cy + s.ry * (0.55 + prng() * 0.2),
      v: 0.022 + prng() * 0.02,
      size: mob ? 13 + prng() * 4 : 17 + prng() * 7,
      rot: (prng() - 0.5) * 0.3,
      life: 0,
    });
  }

  return {
    // frame pieces this room replaces with its own: the bubble is the vault, the title
    // and the depth; the shaft index and wall notes are not needed here.
    frame: { vault: false, gauge: false, notes: false, index: false, title: false, air: false },
    pal: {
      ink: GROUND, stone: GROUND, stoneDark: GROUND,
      key: BUBBLE, keyText: BUBBLE, cone: BUBBLE, bone: BONE, dust: BUBBLE,
    },
    takeHz: 700,
    take: {
      verb: 'SAY SOMETHING',
      cta: 'JOIN ON WHATSAPP',
      label: 'say something',
      host: 'chat.whatsapp.com',
      art: RING,
      pos: { left: '50%', top: '80%' },
      variant: 'hang',
    },
    // the bubble draws the name; this keeps it in the document for readers and search
    ui: `<span style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">WhatsApp · וואטסאפ · the daily chatter · 12 m</span>`,

    init(env) {
      geo = env.geo; L = env.layer(3);
      // when the frame hangs its own rope from the hole above, the bubble's cord steps aside
      ownCord = !(env.frame && env.frame.mouth);
    },

    onLanded() {
      live = true;
      if (reduced) {
        // a still frame: a few shards caught mid-fall
        const g = geo(); const s = shape(g, 0);
        for (let i = 0; i < 4; i++) {
          pushFall(g, s);
          const f = fall[fall.length - 1];
          f.x = g.w * [0.13, 0.86, 0.16, 0.83][i];
          f.y = s.cy + s.ry + g.h * [0.03, 0.05, 0.1, 0.12][i];
          f.life = 1;
        }
      }
      audio.tone(520, { dur: 0.12, type: 'triangle', gain: 0.05 });
      audio.tone(660, { dur: 0.12, type: 'triangle', gain: 0.05, delay: 0.14 });
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const { w, h } = g;
      if (!(w >= 1 && h >= 1)) return;
      tNow = t;
      if (t0 < 0) t0 = t;
      const c = L.ctx2d;
      // where the link starts (its art, and its block): the bubble and the shards stay above
      measure -= dt;
      if (measure <= 0 || artTop == null) {
        measure = 400;
        const a = document.querySelector('.ch[data-well="whatsapp"] .ch-take');
        const ra = a && a.getBoundingClientRect();
        takeTop = ra && ra.height ? ra.top : null;
        const art = a && a.querySelector('.ch-take__art');
        const r = art && art.getBoundingClientRect();
        artTop = r && r.height ? r.top : takeTop;
      }
      const T = reduced ? 0 : t;
      const s = shape(g, T);

      c.fillStyle = GROUND;
      c.fillRect(0, 0, w, h);

      // --- shards that fell out of the bubble, drifting down the shaft (behind it)
      if (live && !reduced) {
        spawn -= dt;
        if (spawn <= 0 && fall.length < (s.mob ? 4 : 7)) { pushFall(g, s); spawn = 900 + prng() * 1300; }
        dripAcc += dt;
        if (dripAcc > 6400) { dripAcc = 0; audio.drip({ pitch: 1.1 + prng() * 0.5 }); }
      }
      // --- where the link starts: the shards are gone before they reach it
      const chin = s.cy + s.ry;
      const end = artTop != null ? artTop + 2 : h * 0.8 - (s.mob ? 92 : 104);
      const fallSpan = Math.max(40, end - 24 - (s.cy + s.ry * 0.55));

      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let i = fall.length - 1; i >= 0; i--) {
        const f = fall[i];
        if (!reduced) { f.y += f.v * dt; f.life = Math.min(1, f.life + dt / 700); }
        const p = (f.y - (s.cy + s.ry * 0.55)) / fallSpan;
        if (p > 1) { fall.splice(i, 1); continue; }
        const a = Math.max(0, Math.min(f.life, 1 - Math.max(0, p - 0.5) / 0.5));
        c.save();
        c.translate(f.x, f.y);
        c.rotate(f.rot);
        c.font = f.he ? HE(f.size, 400) : MONO(f.size, 400);
        c.fillStyle = rgba(BONE, 0.42 * a);
        c.fillText(f.text, 0, 0);
        c.restore();
      }

      // --- the cord: from the bubble's chin down to the ring on the link
      if (ownCord && end > chin) {
        const sway = reduced ? 0 : Math.sin(t / 1300) * 5;
        c.strokeStyle = BUBBLE;
        c.lineWidth = s.mob ? 6 : 8;
        c.lineCap = 'butt';
        c.beginPath();
        c.moveTo(s.cx, chin - 4);
        c.quadraticCurveTo(s.cx + sway, (chin + end) / 2, s.cx, end);
        c.stroke();
      }

      // --- the bubble
      c.fillStyle = BUBBLE;
      bubblePath(c, s, g);
      c.fill();

      // --- inside: chatter strips sliding past, then the name over them
      c.save();
      c.beginPath();
      c.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, TAU);
      c.clip();
      buildRows(c, s);
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      for (const r of rows) {
        r.off = reduced ? r.off : (r.off + r.v * dt + r.width) % r.width;
        c.font = r.he ? HE(r.size, 500) : MONO(r.size, 500);
        c.fillStyle = rgba(GROUND, 0.13);
        const y = s.cy + r.y * s.ry;
        const x0 = s.cx - s.rx - r.off;
        for (let k = 0; k < 2; k++) {
          for (const it of r.items) {
            const x = x0 + it.x + k * r.width;
            if (x > s.cx + s.rx || x < s.cx - s.rx - r.size * 4) continue;
            c.fillText(it.text, x, y);
          }
        }
      }
      c.restore();

      // the name: as wide as the bubble allows, inside the walls, parted where the rope
      // from the hole above runs through the bubble (WHATS | APP)
      c.textBaseline = 'alphabetic';
      c.fillStyle = GROUND;
      const inL = Math.max(s.cx - s.rx * 0.81, wallIn(g) + 10);
      const inR = Math.min(s.cx + s.rx * 0.81, w - wallIn(g) - 10);
      c.font = DISPLAY(100);
      const em = c.measureText('WHATSAPP').width / 100;
      let fs = Math.min(s.ry * 0.78, (inR - inL) / em, w * (s.mob ? 0.9 : 0.74) / em);
      const sy = s.cy - s.rise;                     // the band, at rest
      const band = ropeBand(g, sy - s.ry, sy + s.ry);
      const tiny = w < 360 || s.ry < 70;
      let base, gL = s.cx, gR = s.cx;
      if (band) {
        const gap = Math.max(5, fs * 0.04);
        const wa = c.measureText('WHATS').width / 100, wb = c.measureText('APP').width / 100;
        fs = Math.min(fs, (band[0] - gap - inL) / wa, (inR - band[1] - gap) / wb);
        gL = band[0] - gap; gR = band[1] + gap;
        base = s.cy + fs * 0.3;
        c.font = DISPLAY(fs);
        c.textAlign = 'right';
        c.fillText('WHATS', gL, base);
        c.textAlign = 'left';
        c.fillText('APP', gR, base);
      } else {
        base = s.cy + fs * 0.3;
        c.font = DISPLAY(fs);
        c.textAlign = 'center';
        c.fillText('WHATSAPP', s.cx, base);
      }

      // Hebrew under APP, the survey line over the name: each on its own side of the rope
      c.font = HE(Math.max(tiny ? 12 : 16, fs * 0.24), 800);
      c.textAlign = band ? 'left' : 'center';
      c.fillText('וואטסאפ', band ? gR : s.cx, base + Math.max(18, fs * 0.34));
      c.font = MONO(tiny ? 9 : s.mob ? 10 : 12, 600);
      const tr = tiny ? 1 : s.mob ? 1.6 : 2.6;
      const ly = s.cy - fs * 0.62 - 4;
      if (band) {
        tracked(c, 'WELL 01 · 12 M', gL, ly, { track: tr, align: 'right' });
        tracked(c, 'THE DAILY CHATTER', gR, ly, { track: tr, align: 'left' });
      } else {
        tracked(c, 'WELL 01  ·  12 M  ·  THE DAILY CHATTER', s.cx, ly, { track: tr, align: 'center' });
      }
    },

    dispose() { fall.length = 0; rows = []; L = null; geo = null; },
  };
}
