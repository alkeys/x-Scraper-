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
  const videoPorClave = new Map();
  let activo = false;
  let observadorDom = null;

  function normalizarUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "pbs.twimg.com" && u.pathname.startsWith("/media/")) {
        const format = u.searchParams.get("format");
        const name = u.searchParams.get("name");
        if (format) {
          return `${u.origin}${u.pathname}?format=${format}&name=${name || "orig"}`;
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

  function urlsDesdeTexto(texto) {
    if (typeof texto !== "string" || !texto) {
      return [];
    }
    const resultados = [];
    const regex = /https:\/\/(?:pbs|video)\.twimg\.com\/[^\s"')]+/g;
    for (const match of texto.match(regex) || []) {
      resultados.push(match.trim());
    }
    return resultados;
  }

  function procesarNodoDom(nodo) {
    if (!(nodo instanceof Element)) {
      return;
    }

    const candidatos = [
      nodo.getAttribute("src"),
      nodo.getAttribute("href"),
      nodo.getAttribute("poster"),
      nodo.getAttribute("srcset"),
      nodo.getAttribute("style")
    ];

    if ("currentSrc" in nodo && typeof nodo.currentSrc === "string") {
      candidatos.push(nodo.currentSrc);
    }

    for (const valor of candidatos) {
      if (!valor) {
        continue;
      }
      for (const url of urlsDesdeTexto(valor)) {
        agregarUrl(url);
      }
    }

    for (const sub of nodo.querySelectorAll("img,video,source,a")) {
      const valores = [
        sub.getAttribute("src"),
        sub.getAttribute("href"),
        sub.getAttribute("poster"),
        sub.getAttribute("srcset")
      ];
      if ("currentSrc" in sub && typeof sub.currentSrc === "string") {
        valores.push(sub.currentSrc);
      }
      for (const valor of valores) {
        if (!valor) {
          continue;
        }
        for (const url of urlsDesdeTexto(valor)) {
          agregarUrl(url);
        }
      }
    }
  }

  function escaneoDomCompleto() {
    const antesI = imagenes.size;
    const antesV = videos.size;
    for (const nodo of document.querySelectorAll("img,video,source,a")) {
      procesarNodoDom(nodo);
    }
    if (imagenes.size !== antesI || videos.size !== antesV) {
      guardarEstado();
    }
  }

  function iniciarObservadorDom() {
    if (observadorDom) {
      return;
    }
    observadorDom = new MutationObserver((mutaciones) => {
      const antesI = imagenes.size;
      const antesV = videos.size;
      for (const mut of mutaciones) {
        if (mut.type === "attributes") {
          procesarNodoDom(mut.target);
        }
        for (const nodo of mut.addedNodes) {
          procesarNodoDom(nodo);
        }
      }
      if (imagenes.size !== antesI || videos.size !== antesV) {
        guardarEstado();
      }
    });

    observadorDom.observe(document.documentElement || document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "srcset", "poster", "href", "style"]
    });
  }

  function detenerObservadorDom() {
    if (!observadorDom) {
      return;
    }
    observadorDom.disconnect();
    observadorDom = null;
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
      const normalizada = normalizarUrl(url);
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
        videoPorClave.clear();
        guardarEstado();
        sendResponse({ ok: true });
      }

      if (msg.tipo === "empezar") {
        activo = true;
        escaneoDomCompleto();
        iniciarObservadorDom();
        guardarEstado();
        enviarControlPagina();
        sendResponse({ ok: true, activo });
      }

      if (msg.tipo === "detener") {
        activo = false;
        detenerObservadorDom();
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
      if (activo) {
        escaneoDomCompleto();
        iniciarObservadorDom();
      } else {
        detenerObservadorDom();
      }
      enviarControlPagina();
    });
  }

  cargarEstado();
  inyectarHookPagina();
  escucharPuentePagina();
  escucharMensajes();
})();
