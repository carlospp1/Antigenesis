// Tutorial de bienvenida: un foco recorre lo importante (la reina, la cría, la jalea, el día y la noche,
// la racha, el Árbol y el Linaje) con una burbuja de una línea por paso. Pausa el juego mientras dura.
// Sale solo en la primera partida (antigenesis.tourDone) y se puede repetir desde la Guía.
import * as Scene from '../scene/index.js';
import * as Audio from '../audio/audio.js';
import { ui } from './hud.js';

const $ = id => document.getElementById(id);
const KEY = 'antigenesis.tourDone';

/** Un rectángulo de pantalla alrededor de un punto de la escena (r: medio lado en píxeles; dx: desplazamiento en radios). */
const around = (p, r, dx = 0) => { const s = Scene.toScreen(p); return { x: s.x - r + dx * r, y: s.y - r, w: r * 2, h: r * 2, round: true }; };
const box = el => { if (!el || el.hidden) return null; const b = el.getBoundingClientRect(); return b.width ? { x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 } : null; };
const size = () => Math.max(48, Math.min(innerWidth, innerHeight) * 0.11);

const STEPS = [
  { title: 'La reina', text: 'Tócala para darle de comer. Cuando come lo suficiente, pone un huevo.', at: () => around(Scene.entityPos('queen'), size() * 1.2, 0.35) },
  { title: 'La cría', text: 'Toca huevos y larvas para que se conviertan antes en hormigas.', at: () => around(Scene.anchors().eggs, size(), 0.5) },
  { title: 'Jalea', text: 'Tus hormigas traen comida. Lo que guardan en la despensa es jalea.', at: () => box($('vJelly')?.closest('.pill')) },
  { title: 'Día y noche', text: 'Al anochecer llegan enemigos y todas tus hormigas salen a defender el nido.', at: () => box($('clock')) },
  { title: 'El Árbol', text: 'Gasta la jalea en mejoras para tu colonia.', at: () => box($('tabTree')) },
  { title: 'El Linaje', text: 'Si la reina cae, ganas ADN para mejoras que duran para siempre.', at: () => box($('tabEvo')) },
  { title: '¡A por ello!', text: 'Haz crecer tu colonia y aguanta cada noche.', at: () => null, last: true }
];

let run = null;

/** ¿Hay que enseñarlo? (primera vez) */
export function tourPending() { try { return !localStorage.getItem(KEY); } catch (e) { return false; } }

export function startTour() {
  if (run) return;
  // se marca como visto nada más salir: aunque se recargue o se cierre a medias, no vuelve a salir solo
  try { localStorage.setItem(KEY, '1'); } catch (e) { /* nada */ }
  const el = document.createElement('div');
  el.id = 'tour';
  el.innerHTML = `<div class="tour-hole"></div>
    <div class="tour-tip panel" role="dialog" aria-live="polite">
      <div class="tour-head"><span class="tour-step"></span><button class="tour-skip" type="button">Saltar</button></div>
      <h3></h3><p></p>
      <div class="tour-foot"><div class="tour-dots">${STEPS.map(() => '<i></i>').join('')}</div><button class="btn-green tour-next" type="button">Siguiente</button></div>
    </div>`;
  document.body.appendChild(el);
  run = { el, i: 0, paused: ui.paused, raf: 0 };
  ui.paused = true;
  el.querySelector('.tour-next').onclick = next;
  el.querySelector('.tour-skip').onclick = finish;
  run.key = e => { if (e.key === 'Escape') finish(); else if (e.key === 'Enter' || e.key === 'ArrowRight') next(); };
  addEventListener('keydown', run.key);
  show(0);
  const follow = () => { if (!run) return; place(); run.raf = requestAnimationFrame(follow); };
  run.raf = requestAnimationFrame(follow);
}

function next() {
  if (!run) return;
  Audio.play('click');
  if (run.i >= STEPS.length - 1) finish(); else show(run.i + 1);
}

function finish() {
  if (!run) return;
  cancelAnimationFrame(run.raf); removeEventListener('keydown', run.key);
  ui.paused = run.paused;
  const el = run.el; run = null;
  el.classList.add('out'); setTimeout(() => el.remove(), 350);
}

function show(i) {
  const s = STEPS[i], el = run.el, tip = el.querySelector('.tour-tip');
  run.i = i;
  el.querySelector('.tour-step').textContent = `Paso ${i + 1} de ${STEPS.length}`;
  el.querySelector('h3').textContent = s.title;
  el.querySelector('p').textContent = s.text;
  el.querySelector('.tour-next').textContent = s.last ? 'Empezar' : 'Siguiente';
  el.querySelector('.tour-skip').hidden = !!s.last;
  el.querySelectorAll('.tour-dots i').forEach((d, k) => d.classList.toggle('on', k <= i));
  tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
  place();
}

/** Coloca el foco sobre el objetivo y la burbuja al lado (encima o debajo, según donde haya sitio). */
function place() {
  const s = STEPS[run.i], el = run.el, hole = el.querySelector('.tour-hole'), tip = el.querySelector('.tour-tip');
  const r = s.at();
  if (!r) { // sin objetivo: foco cerrado en el centro y la burbuja en medio
    Object.assign(hole.style, { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '0px', height: '0px' });
    hole.classList.remove('round');
    Object.assign(tip.style, { left: Math.max(16, (innerWidth - tip.offsetWidth) / 2) + 'px', top: Math.max(16, (innerHeight - tip.offsetHeight) / 2) + 'px' });
    tip.dataset.side = 'none';
    return;
  }
  Object.assign(hole.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  hole.classList.toggle('round', !!r.round);
  const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 16, cx = r.x + r.w / 2;
  const below = r.y + r.h / 2 < innerHeight / 2;
  let top = below ? r.y + r.h + gap : r.y - th - gap;
  top = Math.max(12, Math.min(innerHeight - th - 12, top));
  const left = Math.max(12, Math.min(innerWidth - tw - 12, cx - tw / 2));
  Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
  tip.dataset.side = below ? 'below' : 'above';
  tip.style.setProperty('--arrow', Math.max(18, Math.min(tw - 18, cx - left)) + 'px');
}
