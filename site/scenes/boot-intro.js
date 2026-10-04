// boot-intro — the title sequence.
//
// A performance cut on beats, not a loading screen. Everything is authored into a
// millisecond timeline (BEATS + CUES) that `update(dt)` walks; nothing animates by
// CSS transition. Two canvas layers: L0 is the world, L1 is the stage frame.
//
// The spine:  a survey line in the dark  ->  a sun slams up over the Negev  ->
// seven marks are struck into hot sand  ->  the marks fall open into seven holes  ->
// 7 WELLS  ->  באר שבע, glossed WELL / SEVEN (the name IS the place)  ->  water  ->
// and then the camera drops into the ground and hands off to the surface.

const EASE = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outBack: (t) => 1 + 2.3 * Math.pow(t - 1, 3) + 1.3 * Math.pow(t - 1, 2),
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
// 0..1 ramp between two absolute times inside a beat
const seg = (t, a, b) => clamp01((t - a) / Math.max(1, b - a));

// hex colour mix, for the mark -> hole morph
function mix(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',') + ')';
}

// ---------------------------------------------------------------- scene state
let S = null;

const FULL = [
  { at: 0,    name: 'survey', dur: 800 },   // deep/night/bone   — a line in the dark
  { at: 800,  name: 'sun',    dur: 900 },   // night/rust/sand   — the sun slams up
  { at: 1700, name: 'seven',  dur: 1250 },  // sand/rust/bone    — seven marks struck
  { at: 2950, name: 'holes',  dur: 850 },   // sand/deep/bone    — the marks fall open
  { at: 3800, name: 'title',  dur: 820 },   // deep/bone/sand    — 7 WELLS
  { at: 4620, name: 'word',   dur: 1650 },  // deep/bone/sand    — באר שבע = WELL / SEVEN
  { at: 6270, name: 'water',  dur: 480 },   // deep/bone/water   — something is down there
  { at: 6750, name: 'down',   dur: 840 },   // deep              — the drop
];
const STAMP_T0 = 140, STAMP_GAP = 78, STAMP_DUR = 130;
const SHORT = [
  { at: 0,    name: 'word',  dur: 820 },
  { at: 820,  name: 'water', dur: 300 },
  { at: 1120, name: 'down',  dur: 540 },
];
const STILL = [{ name: 'word', at: 0, dur: 1500 }];

function cssv(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// =============================================================== drawing parts

// The assembled title card. Every late beat renders through this one function so
// the camera drop can simply transform it.
function drawCard(c, o) {
  const { W, H, COL } = S;
  const bone = COL.bone;

  // ---- 7 WELLS -------------------------------------------------------------
  const s7 = H * 0.56;
  const sw = H * 0.225;
  c.textBaseline = 'middle';
  c.textAlign = 'left';

  c.font = s7 + "px 'Anton', 'Arial Narrow', Impact, sans-serif";
  const w7 = c.measureText('7').width;
  c.font = sw + "px 'Anton', 'Arial Narrow', Impact, sans-serif";
  const ww = c.measureText('WELLS').width;

  const gap = H * 0.05;
  const x0 = (W - (w7 + gap + ww)) / 2;
  const ty = o.titleY;

  const a = EASE.outQuint(clamp01(o.titleIn / 0.62));
  const b = EASE.outQuint(clamp01((o.titleIn - 0.22) / 0.62));

  // the hero numeral
  c.save();
  c.globalAlpha = a;
  c.translate((1 - a) * -W * 0.9, 0);
  c.font = s7 + "px 'Anton', 'Arial Narrow', Impact, sans-serif";
  c.fillStyle = bone;
  c.fillText('7', x0, ty);
  if (o.water > 0) {
    // the moment something is found: the 7 fills with water
    c.globalAlpha = a * o.water;
    c.fillStyle = COL.water;
    c.fillText('7', x0, ty);
  }
  c.restore();

  c.save();
  c.globalAlpha = b;
  c.translate((1 - b) * W * 0.95, 0);
  c.font = sw + "px 'Anton', 'Arial Narrow', Impact, sans-serif";
  c.fillStyle = bone;
  c.fillText('WELLS', x0 + w7 + gap, ty);
  // sand rule riding under the word
  c.fillStyle = COL.sand;
  c.fillRect(x0 + w7 + gap, ty + sw * 0.62, ww * b, Math.max(2, H * 0.006));
  c.restore();

  // ---- seven rings, a quiet echo of the field ------------------------------
  if (o.rings > 0) {
    const r = H * 0.017;
    c.save();
    c.globalAlpha = 0.55 * o.rings;
    c.strokeStyle = bone;
    c.lineWidth = Math.max(1.5, H * 0.0028);
    for (let i = 0; i < 7; i++) {
      const x = W * 0.5 + (i - 3) * H * 0.072;
      c.beginPath();
      c.ellipse(x, H * 0.84, r, r * 0.52, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  // ---- באר שבע -------------------------------------------------------------
  if (o.hebIn > 0) {
    const sh = H * 0.145;
    const e = EASE.outQuint(o.hebIn);
    const hy = ty + H * 0.265;
    c.save();
    c.globalAlpha = clamp01(o.hebIn * 1.6);
    c.translate(0, (1 - e) * H * 0.42);
    c.font = "900 " + sh + "px 'Heebo', 'Arial Hebrew', sans-serif";
    // visual (left-to-right) order of "באר שבע" is שבע then באר
    const wSheva = c.measureText('שבע').width;
    const wBeer = c.measureText('באר').width;
    const hgap = H * 0.055;
    const hx0 = (W - (wSheva + hgap + wBeer)) / 2;
    c.fillStyle = bone;
    c.textAlign = 'left';
    c.fillText('שבע', hx0, hy);
    c.fillText('באר', hx0 + wSheva + hgap, hy);

    // ---- the gloss: this is the whole idea ---------------------------------
    if (o.glossIn > 0) {
      const g = EASE.outCubic(o.glossIn);
      const top = hy + sh * 0.56;
      const len = H * 0.062 * g;
      const pairs = [
        [hx0 + wSheva / 2, 'SEVEN'],
        [hx0 + wSheva + hgap + wBeer / 2, 'WELL'],
      ];
      c.strokeStyle = COL.sand;
      c.lineWidth = Math.max(1.5, H * 0.0024);
      c.fillStyle = COL.sand;
      c.textAlign = 'center';
      c.font = "600 " + Math.round(H * 0.026) + "px 'IBM Plex Mono', monospace";
      try { c.letterSpacing = '0.26em'; } catch {}
      for (const [px, label] of pairs) {
        c.beginPath();
        c.moveTo(px, top);
        c.lineTo(px, top + len);
        c.stroke();
        if (g > 0.75) {
          c.globalAlpha = clamp01((g - 0.75) * 4) * clamp01(o.hebIn * 1.6);
          c.fillText(label, px, top + H * 0.088);
          c.globalAlpha = clamp01(o.hebIn * 1.6);
        }
      }
      try { c.letterSpacing = '0px'; } catch {}
    }
    c.restore();
  }

  // ---- survey footer -------------------------------------------------------
  if (o.labelIn > 0) {
    c.save();
    c.globalAlpha = 0.5 * o.labelIn;
    c.fillStyle = bone;
    c.textAlign = 'center';
    c.font = "500 " + Math.round(H * 0.0135) + "px 'IBM Plex Mono', monospace";
    try { c.letterSpacing = '0.34em'; } catch {}
    c.fillText("BE'ER SHEVA · NEGEV · 31°15'N 34°47'E", W / 2, H * 0.945);
    try { c.letterSpacing = '0px'; } catch {}
    c.restore();
  }
}

// One of the seven: a struck mark that later falls open into a hole.
function drawMark(c, i, appear, morph, opt) {
  const { W, H, COL, marks } = S;
  const m = marks[i];
  const from = opt.from, to = opt.to, ink = opt.ink, rim = opt.rim;
  const mo = EASE.inOutCubic(morph);
  const ap = EASE.outQuint(clamp01(appear));
  if (ap <= 0) return;

  const cx = lerp(W * m.sx, W * m.hx, mo);
  const cy = lerp(H * 0.5, H * m.hy, mo);
  const bw = lerp(W * 0.05, W * m.r * 2.0, mo);
  const bh = lerp(H * 0.46, W * m.r * 1.5, mo);
  const rad = lerp(Math.max(1, W * 0.004), Math.min(bw, bh) / 2, mo);
  const k = lerp(1.32, 1, ap); // the strike overshoot

  c.save();
  c.globalAlpha = ap;
  c.translate(cx, cy);
  c.rotate(m.rot * (1 - mo));
  c.scale(k, lerp(1.5, 1, ap));
  c.fillStyle = from === to ? from : mix(from, to, clamp01(mo * 1.25));
  c.beginPath();
  if (c.roundRect) c.roundRect(-bw / 2, -bh / 2, bw, bh, rad);
  else c.rect(-bw / 2, -bh / 2, bw, bh);
  c.fill();
  if (rim && mo > 0.35) {
    c.globalAlpha = ap * clamp01((mo - 0.35) * 2.6);
    c.strokeStyle = rim;
    c.lineWidth = Math.max(2, H * 0.005);
    c.stroke();
  }
  c.restore();

  // the index, surveyed
  if (ap > 0.6) {
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = "600 " + Math.round(H * 0.017) + "px 'IBM Plex Mono', monospace";
    c.fillText('0' + (i + 1), cx, cy + bh * 0.5 + H * 0.05);
    c.restore();
  }
}

// =============================================================== the beat render
function render() {
  const { L0, L1, W, H, COL } = S;
  const c = L0.ctx2d;
  c.clearRect(0, 0, W, H);
  c.textBaseline = 'middle';

  const beat = S.beat;
  const t = S.T - beat.at;         // ms inside this beat
  const p = clamp01(t / beat.dur); // 0..1
  const still = S.mode === 'still';
  let bars = S.barsOn ? H * 0.036 : 0;

  const horizon = H * 0.62;

  switch (beat.name) {
    // --------------------------------------------------- a line in the dark
    case 'survey': {
      c.fillStyle = COL.deep;
      c.fillRect(0, 0, W, H);
      c.fillStyle = COL.night2;
      c.fillRect(0, horizon, W, H - horizon);

      const g = EASE.outQuint(seg(t, 0, 520));
      c.fillStyle = COL.bone;
      c.fillRect(0, horizon - 2, W * g, Math.max(3, H * 0.0042));
      // seven survey ticks, struck on the line, exactly where the marks will land
      c.textAlign = 'center';
      c.font = "500 " + Math.round(H * 0.014) + "px 'IBM Plex Mono', monospace";
      for (let i = 0; i < 7; i++) {
        const x = W * S.marks[i].sx;
        if (W * g < x) continue;
        c.globalAlpha = 0.85;
        c.fillRect(x - 1, horizon - H * 0.032, Math.max(2, H * 0.0026), H * 0.032);
        c.globalAlpha = 0.5;
        c.fillText('0' + (i + 1), x, horizon - H * 0.046);
      }
      c.globalAlpha = 0.85 * seg(t, 260, 640);
      c.textAlign = 'left';
      c.font = "500 " + Math.round(H * 0.019) + "px 'IBM Plex Mono', monospace";
      try { c.letterSpacing = '0.3em'; } catch {}
      c.fillText("31°15'N  34°47'E", W * 0.055, horizon + H * 0.06);
      try { c.letterSpacing = '0px'; } catch {}
      c.globalAlpha = 1;
      bars = 0;
      break;
    }

    // --------------------------------------------------------- the sun slams
    case 'sun': {
      c.fillStyle = COL.night;
      c.fillRect(0, 0, W, H);
      const rise = EASE.outBack(seg(t, 0, 430));
      const R = H * 0.6;                              // taller than the frame
      const cy = horizon + R - (R * 1.5) * rise;
      c.fillStyle = COL.sand;
      c.beginPath();
      c.arc(W * 0.5, cy, R, 0, Math.PI * 2);
      c.fill();
      // hot ground swallows the lower half of the disc
      c.fillStyle = COL.rust;
      c.fillRect(0, horizon, W, H - horizon);
      c.fillStyle = COL.bone;
      c.fillRect(0, horizon - 1, W, Math.max(2, H * 0.003));
      // heat bands lying on the ground
      c.globalAlpha = 0.28 * seg(t, 300, 700);
      for (let i = 0; i < 5; i++) {
        const y = horizon + H * (0.05 + i * 0.062);
        c.fillStyle = COL.sand;
        c.fillRect(W * (0.08 + i * 0.03), y, W * (0.84 - i * 0.14), Math.max(1.5, H * 0.004));
      }
      c.globalAlpha = 1;
      break;
    }

    // ------------------------------------------------ seven marks, hot sand
    case 'seven': {
      c.fillStyle = COL.sand;
      c.fillRect(0, 0, W, H);
      // one enormous rust wedge sweeping the whole frame
      const q = EASE.outQuint(seg(t, 0, 300));
      const ex = -W * 0.35 + W * 1.4 * q;   // stops short: a sand wedge survives bottom-right
      c.fillStyle = COL.rust;
      c.beginPath();
      c.moveTo(-W * 0.4, -H * 0.1);
      c.lineTo(ex, -H * 0.1);
      c.lineTo(ex - H * 0.62, H * 1.1);
      c.lineTo(-W * 0.4, H * 1.1);
      c.closePath();
      c.fill();
      const ms = { from: COL.bone, to: COL.deep, ink: COL.bone, rim: null };
      for (let i = 0; i < 7; i++) {
        const a0 = STAMP_T0 + i * STAMP_GAP;
        drawMark(c, i, seg(t, a0, a0 + STAMP_DUR), 0, ms);
      }
      break;
    }

    // ------------------------------------------ the marks fall open: 7 holes
    case 'holes': {
      // hard cut: flat sand seen from above, and the marks fall open
      c.fillStyle = COL.sand;
      c.fillRect(0, 0, W, H);
      const mo = seg(t, 30, 420);
      const mh = { from: COL.deep, to: COL.deep, ink: COL.deep, rim: COL.bone };
      for (let i = 0; i < 7; i++) drawMark(c, i, 1, mo, mh);
      break;
    }

    // -------------------------------------------------------------- 7 WELLS
    case 'title': {
      c.fillStyle = COL.deep;
      c.fillRect(0, 0, W, H);
      drawCard(c, {
        titleIn: seg(t, 0, 420),
        titleY: H * 0.5,
        hebIn: 0, glossIn: 0, labelIn: 0, water: 0,
        rings: seg(t, 420, 740),
      });
      break;
    }

    // ------------------------------------- באר שבע : the name IS the place
    case 'word': {
      c.fillStyle = COL.deep;
      c.fillRect(0, 0, W, H);
      const d = beat.dur;
      drawCard(c, {
        titleIn: still ? 1 : S.mode === 'short' ? seg(t, 0, 320) : 1,
        titleY: still || S.mode === 'short'
          ? H * 0.355
          : lerp(H * 0.5, H * 0.355, EASE.outQuint(seg(t, 0, 260))),
        hebIn: still ? 1 : seg(t, d * 0.1, d * 0.1 + 300),
        glossIn: still ? 1 : seg(t, d * 0.34, d * 0.34 + 460),
        labelIn: still ? 1 : seg(t, d * 0.62, d * 0.62 + 400),
        water: 0,
        rings: 0,
      });
      break;
    }

    // -------------------------------------------------- something is found
    case 'water': {
      c.fillStyle = COL.deep;
      c.fillRect(0, 0, W, H);
      drawCard(c, S.card(seg(t, beat.dur * 0.55, beat.dur * 0.78)));
      const fall = EASE.inCubic(seg(t, 0, beat.dur * 0.55));
      const hitY = H * 0.78;
      if (fall < 1) {
        const y = lerp(-H * 0.06, hitY, fall);
        const ry = H * 0.022 * (1 + fall * 1.8);
        c.fillStyle = COL.water;
        c.globalAlpha = 0.28;
        c.fillRect(W * 0.5 - H * 0.004, y - ry * 7, H * 0.008, ry * 7);
        c.globalAlpha = 1;
        c.beginPath();
        c.ellipse(W * 0.5, y, H * 0.013, ry, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        const r = EASE.outQuint(seg(t, beat.dur * 0.55, beat.dur));
        c.strokeStyle = COL.water;
        c.globalAlpha = 1 - r;
        for (let i = 0; i < 3; i++) {
          const rr = (W * 0.45) * r - i * W * 0.05;
          if (rr <= 0) continue;
          c.lineWidth = Math.max(1, H * 0.006 * (1 - r));
          c.beginPath();
          c.ellipse(W * 0.5, hitY, rr, rr * 0.3, 0, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      break;
    }

    // --------------------------------------------------------- and then down
    case 'down': {
      const e = EASE.inCubic(p);
      c.fillStyle = COL.deep;
      c.fillRect(0, 0, W, H);

      // the card rides up and away
      const lift = clamp01(p / 0.55);
      c.save();
      c.translate(W / 2, H / 2);
      c.scale(1 + lift * 0.4, 1 + lift * 0.4);
      c.translate(-W / 2, -H / 2 - EASE.inCubic(lift) * H * 2.0);
      drawCard(c, S.card(1));
      c.restore();

      // the mouth of a well rushes up and swallows the frame — one giant flat shape
      const sw = EASE.inCubic(clamp01(p / 0.62));
      const my = lerp(H * 1.35, H * 0.46, sw);
      const mrx = lerp(W * 0.1, W * 1.9, sw);
      const mry = mrx * lerp(0.34, 0.9, sw);
      c.fillStyle = COL.deep;
      c.beginPath();
      c.ellipse(W * 0.5, my, mrx, mry, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = COL.bone;
      c.globalAlpha = 0.8 * (1 - sw * 0.75);
      c.lineWidth = Math.max(3, H * 0.011 * (1 + sw * 2));
      c.stroke();
      c.globalAlpha = 1;

      // inside the shaft: chalk striations tearing upward past the camera
      if (p > 0.26) {
        const d = clamp01((p - 0.26) / 0.46);
        c.save();
        c.globalAlpha = d;
        c.fillStyle = COL.deep;
        c.fillRect(0, 0, W, H);

        // earth walls — dried clay either side, void down the middle
        const bandW = W * 0.27;
        const clay = mix(COL.deep, COL.rust, 0.55);
        const gl = c.createLinearGradient(0, 0, bandW, 0);
        gl.addColorStop(0, clay); gl.addColorStop(1, COL.deep);
        c.fillStyle = gl; c.fillRect(0, 0, bandW, H);
        const gr = c.createLinearGradient(W, 0, W - bandW, 0);
        gr.addColorStop(0, clay); gr.addColorStop(1, COL.deep);
        c.fillStyle = gr; c.fillRect(W - bandW, 0, bandW, H);

        // chalk striations tearing upward past the camera
        c.fillStyle = COL.bone;
        const scroll = e * e * H * 6.5;
        for (let i = 0; i < 26; i++) {
          let y = (i * (H / 13) - scroll) % H;
          if (y < 0) y += H;
          const th = Math.max(2, H * 0.0035 * (1 + (i % 3)));
          c.globalAlpha = d * (0.09 + (i % 4) * 0.05);
          c.fillRect(0, y, bandW * (0.45 + ((i * 7) % 5) / 7), th);
          let y2 = (y + H * 0.41) % H;
          c.fillRect(W - bandW * (0.45 + ((i * 11) % 5) / 7), y2, bandW, th);
        }

        // the mouth of the well, receding far above
        const m = clamp01(d * 1.1);
        c.globalAlpha = (1 - m) * 0.75 * d;
        c.strokeStyle = COL.bone;
        c.lineWidth = Math.max(2, H * 0.008 * (1 - m * 0.6));
        c.beginPath();
        c.ellipse(W * 0.5, lerp(H * 0.26, -H * 0.3, m), W * 0.42 * (1 - m * 0.9), W * 0.12 * (1 - m * 0.9), 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      // iris shut — the hard cut into the ground
      bars = lerp(H * 0.036, H * 0.54, clamp01((p - 0.74) / 0.26));
      break;
    }
  }

  // ---- stage frame ---------------------------------------------------------
  // The overlay only changes when the letterbox moves, so it is not repainted
  // every frame: that keeps the per-frame cost to one full-screen canvas.
  if (bars !== S.lastBars || W !== S.lastW || H !== S.lastH) {
    S.lastBars = bars; S.lastW = W; S.lastH = H;
    const o = L1.ctx2d;
    o.clearRect(0, 0, W, H);
    if (bars > 0.5) {
      o.fillStyle = COL.deep;
      o.fillRect(0, 0, W, bars);
      o.fillRect(0, H - bars, W, bars);
    }
    // vignette: keeps the flat shapes from feeling like a web page
    const vg = o.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    o.fillStyle = vg;
    o.fillRect(0, 0, W, H);
  }
}

// ===================================================================== scene
export default {
  id: 'boot-intro',

  enter(ctx) {
    const fx = ctx.fx;
    const RM = !!fx.reducedMotion;
    const seen = !!ctx.store.get('intro.seen', false);
    const mode = RM ? 'still' : seen ? 'short' : 'full';
    const beats = RM ? STILL : seen ? SHORT : FULL;

    const mk = (z) => {
      let L;
      try { L = fx.layer(ctx.root, z); } catch { L = fx.layer(z); }
      if (L && L.canvas && L.canvas.parentNode !== ctx.root) ctx.root.appendChild(L.canvas);
      return L;
    };
    const L0 = mk(1);
    const L1 = mk(2);

    // Hand-placed, not random: the field has to read as seven separate holes.
    const FIELD = [
      [0.155, 0.34, 0.042], [0.335, 0.72, 0.032], [0.470, 0.27, 0.036],
      [0.630, 0.60, 0.045], [0.745, 0.29, 0.029], [0.880, 0.56, 0.039],
      [0.545, 0.85, 0.034],
    ];
    const R = fx.rnd(0xbe7);
    const marks = FIELD.map((f, i) => ({
      sx: 0.5 + (i - 3) * 0.118,
      hx: f[0], hy: f[1], r: f[2],
      rot: (R() - 0.5) * 0.2,
    }));

    S = {
      ctx, fx, RM, mode, beats, marks, L0, L1,
      T: 0,
      done: false,
      barsOn: false,
      beat: beats[0],
      bi: 0,
      offs: [],
      timers: [],
      COL: {
        night: cssv('--night', '#0B0E1A'),
        night2: cssv('--night-2', '#141A2E'),
        deep: cssv('--deep', '#050710'),
        bone: cssv('--bone', '#F2EDE2'),
        sand: cssv('--sand', '#E8873A'),
        rust: cssv('--rust', '#B8341F'),
        water: cssv('--water', '#3BE8B0'),
      },
      get W() { return L0.w || window.innerWidth; },
      get H() { return L0.h || window.innerHeight; },
      // the finished card, reused by water/down
      card: (water) => ({
        titleIn: 1, titleY: S.H * 0.355,
        hebIn: 1, glossIn: 1, labelIn: 1,
        water: water === undefined ? 0 : clamp01(water),
        rings: 0,
      }),
    };

    // ---- the tiny skip ------------------------------------------------------
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'skip';
    skip.setAttribute('aria-label', 'skip intro');
    skip.style.cssText =
      'position:absolute;left:18px;bottom:16px;z-index:12;background:none;border:0;padding:6px;' +
      'color:var(--bone);font-family:var(--font-mono);font-size:9px;letter-spacing:.3em;' +
      'text-transform:uppercase;opacity:.4;cursor:none;transition:opacity 180ms';
    skip.addEventListener('mouseenter', () => { skip.style.opacity = '1'; });
    skip.addEventListener('mouseleave', () => { skip.style.opacity = '.4'; });
    ctx.root.appendChild(skip);
    S.skip = skip;

    const finish = () => {
      if (S.done) return;
      S.done = true;
      try { ctx.store.set('intro.seen', true); } catch {}
      try { ctx.go('surface', { from: 'boot-intro' }); } catch (e) { console.warn('[intro] handoff', e); }
    };
    S.finish = finish;

    const bail = (e) => {
      if (S.done) return;
      if (e) { try { e.preventDefault(); } catch {} }
      // instant: no fade, no flash, nothing left running
      try { S.audioStop && S.audioStop(); } catch {}
      finish();
    };
    S.bail = bail;

    const onKey = (e) => { if (!e.repeat) bail(e); };
    const onDown = (e) => bail(e);
    window.addEventListener('keydown', onKey, true);
    ctx.root.addEventListener('pointerdown', onDown);
    skip.addEventListener('click', onDown);
    S.offs.push(() => window.removeEventListener('keydown', onKey, true));
    S.offs.push(() => ctx.root.removeEventListener('pointerdown', onDown));

    // ---- audio cues (silent when muted, which is the default) ---------------
    const A = ctx.audio;
    const CUES = RM ? [] : mode === 'short' ? [
      { at: 10,   fn: () => A.tone(180, { dur: 0.5, type: 'triangle', gain: 0.12, slideTo: 300 }) },
      { at: 830,  fn: () => A.drip({ pitch: 1.1 }) },
      { at: 1130, fn: () => { A.thud({ gain: 0.5 }); A.tone(240, { dur: 0.6, type: 'sine', gain: 0.12, slideTo: 60 }); } },
    ] : [
      { at: 20,   fn: () => A.tone(48, { dur: 1.1, type: 'sine', gain: 0.1, slideTo: 96 }) },
      { at: 800,  fn: () => { A.noise({ dur: 0.7, gain: 0.1, band: [300, 2600] }); A.tone(140, { dur: 0.7, type: 'triangle', gain: 0.1, slideTo: 300 }); } },
      { at: 1700, fn: () => A.noise({ dur: 0.25, gain: 0.14, band: [700, 5000] }) },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        at: 1700 + STAMP_T0 + i * STAMP_GAP,
        fn: () => { A.thud({ gain: 0.14 + i * 0.018 }); A.tone(200 + i * 42, { dur: 0.1, type: 'square', gain: 0.045 }); },
      })),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({
        at: 3010 + i * 72,
        fn: () => A.drip({ pitch: 1.5 - i * 0.12 }),
      })),
      { at: 3800, fn: () => { A.thud({ gain: 0.42 }); A.tone(320, { dur: 0.3, type: 'triangle', gain: 0.1, slideTo: 160 }); } },
      { at: 4790, fn: () => { A.thud({ gain: 0.34 }); A.tone(196, { dur: 0.45, type: 'sine', gain: 0.1, slideTo: 262 }); } },
      { at: 5180, fn: () => A.tone(392, { dur: 0.5, type: 'sine', gain: 0.07 }) },
      { at: 6270, fn: () => A.drip({ pitch: 1 }) },
      { at: 6540, fn: () => A.drip({ pitch: 0.7 }) },
      { at: 6750, fn: () => { A.thud({ gain: 0.6 }); A.tone(300, { dur: 0.85, type: 'sine', gain: 0.14, slideTo: 44 }); A.noise({ dur: 0.8, gain: 0.08, band: [80, 900] }); } },
    ];

    // ---- visual cues: hard cuts, hits, the stage frame ----------------------
    const VIS = RM ? [] : mode === 'short' ? [
      { at: 0,    fn: () => { S.barsOn = true; } },
      { at: 1120, fn: () => fx.shake(420, 9) },
    ] : [
      { at: 800,  fn: () => { S.barsOn = true; fx.shake(260, 10); } },
      { at: 1700, fn: () => fx.shake(180, 7) },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ at: 1700 + STAMP_T0 + i * STAMP_GAP, fn: () => fx.shake(80, 3 + i * 0.7) })),
      { at: 2950, fn: () => fx.shake(200, 9) },
      // no full-screen flashes: this sequence cuts, it does not blink
      { at: 3800, fn: () => fx.shake(300, 13) },
      { at: 4780, fn: () => fx.shake(220, 8) },
      { at: 6750, fn: () => fx.shake(640, 15) },
    ];

    S.cues = [...CUES, ...VIS].sort((a, b) => a.at - b.at).map((q) => ({ ...q, fired: false }));
    S.END = beats[beats.length - 1].at + beats[beats.length - 1].dur + (RM ? 60 : 40);

    // Canvas text needs the webfonts; we repaint every frame so they just swap in.
    try { if (document.fonts) document.fonts.ready.then(() => {}); } catch {}

    render();
  },

  update(dt) {
    if (!S || S.done) return;
    S.T += dt;

    for (let i = 0; i < S.cues.length; i++) {
      const q = S.cues[i];
      if (!q.fired && S.T >= q.at) { q.fired = true; try { q.fn(); } catch {} }
    }

    // advance the beat
    while (S.bi < S.beats.length - 1 && S.T >= S.beats[S.bi + 1].at) S.bi++;
    S.beat = S.beats[S.bi];

    if (S.T >= S.END) { S.finish(); return; }

    try { render(); } catch (e) { console.warn('[intro] render', e); }
  },

  resize() {
    if (!S || S.done) return;
    try { render(); } catch {}
  },

  exit() {
    if (!S) return;
    const s = S;
    S = null;
    try { s.offs.forEach((off) => off()); } catch {}
    try { s.timers.forEach((id) => clearTimeout(id)); } catch {}
    try { s.skip && s.skip.remove(); } catch {}
    try { s.L0 && s.L0.destroy && s.L0.destroy(); } catch {}
    try { s.L1 && s.L1.destroy && s.L1.destroy(); } catch {}
  },
};
