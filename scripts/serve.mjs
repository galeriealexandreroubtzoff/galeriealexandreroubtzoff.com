// Local preview of dist/ with Cloudflare Pages' behaviour: /foo serves foo.html (or foo/index.html),
// _redirects rules (exact paths and trailing /* splats), 404.html for anything else.
// Usage: npm run dev  (or node scripts/serve.mjs [port])
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const PORT = Number(process.argv[2]) || 8787;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};

// Read on every request, so a rebuild is picked up without restarting.
function redirects() {
  const file = path.join(DIST, '_redirects');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const [from, to, status = '302'] = l.split(/\s+/); return { from, to, status: Number(status) }; });
}

function matchRedirect(pathname) {
  for (const r of redirects()) {
    if (r.from === pathname) return r;
    if (r.from.endsWith('/*') && pathname.startsWith(r.from.slice(0, -1))) {
      return { ...r, to: r.to.replace(':splat', pathname.slice(r.from.length - 1)) };
    }
  }
  return null;
}

const isFile = (p) => p.startsWith(DIST) && fs.existsSync(p) && fs.statSync(p).isFile();

function resolve(pathname) {
  const base = path.join(DIST, decodeURIComponent(pathname));
  for (const candidate of [base, `${base}.html`, path.join(base, 'index.html')]) if (isFile(candidate)) return candidate;
  return null;
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const redirect = matchRedirect(pathname);
  let file = null;
  let status = 200;
  if (redirect) {
    res.writeHead(redirect.status, { location: redirect.to }).end();
  } else {
    file = resolve(pathname);
    if (!file) { file = path.join(DIST, '404.html'); status = 404; }
    res.writeHead(status, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }
  console.log(`${redirect ? redirect.status : status} ${req.method} ${req.url}${redirect ? ` -> ${redirect.to}` : ''}`);
}).listen(PORT, () => console.log(`Serving dist/ on http://localhost:${PORT}`));
