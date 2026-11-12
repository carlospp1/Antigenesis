// Bus de eventos mínimo: la lógica emite, la escena, el audio y la interfaz escuchan.
const listeners = {};

export function on(type, fn) {
  (listeners[type] ||= []).push(fn);
  return () => off(type, fn);
}

export function off(type, fn) {
  const l = listeners[type];
  if (l) l.splice(l.indexOf(fn) >>> 0, 1);
}

export function emit(type, data) {
  for (const fn of listeners[type] || []) fn(data || {});
}
