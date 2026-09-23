/** Pestaña Textos: PDF, Excel e imagen → .md en `.afn/extract/` sin el chat. */

export function extractNavButton() {
  return `      <button type="button" data-go="extract">Textos</button>`;
}

export function extractSection() {
  return `
    <section data-view="extract" hidden>
      <h2>PDF, Excel e imágenes a Markdown</h2>
      <p class="lead">Se leen en esta PC. El resultado siempre es un <code>.md</code> en <code>.afn/extract/</code>. Ese archivo lo abrís, lo corregís si hace falta, y se lo pasás al chat. El modelo no ve el PDF ni la imagen.</p>
      <p id="ex-api-warn" class="muted" hidden style="color:#fbbf24">Para convertir hace falta el dashboard en 127.0.0.1. En Kiro: «abre los textos».</p>
      <div class="article" id="ex-drop" style="max-width:760px;border-style:dashed;text-align:center;padding:1.4rem">
        <strong>Soltá el archivo acá</strong>
        <p class="muted">PDF, Excel (.xlsx, .xls, .csv) o imagen (PNG, JPG). Máximo 15 MB. Sale un .md.</p>
        <input id="ex-file" type="file" accept=".pdf,.xlsx,.xlsm,.xls,.csv,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tif,.tiff" hidden/>
        <button type="button" class="btn" id="ex-pick">Elegir archivo</button>
      </div>
      <p id="ex-msg" class="muted" role="status"></p>
      <div id="ex-result" class="article" hidden style="max-width:980px;margin-top:.6rem">
        <p class="muted" style="margin-top:0">Guardado en <code id="ex-rel"></code></p>
        <div class="toolbar">
          <button type="button" class="btn" id="ex-copy">Copiar ruta</button>
          <button type="button" class="btn" id="ex-copy-md">Copiar Markdown</button>
        </div>
        <article id="ex-preview" class="article" style="margin-top:.6rem"></article>
      </div>
      <h3 style="margin-top:1.2rem">Ya convertidos</h3>
      <div class="grid" id="ex-list"></div>
    </section>`;
}

export function extractCss() {
  return `
  #ex-drop.over { border-color: var(--acc); }
  `;
}

export function extractScript() {
  return `
  const exApi = window.AFN_API;
  const exWarn = document.getElementById("ex-api-warn");
  if (exWarn && !exApi) exWarn.hidden = false;
  const exErr = {
    token: "Token viejo: cerrá la pestaña y pedí otra vez «abre dashboard AFN».",
    unsupported: "Ese archivo no es PDF, Excel ni imagen.",
    empty: "El archivo está vacío.",
    too_large: "Pasa de 15 MB. Partilo o comprimí la imagen.",
    ocr_unavailable: "En esta PC no hay OCR de Windows. El PDF y el Excel sí se convierten.",
    extract_failed: "No pude leer el archivo.",
    not_found: "No encontré ese .md.",
    invalid_path: "Nombre de archivo no válido.",
  };
  let exLast = null;
  function exSet(t, ok) {
    const el = document.getElementById("ex-msg");
    if (!el) return;
    el.textContent = t || "";
    el.style.color = ok === false ? "#fca5a5" : ok === true ? "#34d399" : "";
  }
  function exEsc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  async function exCall(method, path, body) {
    if (!exApi) throw new Error("Abrí el dashboard con «abre dashboard AFN».");
    const r = await fetch(exApi.base + path, {
      method,
      headers: { "Content-Type": "application/json", "x-afn-token": exApi.token },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(exErr[j.error] || j.detail || j.error || r.statusText);
    return j;
  }
  function exPreview(md) {
    const src = String(md || "").replace(/^---[\\s\\S]*?---\\s*/, "");
    return "<pre style=\\"white-space:pre-wrap\\">" + exEsc(src).slice(0, 8000) + "</pre>";
  }
  function exShow(j) {
    exLast = j;
    const box = document.getElementById("ex-result");
    if (box) box.hidden = false;
    const rel = document.getElementById("ex-rel");
    if (rel) rel.textContent = j.rel || "";
    const prev = document.getElementById("ex-preview");
    if (prev) prev.innerHTML = exPreview(j.markdown || j.preview || "");
  }
  async function exList() {
    const host = document.getElementById("ex-list");
    if (!host || !exApi) return;
    try {
      const j = await exCall("GET", "/api/extract");
      const files = j.files || [];
      host.innerHTML = files.length
        ? files.map((f) => '<button type="button" class="tile" data-ex-open="' + exEsc(f.name) + '"><span class="k">' + exEsc(f.kind || "md") + '</span><strong>' + exEsc(f.source || f.name) + '</strong><code>' + exEsc(f.rel) + '</code></button>').join("")
        : '<div class="empty">Todavía no hay .md. Soltá un PDF, un Excel o una imagen.</div>';
    } catch (e) {
      host.innerHTML = '<div class="empty">' + exEsc(e.message || e) + '</div>';
    }
  }
  async function exOpen(name) {
    try {
      const j = await exCall("GET", "/api/extract/file?name=" + encodeURIComponent(name));
      exShow(j);
    } catch (e) {
      exSet(String(e.message || e), false);
    }
  }
  function fileToB64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(new Error("No pude leer el archivo"));
      r.readAsDataURL(file);
    });
  }
  async function exConvert(file) {
    if (!file) return;
    exSet("Convirtiendo a Markdown…");
    try {
      const b64 = await fileToB64(file);
      const j = await exCall("POST", "/api/extract", { filename: file.name, base64: b64 });
      exShow(j);
      exSet("Listo. " + (j.rel || "") + " · " + (j.chars || 0) + " caracteres. Pasale ese .md al chat.", true);
      exList();
    } catch (e) {
      exSet(String(e.message || e), false);
    }
  }
  const drop = document.getElementById("ex-drop");
  const input = document.getElementById("ex-file");
  document.getElementById("ex-pick")?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => { const f = input.files && input.files[0]; if (f) exConvert(f); input.value = ""; });
  if (drop) {
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("over");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) exConvert(f);
    });
  }
  document.getElementById("ex-list")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ex-open]");
    if (b) exOpen(b.getAttribute("data-ex-open"));
  });
  document.getElementById("ex-copy")?.addEventListener("click", async () => {
    const t = exLast?.rel || "";
    if (!t) return;
    try { await navigator.clipboard.writeText(t); exSet("Ruta copiada: " + t, true); } catch { exSet(t, true); }
  });
  document.getElementById("ex-copy-md")?.addEventListener("click", async () => {
    const t = exLast?.markdown || "";
    if (!t) return;
    try { await navigator.clipboard.writeText(t); exSet("Markdown copiado.", true); } catch { exSet("No pude copiar. Abrí el archivo en .afn/extract.", false); }
  });
  window.afnExtractOnShow = function () { exList(); };
  if (document.querySelector('[data-view="extract"]') && !document.querySelector('[data-view="extract"]').hidden) exList();
`;
}
