// WELL 03 — MEETUP — 21 m.
// A gathering chamber. Someone has been counting: the back wall carries a tally of every
// meet held, cut five at a time. The group's name is cut into the stone above it, and a
// ring of seats is worn into the floor around the light. A new mark appears while you
// stand here. Palette: warm stone, sand, bone.

import { MONO, DISPLAY, rgba, tracked, rough, roughRect, blend } from './_shared.js';

const CHISEL = `<svg width="104" height="132" viewBox="0 0 104 132" fill="none" aria-hidden="true">
  <path d="M52 8 L52 74" stroke="var(--key)" stroke-width="7" opacity=".9" stroke-linecap="square"/>
  <path d="M52 74 L44 96 L52 108 L60 96 Z" fill="var(--key)" opacity=".95"/>
  <path d="M52 8 L52 74" stroke="#F2EDE2" stroke-width="1.6" opacity=".35"/>
  <path d="M22 122 l10 -18 M40 126 l10 -18 M58 126 l10 -18 M76 122 l10 -18"
        stroke="#F2EDE2" stroke-width="1.6" opacity=".4"/>
  <path d="M18 118 l72 -8" stroke="var(--key)" stroke-width="1.2" opacity=".3"/>
</svg>`;

const NAME = ['THE SOUTHERN', 'GAME PROGRAMMING', 'MEETUP GROUP'];

export default function make({ fx, audio }) {
  const prng = fx.rnd(5209);
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  let held = 47, cutAcc = 0, live = false, fresh = -1;
  const jitter = [];
  for (let i = 0; i < 400; i++) jitter.push(prng());
  let jp = 0;
  const jr = () => jitter[(jp = (jp + 1) % jitter.length)];

  // one tally mark: four uprights and a crossing stroke, cut by hand
  const group = (c, x, y, n, a, col) => {
    c.strokeStyle = rgba(col, a);
    c.lineWidth = 1.6;
    for (let i = 0; i < Math.min(4, n); i++) {
      const gx = x + i * 8;
      rough(c, gx, y, gx + (jr() - 0.5) * 3, y + 24, { jitter: 1.1, steps: 3, prng: jr });
    }
    if (n === 5) rough(c, x - 4, y + 22, x + 30, y + 2, { jitter: 1.2, steps: 4, prng: jr });
  };

  return {
    pal: {
      ink: '#140E08', stone: '#453526', stoneDark: '#0C0704',
      key: '#E8873A', cone: '#F7E2C2', dust: '#E8CFA8',
    },
    takeHz: 420,
    take: {
      label: 'cut your mark',
      host: 'meetup.com',
      art: CHISEL,
      pos: { left: '50%', top: '74%' },
    },

    init(env) { geo = env.geo; L = env.layer(3); },

    onLanded() { live = true; },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      c.clearRect(0, 0, g.w, g.h);
      jp = 0;

      // a mark is cut while you are standing here
      if (live && !reduced) {
        cutAcc += dt;
        if (cutAcc > 6200) {
          cutAcc = 0; held += 1; fresh = held;
          audio.noise({ dur: 0.18, gain: 0.08, band: [1200, 4800] });
          audio.noise({ dur: 0.1, gain: 0.05, band: [200, 900], delay: 0.06 });
        }
      }

      // --- the group's name, cut into the stone
      const px = g.cx, py = g.mouthY + 64;
      const pw = Math.min(520, g.half * 1.1), phh = 142;
      c.save();
      c.textAlign = 'center';
      const pg = c.createLinearGradient(0, py - 10, 0, py + phh);
      pg.addColorStop(0, rgba('#F7E2C2', 0.05));
      pg.addColorStop(1, rgba('#000000', 0.22));
      c.fillStyle = pg;
      c.fillRect(px - pw / 2, py - 14, pw, phh);
      c.strokeStyle = rgba('#F2EDE2', 0.14);
      c.lineWidth = 1;
      roughRect(c, px - pw / 2, py - 14, pw, phh, { jitter: 1.4, prng: jr });

      NAME.forEach((line, i) => {
        const size = Math.min(34, pw / 13);
        const y = py + 24 + i * (size + 12);
        c.font = DISPLAY(size);
        c.fillStyle = rgba('#000000', 0.55);
        c.fillText(line, px, y + 1.5);
        c.fillStyle = rgba(i === 0 ? '#F2EDE2' : '#E8873A', i === 0 ? 0.82 : 0.9);
        c.fillText(line, px, y);
      });
      c.restore();

      // --- the tally, cut five at a time
      c.textAlign = 'left';
      const tx = g.left + 54, ty = g.mouthY + 236;
      c.font = MONO(9, 500);
      c.fillStyle = rgba('#F2EDE2', 0.45);
      tracked(c, 'MEETS HELD · ' + held, tx, ty - 14, { track: 2.4 });
      const perRow = 7;
      for (let i = 0; i < Math.ceil(held / 5); i++) {
        const n = Math.min(5, held - i * 5);
        const gx = tx + (i % perRow) * 46;
        const gy = ty + Math.floor(i / perRow) * 42;
        const isFresh = fresh > 0 && i === Math.floor((held - 1) / 5);
        group(c, gx, gy, n, isFresh ? 0.95 : 0.3 + (i / 12) * 0.14, isFresh ? '#E8873A' : '#F2EDE2');
      }

      // --- the board: next gathering
      const bw = 248, bh = 104;
      const bx = g.right - 54 - bw, by = g.mouthY + 232;
      c.fillStyle = rgba('#000000', 0.3);
      c.fillRect(bx, by, bw, bh);
      c.strokeStyle = rgba('#E8873A', 0.5);
      c.lineWidth = 1.2;
      roughRect(c, bx, by, bw, bh, { jitter: 1.6, prng: jr });
      c.font = MONO(9.5, 500);
      c.fillStyle = rgba('#E8873A', 0.9);
      tracked(c, 'NEXT GATHERING', bx + 16, by + 28, { track: 2.6 });
      c.strokeStyle = rgba('#F2EDE2', 0.16);
      c.beginPath(); c.moveTo(bx + 16, by + 40); c.lineTo(bx + bw - 16, by + 40); c.stroke();
      c.font = MONO(9, 400);
      c.fillStyle = rgba('#F2EDE2', 0.55);
      tracked(c, 'DATE UNSET', bx + 16, by + 62, { track: 2.2 });
      tracked(c, 'WATCH THE BOARD', bx + 16, by + 80, { track: 2.2 });

      // --- the ring of seats, worn into the floor
      const ry = g.floorY - 34, rx = g.half * 0.5;
      c.strokeStyle = rgba('#F2EDE2', 0.08);
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(g.cx, ry, rx, rx * 0.26, 0, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + 0.26;
        const sx = g.cx + Math.cos(a) * rx;
        const sy = ry + Math.sin(a) * rx * 0.26;
        const near = (Math.sin(a) + 1) / 2;          // seats at the front are larger
        const sw = 14 + near * 12, sh = 7 + near * 6;
        c.fillStyle = rgba(blend('#453526', '#000000', 0.3), 0.95);
        c.beginPath(); c.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgba('#F7E2C2', 0.07 + near * 0.08);
        c.beginPath(); c.ellipse(sx, sy - sh * 0.35, sw * 0.8, sh * 0.5, 0, 0, Math.PI * 2); c.fill();
      }

      // --- a flicker of lamp warmth over the whole room
      if (!reduced) {
        const f = 0.5 + 0.5 * Math.sin(t / 420) * Math.sin(t / 1130);
        c.globalCompositeOperation = 'lighter';
        const lg = c.createRadialGradient(g.cx, g.floorY - 60, 20, g.cx, g.floorY - 60, g.half * 0.9);
        lg.addColorStop(0, rgba('#E8873A', 0.05 + f * 0.035));
        lg.addColorStop(1, rgba('#E8873A', 0));
        c.fillStyle = lg;
        c.fillRect(g.left, g.mouthY, g.right - g.left, g.h - g.mouthY);
        c.globalCompositeOperation = 'source-over';
      }
    },

    dispose() { L = null; geo = null; },
  };
}
