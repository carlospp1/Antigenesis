# Plan de acción — 9 cambios de ANTIGENESIS

Documento para quien lo implemente. Cada punto dice qué pasa hoy en el código, qué hay que hacer, en qué archivos y cómo comprobarlo. Los nombres de funciones y archivos son los reales del repo a día de hoy.

## 0. Reglas generales y orden de trabajo

- `src/game/*` son reglas puras (sin DOM ni Three.js) y avisan con `emit()`. La escena (`src/scene/*`) y la interfaz (`src/ui/*`, `src/main.js`) solo escuchan. Mantén esa separación: toda la lógica nueva va en `rules.js` y los números en `BAL` (`data.js`).
- El simulador (`npm run sim`, `tools/sim.mjs` + `tools/bot.mjs`) usa las mismas reglas. Nada de lo nuevo puede depender del navegador.
- Comentarios y textos en español, como el resto del código.
- No hagas commit: lo decide el usuario.

**Orden recomendado** (cada fase deja el juego funcionando):

| Fase | Puntos | Por qué en ese orden |
|---|---|---|
| A | Línea base: `npm run sim -- --runs=4 > sim-antes.txt` | Para comparar el equilibrio al final |
| B | 4 (saltar día), 5 (velocidad + reloj real) | Pequeños y aislados; el reloj real lo necesita el punto 9 |
| C | 9-reglas (racha y mano fantasma), 3-reglas (humano) | Solo `rules.js`/`data.js`, se prueban con el simulador |
| D | 2 (animaciones), 3-escena, 6 (final) | Presentación |
| E | 8 (árboles desde cero), y dentro de él los nodos de 1, 3, 7 y 9 | Es el cambio grande; los nodos nuevos se escriben ya en el formato nuevo |
| F | 1 (interruptor del mayordomo), 7 (botón de reiniciar) | Dependen de los nodos de la fase E |
| G | `npm run build`, `npm run sim -- --runs=4`, ajuste de `BAL` | Ver «Equilibrio» al final |

---

## 1. Mayordomo: una sola mejora y con interruptor

**Hoy.** `rules.js › calc`: `D.autoBuy = (P.autoBuy || 0) + (G.autoBuy ? 1 : 0)`. En cuanto tienes el nodo de linaje `pab1`, `tick` llama a `autoBuy()` cada 0,45 s. No existe ningún interruptor: por eso «compra todo sin haberlo activado». `pab2` («Mayordomo II») solo sube cuántas compra por vuelta.

**Hacer.**
1. Quitar `pab2` de `trees.js` (fila y entrada en `NEEDS`). Las partidas guardadas quedan cubiertas por la devolución general del punto 8.
2. Estado nuevo `G.butler` (booleano, `false` por defecto). Se hereda al fundar: añadirlo al `keep` de `newGame` y al objeto que pasa `prestige`.
3. `calc`: `D.butler = !!P.autoBuy` (tienes el nodo) y `D.autoBuy = (D.butler && G.butler) || G.autoBuy ? 1 : 0`. `G.autoBuy` se queda tal cual: es la bandera que usa `tools/bot.mjs` y no se toca desde el juego.
4. `tick`: `autoBuy(G, 1)` (una compra cada 0,45 s, ya no escala).
5. Interruptor en el panel del árbol: botón `#tvAuto` en `.tv-foot` (`index.html`), visible solo con `tv.tree === 'skills' && D.butler`. Texto «Mayordomo: encendido / apagado», clase `on` cuando está activo. En `tree.js › wireTree` → `tv.onAuto`; en `main.js`: `G.butler = !G.butler`, guardar y re-renderizar.
6. Descripción de `pab1`: «Desbloquea un interruptor en el Árbol. Encendido, compra solo las mejoras de la colonia cuando hay jalea o biomasa».
7. `tree.js › STAT.autoBuy`: «encendido» / «apagado» (sin «×N»).

**Comprobar.** Con el nodo comprado y el interruptor apagado no compra nada. Encendido, compra de una en una al cerrar el árbol (con el árbol abierto el tiempo está parado). Tras fundar, el interruptor conserva su estado.

---

## 2. Animación del pisotón y del ataque

**Hoy.** `camera.js › updateCamera` mueve la cámara al azar cada fotograma: `(Math.random() - 0.5) * ctx.shake * 0.02`. El pisotón pone `ctx.shake = 1.2` (`enemies.js › updateShoe`), que son saltos de hasta ±10 píxeles de imagen durante medio segundo. Tocar a un enemigo pone 0,35–0,45 (±3 px) en `enemyHit`.

**Hacer.**
1. Sustituir el temblor aleatorio por un único rebote vertical amortiguado. En `camera.js`: `export function nudge(px)` guarda `{ a: px, t: 0 }` (si llega otro mayor, lo sustituye). En `updateCamera`: `camera.position.y -= a * PXW * Math.exp(-t * 12) * Math.cos(t * 40)` y se apaga al bajar de 0,02. Con `prefers-reduced-motion` no hace nada. Eliminar `ctx.shake` de todo el código.
2. Amplitudes como constantes al principio de `enemies.js`: `NUDGE_STOMP = 2.5` (px de imagen) y `NUDGE_TAP = 0.5`.
3. **Zapato pequeño al atacar.** En `enemies.js`:
   - Un solo zapato mini, creado la primera vez con `createCreature('shoe', 1)` igual que `buildShoe`, pero con largo `L = 60` px de imagen y su sombra.
   - `enemyHit(at)` deja de hacer el efecto al instante: mete el punto en una cola `tapQueue` (máximo 8 pendientes; si se llena, descarta el más antiguo).
   - `updateTapShoe(dt)` (llamado desde `updateEnemies`): si hay cola, hace un ciclo de pisotón sobre el primer punto: cae desde 70 px en 0,05 s, se queda 0,04 s, sube en 0,07 s. Con más de 3 en cola, el ciclo entero dura 0,10 s. Al tocar el suelo: el `puff` rojo, `hurt = 1` en el bicho más cercano (lo que hoy hace `enemyHit`) y `nudge(NUDGE_TAP)`. Durante la subida se desplaza hacia el siguiente punto. Con la cola vacía sube y se oculta.
   - Al acabar la noche (`hideFoes`) se vacía la cola y se oculta.
   - El daño y el número flotante siguen siendo inmediatos (los pone `main.js › clickScene`); solo el efecto visual va encolado.

**Comprobar.** Un pisotón apenas mueve la imagen. Diez clics rápidos sobre un enemigo: un único zapato pequeño da los diez golpes seguidos y termina poco después del último clic.

---

## 3. El humano: pisotones en área

**Hoy.** La noche final (`nightDef`, `final`) el humano es un jefe con `dps` continuo (`BAL.humanDps`) que mata hormigas de una en una vía `G.guard`. Sin la última evolución es inmune (`immuneBoss`) pero mata igual de despacio. La escena lleva su propio reloj de pisotones (`stomp`, periodo 2,6 s), sin relación con las reglas.

**Reglas nuevas** (el reloj del pisotón pasa a `rules.js`; la escena lo lee):

- `data.js › BAL`: `stompFirst: 3` (s desde que llega hasta el primer pisotón), `stompEvery: 8` (s entre pisotones), `stompHits: 4` (pisotones que aguantan las hormigas titán), `humanHp: 20` (antes 40: ahora hay menos tiempo; se afina en la fase G). Borrar `humanDps`; en `nightDef` el jefe final lleva `dps: 0`.
- `calc`: `D.stompHits = BAL.stompHits + (P.stompHits || 0)`.
- Al empezar la noche final, `G.foes` lleva además `stompT: BAL.stompFirst, stomps: 0`.
- `tickNight`: tras la espera de `arrive`, si es la noche final llama a `tickHuman(G, D, dt)` y sale. `tickHuman`:
  1. Si no es inmune y hay hormigas: `f.boss -= fightForce(G, D) * D.dmg * dt`. Si llega a 0 → victoria (extraer el bloque actual de premio/`nightWin`/`victory`/`dawn` a `winNight(G, D)` y reutilizarlo).
  2. `f.stompT -= dt`; si sigue > 0, salir. Si no, `f.stompT += BAL.stompEvery` y cae un pisotón:
     - **Sin hormigas** → pisa el nido: `emit('stomp', { queen: true })`; si queda «Nido fortificado» (`G.livesUsed < D.lives`) la reina aguanta como hoy (`queenSurvives`, `nightLost`, `dawn`); si no, `queenDies(G)`.
     - **Sin la última evolución** → `wipe(G, 0)`: mueren todas, sin esquiva. `emit('stomp', { wipe: true, killed })`. El siguiente pisotón encuentra el nido vacío y mata a la reina: dos golpes.
     - **Con la última evolución** → `f.stomps++`. Si `f.stomps >= D.stompHits`: `wipe(G, D.dodge)` y `f.stomps = 0`. Si no: `emit('stomp', { left: D.stompHits - f.stomps })`.
  3. La noche final ya no usa `G.guard`, `f.raid` ni `RAID`.
- `wipe(G, dodge)`: sobreviven las que esquivan (una tirada por hormiga hasta 2000; por encima, `Math.round(ants * dodge)`). Ajusta `G.ants`, `G.shiny` (en proporción), `G.free`, `G.stats.dead`, `f.lost`. Emite **un solo** `emit('massDeath', { n })`, no un `death` por hormiga.
- `forecast` en la noche final: inmune → como hoy. Si no: `T = totalHp / dps`, `límite = stompFirst + (D.stompHits - 1) * stompEvery`; `win = T < límite`, `losses = win ? 0 : G.ants`.

**Linaje** (rama Guerra, se colocan en el punto 8): tres nodos con `fx: { stompHits: 1 }`.

| id | Nombre | Coste en datos (`adn`) | ADN real |
|---|---|---|---|
| `pst1` | Exoesqueleto titánico | 120 | 30 |
| `pst2` | Exoesqueleto titánico II | 240 | 60 |
| `pst3` | Exoesqueleto titánico III | 400 | 100 |

Descripción: «Tus hormigas aguantan un pisotón humano más». Añadir en `tree.js › STAT`: `stompHits: ['Pisotones que aguantan', D => fmt(D.stompHits)]`.

> Ojo: `nodeCost` multiplica todo coste `adn` por `BAL.perkK` (0,25). El número de la tabla de datos es cuatro veces lo que ve el jugador.

**Interfaz y escena.**
- `hud.js › renderTop` (alarma): en la noche final, «Los humanos · aguantan N pisotones más» o, si eres inmune, «Un pisotón las mata a todas: hace falta la Hormiga titán». En `dockColony`, el texto de la previsión: «Caen antes del 4.º pisotón» / «No les da tiempo».
- `main.js`: `on('stomp')` → `Audio.play('stomp')` y, si `wipe`, un aviso; `on('massDeath')` → un solo sonido de muerte y un solo número flotante «−N».
- `scene/index.js`: `on('massDeath')` → quitar con `puff` las hormigas dibujadas que estén fuera y `syncAgents(false)`.
- `enemies.js › updateShoe`: la altura del pie sale de `G.foes.stompT`, no de un reloj propio (borrar `stomp`). Con τ = segundos hasta el impacto: τ > 1,2 flota alto (900→520 px, siguiendo al objetivo); 1,2 ≥ τ > 0,25 se cierne a 520; τ ≤ 0,25 cae a 0. Tras el impacto se queda 0,5 s apoyado y sube en 0,8 s. El polvo, el sonido y `nudge(NUDGE_STOMP)` salen del evento `stomp`. Objetivo: la línea de guardia si hay hormigas; la boca del nido si no.

**Comprobar.** Sin titán: primer pisotón, 0 hormigas; segundo, cae la reina. Con titán y sin mejoras: al cuarto pisotón caen todas (salvo esquivas). Con `pst1`: al quinto. A ×3 de velocidad los impactos coinciden con la animación.

---

## 4. Saltar el día quitaba ADN

**Hoy.** `skipDay` hace `G.skips++` en el momento, y `adnGain = adnFor(level − 1 − 0.5·skips)`. Al pulsar, el ADN previsto baja al instante (en la noche 6: de 13 a 11) y solo se recupera al superar la noche.

**Hacer.** En `rules.js`:
- `skipDay`: en vez de `G.skips++`, `G.skipNow = true`.
- Donde se supera una noche (los dos `G.level++`: victoria en `tickNight`/`winNight` y retirada al agotarse el tiempo en `tick`), justo antes: `if (G.skipNow) G.skips = (G.skips || 0) + 1`.
- `dawn`: `G.skipNow = false`.

Así el ADN nunca baja: saltar deja la previsión igual, y al superar esa noche sube más o menos la mitad de lo normal. Si la reina muere en la noche saltada, cobra lo que ya tenía.

**Comprobar.** Anotar «+N ADN · Fundar», saltar el día: N no cambia. Superar la noche: N sube, menos que en una noche normal.

---

## 5. Botón de acelerar (×1 → ×2 → ×3)

**Hoy.** Solo existe la fila «Velocidad» (×1…×20) que ya está dentro de «Pruebas y depuración» en Ajustes (`hud.js › renderSheet`), y comparte `ui.speed` con el bot.

**Hacer.**
1. Dos valores en `ui` (`hud.js`): `speed` (jugador: 1, 2 o 3) y `devSpeed` (depuración: 1…20). La fila de depuración, `__ax.speed` y el bot (`getSpeed`/`setSpeed` en `main.js`) pasan a `devSpeed`; la fila se queda donde está, rotulada «Velocidad (debug)».
2. Botón nuevo en `index.html`, dentro de `.pills`, después de `#bSkip`: `<button class="pill panel speed" id="bSpeed" data-act="gameSpeed"><b id="vSpeed">×1</b></button>`. Acción `gameSpeed` en `main.js › act`: `ui.speed = ui.speed % 3 + 1`, guardarlo en `G.speed` (se hereda al fundar y se lee al arrancar). Estilo como `.pill.skip`, resaltado cuando es > 1.
3. `main.js › frame`: `const n = ui.paused || tv.open ? 0 : (ui.devSpeed > 1 ? ui.devSpeed : ui.speed)`.
4. **Reloj real para la racha.** A ×3 el margen de la racha (0,8 s de tiempo de juego) se quedaría en 0,27 s reales. `tick(G, dt, realDt = dt)` acumula `G.clock += realDt` y `frame` llama `Game.tick(G, dt, dt / n)`. La racha usa `G.clock` en vez de `G.total` (punto 9). El simulador no cambia (`realDt` vale `dt` por defecto).

**Comprobar.** El botón cicla ×1/×2/×3 y el día pasa al triple. A ×3 la racha se mantiene con el mismo ritmo de clics que a ×1.

---

## 6. Cinemática del final

**Hoy.** `scene/ending.js › startEnding` mueve a la reina y la cámara, pero el nido sigue en «foto fija» (un plano: al mover la cámara se nota) y todas las hormigas suben a rodearla (`colony.js › partyTask`).

**Hacer.**
1. En `scene/index.js`, envolver `startEnding`/`stopEnding` (hoy se reexportan tal cual; hacerlo aquí evita el import circular entre `ending.js` y `colony.js`):
   - Al empezar: recordar `isLiveMap()`, `setLiveMap(true)`, `clearAgents()`, `resetEnemies()`.
   - Al acabar: restaurar el modo de mapa anterior y `syncAgents(true)`.
2. `colony.js › syncAgents`: con `ctx.ending`, `want = 0`. Borrar `partyTask` y el trabajo `'party'` (y el import de `gatherPoint` en `colony.js`).
3. `updateEnding` debe avanzar con tiempo real y una vez por fotograma: en `scene/index.js › update`, llamarlo con `realDt` después del `if (skipDraw) return`.
4. Mientras dura, la partida se para: `ui/ending.js` exporta `endingRunning = () => !!run`, y en `frame` `n = 0` si está activa.
5. `ui/ending.js`: `document.body.classList.add('ending')` al empezar y quitarla en `cancelEnding`. CSS: `body.ending #top, body.ending #side, body.ending #dock, body.ending #labels, body.ending #floats, body.ending #quest, body.ending #alarm, body.ending #toasts { display: none; }`.
6. Depuración: en `main.js`, función `runEnding()` con lo que hoy hace `on('victory')` (la usan el evento, `__ax.ending` y el botón). Fila nueva en el bloque `.dev` de `hud.js`: `row('Final', btn(false, 'ending', 'Ver cinemática'))`; la acción `ending` cierra la hoja y llama a `runEnding()`.

**Comprobar.** Ajustes → Pruebas y depuración → «Ver cinemática»: nido en 3D, ninguna hormiga, la reina cruza la cueva, trepa y sale; luego el planeta. Al terminar o saltarla vuelven la foto fija (si estaba) y las hormigas.

---

## 7. Reiniciar el árbol pasa a ser una mejora de linaje

**Hoy.** `#tvReset` («Reiniciar árbol (devuelve todo)») está siempre visible y es gratis (`rules.js › resetSkills`).

**Hacer.**
1. Nodo de linaje nuevo (se coloca en el punto 8, rama Toques y fundación): id `prt`, icono `arrows`, `cost: { adn: 80 }` (20 ADN reales), `fx: { resetTree: 1 }`.
   - Nombre: **«Borrón y cuenta nueva»**
   - Descripción: «Desbloquea el botón de reiniciar el Árbol: devuelve toda la jalea y la biomasa gastadas. ¿Quién querría deshacer su propio árbol? Ni idea. Tú, por lo visto.»
   - Alternativas de nombre por si se prefiere otro tono: «Ctrl + Z», «Arrepentimiento real».
2. `calc`: `D.resetTree = !!P.resetTree`. `resetSkills`: devolver `false` si no hay `D.resetTree` (salvo `debug.free`). Al reiniciar, `G.butler = false` (si no, el mayordomo lo recompra todo al instante).
3. `tree.js › renderHead`: `$('tvReset').hidden = perm || !(D.resetTree || Game.debug.free)`.

**Comprobar.** Sin el nodo, el botón no aparece. Con él, reinicia y devuelve todo, las veces que se quiera.

---

## 8. Árbol y linaje reestructurados desde cero

**Hoy.** `trees.js` coloca cada nodo junto a su primer enlace (`relayoutTree`) y el resto de enlaces quedan donde caigan. Medido sobre el árbol construido: en el de la colonia, 133 de 442 enlaces unen casillas que no están pegadas, y 23 requisitos («Caricia III» pide «Caricia II») ni siquiera están enlazados; en el linaje, 49 de 162 y 7. Además 196 nodos de la colonia y 53 del linaje los genera `grow()` al azar con semilla.

**Diseño nuevo: molinillo de peines.** La raíz en el centro. Cada rama tiene un **tronco** recto que sale de la raíz y **costillas** perpendiculares que cuelgan de cada nodo del tronco, siempre hacia el mismo lado. Cada nodo tiene un único padre, que es la casilla de al lado. Lo que hay que comprar antes es, literalmente, el vecino.

| Rama | Tronco (k = 1, 2, …) | Costilla del nodo k (j = 1, 2, …) |
|---|---|---|
| Recolección | derecha: `(k, 0)` | hacia arriba: `(k, −j)` |
| Guerra | abajo: `(0, k)` | hacia la derecha: `(j, k)` |
| Toques | izquierda: `(−k, 0)` | hacia abajo: `(−k, j)` |
| Cría | arriba: `(0, −k)` | hacia la izquierda: `(−j, −k)` |

Las cuatro zonas no se pisan entre sí. Al final se desplaza todo para que las coordenadas empiecen en 0. El linaje usa el mismo motor y la misma orientación.

**Reglas de construcción.**
- Padre de un nodo de tronco: el anterior del tronco (o la raíz). Padre de un nodo de costilla: el anterior de la costilla (o su nodo de tronco). `links = [padre]`. No hay más enlaces.
- Desaparecen `needs`, `NEEDS`, la lógica de números romanos, `chain`, `grow`, `seeded`, `relayoutTree`, `freeCollisions`, `nestAt`, `nestHands`, `CAT_DIR`, `PERM_DIR`, `OX/OY`. `missingNeeds` devuelve siempre `[]` (o se borra junto con sus usos en `rules.js` y `tree.js`).
- Se conservan `reqPerk` (por nodo) y `own`. Una familia con `reqPerk` nunca va en el tronco: cuelga entera de un nodo normal.
- Los ids de los nodos hechos a mano **no cambian**. Los generados pasan a ids fijos (ver «Anillo exterior»).
- Cada nodo conserva su coste, icono, efecto y descripción actuales, salvo lo que se indique.

**Paso 1 — volcar el contenido con un script, no a mano.** Script de un solo uso (en el scratchpad, no en el repo) que importe `SKILLS` y `PERKS` actuales y escriba, para cada nodo no generado, `{ id, cat, icon, name, desc, cost, fx, key, reqPerk, own }`. Ese volcado es la tabla de contenido del `trees.js` nuevo.

**Paso 2 — estructura.** Por árbol y rama: `{ trunk: [ids], ribs: { idDeTronco: [ids] } }`. Una función `place()` calcula `x`, `y`, `links` y `adj` con la tabla de arriba. Notación: «tronco → costilla en orden»; ◆ = nodo clave (biomasa).

### Árbol de la colonia

**Recolección** (tronco →, costillas ↑)
1. `fo1` Buche grande I → `fo3` II, `fo5` III, `fo6` Hojas grandes, `fo8` IV, `fo10` V, `f1a` VI, `f1b` VII, `f1c` VIII, `f1d` Buche sin fondo◆
2. `fo2` Patas ágiles I → `fo4` II, `fo7` III, `fo9` IV, `f8a` V, `f8b` VI, `f8c` VII
3. `fo11` Botín nocturno → `qj1`, `qj2`, `qj3` Jalea real I–III, `qjK` Corona de jalea◆ (toda la costilla con `reqPerk: 'pqj1'`)
4. `lc1` Cosecha afortunada I → `lc2` II, `f7a` III, `f7b` IV, `f7c` Trébol dorado◆
5. `foK1` Rastro de feromonas◆ → `foK2` Doble carga◆, `foK4` Cosecha masiva◆, `f9` Cosecha legendaria◆
6. `fo12` Despensa → `f2a` II, `f2b` III, `f2c` Granero◆
7. `gf1` Comida dorada → `f4a` II, `f4b` III, `f4c` Ambrosía◆
8. `gf2` Néctar real → `f5a` II, `f5b` III, `f5c` Fuente de néctar◆
9. `foK3` Rutas nocturnas◆ → `fo13` Exploradoras, `f6a` II, `f6b` III, `f6c` Mapa del bosque◆
10. `f3a` Turno de noche → `f3b` Botín nocturno II, `f3c` III, `f3d` Tesoro de guerra◆
11. `fs1` Festín → `fs2` II, `fsK` Festín real◆

**Guerra** (tronco ↓, costillas →)
1. `wa1` Mandíbulas I → `wa3` II, `wa5` III, `wa10` IV, `wa11` V, `w1a` VI, `w1b` VII, `w1c` VIII, `w1d` Mandíbulas de acero◆
2. `wa2` Caparazón I → `wa4` II, `wa6` III, `wa8` IV, `wa12` V, `w6a` VI, `w6b` VII, `w6c` VIII, `w6d` Coraza de diamante◆
3. `mx2` Guardia del nido → `mx3` Nido templado, `w2a` II, `w2b` III, `w2c` Muralla viva◆
4. `waK1` Mandíbulas afiladas◆ → `waK3` Mandíbula reforzada◆, `waK4` Furia de la colonia◆, `w9` Ejército invencible◆
5. `wa7` Saqueo → `w3a` II, `w3b` III, `w3c` Carroñeras◆
6. `waK2` Quitina gruesa◆ → `w8a` Escudo de quitina, `w8b` II
7. `wa9` Botín de guerra → `w7a` II, `w7b` III
8. `wa13` Veteranas → `wa14` II, `w5a` III, `w5b` IV, `w5c` Inmortales◆
9. `w4a` Rabia → `w4b` II, `w4c` Frenesí◆

**Toques** (tronco ←, costillas ↓). Los marcados NUEVO se definen en el punto 9.
1. `ta1` Caricia I → `ta4` II, `ta7` III, `ta9` IV, `t6a` V, `t6b` VI, `t6c` VII, `t6d` Manos de oro◆
2. `ta2` Masaje real → `t7a` II, `t7b` III, `t7c` Banquete real◆
3. `ta3` Mimo a la cría → `ta6` II, `tb1` Mimo contagioso NUEVO, `t8a` III, `tb2` Mimo contagioso II NUEVO, `t8b` IV, `t8c` Nodrizas mimadas◆
4. `ta5` Golpe certero → `ta8` II, `ta11` III, `t3a` IV, `t3b` V, `t3c` Puño de la reina◆
5. `lk1` Toque de suerte I → `lk2` II, `lk3` III, `t5a` IV, `t5b` V, `lkK` Golpe de fortuna◆, `t5c` Toque divino◆
6. `tn1` Toque nutritivo I NUEVO → `tn2` II, `tn3` III, `tnK` Mano que alimenta◆ (NUEVOS)
7. `taK1` Manos de reina◆ → `t9` Mano de la reina◆
8. `ghK` Mano fantasma◆ → `mh2` Segunda mano, `mh3` Tercera, `mh4` Cuarta, `mh5` Quinta (cada una con su `reqPerk` actual: `pgh4`…`pgh7`)
9. `gh2` Mano veloz → `gh3` Mano experta, `t1a` Mano veloz II, `t2a` Mano experta II, `t1b` Mano veloz III, `t2b` Mano experta III, `t1c` Mil manos◆
10. `taK2` Toque dorado◆ → racha, toda con `reqPerk: 'ptp'`: `cb1` Ritmo I, `cb2` Racha larga, `cb3` Dedos ligeros, `cb5` Marca temprana NUEVO, `cb4` Ritmo II, `cb6` Marca temprana II NUEVO, `cbK2` Racha blindada◆ NUEVO, `cbK` (renombrar de «Frenesí» a **«Racha desatada»**: hoy hay dos «Frenesí»)

**Cría** (tronco ↑, costillas ←)
1. `br1` Huevos baratos I → `br5` II, `br6` Metabolismo real, `br9` Huevera, `br8` III, `br12` IV, `b2a` V, `b2b` VI, `b2c` VII, `b2d` VIII
2. `br2` Calor del nido I → `br4` II, `br7` III, `br11` IV, `b3b` V, `b3c` VI, `b3d` Incubadora real◆
3. `br3` Reserva real I → `mx1` Despensa común, `br10` II, `b1a` III, `b1b` IV, `b1c` V, `b1d` Reina inagotable◆
4. `brK1` Nodrizas◆ → `ta10` Incubadora, `t4a` II, `t4b` III, `t4c` Cuna real◆ (pasan a `cat: 'brood'`: son velocidad de cría)
5. `brK2` Puesta doble◆ → `b5a` Gemelas, `b5b` II, `b5d` III, `b5c` Camada◆
6. `sh1` Hormigas doradas → `sh2` Brillo real, `b4a` II, `b4b` III, `shK` Linaje dorado◆, `sh3` Doradas de élite◆, `b4c` Corona dorada◆
7. `br13` Huevo de regalo → `b7a` II, `b7b` III, `b7c` Puesta en racimo◆
8. `brK3` Reina eficiente◆ → `brK4` Reina prolífica◆, `b3a` Reina dinástica◆, `b9` Matriarca◆
9. `brK5` Puesta sin precio◆ → `b8a` II, `b8b` III, `b8c` Cría gratuita◆
10. `b6a` Eclosión rápida → `b6b` II, `b6c` Larvas precoces◆

**Anillo exterior** (sustituye a `grow()`; sin azar). Después del último nodo de tronco hecho a mano, el tronco sigue con las mejoras pequeñas, en trozos. Cada trozo es una costilla: su primer nodo va en el tronco y el resto cuelga de él. Si la rama tiene nodos clave generados, uno cierra cada costilla, en orden. Mismas familias, valores e iconos que hoy en `FAMILIES`/`KEYS`, y las mismas cantidades que salen hoy:

| Rama | Trozos (en este orden) | Clave que cierra cada costilla |
|---|---|---|
| Recolección | Buche ancho I–VII · VIII–XIV · XV–XXI · Pulgones I–VII · VIII–XIV · Paso firme I–VI · VII–XI · Botín I–VII | Sendero real I–VIII◆ |
| Guerra | Colmillo I–VII · VIII–XIV · XV–XXI · XXII–XXVIII · XXIX–XXXIV · Quitina I–VI · VII–XII · XIII–XVIII · XIX–XXIII · Reflejos I–III · Rapiña I–VII | Legión I–XI◆ |
| Toques | Caricia suave I–VI · VII–XII · Mano errante I–VII · Compás I–VI (`reqPerk: 'ptp'`; es el «Ritmo» generado, renombrado porque chocaba con `cb1`) | Manos rápidas I–IV◆ |
| Cría | Cáscara fina I–IX · Reserva templada I–VI · Calor suave I–V + Granja de hongos I–II | Nido ancestral I–III◆ |

«Fortuna I–III» (toques) se añade al final de la costilla de `lk1`, tras `t5c`.

- Ids: `x` + rama + familia + número, p. ej. `xwColmillo12`; las claves, `xwK3`.
- Coste de jalea: nivel `min(18, 9 + floor(k / 2) + floor(i / 3))`, con `i` = índice del trozo en la rama (desde 0) y `k` = posición dentro del trozo (desde 0). Claves: `{ bio: 50 + 10·i }`.

### Linaje

**Cría** (↑, costillas ←)
1. `pe1` Huevos fuertes → `pe2` Puesta ancestral, `plb2` Puesta barata
2. `pg1` Nido cálido → `plb1` Nodrizas del linaje, `plb3` Cría veloz
3. `prs` Reina robusta → `pcv` Sangre real
4. `pdx1` Puesta generosa → `pqk` Eclosión precoz, `pdx2` Puesta generosa II
5. `pfe1` Huevo sin precio → `pfe2` II, `plb5` Huevo heredado
6. `ptw` Gemelas → `plb4` Gemelas del linaje
7. `psh` Sangre dorada → `psh2` Estirpe dorada, `psh3` Realeza dorada, `pls1` Brillo heredado, `pls2` Élite heredada

Exterior: Linaje fértil I → II–V · VI → VII–IX · Reserva ancestral I → II–IV · V → VI–VIII · Hongo ancestral I → II–VI.

**Recolección** (→, costillas ↑)
1. `pf1` Memoria del camino → `pf2` Buche heredado, `pf3` Gran buche, `pf4` Hambre ancestral
2. `psp` Patas largas (sin costilla)
3. `ppz` Tributo → `pqj1`, `pqj2`, `pqj3` Reina productora I–III
4. `pgf` Néctar dorado → `pgf2` Banquete dorado
5. `plf1` Rastro heredado → `plf2` Buche del linaje, `plf3` Carga ancestral, `plf4` Noche heredada
6. `pfs1` Festín ancestral → `pfs2` Festín eterno, `pfs3` Festín de la estirpe

Exterior: Memoria I → II–V · VI → VII–IX · Senda I → Senda II, Rebaño de pulgones I–III.

**Guerra** (↓, costillas →)
1. `pd1` Instinto de lucha → `pd2` Mandíbula heredada, `pd3` Furia ancestral, `pd4` Ira de la estirpe
2. `ph1` Piel dura → `ph2` Quitina heredada, `ph3` Coraza ancestral, `ph4` Caparazón eterno
3. `pbk` Carroñeras → `pbio` Biomasa ancestral
4. `pdg` Supervivientes → `plv` Nido fortificado
5. `plw1` Mandíbulas del linaje → `plw2`, `plw3`, `plw4`, `plw5` Mandíbula enorme
6. `pst1` Exoesqueleto titánico NUEVO → `pst2`, `pst3` (punto 3)

Exterior: Coraza I → Coraza II.

**Toques y fundación** (←, costillas ↓)
1. `ps1` Escolta → `pse` Nido preparado, `ps2` Séquito, `ps3` Ejército fundador
2. `pj1` Despensa inicial → `pj2` Tesoro real, `pkp` Herencia, `pns` Todo para la reina
3. `ptp` Racha → `pcb1` Ritmo heredado, `pcb2` Racha ancestral, `pcb3` Pulso de la estirpe, `pck` Racha tenaz NUEVO, `pce` Memoria del ritmo NUEVO, y a continuación Ritmo ancestral I–III (generados)
4. `pl1` Trébol de cuatro hojas → `pl2` Fortuna ancestral, `plt5` Fortuna del linaje
5. `pgh1` Mano fantasma → `pgh2` Mano incansable, `pgh3` Mano de oro, `pgh4` Segunda mano, `pgh5`, `pgh6`, `pgh7`
6. `pds` Saber heredado → `prt` Borrón y cuenta nueva NUEVO (punto 7), `pab1` Mayordomo del nido
7. `plt1` Manos heredadas → `plt2` Caricia del linaje, `plt4` Dedos de oro, `ptn1` Hambre heredada NUEVO, `plt3` Toque ancestral, `ptn2` Hambre heredada II NUEVO
8. `psk` Saltar el día (sin costilla)
9. `ptc` Toque menguante → `ptc2` II, `ptc3` III

Exterior: Toque heredado I → II–VI · Mano heredada I → II–V.

Los movidos a esta rama (`pse`, `pkp`, `pns`, `psk`, `ptc*`) pasan a `cat: 'tap'`. Coste de los generados del linaje: `{ adn: 14 + 6·i + 3·k }`.

**Otros cambios que arrastra.**
- `tree.js › centerOn`: la raíz al centro en los dos árboles (`fx = fy = 0.5`).
- `data.js › OBJ`, objetivo del rombo: `Object.keys(G.skills).some(k => Game.SKILLS[k]?.key)` en vez de `k.includes('K')`.
- Revisar `ui/tour.js` y `game/brain.js` por si nombran ids generados antiguos (`gs…`, `gp…`).
- **Partidas guardadas.** `newGame` pone `treeV: 2`. En `storage.js › load`, si la partida no lo trae: devolver la jalea y la biomasa gastadas y vaciar `G.skills` (lo que hace `resetSkills`, sin exigir el nodo); `G.adn = Math.max(G.adn, G.adnTotal − Σ evoCost(1..G.evo))` y `G.perm = {}`; marcar `treeV = 2` y `G.refundNote = true`. `main.js`, al empezar, muestra una vez: «El Árbol y el Linaje se han reorganizado: te hemos devuelto todo para que lo repartas de nuevo».

**Comprobar.** Script `tools/check-trees.mjs` que falle si: hay dos nodos en la misma casilla; algún enlace no une casillas pegadas en horizontal o vertical; algún nodo no llega a la raíz; hay ids o nombres repetidos dentro de un árbol; falta algún id hecho a mano de los actuales (comparar con el volcado del paso 1, descontando `pab2`).

---

## 9. Toques, racha y mano fantasma

**Respuesta a la duda: hoy la mano fantasma NO aumenta la racha.** `rules.js › ghostBatch` solo cobra con el multiplicador de la racha que haya, sin sumar a la cuenta. Además hay un fallo: la racha solo se comprueba cuando tú tocas, así que si dejas de tocar, `G.combo` se queda con su valor y la mano sigue cobrando ese × indefinidamente.

**Racha, comportamiento nuevo** (`rules.js`):
- Estado: `G.combo` (cuenta), `G.comboT` (reloj real, `G.clock`, del último toque **tuyo**), `G.comboLive` (viva o no).
- Toque tuyo (`comboTap`): si no está viva, `G.combo += 1` y `comboLive = true`; si lo está, suma como hoy (los clics por toque de `comboInfo`, aterrizando en las marcas). Siempre `G.comboT = G.clock`.
- Cuenta atrás oculta: en `tick`, si `comboLive` y `G.clock − G.comboT > D.comboGap`, la racha se pierde: `G.combo = Math.floor(G.combo * D.comboKeep)`, `comboLive = false`, `emit('comboEnd', { kept: G.combo })`. Solo tus toques reinician la cuenta. El margen es el `D.comboGap` de hoy (0,8 s + mejoras).
- Mano fantasma (`ghostBatch`): si `comboLive`, cada toque fantasma suma a la racha con la misma función que un toque tuyo (extraer `comboAdd(G, D)`), sin tocar `comboT`. Si no está viva, ni suma ni cobra multiplicador. Devuelve además `comboBefore`.
- Los umbrales de las marcas se precalculan una vez (hoy `comboTap` crea y ordena arrays en cada toque).

**Todos los beneficios del toque, también para la mano.** Extraer `queenTap(G, D, m)` (suerte, «Toque menguante», «Toque dorado», comida y lo nuevo de abajo) y usarla tanto en `click` como en `ghostBatch`, para que no puedan divergir.

**Quitar el recorte a los toques.** En `rules.js`, sacar `'click'`, `'clickX'`, `'tapQ'` y `'tapB'` del conjunto `DAMP`. Hoy un nodo que dice «Tus toques ×2» da ×1,52, y uno de «+30%», +18%.

**Mecánicas nuevas** (claves de efecto y dónde se aplican):

| Clave | Qué hace | Dónde |
|---|---|---|
| `tapRate` | Cada toque a la reina suma ese % de lo que la colonia recolecta por segundo | `calc`: `D.income = forageRate(G, D)`, `D.tapRate = Math.min(0.1, add('tapRate')) * BAL.tapRateK`. `queenTap`: comida = `(BAL.tapFood * D.tapQ + D.tapRate * D.income) * suerte * racha` |
| `tapSplash` | Tocar un huevo o una larva adelanta también a los demás ese % del toque | `click`, rama de cría |
| `comboEarly` | Las marcas de la racha llegan ese % antes (tope 0,3) | `comboInfo(n, D)`: umbral = `Math.round(at * (1 − D.comboEarly))` |
| `comboKeep` | Al perder la racha conservas ese % (tope 0,5) | la cuenta atrás de arriba |

`BAL.tapRateK: 1` es el dial para afinarlo en la fase G.

**Nodos nuevos del árbol de la colonia** (rama Toques; colocación en el punto 8):

| id | Nombre | Coste | Efecto |
|---|---|---|---|
| `tn1` | Toque nutritivo I | nivel 4 | `tapRate: 0.005` |
| `tn2` | Toque nutritivo II | nivel 7 | `tapRate: 0.005` |
| `tn3` | Toque nutritivo III | nivel 10 | `tapRate: 0.01` |
| `tnK` | Mano que alimenta◆ | `bio: 40` | `tapRate: 0.01` |
| `tb1` | Mimo contagioso | nivel 6 | `tapSplash: 0.25` |
| `tb2` | Mimo contagioso II | nivel 10 | `tapSplash: 0.25` |
| `cb5` | Marca temprana | nivel 11 | `comboEarly: 0.1` |
| `cb6` | Marca temprana II | nivel 13 | `comboEarly: 0.1` |
| `cbK2` | Racha blindada◆ | `bio: 60` | `comboKeep: 0.25` |

**Nodos nuevos del linaje** (coste en datos; el real es la cuarta parte):

| id | Nombre | `adn` | Efecto |
|---|---|---|---|
| `ptn1` | Hambre heredada | 60 | `tapRate: 0.01` |
| `ptn2` | Hambre heredada II | 140 | `tapRate: 0.01` |
| `pck` | Racha tenaz | 80 | `comboKeep: 0.25` |
| `pce` | Memoria del ritmo | 100 | `comboEarly: 0.1` |

Descripciones en el tono de las existentes (p. ej. «Cada toque a la reina suma un 0,5% de lo que tu colonia recolecta por segundo»). Añadir las cuatro claves a `tree.js › STAT`.

**Interfaz** (`ui/juice.js`, `main.js`):
- `Juice.tap(n, mult, cap, { prev, quiet })`: recibe la cuenta anterior en vez de deducirla (con lotes de la mano el cálculo actual de `added` falla) y `quiet` para no sonar. Lee los umbrales de las reglas, no de `BAL.comboMarks` directamente (por `comboEarly`).
- `on('ghost')`: si `r.combo > r.comboBefore`, `Juice.tap(r.combo, r.mult, cap, { prev: r.comboBefore, quiet: true })`: el contador sube también con la mano y celebra las marcas que cruce.
- `on('comboEnd')`: ocultar el contador (hoy se oculta con un temporizador de 900 ms; quitarlo).

**Comprobar.** Sin tocar, la mano no crea racha. Con racha viva, el contador sube solo entre tus clics. Al dejar de tocar, pasado el margen el contador desaparece y la mano vuelve a cobrar ×1. Con «Racha blindada», el siguiente toque retoma desde el 25%.

---

## Equilibrio (fase G)

Cambian la economía: toques sin recorte, `tapRate`, la mano sumando racha, el humano por pisotones y el orden de compra del árbol. Tras implementar:

1. `npm run sim -- --runs=4` y comparar con `sim-antes.txt` y con `TARGETS` de `tools/sim.mjs`.
2. Diales, por este orden: `humanHp` (que el perfil «promedio» gane la noche 25 dentro de su objetivo de horas), `tapRateK`, `stompEvery`, y si el árbol se cierra antes o después que antes, `skillOwnG`.
3. `npm run sim -- --tune=humanHp,tapRateK` si no basta a mano.
4. Entregar al usuario la tabla del antes y el después; no dar el equilibrio por bueno sin enseñarla.
