# X Media URL Extractor (MVP)

Extension local para Firefox/Chrome.
Captura URLs de medios cargados en X/Twitter desde respuestas GraphQL/XHR en navegador.

Extrae:
- Imagenes `https://pbs.twimg.com/media/`
- Videos `https://video.twimg.com/`

## Instalar (Firefox)

1. Abre `about:debugging`
2. Click en `This Firefox`
3. Click en `Load Temporary Add-on...`
4. Selecciona `manifest.json` dentro de esta carpeta

## Instalar (Chrome/Brave)

1. Abre `chrome://extensions`
2. Activa `Developer mode`
3. Click `Load unpacked`
4. Selecciona carpeta `extension-x-urls`

## Uso

1. Abre `x.com/<usuario>`
2. Haz scroll para cargar posts
3. Abre popup de extension
4. Click `Empezar captura`
5. Haz scroll para cargar posts
6. Click `Actualizar`
7. Click `Exportar TXT`
8. Click `Detener captura` cuando termines

## Limite importante

Extension solo puede extraer datos que X ya cargue en pagina.
Si no haces scroll, no existe data para capturar.

## Licencia

Este proyecto usa licencia no comercial con atribucion obligatoria. Puedes
modificarlo y redistribuirlo, pero debes conservar credito al autor.

## Aviso

Este proyecto fue hecho como hobby. El uso, abuso o consecuencias derivadas
del uso quedan bajo tu responsabilidad. El autor no se hace responsable por
daños, reclamos o problemas legales.
