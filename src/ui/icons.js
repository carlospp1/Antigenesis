// Iconos SVG dibujados a mano (sin archivos). Uso: icon('leaf').
const P = {
  evo: '<path d="M12 2l5 6h-3v4h-4V8H7z" fill="currentColor"/><ellipse cx="7" cy="18" rx="3.2" ry="2.4" fill="currentColor"/><ellipse cx="12" cy="17.5" rx="2" ry="1.7" fill="currentColor"/><circle cx="16.4" cy="16.8" r="2.3" fill="currentColor"/>',
  ghost: '<path d="M9 11V4.5a1.5 1.5 0 013 0V10m0-.5V3.5a1.5 1.5 0 013 0V10m0-5a1.5 1.5 0 013 0v8c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4L4 13.5a1.6 1.6 0 012.7-1.7L9 14" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  goldleaf: '<path d="M20 4C10 4 4 10 4 18c0 .7.1 1.3.2 2C6 13 11 9 16 8c-5 3-8.5 7-10 12.5.6.2 1.3.3 2 .3C16 20.8 20 13 20 4z" fill="#f2c14a"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="#fff3c4"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="currentColor"/>',
  clover: '<g fill="currentColor"><circle cx="8.5" cy="8.5" r="4"/><circle cx="15.5" cy="8.5" r="4"/><circle cx="8.5" cy="15.5" r="4"/><circle cx="15.5" cy="15.5" r="4"/></g><path d="M12 12l5 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  sparkle: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/>',
  flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 1.5-5 3-6 0 2 1 3.5 2.5 4C11 9 10 5 12 2z" fill="#f08a3c"/><path d="M12 13c1.2 1.4 3 2.4 3 4.5a3 3 0 01-6 0c0-1.6 1.4-2.8 3-4.5z" fill="#ffd27a"/>',
  eggs2: '<ellipse cx="8.5" cy="13.5" rx="5" ry="6.5" fill="#f6e8cc"/><ellipse cx="15.5" cy="12" rx="5" ry="6.5" fill="#fbf1dc"/><ellipse cx="14" cy="9" rx="1.3" ry="2.2" fill="#fffaf0"/>',
  coin: '<circle cx="12" cy="12" r="8.5" fill="#f0b84c"/><circle cx="12" cy="12" r="6" fill="none" stroke="#b9822a" stroke-width="1.4"/><path d="M12 8v8M9.8 10h3.4a1.5 1.5 0 010 3h-2.4a1.5 1.5 0 000 3h3.4" stroke="#8a5a14" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  fist: '<path d="M6 10.5V8a1.6 1.6 0 013.2 0v-.8a1.6 1.6 0 013.2 0v.3a1.6 1.6 0 013.2 0v1a1.6 1.6 0 013.2 0V14c0 4-2.8 7-6.8 7H11c-3 0-5-2.2-5-5z" fill="currentColor"/><path d="M9.2 8v3M12.4 7.5v3.5M15.6 8.5v3" stroke="#00000055" stroke-width="1.1"/>',
  bolt: '<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2z" fill="currentColor"/>',
  skull: '<path d="M12 3c-4.7 0-8 3.2-8 7.5 0 2.6 1.3 4.4 3 5.4V19a1 1 0 001 1h8a1 1 0 001-1v-3.1c1.7-1 3-2.8 3-5.4C20 6.2 16.7 3 12 3z" fill="currentColor"/><circle cx="9" cy="11" r="2" fill="#2b1b13"/><circle cx="15" cy="11" r="2" fill="#2b1b13"/><path d="M11 15.5h2" stroke="#2b1b13" stroke-width="1.4"/>',
  leaf: '<path d="M20 4C10 4 4 10 4 18c0 .7.1 1.3.2 2C6 13 11 9 16 8c-5 3-8.5 7-10 12.5.6.2 1.3.3 2 .3C16 20.8 20 13 20 4z" fill="#7cc443"/><path d="M6 20.5C7.5 15 11 11 16 8" stroke="#3f7a1e" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  seed: '<ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(35 12 12)" fill="#c98a4b"/><path d="M8 17c2-4 5-8 8-10" stroke="#8a5528" stroke-width="1.4" fill="none" stroke-linecap="round"/><ellipse cx="10" cy="9" rx="1.6" ry="3" transform="rotate(35 10 9)" fill="#e9b47a"/>',
  ant: '<g fill="currentColor"><ellipse cx="6" cy="14" rx="4" ry="3"/><ellipse cx="12" cy="13" rx="2.2" ry="1.8"/><circle cx="17" cy="11.5" r="2.6"/></g><g stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M18 9.5l1.5-4 2 -.5M16.5 9.3l-.5-4-2-1"/><path d="M11 14.5l-2 5M12.5 14.5l1 5.5M13.5 13.5l4 4.5M10.5 12l-3-4M12 11.5l1-4M13.5 12.5l3.5-3"/></g>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor"/><path d="M12 5v14" stroke="#00000044" stroke-width="1.5"/>',
  book: '<path d="M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z" fill="#e8d3a8"/><path d="M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z" fill="#f4e4c1"/><path d="M5 8.5c2-.5 3.5-.3 5 .5M5 11.5c2-.5 3.5-.3 5 .5M14 9c1.5-.8 3-1 5-.5M14 12c1.5-.8 3-1 5-.5" stroke="#9a7a4c" stroke-width="1" fill="none"/>',
  gear: '<path fill="#e7dccb" d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.6 5l-1.9-.4a7 7 0 01-.7 1.7l1.1 1.6-1.9 1.9-1.6-1.1a7 7 0 01-1.7.7l-.4 1.9h-2.8l-.4-1.9a7 7 0 01-1.7-.7l-1.6 1.1-1.9-1.9 1.1-1.6a7 7 0 01-.7-1.7l-1.9-.4v-2.8l1.9-.4a7 7 0 01.7-1.7L4.9 6.5l1.9-1.9 1.6 1.1a7 7 0 011.7-.7l.4-1.9h2.8l.4 1.9a7 7 0 011.7.7l1.6-1.1 1.9 1.9-1.1 1.6a7 7 0 01.7 1.7l1.9.4z"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 01-10 0z" fill="#f0b84c"/><path d="M7 5H3.5c0 3 1.5 5 4 5.3M17 5h3.5c0 3-1.5 5-4 5.3" stroke="#f0b84c" stroke-width="1.6" fill="none"/><path d="M10.5 13h3v4h-3z" fill="#d99a2e"/><path d="M7.5 21h9l-1-3.5h-7z" fill="#f0b84c"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z" fill="#f0b84c"/><path d="M5 18h14v2.5H5z" fill="#d99a2e"/><circle cx="12" cy="13.5" r="1.6" fill="#c0392b"/>',
  egg: '<ellipse cx="12" cy="13" rx="6.5" ry="8.5" fill="#f6e8cc"/><ellipse cx="9.5" cy="9.5" rx="1.8" ry="3" fill="#fffaf0"/>',
  larva: '<g fill="#f2dfb8"><circle cx="5.5" cy="15" r="3"/><circle cx="9.5" cy="12.5" r="3.6"/><circle cx="14" cy="11.5" r="3.8"/><circle cx="18.2" cy="13" r="3.3"/></g><circle cx="19.5" cy="12" r=".8" fill="#5a3a20"/>',
  arrows: '<g fill="currentColor"><path d="M5 9l3-4 3 4H9v10H7V9z"/><path d="M13 7l3-4 3 4h-2v12h-2V7z" /><path d="M9 13l3-4 3 4h-2v6h-2v-6z" opacity=".8"/></g>',
  flask: '<path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 006.2 21h11.6a2 2 0 001.7-2.5L14 9V3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M7 16h10l1.5 2.6a1 1 0 01-.9 1.4H6.4a1 1 0 01-.9-1.4z" fill="currentColor" opacity=".55"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="15" r="1.6" fill="#2b1b13"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M8.5 6h7M9 18h6M10 12h4" stroke="currentColor" stroke-width="1.4"/>',
  sword: '<path d="M14 3h7v7L10 21l-2-2L4 21l-1-1 2-4-2-2z" fill="currentColor" opacity=".9"/>',
  boot: '<path d="M7 3h6v9l6 3a2 2 0 011 1.7V20H5V3z" fill="currentColor"/>',
  hand: '<path d="M9 11V4.5a1.5 1.5 0 013 0V10m0-.5V3.5a1.5 1.5 0 013 0V10m0-5a1.5 1.5 0 013 0v8c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4L4 13.5a1.6 1.6 0 012.7-1.7L9 14" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4.5" fill="#f0b84c"/><g stroke="#f0b84c" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" fill="#9db0ff"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  music: '<path d="M9 18V6l10-2v12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="17" cy="16" r="2.5" fill="currentColor"/>'
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

/** Sustituye los <i data-icon="x"> del HTML estático por su SVG. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.outerHTML = icon(el.dataset.icon, el.className);
}
