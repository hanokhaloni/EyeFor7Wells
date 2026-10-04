# Technical contract — read before writing any code

Everyone codes against this. It lets separate builders work on separate files in parallel
without conflicts. **Do not edit files you do not own.** If you need something from
another file that does not exist yet, code against the API documented here and assume it
will be there.

## Hard rules

- **Vanilla ES modules. No build step, no bundler, no npm runtime deps, no frameworks.**
  The site must run from `node tools/serve.mjs` as plain static files.
- **No external asset files.** No images, no audio files, no video. Everything is drawn
  (canvas / SVG / CSS) and every sound is synthesized in WebAudio. The only permitted
  external request is Google Fonts.
- **One viewport, no page scroll.** `html,body{overflow:hidden;height:100%}`. The stage is
  a fixed full-viewport surface. If a chamber needs more content than fits, it scrolls
  *inside its own container*, never the page.
- **Must not throw.** A thrown error in one scene must not take down the site. Guard your
  `enter`/`exit`.
- **Performance budget:** hold 60fps at 1440×900 on an integrated GPU. Use one `requestAnimationFrame`
  loop via the engine (below), never your own `setInterval` render loop.
- **Respect `prefers-reduced-motion`**: `fx.reducedMotion` is a boolean. When true, skip
  camera shake, heavy parallax, and flashing; keep the content reachable.

## File layout and ownership

```
site/
  index.html            [ENGINE]   shell, font links, canvas + #stage, module entry
  engine/
    boot.js             [ENGINE]   entry point, raf loop, wires everything
    router.js           [ENGINE]   scene registry + transitions
    bus.js              [ENGINE]   tiny pub/sub
    audio.js            [ENGINE]   WebAudio synth voices
    fx.js               [ENGINE]   grain, vignette, shared canvas helpers, reducedMotion
    store.js            [ENGINE]   persisted visitor state (localStorage, guarded)
    tokens.css          [ENGINE]   palette + type tokens + shared primitives
  scenes/
    boot-intro.js       [INTRO]    the title sequence
    surface.js          [SURFACE]  the night-desert hub with seven wells
    chamber.js          [CHAMBERS] shared chamber frame + the six real channel rooms
    chambers/*.js       [CHAMBERS] one module per channel room
    seventh.js          [SEVENTH]  the secret well
  data/
    wells.js            [ENGINE]   the seven well definitions (shared, read-only for all)
```

## `data/wells.js` — the shared source of truth

```js
export const WELLS = [
  { id:'whatsapp', n:1, name:'WHATSAPP', he:'וואטסאפ', role:'the daily chatter',
    url:'https://chat.whatsapp.com/DU2DApJcDDZIFhOYTUpZhT', hue:'water', depth:12 },
  { id:'discord',  n:2, name:'DISCORD',  he:'דיסקורד', role:'the voice channel',
    url:'https://discord.gg/PVbek2WN', hue:'water', depth:30 },
  { id:'meetup',   n:3, name:'MEETUP',   he:'מיטאפ',  role:'the southern game programming meetup',
    url:'https://www.meetup.com/the-southern-game-programming-meetup-group/', hue:'sand', depth:21 },
  { id:'youtube',  n:4, name:'YOUTUBE',  he:'יוטיוב',  role:'talks, recorded',
    url:'https://www.youtube.com/channel/UCCHR_ulaDIIODgsqyg4o5DA', hue:'rust', depth:44 },
  { id:'instagram',n:5, name:'INSTAGRAM',he:'אינסטגרם',role:'what it looks like',
    url:'https://www.instagram.com/7wellsindies', hue:'sand', depth:9 },
  { id:'facebook', n:6, name:'FACEBOOK', he:'פייסבוק', role:'the oldest well',
    url:'https://www.facebook.com/7WellsIndies/', hue:'rust', depth:70 },
  { id:'seventh',  n:7, name:'',         he:'',        role:'dry',
    url:null, hue:'bone', depth:null },
];
```

## Scene module API

Every scene is a default-exported object:

```js
export default {
  id: 'surface',
  // Called when the scene becomes active. `root` is an empty <div class="scene"> already
  // attached to #stage. Return nothing or a Promise.
  enter(ctx) {},
  // Per-frame. dt = ms since last frame (clamped to <= 50). Optional.
  update(dt, t) {},
  // Viewport changed. Optional.
  resize(w, h) {},
  // Called before the scene is removed. Must release timers/listeners. `root` is removed
  // for you afterwards. Optional.
  exit() {},
};
```

### `ctx` passed to `enter`

| field | what |
|---|---|
| `ctx.root` | your `<div class="scene">`. Put everything inside it. |
| `ctx.go(id, payload)` | transition to another scene. `payload` arrives as `ctx.payload`. |
| `ctx.payload` | whatever the previous scene passed to `go()`. |
| `ctx.bus` | `.on(evt, fn) -> off`, `.emit(evt, data)` |
| `ctx.audio` | see below |
| `ctx.fx` | see below |
| `ctx.store` | `.get(key, dflt)`, `.set(key, val)`, `.seen(id) -> bool`, `.mark(id)` |
| `ctx.W`, `ctx.H` | current viewport size |

### `ctx.audio`

Synth only — no files. Muted until the visitor unmutes; calls are safe while muted.

```js
audio.enabled          // bool
audio.toggle()
audio.drone(name, on)  // 'surface' | 'deep' | 'seventh' — sustained bed, crossfaded
audio.tone(hz, {dur=0.2, type='sine', gain=0.3, slideTo, delay=0})
audio.noise({dur=0.3, gain=0.2, band=[200,2000]})   // filtered noise: stone, wind, dust
audio.drip({pitch=1})                                // the signature water drip
audio.thud({gain=0.5})                               // low impact, for landings
```

### `ctx.fx`

```js
fx.reducedMotion       // bool
fx.layer(z)            // -> a <canvas> sized to the viewport, appended to your root, DPR-correct.
                       //    returns {canvas, ctx2d, w, h}; auto-resized for you.
fx.shake(ms, amount)   // camera shake on #stage (no-op under reducedMotion)
fx.flash(color, ms)    // full-screen flash
fx.grain(on)           // toggle the global film-grain overlay
fx.ease                // {outCubic, inCubic, inOutCubic, outBack, outElastic} : t->t
fx.lerp(a,b,t)  fx.clamp(v,a,b)  fx.rand(a,b)  fx.rnd(seed)  // seeded PRNG factory
```

### `tokens.css` — available to every scene

```css
--night --night-2 --deep --bone --sand --rust --water
--font-display  /* Anton */   --font-mono /* IBM Plex Mono */   --font-he /* Heebo */
```
Plus `.scene` (absolute full-bleed layer), `.chalk` (chalk-line stroke filter),
`.mono-label` (small uppercase tracked mono label).

## Routing

Scene ids: `boot-intro`, `surface`, `chamber` (payload `{wellId}`), `seventh`.
The router also reflects the active scene into `location.hash` (`#/surface`,
`#/well/discord`) so a state can be linked and reloaded. Deep-linking straight to a
chamber must work.

## Definition of done for any piece

It runs, it does not throw, it holds framerate, it looks like the brief, and it survives
a critic who screenshots it. Capture proof with `node tools/cap.mjs` before you report.
