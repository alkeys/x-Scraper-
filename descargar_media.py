#!/usr/bin/env python3
"""
Media Downloader - Descarga imágenes y videos desde un archivo .txt de URLs
Uso: python descargar_media.py urls.txt
     python descargar_media.py urls.txt --carpeta mis_fotos --hilos 10
"""

import os
import sys
import time
import argparse
import mimetypes
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("❌ Falta el módulo 'requests'. Instálalo con:")
    print("   pip install requests")
    sys.exit(1)

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://twitter.com/",
}

TIMEOUT = 30          # segundos por descarga
REINTENTOS = 3        # reintentos automáticos
PAUSA_ERROR = 2       # segundos de espera tras error

# ─── FUNCIONES ────────────────────────────────────────────────────────────────

def crear_sesion():
    """Crea una sesión HTTP con reintentos automáticos."""
    sesion = requests.Session()
    reintentos = Retry(
        total=REINTENTOS,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adaptador = HTTPAdapter(max_retries=reintentos)
    sesion.mount("https://", adaptador)
    sesion.mount("http://", adaptador)
    sesion.headers.update(HEADERS)
    return sesion


def detectar_tipo(url: str) -> str:
    """Detecta si la URL es imagen o video."""
    url_lower = url.lower()
    if ".mp4" in url_lower or "video" in url_lower:
        return "video"
    return "imagen"


def generar_nombre(url: str, indice: int) -> str:
    """Genera un nombre de archivo limpio desde la URL."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)

    # Nombre base desde la ruta
    nombre_base = Path(parsed.path).name or f"media_{indice:04d}"

    # Extensión desde parámetro 'format' (Twitter usa ?format=jpg)
    ext = ""
    if "format" in params:
        ext = "." + params["format"][0]
    elif "." in nombre_base:
        ext = ""  # ya tiene extensión
    else:
        # Intentar por tipo de URL
        if detectar_tipo(url) == "video":
            ext = ".mp4"
        else:
            ext = ".jpg"

    nombre = nombre_base + ext

    # Limpiar caracteres inválidos
    nombre = "".join(c for c in nombre if c.isalnum() or c in "._-")
    if not nombre or nombre == ext:
        nombre = f"media_{indice:04d}{ext}"

    return nombre


def descargar_uno(args):
    """Descarga una sola URL. Retorna (éxito, url, mensaje)."""
    url, indice, carpeta, sesion = args

    nombre = generar_nombre(url, indice)
    destino = carpeta / nombre

    # Evitar re-descargar si ya existe
    if destino.exists() and destino.stat().st_size > 0:
        return (True, url, f"⏭  Ya existe: {nombre}")

    try:
        resp = sesion.get(url, timeout=TIMEOUT, stream=True)
        resp.raise_for_status()

        # Escribir en disco
        with open(destino, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        tamaño = destino.stat().st_size
        tamaño_str = f"{tamaño / 1024:.1f} KB" if tamaño < 1_048_576 else f"{tamaño / 1_048_576:.1f} MB"
        return (True, url, f"✓  {nombre} ({tamaño_str})")

    except requests.exceptions.HTTPError as e:
        time.sleep(PAUSA_ERROR)
        return (False, url, f"✗  HTTP {e.response.status_code}: {nombre}")
    except requests.exceptions.Timeout:
        return (False, url, f"✗  Timeout: {url[:60]}...")
    except Exception as e:
        return (False, url, f"✗  Error: {str(e)[:60]}")


def leer_urls(ruta_txt: str) -> list:
    """Lee y filtra URLs válidas del archivo .txt."""
    with open(ruta_txt, "r", encoding="utf-8") as f:
        lineas = f.readlines()

    urls = []
    for linea in lineas:
        url = linea.strip()
        if url.startswith("http://") or url.startswith("https://"):
            urls.append(url)

    return urls


def barra_progreso(actual, total, ancho=40):
    """Imprime una barra de progreso en la terminal."""
    pct = actual / total if total > 0 else 0
    llenas = int(ancho * pct)
    barra = "█" * llenas + "░" * (ancho - llenas)
    print(f"\r  [{barra}] {actual}/{total} ({pct*100:.0f}%)", end="", flush=True)


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Descarga imágenes y videos desde un archivo .txt de URLs"
    )
    parser.add_argument("archivo", help="Archivo .txt con las URLs")
    parser.add_argument(
        "--carpeta", "-c",
        default="media_descargado",
        help="Carpeta de destino (default: media_descargado)"
    )
    parser.add_argument(
        "--hilos", "-t",
        type=int,
        default=5,
        help="Descargas simultáneas (default: 5, max recomendado: 10)"
    )
    parser.add_argument(
        "--solo-imagenes", action="store_true",
        help="Descargar solo imágenes"
    )
    parser.add_argument(
        "--solo-videos", action="store_true",
        help="Descargar solo videos"
    )

    args = parser.parse_args()

    # Validar archivo
    if not os.path.exists(args.archivo):
        print(f"❌ No se encontró el archivo: {args.archivo}")
        sys.exit(1)

    # Leer URLs
    print(f"\n📂 Leyendo: {args.archivo}")
    todas_urls = leer_urls(args.archivo)

    if not todas_urls:
        print("❌ No se encontraron URLs válidas en el archivo.")
        sys.exit(1)

    # Filtrar por tipo si se pidió
    if args.solo_imagenes:
        urls = [u for u in todas_urls if detectar_tipo(u) == "imagen"]
        print(f"   Filtrando solo imágenes...")
    elif args.solo_videos:
        urls = [u for u in todas_urls if detectar_tipo(u) == "video"]
        print(f"   Filtrando solo videos...")
    else:
        urls = todas_urls

    imagenes = sum(1 for u in urls if detectar_tipo(u) == "imagen")
    videos   = sum(1 for u in urls if detectar_tipo(u) == "video")

    print(f"   Total: {len(urls)} URLs  |  🖼  {imagenes} imágenes  |  🎬 {videos} videos")

    # Crear carpeta destino
    carpeta = Path(args.carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    print(f"📁 Carpeta destino: {carpeta.resolve()}")
    print(f"⚡ Hilos simultáneos: {args.hilos}")
    print(f"\n{'─'*55}")

    # Crear sesión compartida
    sesion = crear_sesion()

    # Preparar argumentos para cada descarga
    tareas = [(url, i + 1, carpeta, sesion) for i, url in enumerate(urls)]

    ok = 0
    errores = 0
    errores_lista = []
    completados = 0

    inicio = time.time()

    with ThreadPoolExecutor(max_workers=args.hilos) as executor:
        futuros = {executor.submit(descargar_uno, t): t for t in tareas}

        for futuro in as_completed(futuros):
            exito, url, mensaje = futuro.result()
            completados += 1

            if exito:
                ok += 1
            else:
                errores += 1
                errores_lista.append(url)

            barra_progreso(completados, len(urls))
            print(f"  {mensaje}")

    # ─── RESUMEN ───
    elapsed = time.time() - inicio
    print(f"\n{'─'*55}")
    print(f"✅ Completado en {elapsed:.1f}s")
    print(f"   ✓ Exitosos : {ok}")
    print(f"   ✗ Errores  : {errores}")
    print(f"   📁 Guardado en: {carpeta.resolve()}")

    # Guardar lista de errores si los hubo
    if errores_lista:
        ruta_err = carpeta / "errores.txt"
        with open(ruta_err, "w") as f:
            f.write("\n".join(errores_lista))
        print(f"\n⚠  URLs con error guardadas en: {ruta_err}")
        print(f"   Puedes volver a correr el script con ese archivo para reintentar.")

    print()


if __name__ == "__main__":
    main()
