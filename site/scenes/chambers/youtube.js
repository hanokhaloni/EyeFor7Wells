// WELL 04 — YOUTUBE — 44 m.
// A projection chamber. Someone dragged a projector down here and pointed it at the wet
// wall. Talks, recorded: frames cut hard every second and a half, and the reel of them
// runs along the floor. The projector is the thing you take. Palette: rust, bone, black.

import { MONO, DISPLAY, rgba, tracked, blend } from './_shared.js';

const PROJECTOR = `<svg width="132" height="112" viewBox="0 0 132 112" fill="none" aria-hidden="true">
  <rect x="26" y="46" width="78" height="38" stroke="var(--key)" stroke-width="2" opacity=".95"/>
  <circle cx="46" cy="30" r="17" stroke="var(--key)" stroke-width="2" opacity=".9"/>
  <circle cx="86" cy="32" r="13" stroke="var(--key)" stroke-width="2" opacity=".7"/>
  <circle cx="46" cy="30" r="3.5" fill="var(--key)"/>
  <circle cx="86" cy="32" r="3" fill="var(--key)" opacity=".7"/>
  <path d="M26 58 L8 50 L8 76 L26 70 Z" fill="#F2EDE2" opacity=".55"/>
  <path d="M104 62 h18 M104 70 h12" stroke="#F2EDE2" stroke-width="1.4" opacity=".4"/>
  <path d="M34 92 h62" stroke="var(--key)" stroke-width="1.4" opacity=".35"/>
</svg>`;

// Six abstractions of a recorded talk. No photographs — everything is drawn.
function frame(c, x, y, w, h, idx, R) {
  const bone = '#F2EDE2', rust = '#B8341F';
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = '#0C0908';
  c.fillRect(x, y, w, h);
  const k = idx % 6;
  const u = (a, b) => x + w * a + (b || 0);
  const v = (a, b) => y + h * a + (b || 0);

  if (k === 0) {                                   // a figure at a lectern, a slide behind
    c.fillStyle = rgba(bone, 0.1);
    c.fillRect(u(0.08), v(0.12), w * 0.5, h * 0.52);
    c.fillStyle = rgba(rust, 0.55);
    c.fillRect(u(0.12), v(0.18), w * 0.3, h * 0.07);
    c.fillStyle = rgba(bone, 0.16);
    for (let i = 0; i < 4; i++) c.fillRect(u(0.12), v(0.34) + i * h * 0.07, w * (0.18 + R() * 0.26), 2);
    c.fillStyle = rgba(bone, 0.5);
    c.beginPath(); c.arc(u(0.74), v(0.42), h * 0.12, 0, Math.PI * 2); c.fill();
    c.fillRect(u(0.66), v(0.54), w * 0.16, h * 0.4);
    c.fillStyle = rgba(bone, 0.22);
    c.fillRect(u(0.6), v(0.8), w * 0.3, h * 0.2);
  } else if (k === 1) {                            // a grid of slides
    for (let i = 0; i < 12; i++) {
      const cx = u(0.08) + (i % 4) * w * 0.22, cy = v(0.14) + ((i / 4) | 0) * h * 0.26;
      c.fillStyle = rgba(R() < 0.3 ? rust : bone, 0.1 + R() * 0.4);
      c.fillRect(cx, cy, w * 0.17, h * 0.19);
    }
  } else if (k === 2) {                            // code on screen
    for (let i = 0; i < 11; i++) {
      c.fillStyle = rgba(i % 5 === 0 ? rust : bone, 0.18 + R() * 0.4);
      c.fillRect(u(0.1) + (R() < 0.4 ? w * 0.06 : 0), v(0.12) + i * h * 0.075, w * (0.1 + R() * 0.6), 2.5);
    }
  } else if (k === 3) {                            // a waveform: the recording itself
    c.strokeStyle = rgba(rust, 0.8);
    c.lineWidth = 2;
    for (let i = 0; i < 46; i++) {
      const bx = u(0.06) + (i / 46) * w * 0.88;
      const bh = h * 0.42 * Math.abs(Math.sin(i * 0.7 + idx)) * (0.3 + R());
      c.beginPath(); c.moveTo(bx, v(0.5) - bh / 2); c.lineTo(bx, v(0.5) + bh / 2); c.stroke();
    }
  } else if (k === 4) {                            // the room, from the back
    c.fillStyle = rgba(bone, 0.38);
    c.fillRect(u(0.2), v(0.1), w * 0.6, h * 0.34);
    for (let i = 0; i < 14; i++) {
      const hx = u(0.08) + R() * w * 0.84, hy = v(0.62) + R() * h * 0.3;
      c.fillStyle = rgba('#0C0908', 0.95);
      c.beginPath(); c.arc(hx, hy, h * 0.07, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgba(rust, 0.35); c.lineWidth = 1; c.stroke();
    }
  } else {                                         // slate
    c.fillStyle = rgba(bone, 0.06);
    c.fillRect(x, y, w, h);
    c.font = DISPLAY(Math.round(h * 0.3));
    c.textAlign = 'center';
    c.fillStyle = rgba(bone, 0.75);
    c.fillText('TAKE ' + String((idx % 17) + 1).padStart(2, '0'), x + w / 2, y + h * 0.6);
    c.font = MONO(9, 500);
    c.fillStyle = rgba(rust, 0.9);
    tracked(c, 'RECORDED', x + w / 2, y + h * 0.78, { track: 3, align: 'center' });
  }
  c.restore();
}

export default function make({ fx, audio }) {
  const prng = fx.rnd(7717);
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  let idx = 0, acc = 0, live = false, flick = 1;

  return {
    pal: {
      ink: '#0E0706', stone: '#33211A', stoneDark: '#070302',
      key: '#B8341F', cone: '#D9C3B0', dust: '#D8B9A0',
    },
    takeHz: 220,
    take: {
      label: 'thread the reel',
      host: 'youtube.com',
      art: PROJECTOR,
      pos: { left: '76%', top: '60%' },
    },
    ui: `
      <div class="nt" style="left:26px;bottom:120px">
        <b>projection · running</b>
        wall is wet. image holds<br>
        <em>cut every 1.5 s</em>
      </div>`,

    init(env) { geo = env.geo; L = env.layer(3); },

    onLanded() {
      live = true;
      audio.noise({ dur: 0.5, gain: 0.05, band: [400, 2600] });
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      c.clearRect(0, 0, g.w, g.h);

      if (live) {
        acc += dt;
        if (acc > 1500) {
          acc = 0; idx++;
          if (!reduced) audio.noise({ dur: 0.07, gain: 0.05, band: [600, 3600] });
        }
      }
      flick = reduced ? 1 : 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t / 42)) + (prng() - 0.5) * 0.1;

      // --- the projector, and the beam it throws
      const px = g.w * 0.76, py = g.h * 0.6;
      const sw = Math.min(430, g.half * 0.92), sh = sw * 0.5625;
      const sx = g.left + (g.right - g.left) * 0.26 - sw / 2;
      const sy = g.mouthY + 108;

      c.save();
      c.globalCompositeOperation = 'lighter';
      const bg = c.createLinearGradient(px, py, sx + sw / 2, sy + sh / 2);
      bg.addColorStop(0, rgba('#F2EDE2', 0.055 * flick));
      bg.addColorStop(1, rgba('#F2EDE2', 0.014 * flick));
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(px - 10, py - 4);
      c.lineTo(sx, sy);
      c.lineTo(sx, sy + sh);
      c.lineTo(px - 6, py + 10);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(px - 10, py - 4);
      c.lineTo(sx + sw, sy + sh * 0.1);
      c.lineTo(sx + sw, sy + sh * 0.92);
      c.lineTo(px - 6, py + 10);
      c.closePath();
      c.fill();
      c.restore();

      // --- the image on the wet wall. Drawn twice: the second pass is the lamp.
      c.save();
      c.globalAlpha = flick;
      frame(c, sx, sy, sw, sh, idx, fx.rnd(idx * 977 + 11));
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = flick * 0.75;
      frame(c, sx, sy, sw, sh, idx, fx.rnd(idx * 977 + 11));
      c.globalAlpha = 1;
      c.fillStyle = rgba('#E8CFA8', 0.07 * flick);
      c.fillRect(sx, sy, sw, sh);
      c.restore();

      // scanlines + the glow around the image
      c.save();
      c.beginPath(); c.rect(sx, sy, sw, sh); c.clip();
      c.fillStyle = rgba('#000000', 0.22);
      for (let y = sy; y < sy + sh; y += 3) c.fillRect(sx, y, sw, 1);
      c.restore();
      c.strokeStyle = rgba('#F2EDE2', 0.2);
      c.lineWidth = 1;
      c.strokeRect(sx - 0.5, sy - 0.5, sw + 1, sh + 1);
      const gl = c.createRadialGradient(sx + sw / 2, sy + sh / 2, sw * 0.4, sx + sw / 2, sy + sh / 2, sw * 1.1);
      gl.addColorStop(0, rgba('#D9C3B0', 0.1 * flick));
      gl.addColorStop(1, rgba('#D9C3B0', 0));
      c.fillStyle = gl;
      c.fillRect(sx - sw * 0.6, sy - sh * 0.8, sw * 2.2, sh * 2.6);

      // --- the wall is wet: the image runs down it
      c.save();
      c.beginPath(); c.rect(sx, sy + sh, sw, g.floorY - sy - sh); c.clip();
      c.globalAlpha = 0.17 * flick;
      c.translate(0, (sy + sh) * 2);
      c.scale(1, -1);
      frame(c, sx, sy, sw, sh, idx, fx.rnd(idx * 977 + 11));
      c.restore();
      c.save();
      c.beginPath(); c.rect(sx, sy + sh, sw, g.floorY - sy - sh); c.clip();
      for (let i = 0; i < 16; i++) {
        const dx = sx + ((i * 97) % sw);
        const dl = 20 + ((i * 53) % 90);
        c.strokeStyle = rgba('#D9C3B0', 0.05 + (i % 3) * 0.03);
        c.lineWidth = 1 + (i % 2);
        c.beginPath(); c.moveTo(dx, sy + sh); c.lineTo(dx + (i % 2 ? 2 : -2), sy + sh + dl); c.stroke();
      }
      c.restore();

      // --- the reel: every talk, running along the floor
      const ry = g.floorY - 86, ch = 52, cw = 92;
      const scroll = reduced ? 0 : (t / 36) % (cw + 8);
      c.save();
      c.beginPath(); c.rect(g.left, ry - 12, g.right - g.left, ch + 24); c.clip();
      c.fillStyle = rgba('#000000', 0.5);
      c.fillRect(g.left, ry - 10, g.right - g.left, ch + 20);
      c.strokeStyle = rgba('#B8341F', 0.3);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(g.left, ry - 10); c.lineTo(g.right, ry - 10); c.stroke();
      c.beginPath(); c.moveTo(g.left, ry + ch + 10); c.lineTo(g.right, ry + ch + 10); c.stroke();
      for (let i = -1; i < (g.right - g.left) / (cw + 8) + 2; i++) {
        const cx = g.left + i * (cw + 8) - scroll;
        frame(c, cx, ry, cw, ch, idx + i + 3, fx.rnd((idx + i + 3) * 977 + 11));
        c.strokeStyle = rgba('#F2EDE2', 0.12);
        c.strokeRect(cx - 0.5, ry - 0.5, cw + 1, ch + 1);
        c.fillStyle = rgba('#F2EDE2', 0.16);
        for (const sy2 of [ry - 8, ry + ch + 2]) {
          c.fillRect(cx + 10, sy2, 10, 6);
          c.fillRect(cx + 58, sy2, 10, 6);
        }
      }
      c.restore();

      // --- readout
      c.textAlign = 'left';
      c.font = MONO(9, 500);
      c.fillStyle = rgba('#B8341F', 0.85);
      tracked(c, '● REC', sx, sy - 16, { track: 2.6 });
      c.fillStyle = rgba('#F2EDE2', 0.4);
      tracked(c, 'FRAME ' + String(idx % 999).padStart(3, '0') + ' · 44 M · WALL WET',
        sx + 58, sy - 16, { track: 2.2 });
      c.fillStyle = rgba(blend('#B8341F', '#F2EDE2', 0.4), 0.3);
    },

    dispose() { L = null; geo = null; },
  };
}
