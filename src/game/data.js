// Datos de diseño: duración del día, etapas de la reina, objetivos y equilibrio.

export const DAY = 60, NIGHT = 42, DUSK = 8;

/**
 * Eras de enemigos: cada especie dura 4 noches y la cuarta trae a su jefe.
 * La noche final llegan los humanos; si los vences, las hormigas conquistan el mundo.
 */
export const ERAS = [
  { from: 1, name: 'Hormigas rivales', one: 'hormiga rival', many: 'hormigas rivales', minion: 'rival', boss: 'rivalQ', bossName: 'la reina rival' },
  { from: 5, name: 'Bachacos', one: 'bachaco', many: 'bachacos', minion: 'bachaco', boss: 'bachacoS', bossName: 'un bachaco soldado' },
  { from: 9, name: 'Termitas', one: 'termita', many: 'termitas', minion: 'termite', boss: 'termiteS', bossName: 'una termita soldado' },
  { from: 13, name: 'Cucarachas', one: 'cucaracha', many: 'cucarachas', minion: 'roach', boss: 'spider', bossName: 'una araña cazadora' },
  { from: 17, name: 'Arañas', one: 'araña', many: 'arañas', minion: 'spiderling', boss: 'beetle', bossName: 'un escarabajo ciervo' },
  { from: 21, name: 'Escarabajos', one: 'escarabajo', many: 'escarabajos', minion: 'beetling', boss: 'mantis', bossName: 'una mantis religiosa' },
  { from: 25, name: 'Humanos', one: 'humano', many: 'humanos', minion: null, boss: 'shoe', bossName: 'los humanos', final: true }
];
export const eraFor = n => ERAS.reduce((e, x) => n >= x.from ? x : e, ERAS[0]);

/**
 * Evoluciones de tus hormigas: una vía lineal, pagada con ADN y permanente.
 * Cada una se desbloquea al vencer al jefe de una era (has visto a ese rival y aprendido de él).
 * fx: multiplicadores de comida, daño, vida y velocidad.
 */
export const EVOS = [
  { name: 'Hormiga común', req: 0, cost: 0, fx: {}, desc: 'La forma con la que empieza todo.' },
  // cada evolución sube comida, daño y vida a la vez (BAL.evoAll, ver calc en rules.js)
  { name: 'Hormiga de fuego', req: 4, cost: 3, fx: {}, desc: 'Aguijón ardiente. Comida, daño y vida ×1,45' },
  { name: 'Hormiga cortadora', req: 8, cost: 8, fx: {}, desc: 'Mandíbulas de tijera. Comida, daño y vida ×1,45' },
  { name: 'Hormiga bala', req: 12, cost: 16, fx: {}, desc: 'La picadura más dolorosa. Comida, daño y vida ×1,45' },
  { name: 'Hormiga legionaria', req: 16, cost: 28, fx: {}, desc: 'Marcha imparable. Comida, daño y vida ×1,45' },
  { name: 'Hormiga bulldog', req: 20, cost: 45, fx: {}, desc: 'Salta y muerde. Comida, daño y vida ×1,45' },
  { name: 'Hormiga titán', req: 24, cost: 70, fx: {}, desc: 'La única que puede herir a los humanos. Comida, daño y vida ×1,45' }
];

/** Noche final: al ganarla las hormigas conquistan el mundo (se puede seguir jugando). */
export const FINAL_NIGHT = 25;
/** La noche final dura más: hace falta tiempo para tumbar a los humanos. */
export const NIGHT_FINAL = 80;

/** Segundos que tardan los enemigos en llegar a la reina si no queda ninguna hormiga. */
export const RAID = 7;

/**
 * Equilibrio. Todo lo que cambia la dificultad está aquí, para ajustarlo con
 * `node tools/sim.mjs` (simula partidas completas a toda velocidad).
 */
export const BAL = {
  trip: 18,          // segundos que tarda una hormiga en ir a por comida y volver (medido en el juego)
  carry: 4,          // comida por viaje al empezar (se reparte entre la reina y la despensa)
  eggBase: 16,       // coste del primer huevo
  eggCurve: 1.2,     // cada hormiga o cría encarece el siguiente huevo
  cutMax: 0.25,      // «Toque menguante»: lo más que los toques rebajan un huevo (con el linaje, hasta 0,5)
  reserve: 0.2,      // comida por segundo que la reina saca de sus reservas
  eggTime: 12, larvaTime: 18,
  dmg: 1, hp: 9,     // de cada hormiga
  tapFood: 1,        // comida que da a mano un toque a la reina (sube con las mejoras de toques)
  tapBrood: 0.12,    // un toque adelanta un 12% un huevo o una larva
  // enemigos de la noche n: cantidad, vida y daño crecen cada noche
  foeCount0: 1, foeCountK: 0.6,
  foeHp0: 30, foeHpG: 1.36,
  foeDps0: 2, foeDpsG: 1.30,
  eraHard: 1.1,                // cada era (4 noches) los enemigos tienen ×eraHard de vida y daño sobre la anterior
  bossHp: 5, bossDps: 3,       // jefe de cada era (cuarta noche), en múltiplos de un enemigo normal
  humanHp: 40, humanDps: 9,     // la noche final
  prize0: 15, prizeG: 1.4,
  skill0: 18, skillG: 2.5,     // niveles 1–12: lo que ya pagaba una colonia (noche 4 ~200, noche 15 ~60 000)
  skillKnee: 12, skillTop: 0.38, // del 13 al 18 el precio afloja: el 18 queda en ~4 millones, lo que junta la noche 24
  skillOwnG: 1.006,            // hay cientos de nodos; un 12% por compra cerraba el árbol a mitad con la jalea aún subiendo
  skillFree: 8,                // las primeras compras no encarecen
  bioOwnG: 1.02,               // la biomasa del registro: ~8 en la noche 4, ~60 en la 12, ~160 al final
  bioK: 1,                     // los rombos ya cuestan eso; solo se les quita el recargo que los cerraba
  perkK: 0.25,                 // el linaje suma ~2100 de ADN y la partida del registro deja unos 350 antes de las evoluciones
  stageFood: 1.25,             // cada etapa de la reina multiplica la comida por viaje
  // ADN al morir o fundar: crece con las noches superadas
  adnK: 1.5, adnP: 1.35,      // noche 4 ~10 ADN, noche 12 ~50, noche 24 ~130: da para el linaje y para la evolución de esa era
  evoCostK: 1.5,                // la evolución de una era cabe en el ADN de esa era, sin vaciar el linaje
  foundAfter: 3,               // superada esta noche ya se puede fundar (y ganar ADN) aunque no caiga ningún jefe
  // racha de toques: cada toque seguido (menos de comboGap s de juego desde el anterior) rinde comboStep más,
  // hasta comboCap toques (×1,5 con estos valores). Vale para la reina, la cría y los enemigos.
  comboGap: 0.8, comboStep: 0.025, comboCap: 20,
  evoAll: 1.45,                // cada evolución: comida, daño y vida ×evoAll (y +5% de velocidad)
  treeK: 0.6, permK: 0.75,     // rebaja de las estadísticas del árbol y del linaje (la evolución ya sube todo)
  blood: 0.015                // «Sangre antigua»: +1,5% de comida, daño y vida por cada ADN ganado en total
};

export const STAGES = [
  { name: 'Reina joven', at: 0 },
  { name: 'Reina fértil', at: 600 },
  { name: 'Gran madre', at: 12000 },
  { name: 'Matriarca', at: 200000 },
  { name: 'Reina primordial', at: 3000000 }
];

// [texto, condición, premio en jalea, progreso 0..1 opcional]
export const OBJ = [
  ['Toca el huevo y la larva para que nazca tu primera hormiga', G => G.stats.born >= 1, 10],
  ['Toca a la reina para que ponga otro huevo', G => G.stats.laid >= 2, 5],
  ['Ten 3 hormigas antes de que caiga la noche', G => G.ants >= 3, 15, G => G.ants / 3],
  ['Sobrevive a la primera noche', G => G.level > 1, 25],
  ['Compra tu primera habilidad en el Árbol', G => Object.keys(G.skills).length >= 1, 30],
  ['Derrota a la reina rival (noche 4)', G => G.level > 4 || G.best >= 4, 80, G => (G.level - 1) / 4],
  ['Compra algo en el Linaje', G => Object.keys(G.perm).length >= 1, 0],
  ['Derrota al bachaco soldado (noche 8)', G => G.level > 8 || G.best >= 8, 400, G => (G.level - 1) / 8],
  ['Consigue biomasa y compra un nodo clave (rombo)', G => Object.keys(G.skills).some(k => k.includes('K')), 150],
  ['Derrota a la termita soldado (noche 12)', G => G.level > 12 || G.best >= 12, 2000, G => (G.level - 1) / 12],
  ['Derrota a la araña cazadora (noche 16)', G => G.level > 16 || G.best >= 16, 8000, G => (G.level - 1) / 16],
  ['Derrota al escarabajo ciervo (noche 20)', G => G.level > 20 || G.best >= 20, 30000, G => (G.level - 1) / 20],
  ['Derrota a la mantis religiosa (noche 24)', G => G.level > 24 || G.best >= 24, 100000, G => (G.level - 1) / 24],
  ['Vence a los humanos', G => G.won, 0, G => (G.best || G.level - 1) / 25]
];

/** Huecos para huevos y para larvas (cada uno). */
export const BROOD_SLOTS = 12;
