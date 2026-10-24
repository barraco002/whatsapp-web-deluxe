# Deploy

Three channels, three different levels of "done". Pick by how far you want to go.

## What is already deployed (nothing left for you to do)

| Thing | Where it lives | Verified |
|---|---|---|
| Source, MIT | https://github.com/barraco002/whatsapp-web-deluxe | public |
| Chromium package | release v1.0.0 → `whatsapp-web-deluxe.zip` (11 485 B) | loaded in Chromium 158, 9/9 integration checks |
| Gecko package | release v1.0.0 → `whatsapp-web-deluxe-firefox.xpi` (11 920 B) | `web-ext lint` 0 errors, loaded in Firefox 160a1 |
| CI | GitHub Actions: 3 validators + `web-ext lint` + both packages | green |

## Channel 1 — your own browser, today (no account, no review)

**Chromium family** (Chrome, Edge, Brave, Opera, Vivaldi):

1. `chrome://extensions` → *Developer mode* → *Load unpacked* → this folder.
2. Click the toolbar icon.

**Firefox**:

1. `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on*.
2. Pick `firefox/manifest.json`.

Both survive until the browser restarts (Firefox) or until you remove it (Chromium).

## Channel 2 — the stores (free except Chrome)

| Store | Account | Cost | Command / URL |
|---|---|---|---|
| **Firefox AMO** | https://addons.mozilla.org/developers/ | **free** | `submit-amo.ps1` (needs API keys below) |
| Edge Add-ons | https://partner.microsoft.com/dashboard/microsoftedge | free | upload the same `.zip` |
| Opera | https://addons.opera.com/developer/ | free | upload the same `.zip` |
| Chrome Web Store | https://chrome.google.com/webstore/devconsole | **25 USD once** | upload the same `.zip` |

### AMO by command line

1. Create the add-on once at https://addons.mozilla.org/developers/addon/submit/
   (name `WhatsApp Web Deluxe`, category *Productivity*, **untick Android**).
2. Get API credentials: https://addons.mozilla.org/developers/addon/api/key/
3. Export them and run:

```powershell
$env:AMO_JWT_ISSUER = 'user:NNNNNNN:NNN'
$env:AMO_JWT_SECRET = '...'
powershell -NoProfile -File submit-amo.ps1
```

`web-ext sign` uploads the build, waits for the automated review, and drops the
**signed `.xpi`** into `web-ext-artifacts/`. That signed file is what you attach to
the GitHub release — Firefox will only install signed add-ons, and this is how you
get one without publishing publicly if you chose `-Channel unlisted`.

## Channel 3 — a fleet, no store at all

Chromium reads `policies.json`:

```json
{
  "policies": {
    "ExtensionInstallForcelist": ["<id>;https://example.com/updates.xml"]
  }
}
```

`updates.xml`:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='<id>'>
    <updatecheck codebase='https://example.com/whatsapp-web-deluxe.crx' version='1.0.0' />
  </app>
</gupdate>
```

The id of the packed `.crx` in this repo (`pack.ps1` output signed by
`chrome --pack-extension`) is `fgjkcpmeihfbbnbhoajahoknmfhnbdnb` — **different from
the unpacked id** (`pplpdlpnimojihfefnmnhcgbfagkeicf`), because the packed id comes
from the signing key, not the folder path. Bump `version` in the manifest, repack,
and Chrome updates every installed copy from your `codebase` URL.
