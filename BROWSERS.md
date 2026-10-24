# One codebase, five engines

Short answer: **the code already runs on every Chromium browser and on Firefox.**
What changes per engine is the *manifest*, and what changes per store is *who
approves you and what it costs*. Nothing here is blocked on Chrome's review.

## Engine support

| Engine | Browsers | Needs | Status here |
|---|---|---|---|
| **Blink** (Chromium) | Chrome, Edge, Brave, Opera, Vivaldi, Arc, Yandex, Chromium | `manifest.json` | **done** — MV3, service worker |
| **Gecko** | Firefox, LibreWolf, Waterfox, Tor Browser | `firefox/manifest.json` + `ff-compat.js` | **done** — `web-ext lint`: **0 errors** |
| **WebKit** | Safari (macOS/iOS) | `xcrun safari-web-extension-converter`, macOS, Apple Developer (99 USD/yr) | not built — needs a Mac |
| Electron/WebView2 wrappers | the desktop app | nothing | that is [Tauri Deluxe](https://github.com/barraco002/WhatsApp-Tauri) |

### Why Firefox needs a second manifest and not a second codebase

`background.js` is written against promises (`await chrome.windows.create(...)`).
Blink returns promises from `chrome.*`; Gecko returns promises from `browser.*` and
leaves `chrome.*` as a callback API. So the Firefox build ships one 8-line file,
`ff-compat.js`, loaded **before** `background.js`, that points `chrome` at
`browser`. That is the entire port. The other three differences are in the manifest:

| | Chromium | Firefox |
|---|---|---|
| Background | `background.service_worker` | `background.scripts: ["ff-compat.js", "background.js"]` (event page — reliable across Gecko versions) |
| `windows` permission | required for `chrome.windows` | **does not exist**; `windows` API needs no permission. Declaring it is `Invalid permissions` in `web-ext lint` |
| Identity | none (the store assigns an id) | `browser_specific_settings.gecko.id` + `strict_min_version` |
| Data disclosure | store form | `data_collection_permissions: { required: ["none"] }` (Firefox 140+) |

`tools/validate.js` and `tools/validate-firefox.js` check both, and CI runs
both plus `web-ext lint`, so the two manifests cannot drift apart silently.

## Do I have to wait for approval?

Depends on the channel, not on the engine.

| Channel | Review | Cost | Who can use it |
|---|---|---|---|
| Chrome Web Store | 1–3 days, human | 25 USD once | anyone |
| Edge Add-ons | 1–2 days | free | anyone |
| Firefox AMO | minutes to 1–2 days (automated lint + signing; human only if flagged) | **free, signing included** | anyone |
| Opera Add-ons | 1–5 days | free | anyone |
| Enterprise policy (`ExtensionInstallForcelist`) | **none** | free | your own machines / your company |
| `.crx` + “Load unpacked” | **none** | free | your own machines |
| Firefox `about:debugging` temporary add-on | **none** | free | your own machines, until Firefox restarts |
| Self-hosted `.xpi` signed by AMO | AMO signs, you host | free | anyone who trusts your domain |

So: **to reach strangers, yes, there is a queue.** Every store has one. But nobody
gates the code — a `.crx` built with `chrome --pack-extension` or the `.xpi` in
this repo runs without asking anyone, on machines you control, today.

## Enterprise / kiosk install without any store

Chromium reads a policy file. Create
`%ProgramFiles(x86)%\Google\Chrome\Application\distribution\policies.json`:

```json
{
  "policies": {
    "ExtensionSettings": {
      "pplpdlpnimojihfefnmnhcgbfagkeicf": {
        "installation_mode": "force_installed",
        "update_url": "https://clients2.google.com/service/update2/crx"
      }
    }
  }
}
```

That id only works for a store-published extension. For a local build on your own
fleet the supported path is a self-hosted update manifest:

```json
{
  "policies": {
    "ExtensionInstallForcelist": ["pplpdlpnimojihfefnmnhcgbfagkeicf;https://example.com/updates.xml"]
  }
}
```

with `updates.xml` pointing at the `.crx` and its version. No store, no review,
installed for every user of the machine, and Chrome keeps it updated from your
`update_url` whenever you bump `version` in the manifest.

## What is left, honestly

- **Safari**: needs a Mac and 99 USD/yr. Not happening on this machine. The MV3
  manifest is ~90% compatible; the converter rewrites the rest.
- **Firefox Android**: `chrome.windows` does not exist on Fenix, so the popup
  window idea does not translate. Leave Android unticked in AMO.
- **Store listings do not accept a wrapper with no added value.** The added value
  here is the dedicated window plus the unread badge; that argument is written in
  `store-listing.md` and should not be watered down.
