// Valida la variante Firefox (Gecko) sin dependencias: los permisos, el id y
// el background son distintos de los de Chromium y un error aqui es un rechazo
// de AMO, no un warning.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ffDir = path.join(root, 'firefox');

// Los scripts de la variante Firefox viven en firefox/, salvo background.js que
// se comparte con la variante Chromium en la raiz del repo.
function resolve(rel) {
  for (const base of [ffDir, root]) {
    const p = path.join(base, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const errors = [];
const ok = [];

const m = JSON.parse(fs.readFileSync(path.join(root, 'firefox', 'manifest.json'), 'utf8'));

if (m.manifest_version !== 3) errors.push('manifest_version debe ser 3');
else ok.push('manifest_version 3');

// Gecko no conoce el permiso "windows": la API windows no pide permiso alli.
// Dejarlo produce el warning MANIFEST_PERMISSIONS "Invalid permissions".
const geckoInvalid = ['windows', 'tabGroups', 'offscreen', 'sidePanel'];
for (const p of m.permissions || []) {
  if (geckoInvalid.includes(p)) errors.push('permiso no valido en Gecko: ' + p + ' (web-ext lint lo marca como Invalid permissions)');
}
ok.push('permisos Gecko: ' + (m.permissions || []).join(', '));

const bss = m.browser_specific_settings && m.browser_specific_settings.gecko;
if (!bss) errors.push('falta browser_specific_settings.gecko');
else {
  if (!bss.id || !bss.id.includes('@')) errors.push('gecko.id invalido: ' + bss.id);
  else ok.push('gecko.id ' + bss.id);
  const [major, minor] = String(bss.strict_min_version || '0').split('.').map(Number);
  if (major < 109) errors.push('strict_min_version < 109: sin soporte MV3');
  // data_collection_permissions lo introduce Firefox 140; declararlo por debajo
  // dispara KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION en web-ext lint.
  if (bss.data_collection_permissions && major < 140) errors.push('data_collection_permissions exige strict_min_version >= 140');
  else if (bss.data_collection_permissions) ok.push('data_collection_permissions ' + bss.data_collection_permissions.required.join(',') + ' (min ' + major + '.' + (minor || 0) + ')');
}

if (m.background && m.background.service_worker) errors.push('Gecko no soporta background.service_worker de forma fiable; usa background.scripts');
if (!m.background || !Array.isArray(m.background.scripts)) errors.push('falta background.scripts');
else {
  for (const s of m.background.scripts) {
    if (!resolve(s)) errors.push('script inexistente: ' + s);
  }
  ok.push('background.scripts ' + m.background.scripts.join(' + '));
  // ff-compat.js debe ir ANTES de background.js o chrome.* no existe en Gecko.
  if (m.background.scripts.indexOf('ff-compat.js') !== 0) errors.push('ff-compat.js debe ser el primer script del background');
}

if (m.minimum_chrome_version) errors.push('minimum_chrome_version no significa nada en Gecko');
if (m.content_scripts) errors.push('esta extension no declara content_scripts');

for (const size of ['16', '32', '48', '128']) {
  const rel = (m.icons || {})[size];
  if (!rel || !resolve(rel)) errors.push('icono ' + size + ' ausente');
}
ok.push('iconos 16/32/48/128 presentes');

for (const line of ok) console.log('OK   ' + line);
for (const line of errors) console.log('FALLO ' + line);
console.log(errors.length === 0 ? '\n' + ok.length + '/' + ok.length + ' comprobaciones OK (firefox)' : '\n' + errors.length + ' errores (firefox)');
process.exit(errors.length === 0 ? 0 : 1);