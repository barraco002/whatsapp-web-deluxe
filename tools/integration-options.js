// Prueba de integracion REAL de la pagina de opciones contra el navegador que
// ya tiene la extension cargada (lo arranca integration.ps1).
//
//   node tools/integration-options.js [--port 9400]
const PORT = Number((() => {
  const i = process.argv.indexOf('--port');
  return i === -1 ? 9400 : process.argv[i + 1];
})());

const CDP = 'http://127.0.0.1:' + PORT;
let seq = 0;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, ok, detail) {
  results.push({ ok, name, detail });
  console.log((ok ? 'OK    ' : 'FALLO ') + name + (ok ? '' : '  -> ' + JSON.stringify(detail).slice(0, 240)));
}

function call(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const t = setTimeout(() => reject(new Error('timeout ' + method)), 20000);
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) { clearTimeout(t); ws.removeEventListener('message', onMsg); resolve(m); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  return ws;
}

async function ev(ws, expression) {
  const r = await call(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result.result.value;
}

(async () => {
  // Un snapshot de Chromium trae sus propias extensiones internas con un
  // background.js igual de valido: hay que identificar el nuestro por API.
  async function findWorker() {
    const list = await (await fetch(CDP + '/json/list')).json();
    const candidates = list.filter((t) => t.url && /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(t.url));
    for (const c of candidates) {
      const ws = await connect(c.webSocketDebuggerUrl);
      try {
        const ours = await ev(ws, "typeof openApp === 'function' && typeof unreadFromTitle === 'function'");
        if (ours) { ws.close(); return c; }
      } catch { /* worker ajeno */ }
      ws.close();
    }
    return null;
  }
  const worker = await findWorker();
  if (!worker) throw new Error('no encuentro el service worker de la extension');

  // Abrir la pagina por la ruta real del usuario (la extension la crea), no
  // navegando desde una pestana cualquiera: el renderer no puede ir a
  // chrome-extension:// por su cuenta.
  const workerWs = await connect(worker.webSocketDebuggerUrl);
  let targetUrl = '';
  try {
    targetUrl = await ev(workerWs, "chrome.runtime.getURL('options.html')");
    const tabId = await ev(workerWs, "chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }).then((t) => t.id)");
    check('la extension abre su pagina de opciones', typeof tabId === 'number', tabId);
  } finally {
    workerWs.close();
  }
  await sleep(1400);

  const after = await (await fetch(CDP + '/json/list')).json();
  const page = after.find((t) => t.url === targetUrl);
  if (!page) throw new Error('no aparece la pestana de opciones (' + targetUrl + ')');

  const ws = await connect(page.webSocketDebuggerUrl);
  try {
    await call(ws, 'Runtime.enable', {});

    const title = await ev(ws, 'document.title');
    check('la pagina carga y es la correcta', /Options/.test(title || ''), title);

    const defaults = await ev(ws, '({ w: document.getElementById("width").value, h: document.getElementById("height").value, win: document.querySelector(\'input[name="mode"][value="window"]\').checked })');
    check('muestra las preferencias por defecto', defaults.w === '1280' && defaults.h === '860' && defaults.win === true, defaults);

    const inlineHandlers = await ev(ws, '(document.documentElement.innerHTML.match(/ on[a-z]+=/g) || []).length');
    check('sin manejadores inline (CSP de MV3)', inlineHandlers === 0, inlineHandlers);

    const saved = await ev(ws, `(async () => {
      document.getElementById('width').value = '1000';
      document.getElementById('height').value = '700';
      document.querySelector('input[name="mode"][value="tab"]').checked = true;
      document.getElementById('form').requestSubmit();
      await new Promise((r) => setTimeout(r, 900));
      const stored = await chrome.storage.sync.get({ mode: 'window', width: 0, height: 0 });
      return { stored, msg: document.getElementById('msg').textContent };
    })()`);
    check('guarda modo y tamano en storage.sync',
      saved && saved.stored && saved.stored.mode === 'tab' && Number(saved.stored.width) === 1000 && Number(saved.stored.height) === 700,
      saved && saved.stored);
    check('avisa al usuario', saved && saved.msg === 'Saved', saved && saved.msg);

    // El service worker debe ver el cambio: es quien decide ventana o pestana.
    const worker2 = await findWorker();
    const ws2 = await connect(worker2.webSocketDebuggerUrl);
    const mode = await ev(ws2, "chrome.storage.sync.get({ mode: 'window' }).then((p) => p.mode)");
    ws2.close();
    check('el service worker ve el cambio', mode === 'tab', mode);

    // Y actuar en consecuencia: en modo pestana abre/reutiliza una pestana.
    const tabsBefore = await (async () => {
      const w = await connect(worker2.webSocketDebuggerUrl);
      const n = await ev(w, "chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }).then((t) => t.length)");
      w.close();
      return n;
    })();
    const ws3 = await connect(worker2.webSocketDebuggerUrl);
    await ev(ws3, 'openApp().then(() => true)');
    ws3.close();
    await sleep(1500);
    const tabsAfter = await (async () => {
      const w = await connect(worker2.webSocketDebuggerUrl);
      const n = await ev(w, "chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }).then((t) => t.length)");
      w.close();
      return n;
    })();
    check('en modo pestana reutiliza la pestana de WhatsApp', tabsAfter === tabsBefore, { tabsBefore, tabsAfter });
  } finally {
    try { await fetch(CDP + '/json/close/' + page.id); } catch { /* ya cerrada */ }
    ws.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log('\n' + (results.length - bad) + '/' + results.length + ' comprobaciones OK (opciones, real)');
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });