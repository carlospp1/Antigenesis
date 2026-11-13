// Final del juego: la secuencia entera.
//   1. el diorama (scene/ending.js): la reina sale del nido y las hormigas la rodean; la cámara se eleva
//   2. el planeta: un globo de puntos que gira y se va cubriendo de colonias desde el nido
//   3. la pantalla de victoria de siempre (#winView)
// Tocar en cualquier momento salta al final.
import * as Scene from '../scene/index.js';
import * as Audio from '../audio/audio.js';
import { fmtTime } from '../core/format.js';

const $ = id => document.getElementById(id);
const DIORAMA = 7.5;   // segundos en el diorama antes de pasar al planeta
const SPREAD = 7;      // segundos que tarda la conquista en cubrir el planeta
let run = null;

/** Arranca la secuencia; onDone se llama al acabar o al saltarla. */
export function playEnding({ gen, time, onDone }) {
  cancelEnding();
  Scene.startEnding();
  run = { onDone, timer: setTimeout(() => showPlanet(gen, time), DIORAMA * 1000), raf: 0, el: null };
  // saltar: un toque en la escena (con un pequeño margen para no saltarlo sin querer al ganar tocando)
  run.skip = () => finish();
  setTimeout(() => { if (run) $('stage').addEventListener('pointerdown', run.skip, { once: true }); }, 600);
}

/** Quita todo sin avisar (partida nueva, por ejemplo). */
export function cancelEnding() {
  if (!run) return;
  clearTimeout(run.timer); cancelAnimationFrame(run.raf);
  $('stage').removeEventListener('pointerdown', run.skip);
  if (run.resize) removeEventListener('resize', run.resize);
  if (run.el) run.el.remove();
  Scene.stopEnding();
  run = null;
}

function finish() {
  if (!run) return;
  const done = run.onDone;
  cancelEnding();
  if (done) done();
}

/* ---------- el planeta ---------- */
function showPlanet(gen, time) {
  if (!run) return;
  const el = document.createElement('div');
  el.id = 'endingView';
  el.innerHTML = `<canvas></canvas><div class="ev-text">
      <h1>Las hormigas conquistan el mundo</h1>
      <p class="ev-sub">Generación ${gen} · ${fmtTime(time)} de juego</p>
      <p class="ev-pct"><b>0%</b> del planeta</p>
      <button class="btn-green big" hidden>Continuar</button>
    </div><small class="ev-skip">Toca para saltar</small>`;
  document.body.appendChild(el);
  run.el = el;
  el.addEventListener('pointerdown', e => { if (!e.target.closest('button')) finish(); });
  el.querySelector('button').onclick = finish;
  Audio.play('fanfare', 3);

  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  resize(); addEventListener('resize', resize); run.resize = resize;
  const globe = makeGlobe(), stars = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random() * 1.2 + 0.2, Math.random() * 6]);
  const pct = el.querySelector('.ev-pct b'), btn = el.querySelector('button');
  let t0 = performance.now(), cheered = false;

  const frame = now => {
    if (!run || run.el !== el) return;
    const t = (now - t0) / 1000, W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    for (const [x, y, r, p] of stars) { g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + p); g.fillStyle = '#fff2d8'; g.beginPath(); g.arc(x * W, y * H, r * dpr, 0, 6.3); g.fill(); }
    g.globalAlpha = 1;
    const share = drawGlobe(g, globe, W / 2, H * 0.37, Math.min(W, H) * 0.27, t, dpr);
    pct.textContent = Math.round(share * 100) + '%';
    if (share >= 0.999 && !cheered) { cheered = true; Audio.play('win'); btn.hidden = false; }
    run.raf = requestAnimationFrame(frame);
  };
  run.raf = requestAnimationFrame(frame);
}

/* ---------- globo de puntos ---------- */
// ruido 3D de valores (con suavizado) para dibujar continentes sin imágenes
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = v => v * v * (3 - 2 * v), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, k) => a + (b - a) * k;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15;

function makeGlobe() {
  const N = 3200, pts = [], origin = [0.25, 0.42, 0.87]; // el nido: en la cara que se ve al principio
  const ol = Math.hypot(...origin); origin.forEach((v, i) => { origin[i] = v / ol; });
  let land = 0;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const p = [Math.cos(a) * r, y, Math.sin(a) * r];
    const isLand = fbm(p[0] * 1.6 + 5, p[1] * 1.6 + 2, p[2] * 1.6 + 9) > 0.5;
    // cuándo llega la colonia: según la distancia al nido sobre la esfera, con algo de desorden
    const ang = Math.acos(Math.max(-1, Math.min(1, p[0] * origin[0] + p[1] * origin[1] + p[2] * origin[2])));
    const at = (ang / Math.PI) * SPREAD * 0.92 + hash(i, 1, 2) * 0.5;
    if (isLand) land++;
    pts.push({ p, land: isLand, at });
  }
  return { pts, land };
}

/** Dibuja el globo y devuelve la parte de la tierra ya conquistada (0–1). */
function drawGlobe(g, globe, cx, cy, R, t, dpr) {
  // atmósfera
  const atm = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
  atm.addColorStop(0, 'rgba(120,170,255,.28)'); atm.addColorStop(1, 'rgba(120,170,255,0)');
  g.fillStyle = atm; g.beginPath(); g.arc(cx, cy, R * 1.25, 0, 6.3); g.fill();
  g.fillStyle = '#0d1a2e'; g.beginPath(); g.arc(cx, cy, R, 0, 6.3); g.fill();
  const rot = -0.5 + t * 0.32, tilt = 0.32, cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
  let won = 0;
  for (const q of globe.pts) {
    const [x0, y0, z0] = q.p;
    const x1 = x0 * cr + z0 * sr, z1 = -x0 * sr + z0 * cr;     // giro
    const y2 = y0 * ct - z1 * st, z2 = y0 * st + z1 * ct;       // inclinación
    const done = q.land && t >= q.at;
    if (done) won++;
    if (z2 < 0) continue;                                       // cara oculta
    const sx = cx + x1 * R, sy = cy - y2 * R, shade = 0.45 + 0.55 * z2;
    let col, r;
    if (!q.land) { col = `rgba(70,120,190,${0.35 * shade})`; r = 1.1; }
    else if (!done) { col = `rgba(110,180,90,${0.85 * shade})`; r = 1.7; }
    else if (t - q.at < 0.45) { col = `rgba(255,244,200,${shade})`; r = 2.8; } // el frente de la conquista brilla
    else { col = `rgba(240,184,76,${shade})`; r = 2; }
    g.fillStyle = col; g.beginPath(); g.arc(sx, sy, r * dpr, 0, 6.3); g.fill();
  }
  return won / globe.land;
}
