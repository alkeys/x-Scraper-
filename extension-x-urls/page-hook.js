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

  function agregarUrl(url) {
    if (typeof url !== "string") {
      return;
    }

    if (url.startsWith(PREFIJO_IMAGEN) || url.startsWith(PREFIJO_VIDEO)) {
      publicarUrl(url);
    }
  }

  function explorarJson(valor) {
    if (typeof valor === "string") {
      agregarUrl(valor);
      return;
    }

    if (Array.isArray(valor)) {
      for (const item of valor) {
        explorarJson(item);
      }
      return;
    }

    if (!esObj(valor)) {
      return;
    }

    for (const key of Object.keys(valor)) {
      explorarJson(valor[key]);
    }
  }

  function procesarTextoJson(texto) {
    if (typeof texto !== "string" || texto.length < 2) {
      return;
    }

    try {
      const json = JSON.parse(texto);
      explorarJson(json);
    } catch {
      // Ignorar respuestas no JSON
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
})();
