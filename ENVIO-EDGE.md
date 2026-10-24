# Envío a Microsoft Edge — campo por campo

Edge Add-ons no cobra registro. Solo necesitas una cuenta Microsoft (la misma de
Windows) y este archivo abierto al lado del formulario.

## 0. Antes de tocar nada

- Cuenta: <https://partner.microsoft.com/dashboard/microsoftedge>
- Tipo de cuenta: **Individual** (no Company: la de compañía pide verificación de
  dominio y datos de empresa).
- Si Partner Center te pide "join the Microsoft Edge program", acepta; es gratis.
- Ten a mano `D:\dev\whatsapp-web-deluxe.zip` y la carpeta `store\`.

## 1. New extension → datos básicos

| Campo del formulario | Qué pegar |
|---|---|
| Extension name | `WhatsApp Web Deluxe` |
| Manifest / package | `whatsapp-web-deluxe.zip` |
| Category | `Social & Communication` |
| Supported languages | `English` (deja Spanish fuera por ahora) |
| Visibility | `Public` |

## 2. Store listing

**Short description** (máximo 132 caracteres, este tiene 111):

```
WhatsApp Web in its own window, with the unread count on your toolbar. 21 KB, no tracking, no account needed.
```

**Description** — pega el bloque completo que está en `store-listing.md`, sección
*Detailed description*. Empieza en "WhatsApp Web in a window of its own." y
termina en "Meta Platforms, Inc.". No lo recortes: las secciones *WHAT IT DOES
NOT DO* y *NOT AFFILIATED WITH WHATSAPP* son las que evitan preguntas en la
revisión.

## 3. Properties

| Campo | Valor |
|---|---|
| Privacy policy URL | `https://barraco002.github.io/whatsapp-web-deluxe/privacy.html` |
| Website | `https://github.com/barraco002/whatsapp-web-deluxe` |
| Support contact | tu correo |
| Mature content | `No` |

## 4. Search terms / keywords

```
whatsapp, whatsapp web, whatsapp desktop, unread, messenger, chat
```

## 5. Imágenes

Sube en este orden; el formulario usa la primera como principal.

1. `store\screenshot-1-window.png` — la ventana con WhatsApp real abierto.
2. `store\screenshot-2-options.png` — la página de opciones.
3. `store\screenshot-3-features.png` — las tres funciones.
4. `store\promo-small-440x280.png` — icono pequeño de la ficha.

La marquesina 1400x560 **no la pide Edge**; guárdala para Chrome.

## 6. Notas para el revisor (si el formulario las ofrece)

```
Single purpose: open https://web.whatsapp.com in a dedicated window (or tab, per
the user's setting), show its unread count on the toolbar badge, and expose a
keyboard shortcut to reach it.

The "windows" permission creates and re-focuses that dedicated window. The
"storage" permission keeps the window id for the session and remembers the
window-or-tab and size preferences. The host permission for
https://web.whatsapp.com/* is used only to read the tab title, which is where
WhatsApp itself publishes the unread count. There is no content script, no
injected code and no network request of any kind.

To test: install, click the toolbar icon, log in to WhatsApp Web (or scan the QR
with a phone), and watch the badge. Ctrl+Shift+Y opens or focuses the window.
```

## 7. Después de enviar

- Estado inicial: *In review*. Suele tardar entre unas horas y 2 días.
- Si piden cambios, el correo trae el motivo exacto; se corrige y se reenvía sin
  volver a pagar nada (aquí nunca se pagó).
- Cuando esté aprobada, la ficha tarda unas horas más en aparecer en
  `microsoftedge.microsoft.com/addons`.
- Guarda el enlace de la ficha: sirve como prueba pública del proyecto y como
  enlace para el README y la landing.

## Lo que no se puede automatizar

El botón *Publish* está detrás de tu sesión de Microsoft. No hay API pública de
envío para Edge, así que este paso lo das tú; todo lo demás ya está hecho y
verificado (`tools\preflight.ps1` → 15/15, "LISTO PARA ENVIAR").
