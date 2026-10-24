## 1.1.1 — correcciones de una auditoría de casos límite

Cinco fallos reales encontrados con pruebas nuevas, no con inspección a ojo.

### Corregido

- **Tres clics seguidos abrían tres ventanas.** El service worker comprobaba si ya
  había ventana, no la encontraba (todavía no se había guardado el id) y creaba
  otra. Ahora hay un cerrojo: mientras hay una apertura en curso, las siguientes
  esperan a esa misma.
- **Cada actualización de la extensión abría una ventana de WhatsApp.** El evento
  de instalación se disparaba también en las actualizaciones. Ahora solo en la
  instalación nueva, que es lo que la revisión de la tienda espera.
- **El badge de no leídos desaparecía solo.** MV3 duerme el service worker a los
  ~30 segundos y el badge por pestaña se perdía hasta el siguiente cambio de
  título. Ahora se repinta al revivir el worker.
- **Un cambio de título con el texto nuevo en el evento se ignoraba** si el objeto
  de la pestaña venía desfasado. Se usa el valor del evento.
- **El título de la ventana no se restauraba al reabrir desde el acceso directo**
  (app de escritorio, no esta extensión).

### Pruebas

- `tools/audit.js` — 19 casos límite, 19 OK.
- `test-background.js` — 14/14.
- `tools/validate.js` — 15/15. `tools/validate-firefox.js` — 8/8.
- Integración real en Chromium sobre el paquete: 9/9 + 8/8.
- Integración real en Firefox Nightly: 2/2.
