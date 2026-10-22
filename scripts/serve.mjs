// Minimal static server for the production build (supports a base path, e.g. /shotrova/).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2] ?? 'dist';
const port = Number(process.argv[3] ?? 4173);
const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  '.gz': 'application/gzip', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (!p.startsWith(base)) {
      res.writeHead(302, { Location: base });
      return res.end();
    }
    p = p.slice(base.length - 1);
    if (req.method === 'POST' && p === '/share-target') {
      // Only reached when no service worker is active.
      res.writeHead(303, { Location: `${base}#/import` });
      return res.end();
    }
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(normalize(root))) throw new Error('bad path');
    const s = await stat(file);
    if (!s.isFile()) throw new Error('not file');
    const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Length': s.size };
    if (p === '/sw.js' || p.endsWith('.html')) headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}${base}`));
