# Enviar a las tiendas — todo listo, solo falta la cuenta

Estado a 24/10/2026. Cuando la tarjeta se apruebe, este documento es todo lo que
necesitas: no hay nada pendiente de programar, solo formularios.

## Lo que ya está hecho y verificado

| Cosa | Dónde | Comprobado |
|---|---|---|
| Paquete Chrome/Edge/Opera | `D:\dev\whatsapp-web-deluxe.zip` (14 650 B) | carga en Chromium 158, 9/9 + 8/8 |
| Paquete Firefox | `D:\dev\whatsapp-web-deluxe-firefox.xpi` (15 082 B) | instala en Firefox 160a1, 2/2 |
| Lint de Mozilla | — | 0 errores |
| Manifiestos | — | 15/15 y 8/8 |
| Lógica | — | 14/14 |
| CI | GitHub Actions | verde en cada push |
| Ficha de tienda | `store-listing.md` | texto listo para copiar |
| Política de privacidad pública | https://barraco002.github.io/whatsapp-web-deluxe/privacy.html | HTTP 200 |
| Página del producto | https://barraco002.github.io/whatsapp-web-deluxe/ | HTTP 200 |
| Capturas 1280x800 | `store/screenshot-{1,2,3}.png` | reales + una de funciones |
| Promos Edge/Chrome | `store/promo-{small-440x280,marquee-1400x560}.png` | listas |
| Release pública | github.com/barraco002/whatsapp-web-deluxe/releases/tag/v1.1.0 | con ambos paquetes |

Los archivos que se suben son **exactamente** los del release v1.1.0.

---

## Ruta A — Firefox (gratis, y la más rápida)

Esto lo puedo hacer yo en un minuto en cuanto existan las claves.

1. Crea la cuenta en https://addons.mozilla.org (gratis, sin tarjeta).
2. Entra en https://addons.mozilla.org/developers/addon/api/key/ y genera las
   credenciales. Te da dos valores: **JWT issuer** y **JWT secret**.
3. Déjalos en el entorno y me avisas:

```powershell
$env:AMO_JWT_ISSUER = 'user:12345678:123'
$env:AMO_JWT_SECRET = '...'
```

4. Yo ejecuto `submit-amo.ps1` y el xpi queda firmado y publicado. La revisión
   tarda de minutos a 2 días.

> En el formulario, **desmarca Firefox para Android**. La extensión usa
> `chrome.windows`, que en Fenix no existe; el lint ya avisa de eso.

## Ruta B — Chrome Web Store (25 USD, pago único)

1. Paga el registro en https://chrome.google.com/webstore/devconsole con la
   cuenta de Google que vaya a ser dueña de la extensión. Es un pago único, sin
   renovación y sin reembolso.
2. **New item** → sube `whatsapp-web-deluxe.zip`.
3. Rellena los campos con el texto de `store-listing.md`. Los que importan:

   | Campo del formulario | Qué poner |
   |---|---|
   | Name | WhatsApp Web Deluxe |
   | Short description | la línea de 132 caracteres del archivo |
   | Detailed description | el bloque completo |
   | Category | Social & Communication |
   | Language | English |
   | Privacy policy URL | https://barraco002.github.io/whatsapp-web-deluxe/privacy.html |
   | Single purpose | la frase del archivo, en inglés |
   | Permission justification: windows | crear y enfocar la ventana dedicada |
   | Permission justification: storage | recordar el id de ventana y las preferencias |
   | Host permission justification | leer el título de la pestaña para el contador |

4. Sube las capturas en este orden: `screenshot-1-window.png`,
   `screenshot-3-features.png`, `screenshot-2-options.png`. La promo
   `promo-small-440x280.png` es opcional.
5. En *Distribution*, deja **Public** y marca todos los países.
6. **Submit for review**. Tarda 1–3 días.

### Si lo rechazan

El motivo probable está escrito en la política: *"does not provide enough value
beyond the website"*. La apelación no es reenviar lo mismo; es nombrar lo que la
web no tiene:

> The extension provides three capabilities the website does not: a dedicated
> always-remembered popup window with its own taskbar entry, an unread counter
> mirrored onto the browser toolbar badge from the tab title (no page access, no
> content script), and a global keyboard shortcut. It also stores the user's
> window-or-tab and window-size preference. No page content is read and no
> network request is made.

Si insisten, el plan B es renombrar a **Deluxe Chat**: es una cadena en los dos
manifiestos, se reempaqueta en un minuto y no cambia nada más.

## Ruta C — Edge Add-ons (gratis)

https://partner.microsoft.com/dashboard/microsoftedge → cuenta gratis con el
mismo correo → **New extension** → el mismo `.zip`. Acepta las mismas capturas
más la promo 440x280. Revisión 1–2 días.

## Ruta D — Opera (gratis)

https://addons.opera.com/developer/ → el mismo `.zip`. Revisión 1–5 días.

---

## Orden recomendado

1. **Firefox primero.** Gratis, sin tarjeta, y la firma la hace Mozilla. Es la
   única tienda donde el resultado depende solo de este repositorio.
2. **Edge mientras la tarjeta se aprueba.** Gratis y el paquete ya existe; si
   pasa Edge, pasa Chrome casi seguro.
3. **Chrome al final**, cuando el pago esté confirmado.
4. **Opera** es opcional; aporta poco tráfico y mucho formulario.

## Antes de pulsar enviar

Ejecuta primero el preflight. Si dice `LISTO PARA ENVIAR`, no hay nada más que
comprobar:

```powershell
powershell -NoProfile -File tools\preflight.ps1 -Lint
```

Comprueba los tres gates, que la versión coincida en los dos manifiestos, que los
paquetes existan y contengan lo que prometen, que las imágenes tengan las
dimensiones exactas, que las dos URLs respondan 200, que lo publicado en GitHub
coincida byte a byte con lo local, y que `web-ext lint` no dé errores.

- [ ] El preflight imprime `LISTO PARA ENVIAR`.
- [ ] El zip que subo es el del release `v1.1.0` (14 650 B).
- [ ] La URL de privacidad abre en una ventana privada, sin sesión (HTTP 200).
- [ ] Las tres capturas son 1280x800 exactos.
- [ ] El texto de la ficha no promete nada que la extensión no haga.
- [ ] La cuenta que paga es la que quedará como dueña (no se puede transferir
      sin perder la extensión).

## Después de publicar

- Añadir el enlace de la tienda al README y a la landing.
- Etiquetar la release como *latest* (ya lo está).
- Si aparece una reseña pidiendo sincronización de notificaciones del sistema:
  eso es la versión de escritorio (Tauri Deluxe), no esta.
