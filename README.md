
# Twitter or X Media Downloader 🚀

Este script en Python permite descargar de forma masiva imágenes y videos de Twitter (X) utilizando listas de URLs directas de sus servidores de contenido (CDN).

## 📌 Funcionalidad

El script procesa un archivo de texto que contiene las rutas de los archivos alojados en los dominios de Twitter y los descarga localmente.

* **Imágenes:** Procesamiento de URLs provenientes de `https://pbs.twimg.com/media/`.
* **Videos:** Procesamiento de URLs provenientes de `https://video.twimg.com/`.

## 🛠️ Requisitos

* **Python 3.x**
* Biblioteca `requests` (u otras dependencias que uses para la descarga).

## 🚀 Modo de Uso

1.  **Preparar la lista:** Crea un archivo `.txt` (por ejemplo, `url.txt`) y pega las URLs de los archivos que deseas obtener, una por cada línea.
2.  **Ejecutar el script:** Pasa el archivo de texto como argumento al ejecutar el script en la terminal:

```bash
python descargar_media.py url.txt
```

## 🏗️ Flujo de Trabajo (Concepto)

Aunque actualmente el script se encarga de la descarga, la lógica de funcionamiento sigue este esquema:



1.  **Extracción:** Se obtiene la lista de nombres de archivos o rutas desde los servidores `pbs.twimg.com` o `video.twimg.com`.
2.  **Procesamiento:** El script lee el archivo `url.txt`.
3.  **Descarga:** Los archivos se guardan en el directorio local de forma automatizada.

