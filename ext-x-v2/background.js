function extDesdeUrl(url) {
  try {
    const u = new URL(url);
    const formato = u.searchParams.get("format");
    if (formato) {
      return formato.toLowerCase();
    }
    const nombre = u.pathname.split("/").pop() || "archivo";
    const trozos = nombre.split(".");
    if (trozos.length > 1) {
      return trozos.pop().toLowerCase();
    }
  } catch {
    // Sin extension detectada
  }
  return "bin";
}

const MIN_VIDEO_BYTES_DEFAULT = 300 * 1024;

function esVideoUrl(url) {
  return typeof url === "string" && url.startsWith("https://video.twimg.com/");
}

function parseEnteroSeguro(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function obtenerTamanoRemoto(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      const cl = parseEnteroSeguro(head.headers.get("content-length"));
      if (cl !== null) {
        return cl;
      }
    }
  } catch {
    // Fallback abajo
  }

  try {
    const rango = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    if (rango.ok || rango.status === 206) {
      const contentRange = rango.headers.get("content-range") || "";
      const m = contentRange.match(/\/(\d+)$/);
      if (m) {
        return parseEnteroSeguro(m[1]);
      }

      const cl = parseEnteroSeguro(rango.headers.get("content-length"));
      if (cl !== null) {
        return cl;
      }
    }
  } catch {
    // Sin tamaño remoto
  }

  return null;
}

function baseDesdeUrl(url) {
  try {
    const u = new URL(url);
    const nombre = u.pathname.split("/").pop() || "media";
    const sinExt = nombre.includes(".") ? nombre.slice(0, nombre.lastIndexOf(".")) : nombre;
    return sinExt.replace(/[^a-zA-Z0-9._-]/g, "_") || "media";
  } catch {
    return "media";
  }
}

function espera(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function descargarLote(urls, minVideoBytes = MIN_VIDEO_BYTES_DEFAULT) {
  let ok = 0;
  let fail = 0;
  let skipPequeno = 0;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const ext = extDesdeUrl(url);
    const base = baseDesdeUrl(url);
    const prefijo = String(i + 1).padStart(4, "0");
    const filename = `ext-x-v2/${prefijo}_${base}.${ext}`;

    try {
      if (esVideoUrl(url)) {
        const bytes = await obtenerTamanoRemoto(url);
        if (bytes !== null && bytes < minVideoBytes) {
          skipPequeno += 1;
          await espera(120);
          continue;
        }
      }

      await chrome.downloads.download({
        url,
        filename,
        saveAs: false,
        conflictAction: "uniquify"
      });
      ok += 1;
    } catch {
      fail += 1;
    }

    await espera(350);
  }

  return { ok, fail, skipPequeno, total: urls.length };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") {
    return;
  }

  if (msg.tipo === "descargar_lote") {
    const urls = Array.isArray(msg.urls) ? msg.urls : [];
    const minVideoBytes = Number.isFinite(Number(msg.minVideoBytes))
      ? Math.max(0, Number(msg.minVideoBytes))
      : MIN_VIDEO_BYTES_DEFAULT;
    descargarLote(urls, minVideoBytes)
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
