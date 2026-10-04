#!/usr/bin/env node
/**
 * progress.mjs — builds docs/progress.html from docs/progress.json.
 *
 *   node tools/progress.mjs
 *
 * Screenshots are downscaled and re-encoded to JPEG data URIs in a headless browser so
 * the page is fully self-contained (publishable as an Artifact, which forbids external
 * assets). Missing files are skipped with a warning rather than failing the build.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';

const MANIFEST = 'docs/progress.json';
const OUT = 'docs/progress.html';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

// --- collect every image referenced anywhere in the manifest -----------------
const wanted = new Set();
for (const w of manifest.waves || []) {
  for (const p of w.pieces || []) {
    for (const s of p.shots || []) wanted.add(s.src);
    for (const c of p.compare || []) { wanted.add(c.a.src); wanted.add(c.b.src); }
  }
}

const present = [...wanted].filter((f) => {
  if (existsSync(f)) return true;
  console.warn('[progress] missing, skipping:', f);
  return false;
});

// --- downscale + encode in a browser ----------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body></body>');

const encoded = {};
for (const file of present) {
  const b64 = (await readFile(file)).toString('base64');
  try {
    encoded[file] = await page.evaluate(async ({ b64, maxW }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.74);
    }, { b64, maxW: manifest.maxWidth || 1000 });
  } catch (e) {
    console.warn('[progress] could not encode', file, String(e).slice(0, 80));
  }
}
await browser.close();

const bytes = Object.values(encoded).reduce((n, d) => n + d.length, 0);
console.log(`[progress] ${Object.keys(encoded).length} images, ~${(bytes / 1.37e6).toFixed(1)} MB inlined`);

// --- render -----------------------------------------------------------------
const figure = (s, cls = '') => {
  const d = encoded[s.src];
  if (!d) return '';
  return `<figure class="shot ${cls}">
    <img src="${d}" alt="${esc(s.cap || basename(s.src))}" loading="lazy">
    <figcaption>${esc(s.cap || basename(s.src))}</figcaption>
  </figure>`;
};

const pieceHtml = (p) => `
<section class="piece" id="${esc(p.id)}">
  <header class="piece__head">
    <h3>${esc(p.title)}</h3>
    <span class="chip chip--${esc(p.state || 'wip')}">${esc(p.state || 'wip')}</span>
    <span class="rev mono">rev ${esc(p.rev ?? 1)}</span>
  </header>
  ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
  ${p.gap ? `<p class="gap"><span class="gap__k mono">biggest gap</span>${esc(p.gap)}</p>` : ''}
  ${(p.shots || []).length ? `<div class="grid">${(p.shots || []).map((s) => figure(s)).join('')}</div>` : ''}
  ${(p.compare || []).map((c) => `
    <div class="compare">
      <div class="compare__k mono">${esc(c.label || 'A / B')}${c.verdict ? ` — <strong>${esc(c.verdict)}</strong>` : ''}</div>
      <div class="grid grid--2">${figure(c.a, 'ab')}${figure(c.b, 'ab')}</div>
    </div>`).join('')}
</section>`;

const waveHtml = (w) => `
<section class="wave">
  <h2><span class="mono wave__n">${esc(w.n)}</span>${esc(w.title)}</h2>
  ${w.summary ? `<p class="lead">${esc(w.summary)}</p>` : ''}
  ${(w.pieces || []).map(pieceHtml).join('')}
  ${(w.playtest || []).length ? `
    <div class="playtest">
      <h4 class="mono">first-time visitor playtest</h4>
      <ul>${w.playtest.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>` : ''}
</section>`;

const html = `<title>7 Wells Build Log</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;600&family=Heebo:wght@400;900&display=swap" rel="stylesheet">
<style>
:root{
  --night:#0B0E1A; --night-2:#141A2E; --deep:#050710;
  --bone:#F2EDE2; --sand:#E8873A; --rust:#B8341F; --water:#3BE8B0;
  --ink:#141A2E; --paper:#F2EDE2; --line:#0B0E1A22; --dim:#141A2E99;
  --bg:var(--paper); --fg:var(--ink);
  --mono:'IBM Plex Mono',ui-monospace,Consolas,monospace;
  --disp:'Anton','Arial Narrow',Impact,sans-serif;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:var(--night); --fg:var(--bone); --line:#F2EDE222; --dim:#F2EDE299;
  }
}
:root[data-theme="dark"]{ --bg:var(--night); --fg:var(--bone); --line:#F2EDE222; --dim:#F2EDE299; }
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 var(--mono);
  padding:48px 24px 120px;}
.wrap{max-width:1080px;margin:0 auto}
.mono{font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.7}
h1{font-family:var(--disp);font-size:clamp(44px,9vw,104px);line-height:.88;letter-spacing:.01em;
   margin:0 0 6px;text-transform:uppercase}
h1 .he{font-family:'Heebo',sans-serif;font-weight:900;display:block;font-size:.42em;opacity:.55;letter-spacing:0}
.sub{max-width:62ch;color:var(--dim);margin:18px 0 0}
hr{border:0;border-top:1px solid var(--line);margin:44px 0}
h2{font-family:var(--disp);font-size:30px;text-transform:uppercase;letter-spacing:.02em;
   margin:0 0 4px;display:flex;align-items:baseline;gap:14px}
.wave__n{font-size:11px;color:var(--sand);opacity:1}
.lead{color:var(--dim);margin:0 0 26px;max-width:70ch}
.piece{border-top:1px solid var(--line);padding:22px 0 8px}
.piece__head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
h3{font-family:var(--disp);font-size:19px;text-transform:uppercase;letter-spacing:.04em;margin:0;font-weight:400}
.chip{font:600 9px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;
  padding:5px 8px;border:1px solid currentColor;border-radius:2px}
.chip--done{color:var(--water)} .chip--wip{color:var(--sand)} .chip--blocked{color:var(--rust)}
.rev{margin-left:auto}
.note{margin:12px 0 0;max-width:72ch}
.gap{margin:12px 0 0;padding:10px 14px;border-left:3px solid var(--rust);background:#B8341F14;max-width:78ch}
.gap__k{display:block;color:var(--rust);opacity:1;margin-bottom:3px}
.grid{display:grid;gap:14px;margin:18px 0 6px;
  grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.grid--2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
figure{margin:0}
.shot img{width:100%;height:auto;display:block;border:1px solid var(--line);background:var(--deep)}
figcaption{font:400 10px/1.5 var(--mono);letter-spacing:.12em;text-transform:uppercase;
  color:var(--dim);padding-top:7px}
.ab img{border-color:var(--sand)}
.compare{margin:22px 0;padding:16px;border:1px dashed var(--line)}
.compare__k{opacity:1;margin-bottom:4px}
.playtest{margin:26px 0 0;padding:16px 18px;border:1px solid var(--line);background:#3BE8B00e}
.playtest h4{margin:0 0 10px;opacity:1;color:var(--water)}
.playtest ul{margin:0;padding-left:18px}
.playtest li{margin-bottom:7px}
footer{margin-top:60px;color:var(--dim);font-size:11px}
a{color:var(--sand)}
</style>
<div class="wrap">
<h1>7 Wells<span class="he">באר שבע — build log</span></h1>
<p class="sub">${esc(manifest.blurb || '')}</p>
<p class="mono">updated ${esc(manifest.updated || '')} · ${esc(manifest.status || '')}</p>
<hr>
${(manifest.waves || []).slice().reverse().map(waveHtml).join('<hr>')}
<footer>Captured from the running site with Playwright — every image on this page is a real
screenshot or a contact sheet of real frames, not a mockup.</footer>
</div>`;

await writeFile(OUT, html);
console.log('[progress] wrote', OUT);
