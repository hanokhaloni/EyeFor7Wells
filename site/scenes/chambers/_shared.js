// Shared drawing kit for the chambers. Owned by [CHAMBERS].
// Pure canvas helpers — no DOM, no state. chamber.js and every room import from here,
// which keeps the frame and the rooms on exactly the same ruler.

export const MIN_D = 9;
export const MAX_D = 70;

// 0 at the shallowest well, 1 at the deepest.
export const depthT = (d) => Math.max(0, Math.min(1, ((d ?? 20) - MIN_D) / (MAX_D - MIN_D)));

// Night palette pieces the frame shares with the surface.
export const MOUTH = '#060403';
export const SAND = '#DEA668';

// The hole you fell through, seen from the floor: a flat sand disc high in the frame,
// big at 9 m, tiny at 70 m (geometric between the two along depthT).
export function holeOf(w, h, d) {
  const m = Math.min(w, h);
  const big = Math.max(20, Math.min(84, m * 0.075));
  const tiny = Math.max(4, Math.min(10, m * 0.009));
  const r = big * Math.pow(tiny / big, depthT(d));
  const y = Math.max(r + 14, Math.min(h * 0.085, 96));
  return { x: w / 2, y, r };
}

// Width of each hard wall band: the shaft narrows the deeper the well.
export const wallOf = (w, d) => Math.round(Math.max(10, Math.min(120, w * mix(0.035, 0.07, depthT(d)))));

// How much night-sky light still reaches this depth.
export const lightOf = (d) => {
  const t = depthT(d);
  return Math.max(0.05, Math.pow(1 - t, 1.9));
};

export const TAU = Math.PI * 2;

export const mix = (a, b, t) => a + (b - a) * t;

// --- colour -----------------------------------------------------------------
export function hex(c) {
  let s = c.replace('#', '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(c, a = 1) {
  const [r, g, b] = Array.isArray(c) ? c : hex(c);
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
export function blend(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${mix(A[0], B[0], t) | 0},${mix(A[1], B[1], t) | 0},${mix(A[2], B[2], t) | 0})`;
}
export function shade(c, t) { return blend(c, t < 0 ? '#000000' : '#ffffff', Math.abs(t)); }

// --- type -------------------------------------------------------------------
export const MONO = (px, w = 500) => `${w} ${px}px "IBM Plex Mono", ui-monospace, monospace`;
export const DISPLAY = (px) => `${px}px Anton, "Arial Narrow", Impact, sans-serif`;
export const HE = (px, w = 700) => `${w} ${px}px Heebo, "Arial Hebrew", sans-serif`;

// Letter-spaced text. Canvas has no tracking, so place each glyph by hand.
export function tracked(c, text, x, y, { track = 2, align = 'left' } = {}) {
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += c.measureText(ch).width + track;
  total -= track;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (const ch of chars) {
    c.fillText(ch, cx, y);
    cx += c.measureText(ch).width + track;
  }
  return total;
}

// --- hand-surveyed strokes --------------------------------------------------
// A chalk / scratch line: never straight, drawn in short wobbling segments.
export function rough(c, x1, y1, x2, y2, { jitter = 1.4, steps = 0, prng = Math.random } = {}) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const n = steps || Math.max(2, Math.round(len / 18));
  c.beginPath();
  c.moveTo(x1, y1);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : (prng() - 0.5) * jitter * 2;
    const nx = -dy / (len || 1), ny = dx / (len || 1);
    c.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j);
  }
  c.stroke();
}

export function roughRect(c, x, y, w, h, o = {}) {
  rough(c, x, y, x + w, y, o);
  rough(c, x + w, y, x + w, y + h, o);
  rough(c, x + w, y + h, x, y + h, o);
  rough(c, x, y + h, x, y, o);
}

// Speckle: cheap stone grain / dust in a rect.
export function speckle(c, x, y, w, h, { n = 400, prng = Math.random, color = '#000', a = 0.25, size = 1.4 } = {}) {
  c.fillStyle = rgba(color, a);
  for (let i = 0; i < n; i++) {
    const px = x + prng() * w, py = y + prng() * h;
    const s = 0.4 + prng() * size;
    c.fillRect(px, py, s, s);
  }
}

// --- stone ------------------------------------------------------------------
// A wall of courses. `lit` is the edge the light falls on: 'l' | 'r' | null.
export function stoneWall(c, x, y, w, h, {
  prng = Math.random, base = '#171410', dark = '#0A0806', light = 0.3,
  course = 46, lit = null, seam = 0.5,
} = {}) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();

  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, blend(base, dark, 0.15));
  g.addColorStop(1, dark);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);

  const rows = Math.ceil(h / course) + 1;
  for (let r = 0; r < rows; r++) {
    const ry = y + r * course;
    let bx = x - (r % 2 ? course * 1.2 : 0) - prng() * 20;
    while (bx < x + w) {
      const bw = course * (1.1 + prng() * 1.1);
      const t = (ry - y) / Math.max(1, h);
      const tone = blend(base, dark, 0.2 + t * 0.6 + (prng() - 0.5) * 0.22);
      c.fillStyle = tone;
      c.fillRect(bx + seam, ry + seam, bw - seam * 2, course - seam * 2);
      // top bevel catching whatever light there is
      c.fillStyle = rgba('#F2EDE2', 0.03 * light * (0.4 + prng() * 0.8));
      c.fillRect(bx + seam, ry + seam, bw - seam * 2, 1);
      bx += bw;
    }
  }
  speckle(c, x, y, w, h, { n: Math.round(w * h / 900), prng, color: '#000', a: 0.3, size: 1.8 });

  // rim light on the shaft-facing edge
  if (lit) {
    const ex = lit === 'l' ? x : x + w;
    const gg = c.createLinearGradient(ex, 0, ex + (lit === 'l' ? 26 : -26), 0);
    gg.addColorStop(0, rgba('#F2EDE2', 0.16 * light));
    gg.addColorStop(1, rgba('#F2EDE2', 0));
    c.fillStyle = gg;
    c.fillRect(lit === 'l' ? x : x + w - 26, y, 26, h);
  }
  c.restore();
}

// --- geometry ---------------------------------------------------------------
export function clipShaft(c, g, fn) {
  c.save();
  c.beginPath();
  c.rect(g.left, 0, g.right - g.left, g.floorY);
  c.clip();
  fn();
  c.restore();
}

export function ellipse(c, cx, cy, rx, ry) {
  c.beginPath();
  c.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.3, ry), 0, 0, TAU);
}
