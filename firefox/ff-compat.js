// Firefox expone la API basada en promesas como `browser`, y `chrome` como
// alias con callbacks. background.js esta escrito con promesas, asi que en Gecko
// apuntamos `chrome` a `browser` antes de que se cargue. Sin polyfill, sin
// dependencias, y no toca nada en Chromium (donde `browser` no existe).
if (typeof globalThis.browser !== 'undefined' && typeof globalThis.chrome === 'undefined') {
  globalThis.chrome = globalThis.browser;
}
