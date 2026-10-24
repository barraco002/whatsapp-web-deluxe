// Captura las pantallas reales para la ficha de la tienda, contra el navegador
// que ya tiene la extension cargada. Salida: PNG 1280x800 en --out.
//
//   node tools/screenshots.js [--port 9400] [--out store]
const fs = require('node:fs');
const path = require('node:path');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}
const PORT = Number(arg('--port', 9400));
const OUT = path.resolve(arg('--out', path.join(__dirname, '..', 'store')));
const CDP = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

function call(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const t = setTimeout(() => reject(new Error('timeout ' + method)), 25000);
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
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 250));
  return r.result.result.value;
}

async function capture(target, file) {
  const ws = await connect(target.webSocketDebuggerUrl);
  try {
    await call(ws, 'Page.enable', {});
    await call(ws, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    // WhatsApp Web pinta por JS: sin espera la captura sale en blanco.
    let text = 0;
    for (let i = 0; i < 12; i++) {
      await sleep(1000);
      try { text = await ev(ws, 'document.body ? document.body.innerText.trim().length : 0'); } catch { text = 0; }
      if (text > 40) break;
    }
    console.log('      texto visible: ' + text + ' caracteres');
    const shot = await call(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (!shot.result || !shot.result.data) throw new Error('sin datos de captura para ' + target.url);
    const buf = Buffer.from(shot.result.data, 'base64');
    fs.writeFileSync(path.join(OUT, file), buf);
    console.log('OK    ' + file + '  ' + buf.length + ' bytes  (' + target.url.slice(0, 60) + ')');
  } finally {
    ws.close();
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const list = await (await fetch(CDP + '/json/list')).json();

  const wa = list.find((t) => (t.type || '') === 'page' && (t.url || '').startsWith('https://web.whatsapp.com'));
  if (!wa) throw new Error('no hay pestana de web.whatsapp.com');
  await capture(wa, 'screenshot-1-window.png');

  // La pagina de opciones se abre como la abre el usuario.
  const workers = list.filter((t) => t.url && /^chrome-extension:\/\/[a-p]{32}\/background\.js$/.test(t.url));
  let worker = null;
  for (const c of workers) {
    const ws = await connect(c.webSocketDebuggerUrl);
    try { if (await ev(ws, "typeof openApp === 'function'")) { worker = c; ws.close(); break; } } catch { /* ajeno */ }
    ws.close();
  }
  if (!worker) throw new Error('no encuentro el service worker de la extension');
  const wws = await connect(worker.webSocketDebuggerUrl);
  const optionsUrl = await ev(wws, "chrome.runtime.getURL('options.html')");
  await ev(wws, "chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }).then((t) => t.id)");
  wws.close();
  await sleep(1500);

  const after = await (await fetch(CDP + '/json/list')).json();
  const optsTab = after.find((t) => t.url === optionsUrl);
  if (!optsTab) throw new Error('no aparece la pestana de opciones');
  await capture(optsTab, 'screenshot-2-options.png');

  console.log('capturas en ' + OUT);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
