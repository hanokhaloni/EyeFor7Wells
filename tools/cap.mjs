#!/usr/bin/env node
/**
 * cap.mjs - screenshot / clip / contact-sheet harness for the 7 Wells site.
 *
 *   node tools/cap.mjs shot  <url> <out.png> [--vw 1440] [--vh 900] [--wait 2500] [--full]
 *   node tools/cap.mjs strip <url> <out.png> [--frames 12] [--every 180] [--tile 4x3] [--wait 1200]
 *   node tools/cap.mjs story <story.json | - | '{inline json}'>
 *
 * story.json shape:
 * {
 *   "name": "home", "url": "http://localhost:4747/", "viewport": [1440,900],
 *   "out": "capture/home", "video": true, "deviceScaleFactor": 1,
 *   "steps": [
 *     {"wait": 2000},
 *     {"shot": "01-landing", "full": false},
 *     {"move": [700,420]}, {"hover": "#x"}, {"click": "#x"}, {"clickAt": [10,20]},
 *     {"key": "Escape"}, {"type": ["#input","hello"]}, {"scroll": 600},
 *     {"strip": {"name":"03-motion","frames":12,"every":160,"tile":"4x3"}},
 *     {"eval": "document.title"},
 *     {"text": "02-copy"}
 *   ]
 * }
 * Writes PNGs, an optional .webm clip + .gif, and <name>.log.json (console, errors, evals).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { spawn } from 'node:child_process';

const FFMPEG = [
  process.env.FFMPEG_PATH,
  'C:/Users/Hanokh.Aloni/AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe',
].find((p) => p && existsSync(p));

const sh = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'ignore'] });
  p.on('close', (c) => res(c));
  p.on('error', () => res(-1));
});

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const has = (flag) => process.argv.includes(flag);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Contact sheet is composited in a throwaway browser page: the bundled ffmpeg
// build has no `tile` filter, and this keeps the harness dependency-free.
async function tileFrames(ctx, buffers, outPng, cols) {
  const imgs = buffers.map((b, i) =>
    '<figure><img src="data:image/png;base64,' + b.toString('base64') + '">' +
    '<figcaption>' + (i + 1) + '</figcaption></figure>').join('');
  const sheet = await ctx.newPage();
  await sheet.setContent(
    '<style>*{margin:0;box-sizing:border-box}body{background:#141414;padding:10px;' +
    'display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:10px;' +
    'font:600 13px ui-monospace,monospace}' +
    'figure{position:relative;border:1px solid #333;line-height:0}' +
    'img{width:100%;height:auto;display:block}' +
    'figcaption{position:absolute;left:0;top:0;background:#000c;color:#0f0;padding:2px 7px;line-height:1.4}' +
    '</style>' + imgs, { waitUntil: 'load' });
  await sheet.waitForTimeout(250);
  await sheet.locator('body').screenshot({ path: outPng });
  await sheet.close();
  return outPng;
}

async function captureStrip(ctx, page, outPng, opts) {
  const frames = opts.frames || 12;
  const every = opts.every || 180;
  const buffers = [];
  for (let i = 1; i <= frames; i++) {
    buffers.push(await page.screenshot());
    if (i < frames) await sleep(every);
  }
  return tileFrames(ctx, buffers, outPng, opts.cols || Math.min(4, frames));
}

async function runStory(story) {
  const out = story.out || join('capture', story.name || 'story');
  await mkdir(out, { recursive: true });
  const vw = (story.viewport && story.viewport[0]) || 1440;
  const vh = (story.viewport && story.viewport[1]) || 900;
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'],
  });
  const ctxOpts = {
    viewport: { width: vw, height: vh },
    deviceScaleFactor: story.deviceScaleFactor || 1,
  };
  if (story.video) ctxOpts.recordVideo = { dir: join(out, '_vid'), size: { width: vw, height: vh } };
  const ctx = await browser.newContext(ctxOpts);

  const log = { name: story.name, url: story.url, console: [], errors: [], evals: [], shots: [] };
  const page = await ctx.newPage();
  page.on('console', (m) => log.console.push(('[' + m.type() + '] ' + m.text()).slice(0, 400)));
  page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 600)));
  page.on('requestfailed', (r) => {
    const why = (r.failure() && r.failure().errorText) || '';
    log.errors.push(('REQFAIL ' + r.url() + ' ' + why).slice(0, 400));
  });

  try {
    await page.goto(story.url, { waitUntil: 'load', timeout: 45000 });
  } catch (e) {
    log.errors.push('GOTO: ' + String(e).slice(0, 300));
  }

  const steps = story.steps || [{ wait: 2500 }, { shot: 'shot' }];
  let n = 0;
  for (const step of steps) {
    n++;
    try {
      if (step.wait != null) await sleep(step.wait);
      if (step.shot) {
        const file = join(out, step.shot + '.png');
        await page.screenshot({ path: file, fullPage: !!step.full });
        log.shots.push(file);
      }
      if (step.strip) {
        const file = join(out, (step.strip.name || 'strip') + '.png');
        log.shots.push(await captureStrip(ctx, page, file, step.strip));
      }
      if (step.move) await page.mouse.move(step.move[0], step.move[1], { steps: 12 });
      if (step.hover) await page.hover(step.hover, { timeout: 5000 });
      if (step.click) await page.click(step.click, { timeout: 6000 });
      if (step.clickAt) await page.mouse.click(step.clickAt[0], step.clickAt[1]);
      if (step.dblclick) await page.dblclick(step.dblclick, { timeout: 6000 });
      if (step.key) await page.keyboard.press(step.key);
      if (step.type) await page.fill(step.type[0], step.type[1]);
      if (step.scroll != null) await page.mouse.wheel(0, step.scroll);
      if (step.goto) await page.goto(step.goto, { waitUntil: 'load', timeout: 30000 });
      if (step.eval) log.evals.push({ step: n, code: step.eval, value: await page.evaluate(step.eval) });
      if (step.text) {
        const t = await page.evaluate(() => document.body.innerText);
        await writeFile(join(out, step.text + '.txt'), t);
      }
    } catch (e) {
      log.errors.push('STEP ' + n + ' ' + JSON.stringify(step).slice(0, 120) + ': ' + String(e).slice(0, 220));
    }
  }

  await ctx.close();
  await browser.close();

  if (story.video) {
    const vdir = join(out, '_vid');
    try {
      const files = (await readdir(vdir)).filter((f) => f.endsWith('.webm'));
      if (files[0]) {
        const dst = join(out, (story.name || 'clip') + '.webm');
        await writeFile(dst, await readFile(join(vdir, files[0])));
        log.video = dst;
        if (FFMPEG) {
          const gif = dst.replace(/\.webm$/, '.gif');
          await sh(FFMPEG, ['-y', '-i', dst, '-vf',
            'fps=10,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', gif]);
          if (existsSync(gif)) log.gif = gif;
        }
        await rm(vdir, { recursive: true, force: true });
      }
    } catch (e) {
      log.errors.push('VIDEO: ' + String(e).slice(0, 200));
    }
  }

  await writeFile(join(out, (story.name || 'story') + '.log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify({
    out: out, shots: log.shots, video: log.video, gif: log.gif,
    errors: log.errors, consoleTail: log.console.slice(-25), evals: log.evals,
  }, null, 2));
}

const mode = process.argv[2];

if (mode === 'shot') {
  const target = process.argv[4] || 'capture/shot.png';
  await runStory({
    name: basename(target, '.png'),
    url: process.argv[3],
    out: dirname(target),
    viewport: [Number(arg('--vw', 1440)), Number(arg('--vh', 900))],
    steps: [
      { wait: Number(arg('--wait', 2500)) },
      { shot: basename(target, '.png'), full: has('--full') },
    ],
  });
} else if (mode === 'strip') {
  const target = process.argv[4] || 'capture/strip.png';
  await runStory({
    name: basename(target, '.png'),
    url: process.argv[3],
    out: dirname(target),
    viewport: [Number(arg('--vw', 1440)), Number(arg('--vh', 900))],
    steps: [
      { wait: Number(arg('--wait', 1200)) },
      { strip: {
          name: basename(target, '.png'),
          frames: Number(arg('--frames', 12)),
          every: Number(arg('--every', 180)),
          tile: arg('--tile'),
        } },
    ],
  });
} else if (mode === 'story') {
  const a = process.argv[3];
  let raw;
  if (a === '-') {
    raw = await new Promise((r) => {
      let s = '';
      process.stdin.on('data', (d) => { s += d; });
      process.stdin.on('end', () => r(s));
    });
  } else if (a.trim().startsWith('{')) {
    raw = a;
  } else {
    raw = await readFile(a, 'utf8');
  }
  await runStory(JSON.parse(raw));
} else {
  console.log('usage: node tools/cap.mjs shot|strip|story ...  (see header of tools/cap.mjs)');
  process.exit(1);
}
