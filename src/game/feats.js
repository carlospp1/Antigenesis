// Hitos: marcas de toda la partida (pasan de colonia en colonia, como el linaje) que dan estadísticas para siempre.
// Cada hito mide un contador de por vida (G.life) o algo de la partida (noche más lejana, generación) y, al llegar
// a `at`, se queda en G.feats y suma sus efectos `fx` (mismas claves que los árboles; se aplican en rules.calc).
//   tapN: cada clic cuenta como un toque más (vale el doble, empuja el doble y suma el doble a la racha).

/** Contadores de por vida (no se pierden al fundar). */
export const life = G => G.life || (G.life = { clicks: 0, combo: 0, born: 0, kills: 0, feasts: 0 });

const STATS = {
  combo: ['Racha', 'de racha'],
  clicks: ['Toques', 'toques'],
  born: ['Nacimientos', 'hormigas nacidas'],
  kills: ['Enemigos', 'enemigos derrotados'],
  feasts: ['Festines', 'festines'],
  night: ['Noches', 'noche'],
  gen: ['Generaciones', 'generación']
};

// { id, name, stat, at, fx, prize }
export const FEATS = [
  { id: 'combo100', name: 'Buen pulso', stat: 'combo', at: 100, fx: { tapQ: 0.1 }, prize: '+10% de comida al tocar a la reina' },
  { id: 'combo1k', name: 'Dedo de acero', stat: 'combo', at: 1000, fx: { tapCrit: 0.02 }, prize: '+2% de toques de suerte' },
  { id: 'combo10k', name: 'Imparable', stat: 'combo', at: 10000, fx: { tapN: 1 }, prize: '+1 toque por clic' },
  { id: 'clicks1k', name: 'Mil caricias', stat: 'clicks', at: 1000, fx: { tapQ: 0.1, tapB: 0.1 }, prize: '+10% a todos tus toques' },
  { id: 'clicks10k', name: 'Mano incansable', stat: 'clicks', at: 10000, fx: { tapQ: 0.25, tapB: 0.25 }, prize: '+25% a todos tus toques' },
  { id: 'clicks1m', name: 'Leyenda del toque', stat: 'clicks', at: 1000000, fx: { tapN: 1 }, prize: '+1 toque por clic' },
  { id: 'born100', name: 'Nido lleno', stat: 'born', at: 100, fx: { food: 0.05 }, prize: '+5% de comida por viaje' },
  { id: 'born1k', name: 'Hormiguero', stat: 'born', at: 1000, fx: { food: 0.1, speed: 0.05 }, prize: '+10% de comida y +5% de velocidad' },
  { id: 'born10k', name: 'Imperio', stat: 'born', at: 10000, fx: { food: 0.2, speed: 0.1 }, prize: '+20% de comida y +10% de velocidad' },
  { id: 'kills100', name: 'Guardiana', stat: 'kills', at: 100, fx: { dmg: 0.05 }, prize: '+5% de daño' },
  { id: 'kills1k', name: 'Legión', stat: 'kills', at: 1000, fx: { dmg: 0.1, hp: 0.1 }, prize: '+10% de daño y de vida' },
  { id: 'kills10k', name: 'Plaga', stat: 'kills', at: 10000, fx: { dmg: 0.2, hp: 0.2 }, prize: '+20% de daño y de vida' },
  { id: 'feast1', name: 'Primer banquete', stat: 'feasts', at: 1, fx: { goldFood: 0.01 }, prize: '+1% de comida dorada' },
  { id: 'feast10', name: 'Glotona', stat: 'feasts', at: 10, fx: { luck: 0.03 }, prize: '+3% de entregas dobles' },
  { id: 'night8', name: 'Veterana', stat: 'night', at: 8, fx: { food: 0.1 }, prize: '+10% de comida por viaje' },
  { id: 'night16', name: 'Superviviente', stat: 'night', at: 16, fx: { dmg: 0.15, hp: 0.15 }, prize: '+15% de daño y de vida' },
  { id: 'night24', name: 'Conquistadora', stat: 'night', at: 24, fx: { food: 0.2, prize: 0.2 }, prize: '+20% de comida y de premio nocturno' },
  { id: 'gen3', name: 'Dinastía', stat: 'gen', at: 3, fx: { reserve: 0.25 }, prize: '+25% de comida de las reservas de la reina' },
  { id: 'gen10', name: 'Estirpe eterna', stat: 'gen', at: 10, fx: { growth: 0.15 }, prize: '+15% de velocidad de la cría' }
];

export const featStat = f => STATS[f.stat];

/** Lo que lleva el jugador hacia el hito f. */
export function featValue(G, f) {
  if (f.stat === 'night') return Math.max(G.best || 0, (G.level || 1) - 1);
  if (f.stat === 'gen') return G.gen || 1;
  return life(G)[f.stat] || 0;
}

/** Suma de los efectos de los hitos conseguidos. */
export function featFx(G) {
  const out = {}, got = G.feats || {};
  for (const f of FEATS) if (got[f.id]) for (const k in f.fx) out[k] = (out[k] || 0) + f.fx[k];
  return out;
}

/** Marca los hitos recién conseguidos y los devuelve (para celebrarlos). */
export function checkFeats(G) {
  const L = life(G), got = G.feats || (G.feats = {}), out = [];
  if ((G.combo || 0) > L.combo) L.combo = G.combo;
  for (const f of FEATS) if (!got[f.id] && featValue(G, f) >= f.at) { got[f.id] = true; out.push(f); }
  return out;
}
