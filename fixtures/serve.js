import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };

/** Static file server for the local mock site. Used by e2e demo and tests. */
export function createFixtureServer(port = 8971) {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, 'booking-site', decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(ROOT + path.sep + 'booking-site') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () =>
    resolve({ server, baseUrl: `http://127.0.0.1:${port}` })));
}

// `node fixtures/serve.js` serves the mock site standalone (for manual experiments).
if (import.meta.url === `file://${process.argv[1]}`) {
  createFixtureServer().then(({ baseUrl }) => console.log(`serving ${baseUrl} — Ctrl+C to stop`));
}
