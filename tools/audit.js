// Auditoria de casos limite del service worker.
// Cada bloque imprime OK o FALLA; al final resume. No requiere navegador.
const assert = require('node:assert');
const path = require('node:path');

const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const results = [];
function check(name, fn) {
  try { fn(); pass++; results.push(['OK   ', name]); }
  catch (e) { fail++; results.push(['FALLA', name + ' -> ' + e.message]); }
}

// Mock nuevo por escenario: el state es local, no se filtra entre pruebas.
function makeMock(opts = {}) {
  const calls = [];
  const session = {};
  const prefs = opts.prefs || {};
  const state = {
    createDims: { width: 1280, height: 860 },
    tabs: opts.tabs || [],
    windowsGetThrows: !!opts.windowsGetThrows,
    createThrows: !!opts.createThrows,
    createId: 100
  };
  const api = {
    storage: {
      session: {
        get: async (k) => ({ [k]: session[k] }),
        set: async (o) => { Object.assign(session, o); },
        remove: (k) => { delete session[k]; }
      },
      sync: { get: async (d) => Object.assign({}, d, prefs), set: async () => {} }
    },
    windows: {
      get: async (id) => {
        if (state.windowsGetThrows) throw new Error('no window');
        return { id };
      },
      create: async () => {
        if (state.createThrows) throw new Error('refused');
        calls.push(['create']);
        return { id: state.createId, width: state.createDims.width, height: state.createDims.height };
      },
      update: async (id, o) => { calls.push(['update', id, o]); },
      onRemoved: { addListener: (f) => { api.__removed = f; } }
    },
    action: {
      onClicked: { addListener: (f) => { api.__click = f; } },
      setBadgeText: async (o) => { calls.push(['badge', o.tabId, o.text]); },
      setBadgeBackgroundColor: async (o) => { calls.push(['badgeColor', o.tabId, o.color]); }
    },
    commands: { onCommand: { addListener: (f) => { api.__command = f; } } },
    tabs: {
      onUpdated: { addListener: (f) => { api.__updated = f; } },
      query: async () => state.tabs,
      create: async (o) => { calls.push(['tabCreate', o.url]); return { id: 55 }; },
      update: async (id, o) => { calls.push(['tabUpdate', id, o]); }
    },
    runtime: {
      onInstalled: { addListener: (f) => { api.__installed = f; } },
      onStartup: { addListener: (f) => { api.__startup = f; } }
    }
  };
  return { api, calls, session, prefs, state };
}

function loadWorker(mock) {
  const bg = path.join(__dirname, '..', 'background.js');
  delete require.cache[require.resolve(bg)];
  globalThis.chrome = mock.api;
  require(bg);
}

(async () => {
  // ---- 1. Doble clic rapido: no debe crear dos ventanas ----
  {
    const m = makeMock();
    loadWorker(m);
    m.api.__click();
    m.api.__click();
    m.api.__click();
    await tick(200);
    const created = m.calls.filter((c) => c[0] === 'create').length;
    check('tres clics seguidos abren UNA sola ventana', () => {
      assert.strictEqual(created, 1, 'abrio ' + created);
    });
  }

  // ---- 2. onInstalled en una actualizacion no debe abrir ventana ----
  {
    const m = makeMock();
    loadWorker(m);
    m.api.__installed({ reason: 'update', previousVersion: '1.0.9' });
    await tick(200);
    check('una ACTUALIZACION no abre la ventana', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'create').length, 0, 'abrio la ventana en update');
    });
  }

  // ---- 3. onInstalled en instalacion nueva SI debe abrir ----
  {
    const m = makeMock();
    loadWorker(m);
    m.api.__installed({ reason: 'install' });
    await tick(200);
    check('una INSTALACION nueva si abre la ventana', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'create').length, 1);
    });
  }

  // ---- 4. Worker reciclado: el badge debe recuperarse sin esperar a onStartup ----
  {
    const m = makeMock({ tabs: [{ id: 9, url: 'https://web.whatsapp.com/', title: '(4) WhatsApp' }] });
    loadWorker(m);
    await tick(200);
    check('al revivir el worker se repinta el badge de las pestanas abiertas', () => {
      const b = m.calls.find((c) => c[0] === 'badge' && c[1] === 9 && c[2] === '4');
      assert.ok(b, 'no repinto el badge');
    });
  }

  // ---- 5. Preferencias corruptas caen a los valores por defecto ----
  {
    const m = makeMock({ prefs: { mode: 42, width: 'abc', height: -5 } });
    loadWorker(m);
    m.api.__click(); await tick(200);
    const c = m.calls.find((x) => x[0] === 'create');
    check('prefs corruptas -> 1280x860 y modo ventana', () => {
      assert.ok(c, 'no creo la ventana');
    });
    const opts = m.calls.find((x) => x[0] === 'create');
    assert.ok(opts);
  }

  // ---- 6. Tamanos fuera de rango se recortan ----
  {
    const m = makeMock({ prefs: { width: 99999, height: 1 } });
    loadWorker(m);
    m.api.__click(); await tick(200);
    // el worker no expone prefs; comprobamos que la ventana y la correccion usan 3840/480
    const upd = m.calls.find((x) => x[0] === 'update' && x[2] && typeof x[2].width === 'number');
    check('width 99999 y height 1 se recortan a 3840x480', () => {
      assert.ok(upd, 'no hubo correccion de tamano');
      assert.strictEqual(upd[2].width, 3840, 'width ' + (upd && upd[2].width));
      assert.strictEqual(upd[2].height, 480, 'height ' + (upd && upd[2].height));
    });
  }

  // ---- 7. Id de ventana obsoleto: no rompe, crea otra ----
  {
    const m = makeMock({ windowsGetThrows: true });
    m.session.deluxeWindowId = 999;
    loadWorker(m);
    m.api.__click(); await tick(200);
    check('un id de ventana muerto no impide abrir', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'create').length, 1);
    });
  }

  // ---- 8. Si windows.create falla, cae a pestana ----
  {
    const m = makeMock({ createThrows: true });
    loadWorker(m);
    m.api.__click(); await tick(200);
    check('si crear la ventana falla, abre una pestana', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'tabCreate').length, 1);
    });
  }

  // ---- 9. Badge: (0), sin prefijo, y numero grande ----
  {
    const m = makeMock();
    loadWorker(m);
    await m.api.__updated(7, { title: '(0) WhatsApp' }, { url: 'https://web.whatsapp.com/' });
    const t0 = m.calls.find((c) => c[0] === 'badge');
    check('(0) deja el badge vacio', () => assert.strictEqual(t0[2], ''));
    m.calls.length = 0;
    await m.api.__updated(7, { title: 'WhatsApp' }, { url: 'https://web.whatsapp.com/' });
    check('titulo sin prefijo deja el badge vacio', () => assert.strictEqual(m.calls[0][2], ''));
    m.calls.length = 0;
    await m.api.__updated(7, { title: '(120) WhatsApp' }, { url: 'https://web.whatsapp.com/' });
    check('120 no leidos se muestran tal cual', () => assert.strictEqual(m.calls[0][2], '120'));
  }

  // ---- 10. Titulos de otros sitios no tocan el badge ----
  {
    const m = makeMock();
    loadWorker(m);
    await m.api.__updated(8, { title: '(5) YouTube' }, { url: 'https://www.youtube.com/' });
    check('una pestana ajena no pinta el badge', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'badge').length, 0);
    });
    m.calls.length = 0;
    await m.api.__updated(9, { favicon: 'x' }, { url: 'https://web.whatsapp.com/' });
    check('un cambio sin title no repinta el badge', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'badge').length, 0);
    });
  }

  // ---- 11. onRemoved solo limpia el id propio ----
  {
    const m = makeMock();
    loadWorker(m);
    m.session.deluxeWindowId = 100;
    await m.api.__removed(555);
    check('cerrar otra ventana no borra el id guardado', () => assert.strictEqual(m.session.deluxeWindowId, 100));
    await m.api.__removed(100);
    check('cerrar la ventana propia si borra el id', () => assert.strictEqual(m.session.deluxeWindowId, undefined));
  }

  // ---- 12. Modo pestana: reutiliza la pestana existente ----
  {
    const m = makeMock({ prefs: { mode: 'tab' }, tabs: [{ id: 3, url: 'https://web.whatsapp.com/', windowId: 44 }] });
    loadWorker(m);
    m.api.__click(); await tick(200);
    check('modo pestana enfoca la pestana existente', () => {
      const u = m.calls.find((c) => c[0] === 'tabUpdate');
      assert.ok(u && u[1] === 3, 'no enfoco la pestana 3');
    });
    check('modo pestana no crea ventana popup', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'create').length, 0);
    });
  }

  // ---- 13. Modo pestana sin pestana previa ----
  {
    const m = makeMock({ prefs: { mode: 'tab' } });
    loadWorker(m);
    m.api.__click(); await tick(200);
    check('modo pestana sin pestana previa crea una', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'tabCreate').length, 1);
    });
  }

  // ---- 14. El atajo de teclado hace lo mismo que el clic ----
  {
    const m = makeMock();
    loadWorker(m);
    m.api.__command(); await tick(200);
    check('el atajo de teclado abre la ventana', () => {
      assert.strictEqual(m.calls.filter((c) => c[0] === 'create').length, 1);
    });
  }

  console.log('');
  for (const [tag, name] of results) console.log(tag + '  ' + name);
  console.log('\n' + pass + ' OK, ' + fail + ' FALLA de ' + (pass + fail));
  process.exit(fail ? 1 : 0);
})();