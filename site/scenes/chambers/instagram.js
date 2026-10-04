// WELL 05 — INSTAGRAM — 9 m.
// The shallowest shaft: almost all the night gets in here. Someone pinned the community
// to the wall in plates — every image drawn, not photographed, because photographs are
// not ours to put underground. A sweep of light crosses the wall and the plates answer it.
// Palette: lit stone, sand, bone.

import { MONO, rgba, tracked, blend } from './_shared.js';

const PLATE = `<svg width="106" height="124" viewBox="0 0 124 146" fill="none" aria-hidden="true">
  <rect x="3" y="3" width="118" height="140" fill="#F2EDE2" opacity=".92"/>
  <rect x="11" y="11" width="102" height="98" fill="#1A1210"/>
  <path d="M11 84 h102" stroke="var(--key)" stroke-width="7" opacity=".85"/>
  <circle cx="44" cy="46" r="15" fill="var(--key)" opacity=".9"/>
  <path d="M68 70 l18 -26 l20 38 h-62 z" fill="#F2EDE2" opacity=".35"/>
  <path d="M20 126 h44" stroke="#1A1210" stroke-width="3" opacity=".5"/>
</svg>`;

// Each plate is generated once into its own canvas: abstract, procedural, 3 colours.
function paintPlate(c, w, h, k, R) {
  const bone = '#F2EDE2', sand = '#E8873A', rust = '#B8341F';
  c.fillStyle = '#191110';
  c.fillRect(0, 0, w, h);
  const type = k % 7;

  if (type === 0) {                                  // the desert, from a roof
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2A1A18');
    sky.addColorStop(1, rgba(sand, 0.55));
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = rgba(bone, 0.85);
    c.beginPath(); c.arc(w * 0.68, h * 0.33, w * 0.11, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1A1210';
    c.beginPath();
    c.moveTo(0, h * 0.72);
    for (let i = 0; i <= 8; i++) c.lineTo((i / 8) * w, h * (0.6 + R() * 0.22));
    c.lineTo(w, h); c.lineTo(0, h); c.fill();
  } else if (type === 1) {                           // heads around a table
    c.fillStyle = rgba(sand, 0.16); c.fillRect(0, 0, w, h);
    c.fillStyle = rgba(bone, 0.9);
    c.beginPath(); c.ellipse(w / 2, h * 0.62, w * 0.34, h * 0.16, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      c.fillStyle = i % 3 === 0 ? rgba(rust, 0.95) : '#1A1210';
      c.beginPath();
      c.arc(w / 2 + Math.cos(a) * w * 0.36, h * 0.62 + Math.sin(a) * h * 0.2, w * 0.08, 0, Math.PI * 2);
      c.fill();
    }
  } else if (type === 2) {                           // a screen in a dark room
    c.fillStyle = '#120C0B'; c.fillRect(0, 0, w, h);
    const gw = w * 0.56, gh = gw * 0.62;
    const gx = (w - gw) / 2, gy = h * 0.3;
    const gl = c.createRadialGradient(gx + gw / 2, gy + gh / 2, 2, gx + gw / 2, gy + gh / 2, gw);
    gl.addColorStop(0, rgba(bone, 0.5));
    gl.addColorStop(1, rgba(bone, 0));
    c.fillStyle = gl; c.fillRect(0, 0, w, h);
    c.fillStyle = rgba(bone, 0.92); c.fillRect(gx, gy, gw, gh);
    c.fillStyle = rgba(sand, 0.9); c.fillRect(gx + 6, gy + 6, gw - 12, gh * 0.22);
    c.fillStyle = '#120C0B';
    for (let i = 0; i < 5; i++) c.fillRect(gx + 6, gy + gh * 0.38 + i * 7, (gw - 12) * (0.3 + R() * 0.6), 2.5);
  } else if (type === 3) {                           // halftone
    c.fillStyle = '#1C1211'; c.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 9) {
      for (let x = 6; x < w; x += 9) {
        const r = (1 - y / h) * 4.4 * (0.4 + R() * 0.9);
        if (r < 0.4) continue;
        c.fillStyle = rgba(y / h > 0.6 ? sand : bone, 0.85);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }
  } else if (type === 4) {                           // a controller, abstracted
    c.fillStyle = rgba(rust, 0.3); c.fillRect(0, 0, w, h);
    c.fillStyle = rgba(bone, 0.93);
    c.beginPath();
    c.ellipse(w * 0.34, h * 0.5, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
    c.ellipse(w * 0.66, h * 0.5, w * 0.2, h * 0.16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(w * 0.34, h * 0.34, w * 0.32, h * 0.32);
    c.fillStyle = '#1A1210';
    c.fillRect(w * 0.26, h * 0.46, w * 0.12, 4);
    c.fillRect(w * 0.31, h * 0.41, 4, w * 0.12);
    c.beginPath(); c.arc(w * 0.68, h * 0.47, 4.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(w * 0.76, h * 0.53, 4.5, 0, Math.PI * 2); c.fill();
  } else if (type === 5) {                           // a window of light
    c.fillStyle = '#140D0C'; c.fillRect(0, 0, w, h);
    c.fillStyle = rgba(bone, 0.9);
    c.fillRect(w * 0.26, h * 0.16, w * 0.48, h * 0.44);
    c.fillStyle = '#140D0C';
    c.fillRect(w * 0.49, h * 0.16, 3, h * 0.44);
    c.fillRect(w * 0.26, h * 0.36, w * 0.48, 3);
    c.fillStyle = rgba(sand, 0.4);
    c.beginPath();
    c.moveTo(w * 0.26, h * 0.6); c.lineTo(w * 0.74, h * 0.6);
    c.lineTo(w * 0.92, h); c.lineTo(w * 0.08, h); c.fill();
  } else {                                           // a build, mid-jam
    c.fillStyle = '#17100F'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = rgba(i === 3 ? sand : bone, 0.2 + R() * 0.7);
      c.fillRect(8, 12 + i * (h - 24) / 9, (w - 16) * (0.2 + R() * 0.75), 3.5);
    }
    c.strokeStyle = rgba(rust, 0.9); c.lineWidth = 2;
    c.strokeRect(6, 8, w - 12, h - 16);
  }

  // every plate is a little over-exposed at the top
  const sh = c.createLinearGradient(0, 0, 0, h);
  sh.addColorStop(0, rgba('#FFF0DC', 0.12));
  sh.addColorStop(0.5, rgba('#FFF0DC', 0));
  sh.addColorStop(1, rgba('#000000', 0.3));
  c.fillStyle = sh;
  c.fillRect(0, 0, w, h);
}

export default function make({ fx }) {
  const prng = fx.rnd(9091);
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  const plates = [];
  let built = 0;

  const build = (g) => {
    plates.length = 0;
    const cols = 6, rows = 2;
    const padX = 78, padY = 42;
    const x0 = g.left + padX, x1 = g.right - padX;
    const y0 = g.mouthY + padY, y1 = g.floorY - 186;
    const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    const pw = Math.min(118, cw - 16), ph = pw * 1.2;
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        if (prng() < 0.12) continue;                 // a few nails are empty
        const cvs = document.createElement('canvas');
        const S = 2;
        cvs.width = pw * S; cvs.height = ph * S;
        const cc = cvs.getContext('2d');
        cc.scale(S, S);
        // the plate itself: bone card, image window, caption strip
        cc.fillStyle = '#F2EDE2';
        cc.fillRect(0, 0, pw, ph);
        cc.save();
        cc.translate(7, 7);
        const iw = pw - 14, ih = ph - 34;
        cc.beginPath(); cc.rect(0, 0, iw, ih); cc.clip();
        paintPlate(cc, iw, ih, n + ((prng() * 7) | 0), fx.rnd(n * 613 + 29));
        cc.restore();
        cc.font = MONO(7, 500);
        cc.fillStyle = 'rgba(26,18,16,.72)';
        tracked(cc, 'PL-' + String(n + 1).padStart(2, '0'), 8, ph - 11, { track: 1.4 });
        cc.fillStyle = 'rgba(184,52,31,.9)';
        cc.fillRect(pw - 20, ph - 16, 12, 5);

        plates.push({
          cvs, pw, ph,
          x: x0 + col * cw + (cw - pw) / 2 + (prng() - 0.5) * 14,
          y: y0 + r * ch + (ch - ph) / 2 + (prng() - 0.5) * 14,
          rot: (prng() - 0.5) * 0.14,
          ph2: prng() * 7,
        });
        n++;
      }
    }
    built = plates.length;
  };

  return {
    pal: {
      ink: '#1A1211', stone: '#4C4036', stoneDark: '#120C0A',
      key: '#E8873A', cone: '#FFF0DC', dust: '#FFE6C8',
    },
    takeHz: 880,
    take: {
      label: 'lift a plate',
      host: 'instagram.com',
      art: PLATE,
      pos: { left: '50%', top: '77%' },
    },
    ui: `
      <div class="nt" style="left:26px;bottom:120px">
        <b>insolation · 100%</b>
        nearest the surface<br>
        <em>plates: drawn, not taken</em>
      </div>`,

    init(env) { geo = env.geo; L = env.layer(3); },

    resize() { plates.length = 0; },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      if (!plates.length && g.mouthY < g.floorY - 260) build(g);
      const c = L.ctx2d;
      c.clearRect(0, 0, g.w, g.h);

      // the sweep: a band of light crossing the wall, left to right
      const sweep = reduced ? g.cx : g.left + ((t / 26) % ((g.right - g.left) + 700)) - 350;

      for (const p of plates) {
        const sway = reduced ? 0 : Math.sin(t / 2600 + p.ph2) * 0.012;
        const cx = p.x + p.pw / 2, cy = p.y + p.ph / 2;
        c.save();
        c.translate(cx, cy);
        c.rotate(p.rot + sway);
        c.shadowColor = 'rgba(0,0,0,.6)';
        c.shadowBlur = 14;
        c.shadowOffsetY = 7;
        c.drawImage(p.cvs, -p.pw / 2, -p.ph / 2, p.pw, p.ph);
        c.shadowBlur = 0; c.shadowOffsetY = 0;

        // the sweep hitting this plate
        const d = Math.abs(cx - sweep);
        if (d < 260) {
          const k = Math.pow(1 - d / 260, 2);
          c.globalCompositeOperation = 'lighter';
          const sg = c.createLinearGradient(-p.pw / 2, -p.ph / 2, p.pw / 2, p.ph / 2);
          sg.addColorStop(0, rgba('#FFF0DC', 0));
          sg.addColorStop(0.5, rgba('#FFF0DC', 0.3 * k));
          sg.addColorStop(1, rgba('#FFF0DC', 0));
          c.fillStyle = sg;
          c.fillRect(-p.pw / 2, -p.ph / 2, p.pw, p.ph);
          c.globalCompositeOperation = 'source-over';
        }
        // the nail
        c.fillStyle = rgba('#1A1210', 0.8);
        c.beginPath(); c.arc(0, -p.ph / 2 + 5, 2.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = rgba('#FFF0DC', 0.5);
        c.beginPath(); c.arc(-0.7, -p.ph / 2 + 4.3, 1, 0, Math.PI * 2); c.fill();
        c.restore();
      }

      // readout, chalked under the wall
      c.textAlign = 'left';
      c.font = MONO(9, 500);
      c.fillStyle = rgba('#E8873A', 0.75);
      tracked(c, 'PLATES ON THE WALL · ' + String(built).padStart(2, '0'),
        g.left + 78, g.floorY - 158, { track: 2.4 });
      c.strokeStyle = rgba('#F2EDE2', 0.16);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(g.left + 78, g.floorY - 150);
      c.lineTo(g.right - 78, g.floorY - 150);
      c.stroke();
      c.fillStyle = rgba(blend('#E8873A', '#F2EDE2', 0.4), 0.3);
    },

    dispose() { plates.length = 0; L = null; geo = null; },
  };
}
