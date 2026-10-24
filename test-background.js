// Prueba de la logica del service worker con un mock de la API de chrome.
const assert = require('node:assert');
const path = require('node:path');

const calls = [];
const session = {};
const state = { createDims: { width: 1280, height: 860 }, tabs: [] };
const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

globalThis.chrome = {
  storage: { session: {
    get: async (k) => ({ [k]: session[k] }),
    set: async (o) => { Object.assign(session, o); },
    remove: async (k) => { delete session[k]; }
  } },
  windows: {
    get: async (id) => { if (id === session.deluxeWindowId) return { id }; throw new Error('no window'); },
    create: async (opts) => {
      calls.push(['create', opts.type, opts.width, opts.height]);
      return { id: 100, width: state.createDims.width, height: state.createDims.height };
    },
    update: async (id, o) => { calls.push(['update', id, o]); },
    remove: async (id) => { calls.push(['remove', id]); },
    onRemoved: { addListener: (f) => { chrome.__removed = f; } }
  },
  action: {
    onClicked: { addListener: (f) => { chrome.__click = f; } },
    setBadgeText: async (o) => { calls.push(['badge', o.tabId, o.text]); },
    setBadgeBackgroundColor: async (o) => { calls.push(['badgeColor', o.tabId, o.color]); }
  },
  tabs: {
    onUpdated: { addListener: (f) => { chrome.__updated = f; } },
    query: async () => state.tabs,
    create: async (o) => { calls.push(['tabCreate', o.url]); return { id: 55 }; }
  },
  runtime: {
    onInstalled: { addListener: (f) => { chrome.__installed = f; } },
    onStartup: { addListener: (f) => { chrome.__startup = f; } }
  }
};

require(path.join(__dirname, 'background.js'));

(async () => {
  // 1. primer clic: abre la ventana con el tamano esperado
  chrome.__click(); await tick();
  assert.deepStrictEqual(calls[0], ['create', 'popup', 1280, 860], 'abre ventana popup 1280x860');
  assert.strictEqual(session.deluxeWindowId, 100, 'recuerda el id de la ventana');

  // 2. segundo clic: enfoca, no duplica
  calls.length = 0;
  chrome.__click(); await tick();
  assert.deepStrictEqual(calls[0], ['update', 100, { focused: true, drawAttention: true }], 'el segundo clic enfoca la ventana existente');
  assert.strictEqual(calls.filter((c) => c[0] === 'create').length, 0, 'no abre una segunda ventana');

  // 3. si la plataforma ignora el tamano en create, se corrige con update
  session.deluxeWindowId = undefined;
  state.createDims = { width: 1400, height: 900 };
  calls.length = 0;
  chrome.__click(); await tick();
  const fix = calls.find((c) => c[0] === 'update' && c[2] && c[2].width === 1280);
  assert.ok(fix, 'corrige el tamano cuando create lo ignora');
  state.createDims = { width: 1280, height: 860 };

  // 4. badge con no leidos
  calls.length = 0;
  await chrome.__updated(7, { title: '(3) WhatsApp' }, { url: 'https://web.whatsapp.com/', title: '(3) WhatsApp' });
  assert.deepStrictEqual(calls[0], ['badge', 7, '3'], 'badge = 3');
  assert.deepStrictEqual(calls[1], ['badgeColor', 7, '#25D366'], 'pinta el badge de verde');

  // 5. "(0)" no debe pintar un cero
  calls.length = 0;
  await chrome.__updated(7, { title: '(0) WhatsApp' }, { url: 'https://web.whatsapp.com/', title: '(0) WhatsApp' });
  assert.deepStrictEqual(calls[0], ['badge', 7, ''], '(0) deja el badge vacio, no un 0');

  // 6. sin prefijo de no leidos
  calls.length = 0;
  await chrome.__updated(7, { title: 'WhatsApp' }, { url: 'https://web.whatsapp.com/', title: 'WhatsApp' });
  assert.deepStrictEqual(calls[0], ['badge', 7, ''], 'sin no leidos el badge se vacia');

  // 7. pestanas ajenas
  calls.length = 0;
  await chrome.__updated(8, { title: '(9) otra cosa' }, { url: 'https://example.com/', title: '(9) otra cosa' });
  assert.strictEqual(calls.length, 0, 'ignora pestanas ajenas');

  // 8. cambios que no son el titulo
  calls.length = 0;
  await chrome.__updated(7, { status: 'loading' }, { url: 'https://web.whatsapp.com/', title: '(5) WhatsApp' });
  assert.strictEqual(calls.length, 0, 'ignora cambios que no son el titulo');

  // 9. al cerrar la ventana se olvida el id
  await chrome.__removed(100); await tick();
  assert.strictEqual(session.deluxeWindowId, undefined, 'olvida la ventana al cerrarse');

  // 10. al arrancar el navegador sincroniza las pestanas ya abiertas
  calls.length = 0;
  state.tabs = [{ id: 21, title: '(4) WhatsApp' }, { id: 22, title: 'WhatsApp' }];
  chrome.__startup(); await tick();
  assert.deepStrictEqual(
    calls.filter((c) => c[0] === 'badge'),
    [['badge', 21, '4'], ['badge', 22, '']],
    'el arranque pone el badge de las pestanas que ya estaban abiertas'
  );

  console.log('10/10 aserciones OK');
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
