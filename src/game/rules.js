// Reglas puras de la colonia: día y noche, cría, combate, árboles, muerte de la reina y linaje.
// No sabe nada de Three.js ni del DOM; avisa de lo que pasa con emit().
import { emit } from '../core/events.js';
import { EVOS, ERAS, STAGES, OBJ, DAY, NIGHT, NIGHT_FINAL, DUSK, BROOD_SLOTS, BAL, FINAL_NIGHT, RAID, eraFor } from './data.js';
import { debug } from './debug.js';
import { SKILLS, PERKS, treeFx, treeStates, missingNeeds } from './trees.js';

let uid = 1;
export const adnFor = (nights, stage) => Math.max(1, Math.floor(Math.pow(Math.max(0, nights), BAL.adnP) * BAL.adnK + stage * 2));
export const bumpUid = id => { uid = Math.max(uid, id + 1); };

/** Partida nueva. keep: lo que hereda una colonia nueva (ADN, linaje, objetivos…). */
export function newGame(keep) {
  const G = {
    v: 4, last: Date.now(), jelly: 0, eaten: 0, ants: 0, lay: 0, stage: 0, eggs: [], larvae: [], skills: {},
    phase: 'day', t: DAY, level: 1, warned: false, foes: null, guard: 0, bio: 0, rate: 0, spent: { jelly: 0, bio: 0 },
    livesUsed: 0, hives: 0, shiny: 0, evo: 0, obj: 0, adn: 0, adnTotal: 0, perm: {}, gen: 1, best: 0, won: false, total: 0, mute: false,
    stats: { clicks: 0, laid: 0, born: 0, dead: 0, time: 0 }
  };
  if (keep) {
    Object.assign(G, { autoBuy: !!keep.autoBuy, evo: keep.evo || 0, adnTotal: keep.adnTotal || 0, adn: keep.adn, perm: keep.perm, gen: keep.gen, mute: keep.mute, obj: keep.obj, best: keep.best, won: keep.won, total: keep.total });
    const P = treeFx(PERKS, G.perm);
    G.ants = P.startAnts || 0; G.jelly = (P.startJelly || 0) + (keep.inherit || 0) * (P.keepJelly || 0); G.bio = P.startBio || 0;
    for (let i = 0; i < Math.min(BROOD_SLOTS, P.startEggs || 0); i++) G.eggs.push({ id: uid++, n: 1, p: 0, slot: i }); // nido preparado
  }
  return G;
}

/** Valores derivados del estado (se recalculan cada fotograma). */
/** Efectos de estadísticas que se rebajan en los árboles (las probabilidades y los extras van enteros). */
const DAMP = new Set(['food', 'speed', 'dmg', 'hp', 'growth', 'reserve', 'click', 'tapQ', 'tapB', 'prize', 'foodX', 'dmgX', 'hpX', 'growthX', 'clickX']);

export function calc(G) {
  const T = treeFx(SKILLS, G.skills), P = treeFx(PERKS, G.perm), D = { T, P };
  // las estadísticas del árbol y del linaje van rebajadas (treeK, permK): la evolución ya sube todo
  const kT = k => DAMP.has(k) ? BAL.treeK : 1, kP = k => DAMP.has(k) ? BAL.permK : 1;
  const add = k => (T[k] || 0) * kT(k) + (P[k] || 0) * kP(k), mul = k => Math.pow(T[k] ?? 1, kT(k)) * Math.pow(P[k] ?? 1, kP(k));
  D.blood = 1 + BAL.blood * (G.adnTotal || 0); // Sangre antigua
  D.carry = BAL.carry * (1 + add('food')) * mul('foodX') * Math.pow(BAL.stageFood, G.stage) * D.blood;
  D.speed = 2.6 * (1 + add('speed'));
  // evolución de la especie: multiplica todo lo de las fases conseguidas
  // evolución de la especie: cada forma sube comida, daño y vida (×evoAll) y algo de velocidad
  for (let i = 1; i <= (G.evo || 0); i++) {
    D.carry *= BAL.evoAll; D.speed *= 1.05;
    D.evoDmg = (D.evoDmg || 1) * BAL.evoAll; D.evoHp = (D.evoHp || 1) * BAL.evoAll;
  }
  D.pop = G.ants;
  let brood = 0;
  for (const e of G.eggs) brood += e.n;
  for (const e of G.larvae) brood += e.n;
  // los huevos «sin precio» no cuentan para encarecer el siguiente
  D.eggCost = BAL.eggBase * Math.pow(BAL.eggCurve - add('curve'), Math.max(0, D.pop + brood - (G.free || 0))) * mul('eggCostX');
  // «Toque menguante»: lo rebajado con toques se arrastra a todos los huevos de la colonia (con suelo)
  D.cutMax = Math.min(0.5, BAL.cutMax + add('cutMax'));
  if (G.eggCut) D.eggCost = Math.max(D.eggCost * (1 - D.cutMax), D.eggCost - G.eggCut);
  D.tapCut = !!P.tapCut;
  D.skipDay = !!P.skipDay;
  D.extraEgg = Math.min(0.5, add('extraEgg'));   // probabilidad de un huevo extra gratis
  D.freeEgg = Math.min(0.6, add('freeEgg'));     // probabilidad de que un huevo no encarezca el siguiente
  D.instaHatch = Math.min(0.6, add('instaHatch')); // probabilidad de saltarse la fase de larva
  D.dodge = Math.min(0.5, add('dodge'));         // probabilidad de esquivar un golpe mortal
  D.brood = (1 + add('growth')) * mul('growthX');
  D.twin = add('twin');
  D.click = (1 + add('click')) * mul('clickX');
  D.tapQ = D.click * (1 + add('tapQ'));
  D.tapB = D.click * (1 + add('tapB'));
  D.tapFoe = 1 + add('tapFoe');
  // racha de toques: mejoras del árbol y del linaje (ver comboTap)
  D.comboGap = BAL.comboGap + add('comboGap');
  D.comboStep = BAL.comboStep + add('comboStep');
  D.comboCap = BAL.comboCap + add('comboCap');
  D.comboX = mul('comboX');
  D.dmg = BAL.dmg * (1 + add('dmg')) * mul('dmgX') * D.blood * (D.evoDmg || 1);
  D.hp = BAL.hp * (1 + add('hp')) * mul('hpX') * D.blood * (D.evoHp || 1);
  D.reserve = BAL.reserve * (1 + add('reserve'));
  D.prize = 1 + add('prize');
  D.bioKill = 1 + add('bioKill');
  D.nightWork = !!T.nightWork;
  D.gold = !!T.gold;
  D.jaw = !!T.jaw;
  // suerte: críticos al tocar, entregas dobles y hormigas doradas
  D.tapCrit = Math.min(0.9, add('tapCrit'));       // probabilidad de que un toque valga más
  D.critX = T.critBig ? 5 : 2;                      // cuánto vale un toque de suerte
  D.luck = Math.min(0.9, add('luck'));              // probabilidad de que una entrega valga x2
  D.shinyP = Math.min(0.5, add('shiny'));           // probabilidad de que una hormiga nazca dorada
  D.shinyFood = (T.shinyElite || P.shinyElite) ? 5 : 3; // las doradas traen más comida…
  D.shinyDmg = (T.shinyElite || P.shinyElite) ? 3 : 2;  // …pegan más fuerte…
  D.shinySpeed = 1.5;                                    // …y van más rápido
  D.goldFood = Math.min(0.5, add('goldFood'));      // probabilidad de que una entrega sea comida dorada (×5)
  D.ghost = add('ghost') * mul('ghostX');           // toques por segundo de la mano fantasma
  D.lives = P.lives || 0;
  D.farm = add('farm');        // granjas: jalea sola, en fracción del premio de una noche por minuto
  D.combo = !!P.combo;         // la racha se desbloquea en el linaje («Racha»)
  D.noStore = storeClosed(G, P);
  D.discount = P.discount || 0;
  D.next = STAGES[G.stage + 1] || null;
  D.night = nightDef(G.level);
  return D;
}

export function nightDef(n) {
  const era = eraFor(n), final = n >= FINAL_NIGHT && era.final;
  // cada era aprieta más que la anterior: además de crecer noche a noche, ×eraHard por era
  const hard = Math.pow(BAL.eraHard, Math.floor((Math.min(n, FINAL_NIGHT) - 1) / 4));
  const d = { n, era, count: final ? 0 : BAL.foeCount0 + Math.ceil(n * BAL.foeCountK), hpEach: BAL.foeHp0 * Math.pow(BAL.foeHpG, n - 1) * hard, dpsEach: BAL.foeDps0 * Math.pow(BAL.foeDpsG, n - 1) * hard, boss: null };
  d.time = final ? NIGHT_FINAL : NIGHT;
  if (final) d.boss = { type: era.boss, name: era.bossName, hp: d.hpEach * BAL.humanHp, dps: d.dpsEach * BAL.humanDps, final: true };
  else if (n % 4 === 0) d.boss = { type: era.boss, name: era.bossName, hp: d.hpEach * BAL.bossHp, dps: d.dpsEach * BAL.bossDps };
  d.totalHp = d.count * d.hpEach + (d.boss ? d.boss.hp : 0);
  d.totalDps = d.count * d.dpsEach + (d.boss ? d.boss.dps : 0);
  d.text = final ? '¡los humanos!' : d.count + ' ' + (d.count === 1 ? era.one : era.many) + (d.boss ? ' y ' + d.boss.name : '');
  return d;
}

/** Los humanos solo se pueden herir con la última evolución de la especie. */
export const immuneBoss = (G, d) => !!(d.boss && d.boss.final && (G.evo || 0) < EVOS.length - 1);
/** Jalea que da ganar la noche de ahora (también mide las granjas). */
export const nightPrize = (G, D) => BAL.prize0 * Math.pow(BAL.prizeG, G.level - 1) * D.prize;

/** Predicción del combate de esta noche con las hormigas actuales. */
export function forecast(G, D) {
  const d = D.night, dps = fightForce(G, D) * D.dmg, pool = G.ants * D.hp;
  if (immuneBoss(G, d)) return { win: false, losses: G.ants, immune: true };
  if (dps <= 0) return { win: false, losses: 0 };
  if (!d.count) {
    // solo un jefe (los humanos): pega todo el rato y cada baja resta daño a las que quedan
    const kill = d.totalDps * 1.15 * (1 - D.dodge) / D.hp, most = dps * G.ants / (2 * kill); // bajas por segundo; daño máximo antes de caer todas
    if (d.totalHp >= most) return { win: false, losses: G.ants, time: Infinity };
    const T = (1 - Math.sqrt(1 - d.totalHp / most)) * G.ants / kill;
    return { win: T < d.time - 6, losses: Math.min(G.ants, Math.floor(kill * T)), time: T };
  }
  const T = d.totalHp / dps;
  const dmgTaken = d.totalDps * T * (d.count + 1) / (2 * Math.max(1, d.count)) * 1.15;
  return { win: dmgTaken < pool && T < d.time - 6, losses: Math.min(G.ants, Math.floor(dmgTaken / D.hp)), time: T };
}

const freeSlot = arr => { for (let s = 0; s < BROOD_SLOTS; s++) if (!arr.some(e => e.slot === s)) return s; return -1; };

function layEgg(G, D, extra) {
  const s = freeSlot(G.eggs), n = Math.random() < D.twin ? 2 : 1;
  G.stats.laid++;
  if (Math.random() < D.freeEgg) G.free = (G.free || 0) + n; // este huevo no encarece el siguiente
  if (s < 0) { const e = G.eggs[Math.floor(Math.random() * G.eggs.length)]; e.n += n; emit('lay', { e, twin: n > 1, extra }); }
  else { const e = { id: uid++, n, p: 0, slot: s }; G.eggs.push(e); emit('lay', { e, twin: n > 1, extra }); }
  if (!extra && Math.random() < D.extraEgg) layEgg(G, D, true); // huevo de regalo (no encadena otro)
}

/** Colonia vacía: sin hormigas, ni huevos, ni larvas. */
export const emptyColony = G => G.ants <= 0 && !G.eggs.length && !G.larvae.length && G.phase !== 'dead';

/**
 * Siempre se puede crear al menos una hormiga: con la colonia vacía, la reina pone un huevo
 * ya mismo y cuesta, como mucho, lo que tengas (primero su barra de huevo y después la jalea).
 */
function emergencyEgg(G) {
  if (!emptyColony(G)) return;
  const D = calc(G), pay = Math.min(D.eggCost, G.lay + G.jelly), fromLay = Math.min(G.lay, pay);
  G.lay -= fromLay; G.jelly -= pay - fromLay;
  layEgg(G, D);
  emit('emergencyEgg', { paid: pay });
}

function digest(G) {
  emergencyEgg(G);
  let n = 0, D = calc(G);
  while (G.lay >= D.eggCost && n++ < 5) { G.lay -= D.eggCost; layEgg(G, D); D = calc(G); }
  while (STAGES[G.stage + 1] && G.eaten >= STAGES[G.stage + 1].at) { G.stage++; emit('stage', { stage: STAGES[G.stage] }); }
}

/**
 * Llega comida al nido. Las hormigas se turnan: una se la da a la reina (dest 'queen': llena la
 * barra del próximo huevo) y la siguiente la guarda en la despensa (dest 'store': jalea para el árbol).
 * Sin dest (simulador, rutas nocturnas) se reparte mitad y mitad.
 */
export function feed(G, amount, dest) {
  const all = storeClosed(G); // «Todo para la reina»: la despensa ya no hace falta
  const toQueen = all || dest === 'queen' ? amount : dest === 'store' ? 0 : amount / 2;
  G.lay += toQueen; G.jelly += amount - toQueen;
  G.rate += amount / 20; // la comida no hace crecer a la reina: solo los toques (click)
  digest(G);
}

/** Racha de toques: cuenta el toque y devuelve el multiplicador (cada toque seguido rinde algo más). */
export function comboTap(G, D = calc(G)) {
  if (!D.combo) { G.combo = 0; return 1; } // sin «Racha» en el linaje no hay racha
  const t = G.total || 0;
  G.combo = t - (G.comboT ?? -1e9) <= D.comboGap ? (G.combo || 0) + 1 : 1;
  G.comboT = t;
  return comboMult(G, D);
}
/** Multiplicador de la racha actual: 1 sin racha; cada toque seguido suma comboStep (×comboX), hasta comboCap toques. */
export const comboMult = (G, D = calc(G)) => 1 + Math.min(Math.max(0, (G.combo || 1) - 1), D.comboCap) * D.comboStep * D.comboX;

/** ghost: toque de la mano fantasma (no cuenta como toque tuyo ni alarga tu racha). */
export function click(G, kind, id, ghost) {
  if (G.phase === 'dead') return {};
  const D = calc(G), m = ghost ? 1 : comboTap(G, D);
  if (!ghost) G.stats.clicks++;
  if (kind === 'queen') {
    const crit = Math.random() < D.tapCrit, f = BAL.tapFood * D.tapQ * (crit ? D.critX : 1) * m, before = G.stats.laid;
    // con «Toque menguante» el toque no alimenta: rebaja para siempre lo que cuesta cada huevo
    if (D.tapCut) G.eggCut = (G.eggCut || 0) + f;
    else G.lay += f;
    G.eaten += f; // solo los toques hacen crecer a la reina
    if (D.gold) G.jelly += f * 0.5;
    digest(G);
    return { laid: G.stats.laid > before, food: f, cut: D.tapCut, crit: crit ? D.critX : 0, combo: G.combo, mult: m };
  }
  const e = (kind === 'egg' ? G.eggs : G.larvae).find(x => x.id === id);
  const crit = Math.random() < D.tapCrit, k = (crit ? D.critX : 1) * m;
  if (e) e.p += BAL.tapBrood * D.tapB * k;
  return { pct: Math.round(100 * BAL.tapBrood * D.tapB * k), crit: crit ? D.critX : 0, combo: G.combo, mult: m };
}

/** Las doradas rinden más (ver shinyFood, shinyDmg y shinySpeed en calc). */
export const workForce = (G, D = calc(G)) => G.ants + (D.shinyFood * D.shinySpeed - 1) * (G.shiny || 0);
export const fightForce = (G, D = calc(G)) => G.ants + (D.shinyDmg - 1) * (G.shiny || 0);

function kill(G, D) {
  if (G.ants <= 0) return false;
  if (D && Math.random() < D.dodge) { emit('dodge', {}); return false; } // veterana: esquiva el golpe
  const shiny = (G.shiny || 0) > 0 && Math.random() < G.shiny / G.ants;
  G.ants--; G.stats.dead++;
  if (shiny) G.shiny--;
  if (G.free > 0 && Math.random() < G.free / (G.ants + 1)) G.free--; // la que muere podía ser «sin precio»
  emit('death', { caste: 'ants', shiny });
  return true;
}

function born(G, n, slotIdx) {
  const D = calc(G);
  for (let i = 0; i < n; i++) {
    const shiny = Math.random() < D.shinyP;
    G.ants++; if (shiny) G.shiny = (G.shiny || 0) + 1;
    emit('born', { caste: 'ants', slot: slotIdx, shiny });
  }
  G.stats.born += n;
}

function tickBrood(G, D, dt) {
  for (let i = G.eggs.length - 1; i >= 0; i--) {
    const e = G.eggs[i];
    e.p += dt / BAL.eggTime * D.brood;
    if (e.p < 1) continue;
    const s = freeSlot(G.larvae);
    if (s < 0) { e.p = 1; continue; }
    G.eggs.splice(i, 1);
    if (Math.random() < D.instaHatch) { born(G, e.n, e.slot); continue; } // eclosión precoz: sin fase de larva
    const from = e.slot; e.slot = s; e.p = 0; G.larvae.push(e);
    emit('hatch', { e, from });
  }
  for (let i = G.larvae.length - 1; i >= 0; i--) {
    const e = G.larvae[i];
    e.p += dt / BAL.larvaTime * D.brood;
    if (e.p >= 1) { G.larvae.splice(i, 1); born(G, e.n, e.slot); }
  }
}

function tickNight(G, D, dt) {
  const f = G.foes, d = D.night;
  if (f.arrive > 0) { f.arrive -= dt; return; }
  const eDps = f.count * d.dpsEach + (f.boss > 0 ? d.boss.dps : 0);
  let dmg = fightForce(G, D) * D.dmg * dt;
  while (dmg > 0 && (f.count > 0 || f.boss > 0)) {
    if (f.count > 0) {
      const a = Math.min(dmg, f.cur); f.cur -= a; dmg -= a;
      if (f.cur <= 0.0001) { f.count--; f.cur = d.hpEach; G.bio += D.bioKill; emit('foeDeath', {}); }
    } else {
      if (immuneBoss(G, d)) break; // los humanos: solo los hiere la última evolución
      const a = Math.min(dmg, f.boss); f.boss -= a; dmg -= a;
      if (f.boss <= 0.0001) { f.boss = 0; G.bio += 4 * D.bioKill; emit('foeDeath', { boss: true }); }
    }
  }
  if (G.ants > 0) {
    G.guard -= eDps * dt;
    while (G.guard <= 0 && G.ants > 0) { if (kill(G, D)) f.lost++; G.guard += D.hp; }
  }
  if (f.count <= 0 && f.boss <= 0) {
    const prize = BAL.prize0 * Math.pow(BAL.prizeG, G.level - 1) * D.prize;
    G.jelly += prize;
    G.best = Math.max(G.best, G.level);
    if (d.boss) G.hives = (G.hives || 0) + 1; // colmena rival derrotada: se abre la opción de fundar
    emit('nightWin', { level: G.level, prize, lost: f.lost });
    if (G.level === FINAL_NIGHT && !G.won) { G.won = true; emit('victory', { time: G.total, gen: G.gen }); }
    G.level++; dawn(G);
    return;
  }
  // sin hormigas: los enemigos entran por el túnel a por la reina
  if (G.ants <= 0) {
    if (f.raid === 0) emit('raid', {});
    f.raid += dt;
    if (f.raid >= RAID) {
      if (G.livesUsed < D.lives) { G.livesUsed++; emit('queenSurvives', {}); emit('nightLost', { lost: f.lost }); dawn(G); return; }
      queenDies(G);
    }
  }
}

/** ADN de las noches superadas: las noches con el día saltado cuentan la mitad. */
const adnGain = G => adnFor(Math.max(0, G.level - 1 - 0.5 * Math.min(G.skips || 0, G.level - 1)), G.stage);

/** «Saltar el día»: la noche llega ya (y dará la mitad de ADN). */
export function skipDay(G) {
  if (!calc(G).skipDay || G.phase !== 'day' || G.t <= DUSK) return false;
  G.t = 0.01; G.skips = (G.skips || 0) + 1;
  return true;
}

function queenDies(G) {
  const gain = adnGain(G);
  // el ADN se cobra ya, para poder gastarlo en el Linaje antes de fundar la colonia nueva
  // se limpian los enemigos: si no, el asalto sigue y la escena parece «desplazada»
  G.phase = 'dead'; G.foes = null; G.pendingAdn = gain; G.adn += gain; G.adnTotal = (G.adnTotal || 0) + gain;
  G.best = Math.max(G.best, G.level - 1);
  emit('queenDeath', { gain, level: G.level, gen: G.gen });
}

function dawn(G) { G.foes = null; G.phase = 'day'; G.t = DAY; G.warned = false; }

/** Ingresos de recolección sin escena (para el simulador). */
export const forageRate = (G, D) => workForce(G, D) * D.carry * (1 + D.luck) * (1 + 4 * D.goldFood) / BAL.trip * (D.speed / 2.6);

export function tick(G, dt) {
  const D = calc(G);
  if (G.phase === 'dead') return D;
  G.stats.time += dt; G.total += dt;
  G.rate = Math.max(0, G.rate - G.rate * dt / 20);
  G.lay += D.reserve * dt;
  if (D.farm > 0) G.jelly += D.farm * nightPrize(G, D) / 60 * dt; // granjas: jalea sola, también de noche
  // mano fantasma: toca a la reina sola cada cierto tiempo
  if (D.ghost > 0) {
    G.ghostT = (G.ghostT || 0) + dt * D.ghost;
    while (G.ghostT >= 1) { G.ghostT -= 1; emit('ghost', click(G, 'queen', null, true)); }
  }
  if (emptyColony(G)) digest(G);
  if (G.phase === 'night' && D.nightWork && G.ants > 0) feed(G, forageRate(G, D) * 0.5 * dt);
  if (G.lay >= D.eggCost) digest(G);
  tickBrood(G, D, dt);

  G.t -= dt;
  if (G.phase === 'day') {
    if (!G.warned && G.t <= DUSK) { G.warned = true; emit('dusk', { def: D.night }); }
    if (G.t <= 0) {
      const d = D.night;
      G.phase = 'night'; G.t = d.time;
      G.foes = { count: d.count, cur: d.hpEach, boss: d.boss ? d.boss.hp : 0, arrive: 5, lost: 0, raid: 0 };
      G.guard = D.hp;
      emit('night', { def: d });
    }
  } else {
    tickNight(G, D, dt);
    if (G.phase === 'night' && G.t <= 0) { // aguantaron sin ganar: se retiran, sin premio
      G.best = Math.max(G.best, G.level);
      emit('nightLost', { lost: G.foes.lost });
      if (G.level !== FINAL_NIGHT || G.won) G.level++; // a los humanos hay que vencerlos: vuelven cada noche
      dawn(G);
    }
  }

  if (G.obj < OBJ.length && OBJ[G.obj][1](G)) {
    G.jelly += OBJ[G.obj][2];
    emit('goal', { text: OBJ[G.obj][0], prize: OBJ[G.obj][2] });
    G.obj++;
  }
  return D;
}

/* ---------- árboles ---------- */

/**
 * «Todo para la reina» (linaje): ¿queda algo que comprar con jalea en el árbol de la colonia?
 * Solo cuenta lo que está a tu alcance (conectado y con sus requisitos); los rombos no usan jalea.
 * Se guarda en caché mientras no cambie lo comprado.
 */
const storeCache = { G: null, key: '', v: false };
function storeClosed(G, P = treeFx(PERKS, G.perm)) {
  if (!P.noStore) return false;
  const key = Object.keys(G.skills).join() + '|' + Object.keys(G.perm).join();
  if (storeCache.G === G && storeCache.key === key) return storeCache.v;
  const st = treeStates(SKILLS, G.skills, G.perm); // los que piden algo del linaje no cuentan si falta
  const v = !Object.keys(SKILLS).some(id => st[id] === 'open' && typeof SKILLS[id].cost !== 'object');
  Object.assign(storeCache, { G, key, v });
  return v;
}

/** Cuántos nodos de cada moneda hay comprados en el árbol de la colonia (encarecen los siguientes). */
function ownedCount(G) {
  let jelly = 0, bio = 0;
  for (const id in G.skills) { const n = SKILLS[id]; if (!n) continue; if (typeof n.cost === 'object') bio++; else jelly++; }
  return { jelly, bio };
}

/**
 * Coste de un nodo: { cur: 'jelly' | 'bio' | 'adn', n }.
 * La jalea sigue la curva del registro: hasta el nivel 12 como antes, y del 13 al 18
 * más lenta, para que una colonia que junta unos millones pueda seguir comprando.
 */
export function nodeCost(G, tree, id) {
  const n = (tree === 'perm' ? PERKS : SKILLS)[id], c = n.cost;
  if (typeof c === 'object' && c.adn != null) return { cur: 'adn', n: Math.max(1, Math.round(c.adn * (BAL.perkK ?? 1))) };
  const k = ownedCount(G);
  if (typeof c === 'object') return { cur: 'bio', n: Math.max(1, Math.round(c.bio * (BAL.bioK ?? 1) * Math.pow(BAL.bioOwnG, k.bio))) };
  const disc = treeFx(PERKS, G.perm).discount || 0;
  const knee = (BAL.skillKnee ?? 12) - 1, over = Math.max(0, c - 1 - knee);
  const exp = Math.min(c - 1, knee) + over * (BAL.skillTop ?? 1);
  return { cur: 'jelly', n: Math.round(BAL.skill0 * Math.pow(BAL.skillG, exp) * Math.pow(BAL.skillOwnG, Math.max(0, k.jelly - BAL.skillFree)) * (1 - disc)) };
}

export const states = (G, tree) => tree === 'perm' ? treeStates(PERKS, G.perm) : treeStates(SKILLS, G.skills, G.perm);

export function canBuy(G, tree, id) {
  const st = states(G, tree)[id], c = nodeCost(G, tree, id);
  if (debug.free && c.cur === 'adn') return st === 'open';
  return st === 'open' && G[c.cur] >= c.n;
}

export function buyNode(G, tree, id) {
  if (!canBuy(G, tree, id)) return false;
  const c = nodeCost(G, tree, id);
  if (!(debug.free && c.cur === 'adn')) G[c.cur] -= c.n;
  if (tree === 'perm') G.perm[id] = true;
  else { G.skills[id] = true; G.spent[c.cur] = (G.spent[c.cur] || 0) + c.n; }
  emit('skill', { id, tree });
  return true;
}

/** Devuelve todo lo gastado en el árbol de la colonia y lo vacía. */
export function resetSkills(G) {
  if (!Object.keys(G.skills).length) return false;
  G.jelly += G.spent.jelly || 0; G.bio += G.spent.bio || 0;
  G.skills = {}; G.spent = { jelly: 0, bio: 0 };
  emit('skill', { id: 'reset', tree: 'skills' });
  return true;
}

/**
 * Autocompra: compra lo más barato que se pueda pagar, primero con jalea y luego los rombos de biomasa.
 * Devuelve cuántos nodos ha comprado (como mucho `max` por llamada).
 */
export function autoBuy(G, max = 3) {
  let n = 0;
  while (n < max) {
    const st = states(G, 'skills');
    const best = Object.keys(SKILLS).filter(id => st[id] === 'open').map(id => ({ id, c: nodeCost(G, 'skills', id) }))
      .filter(o => G[o.c.cur] >= o.c.n)
      .sort((a, b) => (a.c.cur === b.c.cur ? 0 : a.c.cur === 'jelly' ? -1 : 1) || a.c.n - b.c.n)[0];
    if (!best || !buyNode(G, 'skills', best.id)) break;
    n++;
  }
  return n;
}

export const missing = (G, tree, id) => missingNeeds(tree === 'perm' ? PERKS : SKILLS, tree === 'perm' ? G.perm : G.skills, id);

export const anyBuyable = (G, tree) => Object.keys(tree === 'perm' ? PERKS : SKILLS).some(id => canBuy(G, tree, id));

/** Toque sobre un enemigo: daño extra, nunca remata (eso lo hacen las hormigas). */
export function hit(G, D) {
  const f = G.foes;
  if (!f || f.arrive > 0) return 0;
  if (f.count <= 0 && immuneBoss(G, D.night)) return 0; // a los humanos no les hacen nada los toques sin la última forma
  const a = Math.max(1, D.dmg * 2 * D.tapFoe) * comboTap(G, D);
  if (f.count > 0) f.cur -= Math.min(a, f.cur - 0.01);
  else f.boss = Math.max(0.01, f.boss - a);
  return a;
}

/* ---------- evolución ---------- */

/** Estado de la evolución i: 'done' | 'next' (comprable si hay ADN) | 'locked' (falta vencer al jefe) | 'later'. */
export function evoState(G, i) {
  const cur = G.evo || 0;
  if (i < 0 || i >= EVOS.length) return 'later';
  if (i <= cur) return 'done';
  if (debug.free) return 'next';
  if (i > cur + 1) return 'later';
  return (G.best || 0) >= EVOS[i].req ? 'next' : 'locked';
}
export const evoCost = i => Math.round(EVOS[i].cost * BAL.evoCostK);
export const canEvolve = G => (G.evo || 0) < EVOS.length - 1 && evoState(G, (G.evo || 0) + 1) === 'next' && (debug.free || G.adn >= evoCost((G.evo || 0) + 1));
export const evoBoss = i => ERAS.find(e => e.from + 3 === EVOS[i].req)?.bossName || 'el jefe';

export function evolve(G, to) {
  const cur = G.evo || 0;
  const pick = debug.free && to > cur && to < EVOS.length ? to : cur + 1;
  if (pick <= cur || pick >= EVOS.length) return false;
  if (!debug.free && (!canEvolve(G) || pick !== cur + 1)) return false;
  if (!debug.free) G.adn -= evoCost(pick);
  G.evo = pick;
  emit('evolve', { evo: pick, name: EVOS[pick].name });
  return true;
}

/* ---------- linaje ---------- */

export function legacy(G) {
  // se puede fundar a voluntad tras superar la noche 3 (BAL.foundAfter) o derrotar a algún jefe:
  // así nunca te quedas atascado ante un jefe que no puedes vencer. Siempre da al menos 1 ADN.
  const ready = ((G.hives || 0) > 0 || G.level - 1 >= BAL.foundAfter) && G.phase !== 'dead';
  return { ready, gain: Math.max(1, adnGain(G)) };
}

/**
 * Fundar a voluntad: la princesa se va y la colonia se cierra. El ADN se cobra ya,
 * para gastarlo en el Linaje antes de empezar la colonia nueva (como al morir la reina).
 */
export function abandon(G) {
  const l = legacy(G);
  if (!l.ready) return false;
  G.adn += l.gain; G.adnTotal = (G.adnTotal || 0) + l.gain; G.pendingAdn = l.gain;
  G.best = Math.max(G.best, G.level - 1);
  G.phase = 'dead'; G.leaving = true; G.foes = null;
  emit('abandon', { gain: l.gain });
  return true;
}

/** Funda una colonia nueva. Tras la muerte de la reina es obligatorio; en vida, tras superar la noche 3. */
export function prestige(G) {
  const dead = G.phase === 'dead', l = legacy(G);
  if (!dead && !l.ready) return null;
  const gain = dead ? 0 : l.gain; // si murió, el ADN ya se cobró en queenDies
  return newGame({ evo: G.evo || 0, adnTotal: (G.adnTotal || 0) + gain, adn: G.adn + gain, perm: G.perm, gen: G.gen + 1, mute: G.mute, obj: G.obj, best: Math.max(G.best, G.level - 1), won: G.won, total: G.total,
    inherit: G.jelly + (G.spent.jelly || 0), autoBuy: G.autoBuy }); // Herencia: parte de la jalea reunida
}

