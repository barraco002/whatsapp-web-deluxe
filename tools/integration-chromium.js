// Prueba de integracion REAL contra un navegador Chromium con la extension
// cargada. No es un mock: habla CDP con el service worker que el navegador tiene
// vivo y comprueba la ventana, el badge y la reutilizacion de ventana.
//
//   node tools/integration-chromium.js [--port 9400] [--ext <ruta-desempaquetada>]
//
// Lo lanza integration.ps1, que es quien arranca el navegador.
const PORT = Number((arg('--port') || 9400));
const EXT_DIR = arg('--ext') || require('node:path').resolve(__dirname, '..');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

const CDP = 'http://127.0.0.1:' + PORT;
let seq = 0;
const results = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, name, actual, expected });
  console.log((ok ? 'OK    ' : 'FALLO ') + name + (ok ? '' : '  -> ' + JSON.stringify(actual) + ' != ' + JSON.stringify(expected)));
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

async function open(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  return ws;
}

async function ev(ws, expression, awaitPromise = true) {
  const r = await call(ws, 'Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result.result.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await (await fetch(CDP + '/json/list')).json();
  // Un snapshot de Chromium trae sus propias extensiones internas, y alguna
  // tambien se llama background.js. Se elige el service worker que de verdad
  // expone la logica de esta extension.
  const candidates = list.filter((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'));
  if (!candidates.length) throw new Error('ningun service worker de extension: el navegador no cargo la extension');
  let ws = null;
  let sw = null;
  for (const c of candidates) {
    const w = await open(c.webSocketDebuggerUrl);
    await call(w, 'Runtime.enable', {});
    const has = await ev(w, "typeof openApp === 'function' && typeof unreadFromTitle === 'function'").catch(() => false);
    if (has) { ws = w; sw = c; break; }
    w.close();
  }
  if (!ws) throw new Error('la extension no expuso su service worker (candidatos: ' + candidates.map((c) => c.url).join(', ') + ')');
  console.log('service worker: ' + sw.url);

  check('unreadFromTitle("(3) WhatsApp")', await ev(ws, `unreadFromTitle('(3) WhatsApp')`), '3');
  check('unreadFromTitle("(0) WhatsApp")', await ev(ws, `unreadFromTitle('(0) WhatsApp')`), '');
  check('unreadFromTitle("WhatsApp")', await ev(ws, `unreadFromTitle('WhatsApp')`), '');

  // La extension abre su ventana sola al instalarse (runtime.onInstalled).
  const popups = await ev(ws, `chrome.windows.getAll().then(w => w.filter(x => x.type === 'popup').length)`);
  check('abre una ventana popup al instalarse', popups >= 1, true);

  const dims = await ev(ws, `chrome.windows.getAll().then(w => w.filter(x => x.type === 'popup').map(x => [x.width, x.height]))`);
  check('la ventana mide 1280x860', dims[0], [1280, 860]);

  const tab = await ev(ws, `chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }).then(t => t.length ? t[0].id : null)`);
  check('hay una pestana de web.whatsapp.com', typeof tab, 'number');

  // Badge end-to-end: se cambia el titulo de la pagina real y se lee el badge.
  const page = list.find((t) => t.type === 'page' && t.url.startsWith('https://web.whatsapp.com'));
  if (page) {
    const pw = await open(page.webSocketDebuggerUrl);
    await call(pw, 'Runtime.enable', {});
    const orig = await ev(pw, 'document.title', false);
    await ev(pw, 'document.title = "(7) WhatsApp Web"', false);
    await sleep(1500);
    check('el badge muestra 7 al cambiar el titulo', await ev(ws, `chrome.action.getBadgeText({ tabId: ${tab} })`), '7');
    await ev(pw, 'document.title = "(0) WhatsApp Web"', false);
    await sleep(1200);
    check('el badge se vacia con (0)', await ev(ws, `chrome.action.getBadgeText({ tabId: ${tab} })`), '');
    await ev(pw, 'document.title = ' + JSON.stringify(orig || 'WhatsApp Web'), false);
    pw.close();
  }

  // Un segundo openApp con la ventana abierta debe enfocar, no duplicar.
  const reuse = await ev(ws, `(async () => {
    const before = (await chrome.windows.getAll()).filter(w => w.type === 'popup').length;
    await openApp();
    await new Promise(r => setTimeout(r, 600));
    return [before, (await chrome.windows.getAll()).filter(w => w.type === 'popup').length];
  })()`);
  check('el segundo openApp reutiliza la ventana', reuse[1], reuse[0]);

  ws.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + (failed ? ' FALLOS: ' + failed : ' comprobaciones OK (real, no mock)'));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FALLO: ' + e.message); process.exit(1); });