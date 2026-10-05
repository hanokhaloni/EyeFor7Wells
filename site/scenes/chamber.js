// [CHAMBERS] The shared chamber frame.
//
// You arrive by falling. The shaft rushes, you land, dust lifts, and only then does the
// room resolve. Everything structural lives here — the stone funnel overhead, the circle
// of night sky you came from, the depth index, the way out — so that six very different
// rooms still read as one site. The per-well character lives in ./chambers/<id>.js and
// decorates this frame.
//
// Frame rev 3 keys a room may set (all default on / 'hang'):
//   frame.mouth: false  — no hole-you-fell-through disc (sand #DEA668, #060403 rim, smaller
//                         the deeper the well) and no rope hanging from it to the link.
//   frame.walls: false  — no hard flat wall bands cropping the left and right edges.
//   take.variant        — 'hang'  : link block centred on the rope's end (default)
//                         'plate' : the verb on a solid plate in the room's key colour
//                         'side'  : link block left-aligned by the left wall, rope bends to it
// The link is clamped above .ch-exits (measured) at every viewport. geo() now also carries
// g.hole {x,y,r} (or null), g.wall (band width px) and g.rope {x,y} (rope end, the link top).

import { WELLS, byId } from '../data/wells.js';
import {
  depthT, lightOf, mix, blend, shade, rgba, speckle, stoneWall, ellipse, rough, MAX_D,
  MOUTH, SAND, holeOf, wallOf,
} from './chambers/_shared.js';

const ROOM_IDS = ['whatsapp', 'discord', 'meetup', 'youtube', 'instagram', 'facebook'];
const HUE = { water: '#3BE8B0', sand: '#E8873A', rust: '#B8341F', bone: '#F2EDE2' };
// The surface already did the plunge; the chamber opens on its black, the hole above you
// shrinks away, and the room hard-cuts in at CUT_MS. Landing (onLanded) at FALL_MS.
const FALL_MS = 760;
const CUT_MS = 300;
// The link and the essential UI appear at the cut, well inside 1.5s at every viewport.
const REVEAL_MS = CUT_MS;
const REAL = WELLS.filter((w) => w.url);

// warm the room modules so the first chamber does not wait on a fetch behind black
for (const id of ROOM_IDS) import(`./chambers/${id}.js`).catch(() => {});

let st = null; // module singleton state
let gen = 0; // bumped by every enter and exit: an enter that outlived its scene bails

// ---------------------------------------------------------------------------
// geometry: one ruler for the frame and every room
// ---------------------------------------------------------------------------
function geometry(w, h, well, fallP, ease, frame, ropeEnd) {
  const vault = frame.vault;
  const side = Math.max(112, Math.min(224, w * 0.152));
  const half = Math.max(200, w / 2 - side);
  const cx = w / 2;
  const e = ease.outCubic(fallP);
  const tgtSky = mix(66, 14, depthT(well.depth));
  const floorY = h - Math.max(84, h * 0.115);
  return {
    hole: frame.mouth ? holeOf(w, h, well.depth) : null,
    wall: frame.walls ? wallOf(w, well.depth) : 0,
    rope: frame.mouth && ropeEnd ? { x: ropeEnd.x, y: ropeEnd.y } : null,
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
    vault,
  };
}

// ---------------------------------------------------------------------------
// the stone: ceiling funnel, sky hole, shaft walls, floor. Static once landed.
// ---------------------------------------------------------------------------
function renderStone(c, g, pal, prng) {
  const { w, h } = g;
  c.clearRect(0, 0, w, h);

  // room back wall first — rooms paint on top of this on their own layer
  const top = g.vault ? g.mouthY : 0;
  const bw = c.createLinearGradient(0, top, 0, g.floorY);
  bw.addColorStop(0, blend(pal.ink, pal.stoneDark, 0.5));
  bw.addColorStop(1, pal.ink);
  c.fillStyle = bw;
  c.fillRect(0, top - 2, w, g.floorY - top + 4);
  // faint courses on the back wall so rooms sit against something
  c.strokeStyle = rgba('#000000', 0.3);
  c.lineWidth = 1;
  for (let y = top + 30; y < g.floorY; y += 54) {
    rough(c, g.left, y, g.right, y + (prng() - 0.5) * 4, { jitter: 1.2, prng });
  }
  speckle(c, g.left, top, g.right - g.left, g.floorY - top,
    { n: Math.round((g.right - g.left) * (g.floorY - top) / 2200), prng, a: 0.22, size: 2.2 });

  if (g.vault) renderVault(c, g, pal, prng);

  // --- shaft walls below the ceiling line (full height when there is no vault)
  const wallH = h - top;
  stoneWall(c, 0, top, g.left + 1, wallH, { prng, base: pal.stone, dark: pal.stoneDark, light: g.light, lit: 'r', course: 44 });
  stoneWall(c, g.right - 1, top, w - g.right + 1, wallH, { prng, base: pal.stone, dark: pal.stoneDark, light: g.light, lit: 'l', course: 44 });

  if (g.vault) {
    // ceiling line — the one chalk-clean edge up there
    const cg = c.createLinearGradient(0, g.mouthY, 0, g.mouthY + 60);
    cg.addColorStop(0, rgba('#000000', 0.55));
    cg.addColorStop(1, rgba('#000000', 0));
    c.fillStyle = cg;
    c.fillRect(0, g.mouthY, w, 60);
    c.strokeStyle = rgba('#F2EDE2', 0.07 + 0.16 * g.light);
    c.lineWidth = 1.2;
    rough(c, 0, g.mouthY, w, g.mouthY + (prng() - 0.5) * 3, { jitter: 1.5, prng });
  }

  renderFloor(c, g, pal, prng);
}

// the vault overhead and the circle of sky. Skipped when room.frame.vault === false.
function renderVault(c, g, pal, prng) {
  const { w, h } = g;

  // --- the vault overhead: courses of stone receding to the hole you fell through.
  // Drawn big-to-small and clipped to the ceiling band, so it fills the frame edge to
  // edge and never reads as a floating object.
  c.save();
  c.beginPath(); c.rect(0, 0, w, g.mouthY + 1); c.clip();
  c.fillStyle = pal.stoneDark;
  c.fillRect(0, 0, w, g.mouthY + 1);

  const N = 58;
  const outer = Math.max(w, h) * 0.95;
  // this deep, the vault is barely lit at all — the stone itself darkens with depth
  const vaultStone = blend(pal.stone, pal.stoneDark, 0.62 * (1 - g.light));
  for (let i = N; i >= 0; i--) {
    const p = i / N;                 // 1 = nearest course, 0 = the hole
    const e = Math.pow(p, 1.7);
    const rx = mix(g.skyR, outer, e);
    const ry = rx * 0.34;
    const cy = mix(g.skyCy, g.mouthY + outer * 0.17, e);
    const far = 1 - p;

    let tone = blend(vaultStone, pal.stoneDark, 0.04 + p * 0.68);
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
  ceil.addColorStop(1, rgba('#000000', 0.44 + 0.42 * (1 - g.light)));
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
}

function renderFloor(c, g, pal, prng) {
  const { w, h } = g;
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
  const airOn = !s.frame || s.frame.air;
  if (airOn && g.light > 0.06) {
    const poolR = g.mouthR * 0.62;
    const flick = s.reduced ? 1 : 1 + Math.sin(t / 2600) * 0.08;
    const by = g.vault ? g.skyCy : 0;
    c.globalCompositeOperation = 'lighter';
    const lg = c.createLinearGradient(0, by, 0, g.floorY);
    lg.addColorStop(0, rgba(pal.cone, 0.1 * g.light * flick));
    lg.addColorStop(0.7, rgba(pal.cone, 0.034 * g.light));
    lg.addColorStop(1, rgba(pal.cone, 0.01 * g.light));
    c.fillStyle = lg;
    c.beginPath();
    c.moveTo(g.skyCx - g.skyR * 0.85, by);
    c.lineTo(g.skyCx - poolR, g.floorY + 4);
    c.lineTo(g.skyCx + poolR, g.floorY + 4);
    c.lineTo(g.skyCx + g.skyR * 0.85, by);
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
  for (const m of (airOn ? s.motes : [])) {
    if (!s.reduced) m.y += m.v * (s.landed ? 1 : 6);
    if (m.y > g.floorY) { m.y = g.mouthY * 0.5; m.x = g.left + Math.random() * (g.right - g.left); }
    const sway = s.reduced ? 0 : Math.sin(t / 1400 + m.ph) * 9;
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
// the over layer: the plunge, then the wall bands, the hole and the rope. All flat.
// ---------------------------------------------------------------------------
function flatDisc(c, x, y, r, rim) {
  c.beginPath();
  c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  c.fillStyle = SAND;
  c.fill();
  c.lineWidth = rim;
  c.strokeStyle = MOUTH;
  c.stroke();
}

function renderOver(c, s, t) {
  const g = s.g;
  const { w, h } = g;
  c.clearRect(0, 0, w, h);
  const hole = g.hole || holeOf(w, h, s.well.depth);
  // fall progress for the hole: it recedes from overhead to its resting size
  const fp = s.landed ? 1 : Math.min(1, s.tFall / FALL_MS);
  const e = 1 - Math.pow(1 - fp, 3);
  const R0 = Math.max(w, h) * 0.34;
  const hr = mix(R0, hole.r, e);
  const hy = mix(h * 0.38, hole.y, e);
  const rim = Math.max(2, Math.min(4, hr * 0.09));

  if (s.plunging) {
    // the chamber's first frames ARE the plunge: black, the lit hole shrinking above you
    c.fillStyle = MOUTH;
    c.fillRect(0, 0, w, h);
    flatDisc(c, hole.x, hy, hr, rim);
    return;
  }

  // --- hard wall bands cropping the room
  if (g.wall) {
    const W = g.wall, step = Math.max(4, Math.round(W * 0.34));
    c.fillStyle = MOUTH;
    c.fillRect(0, 0, W, h);
    c.fillRect(w - W, 0, W, h);
    c.fillStyle = s.pal.wall || blend(s.pal.ink, MOUTH, 0.55);
    c.fillRect(W, 0, step, h);
    c.fillRect(w - W - step, 0, step, h);
  }

  if (!g.hole) return;
  // --- the rope from the hole's lip to the link
  if (g.rope && g.rope.y > hy + hr) {
    const x0 = hole.x, y0 = hy + hr * 0.4;
    const x1 = g.rope.x, y1 = g.rope.y;
    const sway = s.reduced ? 0 : Math.sin(t / 1700) * 3.2 + Math.sin(t / 610) * 0.8;
    const thick = s.takeHot ? 7 : (w < 640 ? 3 : 4);
    c.strokeStyle = s.pal.rope || s.pal.bone || '#F2EDE2';
    c.lineWidth = thick;
    c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(x0, y0);
    if (Math.abs(x1 - x0) < 2) {
      // a straight drop with the faintest sway in its belly
      c.quadraticCurveTo(x0 + sway, (y0 + y1) / 2, x1, y1);
    } else {
      // bends from the hole down and across to a link hung off-centre
      c.bezierCurveTo(x0 + sway, y0 + (y1 - y0) * 0.55, x1 + sway * 0.5, y1 - (y1 - y0) * 0.3, x1, y1);
    }
    c.stroke();
  }
  flatDisc(c, hole.x, hy, hr, rim);
}

// ---------------------------------------------------------------------------
// DOM frame
// ---------------------------------------------------------------------------
const CSS = `
.ch{position:absolute;inset:0;z-index:10;pointer-events:none;font-family:var(--font-mono);
  --key:#3BE8B0;--cone:#CFE4FF;--ink:#1B1410}
.ch a{pointer-events:auto;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}
.ch a:focus-visible,.ch a:focus{outline:2px solid var(--key);outline-offset:5px}
.ch-fade{opacity:0;transform:translateY(7px);transition:opacity 420ms ease,transform 480ms cubic-bezier(.2,.8,.2,1);transition-delay:var(--d,0ms)}
[data-ui="1"] .ch-fade{opacity:1;transform:none}
/* fx.reducedMotion (which may come from the store, not only the media query): nothing moves */
.ch--still .ch-fade,.ch--still .ch-take,.ch--still .ch-out,.ch--still .ch-tick{transition:none!important}
.ch--still .ch-fade{opacity:1;transform:none}

.ch-id{position:absolute;left:26px;top:24px;max-width:min(46vw,460px)}
.ch-id__rule{width:40px;height:2px;background:var(--key);margin-bottom:12px;opacity:.9}
.ch-n{font-size:10px;letter-spacing:.34em;opacity:.55;text-transform:uppercase}
.ch-name{font-family:var(--font-display);font-weight:400;font-size:clamp(32px,5.1vw,70px);
  line-height:.84;letter-spacing:.012em;margin:7px 0 2px;color:var(--bone)}
.ch-he{font-family:var(--font-he);font-size:clamp(15px,1.7vw,22px);font-weight:700;color:var(--key-text,var(--key));
  line-height:1.1;letter-spacing:.02em;text-align:left;unicode-bidi:plaintext}
.ch-role{font-size:10px;letter-spacing:.2em;opacity:.5;margin-top:9px;text-transform:uppercase}

.ch-depth{position:absolute;right:26px;top:24px;text-align:right}
.ch-depth__v{font-family:var(--font-display);font-weight:400;font-size:clamp(28px,3.9vw,54px);
  line-height:.84;color:var(--key);display:inline-block}
.ch-depth__u{font-size:12px;letter-spacing:.18em;opacity:.7;margin-left:5px}
.ch-depth__cap{font-size:9px;letter-spacing:.3em;opacity:.45;margin-top:7px;text-transform:uppercase;white-space:nowrap}

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
.ch-out{display:block;border:1px solid rgba(242,237,226,.3);padding:9px 13px 8px;background:#060403}
.ch-out:hover,.ch-out:focus-visible{background:var(--bone);color:#060403;border-color:var(--bone)}
.ch-out__l{font-size:11px;letter-spacing:.26em;display:block;text-transform:uppercase;white-space:nowrap}
.ch-out__k{font-size:8.5px;letter-spacing:.24em;opacity:.55;display:block;margin-top:5px;text-transform:uppercase;white-space:nowrap}
.ch-out--up .ch-out__l{color:inherit}

/* the link. Placed in px by layoutTake() (hung from the rope, clamped above the exits);
   hover/focus is a hard flat state change: the cta inverts, the rope thickens. */
.ch-take{position:absolute;left:50%;top:60%;display:flex;flex-direction:column;
  align-items:center;gap:0;padding:12px 18px 14px;min-width:min(300px,80vw);max-width:calc(100vw - 24px)}
.ch-take__art{display:block;line-height:0}
.ch-take__art svg{max-height:var(--art-max,150px);width:auto}
.ch-take__txt{text-align:center;margin-top:12px;display:flex;flex-direction:column;align-items:center}
/* the verb: the heaviest thing in the room after the name */
.ch-take__l{font-family:var(--font-display);font-weight:400;font-size:clamp(30px,4.2vw,48px);line-height:.95;
  letter-spacing:.02em;display:block;color:var(--bone);text-transform:uppercase;text-shadow:0 3px 0 #060403}
.ch-take__c{font-size:clamp(20px,1.55vw,24px);font-weight:600;letter-spacing:.12em;display:block;margin-top:10px;
  padding:3px 8px 2px;color:var(--key-text,var(--key));background:#060403;text-transform:uppercase;white-space:nowrap}
.ch-take__h{font-size:10px;letter-spacing:.18em;display:block;margin-top:7px;color:var(--bone);opacity:.7}
.ch-take:hover .ch-take__c,.ch-take:focus-visible .ch-take__c{background:var(--key);color:#060403}
.ch a.ch-take:focus-visible,.ch a.ch-take:focus{outline:3px solid var(--key);outline-offset:4px}
/* plate: the verb on a solid plate in the room's key colour; hover inverts it */
.ch-take--plate .ch-take__l{background:var(--key);color:var(--ink);padding:10px 18px 7px;text-shadow:none;
  box-shadow:0 0 0 3px #060403}
.ch-take--plate:hover .ch-take__l,.ch-take--plate:focus-visible .ch-take__l{background:var(--ink);color:var(--key);
  box-shadow:0 0 0 3px var(--key)}
/* side: left-aligned block by the left wall */
.ch-take--side{align-items:flex-start}
.ch-take--side .ch-take__txt{text-align:left;align-items:flex-start}
/* tight: short or narrow viewports. The frame's rope already hangs it; the art steps out */
.ch-take--t1 .ch-take__art{display:none}
.ch-take--t1 .ch-take__txt{margin-top:0}
.ch-take--t2 .ch-take__h{display:none}
.ch-take--t2 .ch-take__l{font-size:28px}
.ch-take--t2 .ch-take__c{font-size:20px;letter-spacing:.06em;margin-top:6px}
.ch-take.ch-fade{transform:translateY(7px);transition:opacity 200ms linear var(--d,0ms),transform 260ms cubic-bezier(.2,.8,.2,1)}
[data-ui="1"] .ch-take.ch-fade,.ch--still .ch-take.ch-fade{transform:none}

/* frame pieces a room has switched off (room.frame) */
.ch[data-no-vault] .ch-sky,.ch[data-no-gauge] .ch-depth,.ch[data-no-index] .ch-gauge,.ch[data-no-title] .ch-id{display:none}

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
/* phone: the room needs the whole width. The shaft index and wall notes step aside;
   lateral exits and Escape still move you between wells. */
@media (max-width:640px),(max-height:500px){
  .ch-gauge,.ch-extra .nt,.ch-sky,.ch-out__k{display:none}
  .ch-id{left:16px;top:16px}
  .ch-depth{right:16px;top:16px}
  .ch-depth__cap{letter-spacing:.2em;margin-top:5px}
  .ch-take{padding:10px 12px 12px}
  .ch-role{max-width:52vw}
  .ch-exits{left:12px;right:12px;bottom:44px;gap:6px}
  .ch-lat{gap:6px}
  .ch-out{padding:9px 10px 8px}
  .ch-out__l{font-size:10px;letter-spacing:.16em}
}
/* short landscape: the exits drop to the floor line, clear of the sound toggle */
@media (max-height:500px) and (min-width:480px){
  .ch-exits{bottom:10px;right:132px}
}
/* very narrow: the lateral exits keep only their arrows (the name stays in aria-label) */
@media (max-width:400px){
  .ch-out__nm{display:none}
  .ch-out{padding:9px 12px 8px}
  .ch-take{padding:8px 6px 10px}
  .ch-take__c{letter-spacing:.05em;padding:3px 6px 2px}
}
@media (prefers-reduced-motion:reduce){
  .ch-fade{transition:none;opacity:1;transform:none}
  .ch-take.ch-fade,[data-ui="1"] .ch-take.ch-fade{transition:none;transform:none}
}
`;

// the default end of the rope: a knot and a ring (the rope itself comes down from the hole)
const ROPE_ART = `<svg width="40" height="58" viewBox="0 0 40 58" fill="none" aria-hidden="true">
  <rect x="18" y="0" width="4" height="22" fill="var(--bone)"/>
  <rect x="13" y="20" width="14" height="8" fill="var(--bone)"/>
  <circle cx="20" cy="42" r="11" stroke="var(--key)" stroke-width="4"/>
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

// room.frame: which shared pieces this room keeps. Every key defaults to true.
//   vault — ceiling stone rings + sky circle (and its "surface" label)
//   gauge — the depth readout, top right
//   notes — the corner wall notes (direct .nt children of room.ui)
//   index — the shaft index ticks
//   title — the channel title block, top left
//   air   — the light column + floor pool, the drifting motes and the vignette laid over
//           the room (fall streaks and landing dust still play). false keeps flat rooms flat.
//   mouth — the sand disc of the hole you fell through, and the rope from it to the link
//   walls — the two hard flat wall bands cropping the room at the left and right edges
const FRAME_KEYS = ['vault', 'gauge', 'notes', 'index', 'title', 'air', 'mouth', 'walls'];
const VARIANTS = ['hang', 'plate', 'side'];
function frameOf(room) {
  const f = (room && room.frame) || {};
  const out = {};
  for (const k of FRAME_KEYS) out[k] = f[k] !== false;
  return out;
}

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildUI(well, pal, room, ctx, frame) {
  const i = REAL.findIndex((w) => w.id === well.id);
  const prev = REAL[(i - 1 + REAL.length) % REAL.length];
  const next = REAL[(i + 1) % REAL.length];
  const take = room.take || {};
  const host = take.host || (well.url || '').replace(/^https?:\/\//, '').split('/')[0];
  const pos = take.pos || { left: '50%', top: '66%' };
  const verb = take.verb || take.label || 'take the rope';
  const cta = take.cta || ('JOIN ON ' + well.name);
  const variant = VARIANTS.includes(take.variant) ? take.variant : 'hang';

  const el = document.createElement('div');
  el.className = 'ch';
  el.dataset.well = well.id;
  for (const k of FRAME_KEYS) if (!frame[k]) el.setAttribute('data-no-' + k, '');
  el.style.setProperty('--key', pal.key);
  el.style.setProperty('--key-text', pal.keyText || pal.key);
  el.style.setProperty('--cone', pal.cone);
  el.style.setProperty('--ink', pal.ink);
  // DOM order is tab order: link, then the ways out, then the shaft index.
  el.innerHTML = `
  ${frame.title ? `<header class="ch-id ch-fade" style="--d:0ms">
    <div class="ch-id__rule"></div>
    <h1 class="ch-name">${well.name}</h1>
    <div class="ch-he" lang="he" dir="rtl">${well.he}</div>
    <div class="ch-role">${well.role}</div>
  </header>` : `<h1 class="ch-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${well.name}</h1>`}

  <a class="ch-take ch-take--${variant} ch-fade ${take.cls || ''}" style="--d:0ms" data-variant="${variant}"
     href="${well.url}" target="_blank" rel="noopener noreferrer"
     aria-label="${esc(cta)}: ${esc(verb)}. Opens ${host} in a new tab">
    <span class="ch-take__art">${take.art || ROPE_ART}</span>
    <span class="ch-take__txt">
      <span class="ch-take__l">${verb}</span>
      <span class="ch-take__c">${cta} ↗</span>
      <span class="ch-take__h">${host}</span>
    </span>
  </a>

  <nav class="ch-exits ch-fade" style="--d:120ms">
    <a class="ch-out ch-out--up" href="#/surface" data-go="surface">
      <span class="ch-out__l">↑ ascend</span>
      <span class="ch-out__k">back to the field · esc</span>
    </a>
    <div class="ch-lat">
      <a class="ch-out" href="#/well/${prev.id}" data-well="${prev.id}" aria-label="lateral to ${prev.name}">
        <span class="ch-out__l">← <span class="ch-out__nm">${prev.name}</span></span>
        <span class="ch-out__k">lateral · ${prev.depth} m</span>
      </a>
      <a class="ch-out" href="#/well/${next.id}" data-well="${next.id}" aria-label="lateral to ${next.name}">
        <span class="ch-out__l"><span class="ch-out__nm">${next.name}</span> →</span>
        <span class="ch-out__k">lateral · ${next.depth} m</span>
      </a>
    </div>
  </nav>

  ${frame.gauge ? `<div class="ch-depth ch-fade" style="--d:60ms">
    <div><span class="ch-depth__v">${well.depth.toFixed(1)}</span><span class="ch-depth__u">M</span></div>
    <div class="ch-depth__cap">below datum</div>
  </div>` : ''}

  ${frame.vault ? '<div class="ch-sky ch-fade" style="--d:100ms">surface · 0.0 m</div>' : ''}

  ${frame.index ? `<aside class="ch-gauge ch-fade" style="--d:160ms" aria-label="shaft index">
    <div class="ch-gauge__ln"></div>
    <div class="ch-gauge__cap">shaft index</div>
    ${REAL.map((w) => tickRow(w, well.id, ctx.store)).join('')}
  </aside>` : ''}`;
  return { el, prev, next, pos, variant };
}

// ---------------------------------------------------------------------------
export default {
  id: 'chamber',

  async enter(ctx) {
    const id = (ctx.payload && ctx.payload.wellId) || '';
    if (id === 'seventh') { ctx.go('seventh', { from: 'chamber' }, { replace: true }); return; }
    const well = byId(id);
    if (!well || !ROOM_IDS.includes(id)) { ctx.go('surface', { from: 'chamber' }, { replace: true }); return; }

    const { fx, audio, root } = ctx;
    const reduced = !!fx.reducedMotion;

    // The first painted frame is the plunge: opaque black from the moment the root exists,
    // never the page colour, never a cross-fade, whatever the room module costs to load.
    root.style.animation = 'none';
    root.style.opacity = '1';
    root.style.background = MOUTH;
    const over = fx.layer(root, 11);
    over.canvas.style.pointerEvents = 'none';
    over.ctx2d.fillStyle = MOUTH;
    over.ctx2d.fillRect(0, 0, over.w, over.h);
    const t0 = performance.now();
    const my = ++gen;

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
    if (my !== gen || !root.isConnected) { try { over.destroy(); } catch {} return; } // left while loading

    const pal = Object.assign({
      ink: '#1B1410', stone: '#2A2019', stoneDark: MOUTH,
      key: HUE[well.hue] || HUE.bone, cone: SAND, bone: '#F2EDE2', dust: '#F2EDE2',
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

    const frame = frameOf(room);
    const stone = fx.layer(root, 1);
    const host = document.createElement('div'); // rooms put their layers/DOM in here
    host.style.cssText = 'position:absolute;inset:0;z-index:3';
    root.appendChild(host);
    const air = fx.layer(root, 5);
    air.canvas.style.pointerEvents = 'none';

    const vig = document.createElement('div');
    vig.className = 'ch-vig';
    if (frame.air) vig.style.background =
      `radial-gradient(ellipse 78% 64% at 50% ${Math.round(42 + depthT(well.depth) * 10)}%,` +
      `rgba(0,0,0,0) 38%, rgba(0,0,0,${(0.42 + depthT(well.depth) * 0.4).toFixed(2)}) 100%)`;
    root.appendChild(vig);

    const { el: ui, pos, variant } = buildUI(well, pal, room, ctx, frame);
    if (reduced) ui.classList.add('ch--still');
    root.appendChild(ui);

    // room DOM goes after the frame UI so the link and exits stay first in tab order
    // (stacking is by z-index, not DOM order)
    const extra = document.createElement('div');
    extra.className = 'ch-extra';
    root.appendChild(extra);
    if (room.ui) {
      extra.innerHTML = typeof room.ui === 'function' ? room.ui() : room.ui;
      if (!frame.notes) extra.querySelectorAll(':scope > .nt').forEach((n) => n.remove());
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

    // every canvas layer handed to the room, destroyed with the frame's own in exit()
    const roomLayers = [];
    st = {
      ctx, well, room, pal, reduced, frame, pos, variant,
      stone, air, over, host, ui, extra, vig, roomLayers,
      takeEl: ui.querySelector('.ch-take'), exitsEl: ui.querySelector('.ch-exits'),
      ropeEnd: null, takeHot: false,
      g: null,
      motes, streaks, dust: [],
      plunging: !reduced, landed: reduced, impacted: reduced, tFall: reduced ? FALL_MS : 0, t0,
      stoneDirty: true, off: [], alive: true, ready: false,
      skyLabelY: 0,
    };
    st.g = geo(st, reduced ? 1 : 0);
    if (frame.walls) {
      // the walls crop the room's DOM too, not just its canvases
      const W = st.g.wall + Math.max(4, Math.round(st.g.wall * 0.34));
      extra.style.clipPath = `inset(0 ${W}px 0 ${W}px)`;
    }

    // --- room gets the frame it is decorating
    if (room.init) {
      try {
        room.init({
          host, extra, geo: () => st.g, pal, frame,
          layer: (z) => { const L = fx.layer(host, z); roomLayers.push(L); return L; },
        });
      } catch (e) { console.warn('[chamber] room init', e); }
    }

    // --- the link: hung, clamped, re-laid whenever it or the exits change size
    layoutTake(st);
    if (typeof ResizeObserver === 'function') {
      const s0 = st;
      const ro = new ResizeObserver(() => { if (s0.alive) layoutTake(s0); });
      if (st.takeEl) ro.observe(st.takeEl);
      if (st.exitsEl) ro.observe(st.exitsEl);
      st.off.push(() => ro.disconnect());
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

    // the link is an object you take — give it a sound; hot = the rope thickens
    const takeEl = st.takeEl;
    if (takeEl) {
      const s0 = st;
      const hov = () => audio.tone(room.takeHz || 620, { dur: 0.16, type: 'triangle', gain: 0.1, slideTo: (room.takeHz || 620) * 1.5 });
      const hotOn = () => { s0.takeHot = true; };
      const hotOff = () => { s0.takeHot = takeEl.matches(':hover') || document.activeElement === takeEl; };
      const clk = () => { audio.drip({ pitch: 1.2 }); ctx.store.mark('took:' + well.id); };
      const evs = [['pointerenter', hov], ['focus', hov], ['pointerenter', hotOn], ['focus', hotOn],
        ['pointerleave', hotOff], ['blur', hotOff], ['click', clk]];
      for (const [t, f] of evs) takeEl.addEventListener(t, f);
      st.off.push(() => { for (const [t, f] of evs) takeEl.removeEventListener(t, f); });
    }

    // fonts land late; the stone carries baked type and the link changes size
    document.fonts && document.fonts.ready.then(() => {
      if (st && st.alive && st.ui === ui) { st.stoneDirty = true; layoutTake(st); }
    });

    document.body.classList.add('show-cursor');
    st.off.push(() => document.body.classList.remove('show-cursor'));

    ctx.store.mark(well.id);
    audio.drone('deep');
    const reveal = () => { if (st && st.alive && st.ui === ui) { ui.dataset.ui = '1'; root.dataset.ui = '1'; } };
    if (reduced) {
      reveal();
      over.canvas.style.zIndex = '6';
      audio.thud({ gain: 0.22 });
      ui.dataset.landed = '1';
      root.dataset.landed = '1';
      if (room.onLanded) { try { room.onLanded(); } catch (e) { console.warn(e); } }
    } else {
      const tid = setTimeout(reveal, Math.max(0, REVEAL_MS - (performance.now() - t0)));
      st.off.push(() => clearTimeout(tid));
      audio.noise({ dur: 0.7, gain: 0.07, band: [160, 1100] });
      audio.tone(240, { dur: 0.7, type: 'triangle', gain: 0.07, slideTo: 70 });
    }
    // paint the first frame now, so nothing unpainted can show between here and the next tick
    try { renderOver(over.ctx2d, st, performance.now()); } catch (e) { console.warn('[chamber] over', e); }
    st.ready = true;
  },

  update(dt, t) {
    const s = st;
    if (!s || !s.alive || !s.ready) return;
    const well = s.well, pal = s.pal, fx = s.ctx.fx;

    if (!s.landed) {
      s.tFall = performance.now() - s.t0;
      const p = Math.min(1, s.tFall / FALL_MS);
      s.g = geo(s, p);
      // the stone only moves during the fall when there is a vault to rush past
      if (s.frame.vault) s.stoneDirty = true;
      if (s.plunging && s.tFall >= CUT_MS) {
        // the hard cut from the plunge into the room: no fade, no flash
        s.plunging = false;
        s.over.canvas.style.zIndex = '6';
      }
      if (p >= 1 && !s.impacted) impact(s);
    } else if (s.stoneDirty) {
      s.g = geo(s, 1);
    }

    if (s.stoneDirty) {
      try {
        renderStone(s.stone.ctx2d, s.g, pal, fx.rnd(well.n * 9173 + 7));
        placeSkyLabel(s);
      } catch (e) { console.warn('[chamber] stone', e); }
      s.stoneDirty = !s.landed && s.frame.vault;
    }

    try { renderAir(s.air.ctx2d, s.g, pal, s, t); } catch (e) { console.warn('[chamber] air', e); }

    if (s.room.update) {
      try { s.room.update(dt, t, s.landed); } catch (e) { console.warn('[chamber] room update', e); }
    }

    try { renderOver(s.over.ctx2d, s, t); } catch (e) { console.warn('[chamber] over', e); }
  },

  resize() {
    if (!st || !st.alive) return;
    st.stoneDirty = true;
    layoutTake(st);
    st.g = geo(st, st.landed ? 1 : Math.min(1, st.tFall / FALL_MS));
    if (st.frame.walls) {
      const W = st.g.wall + Math.max(4, Math.round(st.g.wall * 0.34));
      st.extra.style.clipPath = `inset(0 ${W}px 0 ${W}px)`;
    }
    if (st.room.resize) { try { st.room.resize(st.g); } catch (e) { console.warn(e); } }
  },

  exit() {
    gen++;
    const s = st;
    st = null;
    if (!s) return;
    s.alive = false;
    try { s.off.forEach((f) => f()); } catch (e) { console.warn('[chamber] exit', e); }
    try { s.room.dispose && s.room.dispose(); } catch (e) { console.warn('[chamber] room dispose', e); }
    for (const L of [s.stone, s.air, s.over, ...s.roomLayers]) { try { L.destroy(); } catch {} }
    s.roomLayers.length = 0;
    // the leaving chamber stays solid (no fade to the page colour) until the router removes it
    try { s.ctx.root.style.animation = 'none'; s.ctx.root.style.zIndex = '0'; } catch {}
    s.dust.length = 0;
    s.motes.length = 0;
  },
};

function geo(s, p) {
  return geometry(s.ctx.W, s.ctx.H, s.well, p, s.ctx.fx.ease, s.frame, s.ropeEnd);
}

// Place the link: hung from the rope (or by the left wall), never under .ch-exits, never off
// screen. Sizes come from offset* (unaffected by the fade transform). Steps the link down to
// a tighter form (no art, then no host and a smaller verb) when the space between the hole
// and the exits is too short.
const GAP = 14;
function layoutTake(s) {
  const el = s.takeEl;
  if (!el || !s.alive) return;
  const w = window.innerWidth, h = window.innerHeight;
  const hole = s.frame.mouth ? holeOf(w, h, s.well.depth) : null;
  const wall = s.frame.walls ? wallOf(w, s.well.depth) : 0;
  const ex = s.exitsEl;
  const exTop = ex && ex.offsetHeight ? ex.offsetTop : h - 8;
  const maxBottom = exTop - GAP;
  let minTop = hole ? hole.y + hole.r + 22 : 12;

  let bw = 0, bh = 0;
  for (const lvl of [0, 1, 2]) {
    el.classList.toggle('ch-take--t1', lvl >= 1);
    el.classList.toggle('ch-take--t2', lvl >= 2);
    bw = el.offsetWidth; bh = el.offsetHeight;
    if (bh <= maxBottom - minTop) break;
  }
  if (bh > maxBottom - minTop) minTop = 8; // no room for any rope: the link wins

  const pct = (v, size, d) => {
    if (typeof v === 'number') return v;
    const m = /^(-?[\d.]+)(%|px)?$/.exec(String(v || '').trim());
    if (!m) return d;
    return m[2] === '%' ? (parseFloat(m[1]) / 100) * size : parseFloat(m[1]);
  };
  const pos = s.pos || {};
  const cy = pct(pos.top, h, h * 0.66);
  let top = cy - bh / 2;
  top = Math.min(top, maxBottom - bh);
  top = Math.max(top, minTop);

  const inner = wall ? wall + Math.max(4, Math.round(wall * 0.34)) : 0;
  let left;
  if (s.variant === 'side') {
    left = inner + 14;
  } else {
    const cx = pos.left == null || String(pos.left).trim() === '50%' ? (hole ? hole.x : w / 2) : pct(pos.left, w, w / 2);
    left = cx - bw / 2;
  }
  left = Math.min(left, w - inner - 8 - bw);
  left = Math.max(left, Math.min(inner + 8, (w - bw) / 2));
  if (bw > w - 8) left = (w - bw) / 2;

  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';

  // the rope ends at the top of the art (or the text when the art has stepped out)
  const art = el.querySelector('.ch-take__art');
  const anchor = art && art.offsetHeight ? art : el.querySelector('.ch-take__txt') || el;
  const ax = s.variant === 'side' ? anchor.offsetLeft + Math.min(anchor.offsetWidth, 40) / 2 : bw / 2;
  s.ropeEnd = { x: Math.round(left + ax), y: Math.round(top + (anchor === el ? 0 : anchor.offsetTop)) };
  s.g = geo(s, s.landed ? 1 : Math.min(1, s.tFall / FALL_MS));
}

function placeSkyLabel(s) {
  const lab = s.ui.querySelector('.ch-sky');
  if (!lab) return;
  const y = Math.round(s.g.skyCy + s.g.skyR * 0.64 + 16);
  lab.style.top = y + 'px';
}

// Landing: sound, dust and the room's own onLanded. No flash and no camera shake: the
// shake bared the page colour at the edges and the flash blanked a room already showing.
function impact(s) {
  s.impacted = true;
  s.landed = true;
  s.plunging = false;
  s.over.canvas.style.zIndex = '6';
  const { ctx, g } = s;
  const fx = ctx.fx;
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
  s.ui.dataset.ui = '1';
  s.ctx.root.dataset.landed = '1';
  s.ctx.root.dataset.ui = '1';
  s.stoneDirty = true;
  if (s.room.onLanded) { try { s.room.onLanded(); } catch (e) { console.warn('[chamber] onLanded', e); } }
}
