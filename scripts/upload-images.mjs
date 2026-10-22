// Uploads every file under images/ to the R2 bucket through its S3-compatible API, using the file's path as the key.
// images/uploads/artworks/65369392a71d7.jpg  ->  https://images.galeriealexandreroubtzoff.com/uploads/artworks/65369392a71d7.jpg
//
// Needs an R2 API token (dashboard: R2 > Manage API tokens > Object Read & Write, this bucket only):
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run upload-images
// Files already in the bucket with the same content are skipped.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'images');
const BUCKET = 'galeriealexandreroubtzoff-images';
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (see the comment at the top of this file).');
  process.exit(1);
}
// The bucket was created with EU jurisdiction, which has its own S3 endpoint.
const HOST = `${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`;

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

// AWS Signature Version 4, region "auto", service "s3".
function signedRequest(method, key, body = '', headers = {}) {
  const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = now.slice(0, 8);
  const pathname = `/${BUCKET}/${encodeKey(key)}`;
  const all = { host: HOST, 'x-amz-content-sha256': sha256(body), 'x-amz-date': now, ...headers };
  const names = Object.keys(all).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const canonical = [method, pathname, '', names.map((h) => `${h}:${lower[h]}\n`).join(''), names.join(';'), lower['x-amz-content-sha256']].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonical)].join('\n');
  const signingKey = ['auto', 's3', 'aws4_request'].reduce(hmac, hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, date));
  const signature = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return fetch(`https://${HOST}${pathname}`, { method, headers: { ...all, authorization }, body: method === 'PUT' ? body : undefined });
}

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR, { recursive: true }).filter((f) => fs.statSync(path.join(DIR, f)).isFile()) : [];
let uploaded = 0, skipped = 0, failed = 0;
for (const rel of files) {
  const key = rel.split(path.sep).join('/');
  const type = TYPES[path.extname(key).toLowerCase()];
  if (!type) { console.warn(`skip ${key} (not an image)`); skipped++; continue; }
  const body = fs.readFileSync(path.join(DIR, rel));
  const md5 = crypto.createHash('md5').update(body).digest('hex');
  const head = await signedRequest('HEAD', key);
  if (head.ok && head.headers.get('etag')?.replace(/^W\//, '').replace(/"/g, '') === md5) { skipped++; continue; }
  const res = await signedRequest('PUT', key, body, { 'content-type': type, 'cache-control': 'public, max-age=86400' });
  if (res.ok) { console.log(`uploaded ${key}`); uploaded++; }
  else { console.error(`FAILED ${key}: ${res.status} ${await res.text()}`); failed++; }
}
console.log(`${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
process.exit(failed ? 1 : 0);
