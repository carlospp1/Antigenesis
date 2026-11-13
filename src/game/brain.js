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
  tp.step = (dt, cps) => {
    tp.fresh = false;
    if (tp.rest > 0) { tp.rest -= dt; if (tp.rest > 0) return 0; dt = -tp.rest; tp.rest = 0; }
    if (tp.left <= 0) { // ráfaga nueva (quien la usa elige el objetivo cuando ve fresh)
      tp.len = tp.left = 3 + Math.floor(rnd() * 12);
      tp.rate = Math.min(7, Math.max(3, cps * 2.4)) * (0.85 + rnd() * 0.3); // toques/s dentro de la ráfaga
      tp.acc = 0; tp.fresh = true;
    }
    tp.acc += tp.rate * dt;
    const n = Math.min(tp.left, Math.floor(tp.acc));
    tp.acc -= n; tp.left -= n;
    if (tp.left <= 0) {
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
function utility(G, D, cps, warW) {
  const g = G.ants >= 3 ? G : { ...G, ants: 3 };
  // racha media de una ráfaga de makeTapper (3–14 toques: unos 4 toques de racha de media)
  const combo = D.combo ? 1 + Math.min(4, D.comboCap) * D.comboStep * Math.sqrt(D.comboX) : 1; // sin «Racha» no hay racha
  const tap = cps * BAL.tapFood * D.tapQ * (1 + D.tapCrit * (D.critX - 1)) * combo;
  // las granjas dan jalea sola (fracción del premio de una noche por minuto)
  const inc = R.forageRate(g, D) + D.reserve + tap + D.ghost * BAL.tapFood * D.tapQ + D.farm * R.nightPrize(G, D) / 60;
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
