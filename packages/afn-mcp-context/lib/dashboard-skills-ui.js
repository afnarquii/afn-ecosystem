/** Pestaña Skills del dashboard: listar, leer y editar SKILL.md sin el chat. */

export function skillsNavButton() {
  return `      <button type="button" data-go="skills">Skills</button>`;
}

export function skillsSection() {
  return `
    <section data-view="skills" hidden>
      <div id="sk-home">
        <h2>Skills del proyecto</h2>
        <p class="lead">Lo que el equipo ya dejó escrito para no volver a explicarlo en el chat. Abrí una skill para ver qué cubre. Si hace falta, editala y guardá: Kiro la vuelve a usar sin gastar tokens en redescubrir el flujo.</p>
        <p id="sk-api-warn" class="muted" hidden style="color:#fbbf24">Para leer y editar hace falta el dashboard en 127.0.0.1. En Kiro: «abre dashboard AFN».</p>
        <div class="toolbar">
          <input id="sk-q" type="search" placeholder="Buscar por nombre o qué hace…" style="flex:1;min-width:180px;padding:.45rem .65rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
          <select id="sk-bucket" style="padding:.45rem .55rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit">
            <option value="">Todas</option>
            <option value="kiro">Kiro</option>
            <option value="afn">AFN</option>
            <option value="copilot">Copilot</option>
          </select>
          <button type="button" class="btn" id="sk-new-open">Nueva skill</button>
        </div>
        <p id="sk-msg" class="muted" role="status"></p>
        <div class="grid" id="sk-list"></div>
        <div id="sk-new" class="article" hidden style="margin-top:1rem;max-width:720px">
          <h3 style="margin-top:0">Nueva skill</h3>
          <p class="muted">Queda en el repo, en la carpeta que elija el equipo. Kiro lee <code>.kiro/skills</code>.</p>
          <label class="muted" style="display:block;margin:.55rem 0 .2rem">Dónde</label>
          <select id="sk-new-bucket" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit">
            <option value="kiro">Kiro (.kiro/skills)</option>
            <option value="afn">AFN (.afn/skills)</option>
            <option value="copilot">Copilot (.github/skills)</option>
          </select>
          <label class="muted" style="display:block;margin:.55rem 0 .2rem">Nombre</label>
          <input id="sk-new-name" type="text" placeholder="Caja turnos" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
          <label class="muted" style="display:block;margin:.55rem 0 .2rem">Para qué sirve</label>
          <textarea id="sk-new-desc" rows="3" placeholder="Turnos y comandas de caja: qué pantalla, qué consulta y qué no tocar." style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit;font:inherit"></textarea>
          <div class="toolbar" style="margin-top:.8rem">
            <button type="button" class="btn" id="sk-new-save">Crear y abrir</button>
            <button type="button" class="btn" id="sk-new-cancel">Cancelar</button>
          </div>
        </div>
      </div>
      <div id="sk-editor" hidden>
        <div class="toolbar">
          <button type="button" class="btn" id="sk-back">← Skills</button>
          <button type="button" class="btn on" id="sk-mode-read">Leer</button>
          <button type="button" class="btn" id="sk-mode-edit">Editar</button>
          <button type="button" class="btn" id="sk-save" hidden>Guardar</button>
          <span id="sk-edit-msg" class="muted" role="status"></span>
        </div>
        <p class="muted" style="margin-top:0"><span class="tag" id="sk-kind"></span> <code id="sk-path"></code></p>
        <p id="sk-summary" class="lead"></p>
        <article id="sk-preview" class="article"></article>
        <textarea id="sk-text" class="sql-ed" spellcheck="false" hidden style="min-height:28rem;margin-top:.4rem"></textarea>
        <p class="muted" id="sk-hint">Ctrl+S guarda mientras editás.</p>
      </div>
    </section>`;
}

export function skillsCss() {
  return `
  #sk-text { width:100%; }
  #sk-list .tile strong { font-size:.98rem; }
  #sk-preview pre { background:#0b1016; border:1px solid var(--line); border-radius:8px; padding:.7rem .8rem; overflow:auto; }
  `;
}

export function skillsScript() {
  return `
  const skApi = window.AFN_API;
  const skWarn = document.getElementById("sk-api-warn");
  if (skWarn && !skApi) skWarn.hidden = false;
  const skErr = {
    token: "Token viejo: cerrá la pestaña y pedí otra vez «abre dashboard AFN».",
    invalid_path: "Esa ruta no es una skill del proyecto.",
    not_found: "No encontré el archivo. Volvé a la lista.",
    empty: "La skill no puede quedar vacía.",
    too_large: "El texto es demasiado largo para guardarlo acá.",
    exists: "Ya existe una skill con ese nombre.",
    invalid_name: "Poné un nombre de al menos 2 letras.",
    invalid_bucket: "Elegí Kiro, AFN o Copilot.",
  };
  let skItems = [];
  let skCurrent = null;
  let skDirty = false;
  async function skCall(method, path, body) {
    if (!skApi) throw new Error("Abrí el dashboard con «abre dashboard AFN» para leer y editar.");
    const r = await fetch(skApi.base + path, {
      method,
      headers: { "Content-Type": "application/json", "x-afn-token": skApi.token },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(skErr[j.error] || j.error || r.statusText);
    return j;
  }
  function skSet(id, t, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = t || "";
    el.style.color = ok === false ? "#fca5a5" : ok === true ? "#34d399" : "";
  }
  function skEsc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function skInline(s) {
    return skEsc(s).replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
  }
  function skPreview(md) {
    const fence = String.fromCharCode(96, 96, 96);
    const src = String(md || "").replace(/^---[\\s\\S]*?---\\s*/, "");
    const lines = src.replace(/\\r\\n/g, "\\n").split("\\n");
    const out = [];
    let i = 0;
    let pre = false;
    let buf = [];
    const flush = () => { if (buf.length) { out.push("<pre><code>" + skEsc(buf.join("\\n")) + "</code></pre>"); buf = []; } };
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith(fence)) { if (pre) { flush(); pre = false; } else { pre = true; } i += 1; continue; }
      if (pre) { buf.push(line); i += 1; continue; }
      if (/^### /.test(line)) { out.push("<h3>" + skInline(line.slice(4)) + "</h3>"); i += 1; continue; }
      if (/^## /.test(line)) { out.push("<h2>" + skInline(line.slice(3)) + "</h2>"); i += 1; continue; }
      if (/^# /.test(line)) { out.push("<h1>" + skInline(line.slice(2)) + "</h1>"); i += 1; continue; }
      if (/^[-*] /.test(line)) {
        out.push("<ul>");
        while (i < lines.length && /^[-*] /.test(lines[i])) { out.push("<li>" + skInline(lines[i].replace(/^[-*] /, "")) + "</li>"); i += 1; }
        out.push("</ul>");
        continue;
      }
      if (!line.trim()) { i += 1; continue; }
      out.push("<p>" + skInline(line) + "</p>");
      i += 1;
    }
    flush();
    return out.join("\\n") || "<p class='muted'>Esta skill todavía no tiene texto.</p>";
  }
  function skRenderList() {
    const q = (document.getElementById("sk-q")?.value || "").trim().toLowerCase();
    const bucket = document.getElementById("sk-bucket")?.value || "";
    const host = document.getElementById("sk-list");
    if (!host) return;
    const rows = skItems.filter((s) => {
      if (bucket && s.bucket !== bucket) return false;
      if (!q) return true;
      return (s.name + " " + s.description + " " + s.rel + " " + (s.slash || "")).toLowerCase().includes(q);
    });
    if (!rows.length) {
      host.innerHTML = '<div class="empty">No hay skills con ese filtro. Creá una con <strong>Nueva skill</strong> cuando el equipo fije un flujo.</div>';
      return;
    }
    host.innerHTML = rows.map((s) => {
      const desc = s.description || "Sin descripción. Abrila y completala.";
      return '<button type="button" class="tile" data-sk-open="' + skEsc(s.rel) + '"><span class="k">' + skEsc(s.bucketLabel || s.bucket) + (s.slash ? " · /" + skEsc(String(s.slash).replace(/^\\//, "")) : "") + '</span><strong>' + skEsc(s.name) + '</strong><span class="muted">' + skEsc(desc) + '</span><code>' + skEsc(s.rel) + '</code></button>';
    }).join("");
  }
  async function skLoadList() {
    if (!skApi) {
      skSet("sk-msg", "Lista vacía en archivo local. Pedí «abre dashboard AFN».", false);
      return;
    }
    skSet("sk-msg", "Cargando…");
    try {
      const j = await skCall("GET", "/api/skills");
      skItems = j.skills || [];
      skSet("sk-msg", skItems.length ? (skItems.length + " skills") : "Todavía no hay skills. Creá la primera.", true);
      skRenderList();
    } catch (e) {
      skSet("sk-msg", String(e.message || e), false);
    }
  }
  function skShowHome() {
    const home = document.getElementById("sk-home");
    const ed = document.getElementById("sk-editor");
    if (home) home.hidden = false;
    if (ed) ed.hidden = true;
    skCurrent = null;
    skDirty = false;
  }
  function skMode(edit) {
    const preview = document.getElementById("sk-preview");
    const text = document.getElementById("sk-text");
    const save = document.getElementById("sk-save");
    const readBtn = document.getElementById("sk-mode-read");
    const editBtn = document.getElementById("sk-mode-edit");
    if (preview) preview.hidden = edit;
    if (text) text.hidden = !edit;
    if (save) save.hidden = !edit;
    if (readBtn) readBtn.classList.toggle("on", !edit);
    if (editBtn) editBtn.classList.toggle("on", edit);
    if (!edit && text && preview) preview.innerHTML = skPreview(text.value);
  }
  async function skOpen(rel) {
    if (skDirty && !window.confirm("Hay cambios sin guardar. ¿Salir igual?")) return;
    skSet("sk-msg", "");
    try {
      const j = await skCall("GET", "/api/skills/file?rel=" + encodeURIComponent(rel));
      skCurrent = j;
      skDirty = false;
      document.getElementById("sk-home").hidden = true;
      document.getElementById("sk-editor").hidden = false;
      document.getElementById("sk-kind").textContent = j.bucketLabel || j.bucket || "";
      document.getElementById("sk-path").textContent = j.rel || rel;
      const bits = [j.description, j.slash ? ("Invocación: /" + String(j.slash).replace(/^\\//, "")) : ""].filter(Boolean);
      document.getElementById("sk-summary").textContent = bits.join(" · ");
      const text = document.getElementById("sk-text");
      text.value = j.markdown || "";
      skMode(false);
      skSet("sk-edit-msg", "");
    } catch (e) {
      skSet("sk-msg", String(e.message || e), false);
    }
  }
  async function skSave() {
    if (!skCurrent?.rel) return;
    const text = document.getElementById("sk-text")?.value || "";
    skSet("sk-edit-msg", "Guardando…");
    try {
      const j = await skCall("PUT", "/api/skills/file", { rel: skCurrent.rel, markdown: text });
      skCurrent = j;
      skDirty = false;
      document.getElementById("sk-text").value = j.markdown || text;
      skSet("sk-edit-msg", "Guardado. Kiro la toma del disco en el próximo chat.", true);
    } catch (e) {
      skSet("sk-edit-msg", String(e.message || e), false);
    }
  }
  window.afnSkillsOnShow = function () {
    const ed = document.getElementById("sk-editor");
    if (ed && !ed.hidden) return;
    skLoadList();
  };
  document.getElementById("sk-q")?.addEventListener("input", skRenderList);
  document.getElementById("sk-bucket")?.addEventListener("change", skRenderList);
  document.getElementById("sk-new-open")?.addEventListener("click", () => {
    const box = document.getElementById("sk-new");
    if (box) box.hidden = false;
    document.getElementById("sk-new-name")?.focus();
  });
  document.getElementById("sk-new-cancel")?.addEventListener("click", () => {
    const box = document.getElementById("sk-new");
    if (box) box.hidden = true;
  });
  document.getElementById("sk-new-save")?.addEventListener("click", async () => {
    skSet("sk-msg", "Creando…");
    try {
      const j = await skCall("POST", "/api/skills", {
        bucket: document.getElementById("sk-new-bucket")?.value || "kiro",
        name: document.getElementById("sk-new-name")?.value || "",
        description: document.getElementById("sk-new-desc")?.value || "",
      });
      document.getElementById("sk-new").hidden = true;
      document.getElementById("sk-new-name").value = "";
      document.getElementById("sk-new-desc").value = "";
      await skLoadList();
      await skOpen(j.rel);
      skMode(true);
      skSet("sk-edit-msg", "Lista. Completá el flujo y guardá.", true);
    } catch (e) {
      skSet("sk-msg", String(e.message || e), false);
    }
  });
  document.getElementById("sk-list")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sk-open]");
    if (!b) return;
    skOpen(b.getAttribute("data-sk-open"));
  });
  document.getElementById("sk-back")?.addEventListener("click", () => {
    if (skDirty && !window.confirm("Hay cambios sin guardar. ¿Volver a la lista?")) return;
    skShowHome();
    skLoadList();
  });
  document.getElementById("sk-mode-read")?.addEventListener("click", () => skMode(false));
  document.getElementById("sk-mode-edit")?.addEventListener("click", () => skMode(true));
  document.getElementById("sk-save")?.addEventListener("click", skSave);
  document.getElementById("sk-text")?.addEventListener("input", () => { skDirty = true; skSet("sk-edit-msg", "Cambios sin guardar"); });
  window.addEventListener("keydown", (e) => {
    const view = document.querySelector('[data-view="skills"]');
    if (!view || view.hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      const text = document.getElementById("sk-text");
      if (text && !text.hidden) { e.preventDefault(); skSave(); }
    }
  });
  if (document.querySelector('[data-view="skills"]') && !document.querySelector('[data-view="skills"]').hidden) skLoadList();
`;
}
