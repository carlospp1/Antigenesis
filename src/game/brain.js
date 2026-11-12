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
 * Lo bien que va la colonia (escala logarítmica): ingresos, ritmo de cría y fuerza en combate.
 * warW sube cuando la previsión dice que esta noche se pierde.
 */
function utility(G, D, cps, warW) {
  const g = G.ants >= 3 ? G : { ...G, ants: 3 };
  const tap = cps * BAL.tapFood * D.tapQ * (1 + D.tapCrit * (D.critX - 1));
  const inc = R.forageRate(g, D) + D.reserve + tap + D.ghost * BAL.tapFood * D.tapQ;
  const war = D.dmg * D.hp / (1 - D.dodge);
  return Math.log(inc + 0.1) + 0.5 * Math.log(D.brood) - 0.7 * Math.log(D.eggCost) + warW * Math.log(war) + 0.3 * Math.log(D.prize * D.bioKill);
}

function nodeValue(G, tree, id, base, cps, warW) {
  const key = tree === 'perm' ? 'perm' : 'skills', nodes = tree === 'perm' ? PERKS : SKILLS;
  const G2 = { ...G, [key]: { ...G[key], [id]: true } };
  const gain = utility(G2, R.calc(G2), cps, warW) - base;
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
export function pickSmart(G, tree, { cps = 1, warW = 1, income = 0, patience = 60 } = {}) {
  const D = R.calc(G), base = utility(G, D, cps, warW), opts = openNodes(G, tree);
  if (!opts.length) return null;
  let best = null, bestAff = null;
  for (const o of opts) {
    o.v = nodeValue(G, tree, o.id, base, cps, warW) / Math.max(1, o.c.n);
    if (o.c.cur === 'bio') continue;
    if (G[o.c.cur] >= o.c.n && (!bestAff || o.v > bestAff.v)) bestAff = o;
    if (!best || o.v > best.v) best = o;
  }
  // la biomasa solo sirve para los rombos: se gasta en cuanto se puede
  const bio = opts.filter(o => o.c.cur === 'bio' && G.bio >= o.c.n).sort((a, b) => b.v - a.v)[0];
  if (bio) return { id: bio.id, why: 'rombo de biomasa' };
  if (best && best.c.cur === 'jelly' && G.jelly < best.c.n && income > 0 && (best.c.n - G.jelly) / income < patience && best.v > (bestAff?.v || 0) * 1.5)
    return { wait: best.id, why: `ahorra para ${best.id} (${Math.round(best.c.n)})` };
  return bestAff ? { id: bestAff.id, why: warW > 1 ? 'la noche pinta mal: prioriza combate' : 'mejor valor por coste' } : null;
}

/** ¿Fundar ya? Justo antes de una noche que se va a perder seguro (y sin vida extra que salve a la reina). */
export function shouldFound(G) {
  if (G.phase !== 'day' || G.t >= 6 || G.level >= FINAL_NIGHT || !R.legacy(G).ready) return false;
  const D = R.calc(G), fc = R.forecast(G, D);
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
