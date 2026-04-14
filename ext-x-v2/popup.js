function q(id) {
  return document.getElementById(id);
}

let capturaActiva = false;
let refresco = null;
let minVideoKB = 300;

function setEstado(msg) {
  q("estado").textContent = msg;
}

function cargarConfig() {
  chrome.storage.local.get(["ext_x_v2_min_video_kb"], (data) => {
    const valor = Number(data.ext_x_v2_min_video_kb);
    minVideoKB = Number.isFinite(valor) && valor >= 0 ? valor : 300;
    q("sel-min-video-kb").value = String(minVideoKB);
  });
}

function guardarConfigDesdeUI() {
  const valor = Number(q("sel-min-video-kb").value);
  minVideoKB = Number.isFinite(valor) && valor >= 0 ? valor : 300;
  chrome.storage.local.set({ ext_x_v2_min_video_kb: minVideoKB });
}

function actualizarBotones() {
  q("btn-empezar").disabled = capturaActiva;
  q("btn-detener").disabled = !capturaActiva;
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

function obtenerData(cb) {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "obtener" }, (res) => {
      const err = chrome.runtime.lastError;
      if (err) {
        cb(null, err);
        return;
      }
      cb(res, null);
    });
  });
}

function actualizarVista() {
  obtenerData((res, err) => {
    if (err || !res) {
      q("total-imagenes").textContent = "0";
      q("total-videos").textContent = "0";
      setEstado("Abre x.com y recarga pagina.");
      return;
    }

    const imagenes = res.imagenes || [];
    const videos = res.videos || [];
    capturaActiva = !!res.activo;

    q("total-imagenes").textContent = String(imagenes.length);
    q("total-videos").textContent = String(videos.length);
    actualizarBotones();
    setEstado(capturaActiva ? "Captura activa." : "Captura detenida.");
  });
}

function empezar() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "empezar" }, () => {
      if (chrome.runtime.lastError) {
        setEstado("No se pudo iniciar captura.");
        return;
      }
      capturaActiva = true;
      actualizarBotones();
      setEstado("Captura iniciada. Haz scroll.");
    });
  });
}

function detener() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "detener" }, () => {
      if (chrome.runtime.lastError) {
        setEstado("No se pudo detener captura.");
        return;
      }
      capturaActiva = false;
      actualizarBotones();
      setEstado("Captura detenida.");
    });
  });
}

function txtDesdeListas(imagenes, videos) {
  return [
    "# URLs de imagenes (pbs.twimg.com/media)",
    ...imagenes,
    "",
    "# URLs de videos (video.twimg.com)",
    ...videos
  ].join("\n");
}

function exportarTxt() {
  obtenerData((res, err) => {
    if (err || !res) {
      setEstado("No hay datos para exportar.");
      return;
    }

    const imagenes = res.imagenes || [];
    const videos = res.videos || [];
    if (!imagenes.length && !videos.length) {
      setEstado("Sin URLs para exportar.");
      return;
    }

    const txt = txtDesdeListas(imagenes, videos);
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    chrome.downloads.download({
      url,
      filename: `ext-x-v2_urls_${fecha}.txt`,
      saveAs: true
    }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setEstado("TXT exportado.");
    });
  });
}

function descargarSegunFiltro(filtro) {
  obtenerData((res, err) => {
    if (err || !res) {
      setEstado("No hay datos para descargar.");
      return;
    }

    let urls = [];
    if (filtro === "imagenes") {
      urls = [...(res.imagenes || [])];
    } else if (filtro === "videos") {
      urls = [...(res.videos || [])];
    } else {
      urls = [...(res.imagenes || []), ...(res.videos || [])];
    }

    if (!urls.length) {
      setEstado("Sin media capturada.");
      return;
    }

    setEstado(`Iniciando ${urls.length} descargas...`);
    chrome.runtime.sendMessage({ tipo: "descargar_lote", urls, minVideoBytes: minVideoKB * 1024 }, (respuesta) => {
      if (chrome.runtime.lastError || !respuesta) {
        setEstado("Error al lanzar descargas.");
        return;
      }

      if (!respuesta.ok) {
        setEstado("Fallo en descarga por lote.");
        return;
      }

      const omitidos = typeof respuesta.skipPequeno === "number" ? respuesta.skipPequeno : 0;
      setEstado(
        `Descargado: ${respuesta.ok}/${respuesta.total} | Omitidos<${minVideoKB}KB: ${omitidos} | Fallos: ${respuesta.fail}`
      );
    });
  });
}

function descargarTodo() {
  descargarSegunFiltro("todo");
}

function descargarSoloImagenes() {
  descargarSegunFiltro("imagenes");
}

function descargarSoloVideos() {
  descargarSegunFiltro("videos");
}

function limpiar() {
  conPestanaActiva((tabId) => {
    chrome.tabs.sendMessage(tabId, { tipo: "limpiar" }, () => {
      if (chrome.runtime.lastError) {
        setEstado("No se pudo limpiar.");
        return;
      }
      q("total-imagenes").textContent = "0";
      q("total-videos").textContent = "0";
      setEstado("Datos limpiados.");
    });
  });
}

function iniciarRefresco() {
  if (refresco) {
    return;
  }
  refresco = setInterval(actualizarVista, 1200);
}

function detenerRefresco() {
  if (!refresco) {
    return;
  }
  clearInterval(refresco);
  refresco = null;
}

q("btn-empezar").addEventListener("click", empezar);
q("btn-detener").addEventListener("click", detener);
q("btn-descargar").addEventListener("click", descargarTodo);
q("btn-descargar-img").addEventListener("click", descargarSoloImagenes);
q("btn-descargar-vid").addEventListener("click", descargarSoloVideos);
q("btn-exportar").addEventListener("click", exportarTxt);
q("btn-limpiar").addEventListener("click", limpiar);
q("sel-min-video-kb").addEventListener("change", guardarConfigDesdeUI);

cargarConfig();
actualizarBotones();
actualizarVista();
iniciarRefresco();
window.addEventListener("unload", detenerRefresco);
