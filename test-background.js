// Prueba de la logica del service worker con un mock de la API de chrome.
const assert = require('node:assert');
const path = require('node:path');
const calls = [];
const session = {};
const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));
globalThis.chrome = {
  storage: { session: {
    get: async (k) => ({ [k]: session[k] }),
    set: async (o) => { Object.assign(session, o); },
    remove: async (k) => { delete session[k]; }
  } },
  windows: {
    get: async (id) => { if (id === session.deluxeWindowId) return { id }; throw new Error('no window'); },
    create: async (opts) => { calls.push(['create', opts.type, opts.width, opts.height]); return { id: 100 }; },
    update: async (id, o) => { calls.push(['update', id, o.focused]); },
    onRemoved: { addListener: (f) => { chrome.__removed = f; } }
  },
  action: {
    onClicked: { addListener: (f) => { chrome.__click = f; } },
    setBadgeText: async (o) => { calls.push(['badge', o.tabId, o.text]); },
    setBadgeBackgroundColor: async () => {}
  },
  tabs: { onUpdated: { addListener: (f) => { chrome.__updated = f; } } },
  runtime: { onInstalled: { addListener: () => {} } }
};
require(path.join(__dirname, 'background.js'));
(async () => {
  chrome.__click(); await tick();
  assert.deepStrictEqual(calls[0], ['create', 'popup', 1280, 860], 'abre ventana popup 1280x860');
  calls.length = 0;
  chrome.__click(); await tick();
  assert.deepStrictEqual(calls[0], ['update', 100, true], 'el segundo clic enfoca la ventana existente');
  calls.length = 0;
  await chrome.__updated(7, { title: '(3) WhatsApp' }, { url: 'https://web.whatsapp.com/', title: '(3) WhatsApp' });
  assert.deepStrictEqual(calls[0], ['badge', 7, '3'], 'badge = 3');
  calls.length = 0;
  await chrome.__updated(7, { title: 'WhatsApp' }, { url: 'https://web.whatsapp.com/', title: 'WhatsApp' });
  assert.deepStrictEqual(calls[0], ['badge', 7, ''], 'sin no leidos el badge se vacia');
  calls.length = 0;
  await chrome.__updated(8, { title: '(9) otra cosa' }, { url: 'https://example.com/', title: '(9) otra cosa' });
  assert.strictEqual(calls.length, 0, 'ignora pestanas ajenas');
  await chrome.__removed(100); await tick();
  assert.strictEqual(session.deluxeWindowId, undefined, 'olvida la ventana al cerrarse');
  console.log('6/6 aserciones OK');
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });