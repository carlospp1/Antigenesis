// Ratón y táctil sobre la escena: clic para interactuar, arrastre para mover, rueda o pellizco para zoom.
// (el doble clic no hace nada: la cámara solo se mueve arrastrando o con el zoom)
import * as Scene from '../scene/index.js';

export function wireStageInput(stage, onPick) {
  const pts = new Map();
  /** Punteros que empezaron sobre reina/cría/enemigo: ese gesto no panea nunca. */
  const noPan = new Set();
  const downHit = new Map();
  let down = null, drag = false, pinch = 0;
  const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const spread = () => { const a = [...pts.values()]; return Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY); };
  const touring = () => !!document.getElementById('tour');

  stage.addEventListener('pointerdown', e => {
    // captura: el soltar llega aquí aunque salga un panel encima
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    pts.set(e.pointerId, e); down = [e.clientX, e.clientY]; drag = false;
    const p0 = local(e), h0 = Scene.pick(p0[0], p0[1]);
    if (h0) {
      noPan.add(e.pointerId);
      downHit.set(e.pointerId, h0);
      stage.style.cursor = 'pointer';
    } else {
      noPan.delete(e.pointerId);
      downHit.delete(e.pointerId);
    }
    if (pts.size === 2) {
      pinch = spread();
      drag = true;
      for (const id of pts.keys()) { noPan.delete(id); downHit.delete(id); }
    }
  });
  stage.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId) && e.pointerType === 'mouse' && !e.buttons) forget(e);
    if (!pts.has(e.pointerId)) {
      const p = local(e), h = Scene.pick(p[0], p[1]);
      Scene.hover(h); stage.style.cursor = h ? 'pointer' : 'grab';
      return;
    }
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, e);
    if (touring()) return;
    if (pts.size === 2) { const d = spread(); if (pinch) Scene.zoomBy(pinch / d); pinch = d; return; }
    // si el pick falló al bajar pero ahora hay reina/enemigo bajo el dedo, bloquea pan igual
    if (!noPan.has(e.pointerId)) {
      const p = local(e), h = Scene.pick(p[0], p[1]);
      if (h) { noPan.add(e.pointerId); downHit.set(e.pointerId, h); }
    }
    if (noPan.has(e.pointerId)) return;
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10) drag = true;
    if (drag) Scene.panBy(e.clientX - prev.clientX, e.clientY - prev.clientY);
  });
  stage.addEventListener('pointerup', e => {
    if (!pts.has(e.pointerId)) return;
    const locked = noPan.has(e.pointerId);
    if (locked || (!drag && down)) {
      const p = local(e);
      onPick(Scene.pick(p[0], p[1]) || downHit.get(e.pointerId) || null);
    }
    forget(e);
  });
  function forget(e) {
    pts.delete(e.pointerId);
    noPan.delete(e.pointerId);
    downHit.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (!pts.size) { down = null; drag = false; }
  }
  stage.addEventListener('pointercancel', forget);
  // no olvidar en lostpointercapture: en algunos navegadores salta a mitad del gesto y reactivaba el drag
  window.addEventListener('pointerup', e => { if (pts.has(e.pointerId) && e.target !== stage && !stage.contains(e.target)) forget(e); });
  window.addEventListener('pointercancel', forget);
  stage.addEventListener('wheel', e => { e.preventDefault(); if (!touring()) Scene.zoomBy(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });
}
