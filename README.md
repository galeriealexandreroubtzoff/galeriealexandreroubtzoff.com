# galeriealexandreroubtzoff.com

Static rebuild of the 2023–2025 site, recovered from the Wayback Machine (the OVH hosting was deleted, no backup).
The archived pages were extracted once into `data/site.json` and then deleted; the originals remain on web.archive.org.
No server code: the pages are a **Cloudflare Pages** project, the images a **public R2 bucket**
(`galeriealexandreroubtzoff-images`, separate from Marsa Enchères') served at `images.galeriealexandreroubtzoff.com`.

## Layout

| Path | What |
|---|---|
| `data/site.json` | **Content source of truth**: artists, artworks, events, text pages. Edit this. |
| `data/images-needed.csv` | Every image the site references, with its R2 key and the page it appears on |
| `scripts/build.mjs` | `data/site.json` + `static/` → `dist/` (one HTML file per original URL) |
| `scripts/serve.mjs` | Local preview of `dist/` with Pages' routing and `_redirects` |
| `scripts/upload-images.mjs` | Uploads `images/` to the R2 bucket (S3 API) |
| `static/` | CSS, JS, fonts, logo, favicon, placeholder, `_redirects` |
| `images/` | Local images to upload to R2 (path = R2 key) |

No dependencies: plain Node (>= 22) scripts using only built-in modules. No `npm install`.

Design: the marsa-encheres.com rewrite (`app/src`), brown instead of navy, gold and red accents.

## Images

`data/site.json` keeps the original paths (`/public/uploads/artworks/abc.jpg`); the build rewrites them to
`https://images.galeriealexandreroubtzoff.com/uploads/artworks/abc.jpg` (override with `IMAGES_URL=... npm run build`).
Old `/public/*` URLs redirect there (`static/_redirects`).

To add one: find its key in `data/images-needed.csv`, save the file under `images/` with that path
(e.g. `images/uploads/artworks/abc.jpg`) and run `npm run upload-images`. No rebuild or redeploy needed.
A missing image shows the placeholder; a missing thumbnail (`uploads/artworks/thumb/…`) falls back to the full
image, so thumbnails are optional. Both are handled in the browser (inline script in each page's `<head>`).

## Commands

```sh
npm run build          # regenerate dist/
npm run dev            # build + local preview on http://localhost:8787
npm run upload-images  # upload images/ to R2 (needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
```

## Deploying

In the Marsa Enchères Cloudflare dashboard:
1. **R2** > Create bucket `galeriealexandreroubtzoff-images`. R2 > Manage API tokens > create an
   "Object Read & Write" token limited to that bucket, for `npm run upload-images` (keep the keys in a local `.env`, never committed).
2. **Workers & Pages** > Create > Pages > **Upload assets**, project name `galeriealexandreroubtzoff`,
   then drop the `dist/` folder (after `npm run build`). Each later deploy: the project > Create deployment > drop `dist/` again.
   Live on `https://galeriealexandreroubtzoff.pages.dev`.

Domain: add `galeriealexandreroubtzoff.com` to the account (Free plan) and switch the nameservers at OVH
(DNSSEC off first). The registration stays at OVH for now (just renewed); transfer it to Cloudflare Registrar later.
Email is not set up on this domain: drop the imported OVH `MX` records and the OVH `1|www…` TXT, keep the
`google-site-verification` TXT, and add the "no mail" records so nobody can send email pretending to be the domain:
`MX @ 0 .` (null MX), `TXT @ "v=spf1 -all"`, `TXT _dmarc "v=DMARC1; p=reject;"`. Remove them when email is set up.

Then:
- Pages project > Custom domains: `www.galeriealexandreroubtzoff.com` and `galeriealexandreroubtzoff.com`
- R2 bucket > Settings > Custom domains: `images.galeriealexandreroubtzoff.com`
- Rules > Redirect Rules: `galeriealexandreroubtzoff.com/*` → `https://www.galeriealexandreroubtzoff.com/$1` (301)
