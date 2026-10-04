// WELL 02 — DISCORD — 30 m.
// A resonant cave. Sound is the only thing that happens here, so sound is the only thing
// you can see: a standing wave strung across the chamber between two nodes, and the
// presences holding it up. Who is in the voice channel right now is unknowable from here,
// so the room reports it the way a surveyor would: a count, unverified.
// Palette: blue-black ground, water, bone.

import { MONO, rgba, tracked, blend } from './_shared.js';

const CRACK = `<svg width="118" height="126" viewBox="0 0 118 126" fill="none" aria-hidden="true">
  <path d="M59 6 L52 38 L66 52 L48 74 L62 92 L54 120" stroke="var(--key)" stroke-width="2.4"
        stroke-linejoin="round" opacity=".95"/>
  <path d="M59 6 L52 38 L66 52 L48 74 L62 92 L54 120" stroke="var(--key)" stroke-width="7"
        stroke-linejoin="round" opacity=".12"/>
  <path d="M30 40 a34 34 0 0 0 0 46" stroke="var(--key)" stroke-width="1.5" opacity=".5"/>
  <path d="M16 28 a52 52 0 0 0 0 70" stroke="var(--key)" stroke-width="1.2" opacity=".28"/>
  <path d="M88 40 a34 34 0 0 1 0 46" stroke="var(--key)" stroke-width="1.5" opacity=".5"/>
  <path d="M102 28 a52 52 0 0 1 0 70" stroke="var(--key)" stroke-width="1.2" opacity=".28"/>
</svg>`;

export default function make({ fx, audio }) {
  const prng = fx.rnd(3307);
  const reduced = !!fx.reducedMotion;
  let L = null, geo = null;
  let live = false, toneAcc = 0;

  // five presences on the floor. Each one swells and falls on its own slow cycle;
  // whichever is loudest at a given moment is the one holding the room.
  const ghosts = [];
  for (let i = 0; i < 6; i++) {
    ghosts.push({ i, ph: prng() * 7, sp: 0.00052 + prng() * 0.0006, amp: 0.4 + prng() * 0.6, act: 0 });
  }
  const modes = [
    { k: 1, a: 1.0, w: 0.0017, ph: 0 },
    { k: 2, a: 0.42, w: 0.0029, ph: 1.7 },
    { k: 3, a: 0.26, w: 0.0043, ph: 3.1 },
    { k: 5, a: 0.13, w: 0.0071, ph: 5.2 },
  ];

  return {
    pal: {
      ink: '#060A14', stone: '#242C3E', stoneDark: '#05070E',
      key: '#3BE8B0', cone: '#B9CEFF', dust: '#CBD9F2',
    },
    takeHz: 330,
    take: {
      label: 'speak into the crack',
      host: 'discord.gg',
      art: CRACK,
      pos: { left: '50%', top: '68%' },
    },
    ui: `
      <div class="nt" style="left:26px;bottom:120px">
        <b>acoustic · live</b>
        rt60 ≈ 4.2 s<br>
        <em>the room answers back</em>
      </div>
      <div class="nt nt--r" style="right:26px;bottom:120px">
        <b>in voice · 06</b>
        count unverified<br>
        <em>presence inferred from sound</em>
      </div>`,

    init(env) { geo = env.geo; L = env.layer(3); },

    onLanded() {
      live = true;
      audio.tone(110, { dur: 1.6, type: 'triangle', gain: 0.08, slideTo: 164 });
    },

    update(dt, t) {
      if (!L) return;
      const g = geo();
      const c = L.ctx2d;
      c.clearRect(0, 0, g.w, g.h);
      const T = reduced ? 8000 : t;

      const x0 = g.left + 54, x1 = g.right - 54, span = x1 - x0;
      const cy = g.mouthY + (g.floorY - g.mouthY) * 0.46;

      // who is holding the room right now
      let loud = 0, loudI = 0;
      for (const gh of ghosts) {
        gh.act = Math.max(0, Math.sin(T * gh.sp + gh.ph)) ** 2 * gh.amp;
        if (gh.act > loud) { loud = gh.act; loudI = gh.i; }
      }
      const drive = 0.3 + loud * 0.85;

      // --- the standing wave
      const A = (g.floorY - g.mouthY) * 0.23 * drive;
      const wave = (x) => {
        const u = (x - x0) / span;
        let y = 0;
        for (const m of modes) y += m.a * Math.sin(m.k * Math.PI * u) * Math.sin(T * m.w + m.ph);
        return cy + y * A;
      };

      for (const pass of [{ lw: 9, a: 0.07 }, { lw: 3.2, a: 0.22 }, { lw: 1.4, a: 0.95 }]) {
        c.strokeStyle = rgba('#3BE8B0', pass.a);
        c.lineWidth = pass.lw;
        c.beginPath();
        for (let x = x0; x <= x1; x += 3) {
          const y = wave(x);
          x === x0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.stroke();
      }
      // its shadow, a half beat behind
      c.strokeStyle = rgba('#F2EDE2', 0.09);
      c.lineWidth = 1;
      c.beginPath();
      for (let x = x0; x <= x1; x += 4) {
        const u = (x - x0) / span;
        let y = 0;
        for (const m of modes) y += m.a * Math.sin(m.k * Math.PI * u) * Math.sin(T * m.w + m.ph - 0.5);
        const yy = cy - y * A * 0.5;
        x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
      }
      c.stroke();

      // --- nodes: where the wave is pinned. Measured off a rule near the ceiling.
      const ruleY = g.mouthY + 78;
      c.font = MONO(8.5, 500);
      c.textAlign = 'center';
      c.strokeStyle = rgba('#F2EDE2', 0.16);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(x0, ruleY); c.lineTo(x1, ruleY); c.stroke();
      for (let k = 0; k <= 4; k++) {
        const x = x0 + (span * k) / 4;
        c.strokeStyle = rgba('#F2EDE2', 0.22);
        c.beginPath(); c.moveTo(x, ruleY - 6); c.lineTo(x, ruleY + 6); c.stroke();
        c.fillStyle = rgba('#F2EDE2', 0.34);
        tracked(c, (82 * (k + 1)) + ' HZ', x, ruleY - 13, { track: 1.6, align: 'center' });
        // the node line, dropped to the floor
        c.strokeStyle = rgba('#F2EDE2', 0.07);
        c.setLineDash([2, 10]);
        c.beginPath(); c.moveTo(x, ruleY + 8); c.lineTo(x, g.floorY); c.stroke();
        c.setLineDash([]);
      }
      c.strokeStyle = rgba('#F2EDE2', 0.12);
      c.setLineDash([4, 8]);
      c.beginPath(); c.moveTo(x0, cy); c.lineTo(x1, cy); c.stroke();
      c.setLineDash([]);

      // --- presences
      const fh = g.floorY;
      for (const gh of ghosts) {
        const x = x0 + span * ((gh.i + 0.5) / ghosts.length);
        const on = gh.i === loudI;
        const a = 0.16 + gh.act * 0.55;
        const top = fh - 150 - gh.act * 70;
        const col = on ? '#3BE8B0' : '#F2EDE2';

        for (const band of [{ w: 30, m: 0.3 }, { w: 17, m: 0.55 }, { w: 6, m: 1 }]) {
          const cg = c.createLinearGradient(0, top, 0, fh);
          cg.addColorStop(0, rgba(col, 0));
          cg.addColorStop(1, rgba(col, a * 0.5 * band.m));
          c.fillStyle = cg;
          c.fillRect(x - band.w / 2, top, band.w, fh - top);
        }

        c.strokeStyle = rgba(col, 0.2 + gh.act * 0.6);
        c.lineWidth = on ? 1.6 : 1;
        c.beginPath();
        c.ellipse(x, fh + 4, 26 + gh.act * 26, (26 + gh.act * 26) * 0.26, 0, 0, Math.PI * 2);
        c.stroke();
        if (gh.act > 0.25) {
          c.strokeStyle = rgba(col, (gh.act - 0.25) * 0.4);
          c.beginPath();
          c.ellipse(x, fh + 4, 50 + gh.act * 60, (50 + gh.act * 60) * 0.26, 0, 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = rgba(col, 0.25 + gh.act * 0.7);
        c.fillRect(x - 1, top - 10, 2, 10);

        c.font = MONO(8, 500);
        c.fillStyle = rgba(col, on ? 0.85 : 0.32);
        tracked(c, on ? 'SPEAKING' : 'IDLE', x, fh + 26, { track: 1.5, align: 'center' });
      }

      // --- the room answers: a tone when the speaker changes
      if (live && !reduced) {
        toneAcc += dt;
        if (toneAcc > 4200) {
          toneAcc = 0;
          audio.tone(82 * (1 + loudI), { dur: 0.5, type: 'sine', gain: 0.05 });
        }
      }

      // --- readout
      c.textAlign = 'left';
      c.font = MONO(9, 500);
      c.fillStyle = rgba('#3BE8B0', 0.5);
      tracked(c, 'STANDING WAVE · MODE ' + (loudI + 1) + ' DOMINANT', x0, g.mouthY + 46, { track: 2.2 });
      c.strokeStyle = rgba('#3BE8B0', 0.18);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x0, g.mouthY + 54); c.lineTo(x0 + 240, g.mouthY + 54); c.stroke();
      c.fillStyle = rgba(blend('#3BE8B0', '#F2EDE2', 0.5), 0.3);
    },

    dispose() { L = null; geo = null; },
  };
}
