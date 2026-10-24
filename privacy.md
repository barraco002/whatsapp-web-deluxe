# Privacy policy - WhatsApp Web Deluxe

Last updated: 2026-10-24

## What this extension does

WhatsApp Web Deluxe opens `https://web.whatsapp.com` in a dedicated browser window and mirrors the unread
message count on the extension's toolbar badge.

## Data collected

**None.** The extension has no servers, no analytics, no telemetry and no crash reporting. Nothing leaves
your computer except the traffic between your browser and WhatsApp, which is the same traffic you would
generate by opening web.whatsapp.com in a normal tab.

## Data stored

The extension stores exactly one value, locally, in the browser's session storage: the identifier of the
window it opened, so that clicking the toolbar icon focuses that window instead of opening a second one.
That value never leaves your machine and is discarded when the browser closes.

## Permissions and why they are needed

| permission | reason |
|---|---|
| `windows` | to create the dedicated window and to focus it again |
| `storage` | to remember which window belongs to the extension (session-only) |
| `https://web.whatsapp.com/*` | to read the tab title, which is where WhatsApp publishes the unread count |

## Third parties

The extension does not sell, transfer or share any data with third parties, because it does not collect any.

## Your messages

Your messages belong to you and to WhatsApp. This extension cannot read them: it has no content script, it
injects no code into the page, and it only ever sees the page title.

## Contact

Open an issue at the project repository, or write to the contact address published on the Chrome Web Store
listing.

## Affiliation

This extension is not affiliated with, endorsed by, or sponsored by WhatsApp LLC or Meta Platforms, Inc.
WhatsApp is a trademark of Meta Platforms, Inc.