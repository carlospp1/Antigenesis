// La reina en el centro de la cámara y los montones de huevos (izquierda) y larvas (derecha).
import * as THREE from 'three';
import { ctx } from './context.js';
import { QUEEN, EGG_PILE, LARVA_PILE, SIZE, PXW } from './layout.js';
import { W, lifted } from './world.js';
import { flatPoint } from './colliders.js';
import { GEO, MAT } from './geometry.js';
import { createActor, placeActor } from './actor.js';
import { BROOD_SLOTS } from '../game/data.js';

export const SLOTS = { egg: [], larva: [] };
export const brood = { egg: [], larva: [] };
export let queen = null;

/** Montón en tres filas escalonadas, de atrás hacia delante. */
function pile(c, sx, sy) {
  const out = [], rows = [[0, 0], [1, -1], [2, 1]];
  for (let i = 0; i < BROOD_SLOTS; i++) {
    const row = Math.floor(i / 4), col = i % 4, [r, side] = rows[row];
    out.push({ x: c.x + (col - 1.5) * sx + side * sx * 0.3, y: c.y + (r - 1) * sy });
  }
  // los primeros huecos que se ocupan son los del centro
  return out.sort((a, b) => Math.hypot(a.x - c.x, (a.y - c.y) * 2) - Math.hypot(b.x - c.x, (b.y - c.y) * 2));
}

/* ---------- barritas de progreso sobre cada huevo y cada larva ---------- */
const BAR = { w: 30, h: 5 };
const barMat = {
  bg: new THREE.MeshBasicMaterial({ color: '#1a0e08', transparent: true, opacity: 0.78, depthTest: false }),
  // transparentes también, para que se dibujen después del fondo de la barra (renderOrder solo ordena dentro del mismo grupo)
  egg: new THREE.MeshBasicMaterial({ color: '#ffc845', transparent: true, depthTest: false }),
  larva: new THREE.MeshBasicMaterial({ color: '#9be35f', transparent: true, depthTest: false }),
  ready: new THREE.MeshBasicMaterial({ color: '#fff6d0', transparent: true, depthTest: false })
};
function makeBar(st) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(BAR.w + 3, BAR.h + 3), barMat.bg);
  const fillGeo = new THREE.PlaneGeometry(BAR.w, BAR.h); fillGeo.translate(BAR.w / 2, 0, 0);
  const fill = new THREE.Mesh(fillGeo, barMat[st]);
  fill.position.set(-BAR.w / 2, 0, 1);
  bg.renderOrder = 20; fill.renderOrder = 21;
  g.add(bg, fill); g.visible = false; g.fill = fill; g.st = st;
  // (las barras se dibujan en HTML, ver broodBars; este grupo queda oculto)
  return g;
}

export function buildBrood() {
  SLOTS.egg = pile(EGG_PILE, EGG_PILE.sx, EGG_PILE.sy);
  SLOTS.larva = pile(LARVA_PILE, LARVA_PILE.sx, LARVA_PILE.sy);
  for (const st in SLOTS) for (const s of SLOTS[st]) {
    const g = new THREE.Group(), m = new THREE.Mesh(GEO[st], MAT.v);
    m.rotation.y = Math.random() * 6; g.add(m);
    if (!flatPoint(s.x, s.y, g.position)) W(s.x, s.y, g.position);
    g.visible = false;
    ctx.scene.add(g);
    brood[st].push({ g, m, s, e: null, pop: 0, ph: Math.random() * 6, hover: 0, base: SIZE[st] * PXW, bar: makeBar(st) });
  }

  queen = createActor('queen', QUEEN.size, { shadow: 1.1 });
  Object.assign(queen, { x: QUEEN.x, y: QUEEN.y, dx: 1, dy: 0.35, yawBias: 0, squash: 0, gulp: 0, hover: 0, s: 1 });
  ctx.scene.add(queen.root);
}

/** Vuelve a su sitio y pone derecha la malla (muerte, final o colonia nueva). */
export function resetQueenPose() {
  if (!queen) return;
  queen.dead = 0; queen.tun = false; queen.x = QUEEN.x; queen.y = QUEEN.y;
  if (queen.yawBias0 != null) { queen.yawBias = queen.yawBias0; delete queen.yawBias0; }
  queen.g.rotation.set(0, 0, 0); queen.g.position.set(0, 0, 0);
  if (queen.ant && queen.ant.setDeadEyes) queen.ant.setDeadEyes(false);
}

/** La reina cambia con la colonia: venomax desde la 4.ª forma y la final en la titán. */
export function refreshQueen() {
  if (!queen || !ctx.G) return;
  const evo = ctx.G.evo || 0;
  const form = evo >= 6 ? 'queenF' : evo >= 3 ? 'queenV' : 'queen';
  if (queen.kind === form) return;
  const prev = queen;
  ctx.scene.remove(prev.root);
  queen = createActor(form, QUEEN.size, { shadow: 1.1 });
  // no se copia «dead»: la malla nueva no hereda el tumbo de la muerte
  for (const k of ['x', 'y', 'dx', 'dy', 'yawBias', 'squash', 'gulp', 'hover', 's', 'phase']) if (prev[k] != null) queen[k] = prev[k];
  ctx.scene.add(queen.root);
  resetQueenPose();
  placeActor(queen, 1);
}

/** La reina come: patas delanteras a la boca durante `sec` segundos (se alarga si ya estaba comiendo). */
export function queenEats(sec = 1.4) {
  if (queen && queen.ant) queen.ant.eat = Math.max(queen.ant.eat || 0, sec);
}

export const qGrow = () => 1 + 0.1 * ctx.G.stage;
/** Dónde dejan la comida las obreras: delante de la boca de la reina. */
export const mouth = () => ({ x: QUEEN.x + 102 * queen.s, y: QUEEN.y + 28 });
const _m = new THREE.Vector3(), _n = new THREE.Vector3();
/** Boca de la reina en el mundo 3D: entre sus dos mandíbulas. */
export function mouthWorld(out = new THREE.Vector3()) {
  if (queen.ant && queen.ant.mouthAt) return queen.ant.mouthAt(out);
  const md = queen.ant && queen.ant.mand;
  if (!md || md.length < 2) return lifted(QUEEN.x + 102 * queen.s, QUEEN.y, 32, out);
  md[0].g.getWorldPosition(_m); md[1].g.getWorldPosition(_n);
  return out.copy(_m).add(_n).multiplyScalar(0.5);
}
export const head = () => ({ x: QUEEN.x + 50 * queen.s, y: QUEEN.y + 6 });
export const slotPos = (st, i) => SLOTS[st][i] || SLOTS[st][0];
export const queenPos = () => ({ x: QUEEN.x - 40, y: QUEEN.y, up: 70 });

/** Barras de progreso de la cría, en píxeles de la imagen (las pinta la interfaz). */
export function broodBars() {
  const out = [];
  for (const st in brood) for (const it of brood[st]) if (it.e && it.barAt) out.push(it.barAt);
  return out;
}

export function updateBrood(dt) {
  const { G, D, time } = ctx;
  for (const st in brood) {
    const pool = brood[st], src = st === 'egg' ? G.eggs : G.larvae;
    for (const it of pool) it.e = null;
    for (const e of src) if (pool[e.slot]) pool[e.slot].e = e;
    for (const it of pool) {
      const e = it.e;
      it.g.visible = !!e; it.bar.visible = false;
      if (!e) continue;
      // barrita: cuánto le falta para pasar a larva (huevo) o a hormiga (larva)
      const p = Math.min(1, e.p), full = p >= 1;
      it.bar.fill.scale.x = Math.max(0.001, p);
      it.bar.fill.material = full ? barMat.ready : barMat[st];
      const top = it.base * (st === 'egg' ? 0.33 * (0.85 + 0.25 * p) : 0.27 * (0.7 + 0.5 * p));
      it.barAt = { x: it.s.x, y: it.s.y, up: top + 8, p, st, ready: full, z: it.s.y };
      it.bar.scale.setScalar(full ? 1 + Math.sin(time * 8) * 0.08 : 1);
      it.pop = Math.max(0, it.pop - dt * 2.6); it.hover = Math.max(0, it.hover - dt * 5);
      let s = it.base * (1 + Math.min(1, 0.15 * Math.log2(e.n))) * (1 + it.hover * 0.12) * (1 + Math.sin(it.pop * Math.PI) * 0.4);
      if (st === 'egg') {
        it.g.scale.setScalar(s * (0.85 + 0.25 * e.p));
        it.m.rotation.z = Math.sin(time * (1.3 + e.p * 6) + it.ph) * (0.03 + e.p * 0.12);
      } else {
        s *= 0.7 + 0.5 * e.p;
        const w = Math.sin(time * 2.6 + it.ph);
        it.g.scale.set(s * (1 + w * 0.08), s, s * (1 - w * 0.08));
      }
    }
  }
  // la reina respira, traga y se aplasta al poner un huevo
  queen.s += (qGrow() - queen.s) * Math.min(1, dt * 1.5);
  queen.size = QUEEN.size * queen.s;
  // durante el final la mueve y la anima ending.js (si no, se animaría dos veces por fotograma)
  if (!ctx.ending) { queen.phase += dt * 2.2; queen.step(false, 0.05, dt); }
  queen.squash = Math.max(0, queen.squash - dt * 3); queen.gulp = Math.max(0, queen.gulp - dt * 2.5); queen.hover = Math.max(0, queen.hover - dt * 4);
  if (!ctx.ending) placeActor(queen, dt);
  // la reina muerta: rueda de lado y se queda patas arriba, apoyada en el lomo (sin atravesar el suelo)
  const dying = G.phase === 'dead' && !G.leaving;
  queen.dead = dying ? Math.min(1, (queen.dead || 0) + dt * 0.8) : 0;
  if (queen.ant && queen.ant.setDeadEyes) queen.ant.setDeadEyes(queen.dead > 0.15);
  if (queen.dead) {
    const d = queen.dead, ang = d * d * (3 - 2 * d) * Math.PI, H = (queen.ant && queen.ant.height) || 0.5;
    queen.g.rotation.x = ang;
    // girando sobre los pies el cuerpo bajaría bajo el suelo: se sube su alto (boca arriba) y medio ancho (de lado)
    queen.g.position.y = H * (1 - Math.cos(ang)) / 2 + Math.sin(ang) * H * 0.55;
  } else if (queen.g.rotation.x || queen.g.position.y) {
    // al fundar o al revivir: siempre se limpia el tumbo (antes solo si rotation.x ≠ 0 y podía quedar el desfase en Y)
    queen.g.rotation.set(0, 0, 0); queen.g.position.set(0, 0, 0);
  }
  const sq = Math.sin(queen.squash * Math.PI), gp = Math.sin(queen.gulp * Math.PI), fill = Math.min(1, G.lay / D.eggCost);
  const k = queen.orient.scale.x;
  queen.orient.scale.set(k * (1 + sq * 0.06 + gp * 0.03), k * (1 - sq * 0.04), k * (1 + fill * 0.05 + Math.sin(time * 1.6) * 0.012));
}
