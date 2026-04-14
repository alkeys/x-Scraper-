# X Media URL Extractor

Extension local para Firefox/Chrome que captura URLs de media cargadas por X/Twitter
desde respuestas de red (GraphQL/XHR/fetch) dentro del navegador.

## Que hace

- Captura URLs de imagenes de `https://pbs.twimg.com/media/`
- Captura URLs de video/GIF de `https://video.twimg.com/`
- Selecciona variante MP4 de mayor bitrate cuando hay multiples calidades
- Normaliza imagenes para exportar con formato valido (ejemplo: `?format=jpg&name=orig`)
- Guarda en memoria local del navegador (storage local)
- Exporta a archivo `.txt` desde popup

## Que NO hace

- No usa API oficial de X
- No navega solo ni hace scroll automatico
- No captura contenido que no este cargado en pantalla
- No evita bloqueos/reglas del sitio

## Requisitos

- Navegador compatible con extensiones MV3 (Firefox, Chrome, Brave)
- Acceso a `x.com` o `twitter.com`

## Estructura de archivos

- `manifest.json`: permisos, popup, scripts y recursos
- `content.js`: puente entre popup y script inyectado en pagina
- `page-hook.js`: intercepta respuestas de red en contexto real de pagina
- `popup.html`, `popup.css`, `popup.js`: interfaz de usuario
- `icon.svg`: icono de extension

## Instalacion en Firefox

1. Abre `about:debugging`
2. Entra a `This Firefox`
3. Click en `Load Temporary Add-on...`
4. Selecciona `manifest.json` dentro de esta carpeta

Notas:
- Carga temporal se pierde al cerrar Firefox
- Para distribucion permanente, hay que empaquetar/publicar como addon firmado

## Instalacion en Chrome/Brave

1. Abre `chrome://extensions` (o `brave://extensions`)
2. Activa `Developer mode`
3. Click `Load unpacked`
4. Selecciona carpeta `extension-x-urls`

## Uso paso a paso

1. Abre `https://x.com/<usuario>` o pagina de contenido objetivo
2. Abre popup de extension
3. Click en `Empezar captura`
4. Vuelve a pagina y haz scroll para forzar carga de mas posts/media
5. Abre popup otra vez
6. Verifica contadores de imagenes/videos (se actualizan automaticamente)
7. Click en `Exportar TXT`
8. Click en `Detener captura` al terminar
9. Si quieres reiniciar conteo: `Limpiar`

## Formato de salida TXT

El archivo exportado incluye dos secciones:

1. `# URLs de imagenes (pbs.twimg.com/media)`
2. `# URLs de videos (video.twimg.com)`

Cada URL va en una linea.

## Flujo tecnico resumido

1. `content.js` inyecta `page-hook.js` en contexto de pagina
2. `page-hook.js` parchea `fetch` y `XMLHttpRequest`
3. Cuando detecta respuestas de `graphql` o `i/api`, parsea JSON/texto
4. Extrae media de estructuras conocidas y fallback regex
5. Envia URLs al puente con `window.postMessage`
6. `content.js` deduplica y guarda en `chrome.storage.local`
7. `popup.js` consulta storage y exporta TXT con `chrome.downloads.download`

## Solucion de problemas

### 1) El contador no sube

Checklist:

1. Verifica que estas en `x.com` o `twitter.com`
2. Pulsa `Empezar captura`
3. Recarga pagina (F5 / Ctrl+Shift+R)
4. Haz scroll real (sin scroll, no hay nuevas respuestas)
5. Reabre popup

### 2) Da 0 aunque hay media en pantalla

1. X puede servir contenido desde rutas cambiantes
2. Haz recarga completa y repite
3. Asegura que extension sigue cargada tras reinicio de navegador

### 3) Exporta repetidos

Normalmente no: se usa `Set` para deduplicar.
Si reaparece, limpia con boton `Limpiar` y captura sesion nueva.

### 4) URLs de imagen sin formato (404 en downloader externo)

La extension intenta normalizar a formato valido.
Si un archivo externo trae URLs peladas, normaliza a:

`https://pbs.twimg.com/media/<ID>?format=jpg&name=orig`

### 5) Firefox no deja icono o extension falla al cargar

1. Revisa `about:debugging` logs
2. Recarga extension temporal
3. Si hay problema de icono SVG, cambiar a PNG (16/48/128)

## Compatibilidad

- Firefox: soportado (carga temporal)
- Chrome/Brave: soportado (modo desarrollador)
- Edge: deberia funcionar como Chrome (no probado aqui)

## Seguridad y privacidad

- No envia datos a servidor propio
- Procesamiento local en navegador
- Aun asi, usa con cuenta/sesion bajo tu responsabilidad

## Licencia y creditos

- Autor: **alkeys**
- Licencia: ver archivo `../LICENSE`
- Uso no comercial
- Modificaciones permitidas con credito obligatorio
- Proyecto hobby

## Aviso legal

Este software se entrega "as is".
No garantias.
No se autoriza uso malicioso/ilegal.
El uso final y cumplimiento legal corresponde al usuario.

## Roadmap sugerido

- Modo debug en popup (eventos capturados por segundo)
- Filtro por usuario/perfil actual
- Exportar tambien JSON/CSV
- Opcion de separar videos/imagens en archivos distintos
