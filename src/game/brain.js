// Cerebro del jugador automático: decide QUÉ hacer, sin hacerlo.
// Lo usan el bot del navegador (src/ui/bot.js, juega en tiempo real) y el simulador (tools/bot.mjs).
// No toca el DOM ni la escena.
import * as R from './rules.js';
import { BAL, FINAL_NIGHT } from './data.js';
import { SKILLS, PERKS } from './trees.js';

/**
 * Toques por segundo de una persona media: 2–3 al empezar el juego, bajando según avanza
 * (cansancio y porque las mejoras hacen los toques menos necesarios). Al empezar cada colonia
 * se toca algo más (hay que sacar las primeras hormigas a mano).
 *   colT: segundos de juego desde que empezó esta colonia.
 */
export function cpsFor(G, colT, rnd = Math.random) {
  const p = Math.min(1, (G.best || 0) / FINAL_NIGHT);   // 0 al principio, 1 al llegar a los humanos
  const base = 2.5 * (1 - 0.65 * p);                     // 2,5 → 0,9
  const burst = colT < 120 ? 0.4 : 0;                    // arranque de colonia
  return Math.max(0.3, base + burst + (rnd() - 0.5));    // ±0,5 de variación: 2–3 al principio
}

/**
 * Toques como los de una persona: una ráfaga corta y rápida sobre una misma cosa (3–14 toques), una pausa
 * (mira la pantalla, piensa, cambia de objetivo) y otra ráfaga, quizá sobre otra cosa. Nadie da miles de
 * toques seguidos. La pausa se calcula para que la media siga siendo la de `cps`, así que el ritmo total
 * no cambia; lo que cambia es que las rachas (combo) salen como saldrían jugando de verdad.
 *   const tp = makeTapper();  …  const n = tp.step(dt, cps);  if (tp.fresh) elegir objetivo;  dar n toques
 */
export function makeTapper(rnd = Math.random) {
  const tp = { left: 0, rest: rnd() * 0.5, acc: 0, len: 0, rate: 5, fresh: false };
  // steady: perfiles de ritmo fijo (5, 7, 9 toques/s): ráfagas largas seguidas, sin pausas, a `cps` de media
  tp.step = (dt, cps, steady = false) => {
    tp.fresh = false;
    if (tp.rest > 0) { tp.rest -= dt; if (tp.rest > 0) return 0; dt = -tp.rest; tp.rest = 0; }
    if (tp.left <= 0) { // ráfaga nueva (quien la usa elige el objetivo cuando ve fresh)
      tp.len = tp.left = steady ? 10 + Math.floor(rnd() * 20) : 3 + Math.floor(rnd() * 12);
      tp.rate = steady ? cps * (0.95 + rnd() * 0.1) : Math.min(7, Math.max(3, cps * 2.4)) * (0.85 + rnd() * 0.3); // toques/s dentro de la ráfaga
      if (!steady) tp.acc = 0;
      tp.fresh = true;
    }
    tp.acc += tp.rate * dt;
    const n = Math.min(tp.left, Math.floor(tp.acc));
    tp.acc -= n; tp.left -= n;
    if (tp.left <= 0 && !steady) {
      // pausa: lo que falta del ciclo para que la media sea cps (con algo de variación, nunca menos de 0,3 s)
      const cycle = tp.len / Math.max(0.05, cps), busy = tp.len / tp.rate;
      tp.rest = Math.max(0.3, (cycle - busy) * (0.6 + rnd() * 0.8));
    }
    return n;
  };
  return tp;
}

/**
 * Lo bien que va la colonia (escala logarítmica): ingresos, ritmo de cría y fuerza en combate.
 * warW sube cuando la previsión dice que esta noche se pierde.
 */
function utility(G, D, cps, warW, streak = 4) {
  const g = G.ants >= 3 ? G : { ...G, ants: 3 };
  // racha media: unos 4 toques en las ráfagas de una persona (makeTapper); con ritmo fijo, la racha no se corta
  // y llega a las marcas (más %, y con «Toques en cadena», más clics por toque)
  let combo = 1, clicks = D.tapN || 1;
  if (D.combo) { const n = Math.max(2, streak); combo = R.comboMult({ comboLive: true, combo: n }, D); clicks = R.comboInfo(n, D).clicks; }
  const one = BAL.tapFood * D.tapQ * (1 + D.tapCrit * (D.critX - 1)) + D.tapRate * D.income; // un toque a la reina
  const tap = cps * one * combo * clicks;
  const ghost = D.ghost * one * (D.ghostTaps ? clicks : 1) * (D.ghostCombo && D.combo ? combo : 1);
  // las granjas dan jalea sola (fracción del premio de una noche por minuto)
  const inc = R.forageRate(g, D) + D.reserve + D.qJelly + tap + ghost + D.farm * R.nightPrize(G, D) / 60;
  const war = D.dmg * D.hp / (1 - D.dodge);
  return Math.log(inc + 0.1) + 0.5 * Math.log(D.brood) - 0.7 * Math.log(D.eggCost) + warW * Math.log(war) + 0.3 * Math.log(D.prize * D.bioKill);
}

const withNode = (G, tree, id) => { const key = tree === 'perm' ? 'perm' : 'skills'; return { ...G, [key]: { ...G[key], [id]: true } }; };

function nodeValue(G, tree, id, base, cps, warW, streak) {
  const nodes = tree === 'perm' ? PERKS : SKILLS;
  const G2 = withNode(G, tree, id);
  const gain = utility(G2, R.calc(G2), cps, warW, streak) - base;
  // abrir camino también vale algo (nodos sin efecto medible siguen siendo útiles)
  const st = R.states(G2, tree), opens = [...nodes[id].adj].filter(a => st[a] === 'open').length;
  return Math.max(0, gain) + 0.02 + 0.005 * opens;
}

function openNodes(G, tree) {
  const nodes = tree === 'perm' ? PERKS : SKILLS, st = R.states(G, tree);
  return Object.keys(nodes).filter(id => st[id] === 'open').map(id => ({ id, c: R.nodeCost(G, tree, id) }));
}

/** Lo más barato que se pueda pagar (jugador sin estrategia). Devuelve un id o null. */
export function pickCheapest(G, tree) {
  const o = openNodes(G, tree).filter(o => G[o.c.cur] >= o.c.n)
    .sort((a, b) => (a.c.cur === 'jelly' ? a.c.n : a.c.n * 30) - (b.c.cur === 'jelly' ? b.c.n : b.c.n * 30))[0];
  return o ? o.id : null;
}

/**
 * Compra con cabeza: el nodo que más mejora la colonia por lo que cuesta. Si lo mejor aún no se puede
 * pagar pero llegará en menos de `patience` segundos, devuelve { wait } para ahorrar.
 *   income: jalea por segundo que entra en la despensa (0 = no ahorrar nunca)
 * Devuelve { id, why } , { wait, why } o null.
 */
export function pickSmart(G, tree, { cps = 1, warW = 1, income = 0, patience = 60, streak = 4, weight = null, why = null } = {}) {
  const D = R.calc(G), base = utility(G, D, cps, warW, streak), opts = openNodes(G, tree);
  if (!opts.length) return null;
  let best = null, bestAff = null;
  for (const o of opts) {
    const w = weight ? weight(o.id) : 1;
    if (w <= 0) { o.v = -1; continue; } // peso 0: no se compra nunca
    o.v = nodeValue(G, tree, o.id, base, cps, warW, streak) / Math.max(1, o.c.n) * w;
    if (o.c.cur === 'bio') continue;
    if (G[o.c.cur] >= o.c.n && (!bestAff || o.v > bestAff.v)) bestAff = o;
    if (!best || o.v > best.v) best = o;
  }
  // la biomasa solo sirve para los rombos: se gasta en cuanto se puede
  const bio = opts.filter(o => o.c.cur === 'bio' && o.v >= 0 && G.bio >= o.c.n).sort((a, b) => b.v - a.v)[0];
  if (bio) return { id: bio.id, why: 'rombo de biomasa' };
  if (best && best.c.cur === 'jelly' && G.jelly < best.c.n && income > 0 && (best.c.n - G.jelly) / income < patience && best.v > (bestAff?.v || 0) * 1.5)
    return { wait: best.id, why: `ahorra para ${best.id} (${Math.round(best.c.n)})` };
  const id = bestAff && bestAff.id;
  return id ? { id, why: warW > 1 && nodesOf(tree)[id].cat === 'war' ? 'la noche pinta mal: prioriza combate' : why ? why(id) : 'mejor valor por coste' } : null;
}

/* ================= el tiempo que una persona no está tocando ================= */

/**
 * Segundos de juego que el bot pasa sin tocar, como una persona:
 *   tree    entra en el Árbol, espera medio segundo y compra (la racha se pierde: has dejado de tocar)
 *   perBuy  cada compra más en la misma visita
 *   move    mover el dedo de la reina a la cría (o al revés)
 *   enemy   ir hasta los enemigos o volver de ellos (al otro lado de la pantalla)
 */
export const BOT_TIME = { tree: 0.5, perBuy: 0.2, move: 0.15, enemy: 0.35 };
/** Lo que se tarda en cambiar de objetivo ('queen', 'brood', 'enemy'). */
export const travelTime = (from, to) => (from === to ? 0 : from === 'enemy' || to === 'enemy' ? BOT_TIME.enemy : BOT_TIME.move);

/* ================= perfiles del bot ================= */

/**
 * Perfiles de TOQUES (cuánto toca): 'curva' = como una persona (cpsFor, a ráfagas y con pausas) o un ritmo fijo de
 * toques por segundo sin pausas. buyEvery: segundos de juego entre vistazos al árbol · foe: parte de los toques
 * nocturnos que van a los enemigos.
 */
export const CLICK_PROFILES = {
  humano: { name: 'Humano', desc: 'Persona media: 2–3 toques/s a ráfagas, bajando según avanza', cps: 'curva', buyEvery: 3, foe: 0.4 },
  casual: { name: 'Casual', desc: 'La mitad de toques que una persona media y mira poco el árbol', cps: 'curva', k: 0.5, buyEvery: 12, foe: 0.15 },
  c5: { name: '5/s', desc: '5 toques por segundo sin parar la primera hora; luego se cansa y cada hora toca menos', cps: 5, buyEvery: 2.5, foe: 0.5 },
  c7: { name: '7/s', desc: '7 toques por segundo sin parar la primera hora; luego se cansa y cada hora toca menos', cps: 7, buyEvery: 2, foe: 0.55 },
  c9: { name: '9/s', desc: 'Avanzado: 9 toques por segundo sin parar la primera hora; luego se cansa y cada hora toca menos', cps: 9, buyEvery: 1.5, foe: 0.6 }
};
/**
 * Cansancio de los perfiles de ritmo fijo: la primera hora de partida (tiempo de juego total, G.total) tocan lo
 * marcado; cada hora más, un 20% menos que la anterior, sin bajar del 45%. 9/s: 9 → 7,2 → 5,8 → 4,6 → 4,1…
 */
export const fatigue = G => Math.max(0.45, Math.pow(0.8, Math.floor((G.total || 0) / 3600)));
/** Toques por segundo de un perfil de toques ahora mismo (colT: segundos desde que empezó la colonia). */
export const profileCps = (cp, G, colT, rnd) => (cp.cps === 'curva' ? cpsFor(G, colT, rnd) * (cp.k || 1) : cp.cps * fatigue(G));
/**
 * Racha que suele llevar: unos 4 toques a ráfagas; con ritmo fijo, la que junta entre dos visitas al Árbol
 * (cada visita la corta), unos 20 s seguidos.
 */
export const profileStreak = (cp, cps) => (cp.cps === 'curva' ? 4 : Math.round(cps * 20));

/**
 * Perfiles de ESTRATEGIA (qué compra, en la colonia y en el linaje):
 *   focus: ramas del árbol (cat de cada nodo) y efectos que son «suyos»: compra lo suyo primero (o ahorra para ello) y,
 *          si le sobra, lo muy barato del resto (CHEAP_K), también en el linaje
 *   balance: reparte las compras entre las ramas · smart: ver pickBrainy
 * Todos refuerzan la guerra si la previsión dice que esta noche se pierde (si no, la colonia muere y no aprende nada).
 */
export const ROOM_PROFILES = {
  toques: { name: 'Toques', desc: 'Todo a los toques: caricias, racha, suerte, festín y manos fantasma', focus: { cats: ['tap'], keys: ['feast'] } },
  hormigas: { name: 'Hormigas', desc: 'Mejora a las obreras: comida por viaje, velocidad, doradas y hormigas al fundar', focus: { cats: ['food', 'found'], keys: ['shiny', 'shinyElite', 'startAnts'], not: ['qJelly', 'qJellyP', 'feast'] } },
  reina: { name: 'Reina', desc: 'Mejora a la reina: huevos baratos, cría rápida, reservas, gemelas y jalea real', focus: { cats: ['brood'], keys: ['reserve', 'qJelly', 'qJellyP', 'startEggs'], not: ['shiny', 'shinyElite'] } },
  dano: { name: 'Daño', desc: 'Guerra: mandíbulas, caparazón, esquiva y botín', focus: { cats: ['war'], keys: ['prize', 'bioKill', 'startBio'] } },
  equilibrado: { name: 'Equilibrado', desc: 'Reparte las compras entre todas las ramas por igual', balance: true },
  inteligente: { name: 'Inteligente', desc: 'El orden que mejor rinde: apertura fija en el linaje y, después, lo que más mejora la colonia por lo que cuesta, con la guerra por delante', smart: true }
};
// «barato» para un perfil de rama: cuesta como mucho este tanto de lo siguiente que quiere de su rama (misma moneda);
// lo de 1 ADN siempre lo es
const CHEAP_K = 0.15;
// mejoras del linaje que al bot no le sirven: no reinicia el árbol, no usa el mayordomo ni salta el día
const BOT_USELESS = new Set(['prt', 'pab1', 'psk']);

const nodesOf = tree => (tree === 'perm' ? PERKS : SKILLS);
function inFocus(f, tree, id) {
  const n = nodesOf(tree)[id], ks = Object.keys(n.fx || {});
  if (f.not && ks.some(k => f.not.includes(k))) return false;
  return f.cats.includes(n.cat) || ks.some(k => f.keys.includes(k));
}

/**
 * Compra según el perfil de estrategia. o: { cps, streak, income, patience }.
 * Devuelve { id, why }, { wait, why } o null (como pickSmart).
 */
export function pickRoom(G, tree, room, o = {}) {
  const P = ROOM_PROFILES[room] || ROOM_PROFILES.inteligente;
  if (P.smart) return pickBrainy(G, tree, o);
  const warW = tree === 'perm' ? 1 : warWeight(G), useless = id => (tree === 'perm' && BOT_USELESS.has(id) ? 0.05 : 1);
  if (P.focus) {
    // si esta noche se pierde, la guerra también cuenta como suya (sobrevivir manda)
    const f = P.focus, nodes = nodesOf(tree), mine = id => useless(id) >= 1 && (inFocus(f, tree, id) || (warW > 1 && nodes[id].cat === 'war'));
    // 1) su rama: compra lo mejor que pueda pagar, o ahorra para ello
    const main = pickSmart(G, tree, { ...o, warW, patience: Math.max(o.patience || 60, 120), weight: id => (mine(id) ? 1 : 0), why: () => 'rama ' + P.name.toLowerCase() });
    if (main && main.id) return main;
    // 2) si le sobra: lo muy barato del resto (como mucho CHEAP_K de lo siguiente de su rama en esa moneda).
    //    En una moneda en la que su rama no tiene nada abierto (biomasa sin rombos suyos, o la rama ya completa), todo sobra.
    const next = {};
    for (const x of openNodes(G, tree)) if (mine(x.id)) next[x.c.cur] = Math.min(next[x.c.cur] ?? Infinity, x.c.n);
    const cheap = pickSmart(G, tree, {
      ...o, warW, income: 0,
      weight: id => { if (mine(id) || useless(id) < 1) return 0; const c = R.nodeCost(G, tree, id); return next[c.cur] == null || c.n <= Math.max(1, CHEAP_K * next[c.cur]) ? 1 : 0; },
      why: id => (next[R.nodeCost(G, tree, id).cur] == null ? 'nada suyo que comprar: gasta en otra rama' : 'le sobra: barata de otra rama')
    });
    return cheap && cheap.id ? cheap : main; // si no, sigue ahorrando para lo suyo
  }
  // equilibrado: cada rama pesa más cuanto menos se ha comprado en ella respecto a la media
  const nodes = nodesOf(tree), owned = G[tree === 'perm' ? 'perm' : 'skills'], cnt = {};
  for (const id in nodes) if (id !== 'root') cnt[nodes[id].cat] = cnt[nodes[id].cat] || 0;
  for (const id in owned) if (owned[id] && nodes[id]) cnt[nodes[id].cat]++;
  const avg = Object.values(cnt).reduce((a, b) => a + b, 0) / Object.keys(cnt).length;
  return pickSmart(G, tree, { ...o, warW, weight: id => useless(id) * Math.min(5, Math.max(0.2, Math.pow(1.7, avg - cnt[nodes[id].cat]))), why: id => 'reparte: rama ' + nodes[id].cat });
}

// Apertura del linaje: lo que más rinde por lo poco que cuesta, en este orden (si algo no se puede pagar, sigue
// con lo siguiente). 1 ADN: huevos −10%, cría +20%, comida +15%, daño y vida; luego la reserva de la reina,
// hormigas al fundar, la racha (todo toque rinde más), el 25% de descuento en el árbol y la primera mano.
const PERM_OPENING = ['pe1', 'pg1', 'pf1', 'prs', 'ps1', 'pd1', 'ph1', 'pj1', 'ptp', 'pds', 'pgh1', 'pdx1', 'pcv', 'pf2', 'pfe1', 'ptw', 'pd2', 'ph2', 'pcb1', 'pbio'];
// La guerra pesa ×3 al elegir: lo que frena la partida son las noches (cada noche más lejos da más ADN), y el
// cálculo de valor por coste la infravalora. Probado con tools/sim.mjs (persona media, 6 partidas): así gana tan
// rápido como lo mejor que se probó; la biomasa por un orden fijo y mirar un paso por delante no mejoraban nada.
const SMART_WAR_K = 3;

/**
 * Perfil inteligente: en el linaje, primero la apertura; después (y en la colonia) lo que más mejora la colonia
 * por lo que cuesta, con la guerra ×SMART_WAR_K y sin las mejoras del linaje que al bot no le sirven.
 */
function pickBrainy(G, tree, o = {}) {
  if (tree === 'perm') {
    const st = R.states(G, 'perm');
    for (const id of PERM_OPENING) if (st[id] === 'open' && G.adn >= R.nodeCost(G, 'perm', id).n) return { id, why: 'apertura del linaje' };
  }
  const nodes = nodesOf(tree);
  return pickSmart(G, tree, {
    patience: 90, ...o, warW: tree === 'perm' ? 1 : warWeight(G),
    weight: id => (tree === 'perm' && BOT_USELESS.has(id) ? 0 : nodes[id].cat === 'war' ? SMART_WAR_K : 1),
    why: id => (nodes[id].cat === 'war' ? 'guerra: las noches marcan el ritmo' : 'lo que más rinde por lo que cuesta')
  });
}

/**
 * ¿Fundar ya? Justo antes de una noche que se va a perder seguro (y sin vida extra que salve a la reina).
 * Ante los humanos sin la Hormiga titán, siempre: son inmunes y hace falta ADN para evolucionar.
 */
export function shouldFound(G) {
  if (G.phase !== 'day' || G.t >= 6 || !R.legacy(G).ready) return false;
  const D = R.calc(G), fc = R.forecast(G, D);
  if (fc.immune) return true;
  if (G.level >= FINAL_NIGHT) return false;
  return !fc.win && fc.losses >= G.ants && (G.livesUsed || 0) >= D.lives;
}

/** Tras morir o fundar: ¿ahorrar ADN para la siguiente evolución en vez de gastarlo en el linaje? */
export function saveForEvo(G) {
  const next = (G.evo || 0) + 1;
  return R.evoState(G, next) === 'next' && G.adn < R.evoCost(next) && G.adn >= R.evoCost(next) * 0.5;
}

/** Peso del combate al elegir compras: alto si la previsión de esta noche es derrota. */
export function warWeight(G) {
  const fc = R.forecast(G, R.calc(G));
  return fc.win ? 1 : 2.5;
}
