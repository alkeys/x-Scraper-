function q(id) {
  return document.getElementById(id);
}

// Credito: alkeys. Ext extension mantenida para uso no comercial y modificable.

let capturaActiva = false;
let intervaloRefresco = null;
let minVideoKB = 300;

function setEstado(msg) {
  q("estado").textContent = msg;
}

function cargarConfig() {
  chrome.storage.local.get(["x_extractor_min_video_kb"], (data) => {
    const valor = Number(data.x_extractor_min_video_kb);
    minVideoKB = Number.isFinite(valor) && valor >= 0 ? valor : 300;
    q("sel-min-video-kb").value = String(minVideoKB);
  });
}

function guardarConfigDesdeUI() {
  const valor = Number(q("sel-min-video-kb").value);
  minVideoKB = Number.isFinite(valor) && valor >= 0 ? valor : 300;
  chrome.storage.local.set({ x_extractor_min_video_kb: minVideoKB });
}

function parseEnteroSeguro(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function obtenerTamanoVideo(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) {
      const cl = parseEnteroSeguro(head.headers.get("content-length"));
      if (cl !== null) {
        return cl;
      }
    }
  } catch {
    // fallback
  }

  try {
    const r = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    if (r.ok || r.status === 206) {
      const cr = r.headers.get("content-range") || "";
      const m = cr.match(/\/(\d+)$/);
      if (m) {
        return parseEnteroSeguro(m[1]);
      }
      const cl = parseEnteroSeguro(r.headers.get("content-length"));
      if (cl !== null) {
        return cl;
      }
    }
  } catch {
    // sin tamaño
  }

  return null;
}

async function filtrarVideosPorTamano(videos) {
  if (!minVideoKB || minVideoKB <= 0) {
    return { videosFiltrados: videos, omitidos: 0 };
  }

  const minBytes = minVideoKB * 1024;
  const salida = [];
  let omitidos = 0;

  for (const v of videos) {
    const bytes = await obtenerTamanoVideo(v);
    if (bytes !== null && bytes < minBytes) {
      omitidos += 1;
      continue;
    }
    salida.push(v);
  }

  return { videosFiltrados: salida, omitidos };
}

function actualizarBotones() {
  q("btn-empezar").disabled = capturaActiva;
  q("btn-detener").disabled = !capturaActiva;
}

function aTxt(imagenes, videos) {
  const lineas = [];
  lineas.push("# URLs de imagenes (pbs.twimg.com/media)");
  for (const url of imagenes) {
    lineas.push(url);
  }
  lineas.push("");
  lineas.push("# URLs de videos (video.twimg.com)");
  for (const url of videos) {
    lineas.push(url);
  }
  return lineas.join("\n");
}

function descargarTxt(nombre, contenido) {
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: nombre,
    saveAs: true
  }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function conPestanaActiva(fn) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      setEstado("Sin pestana activa.");
      return;
    }
    fn(tab.id);
  });
}

function actualizarVista() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "obtener" }, (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        q("total-imagenes").textContent = "0";
        q("total-videos").textContent = "0";
        setEstado("Abre x.com o twitter.com para capturar.");
        return;
      }

      const imagenes = (res && res.imagenes) || [];
      const videos = (res && res.videos) || [];
      capturaActiva = !!(res && res.activo);

      q("total-imagenes").textContent = String(imagenes.length);
      q("total-videos").textContent = String(videos.length);
      actualizarBotones();
      setEstado(capturaActiva ? "Captura activa." : "Captura detenida.");
    });
  });
}

function iniciarAutoRefresco() {
  if (intervaloRefresco) {
    return;
  }

  intervaloRefresco = setInterval(() => {
    actualizarVista();
  }, 1200);
}

function detenerAutoRefresco() {
  if (!intervaloRefresco) {
    return;
  }

  clearInterval(intervaloRefresco);
  intervaloRefresco = null;
}

function empezarCaptura() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "empezar" }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        setEstado("No se pudo iniciar captura en esta pestana.");
        return;
      }
      capturaActiva = true;
      actualizarBotones();
      setEstado("Captura iniciada. Haz scroll para cargar mas posts.");
    });
  });
}

function detenerCaptura() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "detener" }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        setEstado("No se pudo detener captura en esta pestana.");
        return;
      }
      capturaActiva = false;
      actualizarBotones();
      setEstado("Captura detenida.");
    });
  });
}

async function exportar() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "obtener" }, async (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        setEstado("No hay datos. Abre x.com y recarga.");
        return;
      }

      const imagenes = (res && res.imagenes) || [];
      const videos = (res && res.videos) || [];
      const { videosFiltrados, omitidos } = await filtrarVideosPorTamano(videos);

      if (!imagenes.length && !videosFiltrados.length) {
        setEstado("Sin URLs para exportar.");
        return;
      }

      const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const nombre = `x_media_urls_${fecha}.txt`;
      const txt = aTxt(imagenes, videosFiltrados);
      descargarTxt(nombre, txt);
      setEstado(`Exportado: ${nombre} | Omitidos<${minVideoKB}KB: ${omitidos}`);
    });
  });
}

function limpiar() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "limpiar" }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        setEstado("No se pudo limpiar en esta pestana.");
        return;
      }
      q("total-imagenes").textContent = "0";
      q("total-videos").textContent = "0";
      setEstado("Datos limpiados.");
    });
  });
}

q("btn-actualizar").addEventListener("click", actualizarVista);
q("btn-exportar").addEventListener("click", exportar);
q("btn-limpiar").addEventListener("click", limpiar);
q("btn-empezar").addEventListener("click", empezarCaptura);
q("btn-detener").addEventListener("click", detenerCaptura);
q("sel-min-video-kb").addEventListener("change", guardarConfigDesdeUI);

cargarConfig();
actualizarBotones();
actualizarVista();
iniciarAutoRefresco();

window.addEventListener("unload", detenerAutoRefresco);
