// WhatsApp Web Deluxe - service worker.
// One job: give web.whatsapp.com its own window (or tab), mirror the unread
// count on the toolbar badge, and answer the keyboard shortcut.
// No network requests of its own, no remote code, no data collection.

const APP_URL = 'https://web.whatsapp.com/';
const WINDOW_KEY = 'deluxeWindowId';
const BADGE_COLOR = '#25D366';
const DEFAULTS = { mode: 'window', width: 1280, height: 860 };
const LIMITS = { width: [640, 3840], height: [480, 2160] };

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

async function getPrefs() {
  let raw = DEFAULTS;
  try {
    const stored = await chrome.storage.sync.get(DEFAULTS);
    if (stored && typeof stored === 'object') raw = Object.assign({}, DEFAULTS, stored);
  } catch {
    // storage.sync can be unavailable (policy, private window); defaults still work.
  }
  return {
    mode: raw.mode === 'tab' ? 'tab' : 'window',
    width: clamp(Math.round(Number(raw.width) || DEFAULTS.width), LIMITS.width[0], LIMITS.width[1]),
    height: clamp(Math.round(Number(raw.height) || DEFAULTS.height), LIMITS.height[0], LIMITS.height[1])
  };
}

function hasWindowsApi() {
  return typeof chrome.windows !== 'undefined' && typeof chrome.windows.create === 'function';
}

async function findWindow() {
  if (!hasWindowsApi()) return null;
  const stored = await chrome.storage.session.get(WINDOW_KEY);
  const id = stored[WINDOW_KEY];
  if (typeof id !== 'number') return null;
  try {
    const win = await chrome.windows.get(id);
    return win && win.id ? win : null;
  } catch {
    return null;
  }
}

async function openInTab() {
  const tabs = await chrome.tabs.query({ url: APP_URL + '*' });
  const open = tabs && tabs[0];
  if (open && typeof open.id === 'number') {
    await chrome.tabs.update(open.id, { active: true });
    if (hasWindowsApi() && typeof open.windowId === 'number') {
      try { await chrome.windows.update(open.windowId, { focused: true }); } catch { /* window may be gone */ }
    }
    return;
  }
  await chrome.tabs.create({ url: APP_URL });
}

async function openApp() {
  const prefs = await getPrefs();

  if (prefs.mode === 'tab') {
    await openInTab();
    return;
  }

  const existing = await findWindow();
  if (existing) {
    await chrome.windows.update(existing.id, { focused: true, drawAttention: true });
    return;
  }

  let win = null;
  try {
    win = await chrome.windows.create({
      url: APP_URL,
      type: 'popup',
      width: prefs.width,
      height: prefs.height,
      focused: true
    });
    // Some platforms ignore width/height on create (a maximised browser can force
    // its own size on the new window). Ask once more explicitly; harmless if the
    // size already matches.
    if (win && win.id && (win.width !== prefs.width || win.height !== prefs.height)) {
      await chrome.windows.update(win.id, { width: prefs.width, height: prefs.height, state: 'normal' });
    }
  } catch {
    win = null;
  }

  if (win && typeof win.id === 'number') {
    await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
    return;
  }
  // No windows API (or it refused): at least open a tab so the click does something.
  await openInTab();
}

chrome.action.onClicked.addListener(() => { void openApp(); });

if (typeof chrome.commands !== 'undefined' && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(() => { void openApp(); });
}

if (hasWindowsApi() && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener(async (windowId) => {
    const stored = await chrome.storage.session.get(WINDOW_KEY);
    if (stored[WINDOW_KEY] === windowId) {
      await chrome.storage.session.remove(WINDOW_KEY);
    }
  });
}

function unreadFromTitle(title) {
  const match = /^\((\d+)\)/.exec(title || '');
  if (!match) return '';
  // "(0)" means nothing pending; an empty badge, not a badge that says 0.
  const n = Number(match[1]);
  return n > 0 ? String(n) : '';
}

async function applyBadge(tabId, title) {
  const text = unreadFromTitle(title);
  await chrome.action.setBadgeText({ tabId, text });
  if (text) await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url || !tab.url.startsWith(APP_URL)) return;
  if (!('title' in changeInfo)) return;
  await applyBadge(tabId, tab.title);
});

// A tab that was already open when the browser started has no onUpdated event
// waiting for it, so sync once on startup.
async function syncExistingTabs() {
  const tabs = await chrome.tabs.query({ url: APP_URL + '*' });
  for (const t of tabs) {
    if (typeof t.id === 'number') await applyBadge(t.id, t.title);
  }
}

chrome.runtime.onInstalled.addListener(() => { void openApp(); });
chrome.runtime.onStartup.addListener(() => { void syncExistingTabs(); });
