/** UI del workbench Datos (orígenes, esquema, SQL). Sin dependencias. */

export function workbenchSections() {
  return `
    <section data-view="origenes" hidden>
      <h2>Orígenes de datos</h2>
      <p class="lead">Completá host, puerto y base. La contraseña <strong>no</strong> va acá: archivo <code>.afn/credentials/data-agent.json</code>.</p>
      <p id="wb-api-warn" class="muted" hidden style="color:#fbbf24">Esta pestaña no puede guardar: recargá con «abre dashboard AFN» (URL 127.0.0.1 con token).</p>
      <p id="wb-origins-msg" class="muted" role="status"></p>
      <div class="article" id="wb-origins-form" style="max-width:640px">
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Nombre</label>
        <input id="wb-o-name" type="text" placeholder="Pedidos QA" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Motor</label>
        <select id="wb-o-engine" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit">
          <option value="sqlserver">SQL Server</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mongodb">MongoDB</option>
        </select>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Host</label>
        <input id="wb-o-host" type="text" placeholder="localhost o el servidor" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Puerto</label>
        <input id="wb-o-port" type="number" placeholder="1433 / 5432 / 3306" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <label class="muted" style="display:block;margin:.6rem 0 .25rem">Base / database</label>
        <input id="wb-o-database" type="text" placeholder="nombre de la base" style="width:100%;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:#0b1016;color:inherit"/>
        <div class="toolbar" style="margin-top:1rem">
          <button type="button" class="btn" id="wb-origins-save">Guardar origen</button>
          <button type="button" class="btn" id="wb-origins-reload">Recargar</button>
        </div>
      </div>
      <div class="article" id="wb-cred-box" style="max-width:640px;margin-top:1.25rem">
        <h3>Contraseña — <code>.afn/credentials/data-agent.json</code></h3>
        <p id="wb-cred-status" class="muted" role="status">Host/puerto/base van arriba. Acá solo usuario y password. El archivo no se versiona.</p>
        <p class="muted">Un origen (SQL Server o PostgreSQL):</p>
        <pre class="sql-ed" id="wb-cred-example">{
  "DB_USER": "sa",
  "DB_PASSWORD": "TU_PASSWORD"
}</pre>
        <p class="muted">Varios orígenes (el <code>id</code> es el del JSON de orígenes, p. ej. <code>origen_1</code>):</p>
        <pre class="sql-ed">{
  "byId": {
    "origen_1": { "DB_USER": "sa", "DB_PASSWORD": "TU_PASSWORD" }
  }
}</pre>
        <p class="muted">MongoDB:</p>
        <pre class="sql-ed">{
  "MONGODB_URI": "mongodb://USER:PASSWORD@localhost:27017/db"
}</pre>
      </div>
      <details style="margin-top:1rem">
        <summary class="muted">JSON (varios orígenes)</summary>
        <textarea id="wb-origins-json" spellcheck="false" class="sql-ed" rows="10" placeholder='{ "connections": [] }'></textarea>
      </details>
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
    <section data-view="sql" hidden class="sql-ide">
      <h2>Consulta SQL</h2>
      <p class="lead">Editor de solo lectura: <code>SELECT</code>, <code>WITH</code> y <code>EXEC dbo.NombrePA @p = 1</code>. F5 o Ctrl+Enter ejecuta. Marcá filas (o Todas) para ver JSON/TXT y descargar una, varias o todas.</p>
      <p id="wb-sql-driver" class="muted">Driver: comprobando…</p>
      <div class="sql-ide-toolbar">
        <label>Origen <select id="wb-sql-origin"></select></label>
        <label>Límite <input id="wb-sql-limit" type="number" value="200" min="1" max="2000" style="width:4.8rem"/></label>
        <button type="button" class="btn btn-run" id="wb-sql-run" title="F5">▶ Ejecutar</button>
        <span class="sql-export">
          <button type="button" class="btn" id="wb-sql-xls" title="Excel">Excel</button>
          <button type="button" class="btn" id="wb-sql-json">JSON</button>
          <button type="button" class="btn" id="wb-sql-txt">TXT</button>
          <button type="button" class="btn" id="wb-sql-csv">CSV</button>
        </span>
        <button type="button" class="btn" id="wb-sql-fav">★ Favorito</button>
      </div>
      <div class="sql-ide-split">
        <div class="sql-editor-wrap">
          <pre class="sql-gutter" id="wb-sql-gutter">1</pre>
          <textarea id="wb-sql-ed" spellcheck="false" class="sql-ed" wrap="off">-- SELECT o EXEC de un PA de consulta. F5 / Ctrl+Enter.
-- EXEC dbo.NombrePA @param = 1;
SELECT TOP 20 TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY 1, 2;</textarea>
        </div>
        <div class="sql-results">
          <div class="sql-statusbar">
            <span id="wb-sql-msg">Listo. F5 ejecuta.</span>
            <span id="wb-sql-meta"></span>
          </div>
          <div class="sql-rowbar" id="wb-sql-rowbar">
            <button type="button" class="btn" id="wb-sql-sel-all-btn">Todas</button>
            <button type="button" class="btn" id="wb-sql-sel-none">Ninguna</button>
            <span class="muted" id="wb-sql-sel-count">0 seleccionadas</span>
            <button type="button" class="btn" id="wb-sql-view-json" title="Ver filas elegidas en JSON">Ver JSON</button>
            <button type="button" class="btn" id="wb-sql-view-txt">Ver TXT</button>
            <button type="button" class="btn" id="wb-sql-copy-sel">Copiar</button>
            <button type="button" class="btn" id="wb-sql-dl-json">↓ JSON</button>
            <button type="button" class="btn" id="wb-sql-dl-txt">↓ TXT</button>
            <button type="button" class="btn" id="wb-sql-dl-xls">↓ Excel</button>
          </div>
          <div class="table-wrap sql-grid-wrap"><table class="doc-table" id="wb-sql-grid"><thead></thead><tbody></tbody></table></div>
          <div class="sql-inspect" id="wb-sql-inspect" hidden>
            <div class="sql-inspect-bar">
              <span id="wb-sql-inspect-title">Fila</span>
              <button type="button" class="btn" data-inspect-fmt="json">JSON</button>
              <button type="button" class="btn" data-inspect-fmt="txt">TXT</button>
              <button type="button" class="btn" id="wb-sql-inspect-copy">Copiar</button>
              <button type="button" class="btn" id="wb-sql-inspect-dl">Descargar esta</button>
              <button type="button" class="btn" id="wb-sql-inspect-close">Cerrar</button>
            </div>
            <pre id="wb-sql-inspect-body" class="sql-inspect-body"></pre>
          </div>
        </div>
      </div>
      <div id="wb-sql-favs" class="toolbar"></div>
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
    if (!r.ok) throw new Error(j.error === "token" ? "Token viejo: cerrá esta pestaña y pedí otra vez «abre dashboard AFN»." : (j.error || r.statusText));
    return j;
  }
  function setMsg(id, t, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = t || "";
    el.style.color = ok === false ? "#fca5a5" : ok === true ? "#34d399" : "";
    el.style.fontWeight = ok === true || ok === false ? "600" : "";
  }
  let originsList = [];
  function fillOriginForm(c) {
    const x = c || {};
    const name = document.getElementById("wb-o-name");
    const engine = document.getElementById("wb-o-engine");
    const host = document.getElementById("wb-o-host");
    const port = document.getElementById("wb-o-port");
    const database = document.getElementById("wb-o-database");
    if (name) name.value = x.name || x.connectionName || "";
    const eng = String(x.engine || x.dbEngine || "sqlserver").toLowerCase();
    if (engine) engine.value = /mongo/.test(eng) ? "mongodb" : /postgres/.test(eng) ? "postgresql" : /mysql/.test(eng) ? "mysql" : "sqlserver";
    if (host) host.value = x.host || x.server || "";
    if (port) port.value = x.port || "";
    if (database) database.value = x.database || "";
  }
  function formToOrigin(prev) {
    const engine = (document.getElementById("wb-o-engine")?.value || "sqlserver").trim();
    const portRaw = document.getElementById("wb-o-port")?.value;
    return {
      ...(prev && typeof prev === "object" ? prev : {}),
      id: prev?.id || "origen_1",
      name: (document.getElementById("wb-o-name")?.value || "").trim() || "origen",
      connectionName: (document.getElementById("wb-o-name")?.value || "").trim() || "origen",
      dbEngine: engine,
      engine,
      host: (document.getElementById("wb-o-host")?.value || "").trim(),
      port: portRaw ? Number(portRaw) : null,
      database: (document.getElementById("wb-o-database")?.value || "").trim(),
      needsCredentials: true,
    };
  }
  function renderCredStatus(c) {
    const el = document.getElementById("wb-cred-status");
    if (!el) return;
    if (!c) {
      el.textContent = "Host/puerto/base van arriba. Acá solo usuario y password.";
      return;
    }
    if (!c.exists) el.textContent = "Falta el archivo. Creá .afn/credentials/data-agent.json con el JSON de ejemplo.";
    else if (!c.validJson) el.textContent = "El archivo existe pero no es JSON válido.";
    else if (c.shape === "empty") el.textContent = "El archivo está vacío. Pegá DB_USER y DB_PASSWORD.";
    else if (!c.hasUser || !c.hasPassword) el.textContent = "El archivo existe pero falta DB_USER o DB_PASSWORD (o MONGODB_URI).";
    else el.textContent = "Credenciales OK (hay usuario y password). No se muestran acá.";
    el.style.color = (!c.exists || !c.validJson || !c.hasUser || !c.hasPassword) ? "#fbbf24" : "#34d399";
  }
  async function loadOrigins() {
    const j = await apiCall("GET", "/api/origins");
    originsList = Array.isArray(j.connections) ? j.connections : [];
    fillOriginForm(originsList[0] || {});
    renderCredStatus(j.credentials);
    const ta = document.getElementById("wb-origins-json");
    if (ta) ta.value = JSON.stringify({ connections: originsList }, null, 2);
    const sel = document.getElementById("wb-sql-origin");
    if (sel) {
      sel.innerHTML = originsList.map((c) => {
        const id = c.id || c.name || "";
        const label = (c.name || c.connectionName || id) + " · " + (c.engine || c.dbEngine || "");
        return "<option value=\\"" + String(id).replace(/"/g,"") + "\\">" + label.replace(/</g,"") + "</option>";
      }).join("");
    }
  }
  document.getElementById("wb-origins-reload")?.addEventListener("click", () => loadOrigins().then(() => setMsg("wb-origins-msg","Recargado",true)).catch((e) => setMsg("wb-origins-msg", e.message, false)));
  document.getElementById("wb-origins-save")?.addEventListener("click", async () => {
    try {
      const first = formToOrigin(originsList[0] || { id: "origen_1" });
      if (!first.host && !first.database) {
        setMsg("wb-origins-msg", "Falta host o database", false);
        return;
      }
      const rest = originsList.slice(1);
      const connections = [first].concat(rest);
      const j = await apiCall("PUT", "/api/origins", { connections });
      setMsg("wb-origins-msg", "Guardado (" + (j.count || connections.length) + "). Password no se guarda acá.", true);
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
  let selected = new Set();
  let lastClickRi = 0;
  let inspectRi = -1;
  let inspectFmt = "json";
  function cellEsc(v) {
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  }
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2,"0");
    return d.getFullYear() + p(d.getMonth()+1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }
  function downloadBlob(name, mime, text) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function syncGutter() {
    const ta = document.getElementById("wb-sql-ed");
    const g = document.getElementById("wb-sql-gutter");
    if (!ta || !g) return;
    const n = Math.max(1, String(ta.value || "").split("\\n").length);
    g.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\\n");
    g.scrollTop = ta.scrollTop;
  }
  function pickRows() {
    if (selected.size) return [...selected].sort((a,b) => a - b).map((i) => lastRows[i]).filter(Boolean);
    return lastRows;
  }
  function rowTxt(row) {
    return lastCols.map((c) => c + ": " + String(row[c] ?? "")).join("\\n");
  }
  function rowsJson(rows) {
    return JSON.stringify(rows.length === 1 ? rows[0] : { columns: lastCols, rows, count: rows.length }, null, 2);
  }
  function rowsTxt(rows) {
    if (rows.length === 1) return rowTxt(rows[0]);
    return [lastCols.join("\\t")].concat(rows.map((r) => lastCols.map((c) => String(r[c] ?? "").replace(/\\t/g," ").replace(/\\n/g," ")).join("\\t"))).join("\\n");
  }
  function syncSelUi() {
    const n = selected.size;
    const el = document.getElementById("wb-sql-sel-count");
    if (el) el.textContent = n ? (n + " seleccionada" + (n === 1 ? "" : "s") + " · exporta esas") : (lastRows.length ? lastRows.length + " filas · exportá todas o marcá filas" : "sin filas");
    document.querySelectorAll("#wb-sql-grid tbody tr").forEach((tr) => {
      const i = Number(tr.getAttribute("data-ri"));
      const on = selected.has(i);
      tr.classList.toggle("on", on);
      const ck = tr.querySelector("input[type=checkbox]");
      if (ck) ck.checked = on;
    });
    const all = document.getElementById("wb-sql-sel-all");
    if (all) all.checked = lastRows.length > 0 && selected.size === lastRows.length;
  }
  function showInspect(ri, fmt) {
    inspectRi = ri;
    if (fmt) inspectFmt = fmt;
    const box = document.getElementById("wb-sql-inspect");
    const body = document.getElementById("wb-sql-inspect-body");
    const title = document.getElementById("wb-sql-inspect-title");
    const row = lastRows[ri];
    if (!box || !body || !row) return;
    box.hidden = false;
    if (title) title.textContent = "Fila " + (ri + 1) + " / " + lastRows.length;
    body.textContent = inspectFmt === "txt" ? rowTxt(row) : JSON.stringify(row, null, 2);
    document.querySelectorAll("[data-inspect-fmt]").forEach((b) => b.classList.toggle("on", b.getAttribute("data-inspect-fmt") === inspectFmt));
  }
  function renderGrid(cols, rows) {
    lastCols = cols || [];
    lastRows = rows || [];
    selected = new Set();
    inspectRi = -1;
    const thead = document.querySelector("#wb-sql-grid thead");
    const tbody = document.querySelector("#wb-sql-grid tbody");
    const inspect = document.getElementById("wb-sql-inspect");
    if (inspect) inspect.hidden = true;
    if (!lastCols.length) {
      thead.innerHTML = "";
      tbody.innerHTML = "";
      syncSelUi();
      return;
    }
    thead.innerHTML = "<tr><th class=sql-ck><input type=checkbox id=wb-sql-sel-all title=Todas></th><th class=sql-rn>#</th>" + lastCols.map((c) => "<th>" + cellEsc(c) + "</th>").join("") + "</tr>";
    tbody.innerHTML = lastRows.map((row, ri) => {
      const cells = lastCols.map((c) => {
        const raw = row[c] ?? "";
        return "<td class=sql-val title=\\"" + cellEsc(raw) + "\\" data-ri=\\"" + ri + "\\" data-c=\\"" + cellEsc(c) + "\\">" + cellEsc(String(raw).slice(0,240)) + "</td>";
      }).join("");
      return "<tr data-ri=\\"" + ri + "\\"><td class=sql-ck><input type=checkbox data-ri=\\"" + ri + "\\"></td><td class=sql-rn data-ri=\\"" + ri + "\\">" + (ri + 1) + "</td>" + cells + "</tr>";
    }).join("");
    const meta = document.getElementById("wb-sql-meta");
    if (meta) meta.textContent = lastCols.length + " columnas · # o casilla selecciona · clic valor copia · doble clic abre JSON";
    syncSelUi();
  }
  function toggleRange(ri, additive, range) {
    if (range) {
      const a = Math.min(lastClickRi, ri);
      const b = Math.max(lastClickRi, ri);
      if (!additive) selected = new Set();
      for (let i = a; i <= b; i++) selected.add(i);
    } else if (additive) {
      if (selected.has(ri)) selected.delete(ri); else selected.add(ri);
    } else {
      selected = new Set([ri]);
    }
    lastClickRi = ri;
    syncSelUi();
  }
  async function runSql() {
    try {
      setMsg("wb-sql-msg", "Ejecutando…");
      const j = await apiCall("POST", "/api/sql", {
        sql: document.getElementById("wb-sql-ed").value,
        connectionId: document.getElementById("wb-sql-origin").value,
        limit: Number(document.getElementById("wb-sql-limit").value || 200),
      });
      renderGrid(j.columns, j.rows);
      const n = (j.rows || []).length;
      setMsg("wb-sql-msg", n + " filas" + (j.truncated ? " (recorte)" : "") + (j.kind === "exec" ? " · EXEC" : ""), true);
    } catch (e) {
      renderGrid([], []);
      setMsg("wb-sql-msg", e.message, false);
    }
  }
  document.getElementById("wb-sql-run")?.addEventListener("click", runSql);
  const sqlEd = document.getElementById("wb-sql-ed");
  sqlEd?.addEventListener("input", syncGutter);
  sqlEd?.addEventListener("scroll", () => {
    const g = document.getElementById("wb-sql-gutter");
    if (g) g.scrollTop = sqlEd.scrollTop;
  });
  sqlEd?.addEventListener("keydown", (e) => {
    if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) { e.preventDefault(); runSql(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const a = sqlEd.selectionStart, b = sqlEd.selectionEnd;
      sqlEd.value = sqlEd.value.slice(0, a) + "  " + sqlEd.value.slice(b);
      sqlEd.selectionStart = sqlEd.selectionEnd = a + 2;
      syncGutter();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "F5") return;
    const on = document.querySelector("nav button.on")?.dataset.go;
    if (on === "sql") { e.preventDefault(); runSql(); }
  });
  document.getElementById("wb-sql-grid")?.addEventListener("change", (e) => {
    if (e.target.id === "wb-sql-sel-all") {
      selected = e.target.checked ? new Set(lastRows.map((_, i) => i)) : new Set();
      syncSelUi();
      return;
    }
    const ck = e.target.closest("tbody input[type=checkbox]");
    if (!ck) return;
    const ri = Number(ck.getAttribute("data-ri"));
    if (!Number.isFinite(ri)) return;
    if (ck.checked) selected.add(ri); else selected.delete(ri);
    lastClickRi = ri;
    syncSelUi();
  });
  document.getElementById("wb-sql-grid")?.addEventListener("click", (e) => {
    if (e.target.closest("input[type=checkbox]") || e.target.closest("th")) return;
    const tr = e.target.closest("tbody tr");
    if (!tr || !lastCols.length) return;
    const ri = Number(tr.getAttribute("data-ri"));
    if (!Number.isFinite(ri)) return;
    if (e.target.closest("td.sql-rn") || e.target.closest("td.sql-ck")) {
      toggleRange(ri, e.ctrlKey || e.metaKey, e.shiftKey);
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) showInspect(ri);
      return;
    }
    const td = e.target.closest("td.sql-val");
    if (!td) return;
    const c = td.getAttribute("data-c");
    const val = lastRows[ri] ? String(lastRows[ri][c] ?? "") : "";
    navigator.clipboard?.writeText(val).then(() => setMsg("wb-sql-msg", "Copiado", true)).catch(() => {});
  });
  document.getElementById("wb-sql-grid")?.addEventListener("dblclick", (e) => {
    const tr = e.target.closest("tbody tr");
    if (!tr) return;
    const ri = Number(tr.getAttribute("data-ri"));
    if (!Number.isFinite(ri)) return;
    selected = new Set([ri]);
    lastClickRi = ri;
    syncSelUi();
    showInspect(ri, "json");
  });
  function inspectPayload() {
    if (inspectRi >= 0 && lastRows[inspectRi]) return { rows: [lastRows[inspectRi]], one: true, i: inspectRi };
    const rows = pickRows();
    return { rows, one: rows.length === 1, i: selected.size === 1 ? [...selected][0] : -1 };
  }
  function inspectText(fmt) {
    const p = inspectPayload();
    if (!p.rows.length) return "";
    if (fmt === "txt") return p.one ? rowTxt(p.rows[0]) : rowsTxt(p.rows);
    return p.one ? JSON.stringify(p.rows[0], null, 2) : rowsJson(p.rows);
  }
  function refreshInspect() {
    const box = document.getElementById("wb-sql-inspect");
    const body = document.getElementById("wb-sql-inspect-body");
    const title = document.getElementById("wb-sql-inspect-title");
    const p = inspectPayload();
    if (!box || !body || !p.rows.length) return;
    box.hidden = false;
    if (title) title.textContent = p.one ? ("Fila " + ((p.i >= 0 ? p.i : 0) + 1) + " / " + lastRows.length) : (p.rows.length + " filas");
    body.textContent = inspectText(inspectFmt);
    document.querySelectorAll("[data-inspect-fmt]").forEach((b) => b.classList.toggle("on", b.getAttribute("data-inspect-fmt") === inspectFmt));
  }
  function viewSel(fmt) {
    if (!lastRows.length) { setMsg("wb-sql-msg", "No hay resultados", false); return; }
    inspectFmt = fmt;
    if (selected.size === 1) inspectRi = [...selected][0];
    else if (selected.size > 1) inspectRi = -2;
    else inspectRi = lastRows.length === 1 ? 0 : -2;
    refreshInspect();
  }
  function needRows() {
    if (!pickRows().length) { setMsg("wb-sql-msg", "No hay resultados para exportar", false); return false; }
    return true;
  }
  function fileTag() {
    const n = selected.size;
    return n ? ("-" + n + "filas") : "";
  }
  function csvText(rows) {
    const data = rows || pickRows();
    return lastCols.map((c) => JSON.stringify(c ?? "")).join(",") + "\\n" + data.map((r) => lastCols.map((c) => JSON.stringify(r[c] ?? "")).join(",")).join("\\n");
  }
  function xlsHtml(rows) {
    const data = rows || pickRows();
    const head = lastCols.map((c) => "<th>" + cellEsc(c) + "</th>").join("");
    const body = data.map((r) => "<tr>" + lastCols.map((c) => "<td>" + cellEsc(r[c]) + "</td>").join("") + "</tr>").join("");
    return "<html xmlns:o=\\"urn:schemas-microsoft-com:office:office\\" xmlns:x=\\"urn:schemas-microsoft-com:office:excel\\"><head><meta charset=\\"utf-8\\"/></head><body><table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></body></html>";
  }
  function dlJson() {
    if (!needRows()) return;
    const rows = pickRows();
    const body = rows.length === 1 ? JSON.stringify(rows[0], null, 2) : JSON.stringify({ columns: lastCols, rows, count: rows.length, exportedAt: new Date().toISOString() }, null, 2);
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".json", "application/json", body);
  }
  function dlTxt() {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".txt", "text/plain;charset=utf-8", rowsTxt(pickRows()));
  }
  function dlXls() {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".xls", "application/vnd.ms-excel", xlsHtml());
  }
  document.getElementById("wb-sql-csv")?.addEventListener("click", () => {
    if (!needRows()) return;
    downloadBlob("consulta" + fileTag() + "-" + stamp() + ".csv", "text/csv;charset=utf-8", "\\uFEFF" + csvText());
  });
  document.getElementById("wb-sql-json")?.addEventListener("click", dlJson);
  document.getElementById("wb-sql-txt")?.addEventListener("click", dlTxt);
  document.getElementById("wb-sql-xls")?.addEventListener("click", dlXls);
  document.getElementById("wb-sql-dl-json")?.addEventListener("click", dlJson);
  document.getElementById("wb-sql-dl-txt")?.addEventListener("click", dlTxt);
  document.getElementById("wb-sql-dl-xls")?.addEventListener("click", dlXls);
  document.getElementById("wb-sql-sel-all-btn")?.addEventListener("click", () => {
    selected = new Set(lastRows.map((_, i) => i));
    syncSelUi();
  });
  document.getElementById("wb-sql-sel-none")?.addEventListener("click", () => {
    selected = new Set();
    syncSelUi();
  });
  document.getElementById("wb-sql-view-json")?.addEventListener("click", () => viewSel("json"));
  document.getElementById("wb-sql-view-txt")?.addEventListener("click", () => viewSel("txt"));
  document.getElementById("wb-sql-copy-sel")?.addEventListener("click", () => {
    if (!needRows()) return;
    const t = inspectFmt === "txt" ? rowsTxt(pickRows()) : rowsJson(pickRows());
    navigator.clipboard?.writeText(t).then(() => setMsg("wb-sql-msg", "Copiado", true)).catch(() => {});
  });
  document.querySelectorAll("[data-inspect-fmt]").forEach((b) => b.addEventListener("click", () => {
    inspectFmt = b.getAttribute("data-inspect-fmt") || "json";
    refreshInspect();
  }));
  document.getElementById("wb-sql-inspect-copy")?.addEventListener("click", () => {
    const t = document.getElementById("wb-sql-inspect-body")?.textContent || "";
    navigator.clipboard?.writeText(t).then(() => setMsg("wb-sql-msg", "Copiado", true)).catch(() => {});
  });
  document.getElementById("wb-sql-inspect-dl")?.addEventListener("click", () => {
    const p = inspectPayload();
    if (!p.rows.length) return;
    const ext = inspectFmt === "txt" ? "txt" : "json";
    const tag = p.one ? ("-fila" + ((p.i >= 0 ? p.i : 0) + 1)) : fileTag();
    downloadBlob("consulta" + tag + "-" + stamp() + "." + ext, ext === "json" ? "application/json" : "text/plain;charset=utf-8", inspectText(inspectFmt));
  });
  document.getElementById("wb-sql-inspect-close")?.addEventListener("click", () => {
    const box = document.getElementById("wb-sql-inspect");
    if (box) box.hidden = true;
  });
  syncGutter();
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
    apiCall("GET", "/api/health").then((j) => {
      const el = document.getElementById("wb-sql-driver");
      if (!el) return;
      const d = j.driver || {};
      const mssql = d.mssql === "ready" ? "SQL Server listo" : "SQL Server: npm install en packages/afn-mcp-context";
      const pg = d.pg === "ready" ? " · PostgreSQL listo" : "";
      el.textContent = "Driver: " + mssql + pg + ". require.resolve del pack, sin npx. No instales paquetes en el producto.";
    }).catch(() => {});
  }
`;
}
