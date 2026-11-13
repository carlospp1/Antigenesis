// Fachada de la escena: el mapa 3D (world.js), las criaturas encima y la cámara (camera.js).
// El resto del juego habla en píxeles de la imagen de referencia; aquí se traducen al mundo 3D.
import * as THREE from 'three';
import { ctx } from './context.js';
import { QUEEN, ROOT, GUARD } from './layout.js';
import { buildProcedural } from './geometry.js';
import { glossEnvironment } from './antRig.js';
import { loadGlbAnts } from './glbAnt.js';
import { loadModels } from './assets.js';
import { loadWorld, buildRoot, buildBackdrop, world, toImage } from './world.js';
import { buildParticles, puff, updateParticles, feedFly } from './particles.js';
import { buildPantry, updatePantry, pantryAnchor } from './pantry.js';
import { buildBrood, updateBrood, refreshQueen, resetQueenPose, queen, brood, slotPos, queenPos, mouthWorld, broodBars, queenEats } from './brood.js';
export { broodBars };
/** Para depurar desde la consola (__ax.Scene.agents): las hormigas que se dibujan. */
export { agents } from './colony.js';
import { syncAgents, updateAgents, onBorn, onDeath, refreshMutation, clearAgents } from './colony.js';
import { buildEnemies, updateEnemies, resetEnemies, retreat, aliveFoes, enemyHit, enemyPos } from './enemies.js';
import { createCamera, fitCamera, updateCamera, zoomBy, panBy, resetView, focus, screenToImage, imageToScreen } from './camera.js';
import { toggleDebug, initNav } from './colliders.js';
import { startEnding, stopEnding, updateEnding } from './ending.js';
export { startEnding, stopEnding };
import { on } from '../core/events.js';
import { EGG_PILE, LARVA_PILE } from './layout.js';

export { zoomBy, panBy, resetView, focus, enemyHit, toggleDebug, imageToScreen };

const PI = Math.PI;
let hemi, sun, fire, nest, nightK = 0, syncT = 0;
const skyDay = new THREE.Color('#fff4dc'), skyNight = new THREE.Color('#8090d8');
const bgDay = new THREE.Color('#ffffff'), bgNight = new THREE.Color('#5a64a0');
const clearDay = new THREE.Color('#2a160c'), clearNight = new THREE.Color('#0c0a1c'), _c = new THREE.Color();

export async function init(el, onProgress) {
  ctx.host = el;
  // en móvil: algo menos de resolución y sin antialias (la pantalla ya es densa y así no se calienta)
  const mobile = matchMedia('(pointer: coarse)').matches;
  const renderer = (ctx.renderer = new THREE.WebGLRenderer({ antialias: !mobile, alpha: false, powerPreference: 'high-performance' }));
  // resolución interna limitada: el mapa ocupa toda la pantalla y es lo que más cuesta dibujar
  renderer.setPixelRatio(Math.min(mobile ? 1.25 : 1.5, window.devicePixelRatio || 1));
  renderer.setClearColor('#2a160c');
  el.appendChild(renderer.domElement);

  ctx.scene = new THREE.Scene();
  ctx.camera = createCamera();
  ctx.scene.environment = glossEnvironment(renderer); // brillo de barniz en hormigas y reina

  // luz cálida de atardecer (el sol entra por arriba a la derecha) y una luz anaranjada dentro del nido
  hemi = new THREE.HemisphereLight('#fff4dc', '#6a3a1c', 0.95 * PI); ctx.scene.add(hemi);
  sun = new THREE.DirectionalLight('#ffd9a0', 1.0 * PI); sun.position.set(0.7, 1, 0.9); ctx.scene.add(sun);
  fire = new THREE.DirectionalLight('#ff9a4a', 0.35 * PI); fire.position.set(-0.4, -0.2, 1); ctx.scene.add(fire);
  nest = new THREE.PointLight('#ff9a4a', 0, 2.2, 1.4); nest.position.set(0, -0.12, 0.1); ctx.scene.add(nest);

  buildProcedural();
  resize();
  await loadWorld(p => onProgress && onProgress(p * 0.5, 'mapa'));
  initNav(); buildRoot(ROOT);
  await buildBackdrop(ctx.camera);
  updateCamera(1);
  renderer.render(ctx.scene, ctx.camera);

  const [loaded] = await Promise.all([loadModels(p => onProgress && onProgress(0.5 + p * 0.5)), loadGlbAnts()]);
  buildBrood(); buildPantry(); buildParticles(); buildEnemies();
  wireEvents();
  return loaded;
}

function wireEvents() {
  on('lay', d => { const it = brood.egg[d.e.slot]; if (it) it.pop = 1; queen.squash = 1; const p = slotPos('egg', d.e.slot); puff(p.x, p.y - 10, 'white', 6, 70); });
  on('hatch', d => {
    const it = brood.larva[d.e.slot]; if (it) it.pop = 1;
    const a = slotPos('egg', d.from), b = slotPos('larva', d.e.slot);
    puff(a.x, a.y - 10, 'white', 4, 60); puff(b.x, b.y - 10, 'gold', 4, 60);
  });
  on('born', d => { const p = slotPos('larva', d.slot); puff(p.x, p.y - 10, 'gold', 10, 90, 40); onBorn(d.caste, d.slot, d.shiny); syncT = 0; });
  on('death', d => onDeath(d.caste, d.shiny));
  on('stage', () => { for (let i = 0; i < 6; i++) puff(QUEEN.x + (Math.random() - 0.6) * 220, QUEEN.y + (Math.random() - 0.5) * 30, 'gold', 6, 140, 40); });
  on('nightLost', retreat);
  on('evolve', () => { refreshQueen(); clearAgents(); if (ctx.G) syncAgents(true); for (let i = 0; i < 8; i++) puff(500 + Math.random() * 700, 660 + Math.random() * 100, 'gold', 6, 160, 60); });
  on('skill', d => { if (d.id === 'waK3' || d.id === 'reset') refreshMutation(); });
}

export function resize() {
  const { host, renderer } = ctx, w = Math.max(50, host.clientWidth), h = Math.max(50, host.clientHeight);
  renderer.setSize(w, h, false);
  fitCamera(w, h);
  if (ctx.camera) updateCamera(1);
}

export function reset() { stopEnding(); resetQueenPose(); clearAgents(); ctx.G = null; resetEnemies(); }

/** Posición de pantalla de un punto de la imagen (`up`: píxeles de imagen por encima del terreno). */
export const toScreen = p => imageToScreen(p.x, p.y, p.up || 0);

export function entityPos(kind, i) {
  if (kind === 'queen') return queenPos();
  if (kind === 'enemy') return enemyPos();
  if (kind === 'front') return { x: GUARD.x + Math.random() * 120, y: GUARD.y, up: 40 }; // la línea de combate
  const s = slotPos(kind, i); return { x: s.x, y: s.y, up: 30 };
}

/** Anclas para las etiquetas flotantes (en píxeles de imagen, `up` por encima del terreno). */
export const anchors = () => ({
  eggs: { x: EGG_PILE.x, y: EGG_PILE.y, up: 82 },
  queen: { x: QUEEN.x - 175, y: QUEEN.y, up: 150 * (queen ? queen.s : 1) },
  larvae: { x: LARVA_PILE.x, y: LARVA_PILE.y, up: 82 },
  pantry: pantryAnchor()
});

/** Qué hay bajo el puntero (reina, huevo, larva o enemigo), o null. Radios en píxeles de imagen. */
export function pick(px, py) {
  const { G } = ctx;
  if (!G || !queen) return null;
  const p = screenToImage(px, py);
  let best = null, bd = 1;
  const test = (x, y, rx, ry, res) => {
    const d = Math.hypot((p.x - x) / rx, (p.y - y) / ry);
    if (d < bd) { bd = d; best = res; res.pos = { x, y: y - 20 }; }
  };
  test(QUEEN.x - 40, QUEEN.y - 25, 155 * queen.s, 72 * queen.s, { kind: 'queen' });
  for (const e of G.eggs) { const s = slotPos('egg', e.slot); test(s.x, s.y - 12, 26, 24, { kind: 'egg', id: e.id, slot: e.slot }); }
  for (const e of G.larvae) { const s = slotPos('larva', e.slot); test(s.x, s.y - 12, 38, 26, { kind: 'larva', id: e.id, slot: e.slot }); }
  for (const o of aliveFoes()) test(o.x, o.y - 20, o.big ? 120 : 45, o.big ? 70 : 32, { kind: 'enemy' });
  if (best) best.click = p;
  return best;
}

export function hover(h) {
  if (!h) return;
  if (h.kind === 'queen') queen.hover = 1;
  else if (brood[h.kind] && brood[h.kind][h.slot]) brood[h.kind][h.slot].hover = 1;
}

/** Toque a la reina: un trozo de comida vuela desde el dedo hasta su boca y se lo traga. */
export function feedQueen(from, onArrive, type) {
  const m = new THREE.Vector3();
  queenEats(1.2);
  feedFly(from.x, from.y, () => mouthWorld(m), () => {
    queen.gulp = 1; queenEats(1.4);
    const at = toImage(m);
    puff(at.x, at.y, 'gold', 4, 60);
    if (onArrive) onArrive({ x: at.x, y: at.y, up: 30 });
  }, type, undefined, true);
}

export function bump(h) {
  if (h.kind === 'queen') queen.hover = 1; // el resto lo hace feedQueen al llegar la comida
  else if (brood[h.kind] && brood[h.kind][h.slot]) { brood[h.kind][h.slot].pop = 0.55; const s = slotPos(h.kind, h.slot); puff(s.x, s.y - 14, 'gold', 4, 70); }
}

/** Avanza la escena. Con velocidad ×N se llama N veces por fotograma; solo la última dibuja. */
export function update(game, derived, dt, realDt, skipDraw) {
  const first = ctx.G !== game;
  ctx.G = game; ctx.D = derived; ctx.time += dt;
  if (first) { refreshQueen(); queen.s = 1 + 0.1 * game.stage; syncAgents(true); refreshMutation(); syncT = 1; }
  syncT -= dt;
  if (syncT <= 0) { syncT = 1; syncAgents(false); }
  updateEnemies(dt); updateAgents(dt); updateBrood(dt); updateEnding(dt); updatePantry(dt); updateParticles(dt);
  if (skipDraw) return;

  // día, atardecer y noche: se oscurece el mapa y se enfría la luz; el nido brilla
  const G = game, target = G.phase === 'night' ? 1 : G.t < 10 ? 1 - G.t / 10 : 0;
  nightK += (target - nightK) * Math.min(1, realDt * 2);
  _c.copy(bgDay).lerp(bgNight, nightK);
  for (const m of world.materials) m.color.copy(m.userData.base).multiply(_c);
  ctx.renderer.setClearColor(_c.copy(clearDay).lerp(clearNight, nightK));
  nest.intensity = nightK * 1.4 * PI;
  hemi.intensity = (0.95 - 0.4 * nightK) * PI; hemi.color.copy(skyDay).lerp(skyNight, nightK);
  sun.intensity = (1.0 - 0.7 * nightK) * PI;
  fire.intensity = (0.35 + 0.3 * nightK) * PI;

  updateCamera(realDt);
  ctx.renderer.render(ctx.scene, ctx.camera);
}
