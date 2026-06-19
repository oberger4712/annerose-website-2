import Lenis from 'lenis';

export let lenis = null;

export function initScroll() {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  initNavHighlight();
}

// Highlight the nav link that matches the currently visible section.
function initNavHighlight() {
  const sections = [
    { id: 'werke',   link: document.querySelector('a[href="#werke"]') },
    { id: 'uber',    link: document.querySelector('a[href="#uber"]') },
    { id: 'kontakt', link: document.querySelector('a[href="#kontakt"]') },
  ];

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      sections.forEach((s) => s.link?.classList.remove('nav-link--active'));
      const active = sections.find((s) => s.id === e.target.id);
      active?.link?.classList.add('nav-link--active');
    });
  }, { rootMargin: '-20% 0px -65% 0px' });

  sections.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

// Call this after gallery cards are added to the DOM.
// Assigns staggered delays and starts observing each .reveal element.
export function observeRevealElements(container) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  requestAnimationFrame(() => {
    container.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
  });
}
