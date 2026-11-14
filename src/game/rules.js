// Reglas puras de la colonia: día y noche, cría, combate, árboles, muerte de la reina y linaje.
// No sabe nada de Three.js ni del DOM; avisa de lo que pasa con emit().
import { emit } from '../core/events.js';
import { EVOS, ERAS, STAGES, OBJ, DAY, NIGHT, NIGHT_FINAL, DUSK, BROOD_SLOTS, BAL, FINAL_NIGHT, RAID, eraFor } from './data.js';
import { debug } from './debug.js';
import { SKILLS, PERKS, treeFx, treeStates, linajeSkills } from './trees.js';

let uid = 1;
export const adnFor = (nights, stage) => Math.max(1, Math.floor(Math.pow(Math.max(0, nights), BAL.adnP) * BAL.adnK + stage * 2));
export const bumpUid = id => { uid = Math.max(uid, id + 1); };
/** Versión de los árboles: las partidas con otra se reparten de nuevo al cargar (storage.js). */
export const TREE_V = 3;

/** Partida nueva. keep: lo que hereda una colonia nueva (ADN, linaje, objetivos…). */
export function newGame(keep) {
  const G = {
    v: 4, treeV: TREE_V, last: Date.now(), jelly: 0, eaten: 0, ants: 0, lay: 0, stage: 0, eggs: [], larvae: [], skills: {},
    phase: 'day', t: DAY, level: 1, warned: false, foes: null, guard: 0, bio: 0, rate: 0, spent: { jelly: 0, bio: 0 },
    livesUsed: 0, hives: 0, shiny: 0, evo: 0, obj: 0, adn: 0, adnTotal: 0, perm: {}, gen: 1, best: 0, won: false, total: 0, mute: false,
    audio: null, butler: false, speed: 1, clock: 0, combo: 0, comboT: 0, comboLive: false, eggCut: 0,
    stats: { clicks: 0, laid: 0, born: 0, dead: 0, time: 0 }
  };
  if (keep) {
    Object.assign(G, { autoBuy: !!keep.autoBuy, butler: !!keep.butler, speed: keep.speed || 1, eggCut: keep.eggCut || 0, evo: keep.evo || 0, adnTotal: keep.adnTotal || 0, adn: keep.adn, perm: keep.perm, gen: keep.gen, mute: keep.mute, audio: keep.audio || null, obj: keep.obj, best: keep.best, won: keep.won, total: keep.total });
    const P = treeFx(PERKS, G.perm);
    G.ants = P.startAnts || 0; G.jelly = (P.startJelly || 0) + (keep.inherit || 0) * (P.keepJelly || 0); G.bio = P.startBio || 0;
    for (let i = 0; i < Math.min(BROOD_SLOTS, P.startEggs || 0); i++) G.eggs.push({ id: uid++, n: 1, p: 0, slot: i }); // nido preparado
  }
  return G;
}

/** Valores derivados (árbol + linaje + balance). Se llama muchas veces por segundo. */
export function calc(G) {
  const T = treeFx(SKILLS, { ...G.skills, ...linajeSkills(G.perm).own });
  const P = treeFx(PERKS, G.perm), D = { T, P };
  // los valores de los árboles son los que se aplican (lo que dice cada nodo es lo que da)
  const add = k => (T[k] || 0) + (P[k] || 0), mul = k => (T[k] ?? 1) * (P[k] ?? 1);
  D.blood = 1 + BAL.blood * (G.adnTotal || 0); // Sangre antigua
  D.carry = BAL.carry * (1 + add('food')) * mul('foodX') * Math.pow(BAL.stageFood, G.stage) * D.blood;
  D.speed = 2.6 * (1 + add('speed'));
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
  const raw = BAL.eggBase * Math.pow(BAL.eggCurve - add('curve'), Math.max(0, D.pop + brood - (G.free || 0))) * mul('eggCostX');
  // «Toque menguante»: tus toques juntan un descuento fijo de comida (G.eggCut) que se guarda para siempre (pasa de
  // colonia en colonia) y se resta de cada huevo. El porcentaje es el suelo: un huevo no baja de ahí, y mientras el
  // descuento ya lo cubra, el toque vuelve a alimentar a la reina. Huevo de 7M con 1M guardado: 6M; huevo de 5000: −25%.
  D.cutMax = Math.min(0.5, BAL.cutMax + add('cutMax'));
  const floor = raw * (1 - D.cutMax);
  D.eggCost = Math.max(floor, raw - (G.eggCut || 0));
  D.cutRoom = P.tapCut ? Math.max(0, D.eggCost - floor) : 0;
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
  D.tapSplash = Math.min(1, add('tapSplash'));   // «Mimo contagioso»: parte del toque a la cría llega al resto
  // racha de toques: mejoras del árbol y del linaje (ver comboTap)
  D.comboGap = BAL.comboGap + add('comboGap');
  D.comboStep = BAL.comboStep + add('comboStep');
  D.comboCap = BAL.comboCap + add('comboCap');
  D.comboX = mul('comboX');
  D.comboEarly = Math.min(0.3, add('comboEarly')); // las marcas llegan antes
  D.comboKeep = Math.min(0.5, add('comboKeep'));   // lo que queda de la racha al perderla
  D.dmg = BAL.dmg * (1 + add('dmg')) * mul('dmgX') * D.blood * (D.evoDmg || 1);
  D.hp = BAL.hp * (1 + add('hp')) * mul('hpX') * D.blood * (D.evoHp || 1);
  D.reserve = BAL.reserve * (1 + add('reserve'));
  D.qJelly = add('qJelly') * (1 + add('qJellyP')); // jalea por segundo que genera la reina (linaje; el árbol la sube en %)
  D.prize = 1 + add('prize');
  D.bioKill = 1 + add('bioKill');
  D.nightWork = !!(T.nightWork || P.nightWork);
  D.gold = !!(T.gold || P.gold);
  D.jaw = !!(T.jaw || P.jaw);
  // suerte: críticos al tocar, entregas dobles y hormigas doradas
  D.tapCrit = Math.min(BAL.tapCritMax, add('tapCrit')); // probabilidad de que un toque valga más
  D.critX = (T.critBig || P.critBig) ? 5 : 2;       // cuánto vale un toque de suerte
  D.luck = Math.min(0.9, add('luck'));              // probabilidad de que una entrega valga x2
  D.shinyP = Math.min(0.5, add('shiny'));           // probabilidad de que una hormiga nazca dorada
  D.shinyFood = (T.shinyElite || P.shinyElite) ? 5 : 3; // las doradas traen más comida…
  D.shinyDmg = (T.shinyElite || P.shinyElite) ? 3 : 2;  // …pegan más fuerte…
  D.shinySpeed = 1.5;                                    // …y van más rápido
  D.goldFood = Math.min(0.5, add('goldFood'));      // probabilidad de que una entrega sea comida dorada (×5)
  D.feast = Math.min(0.03, BAL.feast + add('feast')); // «Festín»: entrega ×50 (0,1% de base, 3% como máximo)
  D.ghost = Math.min(BAL.ghostMax, add('ghost') * mul('ghostX')); // toques por segundo de las manos fantasma
  D.lives = P.lives || 0;
  D.farm = add('farm');        // granjas: jalea sola, en fracción del premio de una noche por minuto
  D.combo = !!P.combo;         // la racha se desbloquea en el linaje («Racha»)
  // mayordomo: el linaje lo desbloquea y el jugador lo enciende con el interruptor del Árbol (G.butler).
  // G.autoBuy lo usa solo el simulador (tools/bot.mjs).
  D.butler = !!P.autoBuy;
  D.autoBuy = (D.butler && G.butler) || G.autoBuy ? 1 : 0;
  D.resetTree = !!P.resetTree; // «Borrón y cuenta nueva»: botón de reiniciar el árbol
  D.stompHits = BAL.stompHits + (P.stompHits || 0); // pisotones humanos que aguantan las hormigas titán
  D.noStore = storeClosed(G, P);
  D.discount = P.discount || 0;
  D.next = STAGES[G.stage + 1] || null;
  D.night = nightDef(G.level);
  // «Toque nutritivo»: cada toque a la reina suma una parte de lo que la colonia recolecta por segundo
  D.income = forageRate(G, D);
  D.tapRate = Math.min(BAL.tapRateMax, add('tapRate')) * BAL.tapRateK;
  return D;
}

export function nightDef(n) {
  const era = eraFor(n), final = n >= FINAL_NIGHT && era.final;
  // cada era aprieta más que la anterior: además de crecer noche a noche, ×eraHard por era
  const hard = Math.pow(BAL.eraHard, Math.floor((Math.min(n, FINAL_NIGHT) - 1) / 4));
  const d = { n, era, count: final ? 0 : BAL.foeCount0 + Math.ceil(n * BAL.foeCountK), hpEach: BAL.foeHp0 * Math.pow(BAL.foeHpG, n - 1) * hard, dpsEach: BAL.foeDps0 * Math.pow(BAL.foeDpsG, n - 1) * hard, boss: null };
  d.time = final ? NIGHT_FINAL : NIGHT;
  // los humanos no hacen daño poco a poco: pisan (ver tickHuman)
  if (final) d.boss = { type: era.boss, name: era.bossName, hp: d.hpEach * BAL.humanHp, dps: 0, final: true };
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
/** Segundos que aguantan las hormigas titán ante los humanos: hasta el pisotón que las mata. */
export const humanWindow = D => BAL.stompFirst + (D.stompHits - 1) * BAL.stompEvery;

/** Predicción del combate de esta noche con las hormigas actuales. */
export function forecast(G, D) {
  const d = D.night, dps = fightForce(G, D) * D.dmg, pool = G.ants * D.hp;
  if (immuneBoss(G, d)) return { win: false, losses: G.ants, immune: true };
  if (dps <= 0) return { win: false, losses: 0 };
  if (d.boss && d.boss.final) {
    // los humanos: hay que tumbarlos antes del pisotón que mata a todas
    const T = d.totalHp / dps, win = T < humanWindow(D);
    return { win, losses: win ? 0 : G.ants, time: T };
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
  const D = calc(G), pay = Math.min(D.eggCost, G.lay + (debug.free ? D.eggCost : G.jelly)), fromLay = Math.min(G.lay, pay);
  G.lay -= fromLay; if (!debug.free) G.jelly -= pay - fromLay;
  layEgg(G, D);
  emit('emergencyEgg', { paid: pay });
}

function digest(G) {
  emergencyEgg(G);
  let n = 0, D = calc(G);
  while (G.lay >= D.eggCost && n++ < 5) { G.lay -= D.eggCost; layEgg(G, D); D = calc(G); }
  growQueen(G);
}

function growQueen(G) {
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

/* ---------- racha de toques ---------- */

/**
 * Marcas de la racha con «Marca temprana» aplicada (llegan un % antes):
 *   marks [toques, ×valor] · clicks [toques] (en cada una, un toque cuenta como un clic más) · stops (todas, ordenadas)
 */
const markCache = new Map();
export function comboMarks(early = 0) {
  let c = markCache.get(early);
  if (!c) {
    const k = 1 - Math.min(0.3, early), at = n => Math.max(2, Math.round(n * k));
    const marks = BAL.comboMarks.map(([n, m]) => [at(n), m]), clicks = BAL.comboClickAt.map(at);
    c = { marks, clicks, stops: [...new Set([...marks.map(m => m[0]), ...clicks])].sort((a, b) => a - b) };
    markCache.set(early, c);
  }
  return c;
}

/** Marca de racha: { mult ×valor, clicks por toque }. */
export function comboInfo(n, D) {
  const M = comboMarks(D ? D.comboEarly : 0);
  let mult = 1, clicks = 1;
  for (const [at, m] of M.marks) if (n >= at) mult = m;
  for (const at of M.clicks) if (n >= at) clicks++;
  return { mult, clicks };
}

/**
 * Suma un toque a la racha, aterrizando en las marcas. Tus toques suman los clics por toque de la marca en la que
 * va la racha; los de la mano fantasma (step = 1), solo uno.
 */
function comboAdd(G, D, step) {
  const before = G.combo || 0, next = before + (step || comboInfo(before, D).clicks);
  const hit = comboMarks(D.comboEarly).stops.find(at => before < at && at <= next);
  G.combo = hit != null ? hit : next;
}

/**
 * Cuenta atrás oculta: si pasa más de comboGap (reloj real) desde tu último toque, la racha se pierde
 * (con «Racha blindada»/«Racha tenaz» se conserva una parte de la cuenta). La mano fantasma no la reinicia.
 */
function comboCheck(G, D) {
  if (!G.comboLive || (G.clock || 0) - (G.comboT || 0) <= D.comboGap) return;
  G.combo = Math.floor((G.combo || 0) * D.comboKeep);
  G.comboLive = false;
  emit('comboEnd', { kept: G.combo });
}

/** Toque tuyo: cuenta para la racha y devuelve el multiplicador de valor. */
export function comboTap(G, D = calc(G)) {
  if (!D.combo) { G.combo = 0; G.comboLive = false; return 1; } // sin «Racha» en el linaje no hay racha
  comboCheck(G, D);
  if (!G.comboLive) { G.combo = (G.combo || 0) + 1; G.comboLive = true; }
  else comboAdd(G, D);
  G.comboT = G.clock || 0;
  return comboMult(G, D);
}

/** × del toque: rampa solo antes de la 1ª marca; con marca, el × de esa marca. Sin racha viva, ×1. */
export function comboMult(G, D = calc(G)) {
  if (!G.comboLive) return 1;
  const n = G.combo || 0, mark = comboInfo(n, D).mult;
  if (mark > 1) return mark;
  return 1 + Math.min(Math.max(0, n - 1), D.comboCap) * D.comboStep * Math.sqrt(D.comboX);
}

/* ---------- toques ---------- */

/**
 * Un toque a la reina (tuyo o de la mano fantasma): suerte, «Toque nutritivo», «Toque menguante» y «Toque dorado».
 * room: lo que aún se puede rebajar del huevo. No hace digest (lo hace quien llama).
 */
function queenTap(G, D, m, room) {
  const crit = Math.random() < D.tapCrit ? D.critX : 0;
  const f = (BAL.tapFood * D.tapQ + D.tapRate * D.income) * (crit || 1) * m;
  const cut = D.tapCut ? Math.min(f, room) : 0;
  if (cut > 0) G.eggCut = (G.eggCut || 0) + cut;
  const feed = f - cut;
  if (feed > 0) G.lay += feed;
  G.eaten += f; // solo los toques hacen crecer a la reina
  if (D.gold) G.jelly += f * 0.5;
  return { f, cut, feed, crit };
}

export function click(G, kind, id) {
  if (G.phase === 'dead') return {};
  const D = calc(G), m = comboTap(G, D);
  G.stats.clicks++;
  if (kind === 'queen') {
    const before = G.stats.laid, r = queenTap(G, D, m, D.cutRoom);
    digest(G);
    return { laid: G.stats.laid > before, food: r.feed > 0 ? r.feed : r.f, cut: r.feed <= 0, crit: r.crit, combo: G.combo, mult: m };
  }
  const e = (kind === 'egg' ? G.eggs : G.larvae).find(x => x.id === id);
  const crit = Math.random() < D.tapCrit, push = BAL.tapBrood * D.tapB * (crit ? D.critX : 1) * m;
  if (e) e.p += push;
  // «Mimo contagioso»: el resto de la cría también se adelanta un poco
  if (D.tapSplash > 0) for (const o of G.eggs.concat(G.larvae)) if (o !== e) o.p += push * D.tapSplash;
  return { pct: Math.round(100 * push), crit: crit ? D.critX : 0, combo: G.combo, mult: m };
}

/**
 * Varios toques de la mano fantasma de golpe: un solo digest y un solo evento.
 * Tiene todo lo de tus toques. Con la racha viva, cada toque suyo la sube en uno (pero no reinicia la
 * cuenta atrás: eso solo lo hacen tus toques); sin racha viva, ni la sube ni cobra su ×.
 */
function ghostBatch(G, D, n) {
  if (n < 1 || G.phase === 'dead') return null;
  let food = 0, cutTot = 0, eaten = 0, crit = 0, room = D.cutRoom, m = 1;
  const before = G.stats.laid, comboBefore = G.combo || 0, live = D.combo && G.comboLive;
  for (let i = 0; i < n; i++) {
    if (live) { comboAdd(G, D, 1); m = comboMult(G, D); }
    const r = queenTap(G, D, m, room);
    room -= r.cut; cutTot += r.cut; eaten += r.f;
    if (r.feed > 0) food += r.feed;
    if (r.crit) crit = r.crit;
  }
  digest(G);
  return { n, laid: G.stats.laid > before, food: food > 0 ? food : eaten, cut: food <= 0 && cutTot > 0, crit, combo: G.combo || 0, comboBefore, mult: m };
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

/**
 * Pisotón humano: mueren todas de golpe salvo las que esquivan (dodge). Un solo evento ('massDeath'),
 * no uno por hormiga. Devuelve cuántas murieron.
 */
function wipe(G, dodge) {
  const n0 = G.ants;
  if (n0 <= 0) return 0;
  let keep = 0;
  if (dodge > 0) { if (n0 <= 2000) { for (let i = 0; i < n0; i++) if (Math.random() < dodge) keep++; } else keep = Math.round(n0 * dodge); }
  const n = n0 - keep;
  if (n <= 0) return 0;
  G.shiny = Math.round((G.shiny || 0) * keep / n0);
  G.free = Math.round((G.free || 0) * keep / n0);
  G.ants = keep; G.stats.dead += n;
  if (G.foes) G.foes.lost += n;
  emit('massDeath', { n });
  return n;
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

/** Se supera una noche (ganada o aguantada): cuenta el día saltado y sube de nivel. */
function passNight(G) {
  if (G.skipNow) G.skips = (G.skips || 0) + 1; // «Saltar el día» cuenta al superar la noche, no al pulsar
  G.level++; dawn(G);
}

/** Noche ganada: premio, récord y, si era la final, victoria. */
function winNight(G, D) {
  const d = D.night, f = G.foes, prize = nightPrize(G, D);
  G.jelly += prize;
  G.best = Math.max(G.best, G.level);
  if (d.boss) G.hives = (G.hives || 0) + 1; // colmena rival derrotada: se abre la opción de fundar
  emit('nightWin', { level: G.level, prize, lost: f.lost });
  if (G.level === FINAL_NIGHT && !G.won) { G.won = true; emit('victory', { time: G.total, gen: G.gen }); }
  passNight(G);
}

/** La reina cae (o resiste una vez con «Nido fortificado»). */
function queenFalls(G, D) {
  if (G.livesUsed < D.lives) { G.livesUsed++; emit('queenSurvives', {}); emit('nightLost', { lost: G.foes.lost }); dawn(G); return; }
  queenDies(G);
}

/**
 * Noche final: los humanos pisan cada BAL.stompEvery segundos (el primero, a los BAL.stompFirst).
 *   Sin la última evolución: el primer pisotón mata a todas y el siguiente, a la reina.
 *   Con ella: aguantan D.stompHits pisotones; en ese, caen todas (salvo las que esquivan).
 *   Sin hormigas, el pisotón va al nido.
 * Las hormigas titán hieren al humano todo el rato; si cae, se gana la noche (y el juego).
 */
function tickHuman(G, D, dt) {
  const f = G.foes, immune = immuneBoss(G, D.night);
  if (!immune && G.ants > 0) {
    f.boss -= fightForce(G, D) * D.dmg * dt;
    if (f.boss <= 0.0001) { f.boss = 0; G.bio += 4 * D.bioKill; emit('foeDeath', { boss: true }); winNight(G, D); return; }
  }
  if (f.stompT == null) { f.stompT = BAL.stompFirst; f.stomps = 0; f.wiped = false; } // partida guardada a mitad de la noche final
  f.stompT -= dt;
  if (f.stompT > 0) return;
  f.stompT += BAL.stompEvery;
  if (G.ants <= 0 || (f.wiped && immune)) { emit('stomp', { queen: true }); queenFalls(G, D); return; }
  if (immune) { const killed = wipe(G, 0); f.wiped = true; f.stomps = 0; emit('stomp', { wipe: true, killed }); return; }
  f.stomps++;
  if (f.stomps >= D.stompHits) { const killed = wipe(G, D.dodge); f.stomps = 0; f.wiped = true; emit('stomp', { wipe: true, killed }); return; }
  emit('stomp', { left: D.stompHits - f.stomps });
}

function tickNight(G, D, dt) {
  const f = G.foes, d = D.night;
  if (f.arrive > 0) { f.arrive -= dt; return; }
  if (d.boss && d.boss.final) { tickHuman(G, D, dt); return; }
  const eDps = f.count * d.dpsEach + (f.boss > 0 ? d.boss.dps : 0);
  let dmg = fightForce(G, D) * D.dmg * dt;
  while (dmg > 0 && (f.count > 0 || f.boss > 0)) {
    if (f.count > 0) {
      const a = Math.min(dmg, f.cur); f.cur -= a; dmg -= a;
      if (f.cur <= 0.0001) { f.count--; f.cur = d.hpEach; G.bio += D.bioKill; emit('foeDeath', {}); }
    } else {
      const a = Math.min(dmg, f.boss); f.boss -= a; dmg -= a;
      if (f.boss <= 0.0001) { f.boss = 0; G.bio += 4 * D.bioKill; emit('foeDeath', { boss: true }); }
    }
  }
  if (G.ants > 0) {
    G.guard -= eDps * dt;
    while (G.guard <= 0 && G.ants > 0) { if (kill(G, D)) f.lost++; G.guard += D.hp; }
  }
  if (f.count <= 0 && f.boss <= 0) { winNight(G, D); return; }
  // sin hormigas: los enemigos entran por el túnel a por la reina
  if (G.ants <= 0) {
    if (f.raid === 0) emit('raid', {});
    f.raid += dt;
    if (f.raid >= RAID) queenFalls(G, D);
  }
}

/** ADN de las noches superadas: las noches con el día saltado cuentan la mitad. */
const adnGain = G => adnFor(Math.max(0, G.level - 1 - 0.5 * Math.min(G.skips || 0, G.level - 1)), G.stage);

/**
 * «Saltar el día»: la noche llega ya. Solo se apunta (skipNow); al superar esa noche contará la mitad
 * de ADN (passNight). Así el ADN previsto nunca baja al pulsar.
 */
export function skipDay(G) {
  if (!calc(G).skipDay || G.phase !== 'day' || G.t <= DUSK) return false;
  G.t = 0.01; G.skipNow = true;
  return true;
}

function queenDies(G) {
  const gain = adnGain(G);
  // el ADN se cobra ya, para poder gastarlo en el Linaje antes de fundar la colonia nueva
  // se limpian los enemigos: si no, el asalto sigue y la escena parece «desplazada»
  G.phase = 'dead'; G.foes = null; G.pendingAdn = gain; G.comboLive = false; G.adn += gain; G.adnTotal = (G.adnTotal || 0) + gain;
  G.best = Math.max(G.best, G.level - 1);
  emit('queenDeath', { gain, level: G.level, gen: G.gen });
}

function dawn(G) { G.foes = null; G.phase = 'day'; G.t = DAY; G.warned = false; G.skipNow = false; }

/** Ingresos de recolección sin escena (para el simulador y el «Toque nutritivo»). */
// el festín (×50) sustituye a la comida dorada (×5) cuando sale; la suerte (×2) se suma aparte
export function forageRate(G, D) { return workForce(G, D) * D.carry * (1 + D.luck) * ((1 - D.feast) * (1 + 4 * D.goldFood) + 50 * D.feast) / BAL.trip * (D.speed / 2.6); }

/**
 * Avanza la partida dt segundos de juego. realDt: segundos reales que representan (con la partida
 * acelerada son menos); la racha se mide con ellos para que a ×3 no haya que tocar el triple de rápido.
 */
export function tick(G, dt, realDt = dt) {
  const D = calc(G);
  if (G.phase === 'dead') return D;
  G.stats.time += dt; G.total += dt; G.clock = (G.clock || 0) + realDt;
  comboCheck(G, D);
  G.rate = Math.max(0, G.rate - G.rate * dt / 20);
  G.lay += D.reserve * dt;
  // la jalea que genera la reina también la hace crecer
  if (D.qJelly > 0) { const j = D.qJelly * dt; G.jelly += j; G.eaten += j; G.rate += j / 20; growQueen(G); }
  if (D.farm > 0) G.jelly += D.farm * nightPrize(G, D) / 60 * dt; // granjas: jalea sola, también de noche
  // mayordomo (interruptor del Árbol): compra una mejora cada 0,45 s si hay jalea o biomasa (no en debug: recursos ∞)
  if (D.autoBuy > 0 && !debug.free) {
    G._abT = (G._abT || 0) - dt;
    if (G._abT <= 0) { autoBuy(G, 1); G._abT = 0.45; }
  }
  // mano fantasma: acumula toques y los aplica de golpe (máx. 30 por fotograma; el resto se queda para el siguiente)
  if (D.ghost > 0) {
    G.ghostT = (G.ghostT || 0) + dt * D.ghost;
    const n = Math.min(30, Math.floor(G.ghostT));
    if (n >= 1) {
      G.ghostT -= n;
      const r = ghostBatch(G, D, n);
      if (r) emit('ghost', r);
    }
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
      G.foes = { count: d.count, cur: d.hpEach, boss: d.boss ? d.boss.hp : 0, arrive: 5, lost: 0, raid: 0, stompT: BAL.stompFirst, stomps: 0, wiped: false };
      G.guard = D.hp;
      emit('night', { def: d });
    }
  } else {
    tickNight(G, D, dt);
    if (G.phase === 'night' && G.t <= 0) { // aguantaron sin ganar: se retiran, sin premio
      G.best = Math.max(G.best, G.level);
      emit('nightLost', { lost: G.foes.lost });
      if (G.level !== FINAL_NIGHT || G.won) passNight(G); // a los humanos hay que vencerlos: vuelven cada noche
      else dawn(G);
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
 * Caché de lo que solo cambia al comprar: el estado de cada nodo, lo que encarece el siguiente y «Todo para la
 * reina». Se rehace si cambia la partida, sus árboles o el número de compras (treeRev sube con cada compra o reinicio).
 * Sin ella, el panel recorría el árbol entero por cada uno de sus 400 nodos varias veces por segundo.
 */
let treeRev = 0;
const count = o => { let n = 0; for (const k in o) n++; return n; };
const tc = { G: null, skills: null, perm: null, key: '', st: {}, cost: null, store: undefined };
function treeCache(G) {
  const key = treeRev + ':' + count(G.skills) + ':' + count(G.perm);
  if (tc.G !== G || tc.skills !== G.skills || tc.perm !== G.perm || tc.key !== key)
    Object.assign(tc, { G, skills: G.skills, perm: G.perm, key, st: {}, cost: null, store: undefined });
  return tc;
}

/**
 * «Todo para la reina» (linaje): ¿queda algo que comprar con jalea en el árbol de la colonia?
 * Solo cuenta lo que está a tu alcance (conectado y con sus requisitos); los rombos no usan jalea.
 */
function storeClosed(G, P = treeFx(PERKS, G.perm)) {
  if (!P.noStore) return false;
  const c = treeCache(G);
  if (c.store === undefined) {
    const st = states(G, 'skills');
    c.store = !Object.keys(SKILLS).some(id => st[id] === 'open' && typeof SKILLS[id].cost !== 'object');
  }
  return c.store;
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
  const cc = treeCache(G), ctx = cc.cost || (cc.cost = { k: ownedCount(G), disc: treeFx(PERKS, G.perm).discount || 0 }), k = ctx.k, disc = ctx.disc;
  if (typeof c === 'object') return { cur: 'bio', n: Math.max(1, Math.round(c.bio * (BAL.bioK ?? 1) * Math.pow(BAL.bioOwnG, k.bio))) };
  const knee = (BAL.skillKnee ?? 12) - 1, over = Math.max(0, c - 1 - knee);
  const exp = Math.min(c - 1, knee) + over * (BAL.skillTop ?? 1);
  return { cur: 'jelly', n: Math.round(BAL.skill0 * Math.pow(BAL.skillG, exp) * Math.pow(BAL.skillOwnG, Math.max(0, k.jelly - BAL.skillFree)) * (1 - disc)) };
}

/** Estado de cada nodo ('owned' | 'open' | 'seen' | 'fog' | 'hidden'). Solo lectura: va en caché. */
export function states(G, tree) {
  const c = treeCache(G);
  return c.st[tree] || (c.st[tree] = tree === 'perm' ? treeStates(PERKS, G.perm) : treeStates(SKILLS, G.skills, G.perm));
}

/** Debug: compra de golpe todo el árbol de la colonia o todo el linaje (sin gastar). */
export function debugMaxTree(G, tree) {
  const nodes = tree === 'perm' ? PERKS : SKILLS;
  const bag = tree === 'perm' ? G.perm : G.skills;
  for (const id in nodes) if (id !== 'root') bag[id] = true;
  treeRev++;
  emit('skill', { id: 'debugMax', tree });
  return true;
}

export function canBuy(G, tree, id) {
  const st = states(G, tree)[id], c = nodeCost(G, tree, id);
  if (debug.free) return st === 'open';
  return st === 'open' && G[c.cur] >= c.n;
}

export function buyNode(G, tree, id) {
  if (!canBuy(G, tree, id)) return false;
  const c = nodeCost(G, tree, id);
  if (!debug.free) G[c.cur] -= c.n;
  if (tree === 'perm') G.perm[id] = true;
  else { G.skills[id] = true; if (!debug.free) G.spent[c.cur] = (G.spent[c.cur] || 0) + c.n; }
  treeRev++;
  emit('skill', { id, tree });
  return true;
}

/** Devuelve todo lo gastado en el árbol de la colonia y lo vacía. force: sin pedir «Borrón y cuenta nueva». */
export function resetSkills(G, force) {
  if (!force && !debug.free && !treeFx(PERKS, G.perm).resetTree) return false;
  if (!Object.keys(G.skills).length) return false;
  G.jelly += G.spent.jelly || 0; G.bio += G.spent.bio || 0;
  G.skills = {}; G.spent = { jelly: 0, bio: 0 };
  G.butler = false; // si no, el mayordomo lo recompraría todo al momento
  treeRev++;
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

/** Cuántos nodos se pueden comprar ya (solo mira los abiertos). max: deja de contar al llegar ahí. */
export function buyable(G, tree, max = Infinity) {
  const st = states(G, tree);
  let n = 0;
  for (const id in st) {
    if (st[id] !== 'open') continue;
    const c = nodeCost(G, tree, id);
    if ((debug.free || G[c.cur] >= c.n) && ++n >= max) break;
  }
  return n;
}
export const anyBuyable = (G, tree) => buyable(G, tree, 1) > 0;

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
  G.phase = 'dead'; G.leaving = true; G.foes = null; G.comboLive = false;
  emit('abandon', { gain: l.gain });
  return true;
}

/** Funda una colonia nueva. Tras la muerte de la reina es obligatorio; en vida, tras superar la noche 3. */
export function prestige(G) {
  const dead = G.phase === 'dead', l = legacy(G);
  if (!dead && !l.ready) return null;
  const gain = dead ? 0 : l.gain; // si murió, el ADN ya se cobró en queenDies
  return newGame({ evo: G.evo || 0, adnTotal: (G.adnTotal || 0) + gain, adn: G.adn + gain, perm: G.perm, gen: G.gen + 1, mute: G.mute, audio: G.audio, obj: G.obj, best: Math.max(G.best, G.level - 1), won: G.won, total: G.total,
    inherit: G.jelly + (G.spent.jelly || 0), autoBuy: G.autoBuy, butler: G.butler, speed: G.speed, eggCut: G.eggCut }); // Herencia: parte de la jalea reunida
}

/**
 * Partida guardada con los árboles de antes (sin treeV): se devuelve todo para repartirlo de nuevo.
 * Árbol: la jalea y la biomasa gastadas. Linaje: el ADN ganado, menos lo que costaron las evoluciones.
 */
export function migrateTrees(G) {
  if (G.treeV === TREE_V) return false;
  resetSkills(G, true);
  let evoSpent = 0;
  for (let i = 1; i <= (G.evo || 0); i++) evoSpent += evoCost(i);
  G.adn = Math.max(G.adn || 0, (G.adnTotal || 0) - evoSpent);
  G.perm = {}; G.treeV = TREE_V; G.refundNote = true; G.butler = false;
  return true;
}
