// Generates the static site in dist/ from data/site.json.
// Page files mirror the original URLs (e.g. /artists/foo -> dist/artists/foo.html),
// images keep their original /public/... paths and are served from R2 by src/worker.js.
// Markup and components follow the marsa-encheres.com rewrite (app/src), with the gallery's palette.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://www.galeriealexandreroubtzoff.com';
// Public R2 bucket (custom domain). Image paths in data/site.json stay "/public/<key>" and are rewritten to IMAGES_URL/<key>.
const IMAGES_URL = (process.env.IMAGES_URL || 'https://images.galeriealexandreroubtzoff.com').replace(/\/$/, '');
const MAPS_URL = 'https://www.google.com/maps/place/Galerie+Alexandre+Roubtzoff/@36.8820684,10.3296958,17z';
const PHONE = '+216 98 319 324';
const EMAIL = 'galeriealexandreroubtzoff@gmail.com';
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const thumb = (src) => src.replace('/uploads/artworks/', '/uploads/artworks/thumb/');
const artistId = (slug) => slug.match(/-(\d+)$/)?.[1];
const artistBySlug = new Map(site.artists.map((a) => [a.slug, a]));
const worksOf = (slug) => site.artworks.filter((w) => artistId(w.artist) === artistId(slug));
const listedSlugOf = (slug) => site.artists.find((x) => x.listed && artistId(x.slug) === artistId(slug))?.slug || slug;
const artistOf = (w) => artistBySlug.get(listedSlugOf(w.artist)) || artistBySlug.get(w.artist) || { name: '', bio: '', born: '', slug: w.artist };
const artistLabel = (a) => (a.born ? `${a.name} (${a.born})` : a.name);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// "Artist, Title, Technique, 100 x 100 cm." -> { technique, format }
function splitDetails(w) {
  let rest = w.details.replace(/\.\s*$/, '');
  const prefix = `${artistBySlug.get(w.artist)?.name}, ${w.title},`;
  rest = rest.startsWith(prefix) ? rest.slice(prefix.length) : rest.split(',').slice(2).join(',');
  const m = rest.match(/^(.*),\s*([^,]*\d[^,]*cm.*)$/i);
  return { technique: (m ? m[1] : rest).trim(), format: m ? m[2].trim() : '' };
}

const pages = [];
const page = (url, file, title, body, { description = '', image = '' } = {}) => pages.push({ url, file, title, body, description, image });

// ---------- layout (siteHeader.js / siteFooter.js) ----------
const ABOUT = [['/presentation', 'Présentation de la galerie'], ['/inauguration', 'Inauguration'], ['/roubtzoff', 'Qui est Alexandre Roubtzoff ?']];
const NAV = [
  ['/', 'Accueil'],
  ['/catalog', 'Exposition permanente'],
  ['/artists', 'Artistes'],
  ['/events', 'Évènements'],
  ['#', 'À propos', ABOUT],
  ['/contact', 'Nous joindre'],
];
const SOCIAL = [
  ['Facebook', 'https://www.facebook.com/byroubtzoff', 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z'],
  ['Instagram', 'https://www.instagram.com/galerie.alexandre.roubtzoff', 'M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.5.5.7.3 1.2.6 1.7 1.1.5.5.9 1 1.1 1.7.3.7.5 1.4.5 2.5.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.5 2.5-.3.7-.6 1.2-1.1 1.7-.5.5-1 .9-1.7 1.1-.7.3-1.4.5-2.5.5-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.5-.5-.7-.3-1.2-.6-1.7-1.1-.5-.5-.9-1-1.1-1.7-.3-.7-.5-1.4-.5-2.5C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.5-2.5.3-.7.6-1.2 1.1-1.7.5-.5 1-.9 1.7-1.1.7-.3 1.4-.5 2.5-.5C8.9 2 9.3 2 12 2Zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.7.4-1 .7-.3.3-.5.6-.7 1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.4.7.7 1 .3.3.6.5 1 .7.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.4 1-.7.3-.3.5-.6.7-1 .1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7a2.6 2.6 0 0 0-.7-1 2.6 2.6 0 0 0-1-.7c-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1Zm0 3.5a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 1.8a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm5-2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z'],
];
const socialIcon = ([name, href, d]) => `<a href="${href}" target="_blank" rel="noopener" aria-label="${name}"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg></a>`;

function layout({ url, title, body, description, image }) {
  const fullTitle = title ? `${title} · Galerie Alexandre Roubtzoff` : 'Galerie Alexandre Roubtzoff · Art contemporain, La Marsa';
  const desc = description || "Galerie d'art contemporain Alexandre Roubtzoff, Marsa Plage, Tunis. Expositions, artistes et oeuvres.";
  const current = (href) => (href === '/' ? url === '/' : url === href || url.startsWith(href + '/'));
  const navItem = ([href, label, sub]) => sub
    ? `<li class="nav-item"><a class="top-link" href="${sub[0][0]}"${sub.some(([h]) => current(h)) ? ' aria-current="true"' : ''}>${label} <span class="caret">▾</span></a><div class="dropdown">${sub.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</div></li>`
    : `<li class="nav-item"><a class="top-link" href="${href}"${current(href) ? ' aria-current="true"' : ''}>${label}</a></li>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE_URL}${url}">
<meta property="og:site_name" content="Galerie Alexandre Roubtzoff">
<meta property="og:title" content="${esc(title || 'Galerie Alexandre Roubtzoff')}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE_URL}${url}">
${image ? `<meta property="og:image" content="${esc(image)}">\n` : ''}<link rel="icon" href="/favicon.png" type="image/png">\n<link rel="apple-touch-icon" href="/favicon.png">
<link rel="preload" href="/fonts/worksans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
<script>
// Missing image: a thumbnail falls back to the full image (data-fallback), anything else to the placeholder.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  if (img.dataset.fallback) { img.src = img.dataset.fallback; delete img.dataset.fallback; }
  else if (!img.src.endsWith('/placeholder.svg')) img.src = '/placeholder.svg';
}, true);
</script>
</head>
<body>
<header class="site-header">
  <div class="top-bar"><div class="row">
    <span class="links"><a href="${SOCIAL[0][1]}" target="_blank" rel="noopener">Facebook</a><span class="sep">|</span><a href="${SOCIAL[1][1]}" target="_blank" rel="noopener">Instagram</a></span>
  </div></div>
  <div class="masthead">
    <a href="/"><img class="logo" src="/logo.png" alt="Galerie Alexandre Roubtzoff" width="168" height="48"></a>
    <nav class="primary" aria-label="Navigation principale"><ul>${NAV.map(navItem).join('')}</ul></nav>
    <button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false"><span class="bar"></span><span class="bar"></span><span class="bar"></span></button>
  </div>
  <hr>
</header>
<main id="outlet">
${body}
</main>
<footer class="site-footer">
  <div class="cols">
    <div>
      <h3>Nous trouver</h3>
      <p><a class="address" href="${MAPS_URL}" target="_blank" rel="noopener">12, Rue Imam Abou Hanifa<br>Marsa Plage, Tunisie 2078</a></p>
      <p><a href="tel:${PHONE.replace(/\s/g, '')}">${PHONE}</a><br><a href="mailto:${EMAIL}">${EMAIL}</a></p>
      <div class="social">${SOCIAL.map(socialIcon).join('')}</div>
    </div>
    <div>
      <h3>Horaires</h3>
      <p>Du lundi au samedi<br>10h - 19h</p>
      <p class="muted">Fermé les dimanches et jours fériés</p>
    </div>
    <div>
      <h3>Menu</h3>
      ${[['/catalog', 'Exposition permanente'], ['/artists', 'Artistes'], ['/events', 'Évènements'], ...ABOUT, ['/contact', 'Contact']].map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}
    </div>
    <div class="partner-col">
      <h3>Maison de vente</h3>
      <a class="partner" href="https://www.marsa-encheres.com" target="_blank" rel="noopener"><strong>Marsa Enchères</strong><span>Première Maison de Vente en Tunisie</span></a>
    </div>
  </div>
  <p class="copyright">© ${new Date().getFullYear()} Galerie Alexandre Roubtzoff.</p>
</footer>
<script src="/site.js" defer></script>
</body>
</html>
`;
}

// ---------- components ----------
// pageHeader.render.js: title + "Vous êtes ici" breadcrumb in a surface bar.
const pageHeader = (title, trail = []) => `<div class="page-header">
  <h1>${esc(title)}</h1>
  <nav class="breadcrumb" aria-label="Fil d'Ariane"><span class="here">Vous êtes ici:</span>${[['/', 'Accueil'], ...trail].map(([h, l]) => `<a href="${h}">${esc(l)}</a><span class="sep">/</span>`).join('')}<span class="current">${esc(title)}</span></nav>
</div>`;

// artworkCard.render.js: square contained image, artist / title / dimensions, full-width red CTA.
const artworkCard = (w) => {
  const a = artistOf(w);
  const { technique, format } = splitDetails(w);
  const href = `/${w.artist}/${w.id}`;
  return `<div class="card artwork-card">
  <a class="media" href="${href}"><img src="${esc(thumb(w.images[0] || ''))}" data-fallback="${esc(w.images[0] || '')}" alt="${esc(w.title)}" loading="lazy" width="220" height="220"></a>
  <a class="body-link" href="${href}"><div class="body">
    <p class="artist">${esc(artistLabel(a))}</p>
    <p class="title muted">${esc(w.title)}</p>
    ${format || technique ? `<p class="dims muted">${esc([technique, format].filter(Boolean).join(' · '))}</p>` : ''}
  </div></a>
  <a class="cta" href="${href}">Voir l'oeuvre</a>
</div>`;
};
const grid = (items, cls = '') => `<div class="grid ${cls}">\n${items.join('\n')}\n</div>`;

// artistList.js / eventList.js: horizontal rows (media + name + status pill + red link).
const artistRow = (a) => {
  const n = worksOf(a.slug).length;
  return `<a class="row-card artist-row" href="/artists/${a.slug}">
  <div class="row-media square"><img src="${esc(a.photo || '/public/uploads/artists/missing.jpg')}" alt="${esc(a.name)}" loading="lazy"></div>
  <div><h2>${esc(a.name)}</h2>${a.born ? `<p class="muted">Né(e) en ${esc(a.born)}</p>` : ''}
  ${n ? `<span class="status gold">${plural(n, 'oeuvre')}</span>` : ''}
  <span class="cta-link">Voir l'artiste →</span></div>
</a>`;
};
const eventRow = (e) => `<a class="row-card event-row" href="/events/${e.slug}">
  <div class="row-media wide"><img src="${esc(e.cover)}" alt="${esc(e.title)}" loading="lazy"></div>
  <div><h2>${esc(e.title)}</h2><p class="muted">${esc(e.dates)}</p>
  <span class="status ${e.slug === 'exposition-permanente-0' ? 'live' : 'ended'}">${e.slug === 'exposition-permanente-0' ? 'En cours' : 'Terminée'}</span>
  <span class="cta-link">Voir l'exposition →</span></div>
</a>`;

const gallery = (images, alt) => images.length ? `<div class="photo-grid">${images.map((src, i) =>
  `<a href="${esc(src)}" data-lightbox><img src="${esc(src)}" alt="${esc(alt)} ${i + 1}" loading="lazy"></a>`).join('')}</div>` : '';

// homePage.render.js: banner slide (image + gradient + title + CTA) and featured slide.
const bannerSlide = ({ href, image, title, text, cta, ctaClass, external }) => `<a class="banner-slide" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>
  <div class="banner-media"><img src="${esc(image)}" alt=""></div>
  <div class="banner-content"><h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${cta ? `<span class="cta ${ctaClass}">${esc(cta)}</span>` : ''}</div>
</a>`;
const featuredSlide = (w) => {
  const a = artistOf(w);
  return `<a class="featured-slide" href="/${w.artist}/${w.id}">
  <div class="image"><img src="${esc(thumb(w.images[0] || ''))}" data-fallback="${esc(w.images[0] || '')}" alt="${esc(w.title)}" loading="lazy"></div>
  <p class="artist">${esc(artistLabel(a))}</p><p class="title">${esc(w.title)}</p>
  <p class="description">${esc(splitDetails(w).technique)}</p>
</a>`;
};
const carousel = (slides, cls = '') => slides.length ? `<div class="carousel ${cls}">
  <div class="viewport"><div class="track">${slides.join('')}</div>
  ${slides.length > 1 ? '<button class="carousel-bar prev" type="button" aria-label="Précédent">‹</button><button class="carousel-bar next" type="button" aria-label="Suivant">›</button>' : ''}</div>
</div>` : '';

// ---------- home ----------
const listedArtists = site.artists.filter((a) => a.listed);
const pastEvents = site.events.filter((e) => e.slug !== 'exposition-permanente-0');
const [, sideLeft, sideRight] = pastEvents;
const featured = listedArtists.map((a) => worksOf(a.slug)[0]).filter(Boolean);
const sideBanner = (e) => e ? bannerSlide({ href: `/events/${e.slug}`, image: e.cover, title: e.title, text: esc(e.dates), cta: "Voir l'exposition", ctaClass: 'cta-gold' }) : '';

page('/', 'index.html', '', `
<section class="hero-3col">
  <div class="hero-side hero-left">${sideBanner(sideLeft)}</div>
  <div class="hero-center">${bannerSlide({ href: site.hero.link || '/events', image: site.hero.image, title: site.hero.title, text: esc(site.hero.description.split(/<br>/).map((s) => s.trim()).filter(Boolean).slice(1, 4).join(' · ')), cta: 'En savoir plus', ctaClass: 'cta-red', external: !!site.hero.link })}</div>
  <div class="hero-side hero-right">${sideBanner(sideRight)}</div>
</section>
<section class="secondary-hero">
  <h2>Oeuvres marquantes</h2>
  ${carousel(featured.map(featuredSlide), 'featured-carousel')}
  <div class="text-center"><a class="btn secondary" href="/catalog">Voir l'exposition permanente</a></div>
</section>
<section class="services">
  <h2>La galerie</h2>
  <div class="cols">
    <div><h3>Exposer l'art d'aujourd'hui</h3><p>Fondée le 26 novembre 2014 par Seif et Sabrine Chaouch à Marsa Plage, la galerie promeut l'art en Tunisie et fait découvrir les nouveaux talents des arts plastiques, au fil d'expositions personnelles et collectives.</p><div class="text-center"><a class="btn secondary" href="/presentation">En savoir plus</a></div></div>
    <div><h3>Alexandre Roubtzoff</h3><p>La galerie porte le nom du peintre Alexandre Roubtzoff (1884-1949), « le peintre de la Tunisie », inhumé à Tunis, dont la lumière et les scènes de la vie tunisienne ont marqué l'histoire de l'art du pays.</p><div class="text-center"><a class="btn secondary" href="/roubtzoff">En savoir plus</a></div></div>
  </div>
</section>
<section class="press">
  <h2>Évènements récents</h2>
  <div class="grid press-grid">${pastEvents.slice(0, 8).map((e) => `<a class="press-item" href="/events/${e.slug}"><p class="date">${esc(e.dates)}</p><h5>${esc(e.title)}</h5><p class="source">Exposition</p></a>`).join('')}</div>
  <div class="text-center"><a class="btn secondary" href="/events">Tous les évènements</a></div>
</section>`, { image: site.hero.image });

// ---------- artists ----------
page('/artists', 'artists.html', 'Artistes', `<div class="page">${pageHeader('Artistes')}
<div class="list">${listedArtists.map(artistRow).join('\n')}</div></div>`);

for (const a of site.artists) {
  const works = worksOf(a.slug);
  page(`/artists/${a.slug}`, `artists/${a.slug}.html`, a.name, `<div class="page">
${pageHeader(a.name, [['/artists', 'Artistes']])}
<div class="artist-header">
  <img src="${esc(a.photo || '/public/uploads/artists/missing.jpg')}" alt="${esc(a.name)}">
  <div><p class="eyebrow">Artiste</p><h2>${esc(artistLabel(a))}</h2>${works.length ? `<p class="muted">${plural(works.length, 'oeuvre')}</p>` : ''}</div>
</div>
${a.bio ? `<div class="body-content bio"><p>${esc(a.bio)}</p></div>` : ''}
${works.length ? grid(works.map(artworkCard)) : ''}
</div>`, { description: a.bio.slice(0, 160), image: a.photo });
}

// ---------- artworks (artworkDetail.render.js) ----------
for (const w of site.artworks) {
  const a = artistOf(w);
  const listed = listedSlugOf(w.artist);
  const { technique, format } = splitDetails(w);
  const images = w.images.length ? w.images : ['/public/uploads/artworks/missing.jpg'];
  const others = worksOf(w.artist).filter((x) => x.id !== w.id).slice(0, 4);
  page(`/${w.artist}/${w.id}`, `${w.artist}/${w.id}.html`, `${w.title} · ${a.name}`, `<div class="page">
${pageHeader(w.title, [['/artists', 'Artistes'], [`/artists/${listed}`, a.name]])}
<article class="detail">
  <div class="info">
    <p class="eyebrow"><a class="artist-link" href="/artists/${listed}">${esc(artistLabel(a))}</a></p>
    <h1>${esc(w.title)}</h1>
    <ul class="specs">
      ${technique ? `<li><strong>Technique:</strong> ${esc(technique)}</li>` : ''}
      ${format ? `<li><strong>Dimensions:</strong> ${esc(format)}</li>` : ''}
    </ul>
    ${a.bio ? `<details class="bio-section"><summary>Biographie</summary><div class="static-content"><p>${esc(a.bio)}</p></div></details>` : ''}
    <div class="visibility-section">
      <h2>Visibilité &amp; livraison</h2>
      <p>Toutes les oeuvres sont visibles et récupérables à la galerie, au 12, rue Imam Abou Hanifa, Marsa Plage.</p>
      <ul><li><a class="exhibition-link" href="/catalog">Exposition permanente</a></li><li><a class="exhibition-link" href="${MAPS_URL}" target="_blank" rel="noopener">Plan de situation</a></li></ul>
    </div>
  </div>
  <div class="gallery-slot"><div class="gallery">
    <a class="hero-btn" href="${esc(images[0])}" data-lightbox><img class="hero" src="${esc(images[0])}" alt="${esc(w.title)}"></a>
    ${images.length > 1 ? `<div class="thumbs">${images.map((src, i) => `<button type="button" class="thumb" data-src="${esc(src)}" aria-current="${i === 0}"><img src="${esc(thumb(src))}" data-fallback="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
  </div></div>
</article>
${others.length ? `<section class="related"><h2>Du même artiste</h2>${grid(others.map(artworkCard))}</section>` : ''}
</div>`, { description: w.details, image: images[0] });
}

// ---------- events (eventList.js / eventDetail.js) ----------
page('/events', 'events.html', 'Évènements', `<div class="page">${pageHeader('Évènements')}
<div class="list">${site.events.map(eventRow).join('\n')}</div></div>`);

for (const e of site.events) {
  page(`/events/${e.slug}`, `events/${e.slug}.html`, e.title, `<div class="page">
${pageHeader(e.title, [['/events', 'Évènements']])}
<div class="event-header">
  <a class="event-media" href="${esc(e.banner || e.cover)}" data-lightbox><img src="${esc(e.banner || e.cover)}" alt="${esc(e.title)}"></a>
  <div class="header-info"><p class="eyebrow">Exposition</p><p class="dates">${esc(e.dates)}</p>${e.description ? `<div class="static-content">${e.description}</div>` : ''}</div>
</div>
${e.images.length ? `<section class="related"><h2>Galerie photos</h2>${gallery(e.images, e.title)}</section>` : ''}
</div>`, { description: e.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160), image: e.cover });
}

// ---------- permanent exhibition ----------
page('/catalog', 'catalog.html', site.catalog.title, `<div class="page">
${pageHeader(site.catalog.title)}
<div class="event-header">
  ${site.catalog.banner ? `<a class="event-media" href="${esc(site.catalog.banner)}" data-lightbox><img src="${esc(site.catalog.banner)}" alt="${esc(site.catalog.title)}"></a>` : ''}
  <div class="header-info"><p class="eyebrow">En cours à la galerie</p><p class="dates">${plural(site.artworks.length, 'oeuvre')}</p><div class="static-content">${site.catalog.description}</div></div>
</div>
${grid(site.artworks.map(artworkCard))}
</div>`);

// ---------- text pages ----------
for (const [slug, p] of Object.entries(site.pages)) {
  // The archived pages open with <h6>overhead</h6><h1>title</h1>: the h1 becomes the page header.
  const m = p.html.match(/^\s*<h6>(.*?)<\/h6>\s*<h1>(.*?)<\/h1>/s);
  const html = m ? `<p class="eyebrow">${m[1]}</p>${p.html.slice(m[0].length)}` : p.html;
  page(`/${slug}`, `${slug}.html`, p.title, `<div class="page">${pageHeader(m ? m[2].replace(/<[^>]+>/g, '') : p.title)}
<article class="body-content static-content prose page-${slug}">${html}</article></div>`);
}

page('/404', '404.html', 'Page introuvable', `<div class="page">${pageHeader('Page introuvable')}
<div class="body-content"><p>Cette page n'existe pas ou plus.</p><p><a class="btn" href="/">Retour à l'accueil</a></p></div></div>`);

// ---------- write ----------
// Empty dist/ rather than deleting it, so a running preview server keeps serving the same directory.
fs.mkdirSync(DIST, { recursive: true });
for (const entry of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, entry), { recursive: true, force: true });
for (const p of pages) {
  const file = path.join(DIST, p.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, layout(p).replace(/(["'])\/public\//g, `$1${IMAGES_URL}/`));
}
fs.cpSync(path.join(ROOT, 'static'), DIST, { recursive: true });

const sitemap = pages.filter((p) => p.url !== '/404').map((p) => `  <url><loc>${SITE_URL}${p.url}</loc></url>`).join('\n');
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// List of every image the pages reference, i.e. what has to be uploaded to R2 (key = path without /public/).
const rows = new Map();
const need = (src, kind, context, pageUrl) => { if (src && !rows.has(src)) rows.set(src, [src.replace(/^\/public\//, ''), kind, context, pageUrl]); };
need(site.hero.image, 'banner', site.hero.title, '/');
need(site.catalog.banner, 'event', site.catalog.title, '/catalog');
site.artists.forEach((a) => need(a.photo, 'artist', a.name, `/artists/${a.slug}`));
site.artworks.forEach((w) => w.images.forEach((src) => need(src, 'artwork', `${artistOf(w).name} - ${w.title}`, `/${w.artist}/${w.id}`)));
site.events.forEach((e) => [e.cover, e.banner, ...e.images].forEach((src) => need(src, 'event', e.title, `/events/${e.slug}`)));
Object.entries(site.pages).forEach(([slug, p]) => [...p.html.matchAll(/src="([^"]+)"/g)].forEach((m) => need(m[1], 'page', p.title, `/${slug}`)));
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(ROOT, 'data/images-needed.csv'), ['r2_key,type,context,page', ...[...rows.values()].map((r) => r.map(csv).join(','))].join('\n') + '\n');

console.log(`${pages.length} pages written to dist/, ${rows.size} images listed in data/images-needed.csv`);
