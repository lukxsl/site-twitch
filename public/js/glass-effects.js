/* ASEMTET0 Glass Arcade: reflexo e inclinação suaves para mouse/trackpad. */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (reducedMotion || !finePointer) return;

  const selector = '.card, .home-masthead, .home-portrait, .admin-menu-card2, .cm-perk, .community-stat-card, .rk-pod';
  let active = null;
  let pending = null;
  let raf = 0;

  const reset = (element) => {
    if (!element) return;
    element.removeAttribute('data-glass-hover');
    element.style.removeProperty('--glass-x');
    element.style.removeProperty('--glass-y');
    element.style.removeProperty('--glass-tilt-x');
    element.style.removeProperty('--glass-tilt-y');
  };

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const element = event.target instanceof Element ? event.target.closest(selector) : null;
    if (active && active !== element) reset(active);
    active = element;
    if (!element) return;

    pending = { element, x: event.clientX, y: event.clientY };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!pending) return;
      const { element: target, x, y } = pending;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
      target.style.setProperty('--glass-x', `${(px * 100).toFixed(1)}%`);
      target.style.setProperty('--glass-y', `${(py * 100).toFixed(1)}%`);
      target.style.setProperty('--glass-tilt-y', `${((px - .5) * 2.4).toFixed(2)}deg`);
      target.style.setProperty('--glass-tilt-x', `${((.5 - py) * 1.8).toFixed(2)}deg`);
      target.setAttribute('data-glass-hover', 'true');
      pending = null;
    });
  }, { passive: true });

  document.addEventListener('pointerout', (event) => {
    if (!active || !(event.target instanceof Element)) return;
    const leaving = event.target.closest(selector);
    if (leaving && !leaving.contains(event.relatedTarget)) {
      reset(leaving);
      if (active === leaving) active = null;
    }
  }, { passive: true });

  window.addEventListener('blur', () => { reset(active); active = null; }, { passive: true });
})();
