// Los dos árboles del juego, como grafos:
//   SKILLS: árbol de la colonia. Se paga con jalea (nodos normales) y biomasa (nodos clave, en rombo).
//           Se pierde al morir la reina o al fundar una colonia nueva.
//   PERKS:  árbol de linaje. Se paga con ADN y es permanente entre colonias.
//
// Cada mejora depende de uno, dos o tres padres y para comprarla hay que tenerlos TODOS (ver SG y PG).
// El árbol se abre desde la raíz en todas direcciones, con un lado por rama: en la colonia Recolección,
// Guerra, Toques y Cría; en el linaje Reina, Toques, Recolección, Guerra y Fundación. Dónde va cada nodo lo
// decide tools/layout-trees.mjs (pegado a sus padres, también en diagonal, y en el lado de su rama) y lo guarda
// en treeLayout.js. Al añadir o quitar nodos: node tools/layout-trees.mjs && node tools/check-trees.mjs
// El precio sube con cada compra (nodeCost en rules.js) y nunca baja al avanzar por una rama.
//
// Contenido: id → [icono, nombre, texto, coste, efectos, extra?]
//   texto: solo lo que no es una cifra (las cifras de los efectos las escribe describe()); null si no hace falta
//   coste: nivel (tier) de jalea, o { bio: n } / { adn: n }
//   efectos: los valores que se aplican de verdad. Las claves que terminan en X multiplican; el resto suman (calc en rules.js)
//   extra: { key: 1 } nodo clave (rombo) · { reqPerk } necesita algo del linaje · { own } lo deja tuyo en el árbol
import { LAYOUT } from './treeLayout.js';

/* ---------------- árbol de la colonia: contenido ---------------- */
const SN = {
  // ---- Recolección
  fo1: ['leaf', 'Buche grande I', null, 1, { food: 0.15 }],
  fo3: ['leaf', 'Buche grande II', null, 2, { food: 0.15 }],
  fo5: ['leaf', 'Buche grande III', null, 3, { food: 0.2 }],
  fo6: ['leaf', 'Hojas grandes', null, 4, { food: 0.2 }],
  fo8: ['leaf', 'Buche grande IV', null, 6, { food: 0.25 }],
  fo10: ['leaf', 'Buche grande V', null, 7, { food: 0.3 }],
  f1a: ['leaf', 'Buche grande VI', null, 9, { food: 0.3 }],
  f1b: ['leaf', 'Buche grande VII', null, 10, { food: 0.35 }],
  f1c: ['leaf', 'Buche grande VIII', null, 11, { food: 0.4 }],
  f1d: ['leaf', 'Buche sin fondo', null, { bio: 70 }, { foodX: 1.3 }, { key: 1 }],
  fo2: ['boot', 'Patas ágiles I', null, 1, { speed: 0.06 }],
  fo4: ['boot', 'Patas ágiles II', null, 3, { speed: 0.06 }],
  fo7: ['boot', 'Patas ágiles III', null, 4, { speed: 0.07 }],
  fo9: ['boot', 'Patas ágiles IV', null, 6, { speed: 0.09 }],
  f8a: ['boot', 'Patas ágiles V', null, 9, { speed: 0.09 }],
  f8b: ['boot', 'Patas ágiles VI', null, 11, { speed: 0.1 }],
  f8c: ['boot', 'Patas ágiles VII', null, 13, { speed: 0.1 }],
  fo11: ['coin', 'Botín nocturno', null, 3, { prize: 0.3 }],
  qj1: ['crown', 'Jalea real I', null, 3, { qJellyP: 0.5 }, { reqPerk: 'pqj1' }],
  qj2: ['crown', 'Jalea real II', null, 6, { qJellyP: 0.75 }, { reqPerk: 'pqj1' }],
  qj3: ['crown', 'Jalea real III', null, 9, { qJellyP: 1 }, { reqPerk: 'pqj1' }],
  qjK: ['crown', 'Corona de jalea', null, { bio: 30 }, { qJellyP: 1.5 }, { key: 1, reqPerk: 'pqj1' }],
  lc1: ['clover', 'Cosecha afortunada I', null, 3, { luck: 0.08 }],
  lc2: ['clover', 'Cosecha afortunada II', null, 5, { luck: 0.12 }],
  f7a: ['clover', 'Cosecha afortunada III', null, 9, { luck: 0.1 }],
  f7b: ['clover', 'Cosecha afortunada IV', null, 11, { luck: 0.1 }],
  f7c: ['clover', 'Trébol dorado', null, { bio: 70 }, { luck: 0.12, goldFood: 0.03 }, { key: 1 }],
  foK1: ['leaf', 'Rastro de feromonas', null, { bio: 3 }, { foodX: 1.3 }, { key: 1 }],
  foK2: ['leaf', 'Doble carga', null, { bio: 8 }, { foodX: 1.5 }, { key: 1 }],
  foK4: ['leaf', 'Cosecha masiva', null, { bio: 30 }, { foodX: 1.5 }, { key: 1 }],
  f9: ['leaf', 'Cosecha legendaria', null, { bio: 140 }, { foodX: 1.5 }, { key: 1 }],
  fo12: ['leaf', 'Despensa', null, 6, { food: 0.2, reserve: 0.3 }],
  f2a: ['leaf', 'Despensa II', null, 9, { food: 0.2, reserve: 0.3 }],
  f2b: ['leaf', 'Despensa III', null, 11, { food: 0.25, reserve: 0.35 }],
  f2c: ['leaf', 'Granero', null, { bio: 55 }, { foodX: 1.15, reserve: 0.6 }, { key: 1 }],
  gf1: ['goldleaf', 'Comida dorada', null, 6, { goldFood: 0.03 }],
  f4a: ['goldleaf', 'Comida dorada II', null, 10, { goldFood: 0.03 }],
  f4b: ['goldleaf', 'Comida dorada III', null, 12, { goldFood: 0.03 }],
  f4c: ['goldleaf', 'Ambrosía', null, { bio: 80 }, { goldFood: 0.05 }, { key: 1 }],
  gf2: ['goldleaf', 'Néctar real', null, 8, { goldFood: 0.04 }],
  f5a: ['goldleaf', 'Néctar real II', null, 11, { goldFood: 0.03 }],
  f5b: ['goldleaf', 'Néctar real III', null, 13, { goldFood: 0.03 }],
  f5c: ['goldleaf', 'Fuente de néctar', null, { bio: 100 }, { goldFood: 0.05 }, { key: 1 }],
  foK3: ['moon', 'Rutas nocturnas', 'Por la noche siguen entrando provisiones, a media marcha', { bio: 14 }, { nightWork: 1 }, { key: 1 }],
  fo13: ['boot', 'Exploradoras', null, 8, { food: 0.1, speed: 0.06 }],
  f6a: ['boot', 'Exploradoras II', null, 10, { food: 0.1, speed: 0.06 }],
  f6b: ['boot', 'Exploradoras III', null, 12, { food: 0.15, speed: 0.07 }],
  f6c: ['boot', 'Mapa del bosque', null, { bio: 90 }, { foodX: 1.15, speed: 0.2 }, { key: 1 }],
  f3a: ['moon', 'Turno de noche', null, 9, { prize: 0.3 }],
  f3b: ['coin', 'Botín nocturno II', null, 10, { prize: 0.3 }],
  f3c: ['coin', 'Botín nocturno III', null, 11, { prize: 0.35 }],
  f3d: ['coin', 'Tesoro de guerra', null, { bio: 50 }, { prize: 0.9 }, { key: 1 }],
  fs1: ['goldleaf', 'Festín', 'En un festín llueve comida en la boca de la reina', 9, { feast: 0.002 }],
  fs2: ['goldleaf', 'Festín II', null, 12, { feast: 0.004 }],
  fsK: ['goldleaf', 'Festín real', null, { bio: 50 }, { feast: 0.006 }, { key: 1 }],
  // ---- Guerra
  wa1: ['sword', 'Mandíbulas I', null, 1, { dmg: 0.15 }],
  wa3: ['sword', 'Mandíbulas II', null, 2, { dmg: 0.15 }],
  wa5: ['sword', 'Mandíbulas III', null, 3, { dmg: 0.2 }],
  wa10: ['sword', 'Mandíbulas IV', null, 6, { dmg: 0.25 }],
  wa11: ['sword', 'Mandíbulas V', null, 8, { dmg: 0.3 }],
  w1a: ['sword', 'Mandíbulas VI', null, 9, { dmg: 0.3 }],
  w1b: ['sword', 'Mandíbulas VII', null, 10, { dmg: 0.35 }],
  w1c: ['sword', 'Mandíbulas VIII', null, 11, { dmg: 0.4 }],
  w1d: ['sword', 'Mandíbulas de acero', null, { bio: 70 }, { dmgX: 1.3 }, { key: 1 }],
  wa2: ['shield', 'Caparazón I', null, 1, { hp: 0.15 }],
  wa4: ['shield', 'Caparazón II', null, 3, { hp: 0.15 }],
  wa6: ['shield', 'Caparazón III', null, 4, { hp: 0.2 }],
  wa8: ['shield', 'Caparazón IV', null, 6, { hp: 0.25 }],
  wa12: ['shield', 'Caparazón V', null, 8, { hp: 0.3 }],
  w6a: ['shield', 'Caparazón VI', null, 9, { hp: 0.3 }],
  w6b: ['shield', 'Caparazón VII', null, 10, { hp: 0.35 }],
  w6c: ['shield', 'Caparazón VIII', null, 11, { hp: 0.4 }],
  w6d: ['shield', 'Coraza de diamante', null, { bio: 80 }, { hpX: 1.3 }, { key: 1 }],
  mx2: ['shield', 'Guardia del nido', null, 3, { dmg: 0.09, hp: 0.09 }],
  mx3: ['flame', 'Nido templado', null, 5, { growth: 0.09, hp: 0.06 }],
  w2a: ['shield', 'Guardia del nido II', null, 9, { dmg: 0.1, hp: 0.1 }],
  w2b: ['shield', 'Guardia del nido III', null, 11, { dmg: 0.15, hp: 0.15 }],
  w2c: ['shield', 'Muralla viva', null, { bio: 60 }, { hpX: 1.2, dmgX: 1.1 }, { key: 1 }],
  waK1: ['sword', 'Mandíbulas afiladas', null, { bio: 3 }, { dmgX: 1.3 }, { key: 1 }],
  waK3: ['fist', 'Mandíbula reforzada', 'Mutación: mandíbulas enormes', { bio: 14 }, { dmgX: 1.5, jaw: 1 }, { key: 1 }],
  waK4: ['fist', 'Furia de la colonia', null, { bio: 30 }, { dmgX: 1.2 }, { key: 1 }],
  w9: ['fist', 'Ejército invencible', null, { bio: 140 }, { dmgX: 1.3, hpX: 1.3 }, { key: 1 }],
  wa7: ['seed', 'Saqueo', null, 4, { bioKill: 1 }],
  w3a: ['seed', 'Saqueo II', null, 9, { bioKill: 1 }],
  w3b: ['seed', 'Saqueo III', null, 11, { bioKill: 1 }],
  w3c: ['seed', 'Carroñeras', null, { bio: 50 }, { bioKill: 2 }, { key: 1 }],
  waK2: ['shield', 'Quitina gruesa', null, { bio: 6 }, { hpX: 1.3 }, { key: 1 }],
  w8a: ['shield', 'Escudo de quitina', null, 11, { hp: 0.2, dodge: 0.03 }],
  w8b: ['shield', 'Escudo de quitina II', null, 13, { hp: 0.25, dodge: 0.03 }],
  wa9: ['coin', 'Botín de guerra', null, 6, { prize: 0.3 }],
  w7a: ['coin', 'Botín de guerra II', null, 9, { prize: 0.3 }],
  w7b: ['coin', 'Botín de guerra III', null, 11, { prize: 0.35 }],
  wa13: ['shield', 'Veteranas', null, 7, { dodge: 0.1 }],
  wa14: ['shield', 'Veteranas II', null, 8, { dodge: 0.1 }],
  w5a: ['shield', 'Veteranas III', null, 10, { dodge: 0.05 }],
  w5b: ['shield', 'Veteranas IV', null, 12, { dodge: 0.05 }],
  w5c: ['shield', 'Inmortales', null, { bio: 100 }, { dodge: 0.08, hpX: 1.1 }, { key: 1 }],
  w4a: ['fist', 'Rabia', null, 10, { dmg: 0.25 }],
  w4b: ['fist', 'Rabia II', null, 12, { dmg: 0.3 }],
  w4c: ['fist', 'Frenesí', null, { bio: 90 }, { dmgX: 1.3 }, { key: 1 }],
  // ---- Toques
  ta1: ['hand', 'Caricia I', null, 1, { click: 0.2 }],
  ta4: ['hand', 'Caricia II', null, 3, { click: 0.25 }],
  ta7: ['hand', 'Caricia III', null, 5, { click: 0.3 }],
  ta9: ['hand', 'Caricia IV', null, 7, { click: 0.35 }],
  t6a: ['hand', 'Caricia V', null, 9, { click: 0.4 }],
  t6b: ['hand', 'Caricia VI', null, 10, { click: 0.45 }],
  t6c: ['hand', 'Caricia VII', null, 12, { click: 0.5 }],
  t6d: ['hand', 'Manos de oro', null, { bio: 80 }, { clickX: 1.5 }, { key: 1 }],
  ta2: ['crown', 'Masaje real', null, 1, { tapQ: 0.5 }],
  t7a: ['crown', 'Masaje real II', null, 9, { tapQ: 0.4 }],
  t7b: ['crown', 'Masaje real III', null, 11, { tapQ: 0.5 }],
  t7c: ['crown', 'Banquete real', null, { bio: 60 }, { tapQ: 0.8 }, { key: 1 }],
  ta3: ['larva', 'Mimo a la cría', null, 2, { tapB: 0.5 }],
  ta6: ['larva', 'Mimo a la cría II', null, 4, { tapB: 0.5 }],
  tb1: ['larva', 'Mimo contagioso', null, 6, { tapSplash: 0.25 }],
  t8a: ['larva', 'Mimo a la cría III', null, 9, { tapB: 0.5 }],
  tb2: ['larva', 'Mimo contagioso II', null, 10, { tapSplash: 0.25 }],
  t8b: ['larva', 'Mimo a la cría IV', null, 11, { tapB: 0.6 }],
  t8c: ['larva', 'Nodrizas mimadas', null, { bio: 70 }, { tapB: 1, growth: 0.1 }, { key: 1 }],
  ta5: ['bolt', 'Golpe certero', null, 3, { tapFoe: 1 }],
  ta8: ['bolt', 'Golpe certero II', null, 5, { tapFoe: 1 }],
  ta11: ['bolt', 'Golpe certero III', null, 7, { tapFoe: 1.5 }],
  t3a: ['bolt', 'Golpe certero IV', null, 9, { tapFoe: 1.5 }],
  t3b: ['bolt', 'Golpe certero V', null, 11, { tapFoe: 2 }],
  t3c: ['bolt', 'Puño de la reina', null, { bio: 50 }, { tapFoe: 3 }, { key: 1 }],
  lk1: ['star', 'Toque de suerte I', null, 3, { tapCrit: 0.04 }],
  lk2: ['star', 'Toque de suerte II', null, 5, { tapCrit: 0.06 }],
  lk3: ['star', 'Toque de suerte III', null, 8, { tapCrit: 0.06 }],
  t5a: ['star', 'Toque de suerte IV', null, 10, { tapCrit: 0.05 }],
  t5b: ['star', 'Toque de suerte V', null, 12, { tapCrit: 0.05 }],
  lkK: ['star', 'Golpe de fortuna', 'Los toques de suerte valen ×5 en vez de ×2', { bio: 12 }, { critBig: 1 }, { key: 1 }],
  t5c: ['star', 'Toque divino', null, { bio: 90 }, { tapCrit: 0.06, clickX: 1.25 }, { key: 1 }],
  tn1: ['leaf', 'Toque nutritivo I', null, 4, { tapRate: 0.001 }],
  tn2: ['leaf', 'Toque nutritivo II', null, 7, { tapRate: 0.001 }],
  tn3: ['leaf', 'Toque nutritivo III', null, 10, { tapRate: 0.002 }],
  tnK: ['leaf', 'Mano que alimenta', null, { bio: 40 }, { tapRate: 0.002 }, { key: 1 }],
  taK1: ['hand', 'Manos de reina', null, { bio: 4 }, { clickX: 1.5 }, { key: 1 }],
  t9: ['hand', 'Mano de la reina', null, { bio: 140 }, { clickX: 1.5, tapCrit: 0.03 }, { key: 1 }],
  ghK: ['ghost', 'Mano fantasma', 'Una mano invisible toca a la reina sola. Mientras tengas racha, sus toques también la suben', { bio: 5 }, { ghost: 0.125 }, { key: 1 }],
  mh2: ['ghost', 'Segunda mano', 'Otra mano fantasma', { bio: 8 }, { ghost: 0.125 }, { key: 1, reqPerk: 'pgh4' }],
  mh3: ['ghost', 'Tercera mano', 'Otra mano fantasma', { bio: 16 }, { ghost: 0.125 }, { key: 1, reqPerk: 'pgh5' }],
  mh4: ['ghost', 'Cuarta mano', 'Otra mano fantasma', { bio: 28 }, { ghost: 0.125 }, { key: 1, reqPerk: 'pgh6' }],
  mh5: ['ghost', 'Quinta mano', 'Otra mano fantasma', { bio: 40 }, { ghost: 0.125 }, { key: 1, reqPerk: 'pgh7' }],
  gh2: ['ghost', 'Mano veloz', null, 6, { ghostX: 1.15 }],
  gh3: ['ghost', 'Mano experta', null, 8, { ghostX: 1.1 }],
  t1a: ['ghost', 'Mano veloz II', null, 9, { ghostX: 1.1 }],
  t2a: ['ghost', 'Mano experta II', null, 10, { ghostX: 1.1 }],
  t1b: ['ghost', 'Mano veloz III', null, 11, { ghostX: 1.1 }],
  t2b: ['ghost', 'Mano experta III', null, 12, { ghostX: 1.1 }],
  t1c: ['ghost', 'Mil manos', 'Otra mano fantasma', { bio: 70 }, { ghost: 0.125 }, { key: 1 }],
  taK2: ['coin', 'Toque dorado', 'Tocar a la reina también da jalea: la mitad de lo que come', { bio: 10 }, { gold: 1 }, { key: 1 }],
  cb1: ['bolt', 'Ritmo I', null, 10, { comboStep: 0.006 }, { reqPerk: 'ptp' }],
  cb2: ['bolt', 'Racha larga', null, 11, { comboCap: 10 }, { reqPerk: 'ptp' }],
  cb3: ['hand', 'Dedos ligeros', null, 11, { comboGap: 0.5 }, { reqPerk: 'ptp' }],
  cb5: ['bolt', 'Marca temprana', null, 11, { comboEarly: 0.1 }, { reqPerk: 'ptp' }],
  cb4: ['bolt', 'Ritmo II', null, 12, { comboStep: 0.009 }, { reqPerk: 'ptp' }],
  cb6: ['bolt', 'Marca temprana II', null, 13, { comboEarly: 0.1 }, { reqPerk: 'ptp' }],
  cbK2: ['shield', 'Racha blindada', null, { bio: 60 }, { comboKeep: 0.25 }, { key: 1, reqPerk: 'ptp' }],
  cbK: ['bolt', 'Racha desatada', null, { bio: 80 }, { comboX: 2 }, { key: 1, reqPerk: 'ptp' }],
  // ---- Cría
  br1: ['egg', 'Huevos baratos I', null, 1, { eggCostX: 0.93 }],
  br5: ['egg', 'Huevos baratos II', null, 3, { eggCostX: 0.93 }],
  br6: ['egg', 'Metabolismo real', null, 4, { eggCostX: 0.92 }],
  br9: ['egg', 'Huevera', null, 4, { eggCostX: 0.9 }],
  br8: ['egg', 'Huevos baratos III', null, 5, { eggCostX: 0.92 }],
  br12: ['egg', 'Huevos baratos IV', null, 7, { eggCostX: 0.9 }],
  b2a: ['egg', 'Huevos baratos V', null, 8, { eggCostX: 0.93 }],
  b2b: ['egg', 'Huevos baratos VI', null, 9, { eggCostX: 0.93 }],
  b2c: ['egg', 'Huevos baratos VII', null, 11, { eggCostX: 0.92 }],
  b2d: ['egg', 'Huevos baratos VIII', null, 12, { eggCostX: 0.92 }],
  br2: ['flame', 'Calor del nido I', null, 1, { growth: 0.1 }],
  br4: ['flame', 'Calor del nido II', null, 2, { growth: 0.1 }],
  br7: ['flame', 'Calor del nido III', null, 5, { growth: 0.15 }],
  br11: ['flame', 'Calor del nido IV', null, 7, { growth: 0.2 }],
  b3b: ['flame', 'Calor del nido V', null, 9, { growth: 0.2 }],
  b3c: ['flame', 'Calor del nido VI', null, 10, { growth: 0.2 }],
  b3d: ['flame', 'Incubadora real', null, { bio: 70 }, { growthX: 1.3 }, { key: 1 }],
  br3: ['crown', 'Reserva real I', null, 2, { reserve: 0.35 }],
  mx1: ['leaf', 'Despensa común', null, 3, { food: 0.09, reserve: 0.15 }],
  br10: ['crown', 'Reserva real II', null, 6, { reserve: 0.6 }],
  b1a: ['crown', 'Reserva real III', null, 8, { reserve: 0.6 }],
  b1b: ['crown', 'Reserva real IV', null, 9, { reserve: 0.9 }],
  b1c: ['crown', 'Reserva real V', null, 11, { reserve: 1.2 }],
  b1d: ['crown', 'Reina inagotable', null, { bio: 70 }, { reserve: 2.4 }, { key: 1 }],
  brK1: ['flame', 'Nodrizas', null, { bio: 3 }, { growthX: 1.3 }, { key: 1 }],
  ta10: ['flame', 'Incubadora', null, 6, { growth: 0.1 }],
  t4a: ['flame', 'Incubadora II', null, 9, { growth: 0.1 }],
  t4b: ['flame', 'Incubadora III', null, 11, { growth: 0.15 }],
  t4c: ['flame', 'Cuna real', null, { bio: 60 }, { growthX: 1.2 }, { key: 1 }],
  brK2: ['eggs2', 'Puesta doble', null, { bio: 8 }, { twin: 0.25 }, { key: 1 }],
  b5a: ['eggs2', 'Gemelas', null, 8, { twin: 0.08 }],
  b5b: ['eggs2', 'Gemelas II', null, 10, { twin: 0.08 }],
  b5d: ['eggs2', 'Gemelas III', null, 12, { twin: 0.1 }],
  b5c: ['eggs2', 'Camada', null, { bio: 55 }, { twin: 0.15 }, { key: 1 }],
  sh1: ['sparkle', 'Hormigas doradas', 'Las doradas traen ×3 comida, pegan ×2 y van más rápido', 5, { shiny: 0.03 }],
  sh2: ['sparkle', 'Brillo real', null, 7, { shiny: 0.05 }],
  b4a: ['sparkle', 'Brillo real II', null, 9, { shiny: 0.03 }],
  b4b: ['sparkle', 'Brillo real III', null, 10, { shiny: 0.03 }],
  shK: ['sparkle', 'Linaje dorado', null, { bio: 16 }, { shiny: 0.07 }, { key: 1 }],
  sh3: ['sparkle', 'Doradas de élite', 'Las doradas traen ×5 comida (en vez de ×3) y pegan ×3 (en vez de ×2)', { bio: 20 }, { shinyElite: 1 }, { key: 1 }],
  b4c: ['sparkle', 'Corona dorada', null, { bio: 60 }, { shiny: 0.05 }, { key: 1 }],
  br13: ['eggs2', 'Huevo de regalo', null, 6, { extraEgg: 0.05 }],
  b7a: ['eggs2', 'Huevo de regalo II', null, 9, { extraEgg: 0.05 }],
  b7b: ['eggs2', 'Huevo de regalo III', null, 11, { extraEgg: 0.05 }],
  b7c: ['eggs2', 'Puesta en racimo', null, { bio: 60 }, { extraEgg: 0.08 }, { key: 1 }],
  brK3: ['crown', 'Reina eficiente', null, { bio: 14 }, { curve: 0.025 }, { key: 1 }],
  brK4: ['crown', 'Reina prolífica', null, { bio: 30 }, { curve: 0.025 }, { key: 1 }],
  b3a: ['crown', 'Reina dinástica', null, { bio: 45 }, { curve: 0.02 }, { key: 1 }],
  b9: ['crown', 'Matriarca', null, { bio: 120 }, { eggCostX: 0.8, growthX: 1.1 }, { key: 1 }],
  brK5: ['egg', 'Puesta sin precio', null, { bio: 18 }, { freeEgg: 0.1 }, { key: 1 }],
  b8a: ['egg', 'Puesta sin precio II', null, 10, { freeEgg: 0.08 }],
  b8b: ['egg', 'Puesta sin precio III', null, 12, { freeEgg: 0.08 }],
  b8c: ['egg', 'Cría gratuita', null, { bio: 80 }, { freeEgg: 0.1 }, { key: 1 }],
  b6a: ['larva', 'Eclosión rápida', null, 9, { instaHatch: 0.05 }],
  b6b: ['larva', 'Eclosión rápida II', null, 11, { instaHatch: 0.05 }],
  b6c: ['larva', 'Larvas precoces', null, { bio: 50 }, { instaHatch: 0.1 }, { key: 1 }]
};

/* ---------------- árbol de la colonia: de qué depende cada mejora ---------------- */
// 'hijo<padre1,padre2': para comprar una mejora hay que tener TODOS sus padres. Las ramas se abren (un nodo puede
// tener varios hijos) y los nodos clave suelen unir dos ramas. Dónde se dibuja cada uno: treeLayout.js.
const SG = {
  food: `fo1<root fo2<root fo3<fo1 fo11<fo1 fo4<fo2 lc1<fo2 fo5<fo3 foK1<fo3,fo4 qj1<fo11 fo12<fo11 fo7<fo4 lc2<lc1
    fo6<fo5 qj2<qj1 foK2<foK1 fo9<fo7 gf1<lc2 f7a<lc2 fo8<fo6 qj3<qj2 qjK<qj3 f2a<fo12 f3a<fo12 fo10<fo8
    foK4<foK2,fo8 foK3<fo9,foK2 f8a<fo9 gf2<gf1 f4a<gf1 f7b<f7a f2b<f2a f2c<f2b f3b<f3a f3c<f3b f3d<f3c
    f1a<fo10 f1b<f1a f1c<f1b f1d<f1c fo13<foK3 f6a<fo13 f6b<f6a f8b<f8a f8c<f8b f6c<f6b,f8c f5a<gf2 f5b<f5a
    f5c<f5b fs1<gf2 fs2<fs1 fsK<fs2 f4b<f4a f4c<f4b f7c<f7b,f5a f9<foK4,f1d`,
  war: `wa1<root wa2<root wa3<wa1 mx2<wa1,wa2 wa4<wa2 wa5<wa3 waK1<wa3,mx2 waK2<wa4,mx2 wa6<wa4 wa7<wa5 wa10<wa5
    mx3<mx2 wa8<wa6 wa9<wa7 waK3<waK1,wa10 wa11<wa10 wa12<wa8 wa13<mx3,wa8 wa14<wa13 w3a<wa7 w3b<w3a w3c<w3b
    w7a<wa9 w7b<w7a w8a<waK2,wa12 w8b<w8a w1a<wa11 w1b<w1a w1c<w1b w1d<w1c w6a<wa12 w6b<w6a w6c<w6b w6d<w6c
    w2a<mx3 w2b<w2a w2c<w2b waK4<waK3 w4a<waK4 w4b<w4a w4c<w4b w5a<wa14 w5b<w5a w5c<w5b w9<w1d,w4c`,
  tap: `ta1<root ta2<root ta3<ta1 ta4<ta1 lk1<ta2 ta5<ta2 taK1<ta4,lk1 ta6<ta3 ta7<ta4 lk2<lk1 ta8<ta5 tn1<taK1
    ghK<taK1 lkK<lk2 tb1<ta6 ta9<ta7 ta11<ta8 gh2<ghK mh2<ghK tn2<tn1 taK2<tn1,ghK lk3<lkK gh3<gh2 mh3<mh2 mh4<mh3
    mh5<mh4 t8a<tb1 t6a<ta9 t3a<ta11 t1a<gh3 tn3<tn2 t7a<tn2 cb1<taK2 t5a<lk3 tb2<t8a t6b<t6a t2a<t1a cb2<cb1
    cb3<cb1 t8b<tb2 t3b<t3a t1b<t2a t7b<t7a tnK<tn3 cb5<cb2 cb4<cb3 t6c<t6b t5b<t5a t2b<t1b cb6<cb5,cb4 t7c<t7b
    t8c<t8b t3c<t3b t6d<t6c t5c<t5b t1c<t2b cbK2<cb6 cbK<cbK2 t9<t6d,t7c`,
  brood: `br1<root br2<root br5<br1 br3<br1 br4<br2 brK1<br5 mx1<br3 br6<br5 br7<br4 br9<br6 br10<mx1
    brK2<brK1,br6 ta10<brK1 br8<br9 br11<br7 sh1<brK2 b5a<brK2 br12<br8 br13<br8 b3b<br11 b1a<br10 t4a<ta10
    b6a<ta10 sh2<sh1 b2a<br12 brK3<br12 b7a<br13 brK5<br13 b3c<b3b b1b<b1a t4b<t4a b6b<b6a b5b<b5a shK<sh2
    b4a<sh2 b2b<b2a brK4<brK3 b7b<b7a b8a<brK5 b3d<b3c b1c<b1b t4c<t4b b6c<b6b b5d<b5b sh3<shK b4b<b4a b2c<b2b
    b3a<brK4 b7c<b7b b8b<b8a b1d<b1c b5c<b5d b4c<b4b,sh3 b2d<b2c b8c<b8b b9<b3a,b8c`
};

/* ---------------- linaje: contenido ---------------- */
const PN = {
  // ---- Recolección
  pf1: ['leaf', 'Memoria del camino', null, { adn: 1 }, { food: 0.15 }],
  pf2: ['leaf', 'Buche heredado', null, { adn: 3 }, { food: 0.2 }],
  pf3: ['leaf', 'Gran buche', null, { adn: 8 }, { foodX: 1.35 }],
  pf4: ['leaf', 'Hambre ancestral', null, { adn: 20 }, { foodX: 1.7 }],
  psp: ['boot', 'Patas largas', null, { adn: 3 }, { speed: 0.1 }],
  ppz: ['coin', 'Tributo', null, { adn: 3 }, { prize: 0.75 }],
  pqj1: ['crown', 'Reina productora', null, { adn: 30 }, { qJelly: 1 }],
  pqj2: ['crown', 'Reina productora II', null, { adn: 70 }, { qJelly: 3 }],
  pqj3: ['crown', 'Reina productora III', null, { adn: 140 }, { qJelly: 8 }],
  pgf: ['goldleaf', 'Néctar dorado', null, { adn: 8 }, { goldFood: 0.04 }],
  pgf2: ['goldleaf', 'Banquete dorado', null, { adn: 18 }, { goldFood: 0.05 }],
  plf1: ['leaf', 'Rastro heredado', null, { adn: 16 }, { food: 0.15 }, { own: ['foK1'] }],
  plf2: ['leaf', 'Buche del linaje', null, { adn: 32 }, { food: 0.2 }],
  plf3: ['leaf', 'Carga ancestral', null, { adn: 56 }, { foodX: 1.3 }],
  plf4: ['moon', 'Noche heredada', null, { adn: 72 }, { food: 0.1 }, { own: ['foK3'] }],
  pfs1: ['goldleaf', 'Festín ancestral', null, { adn: 48 }, { feast: 0.003 }],
  pfs2: ['goldleaf', 'Festín eterno', null, { adn: 96 }, { feast: 0.006 }],
  pfs3: ['goldleaf', 'Festín de la estirpe', null, { adn: 160 }, { feast: 0.008 }],
  // ---- Guerra
  pd1: ['sword', 'Instinto de lucha', null, { adn: 1 }, { dmg: 0.15 }],
  pd2: ['sword', 'Mandíbula heredada', null, { adn: 3 }, { dmg: 0.2 }],
  pd3: ['fist', 'Furia ancestral', null, { adn: 8 }, { dmgX: 1.35 }],
  pd4: ['fist', 'Ira de la estirpe', null, { adn: 20 }, { dmgX: 1.7 }],
  ph1: ['shield', 'Piel dura', null, { adn: 1 }, { hp: 0.15 }],
  ph2: ['shield', 'Quitina heredada', null, { adn: 3 }, { hp: 0.2 }],
  ph3: ['shield', 'Coraza ancestral', null, { adn: 8 }, { hpX: 1.35 }],
  ph4: ['shield', 'Caparazón eterno', null, { adn: 20 }, { hpX: 1.7 }],
  pbk: ['seed', 'Carroñeras', null, { adn: 4 }, { bioKill: 1 }],
  pbio: ['seed', 'Biomasa ancestral', null, { adn: 8 }, { startBio: 6 }],
  pdg: ['shield', 'Supervivientes', null, { adn: 10 }, { dodge: 0.08 }],
  plv: ['crown', 'Nido fortificado', null, { adn: 12 }, { lives: 1 }],
  plw1: ['sword', 'Mandíbulas del linaje', null, { adn: 16 }, { dmg: 0.15 }, { own: ['waK1'] }],
  plw2: ['shield', 'Quitina del linaje', null, { adn: 24 }, { hp: 0.15 }, { own: ['waK2'] }],
  plw3: ['fist', 'Furia del linaje', null, { adn: 48 }, { dmgX: 1.25 }],
  plw4: ['shield', 'Coraza del linaje', null, { adn: 48 }, { hpX: 1.25 }],
  plw5: ['fist', 'Mandíbula enorme', null, { adn: 100 }, { dmg: 0.2 }, { own: ['waK3'] }],
  pst1: ['shield', 'Exoesqueleto titánico', null, { adn: 120 }, { stompHits: 1 }],
  pst2: ['shield', 'Exoesqueleto titánico II', null, { adn: 240 }, { stompHits: 1 }],
  pst3: ['shield', 'Exoesqueleto titánico III', null, { adn: 400 }, { stompHits: 1 }],
  // ---- Toques y fundación
  ps1: ['ant', 'Escolta', null, { adn: 2 }, { startAnts: 2 }],
  pse: ['egg', 'Nido preparado', null, { adn: 6 }, { startEggs: 3 }],
  ps2: ['ant', 'Séquito', null, { adn: 7 }, { startAnts: 3 }],
  ps3: ['ant', 'Ejército fundador', null, { adn: 18 }, { startAnts: 5 }],
  pj1: ['leaf', 'Despensa inicial', null, { adn: 2 }, { startJelly: 40 }],
  pj2: ['coin', 'Tesoro real', null, { adn: 8 }, { startJelly: 250 }],
  pkp: ['coin', 'Herencia', null, { adn: 10 }, { keepJelly: 0.05 }],
  pns: ['crown', 'Todo para la reina', 'Cuando en el árbol de la colonia ya no queda nada que comprar con jalea, las obreras dejan de guardar en la despensa y le llevan toda la comida a la reina', { adn: 12 }, { noStore: 1 }],
  ptp: ['bolt', 'Racha', 'Desbloquea la racha: cada toque seguido rinde más', { adn: 4 }, { combo: 1, clickX: 1.1 }],
  pcb1: ['bolt', 'Ritmo heredado', null, { adn: 6 }, { comboStep: 0.008 }],
  pcb2: ['bolt', 'Racha ancestral', null, { adn: 10 }, { comboCap: 10 }],
  pcb3: ['hand', 'Pulso de la estirpe', null, { adn: 14 }, { comboGap: 0.4 }],
  pck: ['shield', 'Racha tenaz', null, { adn: 80 }, { comboKeep: 0.25 }],
  pce: ['bolt', 'Memoria del ritmo', null, { adn: 100 }, { comboEarly: 0.1 }],
  pl1: ['clover', 'Trébol de cuatro hojas', null, { adn: 4 }, { tapCrit: 0.03, luck: 0.05 }],
  pl2: ['clover', 'Fortuna ancestral', null, { adn: 10 }, { tapCrit: 0.05, luck: 0.08 }],
  plt5: ['star', 'Fortuna del linaje', null, { adn: 80 }, { tapCrit: 0.04 }, { own: ['lkK'] }],
  pgh1: ['ghost', 'Mano fantasma', 'En todas las colonias, una mano invisible toca a la reina', { adn: 5 }, { ghost: 0.125 }],
  pgh2: ['ghost', 'Mano incansable', null, { adn: 10 }, { ghostX: 1.15 }],
  pgh3: ['ghost', 'Mano de oro', null, { adn: 12 }, { ghostX: 1.1, tapCrit: 0.04 }],
  pgh4: ['ghost', 'Segunda mano', 'Otra mano fantasma en todas las colonias', { adn: 20 }, {}, { own: ['mh2'] }],
  pgh5: ['ghost', 'Tercera mano', 'Otra mano fantasma en todas las colonias', { adn: 44 }, {}, { own: ['mh3'] }],
  pgh6: ['ghost', 'Cuarta mano', 'Otra mano fantasma en todas las colonias', { adn: 80 }, {}, { own: ['mh4'] }],
  pgh7: ['ghost', 'Quinta mano', 'Otra mano fantasma en todas las colonias', { adn: 140 }, {}, { own: ['mh5'] }],
  pds: ['arrows', 'Saber heredado', null, { adn: 6 }, { discount: 0.25 }],
  prt: ['arrows', 'Borrón y cuenta nueva', 'Desbloquea el botón de reiniciar el Árbol: devuelve toda la jalea y la biomasa gastadas. ¿Quién querría deshacer su propio árbol? Ni idea. Tú, por lo visto.', { adn: 80 }, { resetTree: 1 }],
  pab1: ['arrows', 'Mayordomo del nido', 'Desbloquea un interruptor en el Árbol. Encendido, compra solo las mejoras de la colonia cuando hay jalea o biomasa', { adn: 90 }, { autoBuy: 1 }],
  plt1: ['hand', 'Manos heredadas', null, { adn: 20 }, { click: 0.15 }, { own: ['taK1'] }],
  plt2: ['hand', 'Caricia del linaje', null, { adn: 36 }, { click: 0.2 }],
  plt4: ['coin', 'Dedos de oro', null, { adn: 48 }, { click: 0.1 }, { own: ['taK2'] }],
  ptn1: ['leaf', 'Hambre heredada', null, { adn: 60 }, { tapRate: 0.002 }],
  plt3: ['hand', 'Toque ancestral', null, { adn: 64 }, { clickX: 1.25 }],
  ptn2: ['leaf', 'Hambre heredada II', null, { adn: 140 }, { tapRate: 0.002 }],
  psk: ['moon', 'Saltar el día', 'Un botón junto al reloj hace que caiga la noche ya. Esas noches dan la mitad de ADN', { adn: 60 }, { skipDay: 1 }],
  ptc: ['hand', 'Toque menguante', 'Tus toques a la reina juntan un descuento que se guarda para siempre, en todas las colonias, y se resta de cada huevo (como mucho, el 25% de su precio). Si el descuento ya cubre ese máximo, el toque alimenta a la reina', { adn: 80 }, { tapCut: 1 }],
  ptc2: ['hand', 'Toque menguante II', null, { adn: 120 }, { cutMax: 0.1 }],
  ptc3: ['hand', 'Toque menguante III', null, { adn: 200 }, { cutMax: 0.15 }],
  // ---- Cría
  pe1: ['egg', 'Huevos fuertes', null, { adn: 1 }, { eggCostX: 0.9 }],
  pe2: ['egg', 'Puesta ancestral', null, { adn: 15 }, { eggCostX: 0.8 }],
  plb2: ['egg', 'Puesta barata', null, { adn: 28 }, { eggCostX: 0.92 }],
  pg1: ['flame', 'Nido cálido', null, { adn: 2 }, { growth: 0.2 }],
  plb1: ['flame', 'Nodrizas del linaje', null, { adn: 16 }, { growth: 0.1 }, { own: ['brK1'] }],
  plb3: ['flame', 'Cría veloz', null, { adn: 48 }, { growthX: 1.2 }],
  prs: ['crown', 'Reina robusta', null, { adn: 2 }, { reserve: 1.5 }],
  pcv: ['crown', 'Sangre real', null, { adn: 10 }, { curve: 0.015 }],
  pdx1: ['eggs2', 'Puesta generosa', null, { adn: 4 }, { extraEgg: 0.08 }],
  pqk: ['larva', 'Eclosión precoz', null, { adn: 10 }, { instaHatch: 0.15 }],
  pdx2: ['eggs2', 'Puesta generosa II', null, { adn: 14 }, { extraEgg: 0.12 }],
  pfe1: ['egg', 'Huevo sin precio', null, { adn: 5 }, { freeEgg: 0.1 }],
  pfe2: ['egg', 'Huevo sin precio II', null, { adn: 16 }, { freeEgg: 0.15 }],
  plb5: ['egg', 'Huevo heredado', null, { adn: 96 }, { freeEgg: 0.06 }, { own: ['brK5'] }],
  ptw: ['eggs2', 'Gemelas', null, { adn: 6 }, { twin: 0.1 }],
  plb4: ['eggs2', 'Gemelas del linaje', null, { adn: 64 }, { twin: 0.06 }, { own: ['brK2'] }],
  psh: ['sparkle', 'Sangre dorada', null, { adn: 6 }, { shiny: 0.03 }],
  psh2: ['sparkle', 'Estirpe dorada', null, { adn: 14 }, { shiny: 0.06 }],
  psh3: ['sparkle', 'Realeza dorada', 'Desde el primer día, las doradas traen ×5 comida y pegan ×3', { adn: 24 }, { shinyElite: 1 }],
  pls1: ['sparkle', 'Brillo heredado', null, { adn: 28 }, { shiny: 0.04 }, { own: ['shK'] }],
  pls2: ['sparkle', 'Élite heredada', null, { adn: 64 }, { shiny: 0.04 }, { own: ['sh3'] }],
  // ---- nuevas: Guerra
  pwj: ['fist', 'Ejército de la estirpe', null, { adn: 40 }, { dmgX: 1.15, hpX: 1.15 }],
  pbk2: ['seed', 'Carroña abundante', null, { adn: 20 }, { bioKill: 1 }],
  pdg2: ['shield', 'Supervivientes II', null, { adn: 30 }, { dodge: 0.05 }],
  pdg3: ['shield', 'Supervivientes III', null, { adn: 60 }, { dodge: 0.05 }],
  plv2: ['crown', 'Nido fortificado II', null, { adn: 60 }, { lives: 1 }],
  pwx: ['fist', 'Instinto asesino', null, { adn: 160 }, { dmgX: 1.25 }],
  phx: ['shield', 'Piel de piedra', null, { adn: 160 }, { hpX: 1.25 }],
  // ---- nuevas: Fundación
  pse2: ['egg', 'Nido preparado II', null, { adn: 20 }, { startEggs: 3 }],
  ps4: ['ant', 'Gran ejército fundador', null, { adn: 40 }, { startAnts: 10 }],
  pj3: ['coin', 'Arcas reales', null, { adn: 30 }, { startJelly: 2000 }],
  pj4: ['coin', 'Tesoro de la estirpe', null, { adn: 70 }, { startJelly: 20000 }],
  pkp2: ['coin', 'Herencia II', null, { adn: 30 }, { keepJelly: 0.05 }],
  pkp3: ['coin', 'Herencia III', null, { adn: 80 }, { keepJelly: 0.1 }],
  pbio2: ['seed', 'Biomasa ancestral II', null, { adn: 30 }, { startBio: 20 }],
  pbio3: ['seed', 'Biomasa ancestral III', null, { adn: 70 }, { startBio: 60 }],
  pds2: ['arrows', 'Saber heredado II', null, { adn: 40 }, { discount: 0.1 }]
};

/* ---------------- linaje: de qué depende cada mejora ---------------- */
// Cinco lados: Reina (cría), Toques (toques, racha y manos), Recolección, Guerra y Fundación (con qué empieza cada colonia).
const PG = {
  brood: `pe1<root pg1<root prs<pe1 pdx1<pe1 ptw<pg1 plb1<pg1 pcv<prs,pdx1 pfe1<pdx1 pdx2<pdx1 psh<ptw pqk<pfe1
    pe2<pcv pfe2<pfe1 plb2<pe2 plb3<plb1 psh2<psh psh3<psh2 pls1<psh2 plb4<ptw plb5<pfe2 pls2<pls1,psh3`,
  tap: `ptp<root pl1<ptp pgh1<ptp pcb1<ptp pl2<pl1 pgh2<pgh1 pcb2<pcb1 plt1<pl1,pgh1 pgh3<pgh2 pcb3<pcb2 plt2<plt1
    pgh4<pgh3 plt5<pl2 plt4<plt2 pck<pcb3 pgh5<pgh4 ptn1<plt4 plt3<plt2 pce<pck pgh6<pgh5 ptn2<ptn1 pgh7<pgh6
    ptc<plt3,pck ptc2<ptc ptc3<ptc2`,
  food: `pf1<root pf2<pf1 psp<pf1 ppz<pf1 pf3<pf2 pgf<psp,pf2 pqj1<ppz pns<pf3 pf4<pf3 pgf2<pgf plf1<pf3 pqj2<pqj1
    plf2<plf1 pfs1<pgf2,pf4 plf3<plf2 pqj3<pqj2 plf4<plf3 pfs2<pfs1 pfs3<pfs2`,
  war: `pd1<root ph1<root pd2<pd1 ph2<ph1 pbk<pd1 pdg<ph2 pwj<pd2,ph2 pd3<pd2 ph3<ph2 pbk2<pbk pdg2<pdg plv<pdg
    pd4<pd3 ph4<ph3 plw1<pd3 plw2<plw1,ph3 plw3<plw2 plw4<plw3 plw5<plw4 pdg3<pdg2 plv2<plv,pdg2 pwx<pd4,plw3
    phx<ph4,plw4 pst1<plw5 pst2<pst1 pst3<pst2`,
  found: `ps1<root pj1<root pse<ps1 ps2<ps1 pj2<pj1 pds<pj1 pbio<ps2 pse2<pse ps3<ps2 pkp<pj2 prt<pds pds2<pds
    pj3<pkp pkp2<pkp pbio2<pbio ps4<ps3 psk<pbio2 pj4<pj3 pkp3<pkp2 pbio3<pbio2 pab1<pds2`
};

/* ---------------- descripciones: salen de los efectos ---------------- */
// Las cifras de cada nodo se escriben solas a partir de sus efectos, así el texto nunca dice algo distinto
// de lo que da. Los nodos solo llevan texto propio para lo que no es una cifra (ver «texto» en el contenido).
const dec = v => String(Math.round(v * 10) / 10).replace('.', ',');
const pc = v => dec(v * 100) + '%';
const times = v => '×' + String(+(+v).toFixed(2)).replace('.', ',');
const TEXT = {
  food: v => `+${pc(v)} de comida por viaje`, foodX: v => `comida por viaje ${times(v)}`,
  speed: v => `+${pc(v)} de velocidad`,
  dmg: v => `+${pc(v)} de daño`, dmgX: v => `daño ${times(v)}`,
  hp: v => `+${pc(v)} de vida`, hpX: v => `vida ${times(v)}`,
  growth: v => `+${pc(v)} de velocidad de cría`, growthX: v => `la cría crece ${times(v)} más rápido`,
  eggCostX: v => `cada huevo cuesta un ${pc(1 - v)} menos de comida`,
  curve: v => `los huevos se encarecen más despacio (−${dec(v * 100)} puntos por hormiga)`,
  reserve: v => `la reina produce +${pc(v)} por su cuenta`,
  prize: v => `+${pc(v)} de jalea al ganar una noche`,
  bioKill: v => `+${dec(v)} de biomasa por enemigo`,
  click: v => `+${pc(v)} de efecto de tus toques`, clickX: v => `tus toques ${times(v)}`,
  tapQ: v => `tocar a la reina rinde +${pc(v)}`, tapB: v => `tocar huevos y larvas rinde +${pc(v)}`,
  tapFoe: v => `tocar enemigos hace +${pc(v)} de daño`,
  tapCrit: v => `+${pc(v)} de probabilidad de toque de suerte`, luck: v => `+${pc(v)} de probabilidad de entrega ×2`,
  shiny: v => `+${pc(v)} de hormigas doradas`, goldFood: v => `+${pc(v)} de comida dorada (×5)`,
  feast: v => `+${pc(v)} de probabilidad de festín (entrega ×50)`,
  ghost: v => `la mano fantasma da +${dec(v * 60)} toques por minuto`, ghostX: v => `la mano fantasma toca un ${pc(v - 1)} más rápido`,
  twin: v => `+${pc(v)} de huevos con gemelas`, extraEgg: v => `+${pc(v)} de probabilidad de un huevo extra gratis`,
  freeEgg: v => `+${pc(v)} de huevos que no encarecen el siguiente`, instaHatch: v => `+${pc(v)} de huevos que se saltan la fase de larva`,
  dodge: v => `+${pc(v)} de probabilidad de esquivar un golpe mortal`,
  farm: v => `produce jalea sola: ${pc(v)} del premio de una noche por minuto`,
  qJelly: v => `la reina genera ${dec(v)} de jalea por segundo (y eso también la hace crecer)`, qJellyP: v => `la jalea que genera la reina +${pc(v)}`,
  comboStep: v => `cada toque de la racha rinde +${pc(v)} más`, comboCap: v => `la racha llega a ${v} toques más`,
  comboGap: v => `${dec(v)} s más entre toques sin perder la racha`, comboX: v => `el extra de la racha ${times(v)}`,
  comboEarly: v => `las marcas de la racha llegan un ${pc(v)} antes`, comboKeep: v => `al perder la racha conservas un ${pc(v)} de la cuenta`,
  tapRate: v => `cada toque a la reina suma un ${pc(v)} de lo que recolecta la colonia por segundo`,
  tapSplash: v => `tocar un huevo o una larva adelanta también al resto de la cría un ${pc(v)} de ese toque`,
  stompHits: v => `tus hormigas titán aguantan ${v === 1 ? 'un pisotón humano' : v + ' pisotones humanos'} más`,
  startAnts: v => `cada colonia empieza con ${v} hormigas más`, startJelly: v => `cada colonia empieza con ${v} de jalea más`,
  startBio: v => `cada colonia empieza con ${v} de biomasa`, startEggs: v => `cada colonia empieza con ${v} huevos puestos`,
  keepJelly: v => `la colonia nueva empieza con el ${pc(v)} de la jalea que reunió la anterior`,
  discount: v => `el árbol de la colonia cuesta un ${pc(v)} menos`,
  cutMax: v => `«Toque menguante» puede rebajar cada huevo un ${pc(v)} más de su precio`,
  lives: v => `la reina resiste ${v === 1 ? 'un asalto más' : v + ' asaltos más'} en cada colonia`
};
/** Texto de las cifras de unos efectos («+15% de daño y +15% de vida»). */
export function describe(fx) {
  const parts = Object.keys(fx).filter(k => TEXT[k]).map(k => TEXT[k](fx[k]));
  if (!parts.length) return '';
  const s = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1] : parts[0];
  return s[0].toUpperCase() + s.slice(1);
}

/* ---------------- anillo exterior: mejoras pequeñas en serie ---------------- */
/**
 * Familias: nombre → [icono, efecto, valor, extra?]. Cada nodo de la serie se llama «nombre + número romano».
 * Los valores son los que se aplican de verdad. En el árbol de la colonia, las estadísticas que suman
 * (comida, daño, vida…) crecen con el nivel del nodo: un 15% más por cada nivel por encima del 9.
 */
const FAM = {
  skills: {
    'Calor suave': ['flame', 'growth', 0.15], 'Cáscara fina': ['egg', 'eggCostX', 0.97],
    'Reserva templada': ['crown', 'reserve', 0.4], 'Granja de hongos': ['seed', 'farm', 0.06],
    'Buche ancho': ['leaf', 'food', 0.2], 'Paso firme': ['boot', 'speed', 0.06],
    'Pulgones': ['clover', 'farm', 0.06], 'Botín': ['coin', 'prize', 0.2],
    'Colmillo': ['sword', 'dmg', 0.2], 'Quitina': ['shield', 'hp', 0.2],
    'Reflejos': ['shield', 'dodge', 0.015], 'Rapiña': ['seed', 'bioKill', 0.4],
    'Caricia suave': ['hand', 'click', 0.06], 'Mano errante': ['ghost', 'ghost', 0.01],
    'Compás': ['bolt', 'comboStep', 0.003, { reqPerk: 'ptp' }], 'Fortuna': ['star', 'tapCrit', 0.01]
  },
  perm: {
    'Linaje fértil': ['flame', 'growth', 0.15], 'Reserva ancestral': ['crown', 'reserve', 0.4],
    'Hongo ancestral': ['seed', 'farm', 0.1],
    'Memoria': ['leaf', 'food', 0.15], 'Senda': ['boot', 'speed', 0.05],
    'Rebaño de pulgones': ['clover', 'farm', 0.1],
    'Furia': ['sword', 'dmg', 0.1], 'Coraza': ['shield', 'hp', 0.1],
    'Mano heredada': ['ghost', 'ghost', 0.01], 'Toque heredado': ['hand', 'click', 0.05],
    'Ritmo ancestral': ['bolt', 'comboStep', 0.004], 'Reclutas': ['ant', 'startAnts', 1]
  }
};
/** En el árbol de la colonia, estas crecen con el nivel del nodo del anillo. */
const SCALE = new Set(['food', 'speed', 'dmg', 'hp', 'growth', 'reserve', 'prize']);
/** Nodos clave (rombo, con biomasa) que cierran las series del anillo exterior de la colonia. */
const KEYS = { brood: ['Nido ancestral', 'flame', 'growthX', 1.2], food: ['Sendero real', 'leaf', 'foodX', 1.25],
  war: ['Legión', 'fist', 'dmgX', 1.2], tap: ['Manos rápidas', 'ghost', 'ghostX', 1.08] };

/**
 * Series del anillo: [rama, nodo del que sale, tramos [familia, desde, hasta], cierra con clave?].
 * Salen del borde de su rama y se alargan hacia fuera.
 */
const RING = {
  skills: [
    ['food', 'f1d', [['Buche ancho', 1, 7]], 1], ['food', 'f9', [['Buche ancho', 8, 14]], 1], ['food', 'f4c', [['Buche ancho', 15, 21]], 1],
    ['food', 'f2c', [['Pulgones', 1, 7]], 1], ['food', 'f3d', [['Pulgones', 8, 14]], 1], ['food', 'f8c', [['Paso firme', 1, 6]], 1],
    ['food', 'f6c', [['Paso firme', 7, 11]], 1], ['food', 'fsK', [['Botín', 1, 7]], 1],
    ['war', 'w1d', [['Colmillo', 1, 7]], 1], ['war', 'w4c', [['Colmillo', 8, 14]], 1], ['war', 'w9', [['Colmillo', 15, 21]], 1],
    ['war', 'w2c', [['Colmillo', 22, 28]], 1], ['war', 'w7b', [['Colmillo', 29, 34]], 1], ['war', 'w6d', [['Quitina', 1, 6]], 1],
    ['war', 'w8b', [['Quitina', 7, 12]], 1], ['war', 'w5c', [['Quitina', 13, 18]], 1], ['war', 'w9', [['Quitina', 19, 23]], 1],
    ['war', 'w5b', [['Reflejos', 1, 3]], 1], ['war', 'w3c', [['Rapiña', 1, 7]], 1],
    ['tap', 't9', [['Caricia suave', 1, 4]], 1], ['tap', 't8c', [['Caricia suave', 5, 8]], 1], ['tap', 'tnK', [['Caricia suave', 9, 12]], 1],
    ['tap', 't1c', [['Mano errante', 1, 7]], 1], ['tap', 't5c', [['Fortuna', 1, 3]], 0], ['tap', 'cbK', [['Compás', 1, 6]], 0],
    ['brood', 'b2d', [['Cáscara fina', 1, 9]], 1], ['brood', 'b1d', [['Reserva templada', 1, 6]], 1],
    ['brood', 'b3d', [['Calor suave', 1, 5], ['Granja de hongos', 1, 2]], 1]
  ],
  perm: [
    ['brood', 'plb3', [['Linaje fértil', 1, 5]]], ['brood', 'pcv', [['Reserva ancestral', 1, 4]]],
    ['tap', 'plt3', [['Toque heredado', 1, 4]]], ['tap', 'pgh3', [['Mano heredada', 1, 3]]], ['tap', 'pcb3', [['Ritmo ancestral', 1, 3]]],
    ['food', 'pf4', [['Memoria', 1, 5]]], ['food', 'plf2', [['Memoria', 6, 9]]], ['food', 'psp', [['Senda', 1, 2], ['Rebaño de pulgones', 1, 3]]],
    ['food', 'pns', [['Hongo ancestral', 1, 6]]],
    ['war', 'pd4', [['Furia', 1, 6]]], ['war', 'ph4', [['Coraza', 1, 6]]],
    ['found', 'ps4', [['Reclutas', 1, 6]]]
  ]
};

const toRoman = n => { let r = ''; for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { r += s; n -= v; } return r; };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
const curOf = c => typeof c === 'number' ? 'jelly' : c.bio != null ? 'bio' : 'adn';
const amountOf = c => typeof c === 'number' ? c : c.bio ?? c.adn;

/** Lee 'hijo<padre1,padre2 …' de cada rama: { id: { cat, parents } }. */
function parseGraph(G) {
  const out = {};
  for (const cat in G) for (const tok of G[cat].trim().split(/\s+/)) {
    const [id, ps] = tok.split('<');
    out[id] = { cat, parents: ps.split(',') };
  }
  return out;
}

/** Lo más caro que hay que haber comprado antes de un nodo, por moneda (para que el precio nunca baje). */
function maxBefore(C, E, id, memo = {}) {
  if (memo[id]) return memo[id];
  const m = { jelly: 0, bio: 0, adn: 0 };
  for (const p of (E[id] && E[id].parents) || []) {
    if (p === 'root') continue;
    const pm = maxBefore(C, E, p, memo), c = C[p][3];
    for (const k in m) m[k] = Math.max(m[k], pm[k]);
    m[curOf(c)] = Math.max(m[curOf(c)], amountOf(c));
  }
  return (memo[id] = m);
}

/**
 * Añade al contenido (C) y al grafo (E) las series del anillo exterior de un árbol.
 *   Colonia: nivel de jalea = el más caro de lo que va antes (mínimo 9), +1 cada dos nodos; claves con biomasa.
 *   Linaje: ADN = lo más caro de lo que va antes (mínimo 14), +3 por nodo.
 */
function addRing(tree, C, E) {
  const pre = tree === 'perm' ? 'y' : 'x', fam = FAM[tree], keyN = {};
  for (const [cat, from, segs, key] of RING[tree]) {
    const before = maxBefore(C, E, from), own = C[from][3];
    const top = { ...before, [curOf(own)]: Math.max(before[curOf(own)], amountOf(own)) };
    let prev = from, k = 0;
    for (const [name, a, b] of segs) {
      const [icon, eff, v0, extra] = fam[name];
      for (let n = a; n <= b; n++, k++) {
        const id = pre + cat[0] + slug(name) + n;
        const cost = tree === 'perm' ? { adn: Math.max(14, top.adn) + 3 * (k + 1) } : Math.min(18, Math.max(9, top.jelly) + Math.floor(k / 2));
        const v = tree === 'skills' && SCALE.has(eff) ? Math.round(v0 * (1 + 0.15 * (cost - 9)) * 100) / 100 : v0;
        C[id] = [icon, name + ' ' + toRoman(n), null, cost, { [eff]: v }, extra];
        E[id] = { cat, parents: [prev] };
        prev = id;
      }
    }
    if (key) {
      const i = (keyN[cat] = (keyN[cat] || 0) + 1), [name, icon, eff, v] = KEYS[cat], id = pre + cat[0] + 'K' + i;
      C[id] = [icon, name + ' ' + toRoman(i), null, { bio: Math.max(50 + 10 * (i - 1), top.bio + 10) }, { [eff]: v }, { key: 1 }];
      E[id] = { cat, parents: [prev] };
    }
  }
}

/** Nombre de cada lado de los árboles y qué hay en él (se ven en modo debug). */
export const ZONES = {
  skills: { food: ['Recolección', 'comida y jalea'], war: ['Guerra', 'daño y vida'], tap: ['Toques', 'tus toques y la mano fantasma'], brood: ['Cría', 'huevos, larvas y doradas'] },
  perm: { brood: ['Reina', 'huevos y cría'], tap: ['Toques', 'toques, racha y manos'], food: ['Recolección', 'comida, jalea y festín'],
    war: ['Guerra', 'daño, vida y humanos'], found: ['Fundación', 'con qué empieza cada colonia'] }
};

/**
 * Monta un árbol: contenido + grafo + posiciones (treeLayout.js, que genera tools/layout-trees.mjs).
 * links = padres (todos hacen falta); adj = padres e hijos (para ver hasta dónde llega la niebla).
 * Un nodo sin posición se marca `unplaced` (tools/check-trees.mjs avisa: hay que volver a colocar).
 */
function build(tree, root, C, E) {
  const pos = LAYOUT[tree] || {};
  const N = { root: { id: 'root', x: 0, y: 0, cat: 'root', icon: root[0], name: root[1], desc: root[2], cost: 0, fx: {}, links: [], key: false, adj: new Set(), reqPerk: null, own: null } };
  for (const id in E) {
    const c = C[id];
    if (!c) throw new Error('Nodo sin contenido: ' + id);
    const [icon, name, text, cost, fx, extra = {}] = c, p = pos[id];
    N[id] = { id, x: p ? p[0] : 0, y: p ? p[1] : 0, unplaced: !p, cat: E[id].cat, icon, name, desc: [text, describe(fx)].filter(Boolean).join('. '), cost, fx,
      links: E[id].parents, key: !!extra.key, adj: new Set(E[id].parents), reqPerk: extra.reqPerk || null, own: extra.own || null };
  }
  for (const id in C) if (!N[id]) throw new Error('Nodo sin sitio en el árbol: ' + id);
  for (const id in N) for (const p of N[id].links) { if (!N[p]) throw new Error(`${id} depende de ${p}, que no existe`); N[p].adj.add(id); }
  // coordenadas desde 0
  let mx = Infinity, my = Infinity;
  for (const id in N) { mx = Math.min(mx, N[id].x); my = Math.min(my, N[id].y); }
  for (const id in N) { N[id].x -= mx; N[id].y -= my; }
  return N;
}

const SE = parseGraph(SG), PE = parseGraph(PG);
addRing('skills', SN, SE);
addRing('perm', PN, PE);
/** El grafo sin posiciones, para colocar los nodos (tools/layout-trees.mjs). */
export const GRAPHS = { skills: SE, perm: PE };
export const SKILLS = build('skills', ['crown', 'La reina', 'El corazón de la colonia. Todo crece desde aquí.'], SN, SE);
export const PERKS = build('perm', ['dna', 'Linaje', 'Lo que aprende cada reina pasa a sus hijas.'], PN, PE);

/** Suma los efectos de los nodos comprados: X multiplica, el resto suma. */
export function treeFx(nodes, owned) {
  const out = {};
  for (const id in owned) {
    const n = nodes[id];
    if (!owned[id] || !n) continue;
    for (const k in n.fx) out[k] = k.endsWith('X') ? (out[k] ?? 1) * n.fx[k] : (out[k] || 0) + n.fx[k];
  }
  return out;
}

/** Lo que el linaje deja ya puesto en el árbol: own = comprado de verdad (efecto activo, sin pagar bio). */
export function linajeSkills(perm) {
  const own = {};
  if (!perm) return { own };
  for (const id in perm) {
    if (!perm[id]) continue;
    const n = PERKS[id];
    if (n && n.own) for (const s of n.own) own[s] = true;
  }
  return { own };
}

/**
 * Estado de cada nodo:
 *   owned  comprado (o dado por el linaje)
 *   open   se puede comprar: tienes todos sus padres (y lo que pida del linaje)
 *   seen   se ve qué es, pero aún le falta algo (algún padre o algo del linaje)
 *   fog    se ve que hay algo («?») · hidden: todavía no se ve
 * La niebla se mide por pasos (padres e hijos) desde lo comprado: 1–2 seen, 3 fog.
 */
const NAMES = ['owned', 'seen', 'seen', 'fog'];
export function treeStates(nodes, owned, perm) {
  const lin = nodes === SKILLS ? linajeSkills(perm) : { own: {} }, has = id => id === 'root' || !!owned[id] || !!lin.own[id];
  const dist = {}, q = [];
  for (const id in nodes) if (has(id)) { dist[id] = 0; q.push(id); }
  while (q.length) {
    const id = q.shift();
    if (dist[id] >= 3) continue;
    for (const a of nodes[id].adj) if (dist[a] == null) { dist[a] = dist[id] + 1; q.push(a); }
  }
  const out = {};
  for (const id in nodes) {
    const n = nodes[id];
    if (has(id)) { out[id] = 'owned'; continue; }
    const ready = n.links.every(has) && !(n.reqPerk && !(perm && perm[n.reqPerk]));
    out[id] = ready ? 'open' : NAMES[dist[id]] || 'hidden';
  }
  return out;
}

/** Los padres que aún faltan para poder comprar un nodo (ids). */
export function missingParents(nodes, owned, perm, id) {
  const lin = nodes === SKILLS ? linajeSkills(perm) : { own: {} };
  return nodes[id].links.filter(p => p !== 'root' && !owned[p] && !lin.own[p]);
}
