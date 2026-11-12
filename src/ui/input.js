// Ratón y táctil sobre la escena: clic para interactuar, arrastre para mover, rueda o pellizco para zoom.
// (el doble clic no hace nada: la cámara solo se mueve arrastrando o con el zoom)
import * as Scene from '../scene/index.js';

export function wireStageInput(stage, onPick) {
  const pts = new Map();
  let down = null, drag = false, pinch = 0;
  const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const spread = () => { const a = [...pts.values()]; return Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY); };

  stage.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, e); down = [e.clientX, e.clientY]; drag = false;
    if (pts.size === 2) { pinch = spread(); drag = true; }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { // solo pasar por encima: resaltar
      const p = local(e), h = Scene.pick(p[0], p[1]);
      Scene.hover(h); stage.style.cursor = h ? 'pointer' : 'grab';
      return;
    }
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, e);
    if (pts.size === 2) { const d = spread(); if (pinch) Scene.zoomBy(pinch / d); pinch = d; return; }
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 7) drag = true;
    if (drag) Scene.panBy(e.clientX - prev.clientX, e.clientY - prev.clientY);
  });
  stage.addEventListener('pointerup', e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (!drag && down) { const p = local(e); onPick(Scene.pick(p[0], p[1])); }
    if (!pts.size) down = null;
  });
  stage.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  stage.addEventListener('wheel', e => { e.preventDefault(); Scene.zoomBy(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
}
