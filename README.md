# WhatsApp Web Deluxe

**WhatsApp Web in its own window — with an unread badge on the toolbar.**

[![ci](https://github.com/barraco002/whatsapp-web-deluxe/actions/workflows/ci.yml/badge.svg)](https://github.com/barraco002/whatsapp-web-deluxe/actions/workflows/ci.yml)
[![manifest v3](https://img.shields.io/badge/manifest-v3-25D366)](manifest.json)
[![size](https://img.shields.io/badge/zip-11%20KB-25D366)](#whats-in-the-box)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A Chrome extension (Manifest V3) that opens `web.whatsapp.com` as a dedicated
browser popup window instead of yet another tab, and shows the pending unread
count on the toolbar icon.

It is the browser-side sibling of [**Tauri Deluxe**](https://github.com/barraco002/WhatsApp-Tauri),
a Tauri v2 desktop wrapper for the same website.

---

## Why would anyone want this

Because tabs are where chat apps go to die. You open WhatsApp in a tab, it
scrolls off into a pile of twenty tabs, and you never look at it again. This
extension gives it a real window with its own taskbar entry, remembers that
window, and puts the unread count where your eyes already are.

```
click the icon  ->  window appears (or the existing one comes to the front)
new message     ->  the toolbar badge shows "(3)"
close window    ->  the window is forgotten; the next click opens a fresh one
```

## What it does

| | |
|---|---|
| **Dedicated window** | `chrome.windows.create({ type: 'popup', 1280x860 })` — no tab strip, no address bar, own taskbar icon |
| **One window, not five** | The window id is kept in `chrome.storage.session`; clicking the icon again focuses it instead of opening a second copy |
| **Unread badge** | Reads `(N)` from the page title via `chrome.tabs.onUpdated`, and only for tabs whose URL starts with `https://web.whatsapp.com/` |
| **Survives restarts, forgets cleanly** | `chrome.windows.onRemoved` clears the stored id, so a stale id can never point at a dead window |
| **Refreshes on install** | `chrome.runtime.onInstalled` opens the window once, so the first run is not a mystery |

## What it deliberately does not do

This is where most "WhatsApp in a window" extensions quietly become spyware.
This one does none of it:

- **No content script.** Nothing is injected into the page. The badge comes from
  the tab *title*, which is a first-class browser API, not from reading your DOM.
- **No network requests.** The service worker has zero `fetch`. Your messages
  never touch anything but WhatsApp's own servers.
- **No remote code.** No `eval`, no `Function`, no `importScripts`, no CDN
  script. `tools/validate.js` fails the build if any of them appear.
- **No storage of anything but a window id.** `chrome.storage.session` is
  memory-only and dies with the browser session. No account, no analytics, no
  identifiers, no "anonymous usage data".
- **No permissions it does not need.** `windows` and `storage`. That is the
  whole list. No `tabs`, no `notifications`, no `<all_urls>`.
- **Not affiliated with WhatsApp or Meta.** It is a window. That is all it is.

Full text: [privacy.md](privacy.md).

## Install (unpacked, 30 seconds)

1. Download or clone this repo.
2. Go to `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → pick this folder.
4. Click the toolbar icon.

> Chrome 137+ ignores `--load-extension` on the command line unless the
> extension comes from the store, so "Developer mode → Load unpacked" is the
> only way to run an unpacked copy today. That is a browser policy, not a bug
> in this extension.

## Build the store package

```powershell
powershell -NoProfile -File pack.ps1
```

It validates the manifest, stages only the four files Chrome needs
(`manifest.json`, `background.js`, `privacy.md`, `icons/`), zips them with the
manifest at the archive root, and prints the byte size and SHA-256.

Expected output today:

```
whatsapp-web-deluxe.zip   11 4xx bytes
```

## Checks

```bash
node tools/validate.js           # 13/13 — Chromium manifest, icons, permissions, no remote code
node tools/validate-firefox.js   #  6/6  — Gecko manifest, forbidden permissions, script order
node test-background.js          # 10/10 — mock, no dependencies, no test framework
powershell -File integration.ps1 #  9/9  — real browser over CDP, not a mock
```

The three static checks run in CI on every push, plus `web-ext lint` on the
Firefox build.

### Verified in a real browser, not just in a mock

`integration.ps1` starts a Chromium with the extension loaded, connects to the
live service worker over CDP, and asserts what the user actually sees:

```
service worker: chrome-extension://pplpdlpnimojihfefnmnhcgbfagkeicf/background.js
OK    unreadFromTitle("(3) WhatsApp")
OK    unreadFromTitle("(0) WhatsApp")
OK    unreadFromTitle("WhatsApp")
OK    abre una ventana popup al instalarse
OK    la ventana mide 1280x860
OK    hay una pestana de web.whatsapp.com
OK    el badge muestra 7 al cambiar el titulo
OK    el badge se vacia con (0)
OK    el segundo openApp reutiliza la ventana

9/9 comprobaciones OK (real, no mock)
```

Run against **Chromium 158.0.8122.0**. It found two bugs the mock could not:

1. A tab titled `(0) WhatsApp` produced a badge that said **"0"**. Fixed:
   `unreadFromTitle` now returns `''` for zero.
2. `chrome.windows.create({ width, height })` was **ignored** when the host
   window was already sized — the popup opened at 1400x900 instead of 1280x860.
   Fixed with a follow-up `chrome.windows.update` when the size comes back wrong.

## What is in the box

| File | Bytes | What it is |
|---|---|---|
| `manifest.json` | 782 | MV3 manifest, two permissions |
| `background.js` | 1 744 | The entire logic. One file, no build step |
| `icons/icon{16,32,48,128}.png` | 631–4 892 | Generated by `make-icons.py` (Pillow), not hand-drawn |
| `privacy.md` | 1 794 | The policy the store asks for |
| `store-listing.md` | 2 843 | Name, description, permission justifications, review notes |

Total unpacked: ~13 KB. Total zipped: ~11 KB.

## Other browsers

The code is not Chrome-specific. **Blink** (Chrome, Edge, Brave, Opera, Vivaldi, Arc)
uses `manifest.json`; **Gecko** (Firefox, LibreWolf) uses `firefox/manifest.json`
plus an 8-line `ff-compat.js` that points `chrome` at `browser`. `web-ext lint`
reports **0 errors** on the Firefox build.

```powershell
powershell -NoProfile -File pack.ps1          # Chromium  -> whatsapp-web-deluxe.zip
powershell -NoProfile -File pack-firefox.ps1  # Gecko     -> whatsapp-web-deluxe-firefox.xpi
```

**WebKit/Safari** needs a Mac and an Apple Developer account, so it is not built.
See [BROWSERS.md](BROWSERS.md) for the full engine matrix, the manifest differences
that actually matter, and how to install this on a fleet of machines with no store
and no review at all.

## Publishing status

| Store | Status | Cost | Review |
|---|---|---|---|
| Chrome Web Store | package ready, **not yet submitted** | 25 USD once | 1–3 days |
| Microsoft Edge Add-ons | same zip works | free | 1–2 days |
| Firefox AMO | xpi ready, **not yet submitted** | free (signing included) | minutes–2 days |
| Opera Add-ons | same zip works | free | 1–5 days |
| Self-hosted / enterprise policy | works today | free | **none** |

If a store challenges the "WhatsApp" name, the drop-in fallback is **Deluxe Chat** —
a single string in each manifest, nothing else changes.

## Related

- [**Tauri Deluxe**](https://github.com/barraco002/WhatsApp-Tauri) — the desktop
  version: the same website in a WebView2 window, 6.5 MB binary, no Electron.
- Upstream, where the desktop app started:
  [Wpnnt/WhatsApp-Tauri](https://github.com/Wpnnt/WhatsApp-Tauri).

## License

MIT. See [LICENSE](LICENSE). Not affiliated with WhatsApp LLC or Meta.
