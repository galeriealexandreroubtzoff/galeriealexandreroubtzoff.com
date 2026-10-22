const header = document.querySelector('.site-header');

// Header shadow once the page scrolls (siteHeader.js).
const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile menu.
document.querySelector('.menu-toggle')?.addEventListener('click', (e) => {
  const open = header.classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', String(open));
});

// Carousels: prev/next bars scroll the track by one viewport.
document.querySelectorAll('.carousel').forEach((c) => {
  const track = c.querySelector('.track');
  c.querySelector('.carousel-bar.prev')?.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth * 0.8 }));
  c.querySelector('.carousel-bar.next')?.addEventListener('click', () => track.scrollBy({ left: track.clientWidth * 0.8 }));
});

// Artwork thumbnails switch the main image.
document.querySelectorAll('.thumb').forEach((btn, _, all) => {
  btn.addEventListener('click', () => {
    const hero = document.querySelector('.hero-btn');
    hero.href = btn.dataset.src;
    hero.querySelector('img').src = btn.dataset.src;
    all.forEach((b) => b.setAttribute('aria-current', String(b === btn)));
  });
});

// Minimal lightbox for links marked data-lightbox.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-lightbox]');
  if (!link) return;
  e.preventDefault();
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${link.getAttribute('href')}" alt="">`;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (ev) => ev.key === 'Escape' && close();
  box.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(box);
});
