// Shared visual helpers: canvas layers, grain, shake, flash, easing, seeded noise.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

// Deterministic PRNG so a scene can look hand-placed but identical every load.
export const rnd = (seed = 1) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

export function makeFx(stage) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layers = new Set();

  const fx = {
    get reducedMotion() { return mq.matches; },
    ease, lerp, clamp, rand, rnd,

    // A DPR-correct canvas sized to the viewport, auto-resized, appended to `parent`.
    layer(parent, z = 0) {
      const canvas = document.createElement('canvas');
      canvas.className = 'fx-layer';
      canvas.style.zIndex = String(z);
      const ctx2d = canvas.getContext('2d');
      const L = { canvas, ctx2d, w: 0, h: 0, dpr: 1 };
      const fit = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        L.w = window.innerWidth; L.h = window.innerHeight; L.dpr = dpr;
        canvas.width = Math.round(L.w * dpr);
        canvas.height = Math.round(L.h * dpr);
        canvas.style.width = L.w + 'px';
        canvas.style.height = L.h + 'px';
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      fit();
      L.fit = fit;
      layers.add(L);
      L.destroy = () => { layers.delete(L); canvas.remove(); };
      (parent || stage).appendChild(canvas);
      return L;
    },

    shake(ms = 300, amount = 8) {
      if (fx.reducedMotion) return;
      const t0 = performance.now();
      const step = () => {
        const p = (performance.now() - t0) / ms;
        if (p >= 1) { stage.style.transform = ''; return; }
        const a = amount * (1 - p);
        stage.style.transform = `translate(${rand(-a, a)}px, ${rand(-a, a)}px)`;
        requestAnimationFrame(step);
      };
      step();
    },

    flash(color = '#F2EDE2', ms = 160) {
      const el = document.createElement('div');
      el.className = 'fx-flash';
      el.style.background = color;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '0'; el.style.transition = `opacity ${ms}ms linear`; });
      setTimeout(() => el.remove(), ms + 60);
    },

    grain(on) { document.body.classList.toggle('no-grain', !on); },

    _resizeAll() { for (const L of layers) L.fit(); },
  };

  window.addEventListener('resize', () => fx._resizeAll());
  return fx;
}
