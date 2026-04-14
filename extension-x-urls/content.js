(() => {
  if (window.__xExtractorIniciado) {
    return;
  }
  window.__xExtractorIniciado = true;

  // Credito: alkeys. Proyecto hobby, uso bajo tu responsabilidad.

  const CLAVES = {
    imagenes: "x_extractor_imagenes",
    videos: "x_extractor_videos",
    activo: "x_extractor_activo"
  };

  const PREFIJO_IMAGEN = "https://pbs.twimg.com/media/";
  const PREFIJO_VIDEO = "https://video.twimg.com/";

  const imagenes = new Set();
  const videos = new Set();
  let activo = false;

  function normalizarUrl(url) {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return url;
    }
  }

  function guardarEstado() {
    chrome.storage.local.set({
      [CLAVES.imagenes]: Array.from(imagenes),
      [CLAVES.videos]: Array.from(videos),
      [CLAVES.activo]: activo
    });
  }

  function enviarControlPagina() {
    window.postMessage(
      {
        fuente: "x-extractor-control",
        tipo: "estado",
        activo
      },
      "*"
    );
  }

  function agregarUrl(url) {
    if (typeof url !== "string") {
      return;
    }

    if (url.startsWith(PREFIJO_IMAGEN)) {
      imagenes.add(normalizarUrl(url));
      return;
    }

    if (url.startsWith(PREFIJO_VIDEO)) {
      videos.add(normalizarUrl(url));
    }
  }

  function inyectarHookPagina() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-hook.js");
    script.type = "text/javascript";
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  function escucharPuentePagina() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.fuente !== "x-extractor") {
        return;
      }

      if (data.tipo === "ready") {
        enviarControlPagina();
        return;
      }

      if (data.tipo !== "url") {
        return;
      }

      if (!activo) {
        return;
      }

      const antesI = imagenes.size;
      const antesV = videos.size;
      agregarUrl(data.url);
      if (imagenes.size !== antesI || videos.size !== antesV) {
        guardarEstado();
      }
    });
  }

  function escucharMensajes() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg !== "object") {
        return;
      }

      if (msg.tipo === "obtener") {
        sendResponse({
          imagenes: Array.from(imagenes),
          videos: Array.from(videos),
          activo
        });
      }

      if (msg.tipo === "limpiar") {
        imagenes.clear();
        videos.clear();
        guardarEstado();
        sendResponse({ ok: true });
      }

      if (msg.tipo === "empezar") {
        activo = true;
        guardarEstado();
        enviarControlPagina();
        sendResponse({ ok: true, activo });
      }

      if (msg.tipo === "detener") {
        activo = false;
        guardarEstado();
        enviarControlPagina();
        sendResponse({ ok: true, activo });
      }
    });
  }

  function cargarEstado() {
    chrome.storage.local.get([CLAVES.imagenes, CLAVES.videos, CLAVES.activo], (data) => {
      for (const url of data[CLAVES.imagenes] || []) {
        imagenes.add(url);
      }
      for (const url of data[CLAVES.videos] || []) {
        videos.add(url);
      }
      activo = !!data[CLAVES.activo];
      enviarControlPagina();
    });
  }

  cargarEstado();
  inyectarHookPagina();
  escucharPuentePagina();
  escucharMensajes();
})();
