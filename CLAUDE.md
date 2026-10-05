# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An original site for **7 Wells Indies**, the Be'er Sheva indie game dev community. The creative bar is the classic Eye4U Flash site. Be'er Sheva means "well of seven", so the site is a night desert with seven wells: six are the community's real channels (data in `site/data/wells.js`), and the seventh is a dowsing puzzle. Read `docs/BRIEF.md` for the creative intent and `docs/CONTRACT.md` for the binding technical rules before changing anything.

## Commands

```sh
npm install                      # only dev dependency is Playwright (used by tools/, never by the site)
node tools/serve.mjs             # static server: http://localhost:4747/  (args: [port] [root], default 4747 site)
node tools/cap.mjs shot  <url> <out.png> [--vw 1440 --vh 900 --wait 2500 --full]
node tools/cap.mjs strip <url> <out.png> [--frames 12 --every 180 --tile 4x3]   # motion as a contact sheet
node tools/cap.mjs story <story.json | '{inline json}'>                          # scripted steps + .log.json of console/page errors
node tools/_sheet.mjs <out.png> <img...>                                         # tile screenshots into one labelled sheet
node tools/progress.mjs          # rebuild docs/progress.html (self-contained build log) from docs/progress.json
```

There is no build step, linter or test suite. Verification is done by driving the running site with Playwright (tools/cap.mjs or scratch scripts) and **looking at the screenshots**. Check `*.log.json` for page errors. Put scratch output under `capture/`, which is gitignored. Deep-link routes: `#/` (intro), `#/surface`, `#/well/<id>` (a chamber), `#/seventh`. Clear `localStorage` (key `7wells.v1`) to get a first-visit intro.

The dev server is shared by every process testing the site. Never kill all `node` processes to free a port.

## Architecture

Vanilla ES modules, served as static files: no bundler, no framework, no runtime deps, no asset files (everything is drawn on canvas/SVG/CSS; all audio is WebAudio synthesis). The only external request allowed is Google Fonts.

**Engine (`site/engine/`)**
- `boot.js` owns the single `requestAnimationFrame` loop. Scenes must never run their own loop.
- `router.js` lazily imports scenes, so a broken scene can't stop boot. It mirrors scenes to the hash and passes each scene a `ctx`.
  - `ctx.go(id, payload, opts)` changes scene. `opts.cut` is a hard cut with no cross-fade; `opts.replace` is a redirect that adds no history entry.
  - A `go()` that arrives mid-transition is queued (latest wins), not dropped.
- `fx.js`:
  - `fx.layer(parent, z)` returns DPR-correct canvases that are refit on resize. Every layer must be `destroy()`ed on exit or it leaks and keeps being refit.
  - Also provides `fx.reducedMotion`, grain, shake and flash.
- `audio.js`: synth voices and drones. It is muted until the visitor opts in, and calls are safe while muted.
- `store.js`: visitor state persisted in localStorage, guarded.

**Scenes (`site/scenes/`)**
- Each scene default-exports `{ id, enter(ctx), update(dt, t), resize(w, h), exit() }`. The full API is in `docs/CONTRACT.md`.
- `exit()` must release every listener, timer, layer and audio node.
- Scenes must not throw: wrap per-frame work, but don't swallow errors silently forever.
- `boot-intro.js`: the title sequence on a wall-clock cue timeline. Only hidden tabs and gaps over 1s pause it. It hands off to the surface with a hard cut.
- `surface.js`: the hub. Well size comes from each well's depth, and the lamp reveals annotation only. Name plates must never overlap, and taps resolve to the nearest well. The seventh, once found here, is stored as `seventh.located`.
- `chamber.js` + `chambers/<id>.js`: one shared frame plus a room module per channel.
  - A room returns a config object: `pal`, `take` (the channel link: `verb`, `cta`, `variant: hang|plate|side`), `ui`, `init`, `update` and `dispose`.
  - `frame: { vault, gauge, notes, index, title, air, mouth, walls }` switches off pieces of the shared frame, which defaults to everything on.
  - `chambers/_shared.js` is the shared drawing kit (colour, type, depth-to-light).
- `seventh.js`: the dowsing puzzle. `seventh.found` means "dug" and belongs to this scene only.

**Rules the critics and reviews converged on** (also in `docs/CONTRACT.md`):
- Use the site night palette with flat fills: ground `#1B1410`, wadi `#5A3418`, sand `#DEA668` (light), mouth `#060403`, bone `#F2EDE2`, accent `#FF5C14`. Each room keeps its own committed 3-colour palette.
- Anti-mud floor: names ≥7:1 without the lamp, mouth rims ≥3:1, wadi ≥1.6:1. Darkness must never be the content.
- No invented facts: no member counts, tallies, LIVE states, dated posts or community history.
- One viewport, no page scroll. Check 320×568, 568×320, 390×844, 1440×900 and 2560×1440, plus reduced motion and touch.

## Docs and history

- `docs/progress.json` is the build log manifest (waves, pieces, critic gaps, screenshot paths); `docs/progress.html` is generated from it. `ref/` holds the captured Eye4U reference frames.
- Critic and code-review reports from past rounds live under `capture/*/REPORT.md` locally (not in git).
- `.gitattributes` disables line-ending rewriting (`* -text`).

## Commits

Commit as the local git user (Hanokh.Aloni) with no Claude co-author trailer. History is one commit per piece, with a short imperative subject (`Surface: …`, `Chambers: …`) and a wrapped body explaining what changed and why.
