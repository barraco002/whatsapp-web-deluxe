// WhatsApp Web Deluxe - service worker.
// One job: give web.whatsapp.com its own window and mirror the unread count on the badge.

const APP_URL = 'https://web.whatsapp.com/';
const WINDOW_KEY = 'deluxeWindowId';
const BADGE_COLOR = '#25D366';

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
  const win = await chrome.windows.create({
    url: APP_URL,
    type: 'popup',
    width: 1280,
    height: 860
  });
  await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
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
  return match ? match[1] : '';
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url || !tab.url.startsWith(APP_URL)) return;
  if (!('title' in changeInfo)) return;
  const text = unreadFromTitle(tab.title);
  await chrome.action.setBadgeText({ tabId, text });
  if (text) await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
});

chrome.runtime.onInstalled.addListener(() => { void openApp(); });