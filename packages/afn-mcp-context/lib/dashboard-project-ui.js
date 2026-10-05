/** Barra del proyecto activo: init a pedido y traer skills/steering sin la memoria. */

export function projectBarHtml() {
  return `
    <div id="afn-project" class="article" style="margin:0 0 .8rem">
      <p class="muted" style="margin:0">Proyecto</p>
      <p id="afn-project-root" style="margin:.2rem 0 .6rem;word-break:break-all"></p>
      <p id="afn-project-msg" class="muted" style="margin:0 0 .5rem"></p>
      <div class="toolbar">
        <button type="button" class="btn" id="afn-init" hidden>Inicializar este proyecto</button>
      </div>
      <p id="afn-port-lead" class="muted" style="margin:.8rem 0 .35rem">Elegí la carpeta y abrila. README, memoria, skills y el resto del menú pasan a ese repo.</p>
      <div id="afn-pick" class="afn-pick">
        <div class="afn-pick-ico" aria-hidden="true">📁</div>
        <div class="afn-pick-copy">
          <strong id="afn-pick-name">Ninguna carpeta elegida</strong>
          <p id="afn-pick-path" class="muted">Elegí la carpeta en el explorador. No hace falta pegar la ruta.</p>
        </div>
        <button type="button" class="btn" id="afn-browse">Elegir carpeta</button>
        <button type="button" class="btn afn-pick-go" id="afn-port" disabled>Abrir espacio</button>
        <button type="button" class="btn" id="afn-port-skills" disabled>Traer skills</button>
      </div>
      <input id="afn-port-from" type="hidden" value=""/>
      <div id="afn-catalog" hidden>
        <h3 style="margin:1rem 0 .4rem">Memoria de todos los proyectos</h3>
        <div id="afn-catalog-list" class="grid"></div>
      </div>
    </div>`;
}

export function projectBarCss() {
  return `
  .afn-pick { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; border:1px dashed #3d5168; border-radius:14px; padding:.85rem 1rem; background:#101820; }
  .afn-pick.on { border-style:solid; border-color:#3b82f6; }
  .afn-pick-ico { width:2.4rem; height:2.4rem; border-radius:10px; display:grid; place-items:center; background:#1a2533; font-size:1.15rem; }
  .afn-pick-copy { flex:1; min-width:12rem; }
  .afn-pick-copy strong { display:block; }
  .afn-pick-copy p { margin:.15rem 0 0; }
  .afn-pick-go { background:#2563eb; border-color:#2563eb; color:#fff; }
  .afn-pick-go:disabled { opacity:.45; cursor:not-allowed; background:#1a2533; border-color:var(--line); color:var(--muted); }
  `;
}

export function mapPickerHtml() {
  return `
    <div id="afn-map-pick" class="article" style="margin:0 0 1rem">
      <h3 style="margin:0 0 .35rem">Carpetas del mapa</h3>
      <p class="muted" style="margin:0 0 .6rem">Se reconocen JavaScript, TypeScript, Python, Go, .NET y Gradle. Marcá las que entran. Al guardar, el resto queda fuera.</p>
      <div id="afn-map-list"></div>
      <p class="muted" style="margin:0 0 .6rem">Descubrir no corre al abrir. Si lo pedís, deja en ARQUITECTURA.md lo que el modelo lee de punta a punta: contexto, contenedores, quién llama a quién, flujo, rutas, datos y cómo se prueba. También escribe los skills de proceso de esas carpetas. Sin modelo y sin inventar flechas.</p>
      <p id="afn-map-msg" class="muted" style="margin:.5rem 0"></p>
      <div class="toolbar">
        <button type="button" class="btn" id="afn-map-save">Guardar mapa</button>
        <button type="button" class="btn" id="afn-discover">Descubrir</button>
      </div>
    </div>`;
}

export function mapPickerScript() {
  return `
  (function () {
    const list = document.getElementById("afn-map-list");
    const msg = document.getElementById("afn-map-msg");
    const save = document.getElementById("afn-map-save");
    const discover = document.getElementById("afn-discover");
    if (!list || !save) return;
    const api = window.AFN_API;
    function say(t, ok) {
      if (!msg) return;
      msg.textContent = t || "";
      msg.style.color = ok === false ? "#fca5a5" : ok === true ? "#34d399" : "";
    }
    function esc(s) {
      return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    async function call(method, path, body) {
      if (!api) throw new Error("Abrí el dashboard en 127.0.0.1, no el HTML suelto.");
      const r = await fetch(api.base + path, {
        method,
        headers: { "Content-Type": "application/json", "x-afn-token": api.token },
        body: body == null ? undefined : JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      return j;
    }
    function row(f) {
      const stack = [f.framework, f.type].filter(Boolean).join(" · ");
      return '<label style="display:flex;gap:.6rem;align-items:flex-start;margin:.35rem 0">'
        + '<input type="checkbox" data-map-path="' + esc(f.path) + '"' + (f.selected ? ' checked' : '') + '/>'
        + '<span><strong>' + esc(f.name) + '</strong> <code>' + esc(f.path) + '</code>'
        + (stack ? '<br><span class="muted">' + esc(stack) + '</span>' : '')
        + '</span></label>';
    }
    async function paint() {
      try {
        const j = await call("GET", "/api/map-folders");
        const folders = j.folders || [];
        list.innerHTML = folders.length ? folders.map(row).join("") : '<p class="muted">No apareció ninguna carpeta con manifiesto.</p>';
      } catch (e) {
        say(String(e.message || e), false);
      }
    }
    save.addEventListener("click", async () => {
      const paths = [...list.querySelectorAll("input[data-map-path]:checked")].map((el) => el.getAttribute("data-map-path"));
      if (!paths.length) {
        say("Marcá al menos una carpeta.", false);
        return;
      }
      save.disabled = true;
      say("Guardando…");
      try {
        const j = await call("POST", "/api/map-folders", { paths });
        const n = (j.projects || []).length;
        say("Mapa guardado con " + n + " carpeta" + (n === 1 ? "" : "s") + ".", true);
        location.reload();
      } catch (e) {
        const map = { empty: "Marcá al menos una carpeta.", unknown: "Esas rutas no están entre las carpetas reconocidas." };
        say(map[String(e.message || "")] || String(e.message || e), false);
        save.disabled = false;
      }
    });
    discover?.addEventListener("click", async () => {
      const paths = [...list.querySelectorAll("input[data-map-path]:checked")].map((el) => el.getAttribute("data-map-path"));
      if (!paths.length) {
        say("Marcá al menos una carpeta.", false);
        return;
      }
      discover.disabled = true;
      if (save) save.disabled = true;
      say("Descubriendo mapa y skills de proceso…");
      try {
        const j = await call("POST", "/api/discover", { paths });
        const n = (j.projects || []).length;
        const skills = Number(j.skills || 0);
        say("Listo: " + n + " carpeta" + (n === 1 ? "" : "s") + ", ARQUITECTURA.md y " + skills + " skill" + (skills === 1 ? "" : "s") + " de proceso.", true);
        location.reload();
      } catch (e) {
        const map = { empty: "Marcá al menos una carpeta.", unknown: "Esas rutas no están entre las carpetas reconocidas.", "sin-carpetas": "Marcá al menos una carpeta." };
        say(map[String(e.message || "")] || String(e.message || e), false);
        discover.disabled = false;
        if (save) save.disabled = false;
      }
    });
    paint();
  })();
`;
}

export function projectBarScript() {
  return `
  (function () {
    const box = document.getElementById("afn-project-root");
    const msg = document.getElementById("afn-project-msg");
    const initBtn = document.getElementById("afn-init");
    const api = window.AFN_API;
    function say(t, ok) {
      if (!msg) return;
      msg.textContent = t || "";
      msg.style.color = ok === false ? "#fca5a5" : ok === true ? "#34d399" : "";
    }
    async function call(method, path, body) {
      if (!api) throw new Error("Abrí el dashboard en 127.0.0.1, no el HTML suelto.");
      const r = await fetch(api.base + path, {
        method,
        headers: { "Content-Type": "application/json", "x-afn-token": api.token },
        body: body == null ? undefined : JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(j.error || r.statusText);
        err.detail = j.detail || "";
        throw err;
      }
      return j;
    }
    function esc(s) {
      return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    async function paintCatalog() {
      const host = document.getElementById("afn-catalog-list");
      const box = document.getElementById("afn-catalog");
      if (box) box.hidden = false;
      const lead = document.getElementById("afn-port-lead");
      if (lead) lead.textContent = "Elegí un producto y abrilo: el menú completo pasa a esa carpeta. Desde acá también se puede solo registrar.";
      if (initBtn) initBtn.hidden = true;
      const j = await call("GET", "/api/catalog");
      const projects = j.projects || [];
      if (!host) return;
      host.innerHTML = projects.length
        ? projects.map((p) => {
            const facts = (p.observations || []).map((o) => "<li>" + esc(o.title || o.text || "") + "</li>").join("");
            const skills = (p.skills || []).map((s) => esc(s.name)).join(", ");
            return '<article class="article"><strong>' + esc(p.name) + '</strong><code>' + esc(p.root) + '</code>'
              + (skills ? '<p class="muted">Skills: ' + skills + '</p>' : '')
              + (facts ? '<ul>' + facts + '</ul>' : '<p class="muted">Sin hechos en este proyecto.</p>')
              + '</article>';
          }).join("")
        : '<div class="empty">Todavía no hay productos registrados. En cada uno corré setup kiro, o pegá la carpeta acá.</div>';
    }
    async function paint() {
      try {
        const j = await call("GET", "/api/who");
        if (box) box.textContent = j.root || "";
        const ws = document.querySelector(".ws");
        if (ws && j.root) ws.textContent = j.root;
        if (j.mode === "catalog") {
          say("Este es afn-ecosystem: ves la memoria de todos los proyectos registrados. Un producto no ve la de otro.");
          await paintCatalog();
          return;
        }
        if (initBtn) initBtn.hidden = !!j.initialized;
        if (!j.initialized) say("Este proyecto todavía no tiene mapa AFN. Inicializar crea solo su .afn.");
        else say("Memoria, skills y textos solo de esta carpeta.");
      } catch (e) {
        say(String(e.message || e), false);
      }
    }
    initBtn?.addEventListener("click", async () => {
      initBtn.disabled = true;
      say("Inicializando…");
      try {
        await call("POST", "/api/bootstrap", {});
        say("Listo. Este proyecto ya tiene su propio .afn.", true);
        if (initBtn) initBtn.hidden = true;
      } catch (e) {
        say(String(e.message || e), false);
        initBtn.disabled = false;
      }
    });
    function setPicked(folder, name) {
      const input = document.getElementById("afn-port-from");
      const card = document.getElementById("afn-pick");
      const title = document.getElementById("afn-pick-name");
      const pathEl = document.getElementById("afn-pick-path");
      const go = document.getElementById("afn-port");
      const skillsBtn = document.getElementById("afn-port-skills");
      if (input) input.value = folder || "";
      if (title) title.textContent = name || folder || "Ninguna carpeta elegida";
      if (pathEl) pathEl.textContent = folder || "Elegí la carpeta en el explorador. No hace falta pegar la ruta.";
      if (card) card.classList.toggle("on", !!folder);
      if (go) go.disabled = !folder;
      if (skillsBtn) skillsBtn.disabled = !folder;
    }
    document.getElementById("afn-browse")?.addEventListener("click", async () => {
      const browse = document.getElementById("afn-browse");
      if (browse) browse.disabled = true;
      say("Se abrió el explorador. Elegí la carpeta.");
      try {
        const j = await call("POST", "/api/pick-folder", {});
        setPicked(j.path, j.name);
        say("Carpeta lista: " + (j.name || j.path), true);
      } catch (e) {
        const map = { cancelled: "No elegiste carpeta.", unsupported: "No pude abrir el selector de carpetas." };
        const known = map[String(e.message || "")];
        say(known ? (e.detail ? known + " " + e.detail : known) : String(e.message || e), false);
      } finally {
        if (browse) browse.disabled = false;
      }
    });
    document.getElementById("afn-port")?.addEventListener("click", async () => {
      const from = document.getElementById("afn-port-from")?.value || "";
      if (!from) return;
      const go = document.getElementById("afn-port");
      if (go) go.disabled = true;
      say("Abriendo ese espacio…");
      try {
        await call("POST", "/api/workspace", { root: from });
        location.reload();
      } catch (e) {
        const map = { not_found: "No existe esa carpeta." };
        say(map[String(e.message || "")] || String(e.message || e), false);
        if (go) go.disabled = false;
      }
    });
    document.getElementById("afn-port-skills")?.addEventListener("click", async () => {
      const from = document.getElementById("afn-port-from")?.value || "";
      if (!from) return;
      say("Copiando skills y steering…");
      try {
        const j = await call("POST", "/api/import-assets", { from });
        const n = (j.copied || []).length;
        const s = (j.skipped || []).length;
        say(n ? "Traídos " + n + " archivos a este espacio." + (s ? " Omitidos " + s + "." : "") : "Nada nuevo para copiar.", true);
        location.reload();
      } catch (e) {
        const map = { not_found: "No existe esa carpeta.", same_project: "Esa carpeta es este mismo proyecto." };
        say(map[String(e.message || "")] || String(e.message || e), false);
      }
    });
    paint();
  })();
`;
}
