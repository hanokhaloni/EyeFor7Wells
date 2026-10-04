// Entry point: wires bus/audio/fx/store/router and owns the single rAF loop.
import { makeBus } from './bus.js';
import { makeFx } from './fx.js';
import { makeAudio } from './audio.js';
import { store } from './store.js';
import { makeRouter, parseHash } from './router.js';

const stage = document.getElementById('stage');
const bus = makeBus();
const fx = makeFx(stage);
const audio = makeAudio(bus);

const router = makeRouter({
  stage,
  ctxBase: { bus, audio, fx, store },
});

// --- sound toggle -----------------------------------------------------------
const soundBtn = document.getElementById('sound');
const paintSound = () => {
  soundBtn.dataset.on = String(audio.enabled);
  soundBtn.setAttribute('aria-pressed', String(audio.enabled));
  soundBtn.querySelector('.sound__word').textContent = audio.enabled ? 'sound on' : 'sound off';
};
soundBtn.addEventListener('click', () => { audio.toggle(); paintSound(); });
bus.on('audio:toggle', paintSound);
paintSound();

// --- single frame loop ------------------------------------------------------
let last = performance.now();
const frame = (now) => {
  const dt = Math.min(50, now - last);
  last = now;
  router.update(dt, now);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

window.addEventListener('resize', () => router.resize(window.innerWidth, window.innerHeight));

// --- first scene ------------------------------------------------------------
// A deep link skips the intro. A returning visitor who has already seen it does too.
const deep = parseHash();
if (deep) {
  router.go(deep.id, deep.payload, { fromHash: true });
} else {
  router.go('boot-intro', {});
}

// Escape always returns to the surface — the one rule the visitor can rely on.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && router.id !== 'surface' && router.id !== 'boot-intro') {
    router.go('surface', { from: router.id });
  }
});

// Expose for the capture harness and for debugging.
window.SEVEN = { router, bus, audio, fx, store };
