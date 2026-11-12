// Todas las hormigas recolectan de día y salen a pelear de noche. Cualquiera puede morir.
import * as THREE from 'three';
import { ctx, rnd } from './context.js';
import { FOOD, CAP, SIZE, PX, PANTRY, GUARD, SURF_BAND } from './layout.js';
import { GEO, MAT, clayAnt } from './geometry.js';
import { setJaw } from './creature.js';
import { ANT_LOOKS } from './antRig.js';
import { createActor, placeActor, lookAt2D } from './actor.js';
import { randomIn, clampToWalkable, DOWN, UP } from './colliders.js';
import { NAV } from './layout.js';
import { queen, mouth, head, slotPos, mouthWorld, queenEats } from './brood.js';
import { puff, feedFly } from './particles.js';
import { pantryTop, pantryDrop, pantryPop } from './pantry.js';
import { emit } from '../core/events.js';

export const agents = [];
export const by = { ants: [] };
const births = { ants: [] };

// lo que llevan a cuestas: un trozo de hoja o de fresa
const leafGeo = new THREE.IcosahedronGeometry(0.17, 0).scale(1.5, 0.22, 1.1).rotateZ(0.5);
const berryGeo = new THREE.IcosahedronGeometry(0.12, 0).scale(1.1, 0.9, 1);

// cada hormiga elige un carril propio dentro del túnel para no ir en fila india
// (los puntos del túnel van marcados: mientras va hacia uno de ellos, la hormiga trepa por la raíz)
// (al llegar al final, `set` dice dónde está: 'out' arriba o 'cham' en la cueva; mientras tanto a.at = 'tun')
const lane = (path, a, end) => path.map((p, i) => ({ x: p.x + a.lane * (i === 0 || i === path.length - 1 ? 22 : 6), y: p.y + rnd(-4, 4), tunnel: true, set: i === path.length - 1 ? end : undefined }));
/** Punto de la raíz más cercano a la hormiga (por si cambia de tarea a medio camino). */
const nearestOnRoot = a => { let bi = 0, bd = Infinity; DOWN.forEach((p, i) => { const d = (p.x - a.x) ** 2 + (p.y - a.y) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
const toSurface = a => a.at === 'out' ? [] : lane(a.at === 'tun' ? DOWN.slice(0, nearestOnRoot(a) + 1).reverse() : UP, a, 'out');
const toChamber = a => a.at === 'cham' ? [] : lane(a.at === 'tun' ? DOWN.slice(nearestOnRoot(a)) : DOWN, a, 'cham');

/* la superficie está partida por el agujero: de un lado al otro se rodea por detrás */
const sideOf = x => (x < NAV.hole[0] ? 'L' : 'R');
const sidePoint = s => { const p = s === 'L' ? NAV.holeL : NAV.holeR; return { x: p[0] + rnd(-8, 8), y: p[1] + rnd(-3, 3) }; };
/** Puntos de paso por la superficie de (x0) a (x1): si cambian de lado, por detrás del agujero. */
function across(x0, x1) {
  const a = sideOf(x0), b = sideOf(x1);
  return a === b ? meander(x0, x1) : [sidePoint(a), sidePoint(b)];
}

function tint(a) {
  if (!a.body) return;
  const m = MAT.v.clone(), k = rnd(0.86, 1.08);
  m.color.setRGB(k, k * rnd(0.92, 1.02), k * rnd(0.84, 0.96));
  a.body.material = a.la.material = a.lb.material = m;
}

function spawn(at, x, y, shiny) {
  const ev = 'evo' + Math.min(6, ctx.G.evo || 0), look = ANT_LOOKS[ev === 'evo0' ? 'ant' : ev];
  const a = createActor(shiny ? ev + ':gold' : ev, SIZE.ants * (look.size || 1)); // dorada: su mismo modelo, en oro
  const carry = new THREE.Mesh(leafGeo, MAT.carry.leaf);
  carry.visible = false; carry.castShadow = false;
  if (a.mouth && a.holder) { // sujeto con la boca, justo delante de la cara
    carry.position.set(a.mouth.x + 0.1, Math.max(a.mouth.y, 0.15), 0); // sin rozar el suelo (colmillos del soldado)
    a.holder.add(carry);
  } else {
    carry.position.set(a.front - 0.05, Math.min(0.32, a.height) + 0.08, 0);
    a.g.add(carry);
  }
  tint(a);
  Object.assign(a, { shiny: !!shiny, sparkT: rnd(0, 1), caste: 'ants', carry, at, lane: rnd(-1, 1), path: [], wait: rnd(0, 1), idx: by.ants.length, after: null, x, y, hx: null, job: null });
  if (ctx.G.skills.waK3) setJaw(a, true, GEO.ants);
  lookAt2D(a, rnd(-1, 1), rnd(-0.3, 0.3));
  ctx.scene.add(a.root); agents.push(a); by.ants.push(a);
  return a;
}

function removeAgent(a, dead) {
  if (dead) puff(a.x, a.y - 10, 'red', 8, 90);
  if (a.body && a.body.material !== MAT.v) a.body.material.dispose();
  ctx.scene.remove(a.root);
  agents.splice(agents.indexOf(a), 1);
  const l = by[a.caste]; l.splice(l.indexOf(a), 1);
}

function setCarry(a, type) {
  a.carryType = type;
  a.carry.visible = !!type;
  if (!type) return;
  a.carry.geometry = type === 'berry' ? berryGeo : leafGeo;
  a.carry.material = MAT.carry[type] || MAT.carry.leaf;
}

/** Punto intermedio en la hierba entre dos x, para que no vayan todas por la misma línea. */
function meander(x0, x1) {
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  if (hi - lo < 120) return [];
  return [randomIn('surface', { x0: lo + (hi - lo) * 0.3, x1: lo + (hi - lo) * 0.7, y0: SURF_BAND.y0, y1: SURF_BAND.y1 })];
}

let turn = 0; // se alternan: una entrega a la reina, la siguiente guarda en la despensa (salvo «Todo para la reina»)

function feedTask(a) {
  const toQueen = ctx.D.noStore || turn++ % 2 === 0, path = a.at === 'out' ? [...meander(a.x, DOWN[0].x), sidePoint(sideOf(a.x))] : []; // hasta el lado del agujero en el que está
  path.push(...toChamber(a));
  const m = toQueen ? mouth() : pantryDrop();
  path.push({ x: m.x + rnd(-30, 40) * (toQueen ? 1 : 0.4), y: m.y + rnd(-12, 22) * (toQueen ? 1 : 0.5), wait: 0.9, set: 'cham', faceQ: toQueen, faceP: !toQueen, fn: () => {
    const { G, D } = ctx, type = a.carryType || 'leaf';
    setCarry(a, null);
    // cada hormiga dibujada representa a varias reales
    // las doradas traen el triple; con suerte, la entrega vale el doble
    const lucky = !!a.lucky, gold = !!a.goldFood; a.lucky = a.goldFood = false;
    const amount = D.carry * G.ants / Math.max(1, by.ants.length) * (a.shiny ? D.shinyFood : 1) * (lucky ? 2 : 1) * (gold ? 5 : 1);
    const snack = gold ? 'gold' : type, big = gold ? 34 : 24;
    const v = new THREE.Vector3();
    if (toQueen) {
      queenEats(1.2); // alarga las patas para recibir la comida
      feedFly(a.x, a.y - 22, () => mouthWorld(v), () => {
        queen.gulp = 1; queenEats(1.4);
        emit('feed', { amount, lucky, gold, dest: 'queen', pos: { x: v.x, y: -v.y - 50 } });
      }, snack, big);
    } else {
      feedFly(a.x, a.y - 22, () => pantryTop(v), () => {
        pantryPop(); puff(v.x, -v.y, 'green', 5, 60);
        emit('feed', { amount, lucky, gold, dest: 'store', pos: { x: v.x, y: -v.y - 40 } });
      }, snack, big);
    }
  } });
  a.path = path; a.after = null;
}

function fightTask(a) {
  const i = a.idx % 24, col = i % GUARD.cols, row = Math.floor(i / GUARD.cols), p = toSurface(a);
  const gx = GUARD.x + col * GUARD.dx;
  if (p.length) p.push(sidePoint(sideOf(gx))); // al salir del agujero, primero a su lado
  else p.push(...across(a.x, gx));
  p.push({
    x: GUARD.x + col * GUARD.dx + (row % 2) * GUARD.dx * 0.4 + rnd(-3, 3),
    y: GUARD.y + (row - 1.5) * GUARD.dy + rnd(-2, 2), // filas de la guardia, a la derecha del agujero
    wait: 999, set: 'out', guard: true
  });
  a.path = p; a.after = null;
}

function forageTask(a) {
  const f = FOOD[Math.floor(Math.random() * FOOD.length)], p = toSurface(a);
  if (p.length) p.push(sidePoint(sideOf(f.x)), ...meander(NAV.hole[0], f.x));
  else p.push(...across(a.x, f.x));
  p.push({ x: f.x + rnd(-f.r, f.r), y: f.y + rnd(-8, 10), wait: 0.8, set: 'out', fn: () => {
    // la suerte se decide al cosechar, para que el efecto salga en la comida
    const D = ctx.D;
    a.lucky = Math.random() < D.luck; a.goldFood = Math.random() < D.goldFood;
    setCarry(a, a.goldFood ? 'gold' : f.type);
    if (a.lucky || a.goldFood) { puff(a.x, a.y - 20, 'gold', a.goldFood ? 18 : 10, a.goldFood ? 140 : 90, 40); emit('harvestLuck', { x: a.x, y: a.y - 40, lucky: a.lucky, gold: a.goldFood }); }
  } });
  a.path = p; a.after = () => feedTask(a);
}

/** De noche todas van a la línea. De día recolectan. */
function retarget(a) {
  const job = ctx.G.phase === 'night' ? 'fight' : 'food';
  if (a.job === job) return;
  a.job = job; a.path = []; a.after = null; a.wait = 0; a.faceQ = false;
  if (a.hx != null) { a.x = a.hx; a.hx = null; }
  if (job === 'fight') setCarry(a, null);
}

function nextTask(a) {
  if (a.job === 'fight') fightTask(a);
  else forageTask(a);
}

function updateAgent(a, dt) {
  const { D, fighting } = ctx;
  retarget(a);
  if (a.job === 'fight' && fighting && a.at === 'out' && !a.path.length) {
    a.phase += dt * 14; a.step(true, 0.03, dt, 'attack');
    if (a.hx == null) a.hx = a.x;
    a.x = a.hx + 18 + Math.sin(a.phase * 0.42 + a.idx) * 14;
    lookAt2D(a, 1, 0); a.wait = 0.5;
    placeActor(a, dt);
    return;
  }
  if (a.hx != null) { a.x = a.hx; a.hx = null; }
  if (a.wait > 0) {
    a.wait -= dt; a.phase += dt * 3; a.step(false, 0, dt);
    if (a.faceQ) { const h = head(); lookAt2D(a, h.x - a.x, h.y - a.y); }
    else if (a.faceP) lookAt2D(a, PANTRY.x - a.x, PANTRY.y - a.y);
    else if (a.job === 'fight') lookAt2D(a, 1, 0);
    if (a.wait <= 0) a.faceQ = a.faceP = false;
    placeActor(a, dt);
    return;
  }
  if (!a.path.length) { if (a.after) a.after(); else nextTask(a); placeActor(a, dt); return; }
  const t = a.path[0];
  a.tun = !!t.tunnel;
  if (a.tun) a.at = 'tun';
  if (!t.ok) { clampToWalkable(t); t.ok = true; a.best = Infinity; a.stuck = 0; } // un destino fuera de la zona nunca se alcanzaría
  const dx = t.x - a.x, dy = t.y - a.y, dist = Math.hypot(dx, dy);
  // red de seguridad: si lleva 1,5 s sin acercarse (atascada contra una colisión), llega de golpe
  if (dist < a.best - 1) { a.best = dist; a.stuck = 0; } else if ((a.stuck += dt) > 1.5) { a.x = t.x; a.y = t.y; a.stuck = 0; }
  const sp = D.speed * PX * (a.job === 'fight' ? 1.7 : 1) * (a.shiny ? D.shinySpeed : 1) * (a.tun ? 0.75 : 1) * dt;
  if (dist <= sp) {
    a.x = t.x; a.y = t.y; clampToWalkable(a); a.path.shift();
    if (t.set) a.at = t.set;
    if (t.fn) t.fn();
    if (t.wait) { a.wait = t.wait; a.faceQ = !!t.faceQ; a.faceP = !!t.faceP; }
  } else {
    a.x += dx / dist * sp; a.y += dy / dist * sp; lookAt2D(a, dx, dy);
    clampToWalkable(a);
  }
  a.phase += sp * (a.tun ? 0.3 : 0.22); a.step(true, 0, dt, a.tun ? 'climb' : undefined);
  placeActor(a, dt);
}

/** Ajusta las hormigas dibujadas al recuento real (con tope CAP). */
export function syncAgents(first) {
  const { G } = ctx;
  for (const k in by) {
    const l = by[k], want = Math.min(CAP[k], G[k] || 0);
    while (l.length > want) removeAgent(l[l.length - 1]);
    while (l.length < want) {
      if (first) {
        const out = l.length % 2 === 1, p = randomIn(out ? 'surface' : 'chamber');
        const a = spawn(out ? 'out' : 'cham', p.x, p.y, l.filter(x => x.shiny).length < wantShiny());
        if (l.length === 1) { setCarry(a, 'leaf'); a.wait = 0; feedTask(a); }
        continue;
      }
      const b = births[k].shift() || randomIn('chamber');
      spawn('cham', b.x, b.y, b.shiny != null ? b.shiny : l.filter(x => x.shiny).length < wantShiny());
    }
    births[k].length = 0;
  }
}

export function updateAgents(dt) {
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    updateAgent(a, dt);
    // las doradas sueltan destellos de vez en cuando
    if (a.shiny && (a.sparkT -= dt) <= 0) { a.sparkT = rnd(0.35, 0.9); puff(a.x + rnd(-14, 14), a.y - 28, 'gold', 1, 40, 30); }
  }
}

/** Cuántas doradas dibujar, en proporción a las reales. */
const wantShiny = () => Math.round(Math.min(CAP.ants, ctx.G.ants) * (ctx.G.shiny || 0) / Math.max(1, ctx.G.ants));

export function onBorn(caste, slot, shiny) { const p = slotPos('larva', slot); births[caste].push({ x: p.x, y: p.y + 10, shiny }); }

/** Muerte en combate: desaparece una de las que están fuera, si hay. */
export function onDeath(caste, shiny) {
  const l = by[caste];
  if (l.length <= Math.min(CAP[caste], ctx.G[caste])) return;
  const out = l.filter(a => a.at === 'out'), pool = out.length ? out : l, same = pool.filter(a => !!a.shiny === !!shiny), from = same.length ? same : pool;
  removeAgent(from[from.length - 1], true);
}

export function refreshMutation() {
  if (!ctx.G) return;
  const on = !!ctx.G.skills.waK3;
  GEO.ants = clayAnt(on ? { mand: 1.7, headS: 1.15, mandCol: '#f0ddb4' } : {});
  for (const a of by.ants) setJaw(a, on, GEO.ants);
}

export function clearAgents() { while (agents.length) removeAgent(agents[0]); }
