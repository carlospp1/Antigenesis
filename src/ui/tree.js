// Vista de árbol a pantalla completa, para los dos árboles:
//   'skills' → Árbol de la colonia (jalea y biomasa; se pierde con la reina)
//   'perm'   → Linaje (ADN; permanente)
// Se arrastra para moverse y la rueda acerca. Al pasar por un nodo se ve qué hace;
// un clic lo selecciona y otro (o «Comprar») lo compra.
import * as Game from '../game/index.js';
import { fmt } from '../core/format.js';
import { icon } from './icons.js';

const $ = id => document.getElementById(id);
const CELL = 112;
const CUR = { jelly: ['leaf', 'jalea'], bio: ['seed', 'biomasa'], adn: ['dna', 'ADN'] };

export const tv = { open: false, tree: 'skills', sel: null, hover: null, x: 0, y: 0, z: 1, onBuy: null, onClose: null, onFound: null, onReset: null, onAuto: null };
let G = null, lastKey = '';

const nodesOf = tree => tree === 'perm' ? Game.PERKS : Game.SKILLS;

export function openTree(game, tree) {
  G = game; tv.open = true; tv.tree = tree; tv.sel = null; tv.hover = null; lastKey = '';
  $('treeView').hidden = false;
  centerOn('root');
  renderTree(G, true);
}

export function closeTree() { tv.open = false; $('treeView').hidden = true; }

const EW = 230; // separación de las fases en la pista de evolución
function centerOn(id) {
  if (tv.tree === 'evo') {
    const box = $('tvCanvas').getBoundingClientRect();
    const W = Game.EVOS.length * EW;
    tv.z = Math.min(1, Math.max(0.5, (box.width - 40) / W));
    tv.x = W * tv.z <= box.width ? (box.width - W * tv.z) / 2 : box.width / 2 - ((G.evo || 0) + 1) * EW * tv.z; // entera si cabe; si no, centrada en la siguiente
    tv.y = box.height / 2 - 150 * tv.z;
    applyView(); return;
  }
  const n = nodesOf(tv.tree)[id], box = $('tvCanvas').getBoundingClientRect();
  tv.z = Math.min(1, Math.max(box.height < 420 ? 0.45 : 0.55, Math.min(box.width / 1350, box.height / 700)));
  tv.x = box.width / 2 - (n.x + 0.5) * CELL * tv.z;
  tv.y = box.height / 2 - (n.y + 0.5) * CELL * tv.z;
  applyView();
}

function applyView() { $('tvWorld').style.transform = `translate(${tv.x}px, ${tv.y}px) scale(${tv.z})`; }

function costHTML(c, have) {
  const [ic] = CUR[c.cur];
  return `<span class="cost${have < c.n ? ' miss' : ''}">${icon(ic)}${fmt(c.n)}</span>`;
}

/** Redibuja si algo cambió (estado de compra, monedas o selección). */
export function renderTree(game, force) {
  if (!tv.open) return;
  G = game;
  if (tv.tree === 'evo') { renderEvo(force); return; }
  const nodes = nodesOf(tv.tree), owned = tv.tree === 'perm' ? G.perm : G.skills, st = Game.states(G, tv.tree);
  const key = [tv.tree, Object.keys(owned).join(), Math.floor(G.jelly), G.bio, G.adn, tv.sel, tv.hover, G.phase === 'dead'].join('|');
  renderHead();
  if (!force && key === lastKey) return;
  lastKey = key;

  // líneas: doradas entre comprados, tenues si llevan a algo visible
  let lines = '', maxX = 0, maxY = 0;
  const drawn = new Set(), vis = s => s !== 'hidden';
  for (const id in nodes) {
    const n = nodes[id]; maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
    for (const a of n.adj) {
      const k = id < a ? id + a : a + id;
      if (drawn.has(k) || !vis(st[id]) || !vis(st[a])) continue;
      drawn.add(k);
      const m = nodes[a], cls = st[id] === 'owned' && st[a] === 'owned' ? 'on' : (st[id] === 'owned' || st[a] === 'owned') ? 'half' : 'off';
      lines += `<line class="${cls}" x1="${(n.x + 0.5) * CELL}" y1="${(n.y + 0.5) * CELL}" x2="${(m.x + 0.5) * CELL}" y2="${(m.y + 0.5) * CELL}"/>`;
    }
  }
  const W = (maxX + 1) * CELL, H = (maxY + 1) * CELL;
  let html = `<svg class="tv-lines" width="${W}" height="${H}">${lines}</svg>`;
  for (const id in nodes) {
    const n = nodes[id], s = st[id];
    if (s === 'hidden') continue;
    const c = id === 'root' ? null : Game.nodeCost(G, tv.tree, id), afford = c && G[c.cur] >= c.n;
    const cls = ['node', n.cat, s, n.key ? 'key' : '', id === 'root' ? 'root' : '', s === 'open' && afford ? 'can' : '', tv.sel === id ? 'sel' : ''].join(' ');
    const inner = s === 'fog' ? '<b class="q">?</b>' : icon(n.icon);
    html += `<button class="${cls}" data-node="${id}" style="left:${n.x * CELL}px;top:${n.y * CELL}px" aria-label="${s === 'fog' ? 'Desconocido' : n.name}"><span class="face">${inner}</span>${s === 'open' ? costHTML(c, G[c.cur]) : ''}</button>`;
  }
  const world = $('tvWorld');
  world.style.width = W + 'px'; world.style.height = H + 'px';
  world.innerHTML = html;
  renderTip(st);
}

function renderHead() {
  const perm = tv.tree !== 'skills';
  for (const b of document.querySelectorAll('#tvTabs button')) b.classList.toggle('on', b.dataset.tree === tv.tree);
  const pills = perm ? [['adn', Game.debug.free ? '∞' : G.adn]] : [['jelly', Math.floor(G.jelly)], ['bio', G.bio]];
  const h = pills.map(([k, v]) => `<div class="pill panel">${icon(CUR[k][0])}<b>${typeof v === 'string' ? v : fmt(v)}</b><span>${CUR[k][1]}</span></div>`).join('');
  if ($('tvMoney').dataset.k !== h) { $('tvMoney').dataset.k = h; $('tvMoney').innerHTML = h; }
  const dead = G.phase === 'dead';
  $('tvReset').hidden = perm;
  $('tvAuto').hidden = perm;
  $('tvAuto').setAttribute('aria-pressed', G.autoBuy ? 'true' : 'false');
  $('tvAuto').classList.toggle('on', !!G.autoBuy);
  $('tvAuto').innerHTML = `Autocompra <small>${G.autoBuy ? 'sí · compra lo más barato' : 'no'}</small>`;
  const lg = Game.legacy(G);
  $('tvFound').hidden = !(perm && dead);
  $('tvFound').textContent = 'Empezar la nueva colonia';
  $('tvClose').hidden = perm && dead;
  $('tvNote').textContent = perm
    ? (dead ? (G.leaving ? 'La princesa está lista. Gasta tu ADN y empieza la colonia nueva.' : 'La reina ha caído. Gasta tu ADN y funda una colonia nueva.') : 'El linaje es permanente: se conserva al fundar colonias nuevas.')
    : 'Lo que compres aquí se pierde si muere la reina. Los rombos se pagan con biomasa.';
  if (tv.tree === 'evo') $('tvNote').textContent = Game.debug.free
    ? `Debug: elige cualquier forma. Evolución ${G.evo || 0} de ${Game.EVOS.length - 1}.`
    : `Evolución ${G.evo || 0} de ${Game.EVOS.length - 1}. Cada forma se desbloquea al vencer al jefe de una era y es permanente.`;
  $('tvBlood').textContent = tv.tree === 'evo' ? '' : perm ? `Sangre antigua: +${Math.round(Game.BAL.blood * 100 * (G.adnTotal || 0))}% de comida, daño y vida (por ${G.adnTotal || 0} ADN ganado en total)` : '';
}

/** La evolución es una pista lineal: se ve de un vistazo cuántas formas hay y por cuál vas. */
function renderEvo(force) {
  renderHead();
  const key = ['evo', G.evo, G.adn, G.best, tv.sel, tv.hover, Game.debug.free].join('|');
  if (!force && key === lastKey) return;
  lastKey = key;
  const N = Game.EVOS.length, cur = G.evo || 0;
  let html = `<div class="evo-track" style="width:${N * EW}px"><div class="evo-line"><i style="width:${cur / (N - 1) * 100}%"></i></div>`;
  Game.EVOS.forEach((e, i) => {
    const st = Game.evoState(G, i), cost = Game.evoCost(i), can = st === 'next' && (Game.debug.free || G.adn >= cost);
    html += `<button class="evo ${st}${can ? ' can' : ''}${tv.sel === 'e' + i ? ' sel' : ''}" data-node="e${i}" style="left:${i * EW}px">
      <span class="num">${i === 0 ? '·' : i}</span><span class="face">${icon(i === 0 ? 'ant' : i === N - 1 ? 'crown' : 'evo')}</span>
      <b>${e.name}</b><small>${i === 0 ? 'Inicio' : e.desc.split(':')[1] || e.desc}</small>
      ${i === 0 ? '' : st === 'done' ? '<em class="ok">Conseguida</em>' : st === 'next' ? `<em>${Game.debug.free ? 'Libre' : icon('dna') + cost}</em>` : `<em class="lock">${icon('lock')}Noche ${e.req}</em>`}</button>`;
  });
  html += '</div>';
  const world = $('tvWorld');
  world.style.width = N * EW + 'px'; world.style.height = '320px';
  world.innerHTML = html;
  const id = tv.hover || tv.sel, i = id ? +id.slice(1) : Math.min(N - 1, cur + 1), e = Game.EVOS[i], st = Game.evoState(G, i), ecost = Game.evoCost(i);
  const can = st === 'next' && (Game.debug.free || G.adn >= ecost);
  $('tvTip').innerHTML = `<h4>${i}/${N - 1} · ${e.name}</h4><p>${e.desc}</p>${i === 0 ? '' : st === 'done' ? '<p class="good">Tu especie ya es así.</p>'
    : st === 'later' ? '<p class="warn">Antes tienes que conseguir la evolución anterior.</p>'
    : st === 'locked' ? `<p class="warn">Vence a ${Game.evoBoss(i)} (noche ${e.req}) para poder evolucionar.</p>`
    : `<button class="btn-green${can ? '' : ' no'}" data-buy="e${i}">${icon('dna')}${can ? 'Evolucionar' + (Game.debug.free ? '' : ' · ' + ecost + ' ADN') : 'Faltan ' + (ecost - G.adn) + ' ADN'}</button>`}`;
}

function renderTip(st) {
  const id = tv.hover || tv.sel, tip = $('tvTip');
  if (!id || id === 'root' || st[id] === 'hidden') {
    tip.innerHTML = id === 'root' ? `<h4>${nodesOf(tv.tree).root.name}</h4><p>${nodesOf(tv.tree).root.desc}</p>` : `<p class="hint">${matchMedia('(hover: none)').matches ? 'Toca un nodo para ver qué hace y otra vez para comprarlo. Pellizca para acercar.' : 'Pasa el ratón por un nodo para ver qué hace.'} Compra los que están conectados a lo que ya tienes.</p>`;
    return;
  }
  const n = nodesOf(tv.tree)[id], s = st[id], c = Game.nodeCost(G, tv.tree, id);
  if (s === 'fog') { tip.innerHTML = '<h4>???</h4><p>Desbloquea los nodos cercanos para descubrirlo.</p>'; return; }
  const can = s === 'open' && ((Game.debug.free && c.cur === 'adn') || G[c.cur] >= c.n);
  tip.innerHTML = `<h4>${n.key ? '◆ ' : ''}${n.name}</h4><p>${n.desc}</p>
    ${s === 'owned' ? '<p class="good">Comprado</p>' : s === 'seen' ? needsHTML(id)
      : `<button class="btn-green${can ? '' : ' no'}" data-buy="${id}">${icon(CUR[c.cur][0])}${can ? 'Comprar' + (Game.debug.free && c.cur === 'adn' ? '' : ' · ' + fmt(c.n)) : 'Faltan ' + fmt(Math.ceil(c.n - G[c.cur]))}</button>`}`;
}

/** Nodo visible pero no comprable: le falta la mejora anterior o no está conectado. */
function needsHTML(id) {
  const miss = Game.missing(G, tv.tree, id), nodes = nodesOf(tv.tree), req = nodes[id].reqPerk;
  if (req && !G.perm[req]) return `<p class="warn">Necesita «${Game.PERKS[req].name}» en el Linaje.</p>`;
  return miss.length ? `<p class="warn">Primero compra ${miss.map(m => '«' + nodes[m].name + '»').join(' y ')}.</p>` : '<p class="warn">Aún no está conectado a lo que tienes.</p>';
}

export function wireTree(getGame) {
  const cv = $('tvCanvas');
  let drag = null, moved = false;
  // táctil: dos dedos = pellizco para acercar/alejar alrededor del punto medio
  const pts = new Map();
  let pinch = null;
  const mid = () => { const [a, b] = [...pts.values()], r = cv.getBoundingClientRect(); return { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
  const zoomAt = (px, py, z) => { const z0 = tv.z; tv.z = Math.max(0.4, Math.min(1.6, z)); tv.x = px - (px - tv.x) * tv.z / z0; tv.y = py - (py - tv.y) * tv.z / z0; };
  cv.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { pinch = mid(); moved = true; drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, tx: tv.x, ty: tv.y }; moved = false;
  });
  const lift = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  window.addEventListener('pointercancel', lift);
  window.addEventListener('pointerup', lift, true);
  window.addEventListener('pointermove', e => {
    if (!tv.open) return;
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const m = mid();
      zoomAt(m.x, m.y, tv.z * m.d / Math.max(1, pinch.d));
      tv.x += m.x - pinch.x; tv.y += m.y - pinch.y; // y arrastrar con los dos dedos
      pinch = m; applyView(); return;
    }
    if (drag && (e.buttons & 1)) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { tv.x = drag.tx + dx; tv.y = drag.ty + dy; applyView(); }
    }
    const n = e.target.closest && e.target.closest('[data-node]');
    const h = n ? n.dataset.node : null;
    if (h !== tv.hover) { tv.hover = h; renderTree(getGame()); }
  });
  window.addEventListener('pointerup', e => {
    if (!tv.open || !drag) return;
    const was = drag; drag = null;
    if (moved) return;
    const n = e.target.closest && e.target.closest('[data-node]');
    if (!n || !was) return;
    const id = n.dataset.node;
    if (tv.sel === id && tv.onBuy) tv.onBuy(tv.tree, id); // segundo clic = comprar
    tv.sel = id; renderTree(getGame(), true);
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, tv.z * (e.deltaY > 0 ? 0.9 : 1.1));
    applyView();
  }, { passive: false });
  $('tvTip').addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b && tv.onBuy) tv.onBuy(tv.tree, b.dataset.buy); });
  for (const b of document.querySelectorAll('#tvTabs button')) b.onclick = () => {
    const g = getGame();
    if (b.dataset.tree === 'skills' && g.phase === 'dead') return;
    tv.tree = b.dataset.tree; tv.sel = null; centerOn('root'); renderTree(g, true);
  };
  $('tvClose').onclick = () => tv.onClose && tv.onClose();
  $('tvFound').onclick = () => tv.onFound && tv.onFound();
  $('tvReset').onclick = () => tv.onReset && tv.onReset($('tvReset'));
  $('tvAuto').onclick = () => tv.onAuto && tv.onAuto();
}
