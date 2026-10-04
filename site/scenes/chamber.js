// [CHAMBERS] The shared chamber frame.
//
// You arrive by falling. The shaft rushes, you land, dust lifts, and only then does the
// room resolve. Everything structural lives here — the stone funnel overhead, the circle
// of night sky you came from, the depth index, the way out — so that six very different
// rooms still read as one site. The per-well character lives in ./chambers/<id>.js and
// decorates this frame.

import { WELLS, byId } from '../data/wells.js';
import {
  depthT, lightOf, mix, blend, shade, rgba, speckle, stoneWall, ellipse, rough, MAX_D,
} from './chambers/_shared.js';

const ROOM_IDS = ['whatsapp', 'discord', 'meetup', 'youtube', 'instagram', 'facebook'];
const HUE = { water: '#3BE8B0', sand: '#E8873A', rust: '#B8341F', bone: '#F2EDE2' };
const FALL_MS = 1150;
const REAL = WELLS.filter((w) => w.url);

let st = null; // module singleton state

// ---------------------------------------------------------------------------
// geometry: one ruler for the frame and every room
// ---------------------------------------------------------------------------
function geometry(w, h, well, fallP, ease) {
  const side = Math.max(112, Math.min(224, w * 0.152));
  const half = Math.max(200, w / 2 - side);
  const cx = w / 2;
  const e = ease.outCubic(fallP);
  const tgtSky = mix(66, 14, depthT(well.depth));
  const floorY = h - Math.max(84, h * 0.115);
  return {
    w, h, cx,
    left: cx - half, right: cx + half, half,
    mouthR: half * 0.64,
    skyCx: cx,
    skyCy: mix(h * 0.3, h * 0.1, e),
    skyR: mix(Math.min(w, h) * 0.26, tgtSky, e),
    mouthY: mix(h * 1.3, h * 0.33, e),
    floorY,
    light: lightOf(well.depth),
    fallP,
  };
}

// ---------------------------------------------------------------------------
// the stone: ceiling funnel, sky hole, shaft walls, floor. Static once landed.
// ---------------------------------------------------------------------------
function renderStone(c, g, pal, prng) {
  const { w, h } = g;
  c.clearRect(0, 0, w, h);

  // room back wall first — rooms paint on top of this on their own layer
  const bw = c.createLinearGradient(0, g.mouthY, 0, g.floorY);
  bw.addColorStop(0, blend(pal.ink, pal.stoneDark, 0.5));
  bw.addColorStop(1, pal.ink);
  c.fillStyle = bw;
  c.fillRect(0, g.mouthY - 2, w, g.floorY - g.mouthY + 4);
  // faint courses on the back wall so rooms sit against something
  c.strokeStyle = rgba('#000000', 0.3);
  c.lineWidth = 1;
  for (let y = g.mouthY + 30; y < g.floorY; y += 54) {
    rough(c, g.left, y, g.right, y + (prng() - 0.5) * 4, { jitter: 1.2, prng });
  }
  speckle(c, g.left, g.mouthY, g.right - g.left, g.floorY - g.mouthY,
    { n: Math.round((g.right - g.left) * (g.floorY - g.mouthY) / 2200), prng, a: 0.22, size: 2.2 });

  // --- the vault overhead: courses of stone receding to the hole you fell through.
  // Drawn big-to-small and clipped to the ceiling band, so it fills the frame edge to
  // edge and never reads as a floating object.
  c.save();
  c.beginPath(); c.rect(0, 0, w, g.mouthY + 1); c.clip();
  c.fillStyle = pal.stoneDark;
  c.fillRect(0, 0, w, g.mouthY + 1);

  const N = 58;
  const outer = Math.max(w, h) * 0.95;
  for (let i = N; i >= 0; i--) {
    const p = i / N;                 // 1 = nearest course, 0 = the hole
    const e = Math.pow(p, 1.7);
    const rx = mix(g.skyR, outer, e);
    const ry = rx * 0.34;
    const cy = mix(g.skyCy, g.mouthY + outer * 0.17, e);
    const far = 1 - p;

    let tone = blend(pal.stone, pal.stoneDark, 0.04 + p * 0.68);
    tone = blend(tone, pal.cone, g.light * 0.42 * far * far);
    tone = shade(tone, (prng() - 0.5) * 0.12);
    if (i % 2) tone = shade(tone, -0.07);

    ellipse(c, g.skyCx, cy, rx, ry);
    c.fillStyle = tone;
    c.fill();
    c.strokeStyle = rgba('#000000', 0.34);
    c.lineWidth = 1;
    c.stroke();

    // radial block divisions, only on courses big enough to show them
    if (rx > 60) {
      const n = Math.round(8 + rx / 30);
      c.strokeStyle = rgba('#000000', 0.3);
      for (let k = 0; k < n; k++) {
        const a = Math.PI * (-0.08 + 1.16 * ((k + prng() * 0.5) / n));
        const x1 = g.skyCx + Math.cos(a) * rx * 0.998;
        const y1 = cy + Math.sin(a) * ry * 0.998;
        const x2 = g.skyCx + Math.cos(a) * rx * 0.76;
        const y2 = cy + Math.sin(a) * ry * 0.76;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
    }
  }
  speckle(c, 0, 0, w, g.mouthY, { n: Math.round(w * g.mouthY / 1100), prng, a: 0.3, size: 2.2 });
  // the vault is darkest at the edges of vision
  const ceil = c.createRadialGradient(g.skyCx, g.skyCy, g.skyR * 2.2, g.skyCx, g.skyCy, outer * 0.85);
  ceil.addColorStop(0, rgba('#000000', 0));
  ceil.addColorStop(1, rgba('#000000', 0.46));
  c.fillStyle = ceil;
  c.fillRect(0, 0, w, g.mouthY + 1);

  // --- the circle of night sky you came from
  const sr = g.skyR;
  ellipse(c, g.skyCx, g.skyCy, sr, sr * 0.64);
  c.fillStyle = '#060913';
  c.fill();
  c.save();
  c.clip();
  const sp = prng;
  for (let i = 0; i < 26; i++) {
    const a = sp() * Math.PI * 2, r = Math.sqrt(sp()) * sr;
    const x = g.skyCx + Math.cos(a) * r, y = g.skyCy + Math.sin(a) * r * 0.64;
    c.fillStyle = rgba('#F2EDE2', 0.25 + sp() * 0.7);
    c.fillRect(x, y, 1.1, 1.1);
  }
  c.restore();
  // glow bleeding out of the hole
  const gl = c.createRadialGradient(g.skyCx, g.skyCy, sr * 0.6, g.skyCx, g.skyCy, sr * 2.6);
  gl.addColorStop(0, rgba(pal.cone, 0.2 * g.light));
  gl.addColorStop(1, rgba(pal.cone, 0));
  c.fillStyle = gl;
  c.beginPath();
  c.ellipse(g.skyCx, g.skyCy, sr * 2.6, sr * 1.9, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = rgba('#F2EDE2', 0.22 + 0.3 * g.light);
  c.lineWidth = 1.2;
  ellipse(c, g.skyCx, g.skyCy, sr, sr * 0.64);
  c.stroke();
  c.restore(); // end ceiling band

  // --- shaft walls below the ceiling line
  const wallH = h - g.mouthY;
  stoneWall(c, 0, g.mouthY, g.left + 1, wallH, { prng, base: pal.stone, dark: pal.stoneDark, light: g.light, lit: 'r', course: 44 });
  stoneWall(c, g.right - 1, g.mouthY, w - g.right + 1, wallH, { prng, base: pal.stone, dark: pal.stoneDark, light: g.light, lit: 'l', course: 44 });

  // ceiling line — the one chalk-clean edge up there
  const cg = c.createLinearGradient(0, g.mouthY, 0, g.mouthY + 60);
  cg.addColorStop(0, rgba('#000000', 0.55));
  cg.addColorStop(1, rgba('#000000', 0));
  c.fillStyle = cg;
  c.fillRect(0, g.mouthY, w, 60);
  c.strokeStyle = rgba('#F2EDE2', 0.07 + 0.16 * g.light);
  c.lineWidth = 1.2;
  rough(c, 0, g.mouthY, w, g.mouthY + (prng() - 0.5) * 3, { jitter: 1.5, prng });

  // --- floor
  const fh = h - g.floorY;
  const fg = c.createLinearGradient(0, g.floorY, 0, h);
  fg.addColorStop(0, blend(pal.stone, pal.stoneDark, 0.3));
  fg.addColorStop(1, pal.stoneDark);
  c.fillStyle = fg;
  c.fillRect(0, g.floorY, w, fh);
  c.strokeStyle = rgba('#000000', 0.45);
  for (let i = 0; i < 7; i++) {
    const y = g.floorY + (i / 7) * fh;
    rough(c, 0, y, w, y + (prng() - 0.5) * 5, { jitter: 1.1, prng });
  }
  for (let i = 0; i < 16; i++) {
    const x = prng() * w;
    rough(c, x, g.floorY, x + (prng() - 0.5) * 40, h, { jitter: 1.4, prng });
  }
  speckle(c, 0, g.floorY, w, fh, { n: Math.round(w * fh / 700), prng, a: 0.3, size: 2 });
  c.strokeStyle = rgba(pal.cone, 0.16 + 0.4 * g.light);
  c.lineWidth = 1;
  rough(c, 0, g.floorY, w, g.floorY, { jitter: 1.6, prng });
}

// ---------------------------------------------------------------------------
// the air: light shaft, motes, fall streaks, impact dust. Per frame, kept cheap.
// ---------------------------------------------------------------------------
function renderAir(c, g, pal, s, t) {
  const { w, h } = g;
  c.clearRect(0, 0, w, h);

  // --- the column of night light coming down the shaft
  if (g.light > 0.06) {
    const poolR = g.mouthR * 0.62;
    const flick = 1 + Math.sin(t / 2600) * 0.08;
    c.globalCompositeOperation = 'lighter';
    const lg = c.createLinearGradient(0, g.skyCy, 0, g.floorY);
    lg.addColorStop(0, rgba(pal.cone, 0.1 * g.light * flick));
    lg.addColorStop(0.7, rgba(pal.cone, 0.034 * g.light));
    lg.addColorStop(1, rgba(pal.cone, 0.01 * g.light));
    c.fillStyle = lg;
    c.beginPath();
    c.moveTo(g.skyCx - g.skyR * 0.85, g.skyCy);
    c.lineTo(g.skyCx - poolR, g.floorY + 4);
    c.lineTo(g.skyCx + poolR, g.floorY + 4);
    c.lineTo(g.skyCx + g.skyR * 0.85, g.skyCy);
    c.closePath();
    c.fill();

    const pg = c.createRadialGradient(g.skyCx, g.floorY + 6, 2, g.skyCx, g.floorY + 6, poolR * 1.6);
    pg.addColorStop(0, rgba(pal.cone, 0.17 * g.light));
    pg.addColorStop(1, rgba(pal.cone, 0));
    c.fillStyle = pg;
    c.beginPath();
    c.ellipse(g.skyCx, g.floorY + 6, poolR * 1.6, poolR * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  // --- motes
  c.globalCompositeOperation = 'lighter';
  for (const m of s.motes) {
    m.y += m.v * (s.landed ? 1 : 6);
    if (m.y > g.floorY) { m.y = g.mouthY * 0.5; m.x = g.left + Math.random() * (g.right - g.left); }
    const sway = Math.sin(t / 1400 + m.ph) * 9;
    const inBeam = Math.abs(m.x - g.skyCx) < g.half * 0.56;
    c.fillStyle = rgba(inBeam ? pal.cone : pal.bone, m.a * (inBeam ? 0.9 : 0.22) * (0.25 + g.light));
    c.fillRect(m.x + sway, m.y, m.r, m.r);
  }
  c.globalCompositeOperation = 'source-over';

  // --- rushing walls during the fall
  if (!s.landed) {
    const p = g.fallP;
    const a = (1 - p) * 0.5;
    c.strokeStyle = rgba('#F2EDE2', a * 0.26);
    c.lineWidth = 1;
    for (const k of s.streaks) {
      const x = k.side ? g.left * k.x : g.right + (w - g.right) * k.x;
      const len = 90 + k.l * 420 * (1 - p);
      const y = (k.y * h + (1 - p) * 2600 * k.s) % (h + len) - len;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + len); c.stroke();
    }
    c.fillStyle = rgba('#000000', 0.45 * (1 - p));
    c.fillRect(0, 0, w, h);
  }

  // --- impact dust
  if (s.dust.length) {
    for (let i = s.dust.length - 1; i >= 0; i--) {
      const d = s.dust[i];
      d.life -= 0.016;
      if (d.life <= 0) { s.dust.splice(i, 1); continue; }
      d.x += d.vx; d.y += d.vy; d.vy += 0.07; d.vx *= 0.975; d.r += 0.06;
      c.fillStyle = rgba(pal.dust || pal.bone, Math.max(0, d.life) * 0.16);
      c.fillRect(d.x, d.y, d.r, d.r);
    }
  }
}

// ---------------------------------------------------------------------------
// DOM frame
// ---------------------------------------------------------------------------
const CSS = `
.ch{position:absolute;inset:0;z-index:10;pointer-events:none;font-family:var(--font-mono);
  --key:#3BE8B0;--cone:#CFE4FF;--ink:#0A0D16}
.ch a{pointer-events:auto;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}
.ch a:focus-visible,.ch a:focus{outline:2px solid var(--key);outline-offset:5px}
.ch-fade{opacity:0;transform:translateY(7px);transition:opacity 620ms ease,transform 620ms cubic-bezier(.2,.8,.2,1);transition-delay:var(--d,0ms)}
[data-landed="1"] .ch-fade{opacity:1;transform:none}

.ch-id{position:absolute;left:26px;top:24px;max-width:min(46vw,460px)}
.ch-id__rule{width:40px;height:2px;background:var(--key);margin-bottom:12px;opacity:.9}
.ch-n{font-size:10px;letter-spacing:.34em;opacity:.55;text-transform:uppercase}
.ch-name{font-family:var(--font-display);font-weight:400;font-size:clamp(32px,5.1vw,70px);
  line-height:.84;letter-spacing:.012em;margin:7px 0 2px;color:var(--bone)}
.ch-he{font-family:var(--font-he);font-size:clamp(15px,1.7vw,22px);font-weight:700;color:var(--key);
  line-height:1.1;letter-spacing:.02em;text-align:left;unicode-bidi:plaintext}
.ch-role{font-size:10px;letter-spacing:.2em;opacity:.5;margin-top:9px;text-transform:uppercase}

.ch-depth{position:absolute;right:26px;top:24px;text-align:right}
.ch-depth__v{font-family:var(--font-display);font-weight:400;font-size:clamp(28px,3.9vw,54px);
  line-height:.84;color:var(--key);display:inline-block}
.ch-depth__u{font-size:12px;letter-spacing:.18em;opacity:.7;margin-left:5px}
.ch-depth__cap{font-size:9px;letter-spacing:.3em;opacity:.45;margin-top:7px;text-transform:uppercase}

.ch-gauge{position:absolute;right:26px;top:clamp(108px,15vh,150px);height:min(50vh,430px);width:190px}
.ch-gauge__ln{position:absolute;right:0;top:0;bottom:0;width:1px;background:linear-gradient(
  to bottom,rgba(242,237,226,0) 0%,rgba(242,237,226,.28) 12%,rgba(242,237,226,.28) 88%,rgba(242,237,226,0) 100%)}
.ch-gauge__cap{position:absolute;right:0;top:-18px;font-size:9px;letter-spacing:.3em;opacity:.4}
.ch-tick{position:absolute;right:0;display:flex;align-items:center;justify-content:flex-end;gap:8px;
  transform:translateY(-50%);padding:3px 0;width:100%;opacity:.42;transition:opacity 200ms,color 200ms}
.ch-tick__t{font-size:9.5px;letter-spacing:.17em;white-space:nowrap}
.ch-tick__m{width:9px;height:1px;background:currentColor;flex:none}
.ch-tick__seen{width:4px;height:4px;border-radius:50%;background:var(--water);flex:none;margin-left:-4px}
a.ch-tick:hover{opacity:1;color:var(--key)}
a.ch-tick:hover .ch-tick__m{width:18px}
.ch-tick--cur{opacity:1;color:var(--key)}
.ch-tick--cur .ch-tick__m{width:22px;height:2px}
.ch-tick--cur .ch-tick__t{font-weight:600}

.ch-sky{position:absolute;left:50%;transform:translateX(-50%);font-size:9px;letter-spacing:.3em;
  opacity:.5;text-align:center;white-space:nowrap}

.ch-exits{position:absolute;left:26px;right:26px;bottom:46px;display:flex;align-items:flex-end;
  justify-content:space-between;gap:16px}
.ch-lat{display:flex;gap:10px;align-items:flex-end}
.ch-out{display:block;border:1px solid rgba(242,237,226,.2);padding:9px 13px 8px;
  background:rgba(5,7,16,.42);backdrop-filter:blur(2px);transition:border-color 200ms,background 200ms,transform 200ms}
.ch-out:hover{border-color:var(--key);background:rgba(5,7,16,.72);transform:translateY(-2px)}
.ch-out__l{font-size:11px;letter-spacing:.26em;display:block;text-transform:uppercase}
.ch-out__k{font-size:8.5px;letter-spacing:.24em;opacity:.45;display:block;margin-top:5px;text-transform:uppercase}
.ch-out:hover .ch-out__k{opacity:.8}
.ch-out--up .ch-out__l{color:var(--bone)}
.ch-out--up:hover .ch-out__l{color:var(--key)}

.ch-take{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;
  align-items:center;gap:0;padding:8px;transition:transform 260ms cubic-bezier(.2,.8,.2,1)}
.ch-take:hover{transform:translate(-50%,calc(-50% - 5px))}
.ch-take__art{display:block;line-height:0;filter:drop-shadow(0 0 16px rgba(0,0,0,.6))}
.ch-take__txt{text-align:center;margin-top:11px}
.ch-take__l{font-size:11px;letter-spacing:.26em;display:block;color:var(--bone);text-transform:uppercase}
.ch-take__h{font-size:8.5px;letter-spacing:.2em;display:block;margin-top:6px;color:var(--key);opacity:.75}
.ch-take:hover .ch-take__h{opacity:1}
.ch-take::after{content:'';position:absolute;inset:-6px;border:1px solid transparent;transition:border-color 200ms}
.ch-take:hover::after{border-color:rgba(242,237,226,.18)}

.ch-vig{position:absolute;inset:0;z-index:7;pointer-events:none}
.ch-extra{position:absolute;inset:0;z-index:9;pointer-events:none;font-family:var(--font-mono)}
.ch-extra a{pointer-events:auto}

/* wall notes: the surveyor's annotations, for rooms that want them */
.nt{position:absolute;font-size:9px;letter-spacing:.22em;opacity:.5;text-transform:uppercase;
  line-height:1.7;max-width:230px}
.nt b{display:block;font-size:9.5px;letter-spacing:.3em;color:var(--key);opacity:.95;
  font-weight:500;margin-bottom:5px}
.nt--r{text-align:right}
.nt em{font-style:normal;opacity:.7}

@media (max-width:980px){
  .ch-gauge{width:150px}
  .ch-tick__t{font-size:9px;letter-spacing:.1em}
}
@media (prefers-reduced-motion:reduce){
  .ch-fade{transition:none;opacity:1;transform:none}
}
`;

const ROPE_ART = `<svg width="86" height="150" viewBox="0 0 86 150" fill="none" aria-hidden="true">
  <path d="M43 0 L43 96" stroke="var(--key)" stroke-width="2" opacity=".85"/>
  <path d="M43 96 q-14 10 -4 20 q10 10 8 22" stroke="var(--key)" stroke-width="2" opacity=".7"/>
  <circle cx="43" cy="118" r="9" stroke="var(--key)" stroke-width="2" opacity=".9"/>
  <circle cx="43" cy="118" r="3" fill="var(--key)"/>
</svg>`;

function tickRow(w, cur, store) {
  const top = (w.depth / MAX_D) * 100;
  const label = `${String(w.depth).padStart(2, '0')} M · ${w.name}`;
  const seen = store.seen(w.id) ? '<span class="ch-tick__seen"></span>' : '';
  if (w.id === cur) {
    return `<span class="ch-tick ch-tick--cur" style="top:${top}%">${seen}
      <span class="ch-tick__t">${label}</span><span class="ch-tick__m"></span></span>`;
  }
  return `<a class="ch-tick" style="top:${top}%" href="#/well/${w.id}" data-well="${w.id}">${seen}
    <span class="ch-tick__t">${label}</span><span class="ch-tick__m"></span></a>`;
}

function buildUI(well, pal, room, ctx) {
  const i = REAL.findIndex((w) => w.id === well.id);
  const prev = REAL[(i - 1 + REAL.length) % REAL.length];
  const next = REAL[(i + 1) % REAL.length];
  const take = room.take || {};
  const host = take.host || (well.url || '').replace(/^https?:\/\//, '').split('/')[0];
  const pos = take.pos || { left: '50%', top: '66%' };

  const el = document.createElement('div');
  el.className = 'ch';
  el.dataset.well = well.id;
  el.style.setProperty('--key', pal.key);
  el.style.setProperty('--cone', pal.cone);
  el.style.setProperty('--ink', pal.ink);
  el.innerHTML = `
  <header class="ch-id ch-fade" style="--d:60ms">
    <div class="ch-id__rule"></div>
    <div class="ch-n">well ${String(well.n).padStart(2, '0')} / 07 &nbsp;·&nbsp; be'er sheva</div>
    <h1 class="ch-name">${well.name}</h1>
    <div class="ch-he" lang="he" dir="rtl">${well.he}</div>
    <div class="ch-role">${well.role}</div>
  </header>

  <div class="ch-depth ch-fade" style="--d:150ms">
    <div><span class="ch-depth__v">${well.depth.toFixed(1)}</span><span class="ch-depth__u">M</span></div>
    <div class="ch-depth__cap">below datum · ${Math.round(lightOf(well.depth) * 100)}% light</div>
  </div>

  <aside class="ch-gauge ch-fade" style="--d:260ms" aria-label="shaft index">
    <div class="ch-gauge__ln"></div>
    <div class="ch-gauge__cap">shaft index</div>
    ${REAL.map((w) => tickRow(w, well.id, ctx.store)).join('')}
  </aside>

  <div class="ch-sky ch-fade" style="--d:200ms">surface · 0.0 m</div>

  <a class="ch-take ch-fade ${take.cls || ''}" style="--d:420ms;left:${pos.left};top:${pos.top}"
     href="${well.url}" target="_blank" rel="noopener noreferrer">
    <span class="ch-take__art">${take.art || ROPE_ART}</span>
    <span class="ch-take__txt">
      <span class="ch-take__l">${take.label || 'take the rope'}</span>
      <span class="ch-take__h">${host} ↗</span>
    </span>
  </a>

  <nav class="ch-exits ch-fade" style="--d:340ms">
    <a class="ch-out ch-out--up" href="#/surface" data-go="surface">
      <span class="ch-out__l">↑ ascend</span>
      <span class="ch-out__k">back to the field · esc</span>
    </a>
    <div class="ch-lat">
      <a class="ch-out" href="#/well/${prev.id}" data-well="${prev.id}">
        <span class="ch-out__l">← ${prev.name}</span>
        <span class="ch-out__k">lateral · ${prev.depth} m</span>
      </a>
      <a class="ch-out" href="#/well/${next.id}" data-well="${next.id}">
        <span class="ch-out__l">${next.name} →</span>
        <span class="ch-out__k">lateral · ${next.depth} m</span>
      </a>
    </div>
  </nav>`;
  return { el, prev, next };
}

// ---------------------------------------------------------------------------
export default {
  id: 'chamber',

  async enter(ctx) {
    const id = (ctx.payload && ctx.payload.wellId) || '';
    if (id === 'seventh') { ctx.go('seventh', { from: 'chamber' }); return; }
    const well = byId(id);
    if (!well || !ROOM_IDS.includes(id)) { ctx.go('surface', { from: 'chamber' }); return; }

    const { fx, audio, root } = ctx;
    const reduced = !!fx.reducedMotion;

    // --- the room module decorates this frame
    let room = {};
    try {
      const mod = await import(`./chambers/${id}.js`);
      const make = mod.default;
      room = (typeof make === 'function' ? make({ ctx, well, fx, audio, store: ctx.store }) : make) || {};
    } catch (e) {
      console.warn('[chamber] room module failed, falling back to the bare frame', id, e);
      room = {};
    }

    const pal = Object.assign({
      ink: '#0A0D16', stone: '#2C2C38', stoneDark: '#08090F',
      key: HUE[well.hue] || HUE.bone, cone: '#CFE4FF', bone: '#F2EDE2', dust: '#F2EDE2',
    }, room.pal || {});

    // --- layers
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    root.style.setProperty('--key', pal.key);
    root.style.setProperty('--cone', pal.cone);
    root.style.setProperty('--ink', pal.ink);

    const bg = document.createElement('div');
    bg.style.cssText = `position:absolute;inset:0;background:${pal.ink};z-index:0`;
    root.appendChild(bg);

    const stone = fx.layer(root, 1);
    const host = document.createElement('div'); // rooms put their layers/DOM in here
    host.style.cssText = 'position:absolute;inset:0;z-index:3';
    root.appendChild(host);
    const air = fx.layer(root, 5);
    air.canvas.style.pointerEvents = 'none';

    const vig = document.createElement('div');
    vig.className = 'ch-vig';
    vig.style.background =
      `radial-gradient(ellipse 78% 64% at 50% ${Math.round(42 + depthT(well.depth) * 10)}%,` +
      `rgba(0,0,0,0) 38%, rgba(0,0,0,${(0.42 + depthT(well.depth) * 0.4).toFixed(2)}) 100%)`;
    root.appendChild(vig);

    const extra = document.createElement('div');
    extra.className = 'ch-extra';
    root.appendChild(extra);

    const { el: ui } = buildUI(well, pal, room, ctx);
    root.appendChild(ui);
    if (room.ui) {
      extra.innerHTML = typeof room.ui === 'function' ? room.ui() : room.ui;
    }

    // --- state
    const motes = [];
    for (let i = 0; i < 64; i++) {
      motes.push({
        x: fx.rand(0, ctx.W), y: fx.rand(0, ctx.H), v: fx.rand(0.04, 0.26),
        r: fx.rand(0.8, 2.1), a: fx.rand(0.25, 0.9), ph: fx.rand(0, 7),
      });
    }
    const streaks = [];
    for (let i = 0; i < 46; i++) {
      streaks.push({ side: i % 2 === 0, x: fx.rand(0.02, 0.98), y: fx.rand(0, 1), l: fx.rand(0.2, 1), s: fx.rand(0.7, 1.5) });
    }

    st = {
      ctx, well, room, pal, reduced,
      stone, air, host, ui, extra, vig,
      g: geometry(ctx.W, ctx.H, well, reduced ? 1 : 0, fx.ease),
      motes, streaks, dust: [],
      landed: reduced, impacted: reduced, tFall: reduced ? FALL_MS : 0,
      stoneDirty: true, off: [], alive: true, ready: false,
      skyLabelY: 0,
    };

    // --- room gets the frame it is decorating
    if (room.init) {
      try { room.init({ host, extra, geo: () => st.g, pal, layer: (z) => fx.layer(host, z) }); }
      catch (e) { console.warn('[chamber] room init', e); }
    }

    // --- navigation
    const nav = (e) => {
      const a = e.target.closest && e.target.closest('a[data-well],a[data-go]');
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      const w = a.getAttribute('data-well');
      if (w) ctx.go('chamber', { wellId: w });
      else ctx.go('surface', { from: 'chamber' });
    };
    ui.addEventListener('click', nav);
    extra.addEventListener('click', nav);
    st.off.push(() => { ui.removeEventListener('click', nav); extra.removeEventListener('click', nav); });

    const i = REAL.findIndex((w) => w.id === well.id);
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') { ctx.go('chamber', { wellId: REAL[(i + 1) % REAL.length].id }); }
      else if (e.key === 'ArrowLeft') { ctx.go('chamber', { wellId: REAL[(i - 1 + REAL.length) % REAL.length].id }); }
      else if (e.key === 'ArrowUp') { ctx.go('surface', { from: 'chamber' }); }
    };
    window.addEventListener('keydown', onKey);
    st.off.push(() => window.removeEventListener('keydown', onKey));

    // the link is an object you take — give it a sound
    const takeEl = ui.querySelector('.ch-take');
    if (takeEl) {
      const hov = () => audio.tone(room.takeHz || 620, { dur: 0.16, type: 'triangle', gain: 0.1, slideTo: (room.takeHz || 620) * 1.5 });
      const clk = () => { audio.drip({ pitch: 1.2 }); ctx.store.mark('took:' + well.id); };
      takeEl.addEventListener('pointerenter', hov);
      takeEl.addEventListener('focus', hov);
      takeEl.addEventListener('click', clk);
      st.off.push(() => {
        takeEl.removeEventListener('pointerenter', hov);
        takeEl.removeEventListener('focus', hov);
        takeEl.removeEventListener('click', clk);
      });
    }

    // fonts land late; the stone carries baked type, so repaint once they do
    document.fonts && document.fonts.ready.then(() => { if (st && st.alive) st.stoneDirty = true; });

    document.body.classList.add('show-cursor');
    st.off.push(() => document.body.classList.remove('show-cursor'));

    ctx.store.mark(well.id);
    audio.drone('deep');
    if (reduced) {
      audio.thud({ gain: 0.22 });
      ui.dataset.landed = '1';
      root.dataset.landed = '1';
      if (room.onLanded) { try { room.onLanded(); } catch (e) { console.warn(e); } }
    } else {
      audio.noise({ dur: 1.05, gain: 0.07, band: [160, 1100] });
      audio.tone(240, { dur: 1.0, type: 'triangle', gain: 0.07, slideTo: 70 });
    }
    st.ready = true;
  },

  update(dt, t) {
    const s = st;
    if (!s || !s.alive || !s.ready) return;
    const ctx = s.ctx, well = s.well, pal = s.pal, fx = s.ctx.fx;

    if (!s.landed) {
      s.tFall += dt;
      const p = Math.min(1, s.tFall / FALL_MS);
      s.g = geometry(ctx.W, ctx.H, well, p, fx.ease);
      s.stoneDirty = true;
      if (p >= 1 && !s.impacted) impact(s);
    } else if (s.stoneDirty) {
      s.g = geometry(ctx.W, ctx.H, well, 1, fx.ease);
    }

    if (s.stoneDirty) {
      try {
        renderStone(s.stone.ctx2d, s.g, pal, fx.rnd(well.n * 9173 + 7));
        placeSkyLabel(s);
      } catch (e) { console.warn('[chamber] stone', e); }
      s.stoneDirty = s.landed ? false : true;
    }

    try { renderAir(s.air.ctx2d, s.g, pal, s, t); } catch (e) { console.warn('[chamber] air', e); }

    if (s.room.update) {
      try { s.room.update(dt, t, s.landed); } catch (e) { console.warn('[chamber] room update', e); }
    }
  },

  resize() {
    if (!st || !st.alive) return;
    st.stoneDirty = true;
    st.g = geometry(st.ctx.W, st.ctx.H, st.well, st.landed ? 1 : st.tFall / FALL_MS, st.ctx.fx.ease);
    if (st.room.resize) { try { st.room.resize(st.g); } catch (e) { console.warn(e); } }
  },

  exit() {
    const s = st;
    st = null;
    if (!s) return;
    s.alive = false;
    try { s.off.forEach((f) => f()); } catch (e) { console.warn('[chamber] exit', e); }
    try { s.room.dispose && s.room.dispose(); } catch (e) { console.warn('[chamber] room dispose', e); }
    try { s.stone.destroy(); s.air.destroy(); } catch {}
    s.dust.length = 0;
    s.motes.length = 0;
  },
};

function placeSkyLabel(s) {
  const lab = s.ui.querySelector('.ch-sky');
  if (!lab) return;
  const y = Math.round(s.g.skyCy + s.g.skyR * 0.64 + 16);
  lab.style.top = y + 'px';
}

function impact(s) {
  s.impacted = true;
  s.landed = true;
  const { ctx, pal, g } = s;
  const fx = ctx.fx;
  fx.shake(440, 17);
  fx.flash(pal.ink, 190);
  ctx.audio.thud({ gain: 0.6 });
  ctx.audio.noise({ dur: 0.6, gain: 0.1, band: [90, 700] });
  ctx.audio.drip({ pitch: 0.9, delay: 0.62 });
  for (let i = 0; i < 220; i++) {
    const a = fx.rand(-Math.PI, 0);
    const sp = fx.rand(1.5, 9);
    s.dust.push({
      x: g.cx + fx.rand(-g.half * 0.7, g.half * 0.7),
      y: g.floorY + fx.rand(-8, 12),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55,
      r: fx.rand(1, 3.4), life: fx.rand(0.5, 1.2),
    });
  }
  s.ui.dataset.landed = '1';
  s.ctx.root.dataset.landed = '1';
  s.stoneDirty = true;
  if (s.room.onLanded) { try { s.room.onLanded(); } catch (e) { console.warn('[chamber] onLanded', e); } }
}
