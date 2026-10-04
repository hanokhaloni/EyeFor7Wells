import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
// usage: node _crop.mjs out.png cols "file.png,cx,cy" ...
const out = process.argv[2], cols = +process.argv[3];
const items = process.argv.slice(4).map(s=>{const [f,cx,cy]=s.split(',');return {f,cx:+cx,cy:+cy};});
const W=380,H=150,S=2.2;
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:Math.round(cols*W*S)+40,height:1400} });
const imgs = (await Promise.all(items.map(async(it)=>{
  const d=(await readFile(it.f)).toString('base64');
  const left=it.cx-W/2, top=it.cy-H/2;
  return `<figure><div class=w><img style="left:${-left*S}px;top:${-top*S}px;width:${1440*S}px" src="data:image/png;base64,${d}"></div><figcaption>${it.f.split(/[\\/]/).pop()} @${it.cx},${it.cy}</figcaption></figure>`;
}))).join('');
await p.setContent(`<style>*{margin:0;box-sizing:border-box}body{background:#111;padding:8px;display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;font:700 15px monospace}figure{position:relative;border:1px solid #555}.w{position:relative;overflow:hidden;width:${W*S}px;height:${H*S}px}img{position:absolute;max-width:none}figcaption{background:#000;color:#0f0;padding:2px 6px}</style>${imgs}`);
await p.waitForTimeout(400);
await p.locator('body').screenshot({path:out});
await b.close();
