// WELL 06 — FACEBOOK — 70 m. The oldest well, and the deepest.
// Almost no light gets this far down, so you work by lamp: the light follows your pointer
// and only what it touches exists. The wall is cut in strata — the community, layer under
// layer — and the sigil at the bottom is half buried. Palette: black ground, rust, bone.

import { MONO, DISPLAY, rgba, tracked, rough, speckle, blend } from './_shared.js';

const SIGIL = `<svg width="120" height="128" viewBox="0 0 120 128" fill="none" aria-hidden="true">
  <circle cx="60" cy="58" r="36" stroke="var(--key)" stroke-width="2.2" opacity=".9"/>
  <circle cx="60" cy="58" r="22" stroke="var(--key)" stroke-width="1.2" opacity=".5"/>
  <path d="M60 22 L60 94 M24 58 L96 58" stroke="var(--key)" stroke-width="1.2" opacity=".45"/>
  <circle cx="60" cy="58" r="6" fill="var(--key)"/>
  <path d="M8 104 q28 -10 52 -8 q24 2 52 10 L112 128 L8 128 Z" fill="#F2EDE2" opacity=".12"/>
  <path d="M8 104 q28 -10 52 -8 q24 2 52 10" stroke="#F2EDE2" stroke-width="1.2" opacity=".3"/>
  <path d="M34 40 l-12 -14 M86 40 l12 -14" stroke="var(--key)" stroke-width="1.2" opacity=".35"/>
</svg>`;

const STRATA = [
  { n: 'I',   note: 'surface spoil · recent' },
  { n: 'II',  note: 'posts, re-shared' },
  { n: 'III', note: 'event notices, expired' },
  { n: 'IV',  note: 'the first group photo' },
  { n: 'V',   note: 'an older community, same city' },
  { n: 'VI',  note: 'undated' },
];

export default function make({ ctx, fx, audio }) {
  const prng = fx.rnd(2411);
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null, host = null;
  let lamp = { x: 0.5, y: 0.56, tx: 0.5, ty: 0.56, has: false };
  let dripAcc = 0, live = false;
  let onMove = null;

  const motes = [];
  for (let i = 0; i < 90; i++) {
    motes.push({ x: prng(), y: prng(), v: 0.00004 + prng() * 0.00012, s: 0.6 + prng() * 1.8, ph: prng() * 7 });
  }
  // marks buried in the strata — only the lamp finds them
  const marks = [];
  for (let i = 0; i < 26; i++) {
    marks.push({ x: prng(), y: prng(), k: (prng() * 4) | 0, r: prng() * 6 });
  }

  return {
    pal: {
      ink: '#070608', stone: '#241A16', stoneDark: '#050405',
      key: '#B8341F', cone: '#8C7A72', dust: '#A89384',
    },
    takeHz: 150,
    take: {
      label: 'brush the sigil',
      host: 'facebook.com',
      art: SIGIL,
      pos: { left: '50%', top: '73%' },
    },
    ui: `
      <div class="nt" style="left:26px;bottom:120px">
        <b>lamp · handheld</b>
        insolation 5%. carry it with you<br>
        <em>six strata logged</em>
      </div>`,

    init(env) {
      geo = env.geo; host = env.host;
      L = env.layer(3);
      onMove = (e) => {
        lamp.tx = e.clientX / window.innerWidth;
        lamp.ty = e.clientY / window.innerHeight;
        lamp.has = true;
      };
      window.addEventListener('pointermove', onMove, { passive: true });
    },

    onLanded() {
      live = true;
      audio.noise({ dur: 1.2, gain: 0.05, band: [40, 300] });
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      c.clearRect(0, 0, g.w, g.h);

      // the lamp drifts on its own until you take hold of it
      if (!lamp.has || reduced) {
        lamp.tx = 0.5 + Math.sin(t / 5200) * 0.17;
        lamp.ty = 0.55 + Math.sin(t / 3900 + 1.4) * 0.09;
      }
      const k = reduced ? 1 : 0.07;
      lamp.x += (lamp.tx - lamp.x) * k;
      lamp.y += (lamp.ty - lamp.y) * k;
      const lx = lamp.x * g.w, ly = lamp.y * g.h;
      const R = Math.min(g.w, g.h) * 0.3;

      // --- strata: the wall, cut in layers. Drawn, then revealed by the lamp.
      const top = g.mouthY + 12, bot = g.floorY;
      const band = (bot - top) / STRATA.length;
      c.save();
      c.beginPath(); c.rect(g.left, top, g.right - g.left, bot - top); c.clip();

      for (let i = 0; i < STRATA.length; i++) {
        const y = top + i * band;
        const tone = blend('#241A16', '#000000', 0.12 + i * 0.13);
        c.fillStyle = tone;
        c.fillRect(g.left, y, g.right - g.left, band);
        c.fillStyle = rgba(i % 2 ? '#B8341F' : '#A89384', 0.05);
        c.fillRect(g.left, y, g.right - g.left, band * 0.45);
        speckle(c, g.left, y, g.right - g.left, band,
          { n: Math.round((g.right - g.left) * band / 900), prng: fx.rnd(900 + i * 71), a: 0.35, size: 2.6 });
        c.strokeStyle = rgba('#000000', 0.7);
        c.lineWidth = 2;
        rough(c, g.left, y, g.right, y + (prng() - 0.5) * 6, { jitter: 3.2, prng: fx.rnd(31 + i) });
        c.strokeStyle = rgba('#A89384', 0.14);
        c.lineWidth = 1;
        rough(c, g.left, y + 2.5, g.right, y + 2.5, { jitter: 2.6, prng: fx.rnd(77 + i) });
      }

      // buried marks: older hands, same city
      for (const m of marks) {
        const mx = g.left + m.x * (g.right - g.left);
        const my = top + m.y * (bot - top);
        const d = Math.hypot(mx - lx, my - ly);
        if (d > R) continue;
        const a = Math.pow(1 - d / R, 1.6) * 0.75;
        c.strokeStyle = rgba(m.k === 0 ? '#B8341F' : '#D8C8BC', a);
        c.lineWidth = 1.4;
        if (m.k === 0) {                       // a scratched well-ring
          c.beginPath(); c.arc(mx, my, 9 + m.r, 0, Math.PI * 2); c.stroke();
          c.beginPath(); c.arc(mx, my, 3, 0, Math.PI * 2); c.stroke();
        } else if (m.k === 1) {                // a tally
          for (let j = 0; j < 4; j++) rough(c, mx + j * 6, my, mx + j * 6, my + 16, { jitter: 1, steps: 2, prng });
        } else if (m.k === 2) {                // an arrow, pointing down
          rough(c, mx, my - 10, mx, my + 12, { jitter: 1, steps: 3, prng });
          rough(c, mx - 6, my + 4, mx, my + 12, { jitter: 1, steps: 2, prng });
          rough(c, mx + 6, my + 4, mx, my + 12, { jitter: 1, steps: 2, prng });
        } else {                               // seven dots
          for (let j = 0; j < 7; j++) {
            c.fillStyle = rgba('#D8C8BC', a * 0.9);
            c.fillRect(mx + (j % 4) * 7, my + ((j / 4) | 0) * 7, 2.4, 2.4);
          }
        }
      }
      c.restore();

      // --- stratum labels, logged down the left of the cut
      c.textAlign = 'left';
      for (let i = 0; i < STRATA.length; i++) {
        const y = top + i * band;
        const d = Math.abs((top + i * band + band / 2) - ly);
        const near = Math.max(0, 1 - d / (R * 0.9));
        c.font = MONO(9, 500);
        c.fillStyle = rgba('#B8341F', 0.3 + near * 0.6);
        tracked(c, 'STRATUM ' + STRATA[i].n, g.left + 26, y + 20, { track: 2.4 });
        c.font = MONO(8.5, 400);
        c.fillStyle = rgba('#D8C8BC', 0.14 + near * 0.6);
        tracked(c, STRATA[i].note.toUpperCase(), g.left + 26, y + 36, { track: 1.8 });
        c.font = MONO(8, 400);
        c.fillStyle = rgba('#D8C8BC', 0.12 + near * 0.35);
        tracked(c, (56 + i * 2.4).toFixed(1) + ' M', g.right - 26, y + 20, { track: 1.8, align: 'right' });
      }

      // --- the dark. Everything above is masked out except where the lamp is.
      c.globalCompositeOperation = 'source-atop';
      const dk = c.createRadialGradient(lx, ly, R * 0.1, lx, ly, R);
      dk.addColorStop(0, 'rgba(0,0,0,0)');
      dk.addColorStop(0.55, 'rgba(0,0,0,.55)');
      dk.addColorStop(1, 'rgba(0,0,0,.93)');
      c.fillStyle = dk;
      c.fillRect(0, 0, g.w, g.h);
      c.globalCompositeOperation = 'source-over';

      // --- the lamp itself
      c.globalCompositeOperation = 'lighter';
      const lg = c.createRadialGradient(lx, ly, 2, lx, ly, R * 0.85);
      lg.addColorStop(0, rgba('#E8B88A', 0.16));
      lg.addColorStop(0.4, rgba('#B8341F', 0.05));
      lg.addColorStop(1, rgba('#B8341F', 0));
      c.fillStyle = lg;
      c.fillRect(0, 0, g.w, g.h);

      // --- dust, heavy and slow. This deep it never settles.
      for (const m of motes) {
        m.y += m.v * dt * (reduced ? 0 : 1);
        if (m.y > 1) { m.y = 0; m.x = prng(); }
        const mx = m.x * g.w, my = m.y * g.h;
        const d = Math.hypot(mx - lx, my - ly);
        if (d > R) continue;
        c.fillStyle = rgba('#E8D6C4', Math.pow(1 - d / R, 2) * 0.5);
        c.fillRect(mx + Math.sin(t / 2600 + m.ph) * 7, my, m.s, m.s);
      }
      c.globalCompositeOperation = 'source-over';

      // --- the depth, stated plainly, where the lamp cannot reach
      c.textAlign = 'center';
      c.font = DISPLAY(Math.min(150, g.w * 0.1));
      c.fillStyle = rgba('#B8341F', 0.055);
      c.fillText('70', g.cx, g.mouthY + 150);
      c.font = MONO(9, 500);
      c.fillStyle = rgba('#D8C8BC', 0.2);
      tracked(c, 'OLDEST WELL · BOTTOM OF THE INDEX', g.cx, g.floorY + 26, { track: 2.8, align: 'center' });

      if (live && !reduced) {
        dripAcc += dt;
        if (dripAcc > 7400) { dripAcc = 0; audio.drip({ pitch: 0.55 }); }
      }
    },

    dispose() {
      if (onMove) window.removeEventListener('pointermove', onMove);
      onMove = null; L = null; geo = null; host = null;
    },
  };
}
