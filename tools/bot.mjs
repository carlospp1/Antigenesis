// Jugador automático para el simulador rápido (sin gráficos): juega una partida completa con las reglas
// reales (src/game/rules.js) y el mismo cerebro que el bot del navegador (src/game/brain.js).
// Lo usan tools/sim.mjs y tools/sim-worker.mjs.
//
// Un perfil describe CÓMO juega una persona:
//   cps      'curva' (2–3 toques/s bajando con el progreso, como una persona media; ver cpsFor)
//            o [al empezar cada colonia, después]
//   foe      fracción de los toques nocturnos que van a los enemigos
//   buyEvery cada cuántos segundos mira el árbol (atención)
//   smart    true: compra lo que más mejora la colonia por lo que cuesta · false: lo más barato
//   auto     usa la autocompra del juego en vez de mirar el árbol
//   found    'smart': funda antes de una derrota segura · 'death': espera a que muera la reina
//   session  { on, off }: juega `on` segundos y se va `off` (progreso sin conexión del juego)
import * as R from '../src/game/rules.js';
import { FINAL_NIGHT } from '../src/game/data.js';
import { on } from '../src/core/events.js';
import { cpsFor, pickSmart, pickCheapest, shouldFound, saveForEvo, warWeight } from '../src/game/brain.js';

export const PROFILES = {
  promedio: { desc: 'Persona media del tirón: 2–3 toques/s que van bajando, compra con cabeza (igual que el bot del navegador)', cps: 'curva', foe: 0.4, buyEvery: 3, smart: true, found: 'smart', session: null },
  activo: { desc: 'Juega del tirón, toca mucho y piensa cada compra', cps: [3, 1.2], foe: 0.6, buyEvery: 2, smart: true, found: 'smart', session: null },
  normal: { desc: 'Sesiones de 30 min cada 4 h, compra con cabeza', cps: 'curva', foe: 0.3, buyEvery: 4, smart: true, found: 'smart', session: { on: 1800, off: 4 * 3600 } },
  casual: { desc: 'Entra 15 min 3 veces al día, toca poco y compra lo más barato', cps: [1.2, 0.2], foe: 0.1, buyEvery: 15, smart: false, found: 'death', session: { on: 900, off: 7 * 3600 } },
  idle: { desc: 'Casi no toca, autocompra puesta, vuelve 5 min cada 2 h', cps: [0.5, 0.05], foe: 0, buyEvery: 1, auto: true, smart: false, found: 'death', session: { on: 300, off: 2 * 3600 } }
};

export const MILESTONES = [4, 8, 12, 16, 20, 24, 25];

/** Generador de números aleatorios con semilla: la misma semilla da la misma partida. */
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- métricas (escuchan los eventos de rules.js) ---------- */
let S = null;
on('skill', () => { if (S) S.lastBuy = S.active; });
on('evolve', d => { if (S) { S.lastBuy = S.active; S.evos.push({ evo: d.evo, h: +(S.active / 3600).toFixed(2) }); } });
on('nightWin', () => { if (S) S.nightsWon++; });
on('nightLost', () => { if (S) S.nightsLost++; });
on('night', d => {
  if (!S || !S.trace || !S.G) return;
  const G = S.G, D = R.calc(G), fc = R.forecast(G, D);
  S.trace.push({ gen: G.gen, night: d.def.n, min: +(S.colT / 60).toFixed(1), ants: G.ants, dmg: +D.dmg.toFixed(1), hp: +D.hp.toFixed(0),
    foeHp: Math.round(d.def.totalHp), foeDps: +d.def.totalDps.toFixed(1), jelly: Math.round(G.jelly), bio: G.bio, skills: Object.keys(G.skills).length, win: fc.win });
});

function buyLoop(G, tree, P, cps) {
  for (let n = 0; n < 40; n++) {
    let id;
    if (P.smart) {
      const D = R.calc(G), pick = pickSmart(G, tree, { cps, warW: tree === 'perm' ? 1 : warWeight(G), income: tree === 'perm' ? 0 : R.forageRate(G, D) / 2 });
      id = pick && pick.id;
    } else id = pickCheapest(G, tree);
    if (!id || !R.buyNode(G, tree, id)) return;
  }
}

/** Juega desde cero hasta ganar (o hasta el tope). opts: { dt, capH, capDays, trace, cps, late }. */
export function playGame(profileName, seed, opts = {}) {
  const P0 = PROFILES[profileName];
  if (!P0) throw new Error('Perfil desconocido: ' + profileName + ' (hay: ' + Object.keys(PROFILES).join(', ') + ')');
  const P = { ...P0 };
  if (opts.cps != null || opts.late != null) P.cps = [opts.cps ?? (Array.isArray(P0.cps) ? P0.cps[0] : 2.5), opts.late ?? (Array.isArray(P0.cps) ? P0.cps[1] : 0.9)];
  const dt = opts.dt || 0.5, capA = (opts.capH || 12) * 3600, capC = (opts.capDays || 45) * 86400;
  Math.random = mulberry32(seed * 9973 + 17);

  let G = R.newGame();
  if (P.auto) G.autoBuy = true;
  S = { G, active: 0, cal: 0, colT: 0, lastBuy: 0, maxGap: 0, colonies: [], milestones: {}, evos: [], nightsWon: 0, nightsLost: 0, trace: opts.trace ? [] : null, clicks: 0 };
  let sessT = 0, clickAcc = 0, buyT = 0, cps = 2.5, cpsT = 0;
  const closeColony = cause => S.colonies.push({ gen: G.gen, night: G.level, min: +(S.colT / 60).toFixed(1), cause, adn: G.pendingAdn || 0,
    skills: Object.keys(G.skills).length, perms: Object.keys(G.perm).length, evo: G.evo || 0, ants: G.ants });

  while (!G.won && S.active < capA && S.cal < capC) {
    if (P.session && sessT >= P.session.on) { // la persona se va: el juego aplica su progreso sin conexión
      sessT = 0; S.cal += P.session.off;
      if (G.phase !== 'dead') R.away(G, P.session.off);
      S.lastBuy = S.active;
      continue;
    }
    if (G.phase === 'dead') {
      closeColony(G.leaving ? 'fundó' : 'murió');
      while (R.canEvolve(G)) R.evolve(G);
      if (!(P.smart && saveForEvo(G))) buyLoop(G, 'perm', P, cps);
      G = R.prestige(G); S.G = G; S.colT = 0;
      continue;
    }

    const D = R.calc(G);
    if (G.phase === 'day') R.feed(G, R.forageRate(G, D) * dt);

    if ((cpsT -= dt) <= 0) { cpsT = 5; cps = P.cps === 'curva' ? cpsFor(G, S.colT) : (S.colT < 300 ? P.cps[0] : P.cps[1]); }
    clickAcc += cps * dt;
    while (clickAcc >= 1) {
      clickAcc--; S.clicks++;
      if (G.foes && G.foes.arrive <= 0 && Math.random() < P.foe) { R.hit(G, R.calc(G)); continue; }
      const target = G.larvae[0] || G.eggs[0];
      if (target && Math.random() < 0.5) R.click(G, G.larvae[0] ? 'larva' : 'egg', target.id);
      else R.click(G, 'queen');
    }

    R.tick(G, dt);
    S.active += dt; S.cal += dt; sessT += dt; S.colT += dt; buyT += dt;

    if (buyT >= P.buyEvery && G.phase !== 'dead') {
      buyT = 0;
      if (P.auto) R.autoBuy(G, 5); else buyLoop(G, 'skills', P, cps);
      if (P.found === 'smart' && shouldFound(G)) R.abandon(G);
    }

    for (const m of MILESTONES) if (S.milestones[m] == null && G.best >= m) S.milestones[m] = S.active;
    if (S.active - S.lastBuy > S.maxGap) S.maxGap = S.active - S.lastBuy;
  }
  if (G.phase !== 'dead') closeColony(G.won ? 'ganó' : 'tope');
  if (G.won && S.milestones[FINAL_NIGHT] == null) S.milestones[FINAL_NIGHT] = S.active;

  const out = {
    profile: profileName, seed, won: G.won, activeH: S.active / 3600, days: S.cal / 86400, clicks: S.clicks,
    colonies: S.colonies, firstNight: S.colonies[0]?.night ?? G.level,
    milestones: Object.fromEntries(Object.entries(S.milestones).map(([k, v]) => [k, v / 3600])),
    maxGapMin: S.maxGap / 60, evos: S.evos, nightsWon: S.nightsWon, nightsLost: S.nightsLost,
    deaths: S.colonies.filter(c => c.cause === 'murió').length, founds: S.colonies.filter(c => c.cause === 'fundó').length,
    trace: S.trace
  };
  S = null;
  return out;
}
