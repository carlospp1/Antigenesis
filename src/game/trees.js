// Los dos árboles del juego, como grafos:
//   SKILLS: árbol de la colonia. Se paga con jalea (nodos normales) y biomasa (nodos clave, en rombo).
//           Se pierde al morir la reina o al fundar una colonia nueva.
//   PERKS:  árbol de linaje. Se paga con ADN y es permanente entre colonias.
//
// Forma: un molinillo. La raíz en el centro y cuatro ramas; cada rama es un TRONCO recto que sale de la
// raíz y de cada nodo del tronco cuelga una COSTILLA perpendicular, siempre hacia el mismo lado:
//   Recolección  tronco → derecha   costillas ↑      Guerra  tronco ↓ abajo      costillas →
//   Toques       tronco ← izquierda costillas ↓      Cría    tronco ↑ arriba     costillas ←
// Cada nodo tiene un único padre y es la casilla de al lado: lo que hay que comprar antes es el vecino.
// Una costilla es una familia en orden (I → II → III…). El precio sube con cada compra (nodeCost en rules.js).
//
// Contenido: id → [icono, nombre, descripción, coste, efectos, extra?]
//   coste: nivel (tier) de jalea, o { bio: n } / { adn: n }
//   efectos: las claves que terminan en X multiplican; el resto suman (ver calc en rules.js)
//   extra: { key: 1 } nodo clave (rombo) · { reqPerk } necesita algo del linaje · { own } lo deja tuyo en el árbol

/* ---------------- árbol de la colonia: contenido ---------------- */
const RACHA = { reqPerk: 'ptp' }, QJ = { reqPerk: 'pqj1' }, K = { key: 1 };
const SN = {
  // ---- Cría
  br1: ['egg', 'Huevos baratos I', 'Cada huevo cuesta un 7% menos de comida', 1, { eggCostX: 0.93 }],
  br5: ['egg', 'Huevos baratos II', 'Cada huevo cuesta un 7% menos de comida', 3, { eggCostX: 0.93 }],
  br6: ['egg', 'Metabolismo real', 'Cada huevo cuesta un 8% menos de comida', 4, { eggCostX: 0.92 }],
  br9: ['egg', 'Huevera', 'Cada huevo cuesta un 10% menos de comida', 4, { eggCostX: 0.9 }],
  br8: ['egg', 'Huevos baratos III', 'Cada huevo cuesta un 8% menos de comida', 5, { eggCostX: 0.92 }],
  br12: ['egg', 'Huevos baratos IV', 'Cada huevo cuesta un 10% menos de comida', 7, { eggCostX: 0.9 }],
  b2a: ['egg', 'Huevos baratos V', 'Cada huevo cuesta un 7% menos', 8, { eggCostX: 0.93 }],
  b2b: ['egg', 'Huevos baratos VI', 'Cada huevo cuesta un 7% menos', 9, { eggCostX: 0.93 }],
  b2c: ['egg', 'Huevos baratos VII', 'Cada huevo cuesta un 8% menos', 11, { eggCostX: 0.92 }],
  b2d: ['egg', 'Huevos baratos VIII', 'Cada huevo cuesta un 8% menos', 12, { eggCostX: 0.92 }],
  br2: ['flame', 'Calor del nido I', '+20% de velocidad de huevos y larvas', 1, { growth: 0.2 }],
  br4: ['flame', 'Calor del nido II', '+20% de velocidad de cría', 2, { growth: 0.2 }],
  br7: ['flame', 'Calor del nido III', '+25% de velocidad de cría', 5, { growth: 0.25 }],
  br11: ['flame', 'Calor del nido IV', '+30% de velocidad de cría', 7, { growth: 0.3 }],
  b3b: ['flame', 'Calor del nido V', '+30% de velocidad de cría', 9, { growth: 0.3 }],
  b3c: ['flame', 'Calor del nido VI', '+35% de velocidad de cría', 10, { growth: 0.35 }],
  b3d: ['flame', 'Incubadora real', 'La cría crece un 50% más rápido', { bio: 70 }, { growthX: 1.5 }, K],
  br3: ['crown', 'Reserva real I', 'La reina produce +60% por su cuenta', 2, { reserve: 0.6 }],
  mx1: ['leaf', 'Despensa común', '+15% de comida y la reina produce +25%', 3, { food: 0.15, reserve: 0.25 }],
  br10: ['crown', 'Reserva real II', 'La reina produce el doble por su cuenta', 6, { reserve: 1 }],
  b1a: ['crown', 'Reserva real III', 'La reina produce +100% por su cuenta', 8, { reserve: 1 }],
  b1b: ['crown', 'Reserva real IV', 'La reina produce +150% por su cuenta', 9, { reserve: 1.5 }],
  b1c: ['crown', 'Reserva real V', 'La reina produce +200% por su cuenta', 11, { reserve: 2 }],
  b1d: ['crown', 'Reina inagotable', 'La reina produce +400% por su cuenta', { bio: 70 }, { reserve: 4 }, K],
  brK1: ['flame', 'Nodrizas', 'La cría crece un 50% más rápido', { bio: 3 }, { growthX: 1.5 }, K],
  ta10: ['flame', 'Incubadora', '+20% de velocidad de cría', 6, { growth: 0.2 }],
  t4a: ['flame', 'Incubadora II', '+20% de velocidad de cría', 9, { growth: 0.2 }],
  t4b: ['flame', 'Incubadora III', '+25% de velocidad de cría', 11, { growth: 0.25 }],
  t4c: ['flame', 'Cuna real', 'La cría crece un 40% más rápido', { bio: 60 }, { growthX: 1.4 }, K],
  brK2: ['eggs2', 'Puesta doble', 'Uno de cada cuatro huevos trae gemelas', { bio: 8 }, { twin: 0.25 }, K],
  b5a: ['eggs2', 'Gemelas', 'Un 8% más de huevos traen gemelas', 8, { twin: 0.08 }],
  b5b: ['eggs2', 'Gemelas II', 'Un 8% más de huevos traen gemelas', 10, { twin: 0.08 }],
  b5d: ['eggs2', 'Gemelas III', 'Un 10% más de huevos traen gemelas', 12, { twin: 0.1 }],
  b5c: ['eggs2', 'Camada', 'Un 15% más de huevos traen gemelas', { bio: 55 }, { twin: 0.15 }, K],
  sh1: ['sparkle', 'Hormigas doradas', '3% de las que nacen son doradas: ×3 comida y ×2 daño', 5, { shiny: 0.03 }],
  sh2: ['sparkle', 'Brillo real', '+5% de hormigas doradas', 7, { shiny: 0.05 }],
  b4a: ['sparkle', 'Brillo real II', '+3% de hormigas doradas', 9, { shiny: 0.03 }],
  b4b: ['sparkle', 'Brillo real III', '+3% de hormigas doradas', 10, { shiny: 0.03 }],
  shK: ['sparkle', 'Linaje dorado', '+7% de hormigas doradas', { bio: 16 }, { shiny: 0.07 }, K],
  sh3: ['sparkle', 'Doradas de élite', 'Las doradas traen ×5 comida y pegan ×3', { bio: 20 }, { shinyElite: 1 }, K],
  b4c: ['sparkle', 'Corona dorada', '+5% de hormigas doradas', { bio: 60 }, { shiny: 0.05 }, K],
  br13: ['eggs2', 'Huevo de regalo', '5% de probabilidad de que la reina ponga un huevo extra gratis', 6, { extraEgg: 0.05 }],
  b7a: ['eggs2', 'Huevo de regalo II', '+5% de probabilidad de huevo extra gratis', 9, { extraEgg: 0.05 }],
  b7b: ['eggs2', 'Huevo de regalo III', '+5% de probabilidad de huevo extra gratis', 11, { extraEgg: 0.05 }],
  b7c: ['eggs2', 'Puesta en racimo', '+8% de probabilidad de huevo extra gratis', { bio: 60 }, { extraEgg: 0.08 }, K],
  brK3: ['crown', 'Reina eficiente', 'Los huevos se encarecen más despacio', { bio: 14 }, { curve: 0.025 }, K],
  brK4: ['crown', 'Reina prolífica', 'Los huevos se encarecen aún más despacio', { bio: 30 }, { curve: 0.025 }, K],
  b3a: ['crown', 'Reina dinástica', 'Los huevos se encarecen todavía más despacio', { bio: 45 }, { curve: 0.02 }, K],
  b9: ['crown', 'Matriarca', 'Cada huevo cuesta un 20% menos y la cría crece un 20% más rápido', { bio: 120 }, { eggCostX: 0.8, growthX: 1.2 }, K],
  brK5: ['egg', 'Puesta sin precio', '10% de probabilidad de que un huevo no encarezca el siguiente', { bio: 18 }, { freeEgg: 0.1 }, K],
  b8a: ['egg', 'Puesta sin precio II', '+8% de huevos que no encarecen el siguiente', 10, { freeEgg: 0.08 }],
  b8b: ['egg', 'Puesta sin precio III', '+8% de huevos que no encarecen el siguiente', 12, { freeEgg: 0.08 }],
  b8c: ['egg', 'Cría gratuita', '+10% de huevos que no encarecen el siguiente', { bio: 80 }, { freeEgg: 0.1 }, K],
  b6a: ['larva', 'Eclosión rápida', '5% de los huevos se saltan la fase de larva', 9, { instaHatch: 0.05 }],
  b6b: ['larva', 'Eclosión rápida II', '+5% de huevos sin fase de larva', 11, { instaHatch: 0.05 }],
  b6c: ['larva', 'Larvas precoces', '+10% de huevos sin fase de larva', { bio: 50 }, { instaHatch: 0.1 }, K],
  // ---- Recolección
  fo1: ['leaf', 'Buche grande I', '+25% de comida por viaje', 1, { food: 0.25 }],
  fo3: ['leaf', 'Buche grande II', '+25% de comida por viaje', 2, { food: 0.25 }],
  fo5: ['leaf', 'Buche grande III', '+30% de comida por viaje', 3, { food: 0.3 }],
  fo6: ['leaf', 'Hojas grandes', '+35% de comida por viaje', 4, { food: 0.35 }],
  fo8: ['leaf', 'Buche grande IV', '+40% de comida por viaje', 6, { food: 0.4 }],
  fo10: ['leaf', 'Buche grande V', '+50% de comida por viaje', 7, { food: 0.5 }],
  f1a: ['leaf', 'Buche grande VI', '+50% de comida por viaje', 9, { food: 0.5 }],
  f1b: ['leaf', 'Buche grande VII', '+60% de comida por viaje', 10, { food: 0.6 }],
  f1c: ['leaf', 'Buche grande VIII', '+70% de comida por viaje', 11, { food: 0.7 }],
  f1d: ['leaf', 'Buche sin fondo', 'Comida por viaje ×1,5', { bio: 70 }, { foodX: 1.5 }, K],
  fo2: ['boot', 'Patas ágiles I', '+10% de velocidad', 1, { speed: 0.1 }],
  fo4: ['boot', 'Patas ágiles II', '+10% de velocidad', 3, { speed: 0.1 }],
  fo7: ['boot', 'Patas ágiles III', '+12% de velocidad', 4, { speed: 0.12 }],
  fo9: ['boot', 'Patas ágiles IV', '+15% de velocidad', 6, { speed: 0.15 }],
  f8a: ['boot', 'Patas ágiles V', '+15% de velocidad', 9, { speed: 0.15 }],
  f8b: ['boot', 'Patas ágiles VI', '+18% de velocidad', 11, { speed: 0.18 }],
  f8c: ['boot', 'Patas ágiles VII', '+20% de velocidad', 13, { speed: 0.2 }],
  fo11: ['coin', 'Botín nocturno', '+50% de jalea al ganar una noche', 3, { prize: 0.5 }],
  qj1: ['crown', 'Jalea real I', 'La jalea que genera la reina +50%', 3, { qJellyP: 0.5 }, QJ],
  qj2: ['crown', 'Jalea real II', 'La jalea que genera la reina +75%', 6, { qJellyP: 0.75 }, QJ],
  qj3: ['crown', 'Jalea real III', 'La jalea que genera la reina +100%', 9, { qJellyP: 1 }, QJ],
  qjK: ['crown', 'Corona de jalea', 'La jalea que genera la reina +150%', { bio: 30 }, { qJellyP: 1.5 }, { ...K, ...QJ }],
  lc1: ['clover', 'Cosecha afortunada I', '8% de probabilidad de que una entrega valga ×2', 3, { luck: 0.08 }],
  lc2: ['clover', 'Cosecha afortunada II', '+12% de probabilidad de entrega ×2', 5, { luck: 0.12 }],
  f7a: ['clover', 'Cosecha afortunada III', '+10% de probabilidad de entrega ×2', 9, { luck: 0.1 }],
  f7b: ['clover', 'Cosecha afortunada IV', '+10% de probabilidad de entrega ×2', 11, { luck: 0.1 }],
  f7c: ['clover', 'Trébol dorado', '+12% de entregas ×2 y +3% de comida dorada', { bio: 70 }, { luck: 0.12, goldFood: 0.03 }, K],
  foK1: ['leaf', 'Rastro de feromonas', 'Comida por viaje ×1,5', { bio: 3 }, { foodX: 1.5 }, K],
  foK2: ['leaf', 'Doble carga', 'Comida por viaje ×2', { bio: 8 }, { foodX: 2 }, K],
  foK4: ['leaf', 'Cosecha masiva', 'Comida por viaje ×2', { bio: 30 }, { foodX: 2 }, K],
  f9: ['leaf', 'Cosecha legendaria', 'Comida por viaje ×2', { bio: 140 }, { foodX: 2 }, K],
  fo12: ['leaf', 'Despensa', '+30% de comida y la reina produce +50%', 6, { food: 0.3, reserve: 0.5 }],
  f2a: ['leaf', 'Despensa II', '+30% de comida y la reina produce +50%', 9, { food: 0.3, reserve: 0.5 }],
  f2b: ['leaf', 'Despensa III', '+40% de comida y la reina produce +60%', 11, { food: 0.4, reserve: 0.6 }],
  f2c: ['leaf', 'Granero', 'Comida ×1,3 y la reina produce +100%', { bio: 55 }, { foodX: 1.3, reserve: 1 }, K],
  gf1: ['goldleaf', 'Comida dorada', '3% de las entregas son comida dorada: ×5', 6, { goldFood: 0.03 }],
  f4a: ['goldleaf', 'Comida dorada II', '+3% de comida dorada (×5)', 10, { goldFood: 0.03 }],
  f4b: ['goldleaf', 'Comida dorada III', '+3% de comida dorada', 12, { goldFood: 0.03 }],
  f4c: ['goldleaf', 'Ambrosía', '+5% de comida dorada', { bio: 80 }, { goldFood: 0.05 }, K],
  gf2: ['goldleaf', 'Néctar real', '+4% de comida dorada', 8, { goldFood: 0.04 }],
  f5a: ['goldleaf', 'Néctar real II', '+3% de comida dorada', 11, { goldFood: 0.03 }],
  f5b: ['goldleaf', 'Néctar real III', '+3% de comida dorada', 13, { goldFood: 0.03 }],
  f5c: ['goldleaf', 'Fuente de néctar', '+5% de comida dorada', { bio: 100 }, { goldFood: 0.05 }, K],
  foK3: ['moon', 'Rutas nocturnas', 'Por la noche siguen entrando provisiones', { bio: 14 }, { nightWork: 1 }, K],
  fo13: ['boot', 'Exploradoras', '+20% de comida y +10% de velocidad', 8, { food: 0.2, speed: 0.1 }],
  f6a: ['boot', 'Exploradoras II', '+20% de comida y +10% de velocidad', 10, { food: 0.2, speed: 0.1 }],
  f6b: ['boot', 'Exploradoras III', '+25% de comida y +12% de velocidad', 12, { food: 0.25, speed: 0.12 }],
  f6c: ['boot', 'Mapa del bosque', 'Comida ×1,3 y +30% de velocidad', { bio: 90 }, { foodX: 1.3, speed: 0.3 }, K],
  f3a: ['moon', 'Turno de noche', '+50% de jalea al ganar una noche', 9, { prize: 0.5 }],
  f3b: ['coin', 'Botín nocturno II', '+50% de jalea al ganar una noche', 10, { prize: 0.5 }],
  f3c: ['coin', 'Botín nocturno III', '+60% de jalea al ganar una noche', 11, { prize: 0.6 }],
  f3d: ['coin', 'Tesoro de guerra', '+150% de jalea al ganar una noche', { bio: 50 }, { prize: 1.5 }, K],
  fs1: ['goldleaf', 'Festín', '+0,2% de probabilidad de festín: una entrega vale ×50 y llueve comida en la boca de la reina', 9, { feast: 0.002 }],
  fs2: ['goldleaf', 'Festín II', '+0,4% de probabilidad de festín', 12, { feast: 0.004 }],
  fsK: ['goldleaf', 'Festín real', '+0,6% de probabilidad de festín', { bio: 50 }, { feast: 0.006 }, K],
  // ---- Guerra
  wa1: ['sword', 'Mandíbulas I', '+25% de daño', 1, { dmg: 0.25 }],
  wa3: ['sword', 'Mandíbulas II', '+25% de daño', 2, { dmg: 0.25 }],
  wa5: ['sword', 'Mandíbulas III', '+30% de daño', 3, { dmg: 0.3 }],
  wa10: ['sword', 'Mandíbulas IV', '+40% de daño', 6, { dmg: 0.4 }],
  wa11: ['sword', 'Mandíbulas V', '+50% de daño', 8, { dmg: 0.5 }],
  w1a: ['sword', 'Mandíbulas VI', '+50% de daño', 9, { dmg: 0.5 }],
  w1b: ['sword', 'Mandíbulas VII', '+60% de daño', 10, { dmg: 0.6 }],
  w1c: ['sword', 'Mandíbulas VIII', '+70% de daño', 11, { dmg: 0.7 }],
  w1d: ['sword', 'Mandíbulas de acero', 'Daño ×1,5', { bio: 70 }, { dmgX: 1.5 }, K],
  wa2: ['shield', 'Caparazón I', '+25% de vida', 1, { hp: 0.25 }],
  wa4: ['shield', 'Caparazón II', '+25% de vida', 3, { hp: 0.25 }],
  wa6: ['shield', 'Caparazón III', '+30% de vida', 4, { hp: 0.3 }],
  wa8: ['shield', 'Caparazón IV', '+40% de vida', 6, { hp: 0.4 }],
  wa12: ['shield', 'Caparazón V', '+50% de vida', 8, { hp: 0.5 }],
  w6a: ['shield', 'Caparazón VI', '+50% de vida', 9, { hp: 0.5 }],
  w6b: ['shield', 'Caparazón VII', '+60% de vida', 10, { hp: 0.6 }],
  w6c: ['shield', 'Caparazón VIII', '+70% de vida', 11, { hp: 0.7 }],
  w6d: ['shield', 'Coraza de diamante', 'Vida ×1,5', { bio: 80 }, { hpX: 1.5 }, K],
  mx2: ['shield', 'Guardia del nido', '+15% de daño y de vida', 3, { dmg: 0.15, hp: 0.15 }],
  mx3: ['flame', 'Nido templado', '+15% de cría y +10% de vida', 5, { growth: 0.15, hp: 0.1 }],
  w2a: ['shield', 'Guardia del nido II', '+20% de daño y de vida', 9, { dmg: 0.2, hp: 0.2 }],
  w2b: ['shield', 'Guardia del nido III', '+25% de daño y de vida', 11, { dmg: 0.25, hp: 0.25 }],
  w2c: ['shield', 'Muralla viva', 'Vida ×1,4 y daño ×1,2', { bio: 60 }, { hpX: 1.4, dmgX: 1.2 }, K],
  waK1: ['sword', 'Mandíbulas afiladas', 'Daño ×1,5', { bio: 3 }, { dmgX: 1.5 }, K],
  waK3: ['fist', 'Mandíbula reforzada', 'Mutación: daño ×2 y mandíbulas enormes', { bio: 14 }, { dmgX: 2, jaw: 1 }, K],
  waK4: ['fist', 'Furia de la colonia', 'Daño ×1,4', { bio: 30 }, { dmgX: 1.4 }, K],
  w9: ['fist', 'Ejército invencible', 'Daño y vida ×1,5', { bio: 140 }, { dmgX: 1.5, hpX: 1.5 }, K],
  wa7: ['seed', 'Saqueo', '+1 biomasa por enemigo', 4, { bioKill: 1 }],
  w3a: ['seed', 'Saqueo II', '+1 biomasa por enemigo', 9, { bioKill: 1 }],
  w3b: ['seed', 'Saqueo III', '+1 biomasa por enemigo', 11, { bioKill: 1 }],
  w3c: ['seed', 'Carroñeras', '+2 biomasa por enemigo', { bio: 50 }, { bioKill: 2 }, K],
  waK2: ['shield', 'Quitina gruesa', 'Vida ×1,5', { bio: 6 }, { hpX: 1.5 }, K],
  w8a: ['shield', 'Escudo de quitina', '+30% de vida y +3% de esquivar', 11, { hp: 0.3, dodge: 0.03 }],
  w8b: ['shield', 'Escudo de quitina II', '+40% de vida y +3% de esquivar', 13, { hp: 0.4, dodge: 0.03 }],
  wa9: ['coin', 'Botín de guerra', '+50% de jalea al ganar una noche', 6, { prize: 0.5 }],
  w7a: ['coin', 'Botín de guerra II', '+50% de jalea al ganar una noche', 9, { prize: 0.5 }],
  w7b: ['coin', 'Botín de guerra III', '+60% de jalea al ganar una noche', 11, { prize: 0.6 }],
  wa13: ['shield', 'Veteranas', '10% de probabilidad de esquivar un golpe mortal', 7, { dodge: 0.1 }],
  wa14: ['shield', 'Veteranas II', '+10% de probabilidad de esquivar', 8, { dodge: 0.1 }],
  w5a: ['shield', 'Veteranas III', '+5% de probabilidad de esquivar', 10, { dodge: 0.05 }],
  w5b: ['shield', 'Veteranas IV', '+5% de probabilidad de esquivar', 12, { dodge: 0.05 }],
  w5c: ['shield', 'Inmortales', '+8% de esquivar y vida ×1,2', { bio: 100 }, { dodge: 0.08, hpX: 1.2 }, K],
  w4a: ['fist', 'Rabia', '+40% de daño', 10, { dmg: 0.4 }],
  w4b: ['fist', 'Rabia II', '+50% de daño', 12, { dmg: 0.5 }],
  w4c: ['fist', 'Frenesí', 'Daño ×1,5', { bio: 90 }, { dmgX: 1.5 }, K],
  // ---- Toques
  ta1: ['hand', 'Caricia I', '+30% de efecto de tus toques', 1, { click: 0.3 }],
  ta4: ['hand', 'Caricia II', '+40% de efecto de tus toques', 3, { click: 0.4 }],
  ta7: ['hand', 'Caricia III', '+50% de efecto de tus toques', 5, { click: 0.5 }],
  ta9: ['hand', 'Caricia IV', '+60% de efecto de tus toques', 7, { click: 0.6 }],
  t6a: ['hand', 'Caricia V', '+70% de efecto de tus toques', 9, { click: 0.7 }],
  t6b: ['hand', 'Caricia VI', '+80% de efecto de tus toques', 10, { click: 0.8 }],
  t6c: ['hand', 'Caricia VII', '+100% de efecto de tus toques', 12, { click: 1 }],
  t6d: ['hand', 'Manos de oro', 'Tus toques ×2', { bio: 80 }, { clickX: 2 }, K],
  ta2: ['crown', 'Masaje real', 'Tocar a la reina rinde +50%', 1, { tapQ: 0.5 }],
  t7a: ['crown', 'Masaje real II', 'Tocar a la reina rinde +50%', 9, { tapQ: 0.5 }],
  t7b: ['crown', 'Masaje real III', 'Tocar a la reina rinde +60%', 11, { tapQ: 0.6 }],
  t7c: ['crown', 'Banquete real', 'Tocar a la reina rinde +100%', { bio: 60 }, { tapQ: 1 }, K],
  ta3: ['larva', 'Mimo a la cría', 'Tocar huevos y larvas rinde +50%', 2, { tapB: 0.5 }],
  ta6: ['larva', 'Mimo a la cría II', 'Tocar huevos y larvas rinde +50%', 4, { tapB: 0.5 }],
  tb1: ['larva', 'Mimo contagioso', 'Tocar un huevo o una larva adelanta también al resto de la cría un 25% de lo que adelanta ese toque', 6, { tapSplash: 0.25 }],
  t8a: ['larva', 'Mimo a la cría III', 'Tocar huevos y larvas rinde +50%', 9, { tapB: 0.5 }],
  tb2: ['larva', 'Mimo contagioso II', 'El resto de la cría se lleva otro 25% de cada toque', 10, { tapSplash: 0.25 }],
  t8b: ['larva', 'Mimo a la cría IV', 'Tocar huevos y larvas rinde +60%', 11, { tapB: 0.6 }],
  t8c: ['larva', 'Nodrizas mimadas', 'Tocar la cría rinde +100% y crece un 20% más rápido', { bio: 70 }, { tapB: 1, growth: 0.2 }, K],
  ta5: ['bolt', 'Golpe certero', 'Tocar enemigos hace el doble', 3, { tapFoe: 1 }],
  ta8: ['bolt', 'Golpe certero II', 'Tocar enemigos hace el doble', 5, { tapFoe: 1 }],
  ta11: ['bolt', 'Golpe certero III', 'Tocar enemigos ×2,5', 7, { tapFoe: 1.5 }],
  t3a: ['bolt', 'Golpe certero IV', 'Tocar enemigos hace +150%', 9, { tapFoe: 1.5 }],
  t3b: ['bolt', 'Golpe certero V', 'Tocar enemigos hace +200%', 11, { tapFoe: 2 }],
  t3c: ['bolt', 'Puño de la reina', 'Tocar enemigos hace +300%', { bio: 50 }, { tapFoe: 3 }, K],
  lk1: ['star', 'Toque de suerte I', '5% de probabilidad de que un toque valga ×2', 3, { tapCrit: 0.05 }],
  lk2: ['star', 'Toque de suerte II', '+10% de probabilidad de toque ×2', 5, { tapCrit: 0.1 }],
  lk3: ['star', 'Toque de suerte III', '+10% de probabilidad de toque de suerte', 8, { tapCrit: 0.1 }],
  t5a: ['star', 'Toque de suerte IV', '+8% de probabilidad de toque de suerte', 10, { tapCrit: 0.08 }],
  t5b: ['star', 'Toque de suerte V', '+8% de probabilidad de toque de suerte', 12, { tapCrit: 0.08 }],
  lkK: ['star', 'Golpe de fortuna', 'Los toques de suerte valen ×5 en vez de ×2', { bio: 12 }, { critBig: 1 }, K],
  t5c: ['star', 'Toque divino', '+10% de toques de suerte y tus toques ×1,5', { bio: 90 }, { tapCrit: 0.1, clickX: 1.5 }, K],
  tn1: ['leaf', 'Toque nutritivo I', 'Cada toque a la reina suma un 0,5% de lo que tu colonia recolecta por segundo', 4, { tapRate: 0.005 }],
  tn2: ['leaf', 'Toque nutritivo II', 'Cada toque a la reina suma otro 0,5% de lo que recolecta la colonia por segundo', 7, { tapRate: 0.005 }],
  tn3: ['leaf', 'Toque nutritivo III', 'Cada toque a la reina suma otro 1% de lo que recolecta la colonia por segundo', 10, { tapRate: 0.01 }],
  tnK: ['leaf', 'Mano que alimenta', 'Cada toque a la reina suma otro 1% de lo que recolecta la colonia por segundo', { bio: 40 }, { tapRate: 0.01 }, K],
  taK1: ['hand', 'Manos de reina', 'Tus toques ×2', { bio: 4 }, { clickX: 2 }, K],
  t9: ['hand', 'Mano de la reina', 'Tus toques ×2 y +5% de toques de suerte', { bio: 140 }, { clickX: 2, tapCrit: 0.05 }, K],
  ghK: ['ghost', 'Mano fantasma', 'Una mano invisible da de comer a la reina sola (1 toque cada 8 s). Mientras tengas racha, sus toques también la suben', { bio: 5 }, { ghost: 0.125 }, K],
  mh2: ['ghost', 'Segunda mano', 'Otra mano fantasma: un toque cada 5 s', { bio: 8 }, { ghost: 0.2 }, { ...K, reqPerk: 'pgh4' }],
  mh3: ['ghost', 'Tercera mano', 'Otra mano fantasma: un toque cada 4 s', { bio: 16 }, { ghost: 0.25 }, { ...K, reqPerk: 'pgh5' }],
  mh4: ['ghost', 'Cuarta mano', 'Otra mano fantasma: un toque cada 3 s', { bio: 28 }, { ghost: 1 / 3 }, { ...K, reqPerk: 'pgh6' }],
  mh5: ['ghost', 'Quinta mano', 'Otra mano fantasma: un toque cada 2 s', { bio: 40 }, { ghost: 0.5 }, { ...K, reqPerk: 'pgh7' }],
  gh2: ['ghost', 'Mano veloz', 'La mano fantasma toca un 50% más rápido', 6, { ghostX: 1.5 }],
  gh3: ['ghost', 'Mano experta', 'La mano fantasma toca un 40% más rápido', 8, { ghostX: 1.4 }],
  t1a: ['ghost', 'Mano veloz II', 'La mano fantasma toca un 30% más rápido', 9, { ghostX: 1.3 }],
  t2a: ['ghost', 'Mano experta II', 'La mano fantasma toca un 25% más rápido', 10, { ghostX: 1.25 }],
  t1b: ['ghost', 'Mano veloz III', 'La mano fantasma toca un 30% más rápido', 11, { ghostX: 1.3 }],
  t2b: ['ghost', 'Mano experta III', 'La mano fantasma toca un 25% más rápido', 12, { ghostX: 1.25 }],
  t1c: ['ghost', 'Mil manos', 'Una segunda mano fantasma (+1 toque cada 4 s)', { bio: 70 }, { ghost: 0.25 }, K],
  taK2: ['coin', 'Toque dorado', 'Tocar a la reina también da jalea', { bio: 10 }, { gold: 1 }, K],
  // racha: cada toque seguido rinde más (rules.comboTap). Necesita «Racha» en el linaje
  cb1: ['bolt', 'Ritmo I', 'Cada toque de la racha rinde +1% más', 10, { comboStep: 0.01 }, RACHA],
  cb2: ['bolt', 'Racha larga', 'La racha llega a 10 toques más', 11, { comboCap: 10 }, RACHA],
  cb3: ['hand', 'Dedos ligeros', 'Medio segundo más entre toques sin perder la racha', 11, { comboGap: 0.5 }, RACHA],
  cb5: ['bolt', 'Marca temprana', 'Las marcas de la racha llegan un 10% antes', 11, { comboEarly: 0.1 }, RACHA],
  cb4: ['bolt', 'Ritmo II', 'Cada toque de la racha rinde +1,5% más', 12, { comboStep: 0.015 }, RACHA],
  cb6: ['bolt', 'Marca temprana II', 'Las marcas de la racha llegan otro 10% antes', 13, { comboEarly: 0.1 }, RACHA],
  cbK2: ['shield', 'Racha blindada', 'Al perder la racha conservas un 25% de la cuenta', { bio: 60 }, { comboKeep: 0.25 }, { ...K, ...RACHA }],
  cbK: ['bolt', 'Racha desatada', 'El extra de la racha ×2', { bio: 80 }, { comboX: 2 }, { ...K, ...RACHA }]
};

/* ---------------- árbol de la colonia: forma ---------------- */
// por rama, en orden de tronco: [nodo del tronco, ...su costilla]
const SL = {
  food: [
    ['fo1', 'fo3', 'fo5', 'fo6', 'fo8', 'fo10', 'f1a', 'f1b', 'f1c', 'f1d'],
    ['fo2', 'fo4', 'fo7', 'fo9', 'f8a', 'f8b', 'f8c'],
    ['fo11', 'qj1', 'qj2', 'qj3', 'qjK'],
    ['lc1', 'lc2', 'f7a', 'f7b', 'f7c'],
    ['foK1', 'foK2', 'foK4', 'f9'],
    ['fo12', 'f2a', 'f2b', 'f2c'],
    ['gf1', 'f4a', 'f4b', 'f4c'],
    ['gf2', 'f5a', 'f5b', 'f5c'],
    ['foK3', 'fo13', 'f6a', 'f6b', 'f6c'],
    ['f3a', 'f3b', 'f3c', 'f3d'],
    ['fs1', 'fs2', 'fsK']
  ],
  war: [
    ['wa1', 'wa3', 'wa5', 'wa10', 'wa11', 'w1a', 'w1b', 'w1c', 'w1d'],
    ['wa2', 'wa4', 'wa6', 'wa8', 'wa12', 'w6a', 'w6b', 'w6c', 'w6d'],
    ['mx2', 'mx3', 'w2a', 'w2b', 'w2c'],
    ['waK1', 'waK3', 'waK4', 'w9'],
    ['wa7', 'w3a', 'w3b', 'w3c'],
    ['waK2', 'w8a', 'w8b'],
    ['wa9', 'w7a', 'w7b'],
    ['wa13', 'wa14', 'w5a', 'w5b', 'w5c'],
    ['w4a', 'w4b', 'w4c']
  ],
  tap: [
    ['ta1', 'ta4', 'ta7', 'ta9', 't6a', 't6b', 't6c', 't6d'],
    ['ta2', 't7a', 't7b', 't7c'],
    ['ta3', 'ta6', 'tb1', 't8a', 'tb2', 't8b', 't8c'],
    ['ta5', 'ta8', 'ta11', 't3a', 't3b', 't3c'],
    ['lk1', 'lk2', 'lk3', 't5a', 't5b', 'lkK', 't5c'], // + Fortuna I–III (ver RING)
    ['tn1', 'tn2', 'tn3', 'tnK'],
    ['taK1', 't9'],
    ['ghK', 'mh2', 'mh3', 'mh4', 'mh5'],
    ['gh2', 'gh3', 't1a', 't2a', 't1b', 't2b', 't1c'],
    ['taK2', 'cb1', 'cb2', 'cb3', 'cb5', 'cb4', 'cb6', 'cbK2', 'cbK'] // + Compás I–VI (ver RING)
  ],
  brood: [
    ['br1', 'br5', 'br6', 'br9', 'br8', 'br12', 'b2a', 'b2b', 'b2c', 'b2d'],
    ['br2', 'br4', 'br7', 'br11', 'b3b', 'b3c', 'b3d'],
    ['br3', 'mx1', 'br10', 'b1a', 'b1b', 'b1c', 'b1d'],
    ['brK1', 'ta10', 't4a', 't4b', 't4c'],
    ['brK2', 'b5a', 'b5b', 'b5d', 'b5c'],
    ['sh1', 'sh2', 'b4a', 'b4b', 'shK', 'sh3', 'b4c'],
    ['br13', 'b7a', 'b7b', 'b7c'],
    ['brK3', 'brK4', 'b3a', 'b9'],
    ['brK5', 'b8a', 'b8b', 'b8c'],
    ['b6a', 'b6b', 'b6c']
  ]
};

/* ---------------- linaje: contenido ---------------- */
const PN = {
  // ---- Cría
  pe1: ['egg', 'Huevos fuertes', 'Cada huevo cuesta un 10% menos de comida', { adn: 1 }, { eggCostX: 0.9 }],
  pe2: ['egg', 'Puesta ancestral', 'Cada huevo cuesta un 20% menos de comida', { adn: 15 }, { eggCostX: 0.8 }],
  plb2: ['egg', 'Puesta barata', 'Cada huevo cuesta un 8% menos de comida', { adn: 28 }, { eggCostX: 0.92 }],
  pg1: ['flame', 'Nido cálido', '+25% de velocidad de cría', { adn: 2 }, { growth: 0.25 }],
  plb1: ['flame', 'Nodrizas del linaje', '+15% de velocidad de cría. «Nodrizas» es tuya en el árbol', { adn: 16 }, { growth: 0.15 }, { own: ['brK1'] }],
  plb3: ['flame', 'Cría veloz', 'La cría ×1,3', { adn: 48 }, { growthX: 1.3 }],
  prs: ['crown', 'Reina robusta', 'La reina produce el triple por su cuenta', { adn: 2 }, { reserve: 2 }],
  pcv: ['crown', 'Sangre real', 'Los huevos se encarecen más despacio', { adn: 10 }, { curve: 0.015 }],
  pdx1: ['eggs2', 'Puesta generosa', '8% de probabilidad de que la reina ponga un huevo extra gratis', { adn: 4 }, { extraEgg: 0.08 }],
  pqk: ['larva', 'Eclosión precoz', '15% de los huevos se saltan la fase de larva', { adn: 10 }, { instaHatch: 0.15 }],
  pdx2: ['eggs2', 'Puesta generosa II', '+12% de probabilidad de huevo extra', { adn: 14 }, { extraEgg: 0.12 }],
  pfe1: ['egg', 'Huevo sin precio', '10% de probabilidad de que un huevo no encarezca el siguiente', { adn: 5 }, { freeEgg: 0.1 }],
  pfe2: ['egg', 'Huevo sin precio II', '+15% de probabilidad de que no encarezca', { adn: 16 }, { freeEgg: 0.15 }],
  plb5: ['egg', 'Huevo heredado', 'Un 6% de los huevos no encarecen el siguiente. «Puesta sin precio» es tuya en el árbol', { adn: 96 }, { freeEgg: 0.06 }, { own: ['brK5'] }],
  ptw: ['eggs2', 'Gemelas', 'Uno de cada diez huevos trae gemelas', { adn: 6 }, { twin: 0.1 }],
  plb4: ['eggs2', 'Gemelas del linaje', 'Un 6% más de huevos traen gemelas. «Puesta doble» es tuya en el árbol', { adn: 64 }, { twin: 0.06 }, { own: ['brK2'] }],
  psh: ['sparkle', 'Sangre dorada', '+3% de hormigas doradas en todas las colonias', { adn: 6 }, { shiny: 0.03 }],
  psh2: ['sparkle', 'Estirpe dorada', '+6% de hormigas doradas', { adn: 14 }, { shiny: 0.06 }],
  psh3: ['sparkle', 'Realeza dorada', 'Las doradas traen ×5 comida y pegan ×3 desde el primer día', { adn: 24 }, { shinyElite: 1 }],
  pls1: ['sparkle', 'Brillo heredado', '+4% de hormigas doradas. «Linaje dorado» es tuya en el árbol', { adn: 28 }, { shiny: 0.04 }, { own: ['shK'] }],
  pls2: ['sparkle', 'Élite heredada', '+4% de hormigas doradas. «Doradas de élite» es tuya en el árbol', { adn: 64 }, { shiny: 0.04 }, { own: ['sh3'] }],
  // ---- Recolección
  pf1: ['leaf', 'Memoria del camino', '+20% de comida en todas las colonias', { adn: 1 }, { food: 0.2 }],
  pf2: ['leaf', 'Buche heredado', '+30% de comida', { adn: 3 }, { food: 0.3 }],
  pf3: ['leaf', 'Gran buche', 'Comida ×1,5', { adn: 8 }, { foodX: 1.5 }],
  pf4: ['leaf', 'Hambre ancestral', 'Comida ×2', { adn: 20 }, { foodX: 2 }],
  psp: ['boot', 'Patas largas', '+15% de velocidad', { adn: 3 }, { speed: 0.15 }],
  ppz: ['coin', 'Tributo', '+100% de jalea al ganar una noche', { adn: 3 }, { prize: 1 }],
  pqj1: ['crown', 'Reina productora', 'La reina genera 1 de jalea por segundo en todas las colonias (y eso también la hace crecer)', { adn: 30 }, { qJelly: 1 }],
  pqj2: ['crown', 'Reina productora II', 'La reina genera 3 de jalea por segundo más', { adn: 70 }, { qJelly: 3 }],
  pqj3: ['crown', 'Reina productora III', 'La reina genera 8 de jalea por segundo más', { adn: 140 }, { qJelly: 8 }],
  pgf: ['goldleaf', 'Néctar dorado', '+4% de comida dorada (×5) en todas las colonias', { adn: 8 }, { goldFood: 0.04 }],
  pgf2: ['goldleaf', 'Banquete dorado', '+5% de comida dorada', { adn: 18 }, { goldFood: 0.05 }],
  plf1: ['leaf', 'Rastro heredado', '+20% de comida. «Rastro de feromonas» es tuya en el árbol', { adn: 16 }, { food: 0.2 }, { own: ['foK1'] }],
  plf2: ['leaf', 'Buche del linaje', '+25% de comida', { adn: 32 }, { food: 0.25 }],
  plf3: ['leaf', 'Carga ancestral', 'Comida ×1,4', { adn: 56 }, { foodX: 1.4 }],
  plf4: ['moon', 'Noche heredada', '+15% de comida. «Rutas nocturnas» es tuya en el árbol', { adn: 72 }, { food: 0.15 }, { own: ['foK3'] }],
  pfs1: ['goldleaf', 'Festín ancestral', '+0,3% de festín (entrega ×50) en todas las colonias', { adn: 48 }, { feast: 0.003 }],
  pfs2: ['goldleaf', 'Festín eterno', '+0,6% de festín', { adn: 96 }, { feast: 0.006 }],
  pfs3: ['goldleaf', 'Festín de la estirpe', '+0,8% de festín. Con todo comprado, el festín llega a su máximo: 3%', { adn: 160 }, { feast: 0.008 }],
  // ---- Guerra
  pd1: ['sword', 'Instinto de lucha', '+20% de daño', { adn: 1 }, { dmg: 0.2 }],
  pd2: ['sword', 'Mandíbula heredada', '+30% de daño', { adn: 3 }, { dmg: 0.3 }],
  pd3: ['fist', 'Furia ancestral', 'Daño ×1,5', { adn: 8 }, { dmgX: 1.5 }],
  pd4: ['fist', 'Ira de la estirpe', 'Daño ×2', { adn: 20 }, { dmgX: 2 }],
  ph1: ['shield', 'Piel dura', '+20% de vida', { adn: 1 }, { hp: 0.2 }],
  ph2: ['shield', 'Quitina heredada', '+30% de vida', { adn: 3 }, { hp: 0.3 }],
  ph3: ['shield', 'Coraza ancestral', 'Vida ×1,5', { adn: 8 }, { hpX: 1.5 }],
  ph4: ['shield', 'Caparazón eterno', 'Vida ×2', { adn: 20 }, { hpX: 2 }],
  pbk: ['seed', 'Carroñeras', '+1 biomasa por enemigo', { adn: 4 }, { bioKill: 1 }],
  pbio: ['seed', 'Biomasa ancestral', 'Cada colonia empieza con 6 de biomasa', { adn: 8 }, { startBio: 6 }],
  pdg: ['shield', 'Supervivientes', '8% de probabilidad de esquivar un golpe mortal', { adn: 10 }, { dodge: 0.08 }],
  plv: ['crown', 'Nido fortificado', 'Una vez por colonia, la reina resiste el asalto', { adn: 12 }, { lives: 1 }],
  plw1: ['sword', 'Mandíbulas del linaje', '+20% de daño. «Mandíbulas afiladas» es tuya en el árbol', { adn: 16 }, { dmg: 0.2 }, { own: ['waK1'] }],
  plw2: ['shield', 'Quitina del linaje', '+20% de vida. «Quitina gruesa» es tuya en el árbol', { adn: 24 }, { hp: 0.2 }, { own: ['waK2'] }],
  plw3: ['fist', 'Furia del linaje', 'Daño ×1,35', { adn: 48 }, { dmgX: 1.35 }],
  plw4: ['shield', 'Coraza del linaje', 'Vida ×1,35', { adn: 48 }, { hpX: 1.35 }],
  plw5: ['fist', 'Mandíbula enorme', '+25% de daño. «Mandíbula reforzada» es tuya en el árbol', { adn: 100 }, { dmg: 0.25 }, { own: ['waK3'] }],
  pst1: ['shield', 'Exoesqueleto titánico', 'Tus hormigas aguantan un pisotón humano más', { adn: 120 }, { stompHits: 1 }],
  pst2: ['shield', 'Exoesqueleto titánico II', 'Tus hormigas aguantan otro pisotón humano más', { adn: 240 }, { stompHits: 1 }],
  pst3: ['shield', 'Exoesqueleto titánico III', 'Tus hormigas aguantan otro pisotón humano más', { adn: 400 }, { stompHits: 1 }],
  // ---- Toques y fundación
  ps1: ['ant', 'Escolta', 'Cada colonia empieza con 2 hormigas', { adn: 2 }, { startAnts: 2 }],
  pse: ['egg', 'Nido preparado', 'Cada colonia empieza con 3 huevos puestos', { adn: 6 }, { startEggs: 3 }],
  ps2: ['ant', 'Séquito', 'Empiezas con 3 hormigas más', { adn: 7 }, { startAnts: 3 }],
  ps3: ['ant', 'Ejército fundador', 'Empiezas con 5 hormigas más', { adn: 18 }, { startAnts: 5 }],
  pj1: ['leaf', 'Despensa inicial', 'Cada colonia empieza con 40 de jalea', { adn: 2 }, { startJelly: 40 }],
  pj2: ['coin', 'Tesoro real', 'Empiezas con 250 de jalea más', { adn: 8 }, { startJelly: 250 }],
  pkp: ['coin', 'Herencia', 'La colonia nueva empieza con el 5% de la jalea que reunió la anterior', { adn: 10 }, { keepJelly: 0.05 }],
  pns: ['crown', 'Todo para la reina', 'Cuando en el árbol de la colonia ya no queda nada que comprar con jalea, las obreras dejan de guardar en la despensa y le llevan toda la comida a la reina', { adn: 12 }, { noStore: 1 }],
  ptp: ['bolt', 'Racha', 'Desbloquea la racha: cada toque seguido rinde más. Además, tus toques ×1,2', { adn: 4 }, { combo: 1, clickX: 1.2 }],
  pcb1: ['bolt', 'Ritmo heredado', 'Cada toque de la racha rinde +1% más, en todas las colonias', { adn: 6 }, { comboStep: 0.01 }],
  pcb2: ['bolt', 'Racha ancestral', 'La racha llega a 10 toques más', { adn: 10 }, { comboCap: 10 }],
  pcb3: ['hand', 'Pulso de la estirpe', 'Cuatro décimas más entre toques sin perder la racha', { adn: 14 }, { comboGap: 0.4 }],
  pck: ['shield', 'Racha tenaz', 'Al perder la racha conservas un 25% de la cuenta, en todas las colonias', { adn: 80 }, { comboKeep: 0.25 }],
  pce: ['bolt', 'Memoria del ritmo', 'Las marcas de la racha llegan un 10% antes', { adn: 100 }, { comboEarly: 0.1 }],
  pl1: ['clover', 'Trébol de cuatro hojas', '+5% de toques ×2 y +5% de entregas ×2', { adn: 4 }, { tapCrit: 0.05, luck: 0.05 }],
  pl2: ['clover', 'Fortuna ancestral', '+8% de toques ×2 y +8% de entregas ×2', { adn: 10 }, { tapCrit: 0.08, luck: 0.08 }],
  plt5: ['star', 'Fortuna del linaje', '+6% de toques de suerte. «Golpe de fortuna» es tuya en el árbol', { adn: 80 }, { tapCrit: 0.06 }, { own: ['lkK'] }],
  pgh1: ['ghost', 'Mano fantasma', 'En todas las colonias, una mano invisible toca a la reina cada 5 s', { adn: 5 }, { ghost: 0.2 }],
  pgh2: ['ghost', 'Mano incansable', 'La mano fantasma toca un 60% más rápido', { adn: 10 }, { ghostX: 1.6 }],
  pgh3: ['ghost', 'Mano de oro', 'La mano toca un 20% más rápido y +8% de toques ×2', { adn: 12 }, { ghostX: 1.2, tapCrit: 0.08 }],
  pgh4: ['ghost', 'Segunda mano', 'Otra mano fantasma en todas las colonias: un toque cada 5 s. En el árbol es tuya para siempre', { adn: 20 }, {}, { own: ['mh2'] }],
  pgh5: ['ghost', 'Tercera mano', 'Otra mano fantasma: un toque cada 4 s, para siempre', { adn: 44 }, {}, { own: ['mh3'] }],
  pgh6: ['ghost', 'Cuarta mano', 'Otra mano fantasma: un toque cada 3 s, para siempre', { adn: 80 }, {}, { own: ['mh4'] }],
  pgh7: ['ghost', 'Quinta mano', 'Otra mano fantasma: un toque cada 2 s, para siempre', { adn: 140 }, {}, { own: ['mh5'] }],
  pds: ['arrows', 'Saber heredado', 'El árbol de la colonia cuesta un 25% menos', { adn: 6 }, { discount: 0.25 }],
  prt: ['arrows', 'Borrón y cuenta nueva', 'Desbloquea el botón de reiniciar el Árbol: devuelve toda la jalea y la biomasa gastadas. ¿Quién querría deshacer su propio árbol? Ni idea. Tú, por lo visto.', { adn: 80 }, { resetTree: 1 }],
  pab1: ['arrows', 'Mayordomo del nido', 'Desbloquea un interruptor en el Árbol. Encendido, compra solo las mejoras de la colonia cuando hay jalea o biomasa', { adn: 90 }, { autoBuy: 1 }],
  plt1: ['hand', 'Manos heredadas', '+25% de efecto de tus toques. «Manos de reina» es tuya en el árbol', { adn: 20 }, { click: 0.25 }, { own: ['taK1'] }],
  plt2: ['hand', 'Caricia del linaje', '+35% de efecto de tus toques', { adn: 36 }, { click: 0.35 }],
  plt4: ['coin', 'Dedos de oro', '+15% de efecto de tus toques. «Toque dorado» es tuya en el árbol', { adn: 48 }, { click: 0.15 }, { own: ['taK2'] }],
  ptn1: ['leaf', 'Hambre heredada', 'Cada toque a la reina suma un 1% de lo que recolecta la colonia por segundo, en todas las colonias', { adn: 60 }, { tapRate: 0.01 }],
  plt3: ['hand', 'Toque ancestral', 'Tus toques ×1,4', { adn: 64 }, { clickX: 1.4 }],
  ptn2: ['leaf', 'Hambre heredada II', 'Cada toque a la reina suma otro 1% de lo que recolecta la colonia por segundo', { adn: 140 }, { tapRate: 0.01 }],
  psk: ['moon', 'Saltar el día', 'Un botón junto al reloj hace que caiga la noche ya. Las noches con el día saltado dan la mitad de ADN', { adn: 60 }, { skipDay: 1 }],
  ptc: ['hand', 'Toque menguante', 'Tocar a la reina rebaja la comida que pide el huevo (una cantidad fija, que arrastra el siguiente). Al llegar al mínimo, el toque vuelve a alimentarla', { adn: 80 }, { tapCut: 1 }],
  ptc2: ['hand', 'Toque menguante II', 'Los toques pueden rebajar los huevos hasta un 35%', { adn: 60 }, { cutMax: 0.1 }],
  ptc3: ['hand', 'Toque menguante III', 'Los toques pueden rebajar los huevos hasta un 50%', { adn: 100 }, { cutMax: 0.15 }]
};

/* ---------------- linaje: forma ---------------- */
const PL = {
  brood: [
    ['pe1', 'pe2', 'plb2'],
    ['pg1', 'plb1', 'plb3'],
    ['prs', 'pcv'],
    ['pdx1', 'pqk', 'pdx2'],
    ['pfe1', 'pfe2', 'plb5'],
    ['ptw', 'plb4'],
    ['psh', 'psh2', 'psh3', 'pls1', 'pls2']
  ],
  food: [
    ['pf1', 'pf2', 'pf3', 'pf4'],
    ['psp'],
    ['ppz', 'pqj1', 'pqj2', 'pqj3'],
    ['pgf', 'pgf2'],
    ['plf1', 'plf2', 'plf3', 'plf4'],
    ['pfs1', 'pfs2', 'pfs3']
  ],
  war: [
    ['pd1', 'pd2', 'pd3', 'pd4'],
    ['ph1', 'ph2', 'ph3', 'ph4'],
    ['pbk', 'pbio'],
    ['pdg', 'plv'],
    ['plw1', 'plw2', 'plw3', 'plw4', 'plw5'],
    ['pst1', 'pst2', 'pst3']
  ],
  tap: [
    ['ps1', 'pse', 'ps2', 'ps3'],
    ['pj1', 'pj2', 'pkp', 'pns'],
    ['ptp', 'pcb1', 'pcb2', 'pcb3', 'pck', 'pce'], // + Ritmo ancestral I–III (ver RING)
    ['pl1', 'pl2', 'plt5'],
    ['pgh1', 'pgh2', 'pgh3', 'pgh4', 'pgh5', 'pgh6', 'pgh7'],
    ['pds', 'prt', 'pab1'],
    ['plt1', 'plt2', 'plt4', 'ptn1', 'plt3', 'ptn2'],
    ['psk'],
    ['ptc', 'ptc2', 'ptc3']
  ]
};

/* ---------------- anillo exterior: mejoras pequeñas en serie ---------------- */
/**
 * Familias: nombre → [icono, descripción con {v}, efecto, valor, extra?]. Cada nodo de la serie se llama
 * «nombre + número romano». La cifra de la descripción sale del valor (ver shown).
 */
const FAM = {
  skills: {
    'Calor suave': ['flame', '+{v}% de velocidad de cría', 'growth', 0.08], 'Cáscara fina': ['egg', 'Cada huevo cuesta un {v}% menos', 'eggCostX', 0.97],
    'Reserva templada': ['crown', 'La reina produce +{v}% por su cuenta', 'reserve', 0.25], 'Granja de hongos': ['seed', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.06],
    'Buche ancho': ['leaf', '+{v}% de comida por viaje', 'food', 0.08], 'Paso firme': ['boot', '+{v}% de velocidad', 'speed', 0.04],
    'Pulgones': ['clover', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.06], 'Botín': ['coin', '+{v}% de jalea al ganar una noche', 'prize', 0.12],
    'Colmillo': ['sword', '+{v}% de daño', 'dmg', 0.08], 'Quitina': ['shield', '+{v}% de vida', 'hp', 0.08],
    'Reflejos': ['shield', '+{v}% de probabilidad de esquivar', 'dodge', 0.015], 'Rapiña': ['seed', '+{v} de biomasa por enemigo', 'bioKill', 0.4],
    'Caricia suave': ['hand', '+{v}% de efecto de tus toques', 'click', 0.08], 'Mano errante': ['ghost', 'Mano fantasma: +{v} toques por minuto', 'ghost', 0.04],
    'Compás': ['bolt', 'Cada toque de la racha rinde +{v}% más', 'comboStep', 0.004, RACHA], 'Fortuna': ['star', '+{v}% de toques de suerte', 'tapCrit', 0.015]
  },
  perm: {
    'Linaje fértil': ['flame', '+{v}% de velocidad de cría', 'growth', 0.12], 'Reserva ancestral': ['crown', 'La reina produce +{v}% por su cuenta', 'reserve', 0.5],
    'Hongo ancestral': ['seed', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.1],
    'Memoria': ['leaf', '+{v}% de comida', 'food', 0.12], 'Senda': ['boot', '+{v}% de velocidad', 'speed', 0.05],
    'Rebaño de pulgones': ['clover', 'Produce jalea sola: {v}% del premio de una noche por minuto', 'farm', 0.1],
    'Coraza': ['shield', '+{v}% de vida', 'hp', 0.12],
    'Mano heredada': ['ghost', 'Mano fantasma: +{v} toques por minuto', 'ghost', 0.06], 'Toque heredado': ['hand', '+{v}% de efecto de tus toques', 'click', 0.12],
    'Ritmo ancestral': ['bolt', 'Cada toque de la racha rinde +{v}% más', 'comboStep', 0.006]
  }
};
/** Nodos clave (rombo, con biomasa) que cierran las costillas del anillo exterior de la colonia. */
const KEYS = { brood: ['Nido ancestral', 'flame', 'La cría crece un {v}% más rápido', 'growthX', 1.12], food: ['Sendero real', 'leaf', 'Comida ×{x}', 'foodX', 1.12],
  war: ['Legión', 'fist', 'Daño ×{x}', 'dmgX', 1.1], tap: ['Manos rápidas', 'ghost', 'La mano fantasma ×{x}', 'ghostX', 1.25] };

/**
 * Por rama, las costillas del anillo exterior, en orden. Cada costilla es una lista de tramos
 * [familia, desde, hasta] (números romanos). Las claves de KEYS[rama] cierran las primeras `keys` costillas.
 * `tail`: series que alargan una costilla hecha a mano (las que necesitan algo del linaje no pueden ir en el tronco).
 */
const RING = {
  skills: {
    food: { keys: 8, ribs: [[['Buche ancho', 1, 7]], [['Buche ancho', 8, 14]], [['Buche ancho', 15, 21]], [['Pulgones', 1, 7]], [['Pulgones', 8, 14]], [['Paso firme', 1, 6]], [['Paso firme', 7, 11]], [['Botín', 1, 7]]] },
    war: { keys: 11, ribs: [[['Colmillo', 1, 7]], [['Colmillo', 8, 14]], [['Colmillo', 15, 21]], [['Colmillo', 22, 28]], [['Colmillo', 29, 34]], [['Quitina', 1, 6]], [['Quitina', 7, 12]], [['Quitina', 13, 18]], [['Quitina', 19, 23]], [['Reflejos', 1, 3]], [['Rapiña', 1, 7]]] },
    tap: { keys: 4, ribs: [[['Caricia suave', 1, 4]], [['Caricia suave', 5, 8]], [['Caricia suave', 9, 12]], [['Mano errante', 1, 7]]],
      tail: { lk1: [['Fortuna', 1, 3]], taK2: [['Compás', 1, 6]] } },
    brood: { keys: 3, ribs: [[['Cáscara fina', 1, 9]], [['Reserva templada', 1, 6]], [['Calor suave', 1, 5], ['Granja de hongos', 1, 2]]] }
  },
  perm: {
    brood: { ribs: [[['Linaje fértil', 1, 5]], [['Linaje fértil', 6, 9]], [['Reserva ancestral', 1, 4]], [['Reserva ancestral', 5, 8]], [['Hongo ancestral', 1, 6]]] },
    food: { ribs: [[['Memoria', 1, 5]], [['Memoria', 6, 9]], [['Senda', 1, 2], ['Rebaño de pulgones', 1, 3]]] },
    war: { ribs: [[['Coraza', 1, 2]]] },
    tap: { ribs: [[['Toque heredado', 1, 6]], [['Mano heredada', 1, 5]]], tail: { ptp: [['Ritmo ancestral', 1, 3]] } }
  }
};

const toRoman = n => { let r = ''; for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { r += s; n -= v; } return r; };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
const num = v => String(v).replace('.', ',');
/** Cifra que se enseña en la descripción: % para casi todo, toques por minuto para la mano, biomasa tal cual. */
function shown(k, v) {
  if (k.endsWith('X')) return Math.round((1 - v) * 100);
  if (k === 'ghost') return Math.round(v * 60 * 10) / 10;
  if (k === 'bioKill') return v;
  return Math.round(v * 1000) / 10;
}

/**
 * Añade al contenido (C) y a la forma (L) el anillo exterior de un árbol.
 *   Colonia: nivel de jalea min(18, 9 + ⌊k/2⌋ + ⌊i/3⌋) y claves { bio: 50 + 10·i } (i: costilla, k: posición)
 *   Linaje: { adn: 14 + 6·i + 3·k }
 */
function addRing(tree, C, L) {
  const pre = tree === 'perm' ? 'y' : 'x', fam = FAM[tree];
  const make = (cat, segs, cost) => {
    const ids = [];
    let k = 0;
    for (const [name, from, to] of segs) {
      const [icon, desc, eff, v, extra] = fam[name];
      for (let n = from; n <= to; n++, k++) {
        const id = pre + cat[0] + slug(name) + n;
        C[id] = [icon, name + ' ' + toRoman(n), desc.replace('{v}', num(shown(eff, v))), cost(k), { [eff]: v }, extra];
        ids.push(id);
      }
    }
    return ids;
  };
  for (const cat in RING[tree]) {
    const spec = RING[tree][cat];
    spec.ribs.forEach((segs, i) => {
      const rib = make(cat, segs, k => tree === 'perm' ? { adn: 14 + 6 * i + 3 * k } : Math.min(18, 9 + Math.floor(k / 2) + Math.floor(i / 3)));
      if (i < (spec.keys || 0)) {
        const [name, icon, desc, eff, v] = KEYS[cat], id = pre + cat[0] + 'K' + (i + 1);
        C[id] = [icon, name + ' ' + toRoman(i + 1), desc.replace('{v}', Math.round((v - 1) * 100)).replace('{x}', num(v)), { bio: 50 + 10 * i }, { [eff]: v }, K];
        rib.push(id);
      }
      L[cat].push(rib);
    });
    for (const head in spec.tail || {}) {
      const rib = L[cat].find(r => r[0] === head);
      rib.push(...make(cat, spec.tail[head], k => tree === 'perm' ? { adn: 30 + 6 * k } : Math.min(18, 13 + k)));
    }
  }
}

/** Dirección del tronco y de las costillas de cada rama: [tronco, costilla]. */
const DIRS = { food: [[1, 0], [0, -1]], war: [[0, 1], [1, 0]], tap: [[-1, 0], [0, 1]], brood: [[0, -1], [-1, 0]] };

/** Coloca el molinillo: cada nodo en su casilla, enlazado solo con su padre (la casilla de al lado). */
function build(root, C, L) {
  const N = { root: { id: 'root', x: 0, y: 0, cat: 'root', icon: root[0], name: root[1], desc: root[2], cost: 0, fx: {}, links: [], key: false, adj: new Set(), reqPerk: null, own: null } };
  for (const cat in DIRS) {
    const [[tx, ty], [rx, ry]] = DIRS[cat];
    let trunkPrev = 'root';
    L[cat].forEach((rib, i) => {
      rib.forEach((id, j) => {
        if (N[id]) throw new Error('Nodo repetido en el árbol: ' + id);
        const c = C[id];
        if (!c) throw new Error('Nodo sin contenido: ' + id);
        const [icon, name, desc, cost, fx, extra = {}] = c, parent = j === 0 ? trunkPrev : rib[j - 1];
        N[id] = { id, x: tx * (i + 1) + rx * j, y: ty * (i + 1) + ry * j, cat, icon, name, desc, cost, fx, links: [parent], key: !!extra.key,
          adj: new Set([parent]), reqPerk: extra.reqPerk || null, own: extra.own || null };
        N[parent].adj.add(id);
      });
      trunkPrev = rib[0];
    });
  }
  for (const id in C) if (!N[id]) throw new Error('Nodo sin sitio en el árbol: ' + id);
  // coordenadas desde 0
  let mx = Infinity, my = Infinity;
  for (const id in N) { mx = Math.min(mx, N[id].x); my = Math.min(my, N[id].y); }
  for (const id in N) { N[id].x -= mx; N[id].y -= my; }
  return N;
}

addRing('skills', SN, SL);
addRing('perm', PN, PL);
export const SKILLS = build(['crown', 'La reina', 'El corazón de la colonia. Todo crece desde aquí.'], SN, SL);
export const PERKS = build(['dna', 'Linaje', 'Lo que aprende cada reina pasa a sus hijas.'], PN, PL);

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
 * Estado de cada nodo según la distancia a lo comprado:
 * 0 owned (comprado) · 1 open (se puede comprar) · 2 seen (se ve) · 3 fog («?») · más lejos hidden.
 * Lo que el linaje deja tuyo en el árbol cuenta como comprado (y abre a sus vecinos).
 */
const NAMES = ['owned', 'open', 'seen', 'fog'];
export function treeStates(nodes, owned, perm) {
  const lin = nodes === SKILLS ? linajeSkills(perm) : { own: {} };
  const dist = {}, q = [];
  for (const id in nodes) if (id === 'root' || owned[id] || lin.own[id]) { dist[id] = 0; q.push(id); }
  while (q.length) {
    const id = q.shift();
    if (dist[id] >= 3) continue;
    for (const a of nodes[id].adj) if (dist[a] == null) { dist[a] = dist[id] + 1; q.push(a); }
  }
  const out = {};
  for (const id in nodes) {
    out[id] = NAMES[dist[id]] || 'hidden';
    if (out[id] === 'open' && nodes[id].reqPerk && !(perm && perm[nodes[id].reqPerk])) out[id] = 'seen'; // falta algo del linaje
  }
  return out;
}
