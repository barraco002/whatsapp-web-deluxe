// Options page: read and write the three preferences the service worker uses.
const DEFAULTS = { mode: 'window', width: 1280, height: 860 };

function byId(id) {
  return document.getElementById(id);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

async function load() {
  let prefs = DEFAULTS;
  try {
    prefs = Object.assign({}, DEFAULTS, await chrome.storage.sync.get(DEFAULTS));
  } catch {
    // keep defaults if storage is unavailable
  }
  const mode = prefs.mode === 'tab' ? 'tab' : 'window';
  const radio = document.querySelector('input[name="mode"][value="' + mode + '"]');
  if (radio) radio.checked = true;
  byId('width').value = String(clamp(Number(prefs.width) || DEFAULTS.width, 640, 3840));
  byId('height').value = String(clamp(Number(prefs.height) || DEFAULTS.height, 480, 2160));
}

function flash(text, bad) {
  const msg = byId('msg');
  msg.textContent = text;
  msg.style.color = bad ? '#c0392b' : '#1e8e4e';
  setTimeout(() => { msg.textContent = ''; }, 2500);
}

document.getElementById('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const checked = document.querySelector('input[name="mode"]:checked');
  const width = clamp(Number(byId('width').value) || DEFAULTS.width, 640, 3840);
  const height = clamp(Number(byId('height').value) || DEFAULTS.height, 480, 2160);
  byId('width').value = String(width);
  byId('height').value = String(height);
  const save = byId('save');
  save.disabled = true;
  try {
    await chrome.storage.sync.set({ mode: checked ? checked.value : 'window', width, height });
    flash('Saved', false);
  } catch (e) {
    flash('Could not save: ' + (e && e.message ? e.message : 'storage error'), true);
  } finally {
    save.disabled = false;
  }
});

load();
