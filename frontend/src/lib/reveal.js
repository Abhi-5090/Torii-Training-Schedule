/*
 * Entrance motion, ported from the original board. Elements marked `.rv` are
 * staggered in when they are on screen and held until scrolled to when they
 * are not. A polling backstop guarantees nothing is ever left invisible.
 */
import { RM } from './theme.js';

let pending = [];

function sweep() {
  if (!pending.length) return;
  const h = innerHeight;
  pending = pending.filter(el => {
    if (!el.isConnected) return false;          /* unmounted between frames */
    const r = el.getBoundingClientRect();
    if (r.top < h * 1.02 && r.bottom > -60) { el.classList.add('rv-in'); return false; }
    return true;
  });
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; sweep(); });
}

addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
setInterval(sweep, 500);                        /* backstop: never leave content hidden */

export function reveal(scope) {
  const els = [...(scope || document).querySelectorAll('.rv:not(.rv-in)')];
  let k = 0;
  const h = innerHeight;
  els.forEach(el => {
    if (RM) { el.classList.add('rv-in'); return; }
    const r = el.getBoundingClientRect();
    if (r.top < h * 1.02 && r.bottom > -60) {     /* on screen: stagger in now */
      el.style.setProperty('--rvd', `${(k++ % 10) * 60}ms`);
      el.classList.add('rv-in');
    } else pending.push(el);                      /* below the fold: reveal on scroll */
  });
  requestAnimationFrame(sweep);
}
