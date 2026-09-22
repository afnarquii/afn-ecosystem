/** UI del workbench Datos (orígenes, esquema, SQL). Sin dependencias. */

export function workbenchSections() {
  return `
    <section data-view="origenes" hidden>
      <h2>Orígenes de datos</h2>
      <p class="lead">Editá <code>.afn/db-connections.json</code>. Sin passwords (van en <code>.afn/credentials/data-agent.json</code>). Hace falta el dashboard por <code>http://127.0.0.1</code> (no file://).</p>
      <p id="wb-api-warn" class="muted" hidden>Este HTML se abrió como archivo. Pedí <strong>abre dashboard AFN</strong> para editar y ejecutar SQL.</p>
      <div class="toolbar">
        <button type="button" class="btn" id="wb-origins-reload">Recargar</button>
        <button type="button" class="btn" id="wb-origins-save">Guardar orígenes</button>
        <span id="wb-origins-msg" class="muted"></span>
      </div>
      <textarea id="wb-origins-json" spellcheck="false" class="sql-ed" rows="18" placeholder='{ "connections": [] }'></textarea>
    </section>
    <section data-view="esquema" hidden>
      <h2>Tablas y procedimientos para la arquitectura</h2>
      <p class="lead">Marcá las 3 tablas o el PA que usa el flujo. El resto queda en la captura completa (<code>datos-live.json</code>) pero no entra a <code>ARQUITECTURA.md</code>.</p>
      <div class="toolbar">
        <input id="wb-schema-q" type="search" placeholder="Filtrar…" style="flex:1;min-width:160px"/>
        <button type="button" class="btn" id="wb-schema-all">Todas</button>
        <button type="button" class="btn" id="wb-schema-none">Ninguna</button>
        <button type="button" class="btn" id="wb-schema-save">Guardar selección</button>
        <span id="wb-schema-msg" class="muted"></span>
      </div>
      <p class="muted" id="wb-schema-count"></p>
      <div id="wb-schema-tables"></div>
      <h3>Procedimientos</h3>
      <div id="wb-schema-procs"></div>
    </section>
    <section data-view="sql" hidden>
      <h2>Consulta SQL</h2>
      <p class="lead">Editor de solo lectura (SELECT / WITH), como Reportes BD de AFN IDE. Ctrl+Enter ejecuta. Resultados en grilla, CSV y favoritos.</p>
      <div class="toolbar">
        <label class="muted">Origen <select id="wb-sql-origin"></select></label>
        <label class="muted">Límite <input id="wb-sql-limit" type="number" value="100" min="1" max="500" style="width:4.5rem"/></label>
        <button type="button" class="btn" id="wb-sql-run">Ejecutar</button>
        <button type="button" class="btn" id="wb-sql-csv">CSV</button>
        <button type="button" class="btn" id="wb-sql-fav">A favoritos</button>
        <span id="wb-sql-msg" class="muted"></span>
      </div>
      <textarea id="wb-sql-ed" spellcheck="false" class="sql-ed" rows="10">-- Solo SELECT. Ctrl+Enter ejecuta.
SELECT TOP 20 TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY 1, 2;</textarea>
      <div id="wb-sql-favs" class="toolbar"></div>
      <div class="table-wrap"><table class="doc-table" id="wb-sql-grid"><thead></thead><tbody></tbody></table></div>
    </section>`;
}

export function workbenchNavButtons() {
  return `
      <button type="button" data-go="origenes">Orígenes</button>
      <button type="button" data-go="esquema">Elegir tablas/PAs</button>
      <button type="button" data-go="sql">SQL</button>`;
}

export function workbenchScript() {
  return `
  const api = window.AFN_API;
  const verEl = document.getElementById("wb-ver");
  const ver = document.body.getAttribute("data-afn-version") || "";
  if (verEl) verEl.textContent = api
    ? ("v" + ver + " · 127.0.0.1 — Orígenes / Elegir tablas / SQL")
    : ("v" + ver + " · archivo local (sin SQL). Pedí «abre dashboard AFN» otra vez.");
  const warn = document.getElementById("wb-api-warn");
  if (warn && !api) warn.hidden = false;
  async function apiCall(method, path, body) {
    if (!api) throw new Error("Dashboard sin servidor local");
    const r = await fetch(api.base + path, {
      method,
      headers: { "Content-Type": "application/json", "x-afn-token": api.token },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }
  function setMsg(id, t, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = t || "";
    el.style.color = ok === false ? "#fca5a5" : "";
  }
  async function loadOrigins() {
    const j = await apiCall("GET", "/api/origins");
    document.getElementById("wb-origins-json").value = JSON.stringify({ connections: j.connections || [] }, null, 2);
    const sel = document.getElementById("wb-sql-origin");
    sel.innerHTML = (j.connections || []).map((c) => {
      const id = c.id || c.name || "";
      const label = (c.name || c.connectionName || id) + " · " + (c.engine || c.dbEngine || "");
      return "<option value=\\"" + String(id).replace(/"/g,"") + "\\">" + label.replace(/</g,"") + "</option>";
    }).join("");
  }
  document.getElementById("wb-origins-reload")?.addEventListener("click", () => loadOrigins().then(() => setMsg("wb-origins-msg","Recargado",true)).catch((e) => setMsg("wb-origins-msg", e.message, false)));
  document.getElementById("wb-origins-save")?.addEventListener("click", async () => {
    try {
      const parsed = JSON.parse(document.getElementById("wb-origins-json").value);
      await apiCall("PUT", "/api/origins", { connections: parsed.connections || parsed });
      setMsg("wb-origins-msg", "Guardado en db-connections.json", true);
      await loadOrigins();
    } catch (e) { setMsg("wb-origins-msg", e.message, false); }
  });
  let schemaState = { live: { tables: [], procedures: [] }, selection: null, connectionId: "_default" };
  function tableName(t) { return String(t.name || t.fullName || ""); }
  function procName(p) { return String(p.name || ""); }
  function enabledSet(list, fallbackAll) {
    if (!Array.isArray(list)) return null;
    return new Set(list);
  }
  function renderSchema() {
    const q = (document.getElementById("wb-schema-q")?.value || "").toLowerCase();
    const sel = schemaState.selection || {};
    const tSet = enabledSet(sel.enabledTables);
    const pSet = enabledSet(sel.enabledProcedures);
    const tables = schemaState.live.tables || [];
    const procs = schemaState.live.procedures || [];
    const tHtml = tables.filter((t) => tableName(t).toLowerCase().includes(q)).map((t) => {
      const n = tableName(t);
      const on = tSet ? tSet.has(n) : true;
      return "<label class=\\"chk\\"><input type=checkbox data-kind=t data-name=\\"" + n.replace(/"/g,"") + "\\" " + (on ? "checked" : "") + "> <code>" + n.replace(/</g,"") + "</code></label>";
    }).join("") || "<p class=muted>No hay captura. En Kiro: listá las tablas y guardalas en la arquitectura.</p>";
    const pHtml = procs.filter((p) => procName(p).toLowerCase().includes(q)).map((p) => {
      const n = procName(p);
      const on = pSet ? pSet.has(n) : true;
      return "<label class=\\"chk\\"><input type=checkbox data-kind=p data-name=\\"" + n.replace(/"/g,"") + "\\" " + (on ? "checked" : "") + "> <code>" + n.replace(/</g,"") + "</code></label>";
    }).join("") || "<p class=muted>Sin procedimientos en la captura.</p>";
    document.getElementById("wb-schema-tables").innerHTML = tHtml;
    document.getElementById("wb-schema-procs").innerHTML = pHtml;
    const tOn = tables.filter((t) => (tSet ? tSet.has(tableName(t)) : true)).length;
    const pOn = procs.filter((p) => (pSet ? pSet.has(procName(p)) : true)).length;
    document.getElementById("wb-schema-count").textContent = tOn + "/" + tables.length + " tablas · " + pOn + "/" + procs.length + " PAs en la arquitectura";
  }
  async function loadSchema() {
    const j = await apiCall("GET", "/api/schema");
    schemaState = j;
    if (!schemaState.selection) schemaState.selection = {};
    renderSchema();
  }
  document.getElementById("wb-schema-q")?.addEventListener("input", renderSchema);
  document.getElementById("wb-schema-all")?.addEventListener("click", () => {
    schemaState.selection = {
      enabledTables: (schemaState.live.tables || []).map(tableName),
      enabledProcedures: (schemaState.live.procedures || []).map(procName),
    };
    renderSchema();
  });
  document.getElementById("wb-schema-none")?.addEventListener("click", () => {
    schemaState.selection = { enabledTables: [], enabledProcedures: [] };
    renderSchema();
  });
  document.getElementById("wb-schema-save")?.addEventListener("click", async () => {
    try {
      const t = [...document.querySelectorAll("#wb-schema-tables input[data-kind=t]:checked")].map((i) => i.getAttribute("data-name"));
      const p = [...document.querySelectorAll("#wb-schema-procs input[data-kind=p]:checked")].map((i) => i.getAttribute("data-name"));
      await apiCall("PUT", "/api/schema", { connectionId: schemaState.connectionId, enabledTables: t, enabledProcedures: p });
      setMsg("wb-schema-msg", "Guardado. ARQUITECTURA.md §6b usa esta selección.", true);
      await loadSchema();
    } catch (e) { setMsg("wb-schema-msg", e.message, false); }
  });
  let lastRows = [];
  let lastCols = [];
  function renderGrid(cols, rows) {
    lastCols = cols || [];
    lastRows = rows || [];
    const thead = document.querySelector("#wb-sql-grid thead");
    const tbody = document.querySelector("#wb-sql-grid tbody");
    thead.innerHTML = lastCols.length ? "<tr>" + lastCols.map((c) => "<th>" + String(c).replace(/</g,"") + "</th>").join("") + "</tr>" : "";
    tbody.innerHTML = lastRows.map((row) => "<tr>" + lastCols.map((c) => "<td>" + String(row[c] ?? "").replace(/</g,"").slice(0,200) + "</td>").join("") + "</tr>").join("");
  }
  async function runSql() {
    try {
      setMsg("wb-sql-msg", "Ejecutando…");
      const j = await apiCall("POST", "/api/sql", {
        sql: document.getElementById("wb-sql-ed").value,
        connectionId: document.getElementById("wb-sql-origin").value,
        limit: Number(document.getElementById("wb-sql-limit").value || 100),
      });
      renderGrid(j.columns, j.rows);
      setMsg("wb-sql-msg", (j.rows || []).length + " filas" + (j.truncated ? " (recorte)" : ""), true);
    } catch (e) {
      renderGrid([], []);
      setMsg("wb-sql-msg", e.message, false);
    }
  }
  document.getElementById("wb-sql-run")?.addEventListener("click", runSql);
  document.getElementById("wb-sql-ed")?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runSql(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.target;
      const a = el.selectionStart, b = el.selectionEnd;
      el.value = el.value.slice(0, a) + "  " + el.value.slice(b);
      el.selectionStart = el.selectionEnd = a + 2;
    }
  });
  document.getElementById("wb-sql-csv")?.addEventListener("click", () => {
    if (!lastCols.length) return;
    const lines = [lastCols.join(",")].concat(lastRows.map((r) => lastCols.map((c) => JSON.stringify(r[c] ?? "")).join(",")));
    const blob = new Blob([lines.join("\\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "consulta.csv";
    a.click();
  });
  async function loadFavs() {
    if (!api) return;
    const j = await apiCall("GET", "/api/sql/favorites");
    const box = document.getElementById("wb-sql-favs");
    box.innerHTML = (j.favorites || []).map((f) => "<button type=button class=btn data-fav=\\"" + String(f.id).replace(/"/g,"") + "\\">" + String(f.title || "fav").replace(/</g,"") + "</button>").join("");
    box.querySelectorAll("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hit = (j.favorites || []).find((x) => x.id === btn.getAttribute("data-fav"));
        if (hit) document.getElementById("wb-sql-ed").value = hit.sql;
      });
    });
    window.__afnFavs = j.favorites || [];
  }
  document.getElementById("wb-sql-fav")?.addEventListener("click", async () => {
    try {
      const sql = document.getElementById("wb-sql-ed").value;
      const title = (sql.split("\\n").find((l) => l.trim() && !l.trim().startsWith("--")) || "consulta").slice(0, 60);
      const favorites = (window.__afnFavs || []).concat([{ id: "fav_" + Date.now(), title, sql }]);
      await apiCall("PUT", "/api/sql/favorites", { favorites });
      setMsg("wb-sql-msg", "Favorito guardado", true);
      await loadFavs();
    } catch (e) { setMsg("wb-sql-msg", e.message, false); }
  });
  if (api) {
    loadOrigins().catch((e) => setMsg("wb-origins-msg", e.message, false));
    loadSchema().catch(() => {});
    loadFavs().catch(() => {});
  }
`;
}
