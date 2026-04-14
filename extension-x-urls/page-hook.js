(() => {
  if (window.__xExtractorPageHook) {
    return;
  }
  window.__xExtractorPageHook = true;

  const PREFIJO_IMAGEN = "https://pbs.twimg.com/media/";
  const PREFIJO_VIDEO = "https://video.twimg.com/";
  let activo = false;

  function esObj(valor) {
    return valor !== null && typeof valor === "object";
  }

  function publicarUrl(url) {
    window.postMessage(
      {
        fuente: "x-extractor",
        tipo: "url",
        url
      },
      "*"
    );
  }

  function publicarReady() {
    window.postMessage(
      {
        fuente: "x-extractor",
        tipo: "ready"
      },
      "*"
    );
  }

  function normalizarImagen(url) {
    if (typeof url !== "string" || !url.startsWith(PREFIJO_IMAGEN)) {
      return null;
    }

    const sinQuery = url.split("?")[0];
    const match = sinQuery.match(/^(https:\/\/pbs\.twimg\.com\/media\/[^.]+)\.(\w+)$/);
    if (!match) {
      return `${sinQuery}?format=jpg&name=orig`;
    }

    return `${match[1]}?format=${match[2]}&name=orig`;
  }

  function obtenerMejorVarianteVideo(media) {
    const variantes = (media && media.video_info && media.video_info.variants) || [];
    let mejor = null;

    for (const variante of variantes) {
      if (!variante || typeof variante.url !== "string") {
        continue;
      }

      const url = variante.url;
      if (!url.startsWith(PREFIJO_VIDEO)) {
        continue;
      }

      const contentType = (variante.content_type || variante.contentType || "").toLowerCase();
      if (!contentType.includes("mp4") && !url.toLowerCase().endsWith(".mp4")) {
        continue;
      }

      const bitrate = typeof variante.bitrate === "number" ? variante.bitrate : 0;
      if (!mejor || bitrate > mejor.bitrate) {
        mejor = { url, bitrate };
      }
    }

    return mejor ? mejor.url : null;
  }

  function procesarMedia(media) {
    if (!esObj(media) || typeof media.type !== "string") {
      return;
    }

    if (media.type === "photo") {
      const url = normalizarImagen(media.media_url_https || media.url || "");
      if (url) {
        publicarUrl(url);
      }
      return;
    }

    if (media.type === "video" || media.type === "animated_gif") {
      const url = obtenerMejorVarianteVideo(media);
      if (url) {
        publicarUrl(url);
      }
    }
  }

  function explorarJson(valor) {
    if (Array.isArray(valor)) {
      for (const item of valor) {
        explorarJson(item);
      }
      return;
    }

    if (!esObj(valor)) {
      return;
    }

    if (typeof valor.media_url_https === "string" && typeof valor.type === "string") {
      procesarMedia(valor);
    }

    if (Array.isArray(valor.media)) {
      for (const media of valor.media) {
        procesarMedia(media);
      }
    }

    for (const key of Object.keys(valor)) {
      explorarJson(valor[key]);
    }
  }

  function extraerUrlsDesdeTexto(texto) {
    const regexImg = /https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?(?:\?[^"'\s\\]+)?/g;
    const regexVid = /https:\/\/video\.twimg\.com\/[A-Za-z0-9_\-\/.]+\.mp4(?:\?[^"'\s\\]+)?/g;

    for (const url of texto.match(regexImg) || []) {
      const normalizada = normalizarImagen(url);
      if (normalizada) {
        publicarUrl(normalizada);
      }
    }

    for (const url of texto.match(regexVid) || []) {
      publicarUrl(url);
    }
  }

  function procesarTextoJson(texto) {
    if (typeof texto !== "string" || texto.length < 2) {
      return;
    }

    try {
      const json = JSON.parse(texto);
      explorarJson(json);
      extraerUrlsDesdeTexto(texto);
    } catch {
      extraerUrlsDesdeTexto(texto);
    }
  }

  async function procesarRespuesta(respuesta) {
    if (!activo) {
      return;
    }

    try {
      const url = respuesta.url || "";
      const tipo = (respuesta.headers && respuesta.headers.get("content-type")) || "";
      if (!url.includes("/graphql/") && !url.includes("/i/api/")) {
        return;
      }
      if (!tipo.includes("application/json")) {
        return;
      }

      const copia = respuesta.clone();
      const texto = await copia.text();
      procesarTextoJson(texto);
    } catch {
      // Ignorar errores
    }
  }

  function parchearFetch() {
    const fetchOriginal = window.fetch;
    window.fetch = async (...args) => {
      const res = await fetchOriginal(...args);
      procesarRespuesta(res);
      return res;
    };
  }

  function parchearXHR() {
    const openOriginal = XMLHttpRequest.prototype.open;
    const sendOriginal = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...resto) {
      this.__xExtractorUrl = typeof url === "string" ? url : "";
      return openOriginal.call(this, method, url, ...resto);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener("load", function() {
        if (!activo) {
          return;
        }

        try {
          const tipo = this.getResponseHeader("content-type") || "";
          const url = this.__xExtractorUrl || this.responseURL || "";
          if (!url.includes("/graphql/") && !url.includes("/i/api/")) {
            return;
          }
          if (!tipo.includes("application/json")) {
            return;
          }
          procesarTextoJson(this.responseText || "");
        } catch {
          // Ignorar errores
        }
      });

      return sendOriginal.call(this, ...args);
    };
  }

  function escucharControl() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.fuente !== "x-extractor-control" || data.tipo !== "estado") {
        return;
      }

      activo = !!data.activo;
    });
  }

  escucharControl();
  parchearFetch();
  parchearXHR();
  publicarReady();
})();
