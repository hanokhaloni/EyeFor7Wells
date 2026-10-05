// WELL 05 — INSTAGRAM — 9 m.
// The shallowest shaft, and the brightest. Three plates bigger than the frame have been
// leaned against the dark: the desert from a roof, heads around a table, a controller.
// Every image is drawn, not photographed. A hard bar of light glints across them on a
// beat; tap anywhere to throw it again. The caption strip of the front plate is the
// room's title. Palette (3): plum, coral, cream.

import { MONO, DISPLAY, HE, rgba, tracked, TAU } from './_shared.js';

const PLUM = '#2A0F2E';
const CORAL = '#FF5A4E';
const CREAM = '#FFE9C9';

const PLATE = `<svg width="30" height="36" viewBox="0 0 30 36" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="28" height="34" fill="${CREAM}"/>
  <rect x="4" y="4" width="22" height="22" fill="${CORAL}"/>
  <circle cx="18" cy="12" r="5" fill="${CREAM}"/>
  <path d="M4 26 L12 17 L20 26 Z" fill="${PLUM}"/>
</svg>`;

const PERIOD = 3600, SWEEP = 640;

// --- the images: flat, three colours, big shapes ---------------------------------
function paint(c, S, kind) {
  if (kind === 0) {                              // the desert, from a roof
    c.fillStyle = CORAL; c.fillRect(0, 0, S, S);
    c.fillStyle = CREAM;
    c.beginPath(); c.arc(S * 0.63, S * 0.4, S * 0.27, 0, TAU); c.fill();
    c.fillStyle = PLUM;
    c.beginPath();
    c.moveTo(0, S * 0.66);
    c.bezierCurveTo(S * 0.25, S * 0.52, S * 0.45, S * 0.72, S * 0.7, S * 0.6);
    c.bezierCurveTo(S * 0.85, S * 0.53, S * 0.95, S * 0.58, S, S * 0.56);
    c.lineTo(S, S); c.lineTo(0, S); c.closePath(); c.fill();
    c.fillStyle = CORAL;
    c.beginPath();
    c.moveTo(0, S * 0.84);
    c.bezierCurveTo(S * 0.3, S * 0.76, S * 0.6, S * 0.9, S, S * 0.8);
    c.lineTo(S, S * 0.83);
    c.bezierCurveTo(S * 0.6, S * 0.93, S * 0.3, S * 0.79, 0, S * 0.87);
    c.closePath(); c.fill();
  } else if (kind === 1) {                       // heads around a table
    c.fillStyle = PLUM; c.fillRect(0, 0, S, S);
    c.fillStyle = CREAM;
    c.beginPath(); c.ellipse(S * 0.5, S * 0.56, S * 0.36, S * 0.18, 0, 0, TAU); c.fill();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.35;
      c.fillStyle = CORAL;
      c.beginPath();
      c.arc(S * 0.5 + Math.cos(a) * S * 0.42, S * 0.56 + Math.sin(a) * S * 0.25, S * 0.075, 0, TAU);
      c.fill();
    }
    c.fillStyle = PLUM;
    c.fillRect(S * 0.3, S * 0.52, S * 0.4, S * 0.025);
  } else {                                       // a controller, abstracted
    c.fillStyle = CORAL; c.fillRect(0, 0, S, S);
    c.fillStyle = PLUM;
    c.beginPath();
    c.ellipse(S * 0.32, S * 0.52, S * 0.2, S * 0.17, 0, 0, TAU);
    c.ellipse(S * 0.68, S * 0.52, S * 0.2, S * 0.17, 0, 0, TAU);
    c.fill();
    c.fillRect(S * 0.32, S * 0.36, S * 0.36, S * 0.3);
    c.fillStyle = CREAM;
    c.fillRect(S * 0.21, S * 0.495, S * 0.14, S * 0.05);
    c.fillRect(S * 0.255, S * 0.45, S * 0.05, S * 0.14);
    c.beginPath(); c.arc(S * 0.7, S * 0.47, S * 0.035, 0, TAU); c.fill();
    c.beginPath(); c.arc(S * 0.78, S * 0.55, S * 0.035, 0, TAU); c.fill();
  }
}

export default function make({ fx, audio }) {
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  let plates = null;
  let t0 = -1, tNow = 0, glintAt = 0;
  const DROP = 260;                              // ms from the room's first frame
  let px = 0, py = 0;                            // pointer, for a little parallax


  // the link's box on screen (measured; the frame places it): short screens fit around it
  let takeR = null, takeAt = -1e9;
  const takeBox = (t) => {
    if (t - takeAt > 400) {
      takeAt = t;
      const a = document.querySelector('.ch[data-well="instagram"] .ch-take');
      const r = a && a.getBoundingClientRect();
      takeR = r && r.height ? { top: r.top, right: r.right, left: r.left } : null;
    }
    return takeR;
  };

  let builtLt = null;
  const build = (w, h, lt) => {
    const narrow = w < 640;
    // the front plate stands below the hole you fell through (top 21% kept open) and,
    // on a phone, inside the frame so the caption is whole
    let bottom = h * (narrow ? 0.68 : 0.9);
    if (narrow && h > w && lt != null) bottom = Math.min(bottom, lt - 16);
    builtLt = lt;
    const W = Math.max(1, Math.min((bottom - h * 0.21) / 1.16, w * (narrow ? 0.9 : 0.5)));
    const H = W * 1.16;
    const defs = [
      // back plates first; the front plate last, and first to land
      { kind: 1, card: CORAL, cx: w * (narrow ? -0.1 : 0.17), cy: h * (narrow ? 0.3 : 0.26), s: 0.82, rot: 0.16, z: 0.5, delay: 70 },
      { kind: 2, card: CREAM, cx: w * (narrow ? 1.1 : 0.85), cy: h * (narrow ? 0.27 : 0.22), s: 0.86, rot: -0.19, z: 0.7, delay: 140 },
      { kind: 0, card: CREAM, cx: w * 0.5, cy: bottom - H / 2, s: 1, rot: -0.07, z: 1, delay: 0, front: true },
    ];
    plates = defs.map((d) => {
      const pw = W * d.s, ph = H * d.s;
      const b = pw * 0.05;
      const S = pw - b * 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cvs = document.createElement('canvas');
      cvs.width = Math.max(1, Math.round(S * dpr)); cvs.height = Math.max(1, Math.round(S * dpr));
      const cc = cvs.getContext('2d');
      cc.scale(dpr, dpr);
      if (S >= 1) paint(cc, S, d.kind);
      return Object.assign({}, d, { pw, ph, b, S, cvs });
    });
  };

  const glint = () => { glintAt = tNow; audio.tone(1320, { dur: 0.12, type: 'triangle', gain: 0.06, slideTo: 1980 }); };
  const onDown = () => { if (t0 >= 0) glint(); };

  const onMove = (e) => { px = e.clientX; py = e.clientY; };

  return {
    frame: { vault: false, gauge: false, index: false, notes: false, title: false, air: false },
    pal: {
      ink: PLUM, stone: '#3A1A40', stoneDark: '#14061A',
      key: CORAL, keyText: CORAL, cone: '#5A2440', dust: CREAM, bone: CREAM,
    },
    takeHz: 880,
    take: {
      verb: 'lift a plate',
      cta: 'FOLLOW ON INSTAGRAM',
      label: 'lift a plate',
      host: 'instagram.com',
      art: PLATE,
      // 'side': the frame stands the link against the left wall, under the leaning
      // back plate and clear of the front one
      pos: { left: '50%', top: '78%' },
      variant: 'side',
    },

    init(env) {
      geo = env.geo;
      L = env.layer(3);
      L.canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
    },

    resize() { plates = null; },

    update(dt, t) {
      if (!L) return;
      tNow = t;
      if (t0 < 0) { t0 = t; glintAt = t + DROP + 140; }
      const g = geo();
      const { w, h } = g;
      if (!(w >= 1 && h >= 1)) return;
      const c = L.ctx2d;
      const tb = takeBox(t);
      const lt = tb ? Math.round(tb.top / 6) * 6 : null;
      if (!plates || lt !== builtLt) build(w, h, lt);

      c.fillStyle = PLUM;
      c.fillRect(0, 0, w, h);

      const base = c.getTransform();
      const pxN = reduced || !px ? 0 : (px / w - 0.5);
      const pyN = reduced || !py ? 0 : (py / h - 0.5);

      // where each plate sits this frame (they drop in, hard, one after another)
      const at = plates.map((p) => {
        let dy = 0;
        if (!reduced) {
          const q = Math.max(0, Math.min(1, (t - t0 - p.delay) / DROP));
          dy = -h * 1.4 * (1 - q * q);
        }
        return {
          x: p.cx - pxN * 22 * p.z,
          y: p.cy + dy - pyN * 14 * p.z,
        };
      });

      plates.forEach((p, i) => {
        const { x, y } = at[i];
        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        // flat offset shadow, no blur
        c.fillStyle = rgba('#000000', 0.35);
        c.fillRect(-p.pw / 2 + 16, -p.ph / 2 + 20, p.pw, p.ph);
        c.fillStyle = p.card;
        c.fillRect(-p.pw / 2, -p.ph / 2, p.pw, p.ph);
        if (p.S >= 1 && p.cvs.width >= 1 && p.cvs.height >= 1) c.drawImage(p.cvs, -p.pw / 2 + p.b, -p.ph / 2 + p.b, p.S, p.S);

        if (p.front) {
          // the caption strip is the title
          const capTop = -p.ph / 2 + p.b + p.S;
          const capH = p.ph / 2 - capTop;
          const fs = Math.min(capH * 0.62, p.pw * 0.11);
          const lx = -p.pw / 2 + p.b;
          c.textBaseline = 'middle';
          c.textAlign = 'left';
          c.font = DISPLAY(fs);
          c.fillStyle = PLUM;
          c.fillText('INSTAGRAM', lx, capTop + capH * 0.52);
          const nw = c.measureText('INSTAGRAM').width;
          c.font = HE(fs * 0.46, 800);
          c.fillStyle = CORAL;
          c.fillText('אינסטגרם', lx + nw + fs * 0.25, capTop + capH * 0.42);
          c.font = MONO(Math.max(8, fs * 0.2), 600);
          c.fillStyle = rgba(PLUM, 0.75);
          c.textAlign = 'right';
          // on a phone the plate overflows the frame: keep the caption on screen
          const rx = Math.min(p.pw / 2 - p.b, w / 2 - 24);
          const roomy = w >= 640;
          tracked(c, '09 M', rx, capTop + capH * (roomy ? 0.36 : 0.5), { track: 2, align: 'right' });
          if (roomy) tracked(c, 'WHAT IT LOOKS LIKE', rx, capTop + capH * 0.66, { track: 2, align: 'right' });
          c.textBaseline = 'alphabetic';
        }
        c.restore();
      });

      // --- the glint: a hard flat bar of light across every image at once
      let s;
      if (reduced) s = 0.42;
      else {
        const since = t - glintAt;
        if (since >= 0 && since < SWEEP) s = since / SWEEP;
        else if (since >= SWEEP) {
          // schedule the next beat
          if (since > PERIOD) glintAt = t;
          s = -1;
        } else s = -1;
      }
      if (s >= 0) {
        c.save();
        c.beginPath();
        plates.forEach((p, i) => {
          c.setTransform(base);
          c.translate(at[i].x, at[i].y);
          c.rotate(p.rot);
          c.rect(-p.pw / 2 + p.b, -p.ph / 2 + p.b, p.S, p.S);   // the images, not the cards
        });
        c.setTransform(base);
        c.clip();
        const span = w + h;
        const bx = -h * 0.5 + s * (span + h * 0.4);
        const bw = Math.max(70, w * 0.11);
        const skew = h * 0.55;
        c.fillStyle = rgba(CREAM, 0.72);
        c.beginPath();
        c.moveTo(bx, 0); c.lineTo(bx + bw, 0);
        c.lineTo(bx + bw - skew, h); c.lineTo(bx - skew, h); c.closePath(); c.fill();
        const tx = bx + bw + bw * 0.45, tw = bw * 0.22;
        c.beginPath();
        c.moveTo(tx, 0); c.lineTo(tx + tw, 0);
        c.lineTo(tx + tw - skew, h); c.lineTo(tx - skew, h); c.closePath(); c.fill();
        c.restore();
      }
    },

    dispose() {
      if (L) L.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      plates = null; L = null; geo = null;
    },
  };
}
