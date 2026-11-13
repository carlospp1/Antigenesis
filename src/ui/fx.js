// Efectos grandes en pantalla para los momentos de suerte (×2, ×5, comida dorada, hormiga dorada)
// y la mano fantasma que da de comer sola.
import { icon } from './icons.js';

const $ = id => document.getElementById(id);
const PRIO = { x2: 1, harvest: 1, x5: 3, gold: 3, shiny: 4 };
let last = { t: 0, p: 0 };

/**
 * Estallido en el centro: rayos girando, destello y un texto enorme que rebota.
 * kind: 'x2' | 'harvest' | 'x5' | 'gold' | 'shiny'
 */
export function burst(big, small, kind, at) {
  const now = performance.now(), p = PRIO[kind] || 1;
  if (!at) { if (now - last.t < 700 && p <= last.p) return; last = { t: now, p }; } // en el centro: no tapar uno mejor con uno peor
  const box = $('fx');
  if (!at) box.querySelectorAll('.burst:not(.local)').forEach(b => b.remove());
  const el = document.createElement('div');
  el.className = 'burst ' + kind + (at ? ' local' : '');
  if (at) { el.style.left = at.x + 'px'; el.style.top = at.y + 'px'; } // en el sitio donde pasó
  el.innerHTML = `<i class="rays"></i><i class="flash"></i><b>${big}</b>${small ? `<span>${small}</span>` : ''}`;
  box.appendChild(el);
  for (let i = 0; i < (at ? 8 : p >= 3 ? 22 : 12); i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * (p >= 3 ? 260 : 160);
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
    s.style.animationDelay = Math.random() * 0.12 + 's';
    el.appendChild(s);
  }
  if (p >= 3 && !at) document.body.classList.add('shake'), setTimeout(() => document.body.classList.remove('shake'), 400);
  setTimeout(() => el.remove(), 1500);
}

/** La mano fantasma aparece, toca y se desvanece. Como mucho 3 a la vez en pantalla. */
export function ghostHand(x, y) {
  const box = $('fx'), old = box.querySelectorAll('.ghosthand');
  if (old.length >= 3) old[0].remove();
  const el = document.createElement('div');
  el.className = 'ghosthand';
  el.innerHTML = icon('ghost');
  el.style.left = x + 'px'; el.style.top = y + 'px';
  box.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
