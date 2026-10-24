// Valida el manifest y los recursos de la extension sin dependencias externas.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const errors = [];
const ok = [];

function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8');
  // Chrome acepta JSON con BOM, pero el manifest debe ser UTF-8 sin BOM.
  if (raw.charCodeAt(0) === 0xfeff) errors.push('manifest.json tiene BOM');
  return JSON.parse(raw);
}

const manifestPath = path.join(root, 'manifest.json');
const m = readJson(manifestPath);

if (m.manifest_version !== 3) errors.push('manifest_version debe ser 3');
else ok.push('manifest_version 3');

if (!/^\d+(\.\d+){1,3}$/.test(String(m.version || ''))) errors.push('version invalida: ' + m.version);
else ok.push('version ' + m.version);

if (!m.name || m.name.length > 75) errors.push('name vacio o > 75 caracteres');
else ok.push('name "' + m.name + '"');

const short = m.description || '';
if (short.length < 1 || short.length > 132) errors.push('description debe tener 1..132 caracteres, tiene ' + short.length);
else ok.push('description ' + short.length + ' caracteres');

const icons = m.icons || {};
for (const size of ['16', '32', '48', '128']) {
  const rel = icons[size];
  if (!rel) { errors.push('falta icons.' + size); continue; }
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { errors.push('icono inexistente: ' + rel); continue; }
  const buf = fs.readFileSync(p);
  const png = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (!png) { errors.push('icono no es PNG: ' + rel); continue; }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== Number(size) || h !== Number(size)) errors.push('icono ' + size + ' mide ' + w + 'x' + h);
  else ok.push('icon ' + size + ' ' + w + 'x' + h);
}

const sw = m.background && m.background.service_worker;
if (!sw) errors.push('falta background.service_worker');
else if (!fs.existsSync(path.join(root, sw))) errors.push('service worker inexistente: ' + sw);
else ok.push('service_worker ' + sw);

if (m.background && m.background.scripts) errors.push('background.scripts no existe en MV3');
if (m.browser_action) errors.push('browser_action es MV2, usa action');
if (!m.action) errors.push('falta action');

const perms = m.permissions || [];
const allowed = new Set(['windows', 'storage', 'tabs', 'unlimitedStorage', 'alarms', 'notifications']);
for (const p of perms) if (!allowed.has(p)) errors.push('permiso no esperado: ' + p);
ok.push('permisos: ' + perms.join(', '));

const hosts = m.host_permissions || [];
if (!hosts.includes('https://web.whatsapp.com/*')) errors.push('falta host_permissions de web.whatsapp.com');
ok.push('host_permissions: ' + hosts.join(', '));

if (m.content_scripts) errors.push('esta extension no debe declarar content_scripts');
if (m.minimum_chrome_version && Number(m.minimum_chrome_version) < 110) errors.push('minimum_chrome_version demasiado bajo');
if (m.minimum_chrome_version) ok.push('minimum_chrome_version ' + m.minimum_chrome_version);

// El service worker no debe traer codigo remoto.
const swCode = fs.readFileSync(path.join(root, sw), 'utf8');
if (/\beval\s*\(|new\s+Function\s*\(|importScripts\s*\(/.test(swCode)) errors.push('el service worker usa eval/Function/importScripts (codigo remoto prohibido)');
else ok.push('sin eval, sin Function, sin importScripts');

const optsPage = m.options_ui && m.options_ui.page;
if (!optsPage) errors.push('falta options_ui.page');
else if (!fs.existsSync(path.join(root, optsPage))) errors.push('options page inexistente: ' + optsPage);
else ok.push('options_ui ' + optsPage);

const cmd = (m.commands || {})['open-deluxe'];
if (!cmd) errors.push('falta el comando open-deluxe');
else if (!cmd.suggested_key || !cmd.suggested_key.default) errors.push('open-deluxe sin suggested_key.default');
else ok.push('comando open-deluxe ' + cmd.suggested_key.default);

for (const line of ok) console.log('OK   ' + line);
for (const line of errors) console.log('FALLO ' + line);
console.log(errors.length === 0 ? '\n' + ok.length + '/' + ok.length + ' comprobaciones OK' : '\n' + errors.length + ' errores');
process.exit(errors.length === 0 ? 0 : 1);
