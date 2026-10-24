// WhatsApp Web Deluxe - service worker.
// One job: give web.whatsapp.com its own window and mirror the unread count on the badge.

const APP_URL = 'https://web.whatsapp.com/';
const WINDOW_KEY = 'deluxeWindowId';
const BADGE_COLOR = '#25D366';
const WIN_W = 1280;
const WIN_H = 860;

async function findWindow() {
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

async function openApp() {
  const existing = await findWindow();
  if (existing) {
    await chrome.windows.update(existing.id, { focused: true, drawAttention: true });
    return;
  }
  let win;
  try {
    win = await chrome.windows.create({
      url: APP_URL,
      type: 'popup',
      width: WIN_W,
      height: WIN_H,
      focused: true
    });
    // Some platforms ignore width/height on create (a maximised browser can force
    // its own size on the new window). Ask once more explicitly; harmless if the
    // size already matches.
    if (win && win.id && (win.width !== WIN_W || win.height !== WIN_H)) {
      await chrome.windows.update(win.id, { width: WIN_W, height: WIN_H, state: 'normal' });
    }
  } catch {
    // No windows API (or it refused): at least open a tab so the click does something.
    const t = await chrome.tabs.create({ url: APP_URL });
    win = { id: null, tabId: t.id };
  }
  if (win && typeof win.id === 'number') {
    await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
  }
}

chrome.action.onClicked.addListener(() => { void openApp(); });

chrome.windows.onRemoved.addListener(async (windowId) => {
  const stored = await chrome.storage.session.get(WINDOW_KEY);
  if (stored[WINDOW_KEY] === windowId) {
    await chrome.storage.session.remove(WINDOW_KEY);
  }
});

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
