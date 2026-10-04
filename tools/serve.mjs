// Static dev server for the 7 Wells site.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.argv[3] || 'site';
const PORT = Number(process.argv[2] || 4747);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const safe = normalize(p).split(/[/\\]+/).filter((s) => s && s !== '..').join('/');
    const file = join(ROOT, safe);
    let body;
    try { body = await readFile(file); }
    catch { // try .html extension, else 404
      try { body = await readFile(file + '.html'); }
      catch { res.writeHead(404, {'content-type':'text/plain'}); return res.end('404 ' + p); }
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'access-control-allow-origin': '*',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500, {'content-type':'text/plain'}); res.end(String(e));
  }
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}/ root=${ROOT}`));
