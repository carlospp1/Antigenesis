// Enemigos por eras (hormigas rivales → bachacos → termitas → cucarachas → arañas → escarabajos → humanos).
// Salen de la hierba por la derecha, pelean junto al agujero y se retiran al amanecer.
// Si no queda ninguna hormiga bajan por el túnel hasta la reina.
// La noche final no hay bichos: un pie humano gigante baja del cielo y pisa la línea de combate.
import * as THREE from 'three';
import { ctx, rnd } from './context.js';
import { FOE_LINE, BOSS_POS, SIZE, QUEEN, PXW } from './layout.js';
import { W } from './world.js';
import { createActor, placeActor, lookAt2D } from './actor.js';
import { createCreature } from './creature.js';
import { DOWN } from './colliders.js';
import { puff } from './particles.js';
import { emit } from '../core/events.js';
import { RAID } from '../game/data.js';

const MAX_MINIONS = 12;

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
let minions = [], boss = null, shoe = null, leave = 0, shown = false, hitT = 0, stomp = 0;

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
  return { g, c, sh, shadowG, x: FOE_LINE.x + 40, y: FOE_LINE.y + 10, lastT: 0 };
}

const allFoes = () => (boss ? [...minions, boss] : minions);

export function hideFoes() {
  for (const k in pools) for (const o of pools[k]) { o.root.visible = false; o.alive = false; }
  if (shoe) { shoe.g.visible = false; shoe.shadowG.visible = false; }
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
    shoe.g.visible = shoe.shadowG.visible = true; stomp = 0;
  } else if (def.boss) {
    boss = take(def.boss.type, 0);
    Object.assign(boss, { bx: BOSS_POS.x, by: BOSS_POS.y, alive: f.boss > 0 });
    boss.root.visible = boss.alive;
  }
}

/** Ciclo del pisotón: baja amenazante, cae de golpe, se queda apoyado y vuelve a subir. */
function updateShoe(dt) {
  const s = shoe, period = 2.6;
  const before = Math.floor(stomp / period);
  stomp += dt;
  if (Math.floor(stomp / period) !== before) s.x = ctx.G.foes && ctx.G.foes.raid > 0 ? DOWN[0].x + 60 : FOE_LINE.x - 60 + rnd(-40, 160); // nuevo objetivo (sin hormigas: el nido)
  const t = (stomp % period) / period;
  let h; // altura sobre el suelo, en píxeles de imagen
  if (t < 0.45) h = 900 - t / 0.45 * 380;
  else if (t < 0.55) h = 520 * (1 - (t - 0.45) / 0.1);
  else if (t < 0.75) h = 0;
  else h = (t - 0.75) / 0.25 * 900;
  if (t >= 0.55 && s.lastT < 0.55) { ctx.shake = 1.2; puff(s.x, s.y, 'dust', 26, 260, 60); emit('sfx', { id: 'stomp' }); }
  s.lastT = t;
  const L = 420; // largo de la zapatilla, en píxeles de imagen
  W(s.x, s.y, s.shadowG.position);
  const px = PXW;
  s.g.position.copy(s.shadowG.position); s.g.position.y += h * px;
  s.g.scale.setScalar(L * px);
  s.g.rotation.set(0, Math.PI, 0); // de perfil, punta hacia el nido
  const k = Math.max(0, 1 - h / 900);
  s.shadowG.position.y += 0.004; s.shadowG.scale.setScalar(L * px * 0.5 * (0.6 + 0.4 * k));
  s.sh.material.opacity = 0.15 + 0.45 * k;
}

export function updateEnemies(dt) {
  const { G, D, time } = ctx, f = G.foes;
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
  if (final && f.boss > 0 && f.arrive <= 0 && G.phase !== 'dead') updateShoe(dt);

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

/** Sacudida visual tras un toque de daño (hurt va de 1 → 0). */
function applyHurt(o, dt) {
  if (!(o.hurt > 0)) { if (o.g) o.g.position.y = 0; return; }
  o.hurt = Math.max(0, o.hurt - dt * 6);
  const k = Math.sin(o.hurt * Math.PI);
  o.orient.scale.multiplyScalar(1 - k * 0.18);
  o.orient.position.x += k * 0.14; // empujón hacia la hierba
  if (o.g) o.g.position.y = k * 0.1;
}

/** Objetivos clicables. */
export function aliveFoes() {
  if (!shown || leave) return [];
  const l = allFoes().filter(o => o.alive);
  if (shoe && shoe.g.visible) l.push({ x: shoe.x, y: shoe.y - 60, big: true });
  return l;
}

/** Toque de daño: partículas en el bicho más cercano y animación de golpe. */
export function enemyHit(at) {
  const ax = at?.x ?? FOE_LINE.x + 60, ay = at?.y ?? FOE_LINE.y;
  let best = null, bd = Infinity;
  for (const o of allFoes()) {
    if (!o.alive || !o.root?.visible) continue;
    const d = (o.x - ax) ** 2 + (o.y - (ay + 20)) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  if (best) {
    best.hurt = 1;
    puff(best.x + rnd(-18, 18), best.y - 22 + rnd(-10, 10), 'red', 8, 110);
    puff(best.x, best.y - 16, 'dust', 3, 50);
    ctx.shake = Math.max(ctx.shake || 0, 0.35);
  } else if (shoe && shoe.g.visible) {
    puff(shoe.x + rnd(-30, 30), shoe.y - 80 + rnd(-20, 20), 'red', 10, 140);
    ctx.shake = Math.max(ctx.shake || 0, 0.45);
  } else {
    puff(ax + rnd(-20, 20), ay, 'red', 5, 90);
  }
}
export const enemyPos = () => ({ x: FOE_LINE.x + 60, y: FOE_LINE.y, up: 30 });
