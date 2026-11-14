// Guardado en localStorage.
import { newGame, bumpUid, migrateTrees } from './rules.js';

const KEY = 'antigenesis.save.v4';

export function save(G) {
  try { G.last = Date.now(); localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) { /* almacenamiento bloqueado */ }
}

export function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (!o || o.v !== 4) return null; // las partidas de antes del árbol no son compatibles
    // sin treeV: partida con los árboles de antes → se devuelve todo para repartirlo de nuevo
    const G = Object.assign(newGame(), { treeV: 0 }, o);
    migrateTrees(G);
    // la racha de antes contaba con otro reloj: empieza de cero (si no, el primer toque heredaría ×4)
    if (o.clock == null) { G.combo = 0; G.comboLive = false; }
    // partida de antes de los hitos: los contadores de por vida empiezan en lo que lleva esta colonia
    if (!o.life) Object.assign(G.life, { clicks: G.stats.clicks || 0, born: G.stats.born || 0 });
    for (const e of G.eggs.concat(G.larvae)) bumpUid(e.id);
    return G;
  } catch (e) { return null; }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nada */ }
}
