// Los dos árboles del juego, como grafos (estilo «Bills, Bills, Bills»):
//   SKILLS: árbol de la colonia. Se paga con jalea (nodos normales) y biomasa (nodos clave, en rombo).
//           Se pierde al morir la reina o al fundar una colonia nueva.
//   PERKS:  árbol de linaje. Se paga con ADN y es permanente entre colonias.
// Un nodo se puede comprar si está conectado a otro ya comprado. Empiezas desde la raíz.
// Además, una mejora («… II», «Mano veloz»…) exige tener antes lo que mejora (ver needs).
// El precio sube con cada nodo que compras (ver nodeCost en rules.js).
//
// Fila: [id, x, y, categoría, icono, nombre, descripción, coste, efectos, enlaces, clave?]
//   coste: número de nivel (tier) para la jalea, o { bio: n } / { adn: n }
//   efectos: claves que terminan en X multiplican; el resto suman (ver calc en rules.js)

const S = [
  ['root', 6, 4, 'root', 'crown', 'La reina', 'El corazón de la colonia. Todo crece desde aquí.', 0, {}, []],
  // ---- Cría (arriba a la izquierda)
  ['br1', 5, 3, 'brood', 'egg', 'Huevos baratos I', 'Cada huevo cuesta un 7% menos de comida', 1, { eggCostX: 0.93 }, ['root']],
  ['br2', 4, 3, 'brood', 'flame', 'Calor del nido I', '+20% de velocidad de huevos y larvas', 1, { growth: 0.2 }, ['br1']],
  ['br3', 5, 2, 'brood', 'crown', 'Reserva real I', 'La reina produce +60% por su cuenta', 2, { reserve: 0.6 }, ['br1']],
  ['br4', 3, 3, 'brood', 'flame', 'Calor del nido II', '+20% de velocidad de cría', 2, { growth: 0.2 }, ['br2']],
  ['br5', 4, 2, 'brood', 'egg', 'Huevos baratos II', 'Cada huevo cuesta un 7% menos de comida', 3, { eggCostX: 0.93 }, ['br2', 'br3']],
  ['br6', 5, 1, 'brood', 'egg', 'Metabolismo real', 'Cada huevo cuesta un 8% menos de comida', 4, { eggCostX: 0.92 }, ['br3']],
  ['brK1', 3, 2, 'brood', 'flame', 'Nodrizas', 'La cría crece un 50% más rápido', { bio: 3 }, { growthX: 1.5 }, ['br4', 'br5'], 1],
  ['br7', 2, 2, 'brood', 'flame', 'Calor del nido III', '+25% de velocidad de cría', 5, { growth: 0.25 }, ['brK1']],
  ['br8', 4, 1, 'brood', 'egg', 'Huevos baratos III', 'Cada huevo cuesta un 8% menos de comida', 5, { eggCostX: 0.92 }, ['br5', 'br6']],
  ['brK2', 3, 1, 'brood', 'eggs2', 'Puesta doble', 'Uno de cada cuatro huevos trae gemelas', { bio: 8 }, { twin: 0.25 }, ['br8', 'brK1'], 1],
  ['br9', 2, 3, 'brood', 'egg', 'Huevera', 'Cada huevo cuesta un 10% menos de comida', 4, { eggCostX: 0.9 }, ['br4']],
  ['brK3', 4, 0, 'brood', 'crown', 'Reina eficiente', 'Los huevos se encarecen más despacio', { bio: 14 }, { curve: 0.025 }, ['br8'], 1],
  ['brK4', 3, 0, 'brood', 'crown', 'Reina prolífica', 'Los huevos se encarecen aún más despacio', { bio: 30 }, { curve: 0.025 }, ['brK3', 'brK2'], 1],
  ['br10', 5, 0, 'brood', 'crown', 'Reserva real II', 'La reina produce el doble por su cuenta', 6, { reserve: 1 }, ['br6']],
  ['br11', 1, 2, 'brood', 'flame', 'Calor del nido IV', '+30% de velocidad de cría', 7, { growth: 0.3 }, ['br7']],
  ['br12', 2, 1, 'brood', 'egg', 'Huevos baratos IV', 'Cada huevo cuesta un 10% menos de comida', 7, { eggCostX: 0.9 }, ['brK2', 'br7']],
  // ---- Recolección (arriba a la derecha)
  ['fo1', 7, 3, 'food', 'leaf', 'Buche grande I', '+25% de comida por viaje', 1, { food: 0.25 }, ['root']],
  ['fo2', 8, 3, 'food', 'boot', 'Patas ágiles I', '+10% de velocidad', 1, { speed: 0.1 }, ['fo1']],
  ['fo3', 7, 2, 'food', 'leaf', 'Buche grande II', '+25% de comida por viaje', 2, { food: 0.25 }, ['fo1']],
  ['fo4', 9, 3, 'food', 'boot', 'Patas ágiles II', '+10% de velocidad', 3, { speed: 0.1 }, ['fo2']],
  ['fo5', 8, 2, 'food', 'leaf', 'Buche grande III', '+30% de comida por viaje', 3, { food: 0.3 }, ['fo2', 'fo3']],
  ['foK1', 8, 1, 'food', 'leaf', 'Rastro de feromonas', 'Comida por viaje ×1,5', { bio: 3 }, { foodX: 1.5 }, ['fo5'], 1],
  ['fo6', 7, 1, 'food', 'leaf', 'Hojas grandes', '+35% de comida por viaje', 4, { food: 0.35 }, ['fo3']],
  ['fo7', 9, 2, 'food', 'boot', 'Patas ágiles III', '+12% de velocidad', 4, { speed: 0.12 }, ['fo4', 'fo5']],
  ['foK2', 10, 2, 'food', 'leaf', 'Doble carga', 'Comida por viaje ×2', { bio: 8 }, { foodX: 2 }, ['fo7'], 1],
  ['fo8', 9, 1, 'food', 'leaf', 'Buche grande IV', '+40% de comida por viaje', 6, { food: 0.4 }, ['foK1', 'fo7']],
  ['foK3', 9, 0, 'food', 'moon', 'Rutas nocturnas', 'Por la noche siguen entrando provisiones', { bio: 14 }, { nightWork: 1 }, ['fo8'], 1],
  ['fo9', 10, 1, 'food', 'boot', 'Patas ágiles IV', '+15% de velocidad', 6, { speed: 0.15 }, ['foK2']],
  ['foK4', 11, 1, 'food', 'leaf', 'Cosecha masiva', 'Comida por viaje ×2', { bio: 30 }, { foodX: 2 }, ['fo9'], 1],
  ['fo10', 7, 0, 'food', 'leaf', 'Buche grande V', '+50% de comida por viaje', 7, { food: 0.5 }, ['fo6']],
  ['fo11', 10, 3, 'food', 'coin', 'Botín nocturno', '+50% de jalea al ganar una noche', 3, { prize: 0.5 }, ['fo4']],
  ['fo12', 8, 0, 'food', 'leaf', 'Despensa', '+30% de comida y la reina produce +50%', 6, { food: 0.3, reserve: 0.5 }, ['foK1', 'fo10']],
  // ---- Guerra (abajo a la derecha)
  ['wa1', 7, 5, 'war', 'sword', 'Mandíbulas I', '+25% de daño', 1, { dmg: 0.25 }, ['root']],
  ['wa2', 8, 5, 'war', 'shield', 'Caparazón I', '+25% de vida', 1, { hp: 0.25 }, ['wa1']],
  ['wa3', 7, 6, 'war', 'sword', 'Mandíbulas II', '+25% de daño', 2, { dmg: 0.25 }, ['wa1']],
  ['wa4', 9, 5, 'war', 'shield', 'Caparazón II', '+25% de vida', 3, { hp: 0.25 }, ['wa2']],
  ['wa5', 8, 6, 'war', 'sword', 'Mandíbulas III', '+30% de daño', 3, { dmg: 0.3 }, ['wa2', 'wa3']],
  ['waK1', 8, 7, 'war', 'sword', 'Mandíbulas afiladas', 'Daño ×1,5', { bio: 3 }, { dmgX: 1.5 }, ['wa5'], 1],
  ['waK2', 10, 5, 'war', 'shield', 'Quitina gruesa', 'Vida ×1,5', { bio: 6 }, { hpX: 1.5 }, ['wa4'], 1],
  ['wa6', 9, 6, 'war', 'shield', 'Caparazón III', '+30% de vida', 4, { hp: 0.3 }, ['wa4', 'wa5']],
  ['wa7', 7, 7, 'war', 'seed', 'Saqueo', '+1 biomasa por enemigo', 4, { bioKill: 1 }, ['wa3']],
  ['waK3', 9, 7, 'war', 'fist', 'Mandíbula reforzada', 'Mutación: daño ×2 y mandíbulas enormes', { bio: 14 }, { dmgX: 2, jaw: 1 }, ['waK1', 'wa6'], 1],
  ['wa8', 10, 6, 'war', 'shield', 'Caparazón IV', '+40% de vida', 6, { hp: 0.4 }, ['waK2', 'wa6']],
  ['waK4', 10, 7, 'war', 'fist', 'Furia de la colonia', 'Daño ×1,4', { bio: 30 }, { dmgX: 1.4 }, ['waK3', 'wa8'], 1],
  ['wa9', 11, 6, 'war', 'coin', 'Botín de guerra', '+50% de jalea al ganar una noche', 6, { prize: 0.5 }, ['wa8']],
  ['wa10', 7, 8, 'war', 'sword', 'Mandíbulas IV', '+40% de daño', 6, { dmg: 0.4 }, ['wa7']],
  ['wa11', 8, 8, 'war', 'sword', 'Mandíbulas V', '+50% de daño', 8, { dmg: 0.5 }, ['wa10', 'waK1']],
  ['wa12', 11, 5, 'war', 'shield', 'Caparazón V', '+50% de vida', 8, { hp: 0.5 }, ['waK2']],
  // ---- Toques (abajo a la izquierda)
  ['ta1', 5, 5, 'tap', 'hand', 'Caricia I', '+30% de efecto de tus toques', 1, { click: 0.3 }, ['root']],
  ['ta2', 4, 5, 'tap', 'crown', 'Masaje real', 'Tocar a la reina rinde +50%', 1, { tapQ: 0.5 }, ['ta1']],
  ['ta3', 5, 6, 'tap', 'larva', 'Mimo a la cría', 'Tocar huevos y larvas rinde +50%', 2, { tapB: 0.5 }, ['ta1']],
  ['ta4', 3, 5, 'tap', 'hand', 'Caricia II', '+40% de efecto de tus toques', 3, { click: 0.4 }, ['ta2']],
  ['ta5', 4, 6, 'tap', 'bolt', 'Golpe certero', 'Tocar enemigos hace el doble', 3, { tapFoe: 1 }, ['ta2', 'ta3']],
  ['taK1', 3, 6, 'tap', 'hand', 'Manos de reina', 'Tus toques ×2', { bio: 4 }, { clickX: 2 }, ['ta4', 'ta5'], 1],
  ['ta6', 5, 7, 'tap', 'larva', 'Mimo a la cría II', 'Tocar huevos y larvas rinde +50%', 4, { tapB: 0.5 }, ['ta3']],
  ['ta7', 2, 5, 'tap', 'hand', 'Caricia III', '+50% de efecto de tus toques', 5, { click: 0.5 }, ['ta4']],
  ['ta8', 4, 7, 'tap', 'bolt', 'Golpe certero II', 'Tocar enemigos hace el doble', 5, { tapFoe: 1 }, ['ta5', 'ta6']],
  ['taK2', 3, 7, 'tap', 'coin', 'Toque dorado', 'Tocar a la reina también da jalea', { bio: 10 }, { gold: 1 }, ['taK1', 'ta8'], 1],
  ['ta9', 2, 6, 'tap', 'hand', 'Caricia IV', '+60% de efecto de tus toques', 7, { click: 0.6 }, ['taK1', 'ta7']],
  ['ta10', 5, 8, 'tap', 'flame', 'Incubadora', '+20% de velocidad de cría', 6, { growth: 0.2 }, ['ta6']],
  ['ta11', 4, 8, 'tap', 'bolt', 'Golpe certero III', 'Tocar enemigos ×2,5', 7, { tapFoe: 1.5 }, ['ta8']],
  // ---- Suerte: toques de suerte, cosechas dobles y hormigas doradas
  ['lk1', 1, 5, 'tap', 'star', 'Toque de suerte I', '5% de probabilidad de que un toque valga ×2', 3, { tapCrit: 0.05 }, ['ta7']],
  ['lk2', 1, 6, 'tap', 'star', 'Toque de suerte II', '+10% de probabilidad de toque ×2', 5, { tapCrit: 0.1 }, ['lk1', 'ta9']],
  ['lkK', 2, 7, 'tap', 'star', 'Golpe de fortuna', 'Los toques de suerte valen ×5 en vez de ×2', { bio: 12 }, { critBig: 1 }, ['lk2', 'taK2'], 1],
  ['lc1', 11, 3, 'food', 'clover', 'Cosecha afortunada I', '8% de probabilidad de que una entrega valga ×2', 3, { luck: 0.08 }, ['fo11']],
  ['lc2', 11, 2, 'food', 'clover', 'Cosecha afortunada II', '+12% de probabilidad de entrega ×2', 5, { luck: 0.12 }, ['lc1', 'foK2']],
  ['sh1', 1, 1, 'brood', 'sparkle', 'Hormigas doradas', '3% de las que nacen son doradas: ×3 comida y ×2 daño', 5, { shiny: 0.03 }, ['br11', 'br12']],
  ['shK', 1, 0, 'brood', 'sparkle', 'Linaje dorado', '+7% de hormigas doradas', { bio: 16 }, { shiny: 0.07 }, ['sh1'], 1],
  ['sh2', 2, 0, 'brood', 'sparkle', 'Brillo real', '+5% de hormigas doradas', 7, { shiny: 0.05 }, ['shK', 'brK4']],
  // ---- Mano fantasma, comida dorada y doradas de élite
  ['ghK', 3, 8, 'tap', 'ghost', 'Mano fantasma', 'Una mano invisible da de comer a la reina sola (1 toque cada 8 s)', { bio: 5 }, { ghost: 0.125 }, ['ta11', 'lkK'], 1],
  ['gh2', 2, 8, 'tap', 'ghost', 'Mano veloz', 'La mano fantasma toca un 50% más rápido', 6, { ghostX: 1.5 }, ['ghK']],
  ['gh3', 1, 7, 'tap', 'ghost', 'Mano experta', 'La mano fantasma toca un 40% más rápido', 8, { ghostX: 1.4 }, ['gh2', 'lk2']],
  ['gf1', 10, 0, 'food', 'goldleaf', 'Comida dorada', '3% de las entregas son comida dorada: ×5', 6, { goldFood: 0.03 }, ['fo9']],
  ['gf2', 11, 0, 'food', 'goldleaf', 'Néctar real', '+4% de comida dorada', 8, { goldFood: 0.04 }, ['gf1', 'foK4']],
  ['sh3', 0, 1, 'brood', 'sparkle', 'Doradas de élite', 'Las doradas traen ×5 comida y pegan ×3', { bio: 20 }, { shinyElite: 1 }, ['sh1'], 1],
  // ---- Puentes entre ramas
  ['mx1', 6, 2, 'brood', 'leaf', 'Despensa común', '+15% de comida y la reina produce +25%', 3, { food: 0.15, reserve: 0.25 }, ['br3', 'fo3']],
  ['mx2', 6, 6, 'war', 'shield', 'Guardia del nido', '+15% de daño y de vida', 3, { dmg: 0.15, hp: 0.15 }, ['ta3', 'wa3']],
  ['mx3', 6, 7, 'war', 'flame', 'Nido templado', '+15% de cría y +10% de vida', 5, { growth: 0.15, hp: 0.1 }, ['mx2']],
  // ---- Más habilidades
  ['br13', 0, 2, 'brood', 'eggs2', 'Huevo de regalo', '5% de probabilidad de que la reina ponga un huevo extra gratis', 6, { extraEgg: 0.05 }, ['br11']],
  ['brK5', 0, 3, 'brood', 'egg', 'Puesta sin precio', '10% de probabilidad de que un huevo no encarezca el siguiente', { bio: 18 }, { freeEgg: 0.1 }, ['br13'], 1],
  ['lk3', 0, 6, 'tap', 'star', 'Toque de suerte III', '+10% de probabilidad de toque de suerte', 8, { tapCrit: 0.1 }, ['lk2']],
  ['fo13', 12, 1, 'food', 'boot', 'Exploradoras', '+20% de comida y +10% de velocidad', 8, { food: 0.2, speed: 0.1 }, ['foK4']],
  ['wa13', 11, 7, 'war', 'shield', 'Veteranas', '10% de probabilidad de esquivar un golpe mortal', 7, { dodge: 0.1 }, ['waK4']],
  ['wa14', 12, 7, 'war', 'shield', 'Veteranas II', '+10% de probabilidad de esquivar', 8, { dodge: 0.1 }, ['wa13', 'wa9']]
];

/*
 * Ampliación del árbol de la colonia: los nodos de arriba se desplazan (OX, OY) hacia el centro
 * y alrededor crece un anillo exterior por rama. Cada cadena sale de un nodo existente (ancla)
 * y avanza celda a celda; el primero se une al ancla y cada uno al anterior.
 * Elemento: [id, icono, nombre, descripción, nivel o { bio }, efectos, clave?]
 */
const OX = 4, OY = 4;
function chain(cat, anchor, cells, items) {
  return items.map(([id, icon, name, desc, cost, fx, key], i) => [id, cells[i][0], cells[i][1], cat, icon, name, desc, cost, fx, [i ? items[i - 1][0] : anchor], key ? 1 : 0]);
}
const S2 = [
  // ---- Cría (arriba a la izquierda)
  ...chain('brood', 'br10', [[9, 3], [9, 2], [9, 1], [9, 0]], [
    ['b1a', 'crown', 'Reserva real III', 'La reina produce +100% por su cuenta', 8, { reserve: 1 }],
    ['b1b', 'crown', 'Reserva real IV', 'La reina produce +150% por su cuenta', 9, { reserve: 1.5 }],
    ['b1c', 'crown', 'Reserva real V', 'La reina produce +200% por su cuenta', 11, { reserve: 2 }],
    ['b1d', 'crown', 'Reina inagotable', 'La reina produce +400% por su cuenta', { bio: 70 }, { reserve: 4 }, 1]]),
  ...chain('brood', 'brK3', [[8, 3], [8, 2], [8, 1], [8, 0]], [
    ['b2a', 'egg', 'Huevos baratos V', 'Cada huevo cuesta un 7% menos', 8, { eggCostX: 0.93 }],
    ['b2b', 'egg', 'Huevos baratos VI', 'Cada huevo cuesta un 7% menos', 9, { eggCostX: 0.93 }],
    ['b2c', 'egg', 'Huevos baratos VII', 'Cada huevo cuesta un 8% menos', 11, { eggCostX: 0.92 }],
    ['b2d', 'egg', 'Huevos baratos VIII', 'Cada huevo cuesta un 8% menos', 12, { eggCostX: 0.92 }]]),
  ...chain('brood', 'brK4', [[7, 3], [7, 2], [7, 1], [7, 0]], [
    ['b3a', 'crown', 'Reina dinástica', 'Los huevos se encarecen todavía más despacio', { bio: 45 }, { curve: 0.02 }, 1],
    ['b3b', 'flame', 'Calor del nido V', '+30% de velocidad de cría', 9, { growth: 0.3 }],
    ['b3c', 'flame', 'Calor del nido VI', '+35% de velocidad de cría', 10, { growth: 0.35 }],
    ['b3d', 'flame', 'Incubadora real', 'La cría crece un 50% más rápido', { bio: 70 }, { growthX: 1.5 }, 1]]),
  ...chain('brood', 'sh2', [[6, 3], [6, 2], [6, 1]], [
    ['b4a', 'sparkle', 'Brillo real II', '+3% de hormigas doradas', 9, { shiny: 0.03 }],
    ['b4b', 'sparkle', 'Brillo real III', '+3% de hormigas doradas', 10, { shiny: 0.03 }],
    ['b4c', 'sparkle', 'Corona dorada', '+5% de hormigas doradas', { bio: 60 }, { shiny: 0.05 }, 1]]),
  ...chain('brood', 'shK', [[5, 3], [5, 2], [5, 1], [5, 0]], [
    ['b5a', 'eggs2', 'Gemelas', 'Un 8% más de huevos traen gemelas', 8, { twin: 0.08 }],
    ['b5b', 'eggs2', 'Gemelas II', 'Un 8% más de huevos traen gemelas', 10, { twin: 0.08 }],
    ['b5c', 'eggs2', 'Camada', 'Un 15% más de huevos traen gemelas', { bio: 55 }, { twin: 0.15 }, 1],
    ['b5d', 'eggs2', 'Gemelas III', 'Un 10% más de huevos traen gemelas', 12, { twin: 0.1 }]]),
  ...chain('brood', 'sh3', [[3, 5], [2, 5], [1, 5]], [
    ['b6a', 'larva', 'Eclosión rápida', '5% de los huevos se saltan la fase de larva', 9, { instaHatch: 0.05 }],
    ['b6b', 'larva', 'Eclosión rápida II', '+5% de huevos sin fase de larva', 11, { instaHatch: 0.05 }],
    ['b6c', 'larva', 'Larvas precoces', '+10% de huevos sin fase de larva', { bio: 50 }, { instaHatch: 0.1 }, 1]]),
  ...chain('brood', 'br13', [[3, 6], [2, 6], [1, 6]], [
    ['b7a', 'eggs2', 'Huevo de regalo II', '+5% de probabilidad de huevo extra gratis', 9, { extraEgg: 0.05 }],
    ['b7b', 'eggs2', 'Huevo de regalo III', '+5% de probabilidad de huevo extra gratis', 11, { extraEgg: 0.05 }],
    ['b7c', 'eggs2', 'Puesta en racimo', '+8% de probabilidad de huevo extra gratis', { bio: 60 }, { extraEgg: 0.08 }, 1]]),
  ...chain('brood', 'brK5', [[3, 7], [2, 7], [1, 7]], [
    ['b8a', 'egg', 'Puesta sin precio II', '+8% de huevos que no encarecen el siguiente', 10, { freeEgg: 0.08 }],
    ['b8b', 'egg', 'Puesta sin precio III', '+8% de huevos que no encarecen el siguiente', 12, { freeEgg: 0.08 }],
    ['b8c', 'egg', 'Cría gratuita', '+10% de huevos que no encarecen el siguiente', { bio: 80 }, { freeEgg: 0.1 }, 1]]),
  ['b9', 0, 6, 'brood', 'crown', 'Matriarca', 'Cada huevo cuesta un 20% menos y la cría crece un 20% más rápido', { bio: 120 }, { eggCostX: 0.8, growthX: 1.2 }, ['b6c', 'b7c', 'b8c'], 1],
  // ---- Recolección (arriba a la derecha)
  ...chain('food', 'fo10', [[11, 3], [11, 2], [11, 1], [11, 0]], [
    ['f1a', 'leaf', 'Buche grande VI', '+50% de comida por viaje', 9, { food: 0.5 }],
    ['f1b', 'leaf', 'Buche grande VII', '+60% de comida por viaje', 10, { food: 0.6 }],
    ['f1c', 'leaf', 'Buche grande VIII', '+70% de comida por viaje', 11, { food: 0.7 }],
    ['f1d', 'leaf', 'Buche sin fondo', 'Comida por viaje ×1,5', { bio: 70 }, { foodX: 1.5 }, 1]]),
  ...chain('food', 'fo12', [[12, 3], [12, 2], [12, 1]], [
    ['f2a', 'leaf', 'Despensa II', '+30% de comida y la reina produce +50%', 9, { food: 0.3, reserve: 0.5 }],
    ['f2b', 'leaf', 'Despensa III', '+40% de comida y la reina produce +60%', 11, { food: 0.4, reserve: 0.6 }],
    ['f2c', 'leaf', 'Granero', 'Comida ×1,3 y la reina produce +100%', { bio: 55 }, { foodX: 1.3, reserve: 1 }, 1]]),
  ...chain('food', 'foK3', [[13, 3], [13, 2], [13, 1], [13, 0]], [
    ['f3a', 'moon', 'Turno de noche', '+50% de jalea al ganar una noche', 9, { prize: 0.5 }],
    ['f3b', 'coin', 'Botín nocturno II', '+50% de jalea al ganar una noche', 10, { prize: 0.5 }],
    ['f3c', 'coin', 'Botín nocturno III', '+60% de jalea al ganar una noche', 11, { prize: 0.6 }],
    ['f3d', 'coin', 'Tesoro de guerra', '+150% de jalea al ganar una noche', { bio: 50 }, { prize: 1.5 }, 1]]),
  ...chain('food', 'gf1', [[14, 3], [14, 2], [14, 1]], [
    ['f4a', 'goldleaf', 'Comida dorada II', '+3% de comida dorada (×5)', 10, { goldFood: 0.03 }],
    ['f4b', 'goldleaf', 'Comida dorada III', '+3% de comida dorada', 12, { goldFood: 0.03 }],
    ['f4c', 'goldleaf', 'Ambrosía', '+5% de comida dorada', { bio: 80 }, { goldFood: 0.05 }, 1]]),
  ...chain('food', 'gf2', [[16, 4], [17, 4], [18, 4]], [
    ['f5a', 'goldleaf', 'Néctar real II', '+3% de comida dorada', 11, { goldFood: 0.03 }],
    ['f5b', 'goldleaf', 'Néctar real III', '+3% de comida dorada', 13, { goldFood: 0.03 }],
    ['f5c', 'goldleaf', 'Fuente de néctar', '+5% de comida dorada', { bio: 100 }, { goldFood: 0.05 }, 1]]),
  ...chain('food', 'fo13', [[17, 5], [18, 5], [19, 5]], [
    ['f6a', 'boot', 'Exploradoras II', '+20% de comida y +10% de velocidad', 10, { food: 0.2, speed: 0.1 }],
    ['f6b', 'boot', 'Exploradoras III', '+25% de comida y +12% de velocidad', 12, { food: 0.25, speed: 0.12 }],
    ['f6c', 'boot', 'Mapa del bosque', 'Comida ×1,3 y +30% de velocidad', { bio: 90 }, { foodX: 1.3, speed: 0.3 }, 1]]),
  ...chain('food', 'lc2', [[16, 6], [17, 6], [18, 6]], [
    ['f7a', 'clover', 'Cosecha afortunada III', '+10% de probabilidad de entrega ×2', 9, { luck: 0.1 }],
    ['f7b', 'clover', 'Cosecha afortunada IV', '+10% de probabilidad de entrega ×2', 11, { luck: 0.1 }],
    ['f7c', 'clover', 'Trébol dorado', '+12% de entregas ×2 y +3% de comida dorada', { bio: 70 }, { luck: 0.12, goldFood: 0.03 }, 1]]),
  ...chain('food', 'lc1', [[16, 7], [17, 7], [18, 7]], [
    ['f8a', 'boot', 'Patas ágiles V', '+15% de velocidad', 9, { speed: 0.15 }],
    ['f8b', 'boot', 'Patas ágiles VI', '+18% de velocidad', 11, { speed: 0.18 }],
    ['f8c', 'boot', 'Patas ágiles VII', '+20% de velocidad', 13, { speed: 0.2 }]]),
  ['f9', 20, 5, 'food', 'leaf', 'Cosecha legendaria', 'Comida por viaje ×2', { bio: 140 }, { foodX: 2 }, ['f6c', 'f5c', 'f7c'], 1],
  // ---- Guerra (abajo a la derecha)
  ...chain('war', 'wa10', [[11, 13], [11, 14], [11, 15], [11, 16]], [
    ['w1a', 'sword', 'Mandíbulas VI', '+50% de daño', 9, { dmg: 0.5 }],
    ['w1b', 'sword', 'Mandíbulas VII', '+60% de daño', 10, { dmg: 0.6 }],
    ['w1c', 'sword', 'Mandíbulas VIII', '+70% de daño', 11, { dmg: 0.7 }],
    ['w1d', 'sword', 'Mandíbulas de acero', 'Daño ×1,5', { bio: 70 }, { dmgX: 1.5 }, 1]]),
  ...chain('war', 'wa11', [[12, 13], [12, 14], [12, 15]], [
    ['w2a', 'shield', 'Guardia del nido II', '+20% de daño y de vida', 9, { dmg: 0.2, hp: 0.2 }],
    ['w2b', 'shield', 'Guardia del nido III', '+25% de daño y de vida', 11, { dmg: 0.25, hp: 0.25 }],
    ['w2c', 'shield', 'Muralla viva', 'Vida ×1,4 y daño ×1,2', { bio: 60 }, { hpX: 1.4, dmgX: 1.2 }, 1]]),
  ...chain('war', 'waK3', [[13, 12], [13, 13], [13, 14]], [
    ['w3a', 'seed', 'Saqueo II', '+1 biomasa por enemigo', 9, { bioKill: 1 }],
    ['w3b', 'seed', 'Saqueo III', '+1 biomasa por enemigo', 11, { bioKill: 1 }],
    ['w3c', 'seed', 'Carroñeras', '+2 biomasa por enemigo', { bio: 50 }, { bioKill: 2 }, 1]]),
  ...chain('war', 'waK4', [[14, 12], [14, 13], [14, 14]], [
    ['w4a', 'fist', 'Rabia', '+40% de daño', 10, { dmg: 0.4 }],
    ['w4b', 'fist', 'Rabia II', '+50% de daño', 12, { dmg: 0.5 }],
    ['w4c', 'fist', 'Frenesí', 'Daño ×1,5', { bio: 90 }, { dmgX: 1.5 }, 1]]),
  ...chain('war', 'wa13', [[15, 12], [15, 13], [15, 14]], [
    ['w5a', 'shield', 'Veteranas III', '+5% de probabilidad de esquivar', 10, { dodge: 0.05 }],
    ['w5b', 'shield', 'Veteranas IV', '+5% de probabilidad de esquivar', 12, { dodge: 0.05 }],
    ['w5c', 'shield', 'Inmortales', '+8% de esquivar y vida ×1,2', { bio: 100 }, { dodge: 0.08, hpX: 1.2 }, 1]]),
  ...chain('war', 'wa12', [[17, 9], [18, 9], [19, 9], [20, 9]], [
    ['w6a', 'shield', 'Caparazón VI', '+50% de vida', 9, { hp: 0.5 }],
    ['w6b', 'shield', 'Caparazón VII', '+60% de vida', 10, { hp: 0.6 }],
    ['w6c', 'shield', 'Caparazón VIII', '+70% de vida', 11, { hp: 0.7 }],
    ['w6d', 'shield', 'Coraza de diamante', 'Vida ×1,5', { bio: 80 }, { hpX: 1.5 }, 1]]),
  ...chain('war', 'wa9', [[17, 10], [18, 10]], [
    ['w7a', 'coin', 'Botín de guerra II', '+50% de jalea al ganar una noche', 9, { prize: 0.5 }],
    ['w7b', 'coin', 'Botín de guerra III', '+60% de jalea al ganar una noche', 11, { prize: 0.6 }]]),
  ...chain('war', 'wa14', [[17, 11], [18, 11]], [
    ['w8a', 'shield', 'Escudo de quitina', '+30% de vida y +3% de esquivar', 11, { hp: 0.3, dodge: 0.03 }],
    ['w8b', 'shield', 'Escudo de quitina II', '+40% de vida y +3% de esquivar', 13, { hp: 0.4, dodge: 0.03 }]]),
  ['w9', 15, 16, 'war', 'fist', 'Ejército invencible', 'Daño y vida ×1,5', { bio: 140 }, { dmgX: 1.5, hpX: 1.5 }, ['w4c', 'w5c', 'w1d'], 1],
  // ---- Toques (abajo a la izquierda)
  ...chain('tap', 'ghK', [[7, 13], [7, 14], [7, 15]], [
    ['t1a', 'ghost', 'Mano veloz II', 'La mano fantasma toca un 30% más rápido', 9, { ghostX: 1.3 }],
    ['t1b', 'ghost', 'Mano veloz III', 'La mano fantasma toca un 30% más rápido', 11, { ghostX: 1.3 }],
    ['t1c', 'ghost', 'Mil manos', 'Una segunda mano fantasma (+1 toque cada 4 s)', { bio: 70 }, { ghost: 0.25 }, 1]]),
  ...chain('tap', 'gh2', [[6, 13], [6, 14]], [
    ['t2a', 'ghost', 'Mano experta II', 'La mano fantasma toca un 25% más rápido', 10, { ghostX: 1.25 }],
    ['t2b', 'ghost', 'Mano experta III', 'La mano fantasma toca un 25% más rápido', 12, { ghostX: 1.25 }]]),
  ...chain('tap', 'ta11', [[8, 13], [8, 14], [8, 15]], [
    ['t3a', 'bolt', 'Golpe certero IV', 'Tocar enemigos hace +150%', 9, { tapFoe: 1.5 }],
    ['t3b', 'bolt', 'Golpe certero V', 'Tocar enemigos hace +200%', 11, { tapFoe: 2 }],
    ['t3c', 'bolt', 'Puño de la reina', 'Tocar enemigos hace +300%', { bio: 50 }, { tapFoe: 3 }, 1]]),
  ...chain('tap', 'ta10', [[9, 13], [9, 14], [9, 15]], [
    ['t4a', 'flame', 'Incubadora II', '+20% de velocidad de cría', 9, { growth: 0.2 }],
    ['t4b', 'flame', 'Incubadora III', '+25% de velocidad de cría', 11, { growth: 0.25 }],
    ['t4c', 'flame', 'Cuna real', 'La cría crece un 40% más rápido', { bio: 60 }, { growthX: 1.4 }, 1]]),
  ...chain('tap', 'lk3', [[3, 10], [2, 10], [1, 10]], [
    ['t5a', 'star', 'Toque de suerte IV', '+8% de probabilidad de toque de suerte', 10, { tapCrit: 0.08 }],
    ['t5b', 'star', 'Toque de suerte V', '+8% de probabilidad de toque de suerte', 12, { tapCrit: 0.08 }],
    ['t5c', 'star', 'Toque divino', '+10% de toques de suerte y tus toques ×1,5', { bio: 90 }, { tapCrit: 0.1, clickX: 1.5 }, 1]]),
  ...chain('tap', 'lk1', [[4, 9], [3, 9], [2, 9], [1, 9]], [
    ['t6a', 'hand', 'Caricia V', '+70% de efecto de tus toques', 9, { click: 0.7 }],
    ['t6b', 'hand', 'Caricia VI', '+80% de efecto de tus toques', 10, { click: 0.8 }],
    ['t6c', 'hand', 'Caricia VII', '+100% de efecto de tus toques', 12, { click: 1 }],
    ['t6d', 'hand', 'Manos de oro', 'Tus toques ×2', { bio: 80 }, { clickX: 2 }, 1]]),
  ...chain('tap', 'gh3', [[4, 11], [3, 11], [2, 11]], [
    ['t7a', 'crown', 'Masaje real II', 'Tocar a la reina rinde +50%', 9, { tapQ: 0.5 }],
    ['t7b', 'crown', 'Masaje real III', 'Tocar a la reina rinde +60%', 11, { tapQ: 0.6 }],
    ['t7c', 'crown', 'Banquete real', 'Tocar a la reina rinde +100%', { bio: 60 }, { tapQ: 1 }, 1]]),
  ...chain('tap', 'gh2', [[5, 12], [4, 12], [3, 12]], [
    ['t8a', 'larva', 'Mimo a la cría III', 'Tocar huevos y larvas rinde +50%', 9, { tapB: 0.5 }],
    ['t8b', 'larva', 'Mimo a la cría IV', 'Tocar huevos y larvas rinde +60%', 11, { tapB: 0.6 }],
    ['t8c', 'larva', 'Nodrizas mimadas', 'Tocar la cría rinde +100% y crece un 20% más rápido', { bio: 70 }, { tapB: 1, growth: 0.2 }, 1]]),
  ['t9', 1, 11, 'tap', 'hand', 'Mano de la reina', 'Tus toques ×2 y +5% de toques de suerte', { bio: 140 }, { clickX: 2, tapCrit: 0.05 }, ['t5c', 't6d', 't7c'], 1]
];

const P = [
  ['root', 5, 3, 'root', 'dna', 'Linaje', 'Lo que aprende cada reina pasa a sus hijas.', 0, {}, []],
  // derecha: recolección
  ['pf1', 6, 3, 'food', 'leaf', 'Memoria del camino', '+20% de comida en todas las colonias', { adn: 1 }, { food: 0.2 }, ['root']],
  ['pf2', 7, 3, 'food', 'leaf', 'Buche heredado', '+30% de comida', { adn: 3 }, { food: 0.3 }, ['pf1']],
  ['pf3', 8, 3, 'food', 'leaf', 'Gran buche', 'Comida ×1,5', { adn: 8 }, { foodX: 1.5 }, ['pf2']],
  ['psp', 7, 2, 'food', 'boot', 'Patas largas', '+15% de velocidad', { adn: 3 }, { speed: 0.15 }, ['pf2']],
  ['ppz', 8, 4, 'food', 'coin', 'Tributo', '+100% de jalea al ganar una noche', { adn: 3 }, { prize: 1 }, ['pf2']],
  ['pf4', 9, 3, 'food', 'leaf', 'Hambre ancestral', 'Comida ×2', { adn: 20 }, { foodX: 2 }, ['pf3']],
  // abajo: guerra
  ['pd1', 5, 4, 'war', 'sword', 'Instinto de lucha', '+20% de daño', { adn: 1 }, { dmg: 0.2 }, ['root']],
  ['ph1', 6, 4, 'war', 'shield', 'Piel dura', '+20% de vida', { adn: 1 }, { hp: 0.2 }, ['pd1', 'pf1']],
  ['pd2', 5, 5, 'war', 'sword', 'Mandíbula heredada', '+30% de daño', { adn: 3 }, { dmg: 0.3 }, ['pd1']],
  ['ph2', 6, 5, 'war', 'shield', 'Quitina heredada', '+30% de vida', { adn: 3 }, { hp: 0.3 }, ['ph1', 'pd2']],
  ['pbk', 4, 5, 'war', 'seed', 'Carroñeras', '+1 biomasa por enemigo', { adn: 4 }, { bioKill: 1 }, ['pd2']],
  ['pd3', 5, 6, 'war', 'fist', 'Furia ancestral', 'Daño ×1,5', { adn: 8 }, { dmgX: 1.5 }, ['pd2']],
  ['ph3', 6, 6, 'war', 'shield', 'Coraza ancestral', 'Vida ×1,5', { adn: 8 }, { hpX: 1.5 }, ['ph2', 'pd3']],
  ['plv', 4, 6, 'war', 'crown', 'Nido fortificado', 'Una vez por colonia, la reina resiste el asalto', { adn: 12 }, { lives: 1 }, ['pd3']],
  ['pd4', 5, 7, 'war', 'fist', 'Ira de la estirpe', 'Daño ×2', { adn: 20 }, { dmgX: 2 }, ['pd3']],
  ['ph4', 6, 7, 'war', 'shield', 'Caparazón eterno', 'Vida ×2', { adn: 20 }, { hpX: 2 }, ['ph3', 'pd4']],
  // izquierda: cría
  ['pe1', 4, 3, 'brood', 'egg', 'Huevos fuertes', 'Cada huevo cuesta un 10% menos de comida', { adn: 1 }, { eggCostX: 0.9 }, ['root']],
  ['pg1', 3, 3, 'brood', 'flame', 'Nido cálido', '+25% de velocidad de cría', { adn: 2 }, { growth: 0.25 }, ['pe1']],
  ['prs', 3, 2, 'brood', 'crown', 'Reina robusta', 'La reina produce el triple por su cuenta', { adn: 2 }, { reserve: 2 }, ['pg1']],
  ['ptw', 2, 3, 'brood', 'eggs2', 'Gemelas', 'Uno de cada diez huevos trae gemelas', { adn: 6 }, { twin: 0.1 }, ['pg1']],
  ['pcv', 2, 2, 'brood', 'crown', 'Sangre real', 'Los huevos se encarecen más despacio', { adn: 10 }, { curve: 0.015 }, ['prs', 'ptw']],
  ['pe2', 1, 3, 'brood', 'egg', 'Puesta ancestral', 'Cada huevo cuesta un 20% menos de comida', { adn: 15 }, { eggCostX: 0.8 }, ['ptw']],
  // arriba: arranque
  ['pl1', 4, 4, 'tap', 'clover', 'Trébol de cuatro hojas', '+5% de toques ×2 y +5% de entregas ×2', { adn: 4 }, { tapCrit: 0.05, luck: 0.05 }, ['pe1', 'pd1']],
  ['psh', 3, 4, 'brood', 'sparkle', 'Sangre dorada', '+3% de hormigas doradas en todas las colonias', { adn: 6 }, { shiny: 0.03 }, ['pl1']],
  ['pgh1', 3, 5, 'tap', 'ghost', 'Mano fantasma', 'En todas las colonias, una mano invisible toca a la reina cada 5 s', { adn: 5 }, { ghost: 0.2 }, ['psh', 'pbk']],
  ['pgh2', 2, 5, 'tap', 'ghost', 'Mano incansable', 'La mano fantasma toca un 60% más rápido', { adn: 10 }, { ghostX: 1.6 }, ['pgh1']],
  ['pgh3', 2, 4, 'tap', 'ghost', 'Mano de oro', 'La mano toca un 20% más rápido y +8% de toques ×2', { adn: 12 }, { ghostX: 1.2, tapCrit: 0.08 }, ['pgh2', 'psh']],
  ['pgf', 3, 6, 'food', 'goldleaf', 'Néctar dorado', '+4% de comida dorada (×5) en todas las colonias', { adn: 8 }, { goldFood: 0.04 }, ['pgh1', 'plv']],
  ['pgf2', 2, 6, 'food', 'goldleaf', 'Banquete dorado', '+5% de comida dorada', { adn: 18 }, { goldFood: 0.05 }, ['pgf', 'pgh2']],
  ['psh2', 1, 4, 'brood', 'sparkle', 'Estirpe dorada', '+6% de hormigas doradas', { adn: 14 }, { shiny: 0.06 }, ['pgh3']],
  ['psh3', 1, 5, 'brood', 'sparkle', 'Realeza dorada', 'Las doradas traen ×5 comida y pegan ×3 desde el primer día', { adn: 24 }, { shinyElite: 1 }, ['psh2', 'pgh2']],
  ['pl2', 7, 4, 'tap', 'clover', 'Fortuna ancestral', '+8% de toques ×2 y +8% de entregas ×2', { adn: 10 }, { tapCrit: 0.08, luck: 0.08 }, ['ph1', 'ppz']],
  ['ps1', 5, 2, 'tap', 'ant', 'Escolta', 'Cada colonia empieza con 2 hormigas', { adn: 2 }, { startAnts: 2 }, ['root']],
  ['ptp', 4, 2, 'tap', 'bolt', 'Racha', 'Desbloquea la racha: cada toque seguido rinde más. Además, tus toques ×1,2', { adn: 4 }, { combo: 1, clickX: 1.2 }, ['ps1', 'pe1']],
  ['pj1', 6, 2, 'tap', 'leaf', 'Despensa inicial', 'Cada colonia empieza con 40 de jalea', { adn: 2 }, { startJelly: 40 }, ['ps1']],
  ['ps2', 5, 1, 'tap', 'ant', 'Séquito', 'Empiezas con 3 hormigas más', { adn: 7 }, { startAnts: 3 }, ['ps1']],
  ['pds', 4, 1, 'tap', 'arrows', 'Saber heredado', 'El árbol de la colonia cuesta un 25% menos', { adn: 6 }, { discount: 0.25 }, ['ps2', 'ptp']],
  ['pj2', 6, 1, 'tap', 'coin', 'Tesoro real', 'Empiezas con 250 de jalea más', { adn: 8 }, { startJelly: 250 }, ['ps2', 'pj1']],
  ['ps3', 5, 0, 'tap', 'ant', 'Ejército fundador', 'Empiezas con 5 hormigas más', { adn: 18 }, { startAnts: 5 }, ['ps2']],
  // arriba a la izquierda: puesta (huevos extra, huevos que no encarecen, cría precoz)
  ['pdx1', 3, 1, 'brood', 'eggs2', 'Puesta generosa', '8% de probabilidad de que la reina ponga un huevo extra gratis', { adn: 4 }, { extraEgg: 0.08 }, ['prs']],
  ['pfe1', 2, 1, 'brood', 'egg', 'Huevo sin precio', '10% de probabilidad de que un huevo no encarezca el siguiente', { adn: 5 }, { freeEgg: 0.1 }, ['pdx1', 'pcv']],
  ['pdx2', 3, 0, 'brood', 'eggs2', 'Puesta generosa II', '+12% de probabilidad de huevo extra', { adn: 14 }, { extraEgg: 0.12 }, ['pdx1']],
  ['pfe2', 2, 0, 'brood', 'egg', 'Huevo sin precio II', '+15% de probabilidad de que no encarezca', { adn: 16 }, { freeEgg: 0.15 }, ['pfe1', 'pdx2']],
  ['pqk', 1, 1, 'brood', 'larva', 'Eclosión precoz', '15% de los huevos se saltan la fase de larva', { adn: 10 }, { instaHatch: 0.15 }, ['pfe1']],
  ['pse', 4, 0, 'brood', 'egg', 'Nido preparado', 'Cada colonia empieza con 3 huevos puestos', { adn: 6 }, { startEggs: 3 }, ['pds', 'pdx2']],
  // herencia y supervivencia
  ['pkp', 7, 1, 'food', 'coin', 'Herencia', 'La colonia nueva empieza con el 5% de la jalea que reunió la anterior', { adn: 10 }, { keepJelly: 0.05 }, ['pj2']],
  ['pbio', 6, 0, 'war', 'seed', 'Biomasa ancestral', 'Cada colonia empieza con 6 de biomasa', { adn: 8 }, { startBio: 6 }, ['ps3', 'pj2']],
  ['pns', 8, 1, 'food', 'crown', 'Todo para la reina', 'Cuando en el árbol de la colonia ya no queda nada que comprar con jalea, las obreras dejan de guardar en la despensa y le llevan toda la comida a la reina', { adn: 12 }, { noStore: 1 }, ['pkp']],
  ['pdg', 7, 6, 'war', 'shield', 'Supervivientes', '8% de probabilidad de esquivar un golpe mortal', { adn: 10 }, { dodge: 0.08 }, ['ph3']]
];

/** Requisitos explícitos: mejoras que no tienen número romano en el nombre. */
const NEEDS = {
  gh2: ['ghK'], gh3: ['gh2'], lkK: ['lk1'], shK: ['sh1'], sh2: ['sh1'], sh3: ['sh1'], gf2: ['gf1'], lc2: ['lc1'],
  t2a: ['gh3'], b5a: ['brK2'], t1c: ['ghK'],
  pgh2: ['pgh1'], pgh3: ['pgh2'], pcb1: ['ptp'], pgf2: ['pgf'], psh2: ['psh'], psh3: ['psh'], pqk: ['pdx1']
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function build(rows) {
  const N = {}, byName = {};
  // al crecer, las coordenadas pueden salir negativas: todo se desplaza para empezar en 0
  const mx = Math.min(...rows.map(r => r[1])), my = Math.min(...rows.map(r => r[2]));
  for (const [id, x, y, cat, icon, name, desc, cost, fx, links, key, extra] of rows) {
    N[id] = { id, x: x - mx, y: y - my, cat, icon, name, desc, cost, fx, links, key: !!key, adj: new Set(links), needs: [...(NEEDS[id] || []), ...((extra && extra.needs) || [])],
      reqPerk: (extra && extra.reqPerk) || REQ_PERK[id] || null, gen: !!(extra && extra.gen) };
    byName[name] = id;
  }
  for (const id in N) for (const l of N[id].links) N[l].adj.add(id); // los enlaces van en ambos sentidos
  // «Caricia III» exige «Caricia II»; «Mimo a la cría II» exige «Mimo a la cría» (los generados no: van por caminos distintos)
  for (const id in N) {
    if (N[id].gen) continue;
    const m = N[id].name.match(/^(.*) (II|III|IV|V|VI)$/);
    if (!m) continue;
    const i = ROMAN.indexOf(m[2]), prev = byName[m[1] + ' ' + ROMAN[i - 1]] || (i === 1 ? byName[m[1]] : null);
    if (prev && !N[id].needs.includes(prev)) N[id].needs.push(prev);
  }
  return N;
}

/** Lo que le falta a un nodo para poder comprarse aunque esté conectado (lista de ids). */
export const missingNeeds = (nodes, owned, id) => nodes[id].needs.filter(n => !owned[n]);

/*
 * Racha de toques (rules.comboTap): cada toque seguido rinde más. Aquí se mejora.
 *   comboStep  suma al extra por toque (de serie +2,5% por toque de la racha)
 *   comboCap   toques de racha más (de serie 20)
 *   comboGap   segundos más entre toques sin perder la racha (de serie 0,8)
 *   comboX     multiplica todo el extra de la racha
 */
const S3 = chain('tap', 't2a', [[5, 13], [4, 13], [3, 13], [3, 14], [2, 14]], [
  ['cb1', 'bolt', 'Ritmo I', 'Cada toque de la racha rinde +1% más', 10, { comboStep: 0.01 }],
  ['cb2', 'bolt', 'Racha larga', 'La racha llega a 10 toques más', 11, { comboCap: 10 }],
  ['cb3', 'hand', 'Dedos ligeros', 'Medio segundo más entre toques sin perder la racha', 11, { comboGap: 0.5 }],
  ['cbK', 'bolt', 'Frenesí', 'El extra de la racha ×2', { bio: 80 }, { comboX: 2 }, 1],
  ['cb4', 'bolt', 'Ritmo II', 'Cada toque de la racha rinde +1,5% más', 12, { comboStep: 0.015 }]
]);
// en el linaje (permanentes): junto a la mano fantasma
const P3 = [
  ['pcb1', 1, 6, 'tap', 'bolt', 'Ritmo heredado', 'Cada toque de la racha rinde +1% más, en todas las colonias', { adn: 6 }, { comboStep: 0.01 }, ['pgh2']],
  ['pcb2', 0, 6, 'tap', 'bolt', 'Racha ancestral', 'La racha llega a 10 toques más', { adn: 10 }, { comboCap: 10 }, ['pcb1']],
  ['pcb3', 0, 5, 'tap', 'hand', 'Pulso de la estirpe', 'Cuatro décimas más entre toques sin perder la racha', { adn: 14 }, { comboGap: 0.4 }, ['pcb2']]
];

/** Nodos del árbol de la colonia que necesitan algo del linaje (la racha se desbloquea con «Racha»). */
const REQ_PERK = { cb1: 'ptp', cb2: 'ptp', cb3: 'ptp', cbK: 'ptp', cb4: 'ptp' };

/* ---------- crecimiento: los árboles se amplían hacia fuera con mejoras pequeñas ---------- */
const toRoman = n => { let r = ''; for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { r += s; n -= v; } return r; };
/**
 * Familias de mejoras pequeñas por rama: [nombre, icono, descripción con {v}, efecto, valor, peso, extra].
 * Cada nodo nuevo es de la rama de su vecino. «farm» son granjas que producen jalea solas (ver rules.tick):
 * cada punto es esa fracción del premio de una noche por minuto, también de noche y sin hormigas.
 */
const FAMILIES = {
  skills: {
    brood: [['Calor suave', 'flame', '+{v}% de velocidad de cría', 'growth', 0.08, 3], ['Cáscara fina', 'egg', 'Cada huevo cuesta un {v}% menos', 'eggCostX', 0.97, 3],
      ['Reserva templada', 'crown', 'La reina produce +{v}% por su cuenta', 'reserve', 0.25, 2], ['Granja de hongos', 'seed', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.06, 2]],
    food: [['Buche ancho', 'leaf', '+{v}% de comida por viaje', 'food', 0.08, 4], ['Paso firme', 'boot', '+{v}% de velocidad', 'speed', 0.04, 2],
      ['Pulgones', 'clover', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.06, 2], ['Botín', 'coin', '+{v}% de jalea al ganar una noche', 'prize', 0.12, 1]],
    war: [['Colmillo', 'sword', '+{v}% de daño', 'dmg', 0.08, 4], ['Quitina', 'shield', '+{v}% de vida', 'hp', 0.08, 4],
      ['Reflejos', 'shield', '+{v}% de probabilidad de esquivar', 'dodge', 0.015, 1], ['Rapiña', 'seed', '+{v} de biomasa por enemigo', 'bioKill', 0.4, 1]],
    tap: [['Caricia suave', 'hand', '+{v}% de efecto de tus toques', 'click', 0.08, 3], ['Mano errante', 'ghost', 'Mano fantasma: +{v} toques por minuto', 'ghost', 0.04, 2],
      ['Ritmo', 'bolt', 'Cada toque de la racha rinde +{v}% más', 'comboStep', 0.004, 2, { reqPerk: 'ptp' }], ['Fortuna', 'star', '+{v}% de toques de suerte', 'tapCrit', 0.015, 1]]
  },
  perm: {
    brood: [['Linaje fértil', 'flame', '+{v}% de velocidad de cría', 'growth', 0.12, 3], ['Reserva ancestral', 'crown', 'La reina produce +{v}% por su cuenta', 'reserve', 0.5, 2],
      ['Hongo ancestral', 'seed', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.1, 2]],
    food: [['Memoria', 'leaf', '+{v}% de comida', 'food', 0.12, 3], ['Senda', 'boot', '+{v}% de velocidad', 'speed', 0.05, 1],
      ['Rebaño de pulgones', 'clover', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.1, 2]],
    war: [['Furia', 'sword', '+{v}% de daño', 'dmg', 0.12, 3], ['Coraza', 'shield', '+{v}% de vida', 'hp', 0.12, 3]],
    tap: [['Mano heredada', 'ghost', 'Mano fantasma: +{v} toques por minuto', 'ghost', 0.06, 2], ['Toque heredado', 'hand', '+{v}% de efecto de tus toques', 'click', 0.12, 2],
      ['Ritmo ancestral', 'bolt', 'Cada toque de la racha rinde +{v}% más', 'comboStep', 0.006, 1, { needs: ['ptp'] }]]
  }
};
/** Nodos clave (rombo, con biomasa) que salen de vez en cuando al crecer el árbol de la colonia. */
const KEYS = { brood: ['Nido ancestral', 'flame', 'La cría crece un {v}% más rápido', 'growthX', 1.12], food: ['Sendero real', 'leaf', 'Comida ×{x}', 'foodX', 1.12],
  war: ['Legión', 'fist', 'Daño ×{x}', 'dmgX', 1.1], tap: ['Manos rápidas', 'ghost', 'La mano fantasma ×{x}', 'ghostX', 1.25] };

/** Generador pseudoaleatorio con semilla: el árbol sale siempre igual. */
function seeded(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Hace crecer un árbol hasta `target` nodos: cada nodo nuevo se pega (en vertical u horizontal) a uno que ya
 * está, en una celda libre más lejos de la raíz, y es de su misma rama. Coste: un nivel más que su vecino
 * (o unos ADN más en el linaje); cada 7 nodos de una rama, uno clave.
 */
function grow(rows, target, tree, seed) {
  const rnd = seeded(seed), fam = FAMILIES[tree], occ = new Set(rows.map(r => r[1] + ',' + r[2]));
  const root = rows.find(r => r[0] === 'root'), d = r => Math.abs(r[1] - root[1]) + Math.abs(r[2] - root[2]);
  const count = {}, perCat = {}, out = rows.slice();
  const tier = r => typeof r[7] === 'number' ? r[7] : r[7].adn != null ? r[7].adn : 8; // nivel (o ADN) del vecino
  for (let tries = 0; out.length < target && tries < target * 400; tries++) {
    // sobre todo desde el borde, para crecer hacia fuera
    const pool = out.filter(r => r[3] !== 'root'), far = Math.max(...pool.map(d)), p = pool[Math.floor(rnd() * pool.length)];
    if (d(p) < far - 3 && rnd() < 0.8) continue;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !occ.has((p[1] + dx) + ',' + (p[2] + dy)) && Math.abs(p[1] + dx - root[1]) + Math.abs(p[2] + dy - root[2]) > d(p));
    if (!dirs.length) continue;
    const [dx, dy] = dirs[Math.floor(rnd() * dirs.length)], x = p[1] + dx, y = p[2] + dy, cat = p[3];
    const n = (perCat[cat] = (perCat[cat] || 0) + 1), id = 'g' + tree[0] + out.length;
    let row;
    if (tree === 'skills' && n % 7 === 0) {
      const [name, icon, desc, k, v] = KEYS[cat], c = (count[name] = (count[name] || 0) + 1);
      row = [id, x, y, cat, icon, name + ' ' + toRoman(c), desc.replace('{v}', Math.round((v - 1) * 100)).replace('{x}', String(v).replace('.', ',')),
        { bio: Math.round(20 + 6 * d(p)) }, { [k]: v }, [p[0]], 1, { gen: 1 }];
    } else {
      const list = fam[cat], tot = list.reduce((s, f) => s + f[5], 0);
      let r = rnd() * tot, f = list[0];
      for (const it of list) { r -= it[5]; if (r <= 0) { f = it; break; } }
      const [name, icon, desc, k, v, , extra] = f, c = (count[name] = (count[name] || 0) + 1);
      const shown = k.endsWith('X') ? Math.round((1 - v) * 100) : k === 'ghost' ? Math.round(v * 60 * 10) / 10 : k === 'bioKill' ? v : Math.round(v * 1000) / 10;
      const cost = tree === 'perm' ? { adn: Math.round(tier(p) + 2 + d(p) * 0.6) } : Math.min(18, tier(p) + 1);
      row = [id, x, y, cat, icon, name + ' ' + toRoman(c), desc.replace('{v}', String(shown).replace('.', ',')), cost, { [k]: v }, [p[0]], 0, { gen: 1, ...(extra || {}) }];
    }
    out.push(row); occ.add(x + ',' + y);
  }
  return out;
}

const SKILL_ROWS = [...S.map(r => [r[0], r[1] + OX, r[2] + OY, ...r.slice(3)]), ...S2, ...S3];
const PERK_ROWS = [...P, ...P3];
/** Árbol de la colonia y linaje: los diseñados a mano y, alrededor, otro tanto de mejoras pequeñas. */
export const SKILLS = build(grow(SKILL_ROWS, SKILL_ROWS.length * 2, 'skills', 7));
// añadidos tras crecer, en huecos libres: así no cambian los ids ni el sitio de los generados (partidas guardadas)
const P4 = [
  ['ptc', 4, -1, 'brood', 'hand', 'Toque menguante', 'Tocar a la reina ya no la alimenta: cada toque rebaja la comida que piden los huevos, y la rebaja se mantiene para los siguientes', { adn: 80 }, { tapCut: 1 }, ['pse']],
  ['psk', 6, -1, 'war', 'moon', 'Saltar el día', 'Un botón junto al reloj hace que caiga la noche ya. Las noches con el día saltado dan la mitad de ADN', { adn: 60 }, { skipDay: 1 }, ['pbio']]
];
export const PERKS = build([...grow(PERK_ROWS, PERK_ROWS.length * 2, 'perm', 11), ...P4]);

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

/**
 * Estado de cada nodo según la distancia al conjunto comprado:
 * 0 owned (comprado) · 1 open (se puede comprar) · 2 seen (se ve) · 3 fog («?») · más lejos hidden.
 */
const NAMES = ['owned', 'open', 'seen', 'fog'];
export function treeStates(nodes, owned, perm) {
  const dist = {}, q = [];
  for (const id in nodes) if (id === 'root' || owned[id]) { dist[id] = 0; q.push(id); }
  while (q.length) {
    const id = q.shift();
    if (dist[id] >= 3) continue;
    for (const a of nodes[id].adj) if (dist[a] == null) { dist[a] = dist[id] + 1; q.push(a); }
  }
  const out = {};
  for (const id in nodes) {
    out[id] = NAMES[dist[id]] || 'hidden';
    if (out[id] === 'open' && missingNeeds(nodes, owned, id).length) out[id] = 'seen'; // conectado, pero falta lo que mejora
    if (out[id] === 'open' && nodes[id].reqPerk && !(perm && perm[nodes[id].reqPerk])) out[id] = 'seen'; // falta algo del linaje
  }
  return out;
}
