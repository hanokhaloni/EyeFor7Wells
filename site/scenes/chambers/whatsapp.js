// WELL 01 — WHATSAPP — 12 m.
// The shallowest shaft with water in it. You are close enough to the surface that the
// daily chatter falls in and keeps rising back out: fragments of the community drifting
// up the two side channels of the shaft, Hebrew and Latin together. A cord hangs in the
// middle of the light. Palette: green-black ground, water, bone.

import { MONO, HE, rgba, tracked, blend } from './_shared.js';

const EN = [
  'anyone up for a jam', 'build broke again', 'who has the projector',
  'playtest tonight 19:00', 'shader help?', 'godot or unity',
  'thursday works', 'meet at the lab', 'got a prototype',
  'two testers needed', 'coffee first', 'is the key under the mat',
  'wishlist is live', 'bug or feature', 'desert jam, 48h',
];
const HEB = [
  'מישהו עם רעיון?', 'מי בא לפלייטסט', 'הבילד נשבר שוב', 'ג׳אם בשבת?',
  'יש לי פרוטוטייפ', 'נתראה בחמישי', 'מי מביא מקרן', 'צריך עזרה עם שיידר',
  'מחר ב־19:00', 'באר שבע, כרגיל', 'מישהו ער?',
];

const CORD = `<svg width="92" height="168" viewBox="0 0 92 168" fill="none" aria-hidden="true">
  <path d="M46 0 C40 26 52 44 46 70 C40 96 52 104 46 118" stroke="var(--key)" stroke-width="2.2"
        opacity=".9" stroke-linecap="round"/>
  <path d="M46 0 C52 26 40 44 46 70 C52 96 40 104 46 118" stroke="var(--key)" stroke-width="1"
        opacity=".4" stroke-linecap="round"/>
  <circle cx="46" cy="131" r="12.5" stroke="var(--key)" stroke-width="2" opacity=".95"/>
  <circle cx="46" cy="131" r="4" fill="var(--key)"/>
  <path d="M34 131 h-11 M69 131 h-11" stroke="var(--key)" stroke-width="1.4" opacity=".55"/>
  <path d="M26 152 h40" stroke="#F2EDE2" stroke-width="1" opacity=".3"/>
</svg>`;

export default function make({ fx, audio }) {
  const prng = fx.rnd(1201);
  let L = null, geo = null, pal = null;
  const voices = [];
  let spawn = 0, dripAcc = 0, live = false;

  const push = (startLow) => {
    const g = geo && geo();
    if (!g) return;
    const he = prng() < 0.42;
    const pool = he ? HEB : EN;
    let text = null;
    for (let tries = 0; tries < 8; tries++) {
      const t = pool[(prng() * pool.length) | 0];
      if (!voices.some((v) => v.text === t)) { text = t; break; }
    }
    if (!text) return;
    const leftCh = prng() < 0.5;
    const chW = (g.half - 190) * 0.92;
    const x = leftCh
      ? g.cx - 190 - prng() * chW
      : g.cx + 190 + prng() * chW;
    voices.push({
      text, he, x,
      y: startLow ? g.floorY - prng() * 40 : g.floorY - 30 - prng() * (g.floorY - g.h * 0.34),
      v: 0.1 + prng() * 0.16,
      size: he ? 13 + prng() * 7 : 11 + prng() * 5,
      ph: prng() * 7,
      key: prng() < 0.45,
      a: 0.55 + prng() * 0.45,
    });
  };

  return {
    pal: {
      ink: '#070F0B', stone: '#2A3A33', stoneDark: '#050B09',
      key: '#3BE8B0', cone: '#D6E8DC', dust: '#CFE8DA',
    },
    takeHz: 700,
    take: {
      label: 'pull the cord',
      host: 'chat.whatsapp.com',
      art: CORD,
      pos: { left: '50%', top: '60%' },
    },
    ui: `
      <div class="nt" style="left:26px;bottom:120px">
        <b>channel 01 · live</b>
        voices carry in this shaft<br>
        <em>surface noise: constant</em>
      </div>
      <div class="nt nt--r" style="right:26px;bottom:120px">
        <b>water: 0.2 m</b>
        standing. potable, unverified<br>
        <em>he / en, mixed</em>
      </div>`,

    init(env) {
      geo = env.geo; pal = env.pal;
      L = env.layer(3);
    },

    onLanded() {
      live = true;
      for (let i = 0; i < 13; i++) push(false);
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      c.clearRect(0, 0, g.w, g.h);

      // --- shallow standing water on the floor
      c.save();
      c.beginPath(); c.rect(0, g.floorY - 2, g.w, g.h - g.floorY + 2); c.clip();
      for (let i = 0; i < 9; i++) {
        const y = g.floorY + 4 + i * ((g.h - g.floorY) / 9);
        const amp = 2 + i * 0.7;
        c.strokeStyle = rgba('#3BE8B0', 0.05 + 0.07 * (1 - i / 9));
        c.lineWidth = 1;
        c.beginPath();
        for (let x = 0; x <= g.w; x += 14) {
          const yy = y + Math.sin(x / 70 + t / 900 + i) * amp * 0.5;
          x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
        }
        c.stroke();
      }
      // ripple rings under the light pool
      for (let i = 0; i < 3; i++) {
        const ph = ((t / 2600 + i / 3) % 1);
        c.strokeStyle = rgba('#3BE8B0', 0.2 * (1 - ph));
        c.lineWidth = 1.2;
        c.beginPath();
        c.ellipse(g.cx, g.floorY + 16, 40 + ph * g.half * 0.55, (40 + ph * g.half * 0.55) * 0.22, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();

      // --- voices rising
      if (live) {
        spawn -= dt;
        if (spawn <= 0 && voices.length < 16) { push(true); spawn = 420 + prng() * 900; }
        dripAcc += dt;
        if (dripAcc > 5200) { dripAcc = 0; audio.drip({ pitch: 0.9 + prng() * 0.5 }); }
      }

      c.save();
      c.beginPath(); c.rect(g.left + 6, 0, g.right - g.left - 12, g.floorY); c.clip();
      for (let i = voices.length - 1; i >= 0; i--) {
        const v = voices[i];
        v.y -= v.v * (dt / 16.6);
        const span = g.floorY - g.skyCy;
        const p = (g.floorY - v.y) / span;          // 0 floor, 1 at the sky
        if (p > 1.02) { voices.splice(i, 1); continue; }
        const fade = p < 0.06 ? p / 0.06 : 1 - Math.max(0, (p - 0.52) / 0.52);
        const drift = Math.sin(t / 2200 + v.ph) * 16;
        const taper = 1 - p * 0.55;                  // they narrow into the shaft as they go
        const x = g.cx + (v.x - g.cx) * taper + drift;
        const sz = v.size * (1 - p * 0.3);
        c.font = v.he ? HE(sz, 400) : MONO(sz, 400);
        c.textAlign = 'center';
        const col = v.key ? '#3BE8B0' : '#F2EDE2';
        c.fillStyle = rgba(col, Math.max(0, fade) * v.a);
        c.fillText(v.text, x, v.y);
        if (v.key) {
          c.fillStyle = rgba('#3BE8B0', Math.max(0, fade) * 0.1);
          c.fillText(v.text, x, v.y);
        }
      }
      c.restore();

      // --- surveyed water line, chalked across the back wall
      c.font = MONO(9, 500);
      c.textAlign = 'left';
      c.strokeStyle = rgba(blend('#3BE8B0', '#F2EDE2', 0.4), 0.18);
      c.lineWidth = 1;
      c.setLineDash([7, 9]);
      c.beginPath();
      c.moveTo(g.left + 30, g.floorY - 34);
      c.lineTo(g.right - 30, g.floorY - 34);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = rgba('#3BE8B0', 0.4);
      tracked(c, 'HIGH WATER', g.left + 30, g.floorY - 42, { track: 2.2 });
    },

    dispose() { voices.length = 0; L = null; geo = null; },
  };
}
