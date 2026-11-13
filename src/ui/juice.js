// Efectos de recompensa («juice»): que cada logro se note y apetezca seguir.
//   combo      la racha de toques (rules.comboTap: cada toque seguido rinde más, hasta +50%) se ve en un contador
//              con la bonificación y un sonido cada vez más agudo; a los 10 toques y al llegar al máximo, celebración
//   reward     una lluvia de iconos vuela hasta el contador de jalea, que late y sube poco a poco
//   celebrate  cartel grande con confeti: noche superada, jefe derrotado, récord, la reina crece, evolución…
//   buzz       vibración corta en el móvil en los momentos fuertes
// Solo es presentación: lo que el juego da de más (la racha) se calcula en las reglas.
import { icon } from './icons.js';
import * as Audio from '../audio/audio.js';
import { BAL } from '../game/data.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 720px)');

/** Vibración corta (móvil). */
export function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* nada */ } }

/* ---------- racha de toques ---------- */
let comboEl = null, hideT = null;

/**
 * Muestra la racha: n toques seguidos y su multiplicador (de rules.comboTap). cap: toques en los que llega
 * al máximo (BAL.comboCap + 1).
 */
export function tap(n, mult, cap = 21) {
  if (!n || n < 3) return;
  Audio.play('combo', n);
  if (!comboEl) { comboEl = document.createElement('div'); comboEl.id = 'combo'; $('fx').appendChild(comboEl); }
  const mark = BAL.comboMarks.find(([at]) => at === n), topped = n >= cap && n < BAL.comboMarks[0][0];
  const tier = n >= cap ? 3 : n >= 14 ? 2 : n >= 8 ? 1 : 0;
  comboEl.className = 'combo t' + tier + (n >= 1000 ? ' long' : '');
  comboEl.innerHTML = `<small>RACHA</small><b>×${n}</b><em>${topped ? 'MÁX · ' : ''}+${Math.round((mult - 1) * 100)}%</em>`;
  comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
  clearTimeout(hideT);
  hideT = setTimeout(() => { if (comboEl) comboEl.classList.add('out'); }, 900);
  const pct = Math.round((mult - 1) * 100);
  if (mark) { celebrate('¡Racha de ' + n + '!', 'Bonus extra · tus toques rinden +' + pct + '%', 'record'); buzz([30, 40, 30]); }
  else if (narrow.matches) { if (n === 10) buzz(25); else if (n === cap) buzz([30, 40, 30]); }
  else if (n === 10) { celebrate('¡Buen ritmo!', 'Racha de 10 · tus toques rinden +' + pct + '%', 'combo'); buzz(25); }
  else if (n === cap) { celebrate('¡Racha máxima!', 'Tus toques rinden +' + pct + '%', 'combo'); buzz([30, 40, 30]); }
}

/* ---------- la recompensa vuela al contador ---------- */
/**
 * Lanza `n` iconos desde (x, y) de la pantalla hasta el contador `target` (id del número, p. ej. 'vJelly'),
 * que late al recibir cada uno.
 */
export function reward(x, y, n = 10, target = 'vJelly', ic = 'leaf') {
  const dest = $(target);
  if (!dest || reduced) return;
  const r = dest.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  const pill = dest.closest('.pill') || dest;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'reward';
    el.innerHTML = icon(ic);
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 70;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.setProperty('--sx', Math.cos(a) * d + 'px'); el.style.setProperty('--sy', Math.sin(a) * d - 30 + 'px');
    el.style.setProperty('--tx', tx - x + 'px'); el.style.setProperty('--ty', ty - y + 'px');
    const delay = i * 55 + Math.random() * 60;
    el.style.animationDelay = delay + 'ms';
    document.body.appendChild(el);
    setTimeout(() => { pill.classList.remove('gain'); void pill.offsetWidth; pill.classList.add('gain'); Audio.play('coin', i); }, delay + 750);
    setTimeout(() => el.remove(), delay + 900);
  }
}

/* ---------- celebraciones ---------- */
const TIERS = { combo: 1, night: 1, goal: 1, record: 2, stage: 2, feast: 3, boss: 3, evolve: 3, win: 4 };
let showing = null;

/**
 * Cartel grande con confeti. kind decide el color y la fuerza: 'night' | 'goal' | 'record' | 'stage' |
 * 'boss' | 'evolve' | 'win' | 'combo'. Si ya hay uno más importante en pantalla, el flojo no lo tapa.
 */
export function celebrate(title, sub, kind = 'night', extra = '') {
  const tier = TIERS[kind] || 1, box = $('fx');
  if (!box) return;
  if (showing && showing.tier > tier && performance.now() - showing.t < 1800) return;
  box.querySelectorAll('.celebrate').forEach(e => e.remove());
  const el = document.createElement('div');
  el.className = 'celebrate ' + kind;
  el.innerHTML = `<div class="ribbon"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}${extra}</div>`;
  box.appendChild(el);
  showing = { tier, t: performance.now() };
  if (!reduced) confetti(tier >= 3 ? 90 : tier === 2 ? 55 : 28, kind);
  if (tier >= 2) Audio.play('fanfare', tier);
  if (tier >= 3) buzz([40, 60, 40]);
  setTimeout(() => el.classList.add('out'), tier >= 3 ? 2600 : 1900);
  setTimeout(() => el.remove(), tier >= 3 ? 3200 : 2500);
  return el;
}

const PALETTE = {
  night: ['#ffd76a', '#b8f07a', '#fff6dc'], goal: ['#b8f07a', '#ffd76a'], record: ['#ffd76a', '#ff9a4a', '#fff6dc'],
  stage: ['#ffd76a', '#ff7aa8', '#fff6dc'], boss: ['#ff6a4a', '#ffd76a', '#fff6dc', '#b8f07a'],
  evolve: ['#c99bff', '#7ad8ff', '#ffd76a', '#fff6dc'], win: ['#ffd76a', '#ff6a4a', '#7ad8ff', '#b8f07a', '#c99bff'], combo: ['#ffd76a', '#ff9a4a'],
  feast: ['#ffcf4a', '#fff6dc', '#ff9a4a', '#b8f07a']
};
function confetti(n, kind) {
  const box = $('fx'), cols = PALETTE[kind] || PALETTE.night;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = 50 + (Math.random() - 0.5) * 30 + '%';
    c.style.background = cols[i % cols.length];
    c.style.setProperty('--dx', (Math.random() - 0.5) * 900 + 'px');
    c.style.setProperty('--dy', -(200 + Math.random() * 380) + 'px');
    c.style.setProperty('--r', (Math.random() - 0.5) * 1440 + 'deg');
    c.style.animationDelay = Math.random() * 0.15 + 's';
    c.style.width = 6 + Math.random() * 6 + 'px'; c.style.height = 10 + Math.random() * 8 + 'px';
    box.appendChild(c);
    setTimeout(() => c.remove(), 2300);
  }
}
