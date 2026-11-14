// Datos de diseño: duración del día, etapas de la reina, objetivos y equilibrio.
import { SKILLS } from './trees.js';

export const DAY = 60,
    NIGHT = 42,
    DUSK = 8

/**
 * Eras de enemigos: cada especie dura 4 noches y la cuarta trae a su jefe.
 * La noche final llegan los humanos; si los vences, las hormigas conquistan el mundo.
 */
export const ERAS = [
    {
        from: 1,
        name: 'Hormigas rivales',
        one: 'hormiga rival',
        many: 'hormigas rivales',
        minion: 'rival',
        boss: 'rivalQ',
        bossName: 'la reina rival',
    },
    {
        from: 5,
        name: 'Bachacos',
        one: 'bachaco',
        many: 'bachacos',
        minion: 'bachaco',
        boss: 'bachacoS',
        bossName: 'un bachaco soldado',
    },
    {
        from: 9,
        name: 'Termitas',
        one: 'termita',
        many: 'termitas',
        minion: 'termite',
        boss: 'termiteS',
        bossName: 'una termita soldado',
    },
    {
        from: 13,
        name: 'Cucarachas',
        one: 'cucaracha',
        many: 'cucarachas',
        minion: 'roach',
        boss: 'spider',
        bossName: 'una araña cazadora',
    },
    {
        from: 17,
        name: 'Arañas',
        one: 'araña',
        many: 'arañas',
        minion: 'spiderling',
        boss: 'beetle',
        bossName: 'un escarabajo ciervo',
    },
    {
        from: 21,
        name: 'Escarabajos',
        one: 'escarabajo',
        many: 'escarabajos',
        minion: 'beetling',
        boss: 'mantis',
        bossName: 'una mantis religiosa',
    },
    {
        from: 25,
        name: 'Humanos',
        one: 'humano',
        many: 'humanos',
        minion: null,
        boss: 'shoe',
        bossName: 'los humanos',
        final: true,
    },
]
export const eraFor = (n) =>
    ERAS.reduce((e, x) => (n >= x.from ? x : e), ERAS[0])

/**
 * Evoluciones de tus hormigas: una vía lineal, pagada con ADN y permanente.
 * Cada una se desbloquea al vencer al jefe de una era (has visto a ese rival y aprendido de él).
 * fx: multiplicadores de comida, daño, vida y velocidad.
 */
export const EVOS = [
    {
        name: 'Hormiga común',
        req: 0,
        cost: 0,
        fx: {},
        desc: 'La forma con la que empieza todo.',
    },
    // cada evolución sube comida, daño y vida a la vez (BAL.evoAll, ver calc en rules.js)
    {
        name: 'Hormiga de fuego',
        req: 4,
        cost: 3,
        fx: {},
        desc: 'Aguijón ardiente. Comida, daño y vida ×1,45',
    },
    {
        name: 'Hormiga cortadora',
        req: 8,
        cost: 8,
        fx: {},
        desc: 'Mandíbulas de tijera. Comida, daño y vida ×1,45',
    },
    {
        name: 'Hormiga bala',
        req: 12,
        cost: 16,
        fx: {},
        desc: 'La picadura más dolorosa. Comida, daño y vida ×1,45',
    },
    {
        name: 'Hormiga legionaria',
        req: 16,
        cost: 28,
        fx: {},
        desc: 'Marcha imparable. Comida, daño y vida ×1,45',
    },
    {
        name: 'Hormiga bulldog',
        req: 20,
        cost: 45,
        fx: {},
        desc: 'Salta y muerde. Comida, daño y vida ×1,45',
    },
    {
        name: 'Hormiga titán',
        req: 24,
        cost: 70,
        fx: {},
        desc: 'La única que puede herir a los humanos. Comida, daño y vida ×1,45',
    },
]

/** Noche final: al ganarla las hormigas conquistan el mundo (se puede seguir jugando). */
export const FINAL_NIGHT = 25
/** La noche final dura más: hace falta tiempo para tumbar a los humanos. */
export const NIGHT_FINAL = 80

/** Segundos que tardan los enemigos en llegar a la reina si no queda ninguna hormiga. */
export const RAID = 7

/**
 * Equilibrio. Todo lo que cambia la dificultad está aquí, para ajustarlo con
 * `node tools/sim.mjs` (simula partidas completas a toda velocidad).
 */
export const BAL = {
    trip: 18, // segundos que tarda una hormiga en ir a por comida y volver (medido en el juego)
    carry: 4, // comida por viaje al empezar (se reparte entre la reina y la despensa)
    eggBase: 16, // coste del primer huevo
    eggCurve: 1.2, // cada hormiga o cría encarece el siguiente huevo
    cutMax: 0.25, // «Toque menguante»: lo más que el descuento guardado rebaja un huevo (con el linaje, hasta 0,5)
    feast: 0.001, // «Festín»: probabilidad base de que un toque a la reina valga ×50 al comprar el primer nodo (antes, 0; nunca pasa de 0,03)
    feastX: 50, // lo que vale el toque del festín
    feastCd: 5, // segundos (reloj real) entre festines: la lluvia dura unos segundos y a muchos toques por segundo saldrían seguidos
    reserve: 0.2, // comida por segundo que la reina saca de sus reservas
    eggTime: 12,
    larvaTime: 18,
    dmg: 1,
    hp: 9, // de cada hormiga
    tapFood: 1, // comida que da a mano un toque a la reina (sube con las mejoras de toques)
    tapBrood: 0.12, // un toque adelanta un 12% un huevo o una larva
    tapRateK: 1, // «Toque nutritivo»: dial del % de la recolección por segundo que suma cada toque
    tapRateMax: 0.01, // …y su tope: un 1% de la recolección por segundo en cada toque
    tapCritMax: 0.5, // probabilidad máxima de toque de suerte
    ghostMax: 9, // toques por segundo que dan, como mucho, todas las manos fantasma juntas (8 manos con todo: ≈8,6)
    // enemigos de la noche n: cantidad, vida y daño crecen cada noche
    foeCount0: 1,
    foeCountK: 0.6,
    foeHp0: 24, // antes 30: la primera colonia llega a la noche 3 aunque el árbol dé menos
    foeHpG: 1.5, // antes 1,36: cada colonia llega algo más lejos que la anterior (3 → 4 → 8 → 12 → 16 → 22 → 25)
    foeDps0: 1.6, // antes 2
    foeDpsG: 1.4,
    eraHard: 1.15, // cada era (4 noches) los enemigos tienen ×eraHard de vida y daño sobre la anterior (antes 1,1)
    bossHp: 5,
    bossDps: 3, // jefe de cada era (cuarta noche), en múltiplos de un enemigo normal
    // la noche final: el humano no pega poco a poco, pisa (rules.tickHuman)
    humanHp: 20, // vida del humano, en múltiplos de un enemigo de esa noche
    stompFirst: 3, // segundos desde que llega hasta el primer pisotón
    stompEvery: 8, // segundos entre pisotones
    stompHits: 4, // pisotones que aguantan las hormigas titán (el linaje suma más)
    prize0: 15,
    prizeG: 1.4,
    skill0: 18,
    skillG: 2.7, // antes 2,5: cada nivel de jalea cuesta más
    skillKnee: 12,
    skillTop: 0.38, // del 13 al 18 el precio afloja: el 18 queda en ~4 millones, lo que junta la noche 24
    skillOwnG: 1.01, // cada compra encarece el resto del árbol un 1% (antes 0,6%)
    skillFree: 8, // las primeras compras no encarecen
    bioOwnG: 1.02, // la biomasa del registro: ~8 en la noche 4, ~60 en la 12, ~160 al final
    bioK: 1, // los rombos ya cuestan eso; solo se les quita el recargo que los cerraba
    perkK: 0.25,
    perkP: 1.2, // exponente del precio del linaje: lo barato sigue barato y lo caro cuesta más (40 → ~21 ADN, 80 → ~48)
    skillFxK: 0.6, // fuerza del árbol de la colonia: cada nodo da el 60% de lo que pone en trees.js (el texto ya sale escalado)
    permFxK: 0.6, // fuerza del linaje (igual que skillFxK)
    stageFood: 1.25, // cada etapa de la reina multiplica la comida por viaje
    // ADN al morir o fundar: crece con las noches superadas
    adnK: 1.2, // antes 1,5: fundar da algo menos; el resto lo sueltan los enemigos (adnFoe)
    adnFoe: 0.008, // ADN que suelta cada enemigo: adnFoe × noche^adnFoeP (un jefe, ×4). Noche 8 ~1,8 por noche, 16 ~7,7, 24 ~19
    adnFoeP: 1.5,
    adnP: 1.35, // noche 4 ~10 ADN, noche 12 ~50, noche 24 ~130: da para el linaje y para la evolución de esa era
    evoCostK: 1.6, // las evoluciones caben en el ADN de su era (ya no son lo que marca la duración: lo marca la fuerza de los árboles)
    foundAfter: 3, // superada esta noche ya se puede fundar (y ganar ADN) aunque no caiga ningún jefe
    // racha: cada toque seguido (≤ comboGap s) suma comboStep al ×, hasta comboCap (rampa suave).
    // comboMarks: [toques, +extra] — con «Marcas de la racha» (linaje), cada marca suma unos puntos al % de la racha
    //   (sutil: +5%/+10%, acumulado ~+75% en 10.000). Sin esa mejora, las marcas no dan nada.
    // comboClickAt: con «Toques en cadena» (linaje), en estas marcas cada toque vale un clic más: ×2 en 200, ×3 en 500,
    //   ×4 en 1.000, ×5 en 5.000, ×6 en 10.000 (vale ese tanto y suma ese tanto a la racha). El resto de marcas solo sube el %.
    comboGap: 0.8,
    comboStep: 0.012, // antes 0,025: con el árbol a tope la rampa se iba a ×4–5
    comboCap: 20,
    comboMarks: [
      [200, 0.05],
      [300, 0.05],
      [500, 0.05],
      [750, 0.05],
      [1000, 0.1],
      [1250, 0.05],
      [1500, 0.05],
      [2000, 0.05],
      [2500, 0.05],
      [3000, 0.05],
      [5000, 0.1],
      [7500, 0.05],
      [10000, 0.1],
    ],
    comboClickAt: [200, 500, 1000, 5000, 10000],
    evoAll: 1.45, // cada evolución: comida, daño y vida ×evoAll (y +5% de velocidad)
    blood: 0.015, // «Sangre antigua»: +1,5% de comida, daño y vida por cada ADN ganado en total
}

export const STAGES = [
    { name: 'Reina joven', at: 0 },
    { name: 'Reina fértil', at: 600 },
    { name: 'Gran madre', at: 12000 },
    { name: 'Matriarca', at: 600000 },
    { name: 'Reina primordial', at: 1000000 },
    { name: 'Reina ancestral', at: 5000000 },
    { name: 'Reina eterna', at: 10000000 },
    { name: 'Emperatriz', at: 50000000 },
    { name: 'Soberana', at: 200000000 },
    { name: 'Reina absoluta', at: 1000000000 },
]

// [texto, condición, premio en jalea, progreso 0..1 opcional]
export const OBJ = [
    [
        'Toca el huevo y la larva para que nazca tu primera hormiga',
        (G) => G.stats.born >= 1,
        10,
    ],
    ['Toca a la reina para que ponga otro huevo', (G) => G.stats.laid >= 2, 5],
    [
        'Ten 3 hormigas antes de que caiga la noche',
        (G) => G.ants >= 3,
        15,
        (G) => G.ants / 3,
    ],
    ['Sobrevive a la primera noche', (G) => G.level > 1, 25],
    [
        'Compra tu primera habilidad en el Árbol',
        (G) => Object.keys(G.skills).length >= 1,
        30,
    ],
    [
        'Derrota a la reina rival (noche 4)',
        (G) => G.level > 4 || G.best >= 4,
        80,
        (G) => (G.level - 1) / 4,
    ],
    ['Compra algo en el Linaje', (G) => Object.keys(G.perm).length >= 1, 0],
    [
        'Derrota al bachaco soldado (noche 8)',
        (G) => G.level > 8 || G.best >= 8,
        400,
        (G) => (G.level - 1) / 8,
    ],
    [
        'Consigue biomasa y compra un nodo clave (rombo)',
        (G) => Object.keys(G.skills).some((k) => SKILLS[k]?.key),
        150,
    ],
    [
        'Derrota a la termita soldado (noche 12)',
        (G) => G.level > 12 || G.best >= 12,
        2000,
        (G) => (G.level - 1) / 12,
    ],
    [
        'Derrota a la araña cazadora (noche 16)',
        (G) => G.level > 16 || G.best >= 16,
        8000,
        (G) => (G.level - 1) / 16,
    ],
    [
        'Derrota al escarabajo ciervo (noche 20)',
        (G) => G.level > 20 || G.best >= 20,
        30000,
        (G) => (G.level - 1) / 20,
    ],
    [
        'Derrota a la mantis religiosa (noche 24)',
        (G) => G.level > 24 || G.best >= 24,
        100000,
        (G) => (G.level - 1) / 24,
    ],
    [
        'Vence a los humanos',
        (G) => G.won,
        0,
        (G) => (G.best || G.level - 1) / 25,
    ],
]

/** Huecos para huevos y para larvas (cada uno). */
export const BROOD_SLOTS = 12
