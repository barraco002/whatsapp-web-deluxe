# Store listing copy

## Name

WhatsApp Web Deluxe

## Short description (132 characters max)

WhatsApp Web in its own window, with the unread count on your toolbar. 40 KB, no tracking, no account needed.

## Detailed description

WhatsApp Web in a window of its own.

One click on the toolbar icon and web.whatsapp.com opens without tabs, without an address bar and without
the rest of your browser one Alt-Tab away. Click the icon again and it brings that window back instead of
opening a second one.

The number of unread chats shows up on the toolbar badge, so you can tell at a glance whether anything is
waiting without keeping a tab open.

WHAT IT DOES NOT DO

- It does not read your messages. There is no content script and no injected code; the extension only sees
  the page title, which is where WhatsApp itself publishes the unread count.
- It does not collect, sell or send any data anywhere. No analytics, no telemetry, no servers.
- It does not modify WhatsApp. You are using the real web.whatsapp.com, with your real account and your
  real end-to-end encryption.

WHO IT IS FOR

People who use WhatsApp Web every day and are tired of hunting for the tab. If you want a native
application instead, the same project ships a 6 MB Tauri desktop build for Windows.

NOT AFFILIATED WITH WHATSAPP

This extension is an independent client wrapper. It is not affiliated with, endorsed by or sponsored by
WhatsApp LLC or Meta Platforms, Inc.

## Category

Social & Communication

## Language

English (add Spanish as a second locale if you want the LatAm traffic)

## Single purpose statement (the review form asks for this)

Open web.whatsapp.com in a dedicated window and reflect its unread message count on the toolbar badge.

## Permission justifications (the review form asks for each)

- **windows**: create the dedicated popup window and re-focus it on later clicks.
- **storage**: keep the window id for the duration of the browser session so the icon does not spawn duplicates.
- **host permission https://web.whatsapp.com/***: read the tab title to extract the unread count. No page
  content is read and no script is injected.

## Screenshots to upload (1280x800 or 640x400)

1. The window open on the WhatsApp Web login screen (same shot as the desktop app).
2. The toolbar with the badge showing a number, cropped tight.
3. `chrome://extensions` showing the extension with its three permissions listed.

## What to expect from review

Single-purpose wrappers of a single website sit on the edge of the store's policy. Two outcomes are
realistic: approval in 1-3 days, or rejection for "does not provide enough value beyond the website". If it
is rejected, the fix is not to resubmit the same thing: add a feature the website does not have (the badge
already helps, a keyboard shortcut helps more) and say so in the appeal.