(() => {
  if (window.__extXV2Iniciado) {
    return;
  }
  window.__extXV2Iniciado = true;

  const CLAVES = {
    imagenes: "ext_x_v2_imagenes",
    videos: "ext_x_v2_videos",
    activo: "ext_x_v2_activo"
  };

  const PREFIJO_IMAGEN = "https://pbs.twimg.com/media/";
  const PREFIJO_VIDEO = "https://video.twimg.com/";

  const imagenes = new Set();
  const videos = new Set();
  const videoPorClave = new Map();
  let activo = false;

  function normalizar(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "video.twimg.com") {
        return `${u.origin}${u.pathname}`;
      }

      if (u.hostname === "pbs.twimg.com" && u.pathname.startsWith("/media/")) {
        const formato = u.searchParams.get("format");
        const name = u.searchParams.get("name") || "orig";
        if (formato) {
          return `${u.origin}${u.pathname}?format=${formato}&name=${name}`;
        }
      }

      return `${u.origin}${u.pathname}`;
    } catch {
      return url;
    }
  }

  function claveVideo(url) {
    try {
      const u = new URL(url);
      const matchId = u.pathname.match(/\/ext_tw_video\/(\d+)\//);
      if (matchId) {
        return `id_${matchId[1]}`;
      }
      const nombre = (u.pathname.split("/").pop() || "video").replace(/\.mp4$/i, "");
      return `file_${nombre}`;
    } catch {
      return `raw_${url}`;
    }
  }

  function puntajeVideo(url) {
    try {
      const u = new URL(url);
      const matchRes = u.pathname.match(/\/vid\/([0-9]+)x([0-9]+)\//);
      if (!matchRes) {
        return 0;
      }
      const w = Number(matchRes[1]);
      const h = Number(matchRes[2]);
      return w * h;
    } catch {
      return 0;
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
        fuente: "ext-x-v2-control",
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
      imagenes.add(normalizar(url));
      return;
    }

    if (url.startsWith(PREFIJO_VIDEO)) {
      const normalizada = normalizar(url);
      const clave = claveVideo(normalizada);
      const anterior = videoPorClave.get(clave);
      if (!anterior || puntajeVideo(normalizada) >= puntajeVideo(anterior)) {
        videoPorClave.set(clave, normalizada);
        videos.clear();
        for (const valor of videoPorClave.values()) {
          videos.add(valor);
        }
      }
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
      if (!data || data.fuente !== "ext-x-v2") {
        return;
      }

      if (data.tipo === "ready") {
        enviarControlPagina();
        return;
      }

      if (data.tipo !== "url" || !activo) {
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
        videoPorClave.clear();
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
        videoPorClave.set(claveVideo(url), url);
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
