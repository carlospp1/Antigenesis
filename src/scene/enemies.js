// Enemigos por eras (hormigas rivales → bachacos → termitas → cucarachas → arañas → escarabajos → humanos).
// Salen de la hierba por la derecha, pelean junto al agujero y se retiran al amanecer.
// Si no queda ninguna hormiga bajan por el túnel hasta la reina.
// La noche final no hay bichos: un pie humano gigante baja del cielo y pisa la línea de combate
// (el ritmo de los pisotones lo marcan las reglas: G.foes.stompT, ver rules.tickHuman).
// Los toques del jugador sobre un enemigo los da un zapato pequeño: uno solo, que encadena los golpes en cola.
import * as THREE from 'three';
import { ctx, rnd } from './context.js';
import { FOE_LINE, BOSS_POS, SIZE, QUEEN, PXW } from './layout.js';
import { W } from './world.js';
import { createActor, placeActor, lookAt2D } from './actor.js';
import { createCreature } from './creature.js';
import { DOWN } from './colliders.js';
import { puff } from './particles.js';
import { emit, on } from '../core/events.js';
import { RAID, BAL } from '../game/data.js';
import { nudge } from './camera.js';

const MAX_MINIONS = 12;
/** Rebote de cámara (píxeles de imagen) del pisotón humano y de cada golpe del zapato pequeño: muy sutiles. */
const NUDGE_STOMP = 2.5, NUDGE_TAP = 0.5;

/** Cómo se dibuja cada tipo: modelo y tamaño en píxeles por unidad de modelo. */
const KINDS = {
  rival: { model: 'rival', size: SIZE.ants * 1.0 },
  rivalQ: { model: 'rivalQ', size: SIZE.ants * 2.1, big: true },
  bachaco: { model: 'bachaco', size: SIZE.ants * 1.25 },
  bachacoS: { model: 'bachacoS', size: SIZE.ants * 2.3, big: true },
  termite: { model: 'termite', size: SIZE.termite },
  termiteS: { model: 'termite', size: SIZE.termite * 2.3, big: true },
  roach: { model: 'roach', size: SIZE.termite * 1.5 },
  spiderling: { model: 'spider', size: SIZE.spider * 0.5 },
  spider: { model: 'spider', size: SIZE.spider * 1.1, big: true },
  beetling: { model: 'beetle', size: SIZE.beetle * 0.55 },
  beetle: { model: 'beetle', size: SIZE.beetle * 1.1, big: true },
  mantis: { model: 'mantis', size: SIZE.spider * 0.85, big: true }
};

const pools = {};                 // tipo → actores ya creados (se reutilizan entre noches)
let minions = [], boss = null, shoe = null, leave = 0, shown = false, hitT = 0;

function take(kind, i) {
  const list = pools[kind] || (pools[kind] = []);
  if (!list[i]) {
    const k = KINDS[kind], o = createActor(k.model, k.size, { shadow: k.big ? 1.3 : 1 });
    o.big = !!k.big; o.root.visible = false; ctx.scene.add(o.root);
    list[i] = o;
  }
  return list[i];
}

export function buildEnemies() {
  // se precarga la primera era para que no haya tirones al llegar la noche
  for (let i = 0; i < 6; i++) take('rival', i);
  take('rivalQ', 0);
}

/* ---------- el pie humano ---------- */
function buildShoe() {
  const c = createCreature('shoe', 1);
  const g = new THREE.Group(); g.add(c.g);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#1a0c04', transparent: true, opacity: 0, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.45, 1);
  const shadowG = new THREE.Group(); shadowG.add(sh);
  ctx.scene.add(g, shadowG);
  return { g, c, sh, shadowG, x: FOE_LINE.x + 40, y: FOE_LINE.y + 10, off: 0 };
}

/** Coloca un zapato (el gigante o el pequeño) en (x, y) de la imagen, a h píxeles del suelo, de largo L. */
function placeShoe(s, h, L, top) {
  W(s.x, s.y, s.shadowG.position);
  s.g.position.copy(s.shadowG.position); s.g.position.y += h * PXW;
  s.g.scale.setScalar(L * PXW);
  s.g.rotation.set(0, Math.PI, 0); // de perfil, punta hacia el nido
  const k = Math.max(0, 1 - h / top);
  s.shadowG.position.y += 0.004; s.shadowG.scale.setScalar(L * PXW * 0.5 * (0.6 + 0.4 * k));
  s.sh.material.opacity = 0.15 + 0.45 * k;
}

/* ---------- el zapato pequeño de los toques ---------- */
// Un solo zapato: cada toque a un enemigo se apunta en la cola y el zapato los va dando seguidos.
// El daño y el número salen al instante (main.clickScene); aquí solo va la animación.
const TAP_L = 60, TAP_UP = 70, TAP_QUEUE = 8;
let tapShoe = null;
const tapQ = [];

function updateTapShoe(dt) {
  const s = tapShoe;
  if (!s || (!s.cur && !tapQ.length && !s.g.visible)) return;
  if (!s.cur) {
    if (!tapQ.length) { // sin más golpes: espera un momento arriba y se va
      if ((s.idle += dt) > 0.25) s.g.visible = s.shadowG.visible = false;
      else placeShoe(s, TAP_UP + (s.lastFoe ? topOf(s.lastFoe) : 0), TAP_L, TAP_UP + (s.lastFoe ? topOf(s.lastFoe) : 0));
      return;
    }
    s.cur = tapQ.shift(); s.t = 0; s.landed = false; s.idle = 0;
    if (!s.g.visible) { s.x = s.cur.x; s.y = s.cur.y; } // el primero cae recto
    s.x0 = s.x; s.y0 = s.y;
    s.g.visible = s.shadowG.visible = true;
  }
  // con golpes acumulados va más deprisa para no quedarse atrás
  const fast = tapQ.length > 3, down = fast ? 0.03 : 0.05, hold = fast ? 0.02 : 0.04, up = fast ? 0.05 : 0.07;
  s.t += dt;
  let h;
  if (s.t < down) { // baja y, de paso, se mueve hasta el siguiente objetivo
    const k = s.t / down;
    s.x = s.x0 + (s.cur.x - s.x0) * k; s.y = s.y0 + (s.cur.y - s.y0) * k;
    h = TAP_UP * (1 - k * k);
  } else {
    if (!s.landed) { s.landed = true; s.x = s.cur.x; s.y = s.cur.y; landTap(s.cur); }
    if (s.t < down + hold) h = 0;
    else if (s.t < down + hold + up) h = TAP_UP * (s.t - down - hold) / up;
    else { h = TAP_UP; s.lastFoe = s.cur.foe || null; s.cur = null; }
  }
  // h va de 0 (apoyado) a TAP_UP: se cuenta desde lo alto del bicho, que se va aplastando
  const base = s.cur && s.cur.foe ? topOf(s.cur.foe) : 0;
  placeShoe(s, base + h * (1 - base / (base + TAP_UP)), TAP_L, base + TAP_UP);
}

/** Altura del lomo de un bicho, en píxeles de imagen (baja mientras está aplastado). */
const topOf = o => o.size * 0.32 * (1 - 0.45 * Math.max(0, squash(o)));

/**
 * Cuánto está aplastado un bicho (1 = del todo): se aplasta de golpe al pisarlo y recupera la forma con un
 * pequeño rebote (valores negativos: se estira un poco hacia arriba). o.hurt va de 1 → 0.
 */
function squash(o) {
  if (!(o.hurt > 0)) return 0;
  const t = 1 - o.hurt;
  return t < 0.15 ? t / 0.15 : Math.exp(-(t - 0.15) * 6) * Math.cos((t - 0.15) * 14);
}

/** El zapato pequeño toca el suelo: el bicho se encoge y salta un poco de sangre. */
function landTap(p) {
  const o = p.foe;
  if (o && o.alive && o.root?.visible) {
    o.hurt = 1;
    puff(o.x + rnd(-18, 18), o.y - 22 + rnd(-10, 10), 'red', 8, 110);
    puff(o.x, o.y - 16, 'dust', 3, 50);
  } else puff(p.x + rnd(-12, 12), p.y - 10, 'red', 6, 100);
  nudge(NUDGE_TAP);
}

/* ---------- pisotón humano: el polvo y el rebote salen del evento de las reglas (el sonido, en main.js) ---------- */
on('stomp', () => {
  if (!shoe || !shoe.g.visible) return;
  puff(shoe.x, shoe.y, 'dust', 26, 260, 60);
  nudge(NUDGE_STOMP);
  shoe.off = rnd(-40, 160); // a dónde apunta el siguiente
});

const allFoes = () => (boss ? [...minions, boss] : minions);

export function hideFoes() {
  for (const k in pools) for (const o of pools[k]) { o.root.visible = false; o.alive = false; }
  if (shoe) { shoe.g.visible = false; shoe.shadowG.visible = false; }
  tapQ.length = 0;
  if (tapShoe) { tapShoe.cur = null; tapShoe.g.visible = tapShoe.shadowG.visible = false; }
  minions = []; boss = null; shown = false;
  for (const k in pools) for (const o of pools[k]) o.tun = false;
}
export function retreat() { leave = 4; }
export function resetEnemies() { hideFoes(); leave = 0; }

function setupNight(f, def) {
  shown = true;
  const era = def.era;
  minions = [];
  if (era.minion) for (let i = 0; i < Math.min(MAX_MINIONS, f.count); i++) {
    const o = take(era.minion, i), col = i % FOE_LINE.cols, row = Math.floor(i / FOE_LINE.cols);
    Object.assign(o, { bx: FOE_LINE.x + col * FOE_LINE.dx + (row % 2) * FOE_LINE.dx * 0.5 + rnd(-6, 6), by: FOE_LINE.y + row * FOE_LINE.dy, alive: true });
    o.root.visible = true; minions.push(o);
  }
  boss = null;
  if (def.boss && def.boss.final) {
    if (!shoe) shoe = buildShoe();
    shoe.g.visible = shoe.shadowG.visible = true; shoe.off = rnd(-40, 160);
  } else if (def.boss) {
    boss = take(def.boss.type, 0);
    Object.assign(boss, { bx: BOSS_POS.x, by: BOSS_POS.y, alive: f.boss > 0 });
    boss.root.visible = boss.alive;
  }
}

/**
 * El pie sigue el reloj de las reglas (tau: segundos hasta el próximo pisotón): flota alto apuntando a la
 * línea de combate (o al nido si no quedan hormigas), se cierne, cae de golpe justo en el pisotón, se queda
 * apoyado medio segundo y vuelve a subir.
 */
function updateShoe(dt) {
  const s = shoe, f = ctx.G.foes, tau = f.stompT ?? BAL.stompFirst, since = BAL.stompEvery - tau;
  let h; // altura sobre el suelo, en píxeles de imagen
  if (since < 0.5) h = 0;
  else if (since < 1.3) h = (since - 0.5) / 0.8 * 900;
  else if (tau > 1.2) h = 520 + 380 * Math.min(1, (tau - 1.2) / 2);
  else if (tau > 0.25) h = 520;
  else h = 520 * tau / 0.25;
  if (h >= 520) { // en el aire: apunta al siguiente sitio
    const out = ctx.G.ants > 0, tx = out ? FOE_LINE.x - 60 + s.off : DOWN[0].x + 60, ty = out ? FOE_LINE.y + 10 : DOWN[0].y;
    s.x += (tx - s.x) * Math.min(1, dt * 3); s.y += (ty - s.y) * Math.min(1, dt * 3);
  }
  placeShoe(s, h, 420, 900); // 420: largo de la zapatilla, en píxeles de imagen
}

export function updateEnemies(dt) {
  const { G, D, time } = ctx, f = G.foes;
  if (ctx.ending) { if (shown || leave) { hideFoes(); leave = 0; } return; } // el final: solo la reina
  updateTapShoe(dt);
  ctx.fighting = !!f && f.arrive <= 0 && G.ants > 0;
  if (leave > 0) { // huyen hacia la hierba
    leave -= dt;
    // al llegar al borde de la hierba desaparecen (más allá no hay suelo)
    for (const o of allFoes()) if (o.alive && o.root.visible) {
      o.x += dt * 260; o.phase += dt * 22; lookAt2D(o, 1, 0); o.step(true, 0.05, dt, 'walk'); placeActor(o, dt); applyHurt(o, dt);
      if (o.x >= FOE_LINE.spawnX) o.root.visible = false;
    }
    if (shoe && shoe.g.visible) { shoe.g.position.y += dt * 1.4; shoe.sh.material.opacity *= 0.9; }
    if (leave <= 0) hideFoes();
    return;
  }
  if (!f) { if (shown) hideFoes(); return; }
  const def = D.night, final = def.boss && def.boss.final;
  if (!shown) setupNight(f, def);

  // los que mueren desaparecen con un soplo
  minions.forEach((o, i) => { if (o.alive && i >= f.count) { o.alive = false; o.root.visible = false; puff(o.x, o.y - 12, 'white', 8, 90); } });
  if (boss && boss.alive && f.boss <= 0) { boss.alive = false; boss.root.visible = false; puff(boss.x, boss.y - 30, 'white', 26, 170); }
  if (final && shoe && shoe.g.visible && f.boss <= 0) { puff(shoe.x, shoe.y - 80, 'gold', 40, 260, 80); shoe.g.visible = false; shoe.shadowG.visible = false; }
  if (final && f.boss > 0 && G.phase !== 'dead') updateShoe(dt);

  // asalto: sin hormigas, bajan por el túnel y rodean a la reina
  if (f.raid > 0) {
    const route = [{ x: FOE_LINE.x, y: FOE_LINE.y }, ...DOWN, { x: QUEEN.x + 120, y: QUEEN.y + 30 }];
    allFoes().forEach((o, i) => {
      if (!o.alive) return;
      const k = Math.min(1, f.raid / (RAID * 0.85) - i * 0.04) * (route.length - 1);
      if (k < 0) return;
      const j = Math.min(route.length - 2, Math.floor(k)), t = k - j, a = route[j], b = route[j + 1], end = j === route.length - 2;
      o.tun = j >= 1 && j < DOWN.length; // bajando por la raíz
      const tx = a.x + (b.x - a.x) * t + (end ? (i % 4 - 1.5) * 34 : (i % 3 - 1) * 10), ty = a.y + (b.y - a.y) * t + (end ? (i % 2) * 18 : 0);
      lookAt2D(o, tx - o.x || -1, ty - o.y); o.x += (tx - o.x) * Math.min(1, dt * 6); o.y += (ty - o.y) * Math.min(1, dt * 6);
      o.phase += dt * 16; o.step(true, 0.05, dt, k >= route.length - 1.2 ? 'attack' : o.tun ? 'climb' : 'walk'); placeActor(o, dt); applyHurt(o, dt);
    });
    return;
  }

  const pr = Math.max(0, 1 - f.arrive / 5), ease = pr * pr * (3 - 2 * pr), brawl = f.arrive <= 0;
  if (brawl && G.ants > 0) {
    hitT -= dt;
    if (hitT <= 0) { hitT = rnd(0.15, 0.4); puff(FOE_LINE.x - 40 + rnd(-20, 20), FOE_LINE.y + rnd(-6, 20), 'gold', 2, 70); emit('sfx', { id: 'hit' }); }
  }
  allFoes().forEach((o, i) => {
    if (!o.alive) return;
    const tx = o.bx + (brawl ? Math.sin(time * 5.2 + i * 1.7) * 12 : 0);
    o.x = FOE_LINE.spawnX + (tx - FOE_LINE.spawnX) * ease; o.y = o.by;
    o.phase += dt * 14; o.step(true, o.big ? 0.09 : 0.04, dt, brawl ? 'attack' : 'walk');
    lookAt2D(o, -1, 0.05); placeActor(o, dt);
    applyHurt(o, dt); // golpe del jugador: se encoge y se echa atrás
  });
}

/**
 * Pisotón del zapato pequeño: el bicho se aplasta (más bajo y algo más ancho) y se hunde un poco en el suelo,
 * sin moverse de sitio; luego recupera la forma con un rebote. Va después de placeActor (que fija su escala).
 */
function applyHurt(o, dt) {
  if (!(o.hurt > 0)) return;
  o.hurt = Math.max(0, o.hurt - dt * 3.2); // ~0,3 s
  const q = squash(o), sc = o.orient.scale;
  sc.y *= 1 - 0.45 * q; sc.x *= 1 + 0.2 * q; sc.z *= 1 + 0.2 * q;
  o.orient.position.y -= Math.max(0, q) * o.size * PXW * 0.06;
}

/** Objetivos clicables. */
export function aliveFoes() {
  if (!shown || leave) return [];
  const l = allFoes().filter(o => o.alive);
  if (shoe && shoe.g.visible) l.push({ x: shoe.x, y: shoe.y - 60, big: true });
  return l;
}

/**
 * Toque de daño: el zapato pequeño irá a pisar al bicho más cercano (o junto al pie humano). Se apunta en la
 * cola; si ya hay muchos pendientes se descarta el más antiguo.
 */
export function enemyHit(at) {
  const ax = at?.x ?? FOE_LINE.x + 60, ay = at?.y ?? FOE_LINE.y;
  let best = null, bd = Infinity;
  for (const o of allFoes()) {
    if (!o.alive || !o.root?.visible) continue;
    const d = (o.x - ax) ** 2 + (o.y - (ay + 20)) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  const p = best ? { x: best.x, y: best.y, foe: best } : shoe && shoe.g.visible ? { x: shoe.x + rnd(-30, 30), y: shoe.y + rnd(-6, 6) } : { x: ax, y: ay };
  if (!tapShoe) { tapShoe = buildShoe(); tapShoe.idle = 0; tapShoe.g.visible = tapShoe.shadowG.visible = false; }
  tapQ.push(p);
  if (tapQ.length > TAP_QUEUE) tapQ.shift();
}
export const enemyPos = () => ({ x: FOE_LINE.x + 60, y: FOE_LINE.y, up: 30 });
